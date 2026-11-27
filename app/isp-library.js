// Steady Shift test app: content for Individual Service Plans (isp.js).
// Rule timelines for DHS 88 (AFH) and DHS 83 (CBRF), plan sections, the guided walkthrough text,
// and a suggestion library built from public, industry-standard plan formats and evidence-based practice.
// Every person here is fictional. Not legal advice.
window.SS_ISP_LIB = (function(){

  // ---------- where suggestions come from (shown on every suggestion) ----------
  const SRC = {
    hcbs:   {label:'Federal HCBS person-centered planning rule (42 CFR 441.301(c))', kind:'rule'},
    hcbsmod:{label:'Federal HCBS settings rule: limits on rights need 8 documented steps (42 CFR 441.301(c)(4)(vi)(F))', kind:'rule'},
    mcp:    {label:'Wisconsin Family Care member-centered plan format (public): outcomes in the person\'s words, supports, who provides them', kind:'format'},
    iris:   {label:'Wisconsin IRIS self-directed plan format (public): long-term care outcomes and the person\'s choices', kind:'format'},
    rights: {label:'Wisconsin resident rights (Wis. Stat. 50.09 and the DHS 83 / DHS 88 rights sections)', kind:'rule'},
    steadi: {label:'CDC STEADI fall prevention (screen, assess, intervene)', kind:'evidence'},
    iddsi:  {label:'IDDSI food and drink texture framework', kind:'evidence'},
    npiap:  {label:'NPIAP pressure injury prevention guideline', kind:'evidence'},
    alz:    {label:'Alzheimer\'s Association Dementia Care Practice Recommendations', kind:'evidence'},
    pbs:    {label:'Positive behavior support (person-centered, least restrictive first)', kind:'evidence'},
    ada:    {label:'American Diabetes Association care in long-term care settings', kind:'evidence'},
    oral:   {label:'Oral health in long-term care (daily mouth and denture care)', kind:'evidence'},
    cms:    {label:'CMS Hand in Hand dementia care training (public)', kind:'evidence'},
    nami:   {label:'Recovery-oriented mental health practice (SAMHSA working definition of recovery)', kind:'evidence'},
    evac:   {label:'DHS 83.35(5) / DHS 88 evacuation ability and the home\'s fire plan', kind:'rule'},
    meds:   {label:'Home\'s medication policy and the prescriber\'s orders', kind:'rule'},
    copd:   {label:'GOLD COPD self-management (breathing, inhaler or nebulizer routine, early warning signs)', kind:'evidence'}
  };

  // ---------- plan sections ----------
  // Each section: what it is, what good looks like, legal must-haves, common mistakes (the guided walkthrough).
  const SECTIONS = [
    {id:'about', t:'About me and what matters to me', ic:'🌱',
      what:'Who the person is in their own words: history, routines, likes, faith, how they like to be spoken to, and what a good day looks like. This is the part staff read first.',
      good:'"I\'m a farmer\'s wife. I like coffee at 7, black, and the radio on." Written so a new caregiver could make the person comfortable on their first shift.',
      must:['For Medicaid home and community-based services, the plan is person-centered and reflects what is important to the person (42 CFR 441.301(c)(1)-(2)).','The resident takes part in a way that fits their understanding (DHS 88.06(3)(b); DHS 83.35(3)(b)).'],
      mistakes:['Only listing diagnoses here.','Writing about the person instead of with them ("Resident is pleasantly confused").','Copying last year\'s plan without asking what changed.']},
    {id:'assess', t:'Assessment summary', ic:'🔎',
      what:'What the assessment found: needs, abilities, risks and strengths, with the date and who did it. Each goal later in the plan should trace back to something here.',
      good:'"Assessed 11/2 by house manager with the RN. Walks with a walker, needs stand-by help in the shower, independent with eating, forgets evening meds without a cue."',
      must:['AFH: a written assessment within 30 days after placement covering ADLs, medications, health, supervision, vocational, recreational, social and transportation needs (DHS 88.06(3)(a), (c)).','CBRF: an assessment before admission with a written report (DHS 83.35(1)), a temporary service plan upon admission (83.35(2)), then the ISP based on the assessment (83.35(3)(a)).'],
      mistakes:['Assessment date missing.','Needs in the assessment that never show up as a goal or support.','Using a generic checklist without the person\'s actual abilities.']},
    {id:'goals', t:'Goals, supports and who does what', ic:'🎯',
      what:'For each need: the outcome the person wants, the supports and staff steps, how often, who does it, and how you will know it is working.',
      good:'Goal: "I want to walk to the dining room on my own." Supports: walker within reach, night light, non-slip socks, PT exercises 3 times a week. Measure: falls per month, walks to meals.',
      must:['AFH: services the home provides, level of supervision in the home and community, services from outside agencies, and who monitors the plan (DHS 88.06(3)(d)).','CBRF: needs and desired outcomes, services with frequency and approach, measurable goals with time limits, and who gives the care (DHS 83.35(3)(a)).','Health care and medication services match the current orders.'],
      mistakes:['Goals that are staff tasks ("Staff will shower resident") instead of outcomes.','No frequency or no "who".','Medication details that don\'t match the current orders.']},
    {id:'risks', t:'Risks and choices', ic:'⚖️',
      what:'Known risks (falls, choking, leaving unsafely, skin, refusing care) and the plan for each. When the person chooses something risky, the talk about it and the agreed plan go here too (dignity of risk).',
      good:'"Ruth wants to walk without the walker inside her room. We talked about the risk on 11/2; she chose to, with a clear path and a call light. Reviewed monthly."',
      must:['Risks found in the assessment are addressed.','Any limit on a right (locked items, schedules, visitors, money) follows the 8 required steps and has consent (42 CFR 441.301(c)(4)(vi)(F); Wis. Stat. 50.09).'],
      mistakes:['Restricting a right "for safety" with no assessed need, other options tried, or time limit.','Writing "non-compliant" instead of what the person chose and why.','Leaving out the evacuation plan.']},
    {id:'rights', t:'Rights, choices and restrictions', ic:'🗝️',
      what:'Any modification of the person\'s rights or the home\'s usual setting, with the 8 required steps. Most plans have none, and that is good.',
      good:'"None. Hank keeps his own key and snacks and sets his own bedtime."',
      must:['Specific assessed need; positive supports tried first; less intrusive methods tried; a description that fits the need; data collection; a review date; informed consent; assurance it causes no harm (42 CFR 441.301(c)(4)(vi)(F)).'],
      mistakes:['House rules written into one person\'s plan.','No end or review date.','Consent from staff instead of the resident or guardian.']},
    {id:'team', t:'Who took part and signatures', ic:'✍️',
      what:'Who helped write the plan, how they took part, and who signed. Include the resident, guardian or POA, the placing agency\'s case manager, the nurse, and family the resident wants.',
      good:'"Ruth (in person, signed), daughter as POA for health care (phone, signed by e-sign 11/4), care manager (video), RN (reviewed meds)."',
      must:['AFH: everyone who helped develop the plan signs and dates a statement of agreement, and each gets a copy (DHS 88.06(3)(d)5, (e)).','CBRF: the resident or legal representative signs at writing and at each review; the case manager and health care providers are invited (DHS 83.35(3)(b), (d)).','The resident takes part in a way that fits their understanding (DHS 88.06(3)(b)).'],
      mistakes:['Only the manager signs.','Guardian not invited because "they never come".','No note when someone declines to sign.']},
    {id:'review', t:'Review schedule', ic:'🔁',
      what:'When the plan is reviewed: on a set schedule and any time needs change (a fall, a hospital stay, new orders, a new behavior).',
      good:'"Next full review May 2. Also reviewed after any hospital stay or 2 falls in 30 days."',
      must:['AFH: at least every 6 months, and a written update when needs or preferences change a lot or the resident or guardian asks (DHS 88.06(3)(f)).','CBRF: at least yearly and when needs, abilities or condition change; document the changes (DHS 83.35(3)(d), (e)).'],
      mistakes:['Waiting for the yearly date after a big change.','Updating the plan but not telling staff (the staff summary fixes this).']}
  ];

  // ---------- rules and timelines per setting ----------
  // check:true means the code text still needs to be confirmed against the official copy.
  const REQ = {
    afh: {name:'Adult family home (DHS 88)', items:[
      {k:'assess', t:'Written assessment of needs and abilities (ADLs, medications, health, supervision in the home and community, vocational, recreational, social, transportation)', when:'Within 30 days after placement', days:30, cite:'DHS 88.06(3)(a), (c)'},
      {k:'isp', t:'Individual service plan: services the home provides, level of supervision, services from outside agencies, who monitors the plan', when:'Within 30 days after placement', days:30, cite:'DHS 88.06(3)(a), (d)'},
      {k:'part', t:'Developed with the resident (in a way that fits their understanding), guardian, designated representative, placing agency and service coordinator when there are ones', when:'When the plan is written and reviewed', cite:'DHS 88.06(3)(b)'},
      {k:'sign', t:'Statement of agreement, signed and dated by everyone who helped develop the plan', when:'When the plan is written', cite:'DHS 88.06(3)(d)5'},
      {k:'copy', t:'Copy given to everyone who helped develop the plan', when:'When finished and after each update', cite:'DHS 88.06(3)(e)'},
      {k:'review', t:'Reviewed with the resident and the same people', when:'At least every 6 months, and updated in writing when needs or preferences change a lot or the resident or guardian asks', months:6, cite:'DHS 88.06(3)(f)'}
    ]},
    cbrf: {name:'Community-based residential facility (DHS 83)', items:[
      {k:'pre', t:'Assessment, with a written report kept in the record', when:'Before admission', days:0, cite:'DHS 83.35(1)'},
      {k:'temp', t:'Temporary service plan for immediate needs', when:'Upon admission', days:0, cite:'DHS 83.35(2)'},
      {k:'evac', t:'Evacuation ability evaluated', when:'Within 3 days of admission', days:3, cite:'DHS 83.35(5)(a)'},
      {k:'isp', t:'Individual service plan: needs and desired outcomes, services with frequency and approach, measurable goals with time limits, how care is given and who gives it', when:'Within 30 days after admission', days:30, cite:'DHS 83.35(3)(a)'},
      {k:'medrev', t:'Medication regimen review', when:'Within 30 days of admission and after a significant change', days:30, cite:'DHS 83.37(1)(e)'},
      {k:'part', t:'Resident and legal representative involved; case manager and health care providers invited; hospice or home health coordinates for a terminal prognosis', when:'When the plan is written and reviewed', cite:'DHS 83.35(3)(b)'},
      {k:'sign', t:'Resident or legal representative signs (involvement, understanding, agreement)', when:'When written and at each review', cite:'DHS 83.35(3)(b), (d)'},
      {k:'staff', t:'Every caregiver has continual access to the assessment and plan', when:'Always', cite:'DHS 83.35(3)(f)'},
      {k:'review', t:'Reviewed and revised, with input from the resident or representative, case manager and care staff; changes documented', when:'At least yearly and when needs, abilities or condition change', months:12, cite:'DHS 83.35(3)(d), (e)'}
    ]},
    home: {name:'Family caregiver at home', items:[
      {k:'isp', t:'Care plan (not required by a state rule at home; agencies and IRIS plans have their own)', when:'When care starts', days:30, cite:'Best practice'},
      {k:'review', t:'Review', when:'Every 6 months or when needs change', months:6, cite:'Best practice'}
    ]}
  };
  const CHECKED = 'Rule text read 2026-11-27 from the Wisconsin Legislature site (DHS 88.06(3)) and its preview mirror (DHS 83.35).';

  // ---------- suggestion library ----------
  // Triggered by words found in the resident's diagnoses, orders, behaviors, notes and admission intake.
  // sec: section the suggestion fills. dom: care area (shown as a chip). Everything is editable once added.
  const LIB = [
    {id:'fall', sec:'goals', dom:'Mobility and falls', on:/walker|fall|cane|unsteady|bed alarm|wheelchair|transfer/i,
      need:'Unsteady walking; risk of falls.', goal:'"I want to get around the house on my own without falling."',
      steps:['Keep the walker within reach, including at night.','Clear path, night light on, non-slip shoes or socks.','Offer the bathroom on waking, before and after meals, and at bedtime.','After any fall: check for injury, do not lift alone, follow the fall procedure, tell the nurse.'],
      measure:'Falls per month; walks to meals on their own.', src:'steadi'},
    {id:'mem', sec:'goals', dom:'Memory and thinking', on:/memory|dementia|alzheimer|confus|sundown/i,
      need:'Memory loss; may not remember routines or new people.', goal:'"I want to feel safe and know what is happening next."',
      steps:['Introduce yourself each time. Use their name and short sentences.','Keep the same daily routine; post it where they can see it.','Give one step at a time and wait for an answer.','Join their reality instead of correcting it.'],
      measure:'Calm most of the day; fewer upset episodes noted in handoff.', src:'alz'},
    {id:'home', sec:'goals', dom:'Feelings and behavior', on:/go home|exit|leave|wander|elope/i,
      need:'Asks to go home or tries to leave, often at certain times.', goal:'"I want to feel at home here."',
      steps:['Listen for the feeling ("You miss home. Tell me about it.").','Walk with them rather than blocking the door.','Offer a familiar task at the usual time (folding towels, coffee, a walk inside).','Check basic needs: hungry, tired, bathroom, pain.','Note the time and what helped in the shift handoff.'],
      measure:'Fewer exit attempts; what worked is recorded each time.', src:'pbs'},
    {id:'eve', sec:'goals', dom:'Feelings and behavior', on:/sundown|after 4 ?pm|evening (upset|agitat|restless)|agitat/i,
      need:'More upset in the late afternoon or evening.', goal:'"I want my evenings to be calm."',
      steps:['Plan a quiet activity before the usual time (music they like, a snack, a walk).','Turn lights up before dusk; cut noise and TV.','Avoid baths or appointments late in the day when possible.','Tell the nurse about new or worse evening changes (could be pain, infection or a medication effect).'],
      measure:'Evening upset noted fewer times per week.', src:'cms'},
    {id:'refuse', sec:'risks', dom:'Personal care', on:/declin|refus|shower/i,
      need:'Often declines showers or care.', goal:'"I want to choose when and how I bathe."',
      steps:['Offer two real choices (shower or sponge bath; now or after lunch).','Step back and offer again later, or let another caregiver offer.','Warm room, towel ready, explain each step.','Write down each offer and their words; 3 refusals in 7 days means a plan review.'],
      measure:'Bathing preferences written down; skin stays healthy.', src:'pbs'},
    {id:'ins', sec:'goals', dom:'Health and medications', on:/insulin|blood sugar|glucose|diabet(?!es,? diet)/i,
      need:'Diabetes managed with insulin or other medicine.', goal:'"I want to keep my blood sugar steady and feel well."',
      steps:['Blood sugar checks and insulin as ordered, by staff the nurse has delegated.','Offer meals and snacks on time; follow the diet order.','Know the signs of low sugar (shaky, sweaty, confused) and the home\'s low-sugar steps.','Daily foot check; report sores or color changes.'],
      measure:'Readings in the range the prescriber set; no lows needing help.', src:'ada'},
    {id:'dmdiet', sec:'goals', dom:'Health and medications', on:/diabetes,? diet/i,
      need:'Diabetes managed with diet.', goal:'"I want to eat foods I like and keep my blood sugar steady."',
      steps:['Follow the diet order; offer good choices, don\'t lecture.','Meals and snacks at steady times.','Tell the nurse about more thirst, more trips to the bathroom, or sores that heal slowly.'],
      measure:'Lab results the prescriber checks; weight steady.', src:'ada'},
    {id:'neb', sec:'goals', dom:'Health and medications', on:/nebuliz|copd|inhaler|oxygen|breath/i,
      need:'Breathing condition with a nebulizer or inhaler routine.', goal:'"I want to breathe easier and stay out of the hospital."',
      steps:['Breathing treatments as ordered; clean the equipment as the instructions say.','Watch for more cough, color change or breathlessness; call the nurse.','Pace activities with rests.'],
      measure:'Treatments done as ordered; no ER visits for breathing.', src:'copd'},
    {id:'prn', sec:'goals', dom:'Feelings and behavior', on:/prn|anxiety|anxious/i,
      need:'Anxiety; an as-needed medicine is ordered.', goal:'"I want to feel calm and in control."',
      steps:['Try the calming steps in "What helps" first.','Give the as-needed medicine only as the order says, and only staff trained for it.','Write down what happened before, what was tried, and how it worked.'],
      measure:'As-needed doses per week; calming steps tried first each time.', src:'pbs'},
    {id:'skin', sec:'goals', dom:'Skin', on:/pressure (injur|sore|ulcer)|heels?\b|tailbone|wound|skin (check|breakdown|tear)|redness/i,
      need:'Risk of skin breakdown.', goal:'"I want my skin to stay healthy and comfortable."',
      steps:['Check heels and tailbone as ordered; report redness that does not fade.','Help change position regularly if they can\'t on their own.','Keep skin clean and dry; offer fluids.'],
      measure:'No new skin injuries.', src:'npiap'},
    {id:'diet', sec:'goals', dom:'Eating and drinking', on:/thick|texture|swallow|dysphagia|iddsi|pureed|choking|bite-sized/i,
      need:'Needs a changed food texture or thickened drinks.', goal:'"I want to enjoy my meals safely."',
      steps:['Serve the texture and drink thickness the order says (IDDSI level on the meal plan).','Sit upright for meals and 30 minutes after.','Watch for coughing or a wet voice while eating; tell the nurse.'],
      measure:'No choking events; weight steady.', src:'iddsi'},
    {id:'dent', sec:'goals', dom:'Personal care', on:/denture|dental|teeth|mouth/i,
      need:'Daily mouth and denture care.', goal:'"I want my mouth to feel clean and my dentures to fit."',
      steps:['Brush gums and teeth twice a day; soak dentures overnight.','Report sore spots or loose dentures.','Keep dental appointments.'],
      measure:'Mouth care done daily; dental visits kept.', src:'oral'},
    {id:'mh', sec:'goals', dom:'Mental health and recovery', on:/depress|bipolar|schizo|mental|psych/i,
      need:'Lives with a mental health condition.', goal:'"I want to do things I enjoy and keep my routines."',
      steps:['Support the routines that keep them well (sleep, meals, activities they chose).','Keep appointments with their mental health team.','Notice and tell the nurse about changes in sleep, mood or eating.','Talk with them, not about them; don\'t share what they tell you in confidence beyond the care team.'],
      measure:'Keeps chosen routines; appointments kept.', src:'nami'},
    // person-centered sections, suggested for everyone
    {id:'about', sec:'about', dom:'What matters', always:true,
      need:'', goal:'Ask: "What makes a good day for you? What should staff always know about you?"',
      steps:['Daily routine they want (wake, meals, bedtime).','How they like to be addressed.','Faith, culture, hobbies, people who matter.','What upsets them and what helps.'],
      measure:'', src:'mcp'},
    {id:'comm', sec:'goals', dom:'Community and choices', always:true,
      need:'Wants to stay connected to people and places that matter.', goal:'"I want to see my family and get out in the community."',
      steps:['Ask what outings, visits and activities they want each week.','Help with calls and visits on their schedule.','Support choices about money, food, room and schedule.'],
      measure:'Outings and visits they chose happen.', src:'hcbs'},
    {id:'evac', sec:'risks', dom:'Safety', always:true,
      need:'Fire and emergency evacuation.', goal:'"I want to know how to get out safely in an emergency."',
      steps:['Write their evacuation ability (on their own, with help, or needs full help) and who helps.','Practice in drills; note what works.'],
      measure:'Drill results recorded.', src:'evac'},
    {id:'norestr', sec:'rights', dom:'Rights', always:true,
      need:'', goal:'"None. [Name] has the same rights and choices as anyone in the home."',
      steps:['If a limit is ever needed, use the 8-step restriction section and get consent before it starts.'], measure:'', src:'hcbsmod'}
  ];

  // ---------- fictional resident details used to pre-fill plans ----------
  const PEOPLE = {
    'maple/M-1':{admit:'2025-03-10', dx:['Osteoarthritis of the knees','High blood pressure'], likes:['Coffee at 7, black','Radio polka on Saturday mornings','Talking about her garden'], helps:['Let her set the pace when walking','Give her time to answer'], faith:'Lutheran; likes the Sunday service on TV', comm:'Hard of hearing on the left. Sit on her right.', decides:'Herself, with her son as POA for health care if she can\'t', code:'Full code', evac:'With help (stand-by and her walker)'},
    'maple/M-2':{admit:'2024-08-19', dx:['Alzheimer\'s disease, middle stage','Swallowing changes (texture modified diet)'], likes:['Talking about the farm','Folding towels','Old western movies'], helps:['Walk with him toward the window and talk about the farm when he wants to go home','Coffee and a snack at 3:30'], faith:'Catholic', comm:'Short sentences. One step at a time.', decides:'Guardian (court-appointed, sample)', code:'DNR (paper on file)', evac:'Needs full help'},
    'maple/M-3':{admit:'2025-11-02', dx:['Type 2 diabetes on insulin','Mild memory loss'], likes:['Crossword puzzles','Phone call with her sister on Sundays'], helps:['Remind her gently about evening snack'], faith:'', comm:'Clear', decides:'Herself', code:'Full code', evac:'On her own with a reminder'},
    'maple/M-4':{admit:'2023-06-01', dx:['Parkinson\'s disease','Depression'], likes:['Showers after lunch, not in the morning','Baseball on the radio'], helps:['Ask, don\'t tell','Offer a choice of two times'], faith:'', comm:'Speaks softly; lean in and wait.', decides:'Himself', code:'Full code', evac:'With help (stand-by)'},
    'birch/B-2':{admit:'2025-01-12', dx:['COPD'], likes:['Card games','Sitting by the window'], helps:['Rest breaks between activities'], faith:'Methodist', comm:'Clear', decides:'Herself', code:'Full code', evac:'With help (wheelchair for distance)'},
    'birch/B-5':{admit:'2024-10-04', dx:['Vascular dementia'], likes:['Walking outside','Woodworking magazines'], helps:['A walk outside with staff at 2:30 before shift change'], faith:'', comm:'Likes to be called by his last name with Mr.', decides:'POA for health care (daughter, sample)', code:'Full code', evac:'Needs cues and an escort'},
    'birch/B-7':{admit:'2025-05-20', dx:['Generalized anxiety','High blood pressure'], likes:['Knitting','Gospel music'], helps:['Breathing together slowly','Her blanket from home'], faith:'Baptist', comm:'Clear', decides:'Herself', code:'Full code', evac:'On her own'},
    'birch/B-9':{admit:'2025-11-14', dx:['Heart failure','History of falls'], likes:['Breakfast in his room','News at 6'], helps:['Bed alarm on at night (he agreed)','Call light within reach'], faith:'', comm:'Clear', decides:'Himself', code:'DNR (paper on file)', evac:'Needs full help'},
    'cedar/C-1':{admit:'2022-02-01', dx:['High blood pressure'], likes:['Library trips','Cooking with staff'], helps:['Independent; ask before helping'], faith:'', comm:'Clear', decides:'Herself', code:'Full code', evac:'On her own'},
    'cedar/C-3':{admit:'2024-04-11', dx:['Alzheimer\'s disease, early stage','Sundowning after 4 PM'], likes:['Gardening','Polka music'], helps:['Music and a snack at 3:30','Lights on before dusk'], faith:'Catholic', comm:'Short sentences', decides:'POA for health care (son, sample)', code:'Full code', evac:'With help (cues)'}
  };

  // People who usually take part in an ISP meeting.
  const ROLES = [
    {k:'resident', t:'Resident', req:true},
    {k:'rep', t:'Guardian, POA or legal representative', req:false, note:'Required when there is one.'},
    {k:'cm', t:'Care manager or placing agency', req:false, note:'Invite when the resident has one (Family Care, IRIS, county).'},
    {k:'rn', t:'Nurse (RN)', req:false},
    {k:'mgr', t:'House manager or administrator', req:true},
    {k:'family', t:'Family or friend the resident wants', req:false}
  ];

  // New manager path: links to screens that already exist in the app.
  const PATH = [
    ['setup','Add your home\'s policies and handbook','Facility setup'],
    ['intake','Admit someone (assessment comes from the admission papers)','New resident admission'],
    ['orders','Check every order is verified by a nurse','Doctor orders'],
    ['isp','Write or review an ISP with the guide on','Care plans (ISP)'],
    ['team','Make sure staff training is up to date','Team training'],
    ['delegations','Line up RN delegation for nurse-type tasks','Delegation ledger'],
    ['behavior','Read the behavior guides before you write behavior supports','Behavior help'],
    ['survey','Run the Survey-Ready Check once a quarter','Survey-Ready Check']
  ];

  return {CHECKED, SRC, SECTIONS, REQ, LIB, PEOPLE, ROLES, PATH};
})();
