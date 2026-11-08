/* PeriLoop: the ONE table that maps every interview question id to intake answer ids (review1 round 3, open problem A).
 * Covers COMMON, follow-up questions and the procedure-specific questions of all six procedures.
 * Each row: q = interview question id; procs = 'ALL' or the procedures that ask it; to = intake answer ids it feeds.
 *   to: []          recorded only (no intake field); the summary lists it under "Recorded, not summarised"
 *   to: ['freeText'] the patient's own words section
 *   alsoRecorded    the summary shows the yes/no field AND lists the detail under "Recorded, not summarised"
 * toIntake() does the value normalisation: yes/no -> 'yes'|'no', numbers stay numbers, 'unknown' is kept,
 * walking bands become text. It only translates shapes. No clinical logic lives here.
 * Fictional content only. No network. Works under node (require) and in the page (window.PL_IDMAP).
 */
(function (root) {
  'use strict';
  const ALL = 'ALL';
  const ROWS = [
    // ---- COMMON: asked for every patient ----
    { q: 'sex', procs: ALL, to: [] },
    { q: 'medicines', procs: ALL, to: ['meds_text'] },
    { q: 'blood_thinners', procs: ALL, to: ['blood_thinner'] },
    { q: 'blood_thinner_detail', procs: ALL, to: ['blood_thinner'] },
    { q: 'allergies', procs: ALL, to: ['allergy_text', 'penicillin_allergy', 'latex_allergy'] },
    { q: 'allergy_detail', procs: ALL, to: ['allergy_text'] },
    { q: 'diabetes', procs: ALL, to: ['diabetes', 'hba1c'] },
    { q: 'hba1c', procs: ALL, to: ['hba1c'] },
    { q: 'heart_lung', procs: ALL, to: ['heart_disease', 'lung_disease'] },
    { q: 'kidney', procs: ALL, to: ['kidney_disease'] },
    { q: 'anaesthetic', procs: ALL, to: ['anaesthetic_problem'] },
    { q: 'anaesthetic_detail', procs: ALL, to: [] },
    { q: 'smoking', procs: ALL, to: ['smoker'] },
    { q: 'alcohol', procs: ALL, to: ['alcohol'] },
    { q: 'same_joint', procs: ALL, to: ['prior_surgery_same_joint'] },
    { q: 'same_joint_detail', procs: ALL, to: [] },
    { q: 'hospital_mrsa', procs: ALL, to: ['mrsa_or_admission_past_year'] },
    { q: 'pregnancy', procs: ALL, to: [] },
    { q: 'symptoms_now', procs: ALL, to: ['symptoms_now'] },
    { q: 'home_help', procs: ALL, to: [] },
    { q: 'stairs', procs: ALL, to: ['stairs_home'], alsoRecorded: true },
    { q: 'mobility_aid', procs: ALL, to: ['mobility_aid'], alsoRecorded: true },
    { q: 'payer', procs: ALL, to: ['payer'] },
    { q: 'contact_language', procs: ALL, to: ['preferred_language'] },
    { q: 'lives_alone', procs: ALL, to: ['lives_alone'] },
    { q: 'final_note', procs: ALL, to: ['freeText'] },
    // ---- TKR ----
    { q: 'tkr_walk', procs: ['TKR'], to: ['walk_distance_m'] },
    { q: 'tkr_night', procs: ['TKR'], to: ['night_pain'] },
    { q: 'tkr_injection', procs: ['TKR'], to: ['prior_injections'] },
    { q: 'tkr_calf', procs: ['TKR'], to: ['tkr_calf'] },
    // ---- THR ----
    { q: 'thr_socks', procs: ['THR'], to: [] },
    { q: 'thr_limp', procs: ['THR'], to: [] },
    { q: 'thr_injection', procs: ['THR'], to: ['prior_injections'] },
    { q: 'thr_leg_length', procs: ['THR'], to: [] },
    // ---- ACL ----
    { q: 'acl_giving_way', procs: ['ACL'], to: [] },
    { q: 'acl_weeks', procs: ['ACL'], to: [] },
    { q: 'acl_other', procs: ['ACL'], to: [] },
    { q: 'acl_sport', procs: ['ACL'], to: [] },
    // ---- LUMBAR: lives_alone is asked in COMMON. Night pain, prior injections and walking distance are not asked
    //      for LUMBAR (a ninth question would break the 3 to 5 procedure-question rule), so they are not gaps on this path. ----
    { q: 'lum_leg_weak', procs: ['LUMBAR'], to: ['lumbar_leg_weakness'] },
    { q: 'lum_bladder', procs: ['LUMBAR'], to: ['lumbar_bladder_bowel_change'] },
    { q: 'lum_saddle', procs: ['LUMBAR'], to: ['lumbar_saddle_numbness'] },
    { q: 'lum_distance', procs: ['LUMBAR'], to: [] },
    { q: 'lum_claudication', procs: ['LUMBAR'], to: [] },
    // ---- SHOULDER ----
    { q: 'sh_night', procs: ['SHOULDER'], to: ['night_pain'] },
    { q: 'sh_overhead', procs: ['SHOULDER'], to: [] },
    { q: 'sh_dominant', procs: ['SHOULDER'], to: [] },
    { q: 'sh_fingers', procs: ['SHOULDER'], to: ['sh_fingers'] },
    // ---- FOOTANKLE ----
    { q: 'fa_shoes', procs: ['FOOTANKLE'], to: [] },
    { q: 'fa_sore', procs: ['FOOTANKLE'], to: ['fa_sore'] },
    { q: 'fa_toes', procs: ['FOOTANKLE'], to: ['fa_toes'] },
    { q: 'fa_falls', procs: ['FOOTANKLE'], to: [] }
  ];

  const ROW = {};
  ROWS.forEach(r => { ROW[r.q] = r; });

  function appliesTo(row, proc) { return row.procs === ALL || row.procs.indexOf(proc) >= 0; }
  function rowsFor(proc) { return ROWS.filter(r => appliesTo(r, proc)); }
  // Intake ids that this procedure's interview asks about (the freeText pseudo-id is not an intake field).
  function fieldsFor(proc) {
    const out = [];
    rowsFor(proc).forEach(r => r.to.forEach(id => { if (id !== 'freeText' && out.indexOf(id) < 0) out.push(id); }));
    return out;
  }
  function targetsOf(q) { return ROW[q] ? ROW[q].to.slice() : []; }

  const YES = { yes: 'yes', no: 'no' };
  const PEN_RE = /penicillin|amoxicillin|augmentin|ampicillin|pen v|penisilin/i;
  const BAND_WALK = { under_100: 'under 100 m', '100_500': '100-500 m', over_500: 'over 500 m', cannot: 'cannot walk' };

  function yn(v) {
    if (typeof v === 'boolean') return v ? 'yes' : 'no';
    if (typeof v !== 'string') return null;
    const s = v.trim().toLowerCase();
    return YES[s] || (s === 'y' ? 'yes' : s === 'n' ? 'no' : null);
  }

  // Interview answers (keyed by question id) -> intake answers (keyed by intake id). Only rows that apply to proc are read.
  function toIntake(ia, proc) {
    ia = ia || {};
    const out = {};
    const has = q => ROW[q] && appliesTo(ROW[q], proc) && ia[q] !== undefined && ia[q] !== null;
    const put = (k, v) => { if (v !== undefined) out[k] = v; };
    const first = (...pairs) => { for (const [q, f] of pairs) if (has(q)) { const v = f(ia[q]); if (v !== undefined) return v; } return undefined; };
    const ynOf = v => yn(v);

    if (has('medicines')) put('meds_text', ia.medicines);

    if (has('blood_thinners')) {
      const ans = yn(ia.blood_thinners);
      if (ans === 'yes') put('blood_thinner', { answer: 'yes', name: has('blood_thinner_detail') ? String(ia.blood_thinner_detail) : '' });
      else if (ans === 'no') put('blood_thinner', 'no');
    }

    if (has('allergies')) {
      const ans = yn(ia.allergies);
      const d = has('allergy_detail') ? String(ia.allergy_detail) : '';
      if (ans === 'yes') {
        put('allergy_text', d || 'yes');
        // the detail decides penicillin and latex; if it does not say, the answer is unclear (a gap), never a guess
        put('penicillin_allergy', PEN_RE.test(d) ? 'yes' : 'unclear');
        put('latex_allergy', /latex/i.test(d) ? 'yes' : 'unclear');
      } else if (ans === 'no') {
        put('allergy_text', 'none known'); put('penicillin_allergy', 'no'); put('latex_allergy', 'no');
      }
    }
    if (has('allergy_detail') && !has('allergies')) put('allergy_text', String(ia.allergy_detail));

    if (has('diabetes')) {
      const ans = yn(ia.diabetes);
      put('diabetes', ans);
      if (ans === 'no') put('hba1c', 'not applicable');
    }
    if (has('hba1c') && ia.diabetes !== undefined && yn(ia.diabetes) !== 'no') put('hba1c', ia.hba1c);
    // review2 B4 (round 4): a typed HbA1c value is never discarded, even when diabetes is answered no. The summary flags the conflict.
    if (has('hba1c') && typeof ia.hba1c === 'number' && ia.diabetes !== undefined && yn(ia.diabetes) === 'no') put('hba1c', ia.hba1c);

    if (has('heart_lung')) { put('heart_disease', ynOf(ia.heart_lung)); put('lung_disease', ynOf(ia.heart_lung)); }
    if (has('kidney')) put('kidney_disease', ynOf(ia.kidney));
    if (has('anaesthetic')) put('anaesthetic_problem', ynOf(ia.anaesthetic));
    if (has('smoking')) {
      if (ia.smoking === 'current') put('smoker', 'yes');
      else if (ia.smoking === 'never' || ia.smoking === 'former') put('smoker', 'no');
    }
    if (has('alcohol')) put('alcohol', ia.alcohol);
    if (has('same_joint')) put('prior_surgery_same_joint', ynOf(ia.same_joint));
    if (has('hospital_mrsa')) put('mrsa_or_admission_past_year', ynOf(ia.hospital_mrsa));
    if (has('symptoms_now')) put('symptoms_now', ynOf(ia.symptoms_now));
    if (has('lives_alone')) put('lives_alone', ynOf(ia.lives_alone));
    if (has('stairs') && typeof ia.stairs === 'number') put('stairs_home', ia.stairs > 0 ? 'yes' : 'no');
    if (has('mobility_aid') && ia.mobility_aid !== 'unknown') put('mobility_aid', ia.mobility_aid === 'none' ? 'no' : 'yes'); // unknown is recorded below, never yes
    if (has('payer')) put('payer', ia.payer);
    if (has('contact_language')) put('preferred_language', ia.contact_language);

    // walking distance: the TKR band (asked for TKR only)
    const walk = first(['tkr_walk', v => BAND_WALK[v]]);
    if (walk !== undefined) put('walk_distance_m', walk);
    // night pain and prior injections, from whichever procedure question asks them
    const night = first(['tkr_night', ynOf], ['sh_night', ynOf]);
    if (night !== undefined) put('night_pain', night);
    const inj = first(['tkr_injection', ynOf], ['thr_injection', ynOf]);
    if (inj !== undefined) put('prior_injections', inj);

    if (has('lum_leg_weak')) put('lumbar_leg_weakness', ynOf(ia.lum_leg_weak));
    if (has('lum_bladder')) put('lumbar_bladder_bowel_change', ynOf(ia.lum_bladder));
    if (has('lum_saddle')) put('lumbar_saddle_numbness', ynOf(ia.lum_saddle));
    if (has('tkr_calf')) put('tkr_calf', ynOf(ia.tkr_calf));
    if (has('sh_fingers')) put('sh_fingers', ynOf(ia.sh_fingers));
    if (has('fa_sore')) put('fa_sore', ynOf(ia.fa_sore));
    if (has('fa_toes')) put('fa_toes', ynOf(ia.fa_toes));

    // polish item 2 (round 8): "I don't know" on any question is recorded as 'unknown' on every field it feeds, never as no.
    // An unknown diabetes answer does not set HbA1c: HbA1c has its own question and its own answer.
    Object.keys(ia).forEach(q => {
      if (ia[q] !== 'unknown' || !has(q)) return;
      const targets = q === 'diabetes' ? ['diabetes'] : (ROW[q].to || []).filter(t => t !== 'freeText');
      targets.forEach(t => { if (out[t] === undefined || out[t] === null) out[t] = 'unknown'; });
    });
    return out;
  }

  const api = { ROWS, ROW, fieldsFor, targetsOf, rowsFor, toIntake, BAND_WALK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PL_IDMAP = api;
})(this);
