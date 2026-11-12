'use strict';
/* v7 checks: patient age and sex, and the rule-based suggestion for an over-booked operating day.   node app/eval/v7.test.js */
var http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
process.env.PERILOOP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'v7-')); delete process.env.PERILOOP_NO_SEED; delete process.env.PROVIDER_BASE_URL; delete process.env.PROVIDER_KEY;
var pass = 0, fail = 0; function ok(c, name, extra) { if (c) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); } }
function call(port, method, p, body, cookie) { return new Promise(function (res) { var d = body ? JSON.stringify(body) : null; var q = http.request({ port: port, path: p, method: method, headers: Object.assign({ 'content-type': 'application/json', 'x-requested-with': 'periloop' }, cookie ? { cookie: cookie } : {}) }, function (r) { var c = []; r.on('data', function (x) { c.push(x); }); r.on('end', function () { var t = Buffer.concat(c).toString(), j; try { j = JSON.parse(t); } catch (e) { j = t; } res({ status: r.statusCode, json: j, raw: t, cookie: (r.headers['set-cookie'] || [''])[0].split(';')[0] }); }); }); if (d) q.write(d); q.end(); }); }
function key(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
// a Wednesday at least 60 days ahead, so no seeded demo patient is on it
var day = new Date(Date.now() + 60 * 864e5); while (day.getDay() !== 3) day = new Date(day.getTime() + 864e5); var D0 = key(day);

(async function () {
  var S = require('../server.js'), srv = S.createServer(); await new Promise(function (r) { srv.listen(0, r); }); var port = srv.address().port;
  var doc = (await call(port, 'POST', '/api/login', { username: 'doctor', password: 'doctor-demo-1' })).cookie, nurse = (await call(port, 'POST', '/api/login', { username: 'nurse', password: 'nurse-demo-1' })).cookie;
  try {
    var all = (await call(port, 'GET', '/api/patients', null, doc)).json;
    ok(all.length >= 30 && all.every(function (p) { return typeof p.age === 'number' && (p.sex === 'F' || p.sex === 'M'); }), 'age and sex: every demo patient has a fictional age and sex');
    var a = await call(port, 'POST', '/api/patients', { name: 'Age Test', rn: 'V7-AGE', age: 71, sex: 'F', procedure: 'TKR', otDate: D0, lang: 'en' }, doc), det = (await call(port, 'GET', '/api/patients/' + a.json.id, null, doc)).json;
    ok(det.patient.age === 71 && det.patient.sexLabel === 'Female', 'age and sex: saved when a patient is added and shown on the patient page');
    ok((await call(port, 'POST', '/api/patients/' + a.json.id + '/details', { age: 'abc', sex: 'F' }, doc)).status === 400 && (await call(port, 'POST', '/api/patients/' + a.json.id + '/details', { age: 72, sex: 'M' }, nurse)).json.age === 72, 'age and sex: staff can correct them; a bad age is refused');
    var tok = det.link.split('/').pop(), pv = await call(port, 'GET', '/api/p/' + tok + '/messages');
    ok(pv.raw.indexOf('"age"') < 0, 'age and sex: not sent to the patient side');
    // over-book the day: limit is 5, book 7
    var ids = [a.json.id];
    for (var i = 1; i <= 6; i++) ids.push((await call(port, 'POST', '/api/patients', { name: 'Slot ' + i, rn: 'V7-S' + i, age: 60 + i, sex: i % 2 ? 'M' : 'F', procedure: 'TKR', otDate: D0, lang: 'en' }, doc)).json.id);
    await call(port, 'POST', '/api/patients/' + ids[3] + '/readings', { param: 'hb', value: 7.0 }, doc);   // gives this patient an open red flag
    var g = (await call(port, 'GET', '/api/calendar/suggest?date=' + D0, null, doc)).json;
    ok(g.count === 7 && g.max === 5 && g.excess === 2 && g.candidates.length === 7, 'calendar: an over-booked day reports how many cases to move', { count: g.count, excess: g.excess });
    ok(g.candidates[0].pid === ids[3] && /red flag/.test(g.candidates[0].why), 'calendar: the patient with an open red flag is listed first, with the reason', g.candidates[0]);
    ok(g.days.length >= 3 && g.days.every(function (d) { return d.free > 0 && d.weekday !== 'Sat' && d.weekday !== 'Sun' && d.date > key(new Date()); }) && Math.abs(g.days[0].daysAway) === 1, 'calendar: only future weekdays with space are offered, nearest first', g.days);
    ok((await call(port, 'GET', '/api/calendar/suggest?date=' + g.days[0].date, null, doc)).json.excess === 0, 'calendar: a day within the limit gets no suggestion');
    // move
    var before = (await call(port, 'GET', '/api/patients/' + ids[3], null, doc)).json, t0 = before.tasks.filter(function (t) { return t.state === 'open' && !t.auto; })[0];
    ok((await call(port, 'POST', '/api/patients/' + ids[3] + '/reschedule', { otDate: g.days[0].date }, nurse)).status === 403, 'calendar: a nurse cannot move an operation');
    var mv = await call(port, 'POST', '/api/patients/' + ids[3] + '/reschedule', { otDate: g.days[0].date, reason: 'day over the limit' }, doc), after = (await call(port, 'GET', '/api/patients/' + ids[3], null, doc)).json;
    var t1 = after.tasks.find(function (t) { return t.id === t0.id; }), shift = Math.round((t1.dueAt - t0.dueAt) / 864e5);
    ok(mv.status === 200 && after.patient.otDate === g.days[0].date && shift === g.days[0].daysAway, 'calendar: a doctor moves the case; its open tasks shift by the same number of days', { shift: shift, away: g.days[0].daysAway });
    ok(after.tasks.some(function (t) { return /Tell the patient the new operation date/.test(t.title) && t.state === 'open'; }) && after.messages.length === before.messages.length, 'calendar: a task to tell the patient is added; the patient is not messaged automatically');
    ok((await call(port, 'GET', '/api/calendar/suggest?date=' + D0, null, doc)).json.excess === 1 && /moved the operation of V7-S3/.test((await call(port, 'GET', '/api/audit', null, doc)).raw), 'calendar: the day is one case better and the move is in the audit log');
    // a full target day is refused unless forced
    var full = g.days[0].date; for (var j = 0; j < 6; j++) await call(port, 'POST', '/api/patients', { name: 'Fill ' + j, rn: 'V7-F' + j, age: 50, sex: 'M', procedure: 'TKR', otDate: full, lang: 'en' }, doc);
    ok((await call(port, 'POST', '/api/patients/' + ids[4] + '/reschedule', { otDate: full }, doc)).status === 409 && (await call(port, 'POST', '/api/patients/' + ids[4] + '/reschedule', { otDate: '2020-01-01' }, doc)).status === 400, 'calendar: moving onto a full day or into the past is refused');
  } finally { await S.drain(); srv.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
