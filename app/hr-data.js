// Steady Shift test app: content for Employee files (hr.js). Rules, retention, wording guide and fictional sample staff records.
// No real staff information belongs in this file. Checked 2026-11-27. Not legal advice.
(function(){
  const CHECKED = '2026-11-27';

  // Where each rule comes from.
  const SRC = {
    s10313:{t:'Wis. Stat. 103.13, employee right to inspect personnel records', u:'https://law.justia.com/codes/wisconsin/chapter-103/section-103-13'},
    dhs88:{t:'DHS 88, adult family homes (88.04 health screening, 88.09 records)', u:'https://docs.legis.wisconsin.gov/code/admin_code/dhs/030/88.pdf'},
    dhs83:{t:'DHS 83, CBRFs (83.13 retention, 83.17 hiring and screening, 83.18 employee records)', u:'https://docs.legis.wisconsin.gov/code/admin_code/dhs/030/83.pdf'},
    dhs12:{t:'Wisconsin caregiver background checks (Wis. Stat. 50.065, DHS 12)', u:'https://www.dhs.wisconsin.gov/caregiver/index.htm'},
    i9:{t:'USCIS: retaining and storing Form I-9', u:'https://www.uscis.gov/i-9-central/form-i-9-resources/handbook-for-employers-m-274/100-retaining-form-i-9'},
    irs:{t:'IRS: how long to keep employment tax records', u:'https://www.irs.gov/businesses/small-businesses-self-employed/employment-tax-recordkeeping'},
    flsa:{t:'U.S. DOL: FLSA recordkeeping (29 CFR 516)', u:'https://www.dol.gov/agencies/whd/fact-sheets/21-flsa-recordkeeping'},
    eeoc:{t:'EEOC: recordkeeping requirements (29 CFR 1602.14)', u:'https://www.eeoc.gov/employers/recordkeeping-requirements'},
    ada:{t:'EEOC: ADA confidentiality of medical information (29 CFR 1630.14)', u:'https://www.eeoc.gov/laws/guidance/enforcement-guidance-disability-related-inquiries-and-medical-examinations-employees'},
    osha:{t:'OSHA: employee exposure and medical records (29 CFR 1910.1020) and bloodborne pathogens training records (1910.1030)', u:'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1020'},
    eeocTest:{t:'EEOC: employment tests and selection procedures', u:'https://www.eeoc.gov/laws/guidance/employment-tests-and-selection-procedures'},
    nlra:{t:'NLRB: employees may talk with each other about pay and working conditions', u:'https://www.nlrb.gov/about-nlrb/rights-we-protect/the-law/interfering-with-employee-rights-section-7-8a1'},
    wiPay:{t:'Wisconsin DWD: employer records (DWD 272.11)', u:'https://dwd.wisconsin.gov/er/laborstandards/'},
    shrm:{t:'SHRM: personnel files and record retention (member toolkit)', u:'https://www.shrm.org/topics-tools/tools/toolkits'}
  };

  // Wis. Stat. 103.13, read on Justia 2026-11-27.
  const INSPECT = {
    times:2, days:7,
    points:[
      'Each employee, and each former employee, may look at their personnel records at least 2 times a calendar year.',
      'The home sets a time within 7 working days of the request, near where they work and during normal hours (or another reasonable time and place).',
      'The home may ask that the request be in writing. Copies may cost no more than the actual cost to copy.',
      'If they disagree with something and it is not corrected, they may write a statement. It is attached to that part of the file and goes with it whenever that part is shared outside the home.',
      'Their own medical records in the home\'s files are included. If showing them would cause harm, the home may give them to a doctor the employee names instead.'
    ],
    excluded:['Records of a criminal investigation','Letters of reference','Test papers (only the total score is shown)','Staff planning, such as judgments about future raises or promotions','Personal information about other people','Records for a pending claim between the home and the employee']
  };

  // Retention guide. "years after" counts from the day employment ends unless said otherwise.
  const RETAIN = [
    {id:'personnel', t:'Personnel file (job description, start date, training, background check, write-ups, reviews)', keep:'3 years after employment ends', yrsAfter:3, why:'DHS 83.13(2)(c) for CBRFs and DHS 88.09(2)(c) for adult family homes. Federal EEOC rules need at least 1 year from any personnel action.', src:['dhs83','dhs88','eeoc'], check:'Being checked', checkWhy:'The AFH section number (88.09(2)(c)) still needs a full-text read.'},
    {id:'health', t:'Health screening (TB) papers', keep:'3 years after employment ends, in the separate medical file', yrsAfter:3, why:'Part of the employee record under DHS 83 and 88, and kept confidential (only the licensing agency may look, to verify).', src:['dhs88','dhs83','ada']},
    {id:'exposure', t:'Needlestick, blood or TB exposure records', keep:'Length of employment plus 30 years', yrsAfter:30, why:'OSHA employee exposure and medical records rule.', src:['osha']},
    {id:'bbp', t:'Bloodborne pathogens training records', keep:'3 years from the training date', yrsFromDate:3, why:'OSHA 1910.1030(h)(2).', src:['osha']},
    {id:'i9', t:'Form I-9 (kept apart from the personnel file)', keep:'3 years after hire or 1 year after employment ends, whichever is later', i9:true, why:'Federal rule. Storing I-9s separately keeps them out of other reviews.', src:['i9']},
    {id:'tax', t:'W-4 and WT-4 (tax withholding)', keep:'At least 4 years after the tax is due or paid', yrsAfter:4, why:'IRS employment tax records.', src:['irs']},
    {id:'payroll', t:'Payroll and pay-rate records', keep:'3 years', yrsAfter:3, why:'FLSA 29 CFR 516.5 and Wisconsin DWD 272.11. Time cards: at least 2 years (516.6).', src:['flsa','wiPay']},
    {id:'bg', t:'Caregiver background check results and the Background Information Disclosure', keep:'While employed, plus at least 3 years (as part of the employee record)', yrsAfter:3, why:'A completed background check is a required part of the employee record (DHS 83.18). Rechecks every 4 years.', src:['dhs12','dhs83']}
  ];

  // What goes in each person's file and how often it renews. months: renewal cycle; null = one time.
  // cat: compliance, tax, train. medical: true means only a pass/due status shows here; the papers live in the medical file.
  const REQ = [
    {id:'bg', cat:'Background', t:'Caregiver background check (BID form plus results)', months:48, settings:['afh','cbrf'], why:'Required before working with residents, then every 4 years.', cite:'Wis. Stat. 50.065; DHS 12', src:'dhs12'},
    {id:'tb', cat:'Health', t:'Health screening, including TB', months:null, settings:['afh','cbrf'], medical:true, why:'Done within 90 days before starting work. Re-screen when your home\'s TB risk plan or an exposure calls for it.', cite:'DHS 88.04(2)(g)1; DHS 83.17(2)', src:'dhs88'},
    {id:'i9', cat:'Hiring', t:'Form I-9 (work eligibility)', months:null, settings:['afh','cbrf'], separate:true, why:'Section 1 by day one, section 2 within 3 business days. Kept apart from the personnel file.', cite:'8 CFR 274a.2', src:'i9'},
    {id:'w4', cat:'Hiring', t:'Federal W-4 and Wisconsin WT-4', months:null, settings:['afh','cbrf'], why:'Needed for payroll withholding.', cite:'IRS; Wisconsin DOR', src:'irs'},
    {id:'jd', cat:'Hiring', t:'Signed job description', months:null, settings:['afh','cbrf'], why:'A required part of the employee record.', cite:'DHS 83.18(1)', src:'dhs83'},
    {id:'orient', cat:'Training', t:'Orientation before working alone', months:null, settings:['afh','cbrf'], why:'Rights, policies, emergency plan and resident needs before working without another staff member.', cite:'DHS 88.04(5); DHS 83.20 to 83.25', src:'dhs88'},
    {id:'cpr', cat:'Training', t:'CPR and first aid (choking)', months:24, settings:['afh','cbrf'], why:'Most cards last 2 years. CBRF staff need first aid and choking training within 90 days.', cite:'DHS 83.20(2)(c)', src:'dhs83'},
    {id:'meds', cat:'Training', t:'Medication training', months:null, settings:['afh','cbrf'], why:'Before passing medications.', cite:'DHS 88.07; DHS 83.37', src:'dhs83'},
    {id:'fire', cat:'Training', t:'Fire safety and evacuation', months:12, settings:['afh','cbrf'], why:'Yearly review is a common standard. Practice drills follow your home\'s schedule.', cite:'DHS 88.04(5); DHS 83 fire safety', src:'dhs88'},
    {id:'bbp', cat:'Training', t:'Bloodborne pathogens and infection control', months:12, settings:['afh','cbrf'], why:'OSHA asks for yearly training where staff could touch blood or sharps.', cite:'29 CFR 1910.1030', src:'osha'},
    {id:'hepb', cat:'Health', t:'Hepatitis B vaccine offered (or signed declination)', months:null, settings:['afh','cbrf'], medical:true, why:'Offered free within 10 working days of starting a job that could involve blood or body fluids. A declination uses the OSHA wording and can be changed later.', cite:'29 CFR 1910.1030(f)(2)', src:'osha'},
    {id:'diet', cat:'Training', t:'Dietary training (staff who plan or make meals)', months:null, settings:['cbrf'], why:'Within 90 days of starting to work with food.', cite:'DHS 83.22(4)', src:'dhs83'},
    {id:'dementia', cat:'Training', t:'Dementia care', months:null, settings:['cbrf'], why:'Needed when the CBRF serves people with dementia.', cite:'DHS 83.20 to 83.25', src:'dhs83'},
    {id:'cna', cat:'License', t:'Nurse aide registry listing or nursing license', months:24, settings:['afh','cbrf'], optional:true, why:'Only for people hired as a CNA, LPN or RN. Check the registry or license lookup at hire and at renewal.', cite:'Wisconsin DHS nurse aide registry; Wis. Stat. ch. 441', src:'dhs12'},
    {id:'drive', cat:'License', t:'Driver\'s license and auto insurance', months:12, settings:['afh','cbrf'], optional:true, why:'Only for staff who drive residents. Check yearly.', cite:'Your insurer\'s rules', src:'shrm'}
  ];

  // Corrective action steps (progressive, but the home can skip steps for serious conduct).
  const STEPS = [
    {id:'coach', t:'Coaching conversation', d:'A private talk about one specific thing. Written down so both remember it.'},
    {id:'verbal', t:'Documented verbal warning', d:'The concern was raised before. Written down with a clear expectation.'},
    {id:'written', t:'Written warning', d:'A formal letter with what must change, by when, and the support offered.'},
    {id:'final', t:'Final written warning', d:'Last step before suspension or ending employment. The owner should review it first.'},
    {id:'suspend', t:'Suspension', d:'Time away while something is looked into, or as a step. Owner approval.'},
    {id:'end', t:'End of employment', d:'Owner decision. Check with an employment lawyer when unsure.'}
  ];

  // Wording guide. Each flag explains why and offers a better way. Nothing is blocked; the writer reviews and decides.
  const WORDS = [
    {re:/\b(lazy|laziness)\b/i, why:'A label, not a behavior.', try:'Describe what was not done and when: "The 2 AM check was not charted on Nov 3."'},
    {re:/\b(bad|poor|negative|nasty) attitude\b|\battitude\b/i, why:'"Attitude" is an opinion and hard to fix.', try:'Quote what was said or done: "Said \'that\'s not my job\' when asked to help with the transfer."'},
    {re:/\b(drama|dramatic|hysterical|emotional|hormonal|moody|crazy|psycho)\b/i, why:'Loaded words that can read as bias about gender or health.', try:'Say what happened: "Raised their voice in the hallway in front of residents."'},
    {re:/\b(bossy|abrasive|aggressive|shrill|feisty|sassy)\b/i, why:'These words are used unevenly by gender and race.', try:'Name the behavior and the effect: "Gave instructions to a coworker in front of a resident, and the coworker left the room."'},
    {re:/\b(always|never|constantly|every time)\b/i, why:'Absolute words are easy to dispute.', try:'Count it: "Late 3 times in October (Oct 2, 9, 16)."'},
    {re:/\b(i (think|feel|believe)|seems?( like)?|probably|apparently)\b/i, why:'Opinion or guess.', try:'Write what you saw or heard, or what a record shows.'},
    {re:/\b(culture fit|not a fit|personality)\b/i, why:'Vague and can hide bias.', try:'Link to a written expectation, policy or job duty.'},
    {re:/\b(old|older|young|too old|too young|age|retire|retirement)\b/i, why:'Age is protected (40 and over under federal law; any age under Wisconsin law).', try:'Leave age out. Describe the job task and what happened.'},
    {re:/\b(pregnan\w*|maternity|baby|kids?|child ?care|daycare|married|single mom|single dad)\b/i, why:'Pregnancy, family and marital status are protected or risky to mention.', try:'Leave family life out. If attendance is the concern, list dates and the call-off rule.'},
    {re:/\b(disab\w*|handicap\w*|depress\w*|anxiety|bipolar|adhd|diagnos\w*|medication|meds she takes|meds he takes|sick a lot|always sick|workers.? comp)\b/i, why:'Health details belong in the medical file, and leave tied to health may be protected (ADA, FMLA, workers\' comp).', try:'Keep to attendance facts and the policy. Move any health detail to the medical file.'},
    {re:/\b(church|religio\w*|pray\w*|muslim|christian|jewish|hijab|accent|english is|foreign|immigrant|race|black|white|hispanic|latin[oa])\b/i, why:'Religion, race, national origin and accent are protected.', try:'Leave it out unless it is a job requirement (for example, a written policy on what language to use with a resident who needs it).'},
    {re:/\b(complain\w* about pay|talks? about (pay|wages)|union|petition)\b/i, why:'Talking with coworkers about pay and working conditions is protected by federal law.', try:'Do not discipline for this. If there was a separate behavior issue, describe only that.'}
  ];

  // Optional development check-in. Preferences, not a personality test. Never used for hiring, pay, promotion, discipline or scheduling.
  const STYLE = [
    {id:'feedback', q:'How do you like to get feedback?', a:['Right away, in private','At a set check-in','In writing, so I can think about it','Mix of these']},
    {id:'learn', q:'How do you learn a new task best?', a:['Show me, then let me try','Let me read it first','Talk it through','Practice with a buddy']},
    {id:'energy', q:'What part of the work gives you energy?', a:['Time with residents','Keeping the house running smoothly','Teaching or helping coworkers','Solving problems when things go sideways']},
    {id:'drain', q:'What wears you out most?', a:['Rushing','Unclear instructions','Conflict between coworkers','Paperwork','Being alone on a hard shift']},
    {id:'recog', q:'How do you like to be thanked?', a:['A quick word in private','In front of the team','A note in my file','Not a big deal to me']},
    {id:'grow', q:'Where would you like to grow?', a:['Medication or nursing skills','Leading a shift','Training new staff','Cooking and activities','Office and scheduling','Not sure yet']}
  ];
  const STRENGTHS = ['Calm in a crisis','Patient with memory care','Great with families','Organized','Teaches others well','Notices small changes in residents','Cooks and plans meals','Keeps the team upbeat','Reliable on nights','Good with paperwork','Spanish speaker','Strong with transfers and safe lifting'];

  // Fictional sample people. Dates are invented. Birthdays are shown as month and day only.
  const SAMPLE = {
    'Caregiver A':{hire:'2026-07-14', role:'Caregiver', bday:'03-22', share:{bday:'team', anniv:'team'}, pref:{shifts:'Days', contact:'Text', max:32, notes:'Has class Tuesday evenings'}},
    'Caregiver B':{hire:'2021-04-05', role:'Lead caregiver', bday:'11-29', share:{bday:'team', anniv:'team'}, pref:{shifts:'Days or evenings', contact:'Call', max:40, notes:''}, strengths:['Teaches others well','Calm in a crisis','Notices small changes in residents'], style:{feedback:'Right away, in private', learn:'Show me, then let me try', energy:'Teaching or helping coworkers', drain:'Unclear instructions', recog:'A quick word in private', grow:'Leading a shift'}, devShare:true},
    'Caregiver C':{hire:'2024-05-14', role:'Caregiver', bday:'12-08', share:{bday:'manager', anniv:'team'}, pref:{shifts:'Nights', contact:'Text', max:36, notes:'Prefers not to work Sundays'}},
    'Caregiver D':{hire:'2025-01-20', role:'Caregiver', bday:'', share:{bday:'private', anniv:'manager'}, pref:{shifts:'Any', contact:'App message', max:40, notes:''}, strengths:['Cooks and plans meals','Keeps the team upbeat'], devShare:false},
    'Caregiver E':{hire:'2019-12-02', role:'Caregiver', bday:'07-04', share:{bday:'team', anniv:'team'}, pref:{shifts:'Nights', contact:'Call', max:40, notes:''}},
    'Manager':{hire:'2020-09-09', role:'House manager', bday:'02-14', share:{bday:'manager', anniv:'team'}, pref:{shifts:'Days', contact:'Call', max:45, notes:''}},
    'Caregiver F':{hire:'2022-01-10', role:'Lead caregiver', bday:'12-03', share:{bday:'team', anniv:'team'}, pref:{shifts:'Days', contact:'Text', max:40, notes:''}},
    'Caregiver G':{hire:'2023-07-19', role:'Caregiver', bday:'05-30', share:{bday:'team', anniv:'team'}, pref:{shifts:'Evenings', contact:'Text', max:32, notes:''}},
    'Caregiver H':{hire:'2026-10-27', role:'Caregiver', bday:'12-15', share:{bday:'team', anniv:'team'}, pref:{shifts:'Days', contact:'Text', max:40, notes:'New: orientation in progress'}},
    'Caregiver J':{hire:'2024-04-04', role:'Caregiver', bday:'12-01', share:{bday:'team', anniv:'team'}, pref:{shifts:'Any', contact:'Call', max:40, notes:''}},
    'Caregiver K':{hire:'2023-10-10', role:'Caregiver', bday:'09-17', share:{bday:'manager', anniv:'manager'}, pref:{shifts:'Days', contact:'Text', max:30, notes:'Second job on weekends'}}
  };

  // Meaningful dates for sample residents (birthdays come from the face sheet). Shared with staff to plan something they will enjoy.
  const RES_DATES = {
    maple:{'M-1':[{md:'05-12', t:'Wedding anniversary (late husband)', note:'Likes to look at the photo album that day. Keep it gentle.'}], 'M-2':[{md:'10-01', t:'Start of harvest on the farm', note:'Talk about the cows and the corn.'}], 'M-4':[{md:'12-07', t:'Army service day he remembers', note:'Ask if he wants to talk about it. Some years he does not.'}]},
    birch:{}, cedar:{}
  };

  window.SS_HR = {CHECKED, SRC, INSPECT, RETAIN, REQ, STEPS, WORDS, STYLE, STRENGTHS, SAMPLE, RES_DATES};
})();
