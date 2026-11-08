/* Regression tests for review1 "Fix log round 2": items 8, 9, 10, the page wiring for 11-15, and M6 (ms/zh labels).
 * Run: node mod/review1b.test.js   (after node build.js for the page checks). No network, fictional data only. */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var I = require('./intake.js');
var IV = require('./interview.js');
var K = require('./knowledge.js');
var E = require('../engine.js');
var H = require('./histories.json');
var SRC = fs.readFileSync(path.join(__dirname, '..', 'src.html'), 'utf8');

var results = [];
function check(name, fn) {
  try { fn(); results.push([name, true]); } catch (e) { results.push([name, false, e && e.message]); }
}
function byPid(pid) { return H.find(function (h) { return h.pid === pid; }); }
function runInterview(proc, lang, typed) {
  var s = IV.build(proc, lang, 'IVT');
  var guard = 0;
  while (!s.done && guard++ < 120) {
    var p = IV.prompt(s), v;
    if (typed && typed[p.id] !== undefined) v = typed[p.id];
    else if (p.type === 'yesno') v = 'no';
    else if (p.type === 'number') v = String(p.min || 1);
    else if (p.type === 'choice') v = p.options[0].label;
    else v = 'none';
    s = IV.next(s, v);
  }
  return s;
}

// ---- item 10: worsening or clinical-judgement words in the patient's own text ----
var WORSE = 'AMBER reason and clinician review within 48 h';
check('item 10 "my back pain is getting worse at night" gives AMBER, not NONE', function () {
  var c = byPid('FIC-LUM-05');
  var s = I.summarise(c);
  assert.strictEqual(s.banner.level, 'AMBER', 'got ' + s.banner.level);
  assert.ok(s.banner.reasons.indexOf('Patient reports worsening symptoms: clinician to review') >= 0, JSON.stringify(s.banner.reasons));
});
check('item 10 the worsening case makes one clinician to-do due within 48 h', function () {
  var c = byPid('FIC-LUM-05');
  var t = I.todos(c).filter(function (x) { return x.key === 'clinician_review_worsening'; });
  assert.strictEqual(t.length, 1, WORSE);
  assert.strictEqual(t[0].owner, 'clinician');
  assert.strictEqual(t[0].needsClinician, true);
  assert.strictEqual(t[0].dueHours, 48);
  var sim = new E.Sim();
  sim.now = 100;
  sim.addPatient({ id: 'W1', procedure: 'LUMBAR', surgeryIn: 10 });
  I.toTasks(sim, 'W1', [t[0]]);
  var task = sim.tasks.find(function (x) { return x.pid === 'W1' && x.type === 'clinician_review_worsening'; });
  assert.ok(task, 'task created');
  assert.strictEqual(task.dueAt, 100 + 48, 'due 48 h from now');
  assert.strictEqual(task.owner, 'clinician');
});
check('item 10 the same worsening text typed as an interview answer also gives AMBER', function () {
  var s = runInterview('LUMBAR', 'en', { final_note: 'my back pain is getting worse at night' });
  assert.strictEqual(s.done, true);
  var sum = I.summarise(IV.toAnswers(s));
  assert.strictEqual(sum.banner.level, 'AMBER', 'got ' + sum.banner.level);
  assert.ok(sum.banner.reasons.indexOf('Patient reports worsening symptoms: clinician to review') >= 0);
});
check('item 10 clinical-judgement words ("stop my warfarin") are never NONE, and are not the worsening reason (round 3 B: medicine names do not trigger it)', function () {
  var c = JSON.parse(JSON.stringify(byPid('FIC-SHO-01')));
  c.freeText = ['I want to stop my warfarin tonight'];
  var s = I.summarise(c);
  assert.notStrictEqual(s.banner.level, 'NONE');
  assert.strictEqual(s.banner.reasons.indexOf('Patient reports worsening symptoms: clinician to review'), -1, 'no worsening reason for a medicine question');
});
check('item 10 control: an ordinary free-text remark does not raise the worsening reason', function () {
  var c = JSON.parse(JSON.stringify(byPid('FIC-SHO-01')));
  c.freeText = ['Nothing else, thank you.'];
  var s = I.summarise(c);
  assert.strictEqual(s.banner.level, 'NONE', 'got ' + s.banner.level);
  assert.ok(!I.todos(c).some(function (x) { return x.key === 'clinician_review_worsening'; }));
});

// ---- item 9: red flags from a sample behave like the interview path ----
check('item 9 a lumbar bladder answer makes the sample RED with an emergency red flag and reply', function () {
  var c = JSON.parse(JSON.stringify(byPid('FIC-LUM-02')));
  c.answers.lumbar_bladder_bowel_change = 'yes';
  var red = I.redOf(c);
  assert.ok(red, 'red flag found');
  assert.strictEqual(red.level, 'EMERGENCY');
  assert.ok(red.reply && red.reply.length > 0, 'engine reply present');
  assert.strictEqual(I.summarise(c).banner.level, 'RED');
});
check('item 9 one urgent red task per patient: second call creates nothing and the to-do list has one red item', function () {
  var c = byPid('FIC-LUM-02');
  var sim = new E.Sim();
  sim.addPatient({ id: 'R1', procedure: 'LUMBAR', surgeryIn: 3 });
  var red = I.redOf(Object.assign({}, c, { answers: Object.assign({}, c.answers, { lumbar_bladder_bowel_change: 'yes' }) }));
  var spec = I.redTodo(red);
  assert.strictEqual(I.toTasks(sim, 'R1', [spec]).length, 1);
  assert.strictEqual(I.toTasks(sim, 'R1', [spec]).length, 0, 'not duplicated');
  var reds = I.todos(Object.assign({}, c, { answers: Object.assign({}, c.answers, { lumbar_bladder_bowel_change: 'yes' }) })).filter(function (x) { return x.urgent; });
  assert.strictEqual(reds.length, 1, 'one urgent item, got ' + reds.length);
  assert.strictEqual(reds[0].key, 'intake_red_flag');
  var t = sim.tasks.find(function (x) { return x.pid === 'R1' && x.type === 'intake_red_flag'; });
  assert.strictEqual(t.owner, 'clinician');
  assert.strictEqual(t.dueAt, sim.now, 'due now');
});
check('item 9 the interview path and the sample path raise the same urgent task key on one patient', function () {
  var s = runInterview('LUMBAR', 'en', { lum_bladder: 'yes' });
  var sim = new E.Sim();
  sim.addPatient({ id: 'R2', procedure: 'LUMBAR', surgeryIn: 3 });
  // interview: the red flag in state, created by the page with redTodo(st.red)
  assert.ok(s.red, 'interview halted on a red flag');
  I.toTasks(sim, 'R2', [I.redTodo(s.red)]);
  // sample path for the same patient: its todos carry the same key, so nothing is added again
  var fromSample = I.todos({ pid: 'R2', procedure: 'LUMBAR', lang: 'en', answers: IV.toAnswers(s).answers, freeText: [] });
  var added = I.toTasks(sim, 'R2', fromSample.filter(function (x) { return x.urgent; }));
  assert.strictEqual(added.length, 0, 'no second urgent task');
  assert.strictEqual(sim.tasks.filter(function (x) { return x.pid === 'R2' && x.type === 'intake_red_flag'; }).length, 1, 'exactly one urgent red task');
});
check('item 9 page wiring: a loaded sample with a red flag calls the shared red box and says the task status', function () {
  assert.ok(SRC.indexOf('if(red)redBox(red,h.lang,') >= 0, 'loadSample calls redBox for a red sample');
  assert.ok(SRC.indexOf('Urgent task created on the Staff board, due now.') >= 0 && SRC.indexOf('Urgent task is already on the Staff board, due now. Not duplicated.') >= 0);
  assert.ok(SRC.indexOf('function redBox(') >= 0 && SRC.indexOf('Red flag: ') >= 0);
});

// ---- item 8: override shown with owner names ----
var SRCS = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources.sample.json'), 'utf8')).sources;
function store() { var st = K.createStore(); SRCS.forEach(function (s) { K.addSource(st, s); }); return st; }
var CTX = { country: 'Sample Emirate Health Authority', hospital: 'Sample General Hospital', team: 'Sample Ortho Ward Team', surgeon: 'Dr Sample Surgeon', procedure: 'TKR' };
check('item 8 surgeon override of a hospital answer: answer shown, then "Overrides hospital guidance:" with both owner names', function () {
  var st = store();
  var r = K.answer(st, CTX, 'When can I shower?', 'en');
  assert.strictEqual(r.kind, 'ANSWER');
  assert.strictEqual(r.citation.layer, 'surgeon', 'surgeon layer answers');
  var ov = K.overrideLine(st, CTX, r);
  assert.ok(ov, 'override line');
  assert.strictEqual(ov.head, 'Overrides hospital guidance:');
  assert.ok(ov.body.indexOf('wait 48 hours before showering') >= 0, 'hospital text summarised');
  assert.ok(ov.body.indexOf('Sample General Hospital') >= 0 && ov.body.indexOf('Dr Sample Surgeon') >= 0, 'owner names');
  assert.strictEqual(r.approved, false, 'still a draft');
});
check('item 8 no surgeon: the hospital answer stands and there is no override line', function () {
  var st = store();
  var c2 = Object.assign({}, CTX, { surgeon: '' });
  var r = K.answer(st, c2, 'When can I shower?', 'en');
  assert.strictEqual(K.overrideLine(st, c2, r), null);
});
check('item 8 page wiring: the approval label and the override line are both in the Ask box code', function () {
  // round 6 (review3 M1): the draft label is now 'SAMPLE draft, not approved' (was 'no, draft text')
  assert.ok(SRC.indexOf("SAMPLE draft, not approved") >= 0);
  assert.ok(SRC.indexOf('KN.overrideLine(store,ctx,r)') >= 0);
});

// ---- items 11-15 wiring on the page ----
check('item 11 settings sit in the interview column, after the interview card and before the Ask card', function () {
  var iInt = SRC.indexOf('class="card iv-int"'), iSet = SRC.indexOf('class="card iv-set"') >= 0 ? SRC.indexOf('<details class="card iv-set">') : -1, iAsk = SRC.indexOf('class="card iv-ask"');
  assert.ok(iInt > 0 && iSet > iInt && iSet < iAsk, [iInt, iSet, iAsk].join(' '));
  assert.ok(SRC.indexOf('id="iv-set-sum"') >= 0 && SRC.indexOf('Settings: scripted, no AI') >= 0, 'summary shows the mode');
});
check('item 12 interview chat is no longer a fixed 300 px panel', function () {
  assert.ok(SRC.indexOf('#iv-chat{height:auto;min-height:220px;max-height:60vh}') >= 0);
});
check('item 13 header patient label follows the selected fictional patient (hdr-pt set on select, start and sample)', function () {
  assert.ok(SRC.indexOf('id="hdr-pt"') >= 0);
  assert.ok(SRC.indexOf("$('iv-pat').addEventListener('change'") >= 0 && SRC.indexOf('setHeader(curName)') >= 0);
  assert.ok(SRC.indexOf('setHeader(curName);') >= 0);
});
check('item 14 "Our team has been alerted" is kept only when an alert task exists; the fallback wording is present', function () {
  assert.ok(SRC.indexOf('Please contact the clinic or go to the emergency department now.') >= 0);
  assert.ok(SRC.indexOf('function honestReply(text,alertExists)') >= 0);
  assert.ok(/Our team has been alerted/.test(E.classify('chest pain').reply), 'engine text unchanged (page maps it, engine.js not edited)');
});
check('item 15 button wording: "Open staff board" everywhere, no mixed "Open Staff board"', function () {
  assert.strictEqual(SRC.indexOf('Open Staff board'), -1);
  assert.ok(SRC.indexOf('Open staff board') >= 0);
});
check('item 15 focus outlines: a visible :focus-visible rule exists for buttons, inputs and selects', function () {
  assert.ok(SRC.indexOf(':focus-visible{outline:3px solid var(--ro)') >= 0);
  assert.ok(SRC.indexOf('input:focus-visible,select:focus-visible') >= 0);
});

// ---- M6: summary labels in Malay and Chinese (machine drafts; the notice stays) ----
check('M6 a Malay summary line uses the Malay label and keeps the raw id', function () {
  var s = I.summarise(Object.assign({}, byPid('FIC-TKR-01'), { lang: 'ms' }));
  var lines = s.sections.flatMap(function (x) { return x.lines; });
  assert.ok(lines.some(function (l) { return /^Ubat semasa: .* \[meds_text\]$/.test(l); }), 'ms label');
});
check('M6 a Chinese summary line uses the Chinese label and keeps the raw id', function () {
  var s = I.summarise(Object.assign({}, byPid('FIC-TKR-01'), { lang: 'zh' }));
  var lines = s.sections.flatMap(function (x) { return x.lines; });
  assert.ok(lines.some(function (l) { return /^当前用药: .* \[meds_text\]$/.test(l); }), 'zh label');
});
check('M6 the English summary is unchanged', function () {
  var s = I.summarise(byPid('FIC-TKR-01'));
  var lines = s.sections.flatMap(function (x) { return x.lines; });
  assert.ok(lines.some(function (l) { return /^Current medicines: .* \[meds_text\]$/.test(l); }));
});

// ---- item 14 behaviour: pull the page's honestReply out of index.html and run it ----
check('item 14 behaviour: the alerted sentence is replaced when no alert task exists, in en, ms and zh', function () {
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  var start = html.indexOf('var ALERTED=');
  var end = html.indexOf('var st=null,shownRed');
  assert.ok(start > 0 && end > start, 'honestReply block found in the built page');
  var code = html.slice(start, end) + '\nreturn honestReply;';
  var honestReply = new Function(code)();
  var en = E.classify('chest pain').reply;
  var sd = E.classify('fever reported').reply;
  assert.ok(/Our team has been alerted/.test(honestReply(en, true)), 'kept when a task exists');
  assert.ok(!/Our team has been alerted/.test(honestReply(en, false)), 'removed when no task');
  assert.ok(honestReply(en, false).indexOf('Please contact the clinic or go to the emergency department now.') >= 0, 'fallback wording');
  assert.ok(!/alerted/.test(honestReply(sd, false)), 'same-day text also fixed');
  var ms = E.classify('saya sakit dada sejak semalam', { mode: 'intake' }).reply;
  assert.ok(!/telah dimaklumkan/.test(honestReply(ms, false)) && /Sila hubungi klinik/.test(honestReply(ms, false)), 'ms fallback');
  var zh = E.classify('胸口痛').reply;
  assert.ok(!/已收到通知/.test(honestReply(zh, false)) && /请立即联系诊所/.test(honestReply(zh, false)), 'zh fallback');
  assert.strictEqual(honestReply('Thanks, noted.', false), 'Thanks, noted.', 'other text untouched');
});

var pass = results.filter(function (r) { return r[1]; }).length;
results.forEach(function (r) { console.log((r[1] ? 'PASS ' : 'FAIL ') + r[0] + (r[1] ? '' : ' :: ' + r[2])); });
console.log('\n' + pass + ' PASS, ' + (results.length - pass) + ' FAIL');
process.exit(pass === results.length ? 0 : 1);
