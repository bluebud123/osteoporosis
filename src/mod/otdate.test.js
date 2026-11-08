'use strict';
// OT (operating theatre) date: calendar helpers, date changes, guards, at-risk rules, timezone safety.
// Fictional data only. Run: node mod/otdate.test.js  (exit 0 when every check passes)
const path = require('path');
const { spawnSync } = require('child_process');
const intake = require('./intake.js');
const eng = require('../engine.js');
const OT = intake.OT;
const D = 24;

let pass = 0, fail = 0; const fails = [];
function check(name, ok, detail) {
  if (ok) pass++; else { fail++; fails.push(name + (detail !== undefined ? ' :: ' + JSON.stringify(detail) : '')); }
}
function mkSim(anchor) { const s = new eng.Sim(); s.plAnchor = anchor || '2026-11-08'; return s; }
function addP(s, pid, proc) { return s.addPatient({ id: pid, name: pid, procedure: proc || 'TKR', surgeryIn: 14 }); }
// Same shape as intake.todos() output; keys match the engine's critical list.
function todos() {
  return [
    { key: 'anticoag_decision', title: 'Clinician decision: blood thinner', owner: 'surgeon', dueDays: -14, kind: 'review', reason: 'blood_thinner', needsClinician: true },
    { key: 'anaesthetic_review', title: 'Anaesthetic review', owner: 'anaesthetist', dueDays: -10, kind: 'appt', reason: 'heart_disease', needsClinician: true },
    { key: 'preauth', title: 'Insurance pre-authorisation obtained', owner: 'clinic_coordinator', dueDays: -10, kind: 'admin', reason: 'payer', needsClinician: false },
    { key: 'physio_social_review', title: 'Physio review of home', owner: 'physio', dueDays: -7, kind: 'physio', reason: 'stairs_home', needsClinician: false },
    { key: 'intake_red_flag', title: 'Red flag: urgent', owner: 'clinician', dueDays: 0, kind: 'review', reason: 'x', needsClinician: true, urgent: true },
    { key: 'clinician_review_worsening', title: 'Worsening: review', owner: 'clinician', dueDays: 0, dueHours: 48, kind: 'review', reason: 'freeText.0', needsClinician: true }
  ];
}
const byType = (s, pid, type) => s.tasks.find(t => t.pid === pid && t.type === type);
const critOpen = (s, pid) => s.tasks.filter(t => t.pid === pid && OT.CRITICAL_KEYS.includes(t.type) && t.state !== 'closed' && t.state !== 'confirmed').length;

// ---- 1. calendar helpers (pure calendar arithmetic) ----
check('parse rejects impossible date', OT.parseYmd('2026-02-30') === null);
check('parse rejects unpadded date', OT.parseYmd('2026-11-8') === null);
check('parse accepts padded date', !!OT.parseYmd('2026-11-08'));
check('addDays over year end', OT.addDays('2026-12-31', 1) === '2027-01-01');
check('addDays back over Feb', OT.addDays('2026-03-01', -1) === '2026-02-28');
check('weekday label (13 Nov 2026 is a Friday)', OT.fmtCal('2026-11-13', 'en') === 'Fri 13 Nov', OT.fmtCal('2026-11-13', 'en'));
check('dayNum difference is calendar days', OT.dayNum('2026-11-22') - OT.dayNum('2026-11-08') === 14);

// ---- 2. days to OT follow the demo clock; the OT date itself stays fixed when the clock moves ----
{
  const s = mkSim('2026-11-08'); addP(s, 'P');
  check('14 days to OT at demo start', OT.daysToOT(s, 'P') === 14, OT.daysToOT(s, 'P'));
  check('OT calendar date is anchor + 14', OT.otDate(s, 'P') === '2026-11-22', OT.otDate(s, 'P'));
  s.advance(48);
  check('clock +2 days: 12 days to OT', OT.daysToOT(s, 'P') === 12, OT.daysToOT(s, 'P'));
  check('clock +2 days: OT date unchanged', OT.otDate(s, 'P') === '2026-11-22', OT.otDate(s, 'P'));
  const r = OT.setOT(s, 'P', '2026-11-15');
  check('set OT relative to demo clock', r.ok && r.days === 5 && s.P('P').surgeryAt === s.now + 5 * D, r);
}

// ---- 3. date change recomputes intake dues; no duplicate tasks ----
{
  const s = mkSim('2026-11-08'); addP(s, 'Q');
  const made = intake.toTasks(s, 'Q', todos());
  check('intake to-dos created', made.length === 6, made.length);
  const before = s.tasks.length;
  const sur0 = s.P('Q').surgeryAt;
  check('anticoag due 14 days before OT (initial)', byType(s, 'Q', 'anticoag_decision').dueAt === sur0 - 14 * D);
  const r = OT.setOT(s, 'Q', '2026-12-01');
  check('set OT to 1 Dec ok', r.ok && r.days === 23, r);
  const sur1 = s.P('Q').surgeryAt;
  check('anticoag due moves with OT', byType(s, 'Q', 'anticoag_decision').dueAt === sur1 - 14 * D);
  check('anaesthetic due moves with OT', byType(s, 'Q', 'anaesthetic_review').dueAt === sur1 - 10 * D);
  check('urgent red-flag task does not move', byType(s, 'Q', 'intake_red_flag').dueAt === 0, byType(s, 'Q', 'intake_red_flag').dueAt);
  check('hours-based worsening task does not move', byType(s, 'Q', 'clinician_review_worsening').dueAt === 48);
  check('label: 14 days before OT', OT.dueLabel(s, byType(s, 'Q', 'anticoag_decision'), 'en') === 'Tue 17 Nov, 14 days before OT',
    OT.dueLabel(s, byType(s, 'Q', 'anticoag_decision'), 'en'));
  check('label check is real weekday', new Date(Date.UTC(2026, 10, 17)).getUTCDay() === 2);
  const again = intake.toTasks(s, 'Q', todos());
  OT.setOT(s, 'Q', '2026-12-01');
  check('re-sending to-dos adds nothing', again.length === 0 && s.tasks.length === before, again.length);
  check('same date twice adds nothing', s.tasks.length === before);
}

// ---- 4. engine checklist items (auto) move with the OT date using the engine's own offsets ----
{
  const s = mkSim('2026-11-08'); addP(s, 'E', 'TKR');
  s.start('E');
  OT.setOT(s, 'E', '2026-11-30');
  const sur = s.P('E').surgeryAt, risk = s.cfg.atRiskBeforeSurgeryHrs;
  const consent = byType(s, 'E', 'consent'), knee = byType(s, 'E', 'knee_rom');
  check('engine consent due = surgery - 14 days', consent.dueAt === sur - 14 * D, consent.dueAt - sur);
  check('engine TKR extra due = surgery + 14 days', knee.dueAt === sur + 14 * D, knee.dueAt - sur);
  check('atRiskAt = surgery - engine lead time', consent.atRiskAt === sur - risk);
}

// ---- 5. past dates are blocked; nothing changes ----
{
  const s = mkSim('2026-11-08'); addP(s, 'B');
  const sur = s.P('B').surgeryAt;
  const r = OT.setOT(s, 'B', '2026-11-07');
  check('past date refused', !r.ok && r.reason === 'past', r);
  check('past date leaves surgeryAt alone', s.P('B').surgeryAt === sur);
  const st = OT.otStatus(s, 'B', '2026-11-07', 'en');
  check('status blocks past date with a clear message', st.blocked && /already passed/.test(st.blockMsg), st.blockMsg);
  s.advance(20 * D);
  const st2 = OT.otStatus(s, 'B', '2026-11-22', 'en');
  check('OT that has passed by the clock is blocked', st2.blocked && st2.days < 0, st2);
  check('invalid date refused', OT.setOT(s, 'B', '2026-02-30').reason === 'invalid');
}

// ---- 6. fewer than 2 days: warning ----
{
  const s = mkSim('2026-11-08'); addP(s, 'W');
  const w = d => OT.otStatus(s, 'W', d, 'en').warn;
  check('today gets the too-late warning', /too late for routine pre-op work-up; clinician to decide/.test(w('2026-11-08') || ''));
  check('tomorrow gets the too-late warning', /too late for routine pre-op work-up; clinician to decide/.test(w('2026-11-09') || ''));
  check('two days away: no warning', w('2026-11-10') === null);
  check('past date: no warning, blocked instead', OT.otStatus(s, 'W', '2026-11-01', 'en').warn === null);
}

// ---- 7. at-risk banner conditions ----
{
  const s = mkSim('2026-11-08'); addP(s, 'R'); intake.toTasks(s, 'R', todos());
  const n = critOpen(s, 'R');
  check('three critical items are open after intake', n === 3, n);
  OT.setOT(s, 'R', '2026-11-13'); // 5 days away
  const b = OT.otStatus(s, 'R', '2026-11-13', 'en').banner;
  check('within 7 days + critical open: banner', b === 'Surgery at risk: 3 critical items open', b);
  OT.setOT(s, 'R', '2026-11-22'); // 14 days away
  check('14 days away: no banner', OT.otStatus(s, 'R', '2026-11-22', 'en').banner === null);
  OT.setOT(s, 'R', '2026-11-15'); // exactly 7 days away
  check('exactly 7 days away: banner', !!OT.otStatus(s, 'R', '2026-11-15', 'en').banner);
  OT.setOT(s, 'R', '2026-11-16'); // 8 days away
  check('8 days away: no banner', OT.otStatus(s, 'R', '2026-11-16', 'en').banner === null);
  // critical items closed with evidence: no banner
  OT.setOT(s, 'R', '2026-11-13');
  ['anticoag_decision', 'anaesthetic_review', 'preauth'].forEach(k => {
    const t = byType(s, 'R', k);
    s.close(t.id, { by: { role: 'clinician' }, evidence: [{ note: 'documented' }], note: 'reviewed' });
  });
  check('critical items closed: no banner', OT.otStatus(s, 'R', '2026-11-13', 'en').banner === null);
  // only a non-critical item open within 7 days: no banner
  const s2 = mkSim('2026-11-08'); addP(s2, 'N'); intake.toTasks(s2, 'N', [todos()[3]]);
  OT.setOT(s2, 'N', '2026-11-13');
  check('non-critical item open: no banner', OT.otStatus(s2, 'N', '2026-11-13', 'en').banner === null);
  // critical item in the past window (OT passed): blocked, no banner
  check('passed OT: no banner', OT.otStatus(s, 'R', '2026-11-01', 'en').banner === null);
}

// ---- 8. closed and confirmed tasks stay closed ----
{
  const s = mkSim('2026-11-08'); addP(s, 'C'); intake.toTasks(s, 'C', todos());
  const an = byType(s, 'C', 'anaesthetic_review');
  const closed = s.close(an.id, { by: { role: 'clinician' }, evidence: [{ note: 'repeat result' }], note: 'done' });
  check('clinician closes with evidence', closed.ok === true);
  const cDue = an.dueAt;
  const pa = byType(s, 'C', 'preauth'); pa.state = 'confirmed';
  OT.setOT(s, 'C', '2026-11-09');
  check('closed task stays closed when OT moves earlier', an.state === 'closed' && an.dueAt === cDue, an.state);
  check('confirmed task stays confirmed', pa.state === 'confirmed');
  OT.setOT(s, 'C', '2026-12-20');
  check('closed task stays closed when OT moves later', an.state === 'closed' && an.atRisk !== true);
}

// ---- 9. earlier OT flags open items at risk; later OT relaxes them ----
{
  const s = mkSim('2026-11-08'); addP(s, 'Z'); intake.toTasks(s, 'Z', todos());
  const ov = t => t.state === 'overdue';
  OT.setOT(s, 'Z', '2026-11-11'); // 3 days away: anticoag due 14 days before is long gone
  const ac = byType(s, 'Z', 'anticoag_decision'), ph = byType(s, 'Z', 'physio_social_review');
  check('earlier OT: passed due dates become overdue', ov(ac) && ov(ph), [ac.state, ph.state]);
  check('earlier OT: overdue items flagged at risk', ac.atRisk === true && ph.atRisk === true);
  check('earlier OT: patient flagged at risk', s.P('Z').atRisk === true);
  check('earlier OT: at_risk recorded in the log', s.log.some(l => l.type === 'at_risk' && l.pid === 'Z'));
  OT.setOT(s, 'Z', '2026-12-31'); // far later
  check('later OT: overdue relaxes to open', ac.state === 'open' && ph.state === 'open', [ac.state, ph.state]);
  check('later OT: at-risk relaxes', ac.atRisk === false && ph.atRisk === false);
  check('later OT: patient no longer at risk', s.P('Z').atRisk === false);
  // engine rule: within lead time of OT every open item is at risk
  OT.setOT(s, 'Z', '2026-11-09');
  const lead = OT.otStatus(s, 'Z', '2026-11-09', 'en');
  check('within 24 h of OT: open items at risk (engine rule)', byType(s, 'Z', 'physio_social_review').atRisk === true && lead.warn !== null);
}

// ---- 10. timezone safety: same date string, same days to OT, in several zones ----
{
  const code = [
    "const I=require(" + JSON.stringify(path.join(__dirname, 'intake.js')) + ");const E=require(" + JSON.stringify(path.join(__dirname, '..', 'engine.js')) + ");",
    "const O=I.OT;const out={};",
    "const s=new E.Sim();s.plAnchor='2026-11-08';s.addPatient({id:'T',name:'t',procedure:'TKR',surgeryIn:14});",
    "out.days14=O.daysToOT(s,'T');out.otDate=O.otDate(s,'T');",
    "out.localDay=O.ymdOfLocal(new Date(2026,10,8,0,30));",
    "out.plus14=O.daysFromNow(s,O.addDays(O.ymdOfLocal(new Date(2026,10,8,0,30)),14));",
    "const s2=new E.Sim();s2.plAnchor=O.ymdOfLocal(new Date(2026,2,7,12,0));out.dstSpring=O.daysFromNow(s2,'2026-03-09');",
    "const s3=new E.Sim();s3.plAnchor=O.ymdOfLocal(new Date(2026,9,31,12,0));out.dstFall=O.daysFromNow(s3,'2026-11-02');",
    "out.defaultAnchorOffset=O.daysFromNow(new E.Sim(),O.addDays(O.ymdOfLocal(new Date()),14));",
    "process.stdout.write(JSON.stringify(out));"
  ].join('');
  const zones = ['Asia/Kuala_Lumpur', 'America/Los_Angeles', 'UTC'];
  const results = zones.map(tz => {
    const r = spawnSync(process.execPath, ['-e', code], { env: Object.assign({}, process.env, { TZ: tz }), encoding: 'utf8' });
    return { tz, ok: r.status === 0, out: r.stdout, err: r.stderr };
  });
  results.forEach(r => check('child runs under ' + r.tz, r.ok, r.err));
  const parsed = results.map(r => { try { return JSON.parse(r.out); } catch (e) { return null; } });
  const expect = { days14: 14, otDate: '2026-11-22', localDay: '2026-11-08', plus14: 14, dstSpring: 2, dstFall: 2, defaultAnchorOffset: 14 };
  zones.forEach((tz, i) => {
    const got = parsed[i] || {};
    Object.keys(expect).forEach(k => check('tz ' + tz + ' ' + k, got[k] === expect[k], got[k]));
  });
  check('all zones agree', parsed.every(p => p && JSON.stringify(p) === JSON.stringify(parsed[0])), parsed);
}

const total = pass + fail;
fails.forEach(f => console.log('FAIL ' + f));
console.log('otdate: ' + pass + ' PASS, ' + fail + ' FAIL (of ' + total + ' checks)');
process.exit(fail === 0 ? 0 : 1);
