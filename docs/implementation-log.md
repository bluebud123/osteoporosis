# Implementation of the Opus round 1 fix list

Work copy: `/home/claude/work/merged_s1` (remote `origin` removed, nothing pushed). Synthetic data only. No key anywhere.
Raw output of the final run: `s1_evidence/final_run.txt`. Tour check runs: `s1_evidence/tour_check_run{1..4}.txt` (run1 and run2 were failing runs during the work; run3 and run4 are 1532 PASS, 0 FAIL on the final build). Screenshots and repro scripts: `s1_evidence/`.

## Final results (verbatim)
```
test.js: 30/30 cases pass (exit 0)
adapter 18/0, arabic_content 80/0, arabic_engine 538/0, chat_ratelimit 5/0, contradictions 17/0, guard2 121/0, intake 258/0,
interview 43/0, judge_r1 (new) 107/0, knowledge 18/0, negation 42/0, otdate 80/0, polish7 22/0, polish8 233/0, proxy_e2e 19/0,
regress1 22/0, regress2 494/0, regress3 181/0, review1b 22/0, round3 239/0, second_check 26/0   (all exit=0)
s1.check (new, browser)  24 PASS, 0 FAIL
status.check             79 PASS, 0 FAIL
polish.check             53 PASS, 0 FAIL
tour.check               1532 PASS, 0 FAIL  (twice on the final build: run3 and run4; all viewports incl. 640x360, 640x400, 600x360, 598x360)
```

## Items
- **P0-1 done.** Settings block reordered (Mode, Proxy URL + status, Test connection, mode note, Provider preset). `reveal()` parameter renamed `targets`, always scrolls a too-tall group to its top, so the "taller than the free space" note can show. Tour step 5 targets now also include the Test connection button; still 0 FAIL at every viewport.
- **P0-2 done.** `redUnknownNow()` in `src.html`: on "Unknown" to a red-flag question there is a fixed bot line at once (symptoms_now uses the judge's text; other red questions use a generic "you were not sure about: X, if now or worse call the clinic or go to ED"), one clinician task `red_unknown_<qid>` due now (the end-of-interview to-do has the same key, so no duplicate after Send to Staff board), an amber note in `#iv-red`; interview continues, no alert, not RED. ms/zh/ar lines are labelled machine drafts. Verified in `s1.check.js` and `s1_evidence/idk.js` output.
  Caveat: the summary's to-do text still says "preop nurse, due within 8 hours" (pinned by polish8, 13 checks), while the Staff board task made earlier is clinician, due now. I left the summary wording alone.
- **P0-3 done (engine additive).** New SAME-DAY rules (bleeding through or from the dressing/wound; chills, rigors, shivering; a fall or a hit to the head) in en, ms, zh, ar (ar via arPos, reviewed:false), all through the negation machinery. `T.ROUTE` carries the safety-net sentence in en, ms, zh, ar. 107 checks in `mod/judge_r1.test.js` including "no chills", "not bleeding through the dressing", "I did not fall", "I fell asleep", "I tripped on the rug but I did not hit my head and I am fine" (existing control, which forced me to drop bare "tripped/slipped"), "my temperature fell to 37". Overview numbers not touched and not re-measured; README and a code comment say the rules were added after the first-pass measurement. Judge said `regress*`/`guard2` pin ROUTE text: none actually did, so no expectation needed changing.
  Not lowered: EMERGENCY and SAME-DAY unchanged; 30/30 frozen cases and all suites green.
- **P1-1 done.** In the AI-mode interview branch, ROUTE with flags exactly `['no approved answer']` and ACK are recorded answers (as in scripted mode); `{mode:'intake'}` passed to the classifier. Real clinical questions still create a staff task. Repro (`s1_evidence/ai_noproxy_out.txt`): the medicine list no longer says "passed your question" and makes no `patient_q` task. One `second_check_unscreened` tag task remains when the proxy is down, on purpose (it says the answer was not screened).
- **P1-2 done.** `labelChat` labels only the first bot bubble; checked in `s1.check.js` (exactly one label, on the same-day reply, not on the next question).
- **P1-3 done, partly.** Masking now covers `(012) 345-6789`, `012/345/6789`, `012_345_6789`, `900101/14/5678`, spaced en/em dashes, five or more digit pairs (`12 34 56 78 90`), and eight or more digits spelled as words (en, ms, Chinese numerals). `DATE_SHAPE` accepts `/` and spaced dashes. Unchanged: Hb 9.8, 38.5, 12/11/2026, RN 12345678, 5/10, 120/80. **Not done: ten single spaced digits starting with 1 (`1 2 3 4 5 6 7 8 9 0`)**; `polish8` pins "spaced single digits starting with 1 (a list) are not masked", so I kept that spec.
- **P1-4 done.** Badge has a third state "AI second check: set, not tested" (neutral, icon ◐; en/ms/zh/ar, Arabic reviewed:false) until the first successful check or Test connection; then green "on"; failure stays amber. Also P2-8: "Rules only (no AI)". `status.check.js` expectations updated (spec honestly changed).
- **P1-5 done.** Step 5 text asks for Test connection, expects "Not connected" and the badge going to "unavailable, rules only", then Scripted; ticks on a non-empty `#pl-test-out`. Tour snapshots Mode and Proxy URL when it opens and restores them on close/finish (a visitor who started in AI keeps AI). Step 6 intro says Settings are back on Scripted, or a note if Mode is still AI. `tour.check.js` changed: step 5 now presses Test connection, and the one refused-localhost console line it causes is not counted as an error (stated in a comment).
- **P1-6 done.** Anchored ACK pattern for thanks / thank you / noted / got it / done / ok will do / terima kasih / 谢谢 / 好的 / emoji / شكرا (shared Arabic ACK existed). "thanks but my calf is swollen" is still SAME-DAY. ms/zh get localised ACK text.
- **P1-7 done.** Mode note, `scMsg` (34 of 63, "not a validated safety layer") and the phone line ("fixed pre-written text (draft, awaiting clinician sign-off)") reworded. README gets a matching note. **Not checked:** `/home/claude/periloop/docs_draft/claims.md` (B62, V19) is outside the work copy; the lead should mirror the wording there. No old strings exist in `docs/` or the README of this copy.
- **P1-8 done.** Tour title "Try it yourself: 7 steps, about 3 minutes". Overview card is "Watch the story" with a secondary button "Watch instead: 2-minute auto story"; "Start here" is the only primary button above the fold (checked).
- **P1-9 done.** Judge's CSS adopted in `extra.zmerge.css`: header 163 px at 390 and 430 (was 222), all header buttons >= 44 px. `status.check.js` now holds the phone header to <= 171 px (the old baseline, no +30 slack).
- **P2 done:** 4 (SAME-DAY text no longer promises "will contact you": engine, second_check, adapter; ms/zh/ar too), 2 (7 KPI tiles on one row at >= 1000 px), 3 (10/11/11.5 px text raised to 12 px), 7 (default provider preset is `local`), 8. **Not done:** 1 (RTL procedure select), 5 (phone vs Ask box FAQ store), 6 (Ask box internal tag), 9 (event log developer-speak).

## Unverified / notes
- I looked at 390x700 and 1280x800 screenshots of the first screen, tour step 5 and the intake/idk result; I did not re-inspect every tab or dark mode.
- ms, zh and ar strings added are machine drafts, not reviewed. The Arabic regexes were tested on a dozen phrases only.
- "what causes chills" (a question) now routes SAME-DAY: safe side, accepted.
- `status.check.js` "baseline" detail now prints the HEAD build (222), only informational; the assertion is the fixed 171.

---
# Round 2 (Opus r2 verdict: READY AFTER FIXES, small)

All raw output: `s1_evidence/r2_unit.txt`, `r2_tour.txt`, `r2_status.txt`, `r2_polish.txt`, `r2_s1.txt`, `r2_blind.txt`; screenshots `s2_step5_390.png`, `s2_step5_1280.png` (looked at both).

- **A done.** `sameDay1(t, ctx)`: in intake mode only head-strike findings count; a history fall is not same-day in any mode unless a recent cue is present (today, yesterday, this week, since the operation; en/ms/zh/ar). Tests build the FOOTANKLE interview at `fa_falls` in en/ms/zh/ar: answer `yes`, no red, not paused. "I fell yesterday and hit my head" in intake is still SAME-DAY; chat "I fell and hit my head" and "I fell yesterday" unchanged.
- **B done.** zh bleed rule excludes 没/不/无/未 before 出血/流血 and now covers 有血渗出/血渗出; Arabic negation gap list gained يكن/تكن/اكن/كان/كانت (fixes "لم يكن عندي حمى", a round-1 gap) and the Arabic fall verb needs a whole word ("لم اسقط" quiet). Also tested: tidak berdarah, tak jatuh, 没有发冷, 伤口不出血.
- **C done.** Fear of falling (zh 怕/害怕/担心/会不会…), "fell in love/behind/for/apart", jatuh cinta, Arabic وقعت في الحب / سقطت الأسعار / وقع العقد, "chills down my spine", "gave me chills", "chills of excitement", "shivering from the aircon" are quiet. "I have chills", "chills and sweats tonight", "I fell down the stairs" still SAME-DAY.
- **D done.** Summary to-do for an Unknown red answer is now owner clinician, due now (`urgent`); 13 polish8 expectations changed deliberately (comment cites round 2).
- **E done.** `#pl-test-out` is a step-5 target and the tick writes "Result: ... Badge: ..." into the step status. tour.check gained two checks per viewport (result fully visible, status repeats it); `#pl-test-out` is skipped in the pre-action checks because it is empty then.
- **Single spaced digits:** ten to twelve single digits in a row are masked whatever the first digit (`1 2 3 4 5 6 7 8 9 0`). `1 2 3 4 5`, `BP 120 80`, a 1-to-10 pain scale and `took 1 2 3 tablets` stay unmasked, shown in polish8, whose pin I changed for that reason.
- **Docs:** "a second check is needed in production" replaced by "an option under test, not a validated safety layer" in docs/claims.md (B62, V19), solution-brief, video-script, and the matching files in /home/claude/periloop/docs_draft (claims, brief, video_script, README); README/DEPLOY name the renamed story button. No numbers or claims raised.

## Results (verbatim)
```
test.js 30/30; all 21 mod suites exit 0 (judge_r1 now 164 PASS; polish8 238 PASS)
tour.check 1575 PASS, 0 FAIL (all viewports incl. 640x360, 600x360, 598x360)
status.check 79/0, polish.check 53/0, s1.check 24/0
```
Blind sets, judge-r2 engine vs final engine (`r2_blind.txt`):
```
unseen4 (en/ms/zh)  urgent caught 45/75 -> 46/75, false alarms 9/75 -> 8/75
unseen5_ar          urgent caught 28/60 -> 28/60, false alarms 6/60 -> 6/60
```
Changes: U4-034 now caught (the phrase the judge named, so this gain is tuned, not independent); U4-115 false alarm gone (also named). These sets were used for tuning earlier, so they are not a clean estimate.

Not done: round-2 P2 items 10-15 (unscreened-task noise, ms ACK reply language, dark proxy input, ROUTE wording, head injury with amnesia as EMERGENCY, RTL select labels etc.).
