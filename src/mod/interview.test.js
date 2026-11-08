'use strict';
// Node test for mod/interview.js. Fictional patient only. Run: node mod/interview.test.js
const I = require('./interview.js');

let pass = 0; let fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
const ALL = I.COMMON.concat(...I.PROCEDURES.map(p => I.BY_PROC[p]));
const BANK = {}; ALL.forEach(q => { BANK[q.id] = q; });
const NO = { en: 'no', ms: 'tidak', zh: '否' };
const YES = { en: 'yes', ms: 'ya', zh: '是' };
const TEXT = { en: 'none', ms: 'tiada', zh: '没有' };

// Answer the current question with a plain, language-matched default (types a label, a yes/no word, a number or text).
function defaultAnswer(q, lang) {
  if (q.type === 'yesno') return NO[lang];
  if (q.type === 'choice') return q.options[0].label[lang];
  if (q.type === 'number') return 5;
  return TEXT[lang];
}
function advanceTo(s, id) {
  let guard = 0;
  while (s.current !== id && !I.isComplete(s) && guard++ < 200) {
    s = I.next(s, defaultAnswer(BANK[s.current], s.lang));
  }
  return s;
}
// Scripted run for one fictional patient. Returns the final state, or the first reprompt that stalls the run.
function runScript(procedure, lang, script) {
  let s = I.build(procedure, lang, 'FICT-001'); let guard = 0; const asked = [];
  while (!I.isComplete(s)) {
    if (guard++ > 200) return { ok: false, why: 'no progress', s };
    const id = s.current; const q = BANK[id]; asked.push(id);
    const a = Object.prototype.hasOwnProperty.call(script, id) ? script[id] : defaultAnswer(q, lang);
    s = I.next(s, a);
    if (s.reprompt) return { ok: false, why: 'reprompt at ' + id + ': ' + s.lastError, s };
  }
  return { ok: true, s, asked };
}

// 1. Bank structure
const triplets = ALL.filter(q => ['en', 'ms', 'zh'].some(l => typeof q.text[l] !== 'string' || q.text[l].trim() === ''));
check('every question has non-empty en/ms/zh text (' + ALL.length + ' questions)', triplets.length === 0, triplets.map(q => q.id).join(', '));
const untranslated = ALL.filter(q => q.text.ms === q.text.en || q.text.zh === q.text.en);
check('ms and zh differ from en on every question', untranslated.length === 0, untranslated.map(q => q.id).join(', '));
check('every question carries reviewed:false', ALL.every(q => q.reviewed === false), ALL.filter(q => q.reviewed !== false).map(q => q.id).join(', '));
const ids = ALL.map(q => q.id);
check('question ids are unique', new Set(ids).size === ids.length);
const validTypes = ['yesno', 'choice', 'number', 'text'];
check('every question has a valid type', ALL.every(q => validTypes.includes(q.type)), ALL.filter(q => !validTypes.includes(q.type)).map(q => q.id).join(', '));
const badOpts = ALL.filter(q => q.type === 'choice' && (!Array.isArray(q.options) || q.options.some(o => ['en', 'ms', 'zh'].some(l => !o.label || !o.label[l]))));
check('every choice option has en/ms/zh labels', badOpts.length === 0, badOpts.map(q => q.id).join(', '));
const badFollow = ALL.filter(q => q.followUp && Object.values(q.followUp).some(list => list.some(t => !BANK[t])));
check('every followUp target exists', badFollow.length === 0, badFollow.map(q => q.id).join(', '));
const commonDirect = I.COMMON.filter(q => !Object.values(BANK).some(o => o.followUp && Object.values(o.followUp).some(l => l.includes(q.id)))).length;
check('COMMON has at least 14 directly asked questions (' + commonDirect + ' asked, ' + (I.COMMON.length - commonDirect) + ' conditional follow-ups)', commonDirect >= 14);
I.PROCEDURES.forEach(p => {
  const n = I.BY_PROC[p].length;
  check(p + ' has 3 to 5 procedure-specific questions (' + n + ')', n >= 3 && n <= 5);
});
check('all six procedures are present', I.PROCEDURES.length === 6 && ['TKR', 'THR', 'ACL', 'LUMBAR', 'SHOULDER', 'FOOTANKLE'].every(p => I.PROCEDURES.includes(p)));

// 2. All six procedures build in every language
let buildOk = true; const buildErr = [];
I.PROCEDURES.forEach(p => I.LANGS.forEach(l => {
  try {
    const s = I.build(p, l, 'FICT-000');
    const pr = I.prompt(s);
    if (!pr || !pr.text || I.isComplete(s)) { buildOk = false; buildErr.push(p + '/' + l + ' no first prompt'); }
  } catch (e) { buildOk = false; buildErr.push(p + '/' + l + ' ' + e.message); }
}));
check('all six procedures build in en, ms and zh', buildOk, buildErr.join('; '));
let badBuild = false; try { I.build('UNKNOWN', 'en'); badBuild = false; } catch (e) { badBuild = true; }
check('unknown procedure is rejected', badBuild);

// 3. Scripted run-through of one fictional patient
const tkrScript = {
  sex: 'female', diabetes: YES.en, hba1c: 7.2, blood_thinners: YES.en,
  blood_thinner_detail: 'aspirin 75 mg, last dose yesterday', stairs: 2, home_help: 'family',
  tkr_walk: 'over_500', final_note: 'Nothing else, thank you.'
};
const run = runScript('TKR', 'en', tkrScript);
check('scripted TKR patient (en) completes', run.ok, run.why);
if (run.ok) {
  const a = I.toAnswers(run.s);
  // review1 summary fix (expectation changed): answers are now keyed by the intake ids (blood_thinner, diabetes, hba1c),
  // so the blood-thinner detail is found inside blood_thinner and the raw interview answers stay in interviewAnswers.
  check('scripted run records diabetes, HbA1c and blood-thinner detail', a.answers.diabetes === 'yes' && a.answers.hba1c === 7.2 && typeof a.interviewAnswers.blood_thinner_detail === 'string' && a.answers.blood_thinner.answer === 'yes' && a.answers.blood_thinner.name === a.interviewAnswers.blood_thinner_detail);
  check('scripted run has no red flag', run.s.red === null, JSON.stringify(run.s.red));
  check('toAnswers returns {pid, procedure, lang, answers, freeText}', a.pid === 'FICT-001' && a.procedure === 'TKR' && a.lang === 'en' && Array.isArray(a.freeText) && a.freeText.length >= 2);
}
const runMs = runScript('TKR', 'ms', { sex: 'Perempuan', diabetes: 'Ya', hba1c: 'tidak tahu', blood_thinners: 'Tidak' });
check('scripted TKR patient (ms, typed "Ya"/"Tidak") completes', runMs.ok, runMs.why);
check('ms run stores hba1c "tidak tahu" as unknown', runMs.ok && I.toAnswers(runMs.s).answers.hba1c === 'unknown', runMs.ok ? String(I.toAnswers(runMs.s).answers.hba1c) : runMs.why);
const runZh = runScript('TKR', 'zh', { sex: '女', diabetes: '是', hba1c: '不知道', blood_thinners: '否' });
check('scripted TKR patient (zh, spoken "是"/"否") completes', runZh.ok, runZh.why);
let allScripts = true; const scriptErr = [];
I.PROCEDURES.forEach(p => { const r = runScript(p, 'en', {}); if (!r.ok) { allScripts = false; scriptErr.push(p + ': ' + r.why); } });
check('scripted run completes for all six procedures', allScripts, scriptErr.join('; '));

// 4. Skip logic
const male = runScript('ACL', 'en', { sex: 'male' });
check('pregnancy question is skipped for male patients', male.ok && !male.asked.includes('pregnancy'));
const female = runScript('ACL', 'en', { sex: 'female' });
check('pregnancy question is asked for female patients', female.ok && female.asked.includes('pregnancy'));

// 5. Red-flag free text (every typed answer goes through engine.classify)
let s = I.next(I.build('TKR', 'en'), 'female');
s = I.next(s, 'paracetamol, and I have chest pain since this morning');
check('en free text "chest pain" triggers EMERGENCY', s.red && s.red.level === 'EMERGENCY' && s.flags.includes('chest pain'), JSON.stringify(s.red));
check('EMERGENCY flag carries a non-empty engine reply', !!(s.red && s.red.reply));
check('interview continues after a red flag', !I.isComplete(s) && s.current !== null);

s = I.next(I.build('TKR', 'ms'), 'perempuan');
s = I.next(s, 'Saya ambil parasetamol, saya ada sakit dada sejak pagi');
check('ms free text "sakit dada" triggers EMERGENCY', s.red && s.red.level === 'EMERGENCY', JSON.stringify(s.red));

s = I.next(I.build('TKR', 'zh'), '女');
s = I.next(s, '我服用对乙酰氨基酚，今天早上开始胸口痛');
check('zh free text "胸口痛" triggers EMERGENCY', s.red && s.red.level === 'EMERGENCY', JSON.stringify(s.red));

s = I.next(I.build('TKR', 'en'), 'female');
s = I.next(s, 'paracetamol only, no chest pain');
check('negated free text does not trigger a red flag (control)', s.red === null, JSON.stringify(s.red));

s = I.next(I.build('TKR', 'en'), 'female');
s = I.next(s, 'paracetamol, fever 38.5 since last night');
check('free text fever 38.5 triggers SAME-DAY', s.red && s.red.level === 'SAME-DAY', JSON.stringify(s.red));

s = I.next(I.build('LUMBAR', 'en'), 'male');
s = I.next(s, 'I cannot control my bladder when I cough');
check('LUMBAR free text on bladder control triggers EMERGENCY (procedure pack via global cauda rule)', s.red && s.red.level === 'EMERGENCY', JSON.stringify(s.red));

// 6. Question-level red flags
let lumbar = advanceTo(I.build('LUMBAR', 'en'), 'lum_bladder');
lumbar = I.next(lumbar, 'yes');
check('LUMBAR bladder/bowel "yes" flags EMERGENCY with reply', lumbar.red && lumbar.red.level === 'EMERGENCY' && lumbar.red.reply.length > 0 && lumbar.flags.includes('lum_bladder'), JSON.stringify(lumbar.red));
let saddle = advanceTo(I.build('LUMBAR', 'zh'), 'lum_saddle');
saddle = I.next(saddle, '是');
check('LUMBAR saddle numbness "是" (zh) flags EMERGENCY', saddle.red && saddle.red.level === 'EMERGENCY' && saddle.red.reply.length > 0);
let calf = advanceTo(I.build('TKR', 'en'), 'tkr_calf');
calf = I.next(calf, 'yes');
check('TKR calf pain "yes" flags SAME-DAY with reply', calf.red && calf.red.level === 'SAME-DAY' && calf.red.reply.length > 0);
let legWeak = advanceTo(I.build('LUMBAR', 'ms'), 'lum_leg_weak');
legWeak = I.next(legWeak, 'tidak');
check('LUMBAR leg weakness "tidak" does not flag', legWeak.red === null);

// 7. Input handling
let p = advanceTo(I.build('TKR', 'en'), 'diabetes');
const before = p.current;
const after = I.next(p, 'perhaps');
check('unrecognised yes/no reprompts without advancing', after.reprompt === true && after.current === before && after.answers.diabetes === undefined);
const badNum = I.next(advanceTo(I.build('TKR', 'en'), 'hba1c'), '42');
check('out-of-range HbA1c reprompts', badNum.reprompt === true);
const eng = I.next(I.build('TKR', 'en'), 'female');
check('prompt() returns localised text and draft flag', (() => { const pr = I.prompt(I.build('TKR', 'ms')); return pr && pr.draft === true && pr.text.length > 0; })() && I.prompt(eng).draft === false);
check('isComplete is false on a fresh build', !I.isComplete(I.build('FOOTANKLE', 'en')));

console.log('\n' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
