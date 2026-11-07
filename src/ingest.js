/*
 * OsteoLoop ingest: turns one radiology report from one of four routes into the repo's report shape.
 *   hl7v2  HL7 v2 ORU^R01 message text (MSH, PID, OBR, OBX; CR, LF or CRLF separators; MLLP framing removed)
 *   fhir   FHIR R4 DiagnosticReport, or a Bundle of DiagnosticReports and Patients (JSON text or object)
 *   csv    CSV text with a header row (columns found by name, or given by an explicit mapping)
 *   paste  plain text, optionally preceded by 'Age:', 'Sex:', 'Study:', 'Indication:', 'Date:' lines
 *
 * Every parser returns {ok, report, reports, warnings, errors, flags} and never throws. A parse with any error
 * returns no reports, so nothing is half-used. A report is {id, patient_id?, age, sex, mod, ind, text, date}.
 * Unknown or missing age and sex are null and flagged. `flags` holds machine codes for routing (for example
 * 'possible-truncation', 'html-markup'); `warnings` holds the same news for people.
 *
 * No network calls. Works in the browser (window.OsteoIngest) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  const DEFAULTS = { maxInputChars: 2000000, maxReportChars: 50000, maxRows: 2000, maxSegments: 5000, maxObx: 1000, maxEntries: 500 };
  const BIDI_TEST = /[\u202a-\u202e\u2066-\u2069]/;
  const BIDI_G = /[\u202a-\u202e\u2066-\u2069]/g;
  const CTRL_TEST = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;
  const CTRL_G = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
  const HTML_TEST = /<\/?[a-zA-Z][^>]{0,200}>/;
  const MOJIBAKE_TEST = /[\u00c2\u00c3\u00d8\u00d9][\u0080-\u00bf]/;
  const HL7_DEFAULT_ENC = { comp: '^', rep: '~', esc: '\\', sub: '&' };
  const ALIASES = {
    text: ['text', 'report', 'report_text', 'findings', 'impression', 'narrative', 'body', 'report_body'],
    id: ['id', 'report_id', 'accession', 'accession_no', 'accession_number'],
    patient_id: ['patient_id', 'patient', 'mrn', 'patient_ref'],
    age: ['age'],
    sex: ['sex', 'gender'],
    mod: ['mod', 'modality', 'study', 'exam', 'exam_name'],
    ind: ['ind', 'indication', 'reason', 'reason_for_study', 'clinical_history'],
    date: ['date', 'report_date', 'exam_date', 'study_date']
  };
  const PASTE_KEYS = { age: 'age', sex: 'sex', gender: 'sex', study: 'mod', modality: 'mod', indication: 'ind', reason: 'ind', date: 'date', id: 'id', patient: 'patient_id' };

  /* ---------- result helpers ---------- */
  function newResult() { return { ok: false, report: null, reports: [], warnings: [], errors: [], flags: [] }; }
  function warn(res, flag, msg) {
    if (res.warnings.length < 200) res.warnings.push(msg);
    if (flag && !res.flags.includes(flag)) res.flags.push(flag);
  }
  function fail(res, msg) {
    if (res.errors.length < 50) res.errors.push(msg);
    else if (res.errors.length === 50) res.errors.push('further errors not listed');
  }
  function done(res) {
    if (res.errors.length) { res.reports = []; res.ok = false; }
    else {
      res.ok = res.reports.length > 0;
      if (!res.ok) res.errors.push('no report found in input');
    }
    res.report = res.reports[0] || null;
    return res;
  }
  function clip(s, n) { const t = String(s == null ? '' : s); return t.length > n ? t.slice(0, n) + '...' : t; }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function limitsOf(profile) {
    const l = Object.assign({}, DEFAULTS);
    const src = profile && profile.limits;
    if (isObj(src)) for (const k of ['maxInputChars', 'maxReportChars', 'maxRows']) {
      if (Number.isInteger(src[k]) && src[k] > 0) l[k] = src[k];
    }
    return l;
  }
  function fnv(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  /* ---------- text hygiene ---------- */
  // Removes bidi overrides and control characters (keeps tab, CR and LF). Flags are set for the caller.
  function stripControls(res, s, where) {
    let t = s == null ? '' : String(s);
    if (BIDI_TEST.test(t)) { t = t.replace(BIDI_G, ''); warn(res, 'bidi-removed', where + ': bidirectional override characters removed'); }
    if (CTRL_TEST.test(t)) { t = t.replace(CTRL_G, ''); warn(res, 'control-removed', where + ': control characters removed'); }
    return t;
  }
  // Flags markup and encoding problems in report text. The text itself is kept verbatim (quotes must match it).
  function flagText(res, t, where) {
    if (HTML_TEST.test(t)) warn(res, 'html-markup', where + ': HTML markup in report text, kept as plain text (display it escaped)');
    if (MOJIBAKE_TEST.test(t)) warn(res, 'possible-mojibake', where + ': text may be UTF-8 read as Latin-1 (check the feed encoding)');
    return t;
  }
  function cleanText(res, s, where) { return flagText(res, stripControls(res, s, where), where); }

  function cleanId(v) { return String(v == null ? '' : v).trim().replace(/[^A-Za-z0-9._-]/g, '').slice(0, 64); }
  function cleanPatientId(v) { return String(v == null ? '' : v).trim().slice(0, 64); }

  /* ---------- dates, age, sex ---------- */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function isoDate(y, m, d) {
    if (!(y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return y + '-' + pad2(m) + '-' + pad2(d);
  }
  function hl7Date(raw) {
    const m = /^\s*(\d{4})(\d{2})(\d{2})/.exec(String(raw == null ? '' : raw));
    return m ? isoDate(+m[1], +m[2], +m[3]) : null;
  }
  function isoFromDateTime(raw) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw == null ? '' : raw));
    return m ? isoDate(+m[1], +m[2], +m[3]) : null;
  }
  function ageOn(dob, ref) {
    if (!dob || !ref) return null;
    const b = dob.split('-').map(Number), r = ref.split('-').map(Number);
    let a = r[0] - b[0];
    if (r[1] < b[1] || (r[1] === b[1] && r[2] < b[2])) a--;
    return a >= 0 && a <= 120 ? a : null;
  }
  function sexCode(v) {
    const s = String(v == null ? '' : v).trim().toUpperCase();
    if (s === 'M' || s === 'MALE') return 'M';
    if (s === 'F' || s === 'FEMALE') return 'F';
    return null;
  }
  function parseAge(raw, res, where) {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return null;
    if (!/^\d{1,3}$/.test(s) || +s > 120) { warn(res, 'age-invalid', where + ': age "' + clip(s, 12) + '" is not a valid age, left empty'); return null; }
    return +s;
  }
  function parseSex(raw, res, where) {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return null;
    const c = sexCode(s);
    if (!c) warn(res, 'sex-invalid', where + ': sex "' + clip(s, 12) + '" is not M or F, left empty');
    return c;
  }
  function checkDemographics(res, rep, where) {
    if (rep.age == null) warn(res, 'age-missing', where + ': age unknown (left empty; confirm before treating as very high risk)');
    if (rep.sex == null) warn(res, 'sex-missing', where + ': sex unknown (left empty)');
  }
  function makeReport(f) {
    const r = { id: f.id, age: f.age, sex: f.sex, mod: f.mod || '', ind: f.ind || '', text: f.text, date: f.date || null };
    if (f.patient_id) r.patient_id = f.patient_id;
    return r;
  }
  function checkLength(res, text, lim, where) {
    if (text.length > lim.maxReportChars) {
      fail(res, where + ': report is ' + text.length + ' characters, over the ' + lim.maxReportChars + '-character limit; send it to a human reader');
      return false;
    }
    return true;
  }

  /* ---------- HL7 v2 ---------- */
  function escRe(c) { return c.replace(/[.*+?^${}()|[\]\\\/-]/g, '\\$&'); }
  function hexToAscii(hex) {
    let out = '';
    for (let i = 0; i < hex.length; i += 2) {
      const c = parseInt(hex.substr(i, 2), 16);
      if (c > 127) return null;
      out += String.fromCharCode(c);
    }
    return out;
  }
  function decodeHl7(s, fs, enc, res) {
    if (s.indexOf(enc.esc) === -1) return s;
    const e = escRe(enc.esc);
    const re = new RegExp(e + '([^' + e + '\\r\\n]{0,24})' + e, 'g');
    let unknown = false;
    const out = s.replace(re, (m, code) => {
      switch (code) {
        case 'F': return fs;
        case 'S': return enc.comp;
        case 'T': return enc.sub;
        case 'R': return enc.rep;
        case 'E': return enc.esc;
        case '.br': return '\n';
        case '.sp': return ' ';
        case 'H': case 'N': return '';
        default: {
          if (/^X([0-9A-Fa-f]{2})+$/.test(code)) { const a = hexToAscii(code.slice(1)); if (a !== null) return a; }
          unknown = true;
          return m;
        }
      }
    });
    if (unknown) warn(res, 'escape-unknown', 'unknown HL7 escape sequence kept as text');
    return out;
  }
  function fieldText(raw, fs, enc, res) {
    if (!raw) return '';
    return raw.split(enc.rep).map(r => r.split(enc.comp).map(c => decodeHl7(c, fs, enc, res)).join(enc.comp)).join('\n');
  }
  function hl7Encoding(res, msh2, fs) {
    let enc = HL7_DEFAULT_ENC;
    if (msh2.length === 4 || msh2.length === 5) enc = { comp: msh2[0], rep: msh2[1], esc: msh2[2], sub: msh2[3] };
    else warn(res, 'encoding-default', 'MSH-2 is not four characters, default ^~\\& used');
    const chars = [fs, enc.comp, enc.rep, enc.esc, enc.sub];
    if (new Set(chars).size !== 5 || chars.some(c => /[A-Za-z0-9 ]/.test(c))) return null;
    return enc;
  }
  function parseHl7Impl(input, opts) {
    const res = newResult();
    const lim = limitsOf(opts && opts.profile);
    if (typeof input !== 'string') { fail(res, 'HL7 input must be text'); return done(res); }
    if (input.length > lim.maxInputChars) { fail(res, 'input is ' + input.length + ' characters, over the input limit'); return done(res); }
    if (/[\u000B\u001C]/.test(input)) warn(res, 'mllp-framing', 'MLLP framing characters removed');
    const raw = stripControls(res, input.replace(/[\u000B\u001C]/g, ''), 'message');
    const lines = raw.split(/\r\n|\r|\n/).filter(l => l.trim() !== '');
    if (!lines.length) { fail(res, 'empty message'); return done(res); }
    if (lines.length > lim.maxSegments) { fail(res, 'message has ' + lines.length + ' segments, over the segment limit'); return done(res); }
    const first = lines[0];
    if (first.slice(0, 3) !== 'MSH' || first.length < 9) { fail(res, 'message does not start with an MSH segment'); return done(res); }
    const fs = first[3];
    if (/[A-Za-z0-9 ]/.test(fs)) { fail(res, 'MSH field separator is not a punctuation character'); return done(res); }
    const mshParts = first.slice(4).split(fs);
    const msh2 = mshParts[0] || '';
    const enc = hl7Encoding(res, msh2, fs);
    if (!enc) { fail(res, 'MSH-2 encoding characters are not distinct punctuation'); return done(res); }
    const MSH = ['MSH', fs, msh2].concat(mshParts.slice(1));   // MSH[k] is MSH-k
    const msgType = (MSH[9] || '').split(enc.comp);
    if (msgType[0] !== 'ORU') { fail(res, 'not an ORU message (MSH-9 is "' + clip(MSH[9] || '', 20) + '")'); return done(res); }
    if (msgType[1] && msgType[1] !== 'R01') warn(res, 'message-variant', 'message type ORU^' + msgType[1] + ' read as a result message');
    const declared = (MSH[18] || '').split(enc.rep)[0].trim();
    if (declared && !/^UNICODE UTF-8$/i.test(declared) && /[^\x00-\x7F]/.test(raw)) {
      warn(res, 'charset-declared', 'MSH-18 declares "' + clip(declared, 20) + '" but non-ASCII text is present: check the feed decoding');
    }
    // Segments
    let pid = null, obxCount = 0;
    const groups = [];
    let cur = null;
    for (let i = 1; i < lines.length; i++) {
      const seg = lines[i];
      const name = seg.slice(0, 3);
      if (!/^[A-Z][A-Z0-9]{2}$/.test(name) || (seg.length > 3 && seg[3] !== fs)) {
        warn(res, 'segment-malformed', 'malformed segment skipped: "' + clip(seg, 40) + '"');
        continue;
      }
      const F = seg.split(fs);
      if (name === 'PID') { if (!pid) pid = F; }
      else if (name === 'OBR') { cur = { obr: F, obx: [] }; groups.push(cur); }
      else if (name === 'OBX') {
        if (++obxCount > DEFAULTS.maxObx) { fail(res, 'more than ' + DEFAULTS.maxObx + ' OBX segments'); return done(res); }
        if (!cur) { cur = { obr: null, obx: [] }; groups.push(cur); }
        cur.obx.push(F);
      }
    }
    if (!pid) warn(res, 'no-pid', 'no PID segment: age and sex unknown');
    const patientId = pid ? cleanPatientId(((pid[3] || '').split(enc.rep)[0] || '').split(enc.comp)[0]) : '';
    let dob = null;
    if (pid && pid[7]) { dob = hl7Date(pid[7]); if (!dob) warn(res, 'dob-invalid', 'PID-7 birth date unreadable: age not computed'); }
    const sex = pid ? parseSex(pid[8], res, 'PID-8') : null;
    // Possible truncation: the last line is an incomplete OBX (no result status) or ends mid-word.
    const last = lines[lines.length - 1];
    if (last.slice(0, 3) === 'OBX') {
      const lastFields = last.split(fs);
      const lastValue = (lastFields[5] || '').trim();
      if (lastFields.length < 12) warn(res, 'possible-truncation', 'last OBX has no result status (OBX-11): message may be truncated');
      else if (lastValue && /[A-Za-z؀-ۿ]$/.test(lastValue)) warn(res, 'possible-truncation', 'last result line does not end with punctuation: may be truncated');
    }
    const msgDate = hl7Date(MSH[7]);
    if (!groups.length) { fail(res, 'no OBX result text found'); return done(res); }
    groups.forEach((g, gi) => {
      const where = 'report ' + (gi + 1);
      const values = [];
      for (const F of g.obx) {
        const vtype = (F[2] || '').trim().toUpperCase();
        const status = (F[11] || '').trim().toUpperCase();
        if (['X', 'D'].includes(status)) { warn(res, null, where + ': cancelled or deleted OBX ignored'); continue; }
        if (!['TX', 'FT', 'ST'].includes(vtype)) { warn(res, null, where + ': OBX value type "' + clip(vtype, 6) + '" is not read as text'); continue; }
        const v = F[5] || '';
        if (v.trim() === '') { warn(res, null, where + ': empty OBX value ignored'); continue; }
        values.push(fieldText(v, fs, enc, res));
      }
      if (!values.length) { fail(res, where + ': no readable OBX text'); return; }
      const text = flagText(res, values.join('\n'), where);
      if (!checkLength(res, text, lim, where)) return;
      const obr = g.obr || [];
      const reportDate = obr[7] ? hl7Date(obr[7]) : null;
      if (obr[7] && !reportDate) warn(res, null, where + ': OBR-7 date unreadable');
      const date = reportDate || msgDate;
      if (dob && !date) warn(res, null, where + ': report date missing: age not computed');
      const age = ageOn(dob, date);
      if (dob && date && age == null) warn(res, null, where + ': age not computed (birth date after report date or implausible)');
      const obrId = g.obr ? ((obr[3] || '').split(enc.comp)[0] || (obr[2] || '').split(enc.comp)[0]) : '';
      const ctrl = (MSH[10] || '').split(enc.comp)[0];
      let id = cleanId(obrId) || cleanId(ctrl) || ('ING-' + fnv(text));
      if (groups.length > 1) id = id + '-' + (gi + 1);
      const svc = (obr[4] || '').split(enc.comp);
      const mod = (svc[1] || svc[0] || '').trim();
      const ind = fieldText(obr[31] || obr[13] || '', fs, enc, res);
      const rep = makeReport({ id, patient_id: patientId, age, sex, mod, ind, text, date });
      checkDemographics(res, rep, where);
      res.reports.push(rep);
    });
    return done(res);
  }

  /* ---------- FHIR R4 ---------- */
  function decodeBase64Text(res, data, contentType, where) {
    if (typeof data !== 'string' || data.trim() === '') { fail(res, where + ': text/plain attachment has no data'); return null; }
    const compact = data.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact) || compact.length % 4 === 1) { fail(res, where + ': presentedForm data is not valid base64'); return null; }
    let padded = compact;
    if (compact.length % 4 !== 0) { warn(res, null, where + ': base64 padding added'); padded = compact + '='.repeat(4 - (compact.length % 4)); }
    let bin;
    try { bin = atob(padded); } catch (e) { fail(res, where + ': presentedForm data is not valid base64'); return null; }
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 255;
    const m = /charset\s*=\s*"?([^";\s]+)"?/i.exec(contentType || '');
    const label = m ? m[1] : 'utf-8';
    let td;
    try { td = new TextDecoder(label, { fatal: true }); }
    catch (e) { fail(res, where + ': charset "' + clip(label, 30) + '" is not supported'); return null; }
    try { return td.decode(bytes); }
    catch (e) { fail(res, where + ': bytes are not valid ' + clip(label, 30) + ' (wrong charset declared?)'); return null; }
  }
  function resolvePatient(dr, containedList, patients) {
    const ref = isObj(dr.subject) && typeof dr.subject.reference === 'string' ? dr.subject.reference : null;
    if (!ref) return null;
    if (ref[0] === '#') return containedList.find(c => c.resourceType === 'Patient' && c.id === ref.slice(1)) || null;
    if (patients.has(ref)) return patients.get(ref);
    const tail = ref.split('/').pop();
    return patients.get(tail) || null;
  }
  function refPatientId(ref) {
    if (typeof ref !== 'string' || ref === '') return '';
    return cleanPatientId(ref[0] === '#' ? ref.slice(1) : ref.split('/').pop());
  }
  function parseFhirImpl(input, opts) {
    const res = newResult();
    const lim = limitsOf(opts && opts.profile);
    let root = input;
    if (typeof input === 'string') {
      if (input.length > lim.maxInputChars) { fail(res, 'input is ' + input.length + ' characters, over the input limit'); return done(res); }
      try { root = JSON.parse(input); } catch (e) { fail(res, 'FHIR input is not valid JSON'); return done(res); }
    }
    if (!isObj(root)) { fail(res, 'FHIR input must be a JSON object'); return done(res); }
    const patients = new Map();
    const drEntries = [];
    if (root.resourceType === 'Bundle') {
      const entries = Array.isArray(root.entry) ? root.entry : [];
      if (entries.length > DEFAULTS.maxEntries) { fail(res, 'bundle has ' + entries.length + ' entries, over the entry limit'); return done(res); }
      for (const e of entries) {
        if (!isObj(e) || !isObj(e.resource)) continue;
        const r = e.resource;
        if (r.resourceType === 'Patient') {
          if (typeof r.id === 'string') patients.set(r.id, r);
          if (typeof e.fullUrl === 'string') patients.set(e.fullUrl, r);
        } else if (r.resourceType === 'DiagnosticReport') drEntries.push(r);
      }
    } else if (root.resourceType === 'DiagnosticReport') {
      drEntries.push(root);
    } else {
      fail(res, 'expected a DiagnosticReport or a Bundle, got "' + clip(root.resourceType, 30) + '"');
      return done(res);
    }
    if (!drEntries.length) { fail(res, 'no DiagnosticReport found'); return done(res); }
    for (const dr of drEntries) {
      const idLabel = typeof dr.id === 'string' ? cleanId(dr.id) : '';
      const where = 'DiagnosticReport ' + (idLabel || '(no id)');
      if (dr.status === 'entered-in-error') { warn(res, 'skipped-error-report', where + ': entered in error, skipped'); continue; }
      const containedList = (Array.isArray(dr.contained) ? dr.contained : []).filter(isObj);
      const patient = resolvePatient(dr, containedList, patients);
      let presented = '';
      if (Array.isArray(dr.presentedForm)) {
        for (const p of dr.presentedForm) {
          if (!isObj(p)) continue;
          const ct = typeof p.contentType === 'string' ? p.contentType.toLowerCase() : '';
          if (!ct.startsWith('text/plain')) { warn(res, 'attachment-skipped', where + ': attachment "' + clip(ct || '(no type)', 40) + '" not read'); continue; }
          const dec = decodeBase64Text(res, p.data, ct, where);
          if (dec === null) { presented = null; break; }
          presented = presented ? presented + '\n' + dec : dec;
        }
      }
      if (presented === null) continue;
      const conclusion = typeof dr.conclusion === 'string' ? dr.conclusion : '';
      const codeText = Array.isArray(dr.conclusionCode)
        ? dr.conclusionCode.filter(isObj).map(c => c.text || '').filter(Boolean).join('; ') : '';
      const concl = conclusion || codeText;
      let text = presented;
      if (concl && !presented.includes(concl)) text = presented ? presented + '\n' + concl : concl;
      if (!text.trim()) { fail(res, where + ': no narrative (conclusion or text/plain attachment): cannot read'); continue; }
      text = cleanText(res, text, where);
      if (!checkLength(res, text, lim, where)) continue;
      const dateRaw = dr.effectiveDateTime || dr.effectiveInstant || (isObj(dr.effectivePeriod) ? dr.effectivePeriod.start : '') || dr.issued;
      const date = isoFromDateTime(dateRaw);
      if (dateRaw && !date) warn(res, null, where + ': report date unreadable');
      let dob = null, sex = null;
      if (patient) {
        if (patient.birthDate) { dob = isoFromDateTime(patient.birthDate); if (!dob) warn(res, null, where + ': Patient.birthDate unreadable'); }
        const g = typeof patient.gender === 'string' ? patient.gender.toLowerCase() : '';
        sex = g === 'male' ? 'M' : g === 'female' ? 'F' : null;
        if (g && !sex) warn(res, 'sex-invalid', where + ': Patient.gender "' + clip(g, 12) + '" is not male or female');
      } else {
        warn(res, null, where + ': patient not found in the input: age and sex unknown');
      }
      const age = ageOn(dob, date);
      if (dob && date && age == null) warn(res, null, where + ': age not computed (birth date after report date or implausible)');
      let mod = '';
      if (isObj(dr.code)) {
        const c0 = Array.isArray(dr.code.coding) && isObj(dr.code.coding[0]) ? dr.code.coding[0] : {};
        mod = String(dr.code.text || c0.display || c0.code || '').trim();
      }
      const ind = Array.isArray(dr.reasonCode)
        ? dr.reasonCode.filter(isObj).map(c => c.text || (Array.isArray(c.coding) && isObj(c.coding[0]) ? c.coding[0].display || '' : '')).filter(Boolean).join('; ') : '';
      const ident = Array.isArray(dr.identifier) && isObj(dr.identifier[0]) ? dr.identifier[0].value : '';
      const id = idLabel || cleanId(ident) || ('FHIR-' + fnv(text));
      const pid = patient && typeof patient.id === 'string' ? cleanPatientId(patient.id) : refPatientId(isObj(dr.subject) ? dr.subject.reference : '');
      const rep = makeReport({ id, patient_id: pid, age, sex, mod, ind, text, date });
      checkDemographics(res, rep, where);
      res.reports.push(rep);
    }
    return done(res);
  }

  /* ---------- CSV ---------- */
  // RFC 4180 style: quoted fields, "" escapes, quoted newlines. Returns {rows} or {error}.
  function csvRows(s) {
    const rows = [];
    let row = [], field = '', i = 0, inQ = false;
    const n = s.length;
    while (i < n) {
      const c = s[i];
      if (inQ) {
        if (c === '"') {
          if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"' && field === '') { inQ = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r' || c === '\n') {
        row.push(field); rows.push(row); row = []; field = '';
        i += (c === '\r' && s[i + 1] === '\n') ? 2 : 1;
        continue;
      }
      field += c; i++;
    }
    if (inQ) return { rows, error: 'unterminated quoted field (the file ends inside a quote)' };
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return { rows };
  }
  function normHeader(h) { return String(h == null ? '' : h).trim().toLowerCase().replace(/[\s-]+/g, '_'); }
  function resolveColumns(res, idx, mapping) {
    const out = {};
    for (const k of Object.keys(ALIASES)) {
      out[k] = -1;
      if (isObj(mapping) && Object.prototype.hasOwnProperty.call(mapping, k)) {
        const h = normHeader(mapping[k]);
        if (idx.has(h)) out[k] = idx.get(h);
        else fail(res, 'mapping for "' + k + '" names a column that is not in the header');
      } else {
        for (const a of ALIASES[k]) if (idx.has(a)) { out[k] = idx.get(a); break; }
      }
    }
    return out;
  }
  function parseCsvImpl(input, opts) {
    const res = newResult();
    const lim = limitsOf(opts && opts.profile);
    if (typeof input !== 'string') { fail(res, 'CSV input must be text'); return done(res); }
    if (input.length > lim.maxInputChars) { fail(res, 'input is ' + input.length + ' characters, over the input limit'); return done(res); }
    let s = input;
    if (s.charCodeAt(0) === 0xFEFF) { s = s.slice(1); warn(res, null, 'byte order mark removed'); }
    s = stripControls(res, s, 'file');
    const parsed = csvRows(s);
    if (parsed.error) { fail(res, 'CSV: ' + parsed.error + '; fix the file and send it again'); return done(res); }
    const rows = parsed.rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
    if (!rows.length) { fail(res, 'empty CSV'); return done(res); }
    if (rows.length - 1 > lim.maxRows) { fail(res, 'CSV has ' + (rows.length - 1) + ' data rows, over the row limit'); return done(res); }
    const header = rows[0].map(normHeader);
    const idx = new Map();
    header.forEach((h, j) => { if (idx.has(h)) warn(res, null, 'duplicate column "' + clip(h, 30) + '" ignored'); else idx.set(h, j); });
    const col = resolveColumns(res, idx, opts && opts.mapping);
    if (col.text < 0) { fail(res, 'no report text column (expected one of: ' + ALIASES.text.join(', ') + ')'); return done(res); }
    const badRows = [];
    const seenIds = new Set();
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r], where = 'row ' + (r + 1);
      if (row.length !== header.length) { badRows.push(where + ' (' + row.length + ' fields, header has ' + header.length + ')'); continue; }
      const get = k => (col[k] >= 0 ? row[col[k]] : '');
      const text = cleanText(res, get('text'), where);
      if (!text.trim()) { badRows.push(where + ' (no report text)'); continue; }
      if (!checkLength(res, text, lim, where)) continue;
      const date = get('date').trim() ? isoFromDateTime(get('date').trim()) : null;
      if (get('date').trim() && !date) warn(res, null, where + ': date "' + clip(get('date').trim(), 12) + '" is not YYYY-MM-DD, left empty');
      const age = parseAge(get('age'), res, where);
      const sex = parseSex(get('sex'), res, where);
      let id = cleanId(get('id')) || ('CSV-' + (r + 1));
      if (seenIds.has(id)) { badRows.push(where + ' (duplicate report id "' + id + '")'); continue; }
      seenIds.add(id);
      const rep = makeReport({ id, patient_id: cleanPatientId(get('patient_id')), age, sex, mod: cleanText(res, get('mod'), where), ind: cleanText(res, get('ind'), where), text, date });
      checkDemographics(res, rep, where);
      res.reports.push(rep);
    }
    if (badRows.length) {
      fail(res, 'CSV rows cannot be read: ' + badRows.slice(0, 20).join('; ') + (badRows.length > 20 ? '; and ' + (badRows.length - 20) + ' more' : '') + '. Nothing was imported.');
    }
    return done(res);
  }

  /* ---------- paste (plain text) ---------- */
  function parsePasteImpl(input, opts) {
    const res = newResult();
    const lim = limitsOf(opts && opts.profile);
    if (typeof input !== 'string') { fail(res, 'paste input must be text'); return done(res); }
    if (input.length > lim.maxInputChars) { fail(res, 'input is ' + input.length + ' characters, over the input limit'); return done(res); }
    const s = cleanText(res, input, 'paste');
    const lines = s.split(/\r\n|\r|\n/);
    const meta = Object.create(null);
    let i = 0;
    while (i < lines.length && i < 8) {
      const line = lines[i];
      if (line.length > 300) break;
      const m = /^\s*([A-Za-z]{2,12})\s*:\s*(.*?)\s*$/.exec(line);
      if (!m || !Object.prototype.hasOwnProperty.call(PASTE_KEYS, m[1].toLowerCase())) break;
      const key = PASTE_KEYS[m[1].toLowerCase()];
      if (!(key in meta)) meta[key] = m[2];
      i++;
    }
    if (i > 0 && i < lines.length && lines[i].trim() === '') i++;
    const body = lines.slice(i).join('\n').trim();
    if (!body) { fail(res, 'no report text after the header lines'); return done(res); }
    if (!checkLength(res, body, lim, 'paste')) return done(res);
    const given = isObj(opts && opts.meta) ? opts.meta : {};
    const pick = k => {
      const v = given[k];
      if (v !== undefined && v !== null && String(v) !== '') return String(v);
      return meta[k] !== undefined ? meta[k] : '';
    };
    const dateRaw = pick('date').trim();
    const date = dateRaw ? isoFromDateTime(dateRaw) : null;
    if (dateRaw && !date) warn(res, null, 'paste: date "' + clip(dateRaw, 12) + '" is not YYYY-MM-DD, left empty');
    const age = parseAge(pick('age'), res, 'paste');
    const sex = parseSex(pick('sex'), res, 'paste');
    const id = cleanId(pick('id')) || ('PASTE-' + fnv(body));
    const rep = makeReport({ id, patient_id: cleanPatientId(pick('patient_id')), age, sex, mod: pick('mod').trim(), ind: pick('ind').trim(), text: body, date });
    checkDemographics(res, rep, 'paste');
    res.reports.push(rep);
    return done(res);
  }

  /* ---------- public API ---------- */
  function safe(fn) {
    return function (input, opts) {
      try { return fn(input, opts || {}); }
      catch (e) { const r = newResult(); fail(r, 'internal error while reading input'); return done(r); }
    };
  }
  const parseHl7 = safe(parseHl7Impl);
  const parseFhir = safe(parseFhirImpl);
  const parseCsv = safe(parseCsvImpl);
  const parsePaste = safe(parsePasteImpl);
  const ROUTES = { hl7v2: parseHl7, fhir: parseFhir, csv: parseCsv, paste: parsePaste };

  /* ingest(route, input, {profile, mapping, meta}): profile.feeds must enable the route. Never throws. */
  function ingest(route, input, opts) {
    const o = isObj(opts) ? opts : {};
    if (typeof route !== 'string' || !Object.prototype.hasOwnProperty.call(ROUTES, route)) {
      const r = newResult(); fail(r, 'unknown input route'); return done(r);
    }
    const prof = o.profile;
    if (prof !== undefined && prof !== null && !(isObj(prof.feeds) && prof.feeds[route] === true)) {
      const r = newResult(); fail(r, 'route "' + route + '" is not enabled for this site profile'); return done(r);
    }
    return ROUTES[route](input, o);
  }

  /* toFinderInput(report): the fields the finder and its AI prompt use. patient_id and date are left out. */
  function toFinderInput(report) {
    if (!isObj(report) || typeof report.text !== 'string') return null;
    return {
      id: typeof report.id === 'string' ? report.id : '',
      age: Number.isInteger(report.age) ? report.age : null,
      sex: report.sex === 'M' || report.sex === 'F' ? report.sex : null,
      mod: typeof report.mod === 'string' ? report.mod : '',
      ind: typeof report.ind === 'string' ? report.ind : '',
      text: report.text
    };
  }

  const api = { ingest, parseHl7, parseFhir, parseCsv, parsePaste, toFinderInput, DEFAULTS: Object.assign({}, DEFAULTS), ROUTES: Object.keys(ROUTES) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OsteoIngest = api;
})(typeof window !== 'undefined' ? window : globalThis);
