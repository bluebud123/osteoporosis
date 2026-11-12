Model: `deepseek-chat` at `https://api.deepseek.com`. Messages: 913. Run time: 237 s.

Read this before quoting any number:
- Every message is invented and every label ("urgent", "emergency", "normal") was written by an AI, not a clinician.
- Sets h1 to h5 and the library have all been used to tune the fixed rules, so "rules alone" is optimistic. The useful columns are what the AI check adds and what it costs in false alerts.
- "Caught" means the message raised an EMERGENCY or SAME-DAY alert. The AI check can only raise to SAME-DAY.
- "AI check unavailable" counts messages where the model call failed or returned something unusable; the rules result stood.
- One run of one model. Run it again and with another model before relying on it.

### All sets together

| Language | Urgent caught, rules alone | Urgent caught, rules + AI check | Of which labelled emergency: rules alone | Emergency: rules + AI check | False alerts, rules alone | False alerts, rules + AI check | AI check unavailable |
|---|---|---|---|---|---|---|---|
| en | 199/207 (96%) | 199/207 (96%) | 94/94 (100%) | 94/94 (100%) | 3/161 (2%) | 4/161 (2%) | 104 |
| ms | 116/121 (96%) | 116/121 (96%) | 48/48 (100%) | 48/48 (100%) | 5/75 (7%) | 6/75 (8%) | 59 |
| zh | 104/110 (95%) | 105/110 (95%) | 43/43 (100%) | 43/43 (100%) | 0/67 (0%) | 1/67 (1%) | 57 |
| ar | 72/99 (73%) | 74/99 (75%) | 26/26 (100%) | 26/26 (100%) | 6/73 (8%) | 6/73 (8%) | 83 |
| all | 491/537 (91%) | 494/537 (92%) | 211/211 (100%) | 211/211 (100%) | 14/376 (4%) | 17/376 (5%) | 303 |

### Set h1

| Language | Urgent caught, rules alone | Urgent caught, rules + AI check | Of which labelled emergency: rules alone | Emergency: rules + AI check | False alerts, rules alone | False alerts, rules + AI check | AI check unavailable |
|---|---|---|---|---|---|---|---|
| en | 38/38 (100%) | 38/38 (100%) | 19/19 (100%) | 19/19 (100%) | 0/40 (0%) | 1/40 (3%) | 11 |
| ms | 20/20 (100%) | 20/20 (100%) | 10/10 (100%) | 10/10 (100%) | 0/12 (0%) | 0/12 (0%) | 7 |
| zh | 18/18 (100%) | 18/18 (100%) | 10/10 (100%) | 10/10 (100%) | 0/10 (0%) | 1/10 (10%) | 3 |
| ar | 8/8 (100%) | 8/8 (100%) | 4/4 (100%) | 4/4 (100%) | 0/4 (0%) | 0/4 (0%) | 2 |
| all | 84/84 (100%) | 84/84 (100%) | 43/43 (100%) | 43/43 (100%) | 0/66 (0%) | 2/66 (3%) | 23 |

### Set h2

| Language | Urgent caught, rules alone | Urgent caught, rules + AI check | Of which labelled emergency: rules alone | Emergency: rules + AI check | False alerts, rules alone | False alerts, rules + AI check | AI check unavailable |
|---|---|---|---|---|---|---|---|
| en | 32/32 (100%) | 32/32 (100%) | 16/16 (100%) | 16/16 (100%) | 0/27 (0%) | 0/27 (0%) | 12 |
| ms | 16/16 (100%) | 16/16 (100%) | 8/8 (100%) | 8/8 (100%) | 0/8 (0%) | 1/8 (13%) | 4 |
| zh | 12/12 (100%) | 12/12 (100%) | 6/6 (100%) | 6/6 (100%) | 0/5 (0%) | 0/5 (0%) | 2 |
| all | 60/60 (100%) | 60/60 (100%) | 30/30 (100%) | 30/30 (100%) | 0/40 (0%) | 1/40 (3%) | 18 |

### Set h3

| Language | Urgent caught, rules alone | Urgent caught, rules + AI check | Of which labelled emergency: rules alone | Emergency: rules + AI check | False alerts, rules alone | False alerts, rules + AI check | AI check unavailable |
|---|---|---|---|---|---|---|---|
| en | 24/24 (100%) | 24/24 (100%) | 14/14 (100%) | 14/14 (100%) | 0/15 (0%) | 0/15 (0%) | 9 |
| ms | 7/7 (100%) | 7/7 (100%) | 4/4 (100%) | 4/4 (100%) | 0/3 (0%) | 0/3 (0%) | 2 |
| zh | 4/4 (100%) | 4/4 (100%) | 2/2 (100%) | 2/2 (100%) | 0/2 (0%) | 0/2 (0%) | 1 |
| all | 35/35 (100%) | 35/35 (100%) | 20/20 (100%) | 20/20 (100%) | 0/20 (0%) | 0/20 (0%) | 12 |

### Set h4

| Language | Urgent caught, rules alone | Urgent caught, rules + AI check | Of which labelled emergency: rules alone | Emergency: rules + AI check | False alerts, rules alone | False alerts, rules + AI check | AI check unavailable |
|---|---|---|---|---|---|---|---|
| en | 43/43 (100%) | 43/43 (100%) | 25/25 (100%) | 25/25 (100%) | 2/25 (8%) | 2/25 (8%) | 13 |
| ms | 23/23 (100%) | 23/23 (100%) | 16/16 (100%) | 16/16 (100%) | 0/6 (0%) | 0/6 (0%) | 3 |
| zh | 24/24 (100%) | 24/24 (100%) | 17/17 (100%) | 17/17 (100%) | 0/5 (0%) | 0/5 (0%) | 3 |
| ar | 19/19 (100%) | 19/19 (100%) | 14/14 (100%) | 14/14 (100%) | 0/4 (0%) | 0/4 (0%) | 4 |
| all | 109/109 (100%) | 109/109 (100%) | 72/72 (100%) | 72/72 (100%) | 2/40 (5%) | 2/40 (5%) | 23 |

### Set h5

| Language | Urgent caught, rules alone | Urgent caught, rules + AI check | Of which labelled emergency: rules alone | Emergency: rules + AI check | False alerts, rules alone | False alerts, rules + AI check | AI check unavailable |
|---|---|---|---|---|---|---|---|
| en | 30/30 (100%) | 30/30 (100%) | 20/20 (100%) | 20/20 (100%) | 0/14 (0%) | 0/14 (0%) | 14 |
| ms | 15/15 (100%) | 15/15 (100%) | 10/10 (100%) | 10/10 (100%) | 0/6 (0%) | 0/6 (0%) | 6 |
| zh | 12/12 (100%) | 12/12 (100%) | 8/8 (100%) | 8/8 (100%) | 0/5 (0%) | 0/5 (0%) | 5 |
| ar | 12/12 (100%) | 12/12 (100%) | 8/8 (100%) | 8/8 (100%) | 0/5 (0%) | 0/5 (0%) | 5 |
| all | 69/69 (100%) | 69/69 (100%) | 46/46 (100%) | 46/46 (100%) | 0/30 (0%) | 0/30 (0%) | 30 |

### Set library

| Language | Urgent caught, rules alone | Urgent caught, rules + AI check | Of which labelled emergency: rules alone | Emergency: rules + AI check | False alerts, rules alone | False alerts, rules + AI check | AI check unavailable |
|---|---|---|---|---|---|---|---|
| en | 32/40 (80%) | 32/40 (80%) | - | - | 1/40 (3%) | 1/40 (3%) | 45 |
| ms | 35/40 (88%) | 35/40 (88%) | - | - | 5/40 (13%) | 5/40 (13%) | 37 |
| zh | 34/40 (85%) | 35/40 (88%) | - | - | 0/40 (0%) | 0/40 (0%) | 43 |
| ar | 33/60 (55%) | 35/60 (58%) | - | - | 6/60 (10%) | 6/60 (10%) | 72 |
| all | 134/180 (74%) | 137/180 (76%) | - | - | 12/180 (7%) | 12/180 (7%) | 197 |

### AI check by itself (no rules), all sets

The AI check was asked about every message, including those the rules had already caught. This is the only table that tests the AI check on labelled emergencies. "Unavailable" answers count as not caught.

| Language | Urgent caught by AI alone | Of which labelled emergency | Ordinary messages the AI raised | AI unavailable |
|---|---|---|---|---|
| en | 31/207 (15%) | 15/94 (16%) | 1/161 (1%) | 275 |
| ms | 17/121 (14%) | 9/48 (19%) | 1/75 (1%) | 163 |
| zh | 24/110 (22%) | 14/43 (33%) | 1/67 (1%) | 138 |
| ar | 9/99 (9%) | 5/26 (19%) | 0/73 (0%) | 154 |
| all | 81/537 (15%) | 43/211 (20%) | 3/376 (1%) | 730 |

#### Urgent messages the AI check alone did not flag (456)

- [h1, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] blood is pouring from the wound, towel is soaked through
- [h1, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] my foot below the operated knee is cold and pale and i cant wiggle my toes
- [h1, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] after the new antibiotic my face is puffing up and i am wheezing
- [h1, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] one side of dads face has dropped and his words are coming out wrong
- [h1, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] i dont see the point of going on anymore, i want to end it
- [h1, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] he just dropped to the floor and isnt answering us
- [h1, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] sudden trouble breathing and chest hurts
- [h1, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] I vomited and there was blood in it
- [h1, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] my poo is jet black and sticky since starting the blood thinner
- [h1, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] out of breath and dizzy, calf also swollen
- [h1, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] ayah saya tiba-tiba tak boleh cakap, mulut dia senget
- [h1, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] mak saya pengsan dalam bilik air
- [h1, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] darah keluar banyak dari luka, tak berhenti
- [h1, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] batuk keluar darah pagi tadi
- [h1, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] kaki saya sejuk dan pucat, jari tak boleh gerak
- [h1, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] الجرح ينزف بقوة وما يوقف
- [h1, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] my calf is hard, sore and bigger than the other one
- [h1, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] lower leg is tender when I squeeze it and ankle is puffy on the operated side
- [h1, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] I slipped in the shower and landed on my new knee
- [h1, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] pain is unbearable even with the tablets, 10 out of 10
- [h1, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] since this morning I cant put any weight on the leg, yesterday I could walk
- [h1, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] I've been throwing up all day and can't keep my tablets down
- [h1, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] my knee suddenly gave way and I heard a pop, now very swollen
- [h1, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] green gunk coming from the incision
- [h1, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] feeling feverish and the knee is throbbing and warm
- [h1, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] there's a blister turning black near the wound
- [h1, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] woke up drenched in sweat with shaking chills
- [h1, ms, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] luka saya keluar air kuning dan berbau
- [h1, ms, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] lutut makin bengkak dan merah, panas bila sentuh
- [h1, ms, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] demam 38.5 sejak semalam
- [h1, ms, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] betis saya bengkak dan sakit bila tekan
- [h1, ms, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] sakit sangat kuat, ubat tak jalan langsung
- [h1, ms, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] kaki bengkak sampai ke buku lali, tegang dan sakit
- [h1, zh, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] 我刚才摔了一跤，撞到手术的膝盖
- [h1, zh, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] 伤口有臭味
- [h1, zh, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] 膝盖比昨天肿很多，很烫
- [h1, ar, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] الجرح يطلع منه صديد وريحته كريهة
- [h1, ar, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] طحت اليوم على ركبتي
- [h2, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] struggling for air since i woke up
- [h2, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] my chest feels tight and heavy and im sweating a lot
- [h2, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] theres blood when i cough
- [h2, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] wife is very sleepy and i cant wake her properly
- [h2, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] my lips and tongue swelling after the painkiller
- [h2, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] left side of my body went weak suddenly and my mouth is droopy
- [h2, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] i think i took my blood thinner twice today
- [h2, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] sometimes i think everyone would be better off without me
- [h2, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] dad fainted in the toilet just now
- [h2, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] short of breath la doc, climbing few steps only already panting
- [h2, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] i feel like i am dying cannot breathe
- [h2, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] passing black tar like stool
- [h2, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] my toes on the op leg turned blue and feel numb
- [h2, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] having fits, whole body shaking
- [h2, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] vomiting blood clots
- [h2, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] tak boleh bernafas dengan betul
- [h2, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] sakit dada kuat menjalar ke lengan kiri
- [h2, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] mak saya cakap merapu dan tak kenal saya
- [h2, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] muntah darah tadi
- [h2, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] bibir bengkak dan gatal seluruh badan lepas makan ubat baru
- [h2, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] abah jatuh pengsan tak sedar diri
- [h2, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] saya dah tak nak hidup lagi
- [h2, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] najis hitam pekat macam tar
- [h2, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 呼吸很困难，胸口闷
- [h2, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 我吐血了
- [h2, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 爸爸昏过去了
- [h2, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 脚发黑冰冷
- [h2, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] pus coming out from the stitches
- [h2, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] incision has opened up about 1cm
- [h2, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] my temperature reading is 39
- [h2, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] feel hot and shivering whole night
- [h2, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] painkillers not working at all, crying from pain
- [h2, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] can't bend or straighten the knee since last night, locked
- [h2, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] knee ballooned up overnight and skin is shiny and red
- [h2, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] wound smells bad and dressing is yellow
- [h2, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] have not urinated since morning, feel very full
- [h2, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] redness spreading up my thigh from the wound
- [h2, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] whole leg swollen up to the thigh and tight
- [h2, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] my wound is bleeding again after physio
- [h2, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] stitches burst when i bent my knee
- [h2, ms, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] luka bernanah
- [h2, ms, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] demam panas sejak dua hari
- [h2, ms, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] betis keras dan sakit
- [h2, ms, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] saya jatuh dalam bilik air pagi tadi
- [h2, ms, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] luka berdarah semula
- [h2, ms, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] lutut merah dan panas
- [h2, ms, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] tak boleh pijak kaki langsung
- [h2, zh, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] 伤口流脓
- [h2, zh, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] 小腿很肿很痛
- [h2, zh, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] 伤口又出血了
- [h2, zh, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] 膝盖又红又肿又烫
- [h3, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] cant breathe properly when lying flat
- [h3, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] chest pain going into my jaw
- [h3, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] sudden shortness of breath and calf pain
- [h3, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] grandma is not responding to us
- [h3, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] he is turning blue
- [h3, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] i feel faint and my heart is beating so fast
- [h3, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] spitting blood
- [h3, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] bleeding wont stop even after pressing 20 minutes
- [h3, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] tongue feels swollen and hard to swallow after injection
- [h3, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] cant move my right arm and face feels numb
- [h3, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] i swallowed the whole strip of painkillers
- [h3, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] i want to die
- [h3, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] had a seizure 10 minutes ago
- [h3, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] my foot has gone white and cold and numb
- [h3, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] nafas sesak sangat
- [h3, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] dada rasa macam dihempap
- [h3, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] ayah tak sedarkan diri
- [h3, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] darah memancut dari luka
- [h3, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 胸口痛，喘不过气
- [h3, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 他抽搐了
- [h3, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] yellow fluid leaking from wound
- [h3, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] wound edges are separating
- [h3, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] fever 38.9
- [h3, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] shivering and sweating all night
- [h3, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] calf is rock hard and painful
- [h3, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] i fell on my operated knee yesterday
- [h3, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] pain 9/10 tablets do nothing
- [h3, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] cannot walk at all today
- [h3, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] knee is hot to touch and very red
- [h3, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] dressing soaked with fluid
- [h3, ms, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] luka berbau busuk
- [h3, ms, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] demam dan menggigil
- [h3, ms, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] kaki bengkak makin teruk
- [h3, zh, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] 伤口裂开了
- [h3, zh, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] 发烧到39度
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] i cant catch my breath
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] feels like im drowning when i lie down
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] my husband wont wake up
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] mum passed out in the bathroom
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] left side of my body feels weak and my mouth is drooping
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] i coughed up something red
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] my lips are swelling after the antibiotic
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] i dont want to be here anymore
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] thinking of killing myself
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] took 10 tramadol at once
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] leg is cold and i cant feel my toes
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] sharp pain when i breathe in
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] i blacked out for a minute
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] my heart is skipping and i feel like im going to pass out
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] cp radiating to left arm
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] vomitting blood
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] cnt breathe
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] throat closing up
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] black tarry stools since yesterday
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] wife is acting strange, doesnt know where she is
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] worst headache of my life
- [h4, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] dad is breathing very fast and his lips look dark
- [h4, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] sesak nafas
- [h4, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] saya susah bernafas
- [h4, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] tak leh nafas
- [h4, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] xleh bernafas
- [h4, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] dada sakit sangat
- [h4, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] betis bengkak dan sakit, nafas pun semput
- [h4, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] suami saya pengsan
- [h4, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] mak saya tak sedar
- [h4, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] darah keluar banyak dari luka
- [h4, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] batuk berdarah
- [h4, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] muntah darah
- [h4, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] mulut senget, tangan lemah
- [h4, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] kaki sejuk dan kebas, warna kebiruan
- [h4, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] jantung berdegup laju dan rasa nak pitam
- [h4, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] mak tiba2 cakap merepek
- [h4, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 呼吸很困难
- [h4, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 胸口很闷很痛
- [h4, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 小腿肿痛，还很喘
- [h4, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 我先生叫不醒
- [h4, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 伤口一直流血止不住
- [h4, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 咳血
- [h4, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 吐血了
- [h4, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 不想活了
- [h4, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 嘴歪了，手没力
- [h4, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 脚冰冷发紫
- [h4, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 我老公昏过去了
- [h4, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 气促
- [h4, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 心脏跳得很快，快晕了
- [h4, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 呼吸困難
- [h4, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 傷口流血不止
- [h4, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 透不過氣
- [h4, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 胸口好痛
- [h4, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] لا أستطيع التنفس
- [h4, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] ضيق في التنفس
- [h4, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] زوجي فاقد الوعي
- [h4, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] نزيف لا يتوقف من الجرح
- [h4, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] أسعل دم
- [h4, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] أريد أن أموت
- [h4, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] مو قادر أتنفس
- [h4, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] صدري يوجعني وايد
- [h4, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] رجلي منتفخة وتعورني وأحس بكتمة
- [h4, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] أبوي طاح وما يرد علينا
- [h4, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] وجهه مايل وكلامه ثقيل
- [h4, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] تقيأت دم
- [h4, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] مش قادر اخد نفسي
- [h4, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] the knee is twice the size of the other one
- [h4, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] pus coming from the incision
- [h4, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] temperature 38.5 since last night
- [h4, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] my calf hurts when i walk and feels tight
- [h4, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] i cant put weight on my leg since i fell
- [h4, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] stitches opened
- [h4, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] the dressing is soaked with blood
- [h4, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] cant lift my foot up since surgery, it just drops
- [h4, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] havent pooped in 6 days, belly is hard and i keep throwing up
- [h4, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] wound is red, warm and the red area is getting bigger
- [h4, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] chills and shaking
- [h4, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] knee is locked, wont bend at all
- [h4, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] there is a bad smell from the bandage
- [h4, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] burning when i pee and feeling feverish
- [h4, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] i missed my blood thinner injection for 3 days
- [h4, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] something yellowish on the plaster this morning
- [h4, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] calf pain
- [h4, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] the pain meds arent doing anything, i was up all night crying
- [h4, ms, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] luka bernanah
- [h4, ms, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] demam 38.5 sejak semalam
- [h4, ms, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] betis sakit dan tegang
- [h4, ms, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] jahitan terbuka
- [h4, ms, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] saya jatuh tadi, lutut sakit sangat
- [h4, ms, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] lutut merah dan panas
- [h4, ms, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] luka keluar air
- [h4, zh, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] 伤口流脓
- [h4, zh, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] 发烧38.5度
- [h4, zh, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] 小腿很痛很紧
- [h4, zh, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] 膝盖又红又烫
- [h4, zh, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] 我跌倒了，膝盖很痛
- [h4, zh, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] 傷口有臭味
- [h4, zh, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] 缝线开了
- [h4, ar, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] الجرح يطلع منه صديد
- [h4, ar, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] حرارتي 39
- [h4, ar, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] الركبة حمراء وساخنة
- [h4, ar, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] طحت على ركبتي
- [h4, ar, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] ألم في بطة الرجل
- [h5, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] my mother is gasping and cant finish a sentence
- [h5, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] woke up with a tight band around my chest and sweating
- [h5, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] pain in my chest that goes to my back when i breathe
- [h5, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] the whole leg is swollen to the groin and im breathless on the stairs
- [h5, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] blood soaked through three towels and its still coming
- [h5, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] he fainted in the shower and hit his head
- [h5, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] my speech is slurred and my right hand keeps dropping things
- [h5, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] i took all my sleeping tablets
- [h5, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] theres no reason for me to keep living
- [h5, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] toes on the operated side are white and i cant feel them
- [h5, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] she keeps seeing people who arent there since last night
- [h5, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] coughing up pink frothy stuff
- [h5, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] heart pounding and i nearly passed out on the way to the bathroom
- [h5, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] he is shaking all over and his eyes rolled back
- [h5, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] very sleepy cant keep him awake after the morphine
- [h5, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] SOB and calf pain x2 days
- [h5, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] i think im having a heart attack
- [h5, en, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] vomited something that looks like coffee grounds
- [h5, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] ayah saya tercungap-cungap, tak boleh cakap
- [h5, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] dada saya sakit menjalar ke lengan kiri
- [h5, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] kaki bengkak besar dan saya semput bila berjalan
- [h5, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] darah tak berhenti keluar dari jahitan, dah basah dua tuala
- [h5, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] saya rasa lebih baik saya mati
- [h5, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] jari kaki jadi hitam dan sejuk
- [h5, ms, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] bibir bengkak dan susah nak telan lepas makan ubat
- [h5, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 我妈妈喘得很厉害，说不出话
- [h5, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 胸口像被石头压着
- [h5, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 腿肿得很厉害，走几步就喘
- [h5, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 血一直流，纱布都湿透了，止不 住
- [h5, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 我吃了一整瓶止痛药
- [h5, zh, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] 腳趾發黑，冰冰的
- [h5, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] امي تتنفس بصعوبة وما تقدر تتكلم
- [h5, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] الم قوي في صدري يمتد لذراعي
- [h5, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] رجلي متورمة مرة وصرت اتعب من النفس
- [h5, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] الدم ما يوقف من الجرح
- [h5, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] ابوي اغمي عليه في الحمام
- [h5, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] افكر انهي حياتي
- [h5, ar, emergency, AI said unscreened (second check unavailable), rules said EMERGENCY] اصابع رجلي صارت زرقاء وباردة
- [h5, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] greenish stuff on the dressing and it stinks
- [h5, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] knee has swollen up massively since this morning
- [h5, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] lower leg is tender to squeeze and warm
- [h5, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] the oxycodone isnt touching the pain
- [h5, en, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] i havent peed since last night
- [h5, en, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] been sick 5 times today cant keep water down
- [h5, ms, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] luka terbuka sikit dan keluar nanah
- [h5, ms, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] badan panas 38.8 dari pagi
- [h5, ms, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] saya tergelincir dalam bilik air, lutut terhentak
- [h5, ms, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] ubat tahan sakit tak berkesan langsung
- [h5, zh, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] 傷口流黃水，有味道
- [h5, zh, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] 今天发烧38.6度，发冷
- [h5, zh, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] 我在浴室滑倒了，膝盖着地
- [h5, ar, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] الجرح انفتح ويطلع منه سائل
- [h5, ar, sameday, AI said unscreened (second check unavailable), rules said EMERGENCY] عندي حرارة 38.5 وقشعريرة
- [h5, ar, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] الركبة متورمة وحارة ومحمرة اكثر من امس
- [h5, ar, sameday, AI said unscreened (second check unavailable), rules said SAME-DAY] المسكن ما ينفع والالم ما ينتحمل
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] doc my calf very swollen since this morning, hot and painful leh, and i got short of breath walking to toilet just now
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] since last night got a tight feeling in chest and my left arm tingly, sorry maybe nothing but want to ask
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] wound oozing yellow pus, smell very bad, and my thermometer say 39 degree
- [library, en, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] cannot feel my feet properly since the op, and when i try to pee also cannot control it
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] my foot gone white and cold, i cannot wiggle my toes anymore. no need to panic i think
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] dressing soaked red again, blood keep coming through even after I press 20 minutes
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] since the injection my husband keep talking nonsense, forget where he is, cannot recognise me
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] coughing up a little bit of blood since this afternoon and breathing faster than usual
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] accident this morning lah, cannot hold my poo at all, back pain very bad also
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] fever 38.9 since night, shaking and chills, the wound also looks red
- [library, en, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] No chest pain, no fever, but my breathing is getting worse every time I walk to the bathroom
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] sudden sharp pain on right side of chest when I breathe in, I'm not sure if this is normal recovery
- [library, en, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] thigh very hard and swollen, skin looks very shiny and tight, pain getting worse each hour
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] I feel dizzy when I stand and blacked out twice this morning
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] the stitches are fine lah. It's my foot under the dressing, colour gone grey-blue, and the toes feel cold to touch
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] Doktor, betis saya bengkak dan merah sejak pagi, sakit bila jalan, dan rasa sesak nafas sikit
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] Saya tak boleh gerakkan jari kaki, kaki sejuk dan nampak biru
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] Air kencing tak dapat ditahan sejak semalam, kaki sebelah kiri tak rasa apa-apa
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] Luka keluar nanah kuning, bau busuk, dan demam 39 darjah
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] Dada saya sakit macam ditekan, menjalar ke lengan kiri
- [library, ms, urgent, AI said unscreened, rules said ROUTE] Tak ada sakit dada, tapi nafas makin pendek bila jalan ke bilik air
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] Dia cakap merepek dan tak kenal anak, lepas bius tadi
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] Darah masih keluar dari luka walaupun dah tekan lama
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] Saya muntah-muntah dan pening, rasa nak pengsan
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] Kaki saya bengkak macam bantal, keras dan kulit berkilat
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] Saya dah tak rasa apa-apa dekat kaki bawah, kebas sepanjang hari
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] Doktor, lutut saya panas dan merah, malam tadi menggigil
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] Kaki nampak kelabu kebiruan, jari-jari sejuk sekali. Luka okay je
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] Tulang belakang sakit memang biasa, tapi tak boleh kawal berak sejak pagi
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] Tadi saya batuk darah sikit dan jantung berdegup laju
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 医生，我小腿肿得很厉害，又 红又热，走路时喘不过气
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 我的脚趾变白变冷，动不了
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 伤口流很多脓，有臭味，我发 烧到39度
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 这两天大小便都控制不住，腰 下面没感觉
- [library, zh, urgent, AI said unscreened, rules said ROUTE] 我没有胸痛，但是呼吸越来越急，走两步就喘
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 伤口的敷料一直有血渗出来， 压了半小时还是没停
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 老公手术后一直说胡话，叫不 醒他
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] 大腿摸起来硬硬的，皮肤绷得发亮，越来越痛
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 昨晚开始一直发抖，体温计显 示38.8
- [library, zh, urgent, AI said unscreened, rules said ROUTE] 我觉得脚底下麻麻的，好像没知觉，已经一整天了
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 手术那边的脚颜色怪怪的，有 点青紫，摸起来凉凉的，人没什么不舒服
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 我刚才咳了一口血丝，有点慌
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 医生，我今天头晕得很，站起 来就快晕倒
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 胸口一阵一阵的闷痛，痛到左 手臂
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] 腿上的伤口周围红了一大圈，还烫手，还有黄色的液体
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] I took the paracetamol and the codeine but I think I took too many last night, I was crying a lot. Dont tell my wife pls.
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 我丈夫半夜全身抽搐，抖了好 几分钟，现在叫不醒，嘴角有口水。
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] Doktor, kaki saya sejuk dan pucat dari semalam. Pembalut ketat sangat, jari kaki dah tak boleh gerak.
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] 医生，我的右腿小腿又肿又烫，走路时一按很痛，前天坐飞机从迪拜回来，十几个小时的那种。
- [library, en, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] Cant feel my front bum area and I think I peed myself a bit, not sure. Lower back op 2 days ago lah.
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] Tadi saya tercampak dari kerusi roda, kepala terhantuk lantai. Sekarang tak ingat apa jadi 5 min tadi, pening lagi.
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] my dad pass urine like cola colour and he very sleepy today, he got the back op 5 days ago. he say he okay only
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] kebas kat celah kangkang lepas buang air kecil, saya rasa tak sedar dah kencing sendiri. tulang belakang
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] I'm coughing and my chest is tight when I breathe deep, like there's a brick. Ankle surgery was on Thursday. I'm fine otherwise lah
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] 痛到不行，止痛药吃了三次都没用，医生说明天才能再开药，我现在快忍唔住。
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] i been throwing up since yesterday and today the vomit got black bits like coffee grounds. knee op last week
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] 我的膝盖绷带一直有血渗出来，压了半个钟都停不住，血很多。
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] doc sy dah 2 hari tak buang air besar dan kaki kebas dari pinggang ke bawah. surgery belakang Isnin hari tu
- [library, en, urgent, AI said unscreened, rules said ROUTE] I had surgery on my back and now when I cough I feel like something goes down my legs like electric and my right leg just gave way when i tried to walk.
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 手术后脚趾头发白，冰冷，像 死了一样，石膏绑得好紧，动不了。
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] mak saya tiba-tiba terkejut-kejut badan terketar kejap, lepas tu diam tak sedar. Op pinggul minggu lepas
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] my shoulder surgery stitches ok but my hand is kinda cold and white compared to other side and the fingers got pins and needles, been like this since the drip bag was changed
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 心跳得很乱，像打鼓一样，走 两步就喘，但我应该没事吧，反正只是肩膀手术。
- [library, ms, urgent, AI said unscreened, rules said ROUTE] air kencing dia warna macam teh pekat dan dia mengantuk sangat, asyik nak tidur je. op lutut 4 hari lepas
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] the wound on my back is very red, hot, and the stitches spitting out pus. Also my temperature 39.2 on the thermometer.
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 我在厕所摔了一跤，头撞到瓷 砖，之后有点糊涂，记不太清楚。
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] tekak saya bengkak sikit lepas makan antibiotik baru, susah nak telan, gatal2 satu badan
- [library, en, urgent, AI said unscreened, rules said ROUTE] i keep getting dizzy and thinking of ending it all. surgery was pain, now i just dont see the point. sorry
- [library, zh, urgent, AI said unscreened, rules said ROUTE] 我的腰以下完全没感觉，但是上面一直在出汗，这个正常吗？
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] bahu sebelah dah jadi kebas dan lemah, tak boleh angkat tangan. op hari selasa, luka pun ok je
- [library, en, urgent, AI said unscreened, rules said ROUTE] Came back from Dubai last night, 11hr flight. Right leg below knee is fat and warm to touch and kind of hurts when I point my toes. Probably just from sitting. Knee replacement 3 wks ago.
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 之前做完手术后一直很想死， 觉得活着没意思，希望医生别告诉家人。
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] i tak ok doc, rasa nak habiskan semua ubat yang ada. sakit sangat tak tertahan, hidup pun tak guna
- [library, en, urgent, AI said unscreened, rules said ROUTE] Doctor the toilet thing again. Nothing coming out since Tuesday and my legs feel like someone put sandbags on them. Back surgery was 4 days ago.
- [library, zh, urgent, AI said unscreened, rules said ROUTE] 我条腿冇力，行唔到路，屎都唔出得，开完腰三日。
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] nafas jadi pendek, rasa macam tak cukup udara bila jalan ke bilik air
- [library, en, urgent, AI said unscreened, rules said ROUTE] pls help. my mum keep saying she dunno who i am and talking to the wall. she was fine after the hip op yesterday
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 伤口流出黄绿色的水，有臭味 ，晚上冷到发抖，量体温应该超过38度吧。
- [library, ms, urgent, AI said unscreened, rules said ROUTE] kepala pening, muntah dua kali, nampak double. Op tulang belakang seminggu lepas, mungkin dah biasa kot
- [library, en, urgent, AI said unscreened, rules said ROUTE] Feeling a bit off, heart going like a drum even when I rest. Shoulder op 3 days. Doctor said it's nothing usually.
- [library, zh, urgent, AI said unscreened, rules said ROUTE] 可能没事，但昨天开始尿是深红色的，像可乐，而且好累。膝盖手术一个礼拜。
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] dah 2 hari tak sedar diri sekejap-sekejap, anak saya bising dia cakap merapu
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] Doc, I feel weird, the words not coming out right and my left arm is numb. Had the hip done Monday. Probably the painkillers ya.
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] 我的腿忽然好痛，一摸好硬，像绷紧了一样，连拖鞋都穿唔落。
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] sakit kat betis makin teruk bila gerak jari kaki, rasa tegang macam nak pecah
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] omg my leg is cold and kinda grey-blue since i woke up. the knee brace is on. Pls
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] 伤口旁边摸起来很热，红了一大片，最近晚上都发烧，我以为只是普通的。
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] bapa saya muntah darah warna coklat tadi, dia dah makan ubat tahan sakit banyak. Operasi bahu minggu lepas
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] my husband's body keep jerking like shaking for 2 min and now he sleeping weird, wont wake up properly
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 我屁股那边麻麻的，好像没有 感觉，小便也控制不住，腰开刀才三天。
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] saya rasa macam tak berapa betul, cakap tersekat2 dan tangan kiri lemah. Ubat darah cair dah makan
- [library, en, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] bro my knee got the bandage and i been bleeding through it since morning, the blood keeps coming thru even after pressing 20 mins
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 我昨晚吃咗好多药，好想唔好 再醒返。唔使理我。
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] doc ni rasa sakit kat dada kiri kadang2 bila gerak lengan. Sebelum ni tak ada. Operasi bahu 3 hari lepas
- [library, en, urgent, AI said unscreened, rules said ROUTE] I've been peeing loads and so thirsty since the op, sugar reads really high on the machine, probably nothing but I'm not diabetic
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 这两天一直没什么力气，昨天 晕倒了一下，醒来以后头很痛。髋关节换完才五天。
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] kaki kanan saya bengkak dan panas, betis sakit bila jalan. Balik dari Jeddah naik flight malam tadi
- [library, en, urgent, AI said unscreened, rules said ROUTE] the drain bottle got like pure red blood now, like half full in 2 hours. i dunno if thats normal ah
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 护士说伤口正常，但我的腿摸 起来冰冷，颜色发紫，也不痛了，是不是更糟？
- [library, ms, urgent, AI said unscreened, rules said ROUTE] kaki yang dibalut tu dah bertukar biru dan sejuk, saya tak boleh rasa jari
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] sorry for late msg. after ACL the knee is big now like balloon. tight. toes look purple?? ok bye
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 我全身都在痒，脸也肿了，嘴 唇发麻。打了新药之后开始。
- [library, ms, urgent, AI said unscreened, rules said ROUTE] boleh tolong? sy makan ubat tidur 20 biji sebab tak boleh tidur, sakit kaki tak hilang
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] I think my throat swelling a bit after I took the new antibiotic the clinic gave. hard to swallow. Itching all over too
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 喉咙好像肿起来了，吞口水都 痛，我吃了新的抗生素之后开始起很多疹子。
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] darah keluar dari luka sampai tembus balutan berkali-kali, dah 1 jam tak berhenti walaupun saya tekan
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] hi doc my wound been leaking yellow thing since yesterday, smell not nice, and i got shivering at night. just wan ask is it normal?
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 我觉得我好像中风，右边嘴歪 了，手也拿不住杯子。手术是上星期。
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] saya rasa panas badan je sikit tapi rasa dingin, dan luka kat belakang bengkak keras
- [library, en, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] my toes on my right foot feel like wood and I can't wiggle them, the plaster is tight. been like that 2 hours
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 我这几天胸口有点闷，有时候 痛，呼吸的时候也痛，应该是肌肉拉伤吧。腿也有点肿。
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] saya dah sakit 3 hari, pening tak hilang, muntah2 dan najis hitam macam tar. ubat pun tak lalu
- [library, en, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] lightheaded when i stand, wound ok but i fainted in the shower this morning for a sec. no pain just dizzy
- [library, zh, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] 我吐咗啲咖啡渣咁嘅嘢，仲有 少少黑色嘅屎，做完肩膊先至一个礼拜。
- [library, ms, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] kena sengat semut? tak, luka dah bengkak sampai mata tak nampak, bibir pun bengkak
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] ساقي اليمين صارت زرقا من تحت الركبة ومو حاس فيها شي تقريبا من امس، يمكن بس تعبانه شوي
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] ارتفاع في الحرارة حتى 39.5 مع قشعريرة شديدة، ولكن ربما هو مجرد التهاب بسيط في الحلق
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] حبيت قلك انو الجرح بيحمر وبيوجع وفي صديد أصفر صغير بس، مش مشكلة بعد
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] ما عم اقدر امشي ولا ارفع رجلي من بعد العملية، والتنميل صار بين رجلي وبطني
- [library, ar, urgent, AI said unscreened, rules said ROUTE] الوجع ما يخف حتى بالمورفين اللي عطوني، وقعدت اصرخ امبارح ساعتين
- [library, ar, urgent, AI said unscreened, rules said ROUTE] الوش والبق بتاعي اتنفخ شوية بعد الحقنة اللي ادوني، واللسان حاسس بيه تقيل
- [library, ar, urgent, AI said unscreened, rules said ROUTE] انا حاسس ان في حاجة جوه الجرح بتتحرك وبتطلع دم كتير من وقت ما قعدت
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] حاسس بوجع خفيف في رجلي اليمين من تحت وانا قاعد من امبارح الصبح ومش عارف ليه بتتنفخ شوية
- [library, ar, urgent, AI said unscreened, rules said ROUTE] الرجل اللي اتعملت فيها بقت سودا تقريبا من ورا، ومفيش احساس بالصوابع
- [library, ar, urgent, AI said unscreened, rules said ROUTE] بعد العملية جالي حاجة زي الغيبوبة وأنا قاعد مش فاكر أكلت ولا لأ
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] أبوي يمكن ما فيه شي بس وجهه صار مايل من جهة وايده ما يقدر يرفعها من الصبح
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] الرجل قاعدة تتنفخ من تحت الجبس الساعة كذا، وبتوجع بشكل ما اتحملهوش
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] احساس بالدوخة وخفقان قوي بالقلب، وكنت وقعت مرة لحالي في الحمام، بس أنا منيح
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] شعرت بوخز في الساق وتغير لون الجلد إلى الأزرق، ولكن ليس بالأمر المهم
- [library, ar, urgent, AI said unscreened, rules said ROUTE] ما قدرت اتحكم ببولي من الصبح، والمنطقة اللي تحت ظهري كأنها مو موجودة، بس يمكن من الدوا
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] ولاد عمي كان عندو جلطة، ويمكن يكون عندي شي زي هيك، ساقي متورمة وبوجع عند السمانة
- [library, ar, urgent, AI said unscreened, rules said ROUTE] ابغى اسال شي، اذا الواحد يحس بخدر بالجهة اليمين من جسمه وكلامه مو واضح يعني شي يقلق؟ بس انا تمام
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] انا بحس بكحة ومعايا ضيق في النفس لما اطلع السلم، والرجل اللي اتعملت فيها متورمة اوي
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] أختي بدها ترجع البيت بس يبدو عندها ضيقة نفس وصوتها متقطع، ما بعرف اذا لازم نروح الطوارئ
- [library, ar, urgent, AI said unscreened, rules said ROUTE] حاسة بتعب شديد وكانت البرازة سودة اليوم، يمكن من حبوب الحديد
- [library, ar, urgent, AI said unscreened, rules said ASK] امي تعبانة وتقول انها ما تتذكر وين حطت الجوال، وتكرر نفس السؤال كل شوي من امبارح
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] الجرح عم يطلع منه شي أصفر تخينة ريحتو مش حلوة وإجيني حرارة من الليل
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] الركبة ما تحملني ولا تكفي ولا شي، بس انا عندي الحين ضيق في الصدر ويعرق جبيني
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] الجرح على ظهري مفتوح من تحت وصار يطلع منه سوائل كثير ومنتن شوي، بس ما بوجعني كتير
- [library, ar, urgent, AI said unscreened, rules said ROUTE] هل من الطبيعي أن أشعر بدوخة وتعرق بارد بعد أن أخذت الدواء؟ أنا لست متأكدا
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] الجرح يلمع وبيطلع منه ريحة نتنة واستفرغت مرتين اليوم
- [library, ar, urgent, AI said unscreened, rules said ROUTE] انا خدت حتة كتير من الباندول والمسكن التاني علشان الوجع مش راضي يخف، من امبارح بالليل
- [library, ar, urgent, AI said unscreened, rules said ROUTE] ابويا بيقول عنده مغص شديد في البطن وكل ما يحاول يقعد بيتقيأ، ومش عاوز ياكل
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] أشعر بضيق شديد في التنفس منذ ساعتين مع ألم خفيف في الصدر، لكنني أعتقد أنه من المسكنات
- [library, ar, urgent, AI said unscreened, rules said ROUTE] الصدر عندي يخبط بقوة وفيني دوخة، لكن ما اظن انها مشكلة من العملية
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] أعاني من إحساس بالاختناق ليلا وأحيانا يتوقف نفسي لحظات، أتمنى ألا يكون شيئا خطيرا
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] انتفاخ رجلي زاد كتير والجبص صار ضيق وما عم احس بصوابع رجلي
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] عم اشعر بضيق قوي بالصدر لما احاول امشي حتى خطوتين، وبطلع عرق
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] الجبس فيه دم كثير ومنتشر من الصبح، وفكرت أستنى لين بكرة يمكن يوقف
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] عندي حرارة 39 من امبارح بس باراسيتامول نزلها، والمفصل فيه صديد شوي
- [library, ar, urgent, AI said unscreened, rules said ROUTE] الدم طالع من الجبس على الفراش، وانا تقريبا لابس دشداشة بيضا ومصبوغة كلها، بس ما فيه ألم
- [library, ar, urgent, AI said unscreened, rules said ROUTE] رجلي عم تبرد وصارت لونها غريب، وأصابعي مش قادر أحركها
- [library, ar, urgent, AI said unscreened, rules said ROUTE] الكتف فيه ورم جامد وطالع تحت الجلد هوا وصوت طقطقة لما ألمسه
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] انا بتقيء دم شوية من الصبح يا دكتور بس مش كتير، ومعدتي وجعاني
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] استيقظت اليوم وأنا لا أستطيع تحريك ساقي، وأشعر بأن جزءا منها ميت، ربما بسبب الجبيرة
- [library, ar, urgent, AI said unscreened, rules said ROUTE] بدي قلك اني بفكر ما عم بدي عيش هيك، الألم مش قادر احتمله
- [library, ar, urgent, AI said unscreened, rules said ROUTE] عندي مشكلة صغيرة ان البول بقى مش بيخرج خالص من امبارح، وبطني منتفخة
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] قبل ثلاثة أيام سافرت بالطائرة، ومنذ الصباح ساقي اليسرى منتفخة ومؤلمة عند السمانة، لكن هذا طبيعي بعد السفر أليس كذلك؟
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] أتقيأ منذ ثلاثة أيام، وفي براز لونه أسود، وأشعر بالتعب الشديد، ولكن لا أريد إزعاجكم
- [library, ar, urgent, AI said unscreened, rules said ROUTE] امي عم تحكي كلام مش مفهوم من امبارح وبتنسى اسمها، يمكن من البنج
- [library, ar, urgent, AI said unscreened, rules said ROUTE] انا اخدت حبة زيادة من المسكن امبارح عن غلط وحسيت بدوخة ومش عارف اذا كتير
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] الكتف بتاعي بيوجعني جامد ومش راضي يخف بالبروفين، والإيد اتنمل كلها من الصبح
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] أشعر بألم شديد في الصدر يمتد إلى الذراع الأيسر، ولكن ربما هو من الضغط النفسي
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] الجرح فتح شوي من الطرف وطالع منه سايل، ما هو كثير بس ما يوقف
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] انا عيانة اوي وعندي حمى وبتنفض، والصبح لقيت الجرح بيعرق صديد اصفر
- [library, ar, urgent, AI said unscreened, rules said ROUTE] ظهري يؤلمني بشدة ولا تفيد المسكنات، وأشعر بخدر في قدمي اليسرى يزداد، ولكن لا داعي للقلق
- [library, ar, urgent, AI said unscreened, rules said ROUTE] صاحبتي تقول ان وجهي مش متناسق بعد الدوا، وانا ما اقدر اغمض عيني اليمين
- [library, ar, urgent, AI said unscreened, rules said ROUTE] ما اعرف اذا هذا طبيعي بس الفخذين صار عندي تنميل كبير، وفي تنميل بالمنطقة اللي بين رجولي
- [library, ar, urgent, AI said unscreened, rules said ROUTE] ما قدرت اشرب ولا اكل وكل شوي اقيء، ومن امبارح ما تبولت
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said SAME-DAY] حاسس بقشعريرة وسخونية من امبارح، والمفصل بقى احمر ومتنفخ جامد
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] صاحبي كان بيقول انو الركبة ما تحتملش، بس انا احس بوجع في الصدر وخفقان لما اعمل حركة
- [library, ar, urgent, AI said unscreened, rules said ROUTE] ولدي اهتز جسمه كله وعينه تفتح وتقفل ونام بعدها، الحين عادي؟
- [library, ar, urgent, AI said unscreened (second check unavailable), rules said EMERGENCY] ساقي بتطلع منها حرقة وحمرة وحرارة زي الفرن، وبيدي جنب الجرح صديد، بس بخاف يكون شي كبير

### Emergencies still missed after rules + AI check (0)

- none

### Other urgent messages still missed (43)

- [library, ms] Tak ada sakit dada, tapi nafas makin pendek bila jalan ke bilik air  (AI check unavailable)
- [library, zh] 我没有胸痛，但是呼吸越来越急，走两步就喘  (AI check unavailable)
- [library, zh] 我觉得脚底下麻麻的，好像没知觉，已经一整天了  (AI check unavailable)
- [library, en] I had surgery on my back and now when I cough I feel like something goes down my legs like electric and my right leg just gave way when i tried to walk.  (AI check unavailable)
- [library, ms] air kencing dia warna macam teh pekat dan dia mengantuk sangat, asyik nak tidur je. op lutut 4 hari lepas  (AI check unavailable)
- [library, en] i keep getting dizzy and thinking of ending it all. surgery was pain, now i just dont see the point. sorry  (AI check unavailable)
- [library, zh] 我的腰以下完全没感觉，但是上面一直在出汗，这个正常吗？  (AI check unavailable)
- [library, en] Came back from Dubai last night, 11hr flight. Right leg below knee is fat and warm to touch and kind of hurts when I point my toes. Probably just from sitting. Knee replacement 3 wks ago.  (AI check unavailable)
- [library, en] Doctor the toilet thing again. Nothing coming out since Tuesday and my legs feel like someone put sandbags on them. Back surgery was 4 days ago.  (AI check unavailable)
- [library, zh] 我条腿冇力，行唔到路，屎都唔出得，开完腰三日。  (AI check unavailable)
- [library, en] pls help. my mum keep saying she dunno who i am and talking to the wall. she was fine after the hip op yesterday  (AI check unavailable)
- [library, ms] kepala pening, muntah dua kali, nampak double. Op tulang belakang seminggu lepas, mungkin dah biasa kot  (AI check unavailable)
- [library, en] Feeling a bit off, heart going like a drum even when I rest. Shoulder op 3 days. Doctor said it's nothing usually.  (AI check unavailable)
- [library, zh] 可能没事，但昨天开始尿是深红色的，像可乐，而且好累。膝盖手术一个礼拜。  (AI check unavailable)
- [library, en] I've been peeing loads and so thirsty since the op, sugar reads really high on the machine, probably nothing but I'm not diabetic  (AI check unavailable)
- [library, en] the drain bottle got like pure red blood now, like half full in 2 hours. i dunno if thats normal ah  (AI check unavailable)
- [library, ms] kaki yang dibalut tu dah bertukar biru dan sejuk, saya tak boleh rasa jari  (AI check unavailable)
- [library, ms] boleh tolong? sy makan ubat tidur 20 biji sebab tak boleh tidur, sakit kaki tak hilang  (AI check unavailable)
- [library, ar] الوجع ما يخف حتى بالمورفين اللي عطوني، وقعدت اصرخ امبارح ساعتين  (AI check unavailable)
- [library, ar] الوش والبق بتاعي اتنفخ شوية بعد الحقنة اللي ادوني، واللسان حاسس بيه تقيل  (AI check unavailable)
- [library, ar] انا حاسس ان في حاجة جوه الجرح بتتحرك وبتطلع دم كتير من وقت ما قعدت  (AI check unavailable)
- [library, ar] الرجل اللي اتعملت فيها بقت سودا تقريبا من ورا، ومفيش احساس بالصوابع  (AI check unavailable)
- [library, ar] بعد العملية جالي حاجة زي الغيبوبة وأنا قاعد مش فاكر أكلت ولا لأ  (AI check unavailable)
- [library, ar] ما قدرت اتحكم ببولي من الصبح، والمنطقة اللي تحت ظهري كأنها مو موجودة، بس يمكن من الدوا  (AI check unavailable)
- [library, ar] ابغى اسال شي، اذا الواحد يحس بخدر بالجهة اليمين من جسمه وكلامه مو واضح يعني شي يقلق؟ بس انا تمام  (AI check unavailable)
- [library, ar] حاسة بتعب شديد وكانت البرازة سودة اليوم، يمكن من حبوب الحديد  (AI check unavailable)
- [library, ar] امي تعبانة وتقول انها ما تتذكر وين حطت الجوال، وتكرر نفس السؤال كل شوي من امبارح  (AI check unavailable)
- [library, ar] هل من الطبيعي أن أشعر بدوخة وتعرق بارد بعد أن أخذت الدواء؟ أنا لست متأكدا  (AI check unavailable)
- [library, ar] انا خدت حتة كتير من الباندول والمسكن التاني علشان الوجع مش راضي يخف، من امبارح بالليل  (AI check unavailable)
- [library, ar] ابويا بيقول عنده مغص شديد في البطن وكل ما يحاول يقعد بيتقيأ، ومش عاوز ياكل  (AI check unavailable)
- [library, ar] الصدر عندي يخبط بقوة وفيني دوخة، لكن ما اظن انها مشكلة من العملية  (AI check unavailable)
- [library, ar] الدم طالع من الجبس على الفراش، وانا تقريبا لابس دشداشة بيضا ومصبوغة كلها، بس ما فيه ألم  (AI check unavailable)
- [library, ar] رجلي عم تبرد وصارت لونها غريب، وأصابعي مش قادر أحركها  (AI check unavailable)
- [library, ar] الكتف فيه ورم جامد وطالع تحت الجلد هوا وصوت طقطقة لما ألمسه  (AI check unavailable)
- [library, ar] بدي قلك اني بفكر ما عم بدي عيش هيك، الألم مش قادر احتمله  (AI check unavailable)
- [library, ar] عندي مشكلة صغيرة ان البول بقى مش بيخرج خالص من امبارح، وبطني منتفخة  (AI check unavailable)
- [library, ar] امي عم تحكي كلام مش مفهوم من امبارح وبتنسى اسمها، يمكن من البنج  (AI check unavailable)
- [library, ar] انا اخدت حبة زيادة من المسكن امبارح عن غلط وحسيت بدوخة ومش عارف اذا كتير  (AI check unavailable)
- [library, ar] ظهري يؤلمني بشدة ولا تفيد المسكنات، وأشعر بخدر في قدمي اليسرى يزداد، ولكن لا داعي للقلق  (AI check unavailable)
- [library, ar] صاحبتي تقول ان وجهي مش متناسق بعد الدوا، وانا ما اقدر اغمض عيني اليمين  (AI check unavailable)
- [library, ar] ما اعرف اذا هذا طبيعي بس الفخذين صار عندي تنميل كبير، وفي تنميل بالمنطقة اللي بين رجولي  (AI check unavailable)
- [library, ar] ما قدرت اشرب ولا اكل وكل شوي اقيء، ومن امبارح ما تبولت  (AI check unavailable)
- [library, ar] ولدي اهتز جسمه كله وعينه تفتح وتقفل ونام بعدها، الحين عادي؟  (AI check unavailable)

### Ordinary messages the AI check raised (3)

- [h1, en] is it normal to get a fever after knee surgery?
- [h1, zh] 手术后发烧正常吗？
- [h2, ms] apa perlu saya bawa ke hospital

Written: app\eval\model_run_2026-11-12_deepseek-chat.md and .json