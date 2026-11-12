'use strict';
// Test for the label scorer. Run: node app/eval/score_labels.test.js
var S = require('./score_labels.js'), P = require('./pool.js');
var fail = 0; function ok(c, l, x) { if (!c) fail++; console.log((c ? 'PASS ' : 'FAIL ') + l + (c || x === undefined ? '' : ' ' + JSON.stringify(x))); }
function near(a, b) { return Math.abs(a - b) < 1e-6; }
// Textbook 2x2: both yes 20, A yes/B no 5, A no/B yes 10, both no 15 -> po 0.70, pe 0.50, kappa 0.40
var a = [], b = []; function push(x, y, n) { for (var i = 0; i < n; i++) { a.push(x); b.push(y); } }
push('y', 'y', 20); push('y', 'n', 5); push('n', 'y', 10); push('n', 'n', 15);
var k = S.kappa(a, b); ok(near(k.po, 0.7) && near(k.pe, 0.5) && near(k.kappa, 0.4), 'kappa: textbook 2x2 table gives 0.40', k);
ok(near(S.kappa(['a', 'b', 'c'], ['a', 'b', 'c']).kappa, 1), 'kappa: perfect agreement is 1');
ok(near(S.kappa(['a', 'a', 'b', 'b'], ['a', 'b', 'a', 'b']).kappa, 0), 'kappa: chance-level agreement is 0');
ok(isNaN(S.kappa([], []).kappa), 'kappa: no shared items gives NaN, not a number that looks real');
var w = S.wilson(9, 10); ok(w[0] > 0.59 && w[0] < 0.6 && w[1] > 0.98, 'wilson: 9 of 10 is about 60% to 98%', w);
// scoreRules with a fake classifier
var L = [{ id: '1', lang: 'en', text: 'E1', label: 'emergency' }, { id: '2', lang: 'en', text: 'E2', label: 'emergency' }, { id: '3', lang: 'en', text: 'S1', label: 'sameday' }, { id: '4', lang: 'ms', text: 'R1', label: 'routine' }, { id: '5', lang: 'ms', text: 'R2', label: 'routine' }, { id: '6', lang: 'ms', text: 'U1', label: 'unsure' }];
var fake = function (t) { return { E1: 'EMERGENCY', E2: 'ROUTE', S1: 'SAME-DAY', R1: 'SAME-DAY', R2: 'ROUTE', U1: 'EMERGENCY' }[t]; };
var r = S.scoreRules(L, fake);
ok(r.all.urgent === 3 && r.all.urgentAlerted === 2 && r.all.emerg === 2 && r.all.emergAlerted === 1 && r.all.emergAsEmerg === 1, 'scoreRules: urgent 2 of 3 alerted, emergency 1 of 2', r.all);
ok(r.all.routine === 2 && r.all.routineAlerted === 1 && r.all.unsure === 1, 'scoreRules: 1 of 2 routine falsely alerted; unsure counted and left out', r.all);
ok(r.all.missedEmerg.length === 1 && r.all.missedEmerg[0] === 'E2' && r.all.falseAlerts[0] === 'R1', 'scoreRules: lists the missed emergency and the false alert');
ok(r.en.urgent === 3 && r.ms.routine === 2 && !r.zh, 'scoreRules: split by language');
// agreement between two labellers
var B = [{ id: '1', label: 'emergency' }, { id: '2', label: 'sameday' }, { id: '3', label: 'sameday' }, { id: '4', label: 'routine' }, { id: '6', label: 'routine' }, { id: '9', label: 'routine' }];
var g = S.agreement(L, B); ok(g.both === 5 && g.unsure === 1 && g.three.n === 4 && near(g.three.po, 0.75) && near(g.two.po, 1) && g.differ.length === 1, 'agreement: only shared items, unsure left out, 3-class 75%, urgent-vs-routine 100%', g);
// pool: blind view carries no label, ids are stable and unique
var pool = P.pool(), bl = P.blind(), ids = {}; pool.forEach(function (x) { ids[x.id] = 1; });
ok(pool.length > 800 && Object.keys(ids).length === pool.length, 'pool: ' + pool.length + ' messages with unique ids');
ok(bl.every(function (x) { return Object.keys(x).sort().join() === 'id,lang,text'; }), 'pool: the blind view has only id, lang and text (no AI label, no set name)');
ok(P.hid('abc') === P.hid('abc') && P.hid('abc') !== P.hid('abd'), 'pool: id is a stable hash of the text');
console.log(fail ? '\n' + fail + ' FAILED' : '\nall scorer checks pass'); process.exit(fail ? 1 : 0);
