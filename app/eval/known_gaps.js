// Messages in a "seen" set that the rules still get wrong ON PURPOSE, each with the reason. The regression test prints them
// every run and does not count them as failures. Removing an entry is a clinical decision (see docs/decision-log.md, v3).
module.exports = {
  missE: [], notE: [], missS: [],
  fp: [
    // The unchanged engine raises "fall or head injury" on any report of a fall, including a relative's. Lowering it would need a clinician.
    'my son fell off his bike yesterday but hes ok, can he still drive me?',
    // New breathlessness on exertion on day 4 after knee replacement may be a clot in the lung. The AI reviewer labelled it ordinary; left as an alert.
    'walked to the kitchen and back, bit out of breath but proud'
  ]
};
