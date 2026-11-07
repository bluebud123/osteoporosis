/*
 * OsteoLoop readers: one interface for every way of reading a radiology report, and one verifier around all of them.
 *
 * Reader interface:  { name, local, read(report) -> {decision, site, evidence, reason} | Promise of the same }
 *   local: true when the reader never sends report text off this machine (keyword baseline, mock, a model on localhost).
 *   Any reader that is not explicitly local is treated as non-local: its input is de-identified first.
 *
 * readVerified(reader, report) is the single gate. It (1) de-identifies the text for non-local readers,
 * (2) calls the reader, (3) lets the keyword baseline veto a dismissal (see FLOOR below), and (4) runs F.verify()
 * on the output against the text the reader actually saw. Output that fails verify() is downgraded to 'review'.
 *
 * Adapters: keywordReader (wraps F.find), claudeSampleReader (claude.ai 'sample' capability, guarded),
 * openaiCompatibleReader (any OpenAI-style /chat/completions endpoint: a local model or a hosted one),
 * mockReader (tests). No network call happens at import time.
 *
 * Works in the browser (window.OsteoReaders) and in Node (module.exports).
 */
(function (root) {
  const F = (typeof module !== 'undefined' && module.exports && typeof require === 'function') ? require('./finder.js') : root.OsteoFinder;

  /* ---------------- de-identification (a pre-step, not a guarantee) ---------------- */
  const DIG = '0-9\\u0660-\\u0669\\u06F0-\\u06F9';                              // Western, Arabic-Indic, Persian digits
  const MONTHS = 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
  const D = '[' + DIG + ']';
  const RULES = [
    ['EMAIL', /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[EMAIL]'],
    ['ID', new RegExp('(?<!' + D + ')784[-\\s]?' + D + '{4}[-\\s]?' + D + '{7}[-\\s]?' + D + '(?!' + D + ')', 'g'), '[ID]'],   // Emirates ID 784-YYYY-NNNNNNN-N
    ['ID', new RegExp('(?<!' + D + ')' + D + '{6}-' + D + '{2}-' + D + '{4}(?!' + D + ')', 'g'), '[ID]'],                     // Malaysian NRIC YYMMDD-PB-NNNN
    ['MRN', new RegExp('\\b(?:MRN|M\\.R\\.N\\.?|HN|Hospital (?:No|Number)|Hosp\\.? No|File No|Rekod Perubatan|No\\.? Rekod)[\\s:#.-]*[A-Za-z0-9/\\-' + DIG + ']*' + D + '[A-Za-z0-9/\\-' + DIG + ']*', 'gi'), '[MRN]'],
    ['MRN', /رقم\s*(?:الملف|السجل)[\s:#]*[A-Za-z0-9/\-٠-٩]*[٠-٩\d][A-Za-z0-9/\-٠-٩]*/g, '[MRN]'],
    ['PHONE', new RegExp('\\+' + D + '[' + DIG + '\\s\\-().]{6,18}' + D, 'g'), '[PHONE]'],                                  // international
    ['PHONE', new RegExp('(?<!' + D + ')[0\\u0660]' + D + '{1,2}[\\s-]?' + D + '{3,4}[\\s-]?' + D + '{3,4}(?!' + D + ')', 'g'), '[PHONE]'],   // local 0xx...
    ['DATE', new RegExp('(?<!' + D + ')' + D + '{1,2}[/.-]' + D + '{1,2}[/.-]' + D + '{2,4}(?!' + D + ')', 'g'), '[DATE]'],
    ['DATE', new RegExp('(?<!' + D + ')' + D + '{4}[/.-]' + D + '{1,2}[/.-]' + D + '{1,2}(?!' + D + ')', 'g'), '[DATE]'],
    ['DATE', new RegExp('\\b' + D + '{1,2}(?:st|nd|rd|th)?[ -]+(?:' + MONTHS + ')[a-z]*\\.?(?:[ ,-]+' + D + '{4})?\\b' +
      '|\\b(?:' + MONTHS + ')[a-z]*\\.?[ ]+' + D + '{1,2}(?:st|nd|rd|th)?(?:,?[ ]+' + D + '{4})?\\b' +
      '|\\b(?:' + MONTHS + ')[a-z]*\\.?,?[ ]+' + D + '{4}\\b', 'g'), '[DATE]'],   // English month names only
    ['ID', new RegExp('(?<!' + D + ')' + D + '{7,}(?!' + D + ')', 'g'), '[ID]'],                                              // any long digit run (MRN, accession, IC)
  ];
  // A name never absorbs a clinical word: the name is cut at the first word in this list.
  const STOP = new Set(['fracture', 'fractures', 'fx', 'fract', 'nof', 'noh', 'no', 'not', 'nad', 'wnl', 'normal', 'left', 'right',
    'acute', 'old', 'chronic', 'mild', 'moderate', 'severe', 'findings', 'impression', 'comparison', 'technique', 'clinical',
    'history', 'report', 'study', 'ct', 'mri', 'xr', 'cxr', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'with', 'and', 'or', 'is',
    'was', 'has', 'have', 'see', 'osteoporosis', 'osteopenia', 'lumbar', 'thoracic', 'vertebra', 'vertebral', 'pelvis', 'hip',
    'femur', 'wrist', 'humerus', 'rib', 'spine', 'reviewed', 'advised', 'noted', 'dated', 'seen']);
  const CONNECT = new Set(['bin', 'binti', 'bint', 'al', 'el', 'ibn']);
  const AR_STOP = new Set(['كسر', 'كسور', 'مكسور', 'مكسورة', 'انضغاط', 'انضغاطي', 'فقرة', 'الفقرة', 'فقرات', 'الفخذ', 'عنق', 'العضد',
    'الحوض', 'الكعبرة', 'الضلع', 'لا', 'لم', 'ليس', 'يشتبه', 'محتمل', 'ورم', 'طبيعي', 'ظاهر']);
  // Title + name: Dr, Prof, Mr, Mrs, Ms, Datuk, Puan, Encik... (case-sensitive so that 'ms' (milliseconds) is not a title)
  const NAME_TITLE = /(\b(?:Dr|DR|Prof|PROF|Mr|MR|Mrs|MRS|Ms|MS|Datuk|DATUK|Dato'?|Encik|Puan|PUAN)\.?\s+)([A-Za-z'’\-]+(?:\s+[A-Za-z'’\-]+){0,3})/g;
  const NAME_CUE = /(\b(?:Patient(?: name)?|PATIENT(?: NAME)?|Name|NAME|Nama|NAMA|Pesakit|PESAKIT)\s*:\s*)([A-Za-z'’\-]+(?:\s+[A-Za-z'’\-]+){0,4})/g;
  const NAME_AR = /((?<![ء-ي])(?:د\.|الدكتور(?:ة)?|دكتور|السيد(?:ة)?|الأستاذ(?:ة)?|الشيخ|اسم المريض|اسم)\s*:?\s*)([ء-ي]+(?:\s+(?:بن|بنت|ابن)?\s*[ء-ي]+){0,2})/g;

  /* Returns the part of a candidate name that is kept after the name, or null when nothing is a name. */
  function splitName(cand, arabic) {
    const toks = cand.split(/\s+/), keep = [];
    for (const t of toks) {
      const lower = t.toLowerCase();
      if (arabic ? AR_STOP.has(t) : STOP.has(lower)) break;
      if (arabic || /^[A-Z]/.test(t) || CONNECT.has(lower)) keep.push(t); else break;
    }
    while (keep.length && CONNECT.has(keep[keep.length - 1].toLowerCase())) keep.pop();
    if (!keep.length) return null;
    return toks.slice(keep.length).join(' ');
  }

  /* deidentifyDetailed(text) -> {text, counts}. Applied before any non-local reader.
     Removes: e-mail, Emirates ID, Malaysian NRIC, labelled MRN, phone numbers, dates (numeric and English month names),
     digit runs of 7 or more, and names after a title (Dr, Prof, Mr, Datuk, د., الدكتور...) or after a 'Patient:' / 'Name:' cue. */
  function deidentifyDetailed(text) {
    let t = String(text == null ? '' : text);
    const counts = {}, bump = k => { counts[k] = (counts[k] || 0) + 1; };
    for (const [type, re, rep] of RULES) t = t.replace(re, () => { bump(type); return rep; });
    t = t.replace(NAME_TITLE, (m, title, cand) => { const rest = splitName(cand, false); if (rest === null) return m; bump('NAME'); return title + '[NAME]' + (rest ? ' ' + rest : ''); });
    t = t.replace(NAME_CUE, (m, cue, cand) => { const rest = splitName(cand, false); if (rest === null) return m; bump('NAME'); return cue + '[NAME]' + (rest ? ' ' + rest : ''); });
    t = t.replace(NAME_AR, (m, cue, cand) => { const rest = splitName(cand, true); if (rest === null) return m; bump('NAME'); return cue + '[NAME]' + (rest ? ' ' + rest : ''); });
    return { text: t, counts };
  }
  function deidentify(text) { return deidentifyDetailed(text).text; }

  /* ---------------- helpers ---------------- */
  function normalise(out) {
    if (!out || typeof out !== 'object') return { decision: 'invalid', site: null, evidence: [], reason: 'reader returned no object' };
    const reason = Array.isArray(out.reasons) ? out.reasons.join('; ') : (out.reason || '');
    return { decision: out.decision, site: out.site || null, evidence: [].concat(out.evidence || []).filter(e => typeof e === 'string'), reason: String(reason) };
  }
  function parseJsonObject(text) {
    const s = String(text || '');
    try { return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)); } catch (e) { return { decision: 'invalid', evidence: [], reason: 'unparseable reply' }; }
  }
  function isLocalReader(reader) { return reader && reader.local === true; }

  /* ---------------- adapters ---------------- */
  function keywordReader() {
    return { name: 'keyword', local: true, read: r => { const o = F.find(r); return { decision: o.decision, site: o.site, evidence: o.evidence, reason: o.reasons.join('; ') }; } };
  }

  /* claude.ai 'sample' capability (the app's AI reader). Needs the page to declare capabilities {sample: {}}.
     getSample is injectable for tests; by default it asks window.claude.use('sample'). Absent capability: status 'unavailable'. */
  function claudeSampleReader(opts) {
    const o = opts || {};
    const getSample = o.getSample || (async () => (typeof window !== 'undefined' && window.claude && window.claude.use) ? window.claude.use('sample') : null);
    return {
      name: 'claude-sample', local: false,
      available: () => o.getSample ? true : (typeof window !== 'undefined' && !!(window.claude && window.claude.use)),
      read: async r => {
        const s = await getSample();
        if (!s || typeof s.json !== 'function') { const e = new Error('claude sample capability not available'); e.unavailable = true; throw e; }
        const out = await s.json(F.aiBatchPrompt([r]), { modelTier: o.modelTier || 'default' });
        const one = Array.isArray(out) ? out[0] : (typeof out === 'string' ? parseJsonObject(out) : out);
        return one;
      }
    };
  }

  /* OpenAI-compatible chat endpoint: a locally hosted model (for example Jais behind a local server) or a UAE-hosted one.
     baseURL is the API root (the adapter appends /chat/completions). local is inferred from the host unless set.
     Never put a real apiKey in browser code. fetchImpl is injectable; globalThis.fetch is read only when read() runs. */
  function openaiCompatibleReader(opts) {
    const o = opts || {};
    if (!o.baseURL || !o.model) throw new Error('openaiCompatibleReader needs baseURL and model');
    const host = (() => { try { return new URL(o.baseURL).hostname; } catch (e) { return ''; } })();
    const local = typeof o.local === 'boolean' ? o.local : /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(host);
    return {
      name: 'openai-compatible:' + o.model, local,
      read: async r => {
        const f = o.fetchImpl || globalThis.fetch;
        if (typeof f !== 'function') throw new Error('no fetch available');
        const headers = { 'content-type': 'application/json' };
        if (o.apiKey) headers.authorization = 'Bearer ' + o.apiKey;
        const body = { model: o.model, temperature: 0, max_tokens: 400, messages: [
          { role: 'system', content: F.AI_PROMPT },
          { role: 'user', content: JSON.stringify({ id: r.id, age: r.age, sex: r.sex, study: r.mod, indication: r.ind, report: r.text }) }] };
        const res = await f(o.baseURL.replace(/\/+$/, '') + '/chat/completions', { method: 'POST', headers, body: JSON.stringify(body) });
        if (!res || !res.ok) throw new Error('HTTP ' + (res && res.status));
        const j = await res.json();
        return parseJsonObject(j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content);
      }
    };
  }

  /* Test double: table maps report id -> output, or fn(report) -> output. Missing answers throw. */
  function mockReader(tableOrFn, name) {
    return {
      name: name || 'mock', local: true,
      read: r => {
        const out = typeof tableOrFn === 'function' ? tableOrFn(r) : tableOrFn[r.id];
        if (out === undefined) throw new Error('mock: no answer for ' + r.id);
        return out;
      }
    };
  }

  /* ---------------- the single gate ---------------- */
  /* Keyword veto: a reader may not silently dismiss what the keyword baseline surfaces (act or review).
     It may still downgrade, or confirm, but a 'no' is turned into 'review' and sent to a person. */
  function applyFloor(view, out) {
    const k = F.find(view);
    if ((k.decision === 'act' || k.decision === 'review') && out.decision === 'no')
      return { decision: 'review', site: k.site, evidence: k.evidence, reason: 'Reader said no, but the keyword baseline documents a fracture: sent to review', floored: true };
    return out;
  }

  /* readVerified(reader, report, {floor}) -> Promise of
     {reader, status: 'ok'|'error'|'unavailable', decision, site, evidence, reason, verified, problems, deidentified, floored} */
  async function readVerified(reader, report, opts) {
    const o = opts || {};
    if (reader.available && !reader.available()) return { reader: reader.name, status: 'unavailable', decision: null, verified: false, problems: ['reader unavailable'] };
    const local = isLocalReader(reader);
    const view = Object.assign({}, report, { text: local ? String(report.text || '') : deidentify(report.text) });
    let out, status = 'ok';
    try { out = normalise(await reader.read(view)); }
    catch (e) {
      status = e && e.unavailable ? 'unavailable' : 'error';
      if (status === 'unavailable') return { reader: reader.name, status, decision: null, verified: false, problems: [e.message] };
      out = { decision: 'invalid', site: null, evidence: [], reason: 'reader error: ' + (e && e.message) };
    }
    let floored = false;
    if (o.floor !== false) { const f = applyFloor(view, out); if (f !== out) { out = f; floored = true; } }
    const v = F.verify(view, out);
    if (!v.ok) return { reader: reader.name, status, decision: 'review', site: out.site, evidence: out.evidence, reason: 'Unverified output: ' + v.problems.join('; '), verified: false, problems: v.problems, deidentified: !local, floored };
    return { reader: reader.name, status, decision: out.decision, site: out.site, evidence: out.evidence, reason: out.reason, verified: true, problems: [], deidentified: !local, floored };
  }

  const api = { deidentify, deidentifyDetailed, keywordReader, claudeSampleReader, openaiCompatibleReader, mockReader, readVerified, isLocalReader, parseJsonObject };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OsteoReaders = api;
})(typeof window !== 'undefined' ? window : globalThis);
