# PeriLoop Console (prototype)

A small real system for perioperative follow-up. Synthetic data only until a clinic approves real use.

**Run:** `node server.js` (Node 18+), or on Windows right-click `start-console.ps1` > Run with PowerShell. Open http://localhost:8080.
Demo logins: `doctor` / `doctor-demo-1`, `nurse` / `nurse-demo-1` (change them in Settings).
**Test:** `node test.js` (no network or key needed; uses a stand-in model).

## What it does
- **Patients:** add a patient (short name, record number, procedure, operation date). The checklist is created from the pathway rules. Each patient gets a private chat link.
- **Rules (doctor):** edit the checklist items, owners and due days; add extra red-flag phrases (they can only raise urgency); write clinic-approved answers for common questions.
- **Inbox / Alerts:** urgent messages first. Acknowledge records who and when. Reply as a named person; while a person is handling a patient, the assistant stays quiet (urgent messages are still answered).
- **Checklist:** a task closes only with written evidence; doctor decisions can only be closed by a doctor.
- **Patient chat:** fixed red-flag rules run first, then an optional AI second check that can only raise urgency. The AI may write a short friendly reply to non-clinical messages, checked by the output guard and labelled. It never answers clinical questions. Urgent replies tell the patient to call or go to the Emergency Department and never promise that someone will reply.

## AI
Set `PROVIDER_BASE_URL`, `PROVIDER_KEY`, `PROVIDER_MODEL` (any OpenAI-compatible provider). Without them the system runs on rules only. The key stays on the server.

## Honest limits
Data is one JSON file (`data/db.json`), single server, no encryption at rest, no backups, no email or SMS, no reminders sent yet (overdue is shown, not pushed). Patient links are the only patient identity (no DOB check). Clinical thresholds and wording are drafts awaiting surgeon sign-off. Not validated by clinicians. Do not use with real patients until privacy, consent, indemnity and security are settled with the clinic.
