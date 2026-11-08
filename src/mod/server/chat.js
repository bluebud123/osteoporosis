/* PeriLoop chat proxy. Fetch-style handler: (Request) -> Response.
 * Runs as `node chat.js` (plain http) or as an edge/serverless handler via the exported `default`.
 * Env: PROVIDER_BASE_URL, PROVIDER_KEY, PROVIDER_MODEL, PROVIDER_ENDPOINT (optional), ALLOWED_ORIGINS (comma list, optional), PORT.
 * The provider key is read from env only and is never returned to the caller.
 *
 * Two request types, both POST JSON:
 *  - intake (default, no `mode`): {messages:[{role,content}...], json?, lang?}. Identifiers are refused (422).
 *    The server adds SYSTEM_GUARD. Client system messages are rejected.
 *  - second_check: {mode:'second_check', text:'<patient message>'}. The SERVER owns the prompt (SC.SYSTEM_PROMPT from
 *    mod/second_check.js). The client cannot send messages or a system prompt in this mode; any such field is ignored.
 *    Identifiers are redacted (not refused) so an urgent message is still screened. Returns {text:'{"verdict","reason"}'}
 *    where the JSON is strictly validated, or {verdict:'unscreened'} on any failure.
 */
'use strict';

var A = require('../adapter.js');
var SC = require('../second_check.js');
var SYSTEM_GUARD = A.SYSTEM_GUARD;

var BODY_CAP = 8 * 1024;
var MSG_CAP = 2000;          // chars per message
var MAX_MESSAGES = 30;
var UPSTREAM_TIMEOUT_MS = 20 * 1000;
var INTAKE_RATE_LIMIT = 20;         // requests per IP per minute
var SECOND_CHECK_RATE_LIMIT = 60;   // separate bucket: second checks do not use up intake quota
var RATE_WINDOW_MS = 60 * 1000;
var SECOND_CHECK_UPSTREAM_MS = 7 * 1000;  // under the page's 8 s client timeout, so the server answers first
var SECOND_CHECK_MAX_TOKENS = 80;
var SECOND_CHECK_TEXT_CAP = 2000;
var UNAVAILABLE = { verdict: 'unscreened', reason: 'second check unavailable' };

// Fixed-window limiter per IP. Returns a function (ip, now?) -> true when the request is over the limit.
function makeLimiter(limit, windowMs) {
  var hits = new Map();   // in-memory, per instance only
  return function rateLimited(ip, now) {
    if (typeof now !== 'number') now = Date.now();
    var rec = hits.get(ip);
    if (!rec || now >= rec.reset) { rec = { count: 0, reset: now + windowMs }; hits.set(ip, rec); }
    rec.count++;
    if (hits.size > 5000) { hits.forEach(function (v, k) { if (now >= v.reset) hits.delete(k); }); }
    return rec.count > limit;
  };
}
var intakeLimited = makeLimiter(INTAKE_RATE_LIMIT, RATE_WINDOW_MS);
var secondCheckLimited = makeLimiter(SECOND_CHECK_RATE_LIMIT, RATE_WINDOW_MS);

// Obvious identifiers: 12-digit IC-like number, email, phone-like digit runs (9 to 15 digits).
var IC_RE = /(?<!\d)\d{6}-?\d{2}-?\d{4}(?!\d)/;
var EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
var PHONE_CANDIDATE_RE = /\+?\d[\d\s()-]{7,}\d/g;

function findIdentifier(text) {
  if (IC_RE.test(text)) return 'ic_number';
  if (EMAIL_RE.test(text)) return 'email';
  var m;
  PHONE_CANDIDATE_RE.lastIndex = 0;
  while ((m = PHONE_CANDIDATE_RE.exec(text))) {
    var digits = m[0].replace(/\D/g, '').length;
    if (digits >= 9 && digits <= 15) return 'phone_number';
  }
  return null;
}

// Second check only: replace identifiers with a tag so the text is still screened. IC first, then phone (IC is 12 digits).
function redact(text) {
  var t = String(text == null ? '' : text);
  t = t.replace(new RegExp(EMAIL_RE.source, 'g'), '[email]');
  t = t.replace(new RegExp(IC_RE.source, 'g'), '[id]');
  t = t.replace(new RegExp(PHONE_CANDIDATE_RE.source, 'g'), function (m) {
    var digits = m.replace(/\D/g, '').length;
    return digits >= 9 && digits <= 15 ? '[phone]' : m;
  });
  return t;
}

function corsHeaders(origin) {
  var allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var ok = false;
  if (origin) {
    try {
      var host = new URL(origin).hostname;
      ok = allowed.indexOf(origin) >= 0 || /\.github\.io$/.test(host);
    } catch (e) { ok = false; }
  }
  var h = { 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600', vary: 'origin' };
  if (ok) h['access-control-allow-origin'] = origin;
  return h;
}

function json(status, obj, cors) {
  var headers = Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, cors || {});
  return new Response(JSON.stringify(obj), { status: status, headers: headers });
}

function clientIp(req) {
  var xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || req.headers.get('x-client-ip') || 'unknown';
}

function validMessages(list) {
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_MESSAGES) return false;
  return list.every(function (m) {
    return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.length <= MSG_CAP;
  });
}

async function callProvider(messages, wantJson) {
  var base = (process.env.PROVIDER_BASE_URL || '').replace(/\/+$/, '');
  var key = process.env.PROVIDER_KEY || '';
  var model = process.env.PROVIDER_MODEL || '';
  var endpoint = process.env.PROVIDER_ENDPOINT || '/v1/chat/completions';
  var body = { model: model, messages: messages, temperature: 0, stream: false };
  if (wantJson) body.response_format = { type: 'json_object' };
  var ctl = new AbortController();
  var timer = setTimeout(function () { ctl.abort(); }, UPSTREAM_TIMEOUT_MS);
  try {
    var headers = { 'content-type': 'application/json' };
    if (key) headers.authorization = 'Bearer ' + key;
    var res = await fetch(base + endpoint, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctl.signal });
    if (!res.ok) return { ok: false, status: 502 };
    var data = await res.json();
    var text = data && data.choices && data.choices[0] && data.choices[0].message ? String(data.choices[0].message.content || '') : '';
    if (!text) return { ok: false, status: 502 };
    return { ok: true, text: text.slice(0, 4000) };
  } catch (e) {
    return { ok: false, status: 502 };
  } finally {
    clearTimeout(timer);
  }
}

// Strict check of the model's answer. Returns {verdict, reason} or null. Reason is cut to 12 words and screened by the output guard.
function validateVerdict(content, text) {
  var o = SC.parseStrict(content);
  if (!o) return null;
  var words = String(o.reason).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).slice(0, 12);
  if (!words.length) return null;
  var reason = words.join(' ');
  if (!A.guardReply(reason, text, null).ok) reason = SC.FLAGGED_REASON;
  return { verdict: o.verdict, reason: reason };
}

// Second check upstream call. The server-side prompt is fixed; the patient text is wrapped and cannot close the tag.
async function callSecondCheck(text) {
  var base = (process.env.PROVIDER_BASE_URL || '').replace(/\/+$/, '');
  var key = process.env.PROVIDER_KEY || '';
  var model = process.env.PROVIDER_MODEL || '';
  var endpoint = process.env.PROVIDER_ENDPOINT || '/v1/chat/completions';
  var body = {
    model: model,
    temperature: 0,
    max_tokens: SECOND_CHECK_MAX_TOKENS,
    stream: false,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SC.SYSTEM_PROMPT },
      { role: 'user', content: SC.wrapMsg(text) }
    ]
  };
  var ctl = new AbortController();
  var timer = setTimeout(function () { ctl.abort(); }, SECOND_CHECK_UPSTREAM_MS);
  try {
    var headers = { 'content-type': 'application/json' };
    if (key) headers.authorization = 'Bearer ' + key;
    var res = await fetch(base + endpoint, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctl.signal });
    if (!res.ok) return null;
    var data = await res.json();
    var content = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    if (typeof content !== 'string') return null;
    return validateVerdict(content, text);
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function handleSecondCheck(parsed, cors) {
  // Only `text` is read. Any messages or system field from the client is ignored.
  var text = typeof parsed.text === 'string' ? parsed.text : '';
  if (!text.trim() || text.length > SECOND_CHECK_TEXT_CAP) return json(400, { error: 'bad_text' }, cors);
  if (!process.env.PROVIDER_BASE_URL || !process.env.PROVIDER_KEY) return json(500, { error: 'not_configured' }, cors);
  var result = await callSecondCheck(redact(text));
  return json(200, { text: JSON.stringify(result || UNAVAILABLE) }, cors);
}

async function handle(req) {
  var origin = req.headers.get('origin');
  var cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' }, cors);

  var declared = Number(req.headers.get('content-length') || 0);
  if (declared > BODY_CAP) return json(413, { error: 'body_too_large' }, cors);

  var raw = new Uint8Array(await req.arrayBuffer());
  if (raw.byteLength > BODY_CAP) return json(413, { error: 'body_too_large' }, cors);

  var parsed = null;
  try { parsed = JSON.parse(new TextDecoder().decode(raw)); } catch (e) { parsed = null; }
  var secondMode = !!parsed && typeof parsed === 'object' && parsed.mode === 'second_check';
  var limited = secondMode ? secondCheckLimited(clientIp(req)) : intakeLimited(clientIp(req));
  if (limited) return json(429, { error: 'rate_limited' }, Object.assign({ 'retry-after': '60' }, cors));

  if (!parsed || typeof parsed !== 'object') return json(400, { error: 'bad_json' }, cors);
  if (parsed.mode !== undefined && parsed.mode !== 'second_check') return json(400, { error: 'bad_mode' }, cors);
  if (secondMode) return handleSecondCheck(parsed, cors);

  if (!validMessages(parsed.messages)) return json(400, { error: 'bad_messages' }, cors);

  // Refuse identifiers before anything reaches the provider. Report the kind only, never the value.
  for (var i = 0; i < parsed.messages.length; i++) {
    var kind = findIdentifier(parsed.messages[i].content);
    if (kind) return json(422, { error: 'identifier_detected', kind: kind, message: 'Please do not type names, IC or ID numbers, phone numbers or email addresses here.' }, cors);
  }

  if (!process.env.PROVIDER_BASE_URL || !process.env.PROVIDER_KEY) return json(500, { error: 'not_configured' }, cors);

  var history = parsed.messages.filter(function (m) { return m.role !== 'system'; });
  var messages = [{ role: 'system', content: SYSTEM_GUARD }].concat(history);
  var out = await callProvider(messages, !!parsed.json);
  if (!out.ok) return json(out.status, { error: 'upstream_failed' }, cors);
  return json(200, { text: out.text, provider: 'proxy', mode: 'ai' }, cors);
}

module.exports = {
  handle: handle,
  default: handle,
  findIdentifier: findIdentifier,
  redact: redact,
  makeLimiter: makeLimiter,
  INTAKE_RATE_LIMIT: INTAKE_RATE_LIMIT,
  SECOND_CHECK_RATE_LIMIT: SECOND_CHECK_RATE_LIMIT
};

// Plain Node runner: `node chat.js` (PORT defaults to 8787).
if (typeof require !== 'undefined' && require.main === module) {
  var http = require('http');
  var port = Number(process.env.PORT || 8787);
  http.createServer(function (req, res) {
    var chunks = [];
    var size = 0;
    var aborted = false;
    req.on('data', function (c) {
      size += c.length;
      if (size > BODY_CAP) {
        aborted = true;
        res.writeHead(413, { 'content-type': 'application/json' });
        res.end('{"error":"body_too_large"}');
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', function () {
      if (aborted) return;
      var headers = {};
      Object.keys(req.headers).forEach(function (k) { headers[k] = req.headers[k]; });
      if (!headers['x-client-ip']) headers['x-client-ip'] = req.socket.remoteAddress || 'unknown';
      var request = new Request('http://localhost' + req.url, {
        method: req.method,
        headers: headers,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks)
      });
      handle(request).then(function (r) {
        var outHeaders = {};
        r.headers.forEach(function (v, k) { outHeaders[k] = v; });
        res.writeHead(r.status, outHeaders);
        r.text().then(function (t) { res.end(t); });
      }).catch(function () {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end('{"error":"server_error"}');
      });
    });
  }).listen(port, function () {
    console.log('PeriLoop chat proxy on port ' + port);
  });
}
