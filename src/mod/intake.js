/* PeriLoop intake: deterministic rule-based summary and to-do mapping. No model calls, no network.
   Thresholds come from engine THRESH (draft, surgeon sign-off). Everything is patient-reported; clinician to verify.
   Round 3: ms and zh values, reasons, gaps and to-do titles are machine drafts (see the page notice). */
(function (root) {
  'use strict';
  const D = 24; // engine time unit: hours per day
  const eng = (typeof module !== 'undefined' && module.exports) ? require('../engine.js') : root.PeriLoop;
  const IDMAP = (typeof module !== 'undefined' && module.exports) ? require('./idmap.js') : root.PL_IDMAP;
  const LABEL = 'Patient-reported, clinician to verify';
  const REC_TITLE = 'Recorded, not summarised';
  const PAYERS = ['self', 'employer', 'insurance', 'government', 'other'];
  const WALK_BANDS = ['under 100 m', '100-500 m', 'over 500 m', 'cannot walk'];

  const Q = {
    meds_text: 'Current medicines', blood_thinner: 'Blood thinner', allergy_text: 'Allergies (free text)',
    penicillin_allergy: 'Penicillin allergy', latex_allergy: 'Latex allergy', diabetes: 'Diabetes',
    hba1c: 'HbA1c', heart_disease: 'Heart disease', lung_disease: 'Lung disease', kidney_disease: 'Kidney disease',
    anaesthetic_problem: 'Previous anaesthetic problem', smoker: 'Smoker', alcohol: 'Alcohol',
    prior_surgery_same_joint: 'Previous surgery on same joint', mrsa_or_admission_past_year: 'MRSA or admission in past year',
    lives_alone: 'Lives alone', stairs_home: 'Stairs at home', mobility_aid: 'Uses mobility aid',
    walk_distance_m: 'Walking distance in metres', payer: 'Payer', preferred_language: 'Preferred language',
    lumbar_bladder_bowel_change: 'Bladder or bowel change', lumbar_saddle_numbness: 'Saddle numbness',
    lumbar_leg_weakness: 'Leg weakness', night_pain: 'Night pain', prior_injections: 'Prior injections'
  };
  // Machine-draft labels for ms and zh (review1 M6). The notice under the summary says so.
  const QL = {
    en: Q,
    ms: {
      meds_text: 'Ubat semasa', blood_thinner: 'Pencair darah', allergy_text: 'Alahan (teks bebas)',
      penicillin_allergy: 'Alahan penisilin', latex_allergy: 'Alahan lateks', diabetes: 'Diabetes',
      hba1c: 'HbA1c', heart_disease: 'Penyakit jantung', lung_disease: 'Penyakit paru-paru', kidney_disease: 'Penyakit buah pinggang',
      anaesthetic_problem: 'Masalah anestetik sebelum ini', smoker: 'Perokok', alcohol: 'Alkohol',
      prior_surgery_same_joint: 'Pembedahan terdahulu pada sendi sama', mrsa_or_admission_past_year: 'MRSA atau kemasukan dalam setahun',
      lives_alone: 'Tinggal seorang diri', stairs_home: 'Tangga di rumah', mobility_aid: 'Alat bantu berjalan',
      walk_distance_m: 'Jarak berjalan dalam meter', payer: 'Pembayar', preferred_language: 'Bahasa pilihan',
      lumbar_bladder_bowel_change: 'Perubahan pundi kencing atau usus', lumbar_saddle_numbness: 'Kebas kawasan duduk',
      lumbar_leg_weakness: 'Kelemahan kaki', night_pain: 'Sakit pada waktu malam', prior_injections: 'Suntikan terdahulu'
    },
    zh: {
      meds_text: '当前用药', blood_thinner: '抗凝血药', allergy_text: '过敏（自由文本）',
      penicillin_allergy: '青霉素过敏', latex_allergy: '乳胶过敏', diabetes: '糖尿病',
      hba1c: '糖化血红蛋白 HbA1c', heart_disease: '心脏病', lung_disease: '肺病', kidney_disease: '肾病',
      anaesthetic_problem: '既往麻醉问题', smoker: '吸烟', alcohol: '饮酒',
      prior_surgery_same_joint: '同一关节既往手术', mrsa_or_admission_past_year: 'MRSA或一年内住院',
      lives_alone: '独居', stairs_home: '家中有楼梯', mobility_aid: '使用助行器',
      walk_distance_m: '步行距离（米）', payer: '付费方式', preferred_language: '首选语言',
      lumbar_bladder_bowel_change: '小便或大便改变', lumbar_saddle_numbness: '鞍区麻木',
      lumbar_leg_weakness: '腿部无力', night_pain: '夜间疼痛', prior_injections: '既往注射'
    }
  };
  const labelOf = (id, lang) => (QL[lang] && QL[lang][id]) || Q[id] || id;
  const ALL_IDS = Object.keys(Q);
  const LUMBAR_IDS = ['lumbar_bladder_bowel_change', 'lumbar_saddle_numbness', 'lumbar_leg_weakness'];
  // Question-level red flags, as the interview halts on them. Same levels as interview.js redFlagIf.
  const RED_QIDS = {
    lumbar_leg_weakness: 'SAME-DAY', lumbar_bladder_bowel_change: 'EMERGENCY', lumbar_saddle_numbness: 'EMERGENCY',
    tkr_calf: 'SAME-DAY', sh_fingers: 'SAME-DAY', fa_sore: 'SAME-DAY', fa_toes: 'SAME-DAY', symptoms_now: 'EMERGENCY'
  };
  const RED_LABEL = {
    en: {
      tkr_calf: 'Calf pain or swelling in the operated leg', sh_fingers: 'Numb, cold or pale fingers on the operated arm',
      fa_sore: 'Open sore, blister or ulcer on the operated foot or ankle', fa_toes: 'Cold, pale, blue or purple toes',
      symptoms_now: 'Chest pain, trouble breathing or confusion now'
    },
    ms: {
      tkr_calf: 'Sakit atau bengkak betis pada kaki yang dibedah', sh_fingers: 'Jari kebas, sejuk atau pucat pada lengan yang dibedah',
      fa_sore: 'Luka terbuka, lepuh atau ulser pada kaki atau buku lali yang dibedah', fa_toes: 'Jari kaki sejuk, pucat, biru atau ungu',
      symptoms_now: 'Sakit dada, sesak nafas atau keliru sekarang'
    },
    zh: {
      tkr_calf: '手术腿的小腿疼痛或肿胀', sh_fingers: '手术手臂的手指麻木、发冷或发白',
      fa_sore: '手术脚或踝部的开放性伤口、水疱或溃疡', fa_toes: '脚趾发冷、苍白、发蓝或发紫',
      symptoms_now: '现在有胸痛、呼吸困难或意识混乱'
    }
  };
  // Canonical phrases, used only to obtain the engine's own reply text for a question-level red flag.
  const CANON = {
    EMERGENCY: { en: 'chest pain', ms: 'saya sakit dada sejak semalam', zh: '胸口痛' },
    'SAME-DAY': { en: 'fever reported', ms: 'saya demam sejak semalam', zh: '发烧' }
  };
  const RANK = { 'SAME-DAY': 2, EMERGENCY: 3 };
  const YN = new Set(['penicillin_allergy', 'latex_allergy', 'diabetes', 'heart_disease', 'lung_disease', 'kidney_disease',
    'anaesthetic_problem', 'smoker', 'prior_surgery_same_joint', 'mrsa_or_admission_past_year', 'lives_alone', 'stairs_home',
    'mobility_aid', 'night_pain', 'prior_injections'].concat(LUMBAR_IDS));
  const SECTIONS = [
    { title: 'Medicines', ids: ['meds_text', 'blood_thinner'] },
    { title: 'Allergies', ids: ['allergy_text', 'penicillin_allergy', 'latex_allergy'] },
    { title: 'Medical history', ids: ['diabetes', 'hba1c', 'heart_disease', 'lung_disease', 'kidney_disease', 'anaesthetic_problem', 'smoker', 'alcohol', 'mrsa_or_admission_past_year'] },
    { title: 'Home and support', ids: ['lives_alone', 'stairs_home', 'mobility_aid', 'walk_distance_m', 'payer', 'preferred_language'] },
    { title: 'Procedure-specific', ids: ['prior_surgery_same_joint', 'night_pain', 'prior_injections'].concat(LUMBAR_IDS) },
    { title: "Patient's own words", ids: [] }
  ];
  const WORDS_SECTION = SECTIONS.length - 1;
  const ANAES_GROUP = ['anaesthetic_problem', 'heart_disease', 'lung_disease', 'kidney_disease', 'smoker'];
  // review1 B2: names that count as a blood thinner when they appear in the medicine list or free text
  const ANTICOAG_NAME = /warfarin|rivaroxaban|apixaban|dabigatran|edoxaban|enoxaparin|clexane|aspirin|clopidogrel|xarelto|eliquis|marevan|coumadin/i;
  const PENICILLIN_TEXT = /penicillin|penisilin|amoxicillin|amoksisilin|augmentin|ampicillin|pen v|青霉素/i;
  // review2 B4 (round 4): drug and latex allergies named in free text
  const SULFA_RE = /sulfa|sulpha|sulfonamide|sulphonamide|co-?trimoxazole|bactrim|septrin/i;
  const IODINE_RE = /iodine|iodin|yodium|碘|contrast dye|pewarna kontras/i;
  const LATEX_RE = /latex|lateks|乳胶/i;
  const NEG_ALLERGY_RE = /\b(not|no|never|tiada|tak|tidak|without)\b[^.;]{0,12}\ballerg\w*|不过敏|没有过敏|无过敏|没过敏/i;
  const NONE_START_RE = /^\s*(no|none|nil|tiada|tak ada|tidak ada|无|没有)\b/i;
  // review1 item 10 (round 3 B): the worsening amber needs a SYMPTOM word AND a worsening word. Medicine or travel
  // questions ("can I take ibuprofen", "can I fly") have no symptom word and never trigger it.
  const SYMPTOM_RE = /\b(pain|painful|ache|aching|swelling|swollen|numb|numbness|weakness|weak|fever|discharge|bleeding|redness|tingling|sore|lump|rash|pus|blister|ulcer)\b|sakit|bengkak|kebas|lemah|demam|nanah|痛|肿|麻木|无力|发烧|发热|流脓|渗液|发红/i;
  const STRONG_WORSE_RE = /\bworse\b|\bworsen\w*|deteriorat\w*|\bspreading\b|semakin|lebih teruk|bertambah|makin|更严重|加重|越来越|变差|恶化/i;
  const WEAK_WORSE_RE = /\bincreas\w*|getting (?:bigger|more)|\bmore (?:pain|painful|swollen|swelling|numb\w*|weak\w*|discharge|bleeding|tender|fever)\b/i;
  const MED_OR_TRAVEL_RE = /medicin|medication|\bubat\b|\bpills?\b|\btablets?\b|\bdose\b|\bdrug|painkiller|ibuprofen|paracetamol|parasetamol|aspirin|warfarin|\bfly\b|\bflying\b|\bflights?\b|\bdriv|penerbangan|terbang|memandu|药|片|飞机|飞行|驾车|开车/i;
  const WORSENING_TEXT = 'Patient reports worsening symptoms: clinician to review';

  /* ---------- values: normalise for display; yes/no and field values translated for ms and zh (machine drafts) ---------- */
  const YNW = { en: { yes: 'yes', no: 'no', unknown: 'unknown', unclear: 'unclear' }, ms: { yes: 'ya', no: 'tidak', unknown: 'tidak tahu', unclear: 'tidak jelas' }, zh: { yes: '是', no: '否', unknown: '不知道', unclear: '不清楚' } };
  const FIELD_VAL = {
    alcohol: { ms: { none: 'tidak pernah', occasional: 'kadang-kadang', regular: 'kerap' }, zh: { none: '不饮酒', occasional: '偶尔', regular: '经常' } },
    payer: { ms: { self: 'bayar sendiri', employer: 'skim syarikat majikan', insurance: 'insurans swasta', government: 'skim kerajaan', other: 'lain-lain' },
      zh: { self: '自费', employer: '雇主或公司计划', insurance: '私人保险', government: '政府计划', other: '其他' } },
    preferred_language: { ms: { en: 'Bahasa Inggeris', ms: 'Bahasa Malaysia', zh: 'Bahasa Cina' }, zh: { en: '英文', ms: '马来文', zh: '中文' } },
    walk_distance_m: { ms: { 'under 100 m': 'kurang 100 m', '100-500 m': '100 hingga 500 m', 'over 500 m': 'lebih 500 m', 'cannot walk': 'tidak boleh berjalan' },
      zh: { 'under 100 m': '不到100米', '100-500 m': '100至500米', 'over 500 m': '超过500米', 'cannot walk': '无法行走' } },
    hba1c: { ms: { 'not applicable': 'tidak berkenaan (tiada diabetes)', unknown: 'tidak tahu' }, zh: { 'not applicable': '不适用（无糖尿病）', unknown: '不知道' } },
    allergy_text: { ms: { 'none known': 'tiada diketahui', yes: 'ya' }, zh: { 'none known': '无已知过敏', yes: '是' } }
  };
  const pick = (lang, o) => (o[lang] !== undefined ? o[lang] : o.en);

  /* ---------- every sentence the page or the summary shows, by language (machine drafts for ms and zh) ---------- */
  const M = {
    btReported: (l, name) => pick(l, {
      en: 'Blood thinner reported' + (name ? ': ' + name : ' (name not given)'),
      ms: 'Pencair darah dilaporkan' + (name ? ': ' + name : ' (nama tidak diberi)'),
      zh: '报告服用抗凝血药' + (name ? '：' + name : '（未提供药名）') }),
    hba1cHigh: (l, v, thr) => pick(l, { en: `HbA1c ${v} is at or above the ${thr}% threshold`, ms: `HbA1c ${v} adalah sama atau melebihi ambang ${thr}%`, zh: `糖化血红蛋白 ${v} 达到或超过 ${thr}% 的阈值` }),
    penReported: l => pick(l, { en: 'Penicillin allergy reported', ms: 'Alahan penisilin dilaporkan', zh: '报告青霉素过敏' }),
    anaesReported: (l, label) => pick(l, { en: `${label} reported`, ms: `${label} dilaporkan`, zh: `报告：${label}` }),
    aloneStairs: l => pick(l, { en: 'Lives alone with stairs at home', ms: 'Tinggal seorang diri dengan tangga di rumah', zh: '独居，且家中有楼梯' }),
    worsening: l => pick(l, { en: WORSENING_TEXT, ms: 'Pesakit melaporkan gejala semakin teruk: doktor perlu semak', zh: '患者报告症状加重：需临床医生审阅' }),
    btConflict: l => pick(l, { en: 'Medicine list mentions a blood thinner; yes/no answer disagrees: clinician to verify',
      ms: 'Senarai ubat menyebut pencair darah; jawapan ya/tidak tidak sepadan: doktor perlu sahkan', zh: '用药清单提到抗凝血药，但是/否的回答不一致：需临床医生核实' }),
    cauda: (l, label, id) => pick(l, { en: `Possible cauda equina or neurological red flag: ${label} reported [${id}]`,
      ms: `Kemungkinan tanda bahaya cauda equina atau neurologi: ${label} dilaporkan [${id}]`, zh: `可能的马尾或神经系统危险信号：报告${label} [${id}]` }),
    redOther: (l, label, id) => pick(l, { en: `${label} reported [${id}]`, ms: `${label} dilaporkan [${id}]`, zh: `报告：${label} [${id}]` }),
    wordsTriaged: (l, cls, flags, i) => pick(l, { en: `Patient's words auto-triaged ${cls} (${flags}) [freeText.${i}]`,
      ms: `Kata-kata pesakit diklasifikasikan ${cls} (${flags}) [freeText.${i}]`, zh: `患者自述被自动分级为 ${cls}（${flags}）[freeText.${i}]` }),
    wordsLine: (l, cls, text, i) => pick(l, { en: `Patient's words (auto-triage ${cls}): "${text}" [freeText.${i}]`,
      ms: `Kata-kata pesakit (auto-triage ${cls}): "${text}" [freeText.${i}]`, zh: `患者自述（自动分级 ${cls}）："${text}" [freeText.${i}]` }),
    gapNotAnswered: (l, label, id) => pick(l, { en: `Not answered: ${label} (${id})`, ms: `Belum dijawab: ${label} (${id})`, zh: `未回答：${label}（${id}）` }),
    // round 6 (review3 B7): an impossible value is an AMBER reason, never NONE. The English wording is fixed by the review.
    implausible: (l, what) => pick(l, { en: `implausible value: clinician to verify (${what})`, ms: `nilai tidak munasabah: klinik perlu sahkan (${what}) (draf mesin)`, zh: `数值不合理：需临床人员核实（${what}）（机器草稿）` }),
    gapUnclear: (l, label, id) => pick(l, { en: `Unclear answer: ${label} (${id})`, ms: `Jawapan tidak jelas: ${label} (${id})`, zh: `回答不清楚：${label}（${id}）` }),
    gapBtNoName: l => pick(l, { en: 'Blood thinner named? No name given (blood_thinner)', ms: 'Pencair darah dinamakan? Tiada nama diberi (blood_thinner)', zh: '抗凝血药的名称？未提供药名（blood_thinner）' }),
    gapBtCheck: l => pick(l, { en: 'Check: meds_text names an anticoagulant but blood_thinner is no (blood_thinner, meds_text)',
      ms: 'Semak: meds_text menyebut antikoagulan tetapi blood_thinner ialah tidak (blood_thinner, meds_text)', zh: '请核对：meds_text 提到抗凝药，但 blood_thinner 为“否”（blood_thinner, meds_text）' }),
    gapDmCheck: (l, v) => pick(l, { en: `Check: diabetes answered no but HbA1c ${v} (diabetes, hba1c)`, ms: `Semak: diabetes dijawab tidak tetapi HbA1c ${v} (diabetes, hba1c)`, zh: `请核对：diabetes 答“否”，但糖化血红蛋白为 ${v}（diabetes, hba1c）` }),
    gapPenCheck: l => pick(l, { en: 'Check: allergy_text mentions a penicillin-class drug but penicillin_allergy is no (penicillin_allergy, allergy_text)',
      ms: 'Semak: allergy_text menyebut ubat kelas penisilin tetapi penicillin_allergy ialah tidak (penicillin_allergy, allergy_text)', zh: '请核对：allergy_text 提到青霉素类药物，但 penicillin_allergy 为“否”（penicillin_allergy, allergy_text）' }),
    gapProc: l => pick(l, { en: 'Procedure not recognised or not given (procedure)', ms: 'Prosedur tidak dikenali atau tiada (procedure)', zh: '未识别或未提供手术类型（procedure）' }),
    incompleteBt: l => pick(l, { en: 'Blood thinner answer missing or unclear [blood_thinner]', ms: 'Jawapan pencair darah tiada atau tidak jelas [blood_thinner]', zh: '抗凝血药回答缺失或不清楚 [blood_thinner]' }),
    incompleteCount: (l, n) => pick(l, { en: `${n} answers missing or unclear`, ms: `${n} jawapan tiada atau tidak jelas`, zh: `${n} 项回答缺失或不清楚` }),
    todoAnticoagYes: l => pick(l, { en: 'Clinician decision: stop or continue blood thinner before surgery', ms: 'Keputusan doktor: hentikan atau teruskan pencair darah sebelum pembedahan', zh: '临床医生决定：手术前停用还是继续抗凝血药' }),
    todoAnticoagConflict: l => pick(l, { en: 'Clinician decision: confirm blood thinner status (medicine list and answer disagree)', ms: 'Keputusan doktor: sahkan status pencair darah (senarai ubat dan jawapan tidak sepadan)', zh: '临床医生决定：确认抗凝血药状态（用药清单与回答不一致）' }),
    todoHba1c: (l, thr) => pick(l, { en: `Optimise HbA1c before surgery (at or above ${thr}%)`, ms: `Optimumkan HbA1c sebelum pembedahan (pada atau melebihi ${thr}%)`, zh: `手术前优化糖化血红蛋白（达到或超过 ${thr}%）` }),
    todoAnaes: l => pick(l, { en: 'Anaesthetic review', ms: 'Semakan anestetik', zh: '麻醉评估' }),
    todoAntibiotic: l => pick(l, { en: 'Peri-operative antibiotic plan (penicillin allergy)', ms: 'Pelan antibiotik peri-pembedahan (alahan penisilin)', zh: '围手术期抗生素方案（青霉素过敏）' }),
    todoMrsa: l => pick(l, { en: 'MRSA screen before surgery', ms: 'Saringan MRSA sebelum pembedahan', zh: '手术前MRSA筛查' }),
    todoPhysio: l => pick(l, { en: 'Physio or social review of home, stairs and mobility', ms: 'Semakan fisioterapi atau sosial untuk rumah, tangga dan mobiliti', zh: '物理治疗或社工评估家居、楼梯和活动能力' }),
    todoPreauth: l => pick(l, { en: 'Insurance pre-authorisation obtained', ms: 'Kelulusan awal insurans diperoleh', zh: '已取得保险预先授权' }),
    todoRed: (l, flags) => pick(l, { en: 'Red flag at intake: ' + flags, ms: 'Tanda bahaya semasa pengambilan: ' + flags, zh: '入院问诊危险信号：' + flags }),
    allergyConflict: l => pick(l, { en: 'Allergy named in free text, but the allergy answer says no: clinician to verify', ms: 'Alahan dinamakan dalam teks bebas, tetapi jawapan alahan ialah tidak: doktor perlu sahkan', zh: '自由文本中提到过敏，但过敏回答为“否”：需临床医生核实' }),
    drugAllergy: (l, names) => pick(l, { en: `Drug allergy named in free text: ${names}`, ms: `Alahan ubat dinamakan dalam teks bebas: ${names}`, zh: `自由文本中提到药物过敏：${names}` }),
    dmConflict: (l, v) => pick(l, { en: `HbA1c ${v} recorded but diabetes answered no: clinician to verify`, ms: `HbA1c ${v} direkod tetapi diabetes dijawab tidak: doktor perlu sahkan`, zh: `记录了糖化血红蛋白 ${v}，但糖尿病回答为“否”：需临床医生核实` }),
    incompleteAllergy: l => pick(l, { en: 'Allergy question missing or unclear [penicillin_allergy]', ms: 'Soalan alahan tiada atau tidak jelas [penicillin_allergy]', zh: '过敏问题缺失或不清楚 [penicillin_allergy]' }),
    incompleteDiabetes: l => pick(l, { en: 'Diabetes question missing or unclear [diabetes]', ms: 'Soalan diabetes tiada atau tidak jelas [diabetes]', zh: '糖尿病问题缺失或不清楚 [diabetes]' }),
    routeLine: (l, qid, text) => pick(l, { en: `Patient's question during intake (clinician to answer): "${text}" [${qid}]`, ms: `Soalan pesakit semasa pengambilan (doktor perlu jawab): "${text}" [${qid}]`, zh: `患者在问诊中的问题（需临床医生回答）："${text}" [${qid}]` }),
    todoRoute: (l, text) => pick(l, { en: 'Patient question to answer: ' + text, ms: 'Soalan pesakit untuk dijawab: ' + text, zh: '需回答的患者问题：' + text }),
    todoWorsening: l => pick(l, { en: 'Clinician review: patient reports worsening symptoms', ms: 'Semakan doktor: pesakit melaporkan gejala semakin teruk', zh: '临床医生审阅：患者报告症状加重' })
  };

  /* ---------- value helpers (never guess: unclear values are shown as given and sent to gaps) ---------- */
  function unpack(input) {
    if (input && typeof input === 'object' && input.answers && typeof input.answers === 'object') {
      return { pid: input.pid || null, procedure: input.procedure || null, lang: LANG_OK(input.lang) ? input.lang : 'en',
        answers: input.answers, freeText: Array.isArray(input.freeText) ? input.freeText : [], routes: Array.isArray(input.routes) ? input.routes : [] };
    }
    return { pid: null, procedure: null, lang: 'en', answers: (input && typeof input === 'object') ? input : {}, freeText: [], routes: [] };
  }
  function LANG_OK(l) { return l === 'en' || l === 'ms' || l === 'zh'; }
  const isMissing = v => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
  const display = v => typeof v === 'boolean' ? (v ? 'yes' : 'no') : (v == null ? '' : String(v).trim());
  function yn(v) {
    if (typeof v === 'boolean') return v ? 'yes' : 'no';
    if (typeof v !== 'string') return null;
    const s = v.trim().toLowerCase();
    return (s === 'yes' || s === 'y') ? 'yes' : (s === 'no' || s === 'n') ? 'no' : null;
  }
  // blood thinner: 'yes' | 'no' | { answer: 'yes'|'no', name: '...' }
  function bt(v) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return { ans: yn(v.answer), raw: display(v.answer), name: display(v.name) };
    }
    return { ans: yn(v), raw: display(v), name: '' };
  }
  function num(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') return Number(v);
    return NaN;
  }
  function shown(id, v) {
    if (id === 'blood_thinner') {
      const b = bt(v);
      return { ok: b.ans !== null };
    }
    if (YN.has(id)) return { ok: yn(v) !== null };
    if (id === 'hba1c') return { ok: isFinite(num(v)) || display(v) === 'not applicable' };
    if (id === 'walk_distance_m') return { ok: isFinite(num(v)) || WALK_BANDS.indexOf(display(v)) >= 0 };
    if (id === 'payer') return { ok: PAYERS.includes(display(v).toLowerCase()) };
    return { ok: display(v) !== '' };
  }
  // The text shown for an answer. English shows the stored value as it is; ms and zh translate yes/no and the fixed values.
  function valueText(id, v, lang) {
    if (id === 'blood_thinner') {
      const b = bt(v);
      if (b.ans === null) return b.raw;
      const w = YNW[lang][b.ans];
      return (b.ans === 'yes' && b.name) ? w + ', ' + b.name : w;
    }
    const s = display(v);
    if (lang === 'en') return s;
    if (YN.has(id) && yn(v)) return YNW[lang][yn(v)];
    const low = s.toLowerCase();
    const f = FIELD_VAL[id];
    if (f && f[lang] && f[lang][low] !== undefined) return f[lang][low];
    if (low === 'unclear') return YNW[lang].unclear;
    if (low === 'unknown' && id === 'hba1c') return YNW[lang].unknown;
    return s;
  }
  // free text: engine classifier, never answered by the bot here
  function freeTextFlags(x) {
    return x.freeText.map((t, i) => {
      if (typeof t !== 'string' || !t.trim()) return null;
      const r = eng.classify(t, { procedure: x.procedure || undefined, mode: 'intake' });
      return { i, text: t.trim(), cls: r.cls, flags: r.flags || [], reply: r.reply || '', red: r.cls === 'EMERGENCY' || r.cls === 'SAME-DAY' };
    }).filter(Boolean);
  }
  // A patient's own words count as worsening only when a symptom word and a worsening word both appear,
  // and a medicine or travel question needs a strong worsening word as well ("can I increase my painkiller" does not count).
  function isWorsening(f) {
    if (f.red) return false;
    const t = f.text;
    if (!SYMPTOM_RE.test(t)) return false;
    if (STRONG_WORSE_RE.test(t)) return true;
    return WEAK_WORSE_RE.test(t) && !MED_OR_TRAVEL_RE.test(t);
  }

  /* ---------- round 4 (review2 B4): an allergy named in free text is recorded, never silently 'no' ---------- */
  function allergyNames(x) {
    const a = x.answers, texts = [];
    const said = display(a.allergy_text);
    if (said && !NONE_START_RE.test(said)) texts.push(said);
    [display(a.meds_text)].concat(x.freeText.filter(t => typeof t === 'string')).forEach(t => {
      if (/allerg|alahan|过敏/i.test(t) && !NEG_ALLERGY_RE.test(t)) texts.push(t);
    });
    const txt = texts.join(' | '), names = [];
    if (PENICILLIN_TEXT.test(txt)) names.push('penicillin');
    if (SULFA_RE.test(txt)) names.push('sulfa');
    if (IODINE_RE.test(txt)) names.push('iodine');
    if (LATEX_RE.test(txt)) names.push('latex');
    return names;
  }
  // Returns the answers with named allergies set to yes, plus conflict = true when a named allergy contradicts a no.
  function effectiveAllergy(x) {
    const orig = x.answers, a = Object.assign({}, orig), names = allergyNames(x);
    let conflict = false;
    if (names.indexOf('penicillin') >= 0) { if (yn(orig.penicillin_allergy) === 'no') conflict = true; a.penicillin_allergy = 'yes'; }
    if (names.indexOf('latex') >= 0) { if (yn(orig.latex_allergy) === 'no') conflict = true; a.latex_allergy = 'yes'; }
    if (names.length) {
      const said = display(orig.allergy_text);
      if (/^none known$/i.test(said) || isMissing(orig.allergy_text)) a.allergy_text = names.join(', ') + ' (named in free text)';
      if (/^none known$/i.test(said) || yn(orig.penicillin_allergy) === 'no' || yn(orig.latex_allergy) === 'no') conflict = true;
    }
    return { a, names, conflict };
  }

  /* ---------- red flags (review1 item 9): one function for the interview, the sample loader and the summary ---------- */
  function canonReply(level, lang, procedure) {
    const order = [CANON[level][lang], CANON[level].en];
    for (const phrase of order) {
      const r = eng.classify(phrase, { procedure, mode: 'intake' });
      if (r.cls === level && r.reply) return r.reply;
    }
    return '';
  }
  // Returns null when there is no red flag, else { level, flags, reply, refs, reasons }. Highest level wins the reply.
  function redOf(input) {
    const x = unpack(input), a = x.answers, lang = x.lang;
    const Y = id => yn(a[id]) === 'yes';
    const hits = [];
    LUMBAR_IDS.filter(Y).forEach(id => hits.push({ level: RED_QIDS[id], flags: [id], refs: [id],
      text: M.cauda(lang, labelOf(id, lang), id) }));
    Object.keys(RED_QIDS).filter(id => !LUMBAR_IDS.includes(id) && Y(id)).forEach(id => hits.push({ level: RED_QIDS[id], flags: [id], refs: [id],
      text: M.redOther(lang, (RED_LABEL[lang] || RED_LABEL.en)[id] || id, id) }));
    freeTextFlags(x).filter(f => f.red).forEach(f => hits.push({ level: f.cls, flags: f.flags.slice(), refs: [`freeText.${f.i}`],
      text: M.wordsTriaged(lang, f.cls, f.flags.join('; '), f.i), reply: f.reply }));
    if (!hits.length) return null;
    const top = hits.reduce((b, h) => ((RANK[h.level] || 0) > (RANK[b.level] || 0) ? h : b), hits[0]);
    const flags = [], refs = [];
    hits.forEach(h => { h.flags.forEach(f => { if (!flags.includes(f)) flags.push(f); }); h.refs.forEach(r => { if (!refs.includes(r)) refs.push(r); }); });
    return { level: top.level, flags, refs, reasons: hits.map(h => h.text), reply: top.reply || canonReply(top.level, lang, x.procedure) };
  }

  /* ---------- summary ---------- */
  // Interview mode: the answers came from the interview (toAnswers), so only the fields this procedure's interview asks
  // are gaps. Anything the interview answered without a summary line is listed under "Recorded, not summarised".
  // round 6 (review3 B7): values a person could not really have given. Doses are read from every typed text (medicine list,
  // blood-thinner detail, free text). Ranges: HbA1c 3-20 %, distances 0-100000 m, age 0-120, a dose must be above 0 and
  // at most 5000 mg, 10 g, 5000 mcg or 2000 ml.
  const DOSE_RE = /(-?\d+(?:\.\d+)?)\s*(mg|mcg|µg|ug|g|ml|iu|units?)\b/gi;
  const DOSE_MAX = { mg: 5000, mcg: 5000, µg: 5000, ug: 5000, g: 10, ml: 2000, iu: 100000, unit: 100000, units: 100000 };
  function implausibleValues(a, x) {
    const out = [];
    const n = num(a.hba1c);
    if (isFinite(n) && (n < 3 || n > 20)) out.push('HbA1c ' + display(a.hba1c) + ' outside 3-20');
    const d = num(a.walk_distance_m);
    if (isFinite(d) && (d < 0 || d > 100000)) out.push('walking distance ' + display(a.walk_distance_m) + ' m');
    ['age', 'age_years'].forEach(k => { const v = num(a[k]); if (isFinite(v) && (v <= 0 || v > 120)) out.push('age ' + display(a[k])); });
    const texts = Object.keys(a).filter(k => typeof a[k] === 'string').map(k => a[k]).concat(x.freeText.filter(t => typeof t === 'string'));
    texts.forEach(t => {
      let m; const re = new RegExp(DOSE_RE.source, 'gi');
      while ((m = re.exec(t))) {
        const v = parseFloat(m[1]), unit = m[2].toLowerCase();
        const max = DOSE_MAX[unit] || DOSE_MAX[unit.replace(/s$/, '')];
        if (v <= 0 || (max && v > max)) out.push('dose ' + m[0].trim());
      }
    });
    return out;
  }

  function summarise(input) {
    const x = unpack(input), eff = effectiveAllergy(x), a = eff.a, proc = x.procedure, lang = x.lang;
    const interviewMode = !!(input && typeof input === 'object' && input.interviewAnswers && input.questions);
    const fields = interviewMode ? new Set(IDMAP.fieldsFor(proc)) : null;
    const applies = id => !fields || fields.has(id);
    const pack = eng.PACKS[proc] || null;
    const ambers = [], gaps = [];
    const Y = id => yn(a[id]) === 'yes';
    const sections = SECTIONS.map(s => ({ title: s.title, lines: [] }));

    SECTIONS.forEach((s, si) => s.ids.forEach(id => {
      if (isMissing(a[id])) return;
      const r = shown(id, a[id]);
      const text = valueText(id, a[id], lang);
      if (text !== '') sections[si].lines.push(`${labelOf(id, lang)}: ${text} [${id}]`);
      if (!r.ok) gaps.push(M.gapUnclear(lang, labelOf(id, lang), id));
    }));

    if (!pack) gaps.push(M.gapProc(lang));
    ALL_IDS.forEach(id => {
      if (LUMBAR_IDS.includes(id) && proc !== 'LUMBAR') return;
      if (!applies(id)) return;
      if (isMissing(a[id])) gaps.push(M.gapNotAnswered(lang, labelOf(id, lang), id));
    });

    // RED: the same rule as the interview and the urgent task (redOf)
    const red = redOf(input);
    const reds = red ? red.reasons : [];
    freeTextFlags(x).forEach(f => {
      sections[WORDS_SECTION].lines.push(M.wordsLine(lang, f.cls, f.text, f.i));
    });
    x.routes.filter(clinicalRoute).forEach(r => sections[WORDS_SECTION].lines.push(M.routeLine(lang, r.qid, r.text)));

    // AMBER
    const b = bt(a.blood_thinner);
    if (b.ans === 'yes') ambers.push(M.btReported(lang, b.name) + ' [blood_thinner]');
    const n = num(a.hba1c);
    const thr = eng.THRESH.HbA1c.ge;
    if (isFinite(n) && n >= thr) ambers.push(M.hba1cHigh(lang, display(a.hba1c), thr) + ' [hba1c]');
    if (Y('penicillin_allergy')) ambers.push(M.penReported(lang) + ' [penicillin_allergy]');
    if (eff.conflict) ambers.push(M.allergyConflict(lang) + ' [allergy_text, penicillin_allergy]');
    const drugOther = eff.names.filter(nm => nm === 'sulfa' || nm === 'iodine');
    if (drugOther.length) ambers.push(M.drugAllergy(lang, drugOther.join(', ')) + ' [allergy_text]');
    ANAES_GROUP.filter(Y).forEach(id => ambers.push(`${M.anaesReported(lang, labelOf(id, lang))} [${id}]`));
    if (Y('lives_alone') && Y('stairs_home')) ambers.push(M.aloneStairs(lang) + ' [lives_alone, stairs_home]');
    // review1 item 10: worsening symptoms in the patient's own words. Never NONE.
    if (freeTextFlags(x).some(isWorsening)) ambers.push(M.worsening(lang));
    implausibleValues(a, x).forEach(w => ambers.push(M.implausible(lang, w)));

    // review1 B2: a blood thinner named in the medicine list or free text must agree with the yes/no answer
    const btNamed = ANTICOAG_NAME.test(display(a.meds_text)) || x.freeText.some(t => typeof t === 'string' && ANTICOAG_NAME.test(t));
    const btConflict = btNamed && b.ans !== 'yes';
    const btUnresolved = b.ans === null;
    if (btConflict) ambers.push(M.btConflict(lang) + ' [blood_thinner, meds_text]');

    // gaps: contradictions and clarifications
    if (b.ans === 'yes' && !b.name) gaps.push(M.gapBtNoName(lang));
    if (b.ans === 'no' && ANTICOAG_NAME.test(display(a.meds_text))) gaps.push(M.gapBtCheck(lang));
    if (yn(a.diabetes) === 'no' && isFinite(n) && n >= 6.5) { gaps.push(M.gapDmCheck(lang, display(a.hba1c))); ambers.push(M.dmConflict(lang, display(a.hba1c)) + ' [diabetes, hba1c]'); }
    if (yn(a.penicillin_allergy) === 'no' && PENICILLIN_TEXT.test(display(a.allergy_text))) gaps.push(M.gapPenCheck(lang));

    // NONE is only possible when every answer is in and no blood-thinner question is open. More than 6 gaps is INCOMPLETE, never NONE.
    const allergyUnresolved = yn(x.answers.penicillin_allergy) === null && eff.names.length === 0;
    const diabetesUnresolved = yn(a.diabetes) === null;
    // round 6 (review3 M6): any open gap means INCOMPLETE at least, never NONE
    const level = red ? 'RED' : ambers.length ? 'AMBER' : (btUnresolved || allergyUnresolved || diabetesUnresolved || gaps.length > 0) ? 'INCOMPLETE' : 'NONE';
    let reasons = [];
    if (level === 'RED') reasons = reds.concat(ambers);
    else if (level === 'AMBER') reasons = ambers;
    else if (level === 'INCOMPLETE') {
      if (btUnresolved) reasons.push(M.incompleteBt(lang));
      if (allergyUnresolved) reasons.push(M.incompleteAllergy(lang));
      if (diabetesUnresolved) reasons.push(M.incompleteDiabetes(lang));
      reasons.push(M.incompleteCount(lang, gaps.length));
    }

    if (interviewMode) {
      // Every interview answer must appear: as a [field] on a line or banner reason, or here, with its question text.
      const rendered = new Set();
      const scan = t => { (String(t).match(/\[([^\]]+)\]/g) || []).forEach(m => m.slice(1, -1).split(/,\s*/).forEach(id => rendered.add(id.trim()))); };
      sections.forEach(sec => sec.lines.forEach(scan));
      reasons.forEach(scan);
      const recorded = [];
      Object.keys(input.questions).forEach(qid => {
        const row = IDMAP.ROW[qid];
        const targets = IDMAP.targetsOf(qid);
        const accounted = targets.length > 0 && targets.some(t => (t === 'freeText'
          ? Array.from(rendered).some(r => r.indexOf('freeText.') === 0) : rendered.has(t)));
        if (!accounted || (row && row.alsoRecorded)) {
          const q = input.questions[qid];
          recorded.push(`${q.text}: ${q.shown} [${qid}]`);
        }
      });
      sections.push({ title: REC_TITLE, lines: recorded });
    }
    return { pid: x.pid, procedure: proc, banner: { level, reasons }, sections, label: LABEL, gaps };
  }

  /* ---------- to-dos (owners: surgeon, anaesthetist, preop_nurse, ward_nurse, physio, pharmacy, clinic_coordinator, clinician) ---------- */
  function todos(input) {
    const x = unpack(input), a = effectiveAllergy(x).a, out = [], lang = x.lang;
    const Y = id => yn(a[id]) === 'yes';
    const n = num(a.hba1c);
    const list = (ids) => ids.filter(Y).join(', ');
    const b = bt(a.blood_thinner);
    const thr = eng.THRESH.HbA1c.ge;

    const btNamed = ANTICOAG_NAME.test(display(a.meds_text)) || x.freeText.some(t => typeof t === 'string' && ANTICOAG_NAME.test(t));
    if (b.ans === 'yes') out.push({ key: 'anticoag_decision', title: M.todoAnticoagYes(lang), owner: 'surgeon', dueDays: -14, kind: 'review', reason: 'blood_thinner', needsClinician: true });
    else if (btNamed) out.push({ key: 'anticoag_decision', title: M.todoAnticoagConflict(lang), owner: 'surgeon', dueDays: -14, kind: 'review', reason: 'blood_thinner, meds_text', needsClinician: true });
    if (isFinite(n) && n >= thr) out.push({ key: 'optimise_hba1c', title: M.todoHba1c(lang, thr), owner: 'clinician', dueDays: -14, kind: 'review', reason: 'hba1c', needsClinician: true });
    const an = list(ANAES_GROUP);
    if (an) out.push({ key: 'anaesthetic_review', title: M.todoAnaes(lang), owner: 'anaesthetist', dueDays: -10, kind: 'appt', reason: an, needsClinician: true });
    if (Y('penicillin_allergy')) out.push({ key: 'antibiotic_plan', title: M.todoAntibiotic(lang), owner: 'anaesthetist', dueDays: -10, kind: 'med', reason: 'penicillin_allergy', needsClinician: true });
    if (Y('mrsa_or_admission_past_year')) out.push({ key: 'mrsa_screen', title: M.todoMrsa(lang), owner: 'preop_nurse', dueDays: -10, kind: 'screen', reason: 'mrsa_or_admission_past_year', needsClinician: false });
    const social = list(['lives_alone', 'stairs_home', 'mobility_aid']);
    if (social) out.push({ key: 'physio_social_review', title: M.todoPhysio(lang), owner: 'physio', dueDays: -7, kind: 'physio', reason: social, needsClinician: false });
    if (display(a.payer).toLowerCase() === 'insurance') out.push({ key: 'preauth', title: M.todoPreauth(lang), owner: 'clinic_coordinator', dueDays: -10, kind: 'admin', reason: 'payer', needsClinician: false });
    // review1 item 9: one urgent red-flag task per patient, whichever path raised it
    const red = redOf(input);
    if (red) out.push(redTodo(red, lang));
    // review1 item 10: patient's own words that need a clinician, due within 48 h
    const worse = freeTextFlags(x).filter(isWorsening);
    if (worse.length) out.push({ key: 'clinician_review_worsening', title: M.todoWorsening(lang), owner: 'clinician', dueDays: 0, dueHours: 48, kind: 'review', reason: worse.map(f => `freeText.${f.i}`).join(', '), needsClinician: true });
    x.routes.filter(clinicalRoute).forEach(r => {
      const text = String(r.text || '').trim();
      out.push({ key: 'intake_q_' + hash(text.toLowerCase().replace(/\s+/g, ' ')), title: M.todoRoute(lang, text.length > 60 ? text.slice(0, 57) + '...' : text), owner: 'clinician', dueDays: 0, dueHours: 24, kind: 'call', reason: r.qid, needsClinician: true });
    });
    return out;
  }

  /* ---------- engine integration ---------- */
  function toTasks(sim, pid, list) {
    const p = sim.P ? sim.P(pid) : null;
    const base = p ? p.surgeryAt : sim.now;
    const made = [];
    (list || []).forEach(t => {
      if (sim.tasks.some(x => x.pid === pid && x.type === t.key)) return; // idempotent
      let dueAt;
      if (t.urgent) dueAt = sim.now;
      else if (typeof t.dueHours === 'number') dueAt = sim.now + t.dueHours;
      else dueAt = base + t.dueDays * D;
      // otOffsetDays: the to-do's offset from the OT date (negative = before surgery). Only these move when the OT date moves.
      const otOffsetDays = (typeof t.dueDays === 'number' && typeof t.dueHours !== 'number' && !t.urgent) ? t.dueDays : null;
      made.push(sim.addTask(pid, { type: t.key, title: t.title, owner: t.owner, kind: t.kind, dueAt, reason: t.reason, needsClinician: t.needsClinician, evidence: [], otOffsetDays }));
    });
    if (made.length) OT.syncOT(sim, pid);
    return made;
  }

  /* ---------- review1 B3/B4: urgent red-flag task and patient-question task ---------- */
  // The urgent task for a red flag. One key per patient (review1 item 9), so repeated presses or two paths never duplicate it.
  function redTodo(red, lang) {
    const flags = (red.flags || []).join('; ');
    return { key: 'intake_red_flag', title: M.todoRed(lang || 'en', flags), owner: 'clinician', dueDays: 0, kind: 'review',
      reason: (red.refs && red.refs.length ? red.refs : red.flags || []).join(', '), needsClinician: true, urgent: true };
  }
  function clinicalRoute(r) { return !!(r && (r.flags || []).some(f => /clinical judgement|worsening/.test(f))); }
  function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  // A question the bot could not answer from approved sources. One task per patient per identical question.
  // Owner: clinician when urgent or clinical (blood thinner, antibiotics, flights), else preop_nurse. Due in 24 h, or now when urgent.
  function questionTask(sim, pid, text, urgent, clinical) {
    const t = String(text == null ? '' : text).trim();
    const type = 'patient_q_' + hash(t.toLowerCase().replace(/\s+/g, ' '));
    const dup = sim.tasks.find(x => x.pid === pid && x.type === type);
    if (dup) return { status: 'duplicate', task: dup };
    const task = sim.addTask(pid, { type, title: 'Patient question: ' + (t.length > 60 ? t.slice(0, 57) + '...' : t),
      owner: (urgent || clinical) ? 'clinician' : 'preop_nurse', kind: 'call', dueAt: urgent ? sim.now : sim.now + D, reason: 'ask box', needsClinician: true, evidence: [] });
    return { status: 'created', task };
  }

  /* ---------- OT (operating theatre) date ----------
     Calendar dates are plain 'YYYY-MM-DD' strings. Arithmetic runs on those fields through Date.UTC, so the local
     timezone cannot shift a date. Demo day 0 is sim.plAnchor (local today, set when the page loads or is reset).
     Sim time t (hours) falls on calendar day anchor + floor(t / 24). Engine offsets (SHARED, pack extras, intake dueDays)
     are applied here in the page layer; engine.js is not changed. */
  const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const WD_MS = ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'];
  const WD_ZH = ['日', '一', '二', '三', '四', '五', '六'];
  const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MON_MS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
  // Items whose absence close to surgery blocks the operation. Keys are intake to-do keys or engine checklist keys.
  const CRITICAL_KEYS = ['anaesthetic_review', 'anticoag_decision', 'bloods', 'ecg', 'preauth'];
  const pad2 = n => (n < 10 ? '0' : '') + n;
  function ymdOfLocal(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function parseYmd(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s == null ? '' : s)); if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const t = new Date(Date.UTC(y, mo - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
    return { y, m: mo, d };
  }
  function dayNum(ymd) { const p = parseYmd(ymd); return p ? Math.round(Date.UTC(p.y, p.m - 1, p.d) / 86400000) : NaN; }
  function ymdFromDayNum(z) { const t = new Date(z * 86400000); return t.getUTCFullYear() + '-' + pad2(t.getUTCMonth() + 1) + '-' + pad2(t.getUTCDate()); }
  function addDays(ymd, n) { return ymdFromDayNum(dayNum(ymd) + n); }
  function anchorOf(sim) { return (sim && sim.plAnchor) || ymdOfLocal(new Date()); }
  function demoDay(sim) { return addDays(anchorOf(sim), Math.floor(sim.now / D)); }
  function calOf(sim, t) { return addDays(anchorOf(sim), Math.floor(t / D)); }
  // Whole days from the demo clock's current day to a calendar date (0 = today).
  function daysFromNow(sim, ymd) { const n = dayNum(ymd); return isNaN(n) ? NaN : n - dayNum(demoDay(sim)); }
  function daysToOT(sim, pid) { const p = sim.P(pid); return p ? dayNum(calOf(sim, p.surgeryAt)) - dayNum(demoDay(sim)) : NaN; }
  function otDate(sim, pid) { const p = sim.P(pid); return p ? calOf(sim, p.surgeryAt) : null; }
  function fmtCal(ymd, lang) {
    const p = parseYmd(ymd); if (!p) return '';
    const wd = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
    if (lang === 'zh') return p.m + '月' + p.d + '日 周' + WD_ZH[wd];
    if (lang === 'ms') return WD_MS[wd] + ' ' + p.d + ' ' + MON_MS[p.m - 1];
    return WD_EN[wd] + ' ' + p.d + ' ' + MON_EN[p.m - 1];
  }
  function relOT(n, lang) {
    if (n < 0) return pick(lang, { en: (-n) + ' day' + (n === -1 ? '' : 's') + ' before OT', ms: (-n) + ' hari sebelum OT (draf mesin)', zh: '手术前 ' + (-n) + ' 天（机器草稿）' });
    if (n === 0) return pick(lang, { en: 'OT day', ms: 'hari OT (draf mesin)', zh: '手术当天（机器草稿）' });
    return pick(lang, { en: n + ' day' + (n === 1 ? '' : 's') + ' after OT', ms: n + ' hari selepas OT (draf mesin)', zh: '手术后 ' + n + ' 天（机器草稿）' });
  }
  // 'today', 'in 1 day', 'in 14 days', '2 days ago'
  function whenText(k, lang) {
    if (isNaN(k)) return '';
    if (k === 0) return pick(lang, { en: 'today', ms: 'hari ini (draf mesin)', zh: '今天' });
    if (k < 0) return pick(lang, { en: (-k) + ' day' + (k === -1 ? '' : 's') + ' ago', ms: (-k) + ' hari lalu (draf mesin)', zh: '已过 ' + (-k) + ' 天' });
    return pick(lang, { en: 'in ' + k + ' day' + (k === 1 ? '' : 's'), ms: 'dalam ' + k + ' hari (draf mesin)', zh: '还有 ' + k + ' 天' });
  }
  // Text for a to-do or task due date, e.g. 'Fri 13 Nov, 5 days before OT'.
  function dueLabel(sim, t, lang) {
    const p = sim.P(t.pid); if (!p || typeof t.dueAt !== 'number') return '';
    const n = dayNum(calOf(sim, t.dueAt)) - dayNum(calOf(sim, p.surgeryAt));
    return fmtCal(calOf(sim, t.dueAt), lang) + ', ' + relOT(n, lang);
  }
  function openCritical(sim, pid) {
    return sim.tasks.filter(t => t.pid === pid && CRITICAL_KEYS.includes(t.type) && t.state !== 'closed' && t.state !== 'confirmed');
  }
  // Status for a chosen OT date. pid may be null when no Sim patient exists yet (then no critical items can be open).
  function otStatus(sim, pid, ymd, lang) {
    const k = daysFromNow(sim, ymd);
    const crit = pid ? openCritical(sim, pid) : [];
    const out = { days: k, date: ymd, when: whenText(k, lang), weekday: fmtCal(ymd, lang), blocked: false, blockMsg: null, warn: null, banner: null, critical: crit.map(t => t.title) };
    if (isNaN(k)) { out.blocked = true; out.blockMsg = pick(lang, { en: 'Choose a valid date.', ms: 'Pilih tarikh yang sah. (draf mesin)', zh: '请选择有效日期。（机器草稿）' }); return out; }
    if (k < 0) { out.blocked = true; out.blockMsg = pick(lang, { en: 'Blocked: that date has already passed. Choose today or a later date.', ms: 'Disekat: tarikh itu sudah berlalu. Pilih hari ini atau tarikh kemudian. (draf mesin)', zh: '已阻止：该日期已过。请选择今天或之后的日期。（机器草稿）' }); return out; }
    if (k < 2) out.warn = pick(lang, { en: 'Warning: too late for routine pre-op work-up; clinician to decide.', ms: 'Amaran: terlalu lewat untuk kerja pra-operasi rutin; doktor perlu putuskan. (draf mesin)', zh: '警告：距离手术太近，不适合常规术前检查；由临床医生决定。（机器草稿）' });
    if (k <= 7 && crit.length) { const n = crit.length; out.banner = pick(lang, { en: 'Surgery at risk: ' + n + ' critical item' + (n === 1 ? '' : 's') + ' open', ms: 'Pembedahan berisiko: ' + n + ' item kritikal belum selesai (draf mesin)', zh: '手术有风险：' + n + ' 项关键事项未完成（机器草稿）' }); }
    return out;
  }
  // Recomputes the OT-linked tasks of one patient from the current surgeryAt. Closed or confirmed tasks are left alone.
  // Overdue and at-risk follow the engine's rules: at risk once the engine's atRiskAt has passed, and overdue
  // tasks are at risk. Critical items within 7 days of OT are at risk too. A later date relaxes all of this.
  function syncOT(sim, pid) {
    const p = sim.P(pid); if (!p) return;
    const k = daysToOT(sim, pid), within = k >= 0 && k <= 7;
    const pack = eng.PACKS[p.procedure];
    const dueOf = {}; eng.SHARED.concat(pack ? pack.extra : []).forEach(it => { dueOf[it.key] = it.due; });
    const lead = sim.cfg.atRiskBeforeSurgeryHrs;
    sim.tasks.forEach(t => {
      if (t.pid !== pid || t.state === 'closed' || t.state === 'confirmed') return;
      let off = null;
      if (t.auto && dueOf[t.type] !== undefined) off = dueOf[t.type];
      else if (typeof t.otOffsetDays === 'number') off = t.otOffsetDays;
      if (off === null) return;
      t.dueAt = p.surgeryAt + off * D;
      t.atRiskAt = p.surgeryAt - lead;
      if (t.state === 'open' || t.state === 'overdue') {
        const was = t.state;
        t.state = sim.now >= t.dueAt ? 'overdue' : 'open';
        if (was === 'open' && t.state === 'overdue') sim.note('overdue', pid, t.title);
      }
      const wasRisk = !!t.atRisk;
      const live = t.state === 'open' || t.state === 'overdue';
      t.atRisk = live && (t.state === 'overdue' || sim.now >= t.atRiskAt || (within && CRITICAL_KEYS.includes(t.type)));
      if (t.atRisk && !wasRisk) sim.note('at_risk', pid, t.title);
    });
    p.atRisk = sim.tasks.some(x => x.pid === pid && x.state !== 'closed' && x.state !== 'confirmed' && (x.atRisk || x.state === 'hold'))
      || sim.alerts.some(a => a.pid === pid && a.state === 'open' && (a.cls === 'EMERGENCY' || a.cls === 'SAME-DAY'));
  }
  // Moves the operation to a calendar date. Returns { ok, reason } and changes nothing when refused.
  function setOT(sim, pid, ymd) {
    const p = sim.P(pid);
    if (!p) return { ok: false, reason: 'no-patient' };
    const k = daysFromNow(sim, ymd);
    if (isNaN(k)) return { ok: false, reason: 'invalid' };
    if (k < 0) return { ok: false, reason: 'past' };
    p.surgeryAt = sim.now + k * D;
    syncOT(sim, pid);
    return { ok: true, days: k, date: ymd };
  }

  const OT = { ymdOfLocal, parseYmd, dayNum, addDays, demoDay, calOf, daysFromNow, daysToOT, otDate, fmtCal, relOT, whenText, dueLabel,
    openCritical, otStatus, syncOT, setOT, CRITICAL_KEYS };

  const api = { summarise, todos, toTasks, Q, QL, labelOf, redOf, redTodo, questionTask, isWorsening: f => isWorsening(f), WORSENING_TEXT, RED_QIDS, REC_TITLE, valueText, OT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PL_INTAKE = api;
})(this);
