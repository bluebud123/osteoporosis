'use strict';
// Builds index.html from src.html (placeholders /*ENGINE*/ and /*CASES*/ in script tags).
//
// Usage:
//   node build.js                       full page -> index.html
//   node build.js --engine-only --out F engine + cases only, no Intake modules (for checking the Tests tab alone)
//
// Each inlined file is wrapped in a function(module, exports, require) so that the modules' own
// UMD code takes the CommonJS branch. A tiny require() resolves by file basename, so
// require('../engine.js') and require('./engine.js') both return the inlined engine.
// Nothing is fetched at build time or at run time. Sample data is fictional.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const args = process.argv.slice(2);
const ENGINE_ONLY = args.includes('--engine-only');
const oi = args.indexOf('--out');
if (ENGINE_ONLY && oi < 0) {
  console.error('--engine-only needs --out <file> so it cannot overwrite index.html');
  process.exit(1);
}
const OUT = oi >= 0 ? path.resolve(args[oi + 1]) : path.join(ROOT, 'index.html');

// All 30 fictional histories are embedded for the Intake tab's "Load a sample patient" picker (grouped by procedure in the page).
const HISTORY_COUNT = 30;

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

function safeCode(rel, code) {
  if (/<\/script/i.test(code) || /<!--/.test(code)) {
    throw new Error(rel + ' contains a sequence that cannot sit inside an inline script');
  }
  return code;
}

function jsonLiteral(v) {
  return JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028")
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029");
}

// Registers one module under a key. `obj` is the variable holding the registry.
function wrap(key, code, obj) {
  return obj + '[' + JSON.stringify(key) + '] = function (module, exports, require) {\n' + code + '\n};\n';
}

function replaceOnce(html, token, code) {
  const n = html.split(token).length - 1;
  if (n !== 1) throw new Error('placeholder ' + token + ' found ' + n + ' times in src.html');
  return html.split(token).join(code);
}

// ---- runtime + engine (replaces /*ENGINE*/) ----
const engineBlock = [
  '(function () {',
  '  var defs = window.__plDefs = {};',
  '  var cache = {};',
  '  window.__plReq = function (p) {',
  "    var key = String(p).split('/').pop().replace(/\\.(js|json)$/, '');",
  '    if (!Object.prototype.hasOwnProperty.call(cache, key)) {',
  "      if (!Object.prototype.hasOwnProperty.call(defs, key)) throw new Error('module not bundled: ' + p);",
  '      var mod = { exports: {} };',
  '      cache[key] = mod;',
  '      defs[key].call(mod.exports, mod, mod.exports, window.__plReq);',
  '    }',
  '    return cache[key].exports;',
  '  };',
  wrap('engine', safeCode('engine.js', read('engine.js')), 'defs'),
  "  window.PeriLoop = window.__plReq('engine');",
  '})();'
].join('\n');

// ---- cases + Intake modules (replaces /*CASES*/) ----
const mods = [];
if (!ENGINE_ONLY) {
  ['idmap', 'interview', 'intake', 'knowledge', 'adapter', 'second_check'].forEach(name => {
    mods.push(wrap(name, safeCode('mod/' + name + '.js', read('mod/' + name + '.js')), 'defs'));
  });
  const sources = JSON.parse(read('mod/sources.sample.json'));
  mods.push(wrap('sources.sample', 'module.exports = ' + jsonLiteral(sources) + ';', 'defs'));
  const picked = JSON.parse(read('mod/histories.json'));
  if (picked.length !== HISTORY_COUNT) throw new Error('expected ' + HISTORY_COUNT + ' histories, found ' + picked.length);
  mods.push(wrap('histories', 'module.exports = ' + jsonLiteral(picked) + ';', 'defs'));
}

const exportsLines = [
  "window.PeriCases = window.__plReq('cases');"
];
if (!ENGINE_ONLY) {
  exportsLines.push(
    "window.PL_IDMAP = window.__plReq('idmap');",
    "window.PL_INTERVIEW = window.__plReq('interview');",
    "window.PL_INTAKE = window.__plReq('intake');",
    "window.PL_KNOWLEDGE = window.__plReq('knowledge');",
    "window.PL_adapter = window.__plReq('adapter');",
    "window.PL_secondCheck = window.__plReq('second_check');",
    "window.PL_SOURCES = window.__plReq('sources.sample');",
    "window.PL_HISTORIES = window.__plReq('histories');"
  );
}

const casesBlock = [
  '(function () {',
  '  var defs = window.__plDefs;',
  wrap('cases', safeCode('cases.js', read('cases.js')), 'defs'),
  mods.join('\n'),
  exportsLines.join('\n'),
  '})();'
].join('\n');

const src = read('src.html');
let html = replaceOnce(src, '/*ENGINE*/', engineBlock);
html = replaceOnce(html, '/*CASES*/', casesBlock);

fs.writeFileSync(OUT, html);
console.log('wrote ' + OUT + ' (' + Buffer.byteLength(html) + ' bytes, ' + (ENGINE_ONLY ? 'engine-only' : 'full') + ')');
