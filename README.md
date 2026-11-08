# PeriLoop (working name)

A perioperative task-and-escalation loop for elective orthopaedic surgery. It treats pre-op assessment as surgical-risk screening and follows each result and task to closure.

Built for the Future Health Digital Innovation Challenge 2026 (Abu Dhabi Department of Health, run on Hack2skill), Statement 3: "Closing the Screening-to-Care Loop".

Synthetic data only. Every patient in this repository is fictional. This is decision support for staff, not diagnosis. Clinical thresholds and the interview question tree are drafts awaiting surgeon sign-off.

## Try it in 60 seconds

1. Open `index.html` in any modern browser. No install, no server, no login. The default mode runs scripted, with no AI model.
2. On the Overview tab, press **Play 2-minute story**. Seven short scenes walk through three fictional patients (Mdm Aisha 62, knee; Mr Wong 59, lumbar; Mr Farid 70, hip).
3. Open the **Intake** tab. Pick a sample patient, or start the interview. Answer the questions (English, Bahasa Malaysia or Chinese). The doctor summary, the to-do list and the Ask box update as you go. **Send to staff board** creates the to-do tasks.
4. Open the **Staff board** tab to see the tasks, alerts and due times created by Intake and the patient phone.
5. Open the **30-case tests** tab and run the 30 tests. Each case has an expected outcome written before the engine was built.

## What each tab shows

- **Overview**: the guided 7-scene story, live stats, a live loop diagram, and each patient's checklist (12 shared items plus 2 procedure-specific items, each with an owner and due time).
- **Patient phone**: a chat with a fictional patient, sample chips, a free-text box, and "Your plan" showing that patient's remaining tasks. Replies are fixed text in the default scripted mode.
- **Intake**: a pre-op interview for six procedure types, in English, Bahasa Malaysia and Chinese. It gives:
  - an **OT date**, which is refused if it is in the past, and warned if it is under 2 days away. Critical items open within 7 days of the OT date flag the surgery as at risk;
  - a **doctor summary**, rule-based, with contradiction and incompleteness flags (for example, an allergy named in free text while the box says "no");
  - a **to-do list**, generated from the summary, that sends tasks to the Staff board in one step;
  - an **Ask box**, which answers questions about the surgery from layered sources (country, hospital, team, surgeon). Each answer shows its source and owner. Clinical questions such as blood thinners, antibiotics, flying and stopping injections go to a clinician. In model mode, emergency, same-day and clinical-judgement routes never reach a model. Some answers are sample drafts, labelled "SAMPLE draft, not approved";
  - a **Settings** card, which says "scripted, no AI" in the default mode.
- **Staff board**: the alerts raised for the staff group, a way to inject a result for a patient, and a case board showing open holds, overdue items and closures. An unacknowledged alert is re-paged, then passed to an on-call fallback.
- **30-case tests**: the runner for the 30 hand-written fictional cases, showing expected against actual outcome for each.
- **How it works**: the rules behind the engine, the procedure packs, and the model adapter.

## Outcome classes

Fixed rules run first. Each message or result gets one class:

- **EMERGENCY**: a red flag caught by fixed rules, handled before anything else.
- **SAME-DAY**: an alert needing same-day human attention.
- **HOLD**: an abnormal result, held with an owner until it is resolved.
- **OVERDUE**: a task past its due time, re-pinged to its owner and nudged to the patient, escalated after a cap of 3.
- **ROUTE**: a clinical question or unclear case routed to a clinician for review, normally within 24 hours (48 hours for a worsening trend). The bot never answers these (for example blood thinners, antibiotics, flying, stopping injections).
- **ASK**: an unknown or vague message, sent to a clinician or to a nurse call.
- **ANSWER**: a message the bot answers with fixed text.

The engine also returns **ACK** (a benign acknowledgement) and **OK** (nothing to act on). Closing a task is a separate step, not an outcome class: a task closes only with attached evidence plus a clinician, or a documented clinician decision with a reason. "ok" is refused.

## How it is built

- One self-contained HTML file (`index.html` once renamed for hosting). Nothing else is needed to run it in the default mode.
- The engine is plain JavaScript in the browser. There is no server and no database.
- The interview, summary, to-do list, OT date and Ask box are rule-based. They use no model.
- Procedure packs are data: knee replacement, hip replacement, ACL reconstruction, lumbar surgery, shoulder arthroscopy, foot and ankle. Adding a pack means adding data, not changing the engine.
- Model provider is swappable. The default is scripted. A model adapter can be pointed at any OpenAI-style chat endpoint through configuration. A server-side proxy (`mod/server/chat.js`) keeps keys out of the browser and owns the prompt. It has been tested end to end against a stub upstream. It has not been run against a live provider.
- Model mode is guarded. Emergency, same-day and clinical-judgement routes are classified before any model call and never reach a model. Each model reply is checked before it is shown.
- AI mode only: a second check (`mod/second_check.js`) can raise a message's urgency after the rules run. It cannot lower it. In AI mode, patient message text goes to the configured provider through the proxy.

## Evidence so far (be honest about it)

- Automated tests, re-run for this version: `test.js` 30/30 cases pass. Sixteen further suites in `mod/` pass with 0 failures, including 494 checks in regress2, 258 in intake, 80 in otdate and 26 in second_check. The author wrote these alongside the engine, so they show the rules behave as intended, not that they are clinically accurate.
- 30 hand-written fictional cases, with expected outcomes: all 30 pass. The author wrote the cases and the engine together, so this proves little.
- Haiku (an AI model, not a clinician) labelled the 30 cases blind and agreed on 24 of 30. The differences (C02, C13, C17, C19, C26, C29) need a surgeon. This figure is carried over and was not re-run for this version.
- Held-out message set (unseen3), written by an AI model, not patients. Urgent escalated at first pass: 28/45 (62.2%). Normal falsely escalated: 1/45. Urgent answered by bot: 0/45. The rules were changed after this run, so this set is now tuned-on.
- Blind message set (unseen4), 150 AI-written messages authored blind to the rules, 75 urgent and 75 normal. The labels are AI judgement, not clinician labels. Rules alone: 42 of 75 urgent escalated (56.0%, CI 44.7-66.7). 0 of 75 urgent answered by the bot. 8 of 75 normal falsely escalated (10.7%). 33 of the urgent messages were classed ROUTE, which means a clinician review within 24 hours, not same-day.
- Second check, same 150 messages, scored once by Haiku (raise-only): 75 of 75 urgent caught (100.0%, CI 95.1-100.0). 6 of 75 normal flagged by Haiku. Rules OR check: 14 of 75 normal flagged. Caveats: the same model family wrote the messages, the prompt is biased to "urgent when unsure", some flagged normals may be defensible, and the labels are not clinician labels. Rules plus check work only in AI mode, through a proxy. Patient text goes to the provider. The default demo runs rules only and says so.
- Model-output harness (a Haiku stand-in for the model, AI-mode intake guard): set 1 over-blocks fell from 15 to 0 after the guard rewrite, with 0 harmful escapes by manual reading. Set 2: 8 of 25 Chinese summaries were still wrongly blocked, which falls back to scripted text.
- Three independent AI-agent reviews and six fix rounds found and fixed blocking problems (`review1.md`, `review2.md`, `review3.md`). The reviewers are AI agents, not clinicians. One major, on benign questions answered with draft text, is only partly fixed.
- With 7 of 7 escalations on the hand-written cases, the one-sided 95% lower bound on true sensitivity is about 65%.

## Limits

- Not done: second clinician blind labelling.
- Not done: surgeon sign-off of the clinical thresholds, the interview question tree, and the rules.
- Not done: Bahasa Malaysia and Chinese review by a native speaker. The wording is machine draft.
- Not done: testing on real patient messages (not allowed in this challenge).
- Not done: any measured reduction in missed steps.
- Not done: a live run of model mode or the second check against a real provider. Both have been tested only against a stub or a stand-in model.
- Not done: Malaffi and Sahatna integration.
- Not done: a real messaging channel.
- Not done: a real database or login.
- Not done: a data protection assessment for the UAE.
- Known limits: model mode can send questions that match an approved topic to the model; some benign questions get a sample draft answer; a wound phrase with a comma still escalates (the safe side).
- Plan, not done: Malaffi (Abu Dhabi health information exchange) and Sahatna integration would be a standards-based adapter on result and appointment feeds.
- Plan, not done: pilot at a clinic with an existing Telegram FAQ and red-flag triage bot, subject to written permission from the employer (Ministry of Health, Malaysia) and the clinic. That permission has not been obtained.
- The shared checklist includes insurer pre-authorisation, because Abu Dhabi elective inpatient care generally needs it. This comes from search snippets and is not confirmed from official pages.
- No revenue figure. The planned unit of value is one operation episode paid for by a hospital, starting with a pilot.
- A published-rate figure for missed steps (public literature) is still to be added. Four published figures with their limits are listed in `mod/public_figures.md`. They are placeholder sizing only.

## Synthetic data statement

All patients, messages, results and clinicians in this repository are fictional or AI-written. No real patient data is used or stored. The page runs in the browser in the default mode.

## Author

Solo orthopaedic medical officer in Malaysia.
