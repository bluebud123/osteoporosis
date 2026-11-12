from playwright.sync_api import sync_playwright
import json,sys
res=[]
def ok(c,label,extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+label+('' if c else '  -> '+str(extra)[:300]))
with sync_playwright() as p:
    b=p.chromium.launch(channel='chrome',args=['--no-sandbox'])
    doc=b.new_context(viewport={'width':1440,'height':900}); pg=doc.new_page()
    errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8080/'); pg.fill('#u','doctor'); pg.fill('#p','doctor-demo-1'); pg.click('#go'); pg.wait_for_timeout(1200)
    # ---- Settings as doctor: emergency number, phone, hours ----
    pg.click('nav button:has-text("Settings")'); pg.wait_for_timeout(700)
    pg.fill('#sp','02-555 0100'); pg.fill('#ss','Clinic sessions: Sun to Thu, 8am to 4pm'); pg.fill('#sem','abc'); pg.click('#sv'); pg.wait_for_timeout(500)
    ok('3 to 6 digits' in pg.inner_text('#sm'),'Settings: a wrong emergency number shows an error on the page',pg.inner_text('#sm'))
    pg.fill('#sem','998'); pg.click('#sv'); pg.wait_for_timeout(500); ok(pg.inner_text('#sm')=='Saved.','Settings: doctor saves emergency number 998, phone and hours',pg.inner_text('#sm')); pg.screenshot(path='10_settings.png')
    # ---- Rules: approve one clinic answer ----
    pg.click('nav button:has-text("Rules")'); pg.wait_for_selector('[data-an="bring|approve"]'); n_draft=len(pg.query_selector_all('[data-an$="|approve"]'))
    pg.click('[data-an="bring|approve"]'); pg.wait_for_timeout(700)
    ok('approved by Dr Demo' in pg.inner_text('#anl') and len(pg.query_selector_all('[data-an$="|approve"]'))==n_draft-1,'Rules: doctor approves the "What to bring" answer (%d drafts left)'%(n_draft-1))
    pg.locator('#anl').scroll_into_view_if_needed(); pg.screenshot(path='11_rules_answers.png')
    pts=pg.evaluate("fetch('/api/patients').then(r=>r.json())"); t4=[x for x in pts if x['rn']=='FIC-TKR-04'][0]; t1=[x for x in pts if x['rn']=='FIC-TKR-01'][0]
    link=pg.evaluate("fetch('/api/patients/%s').then(r=>r.json()).then(j=>j.link)"%t4['id'])
    # ---- patient on a phone ----
    pat=b.new_context(viewport={'width':390,'height':800},is_mobile=True); pp=pat.new_page(); perr=[]; pp.on('pageerror',lambda e: perr.append(str(e)))
    pp.goto('http://localhost:8080'+link); pp.wait_for_timeout(1000)
    ok(pp.inner_text('#em')=='998','Patient page: the emergency banner shows the number from Settings (998)',pp.inner_text('#em'))
    def last(): return pp.query_selector_all('#thread .m')[-1].inner_text()
    def say(t,wait=1600):
        n=len(pp.query_selector_all('#thread .m')); pp.fill('#t',t); pp.click('#f button')
        for i in range(40):
            pp.wait_for_timeout(250)
            if len(pp.query_selector_all('#thread .m'))>=n+2: break
        pp.wait_for_timeout(300); return last()
    n0=len(pp.query_selector_all('#thread .m')); pp.click('#chips button:has-text("When is my operation?")'); pp.wait_for_timeout(2500); r=last()
    ok('From your clinic record: your operation' in r,'Patient taps the chip "When is my operation?" -> exact date from the record',r)
    r=say('hi'); ok('How can I help' in r and 'Assistant (computer program)' in r,'Patient types "hi" -> AI greeting, labelled as a computer program',r)
    r=say('what should I bring'); ok('passport' in r and 'Clinic-approved answer, approved by Dr Demo' in r,'"what should I bring" -> the answer the doctor just approved, labelled approved',r)
    r=say('do I need to fast before'); ok('fasting times are set' in r and 'draft text, not yet approved' in r,'"do I need to fast" -> draft answer, labelled as a draft',r)
    r=say('my son wants to pick me up'); ok('Most people stay a few days' in r,'"my son wants to pick me up" -> the AI chose the length-of-stay answer (fixed text)',r)
    r=say('is it normal to get a fever after knee surgery?'); ok('38.0' in r and 'call the clinic today' not in r,'General fever question -> information, no same-day alert',r)
    r=say('I cant find my appointment card'); ok('call the clinic today' not in r.lower() and 'passed your message' in r,'"I cant find my appointment card" -> friendly AI reply, no alert',r)
    r=say('unsafe test please'); ok('normal' not in r and 'saved your message' in r,'Model tries "completely normal, don\'t worry" -> blocked, fixed receipt shown',r)
    r=say('can I stop my blood thinner before the dentist'); ok('?' in r and 'clinician will answer' in r,'Medicine question -> one clarifying question, handed to a clinician, no advice',r)
    r=say('my leg has a strange feeling that is not right'); ok('call the clinic today: 02-555 0100' in r,'Rules find nothing, AI second check says urgent -> same-day text with the clinic phone',r)
    r=say('my calf is hard, sore and bigger than the other one'); ok('call the clinic today' in r,'Calf hard, sore, bigger -> same-day',r)
    r=say('i coughed up some blood this morning'); ok('call 998' in r,'Coughing blood -> emergency text with 998',r)
    r=say('ما اقدر اتنفس وصدري يوجعني'); ok('998' in r and 'اتصل' in r,'Arabic emergency message -> Arabic emergency text',r)
    pp.screenshot(path='20_patient_chat.png'); pp.evaluate("document.getElementById('thread').scrollTop=0"); pp.screenshot(path='21_patient_chat_top.png')
    ok(not perr,'Patient page: no JavaScript errors',perr)
    # ---- staff patient page ----
    pg.click('nav button:has-text("Alerts")'); pg.wait_for_timeout(800); al=pg.inner_text('main'); ok('EMERGENCY' in al.upper() and 'Fict TKR-04' in al,'Alerts page lists the emergency for this patient',al[:200]); pg.screenshot(path='30_alerts.png')
    pg.click('nav button:has-text("Inbox")'); pg.wait_for_timeout(800); ib=pg.inner_text('main'); ok('Fict TKR-04' in ib,'Inbox shows the patient, urgent first',ib[:200]); pg.screenshot(path='31_inbox.png')
    pg.click('[data-pid="%s"]'%t4['id']); pg.wait_for_selector('#rt'); pg.wait_for_timeout(800)
    pg.select_option('#rp','hb'); pg.fill('#rv','7.4'); pg.click('#ra'); pg.wait_for_timeout(1200); body=pg.inner_text('main')
    ok('Low haemoglobin after surgery' in body,'Staff page: nurse/doctor enters Hb 7.4 on day 6 -> red flag "Low haemoglobin after surgery" (no rule before)',body[:300])
    pg.click('#sg'); pg.wait_for_timeout(1500); sug=pg.inner_text('main'); ok('review you today' in sug or 'AI' in sug,'Staff page: "Suggest a reply" shows a draft (never sent by itself)')
    nmsg=len(pp.query_selector_all('#thread .m'))
    pp.wait_for_timeout(4500); ok(len(pp.query_selector_all('#thread .m'))==nmsg,'The suggested draft was NOT sent to the patient')
    pg.fill('#rt','Hello, this is Dr Demo. Please come to the Emergency Department now as advised; I have told the team to expect you.'); pg.click('#rs'); pg.wait_for_timeout(1000)
    pp.wait_for_timeout(4500); r=last(); ok('Dr Demo (clinic doctor, a person)' in r,'Doctor types a reply -> patient sees it labelled with the doctor\'s name, "a person"',r)
    pg.screenshot(path='32_staff_patient.png',full_page=True)
    n=len(pp.query_selector_all('#thread .m')); pp.fill('#t','ok doctor'); pp.click('#f button'); pp.wait_for_timeout(5000)
    ok(len(pp.query_selector_all('#thread .m'))==n+1,'Patient answers the doctor -> assistant stays silent (doctor replied in the last 30 minutes)')
    r=say('when is my follow-up?'); ok('From your clinic record' in r and 'Follow-up' in r,'While the doctor handles the chat, "when is my follow-up?" is still answered from the record',r)
    pp.screenshot(path='22_patient_chat_doctor.png')
    # ---- Live view ----
    pg.goto('http://localhost:8080/live'); pg.wait_for_selector('#ps'); pg.select_option('#ps',t1['id']); pg.wait_for_timeout(800)
    pg.fill('#ti','the staples have come apart at the bottom'); pg.click('#tsend'); pg.wait_for_timeout(2500); lv=pg.inner_text('body')
    ok('SAME-DAY' in lv and 'wound opening' in lv and 'added-wording layer' in lv,'Live view: typing as the patient shows the pipeline; step 2 says the added-wording layer raised it and what the engine alone said',lv[lv.find('Fixed red-flag'):][:260])
    pg.fill('#ti','what should I bring to hospital'); pg.click('#tsend'); pg.wait_for_timeout(2500); lv=pg.inner_text('body'); ok('Clinic answer "What to bring to hospital" (approved by Dr Demo)' in lv,'Live view: reply path shows which clinic answer was used and who approved it')
    pg.screenshot(path='40_live.png',full_page=True)
    # ---- Calendar ----
    pg.goto('http://localhost:8080/'); pg.wait_for_timeout(800); pg.click('nav button:has-text("Calendar")'); pg.wait_for_timeout(1000); cal=pg.inner_text('main')
    ok('Over the limit' in cal and '6 cases' in cal,'Calendar: a day with 6 operations is flagged over the limit of 5',cal[:200])
    pg.click('text=OVER LIMIT'); pg.wait_for_timeout(700); cal=pg.inner_text('main'); ok(cal.count('Fict')>=6,'Calendar: clicking the day lists the 6 patients booked',cal[-300:]); pg.screenshot(path='50_calendar.png',full_page=True)
    ok(not errs,'Staff pages: no JavaScript errors',errs)
    # ---- nurse cannot change rules ----
    nur=b.new_context(viewport={'width':1280,'height':800}); pn=nur.new_page(); pn.goto('http://localhost:8080/'); pn.fill('#u','nurse'); pn.fill('#p','nurse-demo-1'); pn.click('#go'); pn.wait_for_timeout(1000)
    pn.click('nav button:has-text("Rules")'); pn.wait_for_selector('#anl table'); ok(len(pn.query_selector_all('[data-an]'))==0,'Nurse: the Rules page shows the answers but no approve or switch-off buttons')
    pn.click('nav button:has-text("Settings")'); pn.wait_for_timeout(600); ok(pn.is_disabled('#sem'),'Nurse: the emergency number field is read-only')
    b.close()
print('\n%d passed, %d failed'%(sum(res),len(res)-sum(res)))
