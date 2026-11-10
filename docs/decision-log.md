# PeriLoop Console: rule review and decision log (v2, 10 Nov 2026)

Author: Claude (AI), acting as design owner at Dr Tan's request. No clinician has reviewed anything below.
All data is synthetic. All test labels ("this message is urgent", "this reading is red") are the AI's, not a surgeon's.

## 1. What was wrong (measured before any change)

Measured through the real web entry points, AI off, on a held-out set written before any rule was touched (152 patient messages, 65 readings, 50 model replies).

| What | Before |
|---|---|
| Emergency messages that raised any alert | 30 of 43 |
| Same-day messages that raised an alert | 25 of 41 |
| Ordinary messages that raised a false same-day alert | 11 of 66 ("I can't find my appointment card", "severe traffic", "is fever normal after surgery?") |
| Ordinary messages answered only with "A clinician has to answer this, and I cannot" | 46 of 66 |
| Readings given the expected level | 48 of 65, with 9 missed reds (Hb 7.4 after surgery, BP 84, heart rate 38, platelets 42: no rule existed) |
| Harmless AI replies the output guard allowed | 1 of 20 |
| Unsafe AI replies the output guard blocked | 30 of 30 |

So the feeling that it "is not functional" was correct, for three reasons: most questions got a refusal, staff were paged for non-clinical messages while a third of real red flags slipped through, and with the AI switched on its replies were almost always blocked.

## 2. What was measured after, and how far to trust it

The method: write a set, measure, fix by listing each sign and the ways people say it, then write a NEW set and measure once before using it. Only the "fresh" rows are honest estimates. Rows marked "seen" guided fixes and are now regression tests (`node app/eval/holdout.test.js`).

**Patient-message triage, rules only (AI off)**

| Set | Emergencies alerted | Same-day alerted | False alerts on ordinary messages |
|---|---|---|---|
| Set 1, before | 30/43 | 25/41 | 11/66 |
| Set 1, after (seen) | 43/43 | 41/41 | 0/66 |
| Set 2, old rules | 23/30 | 20/30 | 5/40 |
| **Set 2, new rules, fresh** | **26/30** | **28/30** | **1/40** |
| Set 3, old rules | 15/20 | 12/15 | 2/20 |
| **Set 3, new rules, fresh** | **18/20** | **14/15** | **0/20** |
| Project's own 360-message library, old rules | 110/180 urgent caught | | 14/180 |
| Project's own 360-message library, new rules | 127/180 urgent caught | | 12/180 |

Fresh messages, both sets together: urgent caught 86 of 95 (91%) against 70 of 95 (74%) with the old rules; false alerts 1 of 60 against 7 of 60.
The target set in advance was 90% on a fresh set with no missed emergency. **It was not met: each fresh set still had missed emergencies (4, then 2).** The fresh misses were: "struggling for air", "took my blood thinner twice", "having fits", "脚发黑冰冷", "he is turning blue", "dada rasa macam dihempap", "knee ballooned up", "have not urinated since morning", "wound edges are separating". All are fixed now, but a fourth set would find more. On the project's harder library the rules alone still miss 53 of 180.

**Conclusion that follows:** fixed rules alone are not a safe sole triage. The AI second check must be on for any real use, and it has not been measured here (see section 5).

**Parameter thresholds:** set 1 before 48/65 (9 missed reds), after 65/65 (seen). Fresh set 2 (boundary values): old rules 30/40 (7 missed reds), new rules 40/40.

**Chat output guard:** set 1: harmless replies allowed 1/20 before, 19/20 after; unsafe sentences stopped 30/30 both. Fresh set 2: original guard 3/15 allowed and 19/20 stopped; new guard 14/15 allowed and 19/20 stopped. The one that got through both guards was "Stop eating from midnight before your operation" (an instruction built from the patient's own words). It is now blocked (20/20, seen).

## 3. One line per restriction

| # | Rule | Decision | Reason | Risk accepted |
|---|---|---|---|---|
| 1 | Mask phone, IC, email before storing or sending | Keep | Costs nothing, protects privacy | A masked phone number in a message has to be asked for again |
| 2 | Fixed red-flag rules run first; emergency and same-day replies are fixed texts with no AI | Keep, and add wording (`app/triage.js`) | An emergency reply must be predictable; coverage was 70% and 61% | More wording means some new false alerts; measured 1 in 60 on fresh messages |
| 3 | Catch-all: any message with "cannot, unable, severe, sudden, worse, blue" is same-day | Change: only when a body, symptom or function word is near it | It caused 7 of the 11 false alerts and caught 4 real cases, all of which the new wording catches | "I can't cope" style messages with no body word; a specific distress rule was added for that |
| 4 | "Fever" or a wound word anywhere is same-day | Change: a general question with no report ("is fever normal?", "what if the wound leaks?") gets the when-to-tell-us text and goes to the Inbox | Three languages of patients were told to phone the clinic today for asking a question | A patient who has the symptom but phrases it as a pure hypothetical gets information and an Inbox item, not an alert. Any "I have", "my wound is", a number or a time word keeps the alert |
| 5 | Engine bug: "scared" read as scar + red (wound alert) | Fix by re-reading without the word | False alert on "I am scared" | None found |
| 6 | Clinic extra phrases can only raise | Keep | Safe direction | None |
| 7 | AI second check can only raise, never lower | Keep | It is the net for the roughly 10 to 30% the rules miss | False same-day alerts from a cautious model; not measured with a real model |
| 8 | Emergency number fixed as 999 | Change: a setting (default 999) | The entry is for Abu Dhabi, where the ambulance is 998 | Someone sets a wrong number; only a doctor can change it and it must be 3 to 6 digits |
| 9 | Clinical questions (medicines, travel) are never answered | Keep | No safe way for a program to answer these | Patients wait for a person |
| 10 | Everything else got "A clinician has to answer this" | Change: clinic answer library of 19 fixed texts (`app/answers.js`), keyword-matched, each approved or switched off by a doctor | This is what makes the chat usable: 46 of 66 refusals became 0 | **The 19 texts are AI drafts.** While "Use draft answers" is on, patients see unapproved text, labelled as a draft. Acceptable only with synthetic data |
| 11 | AI may write only a question or a restatement | Change: AI may also (a) choose a library text, never write one, and (b) write reception-style sentences where the assistant or staff is the subject ("I've passed this to the ward team") | The old guard blocked 19 of 20 harmless replies | A cleverly worded opinion could pass a word list. Three blocks were added (instructions, verdict or forecast, promise of a reply time, claims about what staff said); a sentence that cannot be verified is dropped |
| 12 | Output guard in `app/lib/adapter.js` | Keep unchanged and still run first; new layer in `app/guard.js` | It blocks unsafe text well. Leaving `app/lib` identical to `src` keeps the 23 older test suites meaningful | Two guards to maintain |
| 13 | Assistant silent while a person handles the patient, until someone presses "hand back" | Change: silent for 30 minutes after a staff reply, then a receipt naming the staff member; record answers (operation date, checklist, follow-up) always given; automatic hand-back after 24 hours | Patients were writing into silence, possibly for days | A receipt could read as "someone has seen this". The text says they will see it when next at their desk and gives the phone number |
| 14 | Urgent texts never promise a reply | Keep, and enforce on AI text too | True for a prototype with no on-call rota | None |
| 15 | Doctor drafts are never auto-sent | Keep | A person must own every clinical sentence sent in their name; one click to use a draft is fast enough | Staff time |
| 16 | Role limits (doctor-only: rules, settings, closing clinical tasks, removing patients) | Keep; answer approval added as doctor-only | Matches accountability | A nurse cannot switch off a wrong draft answer; she must ask a doctor |
| 17 | Tasks close only with written evidence | Keep | This is the product's core claim | Staff time |
| 18 | Thresholds: no rules after surgery for Hb or platelets; none for low BP, slow heart rate, low temperature, low white cells; SpO2 and heart rate only after surgery; fever ignored on the day of surgery and before it | Change: 13 rules added, 6 widened to apply before surgery or on the day of surgery (`app/periop.js`, rule set v2) | 9 of 65 readings that should be red raised nothing | More amber flags for staff. Values are the AI's reading of common practice, not a protocol |
| 19 | Post-op day counted in 24-hour blocks from 08:00 on the operation day | Change: calendar days; on the day of surgery both the before and after rules apply | A 07:00 reading on post-op day 1 was scored as day 0 | On the day of surgery a pre-op rule can fire on an evening reading (for example Hb 11 gives "anaemia: plan before surgery") |
| 20 | Unanswered messages got a refusal | Change: a receipt that says the team reads messages in clinic hours, gives the phone, and lists the five emergencies to call for | Residual misses will happen; the receipt is the last net | Longer text |

## 4. What was left alone, and why

- `app/lib/*` (engine, adapter, second check, proxy): byte-identical to `src/`. All 23 `src/mod/*.test.js` suites pass unchanged. No existing test expectation was changed except one count in `app/test.js` (33 patients instead of 32, because the new tests add one).
- Arabic red-flag rules: not changed and barely measured (12 messages). Arabic patients now get Arabic emergency, same-day and receipt texts, but library answers fall back to English.
- The engine still treats "confused" as an emergency, so "I'm confused about my appointment date" raises one. Left, because I will not lower an emergency rule without a clinician.
- No reminders, SMS, on-call escalation, encryption or backups were added. Those are the next real gaps, and they are not rule changes.

## 5. What could not be verified

1. **Any real model.** No provider is reachable from the build environment. The second check, the answer chooser and the chat replies were exercised only with a stand-in model that returns canned text. How often DeepSeek flags a missed emergency, picks the wrong answer, or writes something the guard should block is unknown. The guard holdout replies were written by me, not sampled from a model.
2. **Clinical correctness** of every label, threshold and library text.
3. **Malay, Chinese and Arabic wording**: written by an AI, not checked by native speakers or with real patient messages.
4. **Real patient language.** Every test message was invented.
5. **998 for the UAE ambulance**: from my general knowledge; confirm locally.
6. Load, security and privacy beyond what `app/README.md` already lists as limits.

## 6. What a surgeon must sign off before any real patient uses it

1. Every text in the clinic answer library (Rules page: approve, edit in `app/answers.js`, or switch off), then turn off "Use draft answers" in Settings.
2. The four fixed patient texts (emergency, same-day, receipt, clinical handover) in each language, the clinic phone, clinic hours and emergency number.
3. Every threshold in `app/periop.js` against the unit's own protocol, including who owns each flag.
4. The red-flag list: read the misses in section 2, add the unit's own phrases on the Rules page, and decide whether rule 4 (general questions do not page) is acceptable.
5. A measured run of the AI second check with the real provider on `app/eval/triage_h*.js` and the 360-message library, with a stated minimum (I suggest no missed emergency on a fresh set of at least 50) before go-live, and a decision on what happens when the provider is down.
6. Who is responsible for the Inbox and Alerts in clinic hours, and what patients are told outside them.
7. Privacy, consent, indemnity and hosting, as already listed in `app/README.md`.

## 7. How to reproduce

```
node app/test.js                 # 115 end-to-end checks (stand-in model)
node app/eval/holdout.test.js    # held-out sets as regression tests (rules only)
for f in src/mod/*.test.js; do node "$f"; done
# browser test (needs Python Playwright and Chrome):
node app/eval/standin_model.js &
PORT=8080 PROVIDER_BASE_URL=http://localhost:9777 PROVIDER_KEY=x PROVIDER_MODEL=standin node app/server.js &
python3 app/eval/browser_e2e.py  # 33 checks: doctor, patient on a phone, Live view, calendar, nurse
```
The held-out sets and their SHA-256 hashes, recorded when each was written, are in `app/eval/`. Screenshots from the browser run are in `app/eval/shots/`.
