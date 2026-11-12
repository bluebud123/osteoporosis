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

var NEG = /(?:\bno\b|\bnot\b|\bnever\b|\bwithout\b|\bnor\b|\bisn'?t\b|\bwasn'?t\b|\bdon'?t have\b|\bdidn'?t\b|\bdoesn'?t\b|tiada|tidak|\btak\b|takde|takda|\btkde\b|\bxde\b|bukan|belum|没有|沒有|没|无|不是|不|لا يوجد|لا اشعر ب?|لا اعاني من|ما في|ما فيه|مافي|ما عندي|ماعندي|ما احس ب?|بدون|مفيش|ليست|ليس|مو|مش|مب|غير|ولا|لا)\s*(?:any |a |the |my |ada |rasa |really |very |pun |ada rasa |اي |عندي |لدي |فيه |فيها |في |به )?$/i;
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
  ['chest pain or pressure', /(?:someone|something|weight|band|brick|elephant)[^.;]{0,25}(?:on|around|across) (?:my |his |her |the )?chest|chest[^.;,]{0,30}(?:\bach\w*|discomfort|heav\w*|pressure|tight\w*|squeez\w*|burn\w*|stab\w*|sharp)|(?:\bach\w*|discomfort|heav\w*|pressure|tight\w*|squeez\w*|stab\w*|sharp)[^.;,]{0,20}chest|dada[^.;]{0,20}(?:ketat|sempit|berat|sakit|pedih|mencucuk|sesak|dihempap|ditindih|dihimpit|ditekan|tertekan)|(?:sakit|ketat|sesak|berat)[^.;]{0,8}dada|胸[^。.;]{0,6}(?:痛|闷|紧|压)|心口[^。.;]{0,6}(?:痛|闷)/],
  ['heavy bleeding that will not stop', /(?:blood|bleed\w*)[^.;]{0,30}(?:pour\w*|gush\w*|spurt\w*|squirt\w*|non.?stop|won'?t stop|will not stop|not stopping|doesn'?t stop|everywhere)|(?:pour\w*|gush\w*|spurt\w*)[^.;]{0,15}blood|soaked through[^.;]{0,25}(?:towels?|sheets?|clothes|pads?)|(?:towels?|sheets?)[^.;]{0,25}(?:soaked|full of blood)|darah[^.;]{0,25}(?:banyak|mencurah|memancut|tak berhenti|tidak berhenti|tak henti)|berdarah[^.;]{0,15}(?:banyak|teruk|tak berhenti|tidak berhenti)|(?:流血|出血)[^。.;]{0,8}(?:不止|止不住|不停|很多|大量)|一直(?:在)?(?:流血|出血)|血流不止/],
  ['blue or grey colour', /\b(?:he|she|they|i|baby|dad|mum|mom|father|mother|husband|wife|patient)\b[^.;]{0,15}(?:is |are |am |has |have )?(?:turn\w*|gone|going|looks?|look\w*) (?:blue|grey|gray|purple|ashen)|(?:muka|bibir|badan)[^.;]{0,12}(?:biru|kebiruan|pucat lesi)|(?:脸|嘴唇|全身)[^。.;]{0,4}(?:发紫|发青|发灰)/],
  ['coughing blood', near('cough\\w*|phlegm|sputum|spit\\w*|spat|kahak|batuk|ludah|咳\\w*|痰', BLOOD, 30)],
  ['vomiting blood', near('vomit\\w*|threw up|throw\\w* up|puk\\w*|was sick|been sick|muntah|吐|呕', BLOOD, 30)],
  ['confusion or reduced consciousness', /\bmuddled\b|\bconfus\w*|\bdelirious\b|\bdelirium\b|hallucinat\w*|seeing things|(?:doesn'?t|does not|don'?t|didn'?t) (?:know|recogni[sz]e) (?:what day|where|who|me|us|her|his)|not (?:making|talking) (?:any )?sense|talking (?:nonsense|gibberish|rubbish)|not (?:himself|herself|myself)|very (?:drowsy|sleepy)|hard to (?:wake|rouse)|can'?t (?:wake|rouse)|\bkeliru\b|meracau|merapu|tak kenal (?:orang|saya|kami)|tak sedar|神志不清|胡言乱语|不认得人|意识不清|迷糊/],
  ['possible severe allergy', [near('face|eyes?|eyelids?|lips?|tongue|throat|muka|mata|bibir|lidah|tekak|脸|眼|嘴唇|舌|喉', 'puff\\w*|swell\\w*|swollen|bengkak|sembab|肿', 25), near('rash|hives|\\bitch\\w*|ruam|gatal|皮疹|痒', 'breath\\w*|wheez\\w*|throat (?:is )?(?:tight|clos)\\w*|sesak nafas|呼吸困难', 40)]],
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

/* ====================================================================================================================
 * v3 (12 Nov 2026). Added after an independent AI review (reviewer set app/eval/triage_h4.js, see docs/decision-log.md v3).
 * Everything here RAISES, with one exception at the end (adminConfusion), which is marked for clinician sign-off.
 * Still AI-written and unreviewed by any clinician or native speaker.
 * ==================================================================================================================== */
// Traditional -> simplified for the characters the rules and common symptom words use. The engine and the lists above are
// written in simplified characters; a patient in Malaysia, Taiwan or Hong Kong may type traditional ones.
var T2S = {'難':'难','過':'过','氣':'气','傷':'伤','發':'发','燒':'烧','熱':'热','腫':'肿','腳':'脚','膿':'脓','縫':'缝','線':'线','紗':'纱','開':'开','嘔':'呕','暈':'晕','悶':'闷','緊':'紧','壓':'压','臉':'脸','說':'说','話':'话','講':'讲','認':'认','識':'识','亂':'乱','語':'语','頭':'头','藥':'药','兩':'两','沒':'没','無':'无','還':'还','這':'这','個':'个','們':'们','嗎':'吗','麼':'么','麽':'么','會':'会','萬':'万','醫':'医','謝':'谢','診':'诊','復':'复','複':'复','時':'时','間':'间','問':'问','題':'题','術':'术','後':'后','見':'见','覺':'觉','現':'现','點':'点','來':'来','邊':'边','側':'侧','體':'体','膚':'肤','紅':'红','燙':'烫','變':'变','涼':'凉','痺':'痹','軟':'软','癲':'癫','癇':'痫','應':'应','動':'动','對':'对','嚴':'严','劇':'剧','厲':'厉','壞':'坏','滲':'渗','濕':'湿','髒':'脏','臟':'脏','響':'响','聲':'声','聽':'听','脣':'唇','嚨':'咙','脹':'胀','癢':'痒','蓋':'盖','關':'关','節':'节','針':'针','劑':'剂','顆':'颗','殺':'杀','絕':'绝','讓':'让','給':'给','請':'请','幫':'帮','裡':'里','裏':'里','著':'着','為':'为','從':'从','終':'终','與':'与','經':'经','剛':'刚','樣':'样','辦':'办','幾':'几','歲':'岁','樓':'楼','廁':'厕','檢':'检','驗':'验','報':'报','結':'结','單':'单','預':'预','約':'约','號':'号','車':'车','門':'门','惡':'恶','噁':'恶','瀉':'泻','腸':'肠','腎':'肾','腦':'脑','頸':'颈','髖':'髋','彎':'弯','淚':'泪','煩':'烦','慮':'虑','擔':'担','驚':'惊','嚇':'吓','飯':'饭','喫':'吃','暫':'暂','穩':'稳','斷':'断','漲':'涨','濃':'浓','滿':'满','層':'层','塊':'块','條':'条','張':'张','隻':'只','雙':'双','歪':'歪','嘴':'嘴','貼':'贴','繃':'绷','帶':'带','換':'换','掉':'掉','鬆':'松','鐘':'钟','鍾':'钟','號':'号','麻':'麻','癱':'瘫','瘓':'痪','廢':'废','總':'总','實':'实','記':'记','憶':'忆','錯':'错','亂':'乱','糊':'糊','塗':'涂','識':'识','醒':'醒','叫':'叫','喚':'唤','暈':'晕','昏':'昏','厥':'厥','癥':'症','狀':'状','況':'况','嚴':'严','緩':'缓','減':'减','輕':'轻','長':'长','漸':'渐','夠':'够','飽':'饱','餓':'饿','渴':'渴','齒':'齿','齦':'龈','鼻':'鼻','淚':'泪','詢':'询','諮':'咨','費':'费','錢':'钱','險':'险','保':'保','賬':'账','帳':'账'};
var T2S_RE = new RegExp('[' + Object.keys(T2S).join('') + ']', 'g');
// Text-speak and missing apostrophes. Only rewrites into the plain form the rules already know; never removes words.
function normalise(text) {
  var s = String(text == null ? '' : text);
  s = s.replace(T2S_RE, function (c) { return T2S[c]; });
  s = s.replace(/\b(c)(?:nt|n't|ant)\b/gi, "$1an't").replace(/\b(do|does|did|is|are|was|were|has|have|had|wo|would|could|should)nt\b/gi, "$1n't")
       .replace(/\bcannt\b/gi, 'cannot')
       .replace(/(?<![a-z])(?:x|tak|tk|x\s|tak\s|tk\s)(?:leh|bleh|boleh|blh)(?![a-z])/gi, 'tak boleh')
       .replace(/(?<![a-z])tiba\s?2(?![a-z0-9])/gi, 'tiba-tiba')
       .replace(/(?<![a-z])(?:x|tk)\s?(de|da|ada)(?![a-z])/gi, 'tak ada');
  // "sob" as shortness of breath only with a time or severity word; "cp" as chest pain only with a radiation or chest word
  if (/(?<![a-z])sob(?![a-z])/i.test(s) && /since|for \d|today|tonight|now|morning|night|hours?|days?|worse|worsening|severe|bad|getting|on exertion|at rest|walking|lying|and (?:chest|cp|calf|leg)|with (?:chest|cp|calf|leg)|\+/i.test(s) && !/sobbing|sob story/i.test(s)) s = s.replace(/(?<![a-z])sob(?![a-z])/gi, 'short of breath');
  if (/(?<![a-z])cp(?![a-z])/i.test(s) && /radiat|arm|jaw|shoulder|sweat|crush|tight|short of breath|breath|since|now|worse/i.test(s)) s = s.replace(/(?<![a-z])cp(?![a-z])/gi, 'chest pain');
  return s;
}
function RANK(c) { return c === 'EMERGENCY' ? 2 : c === 'SAME-DAY' ? 1 : 0; }
// Furniture and figures of speech that contain a body word. Removed before the ADDED wording is matched (the engine still sees the raw text).
var IDIOM = /chest of drawers|treasure chest|tool ?chest|chest freezer|ice ?chest|pain in the neck|breath of fresh air|took my breath away|breath ?taking/g;
var ANTICOAG = 'blood thinners?|anticoagulants?|warfarin|rivaroxaban|xarelto|apixaban|eliquis|dabigatran|enoxaparin|clexane|ubat cair darah|pencair darah|抗凝药?|血薄药|مميع الدم|مسيل الدم|ابره السيوله|ابر السيوله';
var MANY = '(?:[4-9]|[1-9]\\d+|four|five|six|seven|eight|nine|ten|twenty|a dozen|empat|lima|enam|tujuh|lapan|sembilan|sepuluh|[四五六七八九十]|[一二三四五六七八九]十)';
var AR_BREATH = 'ضيق (?:في )?(?:ال)?(?:تنفس|نفس)|ضيقه (?:في )?(?:ال)?(?:تنفس|نفس|صدر)|صعوبه (?:في |ب)?(?:ال)?تنفس|كتمه|مكتوم|اختناق|اختنق|بختنق|مخنوق|(?:لا استطيع|لا اقدر|ما اقدر|ما اگدر|مااقدر|مو قادر|مب قادر|مش قادر|مش عارف|ما قادر|مو قادره|مش قادره|ما يقدر|مو قادر|مش قادر) (?:ان )?(?:ا|ي|ت)?(?:تنفس|اخد نفسي|اخذ نفسي|ياخد نفسه|ياخذ نفسه|اخد نفس|اخذ نفس)|نفسي (?:مقطوع|ضيق|قصير|تقيل|ثقيل)|انقطاع (?:ال)?نفس|يلهث|الهث|انهج|بنهج';
EMERGENCY.push(
  ['self-harm statement', /(?:don'?t|do not|dont) want to (?:be alive|live|wake up|go on)(?: any ?more| anymore)?\b|(?:don'?t|do not|dont) want to be here(?: any ?more| anymore| at all)?\s*(?:[.!?,]|$)|kill(?:ing)? my ?self|end(?:ing)? my (?:own )?life|tak(?:e|ing) my (?:own )?life|suicid\w*|hurt(?:ing)? myself|harm(?:ing)? myself|bunuh diri|tamatkan (?:hidup|riwayat)|tak mahu hidup|taknak hidup|malas hidup|想死|自杀|轻生|结束(?:自己的)?生命|不想再活|了结自己|انتحر|انتحار|انتحاري|اقتل نفسي|اموت نفسي|انهي حياتي|اخلص من حياتي|(?:ما ابي|ما ابغى|مابي|مش عايز|مش عاوز|لا اريد|ما بدي)(?: ان)? اعيش|اتمنى الموت|ابي اموت|ابغى اموت|عايز اموت|بدي اموت/],
  ['possible overdose', new RegExp('(?:took|taken|swallow\\w*|ate|had|popped|makan|termakan|telan|tertelan|ambil|terambil)\\s+(?:about |around |like |all |semua )?' + MANY + '\\s+(?:of (?:my |the |his |her )?)?(?:\\w+\\s+){0,2}?(?:' + MED + ')|(?:took|taken|swallow\\w*|ate|finished|emptied|makan|telan|tertelan|habiskan)[^.;]{0,25}(?:whole|entire|all (?:of )?(?:the|my|his|her)|sepapan|sebotol|sekotak|semua)[^.;]{0,12}(?:strip|box|bottle|pack(?:et)?|blister|tub|' + MED + ')|(?:吃了?|吞了?|服了?)\\s*(?:' + MANY + '|整[瓶盒板包]|一整[瓶盒板包]|全部)[^。.;]{0,8}(?:药|片|颗|粒)|(?:اخذت|اخدت|بلعت|شربت|اكلت|اخذ|اخد|بلع)[^.;،]{0,20}(?:علبه|شريط|كل (?:ال)?(?:حبوب|دوا|دواء|ادويه)|جرعه زايده|جرعه زائده|حبوب كثير|حبوب وايد)|overdos\\w*|\\bOD\'?d\\b|جرعه (?:زايده|زائده)|terlebih dos', 'i')],
  ['pain on breathing in', /(?:pain|pains|hurts?|hurting|sharp|stabb?ing|catch\w*)[^.;]{0,25}(?:when|whenever|every ?time|each time|as|if) (?:i |he |she )?(?:breathe?s?|breathing|inhale\w*|take (?:a |in a )?(?:deep )?breath|cough\w*)|(?:hurts?|painful|sore|agony) to (?:breathe|take a breath|inhale)|(?:sakit|pedih|mencucuk)[^.;]{0,20}(?:bila|masa|waktu|kalau|setiap kali) (?:saya |aku |dia )?(?:tarik nafas|bernafas|nafas|batuk)|(?:吸气|呼吸|深呼吸|喘气)[^。.;]{0,4}(?:就|会|时|的时候)?[^。.;]{0,3}(?:痛|疼)|(?:الم|وجع|نغزه|يوجعني|يعورني)[^.;،]{0,20}(?:لما|عند|مع|وقت|كل ما) (?:ال)?(?:اتنفس|تنفس|شهيق|اخذ نفس|اخد نفس)/],
  ['coughing blood', near('cough\\w*|spit\\w*|spat|phlegm|sputum|hack\\w*', 'something red|red (?:stuff|streaks?|specks?|bits?|spots?|phlegm|spit)|pink(?:ish)? (?:froth\\w*|foam\\w*|phlegm|spit)|rust\\w* (?:colou?red|phlegm|spit)', 30)],
  ['coughing blood', /kahak[^.;]{0,12}(?:merah|berdarah)|咳[^。.;]{0,6}(?:红色|血丝|带血)|(?:اسعل|اكح|كحه|سعال|بكح|اكحكح)[^.;،]{0,15}(?:دم|دما)|بلغم[^.;،]{0,10}(?:دم|احمر)/],
  ['breathlessness lying down', /(?:feel\w*|feels) like (?:i'?m |i am |im |he'?s |she'?s )?(?:drowning|suffocat\w*|being (?:strangled|smothered))|(?:drowning|suffocat\w*|smother\w*)[^.;]{0,30}(?:lie|lying|lay|laying|flat|sleep\w*|bed)|(?:can'?t|cannot) (?:lie|lay) (?:down|flat)[^.;]{0,40}(?:breath\w*|air)|(?:have|need) to sit up to breathe|(?:sesak|lemas|semput)[^.;]{0,15}(?:bila|masa|waktu) (?:baring|tidur)|(?:躺下|平躺|躺着)[^。.;]{0,8}(?:喘|闷|透不过气|呼吸)/],
  ['breathlessness', new RegExp('short(?:ness)? of breath|breathless\\w*|(?:hard|difficult|struggl\\w*) to breathe|can\'?t breathe|(?:tak|tidak) boleh (?:ber)?nafas|sesak (?:sangat )?nafas|nafas (?:sangat )?sesak|气促|气急|气短|喘不上来|喘得厉害|很喘|' + AR_BREATH, 'i')],
  ['chest pain or pressure', /(?:الم|وجع|ضغط|ثقل|حرقان|نغزه|نغزات|كتمه|ضيق|ضيقه)[^.;،]{0,20}(?:صدر|صدري|قلبي)|(?:صدر|صدري)[^.;،]{0,20}(?:يوجع|يعور|يالم|الم|وجع|ضاغط|ثقيل|مكتوم|يحرق|واجعني|بيوجع|عم يوجع)|chest pain[^.;]{0,30}(?:radiat\w*|arm|jaw|shoulder|sweat\w*)|胸[^。.;]{0,4}(?:好痛|很痛|刺痛|绞痛)/],
  ['heavy bleeding that will not stop', /(?:نزيف|ينزف|بينزف|نزف|الدم|دم)[^.;،]{0,25}(?:لا يتوقف|لا يقف|ما يوقف|ما وقف|ما يتوقف|مو راضي يوقف|مش بيقف|مش راضي يقف|مش بيوقف|ما عم يوقف|مستمر|غزير|بغزاره|يصب|ينزل بقوه)|نزيف (?:شديد|حاد|قوي|كثير|وايد)|(?:blood|bleed\w*)[^.;]{0,50}(?:dripping|drips|running down|pooling|pool of|puddle|on(?:to)? the floor|all over the (?:floor|bed|sheets?))|darah[^.;]{0,25}(?:menitik|menitis|atas lantai|membasahi)|血[^。.;]{0,8}(?:滴|流到|流了一地|浸透)/],
  ['collapse or unresponsive', /(?:فاقد|فاقده|فقد|فقدت) (?:ال)?وعي|اغمي علي\w*|مغمى علي\w*|غايب عن الوعي|غاب عن الوعي|(?:ابوي|ابي|امي|زوجي|زوجتي|ولدي|ابني|بنتي|اخوي|اختي|جدي|جدتي|المريض|المريضه|والدي|والدتي)[^.;،]{0,30}(?:ما يرد|ما ترد|مش بيرد|مش بترد|ما يصحى|ما تصحى|مش بيصحى|لا يستجيب|لا تستجيب|ما يتحرك|مو راضي يصحى|مش راضي يصحى)|(?:won'?t|will not|doesn'?t|can'?t get (?:him|her|them) to) wake(?: up)?|(?:passed|blacked|knocked) out|unconscious|unresponsive|昏过去|昏迷|不省人事|没反应|没有反应|tak sedar(?:kan)? diri|tidak sedarkan diri/],
  ['confusion or reduced consciousness', /(?:cakap|bercakap) (?:merepek|mengarut|bukan-bukan|tak tentu (?:hala|arah)|pelik-pelik)|merepek|mengarut|nyanyuk tiba|acting (?:strange|weird|odd|funny)[^.;]{0,30}(?:doesn'?t|does not|don'?t) know|(?:يهذي|تهذي|يخربط|تخربط|مو صاحي|مش واعي|مش مركز خالص|ما يعرفني|ما تعرفني|مش عارفني|لا يعرف (?:اين|من))/],
  ['fast heartbeat with faintness, chest or breathing symptoms', near('faint|pass out|black out|dizz\\w*|light ?headed|chest|breath\\w*|pitam|pening|pengsan|nafas|dada|晕|胸|气|冷汗|دوخه|دايخ|اغمى|صدر|نفس', 'heart (?:is |was |keeps )?(?:skipp\\w*|beating (?:so |very |really |too )?fast|hammer\\w*|jump\\w*)|heart rate (?:is )?(?:very |really |so )?(?:fast|high)|jantung[^.;]{0,12}(?:berdegup|degup)[^.;]{0,8}(?:laju|kencang)|心脏[^。.;]{0,6}跳[^。.;]{0,6}(?:快|乱|厉害)|心跳得[^。.;]{0,4}(?:快|厉害)|قلبي[^.;،]{0,12}(?:يدق|بيدق|يخفق|ينبض)[^.;،]{0,10}(?:بسرعه|سريع|بقوه|وايد)|خفقان', 60)],
  ['leg swelling with breathlessness', near('calf|leg|betis|kaki|小腿|腿|رجل|رجلي|ساق|ساقي|بطه', 'short(?:ness)? of breath|breathless\\w*|out of breath|can\'?t breathe|sesak|semput|喘|气促|' + AR_BREATH, 90)]
);
SAMEDAY.push(
  ['knee locked', /knee[^.;]{0,25}(?:locked|is stuck|got stuck|jammed|won'?t (?:bend|straighten|move|unlock)|will not (?:bend|straighten|move)|can'?t (?:bend|straighten) it)|lutut[^.;]{0,20}(?:terkunci|tersekat|tak boleh (?:bengkok|lurus|gerak))|膝盖?[^。.;]{0,6}(?:卡住|锁住|弯不了|伸不直)|(?:ركبه|ركبتي)[^.;،]{0,20}(?:علقت|معلقه|قفلت|ما تنثني|مش بتتني|ما تتحرك)/],
  ['pain not controlled', /(?:tablets?|pills?|painkillers?|medicine|meds|medication)[^.;]{0,25}(?:(?:n'?t|not|aren'?t|isn'?t) (?:doing|making)(?: (?:anything|a thing|much|any difference))?|do(?:es|ing)? (?:nothing|sod all|naff all)|useless|no (?:use|good|effect))|(?:up|awake) all night[^.;]{0,25}(?:pain|crying|in tears|agony)|crying (?:with|from|in) (?:the )?pain|ubat[^.;]{0,20}(?:tak (?:jalan|kesan|berkesan|guna|lut)|tiada kesan)|(?:مسكن|المسكن|المسكنات|الحبوب|الدوا|الدواء)[^.;،]{0,20}(?:ما ينفع|ما نفع|ما يفيد|مش نافع|مش جايب نتيجه|بدون فايده|ما سوى شي)|(?:الم|وجع)[^.;،]{0,15}(?:لا يحتمل|ما ينتحمل|ما اتحمله|مش قادر استحمل|فظيع|شديد جدا)/],
  ['anticoagulant doses missed', new RegExp('(?:missed|skipped|forgot\\w*|forgotten|haven\'?t (?:taken|had|been taking)|not (?:taken|had|been taking)|ran out of|run out of|stopped (?:taking )?|terlupa|lupa|tertinggal|tak (?:makan|ambil|cucuk)|habis|忘了?|忘记|没打|没吃|停了|نسيت|ما اخذت|ما اخدت|خلص|وقفت)[^.;،。]{0,35}(?:' + ANTICOAG + ')[^.;،。]{0,30}(?:\\d+|two|three|four|few|several|couple|dua|tiga|beberapa|[两三四几]|يومين|ايام|اسبوع)\\s*(?:days?|doses?|nights?|weeks?|hari|dos|minggu|天|次|针|يوم|جرعات)?|(?:' + ANTICOAG + ')[^.;،。]{0,25}(?:missed|skipped|forgot\\w*|ran out|run out|terlupa|habis|忘了?|停了|نسيت|خلص)[^.;،。]{0,25}(?:\\d+|two|three|few|several|couple|dua|tiga|beberapa|[两三四几])\\s*(?:days?|doses?|nights?|hari|dos|天|次)', 'i')],
  ['wound discharge or smell', near(WOUND + '|جرح|الجرح|غرز|خياطه|ضماد|الضماد|شاش', 'keluar (?:air|cecair|nanah)|mengeluarkan (?:air|cecair|nanah)|bernanah|basah (?:kuyup|lencun)|有臭味|发臭|有味道|流脓|化脓|流液|صديد|قيح|خراج|افرازات|ريحه (?:كريهه|مو زينه|وحشه|خايسه)|رائحه كريهه|يطلع منه (?:مويه|ماي|سائل)|يخرج منه (?:سائل|ماء)|ينز|مبلول', 60)],
  ['wound opening', near('جرح|الجرح|غرز|الغرز|خياطه|الخياطه', 'انفتح|انفتحت|مفتوح|فتح|فتحت|انفكت|تفككت|طلعت', 30)],
  ['hot or red knee', near('ركبه|ركبتي|الركبه|رجل|رجلي|ساق|ساقي|الجرح|جرح|جلد', 'حمراء|حمرا|احمرار|محمره|محمر|ساخنه|ساخن|حاره|حار|سخنه|سخن|سخونه|ملتهب|ملتهبه|التهاب', 30)],
  ['fever reported', /(?:حراره|حرارتي|سخونه|حمى)[^.;،]{0,12}(?:3[89]|4[01])|(?:عندي|فيني|جاتني|صابتني) (?:حراره|سخونه|حمى)|(?:chills|shivers?|shivering|rigors?)[^.;]{0,20}(?:shak\w*|sweat\w*|all night|can'?t stop)|menggigil|发抖[^。.;]{0,6}(?:发冷|出汗)|قشعريره|ارتجف|برديه/],
  ['fall or knee injury', /(?:طحت|وقعت|سقطت|تزحلقت|تعثرت)[^.;،]{0,25}(?:ركبه|ركبتي|رجلي|الارض|الدرج|الحمام)?/]
);
/* v3, second round: the misses found by fresh set 5 (app/eval/triage_h5.js), measured once BEFORE these lines were written
 * (emergencies alerted 39/46, same-day 20/23, false alerts 0/30). Set 5 is therefore a "seen" regression set from here on. */
EMERGENCY.push(
  ['self-harm statement', /no (?:reason|point) (?:for me )?(?:to|in) (?:keep(?:ing)? |go(?:ing)? on )?liv(?:e|ing)|lebih baik (?:saya |aku |kalau saya )?mati|baik (?:saya|aku) mati/],
  ['confusion or reduced consciousness', /(?:seeing|sees|hearing|hears) (?:people|things|someone|somebody|voices|animals|insects)[^.;]{0,25}(?:aren'?t|are not|isn'?t|is not|not|no one) (?:really )?there|hearing voices|nampak (?:benda|orang) yang (?:tak|tiada) ada|看到不存在|看见不存在|يشوف اشياء (?:مو|مش) موجوده/],
  ['patient reports a heart attack or stroke', /\bheart attack\b|having a stroke|serangan jantung|angin ahmar|\bstrok\b|心脏病发|心肌梗|中风|نوبه قلبيه|ازمه قلبيه|ذبحه صدريه|سكته|جلطه (?:في )?(?:القلب|الراس|الدماغ|الرئه)/],
  ['vomiting blood', near('vomit\\w*|threw up|throw\\w* up|puk\\w*|been sick|was sick|muntah|吐|呕|تقيات|استفرغت|رجعت', 'coffee.?grounds?|black|dark brown|hitam|kehitaman|黑色|咖啡色|咖啡渣|اسود|لون القهوه', 40)],
  ['possible overdose', new RegExp('(?:termakan|terambil|tertelan|makan|telan|ambil|took|taken|swallow\\w*)[^.;]{0,30}(?:' + MED + '|ubat tidur|sleeping (?:tablets?|pills?)|安眠药)[^.;]{0,15}(?:banyak sangat|terlalu banyak|banyak|sekali gus|all at once|at once|in one go)|(?:took|taken|swallow\\w*) all (?:of )?(?:my|the|his|her) (?:\\w+ ){0,2}(?:' + MED + ')', 'i')],
  ['breathlessness', /(?:ا|ي|ت)?تنفس بصعوبه|بصعوبه (?:ا|ي|ت)?تنفس|(?:اتعب|تعب|يتعب|تتعب) (?:في|من) (?:ال)?نفس|نفسه (?:مقطوع|ضيق|تقيل|ثقيل)|نفسها (?:مقطوع|ضيق|تقيل|ثقيل)/]
);
SAMEDAY.push(
  ['wound opening', near('cut|scar|operation site|op site|surgical site', 'has opened|have opened|opened|open(?:ed|ing)? up|c[ao]me apart|coming apart|gap\\w*|split\\w*|pulled apart', 40)],
  ['swelling increasing', /swoll?en (?:up )?(?:massively|hugely|enormously|a lot|badly|so much|really badly)|sw[eo]ll\w* up (?:massively|hugely|badly|a lot)|(?:massive|huge) swelling/],
  ['pain not controlled', new RegExp('(?:' + MED + ')[^.;]{0,25}(?:n\'?t|not|no longer|stopped) (?:touching|helping|working|doing|cutting|easing)', 'i')]
);
// v3 lowering, the only one: "I'm confused about my appointment" is an admin question, not delirium. Applies only when
// (a) the ONLY emergency sign is confusion, (b) "confus-" is followed by about/over/with/which/when + an appointment or booking word,
// (c) the writer is the first person, and (d) there is no body, symptom or disorientation word anywhere. AWAITING CLINICIAN SIGN-OFF.
var ADMIN_CONFUSED = /\b(?:i'?m|i am|im|i was|i got|i'?m a bit|i'?m still|got|getting|bit|little|still|so|quite|really)?\s*confus\w*\s+(?:about|over|with|by|regarding|as to|on)\s+(?:(?:my|the|which|what|when|where|whether|this|that|our|next|all)\s+){0,3}(?:appointments?|appointment (?:date|time)|booking|bookings|reschedul\w*|slot|date of (?:my |the )?(?:appointment|operation|surgery|follow.?up|review)|(?:operation|surgery|follow.?up|review|clinic|physio) (?:date|time|appointment)|temu ?janji)\b/i;
var ADMIN_BLOCK = /\b(?:he|she|they|him|her|mum|mom|mother|dad|father|husband|wife|patient|grand\w+|son|daughter|uncle|aunt\w*)\b|what day|what year|where (?:i am|he is|she is|am i)|who (?:i am|you are)|drows\w*|sleepy|dizz\w*|headache|fever\w*|hallucin\w*|seeing things|not making sense|pain|breath\w*|vomit\w*|faint\w*|weak\w*|numb\w*|slurr\w*|medicine|medication|tablets?|pills?|morphine|tramadol|oxycodone|codeine/i;
function adminConfusion(t, r, em) {
  if (!ADMIN_CONFUSED.test(t) || ADMIN_BLOCK.test(t)) return false;
  var ef = r.cls === 'EMERGENCY' ? (r.flags || []) : [];
  if (r.cls === 'SAME-DAY') return false;
  return ef.every(function (f) { return /confusion/.test(f); }) && em.every(function (f) { return /confusion/.test(f); }) && (ef.length + em.length) > 0;
}

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

function classifyBase(text, ctx) {
  var nt = normalise(text);
  var r = E.classify(text, ctx);
  if (nt !== String(text)) { var rn = E.classify(nt, ctx); if (RANK(rn.cls) > RANK(r.cls)) { r = rn; r.normalised = true; } }
  // The engine reads "scared" as scar + red (a wound change). Re-read without those words; use the result only if it is no longer urgent.
  if (r.cls === 'SAME-DAY' && (r.flags || []).length === 1 && r.flags[0] === 'wound change' && /scar(?:ed|y|e|es|ing|f)\b|terrified|worried|covered|bored|tired|ordered|registered|preferred|referred|required/i.test(String(text))) {
    var r2 = E.classify(String(text).replace(/\b\w*(?:scar(?:ed|y|e|es|ing|f)|terrified|worried|covered|bored|tired|ordered|registered|preferred|referred|required)\b/gi, ' '), ctx);
    if (r2.cls !== 'SAME-DAY' && r2.cls !== 'EMERGENCY') { r = r2; r.rescanned = true; }
  }
  var t = E.arNorm(nt).toLowerCase().replace(IDIOM, ' ').replace(/\s+/g, ' ');
  var out = Object.assign({}, r, { flags: (r.flags || []).slice(), engineCls: r.cls, changed: '' });
  var em = EMERGENCY.filter(function (x) { return hit(t, x[1]); }).map(function (x) { return x[0]; });
  if (adminConfusion(t, r, em)) { out.cls = 'ROUTE'; out.flags = ['no approved answer']; out.noAnswer = true; out.changed = 'lowered (v3, awaiting clinician sign-off): "confused" is about an appointment or booking, no body or symptom word, first person'; return out; }
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

/* v4 (12 Nov 2026): the clinician's emergency line.
 * Dr Tan labelled 368 English messages blind. 42 that he called emergencies were only SAME-DAY here. He then decided that
 * these groups get the emergency text. This step can only raise SAME-DAY to EMERGENCY; it never lowers and adds no new
 * way of detecting a message: it re-classes results the rules above already produce, by their flag.
 * The calf group needs one qualifier (swollen, hard or bigger) because he labelled plain calf pain as same-day. */
var CLINICIAN_LINE = [
  ['fever 38.4 C or higher', function (f) { return f.some(function (x) { var m = /^fever (\d+(?:\.\d+)?)$/.exec(x); return m && parseFloat(m[1]) >= 38.4 && parseFloat(m[1]) < 45; }); }],
  ['pus, discharge or a foul smell from the wound', function (f) { return f.indexOf('wound discharge or smell') >= 0; }],
  ['fall, or injury to the operated joint', function (f) { return f.indexOf('fall or knee injury') >= 0 || f.indexOf('fall or head injury') >= 0; }],
  ['swollen or hard calf or leg (possible clot)', function (f, t) { return f.indexOf('calf/leg pain or swelling') >= 0 && /\b(swollen|swelling|swell|hard|bigger|fat|ballooned|puffy)\b/i.test(t); }],
  ['cannot pass urine', function (f) { return f.indexOf('cannot pass urine') >= 0; }]
];
function classify(text, ctx) {
  var out = classifyBase(text, ctx);
  if (out.cls !== 'SAME-DAY') return out;
  var f = out.flags || [], t = String(text), hits = CLINICIAN_LINE.filter(function (r) { return r[1](f, t); }).map(function (r) { return r[0]; });
  if (!hits.length) return out;
  out.cls = 'EMERGENCY'; out.escalated = hits; out.flags = f.concat(hits.map(function (h) { return 'clinician line: ' + h; }));
  out.changed = (out.changed ? out.changed + '; ' : '') + 'raised from SAME-DAY to EMERGENCY by the clinician line (Dr Tan, 12 Nov 2026): ' + hits.join('; ');
  return out;
}

module.exports = { normalise: normalise, classify: classify, classifyBase: classifyBase, CLINICIAN_LINE: CLINICIAN_LINE, alarmHasContext: alarmHasContext, generalQuestion: generalQuestion, EMERGENCY: EMERGENCY, SAMEDAY: SAMEDAY };
