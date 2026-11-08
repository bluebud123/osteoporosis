/* Round 6 regression tests for review3 B1-B7 and M1-M6 (review3.md).
 * Run: node mod/regress3.test.js   (no network, fictional data only; ms and zh wording is a machine draft pending native review).
 * Every urgent message must escalate as EMERGENCY (never SAME-DAY, never ROUTE) through the engine, the Ask box (knowledge.answer)
 * and the interview (interview.next). Benign messages must not escalate. Negated messages must not escalate. */
'use strict';

var assert = require('assert');
var E = require('../engine.js');
var I = require('./interview.js');
var IN = require('./intake.js');
var K = require('./knowledge.js');
var SRC = require('./sources.sample.json');

function walkTo(st, qid) {
  // answer every question on the way with a neutral value (no, first option, none, unknown) until qid is asked
  for (var guard = 0; st.current && st.current !== qid && guard < 200; guard++) {
    var p = I.prompt(st), v = 'none';
    if (p.type === 'yesno') v = 'no';
    else if (p.type === 'choice') v = p.options[0].value;
    else if (p.type === 'number') v = 'unknown';
    st = I.next(st, v);
  }
  return st;
}
var results = [];
function check(name, fn) {
  try { fn(); results.push([name, true]); }
  catch (e) { results.push([name, false, String(e && e.message || e).split('\n')[0]]); }
}

/* ---------- B1-B6: urgent vocabulary, 8 natural variants per item and language (plus the exact review3 messages) ---------- */
var URGENT = {
  breath_blue_lips: {
    en: ['I can not breathe properly and my lips are turning blue', 'short of breath, lips look purple lah', 'my lips got blue already and I very hard to breathe',
      'cannot breathe well, my mouth and lips like purple', 'lips turning blue while I am breathless', 'struggling to breathe, lips looking grey-blue',
      'hard to breathe since morning, my lips are blue', 'I feel short of breath, lips colour purple, please help'],
    ms: ['Saya susah bernafas dan bibir saya biru', 'Nafas sesak, bibir nampak ungu', 'Tak boleh bernafas, bibir jadi biru',
      'Sukar bernafas sejak pagi dan bibir saya ungu', 'Saya semput dan bibir kebiruan', 'Nafas pendek, bibir saya bertukar ungu',
      'Saya tercungap-cungap dan bibir biru', 'Saya rasa sesak nafas, bibir kelihatan ungu'],
    zh: ['我呼吸很困难，嘴唇发紫', '我气喘得很厉害，嘴唇发青', '我好难透气，唇变紫了', '我喘不过气来，嘴唇是紫色的',
      '胸口闷，呼吸不过来，唇发紫', '我而家呼吸好困难，嘴巴都发紫', '我气促，指甲都变紫了', '我呼吸很急，嘴唇变青了',
      '我而家唇紫晒', '透唔到气，嘴唇变咗紫色', '我而家透唔到气，嘴唇发青', '我成个人喘唔过气，嘴唇紫咗',
      '呼吸好困难，嘴唇紫哂', '我呼吸唔顺，唇发紫', '我好难呼吸，嘴巴紫晒咗', '透唔过气，指甲青咗']
  },
  chest_arm_jaw_sweat: {
    en: ['aiyoh my chest like got elephant sitting on it, sweating lah, left arm also pain', 'my chest feels like an elephant is sitting on it',
      'chest pain going to my left arm and I am sweating a lot', 'jaw pain and cold sweat since 30 minutes',
      'pressure in my chest like an elephant, drenched in sweat', 'left arm pain and sweating, chest heavy lah',
      'my chest is pain and I am sweating non stop', 'cold sweat, my jaw hurts and my chest tight'],
    ms: ['Dada saya seperti ada gajah duduk atas dada', 'Sakit dada menjalar ke lengan kiri dan berpeluh', 'Rahang saya sakit, peluh sejuk',
      'Dada berat macam ada gajah, badan berpeluh', 'Lengan kiri sakit dan saya berpeluh banyak', 'Sakit dada dan badan lencun berpeluh',
      'Dada sempit, sakit, berpeluh', 'Saya rasa dada ditekan gajah, berpeluh'],
    zh: ['胸口好像有大象坐在上面', '胸口痛，冒冷汗，左手也痛', '下巴痛，出汗很多', '胸口压住了，全身出汗', '胸闷，左手痛，流汗',
      '好像有东西压在胸口，很多汗', '心口痛，冒汗', '我胸口好重，好似有大象坐住，出冷汗',
      '胸口好似有大象坐咗喺度', '左手痛，成身冷汗', '下颌痛，冒晒冷汗', '胸口好痛，流紧汗', '心口似乎压住咗，冒汗', '胸口似有重物压住，出冷汗']
  },
  collapse_no_reaction: {
    en: ['My husband collapsed in the bathroom and is not responding', 'Found him on the floor, he is not waking up',
      'She fell down and there is no reaction when I call her', 'my father passed out and he is unresponsive',
      'the patient is lying on the floor and does not respond to me', 'Dad collapsed just now, cannot wake him',
      'Found my mum lying on the bathroom floor, no response', 'He suddenly fell and now not reacting at all'],
    ms: ['Pesakit rebah di bilik air dan tidak bertindak balas', 'Ayah saya rebah tadi, tak sedarkan diri', 'Ibu saya pengsan di dapur',
      'Suami saya jatuh rebah, tidak respon bila dipanggil', 'Dia ditemui di atas lantai dan tiada respon', 'Saya jumpa dia di lantai bilik air, tidak sedarkan diri',
      'Bapa saya tidak bertindak balas, dia terbaring di lantai', 'Pesakit tiba-tiba rebah dan tak sedarkan diri'],
    zh: ['佢喺厕所突然倒低，冇反应', '我老公突然倒地，叫唔醒佢', '妈妈喺屋企倒低咗，冇反应', '爸爸昏倒了，叫不醒', '佢突然昏倒喺地上',
      '他在厕所倒在地上，没有反应', '她跌倒了，冇反应', '佢突然倒低，叫唔醒，唔郁']
  },
  bladder_saddle: {
    en: ['I can not control my bladder and my bottom is numb', 'I wet myself and the area between my legs feels numb',
      'lost control of my bowels this morning', 'saddle area numb since last night', 'my bum feels numb and I cannot pass urine',
      'no feeling in my groin and I can not hold my pee', 'pins and needles in my perineum and I can not hold my urine', 'bottom numb, peeing without knowing'],
    ms: ['Saya tidak dapat kawal kencing dan punggung kebas', 'Air kencing saya tidak terkawal dan celah paha kebas', 'Hilang kawalan pundi kencing sejak pagi',
      'Saya kencing tanpa sedar dan punggung rasa kebas', 'Tiada rasa di celah paha dan tak boleh kawal kencing', 'Saya tak boleh tahan kencing dan dubur kebas',
      'Kencing saya tak terkawal sejak semalam', 'Punggung saya kebas, kencing pun tidak dapat ditahan'],
    zh: ['尿唔受控制，屁股附近麻麻哋冇知觉', '我尿失禁了，屁股附近麻木', '我大小便不受控制，会阴没有感觉', '屁股麻，小便唔受控', '我唔知点解大便控制唔到',
      '会阴冇知觉，好似瞓咗一样', '我屁股附近冇知觉，尿都唔受控', '屎尿都唔受控制，屁股麻']
  },
  overdose: {
    en: ['I took about 20 paramol tablets this morning', 'I took many painkillers and I feel very drowsy', 'took a whole bottle of panadol',
      'I swallowed twenty pills, I feel sleepy and confused', 'took 15 tabs of paracetamol by mistake', 'I took too many tablets for my knee pain',
      'Took lots of paracetamol tonight, cannot stay awake', 'Swallowed a whole strip of painkillers and now sleepy'],
    ms: ['Saya makan banyak ubat pagi tadi', 'Saya telan 20 biji paracetamol', 'Saya makan panadol berlebihan dan rasa mengantuk',
      'Makan ubat tahan sakit banyak-banyak, sekarang mengantuk', 'Telan dua puluh biji ubat sakit kepala tadi', 'Dia makan banyak ubat dan tidak sedar',
      'Saya ambil banyak paracetamol kerana sakit, kini sangat mengantuk', 'Makan panadol 15 biji semalam'],
    zh: ['我食咗成日止痛药，大概二十粒，好眼瞓', '我食咗二十粒止痛药', '我一次过吞咗好多药丸', '食咗好多止痛药，好眼瞓', '我食咗很多粒止痛药',
      '我吃了三十片止痛药', '食咗成日药，而家好眼瞓', '我今晚食咗几十粒止痛药']
  }
};
var EXACT = {
  B1: ['我而家好难透气，唇都变紫咗'], B2: ['aiyoh my chest like got elephant sitting on it, sweating lah, left arm also pain'],
  B3: ['Pesakit rebah di bilik air dan tidak bertindak balas'], B4: ['尿唔受控制，屁股附近麻麻哋冇知觉'],
  B5: ['我食咗成日止痛药，大概二十粒，好眼瞓'], B6: ['佢喺厕所突然倒低，冇反应']
};

// every urgent message is EMERGENCY at the engine, and the Ask box and interview agree
Object.keys(URGENT).forEach(function (item) {
  ['en', 'ms', 'zh'].forEach(function (lang) {
    URGENT[item][lang].forEach(function (msg, i) {
      check('B urgent ' + item + ' ' + lang + ' #' + (i + 1) + ' EMERGENCY: ' + msg, function () {
        var r = E.classify(msg, { procedure: 'LUMBAR' });
        assert.strictEqual(r.cls, 'EMERGENCY', 'got ' + r.cls + ' ' + r.flags.join('; '));
      });
    });
  });
});
Object.keys(EXACT).forEach(function (id) {
  EXACT[id].forEach(function (msg) {
    check(id + ' exact review3 message is EMERGENCY (engine, Ask box and interview): ' + msg, function () {
      assert.strictEqual(E.classify(msg, { procedure: 'TKR' }).cls, 'EMERGENCY');
      var st = I.build('TKR', 'en');
      var n = I.next(st, msg);
      assert.strictEqual(n.red && n.red.level, 'EMERGENCY', 'interview red level ' + (n.red && n.red.level));
      var store = K.createStore(); SRC.sources.forEach(function (s) { K.addSource(store, s); });
      var a = K.answer(store, { procedure: 'TKR' }, msg, 'en');
      assert.strictEqual(a.kind, 'ROUTE', 'Ask box must not answer an urgent message');
      assert.strictEqual(a.cls, 'EMERGENCY');
    });
  });
});
// B6: the Ask box must not call a collapse SAME-DAY
check('B6 collapse is not SAME-DAY in the Ask box', function () {
  var store = K.createStore(); SRC.sources.forEach(function (s) { K.addSource(store, s); });
  var a = K.answer(store, { procedure: 'TKR' }, '佢喺厕所突然倒低，冇反应', 'zh');
  assert.strictEqual(a.cls, 'EMERGENCY');
});
// B3: the Malay collapse is not answered with bathing advice
check('B3 Malay collapse is not answered from the store (no bathing advice)', function () {
  var store = K.createStore(); SRC.sources.forEach(function (s) { K.addSource(store, s); });
  var a = K.answer(store, { country: 'Sample Emirate Health Authority', hospital: 'Sample General Hospital', procedure: 'TKR' },
    'Pesakit rebah di bilik air dan tidak bertindak balas', 'ms');
  assert.strictEqual(a.kind, 'ROUTE');
  assert.ok(!/mandi|balutan/i.test(a.text || ''));
});

/* ---------- negation and benign controls (25 per language, must not escalate) ---------- */
var NEG = {
  en: ['No breathlessness and my lips are pink', 'no chest pain, no sweating, no elephant feeling', 'no fainting, I am fine',
    'no bladder problems, no numbness in my bottom', 'I did not take any extra tablets, just my usual dose'],
  ms: ['Tiada sesak nafas, bibir saya merah muda', 'Tiada sakit dada dan tiada berpeluh', 'Saya tidak rebah, saya okay',
    'Tiada masalah kencing, saya okay', 'Saya tidak makan ubat berlebihan'],
  zh: ['我没有难透气，嘴唇颜色正常', '没有胸闷，没有出汗', '我没有倒，我很好', '没有尿失禁，屁股不麻', '我没有食过量药']
};
var BENIGN = {
  en: ['Thank you, the physio exercises are going well today.', 'Can I eat rice tomorrow after the operation?', 'My appetite is coming back slowly, thanks.',
    'What time is my clinic appointment next week?', 'The dressing is dry and clean, no problems.', 'I am sweating a bit because the room is hot, nothing else.',
    'My knee is a little stiff in the morning but it loosens up.', 'Where do I collect my discharge letter?', 'I took my paracetamol as prescribed, one tablet every six hours.',
    'My left arm feels sore from the sling straps but no pain at rest.', 'The stitches look neat and the area is calm.', 'I fell asleep early last night and woke up feeling rested.',
    'My breathing is normal when I walk around the house.', 'The nurse was very kind when she changed my bandage.', 'I am not feeling any numbness in my feet.',
    'My toes feel warm and pink, all good.', 'Could you send me the physio timetable again, please?', 'I walked to the kitchen and back without any problems.',
    'The tablets are in a white box on the kitchen table.', 'I am feeling a bit nervous about going home tomorrow.', 'No fever, no redness, and the wound is closed.',
    'Thanks, I have done the leg exercises twice today.', 'Is it normal to feel tired in the afternoon after surgery?', 'My pain is much better than last week, thank you.',
    'I am waiting at the car park for my ride home.'],
  ms: ['Terima kasih, latihan fisioterapi saya berjalan lancar hari ini.', 'Bila saya boleh makan nasi selepas pembedahan?', 'Selera makan saya semakin baik sedikit demi sedikit.',
    'Bila temujanji klinik saya minggu depan?', 'Balutan saya kering dan bersih, tiada masalah.', 'Saya berpeluh sedikit kerana bilik panas sahaja.',
    'Lutut saya sedikit kaku pada waktu pagi tetapi semakin longgar.', 'Di mana saya perlu ambil surat keluar hospital?', 'Saya makan ubat paracetamol mengikut arahan, satu biji setiap enam jam.',
    'Kaki saya sedikit lenguh selepas berjalan, tetapi hilang selepas rehat.', 'Saya dah tidur lena semalam dan rasa segar pagi ini.', 'Pernafasan saya normal semasa berjalan di dalam rumah.',
    'Jururawat sangat baik ketika menukar balutan saya.', 'Ubat saya ada dalam kotak putih atas meja dapur.', 'Saya rasa sedikit gugup untuk balik esok.',
    'Tiada demam, tiada kemerahan, luka sudah bercantum.', 'Saya sudah buat senaman kaki dua kali hari ini.', 'Adakah normal rasa letih selepas pembedahan?',
    'Sakit saya jauh lebih baik berbanding minggu lepas.', 'Boleh saya bawa kereta bila sudah berhenti makan ubat tahan sakit?', 'Saya tidur dengan kaki ditinggikan dengan bantal.',
    'Kami sekeluarga sudah sampai di rumah dengan selamat.', 'Terima kasih atas penjelasan doktor tadi.', 'Saya berjalan ke dapur dan kembali tanpa masalah.',
    'Boleh minta jadual fisioterapi semula?'],
  zh: ['谢谢，今天的康复运动做得很好。', '胃口慢慢好转了，谢谢。', '敷料干净干燥，没有问题。', '早上膝盖有点僵硬，活动后就好了。', '我按医生吩咐每六小时吃一粒止痛药。', '左脚有点麻，但走动后会好。', '我昨晚睡得很好，今天精神不错。', '呼吸很正常，走路不喘。', '今天护士很亲切，帮我换了敷料。', '没有发烧，没有红肿，伤口愈合得很好。', '我会按时复诊。', '伤口没有渗液，也没有异味。', '今日做咗好多运动，好攰但係冇问题。', '我而家冇咩痛，多谢你哋。', '伤口干干净净，冇嘢问题。', '今日食咗一碗粥，好好味。', '我每日食一粒止痛药，已经好多了。', '我食咗早餐就食咗药，唔使担心。', '医生话下个礼拜返诊。', '我哋今日去咗行街。', '脚趾暖暖地，颜色正常。', '我有啲口干，饮咗好多水。', '昨晚瞓得几好，今朝精神好。', '伤口有少少痕，唔痛，唔紧要。', '我右手有少少酸，系咪因为做运动？']
};
['en', 'ms', 'zh'].forEach(function (lang) {
  check('negated red-flag wording does not escalate (' + lang + ', ' + NEG[lang].length + ' messages)', function () {
    NEG[lang].forEach(function (m) {
      var r = E.classify(m, { procedure: 'TKR' });
      assert.ok(r.cls !== 'EMERGENCY' && r.cls !== 'SAME-DAY', m + ' => ' + r.cls + ' ' + r.flags.join('; '));
    });
  });
  check('benign messages do not escalate (' + lang + ', ' + BENIGN[lang].length + ' messages)', function () {
    BENIGN[lang].forEach(function (m) {
      var r = E.classify(m, { procedure: 'TKR' });
      assert.ok(r.cls !== 'EMERGENCY' && r.cls !== 'SAME-DAY', m + ' => ' + r.cls + ' ' + r.flags.join('; '));
    });
  });
});
check('benign set has 25 messages per language', function () {
  ['en', 'ms', 'zh'].forEach(function (l) { assert.strictEqual(BENIGN[l].length, 25, l + ' has ' + BENIGN[l].length); });
});

/* ---------- B5/B7: implausible values never produce NONE ---------- */
function summaryWith(over) {
  var base = { meds_text: 'paracetamol', blood_thinner: 'no', allergy_text: 'none known', penicillin_allergy: 'no', latex_allergy: 'no',
    diabetes: 'no', hba1c: 'not applicable', heart_disease: 'no', lung_disease: 'no', kidney_disease: 'no', anaesthetic_problem: 'no', smoker: 'no',
    alcohol: 'none', prior_surgery_same_joint: 'no', mrsa_or_admission_past_year: 'no', lives_alone: 'no', stairs_home: 'no', mobility_aid: 'no',
    walk_distance_m: 'over 500 m', payer: 'self', preferred_language: 'en', night_pain: 'no', prior_injections: 'no', sex: 'female' };
  return IN.summarise({ procedure: 'TKR', answers: Object.assign(base, over) });
}
check('clean base summary is NONE (fixture is sound)', function () {
  assert.strictEqual(summaryWith({}).banner.level, 'NONE');
});
check('B7 paracetamol 9999 mg in the medicine list: AMBER "implausible value: clinician to verify", never NONE', function () {
  var s = summaryWith({ meds_text: 'paracetamol 9999 mg, metformin -5 mg' });
  assert.strictEqual(s.banner.level, 'AMBER');
  assert.ok(s.banner.reasons.some(function (r) { return /implausible value: clinician to verify/.test(r); }), JSON.stringify(s.banner.reasons));
});
check('B7 metformin -5 mg alone: AMBER, never NONE', function () {
  var s = summaryWith({ meds_text: 'metformin -5 mg' });
  assert.notStrictEqual(s.banner.level, 'NONE');
  assert.ok(s.banner.reasons.some(function (r) { return /implausible value/.test(r); }));
});
check('B7 HbA1c 99 (outside 3-20) gives AMBER "implausible value" reason', function () {
  var s = summaryWith({ hba1c: 99, diabetes: 'yes' });
  assert.strictEqual(s.banner.level, 'AMBER');
  assert.ok(s.banner.reasons.some(function (r) { return /implausible value: clinician to verify \(HbA1c 99/.test(r); }), JSON.stringify(s.banner.reasons));
});
check('B7 HbA1c 1.5 (below 3) gives AMBER', function () {
  assert.strictEqual(summaryWith({ hba1c: 1.5, diabetes: 'yes' }).banner.level, 'AMBER');
});
check('B7 negative walking distance gives AMBER', function () {
  var s = summaryWith({ walk_distance_m: -40 });
  assert.strictEqual(s.banner.level, 'AMBER');
  assert.ok(s.banner.reasons.some(function (r) { return /implausible value/.test(r); }));
});
check('B7 age 0 or 150 gives AMBER (age field when present)', function () {
  assert.strictEqual(summaryWith({ age: 150 }).banner.level, 'AMBER');
  assert.strictEqual(summaryWith({ age: 0 }).banner.level, 'AMBER');
});
check('B7 a plausible dose (paracetamol 1000 mg) stays NONE', function () {
  assert.strictEqual(summaryWith({ meds_text: 'paracetamol 1000 mg' }).banner.level, 'NONE');
});
check('B7 the interview refuses an out-of-range HbA1c (99) and records it as unknown only when asked', function () {
  var st = I.build('TKR', 'en');
  // walk to hba1c: diabetes yes
  st = walkTo(st, 'diabetes');
  st = I.next(st, 'yes');
  assert.strictEqual(st.current, 'hba1c');
  var bad = I.next(st, '99');
  assert.strictEqual(bad.current, 'hba1c', 'a value of 99 is not accepted');
  var unk = I.next(bad, 'unknown');
  assert.strictEqual(unk.answers.hba1c, 'unknown');
});

/* ---------- M3: explicit unknown on yes/no and number questions ---------- */
check('M3 typed unknown on a yes/no question is recorded as unknown, never a forced No', function () {
  var st = I.build('TKR', 'en');
  st = walkTo(st, 'diabetes');
  var n = I.next(st, 'unknown');
  assert.strictEqual(n.reprompt, false, 'no reprompt loop');
  assert.strictEqual(n.answers.diabetes, 'unknown');
});
['tak tahu', '不知道', 'tidak tahu'].forEach(function (u) {
  check('M3 "' + u + '" on a yes/no question is unknown (ms or zh wording)', function () {
    var st = I.build('TKR', 'en');
    st = walkTo(st, 'diabetes');
    assert.strictEqual(I.next(st, u).answers.diabetes, 'unknown');
  });
});
check('M3 typed "no" on the HbA1c question records unknown (a gap), not a number, and does not loop', function () {
  var st = I.build('TKR', 'en');
  st = walkTo(st, 'diabetes');
  st = I.next(st, 'yes');
  var n = I.next(st, 'no');
  assert.strictEqual(n.answers.hba1c, 'unknown');
  assert.strictEqual(n.reprompt, false);
});
check('M3 an unknown answer is a gap in the summary, so the banner is never NONE', function () {
  var s = summaryWith({ diabetes: 'unknown' });
  assert.notStrictEqual(s.banner.level, 'NONE');
  assert.ok(s.gaps.some(function (g) { return /diabetes/.test(g); }), JSON.stringify(s.gaps));
});
check('M3 the yes/no prompt offers an Unknown chip in the page (src.html)', function () {
  var html = require('fs').readFileSync(require('path').join(__dirname, '..', 'src.html'), 'utf8');
  assert.ok(/data-in-val','unknown'/.test(html), 'unknown chip code present');
});

/* ---------- M1/M2: Ask box, topic routing and draft tag ---------- */
var CTX = { country: 'Sample Emirate Health Authority', hospital: 'Sample General Hospital', team: 'Sample Ortho Ward Team', surgeon: 'Dr Sample Surgeon', procedure: 'TKR' };
function askStore() { var st = K.createStore(); SRC.sources.forEach(function (s) { K.addSource(st, s); }); return st; }
[['Is it ok to eat spicy food?', 'en'], ['Stroke risk is low. When do I see the surgeon?', 'en'], ['Tiada sakit dada. Patutkah saya berjalan?', 'ms'],
  ['My calf is not swollen. Any exercise?', 'en']].forEach(function (pair) {
  check('M2 wrong-topic question routes to the care team: ' + pair[0], function () {
    var a = K.answer(askStore(), CTX, pair[0], pair[1]);
    assert.strictEqual(a.kind, 'ROUTE', JSON.stringify(a));
    assert.strictEqual(a.text, 'I will pass this to your care team');
  });
});
check('M2 a question with two topics (shower and dressing) routes to the care team, not a guess', function () {
  var a = K.answer(askStore(), CTX, 'When can I shower? My wound has a waterproof dressing.', 'en');
  assert.strictEqual(a.kind, 'ROUTE');
});
check('M1 a draft answer is marked draft (SAMPLE draft, not approved) and carries approved=false', function () {
  var a = K.answer(askStore(), CTX, 'When can I shower?', 'en');
  assert.strictEqual(a.kind, 'ANSWER');
  assert.strictEqual(a.approved, false);
  assert.strictEqual(a.draft, true);
});
check('M1 the page shows the SAMPLE draft, not approved tag for draft answers', function () {
  var html = require('fs').readFileSync(require('path').join(__dirname, '..', 'src.html'), 'utf8');
  assert.ok(/SAMPLE draft, not approved/.test(html));
});
check('M2 "Bila boleh mandi?" (ms) is answered from the shower topic, as a draft', function () {
  var a = K.answer(askStore(), CTX, 'Bila boleh mandi?', 'ms');
  assert.strictEqual(a.kind, 'ANSWER');
  assert.strictEqual(a.topic, 'shower');
  assert.strictEqual(a.draft, true);
});
check('Ask box never answers an urgent message (zh, cauda) even when a store has a matching word', function () {
  var a = K.answer(askStore(), CTX, '我屁股麻，小便唔受控', 'zh');
  assert.strictEqual(a.kind, 'ROUTE');
  assert.strictEqual(a.cls, 'EMERGENCY');
});

/* ---------- M4: unacknowledged EMERGENCY keeps escalating ---------- */
check('M4 an unacknowledged EMERGENCY pages on-call, then ward in-charge, then director on-call, and keeps going', function () {
  var s = new E.Sim();
  s.addPatient({ id: 'P', procedure: 'LUMBAR', postopDay: 3 });
  var r = s.message('P', 'I can not feel when I pass urine and my bottom is numb.');
  var a = r.alert;
  assert.strictEqual(a.cls, 'EMERGENCY');
  s.advance(4);
  assert.strictEqual(a.nobodyResponded, true, 'on-call fallback used');
  s.advance(2);
  assert.strictEqual(a.escalations[0].to, 'ward_incharge');
  s.advance(2);
  assert.strictEqual(a.escalations[1].to, 'director_oncall');
  var before = a.escalations.length;
  s.advance(24);
  assert.ok(a.escalations.length > before, 'still paging after 24 h');
  assert.ok(a.escalations.every(function (e, i) { return i === 0 || e.at - a.escalations[i - 1].at === E.CFG.nextLevelEvery; }), 'fixed interval');
  assert.strictEqual(a.state, 'open', 'stays open until acknowledged');
});
check('M4 an acknowledged EMERGENCY stops escalating', function () {
  var s = new E.Sim();
  s.addPatient({ id: 'P', procedure: 'LUMBAR', postopDay: 3 });
  var a = s.message('P', 'I can not feel when I pass urine and my bottom is numb.').alert;
  s.advance(1);
  s.ack(a.id, 'On-call doctor');
  s.advance(30);
  assert.strictEqual(a.escalations.length, 0);
  assert.strictEqual(a.state, 'acked');
});
check('M4 the page shows UNRESPONDED EMERGENCY on the board and in the KPI strip (src.html)', function () {
  var html = require('fs').readFileSync(require('path').join(__dirname, '..', 'src.html'), 'utf8');
  assert.ok(/UNRESPONDED EMERGENCY/.test(html));
  assert.ok(/Unresponded emergencies|UNRESPONDED EMERGENCY',ur/.test(html) || /\['UNRESPONDED EMERGENCY',ur/.test(html));
});

/* ---------- M6: never NONE with open gaps ---------- */
check('M6 a single open gap (stairs at home unanswered) is INCOMPLETE, never NONE', function () {
  var s = summaryWith({ stairs_home: undefined });
  assert.strictEqual(s.banner.level, 'INCOMPLETE');
});

/* ---------- M5: honest text ---------- */
check('M5 the page no longer says that no miss was answered by the bot', function () {
  var html = require('fs').readFileSync(require('path').join(__dirname, '..', 'src.html'), 'utf8');
  assert.ok(!/none was answered by the bot/i.test(html), 'stale claim removed');
});
check('M5 the page no longer claims red flags are caught in English, Bahasa Malaysia and Chinese without qualification', function () {
  var html = require('fs').readFileSync(require('path').join(__dirname, '..', 'src.html'), 'utf8');
  assert.ok(!/caught by fixed rules before anything else, in English, Bahasa Malaysia and Chinese/.test(html));
});
check('M5 the Overview chart reads from one EVIDENCE object, and the fresh set is labelled as 60 (30 urgent)', function () {
  var html = require('fs').readFileSync(require('path').join(__dirname, '..', 'src.html'), 'utf8');
  assert.ok(/var EVIDENCE=\{/.test(html));
  assert.ok(/Fresh set of 60 messages, 30 urgent/.test(html));
  assert.ok(!/Unseen, fresh 60, first pass/.test(html), 'old mislabelled row removed');
});

var pass = results.filter(function (r) { return r[1]; }).length;
results.forEach(function (r) { console.log((r[1] ? 'PASS ' : 'FAIL ') + r[0] + (r[1] ? '' : ' :: ' + r[2])); });
console.log('\nregress3: ' + pass + ' PASS, ' + (results.length - pass) + ' FAIL (of ' + results.length + ' checks)');
process.exit(pass === results.length ? 0 : 1);
