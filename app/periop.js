'use strict';
/* Perioperative parameters, automatic detection, comorbidities, patient brief, record-based answers and a rules-only
 * patient profile. Everything here is deterministic (no AI) so it can be tested and explained.
 * Thresholds are ILLUSTRATIVE DRAFTS for the prototype. A clinician must set and sign them off before real use. */
var DAY = 24 * 3600 * 1000;

var PARAMS = {
  hb:        { label: 'Haemoglobin', unit: 'g/dL', dec: 1, ref: '12.0 to 16.0', group: 'Pre-op bloods' },
  hba1c:     { label: 'HbA1c', unit: '%', dec: 1, ref: 'below 7.0', group: 'Pre-op bloods' },
  egfr:      { label: 'eGFR (kidney function)', unit: 'mL/min', dec: 0, ref: '60 or more', group: 'Pre-op bloods' },
  inr:       { label: 'INR', unit: '', dec: 1, ref: '1.2 or less when off warfarin', group: 'Pre-op bloods' },
  platelets: { label: 'Platelets', unit: 'x10^9/L', dec: 0, ref: '150 to 400', group: 'Pre-op bloods' },
  albumin:   { label: 'Albumin', unit: 'g/L', dec: 0, ref: '35 or more', group: 'Pre-op bloods' },
  bmi:       { label: 'BMI', unit: 'kg/m2', dec: 1, ref: '18.5 to 30', group: 'Pre-op' },
  bp_sys:    { label: 'Systolic BP', unit: 'mmHg', dec: 0, ref: 'below 140', group: 'Vitals' },
  temp:      { label: 'Temperature', unit: 'C', dec: 1, ref: 'below 37.8', group: 'Post-op' },
  hr:        { label: 'Heart rate', unit: 'bpm', dec: 0, ref: '50 to 100', group: 'Post-op' },
  spo2:      { label: 'Oxygen saturation', unit: '%', dec: 0, ref: '94 or more', group: 'Post-op' },
  pain:      { label: 'Pain score', unit: '/10', dec: 0, ref: '5 or less', group: 'Post-op' },
  crp:       { label: 'CRP', unit: 'mg/L', dec: 0, ref: 'falling after day 3', group: 'Post-op' },
  wcc:       { label: 'White cell count', unit: 'x10^9/L', dec: 1, ref: '4 to 11', group: 'Post-op' },
  calf_diff: { label: 'Calf swelling (difference)', unit: 'cm', dec: 1, ref: 'below 2', group: 'Post-op' },
  flexion:   { label: 'Knee flexion', unit: 'deg', dec: 0, ref: '90 or more by 2 weeks', group: 'Post-op' },
  wound:     { label: 'Wound', unit: '', categorical: ['dry', 'ooze', 'discharge', 'red and hot'], ref: 'dry', group: 'Post-op' }
};

// phase: preop = before the operation date, postop = from the operation day on, any = both. minDay: only from post-op day N.
function defaultRules() {
  var r = [];
  function add(param, op, value, level, phase, msg, owner, minDay) { r.push({ id: param + '_' + op.replace('>', 'gt').replace('<', 'lt').replace('=', 'e') + '_' + String(value).replace('.', 'p').replace(/\s+/g, '_'), param: param, op: op, value: value, level: level, phase: phase, msg: msg, owner: owner, minDay: minDay || 0 }); }
  add('hb', '<', 12, 'amber', 'preop', 'Anaemia: plan before surgery', 'surgeon');
  add('hb', '<', 10, 'red', 'preop', 'Significant anaemia: review before surgery goes ahead', 'surgeon');
  add('hba1c', '>=', 8, 'amber', 'preop', 'Glycaemic control: review before surgery', 'surgeon');
  add('hba1c', '>=', 9, 'red', 'preop', 'Poor glycaemic control: review before surgery goes ahead', 'surgeon');
  add('egfr', '<', 60, 'amber', 'preop', 'Reduced kidney function: review medicines and anaesthetic plan', 'surgeon');
  add('egfr', '<', 30, 'red', 'preop', 'Severely reduced kidney function: review before surgery', 'surgeon');
  add('inr', '>', 1.4, 'amber', 'preop', 'Raised INR: anticoagulation plan needed', 'surgeon');
  add('platelets', '<', 100, 'amber', 'preop', 'Low platelets: review', 'surgeon');
  add('albumin', '<', 35, 'amber', 'preop', 'Low albumin: nutrition and wound-healing risk', 'preop_nurse');
  add('bmi', '>=', 35, 'amber', 'preop', 'High BMI: anaesthetic and wound-healing risk', 'preop_nurse');
  add('bmi', '>=', 40, 'red', 'preop', 'Very high BMI: surgeon and anaesthetist review', 'surgeon');
  add('bp_sys', '>=', 160, 'amber', 'any', 'High blood pressure: review', 'preop_nurse');
  add('bp_sys', '>=', 180, 'red', 'any', 'Very high blood pressure: same-day clinician review', 'surgeon');
  add('temp', '>=', 38.0, 'amber', 'postop', 'Fever after surgery: check wound and chest, review for infection', 'ward_nurse', 1);
  add('temp', '>=', 38.5, 'red', 'postop', 'High fever after surgery: same-day clinician review', 'surgeon', 1);
  add('hr', '>', 110, 'amber', 'postop', 'Fast heart rate: review', 'ward_nurse');
  add('hr', '>', 130, 'red', 'postop', 'Very fast heart rate: same-day clinician review', 'surgeon');
  add('spo2', '<', 94, 'amber', 'postop', 'Low oxygen saturation: review', 'ward_nurse');
  add('spo2', '<', 90, 'red', 'postop', 'Very low oxygen saturation: urgent clinician review', 'surgeon');
  add('pain', '>=', 7, 'amber', 'postop', 'Severe pain: review pain plan', 'ward_nurse');
  add('crp', '>', 100, 'amber', 'postop', 'High CRP after day 3: review for infection', 'surgeon', 3);
  add('wcc', '>', 12, 'amber', 'postop', 'Raised white cells: review', 'ward_nurse', 2);
  add('calf_diff', '>=', 2, 'amber', 'postop', 'Calf swelling: assess for clot', 'ward_nurse');
  add('calf_diff', '>=', 3, 'red', 'postop', 'Marked calf swelling: same-day clinician review for clot', 'surgeon');
  add('flexion', '<', 60, 'amber', 'postop', 'Knee bending behind target: physiotherapy review', 'physio', 14);
  add('wound', '=', 'discharge', 'amber', 'postop', 'Wound discharge: review for infection', 'ward_nurse');
  add('wound', '=', 'red and hot', 'red', 'postop', 'Red hot wound: same-day clinician review', 'surgeon');
  return r;
}

function cmp(op, a, b) {
  switch (op) { case '<': return a < b; case '<=': return a <= b; case '>': return a > b; case '>=': return a >= b; case '=': return a === b; }
  return false;
}
function fmtVal(param, v) { var d = PARAMS[param] || {}; return d.categorical ? String(v) : (typeof v === 'number' ? v.toFixed(d.dec || 0) : String(v)) + (d.unit ? ' ' + d.unit : ''); }
function dayRel(otMs, at) { return Math.floor((at - otMs) / DAY); }

/* Evaluate one reading against the rules. Returns the matched rules (worst first) and a step-by-step explanation. */
function evaluate(rules, reading, otMs, prev) {
  var d = PARAMS[reading.param] || { label: reading.param };
  var day = dayRel(otMs, reading.at), phase = day < 0 ? 'preop' : 'postop';
  var steps = [];
  steps.push({ n: 1, title: 'Reading received', status: 'pass', detail: d.label + ' = ' + fmtVal(reading.param, reading.value) + ' (' + (reading.source || 'entered') + ')' });
  steps.push({ n: 2, title: 'Where the patient is in the journey', status: 'pass', detail: (phase === 'preop' ? 'Before surgery' : 'After surgery') + ', day ' + (day >= 0 ? '+' : '') + day + ' relative to the operation' });
  var cand = rules.filter(function (r) { return r.param === reading.param && (r.phase === 'any' || r.phase === phase) && (!r.minDay || day >= r.minDay); });
  steps.push({ n: 3, title: 'Rules checked', status: 'pass', detail: cand.length ? cand.map(function (r) { return d.label + ' ' + r.op + ' ' + r.value + ' (' + r.level + ')'; }).join('; ') : 'No rule covers this reading in this phase' });
  var hits = cand.filter(function (r) { return cmp(r.op, reading.value, r.value); });
  // simple trend rule: CRP rising by 50% or more and above 60
  if (reading.param === 'crp' && prev && typeof prev.value === 'number' && reading.value >= 60 && reading.value >= prev.value * 1.5 && day >= 2) {
    hits.push({ id: 'crp_rising', param: 'crp', op: 'rise', value: 1.5, level: 'amber', phase: 'postop', msg: 'CRP rising (was ' + prev.value + ', now ' + reading.value + '): review for infection', owner: 'surgeon', minDay: 2 });
  }
  hits.sort(function (a, b) { return (b.level === 'red') - (a.level === 'red'); });
  // only the worst threshold rule per reading is acted on, so one value does not create two tasks
  var rise = hits.filter(function (h) { return h.id === 'crp_rising'; }), thr = hits.filter(function (h) { return h.id !== 'crp_rising'; });
  hits = thr.slice(0, 1).concat(rise);
  steps.push({ n: 4, title: 'Result', status: hits.length ? (hits[0].level === 'red' ? 'raise' : 'warn') : 'pass', detail: hits.length ? 'Outside range: ' + hits.map(function (h) { return h.msg + ' [' + h.level.toUpperCase() + ']'; }).join(' | ') : 'Within range, nothing to do' });
  return { hits: hits, steps: steps, day: day, phase: phase };
}

var COMORBID_MAP = [
  ['diabetes', 'Diabetes'], ['heart_disease', 'Heart disease'], ['lung_disease', 'Lung disease'], ['kidney_disease', 'Kidney disease'],
  ['smoker', 'Smoker'], ['anaesthetic_problem', 'Past anaesthetic problem'], ['penicillin_allergy', 'Penicillin allergy'], ['latex_allergy', 'Latex allergy'],
  ['mrsa_or_admission_past_year', 'MRSA risk / recent admission'], ['lives_alone', 'Lives alone'], ['stairs_home', 'Stairs at home']
];
function yes(v) { if (v && typeof v === 'object') v = v.answer; return String(v == null ? '' : v).toLowerCase() === 'yes'; }
function comorbidities(intake) {
  if (!intake) return [];
  var out = [];
  COMORBID_MAP.forEach(function (m) { if (yes(intake[m[0]])) out.push({ key: m[0], label: m[1] + (m[0] === 'diabetes' && intake.hba1c ? ' (HbA1c ' + intake.hba1c + '%)' : '') }); });
  var bt = intake.blood_thinner; if (yes(bt)) out.push({ key: 'blood_thinner', label: 'On a blood thinner' + (bt && bt.name ? ': ' + bt.name : ''), important: true });
  if (intake.mobility_aid && String(intake.mobility_aid).toLowerCase() !== 'no') out.push({ key: 'mobility_aid', label: 'Uses ' + intake.mobility_aid });
  return out;
}

/* Fictional TKR values so the demo shows detection end to end. Keyed by patient id. */
var TKR_SEED = {
  'FIC-TKR-01': { otOff: 14, pre: { hb: 13.4, hba1c: 6.1, egfr: 88, inr: 1.0, platelets: 260, albumin: 42, bmi: 26.5, bp_sys: 122 } },
  'FIC-TKR-02': { otOff: 9, pre: { hb: 10.8, hba1c: 8.4, egfr: 52, inr: 2.6, platelets: 210, albumin: 33, bmi: 36.2, bp_sys: 164 } },
  'FIC-TKR-03': { otOff: -3, pre: { hb: 12.6, egfr: 74, bmi: 29.0, bp_sys: 134 }, post: { temp: [37.2, 37.6, 37.4, 37.3], hr: [88, 92, 86, 84], pain: [6, 5, 4, 4], crp: [48, 132, 96, 62], wound: ['dry', 'dry', 'dry', 'dry'], spo2: [97, 96, 97, 97] } },
  'FIC-TKR-04': { otOff: -6, pre: { hb: 12.9, hba1c: 7.2, egfr: 80, bmi: 30.4, bp_sys: 138 }, post: { temp: [37.4, 37.5, 37.7, 37.9, 38.2, 38.6, 38.7], hr: [90, 92, 95, 99, 104, 112, 114], pain: [6, 5, 5, 5, 6, 7, 7], crp: [40, 140, 118, 88, 70, 98, 132], wound: ['dry', 'dry', 'dry', 'ooze', 'ooze', 'discharge', 'discharge'], wcc: [9.8, 11.0, 11.2, 11.4, 12.4, 13.1, 14.2] } },
  'FIC-TKR-05': { otOff: -2, pre: { hb: 13.0, hba1c: 5.8, egfr: 90, bmi: 27.8, bp_sys: 126 }, post: { temp: [37.3, 37.5, 37.6], hr: [92, 98, 104], spo2: [97, 96, 95], pain: [5, 6, 6], calf_diff: [0.8, 1.9, 3.2], crp: [44, 120, 112], wound: ['dry', 'dry', 'dry'] } }
};
function seedReadings(pid, rn, otMs, uidFn, now) {
  var cfg = TKR_SEED[rn]; if (!cfg) return [];
  now = now || Date.now();
  var out = [];
  Object.keys(cfg.pre || {}).forEach(function (k) { out.push({ id: uidFn(), pid: pid, param: k, value: cfg.pre[k], at: Math.min(otMs - 10 * DAY + 9 * 3600 * 1000, now - DAY), source: 'seeded (fictional)' }); });
  Object.keys(cfg.post || {}).forEach(function (k) { cfg.post[k].forEach(function (v, i) { out.push({ id: uidFn(), pid: pid, param: k, value: v, at: Math.min(otMs + i * DAY + 9 * 3600 * 1000, now - 60000 * (30 - Math.min(i, 29))), source: 'seeded (fictional)' }); }); });
  out.sort(function (a, b) { return a.at - b.at; });
  return out;
}

function fmtD(ms) { return new Date(ms).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }

/* Questions the patient can ask that the clinic record can answer exactly (no AI, no advice). */
var PREP_RE = /prepp?ar|what (should|do|must|can) i (bring|do before|do first|need)|what.{0,25}(pending|outstanding|left to do|still (to do|need))|checklist|apa.{0,20}(perlu|patut).{0,12}(sedia|buat)|准备|还有什么/i;
var OPDATE_RE = /(when|what date|what day|which day).{0,25}(surgery|operation|op\b|procedure|admission|admitted)|(surgery|operation|op) date|bila.{0,18}(pembedahan|operasi)|手术.{0,6}(几时|什么时候|哪天)/i;
var FOLLOW_RE = /follow[- ]?up|next appointment|when.{0,15}(physio|review|clinic visit)|temu janji/i;
function recordAnswer(text, ctx) {
  var pt = ctx.pt, tasks = ctx.tasks.filter(function (t) { return t.state === 'open'; }), ot = ctx.otMs, now = ctx.now, phone = ctx.phone;
  var day = dayRel(ot, now), when = day < 0 ? 'in ' + (-day) + ' day' + (day === -1 ? '' : 's') : day === 0 ? 'today' : day + ' day' + (day === 1 ? '' : 's') + ' ago';
  if (OPDATE_RE.test(text)) return { kind: 'operation date', text: 'From your clinic record: your operation is on ' + fmtD(ot) + ' (' + when + '). If this is not what you were told, please call ' + phone + '.' };
  if (PREP_RE.test(text)) {
    var items = tasks.filter(function (t) { return !ctx.doctorOwners[t.owner]; }).sort(function (a, b) { return a.dueAt - b.dueAt; });
    var docItems = tasks.filter(function (t) { return ctx.doctorOwners[t.owner]; });
    var before = day < 0 ? items.filter(function (t) { return t.dueAt <= ot + DAY; }) : items.filter(function (t) { return t.dueAt <= now + 21 * DAY; });
    var lines = before.slice(0, 8).map(function (t) { return '- ' + t.title + (t.dueAt < now ? ' (still to be done)' : ' (by ' + fmtD(t.dueAt) + ')'); });
    var head = day < 0 ? 'From your clinic record, before your operation on ' + fmtD(ot) + ' the team still needs to complete:' : 'From your clinic record, the next steps on your list are:';
    var tail = (docItems.length ? ' Your surgeon will also go through the plan and your medicines with you.' : '') + ' Your care team will confirm the details with you.';
    return { kind: 'checklist', text: lines.length ? head + '\n' + lines.join('\n') + '\n' + tail.trim() : 'From your clinic record, nothing is outstanding on your list right now.' + tail };
  }
  if (FOLLOW_RE.test(text)) {
    var fu = tasks.concat(ctx.tasks).filter(function (t) { return /follow-up|physio/i.test(t.title); }).sort(function (a, b) { return a.dueAt - b.dueAt; })[0];
    return { kind: 'follow-up', text: fu ? 'From your clinic record: "' + fu.title + '" is planned around ' + fmtD(fu.dueAt) + '. The clinic will confirm the exact time with you. Call ' + phone + ' if you need to change it.' : 'I do not see a follow-up booked in your record yet. Please call ' + phone + ' to arrange it.' };
  }
  return null;
}

/* Rules-only profile (always available; the AI adds a written summary on top). */
var TOPICS = [['pain', /pain|sakit|ache|痛|nyeri/i], ['wound', /wound|stitch|dressing|luka|jahitan|伤口/i], ['fever', /fever|temperature|demam|发烧|发热/i], ['swelling', /swell|bengkak|肿/i], ['breathing', /breath|nafas|呼吸|breathless/i], ['chest/heart', /chest|heart|palpitat|dada|jantung|胸|心/i], ['medicines', /medic|tablet|pill|drug|ubat|药|blood thinner|painkiller/i], ['appointments', /appointment|follow[- ]?up|clinic visit|temu janji|门诊|when is|bila/i], ['physio/exercise', /physio|exercise|walk|stairs|bend|senaman|运动|复健/i], ['daily living', /shower|bath|drive|fly|work|mandi|memandu|洗澡|开车/i], ['insurance/cost', /insurance|cost|price|payment|insurans|bayar|保险/i], ['worry/anxiety', /worr|scared|afraid|anxious|nervous|risau|takut|担心|害怕|紧张/i]];
function detProfile(msgs, now) {
  var mine = msgs.filter(function (m) { return m.who === 'patient'; });
  if (!mine.length) return { messages: 0 };
  var topics = {}, langs = {}, urgent = 0, sumLen = 0;
  mine.forEach(function (m) { TOPICS.forEach(function (t) { if (t[1].test(m.text)) topics[t[0]] = (topics[t[0]] || 0) + 1; }); sumLen += m.text.length; if (m.cls === 'EMERGENCY' || m.cls === 'SAME-DAY') urgent++; var l = /[一-鿿]/.test(m.text) ? 'zh' : /[؀-ۿ]/.test(m.text) ? 'ar' : /\b(saya|tak|nak|dah|ubat|sakit|bengkak|boleh|kena|macam)\b/i.test(m.text) ? 'ms' : 'en'; langs[l] = (langs[l] || 0) + 1; });
  var last = mine[mine.length - 1];
  return { messages: mine.length, topics: Object.keys(topics).sort(function (a, b) { return topics[b] - topics[a]; }).slice(0, 6), languages: Object.keys(langs), urgentMessages: urgent, avgLength: Math.round(sumLen / mine.length), lastContact: last.at, writes: sumLen / mine.length < 40 ? 'short messages' : sumLen / mine.length < 120 ? 'medium messages' : 'long, detailed messages' };
}

module.exports = { PARAMS: PARAMS, defaultRules: defaultRules, evaluate: evaluate, comorbidities: comorbidities, TKR_SEED: TKR_SEED, seedReadings: seedReadings, recordAnswer: recordAnswer, detProfile: detProfile, fmtVal: fmtVal, fmtD: fmtD, dayRel: dayRel, DAY: DAY };
