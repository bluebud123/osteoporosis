'use strict';
/* PeriLoop triage layer (v2). Wraps the fixed engine (lib/engine.js, unchanged) and does two things, both measured on
 * held-out sets (see app/eval and docs/decision-log.md):
 *   1. ADDS red-flag wording the engine missed, built by listing each sign after knee replacement and the plain ways
 *      people say it in English, Malay and Chinese. These can only raise the class.
 *   2. LOWERS exactly two engine results that paged staff for non-clinical messages:
 *        a. the catch-all "alarm word" rule (cannot, unable, severe, sudden, worse, blue ...) now needs a body, symptom
 *           or function word near it. "I can't find my appointment card" is no longer a same-day alert.
 *        b. a general question about fever or the wound with no report of it ("is fever normal after surgery?") goes
 *           to the answer library and the inbox, not to a same-day alert. Any first-person report, number or time word
 *           keeps the alert. Emergencies are never lowered.
 * Everything here is a DRAFT for surgeon sign-off. Labels and wording were written by an AI, not a clinician. */
var E = require('./lib/engine.js');

var NEG = /(?:\bno\b|\bnot\b|\bnever\b|\bwithout\b|\bnor\b|\bisn'?t\b|\bwasn'?t\b|\bdon'?t have\b|\bdidn'?t\b|\bdoesn'?t\b|tiada|tidak|\btak\b|takde|takda|\btkde\b|\bxde\b|bukan|belum|没有|沒有|没|无|不是|不)\s*(?:any |a |the |my |ada |rasa |really |very |pun |ada rasa )?$/i;
function pos(t, re) {
  var g = new RegExp(re.source, 'gi'), m;
  while ((m = g.exec(t))) {
    if (m[0] === '') { g.lastIndex++; continue; }
    if (!NEG.test(t.slice(Math.max(0, m.index - 18), m.index))) return true;
  }
  return false;
}
// A context word (wound, cough ...) with a finding word (leaking, blood ...) within n characters in the same sentence.
// The negation is read at the FINDING: "wound is dry, no smell" does not count, "no fever but the wound smells" does.
function near(ctx, find, n) { return { ctx: new RegExp('(?:' + ctx + ')', 'i'), find: new RegExp('(?:' + find + ')', 'gi'), n: n }; }
function hit(t, m) {
  if (Array.isArray(m)) return m.some(function (x) { return hit(t, x); });
  if (m instanceof RegExp) return pos(t, m);
  var g = new RegExp(m.find.source, 'gi'), f;
  while ((f = g.exec(t))) {
    if (f[0] === '') { g.lastIndex++; continue; }
    if (NEG.test(t.slice(Math.max(0, f.index - 18), f.index))) continue;
    var a = Math.max(0, f.index - m.n), b = Math.min(t.length, f.index + f[0].length + m.n);
    var left = t.slice(a, f.index), right = t.slice(f.index + f[0].length, b);
    var li = Math.max(left.lastIndexOf('.'), left.lastIndexOf(';'), left.lastIndexOf('!'), left.lastIndexOf('?'), left.lastIndexOf('。')); if (li >= 0) left = left.slice(li + 1);
    var ri = right.search(/[.;!?。！？]/); if (ri >= 0) right = right.slice(0, ri);
    if (m.ctx.test(left) || m.ctx.test(right) || m.ctx.test(f[0])) return true;
  }
  return false;
}

var BLOOD = 'blood\\w*|bloody|darah|berdarah|血';
var WOUND = 'wound edges?|wound|cut|incision|scar|stitch\\w*|sutures?|staples?|clips?|dressing|bandage|plaster|gauze|luka|jahitan|balutan|parut|伤口|刀口|缝线|纱布|敷料';
var KNEE = 'knee|joint|leg|shin|thigh|lutut|kaki|peha|膝盖|膝|腿';
var MED = 'blood thinners?|anticoagulants?|warfarin|rivaroxaban|apixaban|dabigatran|enoxaparin|clexane|injections?|insulin|ubat cair darah|pencair darah|抗凝药|tablets?|pills?|capsules?|medicine|medication|painkillers?|oxycodone|tramadol|morphine|codeine|paracetamol|panadol|ubat|pil|药|止痛药';

/* ---------- emergency: each sign, the ways people say it ---------- */
var EMERGENCY = [
  ['breathlessness', /(?:struggl\w*|gasp\w*|fight\w*|hungry|desperate) for (?:air|breath)|(?:can'?t|cannot) get (?:any |enough )?air|\bpanting\b|\bwinded\b|out of breath|\bpuffed\b|\bwheez\w*|(?:can'?t|cannot|hard to|trouble|difficult\w*|struggl\w*|problems?) (?:to )?(?:catch(?:ing)? my breath|breath\w*|get (?:my )?breath)|breath\w* (?:is |feels )?(?:hard|difficult|laboured|labored|heavy)|(?:susah|sukar|payah|tak boleh|tidak boleh) (?:nak |hendak |untuk )?(?:ber)?nafas|nafas (?:saya |dia )?(?:laju|pendek|sesak|semput|berbunyi)|\bmengah\b|tercungap|喘不上气|喘不过气|上气不接下气|气喘|呼吸困难|呼吸不过来|透不过气/],
  ['chest pain or pressure', /(?:someone|something|weight|band|brick|elephant)[^.;]{0,25}(?:on|around|across) (?:my |his |her |the )?chest|chest[^.;,]{0,30}(?:ach\w*|discomfort|heav\w*|pressure|tight\w*|squeez\w*|burn\w*|stab\w*|sharp)|(?:ach\w*|discomfort|heav\w*|pressure|tight\w*|squeez\w*|stab\w*|sharp)[^.;,]{0,20}chest|dada[^.;]{0,20}(?:ketat|sempit|berat|sakit|pedih|mencucuk|sesak|dihempap|ditindih|dihimpit|ditekan|tertekan)|(?:sakit|ketat|sesak|berat)[^.;]{0,8}dada|胸[^。.;]{0,6}(?:痛|闷|紧|压)|心口[^。.;]{0,6}(?:痛|闷)/],
  ['heavy bleeding that will not stop', /(?:blood|bleed\w*)[^.;]{0,30}(?:pour\w*|gush\w*|spurt\w*|squirt\w*|non.?stop|won'?t stop|will not stop|not stopping|doesn'?t stop|everywhere)|(?:pour\w*|gush\w*|spurt\w*)[^.;]{0,15}blood|soaked through[^.;]{0,25}(?:towels?|sheets?|clothes|pads?)|(?:towels?|sheets?)[^.;]{0,25}(?:soaked|full of blood)|darah[^.;]{0,25}(?:banyak|mencurah|memancut|tak berhenti|tidak berhenti|tak henti)|berdarah[^.;]{0,15}(?:banyak|teruk|tak berhenti|tidak berhenti)|(?:流血|出血)[^。.;]{0,8}(?:不止|止不住|不停|很多|大量)|一直(?:在)?(?:流血|出血)|血流不止/],
  ['blue or grey colour', /\b(?:he|she|they|i|baby|dad|mum|mom|father|mother|husband|wife|patient)\b[^.;]{0,15}(?:is |are |am |has |have )?(?:turn\w*|gone|going|looks?|look\w*) (?:blue|grey|gray|purple|ashen)|(?:muka|bibir|badan)[^.;]{0,12}(?:biru|kebiruan|pucat lesi)|(?:脸|嘴唇|全身)[^。.;]{0,4}(?:发紫|发青|发灰)/],
  ['coughing blood', near('cough\\w*|phlegm|sputum|spit\\w*|spat|kahak|batuk|ludah|咳\\w*|痰', BLOOD, 30)],
  ['vomiting blood', near('vomit\\w*|threw up|throw\\w* up|puk\\w*|was sick|been sick|muntah|吐|呕', BLOOD, 30)],
  ['confusion or reduced consciousness', /\bmuddled\b|\bconfus\w*|\bdelirious\b|\bdelirium\b|hallucinat\w*|seeing things|(?:doesn'?t|does not|don'?t|didn'?t) (?:know|recogni[sz]e) (?:what day|where|who|me|us|her|his)|not (?:making|talking) (?:any )?sense|talking (?:nonsense|gibberish|rubbish)|not (?:himself|herself|myself)|very (?:drowsy|sleepy)|hard to (?:wake|rouse)|can'?t (?:wake|rouse)|\bkeliru\b|meracau|merapu|tak kenal (?:orang|saya|kami)|tak sedar|神志不清|胡言乱语|不认得人|意识不清|迷糊/],
  ['possible severe allergy', [near('face|eyes?|eyelids?|lips?|tongue|throat|muka|mata|bibir|lidah|tekak|脸|眼|嘴唇|舌|喉', 'puff\\w*|swell\\w*|swollen|bengkak|sembab|肿', 25), near('rash|hives|itch\\w*|ruam|gatal|皮疹|痒', 'breath\\w*|wheez\\w*|throat (?:is )?(?:tight|clos)\\w*|sesak nafas|呼吸困难', 40)]],
  ['stroke signs: face', /face[^.;]{0,25}(?:dropp\w*|droop\w*|fallen|sagg\w*|pulled|twisted|uneven)|(?:one|left|right) side of (?:\w+ ){0,2}face|muka[^.;]{0,15}(?:senget|herot|jatuh sebelah)|mulut[^.;]{0,10}(?:senget|herot)|嘴[^。.;]{0,4}歪|脸[^。.;]{0,6}(?:歪|垂|斜)/],
  ['stroke signs: speech', /words? (?:are |is |were )?(?:coming out|come out|came out) (?:all )?(?:wrong|jumbled|mixed)|(?:can'?t|cannot|couldn'?t|unable to) (?:get (?:the |my |his |her )?words? out|speak|talk)\b|talking (?:funny|strangely)|speech (?:is |has gone )?(?:slurr\w*|strange|funny|jumbled)|(?:tak|tidak) boleh (?:ber)?cakap|susah (?:nak |hendak )?(?:ber)?cakap|cakap (?:tak|tidak) (?:jelas|betul)|说不出话|讲不出话|说话不清/],
  ['self-harm statement', /\bend it(?: all)?\b|no point (?:in |of )?(?:going on|living|carrying on)|(?:don'?t|do not|can'?t) see (?:the|any) point (?:of|in) (?:going on|living|carrying on|anything)|better off (?:dead|without me)|(?:can'?t|cannot) go on(?: any ?more| like this)?\b|give up on life|tired of living|rather be dead|rasa nak mati|nak mati|tak nak hidup|bosan hidup|tak guna hidup|活不下去|活着没意思|不想活/],
  ['collapse or unresponsive', /(?:dropp\w*|collaps\w*|slump\w*|went down|fell)[^.;]{0,30}(?:floor|ground)[^.;]{0,40}(?:not|n'?t|no) (?:answer\w*|respond\w*|wak\w*|mov\w*|react\w*)|(?:isn'?t|is not|not|won'?t|doesn'?t) (?:answering|responding|waking|respond|wake|answer)\b|(?:pengsan|rebah)|tak (?:bangun|menyahut|sedarkan diri)|晕倒|昏倒|叫不醒/],
  ['seizure or fit', /\b(?:having|had|has|have|is having|keeps having) (?:a |an |another )?(?:fits?|seizures?|convulsions?)\b|\bfitting\b|\bfits?\b[^.;]{0,30}(?:shak\w*|jerk\w*|stiff\w*)|whole body (?:is )?(?:shaking|jerking)[^.;]{0,30}(?:fits?|uncontroll\w*|can'?t stop|eyes roll\w*)|sawan|kejang seluruh badan|抽搐|抽筋[^。.;]{0,6}全身|全身[^。.;]{0,4}(?:抽|抖)/],
  ['limb colour change', /(?:foot|feet|toes?|leg|kaki|jari kaki)[^.;,]{0,25}(?:grey|gray|blue|purple|dusky|bluish|greyish)\b(?![- ]?(?:cast|sock|bandage|brace|frame|stocking|shoe|blanket|pillow))|(?:foot|feet|toes?|leg|kaki|jari kaki|脚|脚趾|腿)[^.;。]{0,25}(?:turn\w* (?:blue|black|purple|white|grey|gray)|(?:gone|going|is|are|look\w*) (?:blue|black|purple|dusky|white and cold)|jadi (?:biru|hitam|ungu|pucat)|kebiruan|menghitam|发黑|变黑|发紫|变紫|发白)/],
  ['possible overdose', new RegExp('(?:took|taken|had|termakan|terambil|makan|ambil|吃了?|打了?)[^.;]{0,40}(?:' + MED + ')[^.;]{0,25}(?:twice|two times|2 times|second time|again by mistake|dua kali|两次|两遍)|(?:took|taken|taking|swallow\\w*|ate|had|termakan|terambil|tertelan|makan|ambil|吃了?|服了?)[^.;]{0,40}(?:double|twice|too much|too many|extra|a second|two doses|both doses|lebih|berlebihan|dua kali|吃多了|多吃了|过量|双倍|两倍|两次)[^.;]{0,40}(?:' + MED + '|dose)|(?:took|taken|termakan|terambil|tertelan|吃了?)[^.;]{0,40}(?:' + MED + ')[^.;]{0,25}(?:double|twice|too much|too many|extra|lebih|berlebihan|dua kali|吃多了|过量|by (?:accident|mistake)|tersalah)|(?:double|twice|too many|lebih|berlebihan)[^.;]{0,25}(?:' + MED + ')[^.;]{0,25}(?:by (?:accident|mistake)|accidentally|tersalah|drows\\w*|sleepy|mengantuk)', 'i')],
  ['fast heartbeat with faintness, chest or breathing symptoms', near('faint|pass out|black out|dizz\\w*|light ?headed|chest|breath\\w*|pitam|pening|pengsan|nafas|dada|晕|胸|气|冷汗', 'heart (?:is |was |keeps )?(?:rac\\w*|pound\\w*|flutter\\w*|thump\\w*|going (?:very )?fast)|palpitat\\w*|jantung[^.;]{0,10}(?:berdebar|laju)|berdebar|心跳[^。.;]{0,4}(?:快|乱)|心悸|心慌', 60)]
];

/* ---------- same day ---------- */
var SAMEDAY = [
  ['wound discharge or smell', near(WOUND, 'weep\\w*|ooz\\w*|leak\\w*|\\bpus\\b|gunk|discharg\\w*|drain\\w*|yellow\\w*|green\\w*|smell\\w*|stink\\w*|stinky|odou?r|foul|air kuning|nanah|berbau|busuk|berair|meleleh|臭|异味|脓|黄水|渗|流水', 60)],
  ['wound opening', near('staples?|stitch\\w*|sutures?|clips?|wound|incision|jahitan|luka|缝线|伤口|刀口', 'c[ao]me apart|coming apart|separat\\w*|pull\\w* apart|gap\\w*|parting|part(?:ed)? ways|terpisah|renggang|分开|burst\\w*|popped|open(?:ed|ing)? up|has opened|is open\\b|gap\\w*|split\\w*|pulled apart|terbuka|ternganga|merekah|terkoyak|裂开|裂了|裂|崩开|开了', 40)],
  ['skin change at the wound', near(WOUND, 'blister\\w*|turn\\w* black|going black|black patch|dusky|melepuh|menghitam|jadi hitam|水泡|发黑|变黑', 50)],
  ['hot or red knee', [near(KNEE + '|skin|kulit|' + WOUND, '\\bhot\\b|burning hot|panas|烫|发烫', 30), near(KNEE + '|skin|kulit|' + WOUND, '(?:angry|bright|very|much|more|spreading|getting|makin|semakin|bertambah|越来越|更|很|又)\\s*(?:red\\w*|merah|红)|redness (?:is )?spread\\w*|red streak\\w*', 40)]],
  ['swelling increasing', /balloon\w*|blown up|(?:doubled|twice|double) (?:in |the )?size|(?:huge|massive|enormous)(?:ly)? (?:swollen|swelling)|swoll\w* (?:up )?(?:overnight|suddenly|all of a sudden)|shiny and (?:red|tight)|membengkak (?:besar|teruk)|bengkak (?:besar|teruk) sangat|肿得很大|肿成|(?:much|far|a lot|lot) more swollen|more swollen (?:than|today|now)|swelling (?:is |has )?(?:getting worse|got worse|increas\w*|worse|spread\w*|gone up)|(?:bigger|more swollen) than (?:yesterday|before|the other)|(?:makin|semakin|bertambah|lagi) bengkak|bengkak (?:makin|semakin|bertambah) (?:teruk|besar)|比(?:昨天|之前|以前)[^。.;]{0,4}肿|肿得[^。.;]{0,3}(?:更|很)厉害|越来越肿|肿很多/],
  ['fever reported', /running a (?:temp\w*|fever)|\bfeverish\b|(?:got|have|having|with) a (?:high )?temp\w*|temp\w* (?:is |has been )?(?:up|high|raised)|high temp\w*|burning up|hot and cold|badan (?:saya )?(?:panas|hangat)|rasa (?:nak )?demam|demam|发烧|发热|发高烧/],
  ['fall or knee injury', /\b(?:slipped|tripped|stumbled)\b[^.;]{0,40}(?:fell|landed|knee|leg|floor|ground|shower|bathroom|stairs)|landed on (?:my |the |his |her )?(?:new |operated |bad |sore )?(?:knee|leg|hip|side)|knee[^.;]{0,20}(?:gave way|gave out|buckled|twisted)|heard (?:a |something )?(?:loud )?(?:pop\w*|crack\w*|snap\w*|clunk)|tergelincir|tersadung|terseliuh|terkehel|lutut[^.;]{0,15}(?:terhentak|terhempas|terpulas)|(?<!怕|害怕|担心|会不会|防止|避免|以免|万一|如果)(?:摔了|摔倒|跌倒|滑倒)|扭到|响了一声/],
  ['pain not controlled', /(?:unbearable|excruciating|agoni[sz]ing|intolerable)|\bin agony\b|(?:can'?t|cannot) (?:bear|stand|take|cope with|tolerate) (?:the |this )?pain|pain[^.;]{0,30}(?:10 ?(?:out of|\/) ?10|9 ?(?:out of|\/) ?10|worst (?:ever|i have|i'?ve)|not controlled|out of control)|(?:10|9) ?(?:out of|\/) ?10[^.;]{0,15}pain|(?:tablets?|pills?|painkillers?|medicine|meds)[^.;]{0,20}(?:not|n'?t|no longer|stopped) (?:work\w*|help\w*|touch\w*)|nothing (?:helps|works|is helping|touches)[^.;]{0,15}(?:pain)?|sakit[^.;]{0,15}(?:tak tahan|tak tertahan|teramat|sangat kuat|kuat sangat|melampau)|tak tahan sakit|ubat[^.;]{0,15}(?:tak|tidak) (?:jalan|berkesan|membantu|kurang)|痛得受不了|疼得受不了|痛到受不了|忍不住|剧痛|止痛药[^。.;]{0,8}(?:没用|无效|不管用|没效)/],
  ['cannot stand or walk on the leg', /(?:can'?t|cannot|couldn'?t|unable to|not able to) (?:put (?:any |much |my )?weight|bear weight|stand|walk|get up|straighten|bend)|(?:tak|tidak) (?:boleh|dapat|mampu) (?:pijak|berdiri|berjalan|jalan|bangun|luruskan|bengkok)|(?:不能|无法|没办法)(?:站|走|踩|下地|弯|伸直)|站不起来|走不了/],
  ['vomiting that will not settle', [near('all day|all night|all morning|keep\\w*|kept|since yesterday|several times|many times|non.?stop|constantly|again and again|sepanjang|banyak kali|berkali|tak berhenti|一直|好几次|不停|很多次', 'vomit\\w*|throw\\w* up|threw up|being sick|been sick|muntah|吐|呕', 50), /(?:can'?t|cannot) keep (?:anything|food|water|fluids|my (?:tablets|medicine|meds)) down|nothing stays down/]],
  ['cannot pass urine', /(?:have not|haven'?t|has not|hasn'?t|not) (?:urinated|peed|pee'?d|weed|passed (?:any )?(?:urine|water))|no urine (?:since|for|all)|belum (?:kencing|buang air kecil)|tak kencing (?:sejak|dari)|(?:没有|没|还没)(?:小便|排尿|尿)|(?:can'?t|cannot|couldn'?t|unable to|not able to|haven'?t been able to|not been able to|haven'?t) (?:pee|wee|urinate|pass(?:ed)? (?:any )?(?:urine|water))|(?:tak|tidak) (?:boleh|dapat) (?:kencing|buang air kecil)|(?:尿不出|排不出尿|小便不出|不能小便|无法排尿)/],
  ['distress: cannot cope', /(?:can'?t|cannot) (?:cope|take (?:it|this)|do this) (?:any ?more|anymore|any longer)|at (?:my|the end of my) (?:wits'? end|tether)|dah tak (?:tahan|larat) (?:lagi|sangat)|我受不了了|撑不下去/],
  ['fast heartbeat', /heart (?:is |was |keeps )?(?:rac\w*|pound\w*|flutter\w*)|palpitat\w*|jantung[^.;]{0,10}(?:berdebar|laju)|心跳[^。.;]{0,4}(?:快|乱)|心悸|心慌/]
];

/* ---------- the two narrow reductions ---------- */
var ALARM_WORD = /(?<![a-z])(?:sudden|suddenly|cannot|can'?t|unable|numb|blue|severe|worse|worsening|teruk|tiba-tiba|tak boleh|kebas)(?![a-z])/gi;
var BODY_RE = null;
var BODY = 'leg|knee|foot|feet|toes?|calf|calves|thigh|hip|ankle|arm|hand|fingers?|chest|head|neck|back|tummy|stomach|belly|eye|face|skin|wound|scar|stitch\\w*|dressing|bandage|kaki|lutut|betis|peha|tangan|dada|kepala|perut|luka|jahitan|mata|muka';
var SYMPTOM = 'pain\\w*|hurt\\w*|ach\\w*|sore|bleed\\w*|blood|breath\\w*|swell\\w*|swollen|fever\\w*|dizz\\w*|vomit\\w*|sick|nause\\w*|rash|itch\\w*|cramp\\w*|stiff\\w*|weak\\w*|tingl\\w*|sakit|darah|nafas|bengkak|demam|pening|muntah|loya|lemah|kejang';
var FUNCTION = 'walk\\w*|stand\\w*|mov\\w*|bend\\w*|straighten|weight|pee|urin\\w*|bowel|poo|eat|drink|swallow|see|vision|speak|talk|feel|wake|lift|jalan|berjalan|berdiri|gerak|bergerak|kencing|makan|minum|telan|rasa|angkat';
BODY_RE = new RegExp('(?<![a-z])(?:' + BODY + '|lips?|tongue|nails?|bibir)(?![a-z])', 'i');
var CTX_RE = new RegExp('(?<![a-z])(?:' + BODY + '|' + SYMPTOM + '|' + FUNCTION + ')(?![a-z])', 'i');
// "I can't wait", "can't thank you enough", "walking frame", "walking stick": not about the body
var NOT_BODY_RE = /can'?t wait|cannot wait|can'?t thank|walking (?:frame|stick|aid)|see (?:you|the doctor|my|if)|feel free|talk to|speak to|speak with|talk with/gi;
function alarmHasContext(text) {
  var t = String(text).toLowerCase().replace(NOT_BODY_RE, ' ');
  if (/[一-鿿؀-ۿ]/.test(t)) return true;                 // Chinese and Arabic: keep the engine's result (not narrowed, not measured)
  var g = new RegExp(ALARM_WORD.source, 'gi'), m;
  while ((m = g.exec(t))) { var w = t.slice(Math.max(0, m.index - 60), m.index + m[0].length + 60); if (m[0].toLowerCase() === 'blue' ? BODY_RE.test(w) : CTX_RE.test(w)) return true; }
  return false;
}
var QFRAME = /^\s*(?:hi[ ,.]+|hello[ ,.]+|doctor[ ,.]+|dr[ ,.]+|nurse[ ,.]+)?(?:is it|is a |is some|is having|are |does |do people|do most|can a |could a |will i |would i |what (?:if|should i do if|do i do if|happens if|would happen if|counts as|is a)|how (?:do i know|will i know|would i know|can i tell|high)|should i (?:expect|worry|be worried)|when should i|at what)|\b(?:normal|common|expected|usual)\b[^.!]{0,40}\?|^\s*(?:adakah|apakah|apa (?:perlu|patut|nak) (?:saya )?buat (?:jika|kalau|bila)|kalau|jika|macam mana kalau|bagaimana jika)|(?:kalau|jika)[^.!]{0,40}(?:macam mana|bagaimana)|(?:biasa|normal)(?:kah)?\s*\?|正常吗|正常嗎|怎么办|会不会|如果|要是|万一/i;
var REPORT = /\b(?:i have|i'?ve|i got|i am|i'?m|i feel|i felt|i think i|i noticed|i woke|i can|i cannot|i can'?t|he has|she has|he is|she is|(?:my|the|his|her) (?:temp\w*|wound|knee|leg|calf|dressing|bandage|stitches|scar|cut) (?:is|has|feels|looks|keeps|was|started)|it is|it'?s|since|today|tonight|now|this (?:morning|afternoon|evening)|yesterday|last night|again|still|just)\b|\d{2}(?:\.\d)?|saya (?:ada|rasa|demam|dah|sudah)|sejak|tadi|semalam|sekarang|hari ini|malam tadi|masih|我(?:有|在|发|觉得|现在)|今天|昨天|昨晚|现在|刚才|一直|还在|了/i;
function generalQuestion(text) { return QFRAME.test(text) && !REPORT.test(text); }

function classify(text, ctx) {
  var r = E.classify(text, ctx);
  // The engine reads "scared" as scar + red (a wound change). Re-read without those words; use the result only if it is no longer urgent.
  if (r.cls === 'SAME-DAY' && (r.flags || []).length === 1 && r.flags[0] === 'wound change' && /scar(?:ed|y|e|es|ing|f)\b|terrified|worried|covered|bored|tired|ordered|registered|preferred|referred|required/i.test(String(text))) {
    var r2 = E.classify(String(text).replace(/\b\w*(?:scar(?:ed|y|e|es|ing|f)|terrified|worried|covered|bored|tired|ordered|registered|preferred|referred|required)\b/gi, ' '), ctx);
    if (r2.cls !== 'SAME-DAY' && r2.cls !== 'EMERGENCY') { r = r2; r.rescanned = true; }
  }
  var t = E.arNorm(String(text)).toLowerCase().replace(/\s+/g, ' ');
  var out = Object.assign({}, r, { flags: (r.flags || []).slice(), engineCls: r.cls, changed: '' });
  var em = EMERGENCY.filter(function (x) { return hit(t, x[1]); }).map(function (x) { return x[0]; });
  if (em.length) {
    em.forEach(function (f) { if (out.flags.indexOf(f) < 0) out.flags.push(f); });
    if (r.cls !== 'EMERGENCY') { out.cls = 'EMERGENCY'; out.changed = 'raised by the added emergency wording: ' + em.join('; '); out.flags = em; }
    return out;
  }
  if (r.cls === 'EMERGENCY') return out;
  var sd = SAMEDAY.filter(function (x) { return hit(t, x[1]); }).map(function (x) { return x[0]; });
  if (r.cls === 'SAME-DAY') {
    var fl = r.flags || [];
    var onlyAlarm = fl.length === 1 && /unrecognised alarm words/.test(fl[0]);
    var onlyInfo = fl.length > 0 && fl.every(function (f) { return f === 'fever reported' || f === 'wound change'; });
    if (onlyAlarm && !sd.length && !alarmHasContext(text)) { out.cls = 'ROUTE'; out.flags = ['no approved answer']; out.changed = 'lowered: alarm word with no body, symptom or function word near it'; out.noAnswer = true; return out; }
    if (onlyInfo && generalQuestion(String(text))) { out.cls = 'ROUTE'; out.flags = ['general question about ' + (fl[0] === 'wound change' ? 'the wound' : 'fever')]; out.topicHint = fl[0] === 'wound change' ? 'wound_signs' : 'fever_info'; out.changed = 'lowered: a general question, no report of the symptom'; out.noAnswer = true; return out; }
    sd.forEach(function (f) { if (out.flags.indexOf(f) < 0) out.flags.push(f); });
    return out;
  }
  if (sd.length) {
    var infoOnly = sd.every(function (f) { return f === 'fever reported' || f === 'wound discharge or smell' || f === 'wound opening'; });
    if (infoOnly && generalQuestion(String(text))) { out.topicHint = sd[0] === 'fever reported' ? 'fever_info' : 'wound_signs'; out.flags = ['general question about ' + (sd[0] === 'fever reported' ? 'fever' : 'the wound')]; return out; }
    out.cls = 'SAME-DAY'; out.flags = sd; out.changed = 'raised by the added same-day wording: ' + sd.join('; ');
  }
  return out;
}

module.exports = { classify: classify, alarmHasContext: alarmHasContext, generalQuestion: generalQuestion, EMERGENCY: EMERGENCY, SAMEDAY: SAMEDAY };
