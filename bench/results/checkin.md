# Patient check-in results

Passed **83/83** (56 answer sets, 27 checks). Urgent flag types exercised: P-FX12, P-NEWFX, P-ONJ, P-AFF, P-DENO, V-LEG, V-CES, V-FEVER, V-MAL, V-FALL.

_Draft: expected flags pending clinician sign-off. Arabic and Malay wording needs native clinical review._

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
| K40 | First set, visit section quiet (no red flags, pain 4) | – | – | PASS |
| K41 | Review set, visit section quiet ("none of these") | – | – | PASS |
| K42 | New leg weakness alone → urgent, same day | V-LEG | V-LEG | PASS |
| K43 | Bladder or bowel change alone → cauda equina, urgent | V-CES | V-CES | PASS |
| K44 | Numbness around groin or buttocks alone → cauda equina, urgent | V-CES | V-CES | PASS |
| K45 | Fever or chills alone, knee site → review | V-FEVERW | V-FEVERW | PASS |
| K46 | Fever or chills with lower back pain → urgent, same day | V-FEVER | V-FEVER | PASS |
| K47 | Unexplained weight loss alone → review | V-WL | V-WL | PASS |
| K48 | Unexplained weight loss with night pain → urgent review (malignancy or myeloma), and night pain noted | V-MAL, V-NIGHT | V-MAL, V-NIGHT | PASS |
| K49 | Fall or injury today, other site → review | V-INJ | V-INJ | PASS |
| K50 | Fall today with hip pain → urgent, same day | V-FALL | V-FALL | PASS |
| K51 | Fall today with lower back pain on treatment → urgent, same day | V-FALL | V-FALL | PASS |
| K52 | Pain 10 with night pain → severe pain and night pain | V-PAIN, V-NIGHT | V-PAIN, V-NIGHT | PASS |
| K53 | Pain 10, no night pain → severe pain only | V-PAIN | V-PAIN | PASS |
| K54 | Pain 8 is at the review threshold | V-PAIN | V-PAIN | PASS |
| K55 | Pain 7 is below the threshold | – | – | PASS |
| K56 | Pain 0, walks as usual → no flag | – | – | PASS |
| K57 | Cannot walk or climb stairs → mobility review | V-WALK | V-WALK | PASS |
| K58 | Walks with difficulty → note only | V-WALK | V-WALK | PASS |
| K59 | Empty free text (complaint, medicines, worries) → no flags, no crash | – | – | PASS |
| K60 | Very long free text (5000 characters) in complaint and worries → no flags | – | – | PASS |
| K61 | HTML and script in the complaint → no flags, text kept for display only | – | – | PASS |
| K62 | Complaint mentions fracture, cauda equina and fever, but no red flag ticked → free text is not parsed | – | – | PASS |
| K63 | Pain 11 is not a valid answer → ignored | – | – | PASS |
| K64 | Red-flag option 9 does not exist → ignored | – | – | PASS |
| K65 | Three same-day flags together (bladder, fever with spine, fall with hip) | V-CES, V-FEVER, V-FALL | V-CES, V-FEVER, V-FALL | PASS |
| K66 | New leg weakness on denosumab → urgent, same day | V-LEG | V-LEG | PASS |
| K67 | Red flag plus a question for the doctor | V-CES, P-ASK | V-CES, P-ASK | PASS |
| K68 | Review set, visit section with a question left blank (optional) and no flags | – | – | PASS |

| ID | Check | Result |
| --- | --- | --- |
| N01 | normalise keeps valid scale and drops out-of-range scale | PASS |
| N02 | normalise drops answers to hidden questions (site when fracture is "no") | PASS |
| N03 | normalise keeps the answer to a question shown after a "yes" (site when fracture is "yes") | PASS |
| N04 | normalise caps free text at 1000 characters | PASS |
| N05 | normalise keeps the "None" choice for allergies | PASS |
| N06 | normalise strips control characters and trims text | PASS |
| N07 | normalise rejects a multi answer that is not a list, and sorts valid ones | PASS |
| N08 | normalise tolerates missing answers and a non-object | PASS |
| D01 | sameDay is true for cauda equina and false for weight loss alone | PASS |
| S01 | summary: red flags section comes first, then the rest in order | PASS |
| S02 | summary: every item is patient-reported | PASS |
| S03 | summary: urgent flags sort before review and notes | PASS |
| S04 | summary: chief complaint is verbatim, script text is kept as data (escaping happens at render) | PASS |
| S05 | summary: "none" allergy reads as None; blank complaint reads as Not answered | PASS |
| S06 | summary: a 5000-character complaint is cut to 1000 and marked cut | PASS |
| S07 | summary: the question for the doctor is under worries, not red flags | PASS |
| S08 | summary: review set shows the bone medicine item; first set shows the fracture history | PASS |
| S09 | summary: an empty check-in gives Not answered, not an error | PASS |
| S10 | summary: a red flag is never upgraded by a patient answer alone; the risk stays with the clinician (no category field) | PASS |
| W01 | every question has en, ar and ms with the same number of options and a question text | PASS |
| W02 | scale questions have low and high labels in every language; text questions have a placeholder | PASS |
| W03 | visit section is in both sets, in order, before the question for the doctor | PASS |
| W04 | the visit section offers the required choices (where, how long, walking, red flags, 0-10) | PASS |
| W05 | Malay is complete: every visit-section question has Malay text | PASS |
| A01 | Arabic check-in wording has no gender-specific second-person forms | PASS |
| A02 | Arabic patient screen (index.html PT.ar) has no gender-specific second-person forms | PASS |
| A03 | the scan catches a known feminine form (self-test) | PASS |
