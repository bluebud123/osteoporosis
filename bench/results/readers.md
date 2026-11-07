# Reader adapter, verifier and de-identification tests

_unit checks 48/48. Run with npm run bench:readers._

  PASS keyword adapter gives the same decision as F.find on all 115 existing reports
  PASS keyword adapter output has decision, site, evidence array and reason string
  PASS openai-compatible: constructing the adapter makes no network call
  PASS openai-compatible: localhost is inferred local, a hosted endpoint is not
  PASS claude-sample: absent capability is reported unavailable, not thrown
  PASS claude-sample: absent capability returns status unavailable and no decision
  PASS valid quoted act is accepted as act
  PASS invented evidence is downgraded to review
  PASS act quoting a non-fracture sentence is downgraded to review
  PASS invalid decision string is downgraded to review
  PASS reader error (no answer) is downgraded to review, status error
  PASS reader "no" on a report the keyword baseline calls act is floored to review
  PASS with floor disabled, reader "no" stands (for measurement only)
  PASS reader "no" on a report with no fracture is not floored
  PASS the same invented output is downgraded identically by claude-sample, openai-compatible and mock
  PASS claude-sample: a valid quoted act through the injected sample is accepted
  PASS claude-sample: a thrown error becomes review with status error
  PASS openai-compatible: posts to baseURL + /chat/completions with the bearer key
  PASS hosted (non-local) reader never receives the clinician name
  PASS hosted reader result is parsed from fenced JSON and verified against the de-identified text
  PASS local model (localhost) receives the text unchanged
  PASS HTTP 500 becomes review with status error
  PASS deid: names after a title are removed, the rest kept
  PASS deid: a name after Prof
  PASS deid: a name after a Patient: cue
  PASS deid: an all-caps name after PATIENT:
  PASS deid: a clinical word after a title is kept (name stops at it)
  PASS deid: Arabic name after د. (two tokens)
  PASS deid: Arabic name with a connector, and the clinical word after it is kept
  PASS deid: dates: numeric, dd-Mon-yyyy, d Month yyyy, Mon d, yyyy
  PASS deid: international and local phone numbers
  PASS deid: Emirates ID 784-YYYY-NNNNNNN-N
  PASS deid: labelled MRN
  PASS deid: a long digit run (accession number)
  PASS deid: e-mail address
  PASS deid: Arabic-Indic digits in a phone number
  PASS deid: clinical text with level labels and percentages is unchanged
  PASS deid: Arabic fracture sentence with a level label is unchanged
  PASS deid: OVER-REDACTION (documented): Arabic name takes the next Arabic word
  PASS deid: KNOWN LIMIT: a name without a title or cue is not removed
  PASS deid: KNOWN LIMIT: a street address is not removed
  PASS deid: KNOWN LIMIT: a quasi-identifier (occupation, age, place) is not removed
  PASS deid: KNOWN LIMIT: an Arabic name without a title is not removed
  PASS deid is idempotent
  PASS deidentifyDetailed reports what it removed
  PASS deid never removes the word fracture from a report
  PASS Arabic and bilingual reports (15): keyword adapter agrees with F.score on exact count
  PASS Real-format reports (12): keyword adapter agrees with F.score on exact count
