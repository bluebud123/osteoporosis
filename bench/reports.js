/*
 * Synthetic radiology reports for the case finder. Fictional; written by hand to mimic real report language.
 * DRAFT LABELS pending clinical lead sign-off.
 *
 * label:
 *   'act'    — a fragility fracture is documented: hip, vertebral, distal radius, proximal humerus or pelvis/sacrum,
 *              age 50+, low or unstated trauma, not pathological, stated definitely. Old fractures count
 *              (a prior fragility fracture at any time is an indication for assessment).
 *              Includes evidence of a past fracture (vertebroplasty, hemiarthroplasty for neck of femur fracture).
 *   'review' — needs a human: hedged language, borderline wedging, osteopenia only, rib or other minor-site
 *              low-trauma fracture, fracture under 50 without trauma, or trauma level unclear.
 *   'no'     — no fracture, negated, high-energy trauma, pathological (tumour), degenerative only, Schmorl's nodes.
 * site: vert | hip | wrist | humerus | pelvis | other | null
 */
(function () {
const R = [
  // ---------- ACT: incidental vertebral fractures on non-spine studies (the classic missed case) ----------
  { id: 'R001', age: 71, sex: 'F', mod: 'CXR lateral', ind: 'Cough', text: 'Lungs are clear. No pleural effusion. Incidental moderate wedge compression fracture of T8 with approximately 35% anterior height loss.', label: 'act', site: 'vert' },
  { id: 'R002', age: 68, sex: 'F', mod: 'CT abdomen/pelvis', ind: 'Abdominal pain', text: 'No acute intra-abdominal pathology. Appendix normal. Incidental note of an L1 compression fracture, age indeterminate.', label: 'act', site: 'vert' },
  { id: 'R003', age: 77, sex: 'F', mod: 'CT chest', ind: 'Pulmonary nodule follow-up', text: 'Stable 4 mm nodule in the right upper lobe. Bones: biconcave deformity of T11 and T12 vertebral bodies consistent with osteoporotic fractures.', label: 'act', site: 'vert' },
  { id: 'R004', age: 64, sex: 'F', mod: 'CXR lateral', ind: 'Pre-operative', text: 'Heart size normal. Lungs clear. There is loss of height of the T7 vertebral body in keeping with a compression fracture.', label: 'act', site: 'vert' },
  { id: 'R005', age: 82, sex: 'F', mod: 'CT abdomen', ind: 'Renal colic', text: 'Left 5 mm vesicoureteric junction calculus with mild hydronephrosis. Old healed L2 vertebral compression fracture.', label: 'act', site: 'vert' },
  { id: 'R006', age: 73, sex: 'M', mod: 'CT chest/abdomen', ind: 'Weight loss', text: 'No mass identified. Diffuse osteopenia. Crush fracture of T12 with approximately 50% height loss; no retropulsion. No lytic or sclerotic lesion.', label: 'act', site: 'vert' },
  { id: 'R007', age: 69, sex: 'F', mod: 'CT KUB', ind: 'Haematuria', text: 'No urinary tract calculus. Incidentally, there is a wedge fracture of L1.', label: 'act', site: 'vert' },
  { id: 'R008', age: 75, sex: 'F', mod: 'CXR', ind: 'Shortness of breath', text: 'Mild cardiomegaly. Small bilateral effusions. Exaggerated thoracic kyphosis with multiple mid-thoracic vertebral compression fractures.', label: 'act', site: 'vert' },
  { id: 'R009', age: 66, sex: 'F', mod: 'CT pulmonary angiogram', ind: 'Chest pain', text: 'No pulmonary embolism. Superior endplate fracture of T9 with mild height loss, likely osteoporotic.', label: 'act', site: 'vert' },
  { id: 'R010', age: 80, sex: 'F', mod: 'CT abdomen/pelvis', ind: 'Constipation', text: 'Faecal loading. No obstruction. Vertebral bodies: L3 is collapsed. No aggressive features.', label: 'act', site: 'vert' },

  // ---------- ACT: spine studies ----------
  { id: 'R011', age: 72, sex: 'F', mod: 'XR lumbar spine', ind: 'Back pain after lifting', text: 'Acute-appearing compression fracture of L2 with 25% loss of anterior height. Degenerative changes at L4-5.', label: 'act', site: 'vert' },
  { id: 'R012', age: 78, sex: 'F', mod: 'XR thoracic spine', ind: 'Back pain, no trauma', text: 'Wedge fractures of T6 and T8. Generalised reduction in bone density.', label: 'act', site: 'vert' },
  { id: 'R013', age: 63, sex: 'F', mod: 'MRI lumbar spine', ind: 'Sudden back pain', text: 'Bone marrow oedema within L1 with superior endplate depression in keeping with an acute osteoporotic compression fracture. No soft tissue mass.', label: 'act', site: 'vert' },
  { id: 'R014', age: 70, sex: 'F', mod: 'XR lumbar spine', ind: 'Chronic back pain', text: 'Status post vertebroplasty at L1. Cement within the vertebral body. No new fracture.', label: 'act', site: 'vert' },
  { id: 'R015', age: 74, sex: 'M', mod: 'XR thoracolumbar spine', ind: 'Height loss', text: 'Anterior wedging of T12 with approximately 30% height loss, consistent with fracture. Osteopenic bones.', label: 'act', site: 'vert' },
  { id: 'R016', age: 67, sex: 'F', mod: 'CT lumbar spine', ind: 'Fall from standing', text: 'Fall from standing height. Burst-type pattern absent; there is a compression fracture of L4 superior endplate.', label: 'act', site: 'vert' },
  { id: 'R017', age: 85, sex: 'F', mod: 'XR thoracic spine', ind: 'Kyphosis', text: 'Grade 3 wedge deformity of T10. Grade 2 deformity of T11. Appearances consistent with osteoporotic vertebral fractures.', label: 'act', site: 'vert' },

  // ---------- ACT: hip ----------
  { id: 'R018', age: 81, sex: 'F', mod: 'XR pelvis and hip', ind: 'Fall at home, unable to weight bear', text: 'Displaced subcapital fracture of the left neck of femur.', label: 'act', site: 'hip' },
  { id: 'R019', age: 76, sex: 'M', mod: 'XR hip', ind: 'Slipped in bathroom', text: 'Intertrochanteric fracture of the right femur with varus angulation.', label: 'act', site: 'hip' },
  { id: 'R020', age: 79, sex: 'F', mod: 'XR pelvis', ind: 'Routine follow-up', text: 'Right hemiarthroplasty in satisfactory position, performed for previous neck of femur fracture. No periprosthetic lucency.', label: 'act', site: 'hip' },
  { id: 'R021', age: 84, sex: 'F', mod: 'XR hip', ind: 'Post-op check', text: 'Dynamic hip screw fixation of a left intertrochanteric fracture. Alignment maintained.', label: 'act', site: 'hip' },
  { id: 'R022', age: 70, sex: 'F', mod: 'MRI hip', ind: 'Hip pain, normal X-ray', text: 'Undisplaced fracture of the right femoral neck, occult on radiographs. No avascular necrosis.', label: 'act', site: 'hip' },
  { id: 'R023', age: 88, sex: 'F', mod: 'CT hip', ind: 'Fall from chair', text: 'Minimally displaced fracture of the greater trochanter extending intertrochanterically.', label: 'act', site: 'hip' },

  // ---------- ACT: wrist, humerus, pelvis ----------
  { id: 'R024', age: 62, sex: 'F', mod: 'XR wrist', ind: 'Fall on outstretched hand', text: 'Dorsally angulated fracture of the distal radius (Colles type) with ulnar styloid fracture.', label: 'act', site: 'wrist' },
  { id: 'R025', age: 58, sex: 'F', mod: 'XR wrist', ind: 'Tripped on pavement', text: 'Intra-articular distal radius fracture. Mild shortening.', label: 'act', site: 'wrist' },
  { id: 'R026', age: 73, sex: 'F', mod: 'XR shoulder', ind: 'Fall at home', text: 'Two-part fracture of the surgical neck of the left humerus.', label: 'act', site: 'humerus' },
  { id: 'R027', age: 69, sex: 'M', mod: 'XR shoulder', ind: 'Fall from standing', text: 'Impacted fracture of the proximal humerus involving the greater tuberosity.', label: 'act', site: 'humerus' },
  { id: 'R028', age: 80, sex: 'F', mod: 'XR pelvis', ind: 'Groin pain after fall', text: 'Fractures of the right superior and inferior pubic rami.', label: 'act', site: 'pelvis' },
  { id: 'R029', age: 76, sex: 'F', mod: 'MRI pelvis', ind: 'Low back and buttock pain', text: 'Bilateral sacral insufficiency fractures with surrounding marrow oedema.', label: 'act', site: 'pelvis' },
  { id: 'R030', age: 65, sex: 'F', mod: 'XR wrist', ind: 'Follow-up', text: 'Healing distal radius fracture with callus formation. Position unchanged.', label: 'act', site: 'wrist' },
  { id: 'R031', age: 71, sex: 'F', mod: 'CT pelvis', ind: 'Hip pain', text: 'No femoral neck fracture. There is an undisplaced fracture of the left pubic ramus.', label: 'act', site: 'pelvis' },
  { id: 'R032', age: 83, sex: 'F', mod: 'XR shoulder', ind: 'Pain after fall', text: 'Comminuted proximal humeral fracture. Glenohumeral joint is congruent.', label: 'act', site: 'humerus' },
  { id: 'R033', age: 60, sex: 'F', mod: 'XR forearm', ind: 'Fell while walking', text: 'Fracture of the distal radial metaphysis with dorsal tilt of 20 degrees.', label: 'act', site: 'wrist' },
  { id: 'R034', age: 66, sex: 'M', mod: 'CT chest', ind: 'Staging, lymphoma in remission', text: 'No lymphadenopathy. Known previous T5 compression fracture, unchanged. No new osseous lesion.', label: 'act', site: 'vert' },
  { id: 'R035', age: 74, sex: 'F', mod: 'XR knee', ind: 'Knee pain', text: 'Moderate medial compartment osteoarthritis. Incidental healed fracture of the proximal humerus noted on prior shoulder film referenced in history.', label: 'review', site: 'humerus' },

  // ---------- REVIEW: hedged, borderline, minor sites ----------
  { id: 'R036', age: 70, sex: 'F', mod: 'CXR lateral', ind: 'Fever', text: 'Right lower lobe consolidation. Possible mild wedging of T9, of uncertain significance.', label: 'review', site: 'vert' },
  { id: 'R037', age: 67, sex: 'F', mod: 'CT abdomen', ind: 'Pain', text: 'Mild anterior wedging of T12, may be developmental or represent a mild compression deformity.', label: 'review', site: 'vert' },
  { id: 'R038', age: 72, sex: 'F', mod: 'XR lumbar spine', ind: 'Back pain', text: 'Osteopenia. Vertebral heights are preserved. Multilevel degenerative disc disease.', label: 'review', site: null },
  { id: 'R039', age: 79, sex: 'F', mod: 'CXR', ind: 'Chest pain after coughing fit', text: 'Fracture of the right 7th rib laterally. No pneumothorax.', label: 'review', site: 'other' },
  { id: 'R040', age: 64, sex: 'F', mod: 'XR hip', ind: 'Hip pain', text: 'Subtle lucency at the femoral neck; an undisplaced fracture cannot be excluded. Suggest MRI.', label: 'review', site: 'hip' },
  { id: 'R041', age: 45, sex: 'F', mod: 'XR lumbar spine', ind: 'Back pain, no injury', text: 'Compression fracture of L1 with 20% height loss.', label: 'review', site: 'vert' },
  { id: 'R042', age: 69, sex: 'F', mod: 'CT chest', ind: 'Cough', text: 'Query compression fracture at T6, suboptimally assessed on this study.', label: 'review', site: 'vert' },
  { id: 'R043', age: 75, sex: 'M', mod: 'XR wrist', ind: 'Wrist pain after fall', text: 'Possible undisplaced scaphoid fracture. Distal radius intact. Recommend repeat imaging.', label: 'review', site: 'other' },
  { id: 'R044', age: 81, sex: 'F', mod: 'XR ankle', ind: 'Twisted ankle', text: 'Undisplaced fracture of the lateral malleolus.', label: 'review', site: 'other' },
  { id: 'R045', age: 73, sex: 'F', mod: 'CXR lateral', ind: 'Pre-op', text: 'Slight loss of height of the T8 vertebral body. Correlate clinically.', label: 'review', site: 'vert' },
  { id: 'R046', age: 68, sex: 'F', mod: 'XR thoracic spine', ind: 'Pain', text: 'Generalised osteopenia. Appearance may represent early compression of T10.', label: 'review', site: 'vert' },
  { id: 'R047', age: 70, sex: 'F', mod: 'XR shoulder', ind: 'Shoulder pain', text: 'Suspicious for an undisplaced greater tuberosity fracture. Consider ultrasound or MRI.', label: 'review', site: 'humerus' },
  { id: 'R048', age: 86, sex: 'F', mod: 'CXR', ind: 'Fall', text: 'Multiple old healed left rib fractures. No acute fracture. Lungs clear.', label: 'review', site: 'other' },
  { id: 'R049', age: 62, sex: 'F', mod: 'DXA lateral VFA', ind: 'Osteoporosis assessment', text: 'Vertebral fracture assessment: possible grade 1 deformity at T7. No definite fracture.', label: 'review', site: 'vert' },
  { id: 'R050', age: 77, sex: 'F', mod: 'XR foot', ind: 'Foot pain after walking', text: 'Stress fracture of the second metatarsal shaft with periosteal reaction.', label: 'review', site: 'other' },
  { id: 'R051', age: 59, sex: 'M', mod: 'XR wrist', ind: 'Fall', text: 'Distal radius fracture. Mechanism not stated.', label: 'act', site: 'wrist' },
  { id: 'R052', age: 72, sex: 'F', mod: 'CT abdomen', ind: 'Pain', text: 'Reduced height of L2 compared with adjacent levels, likely chronic.', label: 'review', site: 'vert' },

  // ---------- NO: negated / normal ----------
  { id: 'R053', age: 70, sex: 'F', mod: 'XR lumbar spine', ind: 'Back pain', text: 'No vertebral fracture. Vertebral body heights are maintained. Mild facet arthropathy.', label: 'no', site: null },
  { id: 'R054', age: 78, sex: 'F', mod: 'XR hip', ind: 'Fall, hip pain', text: 'No fracture of the proximal femur. Hip joint space preserved.', label: 'no', site: null },
  { id: 'R055', age: 66, sex: 'F', mod: 'CXR', ind: 'Cough', text: 'Lungs clear. No rib fracture or pneumothorax.', label: 'no', site: null },
  { id: 'R056', age: 73, sex: 'F', mod: 'XR wrist', ind: 'Fall on hand', text: 'No acute fracture or dislocation. Soft tissue swelling over the dorsum.', label: 'no', site: null },
  { id: 'R057', age: 81, sex: 'F', mod: 'CT head', ind: 'Fall', text: 'No intracranial haemorrhage. No skull fracture.', label: 'no', site: null },
  { id: 'R058', age: 69, sex: 'F', mod: 'CT abdomen/pelvis', ind: 'Diverticulitis', text: 'Sigmoid diverticulitis without abscess. Bones: no fracture or destructive lesion.', label: 'no', site: null },
  { id: 'R059', age: 75, sex: 'F', mod: 'MRI lumbar spine', ind: 'Sciatica', text: 'L4-5 disc protrusion compressing the left L5 nerve root. Vertebral body heights normal; no compression fracture.', label: 'no', site: null },
  { id: 'R060', age: 62, sex: 'F', mod: 'XR shoulder', ind: 'Pain', text: 'Calcific tendinopathy of supraspinatus. No fracture.', label: 'no', site: null },
  { id: 'R061', age: 71, sex: 'F', mod: 'XR pelvis', ind: 'Hip pain', text: 'Bilateral hip osteoarthritis. Fracture is not identified.', label: 'no', site: null },
  { id: 'R062', age: 80, sex: 'F', mod: 'CT thoracic spine', ind: 'Fall', text: 'Negative for acute fracture. Diffuse idiopathic skeletal hyperostosis.', label: 'no', site: null },
  { id: 'R063', age: 67, sex: 'M', mod: 'CXR', ind: 'Pre-op', text: 'Normal chest radiograph.', label: 'no', site: null },
  { id: 'R064', age: 74, sex: 'F', mod: 'XR knee', ind: 'Knee pain', text: 'Tricompartmental osteoarthritis. No fracture.', label: 'no', site: null },
  { id: 'R065', age: 77, sex: 'F', mod: 'CT pelvis', ind: 'Fall', text: 'No evidence of pelvic or proximal femoral fracture.', label: 'no', site: null },
  { id: 'R066', age: 68, sex: 'F', mod: 'XR thoracic spine', ind: 'Pain', text: 'Thoracic vertebrae of normal height and alignment. Schmorl\'s nodes at T9 and T10.', label: 'no', site: null },
  { id: 'R067', age: 72, sex: 'F', mod: 'XR lumbar spine', ind: 'Pain', text: 'Endplate sclerosis and osteophytes at L3-4 and L4-5 consistent with degenerative change. No compression deformity.', label: 'no', site: null },
  { id: 'R068', age: 63, sex: 'F', mod: 'XR wrist', ind: 'Follow-up', text: 'Previous distal radius fracture has united with no residual deformity.', label: 'act', site: 'wrist' },
  { id: 'R069', age: 70, sex: 'F', mod: 'CT abdomen', ind: 'Pain', text: 'Fracture of the vertebral bodies has been excluded. Bowel unremarkable.', label: 'no', site: null },
  { id: 'R070', age: 79, sex: 'F', mod: 'CXR lateral', ind: 'Breathlessness', text: 'Pulmonary oedema. Thoracic spine shows no evidence of compression fracture.', label: 'no', site: null },

  // ---------- NO: high-energy trauma ----------
  { id: 'R071', age: 55, sex: 'M', mod: 'CT spine', ind: 'Motor vehicle accident', text: 'High-speed motor vehicle collision. Burst fracture of L1 with retropulsion.', label: 'no', site: 'vert' },
  { id: 'R072', age: 52, sex: 'M', mod: 'XR wrist', ind: 'Fall from ladder', text: 'Fall from height of 3 metres. Comminuted distal radius fracture.', label: 'no', site: 'wrist' },
  { id: 'R073', age: 61, sex: 'F', mod: 'XR pelvis', ind: 'Road traffic accident', text: 'Pedestrian struck by car. Fractures of the left superior and inferior pubic rami and sacral ala.', label: 'no', site: 'pelvis' },
  { id: 'R074', age: 58, sex: 'M', mod: 'CT thoracic spine', ind: 'Fall from scaffolding', text: 'Fall from scaffolding. Chance fracture of T11.', label: 'no', site: 'vert' },
  { id: 'R075', age: 65, sex: 'M', mod: 'XR shoulder', ind: 'Motorcycle accident', text: 'Motorcycle accident. Displaced proximal humeral fracture.', label: 'no', site: 'humerus' },
  { id: 'R076', age: 50, sex: 'F', mod: 'XR hip', ind: 'RTA', text: 'Road traffic accident. Posterior wall acetabular fracture with hip dislocation.', label: 'no', site: 'hip' },

  // ---------- NO: pathological ----------
  { id: 'R077', age: 69, sex: 'F', mod: 'CT spine', ind: 'Known breast cancer', text: 'Pathological fracture of T10 through a lytic metastasis.', label: 'no', site: 'vert' },
  { id: 'R078', age: 72, sex: 'M', mod: 'MRI spine', ind: 'Myeloma', text: 'Multiple myeloma deposits with collapse of L3 secondary to tumour infiltration.', label: 'no', site: 'vert' },
  { id: 'R079', age: 66, sex: 'F', mod: 'XR femur', ind: 'Thigh pain', text: 'Lytic lesion in the proximal femur with a pathological fracture. Suspicious for metastasis.', label: 'no', site: 'hip' },
  { id: 'R080', age: 75, sex: 'M', mod: 'CT abdomen', ind: 'Prostate cancer staging', text: 'Sclerotic metastases throughout the lumbar spine with collapse of L2 due to metastatic disease.', label: 'no', site: 'vert' },

  // ---------- Mixed / tricky ----------
  { id: 'R081', age: 74, sex: 'F', mod: 'XR lumbar spine', ind: 'Back pain', text: 'No new fracture. Stable old compression fracture of L1.', label: 'act', site: 'vert' },
  { id: 'R082', age: 70, sex: 'F', mod: 'CT chest', ind: 'Follow-up', text: 'No pulmonary embolus. No acute rib fracture. Chronic T8 wedge compression deformity again noted.', label: 'act', site: 'vert' },
  { id: 'R083', age: 68, sex: 'F', mod: 'XR hip', ind: 'Pain', text: 'No fracture of the right hip. Left total hip replacement for osteoarthritis.', label: 'no', site: null },
  { id: 'R084', age: 80, sex: 'F', mod: 'XR pelvis', ind: 'Fall from bed', text: 'Fall from bed. Undisplaced fracture of the left inferior pubic ramus.', label: 'act', site: 'pelvis' },
  { id: 'R085', age: 57, sex: 'F', mod: 'XR wrist', ind: 'Fell while jogging', text: 'Undisplaced distal radius fracture.', label: 'act', site: 'wrist' },
  { id: 'R086', age: 76, sex: 'F', mod: 'CT abdomen', ind: 'Pain', text: 'Previous kyphoplasty at T12 and L1. No new vertebral fracture.', label: 'act', site: 'vert' },
  { id: 'R087', age: 73, sex: 'F', mod: 'XR thoracic spine', ind: 'Fall', text: 'Fall from standing. No acute fracture is seen; however there is a chronic wedge deformity of T6.', label: 'act', site: 'vert' },
  { id: 'R088', age: 62, sex: 'F', mod: 'XR spine', ind: 'Scoliosis follow-up', text: 'Degenerative lumbar scoliosis, Cobb angle 22 degrees. Vertebral heights preserved.', label: 'no', site: null },
  { id: 'R089', age: 79, sex: 'M', mod: 'XR hip', ind: 'Fall', text: 'Fall at home. Impacted subcapital femoral neck fracture.', label: 'act', site: 'hip' },
  { id: 'R090', age: 71, sex: 'F', mod: 'CT abdomen', ind: 'Pain', text: 'Haemangioma in the L2 vertebral body. No fracture.', label: 'no', site: null },
  { id: 'R091', age: 67, sex: 'F', mod: 'XR wrist', ind: 'Wrist pain, no injury', text: 'No fracture. Osteopenic bones.', label: 'review', site: null },
  { id: 'R092', age: 84, sex: 'F', mod: 'CXR', ind: 'Fever', text: 'Left basal consolidation. Old fracture of the right clavicle.', label: 'review', site: 'other' },
  { id: 'R093', age: 70, sex: 'F', mod: 'MRI lumbar spine', ind: 'Pain', text: 'Chronic L1 compression fracture without marrow oedema. No acute fracture.', label: 'act', site: 'vert' },
  { id: 'R094', age: 65, sex: 'M', mod: 'CT abdomen', ind: 'Trauma, fall from roof', text: 'Fall from roof. L2 compression fracture. Splenic laceration.', label: 'no', site: 'vert' },
  { id: 'R095', age: 78, sex: 'F', mod: 'XR shoulder', ind: 'Fall', text: 'Fall from standing. Fracture dislocation of the shoulder with greater tuberosity fracture.', label: 'act', site: 'humerus' },
  { id: 'R096', age: 69, sex: 'F', mod: 'XR hip', ind: 'Follow-up', text: 'Cannulated screws across a previously fractured left femoral neck. Healed.', label: 'act', site: 'hip' },
  { id: 'R097', age: 60, sex: 'F', mod: 'CT chest', ind: 'Cough', text: 'Lungs clear. Mild degenerative changes of the thoracic spine. No fracture.', label: 'no', site: null },
  { id: 'R098', age: 82, sex: 'F', mod: 'XR lumbar spine', ind: 'Pain', text: 'Severe osteoporosis with multiple lumbar compression fractures at L1, L2 and L4.', label: 'act', site: 'vert' },
  { id: 'R099', age: 74, sex: 'F', mod: 'CT abdomen', ind: 'Pain', text: 'There is no fracture of L1. Mild compression deformity of T12 is unchanged from prior.', label: 'act', site: 'vert' },
  { id: 'R100', age: 66, sex: 'F', mod: 'XR wrist', ind: 'Fall', text: 'Fracture of the distal radius cannot be confirmed; recommend repeat views.', label: 'review', site: 'wrist' }
];
if (typeof module !== 'undefined' && module.exports) module.exports = R;
else (window.OsteoReports = window.OsteoReports || {}).dev = R;
})();
