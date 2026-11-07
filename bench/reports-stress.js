/*
 * Stress set: written AFTER the baseline finder, deliberately using wording it was not built for
 * (clinical shorthand, unusual phrasing). Not blind, but it probes how brittle keyword rules are.
 * DRAFT labels pending clinical lead sign-off. A blind set written by clinicians is still needed.
 */
(function () {
const R = [
  { id: 'S01', age: 79, sex: 'F', mod: 'XR hip', ind: 'Fall at home', text: '# NOF left, displaced.', label: 'act', site: 'hip' },
  { id: 'S02', age: 66, sex: 'F', mod: 'XR wrist', ind: 'FOOSH', text: 'Comminuted # distal radius with dorsal angulation.', label: 'act', site: 'wrist' },
  { id: 'S03', age: 74, sex: 'F', mod: 'CT abdomen', ind: 'Pain', text: 'The T12 vertebral body demonstrates 40% reduction in anterior height consistent with an osteoporotic insufficiency injury.', label: 'act', site: 'vert' },
  { id: 'S04', age: 81, sex: 'F', mod: 'XR spine', ind: 'Back pain', text: 'Osteoporotic collapse L2.', label: 'act', site: 'vert' },
  { id: 'S05', age: 70, sex: 'F', mod: 'CXR lateral', ind: 'Cough', text: 'Lungs clear. Vertebra plana at T9.', label: 'act', site: 'vert' },
  { id: 'S06', age: 68, sex: 'F', mod: 'XR shoulder', ind: 'Fell', text: 'Undisplaced #NOH.', label: 'act', site: 'humerus' },
  { id: 'S07', age: 76, sex: 'F', mod: 'CT pelvis', ind: 'Fall from standing', text: 'Bilateral pubic rami #s.', label: 'act', site: 'pelvis' },
  { id: 'S08', age: 72, sex: 'F', mod: 'XR lumbar spine', ind: 'Back pain', text: 'Interval progression of L1 compression, now 50%.', label: 'act', site: 'vert' },
  { id: 'S09', age: 69, sex: 'F', mod: 'MRI spine', ind: 'Pain', text: 'Acute osteoporotic VCF at L3 with marrow oedema.', label: 'act', site: 'vert' },
  { id: 'S10', age: 75, sex: 'F', mod: 'XR hip', ind: 'Follow-up', text: 'Left hip hemiarthroplasty in situ. History of NOF fracture 2023.', label: 'act', site: 'hip' },
  { id: 'S11', age: 73, sex: 'F', mod: 'XR wrist', ind: 'Fall', text: 'No # seen.', label: 'no', site: null },
  { id: 'S12', age: 71, sex: 'F', mod: 'CT spine', ind: 'Fall', text: 'Vertebral body heights and alignment are maintained.', label: 'no', site: null },
  { id: 'S13', age: 64, sex: 'F', mod: 'XR spine', ind: 'Pain', text: 'Wedge-shaped T11, likely longstanding Scheuermann type change rather than fracture.', label: 'review', site: 'vert' },
  { id: 'S14', age: 77, sex: 'F', mod: 'CT chest', ind: 'Follow-up', text: 'Multilevel thoracic vertebral height loss, worst at T7, appearance favours osteoporotic fractures.', label: 'act', site: 'vert' },
  { id: 'S15', age: 82, sex: 'F', mod: 'XR hip', ind: 'Fell off bicycle', text: 'Intertrochanteric fracture right femur.', label: 'act', site: 'hip' }
];
if (typeof module !== 'undefined' && module.exports) module.exports = R;
else (window.OsteoReports = window.OsteoReports || {}).stress = R;
})();
