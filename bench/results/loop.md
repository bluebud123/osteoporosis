# Loop scenario results

Passed **26/26**. Each test drives the real app (index.html) headless and checks one guarantee.

| ID | Guarantee | Official requirement | Result |
| --- | --- | --- | --- |
| L01 | Full journey closes only with evidence | Req 1, 5 | PASS |
| L02 | Closure gate refuses a case with incomplete evidence | Req 5 | PASS |
| L03 | Overdue stage is alerted and pinned | Req 2 | PASS |
| L04 | Second missed clock escalates to programme lead | Req 2, 5 | PASS |
| L05 | Unassigned case is pinned and cannot progress until someone owns it | Req 2 | PASS |
| L06 | Rejected referral keeps the GP as owner and offers reroute | Req 2, 4 | PASS |
| L07 | Rejection from the specialist inbox lands back on the GP board | Req 4 | PASS |
| L08 | Wrong teach-back blocks progress until a nurse call | Req 3 | PASS |
| L09 | Declining requires a reason and a signer, and counts as a drop-off | Req 5, 6 | PASS |
| L10 | Every open case has an owner or is pinned as unassigned | Req 2 | PASS |
| L11 | Very-high-risk case shows the 6-week fast-track | Req 5 | PASS |
| L12 | Treatment cannot be signed without a named prescriber | Req 5 | PASS |
| L13 | New patient screened at intake opens a loop with the right category and owner | Req 1, 2 | PASS |
| L14 | Below-threshold patient gets no loop and no false alarm | Req 1 | PASS |
| L15 | High FRAX without DXA opens a loop as "DXA needed", never as low | Req 1, 5 | PASS |
| L16 | Entered DXA result re-runs the category; a missing T-score is refused | Req 5 | PASS |
| L17 | Patient outside the CPG population is flagged at intake | Req 5 | PASS |
| L18 | Reset restores the seeded demo | Demo | PASS |
| L19 | Patient check-in reporting a recent fracture reaches the clinician as urgent, and is pinned until reviewed | Req 3, 6 | PASS |
| L20 | Stopping denosumab is flagged as a rebound risk, in Arabic, shown to the clinician in English | Req 3, 6 | PASS |
| L21 | A seeded patient flag is pinned on the board at start | Req 2, 6 | PASS |
| L22 | "Every dose" check-in can be accepted as the adherence check at follow-up | Req 5 | PASS |
| L23 | Check-in cannot start before the patient has acknowledged the result | Req 3 | PASS |
| L24 | Case finder turns an incidental vertebral fracture in a chest X-ray report into a very-high-risk case | Req 1, 2 | PASS |
| L25 | Trauma and tumour reports are not offered as cases; AI controls are hidden outside claude.ai | Req 1 | PASS |
| L26 | Benchmark table shows the rules' honest stress-set result, and Health shows the proposed indicator | Req 6 | PASS |
