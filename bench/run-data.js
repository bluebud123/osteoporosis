'use strict';
/*
 * Integrity checks for the linked datasheet in data/*.csv. Reads the CSV files from disk (it does not reuse
 * the export's in-memory data), so it tests what was actually written. Exit 1 on any FAIL.
 */
const fs = require('fs');
const path = require('path');
const FD = require(path.join(__dirname, '../src/finder.js'));

const DIR = path.join(__dirname, '../data');
const SCHEMA = {
  'reports.csv': ['report_id', 'patient_id', 'modality', 'date', 'age', 'sex', 'text', 'indication', 'label', 'set'],
  'findings.csv': ['finding_id', 'report_id', 'reader', 'decision', 'site', 'evidence_quote', 'verified'],
  'cases.csv': ['case_id', 'finding_id', 'patient_id', 'opened_day', 'owner_role', 'risk_category', 'stage_now', 'closure_kind', 'closed_day'],
  'stage_events.csv': ['event_id', 'case_id', 'stage', 'owner_role', 'started_day', 'due_day', 'closed_day', 'evidence_type'],
  'results.csv': ['result_id', 'case_id', 'kind', 'analyte', 'value', 'date'],
  'treatments.csv': ['treatment_id', 'case_id', 'drug', 'dispensed_day', 'next_due_day'],
  'checkins.csv': ['checkin_id', 'case_id', 'set', 'answers_json', 'flags'],
  'exclusions.csv': ['exclusion_id', 'report_id', 'patient_id', 'source', 'reason', 'decision'],
  'indicator.csv': ['patient_id', 'fracture_report_date', 'treatment_dispensed_date', 'within_6_months']
};

/* Minimal RFC 4180 parser: quoted fields, doubled quotes, commas and newlines inside quotes. */
function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const tables = {};
let loadErr = [];
for (const [file, headers] of Object.entries(SCHEMA)) {
  const p = path.join(DIR, file);
  if (!fs.existsSync(p)) { loadErr.push(file + ' missing'); continue; }
  const rows = parseCSV(fs.readFileSync(p, 'utf8'));
  const head = rows.shift();
  const objs = rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
  tables[file.replace('.csv', '')] = { head, rows, objs, file };
}

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log('PASS  ' + name + (detail ? ' (' + detail + ')' : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail ? ': ' + detail : '')); }
};
const count = (arr, pred) => arr.filter(pred).length;
const dupes = (arr, key) => { const seen = new Set(), d = []; for (const x of arr) { const k = x[key]; if (seen.has(k)) d.push(k); seen.add(k); } return d; };
const isISO = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const isInt = s => /^-?\d+$/.test(s);
const dayNum = s => Date.parse(s + 'T00:00:00Z') / 86400000;

check('data files load', loadErr.length === 0, loadErr.join('; ') || Object.keys(SCHEMA).length + ' files');
if (loadErr.length) { console.log(`\n${pass} PASS, ${fail} FAIL`); process.exit(1); }

/* Headers and row widths */
for (const [file, headers] of Object.entries(SCHEMA)) {
  const t = tables[file.replace('.csv', '')];
  check(`${file} header`, JSON.stringify(t.head) === JSON.stringify(headers), t.head.join(','));
  const bad = t.rows.filter(r => r.length !== headers.length).length;
  check(`${file} row widths`, bad === 0, bad + ' bad rows');
}

const T = tables;
const reports = T.reports.objs, findings = T.findings.objs, cases = T.cases.objs, ev = T.stage_events.objs;
const results = T.results.objs, treat = T.treatments.objs, cks = T.checkins.objs, excl = T.exclusions.objs, ind = T.indicator.objs;

/* Primary keys */
const pk = [['reports', reports, 'report_id'], ['findings', findings, 'finding_id'], ['cases', cases, 'case_id'],
  ['stage_events', ev, 'event_id'], ['results', results, 'result_id'], ['treatments', treat, 'treatment_id'],
  ['checkins', cks, 'checkin_id'], ['exclusions', excl, 'exclusion_id']];
for (const [name, arr, key] of pk) {
  const d = dupes(arr, key);
  check(`${name}.${key} unique`, d.length === 0, d.slice(0, 5).join(', ') || arr.length + ' rows');
}
check('reports.patient_id unique (one synthetic patient per report)', dupes(reports, 'patient_id').length === 0);
check('indicator.patient_id unique', dupes(ind, 'patient_id').length === 0);

/* Foreign keys */
const reportIds = new Set(reports.map(r => r.report_id));
const findingIds = new Set(findings.map(f => f.finding_id));
const caseIds = new Set(cases.map(c => c.case_id));
const patientOf = Object.fromEntries(reports.map(r => [r.report_id, r.patient_id]));
const reportOfFinding = Object.fromEntries(findings.map(f => [f.finding_id, f.report_id]));
const findingById = Object.fromEntries(findings.map(f => [f.finding_id, f]));
const decisionOf = c => (findingById[c.finding_id] || {}).decision;
const fk = (name, arr, col, target) => {
  const miss = arr.filter(r => !target.has(r[col]));
  check(`FK ${name}.${col}`, miss.length === 0, miss.length ? miss.slice(0, 5).map(r => r[col]).join(', ') : arr.length + ' rows resolve');
};
fk('findings -> reports', findings, 'report_id', reportIds);
fk('cases -> findings', cases, 'finding_id', findingIds);
fk('stage_events -> cases', ev, 'case_id', caseIds);
fk('results -> cases', results, 'case_id', caseIds);
fk('treatments -> cases', treat, 'case_id', caseIds);
fk('checkins -> cases', cks, 'case_id', caseIds);
fk('exclusions -> reports', excl, 'report_id', reportIds);
const patientIds = new Set(reports.map(r => r.patient_id));
fk('cases -> patients (reports.patient_id)', cases, 'patient_id', patientIds);
fk('exclusions -> patients (reports.patient_id)', excl, 'patient_id', patientIds);
fk('indicator -> patients (reports.patient_id)', ind, 'patient_id', patientIds);

/* Trace: case -> finding -> report, and the patient must agree at every hop */
const traceBad = cases.filter(c => { const rid = reportOfFinding[c.finding_id]; return !rid || patientOf[rid] !== c.patient_id; });
check('trace: every case reaches a report through finding_id, same patient', traceBad.length === 0,
  traceBad.map(c => c.case_id).join(', ') || cases.length + '/' + cases.length + ' cases');
check('each finding opens at most one case', dupes(cases, 'finding_id').length === 0);
const caseDecision = cases.map(decisionOf);
check('cases only from act or review findings', caseDecision.every(d => d === 'act' || d === 'review'), caseDecision.join(' '));
check('cases only from verified findings', cases.every(c => (findingById[c.finding_id] || {}).verified === '1'));
const exclReports = new Set(excl.map(x => x.report_id));
check('excluded reports open no case', cases.every(c => !exclReports.has(reportOfFinding[c.finding_id])));

/* findings.csv must equal what the code produces from reports.csv */
const recomputed = reports.map(r => {
  const out = FD.find({ id: r.report_id, text: r.text, age: +r.age, sex: r.sex, ind: r.indication });
  return { id: r.report_id, decision: out.decision, site: out.site || '', ev: (out.evidence || []).join(' | ') };
});
const byReport = Object.fromEntries(findings.map(f => [f.report_id, f]));
const drift = recomputed.filter(x => { const f = byReport[x.id]; return !f || f.decision !== x.decision || f.site !== x.site || f.evidence_quote !== x.ev; });
check('findings.csv matches src/finder.js find() on reports.csv', drift.length === 0, drift.slice(0, 3).map(x => x.id).join(', ') || reports.length + ' reports');

/* Stage events: range, order, one row per case and stage */
const evKeys = ev.map(e => e.case_id + '#' + e.stage);
check('one stage event per case and stage', dupes(ev.map(e => ({ k: e.case_id + '#' + e.stage })), 'k').length === 0);
check('stage in 0..6', ev.every(e => isInt(e.stage) && +e.stage >= 0 && +e.stage <= 6));
check('due_day >= started_day and closed_day >= started_day', ev.every(e => +e.due_day >= +e.started_day && (e.closed_day === '' || +e.closed_day >= +e.started_day)));
check('cases.opened_day equals stage 0 started_day', cases.every(c => ev.some(e => e.case_id === c.case_id && e.stage === '0' && e.started_day === c.opened_day)));
const stageNowOK = cases.every(c => {
  if (c.closure_kind) return c.stage_now === 'closed';
  const open = ev.filter(e => e.case_id === c.case_id && e.closed_day === '').map(e => +e.stage);
  return c.stage_now === String(Math.max(...open));
});
check('cases.stage_now matches the open stage (closed if closure_kind set)', stageNowOK);
check('closed cases have closed_day', cases.every(c => !c.closure_kind || c.closed_day !== ''));

/* Results, treatments, check-ins */
check('results.value numeric', results.every(r => r.value !== '' && !Number.isNaN(+r.value)));
check('results.kind in DXA|lab|SPEP', results.every(r => ['DXA', 'lab', 'SPEP'].includes(r.kind)));
check('treatments: denosumab next_due = dispensed + 182', treat.every(t => t.drug !== 'Denosumab' || t.dispensed_day === '' || +t.next_due_day === +t.dispensed_day + 182));
check('treatments: dispensed day matches stage 4 closed_day where both exist',
  treat.every(t => { const e = ev.find(x => x.case_id === t.case_id && x.stage === '4'); return !e || e.closed_day === '' || t.dispensed_day === e.closed_day; }));
check('check-in answers and flags are valid JSON', cks.every(c => { try { JSON.parse(c.answers_json); JSON.parse(c.flags); return true; } catch (e) { return false; } }));

/* Indicator: derived from cases, reports and treatments */
const actCases = cases.filter(c => decisionOf(c) === 'act');
check('indicator rows = cases whose finding is act', ind.length === actCases.length, ind.length + ' vs ' + actCases.length);
check('indicator patients all have an act case', ind.every(i => actCases.some(c => c.patient_id === i.patient_id)));
const indOK = ind.every(i => {
  const c = actCases.find(x => x.patient_id === i.patient_id); if (!c) return false;
  const rep = reports.find(r => r.report_id === reportOfFinding[c.finding_id]);
  const t = treat.find(x => x.case_id === c.case_id);
  const disp = t && t.dispensed_day !== '' ? t.dispensed_day : '';
  const dispDate = disp === '' ? '' : new Date(Date.UTC(2026, 10, 7) + (+disp) * 86400000).toISOString().slice(0, 10);
  const within = disp !== '' && (+disp - (dayNum(rep.date) - dayNum('2026-11-07'))) <= 180 ? '1' : '0';
  return i.fracture_report_date === rep.date && i.treatment_dispensed_date === dispDate && i.within_6_months === within;
});
check('indicator: fracture date, dispensing date and within_6_months agree with the source tables', indOK);
check('indicator: ISO dates', ind.every(i => isISO(i.fracture_report_date) && (i.treatment_dispensed_date === '' || isISO(i.treatment_dispensed_date))));
const num = count(ind, i => i.within_6_months === '1'), den = ind.length;
check('indicator numerator <= denominator', num <= den, `numerator ${num}, denominator ${den}`);

/* Values and vocab */
check('reports.label in act|review|no', reports.every(r => ['act', 'review', 'no'].includes(r.label)));
check('findings.decision in act|review|no', findings.every(f => ['act', 'review', 'no'].includes(f.decision)));
check('findings.reader is keyword (no AI rows; see docs)', findings.every(f => f.reader === 'keyword'));
check('report dates are ISO', reports.every(r => isISO(r.date)));
check('cases.risk_category in vhigh|high|low|incomplete', cases.every(c => ['vhigh', 'high', 'low', 'incomplete'].includes(c.risk_category)));
check('no case is labelled low while at risk or incomplete (none expected)', cases.every(c => c.risk_category !== 'low'));

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
