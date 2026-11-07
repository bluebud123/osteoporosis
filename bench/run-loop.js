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
      const ans = i => click(`[data-ans="${i}"]`);
      resolve({ q, click, set, text, open, ans });
    });
  });
}

/* Helpers for the finder and treatment scenarios. */
const card = (a, id) => [...a.q('#view').querySelectorAll('.card')].find(c => c.textContent.includes(id));
const clickEl = el => { if (!el) throw new Error('missing element in card'); el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', { bubbles: true })); };
/* R001 (incidental T8 wedge fracture, cough) opened by the finder, taken to the treatment stage. spep: 'normal' | 'abnormal' | null (not entered). */
async function vertCaseAtTreatment(spep) {
  const a = await boot(); a.click('[data-tab="find"]');
  clickEl(card(a, 'R001').querySelector('[data-a="find-open"]')); a.click('[data-open="C-2001"]');
  a.click('[data-a="topatient"]'); a.click('[data-tb="0"]'); a.click('[data-a="ack"]'); a.click('[data-tab="case"]');
  a.click('[data-a="order"]'); a.set('#r-t', '-2.8', 'input');
  if (spep) a.set('#r-spep', spep, 'change');
  a.click('[data-a="results"]'); a.click('[data-a="decide"]');
  a.set('input[name="rx-C-2001"][value="obp"]', true); a.set('#sg', 'Dr Tan', 'input');
  return a;
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
  }],
  ['L13', 'New patient screened at intake opens a loop with the right category and owner', 'Req 1, 2', async () => {
    const a = await boot(); a.click('[data-a="intake"]');
    a.set('#in-name', 'Zainab T.', 'input'); a.set('#in-age', '72', 'input');
    a.set('#in-site', 'hip'); a.set('#in-fxm', '5', 'input');
    const live = /Very high risk/.test(a.text()) && /fast-track DXA within 6 weeks/.test(a.text());
    a.click('[data-a="intake-issue"]'); a.click('[data-tab="board"]');
    const onBoard = /Zainab T\./.test(a.text());
    a.click('[data-open="C-2001"]');
    return live && onBoard && /Very high risk/.test(a.text()) && /Notify and acknowledge/.test(a.text()) && /owner Dr Tan/.test(a.text());
  }],
  ['L14', 'Below-threshold patient gets no loop and no false alarm', 'Req 1', async () => {
    const a = await boot(); a.click('[data-a="intake"]');
    a.set('#in-name', 'Rina P.', 'input'); a.set('#in-age', '56', 'input'); a.set('#in-mof', '6', 'input'); a.set('#in-hip', '0.8', 'input');
    return /Below thresholds: no loop opened/.test(a.text()) && !a.q('[data-a="intake-issue"]');
  }],
  ['L15', 'High FRAX without DXA opens a loop as "DXA needed", never as low', 'Req 1, 5', async () => {
    const a = await boot(); a.click('[data-a="intake"]');
    a.set('#in-name', 'Siti N.', 'input'); a.set('#in-age', '63', 'input'); a.set('#in-mof', '14', 'input');
    return /Not classified/.test(a.text()) && /DXA indicated/.test(a.text()) && !/Below thresholds/.test(a.text()) && !!a.q('[data-a="intake-issue"]');
  }],
  ['L16', 'Entered DXA result re-runs the category; a missing T-score is refused', 'Req 5', async () => {
    const a = await boot(); a.click('[data-a="intake"]');
    a.set('#in-name', 'Siti N.', 'input'); a.set('#in-age', '63', 'input'); a.set('#in-mof', '14', 'input');
    a.click('[data-a="intake-issue"]'); a.click('[data-open="C-2001"]');
    a.click('[data-a="topatient"]'); a.click('[data-tb="0"]'); a.click('[data-a="ack"]'); a.click('[data-tab="case"]');
    a.click('[data-a="order"]'); a.click('[data-a="results"]');
    const refused = /Enter the lowest T-score/.test(a.text());
    a.set('#r-t', '-2.8', 'input'); a.set('#r-vd', '60', 'input'); a.set('#r-egfr', '25', 'input'); a.set('#r-ca', '2.3', 'input');
    a.click('[data-a="results"]');
    const t = a.text();
    return refused && /High risk/.test(t) && /eGFR below 30/.test(t) && /Category now High/.test(t);
  }],
  ['L17', 'Patient outside the CPG population is flagged at intake', 'Req 5', async () => {
    const a = await boot(); a.click('[data-a="intake"]');
    a.set('#in-sex', 'M'); a.set('#in-name', 'Omar F.', 'input'); a.set('#in-age', '70', 'input'); a.set('#in-site', 'vert');
    return /Outside the Malaysian CPG population/.test(a.text());
  }],
  ['L18', 'Reset restores the seeded demo', 'Demo', async () => {
    const a = await boot(); a.click('[data-a="intake"]');
    a.set('#in-name', 'Zainab T.', 'input'); a.set('#in-age', '72', 'input'); a.set('#in-site', 'hip'); a.set('#in-fxm', '5', 'input');
    a.click('[data-a="intake-issue"]'); a.click('#adv'); a.click('#reset');
    return !/Zainab/.test(a.text()) && /Day 0/.test(a.q('#day').textContent) && a.q('#view').querySelectorAll('.case-row').length === 8;
  }],
  ['L19', 'Patient check-in reporting a recent fracture reaches the clinician as urgent, and is pinned until reviewed', 'Req 3, 6', async () => {
    const a = await boot(); a.open('C-1031');                        // Aisha, awaiting DXA, no treatment yet
    const catBefore = a.q('.chip').textContent;
    a.click('[data-tab="patient"]'); a.click('[data-a="ci-start"]');
    a.ans(0); a.ans(0); a.ans(0);                                   // fracture: yes, wrist, last 12 months
    [0, 1, 1, 1, 1, 1, 1].forEach(i => a.ans(i));                   // falls none, then no to the rest
    a.click('[data-wnext]'); a.click('[data-wnext]');               // skip height/weight and question
    const review = /Check your answers/.test(a.text());
    a.click('[data-a="ci-send"]');
    const urgentMsg = /emergency department/.test(a.text());
    a.click('[data-tab="board"]');
    const pinned = a.text().split('On track')[0];
    a.click('[data-open="C-1031"]');
    const card = /Patient-reported/.test(a.text()) && /fragility fracture in the last 12 months/.test(a.text());
    const catSame = a.q('.chip').textContent === catBefore;          // patient report never changes category on its own
    a.click('[data-a="ci-review"]');
    return review && urgentMsg && /Aisha K\..*Patient flag/.test(pinned) && card && catSame && /Reviewed by Dr Tan/.test(a.text());
  }],
  ['L20', 'Stopping denosumab is flagged as a rebound risk, in Arabic, shown to the clinician in English', 'Req 3, 6', async () => {
    const a = await boot(); a.open('C-1036');                        // Mei Ling, denosumab prescribed
    a.click('[data-tab="patient"]'); a.click('[data-lang="ar"]'); a.click('[data-a="ci-start"]');
    const arabic = /خلال الشهر الماضي/.test(a.text());
    a.ans(2); a.ans(1); a.click('[data-wnext]');                    // stopped; reason cost
    a.ans(3); a.click('[data-wnext]');                              // no symptoms
    a.ans(0); a.ans(1); a.ans(1); a.ans(0); a.click('[data-wnext]'); a.click('[data-a="ci-send"]');
    a.click('[data-tab="case"]');
    return arabic && /Reports stopping denosumab: rebound/.test(a.text()) && /answered in Arabic, shown in English/.test(a.text());
  }],
  ['L21', 'A seeded patient flag is pinned on the board at start', 'Req 2, 6', async () => {
    const a = await boot();
    const pinned = a.text().split('On track')[0];
    return /Salma R\..*Patient flag/.test(pinned);
  }],
  ['L22', '"Every dose" check-in can be accepted as the adherence check at follow-up', 'Req 5', async () => {
    const a = await boot(); a.open('C-1018');                        // Salma, follow-up stage, alendronate
    a.click('[data-tab="patient"]'); a.click('[data-a="ci-start"]');
    a.ans(0); a.ans(3); a.click('[data-wnext]'); a.ans(0); a.ans(1); a.ans(1); a.ans(0); a.click('[data-wnext]'); a.click('[data-a="ci-send"]');
    const calm = /Sent\. Your care team/.test(a.text());
    a.click('[data-tab="case"]'); a.click('[data-a="ci-adh"]');
    return calm && a.q('[data-f="adh"]').checked && /Adherence check accepted from patient check-in/.test(a.text());
  }],
  ['L23', 'Check-in cannot start before the patient has acknowledged the result', 'Req 3', async () => {
    const a = await boot(); a.open('C-1042'); a.click('[data-tab="patient"]');
    return !a.q('[data-a="ci-start"]') && !!a.q('[data-tb="0"]');
  }],
  ['L24', 'Case finder turns an incidental vertebral fracture in a chest X-ray report into a high-risk case when its age is unknown', 'Req 1, 2', async () => {
    const a = await boot(); a.click('[data-tab="find"]');
    const marked = /<mark>Incidental moderate wedge compression fracture of T8/.test(a.q('#view').innerHTML);
    const btn = [...a.q('#view').querySelectorAll('[data-a="find-open"]')].find(b => /R001/.test(b.closest('.card').textContent));
    btn.dispatchEvent(new (a.q('body').ownerDocument.defaultView.MouseEvent)('click', { bubbles: true }));
    const opened = /Loop opened as C-2001/.test(a.text());
    a.click('[data-open="C-2001"]');
    // Fracture age is unknown (cough, no acute wording): High, not Very high; the gap is stated in the note and log.
    return marked && opened && /Khadija M\./.test(a.text()) && /High risk/.test(a.text()) && !/Very high risk/.test(a.text())
      && /Fracture age unknown: confirm date before treating as very high risk/.test(a.text())
      && /Found by case finder \(Rules\) in CXR lateral report R001/.test(a.text());
  }],
  ['L25', 'Trauma and tumour reports are not offered as cases; AI controls are hidden outside claude.ai', 'Req 1', async () => {
    const a = await boot(); a.click('[data-tab="find"]');
    const cardOf = id => [...a.q('#view').querySelectorAll('.card')].find(c => c.textContent.includes(id));
    return !cardOf('R071').querySelector('[data-a="find-open"]') && !cardOf('R077').querySelector('[data-a="find-open"]')
      && !a.q('[data-a="find-ai"]') && /This copy shows the keyword rules only/.test(a.text());
  }],
  ['L26', 'Benchmark table shows the rules\' honest stress-set result, and Health shows the proposed indicator', 'Req 6', async () => {
    const a = await boot(); a.click('[data-tab="find"]');
    const t = a.text();
    a.click('[data-tab="health"]');
    return /Rules · Stress: unfamiliar wording \(15\)\s*33%\s*3\/12\s*6/.test(t) && /started on treatment within 6 months/.test(a.text()) && /None measures osteoporosis treatment/.test(a.text());
  }],
  ['L27', 'Finder skips a patient already on alendronate: chip shown, no primary "Open loop"', 'Req 1, 5', async () => {
    const a = await boot(); a.click('[data-tab="find"]');
    const c = card(a, 'R020'), primary = c.querySelector('button.primary');
    return /Pharmacy: on alendronate/.test(c.textContent) && primary.dataset.a === 'find-skip' && /Skip: already treated/.test(primary.textContent)
      && !c.querySelector('[data-a="find-open"].primary') && /Open anyway/.test(c.querySelector('[data-a="find-open"]').textContent);
  }],
  ['L28', 'Finder skip for a palliative patient logs status skipped with its reason and opens no case', 'Req 1', async () => {
    const a = await boot(); a.click('[data-tab="find"]');
    const c = card(a, 'R005');
    const chipShown = /Records: palliative care/.test(c.textContent) && c.querySelector('button.primary').dataset.a === 'find-skip';
    clickEl(c.querySelector('button.primary'));
    const after = card(a, 'R005');
    return chipShown && /Skipped on day 0: palliative \(Palliative care\)/.test(after.textContent)
      && !after.querySelector('[data-a="find-open"]') && !after.querySelector('[data-a="find-skip"]') && !/Loop opened/.test(a.text());
  }],
  ['L29', '"Open anyway" still opens a case for an excluded report and records the override', 'Req 1', async () => {
    const a = await boot(); a.click('[data-tab="find"]');
    clickEl(card(a, 'R020').querySelector('[data-a="find-open"]'));
    const opened = /Loop opened as C-2001/.test(a.text());
    a.click('[data-open="C-2001"]');
    return opened && /Shamsa K\./.test(a.text()) && /Opened despite records \(Alendronate, dispensed 6 weeks ago\)/.test(a.text());
  }],
  ['L30', 'Hip or pelvic fragility fracture on MRI with marrow oedema opens as very high risk', 'Req 1, 2', async () => {
    const a = await boot(); a.click('[data-tab="find"]');
    clickEl(card(a, 'R029').querySelector('[data-a="find-open"]'));
    a.click('[data-open="C-2001"]');
    return /Very high risk/.test(a.text()) && !/Fracture age unknown/.test(a.text()) && /Found by case finder \(Rules\) in MRI pelvis report R029/.test(a.text());
  }],
  ['L31', 'Abnormal electrophoresis blocks signing in a vertebral-fracture case; normal electrophoresis allows it', 'Req 5', async () => {
    const abn = await vertCaseAtTreatment('abnormal');
    const blocked = abn.q('[data-a="sign"]').disabled && /Abnormal protein electrophoresis: exclude myeloma/.test(abn.text());
    abn.click('[data-a="sign"]');                                    // a disabled button must not sign either
    const noSign = !/Prescription signed/.test(abn.text());
    const nor = await vertCaseAtTreatment('normal');
    const signable = !nor.q('[data-a="sign"]').disabled;
    nor.click('[data-a="sign"]');
    return blocked && noSign && signable && /Prescription signed by Dr Tan: Oral bisphosphonate/.test(nor.text());
  }],
  ['L32', 'Electrophoresis not yet done is a visible flag on a vertebral-fracture case, not a block', 'Req 5', async () => {
    const a = await vertCaseAtTreatment(null);
    return /Serum protein electrophoresis needed before treatment \(exclude myeloma\)/.test(a.text()) && !a.q('[data-a="sign"]').disabled;
  }],
  ['L33', 'Denosumab: dispensing sets the next dose; warn 14 days before due, overdue crit after 28 days; record dose clears it', 'Req 5, 6', async () => {
    const a = await boot(); a.open('C-1036');
    a.click('[data-a="dispense"]');                                  // due day 182
    for (let i = 0; i < 24; i++) a.click('#adv');                    // day 168: warn
    a.click('[data-tab="board"]');
    const row = () => [...a.q('#view').querySelectorAll('.case-row')].find(r => r.textContent.includes('Mei Ling'));
    const warn = /Denosumab dose due/.test(row().textContent);
    for (let i = 0; i < 7; i++) a.click('#adv');                     // day 217: 35 days overdue
    const crit = /Denosumab overdue: rebound fracture risk/.test(row().textContent) && row().dataset.sev === 'crit';
    a.open('C-1036');
    const due = /Next denosumab dose due day 182/.test(a.text());
    a.click('[data-a="deno-dose"]');                                 // dose given day 217: next due day 399
    const cleared = /Next denosumab dose due day 399/.test(a.text()) && !/Denosumab overdue/.test(a.text());
    a.click('[data-tab="board"]');
    return warn && crit && due && cleared && !/Denosumab overdue/.test(row().textContent);
  }],
  ['L34', 'A closed case with denosumab due stays pinned on the board, and recording the dose clears it', 'Req 6', async () => {
    const a = await boot();
    const pinnedText = () => a.text().split('On track')[0];
    const notYet = !/Huda M\./.test(pinnedText());                   // day 0: due day 22, warn from day 8
    a.click('#adv'); a.click('#adv');                                // day 14
    const warn = /Huda M\..*Denosumab dose due/.test(pinnedText());
    for (let i = 0; i < 6; i++) a.click('#adv');                     // day 56: 34 days overdue
    const crit = /Huda M\..*Denosumab overdue: rebound fracture risk/.test(pinnedText());
    a.open('C-1004');                                                // closed case, still visible in the case view
    a.click('[data-a="deno-dose"]');                                 // next due day 238
    a.click('[data-tab="board"]');
    const cleared = !/Huda M\./.test(pinnedText()) && /Huda M\./.test(a.text());
    return notYet && warn && crit && cleared;
  }],
  ['L35', 'Closure as treated hands the patient to long-term follow-up; Health says closed is not cured', 'Req 5, 6', async () => {
    const a = await boot(); a.open('C-1042');
    a.click('[data-a="topatient"]'); a.click('[data-tb="0"]'); a.click('[data-a="ack"]'); a.click('[data-tab="case"]');
    a.click('[data-a="order"]'); a.click('[data-a="results"]'); a.click('[data-a="decide"]');
    a.set('input[name="rx-C-1042"][value="teri"]', true); a.set('#sg', 'Dr Tan', 'input'); a.click('[data-a="sign"]'); a.click('[data-a="dispense"]');
    a.set('[data-f="adh"]', true); a.set('[data-f="btm"]', true); a.click('[data-a="follow"]');
    a.set('[data-f="dxa"]', true); a.click('[data-a="close"]');
    const fu = /Closed day 0/.test(a.text()) && /Handed to long-term follow-up: yearly check-in from day 365, repeat DXA in 2 years/.test(a.text());
    a.click('[data-tab="health"]');
    return fu && /Closed: handed to long-term follow-up/.test(a.text()) && /closed is not cured/.test(a.text());
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
