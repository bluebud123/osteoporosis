'use strict';
/* PeriLoop Console: a small real system for perioperative follow-up.
 * Staff log in, add patients, edit the pathway and extra red-flag rules, work an inbox and a task board.
 * Patients chat through a private link. Safety order on every patient message:
 *   fixed red-flag rules (+ clinic extra phrases) -> optional model second check (can only raise) -> reply.
 * A model may write a short friendly reply ONLY for non-clinical, non-urgent messages, behind the output guard.
 * Synthetic data only until the clinic has approved real use. No dependencies: needs Node 18 or newer.
 */
var http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
var Store = require('./store.js');
var E = require('./lib/engine.js');
var SC = require('./lib/second_check.js');
var proxy = require('./lib/server/chat.js');
var P = require('./periop.js');
var AI = require('./ai.js');
var TR = require('./triage.js');      // v2: engine + added wording + two narrow reductions (measured, see app/eval)
var ANS = require('./answers.js');    // v2: clinic answer library (fixed texts, doctor approves)
var GUARD = require('./guard.js');    // v2: chat output guard
var HANDBACK_MS = 24 * 3600 * 1000;   // a staff conversation with no staff message for this long goes back to the assistant
var LIVE_MS = 30 * 60 * 1000;         // while staff replied this recently the assistant stays silent

var PORT = Number(process.env.PORT || 8080);
var DATA_DIR = process.env.PERILOOP_DATA || path.join(__dirname, 'data');
var PUBLIC = path.join(__dirname, 'public');
var DAY = 24 * 3600 * 1000;

var store = Store.open(DATA_DIR);

/* ---------- roles, owners, defaults ---------- */
var OWNERS = { surgeon: 'Surgeon', preop_nurse: 'Pre-op nurse', ward_nurse: 'Ward nurse', physio: 'Physiotherapist', admin: 'Admin / insurance', clinic_coordinator: 'Clinic coordinator', clinician: 'Clinician' };
var DOCTOR_OWNERS = { surgeon: 1, clinician: 1 };       // tasks only a doctor may close
var LANGS = { en: 'English', ms: 'Bahasa Malaysia', zh: '中文', ar: 'العربية' };

function defaultPathway() {
  var procedures = {};
  Object.keys(E.PACKS).forEach(function (k) { procedures[k] = { label: E.PACKS[k].label, items: E.PACKS[k].extra.map(function (x) { return { title: x.title, owner: x.owner, due: x.due, kind: x.kind }; }) }; });
  return { shared: E.SHARED.map(function (x) { return { title: x.title, owner: x.owner, due: x.due, kind: x.kind }; }), procedures: procedures };
}
function hash(pw, salt) { return crypto.scryptSync(String(pw), salt, 32).toString('hex'); }
function mkUser(username, name, role, pw) { var salt = crypto.randomBytes(12).toString('hex'); return { username: username, name: name, role: role, salt: salt, hash: hash(pw, salt), createdAt: Date.now() }; }
function uid() { return crypto.randomBytes(6).toString('hex'); }

function init() {
  if (store.db) { store.db.rules.faqs = store.db.rules.faqs || []; migrate(); return; }
  store.db = {
    users: [mkUser('doctor', 'Dr Demo', 'doctor', 'doctor-demo-1'), mkUser('nurse', 'Nurse Demo', 'nurse', 'nurse-demo-1')],
    patients: [], tasks: [], messages: [], alerts: [], audit: [],
    rules: { pathway: defaultPathway(), redflags: [], faqs: [] },
    settings: { clinicPhone: '03-0000 0000 (set in Settings)', sessionsText: 'Set the clinic hours in Settings', demoBanner: true, maxCasesPerDay: 5, emergencyNumber: '999', useDraftAnswers: true }
  };
  audit('system', 'first run: demo accounts created');
  store.save();
  migrate();
  if (process.env.PERILOOP_NO_SEED !== '1') seedDemo('system');
}
function audit(who, what) { store.db.audit.push({ at: Date.now(), who: who, what: what }); if (store.db.audit.length > 2000) store.db.audit.splice(0, 500); }

/* ---------- patient-facing fixed texts (follow the clinic-bot rules: route to a staffed channel, never promise a reply) ---------- */
function T(kind, lang) {
  var s = store.db.settings, ph = s.clinicPhone, ses = s.sessionsText, em = s.emergencyNumber || '999';
  var X = {
    EMERGENCY: {
      en: 'Please call ' + em + ' or go to the nearest Emergency Department now. This chat is not monitored around the clock and is not for emergencies.',
      ms: 'Sila hubungi ' + em + ' atau pergi ke Jabatan Kecemasan terdekat sekarang. Sembang ini tidak dipantau sepanjang masa dan bukan untuk kecemasan.',
      zh: '请立即拨打 ' + em + ' 或前往最近的急诊部。此聊天并非全天候监控，不适用于紧急情况。',
      ar: 'اتصل بالرقم ' + em + ' أو اذهب إلى أقرب قسم طوارئ الآن. هذه المحادثة غير مراقبة على مدار الساعة وليست للحالات الطارئة.' },
    SAMEDAY: {
      en: 'Please call the clinic today: ' + ph + '. ' + ses + '. Messages here are not monitored around the clock. If symptoms are severe or getting worse, go to the nearest Emergency Department.',
      ms: 'Sila hubungi klinik hari ini: ' + ph + '. ' + ses + '. Mesej di sini tidak dipantau sepanjang masa. Jika gejala teruk atau bertambah teruk, pergi ke Jabatan Kecemasan terdekat.',
      zh: '请今天致电诊所：' + ph + '。' + ses + '。此处消息并非全天候监控。如症状严重或加重，请前往最近的急诊部。',
      ar: 'يرجى الاتصال بالعيادة اليوم: ' + ph + '. ' + ses + '. الرسائل هنا غير مراقبة على مدار الساعة. إذا كانت الأعراض شديدة أو تزداد سوءا، اذهب إلى أقرب قسم طوارئ.' },
    ROUTE: {
      en: 'This one needs a clinician, so I will not guess. I have saved your question for the clinic team (' + ses + '). If it cannot wait, call ' + ph + '. If you feel worse or something new worries you, go to the Emergency Department.',
      ms: 'Soalan ini perlu dijawab oleh doktor, jadi saya tidak akan meneka. Soalan anda telah disimpan untuk pasukan klinik (' + ses + '). Jika tidak boleh tunggu, hubungi ' + ph + '. Jika anda rasa bertambah teruk, pergi ke Jabatan Kecemasan.',
      zh: '这个问题需要医生回答，我不会猜测。您的问题已保存给诊所团队（' + ses + '）。如不能等待，请致电 ' + ph + '。如感觉加重或有新的担心，请前往急诊部。',
      ar: 'هذا السؤال يحتاج إلى طبيب، ولن أخمن الإجابة. تم حفظ سؤالك لفريق العيادة (' + ses + '). إذا لم يحتمل الانتظار، اتصل على ' + ph + '. إذا شعرت بأنك أسوأ، اذهب إلى قسم الطوارئ.' },
    RECEIPT: {
      en: 'I have saved your message for the clinic team, who read messages during clinic hours (' + ses + '). I cannot say exactly when they will reply. If it cannot wait, call ' + ph + '. If this is about trouble breathing, chest pain, heavy bleeding, fainting, or a cold or blue foot, call ' + em + ' now.',
      ms: 'Mesej anda telah disimpan untuk pasukan klinik, yang membaca mesej pada waktu klinik (' + ses + '). Saya tidak dapat memberitahu bila mereka akan membalas. Jika tidak boleh tunggu, hubungi ' + ph + '. Jika ini tentang sesak nafas, sakit dada, pendarahan banyak, pengsan, atau kaki sejuk atau biru, hubungi ' + em + ' sekarang.',
      zh: '您的消息已保存给诊所团队，他们会在门诊时间（' + ses + '）查看消息。我无法确定他们何时回复。如不能等待，请致电 ' + ph + '。如果是呼吸困难、胸痛、大量出血、晕倒，或脚发冷发紫，请立即拨打 ' + em + '。',
      ar: 'تم حفظ رسالتك لفريق العيادة، وهم يقرؤون الرسائل في ساعات العمل (' + ses + '). لا أستطيع أن أحدد متى سيردون. إذا لم يحتمل الانتظار، اتصل على ' + ph + '. إذا شعرت بأنك أسوأ، اذهب إلى قسم الطوارئ.' },
    HELLO: {
      en: 'Hello. I am the clinic\'s text assistant, a computer program. You can ask me things like "when is my operation", "what is still pending", "what should I bring" or "when is my follow-up", or write a message for the clinic team. For emergencies call ' + em + '.',
      ms: 'Helo. Saya pembantu teks klinik, sebuah program komputer. Anda boleh bertanya seperti "bila pembedahan saya", "apa yang masih belum selesai", "apa perlu saya bawa" atau "bila temu janji susulan saya", atau tulis mesej untuk pasukan klinik. Untuk kecemasan hubungi ' + em + '.',
      zh: '您好。我是诊所的文字助手，是一个电脑程序。您可以问我"手术是哪一天"、"还有什么没完成"、"要带什么"或"复诊是哪一天"，也可以给诊所团队留言。紧急情况请拨打 ' + em + '。',
      ar: 'مرحبا. أنا المساعد النصي للعيادة، برنامج حاسوب. يمكنك أن تسألني مثلا "متى موعد العملية" أو "ماذا بقي في قائمتي"، أو أن تكتب رسالة لفريق العيادة. للحالات الطارئة اتصل بالرقم ' + em + '.' },
    HELD: {
      en: 'Your message has been added to your conversation with {name}. They will see it when they are next at their desk (' + ses + '). If it cannot wait, call ' + ph + '.',
      ms: 'Mesej anda telah ditambah ke perbualan anda dengan {name}. Mereka akan melihatnya apabila kembali ke meja (' + ses + '). Jika tidak boleh tunggu, hubungi ' + ph + '.',
      zh: '您的消息已加入您与 {name} 的对话。他们回到岗位时会看到（' + ses + '）。如不能等待，请致电 ' + ph + '。' },
    FOOT: {
      en: 'If you feel worse or something new worries you, call ' + ph + ' or go to the Emergency Department.',
      ms: 'Jika anda rasa bertambah teruk atau ada perkara baharu, hubungi ' + ph + ' atau pergi ke Jabatan Kecemasan.',
      zh: '若感觉加重或有新的担心，请致电 ' + ph + ' 或前往急诊部。',
      ar: 'إذا شعرت بأنك أسوأ أو أقلقك شيء جديد، اتصل على ' + ph + ' أو اذهب إلى قسم الطوارئ.' }
  };
  return (X[kind][lang] || X[kind].en);
}

/* ---------- AI via the same guarded proxy code (no key ever leaves the server) ---------- */
function aiConfigured() { return !!(process.env.PROVIDER_BASE_URL && process.env.PROVIDER_KEY); }
async function aiCall(body, ipKey) {
  var req = new Request('http://localhost/', { method: 'POST', headers: { 'content-type': 'application/json', 'x-client-ip': 'console-' + ipKey }, body: JSON.stringify(body) });
  var res = await proxy.handle(req);
  return res.json();
}
async function secondCheck(text, key) {
  if (!aiConfigured()) return { verdict: 'unscreened', reason: 'AI not configured' };
  try {
    var j = await aiCall({ mode: 'second_check', text: text }, key);
    return JSON.parse(j.text);
  } catch (e) { return { verdict: 'unscreened', reason: 'second check error' }; }
}
// v2: the model's words go through GUARD.check (app/guard.js). A reply can be shown whole, shown with unsafe-to-verify
// sentences dropped, or blocked. The caller falls back to a fixed text when nothing is returned.
async function aiReply(text, history, lang, key, ctx, clinical) {
  if (!aiConfigured()) return { text: '', skipped: 'AI not configured' };
  try {
    var ctxLine = ctx ? 'procedure: ' + ctx.procedure + '; ' + ctx.phase + '; days ' + (ctx.days >= 0 ? 'until' : 'since') + ' operation: ' + Math.abs(ctx.days) + '; items still pending on their checklist: ' + ctx.pending : '';
    var r = await AI.chat(text, history, ctxLine, !!clinical, 'chat ' + key);
    if (!r.text) return { text: '', error: r.error || (r.skipped ? 'AI not configured' : 'model returned nothing') };
    var out = r.text.replace(/\s+/g, ' ').trim(), g = GUARD.check(out, text);
    if (g.ok && clinical && !/[?？؟]\s*$/.test(g.text)) g = { ok: false, reason: 'not_a_question' };
    if (!g.ok) { console.log('[reply] blocked by guard: ' + g.reason); return { text: '', blocked: g.reason }; }
    return { text: g.text, dropped: g.dropped || 0 };
  } catch (e) { return { text: '', error: 'call failed' }; }
}

/* ---------- patients, tasks ---------- */
function otTime(dateStr) { var d = new Date(dateStr + 'T08:00:00'); return d.getTime(); }
function pathwayFor(proc) {
  var pw = store.db.rules.pathway, p = pw.procedures[proc];
  return pw.shared.concat(p ? p.items : []);
}
function createTasks(pt) {
  var ot = otTime(pt.otDate);
  pathwayFor(pt.procedure).forEach(function (it) {
    store.db.tasks.push({ id: uid(), pid: pt.id, title: it.title, owner: it.owner, kind: it.kind, due: it.due, dueAt: ot + it.due * DAY, state: 'open', createdAt: Date.now() });
  });
}
function taskView(t) { var overdue = t.state === 'open' && t.dueAt < Date.now(); return Object.assign({}, t, { overdue: overdue, ownerLabel: OWNERS[t.owner] || t.owner, doctorOnly: !!DOCTOR_OWNERS[t.owner] }); }
function ptView(p) {
  var tasks = store.db.tasks.filter(function (t) { return t.pid === p.id; });
  var open = tasks.filter(function (t) { return t.state === 'open'; });
  var alerts = store.db.alerts.filter(function (a) { return a.pid === p.id && !a.ackAt; });
  var needs = store.db.messages.filter(function (m) { return m.pid === p.id && m.needsStaff && !m.handled; });
  return { id: p.id, name: p.name, rn: p.rn, procedure: p.procedure, procLabel: (store.db.rules.pathway.procedures[p.procedure] || {}).label || p.procedure, otDate: p.otDate, lang: p.lang, active: p.active, threadOpen: !!p.threadOpen,
    open: open.length, overdue: open.filter(function (t) { return t.dueAt < Date.now(); }).length, openAlerts: alerts.length, needsReply: needs.length, linked: !!p.firstSeen, como: P.comorbidities(p.intake).map(function (c) { return c.label; }), flags: store.db.detections.filter(function (d) { return d.pid === p.id && d.state === 'open'; }).length, redFlags: store.db.detections.filter(function (d) { return d.pid === p.id && d.state === 'open' && d.level === 'red'; }).length, demo: !!p.demo, demoCase: p.demoCase || '', expect: p.expect || '' };
}


/* ---------- fictional demo cases (from the project's own test material) ---------- */
function seedDemo(user) {
  var hist; try { hist = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed', 'histories.json'), 'utf8')); } catch (e) { return 0; }
  var added = 0, now = Date.now();
  hist.forEach(function (h, i) {
    var rn = String(h.pid).toUpperCase();
    if (store.db.patients.some(function (x) { return x.rn === rn; })) return;
    if (!store.db.rules.pathway.procedures[h.procedure]) return;
    // spread across the journey: some before surgery, some after
    var offsets = [21, 14, 9, 5, 2, 0, -1, 7, -6, 7];
    var off = offsets[i % offsets.length]; if (P.TKR_SEED[rn]) off = P.TKR_SEED[rn].otOff;
    var d = new Date(now + off * DAY); var ot = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    var short = ('Fict ' + String(h.pid).replace('FIC-', '')).slice(0, 20);
    var pt = { id: uid(), name: short, rn: rn, procedure: h.procedure, otDate: ot, lang: LANGS[h.lang] ? h.lang : 'en', token: crypto.randomBytes(18).toString('base64url'), active: true, createdAt: now, addedBy: user || 'system', demo: true, demoCase: h.case, expect: h.expect, intake: h.answers };
    store.db.patients.push(pt); createTasks(pt);
    // earlier items already done for most demo patients, so the board is realistic: a few stay overdue on purpose
    if (i % 4 !== 0) store.db.tasks.forEach(function (t) { if (t.pid === pt.id && t.dueAt < now - 2 * DAY && t.due <= -8) { t.state = 'done'; t.evidence = 'Demo data: completed'; t.doneBy = 'Demo'; t.doneAt = now - 3 * DAY; } });
    seedPeriop(pt);
    added++;
  });
  if (added) { audit(user || 'system', 'loaded ' + added + ' fictional demo patients'); store.save(); }
  return added;
}


/* ---------- perioperative parameters: readings, automatic detection, brief, profile ---------- */
function migrate() {
  var d = store.db; d.readings = d.readings || []; d.detections = d.detections || [];
  if (!d.rules.periop) d.rules.periop = P.defaultRules();
  if (!d.settings.maxCasesPerDay) d.settings.maxCasesPerDay = 5;
  if (!d.settings.emergencyNumber) d.settings.emergencyNumber = '999';
  if (typeof d.settings.useDraftAnswers !== 'boolean') d.settings.useDraftAnswers = true;
  d.rules.answerState = d.rules.answerState || {};
  if (d.rules.periopVersion !== P.RULES_VERSION) { d.rules.periop = P.defaultRules(); d.rules.periopVersion = P.RULES_VERSION; audit('system', 'parameter thresholds updated to rule set v' + P.RULES_VERSION); store.save(); }
  var n = 0; d.patients.forEach(function (pt) { if (pt.demo && P.TKR_SEED[pt.rn] && !d.readings.some(function (r) { return r.pid === pt.id; })) { seedPeriop(pt); n++; } });
  if (n) { audit('system', 'added fictional TKR parameters for ' + n + ' demo patients'); store.save(); }
}
function dateStr(ms) { var d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function seedPeriop(pt) {
  var cfg = P.TKR_SEED[pt.rn]; if (!cfg) return;
  var now = Date.now(), ot = now + cfg.otOff * DAY;
  if (pt.otDate !== dateStr(ot)) { pt.otDate = dateStr(ot); var o = otTime(pt.otDate); store.db.tasks.forEach(function (t) { if (t.pid === pt.id) t.dueAt = o + t.due * DAY; }); }
  var otm = otTime(pt.otDate);
  if (otm < now) store.db.tasks.forEach(function (t) { if (t.pid === pt.id && !t.auto && t.due < 0 && t.state === 'open') { t.state = 'done'; t.evidence = 'Demo data: completed before surgery'; t.doneBy = 'Demo'; t.doneAt = otm - DAY; } });
  P.seedReadings(pt.id, pt.rn, otm, uid, now).forEach(function (r) { store.db.readings.push(r); detectAndAct(pt, r, 'seeded demo values', true); });
}
function latestReadings(pt) {
  var by = {}; store.db.readings.filter(function (r) { return r.pid === pt.id; }).sort(function (a, b) { return a.at - b.at; }).forEach(function (r) { by[r.param] = r; });
  return by;
}
function detectAndAct(pt, reading, who, quiet) {
  var ot = otTime(pt.otDate);
  var prev = store.db.readings.filter(function (r) { return r.pid === pt.id && r.param === reading.param && r.at < reading.at && r.id !== reading.id; }).sort(function (a, b) { return b.at - a.at; })[0];
  var ev = P.evaluate(store.db.rules.periop, reading, ot, prev), now = Date.now(), made = [];
  var hitIds = ev.hits.map(function (h) { return h.id; });
  store.db.detections.forEach(function (d) { if (d.pid === pt.id && d.param === reading.param && d.state === 'open' && hitIds.indexOf(d.ruleId) < 0) { d.state = 'cleared'; d.clearedAt = now; } });
  ev.hits.forEach(function (h) {
    var ex = store.db.detections.find(function (d) { return d.pid === pt.id && d.ruleId === h.id && d.state === 'open'; });
    if (ex) { ex.value = reading.value; ex.rid = reading.id; ex.lastAt = now; ex.repeats = (ex.repeats || 1) + 1; ex.steps = ev.steps; return; }
    var title = h.msg + ' (' + P.PARAMS[h.param].label + ' ' + P.fmtVal(h.param, reading.value) + ')';
    var owner = h.level === 'red' ? 'surgeon' : h.owner;
    var det = { id: uid(), pid: pt.id, rid: reading.id, param: h.param, value: reading.value, ruleId: h.id, level: h.level, msg: h.msg, title: title, owner: owner, at: now, readingAt: reading.at, state: 'open', steps: ev.steps, actions: [], source: who || 'entered' };
    var task = { id: uid(), pid: pt.id, title: 'Auto-detected: ' + title, owner: owner, kind: 'auto', due: 0, dueAt: now, state: 'open', createdAt: now, auto: true, detId: det.id };
    store.db.tasks.push(task); det.taskId = task.id; det.actions.push('Task created for ' + (OWNERS[owner] || owner));
    if (h.level === 'red') {
      var al = { id: uid(), pid: pt.id, cls: 'SAME-DAY', text: 'Auto-detected from parameters: ' + title, reason: 'Parameter rule: ' + h.param + ' ' + h.op + ' ' + h.value, at: now, count: 1, auto: true, detId: det.id };
      store.db.alerts.push(al); det.alertId = al.id; det.actions.push('Same-day alert raised for staff');
    }
    store.db.detections.push(det); made.push(det);
  });
  return { evaluation: ev, detections: made };
}
function patientCtx(pt) {
  var day = P.dayRel(otTime(pt.otDate), Date.now());
  var pend = store.db.tasks.filter(function (t) { return t.pid === pt.id && t.state === 'open' && !t.auto && !DOCTOR_OWNERS[t.owner]; }).length;
  return { procedure: (store.db.rules.pathway.procedures[pt.procedure] || {}).label || pt.procedure, phase: day < 0 ? 'before surgery' : 'after surgery', days: -day, pending: pend };
}
function buildBrief(pt) {
  var now = Date.now(), ot = otTime(pt.otDate), day = P.dayRel(ot, now), phone = store.db.settings.clinicPhone;
  var open = store.db.tasks.filter(function (t) { return t.pid === pt.id && t.state === 'open' && !t.auto; }).sort(function (a, b) { return a.dueAt - b.dueAt; });
  var pending = open.map(function (t) { return { title: t.title, owner: OWNERS[t.owner] || t.owner, dueAt: t.dueAt, overdue: t.dueAt < now, doctorOnly: !!DOCTOR_OWNERS[t.owner] }; });
  var dets = store.db.detections.filter(function (d) { return d.pid === pt.id && d.state === 'open'; }).sort(function (a, b) { return (b.level === 'red') - (a.level === 'red'); });
  var latest = latestReadings(pt), como = P.comorbidities(pt.intake);
  var msgs = store.db.messages.filter(function (m) { return m.pid === pt.id && m.who === 'patient'; });
  var recent = msgs.slice(-4).map(function (m) { return { text: m.text, cls: m.cls || '', at: m.at }; });
  var lastMsg = msgs[msgs.length - 1];
  var first = String(pt.name || '').split(' ').slice(-1)[0] || 'there';
  var facts = ['Patient: ' + pt.name + ', ' + (patientCtx(pt).procedure) + ', operation ' + P.fmtD(ot) + ' (' + (day < 0 ? (-day) + ' days to go' : day === 0 ? 'today' : 'day ' + day + ' after surgery') + ')',
    'Comorbidities: ' + (como.length ? como.map(function (c) { return c.label; }).join('; ') : 'none recorded'),
    'Pending items: ' + (pending.length ? pending.slice(0, 8).map(function (p) { return p.title + (p.overdue ? ' (overdue)' : ''); }).join('; ') : 'none'),
    'Open automatic flags: ' + (dets.length ? dets.map(function (d) { return d.level.toUpperCase() + ' ' + d.title; }).join('; ') : 'none'),
    'Latest readings: ' + (Object.keys(latest).length ? Object.keys(latest).map(function (k) { return P.PARAMS[k].label + ' ' + P.fmtVal(k, latest[k].value); }).join('; ') : 'none')].join('\n');
  var draft, red = dets.some(function (d) { return d.level === 'red'; }), urgentMsg = lastMsg && (lastMsg.cls === 'EMERGENCY' || lastMsg.cls === 'SAME-DAY');
  var preop = pending.filter(function (p) { return !p.doctorOnly; });
  if (red || urgentMsg) draft = 'Hello ' + first + ', thank you for telling us. I would like to review this with you today. Please call the clinic on ' + phone + ' so we can speak. If you feel worse or unwell, please go to the nearest Emergency Department.';
  else if (day < 0 && preop.length) draft = 'Hello ' + first + ', thank you for your message. Before your operation on ' + P.fmtD(ot) + ' we still need: ' + preop.slice(0, 4).map(function (p) { return p.title; }).join('; ') + '. The team will help you with these. Please call ' + phone + ' if you have questions.';
  else draft = 'Hello ' + first + ', thank you for your message. We have seen it and will reply during clinic hours. If you feel worse or something new worries you, please call ' + phone + '.';
  var cm = {}; como.forEach(function (c) { cm[c.key] = c; });
  var cmNotes = [];
  if (cm.blood_thinner) cmNotes.push('Your surgeon will give you a clear plan for your blood thinner' + (cm.blood_thinner.label.indexOf(':') > 0 ? ' (' + cm.blood_thinner.label.split(': ')[1] + ')' : '') + '; please do not change it until then.');
  if (cm.diabetes) cmNotes.push('We are also reviewing your sugar control' + (latest.hba1c ? ' (HbA1c ' + P.fmtVal('hba1c', latest.hba1c.value) + ')' : '') + ' before surgery.');
  if (cm.kidney_disease || (latest.egfr && latest.egfr.value < 60)) cmNotes.push('We will check your kidney function and medicines with you.');
  if (cm.heart_disease || cm.lung_disease) cmNotes.push('The anaesthetic team will review your heart and chest history.');
  if (cm.smoker && day < 0) cmNotes.push('Stopping smoking before surgery helps healing; we can support you.');
  if (cm.lives_alone) cmNotes.push('Since you live alone, we will plan who can help you at home after surgery.');
  var cmText = cmNotes.slice(0, 3).join(' ');
  var options = [];
  if (red || urgentMsg) options.push({ label: 'Call the clinic today', text: draft });
  options.push({ label: 'Ask one clarifying question', text: 'Hello ' + first + ', thank you for your message. To help me understand, could you tell me when this started and whether it is getting better or worse? ' + (day >= 0 ? 'If you have a fever, a wet wound, new calf swelling or chest symptoms, please call ' + phone + ' today.' : 'You can also call ' + phone + ' if you prefer to talk.') });
  if (day < 0) options.push({ label: 'Pre-op plan' + (cmNotes.length ? ' (uses comorbidities)' : ''), text: 'Hello ' + first + ', thank you for your message. Your operation is on ' + P.fmtD(ot) + '. ' + (preop.length ? 'We still need: ' + preop.slice(0, 3).map(function (p) { return p.title; }).join('; ') + '. ' : '') + cmText + ' Please call ' + phone + ' if you have questions.' });
  else options.push({ label: 'Recovery check-in' + (cmNotes.length ? ' (uses comorbidities)' : ''), text: 'Hello ' + first + ', thank you for your message. You are on day ' + day + ' after your operation. ' + (dets.length ? 'We noticed some readings we want to review with you, so we would like to speak today. ' : '') + 'Please call ' + phone + ' if the wound is wet or red, you have a fever, or your calf is swollen or painful.' });
  options.push({ label: 'Book a review', text: 'Hello ' + first + ', thank you for your message. I would like to see you in clinic to go through this properly. The clinic team will contact you with a time, or you can call ' + phone + '.' });
  if (cmNotes.length && day < 0) options.push({ label: 'Medicines and conditions only', text: 'Hello ' + first + ', ' + cmText });
  return { options: options, day: day, phase: day < 0 ? 'before surgery' : 'after surgery', otDate: pt.otDate, comorbidities: como, pending: pending, flags: dets.map(function (d) { return { id: d.id, level: d.level, title: d.title, owner: OWNERS[d.owner] || d.owner, at: d.at, actions: d.actions }; }), recent: recent, latest: Object.keys(latest).map(function (k) { return { param: k, label: P.PARAMS[k].label, value: P.fmtVal(k, latest[k].value), at: latest[k].at }; }), facts: facts, draft: options.length ? options[0].text : draft, lastMessage: lastMsg ? lastMsg.text : '' };
}
function maxCases() { return Math.max(1, Number(store.db.settings.maxCasesPerDay) || 5); }
function calendarData(from, to) {
  var days = {}, pts = {}; store.db.patients.forEach(function (p) { if (p.active) pts[p.id] = p; });
  function d(k) { return days[k] || (days[k] = { date: k, ops: [], bloods: [], followups: [] }); }
  Object.keys(pts).forEach(function (id) { var p = pts[id]; d(p.otDate).ops.push({ pid: p.id, name: p.name, rn: p.rn, proc: (store.db.rules.pathway.procedures[p.procedure] || {}).label || p.procedure, flags: store.db.detections.filter(function (x) { return x.pid === p.id && x.state === 'open'; }).length }); });
  store.db.tasks.forEach(function (t) { var p = pts[t.pid]; if (!p || t.auto) return; var k = dateStr(t.dueAt);
    if (/blood/i.test(t.title)) d(k).bloods.push({ pid: p.id, name: p.name, rn: p.rn, title: t.title, state: t.state });
    else if (/follow-up|clinic visit/i.test(t.title)) d(k).followups.push({ pid: p.id, name: p.name, rn: p.rn, title: t.title, state: t.state }); });
  var max = maxCases(), today = dateStr(Date.now()), all = Object.keys(days).sort().map(function (k) { return days[k]; });
  var over = all.filter(function (x) { return x.ops.length > max && x.date >= today; }).map(function (x) { return { date: x.date, count: x.ops.length }; });
  return { max: max, today: today, over: over, days: all.filter(function (x) { return (!from || x.date >= from) && (!to || x.date <= to); }) };
}
var bg = new Set();
function bgProfile(pt, s8, inMsg) {
  var msgs = store.db.messages.filter(function (m) { return m.pid === pt.id; });
  var det = P.detProfile(msgs, Date.now()), b = buildBrief(pt);
  pt.profile = Object.assign(pt.profile || {}, { det: det, comorbidities: b.comorbidities.map(function (c) { return c.label; }), pending: b.pending.length, openFlags: b.flags.length, updatedAt: Date.now() });
  var texts = msgs.filter(function (m) { return m.who === 'patient'; }).map(function (m) { return m.text; });
  var p = AI.profile(b.facts, texts, 'profile ' + pt.rn).then(function (r) {
    if (r.text) { pt.profile.summary = r.text; pt.profile.aiAt = Date.now(); s8.detail = 'Facts updated from the record and chat. AI wrote the staff summary (' + AI.activity(1)[0].ms + ' ms).'; }
    else s8.detail = 'Facts updated from the record and chat. ' + (r.skipped ? 'AI not connected, no written summary.' : 'AI summary unavailable this time.');
    s8.status = 'pass'; store.save();
  }).catch(function () {}).then(function () { bg.delete(p); });
  bg.add(p);
}
function drain() { return Promise.all(Array.from(bg)); }

/* ---------- the patient message pipeline ---------- */
var urgentRank = { 'ACK': 0, 'ANSWER': 0, 'ROUTE': 1, 'SAME-DAY': 2, 'EMERGENCY': 3 };
function norm(s) { return E.arNorm(String(s)).toLowerCase().replace(/\s+/g, ' '); }
function addMsg(pid, who, text, extra) { var m = Object.assign({ id: uid(), pid: pid, who: who, text: text, at: Date.now() }, extra || {}); store.db.messages.push(m); return m; }
function raiseAlert(pt, cls, text, reason) {
  var recent = store.db.alerts.find(function (a) { return a.pid === pt.id && !a.ackAt && a.cls === cls && Date.now() - a.at < 10 * 60 * 1000; });
  if (recent) { recent.count = (recent.count || 1) + 1; recent.text = text; recent.lastAt = Date.now(); return recent; }
  var a = { id: uid(), pid: pt.id, cls: cls, text: text, reason: reason, at: Date.now(), count: 1 };
  store.db.alerts.push(a); return a;
}

async function patientMessage(pt, rawText, via) {
  var text = String(rawText || '').replace(/\s+/g, ' ').trim().slice(0, 1000);
  if (!text) return;
  var trace = [], t0 = Date.now(), tick = Date.now();
  function step(n, title, status, detail) { var now = Date.now(); trace.push({ n: n, title: title, status: status, detail: detail, ms: now - tick }); tick = now; }
  // 1. identifiers are masked before anything is stored or sent to a model
  var masked = 0;
  var safe = text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, function () { masked++; return '[email]'; }).replace(/(?<!\d)\d{6}-?\d{2}-?\d{4}(?!\d)/g, function () { masked++; return '[id]'; }).replace(/\+?\d[\d\s()-]{7,}\d/g, function (m) { var n = m.replace(/\D/g, '').length; if (n >= 9 && n <= 15) { masked++; return '[phone]'; } return m; });
  pt.firstSeen = pt.firstSeen || Date.now();
  step(1, 'Receive and mask', masked ? 'raise' : 'pass', masked ? masked + ' identifier(s) masked before storing or sending anywhere' : 'No phone, IC or email found');
  var inMsg = addMsg(pt.id, 'patient', safe, via ? { via: via } : {});
  // 2. fixed red-flag rules
  var rules = TR.classify(safe, { procedure: pt.procedure });
  var lang = rules.lang || pt.lang || 'en'; if (!T('FOOT', lang) || !LANGS[lang]) lang = 'en';
  var cls = rules.cls, flags = (rules.flags || []).slice(), reason = '';
  var rulesCls = rules.cls;
  step(2, 'Fixed red-flag rules (written by people, no AI)', (cls === 'EMERGENCY' || cls === 'SAME-DAY') ? 'raise' : 'pass', 'Result: ' + cls + (flags.length ? ' · ' + flags.join('; ') : '') + ' · language detected: ' + lang + (rules.changed ? ' · v2 layer: ' + rules.changed + ' (engine alone said ' + rules.engineCls + ')' : ''));
  // 3. clinic extra phrases (can only raise)
  var nt = norm(safe), hitRf = null;
  store.db.rules.redflags.forEach(function (rf) {
    if (rf.phrase && nt.indexOf(norm(rf.phrase)) >= 0 && urgentRank[rf.cls] > urgentRank[cls]) { cls = rf.cls; flags.push('clinic rule: ' + rf.phrase); reason = 'Clinic rule: "' + rf.phrase + '"'; hitRf = rf; }
  });
  step(3, 'Clinic extra phrases (can only raise)', hitRf ? 'raise' : 'pass', hitRf ? 'Matched "' + hitRf.phrase + '" -> ' + hitRf.cls : store.db.rules.redflags.length + ' phrase(s) checked, none matched');
  var urgent = cls === 'EMERGENCY' || cls === 'SAME-DAY';
  var secondUsed = false, sec = null;
  // 4. model second check
  if (urgent) step(4, 'AI second check', 'skip', 'Skipped: rules already say ' + cls + '. The AI is never needed to confirm an emergency.');
  else if (!aiConfigured()) step(4, 'AI second check', 'skip', 'AI is not connected on the server, so rules only.');
  else {
    sec = await secondCheck(safe, pt.id); secondUsed = sec.verdict !== 'unscreened';
    if (sec.verdict === 'urgent') { cls = 'SAME-DAY'; urgent = true; flags.push('second check: ' + sec.reason); reason = 'AI second check: ' + sec.reason; step(4, 'AI second check', 'raise', 'Model says URGENT: "' + sec.reason + '". The class is raised to SAME-DAY. The model can raise, never lower.'); }
    else if (sec.verdict === 'routine') step(4, 'AI second check', 'pass', 'Model says routine. The rules class is unchanged (' + cls + ').');
    else { inMsg.unscreened = true; step(4, 'AI second check', 'warn', 'Model unavailable or invalid: message marked "AI check unavailable" for staff. The rules result stands.'); }
  }
  inMsg.cls = cls; inMsg.flags = flags;
  step(5, 'Decision', urgent ? 'raise' : 'pass', 'Final class: ' + cls + (rulesCls !== cls ? ' (rules said ' + rulesCls + ')' : ''));

  function finish(label, status, detail, staffEffect) {
    step(6, 'Reply path', status, label + (detail ? ' · ' + detail : ''));
    step(7, 'Effect for staff', staffEffect.indexOf('Nothing') === 0 ? 'pass' : 'raise', staffEffect);
    inMsg.totalMs = Date.now() - t0;
    var s8 = { n: 8, title: 'Update patient profile (after the reply, in the background)', status: 'warn', detail: 'Updating the profile from the record and this chat...', ms: 0 }; trace.push(s8); inMsg.trace = trace;
    bgProfile(pt, s8, inMsg);
  }
  if (cls === 'EMERGENCY' || cls === 'SAME-DAY') {
    var al = raiseAlert(pt, cls, safe, reason || flags.join('; '));
    inMsg.needsStaff = true;
    addMsg(pt.id, 'bot', T(cls === 'EMERGENCY' ? 'EMERGENCY' : 'SAMEDAY', lang), { cls: cls });
    finish(cls === 'EMERGENCY' ? 'Fixed emergency text (call 999 / go to the Emergency Department, no promise of a reply)' : 'Fixed same-day text (call the clinic today, not monitored around the clock)', 'pass', 'AI not used for the patient reply', 'Alert ' + (al.count > 1 ? 'merged (x' + al.count + ')' : 'raised') + ' on the Today page and in Alerts; message in the Inbox');
    return;
  }
  // ---- not urgent from here on ----
  var S = store.db.settings, now2 = Date.now();
  function histFor() { return store.db.messages.filter(function (m) { return m.pid === pt.id && (m.who === 'patient' || m.who === 'ai' || m.who === 'bot'); }).slice(-7, -1).map(function (m) { return { role: m.who === 'patient' ? 'user' : 'assistant', content: m.text }; }); }
  // v2: a staff conversation hands itself back after 24 h without a staff message (before: silent until someone pressed "hand back")
  var lastStaff = store.db.messages.filter(function (m) { return m.pid === pt.id && m.who === 'staff'; }).slice(-1)[0];
  if (pt.threadOpen && (!lastStaff || now2 - lastStaff.at > HANDBACK_MS)) { pt.threadOpen = false; audit('system', 'conversation with ' + pt.rn + ' handed back to the assistant after 24 h without a staff message'); }
  // v2: exact answers from the patient's own record are given even while a person is handling the conversation
  var ra = P.recordAnswer(safe, { pt: pt, tasks: store.db.tasks.filter(function (t) { return t.pid === pt.id && !t.auto; }), otMs: otTime(pt.otDate), now: now2, phone: S.clinicPhone, doctorOwners: DOCTOR_OWNERS });
  if (ra) { if (pt.threadOpen) inMsg.needsStaff = true; addMsg(pt.id, 'bot', ra.text, { cls: 'ANSWER', record: true }); finish('Answered from the clinic record (' + ra.kind + '): exact data from this patient\'s own plan, no AI wording, no advice', 'pass', 'Operation ' + P.fmtD(otTime(pt.otDate)), pt.threadOpen ? 'Message also in the Inbox: a person is handling this conversation' : 'Nothing for staff'); return; }
  if (pt.threadOpen) {
    inMsg.needsStaff = true;
    // v2.1: a fixed clinic answer found by keyword (no AI) is still given while a person handles the chat, like record answers.
    // Before, "What should I bring?" got silence for 30 minutes after any staff reply.
    var tpo = /clinical judgement|worsening trend/.test(flags.join(' ')) ? null : (rules.topicHint ? ANS.byId(rules.topicHint) : ANS.match(safe));
    if (tpo && answerUsable(tpo)) {
      var sto = store.db.rules.answerState[tpo.id] || {}, apo = sto.status === 'approved';
      addMsg(pt.id, 'bot', ANS.text(tpo, lang, S), { cls: 'ANSWER', library: tpo.id, draft: !apo, approvedBy: apo ? sto.by : '' });
      if (tpo.staff) inMsg.forOwner = tpo.owner;
      finish('Clinic answer "' + tpo.title + '" (' + (apo ? 'approved by ' + sto.by : 'DRAFT, not yet approved by a doctor') + '), shown exactly as written · keyword match', 'pass', 'Given even though a person is handling this conversation, because it is a fixed text', 'Message also in the Inbox for the staff member'); return;
    }
    if (now2 - lastStaff.at < LIVE_MS) { finish('Silent: ' + lastStaff.staffName + ' replied in the last 30 minutes, so the assistant stays out of the conversation', 'pass', '', 'Message goes to the Inbox for the staff member'); return; }
    addMsg(pt.id, 'bot', T('HELD', lang).replace('{name}', lastStaff.staffName || 'the clinic team'), { cls: 'ROUTE' });
    finish('Receipt only: a person is handling this conversation, so the assistant does not answer but tells the patient the message arrived', 'pass', 'Fixed text, no promise of a reply time', 'Message goes to the Inbox for the staff member'); return;
  }
  if (cls === 'ACK') { addMsg(pt.id, 'bot', rules.reply, { cls: 'ACK' }); finish('Acknowledgement (fixed text)', 'pass', '', 'Nothing for staff'); return; }
  // v2: a short thank-you with no question is acknowledged, not sent to the Inbox
  if (cls === 'ROUTE' && safe.length <= 40 && !/[?？؟]/.test(safe) && /\bthank|\bthanks\b|\btq\b|terima kasih|谢谢|多谢|شكرا/i.test(safe) && !/\bbut\b|tapi|但/i.test(safe)) { addMsg(pt.id, 'bot', { en: 'You are welcome. Message us any time if anything changes.', ms: 'Sama-sama. Hubungi kami bila-bila masa jika ada perubahan.', zh: '不客气。如有变化请随时联系我们。', ar: 'على الرحب والسعة. راسلنا في أي وقت إذا تغيّر شيء.' }[lang] || 'You are welcome.', { cls: 'ACK' }); finish('Thank-you: fixed acknowledgement', 'pass', '', 'Nothing for staff'); return; }
  if (cls === 'ASK') { inMsg.needsStaff = true; addMsg(pt.id, 'bot', rules.reply, { cls: 'ROUTE' }); finish('Vague "not well" message: fixed question asking what is wrong (pain, wound, breathing, leg swelling, fever)', 'pass', '', 'Message in the Inbox'); return; }
  var clinical = /clinical judgement|worsening trend/.test(flags.join(' '));
  // answers a doctor at this clinic wrote
  var faq = store.db.rules.faqs.find(function (f) { return f.keywords.some(function (k) { return k && nt.indexOf(norm(k)) >= 0; }); });
  if (faq && !clinical) { addMsg(pt.id, 'bot', faq.answer, { cls: 'ANSWER', faq: true, approvedBy: faq.addedBy }); finish('Clinic-approved answer by ' + faq.addedBy + ' (shown exactly as written)', 'pass', '', 'Nothing for staff'); return; }
  // v2: clinic answer library. Keywords first; if none and the AI is on, the model may CHOOSE a text. It never writes one.
  if (!clinical) {
    var usable = ANS.TOPICS.filter(answerUsable), how = 'keyword match';
    var tp = rules.topicHint ? ANS.byId(rules.topicHint) : ANS.match(safe);
    if (tp && !answerUsable(tp)) tp = null;
    if (!tp && cls !== 'ANSWER' && secondUsed && usable.length && safe.length > 8) {
      var picked = await AI.pick(safe, usable.map(function (t) { return t.id + ': ' + t.title; }).join('\n'), usable.map(function (t) { return t.id; }), 'pick ' + pt.rn);
      if (picked && ANS.byId(picked).re.source !== 'a^') { tp = ANS.byId(picked); how = 'chosen by the AI from the list (the AI did not write the words)'; }
    }
    if (tp) {
      var st = store.db.rules.answerState[tp.id] || {}, approved = st.status === 'approved';
      var noFoot = tp.owner === 'admin' || tp.owner === 'clinic_coordinator' || tp.id === 'bring' || tp.id === 'shave';
      addMsg(pt.id, 'bot', ANS.text(tp, lang, S) + (noFoot ? '' : ' ' + T('FOOT', lang)), { cls: 'ANSWER', library: tp.id, draft: !approved, approvedBy: approved ? st.by : '' });
      if (tp.staff) { inMsg.needsStaff = true; inMsg.forOwner = tp.owner; }
      finish('Clinic answer "' + tp.title + '" (' + (approved ? 'approved by ' + st.by : 'DRAFT, not yet approved by a doctor') + '), shown exactly as written · ' + how, 'pass', '', tp.staff ? 'Message also in the Inbox for ' + (OWNERS[tp.owner] || tp.owner) : 'Nothing for staff'); return;
    }
  }
  if (cls === 'ANSWER') { addMsg(pt.id, 'bot', rules.reply, { cls: 'ANSWER' }); finish('Built-in draft answer (fixed text)', 'pass', '', 'Nothing for staff'); return; }
  var greeting = /^(?:hi+|hello+|hey|morning|evening|helo|hai|salam|assalamualaikum|good (?:morning|afternoon|evening)|selamat (?:pagi|petang|malam|tengah hari)|你好|您好|哈[啰喽]|早上好|مرحبا|السلام عليكم|هلا)(?: there| doctor| dr| nurse| doktor)?[\s!.,?]*$/i.test(safe);
  if (greeting && !secondUsed) { addMsg(pt.id, 'bot', T('HELLO', lang), { cls: 'ACK' }); finish('Greeting: fixed welcome text that says what can be asked', 'pass', 'AI not used', 'Nothing for staff'); return; }
  // ROUTE: no fixed answer. Staff will see it.
  inMsg.needsStaff = !greeting;
  if (clinical) {
    var cai = secondUsed ? await aiReply(safe, histFor(), lang, pt.id, patientCtx(pt), true) : { text: '' };
    if (cai.text) { addMsg(pt.id, 'ai', cai.text + ' ' + (lang === 'en' ? 'I have passed this to the clinic team and a clinician will answer. ' : '') + T('FOOT', lang), { cls: 'ROUTE', clinical: true }); finish('Clinical question: the assistant gives NO advice. It asked one clarifying question and passed the message to a clinician', 'pass', 'Guard: must be a question, no advice or reassurance', 'Inbox item marked clinical question; the answer to the question will help the clinician'); }
    else { addMsg(pt.id, 'bot', T('ROUTE', lang), { cls: 'ROUTE', clinical: true }); finish('Clinical question: never answered by the assistant, fixed handover text', 'pass', cai.blocked ? 'AI question blocked by the guard: ' + cai.blocked : 'AI not used', 'Inbox item marked clinical question'); }
    return;
  }
  if (!secondUsed) { addMsg(pt.id, 'bot', T('RECEIPT', lang), { cls: 'ROUTE' }); finish('Fixed receipt text (message saved for the team, no promise of a reply time)', 'pass', 'AI reply not attempted because the second check did not run', 'Message in the Inbox'); return; }
  var ai = await aiReply(safe, histFor(), lang, pt.id, patientCtx(pt), false);
  if (ai.text) { addMsg(pt.id, 'ai', ai.text + (greeting ? '' : ' ' + T('FOOT', lang)), { cls: 'ROUTE' }); finish('AI-written reply, shown after the output guard accepted it' + (ai.dropped ? ' (' + ai.dropped + ' sentence(s) the guard could not verify were removed)' : ''), 'pass', 'Guard: no advice, no reassurance, no diagnosis, no dose, no invented numbers, no promise of a reply time', greeting ? 'Nothing for staff' : 'Message also in the Inbox for a person'); }
  else { addMsg(pt.id, 'bot', T(greeting ? 'HELLO' : 'RECEIPT', lang), { cls: 'ROUTE' }); finish('AI reply not used: fixed text shown instead', 'warn', ai.blocked ? 'Output guard BLOCKED the model reply: ' + ai.blocked : (ai.error || ai.skipped || 'model returned nothing'), greeting ? 'Nothing for staff' : 'Message in the Inbox'); }
}
function answerUsable(tp) { var st = (store.db.rules.answerState || {})[tp.id] || {}; if (st.status === 'off') return false; return st.status === 'approved' || !!store.db.settings.useDraftAnswers; }

/* ---------- http helpers ---------- */
var sessions = new Map();     // sid -> {username, exp}
function parseCookies(req) { var o = {}; String(req.headers.cookie || '').split(';').forEach(function (c) { var i = c.indexOf('='); if (i > 0) o[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); }); return o; }
function userOf(req) { var sid = parseCookies(req).sid; var s = sid && sessions.get(sid); if (!s || s.exp < Date.now()) return null; return store.db.users.find(function (u) { return u.username === s.username; }) || null; }
function send(res, code, obj, headers) { var b = JSON.stringify(obj); res.writeHead(code, Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, headers || {})); res.end(b); }
function readBody(req) { return new Promise(function (resolve) { var chunks = [], n = 0; req.on('data', function (c) { n += c.length; if (n > 64 * 1024) { req.destroy(); resolve(null); return; } chunks.push(c); }); req.on('end', function () { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { resolve(null); } }); }); }
var hits = new Map();
function limited(key, max, ms) { var now = Date.now(), r = hits.get(key); if (!r || now > r.reset) { r = { n: 0, reset: now + ms }; hits.set(key, r); } r.n++; if (hits.size > 5000) hits.forEach(function (v, k) { if (now > v.reset) hits.delete(k); }); return r.n > max; }
var MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
function serveFile(res, name) { var f = path.join(PUBLIC, name); fs.readFile(f, function (e, b) { if (e) { res.writeHead(404); res.end('Not found'); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store', 'x-frame-options': 'SAMEORIGIN', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self'" }); res.end(b); }); }

function patientByToken(tok) { return store.db.patients.find(function (p) { return p.active && p.token === tok; }); }
function needDoctor(u) { return u && u.role === 'doctor'; }

/* ---------- routes ---------- */
async function route(req, res) {
  var url = new URL(req.url, 'http://x'), p = url.pathname, m = req.method;
  if (m === 'GET' && (p === '/' || p === '/staff')) return serveFile(res, 'staff.html');
  if (m === 'GET' && p.indexOf('/p/') === 0) return serveFile(res, 'patient.html');
  if (m === 'GET' && p === '/live') return serveFile(res, 'live.html');
  if (m === 'GET' && p === '/eval/label') return serveFile(res, path.join('..', 'eval', 'label.html'));   // v3: blind labelling page (the pool itself is doctor-only, below)
  if (m === 'GET' && p === '/healthz') return send(res, 200, { ok: true });
  if (!p.startsWith('/api/')) { res.writeHead(404); return res.end('Not found'); }

  if (m === 'POST' && req.headers['x-requested-with'] !== 'periloop') return send(res, 403, { error: 'bad_request' });
  var body = m === 'POST' ? await readBody(req) : {};
  if (body === null) return send(res, 400, { error: 'bad_json' });

  // ---- patient endpoints (private link, no login) ----
  var pm = p.match(/^\/api\/p\/([A-Za-z0-9_-]{16,64})\/(messages|message)$/);
  if (pm) {
    var pt = patientByToken(pm[1]); if (!pt) return send(res, 404, { error: 'unknown_link' });
    if (m === 'GET' && pm[2] === 'messages') {
      var msgs = store.db.messages.filter(function (x) { return x.pid === pt.id; }).map(function (x) { return { id: x.id, who: x.who, text: x.text, at: x.at, staffName: x.staffName, staffRole: x.staffRole, faq: !!x.faq, approvedBy: x.approvedBy, library: !!x.library, draft: !!x.draft }; });
      return send(res, 200, { name: pt.name, messages: msgs, threadOpen: !!pt.threadOpen, emergency: store.db.settings.emergencyNumber || '999', lang: pt.lang, pending: store.db.tasks.filter(function (t) { return t.pid === pt.id && t.state === 'open' && !t.auto && !DOCTOR_OWNERS[t.owner]; }).length });
    }
    if (m === 'POST' && pm[2] === 'message') {
      if (limited('pm-' + pt.id, 20, 5 * 60 * 1000)) return send(res, 429, { error: 'slow_down' });
      if (!body.text || typeof body.text !== 'string') return send(res, 400, { error: 'bad_text' });
      await patientMessage(pt, body.text); store.save();
      return send(res, 200, { ok: true });
    }
  }

  // ---- login ----
  if (m === 'POST' && p === '/api/login') {
    if (limited('login-' + (req.socket.remoteAddress || ''), 10, 5 * 60 * 1000)) return send(res, 429, { error: 'too_many_attempts' });
    var u = store.db.users.find(function (x) { return x.username === String(body.username || '').toLowerCase(); });
    var ok = u && crypto.timingSafeEqual(Buffer.from(hash(body.password || '', u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
    if (!ok) return send(res, 401, { error: 'wrong_login' });
    var sid = crypto.randomBytes(24).toString('hex'); sessions.set(sid, { username: u.username, exp: Date.now() + 12 * 3600 * 1000 });
    audit(u.username, 'login');
    return send(res, 200, { ok: true }, { 'set-cookie': 'sid=' + sid + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200' });
  }
  if (m === 'GET' && p === '/api/demo') return send(res, 200, { demo: !!store.db.settings.demoBanner });

  var user = userOf(req);
  if (!user) return send(res, 401, { error: 'login_required' });

  if (m === 'POST' && p === '/api/logout') { var sid2 = parseCookies(req).sid; sessions.delete(sid2); return send(res, 200, { ok: true }, { 'set-cookie': 'sid=; Max-Age=0; Path=/' }); }
  if (m === 'GET' && p === '/api/me') return send(res, 200, { username: user.username, name: user.name, role: user.role, owners: OWNERS, langs: LANGS, procedures: Object.keys(store.db.rules.pathway.procedures).map(function (k) { return { key: k, label: store.db.rules.pathway.procedures[k].label }; }), ai: aiConfigured(), settings: store.db.settings });

  if (m === 'GET' && p === '/api/summary') {
    var open = store.db.tasks.filter(function (t) { return t.state === 'open' && store.db.patients.find(function (x) { return x.id === t.pid && x.active; }); });
    return send(res, 200, {
      overCapacity: calendarData('', '').over.length,
      patients: store.db.patients.filter(function (x) { return x.active; }).length,
      overdue: open.filter(function (t) { return t.dueAt < Date.now(); }).length,
      openTasks: open.length,
      openAlerts: store.db.alerts.filter(function (a) { return !a.ackAt; }).length,
      needsReply: store.db.messages.filter(function (x) { return x.needsStaff && !x.handled; }).length,
      setup: /set in Settings|Set the clinic hours/.test(store.db.settings.clinicPhone + store.db.settings.sessionsText),
      ai: aiConfigured()
    });
  }

  if (m === 'GET' && p === '/api/patients') return send(res, 200, store.db.patients.filter(function (x) { return x.active; }).map(ptView));
  if (m === 'POST' && p === '/api/patients') {
    var name = String(body.name || '').trim(), rn = String(body.rn || '').trim().toUpperCase(), proc = String(body.procedure || ''), ot = String(body.otDate || ''), lang = LANGS[body.lang] ? body.lang : 'en';
    if (!name || name.length > 20) return send(res, 400, { error: 'name', message: 'Use a short name only (first name and initial, up to 20 characters).' });
    if (!/^[A-Z0-9-]{3,20}$/.test(rn)) return send(res, 400, { error: 'rn', message: 'Record number: 3 to 20 letters, digits or dashes.' });
    if (store.db.patients.some(function (x) { return x.active && x.rn === rn; })) return send(res, 400, { error: 'rn', message: 'That record number already exists.' });
    if (!store.db.rules.pathway.procedures[proc]) return send(res, 400, { error: 'procedure', message: 'Pick a procedure.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ot) || isNaN(otTime(ot))) return send(res, 400, { error: 'otDate', message: 'Enter the operation date.' });
    var pt2 = { id: uid(), name: name, rn: rn, procedure: proc, otDate: ot, lang: lang, token: crypto.randomBytes(18).toString('base64url'), active: true, createdAt: Date.now(), addedBy: user.username };
    store.db.patients.push(pt2); createTasks(pt2); audit(user.username, 'added patient ' + rn); store.save();
    var capd = calendarData(ot, ot).days[0], warn = capd && capd.ops.length > maxCases() ? 'Warning: ' + capd.ops.length + ' cases are now booked on ' + ot + ' (limit ' + maxCases() + ').' : '';
    return send(res, 200, { id: pt2.id, warning: warn });
  }
  var pp = p.match(/^\/api\/patients\/([a-f0-9]+)(?:\/(.+))?$/);
  if (pp) {
    var pat = store.db.patients.find(function (x) { return x.id === pp[1] && x.active; }); if (!pat) return send(res, 404, { error: 'not_found' });
    var sub = pp[2] || '';
    if (m === 'GET' && !sub) {
      return send(res, 200, { patient: ptView(pat), intake: pat.intake || null, link: '/p/' + pat.token,
        tasks: store.db.tasks.filter(function (t) { return t.pid === pat.id; }).sort(function (a, b) { return a.dueAt - b.dueAt; }).map(taskView),
        messages: store.db.messages.filter(function (x) { return x.pid === pat.id; }),
        alerts: store.db.alerts.filter(function (a) { return a.pid === pat.id; }),
        readings: store.db.readings.filter(function (r) { return r.pid === pat.id; }).sort(function (a, b) { return a.at - b.at; }), detections: store.db.detections.filter(function (d) { return d.pid === pat.id; }).sort(function (a, b) { return b.at - a.at; }),
        brief: buildBrief(pat), profile: pat.profile || null, aiOn: aiConfigured(), params: P.PARAMS });
    }
    if (m === 'POST' && sub === 'reply') {
      var txt = String(body.text || '').trim().slice(0, 1000); if (!txt) return send(res, 400, { error: 'empty' });
      addMsg(pat.id, 'staff', txt, { staffName: user.name, staffRole: user.role === 'doctor' ? 'Doctor' : 'Nurse', by: user.username });
      store.db.messages.forEach(function (x) { if (x.pid === pat.id && x.needsStaff) x.handled = true; });
      pat.threadOpen = true; audit(user.username, 'replied to ' + pat.rn); store.save(); return send(res, 200, { ok: true });
    }
    if (m === 'POST' && sub === 'readings') {
      var pr = String(body.param || ''), def = P.PARAMS[pr]; if (!def) return send(res, 400, { error: 'param', message: 'Pick a parameter.' });
      var val = body.value;
      if (def.categorical) { if (def.categorical.indexOf(String(val)) < 0) return send(res, 400, { error: 'value', message: 'Pick one of: ' + def.categorical.join(', ') }); val = String(val); }
      else { val = Number(val); if (!isFinite(val) || val < 0 || val > 1000) return send(res, 400, { error: 'value', message: 'Enter a number.' }); }
      var rd = { id: uid(), pid: pat.id, param: pr, value: val, at: Date.now(), source: 'entered by ' + user.name };
      store.db.readings.push(rd); var dr = detectAndAct(pat, rd, 'entered by ' + user.name); audit(user.username, 'entered ' + pr + ' for ' + pat.rn); store.save();
      return send(res, 200, { reading: rd, detections: dr.detections, steps: dr.evaluation.steps, hits: dr.evaluation.hits.map(function (h) { return { level: h.level, msg: h.msg }; }) });
    }
    if (m === 'POST' && sub === 'draft') {
      var br = buildBrief(pat), r2 = await AI.draft(br.facts, br.lastMessage || '(no message yet)', 'draft for ' + pat.rn);
      return send(res, 200, { ai: r2.text || '', aiError: r2.error || '', aiSkipped: !!r2.skipped, rules: br.draft, options: br.options });
    }
    if (m === 'POST' && sub === 'handback') { pat.threadOpen = false; addMsg(pat.id, 'bot', 'Handing you back to the assistant for general questions.', { cls: 'ACK' }); audit(user.username, 'handed back ' + pat.rn); store.save(); return send(res, 200, { ok: true }); }
    if (m === 'POST' && sub === 'dismiss') { store.db.messages.forEach(function (x) { if (x.pid === pat.id && x.needsStaff) x.handled = true; }); store.save(); return send(res, 200, { ok: true }); }
    if (m === 'POST' && sub === 'newlink') { pat.token = crypto.randomBytes(18).toString('base64url'); audit(user.username, 'new link for ' + pat.rn); store.save(); return send(res, 200, { link: '/p/' + pat.token }); }
    if (m === 'POST' && sub === 'remove') { if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' }); pat.active = false; audit(user.username, 'removed patient ' + pat.rn); store.save(); return send(res, 200, { ok: true }); }
    var tm = sub.match(/^tasks\/([a-f0-9]+)\/done$/);
    if (m === 'POST' && tm) {
      var t = store.db.tasks.find(function (x) { return x.id === tm[1] && x.pid === pat.id; }); if (!t) return send(res, 404, { error: 'not_found' });
      var ev = String(body.evidence || '').trim();
      if (ev.length < 3) return send(res, 400, { error: 'evidence', message: 'Write what was done or the result (at least a few words). A task is closed with evidence, never with a bare tick.' });
      if (DOCTOR_OWNERS[t.owner] && user.role !== 'doctor') return send(res, 403, { error: 'doctor_only', message: 'Only a doctor can close this clinical decision.' });
      t.state = 'done'; t.evidence = ev.slice(0, 500); t.doneBy = user.name; t.doneAt = Date.now(); if (t.detId) store.db.detections.forEach(function (d) { if (d.id === t.detId && d.state === 'open') { d.state = 'actioned'; d.actionedBy = user.name; d.actionedAt = Date.now(); } }); audit(user.username, 'closed task "' + t.title + '" for ' + pat.rn); store.save(); return send(res, 200, { ok: true });
    }
  }


  // ---- demo cases, test-message library, live trace ----
  if (m === 'POST' && p === '/api/demo/load') { if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' }); return send(res, 200, { added: seedDemo(user.username) }); }
  if (m === 'GET' && p === '/api/eval/pool') { if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' }); return send(res, 200, require('./eval/pool.js').blind()); }   // v3: messages only, no AI label, no set name
  if (m === 'GET' && p === '/api/library') {
    var lib = []; try { lib = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed', 'messages.json'), 'utf8')); } catch (e) { lib = []; }
    return send(res, 200, lib);
  }
  if (m === 'POST' && p === '/api/live/send') {
    var tp = store.db.patients.find(function (x) { return x.id === body.pid && x.active; }); if (!tp) return send(res, 404, { error: 'not_found' });
    var tx = String(body.text || '').trim(); if (!tx) return send(res, 400, { error: 'empty' });
    await patientMessage(tp, tx, (body.libId ? 'replayed by ' : 'typed in Live view by ') + user.name + (body.libId ? ' (library ' + String(body.libId).slice(0, 12) + ')' : '')); store.save(); return send(res, 200, { ok: true });
  }
  if (m === 'GET' && p === '/api/calendar') { var cal = calendarData(url.searchParams.get('from') || '', url.searchParams.get('to') || ''); return send(res, 200, cal); }
  if (m === 'GET' && p === '/api/params') return send(res, 200, { params: P.PARAMS, rules: store.db.rules.periop });
  if (m === 'GET' && p === '/api/detections') {
    var dl = store.db.detections.slice().sort(function (a, b) { return b.at - a.at; }).slice(0, 60).map(function (d) { var q = store.db.patients.find(function (x) { return x.id === d.pid; }); return Object.assign({}, d, { patient: q ? q.name : '?', rn: q ? q.rn : '', ownerLabel: OWNERS[d.owner] || d.owner }); });
    return send(res, 200, dl);
  }
  if (m === 'GET' && p === '/api/ai/activity') return send(res, 200, { on: aiConfigured(), log: AI.activity(60) });
  if (m === 'POST' && p === '/api/demo/reset') {
    if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' });
    var ids = {}; store.db.patients.forEach(function (x) { if (x.demo) ids[x.id] = 1; });
    ['patients', 'tasks', 'messages', 'alerts', 'readings', 'detections'].forEach(function (k) { store.db[k] = store.db[k].filter(function (x) { return !ids[x.pid || x.id]; }); });
    var n2 = seedDemo(user.username); audit(user.username, 'reset demo data'); store.save(); return send(res, 200, { added: n2 });
  }
  if (m === 'GET' && p === '/api/trace') {
    var pid5 = url.searchParams.get('pid'); var ms5 = store.db.messages.filter(function (x) { return x.pid === pid5; });
    var out5 = [];
    ms5.forEach(function (x, i) { if (x.who !== 'patient' || !x.trace) return; var replies = []; for (var j = i + 1; j < ms5.length && ms5[j].who !== 'patient'; j++) replies.push({ who: ms5[j].who, text: ms5[j].text, faq: !!ms5[j].faq, staffName: ms5[j].staffName }); out5.push({ id: x.id, text: x.text, at: x.at, via: x.via || '', cls: x.cls, trace: x.trace, totalMs: x.totalMs, replies: replies }); });
    return send(res, 200, out5.slice(-12).reverse());
  }

  if (m === 'GET' && p === '/api/inbox') {
    var items = [];
    store.db.patients.filter(function (x) { return x.active; }).forEach(function (pt3) {
      var ms = store.db.messages.filter(function (x) { return x.pid === pt3.id && x.needsStaff && !x.handled; });
      if (!ms.length) return;
      var worst = ms.reduce(function (a, b) { return urgentRank[b.cls] > urgentRank[a] ? b.cls : a; }, 'ROUTE');
      items.push({ pid: pt3.id, name: pt3.name, rn: pt3.rn, procLabel: ptView(pt3).procLabel, cls: worst, count: ms.length, last: ms[ms.length - 1].text, at: ms[ms.length - 1].at, unscreened: ms.some(function (x) { return x.unscreened; }), clinical: ms.some(function (x) { return (x.flags || []).join(' ').indexOf('clinical judgement') >= 0; }), forOwner: (function () { var o = ms.map(function (x) { return x.forOwner; }).filter(Boolean).slice(-1)[0]; return o ? (OWNERS[o] || o) : ''; })() });
    });
    items.sort(function (a, b) { return urgentRank[b.cls] - urgentRank[a.cls] || a.at - b.at; });
    return send(res, 200, items);
  }
  if (m === 'GET' && p === '/api/alerts') return send(res, 200, store.db.alerts.slice().reverse().slice(0, 100).map(function (a) { var pt4 = store.db.patients.find(function (x) { return x.id === a.pid; }) || {}; return Object.assign({}, a, { name: pt4.name, rn: pt4.rn }); }));
  var am = p.match(/^\/api\/alerts\/([a-f0-9]+)\/ack$/);
  if (m === 'POST' && am) { var al = store.db.alerts.find(function (x) { return x.id === am[1]; }); if (!al) return send(res, 404, { error: 'not_found' }); al.ackBy = user.name; al.ackAt = Date.now(); audit(user.username, 'acknowledged alert'); store.save(); return send(res, 200, { ok: true }); }

  // ---- rules (doctor only to change) ----
  if (m === 'GET' && p === '/api/rules') return send(res, 200, store.db.rules);
  if (m === 'POST' && p === '/api/rules/pathway') {
    if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' });
    var pw = body.pathway; if (!pw || !Array.isArray(pw.shared) || typeof pw.procedures !== 'object') return send(res, 400, { error: 'bad_pathway' });
    function cleanItems(arr) { return (Array.isArray(arr) ? arr : []).slice(0, 60).map(function (x) { return { title: String(x.title || '').trim().slice(0, 120), owner: OWNERS[x.owner] ? x.owner : 'ward_nurse', due: Math.max(-90, Math.min(365, Math.round(Number(x.due) || 0))), kind: String(x.kind || 'review').slice(0, 20) }; }).filter(function (x) { return x.title; }); }
    var next = { shared: cleanItems(pw.shared), procedures: {} };
    Object.keys(pw.procedures).slice(0, 30).forEach(function (k) { if (!/^[A-Z0-9_]{2,20}$/.test(k)) return; var pr = pw.procedures[k]; next.procedures[k] = { label: String(pr.label || k).slice(0, 60), items: cleanItems(pr.items) }; });
    if (!Object.keys(next.procedures).length) return send(res, 400, { error: 'no_procedures' });
    store.db.rules.pathway = next; audit(user.username, 'edited pathway rules (applies to new patients)'); store.save(); return send(res, 200, { ok: true });
  }
  if (m === 'POST' && p === '/api/rules/redflag') {
    if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' });
    var ph = String(body.phrase || '').trim().toLowerCase().slice(0, 80), cl = body.cls === 'EMERGENCY' ? 'EMERGENCY' : 'SAME-DAY';
    if (ph.length < 3) return send(res, 400, { error: 'phrase', message: 'Phrase too short (at least 3 characters).' });
    store.db.rules.redflags.push({ id: uid(), phrase: ph, cls: cl, note: String(body.note || '').slice(0, 120), addedBy: user.name, at: Date.now() }); audit(user.username, 'added red-flag phrase "' + ph + '" -> ' + cl); store.save(); return send(res, 200, { ok: true });
  }
  var dm = p.match(/^\/api\/rules\/redflag\/([a-f0-9]+)\/delete$/);
  if (m === 'POST' && dm) { if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' }); store.db.rules.redflags = store.db.rules.redflags.filter(function (x) { return x.id !== dm[1]; }); audit(user.username, 'removed a red-flag phrase'); store.save(); return send(res, 200, { ok: true }); }
  if (m === 'POST' && p === '/api/rules/faq') {
    if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' });
    var kws = String(body.keywords || '').split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(function (x) { return x.length >= 3; }).slice(0, 10), ans = String(body.answer || '').trim().slice(0, 500);
    if (!kws.length) return send(res, 400, { error: 'keywords', message: 'Add at least one keyword of 3+ characters, separated by commas.' });
    if (ans.length < 10) return send(res, 400, { error: 'answer', message: 'Write the approved answer (at least a sentence).' });
    store.db.rules.faqs.push({ id: uid(), keywords: kws, answer: ans, addedBy: user.name, at: Date.now() }); audit(user.username, 'added approved answer for "' + kws.join(', ') + '"'); store.save(); return send(res, 200, { ok: true });
  }
  var fm = p.match(/^\/api\/rules\/faq\/([a-f0-9]+)\/delete$/);
  if (m === 'POST' && fm) { if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' }); store.db.rules.faqs = store.db.rules.faqs.filter(function (x) { return x.id !== fm[1]; }); audit(user.username, 'removed an approved answer'); store.save(); return send(res, 200, { ok: true }); }
  if (m === 'POST' && p === '/api/rules/apply') {          // add this pathway's current items to an existing patient (only items not already there)
    if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' });
    var tgt = store.db.patients.find(function (x) { return x.id === body.pid && x.active; }); if (!tgt) return send(res, 404, { error: 'not_found' });
    var have = {}; store.db.tasks.forEach(function (t) { if (t.pid === tgt.id) have[t.title] = 1; });
    var added = 0, ot2 = otTime(tgt.otDate); pathwayFor(tgt.procedure).forEach(function (it) { if (!have[it.title]) { store.db.tasks.push({ id: uid(), pid: tgt.id, title: it.title, owner: it.owner, kind: it.kind, due: it.due, dueAt: ot2 + it.due * DAY, state: 'open', createdAt: Date.now() }); added++; } });
    audit(user.username, 'applied pathway to ' + tgt.rn + ' (+' + added + ')'); store.save(); return send(res, 200, { added: added });
  }

  // ---- clinic answer library (v2): everyone can read; a doctor approves, switches off or puts back to draft ----
  if (m === 'GET' && p === '/api/answers') return send(res, 200, { useDrafts: !!store.db.settings.useDraftAnswers, topics: ANS.TOPICS.map(function (t) { var st = store.db.rules.answerState[t.id] || {}; return { id: t.id, title: t.title, owner: OWNERS[t.owner] || t.owner, staff: !!t.staff, status: st.status || 'draft', by: st.by || '', at: st.at || 0, text: ANS.text(t, 'en', store.db.settings) }; }) });
  var anm = p.match(/^\/api\/answers\/([a-z_]+)\/(approve|off|draft)$/);
  if (m === 'POST' && anm) {
    if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' });
    if (!ANS.byId(anm[1])) return send(res, 404, { error: 'not_found' });
    store.db.rules.answerState[anm[1]] = { status: anm[2] === 'approve' ? 'approved' : anm[2], by: user.name, at: Date.now() };
    audit(user.username, 'answer "' + anm[1] + '" set to ' + anm[2]); store.save(); return send(res, 200, { ok: true });
  }

  // ---- settings, users, AI ----
  if (m === 'POST' && p === '/api/settings') {
    if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' });
    ['clinicPhone', 'sessionsText'].forEach(function (k) { if (typeof body[k] === 'string' && body[k].trim()) store.db.settings[k] = body[k].trim().slice(0, 160); });
    if (body.maxCasesPerDay !== undefined) { var mc = Math.round(Number(body.maxCasesPerDay)); if (!(mc >= 1 && mc <= 50)) return send(res, 400, { error: 'max', message: 'Cases per day: 1 to 50.' }); store.db.settings.maxCasesPerDay = mc; }
    if (typeof body.demoBanner === 'boolean') store.db.settings.demoBanner = body.demoBanner;
    if (body.emergencyNumber !== undefined) { var en = String(body.emergencyNumber).trim(); if (!/^\d{3,6}$/.test(en)) return send(res, 400, { error: 'emergency', message: 'Emergency number: 3 to 6 digits (for example 999, or 998 for an ambulance in the UAE).' }); store.db.settings.emergencyNumber = en; }
    if (typeof body.useDraftAnswers === 'boolean') store.db.settings.useDraftAnswers = body.useDraftAnswers;
    audit(user.username, 'edited settings'); store.save(); return send(res, 200, { ok: true });
  }
  if (m === 'GET' && p === '/api/users') { if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' }); return send(res, 200, store.db.users.map(function (x) { return { username: x.username, name: x.name, role: x.role }; })); }
  if (m === 'POST' && p === '/api/users') {
    if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' });
    var un = String(body.username || '').toLowerCase().trim(), pw2 = String(body.password || '');
    if (!/^[a-z0-9._-]{3,20}$/.test(un)) return send(res, 400, { error: 'username', message: 'Username: 3 to 20 letters, digits, dot, dash.' });
    if (pw2.length < 8) return send(res, 400, { error: 'password', message: 'Password: at least 8 characters.' });
    if (store.db.users.some(function (x) { return x.username === un; })) return send(res, 400, { error: 'username', message: 'That username exists.' });
    store.db.users.push(mkUser(un, String(body.name || un).slice(0, 40), body.role === 'doctor' ? 'doctor' : 'nurse', pw2)); audit(user.username, 'added user ' + un); store.save(); return send(res, 200, { ok: true });
  }
  if (m === 'POST' && p === '/api/password') {
    var np = String(body.password || ''); if (np.length < 8) return send(res, 400, { error: 'password', message: 'At least 8 characters.' });
    user.salt = crypto.randomBytes(12).toString('hex'); user.hash = hash(np, user.salt); audit(user.username, 'changed password'); store.save(); return send(res, 200, { ok: true });
  }
  if (m === 'POST' && p === '/api/ai/test') {
    if (!aiConfigured()) return send(res, 200, { ok: false, message: 'No AI provider is set on the server (PROVIDER_BASE_URL and PROVIDER_KEY). The system works without it, using rules only.' });
    var s1 = await secondCheck('my leg feels strange and tight since this morning', 'test');
    var r1 = await aiReply('hello', [], 'en', 'test');
    return send(res, 200, { ok: s1.verdict !== 'unscreened', secondCheck: s1.verdict, reply: r1.text || '(blocked by the output guard or unavailable: the fixed message would be used)' });
  }
  if (m === 'GET' && p === '/api/audit') { if (!needDoctor(user)) return send(res, 403, { error: 'doctor_only' }); return send(res, 200, store.db.audit.slice(-200).reverse()); }
  return send(res, 404, { error: 'not_found' });
}

function createServer() {
  init();
  return http.createServer(function (req, res) { route(req, res).catch(function (e) { console.log('error', e && e.message); try { send(res, 500, { error: 'server_error' }); } catch (x) { /* ignore */ } }); });
}
module.exports = { createServer: createServer, init: init, store: store, drain: drain };
if (require.main === module) {
  createServer().listen(PORT, function () {
    console.log('PeriLoop Console: http://localhost:' + PORT + '   (staff)');
    console.log('AI: ' + (aiConfigured() ? 'on (' + process.env.PROVIDER_BASE_URL + ')' : 'off, rules only. Set PROVIDER_BASE_URL, PROVIDER_KEY, PROVIDER_MODEL to turn it on.'));
    console.log('Demo logins: doctor / doctor-demo-1   nurse / nurse-demo-1   (synthetic data only; change them in Settings)');
    console.log('Data file: ' + store.file);
  });
}
