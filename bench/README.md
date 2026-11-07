# OsteoLoop benchmark

Five suites, all run with `npm run bench` (needs Node 18+ and `npm install` once).

| Suite | What it tests | Latest result |
| --- | --- | --- |
| `run-rules.js` | 91 synthetic vignettes against the clinical rules in `src/rules.js` (34 added after the clinician red team) | 91/91 cases, 268/268 checks |
| `run-checkin.js` | patient check-in answer sets and checks against the flag rules in `src/checkin.js` | 83/83 |
| `run-finder.js` | Case finder against 100 development reports and 15 stress reports (clinical shorthand), hand-labelled act, review or no; plus the clinician red-team probe set (41 reports) and 28 adversarial checks on `verify()` | First run: stress 33% exact, 6 dismissed; red-team probes 49%, 12 dismissed. After fixes (tuned to those sets): stress 87%, probes 98%, 0 dismissed. See `docs/numbers.md`; verifier adversarial 6/6 |
| `run-readers.js` | Reader adapters (keyword, claude-sample, openai-compatible, mock) through one verifier gate (`readVerified` in `src/readers.js`); `deidentify()` cases and known limits; 15 Arabic and 12 real-format reports (reported, not gated) | 48/48 unit checks. Arabic 14/15 exact, 1 silently dismissed. Real-format 8/12 exact, 1 silently dismissed |
| `run-loop.js` | 68 scenarios that drive the real app headless and check the loop's guarantees: intake, patient check-in, case finder (fracture age, pharmacy and palliative exclusions), vertebral-fracture SPEP, denosumab schedule, long-term follow-up on closure | 35/35 |

Full results are in `results/rules.md`, `results/checkin.md`, `results/finder.md`, `results/readers.md`, `results/arabic.md`, `results/real-format.md` and `results/loop.md`.

## Readers, Arabic and real-format (added)

Every reader (keyword, claude-sample, openai-compatible, mock) goes through `readVerified()` in `src/readers.js`:
1. Non-local readers receive de-identified text (`deidentify()`). A reader is local only if it says so: the keyword baseline, the mock, or an OpenAI-compatible endpoint on localhost.
2. The reader's output is checked by `F.verify()` against the text the reader saw. Output that fails is downgraded to review.
3. Keyword floor: a reader cannot turn a keyword act or review into no. That becomes review and goes to a person. Disable with `{floor: false}`, for measurement only.

The Arabic and real-format reports were labelled before the Arabic lexicon was added, and were not changed after the first run. The lexicon is small and was designed knowing these reports' vocabulary, so the Arabic figure is an upper bound. The English results are unchanged (`results/finder.md` has no diff).

| Set | Exact | Silently dismissed | What the baseline misses |
| --- | --- | --- | --- |
| Arabic (15) | 14/15 (93%) | 1: AR15 | "انهيار" (collapse) of a named vertebra. The lexicon has no collapse term; the English rule counts "collapse" next to a vertebra. Not fixed, so the labels stay untuned. |
| Real-format (12) | 8/12 (67%) | 1: RF05 | The "FX" abbreviation for fracture in an all-caps wrist report. Also surfaced as review: RF06 (misspelt "compresion fracure") and RF12 ("VCF"). Over-called as act: RF03, where the findings describe compression deformity and the impression says no fracture (labelled review). |

Known gaps not in these sets: Arabic osteopenia and height-loss wording. Plain سقوط (fall) is not trauma, matching English. رضح (injury) is deliberately not a trauma term, because "بدون رضح" (without injury) would then read as high-energy trauma.

### What deidentify() cannot catch

It removes e-mails, Emirates IDs, Malaysian NRIC numbers, labelled MRNs, phone numbers, dates (numeric and English month names), digit runs of 7 or more, and names after a title (Dr, Prof, Mr, Datuk, Encik, Puan, د., الدكتور) or after a Patient or Name cue. It cannot catch:
- names with no title or cue, including Arabic names ("Ahmad bin Ali presented with pain");
- street addresses, building names and employers;
- quasi-identifiers such as an unusual occupation, a rare event, or an exact age plus place;
- Arabic month names and relative dates ("last Tuesday");
- identifiers with fewer than 7 digits, and identifiers written out as words;
- Arabic names longer than three tokens after a title. In that case the next Arabic word is over-redacted (tested and documented);
- all-caps names after a title. The name stops only at a clinical word, so other capitalised words can be removed;
- images, OCR text, DICOM headers and signatures.

It is a pre-step that reduces exposure. It does not make a report anonymous, and it is not a substitute for a data-protection review.

## Headline safety numbers

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
