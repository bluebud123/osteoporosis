# Patient page (patient.html)

A separate, mobile-first page for the patient to fill in the check-in. The patient never sees the clinician app: no tabs, no patient picker, no clinician summary. Code: `patient.html` (layout), `src/patient-ui.js` (logic, dual export), `src/checkin.js` (questions and flags). Tests: `bench/run-patient.js` (`npm run bench:patient`, also part of `npm run bench`).

Status: draft for clinical review. Arabic and Malay are drafted and need native clinical review before any patient sees them. The consent notice is marked DRAFT on the page.

## Opening the page

`patient.html#v=C-1031&set=first&lang=ms`

- `v` is the visit code. It must look like a code (letters, digits and hyphens, 2 to 20 characters). A missing or invalid code shows a friendly message in all three languages and no questions.
- `set` is `first` or `review`. If missing, it comes from the visit record (on treatment means `review`), otherwise `first`.
- `lang` is `en`, `ar` or `ms`. If missing, the saved draft language is used, otherwise English.
- The page reads only the one visit it is given. No other patient is loaded or shown.

## Contracts with the clinician app (localStorage, same origin)

**Outbox: `osteoloop.outbox`** (read by the clinician app; not yet read by `index.html`)

An array of records, newest last, capped at 50 (the oldest are dropped). Written on Send, and once when a same-day red flag stops the patient (`urgent: true`). Each record:

| Field | Type | Meaning |
| --- | --- | --- |
| `visit` | string | Visit code from the link |
| `caseId` | string | Case ID from the visit record, or the visit code if none |
| `set` | `first` or `review` | Which check-in |
| `lang` | `en`, `ar` or `ms` | Language the patient used |
| `answers` | object | Answers by question id, after `CI.normalise`. Text is kept whole here; `overLimit` lists any text longer than 1,000 characters |
| `flags` | array | `CI.flags(set, answers, {rx})`: tuples of `[id, level, text, source]` |
| `who` | `me`, `family`, `interpreter` or null | Who answered |
| `urgent` | boolean | True once a same-day red flag was ticked |
| `ts` | ISO 8601 string | Time written |
| `skipped` | string array | Question ids the patient skipped |
| `overLimit` | string array | Question ids with text longer than 1,000 characters |

Answer values use the codes in `src/checkin.js`. `"__unknown__"` (`CI.UNKNOWN`) means the patient chose Not sure. `"__none__"` (`CI.NONE`) means None on a text question.

**Visit records: `osteoloop.visits`** (optional, written by the clinician app; not yet written)

A JSON object keyed by visit code: `{"C-1031": {"caseId": "C-1031", "rx": "obp", "rxName": "alendronate"}}`. `rx` is the drug id used by `checkin.js`. `rxName` is shown in the adherence question. Without a record the page still works, with the generic wording.

**Drafts: sessionStorage `osteoloop.draft:<visit>|<set>`**

Saved after every answer, restored on reload in the same tab. Closing the tab clears it. Browser storage can be blocked: every read and write is wrapped, and the page falls back to memory.

## Behaviour

- **Consent first** (three languages, DRAFT banner), then the first question is "Who is filling this in?".
- **One question per screen.** Next stays disabled until the answer is valid, with the reason shown in text. Single choice does not auto-advance. The selected option is shown as the word "Selected", not only by colour.
- **Skip** is offered on every question except SAFETY_IDS (`fx`, `rfx`, `redf`, `sym`). Skipped questions show as Skipped on review.
- **Not sure** is offered on yes/no and medical-history items (`falls`, `smoke`, `alcohol`, `night`, `dental`, `rfx`, `rfall`, plus the existing Not sure on fracture, steroid, RA, parent and height-loss items). It is stored as the visible unknown and listed on review under "Please ask the doctor about these". A P-UNK note goes to the clinician.
- **Red-flag stop.** Ticking any same-day red flag (`CI.sameDayNow`: V-CES, V-LEG, V-FEVER with a spine site, V-FALL with a hip or spine site) shows a full-screen urgent card at once and writes an urgent outbox record. The patient continues only after "I have told staff / continue". The routine completion text is not shown after an urgent stop.
- **None of these** is exclusive: ticking a symptom clears None, and ticking None clears the symptoms, using the question's own `none` index.
- **Text limit.** Text is never cut silently. The counter shows the count from 800 characters, and Next and Send are blocked above 1,000 with the reason shown.
- **Back.** In-app Back and the browser Back both go to the previous question (history entries). Change from review edits one answer and returns to review (or to the next question still unanswered).
- **Cancel** asks first: keep the answers (the page shows a paused screen; Keep answering returns) or delete them.
- **Medicines.** The status after sending depends on the answers: a stop-and-ask line if the patient missed, stopped or has heartburn; otherwise "We will review your medicines at your visit." Never "keep taking" wording.
- **Emergency contact.** Placeholder only: `[clinic phone / emergency number: set by the hospital]`. TODO: the hospital supplies the real number through the site profile. Do not replace it with an invented number.

## Limits and known gaps

- The same-day rule matches the clinician flags exactly. A fever with no spine site is not same-day (V-FEVERW), so it does not stop the patient. This needs a clinical decision.
- The clinician app does not read the outbox or write visit records yet. `index.html` was not edited for this.
- Drafts are per browser tab. Answers entered on another device are not seen.
- The consent notice states that no AI reads the answers. If that changes, the notice must change first.
- Only the chief-complaint box carries the fixed warning line; the same-day stop is driven by the tick, not by the words typed.

## Sign-off list (every new string)

All strings are in the `T` table in `src/patient-ui.js`. English is the reference. Arabic and Malay need native clinical review.

1. Consent: "Before you start"; the DRAFT banner; "Who sees my answers?" and its answer; "Is AI used?" and its answer; "Can I skip a question?" and its answer; "How do I ask a person?" and its answer. Needs clinical lead and DPO approval.
2. Start button; "Who is filling this in?" with Me / A family member or carer / With an interpreter.
3. Chief-complaint fixed line: "If you describe a serious symptom here, please also tick it in the list of warning symptoms."
4. Urgent card: "Please tell a nurse or the front desk now." and the emergency-department sentence; "Clinic phone or emergency number"; the placeholder; "I have told staff / continue".
5. Medicine lines: "Please tell your nurse or doctor before you change your tablets. Do not stop on your own." and "We will review your medicines at your visit."
6. "In the last month, how have you taken your {drug}?" (named drug).
7. Review: "Check your answers", "You can change any answer before you send.", "Skipped", "Please ask the doctor about these" and its explanation, "Some answers need fixing before you can send".
8. Limit messages: "Your answer is {n} characters. The limit is 1,000. Please shorten it. Nothing has been cut off.", "{n} characters left".
9. Cancel dialog: "Stop and leave?", its explanation, "Leave and keep my answers", "Delete my answers", "Keep answering"; paused screen "Your answers are kept".
10. Done screens: "Thank you. Your answers are sent.", "The care team at this clinic will see them before your visit.", the urgent-done line.
11. Invalid link message (all three languages).
12. Progress "Question {n} of {m}", selected labels, Optional.
13. Language names in the header: English, العربية, Bahasa Melayu (the endonyms).
14. P-UNK flag text "Not sure about: ... Check at the visit" (English only, from `checkin.js`; the clinician sees English).
15. Scale end labels (existing "No pain" and "Worst possible" strings, reused in Arabic and Malay).

## Tests

`bench/run-patient.js`: unit checks U01 to U12 (pure functions, outbox, status lines, Not sure, same-day, escaping) and browser checks P01 to P22 at 390 px in headless Chrome. Browser checks cover viewport and lang/dir, no horizontal scroll and tap sizes, invalid link, reload restore, Back, Cancel, the 1,150-character block, exclusive None, the red-flag stop and outbox, the routine card hidden after urgent, Not sure, Arabic and Malay end to end, escaping, outbox shape and cap, Arabic scale direction, skip, Change, keyboard and live region, sandbox failures, language switch and the warning line.

Needs Playwright (global npm install) and Chrome at `/usr/bin/google-chrome` or `CHROME_BIN`.
