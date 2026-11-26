// Steady Shift test app: "What's worked for others" (the shared peer layer).
// Seed entries come from PUBLIC sources (DHS guidance, DQA statistics, public forums and news), each cited,
// or are clearly marked fictional samples. No facility names, staff names or resident details belong here.
// This layer is SEPARATE from each home's private documents: nothing private is read into it.
// A home's content reaches it only when someone submits it on purpose, it is scrubbed, and a person reviews it.
window.SS_PEER = (function(){
  const CHECKED = '2026-11-26';

  // outcome: accepted = a regulator accepted it or official guidance says so; cited = homes were cited for the gap;
  // mixed = contested; untested = no survey result known.
  const OUTCOMES = {
    accepted:{label:'Regulator accepted', cls:'calm'},
    cited:{label:'Homes were cited here', cls:'red'},
    mixed:{label:'Contested', cls:'amber'},
    untested:{label:'Not tested by a surveyor', cls:'grey'}
  };
  const SOURCE_KIND = {
    dhs:'Official DHS guidance', stats:'DQA statistics', sod:'Public DQA survey report', forum:'Public caregiver forum',
    news:'News report', sample:'Fictional sample member entry'
  };

  const ENTRIES = [
    {id:'P01', conflict:'C08', settings:['afh','cbrf'], state:'WI', county:'Statewide', outcome:'accepted', source:'dhs', verified:true, votes:14,
      title:'Door locks: what DQA accepted as proof of a fix',
      practice:'Install a lock on every living-unit door, even when the resident says they don\'t want one. Keep a written key policy. When a lock is unsafe for one person, write the assessed reason in that person\'s plan.',
      result:'DHS lists the proof it accepts: photos of installed locks, copies of the key and lock policies, and a signed, dated statement that every unit door has one.',
      cite:'42 CFR 441.301(c)(4); DHS P-01817', ref:{label:'DHS door locks FAQ (P-01817)', url:'https://www.dhs.wisconsin.gov/publications/p01817.pdf'}},
    {id:'P02', conflict:'C09', settings:['afh','cbrf'], state:'WI', county:'Statewide', outcome:'accepted', source:'dhs', verified:true, votes:11,
      title:'House rules: turn a blanket rule into a per-person plan',
      practice:'Replace rules like "kitchen closes at 8" with open access for everyone. Where one person truly needs a limit, write it in their Member Centered Plan with the assessed need, what was tried first, consent, and a review date.',
      result:'This is the documented route DHS describes for HCBS Settings Rule modifications. Without consent, the limit can\'t be used.',
      cite:'42 CFR 441.301(c)(4); DHS HCBS modifications guidance', ref:{label:'DHS HCBS Settings Rule modifications', url:'https://www.dhs.wisconsin.gov/hcbs/modifications.htm'}},
    {id:'P03', conflict:'C02', settings:['afh','cbrf'], state:'WI', county:'Statewide', outcome:'accepted', source:'dhs', verified:true, votes:19,
      title:'No more pre-pours: pharmacy packaging instead',
      practice:'Stop pouring meds ahead of time. Ask the pharmacy for unit-dose or blister packaging so night staff give straight from the labeled package. In a CBRF with RN supervision, setup happens only under written RN delegation.',
      result:'Matches the DHS packaging rules: AFH meds stay in the original container, and an unsupervised CBRF needs pharmacist unit-dose packaging. Forum caregivers asked about pre-pouring were nearly unanimous that unlabeled pre-pours are a no.',
      cite:'DHS 88.07(3)(a); DHS 83.37(2)(c)', ref:{label:'DHS medication packaging and labeling', url:'https://www.dhs.wisconsin.gov/regulations/assisted-living/mm-packaging.htm'},
      also:{label:'Caregiver forum thread on pre-pouring', url:'https://allnurses.com/med-prepouring-question-cna-t192403'}},
    {id:'P04', conflict:'C01', settings:['cbrf','afh'], state:'WI', county:'Statewide', outcome:'cited', source:'stats', verified:true, votes:9,
      title:'Service plans: tie the review to "change of condition", not just the calendar',
      practice:'Put each plan\'s yearly date on the calendar, and treat any fall, hospital stay, new med or new behavior as an automatic "review the plan this week" trigger.',
      result:'Late plan updates were the most-cited CBRF rule in 2025 (189 citations) and the most-cited AFH rule (134). The calendar alone misses the "on change" half of the rule.',
      cite:'DHS 83.35(3)(d); DHS 88.06(3)(f)', ref:{label:'DQA State of Assisted Living CY2025 (P-01726)', url:'https://www.dhs.wisconsin.gov/publications/p01726.pdf'}},
    {id:'P05', conflict:'C13', settings:['cbrf'], state:'WI', county:'Statewide', outcome:'cited', source:'stats', verified:true, votes:6,
      title:'Fire drills: a quarterly calendar with one at night',
      practice:'Schedule four CBRF drills a year on a printed calendar, with one during sleeping hours. Log time to evacuate, who was on shift, and what to fix.',
      result:'Fire drill gaps drew 60 CBRF citations in 2025. AFHs have a different rule: an annual evacuation evaluation, which drew 81 citations.',
      cite:'DHS 83.47(2)(d); DHS 88.05(4)(d)2.b', ref:{label:'DQA State of Assisted Living CY2025 (P-01726)', url:'https://www.dhs.wisconsin.gov/publications/p01726.pdf'}},
    {id:'P06', conflict:'C05', settings:['afh','cbrf'], state:'Any', county:'Not given', outcome:'untested', source:'forum', verified:false, votes:12,
      title:'Shower refusals: offer, log, and change the plan',
      practice:'Offer again at another time, offer a sponge bath or washcloth wash instead, ask about the person\'s old routine (time of day, water temperature, who helps), and log every offer. Repeated refusals go to the care plan, not to the caregiver\'s record.',
      result:'Forum nurses and aides mostly agreed that a person with capacity may refuse, and that the risk is in not offering or not documenting. Some worried about skin and infection risk if refusals run long.',
      cite:'Resident rights (DHS 83.32, DHS 88.10); exact subsection being verified', ref:{label:'Caregiver forum thread on shower refusals', url:'https://allnurses.com/patient-refusal-shower-neglect-t610889'}},
    {id:'P07', conflict:'C05', settings:['afh','cbrf'], state:'Any', county:'Not given', outcome:'untested', source:'forum', verified:false, votes:8,
      title:'When the family says "nobody bathed her"',
      practice:'Log each offer and refusal with the time. Tell the family the same day in neutral words ("offered at 9 and 2, declined both, washed up at the sink"). Bring a week of refusals to a care plan meeting with the family.',
      result:'Forum replies said the log plus early family contact ends most of these complaints. No survey outcome reported.',
      cite:'Resident rights; service plan review rules', ref:{label:'Caregiver forum thread on family complaints', url:'https://allnurses.com/refuses-bath-week-complains-family-t622030'}},
    {id:'P08', conflict:'C06', settings:['cbrf','afh'], state:'Any', county:'Not given', outcome:'mixed', source:'news', verified:false, votes:10,
      title:'Falls: from "never lift" to a lift-or-911 decision tree',
      practice:'Some facilities call 911 for every fall to limit liability. Fire chiefs push back, and some cities now charge lift-assist fees. The alternative some homes use: check for injury signs first, call 911 if any, otherwise use a mechanical lift or gait belt with trained staff and log it.',
      result:'Contested. A 2025 news investigation found residents waiting on the floor under no-lift policies. Wisconsin bills introduced in January 2026 would fund lift equipment and fall-recovery training.',
      cite:'No Wisconsin rule found that requires or bans a no-lift policy', ref:{label:'FOX 9 investigation, Dec 2025', url:'https://www.fox9.com/news/senior-living-facilities-refuse-pick-up-fallen-residents-call-911-repeatedly-instead'},
      also:{label:'Wisconsin fall bills press release', url:'https://legis.wisconsin.gov/senate/18/dassler-alfheim/press-releases/fox-valley-state-legislators-introduce-bills-to-improve-fall-outcomes-in-assisted-living-facilities/'}},
    {id:'P09', conflict:'C07', settings:['afh','cbrf'], state:'Any', county:'Not given', outcome:'mixed', source:'news', verified:false, votes:7,
      title:'"We don\'t do medical care" rewritten as "911 first, follow the dispatcher"',
      practice:'Rewrite any "no medical care" policy so it says staff call 911 first, follow the dispatcher\'s instructions, and honor a valid DNR. Train it at hire.',
      result:'After a widely reported case where staff declined dispatcher CPR instructions, lawyers quoted said a facility can disclaim medical services but can\'t bar staff from helping.',
      cite:'DHS 83.20(2) (first aid training within 90 days)', ref:{label:'Relias Media on CPR refusal and strict policies', url:'https://reliasmedia.com/articles/62732-cpr-refusal-highlights-risk-of-overly-strict-policies'}},
    {id:'P12', conflict:'C02', settings:['afh'], state:'WI', county:'Not given', outcome:'cited', source:'sod', verified:true, votes:8,
      title:'Med cabinet left unlocked after a theft: what the surveyor flagged',
      situation:'After narcotics went missing, the home kept using an unlocked med cabinet and an improvised sharps container.',
      practice:'Lock meds every time, count controlled meds at each shift change with two signatures, and use a proper sharps container.',
      result:'The AFH was cited for unsecured meds (a repeat citation), incomplete med records and the sharps container. A one-time fix was not enough because the problem came back.',
      cite:'DHS 88.07(3)(a); DHS 88.07(3)(e)1', ref:{label:'How to find public DQA survey reports', url:'https://www.dhs.wisconsin.gov/guide/survey-info.htm'}},
    {id:'P13', conflict:'C01', settings:['cbrf'], state:'WI', county:'Not given', outcome:'cited', source:'sod', verified:true, votes:7,
      title:'Fall risk changed, plan did not',
      situation:'A resident\'s fall risk went up, but the service plan stayed the same, and a transfer was not done the way the plan said.',
      practice:'Treat every change in fall risk as a same-week plan review, and check that staff do transfers the way the current plan says.',
      result:'The CBRF was cited for the plan not being updated and for the transfer (a repeat citation) in a 2026 survey.',
      cite:'DHS 83.35(3)(c)-(d)', ref:{label:'How to find public DQA survey reports', url:'https://www.dhs.wisconsin.gov/guide/survey-info.htm'}},
    {id:'P14', conflict:'C10', settings:['cbrf'], state:'WI', county:'Not given', outcome:'cited', source:'sod', verified:true, votes:9,
      title:'Police came, but no self-report to DQA',
      situation:'Law enforcement responded to the CBRF more than once, and staff misconduct allegations came up.',
      practice:'Any police response triggers a DQA self-report within 3 working days. Any misconduct allegation triggers an investigation and keeps residents safe while it runs.',
      result:'The CBRF was cited for missing the 3-working-day self-reports and for not investigating allegations or protecting residents during them (a repeat citation).',
      cite:'DHS 83.12(4)(b); DHS 13.05', ref:{label:'How to find public DQA survey reports', url:'https://www.dhs.wisconsin.gov/guide/survey-info.htm'}},
    {id:'P15', conflict:'C14', settings:['cbrf'], state:'WI', county:'Not given', outcome:'cited', source:'sod', verified:true, votes:5,
      title:'Hiring files: background checks and TB screening missing',
      situation:'Some caregiver files lacked a complete background check, an out-of-state check for a worker who had lived elsewhere, or TB screening.',
      practice:'Use a hire checklist that cannot be closed until the BID form, DOJ results, any out-of-state check and the health screening are all filed.',
      result:'Two CBRFs surveyed in 2026 were cited for these hiring-file gaps, one of them a repeat.',
      cite:'DHS 83.17; Wis. Stat. 50.065', ref:{label:'How to find public DQA survey reports', url:'https://www.dhs.wisconsin.gov/guide/survey-info.htm'}},
    {id:'P10', conflict:'C04', settings:['cbrf'], state:'WI', county:'Sample County', outcome:'accepted', source:'sample', verified:false, votes:5,
      title:'PRN orders with "give if" criteria written in',
      practice:'The RN asks the prescriber to spell out "give if" and "call the nurse if" for every PRN. Staff follow the criteria and call the RN for anything outside them.',
      result:'(Fictional sample) The surveyor reviewed PRN records and made no citation.',
      cite:'DHS 83.37 (PRN rules being verified)', ref:null},
    {id:'P11', conflict:'C11', settings:['afh'], state:'WI', county:'Sample County', outcome:'untested', source:'sample', verified:false, votes:3,
      title:'60-day background check countdown taped to the schedule',
      practice:'New hires with a clean BID form work only on shifts with another trained caregiver until the DOJ results arrive, with a 60-day countdown on the schedule.',
      result:'(Fictional sample) Not yet surveyed. Matches the 60-day supervised window in the DHS background check manual.',
      cite:'DHS P-00038 s. 2.2.2', ref:{label:'DHS Caregiver Background Check manual (P-00038)', url:'https://dhs.wisconsin.gov/publications/p0/p00038.pdf'}}
  ];

  // HIPAA Safe Harbor: the 18 identifiers that must be removed (45 CFR 164.514(b)(2)).
  const SAFE_HARBOR = [
    'Names', 'Geographic areas smaller than a state (street, city, county, ZIP)', 'All date parts except year (admission, incident, birth, death)',
    'Phone numbers', 'Fax numbers', 'Email addresses', 'Social Security numbers', 'Medical record numbers', 'Health plan or Medicaid ID numbers',
    'Account numbers', 'Certificate or license numbers', 'Vehicle identifiers and plates', 'Device identifiers and serial numbers',
    'Web addresses (URLs)', 'IP addresses', 'Fingerprints, voiceprints and other biometrics', 'Full-face photos and comparable images',
    'Any other unique identifying number, characteristic or code (including room numbers and resident codes)'
  ];

  // What must be in place before any REAL report could flow into the shared layer.
  const GATES = [
    {t:'HIPAA program live', d:'Phase 2 of the HIPAA plan: risk analysis, policies, access controls, audit logs, encryption, workforce training.'},
    {t:'Business associate agreements', d:'A BAA between each home and Steady Shift, and between Steady Shift and every vendor that touches the data (hosting, database, AI).'},
    {t:'Subscription terms with explicit consent', d:'A separate, opt-in clause letting the home share de-identified patterns, which the home can withdraw. Off by default.'},
    {t:'De-identification method signed off', d:'A written Safe Harbor procedure, tested on real-looking samples, reviewed by a privacy attorney. Expert Determination if free text is ever kept.'},
    {t:'Human review step staffed', d:'A trained reviewer checks every item against the 18 identifiers and the small-group rule before anything is published.'},
    {t:'Small-group rule enforced in code', d:'No count shown unless at least 11 homes contributed, so no home can be singled out.'},
    {t:'Wisconsin confidentiality check', d:'Confirm state rules on resident records (DHS 83, DHS 88, Wis. Stat. 146.82) allow de-identified sharing.'}
  ];

  const MIN_HOMES = 11;

  // Published, de-identified incident patterns (fictional sample numbers). homes = how many different homes contributed.
  const PATTERNS = [
    {type:'Fall without injury', shift:'Night', homes:23, n:61,
      situation:'A resident is found sitting on the floor beside the bed with no sign of injury.',
      response:'Staff checked for injury before moving them, used a gait belt or lift with two people, told the nurse by morning, and reviewed the plan within a week.',
      outcome:'Homes that did the plan review within a week reported fewer repeat falls over the next month.'},
    {type:'Exit-seeking near shift change', shift:'Evening', homes:14, n:29,
      situation:'A resident with memory loss heads for the door during the evening hand-off, asking to go home.',
      response:'One staff member walked with them and offered a small task. The home moved the hand-off away from the front door.',
      outcome:'Fewer door alarms in the homes that moved the hand-off spot.'},
    {type:'Medication refused', shift:'Day', homes:17, n:40,
      situation:'A resident declines a scheduled medication.',
      response:'Staff offered again 30 minutes later, logged both offers, and told the nurse the same day.',
      outcome:'No citations reported in these homes for refused doses.'},
    {type:'Resident-to-resident contact', shift:'Evening', homes:9, n:12,
      situation:'(Hidden: fewer than 11 homes contributed.)', response:'', outcome:''},
    {type:'Missed dose, pharmacy delay', shift:'Morning', homes:6, n:8,
      situation:'(Hidden: fewer than 11 homes contributed.)', response:'', outcome:''}
  ];

  return {CHECKED, OUTCOMES, SOURCE_KIND, ENTRIES, SAFE_HARBOR, GATES, MIN_HOMES, PATTERNS};
})();
