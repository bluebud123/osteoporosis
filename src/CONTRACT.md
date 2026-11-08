# Build contract (all modules: plain JS, UMD like engine.js, NO network calls at import, NO real patient data, fictional only)
Pattern: `(function(root){ ... if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.PL_<NAME>=api; })(this)`
Engine (read-only, do NOT edit): /home/claude/periloop/engine.js exports { Sim, classify, PACKS, SHARED, THRESH, CFG, FAQ }. classify(text) -> {cls, flags, lang, reply, botAnswered}.
Procedures: TKR THR ACL LUMBAR SHOULDER FOOTANKLE. Languages: en, ms, zh.
Each agent writes ONLY its own files under /home/claude/periloop/mod/ and a short note file. Do not touch other files. Each module needs a node test script (mod/<name>.test.js) that runs and prints PASS/FAIL counts. Run it and report honest results. Never claim clinical validity.

## Shared data shapes
Answers (output of interview): { pid, procedure, lang, answers: { <qid>: <value> }, freeText: string[] }
Summary (output of intake.summarise): { pid, procedure, banner: {level:'RED'|'AMBER'|'NONE', reasons:string[]}, sections:[{title, lines:string[]}], label:'Patient-reported, clinician to verify', gaps:string[] }
Todo item (output of intake.todos): { key, title, owner, dueDays (relative to surgery, negative=before), kind, reason (which answer triggered), needsClinician:true|false }
Owners allowed: surgeon, anaesthetist, preop_nurse, ward_nurse, physio, pharmacy, clinic_coordinator, clinician
