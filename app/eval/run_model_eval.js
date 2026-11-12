'use strict';
/* Real-model evaluation of the AI second check, through the real server path (mask -> fixed rules -> second check).
 *
 *   PROVIDER_BASE_URL=https://...  PROVIDER_KEY=sk-...  PROVIDER_MODEL=model-name  node app/eval/run_model_eval.js
 *
 * Options:  --limit N     only the first N messages of each set (for a cheap smoke test)
 *           --sets a,b    choose sets: h1,h2,h3,h4,h5,library (default: all)
 *           --parallel N  messages in flight at once (default 3)
 * Output:   a table on screen, and app/eval/model_run_<date>_<model>.md + .json
 *
 * What it measures: for every test message, what the fixed rules said alone, and what the class was after the second check.
 * What it does NOT show: clinical accuracy. Every label in these sets was written by an AI, not a clinician, and every message
 * was invented. All of h1..h5 and the library have been used to tune the rules, so "rules alone" here is optimistic.
 * Patient text is sent to the provider you configure: use it only with these synthetic messages. */
var http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
var args = process.argv.slice(2); function opt(n, d) { var i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; }
if (!process.env.PROVIDER_BASE_URL || !process.env.PROVIDER_KEY || !process.env.PROVIDER_MODEL) {
  console.error('No AI provider is configured, so there is nothing to measure.\n\nSet all three and run again:\n  PROVIDER_BASE_URL   base URL of an OpenAI-compatible provider (for example https://api.example.com)\n  PROVIDER_KEY        your API key\n  PROVIDER_MODEL      the model name\n\nExample:\n  PROVIDER_BASE_URL=https://api.example.com PROVIDER_KEY=sk-... PROVIDER_MODEL=some-model node app/eval/run_model_eval.js --limit 5\n\nThe rules-only numbers need no key: node app/eval/holdout.test.js');
  process.exit(2);
}
var STANDIN = /standin/i.test(process.env.PROVIDER_MODEL) || /localhost:9777|127\.0\.0\.1:9777/.test(process.env.PROVIDER_BASE_URL);
var LIMIT = parseInt(opt('limit', '0'), 10) || 0, PAR = Math.max(1, parseInt(opt('parallel', '3'), 10) || 3);
var WANT = opt('sets', 'h1,h2,h3,h4,h5,library').split(',');
process.env.PERILOOP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'plm-')); process.env.PERILOOP_NO_SEED = '1';
var TR = require('../triage.js');

function load() {
  var items = [];
  ['h1', 'h2', 'h3', 'h4', 'h5'].forEach(function (h) {
    if (WANT.indexOf(h) < 0) return; var f = path.join(__dirname, 'triage_' + h + '.js'); if (!fs.existsSync(f)) return; var T = require(f);
    [['E', 'emergency'], ['S', 'sameday'], ['N', 'normal']].forEach(function (k) { (LIMIT ? T[k[0]].slice(0, LIMIT) : T[k[0]]).forEach(function (c) { items.push({ set: h, lang: c[0], text: c[1], truth: k[1], procedure: 'TKR' }); }); });
  });
  if (WANT.indexOf('library') >= 0) {
    var L = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', 'messages.json'), 'utf8')); var seen = { urgent: 0, normal: 0 };
    L.forEach(function (m) { if (LIMIT && seen[m.truth] >= LIMIT) return; seen[m.truth]++; items.push({ set: 'library', lang: m.lang, text: m.text, truth: m.truth === 'urgent' ? 'urgent' : 'normal', procedure: m.procedure || 'TKR' }); });
  }
  return items;
}
function call(port, method, p, body, cookie) { return new Promise(function (res) { var d = body ? JSON.stringify(body) : null; var q = http.request({ port: port, path: p, method: method, headers: Object.assign({ 'content-type': 'application/json', 'x-requested-with': 'periloop' }, cookie ? { cookie: cookie } : {}) }, function (r) { var c = []; r.on('data', function (x) { c.push(x); }); r.on('end', function () { var t = Buffer.concat(c).toString(), j; try { j = JSON.parse(t); } catch (e) { j = t; } res({ status: r.statusCode, json: j, cookie: (r.headers['set-cookie'] || [''])[0].split(';')[0] }); }); }); q.on('error', function () { res({ status: 0, json: {} }); }); if (d) q.write(d); q.end(); }); }
function ds(off) { var d = new Date(Date.now() + off * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function alertCls(c) { return c === 'EMERGENCY' || c === 'SAME-DAY'; }

(async function () {
  var items = load(), S = require('../server.js'), srv = S.createServer(); await new Promise(function (r) { srv.listen(0, r); }); var port = srv.address().port;
  var doc = (await call(port, 'POST', '/api/login', { username: 'doctor', password: 'doctor-demo-1' })).cookie, n = 0, done = 0, t0 = Date.now();
  var PROCS = { TKR: 1, THR: 1, ACL: 1, LUM: 1, SHO: 1, FOOT: 1 };
  async function one(it) {
    var k = ++n; it.rules = TR.classify(it.text, { procedure: it.procedure }).cls;
    var a = await call(port, 'POST', '/api/patients', { name: 'M' + k, rn: 'M' + String(k).padStart(5, '0'), procedure: PROCS[it.procedure] ? it.procedure : 'TKR', otDate: ds(-4), lang: ['en', 'ms', 'zh', 'ar'].indexOf(it.lang) >= 0 ? it.lang : 'en' }, doc);
    if (!a.json || !a.json.id) { it.final = it.rules; it.error = 'could not create test patient'; return; }
    await call(port, 'POST', '/api/live/send', { pid: a.json.id, text: it.text }, doc);
    var d = (await call(port, 'GET', '/api/patients/' + a.json.id, null, doc)).json, pm = (d.messages || []).filter(function (x) { return x.who === 'patient'; })[0] || {};
    it.final = pm.cls || it.rules; it.unscreened = !!pm.unscreened; it.flags = pm.flags || [];
    it.raisedByModel = !alertCls(it.rules) && alertCls(it.final);
    if (++done % 25 === 0) process.stderr.write('  ' + done + '/' + items.length + ' (' + Math.round((Date.now() - t0) / 1000) + ' s)\n');
  }
  var q = items.slice(); await Promise.all(Array.from({ length: PAR }, async function () { while (q.length) await one(q.shift()); }));
  await S.drain(); srv.close();

  var LANGS = ['en', 'ms', 'zh', 'ar', 'all'];
  function row(sel) {
    var u = sel.filter(function (x) { return x.truth !== 'normal'; }), e = sel.filter(function (x) { return x.truth === 'emergency'; }), nm = sel.filter(function (x) { return x.truth === 'normal'; });
    function c(a, k) { return a.filter(function (x) { return alertCls(x[k]); }).length; }
    return { urgent: u.length, urgentRules: c(u, 'rules'), urgentBoth: c(u, 'final'), emerg: e.length, emergRules: c(e, 'rules'), emergBoth: c(e, 'final'), normal: nm.length, fpRules: c(nm, 'rules'), fpBoth: c(nm, 'final'), unscreened: sel.filter(function (x) { return x.unscreened; }).length };
  }
  function pct(a, b) { return b ? a + '/' + b + ' (' + Math.round(100 * a / b) + '%)' : '-'; }
  function table(sel, title) {
    var out = '### ' + title + '\n\n| Language | Urgent caught, rules alone | Urgent caught, rules + AI check | Of which labelled emergency: rules alone | Emergency: rules + AI check | False alerts, rules alone | False alerts, rules + AI check | AI check unavailable |\n|---|---|---|---|---|---|---|---|\n';
    LANGS.forEach(function (l) { var s = l === 'all' ? sel : sel.filter(function (x) { return x.lang === l; }); if (!s.length) return; var r = row(s); out += '| ' + l + ' | ' + pct(r.urgentRules, r.urgent) + ' | ' + pct(r.urgentBoth, r.urgent) + ' | ' + pct(r.emergRules, r.emerg) + ' | ' + pct(r.emergBoth, r.emerg) + ' | ' + pct(r.fpRules, r.normal) + ' | ' + pct(r.fpBoth, r.normal) + ' | ' + r.unscreened + ' |\n'; });
    return out + '\n';
  }
  var stamp = new Date().toISOString().slice(0, 10), model = String(process.env.PROVIDER_MODEL).replace(/[^A-Za-z0-9._-]/g, '_');
  var banner = STANDIN ? '> **STAND-IN MODEL. THIS IS NOT EVIDENCE.** The "model" here is `app/eval/standin_model.js`, a few lines of canned text used to test that this script runs. Its numbers say nothing about any real AI model.\n\n' : '';
  var md = '# PeriLoop second-check evaluation, ' + stamp + '\n\n' + banner + 'Model: `' + process.env.PROVIDER_MODEL + '` at `' + process.env.PROVIDER_BASE_URL.replace(/\/\/[^/@]*@/, '//') + '`. Messages: ' + items.length + (LIMIT ? ' (limited to ' + LIMIT + ' per group)' : '') + '. Run time: ' + Math.round((Date.now() - t0) / 1000) + ' s.\n\n' +
    'Read this before quoting any number:\n- Every message is invented and every label ("urgent", "emergency", "normal") was written by an AI, not a clinician.\n- Sets h1 to h5 and the library have all been used to tune the fixed rules, so "rules alone" is optimistic. The useful columns are what the AI check adds and what it costs in false alerts.\n- "Caught" means the message raised an EMERGENCY or SAME-DAY alert. The AI check can only raise to SAME-DAY.\n- "AI check unavailable" counts messages where the model call failed or returned something unusable; the rules result stood.\n- One run of one model. Run it again and with another model before relying on it.\n\n';
  md += table(items, 'All sets together');
  var sets = {}; items.forEach(function (x) { sets[x.set] = 1; }); Object.keys(sets).forEach(function (s) { md += table(items.filter(function (x) { return x.set === s; }), 'Set ' + s); });
  var missE = items.filter(function (x) { return x.truth === 'emergency' && !alertCls(x.final); }), missU = items.filter(function (x) { return x.truth !== 'normal' && x.truth !== 'emergency' && !alertCls(x.final); }), fpM = items.filter(function (x) { return x.truth === 'normal' && x.raisedByModel; });
  function list(a) { return a.length ? a.map(function (x) { return '- [' + x.set + ', ' + x.lang + '] ' + x.text + (x.unscreened ? '  (AI check unavailable)' : ''); }).join('\n') + '\n' : '- none\n'; }
  md += '### Emergencies still missed after rules + AI check (' + missE.length + ')\n\n' + list(missE) + '\n### Other urgent messages still missed (' + missU.length + ')\n\n' + list(missU) + '\n### Ordinary messages the AI check raised (' + fpM.length + ')\n\n' + list(fpM);
  var base = path.join(__dirname, 'model_run_' + (STANDIN ? 'STANDIN_' : '') + stamp + '_' + model);
  fs.writeFileSync(base + '.md', md); fs.writeFileSync(base + '.json', JSON.stringify({ standin: STANDIN, model: process.env.PROVIDER_MODEL, date: new Date().toISOString(), limit: LIMIT, items: items }, null, 1));
  console.log(md); console.log('Written: ' + path.relative(process.cwd(), base + '.md') + ' and .json');
  process.exit(0);
})();
