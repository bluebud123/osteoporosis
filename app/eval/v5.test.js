'use strict';
/* v5 (stage 1) checks: signals from staff corrections, AI-proposed lessons that a doctor approves, the topic index, and
 * the system report. Uses app/eval/standin_model.js (canned answers): this tests the plumbing, NOT any real model.
 *   node app/eval/v5.test.js */
var http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
process.env.PERILOOP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'v5-')); process.env.PERILOOP_NO_SEED = '1';
process.env.PROVIDER_BASE_URL = 'http://localhost:9777'; process.env.PROVIDER_KEY = 'x'; process.env.PROVIDER_MODEL = 'standin';
var L = require('../learning.js'), T = require('../triage.js');
var pass = 0, fail = 0; function ok(c, name, extra) { if (c) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); } }
function call(port, method, p, body, cookie) { return new Promise(function (res) { var d = body ? JSON.stringify(body) : null; var q = http.request({ port: port, path: p, method: method, headers: Object.assign({ 'content-type': 'application/json', 'x-requested-with': 'periloop' }, cookie ? { cookie: cookie } : {}) }, function (r) { var c = []; r.on('data', function (x) { c.push(x); }); r.on('end', function () { var t = Buffer.concat(c).toString(), j; try { j = JSON.parse(t); } catch (e) { j = t; } res({ status: r.statusCode, json: j, raw: t, cookie: (r.headers['set-cookie'] || [''])[0].split(';')[0] }); }); }); if (d) q.write(d); q.end(); }); }
function ds(off) { var d = new Date(Date.now() + off * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

(async function () {
  // ---- unit: what a lesson may say, and the index ----
  ok(L.lessonOk('Offer the physiotherapy phone line when a patient asks about exercises.'), 'lesson: a wording lesson is allowed');
  ok(!L.lessonOk('Tell patients to take 2 tablets of paracetamol 500 mg.') && !L.lessonOk('Tell the patient to stop taking warfarin before the visit.') && !L.lessonOk('Say that swelling is normal after the operation.'), 'lesson: a dose, a medicine instruction or "it is normal" is refused');
  var db = { lessons: [
    { id: 'a', text: 'tone lesson', tags: ['tone'], status: 'approved', approvedAt: 1 },
    { id: 'b', text: 'wound lesson', tags: ['wound'], status: 'approved', approvedAt: 2 },
    { id: 'c', text: 'driving lesson', tags: ['travel'], status: 'approved', approvedAt: 3 },
    { id: 'd', text: 'proposed wound lesson', tags: ['wound'], status: 'proposed', approvedAt: 4 },
    { id: 'e', text: 'triage observation', tags: ['triage'], status: 'approved', approvedAt: 5 },
    { id: 'f', text: 'profile lesson', tags: ['profile'], status: 'approved', approvedAt: 6 }] };
  var got = L.retrieve(db, 'my wound dressing is wet', 5).map(function (l) { return l.id; });
  ok(got.join() === 'b,a', 'index: a wound message gets the wound lesson first, then tone; not driving, not proposed, not triage, not profile', got);
  ok(L.retrieve(db, 'when can i drive', 5)[0].id === 'c' && L.forProfile(db)[0].id === 'f', 'index: a driving message gets the driving lesson; profile lessons go to the profile step only');
  for (var i = 0; i < 300; i++) db.lessons.push({ id: 'x' + i, text: 'extra ' + i, tags: [i % 2 ? 'wound' : 'travel'], status: 'approved', approvedAt: 10 + i });
  ok(L.retrieve(db, 'my wound dressing is wet', 5).length === 5, 'index: with 300 lessons the AI still gets at most five');
  var used = [{ id: 's1', type: 'draft_edit', text: 'q' }, { id: 's2', type: 'alert_not_urgent', text: 'can i shower' }];
  var pr = L.parseProposals('[{"lesson":"Use the patient\'s first name at the start of every reply.","tags":["tone"],"basedOn":[1]},{"lesson":"Doctors here marked showering questions as not urgent.","tags":["washing"],"basedOn":[2]},{"lesson":"Cites nothing real at all, should be dropped.","tags":["tone"],"basedOn":[7]}]', used);
  ok(pr.length === 2 && pr[0].basedOn[0] === 's1' && pr[1].tags.join() === 'triage', 'proposals: kept only when based on a real correction; an alert pattern becomes a triage observation', pr);

  // ---- through the server ----
  var standin = cp.spawn(process.execPath, [path.join(__dirname, 'standin_model.js')], { stdio: 'ignore' }); await new Promise(function (r) { setTimeout(r, 700); });
  var S = require('../server.js'), srv = S.createServer(); await new Promise(function (r) { srv.listen(0, r); }); var port = srv.address().port;
  var doc = (await call(port, 'POST', '/api/login', { username: 'doctor', password: 'doctor-demo-1' })).cookie, nurse = (await call(port, 'POST', '/api/login', { username: 'nurse', password: 'nurse-demo-1' })).cookie;
  try {
    var pid = (await call(port, 'POST', '/api/patients', { name: 'Learn One', rn: 'V5-001', procedure: 'TKR', otDate: ds(-4), lang: 'en' }, doc)).json.id;
    async function send(text) { await call(port, 'POST', '/api/live/send', { pid: pid, text: text }, doc); await S.drain(); return (await call(port, 'GET', '/api/patients/' + pid, null, doc)).json; }
    var before = JSON.stringify(['fever 38.9', 'can i shower?', 'ok thanks', 'calf pain'].map(function (t) { return T.classify(t, {}).cls; }));
    var d = await send('is it ok to use a heating pad on my back?');
    var lg = (await call(port, 'GET', '/api/learning', null, doc)).json;
    ok(lg.report.unansweredQuestions === 1 && lg.signals[0].type === 'unanswered', 'signal: a question with no clinic answer is recorded', lg.report);
    // draft, then send it rewritten
    var dr = (await call(port, 'POST', '/api/patients/' + pid + '/draft', {}, doc)).json;
    ok(dr.ai && dr.lessonsUsed.length === 0 && dr.ai.indexOf('[lessons seen') < 0, 'draft: with no approved lessons nothing extra is sent to the AI');
    await call(port, 'POST', '/api/patients/' + pid + '/reply', { text: 'Hello Mr One, try a pillow between your knees. The physio will show you on Thursday.', draftText: dr.ai, draftLabel: 'AI draft' }, doc);
    await call(port, 'POST', '/api/patients/' + pid + '/reply', { text: dr.ai, draftText: dr.ai, draftLabel: 'AI draft' }, doc);
    lg = (await call(port, 'GET', '/api/learning', null, doc)).json;
    ok(lg.report.draftsRewritten === 1 && lg.report.draftsSentUnchanged === 1, 'signal: a rewritten AI draft is recorded; an unchanged one is only counted', lg.report);
    // alert marked not urgent, message marked should-have-alerted
    d = await send('I have a fever, is that normal?'); var al = d.alerts[d.alerts.length - 1];
    ok((await call(port, 'POST', '/api/alerts/' + al.id + '/feedback', { verdict: 'not_urgent' }, nurse)).status === 403, 'signal: only a doctor can mark an alert as not urgent');
    await call(port, 'POST', '/api/alerts/' + al.id + '/feedback', { verdict: 'not_urgent' }, doc);
    d = await send('feeling a bit off today'); var pm = d.messages.filter(function (x) { return x.who === 'patient'; }).pop();
    await call(port, 'POST', '/api/messages/' + pm.id + '/feedback', { verdict: 'should_alert' }, doc);
    lg = (await call(port, 'GET', '/api/learning', null, doc)).json;
    ok(lg.report.alertsMarkedNotUrgent === 1 && lg.report.messagesThatShouldHaveAlerted === 1, 'signal: both kinds of triage correction are recorded', lg.report);
    ok(JSON.stringify(['fever 38.9', 'can i shower?', 'ok thanks', 'calf pain'].map(function (t) { return T.classify(t, {}).cls; })) === before && (await send('I have a fever, is that normal?')).alerts.length >= 2, 'triage: marking an alert "not urgent" changes nothing; the same message alerts again');
    // AI proposes; strict filter
    ok((await call(port, 'POST', '/api/lessons/suggest', {}, nurse)).status === 403, 'lessons: a nurse cannot ask for proposals');
    var sg = (await call(port, 'POST', '/api/lessons/suggest', {}, doc)).json;
    lg = (await call(port, 'GET', '/api/learning', null, doc)).json;
    ok(sg.proposed === 1 && lg.lessons.length === 1 && lg.lessons[0].status === 'proposed' && lg.report.newSignals === 0, 'lessons: of five stand-in proposals only the one allowed lesson is kept (dose, "normal", fake source and unknown tag are dropped)', { sg: sg, n: lg.lessons.length });
    dr = (await call(port, 'POST', '/api/patients/' + pid + '/draft', {}, doc)).json;
    ok(dr.lessonsUsed.length === 0, 'lessons: a proposed lesson is not used until a doctor approves it');
    var lid = lg.lessons[0].id;
    ok((await call(port, 'POST', '/api/lessons/' + lid, { action: 'approve' }, nurse)).status === 403, 'lessons: a nurse cannot approve');
    ok((await call(port, 'POST', '/api/lessons/' + lid, { action: 'approve', text: 'Tell them it is normal and safe.' }, doc)).status === 400, 'lessons: a doctor cannot edit a lesson into reassurance or advice');
    var ap = (await call(port, 'POST', '/api/lessons/' + lid, { action: 'approve', text: 'Open the reply with the patient\'s first name and one warm sentence.' }, doc)).json.lesson;
    ok(ap.status === 'approved' && ap.approvedBy && ap.history.length === 1, 'lessons: a doctor edits and approves; the earlier wording is kept in its history');
    dr = (await call(port, 'POST', '/api/patients/' + pid + '/draft', {}, doc)).json;
    ok(dr.lessonsUsed.length === 1 && /\[lessons seen: 1\]/.test(dr.ai), 'lessons: an approved lesson reaches the AI draft and the page says which lessons were used', dr.lessonsUsed);
    ok((await call(port, 'POST', '/api/lessons', { text: 'Give 2 tablets of tramadol 50 mg for pain.', tags: ['pain'] }, doc)).status === 400 && (await call(port, 'POST', '/api/lessons', { text: 'Mention the physiotherapy phone line when asked about exercises.', tags: ['mobility'] }, doc)).status === 200, 'lessons: a doctor can write one by hand, under the same limits');
    await call(port, 'POST', '/api/lessons/' + lid, { action: 'retire' }, doc);
    dr = (await call(port, 'POST', '/api/patients/' + pid + '/draft', {}, doc)).json;
    ok(dr.lessonsUsed.length === 0, 'lessons: a retired lesson is no longer used');
    var tok = (await call(port, 'GET', '/api/patients/' + pid, null, doc)).json.link.split('/').pop(), pv = await call(port, 'GET', '/api/p/' + tok + '/messages');
    ok(pv.raw.indexOf('first name and one warm') < 0 && (await call(port, 'GET', '/api/learning')).status === 401, 'lessons: nothing about lessons is visible from the patient side or without a login');
    var au = (await call(port, 'GET', '/api/audit', null, doc)).raw;
    ok(/approved lesson/.test(au) && /retired lesson/.test(au) && /propose lessons/.test(au), 'lessons: propose, approve and retire are in the audit log');
    ok((await call(port, 'GET', '/api/summary', null, doc)).json.lessonsToReview === 0, 'summary: the count of lessons waiting for review is reported');
  } finally { standin.kill(); await S.drain(); srv.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
