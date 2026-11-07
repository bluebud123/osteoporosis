# Patient check-in

The check-in is what the patient fills in on a phone or waiting-room tablet while waiting to see the doctor. It takes about 3 minutes. The clinician gets a one-page summary before the consultation. Code: `src/checkin.js` (questions, flags, summary), `index.html` (wizard, card, summary). Tests: `bench/run-checkin.js` and the check-in scenarios in `bench/run-loop.js` (L19, L20, L22, L23 and L40 to L44).

Status: draft for clinical review. Every new flag is tagged LOCAL until the clinical lead signs it off. Arabic and Malay are translations drafted by the author and need native clinical review before any patient sees them.

## Who gets which check-in

- **First set**: before the first clinic visit, no treatment yet. Asks about fractures, falls, risk factors and FRAX inputs, then the visit section.
- **Review set**: once a medicine has been prescribed. Asks about adherence, side effects, jaw and thigh symptoms, falls and fractures since the last visit, dental plans, and calcium and vitamin D, then the visit section.
- Both sets end with the question for the doctor.

## What is asked

### Fracture and risk set (first set only)

| Item | Why it matters to the clinician |
| --- | --- |
| Fracture since age 50 after a minor fall, with site and date | A fragility fracture in the last 12 months is a very high risk criterion (MYCPG). Date and site decide the urgency and whether DXA is needed. |
| Falls in the last 12 months | Two or more falls is a very high risk criterion. Falls drive fracture risk as well as bone density. |
| Parent who broke a hip, rheumatoid arthritis, smoking, alcohol 3 or more a day, steroid tablets for 3 months or more | FRAX inputs. The clinician enters them into the FRAX calculator (the CPG has no Malaysian model). |
| Height and weight (optional) | FRAX input and BMI. BMI under 19 is recorded as a FRAX factor. |
| Height loss or stooping | Possible vertebral fracture; vertebral fracture assessment may be needed. |

### Fracture and treatment set (review set)

| Item | Why it matters to the clinician |
| --- | --- |
| Bone medicine taken in the last month (every dose, missed doses, stopped, not started) and the reasons | Adherence is the main reason treatment fails. Stopping denosumab causes rebound fracture risk, so it is flagged separately. |
| Jaw pain, swelling or loose tooth; new thigh or groin pain | Osteonecrosis of the jaw and atypical femoral fracture are known effects of bone treatment. Both are checked for the drug class. |
| Heartburn or painful swallowing | Known side effect of oral bisphosphonates; prompts a check of how the tablet is taken. |
| Fracture or fall since the last visit | New fracture on treatment is a very high risk criterion; a fall needs a falls assessment. |
| Dental extraction or surgery planned | Bone treatment affects timing of dental surgery. The dentist needs to know. |
| Calcium and vitamin D | Part of the treatment plan in the CPG. |

### Visit section (both sets, before the question for the doctor)

| Item | Type | Why it matters to the clinician |
| --- | --- | --- |
| Main problem, in the patient's own words | Free text, required, up to 1,000 characters | The reason for the visit, shown verbatim. Never parsed for risk. |
| Where the pain is | Single choice: neck, upper back, lower back, hip, knee, shoulder, wrist or hand, ankle or foot, other | Site decides whether a spinal or hip red flag applies. |
| How long | Days, weeks, months, years | Acute or chronic; relevant to fracture age and to red flag timing. |
| Pain now, 0 to 10 | Scale | Baseline for the pain plan. 8 or more is flagged for review. |
| Worst pain this week, 0 to 10 | Scale | Pain pattern; a single value can miss flares. |
| Pain wakes the patient at night | Yes or no | Night pain with weight loss is a malignancy red flag. |
| Walking and climbing stairs | Yes, with difficulty, no | Function and falls risk. |
| Red flags (choose all that apply, or none) | Multi-choice, see the flag table | Urgent symptoms that need same-day or urgent review. |
| Current medicines and supplements | Free text, required, or none | Drug interactions, anticoagulants, steroids and calcium. Shown verbatim. |
| Allergies | Free text, required, or none | Safety before any prescription. Shown verbatim. |
| What worries the patient, or what they want from today | Free text, optional | Shared decisions. Shown verbatim. |

The question for the doctor (existing, optional, free text) comes last. It is shown in the summary under worries and questions.

## Flag table

Flags come from `flags(visit, answers, ctx)` in `src/checkin.js`. Levels: **Urgent** (crit), **Review** (warn), **Note** (info). Same-day flags are the four marked Same day; the patient is then told to seek care today, not to wait for a call.

### Visit red flags (new)

| Flag | Level | Trigger | Text shown to the clinician | Source | Basis |
| --- | --- | --- | --- | --- | --- |
| V-CES | Urgent, same day | Bladder or bowel change, or numbness around groin or buttocks | Possible cauda equina syndrome. Same-day medical review | LOCAL | NICE NG59 (low back pain and sciatica): cauda equina red flags |
| V-LEG | Urgent, same day | New leg weakness or numbness | Same-day neurological check for nerve compression | LOCAL | Assumption: treated as urgent. Needs sign-off |
| V-FEVER | Urgent, same day | Fever or chills with back or neck pain | Possible spinal infection. Same-day medical review | LOCAL | Red flag for spinal infection. Neck is counted as spine |
| V-FEVERW | Review | Fever or chills, with no spine site | Check for a source of infection | LOCAL | Common red flag list |
| V-MAL | Urgent | Unexplained weight loss with night pain | Urgent review for malignancy or myeloma | LOCAL | NICE NG12 (suspected cancer); myeloma is in scope per the clinical brief |
| V-WL | Review | Unexplained weight loss, without night pain | Unexplained weight loss reported: review | LOCAL | NICE NG12 |
| V-FALL | Urgent, same day | Fall or injury today with hip or back (spine) pain | Same-day assessment for fracture | LOCAL | Fall with hip or spinal pain: fracture until proven otherwise |
| V-INJ | Review | Fall or injury today, other site | Check for fracture | LOCAL | Common practice |
| V-PAIN | Review | Pain 8 or more out of 10 now | Review pain control | LOCAL | Severity threshold; not from a guideline |
| V-NIGHT | Note | Pain wakes at night | Pain wakes at night | LOCAL | Night pain noted; see V-MAL |
| V-WALK | Review (cannot walk) or Note (with difficulty) | Walking or stairs | Mobility and falls review | LOCAL | Function and falls |

### Existing flags (unchanged)

| Flag | Level | Trigger | Source |
| --- | --- | --- | --- |
| P-FX12 | Urgent | Fracture in the last 12 months | MYCPG |
| P-FX | Review | Older fragility fracture | NICE |
| P-FALLS | Review | Two or more falls | MYCPG |
| P-GC | Review | Long-term steroid tablets | FRAX |
| P-FRAX | Note | FRAX risk factors reported | FRAX |
| P-HT | Note | Height loss or stooping | LOCAL |
| P-NEWFX | Urgent | New fracture on treatment | MYCPG |
| P-ONJ | Urgent | Jaw symptoms on bone treatment | LOCAL |
| P-AFF | Urgent | Thigh or groin pain on bone treatment | LOCAL |
| P-DENO | Urgent | Stopped denosumab (rebound) | LOCAL |
| P-STOP, P-MISS | Review | Stopped or missed doses | LOCAL |
| P-GI | Review | Heartburn on oral bisphosphonate | LOCAL |
| P-RFALL | Review | Fall since last visit | MYCPG |
| P-DENT | Note | Dental surgery planned on bone treatment | LOCAL |
| P-CAD | Note | Not taking calcium and vitamin D | MYCPG |
| P-ASK | Note | Question for the doctor (quoted) | PATIENT |

## What is deliberately not done

- **No diagnosis from free text.** The main problem, medicines, allergies and worries are shown verbatim. They are never searched for keywords such as "fracture", "fever" or "cauda equina". A test (K62) checks that a complaint which mentions these words raises no flag when no red-flag box is ticked.
- **Patient answers never change the risk category.** The category comes from the rules engine and a clinician confirms it. Red flags raise a flag for the clinician; they do not change the category.
- **No AI.** The summary is built from the answers and the flag table. No model reads or scores the text.
- **No scoring of pain or function beyond the flags.** There is no validated score (for example Oswestry or Roland-Morris) in this version. These would need a licence and clinical choice.
- **Text is capped, not interpreted.** Free text is trimmed, stripped of control characters and cut at 1,000 characters. The summary says when a text was cut. Scales outside 0 to 10 and options that do not exist are dropped.
- **Script and HTML are escaped on screen.** Patient text is never rendered as markup (test L43).
- **Voice dictation is not included.**
- **No body map.** Site is a single-choice list, as asked.

## Safety behaviour

- Same-day red flags make the patient's screen say to go to the emergency department or call the clinic now (`urgentNow`). Other urgent flags say the care team will contact the patient within 2 working days.
- The clinician summary lists red flags first, urgent before review before note.
- Every item in the summary is marked patient-reported.
- The case audit log records each check-in and its flag count. The FHIR export carries the answers as QuestionnaireResponse items, with flags as extensions.

## Languages

- English is the reference wording.
- Arabic uses gender-neutral forms: plural forms for direct address (for example اختاروا، أجيبوا، اكتبوا), first person in answer options (توقفتُ، نسيتُ، فهمتُ) and impersonal or passive constructions. The wording avoids singular second-person forms of either gender. `bench/run-checkin.js` (checks A01 to A03) scans for common feminine and masculine singular forms.
- Malay uses "anda", which is gender-neutral.
- The patient's language is chosen on the phone: English, العربية, Bahasa Melayu. The case-intake form still offers English and Arabic only (see Open items).

## Tests

- `bench/run-checkin.js`: 56 answer sets (K01 to K34 as before, plus K40 to K68 for the visit section: each red flag alone, no red flags, pain 10 with night pain, empty free text, a 5,000-character complaint, and HTML and script text) and 27 checks on normalisation, the summary, wording and languages. Current result: 83 of 83.
- `bench/run-loop.js`: the wizard flow in English, Arabic and Malay, the red-flag message, escaping on the card and the 1,000-character cap.

## Open items for sign-off

1. The red-flag list and levels in the flag table, in particular V-LEG (treated as urgent) and V-FEVER (neck counted as spine), and the 2-working-day timeframe for non-same-day urgent flags.
2. The pain threshold of 8 for V-PAIN, which is not from a guideline.
3. Basis references: NICE NG59 and NG12 are cited from memory and must be checked against the current versions.
4. Arabic and Malay wording: native clinical review.
5. The overlap between the visit section's worries question and the existing question for the doctor. They may be merged to save time.
6. The case-intake form still offers English and Arabic only.
