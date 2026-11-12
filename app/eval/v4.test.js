'use strict';
/* v4 checks: the clinician's emergency line, the AI severity step, the retry and "AI unavailable" alert, and the patient
 * profile memory. Uses app/eval/standin_model.js (canned answers), so this tests the plumbing, NOT any real model.
 *   node app/eval/v4.test.js */
var http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
process.env.PERILOOP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'v4-')); process.env.PERILOOP_NO_SEED = '1';
process.env.PROVIDER_BASE_URL = 'http://localhost:9777'; process.env.PROVIDER_KEY = 'x'; process.env.PROVIDER_MODEL = 'standin';
var T = require('../triage.js'), MEM = require('../memory.js');
var pass = 0, fail = 0; function ok(c, name, extra) { if (c) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); } }
function call(port, method, p, body, cookie) { return new Promise(function (res) { var d = body ? JSON.stringify(body) : null; var q = http.request({ port: port, path: p, method: method, headers: Object.assign({ 'content-type': 'application/json', 'x-requested-with': 'periloop' }, cookie ? { cookie: cookie } : {}) }, function (r) { var c = []; r.on('data', function (x) { c.push(x); }); r.on('end', function () { var t = Buffer.concat(c).toString(), j; try { j = JSON.parse(t); } catch (e) { j = t; } res({ status: r.statusCode, json: j, raw: t, cookie: (r.headers['set-cookie'] || [''])[0].split(';')[0] }); }); }); if (d) q.write(d); q.end(); }); }
function ds(off) { var d = new Date(Date.now() + off * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

(async function () {
  // ---- 1. clinician line (rules only) ----
  ok(T.classify('fever 38.9', {}).cls === 'EMERGENCY', 'line: fever 38.9 gets the emergency text');
  ok(T.classify('temperature 38.2', {}).cls === 'SAME-DAY', 'line: 38.2 stays same-day (below 38.4)');
  ok(T.classify('pus coming from the incision', {}).cls === 'EMERGENCY', 'line: pus from the wound is an emergency');
  ok(T.classify('I slipped in the shower and landed on my new knee', {}).cls === 'EMERGENCY', 'line: a fall onto the operated knee is an emergency');
  ok(T.classify('calf pain', {}).cls === 'SAME-DAY' && T.classify('calf is hard and swollen', {}).cls === 'EMERGENCY', 'line: plain calf pain stays same-day, a hard swollen calf is an emergency');
  ok(T.classify('cant pee at all since yesterday', {}).cls === 'EMERGENCY', 'line: cannot pass urine is an emergency');
  var lowered = 0, n = 0; ['h1', 'h2', 'h3', 'h4', 'h5'].forEach(function (h) { var X = require('./triage_' + h + '.js'); X.E.concat(X.S).concat(X.N).forEach(function (c) { n++; var a = T.classifyBase(c[1], {}).cls, b = T.classify(c[1], {}).cls; if (a !== b && !(a === 'SAME-DAY' && b === 'EMERGENCY')) lowered++; }); });
  ok(lowered === 0, 'line: over ' + n + ' test messages it only ever changes SAME-DAY to EMERGENCY', lowered);
  ok(T.classify('is it normal to get a fever after knee surgery?', {}).cls !== 'EMERGENCY' && T.classify('thanks doc, feeling great', {}).cls !== 'EMERGENCY', 'line: questions and thanks are untouched');

  // ---- 2. memory parsing is strict ----
  var msg = 'hi doc, I take warfarin for my heart and I live alone';
  ok(MEM.parse('[{"cat":"medicine","fact":"takes warfarin","quote":"I take warfarin"}]', msg).length === 1, 'memory: a fact with an exact quote is kept');
  ok(MEM.parse('[{"cat":"condition","fact":"has heart failure","quote":"my heart failure is bad"}]', msg).length === 0, 'memory: a fact whose quote is not in the message is thrown away');
  ok(MEM.parse('[{"cat":"medicine","fact":"you should stop taking warfarin","quote":"I take warfarin"}]', msg).length === 0, 'memory: an instruction is never stored as a fact');
  ok(MEM.parse('[{"cat":"secret","fact":"x y z","quote":"I live alone"}]', msg).length === 0 && MEM.parse('not json', msg).length === 0, 'memory: unknown category or non-JSON gives nothing');
  var L0 = [{ cat: 'medicine', text: 'takes warfarin', status: 'proposed' }];
  ok(MEM.raise(L0, 'a bit of bruising on my arm') === null, 'memory: a proposed (unconfirmed) fact cannot raise');
  L0[0].status = 'confirmed';
  ok(!!MEM.raise(L0, 'a bit of bruising on my arm') && MEM.raise(L0, 'no bruising today') === null && MEM.raise(L0, 'when is my blood test') === null, 'memory: confirmed blood thinner + bruising raises; "no bruising" and "blood test" do not');
  ok(/takes warfarin/.test(MEM.factsLine(L0)) && /not medically verified/.test(MEM.factsLine(L0)), 'memory: confirmed facts reach the staff-side AI with the "not verified" label');

  // ---- 3. through the server, with the stand-in model ----
  var standin = cp.spawn(process.execPath, [path.join(__dirname, 'standin_model.js')], { stdio: 'ignore' }); await new Promise(function (r) { setTimeout(r, 700); });
  var S = require('../server.js'), srv = S.createServer(); await new Promise(function (r) { srv.listen(0, r); }); var port = srv.address().port;
  var doc = (await call(port, 'POST', '/api/login', { username: 'doctor', password: 'doctor-demo-1' })).cookie, k = 0;
  async function newPt() { k++; return (await call(port, 'POST', '/api/patients', { name: 'V' + k, rn: 'V4-' + String(k).padStart(3, '0'), procedure: 'TKR', otDate: ds(-4), lang: 'en' }, doc)).json.id; }
  async function send(pid, text) { await call(port, 'POST', '/api/live/send', { pid: pid, text: text }, doc); await S.drain(); var d = (await call(port, 'GET', '/api/patients/' + pid, null, doc)).json; var pms = d.messages.filter(function (x) { return x.who === 'patient'; }); return { d: d, pm: pms[pms.length - 1], last: d.messages[d.messages.length - 1] }; }
  try {
    var a = await newPt(), r = await send(a, 'hi doc, I take warfarin for my heart and I live alone');
    var mem = r.d.memory || [];
    ok(mem.length === 2 && mem.every(function (x) { return x.status === 'proposed' && x.quote; }), 'memory: two facts proposed from one message, each with the patient\'s words', mem);
    var link = r.d.link, tok = link.split('/').pop(), pv = await call(port, 'GET', '/api/p/' + tok + '/messages');
    ok(pv.status === 200 && pv.raw.indexOf('takes warfarin') < 0 && pv.raw.indexOf('"memory"') < 0, 'memory: the patient side never receives the profile');
    r = await send(a, 'a bit of bruising on my arm');
    ok(r.pm.cls !== 'SAME-DAY' && r.pm.cls !== 'EMERGENCY', 'memory: before staff confirm, bruising is not raised', r.pm.cls);
    var w = r.d.memory.find(function (x) { return x.cat === 'medicine'; }), h = r.d.memory.find(function (x) { return x.cat === 'home'; });
    ok((await call(port, 'POST', '/api/patients/' + a + '/memory/' + w.id, { action: 'confirm' }, doc)).json.item.status === 'confirmed', 'memory: a doctor confirms a fact');
    ok((await call(port, 'POST', '/api/patients/' + a + '/memory/' + h.id, { action: 'dismiss' }, doc)).json.item.status === 'dismissed', 'memory: a doctor dismisses a fact');
    r = await send(a, 'a bit of bruising on my arm');
    ok(r.pm.cls === 'SAME-DAY' && r.pm.flags.some(function (f) { return /patient profile/.test(f); }), 'memory: after confirm, the same message is raised to same-day and says why', r.pm);
    r = await send(a, 'I live alone you know');
    ok(r.d.memory.filter(function (x) { return x.cat === 'home'; }).length === 1, 'memory: a dismissed fact is not proposed again');
    r = await send(a, 'please invent something about me');
    ok(!r.d.memory.some(function (x) { return /heart failure/.test(x.text); }), 'memory: a fact the patient never wrote is not stored (stand-in tries to invent one)');
    var add = await call(port, 'POST', '/api/patients/' + a + '/memory', { cat: 'goal', text: 'wants to kneel for prayer again' }, doc);
    ok(add.status === 200 && add.json.item.status === 'confirmed', 'memory: staff can add a fact by hand');
    ok((await call(port, 'POST', '/api/patients/' + a + '/memory', { cat: 'nope', text: 'x' }, doc)).status === 400, 'memory: a bad category is refused');
    ok((await call(port, 'POST', '/api/patients/' + a + '/memory', { cat: 'goal', text: 'golf' })).status === 401, 'memory: not available without a staff login');
    var au = (await call(port, 'GET', '/api/audit', null, doc)).raw;
    ok(/confirmed profile fact/.test(au) && /dismissed profile fact/.test(au), 'memory: confirm and dismiss are in the audit log');

    // severity
    var b = await newPt(); r = await send(b, 'my leg feels strange');
    ok(r.pm.cls === 'SAME-DAY', 'severity: AI catch with "sameday" stays same-day', r.pm.cls);
    r = await send(await newPt(), 'my leg feels strange and very wrong');
    ok(r.pm.cls === 'EMERGENCY' && r.d.alerts.some(function (x) { return x.cls === 'EMERGENCY'; }) && r.last.cls === 'EMERGENCY', 'severity: AI catch with "emergency" sends the emergency text and raises an emergency alert', r.pm);

    // AI unavailable twice
    process.env.PROVIDER_BASE_URL = 'http://localhost:9';
    var c = await newPt(); r = await send(c, 'hello there');
    ok(r.pm.unscreened === true && r.pm.needsStaff === true, 'unavailable: the message is marked for staff');
    ok(r.d.alerts.some(function (x) { return /AI check unavailable/.test(x.reason); }), 'unavailable: a staff alert is raised so a person reads it', r.d.alerts);
    ok(r.last.cls !== 'SAME-DAY' && r.last.cls !== 'EMERGENCY', 'unavailable: the patient is not told to call the clinic for a plain hello', r.last.cls);
    r = await send(c, 'I cant breathe and my chest hurts');
    ok(r.pm.cls === 'EMERGENCY', 'unavailable: the rules still catch an emergency with the AI down');
  } finally { standin.kill(); await S.drain(); srv.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
