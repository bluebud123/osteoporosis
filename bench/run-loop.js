/*
 * Loop scenario tests: drive the real app (index.html + src/rules.js) in jsdom and check
 * the guarantees the flow promises. Writes bench/results/loop.md. Exit code 1 on any failure.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const APP = path.resolve(__dirname, '..', 'index.html');

function boot() {
  return new Promise((resolve) => {
    const html = fs.readFileSync(APP, 'utf8').replace(/<link[^>]+fonts\.googleapis[^>]*>/g, '');
    const vc = new VirtualConsole(); vc.on('jsdomError', e => console.error('page error:', e.message));
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'file://' + APP, pretendToBeVisual: true, virtualConsole: vc });
    dom.window.scrollTo = () => {};
    dom.window.addEventListener('load', () => {
      const d = dom.window.document, W = dom.window;
      const q = s => d.querySelector(s);
      const click = s => { const e = q(s); if (!e) throw new Error('missing element ' + s); e.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };
      const set = (s, v, ev) => { const e = q(s); if (!e) throw new Error('missing element ' + s); if (e.type === 'checkbox' || e.type === 'radio') e.checked = v; else e.value = v; e.dispatchEvent(new W.Event(ev || 'change', { bubbles: true })); };
      const text = () => q('#view').textContent.replace(/\s+/g, ' ');
      const open = id => { click('[data-tab="board"]'); click(`[data-open="${id}"]`); };
      resolve({ q, click, set, text, open });
    });
  });
}

const tests = [
  ['L01', 'Full journey closes only with evidence', 'Req 1, 5', async () => {
    const a = await boot(); a.open('C-1042');
    a.click('[data-a="topatient"]'); a.click('[data-tb="0"]'); a.click('[data-a="ack"]'); a.click('[data-tab="case"]');
    a.click('[data-a="order"]'); a.click('[data-a="results"]'); a.click('[data-a="decide"]');
    a.set('input[name="rx-C-1042"][value="teri"]', true); a.set('#sg', 'Dr Tan', 'input'); a.click('[data-a="sign"]'); a.click('[data-a="dispense"]');
    a.set('[data-f="adh"]', true); a.set('[data-f="btm"]', true); a.click('[data-a="follow"]');
    a.set('[data-f="dxa"]', true); a.click('[data-a="close"]');
    return /Closed day 0/.test(a.text()) && /Evidence: dispensing record, adherence check, repeat DXA booked/.test(a.text());
  }],
  ['L02', 'Closure gate refuses a case with incomplete evidence', 'Req 5', async () => {
    const a = await boot(); a.open('C-1018');                       // Salma, at follow-up
    a.set('[data-f="adh"]', true); a.set('[data-f="btm"]', true); a.click('[data-a="follow"]');
    a.click('[data-a="close"]');                                     // no repeat DXA booked
    return /Closure refused/.test(a.text()) && !/Closed day/.test(a.text());
  }],
  ['L03', 'Overdue stage is alerted and pinned', 'Req 2', async () => {
    const a = await boot();
    const pinned = a.text().split('On track')[0];
    a.open('C-1031');                                                // Aisha, DXA stage open 44 days > 30-day clock
    return /Aisha K\./.test(pinned) && /past its 30-day clock\. Owner alerted: Dr Lim/.test(a.text()) && /Overdue/.test(a.text());
  }],
  ['L04', 'Second missed clock escalates to programme lead', 'Req 2, 5', async () => {
    const a = await boot(); a.click('#adv'); a.click('#adv'); a.click('#adv'); // +21 days → 65 > 2 × 30
    a.open('C-1031');
    return /Escalated to programme lead/.test(a.text());
  }],
  ['L05', 'Unassigned case is pinned and cannot progress until someone owns it', 'Req 2', async () => {
    const a = await boot();
    const pinned = a.text().split('On track')[0];
    a.open('C-1047');                                                // Nora, no GP
    const blocked = !a.q('[data-a="sms"]') && /Unassigned/.test(a.text());
    a.click('[data-a="assign"]');
    return /Nora H\./.test(pinned) && blocked && !!a.q('[data-a="sms"]') && /Ownership taken by Dr Tan/.test(a.text());
  }],
  ['L06', 'Rejected referral keeps the GP as owner and offers reroute', 'Req 2, 4', async () => {
    const a = await boot(); a.open('C-1029');                        // Fatima
    return /You stay owner/.test(a.text()) && !!a.q('[data-a="reroute"]') && /Dr Tan/.test(a.text());
  }],
  ['L07', 'Rejection from the specialist inbox lands back on the GP board', 'Req 4', async () => {
    const a = await boot(); a.open('C-1042');
    a.click('[data-a="topatient"]'); a.click('[data-tb="0"]'); a.click('[data-a="ack"]'); a.click('[data-tab="case"]');
    a.click('[data-a="order"]'); a.click('[data-a="results"]'); a.click('[data-a="econsult"]');
    a.click('[data-tab="specialist"]'); a.click('[data-a="reject"][data-c="C-1042"]');
    a.click('[data-tab="board"]');
    const pinned = a.text().split('On track')[0];
    return /Mariam A\./.test(pinned) && /Referral rejected/.test(pinned);
  }],
  ['L08', 'Wrong teach-back blocks progress until a nurse call', 'Req 3', async () => {
    const a = await boot(); a.open('C-1042');
    a.click('[data-a="topatient"]'); a.click('[data-tb="2"]'); a.click('[data-a="ack"]'); a.click('[data-tab="case"]');
    const held = /Nurse call task created/.test(a.text()) && !a.q('[data-a="order"]');
    a.click('[data-a="nurse"]');
    return held && !!a.q('[data-a="order"]');
  }],
  ['L09', 'Declining requires a reason and a signer, and counts as a drop-off', 'Req 5, 6', async () => {
    const a = await boot(); a.open('C-1042');
    a.click('[data-a="drop"]'); a.set('#dr', 'Fear of medication side effects'); a.set('#drb', 'Dr Tan', 'input'); a.click('[data-a="drop-ok"]');
    const closed = /Closed day 0/.test(a.text());
    a.click('[data-tab="health"]');
    return closed && /Fear of medication side effects\s*2/.test(a.text());
  }],
  ['L10', 'Every open case has an owner or is pinned as unassigned', 'Req 2', async () => {
    const a = await boot();
    const rows = [...a.q('#view').querySelectorAll('.case-row')];
    return rows.every(r => !/no owner/.test(r.textContent) || r.dataset.sev === 'crit');
  }],
  ['L11', 'Very-high-risk case shows the 6-week fast-track', 'Req 5', async () => {
    const a = await boot(); a.open('C-1042');
    a.click('[data-a="topatient"]'); a.click('[data-tb="0"]'); a.click('[data-a="ack"]'); a.click('[data-tab="case"]');
    return /fast-track DXA within 6 weeks/.test(a.text());
  }],
  ['L12', 'Treatment cannot be signed without a named prescriber', 'Req 5', async () => {
    const a = await boot(); a.open('C-1042');
    a.click('[data-a="topatient"]'); a.click('[data-tb="0"]'); a.click('[data-a="ack"]'); a.click('[data-tab="case"]');
    a.click('[data-a="order"]'); a.click('[data-a="results"]'); a.click('[data-a="decide"]');
    a.set('input[name="rx-C-1042"][value="teri"]', true);
    const disabledNoName = a.q('[data-a="sign"]').disabled;
    a.set('#sg', 'Dr Tan', 'input');
    return disabledNoName && !a.q('[data-a="sign"]').disabled;
  }]
];

(async () => {
  const out = []; let fails = 0;
  for (const [id, name, req, fn] of tests) {
    let ok = false, err = '';
    try { ok = await fn(); } catch (e) { err = e.message; }
    if (!ok) fails++;
    out.push({ id, name, req, ok, err });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${name}${err ? ' — ' + err : ''}`);
  }
  const md = ['# Loop scenario results', '', `Passed **${out.length - fails}/${out.length}**. Each test drives the real app (index.html) headless and checks one guarantee.`, '',
    '| ID | Guarantee | Official requirement | Result |', '| --- | --- | --- | --- |',
    ...out.map(r => `| ${r.id} | ${r.name} | ${r.req} | ${r.ok ? 'PASS' : '**FAIL**' + (r.err ? ' (' + r.err + ')' : '')} |`)];
  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'results', 'loop.md'), md.join('\n') + '\n');
  console.log(`\nloop ${out.length - fails}/${out.length}`);
  process.exitCode = fails ? 1 : 0;
})();
