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
node app/eval/run_model_eval.js  # real-model run of the second check; needs the three PROVIDER variables
```

## What the evidence says

All test messages are synthetic and AI-written, and all labels are AI labels. On sets measured once before being used for fixes, the fixed rules alone alerted on 80 to 91% of urgent messages, and on 74% of an older 360-message library (Arabic 33 of 60). Every fresh set still contained missed emergencies. Rules alone are not a safe sole triage.

Not yet done: a real-model run of the second check in the Console, clinician labelling, surgeon sign-off, native review of the Malay, Chinese and Arabic texts.

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
