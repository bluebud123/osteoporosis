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
2. So the weak point of the AI layer in this run is availability, not judgement. The cause is not known: the script did not record the reason (timeout, a reply that was not valid JSON, a provider error or a content filter are all possible). The 18 are short, plainly urgent messages in all four languages, and all 18 were asked through the direct call that `--ai-alone` adds (the nineteenth unavailable answer was an ordinary message on the server path). Whether the direct call fails more often than the server path is not known either.
3. In the product, a message the rules miss while the AI is unavailable gets the ordinary receipt (which lists the five emergencies to call for) and is marked "unscreened" for staff. There is no retry. A retry or a "treat unscreened as same-day" setting is a decision for the clinician; not changed here.
4. The model is not deterministic: 8 ordinary messages raised in this run, 6 in run 1.
5. Limits as before: invented messages, AI labels, sets the rules were tuned on, one model.

Changed: `docs/solution-brief.md`, `README.md` and `docs/video-script.md` now quote this run. `run_model_eval.js` now records the reason the AI check gave when it was unavailable, so a later run can say why. No server behaviour changed.

## v3.11 (12 Nov 2026): labelling page ignored new settings

Reported by Dr Tan: after changing the language ticks or the number of messages, the page still showed the first 150 mixed English and Malay messages. Cause: a session saved in the browser under the same initials was resumed silently, and the settings were ignored. Fix in `app/eval/label.html`: the button now reads "Continue saved session", the note says the settings are ignored when continuing, and a second button starts a new session with the settings on the page (after a confirmation, because it deletes the saved labels). Starting with no language ticked is refused. Checked in a browser: English only, 0 = all, gives 368 messages, all English.

## v3.12 (12 Nov 2026): first clinician labels (one labeller, English)

Dr Tan (orthopaedic medical officer, initials TSH) labelled all 368 English messages in the pool, blind to the AI labels and the rule results. File: `docs/evidence/labels_tsh_2026-11-12.json`; score: `docs/evidence/labels_tsh_2026-11-12_score.md` (`node app/eval/score_labels.js`). His labels: 157 emergency, 101 same-day, 110 routine, 0 unsure.

Rules alone (no AI) against his labels:

| Measure | Result |
|---|---|
| His emergencies that raised any alert | 150 of 157 (96%, 95% CI 91 to 98) |
| His emergencies that got the emergency text | 108 of 157 (69%, 95% CI 61 to 76) |
| His urgent messages (emergency or same-day) that raised any alert | 202 of 258 (78%, 95% CI 73 to 83) |
| His routine messages that raised an alert | 0 of 110 |
| Agreement with the AI labels, urgent against routine | 86%, Cohen's kappa 0.71 |

What it shows:
1. **The clinician is stricter than the system at both steps.** 42 messages he called emergency got only "call the clinic today": fever of 38.4 and above, pus or a foul smell from the wound, a fall on the operated knee, a hard swollen calf, vomiting everything, cannot pass urine. 49 messages the AI had labelled routine he called same-day; most are questions that need a clinical answer ("can I shower?", "do I need to fast?", "is bruising normal?").
2. The second group is partly a difference of definition. The page defined same-day as "a clinician should speak to or see the patient today". The system uses SAME-DAY to mean "page staff". A question that needs an answer today is not a page in the system; it goes to the inbox. So "78%" understates the rules against the system's own definition and should not be quoted without this note.
3. Seven of his emergencies raised nothing. Five are real gaps in the rules: a hot swollen leg after an 11-hour flight three weeks after knee replacement; new confusion the day after hip surgery; no urine since Tuesday with heavy legs after back surgery; a high sugar reading with thirst; a pounding heart at rest. Two look like slips of the finger ("had a slight temperature yesterday but its gone now, 36.8 today"; "feet are cold because of the aircon in the ward lol"). They are kept as he labelled them.
4. Other rule gaps he found, labelled same-day: "thinking of ending it all" in a longer message, a leg that gave way after back surgery, a drain bottle half full of red blood in two hours.
5. Eleven messages the rules class as EMERGENCY he labelled same-day, including six about self-harm or overdose and "walked to the kitchen and back, bit out of breath but proud". Whether a self-harm message gets the emergency text is his decision at sign-off; the rules are unchanged.
6. Limits: one labeller, English only, invented messages. 368 labels in 20 minutes: median 2.4 seconds a message, 103 labels made in under 1.5 seconds, so some slips are likely. No second labeller yet, so no agreement figure between clinicians. The AI check is not in these numbers.

No rule was changed because of these labels (rule: no more wording by hand). The gaps in points 3 and 4 are what the AI check is for; whether it catches them is to be measured from the real-model run file.

## v3.13 (12 Nov 2026): rules plus AI check against the clinician's labels (English)

Scope decided by Dr Tan today: English only for the submission evidence; other languages later. No second labeller. He asked the reviewer to correct labels that are plainly slips of the finger.

Four labels were changed by the AI reviewer, with his permission, all to routine. They are listed so anyone can undo them:
- "feet are cold because of the aircon in the ward lol" (was emergency)
- "had a slight temperature yesterday but its gone now, 36.8 today" (was emergency)
- "the physio was a pain in the neck but helpful" (was same-day)
- "my appointment is at 3pm right?" (was same-day)

Nothing else was changed, including labels the reviewer would have chosen differently. The raw file is kept as exported.

The real-model run of v3.10 (`deepseek-chat`, file `model_run_2026-11-12_deepseek-chat.json` from his PC, analysed by script) covers every message he labelled, so no new run was needed.

| Against the clinician's labels, English, 368 messages | Raw labels | Four slips corrected |
|---|---|---|
| His emergencies that raised an alert, rules alone | 150/157 | 150/155 (97%) |
| His emergencies that raised an alert, rules + AI check | 155/157 | **155/155** |
| His emergencies that got the emergency text | 108/157 | 108/155 (70%) |
| His emergencies flagged by the AI check by itself | 152/157 | 152/155 (3 were "AI unavailable") |
| His same-day messages that raised an alert, rules + AI | 56/101 | 56/99 |
| His routine messages that raised an alert, rules + AI | 0/110 | 0/114 |

What it shows:
1. Every message this clinician called an emergency raised an alert when the AI check was on. The five real gaps in the rules (v3.12 point 3) were all caught by the AI check.
2. 47 of his 155 emergencies got "call the clinic today" instead of the emergency text: 42 where the rules say SAME-DAY, and 5 raised by the AI, which can raise only to SAME-DAY. This is the largest gap between the clinician and the system.
3. The 43 same-day messages with no alert are all questions or mild, stable symptoms ("can I shower?", "is bruising normal?"). In the system these go to the inbox for a named person to answer; they do not page. This is the definition difference of v3.12 point 2, not a miss of an urgent symptom.
4. No routine message was paged, with or without the AI.
5. Limits: one clinician, one pass at about 2 to 3 seconds a message, English only, invented messages, one model, one run, and sets the rules were tuned on. With 155 of 155 the one-sided 95% lower bound is about 98% for this labeller and these messages only; it is not a sensitivity for real patients.

## v4 (12 Nov 2026): the clinician's emergency line, AI severity, AI-unavailable alert, patient profile memory

All four were approved by Dr Tan in chat on 12 Nov 2026 ("go"), after the label results of v3.12 and v3.13. Tests: `node app/eval/v4.test.js` (33 checks, with the stand-in model: it tests the plumbing, not any real model). `app/lib/` and `src/` are untouched.

### 1. The clinician's emergency line (`app/triage.js`, `CLINICIAN_LINE`)
A SAME-DAY result becomes EMERGENCY when its flags show: a fever reading of 38.4 C or more; pus, discharge or a foul smell from the wound; a fall or an injury to the operated joint; a calf or leg flag together with "swollen", "hard" or "bigger"; cannot pass urine. It re-classes results the rules already produce and can only raise. One qualifier was needed for the calf group, because he labelled plain calf pain as same-day.

Measured against his 368 English labels (four slips corrected), rules alone:

| | Before | After |
|---|---|---|
| His emergencies that get the emergency text | 108/155 (70%) | 134/155 (86%) |
| His emergencies that raise any alert | 150/155 | 150/155 |
| His same-day messages that now get the emergency text because of the line | 0 | 8 of 99 |
| His routine messages that raise any alert | 0/114 | 0/114 |

Cost: 8 messages he called same-day now get the emergency text (for example "calf is rock hard and painful", "i havent peed since last night", "there is a bad smell coming from under the bandage"). One of them is a known false alert made worse: "my son fell off his bike yesterday but hes ok, can he still drive me?" now gets the emergency text. Across the AI-labelled sets in all four languages, 64 of 146 same-day messages now get the emergency text. The line was written from English labels; its effect in Malay, Chinese and Arabic follows from the flags and has not been checked by a reader of those languages.
Still same-day although he called them emergencies (16): vomiting that will not settle, bleeding through the dressing, spreading redness, chills without a reading, a blackening blister, uncontrolled pain, numb toes in a tight plaster. Not changed: he approved five groups, not these.

### 2. AI severity (`AI.severity` in `app/ai.js`, used in `app/server.js` step 4)
When the AI second check says "urgent", a second short call asks "emergency or same-day?" with a fixed list that includes the clinician's line. "emergency" sends the fixed emergency text. No usable answer keeps SAME-DAY. It can only raise. Not yet measured with a real model: the next `run-model-eval.bat` run will show how many AI-caught messages become emergencies and how many ordinary ones do.

### 3. AI unavailable (changed from what was first proposed)
The second check is tried twice. If both fail, the message is marked for staff and a staff alert is raised ("AI check unavailable (tried twice): a person must read this message today"). **The patient reply is not changed.** The first proposal was to class the message SAME-DAY; that would have told a patient who wrote "thank you" to call the clinic today whenever the provider is down. The clinician's aim, that a person looks at it, is kept. Known cost: during a provider outage every routine message raises a staff alert (alerts for one patient merge within ten minutes).

### 4. Patient profile memory (`app/memory.js`)
Decisions by Dr Tan: staff confirm each item; staff only; raise only; remember conditions and medicines, worries and goals, home and support, preferences, and details around the operation.
- After each patient message the AI is asked what the patient said about themselves. Its answer is untrusted: an item is kept only if its category is known, it is not worded as an instruction, and its quote is really in the patient's message. Items are stored as "proposed", with the patient's words.
- A doctor or nurse confirms or dismisses each item on the patient page, or adds one by hand. A dismissed item is not proposed again. Every change is in the audit log.
- Confirmed items are used in three places only: shown to staff; added (labelled "not medically verified") to the facts the AI sees when it drafts a reply for staff or writes the staff summary; and a fixed table of three raise-only links (blood thinner + bleeding or bruising; blood thinner + a fall; diabetes + a wound change) that can raise a routine message to SAME-DAY with the reason shown.
- The patient chat never receives the profile, because the chat link is the patient's only identity (tested).
- Limits: the three links are AI-drafted, English only, and await sign-off. "Confirmed" means "we heard this", not "verified". No real model has run the extraction yet; how often it proposes something wrong or misses something is not known. Patient text is sent to the provider for one more call per message.

### Test expectations changed
None in `app/test.js` (117/117) or the held-out sets. New: `app/eval/v4.test.js`.

## v5 (12 Nov 2026): learning, stage 1 (signals, doctor-approved lessons, topic index, system report)

Asked for by Dr Tan: "for the AI to get smarter along the way", without overloading it. His decisions: the AI proposes and a doctor approves; learn from rewritten drafts, triage corrections, dismissed profile items and unanswered questions; no fixed cap on lessons, use an index instead. He also asked that lessons may change everything, lowering urgency included, with the physician alerted. **That part is not built** (see "Stage 2" below). Code: `app/learning.js`, routes in `app/server.js`, the Learning page in `app/public/staff.html`. Tests: `node app/eval/v5.test.js` (24 checks, stand-in model: plumbing only).

What exists:
- **Signals.** Recorded when staff rewrite an AI draft before sending; dismiss a patient fact the AI proposed; a doctor presses "Not urgent" on an alert; a doctor presses "should have alerted?" on a message; a patient question gets no clinic answer.
- **Lessons.** A doctor presses a button and the AI reads up to 25 new signals and proposes at most 5 one-sentence lessons. A proposal is kept only if it names a real signal it is based on, has known topic tags, and contains no dose, no medicine instruction and no "this is normal or safe". A doctor edits, approves or rejects each. A doctor can also write one by hand under the same limits. Earlier wording, who approved and when are kept; all of it is in the audit log.
- **Index.** Each lesson has topic tags (16 topics). For one patient message the AI gets only the approved lessons whose topics match, at most five. Tested with 300 lessons.
- **Where lessons are used.** Two places: the reply draft written for staff to edit, and what the AI proposes for the patient profile. The draft panel shows which lessons were used.
- **System report.** Counts with no AI: messages, alerts, alerts marked not urgent, messages that should have alerted, AI check unavailable, drafts made, sent unchanged and rewritten, profile facts proposed, confirmed and dismissed, unanswered questions by topic.
- His fifth source, "improve the algorithm and the architecture of the app", is the system report: the running AI does not change the software. A person or a developer AI reads the report and changes it, with the tests.

What a lesson cannot do in stage 1: change triage, change any fixed patient text, or reach the patient chat. Marking an alert "not urgent" changes nothing by itself (tested: the same message alerts again). Lessons the AI derives from triage corrections are stored as observations tagged "triage" and are never sent to the AI.

### Stage 2, designed and not built
Lessons that raise or lower triage. Conditions proposed by the reviewer and to be confirmed by Dr Tan: an EMERGENCY from the fixed rules can never be lowered by a lesson; a lowering lesson must pass every held-out set and a real-model run before it goes live; whenever one fires, the message still appears for the doctor marked "lowered by lesson X". Not built because it cannot be measured properly before 20 Nov 2026.

### Limits
No real model has proposed a lesson yet; whether its proposals are useful is unknown. The topic keywords are English only. Lessons are free text given to a model: a lesson can be followed badly or ignored. A doctor could approve a poor lesson; the wording filter stops doses and reassurance, not bad judgement. Signals hold patient message text (masked for phone, IC and email) and are sent to the AI provider when a doctor asks for proposals.

## v6 (12 Nov 2026): dose check for doctors, chief-doctor approval, lesson tracking

Asked for by Dr Tan: "medical alert for doctors, not for patients; must highlight if wrong dose" (he chose both directions), and "only chief doctor or team can approve the changes"; the demo doctor is the chief, more roles to be set up for real use. Tests: `node app/eval/v6.test.js` (16 checks).

### Dose check (`app/doses.js`)
A table of 13 medicines common around orthopaedic surgery, each with an assumed tablet strength, a usual maximum single dose and a usual maximum daily total (adults). The reader finds a medicine name, reads the amount and frequency near it, and reports when the single dose or the daily total is above the table.
- **Patient message.** A finding raises at least a SAME-DAY alert for the doctor with the numbers ("Tramadol: single dose about 150 mg (usual maximum 100 mg)..."). It can only raise. The patient gets the usual fixed text; no dose or medicine is mentioned to the patient (tested).
- **Staff reply.** A reply that mentions a dose above the table is held with a red warning. The sender must press "I have checked, send it"; the audit log records that a warning was shown. AI drafts and built-in draft options are checked too and show the warning before they are used.
- Measured: 11 of 11 written examples above the table flagged; 20 of 20 ordinary sentences not flagged; over the 913 test messages in the repo the only finding is "took 10 tramadol at once". These examples were written by the same AI that wrote the reader, so this is a check that it runs, not a measure of accuracy.

**The table is AI-drafted and has not been checked by a clinician.** It is the highest-risk content added today: a wrong number either hides a real overdose or blocks a correct prescription. It knows nothing about weight, age, kidney or liver function, a deliberate treatment dose (enoxaparin by weight, apixaban 10 mg twice a day in the first week), slow-release forms, or combination tablets. It reads English and a few Malay words. When it cannot read an amount it says nothing, which means "could not tell", not "safe". It only flags doses that are too high, not too low, and not interactions or allergies. Sign-off item: Dr Tan checks every row of `TABLE` against the hospital formulary before any real use.

### Chief doctor
One doctor account carries `chief: true` (the demo `doctor`; an older data file gets its first doctor promoted). Only the chief can ask the AI for lesson proposals, approve, edit, write or retire a lesson. Other doctors and nurses can read the Learning page. "Not urgent" and "should have alerted?" stay open to any doctor: they are observations, not changes. There is no screen yet to add doctors or change who is chief; that is for real deployment.

### Lesson tracking
Each lesson now counts the AI drafts it was used in that were sent unchanged and that were rewritten. A lesson whose drafts are mostly rewritten is marked "may not be working" on the Learning page. Counts only; nothing is retired automatically.

### Not built, proposed for later
The AI tidying the playbook (merging duplicates, flagging contradictions); an expiry or "reconfirm" date on confirmed patient facts; search by meaning instead of topic tags; pages and links between lessons (a wiki). Stage 2 (lessons that change triage) is still not built.

## v7 (12 Nov 2026): patient age and sex; a suggestion when a day is over-booked

Asked for by Dr Tan. Tests: `node app/eval/v7.test.js` (13 checks).

### Age and sex
Stored as age in whole years (not a date of birth) and Female or Male. Asked for when a patient is added; shown on the patient list, the patient page (with an edit link) and the calendar suggestion; included in the facts the AI sees when it drafts for staff. Not sent to the patient side (tested). The 30 demo patients get a fictional age and sex worked out from their record number, also in an older data file. A dose warning adds "patient is N: lower maximums may apply" from age 65. Nothing else uses age or sex yet: the triage rules, the thresholds on readings and the dose table itself do not. A patient added before today shows "age not recorded" in red until someone fills it in.

### Over-booked day
The calendar already flagged a day with more operations than the limit. Now, when such a day is opened, a "Suggested change" card says how many cases to move, lists the patients with the least ready first, and offers the three nearest weekdays that have space. A doctor presses a date to move a case; a nurse sees the list but not the buttons.
- **It is fixed rules, not AI.** Dr Tan asked whether the AI would propose where to reschedule. A rule does this better: the same answer every time, with the reason visible, and nothing to verify. Order: open red flags (3 points each), then overdue pre-operative tasks (1 each), then booked most recently.
- Moving a case shifts its open checklist tasks by the same number of days, adds a task "Tell the patient the new operation date", and writes the move to the audit log. The patient is not messaged automatically. Moving onto a full day or into the past is refused.
- Limits: it does not know theatre lists, surgeon availability, implant orders, bed numbers, public holidays or how urgent each operation is. Weekends are never offered; a unit that operates on Saturday must pick the date by hand on the patient page. "Least ready first" is the reviewer's choice of rule and awaits Dr Tan's agreement. Completed tasks are not moved; a pre-operative blood test done for the old date may be out of date for the new one, and the system does not check that.
