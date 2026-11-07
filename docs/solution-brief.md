# PeriLoop: Solution Brief for Judges

Future Health Digital Innovation Challenge 2026, Statement 3: Closing the Screening-to-Care Loop.
Status: working prototype. Not clinically tested. Decision support only, not diagnosis.
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
- Sorts each message or result into one of eight outcome classes: EMERGENCY, SAME-DAY, HOLD, OVERDUE, ROUTE, ASK, ANSWER, CLOSE. Fixed rules run first.

## 3. How the prototype meets the six Statement 3 requirements

| Requirement | What the prototype does | Where to see it |
|---|---|---|
| 1. End-to-end visibility of each case | Each patient has a checklist showing every shared and procedure item, with owner, due time and status. | Overview (per-patient checklists); Staff board |
| 2. Ownership and timely progression | Every item has an owner and a due time. Late items are re-pinged, nudged to the patient, then escalated after 3 attempts. | Staff board; Tests tab (30 fictional cases with expected outcomes) |
| 3. Patient-centred communication | Patient replies are fixed, approved text (draft) in English, Bahasa Malaysia and Chinese. Clinical questions are never answered by the bot. They go to a clinician. | Patient phone |
| 4. Cross-provider consultation | Not yet done. Integration with Malaffi (Abu Dhabi health information exchange) and Sahatna is planned, not built. | Not in the prototype |
| 5. Safe, human-governed escalation | Fixed red-flag rules run before anything else. Unknown questions and unrecognised messages with alarm words go to a clinician. Unacknowledged alerts are re-paged up to 3 times, then an on-call fallback is used. | Staff board; Tests tab |
| 6. Closure and impact measures | A task closes only with attached evidence plus a clinician, or a documented clinician decision with a reason. "ok" is refused. Impact measurement: not yet done. | Staff board (closure); impact measures not yet done |

The prototype is one web page. It runs in the browser on fictional patients: Mdm Aisha (62, knee), Mr Wong (59, lumbar) and Mr Farid (70, hip). It has five parts: Overview, Patient phone, Staff board, a 30-case test runner, and How it works.

## 4. The six judging criteria: evidence and gaps

Weights are not disclosed.

| Criterion | Honest current evidence | Honest gap |
|---|---|---|
| Health impact and clinical relevance | Covers six elective orthopaedic procedure types. Models pre-op screening and closure of shared steps. | No measured reduction in missed steps. No published-rate figure for missed steps yet. Second clinician labelling not done. |
| Technical depth and architecture | Deterministic rules engine, with procedure packs held as data. Eight outcome classes. Runs in the browser. | No model layer. No real database or login. No Malaffi or Sahatna integration. |
| Working solution and demo quality | Working single-page prototype with five parts and a 30-case test runner. | Live demo link, login credentials and video: not yet done. |
| Responsible AI, safety and data governance | Fixed rules first. No model in version 1. Clinical questions routed to a clinician. Synthetic data only. | Second clinician blind labelling not done. Not tested on real patient messages, which the challenge does not allow. |
| Scalability and deployment readiness | Procedure packs are data, so new procedure types can be added as data. | No real messaging channel. No real database or login. No integration with existing health systems. |
| Commercial viability and path to pilot | Unit of value: one operation episode, paid for by a hospital, starting with a pilot. Pilot site planned at a clinic with an existing Telegram FAQ and red-flag bot. | No revenue figure. Written permission from the employer (Ministry of Health, Malaysia) and the clinic: not yet obtained. |

## 5. Responsible AI and data governance

- Synthetic data only. The prototype uses fictional patients. The test messages are written by an AI model, not by patients.
- No model in version 1. Patient replies are fixed, approved text (draft).
- Fixed rules come before anything else. Red flags are caught first, in English, Bahasa Malaysia and Chinese.
- Humans own clinical decisions. The bot never answers clinical questions such as blood thinners, antibiotics, flying, or stopping injections.
- Closure needs evidence. A task closes only with attached evidence plus a clinician, or a documented clinician decision with a reason.
- A planned model can only raise alerts. The planned optional second check can raise an alert but never lower one, and never answers clinical questions. It is not built or tested yet.

## 6. Evidence and limits

All numbers below are from the prototype's own tests. They are not clinical results.

- 30 hand-written fictional cases. Expected outcomes were written before the engine. All 30 pass. The author wrote the cases and the engine together, so this proves little.
- Haiku, an AI model and not a clinician, labelled the 30 cases blind. It agreed on 24 of 30. Cases C02, C13, C17, C19, C26 and C29 differ and need a surgeon to decide.
- First set of unseen messages, written by an AI model (not patients): 63 urgent messages in 3 languages. 34 of 63 were escalated at first pass. Every miss went to a clinician queue. None was answered by the bot.
- After the rules were widened, a fresh set of 60 messages (30 urgent, 30 normal): 26 of 30 urgent messages were escalated at first pass. 3 of 30 normal messages were falsely escalated.
- Both sets were used to tune the rules, so only a new, unseen set counts as evidence.
- With 7 of 7, the one-sided 95% lower bound on true sensitivity is about 65%. The 7 of 7 comes from the hand-written cases that the engine was built alongside, so treat it as a small-sample figure.

Not yet done: second clinician blind labelling; testing on real patient messages (not allowed in this challenge); any measured reduction in missed steps; model layer; Malaffi and Sahatna integration; real messaging channel; real database or login.

## 7. Path to pilot: next three steps

1. Get a second clinician to label the 30 cases blind. Resolve the six disagreements with a surgeon.
2. Obtain written permission from the employer (Ministry of Health, Malaysia) and the pilot clinic, then run a pilot at a clinic with an existing Telegram FAQ and red-flag triage bot.
3. Build a fresh, unseen message set after the rules are frozen. Measure escalation again. Add a published-rate figure for missed steps, with sources.
