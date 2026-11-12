# PeriLoop Console

A prototype perioperative follow-up system for elective orthopaedics, starting with total knee replacement. Every task and patient message gets a named owner and a written closure. Patient messages are screened by fixed red-flag rules, with an optional AI second check that can only raise urgency.

Built for the Future Health Digital Innovation Challenge 2026 (Abu Dhabi), Statement 3: "Closing the Screening-to-Care Loop".

**Synthetic data only. Not clinically validated.** Most code, rules, thresholds, patient texts (English, Malay, Chinese, Arabic) and test labels were drafted by an AI and await clinician sign-off. Do not use with real patients.

## Run it

Node 18 or later. No dependencies.

```
node app/server.js          # then open http://localhost:8080
```

Demo logins: `doctor` / `doctor-demo-1` and `nurse` / `nurse-demo-1`. Thirty fictional patients are loaded on first run. Open **Live view** to type as a patient and watch the rules, the reply and the staff panel side by side.

To turn on the AI second check, set `PROVIDER_BASE_URL`, `PROVIDER_KEY` and `PROVIDER_MODEL` (any OpenAI-compatible provider) before starting. Without them the system runs on rules only and says so.

## Test it

```
node app/test.js                 # 117 end-to-end checks
node app/eval/holdout.test.js    # held-out message, reading and guard sets (regression tests, not evidence)
node app/eval/v4.test.js         # emergency line, AI severity, patient profile memory (stand-in model)
node app/eval/v5.test.js         # learning: signals, doctor-approved lessons, topic index (stand-in model)
node app/eval/v6.test.js         # dose check for doctors, chief-doctor approval
node app/eval/v7.test.js         # age and sex, over-booked day suggestion
node app/eval/load.test.js       # the safety check survives a provider that rejects simultaneous calls
node app/eval/run_model_eval.js  # real-model run of the second check; needs the three PROVIDER variables
```

## What the evidence says

All test messages are synthetic and AI-written, and all labels are AI labels.

- **Rules alone, on sets measured once before being used for fixes:** 80 to 91% of urgent messages alerted. Every fresh set still contained missed emergencies.
- **Real model in the Console (DeepSeek `deepseek-chat`, 913 messages, 12 Nov 2026, current code):** rules alone alerted on 491 of 537 urgent messages (91%; Arabic 73%). Rules plus the AI check alerted on 537 of 537, with 20 false alerts in 376 ordinary messages (rules alone: 14). The AI check was available for every message.
- **AI check by itself:** 529 of 537. All 8 misses were calls with no usable answer after one retry. Neither layer is enough alone.
- **A failed run is kept in the record:** one run lost a third of its AI checks when new features overloaded the provider. Staff were alerted each time and no labelled emergency was missed. Fixed and re-run (decision log v7.1).

- **Against one clinician's blind labels (368 English messages):** all 155 messages he called emergencies raised an alert with the AI check on (150 with rules alone); none of his 114 routine messages did. 47 of the 155 got "call the clinic today" instead of the emergency text.

One run of one model, on sets the rules were tuned on. Raw output: `docs/evidence/`.

Not yet done: a second clinician labeller, labels in Malay, Chinese and Arabic, surgeon sign-off, native review of the Malay, Chinese and Arabic texts.

## Where to read more

| File | What it is |
|---|---|
| `docs/solution-brief.md` | Brief for judges: what it does, one evidence table, gaps |
| `docs/decision-log.md` | Every rule decision, every measurement, what could not be verified |
| `docs/clinician-todo.md` | The steps only a clinician can do before submission |
| `docs/video-script.md` | Two-minute demo script |
| `docs/DEPLOY.md` | Hosting the demo |
| `app/README.md` | Console features and limits |

`index.html` at the repository root is an older single-page prototype, kept for history. Its README is `docs/old-prototype-README.md` and its claim check is `docs/claims.md`.

## Author

A solo orthopaedic medical officer in Malaysia.
