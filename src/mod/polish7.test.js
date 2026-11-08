'use strict';
// Polish regression tests (round 7): Arabic banner labels, one line per patient statement, RTL bullets with isolated Latin runs.
// Run: node mod/polish7.test.js   Fictional data only.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const I = require('./interview.js');
const IN = require('./intake.js');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
const SRC = fs.readFileSync(path.join(__dirname, '..', 'src.html'), 'utf8');
const AR_RE = /[؀-ۿ]/;

// ---- 1. Arabic banner labels (src.html, UI.ar.banner) ----
const bannerStart = SRC.indexOf("banner:{RED:'عاجل");
const bannerLine = bannerStart >= 0 ? SRC.slice(bannerStart, SRC.indexOf('},', bannerStart) + 2) : '';
check('Arabic banner block found in src.html', bannerStart >= 0);
check('Arabic RED label is عاجل', /RED:'عاجل:/.test(bannerLine), bannerLine.slice(0, 80));
check('Arabic AMBER label is يحتاج مراجعة (not كهرماني)', /AMBER:'يحتاج مراجعة:/.test(bannerLine));
check('Arabic NONE label is لا تنبيهات من القواعد الثابتة', /NONE:'لا تنبيهات من القواعد الثابتة:/.test(bannerLine));
check('Arabic INCOMPLETE label is ناقص', /INCOMPLETE:'ناقص:/.test(bannerLine));
check('every Arabic banner keeps "هذا ليس إذناً بالسلامة"', (bannerLine.match(/هذا ليس إذناً بالسلامة/g) || []).length === 4);
check('the old amber word كهرماني is gone from src.html', SRC.indexOf('كهرماني') < 0);
check('the old "not a clearance" wording تصريحا بالموافقة is gone from src.html', SRC.indexOf('تصريحا بالموافقة') < 0);

// ---- 2. Patient's own words: one line per distinct statement, classes as a tag ----
const STMT = 'I take ibuprofen every night for the pain';
function summaryFor(lang, typed) {
  let s = I.build('TKR', lang, 'P7-' + lang);
  let g = 0;
  // type the same statement at a choice prompt on several attempts, then answer the rest neutrally
  for (let i = 0; i < 4 && !s.done; i++) s = I.next(s, typed);
  while (!s.done && g++ < 300) {
    const b = I.BANK[s.current];
    const a = b.type === 'yesno' ? 'no' : b.type === 'choice' ? b.options[0].label[lang] : b.type === 'number' ? 5 : 'none';
    s = I.next(s, a);
  }
  return IN.summarise(I.toAnswers(s));
}
const wordsOf = sum => { const sec = sum.sections.find(x => x.title === "Patient's own words" || x.title === 'كلمات المريض'); return sec ? sec.lines : []; };

const sumEn = summaryFor('en', STMT);
const enLines = wordsOf(sumEn);
const stmtLines = enLines.filter(l => l.indexOf(STMT) >= 0);
check('English: the same statement appears in exactly one line', stmtLines.length === 1, stmtLines.join(' | '));
check('English: the line carries its class as a tag', stmtLines.length === 1 && /auto-triage ROUTE/.test(stmtLines[0]), stmtLines[0]);
check('English: the line lists every source it came from', stmtLines.length === 1 && /\[sex\]/.test(stmtLines[0]), stmtLines[0]);
check('English: no line repeats the same quoted text', new Set(enLines.map(l => (l.match(/"([^"]*)"/) || [])[1])).size === enLines.length, enLines.join(' | '));

const sumAr = summaryFor('ar', 'أتناول الإيبوبروفين كل ليلة للألم');
const arLines = wordsOf(sumAr);
const arStmt = arLines.filter(l => l.indexOf('أتناول الإيبوبروفين') >= 0);
check('Arabic: the same statement appears in exactly one line', arStmt.length === 1, arStmt.join(' | '));
check('Arabic: the class tag is Arabic (يُحال إلى الفريق), not the raw code', arStmt.length === 0 || (/يُحال إلى الفريق/.test(arStmt[0]) && !/ROUTE/.test(arStmt[0])), arStmt[0]);

// Unit: two identical statements typed as separate free-text answers merge into one line with both refs
const fake = { pid: 'P7-U', procedure: 'TKR', lang: 'en', answers: {}, freeText: ['Pain at night', 'pain at night ', 'Nothing else'], routes: [] };
const fakeLines = wordsOf(IN.summarise(fake));
check('identical free-text statements (case and spacing differ) merge into one line', fakeLines.filter(l => /pain at night/i.test(l)).length <= 1, fakeLines.join(' | '));
const mergedLine = fakeLines.find(l => /pain at night/i.test(l)) || '';
check('merged line keeps both free-text refs', /\[freeText\.0, freeText\.1\]/.test(mergedLine), mergedLine);

// ---- 3. RTL bullets and isolated Latin runs (src.html) ----
const renderStart = SRC.indexOf('function renderSummary(');
const renderEnd = SRC.indexOf('\nfunction ', renderStart + 10);
const renderBody = SRC.slice(renderStart, renderEnd);
check('summary bullets no longer use a fixed dir="auto" for Arabic', renderBody.indexOf('<li dir="auto">') < 0 && /LI=ar\?'rtl':'auto'/.test(renderBody));
check('every summary bullet uses the LI direction variable', (renderBody.match(/<li dir="'\+LI\+'">/g) || []).length === 3);

// Load the real srcHtml and esc from the page and check that Latin runs are isolated in Arabic
const hStart = SRC.indexOf('function srcHtml(');
const hEnd = SRC.indexOf('\nfunction renderSummary(');
const escSrc = SRC.match(/function esc\(x\)\{return String\(x==null\?''[^\n]*\n/);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(escSrc[0] + SRC.slice(hStart, hEnd) + '\nthis.srcHtml = srcHtml;', ctx);
const h = (t, lang) => ctx.srcHtml(t, lang);
const bullet = h('HbA1c: 9.1 [hba1c]', 'ar');
check('Arabic: a Latin-leading value is wrapped as an LTR isolate', /<bdi dir="ltr">HbA1c: 9\.1<\/bdi>/.test(bullet), bullet);
const bullet2 = h('تم الإبلاغ عن مميّع للدم: Aspirin 75 mg [blood_thinner]', 'ar');
check('Arabic: a Latin drug name in an Arabic line is isolated', /<bdi dir="ltr">Aspirin 75 mg<\/bdi>/.test(bullet2), bullet2);
check('Arabic: the source tag is wrapped in the hidden srcx span', /<span class="srcx">\[blood_thinner\]<\/span>/.test(bullet2), bullet2);
const en = h('HbA1c: 9.1 [hba1c]', 'en');
check('English output is unchanged (no isolate wrapper)', en.indexOf('<bdi') < 0, en);

console.log('\npolish7: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
