/*
 * Tests for the site profile schema (src/site.js) and the report ingest parsers (src/ingest.js), then an end-to-end
 * check: each parsed fixture report goes through the case finder (src/finder.js find()) and its verifier (verify()).
 * Fixtures are in bench/ingest-fixtures/ with hand-written expectations in expected.json. All data is synthetic.
 * Writes bench/results/ingest.md. Exit 1 on any failure. No network calls.
 */
const fs = require('fs'), path = require('path');
const S = require('../src/site.js');
const I = require('../src/ingest.js');
const F = require('../src/finder.js');

const FIX = path.join(__dirname, 'ingest-fixtures');
const EXP = JSON.parse(fs.readFileSync(path.join(FIX, 'expected.json'), 'utf8'));
const readFix = f => fs.readFileSync(path.join(FIX, f), 'utf8');

const sections = [];
let cur = null;
const failures = [];
function section(name) { cur = { name, pass: 0, total: 0 }; sections.push(cur); console.log('\n== ' + name); }
function check(name, ok, detail) {
  cur.total++;
  if (ok) cur.pass++;
  else { failures.push(cur.name + ': ' + name + (detail ? ' [' + detail + ']' : '')); console.log('  FAIL ' + name + (detail ? ' [' + detail + ']' : '')); }
}
const j = v => JSON.stringify(v);
const has = (arr, x) => Array.isArray(arr) && arr.includes(x);

/* ================= 1. site profile schema ================= */
section('Site profiles (src/site.js)');
for (const id of ['my-moh', 'uae-doh', 'generic']) {
  const pr = S.validate(S.getProfile(id));
  check(`shipped profile "${id}" validates`, pr.length === 0, pr.join('; '));
}
const uae = S.getProfile('uae-doh'), moh = S.getProfile('my-moh');
check('uae-doh is an interim stand-in with an explicit warning', uae.guideline.interim === true && /INTERIM/.test(uae.guideline.warning || ''));
check('uae-doh languages are ar and en', j(uae.languages) === '["ar","en"]', j(uae.languages));
check('my-moh lists en, ms and ar, with ar optional', j(moh.languages) === '["en","ms","ar"]' && j(moh.optionalLanguages) === '["ar"]');
check('shipped profiles keep all three safety controls on', ['my-moh', 'uae-doh', 'generic'].every(id => j(S.getProfile(id).controls) === j({ verifier: true, humanReview: true, closureGate: true })));
check('shipped stage clocks match the app (0,7,30,7,14,90,30; urgent confirm 42)', j(moh.stageClocks) === j({ '0': 0, '1': 7, '2': 30, '3': 7, '4': 14, '5': 90, '6': 30, confirmUrgent: 42 }));

// Each case mutates a valid my-moh profile. validate() must reject every one.
const BAD = [
  ['verifier switched off', p => { p.controls.verifier = false; }],
  ['human review switched off', p => { p.controls.humanReview = false; }],
  ['closure gate switched off', p => { p.controls.closureGate = false; }],
  ['controls removed entirely', p => { delete p.controls; }],
  ['unknown control added', p => { p.controls.aiBypass = true; }],
  ['interim guideline with no warning', p => { p.guideline.interim = true; p.guideline.warning = ''; }],
  ['confirmed guideline without sign-off', p => { p.guideline.status = 'confirmed'; p.guideline.signOff = null; }],
  ['interim guideline marked confirmed', p => { p.guideline.interim = true; p.guideline.warning = 'x'; p.guideline.status = 'confirmed'; p.guideline.signOff = 'x'; }],
  ['unsupported language', p => { p.languages = ['fr']; }],
  ['language listed twice', p => { p.languages = ['en', 'en']; }],
  ['optional language not in languages', p => { p.optionalLanguages = ['ar']; p.languages = ['en']; }],
  ['local-only residency with claude-sample reader', p => { p.dataResidency = { mode: 'local-only', reader: 'claude-sample' }; }],
  ['local-only residency with openai-compatible reader', p => { p.dataResidency = { mode: 'local-only', reader: 'openai-compatible' }; }],
  ['unknown residency mode', p => { p.dataResidency = { mode: 'anywhere', reader: 'keyword' }; }],
  ['country not a two-letter code', p => { p.country = 'Malaysia'; }],
  ['id is __proto__', p => { p.id = '__proto__'; }],
  ['forbidden key inside limits', p => { p.limits = JSON.parse('{"maxRows":5,"__proto__":{"polluted":"yes"}}'); }],
  ['forbidden key inside formulary', p => { p.formulary = JSON.parse('{"placeholder":true,"available":[],"blocked":[],"constructor":{"prototype":{"x":1}}}'); }],
  ['indicator window of 0 months', p => { p.indicatorWindowMonths = 0; }],
  ['indicator window of 25 months', p => { p.indicatorWindowMonths = 25; }],
  ['all input routes disabled', p => { p.feeds = { hl7v2: false, fhir: false, csv: false, paste: false }; }],
  ['unknown feed', p => { p.feeds.dicom = true; }],
  ['placeholder formulary listing available drugs', p => { p.formulary = { placeholder: true, available: ['alendronate'], blocked: [] }; }],
  ['drug both available and blocked', p => { p.formulary = { placeholder: false, available: ['alendronate'], blocked: ['alendronate'] }; }],
  ['invalid drug id', p => { p.formulary = { placeholder: false, available: ['Alendronate 70mg'], blocked: [] }; }],
  ['stage 6 clock missing', p => { delete p.stageClocks['6']; }],
  ['negative stage clock', p => { p.stageClocks['1'] = -1; }],
  ['stage clock not a whole number', p => { p.stageClocks['2'] = 30.5; }],
  ['owner role for a stage is empty', p => { p.roles['4'] = ''; }],
  ['unknown top-level field (typo for a control)', p => { p.skipVerifier = true; }],
  ['limit above the cap', p => { p.limits = { maxReportChars: 999999999 }; }],
  ['limit not a positive integer', p => { p.limits = { maxRows: 0 }; }],
  ['required field missing', p => { delete p.guideline; }]
];
for (const [name, mutate] of BAD) {
  const p = S.getProfile('my-moh');
  mutate(p);
  const pr = S.validate(p);
  check('rejects: ' + name, pr.length > 0, pr.length ? pr[0] : 'accepted');
}
const GOOD = [
  ['confirmed guideline with sign-off', p => { p.guideline.status = 'confirmed'; p.guideline.signOff = 'Clinical lead, 2026-11-01'; }],
  ['deidentified-external with claude-sample reader', p => { p.dataResidency = { mode: 'deidentified-external', reader: 'claude-sample' }; }],
  ['external-allowed with openai-compatible reader', p => { p.dataResidency = { mode: 'external-allowed', reader: 'openai-compatible' }; }],
  ['HL7 feed enabled for a site', p => { p.feeds.hl7v2 = true; }],
  ['formulary with blocked drugs only', p => { p.formulary = { placeholder: false, available: [], blocked: ['zoledronic-acid'] }; }]
];
for (const [name, mutate] of GOOD) {
  const p = S.getProfile('my-moh');
  mutate(p);
  const pr = S.validate(p);
  check('accepts: ' + name, pr.length === 0, pr.join('; '));
}

// merge() and resolve()
{
  const base = S.getProfile('my-moh');
  const before = j(base);
  const r1 = S.merge(base, { controls: { verifier: false } });
  check('merge refuses an override that turns off the verifier', r1.ok === false && r1.profile === null && has(r1.problems, 'override cannot turn off verifier'), j(r1.problems));
  const r2 = S.merge(base, { controls: { humanReview: false, closureGate: false } });
  check('merge refuses turning off human review and the closure gate together', r2.ok === false && r2.problems.length >= 2, j(r2.problems));
  const r3 = S.merge(base, { controls: { verifier: true, humanReview: true, closureGate: true } });
  check('merge accepts controls that stay on', r3.ok === true && j(r3.profile.controls) === j({ verifier: true, humanReview: true, closureGate: true }));
  const r4 = S.merge(base, { stageClocks: { '2': 45 }, languages: ['en'], optionalLanguages: [] });
  check('merge applies a per-site stage clock', r4.ok === true && r4.profile.stageClocks['2'] === 45 && r4.profile.stageClocks['1'] === 7, j(r4.problems));
  check('merge does not change the base profile', j(base) === before);
  const r5 = JSON.parse('{"__proto__":{"polluted":"yes"}}');
  const r5m = S.merge(base, r5);
  check('merge refuses a forbidden key in overrides', r5m.ok === false && r5m.problems.some(p => /forbidden key/.test(p)), j(r5m.problems));
  check('merge pollutes no prototype', ({}).polluted === undefined && Object.prototype.polluted === undefined);
  const r6 = S.merge(base, { guideline: { status: 'confirmed' } });
  check('merge refuses confirming a guideline without sign-off', r6.ok === false, j(r6.problems));
  const r7 = S.resolve('uae-doh', { formulary: { placeholder: false, available: ['alendronate'], blocked: ['zoledronic-acid'] } });
  check('resolve applies a formulary override to a shipped profile', r7.ok === true && has(r7.profile.formulary.available, 'alendronate'), j(r7.problems));
  check('resolve keeps the uae-doh warning', r7.ok && /INTERIM/.test(r7.profile.guideline.warning));
  check('resolve returns an error for an unknown profile', S.resolve('no-such-site').ok === false);
  check('getProfile refuses __proto__ and constructor', S.getProfile('__proto__') === null && S.getProfile('constructor') === null);
  const copy = S.getProfile('generic');
  copy.stageClocks['2'] = 999; copy.feeds.hl7v2 = true;
  check('getProfile returns a copy: changing it does not change the shipped profile', S.getProfile('generic').stageClocks['2'] === 30 && S.getProfile('generic').feeds.hl7v2 === false);
  check('validate rejects a non-object', S.validate(null).length > 0 && S.validate([]).length > 0);
}

/* ================= 2. HL7 v2 fixtures ================= */
const parsed = {};   // file -> parse result, used by the end-to-end section
function checkFixture(file, parser) {
  const exp = EXP[file];
  const r = parser(readFix(file), {});
  parsed[file] = r;
  check(`${file}: ok is ${exp.ok}`, r.ok === exp.ok, 'ok=' + r.ok + ' errors=' + r.errors.join(' | ').slice(0, 160));
  if (exp.ok) {
    check(`${file}: ${exp.reports.length} report(s)`, r.reports.length === exp.reports.length, 'got ' + r.reports.length);
    exp.reports.forEach((e, i) => {
      const x = r.reports[i] || {};
      check(`${file}: report ${i + 1} age ${j(e.age)}, sex ${j(e.sex)}, date ${j(e.date)}`, x.age === e.age && x.sex === e.sex && x.date === e.date, j({ age: x.age, sex: x.sex, date: x.date }));
      if (e.id) check(`${file}: report ${i + 1} id ${e.id}`, x.id === e.id, 'got ' + x.id);
    });
  } else {
    check(`${file}: no reports and an error is given`, r.reports.length === 0 && r.errors.length > 0);
  }
  for (const f of exp.flags) check(`${file}: flag "${f}" raised`, has(r.flags, f), j(r.flags));
  return r;
}
section('HL7 v2 fixtures (ORU^R01 and the failure cases)');
const hl7Files = Object.keys(EXP).filter(f => f.endsWith('.hl7'));
hl7Files.forEach(f => checkFixture(f, I.parseHl7));
{
  const r6 = parsed['hl7-06-nonstandard-escape-char.hl7'].reports[0];
  check('hl7-06: escape character # is honoured and #.br# becomes a line break', r6.text === 'Compression fracture of T9 \nLungs clear.', j(r6.text));
  const r2 = parsed['hl7-02-hip-escapes-lf.hl7'].reports[0];
  check('hl7-02: \\F\\ inside OBR-31 decodes to |', r2.ind === 'Hip pain|after slipping', j(r2.ind));
  check('hl7-02: \\.br\\ inside OBX decodes to a line break', r2.text.includes('femur.\nPelvis'), j(r2.text.slice(0, 80)));
  const r4 = parsed['hl7-04-malformed-segments.hl7'];
  check('hl7-04: malformed segment text is not read into the report', !r4.reports[0].text.includes('Malformed set id'));
  check('hl7-04: two malformed segments are reported as warnings', r4.warnings.filter(w => /malformed segment/.test(w)).length === 2);
  const r5 = parsed['hl7-05-truncated.hl7'];
  check('hl7-05: truncation is flagged, not silently accepted as complete', has(r5.flags, 'possible-truncation'));
  const r7 = parsed['hl7-07-empty-and-cancelled-obx.hl7'].reports[0];
  check('hl7-07: a cancelled OBX is never used', !r7.text.includes('Fracture of T5'), j(r7.text));
  check('hl7-07: empty OBX is ignored with a warning', parsed['hl7-07-empty-and-cancelled-obx.hl7'].warnings.some(w => /empty OBX/.test(w)));
  const r8 = parsed['hl7-08-arabic-text.hl7'].reports[0];
  check('hl7-08: Arabic text is kept verbatim with no mojibake flag', /كسر انضغاطي/.test(r8.text) && !has(parsed['hl7-08-arabic-text.hl7'].flags, 'possible-mojibake'));
  check('hl7-08: Arabic indication decodes', r8.ind === 'ألم أسفل الظهر', j(r8.ind));
  const r9 = parsed['hl7-09-adt-not-oru.hl7'];
  check('hl7-09: error names the message type', r9.errors.some(e => /not an ORU/.test(e)));
  const r10 = parsed['hl7-10-no-pid-html.hl7'].reports[0];
  check('hl7-10: HTML is kept verbatim (verifier quotes must match) and flagged', r10.text.includes('<script>') && has(parsed['hl7-10-no-pid-html.hl7'].flags, 'html-markup'));
  const r11 = parsed['hl7-11-giant-text.hl7'];
  check('hl7-11: over-limit text is an error, not a silent truncation', r11.errors.some(e => /over the 50000-character limit/.test(e)) && r11.reports.length === 0);
  const r13 = parsed['hl7-13-duplicate-encoding-chars.hl7'];
  check('hl7-13: duplicate encoding characters are an error', r13.errors.some(e => /not distinct/.test(e)));
}

// HL7 adversarial inline cases
section('HL7 v2 adversarial (inline)');
{
  const msg = (o) => {
    const base = ['MSH|^~\\&|RIS|HOSP|OSTEO|HOSP|20260421093000||ORU^R01|MSG-1|P|2.5.1||||||UNICODE UTF-8',
      'PID|1||P-9^^^L^MR||SYN^PT||19550314|F',
      'OBR|1|O-1|R-1|XR^XR SPINE^L||20260421093000|||||||||||||||||||Back pain',
      'OBX|1|TX|REPORT^R||Wedge fracture of T8.||||||F'];
    return (o && o.replace ? o.replace(base) : base).join('\r');
  };
  const std = msg();
  check('baseline message parses', I.parseHl7(std).ok === true);
  const mllp = I.parseHl7('\u000b' + std + '\u001c\r');
  check('MLLP start and end characters are removed with a flag', mllp.ok && has(mllp.flags, 'mllp-framing'), j(mllp.errors));
  const nul = I.parseHl7(std.replace('Wedge', 'We\u0000dge'));
  check('NUL inside OBX text is removed and flagged', nul.ok && !nul.reports[0].text.includes('\u0000') && has(nul.flags, 'control-removed'));
  const rlo = I.parseHl7(std.replace('Wedge', '\u202eWedge'));
  check('bidi override character is removed and flagged', rlo.ok && !/\u202e/.test(rlo.reports[0].text) && has(rlo.flags, 'bidi-removed'));
  const flood = I.parseHl7(std + '\rZXX|x'.repeat(6000));
  check('6000 segments are refused (segment limit)', flood.ok === false && flood.errors.some(e => /segment limit/.test(e)));
  const long40 = I.parseHl7(std.replace('Wedge fracture of T8.', 'Lungs clear. '.repeat(3300) + 'Wedge fracture of T8.'));
  check('40k-character single line parses with the right finding', long40.ok && long40.reports[0].text.length > 40000);
  const t0 = Date.now();
  const huge = I.parseHl7(std.replace('Wedge fracture of T8.', 'x'.repeat(1000000)));
  const dt = Date.now() - t0;
  check('1,000,000-character single line is refused quickly', huge.ok === false && dt < 2000, 'ms=' + dt);
  const tooBig = I.parseHl7('MSH|^~\\&|' + 'x'.repeat(2500000));
  check('input over the input limit is refused without parsing', tooBig.ok === false && tooBig.errors.some(e => /input limit/.test(e)));
  const wrongEnc = I.parseHl7(std.replace('MSH|^~\\&|', 'MSH|^~\\|'));
  check('MSH-2 of the wrong length falls back to default separators, flagged', wrongEnc.ok === true && has(wrongEnc.flags, 'encoding-default'), j(wrongEnc.errors));
  const dobAfter = I.parseHl7(std.replace('19550314', '20990101'));
  check('birth date after the report date gives age null and a warning', dobAfter.ok && dobAfter.reports[0].age === null && dobAfter.warnings.some(w => /age not computed/.test(w)));
  const sexO = I.parseHl7(std.replace('|F\r', '|O\r'));
  check('sex code O is not read as M or F: left null and flagged', sexO.ok && sexO.reports[0].sex === null && has(sexO.flags, 'sex-invalid'));
  const pidBadDob = I.parseHl7(std.replace('19550314', '1955'));
  check('partial birth date (year only) is flagged and age stays null', pidBadDob.ok && pidBadDob.reports[0].age === null && has(pidBadDob.flags, 'dob-invalid'));
  const nmOnly = I.parseHl7(std.replace('OBX|1|TX', 'OBX|1|NM').replace('Wedge fracture of T8.', '5.2'));
  check('numeric-only OBX gives an error, not an empty report', nmOnly.ok === false && nmOnly.errors.some(e => /no readable OBX text/.test(e)));
  const headerOnly = I.parseHl7('MSH|^~\\&|RIS|HOSP|OSTEO|HOSP|20260421093000||ORU^R01|MSG-2|P|2.5.1');
  check('message with an MSH segment only is an error', headerOnly.ok === false);
  const ascii = I.parseHl7(std.replace('UNICODE UTF-8', 'ASCII'));
  check('MSH-18 ASCII with pure ASCII text is not flagged', ascii.ok && !has(ascii.flags, 'charset-declared'));
  check('non-string HL7 input is an error, not a throw', I.parseHl7(null).ok === false && I.parseHl7(42).ok === false);
  check('empty HL7 input is an error', I.parseHl7('').ok === false);
}

/* ================= 3. FHIR R4 fixtures ================= */
section('FHIR R4 fixtures (DiagnosticReport and Bundle)');
Object.keys(EXP).filter(f => f.endsWith('.json')).forEach(f => checkFixture(f, I.parseFhir));
{
  const r3 = parsed['fhir-03-windows-1256-arabic.json'].reports[0];
  check('fhir-03: windows-1256 presentedForm decodes to the exact Arabic sentence', r3.text === 'يوجد كسر انضغاطي في الفقرة الصدرية T10.', j(r3.text));
  const r6 = parsed['fhir-06-prototype-keys.json'];
  check('fhir-06: __proto__ and constructor keys do not pollute any prototype', ({}).polluted === undefined && ({}).isAdmin === undefined && Object.prototype.polluted === undefined && Object.prototype.polluted2 === undefined);
  check('fhir-06: the report text is the conclusion', r6.reports[0].text === 'Wedge fracture of T8.', j(r6.reports[0].text));
  const r7 = parsed['fhir-07-error-and-empty-bundle.json'];
  check('fhir-07: an empty report in a bundle makes the whole bundle an error', r7.errors.some(e => /no narrative/.test(e)) && r7.reports.length === 0);
  const r8 = parsed['fhir-08-giant-conclusion.json'].reports[0];
  check('fhir-08: 36k-character conclusion is read in full (under the limit)', r8.text.length > 35000 && r8.text.endsWith('Old compression fracture of L1.'));
}
section('FHIR R4 adversarial (inline)');
{
  const dr = (o) => Object.assign({ resourceType: 'DiagnosticReport', id: 'DR-X', status: 'final', conclusion: 'Wedge fracture of T8.' }, o);
  check('invalid JSON is an error', I.parseFhir('{"resourceType":').ok === false);
  check('a JSON array is an error', I.parseFhir('[]').ok === false);
  check('a Bundle with 600 entries is refused (entry limit)', I.parseFhir(JSON.stringify({ resourceType: 'Bundle', entry: Array.from({ length: 600 }, () => ({ resource: dr() })) })).errors.some(e => /entry limit/.test(e)));
  const badCs = I.parseFhir(JSON.stringify(dr({ presentedForm: [{ contentType: 'text/plain; charset=x-unknown-42', data: Buffer.from('Wedge fracture of T8.').toString('base64') }] })));
  check('unsupported charset label is an error', badCs.ok === false && badCs.errors.some(e => /not supported/.test(e)));
  const badBytes = I.parseFhir(JSON.stringify(dr({ presentedForm: [{ contentType: 'text/plain; charset=utf-8', data: Buffer.from([0xff, 0xfe, 0x41]).toString('base64') }] })));
  check('bytes that are not valid UTF-8 are an error, not mojibake', badBytes.ok === false && badBytes.errors.some(e => /not valid/.test(e)));
  const html = I.parseFhir(JSON.stringify(dr({ conclusion: '<img src=x onerror=alert(1)> Wedge fracture of T8.' })));
  check('HTML in a conclusion is kept verbatim and flagged', html.ok && html.reports[0].text.startsWith('<img') && has(html.flags, 'html-markup'));
  const objIn = I.parseFhir(dr({ subject: { reference: 'Patient/missing' }, effectiveDateTime: '2026-03-01' }));
  check('object input (not text) is accepted', objIn.ok === true);
  check('a referenced patient that is not in the input leaves age null and flags it', objIn.reports[0].age === null && has(objIn.flags, 'age-missing'));
  check('a non-text presentedForm with no conclusion is an error', I.parseFhir(JSON.stringify(dr({ conclusion: undefined, presentedForm: [{ contentType: 'application/pdf', data: 'AAAA' }] }))).ok === false);
  const bigBase = I.parseFhir(JSON.stringify(dr({ conclusion: undefined, presentedForm: [{ contentType: 'text/plain', data: 'A'.repeat(4000001) }] })));
  check('oversized base64 attachment is refused without a crash', bigBase.ok === false);
  check('non-object FHIR input is an error', I.parseFhir(42).ok === false && I.parseFhir(null).ok === false);
  check('wrong resource type inside a bundle is ignored, but a bundle with no DiagnosticReport is an error', I.parseFhir(JSON.stringify({ resourceType: 'Bundle', entry: [{ resource: { resourceType: 'Patient', id: 'p' } }] })).ok === false);
}

/* ================= 4. CSV fixtures ================= */
section('CSV fixtures');
Object.keys(EXP).filter(f => f.endsWith('.csv')).forEach(f => checkFixture(f, I.parseCsv));
{
  const r = parsed['csv-01-mapped-header.csv'];
  check('csv-01: a quoted field with a comma and a newline stays one report', r.reports[1] && r.reports[1].text === 'Multiline report:\nLiver unremarkable. No fracture.');
  check('csv-01: a column named __proto__ is ignored, not used as a field', r.ok && !Object.prototype.hasOwnProperty.call(r.reports[0], '__proto__'));
  check('csv-01: an unparseable date is left null with a warning', r.warnings.some(w => /is not YYYY-MM-DD/.test(w)));
  check('csv-02: the error names the bad row and nothing is imported', parsed['csv-02-malformed-row.csv'].errors.some(e => /row 3/.test(e) && /Nothing was imported/.test(e)));
}
section('CSV adversarial (inline)');
{
  check('unterminated quote is an error', I.parseCsv('a,report_text\n1,"Fracture of T8.').ok === false);
  check('unterminated quote error says the file cannot be trusted', I.parseCsv('a,report_text\n1,"Fracture').errors.some(e => /unterminated/.test(e)));
  const many = 'report_text\n' + Array.from({ length: 4 }, (_, i) => 'Wedge fracture of T' + (i + 1) + '.').join('\n') + '\n';
  check('more rows than the profile row limit is an error', I.parseCsv(many, { profile: { limits: { maxRows: 2 } } }).errors.some(e => /row limit/.test(e)));
  check('a header with no report text column is an error', I.parseCsv('id,age\n1,70').errors.some(e => /no report text column/.test(e)));
  const mapped = I.parseCsv('id,Findings\nA1,Wedge fracture of L1.', { mapping: { text: 'Findings' } });
  check('an explicit mapping selects the text column', mapped.ok && mapped.reports[0].text === 'Wedge fracture of L1.');
  check('a mapping that names a missing column is an error', I.parseCsv('id,text\nA1,x', { mapping: { text: 'Findings' } }).ok === false);
  check('duplicate report ids are an error', I.parseCsv('id,text\nA1,Wedge fracture of L1.\nA1,Wedge fracture of L2.').errors.some(e => /duplicate report id/.test(e)));
  check('a header made only of __proto__ gives an error, not a crash', I.parseCsv('__proto__,constructor\nx,y').ok === false);
  const cr = I.parseCsv('id,text\rA1,Wedge fracture of L1.\r');
  check('CR-only line endings are read', cr.ok && cr.reports.length === 1);
  const esc = I.parseCsv('id,text\nA1,"He said ""wedge fracture"" of T8."');
  check('doubled quotes inside a quoted field are read as one quote', esc.ok && esc.reports[0].text === 'He said "wedge fracture" of T8.', j(esc.reports[0] && esc.reports[0].text));
  check('an empty file is an error', I.parseCsv('').ok === false && I.parseCsv('\n\n').ok === false);
  check('a row with empty report text is an error', I.parseCsv('id,text\nA1,').errors.some(e => /no report text/.test(e)));
  check('non-string CSV input is an error', I.parseCsv(null).ok === false);
}

/* ================= 5. paste fixtures ================= */
section('Paste fixtures');
Object.keys(EXP).filter(f => f.endsWith('.txt')).forEach(f => checkFixture(f, I.parsePaste));
{
  check('paste-01: header lines are read and not kept in the report text', parsed['paste-01-with-header.txt'].reports[0].text === 'Intertrochanteric fracture of the left femur.');
  check('paste-01: Study and Indication headers fill mod and ind', parsed['paste-01-with-header.txt'].reports[0].mod === 'XR hip' && parsed['paste-01-with-header.txt'].reports[0].ind === 'Fall at home');
  const t2 = parsed['paste-02-control-chars.txt'].reports[0].text;
  check('paste-02: bidi and NUL characters are gone from the report text', !/[\u202e\u0000]/.test(t2));
}
section('Paste adversarial (inline)');
{
  check('paste with only header lines is an error', I.parsePaste('Age: 70\nSex: F').ok === false);
  const huge = I.parsePaste('Wedge fracture of T8. ' + 'x'.repeat(1000000));
  check('1,000,000-character paste is refused (report limit)', huge.ok === false && huge.errors.some(e => /report limit|over the 50000/.test(e)));
  const h = I.parsePaste('Wedge <script>alert(1)</script> fracture of T8.');
  check('HTML in pasted text is kept and flagged', h.ok && has(h.flags, 'html-markup') && h.reports[0].text.includes('<script>'));
  const badDate = I.parsePaste('Date: 2026-02-30\n\nWedge fracture of T8.');
  check('an impossible calendar date is left null with a warning', badDate.ok && badDate.reports[0].date === null && badDate.warnings.some(w => /YYYY-MM-DD/.test(w)));
  const proto = I.parsePaste('constructor: Wedge fracture of T8.\n__proto__: x');
  check('header lines are only the known keys; other lines stay in the text', proto.ok && proto.reports[0].text.startsWith('constructor:'));
  const over = I.parsePaste('Age: 78\n\nWedge fracture of T8.', { meta: { age: 60 } });
  check('explicit meta overrides a header line', over.ok && over.reports[0].age === 60);
  check('a header line with an out-of-range age is flagged and left null', I.parsePaste('Age: 240\n\nWedge fracture of T8.').reports[0].age === null);
  check('non-string paste input is an error', I.parsePaste(undefined).ok === false);
  const moji = I.parsePaste('Wedge fracture of T8. \u00c3\u00a9tat de la colonne');
  check('UTF-8 text read as Latin-1 (mojibake) is flagged, not silently kept', moji.ok && has(moji.flags, 'possible-mojibake'));
  const clean = I.parsePaste('Wedge fracture of T8. Patient aged 70.');
  check('ordinary Latin text is not flagged as mojibake', !has(clean.flags, 'possible-mojibake'));
}

/* ================= 6. dispatcher and toFinderInput ================= */
section('Dispatcher (ingest) and toFinderInput');
{
  const paste = 'Age: 70\nSex: F\n\nWedge fracture of T8.';
  check('ingest refuses a route the site profile has not enabled', I.ingest('hl7v2', readFix('hl7-01-vertebral-clean.hl7'), { profile: S.getProfile('my-moh') }).errors.some(e => /not enabled/.test(e)));
  check('ingest refuses paste when the profile disables it', I.ingest('paste', paste, { profile: { feeds: { paste: false } } }).ok === false);
  check('ingest refuses when the profile has no feeds object', I.ingest('csv', 'a', { profile: {} }).ok === false);
  check('ingest refuses an unknown route', I.ingest('dicom', paste).errors.some(e => /unknown input route/.test(e)));
  check('ingest refuses the __proto__ route name without a crash', I.ingest('__proto__', paste).ok === false);
  check('ingest reads paste for a profile that enables it', I.ingest('paste', paste, { profile: S.getProfile('my-moh') }).ok === true);
  check('ingest with a non-text input is an error, not a throw', I.ingest('paste', 42).ok === false && I.ingest('fhir', null).ok === false);
  check('ingest with no options object still works', I.ingest('paste', paste).ok === true);
  const full = { report: 1, id: 'R1', patient_id: 'P1', age: 70, sex: 'F', mod: 'XR', ind: 'Pain', text: 'Wedge fracture of T8.', date: '2026-01-02' };
  const fi = I.toFinderInput(full);
  check('toFinderInput drops patient_id and date', fi && !('patient_id' in fi) && !('date' in fi) && !('report' in fi), j(fi));
  check('toFinderInput keeps text, age, sex, mod and ind', fi.text === full.text && fi.age === 70 && fi.sex === 'F' && fi.mod === 'XR' && fi.ind === 'Pain');
  check('toFinderInput returns null for a report without text', I.toFinderInput({ id: 'x' }) === null && I.toFinderInput(null) === null && I.toFinderInput({ text: 5 }) === null);
  check('toFinderInput turns an invalid sex into null', I.toFinderInput({ text: 'x', sex: 'X', age: 'seventy' }).sex === null && I.toFinderInput({ text: 'x', age: 'seventy' }).age === null);
  check('report from paste has no patient_id key when none was given', !('patient_id' in I.parsePaste(paste).reports[0]));
}

/* ================= 7. fuzz: parsers never throw and keep their invariants ================= */
section('Fuzz (deterministic, 600 mutated inputs)');
{
  const rnd = (function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })(20260421);
  const corpus = Object.keys(EXP).filter(f => !f.startsWith('_') && EXP[f] !== null)
    .map(f => ({ f, text: readFix(f) })).filter(c => c.text.length < 20000);
  const SPECIAL = ['|', '^', '~', '\\', '&', '#', '\r', '\n', '\r\n', '\u0000', '<', '>', '"', ',', '\u202e', '{', '}', '[', ']', ':', '__proto__', '"__proto__":', 'OBX', 'MSH', 'PID', '\u000b', '\u001c', '\uFEFF', '=', '?', '\u0660'];
  const pick = a => a[Math.floor(rnd() * a.length)];
  const mutate = s => {
    let t = s;
    const n = 1 + Math.floor(rnd() * 6);
    for (let k = 0; k < n; k++) {
      const op = Math.floor(rnd() * 4), pos = Math.floor(rnd() * (t.length + 1));
      if (op === 0) t = t.slice(0, pos);
      else if (op === 1) t = t.slice(0, pos) + pick(SPECIAL) + t.slice(pos);
      else if (op === 2) t = t.slice(0, pos) + t.slice(pos + 1 + Math.floor(rnd() * 20));
      else t = t.slice(0, pos) + t.slice(pos, pos + 30).split('').reverse().join('') + t.slice(pos + 30);
    }
    return t;
  };
  const parsers = [I.parseHl7, I.parseFhir, I.parseCsv, I.parsePaste];
  let runs = 0, internal = 0, badShape = 0, badInvariant = 0;
  const samples = [];
  for (let i = 0; i < 600; i++) {
    const c = pick(corpus);
    const fn = rnd() < 0.8 ? parsers[['.hl7', '.json', '.csv', '.txt'].findIndex(e => c.f.endsWith(e))] : pick(parsers);
    const text = mutate(c.text);
    const r = fn(text, {});
    runs++;
    if (!r || typeof r.ok !== 'boolean' || !Array.isArray(r.reports) || !Array.isArray(r.warnings) || !Array.isArray(r.errors) || !Array.isArray(r.flags)) { badShape++; continue; }
    if (r.errors.some(e => /internal error/.test(e))) { internal++; if (samples.length < 3) samples.push(c.f + ': ' + text.slice(0, 80)); }
    if (r.ok ? (r.reports.length === 0 || r.errors.length > 0) : r.reports.length !== 0) badInvariant++;
    for (const x of r.reports) {
      const okShape = typeof x.id === 'string' && x.id !== '' && typeof x.text === 'string' && x.text.trim() !== ''
        && (x.age === null || (Number.isInteger(x.age) && x.age >= 0 && x.age <= 120))
        && (x.sex === null || x.sex === 'M' || x.sex === 'F')
        && (x.date === null || /^\d{4}-\d{2}-\d{2}$/.test(x.date));
      if (!okShape) badInvariant++;
    }
  }
  check(`600 mutated inputs: no internal error (${internal} seen)`, internal === 0, samples.join(' | '));
  check('every result has the expected shape', badShape === 0, 'bad=' + badShape);
  check('ok/reports/errors invariants hold for every result', badInvariant === 0, 'bad=' + badInvariant);
  check('fuzzing did not pollute Object.prototype', ({}).polluted === undefined && ({}).polluted2 === undefined && Object.prototype.isAdmin === undefined);
  console.log('  fuzz runs ' + runs);
}

/* ================= 8. end to end: ingest -> find() -> verify() ================= */
section('End to end: parsed fixture reports through find() and verify()');
const e2e = [];
for (const file of Object.keys(EXP)) {
  if (file.startsWith('_') || !EXP[file].ok || !parsed[file]) continue;
  EXP[file].reports.forEach((exp, i) => {
    const rep = parsed[file].reports[i];
    if (!rep) { check(`${file} report ${i + 1} exists`, false); return; }
    const input = I.toFinderInput(rep);
    const out = F.find(input);
    const v = F.verify(input, out);
    e2e.push({ file, id: rep.id, age: rep.age, sex: rep.sex, decision: out.decision, site: out.site, verified: v.ok, expected: exp.decision, flags: parsed[file].flags.join(',') || '-' });
    check(`${file} #${i + 1}: finder says ${exp.decision}${exp.site !== undefined ? ' (' + exp.site + ')' : ''}`, out.decision === exp.decision && out.site === exp.site, `got ${out.decision}/${out.site}`);
    check(`${file} #${i + 1}: verifier accepts the finder output`, v.ok, v.problems.join('; '));
  });
}
console.log('');
console.log('  ' + ['file', 'id', 'age', 'sex', 'finder', 'site', 'expected', 'verified', 'ingest flags'].join(' | '));
for (const r of e2e) console.log('  ' + [r.file, r.id, r.age, r.sex, r.decision, r.site, r.expected, r.verified ? 'yes' : 'NO', r.flags].join(' | '));

/* ================= summary and results file ================= */
const total = sections.reduce((a, s) => a + s.total, 0), pass = sections.reduce((a, s) => a + s.pass, 0);
console.log('\nSummary');
for (const s of sections) console.log(`  ${s.name}: ${s.pass}/${s.total}`);
console.log(`ingest tests ${pass}/${total}`);

const md = [
  '# Ingest results (site profiles, parsers, end to end)',
  '',
  '_Generated by `node bench/run-ingest.js`. All fixtures are synthetic. Expected answers are in `bench/ingest-fixtures/expected.json`, written by hand._',
  '',
  `**Total: ${pass}/${total} checks passed.** Per section:`,
  '',
  '| Section | Passed |',
  '| --- | --- |',
  ...sections.map(s => `| ${s.name} | ${s.pass}/${s.total} |`),
  '',
  '## End to end: each parsed fixture report through find() and verify()',
  '',
  '| File | Report id | Age | Sex | Finder | Site | Expected | Verified | Ingest flags |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...e2e.map(r => `| ${r.file} | ${r.id} | ${r.age == null ? '-' : r.age} | ${r.sex || '-'} | ${r.decision} | ${r.site || '-'} | ${r.expected} | ${r.verified ? 'yes' : 'no'} | ${r.flags} |`),
  '',
  '## Failures',
  '',
  failures.length ? failures.map(f => '- ' + f).join('\n') : 'None.',
  '',
  '## Not validated',
  '',
  '- No real hospital feed was tested. The HL7 messages and FHIR resources are hand-written to the standards, not captured from any site.',
  '- The HL7 parser covers ORU^R01 result text only (OBR and OBX, TX, FT and ST values). Other message types, batch headers (FHS and BHS), ORC-based order linkage and HL7 v2.x variants are not handled.',
  '- Truncation inside the last line of a message cannot be proven from the text. The parser flags only a missing result status or a line that ends mid-word.',
  '- Text is kept verbatim. Arabic presentation forms copied from PDFs are not normalised.',
  '- Age and sex are taken from the patient record in the message. Identity matching across systems is not checked.',
  '- The finder decisions above are the keyword baseline. They are not the AI reader and they are not clinically signed off.',
  ''
].join('\n');
fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'results', 'ingest.md'), md);

process.exitCode = failures.length ? 1 : 0;
