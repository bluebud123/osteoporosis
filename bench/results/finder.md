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
- exact 87%
- act sensitivity 92% (11/12)
- act PPV 100%
- fractures surfaced to a human 12/12
- silently dismissed 0
- unverifiable outputs 0

### Confusion matrix (rows = label, columns = finder)

| label \ finder | act | review | no |
| --- | --- | --- | --- |
| act | 11 | 1 | 0 |
| review | 0 | 0 | 1 |
| no | 0 | 0 | 2 |

### Disagreements

| ID | Label | Finder | Reason | Report |
| --- | --- | --- | --- | --- |
| S03 | act | review | Height loss or wedging without a stated fracture | The T12 vertebral body demonstrates 40% reduction in anterior height consistent with an osteoporotic insufficiency injury. |
| S13 | review | no | No fracture documented | Wedge-shaped T11, likely longstanding Scheuermann type change rather than fracture. |

