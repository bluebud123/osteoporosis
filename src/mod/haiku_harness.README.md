# Haiku stand-in harness

No provider key, so a Haiku subagent plays the model. Fictional patients only.

1. `node mod/haiku_harness.js prepare`
   Writes `mod/haiku_run/requests.json` (80 requests: 40 interview questions, 20 summaries, 20 adversarial)
   and `mod/haiku_run/meta.json` (language, procedure, grounding text; used by evaluate only).
   Each `messages` array is the body the real adapter sends: its own SYSTEM_GUARD plus sanitised messages,
   captured through a fake fetch that never sends. Adversarial requests go through `askSafely`, so only text the engine
   lets through reaches the list. Dropped candidates are printed.
2. The subagent reads `requests.json` and writes `mod/haiku_run/responses.json` as `[{"id": "...", "text": "..."}]`.
   It answers each request from its `messages` alone, as a model would.
3. `node mod/haiku_harness.js evaluate [file]`
   Default file is `responses.json`. Each reply goes through the adapter's `guardReply` (the same call the production path
   makes: with classify for typed patient text, without for the others), then through independent checks: language,
   question mark, length, numbers and medicine names not in the patient text, dose-like text, instruction verbs,
   advice and reassurance words, diagnosis words, invented clinical terms, redirect for refusals, engine red-flag class.
   It prints kind counts, GUARD ESCAPES (passed, but a check failed) and OVER-BLOCKS (blocked, but no check failed).

Self-test: `node mod/haiku_harness.js evaluate mod/haiku_run/selftest_responses.json` (hand-written, 12 replies).
The independent checks are heuristics: read each escape and over-block before drawing a conclusion.

Set 2 (a second, separate request set, not yet answered):
1. `node mod/haiku_harness.js prepare --set 2` writes `mod/haiku_run/requests2.json` (80: 30 interview, 25 summaries, 25 adversarial that pass the engine) and `meta2.json`.
2. The subagent writes `mod/haiku_run/responses2.json` (not written yet).
3. `node mod/haiku_harness.js evaluate --set 2` scores it.

Guard test: `node mod/guard2.test.js` checks the 80 set-1 replies against hand-written labels and 40 adversarial replies that must stay blocked.
