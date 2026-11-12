# Handoff: finishing PeriLoop Console for submission

Written 12 Nov 2026 by the previous Claude session for the next one. Owner: Dr Tan Shun Herng.
This is a plan, not an order. If you find a step is wrong or a better route exists, change it and write one line in `docs/decision-log.md` saying what you changed and why.

## Dates

- 15 Nov: Dr Tan flies to Sweden. Anything that needs his PC, his colleague or his clinic should be done before then.
- 20 Nov: final submission (Future Health Digital Innovation Challenge, Abu Dhabi; finals at GITEX Dubai).
- Registration: the event page said 10 Nov, the press release 15 Nov. Ask him on day one whether he has confirmed he is registered. If he is not, nothing else matters.

## Where things are

- Repo `bluebud123/osteoporosis`, branch `periloop-v3-review-fixes`. Work only on this branch.
- Read first, in this order: `docs/clinician-todo.md`, `docs/decision-log.md` (v3 to v3.7), `docs/solution-brief.md`, `docs/video-script.md`, `docs/DEPLOY.md`.
- His PC: `D:\AIS_AI_EXPORT\abu dhabi 2026\osteoporosis`, Windows, PowerShell. `start-periloop.bat` starts the Console on port 8090 with DeepSeek on. `run-model-eval.bat` runs the real-model evaluation. Neither .bat has been confirmed working by him yet; ask.
- The browser inside the Claude desktop app can open `http://localhost:8090` on his PC when the session is linked. The Chrome extension did not connect.
- DeepSeek is not reachable from the cloud workspace. Anything with the real model runs on his PC.

## Rules he set (keep them unless he says otherwise)

1. Do not add red-flag wording by hand. Three rounds showed it does not converge.
2. Do not edit `app/lib/` or `src/`.
3. After any change all three must pass: `node app/test.js`, `node app/eval/holdout.test.js`, and every `src/mod/*.test.js`.
4. Synthetic data only. Never commit an API key. `deepseek-key.txt` is git-ignored.
5. Measure, do not assume. Say what you verified and what you did not.
6. He pasted a DeepSeek key into the earlier chat. Check that he deleted it and made a new one.
7. He wants short, direct answers. He is a clinician, not a developer: give exact commands or a .bat, one step at a time.

## State on handoff

Everything is pushed. Nothing is waiting locally. Last code commit before this note: `d59321f` on `periloop-v3-review-fixes` (12 Nov, 10:45 Malaysia time). All three test commands passed on it.

Pushed today, in order: `run-model-eval.bat`; the chat prompt fix in `app/ai.js` with decision log v3.7; this handoff.

Dr Tan's PC is one step behind: he has not yet pulled the chat prompt fix. He must close the server window, run `git pull`, and start `start-periloop.bat` again before job 1.

Note for a cloud session: a fresh clone tracks only the branches it was cloned with. If `git status` shows no upstream for this branch, run `git config --add remote.origin.fetch '+refs/heads/periloop-v3-review-fixes:refs/remotes/origin/periloop-v3-review-fixes' && git fetch origin && git branch -u origin/periloop-v3-review-fixes`. Without it a push check can report unpushed commits that are already on GitHub.

Done and pushed: v3 rules and tools, both launchers, a live browser smoke test with DeepSeek (decision log v3.7).

Open, in order:

| # | Job | Who | Notes |
|---|---|---|---|
| 1 | Re-test the chat prompt fix with the real model | you + his PC | He must `git pull` and restart. Send "is it normal to hear clicking in the knee?" and "do you remember my medical illness?" in the Live view. The reply must stay on the question. If it still wanders, fix it in `app/ai.js` or fall back to the fixed receipt |
| 2 | Real-model evaluation | him, 40 min unattended | `run-model-eval.bat`, option 1 then option 2. Put the "All sets together" table and the missed-emergency list into `docs/solution-brief.md` and `README.md`. Note: the script maps procedures with keys LUM, SHO, FOOT while the server uses LUMBAR, SHOULDER, FOOTANKLE, so those library messages run as TKR. Check whether that matters before quoting numbers |
| 3 | Blind labels | him + one colleague, before 15 Nov | `/eval/label`, 150 messages each, then `node app/eval/score_labels.js A.json B.json`. Write up sensitivity and kappa with the limits stated |
| 4 | Clinical sign-off | him | Steps 4 to 6 of `docs/clinician-todo.md`. Includes the two items found in the live test: "yellow fluid and it stinks" is flagged as heavy bleeding, and the "what should I bring" answer is the admission list even for physio |
| 5 | Hosting | you + him | `docs/DEPLOY.md` is generic. Pick a host with him, deploy, then run the browser checks on the hosted link. Set a spending limit on the AI key. Change the demo passwords if the link is public |
| 6 | Submission video | you + him | See below |
| 7 | Final read of the brief | you | Check every claim in `docs/solution-brief.md` against `docs/claims.md` and the evidence. The requirement list in section 3 was written from memory; check it against the real challenge page |
| 8 | Submit | him | He submits. Do not submit, register or accept terms for him |

If time runs short, 1, 2, 3, 6 and 8 are the minimum.

## The video and voice

He asked for free tools, for example an ElevenLabs connector, for the video and the voice-over. Nothing here has been checked; verify before promising him anything.

- First read the challenge rules for the video: length, format, language, and whether an AI voice is allowed or must be disclosed.
- Simplest route that needs no new tool: he records his own screen and voice following `docs/video-script.md` (Windows: Win+Alt+R, or OBS). A clinician's own voice is more convincing to a health panel than a synthetic one. Offer this first.
- If he wants an AI voice: check the connector registry for a text-to-speech connector. ElevenLabs is the one he named. Check the free plan's limits and licence terms (attribution, commercial use) on their site before using it. Read the script aloud into the tool only; no patient data.
- Screen footage: record the hosted demo, or generate it with Playwright video recording against the stand-in model in the workspace, then cut with ffmpeg. Use the video-making skill if it is available.
- Use real screens of the working Console only. No mock-ups presented as the product, no invented results, no invented testimonials.
- Show the honest limits on screen: synthetic data, AI-drafted rules awaiting sign-off, numbers from invented messages.

## What not to claim in the submission

- That any clinician has validated the rules, thresholds or texts (unless step 4 is done, then say exactly what was reviewed).
- That a pilot or Ministry of Health permission exists.
- Any accuracy figure without saying the messages were invented and who labelled them.
- That Arabic is reviewed, unless a native speaker has read it.


## Update, 12 Nov 2026 (later session)

Done since the handoff above: jobs 1, 2 and 3 (one labeller, English only; a second labeller and other languages are dropped for now by Dr Tan's decision). See decision log v3.8 to v4.
Built in v4 on his "go": the clinician's emergency line, an AI severity step, a retry and staff alert when the AI is unavailable, and the patient profile memory.
Still open: a real-model run of v4 (`run-model-eval.bat`, option 3) to measure the severity step; a live try of the profile memory with the real model; job 4 sign-off (now also the three raise-only links in `app/memory.js`, and the 16 emergencies still classed same-day); jobs 5 to 8.
The DeepSeek key pasted in an earlier chat has NOT been rotated yet; he said he will do it when the work is finished.

v5 (same day): learning stage 1 is built (Learning page: signals, AI-proposed lessons a doctor approves, topic index, system report). Stage 2 (lessons that change triage) is designed in decision log v5 and NOT built; do not build it before the submission. Not yet tried with the real model.
