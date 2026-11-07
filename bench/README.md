# OsteoLoop benchmark

Four suites, all run with `npm run bench` (needs Node 18+ and `npm install` once).

| Suite | What it tests | Latest result |
| --- | --- | --- |
| `run-rules.js` | 57 synthetic vignettes against the clinical rules in `src/rules.js` | 57/57 cases, 102/102 checks |
| `run-checkin.js` | 27 patient check-in answer sets against the flag rules in `src/checkin.js` | 27/27 |
| `run-finder.js` | Case finder against 100 development reports and 15 stress reports (clinical shorthand), hand-labelled act, review or no; plus 6 adversarial checks on `verify()` | Baseline: dev 99% exact, 0 dismissed; stress 33% exact, 6 dismissed; verifier adversarial 6/6 |
| `run-loop.js` | 35 scenarios that drive the real app headless and check the loop's guarantees: intake, patient check-in, case finder (fracture age, pharmacy and palliative exclusions), vertebral-fracture SPEP, denosumab schedule, long-term follow-up on closure | 35/35 |

Full results are in `results/rules.md`, `results/checkin.md`, `results/finder.md` and `results/loop.md`.

**Case finder caveat.** The development reports were written alongside the keyword baseline, so its 99% is tuned to them. The stress set was written afterwards with unfamiliar wording, and it shows how brittle keyword rules are. Neither set is blind. Before the finder's numbers are claimed, the next step is a blind set: clinicians who haven't seen the rules each write 10 to 20 de-identified, paraphrased reports and label them.

## Headline safety numbers

- **Very-high-risk recall: 13/13.** Every patient meeting a Malaysian CPG very-high-risk criterion is classed very high and gets the fast-track.
- **False reassurance: 0.** No at-risk or incomplete patient is labelled "low".
- **Guideline-blocked drug offered: 0.** No renal or cardiovascular contraindication is ever offered as an option.
- **Closure without evidence: 0.** A case cannot close without evidence or a named clinician's documented decision (L01, L02, L09).

## How the expected answers were written

The expected answer for every vignette was written by hand from the guideline thresholds, not produced by running the code. That independence is what lets the benchmark catch bugs.

The vignettes cover:
- **Every threshold, tested on both sides:** T −3.0 and −2.5, FRAX major 20% and 30%, FRAX hip 3% and 4.5%, fracture at 12 months, eGFR 30 and 35, calcium 2.15 and 2.60, vitamin D 75.
- **Contraindications:** each one alone, and combined.
- **Out-of-population patients:** men, premenopausal women.
- **Messy input:** numbers typed as text, empty strings, NaN, missing fields, unknown fracture dates, negative FRAX.

**Status: draft.** The expected answers still need the clinical lead's sign-off before the numbers are reported as final.

## Bugs the benchmark found

| Found by | Problem | Fix |
| --- | --- | --- |
| Rules A12, A14, C03, C04 (first run) | A patient with FRAX at or above the DXA threshold but **no DXA yet** was labelled "low risk": false reassurance | New rule I2: without BMD, FRAX ≥ 10% major or > 3% hip returns "DXA needed first", not "low". The same bug was fixed in `prototypes/assessment-mobile.html` |
| Loop L09 (first run) | A patient could not be recorded as declining while the result was still awaiting acknowledgement | "Patient declines…" added to the notify stage |
| Loop L04 (first run) | Test error, not an app bug: the test assumed the wrong stage start day | Test corrected |

## Limits

- All patients are synthetic. These results show the rules do what the guideline text says; they are not clinical validation.
- FRAX is entered, not computed, so FRAX accuracy is outside the scope of this benchmark.
