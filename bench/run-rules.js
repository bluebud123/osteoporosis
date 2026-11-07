/*
 * Scores src/rules.js against bench/cases.js.
 * Prints a summary and writes bench/results/rules.json + bench/results/rules.md.
 * Exit code 1 if any check fails, so CI can gate on it.
 */
const fs = require('fs');
const path = require('path');
const R = require('../src/rules.js');
const CASES = require('./cases.js');

const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
const fmt = a => '[' + a.join(', ') + ']';

const rows = [];
let checks = 0, fails = 0;
const conf = {}; const CATS = ['vhigh', 'high', 'low', 'incomplete'];
CATS.forEach(e => { conf[e] = {}; CATS.forEach(g => conf[e][g] = 0); });

for (const c of CASES) {
  const p = c.p, e = c.expect, got = {};
  const cat = R.category(p);
  got.cat = cat.key;
  got.dxa = R.dxaIndication(p).indicated;
  got.fast = R.fastTrack(p);
  const tx = R.treatments(p);
  got.blocked = tx.filter(t => t.kind === 'blocked').map(t => t.id);
  got.first = tx.filter(t => t.kind === 'first').map(t => t.id);
  const lf = R.labFlags(p);
  got.labs = lf.flags.map(f => f[0]);
  got.missing = lf.missing;
  got.scope = !!R.scopeWarning(p);

  // Per-drug results: needs (treatments()[].needs), signBlock(p, drug).
  const txOf = id => tx.find(x => x.id === id);
  const signOf = id => (typeof R.signBlock === 'function')
    ? R.signBlock(p, id)
    : { blocked: null, reasons: ['signBlock() is not exported'] };

  const res = [];
  const check = (field, ok, want, have) => { checks++; if (!ok) fails++; res.push({ field, ok, want, have }); };
  if ('cat' in e) { check('category', got.cat === e.cat, e.cat, got.cat); conf[e.cat][got.cat]++; }
  if ('dxa' in e) check('dxa indicated', got.dxa === e.dxa, e.dxa, got.dxa);
  if ('fast' in e) check('fast-track', got.fast === e.fast, e.fast, got.fast);
  if ('blocked' in e) check('blocked', sameSet(got.blocked, e.blocked), fmt(e.blocked), fmt(got.blocked));
  if ('first' in e) check('first line', sameSet(got.first, e.first), fmt(e.first), fmt(got.first));
  if ('labs' in e) check('lab flags', sameSet(got.labs, e.labs), fmt(e.labs), fmt(got.labs));
  if ('missing' in e) check('missing labs', sameSet(got.missing, e.missing), fmt(e.missing), fmt(got.missing));
  if ('scope' in e) check('scope warning', got.scope === e.scope, e.scope, got.scope);
  if ('spep' in e) check('secondary screen block', !!R.secondaryScreen(p).block === e.spep.block, e.spep.block, !!R.secondaryScreen(p).block);
  if ('catNeeds' in e) { const have = cat.needs || []; check('category needs', sameSet(have, e.catNeeds), fmt(e.catNeeds), fmt(have)); }
  if ('fires' in e) e.fires.forEach(id => check(`rule ${id} fires`, cat.fired.some(f => f[0] === id), 'fires', cat.fired.map(f => f[0]).join(' ') || 'none'));
  if ('notFires' in e) e.notFires.forEach(id => check(`rule ${id} absent`, !cat.fired.some(f => f[0] === id), 'absent', cat.fired.map(f => f[0]).join(' ') || 'none'));
  if ('needs' in e) for (const [id, want] of Object.entries(e.needs)) {
    const have = (txOf(id) || {}).needs || [];
    check(`needs ${id}`, sameSet(have, want), fmt(want), txOf(id) ? fmt(have) : 'not offered');
  }
  if ('sign' in e) for (const [id, want] of Object.entries(e.sign)) {
    const s = signOf(id);
    check(`sign ${id} blocked`, s.blocked === want, want, s.blocked);
  }
  if ('signHas' in e) for (const [id, sub] of Object.entries(e.signHas)) {
    const s = signOf(id);
    check(`sign ${id} reason mentions "${sub}"`, s.reasons.some(r => r.includes(sub)), sub, s.reasons.join(' | ') || 'none');
  }
  rows.push({ id: c.id, group: c.group, desc: c.desc, pass: res.every(r => r.ok), checks: res, trace: cat.fired.map(f => f[0]).join(' ') });
}

/* Headline safety numbers */
const vhCases = CASES.filter(c => c.expect.cat === 'vhigh');
const vhRecall = vhCases.filter(c => R.category(c.p).key === 'vhigh').length;
const falseReassure = CASES.filter(c => ['vhigh', 'high', 'incomplete'].includes(c.expect.cat) && R.category(c.p).key === 'low');
const blockedOffered = CASES.filter(c => {
  // safety invariant: nothing the guideline blocks may appear as first-line or alternative
  const e = c.expect.blocked; if (!e) return false;
  const offered = R.treatments(c.p).filter(t => t.kind !== 'blocked').map(t => t.id);
  return e.some(id => offered.includes(id));
});
// safety invariant (every case): a drug the guideline blocks, or that has missing or needed results, cannot be signed
const signableWhenBlocked = [];
if (typeof R.signBlock === 'function') CASES.forEach(c => {
  R.treatments(c.p).forEach(t => {
    const s = R.signBlock(c.p, t.id);
    if ((t.kind === 'blocked' || (t.needs || []).length) && !s.blocked) signableWhenBlocked.push(`${c.id}:${t.id}`);
  });
});

const passCases = rows.filter(r => r.pass).length;
const summary = {
  cases: CASES.length, casesPassed: passCases, checks, checksPassed: checks - fails,
  veryHighRecall: `${vhRecall}/${vhCases.length}`,
  falseReassurance: falseReassure.map(c => c.id),
  blockedDrugOffered: blockedOffered.map(c => c.id),
  signableWhenBlocked,
  status: 'DRAFT: expected answers pending clinician sign-off'
};

fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'results', 'rules.json'), JSON.stringify({ summary, confusion: conf, rows }, null, 2));

const md = [];
md.push('# Rules benchmark results', '');
md.push(`- Cases passed: **${passCases}/${CASES.length}**; individual checks passed: **${checks - fails}/${checks}**`);
md.push(`- Very-high-risk recall: **${summary.veryHighRecall}**`);
md.push(`- False reassurance (at-risk or incomplete case labelled "low"): **${falseReassure.length}**${falseReassure.length ? ' — ' + summary.falseReassurance.join(', ') : ''}`);
md.push(`- Guideline-blocked drug offered: **${blockedOffered.length}**${blockedOffered.length ? ' — ' + summary.blockedDrugOffered.join(', ') : ''}`);
md.push(`- Blocked or needs-result drug signable: **${signableWhenBlocked.length}**${signableWhenBlocked.length ? ' — ' + signableWhenBlocked.join(', ') : ''}`);
md.push('', `_${summary.status}._`, '', '## Category confusion matrix (rows = expected, columns = produced)', '');
md.push('| expected \\ produced | ' + CATS.join(' | ') + ' |', '|' + ' --- |'.repeat(CATS.length + 1));
CATS.forEach(e => md.push(`| ${e} | ` + CATS.map(g => conf[e][g]).join(' | ') + ' |'));
md.push('', '## Every case', '', '| ID | Group | Case | Result | Failed checks | Rules fired |', '| --- | --- | --- | --- | --- | --- |');
rows.forEach(r => md.push(`| ${r.id} | ${r.group} | ${r.desc} | ${r.pass ? 'PASS' : '**FAIL**'} | ${r.checks.filter(x => !x.ok).map(x => `${x.field}: want ${x.want}, got ${x.have}`).join('; ')} | ${r.trace} |`));
fs.writeFileSync(path.join(__dirname, 'results', 'rules.md'), md.join('\n') + '\n');

console.log(`cases ${passCases}/${CASES.length} · checks ${checks - fails}/${checks} · very-high recall ${summary.veryHighRecall} · false reassurance ${falseReassure.length} · blocked offered ${blockedOffered.length} · signable while blocked ${signableWhenBlocked.length}`);
rows.filter(r => !r.pass).forEach(r => console.log(`FAIL ${r.id} ${r.desc}: ` + r.checks.filter(x => !x.ok).map(x => `${x.field} want ${x.want} got ${x.have}`).join('; ')));
process.exitCode = (fails || signableWhenBlocked.length) ? 1 : 0;
