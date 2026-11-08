'use strict';
const path = require('path');
const intake = require('./intake.js');
const eng = require('../engine.js');
const H = require(path.join(__dirname, 'histories.json'));

const LABEL = 'Patient-reported, clinician to verify';
const OWNERS = ['surgeon', 'anaesthetist', 'preop_nurse', 'ward_nurse', 'physio', 'pharmacy', 'clinic_coordinator', 'clinician'];
const VOCAB = Object.keys(intake.Q);
const LUMBAR = ['lumbar_bladder_bowel_change', 'lumbar_saddle_numbness', 'lumbar_leg_weakness'];
const ANAES = ['anaesthetic_problem', 'heart_disease', 'lung_disease', 'kidney_disease', 'smoker'];
const RISK = ['blood_thinner', 'diabetes', 'heart_disease', 'lung_disease', 'kidney_disease', 'anaesthetic_problem', 'smoker',
  'penicillin_allergy', 'latex_allergy', 'mrsa_or_admission_past_year', 'lives_alone', 'stairs_home', 'mobility_aid'].concat(LUMBAR);

let pass = 0, fail = 0; const fails = [];
const isMissing = v => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
function check(name, ok, detail) { if (ok) pass++; else { fail++; fails.push(name + (detail ? ' :: ' + detail : '')); } }
const txt = v => (v && typeof v === 'object' && !Array.isArray(v)) ? String(v.answer == null ? '' : v.answer).trim().toLowerCase() : String(v == null ? '' : v).trim().toLowerCase();
const isYes = v => txt(v) === 'yes';
const bloodYes = a => txt(a.blood_thinner) === 'yes';
const num = v => (typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN));
const hba1cHigh = a => isFinite(num(a.hba1c)) && num(a.hba1c) >= eng.THRESH.HbA1c.ge;
// Expected display words per language, written out by hand (independent of intake.js). Free text and numbers are shown as given.
const SHOWN = {
  yes: { en: 'yes', ms: 'ya', zh: '\u662f' }, no: { en: 'no', ms: 'tidak', zh: '\u5426' },
  payer: { ms: { self: 'bayar sendiri', employer: 'skim syarikat majikan', insurance: 'insurans swasta', government: 'skim kerajaan', other: 'lain-lain' },
    zh: { self: '\u81ea\u8d39', employer: '\u96c7\u4e3b\u6216\u516c\u53f8\u8ba1\u5212', insurance: '\u79c1\u4eba\u4fdd\u9669', government: '\u653f\u5e9c\u8ba1\u5212', other: '\u5176\u4ed6' } },
  preferred_language: { ms: { en: 'Bahasa Inggeris', ms: 'Bahasa Malaysia', zh: 'Bahasa Cina' }, zh: { en: '\u82f1\u6587', ms: '\u9a6c\u6765\u6587', zh: '\u4e2d\u6587' } },
  allergy_text: { ms: { 'none known': 'tiada diketahui' }, zh: { 'none known': '\u65e0\u5df2\u77e5\u8fc7\u654f' } }
};
const YN_FIELDS = ['penicillin_allergy', 'latex_allergy', 'diabetes', 'heart_disease', 'lung_disease', 'kidney_disease',
  'anaesthetic_problem', 'smoker', 'prior_surgery_same_joint', 'mrsa_or_admission_past_year', 'lives_alone', 'stairs_home',
  'mobility_aid', 'night_pain', 'prior_injections', 'blood_thinner', 'lumbar_leg_weakness', 'lumbar_bladder_bowel_change', 'lumbar_saddle_numbness'];
function expectedShown(id, raw, lang) {
  if (lang === 'en') return raw;
  if (YN_FIELDS.includes(id) && (raw === 'yes' || raw === 'no')) return SHOWN.yes[lang] && raw === 'yes' ? SHOWN.yes[lang] : SHOWN.no[lang];
  if (SHOWN[id] && SHOWN[id][lang] && SHOWN[id][lang][raw] !== undefined) return SHOWN[id][lang][raw];
  if (id === 'blood_thinner' && raw.indexOf(', ') >= 0) return SHOWN.yes[lang] + raw.slice(raw.indexOf(','));
  return raw;
}
const redFt = c => (c.freeText || []).map((t, i) => ({ i, cls: eng.classify(t, { procedure: c.procedure }).cls })).filter(x => x.cls === 'EMERGENCY' || x.cls === 'SAME-DAY');

// independent expectations: re-derived from the rules in the brief, not from intake.js
function expectedTodoKeys(c) {
  const a = c.answers, keys = new Set();
  if (bloodYes(a)) keys.add('anticoag_decision');
  if (hba1cHigh(a)) keys.add('optimise_hba1c');
  if (ANAES.some(id => isYes(a[id]))) keys.add('anaesthetic_review');
  if (isYes(a.penicillin_allergy) || penConflict(c)) keys.add('antibiotic_plan'); // round 4: see penConflict
  if (isYes(a.mrsa_or_admission_past_year)) keys.add('mrsa_screen');
  if (['lives_alone', 'stairs_home', 'mobility_aid'].some(id => isYes(a[id]))) keys.add('physio_social_review');
  if (txt(a.payer) === 'insurance') keys.add('preauth');
  // review1 item 9 (expectation changed): a red flag from a lumbar answer or from free text produces ONE urgent
  // clinician task per patient, key intake_red_flag, not one task per trigger. Same task whether raised at intake or by a sample.
  if (redExpected(c)) keys.add('intake_red_flag');
  // review1 item 10 (expectation added): patient words classified ROUTE for clinical judgement or a worsening trend
  // need a clinician review within 48 h. Worsening night pain is a symptom that needs a clinician, not a guess.
  // round 3 B (expectation changed): a worsening amber needs a symptom word AND a worsening word in the patient's own text.
  // Medicine names and flight questions do not count. Rule written out here, not read from intake.js.
  if ((c.freeText || []).some(t => { const r = eng.classify(t, { procedure: c.procedure, mode: 'intake' }); return !r.red && worseningWords(t); })) keys.add('clinician_review_worsening');
  if (btConflictExpected(c) && !bloodYes(a)) keys.add('anticoag_decision');
  return keys;
}
// review1 B2 (fixed): hand-written expect labels that encoded the old NONE-with-gaps behaviour.
// They are re-labelled here, with the reason, instead of silently changing the history data.
const EXPECT_B2 = {
  'FIC-ACL-04': 'AMBER',      // blood_thinner "no" but meds_text names warfarin: contradiction is AMBER, never NONE
  'FIC-ACL-03': 'INCOMPLETE', // blood_thinner unanswered and 19 gaps: never NONE
  'FIC-TKR-03': 'INCOMPLETE', // 16 gaps: more than 6 gaps is never NONE
  // review1 item 10 (expectation changed): "my back pain is getting worse at night" is classified ROUTE with the
  // worsening-trend flag. A worsening symptom needs clinician review before surgery: AMBER, never NONE.
  'FIC-LUM-05': 'AMBER',
  // round 4 (expectation changed, FIC-TKR-04): penicillin named in allergy_text against a "no" box is an unresolved allergy
  // contradiction, shown as AMBER for clinician check. Never NONE, because a missed penicillin allergy is a safety risk.
  'FIC-TKR-04': 'AMBER',
  // round 4 (expectation changed, FIC-SHO-05): penicillin_allergy "maybe" is an unclear allergy answer, not a clear "no".
  // Unanswered allergy items are gaps, so the banner is INCOMPLETE, never NONE.
  'FIC-SHO-05': 'INCOMPLETE'
};
const expectLevel = c => EXPECT_B2[c.pid] || c.expect;
// round 4 (expectation changed, FIC-TKR-04): the typed allergy text names penicillin ("penicillin rash as a child") while the
// penicillin_allergy box says "no". Clinically a reported penicillin rash is treated as an allergy until a clinician clears it,
// so the expected shown value is "yes" and an antibiotic plan is needed. Rule written out here, not read from intake.js.
const PEN_TEXT = /penicillin|penisilin|amoxicillin|amoksisilin|青霉素|阿莫西林/i;
const penConflict = c => PEN_TEXT.test(String(c.answers.allergy_text || '')) && !isYes(c.answers.penicillin_allergy) && !/no known|none known|tiada diketahui|无已知/i.test(String(c.answers.allergy_text || ''));
// Independent rule for the B2 contradiction: a blood-thinner name in meds_text or free text, with the answer not "yes".
const BT_NAME = /warfarin|rivaroxaban|apixaban|dabigatran|edoxaban|enoxaparin|clexane|aspirin|clopidogrel|xarelto|eliquis|marevan|coumadin/i;
const btConflictExpected = c => (BT_NAME.test(String(c.answers.meds_text || '')) || (c.freeText || []).some(t => BT_NAME.test(String(t)))) && !bloodYes(c.answers);
const SYM = /\b(pain|swelling|swollen|numbness|numb|weakness|fever|discharge|bleeding|redness|tingling|sore|lump|rash)\b|sakit|bengkak|kebas|demam|\u75db|\u80bf|\u9ebb\u6728|\u53d1\u70e7/i;
const WRS = /\bworse\b|\bworsening\b|\bincreasing\b|\bgetting worse\b|\bmore (pain|swelling|numb|weak|fever)\b|semakin teruk|lebih teruk|\u8d8a\u6765\u8d8a|\u52a0\u91cd|\u66f4\u4e25\u91cd/i;
const worseningWords = t => SYM.test(t) && WRS.test(t);
const redExpected = c => LUMBAR.some(id => isYes(c.answers[id])) || redFt(c).length > 0;
const hasWord = (text, id) => new RegExp('\\b' + id + '\\b').test(text);

for (const c of H) {
  const tag = c.pid;
  let s, t;
  try { s = intake.summarise(c); t = intake.todos(c); } catch (e) { check(tag + ' runs', false, e.message); continue; }
  const a = c.answers, ft = c.freeText || [];
  const lines = s.sections.flatMap(sec => sec.lines);
  const reasons = s.banner.reasons;

  // 1. shape and label
  const shapeOk = Array.isArray(s.sections) && s.sections.every(sec => typeof sec.title === 'string' && Array.isArray(sec.lines)) &&
    ['RED', 'AMBER', 'INCOMPLETE', 'NONE'].includes(s.banner.level) && Array.isArray(s.gaps) && s.label === LABEL;
  check(tag + ' summary shape and label', shapeOk);

  // 2. nothing invented: each line shows exactly the input value it cites
  const inv = [];
  for (const line of lines) {
    // round 3: ms and zh labels use a full-width colon and no space after it; the value and the id are unchanged
    const m = line.match(/^(.+?)[:：]\s?(.*) \[([^\]]+)\]$/);
    if (!m) { inv.push('unparsed: ' + line); continue; }
    const value = m[2], cite = m[3];
    if (cite.startsWith('freeText.')) {
      const i = Number(cite.split('.')[1]);
      if (!(i in ft)) { inv.push('bad freeText index ' + cite); continue; }
      if (value.replace(/^"|"$/g, '') !== String(ft[i]).trim()) inv.push('free text altered ' + cite);
      const auto = (m[1].match(/auto-triage (\w[\w-]*)|\u81ea\u52a8\u5206\u7ea7 (\w[\w-]*)/) || []).slice(1).find(Boolean);
      if (auto !== eng.classify(ft[i], { procedure: c.procedure }).cls) inv.push('triage mismatch ' + cite);
      continue;
    }
    if (a[cite] === undefined || a[cite] === null || String(a[cite]).trim() === '') { inv.push('cites unanswered ' + cite); continue; }
    let expected = String(a[cite] && typeof a[cite] === 'object' ? a[cite].answer : a[cite]).trim();
    if (cite === 'penicillin_allergy' && penConflict(c)) expected = 'yes'; // round 4: see penConflict
    if (cite === 'blood_thinner' && bloodYes(a) && a[cite].name) expected += ', ' + String(a[cite].name).trim();
    // round 3 (C): ms and zh show translated yes/no and fixed values. The expected words are written out here, not read from intake.js.
    const want = expectedShown(cite, expected, c.lang);
    if (value.toLowerCase() !== want.toLowerCase()) inv.push(`${cite}: shown "${value}" vs expected "${want}" (input "${expected}")`);
  }
  check(tag + ' nothing invented', inv.length === 0, inv.join('; '));

  // 3. unanswered items (lumbar only for LUMBAR) go to gaps, not into lines
  const needed = VOCAB.filter(id => !(LUMBAR.includes(id) && c.procedure !== 'LUMBAR'));
  const missing = needed.filter(id => a[id] === undefined || a[id] === null || String(a[id]).trim() === '');
  const notInGaps = missing.filter(id => !s.gaps.some(g => g.endsWith(`(${id})`)));
  check(tag + ' unanswered go to gaps', notInGaps.length === 0, notInGaps.join(', '));

  // 4. nothing dropped: every positive risk answer appears in summary or todos; red free text appears in banner
  const summaryText = reasons.concat(lines).join('\n');
  const todoText = t.map(x => x.reason).join(' ');
  const pos = RISK.filter(id => isYes(a[id]));
  if (bloodYes(a) && !pos.includes('blood_thinner')) pos.push('blood_thinner');
  if (hba1cHigh(a)) pos.push('hba1c');
  if (txt(a.payer) === 'insurance') pos.push('payer');
  const dropped = pos.filter(id => !hasWord(summaryText, id) && !hasWord(todoText, id));
  redFt(c).forEach(x => { if (!reasons.some(r => r.includes(`[freeText.${x.i}]`))) dropped.push('freeText.' + x.i); });
  check(tag + ' nothing dropped', dropped.length === 0, dropped.join(', '));

  // 5. banner level as hand-labelled, and RED exactly when a lumbar or urgent free-text trigger is present
  check(tag + ' banner = ' + expectLevel(c), s.banner.level === expectLevel(c), 'got ' + s.banner.level);
  // B2: NONE is never shown when the blood-thinner answer is missing or contradicts the medicine list, or when more than 6 gaps
  if (s.banner.level === 'NONE') check(tag + ' NONE only when clear', !btConflictExpected(c) && !isMissing(a.blood_thinner) && s.gaps.length <= 6, 'NONE with gaps ' + s.gaps.length);
  if (btConflictExpected(c)) check(tag + ' blood-thinner conflict is AMBER', s.banner.level === 'AMBER' || s.banner.level === 'RED', 'got ' + s.banner.level);
  check(tag + ' RED iff red trigger', (s.banner.level === 'RED') === redExpected(c), 'got ' + s.banner.level);

  // 6. todos follow the rules exactly, and are well formed
  const want = expectedTodoKeys(c), got = new Set(t.map(x => x.key));
  const same = want.size === got.size && [...want].every(k => got.has(k));
  check(tag + ' todo rules', same, `want [${[...want]}] got [${[...got]}]`);
  const wellFormed = t.every(x => typeof x.key === 'string' && typeof x.title === 'string' && OWNERS.includes(x.owner) &&
    typeof x.dueDays === 'number' && typeof x.kind === 'string' && typeof x.reason === 'string' && x.reason.length > 0 && typeof x.needsClinician === 'boolean');
  check(tag + ' todos well formed', wellFormed);
}

// unit checks
const empty = intake.summarise({});
check('empty input: never NONE (INCOMPLETE), gaps listed, no throw', empty.banner.level === 'INCOMPLETE' && empty.gaps.length > 0);
const conflictLevel = intake.summarise({ procedure: 'ACL', answers: { meds_text: 'warfarin 3 mg at night', blood_thinner: 'no' } }).banner.level;
check('contradiction (meds names warfarin, answer no) is AMBER', conflictLevel === 'AMBER', 'got ' + conflictLevel);
const missingBT = intake.summarise({ procedure: 'ACL', answers: { meds_text: 'paracetamol' } });
check('blood thinner unanswered is INCOMPLETE, not NONE', missingBT.banner.level === 'INCOMPLETE', 'got ' + missingBT.banner.level);
const conflictTodo = intake.todos({ procedure: 'ACL', answers: { meds_text: 'warfarin 3 mg at night', blood_thinner: 'no' } });
check('contradiction generates the clinician-decision to-do', conflictTodo.some(x => x.key === 'anticoag_decision' && x.needsClinician && x.owner === 'surgeon'));
const sim = new eng.Sim();
sim.addPatient({ id: 'FIC-UNIT-01', procedure: 'TKR', surgeryIn: 10 });
const list = intake.todos(H[1]);
const first = intake.toTasks(sim, 'FIC-UNIT-01', list);
const again = intake.toTasks(sim, 'FIC-UNIT-01', list);
check('toTasks adds one engine task per todo', first.length === list.length && sim.tasks.filter(x => x.pid === 'FIC-UNIT-01').length === list.length, `made ${first.length} of ${list.length}`);
check('toTasks is idempotent', again.length === 0);
check('toTasks carries owner, reason and needsClinician', first.every(x => OWNERS.includes(x.owner) && typeof x.needsClinician === 'boolean' && x.reason));

const total = pass + fail;
fails.forEach(f => console.log('FAIL ' + f));
console.log(`\nPASS ${pass}  FAIL ${fail}  (of ${total} checks: ${H.length} histories x 9 + 4 unit checks)`);
process.exit(fail === 0 ? 0 : 1);
