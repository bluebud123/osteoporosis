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

---

# v3 (12 Nov 2026): independent review, reviewer set, and what changed

Author of this section: Claude (AI), acting on an independent AI review of v2. Still true: no clinician has reviewed anything, every label is an AI's, and no real model has been run in the Console.

## v3.1 Reviewer set (triage_h4), measured BEFORE any v3 change

An independent AI reviewer wrote 149 messages (72 emergency, 37 same-day, 40 ordinary; English, Malay, Chinese incl. traditional characters, Arabic incl. Gulf and Egyptian forms) and ran them once through the real HTTP entry point, AI off, on the v2 code (commit 8eb78ff). The reviewer had read `app/triage.js` first and aimed at awkward wording, so this is a stress test, not an estimate. Labels are the reviewer's, not a clinician's. File: `app/eval/triage_h4.js` (SHA-256 in `app/eval/SHA256.txt`).

| | v2 rules, fresh |
|---|---|
| Emergencies that raised any alert | 56 of 72 (78%) |
| Emergencies classed EMERGENCY | 54 of 72 |
| Same-day messages alerted | 31 of 37 |
| Ordinary messages that alerted | 4 of 40, three of them as EMERGENCY |
| Emergencies alerted, by language | en 17/25, ms 13/16, zh 14/17, ar 12/14 |

Missed emergencies (no alert): "feels like im drowning when i lie down", "i coughed up something red", "i dont want to be here anymore", "took 10 tramadol at once", "sharp pain when i breathe in", "sob since this morning", "cp radiating to left arm", "cnt breathe", "tak leh nafas", "xleh bernafas", "mak tiba2 cakap merepek", "心脏跳得很快，快晕了", "呼吸困難", "透不過氣", "نزيف لا يتوقف من الجرح", "مش قادر اخد نفسي". Emergencies classed only same-day: "blood is coming through the bandage and dripping on the floor", "رجلي منتفخة وتعورني وأحس بكتمة".
Missed same-day: "knee is locked, wont bend at all", "i missed my blood thinner injection for 3 days" (went to the clinician route, no alert), "the pain meds arent doing anything, i was up all night crying", "luka keluar air", "傷口有臭味", "الركبة حمراء وساخنة".
False alerts: "my chest of drawers is too low to reach, any tips?" (EMERGENCY), "im confused about my appointment date" (EMERGENCY), "walked to the kitchen and back, bit out of breath but proud" (EMERGENCY), "my son fell off his bike yesterday but hes ok, can he still drive me?" (SAME-DAY).

Together with v2: on three sets written by two different AI authors the v2 rules alone caught 91% (own fresh sets), 80% (this set) and 71% (the 360 library; Arabic 28 of 60). The spread is the honest picture.

Correction to the review text: the reviewer set has 149 messages (72 + 37 + 40), not 153 as the review said.

## v3.2 What was changed in the rules (`app/triage.js`), and why

All additions raise only. `app/lib/` is untouched and still byte-identical to `src/`.

| # | Change | Reason (message that showed it) | Risk accepted |
|---|---|---|---|
| 1 | Traditional Chinese characters are converted to simplified before matching (about 200 characters) | "呼吸困難", "透不過氣", "傷口有臭味" were missed while the simplified forms were caught | The map is not complete; a rare character will still slip through |
| 2 | Text-speak is rewritten into the plain form first: cnt, dont/arent/isnt, x leh / tak leh / xboleh, tiba2, "sob" (only with a time or severity word), "cp" (only with radiating, arm, jaw or similar) | "cnt breathe", "xleh bernafas", "sob since this morning", "cp radiating to left arm" | "sob" or "cp" used for something else beside a time word will alert |
| 3 | The engine now reads both the raw and the rewritten text; the higher class wins | So the unchanged engine benefits from 1 and 2 | None found |
| 4 | Self-harm wording: "don't want to be here (anymore)", "kill myself", "end my life", "no reason to keep living", "bunuh diri", "lebih baik saya mati", 想死, 自杀, Arabic forms | "i dont want to be here anymore" got the ordinary receipt | "I don't want to be here at 7am" does not alert (the phrase must end the sentence); other innocent uses may |
| 5 | Overdose by count: took or swallowed 4 or more of a named medicine, or a whole strip, box or bottle, or "all my ... tablets" | "took 10 tramadol at once" | The number 4 is the AI's guess. Someone correctly prescribed 4 tablets at once will get an emergency text |
| 6 | Pain on breathing in; coughing "something red" or pink froth; feeling of drowning or suffocating lying down; "heart attack" or "stroke" said by the patient; coffee-ground or black vomit; seeing people who are not there | Each was a miss in set 4 or set 5 | More alerts |
| 7 | Bleeding that is dripping, pooling or on the floor is an emergency, not same-day | "blood is coming through the bandage and dripping on the floor" | None found |
| 8 | Leg swelling together with breathlessness in one message is an emergency | "رجلي منتفخة وتعورني وأحس بكتمة" was only same-day | None found |
| 9 | Arabic wording added for breathlessness, chest pain, bleeding that will not stop, unresponsive relative, self-harm, pain on breathing, wound pus or smell, wound opening, hot or red knee, fever with a number, fall, pain not controlled. Arabic negation ("لا يوجد", "ما فيه", "ليست", "بدون" ...) is now read | Arabic was 28 of 60 on the library | **Written by an AI with no native review.** Gulf and Egyptian forms are imitations. A wrong word may alert on an ordinary message or miss a real one |
| 10 | Same-day: locked knee; painkillers "not doing anything"; awake all night with pain; anticoagulant missed or run out for 2 or more days or doses; Malay "luka keluar air"; massive swelling; "the cut has opened" | Misses in set 4 or set 5 | The missed-anticoagulant rule pages staff for a medicine question that v2 sent to the clinician route with no alert |
| 11 | Two regex bugs fixed in the v2 wording: "reach" matched "ach..." (so "chest of drawers ... reach" was a chest-pain EMERGENCY) and "kitchen" matched "itch..." | Two false emergencies in set 4 | None: both were accidents |
| 12 | Furniture and idioms ("chest of drawers", "pain in the neck", "breathtaking") are removed before the ADDED wording is matched. The engine still sees them | Same | A real symptom inside the same phrase would still be read by the engine |
| 13 | **The only lowering.** "I'm confused about my appointment / booking / appointment date" is no longer an EMERGENCY. It applies only if confusion is the sole emergency sign, the word is followed by about/over/with + an appointment or booking word, the writer is the first person, and there is no body, symptom, medicine or disorientation word ("what day", "where I am"). "Mum is confused about her appointment" and "I'm confused, don't know what day it is" stay EMERGENCY | The v2 log left this for a clinician; the review listed it as a false 999 | **Awaiting clinician sign-off.** A delirious patient who types exactly this is sent to the Inbox, not told to call the emergency number. Remove `adminConfusion` in `app/triage.js` to undo it |

Left alone on purpose (listed in `app/eval/known_gaps.js`, printed on every test run):
- "my son fell off his bike yesterday but hes ok, can he still drive me?" is still SAME-DAY. The unchanged engine alerts on any reported fall. Lowering it needs a clinician.
- "walked to the kitchen and back, bit out of breath but proud" is still EMERGENCY for breathlessness. The reviewer labelled it ordinary, but new breathlessness on exertion four days after knee replacement may be a clot in the lung. A clinician should decide.

## v3.3 Scores after the change, and a new fresh set

| Set | Who wrote it | State | Emergencies alerted | Same-day alerted | False alerts |
|---|---|---|---|---|---|
| Reviewer set 4, v2 rules | independent AI reviewer | fresh, measured once | 56/72 | 31/37 | 4/40 |
| Reviewer set 4, v3 rules | same | **seen** (guided the fixes) | 72/72 | 37/37 | 2/40, both left on purpose |
| **Set 5, v3 rules** | the AI that wrote the v3 rules | **fresh, measured once** | **39/46** (38 classed EMERGENCY) | **20/23** | **0/30** |
| Set 5, after its misses were fixed | same | seen | 46/46 | 23/23 | 0/30 |
| 360 library, v2 rules | earlier AI | not fresh | 127/180 urgent (en 32/40, ms 34/40, zh 33/40, ar 28/60) | | 12/180 |
| 360 library, v3 rules | earlier AI | not fresh | 134/180 urgent (en 32/40, ms 35/40, zh 34/40, ar 33/60) | | 12/180 |

Set 5 fresh, urgent together: 59 of 69 (86%). Emergencies by language: en 16/20, ms 8/10, zh 8/8, ar 7/8. The seven missed emergencies were: "theres no reason for me to keep living", "she keeps seeing people who arent there since last night", "i think im having a heart attack", "vomited something that looks like coffee grounds", "saya termakan ubat tidur banyak sangat", "saya rasa lebih baik saya mati", "امي تتنفس بصعوبة وما تقدر تتكلم". One was only same-day: "رجلي متورمة مرة وصرت اتعب من النفس". Missed same-day: "the cut has opened about 2cm at the top", "knee has swollen up massively since this morning", "the oxycodone isnt touching the pain". All were then fixed, so set 5 is a regression set now and its 100% means nothing.

What this shows:
1. The v2 conclusion stands. After three rounds of fixes a fresh set still had 7 missed emergencies in 46, two of them statements about wanting to die. Fixed word lists do not converge. Rules alone are not a safe sole triage.
2. Set 5 was written by the same AI that wrote the rules, so 86% is likely flattering. The reviewer's 80% on v2 and the library's 74% on v3 are the less friendly numbers.
3. Arabic is still the weakest: 33 of 60 on the library after the additions.
4. No number here has a clinician or a patient in it.

## v3.4 Tools added so the missing evidence can be produced

- `app/eval/run_model_eval.js`: one command that sends every test message through the real server path with a real model and writes a per-language table (rules alone, rules + AI check, false alerts, check unavailable, missed emergencies). It refuses to run without a provider. It has been run only against the stand-in model to check that it works; that output is marked "STAND-IN, NOT EVIDENCE" and is not committed. **No real model has been run in the Console.**
- `app/eval/label.html` (open `/eval/label` after logging in as a doctor): blind labelling, one message at a time, no AI label shown. `app/eval/score_labels.js` scores the rules against one clinician's labels and gives Cohen's kappa between two. `node app/eval/score_labels.test.js` tests the arithmetic.
- `docs/clinician-todo.md`: what only Dr Tan can do, in order, with time estimates.

## v3.5 Other changes in the Console

| Change | Before | After |
|---|---|---|
| Unset clinic phone and hours | Patients saw "call 03-0000 0000 (set in Settings)" and "clinic hours (Set the clinic hours in Settings)" | Unset phone reads "the clinic number on your appointment card" in the patient's language; unset hours are left out of the sentence (`app/phrases.js`). Old databases with the placeholder strings are treated as unset |
| Seeded demo | Same placeholders | The 30-patient demo gets "555-0100 (fictional demo line)" and "Demo clinic hours: Sunday to Thursday, 8am to 4pm". Today shows "Demo contact details in use" until a doctor replaces them |
| Demo board | 93 overdue tasks on first login | 28: most demo patients are up to date, every fourth keeps a few days overdue, and 15 are open flag tasks. Only the seed changed; the overdue logic did not |
| Live view, step 2 text | "Written by people" | Says the lists were drafted by an AI, await surgeon sign-off, and that Arabic is weakest |
| Today, AI notice | "AI is off. See README" | Says the rules alone miss some urgent messages and names the three settings that turn the check on |
| Today | | A card pointing to the Live view for demos. `app/README.md` no longer says the Live view opens first (it never did; Today does) |
| Pipeline trace wording | "v2 layer" | "added-wording layer" |

Test expectations changed, each on purpose:
- `app/eval/browser_e2e.py`: one check looked for the words "v2 layer" in the Live view; it now looks for "added-wording layer".
- `app/eval/holdout.test.js`: now also runs sets 4 and 5, and prints (without failing) the two false alerts listed in `known_gaps.js`.
- `app/test.js`: no expectation changed. 117 of 117 pass.

Noticed and not fixed:
- A Malay-language patient who writes a short Malay message the rules do not recognise ("lutut saya berbunyi") gets the English receipt, because the unchanged engine guesses the language as English. Fixing it means changing how the server picks the reply language; left for a decision.
- The emergency number still defaults to 999. 998 for Abu Dhabi is still unconfirmed.
- `app/answers.js` still has no Arabic texts; Arabic patients get English library answers.
- No notifications, on-call escalation, encryption or backups. Unchanged from v2.

## v3.6 What a clinician must review that v3 added

1. Row 13 above (the one lowering) and the two known gaps.
2. Row 5: the overdose count of 4.
3. Row 10: whether missed anticoagulant doses should page the same day.
4. Every Arabic phrase in the v3 block of `app/triage.js`, by a native Arabic-speaking clinician.
5. The fallback wording "the clinic number on your appointment card" in four languages (`app/phrases.js`).

## v3.7 Live test on Dr Tan's PC with a real model (12 Nov 2026)

Done by Claude (AI) through a browser on the running Console (`deepseek-chat`, AI check on). 15 invented messages typed as a patient on a TKR patient 5 days after surgery. This is a smoke test, not a measurement.

Worked: emergency, same-day and receipt texts came back in the patient's language (en, ms, zh, ar) with no placeholder text; the Arabic chest-pain message was an EMERGENCY from the rules; record answers and library answers arrived in about 1 second, AI replies in 2 to 3 seconds.

Found, and what was done:

| Finding | Action |
|---|---|
| "is it normal to hear clicking in the knee?" and "do you remember my medical illness?" both got the AI reply "Would you like me to tell you what is still pending on your checklist?", which ignores the question | Chat prompt in `app/ai.js` changed: stay on the patient's question; if it cannot be answered, say so and say it was passed to the clinic team; offer the record lookups only after a greeting or "what can you do". No rule or guard changed. **Not yet re-tested with the real model** |
| "the dressing is soaked through with yellow fluid and it stinks" is an EMERGENCY flagged "heavy bleeding". It should be a same-day wound alert | Not changed (no more hand-edited wording). It errs on the safe side but the flag text is wrong. For clinician review |
| "what should I bring to my physio appointment?" returns the hospital admission list (IC, insurance card, medicines) | Not changed. The "bring" answer has no separate text for clinic or physio visits. For the answer-library sign-off |
| A server left running from before a branch switch keeps the old rules while showing the new pages | Restart the server after every `git checkout` or `git pull` |

## v3.8 (12 Nov 2026): evaluation script procedure keys

`app/eval/run_model_eval.js` accepted the procedure keys LUM, SHO and FOOT, but the library and the server use LUMBAR, SHOULDER and FOOTANKLE. So 156 of the 360 library messages (lumbar 53, shoulder 56, foot and ankle 47) would have been sent as knee replacement patients. Fixed to the server's keys before any real-model run was quoted. Any run made before this commit should be repeated, not quoted. Verified by reading the code and counting the library; the effect on scores was not measured.

## v3.9 (12 Nov 2026): first real-model run in the Console, and what it does not show

Dr Tan ran `run-model-eval.bat` (full run, 913 messages, `deepseek-chat`, 247 s) on his PC. The screen output is saved as `docs/evidence/model_run_2026-11-12_deepseek-chat_run1.md`. This is the first time a real model has been run through the Console.

| | Rules alone | Rules + AI check |
|---|---|---|
| Urgent messages alerted, all languages | 491/537 (91%) | 537/537 (100%) |
| Arabic | 72/99 (73%) | 99/99 (100%) |
| Labelled emergencies | 211/211 | 211/211 |
| False alerts on ordinary messages | 14/376 (4%) | 20/376 (5%) |
| AI check unavailable | | 1 |

How far to trust it:
1. Every message is invented and every label is an AI's. No clinician is in these numbers.
2. All six sets have been used to tune the rules, so "rules alone" is optimistic.
3. The server asks the AI only when the rules find nothing. So the AI was asked about 46 urgent messages (all from the library, 27 of them Arabic) and it flagged all 46. That is the whole of the evidence for the AI check in this run: 46 of 46, one run, one model. With 46 of 46 the one-sided 95% lower bound on its catch rate is about 94%.
4. **The AI check was not tested on a single labelled emergency**, because the rules had already caught all 211. "211 of 211" says nothing about the model.
5. The AI check can raise only to SAME-DAY. An emergency that the rules miss and the AI catches gets the "call the clinic today" text, not the emergency text.
6. It is not confirmed whether this run was made before or after the procedure-key fix (v3.8). Treat it as preliminary.
7. The AI raised 6 ordinary messages; 4 are general questions ("is it normal to get a fever after knee surgery?") that rule 4 of v2 had deliberately sent to the answer library. The AI check undoes that rule for those messages. Left as it is: the raise-only principle wins, and a clinician should decide.
8. During the run the output guard blocked 13 model chat replies (instruction, verdict or forecast, medicine, diagnosis, advice). The guard worked; it also shows the model does try to give advice.

Change made because of point 4: `run_model_eval.js --ai-alone` (option 3 in `run-model-eval.bat`) asks the AI check about every message, including those the rules caught, and adds a table "AI check by itself". `app/server.js` now exports `secondCheck` for this; no behaviour of the server changed. Tested with the stand-in model only. The numbers in the brief will be taken from an `--ai-alone` run made after this commit.

## v3.10 (12 Nov 2026): second real-model run, with the AI check scored by itself

Dr Tan pulled commit 591b926 (so the procedure-key fix of v3.8 is included; option 3 exists only after that commit) and ran option 3: 913 messages, `deepseek-chat`, 397 s. Output: `docs/evidence/model_run_2026-11-12_deepseek-chat_run2_ai_alone.md`.

| | Result |
|---|---|
| Rules alone, urgent alerted | 491/537 (91%); en 199/207, ms 116/121, zh 104/110, ar 72/99. Same as run 1 |
| Rules + AI check, urgent alerted | 537/537; labelled emergencies 211/211 |
| False alerts, rules alone / rules + AI | 14/376 / 22/376 (run 1: 20/376) |
| AI check by itself, urgent flagged | 519/537 (97%); labelled emergencies 198/211 (94%); Arabic emergencies 21/26 |
| AI check by itself, ordinary raised | 11/376 (3%) |
| AI gave no usable answer | 19 of 913 direct or server calls (about 2%): 18 urgent messages, 13 of them labelled emergencies |

What it shows:
1. When the model answered, it flagged every urgent message (519 of 519) and every labelled emergency (198 of 198). **Every miss of the AI check alone was "unavailable", not "routine".**
2. So the weak point of the AI layer in this run is availability, not judgement. The cause is not known: the script did not record the reason (timeout, a reply that was not valid JSON, a provider error or a content filter are all possible). The 18 are short, plainly urgent messages in all four languages, 17 of them asked through the direct call that `--ai-alone` adds. Whether the direct call fails more often than the server path is not known either.
3. In the product, a message the rules miss while the AI is unavailable gets the ordinary receipt (which lists the five emergencies to call for) and is marked "unscreened" for staff. There is no retry. A retry or a "treat unscreened as same-day" setting is a decision for the clinician; not changed here.
4. The model is not deterministic: 8 ordinary messages raised in this run, 6 in run 1.
5. Limits as before: invented messages, AI labels, sets the rules were tuned on, one model.

Changed: `docs/solution-brief.md`, `README.md` and `docs/video-script.md` now quote this run. `run_model_eval.js` now records the reason the AI check gave when it was unavailable, so a later run can say why. No server behaviour changed.
