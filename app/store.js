'use strict';
// Tiny JSON-file store. One file, written atomically (temp file, then rename). No dependencies.
var fs = require('fs'), path = require('path');
function open(dir) {
  fs.mkdirSync(dir, { recursive: true });
  var file = path.join(dir, 'db.json');
  var db = null;
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { db = null; }
  function save() {
    var tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
    fs.renameSync(tmp, file);
  }
  return { get db() { return db; }, set db(v) { db = v; }, save: save, file: file };
}
module.exports = { open: open };
