/*
 * OsteoLoop patient check-in: what the patient fills in before every clinic visit.
 * Two question sets: 'first' (before the first clinic, no treatment yet) and 'review' (on treatment).
 * flags() turns answers into clinician flags, deterministically. Patient-reported answers never
 * change the risk category on their own: a clinician confirms first.
 * Sources: MYCPG = Malaysian CPG 2022, NICE = NG259, FRAX = FRAX calculator input,
 *          LOCAL = drug-safety check awaiting clinician sign-off.
 * Arabic text needs native-speaker clinical review.
 * Works in the browser (window.OsteoCheckin) and in Node (module.exports).
 */
(function (root) {
  const YN = { en: ['Yes', 'No'], ar: ['نعم', 'لا'] };
  const YNU = { en: ['Yes', 'No', 'Not sure'], ar: ['نعم', 'لا', 'لست متأكدة'] };

  const FIRST = [
    { id: 'fx', type: 'single', en: { q: 'Since age 50, have you broken a bone after a minor fall or bump?', opts: YNU.en }, ar: { q: 'منذ سن الخمسين، هل كُسرت لديك عظمة بعد سقوط بسيط أو اصطدام خفيف؟', opts: YNU.ar } },
    { id: 'fxsite', type: 'single', show: a => a.fx === 0, en: { q: 'Which bone?', opts: ['Wrist', 'Hip', 'Spine or back', 'Upper arm', 'Other'] }, ar: { q: 'أي عظمة؟', opts: ['المعصم', 'الورك', 'العمود الفقري أو الظهر', 'أعلى الذراع', 'غير ذلك'] } },
    { id: 'fxwhen', type: 'single', show: a => a.fx === 0, en: { q: 'When did it happen?', opts: ['In the last 12 months', '1 to 2 years ago', 'More than 2 years ago'] }, ar: { q: 'متى حدث ذلك؟', opts: ['خلال آخر 12 شهرًا', 'قبل سنة إلى سنتين', 'قبل أكثر من سنتين'] } },
    { id: 'falls', type: 'single', en: { q: 'How many times have you fallen in the last 12 months?', opts: ['None', 'Once', 'Twice or more'] }, ar: { q: 'كم مرة سقطتِ خلال آخر 12 شهرًا؟', opts: ['ولا مرة', 'مرة واحدة', 'مرتين أو أكثر'] } },
    { id: 'parent', type: 'single', en: { q: 'Did your mother or father ever break a hip?', opts: YNU.en }, ar: { q: 'هل كُسر ورك والدتك أو والدك من قبل؟', opts: YNU.ar } },
    { id: 'steroid', type: 'single', en: { q: 'Have you taken steroid tablets (for example prednisolone) for 3 months or more?', opts: YNU.en }, ar: { q: 'هل تناولتِ أقراص الستيرويد (مثل بريدنيزولون) لمدة 3 أشهر أو أكثر؟', opts: YNU.ar } },
    { id: 'ra', type: 'single', en: { q: 'Has a doctor told you that you have rheumatoid arthritis?', opts: YNU.en }, ar: { q: 'هل أخبرك طبيب أنك مصابة بالتهاب المفاصل الروماتويدي؟', opts: YNU.ar } },
    { id: 'smoke', type: 'single', en: { q: 'Do you smoke now?', opts: YN.en }, ar: { q: 'هل تدخنين حاليًا؟', opts: YN.ar } },
    { id: 'alcohol', type: 'single', en: { q: 'Do you usually drink 3 or more alcoholic drinks a day?', opts: YN.en }, ar: { q: 'هل تشربين عادةً 3 مشروبات كحولية أو أكثر في اليوم؟', opts: YN.ar } },
    { id: 'shrink', type: 'single', en: { q: 'Have you noticed you have become shorter, or more bent forward?', opts: YNU.en }, ar: { q: 'هل لاحظتِ أن طولك قد نقص، أو أن ظهرك أصبح أكثر انحناءً؟', opts: YNU.ar } },
    { id: 'body', type: 'numbers', optional: true, fields: [['height', 'cm'], ['weight', 'kg']], en: { q: 'Your height and weight, if you know them', labels: ['Height', 'Weight'] }, ar: { q: 'طولك ووزنك إن كنتِ تعرفينهما', labels: ['الطول', 'الوزن'] } },
    { id: 'ask', type: 'text', optional: true, en: { q: 'Is there anything you want to ask your doctor?', ph: 'Type your question (optional)' }, ar: { q: 'هل هناك شيء تريدين سؤال طبيبك عنه؟', ph: 'اكتبي سؤالك (اختياري)' } }
  ];

  const REVIEW = [
    { id: 'med', type: 'single', en: { q: 'In the last month, how have you taken your bone medicine?', opts: ['Every dose', 'I missed some doses', 'I stopped taking it', 'I have not started yet'] }, ar: { q: 'خلال الشهر الماضي، كيف تناولتِ دواء العظام؟', opts: ['كل الجرعات', 'فاتتني بعض الجرعات', 'توقفتُ عن تناوله', 'لم أبدأ بعد'] } },
    { id: 'why', type: 'multi', show: a => a.med > 0, en: { q: 'What made it hard? Choose all that apply.', opts: ['Side effects', 'Cost', 'I forgot', 'Not sure I need it', 'Hard to take it the right way', 'Something else'] }, ar: { q: 'ما الذي جعل ذلك صعبًا؟ اختاري كل ما ينطبق.', opts: ['آثار جانبية', 'التكلفة', 'نسيت', 'لست متأكدة أنني أحتاجه', 'صعوبة تناوله بالطريقة الصحيحة', 'شيء آخر'] } },
    { id: 'sym', type: 'multi', en: { q: 'Since your last visit, have you had any of these? Choose all that apply.', opts: ['Heartburn or pain when swallowing', 'Pain or swelling in the jaw, or a loose tooth', 'New pain in the thigh or groin', 'None of these'] }, ar: { q: 'منذ زيارتك الأخيرة، هل عانيتِ من أي مما يلي؟ اختاري كل ما ينطبق.', opts: ['حرقة في المعدة أو ألم عند البلع', 'ألم أو تورم في الفك، أو سن متخلخل', 'ألم جديد في الفخذ أو أعلى الفخذ', 'لا شيء من ذلك'] } },
    { id: 'rfall', type: 'single', en: { q: 'Have you fallen since your last visit?', opts: ['No', 'Yes, once', 'Yes, more than once'] }, ar: { q: 'هل سقطتِ منذ زيارتك الأخيرة؟', opts: ['لا', 'نعم، مرة واحدة', 'نعم، أكثر من مرة'] } },
    { id: 'rfx', type: 'single', en: { q: 'Have you broken a bone since your last visit?', opts: YN.en }, ar: { q: 'هل كُسرت لديك عظمة منذ زيارتك الأخيرة؟', opts: YN.ar } },
    { id: 'dental', type: 'single', en: { q: 'Are you planning a tooth extraction or other dental surgery?', opts: YN.en }, ar: { q: 'هل تخططين لخلع سن أو جراحة أسنان أخرى؟', opts: YN.ar } },
    { id: 'cad', type: 'single', en: { q: 'Are you taking calcium and vitamin D as advised?', opts: ['Yes', 'Sometimes', 'No'] }, ar: { q: 'هل تتناولين الكالسيوم وفيتامين د كما نُصحتِ؟', opts: ['نعم', 'أحيانًا', 'لا'] } },
    { id: 'ask', type: 'text', optional: true, en: { q: 'Is there anything you want to ask your doctor?', ph: 'Type your question (optional)' }, ar: { q: 'هل هناك شيء تريدين سؤال طبيبك عنه؟', ph: 'اكتبي سؤالك (اختياري)' } }
  ];

  const SETS = { first: FIRST, review: REVIEW };
  /* Which check-in a patient gets: on treatment once something has been prescribed. */
  function visitFor(c) { return c && c.rx ? 'review' : 'first'; }
  function questions(visit, answers) { return SETS[visit].filter(q => !q.show || q.show(answers || {})); }

  const has = (a, k, i) => Array.isArray(a[k]) && a[k].includes(i);
  const WHY = ['side effects', 'cost', 'forgot', 'unsure it is needed', 'hard to take correctly', 'other'];
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
      const fr = [];
      if (a.parent === 0) fr.push('parent hip fracture'); if (a.ra === 0) fr.push('rheumatoid arthritis');
      if (a.smoke === 0) fr.push('current smoker'); if (a.alcohol === 0) fr.push('alcohol 3+ units a day');
      const h = a.body && +a.body.height, w = a.body && +a.body.weight;
      if (h > 0 && w > 0) { const bmi = w / Math.pow(h / 100, 2); if (bmi < 19) fr.push('BMI ' + bmi.toFixed(1)); }
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
    if (a.ask && String(a.ask).trim()) out.push(['P-ASK', 'info', 'Patient question: "' + String(a.ask).trim().slice(0, 200) + '"', 'PATIENT']);
    return out;
  }
  function reasons(a) { const r = (a.why || []).map(i => WHY[i]).filter(Boolean); return r.length ? ' (' + r.join(', ') + ')' : ''; }

  /* Adherence answer that counts as the 3-month adherence check, once a clinician accepts it. */
  function adherent(a) { return a && a.med === 0; }

  const api = { SETS, visitFor, questions, flags, adherent };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OsteoCheckin = api;
})(typeof window !== 'undefined' ? window : globalThis);
