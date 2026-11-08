/* Browser checks for the judge round 1 fixes (P0-2, P1-1, P1-2, P1-4, P1-5, P1-6). Usage: node build.js && node s1.check.js
   A local stub proxy answers the second check: urgent only when the text mentions Penang, routine otherwise. Fictional data only. */
'use strict';
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

function startStub(port) {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type'); res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    let body = ''; req.on('data', c => { body += c; });
    req.on('end', () => {
      const urgent = /penang/i.test(body);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ text: JSON.stringify({ verdict: urgent ? 'urgent' : 'routine', reason: 'x' }) }));
    });
  });
  return new Promise(r => server.listen(port, () => r({ stop: () => new Promise(x => server.close(() => x())) })));
}
(async () => {
  const PAGE = 'file://' + path.join(__dirname, 'index.html');
  const results = [];
  const check = (n, ok, d) => { results.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? '  [' + d + ']' : '')); };
  const port = 8900 + Math.floor(Math.random() * 300);
  const stub = await startStub(port);
  const b = await chromium.launch();
  const errors = [];
  const newPage = async (vp) => { const p = await (await b.newContext({ viewport: vp || { width: 390, height: 700 } })).newPage(); p.on('pageerror', e => errors.push(e.message)); await p.goto(PAGE); return p; };
  const botLast = p => p.evaluate(() => { const x = document.querySelectorAll('#iv-chat .b.bot'); return x.length ? x[x.length - 1].textContent : ''; });
  const tasks = (p, re) => p.evaluate(r => window.PeriHooks.sim().tasks.filter(t => new RegExp(r).test(t.type)).map(t => ({ type: t.type, owner: t.owner, due: t.dueAt, now: window.PeriHooks.sim().now })), re);
  // answer chips (first non-unknown, non-yes) until the text-question or a stop text
  async function walkUntil(p, stopRe, maxSteps) {
    for (let k = 0; k < (maxSteps || 80); k++) {
      const q = await botLast(p);
      if (stopRe.test(q)) return q;
      const chips = await p.evaluate(() => Array.from(document.querySelectorAll('#iv-chips button')).map(x => x.getAttribute('data-in-val') || x.textContent));
      if (!chips.length) { const done = await p.evaluate(() => !!document.querySelector('#iv-sum .in-banner')); if (done) return q; await p.fill('#iv-in', 'none'); await p.press('#iv-in', 'Enter'); await p.waitForTimeout(60); continue; }
      const i = chips.findIndex(c => c !== 'unknown' && !/yes/i.test(c));
      await p.click('#iv-chips button >> nth=' + Math.max(0, i)); await p.waitForTimeout(40);
    }
    return null;
  }

  // ---- P0-2: Not sure on the chest-pain question ----
  {
    const p = await newPage();
    await p.click('nav button[data-v="intake"]'); await p.click('#iv-start'); await p.waitForTimeout(100);
    const q = await walkUntil(p, /chest pain, trouble breathing/);
    check('P0-2 reached the chest pain question', !!q);
    const before = await tasks(p, '^red_unknown_');
    await p.click('#iv-chips button[data-in-val="unknown"]'); await p.waitForTimeout(200);
    const tail = await p.evaluate(() => Array.from(document.querySelectorAll('#iv-chat .b.bot')).slice(-2).map(x => x.textContent));
    check('P0-2 a safety-net bubble appears right after the tap', /call 999\/998 or go to the nearest emergency department/.test(tail[0] || '') && /You were not sure/.test(tail[0] || ''), tail[0]);
    check('P0-2 the interview goes on with the next question (not stopped, not RED)', !/Who will help you at home|\?/.test('') && /\?/.test(tail[1] || '') && !(await p.evaluate(() => !!document.querySelector('#iv-red .in-red'))), tail[1]);
    const t1 = await tasks(p, '^red_unknown_');
    check('P0-2 exactly one same-day clinician task, due now', before.length === 0 && t1.length === 1 && t1[0].owner === 'clinician' && t1[0].type === 'red_unknown_symptoms_now' && t1[0].due <= t1[0].now, JSON.stringify(t1));
    check('P0-2 amber note in #iv-red', /AMBER: red-flag question not answered, clinician to confirm today/.test(await p.textContent('#iv-red')));
    check('P0-2 no alert was raised (never RED)', (await p.evaluate(() => window.PeriHooks.sim().alerts.length)) === 0);
    await walkUntil(p, /^$never/);
    await p.waitForTimeout(200);
    const banner = await p.evaluate(() => (document.querySelector('#iv-sum .in-banner') || {}).textContent || '');
    check('P0-2 the end summary still shows AMBER', /AMBER/.test(banner), banner.slice(0, 80));
    const sendBtn = await p.$('#iv-sum [data-in-act="send"]');
    if (sendBtn) { await sendBtn.click(); await p.waitForTimeout(200); }
    const t2 = await tasks(p, '^red_unknown_');
    check('P0-2 Send to Staff board does not duplicate the task', !!sendBtn && t2.length === 1, JSON.stringify(t2) + ' btn=' + !!sendBtn);
    await p.screenshot({ path: path.join(__dirname, '..', 's1_evidence', 'idk_after.png') });
  }

  // ---- AI mode scenarios ----
  {
    const p = await newPage();
    await p.click('nav button[data-v="intake"]');
    await p.evaluate(() => { document.querySelector('details.iv-set').open = true; });
    await p.selectOption('#iv-set-mode', 'ai'); await p.fill('#iv-set-proxy', `http://localhost:${port}/chat`);
    await p.waitForTimeout(100);
    check('P1-4 badge says "set, not tested" before any check', (await p.textContent('#pl-ai-badge')).trim().indexOf('AI second check: set, not tested') >= 0, (await p.textContent('#pl-ai-badge')).trim());
    await p.click('#iv-start'); await p.waitForTimeout(100);
    // text question: a medicine list
    await walkUntil(p, /medicine|medication|tablet/i, 60);
    const qMed = await botLast(p);
    const chipsNow = await p.evaluate(() => document.querySelectorAll('#iv-chips button').length);
    await p.fill('#iv-in', 'metformin and paracetamol'); await p.press('#iv-in', 'Enter');
    await p.waitForFunction(() => !/Checking/.test(document.getElementById('iv-hint').textContent), null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(300);
    const lastBubbles = await p.evaluate(() => Array.from(document.querySelectorAll('#iv-chat > *')).slice(-3).map(x => x.textContent));
    const pq = await tasks(p, '^patient_q_|^second_check_unscreened');
    check('P1-1 a medicine-list answer in AI mode is a recorded answer: no "passed your question", no patient_q task', !lastBubbles.some(t => /passed your question|clinician will reply/i.test(t)) && pq.length === 0, JSON.stringify(lastBubbles).slice(0, 240) + ' tasks=' + pq.length + ' q=' + qMed.slice(0, 50) + ' chips=' + chipsNow);
    check('P1-4 badge is "on" after a successful second check', (await p.textContent('#pl-ai-badge')).trim().indexOf('AI second check: on') >= 0, (await p.textContent('#pl-ai-badge')).trim());
    // a real question typed as an answer still goes to staff
    const q2 = await walkUntil(p, /blood thinner|blood-thinner|anticoag/i, 60);
    const chips2 = await p.evaluate(() => document.querySelectorAll('#iv-chips button').length);
    // find the next text prompt and ask a clinical question
    for (let k = 0; k < 60 && (await p.evaluate(() => document.querySelectorAll('#iv-chips button').length)); k++) { await p.click('#iv-chips button >> nth=0'); await p.waitForTimeout(40); }
    const hasText = !(await p.evaluate(() => document.getElementById('iv-in').disabled)) && !(await p.evaluate(() => !!document.querySelector('#iv-sum .in-banner')));
    if (hasText) {
      await p.fill('#iv-in', 'Can I stop my blood thinner before surgery?'); await p.press('#iv-in', 'Enter');
      await p.waitForFunction(() => !/Checking/.test(document.getElementById('iv-hint').textContent), null, { timeout: 20000 }).catch(() => {});
      await p.waitForTimeout(300);
      const pq2 = await tasks(p, '^patient_q_|intake_q_');
      const bub = await p.evaluate(() => Array.from(document.querySelectorAll('#iv-chat > *')).slice(-3).map(x => x.textContent).join(' | '));
      check('P1-1 a real clinical question typed in AI mode still reaches staff', pq2.length >= 1 || /passed your question/i.test(bub), bub.slice(0, 200) + ' tasks=' + pq2.length);
    } else check('P1-1 a real clinical question typed in AI mode still reaches staff', false, 'no text prompt found ' + q2 + chips2);
    // restart for P1-2: urgent second check on a text answer
    await p.click('#iv-start'); await p.waitForTimeout(100);
    await walkUntil(p, /medicine|medication|tablet/i, 60);
    await p.fill('#iv-in', 'Flying to Penang in 3 weeks, is that OK?'); await p.press('#iv-in', 'Enter');
    await p.waitForFunction(() => !/Checking/.test(document.getElementById('iv-hint').textContent), null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(400);
    const labels = await p.$$eval('#iv-chat .pl-by', e => e.map(x => x.textContent));
    const bots = await p.$$eval('#iv-chat .b.bot', e => e.map(x => x.textContent.slice(0, 70)));
    check('P1-2 exactly one "Raised by AI second check" label, on the same-day reply only', labels.length === 1 && labels[0] === 'Raised by AI second check' && !/Raised by/.test(bots[bots.length - 1] || ''), labels.join('|') + ' / last=' + (bots[bots.length - 1] || ''));
    await p.screenshot({ path: path.join(__dirname, '..', 's1_evidence', 'ai_intake_390.png') });
    // phone: thanks
    await p.click('nav button[data-v="pt"]');
    const a0 = await p.evaluate(() => window.PeriHooks.sim().alerts.length);
    await p.fill('#msg', 'thanks'); await p.press('#msg', 'Enter'); await p.waitForTimeout(500);
    const chat = await p.textContent('#chat'); const a1 = await p.evaluate(() => window.PeriHooks.sim().alerts.length);
    const last = await p.evaluate(() => { const x = document.querySelectorAll('#chat .b.bot'); return x[x.length - 1].textContent; });
    check('P1-6 "thanks" on the phone: no alert and no "A clinician will reply"', a1 === a0 && !/A clinician will reply/.test(last), last);
    await p.close();
  }

  // ---- P1-5: the tour restores the visitor's settings ----
  {
    const p = await newPage();
    await p.click('#tour-start'); await p.waitForTimeout(150);
    for (let i = 0; i < 4; i++) { await p.click('.tour-next'); await p.waitForTimeout(100); }
    await p.selectOption('#iv-set-mode', 'ai'); await p.fill('#iv-set-proxy', 'http://localhost:8787');
    await p.waitForTimeout(150);
    check('P1-5 step 5 now asks for Test connection and does not tick before it', !(await p.evaluate(() => window.PeriTour.state().done[4])), JSON.stringify(await p.evaluate(() => window.PeriTour.state())));
    await p.click('#pl-test-conn'); await p.waitForFunction(() => /Connected|Not connected/.test(document.getElementById('pl-test-out').textContent), null, { timeout: 15000 });
    await p.waitForTimeout(700);
    check('P1-5 step 5 ticks after the Test connection result', await p.evaluate(() => !!window.PeriTour.state().done[4]));
    check('P1-4 badge is amber/unavailable after a failed test', /unavailable, rules only/.test(await p.textContent('#pl-ai-badge')), (await p.textContent('#pl-ai-badge')).trim());
    await p.click('.tour-next'); await p.waitForTimeout(150);
    check('P1-5 step 6 says Settings are still on AI when they are', /still has Mode on AI via proxy/.test(await p.textContent('.tour-intro')), await p.textContent('.tour-intro'));
    await p.click('.tour-close'); await p.waitForTimeout(200);
    const m = await p.inputValue('#iv-set-mode'), u = await p.inputValue('#iv-set-proxy');
    check('P1-5 closing the tour restores Scripted and an empty proxy URL', m === 'scripted' && u === '', m + ' / ' + u);
    check('P1-5 the badge is back to Rules only (no AI)', (await p.textContent('#pl-ai-badge')).trim().indexOf('Rules only (no AI)') >= 0, (await p.textContent('#pl-ai-badge')).trim());
    // a visitor who was already in AI mode keeps it
    await p.selectOption('#iv-set-mode', 'ai'); await p.fill('#iv-set-proxy', `http://localhost:${port}/chat`);
    await p.click('#tour-start'); await p.waitForTimeout(150);
    await p.click('.tour-back'); await p.waitForTimeout(150);
    await p.selectOption('#iv-set-mode', 'scripted');
    await p.click('.tour-close'); await p.waitForTimeout(200);
    check('P1-5 a visitor who started in AI mode gets AI mode back', (await p.inputValue('#iv-set-mode')) === 'ai' && (await p.inputValue('#iv-set-proxy')).indexOf(String(port)) > 0);
    await p.close();
  }
  // ---- P1-8: one primary start button on first load ----
  {
    const p = await newPage();
    const prim = await p.$$eval('button.p', bs => bs.filter(b => b.offsetParent !== null && b.getBoundingClientRect().top < 700).map(b => b.textContent.trim()));
    check('P1-8 on first load the only visible primary button above the fold is "Start here"', prim.length === 1 && prim[0] === 'Start here', JSON.stringify(prim));
    check('P1-8 tour title carries the time estimate', (await p.evaluate(() => window.PeriTour.title)) === 'Try it yourself: 7 steps, about 3 minutes');
    await p.close();
  }
  check('no page errors', errors.length === 0, errors.join(' ; ') || 'none');
  await b.close(); await stub.stop();
  const failed = results.filter(x => !x).length;
  console.log(`\n${results.length - failed} PASS, ${failed} FAIL`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
