from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
import copy
INK=RGBColor(0x33,0x33,0x33); MUT=RGBColor(0x6B,0x6B,0x6B); TEAL=RGBColor(0x0D,0x73,0x66); RED=RGBColor(0xB4,0x23,0x18); SAND=RGBColor(0xEF,0xE9,0xE1); PALE=RGBColor(0xF7,0xF4,0xEF); LINE=RGBColor(0xD8,0xCF,0xC4); WHITE=RGBColor(255,255,255); AMB=RGBColor(0xFF,0xF1,0xB8)
F='Outfit'
p=Presentation('template.pptx'); S=list(p.slides)
def run(par,text,size=10,bold=False,color=INK,italic=False):
    r=par.add_run(); r.text=text; r.font.name=F; r.font.size=Pt(size); r.font.bold=bold; r.font.italic=italic; r.font.color.rgb=color; return r
def tb(s,x,y,w,h,paras,anchor=MSO_ANCHOR.TOP,space=3,name=None):
    """paras: list of items; item = str | (str, opts) | [ (str,opts), ... ] for mixed runs. opts: size,bold,color,italic,bullet,align"""
    b=s.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h)); tf=b.text_frame; tf.word_wrap=True; tf.vertical_anchor=anchor
    tf.margin_left=tf.margin_right=Inches(0.04); tf.margin_top=tf.margin_bottom=Inches(0.02)
    if name: b.name=name
    first=True
    for it in paras:
        par=tf.paragraphs[0] if first else tf.add_paragraph(); first=False
        runs=it if isinstance(it,list) else [it]
        o0=runs[0][1] if isinstance(runs[0],tuple) else {}
        par.space_after=Pt(o0.get('after',space)); par.line_spacing=o0.get('ls',1.08)
        if o0.get('align')=='c': par.alignment=PP_ALIGN.CENTER
        if o0.get('bullet'):
            pPr=par._p.get_or_add_pPr(); pPr.set('marL','171450'); pPr.set('indent','-171450')
            bu=pPr.makeelement('{http://schemas.openxmlformats.org/drawingml/2006/main}buChar',{'char':'•'}); pPr.append(bu)
        for r_ in runs:
            t,o=(r_ if isinstance(r_,tuple) else (r_,{}))
            run(par,t,o.get('size',10),o.get('bold',False),o.get('color',INK),o.get('italic',False))
    return b
def box(s,x,y,w,h,fill=PALE,line=LINE,shape=MSO_SHAPE.ROUNDED_RECTANGLE,radius=0.08):
    b=s.shapes.add_shape(shape,Inches(x),Inches(y),Inches(w),Inches(h)); b.fill.solid(); b.fill.fore_color.rgb=fill
    if line is None: b.line.fill.background()
    else: b.line.color.rgb=line; b.line.width=Pt(0.75)
    b.shadow.inherit=False
    sp=b._element.spPr
    if sp.find('{http://schemas.openxmlformats.org/drawingml/2006/main}effectLst') is None: sp.append(sp.makeelement('{http://schemas.openxmlformats.org/drawingml/2006/main}effectLst',{}))
    if shape==MSO_SHAPE.ROUNDED_RECTANGLE:
        try: b.adjustments[0]=radius
        except Exception: pass
    return b
def card(s,x,y,w,h,title,lines,fill=PALE,tcolor=TEAL,size=9.5,tsize=10.5):
    box(s,x,y,w,h,fill)
    paras=[(title,{'size':tsize,'bold':True,'color':tcolor,'after':4})]+[(l,{'size':size}) if isinstance(l,str) else l for l in lines]
    tb(s,x+0.1,y+0.07,w-0.2,h-0.14,paras)
def arrow(s,x1,y1,x2,y2,color=MUT):
    c=s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT,Inches(x1),Inches(y1),Inches(x2),Inches(y2)); c.line.color.rgb=color; c.line.width=Pt(1.25)
    ln=c.line._get_or_add_ln(); te=ln.makeelement('{http://schemas.openxmlformats.org/drawingml/2006/main}tailEnd',{'type':'triangle','w':'med','len':'med'}); ln.append(te); return c
def table(s,x,y,w,cols,rows,size=8.5,hsize=8.5,rowh=0.26):
    n=len(rows); gf=s.shapes.add_table(n,len(cols),Inches(x),Inches(y),Inches(w),Inches(rowh*n)); t=gf.table
    tot=sum(cols)
    for i,cw in enumerate(cols): t.columns[i].width=Inches(w*cw/tot)
    tblPr=gf._element.graphic.graphicData.tbl.tblPr
    for a in ('bandRow','firstRow'): tblPr.set(a,'0')
    sid=tblPr.find('{http://schemas.openxmlformats.org/drawingml/2006/main}tableStyleId')
    if sid is not None: sid.text='{5940675A-B579-460E-94D1-54222C63F5DA}'   # no style, table grid
    for ri,row in enumerate(rows):
        t.rows[ri].height=Inches(0.27 if ri==0 else rowh)
        for ci,val in enumerate(row):
            c=t.cell(ri,ci); c.margin_left=c.margin_right=Inches(0.06); c.margin_top=c.margin_bottom=Inches(0.035); c.vertical_anchor=MSO_ANCHOR.TOP
            c.fill.solid(); c.fill.fore_color.rgb=SAND if ri==0 else WHITE
            tf=c.text_frame; tf.word_wrap=True; par=tf.paragraphs[0]; par.line_spacing=1.05
            parts=val if isinstance(val,list) else [val]
            for pt_ in parts:
                tx,o=(pt_ if isinstance(pt_,tuple) else (pt_,{}))
                run(par,tx,hsize if ri==0 else o.get('size',size),True if ri==0 else o.get('bold',False),o.get('color',INK))
            # thin borders
            tcPr=c._tc.get_or_add_tcPr()
            for tag in ('lnL','lnR','lnT','lnB'):
                ln=tcPr.makeelement('{http://schemas.openxmlformats.org/drawingml/2006/main}'+tag,{'w':'6350'}); sf=ln.makeelement('{http://schemas.openxmlformats.org/drawingml/2006/main}solidFill',{}); cl=sf.makeelement('{http://schemas.openxmlformats.org/drawingml/2006/main}srgbClr',{'val':'D8CFC4'}); sf.append(cl); ln.append(sf); tcPr.append(ln)
    return gf
X0,W=0.32,9.36; Y0=1.52

# ---- 1 ----
s=S[0]; t=[sh for sh in s.shapes if sh.has_text_frame][0]; ps=t.text_frame.paragraphs
vals=['PeriLoop','1 (solo entry)','Statement 3: Closing the Screening-to-Care Loop']
for par,v in zip(ps,vals):
    r0=par.runs[0]; r=par.add_run(); r.text=v; r.font.name=F; r.font.size=r0.font.size; r.font.bold=True; r.font.color.rgb=INK
tb(s,0.52,4.42,9.0,0.9,[[('PeriLoop Console. ',{'size':12,'bold':True,'color':TEAL}),('Every perioperative task and every patient message gets a named owner and a written closure, around elective orthopaedic surgery.',{'size':12})],('Working prototype · synthetic data only · not clinically validated',{'size':10,'color':MUT})],space=4)

# ---- 2 ----
s=S[1]; tbl=[sh for sh in s.shapes if sh.has_table][0].table
row=['1','Tan Shun Herng','Malaysia','Orthopaedic medical officer; clinical lead and builder','Independent entry (employed by the Ministry of Health Malaysia; entered in a personal capacity)','34']
for ci,v in enumerate(row):
    c=tbl.cell(1,ci); par=c.text_frame.paragraphs[0]
    for r in list(par.runs): r._r.getparent().remove(r._r)
    run(par,v,9)
# ---- 3 ----
cap=("Solo entrant: an orthopaedic medical officer in a Malaysian public hospital who works every day in the pathway this prototype addresses: pre-operative clinic, ward and post-operative follow-up.",
"Clinical work in this project: defined the problem from practice, set the line between \"emergency\" and \"same day\", labelled 368 test messages blind, and will sign off every clinical rule before any real use.",
"Technical work: designed and built with AI coding assistants. Every rule decision, measurement and failure is written in a public decision log. An independent AI review was commissioned mid-challenge and its criticisms were acted on.",
"Known gaps: no software engineer, no second clinician labeller, no native Arabic reviewer and no hospital IT partner yet. These are the first people a pilot would add.")
assert sum(len(c) for c in cap)+3<=1000, sum(len(c) for c in cap)
s=S[2]; tb(s,X0,Y0,W,2.6,[(c,{'size':12,'after':9,'ls':1.15}) for c in cap])
tb(s,X0,4.95,W,0.3,[('%d characters'%(sum(len(c) for c in cap)+3),{'size':8.5,'color':MUT})])

# ---- 4 architecture ----
s=S[3]
tb(s,X0,1.28,W,0.3,[('Every patient message passes the same fixed steps. The AI can raise urgency but never lower it, and never writes clinical advice to a patient.',{'size':10,'color':MUT})])
# patient
card(s,0.32,1.75,1.95,1.55,'Patient or carer',['Private chat link, no app','English, Malay, Chinese, Arabic','Sees only fixed urgent texts, approved clinic answers, or a receipt'],size=8.5)
card(s,0.32,3.45,1.95,1.75,'Staff input',['Checklist per patient from pathway rules','Readings typed by staff, flagged by fixed thresholds','Operation dates and a cases-per-day limit'],size=8.5)
# pipeline
px,pw=2.75,3.55; steps=[('1','Mask identifiers','Phone, IC and email removed before storing or sending'),('2','Fixed red-flag rules','Word lists plus the clinician\'s emergency line. No AI'),('3','Raise-only checks','Clinic phrases · confirmed patient profile · dose table'),('4','AI second check','Only if steps 2 and 3 found nothing. Can raise, with a severity grade'),('5','Decision and reply','Emergency or same-day: fixed text and a staff alert. Otherwise: approved answer or receipt')]
box(s,px-0.12,1.68,pw+0.24,3.56,WHITE,LINE)
tb(s,px,1.7,pw,0.25,[('Triage pipeline (server)',{'size':9,'bold':True,'color':MUT})])
yy=1.98
for n,t1,t2 in steps:
    hl = n=='4'
    box(s,px,yy,pw,0.56,RGBColor(0xE6,0xF2,0xF0) if hl else PALE,TEAL if hl else LINE)
    c=box(s,px+0.08,yy+0.13,0.3,0.3,TEAL,None,MSO_SHAPE.OVAL); c.text_frame.text=''; cp=c.text_frame.paragraphs[0]; cp.alignment=PP_ALIGN.CENTER; run(cp,n,9,True,WHITE); c.text_frame.margin_left=c.text_frame.margin_right=0; c.text_frame.margin_top=c.text_frame.margin_bottom=0; c.text_frame.vertical_anchor=MSO_ANCHOR.MIDDLE
    tb(s,px+0.45,yy+0.04,pw-0.5,0.5,[(t1,{'size':9.5,'bold':True,'after':0}),(t2,{'size':8,'color':MUT})],space=0)
    yy+=0.64
arrow(s,2.27,2.5,2.63,2.5); arrow(s,2.27,4.3,2.63,4.3)
# staff console
card(s,6.85,1.75,2.83,2.3,'Staff Console',['Alerts: who acknowledged, and when','Inbox and reply drafts the staff edit','Checklist: a task closes only with written evidence','Dose warning before a reply is sent','Calendar: over-booked days, with a suggested move','Learning: AI proposes a lesson, the chief doctor approves'],size=8.5)
arrow(s,6.42,2.9,6.8,2.9)
card(s,6.85,4.17,2.83,1.03,'Underneath',['Audit log of every decision and change','AI provider set by three settings; all calls queued, safety checks first'],size=8.5,tcolor=MUT)

# ---- 5 target users ----
s=S[4]
cw=(W-0.3)/3
card(s,X0,Y0,cw,1.5,'Doctors and nurses',['Orthopaedic units in public hospitals with no patient portal, where follow-up runs on phone calls and memory.','They get one screen of what needs a person now, with an owner on every item.'],size=9.5)
card(s,X0+cw+0.15,Y0,cw,1.5,'Patients and carers at home',['Adults having elective joint, spine or sports surgery, writing in English, Malay, Chinese or Arabic.','They get a private chat link, a clear instruction when something is urgent, and honest wording about who reads messages and when.'],size=9.5)
card(s,X0+2*(cw+0.15),Y0,cw,1.5,'Clinic coordinators',['The people who book operations and chase missing results.','They see over-booked days, overdue pre-operative tasks, and a task to tell the patient when a date moves.'],size=9.5)
tb(s,X0,3.22,W,0.3,[('Intended outcome',{'size':11,'bold':True,'color':TEAL})])
tb(s,X0,3.54,W,1.7,[
 [('Nothing found is left without an owner. ',{'size':10,'bold':True,'bullet':True}),('An abnormal result, a missing consent or a worried message always has a named person and a closure with evidence.',{'size':10})],
 [('An urgent message reaches a clinician the same day. ',{'size':10,'bold':True,'bullet':True}),('Fixed rules first, an AI check that can only raise, and an alert that records who acknowledged it.',{'size':10})],
 [('No patient receives clinical advice written by an AI. ',{'size':10,'bold':True,'bullet':True}),('Urgent replies are fixed texts; clinical questions go to a person.',{'size':10})],
 [('This is Statement 3 applied to surgery: ',{'size':10,'bold':True,'bullet':True}),('pre-operative screening finds a risk, and the loop is closed only when someone has acted on it.',{'size':10})]],space=4)

# ---- 6 success ----
s=S[5]
tb(s,X0,1.28,W,0.3,[('Nothing has been measured with real patients yet. These are the measures a pilot would report, each taken from data the Console already records.',{'size':10,'color':MUT})])
table(s,X0,1.7,W,[2.6,3.3,2.6],[
 ['Measure','How it is measured','Why it matters'],
 [('Pre-operative tasks closed with evidence before the operation date',{'bold':True}),'Checklist records: closed-with-evidence tasks over all tasks due before surgery, per patient','The loop is closed before the patient reaches theatre'],
 [('Time from an urgent message to a clinician acknowledging it',{'bold':True}),'Alert log: time raised to time acknowledged, median and worst case, in and out of clinic hours','An alert nobody opens is not safety'],
 [('Urgent messages that triage missed',{'bold':True}),'A clinician reads a random sample of messages classed routine each week and marks any that should have alerted','The only honest way to find missed emergencies'],
 [('Alerts a doctor marks "not urgent"',{'bold':True}),'Doctor feedback button on each alert, per 100 messages','The cost of over-alerting: staff stop reading alerts'],
 [('AI drafts sent unchanged, and lessons that work',{'bold':True}),'Learning page counts: drafts sent as written against drafts rewritten, per approved lesson','Whether the assistant is saving staff time or adding work'],
 [('Unplanned emergency visits and readmissions within 30 days',{'bold':True}),'Hospital records, compared with the same unit before the pilot','The patient outcome; needs ethics approval and a larger sample']],size=8.5,rowh=0.47)
tb(s,X0,5.12,W,0.3,[('Before a live pilot: a silent period where the system runs beside usual care and its alerts are reviewed but not acted on.',{'size':9,'color':MUT,'italic':True})])

# ---- 7 evidence ----
s=S[6]
tb(s,X0,Y0,5.55,0.25,[('Our own measurements (invented messages only)',{'size':10.5,'bold':True,'color':TEAL})])
table(s,X0,Y0+0.3,5.55,[2.75,2.8],[
 ['Test','Result'],
 ['368 English messages labelled blind by one orthopaedic medical officer; rules + AI check','All 155 he called emergencies raised an alert (rules alone: 150). None of his 114 routine messages did'],
 ['Same labels, emergency text','134 of 155 by rules alone after his emergency line was added; the rest are told "call the clinic today"'],
 ['913 messages, 4 languages, real model (DeepSeek), AI labels','Rules alone alerted on 491 of 537 urgent (91%; Arabic 73%). Rules + AI: 537 of 537. False alerts 14, then 20, of 376'],
 ['AI check by itself','When it answered, it flagged every urgent message. About 2.5% of single calls fail; a retry recovered them'],
 ['A failed run, kept in the record','New features overloaded the provider and a third of AI checks were lost. Staff were alerted each time; no labelled emergency was missed. Fixed and re-run']],size=8,rowh=0.5)
tb(s,X0,5.1,5.55,0.3,[('Limits: invented messages, one clinician, one model, test sets the rules were tuned on. Not clinical validation.',{'size':8.5,'color':RED})])
rx=6.05; rw=3.63
tb(s,rx,Y0,rw,0.25,[('Published evidence',{'size':10.5,'bold':True,'color':TEAL})])
tb(s,rx,Y0+0.3,rw,3.6,[
 [('Automated texts help after joint replacement. ',{'size':8.5,'bold':True}),('Randomised trial, 159 patients: an SMS bot improved engagement and early outcomes. It could not receive patient replies. Campbell et al., J Bone Joint Surg Am 2019. doi:10.2106/JBJS.17.01505',{'size':8.5})],
 [('App-based care after knee replacement is feasible at scale. ',{'size':8.5,'bold':True}),('Randomised trial, 401 patients, smartphone platform with a watch against in-person physiotherapy (one-year follow-up summarised by OrthoEvidence, 2025).',{'size':8.5})],
 [('AI replies to arthroplasty patients are being studied, ',{'size':8.5,'bold':True}),('with surgeons grading autonomous replies as mostly acceptable (AAHKS 2026 abstract), and retrieval-based triage of fracture questions (Kahan et al., J Am Acad Orthop Surg 2026).',{'size':8.5})],
 [('What is missing in that work, and built here: ',{'size':8.5,'bold':True,'color':TEAL}),('inbound messages triaged by fixed rules first; an AI that may only raise urgency and never writes clinical advice; every item owned and closed with evidence; and misses published, not hidden.',{'size':8.5})]],space=7)

# ---- 8 data ----
s=S[7]
table(s,X0,1.62,W,[1.9,1.5,1.35,1.2,1.75,1.3],[
 ['Source','Type','Owner','Sensitivity','Permission to use','Personal data?'],
 ['30 fictional patients in the demo','Invented records and intake answers','The entrant','None','Created for this project','No'],
 ['913 test messages in four languages','Invented patient messages, written by AI','The entrant','None','Created for this project','No'],
 ['368 blind urgency labels','Clinical judgement on invented messages','The entrant (labeller)','None','Own work','No'],
 ['Pathway items, thresholds, dose table, clinic answers','Rules drafted by AI from general clinical practice; awaiting clinician sign-off','The entrant','None','Own work; no guideline text copied','No'],
 ['Text typed into the public demo by visitors','Free text','The visitor','Could be sensitive if a visitor ignores the banner','Banner: fictional data only; identifiers masked; demo resets after 30 minutes idle','Not intended'],
 ['Published studies','Citations only','Their publishers','None','Cited, not reproduced','No']],size=8,rowh=0.44)
tb(s,X0,4.85,W,0.5,[[('No real patient data has been used at any point. ',{'size':9.5,'bold':True}),('When the AI is on, message text is sent to the configured model provider (DeepSeek for these tests). For real patients the model must run in-country, and the measurements must be repeated on that model.',{'size':9.5})]])

# ---- 9 risks ----
s=S[8]
table(s,X0,1.6,W,[1.65,4.3,3.05],[
 ['Risk','Safeguard built','What remains'],
 [('A missed emergency',{'bold':True}),'Fixed rules run first and never depend on the AI. The AI check can only raise. Every reply lists the emergency number','Fixed word lists miss unusual wording: every fresh test found misses. Rules alone are not safe'],
 [('AI gives unsafe advice',{'bold':True}),'Urgent replies are fixed texts. Clinical questions are handed to a person. An output guard blocks advice, verdicts and medicine instructions in any AI wording','The guard is a filter, not a proof. It blocked about 13 model replies per test run'],
 [('AI unavailable',{'bold':True}),'All calls queued with safety checks first; one retry; then a staff alert. A daily ceiling switches to rules only, and the screen says so','About 2.5% of single calls fail at this provider'],
 [('Human oversight',{'bold':True}),'Staff confirm every patient fact the AI proposes; the chief doctor approves every lesson; lessons cannot change triage or carry a dose','Alerts are seen only when staff open the Console: no SMS, no on-call rota'],
 [('Wrong dose',{'bold':True}),'A dose above the usual maximum, reported by a patient or typed in a reply, is shown to the doctor before anything is sent','The dose table is AI-drafted and awaits clinician sign-off'],
 [('Privacy and security',{'bold':True}),'Identifiers masked; passwords hashed; login limits; audit log; AI key kept on the server','One data file, not encrypted; the chat link is the patient\'s only identity; no in-country model yet'],
 [('Bias and language',{'bold':True}),'Four languages tested separately and reported separately','Arabic is weakest (rules alone 73%). Malay, Chinese and Arabic texts are machine drafts with no native review']],size=7.8,rowh=0.44)

# ---- 10 hardware ----
s=S[9]; tb(s,X0,1.75,W,0.8,[('Not applicable.',{'size':14,'bold':True,'color':TEAL,'after':6}),('PeriLoop is software only. Patients use the browser on their own phone; staff use any computer with a browser. There is no wearable, sensor or connected device.',{'size':11})])

# ---- 11 access ----
s=S[10]
card(s,X0,1.75,4.5,1.5,'Live demo',[[('https://periloop-console-production.up.railway.app',{'size':10.5,'bold':True})],[('Doctor (chief): ',{'size':10}),('doctor',{'size':10,'bold':True}),('   password: ',{'size':10}),('[DOCTOR PASSWORD]',{'size':10,'bold':True,'color':RED})],[('Nurse: ',{'size':10}),('nurse',{'size':10,'bold':True}),('   password: ',{'size':10}),('[NURSE PASSWORD]',{'size':10,'bold':True,'color':RED})],('Fictional patients only. The demo puts itself back to its starting state after 30 minutes without activity.',{'size':9,'color':MUT})],tsize=11)
card(s,X0+4.65,1.75,W-4.65,1.5,'Source code',[[('https://github.com/bluebud123/periloop-console',{'size':10,'bold':True})],('Runs locally with one command and no dependencies: node app/server.js',{'size':9.5}),('Read docs/decision-log.md for every measurement, including the ones that went badly.',{'size':9.5})],tsize=11)
tb(s,X0,3.45,W,0.3,[('Five things to try (about four minutes)',{'size':11,'bold':True,'color':TEAL})])
tb(s,X0,3.77,W,1.5,[
 [('1  ',{'size':9.5,'bold':True,'color':TEAL}),('Open ',{'size':9.5}),('Live view',{'size':9.5,'bold':True}),(' and send, as the patient: "I cant breathe and my chest hurts". Watch each step of the pipeline and the alert.',{'size':9.5})],
 [('2  ',{'size':9.5,'bold':True,'color':TEAL}),('Send: "I have been taking 3 tramadol every 4 hours". The doctor is shown the dose against the usual maximum; the patient is not.',{'size':9.5})],
 [('3  ',{'size':9.5,'bold':True,'color':TEAL}),('Open a patient, expand ',{'size':9.5}),('Doctor brief',{'size':9.5,'bold':True}),(', press ',{'size':9.5}),('Suggest a reply',{'size':9.5,'bold':True}),(', rewrite the draft and send it. Then open ',{'size':9.5}),('Learning',{'size':9.5,'bold':True}),('.',{'size':9.5})],
 [('4  ',{'size':9.5,'bold':True,'color':TEAL}),('Close a checklist task: it will not close without written evidence.',{'size':9.5})],
 [('5  ',{'size':9.5,'bold':True,'color':TEAL}),('Open ',{'size':9.5}),('Rules',{'size':9.5,'bold':True}),(': every clinic answer is marked as a draft until a doctor approves it.',{'size':9.5})]],space=3)

# ---- 12 path ----
s=S[11]
table(s,X0,1.62,5.75,[1.25,4.5],[
 ['Stage','What happens'],
 [('Now to 3 months',{'bold':True}),'Clinician sign-off of rules, thresholds, dose table and texts. A second clinician labels the test set. Native review of Malay, Chinese and Arabic. A hazard log'],
 [('3 to 6 months',{'bold':True}),'Ethics approval at one orthopaedic unit. Silent period: the system runs beside usual care; alerts are reviewed, not acted on; misses are counted against real messages'],
 [('6 to 12 months',{'bold':True}),'Live pilot with knee replacement patients under a named clinical safety lead. Notifications and an on-call rota are added first'],
 [('After a pilot',{'bold':True}),'More procedures (five more pathways already exist as data). A second site in the UAE with an Arabic-first model']],size=8.5,rowh=0.6)
tb(s,X0,4.85,5.75,0.5,[('Assumptions: no site, permission or funding is in place today. Timelines depend on ethics and hospital IT approval, which the entrant does not control.',{'size':8.5,'color':RED})])
rx=6.25; rw=3.43
card(s,rx,1.62,rw,1.18,'Integration',['Blood results: typed by staff today; next, scan a lab report and a nurse confirms each value; then a direct feed from the lab system using HL7 or FHIR, and the health information exchange in Abu Dhabi.'],size=8.5)
card(s,rx,2.9,rw,1.05,'Regulatory and data',['Likely software as a medical device: classification to be confirmed with the regulator. The AI model must run in-country and be re-measured before use.'],size=8.5)
card(s,rx,4.05,rw,1.2,'Stakeholders and sustainability',['Orthopaedic department, nursing, hospital IT, ethics committee, patients. Running cost is small: about US$5 a month to host and a fraction of a cent per message for the model. Priced per operation episode.'],size=8.5)

# ---- 13 IP ----
s=S[12]
table(s,X0,1.62,W,[2.2,3.7,3.1],[
 ['Item','Ownership and licence','Restriction or note'],
 [('PeriLoop Console source code, rules, texts, tests and documents',{'bold':True}),'Written during the challenge by the entrant, working with AI coding assistants. Owned by the entrant. Public repository; no open-source licence has been chosen yet','No pre-existing product. The repository also holds an earlier single-page prototype from the same challenge period'],
 [('AI coding assistants',{'bold':True}),'Commercial AI assistants were used to write most of the code, rules, translations and documents, under their standard terms','Stated openly throughout. All such content is treated as unverified until a clinician signs it off'],
 [('Runtime',{'bold':True}),'Node.js (open source, MIT licence). No other libraries or packages are used','None'],
 [('AI model at run time',{'bold':True}),'DeepSeek API, used under its commercial terms for the tests and the demo. The provider is a setting and can be replaced','No model weights are distributed. Results apply to the model tested'],
 [('Test data and clinician labels',{'bold':True}),'Invented by the project; labels are the entrant\'s own clinical judgement','None'],
 [('Employer',{'bold':True}),'The entrant is employed by the Ministry of Health Malaysia and enters in a personal capacity, in his own time, using no patient data or hospital systems','The entrant will confirm his employer\'s rules on outside work and intellectual property before any pilot or commercial use']],size=8.2,rowh=0.5)

# ---- 14 COI ----
s=S[13]
tb(s,X0,1.75,W,2.2,[('None to declare.',{'size':14,'bold':True,'color':TEAL,'after':8}),
 ('The entrant is not employed by or contracted to the Department of Health Abu Dhabi, Future Health, Microsoft, Inception, MBZUAI or Hack2skill.',{'size':11,'bullet':True,'after':5}),
 ('He has no family or close personal relationship with a judge, organiser or collaborator staff member.',{'size':11,'bullet':True,'after':5}),
 ('He has no financial interest in an organisation running or judging the challenge.',{'size':11,'bullet':True,'after':5}),
 ('He has had no access to non-public information about the challenge or its evaluation.',{'size':11,'bullet':True,'after':5}),
 ('For transparency: he is a doctor employed by the Ministry of Health Malaysia, which has no role in this challenge.',{'size':10,'color':MUT})])

# ---- 15 additional ----
s=S[14]
for sh in s.shapes:
    if sh.has_text_frame and 'Additional' in sh.text_frame.text:
        par=sh.text_frame.paragraphs[0]; par.runs[0].text='Additional Slide: the Live view, where every decision can be seen'; sh.left=Inches(0.28); sh.top=Inches(0.86); sh.width=Inches(9.4); sh.height=Inches(0.4)
pic=s.shapes.add_picture('shot_live_small.png',Inches(1.78),Inches(1.4),width=Inches(6.44)); pic.line.color.rgb=LINE; pic.line.width=Pt(0.75)
tb(s,0.32,1.4,1.36,3.6,[('Left',{'size':9,'bold':True,'color':TEAL,'after':1}),('What the patient sees: a fixed emergency text.',{'size':8.5,'after':8}),('Middle',{'size':9,'bold':True,'color':TEAL,'after':1}),('Each step of the pipeline, with its result and time.',{'size':8.5,'after':8}),('Right',{'size':9,'bold':True,'color':TEAL,'after':1}),('What staff see: the alerts, and the flags on this patient.',{'size':8.5})])
tb(s,8.32,1.4,1.38,3.6,[('In this picture',{'size':9,'bold':True,'color':TEAL,'after':1}),('The rules caught the emergency in 19 ms, so the AI check was skipped: an emergency never waits for the AI.',{'size':8.5,'after':8}),('The earlier message about tramadol raised a same-day alert from the dose check.',{'size':8.5,'after':8}),('Fictional patient. Local run.',{'size':8,'color':MUT})])
p.save('PeriLoop_Submission_Deck.pptx'); print('saved')
