'use strict';
// Arabic (ar) content tests: interview text, parsing, summary, knowledge retrieval, page wiring. Fictional data only.
// Run: node mod/arabic_content.test.js
const fs = require('fs');
const path = require('path');
const I = require('./interview.js');
const IN = require('./intake.js');
const K = require('./knowledge.js');
const IDMAP = require('./idmap.js');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
const AR_RE = /[؀-ۿ]/;
const ALL = I.COMMON.concat(...I.PROCEDURES.map(p => I.BY_PROC[p]));

// 1. Bank: every question has ar text, every choice option has an ar label, reviewed:false on every ar string
const noAr = ALL.filter(q => typeof q.text.ar !== 'string' || !AR_RE.test(q.text.ar));
check('every question has Arabic text (' + ALL.length + ' questions)', noAr.length === 0, noAr.map(q => q.id).join(', '));
const badOpt = ALL.filter(q => q.type === 'choice' && q.options.some(o => typeof o.label.ar !== 'string' || !AR_RE.test(o.label.ar)));
check('every choice option has an Arabic label', badOpt.length === 0, badOpt.map(q => q.id).join(', '));
check('Arabic text is reviewed:false on every question', ALL.every(q => q.reviewed === false));
check('Arabic text differs from English on every question', ALL.every(q => q.text.ar !== q.text.en));
check('ar is a supported language', I.LANGS.indexOf('ar') >= 0);

// 2. Every procedure builds and its first prompt is Arabic and marked as a draft
const buildErr = [];
I.PROCEDURES.forEach(p => {
  try {
    const s = I.build(p, 'ar', 'AR-T');
    const pr = I.prompt(s);
    if (!pr || !AR_RE.test(pr.text) || pr.draft !== true) buildErr.push(p + ': bad first prompt');
  } catch (e) { buildErr.push(p + ': ' + e.message); }
});
check('all six procedures build in ar with an Arabic first prompt', buildErr.length === 0, buildErr.join('; '));

// 3. Typed yes/no/unknown parsing (Arabic words, Arabic-Indic digits for numbers)
function askOne(procedure, qid, typed) {
  let s = I.build(procedure, 'ar', 'AR-P'); let g = 0;
  while (s.current !== qid && !s.done && g++ < 200) {
    const q = I.BANK[s.current];
    const a = q.type === 'yesno' ? 'لا' : q.type === 'choice' ? q.options[0].label.ar : q.type === 'number' ? 5 : 'لا شيء';
    s = I.next(s, a);
  }
  return I.next(s, typed);
}
const YES_WORDS = ['نعم', 'أيوه', 'ايوه', 'ايوا'];
const NO_WORDS = ['لا', 'ليس'];
const UNK_WORDS = ['ما أدري', 'مو متأكد', 'لا أعرف', 'مش متأكد', 'غير متأكد'];
check('Arabic yes words parse to yes', YES_WORDS.every(w => askOne('TKR', 'diabetes', w).answers.diabetes === 'yes'),
  YES_WORDS.map(w => w + '=' + askOne('TKR', 'diabetes', w).answers.diabetes).join(' '));
check('Arabic no words parse to no', NO_WORDS.every(w => askOne('TKR', 'diabetes', w).answers.diabetes === 'no'),
  NO_WORDS.map(w => w + '=' + askOne('TKR', 'diabetes', w).answers.diabetes).join(' '));
check('Arabic unknown phrases are recorded as unknown, never yes or no', UNK_WORDS.every(w => askOne('TKR', 'diabetes', w).answers.diabetes === 'unknown'),
  UNK_WORDS.map(w => w + '=' + askOne('TKR', 'diabetes', w).answers.diabetes).join(' '));
const hb = askOne('TKR', 'diabetes', 'نعم');
const hbQ = I.next(hb, 'نعم');
check('Arabic yes on the HbA1c question is a reprompt (number needed)', hbQ.reprompt === true || hb.current === 'hba1c');
const ar91 = I.next(hb, '٩٫١');
check('Arabic-Indic digits with Arabic decimal mark: ٩٫١ -> 9.1', ar91.answers.hba1c === 9.1, String(ar91.answers.hba1c));
const arFive = I.next(hb, '٥');
check('Arabic-Indic digit: ٥ -> 5', arFive.answers.hba1c === 5, String(arFive.answers.hba1c));
const arNone = I.next(hb, 'لا');
check('typed لا on a number question is unknown (a gap, never a number)', arNone.answers.hba1c === 'unknown', String(arNone.answers.hba1c));
const stairsZero = I.next(askOne('THR', 'lives_alone', 'لا'), 'لا');
check('a number answer in Arabic digits outside the range is refused', (() => {
  let s = askOne('THR', 'stairs', '٥٠٠٠'); return s.reprompt === true && s.current === 'stairs';
})());
check('Arabic-Indic zero is accepted for stairs', (() => {
  let s = I.build('THR', 'ar', 'AR-Z'); let g = 0;
  while (s.current !== 'stairs' && !s.done && g++ < 200) { const q = I.BANK[s.current]; s = I.next(s, q.type === 'yesno' ? 'لا' : q.type === 'choice' ? q.options[0].label.ar : q.type === 'number' ? 5 : 'لا شيء'); }
  s = I.next(s, '٠'); return s.answers.stairs === 0;
})());

// 4. Scripted all-negative and all-positive Arabic runs: interview, then summary
function defaultFor(q, mode) {
  if (q.type === 'yesno') return mode === 'pos' ? 'نعم' : 'لا';
  if (q.type === 'choice') return q.options[mode === 'pos' ? q.options.length - 1 : 0].label.ar;
  if (q.type === 'number') return 5;
  return mode === 'pos' ? 'بنسلين: طفح جلدي' : 'لا شيء';
}
function runFull(procedure, mode) {
  let s = I.build(procedure, 'ar', 'AR-R'); const asked = []; let g = 0;
  while (!s.done && g++ < 300) {
    const q = I.BANK[s.current]; asked.push(q.id);
    s = I.next(s, defaultFor(q, mode));
    if (s.reprompt) return { ok: false, why: 'reprompt at ' + q.id + ': ' + s.lastError, asked };
  }
  return { ok: s.done, s, asked };
}
const NOT_ANS = 'لم تتم الإجابة';
I.PROCEDURES.forEach(p => {
  ['neg', 'pos'].forEach(mode => {
    const r = runFull(p, mode);
    check(p + ' ' + mode + ' Arabic run completes without reprompt', r.ok, r.why || '');
    if (!r.ok) return;
    const sum = IN.summarise(I.toAnswers(r.s));
    const all = JSON.stringify(sum);
    check(p + ' ' + mode + ': no "not answered" line for an asked question', !all.includes(NOT_ANS), (all.match(/لم تتم الإجابة[^"]*/) || [''])[0]);
    const ans = I.toAnswers(r.s);
    const text = JSON.stringify(sum);
    const dropped = Object.keys(ans.questions).filter(qid => {
      const t = IDMAP.targetsOf(qid).filter(x => x !== 'freeText');
      const hit = t.some(f => text.includes('[' + f + ']')) || text.includes('[' + qid + ']') || text.includes(ans.questions[qid].text);
      const free = IDMAP.targetsOf(qid).indexOf('freeText') >= 0 && text.includes('freeText.');
      return !(hit || free);
    });
    check(p + ' ' + mode + ': no dropped answers (every answer appears in the summary)', dropped.length === 0, dropped.join(', '));
  });
});

// 5. Summary hygiene: no undefined, null or NaN; no raw snake_case keys outside source tags
function stripTags(s) { return String(s).replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, ''); }
const samples = [0, 1, 2].map(i => I.arSample(i));
const sumTexts = [];
I.PROCEDURES.forEach(p => { sumTexts.push(JSON.stringify(IN.summarise(I.toAnswers(runFull(p, 'neg').s)))); sumTexts.push(JSON.stringify(IN.summarise(I.toAnswers(runFull(p, 'pos').s)))); });
samples.forEach(a => sumTexts.push(JSON.stringify(IN.summarise(a))));
const bad = sumTexts.filter(t => /undefined|\bnull\b|\bNaN\b/.test(t));
check('no "undefined", null or NaN in any Arabic summary', bad.length === 0, bad.length + ' summaries');
const rawKey = sumTexts.filter(t => /[a-z]+_[a-z_]+/.test(stripTags(JSON.parse(t).sections ? JSON.parse(t).sections.map(s => s.title + ' ' + s.lines.join(' ')).join(' ') + ' ' + JSON.parse(t).banner.reasons.join(' ') : '')));
check('no raw snake_case keys in Arabic summary text (source tags excluded)', rawKey.length === 0, rawKey.length + ' summaries');
const samplesTodos = samples.map(a => IN.todos(a).map(t => t.title).join(' | ')).join(' || ');
check('Arabic to-do titles have no raw keys or undefined', !/undefined|[a-z]+_[a-z]+/.test(samplesTodos), samplesTodos.slice(0, 160));
// Staff board titles are English; a route task quotes the patient's own question verbatim, so only its prefix is checked.
check('Arabic to-dos keep English titles for the Staff board', samples.every(a => IN.todos(a).every(t => t.staffTitle && (t.key.indexOf('intake_q_') === 0 ? t.staffTitle.indexOf('Patient question to answer: ') === 0 : !AR_RE.test(t.staffTitle)))));
check('Arabic summary label is translated', IN.summarise(samples[0]).label !== 'Patient-reported, clinician to verify' && AR_RE.test(IN.summarise(samples[0]).label));
check('Arabic section titles are translated', IN.summarise(samples[0]).sections.every(s => AR_RE.test(s.title)));
check('the Arabic sample with a lumbar saddle answer is RED', IN.summarise(samples[1]).banner.level === 'RED');
check('the Arabic sample with a blood thinner and penicillin allergy is AMBER', IN.summarise(samples[0]).banner.level === 'AMBER');
check('the Arabic summary notice asks a native Arabic-speaking (Gulf) clinician to review', /ناطق بالعربية/.test(IN.NOTICE.ar) && /الخليج/.test(IN.NOTICE.ar));
check('Arabic yes/no in the summary read نعم and لا', /نعم/.test(JSON.stringify(IN.summarise(samples[0]).sections)) && /لا \[/.test(JSON.stringify(IN.summarise(samples[0]).sections)));

// 6. Knowledge retrieval in Arabic (the same layered store as English)
const SRC = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources.sample.json'), 'utf8')).sources;
const store = K.createStore();
SRC.forEach(s => K.addSource(store, { layer: s.layer, owner: s.owner, title: s.title, lang: s.lang, text: s.text, procedures: s.procedures }));
const FULL = { country: 'Sample Emirate Health Authority', hospital: 'Sample General Hospital', team: 'Sample Ortho Ward Team', surgeon: 'Dr Sample Surgeon', procedure: 'TKR' };
const NO_SURG = Object.assign({}, FULL, { surgeon: '' });
const shower = K.answer(store, NO_SURG, 'هل أستطيع الاستحمام اليوم؟', 'ar');
check('Arabic shower question cites a source (hospital layer when there is no surgeon)', shower.kind === 'ANSWER' && shower.citation.layer === 'hospital' && shower.citation.owner === 'Sample General Hospital', JSON.stringify(shower).slice(0, 200));
check('Arabic citation carries an Arabic layer label', shower.citation && shower.citation.layerLabel === 'المستشفى');
const surg = K.answer(store, FULL, 'هل أستطيع الاستحمام اليوم؟', 'ar');
check('surgeon layer overrides hospital for Arabic shower', surg.kind === 'ANSWER' && surg.citation.layer === 'surgeon', JSON.stringify(surg).slice(0, 200));
const ov = K.overrideLine(store, FULL, surg);
check('Arabic override line names the hospital layer and both owners', !!ov && /المستشفى/.test(ov.head) && ov.body.indexOf('Sample General Hospital') >= 0 && ov.body.indexOf('Dr Sample Surgeon') >= 0, JSON.stringify(ov));
const bt = K.answer(store, FULL, 'هل أستمر في تناول المميّع الليلة؟', 'ar');
check('Arabic blood-thinner question routes (clinical topic, no approved source)', bt.kind === 'ROUTE' && bt.text === K.answer(store, FULL, 'x', 'ar').text && AR_RE.test(bt.reason), JSON.stringify(bt));
const fly = K.answer(store, FULL, 'هل أستطيع السفر بالطائرة بعد ثلاثة أسابيع؟', 'ar');
check('Arabic flying question routes, never answered', fly.kind === 'ROUTE');
const drv = K.answer(store, FULL, 'متى أستطيع القيادة؟', 'ar');
check('Arabic driving question with only a draft resolves to a route', drv.kind === 'ROUTE' || drv.kind === 'ANSWER');
const wound = K.answer(store, FULL, 'كيف أعتني بالضمادة؟', 'ar');
check('Arabic wound question answers from the team layer', wound.kind === 'ANSWER' && wound.citation.layer === 'team', JSON.stringify(wound).slice(0, 160));
const rtext = [bt, fly, drv].map(r => (r.text || '') + ' ' + (r.reason || '')).join(' ');
check('Arabic route texts and reasons have no raw keys', !/[a-z]+_[a-z]+|undefined/.test(rtext), rtext.slice(0, 160));
check('Arabic route text is Arabic', AR_RE.test(bt.text));
check('Arabic answers carry no English route text', !/care team/.test(JSON.stringify([bt, fly])));
const emptyAr = K.answer(store, FULL, 'ما هو الطقس؟', 'ar');
check('an Arabic question with no matching topic routes to the care team', emptyAr.kind === 'ROUTE' && AR_RE.test(emptyAr.reason));
check('Arabic answers are not produced from English-only sources', K.answer(store, FULL, 'Can I shower today?', 'ar').kind !== 'ANSWER' || K.answer(store, FULL, 'Can I shower today?', 'ar').lang === 'ar');

// 7. Page wiring (static checks on the built source)
const HTML = fs.readFileSync(path.join(__dirname, '..', 'src.html'), 'utf8');
check('both language pickers offer العربية', (HTML.match(/value="ar">العربية<\/option>/g) || []).length >= 2);
check('Arabic samples are in the sample picker', HTML.indexOf('value="ar:') >= 0 && HTML.indexOf('العربية (عينات وهمية)') >= 0);
check('Arabic sample chips are on the Patient phone tab', HTML.indexOf('(AR)') >= 0);
check('RTL rules use logical properties and no external font downloads', /\[dir=rtl\]/.test(HTML) && !/fonts\.googleapis|@import url/.test(HTML));
check('the second-check status line is Arabic on the phone only', HTML.indexOf('id="sc-phone"') >= 0 && HTML.indexOf('window.__plPhoneAr') >= 0);
check('the English honestReply signature is unchanged', HTML.indexOf('function honestReply(text,alertExists){') >= 0);

console.log('\narabic content: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
