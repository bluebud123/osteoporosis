# PeriLoop Console: Solution Brief for Judges

Future Health Digital Innovation Challenge 2026, Statement 3: Closing the Screening-to-Care Loop.
Status: working prototype (v3, 12 Nov 2026). Synthetic data only. Not clinically validated. Decision support, not diagnosis.
Author: a solo orthopaedic medical officer in Malaysia. Most code, rules, thresholds, patient texts and test labels were drafted by an AI and are awaiting clinician sign-off.

This brief describes the Console in `app/`. The single web page at the repository root (`index.html`) is an older prototype kept for history.

## 1. The claim

PeriLoop is a working prototype that gives every perioperative task and patient message a named owner and a written closure, and screens patient messages with fixed red-flag rules plus a raise-only AI second check. On 368 invented English messages labelled blind by one orthopaedic medical officer, every one of the 155 he called an emergency raised an alert (rules alone: 150) and none of the 114 he called routine did; 47 of those emergencies got "call the clinic today" rather than the emergency text. One clinician, one model, one run; no real patients.

## 2. The problem

Around elective surgery a finding is often made and then not followed through: an abnormal pre-op blood result, a missing consent, a patient message about a wound sent on a Friday evening. Nobody clearly owns the next step, so it is found late. Public hospitals with no patient portal handle this by phone and memory.

## 3. What the Console does

| Part | What it does |
|---|---|
| Checklist per patient | Created from pathway rules when a patient is added. Every item has an owner and a due day. A task closes only with written evidence; doctor decisions can be closed only by a doctor. |
| Readings | Staff enter pre-op and post-op readings (haemoglobin, temperature, blood pressure, calf difference and more). Threshold rules raise amber or red flags with an owner. |
| Patient chat | A private link, no app to install. English, Malay, Chinese, Arabic. |
| Message triage | Fixed red-flag rules run first. An optional AI second check can only raise urgency, never lower it. Emergency and same-day replies are fixed texts. The AI never writes clinical advice. |
| Clinic answers | 19 fixed answers to common questions. Each is a draft until a doctor approves it, and is labelled as a draft to the patient. |
| Patient profile memory | When a patient mentions an illness, a medicine, a worry, their home situation or a preference, the AI proposes it to staff with the patient's exact words. Staff confirm or dismiss. Confirmed items help the AI draft replies for staff and can raise urgency (a confirmed blood thinner plus "bruising" pages the same day). Never shown in the patient chat. |
| Learning | The assistant does not change itself. When staff rewrite a draft, dismiss a proposed fact, or mark an alert as wrong, that is recorded. The AI proposes one-sentence lessons from those corrections; a doctor approves, edits or rejects each. Approved lessons are indexed by topic, and only the few that match a message are given to the AI when it drafts for staff. Lessons cannot change triage or anything a patient sees. |
| Staff views | Today, Inbox, Learning, Alerts (acknowledging records who and when), Calendar with a cases-per-day limit, Rules, Settings, audit log. |
| Live view | Patient, pipeline and staff side by side, so each decision can be seen step by step. |

Six procedure types are held as data: knee replacement, hip replacement, ACL reconstruction, lumbar surgery, shoulder arthroscopy, foot and ankle. Knee replacement is the one the rules were written for.

## 4. Statement 3 requirements

The requirement wording below was written from an earlier reading of the challenge page and must be checked against the published Statement 3 before submission.

| Requirement | In the Console | Gap |
|---|---|---|
| End-to-end visibility of each case | Per-patient checklist, flags, messages and audit on one page | No link to other hospital systems |
| Ownership and timely progression | Owner and due day on every item; overdue shown on Today | Overdue is shown, not pushed: no SMS, email or on-call rota |
| Patient-centred communication | Private chat in four languages; fixed urgent texts; record answers ("when is my operation") | Malay, Chinese and Arabic are machine drafts; library answers have no Arabic |
| Cross-provider consultation | Not built | Malaffi integration is future work |
| Safe, human-governed escalation | Rules first; AI raise-only; staff replies are named; drafts are never auto-sent | Alerts are seen only when staff open the Console |
| Closure and impact measures | Evidence-required closure; audit log | No impact measured |

## 5. Evidence (one table, every caveat)

All messages are synthetic and written by AI. All labels are AI labels except the row marked "Clinician labels". "Fresh" means measured once before the set was used to fix anything; only fresh rows are estimates. Details: `docs/decision-log.md`.

| Set | Written by | Rules | Urgent messages alerted | False alerts | Caveat |
|---|---|---|---|---|---|
| Sets 2 and 3 | the AI that wrote the v2 rules | v2, fresh | 86 of 95 (91%) | 1 of 60 | Same author as the rules; 6 emergencies missed |
| Reviewer set 4 | an independent AI reviewer | v2, fresh | 87 of 109 (80%); emergencies 56 of 72 | 4 of 40, three as emergencies | Written after reading the rules, aimed at awkward wording |
| Set 5 | the AI that wrote the v3 rules | v3, fresh | 59 of 69 (86%); emergencies 39 of 46 | 0 of 30 | Same author as the rules; two missed messages were about wanting to die |
| 360-message library | an earlier AI | v3, not fresh | 134 of 180 (74%): en 32/40, ms 35/40, zh 34/40, ar 33/60 | 12 of 180 | Arabic is the weakest language |
| Old prototype, AI second check (Haiku) | AI | old page, not the Console | 75 of 75 and 60 of 60 | 6 of 75 and 6 of 60 | Different product; the same model family wrote and judged the messages |
| **All six sets, real model in the Console (DeepSeek `deepseek-chat`, 12 Nov 2026)** | all of the above | v3 rules alone | 491 of 537 (91%): en 96%, ms 96%, zh 95%, ar 73% | 14 of 376 (4%) | Every set here has been used to tune the rules, so this row is optimistic |
| Same run | | v3 rules + AI check | 537 of 537; all 211 labelled emergencies | 22 of 376 (6%); Arabic 10 of 73 | One run, one model. The AI was needed for 46 messages and flagged all 46 |
| Same run, AI check by itself on every message | | no rules | 519 of 537 (97%); emergencies 198 of 211 (94%); Arabic emergencies 21 of 26 | 11 of 376 (3%) | All 18 misses were calls where the AI gave no usable answer (19 of 913 calls, about 2%). When it answered, it flagged every urgent message |
| **Clinician labels: one orthopaedic medical officer, 368 English messages, blind (12 Nov 2026)** | all of the above, English | v3 rules + AI check (DeepSeek) | His emergencies alerted: 155 of 155 (rules alone 150). Given the emergency text: 108 of 155 (70%) in that run. After his emergency line was added to the rules (v4): 134 of 155 by rules alone; the AI severity step is not yet measured | 0 of 114 | One labeller, one fast pass, four finger slips corrected and listed in the decision log (v3.13). 43 questions he wanted answered the same day go to the inbox, not to a page |

What the table shows:
1. After three rounds of fixes, a fresh set still has missed emergencies. Fixed word lists do not converge. Rules alone are not a safe sole triage.
2. Neither layer is enough alone. The rules missed 46 urgent messages; the AI gave no usable answer on about 2% of calls, 13 of them labelled emergencies. In this run the two never failed on the same message.
3. The AI check can raise only to "same day". An emergency the rules miss and the AI catches gets "call the clinic today", not the emergency text.
4. The AI check is not deterministic: a second run of the same messages raised 8 ordinary messages where the first raised 6.

Raw output of both real-model runs: `docs/evidence/`.

Automated tests: `node app/test.js` 117 of 117; `node app/eval/holdout.test.js` all sets (these are regression tests, not evidence); 23 older suites in `src/mod` unchanged.

## 6. The six judging criteria

| Criterion | Evidence today | Honest gap |
|---|---|---|
| Health impact and clinical relevance | A real, common failure in perioperative care; built by a clinician who works in it | No measured effect; no clinician labels yet |
| Technical depth and architecture | Rules-first pipeline with a raise-only AI check and an output guard; procedure pathways as data; server-side key; audit log | Rules are word lists; one JSON file as the database |
| Working solution and demo quality | Runs with one command, no dependencies; Live view shows each decision | Not hosted yet |
| Responsible AI, safety and data governance | AI cannot lower urgency or write clinical text; drafts labelled; every limit written down; measured misses published; real-model run with the output guard blocking the model's attempts at advice | One model, two runs, AI labels only; AI unavailable on about 2% of calls with no retry; no hazard log; no data-residency position |
| Scalability and deployment readiness | Any OpenAI-compatible provider; new procedures are data | No notifications, encryption at rest, backups or integration |
| Commercial viability and path to pilot | Unit of value is one operation episode; first user is a public orthopaedic unit with no portal | No permission from employer or clinic yet; no pricing |

## 7. Responsible AI and data governance

- Synthetic data only. Phone numbers, IC numbers and emails are masked before storage or any model call.
- Emergency, same-day and clinical-question replies are fixed texts. Urgent texts never promise that a person will reply.
- When the AI is on, patient text goes to the configured provider. No provider or hosting region has been chosen for health data in the UAE.
- A patient's private link is their only identity. That is acceptable for a demo and not for real use.

## 8. Do not read this prototype as

- Validated, safe or clinician-approved.
- Catching "100%": that is one run of one model on invented messages with AI labels, on sets the rules were tuned on.
- Equally good in Arabic.
- Having rules written by clinicians.
- Reducing readmissions or workload: nothing has been measured.
- Ready to deploy, or integrated with Malaffi.

## 9. Next steps

Before submission (see `docs/clinician-todo.md`): blind clinician labels from two labellers, sign-off of thresholds and texts, a native Arabic read of the fixed texts.
After: real patient messages under ethics approval at a pilot site, notifications and an on-call rota, a hazard log, security and data residency, patient-reported outcome scores.
