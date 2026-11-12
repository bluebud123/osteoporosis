# PeriLoop second-check evaluation, 2026-11-12

Model: `deepseek-chat` at `https://api.deepseek.com`. Messages: 913. Run time: 247 s.

Read this before quoting any number:
- Every message is invented and every label ("urgent", "emergency", "normal") was written by an AI, not a clinician.
- Sets h1 to h5 and the library have all been used to tune the fixed rules, so "rules alone" is optimistic. The useful columns are what the AI check adds and what it costs in false alerts.
- "Caught" means the message raised an EMERGENCY or SAME-DAY alert. The AI check can only raise to SAME-DAY.
- "AI check unavailable" counts messages where the model call failed or returned something unusable; the rules result stood.
- One run of one model. Run it again and with another model before relying on it.

### All sets together

| Language | Urgent caught, rules alone | Urgent caught, rules + AI check | Of which labelled emergency: rules alone | Emergency: rules + AI check | False alerts, rules alone | False alerts, rules + AI check | AI check unavailable |
|---|---|---|---|---|---|---|---|
| en | 199/207 (96%) | 207/207 (100%) | 94/94 (100%) | 94/94 (100%) | 3/161 (2%) | 4/161 (2%) | 1 |
| ms | 116/121 (96%) | 121/121 (100%) | 48/48 (100%) | 48/48 (100%) | 5/75 (7%) | 7/75 (9%) | 0 |
| zh | 104/110 (95%) | 110/110 (100%) | 43/43 (100%) | 43/43 (100%) | 0/67 (0%) | 1/67 (1%) | 0 |
| ar | 72/99 (73%) | 99/99 (100%) | 26/26 (100%) | 26/26 (100%) | 6/73 (8%) | 8/73 (11%) | 0 |
| all | 491/537 (91%) | 537/537 (100%) | 211/211 (100%) | 211/211 (100%) | 14/376 (4%) | 20/376 (5%) | 1 |

### Set h1

| Language | Urgent caught, rules alone | Urgent caught, rules + AI check | Of which labelled emergency: rules alone | Emergency: rules + AI check | False alerts, rules alone | False alerts, rules + AI check | AI check unavailable |
|---|---|---|---|---|---|---|---|
| en | 38/38 (100%) | 38/38 (100%) | 19/19 (100%) | 19/19 (100%) | 0/40 (0%) | 1/40 (3%) | 1 |
| ms | 20/20 (100%) | 20/20 (100%) | 10/10 (100%) | 10/10 (100%) | 0/12 (0%) | 0/12 (0%) | 0 |
| zh | 18/18 (100%) | 18/18 (100%) | 10/10 (100%) | 10/10 (100%) | 0/10 (0%) | 1/10 (10%) | 0 |
| ar | 8/8 (100%) | 8/8 (100%) | 4/4 (100%) | 4/4 (100%) | 0/4 (0%) | 0/4 (0%) | 0 |
| all | 84/84 (100%) | 84/84 (100%) | 43/43 (100%) | 43/43 (100%) | 0/66 (0%) | 2/66 (3%) | 1 |

### Set h2

| Language | Urgent caught, rules alone | Urgent caught, rules + AI check | Of which labelled emergency: rules alone | Emergency: rules + AI check | False alerts, rules alone | False alerts, rules + AI check | AI check unavailable |
|---|---|---|---|---|---|---|---|
| en | 32/32 (100%) | 32/32 (100%) | 16/16 (100%) | 16/16 (100%) | 0/27 (0%) | 0/27 (0%) | 0 |
| ms | 16/16 (100%) | 16/16 (100%) | 8/8 (100%) | 8/8 (100%) | 0/8 (0%) | 2/8 (25%) | 0 |
| zh | 12/12 (100%) | 12/12 (100%) | 6/6 (100%) | 6/6 (100%) | 0/5 (0%) | 0/5 (0%) | 0 |
| all | 60/60 (100%) | 60/60 (100%) | 30/30 (100%) | 30/30 (100%) | 0/40 (0%) | 2/40 (5%) | 0 |

### Set h3

| Language | Urgent caught, rules alone | Urgent caught, rules + AI check | Of which labelled emergency: rules alone | Emergency: rules + AI check | False alerts, rules alone | False alerts, rules + AI check | AI check unavailable |
|---|---|---|---|---|---|---|---|
| en | 24/24 (100%) | 24/24 (100%) | 14/14 (100%) | 14/14 (100%) | 0/15 (0%) | 0/15 (0%) | 0 |
| ms | 7/7 (100%) | 7/7 (100%) | 4/4 (100%) | 4/4 (100%) | 0/3 (0%) | 0/3 (0%) | 0 |
| zh | 4/4 (100%) | 4/4 (100%) | 2/2 (100%) | 2/2 (100%) | 0/2 (0%) | 0/2 (0%) | 0 |
| all | 35/35 (100%) | 35/35 (100%) | 20/20 (100%) | 20/20 (100%) | 0/20 (0%) | 0/20 (0%) | 0 |

### Set h4

| Language | Urgent caught, rules alone | Urgent caught, rules + AI check | Of which labelled emergency: rules alone | Emergency: rules + AI check | False alerts, rules alone | False alerts, rules + AI check | AI check unavailable |
|---|---|---|---|---|---|---|---|
| en | 43/43 (100%) | 43/43 (100%) | 25/25 (100%) | 25/25 (100%) | 2/25 (8%) | 2/25 (8%) | 0 |
| ms | 23/23 (100%) | 23/23 (100%) | 16/16 (100%) | 16/16 (100%) | 0/6 (0%) | 0/6 (0%) | 0 |
| zh | 24/24 (100%) | 24/24 (100%) | 17/17 (100%) | 17/17 (100%) | 0/5 (0%) | 0/5 (0%) | 0 |
| ar | 19/19 (100%) | 19/19 (100%) | 14/14 (100%) | 14/14 (100%) | 0/4 (0%) | 0/4 (0%) | 0 |
| all | 109/109 (100%) | 109/109 (100%) | 72/72 (100%) | 72/72 (100%) | 2/40 (5%) | 2/40 (5%) | 0 |

### Set h5

| Language | Urgent caught, rules alone | Urgent caught, rules + AI check | Of which labelled emergency: rules alone | Emergency: rules + AI check | False alerts, rules alone | False alerts, rules + AI check | AI check unavailable |
|---|---|---|---|---|---|---|---|
| en | 30/30 (100%) | 30/30 (100%) | 20/20 (100%) | 20/20 (100%) | 0/14 (0%) | 0/14 (0%) | 0 |
| ms | 15/15 (100%) | 15/15 (100%) | 10/10 (100%) | 10/10 (100%) | 0/6 (0%) | 0/6 (0%) | 0 |
| zh | 12/12 (100%) | 12/12 (100%) | 8/8 (100%) | 8/8 (100%) | 0/5 (0%) | 0/5 (0%) | 0 |
| ar | 12/12 (100%) | 12/12 (100%) | 8/8 (100%) | 8/8 (100%) | 0/5 (0%) | 0/5 (0%) | 0 |
| all | 69/69 (100%) | 69/69 (100%) | 46/46 (100%) | 46/46 (100%) | 0/30 (0%) | 0/30 (0%) | 0 |

### Set library

| Language | Urgent caught, rules alone | Urgent caught, rules + AI check | Of which labelled emergency: rules alone | Emergency: rules + AI check | False alerts, rules alone | False alerts, rules + AI check | AI check unavailable |
|---|---|---|---|---|---|---|---|
| en | 32/40 (80%) | 40/40 (100%) | - | - | 1/40 (3%) | 1/40 (3%) | 0 |
| ms | 35/40 (88%) | 40/40 (100%) | - | - | 5/40 (13%) | 5/40 (13%) | 0 |
| zh | 34/40 (85%) | 40/40 (100%) | - | - | 0/40 (0%) | 0/40 (0%) | 0 |
| ar | 33/60 (55%) | 60/60 (100%) | - | - | 6/60 (10%) | 8/60 (13%) | 0 |
| all | 134/180 (74%) | 180/180 (100%) | - | - | 12/180 (7%) | 14/180 (8%) | 0 |

### Emergencies still missed after rules + AI check (0)

- none

### Other urgent messages still missed (0)

- none

### Ordinary messages the AI check raised (6)

- [h1, en] is it normal to get a fever after knee surgery?
- [h1, zh] 手术后发烧正常吗？
- [h2, ms] apa perlu saya bawa ke hospital
- [h2, ms] kalau luka berair macam mana?
- [library, ar] الجبس انعصر شوية عند الكعب بس مفيش ريحة ولا دم ولا برد في صوابعي، بس حابب أتأكد
- [library, ar] الجبص حيحك من الداخل ومو قادر اشيله، وش اسوي؟ هل فيه شي اسويه بأمان؟

