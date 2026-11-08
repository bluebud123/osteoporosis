'use strict';
// Judge round 1 (Opus) fixes: engine rules added AFTER the first-pass numbers were measured (those numbers are not re-measured),
// the safety-net sentence on every routed reply, acknowledgements, number masking, and wording checks on src.html.
// Run: node mod/judge_r1.test.js   Fictional data only.
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');
const I = require('./interview.js');
const IN = require('./intake.js');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
const cls = (t, proc) => E.classify(t, { procedure: proc || 'TKR' });
const SRC = fs.readFileSync(path.join(__dirname, '..', 'src.html'), 'utf8');

// ---- P0-3 (a): under-triage, now SAME-DAY (EMERGENCY stays EMERGENCY; nothing is lowered) ----
const SAME_DAY = [
  'bleeding through the dressing', 'blood is coming through the dressing', 'the wound keeps bleeding', 'my dressing is bleeding through everywhere',
  'I have chills', 'it feels hot and I have chills', 'I keep shivering', 'I had rigors last night',
  'I fell and hit my head', 'I fell in the bathroom', 'my dad had a fall at home', 'I bumped my head on the cupboard',
  'darah tembus balutan', 'saya jatuh tadi', 'kepala terhantuk', 'saya menggigil sejak semalam',
  '纱布渗血了', '我摔倒了', '我撞到头', '我发冷', '我打冷颤',
  'الدم يتسرب من الضماد', 'سقطت على الارض', 'ضربت راسي', 'عندي قشعريرة'
];
SAME_DAY.forEach(t => { const r = cls(t); check('P0-3 SAME-DAY or higher: ' + t, r.cls === 'SAME-DAY' || r.cls === 'EMERGENCY', r.cls + ' ' + r.flags.join('|')); });

// ---- P0-3 negation and ordinary phrases must NOT alarm ----
const QUIET = [
  'no chills', 'I have no chills or fever', 'not bleeding through the dressing', 'no bleeding through the dressing', 'the wound is not bleeding',
  'I did not fall', 'I did not hit my head', 'I have not fallen', 'I fell asleep early', 'I am afraid of falling', 'how do I avoid falling at home',
  'my wound is healing well', 'the dressing is dry and clean', 'my temperature fell to 37 this morning', 'I tripped on the rug but I did not hit my head and I am fine',
  'tiada menggigil', 'saya tidak jatuh', '我没有发冷', '我没有摔倒', 'ما عندي قشعريرة', 'ما سقطت', 'سقطت في النوم'
];
QUIET.forEach(t => { const r = cls(t); check('P0-3 does not alarm: ' + t, r.cls !== 'SAME-DAY' && r.cls !== 'EMERGENCY', r.cls + ' ' + r.flags.join('|')); });

// existing urgent classes are unchanged
check('chest pain stays EMERGENCY', cls('chest pain and short of breath').cls === 'EMERGENCY');
check('soaked dressing stays EMERGENCY', cls('my dressing is soaked with blood').cls === 'EMERGENCY');
check('calf swelling stays SAME-DAY', cls('my calf is swollen').cls === 'SAME-DAY');

// ---- P0-3 (b): every routed reply carries the safety-net line, in every language ----
const NET = { en: /call the ward or go to the emergency department/, ms: /hubungi wad atau pergi ke jabatan kecemasan/, zh: /致电病房或前往急诊部/, ar: /اتصل بالجناح أو اذهب إلى قسم الطوارئ/ };
const ROUTE_Q = { en: 'what time is my follow up visit', ms: 'bila temujanji saya yang seterusnya', zh: '我的复诊是什么时候', ar: 'متى موعد المراجعة' };
['en', 'ms', 'zh', 'ar'].forEach(l => { const r = cls(ROUTE_Q[l]); check('T.ROUTE safety-net sentence (' + l + ')', r.cls === 'ROUTE' && NET[l].test(r.reply || ''), r.cls + ' ' + r.reply); });
['can I stop my blood thinner', 'is it ok to fly next week', 'my pain is getting worse again'].forEach(t => {
  const r = cls(t); check('routed reply has the safety-net line: ' + t, r.cls === 'ROUTE' && NET.en.test(r.reply), r.cls + ' ' + r.reply);
});

// ---- P1-6: acknowledgements are ACK, not a clinician question ----
['thanks', 'thank you', 'Thanks!', 'noted', 'got it', 'done', 'ok will do', 'terima kasih', 'terima kasih banyak', '谢谢', '好的', '👍', 'شكرا'].forEach(t => {
  const r = cls(t); check('ACK: ' + t, r.cls === 'ACK', r.cls);
});
['thanks but my calf is swollen', 'thank you, I have chills', 'done but the wound is red and leaking', 'ok I have chest pain', '谢谢 我发冷'].forEach(t => {
  const r = cls(t); check('anchored: ' + t + ' still reaches the red-flag rules', r.cls === 'SAME-DAY' || r.cls === 'EMERGENCY', r.cls);
});
check('a real question is still routed', cls('thanks, can I stop the aspirin?').cls === 'ROUTE');

// ---- P1-3: masking ----
const M = I.maskTyped;
['(012) 345-6789', '012/345/6789', '012/345 6789', '012_345_6789', '900101/14/5678', '12 34 56 78 90', '012 – 345 – 6789', '012 - 345 - 6789', '+60 12-345 6789', '0123456789',
  'zero one two three four five six seven eight nine', 'kosong satu dua tiga empat lima enam tujuh lapan', '零一二三四五六七八九'].forEach(t => check('masked: ' + t, /\[number removed\]/.test(M(t)) && !/\d{3}/.test(M(t)), M(t)));
['Hb 9.8', '38.5', 'surgery 12/11/2026', '12 - 11 - 2026', 'RN 12345678', 'MRN: 12345678', 'pain 5/10, took 2 tablets', 'bp 120/80 pulse 72', 'one two three', '1 2 3'].forEach(t => check('unchanged: ' + t, M(t) === t, M(t)));

// ---- P1-7 / P1-8 wording ----
check('old over-claim "AI only raises concern" is gone', !/The AI only raises concern/.test(SRC));
check('56% for production line is gone', !/about 56%/.test(SRC) && !/turn on a second check for production/.test(SRC));
check('replacement claim names 34 of 63 and "not a validated safety layer"', /34 of 63 urgent AI-written messages at first pass/.test(SRC) && /not a validated safety layer/.test(SRC));
check('phone tab no longer says "fixed approved text"', !/fixed approved text/.test(SRC) && /fixed pre-written text \(draft, awaiting clinician sign-off\)/.test(SRC));
check('Overview heading is "Watch the story" and the button is secondary', /<b>Watch the story<\/b> <button id="dplay">Watch instead: 2-minute auto story<\/button>/.test(SRC));
check('Start here stays the primary header button', /<button class="p" id="tour-start"/.test(SRC));

// ---- P0-2 source: RED_QIDS exported, unknown to-do keys line up with the immediate task ----
check('IN.RED_QIDS exported and has symptoms_now', IN.RED_QIDS && IN.RED_QIDS.symptoms_now === 'EMERGENCY');
check('end-of-interview to-do for an unknown red-flag answer uses key red_unknown_<qid>', IN.todos({ procedure: 'TKR', lang: 'en', answers: { symptoms_now: 'unknown' } }).some(t => t.key === 'red_unknown_symptoms_now'));

// ======== judge round 2 ========
// P1-A: the pre-op Intake asks about PAST falls; a history answer is recorded, never a same-day flag, and never pauses the interview
const FALLS_YES = { en: 'yes, I had a fall last year', ms: 'ya, saya jatuh bulan lepas', zh: '是，三月摔倒过一次', ar: 'نعم سقطت مرة في مارس' };
['en', 'ms', 'zh', 'ar'].forEach(l => {
  let s = I.build('FOOTANKLE', l, 'FICT-R2'); s.current = 'fa_falls';
  const n = I.next(s, FALLS_YES[l]);
  check('P1-A intake fa_falls (' + l + '): "' + FALLS_YES[l] + '" is recorded, no red flag, no pause', n.red == null && !n.reprompt && !n.halted, JSON.stringify({ red: n.red, cur: n.current }));
  const ans = I.toAnswers(n);
  check('P1-A intake fa_falls (' + l + ') answer is yes', ans.interviewAnswers && ans.interviewAnswers.fa_falls === 'yes', JSON.stringify(ans.interviewAnswers));
});
{
  let s = I.build('FOOTANKLE', 'en', 'FICT-R2'); s.current = 'fa_falls';
  const n = I.next(s, 'I fell yesterday and hit my head');
  check('P1-A intake: a recent fall with a head strike is still SAME-DAY', n.red && n.red.level === 'SAME-DAY', JSON.stringify(n.red));
}
check('P1-A chat mode: "I fell yesterday" is still SAME-DAY', cls('I fell yesterday').cls === 'SAME-DAY');
check('P1-A chat mode: "I fell and hit my head" is still SAME-DAY', cls('I fell and hit my head').cls === 'SAME-DAY');
['I had a fall last year', 'I fell two years ago', 'ya, saya jatuh bulan lepas', '去年摔倒过', 'نعم سقطت السنة الماضية'].forEach(t => check('P1-A past-tense fall is not same-day: ' + t, cls(t).cls !== 'SAME-DAY' && cls(t).cls !== 'EMERGENCY'));
['I fell this morning', 'I fell since the operation', 'saya jatuh semalam', '我昨天摔倒了', 'وقعت امس'].forEach(t => check('P1-A recent fall is same-day: ' + t, cls(t).cls === 'SAME-DAY'));

// P1-B: negation in the new rules, all four languages
['伤口没有出血', '伤口不出血', '伤口没有流血', 'tidak berdarah', 'luka saya tidak berdarah', 'saya tak jatuh', '没有发冷', 'لم اسقط', 'لم يكن عندي حمى', 'لم ينزف الجرح'].forEach(t => check('P1-B negated, no escalation: ' + t, !['SAME-DAY', 'EMERGENCY'].includes(cls(t).cls), cls(t).cls + ' ' + cls(t).flags.join('|')));
['伤口在出血', '伤口出血', '绷带一直有血渗出来', 'سقطت على الارض', 'جرحي ينزف'].forEach(t => check('P1-B positive still escalates: ' + t, ['SAME-DAY', 'EMERGENCY'].includes(cls(t).cls), cls(t).cls));

// P1-C: fear of falling and idioms stay quiet; the real thing does not
['我怕摔倒', '我害怕走路，会不会跌倒？', '我担心跌倒', 'I fell in love with the physio', 'I fell behind on my exercises', 'I fell for it', 'that movie gave me chills', 'chills down my spine reading this', 'she has chills of excitement',
  'shivering from the aircon', 'I fell asleep', 'saya jatuh cinta', 'وقعت في الحب', 'سقطت الأسعار', 'وقع العقد'].forEach(t => check('P1-C idiom/fear stays quiet: ' + t, !['SAME-DAY', 'EMERGENCY'].includes(cls(t).cls), cls(t).cls + ' ' + cls(t).flags.join('|')));
['I have chills', 'chills and sweats tonight', 'I fell down the stairs', 'I am shivering and hot', '我摔倒了'].forEach(t => check('P1-C real finding still same-day: ' + t, cls(t).cls === 'SAME-DAY', cls(t).cls));

// P1-D: one deadline for the Unknown red-flag task
{
  const td = IN.todos({ procedure: 'TKR', lang: 'en', answers: { symptoms_now: 'unknown' } }).find(t => t.key === 'red_unknown_symptoms_now');
  check('P1-D summary to-do for Unknown: owner clinician, due now', td && td.owner === 'clinician' && td.dueHours === 0 && td.urgent === true, JSON.stringify(td));
}

console.log(`\njudge_r1: ${pass} PASS, ${fail} FAIL (of ${pass + fail} checks)`);
process.exit(fail ? 1 : 0);
