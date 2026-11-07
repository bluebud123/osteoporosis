# Judge verdict: OsteoLoop (Population Health, "Closing the Screening-to-Care Loop")

Read: README, submission-pack, evidence-update, integration, site-profiles, data-model, checkin, bench/README, all bench/results, all ten slides in deck.json order. I opened the app in headless Chromium (board, Find, Health tabs) and looked at the screenshots.

## Bottom line

Interesting, honest, and not yet shortlist-ready. The problem is real and the team is unusually candid about limits. But the headline capability (finding untreated fractures in reports with an AI reader) has no measured result, everything runs on synthetic data written by the author, there is no UAE guideline, no UAE buyer, no local partner, and the deck's own evidence slide is out of date against the repo's results. Provisional rank: upper-middle of 40, below any entry with real data or a signed site. Score 5.0 average.

## Scores (1-10)

1. Problem importance and fit to the statement: 7. Post-fracture treatment gap is real, and "documented but not acted on" fits "screening-to-care loop" tightly. Dropped from 8 because the statement is population screening and this is opportunistic case-finding from radiology; the pack never says how this connects to a DoH screening programme.
2. Innovation vs prior art: 4. XRAIT, INTERCEPT (NLP on radiology reports plus alert to GP), FLS coordinators and HealthOST already own each component. The pack itself calls INTERCEPT "the closest prior art to OsteoLoop's finder and loop". The residual novelty is a stage/clock/closure-gate workflow wrapper and a quote-verifier. That is good product design, not innovation. Kaiser Healthy Bones, the strongest "closed loop" precedent, is dropped from the deck entirely.
3. Technical depth and credibility: 5. The verifier idea (the quoted sentence must exist verbatim and be un-negated) is sensible and well tested. Ingest parsers and a deterministic rules engine are real engineering. But the finder is a keyword matcher, the AI reader is "called from the page inside claude.ai" (README), which cannot run in a hospital, and `claude-sample` sends text to a foreign model while the UAE profile defaults to `local-only` keyword. So the only reader a UAE site could use today is the one that fails on clinical shorthand. The `deidentify()` tool is regex-based with a long documented list of what it misses. The demo's Find tab already shows a false positive: Reem N. (S13) "Wedge-shaped T11, likely longstanding Scheuermann type change rather than fracture" is badged "Rules: Act" with an "Open loop" button.
4. Evidence quality: 2. Zero real reports, zero real patients, zero clinician-labelled data. Dev set tuned to the code, stress set written by the author after seeing failures, labels unsigned. AI reader: "not yet measured". The benchmark proves the code does what its author wrote. Honest labelling earns credit for integrity, not for evidence. Market and gap numbers are borrowed from Oxford, Taiwan and Saudi studies; no UAE treatment-gap figure exists.
5. Feasibility in Abu Dhabi: 3. Data residency: plan only (Law 2/2019 Art. 13 means any cloud model outside UAE needs a Health Authority decision). Malaffi: the evidence update shows DoH lists five data standards and SNOMED CT, no FHIR or HL7; the entry's integration route (HL7 ORU files, FHIR) is not tied to anything Malaffi accepts. DoH AI policy (2018, v0.9) requires certification from recognised international agencies (s7.1.2.1.1); the pack has no route to that. Regulatory class: "to be confirmed". Clinical guideline: the `uae-doh` profile uses the Malaysian CPG as an "INTERIM stand-in"; there is no UAE or Abu Dhabi guideline in the repo. Buyer: "Action: confirm the owner with one hospital contact before the pitch names a buyer" (evidence-update, Task 3). Nobody has been contacted. No Abu Dhabi site, no UAE clinician.
6. Impact and scalability: 4. Using the evidence-update estimate (4.14M population, 8-13% aged 50+, Saudi hip fracture rates, hip-to-all ratio 1-2, 70-80% untreated): about 130 to 670 untreated fragility fractures a year in the whole emirate, central about 420. That is a rounding error on a health system and is not big enough to carry a USD 50k-scale "scalable platform" story as a standalone product. It is big enough for a quality-improvement pilot, and the cost-per-fracture-prevented argument (hip fracture is costly) could still work, but the entry never makes it. Every input to the estimate is a proxy or a hand-chosen number (the 8% and 10% age shares, the multiplier of 2). It correctly sits in the evidence update, not the deck, which means the deck has no market sizing at all. Scalability is plausible only if extended beyond fractures; the entry does not argue that.
7. Safety and ethics: 6. Strongest area. Locked controls, verifier, human review, "never silently dismissed", closure gate, patient answers never change category. Deductions: the false-reassurance guarantee only covers the rules engine on synthetic vignettes; the keyword reader silently dismissed 4 of 12 real-shorthand fractures; the floor logic that stops an AI "no" overriding a keyword "act" is good but does nothing for reports where both say no. Arabic and Malay patient text is author-translated and unreviewed. Check-in red-flag list (cauda equina, fever, weight loss) is labelled LOCAL, cites NICE NG59/NG12 "from memory", and goes well beyond osteoporosis scope into a general back-pain triage tool with no sign-off. No DPIA, consent or ethics approval.
8. Team and execution: 4. One named person, an orthopaedic medical officer. Real domain credibility and a lot shipped. But he is a single author, based, as far as the deck says, at no UAE institution, with no named clinical lead (the packs refer to "the clinical lead" as a role that does not yet exist), no radiologist, no informatics partner, no DoH contact. Execution of the prototype is excellent; execution of the hard part (a site, data, sign-off) is zero.
9. Clarity of the pitch: 6. The story slide is clear and the ask is small and measurable. Deductions: three internal documents disagree on the headline numbers (see below), and the deck is visibly template-shaped.

Average: 5.0.

## Top 5 reasons not to shortlist

1. No evidence the headline AI function works. "AI reader: Not yet measured" appears in the pack, the data model, and slide 6. The deck's whole premise (the keyword baseline fails, so an AI reader fixes it) is untested. Without an AI result there is no entry beyond a workflow mock-up.
2. Everything is synthetic and author-written, including the labels. The pack concedes "None of these results shows clinical validity". With 40 entries, I will rank any entry with a real de-identified report sample above this one.
3. No local access of any kind. No Abu Dhabi hospital, no DoH contact, no UAE guideline (Malaysian CPG stand-in), no named buyer, and the one UAE-specific regulatory finding (AI policy certification) is unplanned. The ask is "permission and a named contact", i.e. the team has none.
4. Prior art is not distinguished. INTERCEPT is an RCT-registered system doing NLP-on-radiology-reports to GP alert. XRAIT has published external sensitivity. The entry's difference is "owner, clock, closure gate", but FLS coordinators already supply that and the entry has no data showing software workflow works without a coordinator.
5. Market size is small and unproven, and the deck omits it. About 420 untreated fractures a year in the emirate (estimate, own proxy inputs). No cost model, no price, no buyer, no pathway from pilot to contract.

## Five hardest Q&A questions and what a strong answer looks like

1. "Your AI reader has no number. What is its sensitivity on real Abu Dhabi radiology reports, and why should I believe it above the keyword baseline you already admit misses a third of fractures?" Strong answer: a number, produced before the finals, from at least 200 de-identified real reports (any source, even Malaysian MOH reports with approval) labelled blind by two clinicians, with confidence intervals, read through the same verifier. If not available: show the miss rate of the AI reader on the 15 stress, 12 real-format and 15 Arabic reports today and commit to the blind set date.
2. "Which model reads the report in Abu Dhabi, given Article 13 and the DoH AI policy requirement for certification?" Strong answer: a named UAE-hostable open-weight model (Jais 2, Falcon-H1) run on-premises, benchmarked on Arabic and English reports with its licence checked, plus a statement of what DoH certification route applies, and that the keyword path alone is the fallback with its known miss rate.
3. "Who pays, and what changes in their budget?" Strong answer: a named buyer (hospital orthopaedic department or quality office) with an expressed interest, a cost per case found and treated, and the avoided cost per hip fracture; one hospital's number from the 4-week pilot as the denominator for the price.
4. "INTERCEPT already does this. What does your loop deliver that a GP alert plus an FLS nurse does not, and where is the evidence that your closure gate raises treatment rates?" Strong answer: an honest statement that no outcome evidence exists yet, and a pre-registered pilot design with a specific measurable endpoint (e.g. dispensing within 6 months versus the site's historical baseline) and how you will control for secular change.
5. "A radiologist in Al Ain reads 'VCF' or 'compresion fracure' and your keyword reader says 'no'. Who is liable, and how does the system avoid false reassurance for this patient?" Strong answer: the report stays with the radiologist's own pathway; OsteoLoop only adds a flag; the floor logic and "review, not dismiss" rule; show the measured silent-dismissal rate of the final (AI plus keyword) pipeline and an audit of every dismissed report.

## Unsupported, overstated, or contradictory claims (quote and file)

Numbers that disagree across documents:

- Stress-set results. README.md and submission-pack.md section 4 and slide `evidence.html`: "Keyword baseline, stress set 33%", "3/12 caught", "6 of 12 fractures dismissed". bench/results/finder.md and the app's own benchmark table: exact 40%, act sensitivity 4/12, "silently dismissed 4", "surfaced to a human 8/12". The pack says "6/12 surfaced to a human"; the results file says 8/12. The deck's headline honesty number is stale.
- Loop scenarios. README.md: "35/35". submission-pack.md section 4: "26/26 scenarios". bench/results/loop.md: "Passed 40/40". bench/README.md: "35 scenarios". Slide `evidence.html`: "35/35".
- Check-in. README and pack: "27/27 answer sets". docs/checkin.md and results/checkin.md: "56 answer sets, 27 checks, 83/83".
- Verifier adversarial. README and bench README: "6/6". Slide `evidence.html`: "Verifier adversarial checks 9/9".
- Arabic and real-format. bench/README.md: "Arabic 14/15 exact, 1 silently dismissed (AR15)" and "Real-format 8/12 exact, 1 silently dismissed (RF05)". bench/results/arabic.md: "exact 100% (15/15)... silently dismissed 0". bench/results/real-format.md: "exact 75% (9/12)", "silently dismissed 0" and RF05 is "review", not "no". Either the README is describing an earlier run or the results were rerun after the lexicon was extended, which the README says was not done.
- Bench README repeats the heading "Headline safety numbers" twice; a copy-edit, but it signals unchecked assembly.
- "AI reader: Claude... called from the page inside claude.ai" (README) versus "Keep the model swappable... UAE-hosted model" (pack section 7) versus `uae-doh` profile `local-only` keyword reader (site-profiles.md). The only configuration a UAE site can legally use today has no AI reader at all.

Claims that are unsupported or overstated:

- Pack section 7, data residency: "The source I opened says the breach fine is AED 500,000 to AED 700,000." evidence-update.md: "Not confirmed in this session. The Tamimi implementing-regulations page does not mention penalties." Also pack says "[UNVERIFIED: article number...]" while evidence-update resolves it as Article 13. The pack was not updated with the corrections that evidence-update lists in "What this changes in the pitch" (Malaffi, AI policy, Kaiser, CPG summary, HealthOST number).
- Pack section 5: "The 510(k) number was not in the source I opened" versus evidence-update: K213944, 22 April 2022.
- Pack section 7 and source 20: CPG thresholds "[UNVERIFIED]", "the summary gives no FRAX cut-offs" versus evidence-update, which says PMID 37496985 is the summary and the thresholds were verified, but only via a PDF mirror after a CAPTCHA. The rules citation in `src/rules.js` still needs correction by the author's own account.
- Deck, slide `deploy.html`: "Plug into Malaffi: FHIR R4 export is planned, not built. Malaffi's required standards are to be confirmed." evidence-update has already established Malaffi lists five standards and SNOMED CT with no FHIR mention. "Plug into Malaffi" as a heading oversells a connection with no specification, no contact, and an integration architecture (HL7 files, FHIR JSON) aimed at a different interface.
- Slide `safety.html`: "The AI reads. It never decides." The finder's decision is "whichever ranks higher" of the two readers (slide `how.html`), and the AI can set `act`, which opens a loop with a "very high" category in the app (L24, L30). It "decides" what gets surfaced. The honest statement is "the AI proposes, a human confirms".
- Slide `safety.html`: "Guideline-blocked drugs are never offered." This is true on 57 synthetic vignettes against a formulary that is a placeholder ("Formularies are placeholders", integration.md). It is a unit-test claim presented as a product guarantee.
- Slide `safety.html` and pack section 6: "Deterministic and source-tagged: NICE NG259 (2026)". The pack's own source 19 says the NG259 fast-track recommendation "was not on the page opened", and evidence-update says "Not resolved". The 6-week fast-track the loop depends on (README stage 2) therefore has no confirmed source text.
- Pack/deck cite "Closest prior art: INTERCEPT... results are not yet reported" and the pack's 70-80% figure comes from the INTERCEPT protocol introduction, which the evidence update flags as "Opened: N". The problem slide's lead statistic is from a source the author never opened.
- Slide `problem.html` uses Mitchell 2017 (Oxford, 157 hip fracture patients), Lindsay 2001 (placebo arms of trial cohorts, mean age 74) and a 2026 Taiwanese cohort for a UAE pitch. Slide notes admit: "I found no national UAE treatment-gap figure." Presented on the slide, though, as a general fact.
- Pack section 5: Kaiser "reduced hip fractures by an average of 37.2%". evidence-update: no control group described, primary article not found. Omitted from the deck, which is correct, but the pack comparison table still has five "UNVERIFIED" cells in the Kaiser column.
- README: "OsteoLoop computes... directly from stage timestamps." In the live app, Health shows "Cases found by the case finder: 0" and the data-model doc says "The seeded case was not derived from the report, so the link is a stand-in, not a real trace." The finder-to-indicator chain is demonstrated by assertion, not data. Also the indicator denominator is 5 (data-model) or 4 (app), "means little".
- docs/data-model.md: seeded case C-1004 "is not supported by its linked report", and the quoted evidence drops "No acute fracture is seen;" before "however", so the quote shown to the clinician reads as an affirmative fracture. That is exactly the failure the verifier is supposed to prevent, documented but unfixed.
- docs/site-profiles.md: the app gives urgent cases a 42-day confirm clock versus 30 days for standard cases. The authors flag it as probably wrong. It is in the shipped defaults and the Health tab's "22 days to confirmation" is computed on it.
- Pitch claim "Closure requires evidence" and "audit": pack section 9 says "no database, authentication or audit trail yet. State is in memory only. A page reload resets the demo." integration.md: "Access control and audit logging for any feed are not built." The DoH AI policy requires auditable validation statements and audits; none exist.
- docs/checkin.md: "NICE NG59 and NG12 are cited from memory". Same document says "No AI", while the pack/deck present the check-in as part of the "AI loop"; the check-in is scope creep into back-pain triage.

## What moves it from interesting to shortlist to winner

To shortlist:
- A measured AI-reader result (even on a small real or realistic set) with miss rate and false-positive rate, reported next to the keyword baseline, with the keyword/AI disagreement analysis. Update slide 6 and the pack to match bench/results.
- One named UAE-based clinician or radiologist as co-signatory, who has labelled at least a first blind set, and the rules signed off by them.
- A concrete data-residency design: a named UAE-hostable model running locally, with a benchmark. The Claude-only reader cannot be the headline in the UAE.
- One letter or email trail from a UAE hospital (or DoH HIE contact) showing the pilot is wanted.
- Reconcile every number in the repo so the three documents and the deck agree.

To winner:
- A running read-only retrospective run on real de-identified reports from at least one hospital (in or outside the UAE, if the UAE route is slow), giving the actual count of documented-but-untreated fractures and clinician-verified precision. "We found N untreated fractures in 12 months of reports at hospital X" is the single sentence that wins this track.
- A DoH-aligned indicator discussion with a named quality owner, with the denominator computed on real data.
- A cost model: staff time per case found, cost per treated patient, versus hip fracture cost avoided.
- An explicit regulatory position (decision support classification and the AI policy certification route) confirmed in writing by DoH.
- A clearly separated v1 scope. Drop the back-pain red-flag triage and Malay and unreviewed languages from the pitch.

## Single biggest change demanded

Run the AI reader (UAE-hostable open-weight model, not the Claude-in-claude.ai path) on real de-identified radiology reports labelled blind by a local clinician, and put that number on slide 6 in place of "Not yet measured". Everything else on the entry (loop, indicator, ask) hangs on it.

## Does the deck read as generic AI slop?

Partly yes. The structure is the standard generated-pitch skeleton: problem with three big statistics, a story, "how it works" in four numbered cards, a safety slide, an evidence table, a comparison table, a deployment slide, an ask. Specific tells:

- `compare.html` title "Prior art proves the problem. OsteoLoop owns the loop." and `cover.html` "Find the fractures already written in the report, and make sure they reach treatment." Aphoristic two-clause slogans.
- `story.html` "One sentence in one report, and no owner", and the speaker note "What was missing was an owner, a clock and a reason for anyone to act." Triplet rhythm. The same rhythm recurs: "Each has an owner, a clock and a closure gate" (how), "Owner, clock, closure gate" (compare), "owners, clocks and the closure gate" (ask).
- `safety.html` "The AI reads. It never decides." and "Quote it or it does not count". Punchy fragments, and the first is overstated (see above).
- `how.html` "Read, verify, review, then own the loop" with one-word card labels "Two readers", "Quote it", "A clinician looks", "Seven stages".
- `deploy.html` "Deployment is a plan, not a claim" and `evidence.html` "What the benchmark shows, and what it does not". The hedging is genuine but delivered in a formula.
- The story slide is a fictional 71-year-old woman with a cough and an incidental T8 fracture, the textbook AI-generated vignette. The same text appears as a README sample.
- Speaker notes read like instructions to a model ("Walk left to right.", "Be upfront.", "replace this row once the in-page benchmark has been run", "Open with the one-line pitch"); the last two are visible leftovers.
- The deck contains no UAE-specific detail beyond a citation of Jawda and a law name. Nothing in it says anyone has been to an Abu Dhabi hospital.

To its credit, the candour (the 33% stress figure on a slide, "Not yet measured" in a table) is unusual and is the deck's best asset.

What only the author could supply, and the deck lacks:
- First-person clinical experience: a real (de-identified, consented) case or a count from his own ward of fragility-fracture patients discharged without bone medicine. Orthopaedic MOs see this daily; the deck has not one such sentence. For example, the proportion of hip fracture admissions in his own unit who leave with no bisphosphonate or denosumab, collected by chart audit this week.
- What actually happens in a Malaysian MOH hospital (his own system): who owns the discharge summary, whether there is an FLS or osteoporosis clinic, how DXA access works, where a radiology report actually goes. This is the insider knowledge no one else on the panel can fake, and it is entirely missing, as is any mention of his hospital, his supervisor, or his real publication record on AIS imaging.
- Real, specific reader failure examples from reports he has personally seen (the exact shorthand his radiologists use), in place of synthetic "# NOF" and "VCF" strings that read as imagined.
- His honest account of why Abu Dhabi: no contact, no site, and the author is not UAE-based; the deck is silent on that mismatch. A candid line (here is the Malaysian pilot route, here is how it ports) would be better than leaving it implicit.
- A named co-clinician and a named radiologist.
