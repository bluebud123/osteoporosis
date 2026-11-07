/*
 * Tests the reader adapters, the single verifier gate (readVerified) and deidentify(). Then scores the keyword
 * baseline on the Arabic set and the real-format set, and writes bench/results/readers.md, arabic.md, real-format.md.
 *
 * Exit code: 1 only if a unit test fails. The Arabic and real-format accuracy is reported, not gated, because
 * those sets exist to show where the baseline breaks. Silent dismissals are listed in the result tables.
 * No network: the openai-compatible adapter is tested with an injected fake fetch.
 */
const fs = require('fs'), path = require('path');
const F = require('../src/finder.js');
const RD = require('../src/readers.js');
const DEV = require('./reports.js'), STRESS = require('./reports-stress.js');
const AR = require('./reports-arabic.js'), RF = require('./reports-real-format.js');
const RESULTS = path.join(__dirname, 'results');

let pass = 0, fail = 0;
const lines = [];
function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  const line = `  ${ok ? 'PASS' : 'FAIL'} ${name}${!ok && detail ? ' :: ' + detail : ''}`;
  console.log(line); lines.push(line);
}
const byId = id => [...DEV, ...STRESS].find(r => r.id === id);
const sameDecision = (a, b) => a === b;

/* ---------- 1. adapters ---------- */
async function adapterTests() {
  console.log('\nAdapters');
  const kw = RD.keywordReader();
  let mismatches = [];
  for (const r of [...DEV, ...STRESS]) {
    const want = F.find(r).decision, got = (await kw.read(r)).decision;
    if (!sameDecision(want, got)) mismatches.push(r.id);
  }
  check('keyword adapter gives the same decision as F.find on all 115 existing reports', mismatches.length === 0, mismatches.join(','));
  const o = await kw.read(byId('R001'));
  check('keyword adapter output has decision, site, evidence array and reason string', o.decision === 'act' && Array.isArray(o.evidence) && typeof o.reason === 'string' && o.reason.length > 0);

  let calls = 0;
  const fake = () => { calls++; return Promise.resolve({ ok: true, json: async () => ({ choices: [{ message: { content: '{"decision":"no","evidence":[],"reason":"x"}' } }] }) }); };
  const ctor = RD.openaiCompatibleReader({ baseURL: 'https://api.example.ae/v1', model: 'm', fetchImpl: fake });
  check('openai-compatible: constructing the adapter makes no network call', calls === 0);
  check('openai-compatible: localhost is inferred local, a hosted endpoint is not',
    RD.openaiCompatibleReader({ baseURL: 'http://localhost:8080/v1', model: 'm' }).local === true && ctor.local === false);
  check('claude-sample: absent capability is reported unavailable, not thrown', RD.claudeSampleReader().available() === false);
  const unav = await RD.readVerified(RD.claudeSampleReader(), byId('R001'));
  check('claude-sample: absent capability returns status unavailable and no decision', unav.status === 'unavailable' && unav.decision === null);
}

/* ---------- 2. verifier gate, identical for every adapter ---------- */
async function verifierTests() {
  console.log('\nVerifier gate (readVerified)');
  const r1 = byId('R001');
  const valid = { decision: 'act', site: 'vert', evidence: ['Incidental moderate wedge compression fracture of T8 with approximately 35% anterior height loss.'], reason: 'ok' };
  const invented = { decision: 'act', site: 'hip', evidence: ['Fracture of the neck of femur.'], reason: 'made up' };
  const negated = { decision: 'act', site: 'vert', evidence: ['Lungs are clear.'], reason: 'no fracture term' };
  const badDecision = { decision: 'maybe', evidence: [], reason: 'x' };
  const mk = out => RD.mockReader(() => out, 'mock');
  const v1 = await RD.readVerified(mk(valid), r1);
  check('valid quoted act is accepted as act', v1.decision === 'act' && v1.verified === true, JSON.stringify(v1));
  const v2 = await RD.readVerified(mk(invented), r1);
  check('invented evidence is downgraded to review', v2.decision === 'review' && v2.verified === false && v2.problems.some(p => /not found/.test(p)));
  const v3 = await RD.readVerified(mk(negated), r1);
  check('act quoting a non-fracture sentence is downgraded to review', v3.decision === 'review' && v3.verified === false);
  const v4 = await RD.readVerified(mk(badDecision), r1);
  check('invalid decision string is downgraded to review', v4.decision === 'review' && v4.verified === false);
  const v5 = await RD.readVerified(RD.mockReader({}, 'empty'), r1);
  check('reader error (no answer) is downgraded to review, status error', v5.decision === 'review' && v5.status === 'error');
  const floorNo = await RD.readVerified(mk({ decision: 'no', evidence: [], reason: 'dismissed' }), r1);
  check('reader "no" on a report the keyword baseline calls act is floored to review', floorNo.decision === 'review' && floorNo.floored === true);
  const noFloor = await RD.readVerified(mk({ decision: 'no', evidence: [], reason: 'dismissed' }), r1, { floor: false });
  check('with floor disabled, reader "no" stands (for measurement only)', noFloor.decision === 'no' && noFloor.floored === false);
  const noFx = { id: 'NF1', age: 70, sex: 'F', mod: 'CXR', ind: 'Cough', text: 'Lungs clear. Heart size normal.' };
  const cleanNo = await RD.readVerified(mk({ decision: 'no', evidence: [], reason: 'none' }), noFx);
  check('reader "no" on a report with no fracture is not floored', cleanNo.decision === 'no' && cleanNo.floored === false, JSON.stringify(cleanNo));

  // The same invented output must be rejected through every adapter, not just the mock.
  const viaSample = RD.claudeSampleReader({ getSample: async () => ({ json: async () => [invented] }) });
  const viaOpenai = RD.openaiCompatibleReader({ baseURL: 'https://api.example.ae/v1', model: 'm', fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(invented) } }] }) }) });
  const viaKeyword = RD.mockReader(() => invented, 'keyword-like');
  const outs = await Promise.all([viaSample, viaOpenai, viaKeyword].map(rd => RD.readVerified(rd, r1)));
  check('the same invented output is downgraded identically by claude-sample, openai-compatible and mock',
    outs.every(o => o.decision === 'review' && o.verified === false), outs.map(o => o.decision + '/' + o.verified).join(' '));
  const sampleOk = await RD.readVerified(RD.claudeSampleReader({ getSample: async () => ({ json: async () => [valid] }) }), r1);
  check('claude-sample: a valid quoted act through the injected sample is accepted', sampleOk.decision === 'act' && sampleOk.verified === true);
  const sampleErr = await RD.readVerified(RD.claudeSampleReader({ getSample: async () => ({ json: async () => { throw new Error('boom'); } }) }), r1);
  check('claude-sample: a thrown error becomes review with status error', sampleErr.decision === 'review' && sampleErr.status === 'error');
}

/* ---------- 3. openai-compatible request shape, de-identification before a hosted reader ---------- */
async function requestTests() {
  console.log('\nRequest shape and de-identification');
  const rep = { id: 'Q1', age: 76, sex: 'F', mod: 'XR spine', ind: 'Back pain', text: 'Dr. Tan Shun Herng reviewed. Compression fracture of T8, 30% height loss.' };
  const sent = [];
  const fetchImpl = async (url, init) => { sent.push({ url, body: JSON.parse(init.body), headers: init.headers }); return { ok: true, json: async () => ({ choices: [{ message: { content: '```json\n{"decision":"act","site":"vert","evidence":["Compression fracture of T8, 30% height loss."],"reason":"x"}\n```' } }] }) }; };
  const hosted = RD.openaiCompatibleReader({ baseURL: 'https://api.example.ae/v1/', model: 'hosted-m', apiKey: 'k-test', fetchImpl });
  const out = await RD.readVerified(hosted, rep);
  check('openai-compatible: posts to baseURL + /chat/completions with the bearer key', sent[0] && sent[0].url === 'https://api.example.ae/v1/chat/completions' && sent[0].headers.authorization === 'Bearer k-test');
  const userMsg = sent[0] && sent[0].body.messages[1].content;
  check('hosted (non-local) reader never receives the clinician name', userMsg && !/Shun Herng/.test(userMsg) && /\[NAME\]/.test(userMsg), userMsg);
  check('hosted reader result is parsed from fenced JSON and verified against the de-identified text', out.decision === 'act' && out.verified === true && out.deidentified === true, JSON.stringify(out));
  const local = RD.openaiCompatibleReader({ baseURL: 'http://127.0.0.1:8080/v1', model: 'local-m', fetchImpl });
  await RD.readVerified(local, rep);
  check('local model (localhost) receives the text unchanged', /Shun Herng/.test(sent[1].body.messages[1].content));
  const bad = RD.openaiCompatibleReader({ baseURL: 'https://api.example.ae/v1', model: 'm', fetchImpl: async () => ({ ok: false, status: 500 }) });
  const badOut = await RD.readVerified(bad, rep);
  check('HTTP 500 becomes review with status error', badOut.decision === 'review' && badOut.status === 'error');
}

/* ---------- 4. de-identification ---------- */
function deidTests() {
  console.log('\ndeidentify');
  const cases = [
    ['names after a title are removed, the rest kept', 'Dr. Ahmad bin Ali reviewed the film.', 'Dr. [NAME] reviewed the film.'],
    ['a name after Prof', 'Prof Kwan Mun Keong advised.', 'Prof [NAME] advised.'],
    ['a name after a Patient: cue', 'Patient name: Siti Aminah binti Yusof. Age 74.', 'Patient name: [NAME]. Age 74.'],
    ['an all-caps name after PATIENT:', 'PATIENT: TAN SHUN HERNG. FRACTURE OF T8.', 'PATIENT: [NAME]. FRACTURE OF T8.'],
    ['a clinical word after a title is kept (name stops at it)', 'Dr. Tan Fracture noted.', 'Dr. [NAME] Fracture noted.'],
    ['Arabic name after د. (two tokens)', 'د. أحمد علي.', 'د. [NAME].'],
    ['Arabic name with a connector, and the clinical word after it is kept', 'د. محمد بن عبدالله كسر في الفقرة T8', 'د. [NAME] كسر في الفقرة T8'],
    ['dates: numeric, dd-Mon-yyyy, d Month yyyy, Mon d, yyyy', 'Dated 03/11/2024 and 12-Jan-2023, seen 5 March 2021, Mar 5, 2021.', 'Dated [DATE] and [DATE], seen [DATE], [DATE].'],
    ['international and local phone numbers', 'Call +971 50 123 4567 or 012-345 6789.', 'Call [PHONE] or [PHONE].'],
    ['Emirates ID 784-YYYY-NNNNNNN-N', 'EID 784-1985-1234567-1 on file.', 'EID [ID] on file.'],
    ['labelled MRN', 'MRN: 00456789 seen.', '[MRN] seen.'],
    ['a long digit run (accession number)', 'Accession 20240501123 noted.', 'Accession [ID] noted.'],
    ['e-mail address', 'Contact dr.tan@example.com', 'Contact [EMAIL]'],
    ['Arabic-Indic digits in a phone number', 'اتصل ٠٥٠١٢٣٤٥٦٧٨ الآن', 'اتصل [PHONE] الآن'],
    ['clinical text with level labels and percentages is unchanged', 'Fracture of T8 with 35% height loss; age 74.', 'Fracture of T8 with 35% height loss; age 74.'],
    ['Arabic fracture sentence with a level label is unchanged', 'كسر انضغاطي في الفقرة T8 بنسبة 30%.', 'كسر انضغاطي في الفقرة T8 بنسبة 30%.'],
    // Over-redaction, kept on purpose so the trade-off is visible: a two-token-plus Arabic name takes the next word.
    ['OVER-REDACTION (documented): Arabic name takes the next Arabic word', 'د. أحمد علي أجرى الفحص.', 'د. [NAME] الفحص.'],
    // Known limits: these must NOT be caught. If one starts being caught, update the limit list and the README.
    ['KNOWN LIMIT: a name without a title or cue is not removed', 'Ahmad bin Ali presented with pain.', 'Ahmad bin Ali presented with pain.'],
    ['KNOWN LIMIT: a street address is not removed', 'Address: 12 Jalan Bukit Indah', 'Address: 12 Jalan Bukit Indah'],
    ['KNOWN LIMIT: a quasi-identifier (occupation, age, place) is not removed', 'Retired pilot aged 91 from Penang.', 'Retired pilot aged 91 from Penang.'],
    ['KNOWN LIMIT: an Arabic name without a title is not removed', 'أحمد علي أجرى الفحص', 'أحمد علي أجرى الفحص']
  ];
  for (const [name, input, want] of cases) {
    const got = RD.deidentify(input);
    check('deid: ' + name, got === want, `got "${got}" want "${want}"`);
  }
  const once = RD.deidentify(cases[0][1]);
  check('deid is idempotent', RD.deidentify(once) === once);
  const r = RD.deidentifyDetailed('Dr. Tan Shun Herng: Fracture of T8. Dated 1/2/2020.');
  check('deidentifyDetailed reports what it removed', r.counts.NAME === 1 && r.counts.DATE === 1, JSON.stringify(r.counts));
  check('deid never removes the word fracture from a report', RD.deidentify('Dr. Tan: fracture of L1, no acute finding.').includes('fracture'));
}

/* ---------- 5. Arabic and real-format tables (not gated) ---------- */
async function setTable(name, file, REPORTS, notes) {
  const kw = RD.keywordReader(); const rows = [];
  for (const r of REPORTS) {
    const res = await RD.readVerified(kw, r);
    rows.push({ r, res, got: res.decision });
  }
  const L = ['act', 'review', 'no'], conf = {}; L.forEach(a => { conf[a] = {}; L.forEach(b => conf[a][b] = 0); });
  rows.forEach(x => conf[x.r.label][x.got]++);
  const tp = conf.act.act, actTotal = conf.act.act + conf.act.review + conf.act.no;
  const exact = rows.filter(x => x.got === x.r.label).length;
  const silent = rows.filter(x => x.r.label === 'act' && x.got === 'no');
  const surfaced = conf.act.act + conf.act.review;
  const fpNotAct = conf.review.act + conf.no.act;
  // Cross-check: the shared scorer must agree with this table for the keyword reader.
  const sc = F.score(REPORTS, REPORTS.map(r => F.find(r)));
  check(`${name}: keyword adapter agrees with F.score on exact count`, sc.rows.filter(x => x.ok).length === exact, `${sc.rows.filter(x => x.ok).length} vs ${exact}`);
  const pct = x => (100 * x).toFixed(0) + '%';
  const summary = [
    `reports ${rows.length}`,
    `exact ${pct(exact / rows.length)} (${exact}/${rows.length})`,
    `act sensitivity ${pct(tp / actTotal)} (${tp}/${actTotal})`,
    `fractures surfaced to a human (act or review) ${surfaced}/${actTotal}`,
    `silently dismissed (label act, finder no) ${silent.length}${silent.length ? ': ' + silent.map(x => x.r.id).join(', ') : ''}`,
    `act-labelled calls that were not act ${fpNotAct} (review or no labels called act)`,
    `unverified reader outputs ${rows.filter(x => !x.res.verified).length}`
  ];
  const md = [`# ${name}`, '', '_Reader: keyword baseline (src/finder.js) through readVerified(). Labels were written before the lexicon or any change was made for this set, and were not changed after the first run. All reports are synthetic. Not gated._', '',
    '## Summary', '', ...summary.map(s => '- ' + s), '', ...notes.map(n => '- ' + n), '',
    '## Confusion matrix (rows = label, columns = finder)', '', '| label \\ finder | act | review | no |', '| --- | --- | --- | --- |',
    ...L.map(a => `| ${a} | ${L.map(b => conf[a][b]).join(' | ')} |`), '',
    '## Every report', '', '| ID | Label | Finder | Verified | Reason | Report |', '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(x => `| ${x.r.id} | ${x.r.label} | ${x.got} | ${x.res.verified ? 'yes' : 'no'} | ${String(x.res.reason).replace(/\|/g, '/')} | ${x.r.text.replace(/\|/g, '/')} |`), ''];
  fs.writeFileSync(path.join(RESULTS, file), md.join('\n'));
  console.log(`${name}: ${summary.join(' · ')}`);
  return { exact, n: rows.length, silent: silent.map(x => x.r.id) };
}

(async () => {
  fs.mkdirSync(RESULTS, { recursive: true });
  await adapterTests();
  await verifierTests();
  await requestTests();
  deidTests();

  console.log('\nArabic and real-format sets (reported, not gated)');
  const ar = await setTable('Arabic and bilingual reports (15)', 'arabic.md', AR, [
    'Lexicon added to src/finder.js for this set: fracture, compression, vertebra, femur neck, wrist, humerus, pelvis, negation, uncertainty, trauma, tumour and metastasis, with explicit Arabic boundaries.',
    'The author wrote the labels knowing this lexicon, so the vocabulary is not independent of the code. The result is an upper bound on how well the same lexicon handles unseen Arabic.'
  ]);
  const rf = await setTable('Real-format reports (12)', 'real-format.md', RF, [
    'Templated, all-caps and abbreviated formats. The baseline was not changed for this set.',
    'Abbreviations FX and VCF, and the misspelling "compresion fracure", are not in the lexicon, and that is the point of the set.'
  ]);

  const unit = `unit checks ${pass}/${pass + fail}`;
  const head = ['# Reader adapter, verifier and de-identification tests', '', `_${unit}. Run with npm run bench:readers._`, '', ...lines, ''];
  fs.writeFileSync(path.join(RESULTS, 'readers.md'), head.join('\n'));
  console.log(`\n${unit}`);
  console.log(`Arabic exact ${ar.exact}/${ar.n}, silently dismissed ${ar.silent.length}. Real-format exact ${rf.exact}/${rf.n}, silently dismissed ${rf.silent.length}.`);
  process.exitCode = fail ? 1 : 0;
})();
