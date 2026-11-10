'use strict';
/* Regression test: the three held-out message sets, two guard sets and two threshold sets, driven through the real HTTP entry
 * points with the AI off (rules only). Run: node app/eval/holdout.test.js
 * IMPORTANT: these sets guided the fixes, so 100% here is NOT the real-world rate. The honest numbers are the "fresh"
 * scores recorded in docs/decision-log.md (measured once, before each set was used to fix anything). */
var http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
process.env.PERILOOP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'plh-')); process.env.PERILOOP_NO_SEED = '1'; delete process.env.PROVIDER_BASE_URL; delete process.env.PROVIDER_KEY;
var fail = 0; function ok(c, label, extra) { if (!c) fail++; console.log((c ? 'PASS ' : 'FAIL ') + label + (c || extra === undefined ? '' : ' ' + JSON.stringify(extra))); }
function call(port, method, p, body, cookie) { return new Promise(function (res) { var d = body ? JSON.stringify(body) : null; var q = http.request({ port: port, path: p, method: method, headers: Object.assign({ 'content-type': 'application/json', 'x-requested-with': 'periloop' }, cookie ? { cookie: cookie } : {}) }, function (r) { var c = []; r.on('data', function (x) { c.push(x); }); r.on('end', function () { var t = Buffer.concat(c).toString(), j; try { j = JSON.parse(t); } catch (e) { j = t; } res({ status: r.statusCode, json: j, cookie: (r.headers['set-cookie'] || [''])[0].split(';')[0] }); }); }); if (d) q.write(d); q.end(); }); }
function ds(off) { var d = new Date(Date.now() + off * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
(async function () {
  var S = require('../server.js'), srv = S.createServer(); await new Promise(function (r) { srv.listen(0, r); }); var port = srv.address().port;
  var doc = (await call(port, 'POST', '/api/login', { username: 'doctor', password: 'doctor-demo-1' })).cookie, n = 0;
  async function cls(text) { n++; var a = await call(port, 'POST', '/api/patients', { name: 'H' + n, rn: 'H' + String(n).padStart(4, '0'), procedure: 'TKR', otDate: ds(-4), lang: 'en' }, doc); await call(port, 'POST', '/api/live/send', { pid: a.json.id, text: text }, doc); var d = (await call(port, 'GET', '/api/patients/' + a.json.id, null, doc)).json; return d.messages.filter(function (x) { return x.who === 'patient'; })[0].cls; }
  for (var set of ['triage_h1', 'triage_h2', 'triage_h3']) {
    var T = require('./' + set + '.js'), missE = [], notE = [], missS = [], fp = [];
    for (var c of T.E) { var k = await cls(c[1]); if (k !== 'EMERGENCY' && k !== 'SAME-DAY') missE.push(c[1]); else if (k !== 'EMERGENCY') notE.push(c[1]); }
    for (var c2 of T.S) { var k2 = await cls(c2[1]); if (k2 !== 'EMERGENCY' && k2 !== 'SAME-DAY') missS.push(c2[1]); }
    for (var c3 of T.N) { var k3 = await cls(c3[1]); if (k3 === 'EMERGENCY' || k3 === 'SAME-DAY') fp.push(c3[1]); }
    ok(!missE.length, set + ': every emergency message raises an alert (' + (T.E.length - missE.length) + '/' + T.E.length + ')', missE);
    ok(!notE.length, set + ': every emergency message is classed EMERGENCY (' + (T.E.length - missE.length - notE.length) + '/' + T.E.length + ')', notE);
    ok(!missS.length, set + ': every same-day message raises an alert (' + (T.S.length - missS.length) + '/' + T.S.length + ')', missS);
    ok(!fp.length, set + ': no ordinary message raises an alert (' + fp.length + '/' + T.N.length + ' false alerts)', fp);
  }
  var pts = {};
  for (var rs of ['readings_h1', 'readings_h2']) {
    var R = require('./' + rs + '.js'), bad = [];
    for (var x of R) { if (!pts[x[2]]) { n++; pts[x[2]] = (await call(port, 'POST', '/api/patients', { name: 'R' + n, rn: 'R' + String(n).padStart(4, '0'), procedure: 'TKR', otDate: ds(-x[2]), lang: 'en' }, doc)).json.id; }
      var rr = await call(port, 'POST', '/api/patients/' + pts[x[2]] + '/readings', { param: x[0], value: x[1] }, doc); var lv = rr.json.hits && rr.json.hits.length ? (rr.json.hits.some(function (h) { return h.level === 'red'; }) ? 'red' : 'amber') : 'none';
      if (lv !== x[3]) bad.push(x[0] + ' ' + x[1] + ' day ' + x[2] + ': expected ' + x[3] + ', got ' + lv); }
    ok(!bad.length, rs + ': every reading gets the expected level (' + (R.length - bad.length) + '/' + R.length + ')', bad);
  }
  var G = require('../guard.js');
  for (var gs of ['guard_h1', 'guard_h2']) {
    var D = require('./' + gs + '.js'), blockedOk = [], leaked = [];
    D.OK.forEach(function (c) { if (!G.check(c[1], c[0]).ok) blockedOk.push(c[1]); });
    // "leaked" = any part of the unsafe sentence is shown. A reply shown with the unsafe sentence removed is not a leak.
    D.BAD.forEach(function (c) { var v = G.check(c[1], c[0]); if (!v.ok) return; var parts = c[1].split(/(?<=[.!?。])\s*/).filter(Boolean); var unsafe = parts[parts.length - 1]; if (v.text.indexOf(unsafe) >= 0) leaked.push(c[1]); });
    ok(!leaked.length, gs + ': no unsafe model sentence is shown to a patient (' + (D.BAD.length - leaked.length) + '/' + D.BAD.length + ' stopped)', leaked);
    ok(blockedOk.length <= 1, gs + ': harmless replies are allowed (' + (D.OK.length - blockedOk.length) + '/' + D.OK.length + ')', blockedOk);
  }
  await S.drain(); srv.close(); console.log(fail ? '\n' + fail + ' FAILED' : '\nall held-out sets pass'); process.exit(fail ? 1 : 0);
})();
