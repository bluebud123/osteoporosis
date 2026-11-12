'use strict';
/* The pool of test messages for blind clinician labelling: h1..h5 and the 360-message library, de-duplicated.
 * id = a short hash of the text, so an exported label file can be matched back without carrying the AI label. */
var fs = require('fs'), path = require('path');
function hid(text) { var h = 5381, s = String(text); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return 'm' + h.toString(36) + s.length.toString(36); }
function pool() {
  var out = [], seen = {};
  function add(set, lang, text, ai) { var id = hid(text); if (seen[id]) return; seen[id] = 1; out.push({ id: id, set: set, lang: lang, text: text, ai: ai }); }
  ['h1', 'h2', 'h3', 'h4', 'h5'].forEach(function (h) { var f = path.join(__dirname, 'triage_' + h + '.js'); if (!fs.existsSync(f)) return; var T = require(f); T.E.forEach(function (c) { add(h, c[0], c[1], 'emergency'); }); T.S.forEach(function (c) { add(h, c[0], c[1], 'sameday'); }); T.N.forEach(function (c) { add(h, c[0], c[1], 'routine'); }); });
  try { JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', 'messages.json'), 'utf8')).forEach(function (m) { add('library', m.lang, m.text, m.truth === 'urgent' ? 'urgent' : 'routine'); }); } catch (e) { /* library missing: sets only */ }
  return out;
}
// What the labeller is allowed to see: no AI label, no set name.
function blind() { return pool().map(function (x) { return { id: x.id, lang: x.lang, text: x.text }; }); }
module.exports = { hid: hid, pool: pool, blind: blind };
if (require.main === module) { // node app/eval/pool.js > pool.json  (for using label.html as a static file)
  process.stdout.write(JSON.stringify(blind()));
}
