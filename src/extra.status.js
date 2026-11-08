/* status: makes the optional AI second check visible. Plain JS, IIFE, ES5 style like the page.
 * It wraps functions on window.PL_secondCheck, window.PL_KNOWLEDGE and window.fetch at run time, so engine.js and mod/*.js
 * are untouched. Labels come from data the page already keeps: alert.flags (the phone path writes the model marker),
 * the combine() result, and the Ask box reason text. Nothing is sent over the network at load. Fictional data only.
 *
 * Languages: en is the reviewed wording. ms, zh and ar strings are MACHINE DRAFTS, not clinician or translator reviewed.
 */
(function () {
  'use strict';

  var MODEL_FLAG = 'second check (model) raised concern'; // flag the phone path writes for a model raise
  var MODEL_REASON = 'Second check (model) raised concern'; // reason text the Ask box shows for the same raise
  var URGENT = { EMERGENCY: 1, 'SAME-DAY': 1 };
  var SC = window.PL_secondCheck, KN = window.PL_KNOWLEDGE;
  var state = { failed: false, checked: false, modelRaise: 0, lastKn: null, badgeKey: '', lastFetch: null };

  var T = {
    en: {
      badge: { rules: 'Rules only (no AI)', on: 'AI second check: on', amber: 'AI second check: unavailable, rules only', untested: 'AI second check: set, not tested' },
      by: { rules: 'Raised by fixed rules', ai: 'Raised by AI second check', both: 'Raised by both' },
      test: { btn: 'Test connection', testing: 'Testing the connection...', ok: 'Connected: second check works',
        notTested: 'Not tested. Choose "AI via proxy" and enter a proxy URL first. Nothing was sent.',
        fail: 'Not connected: ', failEnd: '. Rules only until this works.',
        timeout: 'the proxy did not answer within 8 seconds',
        noconn: 'no connection to the proxy (check the URL and that it is running)',
        http: 'the proxy answered with an error (HTTP {s})',
        upstream: 'the proxy answered but could not screen the message',
        format: 'the proxy answered in a format the page does not accept',
        failed: 'the request failed', none: 'the proxy gave no usable answer' }
    },
    ms: { // machine draft
      badge: { rules: 'Peraturan sahaja', on: 'Semakan AI kedua: aktif', amber: 'Semakan AI kedua: tidak tersedia, peraturan sahaja', untested: 'Semakan AI kedua: ditetapkan, belum diuji' },
      by: { rules: 'Dibangkitkan oleh peraturan tetap', ai: 'Dibangkitkan oleh semakan AI kedua', both: 'Dibangkitkan oleh kedua-duanya' },
      test: { btn: 'Uji sambungan', testing: 'Menguji sambungan...', ok: 'Bersambung: semakan kedua berfungsi',
        notTested: 'Belum diuji. Pilih "AI melalui proksi" dan masukkan URL proksi dahulu. Tiada apa-apa dihantar.',
        fail: 'Tidak bersambung: ', failEnd: '. Peraturan sahaja sehingga ini berfungsi.',
        timeout: 'proksi tidak menjawab dalam 8 saat',
        noconn: 'tiada sambungan ke proksi (semak URL dan pastikan ia berjalan)',
        http: 'proksi menjawab dengan ralat (HTTP {s})',
        upstream: 'proksi menjawab tetapi tidak dapat menyemak mesej',
        format: 'proksi menjawab dalam format yang tidak diterima',
        failed: 'permintaan gagal', none: 'proksi tidak memberi jawapan yang boleh digunakan' }
    },
    zh: { // machine draft
      badge: { rules: '仅规则', on: 'AI 第二次检查：已开启', amber: 'AI 第二次检查：不可用，仅规则', untested: 'AI 第二次检查：已设置，尚未测试' },
      by: { rules: '由固定规则发出', ai: '由 AI 第二次检查发出', both: '由两者共同发出' },
      test: { btn: '测试连接', testing: '正在测试连接...', ok: '已连接：第二次检查正常',
        notTested: '尚未测试。请先选择“通过代理使用 AI”并输入代理网址。未发送任何内容。',
        fail: '未连接：', failEnd: '。在此修复前仅使用规则。',
        timeout: '代理在 8 秒内未响应',
        noconn: '无法连接代理（请检查网址并确认其正在运行）',
        http: '代理返回错误（HTTP {s}）',
        upstream: '代理已响应，但无法审查该消息',
        format: '代理返回的格式页面无法接受',
        failed: '请求失败', none: '代理未给出可用的回答' }
    },
    ar: { // machine draft
      badge: { rules: 'القواعد فقط', on: 'الفحص الثاني بالذكاء الاصطناعي: مفعّل', amber: 'الفحص الثاني بالذكاء الاصطناعي: غير متاح، القواعد فقط', untested: 'الفحص الثاني بالذكاء الاصطناعي: مضبوط، لم يُختبر بعد' }, // untested (ar): reviewed:false, machine draft
      by: { rules: 'أطلقتها القواعد الثابتة', ai: 'أطلقها الفحص الثاني بالذكاء الاصطناعي', both: 'أطلقتها القواعد والفحص الثاني معا' },
      test: { btn: 'اختبار الاتصال', testing: 'جار اختبار الاتصال...', ok: 'متصل: الفحص الثاني يعمل',
        notTested: 'لم يُختبر بعد. اختر "الذكاء الاصطناعي عبر الخادم الوسيط" وأدخل عنوان الخادم أولا. لم يُرسل شيء.',
        fail: 'غير متصل: ', failEnd: '. القواعد فقط حتى يعمل هذا.',
        timeout: 'لم يرد الخادم الوسيط خلال 8 ثوان',
        noconn: 'لا يوجد اتصال بالخادم الوسيط (تحقق من العنوان ومن تشغيله)',
        http: 'ردّ الخادم الوسيط بخطأ (HTTP {s})',
        upstream: 'ردّ الخادم الوسيط لكنه لم يستطع فحص الرسالة',
        format: 'ردّ الخادم الوسيط بصيغة لا تقبلها الصفحة',
        failed: 'فشل الطلب', none: 'لم يعطِ الخادم الوسيط ردا صالحا' }
    }
  };

  function $(id) { return document.getElementById(id); }
  function aiOn() { try { return !!(window.__plAI && window.__plAI.on()); } catch (e) { return false; } }
  // The page language is the Intake language picker; Ask uses its own picker, so the Intake one decides here.
  function lang() { var el = $('iv-lang'), v = el && el.value; return T[v] ? v : 'en'; }

  // Wraps obj[name] once. The wrapper keeps the original call and its return value.
  function wrapOnce(obj, name, make) {
    if (!obj || typeof obj[name] !== 'function' || obj[name].__plStatus) return;
    var w = make(obj[name]);
    w.__plStatus = true;
    obj[name] = w;
  }

  /* ---------- 1. badge ---------- */
  var ICON = { rules: '○', on: '●', amber: '▲', untested: '◐' }; // ○ ● ▲
  function badgeKind() { return !aiOn() ? 'rules' : state.failed ? 'amber' : state.checked ? 'on' : 'untested'; }
  function renderBadge() {
    var el = $('pl-ai-badge');
    if (!el) return;
    var kind = badgeKind(), L = lang(), key = kind + '|' + L;
    if (key === state.badgeKey && el.firstChild) return; // no change: do not re-announce
    state.badgeKey = key;
    el.className = 'pl-badge pl-b-' + kind;
    el.innerHTML = '<span class="pl-ic" aria-hidden="true">' + ICON[kind] + '</span><span dir="auto"></span>';
    el.lastChild.textContent = T[L].badge[kind];
  }

  // Every second-check result passes here. 'unscreened' means the call failed, timed out or was unparsable.
  wrapOnce(SC, 'secondCheck', function (orig) {
    return function () {
      return orig.apply(this, arguments).then(function (v) {
        state.failed = !!v && v.verdict === 'unscreened';
        if (v && v.verdict && v.verdict !== 'unscreened') state.checked = true;
        renderBadge();
        return v;
      });
    };
  });

  // Records the last fetch so Test connection can tell "no connection" from "the proxy answered with an error".
  if (typeof window.fetch === 'function' && !window.fetch.__plStatus) {
    var origFetch = window.fetch;
    var wrappedFetch = function (url) {
      var rec = { status: null, error: false };
      state.lastFetch = rec;
      return origFetch.apply(this, arguments).then(function (res) { rec.status = res.status; return res; },
        function (e) { rec.error = true; throw e; });
    };
    wrappedFetch.__plStatus = true;
    window.fetch = wrappedFetch;
  }

  // A settings change starts a fresh state: the amber state describes the proxy that was in use.
  function clearModelRaise() { state.modelRaise = 0; }
  function onSettingsChange() { state.failed = false; state.checked = false; clearModelRaise(); renderBadge(); }
  ['iv-set-mode', 'iv-set-preset'].forEach(function (id) { var e = $(id); if (e) e.addEventListener('change', onSettingsChange); });
  var proxyIn = $('iv-set-proxy');
  if (proxyIn) proxyIn.addEventListener('input', onSettingsChange);
  // Starting, sampling or switching patient ends any pending model raise.
  ['iv-start', 'iv-sample', 'iv-pat', 'iv-lang'].forEach(function (id) {
    var e = $(id); if (e) e.addEventListener('click', clearModelRaise);
  });
  ['iv-pat', 'iv-lang'].forEach(function (id) { var e = $(id); if (e) e.addEventListener('change', clearModelRaise); });

  /* ---------- 2. raised-by labels ---------- */
  // combine() marks a model raise (escalated on an urgent model verdict, with urgent rules absent).
  // The mark is good only until the current task ends: the Intake bubble is added in that same task, and
  // any other path (phone, Ask) clears it on its own, so it cannot reach a later Intake bubble.
  wrapOnce(SC, 'combine', function (orig) {
    return function (rules, sec, opts) {
      var out = orig.apply(this, arguments);
      if (out && out.escalated && sec && sec.verdict === 'urgent' && rules && rules.cls && !URGENT[rules.cls]) {
        var token = {};
        state.modelRaise = token;
        setTimeout(function () { if (state.modelRaise === token) state.modelRaise = 0; }, 0);
      }
      return out;
    };
  });
  // The Ask box reads the rules class from the last knowledge answer.
  wrapOnce(KN, 'answer', function (orig) {
    return function () { var r = orig.apply(this, arguments); state.lastKn = r; return r; };
  });

  function mkLabel(kind, block) {
    var s = document.createElement('span');
    s.className = 'pl-by pl-by-' + kind + (block ? ' pl-by-block' : '');
    s.setAttribute('dir', 'auto');
    s.textContent = T[lang()].by[kind];
    return s;
  }
  function hasLabel(parent) {
    for (var i = 0; i < parent.children.length; i++) if (parent.children[i].classList.contains('pl-by')) return true;
    return false;
  }

  // Staff board alerts. The engine stores flags on each alert; the model marker says the model raised it.
  function raisedBy(a) {
    var fl = (a && a.flags) || [];
    var model = fl.some(function (f) { return String(f).indexOf(MODEL_FLAG) >= 0; });
    var rules = fl.some(function (f) { return String(f).trim() !== '' && String(f).indexOf(MODEL_FLAG) < 0; });
    if (model && rules) return 'both';
    if (model) return 'ai';
    if (rules) return 'rules';
    return null; // no data to say who raised it: show no label rather than guess
  }
  function labelAlerts() {
    var box = $('alerts'), hooks = window.PeriHooks;
    if (!box || !hooks || !hooks.sim) return;
    var S = hooks.sim();
    if (!S || !S.alerts || !S.alerts.length) return;
    // render() lists alerts newest first, one row per alert, in the same order.
    var list = S.alerts.slice().reverse();
    if (box.children.length !== list.length) return;
    for (var i = 0; i < list.length; i++) {
      var row = box.children[i];
      if (row.querySelector('.pl-by')) continue;
      var k = raisedBy(list[i]);
      var tag = row.querySelector('.tag');
      if (k && tag) tag.insertAdjacentElement('afterend', mkLabel(k, false));
    }
  }

  // Intake red box: red flags come from the fixed rules only (the model never raises a red box).
  function labelRed() {
    var box = $('iv-red'), head = box && box.querySelector('.in-red > b');
    if (!head || head.parentNode.querySelector('.pl-by')) return;
    head.insertAdjacentElement('afterend', mkLabel('rules', true));
  }

  // Ask box output: the model's reason text, or an urgent rules class, names the raiser.
  function labelAsk() {
    var out = $('iv-ans');
    if (!out || !out.querySelector('.in-cite') || hasLabel(out)) return;
    var kind = null;
    if ((out.textContent || '').indexOf(MODEL_REASON) >= 0) kind = 'ai';
    else if (state.lastKn && URGENT[state.lastKn.cls]) kind = 'rules';
    if (kind) out.insertBefore(mkLabel(kind, true), out.firstChild);
  }

  // Intake chat: a bot bubble added in the same task as a model raise gets the AI label.
  function labelChat(records) {
    if (!state.modelRaise) return;
    state.modelRaise = 0;
    var done = false; // only the first bot bubble of the raise is the AI-raised reply; the next question is not
    records.forEach(function (r) {
      Array.prototype.forEach.call(r.addedNodes, function (n) {
        if (!done && n.nodeType === 1 && n.classList.contains('b') && n.classList.contains('bot') && !n.querySelector('.pl-by')) {
          n.appendChild(mkLabel('ai', true));
          done = true;
        }
      });
    });
  }

  function watch(id, fn) {
    var el = $(id);
    if (!el || !window.MutationObserver) return;
    new MutationObserver(function (records) { fn(records); }).observe(el, { childList: true });
  }
  watch('alerts', labelAlerts);
  watch('iv-red', labelRed);
  watch('iv-ans', labelAsk);
  watch('iv-chat', labelChat);

  // Language change: re-word the badge and the labels that are already on screen.
  function relabelAll() {
    renderBadge();
    ['alerts', 'iv-red', 'iv-ans'].forEach(function (id) {
      var el = $(id);
      if (el) Array.prototype.forEach.call(el.querySelectorAll('.pl-by'), function (n) { n.parentNode.removeChild(n); });
    });
    labelAlerts(); labelRed(); labelAsk();
    var out = $('pl-test-out'), btn = $('pl-test-conn');
    if (btn) btn.textContent = T[lang()].test.btn;
  }
  ['iv-lang', 'iv-c-lang'].forEach(function (id) { var e = $(id); if (e) e.addEventListener('change', relabelAll); });

  /* ---------- 3. Test connection ---------- */
  // Reason for an unscreened result, worded by case. The fetch record says whether the proxy answered at all.
  function plainReason(r) {
    var X = T[lang()].test, f = state.lastFetch;
    if (r === 'second check timed out') return X.timeout;
    if (r === 'second check unavailable') {
      if (f && f.error) return X.noconn;
      if (f && f.status === 200) return X.upstream;
      if (f && f.status) return X.http.replace('{s}', String(f.status));
      return X.none;
    }
    if (r === 'second check unparsed') return X.format;
    if (r === 'second check error') return X.failed;
    return r || X.none;
  }
  function runTest() {
    var out = $('pl-test-out'), btn = $('pl-test-conn'), X = T[lang()].test;
    if (!btn || !out) return;
    if (!aiOn()) { out.textContent = X.notTested; return; }
    btn.disabled = true;
    out.textContent = X.testing;
    state.lastFetch = null;
    // One harmless synthetic message through the existing second-check adapter. It is not a patient message.
    window.__plAI.check('Connection test from the settings page. Not a patient message.', { lang: 'en' }).then(function (v) {
      btn.disabled = false;
      if (v && (v.verdict === 'urgent' || v.verdict === 'routine')) { state.checked = true; out.textContent = X.ok; }
      else out.textContent = X.fail + plainReason(v && v.reason) + X.failEnd;
      renderBadge();
    });
  }
  var testBtn = $('pl-test-conn');
  if (testBtn) {
    testBtn.textContent = T[lang()].test.btn;
    testBtn.addEventListener('click', runTest);
  }

  renderBadge();
  labelAlerts();
  // Exposed for the verification script only.
  window.PL_status = { state: state, renderBadge: renderBadge, badgeKind: badgeKind, T: T };
})();
