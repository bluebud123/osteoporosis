'use strict';
/* v7.1 check: the safety call must survive load. A mock provider rejects (HTTP 429) whenever more than 4 calls are in flight,
 * which is how the real-model run of 12 Nov lost most of its second checks. 40 messages are sent 8 at a time with the staff
 * summary and patient-fact calls ON (not evaluation mode). The gate in app/ai.js must keep every second check alive.
 *   node app/eval/load.test.js */
var http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
process.env.PERILOOP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'load-')); process.env.PERILOOP_NO_SEED = '1'; delete process.env.PERILOOP_EVAL;
process.env.PROVIDER_BASE_URL = 'http://localhost:9779'; process.env.PROVIDER_KEY = 'x'; process.env.PROVIDER_MODEL = 'mock'; process.env.AI_RETRY_WAIT_MS = '200';
var inflight = 0, peak = 0, n429 = 0, total = 0;
var mock = http.createServer(function (q, r) { var b = ''; q.on('data', function (c) { b += c; }); q.on('end', function () { total++; inflight++; peak = Math.max(peak, inflight);
  if (inflight > 4) { inflight--; n429++; r.writeHead(429, { 'content-type': 'application/json' }); return r.end('{"error":"rate limit"}'); }
  setTimeout(function () { inflight--; var sys = JSON.parse(b).messages[0].content, c = /triage second-check/.test(sys) ? '{"verdict":"routine","reason":"mock"}' : /THEMSELVES/.test(sys) ? '[]' : /staff-only profile/.test(sys) ? 'Summary: a.\nCommunication: b.\nApproach: c.' : 'Thanks. Is there anything else you would like to ask?';
    r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify({ choices: [{ message: { content: c } }] })); }, 60); }); });
function call(port, method, p, body, cookie) { return new Promise(function (res) { var d = body ? JSON.stringify(body) : null; var q = http.request({ port: port, path: p, method: method, headers: Object.assign({ 'content-type': 'application/json', 'x-requested-with': 'periloop' }, cookie ? { cookie: cookie } : {}) }, function (r) { var c = []; r.on('data', function (x) { c.push(x); }); r.on('end', function () { var j; try { j = JSON.parse(Buffer.concat(c).toString()); } catch (e) { j = null; } res({ status: r.statusCode, json: j, cookie: (r.headers['set-cookie'] || [''])[0].split(';')[0] }); }); }); if (d) q.write(d); q.end(); }); }
(async function () {
  await new Promise(function (r) { mock.listen(9779, r); });
  var S = require('../server.js'), srv = S.createServer(); await new Promise(function (r) { srv.listen(0, r); }); var port = srv.address().port, fail = 0;
  function ok(c, name, extra) { console.log((c ? 'PASS ' : 'FAIL ') + name + (c || extra === undefined ? '' : '  -> ' + JSON.stringify(extra))); if (!c) fail++; }
  var doc = (await call(port, 'POST', '/api/login', { username: 'doctor', password: 'doctor-demo-1' })).cookie, ids = [];
  for (var i = 0; i < 40; i++) ids.push((await call(port, 'POST', '/api/patients', { name: 'L' + i, rn: 'LOAD-' + i, age: 60, sex: 'F', procedure: 'TKR', otDate: '2099-01-05', lang: 'en' }, doc)).json.id);
  var q = ids.slice(); await Promise.all(Array.from({ length: 8 }, async function () { while (q.length) await call(port, 'POST', '/api/live/send', { pid: q.shift(), text: 'how long should i keep the bandage on my knee' }, doc); }));
  await S.drain();
  var un = 0; for (var k = 0; k < ids.length; k++) { var d = (await call(port, 'GET', '/api/patients/' + ids[k], null, doc)).json; if (d.messages.some(function (m) { return m.unscreened; })) un++; }
  ok(un === 0, 'load: 40 messages sent 8 at a time, every second check answered', { unscreened: un });
  ok(peak <= 3 && n429 === 0, 'load: never more than 3 model calls in flight, so the mock provider rejected none', { peak: peak, rejected: n429, calls: total });
  srv.close(); mock.close(); console.log('\n' + (fail ? 'FAILED' : 'all passed')); process.exit(fail ? 1 : 0);
})();
