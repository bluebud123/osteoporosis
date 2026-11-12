'use strict';
/* v6 checks: the dose check for doctors (patient messages and staff replies), the chief-doctor permission, and lesson
 * tracking. The dose table is AI-drafted and awaiting sign-off: these tests check the reader and the plumbing, not that
 * the numbers in the table are right.   node app/eval/v6.test.js */
var http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
process.env.PERILOOP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'v6-')); process.env.PERILOOP_NO_SEED = '1';
process.env.PROVIDER_BASE_URL = 'http://localhost:9777'; process.env.PROVIDER_KEY = 'x'; process.env.PROVIDER_MODEL = 'standin';
var D = require('../doses.js');
var pass = 0, fail = 0; function ok(c, name, extra) { if (c) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); } }
function call(port, method, p, body, cookie) { return new Promise(function (res) { var d = body ? JSON.stringify(body) : null; var q = http.request({ port: port, path: p, method: method, headers: Object.assign({ 'content-type': 'application/json', 'x-requested-with': 'periloop' }, cookie ? { cookie: cookie } : {}) }, function (r) { var c = []; r.on('data', function (x) { c.push(x); }); r.on('end', function () { var t = Buffer.concat(c).toString(), j; try { j = JSON.parse(t); } catch (e) { j = t; } res({ status: r.statusCode, json: j, raw: t, cookie: (r.headers['set-cookie'] || [''])[0].split(';')[0] }); }); }); if (d) q.write(d); q.end(); }); }
function ds(off) { var d = new Date(Date.now() + off * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
var OVER = ['i took 8 panadol at once', 'i have been taking 3 tramadol every 4 hours', 'taking 1000mg paracetamol every 3 hours', 'i took 2 arcoxia 120 today', 'Take paracetamol 2 g every 6 hours', 'tramadol 150 mg tds', '10 panadol a day', 'clexane 80 mg injection daily', 'celebrex 400 mg twice a day', 'i took four panadol', 'panadol 3 tablets every 4 hours'];
var FINE = ['i take 2 panadol 4 times a day', 'taking 1 g paracetamol every 6 hours', 'arcoxia 90 once a day', 'Please take paracetamol 1 g four times a day', 'tramadol 100mg qid', 'i did not take 8 panadol', '8 panadol a day', 'i ran out of tramadol 3 days ago', 'my pain is 8 out of 10 even with panadol', 'took panadol at 8 pm', 'on day 3 panadol stopped working', 'i took two panadol', 'panadol 2 tablets every 6 hours', 'is it ok to take panadol with tramadol', 'pain 9/10 panadol does nothing', 'for 5 days panadol only', 'clexane 40mg once daily', 'rivaroxaban 10 mg once a day', 'apixaban 2.5 mg twice a day', 'thank you doctor'];

(async function () {
  var missO = OVER.filter(function (t) { return !D.check(t).length; }), falseF = FINE.filter(function (t) { return D.check(t).length; });
  ok(!missO.length, 'dose: ' + OVER.length + ' sentences above the table are all flagged', missO);
  ok(!falseF.length, 'dose: ' + FINE.length + ' ordinary sentences are not flagged', falseF);
  var n = 0, hits = []; ['h1', 'h2', 'h3', 'h4', 'h5'].forEach(function (h) { var X = require('./triage_' + h + '.js'); X.E.concat(X.S, X.N).forEach(function (c) { n++; if (D.check(c[1]).length) hits.push(c[1]); }); });
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', 'messages.json'), 'utf8')).forEach(function (m) { n++; if (D.check(m.text).length) hits.push(m.text); });
  ok(hits.length <= 2 && hits.every(function (t) { return /took 10 tramadol/.test(t); }), 'dose: over ' + n + ' test messages the only finding is a real overdose', hits);
  ok(/assuming 500 mg each/.test(D.check('i took four panadol')[0].text), 'dose: a finding says what tablet strength it assumed');

  var standin = cp.spawn(process.execPath, [path.join(__dirname, 'standin_model.js')], { stdio: 'ignore' }); await new Promise(function (r) { setTimeout(r, 700); });
  var S = require('../server.js'), srv = S.createServer(); await new Promise(function (r) { srv.listen(0, r); }); var port = srv.address().port;
  var doc = (await call(port, 'POST', '/api/login', { username: 'doctor', password: 'doctor-demo-1' })).cookie, nurse = (await call(port, 'POST', '/api/login', { username: 'nurse', password: 'nurse-demo-1' })).cookie;
  try {
    var pid = (await call(port, 'POST', '/api/patients', { name: 'Dose One', rn: 'V6-001', procedure: 'TKR', otDate: ds(-4), lang: 'en' }, doc)).json.id;
    async function send(text) { await call(port, 'POST', '/api/live/send', { pid: pid, text: text }, doc); await S.drain(); var d = (await call(port, 'GET', '/api/patients/' + pid, null, doc)).json; return { d: d, pm: d.messages.filter(function (x) { return x.who === 'patient'; }).pop(), last: d.messages[d.messages.length - 1] }; }
    // (a) patient reports a wrong dose
    var r = await send('i have been taking 3 tramadol every 4 hours');
    ok(r.pm.cls === 'SAME-DAY' && r.pm.dose && r.pm.dose.length === 1 && r.d.alerts.some(function (a) { return /wrong dose/i.test(a.reason); }), 'patient: a dose above the table raises a same-day alert for the doctor, with the numbers', r.pm);
    ok(!/\bmg\b|tramadol|dose/i.test(r.last.text), 'patient: the reply to the patient is the fixed text, with no dose or medicine in it', r.last.text);
    r = await send('i take 2 panadol 4 times a day');
    ok(r.pm.cls !== 'SAME-DAY' && r.pm.cls !== 'EMERGENCY' && !r.pm.dose, 'patient: a usual dose raises nothing');
    r = await send('i took 8 panadol at once');
    ok(r.pm.cls === 'EMERGENCY' && r.pm.dose.length === 1, 'patient: an overdose stays an emergency (the dose check never lowers) and the doctor sees the numbers');
    // (b) a staff reply with a wrong dose
    var bad = await call(port, 'POST', '/api/patients/' + pid + '/reply', { text: 'Please take paracetamol 2 g every 6 hours for the pain.' }, doc);
    var count0 = (await call(port, 'GET', '/api/patients/' + pid, null, doc)).json.messages.filter(function (x) { return x.who === 'staff'; }).length;
    ok(bad.status === 409 && bad.json.error === 'dose' && bad.json.findings.length === 1 && count0 === 0, 'reply: a reply with a dose above the table is held, not sent', bad.json);
    var good = await call(port, 'POST', '/api/patients/' + pid + '/reply', { text: 'Please take paracetamol 1 g every 6 hours for the pain.' }, nurse);
    ok(good.status === 200, 'reply: a usual dose is sent with no warning');
    var ack = await call(port, 'POST', '/api/patients/' + pid + '/reply', { text: 'Please take paracetamol 2 g every 6 hours for the pain.', doseAck: true }, doc);
    ok(ack.status === 200 && /after a dose warning/.test((await call(port, 'GET', '/api/audit', null, doc)).raw), 'reply: after the sender confirms, it is sent and the audit log records the warning');
    // chief
    var me = (await call(port, 'GET', '/api/me', null, doc)).json;
    ok(me.chief === true && (await call(port, 'GET', '/api/me', null, nurse)).json.chief === false, 'chief: the demo doctor is the chief; the nurse is not');
    var w = await call(port, 'POST', '/api/lessons', { text: 'Mention the physiotherapy phone line when asked about exercises.', tags: ['mobility'] }, doc);
    ok(w.status === 200, 'chief: the chief doctor can write a lesson');
    S.store.db.users.push(Object.assign({}, S.store.db.users[0], { username: 'doctor2', name: 'Dr Two', chief: false })); var s2 = require('crypto').randomBytes(8).toString('hex');
    var d2 = await call(port, 'POST', '/api/login', { username: 'doctor2', password: 'doctor-demo-1' });
    ok(d2.status === 200 && (await call(port, 'POST', '/api/lessons', { text: 'Another lesson about wording for the team to use.', tags: ['tone'] }, d2.cookie)).status === 403 && (await call(port, 'POST', '/api/lessons/' + w.json.lesson.id, { action: 'retire' }, d2.cookie)).status === 403 && (await call(port, 'POST', '/api/lessons/suggest', {}, d2.cookie)).status === 403, 'chief: an ordinary doctor cannot write, retire or request lessons');
    ok((await call(port, 'GET', '/api/learning', null, d2.cookie)).json.canDecide === false && (await call(port, 'GET', '/api/learning', null, doc)).json.canDecide === true, 'chief: the Learning page knows who may decide');
    // lesson tracking
    await send('how do i do my knee exercises on the stairs?');
    var dr = (await call(port, 'POST', '/api/patients/' + pid + '/draft', {}, doc)).json;
    await call(port, 'POST', '/api/patients/' + pid + '/reply', { text: 'Hello, please ring physiotherapy and they will go through the stairs with you.', draftText: dr.ai, draftLabel: 'AI draft' }, doc);
    var ls = (await call(port, 'GET', '/api/learning', null, doc)).json.lessons.find(function (l) { return l.id === w.json.lesson.id; });
    ok(dr.lessonsUsed.length === 1 && ls.uses === 1 && ls.rewritten === 1 && !ls.sentUnchanged, 'tracking: a lesson records that the draft it shaped was rewritten', ls);
  } finally { standin.kill(); await S.drain(); srv.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
