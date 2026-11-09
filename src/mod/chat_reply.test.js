'use strict';
var A = require('./adapter.js');
var fails = 0, n = 0;
function chk(label, reply, user, wantOk) {
  n++; var g = A.guardReply(reply, user, null, { chat: true });
  if (g.ok !== wantOk) { fails++; console.log('FAIL', label, '->', JSON.stringify(g), JSON.stringify(reply)); }
}
// must pass
chk('greeting', 'Hello! I can pass a message to your care team. What would you like to ask?', 'hello', true);
chk('empathy+question', "I'm sorry you feel worried. Can you tell me where on your leg and since when?", 'I am worried about my leg', true);
chk('capability', 'I can share ward information, like showering or follow-up.', 'what can you do', true);
chk('redirect', 'I cannot answer that. A clinician will review it.', 'is my wound ok', true);
// must be blocked (allow-list lookalikes carrying advice, reassurance, doses, diagnoses)
chk('reassure-lookalike', 'I can tell you that this is normal.', 'my leg is tight', false);
chk('stop-med', 'I can help you stop taking the rivaroxaban today.', 'blood thinner', false);
chk('dose', 'I can tell you to take 500 mg twice a day.', 'metformin', false);
chk('diagnosis', "I'm sorry to hear that, it sounds like a blood clot.", 'my calf hurts', false);
chk('dont-worry', "Don't worry, the care team will fix it.", 'scared', false);
chk('instruction', 'I can note that you should elevate your leg and rest.', 'swollen', false);
chk('number-invented', 'I can pass a message, the ward number is 04 222 3333.', 'phone', false);
chk('promise-safe', 'You are fine, no need to come in.', 'fever', false);
chk('plain-advice', 'You should take paracetamol and rest.', 'pain', false);
console.log('chat_reply guard: ' + (n - fails) + '/' + n);
process.exit(fails ? 1 : 0);
