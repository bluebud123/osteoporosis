'use strict';
var E = require('../engine.js'), fails = 0, n = 0;
function chk(t, want, ctx) { n++; var r = E.classify(t, ctx || { procedure: 'TKR' }); if (r.cls !== want) { fails++; console.log('FAIL', JSON.stringify(t), 'got', r.cls, 'want', want); } }
chk('since last night got a tight feeling in chest and my left arm tingly, sorry maybe nothing but want to ask', 'EMERGENCY');
chk('my chest feels heavy and my jaw is numb', 'EMERGENCY');
chk('dada saya sesak dan lengan kiri kebas', 'EMERGENCY');
chk('我胸口很闷，左手发麻', 'EMERGENCY');
chk('no chest pain, no arm numbness', 'ROUTE');
chk('chest x-ray is tomorrow and my arm is still painful', 'ROUTE', { procedure: 'SHOULDER' });
chk('my knee feels tight when I bend it', 'ROUTE');
console.log('cardiac_arm: ' + (n - fails) + '/' + n); process.exit(fails ? 1 : 0);
