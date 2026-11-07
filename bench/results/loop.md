# Loop scenario results

Passed **68/68**. Each test drives the real app (index.html) headless and checks one guarantee.

| ID | Guarantee | Official requirement | Result |
| --- | --- | --- | --- |
| L01 | Full journey closes only with evidence | Req 1, 5 | PASS |
| L02 | Closure gate refuses a case with incomplete evidence | Req 5 | PASS |
| L03 | Overdue stage is alerted and pinned | Req 2 | PASS |
| L04 | Second missed clock escalates to programme lead | Req 2, 5 | PASS |
| L05 | Unassigned case is pinned and cannot progress until someone owns it | Req 2 | PASS |
| L06 | Rejected referral keeps the GP as owner and offers reroute | Req 2, 4 | PASS |
| L07 | Rejection from the specialist inbox lands back on the GP board | Req 4 | PASS |
| L08 | Wrong teach-back blocks progress until a nurse call | Req 3 | PASS |
| L09 | Declining requires a reason and a signer, and counts as a drop-off | Req 5, 6 | PASS |
| L10 | Every open case has an owner or is pinned as unassigned | Req 2 | PASS |
| L11 | Very-high-risk case shows the 6-week fast-track | Req 5 | PASS |
| L12 | Treatment cannot be signed without a named prescriber | Req 5 | PASS |
| L13 | New patient screened at intake opens a loop with the right category and owner | Req 1, 2 | PASS |
| L14 | Below-threshold patient gets no loop and no false alarm | Req 1 | PASS |
| L15 | High FRAX without DXA opens a loop as "DXA needed", never as low | Req 1, 5 | PASS |
| L16 | Entered DXA result re-runs the category; a missing T-score is refused | Req 5 | PASS |
| L17 | Patient outside the CPG population is flagged at intake | Req 5 | PASS |
| L18 | Reset restores the seeded demo | Demo | PASS |
| L19 | Patient check-in reporting a recent fracture reaches the clinician as urgent, and is pinned until reviewed | Req 3, 6 | PASS |
| L20 | Stopping denosumab is flagged as a rebound risk, in Arabic, shown to the clinician in English | Req 3, 6 | PASS |
| L21 | A seeded patient flag is pinned on the board at start | Req 2, 6 | PASS |
| L22 | "Every dose" check-in can be accepted as the adherence check at follow-up | Req 5 | PASS |
| L23 | Check-in cannot start before the patient has acknowledged the result | Req 3 | PASS |
| L24 | Case finder turns an incidental vertebral fracture in a chest X-ray report into a high-risk case when its age is unknown | Req 1, 2 | PASS |
| L25 | Trauma and tumour reports are not offered as cases; AI controls are hidden outside claude.ai | Req 1 | PASS |
| L26 | Benchmark table shows the rules' honest stress-set result, and Health shows the proposed indicator | Req 6 | PASS |
| L27 | Finder: a fracture on alendronate goes to "Treatment review" (VH2), not a silent skip | Req 1, 5 | PASS |
| L28 | Finder skip for a palliative patient logs status skipped with its reason and opens no case | Req 1 | PASS |
| L29 | Treatment review opens a very-high-risk case for a fracture on alendronate, and records the pharmacy record | Req 1, 5 | PASS |
| L30 | Hip or pelvic fragility fracture on MRI with marrow oedema opens as very high risk | Req 1, 2 | PASS |
| L31 | Abnormal electrophoresis blocks signing in a vertebral-fracture case; normal electrophoresis allows it | Req 5 | PASS |
| L32 | Vertebral fracture with electrophoresis not done: Sign is disabled, and a reason alone is not a waiver | Req 5 | PASS |
| L33 | Denosumab: dispensing sets the next dose; warn 14 days before due, overdue crit after 28 days; record dose clears it | Req 5, 6 | PASS |
| L34 | A closed case with denosumab due stays pinned on the board, and recording the dose clears it | Req 6 | PASS |
| L35 | Closure as treated hands the patient to long-term follow-up; Health says closed is not cured | Req 5, 6 | PASS |
| L40 | Check-in wizard: each new control renders; the clinician summary lists red flags first and marks everything patient-reported | Req 3, 6 | PASS |
| L41 | Check-in wizard in Arabic is right-to-left; the summary records the answers were given in Arabic | Req 5 | PASS |
| L42 | Language picker offers English, العربية and Bahasa Melayu; a same-day red flag gives the Malay emergency message | Req 5, 6 | PASS |
| L43 | Free text containing HTML or script is shown escaped on the clinician card | Req 4 | PASS |
| L44 | A 5,000-character complaint is kept to 1,000 characters and says so on the clinician card | Req 4 | PASS |
| L45 | Import: a pasted report opens a finder item, unreviewed, with the keyword decision shown; the box is cleared | Req 1 | PASS |
| L46 | Import: a CSV pasted into the box opens a finder item | Req 1 | PASS |
| L47 | Import: a CSV uploaded as a file runs the same import | Req 1 | PASS |
| L48 | Import: an HL7 v2 message is refused while the site profile has the route off, and opens a finder item once it is on | Req 1, 5 | PASS |
| L49 | Import: a FHIR bundle opens a finder item with age and sex taken from its Patient | Req 1 | PASS |
| L50 | Import: malformed FHIR is refused with a plain error and adds nothing | Req 1 | PASS |
| L51 | Import: an HL7 message cut off mid-result is held in review, never closed as no action | Req 1 | PASS |
| L52 | Import: a report with no age or sex is held in review, with the reason shown | Req 1 | PASS |
| L53 | Import: HTML in report text is shown as text, not markup | Req 4 | PASS |
| L54 | Site profile: uae-doh shows the interim banner and labels the guideline as interim; my-moh shows neither | Req 5 | PASS |
| L55 | Site profile: switching the profile changes the stage clock shown (override on uae-doh) and the default language | Req 5 | PASS |
| L56 | Site profile: an override that would turn off the verifier is refused, shown on screen, and the template is used | Req 5 | PASS |
| L57 | Residency: local-only hides the AI reader controls with the reason, and never asks for the sample capability | Req 5 | PASS |
| L58 | Residency: with the AI reader allowed, report text is de-identified before the sample call | Req 5 | PASS |
| L59 | FHIR export carries the active site profile as a meta tag (still SYNTHETIC); Health names the profile | Req 6 | PASS |
| L60 | Site profile: generic offers English only and says no guideline is selected | Req 5 | PASS |
| L61 | Import: a held report (no age or sex) can be opened after review; the case says age and sex are unknown | Req 1, 5 | PASS |
| L62 | Calcium 2.10: denosumab Sign is disabled and the card says calcium is low | Req 5 | PASS |
| L63 | Calcium missing: denosumab Sign is disabled, "needs result first" is shown on the drug, and the card asks for calcium | Req 5 | PASS |
| L64 | Denosumab: vitamin D 42 keeps Sign disabled; with calcium and vitamin D in range Sign is enabled and signs | Req 5 | PASS |
| L65 | Electrophoresis waiver with a reason and a named clinician lets a vertebral-fracture case sign, and is logged | Req 5 | PASS |
| L66 | Abnormal electrophoresis cannot be waived: no waiver control, Sign stays disabled | Req 5 | PASS |
| L67 | Intake: a DXA T-score of -2.8 with FRAX 8% and 1% is High (rule H1), not low | Req 1, 5 | PASS |
| L68 | Intake: a DXA T-score of -2.4 with no FRAX is "FRAX needed", not low, and opens no loop yet | Req 1, 5 | PASS |
| L69 | Intake: an undated vertebral fracture shows the fracture-date prompt on the result and on the case | Req 1, 5 | PASS |
| L70 | Patient stage-1 message does not name osteoporosis before DXA, in English, Arabic and Malay | Req 6 | PASS |
| L71 | Health: the high-risk treatment metric counts only high and very-high cases in its denominator | Req 6 | PASS |
| L72 | Page declares a phone viewport and English as the document language | X-1 | PASS |
