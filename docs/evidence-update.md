# OsteoLoop: evidence update

Date: 2026-11-07. Prepared for the Future Health Digital Innovation Challenge 2026 entry. Companion to [submission-pack.md](submission-pack.md).

**Convention.** "Opened: Y" means the page was fetched and read in this session. "Opened: N" means the claim comes from a search snippet or was not checked. Items marked ESTIMATE are calculations, never sourced facts. Where a page could not be opened, that is stated.

---

## Task 1: Market sizing (Abu Dhabi and UAE)

### 1a. Source figures

| Item | Value (verbatim or exact) | Source URL | Opened |
| --- | --- | --- | --- |
| Abu Dhabi total population, 2024 | 4,135,985 (rounded 4.14 million), released 30 June 2025 | https://scad.gov.ae/w/abu-dhabi-population-in-2024-grows-7-5-to-reach-4-14m | Y |
| Abu Dhabi median age, 2024 census | "33 years" ("The results indicate that the median age of the population in the emirate is 33 years", release 11 Jun 2024) | https://scad.gov.ae/w/statistics-centre-abu-dhabi-reports-results-of-abu-dhabi-census-2023 | Y |
| Abu Dhabi age 15 to 64 share | About 84% | https://scad.gov.ae/w/abu-dhabi-population-in-2024-grows-7-5-to-reach-4-14m | Y |
| Abu Dhabi population aged 50+ (count or share) | **Not found.** SCAD pages opened give no 50+, 60+ or 65+ figures; the age-band tables sit on census.scad.gov.ae and were not reachable as text | https://census.scad.gov.ae/home/population | Y (no figure) |
| UAE population aged 50+ share (2010, 2020, 2050) | 8.4% (2010), 13.0% (2020), 27.3% (2050, World Bank projections). Table 1A, p. 8. Country-level, 2011 audit | https://www.osteoporosis.foundation/sites/iofbonehealth/files/2019-06/2011_Middle_East_Africa_Audit_English.pdf | Y (via redirect from iofbonehealth.org) |
| UAE hip fractures, 2010 | "About 700 hip fractures in 2010, projected to reach about 1,200 by 2020." The table gives no source or method. p. 7 | same IOF PDF | Y |
| Hip fracture incidence, Saudi Arabia (crude, 45+, 2017 to 2018) | Women 77.5 per 100,000 per year; men 56.8 per 100,000. 684 low-energy hip fractures over 2 years at 15 hospitals | https://pmc.ncbi.nlm.nih.gov/articles/PMC8976798 (Saleh et al., Arch Osteoporos 2022;17:56, doi 10.1007/s11657-022-01085-x) | Y |
| Hip fracture lifetime probability at age 50, Abu Dhabi | Women 8.9%, men 8.1% (Table 3). Text says Abu Dhabi rates are "rather comparable" to Saudi Arabia and Kuwait; Abu Dhabi annual counts are only in Figure 1, which could not be read | same Saleh PMC page | Y |
| Post-fracture osteoporosis treatment rate, UAE or GCC | **Not found** in any opened page | n/a | n/a |
| Saudi national hip fractures, over 50, 2015 (for reference) | 2,949 (Saleh et al.) | same Saleh PMC page | Y |

Note on the IOF audit. It was published in 2011 and is the only UAE-specific fracture-count source opened. Its population-share data is a World Bank projection. Its UAE section (pp. 63 to 64) was cut off in the tool output.

### 1b. ESTIMATE: untreated fragility fractures per year, Abu Dhabi emirate

This is a back-of-envelope estimate. It is **not** a sourced fact and should not be presented as one.

**Assumptions**

| Symbol | Assumption | Low | Central | High | Basis |
| --- | --- | --- | --- | --- | --- |
| P | Emirate population | 4,135,985 | 4,135,985 | 4,135,985 | SCAD 2024 (sourced) |
| s | Share aged 50+ | 8% | 10% | 13% | **ESTIMATE.** 13% is the IOF/World Bank 2020 UAE projection. 8% and 10% are lower values chosen by hand. Abu Dhabi is younger than the UAE average (median 33), so the lower values are plausible. No Abu Dhabi figure was found |
| r | Hip fracture incidence per 100,000 per year (applied to the 50+ population) | 56.8 | 67.2 | 77.5 | Saudi crude rates for 45+ (Saleh 2022), men and women, central = mean. **Assumption:** Saudi rates transfer to Abu Dhabi; the 45+ denominator overstates the 50+ rate, so this is an upper-bound proxy |
| m | Ratio of all recognised fragility fractures to hip fractures | 1 (hip only, lower bound) | 2 | 2 | **ESTIMATE.** No source found. Covers vertebral and other fragility fractures in a simple way |
| u | Share of fragility fractures with no recorded treatment | 70% | 75% | 80% | INTERCEPT protocol: "70-80% of patients are inadequately investigated or treated" (Wang et al., BMC Primary Care 2024, not opened in this session). Also Hsu et al. 2026: 43.1% treatment initiation after hip fixation, which implies about 57% untreated, a lower bound since outside-hospital treatment was not captured. Opened: N for both |

**Arithmetic**

1. 50+ population = P × s
2. Hip fractures per year = (50+ population) × r ÷ 100,000
3. All fragility fractures per year = hip fractures × m
4. Untreated per year = all fragility fractures × u

| Step | Low | Central | High |
| --- | --- | --- | --- |
| 50+ population (4,135,985 × s) | 330,879 | 413,598 | 537,678 |
| Hip fractures per year | 188 | 278 | 417 |
| All fragility fractures per year (× m) | 188 | 556 | 833 |
| **Untreated per year (× u)** | **132** | **417** | **667** |

**Cross-check.** The IOF audit gives about 700 UAE-wide hip fractures in 2010, with no method given. That figure is for the whole country, so it is not directly comparable. Abu Dhabi's share of the UAE is not sourced in this session, so the cross-check cannot be made tight. The estimate's central hip figure (about 278 per year) is in the same order of magnitude as a single emirate's share of 700, which supports the scale, but this is not a validation.

**Result to use in the pitch, with the label:** "ESTIMATE: roughly 130 to 670 untreated fragility fractures a year in Abu Dhabi emirate, central about 420 (back-of-envelope; regional incidence proxy; not measured)."

---

## Task 2: Resolving UNVERIFIED items

| Item | Status | Finding | Source URL | Opened |
| --- | --- | --- | --- | --- |
| Kaiser Healthy Bones primary citation (Dell et al., JBJS 2008) | **Partly resolved** | ScienceDaily gives the reference as *J Bone Joint Surg Am*, published online 3 Nov 2008, supplement 4 (vol. 90, p. 188), authors Richard M. Dell, Denise Greene, Steven R. Schelkun, Kathyrn W. Williams. Design: a "five-year study" tracking "more than 625,000" patients over 50 with risk factors. **No control group is described.** Reported average hip fracture reduction 37.2% (up to 50% in at-risk people), no confidence interval, comparison group not stated. The journal supplement itself was not found in PubMed (search and citation lookup both returned no match) | https://www.sciencedaily.com/releases/2008/11/081104152306.htm | Y (press summary, not the article) |
| Nanox HealthOST FDA 510(k) number and date | **Resolved** | K213944, device HealthOST, applicant Nanox AI Ltd, decision date 04/22/2022, decision "Substantially Equivalent", product code JAK (Computed Tomography X-ray System, reg. 892.1750). Indications: image processing of spine CT "in patients aged 50 and over undergoing CT scan for any clinical indication". Functions: labelling T1 to L4, height loss per vertebra, mean HU in T11 to L4. "FBP-reconstructed images only" | https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPMN/pmn.cfm?ID=K213944 and https://www.accessdata.fda.gov/cdrh_docs/pdf21/K213944.pdf | Y (both) |
| Federal Law No. 2 of 2019, data localisation article | **Resolved** | Article 13 "Storage and Transfer of Health Information and Data outside the State". Text: health information and data "may not be stored, processed," ... "outside the State, unless in the cases defined by virtue of a decision issued by the Health Authority" (in coordination with the Ministry). Issued 06/02/2019, Official Gazette issue 647, p. 11 | https://elaws.moj.gov.ae/UAE-MOJ_LC-En/00_Health/UAE-LC-En_2019-02-06_00002_Kait.html?val=EL1 | Y |
| Cabinet Decision 32 of 2020 status | **Partly resolved** | Tamimi describes it as the Cabinet resolution on ICT in health ("Cabinet Resolution No. 32 of 2020"), covering controls and protocols for the Central System; it "appears to be a preliminary guideline"; it comes into force November 2020 per the page; the page says emirate-level guidance on the transfer restriction and its exceptions is still awaited. The page is undated and the Cabinet text itself was not opened | https://tamimi.com/law-update-articles/you-are-in-my-system-the-implementing-regulations-on-federal-law-regulating-the-use-of-ict-in-the-uae-healthcare-sector | Y (secondary source) |
| Breach fine AED 500,000 to 700,000 (from pack) | **Not confirmed** in this session. The Tamimi implementing-regulations page does not mention penalties | n/a | n/a | n/a |
| Malaffi supported standards (FHIR, HL7) | **Resolved, with a correction to the pack.** DoH lists five standards and one terminology: Standard 1 Patient Identifier; Standard 2 Clinical Encounter; Standard 3 Non-Drug Allergies; Standard 4 Problem List or Chronic Conditions; Standard 5 Laboratory Results; Terminology: SNOMED CT. **HL7 v2, HL7 FHIR, LOINC and ICD-10 are not mentioned.** Detailed specifications are not on the page. "Last updated: 08 Jul 2025" | https://www.doh.gov.ae/en/resources/HIE | Y |
| Malaffi standards PDF (detailed spec) | Not opened: the DoH media file was blocked by robots rules | https://www.doh.gov.ae/-/media/E11818DB96604C0DBCC1AEAC6DF16203.ashx | Y (blocked) |
| DoH AI policy replaced in 2025 or later? | **Not found to be replaced.** The DoH policies list shows one AI document: "Policy on Use of Artificial Intelligence (AI) in the Healthcare Sector of the Emirate of Abu Dhabi", undated on the page, no link. The PDF it points to is dated 30 April 2018, Document Ref Policy/AI/0.9. No 2025 update was found in search or on the list. Requirements in that PDF: §7.1.2.1.1 "Certification of the AI software from recognized international agencies"; §7.1.2.1.3 "Auditable validation statements"; §7.1.2.4 audits by the technology provider; §7.2.5 regular audit by healthcare end-users, reported to DoH; §5.3.1 "AI software should be verifiable and explainable"; §7.1.2.5 compliance with the DoH HIE policy | https://www.doh.gov.ae/en/resources/policies and https://www.doh.gov.ae/-/media/E9C1470A575146B18015DEBE57E47F8D.ashx | Y (both) |
| Malaysian CPG 2022 FRAX thresholds (PubMed 37496985) | **Resolved, with a correction to the pack.** PubMed record 37496985 is the **summary** of the CPG, not the full guideline: "A summary of the Malaysian Clinical Practice Guidelines on the management of postmenopausal osteoporosis, 2022", *Osteoporos Sarcopenia* 2023;9(2):60-69, PMID 37496985, PMC10366466, doi 10.1016/j.afos.2023.06.002, authors Ong TIW et al. Thresholds from the full text (pp. 62 to 63, Sections 3.1.2 and 3.3): treatment considered for osteopenia when "> 3% probability at 10 years for hip or > 20% probability at 10 years for major osteoporosis-related fracture"; "Very high FRAX risk (> 30% for major osteoporotic fracture and > 4.5% for hip fracture)". No DXA fast-track text in the CPG. The PMC page itself returned a CAPTCHA; the text was read from a PMC PDF mirror (rcastoragev2 blob), so the content should be checked against the official PMC page before citing | PubMed: https://pubmed.ncbi.nlm.nih.gov/37496985/ (abstract via PubMed MCP; DOI https://doi.org/10.1016/j.afos.2023.06.002). Full text: https://rcastoragev2.blob.core.windows.net/8ff1d94dbcee01f2e0e79662f1d00f9e/main.PMC10366466.pdf | Y (abstract via PubMed; full text via mirror) |
| NICE NG259 fast-track DXA text | **Not resolved.** The evidence page opened shows the title "Osteoporosis: risk assessment", published 29 July 2026, and a list of evidence documents, with no recommendation text | https://www.nice.org.uk/guidance/ng259/evidence | Y (no text) |

**Pitch-relevant corrections from this task**

- The pack says the CPG 37496985 is "the full CPG". It is the summary. The thresholds are now verified from the summary's full text. Update the rule source in `src/rules.js` comments accordingly.
- The pack says "FHIR R4 interface is planned" and cites Malaffi standards as unverified. DoH names SNOMED CT and five data standards, but not HL7 or FHIR. Do not claim Malaffi requires FHIR. State it as a planned integration to be confirmed with DoH HIE (hie@doh.gov.ae, the contact on the DoH page).
- The pack's AI policy line should cite the 30 April 2018 policy (v0.9) and say no newer version was found on DoH's list. Its §7.1.2.1.1 requires certification from recognised international agencies, which is a real constraint for the regulatory section.
- The Kaiser row should not describe the programme as controlled. The press summary describes no control group. Javaid's point (no contemporaneous control) was not re-checked in this session.

---

## Task 3: Existing osteoporosis or FLS programmes in Abu Dhabi and UAE

| Item | Finding | Source URL | Opened |
| --- | --- | --- | --- |
| Dubai Health fracture liaison service | Listed on the IOF Capture the Fracture site as a UAE FLS. Enrolment: "being older than 50 years old and presenting with a fragility fracture". Process: discharge pop-up prompts the surgeon to refer to a primary-care osteoporosis clinic; a fracture liaison coordinator contacts the patient and books the appointment. **Start date, operator, patient numbers and outcomes not stated.** Listing tier "Bronze" (unexplained) | https://www.capturethefracture.org/fls/dubai-health | Y |
| Abu Dhabi FLS, registry or osteoporosis service (SEHA, Cleveland Clinic Abu Dhabi, M42, others) | **Not confirmed.** A search returned no Abu Dhabi programme page that I opened. This is not evidence that none exists | n/a | N (search only) |
| UAE national osteoporosis registry | None found | n/a | N |
| DoH quality indicators covering osteoporosis | None. The 2025 orthopaedic Jawda set (OS001 to OS009) does not cover fragility fracture or osteoporosis treatment, as stated in the pack. Not re-opened in this session | pack source | N |

**Likely buyer or owner of an FLS-type function (inference, not sourced)**

- The **hospital orthopaedic or trauma department** owns the referral step, since the FLS listing shows the surgeon triggers referral.
- The **hospital quality or clinical governance** office (for example, under a regulator such as DoH via Jawda reporting) is the likely owner of any measured indicator.
- The **primary-care or osteoporosis clinic** owns the treatment decision in the Dubai model.
- A clinic-level coordinator role is the staff function that the FLS listing describes.

Action: confirm the owner with one hospital contact before the pitch names a buyer.

---

## Task 4: UAE-hosted or Arabic-capable LLMs

| Model | Owner | Parameters | Release (as stated) | Licence (as stated on opened page) | Availability (as stated) | Source URL | Opened |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Jais 30B (foundational and chat v1) | Core42 (G42 company), with Inception, MBZUAI and Cerebras | 30B | Announcement dated 9 Nov 2023 | **Not named** on the article. Described as "open-source" | "available for download on Hugging Face" | https://www.g42.ai/resources/news/core42-sets-new-benchmark-arabic-large-language-models-release-jais-30b | Y |
| Jais 2 (8B-Chat, 70B-Chat) | Inception (G42 group), Cerebras, Institute of Foundation Models at MBZUAI | 8B and 70B chat variants | Byline 9 Dec 2025 | **Not named.** Described as "open-weight" | 8B and 70B chat on Hugging Face; web chat; mobile apps; no API mentioned | https://www.middleeastainews.com/p/inception-cerebras-and-mbzuai-release | Y |
| Falcon Arabic (7B) and Falcon-H1 family (34B, 7B, 3B, 1.5B, 1.5B-deep, 500M) | Technology Innovation Institute (TII), Abu Dhabi | Falcon Arabic 7B; H1 up to 34B | Release ID 21 May 2025 (date from URL, not body text) | "TII Falcon License", described as "based on Apache 2.0" with responsible-AI terms. Full terms not opened | Hugging Face; FalconLLM.TII.ae; no API mentioned | https://www.businesswire.com/news/home/20250521354444/cs | Y |
| K2 Think (and K2 Think V2 mentioned in search, not opened) | MBZUAI, in partnership with G42 | 32B | 9 Sep 2025 article | Not stated. "open-source"; data, training recipe and deployment code "openly available". Weights download not stated | Not stated | https://thenationalnews.com/future/technology/2025/09/09/uaes-mbzuai-launches-k2-think-a-smaller-ai-system-to-rival-openai-and-deepseek | Y |

**Arabic medical performance:** none of these was tested on radiology reports in this session. Model choice for report reading needs a bench test on Arabic and English report text, and a check that each licence allows clinical use.

---

## What this changes in the pitch

1. **Market size.** Add the ESTIMATE of about 130 to 670 untreated fragility fractures a year in Abu Dhabi emirate, central about 420, labelled as a back-of-envelope estimate with the assumptions in section 1b. Do not show it as a sourced number.
2. **Burden language.** Replace "the only UAE figures are old" with the 2011 IOF audit figures (about 700 UAE hip fractures in 2010, projected 1,200 by 2020, 2010 data without stated method) and the Saudi regional incidence (Saleh 2022), named as a proxy.
3. **Kaiser.** Describe it as a five-year programme with a press-reported 37.2% reduction and no described control group. Do not call it controlled.
4. **Imaging AI competitor.** Cite the FDA record directly: K213944, 22 April 2022, substantially equivalent, spine CT, patients 50 and over, FBP images only.
5. **Data residency.** Quote Article 13 of Federal Law No. 2 of 2019 directly (storage or processing outside the State only by a Health Authority decision in coordination with the Ministry). Use "Cabinet Resolution No. 32 of 2020" per Tamimi, marked as secondary source.
6. **Malaffi.** Remove any claim that Malaffi requires FHIR or HL7. Say: Malaffi defines five data standards and SNOMED CT; the integration interface is to be confirmed with DoH HIE.
7. **AI policy.** Cite the DoH AI policy of 30 April 2018 (v0.9). State that no newer version was found. Plan for its certification (§7.1.2.1.1) and auditable validation (§7.1.2.1.3) requirements.
8. **Clinical rules.** Use the verified CPG thresholds (osteopenia treatment above 3% hip or 20% major fracture; very high risk above 30% major or 4.5% hip) with the summary citation, not the full CPG.
9. **FLS landscape.** Name Dubai Health's FLS as the nearest UAE comparator, with its enrolment rule (over 50 with fragility fracture) and coordinator model. Do not claim an Abu Dhabi competitor exists or does not exist.
10. **LLM options.** For the report-reading model, list Jais 2 (open weights on Hugging Face, Inception and MBZUAI), Falcon-H1 and Falcon Arabic (TII Falcon License, Apache 2.0 based) and K2 Think (32B, weights status unclear). Name the licence as stated, and bench each before any claim.

---

## Still unresolved

1. Kaiser Healthy Bones full article: design, control group, confidence intervals. The PubMed lookup returned no match.
2. Abu Dhabi population aged 50+ count. The SCAD age-band tables were not readable as text.
3. Post-fracture osteoporosis treatment rate in the UAE or GCC: no source found.
4. Abu Dhabi FLS, osteoporosis clinic or registry (SEHA, Cleveland Clinic Abu Dhabi, M42): not confirmed. Search only, no page opened.
5. Federal Law No. 2 of 2019 breach penalty (pack says AED 500,000 to 700,000): not checked in this session.
6. Cabinet Resolution No. 32 of 2020: only a secondary source (Tamimi) read; the official text not opened. Current implementing status unclear.
7. Malaffi detailed interface specification: DoH media file blocked by robots rules.
8. DoH AI policy: no 2025 or later version found on the policy list. Confirm with DoH directly before submission.
9. NICE NG259 fast-track DXA text: not on the evidence page opened. The main recommendation page was not opened.
10. Jais and K2 Think licence terms: not named on the opened articles. Check the Hugging Face model cards (not opened).
11. Falcon TII Falcon License full terms: not opened.
12. Saleh 2022 Figure 1 (Abu Dhabi annual hip fracture counts): not readable.
13. IOF 2011 audit UAE country section (pp. 63 to 64): truncated in tool output. May hold more UAE data.
14. The pack cites The National for a 2011 date. A search snippet showed a 2018 date for the same URL. Not opened; check before citing the year.
15. Hsu 2026, Wang 2024 (INTERCEPT), Lindsay 2001, Mitchell 2017 and other pack references: not re-opened in this session. Their figures are unchanged from the pack and remain unverified here.
