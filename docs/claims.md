> **Read this first (12 Nov 2026).** This claim check covers the OLD single-page prototype (`index.html`) and the documents written for it on 8 Nov 2026. It does not cover the Console in `app/`, the current `README.md`, `docs/solution-brief.md` or `docs/video-script.md`. For the Console, the evidence and its limits are in `docs/decision-log.md`.

# PeriLoop submission docs: claim check (final build, 2026-11-08)

Every factual sentence in brief.md, README.md and video_script.md, with the evidence it rests on and its status.

Status key:
- VERIFIED: checked in this pass, by running a test or script, or by reading the file named.
- UNVERIFIED: not checked in this pass, or stated by the author only, or not recorded in any file in the review set. An UNVERIFIED row must be fixed or removed before submission.

Evidence key (this pass, `cd /home/claude/periloop`, run on 2026-11-08):
- T: `node test.js`, 30/30 cases pass. Groups: escalation 7/7, false-alarm control 2/2, never answered 6/6, closure 2/2, overdue 8/8.
- ADP: `node mod/adapter.test.js`, 18 PASS, 0 FAIL.
- CR: `node mod/chat_ratelimit.test.js`, 5 PASS, 0 FAIL.
- CON: `node mod/contradictions.test.js`, 17 PASS, 0 FAIL.
- G2: `node mod/guard2.test.js`, 121 PASS, 0 FAIL (80 recorded replies, 40 adversarial, 1 coverage).
- INT: `node mod/intake.test.js`, 258 PASS, 0 FAIL.
- ITV: `node mod/interview.test.js`, 43 PASS, 0 FAIL.
- KNO: `node mod/knowledge.test.js`, 18 PASS, 0 FAIL.
- NEG: `node mod/negation.test.js`, 42 PASS, 0 FAIL.
- OTD: `node mod/otdate.test.js`, 80 PASS, 0 FAIL.
- PE: `node mod/proxy_e2e.test.js`, 19 PASS, 0 FAIL (real proxy, stub upstream).
- RG1: `node mod/regress1.test.js`, 22 PASS, 0 FAIL.
- RG2: `node mod/regress2.test.js`, 494 PASS, 0 FAIL.
- RG3: `node mod/regress3.test.js`, 181 PASS, 0 FAIL.
- RV1B: `node mod/review1b.test.js`, 22 PASS, 0 FAIL.
- R3: `node mod/round3.test.js`, 239 PASS, 0 FAIL.
- SC: `node mod/second_check.test.js`, 26 PASS, 0 FAIL.
- ARC: `node mod/arabic_engine.test.js`, 538 PASS, 0 FAIL.
- ARCC: `node mod/arabic_content.test.js`, 80 PASS, 0 FAIL.
- AR5: `mod/unseen5_ar_firstpass.txt` and `mod/second_check/ar_combined_firstpass.txt`, read as printed output. Their scoring script was not run in this pass (not on the permitted run list), so every AR row that quotes these figures is UNVERIFIED.
- EV4: `node eval4.js` output equals `mod/unseen4_firstpass.txt` (diff, identical).
- EV4C: `node eval4_combined.js` output equals `mod/second_check/combined_firstpass.txt` (diff, identical).
- Files read: engine.js (grep and line reads), mod/intake.js (grep), mod/second_check.js, mod/adapter.NOTE.md, mod/haiku_harness.README.md, mod/public_figures.md, mod/unseen3_firstpass.txt, mod/unseen4.json (header), review1.md, review2.md, review3.md, src.html (grep and line reads), index.html (grep of the voice and RTL lines), review3.md (grep for Arabic: no entries), mod/unseen5_ar_firstpass.txt, mod/second_check/ar_combined_firstpass.txt, mod/adapter.NOTE.md.

Browser behaviour (clicks on the live page) was not re-run in this pass. Claims about what appears on screen are VERIFIED only where the source shows the text. Otherwise they are UNVERIFIED.

## Changes from the previous claim check

- The "eight outcome classes" list is corrected. The engine does not emit a CLOSE class. It emits ACK and OK, which the old list did not name. See B10.
- "Ten further suites" is now sixteen (new: chat_ratelimit, guard2, otdate, proxy_e2e, regress3, second_check). See B66.
- "Two review reports, five fix rounds" is now three reviews and six rounds (review3.md, round 6). See B93.
- Arabic (ar) added as the fourth language. Suites grew from sixteen to eighteen (new: arabic_engine 538 checks, arabic_content 80 checks). See B66, ARC, ARCC and the AR rows.
- Arabic blind set (unseen5_ar, 120 messages) added. Its figures are as printed. The scoring script was not re-run, so those rows are UNVERIFIED.
- The request said "no Arabic voice input". The source maps Arabic to the browser's speech recognition (ar-SA) in the Use voice button, so the docs say Arabic voice input is not tested. See AR05.
- The unseen4 set and second-check results are new. The harness set 1 and set 2 numbers were reported by the author and are not in the review set. See B88 to B90.

## brief.md

| ID | Claim | Evidence | Status |
|---|---|---|---|
| B01 | Status is a working prototype, final build as of 2026-11-08, not clinically tested, decision support only. | No clinical test in any file read. Suites are software tests (T, ADP, etc.). | VERIFIED |
| B02 | The demo runs scripted by default and no AI model is switched on in the demo; the Settings card says so. | src.html line 121 "scripted, no AI"; line 735 Settings text. | VERIFIED |
| B03 | The author is a solo orthopaedic medical officer in Malaysia. | Author statement only. | UNVERIFIED |
| B04 | In elective orthopaedic care, a result or task is often found, but nobody clearly owns the follow-through. | mod/public_figures.md gives non-orthopaedic figures only. No orthopaedic-specific ownership figure. | UNVERIFIED |
| B05 | Small steps such as pre-op bloods, consent or insurance pre-authorisation are the ones missed. | Pre-authorisation appears as a shared item (engine.js SHARED list). No missed-step rate measured anywhere. | UNVERIFIED (rate not measured) |
| B06 | Each patient has a checklist of 12 shared items and 2 procedure-specific items. | engine.js line 13 SHARED list present; the count of 12 and the 2 per pack were checked by review3 (Overview audit) but not counted in this pass. | UNVERIFIED (count not re-run) |
| B07 | Six procedure types are covered as data packs. | mod/interview.js PROCEDURES (TKR, THR, ACL, LUMBAR, SHOULDER, FOOTANKLE, read in an earlier pass); R3 and ITV run all six. | VERIFIED |
| B08 | An abnormal result becomes a HOLD with an owner. | engine.js lines 256-259: HOLD returned with a task; line 259 says owner will contact the patient. | VERIFIED |
| B09 | Late items are re-pinged to the owner, nudged to the patient, then escalated after a cap of 3. | engine.js line 5 CFG: rePingCap 3, nudgeCap 3, rePingEvery 1, nudgeEvery 24; lines 313 and 321 use the caps; T overdue 8/8. | VERIFIED |
| B10 | Sorts each message or result into an outcome class: EMERGENCY, SAME-DAY, HOLD, OVERDUE, ROUTE, ASK and ANSWER. The engine also returns ACK and OK. Closing a task is a separate step, not a class. | Class strings found in engine.js and mod/intake.js: EMERGENCY line 180, SAME-DAY line 201, ROUTE 205, ANSWER 209, ACK 210, ASK 211, OK 262, HOLD 256, OVERDUE (intake.js line 295). No CLOSE class string in engine.js, intake.js or interview.js. Closure is a task state (`state !== 'closed'`). | VERIFIED (corrected) |
| B11 | Fixed rules run first. | engine.js classify checks red flags before routes (lines 180-214); adapter.js classifies before any model call; ADP 18/0. | VERIFIED |
| B12 | Intake interview covers six procedure types in English, Bahasa Malaysia, Chinese and Arabic. | ITV 43/0; R3 239/0 (every question across six procedures, en, ms, zh); ARCC 80/0 (every question has Arabic text; all six procedures build in ar). | VERIFIED |
| B13 | Malay, Chinese and Arabic interview wording is a machine draft pending native review. | mod/intake.js line 3 ("ms and zh values ... are machine drafts") and review2.md round 5 open item for ms and zh; ARCC 80/0 "Arabic text is reviewed:false on every question" for ar. | VERIFIED |
| B14 | The doctor summary is rule-based, with no model. | mod/intake.js: 0 matches for adapter, fetch, askSafely (grep). Interview and knowledge read in an earlier pass. | VERIFIED |
| B15 | The doctor summary flags contradictions. | CON 17/0. | VERIFIED |
| B16 | The doctor summary flags incompleteness (unanswered or unclear questions). | intake.js lines 312 and 359 (gaps, "Not answered"); R3 239/0. | VERIFIED |
| B17 | The to-do list is generated from the summary and sent to the Staff board in one step, de-duplicated. | src.html lines 516-517 ("Already sent"); review1.md round 1 "send twice" (browser, not re-run). | VERIFIED (source); UNVERIFIED (browser click) |
| B18 | The Ask box answers from layered sources: country, hospital, team and surgeon. | knowledge.js layers; KNO 18/0. | VERIFIED |
| B19 | Each Ask box answer shows its source and owner. | src.html line 547 renders the source layer and owner; KNO 18/0. | VERIFIED |
| B20 | Clinical questions such as blood thinners, antibiotics, flying and stopping injections go to a clinician. | engine.js line 214 "never guess" ROUTE with noAnswer; line 205 clinical judgement ROUTE; CON 17/0 (blood thinner never NONE); T never answered 6/6. | VERIFIED (engine route) |
| B21 | Clinical questions reach a clinician in the live page. | Click-through not re-run. | UNVERIFIED |
| B22 | In model mode, emergency, same-day and clinical-judgement routes never reach a model. | ADP 18/0; G2 121/0. | VERIFIED |
| B23 | Model provider is swappable through configuration. | ADP 18/0 ("provider swap by config only"); mod/adapter.NOTE.md item 3. | VERIFIED |
| B24 | A server-side proxy exists and has been tested end to end against a stub upstream, not a live provider. | mod/server/chat.js present; PE 19/0 ("real chat.js ... stub upstream"); adapter.NOTE.md item 5. No live key in any file. | VERIFIED |
| B25 | Second check, AI mode only, can raise a message's urgency after the rules run. | second_check.js (combine function, line 112); SC 26/0; src.html line 733 ("AI via proxy only"). | VERIFIED |
| B26 | The second check cannot lower a message's urgency. | second_check.js combine (line 112); SC 26/0 (raise-only checks). | VERIFIED |
| B27 | The scripted demo does not run the second check. | src.html line 733 names AI mode only. The "no network calls" claim is not made in the docs (browser not re-run this pass). | VERIFIED (source) |
| B28 | Requirement 2: late items are re-pinged, nudged, then escalated after 3 attempts. | Same evidence as B09. | VERIFIED |
| B29 | Requirement 3: patient replies are fixed text (draft) in English, Bahasa Malaysia, Chinese and Arabic. | Red-flag replies in en, ms, zh: NEG 42/0, RG2 494/0. Replies in ar: ARC 538/0 (EMERGENCY replies and FAQ ANSWER rows with lang ar). Fixed text for every reply in all four languages not enumerated. | UNVERIFIED (full reply set) |
| B30 | Some Ask box answers are sample drafts labelled "SAMPLE draft, not approved". | src.html line 704 and knowledge.js line 12 carry the label; mod/review1b.test.js lines 148-149 check it. | VERIFIED |
| B31 | Requirement 4: Malaffi and Sahatna integration is planned, not built. | src.html contains "Sahatna" (grep, count 1); line 146 "it is not built here" (earlier pass). | VERIFIED |
| B32 | Requirement 5: a red flag in the interview stops the interview and creates an urgent task. | mod/interview.js applyRed; RV1B 22/0; RG1 22/0. | VERIFIED |
| B33 | Requirement 5: unacknowledged alerts are re-paged up to 3 times, then an on-call fallback is used. | engine.js lines 5-8 and 313 (rePingCap, on-call fallback). The "until acknowledged" wording was removed from the docs. | VERIFIED |
| B34 | Requirement 6: a task closes only with attached evidence plus a clinician, or a documented decision with a reason. | engine.js close_refused (line 238, earlier pass); T closure 2/2. | VERIFIED |
| B35 | Requirement 6: "ok" is refused. | T closure 2/2; engine.js close_refused. | VERIFIED |
| B36 | Requirement 6: impact measurement is not yet done. | No impact data in any file. | VERIFIED |
| B37 | The Overview has per-patient checklists. | Not clicked this pass. | UNVERIFIED |
| B38 | The prototype is one web page with six parts: Overview, Patient phone, Intake, Staff board, 30-case tests, How it works. | src.html line 75 nav: Overview, Patient phone, Intake, Staff board, Tests, How it works. | VERIFIED |
| B39 | Demo patients are Mdm Aisha (62, knee), Mr Wong (59, lumbar) and Mr Farid (70, hip). | src.html lines 232-236 (names, procedures), lines 251-253 (ages 62, 59, 70, fictional). | VERIFIED |
| B40 | Covers six elective orthopaedic procedure types and models pre-op screening and closure of shared steps. | B07, B08, B34. | VERIFIED |
| B41 | Layered knowledge store with citations; adapter separates model provider from rules. | B18, B19, B23. | VERIFIED |
| B42 | No real database or login. | No database or auth code in any file read; single HTML page. | VERIFIED |
| B43 | Planned revenue unit is one operation episode paid for by a hospital, starting with a pilot. | Author plan. | UNVERIFIED (plan) |
| B44 | No revenue figure exists. | No revenue figure in any file read. | VERIFIED |
| B45 | Written permission from the Ministry of Health and the clinic has not been obtained. | Author statement. | UNVERIFIED |
| B46 | Pilot is planned at a clinic with an existing Telegram FAQ and red-flag bot. | Author plan. | UNVERIFIED |
| B47 | No data protection assessment has been done for the UAE. | No assessment in any file read. | VERIFIED |
| B48 | Synthetic data only; all patients are fictional. | FIC- ids in mod/histories.json and src.html. | VERIFIED |
| B49 | The unseen4 test messages were written by an AI model, not by patients. | mod/unseen4.json header: "AI-written, not from patients; authored blind to the rules". | VERIFIED |
| B50 | Red flags are caught first, in English, Bahasa Malaysia, Chinese and Arabic. | NEG 42/0; RG2 494/0; RG3 181/0 (cyanosis, collapse, bladder, overdose in en, ms, zh); ARC 538/0 (EMERGENCY classes in ar). | VERIFIED |
| B51 | Red-flag vocabulary covers stroke signs, seizure, fainting, vomiting blood, anaphylaxis, overdose, self-harm and heavy bleeding, among others. | engine.js term counts: stroke 9, seizure 1, faint 2, vomit 1, anaphyl 2, overdose 2, self-harm (SELF_HARM_RE) 7 mentions, bleed 3. | VERIFIED |
| B52 | Model mode is guarded; a model reply is checked before it is shown. | ADP 18/0; G2 121/0. | VERIFIED |
| B53 | A reply that reassures, or makes a clinical decision, is replaced with scripted text. | G2 121/0 (40 adversarial replies stay blocked); adapter.js guardReply. | VERIFIED |
| B54 | Clinical questions with no approved answer are routed to a clinician. | engine.js line 214 ROUTE "no approved answer", noAnswer, "never guess". | VERIFIED |
| B55 | A question that matches an approved topic can still reach the model in model mode. | review2.md round 5 open item (not re-run). | VERIFIED (documented limit, review2.md) |
| B56 | Some benign questions can still receive a sample draft answer. | review3.md round 6 table, M1 PARTIAL; B30. | VERIFIED |
| B57 | Humans own clinical decisions; the bot never answers blood thinners, antibiotics, flying or stopping injections. | Design statement; engine.js ROUTE lines 205 and 214; CON, T never answered 6/6. | VERIFIED |
| B58 | Closure needs evidence. | Same as B34. | VERIFIED |
| B59 | Clinical thresholds and the interview question tree are drafts awaiting surgeon sign-off; no sign-off is recorded. | No sign-off record in any file. | VERIFIED |
| B60 | In AI mode the patient message text goes to the configured provider, through the proxy. | src.html line 130 "Data protection" note. | VERIFIED |
| B61 | Rules alone caught 42 of 75 urgent messages (56.0%, CI 44.7-66.7) in the blind set. | EV4 (rerun identical to file); unseen4_firstpass.txt line 1. | VERIFIED |
| B62 | Rules alone are partial, and a second check is an option under test, not a validated safety layer. | B61 (42 of 75 caught); "an option under test" is the author's wording; no validation of the second check is claimed. | VERIFIED (data); the conclusion is the author's |
| B63 | The second check has not been validated against clinicians. | No clinician-labelled file in the review set. | VERIFIED (absence) |
| B64 | The 30 test cases all pass; the test suites show the rules behave as intended, not that they are clinically accurate. | T 30/30; the suites are author-written (scope statement). | VERIFIED |
| B65 | Test suite results in section 6.1 (test.js and 18 mod suites) all pass with 0 failures. | T; ADP 18; CR 5; CON 17; G2 121; INT 258; ITV 43; KNO 18; NEG 42; OTD 80; PE 19; RG1 22; RG2 494; RG3 181; RV1B 22; R3 239; SC 26; ARC 538; ARCC 80. All run this pass, all exit 0. | VERIFIED |
| B66 | Eighteen suites in mod/ (excluding test.js). | ls-equivalent run of mod/*.test.js: 18 files (the 16 earlier suites plus arabic_engine and arabic_content), each run this pass. | VERIFIED |
| B67 | Hand-written cases: 30 cases with expected outcomes; the author wrote the cases and the engine together. | T 30/30; author statement for the writing order. | VERIFIED (pass); UNVERIFIED (writing order) |
| B68 | Haiku labelled the 30 cases blind and agreed on 24 of 30; C02, C13, C17, C19, C26, C29 differ. | Carried over from the previous version. No labels file in the review set. | UNVERIFIED |
| B69 | With 7 of 7 escalations, the one-sided 95% lower bound on sensitivity is about 65%. | Arithmetic: 0.05^(1/7) = 0.652. | VERIFIED |
| B70 | unseen3 first pass: 28/45 urgent escalated (62.2%); 1/45 normal falsely escalated (2.2%); 0/45 urgent answered by bot. | mod/unseen3_firstpass.txt, quoted exactly. | VERIFIED |
| B71 | unseen3 per language: en 11/15, ms 9/15, zh 8/15 urgent escalated; normal falsely escalated en 0/15, ms 1/15, zh 0/15; urgent answered 0/15 each. | mod/unseen3_firstpass.txt. | VERIFIED |
| B72 | The 17 unseen3 urgent items not escalated were classed ROUTE with answered=false. | mod/unseen3_firstpass.txt (17 lines, cls=ROUTE answered=false). | VERIFIED |
| B73 | One unseen3 normal item (MS-N05) was escalated, classed SAME-DAY. | mod/unseen3_firstpass.txt. | VERIFIED |
| B74 | Rules were changed after the unseen3 run, so that set is tuned-on. | File times: unseen3_firstpass.txt 10:20, engine.js 12:06; review fix logs rounds 1 to 6. | VERIFIED |
| B75 | unseen4: 150 AI-written messages, authored blind to the rules; 75 urgent and 75 normal; 25 per language in each group. | mod/unseen4.json header; counts by lang and truth (node, this pass): urgent 25 each in en, ms, zh; normal 25 each. | VERIFIED |
| B76 | unseen4 rules only: 42/75 urgent escalated (56.0%, CI 44.7-66.7); 0/75 answered by bot; 0/75 ACK; 8/75 normal falsely escalated (10.7%, CI 5.5-19.7). | EV4 (identical to mod/unseen4_firstpass.txt). | VERIFIED |
| B77 | unseen4 per language: urgent escalated en 12/25 (48.0%), ms 14/25 (56.0%), zh 16/25 (64.0%); normal falsely escalated en 2/25, ms 6/25, zh 0/25. | EV4. | VERIFIED |
| B78 | 33 urgent messages were classed ROUTE, which gives a clinician review within 24 hours (48 hours for a worsening trend). Urgent by class: ROUTE 33, EMERGENCY 25, SAME-DAY 17. | EV4 (class counts); engine.js line 205 and 214 (ROUTE), line 208 (worsening, reviewWithinHrs 48), line 245 (reviewWithinHrs default 24). | VERIFIED |
| B79 | The unseen4 labels are AI judgement, not clinician labels. | unseen4.json header "AI-written"; no clinician label field or file. | VERIFIED |
| B80 | Second check, same 150, scored once by a Haiku stand-in (raise-only): 75/75 urgent caught (100.0%, CI 95.1-100.0); 6/75 normal flagged by Haiku (8.0%, CI 3.7-16.4); rules OR check 14/75 normal flagged (18.7%, CI 11.5-28.9). | EV4C (identical to mod/second_check/combined_firstpass.txt); the file labels the verdicts "Haiku second check only". | VERIFIED |
| B81 | Per language, the second check (combined) caught 25/25 urgent in each of en, ms and zh. | EV4C. | VERIFIED |
| B82 | The same model family wrote the 150 messages. | Not recorded in any file in the review set. | UNVERIFIED |
| B83 | The second-check prompt is biased to "urgent when unsure". | mod/second_check.js SYSTEM_PROMPT: "If unsure, answer urgent." | VERIFIED |
| B84 | Some of the flagged normals may be defensible (calf tightness, three days without a bowel movement). | EV4C lines for U4-035 and U4-101/U4-135 (haiku-only false alarms). Defensibility is a judgement. | VERIFIED (examples); the judgement is the author's |
| B85 | Rules plus check work only in AI mode, through a proxy; the default demo runs rules only and says so. | src.html line 733 (AI via proxy only); line 121 "scripted, no AI"; mod/adapter.NOTE.md. | VERIFIED |
| B86 | The proxy owns the prompt, tested against a stub upstream, not a real provider. | mod/adapter.NOTE.md item 15 (SYSTEM_PROMPT in second_check.js, proxy imports it); PE 19/0; no live provider run in any file. | VERIFIED |
| B87 | Rate limits are in memory, per IP and per instance. | mod/adapter.NOTE.md item 8; CR 5/0. | VERIFIED |
| B88 | Harness set 1 (80 requests): over-blocks fell from 15 before the guard rewrite to 0 after; harmful escapes 0 by manual reading; 10 plus 5 crude-check flags were safe refusals or false positives. | Author-reported. Harness README describes the method; no harness output file in the review set; `evaluate` not run in this pass. | UNVERIFIED (re-run `node mod/haiku_harness.js evaluate` or remove) |
| B89 | Harness set 2 (80 fresh requests): 8 of 25 Chinese summaries still wrongly blocked, falling back to scripted text. | Author-reported. `responses2.json` exists; evaluate not run in this pass. | UNVERIFIED (re-run `evaluate --set 2` or remove) |
| B90 | One set-2 agent first wrote canned replies, and that run was redone. | Author-reported. No record in any file. | UNVERIFIED |
| B91 | In production, the model is used only to rephrase or summarise; the question tree is fixed. | Author statement. The harness README says the adapter sends its own guard and sanitised messages; not traced to the production path in this pass. | UNVERIFIED |
| B92 | Three independent reviews and six fix rounds: review1 (rounds 1-3), review2 (rounds 4-5), review3 (round 6). | Headings in review1.md, review2.md, review3.md (fix logs). | VERIFIED |
| B93 | The reviewers are AI agents, not clinicians. | Files do not name the reviewer type; no clinician sign-off appears in them. Author statement for "AI agents". | UNVERIFIED (reviewer identity is author statement) |
| B94 | Review 3 listed 7 blockers and 6 majors. | review3.md line 5. | VERIFIED |
| B95 | Round 6 fixed all 7 review 3 blockers. | review3.md fix log table, B1 to B7 all PASS; RG3 181/0. | VERIFIED |
| B96 | Review 3 major M1 (benign questions answered with draft text) is only partly fixed. | review3.md fix log: "PARTIAL". | VERIFIED |
| B97 | The round 6 fixes are covered by mod/regress3.test.js and other suites. | RG3 181/0; T; R3 239/0. | VERIFIED |
| B98 | Known open items after round 6 include minor items m1 to m6 from review 2, the Settings tap target, the HbA1c 99 reprompt, and English route text in ms and zh Ask replies. | review2.md lines 67-72 (m1 to m6 listed); review3.md "Not fixed" line and minors list. Not re-run in the browser. | VERIFIED (source lists); UNVERIFIED (current state in the page) |
| B99 | The Settings proxy input is 21 px high, below a 40 px tap target. | review3.md minor (browser measurement, not re-run). | UNVERIFIED |
| B100 | HbA1c "99" gets a generic reprompt, not a range message. | review3.md minor, "Not fixed". | UNVERIFIED (not re-run) |
| B101 | Some English route text remains in Malay and Chinese Ask replies. | review3.md round 6 "Not fixed". | UNVERIFIED (not re-run) |
| B102 | A wound phrase with a comma ("no redness, discharge") still escalates. | review2.md round 5 open item. | VERIFIED (documented; review2.md) |
| B103 | Not yet done: second clinician labelling; surgeon sign-off; native ms, zh and ar review; real patient messages; measured reduction in missed steps; live model or second-check run; Malaffi and Sahatna; real channel; real database or login; UAE data protection assessment. | Absence in files; B31, B36, B42, B47. | VERIFIED |
| B104 | Path to pilot steps (labels, sign-off, fresh set, live run, data-protection assessment, published rate). | Author plan. | UNVERIFIED (plan) |
| B105 | Permission from the employer and the pilot clinic is still needed before any pilot. | Author statement. | UNVERIFIED |
| B106 | Public figures are placeholder sizing only. | mod/public_figures.md summary point 3. | VERIFIED |
| B107 | Four published figures are listed in mod/public_figures.md, with their limits. | mod/public_figures.md table (4 rows). | VERIFIED |
| B108 | OT date: impossible and unpadded dates are refused. | OTD: "parse rejects impossible date", "parse rejects unpadded date" (pass). | VERIFIED |
| B109 | OT date: critical items open within 7 days of the OT date flag the surgery as at risk. | mod/intake.js lines 575 (k <= 7) and 580 (comment: critical items within 7 days of OT are at risk). | VERIFIED |
| B110 | The OT date feature has 80 checks, all passing. | OTD 80 PASS, 0 FAIL. | VERIFIED |
| B111 | Closing a task is a separate step, not an outcome class. | engine.js close_refused (line 238, earlier pass); task state 'closed' (intake.js); no CLOSE class (B10). | VERIFIED |
| B112 | ACK is a benign acknowledgement; OK is nothing to act on. | engine.js line 210 (ACK, "Thanks, noted."); line 262 and 268 (OK). | VERIFIED |
| B113 | ASK is a vague or unknown message sent to a clinician or nurse call. | engine.js line 211 (ASK vague), line 246 (clarify task, owner nurse, autoCall). | VERIFIED |
| B114 | Unknown or unrecognised messages with alarm words go to a clinician. | engine.js line 213 (SAME-DAY, "human review today"). | VERIFIED |

## README.md

| ID | Claim | Evidence | Status |
|---|---|---|---|
| R01 | Built for the Future Health Digital Innovation Challenge 2026 (Abu Dhabi Department of Health, run on Hack2skill), Statement 3. | Task record; brief.md title. | UNVERIFIED (challenge details not in any file read) |
| R02 | Open index.html; no install, no server, no login; default mode runs scripted with no AI model. | index.html single page; src.html line 121; B02. | VERIFIED |
| R03 | Overview has a seven-scene guided story. | src.html has seven scene entries (earlier pass); review3 "DEMO has 7 steps". | VERIFIED |
| R04 | Intake: pick a sample patient or start the interview; Send to staff board creates tasks. | src.html Intake card (earlier pass); click-through not re-run. | UNVERIFIED (behaviour) |
| R05 | Intake: six procedure types in en, ms, zh and ar. | B12; ARCC 80/0. | VERIFIED |
| R06 | Intake: OT date is refused if impossible or unpadded; critical items within 7 days flag the surgery at risk. | B108, B109. | VERIFIED |
| R07 | Doctor summary is rule-based, with contradiction and incompleteness flags. | B14, B15, B16. | VERIFIED |
| R08 | Example flag: an allergy named in free text while the box says "no". | CON penicillin-in-free-text case (never NONE); review2.md round 4 B4. | VERIFIED |
| R09 | To-do list is generated from the summary and sent to the Staff board in one step. | B17. | VERIFIED (source) |
| R10 | Ask box answers from country, hospital, team and surgeon, showing source and owner. | B18, B19. | VERIFIED |
| R11 | Some Ask answers are labelled "SAMPLE draft, not approved". | B30. | VERIFIED |
| R12 | Clinical questions go to a clinician; in model mode emergency, same-day and clinical-judgement routes never reach a model. | B20, B22. | VERIFIED (engine and guard); UNVERIFIED (live page) |
| R13 | Settings card says "scripted, no AI" in the default mode. | src.html line 121, line 735. | VERIFIED |
| R14 | Staff board: an unacknowledged alert is re-paged, then passed to an on-call fallback. | B33. | VERIFIED |
| R15 | Outcome classes: EMERGENCY, SAME-DAY, HOLD, OVERDUE, ROUTE, ASK and ANSWER; the engine also returns ACK and OK; closure is separate. | B10, B111, B112. | VERIFIED |
| R16 | ROUTE gives a clinician review within 24 hours (48 for worsening trend). | B78 (engine lines 205, 208, 245). | VERIFIED |
| R17 | ASK is an unknown or vague message sent to a clinician or nurse call. | B113. | VERIFIED |
| R18 | Closing a task needs attached evidence plus a clinician, or a documented decision with a reason; "ok" is refused. | B34, B35. | VERIFIED |
| R19 | Procedure packs are data; adding a pack means adding data, not changing the engine. | interview.js BY_PROC data; adding a pack was not tested. | UNVERIFIED |
| R20 | Model provider swappable by configuration; default scripted; proxy keeps keys out of the browser; proxy not deployed and not run against a live provider. | B23, B24; adapter.NOTE.md item 1 (no key in browser). "Not deployed": author statement. | VERIFIED (config, proxy stub); UNVERIFIED (not deployed) |
| R21 | Second check: can raise urgency, cannot lower it; AI mode only; patient text goes to the provider through the proxy. | B25, B26, B60. | VERIFIED |
| R22 | 30/30 cases pass; eighteen further suites pass with 0 failures; 494 in regress2, 258 in intake, 80 in otdate, 26 in second_check, 538 in arabic_engine, 80 in arabic_content. | T; B65; ARC; ARCC. | VERIFIED |
| R23 | The tests show the rules behave as intended, not that they are clinically accurate. | B64. | VERIFIED |
| R24 | 30 hand-written cases, all pass; author wrote cases and engine together. | B67. | VERIFIED (pass); UNVERIFIED (writing order) |
| R25 | Haiku labelled the 30 cases blind and agreed on 24 of 30. | B68. | UNVERIFIED |
| R26 | unseen3 first pass: 28/45 (62.2%) urgent escalated; 1/45 normal falsely escalated; 0/45 urgent answered by bot. Tuned-on. | B70, B74. | VERIFIED |
| R27 | unseen4: 150 AI-written messages authored blind to the rules, 75 urgent and 75 normal. Labels are AI judgement. | B75, B79. | VERIFIED |
| R28 | unseen4 rules only: 42 of 75 urgent escalated (56.0%, CI 44.7-66.7); 0 of 75 answered by bot; 8 of 75 normal falsely escalated (10.7%). | B76. | VERIFIED |
| R29 | 33 urgent messages were classed ROUTE, meaning a clinician review within 24 hours, not same-day. | B78. | VERIFIED |
| R30 | Second check on the same 150: 75 of 75 urgent caught (100.0%, CI 95.1-100.0); 6 of 75 normal flagged; rules OR check 14 of 75 normal flagged. | B80. | VERIFIED |
| R31 | Caveats: same model family wrote the messages; prompt biased to "urgent when unsure"; some flagged normals may be defensible; labels not clinician labels; AI mode only, through a proxy; patient text goes to the provider; default demo rules only and says so. | B82, B83, B84, B63, B85, B60. | VERIFIED (except B82, UNVERIFIED) |
| R32 | Harness set 1: over-blocks 15 before the guard rewrite, 0 after; 0 harmful escapes by manual reading. | B88. | UNVERIFIED |
| R33 | Harness set 2: 8 of 25 Chinese summaries still wrongly blocked; falls back to scripted text. | B89. | UNVERIFIED |
| R34 | Three independent AI-agent reviews and six fix rounds (review1.md, review2.md, review3.md); reviewers are AI agents, not clinicians. | B92; reviewer identity B93. | VERIFIED (count); UNVERIFIED (reviewer identity) |
| R35 | One major, on benign questions answered with draft text, is only partly fixed. | B96. | VERIFIED |
| R36 | With 7 of 7 escalations on hand-written cases, lower bound about 65%. | B69. | VERIFIED |
| R37 | Not done: second clinician labelling; surgeon sign-off; native ms, zh and ar review; real patient messages; measured reduction in missed steps; live provider run of model mode or second check; Malaffi and Sahatna; real channel; real database or login; UAE data protection. | B103. | VERIFIED |
| R38 | Known limits: approved-topic questions to model in model mode; some benign questions get sample draft; comma wound phrase still escalates. | B55, B56, B102. | VERIFIED |
| R39 | Malaffi and Sahatna would be a standards-based adapter on result and appointment feeds (plan, not built). | src.html contains "Sahatna" (grep); the "adapter on the result and appointment feeds" wording (earlier pass, src.html line 146). | VERIFIED |
| R40 | Pilot at a clinic with a Telegram FAQ and red-flag triage bot; permission not obtained. | B46, B105. | UNVERIFIED |
| R41 | Insurer pre-authorisation is included because Abu Dhabi elective inpatient care generally needs it; from search snippets, not confirmed. | Author statement; flagged in the document. | UNVERIFIED (flagged) |
| R42 | Four published figures with their limits are in mod/public_figures.md; placeholder sizing only. | B106, B107. | VERIFIED |
| R43 | No real patient data is used or stored; the page runs in the browser in default mode. | B48 (synthetic data); B02 (scripted default, src.html line 121). The no-network-call claim was removed from the docs. | VERIFIED |
| R44 | Synthetic data: all patients, messages, results and clinicians are fictional or AI-written. | B48, B49. | VERIFIED |
| R45 | Author: solo orthopaedic medical officer in Malaysia. | B03. | UNVERIFIED |

## video_script.md

| ID | Spoken line or on-screen text | Evidence | Status |
|---|---|---|---|
| V01 | "Every patient in this demo is fictional." | B48. | VERIFIED |
| V02 | "The interview covers six procedure types." | B12. | VERIFIED |
| V03 | "This one is a knee replacement." (sample) | src.html lines 232-233: Mdm Aisha is a knee replacement; sample choice to confirm on the live page. | UNVERIFIED (sample not clicked) |
| V04 | "Answers can be given in English, Bahasa Malaysia, Chinese or Arabic." | B12. | VERIFIED |
| V05 | "the Malay, Chinese and Arabic wording is a machine draft pending native review." | B13. | VERIFIED |
| V06 | "The OT date is here too." (on-screen OT date field) | B108 (OT date feature, OTD 80/0). On-screen placement not clicked. | UNVERIFIED (on-screen placement) |
| V07 | "Critical items open within seven days of surgery flag it at risk." | B109. | VERIFIED |
| V08 | "The summary is rule-based, with no AI model, and the Settings card says so." | B14; B13 (Settings text, src.html line 121). | VERIFIED |
| V09 | "It flags contradictions, such as an allergy named in free text while the box says no, and unanswered questions." | B15, B16, R08. | VERIFIED |
| V10 | "A red flag stops the interview and creates an urgent task." | B32. | VERIFIED |
| V11 | "The to-do list is built from that summary, and can be sent to the staff board in one step." | B17. | VERIFIED (source); UNVERIFIED (click) |
| V12 | "The Ask box answers from layered sources: country, hospital, team and surgeon." | B18. | VERIFIED |
| V13 | "Each answer shows its source and owner." | B19. | VERIFIED |
| V14 | "A clinical question, like a blood thinner, goes to a clinician instead." | B20 (engine); B21 (live page not clicked). | UNVERIFIED (live routing) |
| V15 | "The to-dos become tasks. A second press adds nothing new." | B17 (src.html lines 516-517, "Already sent"). | VERIFIED (source); UNVERIFIED (click) |
| V16 | "On the Staff board, each task has an owner and a due time." | review1.md round 1 M2 (earlier pass); not clicked. | UNVERIFIED (on-screen) |
| V17 | "Unanswered alerts are re-paged, then passed to an on-call fallback." | B33 (engine caps, lines 5-8, 313). | VERIFIED (engine); UNVERIFIED (on-screen) |
| V18 | "Rules alone caught 42 of 75 urgent test messages written by AI." | B61 (EV4), B49, B79. | VERIFIED |
| V19 | "So a second check is an option under test, not a validated safety layer, and it is not yet validated by clinicians." | B62, B63. | VERIFIED |
| V20 | "Not done: clinician labelling, native Arabic review, surgeon sign-off, a real channel, database or login, and any measure of missed steps." | B103. | VERIFIED |
| V21 | Video says the demo runs scripted, with no AI model, so the second check is not in the recording. | B02, B27 (browser not re-run), B85. | VERIFIED (source); UNVERIFIED (recording content) |
| V22 | The How it works tab shows the limits. | src.html line 155 is the How it works section; the limits text not read. | UNVERIFIED |

## Arabic additions (ar), added 2026-11-08

| ID | Claim | Evidence | Status |
|---|---|---|---|
| AR01 | Arabic (ar) is the fourth language in the interview, doctor summary, to-do list, Ask box, patient phone replies, red-flag rules and model-reply guard. | ARCC 80/0 (ar text on every question; six procedures build in ar; Arabic summary and to-do checks; Arabic Ask routes and citations; both language pickers offer العربية). ARC 538/0 (ar red flags, FAQ answers, route rules, guard). | VERIFIED |
| AR02 | Patient phone replies are in Arabic when the patient writes Arabic; the language is detected from the message. | ARC 538/0 (FAQ ANSWER rows with lang ar; ar route and emergency replies); engine.js lang() line 55. Browser click on the phone not run. | VERIFIED (engine path); UNVERIFIED (live phone) |
| AR03 | Arabic text switches the Intake cards to a right-to-left layout. | ARCC check "RTL rules use logical properties" (80/0) confirms the [dir=rtl] rules exist. The switch itself is setDir in index.html line 3507, read in source only. | UNVERIFIED (rendered layout not checked) |
| AR04 | The Staff board stays in English, including Arabic to-do titles. | ARCC "Arabic to-dos keep English titles for the Staff board" (80/0). Rest of the board UI not rendered. | VERIFIED (to-do titles); UNVERIFIED (rest of board) |
| AR05 | Arabic voice input is not tested. The Use voice button passes Arabic to the browser's speech recognition (ar-SA) where supported. | index.html line 3972 (rec.lang ar-SA, read by grep). No test in ARC or ARCC covers voice. The brief's "no Arabic voice input" is not accurate as code. | VERIFIED (source and absence of tests) |
| AR06 | All Arabic wording is machine-drafted and needs review by a native Arabic-speaking clinician, ideally Gulf. | ARCC "Arabic text is reviewed:false on every question" (80/0); ARCC "Arabic summary notice asks a native Arabic-speaking (Gulf) clinician to review" (80/0). | VERIFIED |
| AR07 | No native Arabic review has been done. | Absence in the files read; ARCC reviewed:false flags. | VERIFIED (absence) |
| AR08 | Red-flag rules, route rules, FAQ answers and model-reply guard in Arabic: 538 checks, 0 fail. | mod/arabic_engine.test.js, run this pass. | VERIFIED |
| AR09 | Blind Arabic set: 120 AI-written messages (60 urgent, 60 normal), in Gulf, Egyptian, Levantine and MSA, written without sight of the rules. | mod/unseen5_ar_firstpass.txt (printed output; urgent by dialect 20, 15, 15, 10 = 60). "Written without sight of the rules" and the dialect split are from the author's brief; mod/unseen5_ar.json not read in this pass. | UNVERIFIED |
| AR10 | Language detected as Arabic for 120 of 120 messages. | mod/unseen5_ar_firstpass.txt last lines ("lang detected as ar: 120/120"). | UNVERIFIED (printed; not re-run) |
| AR11 | Rules only: 27 of 60 urgent escalated (45.0%, CI 33.1-57.5); Gulf 7 of 20. | mod/unseen5_ar_firstpass.txt ("urgent caught", "urgent gulf"). | UNVERIFIED (printed; not re-run) |
| AR12 | Rules only: 6 of 60 normal falsely escalated; 0 urgent answered by the bot. | mod/unseen5_ar_firstpass.txt ("normal falsely escalated", "urgent answered by bot: 0"). | UNVERIFIED (printed; not re-run) |
| AR13 | Haiku second check alone: 60 of 60 urgent caught (100.0%, CI 94.0-100.0); 6 of 60 false alarms. Quoted as "0 missed of 60, interval 94-100%". | mod/second_check/ar_combined_firstpass.txt, block "Haiku second check only". | UNVERIFIED (printed; not re-run) |
| AR14 | Rules OR Haiku: 60 of 60 urgent caught; 11 of 60 normal flagged (CI 10.6-29.9). | mod/second_check/ar_combined_firstpass.txt, block "rules OR Haiku". | UNVERIFIED (printed; not re-run) |
| AR15 | Caveat: the same model family wrote and judged the Arabic messages. | Author brief only. Not recorded in the printed files. | UNVERIFIED (author statement) |
| AR16 | Caveat: the second-check prompt is biased to "urgent when unsure". | mod/second_check.js SYSTEM_PROMPT (B83). That the Arabic run used this prompt is the author's statement. | VERIFIED (prompt); UNVERIFIED (use in the Arabic run) |
| AR17 | Caveat: labels are AI judgement, not clinician labels; the dialect text is imitation, not real patient text. | Author brief. No clinician label field in the printed files. | UNVERIFIED (author statement) |
| AR18 | The 100% is 60 of 60 with its interval, not a claim of perfect sensitivity. Rules alone did not escalate 33 of the 60 urgent messages. | Arithmetic on AR11 and AR13 (60 minus 27 = 33). | VERIFIED (arithmetic on printed figures) |
| AR19 | No record shows the rules were frozen before the Arabic blind run, so the set may be tuned-on. | Absence in the files read. File times: unseen5_ar_firstpass.txt 12:54, arabic_engine.test.js 12:53. File times do not prove the order. | VERIFIED (absence); the caution is the author's |
| AR20 | Arabic test counts: arabic_engine 538 PASS, 0 FAIL; arabic_content 80 PASS, 0 FAIL. | mod/arabic_engine.test.js and mod/arabic_content.test.js, run this pass. | VERIFIED |
