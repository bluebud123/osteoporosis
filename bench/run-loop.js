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
const feedCard = (a, id) => [...a.q('#view').querySelectorAll('.card')].find(c => c.querySelector('.rep') && c.textContent.includes(id));
const card = (a, id) => [...a.q('#view').querySelectorAll('.card')].find(c => c.textContent.includes(id));
const clickEl = el => { if (!el) throw new Error('missing element in card'); el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', { bubbles: true })); };
/* R001 (incidental T8 wedge fracture, cough) opened by the finder, taken to the treatment stage. spep: 'normal' | 'abnormal' | null (not entered). */
async function vertCaseAtTreatment(spep) {
  const a = await boot(); a.click('[data-tab="find"]');
  clickEl(card(a, 'R001').querySelector('[data-a="find-open"]')); a.click('[data-open="C-2001"]');
  a.click('[data-a="topatient"]'); a.click('[data-tb="0"]'); a.click('[data-a="ack"]'); a.click('[data-tab="case"]');
  a.click('[data-a="order"]'); a.set('#r-t', '-2.8', 'input');
  a.set('#r-vd', '80', 'input'); a.set('#r-egfr', '70', 'input'); a.set('#r-ca', '2.3', 'input');
  if (spep) a.set('#r-spep', spep, 'change');
  a.click('[data-a="results"]'); a.click('[data-a="decide"]');
  a.set('input[name="rx-C-2001"][value="obp"]', true); a.set('#sg', 'Dr Tan', 'input');
  return a;
}

/* Check-in wizard helpers. The visit section is the same in both sets and is answered by button position. */
const scaleTo = (a, n) => a.click(`[data-scale="${n}"]`);
const firstNoFracture = a => { a.ans(1); a.ans(0); a.ans(1); a.ans(1); a.ans(1); a.ans(1); a.ans(1); a.ans(1); a.click('[data-wnext]'); };  // first set: no fracture, skip height and weight
const visitAnswers = (a, o = {}) => {
  a.set('#wf-text', o.cc || 'Pain in my lower back when I stand for long', 'input'); a.click('[data-wnext]');   // chief complaint
  a.ans(o.loc ?? 2); a.ans(o.dur ?? 1);                                  // lower back, weeks
  scaleTo(a, o.pnow ?? 5); a.click('[data-wnext]');
  scaleTo(a, o.pworst ?? 7); a.click('[data-wnext]');
  a.ans(o.night ?? 1); a.ans(o.walk ?? 0);                               // no night pain, walks as usual
  (o.redf || [6]).forEach(i => a.ans(i)); a.click('[data-wnext]');       // red flags
  a.set('#wf-text', o.meds || 'Calcium and vitamin D', 'input'); a.click('[data-wnext]');
  a.click('[data-wnone]'); a.click('[data-wnext]');                      // allergies: none
  a.click('[data-wnext]');                                               // worries: skipped
};
const finishCheckin = a => { a.click('[data-wnext]'); a.click('[data-a="ci-send"]'); };   // question for the doctor: skipped

/* Boot with page globals set before the page scripts run: site overrides (built in the page's own realm, so the page
   accepts them as plain objects) and a stand-in for the claude.ai sample capability that records its calls. */
function bootWith(setup) {
  const s = setup || {};
  return new Promise((resolve) => {
    const html = fs.readFileSync(APP, 'utf8').replace(/<link[^>]+fonts\.googleapis[^>]*>/g, '');
    const vc = new VirtualConsole(); vc.on('jsdomError', e => console.error('page error:', e.message));
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'file://' + APP, pretendToBeVisual: true, virtualConsole: vc,
      beforeParse(W) {
        if (s.overrides) W.OSTEO_SITE_OVERRIDES = W.JSON.parse(JSON.stringify(s.overrides));
        if (s.claude) W.claude = s.claude();
      } });
    dom.window.scrollTo = () => {};
    dom.window.addEventListener('load', () => {
      const d = dom.window.document, W = dom.window;
      const q = sel => d.querySelector(sel);
      const click = sel => { const e = q(sel); if (!e) throw new Error('missing element ' + sel); e.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };
      const set = (sel, v, ev) => { const e = q(sel); if (!e) throw new Error('missing element ' + sel); if (e.type === 'checkbox' || e.type === 'radio') e.checked = v; else e.value = v; e.dispatchEvent(new W.Event(ev || 'change', { bubbles: true })); };
      const text = () => q('#view').textContent.replace(/\s+/g, ' ');
      const open = id => { click('[data-tab="board"]'); click(`[data-open="${id}"]`); };
      const ans = i => click(`[data-ans="${i}"]`);
      resolve({ q, click, set, text, open, ans, W, wait: ms => new Promise(r => setTimeout(r, ms)) });
    });
  });
}
/* A stand-in claude.ai sample capability: records each use and each prompt, answers with no decisions. */
const sampleMock = log => () => ({ use: async name => { log.uses.push(name); return { json: async prompt => { log.prompts.push(prompt); return []; } }; } });

/* Import helpers: report text for each route. Each builder returns a string the paste or file route reads. */
const FIX = path.resolve(__dirname, 'ingest-fixtures');
const runImport = (a, route, text) => { a.set(`[data-imp="${route}"]`, text, 'input'); a.click(`[data-a="imp-run"][data-route="${route}"]`); };
const hl7Seg = (name, fields, n) => { const f = new Array(n).fill(''); f[0] = name; fields.forEach(([i, v]) => { f[i] = v; }); return f.join('|'); };
const hl7Good = [
  'MSH|^~\\&|RIS|OSTEO-TEST|OSTEOLOOP|SYNTH|20260421093000||ORU^R01|MSG-0002|P|2.5.1',
  hl7Seg('PID', [[1, '1'], [3, 'P-200001^^^LOCAL^MR'], [5, 'SYNTH^PATIENT'], [7, '19550314'], [8, 'F']], 9),
  hl7Seg('OBR', [[1, '1'], [3, 'IMP-H1'], [4, 'XR^XR THORACIC SPINE^L'], [7, '20260421093000'], [31, 'Back pain']], 32),
  hl7Seg('OBX', [[1, '1'], [2, 'TX'], [3, 'REPORT^Report'], [5, 'Lungs are clear. Wedge compression fracture of T8 with approximately 30% anterior height loss.'], [11, 'F']], 12)
].join('\n');
const fhirGood = JSON.stringify({ resourceType: 'Bundle', type: 'collection', entry: [
  { fullUrl: 'Patient/P-300001', resource: { resourceType: 'Patient', id: 'P-300001', birthDate: '1955-03-14', gender: 'female' } },
  { resource: { resourceType: 'DiagnosticReport', id: 'IMP-F1', status: 'final', code: { text: 'CT thoracolumbar spine' }, subject: { reference: 'Patient/P-300001' },
    effectiveDateTime: '2026-02-11T08:30:00+08:00', conclusion: 'Acute-appearing compression deformity of L2 with 30% height loss.' } }] });
const csvGood = ['id,report text,age,sex,study,indication', 'IMP-C1,"Wedge compression fracture of T9 with 25% height loss. Lungs clear.",74,F,XR thoracic spine,Back pain'].join('\n');
const pasteGood = 'Id: IMP-P1\nAge: 78\nSex: F\nStudy: XR thoracic spine\nIndication: Back pain\n\nWedge compression fracture of T9 with 25% height loss.';

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
    a.click('[data-wnext]');                                        // skip height and weight
    visitAnswers(a, { redf: [6] });
    a.click('[data-wnext]');                                        // skip the question for the doctor
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
    a.ans(0); a.ans(1); a.ans(1); a.ans(0);                          // no fall, no fracture, no dental plan, calcium taken
    visitAnswers(a); finishCheckin(a);
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
    a.ans(0); a.ans(3); a.click('[data-wnext]'); a.ans(0); a.ans(1); a.ans(1); a.ans(0);
    visitAnswers(a); finishCheckin(a);
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
    return /Rules · Stress: unfamiliar wording \(15\)\s*87%\s*11\/12\s*0/.test(t) && /started on treatment within 6 months/.test(a.text()) && /None measures osteoporosis treatment/.test(a.text());
  }],
  ['L27', 'Finder: a fracture on alendronate goes to "Treatment review" (VH2), not a silent skip', 'Req 1, 5', async () => {
    const a = await boot(); a.click('[data-tab="find"]');
    const c = card(a, 'R020'), primary = c.querySelector('button.primary');
    return /Pharmacy: on alendronate/.test(c.textContent) && /Fracture while on treatment: review treatment/.test(c.textContent)
      && primary.dataset.a === 'find-open' && /Open for treatment review/.test(primary.textContent)
      && !/Skip: already treated/.test(c.textContent) && !c.querySelector('[data-a="find-skip"]') && !!c.querySelector('[data-a="find-dismiss"]');
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
  ['L29', 'Treatment review opens a very-high-risk case for a fracture on alendronate, and records the pharmacy record', 'Req 1, 5', async () => {
    const a = await boot(); a.click('[data-tab="find"]');
    clickEl(card(a, 'R020').querySelector('[data-a="find-open"]'));
    const opened = /Loop opened as C-2001/.test(a.text());
    a.click('[data-open="C-2001"]');
    return opened && /Shamsa K\./.test(a.text()) && /Very high risk/.test(a.text()) && /Fracture while on osteoporosis treatment/.test(a.text())
      && /Opened for treatment review: fracture while on treatment \(Alendronate, dispensed 6 weeks ago\)/.test(a.text());
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
  ['L32', 'Vertebral fracture with electrophoresis not done: Sign is disabled, and a reason alone is not a waiver', 'Req 5', async () => {
    const a = await vertCaseAtTreatment(null);
    const flag = /Serum protein electrophoresis needed first/.test(a.text());
    const disabled = a.q('[data-a="sign"]').disabled;
    a.set('#spep-reason', 'Patient declined the blood test', 'input');
    const reasonOnly = a.q('[data-a="sign"]').disabled && a.q('[data-a="spep-waive"]').disabled;
    return flag && disabled && reasonOnly;
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
  }],
  ['L40', 'Check-in wizard: each new control renders; the clinician summary lists red flags first and marks everything patient-reported', 'Req 3, 6', async () => {
    const a = await boot(); a.open('C-1031');
    a.click('[data-tab="patient"]'); a.click('[data-a="ci-start"]');
    firstNoFracture(a);
    visitAnswers(a, { cc: 'Dull ache across my lower back', redf: [0, 3], pnow: 9 });
    finishCheckin(a);
    a.click('[data-tab="case"]');
    const t = a.text(), flagsFirst = t.indexOf('Red flags and flags') < t.indexOf('Chief complaint');
    const urgentFirst = t.indexOf('New leg weakness or numbness: same-day') < t.indexOf('Pain 8 or more out of 10');
    return flagsFirst && urgentFirst && /Clinician summary/.test(t) && /Dull ache across my lower back/.test(t)
      && /Patient-reported/.test(t) && /Patient-reported answers never change the risk category/.test(t);
  }],
  ['L41', 'Check-in wizard in Arabic is right-to-left; the summary records the answers were given in Arabic', 'Req 5', async () => {
    const a = await boot(); a.open('C-1031');
    a.click('[data-tab="patient"]'); a.click('[data-lang="ar"]'); a.click('[data-a="ci-start"]');
    const rtl = !!a.q('.wq[dir="rtl"]') && /منذ سن الخمسين/.test(a.text());
    firstNoFracture(a);
    visitAnswers(a, { cc: 'ألم في أسفل الظهر' });
    finishCheckin(a);
    const sent = /إجاباتكم/.test(a.text());
    a.click('[data-tab="case"]');
    return rtl && sent && /answered in Arabic/.test(a.text());
  }],
  ['L42', 'Language picker offers English, العربية and Bahasa Melayu; a same-day red flag gives the Malay emergency message', 'Req 5, 6', async () => {
    const a = await boot(); a.open('C-1031');
    a.click('[data-tab="patient"]');
    const labels = [...a.q('.lang').querySelectorAll('button')].map(b => b.textContent.trim());
    const three = labels.join('|') === 'English|العربية|Bahasa Melayu';
    a.click('[data-lang="ms"]'); a.click('[data-a="ci-start"]');
    const malay = /Sejak umur 50/.test(a.text());
    firstNoFracture(a);
    visitAnswers(a, { redf: [1] });                                    // bladder or bowel change: same day
    finishCheckin(a);
    return three && malay && /Pergi ke jabatan kecemasan sekarang/.test(a.text());
  }],
  ['L43', 'Free text containing HTML or script is shown escaped on the clinician card', 'Req 4', async () => {
    const a = await boot(); a.open('C-1031');
    a.click('[data-tab="patient"]'); a.click('[data-a="ci-start"]');
    firstNoFracture(a);
    visitAnswers(a, { cc: '<img src=x onerror=alert(1)><script>alert(2)</script>' });
    finishCheckin(a);
    a.click('[data-tab="case"]');
    const html = a.q('#view').innerHTML;
    return !/<img src=x/.test(html) && !/<script>alert\(2\)/.test(html) && /&lt;script&gt;alert\(2\)/.test(html);
  }],
  ['L44', 'A 5,000-character complaint is kept to 1,000 characters and says so on the clinician card', 'Req 4', async () => {
    const a = await boot(); a.open('C-1031');
    a.click('[data-tab="patient"]'); a.click('[data-a="ci-start"]');
    firstNoFracture(a);
    visitAnswers(a, { cc: 'a'.repeat(5000) });
    finishCheckin(a);
    a.click('[data-tab="case"]');
    const t = a.text();
    return !/a{1001}/.test(t) && /cut at 1,000 characters/.test(t);
  }],
  ['L45', 'Import: a pasted report opens a finder item, unreviewed, with the keyword decision shown; the box is cleared', 'Req 1', async () => {
    const a = await boot(); a.click('[data-tab="find"]');
    runImport(a, 'paste', pasteGood);
    const c = feedCard(a, 'IMP-P1');
    return /1 report added to the case finder list, unreviewed/.test(a.text()) && !!c && /Rules: Act/.test(c.textContent)
      && /Imported patient/.test(c.textContent) && a.q('[data-imp="paste"]').value === '';
  }],
  ['L46', 'Import: a CSV pasted into the box opens a finder item', 'Req 1', async () => {
    const a = await boot(); a.click('[data-tab="find"]');
    runImport(a, 'csv', csvGood);
    const c = feedCard(a, 'IMP-C1');
    return !!c && /Rules: Act/.test(c.textContent) && /1 report added/.test(a.text());
  }],
  ['L47', 'Import: a CSV uploaded as a file runs the same import', 'Req 1', async () => {
    const a = await bootWith(); a.click('[data-tab="find"]');
    const file = new a.W.File(['id,report text,age,sex\nIMP-C2,"Wedge compression fracture of T7 with height loss.",66,F'], 'reports.csv', { type: 'text/csv' });
    const input = a.q('[data-impfile="csv"]');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new a.W.Event('change', { bubbles: true }));
    await a.wait(150);
    return /File reports\.csv\./.test(a.text()) && !!feedCard(a, 'IMP-C2');
  }],
  ['L48', 'Import: an HL7 v2 message is refused while the site profile has the route off, and opens a finder item once it is on', 'Req 1, 5', async () => {
    const a = await boot(); a.click('[data-tab="find"]');
    runImport(a, 'hl7v2', hl7Good);
    const refused = /not enabled for this site profile/.test(a.text()) && !feedCard(a, 'IMP-H1');
    a.set('#imp-demo', true, 'change');
    runImport(a, 'hl7v2', hl7Good);
    const c = feedCard(a, 'IMP-H1');
    return refused && !!c && /Rules: Act/.test(c.textContent);
  }],
  ['L49', 'Import: a FHIR bundle opens a finder item with age and sex taken from its Patient', 'Req 1', async () => {
    const a = await boot(); a.click('[data-tab="find"]'); a.set('#imp-demo', true, 'change');
    runImport(a, 'fhir', fhirGood);
    const c = feedCard(a, 'IMP-F1');
    return !!c && /70F/.test(c.textContent) && /1 report added/.test(a.text());
  }],
  ['L50', 'Import: malformed FHIR is refused with a plain error and adds nothing', 'Req 1', async () => {
    const a = await boot(); a.click('[data-tab="find"]'); a.set('#imp-demo', true, 'change');
    const before = a.q('#view').querySelectorAll('.rep').length;
    runImport(a, 'fhir', '{"resourceType": "DiagnosticReport", ');
    const after = a.q('#view').querySelectorAll('.rep').length;
    return /FHIR input is not valid JSON/.test(a.text()) && /Nothing was added/.test(a.text()) && before === after;
  }],
  ['L51', 'Import: an HL7 message cut off mid-result is held in review, never closed as no action', 'Req 1', async () => {
    const trunc = fs.readFileSync(path.join(FIX, 'hl7-05-truncated.hl7'), 'utf8');
    const a = await boot(); a.click('[data-tab="find"]'); a.set('#imp-demo', true, 'change');
    runImport(a, 'hl7v2', trunc);
    const c = feedCard(a, 'RPT-7830');
    const rep = c && c.querySelector('.rep');
    return !!rep && rep.dataset.d === 'review' && /Held for review: the message may be cut off/.test(c.textContent)
      && a.text().indexOf('RPT-7830') < a.text().indexOf('No action (')
      && /1 report added to the case finder list, unreviewed; 1 held for review/.test(a.text());
  }],
  ['L52', 'Import: a report with no age or sex is held in review, with the reason shown', 'Req 1', async () => {
    const a = await boot(); a.click('[data-tab="find"]');
    runImport(a, 'paste', 'Id: IMP-N1\n\nWedge compression fracture of T9 with 25% height loss.');
    const c = feedCard(a, 'IMP-N1');
    return !!c && c.querySelector('.rep').dataset.d === 'review' && /age unknown; sex unknown/.test(c.textContent) && /age \?/.test(c.textContent);
  }],
  ['L53', 'Import: HTML in report text is shown as text, not markup', 'Req 4', async () => {
    const a = await boot(); a.click('[data-tab="find"]');
    runImport(a, 'paste', 'Id: IMP-E1\nAge: 70\nSex: F\n\n<img src=x onerror=alert(1)>Wedge compression fracture of T5 with height loss.');
    const html = a.q('#view').innerHTML;
    return !!feedCard(a, 'IMP-E1') && !/<img src=x/.test(html) && /&lt;img src=x/.test(html) && /HTML markup in report text/.test(a.text());
  }],
  ['L54', 'Site profile: uae-doh shows the interim banner and labels the guideline as interim; my-moh shows neither', 'Req 5', async () => {
    const a = await boot();
    const ban = () => a.q('#banner').textContent.replace(/\s+/g, ' ');
    const none = ban() === '' && !/INTERIM/.test(a.text());
    a.set('#site', 'uae-doh', 'change');
    a.open('C-1031');
    return none && /Guideline for this site is an interim stand-in pending clinical sign-off/.test(ban())
      && /INTERIM stand-in: MY CPG 2022/.test(a.text()) && !/ MY CPG 2022/.test(a.text().replace(/INTERIM stand-in: MY CPG 2022/g, ''));
  }],
  ['L55', 'Site profile: switching the profile changes the stage clock shown (override on uae-doh) and the default language', 'Req 5', async () => {
    const a = await bootWith({ overrides: { 'uae-doh': { stageClocks: { '2': 21 } } } });
    a.open('C-1031');
    const before = /Day -44 · clock 30 d/.test(a.text());   // stage 2 of C-1031 started on day -44
    a.set('#site', 'uae-doh', 'change');
    a.open('C-1031');
    const after = /Day -44 · clock 21 d/.test(a.text()) && !/Day -44 · clock 30 d/.test(a.text());
    a.click('[data-tab="board"]'); a.click('[data-a="intake"]');
    const lang = a.q('#in-lang');
    return before && after && lang.value === 'ar' && [...lang.querySelectorAll('option')].map(o => o.value).join(',') === 'ar,en';
  }],
  ['L56', 'Site profile: an override that would turn off the verifier is refused, shown on screen, and the template is used', 'Req 5', async () => {
    const a = await bootWith({ overrides: { 'my-moh': { controls: { verifier: false } } } });
    const ban = a.q('#banner').textContent.replace(/\s+/g, ' ');
    a.open('C-1031');
    return /Site profile override refused/.test(ban) && /override cannot turn off verifier/.test(ban) && /clock 30 d/.test(a.text());
  }],
  ['L57', 'Residency: local-only hides the AI reader controls with the reason, and never asks for the sample capability', 'Req 5', async () => {
    const log = { uses: [], prompts: [] };
    const a = await bootWith({ claude: sampleMock(log) });
    a.click('[data-tab="find"]'); await a.wait(30);
    const hidden = !a.q('[data-a="find-ai"]') && !a.q('[data-a="bench-ai"]') && /local-only/.test(a.text()) && !a.q('#ai-demo').checked;
    const noCall = log.uses.length === 0;
    a.set('#ai-demo', true, 'change'); await a.wait(30);
    return hidden && noCall && !!a.q('[data-a="find-ai"]') && log.uses.length === 1;
  }],
  ['L58', 'Residency: with the AI reader allowed, report text is de-identified before the sample call', 'Req 5', async () => {
    const log = { uses: [], prompts: [] };
    const a = await bootWith({ claude: sampleMock(log) });
    a.click('[data-tab="find"]'); a.set('#ai-demo', true, 'change'); await a.wait(30);
    runImport(a, 'paste', 'Id: IMP-A1\nAge: 71\nSex: F\n\nDr Ahmad bin Ali reviewed on 12/03/2026. Wedge compression fracture of T9 with 25% height loss.');
    a.click('[data-a="find-ai"]'); await a.wait(60);
    const p = log.prompts.join('\n');
    return log.prompts.length === 1 && /\[NAME\]/.test(p) && /\[DATE\]/.test(p) && !/Ahmad/.test(p) && !/12\/03\/2026/.test(p) && /IMP-A1/.test(p);
  }],
  ['L59', 'FHIR export carries the active site profile as a meta tag (still SYNTHETIC); Health names the profile', 'Req 6', async () => {
    const a = await bootWith(); a.set('#site', 'uae-doh', 'change'); a.open('C-1042');
    const W = a.W; let captured = null;
    W.URL.createObjectURL = blob => { captured = blob; return 'blob:synthetic'; };
    W.URL.revokeObjectURL = () => {};
    W.HTMLAnchorElement.prototype.click = function () {};
    a.click('[data-a="fhir"]');
    if (!captured) return false;
    const text = await new Promise((res, rej) => { const fr = new W.FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsText(captured); });
    const b = JSON.parse(text), tags = (b.meta && b.meta.tag) || [];
    const prof = tags.find(t => t.system === 'urn:osteoloop:site-profile');
    a.click('[data-tab="health"]');
    return !!prof && prof.code === 'uae-doh' && tags.some(t => t.code === 'SYNTHETIC') && /Site profile: Abu Dhabi hospital, DoH context \(template\) \(uae-doh\)/.test(a.text());
  }],
  ['L60', 'Site profile: generic offers English only and says no guideline is selected', 'Req 5', async () => {
    const a = await boot(); a.set('#site', 'generic', 'change');
    const ban = a.q('#banner').textContent.replace(/\s+/g, ' ');
    a.click('[data-a="intake"]');
    const lang = a.q('#in-lang');
    return /No guideline is selected/.test(ban) && lang.value === 'en' && [...lang.querySelectorAll('option')].map(o => o.value).join(',') === 'en';
  }],
  ['L61', 'Import: a held report (no age or sex) can be opened after review; the case says age and sex are unknown', 'Req 1, 5', async () => {
    const a = await boot(); a.click('[data-tab="find"]');
    runImport(a, 'paste', 'Id: IMP-N2\n\nWedge compression fracture of T9 with 25% height loss.');
    const c = feedCard(a, 'IMP-N2'), btn = c.querySelector('[data-a="find-open"]');
    clickEl(btn);
    const opened = /Loop opened as C-2001/.test(a.text()), held = /Held for review: age unknown; sex unknown/.test(feedCard(a, 'IMP-N2').textContent);
    a.click('[data-open="C-2001"]');
    return opened && held && /Age or sex unknown in the source report: confirm before treating/.test(a.text())
      && /Found by case finder \(Rules\)/.test(a.text());
  }],
  ['L62', 'Calcium 2.10: denosumab Sign is disabled and the card says calcium is low', 'Req 5', async () => {
    const a = await boot(); a.open('C-1042');
    a.click('[data-a="topatient"]'); a.click('[data-tb="0"]'); a.click('[data-a="ack"]'); a.click('[data-tab="case"]');
    a.click('[data-a="order"]'); a.set('#r-ca', '2.10', 'input'); a.click('[data-a="results"]'); a.click('[data-a="decide"]');
    a.set('input[name="rx-C-1042"][value="deno"]', true); a.set('#sg', 'Dr Tan', 'input');
    const disabled = a.q('[data-a="sign"]').disabled;
    a.click('[data-a="sign"]');
    return disabled && /Calcium is low: correct it first/.test(a.text()) && !/Prescription signed/.test(a.text());
  }],
  ['L63', 'Calcium missing: denosumab Sign is disabled, "needs result first" is shown on the drug, and the card asks for calcium', 'Req 5', async () => {
    const a = await boot(); a.open('C-1042');
    a.click('[data-a="topatient"]'); a.click('[data-tb="0"]'); a.click('[data-a="ack"]'); a.click('[data-tab="case"]');
    a.click('[data-a="order"]'); a.set('#r-ca', '', 'input'); a.click('[data-a="results"]'); a.click('[data-a="decide"]');
    const needs = /needs result first/i.test(a.text());
    a.set('input[name="rx-C-1042"][value="deno"]', true); a.set('#sg', 'Dr Tan', 'input');
    return needs && a.q('[data-a="sign"]').disabled && /Calcium result needed first/.test(a.text());
  }],
  ['L64', 'Denosumab: vitamin D 42 keeps Sign disabled; with calcium and vitamin D in range Sign is enabled and signs', 'Req 5', async () => {
    const low = await boot(); low.open('C-1042');                    // demo values: calcium 2.31, vitamin D 42
    low.click('[data-a="topatient"]'); low.click('[data-tb="0"]'); low.click('[data-a="ack"]'); low.click('[data-tab="case"]');
    low.click('[data-a="order"]'); low.click('[data-a="results"]'); low.click('[data-a="decide"]');
    low.set('input[name="rx-C-1042"][value="deno"]', true); low.set('#sg', 'Dr Tan', 'input');
    const lowVd = low.q('[data-a="sign"]').disabled && /Vitamin D low: replete first/.test(low.text());
    const ok = await boot(); ok.open('C-1042');
    ok.click('[data-a="topatient"]'); ok.click('[data-tb="0"]'); ok.click('[data-a="ack"]'); ok.click('[data-tab="case"]');
    ok.click('[data-a="order"]'); ok.set('#r-vd', '80', 'input'); ok.click('[data-a="results"]'); ok.click('[data-a="decide"]');
    ok.set('input[name="rx-C-1042"][value="deno"]', true); ok.set('#sg', 'Dr Tan', 'input');
    const enabled = !ok.q('[data-a="sign"]').disabled;
    ok.click('[data-a="sign"]');
    return lowVd && enabled && /Prescription signed by Dr Tan: Denosumab/.test(ok.text());
  }],
  ['L65', 'Electrophoresis waiver with a reason and a named clinician lets a vertebral-fracture case sign, and is logged', 'Req 5', async () => {
    const a = await vertCaseAtTreatment(null);
    a.set('#spep-reason', 'Prior SPEP normal at another hospital (report on file)', 'input');
    a.set('#spep-by', 'Dr Tan', 'input'); a.click('[data-a="spep-waive"]');
    const signable = !a.q('[data-a="sign"]').disabled;
    a.click('[data-a="sign"]');
    return signable && /Prescription signed by Dr Tan: Oral bisphosphonate/.test(a.text())
      && /SPEP waived by Dr Tan: Prior SPEP normal at another hospital/.test(a.text());
  }],
  ['L66', 'Abnormal electrophoresis cannot be waived: no waiver control, Sign stays disabled', 'Req 5', async () => {
    const a = await vertCaseAtTreatment('abnormal');
    return !a.q('#spep-reason') && !a.q('[data-a="spep-waive"]') && a.q('[data-a="sign"]').disabled
      && /Abnormal protein electrophoresis: exclude myeloma/.test(a.text());
  }],
  ['L67', 'Intake: a DXA T-score of -2.8 with FRAX 8% and 1% is High (rule H1), not low', 'Req 1, 5', async () => {
    const a = await boot(); a.click('[data-a="intake"]');
    a.set('#in-name', 'Ruth T.', 'input'); a.set('#in-age', '62', 'input'); a.set('#in-mof', '8', 'input'); a.set('#in-hip', '1', 'input'); a.set('#in-t', '-2.8', 'input');
    const t = a.text();
    return /High risk/.test(t) && /T-score -2.5 or lower/.test(t) && !/Low risk/.test(t) && !/Below thresholds/.test(t) && !!a.q('[data-a="intake-issue"]');
  }],
  ['L68', 'Intake: a DXA T-score of -2.4 with no FRAX is "FRAX needed", not low, and opens no loop yet', 'Req 1, 5', async () => {
    const a = await boot(); a.click('[data-a="intake"]');
    a.set('#in-name', 'Ruth T.', 'input'); a.set('#in-age', '62', 'input'); a.set('#in-t', '-2.4', 'input');
    const t = a.text();
    return /FRAX needed/.test(t) && /Run FRAX/.test(t) && !/Below thresholds/.test(t) && !a.q('[data-a="intake-issue"]');
  }],
  ['L69', 'Intake: an undated vertebral fracture shows the fracture-date prompt on the result and on the case', 'Req 1, 5', async () => {
    const a = await boot(); a.click('[data-a="intake"]');
    a.set('#in-name', 'Omar V.', 'input'); a.set('#in-age', '71', 'input'); a.set('#in-site', 'vert');
    const prompt = /Fracture date needed before the risk can be fully classified/.test(a.text());
    a.click('[data-a="intake-issue"]'); a.click('[data-open="C-2001"]');
    return prompt && /Fracture date needed before the risk can be fully classified/.test(a.text());
  }],
  ['L70', 'Patient stage-1 message does not name osteoporosis before DXA, in English, Arabic and Malay', 'Req 6', async () => {
    const a = await boot(); a.open('C-1042');
    a.click('[data-tab="patient"]');
    const want = { en: 'Your doctor wants to check your bone health.', ar: 'يرغب طبيبكم في فحص صحة عظامكم.', ms: 'Doktor anda mahu memeriksa kesihatan tulang anda.' };
    const bad = { en: /weak bones|osteoporosis/i, ar: /هشاشة|ضعف العظام/, ms: /tulang yang lemah|osteoporosis/i };
    return ['en', 'ar', 'ms'].every(l => {
      a.click(`[data-lang="${l}"]`);
      return a.text().includes(want[l]) && !bad[l].test(a.text());
    });
  }],
  ['L71', 'Health: the high-risk treatment metric counts only high and very-high cases in its denominator', 'Req 6', async () => {
    const a = await boot(); a.click('[data-a="intake"]');
    a.set('#in-name', 'Siti N.', 'input'); a.set('#in-age', '63', 'input'); a.set('#in-mof', '14', 'input');   // Not classified: FRAX without DXA
    a.click('[data-a="intake-issue"]'); a.click('[data-tab="board"]');
    const rows = [...a.q('#view').querySelectorAll('.case-row')];
    const highRows = rows.filter(r => ['Very high', 'High'].includes(r.querySelector('.chip').textContent.trim())).length;
    a.click('[data-tab="health"]');
    const m = [...a.q('#view').querySelectorAll('.metric')].find(x => /High-risk patients started on treatment/.test(x.textContent));
    const denom = m ? +(m.querySelector('.n').textContent.match(/of (\d+)/) || [])[1] : -1;
    return denom === highRows && highRows > 0 && highRows < rows.length;   // the Not classified case is left out
  }],
  ['L72', 'Page declares a phone viewport and English as the document language', 'X-1', async () => {
    const a = await boot();
    const vp = a.q('meta[name="viewport"]');
    return !!vp && /width=device-width/.test(vp.getAttribute('content')) && /initial-scale=1/.test(vp.getAttribute('content')) && a.q('html').getAttribute('lang') === 'en';
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
