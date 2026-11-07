# Arabic and bilingual reports (15)

_Reader: keyword baseline (src/finder.js) through readVerified(). Labels were written before the lexicon or any change was made for this set, and were not changed after the first run. All reports are synthetic. Not gated._

## Summary

- reports 15
- exact 100% (15/15)
- act sensitivity 100% (8/8)
- fractures surfaced to a human (act or review) 8/8
- silently dismissed (label act, finder no) 0
- act-labelled calls that were not act 0 (review or no labels called act)
- unverified reader outputs 0

- Lexicon added to src/finder.js for this set: fracture, compression, vertebra, femur neck, wrist, humerus, pelvis, negation, uncertainty, trauma, tumour and metastasis, with explicit Arabic boundaries.
- The author wrote the labels knowing this lexicon, so the vocabulary is not independent of the code. The result is an upper bound on how well the same lexicon handles unseen Arabic.

## Confusion matrix (rows = label, columns = finder)

| label \ finder | act | review | no |
| --- | --- | --- | --- |
| act | 8 | 0 | 0 |
| review | 0 | 3 | 0 |
| no | 0 | 0 | 4 |

## Every report

| ID | Label | Finder | Verified | Reason | Report |
| --- | --- | --- | --- | --- | --- |
| AR01 | act | act | yes | Fragility fracture documented (vert) | كسر انضغاطي في الفقرة T8 بنسبة 30% من ارتفاع الجسم الفقري. لا يوجد ما يشير إلى ورم. |
| AR02 | act | act | yes | Fragility fracture documented (hip) | كسر في عنق الفخذ الأيسر مع إزاحة واضحة. |
| AR03 | act | act | yes | Fragility fracture documented (wrist) | كسر في الطرف البعيد للكعبرة (distal radius) مع انحراف للخلف. |
| AR04 | act | act | yes | Fragility fracture documented (humerus) | كسر في الطرف العلوي للعضد الأيمن، دون إزاحة. |
| AR05 | act | act | yes | Fragility fracture documented (pelvis) | كسر في عظم العانة الأيمن (superior pubic ramus) دون إصابة في الحوض الخلفي. |
| AR06 | act | act | yes | Fragility fracture documented (vert) | آثار تدعيم فقري سابق (vertebroplasty) على مستوى L1، مع تشوه انضغاطي قديم. |
| AR07 | no | no | yes | No fracture documented | لا يوجد كسر في الفقرات القطنية. ارتفاع الفقرات طبيعي. |
| AR08 | no | no | yes | No fracture documented | No كسر ظاهر في الفقرة T12. التصوير طبيعي. |
| AR09 | review | review | yes | Hedged language | يشتبه بوجود كسر انضغاطي محتمل في الفقرة T9 ويوصى بالتصوير بالرنين مرة أخرى. |
| AR10 | no | no | yes | High-energy trauma (current mechanism): not a fragility fracture | كسر في عنق الفخذ الأيمن ناتج عن حادث سير عالي الطاقة. |
| AR11 | no | no | yes | Pathological fracture (tumour): not osteoporotic | كسر مرضي في الفقرة L2 بسبب ورم نقيلي معروف. |
| AR12 | act | act | yes | Fragility fracture documented (vert) | كسر انضغاطي في الفقرة L1 لدى مريضة مصابة بهشاشة العظام. |
| AR13 | review | review | yes | Fracture at a minor site | كسر في الضلع السادس الأيسر بعد سقوط بسيط. |
| AR14 | review | review | yes | Fracture under age 50 without trauma: needs review | كسر انضغاطي في الفقرة T7 دون حادث واضح. |
| AR15 | act | act | yes | Fragility fracture documented (vert) | انهيار في جسم الفقرة D10 مع نقص في الارتفاع الأمامي. |
