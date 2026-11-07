# Rules benchmark results

- Cases passed: **91/91**; individual checks passed: **268/268**
- Very-high-risk recall: **27/27**
- False reassurance (at-risk or incomplete case labelled "low"): **0**
- Guideline-blocked drug offered: **0**
- Blocked or needs-result drug signable: **0**

_DRAFT: expected answers pending clinician sign-off._

## Category confusion matrix (rows = expected, columns = produced)

| expected \ produced | vhigh | high | low | incomplete |
| --- | --- | --- | --- | --- |
| vhigh | 27 | 0 | 0 | 0 |
| high | 0 | 28 | 0 | 0 |
| low | 0 | 0 | 10 | 0 |
| incomplete | 0 | 0 | 0 | 13 |

## Every case

| ID | Group | Case | Result | Failed checks | Rules fired |
| --- | --- | --- | --- | --- | --- |
| A01 | very-high | Wrist fracture 8 months ago | PASS |  | VH1 |
| A02 | very-high | Fracture exactly 12 months ago (boundary) | PASS |  | VH1 |
| A03 | very-high | Wrist fracture 13 months ago, no DXA, no FRAX | PASS |  | I1 |
| A04 | very-high | Fracture while on osteoporosis treatment | PASS |  | VH2 |
| A05 | very-high | Two old fractures | PASS |  | VH3 |
| A06 | very-high | Fracture while on glucocorticoids | PASS |  | VH4 |
| A07 | very-high | Injurious falls / high fall risk | PASS |  | VH5 |
| A08 | very-high | Frail (clinician judgement) | PASS |  | VH6 |
| A09 | very-high | T-score -3.1 | PASS |  | VH7 |
| A10 | very-high | T-score exactly -3.0 (boundary: not very high) | PASS |  | H1 |
| A11 | very-high | FRAX major 30.1% | PASS |  | VH8 |
| A12 | very-high | FRAX major exactly 30%, no DXA (needs DXA, not "low") | PASS |  | I2 |
| A13 | very-high | FRAX hip 4.6% | PASS |  | VH9 |
| A14 | very-high | FRAX hip exactly 4.5%, no DXA (needs DXA, not "low") | PASS |  | I2 |
| B01 | high | T-score exactly -2.5 | PASS |  | H1 |
| B02 | high | T-score -2.6 | PASS |  | H1 |
| B03 | high | Vertebral fracture 5 years ago, no DXA (clinical osteoporosis) | PASS |  | H2 |
| B04 | high | Hip fracture 3 years ago | PASS |  | H2 |
| B05 | high | Osteopenia T -2.0, FRAX major 20.1% | PASS |  | H3 |
| B06 | high | Osteopenia T -2.0, FRAX major exactly 20%, hip 2% | PASS |  | L1 |
| B07 | high | Osteopenia T -2.0, FRAX hip 3.1% | PASS |  | H3 |
| B08 | high | Osteopenia T -2.0, FRAX hip exactly 3% | PASS |  | L1 |
| B09 | high | T exactly -1.0 (normal) with FRAX major 25% | PASS |  | L1 |
| B10 | high | Normal BMD T -0.5 with FRAX major 25% | PASS |  | L1 |
| C01 | low-incomplete | No DXA, no FRAX, no fracture | PASS |  | I1 |
| C02 | low-incomplete | FRAX major 8%, hip 1%, no DXA | PASS |  | L1 |
| C03 | low-incomplete | FRAX major 12%, no DXA (DXA to be considered, not "low") | PASS |  | I2 |
| C04 | low-incomplete | FRAX major 25% without DXA (above threshold, DXA needed) | PASS |  | I2 |
| C05 | low-incomplete | Normal DXA T -0.8, low FRAX | PASS |  | L1 |
| D01 | labs | eGFR 29 | PASS |  | H1 |
| D02 | labs | eGFR exactly 30 | PASS |  | H1 |
| D03 | labs | eGFR 34 | PASS |  | H1 |
| D04 | labs | eGFR exactly 35 | PASS |  | H1 |
| D05 | labs | Calcium 2.61 | PASS |  | H1 |
| D06 | labs | Calcium exactly 2.60 | PASS |  | H1 |
| D07 | labs | Calcium 2.14 | PASS |  | H1 |
| D08 | labs | Calcium exactly 2.15 | PASS |  | H1 |
| D09 | labs | Vitamin D 74 | PASS |  | H1 |
| D10 | labs | Vitamin D exactly 75 | PASS |  | H1 |
| D11 | labs | All labs missing | PASS |  | H1 |
| E01 | contraindications | Very high, MI in last 12 months | PASS |  | VH7 |
| E02 | contraindications | Very high, eGFR 30 | PASS |  | VH7 |
| E03 | contraindications | Very high, stroke and eGFR 20 | PASS |  | VH7 |
| E04 | contraindications | High risk with MI: romosozumab not offered at all | PASS |  | H1 |
| F01 | scope | Man, 70, T -2.6 | PASS |  | H1 |
| F02 | scope | Premenopausal woman, 45, T -2.6 | PASS |  | H1 |
| F03 | scope | Postmenopausal woman | PASS |  | H1 |
| G01 | robustness | T-score typed as text "-2.7" | PASS |  | H1 |
| G02 | robustness | T-score empty string, nothing else | PASS |  | I1 |
| G03 | robustness | T-score NaN | PASS |  | I1 |
| G04 | robustness | eGFR missing on a high-risk patient | PASS |  | H1 |
| G05 | robustness | Fractures field absent | PASS |  | I1 |
| G06 | robustness | Vertebral fracture with unknown date | PASS |  | H2 M1 |
| G07 | robustness | Age 25 with old vertebral fracture | PASS |  | H2 |
| G08 | robustness | T -3.0 with FRAX hip 4.6% | PASS |  | VH9 |
| G09 | robustness | Falls, eGFR 25 and recent MI together | PASS |  | VH5 |
| G10 | robustness | Negative FRAX value (data-entry error) | PASS |  | L1 |
| H01 | lab-blocks | High risk, calcium 2.10: all antiresorptives blocked until corrected | PASS |  | H1 |
| H02 | lab-blocks | Very high, calcium 2.10: antiresorptives blocked, anabolics not | PASS |  | VH7 |
| H03 | lab-blocks | High risk, calcium exactly 2.15: not blocked | PASS |  | H1 |
| H04 | lab-blocks | Very high, calcium 2.80: teriparatide blocked (hypercalcaemia), romosozumab not | PASS |  | VH7 |
| H05 | lab-blocks | Very high, calcium 2.61 and eGFR 29: block flags aggregate per drug | PASS |  | VH7 |
| N01 | needs | High risk, calcium missing: antiresorptives need calcium first | PASS |  | H1 |
| N02 | needs | High risk, eGFR missing: antiresorptives need eGFR first | PASS |  | H1 |
| N03 | needs | High risk, calcium and eGFR missing | PASS |  | H1 |
| N04 | needs | High risk, vitamin D 60 nmol/L: repletion first before antiresorptive | PASS |  | H1 |
| N05 | needs | High risk, all labs normal: nothing needed, antiresorptives signable | PASS |  | H1 |
| N06 | needs | Very high, calcium and eGFR missing: teriparatide and romosozumab not held by labs | PASS |  | VH7 |
| N07 | needs | High risk, eGFR 29 and calcium missing: eGFR block stands, calcium need still listed | PASS |  | H1 |
| S01 | spep | Vertebral fracture 3 months ago, SPEP not recorded: no drug signable | PASS |  | VH1 |
| S02 | spep | Vertebral fracture 3 months ago, SPEP normal: signable | PASS |  | VH1 |
| S03 | spep | Vertebral fracture, SPEP abnormal: blocked, cites myeloma | PASS |  | VH1 |
| S04 | spep | Vertebral fracture, SPEP not recorded, documented waiver with clinician: signable | PASS |  | VH1 |
| S05 | spep | Vertebral fracture, waiver reason without a named clinician: still blocked | PASS |  | VH1 |
| S06 | spep | Vertebral fracture, abnormal SPEP with a waiver: waiver cannot override myeloma | PASS |  | VH1 |
| S07 | spep | Empty or blank waiver reason: still blocked | PASS |  | VH1 |
| S08 | spep | Hip fracture only: SPEP not required, drugs not held by it | PASS |  | VH1 |
| T01 | bmd-no-frax | T -2.4, FRAX not run: osteopenia range needs FRAX, not "low" | PASS |  | I3 |
| T02 | bmd-no-frax | T -2.4, FRAX major 8%, hip 1%: stays low | PASS |  | L1 |
| T03 | bmd-no-frax | T -2.5 exactly, FRAX not run: osteoporosis logic, high | PASS |  | H1 |
| T04 | bmd-no-frax | T -2.6, FRAX not run: high | PASS |  | H1 |
| T05 | bmd-no-frax | T -1.1, FRAX not run: osteopenia range, incomplete | PASS |  | I3 |
| T06 | bmd-no-frax | T -2.4, FRAX hip 3.1% (no major): high via FRAX above threshold | PASS |  | H3 |
| T07 | bmd-no-frax | T -2.4, FRAX major exactly 20%, hip 2%: low (boundary) | PASS |  | L1 |
| T08 | bmd-no-frax | T -2.0 with vertebral fracture 5 years ago, FRAX not run: high from fracture, not incomplete | PASS |  | H2 |
| M01 | fracture-date | Vertebral fracture, date unknown: high stays, date prompt shown | PASS |  | H2 M1 |
| M02 | fracture-date | Wrist fracture, date unknown, normal DXA, low FRAX: not silently low | PASS |  | M1 |
| M03 | fracture-date | Wrist fracture, date unknown, no DXA or FRAX: incomplete (as before), with date prompt | PASS |  | I1 M1 |
| M04 | fracture-date | Wrist fracture, date unknown, T -3.1: very high stays, date prompt shown | PASS |  | VH7 M1 |
| M05 | fracture-date | Wrist fracture 5 months ago (dated): very high, no date prompt | PASS |  | VH1 |
| M06 | fracture-date | No fracture, normal DXA, low FRAX: low, no date prompt | PASS |  | L1 |
