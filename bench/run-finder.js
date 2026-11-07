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
  process.exitCode = gate;
})();
