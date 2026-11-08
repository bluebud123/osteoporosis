/* PeriLoop model adapter: provider-agnostic chat client. Plain JS, UMD. No network at import. Fictional data only.
 * Model output is never clinical: the SYSTEM_GUARD limits it to asking intake questions or summarising the patient's words.
 * Clinical logic stays in engine.js (classify). askSafely() runs classify first and never sends EMERGENCY / SAME-DAY text to a model.
 */
(function (root) {
  'use strict';

  var SYSTEM_GUARD = [
    'You are an intake assistant for a pre-operative questionnaire. You are not a clinician.',
    'You may ONLY (a) ask the next intake question from the list you are given, or (b) summarise what the patient said, in neutral words.',
    'You must NEVER give a diagnosis, prognosis, medicine name, dose, medicine timing, or any medical advice or reassurance.',
    'If the patient describes danger signs or asks for advice, do not answer it. Say that a clinician will review.',
    'Do not invent facts the patient did not say. Do not ask for names, ID or IC numbers, phone numbers or email addresses.',
    'When asked for JSON, output one valid JSON object and nothing else.'
  ].join('\n');

  // Provider presets. Only the config changes between providers; the call shape stays the same.
  var presets = {
    deepseek: { provider: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
    'openai-compatible': { provider: 'openai-compatible', baseUrl: '', model: '' },
    local: { provider: 'local', baseUrl: 'http://localhost:8000', model: 'Qwen3-8B' }
  };

  var SCRIPTED_DEFAULT = {
    en: 'Thank you. Please answer the next question.',
    ms: 'Terima kasih. Sila jawab soalan seterusnya.',
    zh: '谢谢。请回答下一个问题。'
  };
  var SAFE_SAME_DAY ='This needs a clinician to review you today. Our team has been alerted and will contact you. If it gets worse, go to the emergency department.';

  /* ---------- output guard (review1 B1; guard2). Every model reply passes here before anyone sees it. ----------
   * A reply is accepted only as (a) a question to the patient, (b) a summary of the patient's own words, or
   * (c) a refusal or redirect to the clinician / care team / emergency services. Anything else is blocked.
   * Negated refusals ("I cannot give a diagnosis", "Saya tidak dapat memberi nasihat", "我无法提供...") are removed
   * before the advice / reassurance / diagnosis patterns run. Medicine instructions and dose statements are checked on
   * the full text. The engine classifies assertions and medicine-directed questions only, never refusals or intake questions.
   */
  var EN_SPEC = 'warfarin|rivaroxaban|apixaban|dabigatran|edoxaban|enoxaparin|clexane|heparin|aspirin|clopidogrel|ticagrelor|paracetamol|parasetamol|panadol|ibuprofen|diclofenac|naproxen|celecoxib|etoricoxib|amoxicillin|augmentin|xarelto|eliquis|coumadin|marevan|metformin|insulin|amlodipine|gabapentin|pregabalin|tramadol|morphine|codeine|prednisolone';
  var EN_CLASS = 'antibiotics?|blood thinners?|anticoagulants?|antiplatelets?|painkillers?|pain relie(?:f|ver)s?|tablets?|pills?|medicines?|medications?|steroids?';
  var MS_SPEC = 'warfarin|aspirin|parasetamol|amlodipine|metformin';
  var MS_CLASS = 'ubat pencair darah|pencair darah|ubat darah|ubat penahan sakit|ubat tahan sakit|ubat|tablet|biji|kapsul|antibiotik';
  var ZH_SPEC = '阿司匹林|华法林|布洛芬|对乙酰氨基酚|二甲双胍|利伐沙班|阿哌沙班';
  var ZH_CLASS = '降压药|降糖药|止痛药|抗生素|抗凝药|药片|片剂|胶囊';
  var EN_MED_RE = new RegExp('\\b(?:' + EN_SPEC + ')\\b', 'i');
  var MS_MED_RE = new RegExp('\\b(?:' + MS_SPEC + ')\\b', 'i');
  var ZH_MED_RE = new RegExp(ZH_SPEC);
  var MED_ANY_RE = new RegExp('\\b(?:' + EN_SPEC + '|' + EN_CLASS + '|' + MS_SPEC + '|' + MS_CLASS + ')\\b|' + ZH_SPEC + '|' + ZH_CLASS, 'i');
  var MED_NAME_RE = new RegExp('\\b(?:' + EN_SPEC + '|' + MS_SPEC + ')\\b|' + ZH_SPEC, 'i');
  var MED_EN_ANY = '(?:' + EN_SPEC + '|' + EN_CLASS + ')';
  var MED_MS_ANY = '(?:' + MS_SPEC + '|' + MS_CLASS + ')';
  var MED_ZH_ANY = '(?:' + ZH_SPEC + '|' + ZH_CLASS + ')';
  var INSTR_EN_VERB = '(?:stop|stopp(?:ed|ing)|start(?:ed)?|take|taking|skip(?:ped)?|restart(?:ed)?|resume[ds]?|continue[ds]?|hold|increase|reduce|double|halve|switch|miss|keep taking)';
  var INSTR_EN_DIRECT = /\b(?:stop|start|skip|restart|resume|continue|hold|switch|miss|keep taking)\b/i;
  var INSTR_EN_RE = new RegExp('\\b' + INSTR_EN_VERB + '\\b[^.?!]{0,40}\\b' + MED_EN_ANY + '\\b', 'i');
  var INSTR_EN_REV_RE = new RegExp('\\b' + MED_EN_ANY + '\\b[^.?!]{0,30}\\b(?:stop|skip|take|start|continue|restart|resume)\\b', 'i');
  var INSTR_MS_RE = new RegExp('\\b(?:jangan|hentikan|berhenti|teruskan|mulakan|ambil|minum|telan|kurangkan|tambah|tukar|elak|tangguhkan)\\b[^.?!，。]{0,40}\\b' + MED_MS_ANY + '\\b', 'i');
  var INSTR_ZH_RE = new RegExp('(?:停止|停用|停服|不要服用|不要吃|别吃|别服用|开始服用|继续服用|减量|加量|跳过|漏服|请[^。！？]{0,6}?(?:吃|服用)|可以[^。！？]{0,4}?(?:停|吃|服用)|应该[^。！？]{0,4}?(?:停|吃|服用))[^。！？]{0,12}' + MED_ZH_ANY);
  var DO_NOT_RE = /\b(?:do not|don'?t|never|please do not|please don'?t)\s+(?:take|stop|start|skip|restart|resume|continue)\b|\bjangan\s+(?:ambil|minum|telan|berhenti|hentikan|mula|teruskan|tukar)\b|(?:不要|别|切勿|请勿)(?:服用|吃|停止|停用|开始|继续)/i;
  var YOU_CAN_RE = /\byou (?:can|may|could|must) (?:stop|start|restart|resume|continue|skip|hold|switch|take)\b/i;
  var QSTRONG_RE = /\b(?:can|could|would|will|should|shall|may)\s+(?:you|i)\s+(?:stop|start|skip|restart|resume|continue|hold|switch|double|halve|increase|reduce)\b|\b(?:stop|start|skip|restart|resume|continue)\s+(?:taking|your|the|any|it|them)\b|\bjangan\b|\bsila\s+(?:hentikan|berhenti|teruskan|mulakan)\b|不要服用|不要吃|要不要(?:停止|停用|服用|开始)/i;
  var WEAK_DIRECTIVE_RE = /\b(?:ask|tell|contact|raise|speak|talk|discuss)\b|\btanya\b|\bhubungi\b|\bmaklumkan\b|\bberitahu\b|\bbincang\w*|咨询|联系|询问|告诉|讨论/i;
  var NEG_EN = /\b(?:I|we)\s+(?:cannot|can'?t|can not|am unable to|am not able to|won'?t|will not|do not|don'?t)\s+(?:advise|advice|give (?:you )?(?:any |a |an |medical |clinical |the )?(?:advice|diagnos\w*|prognos\w*|recommendation|opinion|answer|normal ranges?)|tell you (?:what|whether|which|if|how)|say (?:whether|what|if|which|how)|check|confirm|interpret|diagnos\w*|decide|judge|know|answer|recommend)\b[^,.;:!?]{0,90}/gi;
  var NEG_MS = /\b(?:saya|kami)\s+(?:tidak|tak)\s+(?:dapat|boleh|mampu)\s+(?:memberi|beri|mengesahkan|menilai|menentukan|memberitahu|menerangkan|mengesyorkan|menyemak)\b[^,.;:!?。]{0,90}/gi;
  var NEG_ZH = /(?:我|我们)(?:无法|不能|不可以|没法|不便)[^，,。；;！!？?]{0,60}/g;
  /* ---------- round 7: Arabic guard (ar). Same rules as en, ms, zh. Draft vocabulary, not clinician validated. ----------
   * Replies are normalised first (arNorm), so the Arabic patterns are written in normalised form (ا ي ه, no tashkeel).
   * Summaries are accepted by structure: a third-person sentence whose content words all restate the patient's own words.
   * Instructions, reassurance, diagnosis and dosing are blocked in Arabic exactly as in the other languages. */
  var AL = 'ء-ي';
  var AB = '(?<![' + AL + '])', AE = '(?![' + AL + '])';
  var AR_LETTER = /[ء-يٱ-ۓۺ-ۿ]/;
  function hasAr(s) { return AR_LETTER.test(String(s)); }
  function arNorm(s) {
    return String(s)
      .replace(/[ً-ٰٟـ]/g, '')
      .replace(/[آأإٱٲٳ]/g, 'ا')
      .replace(/[ىیئ]/g, 'ي')
      .replace(/ک/g, 'ك').replace(/ؤ/g, 'و').replace(/ة/g, 'ه')
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); })
      .replace(/٫/g, '.').replace(/٬/g, '');
  }
  function arRe(src, flags) { return new RegExp(arNorm(src), flags || ''); }
  // negated refusal: "لا أستطيع الإجابة ..." is removed before the advice / reassurance / diagnosis checks
  var NEG_AR = arRe(AB + '(?:لا|ما|مو|مش|ليس|لم|مب|بدون|ولا)\\s*(?:استطيع|اقدر|يمكنني|اقدم|اعطي|انصح|اشخص|اؤكد|اجيب|اعلق|اقول|اجزم|اعرف|اتحقق)' + AE + '[^،.;:!?؟]{0,90}', 'gi');
  var INSTR_AR_VERB = '(?:خذ|خذي|خذوا|تناول|تناولي|توقف|توقفي|اوقف|اوقفي|تتوقف|تتوقفي|تاخذ|تاخذي|تتناول|تستمر|تتابع|تبدا|تكرر|تضاعف|تقلل|تزيد|تشرب|ابدا|ابدئي|استمر|استمري|تابع|تابعي|كرر|زد|قلل|قللي|ضاعف|ضاعفي|تجاهل|امسك|تجنب|اعط|اعطي|لا تاخذ|لا تتوقف|لا توقف|لا تتناول|لا تاخذي|لا تتوقفي|اشرب|استخدم|استخدمي)';
  var AR_MED_OBJ = '(?:وارفرين|وارفارين|ريفاروكسابان|ابيكسابان|دابيغاتران|اليكويس|هيبارين|كلكسان|اسبرين|مسيل|مميع|بنادول|باراسيتامول|ايبوبروفين|ديكلوفيناك|مضاد|دوا|دواء|ادويه|ادوية|حبوب|حبه|حبة|حبات|حبتين|حقنه|حقنة|ابره|ابرة|ترامادول|مورفين|كودين|انسولين|ميتفورمين|جرعه|جرعة|مسكن|مسكنات|كورتيزون|امبوكسيلين|اموكسيسيلين)';
  var INSTR_AR_RE = arRe(AB + INSTR_AR_VERB + AE + '[^.?!؟]{0,40}' + AR_MED_OBJ + '|' + AB + AR_MED_OBJ + '[^.?!؟]{0,30}' + AB + INSTR_AR_VERB);
  var AR_MED_RE = arRe(AR_MED_OBJ);
  var AR_DIRECTIVE_RE = arRe('اسال|اتكلم|تواصل|راجع|اسأل|ينفع|يجوز|ممكن');
  var AR_MED_NAME_RE = arRe(AB + '(?:وارفرين|وارفارين|ريفاروكسابان|ابيكسابان|اسبرين|بنادول|باراسيتامول|ايبوبروفين|ديكلوفيناك|هيبارين|مضاد حيوي|مضادات حيوية|مسيل الدم|مميع)');
  var AR_DOSE_RE = arRe('(?:\\d+(?:\\.\\d+)?|واحد|واحده|اثنين|اثنتين|حبتين|ثلاث|ثلاثه|اربع|اربعه|خمس|نص|نصف)\\s*(?:حبه|حبة|حبات|حبوب|ملغ|مغ|ملي|مل|ميلي|وحده|وحدات|كبسول|كبسوله|قرص|اقراص|جرعه|جرعة)|مرتين (?:في|ب)?اليوم|مره (?:في|ب)?اليوم|ثلاث مرات|كل \\d+ ساعه|جرعه|جرعة|حبتين');
  var AR_DX = 'نقرس|التهاب|جلطه|تجلط|كسر|نزيف|عدوى|جرثوم|سرطان|السكري|سكري|هشاشه|ديسك|انزلاق غضروفي|تمزق|مرض|عرق النسا|فيروس|انفلونزا|ربو|ورم خبيث';
  var DX_ASSERT_AR = arRe('(?:هذا|هذه|هذي|ذلك|هذول)\\s*(?:غالبا|ربما|على الارجح|يبدو|يشبه|يكون|هو|انه|انها)?\\s*(?:هو\\s*)?(?:ك|ب|ل)?(?:' + AR_DX + ')');
  var DX_ASSERT_AR2 = arRe('(?:ممكن|ربما|قد|غالبا)\\s*(?:يكون|تكون|هو|هي)\\s*(?:ك|ب|ل)?(?:' + AR_DX + ')');
  var DIAG_YOU_AR = arRe('(?:انت|انتي|انتم)\\s*(?:مصاب|مصابه|عندك|عندكي)|(?:عندك|عندكي|عندكم)\\s*(?:ال)?(?:' + AR_DX + ')|مصاب ب(?:' + AR_DX + ')');
  var AR_DIAG_WORD = arRe('تشخيص|مرضك|تشخيصك|تشخيصه|تشخيصها');
  var ADVICE_AR = arRe(AB + '(?:يجب عليك|يجب ان تذهب|لازم|لابد|ينبغي عليك|انصحك|انصح|الافضل ان|من الافضل|لا تحتاج|ما تحتاج|لا داعي ان تراجع|ابقى في البيت|ابقي في البيت|لا تروح|لا تذهب|لا تراجع|اذهب|اذهبي)' + AE);
  var REASSURE_AR = arRe(AB + '(?:لا داعي للقلق|لا داعي للخوف|لا تقلق|لا تقلقي|ما تقلق|لا تخف|لا تخافي|ما فيه شي|ما فيه شيء|مافيه شي|مافيه شيء|لا شي خطير|لا بأس|لا باس|شي بسيط|شيء بسيط|يزول|سيزول|راح يزول|سيختفي|يختفي|راح يختفي|ليس خطيرا|مو خطير|ليس خطير|لا يضر|ما يضر|عادي|عاديه|عادية|هذا عادي|امن|امنه)' + AE);
  var REASSURE_AR2 = /(?<!غير )(?<!مو )(?<!ليس )(?<!ليست )(?:طبيعي|طبيعيه|طبيعية)/;
  var AR_CLIN = ['سكري', 'السكري', 'ربو', 'الربو', 'نقرس', 'عدوى', 'التهاب', 'جلطه', 'تجلط', 'كسر', 'نزيف', 'سرطان', 'ورم', 'حساسيه', 'بنسلين', 'تخدير', 'فشل كلوي', 'الكلى', 'غسيل كلى', 'القلب', 'قلب', 'ضغط الدم', 'وارفرين', 'ريفاروكسابان', 'اسبرين', 'بنادول', 'باراسيتامول', 'ايبوبروفين', 'تدخين', 'تدخن', 'سجاير', 'كحول', 'مضاد حيوي', 'مضادات حيوية', 'مسيل الدم', 'مميع', 'ديسك', 'الرباط', 'الغضروف'];
  var CLINICIAN_AR = arRe('الطبيب|الطبيبه|الطبيبة|الفريق|الصيدلي|الممرض|الممرضه|الاطباء');
  // Arabic function words and redirect words. Content words outside this list must be grounded in the patient's text.
  var AR_FRAME = ('في من على الى عن مع و او ان لا ما هذا هذه ذلك التي الذي هو هي انت انتي انا نحن كل بعض يمكن يرجى الرجاء ارجو سوف سيراجع سيقوم سيتصل يتصل تتصل فريق طبي طبيب طبيبه ممرض ممرضه صيدلي مختص مختصين حالتك رعايه اسعاف طوارئ اتصل اتصلي تواصل اتصال بك لك لكم عليك شخص مراجعه اجابه سوال اذا لو قبل بعد لان ثم قد كما ليس نعم شكرا المريض المريضه يقول تقول قال قالت انه انها بان اكيد بالتاكيد تماما هنا الان يكون تكون فيه فيها الاجابه السوال الاتصال').split(' ');
  AR_FRAME = AR_FRAME.map(function (w) { return arNorm(w); });
  function arWords(s) { return arNorm(s).split(/[^ء-ي]+/).filter(function (w) { return w.length >= 2; }); }
  function arIsFrame(w) {
    var c = [w, w.replace(/^(?:وال|بال|لل|ال)/, ''), w.replace(/^[وبلفك]/, ''), w.replace(/^[وبلفك]ال/, '')];
    return c.some(function (x) { return AR_FRAME.indexOf(x) >= 0; });
  }
  function arContentWords(s) { return arWords(s).filter(function (w) { return !arIsFrame(w); }); }
  function arBigrams(w) { var o = []; for (var i = 0; i + 1 < w.length; i++) o.push(w.substr(i, 2)); return o; }
  function arStem(w) { return w.replace(/^(?:وال|بال|لل|ال)/, ''); }
  function arWordGrounded(w, srcWords) {
    var wb = arBigrams(w);
    var wn = arStem(w);
    return srcWords.some(function (x0) {
      var x = arStem(x0);
      // a shared stem (ساق / ساقها / ساقي) or enough shared bigrams
      var n = 0; while (n < wn.length && n < x.length && wn.charAt(n) === x.charAt(n)) n++;
      if (n >= 3 || (n === wn.length && n >= 2)) return true;
      var xb = arBigrams(x);
      var hit = wb.filter(function (b) { return xb.indexOf(b) >= 0; }).length;
      return hit / wb.length >= 0.6;
    });
  }
  function arGroundedSummary(s, src, min) {
    var words = arContentWords(s);
    if (!words.length) return true;
    var srcWords = arWords(src);
    var ok = words.filter(function (w) { return arWordGrounded(w, srcWords); }).length;
    return ok / words.length >= min;
  }

  var NEG_ALL = [NEG_EN, NEG_MS, NEG_ZH, NEG_AR];
  function stripNeg(s) { var out = String(s); NEG_ALL.forEach(function (re) { out = out.replace(re, ' '); }); return out; }
  var ADVICE_RE = /\b(?:you should|you must|you need to|you ought|you have to|you had better|i advise|i recommend|i suggest|we advise|we recommend|you do not need|you don'?t need|you need not|no need to|don'?t go|do not go|stay at home|wait at home|it is safe|okay to|ok to|fine to|go ahead with|go for it|you can wait|best to|better to|should|must|ought to)\b|\b(?:anda|kamu)\s+(?:patut|perlu|mesti|harus|sepatutnya|boleh teruskan|tidak perlu|tak perlu)\b|\btidak perlu (?:jumpa|pergi|ke)\b|\bjangan pergi\b|\bsebaiknya\b|\bdisyorkan\b|你应该|你应当|您应该|您应当|必须|最好|不必去|不用去|不要去|在家等|可以在家|可以等|不需要去|不用急诊|不必急诊/i;
  var NEED_TO_CARE_RE = /\bneed to (?:contact|call|tell|speak|raise|ask|discuss|talk|see)\b/gi;
  var REASSURE_RE = /nothing to worry|no need to worry|don'?t worry|do not worry|not to worry|you will be fine|you'?ll be fine|you are fine|you'?re fine|perfectly normal|\b(?:is|are|was|were|it'?s|that'?s|this is|that is|it is)\s+(?:very |quite |completely |perfectly |usually |quite )?(?:normal|common|expected|usual|harmless|nothing|fine|safe|ok|okay)\b|\bit is safe\b|\bsafe to\b|nothing serious|not serious|not dangerous|no cause for (?:concern|alarm)|not a concern|will get better on its own|will settle|should settle|will pass by itself|will go away|tiada apa yang perlu dibimbangkan|tidak perlu (?:risau|bimbang)|jangan (?:risau|bimbang)|tak perlu (?:risau|bimbang)|tidak serius|tidak berbahaya|biasa sahaja|ini normal|adalah normal|ialah normal|是正常|很正常|属正常|没什么好担心|不用担心|不必担心|别担心|不要担心|没事|不要紧|不是紧急|不严重|不危险/i;
  // "you have" at the end of a clause ("any worries you have.") is not a claim about the patient; a conditional clause is not one either.
  var DIAG_YOU_EN = /\byou (?:may have|might have|probably have|likely have|are suffering from|suffer from|are having)\b|\byou (?:have|had)\b(?!\s*(?:[.?!,;:]|$|to\b|about\b|in mind\b))|\banda (?:menghidap|mempunyai|ada|alami)\b/i;
  var DIAG_YOU_ZH = /你(?:有|患有|得了)|您(?:有|患有|得了)/;
  var DIAG_WORD = /\b(?:diagnos\w*|prognos\w*)\b|诊断为/i;
  var DX_EN = 'gout|infection|clot|thrombosis|dvt|pneumonia|fracture|bleeding|sepsis|nerve damage|cauda equina|stroke|heart attack|arthritis|osteoarthritis|tear|torn|ligament|meniscus|diabetes|cancer|tumou?r|gangrene|abscess|cellulitis|shingles|lupus|asthma|copd|appendicitis|hernia|jangkitan|darah beku|pembekuan|patah|pendarahan|radang paru|serangan jantung|strok|kencing manis|barah|kanser|artritis';
  var DX_ZH = '痛风|感染|血栓|骨折|出血|肺炎|败血症|中风|脑卒中|心梗|心肌梗|神经损伤|马尾|关节炎|韧带|撕裂|半月板|糖尿病|癌|肿瘤|哮喘|慢阻肺|阑尾炎|疝|结石|溃疡|脓肿|蜂窝织炎|带状疱疹|狼疮|类风湿';
  var DX_ASSERT_EN = new RegExp('\\b(?:this|it|that|these|those|which)\\s+(?:is|are|looks? like|sounds? like|seems? to be|could be|may be|might be|probably|likely|most likely|possibly|maybe)\\b[^.?!]{0,30}\\b(?:' + DX_EN + ')\\b', 'i');
  var DX_ASSERT_ZH = new RegExp('(?:这|它|这些)(?:可能|很可能|大概|应该)?是[^。！？]{0,6}(?:' + DX_ZH + ')');
  var CLIN_EN = 'diabetes|asthma|copd|gout|infection|clot|thrombosis|dvt|pneumonia|fracture|bleeding|sepsis|stroke|arthritis|tear|torn|ligament|meniscus|cancer|tumou?r|allerg\\w*|penicillin|latex|iodine|anaesthe\\w*|anesthe\\w*|sedation|kidney|dialysis|heart|lung|hba1c|haemoglobin|hemoglobin|blood thinners?|anticoagulants?|smok\\w*|vape|alcohol|angina|hypertension|gangrene|abscess|cellulitis|shingles|lupus|appendicitis|hernia|nerve damage|cauda equina|heart attack|osteoarthritis|alahan|penisilin|iodin|anestetik|bius|buah pinggang|dialisis|jantung|paru-paru|jangkitan|kencing manis|asma|radang|strok|darah beku|pendarahan|patah|barah|kanser|artritis|' + EN_SPEC + '|' + MS_SPEC;
  var CLIN_EN_RE = new RegExp('\\b(?:' + CLIN_EN + ')\\b', 'gi');
  var CLIN_ZH = ['糖尿病', '哮喘', '慢阻肺', '痛风', '感染', '血栓', '骨折', '出血', '肺炎', '败血症', '中风', '心梗', '神经损伤', '马尾', '关节炎', '韧带', '撕裂', '半月板', '癌', '肿瘤', '过敏', '青霉素', '乳胶', '碘', '麻醉', '麻药', '镇静', '肾', '透析', '心脏', '肺', '高血压', '抗凝', '降压药', '降糖药', '华法林', '阿司匹林', '布洛芬', '对乙酰氨基酚', '二甲双胍', '利伐沙班', '阿哌沙班', '吸烟', '抽烟', '喝酒', '饮酒', '阑尾炎', '疝', '结石', '溃疡', '脓肿', '蜂窝织炎', '带状疱疹', '狼疮', '类风湿'];
  var EN_STOP = ('the a an and or of to in on at for with from by is are was were be been being am it its this that these those your you yours i me my we our they them their he she his her has have had do does did not no so if when then than as but also just very more most some such can could would should will shall may might must there here about into over under up down out off what which who whom whose how why where while after before during since until again further once any all each both few other own same too only patient patients says say said tell told tells mentioned clinician clinicians doctor doctors care team review reviews answers answer explain explains discuss talk questions question concerns concern worries results result options risks expect situation operation surgery procedure emergency services service department contact call sorry unwell feel feeling feels seriously severe symptoms worse now please urgent help advice diagnosis prognosis medical check confirm whether claim decide decision go ahead pharmacist nurse mean means meaning notice know knowing sure certain condition conditions wait home stay here answer choices choice seek either happen happens including include ask asking raise bring blood test tests readings much well summary report reports reported reporting').split(' ');
  var MS_STOP = ('yang dan saya tidak ke di dengan untuk itu ini dia adalah pesakit sudah ada boleh akan dalam atau bila anda kami sila ya pada juga kepada sama apa sini dari tiada tak dapat memberi nasihat doktor pasukan perubatan jururawat jawapan hubungi kecemasan bincang bincangkan berbincang jelaskan menyemak tanya beritahu maklumkan jika sangat teruk bertambah pembedahan operasi kebimbangan risiko sekarang segera diagnosis maaf mengatakan kata katanya berkata bahawa ialah pilihan rasa sahaja dia mereka ia tersebut serta tentang daripada dijangka menerangkan risikonya sesuai').split(' ');
  var ZH_FRAME = ['患者', '我们', '我', '您', '你', '的', '了', '是', '有', '在', '会', '将', '请', '与', '和', '并', '或', '也', '可以', '能', '不', '无法', '不能', '不会', '没有', '很', '抱歉', '对不起', '临床医生', '医生', '医护团队', '医疗团队', '团队', '药剂师', '护士', '审阅', '审核', '解释', '讨论', '说明', '告诉', '联系', '咨询', '拨打', '急救', '急诊', '电话', '立即', '马上', '现在', '如果', '情况', '回答', '问题', '担心', '担忧', '意义', '结果', '化验', '就医', '就', '这', '这个', '这一', '说法', '此', '在此', '提供', '建议', '给出', '诊断', '判断', '核实', '解读', '症状', '你的', '您的', '他', '她', '说', '再', '最', '一下', '个人', '对您', '对你', '与您', '他们', '其', '等', '可能', '应', '应该', '必须', '最好', '到', '去', '来', '所以', '但', '已', '向', '把', '这里', '这些', '那', '一些', '部分', '关于', '或者', '以及', '并且', '而', '时', '时候', '的话', '方面', '吗', '吧', '呢', '啊', '也许', '一定', '需要', '继续', '进行', '过', '风险', '预期', '效果', '感觉', '生活', '这样'].sort(function (a, b) { return b.length - a.length; });
  var ZH_UNITS = /[片粒颗次杯层楼级年个天周月岁台]|毫克|克/g;
  var ANSWER_CHOICES_RE = /^(?:answer choices|choices|pilihan jawapan|答案选项)\s*[:：]/i;
  var EMERGENCY_NUMS = { '999': 1, '112': 1, '995': 1, '911': 1, '993': 1 };
  var ZH_NUM = { '一': '1', '二': '2', '两': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9', '十': '10' };
  var EN_NUM = { one: '1', two: '2', three: '3', four: '4', five: '5', satu: '1', dua: '2', tiga: '3', empat: '4', lima: '5' };
  var ESC_RE = /contact|call|emergency|urgent|999|seek|hospital|care team|medical team|clinic|hubungi|kecemasan|pasukan|急诊|急救|联系|拨打|医护团队|就医|就诊|医疗团队/i;
  var COND_RE = /\b(?:if|when|unless)\b|如果|若|jika|kalau|sekiranya|apabila|إذا|اذا|لو/i;
  var CLINICIAN_RE = /clinician|doctor|care team|medical team|nurse|pharmacist|doktor|pasukan|jururawat|临床医生|医生|医护团队|医疗团队|药剂师|护士/i;
  var QSTART_RE = /^(?:do|does|did|have|has|had|can|could|would|will|is|are|was|were|any|if|whether|what|which|who|where|when|why|how|apakah|adakah|berapa|bila|bilakah|di mana|mengapa|siapa|bagaimana|是否|有没有|您有没有|你有没有|您是否|你是否|请问|什么|哪|谁|为什么|多少|几|发生)/i;
  var DOSE_NUM_RE = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg|ug|g|ml|iu|units?|tablets?|tabs?|pills?|capsules?|puffs?|sachets?|biji|keping|butir|kapsul|sudu|titik)\b|\b(?:one|two|three|four|five|half|satu|dua|tiga|empat|lima|setengah)\s+(?:tablets?|tabs?|pills?|capsules?|biji|keping|butir|kapsul|sudu)\b|(?:\d+(?:\.\d+)?|[一二两三四五六七八九十])\s*(?:片|粒|颗|毫克|克)|几片|多少片|几粒|多少粒|\b(?:once|twice)\s+(?:a |per |each )?(?:day|daily|night)\b|\bper day\b/gi;
  var DOSE_BARE_RE = /\b(?:dose|doses|dosage|dosing|dos|dosis)\b|剂量|用量/i;

  function normNums(s) {
    return String(s).toLowerCase()
      .replace(/([一二两三四五六七八九十])(?=\s*(?:片|粒|颗|次|杯|层|楼|级|年|个|天|周|月|岁|台|毫克|克|mg|tablets?|biji|keping|pills?|capsules?))/g, function (m, c) { return ZH_NUM[c]; })
      .replace(/\b(one|two|three|four|five|satu|dua|tiga|empat|lima)\b(?=\s*(?:tablets?|tabs?|pills?|capsules?|biji|keping|butir|kapsul|mg|times?|kali))/g, function (m) { return EN_NUM[m]; });
  }
  function squash(s) { return normNums(s).replace(/[^a-z0-9一-鿿]+/g, ''); }
  function patientSource(userText) {
    var u = String(userText == null ? '' : userText);
    var m = u.match(/Patient said:\s*"([\s\S]*)"\s*$/);
    return m ? m[1] : u;
  }
  function hasCJK(s) { return /[一-鿿]/.test(s); }
  // Chinese content: frame words, pronouns, quantity characters and digits are removed on both sides before comparison.
  function zhContent(s) {
    var out = normNums(s).replace(/[\s\p{P}\p{S}]+/gu, '').replace(/[0-9.]+/g, '');
    ZH_FRAME.forEach(function (w) { out = out.split(w).join(''); });
    return out.replace(ZH_UNITS, '');
  }
  function bigrams(s) {
    var out = [];
    for (var i = 0; i + 1 < s.length; i++) out.push(s.substr(i, 2));
    return out;
  }
  // Symptom synonyms a faithful summary may use (hurts -> pain, bengkak -> swollen). Applied to both sides.
  var SYN = { hurt: 'pain', hurts: 'pain', hurting: 'pain', ache: 'pain', aches: 'pain', aching: 'pain', painful: 'pain', sakit: 'pain', swollen: 'swell', swelling: 'swell', swells: 'swell', bengkak: 'swell' };
  function enTokens(s) {
    return normNums(s).split(/[^a-z0-9À-ɏ]+/).filter(function (w) { return w.length >= 3; }).map(function (w) { return SYN[w] || w; });
  }
  function isContentWord(w) { return EN_STOP.indexOf(w) < 0 && MS_STOP.indexOf(w) < 0; }
  function isFrame(s) {
    if (hasCJK(s)) return zhContent(s).length === 0;
    if (hasAr(s)) return arContentWords(s).length === 0 && enTokens(s).filter(isContentWord).length === 0;
    return enTokens(s).filter(isContentWord).length === 0;
  }
  // A declarative sentence must restate the patient's own words: en/ms by token overlap, zh by character bigrams.
  // Arabic sentences are grounded word by word (bigram overlap); any English words in them are checked as before.
  function groundedSummary(s, src, min) {
    if (hasAr(s)) return arGroundedSummary(s, src, min || 0.6) && (enTokens(s).filter(isContentWord).length === 0 || groundedSummaryEn(s, src));
    return groundedSummaryEn(s, src);
  }
  function groundedSummaryEn(s, src) {
    if (hasCJK(s)) {
      var sb = bigrams(zhContent(s)), srcB = bigrams(zhContent(src));
      if (!sb.length) return true;
      var hitZ = sb.filter(function (b) { return srcB.indexOf(b) >= 0; }).length;
      return hitZ / sb.length >= 0.6;
    }
    var words = enTokens(s).filter(isContentWord);
    if (!words.length) return true;
    var srcWords = enTokens(src);
    var hits = words.filter(function (w) {
      return srcWords.some(function (x) { return x === w || (x.length >= 4 && w.indexOf(x) >= 0) || (w.length >= 4 && x.indexOf(w) >= 0); });
    }).length;
    return hits / words.length >= 0.6;
  }
  function numbersGrounded(s, src) {
    var srcNums = normNums(src).match(/\d+(?:\.\d+)?/g) || [];
    return (normNums(s).match(/\d+(?:\.\d+)?/g) || []).every(function (n) { return EMERGENCY_NUMS[n] || srcNums.indexOf(n) >= 0; });
  }
  // Specific medicine names, clinical conditions and allergens in a declarative sentence must appear in the patient's words.
  function clinicalGrounded(s, src) {
    var srcSq = squash(src);
    var en = s.match(CLIN_EN_RE) || [];
    for (var i = 0; i < en.length; i++) if (srcSq.indexOf(squash(en[i])) < 0) return false;
    for (var j = 0; j < CLIN_ZH.length; j++) if (s.indexOf(CLIN_ZH[j]) >= 0 && src.indexOf(CLIN_ZH[j]) < 0) return false;
    for (var a = 0; a < AR_CLIN.length; a++) if (s.indexOf(AR_CLIN[a]) >= 0 && src.indexOf(AR_CLIN[a]) < 0) return false;
    return true;
  }
  function isQuestion(s) { return /[?？؟]["')\]]*\s*$/.test(s); }
  function splitSentences(r) {
    return r.split(/\n+/).reduce(function (a, line) {
      return a.concat(line.split(/(?<=[!?。！？؟])\s*|(?<=\.)\s+/));
    }, []).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function instrHit(s) {
    return INSTR_EN_RE.test(s) || INSTR_EN_REV_RE.test(s) || INSTR_MS_RE.test(s) || INSTR_ZH_RE.test(s) || DO_NOT_RE.test(s) || YOU_CAN_RE.test(s) || INSTR_AR_RE.test(s);
  }
  // Third-person subject of a summary (en, ms, zh, ar). It only lets an instruction-like sentence through when restates() also holds.
  var AR_PATIENT_RE = /^(?:المريض|المريضه|مريض|مريضه|الشخص)(?![ء-ي])/;
  function isThirdPerson(s) { return /^(?:the patient|pesakit|patient|they|he|she|dia|beliau)\b/i.test(s) || /^(?:患者|病人|佢|他|她)/.test(s) || AR_PATIENT_RE.test(s); }
  // A restatement: every content word of the sentence (or 60% for en/ms, 90% for zh/ar) is in the patient's words, and no clinical term is new.
  function restates(s, src) { return groundedSummary(s, src, hasAr(s) || hasCJK(s) ? 0.9 : 0.6) && clinicalGrounded(s, src); }
  function removeQForm(s) { return s.replace(/\b(?:do|does|did|can|could|would|will|any|if|whether|have|when|unless|in case)\s+you\s+have\b/gi, ' '); }
  function isEscalation(s) { return ESC_RE.test(s) && COND_RE.test(s); }

  // Returns {ok:true} or {ok:false, reason}. classify is optional: when given, assertions and medicine-directed questions are classified too.
  function guardReply(reply, userText, classify) {
    var r = arNorm(String(reply == null ? '' : reply)).trim();
    var fail = function (reason) { return { ok: false, reason: reason }; };
    if (!r) return fail('empty');
    if (r.length > 600) return fail('too_long');
    var src = arNorm(patientSource(userText));

    // 1. whole-reply checks on the reply with negated refusals removed
    var scan = stripNeg(r);
    if (ADVICE_RE.test(scan.replace(NEED_TO_CARE_RE, ' ')) || ADVICE_AR.test(scan)) return fail('advice');
    if (REASSURE_RE.test(scan) || REASSURE_AR.test(scan) || REASSURE_AR2.test(scan)) return fail('reassurance');
    if (DX_ASSERT_EN.test(scan) || DX_ASSERT_ZH.test(scan) || DX_ASSERT_AR.test(scan) || DX_ASSERT_AR2.test(scan)) return fail('diagnosis');

    // 2. sentence checks
    var sentences = splitSentences(r);
    var assertions = [], directiveQ = [];
    for (var i = 0; i < sentences.length; i++) {
      var s = sentences[i];
      if (ANSWER_CHOICES_RE.test(s)) continue;
      var q = isQuestion(s);
      var noNeg = stripNeg(s);
      if (!q && DIAG_WORD.test(noNeg)) return fail('diagnosis');
      if (!q && (AR_DIAG_WORD.test(noNeg) || DIAG_YOU_AR.test(noNeg))) return fail('diagnosis');
      if (!(q && QSTART_RE.test(s)) && !COND_RE.test(noNeg)) {
        if (DIAG_YOU_EN.test(removeQForm(noNeg))) return fail('diagnosis');
        if (!q && DIAG_YOU_ZH.test(noNeg)) return fail('diagnosis');
      }
      if (q) {
        if (DOSE_NUM_RE.test(s)) { DOSE_NUM_RE.lastIndex = 0; return fail('dose'); }
        if (AR_DOSE_RE.test(s)) return fail('dose');
        DOSE_NUM_RE.lastIndex = 0;
        if (instrHit(s) && (QSTRONG_RE.test(s) || hasAr(s))) return fail('instruction');
        if ((MED_ANY_RE.test(s) || AR_MED_RE.test(s)) && (WEAK_DIRECTIVE_RE.test(s) || AR_DIRECTIVE_RE.test(s))) directiveQ.push(s);
        continue;
      }
      // declarative
      if (instrHit(s) && !(isThirdPerson(s) && restates(s, src))) return fail('instruction');
      if (DOSE_BARE_RE.test(s) && !DOSE_BARE_RE.test(src)) return fail('dose');
      if (AR_DOSE_RE.test(s) && !AR_DOSE_RE.test(src)) return fail('dose');
      var doseTok = s.match(DOSE_NUM_RE) || [];
      var srcSq = squash(src);
      if (doseTok.some(function (t) { return srcSq.indexOf(squash(t)) < 0; })) return fail('dose');
      var stripped = stripNeg(s);
      if (!numbersGrounded(stripped, src)) return fail('invented_number');
      if (isFrame(stripped) || isEscalation(s)) {
        if (!clinicalGrounded(stripped, src)) return fail('invented_term');
        continue;
      }
      assertions.push(stripped);
    }

    // 3. engine: medicine-directed questions (ROUTE clinical); assertions (EMERGENCY / SAME-DAY / ROUTE clinical)
    if (directiveQ.length && !classify) return fail('directive_medicine');
    if (classify) {
      for (var d = 0; d < directiveQ.length; d++) {
        var cq = null;
        try { cq = classify(directiveQ[d]); } catch (e) { return fail('classifier_error'); }
        if (cq && cq.cls === 'ROUTE' && (cq.flags || []).some(function (f) { return /clinical judgement|worsening/.test(f); })) return fail('engine_route_clinical');
      }
      if (assertions.length) {
        var ca = null;
        try { ca = classify(assertions.join(' ')); } catch (e2) { return fail('classifier_error'); }
        if (ca && (ca.cls === 'EMERGENCY' || ca.cls === 'SAME-DAY')) return fail('engine_' + ca.cls);
        if (ca && ca.cls === 'ROUTE' && (ca.flags || []).some(function (f) { return /clinical judgement|worsening/.test(f); })) return fail('engine_route_clinical');
      }
    }

    // 4. assertions must restate the patient's words, with their specific names and conditions grounded
    for (var k = 0; k < assertions.length; k++) {
      if (!groundedSummary(assertions[k], src)) return fail('not_question_or_summary');
      if (!clinicalGrounded(assertions[k], src)) return fail('invented_term');
    }

    // 5. a refusal or redirect may not name a medicine in a statement
    if ((hasNeg(r) || CLINICIAN_RE.test(r) || CLINICIAN_AR.test(r)) && sentences.some(function (x) { return !isQuestion(x) && (MED_NAME_RE.test(x) || AR_MED_NAME_RE.test(x)); })) return fail('medicine_in_redirect');
    return { ok: true };
  }
  function hasNeg(s) { return NEG_ALL.some(function (re) { re.lastIndex = 0; var h = re.test(s); re.lastIndex = 0; return h; }); }

  function hostOf(u) {
    try { return new URL(u).hostname; } catch (e) { return ''; }
  }

  // Scripted fallback: returns the fixed question text for the given step. Never touches the network.
  function scriptedText(opts) {
    var lang = (opts && opts.lang) || 'en';
    var step = opts && opts.step;
    if (typeof step === 'string' && step) return step;
    if (step && step.text) {
      if (typeof step.text === 'string') return step.text;
      return step.text[lang] || step.text.en || '';
    }
    return SCRIPTED_DEFAULT[lang] || SCRIPTED_DEFAULT.en;
  }

  // Only plain user/assistant/system messages with string content go to the model.
  function sanitise(messages) {
    if (!Array.isArray(messages)) return [];
    var out = [];
    for (var i = 0; i < messages.length && out.length < 40; i++) {
      var m = messages[i];
      if (!m || typeof m.content !== 'string') continue;
      if (m.role !== 'user' && m.role !== 'assistant' && m.role !== 'system') continue;
      out.push({ role: m.role, content: m.content.slice(0, 4000) });
    }
    return out;
  }

  function extractText(data) {
    if (!data) return '';
    if (typeof data.text === 'string') return data.text;
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return String(data.choices[0].message.content || '');
    }
    return '';
  }

  function createAdapter(cfg) {
    cfg = cfg || {};
    var fetchImpl = cfg.fetchImpl || (typeof fetch === 'function' ? fetch : null);
    var endpoint = cfg.endpoint || '/v1/chat/completions';
    var proxyUrl = cfg.proxyUrl || '';
    var baseUrl = String(cfg.baseUrl || '').replace(/\/+$/, '');
    var apiKey = cfg.apiKey || '';
    var model = cfg.model || '';
    var provider = cfg.provider || hostOf(baseUrl) || (proxyUrl ? 'proxy' : 'scripted');
    var mode = cfg.mode === 'ai' ? 'ai' : 'scripted';
    var inBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

    function usable() {
      if (mode !== 'ai' || !fetchImpl) return false;
      if (proxyUrl) return true;               // browser path: key lives on the proxy
      if (!baseUrl) return false;              // no config: scripted
      if (apiKey && inBrowser) return false;   // never ship a provider key from a browser
      return true;
    }

    // review2 M1: a stalled proxy must not freeze the interview. After timeoutMs the scripted text is used.
    var timeoutMs = typeof cfg.timeoutMs === 'number' ? cfg.timeoutMs : 15000;

    // second_check support: opts.raw sends the caller's messages as given (its own system message, no SYSTEM_GUARD,
    // no guardReply, JSON requested). It never returns scripted text: failures come back as mode 'error' or 'unavailable'.
    function askRaw(messages, opts) {
      var ms = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : timeoutMs;
      if (!usable()) return Promise.resolve({ text: '', provider: 'none', mode: 'unavailable', reason: 'not_configured' });
      var msgs = sanitise(messages);
      var url, headers = { 'content-type': 'application/json' }, body;
      if (proxyUrl) {
        url = proxyUrl;
        // second_check: the proxy owns the prompt, so only the patient text is sent (never a system message).
        body = opts.proxyMode === 'second_check'
          ? { mode: 'second_check', text: String(opts.text == null ? '' : opts.text) }
          : { messages: msgs, json: true, lang: opts.lang || 'en' };
      } else {
        url = baseUrl + endpoint;
        if (apiKey) headers.authorization = 'Bearer ' + apiKey;
        body = { model: model, messages: msgs, temperature: 0, stream: false, response_format: { type: 'json_object' } };
      }
      var timer = null;
      var timeout = new Promise(function (resolve) {
        timer = setTimeout(function () { resolve({ text: '', provider: 'none', mode: 'error', reason: 'timeout' }); }, ms);
      });
      var call = Promise.resolve()
        .then(function () { return fetchImpl(url, { method: 'POST', headers: headers, body: JSON.stringify(body) }); })
        .then(function (res) {
          if (!res || !res.ok) throw new Error('http_error');
          return res.json();
        })
        .then(function (data) { return { text: extractText(data).slice(0, 4000), provider: provider, mode: 'ai' }; })
        .catch(function () { return { text: '', provider: 'none', mode: 'error', reason: 'error' }; });
      return Promise.race([call, timeout]).then(function (out) { clearTimeout(timer); return out; });
    }

    function ask(messages, opts) {
      opts = opts || {};
      if (opts.raw) return askRaw(messages, opts);
      function fallback(reason) {
        return { text: scriptedText(opts), provider: 'scripted', mode: 'scripted', reason: reason };
      }
      if (!usable()) return Promise.resolve(fallback('not_configured'));
      var timer = null;
      var timeout = new Promise(function (resolve) { timer = setTimeout(function () { resolve(fallback('timeout')); }, timeoutMs); });
      return Promise.race([callModel(messages, opts, fallback), timeout]).then(function (out) {
        clearTimeout(timer);
        return out;
      });
    }

    function callModel(messages, opts, fallback) {

      var msgs = [{ role: 'system', content: SYSTEM_GUARD }].concat(sanitise(messages));
      var url, headers, body;
      if (proxyUrl) {
        url = proxyUrl;
        headers = { 'content-type': 'application/json' };
        body = { messages: msgs, json: !!opts.json, lang: opts.lang || 'en' };
      } else {
        url = baseUrl + endpoint;
        headers = { 'content-type': 'application/json' };
        if (apiKey) headers.authorization = 'Bearer ' + apiKey;
        body = { model: model, messages: msgs, temperature: 0, stream: false };
        if (opts.json) body.response_format = { type: 'json_object' };
      }

      return Promise.resolve()
        .then(function () { return fetchImpl(url, { method: 'POST', headers: headers, body: JSON.stringify(body) }); })
        .then(function (res) {
          if (!res || !res.ok) throw new Error('http_error');
          return res.json();
        })
        .then(function (data) {
          var text = extractText(data).slice(0, 4000);
          if (!text) throw new Error('empty_reply');
          var lastUser = '';
          for (var i = msgs.length - 1; i >= 0; i--) { if (msgs[i].role === 'user') { lastUser = msgs[i].content; break; } }
          var g = guardReply(text, lastUser, null);
          if (!g.ok) return { text: scriptedText(opts), provider: 'scripted', mode: 'blocked', reason: g.reason };
          return { text: text, provider: provider, mode: 'ai' };
        })
        .catch(function () { return fallback('error'); });
    }

    return { ask: ask, provider: provider, mode: mode };
  }

  // Safety wrapper: classify the patient's text first. EMERGENCY, SAME-DAY and ROUTE (clinical judgement) get the engine's
  // fixed reply and NO model call. The care team task is created by the interview's own routing, which runs before this.
  // round 5 (review2 AI mode): ROUTE was sent to the model before; a clinical question such as "can I stop my warfarin"
  // must never reach a model. A missing classifier also means no model call (fail to the safe side).
  function askSafely(adapter, userText, classify, opts) {
    var text = String(userText == null ? '' : userText);
    var r = null;
    if (typeof classify !== 'function') {
      return Promise.resolve({ text: SAFE_SAME_DAY, provider: 'engine', mode: 'blocked', cls: 'SAME-DAY', flags: ['no_classifier'], botAnswered: false });
    }
    try {
      r = classify(text, opts && opts.ctx);
    } catch (e) {
      // If classification fails, fail to the safe side: no model call.
      return Promise.resolve({ text: SAFE_SAME_DAY, provider: 'engine', mode: 'blocked', cls: 'SAME-DAY', flags: ['classifier_error'], botAnswered: false });
    }
    if (!r || typeof r !== 'object') {
      return Promise.resolve({ text: SAFE_SAME_DAY, provider: 'engine', mode: 'blocked', cls: 'SAME-DAY', flags: ['classifier_empty'], botAnswered: false });
    }
    if (r.cls === 'EMERGENCY' || r.cls === 'SAME-DAY' || r.cls === 'ROUTE') {
      return Promise.resolve({ text: r.reply, provider: 'engine', mode: 'engine', cls: r.cls, flags: r.flags || [], botAnswered: false });
    }
    var lang = (r && r.lang) || (opts && opts.lang) || 'en';
    var callOpts = Object.assign({}, opts || {}, { lang: lang });
    return adapter.ask([{ role: 'user', content: text }], callOpts).then(function (out) {
      if (out && out.mode === 'ai') {
        // second guard on the same reply: engine classification of the model's own words
        var g = guardReply(out.text, text, classify);
        if (!g.ok) return { text: scriptedText(callOpts), provider: 'scripted', mode: 'blocked', reason: g.reason, cls: r ? r.cls : undefined, flags: [] };
      }
      return Object.assign({ cls: r ? r.cls : undefined }, out);
    });
  }

  var api = { createAdapter: createAdapter, askSafely: askSafely, guardReply: guardReply, scriptedText: scriptedText, presets: presets, SYSTEM_GUARD: SYSTEM_GUARD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PL_adapter = api;
})(this);
