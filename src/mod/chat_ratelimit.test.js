/* Unit tests for the chat proxy rate limiter (mod/server/chat.js makeLimiter). No network.
 * Run: node mod/chat_ratelimit.test.js   (expects every line PASS)
 */
'use strict';

var assert = require('assert');
var chat = require('./server/chat.js');

var results = [];
function check(name, fn) {
  try { fn(); results.push([name, true]); } catch (e) { results.push([name, false, e && e.message]); }
}

check('limit N allows exactly N requests in a window, then blocks', function () {
  var lim = chat.makeLimiter(3, 1000);
  assert.strictEqual(lim('a', 0), false);
  assert.strictEqual(lim('a', 1), false);
  assert.strictEqual(lim('a', 2), false);
  assert.strictEqual(lim('a', 3), true);
  assert.strictEqual(lim('a', 4), true);
});

check('the window resets after windowMs', function () {
  var lim = chat.makeLimiter(2, 1000);
  assert.strictEqual(lim('a', 0), false);
  assert.strictEqual(lim('a', 1), false);
  assert.strictEqual(lim('a', 2), true);
  assert.strictEqual(lim('a', 1000), false, 'a new window starts at the reset time');
});

check('each IP has its own count', function () {
  var lim = chat.makeLimiter(1, 1000);
  assert.strictEqual(lim('a', 0), false);
  assert.strictEqual(lim('a', 0), true);
  assert.strictEqual(lim('b', 0), false);
});

check('two limiters do not share counts (intake and second_check buckets are separate)', function () {
  var intake = chat.makeLimiter(1, 1000);
  var second = chat.makeLimiter(1, 1000);
  assert.strictEqual(intake('a', 0), false);
  assert.strictEqual(intake('a', 0), true);
  assert.strictEqual(second('a', 0), false, 'an exhausted intake bucket must not block second checks');
});

check('second_check limit is 60 per minute and intake stays at 20', function () {
  assert.strictEqual(chat.SECOND_CHECK_RATE_LIMIT, 60);
  assert.strictEqual(chat.INTAKE_RATE_LIMIT, 20);
  var lim = chat.makeLimiter(chat.SECOND_CHECK_RATE_LIMIT, 60 * 1000);
  for (var i = 0; i < 60; i++) assert.strictEqual(lim('ip', 0), false, 'request ' + (i + 1) + ' should pass');
  assert.strictEqual(lim('ip', 0), true, 'request 61 should be limited');
});

var fail = 0;
results.forEach(function (r) {
  if (r[1]) console.log('PASS ' + r[0]);
  else { fail++; console.log('FAIL ' + r[0] + ' :: ' + r[2]); }
});
console.log('\n' + (results.length - fail) + ' PASS, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
