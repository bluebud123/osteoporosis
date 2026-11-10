# PeriLoop Console (prototype)

A small real system for perioperative follow-up. Synthetic data only until a clinic approves real use.

**Run:** `node server.js` (Node 18+), or on Windows right-click `start-console.ps1` > Run with PowerShell. Open http://localhost:8080.
Demo logins: `doctor` / `doctor-demo-1`, `nurse` / `nurse-demo-1` (change them in Settings).
**Test:** `node test.js` and `node eval/holdout.test.js` (no network or key needed; uses a stand-in model).

## What it does
- **Live view** (opens first): patient chat, the AI and rules pipeline step by step, and the staff panel side by side. Anything typed as the patient shows up in all three. A library of 360 test messages (English, Malay, Chinese, Arabic; labels written by AI, not clinicians) can be replayed as any patient.
- **30 fictional demo patients** are loaded on first run (from the project's test material), spread across the journey, with intake answers.
- **Patients:** add a patient (short name, record number, procedure, operation date). The checklist is created from the pathway rules. Each patient gets a private chat link.
- **Rules (doctor):** edit the checklist items, owners and due days; add extra red-flag phrases (they can only raise urgency); write clinic-approved answers for common questions.
- **Inbox / Alerts:** urgent messages first. Acknowledge records who and when. Reply as a named person; while a person is handling a patient, the assistant stays quiet (urgent messages are still answered).
- **Checklist:** a task closes only with written evidence; doctor decisions can only be closed by a doctor.
- **Patient chat:** fixed red-flag rules run first, then an optional AI second check that can only raise urgency. The AI may write a short friendly reply to non-clinical messages, checked by the output guard and labelled. It never answers clinical questions. Urgent replies tell the patient to call or go to the Emergency Department and never promise that someone will reply.

## Version 2 (10 Nov 2026): measured rule review
The rules were measured on held-out sets and changed. Read `../docs/decision-log.md` first: it has the before and after numbers, one line per rule, what could not be verified, and what a surgeon must sign off.
- `triage.js`: added red-flag wording and two narrow reductions on top of the unchanged engine in `lib/`.
- `answers.js`: 19 fixed clinic answers (AI drafts; a doctor approves or switches off each one on the Rules page).
- `guard.js`: chat output guard that lets reception-style replies through and blocks instructions, verdicts and promises.
- `periop.js`: threshold rule set v2 (post-op haemoglobin and platelets, low BP, slow heart rate, and more).
- Settings: emergency number (999 by default; set it for your country) and "Use draft clinic answers".
- `eval/`: the held-out sets, a regression test (`node eval/holdout.test.js`), a browser test and screenshots.
Fixed rules alone caught 91% of urgent messages on fresh test sets and 127 of 180 on the project's own library, so keep the AI second check on for anything beyond a demo.

## AI
Set `PROVIDER_BASE_URL`, `PROVIDER_KEY`, `PROVIDER_MODEL` (any OpenAI-compatible provider). Without them the system runs on rules only. The key stays on the server.

## Honest limits
Data is one JSON file (`data/db.json`), single server, no encryption at rest, no backups, no email or SMS, no reminders sent yet (overdue is shown, not pushed). Patient links are the only patient identity (no DOB check). Clinical thresholds and wording are drafts awaiting surgeon sign-off. Not validated by clinicians. Do not use with real patients until privacy, consent, indemnity and security are settled with the clinic.
