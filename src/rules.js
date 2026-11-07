/*
 * OsteoLoop clinical rules — deterministic, each rule tagged with its source.
 * Sources:
 *   NICE   = NICE NG259, Osteoporosis: risk assessment (2026)
 *   MYCPG  = Malaysian CPG, Management of Postmenopausal Osteoporosis, 3rd ed. (2022)
 *   LOCAL  = local placeholder awaiting clinician sign-off
 * Works in the browser (window.OsteoRules) and in Node (module.exports).
 *
 * Patient shape (all fields optional unless stated):
 *   age, sex ('F'|'M'), menopause ('post'|'pre'|'na'),
 *   fractures: [{site:'hip'|'vert'|'wrist'|'humerus'|'pelvis'|'other', months:number, onTx:bool, onGc:bool}],
 *   gc (glucocorticoids >= 3 months), falls (2+ falls/yr), frail (clinician judgement),
 *   cvEvent (MI or stroke in last 12 months),
 *   t (lowest T-score, null if no DXA), mof, hip (FRAX 10-yr %, null if not run),
 *   egfr, ca (adjusted calcium mmol/L), vd (25-OH vitamin D nmol/L)
 */
(function (root) {
  const MAJOR = ['hip', 'vert', 'wrist', 'humerus'];
  const num = v => (v === null || v === undefined || v === '' || Number.isNaN(+v)) ? null : +v;

  function fractureSummary(p) {
    const f = p.fractures || [];
    return {
      any: f.length > 0,
      recent12: f.some(x => num(x.months) !== null && x.months <= 12),
      multiple: f.length >= 2,
      onTx: f.some(x => x.onTx),
      onGc: f.some(x => x.onGc),
      hipVert: f.some(x => x.site === 'hip' || x.site === 'vert'),
      majorRecent24: f.some(x => MAJOR.includes(x.site) && num(x.months) !== null && x.months <= 24)
    };
  }

  /* MYCPG: risk category. Returns {key:'vhigh'|'high'|'low'|'incomplete', fired:[[ruleId, text, source]]} */
  function category(p) {
    const fx = fractureSummary(p), t = num(p.t), mof = num(p.mof), hip = num(p.hip);
    const vh = [];
    if (fx.recent12) vh.push(['VH1', 'Fracture within the last 12 months', 'MYCPG']);
    if (fx.onTx) vh.push(['VH2', 'Fracture while on osteoporosis treatment', 'MYCPG']);
    if (fx.multiple) vh.push(['VH3', 'Multiple fractures', 'MYCPG']);
    if (fx.onGc) vh.push(['VH4', 'Fracture while on glucocorticoids', 'MYCPG']);
    if (p.falls) vh.push(['VH5', 'Injurious falls or high fall risk', 'MYCPG']);
    if (p.frail) vh.push(['VH6', 'Frailty or advanced age (clinician judgement)', 'MYCPG']);
    if (t !== null && t < -3.0) vh.push(['VH7', 'T-score below -3.0', 'MYCPG']);
    if (mof !== null && mof > 30) vh.push(['VH8', 'FRAX major osteoporotic > 30%', 'MYCPG']);
    if (hip !== null && hip > 4.5) vh.push(['VH9', 'FRAX hip > 4.5%', 'MYCPG']);
    if (vh.length) return { key: 'vhigh', fired: vh };

    const h = [];
    if (t !== null && t <= -2.5) h.push(['H1', 'T-score -2.5 or lower', 'MYCPG']);
    if (fx.hipVert) h.push(['H2', 'Hip or vertebral fragility fracture (clinical osteoporosis)', 'MYCPG']);
    if (t !== null && t > -2.5 && t < -1.0 && ((hip !== null && hip > 3) || (mof !== null && mof > 20)))
      h.push(['H3', 'Osteopenia with FRAX above treatment threshold', 'MYCPG']);
    if (h.length) return { key: 'high', fired: h };

    if (t === null && mof === null && hip === null) return { key: 'incomplete', fired: [['I1', 'Needs DXA or FRAX before a category can be set', 'MYCPG']] };
    // Never call a patient "low" on FRAX alone when FRAX says DXA is warranted (found by benchmark A12/A14/C03/C04)
    if (t === null && ((mof !== null && mof >= 10) || (hip !== null && hip > 3)))
      return { key: 'incomplete', fired: [['I2', 'FRAX at or above the DXA threshold without BMD: do DXA before setting a category', 'NICE']] };
    return { key: 'low', fired: [['L1', 'Below treatment thresholds', 'MYCPG']] };
  }

  /* NICE: is DXA indicated? Baseline DXA before treatment always applies. */
  function dxaIndication(p) {
    const fx = fractureSummary(p), mof = num(p.mof), r = [];
    if (num(p.age) !== null && p.age >= 30 && fx.hipVert) r.push(['D1', 'Previous hip or vertebral fragility fracture', 'NICE']);
    if (fx.majorRecent24) r.push(['D2', 'Major osteoporotic fracture in the last 2 years', 'NICE']);
    if ((p.fractures || []).length >= 2) r.push(['D3', 'Two or more fragility fractures', 'NICE']);
    if (mof !== null && mof >= 10) r.push(['D4', 'FRAX major osteoporotic 10% or more (consider)', 'NICE']);
    return { indicated: r.length > 0, reasons: r };
  }

  /* NICE: fast-track DXA within 6 weeks when anabolic treatment is likely (very high risk). */
  function fastTrack(p) { return category(p).key === 'vhigh'; }

  /* Lab flags. kind: 'block' stops or holds treatment, 'flag' needs action alongside. */
  function labFlags(p) {
    const out = [], ca = num(p.ca), vd = num(p.vd), eg = num(p.egfr);
    if (ca !== null && ca > 2.60) out.push(['L-CA-HI', 'block', 'Calcium high: check PTH; suspected hyperparathyroidism to specialist', 'NICE']);
    if (ca !== null && ca < 2.15) out.push(['L-CA-LO', 'block', 'Calcium low: correct before an antiresorptive', 'LOCAL']);
    if (vd !== null && vd < 75) out.push(['L-VD', 'flag', 'Vitamin D below 75 nmol/L: replete (50,000 IU weekly x 8 weeks or 6,000 IU daily), then 800-1,000 IU/day', 'MYCPG']);
    if (eg !== null && eg < 30) out.push(['L-EGFR30', 'block', 'eGFR below 30: oral bisphosphonates not recommended', 'MYCPG']);
    if (eg !== null && eg < 35) out.push(['L-EGFR35', 'block', 'eGFR below 35: zoledronic acid contraindicated', 'MYCPG']);
    const missing = ['ca', 'vd', 'egfr'].filter(k => num(p[k]) === null);
    return { flags: out, missing };
  }

  /* MYCPG: treatment options by category with contraindication blocks. */
  function treatments(p) {
    const cat = category(p).key, eg = num(p.egfr), list = [];
    const add = (id, name, kind, block) => list.push({ id, name, kind: block ? 'blocked' : kind, block: block || null });
    if (cat === 'vhigh') {
      add('teri', 'Teriparatide (up to 24 months), then an antiresorptive', 'first');
      add('romo', 'Romosozumab (12 months), then an antiresorptive', 'first', p.cvEvent ? 'Heart attack or stroke in the last 12 months' : null);
      add('deno', 'Denosumab', 'alt');
      add('zol', 'Zoledronic acid (IV)', 'alt', eg !== null && eg < 35 ? 'eGFR below 35' : null);
    } else if (cat === 'high') {
      add('obp', 'Oral bisphosphonate (e.g. alendronate)', 'first', eg !== null && eg < 30 ? 'eGFR below 30' : null);
      add('deno', 'Denosumab', 'first');
      add('zol', 'Zoledronic acid (IV)', 'alt', eg !== null && eg < 35 ? 'eGFR below 35' : null);
    } else if (cat === 'low') {
      add('life', 'Lifestyle, calcium and vitamin D; review risk', 'first');
    }
    return list;
  }
  function firstLine(p) { const t = treatments(p).filter(x => x.kind === 'first'); return t.map(x => x.id); }

  /* Scope warning: the CPG covers postmenopausal women. */
  function scopeWarning(p) {
    return (p.sex === 'F' && p.menopause === 'post') ? null : 'Outside the Malaysian CPG population (postmenopausal women): apply with clinician judgement';
  }

  /* LOCAL: secondary-cause screen before treating a vertebral fracture. spep: 'normal' | 'abnormal' | null.
     Abnormal electrophoresis blocks treatment (exclude myeloma). Missing when required is a visible flag, not a block. */
  function secondaryScreen(p) {
    const required = (p.fractures || []).some(f => f.site === 'vert');
    const spep = p.spep == null ? null : String(p.spep).toLowerCase();
    if (spep === 'abnormal') return { required, block: true, text: 'Abnormal protein electrophoresis: exclude myeloma (haematology) before osteoporosis treatment', source: 'LOCAL' };
    if (!required) return { required: false, block: false, text: null, source: 'LOCAL' };
    if (spep === 'normal') return { required: true, block: false, text: null, source: 'LOCAL' };
    return { required: true, block: false, text: 'Serum protein electrophoresis needed before treatment (exclude myeloma)', source: 'LOCAL' };
  }

  const api = { category, dxaIndication, fastTrack, labFlags, treatments, firstLine, scopeWarning, fractureSummary, secondaryScreen };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OsteoRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
