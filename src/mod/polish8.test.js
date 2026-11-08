'use strict';
// Polish regression tests (round 8, hC builder): typed-text masking, "I don't know" on choices, out-of-range wording,
// Malay, Chinese and Arabic hand-off text, and the friendly source labels wiring.
// Run: node mod/polish8.test.js   Fictional data only.
const fs = require('fs');
const path = require('path');
const I = require('./interview.js');
const IN = require('./intake.js');
const E = require('../engine.js');
const IDMAP = require('./idmap.js');
const MASK_TOKEN = '[number removed]';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? ' :: ' + JSON.stringify(detail) : '')); }
}
const SRC = fs.readFileSync(path.join(__dirname, '..', 'src.html'), 'utf8');

// ---- 1. Masking (typed text) ----
const M = I.maskTyped;
check('the spec example: phone run masked, words kept', M('calf swollen call me 012-3456789') === 'calf swollen call me [number removed]', M('calf swollen call me 012-3456789'));
check('Malaysian mobile with +60 and spaces and dash', M('call +60 12-345 6789 please') === 'call [number removed] please', M('call +60 12-345 6789 please'));
check('Gulf number with +971 and spaces', M('+971 50 123 4567') === '[number removed]', M('+971 50 123 4567'));
check('UK number with a space', M('07700 900123') === '[number removed]', M('07700 900123'));
check('an IC-shaped 12-digit run (######-##-####)', M('my IC 900101-14-5678 here') === 'my IC [number removed] here', M('my IC 900101-14-5678 here'));
check('a plain 12-digit run', M('ic 900101145678') === 'ic [number removed]', M('ic 900101145678'));
check('doses are not masked', M('paracetamol 500 mg twice, 2 tablets') === 'paracetamol 500 mg twice, 2 tablets', M('paracetamol 500 mg twice, 2 tablets'));
check('HbA1c and decimals are not masked', M('HbA1c 9.1 and 12.5') === 'HbA1c 9.1 and 12.5', M('HbA1c 9.1 and 12.5'));
check('a decimal with eight digits is not masked', M('reading 9.12345678') === 'reading 9.12345678', M('reading 9.12345678'));
check('an ISO date is not masked', M('op on 2026-11-08 at 9') === 'op on 2026-11-08 at 9', M('op on 2026-11-08 at 9'));
check('a day-first date is not masked', M('dd 08-11-2026') === 'dd 08-11-2026', M('dd 08-11-2026'));
check('a short space-separated list is not masked', M('1 2 3 4 5 6 7 8') === '1 2 3 4 5 6 7 8', M('1 2 3 4 5 6 7 8'));
check('Arabic-Indic digits count as digits', M('اتصل ٠١٢-٣٤٥٦٧٨٩ الآن') === 'اتصل [number removed] الآن', M('اتصل ٠١٢-٣٤٥٦٧٨٩ الآن'));
check('full-width digits count as digits', M('call ０１２３４５６７８９') === 'call [number removed]', M('call ０１２３４５６７８９'));
check('text with no digits is unchanged', M('Does it hurt when I walk?') === 'Does it hurt when I walk?');
check('empty and null inputs are safe', M('') === '' && M(null) === '' && M(undefined) === '');
check('maskDeep masks every string in a sample history', JSON.stringify(I.maskDeep({ a: 'call 012-3456789', b: ['x 012-3456789'], n: 5 })) === JSON.stringify({ a: 'call [number removed]', b: ['x [number removed]'], n: 5 }));

// The red-flag engine sees the original meaning: masking never changes the class of these phrases.
const phrases = [
  'calf swollen call me 012-3456789', 'chest pain, call me on +60 12-345 6789', 'I cannot feel when I pass urine, ring 07700 900123',
  'my wound is wet and hot, my number is 012-3456789', 'Kaki kiri saya bengkak, hubungi 012-3456789', '手术后伤口有点红，电话 012-3456789',
  'I need to stop my blood thinner, call 012-3456789', 'can I shower tomorrow? 012-3456789'
];
phrases.forEach(p => {
  const a = E.classify(p, { procedure: 'TKR', mode: 'intake' }).cls;
  const b = E.classify(M(p), { procedure: 'TKR', mode: 'intake' }).cls;
  check('masking keeps the class (' + a + ') for: ' + p, a === b, { original: a, masked: b, text: M(p) });
});
check('the spec example is still SAME-DAY on the original text', E.classify('calf swollen call me 012-3456789', { procedure: 'TKR', mode: 'intake' }).cls === 'SAME-DAY');

// ---- 2. Interview: typed text is classified on the original and stored masked ----
(function () {
  let s = I.build('TKR', 'en', 'P-MASK');
  const plan = { sex: 'female', medicines: 'none', blood_thinners: 'no', allergies: 'no', diabetes: 'no', hba1c: 'unknown', heart_lung: 'no', kidney: 'no', anaesthetic: 'no', smoking: 'never', alcohol: 'none', same_joint: 'no', hospital_mrsa: 'no', pregnancy: 'no' };
  let guard = 0;
  while (!s.done && guard++ < 60 && s.current !== 'final_note') {
    const v = plan[s.current];
    s = I.next(s, v === undefined ? defaultFor(s.current) : v);
    if (s.reprompt) break;
  }
  check('the interview reaches the free-text question', s.current === 'final_note', s.current);
  s = I.next(s, 'calf swollen call me 012-3456789');
  check('the typed red flag is still SAME-DAY', !!s.red && s.red.level === 'SAME-DAY', s.red);
  check('the stored free text is masked', s.freeText[s.freeText.length - 1] === 'calf swollen call me [number removed]' && s.freeText.every(t => t.indexOf('012-3456789') < 0), s.freeText);
  check('the stored answer is masked', s.answers.final_note === 'calf swollen call me [number removed]', s.answers.final_note);
  check('no state field keeps the digits', JSON.stringify(s).indexOf('012-3456789') < 0);
  check('a free-text route keeps the masked text', s.routeFlags.every(r => r.text.indexOf('012-3456789') < 0));
})();
function defaultFor(qid) {
  const q = I.BANK[qid];
  if (!q) return 'nothing';
  if (q.type === 'yesno') return 'no';
  if (q.type === 'choice') return q.options[0].value;
  if (q.type === 'number') return '5';
  return 'nothing';
}

// ---- 3. "I don't know" on a choice question is recorded as unknown, never as a forced option ----
(function () {
  const s0 = I.build('THR', 'en', 'P-UNK');
  // walk to the sex question (the first choice), then answer with the unknown words typed
  const sex = s0; // sex is the first question of every procedure
  check('the first question is a choice', I.BANK[sex.current].type === 'choice', I.BANK[sex.current].type);
  const s1 = I.next(sex, "I don't know");
  check('typed "I don\'t know" on a choice is accepted, not reprompted', !s1.reprompt && s1.answers.sex === 'unknown', { reprompt: s1.reprompt, answers: s1.answers });
  const s2 = I.next(I.build('THR', 'en', 'P-UNK2'), 'Unknown / not sure');
  check('the unknown chip label is accepted', s2.answers.sex === 'unknown', s2.answers);
  const s3 = I.next(I.build('THR', 'en', 'P-UNK3'), 'Prefer not to say');
  check('an exact option still wins over the unknown words', s3.answers.sex === 'prefer_not', s3.answers);
  // "Not sure yet" is an option on home_help, so it stays the option
  let h = I.build('TKR', 'en', 'P-HH');
  while (h.current !== 'home_help' && !h.done && h.current) h = I.next(h, defaultFor(h.current));
  const h2 = I.next(h, 'Not sure yet');
  check('"Not sure yet" on home_help stays the unsure option', h2.answers.home_help === 'unsure', h2.answers);
  const h3 = I.next(h, 'unknown');
  check('the unknown answer on home_help is recorded as unknown', h3.answers.home_help === 'unknown', h3.answers);
  const pr = I.prompt(h);
  check('a choice prompt offers an unknown option in the page', !!pr && pr.type === 'choice', pr);
})();
check('the page offers the unknown chip on choice prompts (renderPrompt includes choice)', /p\.type==='choice'\)\)\{var ub/.test(SRC) || /p\.type==='choice'\){var ub/.test(SRC) || /p\.type===\x27choice\x27\)\{var ub/.test(SRC), 'pattern not found');

// Summary: an unknown answer is a gap, never a yes, no or option
(function () {
  let s = I.build('TKR', 'en', 'P-SUM');
  let guard = 0;
  while (!s.done && guard++ < 80) {
    const v = s.current === 'smoking' || s.current === 'alcohol' ? 'unknown' : defaultFor(s.current);
    s = I.next(s, v);
    if (s.reprompt) break;
  }
  check('the interview finishes with unknown choices', s.done === true, { current: s.current, reprompt: s.reprompt });
  const ans = I.toAnswers(s);
  check('the smoker field is unknown, not no', ans.answers.smoker === 'unknown', ans.answers.smoker);
  check('the alcohol field is unknown', ans.answers.alcohol === 'unknown', ans.answers.alcohol);
  const sum = IN.summarise(ans);
  check('the summary lists "Patient does not know" for smoker under gaps', sum.gaps.some(g => /Patient does not know: Smoker \(smoker\)/.test(g)), sum.gaps);
  check('the summary is INCOMPLETE, never NONE, with an unknown gap', sum.banner.level !== 'NONE', sum.banner.level);
  const lines = sum.sections.map(x => x.lines).reduce((a, b) => a.concat(b), []);
  check('the summary line shows unknown, not no', lines.some(l => /Smoker: unknown \[smoker\]/.test(l)), lines.filter(l => /Smoker/.test(l)));
})();
check('an unknown mobility aid is recorded as unknown, never yes', IDMAP.toIntake({ mobility_aid: 'unknown' }, 'TKR').mobility_aid === 'unknown', IDMAP.toIntake({ mobility_aid: 'unknown' }, 'TKR'));
check('a known mobility aid still maps (none -> no, stick -> yes)', IDMAP.toIntake({ mobility_aid: 'none' }, 'TKR').mobility_aid === 'no' && IDMAP.toIntake({ mobility_aid: 'stick' }, 'TKR').mobility_aid === 'yes');
check('an unknown stairs answer is recorded as unknown, never no', IDMAP.toIntake({ stairs: 'unknown' }, 'TKR').stairs_home === 'unknown', IDMAP.toIntake({ stairs: 'unknown' }, 'TKR'));
check('a yes/no unknown is also a gap (diabetes)', (function () {
  const ia = { diabetes: 'unknown', medicines: 'none' };
  const m = IDMAP.toIntake(ia, 'TKR');
  return m.diabetes === 'unknown' && m.hba1c === undefined;
})(), IDMAP.toIntake({ diabetes: 'unknown' }, 'TKR'));
check('idmap: an unknown allergy answer feeds every allergy field as unknown', (function () {
  const m = IDMAP.toIntake({ allergies: 'unknown' }, 'TKR');
  return m.allergy_text === 'unknown' && m.penicillin_allergy === 'unknown' && m.latex_allergy === 'unknown';
})(), IDMAP.toIntake({ allergies: 'unknown' }, 'TKR'));

// ---- 4. Out-of-range numbers name the value and ask for a re-check ----
(function () {
  let s = I.build('TKR', 'en', 'P-RANGE');
  let guard = 0;
  while (s.current !== 'hba1c' && !s.done && guard++ < 60) s = I.next(s, defaultFor(s.current));
  check('the interview reaches hba1c', s.current === 'hba1c', s.current);
  const bad = I.next(s, '99');
  check('HbA1c 99 is refused (reprompt), not recorded', bad.reprompt === true && bad.answers.hba1c === undefined, { reprompt: bad.reprompt, answers: bad.answers });
  check('HbA1c 99 gets a range message, not the generic one', typeof bad.rangeMsg === 'string' && bad.rangeMsg.indexOf('looks wrong') >= 0, bad.rangeMsg);
  check('the range message names the value, the range and the care team', /HbA1c 99 looks wrong.*3 to 20.*care team/.test(bad.rangeMsg || ''), bad.rangeMsg);
  check('the generic reprompt text is not used for HbA1c 99', (bad.rangeMsg || '').indexOf('I did not understand') < 0);
  const ok = I.next(bad, '9.1');
  check('a valid value after the refusal is accepted and clears the range message', ok.answers.hba1c === 9.1 && ok.rangeMsg === null, { a: ok.answers.hba1c, m: ok.rangeMsg });
  const bad2 = I.next(s, '2');
  check('a value under the minimum gets the range message too', /2 looks wrong/.test(bad2.rangeMsg || ''), bad2.rangeMsg);
  const txt = I.next(s, 'unrecognisable words');
  check('a non-number on a number question keeps the generic reprompt', txt.reprompt === true && txt.rangeMsg === null, txt.rangeMsg);
})();
check('range text exists in ms, zh and ar', ['ms', 'zh', 'ar'].every(l => /looks wrong|nampak tidak betul|看起来不正确|غير صحيح/.test(I.rangeText(l, 'hba1c', 99, { min: 3, max: 20 }))));

// ---- 5. Hand-off text in Malay, Chinese and Arabic (page strings) ----
check('the page has Malay and Chinese hand-off strings for created and duplicate tasks', /Tugas dicipta di papan kakitangan/.test(SRC) && /已在员工看板创建任务/.test(SRC) && /员工看板上已有相同问题/.test(SRC) && /Sudah ada di papan kakitangan/.test(SRC));
check('the page has Malay and Chinese no-source lines', /Tiada sumber yang diluluskan/.test(SRC) && /当前情境下没有已批准的来源/.test(SRC));
check('new Arabic strings in the page are marked as drafts', /مسودة آلية/.test(SRC));

// ---- 6. Wiring (page source checks) ----
check('the demo notice is on the typed box, the Ask box, the sample area and the phone (4 places)', (SRC.match(/class="demo-note">Demo only\. Don't type real names, phone numbers or IC numbers\.<\/div>/g) || []).length === 4);
check('the Arabic notice is translated through CHROME_AR', SRC.indexOf('للعرض فقط. لا تكتب أسماء حقيقية') >= 0);
check('the answer path masks the typed text before it is echoed, stored, sent or shown', /var text=IV\.maskTyped\(typed\)/.test(SRC) && /addMsg\('me',IV\.maskTyped\(label\|\|typed\)\)/.test(SRC));
check('the Ask box masks the question before it is answered or stored', /q=IV\?IV\.maskTyped\(q\)/.test(SRC));
check('the phone masks the message before it is sent', /text=maskIn\(text\);var pid=cur/.test(SRC));
check('sample text is masked before it is summarised', /ans=IV\.maskDeep\(ans\)/.test(SRC));
check('friendly labels: the tag carries the raw id only in title', /<span class="srcx" title="'\+esc\(ids\.join/.test(SRC) || /title="'\+esc\(ids\.join\(', '\)\)\+'"/.test(SRC));
check('the Show sources toggle markup is unchanged', /data-in-act="src" aria-pressed/.test(SRC) && /\.srcx\{display:none/.test(SRC));
check('tap targets: buttons, selects and text inputs are at least 44px high', /button,select,input\[type=text\],input\[type=number\]\{min-height:44px\}/.test(SRC));
check('tap targets: the settings summary is at least 44px high', /details>summary\{min-height:44px/.test(SRC));

// ---- 7. Round 8 (judge items 1 to 6): masking edge cases, red-flag unknowns, choice unknowns, notice and token wiring ----
// Masking: spaced single digits, dotted and en-dash phone formats; clinical numbers and dates stay
check('spaced single digits starting with 0 are masked', M('0 1 2 3 4 5 6 7 8 9') === MASK_TOKEN, M('0 1 2 3 4 5 6 7 8 9'));
// judge round 2: ten single spaced digits are a phone number whatever the first digit; short clinical lists are still not masked
check('ten spaced single digits starting with 1 are masked', M('1 2 3 4 5 6 7 8 9 0') === MASK_TOKEN, M('1 2 3 4 5 6 7 8 9 0'));
['1 2 3 4 5', 'BP 120 80', 'pain scores 1 2 3 4 5 6 7 8 9 10', 'took 1 2 3 tablets', 'sets of 10 12 15'].forEach(t => check('clinical list not masked: ' + t, M(t) === t, M(t)));
check('dotted phone 012.345.6789 is masked', M('call 012.345.6789') === 'call ' + MASK_TOKEN, M('call 012.345.6789'));
check('en-dash phone 012–345–6789 is masked', M('call 012–345–6789') === 'call ' + MASK_TOKEN, M('call 012–345–6789'));
check('em-dash phone 012—345—6789 is masked', M('call 012—345—6789') === 'call ' + MASK_TOKEN, M('call 012—345—6789'));
[['HbA1c 7.2', 'HbA1c 7.2'], ['weight 82 kg', 'weight 82 kg'], ['BP 120/80', 'BP 120/80'], ['dob 15-03-2008', 'dob 15-03-2008'],
  ['dotted date 15.03.2008', 'dotted date 15.03.2008'], ['slashed date 15/03/2008', 'slashed date 15/03/2008'], ['ISO 2026-11-08', 'ISO 2026-11-08'],
  ['pain 8/10', 'pain 8/10'], ['1.2345678 units', '1.2345678 units'], ['500 mg twice', '500 mg twice'],
  ['RN 12345678', 'RN 12345678'], ['RN12345678', 'RN12345678'], ['MRN: 12345678', 'MRN: 12345678'], ['RN-12345678', 'RN-12345678'],
  ['tel 12345678', 'tel ' + MASK_TOKEN]
].forEach(pair => check('masking: ' + pair[0] + ' => ' + pair[1], M(pair[0]) === pair[1], M(pair[0])));
check('the RN and the phone in one medicine line: only the phone is masked', M('metformin, RN 12345678, tel 012-3456789') === 'metformin, RN 12345678, tel ' + MASK_TOKEN, M('metformin, RN 12345678, tel 012-3456789'));

// Red-flag questions: an unknown answer is never a no, never an emergency; it is an amber check with a gap and a to-do
const RED_PROCS = { symptoms_now: ['TKR', 'THR', 'ACL', 'LUMBAR', 'SHOULDER', 'FOOTANKLE'], tkr_calf: ['TKR'], lum_leg_weak: ['LUMBAR'], lum_bladder: ['LUMBAR'],
  lum_saddle: ['LUMBAR'], sh_fingers: ['SHOULDER'], fa_sore: ['FOOTANKLE'], fa_toes: ['FOOTANKLE'] };
const RED_FIELD = { lum_leg_weak: 'lumbar_leg_weakness', lum_bladder: 'lumbar_bladder_bowel_change', lum_saddle: 'lumbar_saddle_numbness' };
const allQs = I.COMMON.concat(...I.PROCEDURES.map(p => I.BY_PROC[p]));
const treeRed = [...new Set(allQs.filter(q => q.redFlagIf !== undefined).map(q => q.id))];
check('every red-flag question in the tree has a test entry', treeRed.every(id => RED_PROCS[id]) && Object.keys(RED_PROCS).every(id => treeRed.includes(id)), treeRed);
function interviewTo(proc, lang, overrides) {
  let s = I.build(proc, lang, 'P-' + proc);
  let g = 0;
  while (!s.done && g++ < 150) {
    const q = I.BANK[s.current];
    const v = Object.prototype.hasOwnProperty.call(overrides, q.id) ? overrides[q.id] : defaultFor(q.id);
    s = I.next(s, v);
    if (s.reprompt) break;
  }
  return s;
}
Object.keys(RED_PROCS).forEach(qid => RED_PROCS[qid].forEach(proc => {
  const field = RED_FIELD[qid] || qid;
  const s = interviewTo(proc, 'en', { [qid]: 'unknown' });
  const ans = I.toAnswers(s);
  const sum = IN.summarise(ans);
  const todos = IN.todos(ans);
  const tag = qid + '/' + proc;
  check('red ' + tag + ': the interview finishes and does not halt', s.done === true && s.red === null, { done: s.done, red: s.red });
  check('red ' + tag + ': unknown is recorded as unknown, not no', ans.answers[field] === 'unknown', ans.answers[field]);
  check('red ' + tag + ': banner is AMBER (never RED from an unknown)', sum.banner.level === 'AMBER', sum.banner);
  check('red ' + tag + ': AMBER reason says red-flag question not answered, clinician to confirm', sum.banner.reasons.some(r => /Red-flag question not answered: clinician to confirm/.test(r) && r.indexOf('[' + field + ']') >= 0), sum.banner.reasons);
  check('red ' + tag + ': a gap line under Gaps to clarify', sum.gaps.some(g => g.indexOf('Patient does not know') >= 0 && g.indexOf('(' + field + ')') >= 0), sum.gaps);
  const td = todos.find(t => t.key === 'red_unknown_' + field);
  // judge round 2 (P1-D): the summary to-do now matches the Staff board task made when the patient answers Unknown: owner clinician, due now (was preop nurse, 8 h).
  check('red ' + tag + ': a same-day to-do that needs a clinician, due now, same owner as the Staff board task', !!td && td.needsClinician === true && td.dueHours === 0 && td.urgent === true && td.owner === 'clinician', td);
}));
['ms', 'zh', 'ar'].forEach(lang => {
  const s = interviewTo('TKR', lang, { symptoms_now: 'unknown' });
  const sum = IN.summarise(I.toAnswers(s));
  const phrase = { ms: 'doktor perlu sahkan', zh: '需临床医生确认', ar: 'يحتاج الطبيب إلى تأكيده' }[lang];
  check('red symptoms_now (' + lang + '): the AMBER reason is localised', sum.banner.reasons.some(r => r.indexOf(phrase) >= 0), sum.banner.reasons);
  const todo = IN.todos(I.toAnswers(s)).find(t => t.key === 'red_unknown_symptoms_now');
  check('red symptoms_now (' + lang + '): the to-do title is localised', !!todo && todo.title.length > 0 && todo.title !== 'Confirm red-flag answer (patient does not know): Chest pain, trouble breathing or confusion now', todo && todo.title);
});

// Choice questions: an unknown answer always shows under Gaps to clarify, for every choice id in every procedure
let choiceChecked = 0;
I.PROCEDURES.forEach(proc => {
  const choices = I.COMMON.concat(I.BY_PROC[proc]).filter(q => q.type === 'choice');
  choices.forEach(q => {
    const s = interviewTo(proc, 'en', { [q.id]: 'unknown' });
    const ans = I.toAnswers(s);
    const targets = IDMAP.targetsOf(q.id).filter(x => x !== 'freeText');
    const sum = IN.summarise(ans);
    const tokens = [q.id].concat(targets);
    const shown = sum.gaps.some(g => g.indexOf('Patient does not know') >= 0 && tokens.some(t => g.indexOf('(' + t + ')') >= 0));
    check('choice unknown shows under Gaps: ' + proc + ' ' + q.id, shown && sum.banner.level !== 'NONE', { gaps: sum.gaps.filter(g => /know/.test(g)), level: sum.banner.level });
    choiceChecked++;
  });
});
check('every choice id was checked (more than 20 across the six procedures)', choiceChecked > 20, choiceChecked);
check('sex unknown is under Gaps to clarify (TKR)', IN.summarise(I.toAnswers(interviewTo('TKR', 'en', { sex: 'unknown' }))).gaps.some(g => /Patient does not know: What is your sex\? \(sex\)/.test(g)));
check('home_help unknown is under Gaps to clarify (TKR)', IN.summarise(I.toAnswers(interviewTo('TKR', 'en', { home_help: 'unknown' }))).gaps.some(g => /home_help\)/.test(g)));

// Page wiring for round 8: the masked token is text, the notice is in ms and zh
check('the masked token is exempted from the source-tag rule in srcHtml', SRC.indexOf("p===' [number removed]'") >= 0);
check('the demo notice has Malay and Chinese text in the page (machine drafts)', /Demo sahaja\. Jangan taip nama sebenar/.test(SRC) && /仅供演示。请勿输入真实姓名/.test(SRC));
check('the red-flag AMBER reason is in all four languages in intake', /Soalan tanda bahaya tidak dijawab/.test(fs.readFileSync(path.join(__dirname, 'intake.js'), 'utf8')) && /危险信号问题未回答/.test(fs.readFileSync(path.join(__dirname, 'intake.js'), 'utf8')) && /لم يُجب عن سؤال مؤشر خطر/.test(fs.readFileSync(path.join(__dirname, 'intake.js'), 'utf8')));

console.log('\npolish8: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
