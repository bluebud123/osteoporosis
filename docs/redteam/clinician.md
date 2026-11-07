# OsteoLoop red-team review: clinician and FLS lead

Reviewer: sceptical orthopaedic consultant and FLS lead (red-team pass, Nov 2026).
Scope: a copy of the repo, read-only. Nothing in the copy was edited. Findings are evidence-based. Where I could not check a guideline detail against the source text, I say so.

## How this was checked

- Read src/rules.js, src/finder.js, src/checkin.js, bench/cases.js, bench/run-finder.js, bench/results/finder.md, README.md, docs/*.md, and the clinical, intake, stage, finder and FHIR code in index.html.
- Ran `node bench/run-rules.js` in the copy. Output: `cases 57/57 · checks 102/102 · very-high recall 13/13 · false reassurance 0 · blocked offered 0`. Note: this run regenerated bench/results/rules.json and rules.md inside the scratch copy. The content should be identical, but I did not diff it.
- Ran `node bench/run-finder.js` and `node bench/run-checkin.js` in a separate work copy (scratchpad/work). Output: finder dev set 99% exact, 48/48 caught, 0 dismissed. Finder stress set 40% exact, 4/12 caught, 4 silently dismissed. Checkin 83/83.
- Probed rules.js, finder.js and checkin.js directly with invented patients and report sentences. Probe scripts are in scratchpad/probe.
- Drove index.html in headless Chrome (served locally from the work copy, port 8765) and walked a screened patient from intake to prescription. Also checked the seeded case C-1029 FHIR export and the Find tab. Screenshots are in the scratchpad (s01-board.png, s03-intake-dxa-low.png, s05-case-stage1.png, s07-results-form.png, s09-sign-denosumab-calcium-210.png, s10-find-tab.png). The FHIR bundle is scratchpad/fhir-C-1029.json.
- Not checked: the Malaysian CPG 2022 text itself, and the NICE NG259 text. Guideline statements below are from my own knowledge and are marked "verify" where I am not certain.

## Findings

### BLOCKER

**B1. Denosumab, and other antiresorptives or teriparatide, can be signed with low calcium.**
- Evidence: rules.js:80 flags calcium below 2.15 as kind 'block'. rules.js:89-105 (treatments) never reads labFlags, so the calcium block is not applied to any drug. index.html:874 (sign) checks only `secBlock(c)`, which tests SPEP only (index.html:228). Browser run: intake of a 70-year-old with a vertebral fracture 3 months ago, DXA entered as T -3.1, calcium 2.10. The stage 4 page showed the red callout "Calcium low: correct before an antiresorptive", and Denosumab could be selected and signed. The sign succeeded (scratchpad/s09-sign-denosumab-calcium-210.png). Teriparatide is not gated for high calcium either (rules.js:79, L-CA-HI is a callout only).
- Why it matters: hypocalcaemia after denosumab can be severe and symptomatic. Hypercalcaemia on teriparatide is a contraindication. Both are prescribed here without a hard stop.
- Smallest fix: make treatments() take labFlags into account. Mark a drug blocked when a 'block' lab flag applies to it. Disable Sign while any block flag is present. Also block Sign when calcium, eGFR or vitamin D is missing for an antiresorptive, because the code itself says blocks "cannot be checked" in that case (index.html:866).

**B2. Screening intake cannot record a DXA T-score. Known osteoporosis with low FRAX is shown as "Low risk, no loop opened".**
- Evidence: index.html:415-419 (buildPt) always sets `t:null`. The intake form (index.html:457-475) has no T-score field. The note field has no effect on rules. Browser run: age 62, FRAX major 8%, hip 1%, note "DXA hip T-score -2.8 (outside report)". Result: "Low risk · Below thresholds: no loop opened. Lifestyle, calcium and vitamin D advice; reassess at the next screening" (scratchpad/s03-intake-dxa-low.png). With t = -2.8 the rule H1 (rules.js:50) would give High.
- Why it matters: this is the screening path the judges will see first. A patient with a DXA diagnosis of osteoporosis is sent home with lifestyle advice and no loop, and the note does not say DXA was considered.
- Smallest fix: add a T-score field to intake and pass it into buildPt. Also make the result say "DXA result recorded" or "DXA not entered" rather than silently using FRAX alone.

**B3. Osteopenia or osteoporosis-range T-score with no FRAX is classed "low".**
- Evidence: rules.js:56 returns 'incomplete' only when t, mof and hip are all null. rules.js:58 handles FRAX without BMD, but nothing handles BMD without FRAX. Probe results: `t=-2.4, no FRAX` gives cat=low, first line [life]. `t=-2.0, FRAX not run` gives cat=low. bench/cases.js has no case of this shape, so README.md:91 ("False reassurance 0") does not measure it.
- Why it matters: a T-score of -2.4 with no FRAX is not "below treatment thresholds". The CPG needs FRAX at that level. Labelling it low tells the clinician there is nothing to do.
- Smallest fix: return 'incomplete' (FRAX needed) when t is between -1.0 and -2.5 and no FRAX is entered. Add vignettes for this and for the T -2.5 boundary.

**B4. The finder silently dismisses real vertebral and hip fractures whenever a past accident or tumour appears anywhere in the report.**
- Evidence: finder.js:112 applies the TRAUMA regex to the whole report context, including the indication and history. Probe results (scratchpad/probe/finder-probe.js):
  - "History: road traffic accident 1998. Current: L1 wedge fracture, osteoporotic pattern, no new trauma." gives decision **no**, reason "High-energy trauma: not a fragility fracture".
  - "Lumbar spine: compression fracture L1 (acute, marrow oedema). Ref: MVA 2010." gives **no**.
  - finder.js:113 dismisses the report as "Pathological fracture (tumour)" when no other fracture is found, even if the pathology word refers to a different sentence.
- Why it matters: "no" items are not shown to a human in any alert. They appear in the "No action" list (index.html:704) with no flag. A patient with a real osteoporotic fracture drops out of the pathway.
- Smallest fix: apply the trauma test only to the sentence that states the fracture, and only to this episode's mechanism. Never let a "no" override a fracture sentence. Any fracture term with trauma or pathology mentioned goes to 'review'.

**B5. Finder misses common clinical shorthand and negation patterns, and these fall into "No action" with no alert.**
- Evidence:
  - bench/results/finder.md stress set: 4 of 12 fractures are dismissed (labelled act, produced no). The README (README.md:95) says 6 dismissed, and finder.md and the actual run say 4. Either way the stress result is 40% exact.
  - Probe: "Interval progression of L1 compression, now 50%." gives **no**. This is a real fracture description that the code does not recognise.
  - Probe: "Status post open reduction and internal fixation of left neck of femur (2015)." gives **no**. A prior hip fracture with fixation is missed.
  - Probe: "Left femoral neck fracture, not seen on right." gives **no**. finder.js:22 applies NEG_POST to the whole sentence, so the left-side fracture is cancelled.
  - Stress set: "Comminuted # distal radius", "Vertebra plana at T9", "Bilateral pubic rami #s" are all dismissed.
  - Browser run (scratchpad/s10-find-tab.png): under "No action (4)" the card "Lungs clear. Vertebra plana at T9" (S05) is shown with no highlight and no prompt.
- Why it matters: in a live network this is a missed-fracture pathway. The app says "the finder never auto-dismisses a report", but a human has to notice a grey card in a list. The app does not do that.
- Smallest fix: do not return 'no' when a fracture-like term (including #, VP, NOF, NOH, "compression", "vertebral collapse", "ORIF neck of femur") appears. Return 'review'. Remove whole-sentence NEG_POST. Add a visible alert or count for the "No action" list. Stop presenting the keyword baseline as safe on its own.

**B6. The FHIR export and the case record invent a hip fracture for a patient with two vertebral fractures.**
- Evidence: index.html:217-219 derives the site from `hipVert`. Any clinical case with an admission fracture is coded as 'hip' when `hipVert` is true, and vertebral otherwise. Seeded case C-1029 (index.html:248) has the note "Two vertebral fractures; on prednisolone" and `hipVert:true, multiFx:true`. The FHIR bundle (scratchpad/fhir-C-1029.json) contains a Condition "Hip fracture" (code fx-hip) and a Condition "Vertebral fracture". Both carry `verificationStatus: confirmed`. The hip fracture is not in the note.
- Why it matters: a hip fracture drives FRAX, referral and registry coding. An export that adds one is wrong, and marking it "confirmed" overstates the evidence. This is the first thing a judge who opens the JSON will see.
- Smallest fix: store fracture site explicitly per fracture in the clinical intake. Do not derive it from a boolean. Set verificationStatus to "provisional" or "unconfirmed" for anything not taken from a report.

**B7. A vertebral fracture can be treated without the required SPEP.**
- Evidence: rules.js:121 returns `block:false` when SPEP is not recorded. The UI shows the amber callout "Serum protein electrophoresis needed before treatment". Sign is enabled (index.html:874 only checks the abnormal case). Confirmed in the browser run above: the sign button was enabled with a vertebral fracture, SPEP "Not done", and the callout visible (scratchpad/s09-sign-denosumab-calcium-210.png).
- Why it matters: the rule text says "needed before treatment". The UI lets the clinician skip it with no reason recorded.
- Smallest fix: block Sign until SPEP is recorded for a vertebral fracture, or require a documented clinician reason to proceed.

### MAJOR

**M1. An unknown fracture date is treated as "not recent" without asking.**
- Evidence: rules.js:25 (recent12) is false when months is null. index.html:218 sets months = 60 when the date is unknown. index.html:219 sets months = 60 for the second fracture. Browser run: vertebral fracture, date blank, age 71, FRAX 22 and 3.1. The result is "High risk", "DXA indicated", with no prompt to confirm the date (scratchpad probe ui3, B result). The rule text VH1 says "within the last 12 months", which cannot be assessed.
- Smallest fix: return 'incomplete' with "fracture date needed" when a vertebral or hip fracture has no date. Remove the hard-coded 60.

**M2. The fracture "acute" flag is inferred from a fall in the indication.**
- Evidence: index.html:752 sets acute when the indication mentions a fall and the site is hip, wrist, humerus or pelvis. This sets months = 0 (very high risk, fast-track, index.html:754). A follow-up X-ray for an old hip fracture whose request says "fall" becomes a new very-high-risk case.
- Smallest fix: take the date only from the report sentence. The indication on its own never sets it.

**M3. Two falls, or two fractures of any site, make a patient very high risk.**
- Evidence: rules.js:40 counts any two fractures, including finger and toe, as VH3. Probe: two finger fractures give cat=vhigh with teriparatide and romosozumab first-line. rules.js:42 gives VH5 for falls=true. Probe: falls only, T -1.5, gives vhigh. index.html:417 records a second fracture as site 'other' with the same date.
- Why it matters: very high risk moves the patient to anabolic therapy first-line. The CPG criterion is injurious or recurrent falls, and fragility fracture sites. The wording in the code is broader. Check against the CPG text (verify).
- Smallest fix: count only fragility sites (hip, vertebra, wrist, humerus, pelvis) for VH3. Make the falls criterion match the CPG wording exactly, and record whether a fall was injurious.

**M4. The glucocorticoid input does nothing.**
- Evidence: rules.js never reads `p.gc`. Only fracture-level `onGc` is used (rules.js:27, 41). index.html:469 offers "Glucocorticoids for 3 months or more" as a checkbox with no effect on the category. The board case C-1047 ("Long-term prednisolone", index.html:245) is shown as "Not classified" with no GC-related reason.
- Smallest fix: either remove the box or add the glucocorticoid rule with dose and duration, with a source.

**M5. Renal and drug thresholds need checking against labels and the CPG.**
- rules.js:82 blocks oral bisphosphonates at eGFR below 30. The alendronate label (verify) advises against use at CrCl below 35 mL/min. The 30 threshold in code is closer to risedronate or ibandronate.
- rules.js:83 and :96 use eGFR below 35 for zoledronic acid. The label uses creatinine clearance (Cockcroft-Gault, verify), which differs from eGFR in older or low-muscle-mass patients.
- Denosumab has no eGFR-based hypocalcaemia rule. There is a label warning for severe hypocalcaemia in advanced CKD (verify).
- Teriparatide (rules.js:93) has no blocks for prior skeletal radiotherapy, Paget disease, open epiphyses, or hypercalcaemia.
- The benchmark encodes these thresholds as correct (cases.js D01-D03, E02). They are the author's expected answers, not signed off.
- Smallest fix: list each threshold with its source. Mark anything unverified as LOCAL. Add the teriparatide blocks and the denosumab CKD note.

**M6. Inconsistent treatment order for very high risk.**
- rules.js:95 lists denosumab as 'alt' for very high risk. rules.js:99 lists it as 'first' for high risk. index.html:373 tells the clinician to start an antiresorptive if DXA is delayed, while rules.js:93-94 make teriparatide or romosozumab first-line for the same patient. The advice conflicts.
- Smallest fix: align the three places. Write one sentence for "DXA delayed in very high risk".

**M7. The 3-month and 6-month follow-up cannot be completed on the 90-day clock.**
- Evidence: index.html:204 sets stage 5 clock 90. index.html:392 requires the 6-month response checkbox before "Follow-up complete". index.html:333 escalates to the programme lead at twice the clock, which is day 180. Code-verified; I did not run this path to day 91.
- Why it matters: the case goes "Overdue" and is pinned as crit at day 91, when the 6-month check is not yet due. The clinician can tick the 6-month box early, which means the box does not mean what it says.
- Smallest fix: split stage 5 into a 3-month and a 6-month step, each with its own clock.

**M8. The urgent DXA clock is longer than the routine clock.**
- Evidence: index.html:285 uses 42 days for urgent cases at stage 2. index.html:201 uses 30 days for routine. Screenshot: the urgent case timeline shows "Confirm: DXA and labs, clock 42 d" (scratchpad/s05-case-stage1.png).
- Why it matters: the NICE fast-track requirement is a DXA within 6 weeks for very high risk. Giving the urgent case more time than the routine case is the wrong direction.
- Smallest fix: use a shorter clock for urgent cases, for example 14 or 21 days, and state the source.

**M9. Sign-off is free text, with no clinician identity or authority.**
- Evidence: index.html:389 and :874 store whatever is typed as `rx.by`. Browser run: "Dr Tan" typed, accepted. No role, registration number, or time-stamped e-signature. Dispensing and closure are also free-text attributions (index.html:885, 881).
- Smallest fix: at minimum, record the logged-in user and role, and show that the entry is a typed name. Do not present it as a signature.

**M10. Patients on treatment are excluded from the finder, including the patients who most need review.**
- Evidence: index.html:658 skips any patient with a pharmacy record of treatment. Seed FEED item R020 (Shamsa K., "Right hemiarthroplasty... previous neck of femur fracture", pharmacy record alendronate dispensed 6 weeks ago) is shown as "Skip: already treated" (scratchpad/s10-find-tab.png). A fracture on treatment is VH2, the highest-risk criterion in the code (rules.js:39).
- Why it matters: a fracture while on therapy is a treatment failure, not a closed case. The tool hides it.
- Smallest fix: route "fracture while on treatment" to a treatment review rather than skipping it.

**M11. Overlapping and unverifiable published claims.**
- README.md:57 lists the Jawda OS001 to OS009 indicators as including "ER visits". index.html:790 omits ER visits. docs/submission-pack.md:27 gives a different list again. I did not verify the DoH Jawda 2025 guidance from here. The claim "none measures osteoporosis treatment" is repeated in four places and must be checked against the document before a DoH judge reads it.
- README.md:50 says the stress set dismissed "6 of 12". README.md:95 says "3/12 caught, 6 silently dismissed". The run gives 4/12 caught and 4 dismissed (finder.md, and run-finder output).
- README.md:70 says the Arabic is "written in the feminine form". checkin.js:15-16 says it is "gender-neutral", and the bench (checkin.js:17) scans for both forms. One of these is wrong.
- Smallest fix: one source of truth for every number. Regenerate the README table from bench output. Remove or source the Jawda sentence.

**M12. Benchmark expected answers are the author's own, unsigned.**
- Evidence: bench/cases.js:4 says "Expected answers are written by hand... DRAFT". bench/results/finder.md:3 says the dev set is "tuned to it" and the labels are "drafts pending clinical lead sign-off". The 99% development result is therefore not an external measure.
- Why it matters: a judge will read "57/57", "0 false reassurance" and "13/13" as validation. They are internal consistency checks, and B2 and B3 show they miss obvious errors.
- Smallest fix: say this on the first screen of the benchmark. Add the T-score and FRAX-missing vignettes (B2, B3), and a blind set written by a clinician who has not seen the rules.

**M13. Finder over-calls hedged, negated and pathological wording.**
- Evidence (probe results):
  - "Cannot exclude L1 fracture." gives act. "Fracture not excluded at L1." gives act. The hedge list (finder.js:23) does not include these phrases.
  - "Wedge-shaped T11, likely longstanding Scheuermann type change rather than fracture." gives act. The phrase "rather than fracture" is not treated as a negation. This is S13 in the stress set and is a false positive.
  - "Myeloma screen: lytic lesion at T7. Compression deformity of T7." gives act. The pathology word is in a different sentence, so the patho check does not see it.
  - "Fracture of L2 vertebral body; metastatic disease is known in the history." gives act.
- Why it matters: a pathological fracture routed to osteoporosis pathway and anabolic therapy is a clinical error. A false positive also wastes a clinician's time.
- Smallest fix: treat any sentence containing a pathology term as 'review', across the whole report. Add "cannot exclude", "not excluded", "rather than" to the hedge and negation lists.

**M14. Missing FLS elements that a real service would expect.**
- Falls: only a flag, no falls-assessment pathway or stage.
- Secondary-cause labs: only SPEP and calcium. No TSH, PTH, creatinine clearance trend, coeliac, or testosterone for men. Paget disease is not recognised by the finder.
- Dental: a single checkbox "dental surgery planned" (checkin.js:55, :177). No dental referral or dental clearance step before denosumab or zoledronic acid.
- Bone-health education: absent.
- DXA access: a 30 or 42-day clock with no capacity or waiting-time data.
- Men: scope warning only. Clinical intake hard-codes sex F and post-menopause in seeded clinical cases (index.html:221).
- Smallest fix: list these as explicit out-of-scope items on the first screen, or add a stage or checklist for each.

**M15. Check-in misses drug-specific symptoms.**
- Romosozumab: no question about chest pain, stroke symptoms or heart failure symptoms during treatment (checkin.js:52, :169-171 cover only ONJ and AFF).
- Denosumab: no question about tingling, muscle cramps, or other symptoms of hypocalcaemia.
- Smallest fix: add these questions for the review set, with flags tagged LOCAL until signed off.

**M16. Patient-facing message states a diagnosis before DXA.**
- Evidence: index.html:539 tells the patient "Your screening shows a high chance of weak bones (osteoporosis)". This is sent at stage 1, before any DXA, and also for "incomplete" categories.
- Smallest fix: use neutral wording until a category is set, for example "your results need a bone density scan".

**M17. KPI labels do not match the numerator and denominator.**
- Evidence: index.html:779 "High-risk patients started on treatment" divides by all cases, not high-risk cases.
- Smallest fix: restrict the denominator to high or very-high-risk cases, or rename the label.

### MINOR

- m1. rules.js:79 attributes the calcium-high threshold to "NICE". Check the source.
- m2. rules.js:81 gives a vitamin D repletion regimen inside a flag. Check the regimen against the CPG text.
- m3. rules.js:43 says "frailty or advanced age" but the code uses only the frail boolean. Age is never used in the category.
- m4. rules.js:92-103 and checkin.js:130 use BMI below 19 as a FRAX factor. The FRAX input is continuous and the threshold should be checked.
- m5. index.html:444 says "reassess at the next screening" with no date.
- m6. index.html:443 names the "Singapore or Hong Kong" FRAX model for Malaysia. Confirm which model the CPG specifies.
- m7. checkin.js:170-171 and rules.js: the check-in treats any "fall" as a flag. Not a dismissal, but it generates alert noise.
- m8. index.html:520-530 accepts a patient-reported "every dose" as the 3-month adherence check. It counts toward the closure gate. Make it visibly patient-reported in the gate.
- m9. Finder exclusion of palliative patients (index.html:659) skips a patient with a vertebral fracture who may still need pain management. Log this rather than skipping silently.
- m10. The NICE NG259 citation in rules.js:4 and README.md:74 should be checked against the current NICE number and title.

## Things that are actually good

1. The rules and check-in are deterministic, each rule carries a source tag, and the rules engine is shared between the app and the benchmark (index.html:211). The verifier (finder.js:140-154) rejects any AI-proposed evidence that is not verbatim in the report. That is a sound design.
2. The denosumab rebound handling (index.html:301-303, :875, checkin.js:172) and the ONJ, atypical femoral fracture, cauda equina and spinal infection flags in checkin.js are clinically reasoned and visible on the board. The closure gate (index.html:878-882) refuses to close without evidence, which is the right instinct for a loop product.
3. The benchmark reports its own failures. The stress set result (40% exact, 4 dismissed) and the "false reassurance" bug found on first run are disclosed, and the labels are marked as drafts. That honesty is the strongest asset in the pack, but only if the README numbers and the judge-facing claims are made to match it.

## The five things to fix before a judge sees this

1. Gate Sign on calcium, eGFR, vitamin D and SPEP, and apply the lab block flags to the drugs they affect (B1, B7).
2. Add a T-score field to intake, and return "incomplete" for BMD without FRAX (B2, B3).
3. Stop the FHIR export and case record from inventing a hip fracture. Store fracture site per fracture and mark non-report data as provisional (B6).
4. Make the finder send trauma, pathology and negation cases to review, not to "no". Add the shorthand and "not seen on right" cases to the stress set and fix them, or state the stress result on the first screen (B4, B5, M13).
5. Reconcile every number and claim (README 6 vs 4 dismissed, Arabic wording, Jawda indicator list), label expected answers as unsigned, and remove any claim you cannot cite (M11, M12).
