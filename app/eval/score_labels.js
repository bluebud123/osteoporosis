'use strict';
/* Score the fixed rules against clinician labels exported from label.html, and agreement between two labellers.
 *
 *   node app/eval/score_labels.js labels_AB.json                 one labeller: rules vs this clinician, per language
 *   node app/eval/score_labels.js labels_AB.json labels_CD.json  two labellers: the above for each, plus Cohen's kappa
 *
 * Rules only (no AI). "Urgent" = the clinician chose Emergency or Same-day. "Unsure" labels are counted and left out.
 * Honest reading: this is the first number in the project with a clinician in it, but the messages are still invented. */
var fs = require('fs'), path = require('path');

// Cohen's kappa for two lists of category labels of equal length.
function kappa(a, b) {
  var n = a.length; if (!n || n !== b.length) return { n: n, po: NaN, pe: NaN, kappa: NaN };
  var cats = {}, agree = 0, ca = {}, cb = {};
  for (var i = 0; i < n; i++) { cats[a[i]] = cats[b[i]] = 1; if (a[i] === b[i]) agree++; ca[a[i]] = (ca[a[i]] || 0) + 1; cb[b[i]] = (cb[b[i]] || 0) + 1; }
  var po = agree / n, pe = 0; Object.keys(cats).forEach(function (c) { pe += ((ca[c] || 0) / n) * ((cb[c] || 0) / n); });
  return { n: n, po: po, pe: pe, kappa: pe === 1 ? 1 : (po - pe) / (1 - pe) };
}
// Wilson 95% interval for k of n.
function wilson(k, n) { if (!n) return [NaN, NaN]; var z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), w = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - w) / d, (c + w) / d]; }
function urgent(l) { return l === 'emergency' || l === 'sameday'; }

// labels: [{id, lang, text, label}], classify: function(text) -> 'EMERGENCY' | 'SAME-DAY' | other
function scoreRules(labels, classify) {
  var by = {}; function g(l) { return by[l] || (by[l] = { n: 0, unsure: 0, urgent: 0, urgentAlerted: 0, emerg: 0, emergAlerted: 0, emergAsEmerg: 0, routine: 0, routineAlerted: 0, missedEmerg: [], missedUrgent: [], falseAlerts: [] }); }
  labels.forEach(function (x) {
    var cls = classify(x.text), al = cls === 'EMERGENCY' || cls === 'SAME-DAY';
    [x.lang, 'all'].forEach(function (l) {
      var r = g(l); r.n++;
      if (x.label === 'unsure') { r.unsure++; return; }
      if (urgent(x.label)) { r.urgent++; if (al) r.urgentAlerted++; else if (x.label !== 'emergency' && l === 'all') r.missedUrgent.push(x.text); }
      if (x.label === 'emergency') { r.emerg++; if (al) r.emergAlerted++; else if (l === 'all') r.missedEmerg.push(x.text); if (cls === 'EMERGENCY') r.emergAsEmerg++; }
      if (x.label === 'routine') { r.routine++; if (al) { r.routineAlerted++; if (l === 'all') r.falseAlerts.push(x.text); } }
    });
  });
  return by;
}
// Agreement between two labellers on the messages both labelled. Unsure from either side is left out.
function agreement(A, B) {
  var mb = {}; B.forEach(function (x) { mb[x.id] = x.label; });
  var a3 = [], b3 = [], a2 = [], b2 = [], both = 0, unsure = 0, differ = [];
  A.forEach(function (x) { if (!(x.id in mb)) return; both++; var y = mb[x.id]; if (x.label === 'unsure' || y === 'unsure') { unsure++; return; }
    a3.push(x.label); b3.push(y); a2.push(urgent(x.label) ? 'u' : 'r'); b2.push(urgent(y) ? 'u' : 'r'); if (x.label !== y) differ.push({ text: x.text, a: x.label, b: y }); });
  return { both: both, unsure: unsure, three: kappa(a3, b3), two: kappa(a2, b2), differ: differ };
}
function fmt(k, n) { if (!n) return '-'; var w = wilson(k, n); return k + '/' + n + ' (' + Math.round(100 * k / n) + '%, 95% CI ' + Math.round(100 * w[0]) + ' to ' + Math.round(100 * w[1]) + ')'; }
function report(file, labels, by) {
  var out = '## ' + file + '\n\n| Language | Labelled | Unsure | Clinician-urgent that the rules alerted | Clinician-emergency that the rules alerted | ...and classed EMERGENCY | Clinician-routine that the rules alerted |\n|---|---|---|---|---|---|---|\n';
  ['en', 'ms', 'zh', 'ar', 'all'].forEach(function (l) { var r = by[l]; if (!r) return; out += '| ' + l + ' | ' + r.n + ' | ' + r.unsure + ' | ' + fmt(r.urgentAlerted, r.urgent) + ' | ' + fmt(r.emergAlerted, r.emerg) + ' | ' + fmt(r.emergAsEmerg, r.emerg) + ' | ' + fmt(r.routineAlerted, r.routine) + ' |\n'; });
  var a = by.all || { missedEmerg: [], missedUrgent: [], falseAlerts: [] };
  function list(t, x) { return '\n' + t + ' (' + x.length + '):\n' + (x.length ? x.map(function (s) { return '- ' + s; }).join('\n') : '- none') + '\n'; }
  return out + list('Clinician said EMERGENCY, rules raised nothing', a.missedEmerg) + list('Clinician said same-day, rules raised nothing', a.missedUrgent) + list('Clinician said routine, rules alerted', a.falseAlerts);
}
function readLabels(f) { var j = JSON.parse(fs.readFileSync(f, 'utf8')); if (!j || !Array.isArray(j.labels)) throw new Error(f + ' is not an export from label.html'); return j; }

module.exports = { kappa: kappa, wilson: wilson, scoreRules: scoreRules, agreement: agreement };

if (require.main === module) {
  var files = process.argv.slice(2).filter(function (a) { return a[0] !== '-'; });
  if (!files.length || files.length > 2) { console.error('Usage: node app/eval/score_labels.js labels_A.json [labels_B.json]\nMake the files with the labelling page: log in as a doctor, then open /eval/label'); process.exit(2); }
  var TR = require('../triage.js'), POOL = {}; require('./pool.js').pool().forEach(function (x) { POOL[x.id] = x; });
  var cls = function (t) { return TR.classify(t, { procedure: 'TKR' }).cls; };
  var sets = files.map(readLabels), md = '# Rules against clinician labels\n\nRules only, no AI. Messages are invented; labels are from the named labeller(s).\n\n';
  sets.forEach(function (s, i) {
    md += report(path.basename(files[i]) + ' (labeller ' + s.labeller + ', ' + s.labels.length + ' labels)', s.labels, scoreRules(s.labels, cls));
    var a = [], b = []; s.labels.forEach(function (x) { var p = POOL[x.id]; if (!p || x.label === 'unsure') return; a.push(urgent(x.label) ? 'u' : 'r'); b.push(p.ai === 'routine' ? 'r' : 'u'); });
    var k = kappa(a, b); md += '\nAgreement of this labeller with the AI-written labels (urgent vs routine, ' + k.n + ' messages): ' + Math.round(100 * k.po) + '% raw, Cohen\'s kappa ' + k.kappa.toFixed(2) + '.\n\n';
  });
  if (sets.length === 2) {
    var g = agreement(sets[0].labels, sets[1].labels);
    md += '## Agreement between ' + sets[0].labeller + ' and ' + sets[1].labeller + '\n\nBoth labelled ' + g.both + ' messages (' + g.unsure + ' left out because one said Unsure).\n- Emergency / same-day / routine: ' + Math.round(100 * g.three.po) + '% raw agreement, Cohen\'s kappa ' + g.three.kappa.toFixed(2) + '\n- Urgent vs routine: ' + Math.round(100 * g.two.po) + '% raw agreement, Cohen\'s kappa ' + g.two.kappa.toFixed(2) + '\n\nDisagreements (' + g.differ.length + '):\n' + (g.differ.map(function (d) { return '- ' + d.text + '  [' + d.a + ' vs ' + d.b + ']'; }).join('\n') || '- none') + '\n';
    if (g.both < 30) md += '\nFewer than 30 messages in common: treat kappa as a rough guide only.\n';
  }
  console.log(md);
}
