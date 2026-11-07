/*
 * OsteoLoop FHIR export: builds one case as a FHIR R4 Bundle (type collection) for download.
 * Input is the app's plain case object plus a small options object (day, stages, clock, patient view,
 * check-in items, radiology report). Nothing here reads the DOM, so it runs in the browser
 * (window.OsteoFhir) and in Node (module.exports), and the benchmark feeds it fixtures.
 *
 * Every resource carries meta.tag SYNTHETIC. Identifiers use the SYN- prefix. Bundle entries use
 * urn:uuid fullUrls derived deterministically from type and id, and every internal reference points
 * at one of them. Codes are plain local codes in the urn:osteoloop:local system: real terminologies
 * (SNOMED CT, LOINC, RxNorm, the UAE drug code list) are NOT yet mapped and no code numbers are invented.
 * Only the HL7 code systems that R4 status and category fields require are used.
 *
 * Not validated against the official HL7 validator. See bench/run-fhir.js for what is checked.
 */
(function (root) {
  'use strict';

  const TAG = { system: 'urn:osteoloop:data-origin', code: 'SYNTHETIC', display: 'Synthetic data: fictional patient, not real' };
  // Plain local codes. TODO: map to SNOMED CT (conditions, procedures), LOINC (labs, DXA), RxNorm or UAE drug codes.
  const LOCAL = 'urn:osteoloop:local';
  const HL7 = {
    condClin: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
    condVer: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
    condCat: 'http://terminology.hl7.org/CodeSystem/condition-category',
    obsCat: 'http://terminology.hl7.org/CodeSystem/observation-category',
    diagCat: 'http://terminology.hl7.org/CodeSystem/v2-0074',
    bcp47: 'urn:ietf:bcp:47',
    ucum: 'http://unitsofmeasure.org'
  };
  const DEFAULT_STAGES = [
    { t: 'Screen', role: 'Screening clinic', clock: 0 },
    { t: 'Notify and acknowledge', role: 'GP', clock: 7 },
    { t: 'Confirm: DXA and labs', role: 'GP, imaging, lab', clock: 30 },
    { t: 'Decide or refer', role: 'GP, then specialist', clock: 7 },
    { t: 'Treat: prescribe and dispense', role: 'Prescriber', clock: 14 },
    { t: 'Follow up', role: 'GP', clock: 90 },
    { t: 'Close', role: 'GP or programme lead', clock: 30 }
  ];
  const SITE = {
    hip: ['Hip fracture', 'fx-hip'], wrist: ['Distal radius (wrist) fracture', 'fx-wrist'],
    humerus: ['Proximal humerus fracture', 'fx-humerus'], pelvis: ['Pelvic or sacral fracture', 'fx-pelvis'],
    vert: ['Vertebral fracture', 'fx-vert'], other: ['Other fragility fracture', 'fx-other']
  };
  /* A fracture whose site was never recorded is not coded as any site (B6). */
  const SITE_UNKNOWN = ['Fragility fracture (site not recorded)', 'fx-site-unknown'];

  /* ---------- small helpers ---------- */
  const pad = n => String(n).padStart(2, '0');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = v => (v === null || v === undefined || String(v).trim() === '' || Number.isNaN(+v)) ? null : +v;
  const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function dateOf(anchor, day) {
    if (day === null || day === undefined || Number.isNaN(+day)) return undefined;
    const [y, m, d] = anchor.split('-').map(Number);
    const x = new Date(Date.UTC(y, m - 1, d) + Math.round(+day) * 864e5);
    return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate());
  }
  function todayUTC() { return new Date().toISOString().slice(0, 10); }

  // Deterministic, uuid-shaped internal id (not random, not a real identifier).
  function hex16(s, seed) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  }
  function uuidFor(key) {
    const h = hex16(key, 1) + hex16(key, 7);
    const variant = '89ab'[parseInt(h[16], 16) % 4];
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
  }
  const fullUrl = (type, id) => 'urn:uuid:' + uuidFor(type + '/' + id);
  const ref = (type, id) => ({ reference: fullUrl(type, id) });
  const narrative = text => ({ status: 'generated', div: '<div xmlns="http://www.w3.org/1999/xhtml">' + esc(text) + '</div>' });
  const tagged = (r) => Object.assign(r, { meta: { tag: [TAG] } });

  /* Fractures as the app's patient view has them (mirrors toPatient in index.html). Used if no view is passed. */
  function fracturesOf(c) {
    if (c.pt && Array.isArray(c.pt.fractures)) return c.pt.fractures.map(f => ({ site: f.site, months: f.months, onGc: !!f.onGc }));
    const k = c.clin || {}, s = k.sites || [], out = [];
    const months = k.fxMonths === undefined ? null : k.fxMonths;
    if (months !== null || k.hipVert) out.push({ site: s[0] || null, months, onGc: !!k.fxOnGc });
    if (k.multiFx) out.push({ site: s[1] || null, months, onGc: !!k.fxOnGc });
    return out;
  }

  /* ---------- the bundle ---------- */
  /*
   * c: case object (id, name, age, sex, lang, owner, urgent, clin, res, pt, stages[7] {start,end},
   *    closed, rx, denoDue, checkins[], referral, ordered, source).
   * opts: anchor ('YYYY-MM-DD' for day 0; default today UTC), day (current app day, for overdue flags),
   *    stages ([{t, role, clock}]), clockFor(c, i) (app clock per stage), patient (app patient view with
   *    fractures, t, vd, egfr, ca, spep, mof, hip), category ({name, why}) for the Patient extension,
   *    checkin(k) -> [{linkId, text, value}], report ({id, mod, text, evidence: [], decision}) for the
   *    radiology report of a finder case.
   */
  function bundle(c, opts) {
    opts = opts || {};
    const anchor = opts.anchor || todayUTC();
    const day = opts.day == null ? 0 : opts.day;
    const stages = opts.stages || DEFAULT_STAGES;
    const clockFor = opts.clockFor || ((cc, i) => stages[i].clock);
    const cid = String(c.id);
    const pid = 'pt-' + cid, cpid = 'cp-' + cid;
    const P = opts.patient || {
      fractures: fracturesOf(c), t: num((c.res || {}).t ?? (c.pt || {}).t), vd: num((c.res || {}).vd),
      egfr: num((c.res || {}).egfr), ca: num((c.res || {}).ca), spep: (c.res || {}).spep || null,
      mof: num((c.clin || {}).mof), hip: num((c.clin || {}).hip)
    };
    const out = [];
    const sub = { reference: fullUrl('Patient', pid) };

    /* Practitioners: one per named clinician, only if referenced. */
    const pract = {};
    const practRef = name => {
      if (!name) return undefined;
      const id = 'pr-' + slug(name);
      if (!pract[id]) pract[id] = tagged({ resourceType: 'Practitioner', id, active: true, name: [{ text: name }] });
      return ref('Practitioner', id);
    };

    /* Patient */
    const sex = c.sex === 'M' ? 'male' : c.sex === 'F' || !c.sex ? 'female' : 'unknown';
    const patient = tagged({
      resourceType: 'Patient', id: pid, active: !c.closed,
      identifier: [{ system: 'urn:osteoloop:case', value: 'SYN-' + cid }],
      name: [{ text: c.name }], gender: sex,
      communication: [{ language: { coding: [{ system: HL7.bcp47, code: c.lang === 'ar' ? 'ar' : 'en' }] }, preferred: true }],
      extension: [].concat(
        typeof c.age === 'number' ? [{ url: 'urn:osteoloop:age-years', valueInteger: c.age }] : [],
        opts.category ? [{ url: 'urn:osteoloop:risk-category', valueString: opts.category.name + ' (app rule output, MYCPG 2022; not a FHIR code)' }] : []
      )
    });
    out.push(patient);

    /* DiagnosticReport: the radiology report text, with the quoted evidence as a note. */
    const rep = opts.report;
    const evidenceText = rep && rep.evidence && rep.evidence.length ? rep.evidence.map(e => '"' + e + '"').join(' ') : null;
    const dr = rep
      ? { resourceType: 'DiagnosticReport', id: 'dr-' + cid, status: 'final', identifier: [{ system: LOCAL, value: 'SYN-' + rep.id }],
          category: [{ coding: [{ system: HL7.diagCat, code: 'RAD' }] }],
          code: { text: rep.mod || 'Radiology report', coding: [{ system: LOCAL, code: 'radiology-report' }] },
          subject: sub, conclusion: rep.text || '', text: narrative(rep.text || ''),
          note: [{ text: 'Quoted evidence (' + (rep.decision || 'finder') + '): ' + (evidenceText || 'none quoted') }] }
      : { resourceType: 'DiagnosticReport', id: 'dr-' + cid, status: 'unknown',
          category: [{ coding: [{ system: HL7.diagCat, code: 'RAD' }] }],
          code: { text: 'Screening note (no radiology report text on file)', coding: [{ system: LOCAL, code: 'screening-note' }] },
          subject: sub, conclusion: 'No radiology report on file for this case. Fracture history as recorded at screening.',
          text: narrative(c.clin ? c.clin.note || '' : ''), note: [{ text: c.clin ? c.clin.note || '' : '' }] };
    out.push(tagged(dr));

    /* Condition: one per fracture, with the evidence. */
    const conds = [];
    (P.fractures || []).forEach((f, j) => {
      const known = !!SITE[f.site];
      const [label, lcode] = known ? SITE[f.site] : SITE_UNKNOWN;
      const m = num(f.months);
      const acute = m === 0;
      const onset = m === null ? 'Date unknown: confirm before treating as very high risk'
        : acute ? 'Recent or acute, per report or indication'
        : m + ' months before ' + anchor + ' (approximate)';
      const notes = [];
      if (evidenceText) notes.push({ text: 'Quoted evidence: ' + evidenceText });
      if (c.clin && c.clin.note) notes.push({ text: 'History: ' + c.clin.note });
      const cond = tagged({
        resourceType: 'Condition', id: 'cond-' + cid + '-' + j,
        clinicalStatus: { coding: [{ system: HL7.condClin, code: 'active' }] },
        verificationStatus: { coding: [{ system: HL7.condVer, code: m === null || !known ? 'unconfirmed' : 'confirmed' }] },
        category: [{ coding: [{ system: HL7.condCat, code: 'problem-list-item' }] }],
        code: { text: label, coding: [{ system: LOCAL, code: lcode }] },
        subject: sub, onsetString: onset, recordedDate: dateOf(anchor, 0),
        note: notes.length ? notes : undefined
      });
      if (f.onGc) cond.note = (cond.note || []).concat([{ text: 'Occurred on glucocorticoids' }]);
      conds.push(cond);
    });
    conds.forEach(x => out.push(x));
    const condRefs = conds.map(x => ref('Condition', x.id));

    /* Tasks: one per loop stage, owner, due date (start + clock) and status. */
    const ownerRef = c.owner ? practRef(c.owner) : undefined;
    const cpRef = ref('CarePlan', cpid);
    const taskIds = [];
    stages.forEach((s, i) => {
      const st = (c.stages && c.stages[i]) || { start: null, end: null };
      const started = st.start !== null && st.start !== undefined;
      const done = st.end !== null && st.end !== undefined;
      const clock = clockFor(c, i);
      const due = started && clock !== undefined ? st.start + clock : null;
      let status;
      if (done) status = 'completed';
      else if (c.closed) status = 'cancelled';
      else if (started) status = 'in-progress';
      else status = 'draft';
      const overdue = (started && !done && due !== null && day > due) || (done && due !== null && st.end > due);
      const id = 'task-' + cid + '-' + i;
      taskIds.push(id);
      const task = tagged({
        resourceType: 'Task', id, basedOn: [cpRef], status, intent: 'order',
        description: s.t,
        code: { text: s.t, coding: [{ system: LOCAL, code: 'loop-stage-' + i }] },
        for: sub,
        note: [{ text: 'Role: ' + (s.role || '') + (i === 0 ? '. Screening clinic, no case owner.' : '') }],
        extension: [{ url: 'urn:osteoloop:stage-overdue', valueBoolean: !!overdue }]
      });
      if (i > 0 && ownerRef) task.owner = ownerRef;
      const period = {};
      if (started) period.start = dateOf(anchor, st.start);
      if (done) period.end = dateOf(anchor, st.end);
      if (Object.keys(period).length) task.executionPeriod = period;
      if (due !== null) task.restriction = { period: { end: dateOf(anchor, due) } };
      out.push(task);
    });

    /* ServiceRequest: DXA, and the specialist referral when there is one. */
    const dxaStatus = (c.stages && c.stages[2] && c.stages[2].end != null) ? 'completed'
      : c.ordered ? 'active' : c.closed ? 'revoked' : 'draft';
    const dxa = tagged({
      resourceType: 'ServiceRequest', id: 'sr-dxa-' + cid, status: dxaStatus, intent: c.ordered ? 'order' : 'proposal',
      priority: c.urgent ? 'urgent' : 'routine',
      code: { text: 'DXA bone density scan (hip and spine)', coding: [{ system: LOCAL, code: 'dxa-scan' }] },
      subject: sub, requester: ownerRef,
      note: c.urgent ? [{ text: 'Fast-track DXA (LOCAL rule, 6 weeks when anabolic treatment is likely)' }] : undefined
    });
    out.push(dxa);
    const dxaRef = ref('ServiceRequest', dxa.id);

    if (c.referral && c.referral.status && c.referral.status !== 'none') {
      const rs = c.referral.status;
      const sr = tagged({
        resourceType: 'ServiceRequest', id: 'sr-referral-' + cid,
        status: rs === 'rejected' ? 'revoked' : (rs === 'sent' || rs === 'rerouted') ? 'active' : 'unknown',
        intent: 'order', priority: c.urgent ? 'urgent' : 'routine',
        code: { text: 'Specialist referral: ' + (c.referral.clinic || 'fracture liaison clinic'), coding: [{ system: LOCAL, code: 'specialist-referral' }] },
        subject: sub, requester: ownerRef,
        note: [{ text: 'Referral status: ' + rs + (c.referral.reason ? '. Reason: ' + c.referral.reason : '') }]
      });
      out.push(sr);
    }

    /* Observations: DXA T-score, labs, SPEP. Values as recorded; no date is invented (undefined if not recorded). */
    const obs = (id, cat, code, text, value, unit) => {
      const o = tagged({ resourceType: 'Observation', id: id + '-' + cid, status: 'final',
        category: [{ coding: [{ system: HL7.obsCat, code: cat }] }],
        code: { text, coding: [{ system: LOCAL, code }] }, subject: sub });
      if (value !== null) o.valueQuantity = unit ? { value, unit, system: HL7.ucum } : { value };
      return o;
    };
    if (P.t !== null && P.t !== undefined && num(P.t) !== null) {
      const o = obs('obs-dxa-t', 'imaging', 'dxa-t-score', 'DXA T-score (lowest of hip or spine)', num(P.t), 'SD');
      o.basedOn = [dxaRef]; delete o.valueQuantity.system; out.push(o);
    }
    if (num(P.vd) !== null) out.push(obs('obs-vitd', 'laboratory', 'vitamin-d-25oh', 'Vitamin D (25-OH)', num(P.vd), 'nmol/L'));
    if (num(P.egfr) !== null) out.push(obs('obs-egfr', 'laboratory', 'egfr', 'eGFR', num(P.egfr), 'mL/min/{1.73_m2}'));
    if (num(P.ca) !== null) out.push(obs('obs-calcium', 'laboratory', 'serum-calcium', 'Serum calcium', num(P.ca), 'mmol/L'));
    if (P.spep === 'normal' || P.spep === 'abnormal') {
      const o = tagged({ resourceType: 'Observation', id: 'obs-spep-' + cid, status: 'final',
        category: [{ coding: [{ system: HL7.obsCat, code: 'laboratory' }] }],
        code: { text: 'Serum protein electrophoresis (SPEP)', coding: [{ system: LOCAL, code: 'spep' }] }, subject: sub,
        valueCodeableConcept: { text: P.spep, coding: [{ system: LOCAL, code: 'spep-' + P.spep }] } });
      out.push(o);
    }

    /* MedicationRequest and MedicationDispense for the signed prescription. */
    if (c.rx) {
      const medCC = { text: c.rx.name, coding: [{ system: LOCAL, code: c.rx.id }] };
      const mr = tagged({
        resourceType: 'MedicationRequest', id: 'mr-' + cid,
        status: c.closed && c.closed.kind === 'drop' ? 'stopped' : 'active', intent: 'order',
        medicationCodeableConcept: medCC, subject: sub,
        requester: practRef(c.rx.by), authoredOn: dateOf(anchor, c.rx.day),
        dosageInstruction: [{ text: c.rx.id === 'deno' ? 'One dose every 182 days (LOCAL schedule, see CarePlan). Dose and route per product label; not yet mapped.' : 'As prescribed. Renal and calcium blocks checked by the app (LOCAL and MYCPG).' }],
        reasonReference: condRefs.length ? condRefs.slice(0, 1) : undefined
      });
      out.push(mr);
      if (c.rx.dispensed !== null && c.rx.dispensed !== undefined) {
        out.push(tagged({ resourceType: 'MedicationDispense', id: 'md-' + cid, status: 'completed',
          medicationCodeableConcept: medCC, subject: sub,
          authorizingPrescription: [ref('MedicationRequest', mr.id)],
          whenHandedOver: dateOf(anchor, c.rx.dispensed) }));
      }
    }

    /* CarePlan: the open loop, or long-term follow-up once closed as treated, and the next denosumab dose. */
    const treated = c.closed && c.closed.kind === 'treated';
    const acts = [];
    if (treated) {
      acts.push({ detail: { status: 'scheduled', description: 'Yearly check-in. Closed as treated is not cure.', scheduledPeriod: { start: dateOf(anchor, c.closed.day + 365) } } });
      acts.push({ detail: { status: 'scheduled', description: 'Repeat DXA in 2 years.', scheduledPeriod: { start: dateOf(anchor, c.closed.day + 730) } } });
    }
    if (c.denoDue !== null && c.denoDue !== undefined) {
      acts.push({ detail: { status: 'scheduled', description: 'Denosumab next dose (LOCAL 182-day interval).', scheduledPeriod: { start: dateOf(anchor, c.denoDue) } } });
    }
    const cp = tagged({
      resourceType: 'CarePlan', id: cpid,
      status: c.closed && c.closed.kind === 'drop' ? 'revoked' : 'active', intent: 'plan',
      title: treated ? 'Long-term follow-up after treatment' : 'Fragility fracture: screening-to-treatment loop',
      description: treated ? 'Handed to long-term follow-up. Closed is not cure; yearly check-in continues.' : 'Open loop. Stages are in the Task resources.',
      subject: sub, created: dateOf(anchor, c.stages && c.stages[0] ? c.stages[0].start : 0),
      addresses: condRefs.length ? condRefs : undefined,
      careTeam: ownerRef ? [ownerRef] : undefined,
      activity: acts.length ? acts : undefined
    });
    out.push(cp);

    /* QuestionnaireResponse for each patient check-in (patient-reported). */
    (c.checkins || []).forEach((k, idx) => {
      const items = typeof opts.checkin === 'function' ? opts.checkin(k) : (Object.keys(k.answers || {}).map(q => ({ linkId: q, text: q, value: JSON.stringify(k.answers[q]) })));
      const qr = tagged({
        resourceType: 'QuestionnaireResponse', id: 'qr-' + cid + '-' + idx, status: 'completed',
        questionnaire: 'urn:osteoloop:questionnaire:' + (k.visit === 'first' ? 'first' : 'review'),
        subject: sub, authored: dateOf(anchor, k.d), source: sub,
        language: k.lang === 'ar' ? 'ar' : 'en',
        extension: (k.flags || []).map(f => ({ url: 'urn:osteoloop:checkin-flag', valueString: String(f[1]) + ': ' + String(f[2]) + ' (' + String(f[3]) + ')' }))
          .concat(k.reviewed ? [{ url: 'urn:osteoloop:reviewed', valueString: 'Reviewed by ' + k.reviewed.by + ', day ' + k.reviewed.d }] : []),
        item: items.map(x => ({ linkId: String(x.linkId), text: String(x.text),
          answer: x.value === '' || x.value === null || x.value === undefined ? undefined : [{ valueString: String(x.value) }] }))
      });
      out.push(qr);
    });

    /* Practitioners last, so every referenced one is present. */
    Object.keys(pract).forEach(k => out.push(pract[k]));

    /* R4 forbids empty strings, empty arrays and empty objects: strip them, and undefined keys, recursively. */
    const prune = v => {
      if (Array.isArray(v)) { const a = v.map(prune).filter(x => x !== undefined); return a.length ? a : undefined; }
      if (v && typeof v === 'object') {
        const o = {};
        Object.keys(v).forEach(k => { const x = prune(v[k]); if (x !== undefined) o[k] = x; });
        return Object.keys(o).length ? o : undefined;
      }
      if (v === '' || v === null || v === undefined) return undefined;
      return v;
    };
    const clean = out.map(prune);
    const entries = clean.map(r => ({ fullUrl: fullUrl(r.resourceType, r.id), resource: r }));
    return {
      resourceType: 'Bundle', id: 'bundle-' + cid, meta: { tag: [TAG] }, type: 'collection',
      timestamp: anchor + 'T00:00:00Z',
      entry: entries
    };
  }

  function toJSON(b) { return JSON.stringify(b, null, 2); }

  const api = { bundle, toJSON, fullUrl, uuidFor, TAG, LOCAL, DEFAULT_STAGES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OsteoFhir = api;
})(typeof window !== 'undefined' ? window : globalThis);
