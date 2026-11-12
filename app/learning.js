'use strict';
/* v5 (stage 1): how the assistant gets better at THIS clinic without changing itself.
 *
 *   signals  -> what staff corrected: a draft they rewrote, a patient fact they dismissed, an alert a doctor marked
 *               "not urgent", a message a doctor said should have alerted, a patient question with no clinic answer.
 *   lessons  -> short sentences. The AI may PROPOSE one from the signals; a doctor approves, edits or rejects it.
 *               Only approved lessons are used. Every lesson keeps where it came from and who approved it.
 *   index    -> each lesson has topic tags. For one patient message only the few lessons whose tags match are given
 *               to the AI, so the playbook can grow without making every prompt longer.
 *
 * Stage 1 limits, on purpose: lessons shape the reply drafts written FOR STAFF and what is proposed for the patient
 * profile. They do not change triage, the fixed patient texts, or the patient chat. Lessons about triage are kept as
 * observations for the doctor (tag "triage") and are never sent to the AI. */
var TAGS = {
  tone: { label: 'Tone and wording', always: true },
  wound: { label: 'Wound and dressing', kw: /wound|dressing|stitch|staple|scar|bandage|plaster|pus|ooz|leak/i },
  fever: { label: 'Fever and infection', kw: /fever|temperature|chills|shiver|infect/i },
  pain: { label: 'Pain', kw: /pain|painkiller|sore|ache|hurts?/i },
  medicine: { label: 'Medicines', kw: /tablet|medicine|medication|pill|dose|antibiotic|paracetamol|panadol|tramadol|oxycodone|vitamin|supplement/i },
  thinner: { label: 'Blood thinners', kw: /warfarin|blood thinner|clexane|apixaban|rivaroxaban|heparin|injection/i },
  swelling: { label: 'Swelling and bruising', kw: /swell|swollen|calf|bruis|puffy/i },
  mobility: { label: 'Walking and physiotherapy', kw: /walk|physio|exercise|stairs|frame|crutch|stick|bend|kneel|stiff/i },
  washing: { label: 'Washing', kw: /\b(shower|showering|bath|bathe|wash|washing|wet|waterproof)\b/i },
  travel: { label: 'Driving and travel', kw: /\b(drive|driving|fly|flying|flight|travel|car|umrah)\b/i },
  admission: { label: 'Admission and the day of surgery', kw: /\b(fast|fasting|eat|eating|drink|bring|admission|admitted|ward|warded|visit|visiting|pack|packed|midnight)\b|anaesth/i },
  admin: { label: 'Appointments and paperwork', kw: /appointment|parking|cost|insurance|form|\bmc\b|letter|reschedul|claim/i },
  feelings: { label: 'Worries and feelings', kw: /scared|afraid|worried|nervous|anxious|sad|lonely|sleep|fear/i },
  home: { label: 'Home and family', kw: /\b(alone|carer|daughter|son|wife|husband|home|family)\b/i },
  profile: { label: 'What to remember about patients' },
  triage: { label: 'Triage observation (does not change triage)' }
};
var SIGNAL_LABEL = { draft_edit: 'Staff rewrote an AI draft', memory_dismissed: 'Staff dismissed a proposed patient fact', alert_not_urgent: 'A doctor marked an alert as not urgent', missed_alert: 'A doctor said a message should have raised an alert', unanswered: 'A patient question had no clinic answer' };
function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }
function tagsFor(text) { var t = String(text || ''); return Object.keys(TAGS).filter(function (k) { return TAGS[k].kw && TAGS[k].kw.test(t); }); }
function clean(s, n) { return String(s == null ? '' : s).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n); }
function okTags(tags) { return (Array.isArray(tags) ? tags : []).map(String).filter(function (t, i, a) { return TAGS[t] && a.indexOf(t) === i; }).slice(0, 4); }
// A lesson is about wording and what to mention. It may never carry a dose, a medicine instruction or reassurance.
var FORBID = /\b\d+\s?(mg|ml|mcg|tablets?|pills?|capsules?)\b|\b(stop|start|skip|double|increase|reduce|restart)\b[^.]{0,30}\b(taking|dose|medicine|medication|tablet|warfarin|blood thinner|antibiotic|painkiller)|\b(is|are|it'?s)\s+(completely\s+|perfectly\s+)?(normal|safe|nothing to worry)\b|\bno need to (worry|call|come)\b/i;
function lessonOk(text) { return text.length >= 12 && text.length <= 240 && !FORBID.test(text); }

function addSignal(db, s) {
  db.signals = db.signals || [];
  var sig = Object.assign({ id: require('crypto').randomBytes(6).toString('hex'), at: Date.now(), processed: false }, s);
  sig.tags = tagsFor((s.text || '') + ' ' + (s.sent || '')); db.signals.push(sig);
  if (db.signals.length > 600) db.signals.splice(0, db.signals.length - 600);
  return sig;
}
// Text of the unprocessed signals for the AI, numbered from 1. Returns { text, used: [signal] }.
function signalsForAI(db, max) {
  var used = (db.signals || []).filter(function (s) { return !s.processed; }).slice(0, max || 25);
  var text = used.map(function (s, i) {
    var n = (i + 1) + '. [' + s.type + '] ';
    if (s.type === 'draft_edit') return n + 'PATIENT WROTE: ' + clean(s.text, 200) + ' | DRAFT: ' + clean(s.draft, 300) + ' | SENT: ' + clean(s.sent, 300);
    if (s.type === 'memory_dismissed') return n + 'PATIENT WROTE: ' + clean(s.quote, 200) + ' | PROPOSED FACT (dismissed): ' + clean(s.fact, 120);
    if (s.type === 'alert_not_urgent') return n + 'ALERT (' + s.cls + ', ' + clean(s.reason, 100) + ') on: ' + clean(s.text, 200) + ' | DOCTOR: not urgent';
    if (s.type === 'missed_alert') return n + 'NO ALERT on: ' + clean(s.text, 200) + ' | DOCTOR: should have raised an alert';
    return n + 'NO CLINIC ANSWER for: ' + clean(s.text, 200);
  }).join('\n');
  return { text: text, used: used };
}
/* The model's proposals are untrusted. Keep one only if it is a short allowed sentence, has known tags, and names at
 * least one real correction it is based on (so it cannot invent a lesson from nothing). */
function parseProposals(out, used) {
  var m = String(out || '').match(/\[[\s\S]*\]/); if (!m) return [];
  var arr; try { arr = JSON.parse(m[0]); } catch (e) { return []; }
  if (!Array.isArray(arr)) return [];
  var keep = [];
  arr.slice(0, 8).forEach(function (o) {
    if (!o || typeof o !== 'object') return;
    var text = clean(o.lesson, 240), tags = okTags(o.tags);
    var based = (Array.isArray(o.basedOn) ? o.basedOn : []).map(Number).filter(function (n, i, a) { return n >= 1 && n <= used.length && n === Math.floor(n) && a.indexOf(n) === i; });
    if (!lessonOk(text) || !tags.length || !based.length) return;
    if (based.some(function (n) { var t = used[n - 1].type; return t === 'alert_not_urgent' || t === 'missed_alert'; })) tags = ['triage'];   // triage patterns are observations only
    if (keep.some(function (k) { return norm(k.text) === norm(text); })) return;
    keep.push({ text: text, tags: tags, basedOn: based.map(function (n) { return used[n - 1].id; }), example: clean(used[based[0] - 1].text || used[based[0] - 1].quote, 160) });
  });
  return keep.slice(0, 5);
}
function approved(db) { return (db.lessons || []).filter(function (l) { return l.status === 'approved'; }); }
// The index: approved lessons whose tags match the message, best match first, newest first. "tone" lessons always qualify.
function retrieve(db, text, n) {
  var mt = tagsFor(text);
  return approved(db).filter(function (l) { return l.tags.indexOf('triage') < 0 && l.tags.some(function (t) { return t !== 'profile'; }); }).map(function (l) {
    var score = l.tags.filter(function (t) { return mt.indexOf(t) >= 0; }).length * 2 + (l.tags.indexOf('tone') >= 0 ? 1 : 0);
    return { l: l, score: score };
  }).filter(function (x) { return x.score > 0; }).sort(function (a, b) { return b.score - a.score || b.l.approvedAt - a.l.approvedAt; }).slice(0, n || 5).map(function (x) { return x.l; });
}
function forProfile(db, n) { return approved(db).filter(function (l) { return l.tags.indexOf('profile') >= 0; }).sort(function (a, b) { return b.approvedAt - a.approvedAt; }).slice(0, n || 5); }
function block(list) { return list.map(function (l) { return '- ' + l.text; }).join('\n'); }

// Numbers for the system report: what went wrong and how often, for the doctor and the developer. No AI involved.
function report(db, since) {
  var S = (db.signals || []).filter(function (s) { return !since || s.at >= since; }), M = (db.messages || []).filter(function (m) { return !since || m.at >= since; });
  var pm = M.filter(function (m) { return m.who === 'patient'; }), al = (db.alerts || []).filter(function (a) { return !since || a.at >= since; });
  function count(t) { return S.filter(function (s) { return s.type === t; }).length; }
  var mem = []; (db.patients || []).forEach(function (p) { (p.memory || []).forEach(function (x) { if (!since || x.at >= since) mem.push(x); }); });
  var un = S.filter(function (s) { return s.type === 'unanswered'; }), byTag = {};
  un.forEach(function (s) { (s.tags.length ? s.tags : ['other']).forEach(function (t) { byTag[t] = (byTag[t] || 0) + 1; }); });
  var D = db.learnStats || {};
  return {
    patientMessages: pm.length,
    alerts: al.length, emergencies: al.filter(function (a) { return a.cls === 'EMERGENCY'; }).length,
    alertsMarkedNotUrgent: count('alert_not_urgent'), messagesThatShouldHaveAlerted: count('missed_alert'),
    aiCheckUnavailable: pm.filter(function (m) { return m.unscreened; }).length,
    draftsRequested: D.draftsRequested || 0, draftsSentUnchanged: D.draftsUnchanged || 0, draftsRewritten: count('draft_edit'),
    profileProposed: mem.filter(function (x) { return /^AI/.test(x.by || ''); }).length, profileConfirmed: mem.filter(function (x) { return x.status === 'confirmed' && /^AI/.test(x.by || ''); }).length, profileDismissed: mem.filter(function (x) { return x.status === 'dismissed'; }).length,
    unansweredQuestions: un.length,
    unansweredByTopic: Object.keys(byTag).map(function (t) { return { tag: t, label: (TAGS[t] || {}).label || 'Other', count: byTag[t] }; }).sort(function (a, b) { return b.count - a.count; }),
    unansweredRecent: un.slice(-12).reverse().map(function (s) { return { text: s.text, at: s.at, tags: s.tags }; }),
    lessons: { proposed: (db.lessons || []).filter(function (l) { return l.status === 'proposed'; }).length, approved: approved(db).length, retired: (db.lessons || []).filter(function (l) { return l.status === 'retired' || l.status === 'rejected'; }).length },
    newSignals: (db.signals || []).filter(function (s) { return !s.processed; }).length
  };
}
module.exports = { TAGS: TAGS, SIGNAL_LABEL: SIGNAL_LABEL, tagsFor: tagsFor, okTags: okTags, lessonOk: lessonOk, clean: clean, norm: norm, addSignal: addSignal, signalsForAI: signalsForAI, parseProposals: parseProposals, retrieve: retrieve, forProfile: forProfile, block: block, report: report, approved: approved };
