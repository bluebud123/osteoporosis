'use strict';
/* v8 checks: what a public hosted demo needs. Host-set passwords and settings, the full reset and the idle reset, the daily
 * ceiling on AI calls, and login limits that work behind a host's proxy.   node app/eval/v8.test.js */
var http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
process.env.PERILOOP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'v8-')); delete process.env.PERILOOP_NO_SEED;
process.env.PERILOOP_DEMO = '1'; process.env.PERILOOP_DOCTOR_PW = 'judge-doctor-pass'; process.env.PERILOOP_NURSE_PW = 'judge-nurse-pass';
process.env.PERILOOP_EMERGENCY_NUMBER = '998'; process.env.PERILOOP_CLINIC_PHONE = '02-000 0000 (demo)'; process.env.PERILOOP_DEMO_RESET_MIN = '30'; process.env.PERILOOP_TRUST_PROXY = '1';
process.env.PROVIDER_BASE_URL = 'http://localhost:9777'; process.env.PROVIDER_KEY = 'x'; process.env.PROVIDER_MODEL = 'standin'; process.env.AI_DAILY_MAX = '12';
var pass = 0, fail = 0; function ok(c, name, extra) { if (c) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); } }
function call(port, method, p, body, cookie, hdr) { return new Promise(function (res) { var d = body ? JSON.stringify(body) : null; var q = http.request({ port: port, path: p, method: method, headers: Object.assign({ 'content-type': 'application/json', 'x-requested-with': 'periloop' }, cookie ? { cookie: cookie } : {}, hdr || {}) }, function (r) { var c = []; r.on('data', function (x) { c.push(x); }); r.on('end', function () { var t = Buffer.concat(c).toString(), j; try { j = JSON.parse(t); } catch (e) { j = t; } res({ status: r.statusCode, json: j, raw: t, cookie: (r.headers['set-cookie'] || [''])[0].split(';')[0], setCookie: (r.headers['set-cookie'] || [''])[0] }); }); }); if (d) q.write(d); q.end(); }); }
(async function () {
  // every page's script must at least parse: on 12 Nov a stray apostrophe in staff.html shipped a blank page to the live demo
  ['staff.html', 'patient.html', 'live.html'].forEach(function (f) { var h = fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8'), bad = '';
    (h.match(/<script>[\s\S]*?<\/script>/g) || []).forEach(function (b) { try { new Function(b.replace(/^<script>|<\/script>$/g, '')); } catch (e) { bad = e.message; } });
    ok(!bad, 'pages: the script in ' + f + ' parses', bad); });
  (function () { var h = fs.readFileSync(path.join(__dirname, 'label.html'), 'utf8'), bad = ''; (h.match(/<script>[\s\S]*?<\/script>/g) || []).forEach(function (b) { try { new Function(b.replace(/^<script>|<\/script>$/g, '')); } catch (e) { bad = e.message; } }); ok(!bad, 'pages: the script in label.html parses', bad); })();
  var standin = cp.spawn(process.execPath, [path.join(__dirname, 'standin_model.js')], { stdio: 'ignore' }); await new Promise(function (r) { setTimeout(r, 700); });
  var S = require('../server.js'), srv = S.createServer(); await new Promise(function (r) { srv.listen(0, r); }); var port = srv.address().port;
  try {
    ok((await call(port, 'GET', '/healthz')).json.ok === true, 'host: the health check answers without a login');
    ok((await call(port, 'POST', '/api/login', { username: 'doctor', password: 'doctor-demo-1' }, null, { 'x-forwarded-for': '10.0.0.1' })).status !== 200, 'host: the password printed in the public README does not work');
    var lg = await call(port, 'POST', '/api/login', { username: 'doctor', password: 'judge-doctor-pass' }, null, { 'x-forwarded-for': '10.0.0.1', 'x-forwarded-proto': 'https' }), doc = lg.cookie;
    ok(lg.status === 200 && /; Secure/.test(lg.setCookie), 'host: the password set on the host works, and the login cookie is marked Secure over HTTPS');
    var me = (await call(port, 'GET', '/api/me', null, doc)).json;
    ok(me.demoHost === true && me.demoResetMin === 30 && me.settings.emergencyNumber === '998', 'host: demo mode and the emergency number come from the host settings', { demoHost: me.demoHost, num: me.settings && me.settings.emergencyNumber });
    // one visitor hammering the login does not lock out another
    for (var i = 0; i < 12; i++) await call(port, 'POST', '/api/login', { username: 'doctor', password: 'wrong' }, null, { 'x-forwarded-for': '10.9.9.9' });
    ok((await call(port, 'POST', '/api/login', { username: 'doctor', password: 'wrong' }, null, { 'x-forwarded-for': '10.9.9.9' })).status === 429 && (await call(port, 'POST', '/api/login', { username: 'nurse', password: 'judge-nurse-pass' }, null, { 'x-forwarded-for': '10.0.0.2' })).status === 200, 'host: a visitor who tries many passwords is blocked; another visitor can still log in');
    // dirty the demo, then full reset
    var pts = (await call(port, 'GET', '/api/patients', null, doc)).json, n0 = pts.length, pid = pts[0].id;
    await call(port, 'POST', '/api/patients', { name: 'Judge Added', rn: 'JUDGE-1', age: 50, sex: 'F', procedure: 'TKR', otDate: '2099-01-05', lang: 'en' }, doc);
    await call(port, 'POST', '/api/lessons', { text: 'A lesson a judge typed while exploring the demo.', tags: ['tone'] }, doc);
    await call(port, 'POST', '/api/settings', { emergencyNumber: '111', maxCasesPerDay: 2 }, doc);
    await call(port, 'POST', '/api/live/send', { pid: pid, text: 'i cant breathe and my chest hurts' }, doc); await S.drain();
    var nurse = (await call(port, 'POST', '/api/login', { username: 'nurse', password: 'judge-nurse-pass' }, null, { 'x-forwarded-for': '10.0.0.3' })).cookie;
    ok((await call(port, 'POST', '/api/demo/full-reset', {}, nurse)).status === 403, 'reset: a nurse cannot reset the whole demo');
    var fr = await call(port, 'POST', '/api/demo/full-reset', {}, doc), after = (await call(port, 'GET', '/api/patients', null, doc)).json, lr = (await call(port, 'GET', '/api/learning', null, doc)).json, me2 = (await call(port, 'GET', '/api/me', null, doc)).json;
    ok(fr.status === 200 && after.length === n0 && !after.some(function (p) { return p.rn === 'JUDGE-1'; }) && lr.lessons.length === 0 && (await call(port, 'GET', '/api/alerts', null, doc)).json.filter(function (a) { return /breathe/.test(a.text); }).length === 0, 'reset: patients, chats, alerts and lessons are back to the start, and the same login still works', { n: after.length, n0: n0 });
    ok(me2.settings.emergencyNumber === '998' && (await call(port, 'POST', '/api/login', { username: 'doctor', password: 'doctor-demo-1' }, null, { 'x-forwarded-for': '10.0.0.4' })).status !== 200, 'reset: host settings and host passwords are applied again (the README password still fails)');
    // idle reset
    await call(port, 'POST', '/api/patients', { name: 'Judge Two', rn: 'JUDGE-2', age: 50, sex: 'M', procedure: 'TKR', otDate: '2099-01-06', lang: 'en' }, doc);
    S.idleTick(); ok((await call(port, 'GET', '/api/patients', null, doc)).json.some(function (p) { return p.rn === 'JUDGE-2'; }), 'idle reset: nothing is reset while someone is using the demo');
    var realNow = Date.now; Date.now = function () { return realNow() + 31 * 60000; }; S.idleTick(); Date.now = realNow;
    ok(!(await call(port, 'GET', '/api/patients', null, doc)).json.some(function (p) { return p.rn === 'JUDGE-2'; }), 'idle reset: after 30 minutes without activity the changed demo is put back');
    // daily AI ceiling (12 calls)
    var pid2 = (await call(port, 'GET', '/api/patients', null, doc)).json[0].id, last;
    for (var k = 0; k < 9; k++) { await call(port, 'POST', '/api/live/send', { pid: pid2, text: 'what is the wifi password on the ward ' + k }, doc); await S.drain(); }
    var bud = (await call(port, 'GET', '/api/me', null, doc)).json.aiBudget, d2 = (await call(port, 'GET', '/api/patients/' + pid2, null, doc)).json, lastP = d2.messages.filter(function (x) { return x.who === 'patient'; }).pop();
    ok(bud.hit === true && bud.used >= 12 && d2.aiOn === false, 'AI ceiling: after the daily limit the system reports the AI as off', bud);
    ok(!lastP.unscreened && (await call(port, 'GET', '/api/alerts', null, doc)).json.filter(function (a) { return /AI check unavailable/.test(a.reason || ''); }).length === 0, 'AI ceiling: reaching the limit switches to rules only quietly; it does not flood staff with "AI unavailable" alerts');
    await call(port, 'POST', '/api/live/send', { pid: pid2, text: 'i cant breathe and my chest hurts' }, doc); await S.drain();
    ok((await call(port, 'GET', '/api/patients/' + pid2, null, doc)).json.messages.filter(function (x) { return x.who === 'patient'; }).pop().cls === 'EMERGENCY', 'AI ceiling: the fixed rules still catch an emergency');
  } finally { standin.kill(); await S.drain(); srv.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
