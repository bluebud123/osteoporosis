# CLAUDE.md

Context for AI coding sessions working on this repo. Read this first, then README.md and bench/README.md.

## What this is

**OsteoLoop** finds fragility fractures already documented in radiology reports but never treated (the case finder), then closes the loop to treatment. It is an entry for the Future Health Digital Innovation Challenge 2026 (Department of Health Abu Dhabi, run on Hack2skill). Track: Population Health, Statement 3, *Closing the Screening-to-Care Loop*.

It is applied to osteoporosis and fragility-fracture risk. Every adult flagged at screening as high risk should reach treatment, and every step has a named owner, a clock and a closure gate.

Clinical lead: an orthopaedic medical officer, Ministry of Health Malaysia. Orthopaedic credibility is part of the pitch.

Screening starts with a clinical assessment. AI reading of plain spine X-rays (thoracic and lumbar vertebral fractures) is a later, optional "second door". It is a concept only (`prototypes/xray-door-demo.html`) and no model exists yet.

## Dates

| Date | Milestone |
| --- | --- |
| 14 Nov 2026 | Target: final-ready package submitted (the lead is travelling from 15 Nov) |
| 15 Nov 2026 | Early review |
| 17 Nov 2026 | Feedback |
| 20 Nov 2026 | Final deadline |
| 7–11 Dec 2026 | Finals at GITEX Dubai |

Check the official submission requirements (video length, deck template, forms) before building the submission pack. They have not been confirmed yet.

## Architecture

The project is static HTML with no build step, so it hosts free on GitHub Pages from main, at the repo root.

| File | Role |
| --- | --- |
| `index.html` | Main app. Board, case loop (stages 0–6), screening intake, result entry, patient phone with check-in, specialist inbox, loop-health metrics, Reset. State is in memory only |
| `src/rules.js` | Clinical rules engine (`window.OsteoRules` / `module.exports`). Deterministic, and every rule is tagged with its source. The app and the benchmark share it, so never fork rules inline |
| `src/finder.js` | Case finder (`window.OsteoFinder`). `find()` is the keyword baseline, `verify()` checks that quoted evidence is verbatim in the report, `aiBatchPrompt()` and `score()` are shared by the app and the benchmark. The app's AI reader uses the claude.ai `sample` capability, so the artifact must declare `capabilities: {sample: {}}`. On GitHub Pages the AI controls are hidden |
| `bench/reports.js`, `bench/reports-stress.js` | Labelled synthetic reports (dev 100, stress 15), loaded by both Node and the page |
| `src/checkin.js` | Patient check-in (`window.OsteoCheckin`). Question sets `first` and `review` in English and Arabic, plus `flags()` |
| `prototypes/assessment-mobile.html` | Older standalone assessment flow. It has its own inline copy of the rules, and the I2 fix was applied there too |
| `bench/` | `run-rules.js` (57 vignettes), `run-checkin.js` (27 answer sets), `run-finder.js` (115 reports; `--ai` with `ANTHROPIC_API_KEY`), `run-loop.js` (26 jsdom scenarios driving the real `index.html`) |

## Commands

```bash
npm install          # once; jsdom for the loop tests
npm run bench        # all three suites; exit 1 on any failure
python3 -m http.server 8000
```

Run `npm run bench` before every commit. If you change UI text or flow, update `bench/run-loop.js`, because its selectors (`data-a`, `data-tab`, `data-open`, `data-ans`, `#in-*`, `#r-*`) are the contract.

## Clinical sources and conventions

- **NICE NG259 (2026):** who to assess, DXA indications, 6-week fast-track DXA when anabolic treatment is likely.
- **Malaysian CPG, Postmenopausal Osteoporosis (2022):** risk categories, FRAX thresholds, treatment by category, renal and calcium blocks, vitamin D repletion.
  - Very high risk means any of: fracture within 12 months, fracture on treatment, multiple fractures, fracture on glucocorticoids, falls, frailty, T < −3.0, FRAX major osteoporotic > 30% or hip > 4.5%.
  - Very high risk gets anabolic treatment first. Romosozumab is blocked after an MI or stroke within 12 months. An eGFR below 30 blocks oral bisphosphonates; below 35 blocks zoledronic acid.
- **FRAX** is entered, never computed here. There is no Malaysian FRAX model, so the CPG uses the Singapore and Hong Kong models.
- **Source tags:** `MYCPG`, `NICE`, `FRAX`, and `LOCAL` for anything awaiting clinician sign-off. Every on-screen value carries a provenance badge (Recorded, Calculated, Patient-reported, Clinician).
- **Safety invariants that the benchmark enforces:**
  - Never label an at-risk or incomplete patient "low". Rule I2: FRAX at or above the DXA threshold with no DXA gives "DXA needed".
  - Never offer a drug the guideline blocks.
  - A case closes only with evidence (dispensing, adherence check, repeat DXA booked) or a named clinician's documented decision.
  - Patient-reported answers never change the risk category on their own.
- All patients are fictional and all data is synthetic. Keep it that way.

## Status

Done:
- Rules engine and benchmark. The benchmark found and fixed a false-reassurance bug (I2).
- Screening intake.
- DXA and lab result entry.
- Reset button.
- Rename to OsteoLoop.
- Patient check-in before every clinic visit.
- Pivot (agreed): a case finder on radiology report text. Keyword baseline: dev 99%, stress 33% with 6 real fractures silently dismissed. AI reader with verified evidence in the Find tab.
- Proposed indicator: fragility-fracture patients started on treatment within 6 months. It is not in DoH's 2025 orthopaedic Jawda set (OS001–OS009).

Open items for the clinical lead:
- Sign off the expected answers in `bench/results/rules.md` and `bench/results/checkin.md`, and the `LOCAL` drug-safety flags (osteonecrosis of the jaw, atypical femoral fracture, denosumab rebound, GI side effects on oral bisphosphonates).
- Native-speaker clinical review of the Arabic. It uses the feminine form, because the CPG population is postmenopausal women.
- Institutional permission to submit; confirm the challenge's IP terms.
- Make the repo public and enable GitHub Pages (main, root).

Next tasks, in order:
0. Get AI benchmark numbers: run "Run AI benchmark" in the claude.ai artifact (or `npm run bench:finder-ai`), record them in README and bench/README, and build a blind report set written by clinicians.
1. FHIR export button: download the case as a FHIR R4 Bundle (Patient, Task, ServiceRequest, Communication, Observation, MedicationRequest/Dispense, CarePlan, QuestionnaireResponse for check-ins).
2. Submission pack: architecture diagram, comparison with existing solutions (fracture liaison services and others), limitations section (DECIDE-AI style), 3-minute video script.
3. Further bounded AI: drafting patient messages or referral letters, each checked by a deterministic verifier. AI never sets the risk category.

## Working with the clinical lead

- Answer first, direct, peer-level.
- Push back when something is wrong, and expect pushback in return. Don't change course because of a bad comment until it has been verified.
- Never enter credentials or passwords. Publishing, making the repo public, and messages sent on the lead's behalf need explicit approval.
