'use strict';
/* PeriLoop Console: a small real system for perioperative follow-up.
 * Staff log in, add patients, edit the pathway and extra red-flag rules, work an inbox and a task board.
 * Patients chat through a private link. Safety order on every patient message:
 *   fixed red-flag rules (+ clinic extra phrases) -> optional model second check (can only raise) -> reply.
 * A model may write a short friendly reply ONLY for non-clinical, non-urgent messages, behind the output guard.
 * Synthetic data only until the clinic has approved real use. No dependencies: needs Node 18 or newer.
 */
var http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
var Store = require('./store.js');
var E = require('./lib/engine.js');
var SC = require('./lib/second_check.js');
var proxy = require('./lib/server/chat.js');

var PORT = Number(process.env.PORT || 8080);
var DATA_DIR = process.env.PERILOOP_DATA || path.join(__dirname, 'data');
var PUBLIC = path.join(__dirname, 'public');
var DAY = 24 * 3600 * 1000;

var store = Store.open(DATA_DIR);

/* ---------- roles, owners, defaults ---------- */
var OWNERS = { surgeon: 'Surgeon', preop_nurse: 'Pre-op nurse', ward_nurse: 'Ward nurse', physio: 'Physiotherapist', admin: 'Admin / insurance', clinic_coordinator: 'Clinic coordinator', clinician: 'Clinician' };
var DOCTOR_OWNERS = { surgeon: 1, clinician: 1 };       // tasks only a doctor may close
var LANGS = { en: 'English', ms: 'Bahasa Malaysia', zh: '中文' };

function defaultPathway() {
  var procedures = {};
  Object.keys(E.PACKS).forEach(function (k) { procedures[k] = { label: E.PACKS[k].label, items: E.PACKS[k].extra.map(function (x) { return { title: x.title, owner: x.owner, due: x.due, kind: x.kind }; }) }; });
  return { shared: E.SHARED.map(function (x) { return { title: x.title, owner: x.owner, due: x.due, kind: x.kind }; }), procedures: procedures };
}
function hash(pw, salt) { return crypto.scryptSync(String(pw), salt, 32).toString('hex'); }
function mkUser(username, name, role, pw) { var salt = crypto.randomBytes(12).toString('hex'); return { username: username, name: name, role: role, salt: salt, hash: hash(pw, salt), createdAt: Date.now() }; }
function uid() { return crypto.randomBytes(6).toString('hex'); }

function init() {
  if (store.db) { store.db.rules.faqs = store.db.rules.faqs || []; return; }
  store.db = {
    users: [mkUser('doctor', 'Dr Demo', 'doctor', 'doctor-demo-1'), mkUser('nurse', 'Nurse Demo', 'nurse', 'nurse-demo-1')],
    patients: [], tasks: [], messages: [], alerts: [], audit: [],
    rules: { pathway: defaultPathway(), redflags: [], faqs: [] },
    settings: { clinicPhone: '03-0000 0000 (set in Settings)', sessionsText: 'Set the clinic hours in Settings', demoBanner: true }
  };
  audit('system', 'first run: demo accounts created');
  store.save();
  if (process.env.PERILOOP_NO_SEED !== '1') seedDemo('system');
}
function audit(who, what) { store.db.audit.push({ at: Date.now(), who: who, what: what }); if (store.db.audit.length > 2000) store.db.audit.splice(0, 500); }

/* ---------- patient-facing fixed texts (follow the clinic-bot rules: route to a staffed channel, never promise a reply) ---------- */
function T(kind, lang) {
  var s = store.db.settings, ph = s.clinicPhone, ses = s.sessionsText;
  var X = {
    EMERGENCY: {
      en: 'Please call 999 or go to the nearest Emergency Department now. This chat is not monitored around the clock and is not for emergencies.',
      ms: 'Sila hubungi 999 atau pergi ke Jabatan Kecemasan terdekat sekarang. Sembang ini tidak dipantau sepanjang masa dan bukan untuk kecemasan.',
      zh: '请立即拨打 999 或前往最近的急诊部。此聊天并非全天候监控，不适用于紧急情况。' },
    SAMEDAY: {
      en: 'Please call the clinic today: ' + ph + '. ' + ses + '. Messages here are not monitored around the clock. If symptoms are severe or getting worse, go to the nearest Emergency Department.',
      ms: 'Sila hubungi klinik hari ini: ' + ph + '. ' + ses + '. Mesej di sini tidak dipantau sepanjang masa. Jika gejala teruk atau bertambah teruk, pergi ke Jabatan Kecemasan terdekat.',
      zh: '请今天致电诊所：' + ph + '。' + ses + '。此处消息并非全天候监控。如症状严重或加重，请前往最近的急诊部。' },
    ROUTE: {
      en: 'A clinician has to answer this, and I cannot. Your message has been saved for the clinic team. If you feel worse or something new worries you, call ' + ph + ' or go to the Emergency Department.',
      ms: 'Soalan ini perlu dijawab oleh doktor, saya tidak boleh menjawabnya. Mesej anda telah disimpan untuk pasukan klinik. Jika anda rasa bertambah teruk, hubungi ' + ph + ' atau pergi ke Jabatan Kecemasan.',
      zh: '这个问题需要医生回答，我无法回答。您的消息已保存给诊所团队。如感觉加重或有新的担心，请致电 ' + ph + ' 或前往急诊部。' },
    FOOT: {
      en: 'If you feel worse or something new worries you, call ' + ph + ' or go to the Emergency Department.',
      ms: 'Jika anda rasa bertambah teruk atau ada perkara baharu, hubungi ' + ph + ' atau pergi ke Jabatan Kecemasan.',
      zh: '若感觉加重或有新的担心，请致电 ' + ph + ' 或前往急诊部。' }
  };
  return (X[kind][lang] || X[kind].en);
}

/* ---------- AI via the same guarded proxy code (no key ever leaves the server) ---------- */
function aiConfigured() { return !!(process.env.PROVIDER_BASE_URL && process.env.PROVIDER_KEY); }
async function aiCall(body, ipKey) {
  var req = new Request('http://localhost/', { method: 'POST', headers: { 'content-type': 'application/json', 'x-client-ip': 'console-' + ipKey }, body: JSON.stringify(body) });
  var res = await proxy.handle(req);
  return res.json();
}
async function secondCheck(text, key) {
  if (!aiConfigured()) return { verdict: 'unscreened', reason: 'AI not configured' };
  try {
    var j = await aiCall({ mode: 'second_check', text: text }, key);
    return JSON.parse(j.text);
  } catch (e) { return { verdict: 'unscreened', reason: 'second check error' }; }
}
async function aiReply(text, history, lang, key) {
  if (!aiConfigured()) return { text: '', skipped: 'AI not configured' };
  try { var j = await aiCall({ mode: 'reply', text: text, history: history, lang: lang }, key); return { text: typeof j.text === 'string' ? j.text : '', blocked: j.blocked || '', error: j.error || '' }; } catch (e) { return { text: '', error: 'call failed' }; }
}

/* ---------- patients, tasks ---------- */
function otTime(dateStr) { var d = new Date(dateStr + 'T08:00:00'); return d.getTime(); }
function pathwayFor(proc) {
  var pw = store.db.rules.pathway, p = pw.procedures[proc];
  return pw.shared.concat(p ? p.items : []);
}
function createTasks(pt) {
  var ot = otTime(pt.otDate);
  pathwayFor(pt.procedure).forEach(function (it) {
    store.db.tasks.push({ id: uid(), pid: pt.id, title: it.title, owner: it.owner, kind: it.kind, due: it.due, dueAt: ot + it.due * DAY, state: 'open', createdAt: Date.now() });
  });
}
function taskView(t) { var overdue = t.state === 'open' && t.dueAt < Date.now(); return Object.assign({}, t, { overdue: overdue, ownerLabel: OWNERS[t.owner] || t.owner, doctorOnly: !!DOCTOR_OWNERS[t.owner] }); }
function ptView(p) {
  var tasks = store.db.tasks.filter(function (t) { return t.pid === p.id; });
  var open = tasks.filter(function (t) { return t.state === 'open'; });
  var alerts = store.db.alerts.filter(function (a) { return a.pid === p.id && !a.ackAt; });
  var needs = store.db.messages.filter(function (m) { return m.pid === p.id && m.needsStaff && !m.handled; });
  return { id: p.id, name: p.name, rn: p.rn, procedure: p.procedure, procLabel: (store.db.rules.pathway.procedures[p.procedure] || {}).label || p.procedure, otDate: p.otDate, lang: p.lang, active: p.active, threadOpen: !!p.threadOpen,
    open: open.length, overdue: open.filter(function (t) { return t.dueAt < Date.now(); }).length, openAlerts: alerts.length, needsReply: needs.length, linked: !!p.firstSeen, demo: !!p.demo, demoCase: p.demoCase || '', expect: p.expect || '' };
}


/* ---------- fictional demo cases (from the project's own test material) ---------- */
function seedDemo(user) {
  var hist; try { hist = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed', 'histories.json'), 'utf8')); } catch (e) { return 0; }
  var added = 0, now = Date.now();
  hist.forEach(function (h, i) {
    var rn = String(h.pid).toUpperCase();
    if (store.db.patients.some(function (x) { return x.rn === rn; })) return;
    if (!store.db.rules.pathway.procedures[h.procedure]) return;
    // spread across the journey: some before surgery, some after
    var offsets = [21, 14, 9, 5, 2, 0, -1, -3, -6, -10];
    var off = offsets[i % offsets.length];
    var d = new Date(now + off * DAY); var ot = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    var short = ('Fict ' + String(h.pid).replace('FIC-', '')).slice(0, 20);
    var pt = { id: uid(), name: short, rn: rn, procedure: h.procedure, otDate: ot, lang: LANGS[h.lang] ? h.lang : 'en', token: crypto.randomBytes(18).toString('base64url'), active: true, createdAt: now, addedBy: user || 'system', demo: true, demoCase: h.case, expect: h.expect, intake: h.answers };
    store.db.patients.push(pt); createTasks(pt);
    // earlier items already done for most demo patients, so the board is realistic: a few stay overdue on purpose
    if (i % 4 !== 0) store.db.tasks.forEach(function (t) { if (t.pid === pt.id && t.dueAt < now - 2 * DAY && t.due <= -8) { t.state = 'done'; t.evidence = 'Demo data: completed'; t.doneBy = 'Demo'; t.doneAt = now - 3 * DAY; } });
    added++;
  });
  if (added) { audit(user || 'system', 'loaded ' + added + ' fictional demo patients'); store.save(); }
  return added;
}

/* ---------- the patient message pipeline ---------- */
var urgentRank = { 'ACK': 0, 'ANSWER': 0, 'ROUTE': 1, 'SAME-DAY': 2, 'EMERGENCY': 3 };
function norm(s) { return E.arNorm(String(s)).toLowerCase().replace(/\s+/g, ' '); }
function addMsg(pid, who, text, extra) { var m = Object.assign({ id: uid(), pid: pid, who: who, text: text, at: Date.now() }, extra || {}); store.db.messages.push(m); return m; }
function raiseAlert(pt, cls, text, reason) {
  var recent = store.db.alerts.find(function (a) { return a.pid === pt.id && !a.ackAt && a.cls === cls && Date.now() - a.at < 10 * 60 * 1000; });
  if (recent) { recent.count = (recent.count || 1) + 1; recent.text = text; recent.lastAt = Date.now(); return recent; }
  var a = { id: uid(), pid: pt.id, cls: cls, text: text, reason: reason, at: Date.now(), count: 1 };
  store.db.alerts.push(a); return a;
}

async function patientMessage(pt, rawText, via) {
  var text = String(rawText || '').replace(/\s+/g, ' ').trim().slice(0, 1000);
  if (!text) return;
  var trace = [], t0 = Date.now(), tick = Date.now();
  function step(n, title, status, detail) { var now = Date.now(); trace.push({ n: n, title: title, status: status, detail: detail, ms: now - tick }); tick = now; }
  // 1. identifiers are masked before anything is stored or sent to a model
  var masked = 0;
  var safe = text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, function () { masked++; return '[email]'; }).replace(/(?<!\d)\d{6}-?\d{2}-?\d{4}(?!\d)/g, function () { masked++; return '[id]'; }).replace(/\+?\d[\d\s()-]{7,}\d/g, function (m) { var n = m.replace(/\D/g, '').length; if (n >= 9 && n <= 15) { masked++; return '[phone]'; } return m; });
  pt.firstSeen = pt.firstSeen || Date.now();
  step(1, 'Receive and mask', masked ? 'raise' : 'pass', masked ? masked + ' identifier(s) masked before storing or sending anywhere' : 'No phone, IC or email found');
  var inMsg = addMsg(pt.id, 'patient', safe, via ? { via: via } : {});
  // 2. fixed red-flag rules
  var rules = E.classify(safe, { procedure: pt.procedure });
  var lang = rules.lang || pt.lang || 'en'; if (!T('FOOT', lang) || !LANGS[lang]) lang = 'en';
  var cls = rules.cls, flags = (rules.flags || []).slice(), reason = '';
  var rulesCls = rules.cls;
  step(2, 'Fixed red-flag rules (written by people, no AI)', (cls === 'EMERGENCY' || cls === 'SAME-DAY') ? 'raise' : 'pass', 'Result: ' + cls + (flags.length ? ' · ' + flags.join('; ') : '') + ' · language detected: ' + lang);
  // 3. clinic extra phrases (can only raise)
  var nt = norm(safe), hitRf = null;
  store.db.rules.redflags.forEach(function (rf) {
    if (rf.phrase && nt.indexOf(norm(rf.phrase)) >= 0 && urgentRank[rf.cls] > urgentRank[cls]) { cls = rf.cls; flags.push('clinic rule: ' + rf.phrase); reason = 'Clinic rule: "' + rf.phrase + '"'; hitRf = rf; }
  });
  step(3, 'Clinic extra phrases (can only raise)', hitRf ? 'raise' : 'pass', hitRf ? 'Matched "' + hitRf.phrase + '" -> ' + hitRf.cls : store.db.rules.redflags.length + ' phrase(s) checked, none matched');
  var urgent = cls === 'EMERGENCY' || cls === 'SAME-DAY';
  var secondUsed = false, sec = null;
  // 4. model second check
  if (urgent) step(4, 'AI second check', 'skip', 'Skipped: rules already say ' + cls + '. The AI is never needed to confirm an emergency.');
  else if (!aiConfigured()) step(4, 'AI second check', 'skip', 'AI is not connected on the server, so rules only.');
  else {
    sec = await secondCheck(safe, pt.id); secondUsed = sec.verdict !== 'unscreened';
    if (sec.verdict === 'urgent') { cls = 'SAME-DAY'; urgent = true; flags.push('second check: ' + sec.reason); reason = 'AI second check: ' + sec.reason; step(4, 'AI second check', 'raise', 'Model says URGENT: "' + sec.reason + '". The class is raised to SAME-DAY. The model can raise, never lower.'); }
    else if (sec.verdict === 'routine') step(4, 'AI second check', 'pass', 'Model says routine. The rules class is unchanged (' + cls + ').');
    else { inMsg.unscreened = true; step(4, 'AI second check', 'warn', 'Model unavailable or invalid: message marked "AI check unavailable" for staff. The rules result stands.'); }
  }
  inMsg.cls = cls; inMsg.flags = flags;
  step(5, 'Decision', urgent ? 'raise' : 'pass', 'Final class: ' + cls + (rulesCls !== cls ? ' (rules said ' + rulesCls + ')' : ''));

  function finish(label, status, detail, staffEffect) {
    step(6, 'Reply path', status, label + (detail ? ' · ' + detail : ''));
    step(7, 'Effect for staff', staffEffect.indexOf('Nothing') === 0 ? 'pass' : 'raise', staffEffect);
    inMsg.trace = trace; inMsg.totalMs = Date.now() - t0;
  }
  if (cls === 'EMERGENCY' || cls === 'SAME-DAY') {
    var al = raiseAlert(pt, cls, safe, reason || flags.join('; '));
    inMsg.needsStaff = true;
    addMsg(pt.id, 'bot', T(cls === 'EMERGENCY' ? 'EMERGENCY' : 'SAMEDAY', lang), { cls: cls });
    finish(cls === 'EMERGENCY' ? 'Fixed emergency text (call 999 / go to the Emergency Department, no promise of a reply)' : 'Fixed same-day text (call the clinic today, not monitored around the clock)', 'pass', 'AI not used for the patient reply', 'Alert ' + (al.count > 1 ? 'merged (x' + al.count + ')' : 'raised') + ' on the Today page and in Alerts; message in the Inbox');
    return;
  }
  if (pt.threadOpen) { inMsg.needsStaff = true; finish('Silent: a person is handling this patient, so the assistant does not answer', 'pass', '', 'Message goes to the Inbox for the staff member'); return; }
  if (cls === 'ANSWER') { addMsg(pt.id, 'bot', rules.reply, { cls: 'ANSWER' }); finish('Built-in draft answer (fixed text)', 'pass', '', 'Nothing for staff'); return; }
  if (cls === 'ACK') { addMsg(pt.id, 'bot', rules.reply, { cls: 'ACK' }); finish('Acknowledgement (fixed text)', 'pass', '', 'Nothing for staff'); return; }
  // clinic-approved answers written by a doctor
  var faq = store.db.rules.faqs.find(function (f) { return f.keywords.some(function (k) { return k && nt.indexOf(norm(k)) >= 0; }); });
  var clinical = flags.join(' ').indexOf('clinical judgement') >= 0;
  if (faq && !clinical) { addMsg(pt.id, 'bot', faq.answer, { cls: 'ANSWER', faq: true, approvedBy: faq.addedBy }); finish('Clinic-approved answer by ' + faq.addedBy + ' (shown exactly as written)', 'pass', '', 'Nothing for staff'); return; }
  // ROUTE: no approved answer. Staff will see it.
  inMsg.needsStaff = true;
  if (clinical) { addMsg(pt.id, 'bot', T('ROUTE', lang), { cls: 'ROUTE', clinical: true }); finish('Clinical question: never answered by the assistant, fixed handover text', 'pass', 'AI is not called for clinical questions', 'Inbox item marked clinical question'); return; }
  if (!secondUsed) { addMsg(pt.id, 'bot', T('ROUTE', lang), { cls: 'ROUTE' }); finish('Fixed handover text', 'pass', 'AI reply not attempted because the second check did not run', 'Message in the Inbox'); return; }
  var hist = store.db.messages.filter(function (m) { return m.pid === pt.id && (m.who === 'patient' || m.who === 'ai' || m.who === 'bot'); }).slice(-7, -1).map(function (m) { return { role: m.who === 'patient' ? 'user' : 'assistant', content: m.text }; });
  var ai = await aiReply(safe, hist, lang, pt.id);
  if (ai.text) { addMsg(pt.id, 'ai', ai.text + ' ' + T('FOOT', lang), { cls: 'ROUTE' }); finish('AI-written reply, shown after the output guard accepted it', 'pass', 'Guard: no advice, no reassurance, no diagnosis, no dose, no invented numbers', 'Message also in the Inbox for a person'); }
  else { addMsg(pt.id, 'bot', T('ROUTE', lang), { cls: 'ROUTE' }); finish('AI reply not used: fixed handover text shown instead', 'warn', ai.blocked ? 'Output guard BLOCKED the model reply: ' + ai.blocked : (ai.error || ai.skipped || 'model returned nothing'), 'Message in the Inbox'); }
}

/* ---------- http helpers ---------- */
var sessions = new Map();     // sid -> {username, exp}
function parseCookies(req) { var o = {}; String(req.headers.cookie || '').split(';').forEach(function (c) { var i = c.indexOf('='); if (i > 0) o[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); }); return o; }
function userOf(req) { var sid = parseCookies(req).sid; var s = sid && sessions.get(sid); if (!s || s.exp < Date.now()) return null; return store.db.users.find(function (u) { return u.username === s.username; }) || null; }
function send(res, code, obj, headers) { var b = JSON.stringify(obj); res.writeHead(code, Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, headers || {})); res.end(b); }
function readBody(req) { return new Promise(function (resolve) { var chunks = [], n = 0; req.on('data', function (c) { n += c.length; if (n > 64 * 1024) { req.destroy(); resolve(null); return; } chunks.push(c); }); req.on('end', function () { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { resolve(null); } }); }); }
var hits = new Map();
function limited(key, max, ms) { var now = Date.now(), r = hits.get(key); if (!r || now > r.reset) { r = { n: 0, reset: now + ms }; hits.set(key, r); } r.n++; if (hits.size > 5000) hits.forEach(function (v, k) { if (now > v.reset) hits.delete(k); }); return r.n > max; }
var MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
function serveFile(res, name) { var f = path.join(PUBLIC, name); fs.readFile(f, function (e, b) { if (e) { res.writeHead(404); res.end('Not found'); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store', 'x-frame-options': 'SAMEORIGIN', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self'" }); res.end(b); }); }

function patientByToken(tok) { return store.db.patients.find(function (p) { return p.active && p.token === tok; }); }
function needDoctor(u) { return u && u.role === 'doctor'; }

/* ---------- routes ---------- */
async function route(req, res) {
  var url = new URL(req.url, 'http://x'), p = url.pathname, m = req.method;
  if (m === 'GET' && (p === '/' || p === '/staff')) return serveFile(res, 'staff.html');
  if (m === 'GET' && p.indexOf('/p/') === 0) return serveFile(res, 'patient.html');
  if (m === 'GET' && p === '/live') return serveFile(res, 'live.html');
  if (m === 'GET' && p === '/healthz') return send(res, 200, { ok: true });
  if (!p.startsWith('/api/')) { res.writeHead(404); return res.end('Not found'); }

  if (m === 'POST' && req.headers['x-requested-with'] !== 'periloop') return send(res, 403, { error: 'bad_request' });
  var body = m === 'POST' ? await readBody(req) : {};
  if (body === null) return send(res, 400, { error: 'bad_json' });

  // ---- patient endpoints (private link, no login) ----
  var pm = p.match(/^\/api\/p\/([A-Za-z0-9_-]{16,64})\/(messages|message)$/);
  if (pm) {
    var pt = patientByToken(pm[1]); if (!pt) return send(res, 404, { error: 'unknown_link' });
    if (m === 'GET' && pm[2] === 'messages') {
      var msgs = store.db.messages.filter(function (x) { return x.pid === pt.id; }).map(function (x) { return { id: x.id, who: x.who, text: x.text, at: x.at, staffName: x.staffName, staffRole: x.staffRole, faq: !!x.faq, approvedBy: x.approvedBy }; });
      return send(res, 200, { name: pt.name, messages: msgs, threadOpen: !!pt.threadOpen });
    }
    if (m === 'POST' && pm[2] === 'message') {
      if (limited('pm-' + pt.id, 20, 5 * 60 * 1000)) return send(res, 429, { error: 'slow_down' });
      if (!body.text || typeof body.text !== 'string') return send(res, 400, { error: 'bad_text' });
      await patientMessage(pt, body.text); store.save();
      return send(res, 200, { ok: true });
    }
  }

  // ---- login ----
  if (m === 'POST' && p === '/api/login') {
    if (limited('login-' + (req.socket.remoteAddress || ''), 10, 5 * 60 * 1000)) return send(res, 429, { error: 'too_many_attempts' });
    var u = store.db.users.find(function (x) { return x.username === String(body.username || '').toLowerCase(); });
    var ok = u && crypto.timingSafeEqual(Buffer.from(hash(body.password || '', u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
    if (!ok) return send(res, 401, { error: 'wrong_login' });
    var sid = crypto.randomBytes(24).toString('hex'); sessions.set(sid, { username: u.username, exp: Date.now() + 12 * 3600 * 1000 });
    audit(u.username, 'login');
    return send(res, 200, { ok: true }, { 'set-cookie': 'sid=' + sid + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200' });
  }
  if (m === 'GET' && p === '/api/demo') return send(res, 200, { demo: !!store.db.settings.demoBanner });

  var user = userOf(req);
  if (!user) return send(res, 401, { error: 'login_required' });

  if (m === 'POST' && p === '/api/logout') { var sid2 = parseCookies(req).sid; sessions.delete(sid2); return send(res, 200, { ok: true }, { 'set-cookie': 'sid=; Max-Age=0; Path=/' }); }
  if (m === 'GET' && p === '/api/me') return send(res, 200, { username: user.username, name: user.name, role: user.role, owners: OWNERS, langs: LANGS, procedures: Object.keys(store.db.rules.pathway.procedures).map(function (k) { return { key: k, label: store.db.rules.pathway.procedures[k].label }; }), ai: aiConfigured(), settings: store.db.settings });

  if (m === 'GET' && p === '/api/summary') {
    var open = store.db.tasks.filter(function (t) { return t.state === 'open' && store.db.patients.find(function (x) { return x.id === t.pid && x.active; }); });
    return send(res, 200, {
      patients: store.db.patients.filter(function (x) { return x.active; }).length,
      overdue: open.filter(function (t) { return t.dueAt < Date.now(); }).length,
      openTasks: open.length,
      openAlerts: store.db.alerts.filter(function (a) { return !a.ackAt; }).length,
      needsReply: store.db.messages.filter(function (x) { return x.needsStaff && !x.handled; }).length,
      setup: /set in Settings|Set the clinic hours/.test(store.db.settings.clinicPhone + store.db.settings.sessionsText),
      ai: aiConfigured()
    });
  }

  if (m === 'GET' && p === '/api/patients') return send(res, 200, store.db.patients.filter(function (x) { return x.active; }).map(ptView));
  if (m === 'POST' && p === '/api/patients') {
    var name = String(body.name || '').trim(), rn = String(body.rn || '').trim().toUpperCase(), proc = String(body.procedure || ''), ot = String(body.otDate || ''), lang = LANGS[body.lang] ? body.lang : 'en';
    if (!name || name.length > 20) return send(res, 400, { error: 'name', message: 'Use a short name only (first name and initial, up to 20 characters).' });
    if (!/^[A-Z0-9-]{3,20}$/.test(rn)) return send(res, 400, { error: 'rn', message: 'Record number: 3 to 20 letters, digits or dashes.' });
    if (store.db.patients.some(function (x) { return x.active && x.rn === rn; })) return send(res, 400, { error: 'rn', message: 'That record number already exists.' });
    if (!store.db.rules.pathway.procedures[proc]) return send(res, 400, { error: 'procedure', message: 'Pick a procedure.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ot) || isNaN(otTime(ot))) return send(res, 400, { error: 'otDate', message: 'Enter the operation date.' });
    var pt2 = { id: uid(), name: name, rn: rn, procedure: proc, otDate: ot, lang: lang, token: crypto.randomBytes(18).toString('base64url'), active: true, createdAt: Date.now(), addedBy: user.username };
    store.db.patients.push(pt2); createTasks(pt2); audit(user.username, 'added patient ' + rn); store.save();
    return send(res, 200, { id: pt2.id });
  }
  var pp = p.match(/^\/api\/patients\/([a-f0-9]+)(?:\/(.+))?$/);
  if (pp) {
    var pat = store.db.patients.find(function (x) { return x.id === pp[1] && x.active; }); if (!pat) return send(res, 404, { error: 'not_found' });
    var sub = pp[2] || '';
    if (m === 'GET' && !sub) {
      return send(res, 200, { patient: ptView(pat), intake: pat.intake || null, link: '/p/' + pat.token,
        tasks: store.db.tasks.filter(function (t) { return t.pid === pat.id; }).sort(function (a, b) { return a.dueAt - b.dueAt; }).map(taskView),
        messages: store.db.messages.filter(function (x) { return x.pid === pat.id; }),
        alerts: store.db.alerts.filter(function (a) { return a.pid === pat.id; }) });
    }
    if (m === 'POST' && sub === 'reply') {
      var txt = String(body.text || '').trim().slice(0, 1000); if (!txt) return send(res, 400, { error: 'empty' });
      addMsg(pat.id, 'staff', txt, { staffName: user.name, staffRole: user.role === 'doctor' ? 'Doctor' : 'Nurse', by: user.username });
      store.db.messages.forEach(function (x) { if (x.pid === pat.id && x.needsStaff) x.handled = true; });
      pat.threadOpen = true; audit(user.username, 'replied to ' + pat.rn); store.save(); return send(res, 200, { ok: true });
    }
    if (m === 'POST' && sub === 'handback') { pat.threadOpen = false; addMsg(pat.id, 'bot', 'Handing you back to the assistant for general questions.', { cls: 'ACK' }); audit(user.username, 'handed back ' + pat.rn); store.save(); return send(res, 200, { ok: true }); }
    if (m === 'POST' && sub === 'dismiss') { store.db.messages.forEach(function (x) { if (x.pid === pat.id && x.needsStaff) x.handled = true; }); store.save(); return send(res, 200, { ok: true }); }
    if (m === 'POST' && sub === 'newlink') { pat.token = crypto.randomBytes(18).toString('base64url'); audit(user.username, 'new link for ' + pat.rn); store.save(); return send(res, 200, { link: '/p/' + pat.token }); }
    if (m === 'POST' && sub === 'remove') { if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' }); pat.active = false; audit(user.username, 'removed patient ' + pat.rn); store.save(); return send(res, 200, { ok: true }); }
    var tm = sub.match(/^tasks\/([a-f0-9]+)\/done$/);
    if (m === 'POST' && tm) {
      var t = store.db.tasks.find(function (x) { return x.id === tm[1] && x.pid === pat.id; }); if (!t) return send(res, 404, { error: 'not_found' });
      var ev = String(body.evidence || '').trim();
      if (ev.length < 3) return send(res, 400, { error: 'evidence', message: 'Write what was done or the result (at least a few words). A task is closed with evidence, never with a bare tick.' });
      if (DOCTOR_OWNERS[t.owner] && user.role !== 'doctor') return send(res, 403, { error: 'doctor_only', message: 'Only a doctor can close this clinical decision.' });
      t.state = 'done'; t.evidence = ev.slice(0, 500); t.doneBy = user.name; t.doneAt = Date.now(); audit(user.username, 'closed task "' + t.title + '" for ' + pat.rn); store.save(); return send(res, 200, { ok: true });
    }
  }


  // ---- demo cases, test-message library, live trace ----
  if (m === 'POST' && p === '/api/demo/load') { if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' }); return send(res, 200, { added: seedDemo(user.username) }); }
  if (m === 'GET' && p === '/api/library') {
    var lib = []; try { lib = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed', 'messages.json'), 'utf8')); } catch (e) { lib = []; }
    return send(res, 200, lib);
  }
  if (m === 'POST' && p === '/api/live/send') {
    var tp = store.db.patients.find(function (x) { return x.id === body.pid && x.active; }); if (!tp) return send(res, 404, { error: 'not_found' });
    var tx = String(body.text || '').trim(); if (!tx) return send(res, 400, { error: 'empty' });
    await patientMessage(tp, tx, 'replayed by ' + user.name + (body.libId ? ' (library ' + String(body.libId).slice(0, 12) + ')' : '')); store.save(); return send(res, 200, { ok: true });
  }
  if (m === 'GET' && p === '/api/trace') {
    var pid5 = url.searchParams.get('pid'); var ms5 = store.db.messages.filter(function (x) { return x.pid === pid5; });
    var out5 = [];
    ms5.forEach(function (x, i) { if (x.who !== 'patient' || !x.trace) return; var replies = []; for (var j = i + 1; j < ms5.length && ms5[j].who !== 'patient'; j++) replies.push({ who: ms5[j].who, text: ms5[j].text, faq: !!ms5[j].faq, staffName: ms5[j].staffName }); out5.push({ id: x.id, text: x.text, at: x.at, via: x.via || '', cls: x.cls, trace: x.trace, totalMs: x.totalMs, replies: replies }); });
    return send(res, 200, out5.slice(-12).reverse());
  }

  if (m === 'GET' && p === '/api/inbox') {
    var items = [];
    store.db.patients.filter(function (x) { return x.active; }).forEach(function (pt3) {
      var ms = store.db.messages.filter(function (x) { return x.pid === pt3.id && x.needsStaff && !x.handled; });
      if (!ms.length) return;
      var worst = ms.reduce(function (a, b) { return urgentRank[b.cls] > urgentRank[a] ? b.cls : a; }, 'ROUTE');
      items.push({ pid: pt3.id, name: pt3.name, rn: pt3.rn, procLabel: ptView(pt3).procLabel, cls: worst, count: ms.length, last: ms[ms.length - 1].text, at: ms[ms.length - 1].at, unscreened: ms.some(function (x) { return x.unscreened; }), clinical: ms.some(function (x) { return (x.flags || []).join(' ').indexOf('clinical judgement') >= 0; }) });
    });
    items.sort(function (a, b) { return urgentRank[b.cls] - urgentRank[a.cls] || a.at - b.at; });
    return send(res, 200, items);
  }
  if (m === 'GET' && p === '/api/alerts') return send(res, 200, store.db.alerts.slice().reverse().slice(0, 100).map(function (a) { var pt4 = store.db.patients.find(function (x) { return x.id === a.pid; }) || {}; return Object.assign({}, a, { name: pt4.name, rn: pt4.rn }); }));
  var am = p.match(/^\/api\/alerts\/([a-f0-9]+)\/ack$/);
  if (m === 'POST' && am) { var al = store.db.alerts.find(function (x) { return x.id === am[1]; }); if (!al) return send(res, 404, { error: 'not_found' }); al.ackBy = user.name; al.ackAt = Date.now(); audit(user.username, 'acknowledged alert'); store.save(); return send(res, 200, { ok: true }); }

  // ---- rules (doctor only to change) ----
  if (m === 'GET' && p === '/api/rules') return send(res, 200, store.db.rules);
  if (m === 'POST' && p === '/api/rules/pathway') {
    if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' });
    var pw = body.pathway; if (!pw || !Array.isArray(pw.shared) || typeof pw.procedures !== 'object') return send(res, 400, { error: 'bad_pathway' });
    function cleanItems(arr) { return (Array.isArray(arr) ? arr : []).slice(0, 60).map(function (x) { return { title: String(x.title || '').trim().slice(0, 120), owner: OWNERS[x.owner] ? x.owner : 'ward_nurse', due: Math.max(-90, Math.min(365, Math.round(Number(x.due) || 0))), kind: String(x.kind || 'review').slice(0, 20) }; }).filter(function (x) { return x.title; }); }
    var next = { shared: cleanItems(pw.shared), procedures: {} };
    Object.keys(pw.procedures).slice(0, 30).forEach(function (k) { if (!/^[A-Z0-9_]{2,20}$/.test(k)) return; var pr = pw.procedures[k]; next.procedures[k] = { label: String(pr.label || k).slice(0, 60), items: cleanItems(pr.items) }; });
    if (!Object.keys(next.procedures).length) return send(res, 400, { error: 'no_procedures' });
    store.db.rules.pathway = next; audit(user.username, 'edited pathway rules (applies to new patients)'); store.save(); return send(res, 200, { ok: true });
  }
  if (m === 'POST' && p === '/api/rules/redflag') {
    if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' });
    var ph = String(body.phrase || '').trim().toLowerCase().slice(0, 80), cl = body.cls === 'EMERGENCY' ? 'EMERGENCY' : 'SAME-DAY';
    if (ph.length < 3) return send(res, 400, { error: 'phrase', message: 'Phrase too short (at least 3 characters).' });
    store.db.rules.redflags.push({ id: uid(), phrase: ph, cls: cl, note: String(body.note || '').slice(0, 120), addedBy: user.name, at: Date.now() }); audit(user.username, 'added red-flag phrase "' + ph + '" -> ' + cl); store.save(); return send(res, 200, { ok: true });
  }
  var dm = p.match(/^\/api\/rules\/redflag\/([a-f0-9]+)\/delete$/);
  if (m === 'POST' && dm) { if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' }); store.db.rules.redflags = store.db.rules.redflags.filter(function (x) { return x.id !== dm[1]; }); audit(user.username, 'removed a red-flag phrase'); store.save(); return send(res, 200, { ok: true }); }
  if (m === 'POST' && p === '/api/rules/faq') {
    if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' });
    var kws = String(body.keywords || '').split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(function (x) { return x.length >= 3; }).slice(0, 10), ans = String(body.answer || '').trim().slice(0, 500);
    if (!kws.length) return send(res, 400, { error: 'keywords', message: 'Add at least one keyword of 3+ characters, separated by commas.' });
    if (ans.length < 10) return send(res, 400, { error: 'answer', message: 'Write the approved answer (at least a sentence).' });
    store.db.rules.faqs.push({ id: uid(), keywords: kws, answer: ans, addedBy: user.name, at: Date.now() }); audit(user.username, 'added approved answer for "' + kws.join(', ') + '"'); store.save(); return send(res, 200, { ok: true });
  }
  var fm = p.match(/^\/api\/rules\/faq\/([a-f0-9]+)\/delete$/);
  if (m === 'POST' && fm) { if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' }); store.db.rules.faqs = store.db.rules.faqs.filter(function (x) { return x.id !== fm[1]; }); audit(user.username, 'removed an approved answer'); store.save(); return send(res, 200, { ok: true }); }
  if (m === 'POST' && p === '/api/rules/apply') {          // add this pathway's current items to an existing patient (only items not already there)
    if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' });
    var tgt = store.db.patients.find(function (x) { return x.id === body.pid && x.active; }); if (!tgt) return send(res, 404, { error: 'not_found' });
    var have = {}; store.db.tasks.forEach(function (t) { if (t.pid === tgt.id) have[t.title] = 1; });
    var added = 0, ot2 = otTime(tgt.otDate); pathwayFor(tgt.procedure).forEach(function (it) { if (!have[it.title]) { store.db.tasks.push({ id: uid(), pid: tgt.id, title: it.title, owner: it.owner, kind: it.kind, due: it.due, dueAt: ot2 + it.due * DAY, state: 'open', createdAt: Date.now() }); added++; } });
    audit(user.username, 'applied pathway to ' + tgt.rn + ' (+' + added + ')'); store.save(); return send(res, 200, { added: added });
  }

  // ---- settings, users, AI ----
  if (m === 'POST' && p === '/api/settings') {
    if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' });
    ['clinicPhone', 'sessionsText'].forEach(function (k) { if (typeof body[k] === 'string' && body[k].trim()) store.db.settings[k] = body[k].trim().slice(0, 160); });
    if (typeof body.demoBanner === 'boolean') store.db.settings.demoBanner = body.demoBanner;
    audit(user.username, 'edited settings'); store.save(); return send(res, 200, { ok: true });
  }
  if (m === 'GET' && p === '/api/users') { if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' }); return send(res, 200, store.db.users.map(function (x) { return { username: x.username, name: x.name, role: x.role }; })); }
  if (m === 'POST' && p === '/api/users') {
    if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' });
    var un = String(body.username || '').toLowerCase().trim(), pw2 = String(body.password || '');
    if (!/^[a-z0-9._-]{3,20}$/.test(un)) return send(res, 400, { error: 'username', message: 'Username: 3 to 20 letters, digits, dot, dash.' });
    if (pw2.length < 8) return send(res, 400, { error: 'password', message: 'Password: at least 8 characters.' });
    if (store.db.users.some(function (x) { return x.username === un; })) return send(res, 400, { error: 'username', message: 'That username exists.' });
    store.db.users.push(mkUser(un, String(body.name || un).slice(0, 40), body.role === 'doctor' ? 'doctor' : 'nurse', pw2)); audit(user.username, 'added user ' + un); store.save(); return send(res, 200, { ok: true });
  }
  if (m === 'POST' && p === '/api/password') {
    var np = String(body.password || ''); if (np.length < 8) return send(res, 400, { error: 'password', message: 'At least 8 characters.' });
    user.salt = crypto.randomBytes(12).toString('hex'); user.hash = hash(np, user.salt); audit(user.username, 'changed password'); store.save(); return send(res, 200, { ok: true });
  }
  if (m === 'POST' && p === '/api/ai/test') {
    if (!aiConfigured()) return send(res, 200, { ok: false, message: 'No AI provider is set on the server (PROVIDER_BASE_URL and PROVIDER_KEY). The system works without it, using rules only.' });
    var s1 = await secondCheck('my leg feels strange and tight since this morning', 'test');
    var r1 = await aiReply('hello', [], 'en', 'test');
    return send(res, 200, { ok: s1.verdict !== 'unscreened', secondCheck: s1.verdict, reply: r1 || '(blocked by the output guard or unavailable: the fixed message would be used)' });
  }
  if (m === 'GET' && p === '/api/audit') { if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' }); return send(res, 200, store.db.audit.slice(-200).reverse()); }
  return send(res, 404, { error: 'not_found' });
}

function createServer() {
  init();
  return http.createServer(function (req, res) { route(req, res).catch(function (e) { console.log('error', e && e.message); try { send(res, 500, { error: 'server_error' }); } catch (x) { /* ignore */ } }); });
}
module.exports = { createServer: createServer, init: init, store: store };
if (require.main === module) {
  createServer().listen(PORT, function () {
    console.log('PeriLoop Console: http://localhost:' + PORT + '   (staff)');
    console.log('AI: ' + (aiConfigured() ? 'on (' + process.env.PROVIDER_BASE_URL + ')' : 'off, rules only. Set PROVIDER_BASE_URL, PROVIDER_KEY, PROVIDER_MODEL to turn it on.'));
    console.log('Demo logins: doctor / doctor-demo-1   nurse / nurse-demo-1   (synthetic data only; change them in Settings)');
    console.log('Data file: ' + store.file);
  });
}
