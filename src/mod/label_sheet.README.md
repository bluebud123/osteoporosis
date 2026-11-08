# Blind labelling sheet: instructions

You are asked to read each scenario in label_sheet.csv and choose ONE outcome class for your_class.
Write a short reason in comment if useful. Do not look at any other file in this project while labelling.
Choose what you would do as the clinic triage team on receiving the scenario. There are no right answers
recorded here; your labels are used to check agreement with the software.

Outcome classes:

- EMERGENCY: send the patient to emergency care now (999 or nearest ED).
- SAME-DAY: a clinician must review the patient today.
- HOLD: keep the message for clinician review; send no automated reply yet.
- OVERDUE: a required action or follow-up is late; flag it to the responsible staff member.
- ROUTE: pass the message to a named owner (e.g. physio, pharmacy, ward nurse) without clinical decision.
- ASK: send a clarifying question before deciding.
- ANSWER: give a standard reply from approved information.
- CLOSE: no action needed; the conversation can be closed.
