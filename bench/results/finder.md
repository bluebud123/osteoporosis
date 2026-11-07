# Case finder results (deterministic baseline)

_Labels are drafts pending clinical lead sign-off. All reports are synthetic. A blind set written by clinicians who have not seen the rules is still needed._

## Development set (100 reports; written alongside the baseline, so the baseline is tuned to it)

- reports 100
- exact 98%
- act sensitivity 98% (47/48)
- act PPV 98%
- fractures surfaced to a human 48/48
- silently dismissed 0
- unverifiable outputs 0

### Confusion matrix (rows = label, columns = finder)

| label \ finder | act | review | no |
| --- | --- | --- | --- |
| act | 47 | 1 | 0 |
| review | 1 | 19 | 0 |
| no | 0 | 0 | 32 |

### Disagreements

| ID | Label | Finder | Reason | Report |
| --- | --- | --- | --- | --- |
| R009 | act | review | Hedged language | No pulmonary embolism. Superior endplate fracture of T9 with mild height loss, likely osteoporotic. |
| R035 | review | act | Fragility fracture documented (humerus) | Moderate medial compartment osteoarthritis. Incidental healed fracture of the proximal humerus noted on prior shoulder film referenced in history. |

## Stress set (15 reports; unfamiliar wording and clinical shorthand)

- reports 15
- exact 40%
- act sensitivity 33% (4/12)
- act PPV 100%
- fractures surfaced to a human 8/12
- silently dismissed 4
- unverifiable outputs 0

### Confusion matrix (rows = label, columns = finder)

| label \ finder | act | review | no |
| --- | --- | --- | --- |
| act | 4 | 4 | 4 |
| review | 0 | 0 | 1 |
| no | 0 | 0 | 2 |

### Disagreements

| ID | Label | Finder | Reason | Report |
| --- | --- | --- | --- | --- |
| S01 | act | review | Fracture site unclear | # NOF left, displaced. |
| S02 | act | no | No fracture documented | Comminuted # distal radius with dorsal angulation. |
| S03 | act | review | Bone-density wording but no recognised fracture term | The T12 vertebral body demonstrates 40% reduction in anterior height consistent with an osteoporotic insufficiency injury. |
| S05 | act | no | No fracture documented | Lungs clear. Vertebra plana at T9. |
| S06 | act | review | Fracture site unclear | Undisplaced #NOH. |
| S07 | act | no | No fracture documented | Bilateral pubic rami #s. |
| S08 | act | no | No fracture documented | Interval progression of L1 compression, now 50%. |
| S10 | act | review | Fracture site unclear | Left hip hemiarthroplasty in situ. History of NOF fracture 2023. |
| S13 | review | no | No fracture documented | Wedge-shaped T11, likely longstanding Scheuermann type change rather than fracture. |

