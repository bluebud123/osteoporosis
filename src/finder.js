/*
 * OsteoLoop case finder: reads radiology report text and finds documented fragility fractures that
 * may never have been acted on. This file is the transparent, deterministic BASELINE (no AI):
 * sentence-level fracture detection with clause-scoped negation, uncertainty, trauma and pathology handling.
 * An AI reader can replace find(); verify() checks any reader's output against the report text,
 * so a finding is only accepted when its quoted evidence is really in the report.
 *
 * Safety rule: a fracture-like sentence never ends as a silent 'no'. 'no' only when there is no fracture term,
 * when the term is clearly negated, or when the fracture sentence itself names high-energy trauma or pathology
 * for this episode. Anything else with a fracture term is 'act' (clean) or 'review' (with a visible reason).
 * Trauma or pathology elsewhere in the report (history, a reference, another sentence) never produces 'no'.
 *
 * Arabic: a small lexicon (fracture, compression, vertebra, femur neck, wrist, humerus, pelvis, negation,
 * uncertainty, trauma, tumour) is matched alongside the English terms. JS \b does not treat Arabic letters
 * as word characters, so Arabic patterns use explicit boundaries (see arRe). English patterns are unchanged.
 *
 * decision: 'act'    open a case (fragility fracture documented)
 *           'review' a human should look (hedged, borderline, minor site, osteopenia only, pathology or trauma elsewhere)
 *           'no'     nothing to do (none, clearly negated, high-energy trauma or pathological in the fracture sentence)
 * Works in the browser (window.OsteoFinder) and in Node (module.exports).
 */
(function (root) {
  const NEG_PRE = /\b(no|not|without|negative for|absence of|free of)\b/i;
  const NEG_POST = /\b(rather than (a |an )?(acute |new |recent )?(fractures?|collapse)|is not (seen|identified)|not (seen|identified)|has been excluded|is excluded|ruled out)\b/i;
  const UNCERTAIN = /(\bpossible\b|\bpossibly\b|\blikely\b|\bprobabl[ey]\b|\bquery\b|\?|cannot be excluded|cannot be confirmed|cannot (be )?exclud\w*|not (entirely |fully |completely )?excluded|not been excluded|not (entirely |fully )?ruled out|\bmay\b|suspicious for|\bsuggest|\buncertain\b|\bequivocal\b|\bsubtle\b|\bslight\b|correlate|\bearly compression\b|no definite)/i;
  const TRAUMA = /(motor vehicle|road traffic|\brta\b|\bmva\b|motorcycle|pedestrian|high[- ]speed|high[- ]energy|fall from (a )?height|fall from (a )?(ladder|scaffold\w*|roof|stairs? of)|fell from (a )?(ladder|roof|height))/i;
  const HIST = /\b(history|hx|ref|reference|previous|previously|prior|old|past|background|known|since|formerly)\b|\b(19|20)\d{2}\b/i;
  const PATHO = /(patholog\w*|metasta\w*|\blytic\b|myeloma|tumou?r|malignan\w*)/i;
  const OSTEOPENIA = /\b(osteopeni\w*|osteoporo\w*|reduction in bone density|reduced bone density)\b/i;
  const NERVE = /(nerve|root|cord|canal|stenosis|facet|\bdisc\b|medull|radicul|thecal|\bsac\b|foramen|foramina|neural|ligament)/i;
  const SITES = [
    ['pelvis', /(pubic ram\w*|sacr(al|um)|pelvi\w*|acetabul\w*|insufficiency fracture)/i],
    ['humerus', /(humer\w*|greater tuberosity|surgical neck|\bNOH\b)/i],
    ['wrist', /(distal radi\w*|radial metaphysis|colles|\bradius\b)/i],
    ['hip', /(neck of femur|femoral neck|subcapital|intertrochanteric\w*|trochanter\w*|proximal femur|\bhip\b|\bfemur\b|\bNOF\b)/i],
    ['vert', /(\b[TL]\d{1,2}\b|vertebra\w*|thoracic|lumbar|endplate|kyphoplasty|vertebroplasty|\bspine\b)/],
    ['other', /(\brib|clavic\w*|scaphoid|malleol\w*|metatars\w*|ankle|skull|finger|\btoe|tibia\w*|fibula\w*|calcane\w*)/i]
  ];
  const RANK = { act: 2, review: 1, no: 0 };

  /* ---------- Arabic lexicon ----------
     Principles: (1) only terms that are unambiguous in radiology reports; (2) no standalone negation particles
     such as 'لا' or 'دون' (over-negation would silently dismiss a fracture); (3) 'رضح' (injury) is left out of the
     trauma list because 'بدون رضح' (without injury) would then count as high-energy trauma; (4) plain 'سقوط' (fall)
     is not trauma, matching the English rules. Known gaps are listed in bench/README.md. */
  const AR_CH = '[ء-يـً-ْ]';                       // Arabic letters, tatweel, harakat
  const AR_PRE = '(?:[وفبلك]?(?:ال|لل)|[وفبلك])?';                           // optional proclitics: و ف ب ل ك + ال / لل
  /* Arabic term matcher with explicit boundaries (JS \b does not work for Arabic). prefixOnly allows a suffix
     (e.g. 'فقر' matches فقرة and فقرات). */
  function arRe(words, opts) {
    const o = opts || {};
    const alts = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    return new RegExp('(?<!' + AR_CH + ')' + AR_PRE + '(?:' + alts + ')' + (o.prefixOnly ? '' : '(?!' + AR_CH + ')'), o.flags || 'u');
  }
  const AR_FX_WORDS = ['كسر', 'كسور', 'مكسور', 'مكسورة', 'انضغاط', 'انضغاطي', 'انضغاطية', 'انهيار'];
  const AR_FX = arRe(AR_FX_WORDS);
  const AR_FX_G = arRe(AR_FX_WORDS, { flags: 'gu' });                         // for matchAll: needs g
  const AR_SITES = [
    ['pelvis', arRe(['حوض', 'عانة', 'عظم العجز'])],
    ['humerus', arRe(['عضد'])],
    ['wrist', arRe(['كعبرة', 'رسغ'])],
    ['hip', arRe(['عنق الفخذ', 'فخذ'])],
    ['vert', arRe(['فقر'], { prefixOnly: true })],
    ['other', arRe(['ضلع', 'ترقوة', 'كاحل'])]
  ];
  const AR_NEG_PRE = arRe(['لا يوجد', 'لا توجد', 'لا يظهر', 'لا تظهر', 'لم يتم', 'لم يظهر', 'لم تظهر', 'ليس', 'ليست', 'عدم', 'بدون', 'لا دليل', 'لا يشير', 'ما يشير']);
  const AR_NEG_POST = arRe(['غير موجود', 'غير ظاهر', 'غير مرئي', 'لا يوجد', 'لا توجد', 'لا يظهر', 'لا تظهر']);
  const AR_BUT = arRe(['لكن', 'إلا أن']);
  const AR_UNCERTAIN = arRe(['محتمل', 'محتملة', 'ربما', 'يشتبه', 'مشتبه', 'مشكوك', 'شبهة', 'غير مؤكد', 'لا يمكن استبعاد', 'لا يمكن تأكيد', 'يحتمل', 'يرجح', '؟']);
  const AR_TRAUMA = arRe(['حادث سير', 'حادث مروري', 'حوادث مرورية', 'دهس', 'سقوط من ارتفاع', 'سقوط من علو', 'إصابة عالية الطاقة']);
  const AR_HIST = arRe(['تاريخ', 'سابق', 'سابقة', 'قديم', 'قديمة']);
  const AR_PATHO = arRe(['ورم', 'أورام', 'ورمي', 'نقيلي', 'نقيلية', 'نقائل', 'سرطان']);

  /* ---------- Shorthand detectors (global regexes; matchAll needs g) ----------
     Each detector has an optional 'ok' test on the clause it sits in (vertebral level, not nerve or cord, etc.). */
  const FX_DEF_G = /\b(fractures?|fractured|compression deformity|wedge deformity|wedge compression|biconcave deformity|crush|vertebroplasty|kyphoplasty|fx|VCF|NO[FH])\b/gi;
  const FX_WEDGE_G = /\b(wedging|grade [123] deformity|deformity)\b/gi;
  const FX_HEIGHT_G = /\b(loss of height|height loss|reduced height|loss of (anterior )?height|height reduction|reduction in (anterior )?height)\b/gi;
  // '#' next to a site word, or '#s' / '# NOF' (rami #s, Comminuted # distal radius, # NOF left)
  const HASH_G = /(?:\b(?:neck|femur|femoral|hip|NO[FH]|humer\w*|distal|proximal|radius|radi\w*|rami|pubic|ramus|vertebra\w*|comminuted|displaced|undisplaced|intertrochanteric|subcapital|left|right|bilateral|[TL]\d{1,2})\s*#)|(?:#\s*(?:s\b|NO[FH]\b|(?:left|right|bilateral|comminuted|displaced|undisplaced|neck|distal|proximal|femur|femoral|humer\w*|radi\w*|rami|pubic|ramus|vertebra\w*|[TL]\d{1,2}\b|hip|wrist|pelvi\w*|sacr\w*|intertrochanteric|subcapital)))/gi;
  const VPLANA_G = /\bvertebra plana\b/gi;
  const VP_G = /\bVP\b/g;                                                       // uppercase only; needs a vertebral level
  const COLLAPSE_G = /\bcollapsed?\b/gi;                                        // needs a vertebral level (not lung collapse)
  const COMP_G = /\bcompression\b/gi;                                           // needs a vertebral level and no nerve or cord word
  const HW_G = /\b(ORIF|open reduction|internal fixation|hemiarthroplas\w*|DHS|dynamic hip screw|PFN|proximal femoral nail\w*|cemented|sliding hip screw|intramedullary nail\w*)\b/gi;
  const V_BD_G = /(\bosteopeni\w*|\bosteoporo\w*|\b(reduction in|reduced|low) bone (mineral )?density\b)/gi;
  const V_HT_G = /(\b(loss of|reduced|reduction in)\b[^.;]{0,30}\bheight\b|\bheight (loss|reduction)\b)/gi;

  const ARTHRO = /(osteoarth\w*|arthritis|arthrosis|\bOA\b|total hip|\bTHR\b|\bTHA\b|total joint)/i;
  const vertLevel = c => /(\b[TL]\d{1,2}\b|\bvertebra\w*|\bthoracic\b|\blumbar\b|\bendplate)/i.test(c);
  const DETECT = [
    { kind: 'def', re: FX_DEF_G }, { kind: 'def', re: AR_FX_G }, { kind: 'def', re: HASH_G }, { kind: 'def', re: VPLANA_G },
    { kind: 'def', re: VP_G, ok: vertLevel },
    { kind: 'def', re: COLLAPSE_G, ok: c => vertLevel(c) && !/\b(lung|lobe)\b/i.test(c) },
    { kind: 'def', re: COMP_G, ok: c => vertLevel(c) && !NERVE.test(c) },
    { kind: 'ht', re: FX_WEDGE_G }, { kind: 'ht', re: FX_HEIGHT_G },
    { kind: 'hw', re: HW_G }
  ];

  function sentences(t) { return String(t || '').split(/(?<=[.;؛؟])\s+|\s+however\s+/i).map(s => s.trim()).filter(Boolean); }
  /* Clauses: a sentence split at commas. Negation after a term is scoped to its own clause (B5/item 3). */
  function clauseSpans(s) {
    const spans = [], re = /,\s+/g; let start = 0, m;
    while ((m = re.exec(s))) { spans.push({ start, end: m.index, text: s.slice(start, m.index) }); start = m.index + m[0].length; }
    spans.push({ start, end: s.length, text: s.slice(start) });
    return spans;
  }
  function spanAt(spans, i) { return spans.find(sp => i >= sp.start && i < sp.end) || spans[spans.length - 1]; }
  function siteOf(s) {
    for (const [k, re] of SITES) if (re.test(s)) return k;
    for (const [k, re] of AR_SITES) if (re.test(s)) return k;
    return null;
  }
  const SIDE = /\b(right|left)\b/i;
  const sideOf = t => { const m = String(t).match(SIDE); return m ? m[1].toLowerCase() : null; };

  /* Is the term at absolute index idx of sentence s negated? Post-negation applies only inside the term's own clause,
     and not when the negation names the other side ('Left femoral neck fracture not seen on right'). Pre-negation
     looks back up to 8 words inside the clause. */
  function negatedAt(s, idx, span) {
    const sp = span || spanAt(clauseSpans(s), idx), rel = idx - sp.start;
    const post = sp.text.match(NEG_POST) || sp.text.match(AR_NEG_POST);
    if (post) {
      const ns = sideOf(post[0]), ts = sideOf(sp.text.slice(0, post.index)) || sideOf(sp.text);
      if (!(ns && ts && ns !== ts)) return true;
    }
    const before = sp.text.slice(0, Math.max(0, rel)).split(/\s+/).slice(-8).join(' ');
    return (NEG_PRE.test(before) || AR_NEG_PRE.test(before)) && !/\b(but|however|although)\b/i.test(before) && !AR_BUT.test(before);
  }

  /* A negation word earlier in the sentence that the clause scope does not reach ('No acute, displaced fracture'):
     the scope is unclear, so the term is not called act. */
  function scopeDoubt(s, idx, span) {
    const before = s.slice(0, idx).split(/\s+/).slice(-8).join(' ');
    return (NEG_PRE.test(before) || AR_NEG_PRE.test(before)) && !/\b(but|however|although)\b/i.test(before) && !AR_BUT.test(before)
      && span.start > 0 && s.slice(0, span.start).length > 0;
  }

  /* All fracture-like terms in a sentence, with their clause. */
  function fxHits(s) {
    const spans = clauseSpans(s), out = [];
    for (const d of DETECT) for (const m of s.matchAll(d.re)) {
      const span = spanAt(spans, m.index);
      if (d.ok && !d.ok(span.text)) continue;
      out.push({ index: m.index, text: m[0], kind: d.kind, span });
    }
    return out;
  }
  function patho(s) {
    const m = s.match(PATHO) || s.match(AR_PATHO);
    if (!m) return false;
    // Negation within the same clause-run, after any contrast word ('No X, but lytic lesion' stays pathological)
    const before = s.slice(0, m.index).split(/\s+/).slice(-8).join(' ');
    const tail = before.split(/\b(?:but|however|although)\b|لكن|إلا أن/i).pop();
    return !/\b(no|without)\b/i.test(tail) && !AR_NEG_PRE.test(tail);
  }
  /* Report-level pathology: any un-negated pathology term in the report or in the indication (B4, M13). */
  function pathAny(text, ind) { return sentences(text).some(patho) || patho(String(ind || '')); }
  /* Current-episode trauma: a trauma term in a clause that is not history or a reference (B4). */
  function traumaNow(s) {
    return clauseSpans(String(s || '')).some(sp => (TRAUMA.test(sp.text) || AR_TRAUMA.test(sp.text)) && !HIST.test(sp.text) && !AR_HIST.test(sp.text));
  }

  /* report: {text, age, ind}. Returns {decision, site, evidence:[sentence], reasons:[string]} */
  function find(r) {
    const text = r.text || '', ind = r.ind || '', sents = sentences(text);
    const anyPatho = pathAny(text, ind);
    const positives = []; let sawTerm = false, pathoFx = false;
    for (const s of sents) {
      const hits = fxHits(s).filter(h => !negatedAt(s, h.index, h.span));
      if (!hits.length) continue;
      sawTerm = true;
      if (patho(s)) { if (hits.some(h => h.kind === 'def')) pathoFx = true; continue; }
      const def = hits.find(h => h.kind === 'def'), hw = hits.find(h => h.kind === 'hw'), ht = hits.find(h => h.kind === 'ht');
      const uncertain = UNCERTAIN.test(s) || AR_UNCERTAIN.test(s);
      const doubt = hits.some(h => scopeDoubt(s, h.index, h.span));
      if (def) positives.push({ s, site: siteOf(def.span.text) || siteOf(s), kind: 'def', uncertain: uncertain || doubt, doubt });
      else if (hw && siteOf(s) === 'hip' && !ARTHRO.test(s)) positives.push({ s, site: 'hip', kind: 'def', uncertain });   // prior hip fixation (evidence of past fracture surgery)
      else if (hw) positives.push({ s, site: siteOf(s), kind: 'hw', uncertain });
      else if (ht) positives.push({ s, site: siteOf(s), kind: 'ht', uncertain: uncertain || doubt, doubt });
    }
    const decide = p => {
      if (anyPatho) return ['review', 'Possible pathological fracture: pathology is mentioned in this report'];
      if (p.kind === 'hw') return ['review', 'Fixation hardware without a stated fracture'];
      // Current-episode mechanism (anywhere in the report, not history or a reference) is high-energy for this episode: 'no'.
      // Hedged wording with a mechanism is not decided: review.
      const mech = traumaNow(p.s) || traumaNow(ind) || sents.some(traumaNow);
      if (mech && !p.uncertain && !HIST.test(p.s) && !AR_HIST.test(p.s)) return ['no', 'High-energy trauma (current mechanism): not a fragility fracture'];
      if (mech) return ['review', 'Trauma mentioned with an old, hedged or unclear fracture: confirm mechanism and date'];
      if (p.doubt) return ['review', 'Negation in an earlier clause: confirm what is negated'];
      if (p.uncertain) return ['review', 'Hedged language'];
      if (p.kind === 'ht') return ['review', 'Height loss or wedging without a stated fracture'];
      if (!p.site) return ['review', 'Fracture site unclear'];
      if (p.site === 'other') return ['review', 'Fracture at a minor site'];
      return ['act', 'Fragility fracture documented (' + p.site + ')'];
    };
    let best = null;
    for (const p of positives) {
      const [d, why] = decide(p);
      if (!best || RANK[d] > RANK[best.decision]) best = { decision: d, site: p.site, evidence: [p.s], reasons: [why] };
      else if (RANK[d] === RANK[best.decision]) {
        if (!best.evidence.includes(p.s)) best.evidence.push(p.s);
        if (!best.reasons.includes(why)) best.reasons.push(why);
      }
    }
    if (best) {
      if (best.decision === 'act' && r.age != null && r.age < 50) return Object.assign(best, { decision: 'review', reasons: ['Fracture under age 50 without trauma: needs review'] });
      return best;
    }
    if (pathoFx) return { decision: 'no', site: null, evidence: [], reasons: ['Pathological fracture (tumour): not osteoporotic'] };
    if (!sawTerm) {
      const op = sents.find(s => OSTEOPENIA.test(s));
      if (op) return { decision: 'review', site: null, evidence: [op], reasons: ['Bone-density wording but no recognised fracture term'] };
    }
    return { decision: 'no', site: null, evidence: [], reasons: ['No fracture documented'] };
  }

  /* Does one sentence support the decision? act: an un-negated, non-pathological, non-hedged fracture term
     (or fixation hardware at the hip, which is evidence of past fracture surgery). review: any un-negated fracture,
     deformity, height-loss or bone-density term. */
  function supports(s, decision) {
    const pa = patho(s), unc = UNCERTAIN.test(s) || AR_UNCERTAIN.test(s), hip = siteOf(s) === 'hip' && !ARTHRO.test(s);
    if (decision === 'act') {
      if (pa || unc) return false;
      const live = fxHits(s).filter(h => !negatedAt(s, h.index, h.span));
      if (live.some(h => scopeDoubt(s, h.index, h.span))) return false;
      return live.some(h => h.kind === 'def' || (h.kind === 'hw' && hip));
    }
    if (fxHits(s).some(h => !negatedAt(s, h.index, h.span))) return true;
    for (const re of [V_BD_G, V_HT_G]) for (const m of s.matchAll(re)) if (!negatedAt(s, m.index)) return true;
    return false;
  }

  /* Checks any reader's output (baseline or AI) against the report: evidence must be quoted verbatim,
     and for act/review at least one quoted sentence must state a fracture (or height loss, or bone density) that is not negated.
     act is refused when the report has pathology or current-episode trauma anywhere, because find() would not call it act. */
  function verify(r, out) {
    const problems = [];
    if (!out || !['act', 'review', 'no'].includes(out.decision)) problems.push('invalid decision');
    if (out && out.decision !== 'no') {
      const ev = [].concat(out.evidence || []);
      if (!ev.length) problems.push('no evidence quoted');
      else {
        ev.forEach(e => { if (!String(r.text).includes(e)) problems.push('evidence not found in report: "' + String(e).slice(0, 60) + '"'); });
        if (!ev.some(e => sentences(e).some(s => supports(s, out.decision))))
          problems.push(out.decision === 'act' ? 'no un-negated, non-pathological fracture statement in the quoted evidence'
            : 'no un-negated fracture, deformity, height-loss or bone-density statement in the quoted evidence');
      }
      if (out.decision === 'act') {
        if (pathAny(r.text, r.ind)) problems.push('pathology mentioned in the report: act not allowed');
        if (sentences(r.text).some(traumaNow) || traumaNow(r.ind)) problems.push('current trauma mentioned in the report: act not allowed');
      }
    }
    return { ok: problems.length === 0, problems };
  }

  /* Prompt for an AI reader. Output must pass verify(); the same benchmark scores it. */
  const AI_PROMPT = 'You read one radiology report and decide whether it documents a fragility fracture that should open an osteoporosis care pathway. ' +
    'Return JSON only: {"decision":"act"|"review"|"no","site":"vert"|"hip"|"wrist"|"humerus"|"pelvis"|"other"|null,"evidence":["exact sentence copied from the report"],"reason":"short"}. ' +
    'act = a definite fracture of spine, hip, distal radius, proximal humerus or pelvis/sacrum, age 50+, low or unstated trauma, not caused by tumour; old or healed fractures and evidence of past fracture surgery count. ' +
    'review = hedged or borderline wording, osteopenia only, minor-site fracture, under 50 without trauma. ' +
    'no = no fracture, negated, high-energy trauma, or pathological fracture. Copy evidence sentences exactly.';

  /* Batch prompt: one call reads many reports and returns a JSON array (fewer calls, same instructions). */
  function aiBatchPrompt(reports) {
    return AI_PROMPT + '\n\nReports (one JSON object per line):\n' +
      reports.map(r => JSON.stringify({ id: r.id, age: r.age, sex: r.sex, study: r.mod, indication: r.ind, report: r.text })).join('\n') +
      '\n\nReply with only a JSON array with one object per report, in the same order: ' +
      '[{"id":"R001","decision":"act","site":"vert","evidence":["exact sentence"],"reason":"short"}]';
  }

  /* Shared scoring, used by the command-line benchmark and the in-app benchmark.
     outs[i] is the reader's output for reports[i]; unverifiable output is downgraded to 'review'
     (never trusted to open a case or to dismiss one). */
  function score(reports, outs) {
    const L = ['act', 'review', 'no'], conf = {}; L.forEach(a => { conf[a] = {}; L.forEach(b => conf[a][b] = 0); });
    let verifyFails = 0; const rows = [];
    reports.forEach((r, i) => {
      const out = outs[i] || { decision: 'invalid', evidence: [] };
      const v = verify(r, out); if (!v.ok) verifyFails++;
      const got = v.ok ? out.decision : 'review';
      conf[r.label][got]++;
      rows.push({ r, out, got, ok: got === r.label, v });
    });
    const tp = conf.act.act, fn = conf.act.review + conf.act.no, fp = conf.review.act + conf.no.act;
    return { n: reports.length, conf, rows, verifyFails, tp, fn, fp,
      acc: rows.filter(x => x.ok).length / (rows.length || 1), sens: tp / ((tp + fn) || 1), ppv: tp / ((tp + fp) || 1),
      surfaced: conf.act.act + conf.act.review, dismissed: conf.act.no };
  }

  const api = { find, verify, sentences, AI_PROMPT, aiBatchPrompt, score };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OsteoFinder = api;
})(typeof window !== 'undefined' ? window : globalThis);
