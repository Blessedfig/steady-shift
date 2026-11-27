// Steady Shift test app: Vendors (#/vendors) and Resident spending (#/resfunds).
// Managed vendors with contacts, contracts, recurring orders and purchases; per-resident personal funds,
// items bought for a resident, and charges to bill. Both feed Money and people sync (expense categories and
// QuickBooks files) and Sync and calendar. Test version: sample data only, kept in this browser.
(function(){
  const A = window.SSApp; if (!A) return;
  const {D, h, toast, fmtDate, head, download, csvCell, R, VIEWS, NAV, isoDay, addDays, uid} = A;
  const S = () => A.state();
  const money = n => (n < 0 ? '-$' : '$')+Math.abs(n).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2});
  const csv = rows => rows.map(r => r.map(csvCell).join(',')).join('\r\n')+'\r\n';
  const today = () => isoDay(new Date());
  const sid = () => S().site === 'family' ? 'maple' : S().site;
  const sname = id => (D.SITES.find(x => x.id === id)||{}).name || id;
  const CATS = ['Pharmacy','Supplies','PPE','Food','Equipment','Repairs and maintenance','Utilities','Insurance','Licenses and fees','Training','Other'];
  const EVERY = {week:7, '2weeks':14, month:30, quarter:91};
  const EVERY_T = {week:'Every week', '2weeks':'Every 2 weeks', month:'Every month', quarter:'Every 3 months'};

  // ---------- sample data ----------
  function seedVendors(){
    const t = today(), d = n => addDays(t, n);
    const V = (site, name, type, cat, extra) => Object.assign({id:'v-'+uid(), site, name, type, cat, contact:'', phone:'(sample) 555-01'+String(10+Math.floor(Math.random()*89)), email:'', account:'', terms:'Net 30', start:'', end:'', renew:'auto', phi:false, notes:'', recurring:[], active:true}, extra);
    const list = [];
    ['maple','birch','cedar'].forEach(s => {
      list.push(V(s,'Example Long-Term Care Pharmacy','Pharmacy','Pharmacy',{contact:'Pharmacist on duty', email:'orders@pharmacy.example', account:'LTC-'+s.toUpperCase(), start:'2025-01-01', end:d(s==='maple'?40:200), phi:true, notes:'Delivers blister packs weekly. Holds resident health information, so a BAA is needed once the app stores health data.',
        recurring:[{id:uid(), what:'Weekly med delivery (copays and non-covered items)', every:'week', next:d(3), amt:s==='birch'?64:38}]}));
      list.push(V(s,'Example Grocery Delivery','Groceries','Food',{contact:'Store manager', email:'help@grocery.example', terms:'Card on file', recurring:[{id:uid(), what:'Weekly grocery order', every:'week', next:d(2), amt:s==='birch'?410:265}]}));
      list.push(V(s,'Example Medical Supply Co.','Supplies','Supplies',{contact:'Account rep', email:'rep@medsupply.example', account:'MS-'+(4400+s.length), start:'2026-03-01', end:d(95),
        recurring:[{id:uid(), what:'Briefs, wipes and gloves', every:'month', next:d(9), amt:s==='birch'?520:315}]}));
    });
    list.push(V('maple','Example Heating and Cooling','Maintenance','Repairs and maintenance',{contact:'Service desk', start:'2026-01-15', end:d(50), renew:'manual', notes:'Furnace and AC service plan, 2 visits a year.', recurring:[{id:uid(), what:'Seasonal furnace and AC check', every:'quarter', next:d(24), amt:140}]}));
    list.push(V('maple','Example Electric and Gas','Utility','Utilities',{account:'UT-88231 (sample)', terms:'Autopay', recurring:[{id:uid(), what:'Electric and gas bill', every:'month', next:d(12), amt:312}]}));
    list.push(V('birch','Example Waste Service','Utility','Utilities',{terms:'Autopay', start:'2025-06-01', end:d(18), renew:'manual', recurring:[{id:uid(), what:'Trash and recycling', every:'month', next:d(5), amt:96}]}));
    list.push(V('birch','Example Fire Safety','Maintenance','Licenses and fees',{notes:'Sprinkler and alarm inspection; CBRF life safety.', start:'2026-02-01', end:d(70), renew:'manual', recurring:[{id:uid(), what:'Sprinkler and alarm inspection', every:'quarter', next:d(33), amt:225}]}));
    const purchases = [];
    list.forEach(v => v.recurring.forEach(r => { for (let k = 1; k <= 3; k++){ const dt = addDays(r.next, -EVERY[r.every]*k); if (dt >= addDays(t,-90)) purchases.push({id:'p-'+uid(), site:v.site, vendor:v.id, date:dt, amt:Math.round(r.amt*(0.9+Math.random()*0.2)*100)/100, note:r.what+' (sample)', cat:v.cat, res:'', billTo:'home'}); } }));
    return {v:1, list, purchases};
  }
  function seedFunds(){
    const t = today(), d = n => addDays(t, n);
    const E = (site, res, date, kind, amt, note, extra) => Object.assign({id:'f-'+uid(), site, res, date, kind, amt, note, receipt:kind!=='deposit', by:'House manager (sample)', witness:kind==='withdrawal'?'Caregiver B (sample)':''}, extra);
    const L = [
      E('maple','M-1',d(-28),'deposit',150,'Monthly spending money from family (sample)'),
      E('maple','M-1',d(-20),'withdrawal',18,'Haircut (sample)'),
      E('maple','M-1',d(-9),'withdrawal',24.5,'Puzzle books and lotion (sample)'),
      E('maple','M-2',d(-27),'deposit',100,'From guardian (sample)'),
      E('maple','M-2',d(-14),'withdrawal',32,'Slippers (sample)'),
      E('maple','M-3',d(-25),'deposit',75,'Personal needs money (sample)'),
      E('maple','M-4',d(-18),'charge',42,'New non-slip shoes bought by the home, to bill (sample)'),
      E('birch','B-5',d(-22),'deposit',200,'From family (sample)'),
      E('birch','B-5',d(-6),'withdrawal',15,'Snacks for an outing (sample)'),
      E('birch','B-9',d(-11),'charge',28.75,'Replacement hearing aid batteries, to bill (sample)')];
    const recurring = [{id:uid(), site:'maple', res:'M-1', what:'Haircut', every:'month', next:d(10), amt:18, from:'funds'},{id:uid(), site:'maple', res:'M-4', what:'Phone plan', every:'month', next:d(6), amt:25, from:'bill'},{id:uid(), site:'birch', res:'B-5', what:'Newspaper', every:'month', next:d(15), amt:12, from:'funds'}];
    return {v:1, ledger:L, recurring};
  }
  function vst(){ const s = S(); if (!s.vendors || s.vendors.v !== 1){ s.vendors = seedVendors(); A.save(); } return s.vendors; }
  function fst(){ const s = S(); if (!s.resfunds || s.resfunds.v !== 1){ s.resfunds = seedFunds(); A.save(); } return s.resfunds; }

  // ---------- shared reads (Money and people sync, Sync and calendar) ----------
  function purchases(site, from){ return vst().purchases.filter(p => p.site === site && (!from || p.date >= from) && p.billTo !== 'funds').map(p => { const v = vst().list.find(x => x.id === p.vendor); return {date:p.date, cat:p.cat, amt:p.amt, note:(v ? v.name+': ' : '')+p.note, vendor:v ? v.name : ''}; }); }
  function balance(site, res){ return fst().ledger.filter(e => e.site === site && e.res === res && e.kind !== 'charge').reduce((t,e) => t + (e.kind === 'deposit' ? e.amt : -e.amt), 0); }
  function charges(site, from, to){ return fst().ledger.filter(e => e.site === site && e.kind === 'charge' && e.date >= from && (!to || e.date <= to)); }
  window.SSVendors = {purchases, list:site => vst().list.filter(v => v.site === site)};
  window.SSResFunds = {balance, charges, ledger:(site, res) => fst().ledger.filter(e => e.site === site && (!res || e.res === res))};
  (window.SSCalendarFeeds = window.SSCalendarFeeds || []).push(ids => {
    const ev = [], horizon = addDays(today(), 45);
    vst().list.filter(v => ids.includes(v.site) && v.active).forEach(v => {
      if (v.end && v.end >= today() && v.end <= horizon) ev.push({id:'vend-'+v.id, kind:'Contract', who:'Owner', site:v.site, title:(v.renew==='auto'?'Contract renews: ':'Contract ends, decide on renewal: ')+v.name+' ('+sname(v.site)+')', date:addDays(v.end, -14) < today() ? today() : addDays(v.end, -14), time:null, dur:0, note:'Ends '+fmtDate(v.end)+'. Compare price and service before it renews.', link:'#/vendors'});
      v.recurring.filter(r => r.next <= addDays(today(), 14)).forEach(r => ev.push({id:'vord-'+r.id, kind:'Order', who:'House manager', site:v.site, title:r.what+': '+v.name+' ('+sname(v.site)+')', date:r.next, time:null, dur:0, note:'About '+money(r.amt)+'. Record it in Vendors when it arrives.', link:'#/vendors'}));
    });
    return ev;
  });

  // ---------- Vendors screen ----------
  R.vendors = v => {
    const st = vst(), here = sid(), mine = st.list.filter(x => x.site === here && x.active), t = today();
    const p90 = st.purchases.filter(p => p.site === here && p.date >= addDays(t,-90));
    const due = mine.flatMap(x => x.recurring.map(r => ({x, r}))).sort((a,b) => a.r.next.localeCompare(b.r.next));
    v.append(head('Money · '+sname(here), 'Vendors', 'Pharmacy, groceries, supplies, maintenance and utilities in one place: who to call, what the contract says, what is ordered every week or month, and what you spent. Test version: sample vendors.'));
    v.append(h('div',{class:'grid g3'},
      h('div',{class:'card'},h('div',{class:'stat'},h('b',null,String(mine.length)),h('span',null,'active vendors'))),
      h('div',{class:'card'},h('div',{class:'stat'},h('b',null,money(p90.reduce((a,p)=>a+p.amt,0))),h('span',null,'spent with vendors, last 90 days'))),
      h('div',{class:'card'},h('div',{class:'stat'},h('b',null,money(due.filter(d => EVERY[d.r.every] <= 30).reduce((a,d)=>a+d.r.amt*30/EVERY[d.r.every],0))),h('span',null,'expected each month from recurring orders')))));
    // coming up
    v.append(h('div',{class:'card'}, h('h2',null,'Recurring orders coming up'),
      h('div',{class:'list'}, due.slice(0,8).map(({x, r}) => { const late = r.next < t;
        return h('div',{class:'item'}, h('div',{class:'meta'}, h('span',{class:'chip '+(late?'amber':'')},late?'Was due '+fmtDate(r.next):fmtDate(r.next)), h('span',null,EVERY_T[r.every]), h('span',null,x.cat)), h('b',null,r.what+' · '+x.name),
          h('div',{class:'row'}, h('span',{class:'small'},'About '+money(r.amt)),
            h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ const a = prompt('Amount on the receipt ($)', String(r.amt)); if (a == null) return; const n = +a; if (!(n > 0)) return toast('Enter an amount');
              st.purchases.push({id:'p-'+uid(), site:here, vendor:x.id, date:t, amt:n, note:r.what, cat:x.cat, res:'', billTo:'home'}); r.next = addDays(r.next < t ? t : r.next, EVERY[r.every]); A.save(); toast('Recorded. Next one '+fmtDate(r.next)); A.route(); }},'It arrived, record it'),
            h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ r.next = addDays(r.next, EVERY[r.every]); A.save(); A.route(); }},'Skip this one'))); }))));
    // log purchase
    const vSel = h('select',{'aria-label':'Vendor'}, mine.map(x => h('option',{value:x.id},x.name)));
    const amt = h('input',{type:'number',min:'0',step:'0.01','aria-label':'Amount'}), dt = h('input',{type:'date',value:t,'aria-label':'Date'}), note = h('input',{type:'text',placeholder:'What it was (no resident names)','aria-label':'What it was'});
    const forRes = h('select',{'aria-label':'Bought for'}, h('option',{value:''},'The home'), (D.RESIDENTS[here]||[]).map(r => h('option',{value:r.code},'Resident '+r.code)));
    const billTo = h('select',{'aria-label':'Who pays'}, h('option',{value:'home'},'Home pays (expense)'), h('option',{value:'funds'},'From the resident\'s money we hold'), h('option',{value:'bill'},'Home pays, bill the resident'));
    const f = h('form',{class:'card'}, h('h2',null,'Log a purchase'),
      h('div',{class:'grid g2'}, h('label',{class:'f'},'Vendor',vSel), h('label',{class:'f'},'Amount ($)',amt), h('label',{class:'f'},'Date',dt), h('label',{class:'f'},'What it was',note), h('label',{class:'f'},'Bought for',forRes), h('label',{class:'f'},'Who pays',billTo)),
      h('button',{class:'btn sm',type:'submit',style:'justify-self:start'},'Save purchase'));
    f.addEventListener('submit', e => { e.preventDefault(); const n = +amt.value; if (!(n > 0)) return toast('Enter the amount'); const x = st.list.find(y => y.id === vSel.value);
      const res = forRes.value, pay = res ? billTo.value : 'home';
      st.purchases.push({id:'p-'+uid(), site:here, vendor:x.id, date:dt.value||t, amt:n, note:note.value.trim()||x.type, cat:x.cat, res, billTo:pay});
      if (res && pay !== 'home') fst().ledger.push({id:'f-'+uid(), site:here, res, date:dt.value||t, kind:pay==='funds'?'withdrawal':'charge', amt:n, note:(note.value.trim()||x.type)+' from '+x.name, receipt:true, by:A.tier().name+' (you)', witness:''});
      A.save(); toast(pay==='home'?'Saved as a home expense':'Saved to resident '+res+'\'s record'); A.route(); });
    v.append(f);
    // vendor cards
    const list = h('div',{class:'list'}, mine.map(x => { const spent = p90.filter(p => p.vendor === x.id).reduce((a,p)=>a+p.amt,0), soon = x.end && x.end <= addDays(t,60);
      return h('div',{class:'item'}, h('div',{class:'meta'}, h('span',{class:'chip'},x.type), h('span',{class:'chip grey'},x.cat), soon ? h('span',{class:'chip amber'},'Contract '+(x.renew==='auto'?'renews ':'ends ')+fmtDate(x.end)) : null, x.phi ? h('span',{class:'chip red'},'Health info: BAA needed') : null),
        h('b',null,x.name), h('span',{class:'small'},[x.contact, x.phone, x.email, x.account ? 'Account '+x.account : '', x.terms].filter(Boolean).join(' · ')),
        x.recurring.length ? h('span',{class:'small'},x.recurring.map(r => EVERY_T[r.every]+': '+r.what+' (about '+money(r.amt)+')').join('; ')) : null,
        x.notes ? h('span',{class:'small muted'},x.notes) : null,
        h('span',{class:'small'},'Spent last 90 days: '+money(spent)),
        h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ x.active = false; A.save(); toast('Moved to past vendors'); A.route(); }},'Stop using this vendor'))); }));
    // add vendor
    const nN = h('input',{type:'text','aria-label':'Vendor name'}), nT = h('select',{'aria-label':'Type'}, ['Pharmacy','Groceries','Supplies','Maintenance','Utility','Therapy or medical','Other'].map(x => h('option',null,x))), nC = h('select',{'aria-label':'Expense category'}, CATS.map(c => h('option',null,c)));
    const nP = h('input',{type:'text','aria-label':'Phone or email'}), nE = h('input',{type:'date','aria-label':'Contract end'}), nR = h('input',{type:'text','aria-label':'Recurring order'}), nRA = h('input',{type:'number',min:'0',step:'0.01','aria-label':'Recurring amount'}), nRE = h('select',{'aria-label':'How often'}, Object.keys(EVERY).map(k => h('option',{value:k},EVERY_T[k])));
    const add = h('form',{class:'grid g2'}, h('label',{class:'f'},'Name',nN), h('label',{class:'f'},'Type',nT), h('label',{class:'f'},'Expense category',nC), h('label',{class:'f'},'Phone or email',nP), h('label',{class:'f'},'Contract ends (optional)',nE),
      h('label',{class:'f'},'Recurring order (optional)',nR), h('label',{class:'f'},'Usual amount ($)',nRA), h('label',{class:'f'},'How often',nRE), h('button',{class:'btn sm',type:'submit',style:'justify-self:start'},'Add vendor'));
    nT.addEventListener('change', () => { nC.value = ({Pharmacy:'Pharmacy',Groceries:'Food',Supplies:'Supplies',Maintenance:'Repairs and maintenance',Utility:'Utilities'})[nT.value] || 'Other'; });
    add.addEventListener('submit', e => { e.preventDefault(); if (!nN.value.trim()) return toast('Name the vendor');
      st.list.push({id:'v-'+uid(), site:here, name:nN.value.trim(), type:nT.value, cat:nC.value, contact:'', phone:/@/.test(nP.value)?'':nP.value.trim(), email:/@/.test(nP.value)?nP.value.trim():'', account:'', terms:'', start:t, end:nE.value, renew:'manual', phi:/Pharmacy|Therapy/.test(nT.value), notes:'', active:true,
        recurring:nR.value.trim() ? [{id:uid(), what:nR.value.trim(), every:nRE.value, next:addDays(t, EVERY[nRE.value]), amt:+nRA.value||0}] : []});
      A.save(); toast('Vendor added'); A.route(); });
    const vendCsv = () => csv([['Name','Company','Email','Phone','Terms','Account No','Expense category','Contract end','Handles health info']].concat(mine.map(x => [x.name, x.name, x.email, x.phone, x.terms, x.account, x.cat, x.end, x.phi?'Yes':'No'])));
    const purCsv = () => csv([['Date','Vendor','Description','Amount','Category','Bought for','Who pays']].concat(st.purchases.filter(p => p.site === here).sort((a,b)=>a.date.localeCompare(b.date)).map(p => { const x = st.list.find(y => y.id === p.vendor); return [p.date, x?x.name:'', p.note, p.amt.toFixed(2), p.cat, p.res?'Resident '+p.res:'Home', ({home:'Home',funds:'Resident funds',bill:'Bill resident'})[p.billTo]]; })));
    v.append(h('div',{class:'card'}, h('h2',null,'Your vendors'), list,
      h('details',null, h('summary',null,'Add a vendor'), add),
      h('div',{class:'row'}, h('button',{class:'btn ghost sm',type:'button',onclick:()=>download('steady-shift-vendors.csv','text/csv',vendCsv())},'Vendor list for QuickBooks (.csv)'), h('button',{class:'btn quiet sm',type:'button',onclick:()=>download('steady-shift-vendor-purchases.csv','text/csv',purCsv())},'All purchases (.csv)'), h('a',{class:'btn quiet sm',href:'#/money'},'Money and people sync')),
      h('p',{class:'small muted'},'Purchases the home pays for are included in the QuickBooks expenses file on Money and people sync. Contract dates and orders show on Sync and calendar.')));
  };

  // ---------- Resident spending screen ----------
  const KIND = {deposit:['Money in','calm'], withdrawal:['Spent from their money',''], charge:['Bought by the home, to bill','amber']};
  R.resfunds = v => {
    const st = fst(), here = sid(), res = D.RESIDENTS[here] || [], t = today(), ms = t.slice(0,8)+'01';
    v.append(head('Money · '+sname(here), 'Resident spending', 'Each resident\'s own money the home holds, things bought for them, and charges to bill. Keep it separate from the home\'s money, keep every receipt, and let the resident or guardian see it any time. Test version: sample entries, resident codes only.'));
    const tb = h('table',{class:'t'}, h('thead',null,h('tr',null,['Resident','Money held','Spent this month','To bill this month',''].map(x => h('th',{scope:'col'},x)))));
    const body = h('tbody');
    const area = h('div');
    res.forEach(r => { const bal = balance(here, r.code), spent = st.ledger.filter(e => e.site === here && e.res === r.code && e.kind === 'withdrawal' && e.date >= ms).reduce((a,e)=>a+e.amt,0), bill = charges(here, ms).filter(e => e.res === r.code).reduce((a,e)=>a+e.amt,0);
      body.append(h('tr',null, h('td',null,r.code), h('td',null,h('span',{class:'chip '+(bal<0?'red':bal<20?'amber':'calm')},money(bal))), h('td',null,money(spent)), h('td',null,money(bill)), h('td',null,h('button',{class:'btn ghost sm',type:'button',onclick:()=>open(r.code)},'Open')))); });
    tb.append(body);
    v.append(h('div',{class:'card'}, h('div',{class:'tablewrap'},tb), h('p',{class:'small muted'},'A low balance is amber. A balance below zero means a purchase was taken from money that was not there; fix it before the next statement.')), area);
    // recurring personal expenses
    const rec = st.recurring.filter(x => x.site === here).sort((a,b) => a.next.localeCompare(b.next));
    v.append(h('div',{class:'card'}, h('h2',null,'Ongoing personal expenses'), rec.length ? h('div',{class:'list'}, rec.map(x => h('div',{class:'item'}, h('div',{class:'meta'}, h('span',{class:'chip'},fmtDate(x.next)), h('span',null,EVERY_T[x.every]), h('span',null,x.from==='funds'?'From their money':'Bill the resident')), h('b',null,'Resident '+x.res+' · '+x.what+' · '+money(x.amt)),
      h('button',{class:'btn ghost sm',type:'button',style:'justify-self:start',onclick:()=>{ st.ledger.push({id:'f-'+uid(), site:here, res:x.res, date:t, kind:x.from==='funds'?'withdrawal':'charge', amt:x.amt, note:x.what, receipt:false, by:A.tier().name+' (you)', witness:''}); x.next = addDays(x.next < t ? t : x.next, EVERY[x.every]); A.save(); toast('Recorded. Add the receipt when you have it.'); A.route(); }},'Record it now')))) : h('p',{class:'muted'},'None yet.')));
    function open(code){
      area.textContent = '';
      const L = st.ledger.filter(e => e.site === here && e.res === code).sort((a,b) => a.date.localeCompare(b.date));
      let run = 0;
      const lt = h('table',{class:'t'}, h('thead',null,h('tr',null,['Date','What','Type','Amount','Money held after','Receipt','Witness'].map(x => h('th',{scope:'col'},x)))),
        h('tbody',null, L.map(e => { if (e.kind !== 'charge') run += e.kind === 'deposit' ? e.amt : -e.amt; const rc = h('input',{type:'checkbox',checked:e.receipt,'aria-label':'Receipt kept'}); rc.addEventListener('change',()=>{ e.receipt = rc.checked; A.save(); });
          return h('tr',null, h('td',null,fmtDate(e.date)), h('td',null,e.note), h('td',null,h('span',{class:'chip '+KIND[e.kind][1]},KIND[e.kind][0])), h('td',null,(e.kind==='deposit'?'+':'')+money(e.kind==='deposit'?e.amt:-e.amt)), h('td',null,e.kind==='charge'?'–':money(run)), h('td',null,e.kind==='deposit'?'–':rc), h('td',null,e.witness||'–')); })));
      const kind = h('select',{'aria-label':'Type'}, Object.keys(KIND).map(k => h('option',{value:k},KIND[k][0]))), amt = h('input',{type:'number',min:'0',step:'0.01','aria-label':'Amount'}), note = h('input',{type:'text','aria-label':'What it was',placeholder:'Example: haircut, slippers, from family'}), wit = h('input',{type:'text','aria-label':'Witness',placeholder:'Second staff member (spending)'}), dt = h('input',{type:'date',value:t,'aria-label':'Date'});
      const f = h('form',{class:'grid g2'}, h('label',{class:'f'},'Type',kind), h('label',{class:'f'},'Amount ($)',amt), h('label',{class:'f'},'What it was',note), h('label',{class:'f'},'Date',dt), h('label',{class:'f'},'Witness',wit), h('button',{class:'btn sm',type:'submit',style:'align-self:end;justify-self:start'},'Add entry'));
      f.addEventListener('submit', ev => { ev.preventDefault(); const n = +amt.value; if (!(n > 0)) return toast('Enter the amount'); if (kind.value === 'withdrawal' && n > balance(here, code)) { if (!confirm('That is more than the money held. Save anyway?')) return; }
        st.ledger.push({id:'f-'+uid(), site:here, res:code, date:dt.value||t, kind:kind.value, amt:n, note:note.value.trim()||KIND[kind.value][0], receipt:kind.value!=='deposit' ? false : true, by:A.tier().name+' (you)', witness:wit.value.trim()}); A.save(); toast('Saved'); open(code); });
      const stmt = () => csv([['Statement for resident '+code+' (sample), '+sname(here)],['Date','What','Type','Amount','Money held after','Receipt kept','Recorded by','Witness']].concat((() => { let b = 0; return L.map(e => { if (e.kind !== 'charge') b += e.kind==='deposit'?e.amt:-e.amt; return [e.date, e.note, KIND[e.kind][0], (e.kind==='deposit'?e.amt:-e.amt).toFixed(2), e.kind==='charge'?'':b.toFixed(2), e.kind==='deposit'?'':(e.receipt?'Yes':'No'), e.by, e.witness]; }); })()));
      const card = h('div',{class:'card soft'}, h('h2',null,'Resident '+code), h('div',{class:'tablewrap'},lt),
        h('details',null,h('summary',null,'Add an entry'), f),
        h('div',{class:'row'}, h('button',{class:'btn ghost sm',type:'button',onclick:()=>download('steady-shift-statement-'+code+'.csv','text/csv',stmt())},'Statement for the resident or guardian (.csv)'), h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ area.textContent=''; }},'Close')),
        h('p',{class:'small muted'},'Money in and money spent stay in this ledger, not in the home\'s income or expenses. Charges to bill go on the resident\'s invoice in Money and people sync.'));
      area.append(card); card.scrollIntoView({behavior:'smooth'});
    }
  };

  VIEWS.vendors = {t:'Vendors', ic:'🚚'};
  VIEWS.resfunds = {t:'Resident spending', ic:'👛'};
  const addNav = (t, ids, after) => { const n = NAV[t]; if (!n) return; const at = after && n.indexOf(after) >= 0 ? n.indexOf(after)+1 : n.length; n.splice(at, 0, ...ids.filter(x => !n.includes(x))); };
  addNav('owner', ['vendors','resfunds'], 'money'); addNav('multi', ['vendors'], 'money'); addNav('manager', ['vendors','resfunds'], 'money');
  if (window.SSAccess && typeof SSAccess.register === 'function'){
    try { SSAccess.register({id:'vendors', name:'Vendors', ic:'🚚', what:'Vendor contacts, contracts, recurring orders and purchases.', views:['vendors'], tiers:['owner','multi','manager']});
      SSAccess.register({id:'resfunds', name:'Resident spending', ic:'👛', what:'Resident personal funds, items bought for residents and charges to bill.', views:['resfunds'], tiers:['owner','manager']}); } catch(e){ console.error(e); }
  }
  if (/^#\/(vendors|resfunds)/.test(location.hash) || document.getElementById('nav')?.children.length) { try { A.route(); } catch(e){} }
})();
