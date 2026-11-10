// Held-out set 1 for parameter thresholds. Written 10 Nov 2026 BEFORE any threshold was changed or measured.
// Each row: param, value, day relative to operation, expected level (red = same-day doctor, amber = review, none), why.
// Expected levels are Claude's reading of common perioperative practice for elective TKR, NOT a clinician's sign-off.
module.exports=[
['hb',9.6,-10,'red','pre-op Hb <10'],['hb',11.4,-10,'amber','pre-op anaemia'],['hb',13.5,-10,'none',''],
['hb',7.4,2,'red','post-op Hb <8: transfusion threshold'],['hb',9.1,2,'amber','post-op Hb 8 to 10: watch'],['hb',11.0,2,'none','expected post-op drop'],
['hba1c',9.4,-12,'red',''],['hba1c',8.2,-12,'amber',''],['hba1c',6.8,-12,'none',''],
['egfr',25,-10,'red',''],['egfr',48,-10,'amber',''],['egfr',75,-10,'none',''],
['inr',3.1,-9,'amber','on warfarin, plan needed'],['inr',1.9,-1,'red','INR still raised the day before surgery'],['inr',1.1,-1,'none',''],
['platelets',42,-10,'red','<50'],['platelets',88,-10,'amber',''],['platelets',230,-10,'none',''],
['platelets',70,3,'red','post-op fall on heparin: possible HIT'],
['albumin',29,-10,'amber',''],['bmi',41,-14,'red',''],['bmi',36,-14,'amber',''],['bmi',27,-14,'none',''],
['bp_sys',186,-7,'red',''],['bp_sys',165,-7,'amber',''],['bp_sys',128,-7,'none',''],
['bp_sys',84,1,'red','hypotension after surgery'],['bp_sys',96,1,'amber','low BP after surgery'],['bp_sys',118,1,'none',''],
['temp',38.7,0,'red','high fever on the day of surgery, evening'],['temp',38.2,0,'amber',''],
['temp',38.6,3,'red',''],['temp',38.1,2,'amber',''],['temp',37.6,2,'none',''],
['temp',38.3,-1,'red','fever the day before elective surgery'],['temp',35.2,0,'amber','hypothermia after theatre'],
['hr',136,1,'red',''],['hr',118,1,'amber',''],['hr',84,1,'none',''],['hr',38,1,'red','bradycardia <40'],['hr',46,1,'amber','bradycardia <50'],
['hr',124,-3,'amber','tachycardia before surgery'],
['spo2',88,1,'red',''],['spo2',92,1,'amber',''],['spo2',97,1,'none',''],['spo2',90,-5,'amber','low saturation at pre-op clinic'],
['pain',9,2,'amber',''],['pain',4,2,'none',''],
['crp',180,5,'amber','high after day 3'],['crp',160,2,'none','peak at day 2 is expected'],['crp',40,10,'none',''],
['wcc',14.5,4,'amber',''],['wcc',9.0,4,'none',''],['wcc',2.1,4,'amber','low white cells'],
['calf_diff',3.4,4,'red',''],['calf_diff',2.2,4,'amber',''],['calf_diff',0.5,4,'none',''],
['flexion',50,15,'amber',''],['flexion',50,5,'none','too early to judge'],['flexion',95,15,'none',''],
['wound','red and hot',5,'red',''],['wound','discharge',5,'amber',''],['wound','discharge',12,'red','discharge persisting past day 10'],['wound','ooze',2,'none','early ooze'],['wound','dry',5,'none','']
];
