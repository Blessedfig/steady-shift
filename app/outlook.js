// Steady Shift test app: Owner Outlook.
// What could change funding, pay rules and the market in the year ahead, what it could cost a typical home,
// and what to do now. Year-end scenarios (base, downside, upside) run on sample financials the owner can edit.
// Sources are public and listed per item. Every dollar figure is a sample estimate, not advice.
// Public-facing copy rule: never name or criticize a specific care management organization.
(function(){
  const A = window.SSApp; if (!A) return;
  const {D, h, head, R, save} = A;
  const S = () => A.state();
  const usd = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString();
  const pct = n => (n > 0 ? '+' : '') + (Math.round(n*10)/10) + '%';

  // ---------- sample financials (fictional, editable per home) ----------
  const FIN = {
    afh:  {fcRes:3, fcRate:5000, ppRes:1, ppRate:6500, hours:180, wage:17.5, burden:15, other:4500, staff:6, dcw:3000, target:15000},
    cbrf: {fcRes:8, fcRate:4800, ppRes:4, ppRate:6200, hours:500, wage:18,   burden:18, other:12000, staff:14, dcw:9000, target:50000}
  };
  const FIN_LABELS = [
    ['fcRes','Family Care residents'], ['fcRate','Family Care rate, $ per resident per month'],
    ['ppRes','Private-pay residents'], ['ppRate','Private-pay rate, $ per resident per month'],
    ['hours','Paid caregiver hours per week'], ['wage','Average caregiver wage, $ per hour'],
    ['burden','Payroll taxes and benefits, % of wages'], ['other','Other costs, $ per month (housing, food, insurance, supplies)'],
    ['staff','Number of staff'], ['dcw','Direct Care Workforce Funding received last year, $'],
    ['target','Year-end bottom line you want, $']
  ];

  // ---------- scenario drivers: base, downside, upside ----------
  // Each driver ties to one or more Outlook items. Values are sample assumptions the owner can change.
  const DRIVERS = [
    {id:'fcRate', label:'Family Care rate change', unit:'%', base:1.5, down:0, up:3, item:'O1',
      act:'Keep ISPs and acuity notes current so rate requests have proof. Ask each care manager in writing when rates for your home are reviewed.'},
    {id:'ppRate', label:'Private-pay rate increase', unit:'%', base:4, down:2, up:6, item:'O9',
      act:'Send private-pay families a 60-day notice of next year\'s rate with what it pays for. Assisted living median prices rose 5% in 2025.'},
    {id:'vacancy', label:'Empty bed-months in the year', unit:'months', base:1, down:3, up:0, item:'O3',
      act:'Keep a private-pay waitlist and contracts with more than one care management organization where your region allows.'},
    {id:'wage', label:'Caregiver wage increase', unit:'%', base:3, down:6, up:2, item:'O7',
      act:'Pay retention bonuses from Direct Care Workforce Funding, and keep base raises to what rates can carry.'},
    {id:'ot', label:'Hours paid at overtime or agency rates', unit:'% of hours', base:3, down:8, up:1, item:'O8',
      act:'Build a call-in list now. Overtime that lands on the same two people is the first sign of losing them.'},
    {id:'other', label:'Other cost increase (food, insurance, utilities)', unit:'%', base:4, down:7, up:3, item:'O12',
      act:'Get insurance quotes 90 days before renewal. Show your incident and training records; they can lower premiums.'},
    {id:'train', label:'New-rule training hours per staff member', unit:'hours', base:4, down:8, up:2, item:'O5',
      act:'Fold the new incident and grievance steps into regular staff meetings instead of separate paid sessions.'},
    {id:'cite', label:'Citations in the year', unit:'citations', base:0.5, down:2, up:0, item:'O11',
      act:'Run the Survey-Ready Check every quarter. The most-cited AFH and CBRF rules are service plan updates.'},
    {id:'dcwDelay', label:'Direct Care Workforce payment missed or delayed', unit:'% of last year', base:0, down:50, up:0, item:'O2',
      act:'Sign the annual agreement within 45 days and finish the survey. Don\'t promise staff base pay that depends on it.'}
  ];

  // ---------- Outlook items ----------
  // likelihood: High / Medium / Low. check: Verified (read on a public source) or Unverified.
  const ITEMS = [
    {id:'O1', group:'Funding', title:'Family Care rates may not keep up with costs', applies:['afh','cbrf'], likely:'Medium', when:'Rates set each January; 2027 notices due soon',
      what:'Statewide Family Care capitation rates for 2026 rose 1.5% for nursing-home level of care and fell 4.0% for the frail elderly group. Wisconsin projected a $213 million Medicaid shortfall through mid-2027, partly because Family Care enrollment is running above budget. Care management organizations may hold provider rates flat.',
      todo:['Find your current rate letter for each resident','Ask in writing when your rates are next reviewed','Update ISPs when care needs go up, so the record supports a higher rate'],
      src:[['Milliman, Family Care CY2026 rate report','https://www.dhs.wisconsin.gov/non-dhs/dms/fc-2026-capitationrate-report.pdf'],['Becker\'s, Jan 2026','https://www.beckerspayer.com/payer/medicaid/wisconsin-projects-213m-medicaid-shortfall/']],
      check:'Verified', watch:'W7', driver:'fcRate'},
    {id:'O2', group:'Funding', title:'Direct Care Workforce Funding: timing and future', applies:['afh','cbrf'], likely:'Medium', when:'Payments Dec 2026 and June 2027; future after June 2027 not announced',
      what:'AFHs and CBRFs with Family Care contracts get a share automatically (about $73 million statewide per payment). Payments for 2026 are estimates: federal approval so far covers 2025. DHS has not said whether the program continues after the 2025 to 2027 budget.',
      todo:['Sign the annual agreement within 45 days of receiving it','Pay funds to workers within 6 months and keep per-worker records','Complete the annual survey','Plan bonuses, not base raises, from this money'],
      src:[['DHS Direct Care Workforce Funding FAQ','https://dhs.wisconsin.gov/medicaid/ltc-workforce-funding-faq.htm']],
      check:'Verified', watch:null, driver:'dcwDelay'},
    {id:'O3', group:'Funding', title:'Care management changes can leave a bed empty', applies:['afh','cbrf'], likely:'Medium', when:'Any time',
      what:'Members change organizations, organizations change contracts, and one organization stopped taking new members in September 2026. Every month a bed sits empty costs a full month of that resident\'s rate.',
      todo:['Keep a private-pay waitlist','Hold contracts with more than one organization if your region has several','Track referral sources for each admission'],
      src:[['DHS 2026 MCO Scorecard','https://www.dhs.wisconsin.gov/publications/p02553-26.pdf']],
      check:'Verified', watch:null, driver:'vacancy'},
    {id:'O4', group:'Federal Medicaid', title:'2025 federal budget law cuts Medicaid over 10 years', applies:['afh','cbrf','home'], likely:'High', when:'Phased in 2026 to 2032; provider tax limits from Oct 2027',
      what:'About $911 billion less federal Medicaid spending from 2025 to 2034. Most direct changes hit adults in Medicaid expansion; Family Care members are largely untouched. The risk for homes is indirect: tighter state budgets and flatter rates from 2028. A new optional waiver from July 2028 could fund more home-based care for people with lighter needs.',
      todo:['Build a cash reserve of at least one month of costs','Check staff who rely on Medicaid for their own coverage: 6-month renewals start Dec 31, 2026 in expansion states'],
      src:[['KFF, 2025 reconciliation law','https://www.kff.org/report-section/health-provisions-in-the-2025-federal-budget-reconciliation-law-overview/'],['KFF, states and home care spending','https://kff.org/medicaid/states-management-of-medicaid-home-care-spending-ahead-of-h-r-1-effects']],
      check:'Verified', watch:'W4', driver:null},
    {id:'O5', group:'Federal Medicaid', title:'Access Rule: new incident and grievance steps', applies:['afh','cbrf'], likely:'High', when:'Incident system July 9, 2027; grievance enforcement Dec 31, 2027',
      what:'States must run a critical incident system and a grievance process for HCBS. Care managers will likely change what they ask homes to report and how fast. The cost to a home is mostly staff training time.',
      todo:['Read the new incident form when it is published','Train staff in regular meetings','Use the Report something screen so timing is tracked'],
      src:[['AHCA/NCAL on Access Rule delays','https://www.ahcancal.org/News-and-Communications/Blog/Pages/CMS-delays-another-enforcement-provision-in-Medicaid-Access-Rule-.aspx']],
      check:'Verified', watch:'W5', driver:'train'},
    {id:'O6', group:'Federal Medicaid', title:'80/20 pay rule for home care agencies', applies:['home'], likely:'Medium', when:'Reporting from July 2028; 80% minimum from July 2030; may be revised',
      what:'At least 80% of Medicaid payments for personal care, homemaker and home health aide services must go to worker pay. Bundled AFH and CBRF rates are not clearly covered. A federal proposal from August 2026 could revise the rule.',
      todo:['Start tracking what share of each payment goes to direct care pay','Watch for Wisconsin\'s small-provider rules'],
      src:[['Adult Family Home Council on 80/20','https://adultfamilyhomecouncil.org/news/cmss-medicaid-80-20-rule-what-adult-family-home-providers-should-know']],
      check:'Verified', watch:'W8', driver:null},
    {id:'O7', group:'Workforce and pay rules', title:'Caregiver wages keep rising', applies:['afh','cbrf','home'], likely:'High', when:'Ongoing',
      what:'Wisconsin\'s minimum wage is still $7.25, but the market sets caregiver pay: the US median for home and personal care aides was $17.21 an hour in 2025, and Wisconsin long-term care vacancies were 28% in 2022. Demand for aides grows 18% by 2035.',
      todo:['Compare your wage to nearby homes and agencies twice a year','Tie raises to training milestones staff can see'],
      src:[['BLS, home health and personal care aides','https://www.bls.gov/ooh/healthcare/home-health-aides-and-personal-care-aides.htm'],['DHS budget brief','https://dhs.wisconsin.gov/budget/budget-ltc-25-27.pdf']],
      check:'Verified', watch:null, driver:'wage'},
    {id:'O8', group:'Workforce and pay rules', title:'Fewer workers from immigration changes', applies:['afh','cbrf','home'], likely:'Medium', when:'Ongoing since 2025',
      what:'Immigrants are about 30% of US direct care workers. Several work-permit programs ended in 2025 and 2026, and Wisconsin assisted living operators report limiting admissions. Losing even one caregiver pushes hours into overtime.',
      todo:['Ask staff privately if their work permit is changing, and plan coverage early','Cross-train so one loss doesn\'t break the schedule'],
      src:[['PBS Wisconsin / Wisconsin Watch, Sept 2026','https://pbswisconsin.org/news-item/federal-immigration-policy-shifts-may-be-worsening-wisconsins-caregiver-shortage/']],
      check:'Verified', watch:null, driver:'ot'},
    {id:'O10', group:'Workforce and pay rules', title:'Overtime and live-in rules for home care', applies:['home'], likely:'Medium', when:'Federal rule pending',
      what:'The US Labor Department proposed letting third-party agencies use the companionship and live-in overtime exemptions again. Until a final rule, keep paying overtime. AFH and CBRF staff are not affected. The 2024 salary-threshold rule for managers was struck down in court in November 2024.',
      todo:['Keep overtime rules as they are until a final rule','Check Wisconsin wage rules, which can be stricter'],
      src:[], check:'Unverified', watch:'W3', driver:null},
    {id:'O9', group:'Market', title:'Private-pay families have more choices', applies:['afh','cbrf'], likely:'Medium', when:'Ongoing',
      what:'Assisted living median cost rose 5% to $6,200 a month in 2025, and in-home help rose 3% to $35 an hour. Families with lighter needs may choose in-home care; families who need 24-hour help mostly cannot afford it at home. Your best private-pay customers are people who need someone nearby at all hours.',
      todo:['Describe night coverage clearly in tours and on your website','Raise private rates on a set date each year with notice'],
      src:[['CareScout 2025 Cost of Care','https://investor.genworth.com/news-events/press-releases/detail/1054']],
      check:'Verified', watch:null, driver:'ppRate'},
    {id:'O11', group:'Rules and enforcement', title:'More inspections and complaints', applies:['afh','cbrf'], likely:'High', when:'Ongoing',
      what:'Wisconsin enforcement surveys rose from 384 in 2020 to 1,378 in 2025, and complaints from 1,820 to 2,329. CBRF forfeitures run $10 to $1,000 per violation per day, and a re-inspection costs $200.',
      todo:['Run the Survey-Ready Check each quarter','Fix the top-cited rules first: service plan and ISP updates'],
      src:[['DQA State of Assisted Living 2025','https://dhs.wisconsin.gov/publications/p01726.pdf']],
      check:'Verified', watch:null, driver:'cite'},
    {id:'O13', group:'Rules and enforcement', title:'DHS 88 rewrite could bring new competition', applies:['afh'], likely:'Medium', when:'Forum Dec 9, 2026; effective Jan 1, 2029 if approved',
      what:'New Class C homes may not need sprinklers, and trained non-RN staff could give more medication routes. That lowers the cost of opening new AFHs, which means more homes competing for residents and staff from 2029.',
      todo:['Attend or send questions to the Dec 9 forum','Decide what sets your home apart before 2029'],
      src:[['DHS 88 proposed rule','https://www.dhs.wisconsin.gov/node/154516']],
      check:'Verified', watch:'W1', driver:null},
    {id:'O12', group:'Market', title:'Insurance, food and utility costs', applies:['afh','cbrf','home'], likely:'High', when:'At each renewal',
      what:'Non-labor costs usually rise faster than rates. Liability and property insurance renewals are where homes see the biggest jumps.',
      todo:['Get quotes 90 days before renewal','Show insurers your training and incident records'],
      src:[], check:'Unverified', watch:null, driver:'other'}
  ];

  // ---------- the model ----------
  function fin(){ const st = S(); st.outlook = st.outlook || {}; const set = A.setting() === 'cbrf' ? 'cbrf' : 'afh';
    const k = A.site().id; st.outlook[k] = st.outlook[k] || {fin:Object.assign({}, FIN[set]), drv:{}}; return st.outlook[k]; }
  function drv(o, d, sc){ const x = o.drv[d.id]; return x && x[sc] != null && x[sc] !== '' ? +x[sc] : d[sc]; }
  // One year ahead. Returns totals and each driver's dollar effect against "nothing changes".
  function model(o, sc){
    const f = o.fin, g = id => drv(o, DRIVERS.find(d => d.id === id), sc);
    const fcRev = f.fcRes * f.fcRate * 12 * (1 + g('fcRate')/100);
    const ppRev = f.ppRes * f.ppRate * 12 * (1 + g('ppRate')/100);
    const avgRate = (f.fcRes + f.ppRes) ? (f.fcRes*f.fcRate*(1+g('fcRate')/100) + f.ppRes*f.ppRate*(1+g('ppRate')/100)) / (f.fcRes + f.ppRes) : 0;
    const vac = g('vacancy') * avgRate;
    const wage = f.wage * (1 + g('wage')/100), mult = 1 + f.burden/100;
    const baseLabor = f.hours * 52 * wage * mult;
    const otCost = f.hours * 52 * (g('ot')/100) * wage * 0.5 * mult;
    const trainCost = f.staff * g('train') * wage * mult;
    const other = f.other * 12 * (1 + g('other')/100);
    const cite = g('cite') * 1500;
    const dcwGap = f.dcw * g('dcwDelay')/100; // owner covers promised bonuses if the payment slips
    const rev = fcRev + ppRev - vac, cost = baseLabor + otCost + trainCost + other + cite + dcwGap;
    return {rev, cost, net: rev - cost};
  }
  function flat(o){ // no rate or cost changes, no vacancies: the "if nothing moved" line
    const f = o.fin; return (f.fcRes*f.fcRate + f.ppRes*f.ppRate)*12 - f.hours*52*f.wage*(1+f.burden/100) - f.other*12;
  }
  // dollar swing of each driver: downside value vs base value, everything else at base
  function swing(o, d){
    const keep = o.drv[d.id]; const b = drv(o, d, 'base'), dn = drv(o, d, 'down');
    o.drv[d.id] = {base:b, down:b, up:b}; const nb = model(o, 'base').net;
    o.drv[d.id] = {base:dn, down:dn, up:dn}; const nd = model(o, 'base').net;
    if (keep) o.drv[d.id] = keep; else delete o.drv[d.id];
    return nb - nd;
  }

  // ---------- view ----------
  const LIK = {High:'amber', Medium:'', Low:'grey'};
  R.outlook = v => {
    v.classList.add('wide');
    if (A.setting() === 'home'){
      v.append(head('Owner Outlook', 'What could change your money next year', 'Pick a staffed home at the top to run year-end scenarios. Home care items are listed below.'));
      v.append(itemsCard('home')); return;
    }
    const o = fin(), set = A.setting();
    v.append(head('Owner Outlook · '+A.site().name, 'What could change your money in the year ahead', 'Funding, pay rules and market changes, what each could cost a home like yours, and what to do now. Sample numbers: change them to match your home.'));
    v.append(h('div',{class:'card warn'}, h('b',null,'Estimates, not advice.'), h('span',{class:'small'},' The financials are a fictional sample. Each item links to its public source and to Regulatory Watch for date updates. Check large decisions with your accountant.')));

    const out = h('div');
    const inputs = h('div',{class:'grid g3'});
    FIN_LABELS.forEach(([k, l]) => { const i = h('input',{type:'number',min:'0',step:'any',value:String(o.fin[k])});
      i.addEventListener('input',()=>{ o.fin[k] = +i.value||0; save(); draw(); }); inputs.append(h('label',{class:'f'},l,i)); });
    v.append(h('details',{class:'card'}, h('summary',null,h('h2',{style:'display:inline'},'Your numbers (sample '+D.SETTINGS[set].short+')')), h('p',{class:'small muted'},'Saved in this browser only.'), inputs,
      h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ o.fin = Object.assign({}, FIN[set]); o.drv = {}; save(); A.route(); }},'Reset to sample'))));
    v.append(out);

    // assumptions table
    const tb = h('tbody');
    DRIVERS.forEach(d => { const cells = ['base','down','up'].map(sc => { const i = h('input',{type:'number',step:'any',value:String(drv(o,d,sc)),'aria-label':d.label+', '+({base:'base',down:'downside',up:'upside'})[sc],style:'max-width:90px'});
        i.addEventListener('input',()=>{ o.drv[d.id] = o.drv[d.id] || {}; o.drv[d.id][sc] = i.value; save(); draw(); }); return h('td',null,i); });
      tb.append(h('tr',null, h('th',{scope:'row'}, h('a',{href:'#/outlook/'+d.item},d.label), h('span',{class:'small muted'},' ('+d.unit+')')), cells)); });
    v.append(h('details',{class:'card'}, h('summary',null,h('h2',{style:'display:inline'},'Scenario assumptions')), h('p',{class:'small muted'},'Downside is a hard but realistic year; upside is a good one. Change any value.'),
      h('div',{class:'tablewrap'}, h('table',{class:'t'}, h('thead',null,h('tr',null,['Driver','Base','Downside','Upside'].map(x => h('th',{scope:'col'},x)))), tb))));

    v.append(itemsCard(set));

    function draw(){
      out.textContent = '';
      const sc = {base:model(o,'base'), down:model(o,'down'), up:model(o,'up')}, tgt = o.fin.target;
      const tileOf = (k, name) => { const n = sc[k].net, ok = n >= tgt;
        return h('div',{class:'card'}, h('div',{class:'stat '+(ok?'good':'warnc')}, h('b',null,usd(n)), h('span',null,name+' year-end bottom line')),
          h('p',{class:'small muted'}, 'Revenue '+usd(sc[k].rev)+' · costs '+usd(sc[k].cost)), h('p',{class:'small'}, ok ? 'Meets your '+usd(tgt)+' target.' : usd(tgt - n)+' short of your '+usd(tgt)+' target.')); };
      out.append(h('div',{class:'grid g3'}, tileOf('down','Downside'), tileOf('base','Base'), tileOf('up','Upside')));
      out.append(h('p',{class:'small muted'}, 'If nothing changed at all: '+usd(flat(o))+'. The base case already includes normal rate and cost increases.'));

      // what moves the bottom line most, with the action that protects it
      const rows = DRIVERS.map(d => ({d, s:swing(o, d)})).filter(r => Math.abs(r.s) >= 1).sort((a,b) => b.s - a.s);
      const max = Math.max(1, ...rows.map(r => r.s));
      out.append(h('div',{class:'card'}, h('h2',null,'What to do now, biggest risk first'),
        h('p',{class:'small muted'},'Each bar is how much worse the year gets if that one driver goes to its downside value. Fix the top ones first.'),
        h('div',{class:'hbars'}, rows.map(r => h('div',{class:'hrow',style:'grid-template-columns:minmax(0,13rem) 1fr 5.5rem'}, h('span',{class:'hl'}, r.d.label), h('span',{class:'htrack', title:r.d.label+': '+usd(r.s)+' at risk'}, h('i',{class:'sg wait', style:'width:'+(r.s/max*100)+'%'})), h('span',{class:'hv'}, usd(r.s))))),
        h('ol',null, rows.slice(0,4).map(r => h('li',null, h('b',null,r.d.label+' ('+usd(r.s)+' at risk). '), r.d.act, ' ', h('a',{href:'#/outlook/'+r.d.item},'Details')))),
        h('details',null, h('summary',{class:'small'},'Show as a table'), h('table',{class:'t'}, h('thead',null,h('tr',null,h('th',{scope:'col'},'Driver'),h('th',{scope:'col'},'At risk, $ per year'))), h('tbody',null, rows.map(r => h('tr',null,h('td',null,r.d.label),h('td',null,usd(r.s)))))))));
    }
    draw();
    const p = (A.param && A.param()) || ''; if (p){ setTimeout(() => { const el = document.getElementById('ol-'+p); if (el){ el.open = true; el.scrollIntoView({block:'start'}); } }, 0); }
  };

  function itemsCard(set){
    const groups = {};
    ITEMS.filter(i => i.applies.includes(set)).forEach(i => (groups[i.group] = groups[i.group] || []).push(i));
    const box = h('div',{class:'card'}, h('h2',null,'What\'s coming'), h('p',{class:'small muted'},'Likelihood and timing as of November 2026. Statuses are rechecked monthly with Regulatory Watch.'));
    Object.keys(groups).forEach(g => { box.append(h('h3',null,g));
      groups[g].forEach(i => box.append(h('details',{class:'item',id:'ol-'+i.id},
        h('summary',null, h('b',null,i.title), ' ', h('span',{class:'chip '+(LIK[i.likely]||'')},i.likely+' likelihood'), ' ', h('span',{class:'chip grey'},i.when)),
        h('p',null,i.what),
        i.todo.length ? h('div',null,h('b',{class:'small'},'Do now'),h('ul',null,i.todo.map(t => h('li',null,t)))) : null,
        h('p',{class:'small'}, h('span',{class:'chip '+(i.check==='Verified'?'calm':'grey')},i.check), ' ',
          i.src.map((s,n) => [n ? ' · ' : '', h('a',{href:s[1],target:'_blank',rel:'noopener'},s[0])]),
          i.watch ? [' · ', h('a',{href:'#/watch'},'Regulatory Watch')] : null,
          i.driver ? [' · ', h('span',{class:'muted'},'In the scenarios as "'+DRIVERS.find(d => d.id === i.driver).label+'"')] : null))));
    });
    return box;
  }

  window.SSOutlook = {ITEMS, byWatch:id => ITEMS.filter(i => i.watch === id)};
})();
