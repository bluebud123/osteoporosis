'use strict';
/* v4: the patient profile memory. What a patient says about themselves in chat (conditions, medicines, worries, home,
 * preferences, the operation) is PROPOSED to staff with the patient's exact words. A doctor or nurse confirms or dismisses
 * each item. Only confirmed items are used, and only in three places:
 *   1. shown to staff on the patient page,
 *   2. added to the facts the AI sees when it drafts a reply for STAFF to edit (never the patient chat),
 *   3. a small fixed table that can RAISE a routine message to SAME-DAY (never lower).
 * Nothing here is shown to the patient: the chat link is the patient's only identity, so the chat must not recite a profile.
 * Every item is "patient-reported": confirming it means "we heard this", not "this is medically verified". */
var CATS = { condition: 'Condition', medicine: 'Medicine', allergy: 'Allergy', worry: 'Worry', goal: 'Goal', home: 'Home and support', preference: 'Preference', periop: 'Around the operation' };
function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9À-￿]+/g, ' ').trim(); }

/* The model's answer is untrusted. Keep an item only if: the category is known, the fact is short plain text, and the
 * quote really is in the patient's message (so the model cannot invent a fact the patient never wrote). */
function parse(out, message) {
  var m = String(out || '').match(/\[[\s\S]*\]/); if (!m) return [];
  var arr; try { arr = JSON.parse(m[0]); } catch (e) { return []; }
  if (!Array.isArray(arr)) return [];
  var msg = norm(message), keep = [];
  arr.slice(0, 6).forEach(function (o) {
    if (!o || typeof o !== 'object' || !CATS[o.cat]) return;
    var text = String(o.fact || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120), quote = String(o.quote || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (text.length < 3 || norm(quote).length < 3 || msg.indexOf(norm(quote)) < 0) return;
    if (/\b(you should|must|stop taking|start taking|increase|reduce the dose|diagnos)/i.test(text)) return;   // a remembered fact is never an instruction
    if (keep.some(function (k) { return k.cat === o.cat && norm(k.text) === norm(text); })) return;
    keep.push({ cat: o.cat, text: text, quote: quote });
  });
  return keep.slice(0, 4);
}
// Already known (in any state, including dismissed, so a dismissed item is not proposed again)?
function known(list, item) { return (list || []).some(function (x) { return x.cat === item.cat && norm(x.text) === norm(item.text); }); }
function confirmed(list) { return (list || []).filter(function (x) { return x.status === 'confirmed'; }); }
// One line for the staff-side AI (reply drafts and the staff summary). Confirmed items only.
function factsLine(list) {
  var c = confirmed(list); if (!c.length) return 'Patient-reported, confirmed by staff: none';
  return 'Patient-reported, confirmed by staff (not medically verified): ' + c.map(function (x) { return CATS[x.cat] + ': ' + x.text; }).join('; ');
}
/* Raise-only links between a confirmed fact and a new message. Drafted by an AI, awaiting clinician sign-off. English only.
 * Each row: which confirmed facts it needs, what the new message must mention, and the reason shown to staff. */
var LINKS = [
  { id: 'thinner_bleeding', cats: ['medicine'], fact: /\b(warfarin|apixaban|rivaroxaban|dabigatran|edoxaban|enoxaparin|clexane|heparin|eliquis|xarelto|pradaxa|blood thinner|blood-thinner|anticoagulant)/i,
    msg: /\b(bleed|bleeding|blood|bruis\w*|nosebleed|nose bleed|black stool|tarry|gums?)\b/i, not: /\b(no|not|without|stopped)\s+(more\s+|any\s+)?(bleed|bleeding|blood|bruis\w*)\b|\bblood (test|thinner|pressure|sugar)\b/i,
    reason: 'the patient has said they take a blood thinner, and this message mentions bleeding or bruising' },
  { id: 'thinner_fall', cats: ['medicine'], fact: /\b(warfarin|apixaban|rivaroxaban|dabigatran|edoxaban|enoxaparin|clexane|heparin|eliquis|xarelto|pradaxa|blood thinner|blood-thinner|anticoagulant)/i,
    msg: /\b(fell|fall|fallen|slipped|hit my head|knocked my head|bumped my head)\b/i, not: /\b(did ?n[o']?t|never|no)\s+(fall|fell|slip)/i,
    reason: 'the patient has said they take a blood thinner, and this message mentions a fall or a knock' },
  { id: 'diabetes_wound', cats: ['condition'], fact: /\b(diabet\w*|high sugar|kencing manis)\b/i,
    msg: /\b(wound|cut|incision|stitches|staples|scar)\b.*\b(red|redness|ooz\w*|leak\w*|open\w*|smell\w*|pus|wet|weep\w*)\b|\b(red|redness|ooz\w*|leak\w*|smell\w*|pus|weep\w*)\b.*\b(wound|cut|incision|stitches|staples)\b/i, not: /\b(no|not|without)\s+(redness|red|smell|pus|leak\w*|ooz\w*)\b/i,
    reason: 'the patient has said they have diabetes, and this message describes a change at the wound' }
];
function raise(list, message) {
  var c = confirmed(list), t = String(message || '');
  for (var i = 0; i < LINKS.length; i++) {
    var L = LINKS[i]; if (L.not && L.not.test(t)) continue; if (!L.msg.test(t)) continue;
    var f = c.find(function (x) { return L.cats.indexOf(x.cat) >= 0 && L.fact.test(x.text); });
    if (f) return { id: L.id, reason: L.reason, fact: f.text };
  }
  return null;
}
module.exports = { CATS: CATS, parse: parse, known: known, confirmed: confirmed, factsLine: factsLine, raise: raise, LINKS: LINKS, norm: norm };
