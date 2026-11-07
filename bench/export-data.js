'use strict';
/*
 * Builds the linked datasheet in data/*.csv. Deterministic: no randomness, no clock.
 *
 * Real code paths: bench/reports.js + bench/reports-stress.js (synthetic reports), src/finder.js find()/verify()
 * (keyword reader), src/rules.js category() (risk category), src/checkin.js flags() (check-in flags).
 *
 * Copied fixtures: the seeded cases (index.html seedCases, lines ~226-258), the stage table (STAGES, ~line 187),
 * the clock rule (clockFor, ~line 274), the denosumab 182-day interval (index.html line ~806), and the two
 * records-lookup exclusions (FEED_SEED, ~line 589). index.html is not edited. If those change, update this file.
 *
 * Day 0 = 2026-11-07, the same as the app's DAY 0. Report dates are ANCHOR + day.
 * Every row, column and link is synthetic. See docs/data-model.md.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data');
const R = require(path.join(ROOT, 'src/rules.js'));
const FD = require(path.join(ROOT, 'src/finder.js'));
const CK = require(path.join(ROOT, 'src/checkin.js'));
const DEV = require('./reports.js');
const STRESS = require('./reports-stress.js');

const DAY_MS = 86400000;
const ANCHOR = Date.UTC(2026, 10, 7);
const iso = day => new Date(ANCHOR + day * DAY_MS).toISOString().slice(0, 10);
const dayOf = date => Math.round((Date.parse(date + 'T00:00:00Z') - ANCHOR) / DAY_MS);
const pad = (n, w) => String(n).padStart(w, '0');

/* ---------- fixtures copied from index.html ---------- */
const STAGES = [
  { n: 0, t: 'Screen', role: 'Screening clinic', clock: 0, evidence: 'screening result' },
  { n: 1, t: 'Notify and acknowledge', role: 'GP', clock: 7, evidence: 'acknowledgement' },
  { n: 2, t: 'Confirm: DXA and labs', role: 'GP, imaging, lab', clock: 30, evidence: 'DXA and lab results' },
  { n: 3, t: 'Decide or refer', role: 'GP, then specialist', clock: 7, evidence: 'referral or decision' },
  { n: 4, t: 'Treat: prescribe and dispense', role: 'Prescriber', clock: 14, evidence: 'dispensing record' },
  { n: 5, t: 'Follow up', role: 'GP', clock: 90, evidence: 'follow-up review' },
  { n: 6, t: 'Close', role: 'GP or programme lead', clock: 30, evidence: 'closure record' }
];
// index.html clockFor(): urgent patients get 42 days at the confirm stage
const clockFor = (urgent, i) => (i === 2 && urgent) ? 42 : STAGES[i].clock;

// index.html seedCases(). owner: 'GP' (the app's named GPs share this role) or null (unassigned).
// wantSite / wantDecision: the report type the note describes, used to pick the finding that opened the case.
const SEED = [
  { id: 'C-1042', age: 64, owner: 'GP', urgent: true, wantSite: 'wrist',
    clin: { fxMonths: 8, multiFx: false, fxOnGc: false, hipVert: false, mof: 18, hip: 4.1, cvEvent: false },
    hist: [[0, 0, 0], [1, 0, null]], res: null, rx: null },
  { id: 'C-1031', age: 69, owner: 'GP', wantSite: 'vert',
    clin: { fxMonths: null, multiFx: false, fxOnGc: false, hipVert: false, mof: 22, hip: 3.4, cvEvent: false },
    hist: [[0, -49, -49], [1, -49, -44], [2, -44, null]], res: null, rx: null },
  { id: 'C-1047', age: 58, owner: null, wantSite: null,
    clin: { fxMonths: null, multiFx: false, fxOnGc: true, hipVert: false, mof: 21, hip: 2.2, cvEvent: false },
    hist: [[0, -3, -3], [1, -3, null]], res: null, rx: null },
  { id: 'C-1029', age: 71, owner: 'GP', urgent: true, wantSite: 'vert',
    clin: { fxMonths: 14, multiFx: true, fxOnGc: true, hipVert: true, mof: 34, hip: 6.2, cvEvent: false },
    hist: [[0, -30, -30], [1, -30, -27], [2, -27, -9], [3, -9, null]], res: { t: -3.2, vd: 79, egfr: 48, ca: 2.35 }, rx: null },
  { id: 'C-1018', age: 66, owner: 'GP', wantSite: null,
    clin: { fxMonths: null, multiFx: false, fxOnGc: false, hipVert: false, mof: 24, hip: 3.6, cvEvent: false },
    hist: [[0, -70, -70], [1, -70, -66], [2, -66, -48], [3, -48, -45], [4, -45, -36], [5, -36, null]],
    res: { t: -2.9, vd: 88, egfr: 72, ca: 2.3 }, rx: { id: 'obp', name: 'Oral bisphosphonate (alendronate)', dispensed: -36 },
    checkin: { visit: 'review', answers: { med: 1, why: [0], sym: [0], rfall: 0, rfx: 1, dental: 1, cad: 0 } } },
  { id: 'C-1004', age: 73, owner: 'GP', wantSite: 'vert',
    clin: { fxMonths: null, multiFx: false, fxOnGc: false, hipVert: true, mof: 26, hip: 5.0, cvEvent: false },
    hist: [[0, -200, -200], [1, -200, -197], [2, -197, -175], [3, -175, -170], [4, -170, -160], [5, -160, -70], [6, -70, -60]],
    res: { t: -2.7, vd: 90, egfr: 65, ca: 2.32 }, rx: { id: 'deno', name: 'Denosumab', dispensed: -160 }, denoDue: 22,
    closed: { kind: 'treated', day: -60 } },
  { id: 'C-1011', age: 61, owner: 'GP', wantSite: null,
    clin: { fxMonths: null, multiFx: false, fxOnGc: false, hipVert: false, mof: 21, hip: 3.2, cvEvent: false },
    hist: [[0, -90, -90], [1, -90, -84], [2, -84, -60], [3, -60, -55], [4, -55, null]],
    res: { t: -2.6, vd: 70, egfr: 80, ca: 2.3 }, rx: null,
    closed: { kind: 'drop', day: -40, reason: 'Fear of medication side effects' } },
  { id: 'C-1036', age: 67, owner: 'GP', urgent: true, wantSite: 'hip',
    clin: { fxMonths: 6, multiFx: false, fxOnGc: false, hipVert: true, mof: 28, hip: 5.3, cvEvent: false },
    hist: [[0, -40, -40], [1, -40, -38], [2, -38, -20], [3, -20, -12], [4, -12, null]],
    res: { t: -3.1, vd: 95, egfr: 60, ca: 2.4 }, rx: { id: 'deno', name: 'Denosumab', dispensed: null } }
];

// index.html FEED_SEED entries that carry a simulated records lookup (pharmacy or EMR). Excluded before a case opens.
const FEED_EXCLUSIONS = [
  { report: 'R020', rx: 'Alendronate, dispensed 6 weeks ago' },
  { report: 'R005', status: 'Palliative care' }
];

/* ---------- CSV helpers ---------- */
function csv(headers, rows) {
  const q = v => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => q(r[h])).join(','))].join('\n') + '\n';
}
const write = (name, headers, rows) => fs.writeFileSync(path.join(OUT, name), csv(headers, rows));

/* ---------- 1. reports ---------- */
const ALL = [...DEV.map(r => Object.assign({}, r, { set: 'dev' })), ...STRESS.map(r => Object.assign({}, r, { set: 'stress' }))];
const reports = ALL.map((r, i) => ({
  report_id: r.id, patient_id: 'P-' + pad(i + 1, 4), modality: r.mod, date: null,
  age: r.age, sex: r.sex, text: r.text, indication: r.ind, label: r.label, set: r.set, _i: i, _r: r
}));
// Report dates for reports not used by a case: fixed offsets before day 0, cycling over 60 days.
const reportDay = {};   // report_id -> day
const caseLinkedDay = {};

/* ---------- 2. findings (keyword reader only; the AI reader needs an API key and is not run here) ---------- */
const findings = reports.map((row, i) => {
  const out = FD.find(row._r);
  const v = FD.verify(row._r, out);
  return {
    finding_id: 'F-' + pad(i + 1, 4), report_id: row.report_id, reader: 'keyword', decision: out.decision,
    site: out.site || '', evidence_quote: (out.evidence || []).join(' | '), verified: v.ok ? 1 : 0,
    _site: out.site || null, _age: row.age, _sex: row.sex, _rowIdx: i
  };
});

/* ---------- 3. cases: one finding each, chosen by matching the seeded note to a verified finding ---------- */
const usedFinding = new Set();
const seedCaseOut = [];
/* Report dates are set before the cases are built (the indicator reads them). */
const dateRows = () => reports.forEach((row, i) => {
  reportDay[row.report_id] = caseLinkedDay[row.report_id] !== undefined ? caseLinkedDay[row.report_id] : -(10 + (i % 60));
  row.date = iso(reportDay[row.report_id]);
});
for (const s of SEED) {
  const pool = findings.filter(f => !usedFinding.has(f.finding_id) && f.decision !== 'no' && f.verified === 1);
  const score = f => ((f._site) !== (s.wantSite || null) ? 100 : 0)
    + (f.decision === (s.wantSite ? 'act' : 'review') ? 0 : 20)
    + (f._sex === 'F' ? 0 : 50)
    + Math.abs(f._age - s.age);
  const best = pool.reduce((a, b) => (score(b) < score(a) ? b : a));
  if (!best) throw new Error('no finding available for ' + s.id);
  usedFinding.add(best.finding_id);
  const rep = reports[best._rowIdx];
  // stages
  const stages = STAGES.map(() => ({ start: null, end: null }));
  s.hist.forEach(([i, st, en]) => { stages[i] = { start: st, end: en }; });
  const opened = stages[0].start;
  caseLinkedDay[rep.report_id] = opened;
  seedCaseOut.push({ s, f: best, rep, stages, opened });
}
dateRows();

const reportById = Object.fromEntries(reports.map(r => [r.report_id, r]));

/* Patient mapping, same as index.html toPatient() (c.pt is never set in the seeds) */
function toPatient(s) {
  const k = s.clin, fx = [];
  if (k.fxMonths !== null) fx.push({ site: k.hipVert ? 'hip' : 'wrist', months: k.fxMonths, onGc: k.fxOnGc });
  else if (k.hipVert) fx.push({ site: 'vert', months: 60, onGc: k.fxOnGc });
  if (k.multiFx) fx.push({ site: 'vert', months: k.fxMonths !== null ? k.fxMonths : 60, onGc: k.fxOnGc });
  const r = s.res || {};
  return { age: s.age, sex: 'F', menopause: 'post', fractures: fx, cvEvent: k.cvEvent,
    t: r.t ?? null, mof: k.mof, hip: k.hip, egfr: r.egfr ?? null, ca: r.ca ?? null, vd: r.vd ?? null, spep: null };
}

const cases = [], stageEvents = [], results = [], treatments = [], checkins = [], indicator = [];
let evN = 0, resN = 0, trN = 0, ciN = 0;
for (const o of seedCaseOut) {
  const { s, f, rep, stages, opened } = o;
  const cat = R.category(toPatient(s)).key;
  const ownerRole = s.owner || 'unassigned';
  const curIdx = stages.findIndex((st, i) => st.start !== null && st.end === null);
  const stageNow = s.closed ? 'closed' : (curIdx >= 0 ? curIdx : '');
  cases.push({ case_id: s.id, finding_id: f.finding_id, patient_id: rep.patient_id, opened_day: opened,
    owner_role: ownerRole, risk_category: cat, stage_now: stageNow,
    closure_kind: s.closed ? s.closed.kind : '', closed_day: s.closed ? s.closed.day : '' });

  stages.forEach((st, i) => {
    if (st.start === null) return;
    const due = st.start + clockFor(s.urgent, i);
    evN++;
    stageEvents.push({ event_id: 'E-' + pad(evN, 4), case_id: s.id, stage: i, owner_role: STAGES[i].role,
      started_day: st.start, due_day: due, closed_day: st.end === null ? '' : st.end,
      evidence_type: st.end === null ? '' : STAGES[i].evidence });
  });

  if (s.res) {
    const dxaDay = stages[2].start !== null ? stages[2].start : opened;
    const add = (kind, analyte, value) => { resN++; results.push({ result_id: 'RS-' + pad(resN, 4), case_id: s.id, kind, analyte, value, date: iso(dxaDay) }); };
    add('DXA', 'lowest_T_score', s.res.t);
    add('lab', 'vitamin_D_nmol_per_L', s.res.vd);
    add('lab', 'eGFR_mL_per_min', s.res.egfr);
    add('lab', 'adjusted_calcium_mmol_per_L', s.res.ca);
  }

  let dispensedDay = null;
  if (s.rx) {
    trN++;
    dispensedDay = s.rx.dispensed;
    let nextDue = s.denoDue !== undefined ? s.denoDue : '';
    if (s.rx.id === 'deno' && dispensedDay !== null) {
      if (nextDue !== '' && nextDue !== dispensedDay + 182) throw new Error('denosumab interval mismatch for ' + s.id);
      if (nextDue === '') nextDue = dispensedDay + 182;
    }
    treatments.push({ treatment_id: 'T-' + pad(trN, 4), case_id: s.id, drug: s.rx.name,
      dispensed_day: dispensedDay === null ? '' : dispensedDay, next_due_day: nextDue });
  }

  if (s.checkin) {
    ciN++;
    const fl = CK.flags(s.checkin.visit, s.checkin.answers, { rx: s.rx ? s.rx.id : null });
    checkins.push({ checkin_id: 'CI-' + pad(ciN, 4), case_id: s.id, set: s.checkin.visit,
      answers_json: JSON.stringify(s.checkin.answers), flags: JSON.stringify(fl.map(x => x[0])) });
  }

  if (f.decision === 'act') {
    const reportDayN = reportDay[rep.report_id];
    indicator.push({ patient_id: rep.patient_id, fracture_report_date: rep.date,
      treatment_dispensed_date: dispensedDay === null ? '' : iso(dispensedDay),
      within_6_months: (dispensedDay !== null && dispensedDay - reportDayN <= 180) ? 1 : 0 });
  }
}

/* ---------- 4. exclusions (records lookup before a case opens) ---------- */
const exclusions = FEED_EXCLUSIONS.map((x, i) => {
  const rep = reportById[x.report];
  if (!rep) throw new Error('exclusion report missing: ' + x.report);
  return { exclusion_id: 'X-' + pad(i + 1, 3), report_id: rep.report_id, patient_id: rep.patient_id,
    source: x.rx ? 'pharmacy' : 'records',
    reason: x.rx ? 'Already on treatment (' + x.rx + ')' : x.status,
    decision: 'skipped' };
});

/* ---------- write ---------- */
fs.mkdirSync(OUT, { recursive: true });
write('reports.csv', ['report_id', 'patient_id', 'modality', 'date', 'age', 'sex', 'text', 'indication', 'label', 'set'],
  reports.map(r => ({ report_id: r.report_id, patient_id: r.patient_id, modality: r.modality, date: r.date,
    age: r.age, sex: r.sex, text: r.text, indication: r.indication, label: r.label, set: r.set })));
write('findings.csv', ['finding_id', 'report_id', 'reader', 'decision', 'site', 'evidence_quote', 'verified'],
  findings.map(f => ({ finding_id: f.finding_id, report_id: f.report_id, reader: f.reader, decision: f.decision,
    site: f.site, evidence_quote: f.evidence_quote, verified: f.verified })));
write('cases.csv', ['case_id', 'finding_id', 'patient_id', 'opened_day', 'owner_role', 'risk_category', 'stage_now', 'closure_kind', 'closed_day'], cases);
write('stage_events.csv', ['event_id', 'case_id', 'stage', 'owner_role', 'started_day', 'due_day', 'closed_day', 'evidence_type'], stageEvents);
write('results.csv', ['result_id', 'case_id', 'kind', 'analyte', 'value', 'date'], results);
write('treatments.csv', ['treatment_id', 'case_id', 'drug', 'dispensed_day', 'next_due_day'], treatments);
write('checkins.csv', ['checkin_id', 'case_id', 'set', 'answers_json', 'flags'], checkins);
write('exclusions.csv', ['exclusion_id', 'report_id', 'patient_id', 'source', 'reason', 'decision'], exclusions);
write('indicator.csv', ['patient_id', 'fracture_report_date', 'treatment_dispensed_date', 'within_6_months'], indicator);

console.log('wrote data/*.csv');
console.log(`reports ${reports.length}, findings ${findings.length}, cases ${cases.length}, stage_events ${stageEvents.length}, ` +
  `results ${results.length}, treatments ${treatments.length}, checkins ${checkins.length}, exclusions ${exclusions.length}, indicator ${indicator.length}`);
