/* "Try it yourself: 7 steps" (opened by the Start here button).
   It only clicks the page's own tabs and controls and reads state (window.PeriHooks.sim() and the DOM).
   A step ticks itself when the visitor's own action produces the expected result; every step also has an "I did it" fallback.
   Nothing here is sent over the network. */
(function () {
  'use strict';
  var doc = document, win = window, body = doc.body;
  var STEP_COUNT = 7;
  var TITLE = 'Try it yourself: 7 steps, about 3 minutes';

  function $(id) { return doc.getElementById(id); }
  function txt(el) { return el ? String(el.textContent || '') : ''; }
  function sim() { try { return win.PeriHooks && win.PeriHooks.sim ? win.PeriHooks.sim() : null; } catch (e) { return null; } }
  function alertCount() { return doc.querySelectorAll('#alerts .alert').length; }
  function mq(q) { try { return win.matchMedia ? win.matchMedia(q) : null; } catch (e) { return null; } }
  var reduceMQ = mq('(prefers-reduced-motion: reduce)');
  var phoneMQ = mq('(max-width: 599px) and (min-height: 420px)');
  function reduced() { return !!(reduceMQ && reduceMQ.matches); }
  function isPhone() { return !!(phoneMQ && phoneMQ.matches); }
  function navBtn(v) { return doc.querySelector('nav button[data-v="' + v + '"]'); }
  function tabOn(v) { var b = navBtn(v); return !b || b.classList.contains('on'); }

  // Steps. targets: selectors on the real page. check(base): reads the page. clickTick: a visitor click inside these ticks the step.
  var STEPS = [
    {
      title: 'What this is',
      intro: 'PeriLoop turns each patient’s surgery plan into owned tasks and chases the late ones (every patient here is fictional).',
      tab: 'ov', targets: ['#ovkpi'],
      doIt: 'Look at the counts at the top of Overview, then scroll down to the stage board. (The Watch the story card is a separate, hands-off option.)',
      see: 'Counts such as Open items and Overdue, and six stages from Screening to Follow-up that turn red when something is overdue or an emergency is open.'
    },
    {
      title: 'Load a sample with a same-day red flag',
      tab: 'intake', targets: ['#iv-samp', '#iv-sample'],
      doIt: 'In Intake, pick “FIC-TKR-05 · free text: calf swelling (SAME-DAY)” in the sample list, then press Load a sample patient (Start interview does not load this sample).',
      see: 'A red summary banner (RED), a red SAME-DAY box, and a SAME-DAY alert with an urgent task on the Staff board.',
      check: function () { return txt($('hdr-pt')).indexOf('FIC-TKR-05') >= 0; }
    },
    {
      title: 'Send a red-flag message from the patient phone',
      tab: 'pt', targets: ['#msg', '#f button'],
      doIt: 'In the chat box, type “my calf is swollen and I feel short of breath” and press Send.',
      see: 'A new red EMERGENCY card in Alerts on the Staff board, and the patient reply tells them to call 999 or go to the emergency department.',
      baseline: function () { return alertCount(); },
      check: function (base) { return alertCount() > base; }
    },
    {
      title: 'Acknowledge the alert and find its owner',
      tab: 'staff', targets: ['#board'],
      clickTick: '#alerts [data-ack], #board button',
      doIt: 'Press Acknowledge on the newest alert at the top of Alerts (staff group), then look at Case board, which is highlighted.',
      see: 'The alert records who acknowledged it, and a Case board task names its owner (for example, owner clinician); the alert card itself does not name one.'
    },
    {
      title: 'Optional: try AI via proxy',
      tab: 'intake', open: 'details.iv-set', targets: ['#iv-set-mode', '#iv-set-proxy', '#iv-set-status', '#pl-test-conn', '#pl-test-out'],
      doIt: 'In Settings, set Mode to AI via proxy, type http://localhost:8787 into Proxy URL, then press Test connection (the tour opens Settings for you). With no proxy running you should see “Not connected” and the header badge turns to “unavailable, rules only”. Then set Mode back to Scripted (no AI); closing the tour also restores your earlier setting.',
      see: 'The status line under the proxy box changes to “AI via proxy: typed answers go to your proxy only after the fixed red-flag rules have run.” Nothing is sent unless a proxy is listening there.',
      result: function () { return 'Result: ' + txt($('pl-test-out')).trim() + ' Badge: ' + txt($('pl-ai-badge')).trim().replace(/^\S\s*/, '') + '.'; },
      check: function () { return /^AI via proxy/.test(txt($('iv-set-status')).trim()) && txt($('pl-test-out')).trim().length > 0; }
    },
    {
      title: 'Switch the language to Arabic',
      dynIntro: function () { var m = $('iv-set-mode'); return m && m.value === 'ai' ? 'Note: Settings still has Mode on AI via proxy. Set it back to Scripted (no AI) in the Settings card if you want.' : 'Settings are back on Scripted (no AI).'; },
      tab: 'intake', targets: ['#iv-lang'],
      doIt: 'In the Intake card, change Language to العربية; switch back to English when you finish.',
      see: 'The Intake card switches to right-to-left, so its labels and text align from the right.',
      check: function () { var c = doc.querySelector('.iv-int'); return !!c && c.getAttribute('dir') === 'rtl'; }
    },
    {
      title: 'Move the demo clock forward',
      tab: 'ov', targets: ['header .clock'],
      doIt: 'Press +1 day in the header. The time buttons (+1 h, +6 h, +1 day, +3 days) skip the demo clock forward, so you can watch overdue chasing without waiting.',
      see: 'The clock on Overview moves on, and the Overdue count can rise as tasks pass their due time.',
      baseline: function () { var S = sim(); return S ? S.now : 0; },
      check: function (base) { var S = sim(); return !!S && S.now > base; }
    }
  ];

  var SAVED = null; // the visitor's own Settings before the tour, restored on close or finish
  var S = { open: false, i: 0, done: [], base: null, hl: [], timer: null, band: null, away: false, clickFn: null, tallNote: false };
  var root = null, panel = null, live = null, startBtn = $('tour-start');
  var els = {};

  function build() {
    root = doc.createElement('div');
    root.id = 'tour-root';
    root.hidden = true;
    var list = STEPS.map(function (s, i) {
      return '<li><button type="button" data-tour-go="' + i + '">' + (i + 1) + '. ' + s.title + '</button></li>';
    }).join('');
    // Layout: head and progress are fixed, the middle text scrolls, the footer (Back, I did it, Next) is always in view.
    root.innerHTML =
      '<section id="tour-panel" class="tour-panel" role="dialog" aria-modal="false" aria-labelledby="tour-title" aria-label="' + TITLE + '">' +
        '<div class="tour-head"><b class="tour-kicker">' + TITLE + '</b>' +
          '<button type="button" class="tour-collapse" aria-expanded="true" aria-controls="tour-body tour-foot">Hide steps</button>' +
          '<button type="button" class="tour-close">Close</button></div>' +
        '<div class="tour-progress"><div class="tour-prog" role="progressbar" aria-label="Progress through the seven steps" aria-valuemin="1" aria-valuemax="' + STEP_COUNT + '" aria-valuenow="1" aria-valuetext="1 of ' + STEP_COUNT + '"><i></i></div><span class="tour-count">1 of ' + STEP_COUNT + '</span></div>' +
        '<div id="tour-body" class="tour-body">' +
          '<h2 id="tour-title" class="tour-title" tabindex="-1"></h2>' +
          '<p class="tour-intro"></p>' +
          '<p><b>What to do:</b> <span class="tour-do"></span></p>' +
          '<p><b>You should see:</b> <span class="tour-see"></span></p>' +
          '<p class="tour-status"></p>' +
          '<ol class="tour-list" aria-label="The seven steps">' + list + '</ol>' +
        '</div>' +
        '<div id="tour-foot" class="tour-foot">' +
          '<button type="button" class="tour-goto">Go to the tab</button>' +
          '<button type="button" class="tour-back">Back</button>' +
          '<button type="button" class="tour-did">I did it</button>' +
          '<button type="button" class="tour-next p">Next</button>' +
        '</div>' +
        '<div class="tour-sr" id="tour-live" role="status" aria-live="polite"></div>' +
      '</section>';
    body.appendChild(root);
    panel = $('tour-panel');
    live = $('tour-live');
    els.body = $('tour-body');
    els.foot = $('tour-foot');
    els.title = root.querySelector('.tour-title');
    els.intro = root.querySelector('.tour-intro');
    els.doT = root.querySelector('.tour-do');
    els.seeT = root.querySelector('.tour-see');
    els.status = root.querySelector('.tour-status');
    els.count = root.querySelector('.tour-count');
    els.prog = root.querySelector('.tour-prog');
    els.back = root.querySelector('.tour-back');
    els.next = root.querySelector('.tour-next');
    els.goto = root.querySelector('.tour-goto');
    root.querySelector('.tour-close').addEventListener('click', closeTour);
    root.querySelector('.tour-collapse').addEventListener('click', toggleCollapse);
    els.back.addEventListener('click', function () { if (S.i > 0) showStep(S.i - 1); });
    els.next.addEventListener('click', function () {
      if (S.i < STEP_COUNT - 1) showStep(S.i + 1); else finish();
    });
    els.did = root.querySelector('.tour-did');
    els.did.addEventListener('click', function () {
      S.done[S.i] = true; render(); announce('Step ' + (S.i + 1) + ' marked done.');
    });
    els.goto.addEventListener('click', function () {
      var st = STEPS[S.i];
      if (st.tab) go(st.tab);
      render();
      reveal(S.hl);
    });
    root.querySelector('.tour-list').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-tour-go]') : null;
      if (b) showStep(+b.getAttribute('data-tour-go'));
    });
  }

  function announce(msg) { if (live) live.textContent = msg; }

  function go(v) {
    var b = navBtn(v);
    if (b && !b.classList.contains('on')) b.click();
  }

  function disarmClick() {
    if (S.clickFn) { doc.removeEventListener('click', S.clickFn, true); S.clickFn = null; }
  }

  function armClick(sel) {
    disarmClick();
    S.clickFn = function (e) {
      var t = e.target;
      if (!S.open || S.done[S.i] || !t || !t.closest || !t.closest(sel)) return;
      S.done[S.i] = true;
      render();
      reveal(S.hl);
      announce('Step ' + (S.i + 1) + ' done: you did it.');
    };
    doc.addEventListener('click', S.clickFn, true);
  }

  function clearHl() {
    S.hl.forEach(function (el) { el.classList.remove('tour-hl'); });
    S.hl = [];
    disarmClick();
  }

  // Keeps the highlighted target out from under the page header (when it is still showing) and the phone sheet.
  function layout() {
    if (!root) return;
    var hdr = doc.querySelector('header');
    var hb = Math.max(0, hdr ? hdr.getBoundingClientRect().bottom : 0);
    var phone = isPhone();
    var sheetH = (S.open && phone && panel) ? panel.getBoundingClientRect().height : 0;
    body.classList.toggle('tour-side', S.open && !phone);
    body.classList.toggle('tour-sheet', S.open && phone);
    S.band = { top: hb + 8, bottom: win.innerHeight - sheetH - (phone ? 8 : 16) };
    var st = doc.documentElement.style;
    st.setProperty('--tour-mt', Math.round(hb + 8) + 'px');
    st.setProperty('--tour-mb', Math.round(sheetH + (phone ? 8 : 16)) + 'px');
    var short = win.innerHeight < 520;
    st.setProperty('--tour-top', Math.round(short ? 12 : hb + 12) + 'px');
    st.setProperty('--tour-sheet-h', Math.round(sheetH) + 'px');
  }

  // Brings the first target into the free band (clear of the header and the phone sheet), then fits the group if it can.
  // Scrolling is instant, so positions read straight after are final.
  function reveal(targets) {
    if (!targets || !targets.length) return;
    layout();
    var first = targets[0];
    try { first.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' }); }
    catch (e) { first.scrollIntoView(false); }
    layout(); // the header offset changes once the page has moved
    var band = S.band || { top: 0, bottom: win.innerHeight };
    var top = Infinity, bottom = -Infinity;
    targets.forEach(function (el) { var r = el.getBoundingClientRect(); top = Math.min(top, r.top); bottom = Math.max(bottom, r.bottom); });
    var delta = 0;
    S.tallNote = bottom - top > band.bottom - band.top;
    if (bottom - top <= band.bottom - band.top) {
      if (top < band.top) delta = top - band.top;
      else if (bottom > band.bottom) delta = bottom - band.bottom;
    } else {
      delta = top - band.top;
    }
    if (Math.abs(delta) > 1) win.scrollBy({ top: delta, behavior: 'auto' });
    if (S.open && els.status) els.status.textContent = statusText();
  }

  function statusText() {
    var st = STEPS[S.i], done = !!S.done[S.i], away = S.away;
    var msg;
    if (away) msg = 'You are on another tab, so this step’s highlight is out of view. Use the button below to return.';
    else if (done) msg = 'Done.';
    else if (st.clickTick) msg = 'This step ticks when you press Acknowledge or a Case board button, or press I did it.';
    else if (st.check) msg = 'This step ticks itself when the result appears, or press I did it.';
    else msg = 'Press I did it when you have looked.';
    if (done && !away && st.result) { try { msg += ' ' + st.result(); } catch (e) { /* text only */ } }
    if (S.tallNote && !away) msg += ' This target is taller than the free space on screen: its top edge is shown, so scroll the page to read the rest.';
    return msg;
  }

  function render() {
    if (!root) return;
    var st = STEPS[S.i], n = S.i + 1, done = !!S.done[S.i];
    var away = !!st.tab && !tabOn(st.tab);
    S.away = away;
    els.title.textContent = n + '. ' + st.title;
    var intro = st.dynIntro ? st.dynIntro() : (st.intro || '');
    els.intro.textContent = intro;
    els.intro.hidden = !intro;
    els.doT.textContent = st.doIt;
    els.seeT.textContent = st.see;
    els.status.textContent = statusText();
    els.status.className = 'tour-status' + (done && !away ? ' tour-done' : '');
    els.goto.hidden = !away;
    if (away) els.goto.textContent = 'Go to the ' + (navBtn(st.tab) ? txt(navBtn(st.tab)) : st.tab) + ' tab';
    els.count.textContent = n + ' of ' + STEP_COUNT;
    els.prog.setAttribute('aria-valuenow', String(n));
    els.prog.setAttribute('aria-valuetext', n + ' of ' + STEP_COUNT);
    els.prog.firstChild.style.width = Math.round(n / STEP_COUNT * 100) + '%';
    els.back.disabled = S.i === 0;
    els.next.textContent = S.i === STEP_COUNT - 1 ? 'Finish' : 'Next';
    root.querySelectorAll('[data-tour-go]').forEach(function (b, j) {
      if (j === S.i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    layout();
  }

  // Step done: the visible target may have grown (for example a status line), so it is revealed again.
  function markDone() {
    S.done[S.i] = true;
    render();
    reveal(S.hl);
    announce('Step ' + (S.i + 1) + ' done.');
  }

  function tick() {
    if (!S.open) return;
    var st = STEPS[S.i];
    if (!S.done[S.i] && st.check) {
      var ok = false;
      try { ok = !!st.check(S.base); } catch (e) { ok = false; }
      if (ok) { markDone(); return; }
    }
    // the visitor moved to another tab: say so, once per change
    var away = !!st.tab && !tabOn(st.tab);
    if (away !== S.away) render();
  }

  function showStep(i) {
    S.i = i;
    var st = STEPS[i];
    clearHl();
    S.tallNote = false;
    S.base = st.baseline ? st.baseline() : null;
    if (st.open) { var d = doc.querySelector(st.open); if (d) d.open = true; }
    if (st.tab) go(st.tab);
    st.targets.forEach(function (sel) {
      var el = doc.querySelector(sel);
      if (el) { el.classList.add('tour-hl'); S.hl.push(el); }
    });
    if (st.clickTick) armClick(st.clickTick);
    if (els.body) els.body.scrollTop = 0; // every step starts at the top of its text
    render();
    announce('Step ' + (i + 1) + ' of ' + STEP_COUNT + ': ' + st.title + '.');
    tick();
    reveal(S.hl);
  }

  function snapSettings() {
    var m = $('iv-set-mode'), u = $('iv-set-proxy');
    SAVED = m && u ? { mode: m.value, url: u.value } : null;
  }
  function restoreSettings() {
    var m = $('iv-set-mode'), u = $('iv-set-proxy');
    if (!SAVED || !m || !u) return;
    if (m.value !== SAVED.mode || u.value !== SAVED.url) {
      u.value = SAVED.url; m.value = SAVED.mode;
      m.dispatchEvent(new Event('change', { bubbles: true }));
      u.dispatchEvent(new Event('input', { bubbles: true }));
    }
    SAVED = null;
  }

  function openTour() {
    if (!S.open) snapSettings();
    S.open = true;
    root.hidden = false;
    if (startBtn) startBtn.setAttribute('aria-expanded', 'true');
    showStep(S.i);
    if (!S.timer) S.timer = win.setInterval(tick, 500);
    try { els.title.focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ }
  }

  function closeTour() {
    restoreSettings();
    S.open = false;
    if (root) root.hidden = true;
    clearHl();
    if (S.timer) { win.clearInterval(S.timer); S.timer = null; }
    layout();
    if (startBtn) { startBtn.setAttribute('aria-expanded', 'false'); try { startBtn.focus({ preventScroll: true }); } catch (e) { /* nicety */ } }
  }

  // Finish closes the tour and starts it over next time; the ticks are cleared too, so a re-run checks again.
  function finish() { closeTour(); S.i = 0; S.done = []; }

  function toggleCollapse() {
    var c = panel.classList.toggle('tour-min');
    var b = root.querySelector('.tour-collapse');
    b.textContent = c ? 'Show steps' : 'Hide steps';
    b.setAttribute('aria-expanded', c ? 'false' : 'true');
    els.body.hidden = c;
    els.foot.hidden = c;
    layout();
  }

  build();
  if (startBtn) startBtn.addEventListener('click', openTour);
  // Esc closes the tour only when the visitor is not typing or choosing: a focused select, input or text box keeps its own Esc.
  doc.addEventListener('keydown', function (e) {
    if (!S.open || e.defaultPrevented) return;
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    var a = doc.activeElement, tag = a && a.tagName ? a.tagName : '';
    if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA' || (a && a.isContentEditable)) return;
    e.preventDefault();
    closeTour();
  });
  win.addEventListener('resize', function () { if (S.open) layout(); });
  win.addEventListener('scroll', function () { if (S.open) layout(); }, { passive: true });
  if (phoneMQ && phoneMQ.addEventListener) phoneMQ.addEventListener('change', function () { if (S.open) layout(); });

  // Read-only handle for checks: the step list and the current state. It changes nothing on the page.
  win.PeriTour = {
    title: TITLE,
    steps: STEPS.map(function (s) { return { title: s.title, tab: s.tab || null, targets: s.targets.slice(), auto: !!s.check, click: s.clickTick || null }; }),
    state: function () { return { open: S.open, i: S.i, done: S.done.slice(), away: S.away }; }
  };
})();
