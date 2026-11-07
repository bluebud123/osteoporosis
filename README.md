# OsteoLoop

Finds the fragility fractures already documented in radiology reports but never treated, and closes the loop from screening to treatment.

OsteoLoop helps primary-care teams make sure every adult flagged at screening as high risk of fragility fracture reaches treatment. It uses the screening record, DXA and lab results, referral events and dispensing records. Every step has a named owner, a clock and a closure gate.

Entry for the **Future Health Digital Innovation Challenge 2026** (Population Health → *Closing the Screening-to-Care Loop*).

> **Prototype.** Every patient is fictional and all data is synthetic. Clinical rules are drafts awaiting clinician sign-off. This is decision support, not diagnosis.

**Live demo:** https://bluebud123.github.io/osteoporosis/ (GitHub Pages)

## Run it

The app is static HTML. It has no build step and no runtime dependencies.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

| File | What it is |
| --- | --- |
| `index.html` | The main app: screening intake (rules run live), case board, 7-stage case loop with result entry, patient phone, specialist inbox, loop-health metrics, Reset button |
| `src/finder.js` | The case finder: reads radiology report text and finds documented fragility fractures. It has a deterministic keyword baseline, a prompt for an AI reader, and a verifier that rejects any finding whose quoted evidence isn't in the report, or whose quoted sentence doesn't state an un-negated fracture (for an open decision) or a fracture, deformity, height-loss or bone-density finding (for review) |
| `src/checkin.js` | The patient check-in: question sets for the first clinic and treatment reviews (English and Arabic), and the deterministic rules that turn answers into clinician flags |
| `src/rules.js` | The clinical rules engine. It is deterministic, every rule is tagged with its source, and the app and the benchmark share it |
| `bench/` | The benchmark: synthetic clinical vignettes and headless loop scenarios (see below) |
| `prototypes/assessment-mobile.html` | Clinical assessment flow: history → risk factors → fracture → DXA → FRAX → labs → treatment → follow-up |
| `prototypes/xray-door-demo.html` | Earlier concept: AI read of lateral spine X-rays as an optional second door (corner points are simulated) |

## The loop

| Stage | Owner | Clock (draft) | Moves on when |
| --- | --- | --- | --- |
| 0 Screen | Screening clinic | Same visit | Tier high or very high → actionable result |
| 1 Notify | GP | 7 days | Teach-back correct, or nurse call documented |
| 2 Confirm (DXA + labs) | GP | 30 days (6 weeks fast-track) | Results back |
| 3 Decide or refer | GP → specialist | 7 days | Signed decision or accepted referral |
| 4 Treat | Prescriber | 14 days | Dispensing record |
| 5 Follow up | GP | Per schedule | Adherence and response checks done |
| 6 Close | GP or programme lead | — | Evidence attached, or documented clinician decision |

The loop also handles six exceptions: overdue (alert, then escalation), unassigned (pinned queue), referral rejected (reroute, GP keeps ownership), patient misunderstands (nurse call), patient declines (documented decision only), and transfer (handoff must be accepted).

## Case finder

Most fragility fractures that never get treated are not hidden. They are written down: an "incidental T8 wedge compression fracture" in a chest X-ray report, or a hemiarthroplasty "for previous neck of femur fracture". Then nobody acts. The case finder reads report text, opens a case with the quoted sentence as evidence, and highlights that sentence. Clinicians type nothing extra.

There are two readers, and the final decision is whichever ranks higher:
- **Keyword baseline** (`src/finder.js`): transparent and offline, with negation, hedging, trauma and tumour handling. It scores near-perfect on its own development set but breaks on clinical shorthand ("# NOF", "VCF", "vertebra plana"), and silently dismissed 6 of 12 real fractures in the stress set. That limit is the reason for the AI reader.
- **AI reader:** Claude reads the same reports, called from the page inside claude.ai. Every AI finding must quote a sentence that `verify()` finds verbatim in the report. Anything unverifiable goes to human review and never opens or closes a case on its own. Run it from the Find tab ("Run AI benchmark"), or with `ANTHROPIC_API_KEY=… npm run bench:finder-ai`.

The finder never auto-dismisses a report: "No action" items stay listed for audit. A blind report set written by clinicians who haven't seen the rules is still needed before the numbers count.

## Proposed indicator

DoH Abu Dhabi's 2025 orthopaedic Jawda indicators (OS001–OS009) cover surgical-site infection, readmission, return to theatre, ER visits, mortality and transfusion. None measures osteoporosis treatment after a fragility fracture. OsteoLoop computes "fragility-fracture patients started on treatment within 6 months" directly from stage timestamps.

## Patient check-in

Before every clinic visit the patient fills in a short check-in on their phone, one question per screen, in English or Arabic.
- **Before the first clinic:** previous fractures, falls, and the FRAX risk factors (parent hip fracture, steroids, rheumatoid arthritis, smoking, alcohol, height and weight).
- **On treatment:** how the medicine is being taken and why doses are missed, red-flag symptoms (jaw pain or a loose tooth, new thigh pain, heartburn), falls, new fractures, planned dental surgery, calcium and vitamin D.

The answers become clinician flags. Urgent flags pin the case on the board until a clinician marks them reviewed:
- a new fracture;
- possible osteonecrosis of the jaw or atypical femoral fracture;
- denosumab stopped, which carries a rebound fracture risk.

An answer of "every dose" can be accepted as the 3-month adherence check. Patient-reported answers never change the risk category on their own; a clinician confirms first. The Arabic is written in the feminine form, because the CPG population is postmenopausal women.

## Clinical rules and sources

- **Who to assess, when DXA is indicated, and the 6-week fast-track:** NICE NG259, *Osteoporosis: risk assessment* (2026).
- **Diagnosis, risk categories, FRAX thresholds, treatment by category, renal and calcium blocks, vitamin D repletion, monitoring, drug holidays:** Malaysian CPG, *Management of Postmenopausal Osteoporosis*, 2022 (3rd edition).
- **FRAX** is recorded from the official calculator, not computed here. There is no Malaysian FRAX, so the CPG uses the Singapore and Hong Kong ethnic models.
- **Local placeholders, each labelled in the UI:** lab reference ranges, the 2-year repeat-DXA interval, and all stage clocks.

Every value on screen carries a provenance badge: **Recorded**, **Calculated** (with the rule's source) or **AI-drafted**.

## Benchmark

```bash
npm install && npm run bench
```

| Measure | Result |
| --- | --- |
| Clinical vignettes (57 cases, 102 checks) | 57/57 pass |
| Very-high-risk recall | 13/13 |
| False reassurance (at-risk patient labelled "low") | 0 |
| Guideline-blocked drug offered | 0 |
| Patient check-in flags (27 answer sets) | 27/27 pass |
| Case finder, keyword baseline: development set (100 reports) | 99% exact, 48/48 fractures caught, 0 silently dismissed |
| Case finder, keyword baseline: stress set (15 reports, clinical shorthand) | 33% exact, 3/12 caught, **6 silently dismissed** |
| Case finder verifier: adversarial checks (negated, non-fracture, pathological and not-in-report quotes rejected; real fracture quotes accepted) | 6/6 pass |
| Loop guarantees (35 headless scenarios on the real app) | 35/35 pass |

On its first run the benchmark found a real false-reassurance bug, which is now fixed: a patient with high FRAX but no DXA was being labelled "low". Details, method and limits are in [`bench/README.md`](bench/README.md). The expected answers are drafts until the clinical lead signs them off.

## Data

No patient data is used. All cases are fictional and generated by hand for demonstration. The organisers provide no data.

## Assumptions and limitations

- The Malaysian CPG covers postmenopausal women. Applying it to men is outside its scope, and the app warns when that happens.
- Stage clocks and the repeat-DXA interval are local choices, not guideline values.
- The Arabic patient messages need review by a native-speaking clinician.
- The X-ray second door is a concept only. No model has been trained or validated yet.
- State is in-memory only, so a page reload resets the demo (the Reset button does the same).
