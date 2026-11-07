/*
 * Arabic and bilingual (Arabic with English terms) synthetic radiology reports. Fictional.
 * LABELS WRITTEN BEFORE THE ARABIC LEXICON WAS ADDED TO src/finder.js, and not changed after the first run.
 * DRAFT LABELS pending clinical lead sign-off and native-speaker clinical review of the Arabic.
 *
 * label: same rubric as bench/reports.js (act / review / no). Site: vert | hip | wrist | humerus | pelvis | other | null.
 * The Arabic here is written in Modern Standard Arabic as used in Gulf and Malaysian radiology reports; it is not
 * a translation of the English set, and it is not blind (the author knows the lexicon the finder is given).
 */
(function () {
const R = [
  // 1. Arabic prose with an English level label (T8). Compression fracture, 30% height loss, no trauma stated.
  // act: a definite compression fracture of T8 in a 74-year-old, no trauma, not pathological.
  { id: 'AR01', age: 74, sex: 'F', mod: 'XR thoracic spine', ind: 'ألم في الظهر', text: 'كسر انضغاطي في الفقرة T8 بنسبة 30% من ارتفاع الجسم الفقري. لا يوجد ما يشير إلى ورم.', label: 'act', site: 'vert' },

  // 2. Arabic only, femoral neck fracture after a fall at home. act: fragility hip fracture, 81 years.
  { id: 'AR02', age: 81, sex: 'F', mod: 'XR hip', ind: 'سقوط في المنزل', text: 'كسر في عنق الفخذ الأيسر مع إزاحة واضحة.', label: 'act', site: 'hip' },

  // 3. Mixed: Arabic prose with 'distal radius' in English in brackets. Fall on outstretched hand, 66 years.
  // act: distal radius fracture after low-energy fall (wrist site).
  { id: 'AR03', age: 66, sex: 'F', mod: 'XR wrist', ind: 'سقوط على اليد', text: 'كسر في الطرف البعيد للكعبرة (distal radius) مع انحراف للخلف.', label: 'act', site: 'wrist' },

  // 4. Arabic only, proximal humerus, fall. act: proximal humerus fracture, 70 years, low trauma.
  { id: 'AR04', age: 70, sex: 'F', mod: 'XR shoulder', ind: 'ألم الكتف بعد السقوط', text: 'كسر في الطرف العلوي للعضد الأيمن، دون إزاحة.', label: 'act', site: 'humerus' },

  // 5. Mixed: pubic ramus in Arabic with the English anatomical term. Fall from standing, 77 years. act: pelvic fragility fracture.
  { id: 'AR05', age: 77, sex: 'F', mod: 'CT pelvis', ind: 'سقوط من الوقوف', text: 'كسر في عظم العانة الأيمن (superior pubic ramus) دون إصابة في الحوض الخلفي.', label: 'act', site: 'pelvis' },

  // 6. Mixed: evidence of a past fracture treated with vertebroplasty (English term). act per rubric: past fracture counts.
  { id: 'AR06', age: 79, sex: 'F', mod: 'XR lumbar spine', ind: 'ألم أسفل الظهر مزمن', text: 'آثار تدعيم فقري سابق (vertebroplasty) على مستوى L1، مع تشوه انضغاطي قديم.', label: 'act', site: 'vert' },

  // 7. Arabic negation only: no fracture in lumbar spine, normal heights. no: negated.
  { id: 'AR07', age: 68, sex: 'F', mod: 'XR lumbar spine', ind: 'ألم أسفل الظهر', text: 'لا يوجد كسر في الفقرات القطنية. ارتفاع الفقرات طبيعي.', label: 'no', site: null },

  // 8. Mixed negation: English 'No' before an Arabic fracture term. no: negated, normal study.
  { id: 'AR08', age: 71, sex: 'F', mod: 'XR thoracic spine', ind: 'ألم في الظهر', text: 'No كسر ظاهر في الفقرة T12. التصوير طبيعي.', label: 'no', site: null },

  // 9. Hedged Arabic ('suspicion', 'possible'). review: hedged, not a definite fracture.
  { id: 'AR09', age: 73, sex: 'F', mod: 'MRI thoracic spine', ind: 'ألم في الظهر', text: 'يشتبه بوجود كسر انضغاطي محتمل في الفقرة T9 ويوصى بالتصوير بالرنين مرة أخرى.', label: 'review', site: 'vert' },

  // 10. High-energy trauma in Arabic (road traffic accident). no: high-energy trauma is not a fragility fracture.
  { id: 'AR10', age: 60, sex: 'M', mod: 'XR hip', ind: 'إصابة بعد حادث مروري', text: 'كسر في عنق الفخذ الأيمن ناتج عن حادث سير عالي الطاقة.', label: 'no', site: 'hip' },

  // 11. Pathological fracture due to a tumour (ورم نقيلي = metastatic tumour). no: pathological, not osteoporotic.
  { id: 'AR11', age: 66, sex: 'F', mod: 'CT spine', ind: 'ورم معروف، ألم في الظهر', text: 'كسر مرضي في الفقرة L2 بسبب ورم نقيلي معروف.', label: 'no', site: 'vert' },

  // 12. Arabic only, osteoporotic compression fracture of L1 with an osteoporosis history. act: 72 years, no trauma.
  { id: 'AR12', age: 72, sex: 'F', mod: 'XR lumbar spine', ind: 'ألم في أسفل الظهر، هشاشة عظام معروفة', text: 'كسر انضغاطي في الفقرة L1 لدى مريضة مصابة بهشاشة العظام.', label: 'act', site: 'vert' },

  // 13. Minor site (rib) after a low-energy fall. review: rib is a minor site, needs a human.
  { id: 'AR13', age: 69, sex: 'F', mod: 'XR chest', ind: 'ألم في الجنب بعد سقوط بسيط', text: 'كسر في الضلع السادس الأيسر بعد سقوط بسيط.', label: 'review', site: 'other' },

  // 14. Vertebral compression fracture at age 42, no trauma stated. review: under 50 without trauma.
  { id: 'AR14', age: 42, sex: 'F', mod: 'XR thoracic spine', ind: 'ألم في الظهر', text: 'كسر انضغاطي في الفقرة T7 دون حادث واضح.', label: 'review', site: 'vert' },

  // 15. Vertebral collapse described in Arabic without the word 'كسر'. act: collapse of a named vertebra with height loss,
  // 77 years, low trauma (English rule: 'collapse' counts next to a vertebra). This is a deliberate test of lexicon coverage.
  { id: 'AR15', age: 77, sex: 'F', mod: 'XR thoracic spine', ind: 'ظهر مع ألم بعد سقوط', text: 'انهيار في جسم الفقرة D10 مع نقص في الارتفاع الأمامي.', label: 'act', site: 'vert' }
];
if (typeof module !== 'undefined' && module.exports) module.exports = R;
else (window.OsteoReports = window.OsteoReports || {}).arabic = R;
})();
