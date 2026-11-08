/* Regression tests for review1 blockers B1-B4 and the wiring of majors M1-M6.
 * Run: node mod/regress1.test.js   (after node build.js for the page checks). No network, fictional data only. */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var A = require('./adapter.js');
var I = require('./intake.js');
var E = require('../engine.js');
var H = require('./histories.json');

var results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(
    function () { results.push([name, true]); },
    function (e) { results.push([name, false, e && e.message]); }
  );
}
function mockFetch(text, shape) {
  var calls = [];
  var fn = function (url, init) {
    calls.push({ url: url, init: init });
    return Promise.resolve({ ok: true, json: function () {
      return Promise.resolve(shape === 'proxy' ? { text: text } : { choices: [{ message: { content: text } }] });
    } });
  };
  fn.calls = calls;
  return fn;
}
var PROXY = 'https://proxy.example/chat';
var PATIENT_BT = 'Do I still take my blood thinner tonight?';
var STEP = 'Please tell us your next medicine.';

var tests = [
  // ---- B1: AI-mode output filter ----
  // round 5 (expectation changed): PATIENT_BT is ROUTE (clinical judgement), and ROUTE never reaches a model. The
  // output-filter check below therefore uses an approved-answer question (ANSWER), which still reaches the model.
  check('B1 round 5: a clinical question (PATIENT_BT) makes zero model calls and gets the care-team reply', function () {
    var f = mockFetch('stop your warfarin, take 2 tablets', 'proxy');
    var ad = A.createAdapter({ mode: 'ai', proxyUrl: PROXY, fetchImpl: f });
    return A.askSafely(ad, PATIENT_BT, E.classify, { step: STEP, ctx: { procedure: 'TKR' } }).then(function (out) {
      assert.strictEqual(f.calls.length, 0, 'the model must not be called for a clinical question');
      assert.strictEqual(out.cls, 'ROUTE');
      assert.strictEqual(out.mode, 'engine');
      assert.ok(out.text.indexOf('warfarin') < 0 && out.text.indexOf('tablets') < 0);
    });
  }),
  check('B1 mock model "stop your warfarin, take 2 tablets" is blocked and the scripted question is shown', function () {
    var f = mockFetch('stop your warfarin, take 2 tablets', 'proxy');
    var ad = A.createAdapter({ mode: 'ai', proxyUrl: PROXY, fetchImpl: f });
    return A.askSafely(ad, 'can I shower if the waterproof dressing is still on', E.classify, { step: STEP, ctx: { procedure: 'TKR' } }).then(function (out) {
      assert.strictEqual(f.calls.length, 1, 'the model was called once, its reply was then discarded');
      assert.strictEqual(out.mode, 'blocked');
      assert.strictEqual(out.text, STEP);
      assert.ok(out.text.indexOf('warfarin') < 0 && out.text.indexOf('tablets') < 0, 'no dosing text reaches the patient');
    });
  }),
  check('B1 the adapter itself guards its reply, not only askSafely', function () {
    var f = mockFetch('stop your warfarin, take 2 tablets', 'proxy');
    var ad = A.createAdapter({ mode: 'ai', proxyUrl: PROXY, fetchImpl: f });
    return ad.ask([{ role: 'user', content: PATIENT_BT }], { step: STEP }).then(function (out) {
      assert.strictEqual(out.mode, 'blocked');
      assert.strictEqual(out.text, STEP);
    });
  }),
  check('B1 a plain question from the model passes the filter', function () {
    var f = mockFetch('Which day is your surgery?', 'proxy');
    var ad = A.createAdapter({ mode: 'ai', proxyUrl: PROXY, fetchImpl: f });
    // round 5: an approved-answer question (ANSWER) is used here; "what time should I come in" is ROUTE and never reaches a model.
    return A.askSafely(ad, 'can I shower if the waterproof dressing is still on', E.classify, { step: STEP, ctx: { procedure: 'TKR' } }).then(function (out) {
      assert.strictEqual(out.mode, 'ai');
      assert.strictEqual(out.text, 'Which day is your surgery?');
    });
  }),
  check('B1 a summary of the patient words passes the filter', function () {
    var g = A.guardReply('You mentioned your appointment is on Monday.', 'my appointment is on Monday', null);
    assert.deepStrictEqual(g, { ok: true });
  }),
  check('B1 dose, diagnosis and advice patterns are each blocked', function () {
    ['Take 500 mg every day?', 'Two tablets at night?', 'You have a clot.', 'You should rest for a week.', 'Your dosage is fine?'].forEach(function (r) {
      var g = A.guardReply(r, 'x', null);
      if (r.indexOf('?') >= 0 && r.indexOf('mg') < 0 && r.indexOf('tablets') < 0 && r.indexOf('dosage') < 0) return;
      assert.strictEqual(g.ok, false, 'should block: ' + r);
    });
  }),
  check('B1 engine classify on the reply blocks a reply that would be SAME-DAY', function () {
    var g = A.guardReply('You said your calf has been swollen since last night.', 'my calf is swollen', E.classify);
    assert.strictEqual(g.ok, false);
    assert.strictEqual(g.reason, 'engine_SAME-DAY');
  }),
  check('B1 engine classify blocks a clinical ROUTE reply', function () {
    var g = A.guardReply('Can you ask a clinician about your blood thinner?', 'blood thinner', E.classify);
    assert.strictEqual(g.ok, false);
    assert.strictEqual(g.reason, 'engine_route_clinical');
  }),
  check('B1 "do you have ...?" is a question, not a diagnosis', function () {
    assert.deepStrictEqual(A.guardReply('Right now, do you have chest pain, trouble breathing, or confusion?', 'x', null), { ok: true });
  }),

  // ---- B2: blood-thinner consistency ----
  check('B2 medicine list names warfarin, answer no: AMBER with the exact text and the clinician to-do', function () {
    var a = { meds_text: 'warfarin 3 mg at night', blood_thinner: 'no' };
    var s = I.summarise({ procedure: 'ACL', answers: a });
    assert.strictEqual(s.banner.level, 'AMBER');
    assert.ok(s.banner.reasons.indexOf('Medicine list mentions a blood thinner; yes/no answer disagrees: clinician to verify [blood_thinner, meds_text]') >= 0);
    var t = I.todos({ procedure: 'ACL', answers: a }).filter(function (x) { return x.key === 'anticoag_decision'; });
    assert.strictEqual(t.length, 1);
    assert.strictEqual(t[0].owner, 'surgeon');
    assert.strictEqual(t[0].needsClinician, true);
  }),
  check('B2 free text names rivaroxaban and blood_thinner is missing: AMBER, not NONE', function () {
    var s = I.summarise({ procedure: 'TKR', answers: { meds_text: 'paracetamol' }, freeText: ['I also take rivaroxaban at night'] });
    assert.notStrictEqual(s.banner.level, 'NONE');
    assert.ok(s.banner.reasons.some(function (r) { return /disagrees: clinician to verify/.test(r); }) || s.banner.level === 'RED');
  }),
  check('B2 blood_thinner unanswered and nothing named: INCOMPLETE (grey), never NONE', function () {
    var s = I.summarise({ procedure: 'ACL', answers: {} });
    assert.strictEqual(s.banner.level, 'INCOMPLETE');
  }),
  check('B2 any open gap is INCOMPLETE (round 6, review3 M6: was "more than 6 gaps"); NONE needs zero gaps', function () {
    var base = H.find(function (h) { return h.pid === 'FIC-TKR-01'; });
    assert.strictEqual(I.summarise(base).banner.level, 'NONE');
    var six = JSON.parse(JSON.stringify(base.answers));
    ['alcohol', 'walk_distance_m', 'preferred_language', 'hba1c', 'stairs_home', 'night_pain'].forEach(function (k) { delete six[k]; });
    assert.strictEqual(I.summarise({ procedure: 'TKR', answers: six }).gaps.length, 6);
    assert.strictEqual(I.summarise({ procedure: 'TKR', answers: six }).banner.level, 'INCOMPLETE'); // round 6 M6: 6 open gaps are never NONE
    var seven = JSON.parse(JSON.stringify(six)); delete seven.mobility_aid;
    var s7 = I.summarise({ procedure: 'TKR', answers: seven });
    assert.strictEqual(s7.gaps.length, 7);
    assert.strictEqual(s7.banner.level, 'INCOMPLETE');
  }),

  // ---- B3: red flag creates the urgent clinician task due now, once ----
  check('B3 red-flag task is owned by a clinician, due now, and not duplicated', function () {
    var sim = new E.Sim();
    sim.now = 5;
    sim.addPatient({ id: 'P1', procedure: 'LUMBAR', surgeryIn: 10 });
    var spec = I.redTodo({ level: 'EMERGENCY', flags: ['cauda equina'] });
    assert.strictEqual(spec.owner, 'clinician');
    assert.strictEqual(spec.urgent, true);
    assert.strictEqual(I.toTasks(sim, 'P1', [spec]).length, 1);
    assert.strictEqual(I.toTasks(sim, 'P1', [spec]).length, 0);
    var t = sim.tasks.find(function (x) { return x.pid === 'P1' && x.type === spec.key; });
    assert.strictEqual(t.owner, 'clinician');
    assert.strictEqual(t.dueAt, 5, 'due now');
  }),
  check('B3 page wiring: halt buttons and the fixed safety-filter note are in the page', function () {
    var src = fs.readFileSync(path.join(__dirname, '..', 'src.html'), 'utf8');
    ['Alert staff now', 'Continue interview anyway', 'model reply blocked by safety filter', 'Interview paused after a red flag'].forEach(function (s) {
      assert.ok(src.indexOf(s) >= 0, 'missing in src.html: ' + s);
    });
  }),

  // ---- B4: patient question becomes a Staff board task, de-duplicated ----
  check('B4 a question creates one task: owner preop_nurse, due in 24 h, title "Patient question: ..."', function () {
    var sim = new E.Sim();
    sim.now = 10;
    sim.addPatient({ id: 'P2', procedure: 'TKR', surgeryIn: 14 });
    var r = I.questionTask(sim, 'P2', 'Can I drive my car after the operation?', false);
    assert.strictEqual(r.status, 'created');
    assert.strictEqual(r.task.owner, 'preop_nurse');
    assert.strictEqual(r.task.dueAt, 10 + 24);
    assert.strictEqual(r.task.title, 'Patient question: Can I drive my car after the operation?');
  }),
  check('B4 the same question again (different case and spacing) is not duplicated', function () {
    var sim = new E.Sim();
    sim.addPatient({ id: 'P3', procedure: 'TKR', surgeryIn: 14 });
    I.questionTask(sim, 'P3', 'When can I fly?', false);
    var r = I.questionTask(sim, 'P3', '  when   CAN I fly? ', false);
    assert.strictEqual(r.status, 'duplicate');
    assert.strictEqual(sim.tasks.filter(function (x) { return x.pid === 'P3'; }).length, 1);
  }),
  check('B4 the same question for a different patient is a new task', function () {
    var sim = new E.Sim();
    sim.addPatient({ id: 'P4', procedure: 'TKR', surgeryIn: 14 });
    sim.addPatient({ id: 'P5', procedure: 'TKR', surgeryIn: 14 });
    I.questionTask(sim, 'P4', 'When can I fly?', false);
    assert.strictEqual(I.questionTask(sim, 'P5', 'When can I fly?', false).status, 'created');
  }),
  check('B4 a long question is truncated in the title, and an urgent one is due now for a clinician', function () {
    var sim = new E.Sim();
    sim.now = 3;
    sim.addPatient({ id: 'P6', procedure: 'TKR', surgeryIn: 14 });
    var long = 'x'.repeat(100);
    var r = I.questionTask(sim, 'P6', long, true);
    assert.ok(r.task.title.length <= 'Patient question: '.length + 60);
    assert.strictEqual(r.task.owner, 'clinician');
    assert.strictEqual(r.task.dueAt, 3);
    assert.strictEqual(I.questionTask(sim, 'P6', 'Can I take antibiotics?', false, true).task.owner, 'clinician', 'clinical question goes to a clinician');
  }),

  // ---- majors: wiring checks on the built page (run node build.js first) ----
  check('M1 raw ids are hidden behind a Show sources toggle that defaults off', function () {
    var src = fs.readFileSync(path.join(__dirname, '..', 'src.html'), 'utf8');
    assert.ok(src.indexOf('.srcx{display:none') >= 0 && src.indexOf('Show sources') >= 0);
    assert.ok(/aria-pressed="'\+\(showSrc\?'true':'false'\)/.test(src));
  }),
  check('M5 the built page embeds all 30 histories for the sample picker', function () {
    var built = path.join(__dirname, '..', 'index.html');
    var html = fs.readFileSync(built, 'utf8');
    H.forEach(function (h) { assert.ok(html.indexOf('"pid":"' + h.pid + '"') >= 0, 'missing ' + h.pid); });
  }),
  check('M6 Malay and Chinese summary headings and "nothing reported" strings exist', function () {
    var src = fs.readFileSync(path.join(__dirname, '..', 'src.html'), 'utf8');
    ['Ubat', 'Tiada dilaporkan.', '用药', '未报告。', 'Senarai tugasan', '待办事项'].forEach(function (s) {
      assert.ok(src.indexOf(s) >= 0, 'missing ' + s);
    });
  })
];

Promise.all(tests).then(function () {
  var pass = results.filter(function (r) { return r[1]; }).length;
  results.forEach(function (r) { console.log((r[1] ? 'PASS ' : 'FAIL ') + r[0] + (r[1] ? '' : ' :: ' + r[2])); });
  console.log('\n' + pass + ' PASS, ' + (results.length - pass) + ' FAIL');
  process.exit(pass === results.length ? 0 : 1);
});
