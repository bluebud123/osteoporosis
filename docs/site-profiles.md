# OsteoLoop site profiles

A site profile is the per-hospital configuration that OsteoLoop reads. It says which guideline a site uses, which languages, stage clocks and owner roles apply, what the formulary is, which input routes are on, where report text may go, and the limits. The code in `src/site.js` validates a profile and merges per-site overrides onto a shipped template.

A profile cannot turn off the safety controls. The verifier, human review and the closure gate are locked on. `validate()` rejects any profile that tries otherwise, and `merge()` refuses such overrides.

The shipped profiles are templates. `my-moh` and `uae-doh` name guidelines, not hospitals. No site has adopted them.

## Authoring a new profile

1. Copy a shipped template (`S.getProfile('generic')` is the blank one) into a new object. Set `id`, `name`, `country` and `guideline`.
2. Check it: `S.validate(profile)` returns a list of problems. An empty list means it is valid.
3. For a site that starts from a template with a few changes, use overrides rather than a copy: `S.resolve('my-moh', { stageClocks: { '2': 30 }, feeds: { hl7v2: true, fhir: false, csv: true, paste: true } })`. It returns `{ok, profile, problems}`. Use `profile` only when `ok` is true.
4. Run the benchmark: `npm run bench:ingest`. It checks the schema, the parsers and the finder on the synthetic fixtures. It does not check the site's own data.
5. Get the sign-offs in the checklist below before any profile is used with patient data. Set `guideline.status` to `confirmed` only after the clinical lead signs off, and record who signed and when in `guideline.signOff`.

Example override for a site that has enabled HL7 and supplied its own formulary:

```js
const r = OsteoSite.resolve('my-moh', {
  feeds: { hl7v2: true, fhir: false, csv: true, paste: true },
  formulary: { placeholder: false, available: ['alendronate'], blocked: ['zoledronic-acid'] }
});
if (!r.ok) console.error(r.problems);      // refused: do not use this profile
else useProfile(r.profile);
```

## Field table

| Field | Type and rule | Required | Meaning |
| --- | --- | --- | --- |
| `id` | Lower-case letters, digits and hyphens. 2 to 40 characters. Starts with a letter | Yes | Stable name for the profile |
| `name` | Text, 1 to 120 characters | Yes | Shown to people |
| `description` | Text, up to 500 characters | No | Short note on what the profile is for |
| `country` | Two upper-case letters | Yes | Country code. `XX` is used for the blank template |
| `guideline.primary` | Text, up to 200 characters | Yes | The guideline that drives the rules |
| `guideline.secondary` | Text or null | Yes | A second reference used alongside the primary |
| `guideline.status` | `draft` or `confirmed` | Yes | `confirmed` needs `signOff` |
| `guideline.interim` | true or false | Yes | true when the guideline is a stand-in for the site's own. Then `warning` is required |
| `guideline.warning` | Text or null | Yes | What is not confirmed, in plain words. Required when `interim` is true |
| `guideline.signOff` | Text or null | Only when confirmed | Who signed off the guideline, and when |
| `languages` | List from `en`, `ms`, `ar`. No repeats. At least one | Yes | Languages the site uses |
| `optionalLanguages` | List, each one also in `languages` | No | Languages the site may switch off |
| `stageClocks` | Keys `0` to `6` and `confirmUrgent`. Whole numbers of days, 0 to 365 | Yes | Days allowed per stage. `confirmUrgent` replaces the stage 2 clock for urgent cases |
| `roles` | Keys `0` to `6`. Text, 1 to 80 characters each | Yes | Owner role for each stage |
| `formulary.placeholder` | true or false | Yes | true means the site has not supplied its list yet |
| `formulary.available` | List of drug ids | Yes | Drugs the site stocks. Empty while `placeholder` is true |
| `formulary.blocked` | List of drug ids | Yes | Drugs the site or the guideline blocks. Must not overlap `available` |
| `feeds` | `hl7v2`, `fhir`, `csv`, `paste`: each true or false. At least one true | Yes | Input routes on for the site. `fhir` turns on the FHIR JSON reader for files, not a live connection |
| `dataResidency.mode` | `local-only`, `deidentified-external` or `external-allowed` | Yes | Where report text may go |
| `dataResidency.reader` | `keyword`, `claude-sample` or `openai-compatible` | Yes | Which reader may see report text |
| `indicatorWindowMonths` | Whole number, 1 to 24 | Yes | Window for the proposed indicator (treated within 6 months). Stored only; no code reads it yet |
| `limits.maxInputChars` | Whole number, 1 to 5,000,000. Default 2,000,000 | No | Largest input accepted |
| `limits.maxReportChars` | Whole number, 1 to 200,000. Default 50,000 | No | Longest report accepted. Longer reports are errors, not truncated |
| `limits.maxRows` | Whole number, 1 to 10,000. Default 2,000 | No | Most CSV rows accepted |
| `controls` | `verifier`, `humanReview`, `closureGate`: each must be `true` | Yes | Safety controls. Cannot be turned off |

Unknown fields are rejected, so a typo such as `skipVerifier` is caught. Keys named `__proto__`, `constructor` or `prototype` are rejected anywhere in the profile.

Residency rule that `validate()` enforces: `local-only` allows only the `keyword` reader. `claude-sample` sends text to an external model. `openai-compatible` is not always external (an endpoint inside the site is possible), but `validate()` cannot tell which, so it is treated as external. Choosing a non-local mode is the site's decision, and it needs the data-protection approval in the checklist.

## The shipped examples side by side

| Field | `my-moh` | `uae-doh` | `generic` |
| --- | --- | --- | --- |
| Name | Malaysian MOH hospital (template) | Abu Dhabi hospital, DoH context (template) | Generic template (no site) |
| Country | MY | AE | XX |
| `guideline.primary` | Malaysian CPG: Postmenopausal Osteoporosis (2022) | Malaysian CPG: Postmenopausal Osteoporosis (2022), INTERIM stand-in | None selected |
| `guideline.secondary` | NICE NG259 (2026), DXA indications | NICE NG259 (2026), DXA indications | null |
| `guideline.status` | draft | draft | draft |
| `guideline.interim` | false | true | true |
| `guideline.warning` | null | "INTERIM: no UAE or regional osteoporosis guideline is confirmed for this profile. The Malaysian CPG is used only as a stand-in. The clinical lead must confirm or replace the guideline and sign it off before any patient use." | "No guideline is selected for this profile. Do not use for patient care until the clinical lead selects and signs off a guideline." |
| `languages` | en, ms, ar | ar, en | en |
| `optionalLanguages` | ar | none | none |
| `stageClocks` | Repo defaults: 0 / 7 / 30 / 7 / 14 / 90 / 30 days; confirmUrgent 42 | Same | Same |
| `roles` | Repo defaults (see below) | Same | Same |
| `formulary` | Placeholder, no drugs listed | Placeholder, no drugs listed | Placeholder, no drugs listed |
| `feeds` | csv and paste on; hl7v2 and fhir off | Same | Same |
| `dataResidency` | local-only, keyword | local-only, keyword | local-only, keyword |
| `indicatorWindowMonths` | 6 | 6 | 6 |
| `limits` | Defaults | Defaults | Defaults |
| `controls` | All true, locked | All true, locked | All true, locked |

Repo defaults for stages (from the app's `STAGES`): 0 Screen, Screening clinic, 0 days. 1 Notify and acknowledge, GP, 7 days. 2 Confirm: DXA and labs, GP, imaging, lab, 30 days (42 days for urgent cases). 3 Decide or refer, GP then specialist, 7 days. 4 Treat, Prescriber, 14 days. 5 Follow up, GP, 90 days. 6 Close, GP or programme lead, 30 days.

The two shipped examples differ in name and country, in the guideline text, in the interim flag and warning, and in languages (`my-moh` has en, ms and ar with ar optional; `uae-doh` has ar and en, Arabic first). Everything else is the same default, which is deliberate: a site must choose its own values rather than inherit a template's.

Two points to settle before any site uses these defaults:
- The app gives urgent cases a 42-day confirm clock, which is longer than the standard 30 days. An urgent case would normally get less time, not more. This is kept as the repo has it and flagged for the clinical lead to confirm.
- The `uae-doh` profile uses the Malaysian CPG as an interim stand-in. The Abu Dhabi or other UAE regional guideline must be identified and confirmed by the clinical lead. Until then, the profile says so on screen and in its warning field.

## Checklist for adopting a profile at a new site

Clinical sign-off
- [ ] A named clinical lead has reviewed the profile and written their name and date in `guideline.signOff`.
- [ ] Stage clocks and owner roles are confirmed for this site's pathway. The `confirmUrgent` direction is confirmed.
- [ ] The finder's act and review decisions have been checked on this site's own de-identified reports, by a clinician. The fixtures are not enough.
- [ ] The safety controls remain on (`validate()` passes; no override was used to change them).

Guideline choice
- [ ] The primary guideline is named exactly, with year and version.
- [ ] If the site uses its own or a regional guideline, `interim` is set to false and the primary guideline names it. Otherwise `interim` stays true and the warning stays.
- [ ] `guideline.status` is `confirmed` only after the sign-off above.

Language review
- [ ] A native speaker has reviewed every language the site enables, both on screen and in the check-in questions. The Arabic in the repo uses the feminine form because the CPG population is postmenopausal women; the reviewer should confirm that choice for this site.
- [ ] `optionalLanguages` reflects what the site actually needs.

Data protection approval
- [ ] The data-residency mode and reader are chosen and written down. `local-only` with the keyword reader is the default.
- [ ] If an external reader is chosen, the site has checked what text leaves the site, has a rule for de-identification, and has a data-processing agreement with the provider.
- [ ] A data-protection impact assessment, consent or legal basis, and institutional approval for the feed are on file.
- [ ] Retention and deletion rules for the imported report text are set. Nothing in the repo is a retention rule.

Formulary and feeds
- [ ] The site pharmacy has supplied `formulary.available` and the clinical lead has set `formulary.blocked`. `placeholder` is false only after both.
- [ ] Only the feeds the site has tested are on. `hl7v2` and `fhir` stay off until the site's own de-identified samples have been read correctly.
- [ ] The HL7 character set (MSH-18) and the FHIR charset are confirmed with the feed owner.

Limits
- [ ] `limits` have been set for the site's report lengths and volumes. Anything over a limit is refused and must be read by a person.

Before go-live
- [ ] `npm run bench:ingest` passes on the repo fixtures.
- [ ] The site's de-identified samples have been run through the same checks, from outside the repo, and the results are kept at the site.
- [ ] Someone at the site owns the profile and reviews it at least yearly, and after any guideline change.
