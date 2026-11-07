# Loop scenario results

Passed **12/12**. Each test drives the real app (index.html) headless and checks one guarantee.

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
