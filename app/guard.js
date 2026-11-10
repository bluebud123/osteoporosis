'use strict';
/* Chat output guard (v2). Every model-written patient reply passes here before anyone sees it.
 * The original guard (lib/adapter.js, unchanged and still run first) accepts only a question, a restatement of the
 * patient's words, or a redirect. On a held-out set it blocked 30 of 30 unsafe replies but also 19 of 20 harmless ones,
 * so with AI on, patients still got the fixed handover text almost every time.
 * v2 keeps every block rule of the original and adds one allowance and two blocks:
 *   + a sentence the original rejected ONLY for "not a question or summary" is kept if every word in it is either the
 *     patient's own or on a short list of receptionist words (passed, noted, team, sorry to hear ...). No clinical word
 *     is on that list. A sentence that fails this test is dropped; the rest of the reply can still be shown.
 *   - a promise of when staff will act ("the team will call you within the hour") is blocked.
 *   - a claim about what staff said or decided ("the doctor said you can go home") is blocked.
 * Any other failure (advice, reassurance, diagnosis, medicine, dose, invented number) blocks the whole reply as before. */
var A = require('./lib/adapter.js');

var SAFE = ('the and for you your yours our with that this these those are was were been have has had not but can could will would may from into about any all also just here there what which who how when where why please yes okay sure than then them they their its it\'s i\'ve i\'ll i\'m i\'d you\'re you\'ve you\'d that\'s let lets ' +
  'hello thanks thank welcome sorry course understand understood hear heard know see feel feeling felt before after don\'t can\'t won\'t doesn\'t isn\'t haven\'t didn\'t very really letting out off got get getting ' +
  'passed pass passing noted note added add saved save told tell asked ask shared share sent send forwarded forward flagged flag recorded record records logged ' +
  'message messages question questions request requests update updates note notes details detail information info name names ' +
  'clinic ward team teams staff nurse nurses doctor doctors surgeon clinician clinicians physiotherapy physiotherapist physio admin administration coordinator anaesthetic reception receptionist person people someone ' +
  'handles handle handled arranges arrange arranged confirms confirm confirmed reads read answer answers answering reply replies look looks check checks help helps helping show shows ' +
  'one ones thing things something anything else more other another next first also still now ' +
  'checklist list pending outstanding operation surgery appointment appointments date dates follow-up follow assistant computer program text clinic\'s ' +
  'like want wants need needs prefer suit suits worries worry worrying most much many time times day days rearrange rebook resend again ' +
  'pre-op post-op apa-apa sampaikan saya anda kami kita dan yang untuk dengan ini itu telah sudah akan boleh tidak ada apa bila mana siapa bagaimana terima kasih maaf faham gembira baik soalan mesej pasukan klinik wad jururawat doktor fisioterapi pentadbiran disampaikan dicatat direkodkan kepada mereka lagi lain paling tentang sama-sama').split(/\s+/);
var SAFE_SET = {}; SAFE.forEach(function (w) { SAFE_SET[w] = 1; });
var ZH_OK = /^(?:[，,。！!？?\s]|可以理解|我明白|我理解|明白了|很抱歉|抱歉|不客气|谢谢您?(?:告诉我|的消息|的更新)?|很高兴(?:听到)?|手术前|紧张|担心|是|的|我已(?:经)?(?:把您的(?:问题|消息))?(?:转给|告诉|记录|转达)(?:了)?(?:诊所|病房|物理治疗|行政|护理)?(?:团队|护士)?|您的(?:问题|消息)|我是诊所的文字助手|一个电脑程序)+$/;
var PROMISE = /\b(?:team|clinician|doctor|surgeon|nurse|physio\w*|someone|somebody|staff|they|we|i)\b[^.?!]{0,50}\b(?:will|shall|going to|is going to|are going to)\b[^.?!]{0,50}\b(?:call|ring|phone|reply|respond|contact|get back|be in touch|see you|visit|message)\b[^.?!]{0,40}\b(?:within|in (?:a|an|the|\d+|one|two|a few|few) |shortly|soon|today|tonight|tomorrow|right away|straight away|immediately|asap|this (?:morning|afternoon|evening)|by \w+day)\b|(?:akan|会)[^.?!。]{0,20}(?:hubungi|telefon|balas|联系|回复|打电话)[^.?!。]{0,20}(?:segera|sebentar lagi|hari ini|esok|dalam masa|马上|很快|今天|明天|小时内)/i;
var THIRD = /\b(?:doctor|surgeon|nurse|team|physio\w*|clinician|anaesthetist)\b[^.?!]{0,15}\b(?:said|says|told|thinks|confirmed|decided|agreed|approved|wants you to|recommends?)\b|(?:doktor|pakar bedah|jururawat)[^.?!]{0,10}(?:kata|cakap|beritahu|sahkan)|(?:医生|护士)(?:说|表示|确认|决定)/i;

// An opinion on the patient's body or a forecast, in words the original guard does not list ("your wound sounds fine", "this will pass").
var VERDICT = /\b(?:your|the|that|this|it|they|those|everything|all)\b[^.?!]{0,30}\b(?:looks?|sounds?|seems?|appears?|is|are|should be|will be|must be)\s+(?:\w+ )?(?:fine|good|great|ok|okay|normal|healthy|well|better|nothing|alright|all right|usual|typical|minor|mild|harmless)\b|\bwill (?:soon )?(?:pass|settle|improve|ease|get better|go away|heal|be fine|be ok|be okay|clear up|go down|resolve)\b|\b(?:on the mend|healing (?:well|nicely)|doing (?:well|great|fine)|right on track|on track)\b|akan (?:hilang|baik|sembuh|pulih|reda)|nampak (?:ok|baik|elok)|会(?:好|消|退|恢复)|看起来(?:不错|很好|正常|没事)/i;
// An instruction to the patient. Only "call / contact / go to the Emergency Department / ask / tell / message" are allowed as commands.
var IMPERATIVE = /(?:^|[.!?]\s+)(?:please |just |simply |then |and |also |in the meantime,? |meanwhile,? |for now,? )*(?:stop|start|take|keep|use|apply|put|try|rest|avoid|eat|drink|wait|stay|elevate|ice|raise|lift|walk|do not|don'?t|never|continue|skip|make sure|remember to|have|get some|give it|leave|change|remove|wash|clean|cover|massage|stretch|bend|sleep|sit|lie|wear|hold|press|increase|reduce|drink)\b(?! (?:not )?hesitate)|(?:^|[.!?]\s+)(?:sila |tolong )?(?:jangan|teruskan|ambil|makan|minum|rehat|letak|angkat|sapu|pakai|tunggu|elak|berhenti|kurangkan)\b|(?:^|[。！？])(?:请)?(?:不要|别|继续|多|少|抬高|冰敷|休息|停止|服用|吃|喝|等)/i;
function split(r) { return String(r).split(/\n+/).reduce(function (a, line) { return a.concat(line.split(/(?<=[.!?。！？؟])\s*(?=\S)/)); }, []).map(function (s) { return s.trim(); }).filter(Boolean); }
function words(s) { return (String(s).toLowerCase().match(/[a-zà-ɏ][a-zà-ɏ'’-]*/g) || []).map(function (w) { return w.replace(/’/g, "'").replace(/^['-]+|['-]+$/g, ''); }).filter(Boolean); }
// The allowance is only for sentences where the ASSISTANT or the STAFF is the subject, or a fixed courtesy phrase.
// A sentence about the patient's body ("Your knee looks good", "It will pass") can never use it.
var SUBJECT_OK = /^(?:i\b|i['’](?:ve|ll|m|d)\b|we\b|we['’](?:ve|ll)\b|(?:the|your|our) (?:clinic|ward|admin|physiotherapy|physio|anaesthetic|care|pre-op)\b|your (?:physiotherapist|surgeon|nurse|doctor)\b|that['’]s one for\b|thanks?\b|thank you\b|sorry\b|hello\b|hi\b|saya\b|kami\b|terima kasih\b|maaf\b|pasukan\b)/i;
var COURTESY = /^(?:(?:that['’]s |that is |so )?(?:sorry|glad|good|great|happy|pleased|nice) to hear(?: that| it| this)?|good question|great question|no problem|of course|you['’]re (?:very |most )?welcome|message (?:us |me )?any ?time|it(?:['’]s| is) (?:completely |very |quite |really )?understandable (?:to feel|to be|that you feel|that you are|that you['’]re) (?:\w+ ){0,2}?\w+(?: before (?:an? |the |your )?(?:operation|surgery|anaesthetic))?(?=[\s,.!]*$))[\s,.!]*/i;
function receptionOnly(s, patientText) {
  var m = s.match(COURTESY);
  if (m) { s = s.slice(m[0].length).replace(/^(?:and|but|so)\s+/i, ''); if (!s.trim()) return true; }
  else if (!/[一-鿿]/.test(s) && !SUBJECT_OK.test(s)) return false;
  if (m && !/[一-鿿]/.test(s) && !SUBJECT_OK.test(s) && !/^(?:the|your)\b/i.test(s)) return false;
  if (/\d/.test(s)) return false;
  if (/[؀-ۿ]/.test(s)) return false;                         // Arabic: no word list yet, so not allowed by this route
  if (/[一-鿿]/.test(s)) return ZH_OK.test(s.replace(/\s+/g, ''));
  var src = words(patientText);
  return words(s).every(function (w) {
    if (w.length < 3 || SAFE_SET[w]) return true;
    return src.some(function (x) { return x === w || (x.length >= 4 && w.length >= 4 && x.slice(0, 4) === w.slice(0, 4)); });
  });
}
function check(reply, patientText) {
  var r = String(reply == null ? '' : reply).replace(/\s+/g, ' ').trim();
  if (!r) return { ok: false, reason: 'empty' };
  if (r.length > 600) return { ok: false, reason: 'too_long' };
  if (PROMISE.test(r)) return { ok: false, reason: 'promise_of_time' };
  if (THIRD.test(r)) return { ok: false, reason: 'claim_about_staff' };
  if (VERDICT.test(r)) return { ok: false, reason: 'verdict_or_forecast' };
  if (IMPERATIVE.test(r)) return { ok: false, reason: 'instruction' };
  var whole = A.guardReply(r, patientText, null, { chat: true });
  if (whole.ok) return { ok: true, text: r, dropped: 0 };
  if (whole.reason !== 'not_question_or_summary') return { ok: false, reason: whole.reason };
  var kept = [], dropped = 0, sents = split(r);
  for (var i = 0; i < sents.length; i++) {
    var g = A.guardReply(sents[i], patientText, null, { chat: true });
    if (g.ok) { kept.push(sents[i]); continue; }
    if (g.reason !== 'not_question_or_summary') return { ok: false, reason: g.reason };
    if (receptionOnly(sents[i], patientText)) kept.push(sents[i]); else dropped++;
  }
  if (!kept.length) return { ok: false, reason: 'not_question_or_summary' };
  return { ok: true, text: kept.join(' '), dropped: dropped };
}
module.exports = { check: check, receptionOnly: receptionOnly, PROMISE: PROMISE, THIRD: THIRD };
