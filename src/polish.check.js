'use strict';
// Browser checks for the round-8 polish (hC builder). Opens the built page over file://, drives it like a person would,
// checks the results, takes screenshots into ../shots/, and reports every console error.
// Run: node src/polish.check.js   (after node src/build.js). Needs Playwright with Chromium. Fictional data only.
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require(process.env.PW_MODULE || '/opt/npm-tools/node_modules/playwright')); }

const ROOT = path.join(__dirname, '..');
const PAGE = 'file://' + path.join(__dirname, 'index.html');
const SHOTS = path.join(ROOT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? ' :: ' + JSON.stringify(detail).slice(0, 400) : '')); }
}

// Every visible button, select, input, textarea, link or summary smaller than 44 x 44 CSS px, plus horizontal overflow.
async function tapAudit(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button,select,input,textarea,a[href],summary,[role=button]').forEach(el => {
      const cs = getComputedStyle(el); const rc = el.getBoundingClientRect();
      if (cs.display === 'none' || cs.visibility === 'hidden' || rc.width === 0 || rc.height === 0) return;
      if (el.closest('[hidden],.hidden')) return;
      const sec = el.closest('section'); if (sec && sec.classList.contains('hidden')) return;
      if (rc.width < 44 || rc.height < 44) out.push(`${el.tagName}#${el.id}.${String(el.className).slice(0, 30)} "${(el.textContent || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 36)}" ${Math.round(rc.width)}x${Math.round(rc.height)}`);
    });
    return { small: out, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
  });
}

async function openTab(page, v) {
  await page.click(`nav button[data-v="${v}"]`);
  await page.waitForTimeout(60);
}

// Answers the interview on the page the way a person would: a "no" for yes/no, the unknown chip for choices,
// a number for numbers, and the given text for the free-text question. Stops when the summary or a red box appears.
async function driveInterview(page, freeText, opts) {
  opts = opts || {};
  let typedBad = false, typedOk = false, rangeSeen = false, guard = 0;
  while (guard++ < 120) {
    if (await page.$('#iv-sum .sumwrap')) break;
    if (await page.$('#iv-red .in-red')) break;
    const bot = await page.$$eval('#iv-chat .b.bot', els => els.map(e => e.innerText));
    const last = bot.length ? bot[bot.length - 1] : '';
    const enabled = await page.evaluate(() => !document.getElementById('iv-in').disabled);
    if (!enabled) break;
    if (opts.medicines && /List every medicine/i.test(last)) { await page.fill('#iv-in', opts.medicines); await page.press('#iv-in', 'Enter'); await page.waitForTimeout(40); continue; }
    if (opts.unknownMatch && opts.unknownMatch.test(last)) { await page.click('#iv-chips button[data-in-val="unknown"]'); await page.waitForTimeout(40); continue; }
    if (/anything else you want the team to know/i.test(last) && freeText) { await page.fill('#iv-in', freeText); await page.press('#iv-in', 'Enter'); await page.waitForTimeout(40); continue; }
    if (/HbA1c \(%\)/.test(last) && opts.rangeFirst && !rangeSeen) {
      rangeSeen = true;
      await page.fill('#iv-in', '99'); await page.press('#iv-in', 'Enter'); await page.waitForTimeout(40);
      typedBad = true; continue;
    }
    const chips = await page.$$eval('#iv-chips button[data-in-val]', els => els.map(e => ({ v: e.getAttribute('data-in-val'), t: e.textContent })));
    if (chips.length) {
      const hasYesNo = chips.some(c => c.v === 'yes') && chips.some(c => c.v === 'no');
      let pick = null;
      if (hasYesNo) pick = chips.find(c => c.v === 'no');
      else if (opts.unknownChoices) pick = chips.find(c => c.v === 'unknown');
      if (!pick) pick = chips.find(c => c.v !== 'unknown') || chips[0];
      await page.click(`#iv-chips button[data-in-val="${pick.v}"]`); await page.waitForTimeout(40);
      continue;
    }
    const hint = await page.textContent('#iv-hint');
    await page.fill('#iv-in', /Type a number/i.test(hint) ? '5' : 'nothing');
    await page.press('#iv-in', 'Enter'); await page.waitForTimeout(40);
  }
  return { typedBad, guard };
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const newPage = async (w, h) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(PAGE);
    await page.waitForTimeout(150);
    return page;
  };

  // ---------- A. Notices and the phone ----------
  let page = await newPage(430, 900);
  const notes = await page.$$eval('.demo-note', els => els.map(e => e.textContent.trim()));
  check('four demo notices are on the page (typed answer, Ask box, sample area, phone)', notes.length === 4, notes);
  check('the notice text is exactly the requested sentence', notes.every(n => n === "Demo only. Don't type real names, phone numbers or IC numbers."), notes);

  await openTab(page, 'pt');
  const noteShown = await page.$eval('#f + .demo-note', e => e.getBoundingClientRect().height > 0 && getComputedStyle(e).display !== 'none');
  check('the phone notice is visible on the phone tab at 430 px', noteShown === true);
  const before = await page.evaluate(() => (window.PeriHooks.sim().alerts || []).length);
  await page.fill('#msg', 'calf swollen call me 012-3456789');
  await page.press('#msg', 'Enter');
  await page.waitForTimeout(80);
  const phone = await page.evaluate(() => {
    const S = window.PeriHooks.sim();
    const mine = (S.chatAll || []).filter(m => m.who === 'me').map(m => m.text);
    return { mine, alerts: (S.alerts || []).map(a => ({ cls: a.cls, text: a.text || '' })), body: document.body.innerText };
  });
  check('phone: the typed message is stored masked', phone.mine.some(t => t === 'calf swollen call me [number removed]'), phone.mine);
  check('phone: the digits are not on the page', phone.body.indexOf('012-3456789') < 0);
  check('phone: the masked message still raises a SAME-DAY alert (red-flag engine saw the meaning)', phone.alerts.slice(before).some(a => a.cls === 'SAME-DAY'), phone.alerts.slice(before));
  check('phone: no alert text keeps the digits', phone.alerts.every(a => a.text.indexOf('012-3456789') < 0), phone.alerts);

  // ---------- B. Ask box: masked, stored masked, answered ----------
  await openTab(page, 'intake');
  await page.waitForTimeout(80);
  await page.fill('#iv-q', 'calf swollen call me 012-3456789');
  await page.press('#iv-q', 'Enter');
  await page.waitForTimeout(80);
  const askState = await page.evaluate(() => ({ q: document.getElementById('iv-q').value, ans: document.getElementById('iv-ans').innerText }));
  check('Ask box: the question field keeps the masked text', askState.q === 'calf swollen call me [number removed]', askState.q);
  check('Ask box: an answer is shown', askState.ans.length > 0, askState.ans);
  check('Ask box: the digits do not appear in the answer', askState.ans.indexOf('012-3456789') < 0);
  await openTab(page, 'staff');
  const staffBody = await page.evaluate(() => document.body.innerText);
  check('Staff board: a task carries the masked question', staffBody.indexOf('[number removed]') >= 0, staffBody.slice(0, 200));
  check('Staff board: the digits never appear', staffBody.indexOf('012-3456789') < 0);

  // ---------- C. Interview A: unknown choices, range wording, gaps, Show sources ----------
  page = await newPage(430, 900);
  await openTab(page, 'intake');
  await page.waitForTimeout(80);
  const runA = await driveInterview(page, 'Nothing else', { unknownChoices: true, rangeFirst: true, medicines: 'metformin, RN 12345678, tel 012-3456789', unknownMatch: /chest pain, trouble breathing/ });
  const chatA = await page.$eval('#iv-chat', e => e.innerText);
  check('interview A: typing 99 for HbA1c is named as wrong, not the generic reprompt', /HbA1c 99 looks wrong/.test(chatA) && !/I did not understand/.test(chatA.split('HbA1c 99 looks wrong')[1] || ''), chatA.slice(-300));
  check('interview A: the unknown chip echoes and is recorded (chat shows Unknown)', /Unknown \/ not sure/.test(chatA), chatA.slice(0, 200));
  const sumA = await page.$eval('#iv-sum', e => e.textContent);
  check('interview A: the summary reaches the page', /GAPS TO CLARIFY|Gaps to clarify/i.test(sumA), sumA.slice(0, 200));
  check('interview A: unknown answers are listed as "Patient does not know" gaps', /Patient does not know: Smoker/.test(sumA) && /Patient does not know: Alcohol/.test(sumA), sumA.slice(0, 300));
  check('interview A: the mobility aid answered unknown is not recorded as yes', !/Uses mobility aid: yes/.test(sumA) && /Uses mobility aid: unknown/.test(sumA), sumA.match(/Uses mobility aid[^\n]*/));
  check('interview A: the banner is not NONE', !/NONE: the fixed rules found no triggers/.test(sumA));
  const sumVisible = await page.$eval('#iv-sum', e => e.innerText);
  check('judge 1: an unknown red-flag answer (chest pain now) is AMBER with a clinician-confirm reason', /AMBER: clinician review needed/.test(sumVisible) && /Red-flag question not answered: clinician to confirm/i.test(sumVisible), sumVisible.slice(0, 300));
  check('judge 1: the red-flag unknown is a gap under Gaps to clarify', /Patient does not know: Chest pain, trouble breathing or confusion now/.test(sumA), sumA.match(/Patient does not know: Chest[^\n]*/));
  check('judge 3: the masked token shows in the summary with Show sources off', /\[number removed\]/.test(sumVisible) && /RN 12345678/.test(sumVisible), sumVisible.match(/Current medicines[^\n]*/));
  // Show sources: friendly labels, raw ids only in the title attribute
  const srcBefore = await page.evaluate(() => Array.from(document.querySelectorAll('#iv-sum .srcx')).filter(e => getComputedStyle(e).display !== 'none').length);
  check('Show sources: the tags start hidden', srcBefore === 0, srcBefore);
  await page.click('#iv-sum button[data-in-act="src"]');
  await page.waitForTimeout(40);
  const srcOn = await page.evaluate(() => {
    const vis = Array.from(document.querySelectorAll('#iv-sum .srcx')).filter(e => getComputedStyle(e).display !== 'none');
    return { text: vis.map(e => e.textContent), titles: vis.map(e => e.getAttribute('title')), btn: document.querySelector('#iv-sum button[data-in-act="src"]').textContent, aria: document.querySelector('#iv-sum button[data-in-act="src"]').getAttribute('aria-pressed') };
  });
  check('Show sources: friendly labels are visible', srcOn.text.length > 0 && srcOn.text.some(t => /medicines list/.test(t)), srcOn.text.slice(0, 5));
  check('Show sources: no raw field id is visible', srcOn.text.every(t => !/[a-z]+_[a-z_]+/.test(t)), srcOn.text);
  check('Show sources: the raw id is in the title attribute', srcOn.titles.some(t => /meds_text/.test(t)), srcOn.titles.slice(0, 5));
  check('Show sources: the button now says Hide sources', /Hide sources/.test(srcOn.btn) && srcOn.aria === 'true', srcOn);
  await page.click('#iv-sum button[data-in-act="src"]');
  const srcOff = await page.evaluate(() => Array.from(document.querySelectorAll('#iv-sum .srcx')).filter(e => getComputedStyle(e).display !== 'none').length);
  check('Show sources: the toggle hides them again', srcOff === 0, srcOff);
  await page.screenshot({ path: path.join(SHOTS, 'polish-430-intake-summary.png'), fullPage: false });
  const audA = await tapAudit(page);
  check('tap targets at 430 px after an interview and a summary: none under 44 px', audA.small.length === 0, audA.small.slice(0, 10));
  check('no horizontal scroll at 430 px (intake summary)', audA.sw <= audA.cw, { sw: audA.sw, cw: audA.cw });

  // Hand-off text in Malay and Chinese on the Ask box
  await page.selectOption('#iv-c-lang', 'ms');
  await page.fill('#iv-q', 'Boleh saya berhenti ubat darah sekarang?');
  await page.press('#iv-q', 'Enter');
  await page.waitForTimeout(80);
  const askMs = await page.$eval('#iv-ans', e => e.innerText);
  check('Ask box (ms): no English hand-off line', askMs.indexOf('No approved source') < 0 && askMs.indexOf('Staff board task created') < 0, askMs.slice(0, 300));
  check('Ask box (ms): the route sentence and reason are Malay, no English route text', askMs.indexOf('I will pass this') < 0 && /Saya akan hantar soalan ini/.test(askMs) && /Tiada sumber yang diluluskan|Pertimbangan klinikal/.test(askMs), askMs.slice(0, 400));
  check('Ask box (ms): the context line is Malay', /Konteks yang digunakan: negara:/.test(askMs), askMs.slice(-200));
  await page.selectOption('#iv-c-lang', 'zh');
  await page.fill('#iv-q', '我可以现在停止服用抗凝药吗？');
  await page.press('#iv-q', 'Enter');
  await page.waitForTimeout(80);
  const askZh = await page.$eval('#iv-ans', e => e.innerText);
  check('Ask box (zh): no English hand-off line', askZh.indexOf('No approved source') < 0 && askZh.indexOf('Staff board task created') < 0, askZh.slice(0, 300));
  check('Ask box (zh): the route sentence and reason are Chinese, no English route text', askZh.indexOf('I will pass this') < 0 && /我会将此问题转交给您的护理团队/.test(askZh) && /没有已批准的来源|临床判断/.test(askZh), askZh.slice(0, 400));
  // Judge 5: the notice in Malay and Chinese (machine drafts)
  await page.selectOption('#iv-lang', 'ms');
  await page.waitForTimeout(60);
  const noteMs = await page.$$eval('.iv-int .demo-note', els => els.map(e => e.textContent.trim()));
  check('judge 5: the interview notices are Malay when the interview is Malay', noteMs.length === 2 && noteMs.every(n => /Demo sahaja/.test(n)), noteMs);
  await page.selectOption('#iv-lang', 'zh');
  await page.waitForTimeout(60);
  const noteZh = await page.$$eval('.iv-int .demo-note', els => els.map(e => e.textContent.trim()));
  check('judge 5: the interview notices are Chinese when the interview is Chinese', noteZh.length === 2 && noteZh.every(n => /仅供演示/.test(n)), noteZh);
  // The notice follows the interview language (Arabic is a machine draft)
  await page.selectOption('#iv-lang', 'ar');
  await page.waitForTimeout(60);
  const noteAr = await page.$$eval('.iv-int .demo-note', els => els.map(e => e.textContent.trim()));
  check('the interview notices (typed box and sample row) are Arabic when the interview is Arabic', noteAr.length === 2 && noteAr.every(n => /للعرض فقط/.test(n)), noteAr);
  await page.close();

  // ---------- D. Interview B: a typed red flag, masked, still a red flag ----------
  page = await newPage(430, 900);
  await openTab(page, 'intake');
  await page.waitForTimeout(80);
  await driveInterview(page, 'calf swollen call me 012-3456789', {});
  const redB = await page.evaluate(() => ({ red: document.getElementById('iv-red').innerText, chat: document.getElementById('iv-chat').innerText, body: document.body.innerText }));
  check('interview B: the typed red flag is still raised (SAME-DAY)', /SAME-DAY/.test(redB.red), redB.red.slice(0, 200));
  check('interview B: the chat echo is masked', /calf swollen call me \[number removed\]/.test(redB.chat), redB.chat.slice(-200));
  check('interview B: the digits are not on the page', redB.body.indexOf('012-3456789') < 0);
  await page.screenshot({ path: path.join(SHOTS, 'polish-430-intake-red.png') });
  await page.close();

  // ---------- E. Tap targets and scroll on every tab, 430 px and 1280 px ----------
  for (const [w, h, tag] of [[430, 900, '430'], [1280, 800, '1280']]) {
    page = await newPage(w, h);
    const tabs = ['ov', 'pt', 'intake', 'staff', 'tests', 'about'];
    const seen = new Set();
    for (const t of tabs) {
      await openTab(page, t);
      if (t === 'intake') {
        await page.waitForTimeout(60);
        await page.selectOption('#iv-samp', { index: 1 });
        await page.click('#iv-sample');
        await page.waitForTimeout(60);
      }
      const a = await tapAudit(page);
      a.small.forEach(s => seen.add(t + ': ' + s));
      check(`tap targets and scroll on tab "${t}" at ${tag} px`, a.small.length === 0 && a.sw <= a.cw, { small: a.small.slice(0, 6), sw: a.sw, cw: a.cw });
      if (t === 'intake') await page.screenshot({ path: path.join(SHOTS, `polish-${tag}-intake-sample.png`), fullPage: true });
    }
    if (tag === '430') await (async () => { await openTab(page, 'ov'); await page.screenshot({ path: path.join(SHOTS, 'polish-430-overview.png'), fullPage: true }); })();
    if (tag === '1280') await (async () => { await openTab(page, 'intake'); await page.screenshot({ path: path.join(SHOTS, 'polish-1280-intake.png'), fullPage: true }); })();
    await page.close();
  }

  // ---------- F. Errors ----------
  check('no console errors or page errors across all checks', errors.length === 0, errors.slice(0, 8));

  await browser.close();
  console.log('\npolish.check: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CHECK CRASHED', e); process.exit(2); });
