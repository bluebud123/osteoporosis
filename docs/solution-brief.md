# PeriLoop: Solution Brief for Judges

Future Health Digital Innovation Challenge 2026, Statement 3: Closing the Screening-to-Care Loop.
Status: working prototype, final build as of 2026-11-08. Not clinically tested. Decision support only, not diagnosis.
The demo runs scripted by default. No AI model is switched on in the demo, and the Settings card says so.
Author: solo orthopaedic medical officer in Malaysia.

## 1. The problem

In elective orthopaedic care, a result or task is often found, but nobody clearly owns the follow-through.
The small steps are the ones that get missed, such as pre-op bloods, consent, or insurance pre-authorisation.
PeriLoop is a prototype that gives each step an owner, a due time, and a route to closure.

## 2. What PeriLoop does

- Treats pre-op assessment as surgical-risk screening, and follows each result and task to closure.
- Gives each patient a checklist of 12 shared items and 2 procedure-specific items. Each item has an owner and a due time.
- Covers six procedure types as data packs: knee replacement, hip replacement, ACL reconstruction, lumbar surgery, shoulder arthroscopy, and foot and ankle.
- Turns an abnormal result into a HOLD with an owner. Late items are re-pinged to the owner and nudged to the patient, then escalated after a cap of 3.
- Sorts each message or result into an outcome class: EMERGENCY, SAME-DAY, HOLD, OVERDUE, ROUTE, ASK and ANSWER. The engine also returns ACK (a benign acknowledgement) and OK (nothing to act on). Closing a task is a separate step, not a class. Fixed rules run first.
- Intake tab, OT date: records the operating theatre (OT) date. Impossible or unpadded dates are refused. Critical items open within 7 days of the OT date flag the surgery as at risk. 80 checks in `mod/otdate.test.js` pass.
- Intake tab, pre-op interview: a patient interview for each of the six procedure types, in English, Bahasa Malaysia, Chinese and Arabic. The Bahasa Malaysia, Chinese and Arabic wording is machine-drafted and needs native review. Arabic review should be by a native Arabic-speaking clinician, ideally from the Gulf.
- Arabic (ar), the fourth language: the interview, doctor summary, to-do list, Ask box, patient phone replies, red-flag rules and model-reply guard all have Arabic. Arabic text switches the Intake cards to right-to-left layout. The Staff board stays in English. Arabic voice input is not tested: the Use voice button passes Arabic to the browser's speech recognition where it is supported, and no test covers the result.
- Intake tab, doctor summary: rule-based, no model. It lists the answers and flags contradictions (for example, an allergy named in free text while the box says "no") and incompleteness (unanswered or unclear questions).
- Intake tab, to-do list: generated from the summary and sent to the Staff board task engine in one step. Repeated sends are de-duplicated.
- Intake tab, Ask box: answers questions about the surgery from layered sources (country, hospital, team, surgeon). Each answer shows its source layer and owner. Clinical questions such as blood thinners, antibiotics, flying and stopping injections go to a clinician. In model mode, emergency, same-day and clinical-judgement routes never reach a model.
- Swappable AI adapter: the model provider can be changed through configuration. The default is scripted.
- Second check, AI mode only: after the fixed rules have run, a model check can raise a message's urgency. It cannot lower it. It runs through a server-side proxy, and the proxy owns the prompt. The scripted demo does not run it.

## 3. How the prototype meets the six Statement 3 requirements

| Requirement | What the prototype does | Where to see it |
|---|---|---|
| 1. End-to-end visibility of each case | Each patient has a checklist showing every shared and procedure item, with owner, due time and status. The pre-op interview produces a doctor summary and a to-do list for each patient. | Overview (per-patient checklists); Intake (doctor summary); Staff board |
| 2. Ownership and timely progression | Every item has an owner and a due time. Late items are re-pinged, nudged to the patient, then escalated after 3 attempts. Interview to-dos are created as Staff board tasks with an owner and a due time. | Staff board; Tests tab (30 fictional cases with expected outcomes) |
| 3. Patient-centred communication | Patient replies are fixed text (draft) in English, Bahasa Malaysia, Chinese and Arabic. Arabic replies have not had native review. The Ask box answers from layered sources and shows a citation. Clinical questions are not answered by the bot; they go to a clinician. Some Ask box answers are sample drafts, labelled "SAMPLE draft, not approved" (see section 6.8). | Patient phone; Intake (Ask box) |
| 4. Cross-provider consultation | Not yet done. Integration with Malaffi (Abu Dhabi health information exchange) and Sahatna is planned, not built. | Not in the prototype |
| 5. Safe, human-governed escalation | Fixed red-flag rules run before anything else. A red flag in the interview stops the interview and creates an urgent task. Unknown questions and unrecognised messages with alarm words go to a clinician. Unacknowledged alerts are re-paged up to 3 times, then an on-call fallback is used. | Staff board; Intake; Tests tab |
| 6. Closure and impact measures | A task closes only with attached evidence plus a clinician, or a documented clinician decision with a reason. "ok" is refused. Impact measurement: not yet done. | Staff board (closure); impact measures not yet done |

The prototype is one web page. It runs in the browser on fictional patients: Mdm Aisha (62, knee), Mr Wong (59, lumbar) and Mr Farid (70, hip). It has six parts: Overview, Patient phone, Intake, Staff board, a 30-case test runner, and How it works.

## 4. The six judging criteria: evidence and gaps

Weights are not disclosed.

| Criterion | Honest current evidence | Honest gap |
|---|---|---|
| Health impact and clinical relevance | Covers six elective orthopaedic procedure types. Models pre-op screening, the interview, the OT date, and closure of shared steps. | No measured reduction in missed steps. No published-rate figure for missed steps yet. No clinician labelling beyond the author. No surgeon sign-off of the rules or the question tree. |
| Technical depth and architecture | Deterministic rules engine, with procedure packs held as data. Outcome classes with fixed rules first. Layered knowledge store with citations. Adapter that separates the model provider from the rules. Raise-only second check. Runs in the browser, with a proxy design for the model. | No real database or login. No Malaffi or Sahatna integration. The proxy has not been run against a live provider. |
| Working solution and demo quality | Working single-page prototype with six parts, a 30-case test runner, and 18 automated test suites that pass (section 6.1). | Live demo link, login credentials and video: not yet done. |
| Responsible AI, safety and data governance | Fixed rules first. Scripted default. The second check can only raise urgency. An output guard checks any model reply before it is shown. Clinical questions routed to a clinician. Synthetic data only. | Rules alone caught 42 of 75 urgent messages in the blind set (56.0%), and 27 of 60 in the Arabic blind set (45.0%). Second clinician blind labelling not done. Not tested on real patient messages, which the challenge does not allow. Model mode not run against a live provider. |
| Scalability and deployment readiness | Procedure packs are data, so new procedure types can be added as data. Model provider can be changed by configuration. | No real messaging channel. No real database or login. No integration with existing health systems. No data protection assessment for the UAE. |
| Commercial viability and path to pilot | Unit of value: one operation episode, paid for by a hospital, starting with a pilot. Pilot site planned at a clinic with an existing Telegram FAQ and red-flag bot. | No revenue figure. Written permission from the employer (Ministry of Health, Malaysia) and the clinic: not yet obtained. |

## 5. Responsible AI and data governance

- Synthetic data only. The prototype uses fictional patients. The test messages are written by an AI model, not by patients.
- Scripted by default. Patient replies are fixed text (draft). The model mode is off unless configured.
- Fixed rules come before anything else. Red flags are caught first, in English, Bahasa Malaysia, Chinese and Arabic. Red-flag vocabulary covers stroke signs, seizure, fainting, vomiting blood, anaphylaxis, overdose, self-harm and heavy bleeding, among others.
- Rules alone are partial. In the blind set, they escalated 42 of 75 urgent messages. In the Arabic blind set, they escalated 27 of 60. A second check is needed in production. In AI mode it can only raise a message's urgency, and it has not been validated against clinicians.
- Model mode is guarded. Emergency, same-day and clinical-judgement routes are classified before any model call and never reach the model. A model reply is checked before it is shown. A reply that reassures, or that makes a clinical decision, is replaced with the scripted text.
- Data protection: in AI mode, the patient message text goes to the configured provider, through the proxy. The demo uses synthetic data only. Real patients would need a provider that data-protection rules allow. No UAE data-protection assessment has been done.
- Clinical questions with no approved answer are routed to a clinician. A question that matches an approved topic, such as showering with a dressing, can still reach the model in model mode, and some benign questions can still receive a sample draft answer. These are known limits.
- Humans own clinical decisions. The bot never answers clinical questions such as blood thinners, antibiotics, flying, or stopping injections.
- Closure needs evidence. A task closes only with attached evidence plus a clinician, or a documented clinician decision with a reason.
- Clinical thresholds and the interview question tree are drafts. They await surgeon sign-off. No sign-off is recorded.

## 6. Evidence and limits

All numbers below are from the prototype's own tests and blind sets. They are not clinical results. Counts were re-run for this version on 2026-11-08, unless stated otherwise.

### 6.1 Automated test suites

| Suite | What it checks | Result |
|---|---|---|
| test.js | 30 fictional cases, and the five outcome groups (escalation, false-alarm control, never answered, closure, overdue handling) | 30/30 cases pass. Groups: escalation 7/7, false-alarm control 2/2, never answered 6/6, closure 2/2, overdue 8/8 |
| mod/adapter.test.js | Provider swap, guard, AI-mode routing | 18 PASS, 0 FAIL |
| mod/chat_ratelimit.test.js | Proxy rate limits (in memory) | 5 PASS, 0 FAIL |
| mod/contradictions.test.js | Each contradiction rule is never NONE | 17 PASS, 0 FAIL |
| mod/guard2.test.js | Model-reply guard on 80 recorded replies and 40 adversarial replies | 121 PASS, 0 FAIL |
| mod/intake.test.js | 30 histories, interview to summary to to-do | 258 PASS, 0 FAIL |
| mod/interview.test.js | Interview flow and red stops | 43 PASS, 0 FAIL |
| mod/knowledge.test.js | Layered sources and citations | 18 PASS, 0 FAIL |
| mod/negation.test.js | Negated wound phrases do not escalate; real problems still do | 42 PASS, 0 FAIL |
| mod/otdate.test.js | OT date: calendar helpers, date changes, guards, at-risk rules | 80 PASS, 0 FAIL |
| mod/proxy_e2e.test.js | Real proxy on a free port, stub upstream (not a live provider) | 19 PASS, 0 FAIL |
| mod/regress1.test.js | Earlier regression set | 22 PASS, 0 FAIL |
| mod/regress2.test.js | Emergency vocabulary, Ask box, output guard, typed contradictions | 494 PASS, 0 FAIL |
| mod/regress3.test.js | Review 3 fixes: cyanosis, collapse, bladder, overdose, NONE with open gaps | 181 PASS, 0 FAIL |
| mod/review1b.test.js | Review fixes: worsening rule, red sample, overrides | 22 PASS, 0 FAIL |
| mod/round3.test.js | Every question across six procedures, in en, ms and zh | 239 PASS, 0 FAIL |
| mod/second_check.test.js | Second check: raise-only, strict parse, timeout, unscreened handling | 26 PASS, 0 FAIL |
| mod/arabic_engine.test.js | Arabic red flags, route rules, FAQ answers, model-reply guard | 538 PASS, 0 FAIL |
| mod/arabic_content.test.js | Arabic interview bank, summary, to-do titles, Ask box routes, RTL CSS, page wiring | 80 PASS, 0 FAIL |

These tests were written by the author alongside the engine. Passing them shows the rules behave as the author intended. It does not show clinical accuracy.

### 6.2 Hand-written fictional cases

- 30 hand-written fictional cases, with expected outcomes. All 30 pass. The author wrote the cases and the engine together, so this proves little.
- Haiku, an AI model and not a clinician, labelled the 30 cases blind and agreed on 24 of 30. Cases C02, C13, C17, C19, C26 and C29 differ and need a surgeon to decide. This figure is carried over from the previous version and was not re-run for this document.
- With 7 of 7 escalations on the hand-written cases, the one-sided 95% lower bound on true sensitivity is about 65%. That is a small-sample figure from cases the engine was built alongside.

### 6.3 Held-out message set (unseen3), first pass

This set was written by an AI model, not by patients. The "urgent" labels are AI-written, not clinician labels. The first pass ran once, with the engine as it was at that time. The printed output, quoted exactly:

```
periloop unseen3 first-pass (mode default, no rule changes, single run)
items: 90 (urgent 45, normal 45)

Urgent escalated at first pass (EMERGENCY or SAME-DAY): 28/45 (62.2%, Wilson 95% CI 47.6-74.9%)
Normal falsely escalated: 1/45 (2.2%, Wilson 95% CI 0.4-11.6%)
Urgent ANSWERED by bot (must be 0): 0/45 (0.0%, Wilson 95% CI 0.0-7.9%)
```

Per language, as printed: en urgent escalated 11/15 (73.3%); ms 9/15 (60.0%); zh 8/15 (53.3%). Normal falsely escalated: en 0/15, ms 1/15, zh 0/15. Urgent answered by bot: 0/15 in each language.

The 17 urgent items not escalated at first pass were all classed ROUTE with answered=false. None was answered by the bot. One normal item was escalated: MS-N05, classed SAME-DAY.

The rules were changed after this run, in review rounds 1 to 6. This set is now tuned-on and does not count as held-out.

### 6.4 Blind message set (unseen4): 150 messages, rules only

- 150 AI-written messages: 75 urgent and 75 normal, with 25 of each per language (en, ms, zh). The file header says they were authored blind to the rules. The "urgent" labels are AI judgement, not clinician labels.
- The engine ran once, on rules only, after its last code change. The printed output is in `mod/unseen4_firstpass.txt`. It was reproduced in this pass by `node eval4.js`.

| Measure (rules only) | Result | 95% CI (Wilson) |
|---|---|---|
| Urgent escalated (EMERGENCY or SAME-DAY) | 42/75 (56.0%) | 44.7-66.7 |
| Urgent escalated, en / ms / zh | 12/25 (48.0%) / 14/25 (56.0%) / 16/25 (64.0%) | 30.0-66.5 / 37.1-73.3 / 44.5-79.8 |
| Urgent answered by bot (ANSWER) | 0/75 (0.0%) | 0.0-4.9 |
| Urgent classed ACK (dismissed) | 0/75 (0.0%) | 0.0-4.9 |
| Normal falsely escalated | 8/75 (10.7%) | 5.5-19.7 |
| Normal falsely escalated, en / ms / zh | 2/25 (8.0%) / 6/25 (24.0%) / 0/25 (0.0%) | 2.2-25.0 / 11.5-43.4 / 0.0-13.3 |

Urgent items by class: ROUTE 33, EMERGENCY 25, SAME-DAY 17. ROUTE is the clinician route: it creates a clinician review within 24 hours (48 hours for a worsening trend). It is not an urgent alert. So 33 of the 75 urgent messages did not reach a same-day review under rules alone.

### 6.5 Second check on the same 150 messages (raise-only)

A Haiku model, used as a stand-in for the production provider, scored each of the 150 messages once. Its verdict can only raise a message's urgency. The scoring is in `mod/second_check/combined_firstpass.txt`, reproduced by `node eval4_combined.js`.

| Path | Urgent caught | Normal falsely escalated |
|---|---|---|
| Rules only | 42/75 (56.0%, CI 44.7-66.7) | 8/75 (10.7%, CI 5.5-19.7) |
| Haiku second check only | 75/75 (100.0%, CI 95.1-100.0) | 6/75 (8.0%, CI 3.7-16.4) |
| Rules OR Haiku (raise-only) | 75/75 (100.0%, CI 95.1-100.0) | 14/75 (18.7%, CI 11.5-28.9) |

Caveats, which apply to every number in this section:

- The same model family wrote the 150 messages. That is a likely source of agreement, and this has not been tested with a different author.
- The second-check prompt is biased to "urgent when unsure". Some of the 14 flagged normal messages may be defensible. Examples are calf tightness after walking, and three days without a bowel movement, both flagged by the check alone.
- The labels are AI judgement, not clinician labels. The 100% is 75 of 75, with the interval above. It is not a claim of perfect sensitivity.
- Rules plus the check work only in AI mode, through a proxy. In the default demo mode, the rules run alone and the Settings card says so.
- The proxy owns the prompt. The proxy has been tested end to end against a stub upstream, not against a real provider. Rate limits are in memory per instance.

### 6.5a Arabic blind set (unseen5_ar): 120 messages

- 120 AI-written messages: 60 urgent and 60 normal, in Gulf, Egyptian, Levantine and Modern Standard Arabic (MSA). The author states they were written without sight of the rules. The dialect text is an imitation, not real patient text. The "urgent" labels are AI judgement, not clinician labels.
- Language detected as Arabic for 120 of 120 messages. Urgent answered by the bot: 0 of 60, in both printed outputs.
- The printed outputs are `mod/unseen5_ar_firstpass.txt` (rules only) and `mod/second_check/ar_combined_firstpass.txt` (second check alone, and rules OR second check). The scoring script was not re-run for this document.

| Measure | Rules only | Haiku second check only | Rules OR Haiku (raise-only) |
|---|---|---|---|
| Urgent caught | 27/60 (45.0%, CI 33.1-57.5) | 60/60 (100.0%, CI 94.0-100.0) | 60/60 (100.0%, CI 94.0-100.0) |
| Normal falsely escalated | 6/60 (10.0%, CI 4.7-20.1) | 6/60 (10.0%, CI 4.7-20.1) | 11/60 (18.3%, CI 10.6-29.9) |

Rules only, urgent caught by dialect: Gulf 7/20 (35.0%), Egyptian 5/15 (33.3%), Levantine 9/15 (60.0%), MSA 6/10 (60.0%). The second check alone caught all urgent messages in each dialect (20/20, 15/15, 15/15, 10/10). Intervals by dialect are in the printed output.

The second check alone: 0 missed of 60, interval 94-100%.

Caveats, which apply to every number in this section:

- The same model family wrote the messages and judged them. That is a likely source of agreement. This is not recorded in the printed files.
- The second-check prompt is biased to "urgent when unsure".
- The labels are AI judgement. No clinician has labelled them.
- The 100% is 60 of 60, with the interval above. It is not a claim of perfect sensitivity.
- Rules alone did not escalate 33 of the 60 urgent messages.
- No record shows the rules were frozen before this run, so treat this set as possibly tuned-on.

### 6.6 Model-output harness (AI-mode intake guard)

A Haiku stand-in played the model, because no provider key was available. Requests and replies were scored by the guard and by independent heuristic checks.

- Set 1 (80 requests): over-blocks fell from 15 before the guard rewrite to 0 after it. Harmful escapes: 0, by manual reading of the set-1 replies. Ten plus five replies that the heuristic checks flagged were safe refusals or false positives.
- Set 2 (80 fresh requests): 8 of 25 Chinese summaries (starting "患者表示…") were still wrongly blocked. A blocked reply falls back to scripted text. One set-2 agent first wrote canned replies, and that run was redone.
- In production the model is used only to rephrase or summarise. The question tree is fixed.

### 6.7 AI-agent review reports

Three independent AI-agent reviews (`review1.md`, `review2.md`, `review3.md`) and six fix rounds (rounds 1 to 3 in review 1, rounds 4 and 5 in review 2, round 6 in review 3). The reviewers are AI agents, not clinicians. Each round found real blockers, and each fix cites a test or a browser smoke run.

- Review 3 listed 7 blockers and 6 majors. Round 6 fixed all 7 blockers. The fixes are covered by `mod/regress3.test.js` (181 checks) and the other suites in section 6.1.
- One major, M1 (benign questions answered with draft text), is only partly fixed. Draft answers still appear when a topic matches. They are now tagged "SAMPLE draft, not approved".

### 6.8 Known open items after round 6

- Bahasa Malaysia, Chinese and Arabic wording has not had native review. The wording is machine draft. All Arabic needs a native Arabic-speaking clinician, ideally from the Gulf.
- Arabic voice input is not tested.
- Some minor items from review 2 (m1 to m6) remain open. Some display text, such as red-flag reason labels, stays in English in Bahasa Malaysia and Chinese.
- Review 3 minor items: the Settings proxy input is below a 40 px tap target; typing 99 for HbA1c gives a generic message, not a range message; some English route text remains in Malay and Chinese Ask replies.
- The "no redness, discharge" wound phrasing with a comma still escalates. This is the safe side, and it is a known limit.
- Model mode sends questions that match an approved topic to the model. This is a known limit.
- Draft answers (M1) remain partly open, as in 6.7.

### 6.9 Not yet done

- Second clinician blind labelling of the 150 and 120 blind messages, and surgeon sign-off of the rules and the question tree.
- Native Bahasa Malaysia, Chinese and Arabic review (Arabic by a clinician, ideally from the Gulf).
- Testing on real patient messages (not allowed in this challenge).
- Any measured reduction in missed steps.
- A live model provider run. Model mode and the second check have only been tested against a stub or stand-in.
- Malaffi and Sahatna integration.
- A real messaging channel.
- A real database or login.
- A data protection assessment for the UAE.

## 7. Path to pilot: next steps

1. Get a second clinician to label the 150 and 120 blind messages and the 30 cases, blind. Resolve disagreements with a surgeon. Get surgeon sign-off of the rules and the interview question tree.
2. Get native Bahasa Malaysia, Chinese and Arabic review of the interview and reply wording (Arabic by a clinician, ideally from the Gulf).
3. Build a fresh, unseen message set after the rules are frozen. Measure rules alone and rules plus the second check, and report both.
4. Run the proxy against a real provider, with a shared rate-limit store and a data-protection assessment, before any real message is processed.
5. Add a published-rate figure for missed steps, with sources.

Permission from the employer (Ministry of Health, Malaysia) and the pilot clinic is still needed before any pilot. Public figures for the problem are in `public_figures.md`, and they are placeholder sizing only.
