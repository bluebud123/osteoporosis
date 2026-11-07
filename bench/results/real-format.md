# Real-format reports (12)

_Reader: keyword baseline (src/finder.js) through readVerified(). Labels were written before the lexicon or any change was made for this set, and were not changed after the first run. All reports are synthetic. Not gated._

## Summary

- reports 12
- exact 75% (9/12)
- act sensitivity 71% (5/7)
- fractures surfaced to a human (act or review) 7/7
- silently dismissed (label act, finder no) 0
- act-labelled calls that were not act 1 (review or no labels called act)
- unverified reader outputs 1

- Templated, all-caps and abbreviated formats. The baseline was not changed for this set.
- Abbreviations FX and VCF, and the misspelling "compresion fracure", are not in the lexicon, and that is the point of the set.

## Confusion matrix (rows = label, columns = finder)

| label \ finder | act | review | no |
| --- | --- | --- | --- |
| act | 5 | 2 | 0 |
| review | 1 | 1 | 0 |
| no | 0 | 0 | 3 |

## Every report

| ID | Label | Finder | Verified | Reason | Report |
| --- | --- | --- | --- | --- | --- |
| RF01 | act | act | yes | Fragility fracture documented (pelvis) | EXAM: XR PELVIS. COMPARISON: NONE. TECHNIQUE: AP PELVIS. FINDINGS: 1. ACUTE LEFT SUPERIOR PUBIC RAMUS FRACTURE. 2. NO DISLOCATION. IMPRESSION: ACUTE LEFT PUBIC RAMUS FRACTURE. |
| RF02 | act | act | yes | Fragility fracture documented (hip) | TECHNIQUE: AP PELVIS AND R HIP. FINDINGS: H/O #NOF R, S/P HEMIARTHROPLASTY. NO ACUTE FRACTURE. IMPRESSION: H/O R FEMORAL NECK FRACTURE, S/P HEMIARTHROPLASTY. |
| RF03 | review | act | yes | Fragility fracture documented (vert) | FINDINGS: 1. MILD COMPRESSION DEFORMITY OF T11 VERTEBRAL BODY, APPROXIMATELY 20% HEIGHT LOSS. 2. LIVER, SPLEEN AND KIDNEYS UNREMARKABLE. IMPRESSION: NO FRACTURE. OTHERWISE UNREMARKABLE. |
| RF04 | no | no | yes | No fracture documented | LUNGS CLEAR. HEART SIZE WNL. BONES: WNL. OTHERWISE NAD. IMPRESSION: NAD. |
| RF05 | act | review | no | Unverified output: no un-negated, non-pathological fracture statement in the quoted evidence | XR R WRIST 2 VIEWS. FINDINGS: DISTAL RADIUS FX WITH DORSAL ANGULATION, NO INTRA-ARTICULAR EXTENSION. IMPRESSION: R DISTAL RADIUS FX. |
| RF06 | act | review | yes | Height loss without a stated fracture | Osteoporotic wedge compresion fracure of T7 with 25% height loss. No retropulsion. |
| RF07 | no | no | yes | No fracture documented | COMPARISON: 2019. FINDINGS: DEGENERATIVE CHANGES AT L4-L5. NO ACUTE FRACTURE OR SUBLUXATION. IMPRESSION: DEGENERATIVE CHANGES ONLY. |
| RF08 | act | act | yes | Fragility fracture documented (vert) | FINDINGS: 1. OSTEOPENIA. 2. OLD HEALED FRACTURE OF THE LEFT LATERAL 5TH RIB. 3. WEDGE DEFORMITY OF L1, 30%. IMPRESSION: STABLE LUNG NODULE. L1 WEDGE DEFORMITY. |
| RF09 | review | review | yes | Fracture site unclear | FINDINGS: SUBTLE LUCENCY ALONG THE FEMORAL NECK. CANNOT EXCLUDE NONDISPLACED FRACTURE. IMPRESSION: NO FRACTURE. |
| RF10 | act | act | yes | Fragility fracture documented (hip) | L FEMORAL NECK FRACTURE, DISPLACED. NAD ELSEWHERE IN THE PELVIS. |
| RF11 | no | no | yes | High-energy trauma: not a fragility fracture | FINDINGS: 1. RIGHT TIBIAL PLATEAU FRACTURE. 2. SMALL KNEE EFFUSION. IMPRESSION: RIGHT TIBIAL PLATEAU FRACTURE. |
| RF12 | act | act | yes | Fragility fracture documented (vert) | COMP: NONE. FINDINGS: L1 VCF (VERTEBRAL COMPRESSION FX) WITH 40% ANTERIOR HEIGHT LOSS. NO RETROPULSION. OTHERWISE WNL. IMP: L1 VCF, OSTEOPOROTIC PATTERN. |
