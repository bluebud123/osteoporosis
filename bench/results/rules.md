# Rules benchmark results

- Cases passed: **57/57**; individual checks passed: **102/102**
- Very-high-risk recall: **13/13**
- False reassurance (at-risk or incomplete case labelled "low"): **0**
- Guideline-blocked drug offered: **0**

_DRAFT: expected answers pending clinician sign-off._

## Category confusion matrix (rows = expected, columns = produced)

| expected \ produced | vhigh | high | low | incomplete |
| --- | --- | --- | --- | --- |
| vhigh | 13 | 0 | 0 | 0 |
| high | 0 | 15 | 0 | 0 |
| low | 0 | 0 | 7 | 0 |
| incomplete | 0 | 0 | 0 | 9 |

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
| G06 | robustness | Vertebral fracture with unknown date | PASS |  | H2 |
| G07 | robustness | Age 25 with old vertebral fracture | PASS |  | H2 |
| G08 | robustness | T -3.0 with FRAX hip 4.6% | PASS |  | VH9 |
| G09 | robustness | Falls, eGFR 25 and recent MI together | PASS |  | VH5 |
| G10 | robustness | Negative FRAX value (data-entry error) | PASS |  | L1 |
