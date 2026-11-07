/*
 * Red-team set for the case finder. Written from the clinician and FLS lead's probes (docs/redteam/clinician.md:
 * B4, B5, M13) plus further cases the reviewer's wording suggests. NOT blind: the author saw the probes and the
 * baseline finder before writing these. It is a regression set for the defects, not an external measure.
 * Labels were fixed by clinical reasoning BEFORE any change to src/finder.js, and were not changed afterwards.
 * DRAFT labels pending clinical lead sign-off. All reports are synthetic.
 *
 * label:
 *   'act'    — definite fragility fracture (hip, vertebra, distal radius, proximal humerus, pelvis), age 50+,
 *              low or unstated trauma, not pathological. Old fractures, healed fractures, height loss with an
 *              osteoporotic pattern, and evidence of past fracture surgery all count.
 *   'review' — a human should look: hedged, negation that does not clearly cover the fracture, pathology or
 *              high-energy trauma in another sentence, minor site, ambiguous abbreviation.
 *   'no'     — no fracture, the fracture is clearly negated, or the fracture sentence itself names high-energy
 *              trauma or pathology for this episode, or the term is not a fracture (cord or nerve compression).
 * site: vert | hip | wrist | humerus | pelvis | other | null
 */
(function () {
const R = [
  // ---------- Trauma word in history or a reference, not in the current fracture (B4) ----------
  { id: 'RT01', age: 74, sex: 'F', mod: 'XR lumbar spine', ind: 'Back pain', text: 'History: road traffic accident 1998. Current: L1 wedge fracture, osteoporotic pattern.', label: 'act', site: 'vert' },
  { id: 'RT02', age: 70, sex: 'F', mod: 'MRI lumbar spine', ind: 'Back pain', text: 'Lumbar spine: compression fracture L1 (acute, marrow oedema). Ref: MVA 2010.', label: 'act', site: 'vert' },
  { id: 'RT03', age: 78, sex: 'F', mod: 'XR hip', ind: 'Fall', text: 'Right femoral neck fracture after high-speed motor vehicle collision today.', label: 'no', site: 'hip' },
  { id: 'RT04', age: 72, sex: 'F', mod: 'XR thoracic spine', ind: 'Back pain', text: 'Old MVA 2010 noted. Fracture of T12 with 30% height loss, osteoporotic.', label: 'act', site: 'vert' },
  { id: 'RT05', age: 72, sex: 'F', mod: 'XR lumbar spine', ind: 'Back pain', text: 'Vertebral fracture L2 following a fall from a height of 4 metres.', label: 'no', site: 'vert' },
  { id: 'RT06', age: 81, sex: 'F', mod: 'XR lumbar spine', ind: 'Back pain', text: 'Fracture of L2 after a trivial fall from standing height.', label: 'act', site: 'vert' },
  { id: 'RT07', age: 80, sex: 'F', mod: 'XR hip', ind: 'Hip pain', text: 'Left femoral neck fracture, displaced. Patient was involved in a road traffic accident yesterday.', label: 'review', site: 'hip' },
  { id: 'RT08', age: 76, sex: 'F', mod: 'XR thoracic spine', ind: 'Pain', text: 'Compression fracture T9. Previous pedestrian injury 2009.', label: 'act', site: 'vert' },

  // ---------- Pathology in the report (B4, M13) ----------
  { id: 'RT09', age: 68, sex: 'F', mod: 'MRI spine', ind: 'Myeloma screen', text: 'Myeloma screen: lytic lesion at T7. Compression deformity of T7.', label: 'review', site: 'vert' },
  { id: 'RT10', age: 71, sex: 'F', mod: 'XR lumbar spine', ind: 'Back pain', text: 'Fracture of L2 vertebral body; metastatic disease is known in the history.', label: 'review', site: 'vert' },
  { id: 'RT11', age: 70, sex: 'F', mod: 'CT spine', ind: 'Back pain', text: 'Pathological fracture of T12 due to myeloma.', label: 'no', site: null },
  { id: 'RT12', age: 79, sex: 'F', mod: 'XR hip', ind: 'Hip pain', text: 'Pathological fracture of the femoral neck secondary to metastatic breast carcinoma.', label: 'no', site: null },
  { id: 'RT13', age: 66, sex: 'F', mod: 'CT chest', ind: 'Staging', text: 'Lytic lesion at T7 consistent with myeloma. No fracture.', label: 'no', site: null },
  { id: 'RT14', age: 73, sex: 'F', mod: 'CT chest', ind: 'Lung nodule', text: 'Osteoporotic compression fracture of L1. Incidental 1 cm lung nodule; no metastatic disease identified.', label: 'act', site: 'vert' },

  // ---------- Negation that must attach to one side or one fracture (B5, item 3) ----------
  { id: 'RT15', age: 78, sex: 'F', mod: 'XR hip', ind: 'Hip pain', text: 'Left femoral neck fracture, not seen on right.', label: 'act', site: 'hip' },
  { id: 'RT16', age: 75, sex: 'F', mod: 'XR hip', ind: 'Hip pain', text: 'Right femoral neck fracture not seen; left neck of femur intact.', label: 'no', site: null },
  { id: 'RT17', age: 84, sex: 'F', mod: 'XR pelvis', ind: 'Fall', text: 'No fracture of the right hip. Left intertrochanteric fracture.', label: 'act', site: 'hip' },
  { id: 'RT18', age: 80, sex: 'F', mod: 'XR hip', ind: 'Fall', text: 'Fracture not seen on right; there is a displaced left subcapital fracture.', label: 'act', site: 'hip' },
  { id: 'RT19', age: 69, sex: 'F', mod: 'XR shoulder', ind: 'Shoulder pain', text: 'Right humerus: no fracture. Left proximal humerus fracture, displaced.', label: 'act', site: 'humerus' },

  // ---------- Clinical shorthand and patterns (B5, item 4) ----------
  { id: 'RT20', age: 76, sex: 'F', mod: 'XR lumbar spine', ind: 'Follow-up', text: 'Interval progression of L1 compression, now 50%.', label: 'act', site: 'vert' },
  { id: 'RT21', age: 80, sex: 'F', mod: 'XR hip', ind: 'Follow-up', text: 'Status post ORIF of left neck of femur (2015).', label: 'act', site: 'hip' },
  { id: 'RT22', age: 66, sex: 'F', mod: 'XR wrist', ind: 'FOOSH', text: 'Comminuted # distal radius', label: 'act', site: 'wrist' },
  { id: 'RT23', age: 72, sex: 'F', mod: 'XR thoracic spine', ind: 'Back pain', text: 'Vertebra plana at T9.', label: 'act', site: 'vert' },
  { id: 'RT24', age: 77, sex: 'F', mod: 'XR pelvis', ind: 'Groin pain', text: 'Bilateral pubic rami #s.', label: 'act', site: 'pelvis' },
  { id: 'RT25', age: 83, sex: 'F', mod: 'XR hip', ind: 'Hip pain', text: '# NOF left.', label: 'act', site: 'hip' },
  { id: 'RT26', age: 72, sex: 'F', mod: 'XR thoracic spine', ind: 'Back pain', text: 'Old VP at T9, osteoporotic.', label: 'act', site: 'vert' },
  { id: 'RT27', age: 81, sex: 'F', mod: 'XR hip', ind: 'Follow-up', text: 'Hemiarthroplasty left hip, previous neck of femur fracture.', label: 'act', site: 'hip' },
  { id: 'RT28', age: 79, sex: 'F', mod: 'XR hip', ind: 'Follow-up', text: 'Cemented left hemiarthroplasty in situ.', label: 'review', site: 'hip' },
  { id: 'RT29', age: 85, sex: 'F', mod: 'XR hip', ind: 'Follow-up', text: 'DHS in situ left hip.', label: 'act', site: 'hip' },
  { id: 'RT30', age: 74, sex: 'F', mod: 'XR thoracic spine', ind: 'Back pain', text: 'Compression at L3 with 25% anterior height reduction.', label: 'act', site: 'vert' },
  { id: 'RT31', age: 58, sex: 'F', mod: 'MRI cervical spine', ind: 'Neck pain', text: 'Compression of the spinal cord at C5 by disc prolapse.', label: 'no', site: null },
  { id: 'RT32', age: 61, sex: 'F', mod: 'MRI lumbar spine', ind: 'Leg pain', text: 'Compression of L4 nerve root by facet hypertrophy.', label: 'no', site: null },

  // ---------- Over-calls: hedged and negated wording (M13, B5) ----------
  { id: 'RT33', age: 72, sex: 'F', mod: 'XR lumbar spine', ind: 'Back pain', text: 'Cannot exclude L1 fracture.', label: 'review', site: 'vert' },
  { id: 'RT34', age: 70, sex: 'F', mod: 'XR lumbar spine', ind: 'Back pain', text: 'Fracture not excluded at L1.', label: 'review', site: 'vert' },
  { id: 'RT35', age: 70, sex: 'F', mod: 'XR lumbar spine', ind: 'Back pain', text: 'Fracture has been excluded at L1.', label: 'no', site: null },
  { id: 'RT36', age: 67, sex: 'F', mod: 'XR thoracic spine', ind: 'Back pain', text: 'Wedge-shaped T11, likely longstanding Scheuermann type change rather than fracture.', label: 'no', site: null },
  { id: 'RT37', age: 69, sex: 'F', mod: 'XR thoracic spine', ind: 'Back pain', text: 'Mild wedging of T10 may represent a developmental change; fracture not entirely excluded.', label: 'review', site: 'vert' },

  // ---------- Minor sites and no-fracture controls ----------
  { id: 'RT38', age: 70, sex: 'F', mod: 'XR ankle', ind: 'Fall', text: 'Undisplaced fracture of the left ankle after a trivial fall.', label: 'review', site: 'other' },
  { id: 'RT39', age: 72, sex: 'F', mod: 'XR chest', ind: 'Fall', text: 'Right rib fractures 4 to 6 after minor trauma.', label: 'review', site: 'other' },
  { id: 'RT40', age: 64, sex: 'F', mod: 'CT chest', ind: 'Cough', text: 'Lung collapse excluded. Renal insufficiency noted.', label: 'no', site: null },
  { id: 'RT41', age: 62, sex: 'F', mod: 'XR lumbar spine', ind: 'Back pain', text: 'Lumbar spine: no fracture or height loss. Degenerate disc changes at L4-5.', label: 'no', site: null }
];
if (typeof module !== 'undefined' && module.exports) module.exports = R;
else (window.OsteoReports = window.OsteoReports || {}).redteam = R;
})();
