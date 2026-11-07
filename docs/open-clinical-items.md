# Open clinical items

Items that need a clinical decision before the rules change. Each one records the reviewer's claim (from `docs/redteam/clinician.md`), what the code does now, the sign-off decision needed, and the test to add once decided. Until a decision is recorded, the current behaviour stays and the benchmark does not treat it as validated. Line numbers refer to `src/rules.js` as of this commit.

## OI-1. Fracture count and falls make a patient very high risk (reviewer M3)

- **Reviewer claim:** two fractures of any site, including finger and toe, make a patient very high risk (VH3). Two falls, or falls alone, make a patient very high risk (VH5). The CPG wording is narrower (fragility fracture sites; injurious or recurrent falls). Check against the CPG text.
- **Current behaviour:**
  - VH3 counts any two entries in `fractures`, whatever the site: `src/rules.js:36` (`multiple: f.length >= 2`) and `:59`.
  - VH5 is `p.falls` alone, with no injury or count check: `:61`.
  - D3 (NICE DXA indication, "two or more fragility fractures") also counts any site: `:90`.
  - The app records a second fracture as site `other` with the same date (`index.html`, `buildPt`, around line 469), so it is counted as a fracture for VH3.
  - VH6 uses the `frail` boolean only. Age is never used, although the CPG text reads "frailty or advanced age" (reviewer m3).
- **Sign-off decision needed:** (a) which sites count toward multiple fractures (suggested by reviewer: hip, vertebra, wrist, humerus, pelvis; decide whether `other` counts at all); (b) whether VH5 needs the CPG wording of injurious or recurrent falls, and whether the app must record injury; (c) whether age enters VH6, and at what age.
- **Proposed test once decided:** vignettes for two finger fractures (expect not very high), two vertebral fractures (expect very high), one injurious fall (expect the decided result), two non-injurious falls (expect the decided result), frail at age 60 and age 85 (expect the decided result). Add the D3 site rule to the same group.

## OI-2. Glucocorticoid and renal-threshold rules (reviewer M5)

- **Reviewer claim:** the eGFR 30 oral bisphosphonate block may be closer to risedronate or ibandronate than to alendronate, whose label (verify) advises against use at creatinine clearance below 35 mL/min. Zoledronic acid is blocked at eGFR below 35, but the label uses creatinine clearance (Cockcroft-Gault, verify). Denosumab has no renal hypocalcaemia rule (label warning in advanced CKD, verify). Teriparatide has no blocks for prior skeletal radiotherapy, Paget disease, or open epiphyses.
- **Current behaviour:**
  - `src/rules.js:105` `L-EGFR30` blocks `obp` at eGFR below 30, source tag `MYCPG`.
  - `:106` `L-EGFR35` blocks `zol` at eGFR below 35, source tag `MYCPG`.
  - eGFR is the only renal input. There is no creatinine clearance field.
  - Denosumab has no renal flag.
  - Teriparatide blocks now: hypercalcaemia only (`L-CA-HI`, OI-4 below). The other three contraindications are not represented.
  - The benchmark expectations for these thresholds (`bench/cases.js` D01 to D04, E02, E03) are the author's own, not signed off.
- **Sign-off decision needed:** for each threshold, the exact source text and the measure it uses (eGFR or CrCl, and by which equation). Whether the eGFR 30 and 35 cut-offs change per drug. Whether denosumab needs a renal note or flag. Whether the three teriparatide contraindications are added as blocks or as a checklist item.
- **Proposed test once decided:** one vignette per threshold on each side of the boundary, plus a CrCl-versus-eGFR pair for an older low-muscle-mass patient. Each drug's expected block set is then written from the signed source, not from the code.

## OI-3. Treatment order for very high risk (reviewer M6)

- **Reviewer claim:** the three places that set treatment order disagree on denosumab and on what to start when DXA is delayed.
- **Current behaviour:**
  - Very high risk: teriparatide and romosozumab first, denosumab alternative (`src/rules.js:131` to `:134`).
  - High risk: denosumab first-line (`:137`).
  - App text for a delayed fast-track DXA: "If it will be delayed, start an antiresorptive rather than wait" (`index.html`, around line 425). This contradicts the very-high-risk anabolic-first order in `rules.js`.
- **Sign-off decision needed:** the intended order for very high risk; the sentence to show when DXA is delayed (anabolic or antiresorptive, and whether it applies only where anabolic treatment is unavailable); and whether denosumab stays first-line for high risk.
- **Proposed test once decided:** a vignette per category asserting the first-line set, plus a UI text check in `bench/run-loop.js` for the delayed-DXA message. The three sources (rules, UI text, docs) then have to agree.

## OI-4. Calcium and vitamin D gates added in this round (decisions taken from the B1 brief, need clinical confirmation)

These were implemented as the brief for B1 asked. They are listed here because they are clinical policy, not defects.

- **Low calcium (below 2.15) blocks denosumab, zoledronic acid and oral bisphosphonates** (`L-CA-LO`, LOCAL). Teriparatide and romosozumab are not blocked by it. Confirm both.
- **High calcium (above 2.60) blocks teriparatide** (`L-CA-HI`, NICE tag, drug list added in this round). Romosozumab and the antiresorptives are not blocked by it. The app's existing text says to check PTH and refer if hyperparathyroidism is suspected; confirm whether hypercalcaemia should also hold the antiresorptives.
- **Vitamin D below 75 nmol/L needs repletion before an antiresorptive** (a need, not a block; the anabolics are not held). Confirm that repletion must come first, and whether 75 is the right cut-off. Reviewer B1 and the CPG text should be checked.
- **Vitamin D missing is not gated.** Only calcium and eGFR missing are needs. The reviewer's B1 smallest fix also gates on missing vitamin D before an antiresorptive. Decide whether to add it. If yes, the change is one line in `needsFor` and the vignette set in `bench/cases.js` N-group.
- **Proposed tests:** already in `bench/cases.js` H01 to H05 and N01 to N07 (expected answers marked draft until signed off).

## OI-5. Vertebral fracture SPEP waiver (B7)

- **Current behaviour:** a vertebral fracture with SPEP not recorded now blocks signing (`secondaryScreen().block` is true). A waiver lifts the block only if both `spepWaived` (a non-empty reason) and `spepWaivedBy` (a named clinician) are supplied. An abnormal SPEP cannot be waived.
- **Sign-off decision needed:** whether a waiver is allowed at all, and what reasons count (for example, a patient refusing a blood test, or a documented prior result elsewhere). Whether the waiver should expire.
- **Proposed test:** the S-group in `bench/cases.js`. Add a UI test once the waiver input exists in the app (it does not exist yet).

## OI-6. Undated fracture (M1, partial)

- **Current behaviour:** the category now carries `fracture-date` and reason M1 for any fracture with unknown months, and a low category is raised to incomplete. The rules cannot tell a date that is unknown from one that is 60 months, because the app writes 60 for unknown dates (`index.html`, around lines 266 and 267). Until the app stops doing this, the prompt never shows.
- **Sign-off decision needed:** how long a vertebral fracture of unknown date is treated as possibly recent before a prompt is shown. Whether an undated vertebral fracture should default to high risk (current) or to incomplete.
- **Proposed test:** the M-group in `bench/cases.js`, and a loop test that an undated fracture in the intake shows the date prompt.

## OI-7. T-score -1.0 to -2.5 without FRAX (B3)

- **Current behaviour:** the osteopenia range (above -2.5 and below -1.0) with no FRAX returns incomplete (rule I3). A T-score of exactly -1.0 with no FRAX still returns low, because it is in the normal range by the WHO definition.
- **Clinical question, not decided here:** does the CPG or NICE NG259 require FRAX for every osteopenia-range patient, or only for some (for example, when there are risk factors)? If FRAX is not required for some of them, the I3 rule is too strict for those patients and should be narrowed to the CPG wording.
- **Proposed test:** T01 and T05 (incomplete) and T02 (low with FRAX present) already exist. Add the decided exceptions when the CPG wording is confirmed.

## OI-8. Fall in the request indication sets a fracture as acute (reviewer M2)

- **Reviewer claim:** a follow-up X-ray of an old hip fracture whose request says "fall" becomes a new very-high-risk case, because the indication alone sets the fracture as recent.
- **Current behaviour:** `index.html`, `openFromFeed()`, line 867. A finder case is treated as acute (months 0, very high risk VH1 and fast-track) when the indication mentions a fall, injury or trauma and the site is hip, wrist, humerus or pelvis, even when the report sentence does not say acute. The code is `const acute = !old && (FX_ACUTE.test(ev) || FX_ACUTE.test(r.ind||'') || (FX_FALL.test(r.ind||'') && ['hip','wrist','humerus','pelvis'].includes(site)));`.
- **Decision for now:** not changed. The fall-in-indication inference stays until the clinical lead decides.
- **Sign-off decision needed:** whether the fracture date may come from the indication at all, or only from the report sentence (suggested by reviewer). If only the report, the indication term is removed from `acute`, and a hip or pelvic fracture with a fall in the request but no acute wording in the report gets the fracture-date prompt instead.
- **Proposed test once decided:** a finder vignette with a hip fracture report that says "old" or "healed" and an indication "fall", expecting no acute flag, and the same report with an acute sentence, expecting the acute flag. Add to the L-group in `bench/run-loop.js`.
