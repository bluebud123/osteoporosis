/*
 * Scores the case finder against bench/reports.js (hand-labelled synthetic reports, DRAFT labels).
 * Default reader: the deterministic baseline in src/finder.js.
 * `node bench/run-finder.js --ai` scores an AI reader instead (needs ANTHROPIC_API_KEY); every AI answer
 * also has to pass verify(), so invented evidence counts as a failure.
 * Writes bench/results/finder.md (or finder-ai.md). Exit 1 if a safety threshold fails.
 */
const fs = require('fs'), path = require('path');
const F = require('../src/finder.js');
const SETS = [['dev', require('./reports.js')], ['stress', require('./reports-stress.js')]];
const AI = process.argv.includes('--ai');

/* Adversarial checks for verify(): it must reject unsupported 'act' findings and accept real ones. */
function verifierAdversarial() {
  const RT = require('./reports-redteam.js');
  const all = [...SETS[0][1], ...SETS[1][1], ...RT], byId = id => all.find(r => r.id === id);
  const cases = [
    ['rejects act quoting a negated sentence', { text: 'Lungs clear. No fracture.' }, { decision: 'act', evidence: ['No fracture.'] }, false],
    ['rejects act quoting a sentence with no fracture term', { text: 'Lungs are clear. No effusion.' }, { decision: 'act', evidence: ['Lungs are clear.'] }, false],
    ['rejects act quoting a pathological fracture', { text: 'Pathological fracture of T12 due to myeloma.' }, { decision: 'act', evidence: ['Pathological fracture of T12 due to myeloma.'] }, false],
    ['rejects act quoting "renal insufficiency"', { text: 'Chronic renal insufficiency noted.' }, { decision: 'act', evidence: ['Chronic renal insufficiency noted.'] }, false],
    ['rejects act quoting lung collapse', { text: 'Right lower lobe collapse.' }, { decision: 'act', evidence: ['Right lower lobe collapse.'] }, false],
    ['accepts act quoting vertebral collapse (R010)', byId('R010'), { decision: 'act', site: 'vert', evidence: ['Vertebral bodies: L3 is collapsed.'] }, true],
    ['rejects evidence not in the report', { text: 'Lungs clear.' }, { decision: 'act', evidence: ['Fracture of the neck of femur.'] }, false],
    ['accepts act quoting "# NOF left, displaced." (S01)', byId('S01'), { decision: 'act', site: 'hip', evidence: ['# NOF left, displaced.'] }, true],
    ['accepts act quoting the R001 fracture sentence', byId('R001'), { decision: 'act', site: 'vert', evidence: ['Incidental moderate wedge compression fracture of T8 with approximately 35% anterior height loss.'] }, true],
    // Vocabulary added for the red-team set (docs/redteam/clinician.md B4, B5, M13)
    ['accepts act quoting the history-excluded fracture (RT01)', byId('RT01'), { decision: 'act', site: 'vert', evidence: ['Current: L1 wedge fracture, osteoporotic pattern.'] }, true],
    ['accepts act quoting the clean fracture clause (RT15)', byId('RT15'), { decision: 'act', site: 'hip', evidence: ['Left femoral neck fracture, not seen on right.'] }, true],
    ['accepts act quoting shorthand "Comminuted # distal radius" (RT22)', byId('RT22'), { decision: 'act', site: 'wrist', evidence: ['Comminuted # distal radius'] }, true],
    ['accepts act quoting "Vertebra plana at T9." (RT23)', byId('RT23'), { decision: 'act', site: 'vert', evidence: ['Vertebra plana at T9.'] }, true],
    ['accepts act quoting prior hip fixation (RT21)', byId('RT21'), { decision: 'act', site: 'hip', evidence: ['Status post ORIF of left neck of femur (2015).'] }, true],
    ['rejects act quoting cemented hardware with no hip word (RT28)', byId('RT28'), { decision: 'act', site: 'hip', evidence: ['Cemented left hemiarthroplasty in situ.'] }, false],
    ['rejects act quoting "Lung collapse excluded."', { text: 'Lung collapse excluded.' }, { decision: 'act', evidence: ['Lung collapse excluded.'] }, false],
    ['rejects act quoting "Compression of the spinal cord at C5 by disc prolapse."', byId('RT31'), { decision: 'act', site: 'vert', evidence: ['Compression of the spinal cord at C5 by disc prolapse.'] }, false],
    ['rejects act quoting "Compression of L4 nerve root by facet hypertrophy."', byId('RT32'), { decision: 'act', site: 'vert', evidence: ['Compression of L4 nerve root by facet hypertrophy.'] }, false],
    ['rejects act quoting hedged "Cannot exclude L1 fracture." (RT33)', byId('RT33'), { decision: 'act', site: 'vert', evidence: ['Cannot exclude L1 fracture.'] }, false],
    ['rejects act quoting "Fracture not excluded at L1." (RT34)', byId('RT34'), { decision: 'act', site: 'vert', evidence: ['Fracture not excluded at L1.'] }, false],
    ['rejects act quoting a fracture when pathology is elsewhere (RT09)', byId('RT09'), { decision: 'act', site: 'vert', evidence: ['Compression deformity of T7.'] }, false],
    ['rejects act quoting a fracture when trauma is elsewhere (RT07)', byId('RT07'), { decision: 'act', site: 'hip', evidence: ['Left femoral neck fracture, displaced.'] }, false],
    ['rejects act quoting a negated fracture (RT35)', byId('RT35'), { decision: 'act', site: 'vert', evidence: ['Fracture has been excluded at L1.'] }, false],
    ['accepts review quoting "Cannot exclude L1 fracture." (RT33)', byId('RT33'), { decision: 'review', site: 'vert', evidence: ['Cannot exclude L1 fracture.'] }, true],
    ['rejects review quoting "Compression of L4 nerve root" (RT32)', byId('RT32'), { decision: 'review', site: 'vert', evidence: ['Compression of L4 nerve root by facet hypertrophy.'] }, false],
    ['rejects act quoting hip arthroplasty for osteoarthritis (not fracture surgery)', { text: 'Cemented left total hip arthroplasty for osteoarthritis.' }, { decision: 'act', site: 'hip', evidence: ['Cemented left total hip arthroplasty for osteoarthritis.'] }, false],
    ['rejects act quoting a negation whose scope is unclear ("No acute, displaced fracture of L2.")', { text: 'No acute, displaced fracture of L2.' }, { decision: 'act', site: 'vert', evidence: ['No acute, displaced fracture of L2.'] }, false],
    ['accepts review quoting the same unclear negation sentence', { text: 'No acute, displaced fracture of L2.' }, { decision: 'review', site: 'vert', evidence: ['No acute, displaced fracture of L2.'] }, true]
  ];
  let pass = 0;
  cases.forEach(([name, r, out, want]) => {
    const ok = F.verify(r, out).ok === want;
    if (ok) pass++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} verifier: ${name}`);
  });
  console.log(`verifier adversarial ${pass}/${cases.length}`);
  return pass === cases.length ? 0 : 1;
}
const ADV_GATE = verifierAdversarial();

async function aiRead(r) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.FINDER_MODEL || 'claude-haiku-5-5', max_tokens: 400, system: F.AI_PROMPT,
      messages: [{ role: 'user', content: `Age ${r.age}, sex ${r.sex}. Study: ${r.mod}. Indication: ${r.ind}.\nReport: ${r.text}` }] })
  });
  const j = await res.json(); const t = (j.content || []).map(c => c.text || '').join('');
  try { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch (e) { return { decision: 'invalid', evidence: [] }; }
}

(async () => {
  if (AI && !process.env.ANTHROPIC_API_KEY) { console.log('finder --ai: ANTHROPIC_API_KEY not set, skipped'); return; }
  const allMd = []; let gate = 0;
  for (const [setName, REPORTS] of SETS) {
  const outs = [];
  for (const r of REPORTS) outs.push(AI ? await aiRead(r) : F.find(r));
  const S = F.score(REPORTS, outs), L = ['act', 'review', 'no'];
  const { conf, rows, verifyFails, tp, fn, sens, ppv, acc, surfaced } = S, missedSilently = S.dismissed;
  const pct = x => (100 * x).toFixed(0) + '%';
  const summary = `reports ${rows.length} · exact ${pct(acc)} · act sensitivity ${pct(sens)} (${tp}/${tp + fn}) · act PPV ${pct(ppv)} · fractures surfaced to a human ${surfaced}/${tp + fn} · silently dismissed ${missedSilently} · unverifiable outputs ${verifyFails}`;
  const md = [`## ${setName === 'dev' ? 'Development set (100 reports; written alongside the baseline, so the baseline is tuned to it)' : 'Stress set (15 reports; unfamiliar wording and clinical shorthand)'}`, '', `- ${summary.split(' · ').join('\n- ')}`, '',
    '### Confusion matrix (rows = label, columns = finder)', '', '| label \\ finder | act | review | no |', '| --- | --- | --- | --- |',
    ...L.map(a => `| ${a} | ${L.map(b => conf[a][b]).join(' | ')} |`), '',
    '### Disagreements', '', '| ID | Label | Finder | Reason | Report |', '| --- | --- | --- | --- | --- |',
    ...rows.filter(x => !x.ok).map(x => `| ${x.r.id} | ${x.r.label} | ${x.got} | ${(x.out.reasons || [x.out.reason || '']).join('; ')}${x.v.ok ? '' : ' (UNVERIFIED: ' + x.v.problems.join('; ') + ')'} | ${x.r.text.replace(/\|/g, '/')} |`)];
  allMd.push(...md, '');
  console.log(`finder[${setName}] ` + summary);
  // Safety gate on the development set: no documented fragility fracture silently dismissed; every output verifies.
  // The stress set is reported, not gated: it documents where keyword rules break.
  if (setName === 'dev' && (missedSilently > 0 || verifyFails > 0)) gate = 1;
  if (AI && verifyFails > 0) gate = 1;
  }
  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'results', AI ? 'finder-ai.md' : 'finder.md'),
    [`# Case finder results (${AI ? 'AI reader' : 'deterministic baseline'})`, '', '_Labels are drafts pending clinical lead sign-off. All reports are synthetic. A blind set written by clinicians who have not seen the rules is still needed._', '', ...allMd].join('\n') + '\n');
  // Red-team set (docs/redteam/clinician.md B4, B5, M13): reported in bench/results/redteam.md.
  // Gated on the two things a human cannot recover from: act-labelled reports silently dismissed, and unverifiable output.
  const RT = require('./reports-redteam.js'), rtOuts = RT.map(r => F.find(r)), RS = F.score(RT, rtOuts), L3 = ['act', 'review', 'no'];
  const RUN = (process.argv.find(a => a.startsWith('--label=')) || '--label=current').slice(8);
  const rtRows = RS.rows.filter(x => !x.ok).map(x => `| ${x.r.id} | ${x.r.label} | ${x.got} | ${(x.out.reasons || []).join('; ')}${x.v.ok ? '' : ' (UNVERIFIED: ' + x.v.problems.join('; ') + ')'} | ${x.r.text.replace(/\|/g, '/')} |`);
  const rtSummary = `reports ${RS.n} · exact ${(100 * RS.acc).toFixed(0)}% · act sensitivity ${(100 * RS.sens).toFixed(0)}% (${RS.tp}/${RS.tp + RS.fn}) · act PPV ${(100 * RS.ppv).toFixed(0)}% · fractures surfaced to a human ${RS.surfaced}/${RS.tp + RS.fn} · silently dismissed ${RS.dismissed} · unverifiable outputs ${RS.verifyFails}`;
  console.log(`finder[redteam, ${RUN}] ` + rtSummary);
  const rtMd = [`## Run: ${RUN}`, '', `- ${rtSummary.split(' · ').join('\n- ').replace(/\n- /g, '\n- ')}`, '',
    '| label \\ finder | act | review | no |', '| --- | --- | --- | --- |', ...L3.map(a => `| ${a} | ${L3.map(b => RS.conf[a][b]).join(' | ')} |`), '',
    '| ID | Label | Finder | Reason | Report |', '| --- | --- | --- | --- | --- |', ...rtRows, ''];
  const rtFile = path.join(__dirname, 'results', 'redteam.md');
  const prev = fs.existsSync(rtFile) ? fs.readFileSync(rtFile, 'utf8') : '';
  const kept = prev.split(/\n(?=## Run: )/).filter(sec => sec.startsWith('## Run: ') && !sec.startsWith('## Run: ' + RUN + '\n'));
  fs.writeFileSync(rtFile, ['# Red-team finder results (clinician probes, docs/redteam/clinician.md)', '', '_Set written from the reviewer\'s probes, not blind; labels were fixed before any change to src/finder.js and were not changed afterwards. Synthetic reports. Gated: silently dismissed = 0 and unverifiable = 0._', '',
    '_Notes: RT07 (trauma stated in the sentence after the fracture) was labelled review before the fix. The rule now treats a current, non-historical mechanism as high-energy for this episode (the same rule that keeps dev R071 to R076 and R094 as no and keeps loop L25 passing), so RT07 gives no. The label and the rule disagree, and a clinician should decide which is right. The dev set went from 98% to 91% exact in an earlier draft of the fix because trauma elsewhere went to review; the current rule restores 98%._', '',
    ...kept.map(sec => sec.trimEnd() + '\n'), rtMd.join('\n')].join('\n') + '\n');
  if (RS.dismissed > 0 || RS.verifyFails > 0) gate = 1;
  process.exitCode = gate || ADV_GATE;
})();
