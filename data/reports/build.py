#!/usr/bin/env python3
"""Build data/reports/wi-reports.json: Wisconsin reports, recipients by county, records and periodic duties.
Sources: DQA P-02007 (09/2026), DQA BAL regional map (rev. Oct 6 2026), DHS 88 (Register May 2011 No. 665), DHS 83."""
import json, sys

CHECKED = "2026-11-27"
V, U, O = "verified", "unverified", "open"

regions = {
  "nw": {"name": "Northwestern Regional Office", "city": "Eau Claire",
         "address": "221 W. Madison St., Suite 205, Eau Claire, WI 54703",
         "phone": "715-836-4790", "fax": "608-224-5705", "email": "dhsdqabalwro@dhs.wisconsin.gov",
         "counties": "Ashland Barron Bayfield Buffalo Burnett Chippewa Clark Douglas Dunn Eau_Claire Florence Forest Iron Jackson Juneau Langlade La_Crosse Lincoln Marathon Monroe Oneida Pepin Pierce Polk Price Rusk Sawyer St._Croix Taylor Trempealeau Vernon Vilas Washburn"},
  "ne": {"name": "Northeastern Regional Office", "city": "Green Bay",
         "address": "200 N. Jefferson St., Suite 501, Green Bay, WI 54301",
         "phone": "920-448-5252", "fax": "608-224-5704", "email": "dhsdqabalnero@dhs.wisconsin.gov",
         "counties": "Adams Brown Calumet Door Fond_du_Lac Green_Lake Kewaunee Manitowoc Marinette Marquette Menominee Oconto Outagamie Ozaukee Portage Shawano Sheboygan Washington Waushara Waupaca Winnebago Wood"},
  "s":  {"name": "Southern Regional Office", "city": "Madison",
         "address": "201 E. Washington Ave., Room E300, Madison, WI 53703",
         "phone": "608-264-9888", "fax": "608-264-9889", "email": "dhsdqabalsro@dhs.wisconsin.gov",
         "counties": "Columbia Crawford Dane Dodge Grant Green Iowa Jefferson Lafayette Richland Rock Sauk Walworth Waukesha"},
  "se": {"name": "Southeastern Regional Office", "city": "Milwaukee",
         "address": "819 N. 6th St., Room 609B, Milwaukee, WI 53203-1606",
         "phone": "414-227-2005", "fax": "414-227-3903", "email": "dhsdqabalsero@dhs.wisconsin.gov",
         "counties": "Kenosha Milwaukee Racine"},
}
for r in regions.values():
    r["counties"] = [c.replace("_", " ") for c in r["counties"].split()]
    r["status"] = V
    r["source"] = "dqa-map"
allc = [c for r in regions.values() for c in r["counties"]]
assert len(allc) == 72 and len(set(allc)) == 72, len(allc)

recipients = {
  "dqa_region": {"name": "DQA regional office (Bureau of Assisted Living)", "how": "Fax or email the completed form to the regional office for your county (P-02007).", "status": V},
  "licensing": {"name": "Licensing agency", "how": "For most adult family homes this is the DQA regional office. If a county licensed your home, report to that county instead (DHS 88.02).", "status": V},
  "dqa_death": {"name": "DQA Death Reporting Coordinator", "how": "Form F-62470. Send it as the form instructs.", "status": V},
  "plan_review": {"name": "DQA Office of Plan Review", "how": "Form F-62500.", "email": "DHSDQAPlanReview@dhs.wisconsin.gov", "fax": "608-267-0352", "address": "201 E. Washington Ave., Room E300, Madison, WI 53703", "status": V},
  "mrs": {"name": "DQA Misconduct Reporting System (Office of Caregiver Quality)", "how": "Online through the Misconduct Reporting System (MRS). Form F-62447 lists what to include. If MRS is down and it can't wait, email DHSOfficeofCaregiverQuality@dhs.wisconsin.gov.", "email": "DHSOfficeofCaregiverQuality@dhs.wisconsin.gov", "status": V},
  "police": {"name": "Law enforcement", "how": "Call 911 for an emergency, or your local police or sheriff non-emergency line.", "status": V},
  "e911": {"name": "911", "how": "Call 911.", "status": V},
  "aps": {"name": "County adult protective services (adult at risk)", "how": "Call the county intake number saved in Facility setup.", "status": V},
  "ombudsman": {"name": "Board on Aging and Long Term Care ombudsman (age 60 and over)", "phone": "1-800-815-0015", "how": "Phone.", "status": V},
  "drw": {"name": "Disability Rights Wisconsin (under 60)", "how": "Phone or online intake. Check the current number at disabilityrightswi.org.", "status": U},
  "health": {"name": "Local health officer (county or city health department)", "how": "Category I and outbreaks: phone right away. Category II: WEDSS or form F-44151.", "phone_state": "608-267-9003", "status": V},
  "mco": {"name": "MCO care team (Family Care)", "how": "Your MCO's incident process. Deadlines come from your MCO contract, often 24 hours.", "status": "house"},
  "guardian": {"name": "Guardian, POA or family (per the service plan)", "how": "Phone, then note it in the record.", "status": V},
  "physician": {"name": "Physician, prescriber or nurse", "how": "Phone or fax.", "status": V},
  "coroner": {"name": "Medical examiner or coroner", "how": "Usually through 911 or police. Wis. Stat. 979.01 requires unexplained, accident and suicide deaths to be reported right away.", "status": U},
  "record": {"name": "Resident or home record", "how": "File a copy in the record.", "status": V},
}

def R(to, clock, cite, settings, status=V, form=None, note=None, required=True, **k):
    d = {"to": to, "clock": clock, "cite": cite, "settings": settings, "status": status, "required": required}
    if form: d["form"] = form
    if note: d["note"] = note
    d.update(k)
    return d

# clock: {"type":"immediate"} | {"type":"hours","n":24} | {"type":"business_days","n":3} | {"type":"days","n":7} | {"type":"before_days","n":30} | {"type":"next_business_day"} | {"type":"none"}
IMM = {"type": "immediate"}
H = lambda n: {"type": "hours", "n": n}
BD = lambda n: {"type": "business_days", "n": n}
DY = lambda n: {"type": "days", "n": n}
BEFORE = lambda n: {"type": "before_days", "n": n}
NBD = {"type": "next_business_day"}
NONE = {"type": "none"}

A, C, B = ["afh"], ["cbrf"], ["afh", "cbrf"]

events = [
  {"id": "death-restraint", "group": "Deaths", "title": "Death that may be linked to restraint, seclusion, psychotropic medicine or suicide",
   "match": r"\b(died|dead|death|passed away|deceased|suicide)\b.*\b(restrain|seclu|psychotropic|antipsychotic|suicid)|\b(suicide)\b",
   "reports": [
     R("e911", IMM, "", B, note="If anyone may still be helped."),
     R("dqa_death", H(24), "DHS 83.12(1)(a); DQA P-02007", C, form="F-62470"),
     R("dqa_death", H(24), "DHS 88.03(5)(e)1; DQA P-02007", A, form="F-62470"),
     R("coroner", IMM, "Wis. Stat. 979.01", B, status=U),
     R("guardian", IMM, "DHS 88.03(5)(e)2; DHS 83.12(5)", B),
     R("mco", H(24), "MCO contract", B, status="house", required=False, when_pay="Family Care (MCO)"),
     R("record", NONE, "DHS 88.03(5)(e)2", A, note="Record date, time, circumstances and who received the body."),
   ]},
  {"id": "death-accident", "group": "Deaths", "title": "Death from an accident or injury",
   "match": r"\b(died|dead|death|passed away|deceased)\b.*\b(fell|fall|accident|injur|chok|burn|drown)|\b(fell|fall|accident|choked)\b.*\b(died|death|passed away)\b",
   "reports": [
     R("e911", IMM, "", B),
     R("dqa_region", BD(3), "DHS 83.12(1)(b); DQA P-02007", C, form="F-02208 (optional)"),
     R("licensing", H(24), "DHS 88.03(5)(e)1 and (e)2; DQA P-02007", A, status=O,
       note="DHS 88 lists accidental deaths under both the 24-hour rule and the 3-day rule. The app uses 24 hours, the safer reading, until DQA answers."),
     R("coroner", IMM, "Wis. Stat. 979.01", B, status=U),
     R("guardian", IMM, "DHS 88.03(5)(e)2; DHS 83.12", B),
     R("mco", H(24), "MCO contract", B, status="house", required=False, when_pay="Family Care (MCO)"),
     R("record", NONE, "DHS 88.03(5)(e)2", A, note="Record date, time, circumstances and who received the body."),
   ]},
  {"id": "death-other", "group": "Deaths", "title": "Other death that was not natural or expected",
   "match": r"\b(unexpected|unexplained|sudden)\b.*\b(death|died)\b|\b(died|death)\b.*\b(unexpected|unexplained|sudden)\b",
   "reports": [
     R("licensing", DY(3), "DHS 88.03(5)(e)2", A),
     R("coroner", IMM, "Wis. Stat. 979.01", B, status=U),
     R("guardian", IMM, "DHS 88.03(5)(e)2", B),
     R("record", NONE, "DHS 88.03(5)(e)2", A, note="Record date, time, circumstances and who received the body."),
   ]},
  {"id": "death-natural", "group": "Deaths", "title": "Expected or natural death (for example on hospice)",
   "match": r"\b(hospice)\b.*\b(died|passed)|\b(passed away peacefully|natural death|expected death)\b",
   "not_dqa": "Natural deaths are not reported to DQA (P-02007; DHS 83.12(1)(c)).",
   "reports": [
     R("guardian", IMM, "DHS 88.03(5)(e)2; DHS 83.12", B),
     R("mco", H(24), "MCO contract", B, status="house", required=False, when_pay="Family Care (MCO)"),
     R("record", NONE, "DHS 88.09(1); DHS 83", B, note="Record the date, time and who was notified."),
   ]},
  {"id": "fire", "group": "Fire and emergencies", "title": "Fire (fire department came or helped)",
   "match": r"\b(fire|flames|burning|fire department)\b",
   "reports": [
     R("e911", IMM, "", B),
     R("plan_review", BD(3), "DHS 83.12(4)(e); DQA P-02007", C, form="F-62500"),
     R("plan_review", H(72), "DHS 88.05(4)(e); DQA P-02007", A, form="F-62500", note="Required when the fire department helped."),
     R("guardian", H(24), "", B, required=False),
   ]},
  {"id": "catastrophe", "group": "Fire and emergencies", "title": "Catastrophe, evacuation or damage to the home (storm, flood, gas, power loss that forced a move)",
   "match": r"\b(evacuat|flood|tornado|storm damage|gas leak|carbon monoxide|roof|collapsed|no heat|power outage)\b",
   "reports": [
     R("dqa_region", BD(3), "DHS 83.12(4)(d) and (f); DQA P-02007", C),
     R("licensing", DY(7), "DHS 88.03(5)(d); DQA P-02007", A, note="Damage or hazards that affect the home's structure."),
     R("guardian", H(24), "", B, required=False),
   ]},
  {"id": "missing", "group": "Residents", "title": "Missing resident",
   "match": r"\b(missing|left the building|eloped|wandered off|couldn't find|could not find|can't find)\b",
   "reports": [
     R("police", IMM, "DHS 83.12(4)(a); DQA P-02007", C),
     R("police", IMM, "Home's missing person plan", A, status="house", note="Call police right away once a short search fails."),
     R("dqa_region", BD(3), "DHS 83.12(4)(a); DQA P-02007", C),
     R("licensing", H(24), "DHS 88.03(5)(e)1; DQA P-02007", A),
     R("guardian", IMM, "DHS 88.07(2)(b)6", B),
     R("mco", H(24), "MCO contract", B, status="house", required=False, when_pay="Family Care (MCO)"),
   ]},
  {"id": "hospital", "group": "Residents", "title": "Injury or incident that needed ER or hospital care",
   "match": r"\b(er|emergency room|hospital|ambulance|admitted|911)\b",
   "reports": [
     R("dqa_region", BD(3), "DHS 83.12(4)(c); DQA P-02007", C),
     R("licensing", H(24), "DHS 88.03(5)(e)1; DQA P-02007", A, note="Significant change, including hospitalization."),
     R("guardian", H(24), "DHS 88.07(2)(b)6", A),
     R("guardian", IMM, "DHS 83.12(5)(a)", C),
     R("physician", H(24), "", A, required=False),
     R("physician", IMM, "DHS 83.12(5)(a)", C),
     R("mco", H(24), "MCO contract", B, status="house", required=False, when_pay="Family Care (MCO)"),
   ]},
  {"id": "police", "group": "Residents", "title": "Police or law enforcement came to the home",
   "match": r"\b(police|officer|sheriff|deputy|law enforcement)\b",
   "reports": [
     R("dqa_region", BD(3), "DHS 83.12(4)(b); DQA P-02007", C),
   ]},
  {"id": "misconduct", "group": "Abuse, neglect and theft", "title": "Possible abuse, neglect, theft of a resident's money or things, or an injury no one can explain",
   "match": r"\b(abuse|abused|neglect|neglected|stole|stolen|missing money|slapped|pushed|shoved|unexplained bruise|bruise.{0,20}(unknown|no one knows)|injury of unknown)\b",
   "reports": [
     R("mrs", DY(7), "DHS 83.12(2)(a); DHS 13.05; DQA P-02007", C, note="Within 7 calendar days, after the home's own look into what happened."),
     R("mrs", IMM, "DHS 88.11(1); DQA P-02007", A, note="Adult family homes report right away."),
     R("police", IMM, "DHS 88.11(1)", A, note="If a crime may have happened."),
     R("police", IMM, "DHS 13.05", C, required=False, note="If a crime may have happened."),
     R("aps", NONE, "Wis. Stat. 46.90 and 55.043", B, required=False, note="You may also report to the county. Good-faith reporters are protected."),
     R("ombudsman", NONE, "", B, required=False, note="Optional, for residents 60 and over."),
     R("guardian", H(24), "", A),
     R("guardian", IMM, "DHS 83.12(5)(b)", C, note="Abuse or neglect: right away. Theft of money or things: within 72 hours."),
     R("mco", H(24), "MCO contract", B, status="house", required=False, when_pay="Family Care (MCO)"),
   ]},
  {"id": "adult-at-risk", "group": "Abuse, neglect and theft", "title": "Adult at risk (abuse or self-neglect by someone outside the home, or financial exploitation)",
   "match": r"\b(exploit|scam|self.neglect|family member took|son took|daughter took|visitor took)\b",
   "reports": [
     R("aps", NONE, "Wis. Stat. 46.90(4)(ab)1 and 55.043(1m)(a); DQA P-02007", B, note="No set deadline. Report soon. Law enforcement or the ombudsman also take these."),
     R("police", NONE, "", B, required=False),
   ]},
  {"id": "restraint", "group": "Residents", "title": "Emergency physical restraint was used",
   "match": r"\b(restrain|held (him|her|them) down|physical hold)\b",
   "reports": [
     R("licensing", NBD, "DHS 88.10(3)(n)2", A),
     R("record", NONE, "DHS 83 (restraint rules); DQA P-02007", C, note="CBRFs document it in the resident record. No DQA report."),
     R("guardian", H(24), "", B),
   ]},
  {"id": "disease", "group": "Health", "title": "Reportable illness or outbreak (for example flu or COVID cluster, TB, stomach bug going around)",
   "match": r"\b(outbreak|tb|tuberculosis|covid|influenza|flu|norovirus|stomach bug|vomiting.{0,20}(several|many|residents)|scabies|measles)\b",
   "reports": [
     R("health", IMM, "DHS 145.04; DQA P-02007", B, note="Category I diseases and any outbreak: phone right away."),
     R("health", H(72), "DHS 145.04; DQA P-02007", B, required=False, note="Category II diseases: within 72 hours through WEDSS or form F-44151.", form="F-44151"),
   ]},
  {"id": "change", "group": "Health", "title": "Big change in a resident's health, illness over 3 days, or away over 24 hours",
   "match": r"\b(sick for|ill for|getting worse|big change|decline|away overnight|not back)\b",
   "reports": [
     R("guardian", H(24), "DHS 88.07(2)(b)6", A),
     R("mco", H(24), "DHS 88.07(2)(b)6; MCO contract", A, note="The placing agency.", when_pay="Family Care (MCO)"),
     R("licensing", H(24), "DHS 88.03(5)(e)1", A, required=False, note="Required when it is a significant change in status, such as hospitalization."),
     R("physician", H(24), "", A),
     R("guardian", IMM, "DHS 83.12(5)(a)", C),
     R("physician", IMM, "DHS 83.12(5)(a)", C),
   ]},
  {"id": "medication", "group": "Health", "title": "Medication error, or a medicine refused twice in a row",
   "match": r"\b(missed dose|wrong dose|wrong med|med error|medication error|gave .{0,20} wrong|refused .{0,25}(med|pill))\b",
   "reports": [
     R("physician", IMM, "DHS 83.37; DHS 88.07(3)(e)", B, note="Errors: call the nurse or pharmacist now. Two refusals in a row in a CBRF: tell the prescriber."),
     R("record", NONE, "DHS 88.07(3)(e)1; DHS 83.37", B, note="Write it on the medication record (errors and omissions)."),
     R("mco", H(24), "MCO contract", B, status="house", required=False, when_pay="Family Care (MCO)"),
   ]},
  {"id": "charges", "group": "Staff and the home", "title": "A staff member, licensee or household member was charged with or convicted of a crime",
   "match": r"\b(arrested|charged with|convicted|pending charge)\b",
   "reports": [
     R("licensing", H(48), "DHS 88.03(5)(c)", A),
     R("dqa_region", NBD, "DHS 12.07(2); DQA P-02007", C),
   ]},
]

changes = [
  {"id": "household", "title": "Someone moves into or out of the household (AFH)", "reports": [R("licensing", DY(7), "DHS 88.03(5)(b)", A)]},
  {"id": "services", "title": "Change in the services the home provides", "reports": [R("licensing", DY(7), "DHS 88.03(5)(a)", A)]},
  {"id": "program", "title": "Change to the program statement", "reports": [R("licensing", BEFORE(30), "DHS 88.03(2)(b)2", A, note="Needs approval before you start."), R("dqa_region", BEFORE(30), "DHS 83.06(3)", C)]},
  {"id": "client-group", "title": "Change in the type of residents served (client group)", "reports": [R("licensing", BEFORE(30), "DHS 88.04(2)(c); DQA P-02007", A), R("dqa_region", BEFORE(30), "DHS 83.14(2)(b); DQA P-02007", C, note="Needs written approval first.")]},
  {"id": "capacity", "title": "Change in capacity or CBRF class", "reports": [R("dqa_region", NONE, "DHS 83.14(2)(c); DQA P-02007", C, note="Needs DQA written approval before the change.")]},
  {"id": "administrator", "title": "New administrator", "reports": [R("dqa_region", DY(7), "DHS 83.14(2)(e); DQA P-02007", C)]},
  {"id": "ownership", "title": "Change of owner or location", "reports": [R("dqa_region", BEFORE(30), "DHS 83.10; DQA P-02007", C, note="Tell residents at least 7 days ahead."), R("licensing", BEFORE(30), "DQA P-02007", A)]},
  {"id": "closing", "title": "Closing the home", "reports": [R("dqa_region", BEFORE(30), "DHS 83.11; Wis. Stat. 50.03(14); DQA P-02007", C, note="Longer if 5 or more residents must move."), R("licensing", BEFORE(7), "DQA P-02007", A)]},
  {"id": "discharge", "title": "Discharging a resident (not an emergency)", "reports": [R("guardian", BEFORE(30), "DHS 88.08", A, note="Written notice to the resident, guardian, service coordinator, placing agency and representative."), R("guardian", BEFORE(30), "DHS 83.31(4)(a)1", C)]},
]

# Records to keep and periodic duties. AFH from DHS 88 (verified). CBRF filled from DHS 83 when confirmed.
records = [
  {"id": "resident-record", "title": "Resident record", "afh": {"cite": "DHS 88.09(1)(d)", "rule": "ID and guardian, emergency contacts, placing agency, insurance, service agreement, physician exam, assessment and plan, rights statement, medication records, money records.", "keep": "7 years after discharge (DHS 88.09(1)(e))", "status": V}},
  {"id": "admission", "title": "Pre-admission information and service agreement", "afh": {"cite": "DHS 88.06(1)(a), 88.06(2)(b)-(c)", "rule": "Written info on complaints, costs and roles before admission. Signed service agreement before admission; changes 30 days ahead.", "status": V}},
  {"id": "rights", "title": "Rights and grievance notice", "afh": {"cite": "DHS 88.10(2)", "rule": "Explain and give copies before the service agreement is signed.", "status": V}},
  {"id": "exam", "title": "Admission physical and TB screen", "afh": {"cite": "DHS 88.06(2)(a)", "rule": "Within 90 days before or 7 days after admission.", "status": V}},
  {"id": "plan", "title": "Assessment and individual service plan", "afh": {"cite": "DHS 88.06(3)", "rule": "Within 30 days after placement; review at least every 6 months and when needs change.", "status": V}},
  {"id": "mar", "title": "Medication records and physician orders", "afh": {"cite": "DHS 88.07(3)(d)-(e)", "rule": "Written order on file before giving. Record name, medicine, date and time, errors and omissions, side effects.", "status": V}},
  {"id": "incident", "title": "Incident and event reports", "afh": {"cite": "DHS 88.03(5); DHS 88.09(1)", "rule": "A copy of each report and who was told, in the resident or home record.", "status": V}},
  {"id": "grievance", "title": "Grievance summaries", "afh": {"cite": "DHS 88.10(5)(d)", "rule": "Written summary of the grievance, findings and action, sent to the resident and others and filed in the record.", "status": V}},
  {"id": "staff-record", "title": "Staff personnel records", "afh": {"cite": "DHS 88.09(2)", "rule": "Training, TB screen, background check, discipline, end date.", "keep": "3 years after the job ends (DHS 88.09(2)(c))", "status": V}},
  {"id": "background", "title": "Background checks", "afh": {"cite": "DHS 88.03(3)(b)-(c)", "rule": "Before anyone gives care. Nurse aide registry where it applies. Licensing agency rechecks the licensee and adult household members every 2 years.", "status": V}},
  {"id": "staff-tb", "title": "Staff TB screen", "afh": {"cite": "DHS 88.04(2)(g)", "rule": "Within 90 days before starting care, documented by a physician, RN or PA.", "status": V}},
  {"id": "fire-drill-log", "title": "Fire drill and evacuation records", "afh": {"cite": "DHS 88.05(4)(d)", "rule": "Date and evacuation time for each drill. Evacuation check for each resident at placement and yearly.", "status": V}},
]
periodic = [
  {"id": "fire-drills", "title": "Fire drills", "afh": {"every": "Every 6 months, with all household members", "cite": "DHS 88.05(4)(d)2.c", "status": V}},
  {"id": "evac-eval", "title": "Resident evacuation evaluation (2 minutes)", "afh": {"every": "At placement and every year", "cite": "DHS 88.05(4)(d)2.a-b", "status": V}},
  {"id": "smoke", "title": "Smoke detector test", "afh": {"every": "Every month", "cite": "DHS 88.05(4)(b)2", "status": V}},
  {"id": "extinguisher", "title": "Fire extinguisher inspection", "afh": {"every": "Every year, with a dated tag", "cite": "DHS 88.05(4)(a)", "status": V}},
  {"id": "isp-review", "title": "Service plan review", "afh": {"every": "At least every 6 months", "cite": "DHS 88.06(3)(f)", "status": V}},
  {"id": "physical", "title": "Resident physical exam", "afh": {"every": "Every year", "cite": "DHS 88.07(2)(e)", "status": V}},
  {"id": "training", "title": "Staff training", "afh": {"every": "15 hours within 6 months of starting, then 8 hours a year", "cite": "DHS 88.04(5)", "status": V}},
  {"id": "biennial", "title": "Biennial license report and fee", "afh": {"every": "Every 24 months", "cite": "DHS 88.03(4)(b)", "status": V}},
]

# CBRF entries filled from DHS 83 research (see cbrf.json next to this script) or left unverified.
import os
cb = {}
p = os.path.join(os.path.dirname(__file__), "cbrf.json")
if os.path.exists(p):
    cb = json.load(open(p))
for name, lst in (("records", records), ("periodic", periodic)):
    have = {it["id"]: it for it in lst}
    for k, v in cb.get(name, {}).items():
        v = dict(v); title = v.pop("title", None)
        if k in have: have[k]["cbrf"] = v
        else: lst.append({"id": k, "title": title, "cbrf": v})

out = {
  "version": 1, "state": "WI", "checked": CHECKED,
  "disclaimer": "Not legal advice. Check P-02007 and your license for your home.",
  "sources": {
    "p02007": {"title": "DQA P-02007, Reporting requirements for assisted living (09/2026)", "url": "https://www.dhs.wisconsin.gov/publications/p02007.pdf"},
    "dqa-map": {"title": "DQA Bureau of Assisted Living regional offices (revised Oct 6, 2026)", "url": "https://www.dhs.wisconsin.gov/dqa/bal-regionalmap.htm"},
    "dhs88": {"title": "Wis. Admin. Code ch. DHS 88 (Register May 2011 No. 665)", "url": "https://docs.legis.wisconsin.gov/code/admin_code/dhs/030/88"},
    "dhs83": {"title": "Wis. Admin. Code ch. DHS 83", "url": "https://docs.legis.wisconsin.gov/code/admin_code/dhs/030/83"},
  },
  "central": {"name": "DQA Bureau of Assisted Living, central office", "email": "dhsdqabalcentral@dhs.wisconsin.gov", "fax": "608-226-5494", "licensing_email": "dhsdqaballicensing@dhs.wisconsin.gov", "licensing_phone": "608-266-8482"},
  "regions": regions, "recipients": recipients, "events": events, "changes": changes,
  "records": records, "periodic": periodic,
  "incident_fields": ["Date and time", "Place", "People involved (roles and resident codes)", "What happened (facts only)", "Action taken", "Who was told, and when"],
  "open_questions": [
    {"id": "afh-accident-death", "q": "Is an accidental death in an adult family home due in 24 hours (DHS 88.03(5)(e)1) or 3 days (88.03(5)(e)2)?", "app": "Uses 24 hours until DQA answers."},
    {"id": "afh-county-licensed", "q": "P-02007 does not say whether county-licensed adult family homes send DQA reports to the county or to DQA.", "app": "Uses the licensing agency chosen in Facility setup."},
  ],
}
json.dump(out, open(sys.argv[1], "w"), indent=1, ensure_ascii=False)
print("events", len(events), "changes", len(changes), "records", len(records), "periodic", len(periodic))
