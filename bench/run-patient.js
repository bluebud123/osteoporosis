/*
 * Patient page tests (patient.html + src/patient-ui.js + the additive parts of src/checkin.js).
 * Browser tests run headless Chrome through Playwright at 390 px on a local static server.
 * Unit checks run in Node. Writes bench/results/patient.md. Exit code 1 on any failure.
 * Needs Playwright (global npm install) and Chrome (/usr/bin/google-chrome or CHROME_BIN).
 */
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..');
const C = require('../src/checkin.js');
const U = require('../src/patient-ui.js');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* fall through to the global install */ }
  const cp = require('child_process');
  const g = cp.execSync('npm root -g').toString().trim();
  return require(path.join(g, 'playwright'));
}

const results = [];
function record(id, name, ok, detail) { results.push({ id, name, ok, detail: detail || '' }); }

/* ---------- Node unit checks ---------- */
const unit = [];
function u(name, fn) { unit.push({ name, fn }); }

u('U01 parseHash reads code, set and lang and rejects bad values', () => {
  const a = U.parseHash('#v=C-1031&set=first&lang=ms');
  const b = U.parseHash('#v=../../etc&set=nope&lang=fr');
  const c = U.parseHash('');
  return a.code === 'C-1031' && a.set === 'first' && a.lang === 'ms' && b.code === null && b.set === null && b.lang === null && c.code === null;
});
u('U02 step order starts with who, then the set questions', () => {
  const s = U.stepIds('first', {});
  const r = U.stepIds('review', {});
  return s[0] === 'who' && s.includes('fx') && !s.includes('med') && r.includes('med') && !r.includes('fx');
});
u('U03 validateStep: text over 1,000 is blocked with the count, not cut', () => {
  const st = { answers: { cc: 'a'.repeat(1150) }, skipped: {}, who: 'me', set: 'first' };
  const v = U.validateStep('cc', st);
  return v.ok === false && v.key === 'reasonLong' && v.n === 1150;
});
u('U04 validateStep: none is exclusive data for text, skip passes required items', () => {
  const none = U.validateStep('allergy', { answers: { allergy: C.NONE }, skipped: {}, who: 'me', set: 'first' });
  const skipped = U.validateStep('cc', { answers: {}, skipped: { cc: true }, who: 'me', set: 'first' });
  const empty = U.validateStep('cc', { answers: {}, skipped: {}, who: 'me', set: 'first' });
  return none.ok && skipped.ok && !empty.ok && empty.key === 'reasonText';
});
u('U05 records: text is kept whole and overLimit lists it; flags come from checkin', () => {
  const rec = U.buildRecord({ code: 'C-1031', set: 'first', lang: 'en', answers: { cc: 'b'.repeat(1150), redf: [1], smoke: C.UNKNOWN }, skipped: { worry: true }, who: 'family', urgent: true, ts: '2026-11-07T00:00:00.000Z' });
  return rec.answers.cc.length === 1150 && rec.overLimit.join() === 'cc' && rec.urgent === true && rec.who === 'family'
    && rec.flags.some(f => f[0] === 'V-CES') && rec.flags.some(f => f[0] === 'P-UNK') && rec.skipped.join() === 'worry';
});
u('U06 outbox payload has the agreed keys and types', () => {
  const rec = U.buildRecord({ code: 'C-1031', caseId: 'C-1031', set: 'review', lang: 'ar', answers: { med: 2, sym: [3], cc: 'x' }, rx: 'obp', who: 'me', urgent: false });
  const keys = ['visit', 'caseId', 'set', 'lang', 'answers', 'flags', 'who', 'urgent', 'ts', 'skipped', 'overLimit'];
  return keys.every(k => k in rec) && typeof rec.urgent === 'boolean' && Array.isArray(rec.flags) && typeof rec.ts === 'string'
    && rec.set === 'review' && rec.lang === 'ar' && rec.flags.some(f => f[0] === 'P-STOP');
});
u('U07 outbox is capped at 50, newest kept, and a broken store returns false', () => {
  const store = {}; const mem = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
  for (let i = 0; i < 60; i++) U.pushOutbox(mem, { i });
  const arr = JSON.parse(store['osteoloop.outbox']);
  const broken = U.pushOutbox({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } }, { i: 1 });
  return arr.length === 50 && arr[0].i === 10 && arr[49].i === 59 && broken === false;
});
u('U08 status line follows the answers, not the stage', () => {
  const sent = U.statusNotes('review', { med: 0, sym: [3] }, 'en');
  const missed = U.statusNotes('review', { med: 1 }, 'en');
  const heart = U.statusNotes('review', { med: 0, sym: [0] }, 'en');
  const first = U.statusNotes('first', {}, 'en');
  const noKeep = [sent, missed, heart].every(a => !a.join(' ').includes('Keep taking'));
  return sent.length === 1 && missed.length === 2 && heart.length === 2 && first.length === 0 && noKeep;
});
u('U09 Not sure is stored as a visible unknown and listed for review', () => {
  const ans = C.normalise('first', { smoke: C.UNKNOWN, fx: C.UNKNOWN, alcohol: 1 });
  const unk = U.unknownList('first', ans, 'en');
  return ans.smoke === C.UNKNOWN && ans.fx === 2 && unk.length === 1 && unk[0].includes('smoke') || (ans.smoke === C.UNKNOWN && unk.some(q => /smoke/i.test(q)));
});
u('U10 checkin helpers: same-day check and the summary shows Not sure', () => {
  const sd = C.sameDayNow('review', { redf: [0] }, { rx: 'obp' }) === true;
  const notSd = C.sameDayNow('review', { redf: [4] }, { rx: 'obp' }) === false;
  const notSpine = C.sameDayNow('first', { redf: [3], loc: 8 }, {}) === false;
  const sum = C.summary({ checkin: { visit: 'first', answers: { smoke: C.UNKNOWN, fx: 0, fxwhen: 1, fxsite: 0, redf: [] } } });
  const shown = sum.sections.flatMap(s => s.items).some(i => i.value === 'Not sure');
  return sd && notSd && notSpine && shown;
});
u('U11 unknown is refused on questions that do not allow it', () => {
  const n = C.normalise('first', { cc: C.UNKNOWN, fxsite: C.UNKNOWN });
  return !('cc' in n) && !('fxsite' in n);
});
u('U12 hash-safe: visit codes and lang never reach the markup unescaped', () => {
  const bad = U.parseHash('#v=<img src=x onerror=alert(1)>&lang=ar');
  return bad.code === null && bad.lang === 'ar';
});

/* ---------- static server ---------- */
function serve() {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css' };
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'patient.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => srv.listen(0, '127.0.0.1', () => resolve(srv)));
}

const VISITS = { 'C-1031': { caseId: 'C-1031', rx: null, rxName: null }, 'C-1018': { caseId: 'C-1018', rx: 'obp', rxName: 'alendronate' } };

const tick = (page, sel) => page.evaluate(q => { const e = document.querySelector(q); if (!e) throw new Error('missing ' + q); if (!e.checked) e.click(); }, sel);
const TEXT_IDS = ['cc', 'curmeds', 'allergy', 'worry', 'ask'];
const DEF_FIRST = { fx: 1, falls: 0, parent: 1, steroid: 1, ra: 1, smoke: 1, alcohol: 1, shrink: 1, body: 'skip',
  cc: 'Back pain when standing', loc: 2, dur: 1, pnow: 4, pworst: 5, night: 1, walk: 0, redf: [6], curmeds: 'Calcium', allergy: 'none', worry: 'skip', ask: 'skip' };
const DEF_REVIEW = { med: 0, sym: [3], rfall: 0, rfx: 1, dental: 1, cad: 0, why: [0] };
const DEF_BY_ID = Object.assign({}, DEF_FIRST, DEF_REVIEW);

function fail(msg) { throw new Error(msg); }

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  let chromium;
  try { ({ chromium } = loadPlaywright()); } catch (e) { console.error('Playwright not available: ' + e.message); process.exit(1); }
  const exe = process.env.CHROME_BIN || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });

  const open = async (o) => {
    o = o || {};
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, locale: o.locale || 'en-GB' });
    if (o.initScript) await ctx.addInitScript(o.initScript);
    const visits = JSON.stringify(o.visits === undefined ? VISITS : o.visits);
    await ctx.addInitScript(v => { try { localStorage.setItem('osteoloop.visits', v); } catch (e) { /* storage blocked */ } }, visits);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    const hash = o.hash === undefined ? '#v=C-1031&set=first&lang=en' : o.hash;
    await page.goto(base + '/patient.html' + hash);
    await page.waitForSelector('body[data-screen]');
    return { ctx, page, errors };
  };
  const screen = page => page.getAttribute('body', 'data-screen');
  const curId = page => page.evaluate(() => { const f = document.querySelector('main [data-qid]'); return f ? f.getAttribute('data-qid') : null; });
  const h1 = page => page.textContent('main h1');
  const outbox = page => page.evaluate(() => JSON.parse(localStorage.getItem('osteoloop.outbox') || '[]'));
  const draft = (page, set) => page.evaluate(s => sessionStorage.getItem('osteoloop.draft:C-1031|' + s), set || 'first');

  async function ans(page, id, v) {
    if (v === 'skip') return page.click('#skip');
    if (v === 'none') return tick(page, '#none-' + id, { force: true });
    if (v && typeof v === 'object' && !Array.isArray(v) && 'text' in v) return page.fill('#f-' + id, v.text);
    if (v && typeof v === 'object' && !Array.isArray(v) && 'height' in v) { await page.fill('#n-height', v.height); return page.fill('#n-weight', v.weight); }
    if (Array.isArray(v)) { for (const i of v) await tick(page, 'input[name="' + id + '"][value="' + i + '"]', { force: true }); return; }
    if (typeof v === 'string' && TEXT_IDS.includes(id)) return page.fill('#f-' + id, v);
    if (typeof v === 'string') return tick(page, 'input[name="' + id + '"][value="' + v + '"]', { force: true });
    return tick(page, 'input[name="' + id + '"][value="' + v + '"]', { force: true });
  }
  // Walk the questionnaire, answering each question. Stops at review. Handles the urgent gate.
  async function walk(page, over, opts) {
    opts = opts || {};
    for (let guard = 0; guard < 80; guard++) {
      const sc = await screen(page);
      if (sc === 'gate') { await page.click('#urgent-go'); continue; }
      if (sc !== 'q') return sc;
      const id = await curId(page);
      if (opts.stopBefore && id === opts.stopBefore) return 'at';
      const v = Object.prototype.hasOwnProperty.call(over || {}, id) ? over[id] : (DEF_BY_ID[id] === undefined ? 'skip' : DEF_BY_ID[id]);
      if (v === 'skip') await page.click('#skip');
      else await ans(page, id, v);
      if (opts.stopAfter && id === opts.stopAfter) return 'stopped';
      if (await screen(page) === 'gate') continue;
      if (v !== 'skip') await page.click('#next');
    }
    fail('walk ran away');
  }
  async function startFlow(page, o) {
    o = o || {};
    await page.click('#start');
    await tick(page, 'input[name="who"][value="' + (o.who || 'me') + '"]', { force: true });
    await page.click('#next');
    return walk(page, o.over, o);
  }

  const tests = [];
  const t = (id, name, fn) => tests.push({ id, name, fn });

  /* ---------- browser tests ---------- */
  t('P01', 'viewport meta is present, lang and dir are set and switch with the language', async () => {
    const { page, ctx } = await open();
    try {
      const meta = await page.getAttribute('meta[name="viewport"]', 'content');
      if (meta !== 'width=device-width,initial-scale=1') fail('viewport meta is ' + meta);
      const en = await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir]);
      if (en.join() !== 'en,ltr') fail('en lang/dir ' + en);
      await page.click('[data-lang="ar"]');
      const ar = await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir]);
      if (ar.join() !== 'ar,rtl') fail('ar lang/dir ' + ar);
      await page.click('[data-lang="ms"]');
      const ms = await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir]);
      if (ms.join() !== 'ms,ltr') fail('ms lang/dir ' + ms);
      const hash = await page.evaluate(() => location.hash);
      if (!hash.includes('lang=ms') || !hash.includes('v=C-1031')) fail('hash after switch ' + hash);
    } finally { await ctx.close(); }
  });

  t('P02', 'no horizontal scroll at 390 px on every screen, tap targets at least 44 px', async () => {
    const { page, ctx } = await open();
    try {
      const wide = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const checkTargets = async (where) => {
        const small = await page.evaluate(() => Array.from(document.querySelectorAll('button, .opt, .scale-btn')).filter(e => e.offsetParent !== null).map(e => ({ t: (e.textContent || e.id || '').trim().slice(0, 20), h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width })).filter(x => x.h < 44 || x.w < 44));
        if (small.length) fail(where + ': small targets ' + JSON.stringify(small.slice(0, 3)));
      };
      if (await wide() > 0) fail('consent scrolls sideways');
      await checkTargets('consent');
      await page.click('#start');
      await tick(page, 'input[name="who"][value="me"]', { force: true });
      await page.click('#next');
      if (await wide() > 0) fail('question scrolls sideways');
      await checkTargets('question');
      await walk(page, {});
      if (await screen(page) !== 'review') fail('expected review, got ' + await screen(page));
      if (await wide() > 0) fail('review scrolls sideways');
      await checkTargets('review');
    } finally { await ctx.close(); }
  });

  t('P03', 'missing or invalid link shows a friendly message and no questions or other patients', async () => {
    const a = await open({ hash: '' });
    const b = await open({ hash: '#v=%3Cimg%20src%3Dx%3E' });
    try {
      for (const { page } of [a, b]) {
        if (await screen(page) !== 'invalid') fail('not invalid: ' + await screen(page));
        if (await page.$('[data-qid]')) fail('questions shown without a valid link');
        const txt = await page.textContent('main');
        if (!/not valid/.test(txt)) fail('no friendly message');
        if (/Aisha|Salma|Mariam|C-10/.test(txt)) fail('patient identifiers shown');
      }
    } finally { await a.ctx.close(); await b.ctx.close(); }
  });

  t('P04', 'reload restores the draft at the same question', async () => {
    const { page, ctx } = await open();
    try {
      await page.click('#start');
      await tick(page, 'input[name="who"][value="family"]', { force: true });
      await page.click('#next');
      await tick(page, 'input[name="fx"][value="1"]', { force: true });
      await page.click('#next');
      await tick(page, 'input[name="falls"][value="1"]', { force: true });
      await page.click('#next');
      const before = await curId(page);
      await page.reload();
      await page.waitForSelector('body[data-screen]');
      const after = await curId(page);
      if (before !== after) fail('resumed at ' + after + ', expected ' + before);
      const who = await page.evaluate(() => JSON.parse(sessionStorage.getItem('osteoloop.draft:C-1031|first')).who);
      if (who !== 'family') fail('who not restored');
      // go back to the falls question to see its stored answer
      await page.click('#back');
      const back = await curId(page);
      if (back !== 'falls') fail('back did not show falls, got ' + back);
      if (!(await page.isChecked('input[name="falls"][value="1"]'))) fail('falls answer lost on reload');
    } finally { await ctx.close(); }
  });

  t('P05', 'browser Back and the in-app Back move to the previous question', async () => {
    const { page, ctx } = await open();
    try {
      await page.click('#start');
      await tick(page, 'input[name="who"][value="me"]', { force: true });
      await page.click('#next');
      await tick(page, 'input[name="fx"][value="1"]', { force: true });
      await page.click('#next');
      if (await curId(page) !== 'falls') fail('not at falls: ' + await curId(page));
      await page.goBack();
      await page.waitForFunction(() => document.querySelector('main [data-qid]'));
      if (await curId(page) !== 'fx') fail('browser Back went to ' + await curId(page));
      if (!(await page.evaluate(() => location.hash)).includes('v=C-1031')) fail('hash lost on Back');
      await page.click('#back');
      if (await curId(page) !== 'who') fail('in-app Back went to ' + await curId(page));
      if (await screen(page) !== 'q') fail('left the app on Back from a question');
    } finally { await ctx.close(); }
  });

  t('P06', 'Cancel asks first; Leave and keep preserves answers; Delete clears them', async () => {
    const { page, ctx } = await open();
    try {
      await page.click('#start');
      await tick(page, 'input[name="who"][value="me"]', { force: true });
      await page.click('#next');
      await tick(page, 'input[name="fx"][value="1"]', { force: true });
      await page.click('#next');
      await page.click('#cancel');
      const dialog = await page.textContent('.dialog');
      if (!/Leave and keep my answers/.test(dialog) || !/Delete my answers/.test(dialog)) fail('confirm text missing');
      await page.click('#leave-keep');
      if (await screen(page) !== 'paused') fail('not paused');
      await page.reload();
      await page.waitForSelector('body[data-screen]');
      if (await curId(page) !== 'falls') fail('not resumed at falls after reload: ' + await curId(page));
      await page.click('#back');
      if (!(await page.isChecked('input[name="fx"][value="1"]'))) fail('answer lost after keep and reload');
      await page.click('#next');
      await page.click('#cancel');
      await page.click('#leave-del');
      if (await screen(page) !== 'consent') fail('delete did not return to start');
      if (await page.evaluate(() => sessionStorage.getItem('osteoloop.draft:C-1031|first')) !== null) fail('draft kept after delete');
      if (!(await page.textContent('main')).includes('deleted')) fail('no deleted note');
    } finally { await ctx.close(); }
  });

  t('P07', 'a 1,150-character answer is not cut: counter shows it, Next is blocked with the reason', async () => {
    const { page, ctx } = await open();
    try {
      await startFlow(page, { stopBefore: 'cc' });
      const long = 'a'.repeat(1150);
      await page.fill('#f-cc', long);
      await page.waitForTimeout(20);
      const v = await page.inputValue('#f-cc');
      if (v.length !== 1150) fail('textarea cut to ' + v.length);
      const counter = await page.textContent('#count-cc');
      if (!counter.includes('1,150 / 1,000')) fail('counter says ' + counter);
      if (!(await page.isDisabled('#next'))) fail('Next not blocked');
      const reason = await page.textContent('#reason');
      if (!reason.includes('1,150') || !reason.includes('Nothing has been cut off')) fail('no reason: ' + reason);
      const d = await draft(page);
      if (!d || JSON.parse(d).answers.cc.length !== 1150) fail('draft cut');
      await page.fill('#f-cc', 'a'.repeat(900));
      if (await page.isDisabled('#next')) fail('Next still blocked at 900');
      if (!(await page.textContent('#count-cc')).includes('characters left')) fail('no near-limit warning');
    } finally { await ctx.close(); }
  });

  t('P08', "None of these is exclusive for the question's none index, both ways", async () => {
    const { page, ctx } = await open();
    try {
      await startFlow(page, { stopBefore: 'redf' });
      if (await curId(page) !== 'redf') fail('not at redf: ' + await curId(page));
      await tick(page, 'input[name="redf"][value="4"]', { force: true });
      await tick(page, 'input[name="redf"][value="6"]', { force: true });
      if (await page.isChecked('input[name="redf"][value="4"]')) fail('none did not clear weight loss');
      await tick(page, 'input[name="redf"][value="4"]', { force: true });
      if (await page.isChecked('input[name="redf"][value="6"]')) fail('weight loss did not clear none');
      // the same rule on the review-set symptom list (none index 3)
    } finally { await ctx.close(); }
  });

  t('P09', 'a same-day red flag stops the patient at the tick and writes an urgent outbox record', async () => {
    const { page, ctx } = await open();
    try {
      await startFlow(page, { who: 'family', stopBefore: 'redf' });
      if (await curId(page) !== 'redf') fail('not at redf');
      await tick(page, 'input[name="redf"][value="1"]', { force: true });
      if (await screen(page) !== 'gate') fail('no stop after tick, screen ' + await screen(page));
      const text = await page.textContent('[role="alert"]');
      if (!text.includes('Please tell a nurse or the front desk now.')) fail('stop text missing');
      if (!text.includes('[clinic phone / emergency number: set by the hospital]')) fail('contact placeholder missing');
      const ob = await outbox(page);
      if (ob.length !== 1 || ob[0].urgent !== true) fail('outbox ' + JSON.stringify(ob).slice(0, 200));
      if (!ob[0].flags.some(f => f[0] === 'V-CES')) fail('no V-CES flag in outbox');
      if (ob[0].who !== 'family') fail('who not in outbox');
      await page.click('#urgent-go');
      if (!(await page.isChecked('input[name="redf"][value="1"]'))) fail('answer lost after continue');
      if (await curId(page) !== 'redf') fail('did not return to the question');
    } finally { await ctx.close(); }
  });

  t('P10', 'after an urgent stop the routine next-step card is never shown', async () => {
    const { page, ctx } = await open();
    try {
      await startFlow(page, { over: { redf: [0] } });   // walk clears the stop and carries on to review
      if (await screen(page) !== 'review') fail('not at review');
      await page.click('#send');
      await page.waitForSelector('body[data-screen="done"]');
      const txt = await page.textContent('main');
      if (!/Please tell a nurse/.test(txt)) fail('urgent block missing on done');
      if (/bone density|next step/i.test(txt)) fail('routine card shown after urgent');
      if (/Thank you\. Your answers are sent\./.test(txt)) fail('routine thank-you shown after urgent');
      const ob = await outbox(page);
      if (!ob.some(r => r.urgent === true)) fail('no urgent record');
    } finally { await ctx.close(); }
  });

  t('P11', 'Not sure is offered on yes or no items, stored as unknown, and listed at review', async () => {
    const { page, ctx } = await open();
    try {
      await startFlow(page, { over: { smoke: 'unk', fx: 2 } });
      if (await screen(page) !== 'review') fail('not review');
      const list = await page.textContent('#unknown-list');
      if (!/Please ask the doctor about these/.test(list) || !/smoke/i.test(list)) fail('unknown list: ' + list);
      if (!/Not sure/.test(await page.textContent('[data-rev="smoke"]'))) fail('review row does not say Not sure');
      const d = JSON.parse(await draft(page));
      if (d.answers.smoke !== C.UNKNOWN) fail('not stored as unknown');
    } finally { await ctx.close(); }
  });

  t('P12', 'Arabic runs end to end with no script errors and right-to-left layout', async () => {
    const { page, ctx, errors } = await open({ hash: '#v=C-1031&set=first&lang=ar', locale: 'ar-SA' });
    try {
      if ((await page.evaluate(() => document.documentElement.dir)) !== 'rtl') fail('not rtl');
      await startFlow(page, { over: { cc: { text: 'ألم في أسفل الظهر' } } });
      if (await screen(page) !== 'review') fail('no review in Arabic');
      await page.click('#send');
      await page.waitForSelector('body[data-screen="done"]');
      if (errors.length) fail('errors: ' + errors.join(' | '));
    } finally { await ctx.close(); }
  });

  t('P13', 'Malay runs end to end with no script errors, and the drug is named in the review question', async () => {
    const { page, ctx, errors } = await open({ hash: '#v=C-1018&set=review&lang=ms', visits: VISITS, locale: 'ms-MY' });
    try {
      await startFlow(page, { stopBefore: 'med' });
      if (await curId(page) !== 'med') fail('not at med, at ' + await curId(page));
      if (!(await page.textContent('main h1')).includes('alendronate')) fail('drug not named: ' + await page.textContent('main h1'));
      await walk(page, {});
      if (await screen(page) !== 'review') fail('no review in Malay');
      await page.click('#send');
      await page.waitForSelector('body[data-screen="done"]');
      if (errors.length) fail('errors: ' + errors.join(' | '));
    } finally { await ctx.close(); }
  });

  t('P14', 'HTML typed in free text is shown as text, never run or rendered', async () => {
    const { page, ctx } = await open();
    try {
      await startFlow(page, { stopAfter: 'cc' });
      const payload = '<img src=x onerror="window.__xss=1"><b>bold</b>';
      await page.fill('#f-cc', payload);
      await page.click('#next');
      await walk(page, {});
      if (await screen(page) !== 'review') fail('no review');
      if (await page.evaluate(() => window.__xss) !== undefined) fail('script ran');
      if (await page.$('main img')) fail('img rendered from patient text');
      if (!(await page.textContent('main')).includes('<img src=x')) fail('text not shown literally');
    } finally { await ctx.close(); }
  });

  t('P15', 'outbox payload has the agreed shape after Send, and the outbox is capped at 50', async () => {
    const { page, ctx } = await open();
    try {
      await page.evaluate(() => { const a = []; for (let i = 0; i < 55; i++) a.push({ old: i }); localStorage.setItem('osteoloop.outbox', JSON.stringify(a)); });
      await startFlow(page, { over: { worry: { text: 'Can I still do yoga?' } } });
      await page.click('#send');
      await page.waitForSelector('body[data-screen="done"]');
      const ob = await outbox(page);
      if (ob.length !== 50) fail('outbox length ' + ob.length);
      const r = ob[ob.length - 1];
      const keys = ['visit', 'caseId', 'set', 'lang', 'answers', 'flags', 'who', 'urgent', 'ts'];
      const missing = keys.filter(k => !(k in r));
      if (missing.length) fail('missing keys ' + missing);
      if (r.visit !== 'C-1031' || r.set !== 'first' || r.lang !== 'en' || r.who !== 'me' || r.urgent !== false) fail('shape ' + JSON.stringify({ v: r.visit, s: r.set, l: r.lang, w: r.who, u: r.urgent }));
      if (r.answers.worry !== 'Can I still do yoga?') fail('worry not kept');
      if (!Array.isArray(r.flags) || !r.flags.every(f => Array.isArray(f) && f.length === 4)) fail('flags not checkin tuples');
    } finally { await ctx.close(); }
  });

  t('P16', 'Arabic 0 to 10 scale: numbers run left to right and the labels sit on the matching sides', async () => {
    const { page, ctx } = await open({ hash: '#v=C-1031&set=first&lang=ar', locale: 'ar-SA' });
    try {
      await page.click('#start');
      await tick(page, 'input[name="who"][value="me"]', { force: true });
      await page.click('#next');
      await walk(page, {}, { stopAfter: 'pnow' });
      const r = await page.evaluate(() => {
        const q = document.querySelector('[data-qid="pnow"]');
        const btns = Array.from(q.querySelectorAll('.scale-btn'));
        const x0 = btns[0].getBoundingClientRect().left, x5 = btns[5].getBoundingClientRect().left;
        const ends = q.querySelectorAll('.scale-ends span');
        const lo = ends[0].getBoundingClientRect().left, hi = ends[1].getBoundingClientRect().left;
        return { dir: q.querySelector('.scale').getAttribute('dir'), ascending: x0 < x5, loLeft: lo < hi, loText: ends[0].textContent, hiText: ends[1].textContent };
      });
      if (r.dir !== 'ltr' || !r.ascending) fail('numbers not left to right ' + JSON.stringify(r));
      if (!r.loLeft || r.loText !== 'لا ألم') fail('label order wrong ' + JSON.stringify(r));
    } finally { await ctx.close(); }
  });

  t('P17', 'optional questions can be skipped, and the review shows the skip', async () => {
    const { page, ctx } = await open();
    try {
      await startFlow(page, { stopBefore: 'ask' });
      if (await curId(page) !== 'ask') fail('not at the question for the doctor');
      await page.click('#skip');
      if (await screen(page) !== 'review') fail('skip did not reach review');
      if (!(await page.textContent('[data-rev="ask"]')).includes('Skipped')) fail('skip not shown at review');
    } finally { await ctx.close(); }
  });


  t('P18', 'Change from review returns to review after the change (then the next pending question)', async () => {
    const { page, ctx } = await open();
    try {
      await startFlow(page, {});
      if (await screen(page) !== 'review') fail('not review');
      await page.click('#change-fx');
      if (await curId(page) !== 'fx') fail('change did not open fx');
      await tick(page, 'input[name="fx"][value="0"]', { force: true });
      await page.click('#next');
      // fxsite and fxwhen are now shown and unanswered: the patient answers them, then review
      let guard = 0;
      while (await screen(page) === 'q' && guard++ < 6) { const id = await curId(page); await ans(page, id, id === 'fxsite' ? 0 : 0); await page.click('#next'); }
      if (await screen(page) !== 'review') fail('did not return to review, screen ' + await screen(page));
    } finally { await ctx.close(); }
  });

  t('P19', 'keyboard and screen-reader basics: focus on the question heading, live progress, labels linked, no auto-advance', async () => {
    const { page, ctx } = await open();
    try {
      await page.click('#start');
      const focused = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
      if (focused !== 'H1') fail('focus after Start is ' + focused);
      await tick(page, 'input[name="who"][value="me"]', { force: true });
      await page.click('#next');
      const live = await page.textContent('#live');
      if (!/Question 2 of/.test(live)) fail('live region says ' + live);
      if (await page.evaluate(() => document.activeElement.tagName) !== 'H1') fail('focus not on heading');
      await tick(page, 'input[name="fx"][value="1"]', { force: true });
      if (await curId(page) !== 'fx') fail('single choice auto-advanced');
      const sel = await page.textContent('.opt:has(input[value="1"]:checked) .sel');
      if (!/Selected/.test(sel)) fail('selected state not shown in text');
      const labelled = await page.getAttribute('main fieldset', 'aria-labelledby');
      if (labelled !== 'qh') fail('fieldset not labelled');
    } finally { await ctx.close(); }
  });

  t('P20', 'the page still works when sessionStorage and pushState fail (sandboxed frame)', async () => {
    const init = () => {
      const boom = () => { throw new DOMException('denied', 'SecurityError'); };
      try { Object.defineProperty(window, 'sessionStorage', { get: boom }); } catch (e) { /* ignore */ }
      history.pushState = boom; history.replaceState = boom;
    };
    const { page, ctx, errors } = await open({ initScript: init });
    try {
      await page.click('#start');
      await tick(page, 'input[name="who"][value="me"]', { force: true });
      await page.click('#next');
      await tick(page, 'input[name="fx"][value="1"]', { force: true });
      await page.click('#next');
      if (await curId(page) !== 'falls') fail('did not advance without history: ' + await curId(page));
      await page.click('#back');
      if (await curId(page) !== 'fx') fail('in-app Back failed without history: ' + await curId(page));
      if (errors.some(e => /SecurityError|denied/.test(e))) fail('unhandled: ' + errors.join(' | '));
    } finally { await ctx.close(); }
  });

  t('P21', 'language switch keeps what the patient has typed', async () => {
    const { page, ctx } = await open();
    try {
      await startFlow(page, { stopBefore: 'cc' });
      await page.fill('#f-cc', 'Pain in the knee');
      await page.click('[data-lang="ar"]');
      const v = await page.inputValue('#f-cc');
      if (v !== 'Pain in the knee') fail('text lost on language switch: ' + v);
    } finally { await ctx.close(); }
  });

  t('P22', 'the fixed warning line sits above the complaint box in each language', async () => {
    const { page, ctx } = await open();
    try {
      await startFlow(page, { stopBefore: 'cc' });
      if (!(await page.textContent('#cc-note')).includes('please also tick it in the list of warning symptoms')) fail('en note missing');
      await page.click('[data-lang="ar"]');
      if (!(await page.textContent('#cc-note')).includes('الأعراض التحذيرية')) fail('ar note missing');
      await page.click('[data-lang="ms"]');
      if (!(await page.textContent('#cc-note')).includes('gejala amaran')) fail('ms note missing');
    } finally { await ctx.close(); }
  });

  /* ---------- run ---------- */
  for (const u1 of unit) {
    try { const ok = u1.fn(); record(u1.name.split(' ')[0], u1.name, ok === true, ok === true ? '' : 'returned ' + JSON.stringify(ok)); }
    catch (e) { record(u1.name.split(' ')[0], u1.name, false, e.message); }
  }
  for (const x of tests) {
    if (process.env.BENCH_ONLY && !process.env.BENCH_ONLY.split(',').includes(x.id)) continue;
    try { await x.fn(); record(x.id, x.name, true, ''); }
    catch (e) { record(x.id, x.name, false, e.message.split('\n')[0]); }
  }
  await browser.close();
  srv.close();

  const pass = results.filter(r => r.ok).length, total = results.length;
  const md = ['# Patient page results', '', 'Generated by `bench/run-patient.js`. ' + pass + ' of ' + total + ' checks pass.', '',
    '| Check | Result | Note |', '| --- | --- | --- |'];
  results.forEach(r => md.push('| ' + r.id + ' ' + r.name.replace(/\|/g, '/') + ' | ' + (r.ok ? 'pass' : 'FAIL') + ' | ' + String(r.detail).replace(/\|/g, '/') + ' |'));
  fs.writeFileSync(path.join(ROOT, 'bench/results/patient.md'), md.join('\n') + '\n');
  results.filter(r => !r.ok).forEach(r => console.log('FAIL ' + r.id + ' ' + r.name + ': ' + r.detail));
  console.log('patient ' + pass + '/' + total);
  process.exit(pass === total ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
