/*
 * OsteoLoop case finder: reads radiology report text and finds documented fragility fractures that
 * may never have been acted on. This file is the transparent, deterministic BASELINE (no AI):
 * sentence-level fracture detection with negation, uncertainty, trauma and pathology handling.
 * An AI reader can replace find(); verify() checks any reader's output against the report text,
 * so a finding is only accepted when its quoted evidence is really in the report.
 *
 * Arabic: a small lexicon (fracture, compression, vertebra, femur neck, wrist, humerus, pelvis, negation,
 * uncertainty, trauma, tumour) is matched alongside the English terms. JS \b does not treat Arabic letters
 * as word characters, so Arabic patterns use explicit boundaries (see arRe). English patterns are unchanged.
 *
 * decision: 'act'    open a case (fragility fracture documented)
 *           'review' a human should look (hedged, borderline, minor site, osteopenia only)
 *           'no'     nothing to do (none, negated, high-energy trauma, pathological)
 * Works in the browser (window.OsteoFinder) and in Node (module.exports).
 */
(function (root) {
  const FX_DEF = /\b(fractures?|fractured|compression deformity|wedge deformity|wedge compression|biconcave deformity|crush|collapsed?|vertebroplasty|kyphoplasty|fx|VCF|NO[FH])\b/i;
  const FX_WEDGE = /\b(wedging|grade [123] deformity|deformity)\b/i;
  const FX_HEIGHT = /\b(loss of height|height loss|reduced height|loss of (anterior )?height)\b/i;
  const NEG_PRE = /\b(no|not|without|negative for|absence of|free of)\b/i;
  const NEG_POST = /\b(rather than (a |an )?(acute |new |recent )?(fractures?|collapse)|is not (seen|identified)|not (seen|identified)|has been excluded|is excluded|ruled out)\b/i;
  const UNCERTAIN = /(\bpossible\b|\bpossibly\b|\blikely\b|\bprobabl[ey]\b|\bquery\b|\?|cannot be excluded|cannot be confirmed|\bmay\b|suspicious for|\bsuggest|\buncertain\b|\bequivocal\b|\bsubtle\b|\bslight\b|correlate|\bearly compression\b|no definite)/i;
  const TRAUMA = /(motor vehicle|road traffic|\brta\b|\bmva\b|motorcycle|pedestrian|high[- ]speed|high[- ]energy|fall from (a )?height|fall from (a )?(ladder|scaffold\w*|roof|stairs? of)|fell from (a )?(ladder|roof|height))/i;
  const PATHO = /(patholog\w*|metasta\w*|\blytic\b|myeloma|tumou?r|malignan\w*)/i;
  const OSTEOPENIA = /\b(osteopeni\w*|osteoporo\w*|reduction in bone density|reduced bone density)\b/i;
  const SITES = [
    ['pelvis', /(pubic ram\w*|sacr(al|um)|pelvi\w*|acetabul\w*|insufficiency fracture)/i],
    ['humerus', /(humer\w*|greater tuberosity|surgical neck)/i],
    ['wrist', /(distal radi\w*|radial metaphysis|colles|\bradius\b)/i],
    ['hip', /(neck of femur|femoral neck|subcapital|intertrochanteric\w*|trochanter\w*|proximal femur|\bhip\b|\bfemur\b)/i],
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
  const AR_FX_G = arRe(AR_FX_WORDS, { flags: 'gu' });                         // for verify(): matchAll needs g
  const AR_SITES = [
    ['pelvis', arRe(['حوض', 'عانة', 'عظم العجز'])],
    ['humerus', arRe(['عضد'])],
    ['wrist', arRe(['كعبرة', 'رسغ'])],
    ['hip', arRe(['عنق الفخذ', 'فخذ'])],
    ['vert', arRe(['فقر'], { prefixOnly: true })],
    ['other', arRe(['ضلع', 'ترقوة', 'كاحل'])]
  ];
  const AR_NEG_PRE = arRe(['لا يوجد', 'لا توجد', 'لا يظهر', 'لا تظهر', 'لم يتم', 'لم يظهر', 'لم تظهر', 'ليس', 'ليست', 'عدم', 'بدون', 'لا دليل']);
  const AR_NEG_POST = arRe(['غير موجود', 'غير ظاهر', 'غير مرئي', 'لا يوجد', 'لا توجد', 'لا يظهر', 'لا تظهر']);
  const AR_BUT = arRe(['لكن', 'إلا أن']);
  const AR_UNCERTAIN = arRe(['محتمل', 'محتملة', 'ربما', 'يشتبه', 'مشتبه', 'مشكوك', 'شبهة', 'غير مؤكد', 'لا يمكن استبعاد', 'لا يمكن تأكيد', 'يحتمل', 'يرجح', '؟']);
  const AR_TRAUMA = arRe(['حادث سير', 'حادث مروري', 'حوادث مرورية', 'دهس', 'سقوط من ارتفاع', 'سقوط من علو', 'إصابة عالية الطاقة']);
  const AR_PATHO = arRe(['ورم', 'أورام', 'ورمي', 'نقيلي', 'نقيلية', 'نقائل', 'سرطان']);

  function sentences(t) { return String(t || '').split(/(?<=[.;؛؟])\s+|\s+however\s+/i).map(s => s.trim()).filter(Boolean); }
  function siteOf(s) {
    for (const [k, re] of SITES) if (re.test(s)) return k;
    for (const [k, re] of AR_SITES) if (re.test(s)) return k;
    return null;
  }
  function negated(s, m) {
    if (NEG_POST.test(s) || AR_NEG_POST.test(s)) return true;
    const before = s.slice(0, m.index).split(/\s+/).slice(-8).join(' ');   // negation scope: up to 8 words before the term
    return (NEG_PRE.test(before) || AR_NEG_PRE.test(before)) && !/\b(but|however|although)\b/i.test(before) && !AR_BUT.test(before);
  }
  function patho(s) {
    const m = s.match(PATHO) || s.match(AR_PATHO);
    if (!m) return false;
    const before = s.slice(0, m.index).split(/\s+/).slice(-4).join(' ');
    return !/\b(no|without)\b/i.test(before) && !AR_NEG_PRE.test(before);
  }

  /* report: {text, age, ind}. Returns {decision, site, evidence:[sentence], reasons:[string]} */
  function find(r) {
    const text = r.text || '', ctx = (r.ind || '') + ' ' + text;
    let best = { decision: 'no', site: null, evidence: [], reasons: ['No fracture documented'] };
    let pathoSeen = false, sawFx = false;
    const take = (d, site, s, why) => {
      if (RANK[d] > RANK[best.decision] || (RANK[d] === RANK[best.decision] && best.evidence.length && d !== 'no')) {
        if (RANK[d] > RANK[best.decision]) best = { decision: d, site, evidence: [s], reasons: [why] };
        else if (!best.evidence.includes(s)) best.evidence.push(s);
      }
    };
    for (const s of sentences(text)) {
      const mDef = s.match(FX_DEF) || s.match(AR_FX), mWedge = s.match(FX_WEDGE), mHt = s.match(FX_HEIGHT);
      const m = mDef || mWedge || mHt;
      if (!m) continue;
      if (negated(s, m)) continue;
      sawFx = true;
      const site = siteOf(s);
      if (patho(s)) { pathoSeen = true; continue; }
      if (UNCERTAIN.test(s) || AR_UNCERTAIN.test(s)) { take('review', site, s, 'Hedged language'); continue; }
      if (!mDef) { take('review', site, s, mHt ? 'Height loss without a stated fracture' : 'Wedging or deformity without a stated fracture'); continue; }
      if (!site) { take('review', site, s, 'Fracture site unclear'); continue; }
      if (site === 'other') { take('review', site, s, 'Fracture at a minor site'); continue; }
      take('act', site, s, 'Fragility fracture documented (' + site + ')');
    }
    if (best.decision !== 'no' && (TRAUMA.test(ctx) || AR_TRAUMA.test(ctx))) return { decision: 'no', site: best.site, evidence: best.evidence, reasons: ['High-energy trauma: not a fragility fracture'] };
    if (best.decision === 'no' && pathoSeen) return { decision: 'no', site: null, evidence: [], reasons: ['Pathological fracture (tumour): not osteoporotic'] };
    if (best.decision === 'act' && r.age != null && r.age < 50) return Object.assign(best, { decision: 'review', reasons: ['Fracture under age 50 without trauma: needs review'] });
    if (best.decision === 'no' && !sawFx) {
      const op = sentences(text).find(s => OSTEOPENIA.test(s));
      if (op) return { decision: 'review', site: null, evidence: [op], reasons: ['Bone-density wording but no recognised fracture term'] };
    }
    return best;
  }

  /* Verifier-only vocabulary (wider than FX_DEF on purpose: it only confirms a finding, it does not find one). */
  const V_FX = /(\bfractures?\b|\bfractured\b|\bcompression deformity\b|\bwedge deformity\b|\bwedge compression\b|\bbiconcave deformity\b|\bcrush\b|\bcollapsed?\b|\bvertebroplasty\b|\bkyphoplasty\b|#|\bNO[FH]\b|\bVCF\b|\bvertebra plana\b|\binsufficiency (fractures?|#)|\bwedg(e|ing)\b|\bdeformity\b|\bcollapse\b)/gi;
  const V_HT = /(\b(loss of|reduced|reduction in)\b[^.;]{0,30}\bheight\b|\bheight (loss|reduction)\b)/gi;
  const V_BD = /(\bosteopeni\w*|\bosteoporo\w*|\b(reduction in|reduced|low) bone (mineral )?density\b)/gi;
  /* Does one sentence support the decision? act: an un-negated fracture term that is not pathological.
     review: an un-negated fracture, deformity, height-loss or bone-density term. */
  function supports(s, decision) {
    const pa = patho(s), terms = decision === 'act' ? [V_FX, AR_FX_G] : [V_FX, AR_FX_G, V_HT, V_BD];
    for (const re of terms) for (const m of s.matchAll(re)) {
      // 'collapse' only counts next to a vertebral level or the word vertebra (not lung collapse)
      if (/^collapsed?$/i.test(m[0]) && !/(\b[TL]\d{1,2}\b|vertebra)/i.test(s)) continue;
      if (!negated(s, m) && (decision === 'review' || !pa)) return true;
    }
    return false;
  }

  /* Checks any reader's output (baseline or AI) against the report: evidence must be quoted verbatim,
     and for act/review at least one quoted sentence must state a fracture (or height loss, or bone density) that is not negated. */
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
