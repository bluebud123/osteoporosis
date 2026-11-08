'use strict';
// Round 5: one test per contradiction rule. Each contradictory history must never show NONE.
// Expected levels are the clinically safer ones: AMBER where the answers conflict, INCOMPLETE where an answer is missing or unclear.
const path = require('path');
const intake = require(path.join(__dirname, 'intake.js'));

let pass = 0, fail = 0; const fails = [];
function check(name, ok, detail) { if (ok) pass++; else { fail++; fails.push(name + (detail ? ' :: ' + detail : '')); } }
const level = c => intake.summarise(c).banner.level;

const RULES = [
  { rule: 'penicillin typed in allergy text, penicillin box "no" (rule: allergy named = allergy recorded)',
    c: { procedure: 'TKR', answers: { allergy_text: 'penicillin rash as a child', penicillin_allergy: 'no' } }, want: 'AMBER' },
  { rule: 'penicillin named in free text, penicillin box "no" (rule: free-text allergy is never read as "no")',
    c: { procedure: 'TKR', answers: { penicillin_allergy: 'no' }, freeText: ['I am allergic to penicillin'] }, want: 'AMBER' },
  { rule: 'diabetes "no" with HbA1c 9.4 typed (rule: typed HbA1c is kept and flagged)',
    c: { procedure: 'TKR', answers: { diabetes: 'no', hba1c: 9.4 } }, want: 'AMBER' },
  { rule: 'warfarin named in medicine list, blood thinner "no" (rule: medicine list beats a "no")',
    c: { procedure: 'ACL', answers: { meds_text: 'warfarin 3 mg at night', blood_thinner: 'no' } }, want: 'AMBER' },
  { rule: 'aspirin named in free text, blood thinner "no" (rule: free-text medicine beats a "no")',
    c: { procedure: 'TKR', answers: { blood_thinner: 'no' }, freeText: ['taking aspirin 75 mg every day'] }, want: 'AMBER' },
  { rule: 'blood thinner unanswered (rule: a missing blood-thinner answer is a gap)',
    c: { procedure: 'ACL', answers: { meds_text: 'paracetamol' } }, want: 'INCOMPLETE' },
  { rule: 'penicillin allergy "maybe" (rule: an unclear allergy answer is a gap)',
    c: { procedure: 'SHOULDER', answers: { penicillin_allergy: 'maybe' } }, want: 'INCOMPLETE' },
  { rule: 'empty history (rule: never NONE with no answers)',
    c: {}, want: 'INCOMPLETE' }
];
for (const r of RULES) {
  const got = level(r.c);
  check('rule: ' + r.rule, got === r.want, 'want ' + r.want + ' got ' + got);
  check('never NONE: ' + r.rule, got !== 'NONE', 'got NONE');
}

// Rule with many gaps: a history that is otherwise clean but has more than 6 gaps is never NONE.
const clean = { procedure: 'TKR', answers: { meds_text: 'none', blood_thinner: 'no', allergy_text: 'none known', penicillin_allergy: 'no', diabetes: 'no', hba1c: 5.4 } };
check('gaps rule: a clean-looking history with more than 6 gaps is never NONE', level(clean) !== 'NONE', 'got ' + level(clean));

console.log('contradictions (round 5): ' + pass + ' PASS, ' + fail + ' FAIL');
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fail ? 1 : 0);
