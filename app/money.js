// Steady Shift test app: Money and people sync (#/money).
// QuickBooks Online first, then Xero, Wave, FreshBooks; payroll to Gusto, ADP, Paychex.
// Test version: sample data only. Connect buttons are placeholders: in the live version the owner signs in to their
// accounting or payroll company on that company's own page (OAuth), and the tokens are kept on our server, never in the browser.
(function(){
  const A = window.SSApp; if (!A) return;
  const {D, h, toast, fmtDate, head, download, csvCell, R, VIEWS, NAV, isoDay, addDays} = A;
  const S = () => A.state();
  const site = () => A.site();
  const money = n => (n < 0 ? '-$' : '$')+Math.abs(n).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2});
  const csv = rows => rows.map(r => r.map(csvCell).join(',')).join('\r\n')+'\r\n';
  const mdy = iso => iso.slice(5,7)+'/'+iso.slice(8,10)+'/'+iso.slice(0,4);

  // ---------- sample data (fictional) ----------
  const BILLING = { // monthly rate per resident and who pays; codes only
    maple:[{res:'M-1',payer:'Family Care (MCO)',rate:4650},{res:'M-2',payer:'Family Care (MCO)',rate:5200},{res:'M-3',payer:'IRIS',rate:4900},{res:'M-4',payer:'Private pay',rate:5600}],
    birch:[{res:'B-2',payer:'Family Care (MCO)',rate:4300},{res:'B-5',payer:'Private pay',rate:5100},{res:'B-7',payer:'IRIS',rate:4450},{res:'B-9',payer:'Family Care (MCO)',rate:4800}],
    cedar:[{res:'C-1',payer:'Private pay',rate:5400},{res:'C-2',payer:'Family Care (MCO)',rate:4550}]
  };
  const PEOPLE = { // birthdays (month-day only) and hire dates; staff opt in to birthday reminders
    staff:[{n:'Caregiver A',site:'maple',bday:'12-03',hired:'2025-06-10',optin:true},{n:'Caregiver B',site:'maple',bday:'01-14',hired:'2022-12-01',optin:true},{n:'Caregiver C',site:'maple',bday:'11-29',hired:'2024-05-14',optin:false},
      {n:'Caregiver D',site:'maple',bday:'02-20',hired:'2025-01-20',optin:true},{n:'Caregiver F',site:'birch',bday:'12-11',hired:'2024-01-10',optin:true},{n:'Caregiver G',site:'birch',bday:'03-02',hired:'2023-12-05',optin:true},
      {n:'Caregiver J',site:'cedar',bday:'12-20',hired:'2024-04-04',optin:true},{n:'Manager',site:'maple',bday:'05-08',hired:'2024-09-09',optin:true}],
    residents:{'M-1':'12-08','M-2':'04-17','M-3':'12-26','M-4':'08-30','B-2':'12-15','B-5':'06-01','B-7':'01-09','B-9':'10-22','C-1':'12-02','C-2':'07-19'}
  };
  const APP_ACCOUNTS = [
    ['Supplies','Expense','Supplies & Materials'],['PPE','Expense','Supplies & Materials'],['Food','Expense','Resident Meals'],['Equipment','Expense','Equipment (under $2,500)'],
    ['Repairs and maintenance','Expense','Repairs & Maintenance'],['Utilities','Expense','Utilities'],['Insurance','Expense','Insurance'],['Licenses and fees','Expense','Licenses & Fees'],
    ['Training','Expense','Training & Education'],['Other','Expense','Other Business Expenses'],
    ['Family Care (MCO)','Income','Resident Care Income: Family Care'],['IRIS','Income','Resident Care Income: IRIS'],['Private pay','Income','Resident Care Income: Private Pay'],
    ['Caregiver wages','Payroll','Wages: Direct Care'],['Overtime','Payroll','Wages: Overtime']];
  function st(){
    const s = S();
    if (!s.money || s.money.v !== 1){
      s.money = {v:1, map:Object.fromEntries(APP_ACCOUNTS.map(a => [a[0], a[2]])), tool:'qbo', payroll:'gusto', paid:{}, log:[]};
      A.save();
    }
    return s.money;
  }
  function log(what){ const L = st().log; L.unshift({at:new Date().toISOString(), what}); L.splice(30); A.save(); }

  // ---------- sources ----------
  function expenses(sid, days){
    const from = addDays(isoDay(new Date()), -days);
    const ac = window.SSAcademy && SSAcademy.state ? SSAcademy.state() : S().academy;
    const own = ac && ac.exp ? ac.exp.filter(e => e.site === sid) : [];
    const food = (((S().care||{}).spend)||[]).filter(e => e.site === sid).map(e => ({date:e.date, cat:'Food', amt:e.amt, note:e.store||'Groceries'}));
    const all = own.concat(food).filter(e => e.date >= from).sort((a,b) => a.date.localeCompare(b.date));
    return all.length ? all : [{date:addDays(isoDay(new Date()),-12), cat:'Supplies', amt:84.12, note:'Briefs and wipes (sample)'},{date:addDays(isoDay(new Date()),-6), cat:'PPE', amt:41.5, note:'Gloves (sample)'},{date:addDays(isoDay(new Date()),-3), cat:'Food', amt:212.4, note:'Groceries (sample)'}];
  }
  function lastWeekStart(){ const d = new Date(); d.setDate(d.getDate() - d.getDay() - 7); return isoDay(d); }
  function payrollRows(sid){
    const ws = lastWeekStart();
    if (window.SSTime && window.SSSched){
      try {
        const n0 = SSSched.dn(ws);
        const rows = SSSched.staffNames(sid).map(n => { const t = SSTime.weekTotals(sid, n, n0); return {n, reg:t.reg/60, ot:t.ot/60, pto:t.pto, rate:t.rate}; }).filter(r => r.reg + r.ot + r.pto > 0);
        if (rows.length) return {ws, rows, sample:false};
      } catch(e){ console.error(e); }
    }
    const staff = (S().staff[sid]||[]).map(p => p.n);
    return {ws, sample:true, rows:staff.map((n,i) => ({n, reg:[36,40,24,32,40,38][i%6], ot:[0,4.5,0,0,2,0][i%6], pto:[0,0,8,0,0,0][i%6], rate:18+i}))};
  }
  function monthStart(){ const d = new Date(); return isoDay(new Date(d.getFullYear(), d.getMonth(), 1)); }
  function billing(sid){ return BILLING[sid] || []; }

  // ---------- exports ----------
  function expCsv(sid){ // QuickBooks Online bank upload: Date, Description, Amount (spending is negative)
    const m = st().map;
    return csv([['Date','Description','Amount','Category']].concat(expenses(sid,30).map(e => [mdy(e.date), e.note || e.cat, (-e.amt).toFixed(2), m[e.cat] || m.Other])));
  }
  function invCsv(sid){ // QuickBooks Online invoice import (private pay only)
    const ms = monthStart(), due = addDays(ms, 14), m = st().map; let no = 1001;
    return csv([['InvoiceNo','Customer','InvoiceDate','DueDate','Item(Product/Service)','ItemDescription','ItemQuantity','ItemRate','ItemAmount']]
      .concat(billing(sid).filter(b => b.payer === 'Private pay').map(b => [String(no++), 'Resident '+b.res+' (sample)', mdy(ms), mdy(due), m['Private pay'], 'Room, board and care, '+fmtDate(ms).replace(/ \d+,/,''), '1', b.rate.toFixed(2), b.rate.toFixed(2)])));
  }
  function depCsv(sid){ // expected MCO and IRIS payments, as deposits
    const m = st().map, ms = monthStart();
    return csv([['Date','Description','Amount','Category','Status']].concat(billing(sid).filter(b => b.payer !== 'Private pay').map(b => [mdy(addDays(ms, 20)), b.payer+' payment, resident '+b.res+' (sample)', b.rate.toFixed(2), m[b.payer], st().paid[sid+b.res+ms] ? 'Received' : 'Expected'])));
  }
  function payCsv(sid){
    const p = payrollRows(sid), tool = st().payroll;
    const headr = tool === 'gusto' ? ['Employee','Regular Hours','Overtime Hours','PTO Hours','Pay Period Start','Pay Period End'] : tool === 'adp' ? ['Co Code','Batch ID','File #','Employee Name','Reg Hours','O/T Hours','Hours 3 Code','Hours 3 Amount','Period Start'] : ['Employee Name','Regular Hours','Overtime Hours','PTO Hours','Period Start','Period End'];
    const end = addDays(p.ws, 6);
    return csv([headr].concat(p.rows.map((r,i) => tool === 'adp' ? ['(your code)','SS'+p.ws.replace(/-/g,''), String(100+i), r.n, r.reg.toFixed(2), r.ot.toFixed(2), r.pto ? 'PTO' : '', r.pto ? r.pto.toFixed(2) : '', mdy(p.ws)] : tool === 'gusto' ? [r.n, r.reg.toFixed(2), r.ot.toFixed(2), r.pto.toFixed(2), mdy(p.ws), mdy(end)] : [r.n, r.reg.toFixed(2), r.ot.toFixed(2), r.pto.toFixed(2), mdy(p.ws), mdy(end)])));
  }
  function coaCsv(){ const m = st().map; return csv([['Steady Shift category','Type','Your account']].concat(APP_ACCOUNTS.map(a => [a[0], a[1], m[a[0]]]))); }

  // ---------- birthdays, anniversaries and staff insights (feeds Sync and calendar) ----------
  function nextDate(md){ const t = isoDay(new Date()); let y = +t.slice(0,4); let d = y+'-'+md; if (d < t) d = (y+1)+'-'+md; return d; }
  function peopleEvents(ids){
    const nm = id => (D.SITES.find(s => s.id === id)||{}).name || id;
    const ev = [], horizon = addDays(isoDay(new Date()), 45);
    PEOPLE.staff.filter(p => ids.includes(p.site)).forEach(p => {
      const b = nextDate(p.bday);
      if (p.optin && b <= horizon) ev.push({id:'bday-'+p.n.replace(/\W/g,''), kind:'Birthday', who:'House manager', site:p.site, title:'Birthday: '+p.n+' ('+nm(p.site)+')', date:b, time:null, dur:0, note:'Staff birthday. Shared because they said yes to birthday reminders.', link:'#/money'});
      const a = nextDate(p.hired.slice(5)), yrs = +a.slice(0,4) - +p.hired.slice(0,4);
      if (yrs > 0 && a <= horizon) ev.push({id:'anniv-'+p.n.replace(/\W/g,''), kind:'Work anniversary', who:'House manager', site:p.site, title:yrs+' year'+(yrs>1?'s':'')+' at the home: '+p.n, date:a, time:null, dur:0, note:'A good day to say thank you.', link:'#/money'});
    });
    Object.entries(PEOPLE.residents).forEach(([code, md]) => {
      const sid = ({M:'maple',B:'birch',C:'cedar'})[code[0]]; if (!ids.includes(sid)) return;
      const b = nextDate(md); if (b <= horizon) ev.push({id:'rbday-'+code, kind:'Birthday', who:'House manager', site:sid, title:'Resident birthday ('+nm(sid)+')', date:b, time:null, dur:0, note:'Which resident is in Steady Shift. Calendars never get resident names.', link:'#/money'});
    });
    return ev;
  }
  window.SSPeopleDates = peopleEvents;

  // ---------- screen ----------
  const TOOLS = {qbo:['QuickBooks Online','Most small homes. Free API; owner signs in once.'], xero:['Xero','Free API; owner signs in once.'], wave:['Wave','Free for small businesses; limited API, CSV works.'], freshbooks:['FreshBooks','API with owner sign-in.'], desktop:['QuickBooks Desktop','No cloud sign-in; use the CSV files (or IIF on request).']};
  const PAYROLL = {gusto:['Gusto','Hours import file now; partner API later.'], adp:['ADP (RUN or Workforce Now)','Hours import file; API through ADP Marketplace.'], paychex:['Paychex Flex','Hours import file; API through Paychex partners.'], other:['Other payroll','Generic hours file.']};
  R.money = v => {
    const s = st(), sid = S().site === 'family' ? 'maple' : S().site, sname = (D.SITES.find(x => x.id === sid)||{}).name;
    v.append(head('Connect your tools', 'Money and people sync', 'Send expenses, resident billing and time sheets to your accounting and payroll, and bring the actuals back to the owner view. Test version: sample data only.'));
    // connect
    const toolSel = h('select',{'aria-label':'Accounting software'}, Object.keys(TOOLS).map(k => h('option',{value:k,selected:k===s.tool},TOOLS[k][0])));
    const paySel = h('select',{'aria-label':'Payroll company'}, Object.keys(PAYROLL).map(k => h('option',{value:k,selected:k===s.payroll},PAYROLL[k][0])));
    toolSel.addEventListener('change', () => { s.tool = toolSel.value; A.save(); A.route(); });
    paySel.addEventListener('change', () => { s.payroll = paySel.value; A.save(); A.route(); });
    v.append(h('div',{class:'card'}, h('h2',null,'Your accounting and payroll'),
      h('div',{class:'grid g2'}, h('label',{class:'f'},'Accounting',toolSel), h('label',{class:'f'},'Payroll',paySel)),
      h('p',{class:'small'},TOOLS[s.tool][1]+' '+PAYROLL[s.payroll][1]),
      h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',disabled:true,title:'Coming in the live version'},'Connect '+TOOLS[s.tool][0]), h('span',{class:'small muted'},'In the live version the owner signs in on '+TOOLS[s.tool][0]+'\'s own page. Steady Shift never sees the password, and the access key stays on our server.')),
      h('p',{class:'small muted'},'Until then, the files below import into each tool by hand. All amounts are sample numbers for '+sname+'.')));
    // chart of accounts
    const tb = h('table',{class:'t'}, h('thead',null,h('tr',null,['Steady Shift','Type','Your account in '+TOOLS[s.tool][0]].map(x => h('th',{scope:'col'},x)))));
    const body = h('tbody');
    APP_ACCOUNTS.forEach(a => { const i = h('input',{type:'text','aria-label':'Account for '+a[0]}); i.value = s.map[a[0]]; i.addEventListener('change', () => { s.map[a[0]] = i.value.trim() || a[2]; A.save(); toast('Saved'); });
      body.append(h('tr',null,h('td',null,a[0]),h('td',null,a[1]),h('td',null,i))); });
    tb.append(body);
    v.append(h('details',{class:'card'}, h('summary',null,h('b',null,'Match your chart of accounts')), h('p',{class:'small muted'},'Type the account name exactly as it appears in your books. Every export uses these names.'), h('div',{class:'tablewrap'},tb),
      h('button',{class:'btn quiet sm',type:'button',style:'justify-self:start',onclick:()=>download('steady-shift-account-map.csv','text/csv',coaCsv())},'Download the matching list')));
    // send
    const exp = expenses(sid,30), expT = exp.reduce((t,e) => t+e.amt, 0);
    const bill = billing(sid), priv = bill.filter(b => b.payer === 'Private pay'), mco = bill.filter(b => b.payer !== 'Private pay');
    const pr = payrollRows(sid), prT = pr.rows.reduce((t,r) => t + r.reg*r.rate + r.ot*r.rate*1.5, 0);
    const item = (title, sub, amt, btn, fn, file) => h('div',{class:'item'}, h('div',{class:'meta'}, h('span',{class:'chip'},amt), h('span',null,sub)), h('b',null,title),
      h('div',{class:'row'}, h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ download(file,'text/csv',fn()); log(btn+' ('+sname+')'); }},btn)));
    v.append(h('div',{class:'card'}, h('h2',null,'Send to your books'),
      h('div',{class:'list'},
        item('Expenses, last 30 days', exp.length+' expenses from Inventory and expenses and groceries', money(expT), 'Bank upload file (.csv)', () => expCsv(sid), 'steady-shift-expenses.csv'),
        item('Private-pay invoices, this month', priv.length+' resident'+(priv.length===1?'':'s')+', due in 14 days', money(priv.reduce((t,b)=>t+b.rate,0)), 'Invoice import file (.csv)', () => invCsv(sid), 'steady-shift-invoices.csv'),
        item('Family Care and IRIS payments expected', mco.length+' residents; mark them received when the deposit lands', money(mco.reduce((t,b)=>t+b.rate,0)), 'Deposits file (.csv)', () => depCsv(sid), 'steady-shift-deposits.csv'),
        item('Hours for payroll, week of '+fmtDate(pr.ws), pr.rows.length+' staff'+(pr.sample?' (sample hours; approve time sheets to use real ones)':' from approved time sheets'), money(prT)+' est.', PAYROLL[s.payroll][0]+' hours file (.csv)', () => payCsv(sid), 'steady-shift-hours-'+s.payroll+'.csv')),
      h('p',{class:'small muted'},'Invoices and deposits use resident codes here. Real billing names a person and counts as health information, so it waits for the privacy foundation and signed agreements.')));
    // MCO / IRIS tracker
    const ms = monthStart();
    const trk = h('div',{class:'list'}, mco.map(b => { const key = sid+b.res+ms, got = !!s.paid[key];
      return h('div',{class:'item'}, h('div',{class:'meta'}, h('span',{class:'chip '+(got?'calm':'amber')},got?'Received':'Expected'), h('span',null,b.payer)), h('b',null,'Resident '+b.res+' · '+money(b.rate)),
        h('button',{class:'btn quiet sm',type:'button',style:'justify-self:start',onclick:()=>{ s.paid[key] = !got; A.save(); A.route(); }}, got ? 'Undo' : 'Mark received')); }));
    v.append(h('details',{class:'card'}, h('summary',null,h('b',null,'Family Care and IRIS payments this month')), h('p',{class:'small muted'},'Later this fills itself from bank feeds or the payment notices in your books.'), trk));
    // actuals
    const inc = bill.reduce((t,b) => t+b.rate, 0), payM = prT*4.33, net = inc - expT - payM;
    v.append(h('div',{class:'card'}, h('h2',null,'Owner money view: this month (sample)'),
      h('div',{class:'grid g4'},
        h('div',{class:'stat good'},h('b',null,money(inc)),h('span',null,'resident income billed')),
        h('div',{class:'stat'},h('b',null,money(payM)),h('span',null,'payroll (estimated from hours)')),
        h('div',{class:'stat'},h('b',null,money(expT)),h('span',null,'supplies, food and other')),
        h('div',{class:'stat '+(net>=0?'good':'warnc')},h('b',null,money(net)),h('span',null,'left before rent, taxes and owner pay'))),
      h('p',{class:'small muted'},'Once connected, these come from your books instead of estimates, so the owner view shows real profit per home and per resident day.')));
    // people
    const pe = peopleEvents([sid]).sort((a,b) => a.date.localeCompare(b.date));
    const staffHere = PEOPLE.staff.filter(p => p.site === sid);
    const ins = staffHere.map(p => { const r = pr.rows.find(x => x.n === p.n); const yrs = Math.floor((new Date() - new Date(p.hired)) / (365.25*864e5));
      return h('tr',null, h('td',null,p.n), h('td',null,yrs < 1 ? 'Under 1 year' : yrs+' yr'), h('td',null, r ? (r.reg+r.ot).toFixed(1)+' h'+(r.ot ? ' ('+r.ot.toFixed(1)+' OT)' : '') : '–'), h('td',null, p.optin ? fmtDate(nextDate(p.bday)) : 'Not shared')); });
    v.append(h('div',{class:'card'}, h('h2',null,'People: birthdays, anniversaries and staff insights'),
      pe.length ? h('div',{class:'list'}, pe.map(e => h('div',{class:'item'}, h('div',{class:'meta'}, h('span',{class:'chip'},e.kind), h('span',null,fmtDate(e.date))), h('b',null,e.title)))) : h('p',{class:'muted'},'Nothing in the next 45 days.'),
      h('div',{class:'tablewrap'}, h('table',{class:'t'}, h('thead',null,h('tr',null,['Staff (sample)','Time at the home','Hours last week','Birthday'].map(x => h('th',{scope:'col'},x)))), h('tbody',null,ins))),
      h('p',{class:'small muted'},'Staff birthdays show only for people who said yes. Resident birthdays go to calendars as "Resident birthday" with no name. These dates also appear on Sync and calendar.'),
      h('a',{class:'btn ghost sm',href:'#/sync',style:'justify-self:start'},'Add them to a calendar')));
    if (s.log.length) v.append(h('details',{class:'card'}, h('summary',null,'Export history'), h('ul',{class:'small'}, s.log.map(l => h('li',null,new Date(l.at).toLocaleString()+' · '+l.what)))));
  };
  VIEWS.money = {t:'Money and people sync', ic:'💵'};
  ['owner','multi'].forEach(t => { const n = NAV[t]; if (n && !n.includes('money')){ const i = n.indexOf('owner'); n.splice(i >= 0 ? i+1 : n.length, 0, 'money'); } });
  if (NAV.manager && !NAV.manager.includes('money')) NAV.manager.push('money');
  if (window.SSAccess && typeof SSAccess.register === 'function'){
    try { SSAccess.register({id:'money', name:'Money and people sync', ic:'💵', what:'Exports to QuickBooks and payroll, payment tracking, birthdays and staff insights.', views:['money'], tiers:['owner','multi','manager']}); } catch(e){ console.error(e); }
  }
  // If the app already drew its first screen before this file loaded, draw again so this screen and its menu item show.
  if (/^#\/money/.test(location.hash) || document.getElementById('nav')?.children.length) { try { A.route(); } catch(e){} }
})();
