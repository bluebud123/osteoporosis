'use strict';
// Round 5 (review2 benign false alarm): finding-level negation for the SAME-DAY wound rule.
// 15 negated-wound sentences must NOT escalate; 15 genuine wound problems MUST still escalate (SAME-DAY, 'wound change').
// Sentences are fictional. ms and zh wording is a machine draft pending native review.
const path = require('path');
const eng = require(path.join(__dirname, '..', 'engine.js'));

let pass = 0, fail = 0; const fails = [];
function check(name, ok, detail) { if (ok) pass++; else { fail++; fails.push(name + (detail ? ' :: ' + detail : '')); } }
const run = t => eng.classify(t, { procedure: 'TKR' });
const escalates = r => (r.cls === 'SAME-DAY' || r.cls === 'EMERGENCY') && r.flags.indexOf('wound change') >= 0;

// ---- A: 15 negated-wound benign sentences (en 7, ms 4, zh 4) ----
const BENIGN = [
  'My wound is clean and there is no redness or discharge.',
  'The wound looks dry. There is no redness, no discharge and no pus.',
  'My incision has no pus and no discharge.',
  'No pus, no redness, no leaking from the wound.',
  'The wound is not red and not leaking.',
  'My scar has no redness or swelling, and it is healing well.',
  'Nothing oozes from the wound and the stitches are dry.',
  'Tiada kemerahan atau nanah pada luka saya.',
  'Tak ada nanah dan tak ada kemerahan di sekitar jahitan.',
  'Luka saya bersih, tiada cecair keluar dan tiada bau busuk.',
  'Tiada bengkak atau kemerahan pada kesan luka.',
  '伤口没有红肿或渗液。',
  '伤口没有发红，也没有流脓。',
  '刀口不红，没有异味。',
  '伤口干净，没有渗液、没有脓。'
];
// ---- B: 15 genuine wound problems that must still escalate (en 8, ms 4, zh 3) ----
const PROBLEM = [
  'There is some pus.',
  'My wound is red and leaking.',
  'There is some pus coming out of my wound.',
  'The incision is oozing yellow fluid.',
  'My stitches are red and there is discharge.',
  'The wound has pus and it smells bad.',
  'The wound split open last night.',
  'The wound is not red, but it is leaking.',
  'Ada nanah pada luka saya.',
  'Luka saya merah dan ada cecair keluar.',
  'Tiada demam tetapi nanah ada pada luka.',
  'Jahitan saya terbuka dan berbau busuk.',
  '伤口红肿，还在流脓。',
  '刀口有脓。',
  '伤口在渗液，有异味。'
];
BENIGN.forEach((s, i) => { const r = run(s); check('A' + (i + 1) + ' negated wound is not escalated: ' + s, !escalates(r), r.cls + ' ' + JSON.stringify(r.flags)); });
PROBLEM.forEach((s, i) => { const r = run(s); check('B' + (i + 1) + ' wound problem still escalates: ' + s, escalates(r), r.cls + ' ' + JSON.stringify(r.flags)); });

// ---- C: list and contrast shapes, stated as explicit rules ----
const LIST_NEG = [
  ['"no X or Y"', 'There is no redness or discharge at the wound.'],
  ['"no X, no Y"', 'There is no redness, no discharge at the wound.'],
  ['"no X or Y or Z"', 'The wound has no pus or redness or discharge.'],
  ['"no X or Y" with a non-finding item', 'The wound has no redness or swelling or discharge.'],
  ['ms "tiada X atau Y"', 'Luka saya tiada kemerahan atau nanah.'],
  ['zh "没有X或Y"', '伤口没有红肿或渗液。']
];
LIST_NEG.forEach(([name, s]) => check('C list negated ' + name, !escalates(run(s)), run(s).cls + ' ' + JSON.stringify(run(s).flags)));
const CONTRAST = [
  ['"no redness, wound is leaking": a new clause ends the negation', 'There is no redness, wound is leaking.'],
  ['"no redness but leaking": "but" ends the negation', 'There is no redness but the wound is leaking.'],
  ['"no pus and the wound is red": a new clause ends the negation', 'There is no pus and the wound is red.'],
  ['"wound is not red and is leaking": "is" ends the negation', 'The wound is not red and is leaking.'],
  ['zh "没有红肿，伤口在流脓": a comma ends the negation', '伤口没有红肿，伤口在流脓。']
];
CONTRAST.forEach(([name, s]) => check('C contrast still escalates ' + name, escalates(run(s)), run(s).cls + ' ' + JSON.stringify(run(s).flags)));

// ---- D: urgent detection is unchanged by the wound negation (sanity) ----
check('D emergency still wins over a clean wound', run('My wound is clean and there is no redness, but I am vomiting blood.').cls === 'EMERGENCY');

console.log('negation (round 5): ' + pass + ' PASS, ' + fail + ' FAIL');
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fail ? 1 : 0);
