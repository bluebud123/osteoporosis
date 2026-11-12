'use strict';
/* Clinic answer library (v2). Fixed texts for the questions patients ask most around a knee replacement.
 * The words a patient reads are ALWAYS these texts, shown exactly. A model may only choose WHICH text fits (see ai.pick).
 * Every text is a DRAFT written by an AI. A doctor approves, edits or switches off each one on the Rules page.
 * Until approved, a text is shown only while "Use draft answers" is on (the default in the demo), and it is labelled a draft.
 * Malay and Chinese are machine translations. Arabic falls back to English.
 * staff: true  -> the message also goes to the Inbox, because a person has to do something.
 * {phone} {emerg} {sessions} are filled from Settings. */
var TOPICS = [
  { id: 'fasting', title: 'Fasting before surgery', owner: 'preop_nurse', staff: false,
    re: /fast(?:ing)?\b|stop eating|eat (?:or drink )?before|drink (?:water )?before|nil by mouth|last meal|puasa|berpuasa|makan sebelum|minum sebelum|禁食|不能吃|不能喝|空腹/i,
    en: 'Your fasting times are set for you by the pre-op nurse at your briefing (it is on your checklist). Please follow the times they give you, and ask them before changing any regular medicine. If you have not been given times by 2 days before surgery, call {phone}.',
    ms: 'Waktu berpuasa anda ditetapkan oleh jururawat pra-bedah semasa taklimat (ada dalam senarai semak anda). Sila ikut waktu yang diberi, dan tanya mereka sebelum mengubah ubat harian. Jika belum diberitahu 2 hari sebelum pembedahan, hubungi {phone}.',
    zh: '禁食时间由术前护士在术前说明时为您确定（已列在您的清单上）。请按他们给的时间执行，更改任何常用药之前请先询问。若手术前2天仍未收到时间，请致电 {phone}。' },
  { id: 'bring', title: 'What to bring to hospital', owner: 'preop_nurse', staff: false,
    re: /what (?:should|do|must|can) i (?:bring|pack)|bring (?:to|with)|pack(?:ing)? (?:list|for)|apa (?:perlu|patut|nak) (?:saya )?bawa|bawa apa|带什么|要带|需要带/i,
    en: 'Please bring: your IC or passport, appointment letter, insurance card or guarantee letter, all your regular medicines in their boxes, loose comfortable clothes, flat non-slip shoes, and your walking aid if you have one. Leave valuables at home.',
    ms: 'Sila bawa: kad pengenalan atau pasport, surat temu janji, kad insurans atau surat jaminan, semua ubat harian dalam kotaknya, pakaian longgar, kasut rata yang tidak licin, dan alat bantuan berjalan jika ada. Tinggalkan barang berharga di rumah.',
    zh: '请携带：身份证或护照、预约信、保险卡或担保信、所有常用药（连同药盒）、宽松舒适的衣服、防滑平底鞋，以及助行器（如有）。贵重物品请留在家中。' },
  { id: 'stay', title: 'Length of stay and discharge', owner: 'ward_nurse', staff: true,
    re: /how (?:long|many (?:days|nights)).{0,25}(?:stay|in hospital|in the ward|admitted|warded)|length of stay|when (?:can|will) i (?:go home|be discharged)|discharge|berapa lama.{0,20}(?:tinggal|wad|hospital)|bila boleh (?:balik|keluar|discaj)|住院多久|住几天|住院[^。]{0,4}几天|什么时候(?:可以)?出院|几时出院/i,
    en: 'Most people stay a few days after a knee replacement. Your surgeon and physiotherapist decide the day you go home, once you are walking safely and your pain is controlled. The ward team will confirm the day and time with you, and I have passed your question to them.',
    ms: 'Kebanyakan pesakit tinggal beberapa hari selepas penggantian lutut. Pakar bedah dan ahli fisioterapi menentukan hari anda pulang, apabila anda berjalan dengan selamat dan sakit terkawal. Pasukan wad akan sahkan hari dan masa, dan soalan anda telah disampaikan kepada mereka.',
    zh: '膝关节置换后大多数人住院几天。等您能安全行走、疼痛得到控制后，由外科医生和物理治疗师决定出院日期。病房团队会与您确认具体日期和时间，我已把您的问题转给他们。' },
  { id: 'dressing', title: 'Dressing and stitches', owner: 'ward_nurse', staff: false,
    re: /(?:take|remove|change|open|peel).{0,20}(?:dressing|bandage|plaster)|(?:dressing|bandage|plaster).{0,20}(?:off|removed?|changed?)|stitches?.{0,12}(?:out|removed?)|(?:remove|take out).{0,12}(?:stitches|staples|clips)|buka (?:balutan|jahitan)|tukar balutan|cabut jahitan|拆线|换药|拆纱布|拆绷带/i,
    en: 'Please leave the dressing on and dry unless your nurse has told you otherwise. Dressing changes and removing stitches or clips are done by the clinic at your wound review; ask me "when is my follow-up" for the date. If the dressing is soaked, peeling off, or the wound is red, hot, smelly or leaking, tell us the same day.',
    ms: 'Sila biarkan balutan kekal dan kering kecuali jururawat memberitahu sebaliknya. Tukar balutan dan cabut jahitan dibuat oleh klinik semasa semakan luka; tanya saya "bila temu janji susulan saya" untuk tarikhnya. Jika balutan basah kuyup, tertanggal, atau luka merah, panas, berbau atau berair, beritahu kami pada hari yang sama.',
    zh: '除非护士另有交代，请保持敷料完好干燥。换药和拆线由诊所在伤口复查时进行；您可以问我"复诊是哪一天"。如果敷料湿透、脱落，或伤口发红、发烫、有异味或渗液，请当天告诉我们。' },
  { id: 'shower', title: 'Showering and bathing', owner: 'ward_nurse', staff: false,
    re: /shower\w*|\bbath\w*|\bmandi\b|洗澡|淋浴|冲凉/i,
    en: 'You may shower once the clinic\'s waterproof dressing is on, intact and sealed at the edges. Keep water off a wound that is not covered, and do not soak the knee in a bath or pool until your surgeon says so. If the dressing leaks or lifts, tell us the same day.',
    ms: 'Anda boleh mandi (pancuran) apabila balutan kalis air dari klinik masih utuh dan melekat rapat. Elakkan air pada luka yang tidak bertutup, dan jangan rendam lutut dalam tab atau kolam sehingga pakar bedah membenarkan. Jika balutan bocor atau terangkat, beritahu kami pada hari yang sama.',
    zh: '诊所的防水敷料完好、边缘密封时可以淋浴。未覆盖的伤口请勿沾水，在外科医生允许之前请勿泡澡或游泳。如果敷料渗水或翘起，请当天告诉我们。' },
  { id: 'reschedule', title: 'Changing an appointment', owner: 'clinic_coordinator', staff: true,
    re: /reschedul\w*|change (?:my |the )?(?:appointment|date|slot)|(?:can'?t|cannot|unable to|won'?t be able to) (?:attend|come|make it)|postpone|cancel (?:my |the )?(?:appointment|surgery|operation)|running late|be late|tukar (?:temu janji|tarikh)|tak (?:boleh|dapat) (?:datang|hadir)|tunda|改期|改时间|不能来|来不了|取消预约|迟到/i,
    en: 'Thank you for letting us know. I have passed this to the clinic coordinator, who arranges appointments. If it is for today or tomorrow, please also call {phone} ({sessions}).',
    ms: 'Terima kasih kerana memaklumkan. Perkara ini telah disampaikan kepada penyelaras klinik yang mengatur temu janji. Jika untuk hari ini atau esok, sila hubungi juga {phone} ({sessions}).',
    zh: '谢谢您告知。我已转给负责安排预约的诊所协调员。如果是今天或明天的预约，请同时致电 {phone}（{sessions}）。' },
  { id: 'arrival', title: 'What time to come on the day', owner: 'preop_nurse', staff: true,
    re: /what time.{0,25}(?:come|arrive|be there|admission|admitted|check ?in)|time to come|admission time|pukul berapa.{0,20}(?:datang|sampai|daftar)|几点.{0,8}(?:到|来|入院|报到)/i,
    en: 'Your admission time is confirmed by the clinic before the day of surgery. I have passed your question to the pre-op nurse. You can ask me "when is my operation" for the date.',
    ms: 'Waktu kemasukan anda akan disahkan oleh klinik sebelum hari pembedahan. Soalan anda telah disampaikan kepada jururawat pra-bedah. Anda boleh tanya saya "bila pembedahan saya" untuk tarikhnya.',
    zh: '入院时间会由诊所在手术日前确认。我已把您的问题转给术前护士。您可以问我"手术是哪一天"查询日期。' },
  { id: 'exercise', title: 'Exercises and physiotherapy', owner: 'physio', staff: true,
    re: /exercis\w*|heel slide|physio\w* (?:sheet|plan|exercise)|how (?:much|far|often) (?:should|can) i walk|senaman|latihan|fisio|运动|锻炼|复健|康复训练/i,
    en: 'Your physiotherapist sets your exercises and how much to do, because it depends on your knee and your day after surgery. I have passed your message to the physiotherapy team, who can resend your exercise sheet and go through it with you.',
    ms: 'Ahli fisioterapi menetapkan senaman anda dan berapa banyak perlu dibuat, kerana ia bergantung pada lutut anda dan hari selepas pembedahan. Mesej anda telah disampaikan kepada pasukan fisioterapi, yang boleh menghantar semula helaian senaman dan menerangkannya.',
    zh: '运动项目和运动量由您的物理治疗师决定，因为这取决于您的膝盖情况和术后天数。我已把您的消息转给物理治疗团队，他们可以重新发送运动说明并为您讲解。' },
  { id: 'aid', title: 'Walking aid', owner: 'physio', staff: true,
    re: /walking (?:frame|stick|aid)|crutch\w*|walker\b|tongkat|alat bantuan berjalan|助行器|拐杖/i,
    en: 'The physiotherapy team fits and adjusts walking aids. I have passed your message to them. Until it is sorted, please take extra care moving around.',
    ms: 'Pasukan fisioterapi menyesuaikan alat bantuan berjalan. Mesej anda telah disampaikan kepada mereka. Sementara itu, sila lebih berhati-hati semasa bergerak.',
    zh: '助行器由物理治疗团队调整。我已把您的消息转给他们。在调整好之前，请行动时多加小心。' },
  { id: 'admin', title: 'Insurance, bills, parking, visiting', owner: 'admin', staff: true,
    re: /stay overnight|stay with me|accompany|\bpark\b|log ?in|portal|letter for|medical (?:cert|leave)|\bmc\b|teman(?:kan)?\b|陪(?:我|床|夜)|insuran\w*|guarantee letter|\bbill\w*|\bcost\w*|price|payment|deposit|parking|visiting (?:hours?|times?)|visitors?|insurans|\bbil\b|bayar\w*|kos\b|tempat letak kereta|waktu melawat|保险|费用|账单|付款|停车|探病|探访/i,
    en: 'The admin team handles insurance, bills, parking and visiting. I have passed your question to them. You can also call {phone} ({sessions}).',
    ms: 'Pasukan pentadbiran menguruskan insurans, bil, tempat letak kereta dan waktu melawat. Soalan anda telah disampaikan kepada mereka. Anda juga boleh hubungi {phone} ({sessions}).',
    zh: '保险、账单、停车和探访由行政团队处理。我已把您的问题转给他们。您也可以致电 {phone}（{sessions}）。' },
  { id: 'nervous', title: 'Feeling nervous or worried', owner: 'preop_nurse', staff: true,
    re: /nervous|anxious|anxiety|scared|afraid|frighten\w*|worried about (?:the )?(?:surgery|operation|anaesthe\w*|anesthe\w*)|risau|takut|gementar|bimbang|紧张|害怕|担心|焦虑/i,
    en: 'Many people feel nervous before an operation. The anaesthetic team sees you before surgery and will go through your questions. I have told the pre-op nurse how you feel, so they can talk it through with you. What worries you most?',
    ms: 'Ramai orang berasa gementar sebelum pembedahan. Pasukan bius akan berjumpa anda sebelum pembedahan dan menjawab soalan anda. Saya telah memaklumkan jururawat pra-bedah supaya mereka boleh berbincang dengan anda. Apa yang paling merisaukan anda?',
    zh: '很多人在手术前都会紧张。麻醉团队会在手术前见您并解答您的问题。我已告诉术前护士您的感受，他们会和您详细说明。您最担心的是什么？' },
  { id: 'sleep', title: 'Trouble sleeping', owner: 'ward_nurse', staff: true,
    re: /(?:can'?t|cannot|not|trouble|hard to|difficult\w*) sleep\w*|sleep\w* (?:badly|poorly|problem)|insomnia|get comfortable|(?:tak|tidak) (?:boleh|dapat) tidur|susah tidur|睡不着|睡不好|失眠/i,
    en: 'Poor sleep is common in the first weeks after a knee replacement. I have passed your message to the ward nurse, who can go through your pain plan and positions for sleeping with you. If pain is what keeps you awake and your tablets are not helping, tell us.',
    ms: 'Susah tidur adalah biasa pada minggu-minggu awal selepas penggantian lutut. Mesej anda telah disampaikan kepada jururawat wad, yang boleh menyemak pelan tahan sakit dan posisi tidur bersama anda. Jika sakit yang mengganggu tidur dan ubat tidak membantu, beritahu kami.',
    zh: '膝关节置换后的头几周睡眠不好很常见。我已把您的消息转给病房护士，他们可以和您一起检查止痛方案和睡姿。如果是疼痛让您睡不着而止痛药没有帮助，请告诉我们。' },
  { id: 'constipation', title: 'Constipation', owner: 'ward_nurse', staff: true,
    re: /constipat\w*|(?:haven'?t|not|can'?t|cannot) (?:been able to )?(?:gone|go|open(?:ed)? my bowels|poo(?:ed)?|pass(?:ed)? (?:a )?(?:stool|motion))|sembelit|susah (?:buang air besar|berak)|便秘|拉不出|大便不出/i,
    en: 'Constipation is common after surgery, especially with strong painkillers. I have passed this to the ward nurse, who can advise you. If you also have a swollen painful tummy, vomiting, or cannot pass wind, call {phone} today or go to the Emergency Department.',
    ms: 'Sembelit adalah biasa selepas pembedahan, terutamanya dengan ubat tahan sakit yang kuat. Perkara ini telah disampaikan kepada jururawat wad yang boleh menasihati anda. Jika perut juga bengkak dan sakit, muntah, atau tidak boleh kentut, hubungi {phone} hari ini atau pergi ke Jabatan Kecemasan.',
    zh: '手术后便秘很常见，尤其是服用强效止痛药时。我已转给病房护士，他们会给您建议。如果同时腹胀腹痛、呕吐或无法排气，请今天致电 {phone} 或前往急诊部。' },
  { id: 'fever_info', title: 'Fever: when to tell us', owner: 'ward_nurse', staff: true,
    re: /a^/,
    en: 'After surgery, tell us the same day if your temperature is 38.0 C or more, if you are shivering or sweating, or if the wound becomes red, hot, smelly or starts leaking. If you have a fever now, please write "I have a fever" and your temperature, and call {phone}. A clinician will see your question.',
    ms: 'Selepas pembedahan, beritahu kami pada hari yang sama jika suhu anda 38.0 C atau lebih, jika anda menggigil atau berpeluh, atau jika luka menjadi merah, panas, berbau atau berair. Jika anda demam sekarang, sila tulis "saya demam" dan suhu anda, dan hubungi {phone}. Doktor akan melihat soalan anda.',
    zh: '手术后，如果体温达到38.0度或以上、发冷或出汗，或伤口发红、发烫、有异味或渗液，请当天告诉我们。如果您现在正在发烧，请写"我发烧了"并附上体温，同时致电 {phone}。医生会看到您的问题。' },
  { id: 'wound_signs', title: 'Wound: when to tell us', owner: 'ward_nurse', staff: true,
    re: /a^/,
    en: 'Tell us the same day if the wound leaks, opens, smells, or the skin around it becomes red or hot, or if the dressing is soaked. If blood is soaking through and will not stop, press firmly and go to the Emergency Department ({emerg}). If this is happening now, please write what you see. A clinician will see your question.',
    ms: 'Beritahu kami pada hari yang sama jika luka berair, terbuka, berbau, atau kulit di sekelilingnya menjadi merah atau panas, atau jika balutan basah kuyup. Jika darah menembusi balutan dan tidak berhenti, tekan dengan kuat dan pergi ke Jabatan Kecemasan ({emerg}). Jika ini sedang berlaku, sila tulis apa yang anda lihat. Doktor akan melihat soalan anda.',
    zh: '如果伤口渗液、裂开、有异味，或周围皮肤发红发烫，或敷料湿透，请当天告诉我们。如果血不断渗出止不住，请用力按压并前往急诊部（{emerg}）。如果现在正在发生，请写下您看到的情况。医生会看到您的问题。' },
  { id: 'fall_info', title: 'If I fall', owner: 'ward_nurse', staff: true,
    re: /what if i (?:fall|slip|trip)|if i (?:fall|have a fall)|kalau (?:saya )?(?:jatuh|terjatuh)|如果(?:我)?(?:摔|跌)|万一(?:摔|跌)/i,
    en: 'If you fall: go to the Emergency Department ({emerg}) if you hit your head, cannot stand, the knee looks a different shape, or the wound opens or bleeds. Otherwise call {phone} the same day so the team can check you. I have passed your question to the ward nurse.',
    ms: 'Jika anda jatuh: pergi ke Jabatan Kecemasan ({emerg}) jika kepala terhantuk, tidak boleh berdiri, bentuk lutut berubah, atau luka terbuka atau berdarah. Jika tidak, hubungi {phone} pada hari yang sama supaya pasukan boleh memeriksa anda. Soalan anda telah disampaikan kepada jururawat wad.',
    zh: '如果摔倒：若撞到头、站不起来、膝盖变形，或伤口裂开或出血，请前往急诊部（{emerg}）。否则请当天致电 {phone}，让团队为您检查。我已把您的问题转给病房护士。' },
  { id: 'shave', title: 'Shaving the leg', owner: 'preop_nurse', staff: false,
    re: /shav\w*|cukur|刮毛|剃毛/i,
    en: 'Please do not shave the leg yourself before the operation. If hair needs to be removed, the theatre team does it on the day.',
    ms: 'Sila jangan cukur kaki sendiri sebelum pembedahan. Jika bulu perlu dibuang, pasukan bilik bedah akan melakukannya pada hari tersebut.',
    zh: '手术前请不要自己刮腿毛。如需备皮，手术室团队会在当天处理。' },
  { id: 'food', title: 'Food and diet', owner: 'ward_nurse', staff: true,
    re: /can i eat|allowed to eat|diet\b|food (?:to avoid|restriction)|pantang|boleh (?:saya )?makan|可以吃|能吃|忌口|饮食/i,
    en: 'The clinic has not set a special diet for you unless your doctor or nurse told you one. I have passed your question to the ward nurse. Fasting before surgery is separate: ask me about "fasting".',
    ms: 'Klinik tidak menetapkan diet khas kecuali doktor atau jururawat memberitahu anda. Soalan anda telah disampaikan kepada jururawat wad. Puasa sebelum pembedahan adalah perkara lain: tanya saya tentang "puasa".',
    zh: '除非医生或护士另有交代，诊所没有为您规定特殊饮食。我已把您的问题转给病房护士。术前禁食是另一回事：您可以问我"禁食"。' },
  { id: 'update_good', title: 'A good-news update', owner: 'ward_nurse', staff: false,
    re: /(?:much |a lot |feeling |getting |is |are |am )(?:better|improv\w*)|going down|settl(?:ing|ed)|no (?:fever|problems?|issues?|pain)\b.{0,40}(?:dry|fine|ok|good|well)|all (?:good|fine|ok|well)|just checking in|semua ok|dah surut|makin (?:baik|kurang)|(?:sakit|bengkak)[^.;]{0,10}kurang|tiada (?:demam|masalah)|好多了|消了|好转|没有发烧|一切都好|休息后就好/i,
    en: 'Thank you for the update. I have added it to your record for the clinic team.',
    ms: 'Terima kasih atas makluman. Saya telah menambahnya ke rekod anda untuk pasukan klinik.',
    zh: '谢谢您的更新。我已记录在您的病历中，供诊所团队查看。' }
];

function byId(id) { return TOPICS.filter(function (t) { return t.id === id; })[0] || null; }
// Keyword match (no AI). A question mark or a problem word stops the "good news" text from swallowing a real question.
function match(text) {
  var t = String(text);
  for (var i = 0; i < TOPICS.length; i++) {
    var tp = TOPICS[i];
    if (!tp.re.test(t)) continue;
    if (tp.id === 'update_good' && (/[?？]/.test(t) || /\bbut\b|\bhowever\b|tapi|tetapi|但|可是|不过/i.test(t))) continue;
    return tp;
  }
  return null;
}
function text(tp, lang, s) {
  var raw = tp[lang] || tp.en;
  var PH = require('./phrases.js'), ps = PH.forPatient(s, tp[lang] ? lang : 'en');   // v3: never show a settings placeholder to a patient
  return PH.tidy(raw.replace(/\{phone\}/g, ps.clinicPhone).replace(/\{emerg\}/g, ps.emergencyNumber).replace(/\{sessions\}/g, ps.sessionsText));
}
function menu() { return TOPICS.map(function (t) { return t.id + ': ' + t.title; }).join('\n'); }
module.exports = { TOPICS: TOPICS, byId: byId, match: match, text: text, menu: menu };
