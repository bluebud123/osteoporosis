/* PeriLoop pre-operative intake interview: a deterministic question tree.
 * No model calls, no network at import. Fictional content only.
 * Questions ask; they never advise. Every typed or spoken answer passes through engine.classify() first.
 * All ms and zh strings are machine drafts (reviewed:false) pending native clinician review.
 */
(function (root) {
  'use strict';

  const engine = (typeof require === 'function') ? require('../engine.js') : root.PeriLoop;
  const IDMAP = (typeof require === 'function') ? require('./idmap.js') : root.PL_IDMAP;
  const LANGS = ['en', 'ms', 'zh', 'ar'];
  const PROCEDURES = ['TKR', 'THR', 'ACL', 'LUMBAR', 'SHOULDER', 'FOOTANKLE'];
  const LEVEL_RANK = { 'SAME-DAY': 2, EMERGENCY: 3 };
  // Canonical phrases used only to obtain the engine's own reply text for question-level red flags.
  const CANON = {
    EMERGENCY: { en: 'chest pain', ms: 'saya sakit dada sejak semalam', zh: '胸口痛', ar: 'عندي ألم في الصدر منذ الليلة' },
    'SAME-DAY': { en: 'fever reported', ms: 'saya demam sejak semalam', zh: '发烧', ar: 'عندي حمى منذ الليلة' }
  };
  // Arabic normalisation for typed answers: tashkeel and tatweel out, alef / ya / ta-marbuta unified, Arabic-Indic digits to ASCII.
  function arNorm(text) {
    return String(text == null ? '' : text)
      .replace(/[ً-ٰٟـ]/g, '')
      .replace(/[آأإٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
      .replace(/٫/g, '.').replace(/٬/g, ',');
  }
  // Patterns below run on arNorm(text), so Arabic alternatives are written without hamza, alef maqsura or ta-marbuta.
  const YES_RE = /^\s*(yes|yeah|yep|ya|ada|y|是的?|有|对|نعم|ايوه|ايوا)(?![a-zء-ي])/i;
  const NO_RE = /^\s*(no|nope|tidak|tak|tiada|takde|否|不是|不|没有|没|无|لا|مو|مش|ليس)(?![a-zء-ي])/i;
  const UNK_RE = /unknown|don'?t know|not sure|tidak tahu|tak tahu|不知道|不清楚|不确定|ما ادري|مو متاكد|مش متاكد|لا اعرف|غير متاكد|مش عارف|ما اعرف/i;
  // round 6 (review3 M3): on a number question a typed 'no' means no value to give. It is recorded as unknown (a gap), never as a number.
  const NUM_NONE_RE = /^\s*(no|none|nil|tidak|tak|tiada|takde|没有|没|无|冇|لا|لا يوجد|ما فيه|مافي|ما في|لاشي)\s*[.!。]?\s*$/i;

  /* ---------- typed-text masking (polish round 8, item 1). Demo only. ----------
   * Phone-number-shaped and IC-shaped digit runs become MASK before typed text is stored, shown on the Staff board or
   * sent to a model. next() still classifies the ORIGINAL text, so the red-flag rules see what was typed.
   * A run is an optional leading +, then digit groups joined by one space or dash. It is masked when it has 8 to 15 digits,
   * at least one group of 3 or more digits (so "1 2 3 4 5 6 7 8" stays), is not a date such as 2026-11-08 or 08-11-2026,
   * and is not part of a decimal such as 9.12345678. Arabic-Indic and full-width digits count as digits. IC numbers
   * (######-##-####) fall under the same rule. */
  const MASK = '[number removed]';
  // dd-mm-yyyy, yyyy-mm-dd, dotted and slashed forms are dates, never masked
  const DATE_SHAPE = /^(\d{4}[ .\/-]{1,3}\d{1,2}[ .\/-]{1,3}\d{1,2}|\d{1,2}[ .\/-]{1,3}\d{1,2}[ .\/-]{1,3}\d{4})$/; // judge round 1: slashes and spaced dashes count as date separators too
  // an RN label just before the digits keeps them: "RN 12345678", "MRN: 12345678" are record numbers, not phone numbers
  const RN_BEFORE = /(?:^|[^A-Za-z])(?:RN|MRN)[ :#.\-]*$/i;
  // Each character maps to one ASCII character, so an offset in the converted text is the same offset in the original.
  function digitsAscii(s) {
    return s.replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x0660))
      .replace(/[０-９]/g, c => String(c.charCodeAt(0) - 0xFF10))
      .replace(/[\u2010-\u2015\u2212]/g, '-');   // en dash, em dash and minus count as dashes
  }
  // judge round 1 (P1-3): digits spelled out as words ("zero one two ...", "kosong satu dua ...", Chinese numerals), eight or more in a row.
  const DIGIT_WORDS_RE = new RegExp('\\b(?:(?:zero|one|two|three|four|five|six|seven|eight|nine|kosong|satu|dua|tiga|empat|lima|enam|tujuh|lapan|sembilan)[\\s,.\\-]+){7,}(?:zero|one|two|three|four|five|six|seven|eight|nine|kosong|satu|dua|tiga|empat|lima|enam|tujuh|lapan|sembilan)\\b|[零〇一二三四五六七八九](?:[\\s,.\\-]*[零〇一二三四五六七八九]){7,}', 'gi');
  function maskTyped(text) {
    const m1 = maskDigits(text);
    return typeof m1 === 'string' && m1 ? m1.replace(DIGIT_WORDS_RE, MASK) : m1;
  }
  function maskDigits(text) {
    if (text === undefined || text === null) return '';
    const s = String(text);
    if (!s) return s;
    const probe = digitsAscii(s);
    const re = /[+(]*\d+(?:[ .\-\/_()]{1,3}\d+)*/g;
    let out = '', last = 0, m;
    while ((m = re.exec(probe))) {
      const run = m[0], body = run.replace(/^[+(]+/, '');
      const count = body.replace(/\D/g, '').length;
      const groups = body.split(/[ .\-\/_()]+/);
      const dots = (body.match(/\./g) || []).length;
      const startsZeroOrPlus = run.indexOf('+') >= 0 && run.indexOf('+') < 2 || body.charAt(0) === '0';
      // a group of 3 or more digits, or ten or more single digits starting with 0 or + ("0 1 2 3 4 5 6 7 8 9")
      const groupRule = groups.some(g => g.length >= 3) || (count >= 10 && startsZeroOrPlus) || (count >= 10 && groups.length >= 5 && groups.every(g => g.length === 2)) || (groups.length >= 10 && groups.length <= 12 && groups.every(g => g.length === 1)); // five or more pairs in a row ("12 34 56 78 90"), or ten to twelve single digits in a row ("1 2 3 4 5 6 7 8 9 0", judge round 2). Short clinical lists ("1 2 3 4 5", "BP 120 80", a 1 to 10 pain scale with its two-digit 10) stay unmasked.
      const before = probe.charAt(m.index - 1), after = probe.charAt(m.index + run.length + 1);
      const inDecimal = (before === '.' && /\d/.test(probe.charAt(m.index - 2))) || (probe.charAt(m.index + run.length) === '.' && /\d/.test(after));
      const rn = RN_BEFORE.test(probe.slice(Math.max(0, m.index - 12), m.index));
      // one dot is a decimal (1.2345678, 7.2); phone-style dots need two or more
      const hit = count >= 8 && count <= 15 && groupRule && dots !== 1 && !DATE_SHAPE.test(body) && !inDecimal && !rn;
      if (hit) { out += s.slice(last, m.index) + MASK; last = m.index + run.length; }
    }
    return out + s.slice(last);
  }
  // Masks every string in a plain object or array (used for sample histories before they are shown or summarised).
  function maskDeep(v) {
    if (typeof v === 'string') return maskTyped(v);
    if (Array.isArray(v)) return v.map(maskDeep);
    if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach(k => { o[k] = maskDeep(v[k]); }); return o; }
    return v;
  }

  /* ---------- out-of-range numbers (polish round 8, item 3). A value outside the allowed range is named as wrong, never a generic reprompt. ---------- */
  const NUM_NAME = {
    hba1c: { en: 'HbA1c', ms: 'HbA1c', zh: 'HbA1c（糖化血红蛋白）', ar: 'HbA1c' },
    stairs: { en: 'The number of steps', ms: 'Bilangan anak tangga', zh: '台阶数', ar: 'عدد الدرجات' },
    acl_weeks: { en: 'The number of weeks', ms: 'Bilangan minggu', zh: '周数', ar: 'عدد الأسابيع' }
  };
  const NUM_NAME_DEFAULT = { en: 'This value', ms: 'Nilai ini', zh: '该数值', ar: 'هذه القيمة' };
  // Machine drafts for ms and zh (reviewed:false). The Arabic line is also a draft.
  const RANGE_TEXT = {
    en: (name, v, min, max) => `${name} ${v} looks wrong. The usual range is ${min} to ${max}. Please re-check it with your care team, then type the value again. If you do not know it, type unknown.`,
    ms: (name, v, min, max) => `${name} ${v} nampak tidak betul. Julat biasa ialah ${min} hingga ${max}. Sila semak semula dengan pasukan penjagaan anda, kemudian taip nilai itu semula. Jika anda tidak tahu, taip tidak tahu. (draf mesin)`,
    zh: (name, v, min, max) => `${name} ${v} 看起来不正确。常见范围是 ${min} 至 ${max}。请与您的护理团队重新核对，然后再输入一次该数值。如果不知道，请输入“不知道”。（机器草稿）`,
    ar: (name, v, min, max) => `يبدو أن ${name} ${v} غير صحيح. النطاق المعتاد من ${min} إلى ${max}. يرجى إعادة التحقق منه مع فريق الرعاية، ثم اكتب القيمة مرة أخرى. إذا لم تكن تعرفها، اكتب "لا أعرف". (مسودة آلية، تحتاج مراجعة)`
  };
  function rangeText(lang, qid, n, q) {
    const name = (NUM_NAME[qid] && NUM_NAME[qid][lang]) || NUM_NAME_DEFAULT[lang] || NUM_NAME_DEFAULT.en;
    return (RANGE_TEXT[lang] || RANGE_TEXT.en)(name, n, q.min, q.max);
  }

  /* ---------- builders ---------- */
  function O(value, en, ms, zh) { return { value, label: { en, ms, zh } }; }
  function Q(id, type, en, ms, zh, extra) {
    return Object.assign({ id, type, text: { en, ms, zh }, reviewed: false }, extra || {});
  }
  function YN(id, en, ms, zh, extra) { return Q(id, 'yesno', en, ms, zh, extra); }
  function CH(id, en, ms, zh, options, extra) { return Q(id, 'choice', en, ms, zh, Object.assign({ options }, extra)); }
  function TX(id, en, ms, zh, extra) { return Q(id, 'text', en, ms, zh, extra); }
  function NU(id, en, ms, zh, min, max, extra) { return Q(id, 'number', en, ms, zh, Object.assign({ min, max }, extra)); }

  /* ---------- COMMON: asked for every patient ---------- */
  const COMMON = [
    CH('sex', 'What is your sex?', 'Apakah jantina anda?', '您的性别是？', [
      O('female', 'Female', 'Perempuan', '女'),
      O('male', 'Male', 'Lelaki', '男'),
      O('prefer_not', 'Prefer not to say', 'Tidak mahu dinyatakan', '不便透露')
    ]),
    TX('medicines', 'List every medicine you take now, including vitamins and herbal products. Include doses if you know them.',
      'Senaraikan semua ubat yang anda ambil sekarang, termasuk vitamin dan produk herba. Sertakan dos jika anda tahu.',
      '请列出您目前服用的所有药物，包括维生素和草药产品。如果知道剂量，请一并写明。'),
    YN('blood_thinners', 'Do you take a blood thinner, such as aspirin, warfarin, rivaroxaban or apixaban?',
      'Adakah anda mengambil ubat pencair darah, seperti aspirin, warfarin, rivaroxaban atau apixaban?',
      '您是否服用抗凝血药，例如阿司匹林、华法林、利伐沙班或阿哌沙班？',
      { followUp: { yes: ['blood_thinner_detail'] } }),
    TX('blood_thinner_detail', 'Which one, at what dose, and when did you last take it?',
      'Yang mana, pada dos berapa, dan bila kali terakhir anda mengambilnya?',
      '是哪一种？剂量多少？最后一次服用是什么时候？'),
    YN('allergies', 'Do you have any allergy to medicines, latex or iodine (including contrast dye)?',
      'Adakah anda mempunyai alahan kepada ubat, latex atau iodin (termasuk pewarna kontras)?',
      '您是否对药物、乳胶或碘（包括造影剂）过敏？',
      { followUp: { yes: ['allergy_detail'] } }),
    TX('allergy_detail', 'Name each allergy and what happened, for example penicillin: rash.',
      'Nyatakan setiap alahan dan apa yang berlaku, contohnya penisilin: ruam.',
      '请列出每项过敏及出现的反应，例如青霉素：皮疹。'),
    YN('diabetes', 'Do you have diabetes?', 'Adakah anda menghidap diabetes?', '您是否患有糖尿病？',
      { followUp: { yes: ['hba1c'] } }),
    NU('hba1c', 'What was your last HbA1c (%)? Type unknown if you do not know.',
      'Berapakah HbA1c terakhir anda (%)? Taip tidak tahu jika anda tidak pasti.',
      '您最近一次的糖化血红蛋白（HbA1c）是百分之多少？不知道请输入“不知道”。', 3, 20),
    YN('heart_lung', 'Do you have a heart or lung disease, such as heart failure, angina, asthma or COPD?',
      'Adakah anda menghidap penyakit jantung atau paru-paru, seperti kegagalan jantung, angina, asma atau COPD?',
      '您是否患有心脏或肺部疾病，例如心衰、心绞痛、哮喘或慢阻肺？'),
    YN('kidney', 'Do you have kidney disease, or do you need dialysis?',
      'Adakah anda menghidap penyakit buah pinggang, atau memerlukan dialisis?',
      '您是否患有肾病，或需要透析？'),
    YN('anaesthetic', 'Have you, or a close family member, had a problem with anaesthetic or sedation?',
      'Adakah anda, atau ahli keluarga terdekat, pernah menghadapi masalah dengan anestetik atau bius?',
      '您或您的近亲是否曾在麻醉或镇静时出现过问题？',
      { followUp: { yes: ['anaesthetic_detail'] } }),
    TX('anaesthetic_detail', 'What happened, and who had it?',
      'Apa yang berlaku, dan siapa yang mengalaminya?', '发生了什么？是谁遇到的？'),
    CH('smoking', 'Do you smoke, or use vapes or e-cigarettes?',
      'Adakah anda merokok, atau menggunakan vape atau rokok elektronik?',
      '您是否吸烟，或使用电子烟？', [
        O('never', 'Never', 'Tidak pernah', '从不'),
        O('former', 'Stopped', 'Sudah berhenti', '已戒'),
        O('current', 'Still smoke or vape', 'Masih merokok atau vape', '仍在吸烟或用电子烟')
      ]),
    CH('alcohol', 'How often do you drink alcohol?', 'Berapa kerap anda minum alkohol?', '您多久饮酒一次？', [
      O('none', 'Never', 'Tidak pernah', '不饮酒'),
      O('occasional', 'Occasionally', 'Kadang-kadang', '偶尔'),
      O('regular', 'Regularly', 'Kerap', '经常')
    ]),
    YN('same_joint', 'Have you had any earlier surgery on this same joint or area?',
      'Adakah anda pernah menjalani pembedahan terdahulu pada sendi atau kawasan yang sama?',
      '这个部位以前是否做过手术？',
      { followUp: { yes: ['same_joint_detail'] } }),
    TX('same_joint_detail', 'What surgery was it, and when?', 'Pembedahan apa, dan bila?', '做的是什么手术？是什么时候？'),
    YN('hospital_mrsa', 'In the past year, were you admitted to hospital, or have you been told you carry MRSA?',
      'Dalam setahun yang lalu, adakah anda dimasukkan ke hospital, atau pernah diberitahu anda membawa MRSA?',
      '过去一年内您是否住过院，或被告知携带过MRSA（耐甲氧西林金黄色葡萄球菌）？'),
    YN('pregnancy', 'Are you pregnant, or could you be pregnant?', 'Adakah anda hamil, atau mungkin hamil?',
      '您是否怀孕，或有可能怀孕？', { skipIf: a => a.sex === 'male' }),
    YN('symptoms_now', 'Right now, do you have chest pain, trouble breathing, or confusion?',
      'Sekarang ini, adakah anda sakit dada, sesak nafas, atau keliru?',
      '您现在是否有胸痛、呼吸困难或意识混乱？',
      { redFlagIf: 'yes', redLevel: 'EMERGENCY' }),
    CH('home_help', 'Who will help you at home in the first two weeks after surgery?',
      'Siapa yang akan membantu anda di rumah dalam dua minggu pertama selepas pembedahan?',
      '术后头两周，谁会在家里帮助您？', [
        O('family', 'Family', 'Ahli keluarga', '家人'),
        O('alone', 'I will be on my own', 'Saya akan seorang diri', '我会独自一人'),
        O('helper', 'A hired helper', 'Pembantu upahan', '雇用的帮手'),
        O('unsure', 'Not sure yet', 'Belum pasti', '还不确定')
      ]),
    YN('lives_alone', 'Do you live alone?', 'Adakah anda tinggal seorang diri?', '您是否独居？'),
    NU('stairs', 'How many steps are inside your home, for example to the bedroom or toilet? Enter 0 if none.',
      'Berapa anak tangga di dalam rumah anda, contohnya ke bilik tidur atau tandas? Masukkan 0 jika tiada.',
      '您家中有多少级台阶，例如通往卧室或厕所的台阶？没有请填0。', 0, 500),
    CH('mobility_aid', 'Do you use anything to help you walk?', 'Adakah anda menggunakan sebarang alat bantu untuk berjalan?',
      '您走路时是否使用任何助行工具？', [
        O('none', 'No aid', 'Tiada', '不用'),
        O('stick', 'Walking stick', 'Tongkat', '手杖'),
        O('frame', 'Walking frame', 'Alat bantu berjalan', '助行架'),
        O('crutches', 'Crutches', 'Tongkat ketiak', '拐杖'),
        O('wheelchair', 'Wheelchair', 'Kerusi roda', '轮椅')
      ]),
    CH('payer', 'How will this treatment be paid for?', 'Bagaimanakah rawatan ini akan dibayar?', '这次治疗的费用由谁支付？', [
      O('self', 'Self-paid', 'Bayar sendiri', '自费'),
      O('employer', 'Employer or company scheme', 'Skim syarikat majikan', '雇主或公司计划'),
      O('insurance', 'Private insurance', 'Insurans swasta', '私人保险'),
      O('government', 'Government scheme', 'Skim kerajaan', '政府计划'),
      O('other', 'Other', 'Lain-lain', '其他')
    ]),
    CH('contact_language', 'Which language would you like us to use when we contact you?',
      'Bahasa apakah yang anda mahu kami gunakan apabila menghubungi anda?', '我们联络您时，希望使用哪种语言？', [
        O('en', 'English', 'Bahasa Inggeris', '英文'),
        O('ms', 'Bahasa Malaysia', 'Bahasa Malaysia', '马来文'),
        O('zh', 'Chinese', 'Bahasa Cina', '中文')
      ]),
    TX('final_note', 'Is there anything else you want the team to know, or any symptom you are worried about?',
      'Adakah ada apa-apa lagi yang ingin anda beritahu pasukan, atau sebarang gejala yang anda bimbangkan?',
      '还有什么您希望团队了解的，或您担心的任何症状吗？')
  ];

  /* ---------- procedure-specific questions ---------- */
  const BY_PROC = {
    TKR: [
      CH('tkr_walk', 'How far can you walk before your knee makes you stop?',
        'Berapa jauh anda boleh berjalan sebelum lutut memaksa anda berhenti?', '走多远时膝盖会让您不得不停下来？', [
          O('under_100', 'Under 100 metres', 'Kurang 100 meter', '不到100米'),
          O('100_500', '100 to 500 metres', '100 hingga 500 meter', '100至500米'),
          O('over_500', 'More than 500 metres', 'Lebih 500 meter', '超过500米'),
          O('cannot', 'I cannot walk', 'Saya tidak boleh berjalan', '无法行走')
        ]),
      YN('tkr_night', 'Does knee pain wake you at night?', 'Adakah sakit lutut menjaga anda pada waktu malam?', '膝盖疼痛是否会在夜间把您痛醒？'),
      YN('tkr_injection', 'Have you had a steroid or other injection into the knee in the past six months?',
        'Adakah anda menerima suntikan steroid atau suntikan lain ke dalam lutut dalam enam bulan lalu?',
        '过去六个月内，您是否在膝盖内注射过类固醇或其他药物？'),
      YN('tkr_calf', 'Do you have calf pain or swelling in the leg to be operated on right now?',
        'Sekarang ini, adakah anda mengalami sakit atau bengkak betis pada kaki yang akan dibedah?',
        '您现在是否在计划手术的那条腿上出现小腿疼痛或肿胀？',
        { redFlagIf: 'yes', redLevel: 'SAME-DAY' })
    ],
    THR: [
      CH('thr_socks', 'Can you put on socks and shoes by yourself?', 'Bolehkah anda memakai stoking dan kasut sendiri?',
        '您能否自己穿袜子和鞋子？', [
          O('independent', 'Yes, by myself', 'Ya, sendiri', '可以，自己完成'),
          O('with_help', 'Only with help', 'Hanya dengan bantuan', '需要别人帮忙'),
          O('cannot', 'No, I cannot', 'Tidak, saya tidak boleh', '不能')
        ]),
      YN('thr_limp', 'Do you limp when you walk?', 'Adakah anda tempang apabila berjalan?', '走路时您是否一瘸一拐？'),
      YN('thr_injection', 'Have you had an injection into the hip in the past six months?',
        'Adakah anda menerima suntikan ke dalam pinggul dalam enam bulan lalu?', '过去六个月内，您是否在髋关节内注射过药物？'),
      YN('thr_leg_length', 'Have you noticed that one leg looks shorter than the other?',
        'Adakah anda perasan salah satu kaki kelihatan lebih pendek daripada yang lain?', '您是否注意到一条腿看起来比另一条短？')
    ],
    ACL: [
      YN('acl_giving_way', 'Does the knee give way when you pivot, twist or go down stairs?',
        'Adakah lutut anda longgar atau hilang kekuatan apabila anda berpusing, memulas atau menuruni tangga?',
        '膝盖在转身、扭转或下楼梯时是否会突然发软或失去支撑？'),
      NU('acl_weeks', 'How many weeks ago did the injury happen? Type unknown if you are not sure.',
        'Berapa minggu lalu kecederaan berlaku? Taip tidak tahu jika anda tidak pasti.',
        '受伤距今多少周？不确定请输入“不知道”。', 0, 1040),
      YN('acl_other', 'Have you had any other knee injury, such as a meniscus or cartilage tear?',
        'Adakah anda pernah mengalami kecederaan lutut lain, seperti koyakan meniskus atau tulang rawan?',
        '您的膝盖是否还有其他损伤，例如半月板或软骨撕裂？'),
      TX('acl_sport', 'Which sport or activity do you want to return to?',
        'Sukan atau aktiviti apakah yang ingin anda kembali lakukan?', '您希望恢复哪项运动或活动？')
    ],
    LUMBAR: [
      YN('lum_leg_weak', 'Have you noticed new or worsening weakness in one or both legs?',
        'Adakah anda perasan kelemahan baharu atau semakin teruk pada satu atau kedua-dua kaki?',
        '您是否注意到一条或两条腿出现新的或加重的无力？',
        { redFlagIf: 'yes', redLevel: 'SAME-DAY' }),
      YN('lum_bladder', 'Have you had any new change in passing urine, controlling urine, or controlling your bowels?',
        'Adakah anda mengalami sebarang perubahan baharu dalam membuang air kecil, mengawal air kencing, atau mengawal najis?',
        '您是否出现了新的小便困难、小便失禁或大便失禁？',
        { redFlagIf: 'yes', redLevel: 'EMERGENCY' }),
      YN('lum_saddle', 'Have you noticed numbness around the back passage, groin, or inner thighs?',
        'Adakah anda perasan kebas di sekitar dubur, pangkal paha, atau paha dalam?',
        '您是否注意到肛门周围、会阴或大腿内侧麻木？',
        { redFlagIf: 'yes', redLevel: 'EMERGENCY' }),
      CH('lum_distance', 'Where does your leg pain go?', 'Ke mana sakit kaki anda merebak?', '您的腿痛会延伸到哪里？', [
        O('back_only', 'Back only, no leg pain', 'Belakang sahaja, tiada sakit kaki', '只有背痛，腿不痛'),
        O('buttock', 'Buttock', 'Punggung', '臀部'),
        O('thigh', 'Thigh', 'Paha', '大腿'),
        O('below_knee', 'Below the knee', 'Di bawah lutut', '膝盖以下')
      ]),
      YN('lum_claudication', 'Does walking bring on leg pain that eases when you sit or lean forward?',
        'Adakah berjalan menyebabkan sakit kaki yang reda apabila anda duduk atau membongkok ke hadapan?',
        '走路时是否会引起腿痛，并在坐下或身体前倾后缓解？')
    ],
    SHOULDER: [
      YN('sh_night', 'Does shoulder pain keep you awake, especially when lying on that side?',
        'Adakah sakit bahu menjaga anda terjaga, terutamanya apabila berbaring di sebelah itu?',
        '肩部疼痛是否会让您睡不好，尤其是侧躺在患侧时？'),
      CH('sh_overhead', 'How well can you lift the operated arm above your head?',
        'Sejauh mana anda boleh mengangkat lengan yang akan dibedah ke atas kepala?',
        '您能把要手术的那条手臂举过头顶到什么程度？', [
          O('full', 'Fully, without help', 'Sepenuhnya, tanpa bantuan', '完全可以，不需要帮忙'),
          O('partial', 'Partly', 'Sebahagian', '部分可以'),
          O('none', 'Not at all', 'Langsung tidak boleh', '完全不能')
        ]),
      CH('sh_dominant', 'Which hand do you write with?', 'Tangan manakah yang anda gunakan untuk menulis?', '您用哪只手写字？', [
        O('right', 'Right', 'Kanan', '右手'),
        O('left', 'Left', 'Kiri', '左手')
      ]),
      YN('sh_fingers', 'Are the fingers on the operated arm numb, cold or pale right now?',
        'Sekarang ini, adakah jari pada lengan yang akan dibedah kebas, sejuk atau pucat?',
        '您现在要手术那条手臂的手指是否麻木、发冷或发白？',
        { redFlagIf: 'yes', redLevel: 'SAME-DAY' })
    ],
    FOOTANKLE: [
      CH('fa_shoes', 'What shoes can you wear now?', 'Kasut jenis apakah yang boleh anda pakai sekarang?', '您现在能穿哪种鞋？', [
        O('normal', 'My normal shoes', 'Kasut biasa saya', '我平时穿的鞋'),
        O('wide', 'Only wide or special shoes', 'Hanya kasut lebar atau khas', '只能穿宽鞋或特制鞋'),
        O('none', 'I cannot wear shoes', 'Saya tidak boleh pakai kasut', '无法穿鞋')
      ]),
      YN('fa_sore', 'Is there an open sore, blister or ulcer on the foot or ankle to be operated on?',
        'Adakah terdapat luka terbuka, lepuh atau ulser pada kaki atau buku lali yang akan dibedah?',
        '要手术的脚或踝部是否有开放性伤口、水疱或溃疡？',
        { redFlagIf: 'yes', redLevel: 'SAME-DAY' }),
      YN('fa_toes', 'Are your toes on that foot cold, pale, blue or purple?',
        'Adakah jari kaki pada kaki itu sejuk, pucat, biru atau ungu?', '该脚的脚趾是否发冷、苍白、发蓝或发紫？',
        { redFlagIf: 'yes', redLevel: 'SAME-DAY' }),
      YN('fa_falls', 'Have you fallen in the past six months?', 'Adakah anda pernah jatuh dalam enam bulan lalu?', '过去六个月内您是否曾经跌倒？')
    ]
  };

  /* ---------- Arabic (ar): machine draft, Gulf-friendly simple MSA, reviewed:false. Every question and option has one. ---------- */
  // Each entry: [question text] or [question text, { option value: label }] for choice questions.
  const AR_Q = {
    sex: ['ما هو جنسك؟', { female: 'أنثى', male: 'ذكر', prefer_not: 'أفضل عدم الإفصاح' }],
    medicines: ['اذكر كل الأدوية التي تتناولها الآن، بما في ذلك الفيتامينات والمنتجات العشبية. اذكر الجرعات إن كنت تعرفها.'],
    blood_thinners: ['هل تتناول مميّعا للدم، مثل الأسبرين أو الوارفارين أو الريفاروكسابان أو الأبيكسابان؟'],
    blood_thinner_detail: ['أيّ منها، وبأي جرعة، ومتى كانت آخر مرة تناولته؟'],
    allergies: ['هل لديك حساسية من الأدوية أو اللاتكس أو اليود (بما في ذلك صبغة الأشعة)؟'],
    allergy_detail: ['اذكر كل حساسية وما الذي حدث، مثلا: البنسلين: طفح جلدي.'],
    diabetes: ['هل لديك مرض السكري؟'],
    hba1c: ['ما هي آخر نتيجة لتحليل HbA1c (%)؟ اكتب "لا أعرف" إذا لم تكن تعرفها.'],
    heart_lung: ['هل لديك مرض في القلب أو في الرئة، مثل فشل القلب أو الذبحة الصدرية أو الربو أو مرض الانسداد الرئوي المزمن (COPD)؟'],
    kidney: ['هل لديك مرض في الكلى، أو تحتاج إلى غسيل الكلى؟'],
    anaesthetic: ['هل سبق لك، أو لأحد أقاربك المقربين، أن واجه مشكلة مع التخدير أو التهدئة؟'],
    anaesthetic_detail: ['ماذا حدث، ومن الذي تعرض لذلك؟'],
    smoking: ['هل تدخن، أو تستخدم السجائر الإلكترونية أو الفيب؟', { never: 'لا، أبدا', former: 'توقفت عن ذلك', current: 'ما زلت أدخن أو أستخدم الفيب' }],
    alcohol: ['كم مرة تشرب الكحول؟', { none: 'لا أشرب أبدا', occasional: 'أحيانا', regular: 'بانتظام' }],
    same_joint: ['هل سبق أن أجريت أي عملية سابقة على نفس المفصل أو المنطقة؟'],
    same_joint_detail: ['ما نوع تلك العملية، ومتى أجريتها؟'],
    hospital_mrsa: ['خلال السنة الماضية، هل دخلت المستشفى، أو أُخبرت أنك تحمل بكتيريا MRSA؟'],
    pregnancy: ['هل أنتِ حامل، أو ربما تكونين حاملا؟'],
    symptoms_now: ['الآن، هل لديك ألم في الصدر أو ضيق في التنفس أو تشوش في الوعي؟'],
    home_help: ['من سيساعدك في المنزل خلال أول أسبوعين بعد العملية؟', { family: 'العائلة', alone: 'سأكون وحدي', helper: 'مساعدة مدفوعة الأجر', unsure: 'لست متأكدا بعد' }],
    lives_alone: ['هل تعيش وحدك؟'],
    stairs: ['كم عدد درجات السلم داخل منزلك، مثلا للوصول إلى غرفة النوم أو الحمام؟ اكتب 0 إذا لم يوجد سلم.'],
    mobility_aid: ['هل تستخدم أي شيء لمساعدتك على المشي؟', { none: 'لا أستخدم شيئا', stick: 'عصا', frame: 'مشاية (إطار للمشي)', crutches: 'عكازان', wheelchair: 'كرسي متحرك' }],
    payer: ['كيف سيتم دفع تكلفة هذا العلاج؟', { self: 'دفع ذاتي', employer: 'عبر جهة العمل أو برنامج الشركة', insurance: 'تأمين خاص', government: 'برنامج حكومي', other: 'أخرى' }],
    contact_language: ['ما اللغة التي تفضل أن نستخدمها عند التواصل معك؟', { en: 'الإنجليزية', ms: 'الماليزية', zh: 'الصينية', ar: 'العربية' }],
    final_note: ['هل هناك أي شيء آخر تريد أن يعرفه الفريق، أو أي عرض يقلقك؟'],
    tkr_walk: ['إلى أي مسافة تستطيع المشي قبل أن تضطرك الركبة إلى التوقف؟', { under_100: 'أقل من 100 متر', '100_500': 'من 100 إلى 500 متر', over_500: 'أكثر من 500 متر', cannot: 'لا أستطيع المشي' }],
    tkr_night: ['هل يوقظك ألم الركبة في الليل؟'],
    tkr_injection: ['هل أخذت حقنة ستيرويد أو أي حقنة أخرى في الركبة خلال الأشهر الستة الماضية؟'],
    tkr_calf: ['هل لديك ألم أو تورم في الساق في الرجل المقرر إجراء العملية عليها الآن؟'],
    thr_socks: ['هل تستطيع لبس الجوارب والحذاء بنفسك؟', { independent: 'نعم، بنفسي', with_help: 'فقط بمساعدة', cannot: 'لا، لا أستطيع' }],
    thr_limp: ['هل تعرج عند المشي؟'],
    thr_injection: ['هل أخذت حقنة في الورك خلال الأشهر الستة الماضية؟'],
    thr_leg_length: ['هل لاحظت أن إحدى الرجلين تبدو أقصر من الأخرى؟'],
    acl_giving_way: ['هل تنخلع الركبة أو تفقد ثباتها عند الدوران أو اللف أو النزول على الدرج؟'],
    acl_weeks: ['منذ كم أسبوعا حدثت الإصابة؟ اكتب "لا أعرف" إذا لم تكن متأكدا.'],
    acl_other: ['هل سبق أن أصبت بإصابة أخرى في الركبة، مثل تمزق الغضروف الهلالي؟'],
    acl_sport: ['ما الرياضة أو النشاط الذي تريد أن تعود إليه؟'],
    lum_leg_weak: ['هل لاحظت ضعفا جديدا، أو يزداد سوءا، في رجل واحدة أو في الرجلين؟'],
    lum_bladder: ['هل حدث أي تغيير جديد في التبول، أو في التحكم في البول، أو في التحكم في الأمعاء؟'],
    lum_saddle: ['هل لاحظت تنميلا حول فتحة الشرج أو منطقة الأعضاء التناسلية أو الجزء الداخلي من الفخذين؟'],
    lum_distance: ['إلى أين يمتد ألم ساقك؟', { back_only: 'الظهر فقط، دون ألم في الساق', buttock: 'الأرداف', thigh: 'الفخذ', below_knee: 'أسفل الركبة' }],
    lum_claudication: ['هل يسبب المشي ألما في الساق يخف عندما تجلس أو تنحني إلى الأمام؟'],
    sh_night: ['هل يبقيك ألم الكتف مستيقظا، خاصة عند النوم على ذلك الجانب؟'],
    sh_overhead: ['إلى أي مدى تستطيع رفع الذراع المقرر إجراء العملية عليها فوق رأسك؟', { full: 'بالكامل، دون مساعدة', partial: 'جزئيا', none: 'لا أستطيع إطلاقا' }],
    sh_dominant: ['بأي يد تكتب؟', { right: 'اليمنى', left: 'اليسرى' }],
    sh_fingers: ['هل أصابع الذراع المقرر إجراء العملية عليها مخدرة أو باردة أو شاحبة الآن؟'],
    fa_shoes: ['ما نوع الحذاء الذي تستطيع لبسه الآن؟', { normal: 'حذائي المعتاد', wide: 'فقط أحذية واسعة أو خاصة', none: 'لا أستطيع لبس الحذاء' }],
    fa_sore: ['هل يوجد جرح مفتوح أو بثرة أو قرحة على القدم أو الكاحل المقرر إجراء العملية عليه؟'],
    fa_toes: ['هل أصابع القدم في ذلك الجانب باردة أو شاحبة أو زرقاء أو بنفسجية؟'],
    fa_falls: ['هل سقطت خلال الأشهر الستة الماضية؟']
  };
  // Option added for every language (contact language now includes Arabic).
  const CONTACT_AR_OPTION = [O('ar', 'Arabic', 'Bahasa Arab', '阿拉伯语')];

  /* ---------- lookup ---------- */
  const BANK = {};
  COMMON.concat(...PROCEDURES.map(p => BY_PROC[p])).forEach(q => {
    if (q.id === 'contact_language') q.options.push(...CONTACT_AR_OPTION);
    const a = AR_Q[q.id];
    if (!a) throw new Error('no ar text for question ' + q.id);
    q.text.ar = a[0];
    if (q.type === 'choice') {
      q.options.forEach(o => {
        if (!a[1] || typeof a[1][o.value] !== 'string') throw new Error('no ar label for ' + q.id + '.' + o.value);
        o.label.ar = a[1][o.value];
      });
    }
    BANK[q.id] = q;
  });

  /* ---------- helpers ---------- */
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function reprompt(s, why) { s.reprompt = true; s.lastError = why; return s; }
  function rank(level) { return LEVEL_RANK[level] || 0; }
  function canonReply(level, lang, procedure) {
    const order = [CANON[level][lang], CANON[level].en];
    for (const phrase of order) {
      const r = engine.classify(phrase, { procedure, mode: 'intake' });
      if (r.cls === level && r.reply) return r.reply;
    }
    return '';
  }
  function applyRed(s, hit) {
    hit.flags.forEach(f => { if (!s.flags.includes(f)) s.flags.push(f); });
    if (!s.red || rank(hit.level) > rank(s.red.level)) {
      s.red = { level: hit.level, reply: hit.reply, flags: hit.flags.slice(), source: hit.source, qid: hit.qid };
    }
  }
  function isClinicalRoute(r) { return (r.flags || []).some(f => /clinical judgement|worsening/.test(f)); }
  function recordRoute(s, qid, r, text) { s.routeFlags.push({ qid, cls: r.cls, flags: r.flags.slice(), text, reply: r.reply || '' }); }
  function matchesRed(q, value) {
    const rf = q.redFlagIf;
    if (rf === undefined) return false;
    if (typeof rf === 'function') return !!rf(value);
    if (Array.isArray(rf)) return rf.includes(value);
    return value === rf;
  }
  // polish item 2: an option matched exactly (value or any label), so "Not sure yet" stays the option, not the unknown answer.
  function exactOption(q, raw) {
    const s = arNorm(raw).trim().toLowerCase();
    const L = x => arNorm(x).toLowerCase();
    for (const o of q.options) {
      if ([o.value, o.label.en, o.label.ms, o.label.zh, o.label.ar].map(x => L(x)).includes(s)) return o.value;
    }
    return null;
  }
  function matchOption(q, raw) {
    const s = arNorm(raw).trim().toLowerCase();
    const L = x => arNorm(x).toLowerCase();
    for (const o of q.options) {
      const exact = [o.value, o.label.en, o.label.ms, o.label.zh, o.label.ar].map(x => L(x));
      if (exact.includes(s)) return o.value;
    }
    for (const o of q.options) {
      const inside = [o.label.en, o.label.ms, o.label.zh, o.label.ar].map(x => L(x))
        .filter(l => l.length >= 2 || /[一-鿿]/.test(l));
      if (inside.some(l => s.includes(l))) return o.value;
    }
    return null;
  }
  function parseNumber(raw) {
    const n = arNorm(raw); // Arabic-Indic digits and the Arabic decimal mark become ASCII first
    if (UNK_RE.test(n)) return 'unknown';
    const m = n.match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  function parseYesNo(raw, original) {
    if (typeof original === 'boolean') return original ? 'yes' : 'no';
    const n = arNorm(raw);
    if (YES_RE.test(n)) return 'yes';
    if (NO_RE.test(n)) return 'no';
    return null;
  }
  function pruneSkipped(s) {
    s.queue = s.queue.filter(id => !(id in s.answers) && !(BANK[id].skipIf && BANK[id].skipIf(s.answers)));
    s.current = s.queue[0] || null;
    s.done = s.queue.length === 0;
  }

  /* ---------- public API ---------- */
  function build(procedure, lang, pid) {
    if (!BY_PROC[procedure]) throw new Error('unknown procedure: ' + procedure);
    if (!LANGS.includes(lang)) throw new Error('unsupported language: ' + lang);
    const s = {
      pid: pid || null, procedure, lang, answers: {}, freeText: [], flags: [], red: null, routeFlags: [],
      queue: COMMON.concat(BY_PROC[procedure]).map(q => q.id), current: null, done: false, reprompt: false, lastError: null,
      rangeMsg: null
    };
    pruneSkipped(s);
    return s;
  }

  function next(state, answerValue) {
    if (!state || state.done) return state;
    const s = clone(state);
    s.reprompt = false; s.lastError = null; s.rangeMsg = null;
    const qid = s.current; const q = BANK[qid];
    if (answerValue === undefined || answerValue === null) return reprompt(s, 'no answer');

    // 1. Safety first: any typed or spoken text goes through the engine classifier before interpretation.
    // The classifier reads the ORIGINAL text. Only `safe` (phone and IC-shaped runs masked) is stored or kept.
    const raw = String(answerValue);
    const text = raw.trim();
    const safe = maskTyped(text);
    let redHit = null; let routeR = null;
    if (text) {
      const r = engine.classify(text, { procedure: s.procedure, mode: 'intake' });
      if (r.cls === 'EMERGENCY' || r.cls === 'SAME-DAY') {
        redHit = { level: r.cls, flags: r.flags.slice(), reply: r.reply, source: 'free_text', qid };
      } else if (r.noAnswer) {
        routeR = r;
      }
    }

    // 2. Interpret the answer for this question.
    let value = null; let parsed = true; let rangeN = null;
    if (typeof answerValue === 'boolean' && q.type === 'yesno') value = parseYesNo(text, answerValue);
    else if (q.type === 'yesno') value = UNK_RE.test(arNorm(text)) ? 'unknown' : parseYesNo(text, null); // round 6: unknown is a recorded answer, never a forced yes or no
    else if (q.type === 'choice') {
      // polish item 2: "I don't know" is a recorded answer on a choice question, never a forced pick. An exact option wins over the unknown words.
      value = text ? (exactOption(q, text) || (UNK_RE.test(arNorm(text)) ? 'unknown' : matchOption(q, text))) : null;
    } else if (q.type === 'number') {
      const n = parseNumber(text);
      if (n === 'unknown' || (n === null && NUM_NONE_RE.test(arNorm(text)))) value = 'unknown';
      else if (typeof n === 'number' && n >= q.min && n <= q.max) value = n;
      else if (typeof n === 'number') rangeN = n; // polish item 3: named as wrong, with a re-check request
    } else if (q.type === 'text') value = text ? safe : null;

    if (value === null) {
      if (!redHit) {
        // review2 M2 (round 4): a clinical question typed at a choice or yes/no prompt is kept, not dropped.
        if (routeR && isClinicalRoute(routeR)) recordRoute(s, qid, routeR, safe);
        const rp = reprompt(s, routeR && isClinicalRoute(routeR) ? 'route' : (rangeN !== null ? 'range' : 'unrecognised'));
        if (rangeN !== null) rp.rangeMsg = rangeText(s.lang, qid, rangeN, q);
        return rp;
      }
      value = safe; parsed = false; // advance on the masked text; the red flag stands
    }

    // 3. Record the answer and any red flag.
    if (redHit) applyRed(s, redHit);
    if (routeR && (q.type === 'text' || !parsed || isClinicalRoute(routeR))) recordRoute(s, qid, routeR, safe);
    s.answers[qid] = value;
    if (q.type === 'text' || !parsed) s.freeText.push(safe);
    if (q.redFlagIf !== undefined && matchesRed(q, value)) {
      applyRed(s, { level: q.redLevel, flags: [qid], reply: canonReply(q.redLevel, s.lang, s.procedure), source: 'question', qid });
    }

    // 4. Advance: follow-ups go next, then drop skipped questions.
    s.queue.shift();
    const follow = (q.followUp && q.followUp[String(value)]) || [];
    s.queue = follow.concat(s.queue);
    pruneSkipped(s);
    return s;
  }

  function prompt(state) {
    if (!state || state.done || !state.current) return null;
    const q = BANK[state.current];
    return {
      id: q.id, type: q.type, text: q.text[state.lang], draft: state.lang !== 'en',
      options: q.options ? q.options.map(o => ({ value: o.value, label: o.label[state.lang] })) : undefined,
      min: q.min, max: q.max
    };
  }

  function isComplete(state) { return !!(state && state.done === true); }

  // Round 3 (open problem A): one mapping table, mod/idmap.js, covers every question id and value normalisation.
  // The summary reads intake ids; every interview answer is also kept under its question text (questions) so the
  // summary can list anything that has no summary line under "Recorded, not summarised".
  function shownOf(q, v, lang) {
    if (v === 'unknown') return { en: 'unknown', ms: 'tidak tahu', zh: '不知道', ar: 'لا أعرف' }[lang];
    if (q.type === 'choice') { const o = q.options.find(x => x.value === v); return o ? o.label[lang] : String(v); }
    if (q.type === 'yesno') {
      const w = { en: { yes: 'Yes', no: 'No' }, ms: { yes: 'Ya', no: 'Tidak' }, zh: { yes: '是', no: '否' }, ar: { yes: 'نعم', no: 'لا' } }[lang];
      return w[v] || String(v);
    }
    return String(v);
  }
  function toAnswers(state) {
    const questions = {};
    Object.keys(state.answers).forEach(qid => {
      const q = BANK[qid];
      if (q) questions[qid] = { text: q.text[state.lang], shown: shownOf(q, state.answers[qid], state.lang) };
    });
    return {
      pid: state.pid, procedure: state.procedure, lang: state.lang,
      answers: IDMAP.toIntake(state.answers, state.procedure),
      freeText: state.freeText.slice(),
      interviewAnswers: clone(state.answers),
      questions,
      routes: clone(state.routeFlags || [])
    };
  }

  /* ---------- Arabic sample patients (fictional). Each script is typed through next(), so the answers are the interview's own. ---------- */
  const AR_SAMPLES = [
    { pid: 'AR-S1', case: 'Knee replacement, diabetes, blood thinner, penicillin allergy (fictional)', caseAr: 'استبدال مفصل الركبة مع السكري ومميّع للدم وحساسية البنسلين (وهمي)', procedure: 'TKR',
      script: { sex: 'أنثى', medicines: 'باراسيتامول 500 ملغ عند الحاجة', blood_thinners: 'نعم', blood_thinner_detail: 'أسبرين 75 ملغ، آخر جرعة أمس',
        allergies: 'نعم', allergy_detail: 'البنسلين: طفح جلدي', diabetes: 'نعم', hba1c: '٩٫١', tkr_walk: 'من 100 إلى 500 متر',
        tkr_night: 'نعم', final_note: 'الألم في الركبة يزداد في الليل' } },
    { pid: 'AR-S2', case: 'Lumbar, new numbness in the saddle area (fictional)', caseAr: 'أسفل الظهر مع تنميل جديد في منطقة السرج (وهمي)', procedure: 'LUMBAR',
      script: { lum_saddle: 'نعم', lum_distance: 'الأرداف', final_note: 'لا شيء آخر' } },
    { pid: 'AR-S3', case: 'Hip replacement, lives alone with stairs at home (fictional)', caseAr: 'استبدال مفصل الورك، يعيش وحده ولديه درج في المنزل (وهمي)', procedure: 'THR',
      script: { home_help: 'سأكون وحدي', lives_alone: 'نعم', stairs: '١٢', mobility_aid: 'عكازان', payer: 'تأمين خاص', thr_limp: 'نعم',
        final_note: 'لا شيء آخر' } }
  ];
  function defaultAr(q) {
    if (q.type === 'yesno') return 'لا';
    if (q.type === 'choice') return q.options[0].label.ar;
    if (q.type === 'number') return 5;
    return 'لا شيء';
  }
  // One Arabic sample run through the interview, returned in the shape the page loads (toAnswers plus case and pid).
  function arSample(index) {
    const S = AR_SAMPLES[index];
    if (!S) return null;
    let s = build(S.procedure, 'ar', S.pid); let guard = 0;
    while (!s.done && guard++ < 200) {
      const q = BANK[s.current];
      const a = Object.prototype.hasOwnProperty.call(S.script, q.id) ? S.script[q.id] : defaultAr(q);
      s = next(s, a);
      if (s.reprompt) break;
    }
    return Object.assign(toAnswers(s), { case: S.case, caseAr: S.caseAr, pid: S.pid, sample: true, complete: s.done === true, reprompt: !!s.reprompt });
  }
  const AR_SAMPLE_COUNT = AR_SAMPLES.length;

  const api = { COMMON, BY_PROC, PROCEDURES, LANGS, build, next, isComplete, toAnswers, prompt, BANK, arSample, AR_SAMPLE_COUNT, arNorm,
    maskTyped, maskDeep, MASK, rangeText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PL_INTERVIEW = api;
})(this);
