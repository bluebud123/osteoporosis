# Patient check-in results

Passed **27/27**. Urgent flag types exercised: P-FX12, P-NEWFX, P-ONJ, P-AFF, P-DENO.

_Draft: expected flags pending clinician sign-off._

| ID | Answers | Expected flags | Produced | Result |
| --- | --- | --- | --- | --- |
| K01 | First visit, nothing reported | – | – | PASS |
| K02 | Fracture in the last 12 months → urgent | P-FX12 | P-FX12 | PASS |
| K03 | Older fracture → confirm, DXA likely | P-FX | P-FX | PASS |
| K04 | Unsure about fracture → no flag (clinician asks) | – | – | PASS |
| K05 | Two or more falls | P-FALLS | P-FALLS | PASS |
| K06 | One fall only → no falls flag | – | – | PASS |
| K07 | Steroids plus FRAX factors grouped | P-GC, P-FRAX | P-GC, P-FRAX | PASS |
| K08 | Low BMI counts as a FRAX factor | P-FRAX | P-FRAX | PASS |
| K09 | Normal BMI → no flag | – | – | PASS |
| K10 | Height loss → vertebral assessment | P-HT | P-HT | PASS |
| K11 | Question passed to clinician | P-ASK | P-ASK | PASS |
| K12 | Blank question ignored | – | – | PASS |
| K20 | Review, all well on alendronate | – | – | PASS |
| K21 | New fracture on treatment → urgent | P-NEWFX | P-NEWFX | PASS |
| K22 | Jaw symptoms on denosumab → ONJ | P-ONJ | P-ONJ | PASS |
| K23 | Thigh pain on zoledronic acid → AFF | P-AFF | P-AFF | PASS |
| K24 | Jaw and thigh symptoms on teriparatide → no ONJ/AFF flag | – | – | PASS |
| K25 | Stopped denosumab → rebound warning, not generic stop | P-DENO | P-DENO | PASS |
| K26 | Stopped alendronate | P-STOP | P-STOP | PASS |
| K27 | Missed doses | P-MISS | P-MISS | PASS |
| K28 | Heartburn on alendronate | P-GI | P-GI | PASS |
| K29 | Heartburn on denosumab → no GI flag | – | – | PASS |
| K30 | Fall since last visit | P-RFALL | P-RFALL | PASS |
| K31 | Dental surgery planned on romosozumab | P-DENT | P-DENT | PASS |
| K32 | Not taking calcium and vitamin D | P-CAD | P-CAD | PASS |
| K33 | Several problems at once | P-NEWFX, P-ONJ, P-MISS, P-GI, P-RFALL | P-NEWFX, P-ONJ, P-MISS, P-GI, P-RFALL | PASS |
| K34 | Not started yet | P-STOP | P-STOP | PASS |
