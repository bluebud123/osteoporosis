/*
 * Scores src/checkin.js: hand-written expected flags for patient check-in answers, plus checks on
 * normalisation, the clinician summary, the three languages and the Arabic wording.
 * Writes bench/results/checkin.md. Exit code 1 on any failure.
 * Expected answers are drafts pending clinician sign-off. Arabic and Malay need native review.
 */
const fs = require('fs'), path = require('path');
const C = require('../src/checkin.js');
const NONE = C.NONE;
const LONG = 'a'.repeat(5000);
// Visit-section answers that mean "nothing reported" (plus a visit with no red flags).
const QUIET = { cc: 'Pain in my lower back', loc: 2, dur: 1, pnow: 4, pworst: 5, night: 1, walk: 0, redf: [6], curmeds: 'Calcium and vitamin D', allergy: NONE, worry: '' };
const FIRST_QUIET = { fx: 1, falls: 0, parent: 1, steroid: 1, ra: 1, smoke: 1, alcohol: 1, shrink: 1 };
// [id, description, visit, answers, ctx, expected flag ids (exact set)]
const CASES = [
  ['K01', 'First visit, nothing reported', 'first', { fx: 1, falls: 0, parent: 1, steroid: 1, ra: 1, smoke: 1, alcohol: 1, shrink: 1 }, {}, []],
  ['K02', 'Fracture in the last 12 months → urgent', 'first', { fx: 0, fxsite: 0, fxwhen: 0, falls: 0 }, {}, ['P-FX12']],
  ['K03', 'Older fracture → confirm, DXA likely', 'first', { fx: 0, fxsite: 2, fxwhen: 2 }, {}, ['P-FX']],
  ['K04', 'Unsure about fracture → no flag (clinician asks)', 'first', { fx: 2 }, {}, []],
  ['K05', 'Two or more falls', 'first', { falls: 2 }, {}, ['P-FALLS']],
  ['K06', 'One fall only → no falls flag', 'first', { falls: 1 }, {}, []],
  ['K07', 'Steroids plus FRAX factors grouped', 'first', { steroid: 0, parent: 0, smoke: 0 }, {}, ['P-GC', 'P-FRAX']],
  ['K08', 'Low BMI counts as a FRAX factor', 'first', { body: { height: '160', weight: '45' } }, {}, ['P-FRAX']],
  ['K09', 'Normal BMI → no flag', 'first', { body: { height: '160', weight: '60' } }, {}, []],
  ['K10', 'Height loss → vertebral assessment', 'first', { shrink: 0 }, {}, ['P-HT']],
  ['K11', 'Question passed to clinician', 'first', { ask: 'Can I still do yoga?' }, {}, ['P-ASK']],
  ['K12', 'Blank question ignored', 'first', { ask: '   ' }, {}, []],
  ['K20', 'Review, all well on alendronate', 'review', { med: 0, sym: [3], rfall: 0, rfx: 1, dental: 1, cad: 0 }, { rx: 'obp' }, []],
  ['K21', 'New fracture on treatment → urgent', 'review', { med: 0, rfx: 0 }, { rx: 'obp' }, ['P-NEWFX']],
  ['K22', 'Jaw symptoms on denosumab → ONJ', 'review', { med: 0, sym: [1] }, { rx: 'deno' }, ['P-ONJ']],
  ['K23', 'Thigh pain on zoledronic acid → AFF', 'review', { med: 0, sym: [2] }, { rx: 'zol' }, ['P-AFF']],
  ['K24', 'Jaw and thigh symptoms on teriparatide → no ONJ/AFF flag', 'review', { med: 0, sym: [1, 2] }, { rx: 'teri' }, []],
  ['K25', 'Stopped denosumab → rebound warning, not generic stop', 'review', { med: 2, why: [1] }, { rx: 'deno' }, ['P-DENO']],
  ['K26', 'Stopped alendronate', 'review', { med: 2, why: [0] }, { rx: 'obp' }, ['P-STOP']],
  ['K27', 'Missed doses', 'review', { med: 1, why: [2] }, { rx: 'obp' }, ['P-MISS']],
  ['K28', 'Heartburn on alendronate', 'review', { med: 0, sym: [0] }, { rx: 'obp' }, ['P-GI']],
  ['K29', 'Heartburn on denosumab → no GI flag', 'review', { med: 0, sym: [0] }, { rx: 'deno' }, []],
  ['K30', 'Fall since last visit', 'review', { med: 0, rfall: 1 }, { rx: 'obp' }, ['P-RFALL']],
  ['K31', 'Dental surgery planned on romosozumab', 'review', { med: 0, dental: 0 }, { rx: 'romo' }, ['P-DENT']],
  ['K32', 'Not taking calcium and vitamin D', 'review', { med: 0, cad: 2 }, { rx: 'obp' }, ['P-CAD']],
  ['K33', 'Several problems at once', 'review', { med: 1, why: [0], sym: [0, 1], rfall: 2, rfx: 0 }, { rx: 'obp' }, ['P-NEWFX', 'P-ONJ', 'P-MISS', 'P-GI', 'P-RFALL']],
  ['K34', 'Not started yet', 'review', { med: 3, why: [1] }, { rx: 'deno' }, ['P-STOP']],
  // Visit section: red flags, each alone and in combination
  ['K40', 'First set, visit section quiet (no red flags, pain 4)', 'first', { ...FIRST_QUIET, ...QUIET }, {}, []],
  ['K41', 'Review set, visit section quiet ("none of these")', 'review', { med: 0, sym: [3], rfall: 0, rfx: 1, dental: 1, cad: 0, ...QUIET }, { rx: 'obp' }, []],
  ['K42', 'New leg weakness alone → urgent, same day', 'first', { ...FIRST_QUIET, ...QUIET, redf: [0] }, {}, ['V-LEG']],
  ['K43', 'Bladder or bowel change alone → cauda equina, urgent', 'first', { ...FIRST_QUIET, ...QUIET, redf: [1] }, {}, ['V-CES']],
  ['K44', 'Numbness around groin or buttocks alone → cauda equina, urgent', 'first', { ...FIRST_QUIET, ...QUIET, redf: [2] }, {}, ['V-CES']],
  ['K45', 'Fever or chills alone, knee site → review', 'first', { ...FIRST_QUIET, ...QUIET, loc: 4, redf: [3] }, {}, ['V-FEVERW']],
  ['K46', 'Fever or chills with lower back pain → urgent, same day', 'first', { ...FIRST_QUIET, ...QUIET, loc: 2, redf: [3] }, {}, ['V-FEVER']],
  ['K47', 'Unexplained weight loss alone → review', 'first', { ...FIRST_QUIET, ...QUIET, redf: [4], night: 1 }, {}, ['V-WL']],
  ['K48', 'Unexplained weight loss with night pain → urgent review (malignancy or myeloma), and night pain noted', 'first', { ...FIRST_QUIET, ...QUIET, redf: [4], night: 0 }, {}, ['V-MAL', 'V-NIGHT']],
  ['K49', 'Fall or injury today, other site → review', 'first', { ...FIRST_QUIET, ...QUIET, loc: 8, redf: [5] }, {}, ['V-INJ']],
  ['K50', 'Fall today with hip pain → urgent, same day', 'first', { ...FIRST_QUIET, ...QUIET, loc: 3, redf: [5] }, {}, ['V-FALL']],
  ['K51', 'Fall today with lower back pain on treatment → urgent, same day', 'review', { med: 0, sym: [3], rfall: 0, rfx: 1, dental: 1, cad: 0, ...QUIET, loc: 2, redf: [5] }, { rx: 'obp' }, ['V-FALL']],
  ['K52', 'Pain 10 with night pain → severe pain and night pain', 'first', { ...FIRST_QUIET, ...QUIET, pnow: 10, night: 0 }, {}, ['V-PAIN', 'V-NIGHT']],
  ['K53', 'Pain 10, no night pain → severe pain only', 'first', { ...FIRST_QUIET, ...QUIET, pnow: 10, night: 1 }, {}, ['V-PAIN']],
  ['K54', 'Pain 8 is at the review threshold', 'first', { ...FIRST_QUIET, ...QUIET, pnow: 8 }, {}, ['V-PAIN']],
  ['K55', 'Pain 7 is below the threshold', 'first', { ...FIRST_QUIET, ...QUIET, pnow: 7 }, {}, []],
  ['K56', 'Pain 0, walks as usual → no flag', 'first', { ...FIRST_QUIET, ...QUIET, pnow: 0, walk: 0 }, {}, []],
  ['K57', 'Cannot walk or climb stairs → mobility review', 'first', { ...FIRST_QUIET, ...QUIET, walk: 2 }, {}, ['V-WALK']],
  ['K58', 'Walks with difficulty → note only', 'first', { ...FIRST_QUIET, ...QUIET, walk: 1 }, {}, ['V-WALK']],
  ['K59', 'Empty free text (complaint, medicines, worries) → no flags, no crash', 'first', { ...FIRST_QUIET, ...QUIET, cc: '', curmeds: '', allergy: '', worry: '' }, {}, []],
  ['K60', 'Very long free text (5000 characters) in complaint and worries → no flags', 'first', { ...FIRST_QUIET, ...QUIET, cc: LONG, worry: LONG }, {}, []],
  ['K61', 'HTML and script in the complaint → no flags, text kept for display only', 'first', { ...FIRST_QUIET, ...QUIET, cc: '<img src=x onerror=alert(1)><script>alert(2)</script>' }, {}, []],
  ['K62', 'Complaint mentions fracture, cauda equina and fever, but no red flag ticked → free text is not parsed', 'first', { ...FIRST_QUIET, ...QUIET, cc: 'fracture, cauda equina, fever, weight loss, fell today' }, {}, []],
  ['K63', 'Pain 11 is not a valid answer → ignored', 'first', { ...FIRST_QUIET, ...QUIET, pnow: 11 }, {}, []],
  ['K64', 'Red-flag option 9 does not exist → ignored', 'first', { ...FIRST_QUIET, ...QUIET, redf: [9] }, {}, []],
  ['K65', 'Three same-day flags together (bladder, fever with spine, fall with hip)', 'first', { ...FIRST_QUIET, ...QUIET, loc: 2, redf: [1, 3, 5] }, {}, ['V-CES', 'V-FEVER', 'V-FALL']],
  ['K66', 'New leg weakness on denosumab → urgent, same day', 'review', { med: 0, sym: [3], rfall: 0, rfx: 1, dental: 1, cad: 0, ...QUIET, redf: [0] }, { rx: 'deno' }, ['V-LEG']],
  ['K67', 'Red flag plus a question for the doctor', 'first', { ...FIRST_QUIET, ...QUIET, redf: [1], ask: 'What exercise is safe?' }, {}, ['V-CES', 'P-ASK']],
  ['K68', 'Review set, visit section with a question left blank (optional) and no flags', 'review', { med: 0, sym: [3], rfall: 0, rfx: 1, dental: 1, cad: 0, ...QUIET, worry: undefined }, { rx: 'obp' }, []]
];

let fails = 0; const rows = [];
for (const [id, desc, visit, a, ctx, want] of CASES) {
  const got = C.flags(visit, a, ctx).map(f => f[0]);
  const ok = got.length === want.length && want.every(x => got.includes(x));
  if (!ok) fails++;
  rows.push(`| ${id} | ${desc} | ${want.join(', ') || '–'} | ${got.join(', ') || '–'} | ${ok ? 'PASS' : '**FAIL**'} |`);
  if (!ok) console.log(`FAIL ${id} ${desc}: want [${want}] got [${got}]`);
}

/* ---------- checks: normalisation, summary, wording, languages ---------- */
const checks = [];
const check = (id, desc, fn) => {
  let ok = false, err = '';
  try { ok = !!fn(); } catch (e) { err = e.message; }
  if (!ok) fails++;
  checks.push({ id, desc, ok, err });
  if (!ok) console.log(`FAIL ${id} ${desc}${err ? ' — ' + err : ''}`);
};
const Q = id => C.SETS.first.concat(C.SETS.review).find(q => q.id === id);
const sumOf = (visit, answers, rx) => C.summary({ checkin: { visit, answers, lang: 'en', d: 0 }, rx: rx || null });

check('N01', 'normalise keeps valid scale and drops out-of-range scale', () => {
  const n = C.normalise('first', { ...FIRST_QUIET, pnow: 11, pworst: 6 });
  return n.pnow === undefined && n.pworst === 6;
});
check('N02', 'normalise drops answers to hidden questions (site when fracture is "no")', () => {
  const n = C.normalise('first', { fx: 1, fxsite: 0, fxwhen: 0 });
  return n.fxsite === undefined && n.fxwhen === undefined && n.fx === 1;
});
check('N03', 'normalise keeps the answer to a question shown after a "yes" (site when fracture is "yes")', () => {
  const n = C.normalise('first', { fx: 0, fxsite: 0 });
  return n.fxsite === 0;
});
check('N04', 'normalise caps free text at 1000 characters', () => C.normalise('first', { cc: LONG }).cc.length === C.MAX_TEXT);
check('N05', 'normalise keeps the "None" choice for allergies', () => C.normalise('first', { allergy: NONE }).allergy === NONE);
check('N06', 'normalise strips control characters and trims text', () => C.normalise('first', { cc: '  pain\u0007 here \n ' }).cc === 'pain here');
check('N07', 'normalise rejects a multi answer that is not a list, and sorts valid ones', () => {
  const bad = C.normalise('first', { ...QUIET, redf: 'x' }).redf === undefined;
  const sorted = C.normalise('first', { redf: [3, 0, 3] }).redf;
  return bad && sorted.length === 2 && sorted[0] === 0 && sorted[1] === 3;
});
check('N08', 'normalise tolerates missing answers and a non-object', () => Object.keys(C.normalise('review', undefined)).length === 0 && Object.keys(C.normalise('first', 'oops')).length === 0);
check('D01', 'sameDay is true for cauda equina and false for weight loss alone', () => {
  const ce = C.flags('first', { ...FIRST_QUIET, ...QUIET, redf: [1] }, {});
  const wl = C.flags('first', { ...FIRST_QUIET, ...QUIET, redf: [4] }, {});
  return C.sameDay(ce) && !C.sameDay(wl);
});
check('S01', 'summary: red flags section comes first, then the rest in order', () => {
  const s = sumOf('first', { ...FIRST_QUIET, ...QUIET, redf: [0, 3] });
  return s.sections.map(x => x.id).join() === 'redflags,complaint,pain,fracture,meds,worry';
});
check('S02', 'summary: every item is patient-reported', () => {
  const s = sumOf('review', { med: 0, ...QUIET, redf: [1, 5] }, 'obp');
  return s.provenance === 'patient-reported' && s.sections.every(x => x.items.every(i => i.provenance === 'patient-reported'));
});
check('S03', 'summary: urgent flags sort before review and notes', () => {
  const s = sumOf('first', { ...FIRST_QUIET, ...QUIET, pnow: 9, redf: [0, 4] });
  const levels = s.sections[0].items.filter(i => i.level).map(i => i.level);
  const first = levels.indexOf('warn');
  return levels.length >= 2 && levels.slice(0, first).every(l => l === 'crit') && levels.includes('warn');
});
check('S04', 'summary: chief complaint is verbatim, script text is kept as data (escaping happens at render)', () => {
  const txt = '<script>alert(2)</script> pain';
  const s = sumOf('first', { ...FIRST_QUIET, ...QUIET, cc: txt });
  const cc = s.sections[1].items[0];
  return cc.value === txt && cc.verbatim === true;
});
check('S05', 'summary: "none" allergy reads as None; blank complaint reads as Not answered', () => {
  const s = sumOf('first', { ...FIRST_QUIET, ...QUIET, allergy: NONE, cc: '' });
  const meds = s.sections.find(x => x.id === 'meds').items, cc = s.sections[1].items[0];
  return meds[1].value === 'None' && cc.value === 'Not answered';
});
check('S06', 'summary: a 5000-character complaint is cut to 1000 and marked cut', () => {
  const s = sumOf('first', { ...FIRST_QUIET, ...QUIET, cc: LONG });
  const cc = s.sections[1].items[0];
  return cc.value.length === C.MAX_TEXT && cc.cut === true;
});
check('S07', 'summary: the question for the doctor is under worries, not red flags', () => {
  const s = sumOf('first', { ...FIRST_QUIET, ...QUIET, redf: [1], ask: 'What exercise is safe?' });
  const flagsText = s.sections[0].items.map(i => i.value).join(' | ');
  const worry = s.sections.find(x => x.id === 'worry').items.find(i => i.label === 'Question for the doctor');
  return !/Patient question/.test(flagsText) && worry.value === 'What exercise is safe?';
});
check('S08', 'summary: review set shows the bone medicine item; first set shows the fracture history', () => {
  const r = sumOf('review', { med: 1, why: [2], ...QUIET }, 'obp').sections.find(x => x.id === 'meds').items.map(i => i.label);
  const f = sumOf('first', { ...FIRST_QUIET, ...QUIET }).sections.find(x => x.id === 'fracture').items.map(i => i.label);
  return r.includes('Bone medicine, last month') && f.includes('Fragility fracture since age 50');
});
check('S09', 'summary: an empty check-in gives Not answered, not an error', () => {
  const s = sumOf('first', {});
  return s.sections.every(x => x.items.every(i => typeof i.value === 'string' && i.value.length > 0)) && s.urgent === false;
});
check('S10', 'summary: a red flag is never upgraded by a patient answer alone; the risk stays with the clinician (no category field)', () => {
  const s = sumOf('first', { ...FIRST_QUIET, ...QUIET, redf: [0] });
  return !('category' in s) && !('risk' in s) && s.urgent === true && s.note.indexOf('Confirm with the patient before acting') >= 0;
});
check('W01', 'every question has en, ar and ms with the same number of options and a question text', () => {
  return C.SETS.first.concat(C.SETS.review).every(q => ['en', 'ar', 'ms'].every(l => q[l] && q[l].q && (q.type !== 'single' && q.type !== 'multi' || q[l].opts.length === q.en.opts.length)));
});
check('W02', 'scale questions have low and high labels in every language; text questions have a placeholder', () => {
  return C.SETS.first.concat(C.SETS.review).every(q => (q.type !== 'scale' || ['en', 'ar', 'ms'].every(l => q[l].lo && q[l].hi))
    && (q.type !== 'text' || ['en', 'ar', 'ms'].every(l => q[l].ph)));
});
check('W03', 'visit section is in both sets, in order, before the question for the doctor', () => {
  const order = ['cc', 'loc', 'dur', 'pnow', 'pworst', 'night', 'walk', 'redf', 'curmeds', 'allergy', 'worry'];
  return ['first', 'review'].every(v => {
    const ids = C.SETS[v].map(q => q.id), i = ids.indexOf('cc');
    return i >= 0 && order.every((id, j) => ids[i + j] === id) && ids[ids.length - 1] === 'ask';
  });
});
check('W04', 'the visit section offers the required choices (where, how long, walking, red flags, 0-10)', () => {
  return Q('loc').en.opts.length === 9 && Q('dur').en.opts.join() === 'Days,Weeks,Months,Years' && Q('pnow').type === 'scale' && Q('pworst').type === 'scale'
    && Q('redf').en.opts.length === 7 && Q('redf').none === 6 && Q('walk').en.opts.length === 3;
});
check('W05', 'Malay is complete: every visit-section question has Malay text', () => C.SETS.first.concat(C.SETS.review).every(q => q.ms.q && q.ms.q.length > 5));

// Arabic wording must not address the patient with a fixed gender. Common singular second-person forms are banned.
const BANNED_AR = /(?:^|[\s،؟!.:(«"])(?:تدخنين|تشربين|تتناولين|تخططين|تستطيعين|تريدين|تودين|تحتاجين|لاحظتِ|سقطتِ|تناولتِ|اكتبي|استلمي|ابدئي|املئي|راجعي|أرسلي|استمري|مصابة|لديك|معك|عيادتك|خطوتك|طولك|وزنك|تدخن|تشرب|تتناول|تخطط|تريد|اكتب|استلم|ابدأ|املأ|راجع|أرسل|استمر|لاحظت|سقطت|تناولت|لك)(?=$|[\s،؟!.:)»"])/u;
const arTexts = [];
C.SETS.first.concat(C.SETS.review).forEach(q => {
  arTexts.push(q.ar.q, q.ar.ph, q.ar.lo, q.ar.hi, ...(q.ar.opts || []), ...((q.ar.labels) || []));
});
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ptAr = indexHtml.slice(indexHtml.indexOf('  ar:{hello'), indexHtml.indexOf('  ms:{hello'));
check('A01', 'Arabic check-in wording has no gender-specific second-person forms', () => arTexts.filter(Boolean).every(t => !BANNED_AR.test(t)));
check('A02', 'Arabic patient screen (index.html PT.ar) has no gender-specific second-person forms', () => {
  const bad = ptAr.match(new RegExp(BANNED_AR.source, 'gu'));
  if (bad) throw new Error('found ' + bad.join(' '));
  return ptAr.length > 500;
});
check('A03', 'the scan catches a known feminine form (self-test)', () => BANNED_AR.test('هل تدخنين حاليًا؟') && BANNED_AR.test('هل لديك ألم؟'));

const critIds = new Set(); CASES.forEach(([, , v, a, ctx]) => C.flags(v, a, ctx).forEach(f => f[1] === 'crit' && critIds.add(f[0])));
const total = CASES.length + checks.length, passed = total - fails;
const md = ['# Patient check-in results', '', `Passed **${passed}/${total}** (${CASES.length} answer sets, ${checks.length} checks). Urgent flag types exercised: ${[...critIds].join(', ')}.`, '',
  '_Draft: expected flags pending clinician sign-off. Arabic and Malay wording needs native clinical review._', '',
  '| ID | Answers | Expected flags | Produced | Result |', '| --- | --- | --- | --- | --- |', ...rows, '',
  '| ID | Check | Result |', '| --- | --- | --- |', ...checks.map(c => `| ${c.id} | ${c.desc} | ${c.ok ? 'PASS' : '**FAIL**' + (c.err ? ' (' + c.err + ')' : '')} |`)];
fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'results', 'checkin.md'), md.join('\n') + '\n');
console.log(`checkin ${passed}/${total}`);
process.exitCode = fails ? 1 : 0;
