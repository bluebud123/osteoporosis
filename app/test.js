'use strict';
/* End-to-end checks for PeriLoop Console. Starts the server on a temp data dir and a stand-in model, then plays patient, nurse and doctor.
 * Run: node app/test.js   (no network, no key needed) */
var http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-'));
process.env.PERILOOP_DATA = dir;
var pass = 0, fail = 0;
function ok(c, label, extra) { if (c) { pass++; console.log('PASS', label); } else { fail++; console.log('FAIL', label, extra === undefined ? '' : JSON.stringify(extra)); } }

// stand-in model: second check says urgent for "strange/tight/numb"; replies are friendly, except when told BAD
var mock = http.createServer(function (q, r) { var b = ''; q.on('data', function (c) { b += c; }); q.on('end', function () {
  var j = JSON.parse(b), sys = j.messages[0].content, last = j.messages[j.messages.length - 1].content, c;
  if (/triage second-check/.test(sys)) c = JSON.stringify({ verdict: /strange|tight|numb/i.test(last) ? 'urgent' : 'routine', reason: 'possible limb concern' });
  else if (/only a clinician can answer/.test(sys)) c = 'Thanks for asking. When did this start?';
  else if (/staff-only profile/.test(sys)) c = 'Summary: asks routine questions.\nCommunication: brief.\nApproach: be clear.';
  else if (/ONE suggested reply/.test(sys)) c = 'Hello, thank you for your message. Dr will review and call you.';
  else if (/BADREPLY/.test(last)) c = "That is completely normal, don't worry.";
  else c = 'Hello! I can pass a message to your care team or share ward information, like showering or follow-up. What would you like to ask?';
  r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify({ choices: [{ message: { content: c } }] })); }); });

function call(port, method, p, body, cookie) {
  return new Promise(function (resolve) {
    var data = body ? JSON.stringify(body) : null;
    var req = http.request({ port: port, path: p, method: method, headers: Object.assign({ 'content-type': 'application/json', 'x-requested-with': 'periloop' }, cookie ? { cookie: cookie } : {}) }, function (res) {
      var ch = []; res.on('data', function (c) { ch.push(c); }); res.on('end', function () { var t = Buffer.concat(ch).toString(); var j; try { j = JSON.parse(t); } catch (e) { j = t; } resolve({ status: res.statusCode, json: j, cookie: (res.headers['set-cookie'] || [''])[0].split(';')[0] }); });
    });
    if (data) req.write(data); req.end();
  });
}

mock.listen(9199, async function () {
  process.env.PROVIDER_BASE_URL = 'http://localhost:9199'; process.env.PROVIDER_KEY = 'x'; process.env.PROVIDER_MODEL = 'm';
  delete require.cache[require.resolve('./server.js')];
  var S = require('./server.js'), srv = S.createServer();
  await new Promise(function (r) { srv.listen(0, r); });
  var port = srv.address().port, G = function (p, c) { return call(port, 'GET', p, null, c); }, P = function (p, b, c) { return call(port, 'POST', p, b, c); };

  // ---- login and roles ----
  ok((await G('/api/me')).status === 401, 'no login: staff API refused');
  ok((await P('/api/login', { username: 'doctor', password: 'wrong' })).status === 401, 'wrong password refused');
  ok((await call(port, 'POST', '/api/login', { username: 'doctor', password: 'doctor-demo-1' }, null).then(function (r) { return r.status; })) === 200, 'doctor login works');
  var doc = (await P('/api/login', { username: 'doctor', password: 'doctor-demo-1' })).cookie;
  var nur = (await P('/api/login', { username: 'nurse', password: 'nurse-demo-1' })).cookie;
  ok(!!doc && !!nur, 'sessions issued');
  var noHdr = await new Promise(function (r) { var q = http.request({ port: port, path: '/api/logout', method: 'POST', headers: { cookie: doc, 'content-type': 'application/json' } }, function (res) { r(res.statusCode); }); q.end('{}'); });
  ok(noHdr === 403, 'POST without the anti-forgery header refused');

  // ---- add patient (nurse) ----
  var add = await P('/api/patients', { name: 'Aisha M.', rn: 'TEST001', procedure: 'TKR', otDate: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10), lang: 'en' }, nur);
  ok(add.status === 200, 'nurse adds a patient', add.json);
  ok((await P('/api/patients', { name: 'Aisha Binti Mohd Long Name', rn: 'TEST002', procedure: 'TKR', otDate: '2026-12-01', lang: 'en' }, nur)).status === 400, 'long full name refused (short name only)');
  ok((await P('/api/patients', { name: 'Dup', rn: 'test001', procedure: 'TKR', otDate: '2026-12-01', lang: 'en' }, nur)).status === 400, 'duplicate record number refused');
  var pid = add.json.id, d = (await G('/api/patients/' + pid, nur)).json, tok = d.link.split('/')[2];
  ok(d.tasks.length >= 14, 'checklist created from pathway (' + d.tasks.length + ' tasks)');
  ok(d.tasks.every(function (t) { return t.dueAt > 0; }), 'every task has an owner and due time');

  // ---- patient plays ----
  async function say(t) { await P('/api/p/' + tok + '/message', { text: t }); var m = (await G('/api/p/' + tok + '/messages')).json.messages; return m[m.length - 1]; }
  var r1 = await say('hello'); ok(r1.who === 'ai' && /care team/.test(r1.text), 'hello -> AI-written friendly reply', r1);
  var r2 = await say('can I stop my blood thinner?'); ok(r2.who === 'ai' && /\?/.test(r2.text) && /clinician will answer/.test(r2.text) && !/normal|safe|stop taking/i.test(r2.text), 'clinical question -> AI asks ONE clarifying question, gives no advice, hands to a clinician', r2);
  var r3 = await say('I have chest pain and cannot breathe'); ok(r3.who === 'bot' && /999/.test(r3.text) && !/notified|alerted|get back/.test(r3.text), 'emergency -> 999 template, no promise of a reply', r3);
  var r4 = await say('my leg feels strange and tight since this morning'); ok(r4.who === 'bot' && /call the clinic today/.test(r4.text), 'AI second check raises to same-day (fixed text)', r4);
  var r5 = await say('when can I shower?'); ok(r5.who === 'ai' || r5.who === 'bot', 'unknown question before any approved answer -> never a made-up answer', r5);
  ok((await P('/api/rules/faq', { keywords: 'shower, mandi', answer: 'You may shower from day 2 if the dressing stays dry.' }, nur)).status === 403, 'nurse cannot add an approved answer');
  ok((await P('/api/rules/faq', { keywords: 'shower, mandi', answer: 'You may shower from day 2 if the dressing stays dry.' }, doc)).status === 200, 'doctor adds an approved answer');
  var r5b = await say('when can I shower?'); ok(r5b.who === 'bot' && r5b.faq === true && /day 2/.test(r5b.text), 'approved answer is shown exactly, labelled as clinic-approved', r5b);
  var r5c = await say('can I shower and stop my blood thinner?'); ok(!r5c.faq, 'clinical question is not answered by an approved answer', r5c);
  var r6 = await say('thank you'); ok(r6.who === 'bot' && /noted/i.test(r6.text), 'thanks -> acknowledgement');
  var r7 = await say('my number is 0123456789 call me'); var raw = (await G('/api/patients/' + pid, nur)).json.messages.filter(function (m) { return m.who === 'patient'; }).pop();
  ok(/\[phone\]/.test(raw.text) && !/0123456789/.test(raw.text), 'phone number masked before storing', raw.text);
  var al = (await G('/api/alerts', nur)).json;
  ok(al.some(function (a) { return a.cls === 'EMERGENCY'; }) && al.some(function (a) { return a.cls === 'SAME-DAY'; }), 'emergency and same-day alerts raised');
  var before = (await G('/api/alerts', nur)).json.length; await say('I have chest pain and cannot breathe'); await say('I have chest pain and cannot breathe');
  ok((await G('/api/alerts', nur)).json.length === before, 'repeat messages merge into one alert (count)');
  ok((await P('/api/p/' + 'x'.repeat(24) + '/message', { text: 'hi' })).status === 404, 'unknown patient link refused');
  var inbox = (await G('/api/inbox', nur)).json; ok(inbox.length === 1 && inbox[0].cls === 'EMERGENCY', 'inbox shows the patient, worst first', inbox);

  // ---- staff replies, thread ----
  var rep = await P('/api/patients/' + pid + '/reply', { text: 'Please come in tomorrow morning.' }, nur);
  var after = (await G('/api/p/' + tok + '/messages')).json.messages.pop();
  ok(rep.status === 200 && after.who === 'staff' && after.staffName === 'Nurse Demo' && after.staffRole === 'Nurse', 'staff reply reaches patient with name and role', after);
  var q1 = await say('ok thanks, what time?'); ok(q1.who === 'patient', 'assistant stays quiet while a person handles the thread');
  var q2 = await say('chest pain now'); ok(q2.who === 'bot' && /999/.test(q2.text), 'emergency still answered while a person handles the thread');
  await P('/api/patients/' + pid + '/handback', {}, nur);
  ok((await G('/api/inbox', nur)).json.length === 1, 'new urgent message after staff reply is back in the inbox');

  // ---- alerts ack ----
  var open1 = (await G('/api/alerts', nur)).json.filter(function (a) { return !a.ackAt; })[0];
  await P('/api/alerts/' + open1.id + '/ack', {}, nur);
  var acked = (await G('/api/alerts', nur)).json.find(function (a) { return a.id === open1.id; });
  ok(acked.ackBy === 'Nurse Demo' && acked.ackAt, 'acknowledge records who and when');

  // ---- tasks closed only with evidence; doctor-only decisions ----
  d = (await G('/api/patients/' + pid, nur)).json;
  var plain = d.tasks.find(function (t) { return !t.doctorOnly; }), docT = d.tasks.find(function (t) { return t.doctorOnly; });
  ok((await P('/api/patients/' + pid + '/tasks/' + plain.id + '/done', { evidence: '' }, nur)).status === 400, 'cannot close a task without evidence');
  ok((await P('/api/patients/' + pid + '/tasks/' + docT.id + '/done', { evidence: 'agreed plan' }, nur)).status === 403, 'nurse cannot close a doctor decision');
  ok((await P('/api/patients/' + pid + '/tasks/' + plain.id + '/done', { evidence: 'Hb 12.1 reviewed' }, nur)).status === 200, 'nurse closes a task with evidence');
  ok((await P('/api/patients/' + pid + '/tasks/' + docT.id + '/done', { evidence: 'Plan agreed with patient' }, doc)).status === 200, 'doctor closes the doctor decision');

  // ---- rules ----
  ok((await P('/api/rules/redflag', { phrase: 'kaki pelik', cls: 'EMERGENCY' }, nur)).status === 403, 'nurse cannot add rules');
  ok((await P('/api/rules/redflag', { phrase: 'kaki pelik', cls: 'SAME-DAY' }, doc)).status === 200, 'doctor adds a red-flag phrase');
  var r8 = await say('kaki pelik sikit'); ok(r8.who === 'bot' && /call the clinic today/.test(r8.text), 'new phrase raises a patient message to same-day', r8);
  var rules = (await G('/api/rules', doc)).json; rules.pathway.shared.push({ title: 'Clinic custom: confirm transport home', owner: 'clinic_coordinator', due: -3, kind: 'admin' });
  ok((await P('/api/rules/pathway', { pathway: rules.pathway }, doc)).status === 200, 'doctor adds a checklist rule');
  var add2 = await P('/api/patients', { name: 'Raju K.', rn: 'TEST003', procedure: 'THR', otDate: '2027-01-15', lang: 'en' }, doc);
  var d2 = (await G('/api/patients/' + add2.json.id, doc)).json; ok(d2.tasks.some(function (t) { return /confirm transport/.test(t.title); }), 'new patient gets the new rule');
  var ap = await P('/api/rules/apply', { pid: pid }, doc); ok(ap.json.added === 1, 'doctor adds missing item to an existing patient', ap.json);
  ok((await P('/api/rules/pathway', { pathway: rules.pathway }, nur)).status === 403, 'nurse cannot edit the pathway');

  // ---- AI output guard in the live pipeline ----
  var r9 = await say('BADREPLY hello'); ok(r9.who === 'bot' || r9.who === 'patient', 'unsafe model reply is never shown', r9);
  var allAi = (await G('/api/patients/' + pid, doc)).json.messages.filter(function (m) { return m.who === 'ai'; });
  ok(allAi.every(function (m) { return !/normal|don't worry/i.test(m.text); }), 'no AI message contains reassurance');


  // ---- demo cases, library, trace ----
  var allPts = (await G('/api/patients', doc)).json;
  ok(allPts.filter(function (x) { return x.demo; }).length === 30, 'the 30 fictional demo cases are loaded on first run', allPts.length);
  ok(allPts.some(function (x) { return x.demo && x.overdue > 0; }) && allPts.some(function (x) { return x.demo && x.overdue === 0; }), 'demo cases are spread across the journey (some overdue, some not)');
  ok((await P('/api/demo/load', {}, doc)).json.added === 0, 'loading demo cases twice adds nothing');
  ok((await P('/api/demo/load', {}, nur)).status === 403, 'nurse cannot reload demo cases');
  var libr = (await G('/api/library', doc)).json; ok(libr.length === 360 && libr.some(function (x) { return x.lang === 'ar'; }) && libr.some(function (x) { return x.truth === 'urgent'; }), 'test-message library has 360 messages (en, ms, zh, ar)', libr.length);
  var demoP = allPts.find(function (x) { return x.demo; });
  await P('/api/live/send', { pid: demoP.id, text: 'my leg feels strange and tight since this morning', libId: 'T1' }, doc);
  var tr = (await G('/api/trace?pid=' + demoP.id, doc)).json;
  ok(tr.length === 1 && tr[0].trace.length === 8 && tr[0].trace.map(function (s) { return s.n; }).join('') === '12345678', 'trace has all 8 steps in order (step 8 = profile update)', tr[0] && tr[0].trace.length);
  ok(tr[0].trace[3].status === 'raise' && /URGENT/.test(tr[0].trace[3].detail), 'trace shows the AI second check raising to same-day');
  ok(/replayed by/.test(tr[0].via), 'library replays are marked as replays');
  await P('/api/live/send', { pid: demoP.id, text: 'hello', libId: 'T2' }, doc);
  var tr2 = (await G('/api/trace?pid=' + demoP.id, doc)).json; ok(tr2[0].trace[5].status === 'pass' && /AI-written reply/.test(tr2[0].trace[5].detail + tr2[0].trace[5].title) , 'trace shows the AI reply accepted by the guard', tr2[0].trace[5]);
  await P('/api/live/send', { pid: demoP.id, text: 'BADREPLY hello' }, doc);
  var tr3 = (await G('/api/trace?pid=' + demoP.id, doc)).json; ok(/typed in Live view/.test(tr3[0].via), 'messages typed in the Live view are marked as such'); ok(/BLOCKED/.test(tr3[0].trace[5].detail) && tr3[0].trace[5].status === 'warn', 'trace shows the guard BLOCKING an unsafe model reply', tr3[0].trace[5]);
  var det = (await G('/api/patients/' + demoP.id, doc)).json; ok(det.intake && typeof det.intake === 'object', 'demo patient has intake answers');
  ok((await G('/live')).status === 200, 'live page is served');


  // ---- interactive answers, cardiac rule, parameters, brief, profile ----
  var r6 = await say('what should I prepare before my operation?'); ok(r6.who === 'bot' && /clinic record/.test(r6.text) && /\n- /.test(r6.text), 'prepare question -> answered from the clinic record (checklist)', r6);
  var r7 = await say('when is my surgery?'); ok(r7.who === 'bot' && /clinic record/.test(r7.text) && /operation is on/.test(r7.text), 'operation date -> from the record', r7);
  var r8 = await say('since last night got a tight feeling in chest and my left arm tingly'); ok(r8.who === 'bot' && /999/.test(r8.text), 'chest tightness + left-arm tingling -> EMERGENCY (999), not just same-day', r8);
  var all = (await G('/api/patients', doc)).json, t2 = all.find(function (x) { return x.rn === 'FIC-TKR-02'; }), t4 = all.find(function (x) { return x.rn === 'FIC-TKR-04'; }), t5 = all.find(function (x) { return x.rn === 'FIC-TKR-05'; });
  ok(t2 && t2.como.some(function (c) { return /blood thinner/i.test(c); }) && t2.como.some(function (c) { return /Diabetes/.test(c); }), 'TKR-02 shows its own comorbidities (blood thinner, diabetes)', t2 && t2.como);
  var d2b = (await G('/api/patients/' + t2.id, doc)).json;
  ok(d2b.readings.length >= 8 && d2b.detections.filter(function (x) { return x.level === 'amber'; }).length >= 5, 'TKR-02 pre-op bloods auto-detected several amber flags', d2b.detections.length);
  ok(d2b.detections.every(function (x) { return x.actions.length && x.steps && x.steps.length === 4; }), 'each detection records what was done and the 4 evaluation steps');
  ok(d2b.tasks.some(function (x) { return x.auto && /Auto-detected/.test(x.title); }), 'detections created tasks for the right owner');
  var d5 = (await G('/api/patients/' + t5.id, doc)).json; ok(d5.detections.some(function (x) { return x.level === 'red' && x.param === 'calf_diff'; }) && d5.alerts.some(function (a) { return a.auto; }), 'TKR-05 calf swelling -> red detection AND an alert');
  var d4 = (await G('/api/patients/' + t4.id, doc)).json; ok(d4.detections.some(function (x) { return x.param === 'temp' && x.level === 'red'; }) && !d4.detections.some(function (x) { return x.param === 'temp' && x.level === 'amber' && x.state === 'open'; }), 'TKR-04 fever escalated to red; the earlier amber is not left open');
  ok((await P('/api/patients/' + pid + '/readings', { param: 'hb', value: 'abc' }, nur)).status === 400, 'non-numeric reading refused');
  var rd1 = await P('/api/patients/' + pid + '/readings', { param: 'hb', value: 9.4 }, nur); ok(rd1.status === 200 && rd1.json.detections.length === 1 && rd1.json.detections[0].level === 'red', 'nurse enters Hb 9.4 -> red detection created', rd1.json);
  var rd2 = await P('/api/patients/' + pid + '/readings', { param: 'hb', value: 13.1 }, nur); var d6 = (await G('/api/patients/' + pid, nur)).json;
  ok(rd2.status === 200 && d6.detections.find(function (x) { return x.param === 'hb'; }).state === 'cleared', 'a normal repeat reading clears the flag');
  var rd3 = await P('/api/patients/' + pid + '/readings', { param: 'temp', value: 39 }, nur); ok(rd3.json.detections.length === 0, 'temperature rules do not fire before surgery (phase aware)', rd3.json.hits);
  var br = (await G('/api/patients/' + t2.id, doc)).json.brief; ok(br.pending.length > 0 && /blood thinner/i.test(br.facts) && /^Hello/.test(br.draft) && br.flags.length > 3, 'doctor brief lists pending items, comorbidities, flags and a draft');
  var dr = await P('/api/patients/' + t2.id + '/draft', {}, doc); ok(dr.json.ai && dr.json.rules, 'AI suggested reply for the doctor (plus rules fallback)', dr.json);
  await S.drain(); var d7 = (await G('/api/patients/' + pid, nur)).json; ok(d7.profile && d7.profile.det.messages >= 5 && /Summary/.test(d7.profile.summary || ''), 'patient profile built after chats (facts + AI summary)', d7.profile);
  var act = (await G('/api/ai/activity', doc)).json; ok(act.log.some(function (e) { return e.kind === 'patient profile'; }) && act.log.some(function (e) { return e.kind === 'suggested reply'; }), 'AI activity log records profile and draft calls');
  ok((await P('/api/demo/reset', {}, nur)).status === 403, 'only a doctor can reset demo data');
  var rs = await P('/api/demo/reset', {}, doc); ok(rs.json.added === 30, 'doctor resets demo data -> 30 cases back', rs.json);


  // ---- calendar, capacity alert, reply options ----
  t2 = (await G('/api/patients', doc)).json.find(function (x) { return x.rn === 'FIC-TKR-02'; });
  var cal0 = (await G('/api/calendar', doc)).json; ok(cal0.max === 5 && cal0.over.some(function (o) { return o.count === 6; }), 'demo data has a day with 6 operations -> flagged over the limit of 5', cal0.over);
  var calD = (await G('/api/calendar?from=' + t2.otDate + '&to=' + t2.otDate, doc)).json; ok(calD.days.length === 1 && calD.days[0].ops.some(function (o) { return o.rn === 'FIC-TKR-02'; }), 'calendar lists a patient on the operation date');
  ok(cal0.days.some(function (d) { return d.bloods.length > 0; }), 'calendar shows blood-test tasks on their due dates');
  ok((await P('/api/settings', { maxCasesPerDay: 0 }, doc)).status === 400, 'cases-per-day limit must be 1 to 50');
  ok((await P('/api/settings', { maxCasesPerDay: 8 }, nur)).status === 403, 'nurse cannot change the limit');
  ok((await P('/api/settings', { maxCasesPerDay: 8 }, doc)).status === 200 && (await G('/api/calendar', doc)).json.over.length === 0, 'raising the limit to 8 clears the alert');
  await P('/api/settings', { maxCasesPerDay: 5 }, doc);
  var sm = (await G('/api/summary', doc)).json; ok(sm.overCapacity >= 1, 'summary counts over-capacity days (nav badge)', sm.overCapacity);
  var dd = await P('/api/patients/' + t2.id + '/draft', {}, doc); var lab = (dd.json.options || []).map(function (o) { return o.label; });
  ok(lab.length >= 3 && dd.json.options.some(function (o) { return /blood thinner/.test(o.text) && /rivaroxaban/.test(o.text); }) && dd.json.options.some(function (o) { return /sugar control/.test(o.text); }), 'reply options use the patient comorbidities (blood thinner, diabetes)', lab);
  ok(dd.json.options.every(function (o) { return !/stop taking|you can stop|it is normal|do not worry/i.test(o.text); }), 'no option tells the patient to stop a medicine or reassures about symptoms');

  // ---- persistence ----
  srv.close(); delete require.cache[require.resolve('./server.js')]; delete require.cache[require.resolve('./store.js')];
  var S2 = require('./server.js'), srv2 = S2.createServer(); await new Promise(function (r) { srv2.listen(0, r); });
  var port2 = srv2.address().port, c2 = (await call(port2, 'POST', '/api/login', { username: 'doctor', password: 'doctor-demo-1' })).cookie;
  var pts = (await call(port2, 'GET', '/api/patients', null, c2)).json; ok(pts.length === 32, 'data survives a restart (30 demo + 2 added)', pts.length);
  ok((await call(port2, 'GET', '/healthz')).status === 200, 'health check');
  srv2.close(); mock.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
});
