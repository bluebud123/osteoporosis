'use strict';
var fs = require('fs');
var path = require('path');
var K = require('./knowledge.js');

var pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

var sample = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources.sample.json'), 'utf8'));
function buildStore(list) {
  var s = K.createStore();
  list.forEach(function (src) {
    K.addSource(s, { layer: src.layer, owner: src.owner, title: src.title, lang: src.lang, text: src.text, procedures: src.procedures });
  });
  return s;
}

var store = buildStore(sample.sources);
var FULL = { country: 'Sample Emirate Health Authority', hospital: 'Sample General Hospital', team: 'Sample Ortho Ward Team', surgeon: 'Dr Sample Surgeon' };
var NO_SURGEON = { country: FULL.country, hospital: FULL.hospital, team: FULL.team };
var NO_TEAM_SURGEON = { country: FULL.country, hospital: FULL.hospital };
var COUNTRY_ONLY = { country: FULL.country };
var ROUTE_TEXT = 'I will pass this to your care team';

// 1. Precedence: most specific layer wins per topic
var a1 = K.answer(store, FULL, 'Can I shower today?', 'en');
check('precedence: surgeon beats hospital on shower', a1.kind === 'ANSWER' && a1.citation.layer === 'surgeon', JSON.stringify(a1));
var a2 = K.answer(store, NO_SURGEON, 'Can I shower today?', 'en');
check('precedence: hospital beats country when no surgeon', a2.kind === 'ANSWER' && a2.citation.layer === 'hospital', JSON.stringify(a2));
var a3 = K.answer(store, COUNTRY_ONLY, 'Can I shower today?', 'en');
check('precedence: country used when only country in scope', a3.kind === 'ANSWER' && a3.citation.layer === 'country', JSON.stringify(a3));
var a4 = K.answer(store, FULL, 'How should I care for my wound?', 'en');
check('precedence: team beats country on wound_care', a4.kind === 'ANSWER' && a4.citation.layer === 'team', JSON.stringify(a4));
var a5 = K.answer(store, COUNTRY_ONLY, 'How should I care for my wound?', 'en');
check('precedence: country wound_care without team', a5.kind === 'ANSWER' && a5.citation.layer === 'country', JSON.stringify(a5));

// 2. Language: ms question resolves to ms chunk from country layer
var a6 = K.answer(store, FULL, 'Bolehkah saya mandi hari ini?', 'ms');
check('language: ms shower falls back to country ms chunk', a6.kind === 'ANSWER' && a6.lang === 'ms' && a6.citation.layer === 'country', JSON.stringify(a6));

// 3. No source routes
var a7 = K.answer(store, FULL, 'What is the weather in Abu Dhabi tomorrow?', 'en');
check('no source: unrelated question routes', a7.kind === 'ROUTE' && a7.reason === 'no approved source' && a7.text === ROUTE_TEXT, JSON.stringify(a7));
var a8 = K.answer(store, FULL, '我可以洗澡吗', 'zh');
check('no source: zh question with no zh sources routes', a8.kind === 'ROUTE', JSON.stringify(a8));
var a9 = K.answer(K.createStore(), FULL, 'Can I shower today?', 'en');
check('no source: empty store routes', a9.kind === 'ROUTE' && a9.citation === null, JSON.stringify(a9));

// 4. Clinical topics route unless an approved chunk exists for that exact topic
var c1 = K.answer(store, FULL, 'Can I stop my blood thinner?', 'en');
check('clinical: blood thinner question routes', c1.kind === 'ROUTE' && c1.citation === null, JSON.stringify(c1));
var c2 = K.answer(store, FULL, 'When can I drive after surgery?', 'en');
check('clinical: driving routes when only an unapproved draft exists', c2.kind === 'ROUTE' && c2.reason.indexOf('driving') >= 0, JSON.stringify(c2));
var storeApprovedFlying = buildStore(sample.sources.concat([{
  layer: 'hospital', owner: 'Test Hospital', title: 'TEST FIXTURE – approved flying', lang: 'en',
  text: '[topic=flying approved=true]\nTEST FIXTURE: clinician-approved flying text.'
}]));
var c3 = K.answer(storeApprovedFlying, { hospital: 'Test Hospital' }, 'When can I drive?', 'en');
check('clinical: approved chunk for a different topic does not unlock driving', c3.kind === 'ROUTE', JSON.stringify(c3));
var storeApprovedDriving = buildStore(sample.sources.concat([{
  layer: 'hospital', owner: 'Test Hospital', title: 'TEST FIXTURE – approved driving', lang: 'en',
  text: '[topic=driving approved=true]\nTEST FIXTURE: clinician-approved driving text.'
}]));
var c4 = K.answer(storeApprovedDriving, { hospital: 'Test Hospital' }, 'When can I drive?', 'en');
check('clinical: exact approved topic answers', c4.kind === 'ANSWER' && c4.citation.chunkId && c4.approved === true, JSON.stringify(c4));

// 5. Triage pre-empts
var t1 = K.answer(store, FULL, 'I have chest pain after my shower', 'en');
check('triage: chest pain is EMERGENCY and pre-empts shower answer', t1.kind === 'ROUTE' && t1.cls === 'EMERGENCY' && t1.citation === null, JSON.stringify(t1));
var t2 = K.answer(store, FULL, 'My temperature is 38.5, can I shower?', 'en');
check('triage: fever is SAME-DAY and pre-empts', t2.kind === 'ROUTE' && t2.cls === 'SAME-DAY' && t2.citation === null, JSON.stringify(t2));

// 6. Citation always present on ANSWER
var questions = ['Can I shower today?', 'How should I care for my wound?', 'Bolehkah saya mandi hari ini?', 'When is my follow-up appointment?', 'Bila temujanji susulan saya?'];
var answers = [];
questions.forEach(function (q) {
  [FULL, NO_SURGEON, NO_TEAM_SURGEON, COUNTRY_ONLY].forEach(function (ctx) {
    var lang = /[\u0080-￿]/.test(q) ? 'en' : (/ms|bolehkah|bila|mandi/i.test(q) ? 'ms' : 'en');
    answers.push(K.answer(store, ctx, q, lang));
  });
});
var ans = answers.filter(function (r) { return r.kind === 'ANSWER'; });
var allCited = ans.length > 0 && ans.every(function (r) {
  return r.citation && r.citation.layer && r.citation.owner && r.citation.title && r.citation.chunkId;
});
check('citation: every ANSWER carries layer/owner/title/chunkId (' + ans.length + ' answers)', allCited);

// 7. Override changes the answer
var o1 = K.answer(store, FULL, 'Can I shower today?', 'en');
var o2 = K.answer(store, NO_SURGEON, 'Can I shower today?', 'en');
check('override: surgeon note changes shower answer', o1.kind === 'ANSWER' && o2.kind === 'ANSWER' && o1.text !== o2.text && o1.citation.layer !== o2.citation.layer, o1.text + ' | ' + o2.text);

// 8. Store validation
var threw = false;
try { K.addSource(K.createStore(), { layer: 'ward', owner: 'x', title: 'x', lang: 'en', text: 'x' }); } catch (e) { threw = true; }
check('validation: unknown layer rejected', threw);

console.log('\n' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
