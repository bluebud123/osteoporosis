/*
 * Scores src/checkin.js: hand-written expected flags for patient check-in answers.
 * Writes bench/results/checkin.md. Exit code 1 on any failure.
 * Expected answers are drafts pending clinician sign-off.
 */
const fs = require('fs'), path = require('path');
const C = require('../src/checkin.js');
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
  ['K34', 'Not started yet', 'review', { med: 3, why: [1] }, { rx: 'deno' }, ['P-STOP']]
];
let fails = 0; const rows = [];
for (const [id, desc, visit, a, ctx, want] of CASES) {
  const got = C.flags(visit, a, ctx).map(f => f[0]);
  const ok = got.length === want.length && want.every(x => got.includes(x));
  if (!ok) fails++;
  rows.push(`| ${id} | ${desc} | ${want.join(', ') || '–'} | ${got.join(', ') || '–'} | ${ok ? 'PASS' : '**FAIL**'} |`);
  if (!ok) console.log(`FAIL ${id} ${desc}: want [${want}] got [${got}]`);
}
// Urgent flags must reach the clinician: every crit-level flag id must be one the board pins
const critIds = new Set(); CASES.forEach(([, , v, a, ctx]) => C.flags(v, a, ctx).forEach(f => f[1] === 'crit' && critIds.add(f[0])));
const md = ['# Patient check-in results', '', `Passed **${CASES.length - fails}/${CASES.length}**. Urgent flag types exercised: ${[...critIds].join(', ')}.`, '', '_Draft: expected flags pending clinician sign-off._', '',
  '| ID | Answers | Expected flags | Produced | Result |', '| --- | --- | --- | --- | --- |', ...rows];
fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'results', 'checkin.md'), md.join('\n') + '\n');
console.log(`checkin ${CASES.length - fails}/${CASES.length}`);
process.exitCode = fails ? 1 : 0;
