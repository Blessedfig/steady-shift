// Steady Shift "Getting started" academy: content for the three tracks.
// Shared by the test app (app/academy.js) and the free public preview (academy.html, Track 1 only).
// Every unit says what kind of source it rests on:
//   official = Wisconsin rule or DHS page, linked. guide = Steady Shift guidance, NOT state-approved training.
// Facts checked against DHS pages on 2026-11-26 (AFH and CBRF "Opening a facility" pages, revised Feb 11, 2026;
// CBRF Approved Training Programs, revised Mar 3, 2025; HCBS residential page, revised Oct 23, 2026; DQA P-01726 CY2025).
// Items marked check:true still need the code text confirmed. Not legal advice.
window.SS_ACADEMY = (function(){
  const CHECKED = '2026-11-26';
  const L = (label, url, official) => ({label, url, official: official !== false});
  const SRC = {
    afhOpen: L('DHS: Opening an adult family home', 'https://www.dhs.wisconsin.gov/regulations/afh/openingfacility.htm'),
    cbrfOpen: L('DHS: Opening a CBRF', 'https://www.dhs.wisconsin.gov/regulations/cbrf/openingfacility.htm'),
    afhRegs: L('DHS: Adult family home rules (DHS 88)', 'https://www.dhs.wisconsin.gov/regulations/afh/index.htm'),
    dhs88: L('Wis. Admin. Code ch. DHS 88', 'https://docs.legis.wisconsin.gov/code/admin_code/dhs/030/88'),
    dhs83: L('Wis. Admin. Code ch. DHS 83', 'https://docs.legis.wisconsin.gov/code/admin_code/dhs/030/83'),
    portal: L('DQA Provider Portal', 'https://www.dhs.wisconsin.gov/regulations/assisted-living/e-renewal.htm'),
    process: L('DQA licensing process (P-01854)', 'https://www.dhs.wisconsin.gov/publications/p01854.pdf'),
    cbrfTrain: L('DHS: CBRF approved training programs', 'https://www.dhs.wisconsin.gov/regulations/cbrf/training.htm'),
    registry: L('UW-Green Bay training registry (DHS designee)', 'https://www.uwgb.edu/registry/'),
    hcbs: L('DHS: HCBS Settings Rule for residential providers', 'https://www.dhs.wisconsin.gov/hcbs/residential.htm'),
    hcbsMods: L('DHS: HCBS modifications', 'https://www.dhs.wisconsin.gov/hcbs/modifications.htm'),
    mcoMap: L('DHS: Family Care MCOs by region', 'https://www.dhs.wisconsin.gov/familycare/mcos'),
    iris: L('DHS: IRIS program', 'https://www.dhs.wisconsin.gov/iris/index.htm'),
    stats: L('DQA State of Assisted Living CY2025 (P-01726)', 'https://www.dhs.wisconsin.gov/publications/p01726.pdf'),
    caregiver: L('DHS: Caregiver background checks', 'https://www.dhs.wisconsin.gov/caregiver/index.htm'),
    misconduct: L('DHS: Reporting caregiver misconduct', 'https://www.dhs.wisconsin.gov/caregiver/complaints.htm'),
    listserv: L('DQA email updates (forums and webinars)', 'https://www.dhs.wisconsin.gov/regulations/listserv-signup.htm'),
    wc: L('DWD: Who must carry workers\' compensation', 'https://dwd.wisconsin.gov/wc/employers/'),
    wiscaregiver: L('WisCaregiver Careers', 'https://wiscaregiver.com/', false),
    flsa: L('U.S. DOL: Overtime under the FLSA', 'https://www.dol.gov/agencies/whd/overtime')
  };

  // ---------------- Track 1: starting a home in Wisconsin ----------------
  const START = [
    {id:'s1', title:'AFH or CBRF? Pick the right license', mins:8, kind:'official',
      intro:'Wisconsin sorts small residential care by how many unrelated adults live there and how much nursing care they need. Choose first, because the rules, fees, building review and payer interest all follow from it.',
      points:[
        '1 to 2 bed adult family home: certified (not licensed by DQA) under DHS 82, usually by the county or an MCO.',
        '3 to 4 bed adult family home: licensed by DQA under DHS 88 and Wis. Stat. ch. 50. Up to 7 hours a week of nursing care per resident.',
        'Community-based residential facility (CBRF): 5 or more unrelated adults, licensed under DHS 83. Up to 3 hours a week of nursing care per resident, and no one who needs more than intermediate-level nursing care.',
        'Your license names who you can serve. An AFH picks an ambulatory category (ambulatory, ambulatory with conditions, non-ambulatory with conditions, or non-ambulatory in a single story) and must state it in the program statement, service agreement and floor plan.',
        'A CBRF license class sets resident mobility and evacuation ability, and building rules follow from it. Read the class definitions in DHS 83 before you design or buy a building.'
      ],
      checklist:[
        {id:'s1a', t:'Decide how many residents and which license type fits.'},
        {id:'s1b', t:'Check local zoning and municipal ordinances before you sign a lease or buy.', cite:'DHS 88.04(2)(a)'},
        {id:'s1c', t:'Confirm payers want beds like yours in that town. Managed care contracts for ambulatory-only AFHs may not be offered everywhere.', cite:'DHS AFH opening page'},
        {id:'s1d', t:'Choose the residents you will serve (ambulatory category or CBRF class) and write it down.'}
      ],
      sources:['afhOpen','cbrfOpen','dhs88','dhs83'],
      quiz:[
        {q:'A home for 4 unrelated adults is licensed under which chapter?', a:['DHS 82','DHS 88','DHS 83'], c:1, why:'3 to 4 bed AFHs are licensed by DQA under DHS 88. 1 to 2 bed homes are certified under DHS 82.'},
        {q:'What is the most a CBRF can provide in nursing care per resident?', a:['Up to 3 hours a week','Up to 7 hours a week','No limit'], c:0, why:'CBRFs provide up to 3 hours a week of nursing care per resident. AFHs allow up to 7.'}
      ]},
    {id:'s2', title:'Licensing through DQA: application, survey and fees', mins:10, kind:'official',
      intro:'Applications go through the DQA Provider Portal. Plan on months, not weeks, and keep every document in one folder.',
      steps:[
        {t:'Read the rule chapter, Wis. Stat. ch. 50 and DQA\'s licensing webcast.', cite:'P-01854'},
        {t:'Make a MyWisconsin ID and open the DQA Provider Portal.'},
        {t:'Write your program statement, model balance sheet and operating expenses. Each uploads as one file.'},
        {t:'Fill in the new provider checklist: AFH F-02108D, CBRF F-02109D (established providers use F-02108B or F-02109B).'},
        {t:'CBRF only: have a design professional prepare building and fire protection plans and finish DHS plan review before construction. Existing buildings finish plan review before licensure.', cite:'DHS CBRF opening page'},
        {t:'Submit a Background Information Disclosure (BID) and BID Appendix for each person who must be checked.'},
        {t:'If you want Medicaid waiver residents, upload the HCBS Compliance Review Request, F-02138.'},
        {t:'Answer DQA\'s revision requests. After two unsuccessful revisions, no new application is accepted for that location for a year.'},
        {t:'Sign the applicant compliance statement (attestation). DQA then schedules the initial licensing survey.'},
        {t:'A surveyor visits using the initial survey checklist (AFH F-02634A). DQA has 70 days to approve or deny, counted from a complete packet and the finished survey.'}
      ],
      points:[
        'Fees are charged every two years and are not refundable. AFH: $171. CBRF: $389 plus $50.25 per licensed bed (a 5-bed CBRF is $640.25). A 12-month probationary CBRF license costs half.',
        'Applications left incomplete for six months are closed.',
        'A license does not transfer when you buy an existing CBRF. The new owner applies.',
        'Questions: DQA Bureau of Assisted Living licensing, dhsdqaballicensing@dhs.wisconsin.gov, 608-266-8482.'
      ],
      checklist:[
        {id:'s2a', t:'MyWisconsin ID created and Provider Portal opened.'},
        {id:'s2b', t:'Program statement drafted (who you serve, services, ambulatory category or class).'},
        {id:'s2c', t:'Model balance sheet and operating expenses ready.'},
        {id:'s2d', t:'New provider checklist filled in (F-02108D or F-02109D).'},
        {id:'s2e', t:'CBRF: plan review approved before construction or licensure.'},
        {id:'s2f', t:'BID and BID Appendix sent for every covered person.'},
        {id:'s2g', t:'F-02138 uploaded if you will serve Family Care or IRIS members.'},
        {id:'s2h', t:'Compliance statement signed and survey date set.'},
        {id:'s2i', t:'Fee paid and receipt saved.'}
      ],
      sources:['afhOpen','cbrfOpen','portal','process'],
      quiz:[
        {q:'How long does DQA have to approve or deny once the packet is complete and the survey is done?', a:['30 days','70 days','6 months'], c:1, why:'70 days, counted from a complete packet and the finished initial survey.'},
        {q:'You buy a running CBRF. What happens to the seller\'s license?', a:['It moves to you','It does not transfer, so you apply','It lasts until renewal'], c:1, why:'A CBRF license does not transfer on purchase.'},
        {q:'What is the two-year license fee for a 3 to 4 bed AFH?', a:['$171','$389','$640.25'], c:0, why:'$171 every two years. $389 plus $50.25 per bed is the CBRF fee.'}
      ]},
    {id:'s3', title:'Policies, staffing and required training', mins:12, kind:'official',
      intro:'Surveyors read your written policies, then check that staff actually do them. Write them in plain words, train on them, and keep proof.',
      points:[
        'Core written policies: program statement, resident rights and grievances, admission and discharge, assessment and service plan, medication management, emergency and disaster plan with fire evacuation, abuse and neglect reporting, and house rules that meet the HCBS Settings Rule.',
        'Staffing: enough qualified staff on duty for the residents\' needs and your license. Neither rule sets one fixed ratio. Overnight staff are on duty and awake for the whole shift, the same as day staff.',
        'CBRF approved training: standard precautions, fire safety, first aid and choking, and medication administration and management must be approved by DHS and taught by DHS-approved trainers listed with the UW-Green Bay registry.',
        'CBRF: medication training before anyone gives meds, most topic training within 90 days of hire, then 15 continuing education hours a year (DHS 83.20 to 83.25).',
        'AFH: 15 hours of training within 6 months of starting, then 8 hours a year (DHS 88.04(5)). First aid and fire safety are part of it.',
        'Dementia and other condition-specific training: train on the needs of the people you serve. The exact CBRF subsection is being checked.',
        'CPR: required training is first aid and choking. Many payer contracts and insurers also ask for CPR, so check your contracts.',
        'Background checks before hire and every 4 years (Wis. Stat. 50.065, DHS 12). Report caregiver misconduct to DHS within 7 calendar days (DHS 13.05).',
        'Health screening: AFH staff within 90 days before giving care (DHS 88.04(2)(g)); CBRF communicable disease screening before resident contact (DHS 83.17(2)(a)).'
      ],
      checklist:[
        {id:'s3a', t:'Written policy set drafted and dated.'},
        {id:'s3b', t:'House rules checked against the HCBS Settings Rule (no blanket limits on food, visitors, schedules or privacy).'},
        {id:'s3c', t:'Staffing plan written, including nights.'},
        {id:'s3d', t:'CBRF: approved trainer found on the registry for the four required courses.'},
        {id:'s3e', t:'Training calendar set (AFH 15 hrs in 6 months; CBRF 90-day topics, then 15 CE a year).'},
        {id:'s3f', t:'Background check and health screening steps written into hiring.'},
        {id:'s3g', t:'Misconduct and incident reporting procedure posted for staff.'}
      ],
      sources:['cbrfTrain','registry','dhs88','dhs83','caregiver','misconduct'],
      quiz:[
        {q:'Who may teach CBRF medication administration training?', a:['Any nurse','A DHS-approved trainer','The house manager'], c:1, why:'DHS 83.20(1)(a): the four core courses must be approved by DHS and taught by approved trainers.'},
        {q:'How often must caregiver background checks be redone?', a:['Every year','Every 4 years','Only at hire'], c:1, why:'Before hire and every 4 years.'},
        {q:'How soon must caregiver misconduct be reported to DHS?', a:['Within 24 hours','Within 7 calendar days','At the next survey'], c:1, why:'DHS 13.05 sets 7 calendar days.'}
      ]},
    {id:'s4', title:'Contracts: Family Care, IRIS and private pay', mins:9, kind:'mixed',
      intro:'A license lets you open. Residents and payers keep you open. Most Wisconsin AFH and CBRF residents are funded through Medicaid long-term care, so plan your payer mix early.',
      points:[
        'Before serving Family Care, Family Care Partnership or IRIS members, a residential setting must be found HCBS-compliant (request with F-02138). DHS says a compliance finding does not guarantee a contract.',
        'HCBS compliance is not needed to keep a DQA license. It is needed to be paid by Medicaid waiver programs.',
        'Family Care: contact each managed care organization (MCO) that serves your region, ask about their need for your bed type, and go through their credentialing. Rates are negotiated with each MCO.',
        'IRIS: members self-direct and choose providers. Ask the member\'s IRIS consultant how residential services are set up and billed in IRIS. (Steady Shift guidance; the IRIS setup steps are being checked.)',
        'Private pay: a written admission or service agreement with rates, what is included, notice before rate changes, and refund terms. Never sign a resident to terms the rule forbids.',
        'Keep a payer mix you can live with. One payer for every bed is one rate change away from a hard year.'
      ],
      checklist:[
        {id:'s4a', t:'HCBS compliance review requested (F-02138), if you want Medicaid residents.'},
        {id:'s4b', t:'MCOs serving your region listed and contacted.'},
        {id:'s4c', t:'Credentialing packets sent.'},
        {id:'s4d', t:'Private-pay rate sheet and agreement drafted and reviewed by an attorney.'},
        {id:'s4e', t:'Target payer mix written down.'}
      ],
      sources:['hcbs','hcbsMods','mcoMap','iris'],
      quiz:[
        {q:'Does an HCBS compliance finding guarantee an MCO contract?', a:['Yes','No'], c:1, why:'DHS states plainly that it does not.'},
        {q:'Do you need HCBS compliance to keep your DQA license?', a:['Yes','No, it\'s needed to be paid by Medicaid waiver programs'], c:1, why:'Licensure and waiver payment are separate.'}
      ]},
    {id:'s5', title:'Insurance, budgeting and grants', mins:9, kind:'guide',
      intro:'Most small homes fail on cash flow, not care. Know your break-even occupancy before you take your first resident.',
      points:[
        'Ask an agent who writes residential care policies about: general and professional liability, abuse and molestation coverage, property, auto and hired or non-owned auto for resident rides, employment practices, and cyber coverage once you keep health records electronically.',
        'Workers\' compensation is required in Wisconsin once you have 3 or more employees, or pay $500 or more in wages in a calendar quarter (DWD). Check the current rule with DWD.',
        'Your application already asks for a model balance sheet and operating expenses. Use them as your real budget, not just a form.',
        'Staff wages are usually the biggest cost. Overtime after 40 hours in a workweek (federal FLSA) adds up fast with call-offs.',
        'Homes with a Family Care MCO contract can qualify for DHS Direct Care Workforce Funding, with a yearly agreement, survey and payout deadlines. Grants and other help change often. Look at WisCaregiver Careers for hiring and training help, DHS and DWD grant notices, and local small-business lenders. Check each one is open before you plan on it.'
      ],
      calc:true,
      checklist:[
        {id:'s5a', t:'Insurance quotes from at least two agents.'},
        {id:'s5b', t:'Workers\' compensation in place before your third hire.'},
        {id:'s5c', t:'Break-even occupancy worked out (use the calculator below).'},
        {id:'s5d', t:'Three months of operating cash set aside.'},
        {id:'s5e', t:'Grant and workforce programs checked for this year.'}
      ],
      sources:['wc','flsa','wiscaregiver']},
    {id:'s6', title:'Common first-year citations and how to avoid them', mins:10, kind:'official',
      intro:'From DQA\'s CY2025 statistics and public survey reports. The same few rules catch new homes every year.',
      citations:true,
      points:[
        'Service plans not updated after a change of condition were the most-cited rule in 2025: 189 CBRF citations and 134 AFH citations. A fall, hospital stay, new med or new behavior means "review the plan this week".',
        'Medication problems: missing doses from late refills, unrecorded refusals, and pre-poured meds. Use pharmacy packaging and a 7-day refill alert.',
        'Fire safety: CBRF drills every quarter with one during sleeping hours (60 CBRF citations); AFH yearly evacuation evaluation (81 AFH citations).',
        'Personnel files: health screening and background checks missing or late.',
        'House rules that limit everyone, instead of a written, consented plan for one person.'
      ],
      checklist:[
        {id:'s6a', t:'Service plan review dates and change triggers on the calendar.'},
        {id:'s6b', t:'Refill alert and pharmacy packaging set up.'},
        {id:'s6c', t:'Fire drill or evacuation evaluation calendar printed.'},
        {id:'s6d', t:'Personnel file checklist in every file.'},
        {id:'s6e', t:'Run the Survey-Ready Check once a month for the first year.'}
      ],
      sources:['stats','hcbsMods'],
      quiz:[
        {q:'What was the most-cited rule for both AFHs and CBRFs in 2025?', a:['Fire drills','Service plan updates','Background checks'], c:1, why:'Service plans not reviewed after a change of condition: 189 CBRF and 134 AFH citations.'},
        {q:'How often does a CBRF run fire drills?', a:['Once a year','Every quarter, one during sleeping hours','Monthly'], c:1, why:'DHS 83.47(2)(d).'}
      ]}
  ];

  // ---------------- Track 2: setting up Steady Shift ----------------
  // auto: a name the app checks to tick the step itself when it can tell.
  const SETUP = [
    {id:'a1', title:'Facility profile and policies', mins:10, link:'setup', items:[
      {id:'a1a', t:'Fill in the home\'s county, city, APS contact and payers.', auto:'profile', link:'setup'},
      {id:'a1b', t:'Upload your handbook and policies (PDF or Word).', auto:'docs', link:'setup'},
      {id:'a1c', t:'Build this home\'s procedure layer and read any conflicts with the law.', auto:'procs', link:'procedures'},
      {id:'a1d', t:'Try one question in Ask our policy.', link:'askpolicy'}]},
    {id:'a2', title:'Staff, roles and access', mins:8, link:'access', items:[
      {id:'a2a', t:'Check which services are on for each role.', link:'access'},
      {id:'a2b', t:'Review each staff member\'s training hours and background check date.', link:'team'},
      {id:'a2c', t:'Set a house tablet PIN if staff share a tablet.', link:'kiosk'}]},
    {id:'a3', title:'Scheduler and time sheets', mins:12, link:'schedule', items:[
      {id:'a3a', t:'Set coverage rules (day and night minimums).', link:'schedule'},
      {id:'a3b', t:'Build next week and fix every red check before publishing.', auto:'shifts', link:'schedule'},
      {id:'a3c', t:'Add a training block for anyone behind on hours.', auto:'trainblock', link:'schedule'},
      {id:'a3d', t:'Look at time sheets and the payroll export.', link:'time'}]},
    {id:'a4', title:'Residents, admission intake and service plans', mins:12, link:'intake', items:[
      {id:'a4a', t:'Run the sample admission packet through Admission intake.', auto:'intake', link:'intake'},
      {id:'a4b', t:'Open a face sheet and check the shift tasks from the service plan.', link:'face'},
      {id:'a4c', t:'Check a doctor order with the RN view.', link:'orders'},
      {id:'a4d', t:'Read the BYOD phone and tablet rules.', link:'intake/policy'},
      {id:'a4e', t:'Write or review a care plan (ISP) with "Guide me" on, then check which staff have read its summary.', link:'isp'}]},
    {id:'a5', title:'Reports, night help and triage', mins:10, link:'report', items:[
      {id:'a5a', t:'Write a sample report and see the professional rewrite.', auto:'reports', link:'report'},
      {id:'a5b', t:'Review it as the manager in Reports to review.', auto:'reviewed', link:'inbox'},
      {id:'a5c', t:'Set who is on call tonight in Night help.', link:'night'},
      {id:'a5d', t:'Do the shift change report once.', link:'shift'}]},
    {id:'a6', title:'Training and survey readiness', mins:6, link:'academy', items:[
      {id:'a6a', t:'Finish one role module in Track 3.', auto:'cert'},
      {id:'a6b', t:'Run the Survey-Ready Check.', link:'survey'},
      {id:'a6c', t:'Read this month\'s Regulatory Watch.', link:'watch'}]}
  ];

  // ---------------- Track 3: role-based staff training ----------------
  // hours: suggested in-house training credit. A manager confirms whether it counts toward the yearly hours.
  const ROLES = {
    caregiver:{name:'New caregivers', ic:'🧑‍⚕️'},
    manager:{name:'New managers', ic:'🧭'},
    owner:{name:'Owners', ic:'🏡'}
  };
  const MODULES = [
    {id:'c1', role:'caregiver', title:'Your first week: rights, dignity and home', hours:0.5,
      lessons:[
        'This is the residents\' home. Knock, wait, and ask before you help.',
        'Residents choose their schedule, food, visitors and privacy. A limit for one person needs a written, consented plan, never a house rule for everyone (HCBS Settings Rule).',
        'Use the person\'s preferred name. Talk with them, not over them.',
        'When you don\'t know, check the procedure in the app or ask. Guessing is how good people get cited.'],
      try:{label:'Open Procedure check', link:'check'},
      quiz:[
        {q:'A resident wants a snack at 10 PM. The house rule says the kitchen closes at 8. What do you do?', a:['Say no, rules are rules','Help them get a snack, and tell the manager the rule may need review','Write them up'], c:1, why:'Blanket food limits conflict with the HCBS Settings Rule. Help, then flag the rule.'},
        {q:'Before entering a resident\'s room you…', a:['Walk in, it\'s your job','Knock, wait and ask','Only knock at night'], c:1, why:'Privacy is a resident right.'},
        {q:'You aren\'t sure how your home handles something. Best first step?', a:['Guess','Check the procedure or ask','Skip it'], c:1, why:'Check, then ask.'}]},
    {id:'c2', role:'caregiver', title:'Report it right: incidents, refusals and abuse', hours:0.5,
      lessons:[
        'Write what you saw and heard, with times. Leave out guesses and blame.',
        'A resident with capacity may refuse. Offer again later, offer another way, and log every offer.',
        'Suspected abuse, neglect or misappropriation: keep the resident safe, tell your manager now, and know the home must report to DHS within 7 calendar days.',
        'Write a report in your own words and use Write a report to make it professional.'],
      try:{label:'Open Write a report', link:'report'},
      quiz:[
        {q:'Which is the better report line?', a:['"Staff was lazy and didn\'t help her."','"At 9:10 AM resident found on floor by bed; said she slipped. No visible injury. Manager called 9:12."'], c:1, why:'Facts, times, actions. No blame.'},
        {q:'A resident declines a shower twice. You…', a:['Force it gently','Log both offers, offer a sink wash, and tell the manager','Do nothing'], c:1, why:'Respect the refusal, document, and get the plan reviewed.'},
        {q:'You suspect a coworker took a resident\'s money. First step?', a:['Confront them','Make sure the resident is safe and tell your manager now','Wait to be sure'], c:1, why:'Safety first, report up right away. The home reports to DHS within 7 days.'}]},
    {id:'c3', role:'caregiver', title:'Meds and delegated tasks: your limits', hours:0.5,
      lessons:[
        'Give meds only after the training your home requires (CBRF: DHS-approved med training).',
        'Never pre-pour. Give from the labeled pharmacy package.',
        'Record every dose, refusal and missed dose with the time.',
        'Nurse-delegated tasks (like an insulin pen) are for you, for that resident, only after an RN checked you off (N 6.03(3)).'],
      try:{label:'Open My training', link:'mytraining'},
      quiz:[
        {q:'Can you pre-pour night meds to save time?', a:['Yes, if labeled with a sticky note','No'], c:1, why:'Pre-pours are a common citation. Give from the pharmacy package.'},
        {q:'An RN checked you off for one resident\'s insulin pen. Can you do another resident\'s?', a:['Yes','No, delegation is task, resident and caregiver specific'], c:1, why:'N 6.03(3): task, resident and caregiver must match.'},
        {q:'A resident spits out a pill. You…', a:['Throw it away and move on','Record it as refused or wasted and follow your med procedure'], c:1, why:'Every refusal is recorded. CBRF: two in a row go to the prescriber.'}]},
    {id:'c4', role:'caregiver', title:'Behavior support that respects rights', hours:0.5,
      lessons:[
        'Behavior is communication. Look for pain, hunger, noise, fear or boredom first.',
        'Offer two choices. Come back in 15 minutes. Lower the noise.',
        'Never restrain, threaten or argue. Keep yourself and others safe.',
        'Write what helped so the next shift can use it.'],
      try:{label:'Open Behavior help', link:'behavior'},
      quiz:[
        {q:'A resident yells and pushes a chair at 4:30 PM. First thought?', a:['They\'re being difficult','What might they need: pain, noise, hunger, tiredness?'], c:1, why:'Start with the need, not the label.'},
        {q:'Which is allowed?', a:['Locking their door so they calm down','Offering a walk or a quiet room as a choice'], c:1, why:'Choices, not restraint.'}]},
    {id:'c5', role:'caregiver', title:'Nights and emergencies: who to call', hours:0.5,
      lessons:[
        'Emergency: call 911 first, then follow the dispatcher. Honor a valid DNR or POLST.',
        'Not an emergency but worrying: use Night help to see whether it can wait until morning.',
        'Know who is on call tonight before your shift starts.',
        'Hand off at shift change: what changed, what to watch, what\'s not done.'],
      try:{label:'Open Night help', link:'night'},
      quiz:[
        {q:'A resident is not breathing normally. First step?', a:['Call the guardian for permission','Call 911'], c:1, why:'911 first. Then the manager and family.'},
        {q:'A small skin tear at 2 AM, bleeding stopped. You…', a:['Wake the owner','First aid, document, and use Night help to decide who to tell and when'], c:1, why:'Not every event needs a 2 AM call. Night help sorts it.'}]},
    {id:'m1', role:'manager', title:'New to managing: from coworker to lead', hours:1,
      lessons:[
        'Promoted from the floor? Your friends are now your team. Be the same person, with clearer lines.',
        'Fix systems, not people, first. Most "attitude" problems are unclear expectations.',
        'Correct in private, with facts. Praise in public, with specifics.',
        'Know your limits. Clinical questions go to the RN; legal and money questions go to the owner. Write them down in the Question log so nothing is lost.',
        'Protect your sleep. Night help and an on-call plan mean you only get the calls that need you.'],
      try:{label:'Open Question log', link:'questions'},
      quiz:[
        {q:'A former coworker keeps arriving 15 minutes late. Best first step?', a:['Post a warning in the group chat','Talk in private: what you saw, why it matters, and what you need'], c:1, why:'Private, factual, specific.'},
        {q:'Staff keep asking the same med question. You…', a:['Answer it each time','Check the Question log, then plan a short training and fix the procedure'], c:1, why:'Repeat questions point to a system fix.'},
        {q:'A family asks you to change a resident\'s med dose. You…', a:['Change it','Tell them it needs a prescriber order and pass it to the RN or doctor'], c:1, why:'Only a prescriber changes an order.'}]},
    {id:'m2', role:'manager', title:'Survey-ready every day', hours:1,
      lessons:[
        'Surveys can come any day. Make "ready" the normal state, not a scramble.',
        'Monthly: run the Survey-Ready Check and fix the oldest gaps first.',
        'Service plans: review yearly and after every change of condition. It\'s the #1 citation.',
        'Keep personnel files complete: training, background checks, health screening.',
        'When the rule is unclear, use Decide and Document, or Ask the Regulator.'],
      try:{label:'Open Survey-Ready Check', link:'survey'},
      quiz:[
        {q:'A resident falls and goes to the ER. What should happen this week?', a:['Nothing until the yearly review','Review and update their service plan'], c:1, why:'A change of condition triggers a review.'},
        {q:'A rule is unclear and your owner wants an answer. Best move?', a:['Guess','Record the decision and reasons in Decide and Document, or ask DQA'], c:1, why:'Documented reasoning protects the home.'}]},
    {id:'m3', role:'manager', title:'Documentation without accusations', hours:0.5,
      lessons:[
        'Write facts, times and actions. Leave out character words like lazy, rude or careless.',
        'Coach with the procedure, not the person: "The procedure says…".',
        'Use Reports to review to send a report back with a kind, specific note.',
        'Keep personnel issues out of resident records.'],
      try:{label:'Open Reports to review', link:'inbox'},
      quiz:[
        {q:'Which manager note is better?', a:['"You were careless again."','"Please add the time you called the nurse and what they said."'], c:1, why:'Specific and fixable.'},
        {q:'Where do staff performance notes go?', a:['In the resident\'s incident report','In the personnel record, kept separate'], c:1, why:'Keep personnel and resident records apart.'}]},
    {id:'m4', role:'manager', title:'Scheduling, coverage and fatigue', hours:0.5,
      lessons:[
        'Build to residents\' needs and your license, then your home\'s minimums.',
        'Only staff cleared for meds or delegated tasks cover those times.',
        'Overtime after 40 hours in a workweek. Watch it before it happens.',
        'Put training on the schedule. Hours that aren\'t scheduled don\'t happen.'],
      try:{label:'Open Schedule', link:'schedule'},
      quiz:[
        {q:'Only one person is on nights and they aren\'t med-trained. A resident has an 8 PM med. Problem?', a:['No','Yes, someone cleared for meds must be on at that time'], c:1, why:'The scheduler flags this as a must-fix.'},
        {q:'A caregiver is 5 hours short of yearly training. Best fix?', a:['Remind them','Put a training block on the schedule'], c:1, why:'The scheduler can add a 2-hour block for you.'}]},
    {id:'o1', role:'owner', title:'Your duties as the licensee', hours:1,
      lessons:[
        'The license is yours. So are the citations, even when a manager made the mistake.',
        'Know your chapter (DHS 88 or DHS 83), your program statement, and who you are licensed to serve.',
        'Background checks every 4 years. Misconduct reports to DHS within 7 days.',
        'HCBS Settings Rule compliance keeps Medicaid waiver payment flowing.',
        'Read Regulatory Watch monthly. The DHS 88 rewrite is coming.'],
      try:{label:'Open Regulatory Watch', link:'watch'},
      quiz:[
        {q:'Your manager missed a background recheck. Who holds the citation?', a:['The manager','The licensee'], c:1, why:'The license holder is responsible.'},
        {q:'What does HCBS compliance protect?', a:['Your license','Medicaid waiver payment'], c:1, why:'Licensure and waiver payment are separate.'}]},
    {id:'o2', role:'owner', title:'Money: rates, margins and the cost of citations', hours:0.5,
      lessons:[
        'Know your break-even occupancy and staff cost per resident day.',
        'Turnover is expensive: hiring, training and overtime while you\'re short.',
        'A citation costs time, a plan of correction, sometimes a forfeiture, and reputation with payers.',
        'Use Owner view to see where hours and money go.'],
      try:{label:'Open Owner view', link:'owner'},
      quiz:[
        {q:'Which usually costs a small home the most?', a:['Food','Staff wages and overtime','Paper'], c:1, why:'Labor is the biggest line.'}]},
    {id:'o3', role:'owner', title:'Building a team that stays', hours:0.5,
      lessons:[
        'Clear roles and a manager who can sleep make a home people stay in.',
        'Give managers training for the job, not just the title.',
        'Ask staff what\'s hard. The Question log and Feedback review show you.',
        'Pay for training time, and put it on the schedule.'],
      try:{label:'Open Feedback review', link:'review'},
      quiz:[
        {q:'A strong caregiver was promoted and is struggling. Best support?', a:['Wait and see','Give them the New manager modules and a weekly check-in'], c:1, why:'Promotion without training is a common reason good staff leave.'}]}
  ];

  const PASS = 0.8;
  const NOTE = 'Steady Shift training is in-house training. It is not Wisconsin DHS-approved training and does not replace the four CBRF approved courses or any course your license or contracts require.';

  // ---------------- Track 4: running the business (reusable across care verticals) ----------------
  // verticals: which care businesses a unit applies to. 'all' = every vertical. Residential (AFH and CBRF) is the first build.
  const VERTICALS = {
    residential:{name:'Adult family homes and CBRFs', live:true},
    homecare:{name:'In-home care agencies', live:false},
    dayservices:{name:'Adult day services', live:false}
  };
  Object.assign(SRC, {
    dfi: L('WI DFI: Form an LLC (Articles of Organization)', 'https://dfi.wi.gov/Pages/BusinessServices/BusinessEntities/LimitedLiabilityCompanies.aspx'),
    dfiName: L('WI DFI: Business name search', 'https://apps.dfi.wi.gov/apps/corpsearch/search.aspx'),
    ein: L('IRS: Get an EIN', 'https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number'),
    dorBtr: L('WI DOR: Business tax registration', 'https://www.revenue.wi.gov/Pages/Businesses/New-Business-home.aspx'),
    ui: L('WI DWD: Unemployment insurance for employers', 'https://dwd.wisconsin.gov/uitax/'),
    newhire: L('WI New Hire Reporting', 'https://dwd.wisconsin.gov/uitax/newhire.htm'),
    sba: L('SBA: Write your business plan', 'https://www.sba.gov/business-guide/plan-your-business/write-your-business-plan'),
    irsRecords: L('IRS: Recordkeeping for small businesses', 'https://www.irs.gov/businesses/small-businesses-self-employed/recordkeeping'),
    irs15: L('IRS Publication 15 (employer tax guide)', 'https://www.irs.gov/publications/p15'),
    dolClass: L('U.S. DOL: Employee or independent contractor', 'https://www.dol.gov/agencies/whd/flsa/misclassification'),
    ada: L('ADA.gov: Accessibility guidance', 'https://www.ada.gov/'),
    planReview: L('DHS: Plan review for health care facilities', 'https://www.dhs.wisconsin.gov/regulations/plan-review/index.htm'),
    oews: L('BLS: Occupational Employment and Wage Statistics', 'https://www.bls.gov/oes/'),
    wisconomy: L('WI DWD: WisConomy wage data', 'https://wisconomy.wisconsin.gov/')
  });
  const BUSINESS = [
    {id:'b1', title:'Form your business: LLC, EIN and registrations', mins:10, kind:'official', verticals:['all'],
      intro:'Set up the company before you sign a lease, open a bank account or apply for a license, so everything is in the business\'s name.',
      steps:[
        {t:'Search your business name with the Department of Financial Institutions (DFI).'},
        {t:'Pick a registered agent with a Wisconsin street address (you, a partner, or a paid service).'},
        {t:'File Articles of Organization for an LLC with DFI (online is faster and cheaper than paper; check DFI for the current fee).'},
        {t:'Write an operating agreement. Wisconsin doesn\'t require one, but banks, lenders and partners will ask, and it settles who decides what.'},
        {t:'Get a free EIN from the IRS (never pay a website for it).'},
        {t:'Register with the Wisconsin Department of Revenue for withholding tax, and with DWD for unemployment insurance, before your first payroll.'},
        {t:'Report every new hire to Wisconsin New Hire Reporting within 20 days.'},
        {t:'Open a business bank account and keep business and personal money apart.'},
        {t:'File the DFI annual report every year so the LLC stays in good standing.'}
      ],
      points:['An LLC limits personal liability for business debts, but not for your own negligence. Insurance still matters.','Talk with an accountant about tax election (default LLC, or S corporation) before your first profitable year.'],
      checklist:[{id:'b1a', t:'Name checked with DFI.'},{id:'b1b', t:'Registered agent chosen.'},{id:'b1c', t:'Articles of Organization filed.'},{id:'b1d', t:'Operating agreement signed.'},{id:'b1e', t:'EIN received.'},{id:'b1f', t:'DOR withholding and DWD unemployment accounts open.'},{id:'b1g', t:'Business bank account open.'},{id:'b1h', t:'Annual report date on the calendar.'}],
      sources:['dfi','dfiName','ein','dorBtr','ui','newhire'], tax:true},
    {id:'b2', title:'Licenses and permits beyond DQA', mins:8, kind:'mixed', verticals:['residential'],
      intro:'Your DQA license is the big one, but the town, the fire department and sometimes the health department have their own say.',
      points:[
        'Zoning: check that a group residence is allowed at the address. Wisconsin law treats many community living arrangements specially, but local rules and spacing requirements still apply (DHS 88.04(2)(a) asks AFHs to check local ordinances).',
        'Occupancy permit: many municipalities issue one after a building inspection, especially after renovations.',
        'Fire: CBRF building and fire protection plans go through DHS plan review. Ask your local fire department to walk the home before your survey. AFHs follow the DHS 88 fire safety rules (smoke detectors, extinguishers, evacuation).',
        'Food: meals served only to residents follow DHS 83 or DHS 88. Ask your local health department whether any food license applies to you (Steady Shift guidance, check locally).',
        'Business license: Wisconsin has no general state business license, but some cities and counties require one.',
        'Keep copies of every permit and inspection in one place, with renewal dates on the calendar.'
      ],
      checklist:[{id:'b2a', t:'Zoning confirmed in writing.'},{id:'b2b', t:'Occupancy permit (if your town requires one).'},{id:'b2c', t:'CBRF plan review approved; AFH fire safety items in place.'},{id:'b2d', t:'Local fire department walk-through done.'},{id:'b2e', t:'Local health department asked about food rules.'},{id:'b2f', t:'City or county business license (if required).'}],
      sources:['afhOpen','cbrfOpen','planReview','dhs88']},
    {id:'b3', title:'Insurance for a care business', mins:6, kind:'guide', verticals:['all'],
      intro:'Insurance is the backstop when something goes wrong despite good care. Buy it before the first resident moves in.',
      points:[
        'General liability and professional liability (sometimes sold together for care homes).',
        'Abuse and molestation coverage. Many general policies exclude it.',
        'Property, plus business interruption if you own the building.',
        'Auto, and hired or non-owned auto if staff drive residents in their own cars.',
        'Workers\' compensation: required once you have 3 or more employees, or pay $500 or more in wages in a quarter (DWD).',
        'Employment practices liability, and cyber coverage once you keep health records electronically.',
        'Ask MCOs what limits their contracts require before you buy.'
      ],
      checklist:[{id:'b3a', t:'Contract insurance requirements collected.'},{id:'b3b', t:'Quotes from two or more agents who insure care homes.'},{id:'b3c', t:'Workers\' compensation in place.'},{id:'b3d', t:'Certificates of insurance saved.'}],
      sources:['wc']},
    {id:'b4', title:'Bookkeeping basics', mins:8, kind:'guide', verticals:['all'],
      intro:'Clean books make taxes, MCO audits, loans and a future sale far easier. An hour a week is enough if you keep up.',
      points:[
        'One business bank account and card. Never mix in personal spending.',
        'Use simple categories: payroll, payroll taxes, rent or mortgage, utilities, food, supplies and PPE, equipment, repairs, insurance, licenses and fees, training, mileage.',
        'Log receipts the week you spend (the expense tracker in this academy feeds the Owner view).',
        'Residents\' personal money is theirs. Keep it separate, with a ledger and receipts, and follow the resident funds rules in your chapter.',
        'Use a payroll service or follow IRS Publication 15 for withholding and quarterly filings. Caregivers you schedule and direct are usually employees, not contractors.',
        'Reconcile the bank account every month. Meet your accountant every quarter in year one.'
      ],
      checklist:[{id:'b4a', t:'Business account and card only for business.'},{id:'b4b', t:'Bookkeeping software or a ledger set up with the categories.'},{id:'b4c', t:'Payroll service chosen.'},{id:'b4d', t:'Resident funds ledger set up, separate from business money.'},{id:'b4e', t:'Monthly reconcile on the calendar.'}],
      sources:['irsRecords','irs15','dolClass'], tax:true},
    {id:'b5', title:'Brick and mortar: buy or lease, renovate, maintain', mins:10, kind:'guide', verticals:['residential','dayservices'],
      intro:'The building decides who you can serve and what you pay every month. Walk it with the rule in hand before you sign.',
      points:[
        'Buy or lease: owning builds equity but ties up cash; a lease needs the landlord\'s written OK for a licensed care use and for renovations.',
        'Accessibility: ramps or zero-step entry, wide doors, grab bars, roll-in or low-threshold showers, lever handles. Your ambulatory category or CBRF class sets what you must have.',
        'Fire and life safety: smoke and CO detection, extinguishers, exits and evacuation routes. Some CBRF classes need sprinklers; check before you buy.',
        'CBRF: no construction before DHS plan review. A design professional prepares the plans.',
        'Budget a maintenance reserve (many owners set aside 1 to 2 percent of the building\'s value a year) plus utilities that run higher with people home all day.'
      ],
      checklist:[{id:'b5a', t:'Building walked with the rule and a contractor.'},{id:'b5b', t:'Landlord consent for care use (if leasing).'},{id:'b5c', t:'Renovation list priced.'},{id:'b5d', t:'Plan review done before work starts (CBRF).'},{id:'b5e', t:'Maintenance reserve and utilities in the budget.'}],
      sources:['planReview','ada','cbrfOpen']},
    {id:'b6', title:'Pay, hiring and growth', mins:8, kind:'guide', verticals:['all'],
      intro:'Know what the market pays where you are, what a new hire really costs, and what a new home or more beds would take.',
      points:[
        'Market pay: compare your rates with the BLS wage data for your region in Pay benchmarks.',
        'A new hire costs more than the wage: payroll taxes, workers\' compensation, benefits, paid training hours, background checks and recruiting.',
        'Turnover is the hidden cost. Replacing a caregiver can cost thousands in recruiting, training and overtime.',
        'Grow when the numbers work: use the startup and expansion model before you add beds or a second home.'
      ],
      tools:['wages','hire','startup'],
      checklist:[{id:'b6a', t:'Your pay rates compared with the market.'},{id:'b6b', t:'Full cost of one new hire worked out.'},{id:'b6c', t:'Break-even and payback checked for any expansion.'}],
      sources:['oews','wisconomy','sba']}
  ];

  // Inventory and expense categories (food receipts come from Menu and groceries).
  const EXP_CATS = ['Supplies','PPE','Food','Equipment','Repairs and maintenance','Utilities','Insurance','Licenses and fees','Training','Other'];
  const INV_SEED = [
    {site:'maple', cat:'PPE', n:'Gloves, nitrile (box of 100)', have:6, min:8, cost:9.5},
    {site:'maple', cat:'PPE', n:'Masks, surgical (box of 50)', have:3, min:2, cost:7},
    {site:'maple', cat:'Supplies', n:'Incontinence briefs, medium (case)', have:1, min:2, cost:48},
    {site:'maple', cat:'Supplies', n:'Hand sanitizer (bottle)', have:5, min:4, cost:4.25},
    {site:'maple', cat:'Equipment', n:'Gait belts', have:3, min:3, cost:14},
    {site:'birch', cat:'PPE', n:'Gloves, nitrile (box of 100)', have:14, min:20, cost:9.5},
    {site:'birch', cat:'Supplies', n:'Disinfectant wipes (canister)', have:9, min:6, cost:6.75},
    {site:'birch', cat:'Supplies', n:'Incontinence briefs, large (case)', have:2, min:4, cost:52}
  ];
  const EXP_SEED = [
    {site:'maple', daysAgo:3, cat:'PPE', amt:76, note:'Gloves and masks (sample)'},
    {site:'maple', daysAgo:9, cat:'Supplies', amt:96, note:'Briefs (sample)'},
    {site:'maple', daysAgo:15, cat:'Utilities', amt:312, note:'Electric and gas (sample)'},
    {site:'maple', daysAgo:21, cat:'Repairs and maintenance', amt:140, note:'Furnace service (sample)'},
    {site:'birch', daysAgo:5, cat:'Supplies', amt:208, note:'Briefs and wipes (sample)'},
    {site:'birch', daysAgo:12, cat:'Utilities', amt:640, note:'Electric, gas, water (sample)'}
  ];

  // Startup and expansion model presets. All numbers are editable sample assumptions, not quotes.
  const STARTUP = {
    residential:{
      afh:{label:'4-bed adult family home (owner works some shifts)', beds:4, rate:6000, occ:90, oneTime:[
        ['LLC filing and registered agent', 260], ['DQA license fee (2 years)', 171], ['Accessibility and safety renovations', 18000], ['Furniture and beds', 9000], ['Equipment (lift, scale, shower chair, med cart)', 6500],
        ['Initial supplies and PPE', 1500], ['Insurance deposits', 2500], ['Training and background checks for the first team', 2400], ['Attorney and accountant', 3000]],
        monthly:[['Rent or mortgage', 2600], ['Utilities', 650], ['Food', 1150], ['Supplies and PPE', 350], ['Insurance', 600], ['Repairs reserve', 300], ['Software and phone', 200], ['Other', 250]],
        staffHrs:20*7*4.33, wage:18.5},
      cbrf:{label:'8-bed CBRF', beds:8, rate:5600, occ:88, oneTime:[
        ['LLC filing and registered agent', 260], ['DQA license fee (2 years)', 389+8*50.25], ['Plan review and design professional', 9000], ['Renovations (accessibility, fire and life safety)', 60000], ['Furniture and beds', 18000],
        ['Equipment', 12000], ['Initial supplies and PPE', 3000], ['Insurance deposits', 4500], ['Training and background checks for the first team', 5000], ['Attorney and accountant', 5000]],
        monthly:[['Rent or mortgage', 5200], ['Utilities', 1300], ['Food', 2300], ['Supplies and PPE', 700], ['Insurance', 1100], ['Repairs reserve', 600], ['Software and phone', 300], ['Other', 500]],
        staffHrs:(24*7*1.5)*4.33, wage:18.5}
    }
  };
  // Payroll load used by the hiring planner. Check rates each January.
  const PAYROLL = {fica:7.65, futa:0.6, futaBase:7000, suta:3.05, sutaBase:14000, wcPer100:3.0, check:'FICA and FUTA from IRS Publication 15. Wisconsin unemployment new-employer rate and wage base, and the workers\' compensation rate, vary: check with DWD and your insurer.'};

  return {CHECKED, SRC, START, SETUP, ROLES, MODULES, PASS, NOTE, VERTICALS, BUSINESS, EXP_CATS, INV_SEED, EXP_SEED, STARTUP, PAYROLL};
})();
