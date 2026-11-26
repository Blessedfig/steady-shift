// Steady Shift test app: content and sample data.
// Everything here is fictional sample data or general Wisconsin rule guidance.
// No real resident, staff or facility information belongs in this file.
window.SS_DATA = (function(){
  const CHECKED = '2026-11-26';

  const SETTINGS = {
    afh:  {short:'AFH',  name:'Licensed adult family home (DHS 88)'},
    cbrf: {short:'CBRF', name:'Community-based residential facility (DHS 83)'},
    home: {short:'Home', name:'Family caregiver at home'}
  };

  const SITES = [
    {id:'maple', name:'Maple Grove Home', setting:'afh',  beds:4,  staff:6,  city:'Sample County, WI'},
    {id:'birch', name:'Birch Hollow CBRF', setting:'cbrf', beds:12, staff:14, city:'Sample County, WI'},
    {id:'cedar', name:'Cedar Lane Home',  setting:'afh',  beds:4,  staff:5,  city:'Sample County, WI'},
    {id:'family',name:'Home with Mom',    setting:'home', beds:1,  staff:2,  city:'Sample County, WI'}
  ];

  // Fictional residents. Codes only in records; nicknames are made up.
  const RESIDENTS = {
    maple:[
      {code:'M-1',nick:'Ruth',note:'Walks with a walker. Likes coffee at 7.'},
      {code:'M-2',nick:'Walt',note:'Memory care plan. Asks to go home in the evening.'},
      {code:'M-3',nick:'June',note:'Insulin pen (RN-delegated task).'},
      {code:'M-4',nick:'Hank',note:'Prefers showers after lunch, often declines.'}
    ],
    birch:[
      {code:'B-2',nick:'Lois',note:'Nebulizer twice daily.'},
      {code:'B-5',nick:'Earl',note:'Exit-seeking near shift change.'},
      {code:'B-7',nick:'Pearl',note:'PRN for anxiety in plan.'},
      {code:'B-9',nick:'Gus',note:'Fall risk, bed alarm.'}
    ],
    cedar:[{code:'C-1',nick:'Edna',note:'Independent with meds.'},{code:'C-3',nick:'Roy',note:'Sundowning after 4 PM.'}],
    family:[{code:'Mom',nick:'Mom',note:'Lives at home. Paid family caregiver plus a weekend helper.'}]
  };

  const TIERS = [
    {id:'caregiver', name:'Caregiver',          who:'CNA or resident care staff on shift',            plan:'Included in the home plan'},
    {id:'manager',   name:'House manager',      who:'Runs one home day to day',                       plan:'Included in the home plan'},
    {id:'rn',        name:'RN',                 who:'Delegating or consulting nurse',                 plan:'Free when invited, RN Pro $29 to $49/mo (draft)'},
    {id:'owner',     name:'Owner',              who:'Licensee or owner of one home',                  plan:'Home $79/mo, Facility $199/mo (draft)'},
    {id:'multi',     name:'Multi-site operator',who:'Owns or runs several homes',                     plan:'$149/mo per extra site plus HQ about $99/mo (draft)'},
    {id:'family',    name:'Family caregiver',   who:'Cares for a family member at home',              plan:'About $10/mo (draft)'}
  ];

  // label: rule = "Rule says", reading = "Best reading", open = "Open question"
  const RULES = [
    {id:'C01', topic:'Care plans', q:'How often do we update the service plan?', keys:'service plan care plan isp update review yearly annual change of condition mco',
      label:'rule',
      afh:{a:'Update your home\'s own plan at least once a year and whenever the resident\'s condition changes, no matter when the care manager updates theirs.', cite:'DHS 88.06(3)(f)'},
      cbrf:{a:'Review and update the service plan at least once a year and whenever the resident\'s needs change. This was the most cited CBRF rule in 2025.', cite:'DHS 83.35(3)(d)'},
      home:{a:'Your agency or care manager owns the plan. Tell them whenever something changes, and keep your own notes of what changed and when.', cite:'Your program\'s plan rules'},
      steps:['Put each resident\'s plan due date on the calendar.','Any "change of condition" note starts a plan review.','Date and sign the review, even if nothing changed.'],
      house:{text:'Sample policy: "Care plans reviewed yearly with the care manager."', flag:'gap', note:'Add "and on any change of condition". Yearly alone is cited often.'}},
    {id:'C02', topic:'Medications', q:'Can I set up meds in a cup or envelope for later?', keys:'pre-pour pour set up meds cup envelope later med pass medication',
      label:'rule',
      afh:{a:'No. In a licensed AFH, meds stay in the original pharmacy container until you give them. No pre-pouring for later.', cite:'DHS 88.07(3)(a)'},
      cbrf:{a:'Not unless an RN supervises your med system and has delegated setup to you. Without RN supervision, the pharmacy must supply unit doses.', cite:'DHS 83.37(2)(c)'},
      home:{a:'Follow the pharmacy label and any plan from the nurse. A pill organizer is common at home, but ask the nurse or pharmacist how they want it filled.', cite:'Nurse or pharmacist instructions'},
      steps:['Give from the original container.','Record right after you give it.','If you are unsure, stop and ask. Do not pour ahead.'],
      house:{text:'Sample policy matches: "Meds are given from the pharmacy package."', flag:'ok'}},
    {id:'C03', topic:'Medications', q:'A dose was missed because it ran out or they said no. What do I do?', keys:'missed dose refused refusal ran out unavailable pharmacy delay omission med',
      label:'rule',
      afh:{a:'Residents may refuse unless a court ordered otherwise. Record every refusal or missed dose and who you told. Track refills so meds do not run out.', cite:'DHS 88.07(3)(b), 88.07(3)(e)1'},
      cbrf:{a:'Record every refusal or missed dose. Two refusals in a row go to the prescriber as soon as possible. Residents have a right to their prescribed meds, so running out is a citation risk.', cite:'DHS 83.32(3)(h), 83.37(1)(k), 83.37(2)(d)'},
      home:{a:'Write down the refusal or missed dose and call the pharmacy or nurse if it is a medicine that should not be skipped.', cite:'Nurse or pharmacist instructions'},
      steps:['Offer again later if the order allows.','Record "refused" or "not available" with the time.','Tell the manager. CBRF: tell the prescriber after 2 in a row.','Order refills when 7 days are left.'],
      house:{text:'Sample policy: "Not a med error: resident in hospital, refusal, pharmacy delay."', flag:'house', note:'Fine as a house rule, but each one still has to be recorded as an omission or refusal.'}},
    {id:'C04', topic:'Medications', q:'Can an aide decide when to give a PRN (as-needed) med?', keys:'prn as needed as-needed anxiety pain judgment aide decide',
      label:'open',
      afh:{a:'Not settled. The safest reading: the written order must say exactly when to give it, and staff follow it without making a judgment call. If the order needs judgment ("for anxiety"), call the nurse or manager.', cite:'DHS 88.07(3)(d) (order must be written)'},
      cbrf:{a:'Not settled for orders that need judgment. Follow the order\'s written criteria. If unclear, call the supervising nurse. PRN psychotropics need a written reason and target behavior in the plan.', cite:'DHS 83.37(1)(i)'},
      home:{a:'Follow the doctor\'s or nurse\'s written instructions. If they are unclear, call the nurse line before giving it.', cite:'Nurse instructions'},
      steps:['Read the order\'s criteria out loud.','If it fits clearly, give and record the reason and result.','If it needs judgment, call the nurse first.','Use Decide and Document if your home has no written answer.'],
      house:{text:'Sample policy is silent on PRN criteria.', flag:'gap', note:'Write down who decides PRN use and how.'}},
    {id:'C05', topic:'Rights and refusals', q:'A resident keeps refusing showers. Is it neglect if I don\'t push?', keys:'shower bath refuse refusal refusing neglect hygiene push',
      label:'reading',
      afh:{a:'A resident with capacity may refuse. Neglect risk comes from not offering, not documenting, or not updating the plan. Re-offer, try other options, and tell the manager.', cite:'DHS 88.07(1)(c)-(d) (choice of activities)'},
      cbrf:{a:'Same idea: offer, document, try alternatives, and take repeated refusals to the service plan.', cite:'DHS 83.32 (resident rights)'},
      home:{a:'Your person can say no. Try a different time, a sponge bath, or a different helper, and tell the nurse if hygiene becomes a health problem.', cite:'General care practice'},
      steps:['Offer again later, or have a different person offer.','Try a choice: shower or sponge bath, now or after lunch.','Log each offer and what was tried.','3 refusals in 7 days: ask for a plan review.'],
      house:{text:'Sample policy: "Showers twice a week on assigned days."', flag:'house', note:'A schedule is fine, but it can\'t override a resident\'s choice. Note preferences in the plan.'}},
    {id:'C06', topic:'Falls', q:'Resident fell. Do I lift them or call 911?', keys:'fall fell floor lift 911 lift assist no-lift injury',
      label:'open',
      afh:{a:'Follow your home\'s written emergency plan. Any sign of injury (pain, can\'t move a limb, hit head, bleeding, confusion): call 911 and do not lift. No sign of injury: use your home\'s lift procedure and equipment.', cite:'Your home\'s emergency plan; no DHS rule found'},
      cbrf:{a:'Same: injury signs mean 911. Otherwise follow the facility lift procedure. A fall with ER care is a DQA report within 3 working days.', cite:'DHS 83.12(4)(c)'},
      home:{a:'If they are hurt, hit their head or can\'t get up safely, call 911. Do not lift someone alone if you could both get hurt.', cite:'General safety practice'},
      steps:['Check for injury before moving them.','Injury or doubt: 911, keep them warm, don\'t lift.','No injury: lift per procedure with help.','Record time, what you saw, who you told.'],
      house:{text:'Sample policy: "Never lift. Always call 911."', flag:'house', note:'Allowed, but talk to your fire department. Some charge lift-assist fees.'}},
    {id:'C07', topic:'Emergencies', q:'Our policy says no medical care. Do I still do CPR?', keys:'cpr 911 dispatcher first aid choking dnr no medical care emergency',
      label:'reading',
      afh:{a:'Call 911 first and follow the dispatcher. Honor a valid DNR. First aid is part of required AFH training.', cite:'DHS 88.04(5)(a)'},
      cbrf:{a:'Call 911 first, follow the dispatcher, honor a valid DNR. CBRF staff must be trained in first aid and choking within 90 days.', cite:'DHS 83.20(2)(c)'},
      home:{a:'Call 911 and follow the dispatcher. Keep the DNR or POLST where responders can see it.', cite:'General safety practice'},
      steps:['Call 911.','Check the code status sheet.','Follow the dispatcher.','Call the manager after.'],
      house:{text:'Sample policy: "Call the guardian before 911."', flag:'gap', note:'Reverse this. 911 first, guardian after.'}},
    {id:'C08', topic:'Rights and refusals', q:'The resident doesn\'t want a lock on their door. Can we skip it?', keys:'lock door key privacy hcbs bedroom',
      label:'rule',
      afh:{a:'No, if Medicaid (Family Care) funds any resident. Locks are required on living-unit doors even if declined. Only a documented, assessed safety reason in the plan can deactivate one.', cite:'42 CFR 441.301(c)(4); DHS P-01817'},
      cbrf:{a:'Same rule for any Family Care resident. Exempt only if the home is entirely private pay.', cite:'42 CFR 441.301(c)(4); DHS P-01817'},
      home:{a:'This rule is for group settings. It does not apply in your own home.', cite:'Not applicable'},
      steps:['Install a lock; staff knock and wait.','If a lock is unsafe, document the assessment in the plan.','Review that decision on a set date.'],
      house:{text:'Sample policy matches the rule.', flag:'ok'}},
    {id:'C09', topic:'Rights and refusals', q:'Are house rules like "kitchen closes at 8" allowed?', keys:'house rules kitchen visitors bedtime curfew food snack hcbs rights',
      label:'rule',
      afh:{a:'Only privacy, locks, roommates, decorating, schedules, food access and visitors can be limited, and only per person, with an assessed need, consent, less intrusive tries and a review date in the plan.', cite:'DHS HCBS modifications; form P-03794'},
      cbrf:{a:'Same rule for Family Care residents. Blanket rules for everyone are not allowed.', cite:'DHS HCBS modifications; form P-03794'},
      home:{a:'Not applicable at home.', cite:'Not applicable'},
      steps:['List your house rules.','Flag any that limit the 7 areas.','Change it to per-person with a modification form, or drop it.'],
      house:{text:'Sample policy: "Visitors 9 AM to 8 PM."', flag:'gap', note:'Blanket visiting hours limit a protected area. Needs a per-person reason or removal.'}},
    {id:'C10', topic:'Incidents', q:'Who do I report to first, and how fast?', keys:'report incident abuse neglect misconduct dqa deadline hours days who tell',
      label:'reading',
      afh:{a:'Tell your manager or the person your home names right away. Suspected abuse, neglect or theft by staff: the home reports to DQA within 7 calendar days, and residents are protected immediately. Care manager timelines are in the MCO contract.', cite:'DHS 13.05'},
      cbrf:{a:'Same 7-day misconduct report. Other events (serious injury, police called, missing resident, fire) go to DQA within 3 working days. Some deaths within 24 hours.', cite:'DHS 13.05; DHS 83.12(4); P-02007'},
      home:{a:'If you think someone is being harmed, call the county adult protective services line. In danger: 911.', cite:'Wis. Stat. s. 46.90, s. 55.043'},
      steps:['Keep residents safe first.','Write facts only: time, place, who, exact words.','Tell the person your home designates.','The app shows each deadline on the report.'],
      house:{text:'Sample policy: "Serious injury reported within 24 hours."', flag:'house', note:'Stricter than the 3 working day CBRF rule, which is fine.'}},
    {id:'C11', topic:'Hiring', q:'Can a new hire start before the background check is back?', keys:'background check new hire start bid caregiver worcs',
      label:'rule',
      afh:{a:'Yes, for up to 60 days if they are supervised, the BID form is clean and the check has been requested. Recheck every 4 years.', cite:'DHS 12; P-00038 s. 2.2.2'},
      cbrf:{a:'Same: up to 60 days supervised. Recheck every 4 years and after any new charge.', cite:'DHS 12; P-00038 s. 2.2.2'},
      home:{a:'Your agency or program runs the check before you are paid.', cite:'Program rules'},
      steps:['BID form first.','Run the check through WORCS.','Supervise until it is back.','Set a recheck for 3 years 10 months.'],
      house:{text:'Sample policy: "Background checks every 4 years."', flag:'ok'}},
    {id:'C12', topic:'Training', q:'How many training hours do I need?', keys:'training hours ce continuing education annual new hire orientation',
      label:'rule',
      afh:{a:'15 hours of approved training within 6 months of starting, then 8 hours every year.', cite:'DHS 88.04(5)'},
      cbrf:{a:'Topic training mostly within 90 days (meds before you give any), then 15 hours of continuing education each year. Direct supervision until training is done.', cite:'DHS 83.20 to 83.25'},
      home:{a:'Whatever your program requires, plus any task the nurse teaches you. Keep a record.', cite:'Program rules'},
      steps:['Check your hours on your training record.','Ask your manager for the next class.'],
      house:{text:'Sample policy: "8 hours of training a year."', flag:'gap', note:'Add the 15 hours within 6 months for new staff.'}},
    {id:'C13', topic:'Fire safety', q:'How often do we do fire drills?', keys:'fire drill evacuation smoke detector',
      label:'rule',
      afh:{a:'An evacuation evaluation at least once a year.', cite:'DHS 88.05(4)(d)2.b'},
      cbrf:{a:'Quarterly drills, with at least one during sleeping hours each year.', cite:'DHS 83.47(2)(d)'},
      home:{a:'Have a plan for getting your person out and test smoke detectors monthly.', cite:'General safety practice'},
      steps:['Put drills on the calendar.','Record date, time, who took part, how long it took.'],
      house:{text:'Sample policy: "Fire drills yearly."', flag:'ok', note:'Right for an AFH. A CBRF needs quarterly.'}},
    {id:'C14', topic:'Hiring', q:'What health screening do new staff need?', keys:'tb test health screening new staff communicable',
      label:'reading',
      afh:{a:'A health screening, including TB, within 90 days before starting to provide care.', cite:'DHS 88.04(2)(g)1'},
      cbrf:{a:'Screened for communicable disease before resident contact. The exact method (test or symptom screen) still needs a rule check.', cite:'DHS 83.17(2)(a)'},
      home:{a:'Follow your program\'s rules.', cite:'Program rules'},
      steps:['Screen before the first shift.','File the result in the personnel record.'],
      house:{text:'Sample policy matches.', flag:'ok'}},
    {id:'MED1', topic:'Medications', q:'Can I give a med on a verbal order from the doctor?', keys:'verbal order phone order doctor written order med',
      label:'rule',
      afh:{a:'No. You need a signed written order in the resident\'s file before giving any prescription, over-the-counter med or supplement, and it names who may give it.', cite:'DHS 88.07(3)(d)'},
      cbrf:{a:'No. A written practitioner order is required first.', cite:'DHS 83.37(1)(a)'},
      home:{a:'Follow the doctor\'s instructions and ask the pharmacy to update the label.', cite:'Pharmacy label'},
      steps:['Ask the office to fax or send the written order.','Do not give until it is in the file.'],
      house:{text:'Sample policy matches: no verbal orders.', flag:'ok'}},
    {id:'MED2', topic:'Medications', q:'I made a med error. What now?', keys:'med error wrong dose wrong person mistake medication error',
      label:'rule',
      afh:{a:'Check on the resident, then call the nurse or pharmacist right away and follow their advice. Record it and tell the manager.', cite:'DHS 88.07(3)(e)1'},
      cbrf:{a:'Report to the practitioner, supervising nurse or pharmacist immediately, and document it.', cite:'DHS 83.37(1)(k)'},
      home:{a:'Call the pharmacy or nurse line now. If they seem unwell, call 911.', cite:'General safety practice'},
      steps:['Check the resident.','Call the nurse or pharmacist now.','Write facts only.','Tell the manager. No blame, just the facts.'],
      house:{text:'Sample policy: "Vitals every shift for 72 hours after an error."', flag:'house', note:'A house or MCO practice, not a DHS rule. Fine to keep.'}},
    {id:'MISS', topic:'Incidents', q:'A resident is missing. What do I do?', keys:'missing elopement wandering left gone cannot find',
      label:'rule',
      afh:{a:'Search the home and grounds quickly, then call the police right away and the manager.', cite:'Your home\'s missing person procedure'},
      cbrf:{a:'Call the police immediately. DQA report within 3 working days.', cite:'DHS 83.12(4)(a)'},
      home:{a:'Call 911 right away and give a description and photo.', cite:'General safety practice'},
      steps:['Quick search: rooms, yard, car.','Call police with description.','Call the manager now (this one wakes them).','Write the timeline.'],
      house:{text:'Sample policy matches.', flag:'ok'}}
  ];

  const SURVEY = {
    afh:[
      {q:'Every resident\'s plan was reviewed in the last 12 months and after any change of condition.', cite:'DHS 88.06(3)(f)', fix:'List due dates and review the overdue ones first.', top:'#1 AFH citation in 2025 (134)'},
      {q:'Every med has a signed written order that names who may give it.', cite:'DHS 88.07(3)(d)', fix:'Walk the med cart against the orders this week.'},
      {q:'Meds are kept in original containers and locked.', cite:'DHS 88.07(3)(a), (e)1', fix:'Remove any pre-poured or unlabeled meds.'},
      {q:'Every dose, refusal and missed dose is recorded with time and initials.', cite:'DHS 88.07(3)(e)1-2', fix:'Spot check 7 days of med records.'},
      {q:'New staff had a health screening within 90 days before giving care.', cite:'DHS 88.04(2)(g)1', fix:'Check each personnel file.', top:'Top 10 AFH citation (80)'},
      {q:'New staff finished 15 training hours within 6 months, and others have 8 hours this year.', cite:'DHS 88.04(5)', fix:'Use the training tracker to find gaps.'},
      {q:'An evacuation evaluation was done in the last 12 months.', cite:'DHS 88.05(4)(d)2.b', fix:'Schedule one and record how long it took.', top:'Top 10 AFH citation (81)'},
      {q:'Every caregiver has a background check less than 4 years old.', cite:'DHS 12', fix:'Set rechecks at 3 years 10 months.'},
      {q:'Living-unit doors have locks for Family Care residents.', cite:'42 CFR 441.301(c)(4)', fix:'Check each door, document any assessed exception.'},
      {q:'No blanket house rules limit visitors, food, schedules or privacy.', cite:'HCBS Settings Rule', fix:'Run your house rules through Clarity Card C09.'}
    ],
    cbrf:[
      {q:'Every service plan was reviewed in the last 12 months and after any change.', cite:'DHS 83.35(3)(d)', fix:'List due dates and review the overdue ones first.', top:'#1 CBRF citation in 2025 (189)'},
      {q:'Residents receive their prescribed meds, with refills ordered before they run out.', cite:'DHS 83.32(3)(h)', fix:'Set a 7-day refill alert.', top:'Top 10 CBRF citation (182)'},
      {q:'Every dose, refusal and missed dose is recorded.', cite:'DHS 83.37(2)(d)', fix:'Spot check 7 days of MARs.', top:'Top 10 CBRF citation (79)'},
      {q:'Two refusals in a row are reported to the prescriber.', cite:'DHS 83.37(1)(k)', fix:'Add the prescriber to the refusal procedure.'},
      {q:'Staff passed approved med training before giving meds.', cite:'DHS 83.20(2)(d)', fix:'Check trainer approval numbers in records.'},
      {q:'Topic training was done within 90 days, and 15 CE hours a year after.', cite:'DHS 83.20-83.25', fix:'Use the training tracker.'},
      {q:'Fire drills ran quarterly, one during sleeping hours this year.', cite:'DHS 83.47(2)(d)', fix:'Put the next 4 drills on the calendar.', top:'Top 10 CBRF citation (60)'},
      {q:'New staff were screened for communicable disease before contact.', cite:'DHS 83.17(2)(a)', fix:'Check each personnel file.', top:'Top 10 CBRF citation (68)'},
      {q:'Psychotropics are reassessed quarterly and PRN use monitored monthly.', cite:'DHS 83.37(1)(h)-(i)', fix:'Set both clocks per resident.'},
      {q:'Pharmacist regimen review within 30 days of admission and yearly.', cite:'DHS 83.37(1)(e)', fix:'Calendar each resident\'s review.'}
    ],
    home:[
      {q:'You have a current list of every medicine, with doses and times.', cite:'Good practice', fix:'Print one and keep it on the fridge.'},
      {q:'The DNR or POLST (if any) is where responders can find it.', cite:'Wis. Stat. ch. 154', fix:'Post it by the door or fridge.'},
      {q:'Your weekend helper knows who to call and when.', cite:'Good practice', fix:'Make a hand-off packet.'},
      {q:'Smoke and CO detectors were tested this month.', cite:'Good practice', fix:'Test them now.'},
      {q:'Any task a nurse taught you is signed off and dated.', cite:'N 6.03(3)', fix:'Ask the nurse to sign your checklist.'}
    ]
  };

  const WATCH = [
    {id:'W1', title:'DHS 88 rewrite: DQA forum', date:'2026-12-09', layer:'WI', applies:['afh'], status:'Proposed. Effective Jan 1, 2029 if approved.',
      what:'Public forum Dec 9, 2026, 4 to 5 PM. Changes after comments: no sprinklers for new Class C homes, registry-trained staff can give some med routes without an RN, health screening within 90 days before admission.',
      todo:['Decide who attends the forum','Write 2 questions to ask','Read the old vs. new Clarity Cards'], check:'Verified'},
    {id:'W2', title:'HCBS quality measures adopted by states', date:'2026-12-31', layer:'FED', applies:['afh','cbrf'], status:'States must adopt by Dec 31, 2026.',
      what:'Care managers may ask you for new data. The app will flag any change in what they ask for.', todo:['Note what your care managers ask for today'], check:'Verified'},
    {id:'W3', title:'DOL companionship and live-in rule', date:'2027-01-01', layer:'FED', applies:['home'], status:'Final rule expected about now. Keep paying overtime until it is final.',
      what:'Affects home care agencies and paid caregivers in homes, not AFH or CBRF staff.', todo:['Keep overtime rules as they are','Check the Wisconsin wage rules when it is final'], check:'Unverified'},
    {id:'W4', title:'Medicaid work rules and 6-month renewals', date:'2027-01-01', layer:'FED', applies:['afh','cbrf','home'], status:'Family Care members are exempt. Some staff may be affected for their own coverage.',
      what:'Mostly a staff issue: some caregivers on Medicaid may need to report work hours.', todo:['Share the "does this apply to me" card with staff'], check:'Unverified'},
    {id:'W5', title:'Access Rule: HCBS incident system', date:'2027-07-09', layer:'FED', applies:['afh','cbrf'], status:'States must have it running by July 9, 2027.',
      what:'Care manager incident steps will likely change. The incident router will be updated before the date.', todo:['Read the new form when it is published','Train staff on any change'], check:'Verified'},
    {id:'W6', title:'Access Rule: grievance system', date:'2027-12-31', layer:'FED', applies:['afh','cbrf'], status:'Enforcement moved to Dec 31, 2027.',
      what:'How resident complaints should flow for Family Care members.', todo:['Review your grievance procedure'], check:'Verified'},
    {id:'W7', title:'Medicaid payment caps', date:'2028-01-01', layer:'FED', applies:['afh','cbrf'], status:'Proposed. Phase-down from Jan 1, 2028.',
      what:'Indirect: state budgets and care manager rates. Shown in the owner money view.', todo:['Watch rate notices'], check:'Unverified'},
    {id:'W8', title:'80/20 wage pass-through', date:'2030-07-09', layer:'FED', applies:['home'], status:'Reporting by 2028, 80% to direct care pay from 2030.',
      what:'Applies to in-home personal care and home health agencies, not AFH or CBRF.', todo:['Start tracking direct care pay share'], check:'Verified'},
    {id:'W9', title:'Wisconsin fall bills', date:'', layer:'WI', applies:['afh','cbrf'], status:'Introduced Jan 23, 2026. Status not confirmed.',
      what:'Grant for lift devices and a fall training requirement. Would update the fall decision tree.', todo:['Check status monthly'], check:'Unverified'},
    {id:'W10', title:'Nursing home staffing rule repealed', date:'', layer:'FED', applies:['afh','cbrf'], status:'Repealed Dec 2, 2025. Never applied to AFH or CBRF.',
      what:'Staff ask about it often. It does not apply to you.', todo:[], check:'Verified'}
  ];

  const BEHAVIORS = [
    {id:'refuse', name:'Refusing care or a shower', first:'Is anyone at risk right now? If not, there is no rush. A refusal is a choice, not a failure.',
      try:['Step back and offer again in 15 to 30 minutes.','Let a different caregiver offer.','Give two real choices: "shower or sponge bath?", "now or after lunch?"','Make it comfortable: warm room, towel ready, explain each step.','Ask what they don\'t like about it, and write it down.'],
      avoid:['Arguing or explaining why they "have to".','Threats or bargaining with privileges.','Several staff crowding them.'],
      doc:'Log each offer, what you tried, and how they responded. Use their words in quotes.', escalate:'3 refusals in 7 days, a skin or health concern, or the family is upset: ask for a plan review.'},
    {id:'home', name:'Wants to go home or tries to leave', first:'Are they in danger of leaving unsafely? Stay with them and keep calm. If they are already gone: Night help, Missing resident.',
      try:['Listen for the feeling: "You miss home. Tell me about it."','Walk with them instead of blocking the door.','Offer something to do together: coffee, folding towels, a walk inside.','Check basic needs: hungry, tired, needs the bathroom, in pain?','Note the time. Late afternoon is common.'],
      avoid:['Correcting them ("you live here now").','Promising things that aren\'t true.','Physically holding them unless there is immediate danger.'],
      doc:'Time, what they said, what helped, how long it lasted.', escalate:'New behavior, or several tries a day: tell the manager so the plan can change.'},
    {id:'agitate', name:'Agitated or upset in the evening', first:'Check for pain, hunger, thirst, the bathroom, noise and light.',
      try:['Lower noise and turn on more light before dusk.','Use a calm, slow voice and simple words.','Offer a familiar task or music they like.','Give them space while staying in sight.'],
      avoid:['Too many questions at once.','Rushing personal care at this time.'],
      doc:'Time it started, what was going on, what helped.', escalate:'Sudden change in behavior can be an infection or a med reaction. Tell the nurse.'},
    {id:'repeat', name:'Asks the same question again and again', first:'This is the memory, not a choice. Your patience is the care.',
      try:['Answer briefly and kindly each time.','Write the answer on a card they can keep.','Gently switch to a related topic or task.'],
      avoid:['"I already told you."','Testing their memory.'],
      doc:'Only if it is new or getting worse.', escalate:'If it is new, tell the nurse. It can be a change of condition.'},
    {id:'aggress', name:'Yells, hits or grabs', first:'Step back and keep yourself and others safe. Call for help if anyone is hurt. In danger: 911.',
      try:['Give space. Stand to the side, not in front.','Use their name and a calm, low voice.','Stop the task. Come back later.','Look for the trigger: pain, being rushed, too many people.'],
      avoid:['Restraining them.','Raising your voice.','Taking it personally or writing it as an accusation.'],
      doc:'Facts only: what happened just before, what they did, what you did, any injuries. Use Write a report.', escalate:'Any injury, or it repeats: manager the same day. A pattern needs a plan change.'},
    {id:'medrefuse', name:'Refuses medication', first:'They have a right to refuse unless a court ordered otherwise.',
      try:['Offer again later if the order allows.','Ask why and listen. Taste, pill size, side effects?','Let another trusted caregiver offer.'],
      avoid:['Hiding meds in food unless the plan and order say so.','Pressuring them.'],
      doc:'Record "refused" with the time and reason. Tell the manager.', escalate:'CBRF: 2 refusals in a row go to the prescriber. Any important med: call the nurse.'}
  ];

  // Night triage. level: now (911), wake (call manager now), nurse (call on-call nurse), morning (log for manager)
  const TRIAGE = [
    {id:'fall-hurt', name:'Fall with injury, head hit or can\'t get up', level:'now', steps:['Call 911. Do not lift.','Keep them still and warm.','Call the manager after 911.'], who:'911, then manager', clock:'CBRF: DQA within 3 working days if ER care.'},
    {id:'missing', name:'Resident missing', level:'now', steps:['Quick search of rooms, yard and cars.','Call the police with a description.','Call the manager now.'], who:'Police, then manager', clock:'CBRF: DQA within 3 working days.'},
    {id:'breath', name:'Trouble breathing, chest pain, not responding', level:'now', steps:['Call 911.','Check the code status sheet.','Follow the dispatcher.'], who:'911', clock:''},
    {id:'fall-ok', name:'Fall, no injury, up and comfortable', level:'morning', steps:['Check for injury before moving.','Help up per your lift procedure.','Check on them every hour tonight.','Write it up before end of shift.'], who:'Manager in the morning', clock:''},
    {id:'med-q', name:'Question about a med (missed, refused, unsure)', level:'nurse', steps:['Do not guess.','Text or call the on-call nurse.','Record what they said.'], who:'On-call nurse', clock:'CBRF: 2 refusals in a row go to the prescriber.'},
    {id:'med-err', name:'Med error', level:'nurse', steps:['Check the resident.','Call the nurse or pharmacist now.','Write facts only.'], who:'Nurse now, manager in the morning', clock:''},
    {id:'sick', name:'Seems sick or different (fever, new confusion, vomiting)', level:'nurse', steps:['Take vitals if trained.','Call the on-call nurse with what you see.','If it gets worse: 911.'], who:'On-call nurse', clock:''},
    {id:'behav', name:'Upset, can\'t sleep, wandering inside', level:'morning', steps:['Open Behavior help.','Keep them and others safe.','Log what helped.'], who:'Manager in the morning', clock:''},
    {id:'callin', name:'Next shift called in sick', level:'wake', steps:['Check the call-in list first.','If no one can cover by 5 AM, call the manager.'], who:'Call-in list, then manager', clock:''},
    {id:'building', name:'Power, heat, water or alarm problem', level:'wake', steps:['Fire or smoke: evacuate and call 911.','Otherwise follow the building sheet.','No heat or water for over an hour: call the manager.'], who:'Manager if not fixed in 1 hour', clock:'Fire: DQA within 3 working days.'},
    {id:'family', name:'Family member calls at night', level:'morning', steps:['Be kind and brief.','Share only what the release list allows.','Take a message for the manager.'], who:'Manager in the morning', clock:''},
    {id:'staff', name:'Problem with a coworker', level:'morning', steps:['If a resident is at risk: tell the manager now.','Otherwise write what happened, facts only.','It goes to the manager privately, not the whole team.'], who:'Manager, privately', clock:'Suspected abuse: protect residents now, DQA within 7 days.'}
  ];

  const GRAY = [
    {id:'C04', title:'PRN med when the order needs judgment', options:['Call the nurse before every PRN that needs judgment','Write clear criteria with the prescriber so staff can follow them','Only certain trained staff give that PRN'],
      sides:'For: residents get relief faster with clear criteria (DHS 83.37(1)(i) wants a written reason and target behavior). Against: unlicensed staff making clinical judgments (N 6).'},
    {id:'C05', title:'Repeated shower refusals', options:['Keep offering and document each time','Change the plan with the resident and family','Try a different caregiver or time'],
      sides:'For choice: resident rights (DHS 83.32, 88.07(1)). For pushing: hygiene and skin health. The middle: offer, document, update the plan.'},
    {id:'C06', title:'Lift or call 911 after a fall', options:['Always call 911 (no-lift policy)','Lift with equipment when no injury signs','Call the on-call nurse to decide'],
      sides:'No Wisconsin rule found either way. Fire departments may charge lift-assist fees. Injury signs always mean 911.'},
    {id:'C15', title:'Paid or unpaid overnight sleep time', options:['Pay all overnight hours','Unpaid sleep only on 24-hour shifts with 5 hours of sleep','Ask an employment lawyer first'],
      sides:'Federal FLSA allows unpaid sleep only on 24-hour-plus shifts. Wisconsin rules not confirmed. Route to owner and payroll.'},
    {id:'C16', title:'Family wants to change the DNR', options:['Follow the current signed form until a new one is signed','Call the manager and nurse before any change','Ask the guardian or POA to provide paperwork'],
      sides:'Wis. Stat. ch. 154 and POLST acceptance need legal confirmation. Never change code status on a phone call.'},
    {id:'C17', title:'What can I tell the family?', options:['Only what the release list allows','Refer every question to the manager','General "doing well today" only'],
      sides:'Small homes may not be HIPAA covered entities, but Wisconsin confidentiality rules (s. 146.82) still apply.'}
  ];

  const ASK_TOPICS = [
    {id:'C04', to:'DQA licensing specialist', subject:'PRN orders that need staff judgment', body:'Can unlicensed AFH or CBRF staff give a PRN medication when the order\'s criteria need judgment (for example, "for anxiety")? We are reading DHS 83.37(1)(i), DHS 88.07(3)(d) and N 6.03(3). What written criteria would you expect to see?'},
    {id:'C10', to:'Care manager (MCO)', subject:'Member incident reporting timelines', body:'What member-incident timelines does your contract set for providers, and how do they line up with DHS 13.05 and the federal HCBS incident system due July 9, 2027?'},
    {id:'C14', to:'DQA licensing specialist', subject:'TB screening for new staff', body:'Is a TB skin or blood test still required for new staff under DHS 83.17(2)(a) and DHS 88.04(2)(g)1, or is a symptom screen enough?'},
    {id:'C15', to:'Employment attorney', subject:'Overnight sleep time pay', body:'Do Wisconsin wage rules (DWD 274) allow unpaid sleep time for overnight staff in an adult family home or CBRF? Do any CBRF classes require awake overnight staff?'},
    {id:'C16', to:'Health law attorney', subject:'DNR and POLST forms', body:'How do Wisconsin\'s out-of-hospital DNR rules (Wis. Stat. ch. 154) treat POLST-style forms in adult family homes and CBRFs?'},
    {id:'C06', to:'Local fire department', subject:'Lift-assist calls', body:'What is your policy and any fee for lift-assist calls from an adult family home when a resident has fallen with no injury?'}
  ];

  // Casual-to-professional wording swaps. Templated, no AI service.
  const WORDING = [
    [/\bfreak(ed|ing)? out\b/gi,'became visibly upset'],
    [/\bflipped out\b/gi,'became visibly upset'],
    [/\blost it\b/gi,'became upset'],
    [/\bwent crazy\b/gi,'became agitated'],
    [/\bcrazy\b/gi,'agitated'],
    [/\bscreamed at\b/gi,'raised their voice at'],
    [/\byelled at\b/gi,'raised their voice at'],
    [/\battacked\b/gi,'made physical contact with (describe how)'],
    [/\bhit\b/gi,'struck (describe how)'],
    [/\bpunched\b/gi,'struck with a closed hand'],
    [/\bmean\b/gi,'unkind (describe what was said)'],
    [/\brude\b/gi,'(describe the words or actions)'],
    [/\bstubborn\b/gi,'declined'],
    [/\bwouldn't\b/gi,'declined to'],
    [/\brefused to\b/gi,'declined to'],
    [/\bpeed\b/gi,'was incontinent of urine'],
    [/\bpooped\b/gi,'was incontinent of stool'],
    [/\bwet (himself|herself|themself|the bed)\b/gi,'was incontinent of urine'],
    [/\bmeds\b/gi,'medications'],
    [/\bmed\b/gi,'medication'],
    [/\bdidn't eat\b/gi,'did not eat'],
    [/\bkinda\b/gi,'somewhat'],
    [/\bgonna\b/gi,'going to'],
    [/\bwanna\b/gi,'want to'],
    [/\bgotta\b/gi,'need to'],
    [/\bcuz\b/gi,'because'],
    [/\bpt\b/gi,'resident'],
    [/\bres\b/gi,'resident'],
    [/\bw\/\b/gi,'with'],
    [/\bdon't\b/gi,'do not'],
    [/\bcan't\b/gi,'cannot'],
    [/\bwasn't\b/gi,'was not'],
    [/\bisn't\b/gi,'is not']
  ];
  const FLAGS = [
    {re:/\b(lazy|careless|useless|incompetent|stupid|idiot|always|never|on purpose|didn't bother|doesn't care|as usual)\b/gi, why:'Blame or judgment. Describe what you saw instead.'},
    {re:/\b(i think|i feel like|probably|obviously|must have|i bet|seemed like (s?he|they) wanted)\b/gi, why:'Guess or opinion. Reports state what was seen and heard.'},
    {re:/\b(abuse|abused|neglect|neglected|stole|stolen|slapped|pushed|shoved|bruise|bruises)\b/gi, why:'Possible mandatory report. Protect the resident and tell your designated reporter now.', report:true}
  ];

  const ROUTES = [
    {re:/\b(fall|fell|on the floor|found down)\b/i, type:'Fall', to:['Manager (same shift)','Family or guardian (per plan)'], cbrf:'DQA within 3 working days if ER or hospital care (DHS 83.12(4)(c))'},
    {re:/\b(missed dose|wrong dose|med error|medication error|(refused|declined)\b.{0,25}\bmedications?)\b/i, type:'Medication', to:['Nurse or pharmacist (now if an error)','Manager'], cbrf:'2 refusals in a row: prescriber (DHS 83.37(1)(k))'},
    {re:/\b(missing|left the building|eloped|couldn't find|could not find)\b/i, type:'Missing resident', to:['Police (immediately)','Manager (now)'], cbrf:'DQA within 3 working days (DHS 83.12(4)(a))'},
    {re:/\b(police|officer|sheriff)\b/i, type:'Police called', to:['Manager'], cbrf:'DQA within 3 working days (DHS 83.12(4)(b))'},
    {re:/\b(abuse|abused|neglect|neglected|stole|stolen|slapped|pushed|shoved)\b/i, type:'Possible misconduct', to:['Protect residents now','Designated reporter (today)'], cbrf:'DQA Misconduct Reporting System within 7 calendar days (DHS 13.05)', afh:'DQA Misconduct Reporting System within 7 calendar days (DHS 13.05)'},
    {re:/\b(struck|hit|grabbed|kicked|bit|scratched)\b/i, type:'Behavior with contact', to:['Manager (same day)','Nurse if any injury'], cbrf:'If injury needs ER care: DQA within 3 working days'},
    {re:/\b(fire|smoke)\b/i, type:'Fire', to:['911','Manager'], cbrf:'DQA within 3 working days, form F-62500 (DHS 83.12(4)(e))'}
  ];

  // Seed records so every screen has something in it on first open.
  const SEED = {
    questions:[
      {q:'Can I set up meds in a cup or envelope for later?', id:'C02', site:'maple', tier:'caregiver', at:'2026-11-24T02:10:00', shift:'Night'},
      {q:'How many training hours do I need?', id:'C12', site:'maple', tier:'caregiver', at:'2026-11-23T15:40:00', shift:'Day'},
      {q:'A resident keeps refusing showers. Is it neglect if I don\'t push?', id:'C05', site:'maple', tier:'caregiver', at:'2026-11-22T13:05:00', shift:'Day'},
      {q:'Can an aide decide when to give a PRN (as-needed) med?', id:'C04', site:'birch', tier:'caregiver', at:'2026-11-25T22:30:00', shift:'Evening'},
      {q:'Can I set up meds in a cup or envelope for later?', id:'C02', site:'birch', tier:'caregiver', at:'2026-11-21T06:15:00', shift:'Night'},
      {q:'Resident fell. Do I lift them or call 911?', id:'C06', site:'birch', tier:'caregiver', at:'2026-11-20T03:20:00', shift:'Night'},
      {q:'A resident keeps refusing showers. Is it neglect if I don\'t push?', id:'C05', site:'cedar', tier:'caregiver', at:'2026-11-19T10:00:00', shift:'Day'}
    ],
    triage:[
      {id:'fall-ok', site:'maple', at:'2026-11-26T02:40:00', note:'Resident M-1 sat down on the floor by the bed, no injury, helped up with gait belt. Checked hourly.', woke:false},
      {id:'med-q', site:'maple', at:'2026-11-26T05:10:00', note:'M-3 morning insulin question, texted on-call nurse, answered in 8 minutes.', woke:false},
      {id:'behav', site:'birch', at:'2026-11-26T01:15:00', note:'B-5 awake and walking halls 1 to 2 AM, warm milk and music helped.', woke:false}
    ],
    reports:[
      {id:'r1', site:'maple', at:'2026-11-25T19:30:00', type:'Behavior with contact', status:'Waiting for manager', resident:'M-2', raw:'Walt freaked out at supper and hit Sam cuz he wanted to go home again', clean:'', by:'Caregiver (sample)'}
    ],
    signals:[
      {id:'s1', type:'rating', area:'check', ref:'C02', label:'Can I set up meds in a cup or envelope for later?', val:'up', team:'Yes', note:'', site:'maple', tier:'caregiver', at:'2026-11-24T02:15:00', status:'New'},
      {id:'s2', type:'rating', area:'check', ref:'C06', label:'Resident fell. Do I lift them or call 911?', val:'down', team:'No', note:'We call the on-call nurse first when there is no injury. Add that option.', site:'birch', tier:'caregiver', at:'2026-11-20T03:30:00', status:'New'},
      {id:'s3', type:'rating', area:'behavior', ref:'home', label:'Wants to go home or tries to leave', val:'up', team:'Yes', note:'Walking with them works better than the door alarm.', site:'maple', tier:'caregiver', at:'2026-11-23T17:10:00', status:'New'},
      {id:'s4', type:'edit', area:'report', ref:'Fall', label:'Report rewrite (Fall)', added:'sat herself down slowly, no injury seen', removed:'was found on the floor', site:'maple', tier:'caregiver', at:'2026-11-22T06:05:00', status:'New'},
      {id:'s5', type:'dropoff', area:'night', ref:'callin', label:'Opened "Next shift called in sick" but did not log it', site:'birch', tier:'caregiver', at:'2026-11-25T04:40:00', status:'New'},
      {id:'s6', type:'pulse', area:'pulse', ref:'2026-10', val:'4', note:'Night help saved me a call.', label:'How much did the app help on your last shift?', site:'maple', tier:'caregiver', at:'2026-10-30T08:00:00', status:'Reviewed'}
    ],
    decisions:[
      {id:'d1', site:'maple', gray:'C05', choice:'Change the plan with the resident and family', why:'M-4 prefers afternoon showers. Plan updated to after lunch with a sponge bath option.', approver:'House manager', at:'2026-11-18T14:00:00'}
    ],
    asks:[
      {id:'a1', topic:'C14', to:'DQA licensing specialist', status:'Answered', at:'2026-11-10T09:00:00', answer:'(Sample answer) Follow the screening method in your written policy and document it. Shared anonymously with all subscribers.'}
    ],
    confusions:[
      {rule:'C02', text:'Last job let us pre-pour for the night shift.', from:'Another facility', site:'maple', at:'2026-11-24T02:12:00'},
      {rule:'C04', text:'Nurse said one thing, manager said another about PRN.', from:'Nurse', site:'birch', at:'2026-11-25T22:33:00'}
    ],
    staff:{
      maple:[{n:'Caregiver A',hours:6,need:15,bg:'2023-02-10',status:'New, within 6 months'},{n:'Caregiver B',hours:8,need:8,bg:'2022-12-01',status:'On track'},{n:'Caregiver C',hours:3,need:8,bg:'2024-05-14',status:'Behind'},{n:'Caregiver D',hours:9,need:8,bg:'2025-01-20',status:'On track'},{n:'Caregiver E',hours:8,need:8,bg:'2021-03-05',status:'Recheck due'},{n:'Manager',hours:12,need:8,bg:'2024-09-09',status:'On track'}],
      birch:[{n:'Caregiver F',hours:15,need:15,bg:'2024-01-10',status:'On track'},{n:'Caregiver G',hours:9,need:15,bg:'2023-07-19',status:'Behind'},{n:'Caregiver H',hours:4,need:15,bg:'2025-06-02',status:'New, 90-day topics due'}],
      cedar:[{n:'Caregiver J',hours:8,need:8,bg:'2024-04-04',status:'On track'},{n:'Caregiver K',hours:5,need:8,bg:'2023-10-10',status:'Behind'}],
      family:[{n:'You',hours:4,need:0,bg:'',status:'Tasks signed off'},{n:'Weekend helper',hours:1,need:0,bg:'',status:'Needs hand-off packet'}]
    },
    delegations:[
      {site:'maple', task:'Insulin pen', res:'M-3', cg:'Caregiver B', checked:'2026-01-12', review:'2027-01-12', status:'Active'},
      {site:'maple', task:'Insulin pen', res:'M-3', cg:'Caregiver C', checked:'2025-12-05', review:'2026-12-05', status:'Expiring'},
      {site:'birch', task:'Nebulizer', res:'B-2', cg:'Caregiver F', checked:'2026-06-01', review:'2027-06-01', status:'Active'},
      {site:'birch', task:'Nebulizer', res:'B-2', cg:'Caregiver G', checked:'2025-11-20', review:'2026-11-20', status:'Expired'},
      {site:'family', task:'Blood sugar check', res:'Mom', cg:'You', checked:'2026-08-15', review:'2027-08-15', status:'Active'}
    ]
  };

  return {CHECKED, SETTINGS, SITES, RESIDENTS, TIERS, RULES, SURVEY, WATCH, BEHAVIORS, TRIAGE, GRAY, ASK_TOPICS, WORDING, FLAGS, ROUTES, SEED};
})();
