(function (root) {
  'use strict';
  // Layered knowledge store: country < hospital < team < surgeon (most specific wins per topic).
  // No network, no models. Retrieval is plain BM25 over chunks.
  // FICTIONAL SAMPLE tooling only: not clinical advice.
  // Arabic (ar): machine draft wording, not clinician-reviewed. Questions are normalised first (tashkeel, alef, ya,
  // ta-marbuta, Arabic-Indic digits) and common prefixes are stripped lightly, so the same token scoring applies.

  var LAYERS = { country: 0, hospital: 1, team: 2, surgeon: 3 };
  var LANGS = ['en', 'ms', 'zh', 'ar'];
  var MIN_SCORE = 0.5;
  // review3 M1/M2 (round 6): a question is answered only when exactly one topic keyword is in it, the answer's own topic
  // keyword is that one, and the score reaches the bar. Draft (not clinician-approved) answers use the stricter bar and are
  // always tagged 'SAMPLE draft, not approved' on the page. Everything else goes to the care team.
  var STRICT_MIN_SCORE = 1.0;
  // Arabic keyword patterns are written in normalised form (no hamza, alef maqsura, or ta-marbuta; see arNorm).
  var TOPIC_KW = {
    wound_care: /wound|dressing|bandage|plaster|luka|balutan|sapu|伤口|敷料|纱布|绷带|刀口|جرح|ضماد|شاش|لاصق/i,
    shower: /shower|bath|mandi|basuh|洗澡|淋浴|沐浴|استحمام|دش|حمام/i,
    follow_up: /follow[- ]?up|review|appointment|temujanji|susulan|复诊|复查|门诊|回诊|预约|مراجعه|موعد|متابعه|زياره/i,
    driving: /\bdriv|memandu|开车|驾车|قياده|سياقه|اقود|اسوق/i,
    blood_thinner_stop: /blood thinner|anticoag|thinner|pencair darah|抗凝|血液稀释|warfarin|aspirin|مميع|مسيل|وارفارين|اسبرين/i,
    antibiotics: /antibiotic|antibiotik|抗生素|مضاد/i,
    injections: /injection|\bjabs?\b|suntikan|针|注射|حقن|ابره/i,
    flying: /\bfly\b|\bflying\b|\bflights?\b|\bplanes?\b|penerbangan|terbang|飞|طيران|طياره|رحله|اطير/i,
    medicines: /medicin|medication|\bubat\b|\bpills?\b|\bdose\b|painkiller|\btablets?\b|药|دواء|دوا|ادويه|حبوب|جرعه|مسكن/i,
    fasting: /\bfast(ing|ed)?\b|nil by mouth|\bpuasa\b|禁食|禁水|空腹|صيام|صايم|صوم|اكل قبل/i
  };
  function topicKeywordMatch(topic, question) {
    var re = TOPIC_KW[topic];
    return !!re && re.test(question);
  }
  var ROUTE_TEXT = 'I will pass this to your care team';
  var ROUTE_TEXT_AR = 'سأحيل سؤالك إلى فريق الرعاية الخاص بك.';
  var LAYER_AR = { country: 'الدولة', hospital: 'المستشفى', team: 'فريق الجناح', surgeon: 'الجراح' };
  var REASON_AR = {
    clinical: 'تقدير سريري: يحتاج مراجعة الفريق الطبي',
    instruction: 'طلب يشبه التعليمات: لا يُجاب عليه من المصادر',
    clarify: 'يحتاج إلى توضيح',
    topics: 'أكثر من موضوع في هذا السؤال',
    noTopicSource: 'تقدير سريري: لا يوجد مصدر معتمد لهذا الموضوع',
    noSource: 'لا يوجد مصدر معتمد لهذا السؤال',
    triage: { EMERGENCY: 'فرز: طارئ', 'SAME-DAY': 'فرز: في نفس اليوم' }
  };
  var CLINICAL = {
    blood_thinner_stop: /blood thinner|anticoag|warfarin|rivaroxaban|apixaban|clexane|enoxaparin|aspirin|\b(stop|restart)\b.{0,20}\b(thinner|tablets?|pills?|medicines?)\b|مميع|مسيل|وارفارين|ريفاروكسابان|ابيكسابان|اسبرين|انوكسابارين/i,
    antibiotics: /antibiotic|antibiotik|مضاد/i,
    injections: /injection|\bjabs?\b|suntikan|حقن|ابره/i,
    flying: /\bfly\b|\bflying\b|\bflights?\b|\bplanes?\b|penerbangan|terbang|طيران|طياره|رحله|اطير/i,
    driving: /\bdriv|memandu|قياده|سياقه|اقود|اسوق/i,
    medicines: /medicin|medication|\bubat\b|\bpills?\b|\bdose\b|painkiller|\btablets?\b|دواء|دوا|ادويه|حبوب|جرعه|مسكن/i,
    fasting: /\bfast(ing|ed)?\b|nil by mouth|\bpuasa\b|禁食|禁水|空腹|صيام|صايم|صوم|اكل قبل/i
  };
  // review2 M3 (round 4): instruction-like or approval requests are never answered from the store.
  var INJECT_RE = /\bsystem\s*:|\byou are now\b|\bignore (all |your |previous |the )?(rules|instructions|above)\b|\bapprove\b|\bact as\b|\bpretend\b|\boverride\b|تجاهل|تظاهر|وافق/i;
  var STOP = {};
  ('a an the is are am be been to of in on at for and or do does did i you your my me we it this that ' +
   'what when can how with from as by if will would should there any not no so please yes ok ' +
   'saya anda apa bila dan yang ke di untuk ini itu dengan adakah bagaimana kah tak tidak dah juga atau ' +
   'pada dalam kami kita boleh bolehkah').split(' ').forEach(function (w) { STOP[w] = true; });
  // Arabic function words (written naturally; normalised below so they match the tokens)
  ('في على من الى عن هل ما لا ان او مع كيف متى ممكن استطيع انا انت هذا هذه ذلك التي الذي ليس مو مش ابي ابغى هو هي كم ' +
   'اريد أريد ينفع يجوز').split(' ').forEach(function (w) { STOP[arNorm(w)] = true; });

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isClinical(topic) { return hasOwn(CLINICAL, topic); }

  // Arabic normalisation: drop tashkeel and tatweel; unify alef forms, alef maqsura, ta-marbuta, hamza carriers;
  // Arabic-Indic digits and the Arabic decimal separator become ASCII.
  var AR_LETTERS = /[؀-ۿ]/;
  function arNorm(text) {
    return String(text == null ? '' : text)
      .replace(/[ً-ٰٟـ]/g, '')
      .replace(/[آأإٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[ؤ]/g, 'و')
      .replace(/[ئ]/g, 'ي')
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/٫/g, '.').replace(/٬/g, ',');
  }
  // Light prefix stripping for Arabic words only: definite article and the common one-letter conjunctions and prepositions.
  var AR_PREFIX2 = ['وال', 'بال', 'كال', 'فال', 'لل', 'ال'];
  function arStrip(w) {
    if (!AR_LETTERS.test(w)) return w;
    for (var i = 0; i < AR_PREFIX2.length; i++) {
      var p = AR_PREFIX2[i];
      if (w.indexOf(p) === 0 && w.length - p.length >= 3) return w.slice(p.length);
    }
    if (/^[وبلف]/.test(w) && w.length - 1 >= 4) return w.slice(1);
    return w;
  }

  function stem(w) {
    return w.length > 4 ? w.replace(/(ing|ed|es|s|e)$/, '') : w;
  }

  function tokenize(text) {
    var out = [];
    var raw = arNorm(text).toLowerCase().match(/[一-鿿]|[\p{L}\p{N}]+/gu) || [];
    raw.forEach(function (w) {
      if (/^[一-鿿]$/.test(w)) { out.push(w); return; }
      w = arStrip(w);
      if (w.length < 2 || hasOwn(STOP, w)) return;
      var s = stem(w);
      if (s.length >= 2 && !hasOwn(STOP, s)) out.push(s);
    });
    return out;
  }

  // Paragraphs are separated by blank lines. A paragraph may start with a tag:
  //   [topic=wound_care]            -> topic, approved defaults to false
  //   [topic=driving approved=true] -> clinician-approved chunk
  // Untagged paragraphs get topic 'general' and approved false.
  function splitChunks(text) {
    return String(text || '').split(/\n\s*\n/)
      .map(function (p) { return p.trim(); })
      .filter(Boolean)
      .map(function (p, i) {
        var m = p.match(/^\[topic=([a-z_]+)(?:\s+approved=(true|false))?\]\s*/);
        if (!m) return { index: i, topic: 'general', approved: false, text: p };
        return { index: i, topic: m[1], approved: m[2] === 'true', text: p.slice(m[0].length).trim() };
      });
  }

  function createStore() {
    return { sources: [], seq: 0 };
  }

  function addSource(store, spec) {
    spec = spec || {};
    if (!hasOwn(LAYERS, spec.layer)) throw new Error('bad layer: ' + spec.layer);
    if (LANGS.indexOf(spec.lang) < 0) throw new Error('bad lang: ' + spec.lang);
    if (!spec.owner || !spec.title) throw new Error('owner and title are required');
    store.seq += 1;
    var id = 's' + store.seq;
    var chunks = splitChunks(spec.text).map(function (c) {
      return {
        chunkId: id + '.' + c.index,
        topic: c.topic,
        approved: c.approved,
        text: c.text,
        tokens: tokenize(c.text + ' ' + c.topic.replace(/_/g, ' '))
      };
    });
    var src = {
      id: id, seq: store.seq, layer: spec.layer, owner: String(spec.owner), title: String(spec.title),
      lang: spec.lang, procedures: spec.procedures || [], chunks: chunks
    };
    store.sources.push(src);
    return src;
  }

  function inScope(src, ctx, lang) {
    if (src.lang !== lang) return false;
    var key = src.layer === 'country' ? ctx.country
      : src.layer === 'hospital' ? ctx.hospital
      : src.layer === 'team' ? ctx.team
      : ctx.surgeon;
    if (!key || key !== src.owner) return false;
    if (ctx.procedure && src.procedures.length && src.procedures.indexOf(ctx.procedure) < 0) return false;
    return true;
  }

  // Most specific layer wins per topic (surgeon > team > hospital > country).
  // Within one layer the most recently added source wins.
  // Clinical topics only ever resolve to clinician-approved chunks.
  function resolve(store, ctx, lang) {
    ctx = ctx || {};
    lang = lang || 'en';
    var win = Object.create(null);
    store.sources.forEach(function (src) {
      if (!inScope(src, ctx, lang)) return;
      src.chunks.forEach(function (ch) {
        if (isClinical(ch.topic) && !ch.approved) return;
        var rank = LAYERS[src.layer];
        var cur = win[ch.topic];
        if (!cur || rank > cur.rank || (rank === cur.rank && src.seq > cur.source.seq)) {
          win[ch.topic] = { chunk: ch, source: src, rank: rank };
        }
      });
    });
    return win;
  }

  function makeScorer(store) {
    var docs = [];
    store.sources.forEach(function (s) { s.chunks.forEach(function (c) { docs.push(c); }); });
    var N = docs.length || 1;
    var total = 0;
    var df = Object.create(null);
    docs.forEach(function (d) {
      total += d.tokens.length;
      Array.from(new Set(d.tokens)).forEach(function (t) { df[t] = (df[t] || 0) + 1; });
    });
    var avg = (total / N) || 1;
    var K1 = 1.2, B = 0.75;
    return function (qTokens, d) {
      var tf = Object.create(null);
      d.tokens.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
      var score = 0;
      Array.from(new Set(qTokens)).forEach(function (t) {
        var f = tf[t];
        if (!f) return;
        var n = df[t] || 0;
        var idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        score += idf * f * (K1 + 1) / (f + K1 * (1 - B + B * d.tokens.length / avg));
      });
      return score;
    };
  }

  function detectClinical(question) {
    return Object.keys(CLINICAL).filter(function (t) { return CLINICAL[t].test(question); });
  }

  function route(text, reason, cls) {
    var r = { kind: 'ROUTE', text: text, reason: reason, citation: null };
    if (cls) r.cls = cls;
    return r;
  }

  function classifySafe(question, ctx) {
    try {
      return engine().classify(question, { procedure: ctx.procedure });
    } catch (e) {
      return { cls: 'ROUTE', flags: ['clinical judgement: classifier error'], reply: '', lang: 'en' };
    }
  }

  function engine() {
    if (typeof module !== 'undefined' && module.exports) return require('./../engine.js');
    return root.PeriLoop;
  }

  function answer(store, ctx, question, lang) {
    ctx = ctx || {};
    var q = String(question || '');
    var qn = arNorm(q); // normalised question for the keyword and clinical patterns
    var c = classifySafe(q, ctx);
    var L = LANGS.indexOf(lang) >= 0 ? lang : (LANGS.indexOf(c.lang) >= 0 ? c.lang : 'en');
    var AR = L === 'ar';
    // Route text and reason in the answer language. English output is unchanged.
    function routeOut(reasonEn, reasonAr, cls) {
      return route(AR ? ROUTE_TEXT_AR : ROUTE_TEXT, AR ? reasonAr : reasonEn, cls);
    }

    // Triage pre-empts everything else.
    if (c.cls === 'EMERGENCY' || c.cls === 'SAME-DAY') {
      return route(c.reply, AR ? REASON_AR.triage[c.cls] : 'triage: ' + c.cls, c.cls);
    }
    if (c.cls === 'ROUTE' && c.flags.some(function (f) { return /clinical judgement|worsening/.test(f); })) {
      // review1 item 14: the engine flag already says "clinical judgement"; do not repeat it
      var why = c.flags.join(', ');
      return routeOut(/^clinical judgement/.test(why) ? why : 'clinical judgement: ' + why, REASON_AR.clinical);
    }
    if (c.cls === 'ASK') return route(c.reply, AR ? REASON_AR.clarify : 'needs clarification', c.cls);
    if (INJECT_RE.test(qn)) return routeOut('instruction-like request: not answered from the store', REASON_AR.instruction);

    var winners = resolve(store, ctx, L);

    // Clinical topics named in the question need an approved chunk for that exact topic.
    var clin = detectClinical(qn);
    for (var i = 0; i < clin.length; i++) {
      if (!winners[clin[i]]) {
        return routeOut('clinical judgement: no approved source for topic "' + clin[i] + '"', REASON_AR.noTopicSource);
      }
    }

    var matchingTopics = Object.keys(TOPIC_KW).filter(function (t) { return topicKeywordMatch(t, qn); });
    if (matchingTopics.length > 1) {
      return routeOut('more than one topic in this question: ' + matchingTopics.join(', '), REASON_AR.topics);
    }

    var score = makeScorer(store);
    var qt = tokenize(q);
    var best = null;
    Object.keys(winners).forEach(function (t) {
      var w = winners[t];
      if (!topicKeywordMatch(w.chunk.topic, qn)) return; // wrong topic for this question (review3 M2)
      var s = score(qt, w.chunk);
      var need = w.chunk.approved ? MIN_SCORE : STRICT_MIN_SCORE;
      if (s >= need && (!best || s > best.score)) best = { score: s, w: w };
    });
    if (!best) return routeOut('no approved source', REASON_AR.noSource); // also used when no source matches this question's topic with enough confidence

    var w = best.w;
    return {
      kind: 'ANSWER',
      text: w.chunk.text,
      citation: {
        layer: w.source.layer,
        layerLabel: AR ? LAYER_AR[w.source.layer] : w.source.layer,
        owner: w.source.owner,
        title: w.source.title,
        chunkId: w.chunk.chunkId
      },
      topic: w.chunk.topic,
      approved: w.chunk.approved,
      draft: !w.chunk.approved, // review3 M1: the page shows a SAMPLE draft, not approved tag
      lang: L,
      score: Math.round(best.score * 100) / 100
    };
  }

  // review1 item 8: when a more specific layer (surgeon > team > hospital > country) overrides a less specific one,
  // the page shows the answer and then this line, with the owner names. Returns null when nothing is overridden.
  function overrideLine(store, ctx, r) {
    if (!r || r.kind !== 'ANSWER' || !r.citation) return null;
    var lower = resolve(store, Object.assign({}, ctx || {}, { surgeon: '' }), r.lang)[r.topic];
    if (!lower || lower.chunk.chunkId === r.citation.chunkId) return null;
    if (LAYERS[lower.source.layer] >= LAYERS[r.citation.layer]) return null;
    if (r.lang === 'ar') {
      return {
        head: 'يتجاوز توجيهات ' + LAYER_AR[lower.source.layer] + ':',
        body: lower.chunk.text + ' (' + LAYER_AR[lower.source.layer] + ' – المالك: ' + lower.source.owner + '؛ ' +
          LAYER_AR[r.citation.layer] + ' – المالك: ' + r.citation.owner + ')',
        lowerLayer: lower.source.layer, lowerOwner: lower.source.owner,
        upperLayer: r.citation.layer, upperOwner: r.citation.owner
      };
    }
    return {
      head: 'Overrides ' + lower.source.layer + ' guidance:',
      body: lower.chunk.text + ' (' + lower.source.layer + ' owner: ' + lower.source.owner + '; ' +
        r.citation.layer + ' owner: ' + r.citation.owner + ')',
      lowerLayer: lower.source.layer, lowerOwner: lower.source.owner,
      upperLayer: r.citation.layer, upperOwner: r.citation.owner
    };
  }

  var api = {
    createStore: createStore,
    addSource: addSource,
    resolve: resolve,
    answer: answer,
    overrideLine: overrideLine,
    tokenize: tokenize,
    arNorm: arNorm,
    LAYER_AR: LAYER_AR,
    STRICT_MIN_SCORE: STRICT_MIN_SCORE,
    CLINICAL_TOPICS: Object.keys(CLINICAL),
    MIN_SCORE: MIN_SCORE
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PL_KNOWLEDGE = api;
})(this);
