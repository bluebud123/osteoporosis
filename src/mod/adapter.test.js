/* Tests for mod/adapter.js. Fake fetch only; no network, no real keys. Run: node mod/adapter.test.js */
'use strict';

var assert = require('assert');
var A = require('./adapter.js');
var engine = require('../engine.js');

var results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(
    function () { results.push([name, true]); },
    function (e) { results.push([name, false, e && e.message]); }
  );
}

// Fake fetch: records every call, replies with an OpenAI-style body or a proxy-style body.
function fakeFetch(replyText, opts) {
  opts = opts || {};
  var calls = [];
  var fn = function (url, init) {
    calls.push({ url: url, init: init });
    if (opts.reject) return Promise.reject(new Error('network down'));
    return Promise.resolve({
      ok: opts.ok !== false,
      json: function () {
        return Promise.resolve(opts.shape === 'proxy'
          ? { text: replyText }
          : { choices: [{ message: { content: replyText } }] });
      }
    });
  };
  fn.calls = calls;
  return fn;
}

var STEP = { id: 'q1', text: { en: 'Do you smoke?', ms: 'Adakah anda merokok?', zh: '您吸烟吗？' } };
var SECRET = 'SK-TEST-0000-NOT-REAL';

var tests = [
  check('scripted mode makes no network call and returns the step text', function () {
    var f = fakeFetch('should not be used');
    var ad = A.createAdapter({ mode: 'scripted', baseUrl: 'https://api.deepseek.com', apiKey: SECRET, fetchImpl: f });
    return ad.ask([{ role: 'user', content: 'hi' }], { step: STEP, lang: 'en' }).then(function (out) {
      assert.strictEqual(f.calls.length, 0);
      assert.strictEqual(out.text, 'Do you smoke?');
      assert.strictEqual(out.mode, 'scripted');
      assert.strictEqual(out.provider, 'scripted');
    });
  }),

  check('no config at all falls back to scripted without throwing', function () {
    var f = fakeFetch('x');
    var ad = A.createAdapter({ mode: 'ai', fetchImpl: f });
    return ad.ask([], { step: STEP, lang: 'ms' }).then(function (out) {
      assert.strictEqual(f.calls.length, 0);
      assert.strictEqual(out.text, 'Adakah anda merokok?');
    });
  }),

  check('scripted fallback picks language and survives a rejecting fetch', function () {
    var f = fakeFetch(null, { reject: true });
    var ad = A.createAdapter({ mode: 'ai', proxyUrl: 'https://proxy.example/chat', fetchImpl: f });
    return ad.ask([{ role: 'user', content: 'hello' }], { step: STEP, lang: 'zh' }).then(function (out) {
      assert.strictEqual(f.calls.length, 1);
      assert.strictEqual(out.text, '您吸烟吗？');
      assert.strictEqual(out.mode, 'scripted');
    });
  }),

  check('proxyUrl mode: key never appears in any browser-side request', function () {
    var f = fakeFetch('Summary: patient reports knee pain.', { shape: 'proxy' });
    var ad = A.createAdapter({ mode: 'ai', proxyUrl: 'https://proxy.example/chat', baseUrl: 'https://api.deepseek.com', apiKey: SECRET, fetchImpl: f });
    return ad.ask([{ role: 'user', content: 'my knee hurts' }], { json: true }).then(function (out) {
      assert.strictEqual(f.calls.length, 1);
      assert.strictEqual(f.calls[0].url, 'https://proxy.example/chat');
      assert.ok(JSON.stringify(f.calls[0]).indexOf(SECRET) < 0, 'key leaked into request');
      assert.strictEqual(out.mode, 'ai');
      assert.strictEqual(out.text, 'Summary: patient reports knee pain.');
    });
  }),

  check('every model call starts with the SYSTEM_GUARD', function () {
    var f = fakeFetch('ok');
    var ad = A.createAdapter({ mode: 'ai', proxyUrl: 'https://proxy.example/chat', fetchImpl: f });
    return ad.ask([{ role: 'user', content: 'x' }], {}).then(function () {
      var body = JSON.parse(f.calls[0].init.body);
      assert.strictEqual(body.messages[0].role, 'system');
      assert.strictEqual(body.messages[0].content, A.SYSTEM_GUARD);
      assert.ok(/NEVER give a diagnosis/.test(A.SYSTEM_GUARD));
    });
  }),

  check('direct mode posts to baseUrl + endpoint with bearer key and guard', function () {
    var f = fakeFetch('Which day is your surgery?'); // a reply the output guard accepts (a question)
    var ad = A.createAdapter({ mode: 'ai', baseUrl: 'https://api.deepseek.com/', apiKey: SECRET, model: 'deepseek-chat', fetchImpl: f });
    return ad.ask([{ role: 'user', content: 'x' }], { json: true }).then(function (out) {
      assert.strictEqual(f.calls[0].url, 'https://api.deepseek.com/v1/chat/completions');
      assert.strictEqual(f.calls[0].init.headers.authorization, 'Bearer ' + SECRET);
      var body = JSON.parse(f.calls[0].init.body);
      assert.strictEqual(body.messages[0].role, 'system');
      assert.deepStrictEqual(body.response_format, { type: 'json_object' });
      assert.strictEqual(out.text, 'Which day is your surgery?');
    });
  }),

  check('askSafely: EMERGENCY returns engine reply and never calls fetch', function () {
    var f = fakeFetch('model said something');
    var ad = A.createAdapter({ mode: 'ai', proxyUrl: 'https://proxy.example/chat', fetchImpl: f });
    return A.askSafely(ad, "I can't breathe and my chest is tight", engine.classify, { ctx: { procedure: 'TKR' } }).then(function (out) {
      assert.strictEqual(f.calls.length, 0);
      assert.strictEqual(out.cls, 'EMERGENCY');
      assert.strictEqual(out.text, engine.classify("I can't breathe and my chest is tight", { procedure: 'TKR' }).reply);
      assert.strictEqual(out.botAnswered, false);
    });
  }),

  check('askSafely: SAME-DAY returns engine reply and never calls fetch', function () {
    var f = fakeFetch('model said something');
    var ad = A.createAdapter({ mode: 'ai', proxyUrl: 'https://proxy.example/chat', fetchImpl: f });
    return A.askSafely(ad, 'my wound is very red and oozing pus with a fever', engine.classify, { ctx: { procedure: 'TKR' } }).then(function (out) {
      assert.strictEqual(f.calls.length, 0);
      assert.strictEqual(out.cls, 'SAME-DAY');
    });
  }),

  // round 5 (expectation changed): this used "what time should I come in", which the engine classes ROUTE (no approved answer),
  // and ROUTE must never reach a model. The routine case is now an approved answer (ANSWER), which still goes to the model.
  check('askSafely: an approved-answer question (ANSWER) still goes to the model', function () {
    var f = fakeFetch('Which day is your surgery?', { shape: 'proxy' });
    var ad = A.createAdapter({ mode: 'ai', proxyUrl: 'https://proxy.example/chat', fetchImpl: f });
    return A.askSafely(ad, 'can I shower if the waterproof dressing is still on', engine.classify, { ctx: { procedure: 'TKR' } }).then(function (out) {
      assert.strictEqual(f.calls.length, 1);
      assert.strictEqual(out.text, 'Which day is your surgery?');
    });
  }),

  // round 5 (AI mode): ROUTE, EMERGENCY and SAME-DAY texts never reach the model. Each one returns the engine's fixed reply.
  ['can I stop my warfarin', 'can I fly', 'chest pain', 'what time should I come in'].forEach(function (txt) {
    check('askSafely round 5: "' + txt + '" makes zero model calls and returns the engine reply', function () {
      var f = fakeFetch('model said something');
      var ad = A.createAdapter({ mode: 'ai', proxyUrl: 'https://proxy.example/chat', fetchImpl: f });
      var want = engine.classify(txt, { procedure: 'TKR' });
      return A.askSafely(ad, txt, engine.classify, { ctx: { procedure: 'TKR' } }).then(function (out) {
        assert.strictEqual(f.calls.length, 0, 'model was called for: ' + txt);
        assert.ok(['ROUTE', 'EMERGENCY', 'SAME-DAY'].indexOf(out.cls) >= 0, 'class ' + out.cls);
        assert.strictEqual(out.cls, want.cls);
        assert.strictEqual(out.text, want.reply);
        assert.strictEqual(out.botAnswered, false);
      });
    });
  }),

  check('askSafely round 5: a missing classifier makes zero model calls', function () {
    var f = fakeFetch('x');
    var ad = A.createAdapter({ mode: 'ai', proxyUrl: 'https://proxy.example/chat', fetchImpl: f });
    return A.askSafely(ad, 'can I shower if the waterproof dressing is still on', undefined, {}).then(function (out) {
      assert.strictEqual(f.calls.length, 0);
      assert.strictEqual(out.mode, 'blocked');
    });
  }),

  check('askSafely: a throwing classifier does not reach the model', function () {
    var f = fakeFetch('x');
    var ad = A.createAdapter({ mode: 'ai', proxyUrl: 'https://proxy.example/chat', fetchImpl: f });
    return A.askSafely(ad, 'anything', function () { throw new Error('boom'); }).then(function (out) {
      assert.strictEqual(f.calls.length, 0);
      assert.strictEqual(out.mode, 'blocked');
    });
  }),

  check('provider swap by config only gives the same call shape', function () {
    var configs = [
      A.presets.deepseek,
      A.presets.local,
      { provider: 'custom', baseUrl: 'https://llm.example.org', model: 'some-model' }
    ];
    var shapes = configs.map(function (p) {
      var f = fakeFetch('ok');
      var ad = A.createAdapter({ mode: 'ai', baseUrl: p.baseUrl, model: p.model, apiKey: SECRET, fetchImpl: f });
      return ad.ask([{ role: 'user', content: 'x' }], {}).then(function (out) {
        var c = f.calls[0];
        var body = JSON.parse(c.init.body);
        return {
          path: c.url.replace(p.baseUrl, ''),
          method: c.init.method,
          headers: Object.keys(c.init.headers).sort().join(','),
          bodyKeys: Object.keys(body).sort().join(','),
          msgRoles: body.messages.map(function (m) { return m.role; }).join(','),
          text: out.text
        };
      });
    });
    return Promise.all(shapes).then(function (rows) {
      rows.forEach(function (r) {
        assert.deepStrictEqual(r, rows[0]);
      });
      assert.strictEqual(rows[0].path, '/v1/chat/completions');
    });
  }),

  check('deepseek preset carries the documented base URL and model', function () {
    assert.strictEqual(A.presets.deepseek.baseUrl, 'https://api.deepseek.com');
    assert.strictEqual(A.presets.deepseek.model, 'deepseek-chat');
    assert.strictEqual(A.presets.local.baseUrl, 'http://localhost:8000');
  }),

  check('ai mode with a key but no proxy stays scripted when run in a browser-like global', function () {
    var f = fakeFetch('x');
    global.window = {}; global.document = {};
    var ad;
    try {
      ad = A.createAdapter({ mode: 'ai', baseUrl: 'https://api.deepseek.com', apiKey: SECRET, fetchImpl: f });
      return ad.ask([], { step: STEP }).then(function (out) {
        assert.strictEqual(f.calls.length, 0);
        assert.strictEqual(out.mode, 'scripted');
      });
    } finally { delete global.window; delete global.document; }
  })
];

Promise.all(tests).then(function () {
  var pass = results.filter(function (r) { return r[1]; }).length;
  var fail = results.length - pass;
  results.forEach(function (r) {
    console.log((r[1] ? 'PASS ' : 'FAIL ') + r[0] + (r[1] ? '' : ' :: ' + r[2]));
  });
  console.log('\n' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
});
