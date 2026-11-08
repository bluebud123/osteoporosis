/* Round 3 tests (review1 open problems A, B, C). Run: node mod/round3.test.js
 * A: every interview question for all six procedures, answered all-negative and all-positive, in en, ms and zh.
 * B: the worsening amber needs a symptom word and a worsening word. C: ms and zh summary text. Fictional data only. */
'use strict';
var assert = require('assert');
var I = require('./interview.js');
var IDMAP = require('./idmap.js');
var INTAKE = require('./intake.js');
var E = require('../engine.js');
var H = require('./histories.json');

var results = [];
function check(name, fn) {
  try { fn(); results.push([name, true]); } catch (e) { results.push([name, false, e && e.message]); }
}
var BANK = {};
I.COMMON.concat.apply(I.COMMON, I.PROCEDURES.map(function (p) { return I.BY_PROC[p]; })).forEach(function (q) { BANK[q.id] = q; });
var NOT_ANSWERED = /Not answered|Belum dijawab|未回答/;

// ---- answers: a fixed negative and a fixed positive answer for each question, typed in the language ----
var WORD = { en: { yes: 'yes', no: 'no' }, ms: { yes: 'ya', no: 'tidak' }, zh: { yes: '是', no: '否' } };
var UNK = { en: 'unknown', ms: 'tidak tahu', zh: '不知道' };
var NEG_CHOICE = { sex: 'female', smoking: 'never', alcohol: 'none', home_help: 'family', mobility_aid: 'none', payer: 'self',
  contact_language: 'en', tkr_walk: 'over_500', thr_socks: 'independent', sh_overhead: 'full', sh_dominant: 'right', fa_shoes: 'normal', lum_distance: 'back_only' };
var POS_CHOICE = { sex: 'female', smoking: 'current', alcohol: 'regular', home_help: 'alone', mobility_aid: 'wheelchair', payer: 'insurance',
  contact_language: 'zh', tkr_walk: 'cannot', thr_socks: 'cannot', sh_overhead: 'none', sh_dominant: 'left', fa_shoes: 'none', lum_distance: 'below_knee' };
var POS_TEXT = {
  medicines: { en: 'paracetamol 500 mg when needed', ms: 'parasetamol 500 mg bila perlu', zh: '对乙酰氨基酚 500 毫克，需要时服用' },
  blood_thinner_detail: { en: 'aspirin 75 mg, last dose yesterday', ms: 'aspirin 75 mg, dos terakhir semalam', zh: '阿司匹林 75 毫克，昨天最后一次' },
  allergy_detail: { en: 'penicillin: rash', ms: 'penisilin: ruam', zh: '青霉素：皮疹' },
  anaesthetic_detail: { en: 'my mother, nausea', ms: 'ibu saya, loya', zh: '我母亲，恶心' },
  same_joint_detail: { en: 'knee arthroscopy 2019', ms: 'artroskopi lutut 2019', zh: '2019年膝关节镜' },
  acl_sport: { en: 'football', ms: 'bola sepak', zh: '足球' },
  final_note: { en: 'my pain is getting worse at night', ms: 'sakit saya semakin teruk pada waktu malam', zh: '晚上疼痛越来越严重' }
};
var NEG_TEXT = { en: 'none', ms: 'tiada', zh: '没有' };
function answerFor(qid, q, lang, pol) {
  if (q.type === 'yesno') return pol === 'pos' ? WORD[lang].yes : WORD[lang].no;
  if (q.type === 'choice') {
    var val = pol === 'pos' ? POS_CHOICE[qid] : NEG_CHOICE[qid];
    var o = q.options.find(function (x) { return x.value === val; });
    assert.ok(o, 'choice value for ' + qid);
    return o.label[lang];
  }
  if (q.type === 'number') {
    // round 4 (expectation changed): an all-negative history says diabetes "no", so HbA1c must be a normal value.
    // 8.2 with diabetes "no" is a real contradiction (flagged AMBER, correctly); 5.4 is normal and keeps the case consistent.
    if (qid === 'hba1c') return pol === 'pos' ? '8.2' : '5.4';
    if (qid === 'stairs') return pol === 'pos' ? '12' : '0';
    if (qid === 'acl_weeks') return pol === 'pos' ? UNK[lang] : '12';
    return '5';
  }
  if (pol === 'pos' && POS_TEXT[qid]) return POS_TEXT[qid][lang];
  return NEG_TEXT[lang];
}
function runFull(proc, lang, pol) {
  var s = I.build(proc, lang, 'R3-' + proc + '-' + lang + '-' + pol), asked = [], guard = 0;
  while (!I.isComplete(s)) {
    if (guard++ > 200) throw new Error('no progress at ' + s.current);
    var id = s.current, q = BANK[id];
    asked.push(id);
    s = I.next(s, answerFor(id, q, lang, pol));
    if (s.reprompt) throw new Error('reprompt at ' + id + ': ' + s.lastError);
  }
  return { s: s, asked: asked, answers: I.toAnswers(s) };
}
function allText(sum, todos) {
  return sum.banner.reasons.concat(sum.gaps, sum.sections.reduce(function (a, sec) { return a.concat(sec.lines); }, []), todos.map(function (t) { return t.title + ' ' + t.reason; })).join('\n');
}

// ---- A1: the mapping table covers every interview question, and every target is a real intake field ----
check('A: the mapping table has exactly one row for every interview question id', function () {
  var bankIds = Object.keys(BANK).sort(), rowIds = IDMAP.ROWS.map(function (r) { return r.q; }).sort();
  assert.deepStrictEqual(rowIds.filter(function (x, i) { return rowIds.indexOf(x) === i; }), rowIds, 'no duplicate rows');
  assert.deepStrictEqual(rowIds, bankIds, 'rows vs questions');
});
check('A: every mapped intake id is a known summary field or a red-flag id', function () {
  var known = Object.keys(INTAKE.Q).concat(Object.keys(INTAKE.RED_QIDS), ['freeText']);
  var bad = [];
  IDMAP.ROWS.forEach(function (r) { r.to.forEach(function (t) { if (known.indexOf(t) < 0) bad.push(r.q + '->' + t); }); });
  assert.deepStrictEqual(bad, []);
});
check('A: the four lumbar fields are handled: lives_alone is asked for everyone; the other three are not gaps on the interview path', function () {
  assert.ok(I.COMMON.some(function (q) { return q.id === 'lives_alone'; }), 'lives_alone asked in COMMON');
  var lum = IDMAP.fieldsFor('LUMBAR');
  assert.ok(lum.indexOf('lives_alone') >= 0);
  ['night_pain', 'prior_injections', 'walk_distance_m'].forEach(function (f) { assert.strictEqual(lum.indexOf(f), -1, f + ' not asked for LUMBAR'); });
  var r = runFull('LUMBAR', 'en', 'neg');
  var sum = INTAKE.summarise(r.answers);
  assert.ok(!sum.gaps.some(function (g) { return /Night pain|Prior injections|Walking distance/.test(g); }), 'no gap for the three fields');
  assert.ok(sum.sections.some(function (sec) { return sec.lines.some(function (l) { return /\[lives_alone\]/.test(l); }); }), 'lives_alone is summarised');
});
check('A: the interview asks lives_alone in en, ms and zh (machine drafts marked reviewed:false)', function () {
  var q = BANK.lives_alone;
  assert.ok(q && q.reviewed === false && ['en', 'ms', 'zh'].every(function (l) { return q.text[l] && q.text[l].length > 0; }));
});

// ---- A2: every procedure, every language, all-negative and all-positive ----
I.PROCEDURES.forEach(function (proc) {
  ['en', 'ms', 'zh'].forEach(function (lang) {
    ['neg', 'pos'].forEach(function (pol) {
      var tag = proc + '/' + lang + '/' + pol;
      check('A ' + tag + ': interview completes and the summary has no "Not answered" line or gap', function () {
        var r = runFull(proc, lang, pol);
        var sum = INTAKE.summarise(r.answers), todos = INTAKE.todos(r.answers);
        var notAns = sum.gaps.filter(function (g) { return NOT_ANSWERED.test(g); });
        assert.deepStrictEqual(notAns, [], 'gaps');
        var lineNA = sum.sections.reduce(function (a, sec) { return a.concat(sec.lines); }, []).filter(function (l) { return NOT_ANSWERED.test(l); });
        assert.deepStrictEqual(lineNA, [], 'lines');
      });
      check('A ' + tag + ': every asked question appears in a summary line, a to-do, or "Recorded, not summarised" with its question text', function () {
        var r = runFull(proc, lang, pol);
        var sum = INTAKE.summarise(r.answers), todos = INTAKE.todos(r.answers);
        var text = allText(sum, todos);
        var rec = sum.sections.filter(function (sec) { return sec.title === INTAKE.REC_TITLE; })[0];
        assert.ok(rec, 'recorded section present');
        var missing = [];
        r.asked.forEach(function (qid) {
          var q = r.s.questions ? null : null; // placeholder for clarity; question text comes from the bank below
          var qText = BANK[qid].text[lang];
          var targets = IDMAP.targetsOf(qid);
          var onLine = targets.some(function (t) {
            return t === 'freeText' ? /\[freeText\./.test(text) : text.indexOf('[' + t + ']') >= 0 || text.indexOf('[' + t + ',') >= 0 || text.indexOf(', ' + t + ']') >= 0;
          });
          var inRec = rec.lines.some(function (l) { return l.indexOf(qText + ': ') === 0; });
          if (!onLine && !inRec) missing.push(qid);
        });
        assert.deepStrictEqual(missing, [], 'dropped questions');
      });
      check('A ' + tag + ': every answer given is recorded (its text or value is in the summary)', function () {
        var r = runFull(proc, lang, pol);
        var sum = INTAKE.summarise(r.answers);
        var text = allText(sum, INTAKE.todos(r.answers));
        var dropped = [];
        Object.keys(r.answers.interviewAnswers).forEach(function (qid) {
          var v = r.answers.interviewAnswers[qid];
          if (BANK[qid].type === 'text' && String(v).trim()) { if (text.indexOf(String(v).trim()) < 0) dropped.push(qid); }
        });
        assert.deepStrictEqual(dropped, [], 'typed answers missing from summary');
      });
      check('A ' + tag + ': every intake field this interview asks is shown on a line, or is an explicit "unclear" gap', function () {
        var r = runFull(proc, lang, pol);
        var sum = INTAKE.summarise(r.answers);
        var text = allText(sum, INTAKE.todos(r.answers));
        var miss = IDMAP.fieldsFor(proc).filter(function (f) { return text.indexOf('[' + f + ']') < 0 && text.indexOf(', ' + f + ']') < 0 && text.indexOf('[' + f + ',') < 0 && text.indexOf('(' + f + ')') < 0; });
        assert.deepStrictEqual(miss, [], 'fields with no line');
      });
      check('A ' + tag + ': the banner is NONE when all negative and RED when all positive (lumbar, sample symptom and the chest question)', function () {
        var r = runFull(proc, lang, pol);
        var sum = INTAKE.summarise(r.answers);
        if (pol === 'neg') assert.strictEqual(sum.banner.level, 'NONE', 'got ' + sum.banner.level + ' ' + JSON.stringify(sum.gaps));
        else assert.strictEqual(sum.banner.level, 'RED', 'got ' + sum.banner.level);
      });
      check('A ' + tag + ': ms and zh summaries use translated yes/no words, not the English ones', function () {
        if (lang === 'en') return;
        var r = runFull(proc, lang, pol);
        var sum = INTAKE.summarise(r.answers);
        var lines = sum.sections.reduce(function (a, sec) { return a.concat(sec.lines); }, []);
        var englishYN = lines.filter(function (l) { return /: (yes|no) \[/.test(l); });
        assert.deepStrictEqual(englishYN, [], 'English yes/no left in a ' + lang + ' summary');
        if (pol === 'neg') assert.ok(lines.some(function (l) { return l.indexOf(': ' + WORD[lang].no + ' [') >= 0; }), 'a translated no');
      });
    });
  });
});

// ---- A3: the page uses the same table (toAnswers builds answers through idmap) ----
check('A: toAnswers keeps the question text and the shown value for every answer', function () {
  var r = runFull('TKR', 'ms', 'pos');
  var q = r.answers.questions;
  assert.ok(q.diabetes && q.diabetes.shown === 'Ya' && q.diabetes.text.length > 0, JSON.stringify(q.diabetes));
  assert.ok(q.tkr_walk && q.tkr_walk.shown.length > 0);
});

// ---- B: the worsening amber is for symptom words only ----
function freeTextWith(t) {
  var c = JSON.parse(JSON.stringify(H.find(function (h) { return h.pid === 'FIC-SHO-01'; })));
  c.freeText = [t];
  return c;
}
var WORSE_LABEL = 'Patient reports worsening symptoms: clinician to review';
[
  ['can I take ibuprofen', false],
  ['can I fly', false],
  ['can I fly in three weeks if I feel fine', false],
  ['can I increase my painkillers', false],
  ['my back pain is getting worse at night', true],
  ['my knee swelling is increasing', true],
  ['the numbness in my foot is more than before', false],
  ['the numbness in my foot is getting worse', true],
  ['sakit belakang saya semakin teruk pada waktu malam', true],
  ['我的背痛越来越严重', true],
  ['Nothing else, thank you.', false]
].forEach(function (pair) {
  check('B "' + pair[0] + '": worsening amber ' + (pair[1] ? 'fires' : 'does not fire'), function () {
    var c = freeTextWith(pair[0]);
    var s = INTAKE.summarise(c);
    assert.strictEqual(s.banner.reasons.indexOf(WORSE_LABEL) >= 0, pair[1], 'reasons ' + JSON.stringify(s.banner.reasons));
    var has = INTAKE.todos(c).some(function (t) { return t.key === 'clinician_review_worsening'; });
    assert.strictEqual(has, pair[1], 'to-do');
  });
});
check('B "can I take ibuprofen" and "can I fly" are not worsening on the flag test either', function () {
  assert.strictEqual(INTAKE.isWorsening({ text: 'can I take ibuprofen', cls: 'ROUTE', red: false }), false);
  assert.strictEqual(INTAKE.isWorsening({ text: 'can I fly', cls: 'ROUTE', red: false }), false);
  assert.strictEqual(INTAKE.isWorsening({ text: 'my back pain is getting worse at night', cls: 'ROUTE', red: false }), true);
});
check('B a red word (fever) still raises the red banner, not the worsening amber', function () {
  var s = INTAKE.summarise(freeTextWith('fever is getting worse'));
  assert.strictEqual(s.banner.level, 'RED');
});

// ---- C: ms and zh summary text: values, reasons, gaps and to-do titles ----
var ENGLISH_SUMMARY = [/^Not answered:/, /^Unclear answer:/, /^Check: /, /^Blood thinner named\?/, /^Blood thinner reported/,
  /^Patient reports worsening/, /^Clinician decision:/, /^Optimise HbA1c/, /^Anaesthetic review$/, /^MRSA screen/, /^Physio or social/,
  /^Insurance pre-authorisation/, /^Peri-operative antibiotic/, /^Clinician review:/, /^Red flag at intake/, /^Penicillin allergy reported/,
  /^Lives alone with stairs/, /^Medicine list mentions/, /^Patient's words \(auto-triage/, /^Patient's words auto-triaged/, /^\d+ answers missing/,
  /^Blood thinner answer missing/];
['ms', 'zh'].forEach(function (lang) {
  check('C ' + lang + ': every historical summary, reason, gap and to-do title is in ' + lang + ' (no English sentence left)', function () {
    var left = [];
    H.forEach(function (h) {
      var c = Object.assign({}, h, { lang: lang });
      var s = INTAKE.summarise(c), t = INTAKE.todos(c);
      var strings = s.banner.reasons.concat(s.gaps, t.map(function (x) { return x.title; }));
      strings.forEach(function (x) { ENGLISH_SUMMARY.forEach(function (re) { if (re.test(x)) left.push(h.pid + ': ' + x); }); });
    });
    assert.deepStrictEqual(left, [], 'English left');
  });
});
check('C zh: the worsening reason and a gap read in Chinese (FIC-LUM-05, FIC-ACL-03)', function () {
  var s = INTAKE.summarise(Object.assign({}, H.find(function (h) { return h.pid === 'FIC-LUM-05'; }), { lang: 'zh' }));
  assert.ok(s.banner.reasons.indexOf('患者报告症状加重：需临床医生审阅') >= 0, JSON.stringify(s.banner.reasons));
  var a3 = INTAKE.summarise(Object.assign({}, H.find(function (h) { return h.pid === 'FIC-ACL-03'; }), { lang: 'zh' }));
  assert.ok(a3.gaps.some(function (g) { return /^未回答：/.test(g); }), 'zh unanswered gap');
});
check('C ms: values are translated (FIC-TKR-01 smoker and payer)', function () {
  var s = INTAKE.summarise(Object.assign({}, H.find(function (h) { return h.pid === 'FIC-TKR-01'; }), { lang: 'ms' }));
  var lines = s.sections.reduce(function (a, sec) { return a.concat(sec.lines); }, []);
  assert.ok(lines.some(function (l) { return /^Perokok: (ya|tidak) \[smoker\]$/.test(l); }), 'smoker');
  assert.ok(lines.some(function (l) { return /^Pembayar: /.test(l); }), 'payer label');
});
check('C: the English summary for the same history is unchanged in wording', function () {
  var s = INTAKE.summarise(H.find(function (h) { return h.pid === 'FIC-TKR-01'; }));
  var lines = s.sections.reduce(function (a, sec) { return a.concat(sec.lines); }, []);
  assert.ok(lines.some(function (l) { return /^Current medicines: .* \[meds_text\]$/.test(l); }));
  assert.ok(lines.some(function (l) { return /^Smoker: no \[smoker\]$/.test(l) || /^Smoker: yes \[smoker\]$/.test(l); }));
});

var pass = results.filter(function (r) { return r[1]; }).length;
var fails = results.filter(function (r) { return !r[1]; });
results.forEach(function (r) { console.log((r[1] ? 'PASS ' : 'FAIL ') + r[0] + (r[1] ? '' : ' :: ' + r[2])); });
console.log('\n' + pass + ' PASS, ' + (results.length - pass) + ' FAIL');
process.exit(fails.length === 0 ? 0 : 1);
