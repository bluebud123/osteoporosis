'use strict';
/* v3: what patients are told when the clinic phone or hours have NOT been set yet.
 * Before v3 the defaults were literal strings ("03-0000 0000 (set in Settings)", "Set the clinic hours in Settings") and they
 * were shown to patients inside replies. Now an unset phone becomes a plain phrase in the patient's language, and an unset
 * hours text is left out of the sentence. Nothing here invents a number. */
var LEGACY = /set in Settings|Set the clinic hours/i;
function unset(v) { return !v || !String(v).trim() || LEGACY.test(String(v)); }
var PHONE = { en: 'the clinic number on your appointment card', ms: 'nombor klinik pada kad temu janji anda', zh: '预约卡上的诊所电话', ar: 'رقم العيادة المكتوب في بطاقة موعدك' };
var MARK = '§S§';
// Settings as a patient-facing text may use them, for one language.
function forPatient(s, lang) {
  s = s || {};
  return Object.assign({}, s, { clinicPhone: unset(s.clinicPhone) ? (PHONE[lang] || PHONE.en) : String(s.clinicPhone).trim(), sessionsText: unset(s.sessionsText) ? MARK : String(s.sessionsText).trim(), emergencyNumber: s.emergencyNumber || '999' });
}
// Remove the "hours not set" marker together with the brackets or full stop around it.
function tidy(str) {
  return String(str).replace(/\s*[(（]\s*§S§\s*[)）]/g, '').replace(/§S§\s*[.。]\s*/g, '').replace(/§S§/g, '').replace(/ {2,}/g, ' ').replace(/\s+([.,;])/g, '$1').trim();
}
module.exports = { unset: unset, forPatient: forPatient, tidy: tidy, DEMO_PHONE: '555-0100 (fictional demo line)', DEMO_HOURS: 'Demo clinic hours: Sunday to Thursday, 8am to 4pm' };
