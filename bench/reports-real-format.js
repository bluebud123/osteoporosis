/*
 * Synthetic reports that imitate messy real formats: all caps, templated headers (EXAM / COMPARISON / TECHNIQUE /
 * FINDINGS / IMPRESSION), numbered findings, dictation errors, abbreviations (WNL, NAD, h/o, #NOF, FX, VCF),
 * and impressions that contradict the findings. Fictional. Not copied from any real report.
 * LABELS WRITTEN BEFORE ANY CHANGE TO src/finder.js FOR THIS SET, and not changed after the first run.
 * DRAFT LABELS pending clinical lead sign-off.
 *
 * label: same rubric as bench/reports.js (act / review / no). Site: vert | hip | wrist | humerus | pelvis | other | null.
 */
(function () {
const R = [
  // RF01. All caps templated pelvis report. Acute superior pubic ramus fracture after a fall. act.
  { id: 'RF01', age: 80, sex: 'F', mod: 'XR PELVIS', ind: 'FALL AT HOME, HX OF OSTEOPOROSIS',
    text: 'EXAM: XR PELVIS. COMPARISON: NONE. TECHNIQUE: AP PELVIS. FINDINGS: 1. ACUTE LEFT SUPERIOR PUBIC RAMUS FRACTURE. 2. NO DISLOCATION. IMPRESSION: ACUTE LEFT PUBIC RAMUS FRACTURE.', label: 'act', site: 'pelvis' },

  // RF02. Abbreviated history of a hip fracture with prior hemiarthroplasty. The acute study is negative, but the
  // history is a documented prior neck of femur fracture. act (rubric: past fracture with surgery counts).
  { id: 'RF02', age: 83, sex: 'F', mod: 'XR HIP R', ind: 'R HIP PAIN',
    text: 'TECHNIQUE: AP PELVIS AND R HIP. FINDINGS: H/O #NOF R, S/P HEMIARTHROPLASTY. NO ACUTE FRACTURE. IMPRESSION: H/O R FEMORAL NECK FRACTURE, S/P HEMIARTHROPLASTY.', label: 'act', site: 'hip' },

  // RF03. Findings and impression contradict. Findings show a mild compression deformity with 20% height loss at T11;
  // impression says no fracture. label review: the conflict needs a clinician to reconcile it, so it must not be dismissed.
  { id: 'RF03', age: 74, sex: 'F', mod: 'CT ABDOMEN', ind: 'ABDOMINAL PAIN',
    text: 'FINDINGS: 1. MILD COMPRESSION DEFORMITY OF T11 VERTEBRAL BODY, APPROXIMATELY 20% HEIGHT LOSS. 2. LIVER, SPLEEN AND KIDNEYS UNREMARKABLE. IMPRESSION: NO FRACTURE. OTHERWISE UNREMARKABLE.', label: 'review', site: 'vert' },

  // RF04. Normal study written as WNL / NAD. no: nothing documented.
  { id: 'RF04', age: 61, sex: 'M', mod: 'CT CHEST', ind: 'PRE-OP ASSESSMENT',
    text: 'LUNGS CLEAR. HEART SIZE WNL. BONES: WNL. OTHERWISE NAD. IMPRESSION: NAD.', label: 'no', site: null },

  // RF05. Abbreviation 'FX' for fracture in an all caps wrist report, with dorsal angulation. act: distal radius, low-energy fall.
  { id: 'RF05', age: 68, sex: 'F', mod: 'XR R WRIST', ind: 'FOOSH',
    text: 'XR R WRIST 2 VIEWS. FINDINGS: DISTAL RADIUS FX WITH DORSAL ANGULATION, NO INTRA-ARTICULAR EXTENSION. IMPRESSION: R DISTAL RADIUS FX.', label: 'act', site: 'wrist' },

  // RF06. Dictation error: 'compresion fracure' (misspelt). Osteoporotic T7 wedge fracture with 25% height loss. act.
  // The misspelling is the point of the test: a clinician reading it would call it a fracture.
  { id: 'RF06', age: 74, sex: 'F', mod: 'XR THORACIC SPINE', ind: 'BACK PAIN, OSTEOPOROSIS',
    text: 'Osteoporotic wedge compresion fracure of T7 with 25% height loss. No retropulsion.', label: 'act', site: 'vert' },

  // RF07. Templated, normal spine. 'No acute fracture' is negated; the rest is degenerative. no.
  { id: 'RF07', age: 70, sex: 'M', mod: 'XR LUMBAR SPINE', ind: 'LOW BACK PAIN',
    text: 'COMPARISON: 2019. FINDINGS: DEGENERATIVE CHANGES AT L4-L5. NO ACUTE FRACTURE OR SUBLUXATION. IMPRESSION: DEGENERATIVE CHANGES ONLY.', label: 'no', site: null },

  // RF08. Numbered findings with an old rib fracture (minor site), osteopenia, and a 30% L1 wedge deformity.
  // act: the L1 wedge deformity is a vertebral fracture; the rib and osteopenia do not change that.
  { id: 'RF08', age: 77, sex: 'F', mod: 'CT CHEST', ind: 'LUNG NODULE FOLLOW-UP',
    text: 'FINDINGS: 1. OSTEOPENIA. 2. OLD HEALED FRACTURE OF THE LEFT LATERAL 5TH RIB. 3. WEDGE DEFORMITY OF L1, 30%. IMPRESSION: STABLE LUNG NODULE. L1 WEDGE DEFORMITY.', label: 'act', site: 'vert' },

  // RF09. Hedged finding, impression negative. 'Cannot exclude nondisplaced fracture' in findings. review.
  { id: 'RF09', age: 79, sex: 'F', mod: 'XR HIP L', ind: 'FALL, HIP PAIN',
    text: 'FINDINGS: SUBTLE LUCENCY ALONG THE FEMORAL NECK. CANNOT EXCLUDE NONDISPLACED FRACTURE. IMPRESSION: NO FRACTURE.', label: 'review', site: 'hip' },

  // RF10. Clinical history '#NOF', an all caps femoral neck fracture on the findings, NAD elsewhere. act (low-energy fall, 84).
  { id: 'RF10', age: 84, sex: 'F', mod: 'XR HIP L', ind: 'FALL. #NOF?',
    text: 'L FEMORAL NECK FRACTURE, DISPLACED. NAD ELSEWHERE IN THE PELVIS.', label: 'act', site: 'hip' },

  // RF11. Templated header with 'RTA' in the clinical information: high-energy trauma. no.
  { id: 'RF11', age: 58, sex: 'M', mod: 'XR KNEE', ind: 'RTA, PEDESTRIAN VS CAR, ?FRACTURE',
    text: 'FINDINGS: 1. RIGHT TIBIAL PLATEAU FRACTURE. 2. SMALL KNEE EFFUSION. IMPRESSION: RIGHT TIBIAL PLATEAU FRACTURE.', label: 'no', site: 'other' },

  // RF12. Abbreviations VCF and VERTEBRAL COMPRESSION FX with 40% anterior height loss. Impression abbreviation only.
  // act: osteoporotic L1 compression fracture. The impression wording is a second, abbreviated statement of the same fracture.
  { id: 'RF12', age: 81, sex: 'F', mod: 'XR LUMBAR SPINE', ind: 'BACK PAIN AFTER A FALL',
    text: 'COMP: NONE. FINDINGS: L1 VCF (VERTEBRAL COMPRESSION FX) WITH 40% ANTERIOR HEIGHT LOSS. NO RETROPULSION. OTHERWISE WNL. IMP: L1 VCF, OSTEOPOROTIC PATTERN.', label: 'act', site: 'vert' }
];
if (typeof module !== 'undefined' && module.exports) module.exports = R;
else (window.OsteoReports = window.OsteoReports || {}).realFormat = R;
})();
