# Red team: patient check-in (three personas)

Scope: the Patient tab of the OsteoLoop prototype, run against a copy of the repo (not edited). Findings only; no code changed.

## Method and limits

- Copy served on a local port; headless Chromium through Playwright with phone emulation (390 x 844, 2x, touch) and the locales ms-MY, ar-SA and en-GB.
- Personas were run on the existing demo cases so the phone shows a real check-in:
  - Puan Siti (Malay, alendronate, irregular doses, stomach upset): case C-1018 (Salma R.), treatment review set.
  - Mr Khalid (Arabic, night back pain, saddle numbness, cannot pass urine; typed by his daughter): case C-1031 (Aisha K.), first set. Two runs: B ticks the two danger symptoms; B2 types the same symptoms into the complaint box and ticks "None of these".
  - Mrs Lee (English, anxious, retired nurse, long complaint, asks about data and AI): case C-1031, first set.
- Screenshots are in `/tmp/claude-0/-home-claude/878d5375-5a24-5066-a900-29ad03b3c0e6/scratchpad/shots/` (A01 to A10, B01 to B08, C01 to C07, R01 and R02, X01 to X03). Scripts are in the same scratchpad folder.
- Limits: the sandbox could not reach Google Fonts, so fallback fonts were used and typography is approximate. No real Android device and no screen reader were used, so accessibility points come from the DOM and computed styles. Malay and Arabic judgements are mine and are marked "uncertain" where I am not sure; both still need the native clinical review the docs already require.

## Summary

The question logic is sound: the flags for the clinician are correct, the summary is clear, and Khalid's danger symptoms do produce an urgent flag on the clinician board. The problem is what the patient experiences. On a real phone the page renders at desktop width, so text is about 2.5 times smaller than designed. A patient who ticks a danger symptom gets no warning at that point and is told to go to the emergency department only after 21 screens and a Send press. If the same symptoms are typed into the free-text box and "None of these" is ticked, the patient gets a reassuring message and a routine next step, and no urgent flag is raised. The patient view also sits inside the clinician app, with a patient picker and the clinician summary on the same screen, and there is no privacy or consent text anywhere on it.

Severity: BLOCKER means a patient could be harmed or cannot use the flow at all. MAJOR means a patient is likely to misread, lose work, or be misled. MINOR is polish or wording that needs native review.

## Cross-cutting findings (all personas)

**X-1 BLOCKER. The page has no viewport meta tag, so phones render it at 980 CSS pixels.**
Evidence: `index.html` has no `<meta name="viewport">`. With phone emulation, `documentElement.scrollWidth` is 980 against a 390 viewport, and the phone wizard is drawn at desktop size and scaled down (A02, A04, B06, C04). Labels are 15 px in CSS, which is about 6 px on screen. The media query at 600 px never fires. Adding a control meta tag at runtime makes the layout 390 px wide and readable (X02, X03). The live GitHub Pages copy is probably affected in the same way; I did not check it.
Fix: add `<meta name="viewport" content="width=device-width, initial-scale=1">` to the head of `index.html`.

**X-2 BLOCKER. The patient view is the clinician app.**
Evidence: the Patient tab shows the clinician tab bar (Find, Board, Case, Specialist, Health), a "Demo: view the phone of" picker that lists all eight patients by name and ID (R, "picker lists"), and the clinician summary with all answers and a Print button directly under the phone (A02, B08). Anyone holding a waiting-room tablet on this page can see other patients' names and the clinician summary. Nothing separates the patient's screen from the clinician's.
Fix: serve the patient check-in from its own page, reached by a per-patient link or code, with no tabs, no picker, no summary and no print. The clinician summary stays on the clinician side only.

**X-3 BLOCKER. Reload or closing the page loses all answers, and the next load shows a different patient.**
Evidence: the wizard state is a module variable (`let wiz`, line 552). Reloading at question 4 of 21 (R, "mid-way") returns to the Board tab. The patient picker then defaults to Mariam A. (C-1042), whose phone shows a teach-back question about her next step (R02). The answers are gone with no warning.
Fix: keep the draft per case in `sessionStorage` (wrapped in try and catch, as the design rules require), resume at the same question after reload, and make the patient page open on its own patient, not on a default.

**X-4 MAJOR. No privacy, consent or AI statement anywhere on the patient side.**
Evidence: the patient strings (`PT` in `index.html`) and the check-in text (`src/checkin.js`) contain no notice. The only text is "Your answers go to your care team" and "Your care team will see your answers before your visit", and "care team" is never defined. Nothing says who reads the answers, how long they are kept, whether an AI reads them, or how to ask to see or delete them. The docs say no AI is used, but the patient is not told. Mrs Lee's three questions get no answer on screen (C, "landing" and "review" screens).
Fix: a one-screen notice before the first question, in English, Malay and Arabic: who reads the answers (named role, for example "the doctors and nurses at this clinic"), "no computer program scores or reads what you write", how long they are kept, and how to ask for a copy or deletion. The clinical lead and the clinic's data protection officer must approve the wording. Malaysia's PDPA 2010 notice principle is the likely basis; confirm with the DPO. Every statement must be true of the build.

**X-5 MAJOR. The browser or Android Back button leaves the app and the answers are lost.**
Evidence: the wizard never calls `history.pushState`. Pressing Back at question 3 goes to the previous page (R, "URL after browser Back" was `about:blank` in this test). In-app Back buttons exist on each screen (`data-wgo`) but the device button does not use them.
Fix: push a history entry for each question and handle `popstate` by going to the previous question. Pair this with X-3.

**X-6 MAJOR. Keyboard and screen-reader users lose their place after every answer; no language or live region is set.**
Evidence: after pressing Enter on an answer, `document.activeElement` is `BODY` (R, "focus after keyboard Enter"), because each answer re-renders the screen. `<html>` has no `lang` attribute (checked on all runs). Nothing has `aria-live` or `role="alert"`, so the urgent message after Send is not announced (grep found no live region in the file).
Fix: set `lang` on `<html>` and update it when the language changes. Move focus to the question heading after each render. Give the urgent block `role="alert"` and the question heading `tabindex="-1"`.

**X-7 MAJOR. Cancel throws away every answer with no confirmation, and it sits next to Next.**
Evidence: after two answers, Cancel (`ci-cancel`, line 844) returned to the landing screen and the next start was "1 of 21" (C, "after Cancel" and "restart after Cancel"). On the text screens "Next", "Back" and "Cancel" sit in one row (C04).
Fix: ask "Stop and lose your answers?" before discarding, or change Cancel to "Save and finish later" and keep the draft from X-3. Separate Cancel from the primary action with more space.

**X-8 MAJOR. "Change" on the review screen sends the patient back through every later screen.**
Evidence: from the review list, changing the first answer shows that question, and after one tap the wizard goes to the next question, not back to review (A08: "2 of 18"). The patient must tap through all remaining questions again (about 17 screens for Siti and 19 for Mrs Lee). Mrs Lee changed one answer and went through the whole set again (C, "after changing fracture to No").
Fix: keep a `returnToReview` flag. After an answer given from review, go back to the review screen.

**X-9 MAJOR. The patient sees a day number, and in Arabic it reads "today 0".**
Evidence: "Last sent: day -2" (English, A01 and landing), "hari -2" (Malay, A01), and "آخر إرسال: اليوم 0" (Arabic, B08), which says "last sent: today 0" to a patient who may have sent it days ago. The text is built as the label plus the raw day number (`PT.ar.ciLast`, `T.ciLast + last.d`, line 625).
Fix: show the date (for example "Last sent: 7 Nov 2026" in the locale's format). Drop the day counter from patient screens.

**X-10 MAJOR. The text box silently cuts the answer at 1,000 characters, and the patient is not told.**
Evidence: Mrs Lee typed 1,150 characters. The box stopped at 1,000 (`maxlength`), and the last words were "I stopped my hormone t". There is no counter and no message (C04 and C, "textarea after typing"). The clinician summary notes "(cut at 1,000 characters)" (C, summary), so the clinician sees the cut but the patient does not. The lost sentence was about stopping hormone tablets, which matters to the clinician.
Fix: show "n / 1,000" from 800 characters and a clear message at the limit ("Your answer is too long. Shorten it to 1,000 characters or less."). Do not cut silently. The clinician summary note can stay.

**X-11 MINOR. Several Arabic and Malay strings need native review.**
- The Arabic start button "ابدأوا تسجيل الحضور" can be read as "register your attendance" (uncertain).
- "هل يوجد تدخين حاليًا؟" (Is there smoking now?) is awkward; "هل تدخنون حاليًا؟" is the natural form (uncertain).
- "هل يُعتاد تناول 3 مشروبات كحولية أو أكثر في اليوم؟" is hard to follow; a plainer form is "هل تشربون عادةً 3 مشروبات أو أكثر في اليوم؟" (uncertain).
- "هل لوحظ نقص في الطول، أو زيادة في الانحناء إلى الأمام؟" is passive and vague; "هل لاحظتم أنكم أصبحتم أقصر، أو أنكم انحنيتم أكثر إلى الأمام؟" reads better (uncertain).
- Units are in Latin letters inside Arabic labels ("الطول (cm)").
- Malay "Pilihan" as a placeholder can mean "option" to a patient; "Pilihan (tidak wajib)" is clearer.

**X-12 MINOR. Small controls.**
Evidence: language pills are 28 px tall with 12.5 px text; "Next" and "Cancel" are 38 px tall; the scale buttons are 42 to 45 px (measure.js). Contrast passes (muted text 6.17:1 on white; selected button 6.85:1). The options are 46 px tall and work.
Fix: 44 px minimum for pills, Next and Cancel.

## Persona A: Puan Siti (Malay, low health literacy, irregular alendronate)

What she tried: the Malay landing (A01), the review check-in on C-1018. She answered "I missed some doses", reasons "Side effects" and "Hard to take it the right way", heartburn, no falls, calcium "Sometimes", typed her complaint and her medicine, and then changed an answer from review (A02 to A10). For the run, she finally chose "Every dose" to check the sent summary.

What happened: the flow works in Malay. Each question is on its own screen, the counter reads "2 daripada 19", and the options are readable once the viewport fault is fixed. The clinician summary correctly lists her heartburn as a review flag and her missed doses (A10).

**A-1 MAJOR. "None of these" does not clear the other red flags.**
Evidence: she tapped "Demam atau menggigil" (fever) and then "Tiada daripada ini" (none). Both stayed pressed (A REDF line: fever=true, none=true). The code treats "none" as index -1 for every multi-choice question except symptoms (line 817: `q.id==='sym'?3:-1`), so the red-flag question's none option (index 6) is never exclusive. The clinician summary would then show "Fever ...; None of these", which contradicts itself, and a patient who ticks "None" by mistake keeps her other ticks.
Fix: use the none index the data already has: `const none = q.none !== undefined ? q.none : -1;`. Add a check to `bench/run-checkin.js` for red-flag "none" with another flag selected.

**A-2 MAJOR. The question asks about "bone medicine" without naming her drug.**
Evidence: the first review question reads "In the last month, how have you taken your bone medicine?" (A02). The case record has alendronate (`rx: obp`), but the screen does not say it. A patient who is not sure which tablet is the "bone medicine", or who gets a weekly tablet and a daily calcium confused, has no help.
Fix: name the medicine from the record and how it is taken ("Alendronate, one tablet a week"), and show the photo or pack name if the clinic has one.

**A-3 MAJOR. The status line says "Keep taking your medicine" whatever she answers, and gives no advice about the stomach upset.**
Evidence: after sending, the status card reads "Teruskan mengambil ubat anda" (keep taking your medicine) (A10). The text is chosen by the case stage (`T.next[ci]`, line 622), not by her answers, so the same line appears after "I missed some doses" or "I stopped". I confirmed it on the run where she answered "Every dose"; the stage-based code means the other answers show the same line (not run). Nothing tells her how to take alendronate to reduce the stomach upset, and nothing tells her to call the clinic before stopping.
Fix: choose the status line from the answers. After "missed", "stopped" or heartburn, say "Please tell your nurse before you change your tablets. Do not stop on your own." Add a short, clinician-approved card on how to take the tablet (first thing in the morning, a full glass of plain water, sit upright for 30 minutes). Needs clinical sign-off.

**A-4 MINOR. A tap moves to the next question at once, with no sign that the answer counted.**
Evidence: single-choice questions advance on tap (line 816). A mis-tap cannot be seen before it is locked in; the only way back is "Kembali" (Back) on the next screen, and on the review list "Tukar" walks forward (X-8).
Fix: after a single-choice tap, show the choice for about half a second, or add a "Next" button for single-choice items as well.

**A-5 MINOR. Wording a low-literacy patient may misread.**
- "steroid tablets (for example prednisolone)" (English) and "ubat steroid" (Malay) can be heard as anabolic steroids. Write "prednisolone (a steroid tablet, sometimes called a "cortisone" or "steroid" tablet)" and test with patients (Malay wording uncertain).
- "Bone medicine" and "bone density scan" are not explained anywhere.
- The pain scale is numbers and two words. A simple face scale is a common alternative for low literacy (suggestion, not a defect).
- The teach-back on the landing screen ("Quick check: what is your next step?") gives a nurse call for a wrong answer, which can read as a failed test. Reword the wrong-answer message to "Let us explain it again. A nurse will call you." (uncertain on tone).

**A-6 Accessibility for her phone.** At the as-served width she cannot read the text without zooming and then loses the layout (X-1). With the meta tag (control run) the layout works: options are 46 px tall, scale buttons 42 px, and the Malay strings fit.

Would she abandon? Yes, likely at the first screen, because the text is too small to read. If she got through, she would tap "Every dose" or "I missed some doses" by reflex and would not notice the next screen says to keep taking the medicine.

## Persona B: Mr Khalid (Arabic, night pain, saddle numbness, cannot pass urine; daughter typing)

What he tried: run B ticked "Trouble passing urine" and "Numbness around the groin, buttocks or inner thighs" and then went through the rest of the check-in, sent it, and read the final screen (B01 to B08). Run B2 typed the same symptoms in the complaint and ticked "None of these" (B2 runs).

**B-1 BLOCKER. Ticking a danger symptom does not stop the check-in. The urgent instruction appears only after 21 screens and a Send press.**
Evidence: after the red-flag screen (B06), the app shows nothing special and asks the next questions. Sending it (B08) produces the same-day callout "Some of your answers need medical attention today. Go to the emergency department now, or call your clinic now. Do not wait for a call." Nothing is sent to the clinician until Send. If he closes the page, taps Cancel (X-7) or the device Back button (X-5), no flag reaches the clinic. The clinician board does show the urgent flag after Send ("Patient flag · Bladder or bowel change, or numbness around the groin or buttocks", under NEEDS ACTION), so the clinical path works if he finishes.
Fix: the moment a same-day flag is ticked (bladder or bowel, saddle numbness, new leg weakness, fever with back pain, a fall with hip or back pain), show a full-screen stop before the next question: "Based on your answers, go to the emergency department now, or call 999 for an ambulance. Show this screen. [Button: I am going now] [Button: Send my answers now]." Send the answers so far to the clinic at the same time. Clinical sign-off is needed for the exact text and the list of triggers.

**B-2 BLOCKER. Danger symptoms typed into the complaint box, with "None of these" ticked, raise no flag and produce a reassuring message.**
Evidence: B2 typed "ألم في أسفل الظهر يوقظني في الليل، وفي مؤخرتي خدر، ولا أستطيع التبول منذ يومين" (back pain waking me, numbness in my buttocks, cannot pass urine for two days) and ticked "لا شيء من ذلك" (none of these). The result: no urgent flag, the summary reads "Reported: None of these" directly above the same symptoms, and the patient sees "Sent. Your care team will see your answers before your visit" and "Your next step: have your bone density scan and blood tests" (B2 AFTER SEND). The design choice not to parse free text is deliberate (docs/checkin.md), but nothing on screen catches the gap.
Fix (no parsing needed): (a) put a fixed line above the complaint box: "If you have numbness around the buttocks or groin, trouble passing urine, new leg weakness or fever with back pain, go to the emergency department now. Do not wait to finish this form." (b) On the review screen, ask: "Did you tick every symptom that applies, including anything you wrote above? [Yes] [No, go back]". Both are static text, not a diagnosis from the words.

**B-3 MAJOR. After an urgent send, the routine "next step" card sits under the urgent message.**
Evidence: B08 shows the red urgent box and then, in the same phone frame, "Your next step: bone density scan and blood tests" (top card), which is the stage text, not the answers. The two messages contradict each other.
Fix: when a same-day flag is set, hide the routine next-step card and show only the urgent block.

**B-4 MAJOR. "Call your clinic now" has no number, and there is no 999 advice.**
Evidence: the urgent text (PT `urgentNow`, Arabic: "توجهوا إلى قسم الطوارئ الآن، أو اتصلوا بعيادتكم الآن") gives no phone number, and the page has no `tel:` link (grep found none). The text does not say why, and there is no 999 (Malaysia's emergency number) and no note to ask someone to drive him.
Fix: show the clinic's phone number as a tappable link and the national emergency number (999 in Malaysia), with one line on why ("These symptoms can need urgent treatment"). Add "Do not drive yourself" if clinically approved.

**B-5 MAJOR. The Arabic pain scale runs the wrong way.**
Evidence: the numbers 0 to 10 run left to right, but the end labels are right to left, so "لا ألم" (no pain) sits under 10 on the right and "أسوأ ألم ممكن" (worst possible) sits under 0 on the left (B05). Khalid would read 8 or 9 as "no pain" from the label, and pain could be recorded in the wrong direction.
Fix: put the scale and its labels in one `dir="ltr"` container with the labels ordered to match the numbers, or give both labels a fixed side regardless of language (`scale-ends` line 592 uses `dir=${rtl}`).

**B-6 MINOR. The Arabic red-flag list is long and has no plain explanation.**
Evidence: "خدر حول الأعضاء التناسلية أو الإليتين أو الفخذين من الداخل" (numbness around the genitals, buttocks or inner thighs) is accurate but a 74-year-old may not know which area "inner thighs" covers, or whether "numbness" means loss of feeling or pins and needles. The question has no "I am not sure" option, so an unsure answer must be a tick or nothing.
Fix: add a short example under each item, and "I am not sure" as an option that counts as a Note, not as none.

**B-7 MINOR. Nothing records that a family member answered.**
Evidence: the daughter typed everything. The summary calls the answers "patient-reported", which is not what happened. There is no question "Who is answering?" and no statement "A family member is helping me".
Fix: add "Who is filling this in? [Me] [Someone helping me]" on the first screen and show it in the summary.

**B-8 MINOR. The docs contradict each other on Arabic gender.**
Evidence: docs/checkin.md and the comments in `src/checkin.js` say the Arabic is gender-neutral (plural forms). The README and CLAUDE.md say the Arabic "is written in the feminine form". The strings I read are plural, so the code matches docs/checkin.md and the README and CLAUDE.md are out of date. Clarify before the native review, because the native reviewer needs to know which form is intended.

**B-9 MINOR (Arabic wording, uncertain).** "هل سبق أن كُسر ورك لدى الأم أو الأب؟" (was a hip broken in the mother or father) is grammatically fine but reads as a question about the parents' bones. "هل تعرضتم لكسر في عظمة بعد سقوط بسيط أو اصطدام؟" would be clearer for the first item. Native review.

Would Mr Khalid abandon? His daughter might. A daughter who reads the red-flag list would probably tick the danger items and send it. If she reads "Next step: bone density scan" after typing the symptoms, she is likely to think the situation is routine. The B2 result is the most likely real-world failure.

## Persona C: Mrs Lee (English, anxious, retired nurse, long complaint, asks about data and AI)

What she tried: Cancel after two answers, restart, "Not sure" on the fracture questions, a long complaint of about 1,150 characters, height and weight (BMI 18.4), a worry field used for her questions, Change from review, and send (C01 to C07).

**C-1 MAJOR. Her complaint is cut at 1,000 characters without a word.** (X-10.) Evidence: C04 and the textarea value of 1,000 characters ending "I stopped my hormone t". The clinician summary notes the cut; the patient sees nothing.

**C-2 MAJOR. "Not sure" stops the story.**
Evidence: she answered "Not sure" to a fracture, to steroid tablets, to her mother's hip and to her height loss. Each one was accepted with no follow-up and no sign of what happens next. The flags code only fires on "Yes" (value 0), so "Not sure" gives no flag and no action; the clinician summary shows "Not sure" in grey with no prompt to check at the visit (C, summary).
Fix: treat "Not sure" on these items as a Note: "Unknown, check at the visit". Tell the patient: "Your doctor will check this with you. You do not need to know the answer now."

**C-3 MAJOR. Her three questions have no answer, and her question about AI went into the worries box.**
Evidence: she typed "Who can see my answers? Does an AI read them? What happens if I answer 'not sure'?" into the "What worries you" box (C05). Nothing on the patient side answers any of them (X-4). The clinician summary shows it under "Worries or wants from today", so the clinician may not treat it as a question to answer.
Fix: the notice in X-4 answers the first two. Add a line after "Not sure" items ("We will check this with you at the visit") and a question-for-the-doctor reminder on the review screen: "Anything you want the doctor to answer? Write it in the question box below."

**C-4 MINOR. The two free-text questions overlap.** "What worries you most or what would you like from today?" and "Is there anything you want to ask your doctor?" both invite questions. The docs already list merging them as open item 5. Merge them, or label the first "Worries" and the second "Questions".

**C-5 MINOR. Save and continue later does not exist, and the 21 screens take a while.** For an anxious patient who is typing a long story at home, a single 21-screen run with no save is a risk of abandonment. Count the time on a real phone before the "3 minutes" text is used.

**C-6 MINOR. Textarea.** It is 84 px tall with no counter, so a long story scrolls inside a small box (C04). Show the characters left (X-10) and grow the box with the text.

Would Mrs Lee abandon? Probably at the consent question, which is missing, or at Cancel, if she taps it by mistake. A nurse would also notice that the "Not sure" answers are treated as nothing.

## What a patient cannot do

- Skip a required item: the complaint, the medicines and the allergy question need text or "None", which is reasonable, but the labels do not say why.
- Say "I don't know" on most questions. Only the fracture, parent, steroid, RA and shrink items have "Not sure". Smoking, alcohol, night pain, walking, dental, calcium, the red flags and the medicine question have no "not sure" option.
- Ask for a human or reach the clinic: no phone link, no message button, no clinic number on the patient screen (B-4).
- Dictate: there is no voice input; this is by design (docs), but a patient with weak sight or typing will struggle with the text boxes.
- Make text larger in the app: nothing in the page controls size, so the phone's own zoom is the only option, and it is blocked by the lack of a viewport tag (X-1).
- Save and come back later, or see a list of what they have sent (X-3, C-5).
- Tell the clinic who is answering (B-7).
- Go back from the first review item without starting again, or go back from the review list to the same question without walking forward (X-8).
- Use the device Back button (X-5).

## What works well

- One question per screen, a progress count, Next disabled until the question is answered, and a Back button on each screen.
- Malay and Arabic are complete for every patient-facing string, including the urgent messages, and the language pills switch the screen on tap.
- With the viewport fixed (control run), the Arabic layout is right-to-left and reads well, and the options are large enough to tap.
- Contrast passes on the muted text and the selected states.
- The question wording in English is plain: "Since age 50, have you broken a bone after a minor fall or bump?" and "Can you walk and climb stairs as usual?" are good.
- Red flags are checked the right way on the clinician side. Khalid's answers raise an urgent cauda equina flag, the summary lists red flags first and shows the patient's text verbatim, and the board pins the case under NEEDS ACTION.
- Patient text is escaped on the clinician side and shown verbatim, and the summary says when text is cut.
- No JavaScript errors in any run (the only console error was the Google Fonts request failing in this sandbox).

## Five fixes that matter most

1. Make the patient check-in its own mobile page: add the viewport meta tag and `lang`, and remove the tabs, the picker and the clinician summary from the patient's view (X-1, X-2, X-6). Each patient reaches it by a personal link or code.
2. Stop at the red flag: when a same-day flag is ticked, show a full-screen instruction to go to the emergency department or call 999 with the clinic's number, send what is answered so far, and hide the routine next-step card. Add a static reminder above the complaint box and a "Did you tick everything?" check on the review screen (B-1, B-2, B-3, B-4). The exact text and trigger list need clinical sign-off.
3. Keep the work: store the draft in `sessionStorage` so a reload resumes, use history entries so Back goes to the previous question, confirm before Cancel, and return to review after a change from review (X-3, X-5, X-7, X-8).
4. Tell the patient what happens to their answers and handle "Not sure" properly: a notice before the first question in three languages, a visible counter with no silent cut at 1,000 characters, "Not sure" recorded as a visible unknown for the visit, and the medicine named on the screen (X-4, X-10, C-2, A-2). Approval by the clinical lead and the DPO.
5. Fix the logic and wording bugs: make "None of these" exclusive by using the question's own none index (A-1), replace the day counter with a date (X-9), set the Arabic pain scale labels to match the numbers (B-5), and drive the status line from the answers rather than the stage (A-3). Add the focus and alert fixes from X-6 at the same time.

Items that need clinical sign-off before any patient sees them: the same-day trigger list and wording (B-1), the emergency wording with the phone number (B-4), the tablet-taking advice for alendronate (A-3), the "Not sure" handling (C-2), and every Arabic and Malay string flagged above.
