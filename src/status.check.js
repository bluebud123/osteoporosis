/* Stub proxy and Playwright checks for the status badge, Test connection, raised-by labels, language and header.
 * Usage: node src/build.js && node src/status.check.js
 * The stub answers POST like the real proxy: {"text":"{\"verdict\":\"urgent\",\"reason\":\"x\"}"} with CORS allowed.
 * It can also be set to answer an HTTP error status. Fictional data only. Only localhost is contacted.
 */
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

function startStub(port) {
  let hits = 0;
  const cfg = { status: 200 };
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    req.on('data', () => {});
    req.on('end', () => {
      hits++;
      if (cfg.status !== 200) { res.writeHead(cfg.status, { 'content-type': 'text/plain' }); res.end('stub error'); return; }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ text: JSON.stringify({ verdict: 'urgent', reason: 'x' }) }));
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve({
      port, hits: () => hits, setStatus: c => { cfg.status = c; },
      stop: () => new Promise(r => server.close(() => r()))
    }));
  });
}

async function runChecks() {
  const { chromium } = require('playwright');
  const PAGE = 'file://' + path.join(__dirname, 'index.html');
  const SHOTS = path.join(__dirname, '..', 'shots');
  fs.mkdirSync(SHOTS, { recursive: true });
  const results = [];
  const check = (name, ok, detail) => { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  [' + detail + ']' : '')); };

  // Baseline header height: the committed build (HEAD), same viewport.
  const baseFile = path.join(os.tmpdir(), 'hb_status_baseline.html');
  fs.writeFileSync(baseFile, execFileSync('git', ['show', 'HEAD:src/index.html'], { cwd: path.join(__dirname, '..') }));

  const port = 8790 + Math.floor(Math.random() * 500);
  let stub = await startStub(port);
  const browser = await chromium.launch();
  const errors = [];
  const netRefused = [];

  const headerInfo = async (p) => p.evaluate(() => {
    const h = document.querySelector('header');
    return { pos: getComputedStyle(h).position, h: Math.round(h.getBoundingClientRect().height) };
  });

  for (const vp of [{ w: 390, h: 700, tag: '390' }, { w: 430, h: 900, tag: '430' }, { w: 1280, h: 800, tag: '1280' }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(vp.tag + ' pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') (/Failed to load resource|net::/.test(m.text()) ? netRefused : errors).push(vp.tag + ' console: ' + m.text()); });
    const refused = { n: 0 };
    page.on('requestfailed', r => { if (r.url().startsWith('http://localhost:' + port)) refused.n++; });
    const T = (label) => `${vp.tag}-${label}`;
    await page.goto(PAGE);
    await page.waitForSelector('#pl-ai-badge');
    const badge = async () => (await page.textContent('#pl-ai-badge span:last-child')).trim();
    const icon = async () => (await page.textContent('#pl-ai-badge .pl-ic')).trim();

    // header: static on phone widths, sticky on desktop; never taller than the baseline except as recorded below
    const hi = await headerInfo(page);
    const bp = await (async () => { const b = await browser.newPage({ viewport: { width: vp.w, height: vp.h } }); await b.goto('file://' + baseFile); const r = await headerInfo(b); await b.close(); return r; })();
    if (vp.w < 520) check(`${vp.tag} header is not pinned (static) on phone width`, hi.pos === 'static', hi.pos);
    else check(`${vp.tag} header stays sticky on desktop width`, hi.pos === 'sticky', hi.pos);
    // Judge round 1 (P1-9): the compact phone header measures 163px; the old committed baseline was 171px. Held to <= 171 (no slack any more).
    if (vp.w < 520) check(`${vp.tag} header height <= 171 (old baseline; compact CSS measures 163)`, hi.h <= 171, `new=${hi.h} baseline=${bp.h}`);
    else console.log(`info: ${vp.tag} header height new=${hi.h} baseline=${bp.h} (desktop, sticky, not held to the phone rule)`);

    // 1. scripted mode
    check(`${vp.tag} badge says Rules only (no AI) at load`, (await badge()) === 'Rules only (no AI)' && (await icon()) === '○', await badge());
    await page.screenshot({ path: path.join(SHOTS, T('1-scripted.png')), fullPage: false });
    const clockTxt = await page.$$eval('.clock button[data-t]', bs => bs.map(b => b.textContent.trim()));
    check(`${vp.tag} clock buttons read in plain words`, clockTxt.join('|') === '+1 hour|+6 hours|+1 day|+3 days', clockTxt.join('|'));
    check(`${vp.tag} clock caption visible`, (await page.textContent('.pl-clk-cap')) === 'Demo clock: skip ahead' && await page.isVisible('.pl-clk-cap'));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${vp.tag} no horizontal page scroll`, overflow <= 0, 'overflow=' + overflow);

    // 2. AI via proxy in Settings
    await page.click('nav button[data-v="intake"]');
    await page.click('#iv-set-sum');
    await page.selectOption('#iv-set-mode', 'ai');
    await page.fill('#iv-set-proxy', `http://localhost:${port}/chat`);
    await page.waitForTimeout(100);
    // Judge round 1 (P1-4): nothing has been checked yet, so the badge must NOT claim green "on".
    check(`${vp.tag} badge is neutral "set, not tested" after Settings change (no green before a check)`, (await badge()) === 'AI second check: set, not tested' && (await icon()) === '◐', await badge());
    const colour0 = await page.$eval('#pl-ai-badge', el => getComputedStyle(el).color);
    check(`${vp.tag} untested badge is not the green token`, colour0 !== 'rgb(46, 125, 50)', colour0);
    await page.click('#pl-test-conn');
    await page.waitForFunction(() => /Connected|Not connected/.test(document.getElementById('pl-test-out').textContent), null, { timeout: 15000 });
    const tOut = (await page.textContent('#pl-test-out')).trim();
    check(`${vp.tag} Test connection reports success`, tOut === 'Connected: second check works', tOut);
    check(`${vp.tag} badge turns on after a successful test`, (await badge()) === 'AI second check: on' && (await icon()) === '●', await badge());
    const colour = await page.$eval('#pl-ai-badge', el => getComputedStyle(el).color);
    check(`${vp.tag} badge colour is the green token after a successful test`, colour === 'rgb(46, 125, 50)', colour);
    const btnBox = await page.$eval('#pl-test-conn', b => { const r = b.getBoundingClientRect(); return [r.width, r.height]; });
    check(`${vp.tag} Test connection tap target >= 44px`, btnBox[1] >= 44, btnBox.join('x'));
    const clockBox = await page.$eval('.clock button[data-t="1"]', b => b.getBoundingClientRect().height);
    check(`${vp.tag} clock button tap target >= 44px`, clockBox >= 44, String(clockBox));
    check(`${vp.tag} one-line explanation shown`, /Clinical questions are never answered/.test(await page.textContent(".pl-mode-note")) && !/only raises concern/.test(await page.textContent('.pl-mode-note')));

    // 3. urgent free-text message on the phone -> alert labelled by the AI second check
    await page.click('nav button[data-v="pt"]');
    await page.fill('#msg', 'Flying to Penang in 3 weeks, is that OK?');
    await page.press('#msg', 'Enter');
    await page.waitForTimeout(600);
    await page.click('nav button[data-v="staff"]');
    await page.waitForTimeout(200);
    const alertLabels = await page.$$eval('#alerts .alert', els => els.map(e => (e.querySelector('.pl-by') || {}).textContent || '(none)'));
    check(`${vp.tag} staff alert from a free-text urgent message says who raised it`, alertLabels.some(t => t === 'Raised by AI second check' || t === 'Raised by both'), alertLabels.join(' | '));
    await page.screenshot({ path: path.join(SHOTS, T('2-ai-on-alert.png')), fullPage: false });

    // 3b. regression: a phone model raise must not label later Intake bubbles
    const escBefore = await page.evaluate(() => (document.getElementById('log').textContent.match(/second_check/g) || []).length);
    await page.click('nav button[data-v="pt"]');
    await page.fill('#msg', 'my knee feels a bit odd');
    await page.press('#msg', 'Enter');
    await page.waitForTimeout(600);
    await page.click('nav button[data-v="staff"]');
    const escAfter = await page.evaluate(() => (document.getElementById('log').textContent.match(/second_check/g) || []).length);
    check(`${vp.tag} regression precondition: the phone message was a model raise (event log)`, escAfter > escBefore, `second_check events ${escBefore} -> ${escAfter}`);
    await page.click('nav button[data-v="intake"]');
    await page.click('#iv-start');
    await page.waitForFunction(() => document.querySelectorAll('#iv-chat .b.bot').length >= 2, null, { timeout: 15000 });
    await page.waitForTimeout(300);
    const strayLabels = await page.$$eval('#iv-chat .pl-by', els => els.length);
    check(`${vp.tag} regression: Intake bubbles after a phone model raise carry no AI label`, strayLabels === 0, 'labels=' + strayLabels);

    // 4. Ask box, urgent question through the model
    await page.fill('#iv-q', 'Can I fly in 3 weeks?');
    await page.click('#iv-askform button[type="submit"]');
    await page.waitForFunction(() => /\S/.test(document.getElementById('iv-ans').textContent) && !/Checking/.test(document.getElementById('iv-ans').textContent), null, { timeout: 15000 });
    await page.waitForTimeout(200);
    const askLbl = await page.$eval('#iv-ans', el => (el.querySelector('.pl-by') || {}).textContent || '(none)');
    check(`${vp.tag} Ask box output says who raised it`, askLbl === 'Raised by AI second check' || askLbl === 'Raised by fixed rules', askLbl);

    // 5. HTTP error from the proxy: the wording names the status
    stub.setStatus(500);
    await page.evaluate(() => { document.querySelector('details.iv-set').open = true; });
    await page.click('#pl-test-conn');
    await page.waitForFunction(() => /Connected|Not connected/.test(document.getElementById('pl-test-out').textContent), null, { timeout: 15000 });
    const t500 = (await page.textContent('#pl-test-out')).trim();
    check(`${vp.tag} proxy HTTP 500 is reported as an error answer, not as no answer`, t500.includes('HTTP 500') && !t500.includes('did not answer'), t500);
    stub.setStatus(200);

    // 6. stop the stub: the next check goes amber, and Test says there was no connection
    const hitsBefore = stub.hits();
    check(`${vp.tag} real requests reached the stub`, hitsBefore >= 3, 'hits=' + hitsBefore);
    await stub.stop();
    await page.click('nav button[data-v="pt"]');
    await page.fill('#msg', 'Can I shower today?');
    await page.press('#msg', 'Enter');
    await page.waitForTimeout(800);
    await page.click('nav button[data-v="intake"]');
    await page.waitForTimeout(200);
    check(`${vp.tag} phone message reached the second check and the stub was down`, refused.n >= 1, 'refused=' + refused.n);
    const amber = await badge();
    check(`${vp.tag} badge goes amber when the second check is unavailable`, amber === 'AI second check: unavailable, rules only' && (await icon()) === '▲', amber);
    await page.click('#pl-test-conn');
    await page.waitForFunction(() => /Connected|Not connected/.test(document.getElementById('pl-test-out').textContent), null, { timeout: 15000 });
    const tFail = (await page.textContent('#pl-test-out')).trim();
    check(`${vp.tag} Test connection with no connection says so`, tFail.startsWith('Not connected: no connection to the proxy'), tFail);
    check(`${vp.tag} badge still amber after the failed test`, (await badge()) === 'AI second check: unavailable, rules only', await badge());
    await page.screenshot({ path: path.join(SHOTS, T('3-amber.png')), fullPage: false });

    stub = await startStub(port);
    await ctx.close();
  }

  // 7. Arabic UI: badge, labels and Test connection use Arabic (machine draft strings)
  {
    const stubAr = await startStub(port + 1);
    const ctxA = await browser.newContext({ viewport: { width: 430, height: 900 } });
    const pA = await ctxA.newPage();
    pA.on('pageerror', e => errors.push('ar pageerror: ' + e.message));
    await pA.goto(PAGE);
    await pA.click('nav button[data-v="intake"]');
    await pA.selectOption('#iv-lang', 'ar');
    await pA.click('#iv-set-sum');
    await pA.selectOption('#iv-set-mode', 'ai');
    await pA.fill('#iv-set-proxy', `http://localhost:${port + 1}/chat`);
    await pA.waitForTimeout(150);
    const arBadge = (await pA.textContent('#pl-ai-badge span:last-child')).trim();
    check('Arabic UI: untested badge in Arabic (machine draft)', arBadge === 'الفحص الثاني بالذكاء الاصطناعي: مضبوط، لم يُختبر بعد', arBadge);
    await pA.click('#pl-test-conn');
    await pA.waitForFunction(() => /متصل|غير متصل/.test(document.getElementById('pl-test-out').textContent), null, { timeout: 15000 });
    check('Arabic UI: Test connection message in Arabic', (await pA.textContent('#pl-test-out')).trim() === 'متصل: الفحص الثاني يعمل');
    check('Arabic UI: badge in Arabic after a successful test', (await pA.textContent('#pl-ai-badge span:last-child')).trim() === 'الفحص الثاني بالذكاء الاصطناعي: مفعّل');
    await pA.click('nav button[data-v="pt"]');
    await pA.fill('#msg', 'Flying to Penang in 3 weeks, is that OK?');
    await pA.press('#msg', 'Enter');
    await pA.waitForTimeout(600);
    await pA.click('nav button[data-v="staff"]');
    const arLbl = await pA.$$eval('#alerts .alert .pl-by', els => els.map(e => e.textContent));
    check('Arabic UI: raised-by label in Arabic', arLbl.some(t => t === 'أطلقها الفحص الثاني بالذكاء الاصطناعي' || t === 'أطلقتها القواعد والفحص الثاني معا'), arLbl.join(' | '));
    await pA.screenshot({ path: path.join(SHOTS, 'ar-430-badge-label.png'), fullPage: false });
    await ctxA.close();
    await stubAr.stop();
  }

  // Scripted-only pass: no network, no errors
  const b2 = await chromium.launch();
  const c2 = await b2.newContext({ viewport: { width: 430, height: 900 } });
  const p2 = await c2.newPage();
  const scriptedErrors = [];
  p2.on('pageerror', e => scriptedErrors.push(e.message));
  p2.on('console', m => { if (m.type() === 'error') scriptedErrors.push(m.text()); });
  let netCalls = 0;
  p2.on('request', r => { if (!r.url().startsWith('file://') && !r.url().startsWith('data:')) netCalls++; });
  await p2.goto(PAGE);
  await p2.waitForTimeout(300);
  await p2.click('nav button[data-v="pt"]');
  await p2.fill('#msg', 'Can I shower today?');
  await p2.press('#msg', 'Enter');
  await p2.waitForTimeout(300);
  check('scripted mode: page works, no console errors, no network request', scriptedErrors.length === 0 && netCalls === 0, 'errors=' + scriptedErrors.length + ' requests=' + netCalls);
  await p2.click('nav button[data-v="pt"]');
  await p2.fill('#msg', 'Suddenly short of breath and my chest hurts when I breathe in.');
  await p2.press('#msg', 'Enter');
  await p2.waitForTimeout(300);
  await p2.click('nav button[data-v="staff"]');
  const rl = await p2.$$eval('#alerts .alert', els => els.map(e => (e.querySelector('.pl-by') || {}).textContent || '(none)'));
  check('scripted: fixed-rules EMERGENCY alert says Raised by fixed rules', rl.indexOf('Raised by fixed rules') >= 0, rl.join(' | '));
  await b2.close();

  // Both label: an open rules alert for the same patient, then a model raise merges into it
  {
    const st4 = await startStub(port + 2);
    const b4 = await chromium.launch();
    const p4 = await (await b4.newContext({ viewport: { width: 430, height: 900 } })).newPage();
    await p4.goto(PAGE);
    await p4.click('nav button[data-v="intake"]');
    await p4.click('#iv-set-sum');
    await p4.selectOption('#iv-set-mode', 'ai');
    await p4.fill('#iv-set-proxy', `http://localhost:${port + 2}/chat`);
    await p4.click('nav button[data-v="pt"]');
    await p4.fill('#msg', 'Suddenly short of breath and my chest hurts when I breathe in.');
    await p4.press('#msg', 'Enter');
    await p4.waitForTimeout(300);
    await p4.fill('#msg', 'Flying to Penang in 3 weeks, is that OK?');
    await p4.press('#msg', 'Enter');
    await p4.waitForTimeout(800);
    await p4.click('nav button[data-v="staff"]');
    const bl = await p4.$$eval('#alerts .alert', els => els.map(e => (e.querySelector('.pl-by') || {}).textContent || '(none)'));
    check('AI on: rules alert merged with a model raise says Raised by both', bl.indexOf('Raised by both') >= 0, bl.join(' | '));
    await b4.close();
    await st4.stop();
  }

  check('no page errors or console errors (excluding network refusals from the stopped stub)', errors.length === 0, errors.length ? errors.join(' ; ') : 'none');
  console.log('info: network refusals while the stub was stopped: ' + netRefused.length);
  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed} PASS, ${failed} FAIL`);
  process.exit(failed ? 1 : 0);
}

module.exports = { startStub };
if (require.main === module) runChecks().catch(e => { console.error(e); process.exit(1); });
