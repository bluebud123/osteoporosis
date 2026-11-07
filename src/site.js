/*
 * OsteoLoop site profiles: the per-hospital settings the thin adapter layer reads. A profile says which guideline
 * a site uses, its languages, stage clocks and owner roles, its formulary, which input routes are enabled, where
 * report text may go (data residency), the indicator window and the limits.
 *
 * A profile can never switch off the safety controls. `controls` must contain verifier, humanReview and
 * closureGate, each true. validate() rejects anything else, and merge() never takes a control value from overrides.
 *
 * The shipped profiles are templates. They name guidelines, not hospitals, and they contain no real hospital
 * interface details. Nothing here has been adopted at a named site.
 *
 * Works in the browser (window.OsteoSite) and in Node (module.exports). No network calls.
 */
(function (root) {
  'use strict';

  const STAGE_KEYS = ['0', '1', '2', '3', '4', '5', '6'];
  const CLOCK_KEYS = STAGE_KEYS.concat(['confirmUrgent']);
  const LANGS = ['en', 'ms', 'ar'];
  const FEEDS = ['hl7v2', 'fhir', 'csv', 'paste'];
  const MODES = ['local-only', 'deidentified-external', 'external-allowed'];
  const READERS = ['keyword', 'claude-sample', 'openai-compatible'];
  const CONTROLS = ['verifier', 'humanReview', 'closureGate'];
  const TOP_KEYS = ['id', 'name', 'description', 'country', 'guideline', 'languages', 'optionalLanguages', 'stageClocks',
    'roles', 'formulary', 'feeds', 'dataResidency', 'indicatorWindowMonths', 'limits', 'controls'];
  const REQUIRED = ['id', 'name', 'country', 'guideline', 'languages', 'stageClocks', 'roles', 'formulary', 'feeds',
    'dataResidency', 'indicatorWindowMonths', 'controls'];
  const GUIDELINE_KEYS = ['primary', 'secondary', 'status', 'interim', 'warning', 'signOff'];
  const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];
  const PROFILE_ID = /^[a-z][a-z0-9-]{1,39}$/;
  const DRUG_ID = /^[a-z][a-z0-9-]{1,60}$/;
  const LIMIT_DEFAULTS = { maxInputChars: 2000000, maxReportChars: 50000, maxRows: 2000 };
  const LIMIT_CAPS = { maxInputChars: 5000000, maxReportChars: 200000, maxRows: 10000 };
  // Repo defaults: app stage clocks (index.html STAGES) and owner roles. confirmUrgent is the app's 42-day confirm clock for urgent cases.
  const DEFAULT_CLOCKS = { '0': 0, '1': 7, '2': 30, '3': 7, '4': 14, '5': 90, '6': 30, confirmUrgent: 42 };
  const DEFAULT_ROLES = { '0': 'Screening clinic', '1': 'GP', '2': 'GP, imaging, lab', '3': 'GP, then specialist',
    '4': 'Prescriber', '5': 'GP', '6': 'GP or programme lead' };
  const DEFAULT_FEEDS = { hl7v2: false, fhir: false, csv: true, paste: true };
  const DEFAULT_RESIDENCY = { mode: 'local-only', reader: 'keyword' };
  const DEFAULT_CONTROLS = { verifier: true, humanReview: true, closureGate: true };

  /* ---------- small helpers ---------- */
  function isPlain(v) {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
    const p = Object.getPrototypeOf(v);
    return p === Object.prototype || p === null;
  }
  function nonEmptyStr(v, max) { return typeof v === 'string' && v.trim() !== '' && v.length <= max; }
  function clone(v) {
    if (Array.isArray(v)) return v.map(clone);
    if (isPlain(v)) {
      const o = {};
      for (const k of Object.keys(v)) if (!FORBIDDEN_KEYS.includes(k)) o[k] = clone(v[k]);
      return o;
    }
    return v;
  }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function scanForbidden(v, path, P, depth) {
    if (depth > 12 || v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach((x, i) => scanForbidden(x, path + '[' + i + ']', P, depth + 1)); return; }
    for (const k of Object.keys(v)) {
      if (FORBIDDEN_KEYS.includes(k)) P.push('forbidden key "' + k + '" at ' + (path || 'top level'));
      scanForbidden(v[k], path ? path + '.' + k : k, P, depth + 1);
    }
  }
  function unknownKeys(o, allowed, label, P) {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) P.push(label + ' has unknown field "' + k + '"');
  }

  /* ---------- checks (each pushes problem strings) ---------- */
  function checkGuideline(g, P) {
    if (!isPlain(g)) { P.push('guideline must be an object'); return; }
    unknownKeys(g, GUIDELINE_KEYS, 'guideline', P);
    if (!nonEmptyStr(g.primary, 200)) P.push('guideline.primary must be a non-empty string');
    if (!(g.secondary === null || nonEmptyStr(g.secondary, 200))) P.push('guideline.secondary must be a string or null');
    if (!['draft', 'confirmed'].includes(g.status)) P.push('guideline.status must be "draft" or "confirmed"');
    if (typeof g.interim !== 'boolean') P.push('guideline.interim must be true or false');
    if (g.warning !== undefined && g.warning !== null && typeof g.warning !== 'string') P.push('guideline.warning must be a string or null');
    if (g.signOff !== undefined && g.signOff !== null && typeof g.signOff !== 'string') P.push('guideline.signOff must be a string or null');
    const hasWarn = typeof g.warning === 'string' && g.warning.trim() !== '';
    if (g.interim === true && !hasWarn) P.push('guideline.interim is true, so guideline.warning must say what is not confirmed');
    if (g.status === 'confirmed' && !nonEmptyStr(g.signOff, 200)) P.push('guideline.status "confirmed" needs guideline.signOff (who signed off, and when)');
    if (g.status === 'confirmed' && g.interim === true) P.push('an interim guideline cannot be confirmed');
  }
  function checkLanguages(p, P) {
    const L = p.languages;
    if (!Array.isArray(L) || L.length === 0) P.push('languages must be a non-empty list');
    else {
      const seen = new Set();
      for (const l of L) {
        if (!LANGS.includes(l)) P.push('language "' + String(l).slice(0, 10) + '" is not supported (en, ms, ar)');
        if (seen.has(l)) P.push('language "' + String(l) + '" is listed twice');
        seen.add(l);
      }
    }
    if (p.optionalLanguages !== undefined) {
      if (!Array.isArray(p.optionalLanguages)) P.push('optionalLanguages must be a list');
      else for (const l of p.optionalLanguages) if (!(Array.isArray(L) && L.includes(l))) P.push('optional language "' + String(l).slice(0, 10) + '" is not in languages');
    }
  }
  function checkClocks(c, P) {
    if (!isPlain(c)) { P.push('stageClocks must be an object'); return; }
    unknownKeys(c, CLOCK_KEYS, 'stageClocks', P);
    for (const k of CLOCK_KEYS) {
      if (!(Number.isInteger(c[k]) && c[k] >= 0 && c[k] <= 365)) P.push('stageClocks.' + k + ' must be a whole number of days from 0 to 365');
    }
  }
  function checkRoles(r, P) {
    if (!isPlain(r)) { P.push('roles must be an object'); return; }
    unknownKeys(r, STAGE_KEYS, 'roles', P);
    for (const k of STAGE_KEYS) if (!nonEmptyStr(r[k], 80)) P.push('roles.' + k + ' must be a non-empty owner role (up to 80 characters)');
  }
  function checkDrugList(list, name, P) {
    if (!Array.isArray(list)) { P.push('formulary.' + name + ' must be a list of drug ids'); return; }
    const seen = new Set();
    for (const d of list) {
      if (!(typeof d === 'string' && DRUG_ID.test(d))) P.push('formulary.' + name + ' has an invalid drug id "' + String(d).slice(0, 20) + '"');
      if (seen.has(d)) P.push('formulary.' + name + ' lists "' + String(d) + '" twice');
      seen.add(d);
    }
  }
  function checkFormulary(f, P) {
    if (!isPlain(f)) { P.push('formulary must be an object'); return; }
    unknownKeys(f, ['placeholder', 'available', 'blocked'], 'formulary', P);
    if (typeof f.placeholder !== 'boolean') P.push('formulary.placeholder must be true or false');
    checkDrugList(f.available, 'available', P);
    checkDrugList(f.blocked, 'blocked', P);
    if (Array.isArray(f.available) && Array.isArray(f.blocked)) {
      for (const d of f.available) if (f.blocked.includes(d)) P.push('drug "' + d + '" is both available and blocked');
    }
    if (f.placeholder === true && Array.isArray(f.available) && f.available.length) P.push('a placeholder formulary cannot list available drugs');
  }
  function checkFeeds(f, P) {
    if (!isPlain(f)) { P.push('feeds must be an object'); return; }
    unknownKeys(f, FEEDS, 'feeds', P);
    for (const k of FEEDS) if (typeof f[k] !== 'boolean') P.push('feeds.' + k + ' must be true or false');
    if (!FEEDS.some(k => f[k] === true)) P.push('no input route is enabled (feeds)');
  }
  function checkResidency(d, P) {
    if (!isPlain(d)) { P.push('dataResidency must be an object'); return; }
    unknownKeys(d, ['mode', 'reader'], 'dataResidency', P);
    if (!MODES.includes(d.mode)) P.push('dataResidency.mode must be one of ' + MODES.join(', '));
    if (!READERS.includes(d.reader)) P.push('dataResidency.reader must be one of ' + READERS.join(', '));
    if (d.mode === 'local-only' && d.reader !== 'keyword') {
      P.push('local-only residency allows only the keyword reader: "' + String(d.reader) + '" would send report text outside the site');
    }
  }
  function checkLimits(l, P) {
    if (!isPlain(l)) { P.push('limits must be an object'); return; }
    unknownKeys(l, Object.keys(LIMIT_DEFAULTS), 'limits', P);
    for (const k of Object.keys(LIMIT_DEFAULTS)) {
      if (l[k] !== undefined && !(Number.isInteger(l[k]) && l[k] >= 1 && l[k] <= LIMIT_CAPS[k])) {
        P.push('limits.' + k + ' must be a whole number from 1 to ' + LIMIT_CAPS[k]);
      }
    }
  }
  function checkControls(c, P) {
    if (!isPlain(c)) { P.push('controls must be an object with verifier, humanReview and closureGate'); return; }
    unknownKeys(c, CONTROLS, 'controls', P);
    for (const k of CONTROLS) if (c[k] !== true) P.push(k + ' cannot be turned off by a site profile (controls.' + k + ' must be true)');
  }

  /* validate(profile): returns a list of problems. An empty list means the profile is valid. */
  function validate(p) {
    const P = [];
    if (!isPlain(p)) return ['profile must be a plain object'];
    scanForbidden(p, '', P, 0);
    unknownKeys(p, TOP_KEYS, 'profile', P);
    for (const k of REQUIRED) if (!has(p, k)) P.push('missing field "' + k + '"');
    if (!(typeof p.id === 'string' && PROFILE_ID.test(p.id))) P.push('id must be 2 to 40 lower-case letters, digits or hyphens, starting with a letter');
    if (!nonEmptyStr(p.name, 120)) P.push('name must be a non-empty string up to 120 characters');
    if (p.description !== undefined && !(typeof p.description === 'string' && p.description.length <= 500)) P.push('description must be a string up to 500 characters');
    if (!(typeof p.country === 'string' && /^[A-Z]{2}$/.test(p.country))) P.push('country must be a two-letter upper-case code');
    checkGuideline(p.guideline, P);
    checkLanguages(p, P);
    checkClocks(p.stageClocks, P);
    checkRoles(p.roles, P);
    checkFormulary(p.formulary, P);
    checkFeeds(p.feeds, P);
    checkResidency(p.dataResidency, P);
    if (!(Number.isInteger(p.indicatorWindowMonths) && p.indicatorWindowMonths >= 1 && p.indicatorWindowMonths <= 24)) {
      P.push('indicatorWindowMonths must be a whole number from 1 to 24');
    }
    if (p.limits !== undefined) checkLimits(p.limits, P);
    checkControls(p.controls, P);
    return P;
  }

  /* merge(base, overrides): per-hospital overrides on top of a profile. Returns {ok, profile, problems}.
     profile is null unless ok. Controls are always locked to true: an override that tries to turn one off is a problem. */
  function applyOverrides(target, src, path, problems, depth) {
    if (depth > 12) { problems.push('override nested too deeply at ' + path); return; }
    for (const k of Object.keys(src)) {
      const where = path ? path + '.' + k : k;
      if (FORBIDDEN_KEYS.includes(k)) { problems.push('override uses forbidden key "' + where + '"'); continue; }
      if (path === '' && k === 'controls') {
        if (!isPlain(src.controls)) { problems.push('override controls must be an object'); continue; }
        for (const c of Object.keys(src.controls)) {
          if (!CONTROLS.includes(c)) problems.push('override has unknown control "' + c + '"');
          else if (src.controls[c] !== true) problems.push('override cannot turn off ' + c);
        }
        continue;
      }
      if (isPlain(src[k]) && isPlain(target[k])) applyOverrides(target[k], src[k], where, problems, depth + 1);
      else target[k] = clone(src[k]);
    }
  }
  function merge(baseProfile, overrides) {
    if (!isPlain(baseProfile)) return { ok: false, profile: null, problems: ['base profile must be a plain object'] };
    if (!isPlain(overrides)) return { ok: false, profile: null, problems: ['overrides must be a plain object'] };
    const problems = validate(baseProfile).map(x => 'base: ' + x);
    const out = clone(baseProfile);
    applyOverrides(out, overrides, '', problems, 0);
    out.controls = clone(DEFAULT_CONTROLS);
    const all = problems.concat(validate(out));
    const uniq = all.filter((x, i) => all.indexOf(x) === i);
    return { ok: uniq.length === 0, profile: uniq.length === 0 ? out : null, problems: uniq };
  }

  /* ---------- shipped templates ---------- */
  function template(extra) {
    return Object.assign({
      description: undefined,
      stageClocks: clone(DEFAULT_CLOCKS),
      roles: clone(DEFAULT_ROLES),
      formulary: { placeholder: true, available: [], blocked: [] },
      feeds: clone(DEFAULT_FEEDS),
      dataResidency: clone(DEFAULT_RESIDENCY),
      indicatorWindowMonths: 6,
      limits: clone(LIMIT_DEFAULTS),
      controls: clone(DEFAULT_CONTROLS)
    }, extra);
  }
  const SHIPPED = {};
  [
    template({
      id: 'my-moh',
      name: 'Malaysian MOH hospital (template)',
      country: 'MY',
      description: 'Ministry of Health Malaysia hospital. Guideline: Malaysian CPG on Postmenopausal Osteoporosis (2022). Not adopted at a named site.',
      guideline: {
        primary: 'Malaysian CPG: Postmenopausal Osteoporosis (2022)',
        secondary: 'NICE NG259 (2026), DXA indications',
        status: 'draft', interim: false, warning: null, signOff: null
      },
      languages: ['en', 'ms', 'ar'],
      optionalLanguages: ['ar']
    }),
    template({
      id: 'uae-doh',
      name: 'Abu Dhabi hospital, DoH context (template)',
      country: 'AE',
      description: 'Abu Dhabi, Department of Health context. No UAE guideline is loaded: the Malaysian CPG stands in as an interim source.',
      guideline: {
        primary: 'Malaysian CPG: Postmenopausal Osteoporosis (2022), INTERIM stand-in',
        secondary: 'NICE NG259 (2026), DXA indications',
        status: 'draft', interim: true,
        warning: 'INTERIM: no UAE or regional osteoporosis guideline is confirmed for this profile. The Malaysian CPG is used only as a stand-in. The clinical lead must confirm or replace the guideline and sign it off before any patient use.',
        signOff: null
      },
      languages: ['ar', 'en'],
      optionalLanguages: []
    }),
    template({
      id: 'generic',
      name: 'Generic template (no site)',
      country: 'XX',
      description: 'Blank template for a site not yet set up.',
      guideline: {
        primary: 'None selected',
        secondary: null,
        status: 'draft', interim: true,
        warning: 'No guideline is selected for this profile. Do not use for patient care until the clinical lead selects and signs off a guideline.',
        signOff: null
      },
      languages: ['en'],
      optionalLanguages: []
    })
  ].forEach(p => { SHIPPED[p.id] = p; });

  function getProfile(id) {
    if (typeof id !== 'string' || !has(SHIPPED, id)) return null;
    return clone(SHIPPED[id]);
  }
  function listProfiles() { return Object.keys(SHIPPED); }
  /* resolve('my-moh', overrides): shipped profile plus overrides, through merge(). */
  function resolve(id, overrides) {
    const base = getProfile(id);
    if (!base) return { ok: false, profile: null, problems: ['unknown profile "' + String(id).slice(0, 40) + '"'] };
    return merge(base, overrides || {});
  }

  const api = {
    validate, merge, resolve, getProfile, listProfiles,
    STAGE_KEYS: STAGE_KEYS.slice(), CONTROLS: CONTROLS.slice(), FEEDS: FEEDS.slice(), MODES: MODES.slice(), READERS: READERS.slice(),
    DEFAULTS: { stageClocks: clone(DEFAULT_CLOCKS), roles: clone(DEFAULT_ROLES), feeds: clone(DEFAULT_FEEDS), dataResidency: clone(DEFAULT_RESIDENCY), limits: clone(LIMIT_DEFAULTS), controls: clone(DEFAULT_CONTROLS), indicatorWindowMonths: 6 }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OsteoSite = api;
})(typeof window !== 'undefined' ? window : globalThis);
