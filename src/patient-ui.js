/*
 * OsteoLoop patient page logic (patient.html). Separate from the clinician app.
 *
 * Pure functions (exported to Node for bench/run-patient.js and to window.OsteoPatientUI):
 *   parseHash, readVisit, visitSet, stepIds, validateStep, statusNotes, unknownList,
 *   buildRecord, pushOutbox, textLen.
 * The DOM layer (boot) runs only when patient.html is loaded in a browser.
 *
 * Patient text is written with textContent or createTextNode only. Nothing from the patient is
 * parsed as markup. Questions, flags and the outbox record come from src/checkin.js.
 *
 * Contract with the clinician app (see docs/patient-page.md):
 *   localStorage 'osteoloop.outbox'  array of records, newest last, capped at 50
 *   localStorage 'osteoloop.visits'  optional JSON map visit code -> {caseId, rx, rxName}
 * Drafts live in sessionStorage 'osteoloop.draft:<code>|<set>' (this browser tab only).
 *
 * TRANSLATION STATUS: English is the reference. Arabic and Malay are drafts and NEED NATIVE
 * CLINICAL REVIEW before any patient sees them. Every new string is listed in docs/patient-page.md.
 */
(function (root) {
  'use strict';
  const CI = (typeof module !== 'undefined' && module.exports) ? require('./checkin.js') : root.OsteoCheckin;

  const LANGS = ['en', 'ar', 'ms'];
  const OUTBOX_KEY = 'osteoloop.outbox';
  const OUTBOX_CAP = 50;
  const VISITS_KEY = 'osteoloop.visits';
  const DRAFT_PREFIX = 'osteoloop.draft:';
  const WARN_AT = 800;
  // TODO(sign-off): the site profile field "emergency contact" is not wired yet. Placeholder only;
  // the hospital must supply the real clinic phone and emergency number. Never invent one.
  const SITE_EMERGENCY = '[clinic phone / emergency number: set by the hospital]';
  const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
  const WHO_VALUES = ['me', 'family', 'interpreter'];
  const OK = { ok: true };

  /* ---------- UI strings. DRAFT translations: see docs/patient-page.md for the sign-off list ---------- */
  const T = {
    en: {
      title: 'Clinic check-in', invalid: 'This link is not valid. Please open the link your clinic gave you, or ask the front desk for a new one.',
      consentTitle: 'Before you start', draft: "DRAFT: wording pending approval by the clinical lead and the hospital's data-protection officer",
      cWhoH: 'Who sees my answers?', cWhoB: 'The care team at this clinic: the doctors and nurses who look after you.',
      cAiH: 'Is AI used?', cAiB: 'Your answers are shown to the clinician as you typed them. No AI reads your answers on this page. If this changes, this notice will change first.',
      cSkipH: 'Can I skip a question?', cSkipB: 'Most questions can be skipped. You cannot skip the questions about fractures and warning symptoms. If none of them apply, choose None of these or Not sure.',
      cAskH: 'How do I ask a person?', cAskB: 'Ask at the front desk, or tell your nurse. They can answer questions about your answers.',
      start: 'Start', deleted: 'Your answers have been deleted.',
      who: 'Who is filling this in?', whoOpts: ['Me', 'A family member or carer', 'With an interpreter'],
      next: 'Next', back: 'Back', skip: 'Skip', cancel: 'Cancel', change: 'Change', send: 'Send my answers', keep: 'Keep answering',
      progress: 'Question {n} of {m}', optional: 'Optional', selected: 'Selected', selectedN: 'Selected: {n}',
      reviewT: 'Check your answers', reviewB: 'You can change any answer before you send.', skipped: 'Skipped',
      notSureH: 'Please ask the doctor about these', notSureB: 'You chose Not sure for these. Your doctor will check them with you at your visit.',
      cNote: 'If you describe a serious symptom here, please also tick it in the list of warning symptoms.',
      reasonWho: 'Choose who is filling this in.', reasonPick: 'Choose one answer to continue, or Skip if you can.',
      reasonMulti: 'Choose at least one answer, or None of these.', reasonScale: 'Choose a number from 0 to 10.',
      reasonText: 'Type your answer, or tick None, to continue.',
      reasonLong: 'Your answer is {n} characters. The limit is 1,000. Please shorten it. Nothing has been cut off.',
      left: '{n} characters left', sendBlocked: 'Some answers need fixing before you can send. See the questions marked above.',
      cancelH: 'Stop and leave?', cancelB: 'Do you want to keep your answers in this browser tab, or delete them?',
      leaveKeep: 'Leave and keep my answers', leaveDel: 'Delete my answers',
      pausedH: 'Your answers are kept', pausedB: 'They stay in this browser tab until you close it.',
      urgentH: 'Please tell a nurse or the front desk now.',
      urgentB: 'If you cannot reach anyone, or you cannot pass urine, lose control of your bowel, or have numbness around your groin or buttocks, go to the nearest emergency department.',
      phoneL: 'Clinic phone or emergency number', urgentCont: 'I have told staff / continue',
      doneH: 'Thank you. Your answers are sent.', doneB: 'The care team at this clinic will see them before your visit.',
      doneUrgent: 'Your answers are sent. The urgent message above still applies.',
      stopMeds: 'Please tell your nurse or doctor before you change your tablets. Do not stop on your own.',
      meds: 'We will review your medicines at your visit.', medNamed: 'In the last month, how have you taken your {drug}?',
      answerNone: 'None', required: 'Required', yes: 'Yes', no: 'No',
      whoLbl: 'Answered by'
    },
    ar: {
      title: 'تسجيل الحضور للعيادة', invalid: 'هذا الرابط غير صالح. يرجى فتح الرابط الذي أعطتكم إياه العيادة، أو اسألوا مكتب الاستقبال عن رابط جديد.',
      consentTitle: 'قبل أن تبدأوا', draft: 'مسودة: الصياغة بانتظار موافقة الطبيب المسؤول سريريًا ومسؤول حماية البيانات في المستشفى',
      cWhoH: 'من يطّلع على إجاباتكم؟', cWhoB: 'فريق الرعاية في هذه العيادة: الأطباء والممرضون الذين يعتنون بكم.',
      cAiH: 'هل يُستخدم الذكاء الاصطناعي؟', cAiB: 'تُعرض إجاباتكم على الطبيب كما كتبتموها. لا يقرأ أي ذكاء اصطناعي إجاباتكم في هذه الصفحة. إذا تغيّر ذلك، سيتغيّر هذا الإشعار أولًا.',
      cSkipH: 'هل يمكنني تخطّي سؤال؟', cSkipB: 'يمكن تخطّي معظم الأسئلة. لا يمكن تخطّي الأسئلة عن الكسور وأعراض الخطر. إذا لم ينطبق أي منها، اختاروا "لا شيء من ذلك" أو "غير واضح".',
      cAskH: 'كيف أسأل شخصًا؟', cAskB: 'اسألوا في مكتب الاستقبال، أو أخبروا الممرض. يمكنهم الإجابة عن أسئلتكم حول إجاباتكم.',
      start: 'ابدأوا', deleted: 'تم حذف إجاباتكم.',
      who: 'من يملأ هذا النموذج؟', whoOpts: ['أنا', 'أحد أفراد الأسرة أو مقدم الرعاية', 'بمساعدة مترجم'],
      next: 'التالي', back: 'رجوع', skip: 'تخطّي', cancel: 'إلغاء', change: 'تغيير', send: 'أرسلوا إجاباتي', keep: 'متابعة الإجابة',
      progress: 'السؤال {n} من {m}', optional: 'اختياري', selected: 'مختار', selectedN: 'المختار: {n}',
      reviewT: 'راجعوا إجاباتكم', reviewB: 'يمكنكم تغيير أي إجابة قبل الإرسال.', skipped: 'تم التخطي',
      notSureH: 'اسألوا الطبيب عن هذه النقاط', notSureB: 'اخترتم "غير واضح" لهذه الأسئلة. سيراجعها الطبيب معكم في الزيارة.',
      cNote: 'إذا وصفتم هنا عرضًا خطيرًا، فيرجى أيضًا تحديده في قائمة الأعراض التحذيرية.',
      reasonWho: 'اختاروا من يملأ هذا النموذج.', reasonPick: 'اختاروا إجابة للمتابعة، أو تخطّوا السؤال إن أمكن.',
      reasonMulti: 'اختاروا إجابة واحدة على الأقل، أو "لا شيء من ذلك".', reasonScale: 'اختاروا رقمًا من 0 إلى 10.',
      reasonText: 'اكتبوا إجابتكم، أو اختاروا "لا شيء"، للمتابعة.',
      reasonLong: 'إجابتكم {n} حرفًا. الحد الأقصى 1,000 حرف. يرجى اختصارها. لم يُحذف أي جزء منها.',
      left: 'متبقٍ {n} حرف', sendBlocked: 'بعض الإجابات تحتاج إلى تصحيح قبل الإرسال. انظروا إلى الأسئلة المعلَّمة أعلاه.',
      cancelH: 'التوقف والخروج؟', cancelB: 'هل تودّون حفظ إجاباتكم في تبويب المتصفح هذا، أم حذفها؟',
      leaveKeep: 'الخروج مع حفظ إجاباتي', leaveDel: 'حذف إجاباتي',
      pausedH: 'تم حفظ إجاباتكم', pausedB: 'تبقى إجاباتكم في تبويب المتصفح هذا حتى تغلقوه.',
      urgentH: 'أخبروا الممرض أو مكتب الاستقبال الآن.',
      urgentB: 'إذا لم تتمكنوا من الوصول إلى أحد، أو إذا لم تستطيعوا التبول، أو فقدتم التحكم في الأمعاء، أو شعرتم بخدر حول الفخذين أو الأرداف، فتوجهوا إلى أقرب قسم طوارئ.',
      phoneL: 'هاتف العيادة أو رقم الطوارئ', urgentCont: 'لقد أخبرتُ الفريق / متابعة',
      doneH: 'شكرًا لكم. تم إرسال إجاباتكم.', doneB: 'سيطّلع فريق الرعاية في هذه العيادة عليها قبل زيارتكم.',
      doneUrgent: 'تم إرسال إجاباتكم. الرسالة العاجلة أعلاه ما زالت سارية.',
      stopMeds: 'أخبروا الممرض أو الطبيب قبل أن تغيّروا أدويتكم. لا تتوقفوا عنها من تلقاء أنفسكم.',
      meds: 'سنراجع أدويتكم معكم في زيارتكم.', medNamed: 'خلال الشهر الماضي، كيف تناولتم {drug}؟',
      answerNone: 'لا شيء', required: 'مطلوب', yes: 'نعم', no: 'لا',
      whoLbl: 'أجاب عنها'
    },
    ms: {
      title: 'Daftar masuk klinik', invalid: 'Pautan ini tidak sah. Sila buka pautan yang diberikan oleh klinik anda, atau minta pautan baharu di kaunter.',
      consentTitle: 'Sebelum anda mula', draft: 'DRAF: perkataan menunggu kelulusan ketua klinikal dan pegawai perlindungan data hospital',
      cWhoH: 'Siapa yang melihat jawapan saya?', cWhoB: 'Pasukan penjagaan di klinik ini: doktor dan jururawat yang menjaga anda.',
      cAiH: 'Adakah AI digunakan?', cAiB: 'Jawapan anda ditunjukkan kepada doktor seperti yang anda taip. Tiada AI membaca jawapan anda di halaman ini. Jika ini berubah, notis ini akan ditukar dahulu.',
      cSkipH: 'Bolehkah saya langkau soalan?', cSkipB: 'Kebanyakan soalan boleh dilangkau. Soalan tentang patah tulang dan gejala amaran tidak boleh dilangkau. Jika tiada yang berkenaan, pilih Tiada daripada ini atau Tidak pasti.',
      cAskH: 'Bagaimana saya bertanya kepada seseorang?', cAskB: 'Tanya di kaunter, atau beritahu jururawat anda. Mereka boleh menjawab soalan tentang jawapan anda.',
      start: 'Mula', deleted: 'Jawapan anda telah dipadam.',
      who: 'Siapa yang mengisi borang ini?', whoOpts: ['Saya sendiri', 'Ahli keluarga atau penjaga', 'Dengan jurubahasa'],
      next: 'Seterusnya', back: 'Kembali', skip: 'Langkau', cancel: 'Batal', change: 'Tukar', send: 'Hantar jawapan saya', keep: 'Teruskan menjawab',
      progress: 'Soalan {n} daripada {m}', optional: 'Tidak wajib', selected: 'Dipilih', selectedN: 'Dipilih: {n}',
      reviewT: 'Semak jawapan anda', reviewB: 'Anda boleh menukar mana-mana jawapan sebelum menghantar.', skipped: 'Dilangkau',
      notSureH: 'Sila tanya doktor tentang perkara ini', notSureB: 'Anda memilih Tidak pasti untuk perkara ini. Doktor akan menyemaknya dengan anda semasa lawatan.',
      cNote: 'Jika anda menerangkan gejala serius di sini, sila tandakan juga dalam senarai gejala amaran.',
      reasonWho: 'Pilih siapa yang mengisi borang ini.', reasonPick: 'Pilih satu jawapan untuk teruskan, atau langkau jika boleh.',
      reasonMulti: 'Pilih sekurang-kurangnya satu jawapan, atau Tiada daripada ini.', reasonScale: 'Pilih nombor dari 0 hingga 10.',
      reasonText: 'Taip jawapan anda, atau tandakan Tiada, untuk teruskan.',
      reasonLong: 'Jawapan anda ialah {n} aksara. Had ialah 1,000 aksara. Sila pendekkannya. Tiada apa-apa yang dipotong.',
      left: 'Baki {n} aksara', sendBlocked: 'Sebahagian jawapan perlu dibetulkan sebelum anda boleh menghantar. Lihat soalan yang ditanda di atas.',
      cancelH: 'Berhenti dan keluar?', cancelB: 'Adakah anda mahu simpan jawapan dalam tab penyemak imbas ini, atau padamkannya?',
      leaveKeep: 'Keluar dan simpan jawapan saya', leaveDel: 'Padam jawapan saya',
      pausedH: 'Jawapan anda disimpan', pausedB: 'Jawapan anda kekal dalam tab penyemak imbas ini sehingga anda menutupnya.',
      urgentH: 'Beritahu jururawat atau kaunter sekarang.',
      urgentB: 'Jika anda tidak dapat menghubungi sesiapa, atau tidak dapat membuang air kecil, hilang kawalan usus, atau mengalami kebas di sekitar pangkal paha atau punggung, pergi ke jabatan kecemasan terdekat.',
      phoneL: 'Telefon klinik atau nombor kecemasan', urgentCont: 'Saya sudah beritahu kakitangan / teruskan',
      doneH: 'Terima kasih. Jawapan anda telah dihantar.', doneB: 'Pasukan penjagaan klinik ini akan melihatnya sebelum lawatan anda.',
      doneUrgent: 'Jawapan anda telah dihantar. Mesej segera di atas masih terpakai.',
      stopMeds: 'Beritahu jururawat atau doktor sebelum anda menukar ubat. Jangan berhenti sendiri.',
      meds: 'Kami akan menyemak ubat anda semasa lawatan.', medNamed: 'Dalam sebulan lepas, bagaimana anda mengambil {drug}?',
      answerNone: 'Tiada', required: 'Wajib', yes: 'Ya', no: 'Tidak',
      whoLbl: 'Dijawab oleh'
    }
  };

  /* ---------- pure helpers ---------- */
  const textLen = s => Array.from(String(s)).length;
  const fmtN = n => Number(n).toLocaleString('en-US');
  function fmt(s, vars) { return String(s).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined ? (typeof vars[k] === 'number' ? fmtN(vars[k]) : String(vars[k])) : m)); }
  function cleanRaw(s) { return String(s).replace(CTRL, ''); }

  /* The URL hash carries the visit: #v=C-1031&set=first&lang=ms. Never trusted for anything but lookup. */
  function parseHash(hash) {
    const p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    const v = p.get('v') || '', set = p.get('set') || '', lang = p.get('lang') || '';
    return {
      code: /^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/.test(v) ? v : null,
      set: set === 'first' || set === 'review' ? set : null,
      lang: LANGS.includes(lang) ? lang : null
    };
  }

  function readVisit(storage, code) {
    try {
      const map = JSON.parse(storage.getItem(VISITS_KEY) || '{}');
      if (!map || typeof map !== 'object' || !Object.prototype.hasOwnProperty.call(map, code)) return null;
      const r = map[code];
      if (!r || typeof r !== 'object') return null;
      return {
        caseId: typeof r.caseId === 'string' && r.caseId.length <= 40 ? r.caseId : null,
        rx: typeof r.rx === 'string' && r.rx.length <= 20 ? r.rx : null,
        rxName: typeof r.rxName === 'string' && r.rxName.trim() ? cleanRaw(r.rxName).trim().slice(0, 80) : null
      };
    } catch (e) { return null; }
  }

  function visitSet(parsed, rec) { return parsed.set || (rec ? CI.visitFor({ rx: rec.rx }) : 'first'); }

  /* Step order: who answers, then the questions the answers so far show. */
  function stepIds(set, answers) {
    return ['who'].concat(CI.questions(set, answers || {}).map(q => q.id));
  }
  const isSkippable = id => id !== 'who' && !CI.SAFETY_IDS.includes(id);

  /* st: {answers, skipped, who}. Returns {ok:true} or {ok:false, key, n}. key is a T string. */
  function validateStep(id, st) {
    if (id === 'who') return st && WHO_VALUES.includes(st.who) ? OK : { ok: false, key: 'reasonWho' };
    if (st.skipped && st.skipped[id]) return OK;
    const set = st.set;
    const q = (CI.SETS[set] || CI.SETS.first).find(x => x.id === id);
    if (!q) return OK;
    const v = st.answers[id];
    if (q.type === 'single') return v === undefined ? { ok: false, key: 'reasonPick' } : OK;
    if (q.type === 'multi') return (Array.isArray(v) && v.length) || q.optional ? OK : { ok: false, key: 'reasonMulti' };
    if (q.type === 'scale') return Number.isInteger(v) && v >= 0 && v <= 10 ? OK : { ok: false, key: 'reasonScale' };
    if (q.type === 'text') {
      if (typeof v === 'string' && textLen(v) > CI.MAX_TEXT) return { ok: false, key: 'reasonLong', n: textLen(v) };
      if (q.optional || v === CI.NONE) return OK;
      return typeof v === 'string' && v.trim() ? OK : { ok: false, key: 'reasonText' };
    }
    return OK;
  }

  function isAnsweredPure(id, st) {
    if (id === 'who') return WHO_VALUES.includes(st.who);
    if (st.skipped && st.skipped[id]) return true;
    return st.answers[id] !== undefined;
  }

  /* The notes shown after sending (review set). The medicine line depends on the answers, not on the stage. */
  function statusNotes(set, answers, lang) {
    const t = T[lang] || T.en, out = [];
    if (set !== 'review') return out;
    const a = answers || {};
    const stop = (a.med === 1 || a.med === 2 || a.med === 3) || (Array.isArray(a.sym) && a.sym.includes(0));
    if (stop) out.push(t.stopMeds);
    out.push(t.meds);
    return out;
  }

  /* Visible questions the patient answered Not sure to. */
  function unknownList(set, answers, lang) {
    return CI.questions(set, answers || {}).filter(q => (answers || {})[q.id] === CI.UNKNOWN).map(q => (q[lang] || q.en).q);
  }

  /* Outbox record. Text answers are kept whole here (never cut on the patient side); overLimit lists them. */
  function buildRecord(o) {
    const raw = o.answers || {};
    const norm = CI.normalise(o.set, raw);
    const overLimit = [];
    Object.keys(raw).forEach(k => {
      const v = raw[k];
      if (typeof v === 'string' && v !== CI.NONE && k in norm && textLen(v) > CI.MAX_TEXT) { overLimit.push(k); norm[k] = cleanRaw(v); }
    });
    const skipped = o.skipped || {};
    return {
      visit: o.code,
      caseId: o.caseId || o.code,
      set: o.set,
      lang: o.lang,
      answers: norm,
      flags: CI.flags(o.set, norm, { rx: o.rx || null }),
      who: WHO_VALUES.includes(o.who) ? o.who : null,
      urgent: !!o.urgent,
      ts: o.ts || new Date().toISOString(),
      skipped: Object.keys(skipped).filter(k => skipped[k]),
      overLimit
    };
  }

  /* Appends to the outbox (newest last, capped). Returns false if storage is unavailable. */
  function pushOutbox(storage, rec) {
    try {
      let arr = [];
      try { arr = JSON.parse(storage.getItem(OUTBOX_KEY) || '[]'); } catch (e) { arr = []; }
      if (!Array.isArray(arr)) arr = [];
      arr.push(rec);
      if (arr.length > OUTBOX_CAP) arr = arr.slice(arr.length - OUTBOX_CAP);
      storage.setItem(OUTBOX_KEY, JSON.stringify(arr));
      return true;
    } catch (e) { return false; }
  }

  const api = {
    LANGS, T, OUTBOX_KEY, OUTBOX_CAP, VISITS_KEY, SITE_EMERGENCY, WARN_AT, WHO_VALUES,
    textLen, fmt, parseHash, readVisit, visitSet, stepIds, isSkippable, isAnswered: isAnsweredPure, validateStep,
    statusNotes, unknownList, buildRecord, pushOutbox
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.OsteoPatientUI = api;
  if (typeof document !== 'undefined' && document.getElementById('app')) boot(root);

  /* ======================= DOM layer (browser only) ======================= */
  function boot(win) {
    const doc = win.document;
    const main = doc.getElementById('app');
    const liveEl = doc.getElementById('live');
    const brand = doc.getElementById('brand');
    const hash = parseHash(win.location.hash);

    function safeStore(name) {
      try { const s = win[name], k = '__osteo_probe__'; s.setItem(k, '1'); s.removeItem(k); return s; } catch (e) { return null; }
    }
    const ls = safeStore('localStorage'), ss = safeStore('sessionStorage');
    let memDraft = null, canPush = true;

    const S = {
      code: hash.code, caseId: null, rx: null, rxName: null, set: 'first', lang: hash.lang || 'en', who: null,
      answers: {}, skipped: {}, screen: 'consent', cur: 'who', ret: false,
      urgent: false, gate: false, urgentWritten: false, sent: false, before: null, dialog: null
    };

    function draftKey() { return DRAFT_PREFIX + S.code + '|' + S.set; }
    function saveDraft() {
      if (!S.code) return;
      const screen = S.screen === 'paused' && S.before ? S.before.screen : S.screen;
      const cur = S.screen === 'paused' && S.before ? S.before.cur : S.cur;
      const d = { v: 1, lang: S.lang, who: S.who, answers: S.answers, skipped: S.skipped, screen, cur,
        ret: S.ret, urgent: S.urgent, gate: S.gate, urgentWritten: S.urgentWritten, sent: S.sent };
      const json = JSON.stringify(d);
      try { if (ss) ss.setItem(draftKey(), json); else memDraft = json; } catch (e) { memDraft = json; }
    }
    function loadDraft() {
      let raw = null;
      try { raw = ss ? ss.getItem(draftKey()) : memDraft; } catch (e) { raw = memDraft; }
      if (!raw) return null;
      try { const d = JSON.parse(raw); return d && typeof d === 'object' && d.answers && typeof d.answers === 'object' ? d : null; } catch (e) { return null; }
    }
    function clearDraft() {
      memDraft = null;
      try { if (ss) ss.removeItem(draftKey()); } catch (e) { /* storage unavailable: nothing to clear */ }
    }

    function histState() { return { p: 'osteo', s: S.screen, id: S.cur, ret: !!S.ret }; }
    function currentUrl() { return win.location.href; }
    function pushNav() {
      if (!canPush) return;
      try { win.history.pushState(histState(), '', currentUrl()); } catch (e) { canPush = false; }
    }
    function replaceNav() {
      try { win.history.replaceState(histState(), '', currentUrl()); } catch (e) { canPush = false; }
    }
    function writeHash() {
      const p = new URLSearchParams();
      if (S.code) p.set('v', S.code);
      if (S.set) p.set('set', S.set);
      p.set('lang', S.lang);
      try { win.history.replaceState(histState(), '', win.location.pathname + win.location.search + '#' + p.toString()); } catch (e) { /* sandboxed: keep the old hash */ }
    }

    function effectiveScreen() {
      if (S.sent && (S.screen === 'review' || S.screen === 'q')) return 'done';
      return S.screen;
    }

    function applyLang() {
      const dir = S.lang === 'ar' ? 'rtl' : 'ltr';
      doc.documentElement.lang = S.lang;
      doc.documentElement.dir = dir;
      if (brand) brand.textContent = T[S.lang].title;
      doc.title = T[S.lang].title;
      doc.querySelectorAll('[data-lang]').forEach(b => {
        const on = b.getAttribute('data-lang') === S.lang;
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.classList.toggle('on', on);
      });
    }

    /* ---- DOM helpers ---- */
    function el(tag, attrs, kids) {
      const n = doc.createElement(tag);
      Object.keys(attrs || {}).forEach(k => {
        const v = attrs[k];
        if (v === false || v === null || v === undefined) return;
        if (k === 'text') n.textContent = v;
        else if (k === 'class') n.className = v;
        else if (k === 'hidden') n.hidden = !!v;
        else if (k === 'checked') n.checked = !!v;
        else if (k === 'disabled') n.disabled = !!v;
        else if (k === 'value') n.value = v;
        else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), v);
        else if (k === 'dataFocus') n.setAttribute('data-focus', '1');
        else n.setAttribute(k, v === true ? '' : String(v));
      });
      (kids || []).forEach(c => { if (c !== null && c !== undefined && c !== false) n.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
      return n;
    }
    const t = () => T[S.lang];

    function focusHeading() {
      const f = main.querySelector('[data-focus]');
      if (f) { try { f.focus(); } catch (e) { /* ignore */ } }
    }
    function announce(msg) { if (liveEl) liveEl.textContent = msg; }

    /* ---- question info (labels, options, values) in the current language ---- */
    function qInfo(id) {
      const L = t();
      if (id === 'who') return { id, type: 'single', text: L.who, labels: L.whoOpts.slice(), vals: WHO_VALUES.slice(), optional: false, noneIdx: -1 };
      const q = (CI.SETS[S.set] || CI.SETS.first).find(x => x.id === id);
      const lq = q[S.lang] || q.en;
      let text = lq.q;
      if (id === 'med' && S.rxName) text = fmt(L.medNamed, { drug: S.rxName });
      const info = { id, type: q.type, text, optional: !!q.optional, noneIdx: typeof q.none === 'number' ? q.none : -1 };
      if (q.type === 'single' || q.type === 'multi') {
        info.labels = lq.opts.slice(); info.vals = lq.opts.map((_, i) => i);
        if (q.type === 'single' && CI.canUnknown(q)) { info.labels.push(CI.UNK_LBL[S.lang]); info.vals.push('unk'); }
      }
      if (q.type === 'scale') { info.lo = lq.lo; info.hi = lq.hi; }
      if (q.type === 'text') { info.ph = lq.ph; info.hasNone = q.none === true; }
      if (q.type === 'numbers') { info.labels = lq.labels; info.fields = q.fields; }
      return info;
    }
    function valueLabel(info, v) {
      const L = t();
      if (info.id === 'who') { const i = WHO_VALUES.indexOf(v); return i < 0 ? '' : L.whoOpts[i]; }
      if (v === CI.UNKNOWN) return CI.UNK_LBL[S.lang];
      if (info.type === 'single') { const i = info.vals.indexOf(v); return i < 0 ? '' : info.labels[i]; }
      if (info.type === 'multi') return (v || []).map(i => info.labels[i]).join('; ');
      if (info.type === 'scale') return Number.isInteger(v) ? v + ' / 10' : '';
      if (info.type === 'text') return v === CI.NONE ? L.answerNone : String(v);
      if (info.type === 'numbers' && v && typeof v === 'object') {
        return info.fields.map((f, i) => (v[f[0]] ? info.labels[i] + ': ' + v[f[0]] + ' ' + f[1] : '')).filter(Boolean).join(', ');
      }
      return '';
    }
    function answerFor(id) {
      if (S.skipped[id]) return t().skipped;
      if (id === 'who') return valueLabel(qInfo('who'), S.who) || '';
      const v = S.answers[id];
      if (v === undefined) return '';
      return valueLabel(qInfo(id), v);
    }

    /* ---- navigation ---- */
    function go(screen, id, opts) {
      opts = opts || {};
      S.screen = screen;
      if (id !== undefined) S.cur = id;
      S.ret = !!opts.ret;
      if (opts.push !== false) pushNav();
      saveDraft();
      render();
    }
    function nextAfter(id) {
      const steps = stepIds(S.set, S.answers), i = steps.indexOf(id);
      const st = { answers: S.answers, skipped: S.skipped, who: S.who };
      if (S.ret) {
        // Changed from review: go to the next question still unanswered (a changed answer can reveal new ones), else review.
        const later = steps.slice(i + 1).find(x => !isAnsweredPure(x, st)) || steps.find(x => !isAnsweredPure(x, st));
        if (later) return { screen: 'q', id: later, ret: true };
        return { screen: 'review', id: null, ret: false };
      }
      if (i >= 0 && i + 1 < steps.length) return { screen: 'q', id: steps[i + 1], ret: false };
      return { screen: 'review', id: null, ret: false };
    }
    function goNext() {
      const nx = nextAfter(S.cur);
      go(nx.screen, nx.id === null ? undefined : nx.id, { ret: nx.ret });
    }
    function goBack() {
      if (canPush) { try { win.history.back(); return; } catch (e) { canPush = false; } }
      const steps = stepIds(S.set, S.answers), i = steps.indexOf(S.cur);
      if (S.screen === 'review') return go('q', steps[steps.length - 1], { push: false });
      if (i > 0) return go('q', steps[i - 1], { push: false });
      go('consent', undefined, { push: false });
    }

    function checkUrgent() {
      if (S.urgent) return;
      if (!CI.sameDayNow(S.set, S.answers, { rx: S.rx })) return;
      S.urgent = true; S.gate = true;
      S.urgentWritten = writeOutbox(true);
      saveDraft();
      render();
    }
    function writeOutbox(urgent) {
      const rec = buildRecord({ code: S.code, caseId: S.caseId, set: S.set, lang: S.lang, answers: S.answers, skipped: S.skipped,
        who: S.who, urgent, rx: S.rx, ts: new Date().toISOString() });
      return pushOutbox(ls, rec);
    }

    /* ---- screens ---- */
    function render() {
      applyLang();
      if (S.code) writeHash();
      const scr = S.gate && S.screen !== 'invalid' ? 'gate' : effectiveScreen();
      doc.body.setAttribute('data-screen', scr);
      if (scr === 'gate') return renderGate();
      if (scr === 'invalid') return renderInvalid();
      if (scr === 'consent') return renderConsent();
      if (scr === 'q') return renderQuestion(S.cur);
      if (scr === 'review') return renderReview();
      if (scr === 'done') return renderDone();
      if (scr === 'paused') return renderPaused();
      return renderConsent();
    }
    function show(nodes, announceText) {
      main.replaceChildren.apply(main, nodes.filter(Boolean));
      if (announceText) announce(announceText);
      focusHeading();
    }

    function renderInvalid() {
      const kids = [el('h1', { tabindex: '-1', dataFocus: true, text: T.en.title })];
      LANGS.forEach(l => kids.push(el('p', { lang: l, dir: l === 'ar' ? 'rtl' : 'ltr', text: T[l].invalid })));
      show(kids, T.en.invalid);
    }

    function renderConsent() {
      const L = t();
      const bannerTop = S.deletedNotice ? el('p', { class: 'notice', role: 'status', text: L.deleted }) : null;
      S.deletedNotice = false;
      const sec = (h, b) => el('section', { class: 'card' }, [el('h2', { text: h }), el('p', { text: b })]);
      show([
        bannerTop,
        el('h1', { tabindex: '-1', dataFocus: true, text: L.consentTitle }),
        el('p', { class: 'draftnote', text: L.draft }),
        sec(L.cWhoH, L.cWhoB), sec(L.cAiH, L.cAiB), sec(L.cSkipH, L.cSkipB), sec(L.cAskH, L.cAskB),
        el('div', { class: 'row' }, [el('button', { type: 'button', class: 'btn primary', id: 'start', text: L.start, onclick: () => go('q', 'who') })])
      ], L.consentTitle);
    }

    function renderQuestion(id) {
      const L = t();
      const steps = stepIds(S.set, S.answers);
      if (steps.indexOf(id) < 0) return renderReview();
      const idx = steps.indexOf(id);
      const info = qInfo(id);
      const kids = [el('p', { class: 'progress', id: 'progress', text: fmt(L.progress, { n: idx + 1, m: steps.length }) })];
      if (id === 'cc') kids.push(el('p', { class: 'notice', id: 'cc-note', text: L.cNote }));
      kids.push(el('h1', { id: 'qh', tabindex: '-1', dataFocus: true, text: info.text }));
      if (info.optional) kids.push(el('p', { class: 'tag', text: L.optional }));
      kids.push(questionBody(info));
      kids.push(el('p', { id: 'reason', class: 'reason', 'aria-live': 'polite' }));
      kids.push(el('div', { class: 'row' }, [
        el('button', { type: 'button', class: 'btn', id: 'back', text: L.back, onclick: goBack }),
        isSkippable(id) ? el('button', { type: 'button', class: 'btn', id: 'skip', text: L.skip, onclick: skipCurrent }) : null,
        el('button', { type: 'button', class: 'btn primary', id: 'next', text: L.next, onclick: () => { if (!main.querySelector('#next').disabled) goNext(); } })
      ]));
      kids.push(el('div', { class: 'cancelrow' }, [el('button', { type: 'button', class: 'btn quiet', id: 'cancel', text: L.cancel, onclick: openCancel })]));
      show(kids, fmt(L.progress, { n: idx + 1, m: steps.length }) + '. ' + info.text);
      refreshNext();
    }

    function questionBody(info) {
      const id = info.id, L = t();
      const wrap = el('fieldset', { class: 'answers', 'aria-labelledby': 'qh', 'data-qid': id });
      if (info.type === 'single' || info.type === 'multi' || info.id === 'who') {
        const isMulti = info.type === 'multi';
        const inputs = info.vals.map((v, i) => {
          const checked = info.id === 'who' ? S.who === v : (isMulti ? (S.answers[id] || []).includes(v) : S.answers[id] === v);
          const inp = el('input', { type: isMulti ? 'checkbox' : 'radio', name: id, value: String(v), id: 'o-' + id + '-' + i });
          inp.checked = checked;
          inp.addEventListener('change', () => onChoice(info, inp));
          return inp;
        });
        info.vals.forEach((v, i) => {
          wrap.appendChild(el('label', { class: 'opt' }, [inputs[i], el('span', { class: 'opt-text', text: info.labels[i] }),
            el('span', { class: 'sel', hidden: !inputs[i].checked, text: L.selected })]));
        });
        return wrap;
      }
      if (info.type === 'scale') {
        const readout = el('p', { class: 'readout', id: 'readout', text: Number.isInteger(S.answers[id]) ? fmt(L.selectedN, { n: S.answers[id] }) : '' });
        const row = (from, to) => el('div', { class: 'scale-row' }, rangeArr(from, to).map(i => {
          const inp = el('input', { type: 'radio', name: id, value: String(i), 'aria-label': String(i) });
          inp.checked = S.answers[id] === i;
          inp.addEventListener('change', () => { S.answers[id] = i; delete S.skipped[id]; saveDraft(); readout.textContent = fmt(L.selectedN, { n: i }); refreshNext(); });
          return el('label', { class: 'scale-btn' }, [inp, el('span', { text: String(i) })]);
        }));
        const scale = el('div', { class: 'scale', dir: 'ltr' }, [row(0, 5), row(6, 10), el('div', { class: 'scale-ends' }, [el('span', { text: info.lo }), el('span', { text: info.hi })])]);
        wrap.appendChild(scale); wrap.appendChild(readout);
        return wrap;
      }
      if (info.type === 'text') {
        const val = typeof S.answers[id] === 'string' ? S.answers[id] : '';
        const noneOn = S.answers[id] === CI.NONE;
        const ta = el('textarea', { id: 'f-' + id, rows: 6, 'aria-labelledby': 'qh', 'aria-describedby': 'count-' + id, placeholder: info.ph || '', disabled: noneOn });
        ta.value = noneOn ? '' : val;
        ta.addEventListener('input', () => {
          const v = cleanRaw(ta.value);
          if (v !== ta.value) ta.value = v;
          if (v === '') delete S.answers[id]; else S.answers[id] = v;
          delete S.skipped[id];
          if (noneBox && noneBox.checked && v !== '') noneBox.checked = false;
          saveDraft(); updateCounter(id); refreshNext();
        });
        const counter = el('p', { class: 'counter', id: 'count-' + id });
        wrap.appendChild(ta);
        wrap.appendChild(counter);
        let noneBox = null;
        if (info.hasNone) {
          noneBox = el('input', { type: 'checkbox', id: 'none-' + id, name: id, value: 'none', checked: noneOn });
          noneBox.addEventListener('change', () => {
            if (noneBox.checked) { S.answers[id] = CI.NONE; ta.value = ''; ta.disabled = true; }
            else { delete S.answers[id]; ta.disabled = false; }
            delete S.skipped[id];
            saveDraft(); updateCounter(id); refreshNext();
          });
          wrap.appendChild(el('label', { class: 'opt' }, [noneBox, el('span', { class: 'opt-text', text: CI.NONE_LBL[S.lang] }), el('span', { class: 'sel', hidden: !noneOn, text: L.selected })]));
        }
        setTimeout(() => updateCounter(id), 0);
        return wrap;
      }
      if (info.type === 'numbers') {
        const v = S.answers[id] && typeof S.answers[id] === 'object' ? S.answers[id] : {};
        info.fields.forEach((f, i) => {
          const inp = el('input', { type: 'text', inputmode: 'decimal', id: 'n-' + f[0], name: f[0], value: v[f[0]] || '', maxlength: 8, 'aria-label': info.labels[i] + ' (' + f[1] + ')' });
          inp.addEventListener('input', () => {
            const cur = Object.assign({}, S.answers[id] || {});
            cur[f[0]] = cleanRaw(inp.value).slice(0, 8);
            if (!cur.height && !cur.weight) delete S.answers[id]; else S.answers[id] = cur;
            saveDraft();
          });
          wrap.appendChild(el('label', { class: 'field' }, [el('span', { text: info.labels[i] + ' (' + f[1] + ')' }), inp]));
        });
        return wrap;
      }
      return wrap;
    }
    function rangeArr(a, b) { const out = []; for (let i = a; i <= b; i++) out.push(i); return out; }

    function updateCounter(id) {
      const c = doc.getElementById('count-' + id);
      if (!c) return;
      const v = S.answers[id];
      if (typeof v !== 'string' || v === CI.NONE) { c.textContent = ''; return; }
      const n = textLen(v), L = t();
      let txt = fmt('{n} / 1,000', { n });
      if (n > CI.MAX_TEXT) txt += ' . ' + fmt(L.reasonLong, { n });
      else if (n >= WARN_AT) txt += ' . ' + fmt(L.left, { n: CI.MAX_TEXT - n });
      c.textContent = txt;
      c.classList.toggle('warn', n >= WARN_AT);
      c.classList.toggle('over', n > CI.MAX_TEXT);
    }

    function onChoice(info, inp) {
      const id = info.id;
      if (id === 'who') { S.who = inp.value; saveDraft(); refreshNext(); syncSel(inp); return; }
      if (info.type === 'single') {
        const v = inp.value === 'unk' ? CI.UNKNOWN : Number(inp.value);
        S.answers[id] = v; delete S.skipped[id];
        saveDraft(); syncSel(inp); refreshNext();
        return;
      }
      // multi: the question's own none index is exclusive
      const group = Array.from(doc.querySelectorAll('input[name="' + id + '"]'));
      const idx = Number(inp.value);
      if (inp.checked && info.noneIdx === idx) group.forEach(o => { if (o !== inp) o.checked = false; });
      else if (inp.checked && info.noneIdx >= 0) group.forEach(o => { if (Number(o.value) === info.noneIdx) o.checked = false; });
      const vals = group.filter(o => o.checked).map(o => Number(o.value)).sort((a, b) => a - b);
      if (vals.length) S.answers[id] = vals; else delete S.answers[id];
      delete S.skipped[id];
      group.forEach(o => { const s = o.parentNode && o.parentNode.querySelector('.sel'); if (s) s.hidden = !o.checked; });
      saveDraft(); refreshNext();
      if (id === 'redf') checkUrgent();
    }
    function syncSel(inp) {
      doc.querySelectorAll('input[name="' + inp.name + '"]').forEach(o => { const s = o.parentNode && o.parentNode.querySelector('.sel'); if (s) s.hidden = !o.checked; });
    }

    function refreshNext() {
      const nxt = doc.getElementById('next'), reason = doc.getElementById('reason');
      if (!nxt) return;
      const id = S.cur, v = validateStep(id, { answers: S.answers, skipped: S.skipped, who: S.who, set: S.set });
      nxt.disabled = !v.ok;
      if (v.ok) { if (reason) reason.textContent = ''; nxt.removeAttribute('aria-describedby'); }
      else { if (reason) reason.textContent = fmt(t()[v.key], { n: v.n }); nxt.setAttribute('aria-describedby', 'reason'); }
      if (S.screen === 'q') { const info = qInfo(id); if (info.type === 'text') updateCounter(id); }
    }

    function skipCurrent() {
      if (!isSkippable(S.cur)) return;
      S.skipped[S.cur] = true; delete S.answers[S.cur];
      saveDraft();
      goNext();
    }

    function renderReview() {
      const L = t();
      const steps = stepIds(S.set, S.answers);
      const kids = [];
      if (S.urgent) kids.push(urgentBlock());
      kids.push(el('h1', { tabindex: '-1', dataFocus: true, text: L.reviewT }));
      kids.push(el('p', { text: L.reviewB }));
      let blocked = false;
      steps.forEach(id => {
        const info = qInfo(id);
        const v = validateStep(id, { answers: S.answers, skipped: S.skipped, who: S.who, set: S.set });
        if (!v.ok) blocked = true;
        const ans = answerFor(id) || '';
        const row = el('section', { class: 'rev', 'data-rev': id }, [
          el('p', { class: 'rev-q', text: info.text }),
          el('p', { class: 'rev-a', text: ans }),
          !v.ok ? el('p', { class: 'reason', text: fmt(L[v.key], { n: v.n }) }) : null,
          el('button', { type: 'button', class: 'btn small', id: 'change-' + id, 'aria-label': L.change + ': ' + info.text, text: L.change,
            onclick: () => go('q', id, { ret: true }) })
        ]);
        kids.push(row);
      });
      const unk = unknownList(S.set, S.answers, S.lang);
      if (unk.length) {
        kids.push(el('section', { class: 'card unk', id: 'unknown-list' }, [
          el('h2', { text: L.notSureH }), el('p', { text: L.notSureB }),
          el('ul', {}, unk.map(q => el('li', { text: q })))
        ]));
      }
      kids.push(el('p', { class: 'reason', id: 'reason', 'aria-live': 'polite', text: blocked ? L.sendBlocked : '' }));
      kids.push(el('div', { class: 'row' }, [
        el('button', { type: 'button', class: 'btn', id: 'back', text: L.back, onclick: goBack }),
        el('button', { type: 'button', class: 'btn primary', id: 'send', text: L.send, disabled: blocked, onclick: sendNow })
      ]));
      kids.push(el('div', { class: 'cancelrow' }, [el('button', { type: 'button', class: 'btn quiet', id: 'cancel', text: L.cancel, onclick: openCancel })]));
      show(kids, L.reviewT);
    }

    function sendNow() {
      const steps = stepIds(S.set, S.answers);
      if (steps.some(id => !validateStep(id, { answers: S.answers, skipped: S.skipped, who: S.who, set: S.set }).ok)) return render();
      const ok = writeOutbox(S.urgent);
      S.sent = true; S.sentOk = ok;
      go('done', undefined, {});
    }

    function urgentBlock() {
      const L = t();
      return el('section', { class: 'urgent', role: 'alert', id: 'urgent' }, [
        el('h2', { text: L.urgentH }),
        el('p', { text: L.urgentB }),
        el('p', { class: 'phone' }, [L.phoneL + ': ', el('strong', { text: SITE_EMERGENCY })])
      ]);
    }

    function renderDone() {
      const L = t();
      const kids = [];
      if (S.urgent) {
        kids.push(urgentBlock());
        kids.push(el('h1', { tabindex: '-1', dataFocus: true, text: L.doneUrgent }));
      } else {
        kids.push(el('h1', { tabindex: '-1', dataFocus: true, text: L.doneH }));
        kids.push(el('p', { text: L.doneB }));
        statusNotes(S.set, S.answers, S.lang).forEach(n => kids.push(el('p', { class: 'card', text: n })));
      }
      show(kids, S.urgent ? L.doneUrgent : L.doneH);
    }

    function renderGate() {
      const L = t();
      const scr = [];
      scr.push(el('section', { class: 'urgent gate', role: 'alert', id: 'urgent', tabindex: '-1', dataFocus: true }, [
        el('h1', { text: L.urgentH }),
        el('p', { text: L.urgentB }),
        el('p', { class: 'phone' }, [L.phoneL + ': ', el('strong', { text: SITE_EMERGENCY })]),
        el('button', { type: 'button', class: 'btn primary', id: 'urgent-go', text: L.urgentCont, onclick: () => {
          S.gate = false; saveDraft(); render();
        } })
      ]));
      show(scr, L.urgentH);
    }

    function openCancel() {
      if (S.dialog) return;
      const L = t();
      const close = () => { if (S.dialog) { S.dialog.remove(); S.dialog = null; } };
      const dlg = el('div', { class: 'overlay', id: 'cancel-overlay' }, [
        el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'cx-h' }, [
          el('h2', { id: 'cx-h', text: L.cancelH }),
          el('p', { text: L.cancelB }),
          el('button', { type: 'button', class: 'btn primary', id: 'leave-keep', text: L.leaveKeep, onclick: () => {
            close(); S.before = { screen: S.screen, cur: S.cur }; S.screen = 'paused'; saveDraft(); replaceNav(); render();
          } }),
          el('button', { type: 'button', class: 'btn', id: 'leave-del', text: L.leaveDel, onclick: () => {
            close(); clearDraft();
            S.answers = {}; S.skipped = {}; S.who = null; S.sent = false; S.urgent = false; S.gate = false; S.urgentWritten = false;
            S.before = null; S.screen = 'consent'; S.cur = 'who'; S.ret = false; S.deletedNotice = true;
            try { win.history.replaceState(histState(), '', currentUrl()); } catch (e) { canPush = false; }
            render();
          } }),
          el('button', { type: 'button', class: 'btn', id: 'keep', text: L.keep, onclick: close })
        ])
      ]);
      S.dialog = dlg;
      doc.body.appendChild(dlg);
      dlg.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
      const first = dlg.querySelector('button'); if (first) first.focus();
    }

    function renderPaused() {
      const L = t();
      show([
        el('h1', { tabindex: '-1', dataFocus: true, text: L.pausedH }),
        el('p', { text: L.pausedB }),
        el('div', { class: 'row' }, [el('button', { type: 'button', class: 'btn primary', id: 'resume', text: L.keep, onclick: () => {
          const b = S.before || { screen: 'q', cur: 'who' };
          S.screen = b.screen; S.cur = b.cur; S.before = null; saveDraft(); render();
        } })])
      ], L.pausedH);
    }

    /* ---- language switch: keep answers, keep the same screen ---- */
    doc.querySelectorAll('[data-lang]').forEach(b => {
      b.addEventListener('click', () => {
        S.lang = b.getAttribute('data-lang');
        saveDraft(); render();
      });
    });

    win.addEventListener('popstate', e => {
      const st = e.state;
      if (S.gate) { pushNav(); return render(); }
      if (!st || st.p !== 'osteo') return;
      S.screen = st.s; S.cur = st.id || S.cur; S.ret = !!st.ret;
      if (S.screen === 'paused') S.screen = S.before ? S.before.screen : 'consent';
      saveDraft(); render();
    });

    /* ---- start ---- */
    if (!S.code) {
      S.screen = 'invalid';
      replaceNav(); render();
      return;
    }
    const rec = readVisit(ls || { getItem: () => null }, S.code);
    if (rec) { S.caseId = rec.caseId; S.rx = rec.rx; S.rxName = rec.rxName; }
    S.set = visitSet(hash, rec);
    const d = loadDraft();
    if (d && d.v === 1 && !hash.lang && LANGS.includes(d.lang)) S.lang = d.lang;
    if (d && d.v === 1) {
      S.answers = sanitize(S.set, d.answers || {});
      S.skipped = d.skipped && typeof d.skipped === 'object' ? d.skipped : {};
      S.who = WHO_VALUES.includes(d.who) ? d.who : null;
      S.urgent = !!d.urgent; S.gate = !!d.gate; S.urgentWritten = !!d.urgentWritten; S.sent = !!d.sent;
      S.screen = ['consent', 'q', 'review', 'done'].includes(d.screen) ? d.screen : 'consent';
      S.cur = typeof d.cur === 'string' ? d.cur : 'who';
      S.ret = !!d.ret;
    }
    replaceNav();
    render();
  }

  /* Restored answers: normalise, but keep text as typed so nothing is cut silently. */
  function sanitize(set, raw) {
    const n = CI.normalise(set, raw);
    (CI.SETS[set] || []).forEach(q => {
      if (q.type === 'text' && typeof raw[q.id] === 'string' && q.id in n) n[q.id] = cleanRaw(raw[q.id]);
    });
    return n;
  }
})(typeof window !== 'undefined' ? window : globalThis);
