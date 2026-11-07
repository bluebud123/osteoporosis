/*
 * OsteoLoop patient check-in: what the patient fills in before every clinic visit (about 3 minutes).
 * Two question sets: 'first' (before the first clinic, no treatment yet) and 'review' (on treatment).
 * Both end with a visit section: chief complaint, where, how long, pain, night pain, walking,
 * red flags, medicines, allergies, worries. The visit section is appended before the 'ask' question.
 *
 * flags() turns answers into clinician flags, deterministically. Free text is never parsed to
 * decide risk: the chief complaint and other free text are shown verbatim, and only the
 * ask-the-doctor text is quoted in a flag. Patient-reported answers never change the risk
 * category on their own: a clinician confirms first.
 * summary(c) builds the clinician one-page summary as structured sections. No AI.
 *
 * Languages: en (reference), ar, ms. TRANSLATION STATUS: English is the reference. Arabic and Malay
 * were drafted by the author. Both NEED NATIVE CLINICAL REVIEW before any patient sees them.
 * Arabic wording is gender-neutral: plural forms for direct address (اختاروا، أجيبوا), first person
 * for answer options (توقفتُ، لست واثقًا), and impersonal or passive constructions. Malay uses 'anda'.
 * bench/run-checkin.js scans the Arabic for common feminine and masculine second-person forms.
 *
 * Sources: MYCPG = Malaysian CPG 2022, NICE = NG259, FRAX = FRAX calculator input,
 *          LOCAL = awaiting clinician sign-off (drug safety and visit red flags; see docs/checkin.md),
 *          PATIENT = the patient's own words, shown verbatim.
 * Works in the browser (window.OsteoCheckin) and in Node (module.exports).
 */
(function (root) {
  const LANGS = ['en', 'ar', 'ms'];
  const NONE = '__none__';                        // stored for "None" on a free-text question
  const NONE_LBL = { en: 'None', ar: 'لا شيء', ms: 'Tiada' };
  const MAX_TEXT = 1000;                          // characters kept from any free-text answer
  const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
  const PR = 'patient-reported';
  const YN = { en: ['Yes', 'No'], ar: ['نعم', 'لا'], ms: ['Ya', 'Tidak'] };
  const YNU = { en: ['Yes', 'No', 'Not sure'], ar: ['نعم', 'لا', 'غير واضح'], ms: ['Ya', 'Tidak', 'Tidak pasti'] };

  /* ---------- questions shared by both sets ---------- */
  const FIRST_BASE = [
    { id: 'fx', type: 'single', en: { q: 'Since age 50, have you broken a bone after a minor fall or bump?', opts: YNU.en }, ar: { q: 'منذ سن الخمسين، هل حدث كسر في عظمة بعد سقوط بسيط أو اصطدام خفيف؟', opts: YNU.ar }, ms: { q: 'Sejak umur 50, adakah tulang anda pernah patah selepas jatuh ringan atau terhentak?', opts: YNU.ms } },
    { id: 'fxsite', type: 'single', show: a => a.fx === 0, en: { q: 'Which bone?', opts: ['Wrist', 'Hip', 'Spine or back', 'Upper arm', 'Other'] }, ar: { q: 'أي عظمة؟', opts: ['المعصم', 'الورك', 'العمود الفقري أو الظهر', 'أعلى الذراع', 'غير ذلك'] }, ms: { q: 'Tulang yang mana?', opts: ['Pergelangan tangan', 'Pinggul', 'Tulang belakang atau belakang badan', 'Lengan atas', 'Lain-lain'] } },
    { id: 'fxwhen', type: 'single', show: a => a.fx === 0, en: { q: 'When did it happen?', opts: ['In the last 12 months', '1 to 2 years ago', 'More than 2 years ago'] }, ar: { q: 'متى حدث ذلك؟', opts: ['خلال آخر 12 شهرًا', 'قبل سنة إلى سنتين', 'قبل أكثر من سنتين'] }, ms: { q: 'Bila ia berlaku?', opts: ['Dalam 12 bulan lepas', '1 hingga 2 tahun lalu', 'Lebih 2 tahun lalu'] } },
    { id: 'falls', type: 'single', en: { q: 'How many times have you fallen in the last 12 months?', opts: ['None', 'Once', 'Twice or more'] }, ar: { q: 'كم مرة حدث سقوط خلال آخر 12 شهرًا؟', opts: ['لا مرة', 'مرة واحدة', 'مرتين أو أكثر'] }, ms: { q: 'Berapa kali anda jatuh dalam 12 bulan lepas?', opts: ['Tiada', 'Sekali', 'Dua kali atau lebih'] } },
    { id: 'parent', type: 'single', en: { q: 'Did your mother or father ever break a hip?', opts: YNU.en }, ar: { q: 'هل سبق أن كُسر ورك لدى الأم أو الأب؟', opts: YNU.ar }, ms: { q: 'Pernahkah ibu atau bapa anda patah pinggul?', opts: YNU.ms } },
    { id: 'steroid', type: 'single', en: { q: 'Have you taken steroid tablets (for example prednisolone) for 3 months or more?', opts: YNU.en }, ar: { q: 'هل سبق تناول أقراص ستيرويد (مثل بريدنيزولون) لمدة 3 أشهر أو أكثر؟', opts: YNU.ar }, ms: { q: 'Pernahkah anda makan ubat tablet steroid (contohnya prednisolone) selama 3 bulan atau lebih?', opts: YNU.ms } },
    { id: 'ra', type: 'single', en: { q: 'Has a doctor told you that you have rheumatoid arthritis?', opts: YNU.en }, ar: { q: 'هل أبلغ طبيب بوجود التهاب المفاصل الروماتويدي؟', opts: YNU.ar }, ms: { q: 'Adakah doktor pernah memberitahu bahawa anda menghidap artritis reumatoid?', opts: YNU.ms } },
    { id: 'smoke', type: 'single', en: { q: 'Do you smoke now?', opts: YN.en }, ar: { q: 'هل يوجد تدخين حاليًا؟', opts: YN.ar }, ms: { q: 'Adakah anda merokok sekarang?', opts: YN.ms } },
    { id: 'alcohol', type: 'single', en: { q: 'Do you usually drink 3 or more alcoholic drinks a day?', opts: YN.en }, ar: { q: 'هل يُعتاد تناول 3 مشروبات كحولية أو أكثر في اليوم؟', opts: YN.ar }, ms: { q: 'Adakah anda biasanya minum 3 minuman beralkohol atau lebih sehari?', opts: YN.ms } },
    { id: 'shrink', type: 'single', en: { q: 'Have you noticed you have become shorter, or more bent forward?', opts: YNU.en }, ar: { q: 'هل لوحظ نقص في الطول، أو زيادة في الانحناء إلى الأمام؟', opts: YNU.ar }, ms: { q: 'Adakah anda perasan badan semakin pendek, atau semakin membongkok ke hadapan?', opts: YNU.ms } },
    { id: 'body', type: 'numbers', optional: true, fields: [['height', 'cm'], ['weight', 'kg']], en: { q: 'Your height and weight, if you know them', labels: ['Height', 'Weight'] }, ar: { q: 'الطول والوزن، إن كانا معروفين', labels: ['الطول', 'الوزن'] }, ms: { q: 'Tinggi dan berat badan, jika anda tahu', labels: ['Tinggi', 'Berat badan'] } }
  ];

  const REVIEW_BASE = [
    { id: 'med', type: 'single', en: { q: 'In the last month, how have you taken your bone medicine?', opts: ['Every dose', 'I missed some doses', 'I stopped taking it', 'I have not started yet'] }, ar: { q: 'خلال الشهر الماضي، كيف تناولتم دواء العظام؟', opts: ['كل الجرعات', 'فاتتني بعض الجرعات', 'توقفتُ عن تناوله', 'لم أبدأ بعد'] }, ms: { q: 'Dalam sebulan lepas, bagaimana anda mengambil ubat tulang anda?', opts: ['Setiap dos', 'Saya terlepas beberapa dos', 'Saya sudah berhenti mengambilnya', 'Saya belum mula lagi'] } },
    { id: 'why', type: 'multi', show: a => a.med > 0, en: { q: 'What made it hard? Choose all that apply.', opts: ['Side effects', 'Cost', 'I forgot', 'Not sure I need it', 'Hard to take it the right way', 'Something else'] }, ar: { q: 'ما الذي جعل ذلك صعبًا؟ اختاروا كل ما ينطبق.', opts: ['آثار جانبية', 'التكلفة', 'نسيتُ', 'غير واثق من حاجتي إليه', 'صعوبة تناوله بالطريقة الصحيحة', 'شيء آخر'] }, ms: { q: 'Apa yang menyukarkan? Pilih semua yang berkenaan.', opts: ['Kesan sampingan', 'Kos', 'Saya terlupa', 'Saya tidak pasti saya memerlukannya', 'Sukar mengambilnya dengan betul', 'Sebab lain'] } },
    { id: 'sym', type: 'multi', none: 3, en: { q: 'Since your last visit, have you had any of these? Choose all that apply.', opts: ['Heartburn or pain when swallowing', 'Pain or swelling in the jaw, or a loose tooth', 'New pain in the thigh or groin', 'None of these'] }, ar: { q: 'منذ زيارتكم الأخيرة، هل عانيتم من أي مما يلي؟ اختاروا كل ما ينطبق.', opts: ['حرقة في المعدة أو ألم عند البلع', 'ألم أو تورم في الفك، أو سن متحرك', 'ألم جديد في الفخذ أو أعلى الفخذ', 'لا شيء من ذلك'] }, ms: { q: 'Sejak lawatan terakhir anda, adakah anda mengalami mana-mana berikut? Pilih semua yang berkenaan.', opts: ['Pedih ulu hati atau sakit ketika menelan', 'Sakit atau bengkak pada rahang, atau gigi goyah', 'Sakit baharu di paha atau pangkal paha', 'Tiada daripada ini'] } },
    { id: 'rfall', type: 'single', en: { q: 'Have you fallen since your last visit?', opts: ['No', 'Yes, once', 'Yes, more than once'] }, ar: { q: 'هل حدث سقوط منذ زيارتكم الأخيرة؟', opts: ['لا', 'نعم، مرة واحدة', 'نعم، أكثر من مرة'] }, ms: { q: 'Adakah anda jatuh sejak lawatan terakhir?', opts: ['Tidak', 'Ya, sekali', 'Ya, lebih daripada sekali'] } },
    { id: 'rfx', type: 'single', en: { q: 'Have you broken a bone since your last visit?', opts: YN.en }, ar: { q: 'هل حدث كسر في عظمة منذ زيارتكم الأخيرة؟', opts: YN.ar }, ms: { q: 'Adakah tulang anda patah sejak lawatan terakhir?', opts: YN.ms } },
    { id: 'dental', type: 'single', en: { q: 'Are you planning a tooth extraction or other dental surgery?', opts: YN.en }, ar: { q: 'هل تخططون لخلع سن أو جراحة أسنان أخرى؟', opts: YN.ar }, ms: { q: 'Adakah anda merancang pencabutan gigi atau pembedahan pergigian lain?', opts: YN.ms } },
    { id: 'cad', type: 'single', en: { q: 'Are you taking calcium and vitamin D as advised?', opts: ['Yes', 'Sometimes', 'No'] }, ar: { q: 'هل تتناولون الكالسيوم وفيتامين د كما نُصحتم؟', opts: ['نعم', 'أحيانًا', 'لا'] }, ms: { q: 'Adakah anda mengambil kalsium dan vitamin D seperti yang dinasihatkan?', opts: ['Ya', 'Kadang-kadang', 'Tidak'] } }
  ];

  /* ---------- visit section: appended to both sets, before 'ask' ---------- */
  const VISIT = [
    { id: 'cc', type: 'text', en: { q: 'What is the main problem, in your own words?', ph: 'For example: pain in the lower back when standing for a long time' }, ar: { q: 'ما المشكلة الرئيسية، بكلماتكم الخاصة؟', ph: 'مثال: ألم في أسفل الظهر عند الوقوف لفترة طويلة' }, ms: { q: 'Apakah masalah utama anda, dalam kata-kata anda sendiri?', ph: 'Contoh: sakit pinggang bila berdiri lama' } },
    { id: 'loc', type: 'single', en: { q: 'Where is the pain?', opts: ['Neck', 'Upper back', 'Lower back', 'Hip', 'Knee', 'Shoulder', 'Wrist or hand', 'Ankle or foot', 'Other'] }, ar: { q: 'أين يقع الألم؟', opts: ['الرقبة', 'أعلى الظهر', 'أسفل الظهر', 'الورك', 'الركبة', 'الكتف', 'المعصم أو اليد', 'الكاحل أو القدم', 'مكان آخر'] }, ms: { q: 'Di mana kesakitannya?', opts: ['Leher', 'Belakang atas', 'Belakang bawah', 'Pinggul', 'Lutut', 'Bahu', 'Pergelangan tangan atau tangan', 'Buku lali atau kaki', 'Lain-lain'] } },
    { id: 'dur', type: 'single', en: { q: 'How long have you had this problem?', opts: ['Days', 'Weeks', 'Months', 'Years'] }, ar: { q: 'منذ متى بدأت هذه المشكلة؟', opts: ['أيام', 'أسابيع', 'أشهر', 'سنوات'] }, ms: { q: 'Sudah berapa lama masalah ini?', opts: ['Hari', 'Minggu', 'Bulan', 'Tahun'] } },
    { id: 'pnow', type: 'scale', en: { q: 'How bad is the pain now? 0 is no pain, 10 is the worst possible.', lo: 'No pain', hi: 'Worst possible' }, ar: { q: 'ما شدة الألم الآن؟ 0 يعني لا ألم، و10 يعني أسوأ ألم ممكن.', lo: 'لا ألم', hi: 'أسوأ ألم ممكن' }, ms: { q: 'Berapa teruk sakit anda sekarang? 0 bermakna tiada sakit, 10 paling teruk.', lo: 'Tiada sakit', hi: 'Paling teruk' } },
    { id: 'pworst', type: 'scale', en: { q: 'What was the worst pain this week? 0 to 10.', lo: 'No pain', hi: 'Worst possible' }, ar: { q: 'ما أسوأ ألم شعرتم به خلال هذا الأسبوع؟ من 0 إلى 10.', lo: 'لا ألم', hi: 'أسوأ ألم ممكن' }, ms: { q: 'Apakah sakit paling teruk dalam minggu ini? 0 hingga 10.', lo: 'Tiada sakit', hi: 'Paling teruk' } },
    { id: 'night', type: 'single', en: { q: 'Does the pain wake you at night?', opts: YN.en }, ar: { q: 'هل يوقظكم الألم ليلًا؟', opts: YN.ar }, ms: { q: 'Adakah kesakitan itu membangunkan anda pada waktu malam?', opts: YN.ms } },
    { id: 'walk', type: 'single', en: { q: 'Can you walk and climb stairs as usual?', opts: ['Yes, as usual', 'With difficulty', 'No'] }, ar: { q: 'هل يمكن المشي وصعود الدرج كالمعتاد؟', opts: ['نعم، كالمعتاد', 'بصعوبة', 'لا'] }, ms: { q: 'Bolehkah anda berjalan dan menaiki tangga seperti biasa?', opts: ['Ya, seperti biasa', 'Dengan susah payah', 'Tidak'] } },
    { id: 'redf', type: 'multi', none: 6, en: { q: 'Do any of these apply? Choose all that apply.', opts: ['New weakness or numbness in one or both legs', 'Trouble passing urine, or loss of bladder or bowel control', 'Numbness around the groin, buttocks or inner thighs', 'Fever or chills', 'Weight loss you did not mean to have', 'A fall or injury today', 'None of these'] }, ar: { q: 'هل ينطبق أي مما يلي؟ اختاروا كل ما ينطبق.', opts: ['ضعف أو خدر جديد في إحدى الساقين أو كلتيهما', 'صعوبة في التبول، أو فقدان التحكم في المثانة أو الأمعاء', 'خدر حول الأعضاء التناسلية أو الإليتين أو الفخذين من الداخل', 'حمى أو قشعريرة', 'فقدان وزن لم يكن مقصودًا', 'سقوط أو إصابة اليوم', 'لا شيء من ذلك'] }, ms: { q: 'Adakah mana-mana berikut berlaku? Pilih semua yang berkenaan.', opts: ['Kelemahan atau kebas baharu pada satu atau kedua-dua kaki', 'Sukar membuang air kecil, atau hilang kawalan pundi kencing atau usus', 'Kebas di sekitar kawasan kemaluan, punggung atau paha dalam', 'Demam atau menggigil', 'Kehilangan berat badan yang tidak dirancang', 'Jatuh atau kecederaan hari ini', 'Tiada daripada ini'] } },
    { id: 'curmeds', type: 'text', none: true, en: { q: 'List your current medicines and supplements, including ones you buy without a prescription.', ph: 'Name and dose of each one' }, ar: { q: 'اكتبوا الأدوية والمكملات التي تتناولونها حاليًا، بما فيها التي تُشترى دون وصفة.', ph: 'اسم كل دواء وجرعته' }, ms: { q: 'Senaraikan ubat dan suplemen yang anda ambil sekarang, termasuk yang dibeli tanpa preskripsi.', ph: 'Nama dan dos setiap satu' } },
    { id: 'allergy', type: 'text', none: true, en: { q: 'Do you have any allergies to medicines or other things?', ph: 'Name each allergy and what happens (rash, swelling, breathing)' }, ar: { q: 'هل لديكم أي حساسية من أدوية أو أشياء أخرى؟', ph: 'اذكروا كل حساسية وما يحدث (طفح، تورم، صعوبة في التنفس)' }, ms: { q: 'Adakah anda alah kepada mana-mana ubat atau bahan lain?', ph: 'Nyatakan setiap alahan dan reaksinya (ruam, bengkak, sesak nafas)' } },
    { id: 'worry', type: 'text', optional: true, en: { q: 'What worries you most, or what would you like from today?', ph: 'Optional' }, ar: { q: 'ما الذي يقلقكم أكثر، أو ماذا تودون أن تحصلوا عليه من زيارة اليوم؟', ph: 'اختياري' }, ms: { q: 'Apa yang paling merisaukan anda, atau apa yang anda mahu daripada lawatan hari ini?', ph: 'Pilihan' } }
  ];

  const ASK = { id: 'ask', type: 'text', optional: true, en: { q: 'Is there anything you want to ask your doctor?', ph: 'Type your question (optional)' }, ar: { q: 'هل هناك شيء تودون سؤال الطبيب عنه؟', ph: 'اكتبوا سؤالكم (اختياري)' }, ms: { q: 'Adakah ada apa-apa yang ingin anda tanya kepada doktor?', ph: 'Taip soalan anda (pilihan)' } };

  const SETS = { first: [...FIRST_BASE, ...VISIT, ASK], review: [...REVIEW_BASE, ...VISIT, ASK] };
  const ALLQ = [...FIRST_BASE, ...REVIEW_BASE, ...VISIT, ASK];
  const findQ = id => ALLQ.find(q => q.id === id);

  /* Which check-in a patient gets: on treatment once something has been prescribed. */
  function visitFor(c) { return c && c.rx ? 'review' : 'first'; }
  function questions(visit, answers) { return SETS[visit].filter(q => !q.show || q.show(answers || {})); }

  /* ---------- cleaning: every answer is checked before it is stored or flagged ---------- */
  const scale = v => (Number.isInteger(v) && v >= 0 && v <= 10 ? v : null);
  function cleanText(v) {
    const cps = Array.from(String(v).replace(CTRL, '').trim());
    return cps.length > MAX_TEXT ? cps.slice(0, MAX_TEXT).join('') : cps.join('');
  }
  function cleanValue(q, v) {
    if (v === undefined || v === null) return undefined;
    if (q.type === 'single') return Number.isInteger(v) && v >= 0 && v < q.en.opts.length ? v : undefined;
    if (q.type === 'multi') {
      if (!Array.isArray(v)) return undefined;
      const ok = v.filter(i => Number.isInteger(i) && i >= 0 && i < q.en.opts.length);
      return [...new Set(ok)].sort((x, y) => x - y);
    }
    if (q.type === 'scale') return scale(Number(v)) === null || v === '' ? undefined : Number(v);
    if (q.type === 'numbers') {
      if (!v || typeof v !== 'object') return undefined;
      const f = x => (x === undefined || x === null ? '' : cleanText(x).slice(0, 8));
      return { height: f(v.height), weight: f(v.weight) };
    }
    if (q.type === 'text') {
      if (v === NONE) return NONE;
      return typeof v === 'string' || typeof v === 'number' ? cleanText(v) : undefined;
    }
    return undefined;
  }
  /* normalise(visit, answers): keep only valid answers to questions the visit shows. */
  function normalise(visit, answers) {
    const raw = answers || {}, all = SETS[visit] || SETS.first, clean = {}, out = {};
    all.forEach(q => { const v = cleanValue(q, raw[q.id]); if (v !== undefined) clean[q.id] = v; });
    all.forEach(q => { if (clean[q.id] !== undefined && (!q.show || q.show(clean))) out[q.id] = clean[q.id]; });
    return out;
  }
  /* A question can be answered as 'none' (text) or skipped. These helpers treat both as answered. */
  const isNone = v => v === NONE;

  /* ---------- flags ---------- */
  const has = (a, k, i) => Array.isArray(a[k]) && a[k].includes(i);
  const WHY = ['side effects', 'cost', 'forgot', 'unsure it is needed', 'hard to take correctly', 'other'];
  const SAME_DAY = ['V-CES', 'V-LEG', 'V-FEVER', 'V-FALL'];

  function fraxFactors(a) {
    const fr = [];
    if (a.parent === 0) fr.push('parent hip fracture'); if (a.ra === 0) fr.push('rheumatoid arthritis');
    if (a.smoke === 0) fr.push('current smoker'); if (a.alcohol === 0) fr.push('alcohol 3+ units a day');
    const h = a.body && +a.body.height, w = a.body && +a.body.weight;
    if (h > 0 && w > 0) { const bmi = w / Math.pow(h / 100, 2); if (bmi < 19) fr.push('BMI ' + bmi.toFixed(1)); }
    return fr;
  }

  /* Visit red flags. Deterministic. Free text is not read here. Source LOCAL: awaiting sign-off. */
  function visitFlags(a) {
    const out = [], rf = Array.isArray(a.redf) ? a.redf : [];
    const r = i => rf.includes(i), spine = [0, 1, 2].includes(a.loc), hip = a.loc === 3;
    const night = a.night === 0, pain = scale(a.pnow);
    if (r(1) || r(2)) out.push(['V-CES', 'crit', 'Bladder or bowel change, or numbness around the groin or buttocks: possible cauda equina syndrome. Same-day medical review', 'LOCAL']);
    if (r(0)) out.push(['V-LEG', 'crit', 'New leg weakness or numbness: same-day neurological check for nerve compression', 'LOCAL']);
    if (r(3) && spine) out.push(['V-FEVER', 'crit', 'Fever or chills with back or neck pain: possible spinal infection. Same-day medical review', 'LOCAL']);
    else if (r(3)) out.push(['V-FEVERW', 'warn', 'Fever or chills reported: check for a source of infection', 'LOCAL']);
    if (r(4) && night) out.push(['V-MAL', 'crit', 'Unexplained weight loss with night pain: urgent review for malignancy or myeloma', 'LOCAL']);
    else if (r(4)) out.push(['V-WL', 'warn', 'Unexplained weight loss reported: review', 'LOCAL']);
    if (r(5) && (hip || spine)) out.push(['V-FALL', 'crit', 'Fall or injury today with hip or back pain: same-day assessment for fracture', 'LOCAL']);
    else if (r(5)) out.push(['V-INJ', 'warn', 'Fall or injury today: check for fracture', 'LOCAL']);
    if (pain !== null && pain >= 8) out.push(['V-PAIN', 'warn', 'Pain 8 or more out of 10 now: review pain control', 'LOCAL']);
    if (night) out.push(['V-NIGHT', 'info', 'Pain wakes at night', 'LOCAL']);
    if (a.walk === 2) out.push(['V-WALK', 'warn', 'Cannot walk or climb stairs as usual: falls and mobility review', 'LOCAL']);
    else if (a.walk === 1) out.push(['V-WALK', 'info', 'Walking or climbing stairs with difficulty', 'LOCAL']);
    return out;
  }

  /* ctx: {rx: drug id or null}. Returns [[id, level 'crit'|'warn'|'info', text, source]] */
  function flags(visit, a, ctx) {
    a = a || {}; ctx = ctx || {}; const out = [];
    const rx = ctx.rx || null;
    const boneDrug = rx && !['teri', 'life'].includes(rx);   // antiresorptive or romosozumab: ONJ and AFF warnings apply
    if (visit === 'first') {
      if (a.fx === 0 && a.fxwhen === 0) out.push(['P-FX12', 'crit', 'Reports a fragility fracture in the last 12 months: very high risk if confirmed', 'MYCPG']);
      else if (a.fx === 0) out.push(['P-FX', 'warn', 'Reports a previous fragility fracture: confirm site and date; DXA likely indicated', 'NICE']);
      if (a.falls === 2) out.push(['P-FALLS', 'warn', 'Two or more falls in 12 months: falls assessment; very high risk criterion if confirmed', 'MYCPG']);
      if (a.steroid === 0) out.push(['P-GC', 'warn', 'Reports long-term steroid tablets: confirm, and enter into FRAX', 'FRAX']);
      const fr = fraxFactors(a);
      if (fr.length) out.push(['P-FRAX', 'info', 'FRAX risk factors reported: ' + fr.join(', ') + '. Enter into the FRAX calculator', 'FRAX']);
      if (a.shrink === 0) out.push(['P-HT', 'info', 'Reports height loss or stooping: consider vertebral fracture assessment', 'LOCAL']);
    }
    if (visit === 'review') {
      if (a.rfx === 0) out.push(['P-NEWFX', 'crit', 'Reports a new fracture on treatment: very high risk criterion (fracture on treatment); review the treatment', 'MYCPG']);
      if (boneDrug && has(a, 'sym', 1)) out.push(['P-ONJ', 'crit', 'Jaw pain, swelling or a loose tooth on bone treatment: assess for osteonecrosis of the jaw; dental review', 'LOCAL']);
      if (boneDrug && has(a, 'sym', 2)) out.push(['P-AFF', 'crit', 'New thigh or groin pain on bone treatment: X-ray both femurs for atypical femoral fracture', 'LOCAL']);
      if (rx === 'deno' && a.med === 2) out.push(['P-DENO', 'crit', 'Reports stopping denosumab: rebound vertebral fracture risk; arrange the next dose or a follow-on treatment now', 'LOCAL']);
      else if (a.med === 2 || a.med === 3) out.push(['P-STOP', 'warn', (a.med === 2 ? 'Reports stopping treatment' : 'Has not started treatment') + reasons(a), 'LOCAL']);
      if (a.med === 1) out.push(['P-MISS', 'warn', 'Reports missed doses' + reasons(a), 'LOCAL']);
      if (rx === 'obp' && has(a, 'sym', 0)) out.push(['P-GI', 'warn', 'Heartburn or painful swallowing on oral bisphosphonate: check how it is taken; consider switching', 'LOCAL']);
      if (a.rfall > 0) out.push(['P-RFALL', 'warn', 'Fall since last visit: falls assessment', 'MYCPG']);
      if (boneDrug && a.dental === 0) out.push(['P-DENT', 'info', 'Dental surgery planned on bone treatment: tell the dentist; check timing', 'LOCAL']);
      if (a.cad === 2) out.push(['P-CAD', 'info', 'Not taking calcium and vitamin D as advised', 'MYCPG']);
    }
    out.push(...visitFlags(a));
    if (a.ask && String(a.ask).trim()) out.push(['P-ASK', 'info', 'Patient question: "' + String(a.ask).trim().slice(0, 200) + '"', 'PATIENT']);
    return out;
  }
  function reasons(a) { const r = (a.why || []).map(i => WHY[i]).filter(Boolean); return r.length ? ' (' + r.join(', ') + ')' : ''; }
  /* True when a same-day flag is among the flags: the patient is told to seek care today. */
  function sameDay(fl) { return (fl || []).some(f => SAME_DAY.includes(f[0])); }

  /* Adherence answer that counts as the 3-month adherence check, once a clinician accepts it. */
  function adherent(a) { return a && a.med === 0; }

  /* ---------- clinician summary: structured, no AI, every item patient-reported ---------- */
  const LEVEL = { crit: 'Urgent', warn: 'Review', info: 'Note' };
  const NOTE = 'Patient-reported. Answers never change the risk category on their own. Confirm with the patient before acting.';
  function summary(c) {
    c = c || {};
    const k = c.checkin || {}, visit = k.visit === 'review' ? 'review' : 'first', a = k.answers || {};
    const rx = c.rx ? (typeof c.rx === 'string' ? c.rx : c.rx.id) : null;
    const fl = flags(visit, a, { rx });
    const NA = 'Not answered';
    const opt = (id, v) => { const q = findQ(id); return q && Number.isInteger(v) && q.en.opts[v] !== undefined ? q.en.opts[v] : NA; };
    const txt = v => (v === NONE ? 'None' : (typeof v === 'string' && v.trim() !== '' ? Array.from(v).slice(0, MAX_TEXT).join('') : NA));
    const it = (label, value, extra) => {
      const e = Object.assign({ label, value, provenance: PR }, extra || {});
      if (e.verbatim && typeof value === 'string' && Array.from(value).length >= MAX_TEXT) e.cut = true;
      return e;
    };
    const sc = v => (scale(v) === null ? NA : v + ' / 10');
    const yn = (id, v) => opt(id, v);
    const order = { crit: 0, warn: 1, info: 2 };

    const redf = a.redf, redfVal = !Array.isArray(redf) ? NA : (redf.length ? redf.map(i => findQ('redf').en.opts[i]).join('; ') : 'Nothing selected');
    const flagItems = fl.filter(f => f[0] !== 'P-ASK').sort((x, y) => order[x[1]] - order[y[1]])
      .map(f => it(LEVEL[f[1]], f[2], { level: f[1], source: f[3], flag: f[0] }));
    const redflags = [it('Reported', redfVal), ...flagItems, ...(flagItems.length ? [] : [it('Flags', 'None from this check-in')])];

    const complaint = [it("Chief complaint (patient's own words)", txt(a.cc), { verbatim: true }), it('Where', opt('loc', a.loc)), it('How long', opt('dur', a.dur))];
    const pain = [it('Pain now', sc(a.pnow)), it('Worst pain this week', sc(a.pworst)), it('Wakes at night', yn('night', a.night)), it('Walking and stairs', opt('walk', a.walk))];

    let fracture;
    if (visit === 'first') {
      const fx = a.fx === 0 ? opt('fx', a.fx) + ' (' + opt('fxsite', a.fxsite) + ', ' + opt('fxwhen', a.fxwhen) + ')' : opt('fx', a.fx);
      const body = a.body && (a.body.height || a.body.weight) ? (a.body.height || '–') + ' cm, ' + (a.body.weight || '–') + ' kg' : NA;
      fracture = [it('Fragility fracture since age 50', fx), it('Falls in last 12 months', opt('falls', a.falls)), it('Parent broke a hip', opt('parent', a.parent)),
        it('Rheumatoid arthritis', opt('ra', a.ra)), it('Smoking now', opt('smoke', a.smoke)), it('Alcohol 3+ drinks a day', opt('alcohol', a.alcohol)),
        it('Steroid tablets 3+ months', opt('steroid', a.steroid)), it('Height loss or stooping', opt('shrink', a.shrink)), it('Height and weight', body),
        it('FRAX factors reported', fraxFactors(a).join(', ') || 'None reported')];
    } else {
      fracture = [it('Fracture since last visit', opt('rfx', a.rfx)), it('Fall since last visit', opt('rfall', a.rfall))];
    }

    const meds = [it('Medicines and supplements', txt(a.curmeds), { verbatim: true }), it('Allergies', txt(a.allergy), { verbatim: true })];
    if (visit === 'review') {
      const sym = Array.isArray(a.sym) ? a.sym.map(i => findQ('sym').en.opts[i]).join('; ') : NA;
      const why = Array.isArray(a.why) ? a.why.map(i => findQ('why').en.opts[i]).join('; ') : NA;
      meds.push(it('Bone medicine, last month', opt('med', a.med)), it('Reasons it was hard', why), it('Symptoms since last visit', sym),
        it('Calcium and vitamin D', opt('cad', a.cad)), it('Dental surgery planned', opt('dental', a.dental)));
    }
    const worry = [it('Worries or wants from today', txt(a.worry), { verbatim: true }), it('Question for the doctor', txt(a.ask), { verbatim: true })];

    return {
      provenance: PR, visit, visitLabel: visit === 'first' ? 'Before first clinic' : 'Treatment review', day: k.d == null ? null : k.d, lang: k.lang || null, rx,
      urgent: fl.some(f => f[1] === 'crit'), sameDay: sameDay(fl),
      sections: [
        { id: 'redflags', title: 'Red flags and flags', items: redflags },
        { id: 'complaint', title: 'Chief complaint and site', items: complaint },
        { id: 'pain', title: 'Pain', items: pain },
        { id: 'fracture', title: 'Fracture and FRAX risk', items: fracture },
        { id: 'meds', title: 'Medicines and allergies', items: meds },
        { id: 'worry', title: "Patient's worries and questions", items: worry }
      ],
      note: NOTE
    };
  }

  const api = { LANGS, NONE, NONE_LBL, MAX_TEXT, SETS, visitFor, questions, flags, adherent, normalise, summary, sameDay, isNone, fraxFactors };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OsteoCheckin = api;
})(typeof window !== 'undefined' ? window : globalThis);
