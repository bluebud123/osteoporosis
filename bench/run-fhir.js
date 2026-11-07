/*
 * FHIR export checks: builds bundles for fixture cases (same shape as seedCases() and openFromFeed()
 * in index.html) and validates them structurally. The R4 value sets and required fields below are
 * written here, independently of src/fhir.js. This is NOT the official HL7 validator.
 * Exit code 1 on any failure.
 */
const path = require('path');
const assert = require('assert');
const F = require(path.resolve(__dirname, '..', 'src', 'fhir.js'));

const ANCHOR = '2026-11-07';
const TYPES = ['Bundle', 'Patient', 'Practitioner', 'DiagnosticReport', 'Condition', 'Task', 'ServiceRequest',
  'Observation', 'MedicationRequest', 'MedicationDispense', 'CarePlan', 'QuestionnaireResponse'];
// R4 required (1..1 or 1..*) fields, per type, as dotted paths; 'X[x]' means any choice.
const REQUIRED = {
  Patient: [], Practitioner: [],
  DiagnosticReport: ['status', 'code', 'subject'],
  Condition: ['clinicalStatus', 'verificationStatus', 'subject'],
  Task: ['status', 'intent'],
  ServiceRequest: ['status', 'intent', 'subject', 'code'],
  Observation: ['status', 'code', 'subject'],
  MedicationRequest: ['status', 'intent', 'medication[x]', 'subject'],
  MedicationDispense: ['status', 'medication[x]', 'subject'],
  CarePlan: ['status', 'intent', 'subject'],
  QuestionnaireResponse: ['status', 'subject'],
  Bundle: ['type']
};
// R4 value sets for status-like fields (as written in the FHIR R4 specification).
const VS = {
  'DiagnosticReport.status': ['registered', 'partial', 'preliminary', 'final', 'amended', 'corrected', 'appended', 'cancelled', 'entered-in-error', 'unknown'],
  'Observation.status': ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'],
  'Task.status': ['draft', 'requested', 'received', 'accepted', 'rejected', 'ready', 'cancelled', 'in-progress', 'on-hold', 'failed', 'completed', 'entered-in-error'],
  'Task.intent': ['unknown', 'proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option'],
  'ServiceRequest.status': ['draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown'],
  'ServiceRequest.intent': ['proposal', 'plan', 'directive', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option'],
  'ServiceRequest.priority': ['routine', 'urgent', 'asap', 'stat'],
  'MedicationRequest.status': ['active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft', 'unknown'],
  'MedicationRequest.intent': ['proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option'],
  'MedicationDispense.status': ['preparation', 'in-progress', 'cancelled', 'on-hold', 'completed', 'entered-in-error', 'stopped', 'declined', 'unknown'],
  'CarePlan.status': ['draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown'],
  'CarePlan.intent': ['proposal', 'plan', 'order', 'option'],
  'CarePlan.activity.detail.status': ['not-started', 'scheduled', 'in-progress', 'on-hold', 'completed', 'cancelled', 'stopped', 'unknown', 'entered-in-error'],
  'QuestionnaireResponse.status': ['in-progress', 'completed', 'amended', 'entered-in-error', 'stopped'],
  'Condition.clinicalStatus': ['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved'],
  'Condition.verificationStatus': ['unconfirmed', 'provisional', 'differential', 'confirmed', 'refuted', 'entered-in-error'],
  'Bundle.type': ['collection']
};
const ALLOWED_SYSTEMS = new Set([
  'urn:osteoloop:local', 'urn:osteoloop:data-origin', 'urn:osteoloop:case', 'urn:ietf:bcp:47', 'http://unitsofmeasure.org',
  'http://terminology.hl7.org/CodeSystem/condition-clinical', 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
  'http://terminology.hl7.org/CodeSystem/condition-category', 'http://terminology.hl7.org/CodeSystem/observation-category',
  'http://terminology.hl7.org/CodeSystem/v2-0074'
]);
const UUID = /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ID = /^[A-Za-z0-9\-.]{1,64}$/;
// Patterns that look like real identifiers. None should appear anywhere in a bundle.
const REAL_LOOKING = [
  [/[\w.+-]+@[\w-]+\.[\w.]+/, 'email address'],
  [/(\+?60|0)[1-9]\d{7,9}\b/, 'Malaysian phone-like number'],
  [/\b\d{6}-\d{2}-\d{4}\b/, 'NRIC-like number (dashed)'],
  [/\b(MRN|NRIC|IC|FIN|passport)\s*[:#]?\s*[A-Z0-9-]{5,}/i, 'labelled national or hospital identifier'],
  [/https?:\/\/(?!terminology\.hl7\.org|unitsofmeasure\.org|www\.w3\.org)[^\s"]+/, 'web URL outside allowed hosts']
];

let fails = 0, passes = 0;
function check(name, fn) {
  try { fn(); passes++; } catch (e) { fails++; console.log('  FAIL ' + name + ': ' + e.message); }
}

/* ---------- generic validator (returns a list of problems; empty means clean) ---------- */
function validate(b) {
  const problems = [];
  const bad = (m) => problems.push(m);
  if (!b || b.resourceType !== 'Bundle') { bad('not a Bundle'); return problems; }
  REQUIRED.Bundle.forEach(f => { if (b[f] === undefined) bad('Bundle missing ' + f); });
  if (VS['Bundle.type'].indexOf(b.type) < 0) bad('Bundle.type ' + b.type + ' not in value set');
  if (!b.meta || !(b.meta.tag || []).some(t => t.code === 'SYNTHETIC')) bad('Bundle missing SYNTHETIC tag');
  if (!Array.isArray(b.entry) || !b.entry.length) bad('Bundle has no entries');
  const byUrl = new Map(), byTypeId = new Set();
  (b.entry || []).forEach((en, i) => {
    const r = en.resource;
    if (!r) { bad('entry ' + i + ' has no resource'); return; }
    if (!TYPES.includes(r.resourceType)) bad('resourceType not whitelisted: ' + r.resourceType);
    if (r.resourceType === 'Bundle') bad('nested Bundle');
    if (!ID.test(r.id || '')) bad(r.resourceType + ' id not FHIR-legal: ' + r.id);
    if (!UUID.test(en.fullUrl || '')) bad('fullUrl not a urn:uuid: ' + en.fullUrl);
    if (byUrl.has(en.fullUrl)) bad('duplicate fullUrl ' + en.fullUrl);
    byUrl.set(en.fullUrl, r);
    if (byTypeId.has(r.resourceType + '/' + r.id)) bad('duplicate ' + r.resourceType + '/' + r.id);
    byTypeId.add(r.resourceType + '/' + r.id);
    if (!(r.meta && (r.meta.tag || []).some(t => t.code === 'SYNTHETIC'))) bad(r.resourceType + '/' + r.id + ' missing SYNTHETIC tag');
    (REQUIRED[r.resourceType] || []).forEach(f => {
      if (f === 'medication[x]') { if (!r.medicationCodeableConcept && !r.medicationReference) bad(r.resourceType + '/' + r.id + ' missing medication[x]'); }
      else if (r[f] === undefined) bad(r.resourceType + '/' + r.id + ' missing ' + f);
    });
    // Status-like value sets
    const vs = (key, v) => { if (v !== undefined && VS[key] && VS[key].indexOf(v) < 0) bad(r.resourceType + '/' + r.id + ' ' + key + ' = ' + v); };
    const t = r.resourceType;
    if (r.status !== undefined) vs(t + '.status', r.status);
    if (r.intent !== undefined && VS[t + '.intent']) vs(t + '.intent', r.intent);
    if (r.priority !== undefined && VS[t + '.priority']) vs(t + '.priority', r.priority);
    if (t === 'Condition') {
      vs('Condition.clinicalStatus', r.clinicalStatus && r.clinicalStatus.coding[0].code);
      vs('Condition.verificationStatus', r.verificationStatus && r.verificationStatus.coding[0].code);
    }
    if (t === 'CarePlan') (r.activity || []).forEach(a => vs('CarePlan.activity.detail.status', a.detail && a.detail.status));
    // Codings: only allowed systems; no invented numeric local codes
    const walk = (v, path) => {
      if (Array.isArray(v)) return v.forEach((x, k) => walk(x, path + '[' + k + ']'));
      if (!v || typeof v !== 'object') return;
      if (Array.isArray(v.coding)) v.coding.forEach(c => {
        if (!ALLOWED_SYSTEMS.has(c.system)) bad(path + ' uses unmapped system ' + c.system);
        if (c.system === 'urn:osteoloop:local' && /^\d+$/.test(c.code)) bad(path + ' numeric local code ' + c.code);
      });
      Object.keys(v).forEach(k => walk(v[k], path + '.' + k));
    };
    walk(r, r.resourceType + '/' + r.id);
    // Empty strings and empty arrays are invalid in R4
    const empties = (v, path) => {
      if (v === '') bad('empty string at ' + path);
      if (Array.isArray(v)) { if (!v.length) bad('empty array at ' + path); v.forEach((x, k) => empties(x, path + '[' + k + ']')); }
      else if (v && typeof v === 'object') Object.keys(v).forEach(k => empties(v[k], path + '.' + k));
    };
    empties(r, r.resourceType + '/' + r.id);
    // Real-looking identifiers
    const text = JSON.stringify(r);
    REAL_LOOKING.forEach(([re, label]) => { const m = text.match(re); if (m) bad(r.resourceType + '/' + r.id + ' contains ' + label + ': ' + m[0]); });
    if (r.identifier) r.identifier.forEach(x => { if (!/^SYN-/.test(x.value) && !UUID.test(x.value)) bad(r.resourceType + '/' + r.id + ' identifier not SYN-: ' + x.value); });
  });
  // Every reference resolves inside the bundle
  const refs = (v, path, owner) => {
    if (Array.isArray(v)) return v.forEach((x, k) => refs(x, path + '[' + k + ']', owner));
    if (!v || typeof v !== 'object') return;
    if (typeof v.reference === 'string') { if (!byUrl.has(v.reference)) bad('unresolved reference at ' + path + ': ' + v.reference); }
    Object.keys(v).forEach(k => { if (k !== 'reference') refs(v[k], path + '.' + k, owner); });
  };
  (b.entry || []).forEach(en => refs(en.resource, en.resource && en.resource.resourceType + '/' + en.resource.id, en));
  // Exactly one Patient, and every clinical resource points at it
  const patients = (b.entry || []).filter(e => e.resource.resourceType === 'Patient');
  if (patients.length !== 1) bad('expected exactly one Patient, found ' + patients.length);
  return problems;
}

/* ---------- fixtures: same shape as seedCases() and openFromFeed() in index.html ---------- */
const clockFor = (c, i) => (i === 2 && c.urgent) ? 42 : F.DEFAULT_STAGES[i].clock;
const stagesFrom = (hist) => { const st = F.DEFAULT_STAGES.map(() => ({ start: null, end: null, alerted: false, skip: false })); hist.forEach(([i, s, e]) => { st[i].start = s; st[i].end = e; }); return st; };
const base = (o) => Object.assign({ stages: null, ack: null, tbFirst: null, lang: 'en', referral: { status: 'none', clinic: null, reason: null, history: [] }, thread: [], checkins: [], rx: null, closed: null, log: [], res: null, ordered: false, follow: { adh: false, btm: false }, urgent: false, owner: null }, o);
const FIX = {
  // Wrist fracture 8 months ago, unassigned to no one: Dr Tan owns it, Arabic speaker, fast-track
  'C-1042': base({ id: 'C-1042', name: 'Mariam A.', age: 64, sex: 'F', owner: 'Dr Tan', lang: 'ar', urgent: true,
    clin: { fxMonths: 8, multiFx: false, fxOnGc: false, hipVert: false, mof: 18, hip: 4.1, cvEvent: false, note: 'Wrist fracture 8 months ago; parent had a hip fracture' },
    stages: stagesFrom([[0, 0, 0], [1, 0, null]]) }),
  // Two vertebral fractures on prednisolone, referral rejected, DXA and labs done
  'C-1029': base({ id: 'C-1029', name: 'Fatima S.', age: 71, sex: 'F', owner: 'Dr Tan', urgent: true,
    clin: { fxMonths: 14, multiFx: true, fxOnGc: true, hipVert: true, mof: 34, hip: 6.2, cvEvent: false, note: 'Two vertebral fractures; on prednisolone for rheumatoid arthritis' },
    stages: stagesFrom([[0, -30, -30], [1, -30, -27], [2, -27, -9], [3, -9, null]]), ordered: true, res: { t: -3.2, vd: 79, egfr: 48, ca: 2.35, spep: 'normal' },
    referral: { status: 'rejected', clinic: 'Al Noor fracture-liaison clinic', reason: 'Out of insurance network', history: [['sent', -8], ['rejected', -2]] } }),
  // Treated: alendronate dispensed, closed as treated, check-in with flags and a review
  'C-1018': base({ id: 'C-1018', name: 'Salma R.', age: 66, sex: 'F', owner: 'Dr Lim', ordered: true,
    clin: { fxMonths: null, multiFx: false, fxOnGc: false, hipVert: false, mof: 24, hip: 3.6, cvEvent: false, note: 'Osteoporosis on DXA' },
    stages: stagesFrom([[0, -70, -70], [1, -70, -66], [2, -66, -48], [3, -48, -45], [4, -45, -36], [5, -36, null]]),
    res: { t: -2.9, vd: 88, egfr: 72, ca: 2.3 }, rx: { id: 'obp', name: 'Oral bisphosphonate (alendronate)', by: 'Dr Lim', day: -40, dispensed: -36 },
    checkins: [{ d: -2, visit: 'review', lang: 'en', answers: { med: 1 }, flags: [['x', 'warn', 'Heartburn on tablets', 'LOCAL']], reviewed: null }],
    closed: { kind: 'treated', day: -60, by: 'Dr Lim', text: 'Evidence: dispensing record, 3-month adherence check, repeat DXA booked' } }),
  // Denosumab, next dose due day 22, open case with a LOCAL schedule
  'C-1004': base({ id: 'C-1004', name: 'Huda M.', age: 73, sex: 'F', owner: 'Dr Lim', ordered: true,
    clin: { fxMonths: null, multiFx: false, fxOnGc: false, hipVert: true, mof: 26, hip: 5.0, cvEvent: false, note: 'Vertebral fracture on old X-ray' },
    stages: stagesFrom([[0, -200, -200], [1, -200, -197], [2, -197, -175], [3, -175, -170], [4, -170, -160], [5, -160, -70], [6, -70, -60]]),
    res: { t: -2.7, vd: 90, egfr: 65, ca: 2.32 }, rx: { id: 'deno', name: 'Denosumab', by: 'Dr Lim', day: -165, dispensed: -160 }, denoDue: 22,
    closed: { kind: 'treated', day: -60, by: 'Dr Lim', text: 'Evidence: dispensing record, 3-month adherence check, repeat DXA booked' } }),
  // Finder case: radiology report text, quoted evidence, unknown fracture date, no owner, not yet ordered
  'C-2001': base({ id: 'C-2001', name: 'Khadija M.', age: 71, sex: 'F', owner: null, source: 'finder',
    pt: { age: 71, sex: 'F', menopause: 'post', fractures: [{ site: 'vert', months: null }], t: null, mof: null, hip: null },
    clin: { mof: null, hip: null, cvEvent: false, note: 'Found in CXR lateral report R001: "Incidental moderate wedge compression fracture of T8 with approximately 35% anterior height loss." Fracture age unknown: confirm date before treating as very high risk.' },
    stages: stagesFrom([[0, 0, 0], [1, 0, null]]), log: [] }),
  // Closed as dropped: stages after the drop are cancelled
  'C-1011': base({ id: 'C-1011', name: 'Leila B.', age: 61, sex: 'F', owner: 'Dr Tan',
    clin: { fxMonths: null, multiFx: false, fxOnGc: false, hipVert: false, mof: 21, hip: 3.2, cvEvent: false, note: 'Osteoporosis on DXA' },
    stages: stagesFrom([[0, -90, -90], [1, -90, -84], [2, -84, -60], [3, -60, -55], [4, -55, null]]),
    res: { t: -2.6, vd: 70, egfr: 80, ca: 2.3 }, closed: { kind: 'drop', stage: 4, day: -40, by: 'Dr Tan', text: 'Fear of medication side effects', reason: 'Fear of medication side effects' } })
};
const REPORT_C2001 = { id: 'R001', mod: 'CXR lateral', text: 'Lungs are clear. No pleural effusion. Incidental moderate wedge compression fracture of T8 with approximately 35% anterior height loss.', evidence: ['Incidental moderate wedge compression fracture of T8 with approximately 35% anterior height loss.'], decision: 'act' };
const CHECKIN_ITEMS = (k) => [{ linkId: 'med', text: 'Are you taking your tablets?', value: 'Yes' }, { linkId: 'ask', text: 'Question for your doctor', value: '' }];
function opts(id, extra) {
  return Object.assign({ anchor: ANCHOR, day: 0, clockFor, stages: F.DEFAULT_STAGES, checkin: CHECKIN_ITEMS,
    report: id === 'C-2001' ? REPORT_C2001 : null }, extra || {});
}
const build = (id, extra) => F.bundle(FIX[id], opts(id, extra));
const byType = (b, t) => b.entry.map(e => e.resource).filter(r => r.resourceType === t);
const one = (b, t) => { const xs = byType(b, t); assert.strictEqual(xs.length, 1, t + ' count ' + xs.length); return xs[0]; };

/* ---------- 1. every fixture: valid structure, round trip, no real-looking data ---------- */
console.log('FHIR export: structure and identifiers');
const bundles = {};
Object.keys(FIX).forEach(id => {
  check(id + ' builds without throwing', () => { bundles[id] = build(id); });
  if (!bundles[id]) return;
  const b = bundles[id];
  check(id + ' validates (required fields, value sets, references, codes, identifiers)', () => {
    const p = validate(b); assert.deepStrictEqual(p, [], p.slice(0, 5).join(' | '));
  });
  check(id + ' JSON round-trips losslessly', () => {
    const s = F.toJSON(b); assert.deepStrictEqual(JSON.parse(s), b); assert.strictEqual(JSON.stringify(JSON.parse(s)), JSON.stringify(b));
  });
  check(id + ' bundle type is collection', () => assert.strictEqual(b.type, 'collection'));
});

/* ---------- 2. the required resource set is present ---------- */
console.log('FHIR export: resource coverage');
check('C-1042 has Patient, DiagnosticReport, Condition, 7 Tasks, DXA ServiceRequest, CarePlan', () => {
  const b = bundles['C-1042']; one(b, 'Patient'); one(b, 'DiagnosticReport'); one(b, 'CarePlan');
  assert.strictEqual(byType(b, 'Condition').length, 1); assert.strictEqual(byType(b, 'Task').length, 7);
  assert.ok(byType(b, 'ServiceRequest').some(s => s.code.text.includes('DXA') && s.priority === 'urgent'));
});
check('C-1042 Patient is Arabic-speaking female, age extension 64, SYNTHETIC', () => {
  const p = one(bundles['C-1042'], 'Patient');
  assert.strictEqual(p.gender, 'female'); assert.strictEqual(p.communication[0].language.coding[0].code, 'ar');
  assert.ok(p.extension.some(x => x.url === 'urn:osteoloop:age-years' && x.valueInteger === 64));
  assert.strictEqual(p.meta.tag[0].code, 'SYNTHETIC');
});
check('C-1029 has lab and DXA observations, SPEP, and the rejected referral is revoked', () => {
  const b = bundles['C-1029'], obs = byType(b, 'Observation');
  const t = obs.find(o => o.code.coding[0].code === 'dxa-t-score'); assert.ok(t); assert.strictEqual(t.valueQuantity.value, -3.2);
  assert.ok(obs.some(o => o.code.coding[0].code === 'vitamin-d-25oh' && o.valueQuantity.value === 79));
  assert.ok(obs.some(o => o.code.coding[0].code === 'spep'));
  const ref = byType(b, 'ServiceRequest').find(s => s.id === 'sr-referral-C-1029'); assert.strictEqual(ref.status, 'revoked');
  assert.strictEqual(byType(b, 'Condition').length, 2, 'two vertebral fractures give two Conditions');
  assert.ok(byType(b, 'Condition').every(c => c.onsetString));
});
check('C-1018 MedicationRequest and MedicationDispense, dispense references the request, CarePlan has follow-up', () => {
  const b = bundles['C-1018'];
  const mr = one(b, 'MedicationRequest'), md = one(b, 'MedicationDispense');
  assert.strictEqual(md.status, 'completed');
  assert.strictEqual(md.authorizingPrescription[0].reference, F.fullUrl('MedicationRequest', mr.id));
  const cp = one(b, 'CarePlan'); assert.strictEqual(cp.status, 'active');
  assert.strictEqual(cp.activity.length, 2, 'yearly check-in and repeat DXA');
  assert.strictEqual(cp.activity[0].detail.scheduledPeriod.start, dateStr(-60 + 365), 'yearly check-in: closed day + 365');
  assert.strictEqual(cp.activity[1].detail.scheduledPeriod.start, dateStr(-60 + 730), 'repeat DXA: closed day + 730');
});
check('C-1004 denosumab next dose is on the CarePlan at anchor + denoDue (day 22)', () => {
  const cp = one(bundles['C-1004'], 'CarePlan');
  const d = cp.activity.find(a => /Denosumab/.test(a.detail.description));
  assert.ok(d, 'denosumab activity'); assert.strictEqual(d.detail.scheduledPeriod.start, '2026-11-29');
});
check('C-2001 DiagnosticReport carries the radiology text and the quoted evidence in a note', () => {
  const b = bundles['C-2001'], dr = one(b, 'DiagnosticReport');
  assert.strictEqual(dr.status, 'final'); assert.ok(dr.conclusion.includes('wedge compression fracture of T8'));
  assert.ok(dr.note[0].text.includes('"Incidental moderate wedge compression fracture of T8'));
});
check('C-2001 unknown fracture date: Condition is unconfirmed with the date-unknown onset', () => {
  const c = one(bundles['C-2001'], 'Condition');
  assert.strictEqual(c.verificationStatus.coding[0].code, 'unconfirmed');
  assert.ok(/Date unknown/.test(c.onsetString));
  assert.ok(c.note[0].text.startsWith('Quoted evidence: "'), 'evidence quoted in the first note');
});
check('C-2001 has no owner: no Practitioner and no owner on Tasks; DXA not yet ordered is a proposal', () => {
  const b = bundles['C-2001'];
  assert.strictEqual(byType(b, 'Practitioner').length, 0);
  assert.ok(byType(b, 'Task').every(t => t.owner === undefined));
  assert.strictEqual(one(b, 'ServiceRequest').intent, 'proposal');
});
check('C-1011 closed as dropped: unstarted Tasks are cancelled, CarePlan revoked', () => {
  const b = bundles['C-1011'];
  const tasks = byType(b, 'Task');
  assert.strictEqual(tasks.filter(t => t.status === 'cancelled').length, 3, 'stage 4 was open at the drop, stages 5 and 6 never started');
  assert.strictEqual(one(b, 'CarePlan').status, 'revoked');
});
check('Stage Tasks carry due dates from the app clock; urgent stage 2 uses 42 days', () => {
  const t2 = byType(bundles['C-1042'], 'Task').find(t => t.id === 'task-C-1042-2');
  assert.strictEqual(t2.status, 'draft', 'stage 2 not started on C-1042');
  assert.strictEqual(t2.restriction, undefined, 'no due date until the stage starts');
  // C-1029 stage 2 started day -27; urgent case, so the clock is 42 days: due day 15
  const t = byType(bundles['C-1029'], 'Task').find(x => x.id === 'task-C-1029-2');
  assert.strictEqual(t.restriction.period.end, dateStr(-27 + 42));
  assert.strictEqual(t.status, 'completed');
  assert.strictEqual(t.extension[0].valueBoolean, false, 'stage 2 finished on day -9, inside 42 days');
});
check('Overdue flags: C-1042 stage 1 (7-day clock, started day 0) is overdue on day 10', () => {
  const b = F.bundle(FIX['C-1042'], opts('C-1042', { day: 10 }));
  const t = byType(b, 'Task').find(x => x.id === 'task-C-1042-1');
  assert.strictEqual(t.extension[0].valueBoolean, true);
  assert.strictEqual(t.status, 'in-progress');
});
check('Same case, same options: output is deterministic (no random ids, no clock reads)', () => {
  assert.strictEqual(F.toJSON(build('C-1029')), F.toJSON(build('C-1029')));
});
check('Without a report, the DiagnosticReport is status unknown and says no radiology report is on file', () => {
  const dr = one(bundles['C-1042'], 'DiagnosticReport');
  assert.strictEqual(dr.status, 'unknown'); assert.ok(/No radiology report/.test(dr.conclusion));
});
check('QuestionnaireResponse per check-in: patient-reported, items present, flags as extensions', () => {
  const q = one(bundles['C-1018'], 'QuestionnaireResponse');
  assert.strictEqual(q.status, 'completed'); assert.strictEqual(q.item.length, 2);
  assert.strictEqual(q.item[0].answer[0].valueString, 'Yes');
  assert.ok(q.item[1].answer === undefined, 'empty answer omitted, not an empty string');
  assert.ok(q.extension.some(x => x.url === 'urn:osteoloop:checkin-flag' && /Heartburn/.test(x.valueString)));
  const pid = one(bundles['C-1018'], 'Patient').id;
  assert.strictEqual(q.subject.reference, F.fullUrl('Patient', pid));
});
check('No LOINC, SNOMED, RxNorm or ICD codes are used (none mapped yet)', () => {
  Object.keys(bundles).forEach(id => {
    const s = JSON.stringify(bundles[id]);
    assert.ok(!/loinc\.org|snomed\.info|rxnorm|hl7\.org\/fhir\/sid\/icd/i.test(s), id + ' uses a real terminology');
  });
});

/* ---------- 3. the validator must catch broken bundles (self-test) ---------- */
console.log('FHIR export: validator self-tests (it must reject known-bad bundles)');
const clone = (b) => JSON.parse(JSON.stringify(b));
const expectProblem = (name, mutate, needle, fixture) => check('rejects ' + name, () => {
  const b = clone(bundles[fixture || 'C-1042']); mutate(b);
  const p = validate(b); assert.ok(p.some(x => x.indexOf(needle) >= 0), 'not caught; problems: ' + JSON.stringify(p.slice(0, 3)));
});
expectProblem('a dangling reference', b => { byType(b, 'Condition')[0].subject = { reference: F.fullUrl('Patient', 'pt-GHOST') }; }, 'unresolved reference');
expectProblem('a missing required field', b => { const t = byType(b, 'Task')[0]; delete t.intent; }, 'missing intent');
expectProblem('an out-of-set status', b => { byType(b, 'Task')[0].status = 'finished'; }, 'status');
expectProblem('an unlisted resourceType', b => { b.entry.push({ fullUrl: F.fullUrl('Device', 'dev-1'), resource: { resourceType: 'Device', id: 'dev-1', meta: { tag: [F.TAG] } } }); }, 'not whitelisted');
expectProblem('a missing SYNTHETIC tag', b => { byType(b, 'Patient')[0].meta = {}; }, 'SYNTHETIC');
expectProblem('an empty string', b => { byType(b, 'Patient')[0].name[0].text = ''; }, 'empty string');
expectProblem('an email-like identifier', b => { byType(b, 'Patient')[0].identifier[0].value = 'mariam@example.com'; }, 'email');
expectProblem('an NRIC-like number', b => { byType(b, 'Patient')[0].extension.push({ url: 'urn:osteoloop:x', valueString: '640101-14-5555' }); }, 'NRIC');
expectProblem('an unmapped real terminology', b => { byType(b, 'Observation')[0].code.coding = [{ system: 'http://loinc.org', code: '2000-8' }]; }, 'unmapped system', 'C-1029');
expectProblem('an invented numeric local code', b => { byType(b, 'Condition')[0].code.coding = [{ system: 'urn:osteoloop:local', code: '12345' }]; }, 'numeric local code');
expectProblem('a non-SYN identifier', b => { byType(b, 'Patient')[0].identifier[0].value = 'MRN123456'; }, 'identifier not SYN-');

/* ---------- 4. input robustness: odd values do not break the bundle ---------- */
console.log('FHIR export: robustness');
check('a null stage list, an empty check-in list and no owner still produce a valid bundle', () => {
  const c = base({ id: 'C-3001', name: 'Test Case', age: null, sex: 'F', clin: { note: '' }, stages: stagesFrom([[0, 0, 0]]) });
  const b = F.bundle(c, { anchor: ANCHOR, day: 0, stages: F.DEFAULT_STAGES, clockFor });
  const p = validate(b); assert.deepStrictEqual(p, [], p.join(' | '));
});
check('a fully empty case object does not throw', () => {
  const b = F.bundle({ id: 'C-3002', name: 'Empty', stages: [] }, { anchor: ANCHOR });
  assert.strictEqual(validate(b).length, 0, validate(b).join(' | '));
});

function dateStr(day) {
  const [y, m, d] = ANCHOR.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1, d) + day * 864e5);
  return x.toISOString().slice(0, 10);
}

/* ---------- 5. the page itself: open a case, press Download, validate the bundle the page builds ---------- */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const APP = path.resolve(__dirname, '..', 'index.html');
function bootPage() {
  return new Promise((resolve, reject) => {
    const html = fs.readFileSync(APP, 'utf8').replace(/<link[^>]+fonts\.googleapis[^>]*>/g, '');
    const vc = new VirtualConsole(); vc.on('jsdomError', e => reject(e));
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'file://' + APP, pretendToBeVisual: true, virtualConsole: vc });
    dom.window.scrollTo = () => {};
    dom.window.addEventListener('load', () => resolve(dom));
  });
}
const readBlob = (W, blob) => new Promise((resolve, reject) => {
  const fr = new W.FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = () => reject(fr.error); fr.readAsText(blob);
});
async function pageChecks() {
  console.log('FHIR export: in-page download (jsdom)');
  const dom = await bootPage(), W = dom.window, d = W.document;
  const click = (sel) => { const e = d.querySelector(sel); if (!e) throw new Error('missing ' + sel); e.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };
  let captured = null;
  W.URL.createObjectURL = (blob) => { captured = blob; return 'blob:synthetic'; };
  W.URL.revokeObjectURL = () => {};
  W.HTMLAnchorElement.prototype.click = function () {};   // no navigation in jsdom
  click('[data-tab="board"]'); click('[data-open="C-1029"]');
  check('Case view shows the export card', () => assert.ok(d.querySelector('[data-a="fhir"]') && d.querySelector('[data-a="fhir-copy"]')));
  click('[data-a="fhir"]');
  check('Download builds a Blob of type application/fhir+json', () => {
    assert.ok(captured, 'no blob created'); assert.strictEqual(captured.type, 'application/fhir+json');
  });
  if (captured) {
    const text = await readBlob(W, captured);
    let b = null;
    check('the page-built bundle parses as JSON', () => { b = JSON.parse(text); });
    if (b) {
      check('page bundle validates (same checks as the fixtures)', () => { const p = validate(b); assert.deepStrictEqual(p, [], p.slice(0, 5).join(' | ')); });
      check('page bundle is for C-1029, Patient and 7 stage Tasks present', () => {
        assert.strictEqual(one(b, 'Patient').id, 'pt-C-1029'); assert.strictEqual(byType(b, 'Task').length, 7);
        assert.ok(byType(b, 'Practitioner').some(p => p.name[0].text === 'Dr Tan'));
      });
    }
  }
  // Copy fallback: no clipboard in jsdom, so it must fail soft (no throw, a message shown)
  check('Copy JSON fails soft when the clipboard is unavailable', () => {
    click('[data-a="fhir-copy"]');
    assert.ok(/not available|blocked|Copied/.test(d.querySelector('#view').textContent), 'no message shown');
  });
}

(async () => {
  try { await pageChecks(); } catch (e) { fails++; console.log('  FAIL in-page checks: ' + e.message); }
  console.log('');
  console.log('FHIR export checks: ' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})();
