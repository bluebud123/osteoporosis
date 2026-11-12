'use strict';
/* v6: a dose check FOR DOCTORS. It reads a text (a patient message, an AI draft, a staff reply), looks for a medicine in
 * the table below with an amount near it, and reports when the single dose or the daily total is above the usual adult
 * maximum. It never tells a patient anything: a finding becomes a staff alert or a warning on the staff page.
 *
 * THE TABLE WAS DRAFTED BY AN AI from standard adult product labelling and is AWAITING CLINICIAN SIGN-OFF. Every number
 * must be checked against the hospital formulary before real use. It knows nothing about weight, age, kidney or liver
 * function, or a treatment dose a doctor has chosen on purpose. It is a prompt to look, not a prescribing rule.
 * mg = milligrams. tab = the strength assumed when someone writes "2 tablets" with no mg. */
var TABLE = [
  { id: 'paracetamol', label: 'Paracetamol', names: /\b(paracetamol|panadol|pcm|acetaminophen|uphamol|tylenol)\b/i, tab: 500, single: 1000, daily: 4000 },
  { id: 'tramadol', label: 'Tramadol', names: /\b(tramadol|tramal)\b/i, tab: 50, single: 100, daily: 400 },
  { id: 'codeine', label: 'Codeine', names: /\b(codeine)\b/i, tab: 30, single: 60, daily: 240 },
  { id: 'oxycodone', label: 'Oxycodone (immediate release)', names: /\b(oxycodone|oxynorm)\b/i, tab: 5, single: 20, daily: 80, note: 'no fixed maximum; this is a review threshold for a patient at home' },
  { id: 'celecoxib', label: 'Celecoxib', names: /\b(celecoxib|celebrex)\b/i, tab: 200, single: 400, daily: 400 },
  { id: 'etoricoxib', label: 'Etoricoxib', names: /\b(etoricoxib|arcoxia)\b/i, tab: 90, single: 120, daily: 120 },
  { id: 'ibuprofen', label: 'Ibuprofen', names: /\b(ibuprofen|brufen|nurofen)\b/i, tab: 400, single: 800, daily: 2400 },
  { id: 'diclofenac', label: 'Diclofenac', names: /\b(diclofenac|voltaren)\b/i, tab: 50, single: 75, daily: 150 },
  { id: 'gabapentin', label: 'Gabapentin', names: /\b(gabapentin|neurontin)\b/i, tab: 300, single: 1200, daily: 3600 },
  { id: 'pregabalin', label: 'Pregabalin', names: /\b(pregabalin|lyrica)\b/i, tab: 75, single: 300, daily: 600 },
  { id: 'enoxaparin', label: 'Enoxaparin', names: /\b(enoxaparin|clexane)\b/i, tab: 40, single: 40, daily: 40, note: 'usual dose to prevent clots after joint replacement; a treatment dose is higher and by weight' },
  { id: 'rivaroxaban', label: 'Rivaroxaban', names: /\b(rivaroxaban|xarelto)\b/i, tab: 10, single: 20, daily: 30, note: '10 mg once a day to prevent clots after joint replacement' },
  { id: 'apixaban', label: 'Apixaban', names: /\b(apixaban|eliquis)\b/i, tab: 2.5, single: 10, daily: 20, note: '2.5 mg twice a day to prevent clots after joint replacement' }
];
var WORDS = { one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twice: 2, thrice: 3, once: 1 };
function num(s) { s = String(s).toLowerCase(); return WORDS[s] !== undefined ? WORDS[s] : parseFloat(s); }
var N = '(\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)';
function timesPerDay(w) {
  var m;
  if ((m = new RegExp('every\\s+' + N + '\\s*(?:hours?|hrs?|h)\\b|\\bq' + N + 'h\\b', 'i').exec(w))) { var h = num(m[1] || m[2]); return h > 0 && h <= 24 ? 24 / h : 0; }
  if ((m = new RegExp(N + '\\s*(?:times|x)\\s*(?:a|per|each)?\\s*(?:day|daily)|' + N + '\\s*x\\s*(?:daily|a day)', 'i').exec(w))) return num(m[1] || m[2]);
  if (/\b(four times a day|qid|qds)\b/i.test(w)) return 4;
  if (/\b(three times a day|tds|tid|thrice (?:a day|daily))\b/i.test(w)) return 3;
  if (/\b(twice (?:a day|daily)|bd|bid|two times a day)\b/i.test(w)) return 2;
  if (/\b(once (?:a day|daily)|od|daily|every day|a day|per day)\b/i.test(w)) return 1;
  return 0;
}
/* For each medicine named in the text, read the 70 characters around the name. Returns findings only where a number is
 * above the table. Nothing is returned when the amount cannot be read: silence means "could not tell", not "safe". */
function check(text) {
  var t = String(text || ''), out = [];
  TABLE.forEach(function (d) {
    var re = new RegExp(d.names.source, 'ig'), m;
    while ((m = re.exec(t))) {
      var a = Math.max(0, m.index - 45), w = t.slice(a, m.index + m[0].length + 60).replace(/\s+/g, ' ');
      if (/\b(did ?n[o']?t|never|not|stopped|no more|ran out of|missed)\b[^.]{0,25}$/i.test(t.slice(a, m.index))) continue;   // "did not take 8 panadol"
      var mgM = new RegExp(N + '\\s*(mg|milligram|g|gram)s?\\b', 'i').exec(w), ctM = new RegExp(N + '\\s*(?:x\\s*)?(?:tablets?|tabs?|pills?|capsules?|caps?|biji|injections?|jabs?|doses?)\\b', 'i').exec(w);
      var nm = d.names.source.replace(/^\\b|\\b$/g, '');
      // "8 panadol" (a count straight before the name) and "arcoxia 120" (a strength straight after it, no unit written)
      var bare = !ctM ? new RegExp('(?:^|[^\\d.\\/])(?<!\\b(?:day|days|week|weeks|month|months|hour|hours|at|for|by|around|number|no)\\s)' + N + '\\s+(?:of\\s+)?(?:my\\s+|the\\s+)?' + nm, 'i').exec(w) : null;
      var strength = !mgM ? new RegExp(nm + '\\s+(\\d{2,4})\\b(?!\\s*(?:tablets?|tabs?|pills?|times|days?|hours?|hrs?|weeks?|pm|am|x\\b|kg))', 'i').exec(w) : null;
      if (strength) mgM = [strength[0], strength[strength.length - 1], 'mg'];
      var mg = mgM ? num(mgM[1]) * (/^(g|gram)$/i.test(mgM[2]) ? 1000 : 1) : 0, count = ctM ? num(ctM[1]) : bare ? num(bare[1]) : 0;
      if (!mg && !count) continue;
      var single = mg && count ? mg * count : mg ? mg : count * d.tab, perDay = timesPerDay(w);
      // "8 panadol a day" means a daily count, not eight at once
      var dailyCount = !mg && count && perDay === 1 && new RegExp(N + '[^.]{0,25}\\b(a day|per day|daily|every day)\\b', 'i').test(w) && !/\b(once|each time|at a time|at once)\b/i.test(w);
      var daily = dailyCount ? single : perDay ? single * perDay : 0; if (dailyCount) single = 0;
      var over = [];
      if (single > d.single) over.push('single dose about ' + single + ' mg (usual maximum ' + d.single + ' mg)');
      if (daily > d.daily) over.push('daily total about ' + Math.round(daily) + ' mg (usual maximum ' + d.daily + ' mg)');
      if (!over.length) continue;
      if (out.some(function (o) { return o.id === d.id; })) continue;
      out.push({ id: d.id, label: d.label, single: single, daily: Math.round(daily), limitSingle: d.single, limitDaily: d.daily, assumedTablet: !mg && count ? d.tab : 0, note: d.note || '', quote: w.trim().slice(0, 140),
        text: d.label + ': ' + over.join('; ') + (!mg && count ? ', assuming ' + d.tab + ' mg each' : '') + (d.note ? ' (' + d.note + ')' : '') });
    }
  });
  return out;
}
module.exports = { TABLE: TABLE, check: check, timesPerDay: timesPerDay };
