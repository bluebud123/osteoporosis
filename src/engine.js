/* PeriLoop engine: deterministic, no model calls. All clinical thresholds are DRAFTS for surgeon sign-off. */
(function (root) {
  'use strict';
  const H = 1, D = 24;
  const CFG = { rePingEvery: 1 * H, rePingCap: 3, nudgeEvery: 24 * H, nudgeCap: 3, unackedHoldHrs: 48, atRiskBeforeSurgeryHrs: 24, nextLevelEvery: 2 * H };
  // round 6 (review3 M4): after the on-call fallback an unacknowledged alert keeps moving up. Each step is paged every nextLevelEvery hours
  // until someone acknowledges it. The last step repeats. Nothing stops silently.
  const NEXT_LEVELS = [{ to: 'ward_incharge', label: 'ward in-charge' }, { to: 'director_oncall', label: 'director on-call' }];
  const THRESH = { Hb: { lt: 10.0, unit: 'g/dL' }, HbA1c: { ge: 8.0, unit: '%' } }; // draft
  const PRIORITY = { EMERGENCY: 3, 'SAME-DAY': 2, ROUTE: 1 };

  /* ---------- protocol packs: data, not code ---------- */
  const SHARED = [
    { key: 'consent', title: 'Consent and surgical plan confirmed', owner: 'surgeon', due: -14, kind: 'review' },
    { key: 'bloods', title: 'Pre-op bloods (Hb, HbA1c) reviewed', owner: 'preop_nurse', due: -14, kind: 'screen', blocking: true },
    { key: 'ecg', title: 'ECG and anaesthetic review', owner: 'preop_nurse', due: -10, kind: 'appt' },
    { key: 'mrsa', title: 'MRSA screen result actioned', owner: 'preop_nurse', due: -10, kind: 'screen' },
    { key: 'preauth', title: 'Insurance pre-authorisation obtained', owner: 'admin', due: -10, kind: 'admin', note: 'Abu Dhabi: elective inpatient care generally needs payer approval' },
    { key: 'anticoag', title: 'Blood-thinner stop/restart plan told to patient', owner: 'preop_nurse', due: -8, kind: 'med' },
    { key: 'fasting', title: 'Fasting and medication briefing acknowledged', owner: 'preop_nurse', due: -2, kind: 'brief' },
    { key: 'vte', title: 'VTE prophylaxis taken as prescribed', owner: 'ward_nurse', due: 1, kind: 'med' },
    { key: 'wound', title: 'Wound care taught back correctly', owner: 'ward_nurse', due: 2, kind: 'teachback' },
    { key: 'redflags', title: 'Red flags taught back correctly', owner: 'ward_nurse', due: 2, kind: 'teachback' },
    { key: 'physio', title: 'Physiotherapy plan under way', owner: 'physio', due: 3, kind: 'physio' },
    { key: 'followup', title: 'Follow-up visit booked and attended', owner: 'clinic_coordinator', due: 14, kind: 'appt' }
  ];
  const RE = {
    cauda: /wet (myself|the bed|my pants)|(peed|pee'?d) (the )?bed|(can'?t|cannot|unable to) (control|hold).{0,12}(pee|urine|bladder|bowel)|terkencing|terkucil|tak dapat tahan kencing|控制不住小便|漏尿|尿失禁|(bum|bottom|bontot|punggung|private|inner thigh|between (her|his|my) legs|celah paha|裆|会阴|屁股).{0,40}(numb|no feeling|dead|kebas|没有知觉|麻木|没感觉)|(numb|no feeling|kebas|没有知觉|一点感觉都没有).{0,40}(bum|bottom|private|inner thigh|between (her|his|my) legs|celah paha|裆|会阴|屁股)|(leaked|leaking|lost control of).{0,15}(urine|bladder|bowel|stool)|(can'?t|cannot|unable to).{0,25}(feel|pass).{0,25}(urine|pee|bladder)|(numb|numbness).{0,30}(bottom|groin|saddle|buttock|perineum)|(bottom|saddle|groin).{0,20}numb|urinary retention|tak boleh kencing|会阴麻木|大小便失禁/,
    neurovasc: /((toes?|fingers?|foot|feet|hand|arm|jari|手指|脚趾|脚|手).{0,45}(purple|grey|gray|putih|ungu|紫|青|变白|白|dingin|冰凉|冷冰冰|won'?t move|cannot move|tak boleh gerak|动不了|没知觉|没感觉))|((purple|grey|gray|putih|ungu|dingin|紫|冰凉).{0,20}(toes?|fingers?|jari|手指|脚趾))|((toes?|fingers?|foot|hand|jari).{0,40}(cold|blue|pale|white|dusky|sejuk|biru|冷|发紫|苍白))|((cold|blue|pale|sejuk|biru).{0,20}(toes?|fingers?|jari))/,
    numb: /numb|can'?t feel|no feeling|kebas|麻木|没有感觉/
  };
  const PACKS = {
    TKR: { label: 'Total knee replacement', extra: [{ key: 'knee_rom', title: 'Knee bend measured at clinic', owner: 'physio', due: 14, kind: 'review' }, { key: 'dvt_teach', title: 'Calf pain/swelling red flag taught', owner: 'ward_nurse', due: 2, kind: 'teachback' }], faq: ['shower', 'bruising', 'low_temp', 'drive_knee'], redFlags: [] },
    THR: { label: 'Total hip replacement', extra: [{ key: 'hip_prec', title: 'Hip precautions taught back', owner: 'physio', due: 2, kind: 'teachback' }, { key: 'dvt_teach', title: 'Calf pain/swelling red flag taught', owner: 'ward_nurse', due: 2, kind: 'teachback' }], faq: ['shower', 'bruising', 'low_temp'], redFlags: [] },
    ACL: { label: 'ACL reconstruction', extra: [{ key: 'brace', title: 'Brace fitted and use explained', owner: 'physio', due: 1, kind: 'brief' }, { key: 'rtd', title: 'Return-to-driving guidance given', owner: 'physio', due: 7, kind: 'brief' }], faq: ['shower', 'drive_acl', 'bruising', 'low_temp'], redFlags: [] },
    LUMBAR: { label: 'Lumbar decompression / fusion', extra: [{ key: 'cauda', title: 'Cauda equina red flags taught back', owner: 'ward_nurse', due: 1, kind: 'teachback' }, { key: 'log_roll', title: 'Spinal precautions taught', owner: 'physio', due: 1, kind: 'brief' }], faq: ['shower', 'low_temp'], redFlags: [{ id: 'cauda_equina', re: RE.cauda, label: 'Possible cauda equina' }] },
    SHOULDER: { label: 'Shoulder arthroscopy / cuff repair', extra: [{ key: 'sling', title: 'Sling use and finger circulation taught back', owner: 'ward_nurse', due: 1, kind: 'teachback' }, { key: 'sh_physio', title: 'Passive range exercises started', owner: 'physio', due: 3, kind: 'physio' }], faq: ['shower', 'low_temp', 'bruising'], redFlags: [] },
    FOOTANKLE: { label: 'Foot and ankle (e.g. hallux valgus)', extra: [{ key: 'elev', title: 'Elevation and dressing tightness taught', owner: 'ward_nurse', due: 1, kind: 'teachback' }, { key: 'wb', title: 'Weight-bearing limits taught', owner: 'physio', due: 1, kind: 'brief' }], faq: ['shower', 'low_temp'], redFlags: [] }
  };
  const FAQ = {
    shower: { re: /shower|\bmandi\b|bath|洗澡/, ans: { en: 'You may shower once the clinic\'s waterproof dressing is intact and dry-edged; keep water off an unprotected wound. (Draft text, clinic to approve.)', ms: 'Anda boleh mandi jika balutan kalis air masih utuh; elakkan air pada luka yang tidak dilindungi. (Teks draf, klinik perlu lulus.)', zh: '防水敷料完好时可以淋浴；未覆盖的伤口请勿沾水。（草稿，需诊所批准。）' }, needs: /waterproof|kalis air|防水/ },
    bruising: { re: /bruis|lebam|淤青|瘀/, ans: { en: 'Bruising that spreads down the limb is common in the first two weeks. (Draft text.)', ms: 'Lebam yang merebak ke bawah adalah biasa dalam dua minggu pertama. (Draf.)', zh: '术后两周内瘀青向下扩散很常见。（草稿）' } },
    low_temp: { re: /temp(erature)?\s*(is|:)?\s*3[67](\.\d)?|suhu\s*3[67]/, ans: { en: 'A temperature under 38.0 C is common in the first 48 hours. Recheck in 4 hours and contact us if it reaches 38.0 C or more. (Draft threshold, hospital to confirm.)', ms: 'Suhu di bawah 38.0 C biasa dalam 48 jam pertama. Semak semula dalam 4 jam. (Draf.)', zh: '术后48小时内体温低于38.0度较常见，4小时后再测。（草稿）' } },
    drive_acl: { re: /\bdrive\b|driving|memandu|开车/, ans: { en: 'Driving after ACL reconstruction depends on the leg operated and your control of the pedals; your physio will confirm. (Draft text.)', ms: 'Memandu bergantung pada kaki yang dibedah; fisioterapi akan sahkan. (Draf.)', zh: '能否开车取决于手术侧和踏板控制，由物理治疗师确认。（草稿）' } },
    drive_knee: { re: /\bdrive\b|driving|memandu|开车/, ans: { en: 'Driving guidance after knee replacement comes from your surgeon at your review. (Draft text.)', ms: 'Panduan memandu diberi oleh pakar bedah. (Draf.)', zh: '开车指引由外科医生在复诊时给出。（草稿）' } }
  };
  const T = {
    EMERGENCY: { en: 'This may be an emergency. Call emergency services (999/998) or go to the nearest emergency department now. Our team has been alerted.', ms: 'Ini mungkin kecemasan. Hubungi perkhidmatan kecemasan atau ke jabatan kecemasan terdekat sekarang. Pasukan kami telah dimaklumkan.', zh: '这可能是紧急情况。请立即拨打急救电话或前往最近的急诊部。我们的团队已收到通知。' },
    'SAME-DAY': { en: 'This needs a clinician to review you today. Our team has been alerted and will contact you. If it gets worse, go to the emergency department.', ms: 'Ini perlu disemak oleh doktor hari ini. Pasukan kami telah dimaklumkan. Jika bertambah teruk, ke jabatan kecemasan.', zh: '这需要医生今天为您检查。我们的团队已收到通知并会联系您。若加重请前往急诊。' },
    ROUTE: { en: 'A clinician will reply to you. We cannot answer this one automatically.', ms: 'Doktor akan membalas anda. Kami tidak boleh menjawab soalan ini secara automatik.', zh: '医生会回复您。此问题无法自动回答。' },
    ASK: { en: 'Can you tell us what is not good: pain, the wound, breathing, leg swelling, or fever? If you are short of breath or have chest pain, call emergency services now.', ms: 'Boleh beritahu apa yang tidak elok: sakit, luka, pernafasan, kaki bengkak atau demam? Jika sesak nafas atau sakit dada, hubungi kecemasan sekarang.', zh: '请告诉我们哪里不舒服：疼痛、伤口、呼吸、腿肿还是发烧？若气促或胸痛请立即呼叫急救。' }
  };

  /* ---------- text helpers ---------- */
  function lang(t) { if (/[一-鿿]/.test(t)) return 'zh'; const m = (t.toLowerCase().match(/\b(saya|kaki|luka|bila|boleh|dan|sakit|yang|betis|bengkak|sejak|semalam|ada|tidak|mandi|balutan)\b/g) || []).length; return m >= 2 ? 'ms' : 'en'; }
  const NEG = /(\bno\b|\bnot\b|\bwithout\b|\bnor\b|\bnil\b|tiada|tidak|tak ada|takde|没有|沒有|无)[^.;,]{0,12}$/;
  // round 6: a Chinese negation directly in front of the finding (不是中风, 不闷, 没痛) also negates it
  const ADJ_NEG_RE = /(不是|没有|沒有|没|不|唔|冇|无|無)$/;
  function pos(text, re) { const g = new RegExp(re.source, 'g' + (re.flags || '').replace('g', '')); let m; while ((m = g.exec(text))) { const before = text.slice(Math.max(0, m.index - 16), m.index); const tail = m.index + m[0].length - 6; const before2 = text.slice(Math.max(0, tail - 12), Math.max(0, tail));
    if (!NEG.test(before) && !NEG.test(before2) && !ADJ_NEG_RE.test(before)) return true; if (m[0] === '') g.lastIndex++; } return false; }
  function temp(text) { const m = text.match(/(?:temp(?:erature)?|suhu|体温|fever|demam)\D{0,12}(3\d(?:\.\d)?|4[0-2](?:\.\d)?)/); return m ? parseFloat(m[1]) : null; }

  /* ---------- round 4 (review2 B1): urgent vocabulary. ADDED only. Every rule goes through pos(), so negation still applies
     ("no chest pain" and "no black stools" do not trigger). Ms and zh wording is a machine draft pending native review. ---------- */
  const SELF_HARM_RE = /suicid\w*|kill (my ?self|myself)|killing myself|end (my|your) life|ending my life|take my own life|want to die|wanna die|want to be dead|(don'?t|do not) want to (live|be alive)|want to hurt (my ?self|myself)|hurt (my ?self|myself) on purpose|self[- ]harm\w*|bunuh diri|nak mati|mahu mati|tak nak hidup|tidak mahu hidup|cederakan diri|想死|不想活|想自杀|自杀|轻生|结束生命|结束自己的生命|伤害自己/;
  const SELF_HARM_RAW_RE = /(tidak|tak) (mahu|nak) hidup|(don'?t|do not) want to (live|be alive)|不想活/;
  const SELF_HARM_REPLY = {
    en: 'Please contact emergency services now (999 in Malaysia), or go to a trusted person who can be with you right now. Do not wait.',
    ms: 'Sila hubungi perkhidmatan kecemasan sekarang (999), atau pergi kepada orang yang dipercayai yang boleh bersama anda sekarang. Jangan tunggu.',
    zh: '请立即拨打急救电话（马来西亚999），或马上找一位可信任的人，请对方现在陪伴您。请不要等待。'
  };
  const URGENT = [
    { label: 'stroke signs: slurred or lost speech', raw: true, re: /(bercakap|cakap)[^.;]{0,12}(tidak|tak) jelas/ },
    { label: 'stroke signs: face drooping', re: /(face|facial|mouth|muka|mulut|脸|嘴)[^.;]{0,25}(droop\w*|lopsided|crooked|senget|歪|下垂)|droop\w*[^.;]{0,20}(face|one side|side of|sebelah)|muka[^.;]{0,10}sebelah/ },
    { label: 'stroke signs: slurred or lost speech', re: /slur\w*|(can'?t|cannot|unable to) (speak|talk) (properly|clearly|right)|speech[^.;]{0,12}(strange|weird|garbled|gone)|cakap[^.;]{0,8}pelat|说话[^。.;]{0,6}(不清|含糊)|口齿不清|言语不清|讲话不清/ },
    { label: 'stroke signs: sudden severe headache', re: /(sudden\w*|thunderclap|worst|severe|very (bad|severe|painful)|terrible|tiba-tiba|sangat teruk|teruk|突然|剧烈|严重|最严重)[^.;]{0,25}(headache|head pain|sakit kepala|头痛|头疼)|(headache|head pain|sakit kepala|头痛|头疼)[^.;]{0,25}(sudden\w*|worst|severe|very bad|terrible|came on suddenly|tiba-tiba|teruk|突然|剧烈|严重|最严重)/ },
    { label: 'possible stroke', re: /\b(having|had|think i'?m having|might be having|possibly having|is having|suspect) (a |an )?stroke\b|\bstroke\b[^.;]{0,15}(now|today|just now|right now|sign|symptom)|strok (kepala|otak)|(?<!不是|不|没有|没|唔|冇)中风|(?<!不是|不|没有|没|唔|冇)脑卒中|(?<!不是|不|没有|没|唔|冇)脑中风/ },
    { label: 'seizure, fit or convulsion', re: /seizure|convuls\w*|epilep\w*|had (a |an )?fit\b|\bfit\b[^.;]{0,20}(shak\w*|jerk\w*|convuls\w*)|shak\w* all over|jerk\w* all over|sawan|kejang|抽搐|癫痫|羊癫疯|惊厥|痉挛|抽风/ },
    { label: 'fainting, collapse or blackout', re: /fainted|fainting|\bi (feel|felt|am|got|nearly|almost|was) (going to )?faint\b|pass(ed|ing)? out|going to pass out|black(ed|ing)? out|collaps\w*|everything[^.;]{0,12}(grey|gray|black|dark|fading)|going (grey|gray)|vision[^.;]{0,10}(grey|gray|black)|pengsan|pitam|晕倒|昏倒|晕厥|昏厥|晕过去|昏过去|休克|眼前发黑|眼前一黑|pandangan (jadi )?gelap/ },
    { label: 'vomiting blood', re: /(vomit\w*|throw\w* up|threw up|muntah)\s*(some |a lot of |lots of |a bit of |fresh |bright red |dark |sedikit |banyak |sikit )?(blood|darah)|呕血|吐血|吐了血|呕出血/ },
    { label: 'black tarry stool', re: /black(ish)?\s*(tarry\s*|sticky\s*|tar[- ]like\s*)?(stool|stools|poo|poos|faeces|feces|motions?|bowel motions?)|tarry (stool|stools|poo)|melena|tar[- ]like (stool|poo)|(stool|stools|poo|poos|bowel motions?)[^.;]{0,12}(black|tarry)|najis hitam|tahi hitam|黑便|黑色大便|柏油样|大便[^.;]{0,6}(发黑|黑色)/ },
    { label: 'throat closing or lip/tongue swelling (possible anaphylaxis)', re: /throat[^.;]{0,25}(clos(ing|ed|es)|shut|tighten\w*)|(clos(ing|ed)|shut|tighten\w*)( up)?[^.;]{0,6}(my |the |his |her )?throat|tekak[^.;]{0,15}(tertutup|menyempit)|喉咙[^。.;]{0,8}(闭|堵|紧)|(lip|lips|tongue|bibir|lidah|嘴唇|舌头)[^.;]{0,12}((swell|swoll)\w*|bengkak|肿)|((swell|swoll)\w*|bengkak|肿)[^.;]{0,10}(lip|lips|tongue|bibir|lidah|嘴唇|舌头)|anaphyla\w*|anafilaksis|过敏性休克|严重过敏/ },
    { label: 'hives or rash with swelling or breathing trouble (possible anaphylaxis)', re: /(rash|ruam|hives|urticaria|welts|bintat|kaligata|皮疹|荨麻疹|风团)[^.;]{0,40}(breath|nafas|呼吸|(swell|swoll)\w*|bengkak|肿)|(breath\w*|nafas|呼吸)[^.;]{0,40}(rash|ruam|hives|皮疹|荨麻疹)/ },
    { label: 'heavy bleeding that will not stop', raw: true, re: /bleed\w*[^.;]{0,20}(won'?t|will not|doesn'?t|does not) stop|(blood|darah|血)[^.;]{0,20}(won'?t stop|will not stop|tak berhenti|tidak berhenti)|(darah|blood)[^.;]{0,20}(tidak berhenti|tak berhenti)/ },
    { label: 'possible overdose', re: /overdos\w*|overdosis|terlebih dos|dos berlebihan|过量|服药过量|误服|吃多了药|药吃多了|吃了太多(药|片)|took [^.;]{0,20}(extra|double|too many|lots of|a lot of|all of|the whole|more than)[^.;]{0,25}(tablets?|pills?|paracetamol|panadol|medicin\w*|tabs?|capsules?|doses?)|took [^.;]{0,25}(tablets?|pills?|paracetamol|panadol|medicin\w*)[^.;]{0,10}by mistake|too many (tablets?|pills?|tabs?|paracetamol|panadol|capsules?)|makan (banyak |terlalu banyak |berlebihan )?ubat(an)? (berlebihan|terlalu banyak)|ubat (berlebihan|terlalu banyak)/ },
    { label: 'heavy bleeding that will not stop', re: /(heavy|severe|profuse|lots of|a lot of|banyak|teruk|大量|很多|严重)\s*(bleed\w*|berdarah|出血|流血)|darah (banyak|mencurah|tak henti)|banyak (darah|berdarah)|(soak\w*|drench\w*|lencun|湿透|浸透|全是血|血浸)[^.;]{0,25}(dressing|bandage|plaster|gauze|cast|balutan|sapu|纱布|敷料|绷带|石膏)|(dressing|bandage|balutan|plaster|gauze|sapu|纱布|敷料|绷带)[^.;]{0,30}(soak\w*|soaked|drench\w*|lencun|湿透|浸透|浸湿|全湿|渗透|全是血)|(won'?t|will not|doesn'?t|does not|can'?t|cannot) stop bleeding|tak henti (berdarah|darah)|止不住血|血止不住|流血不止|出血不止/ },
    { label: 'breathlessness', re: /\bshortn?e?s+ of bre\w*|\bshortnes\w*|\bbreth\w*|\bbreath\w*[^.;]{0,12}\bshort\b/ }
  ];
  /* ---------- round 6 (review3 B1-B6): urgent vocabulary. ADDED only; nothing above is loosened. Every rule goes through pos(),
     so "no chest pain", "tiada sakit dada" and "冇咩反应" still do not trigger. Subject-dependent rules (collapse, no reaction) need
     a person word (he, she, pesakit, 佢 ...) in the same clause, so a dropped pen or a medicine with no effect is not an emergency.
     Ms and zh wording is a machine draft pending native review. ---------- */
  const SUBJ6 = '(?:\\b(?:he|she|they|him|her|dia|beliau|pesakit|patient|husband|wife|father|mother|dad|mum|mom|someone|somebody|bapa|ibu|suami|isteri|orang tua)\\b|佢|他|她|老公|老婆|父亲|母亲|爸爸|妈妈|病人)';
  const CARD_LOC6 = '(?:chest|dada|jaw|rahang|left arm|lengan kiri|left shoulder|下巴|颌|左手|左臂|胸|胸口|心口|心脏)';
  const CARD_PAIN6 = '(?:pain|sakit|痛|ache|aching|hurts?|pressure|tight|tightness|squeez\\w*|elephant|gajah|压|闷)';
  const SWEAT6 = '(?:sweat\\w*|berpeluh|peluh|冒汗|出汗|冷汗|流汗|湿透|汗)';
  const URGENT6 = [
    { label: 'breathlessness', re: /难透气|唔透气|透唔到气|透不过气|透唔过气|喘唔过气|呼吸唔顺|难呼吸|呼吸(很|太|好|十分|非常)?困难|呼吸(很|太)?急|气促|hard to breathe|hard time breathing|struggling to breathe|difficulty breathing|tak boleh bernafas|susah bernafas|sukar bernafas|nafas pendek|tercungap|termengah|tak cukup nafas|tidak cukup nafas|tak cukup udara/ },
    { label: 'blue or purple lips (cyanosis)', re: /(lips?|tongue|nails?|bibir|lidah|kuku|唇|嘴唇|嘴巴|舌头|指甲)[^.;。，,]{0,14}(blue|purple|grey|gray|dusky|biru|ungu|紫|青|灰)|(blue|purple|biru|ungu|青紫|kebiruan)[^.;。，,]{0,6}(lips?|bibir|唇|嘴唇|舌头)|唇[^。.;]{0,6}(紫|青|灰)|嘴唇[^。.;]{0,6}(紫|青|灰)/ },
    { label: 'chest pressure, possible heart attack', re: new RegExp('elephant[^.;。]{0,30}(chest|sitting|sit\\b|on (my|it|me|top)|heavy|stand)|(chest|dada|胸|胸口|心口)[^.;。]{0,25}elephant|gajah[^.;。]{0,25}(dada|duduk|atas|berat)|(dada|chest)[^.;。]{0,25}gajah|大象[^。.;]{0,10}(坐|压|踩)|(胸|胸口|心口)[^。.;]{0,8}(压住|压着|压迫|像有东西压|好像有东西压|像被压|好重)|(像有|好似有|好像有)[^。.;]{0,6}(东西|人|重物)[^。.;]{0,4}(坐|压)[^。.;]{0,4}(胸|心口|胸口)|chest pressure|pressure in (my |the )?chest|tekanan dada') },
    { label: 'chest, arm or jaw pain with sweating (possible heart attack)', re: new RegExp(CARD_LOC6 + '[^.;。]{0,40}' + CARD_PAIN6 + '[^.;。]{0,60}' + SWEAT6 + '|' + SWEAT6 + '[^.;。]{0,60}' + CARD_LOC6 + '[^.;。]{0,40}' + CARD_PAIN6, 'i') },
    { label: 'collapse, unresponsive or no reaction', raw: true, re: new RegExp(SUBJ6 + '[^.;。]{0,30}(no reaction|not reacting|not responding|no response|did not respond|does not respond|tidak respon|tiada respon|tak respon|冇反应|没有反应|没反应|无反应|不醒|唔醒|叫唔醒|叫不醒|won\'?t wake|can\'?t wake|cannot wake|not waking|unconscious)|' + SUBJ6 + '[^.;。]{0,40}(found|lying|lay|collapsed|fell|rebah|jatuh|倒|ditemui|dijumpai|terbaring)[^.;。]{0,25}(floor|ground|toilet|bathroom|bilik air|lantai|tandas|厕所|浴室|洗手间|地上|地板|倒)') },
    { label: 'collapse, unresponsive or no reaction', re: /\brebah\b|jatuh rebah|tidak bertindak balas|tak bertindak balas|tak sedarkan diri|tidak sedarkan diri|unresponsive|不省人事|失去意识|昏迷|突然倒|突然跌|倒低|倒地|倒在地|叫唔醒|叫不醒/ },
    { label: 'possible overdose', re: new RegExp('(食|吃|服|吞|饮|喝)[咗了过]?[^。.;]{0,20}(药|止痛药|片|丸|粒|颗)[^。.;]{0,14}(\\d{2,}|十几|几十|[二三四五六七八九十百]+|很多|好多|成日|大量|全部|一堆)\\s*(粒|片|颗|丸|包|瓶|次)|(食|吃|服|吞|饮|喝)[咗了过]?(成日|好多|很多|大量|全部|一堆)[^。.;]{0,8}(药|止痛药|片|丸)|(食|吃|服)[咗了过]?[^。.;]{0,20}(药|止痛药)[^。.;]{0,20}(眼瞓|眼困|瞓晒|昏睡)|(食|吃|服|吞|饮|喝)[咗了过]?(\\d{2,}|十几|几十|[二三四五六七八九十百]+)\\s*(粒|片|颗|丸|包|瓶)|makan (banyak|berbelas|puluhan|sebanyak|dua puluh|tiga puluh|\\d{2,})\\b[^.;]{0,12}(ubat|biji|butir|tablet|pil|paracetamol|panadol)|(telan|ambil|makan|teguk) (\\d{2,}|dua puluh|tiga puluh|berbelas|puluhan)\\s*(biji|butir|tablet|pil|paracetamol|panadol)|(makan|telan|ambil) (ubat|pil|paracetamol|panadol)\\s*(\\d{2,})\\s*(biji|butir|tablet)|(ubat|pil|tablet|paracetamol|panadol)[^.;]{0,10}(berlebihan|terlalu banyak)|(makan|telan|ambil) (ubat|pil|paracetamol|panadol)[^.;]{0,25}(banyak-banyak|banyak sekali)|(telan|ambil|makan) (terlalu banyak|berlebihan|banyak)\\b[^.;]{0,6}(ubat|pil|tablet|paracetamol|panadol)|(makan|telan|ambil)[^.;]{0,20}(ubat|pil)[^.;]{0,20}(mengantuk|khayal)|(took|taken|swallowed|ate|eaten)\\s+(about |around |over |nearly |like |maybe |almost )?(\\d{2,}|twenty|thirty|forty|fifty|dozens?|many|several|a handful|lots|a lot)\\b[^.;]{0,15}(tablets?|pills?|painkillers?|paracetamol|panadol|capsules?|tabs?)|(took|taken|swallowed)[^.;]{0,25}(tablets?|pills?|painkillers?|medicines?)[^.;]{0,20}(sleepy|drowsy|drowsiness)|(took|taken|swallowed|swallow)[^.;]{0,15}(whole|entire) (bottle|packet|box|strip)', 'i') },
    { label: 'bladder or bowel control lost, or saddle numbness', re: /尿[^。.;]{0,4}(唔受控|不受控|控制唔|控制不住|失禁)|(唔受控制|不受控制|控制唔到|控制不住)[^。.;]{0,4}(尿|屎|大便|小便|屁)|(大小便|屎尿|尿|屎|大便|小便)[^。.;]{0,6}(唔受控|不受控|失禁|控制唔|控制不住)|(屁股|屁|肛门|会阴|鞍区|私处|大腿内侧|尾骨|腚|臀|大腿根)[^。.;]{0,20}(麻麻哋|麻麻地|麻木|冇知觉|无知觉|没知觉|没有知觉|冇感觉|无感觉|没感觉|没有感觉|(?<![唔不没冇无])麻)|(lost|losing|no) control (of|over) (my |the )?(bladder|bowels?|bowel|urine|pee|wee|poo)|(can'?t|cannot|unable to) (control|hold) (my )?(bladder|bowels?|pee|wee|poo|urine)|(numb|numbness|no feeling|pins and needles)[^.;]{0,25}(saddle|crotch|groin|bum|bottom|butt|buttock|perineum|between (my |the )?legs|anus)|(hilang|tiada|tak ada|tidak ada) kawalan (pundi kencing|usus|air kencing|najis|kencing|berak)|tak boleh (kawal|tahan) (kencing|berak|najis)|(kebas|tidak ada rasa|tiada rasa)[^.;]{0,25}(punggung|celah paha|alat sulit|dubur|bontot)|(punggung|celah paha|alat sulit|dubur|bontot)[^.;]{0,25}(kebas|tiada rasa|tidak ada rasa)|(kencing|berak|najis|air kencing)[^.;]{0,8}(tidak|tak) terkawal|tidak terkawal|(tidak|tak) dapat (kawal|tahan|ditahan|dikawal)|tak boleh (kawal|tahan)|kencing tanpa sedar/i }
  ];
  const ARM_WEAK_RE = /(arm|hand|lengan|tangan|手臂|手|臂)[^.;]{0,30}(weak\w*|numb\w*|can'?t lift|cannot lift|can'?t move|cannot move|kebas|lemah|无力|麻木|没力|动不了)|(weak\w*|numb\w*|kebas|lemah|无力|麻木)[^.;]{0,12}(arm|hand|lengan|tangan|手臂|手|臂)|(can'?t|cannot) (lift|move)[^.;]{0,12}(arm|hand|lengan|tangan|手臂|手|臂)/;
  const LEG_WEAK_RE = /(leg|kaki|腿)[^.;]{0,30}(weak\w*|numb\w*|can'?t move|cannot move|kebas|lemah|无力|麻木|动不了)/;
  const OPERATED_RE = /operated|surgery|surgical|sling|post-?op|after (the |my )?(op|operation|surgery)|replacement|dibedah|pembedahan|selepas (pembedahan|operasi)|手术|术后|吊带/;
  const STROKE_COMPANION_RE = /\bsudden\w*|tiba-tiba|突然|one[- ]sided|one side|half (of )?(my |the )?body|(left|right) side|sebelah (badan|kiri|kanan)|\bdizz\w*|\bpening\b|\bfaint|sweat\w*|clammy|berpeluh|\bslur|\bface\b|\bmuka\b/;
  const STROKE_COMPANION_ZH_RE = /突然|半边|一侧|头晕|冒冷汗|出汗|脸/;
  function urgentFlags(t) {
    const found = [];
    URGENT.concat(URGENT6).forEach(u => { if ((u.raw ? u.re.test(t) : pos(t, u.re)) && found.indexOf(u.label) < 0) found.push(u.label); });
    const armHit = pos(t, ARM_WEAK_RE), legHit = pos(t, LEG_WEAK_RE);
    if ((armHit && !pos(t, OPERATED_RE)) || ((armHit || legHit) && (pos(t, STROKE_COMPANION_RE) || STROKE_COMPANION_ZH_RE.test(t)))) {
      if (found.indexOf('stroke signs: arm or leg weakness or numbness') < 0) found.push('stroke signs: arm or leg weakness or numbness');
    }
    return found;
  }

  /* ---------- round 5 (review2 benign false alarm): finding-level negation for the SAME-DAY wound rule ----------
     A finding (redness, discharge, pus, leaking ...) is ignored only when a negation cue sits directly before it, with only
     list words between them: "no redness", "no redness or discharge", "no pus, no redness", "tiada kemerahan atau nanah",
     "没有红肿或渗液". A comma, a contrast word (but, tetapi, 但) or any other word ends the negation, so "no redness, wound is
     leaking" still reports the leak. A comma list with no repeated "no" also ends it (the safe side).
     Ms and zh wording is a machine draft pending native review. Unlike pos(), this checks the words after the cue as well. */
  const NEG_BOUNDARY_RE = /[.;!?。；！？,，|]|\b(?:but|however|although|though|tetapi|tapi)\b|但是|但|不过|却/g;
  const NEG_CUE_RE = /\b(?:no|not|nor|never|without|nothing|isn'?t|aren'?t|wasn'?t|don'?t|doesn'?t|didn'?t|tak ada|takde|tiada|tidak|tak|bukan)\b|free (?:of|from)|没有|沒有|没|無|无|不/g;
  const NEG_GAP_RE = /^(?:\s|\/|&|、|或者|或|和|及|\b(?:or|and|nor|atau|dan|any|feeling|feel|felt|the|a|an|of|signs?|symptoms?|evidence|other|further|new|visible|obvious|clear|significant|very|no|not|never|without|tiada|tidak|tak|takde|bukan|tanda-tanda|tanda|sebarang|apa-apa|swelling|swollen|pain|bengkak|sakit)\b|tak ada|没有|沒有|没|無|无|不|任何|的|迹象|明显的|其他|肿痛|疼痛|肿|痛|疼)*$/;
  // Returns the findings that are NOT negated. Each has start/end indexes into s (the boundary-marked text).
  function positiveFindings(text, findRe) {
    const s = text.replace(NEG_BOUNDARY_RE, ' | ');
    const evs = []; let m;
    const cre = new RegExp(NEG_CUE_RE.source, 'g');
    while ((m = cre.exec(s))) { evs.push({ cue: true, start: m.index, end: m.index + m[0].length }); if (m[0] === '') cre.lastIndex++; }
    const fre = new RegExp(findRe.source, 'g');
    while ((m = fre.exec(s))) { evs.push({ cue: false, start: m.index, end: m.index + m[0].length }); if (m[0] === '') fre.lastIndex++; }
    evs.sort((a, b) => a.start - b.start);
    const out = []; let from = null;
    for (const e of evs) {
      if (e.cue) { from = e.end; continue; }
      const negated = from !== null && NEG_GAP_RE.test(s.slice(from, e.start));
      if (!negated) out.push({ start: e.start, end: e.end, s, word: s.slice(e.start, e.end) });
      from = negated ? e.end : null;
    }
    return out;
  }
  // STRONG findings (pus, nanah, 脓) count without a wound word: pus after surgery is never a normal finding.
  // WEAK findings (redness, discharge, leaking ...) count only with a wound word within 60 characters.
  // Both lists are scanned together, so "no redness or discharge" is one negated list (a weak item then a strong item).
  const WOUND_CTX_RE = /wound|stitches|incision|dressing|scar|bekas|luka|jahitan|parut|刀口|伤口|纱布/;
  const WOUND_STRONG_RE = /\bpus\b|nanah|脓|渗液|水流出|流脓/;
  const WOUND_WEAK_RE = /发红|红肿|红|red(?:der|ness|dish)?|kemerahan|merah|discharge|fluid|cecair|liquid|ooz\w*|leak\w*|bocor|yellow\w*|cloudy|smell\w*|berbau|bau busuk|异味|seep\w*|split\w*|open(?:ed|ing)?|terbuka|\bwet\b|basah|keruh|裂开|裂|流|渗/;
  function woundChange(t) {
    const all = positiveFindings(t, new RegExp(WOUND_STRONG_RE.source + '|' + WOUND_WEAK_RE.source));
    return all.some(f => WOUND_STRONG_RE.test(f.word) || WOUND_CTX_RE.test(f.s.slice(Math.max(0, f.start - 60), f.end + 60)));
  }

  // round 6: a calf or leg finding counts only when it is not negated (positiveFindings), within 40 characters after a calf or leg word.
  const CALF_WORD_RE = /calf|betis|小腿|腿|leg|kaki/g;
  const CALF_FIND_RE = /swollen|swelling|puffy|tender|bengkak|肿|pain|sakit|hurt|bigger|larger|痛|press|sore/;
  const CALF_PRE_NEG_RE = /(\bno\b|\bnot\b|\bwithout\b|\bnor\b|tiada|tidak|tak|takde|bukan|没有|沒有|没|无|冇|唔|不)\s*$/i;
  function calfFinding(t) {
    return positiveFindings(t, CALF_FIND_RE).some(f => {
      const before = f.s.slice(Math.max(0, f.start - 40), f.start);
      const words = []; let m; const re = new RegExp(CALF_WORD_RE.source, 'g');
      while ((m = re.exec(before))) words.push(m.index);
      if (!words.length) return false;
      const pre = before.slice(0, words[words.length - 1]); // text in front of the nearest calf or leg word
      return !CALF_PRE_NEG_RE.test(pre);
    });
  }

  /* ---------- classifier (Tier 1: before any model; v1 has no model) ---------- */
  function classify(text, ctx) {
    ctx = ctx || {}; const t = String(text).toLowerCase(); const flags = []; const L = lang(text); const pack = PACKS[ctx.procedure] || { redFlags: [], faq: [] };
    // EMERGENCY: self-harm first, with its own fixed reply (review2 B1)
    const selfText = t.replace(/\bdo not (want|wish)\b/g, "don't $1"); // 'not' would otherwise negate 'want to live'
    if (pos(selfText, SELF_HARM_RE) || SELF_HARM_RAW_RE.test(t)) return out('EMERGENCY', ['self-harm statement'], L, ctx, { reply: SELF_HARM_REPLY[L] || SELF_HARM_REPLY.en });
    const breath = /catch(ing)? (his|her|my|their)? ?breath|gasp|struggl\w* to breathe|breath(ing)? (very )?(fast|hard|rapid)|can'?t get (enough )?air|short(ness)? of breath|呼吸(很|太)?急|气短|一直喘|走两步就喘|喘|breathless|(can'?t|cannot) breathe|breathe properly|chest (is )?tight|tight chest|difficulty breathing|sesak nafas|semput|呼吸困难|喘不过气|气促/;
    const chest = /chest.{0,30}(pain|hurt|squeez|tight|heavy|crush)|pain in (my )?chest|sakit dada|dada.{0,12}(sakit|sempit|berat)|胸(?!口?(不|没|唔|冇|无))口?.{0,4}(痛|闷)|胸闷|放射/;
    const cough = /cough(ed|ing)? (up )?(a bit of )?blood|batuk berdarah|咳血/;
    const unresp = /asking where (he|she|we|they|i) (is|are|am)|talking nonsense|not making sense|tanya ni kat mana|mengantuk teruk|tak betul sejak|颠三倒四|昏睡|问我们这是哪里|not waking|hard to wake|unresponsive|burning hot|pengsan|叫不醒/;
    if (pos(t, breath)) flags.push('breathlessness');
    if (pos(t, chest)) flags.push('chest pain');
    if (pos(t, cough)) flags.push('coughing blood');
    pack.redFlags.forEach(r => { if (pos(t, r.re)) flags.push(r.label); });
    if (!flags.length && pos(t, RE.cauda)) flags.push('Possible cauda equina / bladder-bowel change'); // global: safer than relying on the procedure pack
    if (pos(t, RE.neurovasc) && (pos(t, RE.numb) || pos(t, /cold|blue|white|pale|purple|biru|sejuk|dingin|冷|冰凉|紫|白|move|gerak|动/))) flags.push('limb circulation/nerve');
    if (pos(t, unresp)) flags.push('reduced consciousness');
    if (pos(t, /confus(ed|ion)|very sleepy|drowsy|disorient|keliru|意识模糊|糊涂/)) flags.push('confusion/drowsiness');
    urgentFlags(t).forEach(f => { if (flags.indexOf(f) < 0) flags.push(f); });
    if (flags.length) return out('EMERGENCY', flags, L, ctx);
    // SAME-DAY
    const sd = [];
    if (woundChange(t)) sd.push('wound change'); // round 5: negation-aware (see woundChange)
    let tv = temp(t); if (tv === null) { const m2 = t.match(/(?<![\d.])(3[89](?:\.\d)?|40(?:\.\d)?)(?![\d])/); if (m2 && /temp|therm|suhu|体温|fever|demam|panas|\bhot\b|烫|发烧|烧到/.test(t)) tv = parseFloat(m2[1]); }
    if (tv !== null && tv >= 38.0) sd.push('fever ' + tv); else if (tv === null && pos(t, /\bfever\b|demam|发烧|发热|高烧|烧到|burning up|very hot|badan panas|rasa panas/)) sd.push('fever reported');
    if (calfFinding(t)) sd.push('calf/leg pain or swelling'); // round 6: finding-level negation, so 'calf is not swollen and no pain' is not an alarm
    if (sd.length) return out('SAME-DAY', sd, L, ctx);
    // ROUTE: clinical judgement, never answered
    if (pos(t, /blood thinner|anticoag|\bdoac\b|warfarin|rivaroxaban|apixaban|enoxaparin|clexane|injection|ibuprofen|diclofenac|antibiotic|prescri|\bdose\b|stop (taking|my|them)|can i stop|\bfly(ing)?\b|flight|travel|penerbangan|terbang|飞机|止痛药/)) {
      const net = /injection/.test(t) ? ['bleeding elsewhere', 'black stools'] : /antibiotic|scar|scratch/.test(t) ? ['redness', 'discharge', 'fever', 'wound opening'] : [];
      return out('ROUTE', ['clinical judgement'], L, ctx, { safetyNet: net, noAnswer: true });
    }
    if (pos(t, /(more|worse|again|increas|bertambah|加重|更痛).{0,40}(night|pain|hurt|sakit|痛)|(pain|hurt\w*).{0,40}(more|worse|again)/)) return out('ROUTE', ['worsening trend'], L, ctx, { reviewWithinHrs: 48, safetyNet: ['fever', 'wound change', 'new swelling'], noAnswer: true });
    // ANSWER from the approved store only
    for (const k of (pack.faq || [])) { const f = FAQ[k]; if (f.re.test(t) && (!f.needs || f.needs.test(t))) { return out('ANSWER', [k], L, ctx, { reply: f.ans[L] || f.ans.en, safetyNet: safetyNet(t), faq: k }); } }
    if (/^\s*(i'?m |i am )?(ok|okay|fine|good|baik)\b[\s.!]*$/.test(t)) return out('ACK', ['benign'], L, ctx, { reply: 'Thanks, noted. Message us any time if anything changes.' });
    if (/not (so )?(good|well)|unwell|tak sihat|不太好|不舒服/.test(t)) return out('ASK', ['vague'], L, ctx);
    const t2 = t.replace(/tak teruk( sangat)?|not (too |that |very )?(bad|severe)|不严重|不太严重/g, '');
    if (ctx.mode !== 'intake' && positiveFindings(t2, /(?<![a-z])(?:sudden|suddenly|cannot|can'?t|unable|numb|blue|severe|worse|worsening|teruk|tiba-tiba|tak boleh|kebas)(?![a-z])|突然|严重|不能|无法|麻木|厉害/).length) return out('SAME-DAY', ['unrecognised alarm words: human review today'], L, ctx); // round 6: negated words ('no numbness') do not count
    return out('ROUTE', ['no approved answer'], L, ctx, { noAnswer: true }); // never guess
  }
  function safetyNet(t) { const answered = {}, asked = []; const q = { 'calf pain/swelling': /no (calf|leg) (pain|swelling)/, fever: /no fever|tiada demam|没有发烧/, breathlessness: /no (breathless|shortness)/ }; for (const k in q) { if (q[k].test(t)) answered[k] = 'no'; else asked.push(k); } return { answered, asked }; }
  function out(cls, flags, L, ctx, extra) { return Object.assign({ cls, flags, lang: L, reply: (T[cls] && T[cls][L]) || (T[cls] && T[cls].en) || '', botAnswered: cls === 'ANSWER' }, extra || {}); }

  /* ---------- simulation: patients, tasks, alerts, time ---------- */
  class Sim {
    constructor() { this.now = 0; this.patients = {}; this.tasks = []; this.alerts = []; this.log = []; this.outbox = []; this.seq = 0; this.cfg = Object.assign({}, CFG); }
    id(p) { return p + (++this.seq); }
    say(pid, text, who) { this.outbox.push({ at: this.now, pid, who: who || 'bot', text }); }
    note(type, pid, detail) { this.log.push({ at: this.now, type, pid, detail }); }
    addPatient(p) { const s = this.now + (p.surgeryIn != null ? p.surgeryIn * D : -(p.postopDay || 0) * D); this.patients[p.id] = Object.assign({ lang: 'en', nokConsent: false, atRisk: false, surgeryAt: s, alertsCount: 0 }, p, { surgeryAt: s }); return this.patients[p.id]; }
    P(pid) { return this.patients[pid]; }
    day(pid) { return Math.floor((this.now - this.P(pid).surgeryAt) / D); }
    /* generate the full checklist from the procedure pack */
    start(pid) { const p = this.P(pid), pack = PACKS[p.procedure]; const items = SHARED.concat(pack.extra); items.forEach(it => this.addTask(pid, { type: it.key, title: it.title, owner: it.owner, kind: it.kind, dueAt: p.surgeryAt + it.due * D, atRiskAt: p.surgeryAt - this.cfg.atRiskBeforeSurgeryHrs, auto: true })); return this.tasksOf(pid); }
    tasksOf(pid) { return this.tasks.filter(t => t.pid === pid); }
    addTask(pid, o) { const pp = this.P(pid); const t = Object.assign({ id: this.id('T'), pid, state: 'open', owner: 'unassigned', pings: 0, nudges: 0, lastPing: null, lastNudge: null, evidence: [], hold: false, atRisk: false, createdAt: this.now, dueAt: this.now, atRiskAt: (pp && pp.surgeryAt > this.now) ? pp.surgeryAt - this.cfg.atRiskBeforeSurgeryHrs : null }, o); this.tasks.push(t); this.note('task_created', pid, t.title); return t; }
    /* ---- alerts with Tier-2 re-ping, cap, and nobody-responded fallback ---- */
    alert(pid, cls, flags, text) {
      let a = this.alerts.find(x => x.pid === pid && x.state === 'open' && x.cls !== 'ROUTE' || x.pid === pid && x.state === 'open' && cls === 'ROUTE');
      if (a) { a.msgs.push(text); flags.forEach(f => { if (a.flags.indexOf(f) < 0) a.flags.push(f); }); if (PRIORITY[cls] > PRIORITY[a.cls]) { a.cls = cls; this.note('alert_upgraded', pid, cls); } return a; }
      a = { id: this.id('A'), pid, cls, flags: flags.slice(), msgs: [text], state: 'open', createdAt: this.now, ackedBy: null, pings: 0, lastPing: this.now, nobodyResponded: false, fallbackOnCall: false, escalations: [], topic: cls === 'ROUTE' ? 'Questions' : 'Urgent' };
      this.alerts.push(a); this.note('alert', pid, cls + ': ' + flags.join(', ')); return a;
    }
    ack(aid, who) { const a = this.alerts.find(x => x.id === aid); a.ackedBy = who || 'staff'; a.ackedAt = this.now; a.state = 'acked'; this.note('alert_ack', a.pid, who); return a; }
    /* ---- patient message ---- */
    message(pid, text, opts) {
      opts = opts || {}; const p = this.P(pid); const r = classify(text, { procedure: p.procedure });
      r.sender = opts.sender || 'patient'; r.linked = r.sender !== 'third';
      if (r.cls === 'EMERGENCY' || r.cls === 'SAME-DAY') { r.alert = this.alert(pid, r.cls, r.flags, text); p.atRisk = true; }
      else if (r.cls === 'ROUTE') { r.alert = this.alert(pid, 'ROUTE', r.flags, text); r.alert.reviewWithinHrs = r.reviewWithinHrs || 24; r.alert.safetyNet = r.safetyNet; }
      if (r.cls === 'ASK') { this.addTask(pid, { type: 'clarify', title: 'Clarify vague message', owner: 'nurse', kind: 'call', dueAt: this.now + 4 * H, autoCall: true }); }
      this.say(pid, r.reply, 'bot'); this.outbox[this.outbox.length - 1].cls = r.cls; this.note('message', pid, r.cls); return r;
    }
    /* ---- results screening: HOLD, blocking vs non-blocking missing data ---- */
    result(pid, res) {
      const p = this.P(pid); const th = THRESH[res.name]; let hold = false;
      if (res.name === 'MRSA') { if (res.positive) { const t = this.addTask(pid, { type: 'decolonise', title: 'MRSA decolonisation started (patient to confirm)', owner: 'preop_nurse', kind: 'med', dueAt: this.now, atRiskAt: p.surgeryAt - this.cfg.atRiskBeforeSurgeryHrs, critical: true }); return { cls: 'OVERDUE-PENDING', task: t }; } return { cls: 'ANSWER' }; }
      if (th) hold = th.lt != null ? res.value < th.lt : res.value >= th.ge;
      const open = this.tasks.find(t => t.pid === pid && t.type === 'hold_' + res.name && t.state !== 'closed');
      if (hold) {
        if (open) return { cls: 'HOLD', task: open };
        const owner = res.name === 'HbA1c' ? 'family_physician' : 'preop_nurse';
        const t = this.addTask(pid, { type: 'hold_' + res.name, title: res.name + ' ' + res.value + ' ' + th.unit + ' needs action', owner, escalateTo: res.name === 'Hb' ? 'anaesthetist' : 'surgeon', kind: 'screen', hold: true, state: 'hold', dueAt: this.now + 48 * H, evidence: [{ at: this.now, name: res.name, value: res.value }] });
        p.atRisk = true; this.say(pid, 'One of your pre-op results needs follow-up before surgery. Your date may move. ' + owner.replace('_', ' ') + ' will contact you.', 'bot'); return { cls: 'HOLD', task: t };
      }
      if (open) { open.evidence.push({ at: this.now, name: res.name, value: res.value, repeat: true }); open.state = 'ready_to_close'; this.note('offer_close', pid, 'repeat result attached'); return { cls: 'HOLD', task: open, offered: true }; }
      return { cls: 'OK' };
    }
    screen(pid, form) {
      const blocking = ['HbA1c'].filter(f => form[f] == null || form[f] === ''); const warnings = []; const used = {};
      if (!form.language) { warnings.push('language'); used.language = 'en'; }
      if (blocking.length) { const t = this.addTask(pid, { type: 'missing_' + blocking[0], title: 'Missing: ' + blocking.join(', '), owner: 'preop_nurse', kind: 'screen', dueAt: this.now + 24 * H }); return { cls: 'ASK', blocking, warnings, used, scored: false, task: t, evidenceAbsent: blocking }; }
      return { cls: 'OK', blocking, warnings, used, scored: true };
    }
    /* ---- closure: only with evidence or a documented authorised decision ---- */
    close(taskId, o) {
      const t = this.tasks.find(x => x.id === taskId); o = o || {}; const by = o.by || {};
      const evid = t.evidence.length > 0 && t.evidence.some(e => e.repeat) || (o.evidence && o.evidence.length);
      const dec = o.decision && o.decision.reason && o.decision.reason.trim() && o.decision.by === 'clinician';
      if ((evid && by.role === 'clinician') || dec) { t.state = 'closed'; t.closedBy = by.role; this.note('closed', t.pid, t.title); return { ok: true }; }
      this.note('close_refused', t.pid, 'attempt by ' + (by.role || '?') + ' note="' + (o.note || '') + '"'); return { ok: false, needs: 'repeat result attached, or a documented authorised decision with a reason' };
    }
    /* ---- patient/staff signals ---- */
    confirm(taskId, who) { const t = this.tasks.find(x => x.id === taskId); t.state = 'confirmed'; t.confirmedBy = who || 'patient'; this.note('confirmed', t.pid, t.title); }
    missedAppt(pid, o) {
      const prev = this.tasks.filter(t => t.pid === pid && t.type === 'missed_' + o.type && true).length;
      const t = this.addTask(pid, { type: 'missed_' + o.type, title: 'Rebook missed ' + o.type, owner: o.owner || 'clinic_coordinator', kind: 'appt', dueAt: this.now, atRiskAt: o.atRiskAt != null ? o.atRiskAt : this.P(pid).surgeryAt - 5 * D, missCount: prev + 1 });
      this.say(pid, 'You missed your ' + o.type + '. It matters because your care plan depends on it. Reply to rebook.', 'bot');
      if (prev + 1 >= 2) { this.addTask(pid, { type: 'clinician_notified', title: 'Clinician told: ' + o.type + ' missed twice', owner: 'clinician', kind: 'review', dueAt: this.now }); t.escalated = true; this.note('escalated', pid, 'missed twice'); }
      return t;
    }
    reason(pid, text) { const cat = /work|job|time off|kerja|工作/.test(text) && /far|transport|bus|jauh|远/.test(text) ? 'work and transport' : /work|job|time off|kerja|工作/.test(text) ? 'work' : /far|transport|jauh|远/.test(text) ? 'transport' : 'other'; this.note('drop_reason', pid, cat); return cat; }
    contactFailed(pid, taskId, channel) {
      const t = this.tasks.find(x => x.id === taskId); t.failedContacts = (t.failedContacts || []).concat(channel); const ev = [];
      if (t.failedContacts.length >= 3) { t.escalated = true; ev.push('nurse call list'); if (this.P(pid).nokConsent) ev.push('next of kin'); t.escalatedTo = ev; this.note('contact_escalated', pid, ev.join(', ')); }
      return { escalatedTo: ev };
    }
    checkin(pid, o) {
      const res = { tasks: [], classes: [] }; const p = this.P(pid);
      if (o.injections) { const missed = o.injections.filter(x => !x).length; if (missed >= 2) { const t = this.addTask(pid, { type: 'missed_injections', title: missed + ' anticoagulant doses unconfirmed', owner: 'ward_nurse', kind: 'med', dueAt: this.now, callSameDay: true, doubleDoseAdvice: false }); res.tasks.push(t); res.classes.push('OVERDUE'); this.addTask(pid, { type: 'dose_decision', title: 'Clinician decision on missed doses', owner: 'clinician', kind: 'review', dueAt: this.now }); if (/ran out|out of|habis/.test((o.text || '').toLowerCase())) this.addTask(pid, { type: 'supply', title: 'Supply gap: pharmacy to supply', owner: 'pharmacy', kind: 'med', dueAt: this.now }); } }
      if (o.physioGapDays >= 3) { const t = this.addTask(pid, { type: 'physio_gap', title: 'No exercises logged for ' + o.physioGapDays + ' days', owner: 'physio', kind: 'physio', dueAt: this.now }); res.tasks.push(t); res.classes.push('OVERDUE'); res.painCheck = true;
        if (o.pain === 'controlled') res.plan = 'restart at lower step'; else if (o.pain === 'too much') { this.addTask(pid, { type: 'physio_call', title: 'Physio to call; clinician told', owner: 'physio', kind: 'call', dueAt: this.now + 4 * H }); this.addTask(pid, { type: 'clinician_told', title: 'Clinician told: pain limiting rehab', owner: 'clinician', kind: 'review', dueAt: this.now }); res.plan = 'physio call + clinician told'; }
        if (o.flexionTrend === 'declining') { this.addTask(pid, { type: 'review_function', title: 'Function declining: case raised for review', owner: 'clinician', kind: 'review', dueAt: this.now }); res.review = true; } }
      if (o.meds) { const nsaid = o.meds.filter(m => /diclofenac|ibuprofen|naproxen|etoricoxib|celecoxib|mefenamic/.test(m.toLowerCase())); if (nsaid.length >= 2) { const a = this.alert(pid, 'ROUTE', ['two NSAIDs: ' + nsaid.join(' + ')], 'Medication check-in'); a.reviewWithinHrs = 24; a.owner = 'pharmacist'; a.meds = o.meds; res.classes.push('ROUTE'); res.alert = a; res.dosingAdvice = false; } }
      return res;
    }
    woundAnswers(pid, a) { const any = Object.keys(a).some(k => a[k]); if (any) { const al = this.alert(pid, 'SAME-DAY', Object.keys(a).filter(k => a[k]), 'Wound questionnaire'); return { cls: 'SAME-DAY', alert: al }; } const t = this.tasks.find(x => x.pid === pid && /missed_/.test(x.type) && x.state !== 'closed'); return { cls: 'OVERDUE', rebook: true, closed: false, task: t }; }
    teachback(pid, key, ans) {
      const ok = /call|ring|contact|hospital|nurse|ward|emergency|urgent|loosen|today/.test(String(ans).toLowerCase()) && !/wait/.test(String(ans).toLowerCase()); const taskKey = key;
      let t = this.tasks.find(x => x.pid === pid && x.type === taskKey); if (!t) t = this.addTask(pid, { type: taskKey, title: 'Teach-back: ' + key, owner: 'ward_nurse', kind: 'teachback', dueAt: this.now });
      if (ok) { t.state = 'confirmed'; return { confirmed: true, task: t }; }
      t.understanding = 'not confirmed'; this.say(pid, 'If your fingers go cold, blue or numb in the sling, call the ward or go to the emergency department the same day; do not wait for your next visit.', 'bot'); const call = this.addTask(pid, { type: 'nurse_call_' + key, title: 'Nurse to call: teach-back failed', owner: 'ward_nurse', kind: 'call', dueAt: this.now + 4 * H }); return { confirmed: false, task: t, call, open: true };
    }
    /* ---- time ---- */
    advance(hours) { for (let i = 0; i < Math.round(hours); i++) { this.now += 1; this.tick(); } }
    tick() {
      this.alerts.forEach(a => { if (a.state !== 'open' || a.cls === 'ROUTE' && !a.reviewWithinHrs) return;
        if (a.cls !== 'ROUTE' && this.now - a.lastPing >= this.cfg.rePingEvery) { if (a.pings < this.cfg.rePingCap) { a.pings++; a.lastPing = this.now; this.note('re_ping', a.pid, 'ping ' + a.pings); } else if (!a.nobodyResponded) { a.nobodyResponded = true; a.fallbackOnCall = true; a.lastNext = this.now; a.escalations = a.escalations || []; this.note('nobody_responded', a.pid, 'fallback on-call'); this.say(a.pid, 'A clinician will respond. If it gets worse, go to the emergency department.', 'bot'); } }
        // round 6 (M4): keep paging the next level at a fixed interval until acknowledged
        if (a.nobodyResponded && a.cls !== 'ROUTE' && this.now - a.lastNext >= this.cfg.nextLevelEvery) { a.lastNext = this.now; const step = NEXT_LEVELS[Math.min(a.escalations.length, NEXT_LEVELS.length - 1)]; a.escalations.push({ to: step.to, at: this.now }); a.escalatedTo = step.to; a.unresponded = a.cls === 'EMERGENCY'; this.note('next_level_paged', a.pid, step.label + ' paged, no response (' + a.cls + ')'); }
        if (a.cls === 'ROUTE' && this.now - a.createdAt >= a.reviewWithinHrs && !a.overdueNoted) { a.overdueNoted = true; this.note('route_overdue', a.pid, 'review window passed'); } });
      this.tasks.forEach(t => { if (t.state === 'closed' || t.state === 'confirmed') return; const p = this.P(t.pid);
        if (t.hold && t.state === 'hold' && !t.acked && this.now - t.createdAt >= this.cfg.unackedHoldHrs && !t.leadPinged) { t.leadPinged = true; this.note('lead_pinged', t.pid, 'hold unacknowledged 48h'); }
        if (t.state === 'open' && this.now >= t.dueAt && !t.hold) { t.state = 'overdue'; this.note('overdue', t.pid, t.title); }
        if (t.state === 'overdue') {
          if (t.pings < this.cfg.rePingCap && (t.lastPing == null || this.now - t.lastPing >= 24 * H)) { t.pings++; t.lastPing = this.now; this.note('owner_reping', t.pid, t.owner + ' #' + t.pings); }
          if (t.nudges < this.cfg.nudgeCap && (t.lastNudge == null || this.now - t.lastNudge >= this.cfg.nudgeEvery)) { t.nudges++; t.lastNudge = this.now; this.say(t.pid, 'Reminder: ' + t.title + '. Tap done when finished.', 'bot'); }
          if (t.pings >= this.cfg.rePingCap && !t.capNoted) { t.capNoted = true; this.note('cap_reached', t.pid, 'escalated to clinic lead: ' + t.title); }
        }
        if (t.atRiskAt != null && this.now >= t.atRiskAt && (t.state === 'overdue' || t.state === 'open') && !t.atRisk && p.surgeryAt > this.now - 1) { t.atRisk = true; p.atRisk = true; this.note('at_risk', t.pid, t.title); if (t.critical || t.state === 'overdue') this.note('clinician_notified', t.pid, t.title); }
      });
    }
  }
  const api = { Sim, classify, PACKS, SHARED, THRESH, CFG, FAQ, NEXT_LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PeriLoop = api;
})(typeof window !== 'undefined' ? window : globalThis);
