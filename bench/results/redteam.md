# Red-team finder results (clinician probes, docs/redteam/clinician.md)

_Set written from the reviewer's probes, not blind; labels were fixed before any change to src/finder.js and were not changed afterwards. Synthetic reports. Gated: silently dismissed = 0 and unverifiable = 0._

_Notes: RT07 (trauma stated in the sentence after the fracture) was labelled review before the fix. The rule now treats a current, non-historical mechanism as high-energy for this episode (the same rule that keeps dev R071 to R076 and R094 as no and keeps loop L25 passing), so RT07 gives no. The label and the rule disagree, and a clinician should decide which is right. The dev set went from 98% to 91% exact in an earlier draft of the fix because trauma elsewhere went to review; the current rule restores 98%._

## Run: first-run

- reports 41
- exact 49%
- act sensitivity 30% (6/20)
- act PPV 60%
- fractures surfaced to a human 8/20
- silently dismissed 12
- unverifiable outputs 1

| label \ finder | act | review | no |
| --- | --- | --- | --- |
| act | 6 | 2 | 12 |
| review | 4 | 3 | 2 |
| no | 0 | 1 | 11 |

| ID | Label | Finder | Reason | Report |
| --- | --- | --- | --- | --- |
| RT01 | act | no | High-energy trauma: not a fragility fracture | History: road traffic accident 1998. Current: L1 wedge fracture, osteoporotic pattern. |
| RT02 | act | no | High-energy trauma: not a fragility fracture | Lumbar spine: compression fracture L1 (acute, marrow oedema). Ref: MVA 2010. |
| RT04 | act | no | High-energy trauma: not a fragility fracture | Old MVA 2010 noted. Fracture of T12 with 30% height loss, osteoporotic. |
| RT07 | review | no | High-energy trauma: not a fragility fracture | Left femoral neck fracture, displaced. Patient was involved in a road traffic accident yesterday. |
| RT08 | act | no | High-energy trauma: not a fragility fracture | Compression fracture T9. Previous pedestrian injury 2009. |
| RT09 | review | act | Fragility fracture documented (vert) | Myeloma screen: lytic lesion at T7. Compression deformity of T7. |
| RT10 | review | act | Fragility fracture documented (vert) | Fracture of L2 vertebral body; metastatic disease is known in the history. |
| RT15 | act | no | No fracture documented | Left femoral neck fracture, not seen on right. |
| RT20 | act | no | No fracture documented | Interval progression of L1 compression, now 50%. |
| RT21 | act | no | No fracture documented | Status post ORIF of left neck of femur (2015). |
| RT22 | act | no | No fracture documented | Comminuted # distal radius |
| RT23 | act | no | No fracture documented | Vertebra plana at T9. |
| RT24 | act | no | No fracture documented | Bilateral pubic rami #s. |
| RT25 | act | review | Fracture site unclear | # NOF left. |
| RT26 | act | review | Bone-density wording but no recognised fracture term | Old VP at T9, osteoporotic. |
| RT28 | review | no | No fracture documented | Cemented left hemiarthroplasty in situ. |
| RT29 | act | no | No fracture documented | DHS in situ left hip. |
| RT30 | act | no | No fracture documented | Compression at L3 with 25% anterior height reduction. |
| RT33 | review | act | Fragility fracture documented (vert) | Cannot exclude L1 fracture. |
| RT34 | review | act | Fragility fracture documented (vert) | Fracture not excluded at L1. |
| RT40 | no | review | Fracture site unclear (UNVERIFIED: no un-negated fracture, deformity, height-loss or bone-density statement in the quoted evidence) | Lung collapse excluded. Renal insufficiency noted. |

## Run: after-fix

- reports 41
- exact 98%
- act sensitivity 100% (20/20)
- act PPV 100%
- fractures surfaced to a human 20/20
- silently dismissed 0
- unverifiable outputs 0

| label \ finder | act | review | no |
| --- | --- | --- | --- |
| act | 20 | 0 | 0 |
| review | 0 | 8 | 1 |
| no | 0 | 0 | 12 |

| ID | Label | Finder | Reason | Report |
| --- | --- | --- | --- | --- |
| RT07 | review | no | High-energy trauma (current mechanism): not a fragility fracture | Left femoral neck fracture, displaced. Patient was involved in a road traffic accident yesterday. |

## Run: current

- reports 41
- exact 98%
- act sensitivity 100% (20/20)
- act PPV 100%
- fractures surfaced to a human 20/20
- silently dismissed 0
- unverifiable outputs 0

| label \ finder | act | review | no |
| --- | --- | --- | --- |
| act | 20 | 0 | 0 |
| review | 0 | 8 | 1 |
| no | 0 | 0 | 12 |

| ID | Label | Finder | Reason | Report |
| --- | --- | --- | --- | --- |
| RT07 | review | no | High-energy trauma (current mechanism): not a fragility fracture | Left femoral neck fracture, displaced. Patient was involved in a road traffic accident yesterday. |

