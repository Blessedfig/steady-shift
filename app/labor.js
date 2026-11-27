// Steady Shift test app: owner-only labor and pay view with recommendations. Sample data only.
// Pay is visible to owners only, and every opening of this screen is written to the change log.
// Framed as staffing and fairness: no individual productivity scores.
(function(){
  const A = window.SSApp, X = window.SSSched, T = window.SSTime; if (!A || !X || !T) return;
  const {D, h, head, R, download, csvCell} = A;
  const S = () => A.state();
  const ap = (el, ...k) => { el.append(...k.flat(9).filter(x => x != null && x !== false)); return el; };
  const {dn, di, todayN, absA, absB, hrs, dayFmt, weekStartOf, staffNames, prof, shiftsAt, siteObj} = X;
  const SD = D.SCHED;
  const $ = n => '$'+Math.round(n).toLocaleString();
  const $2 = n => '$'+(Math.round(n*100)/100).toFixed(2);
  const WPM = 4.33; // weeks per month

  const OWNER = () => ['owner','multi'].includes(S().tier);
  function inputs(){ const s = S(); s.labor = Object.assign({agency:38, hireCost:1500, turnover:3500, beforeHrs:5, raise:1}, s.labor||{}); return s.labor; }
  const roleOf = n => n === 'Manager' ? 'House manager' : prof(n).lead ? 'Lead caregiver' : 'Caregiver';
  const ROLE_ORDER = ['Caregiver','Lead caregiver','House manager','Manager','RN'];

  // The last 4 full weeks (this week is still in progress).
  function weeks(){ const w0 = weekStartOf(todayN(), 0); return [w0-28, w0-21, w0-14, w0-7]; }
  function people(sites, W){
    const out = [];
    sites.forEach(site => {
      staffNames(site).forEach(n => {
        const wk = W.map(ws => T.weekTotals(site, n, ws));
        const p = prof(n), rate = p.rate || 18;
        out.push({site, n, role:roleOf(n), rate, kind:'hourly', wk,
          work:wk.reduce((t,x) => t+x.work, 0)/60, plan:wk.reduce((t,x) => t+x.plan, 0)/60, ot:wk.reduce((t,x) => t+x.ot, 0)/60,
          pay:wk.reduce((t,x) => t+x.cost, 0), near:wk.filter(x => x.work/60 >= 38).length, otWeeks:wk.filter(x => x.ot > 0).length});
      });
      SD.payExtra.filter(x => x.site === site).forEach(x => {
        const weekly = x.kind === 'salary' ? x.annual/52 : x.rate*x.hrsWeek;
        out.push({site, n:x.n, role:x.role, rate:x.kind === 'salary' ? x.annual/2080 : x.rate, kind:x.kind, annual:x.annual, work:x.kind === 'salary' ? 160 : x.hrsWeek*4, plan:0, ot:0, pay:weekly*4, near:0, otWeeks:0, wk:[]});
      });
    });
    return out;
  }
  // Manager time spent on scheduling: an estimate from what the app recorded, at set minutes per task.
  function mgrTime(sites, W){
    const from = di(W[0]), to = di(W[3]+7);
    const req = X.ensure().requests.filter(r => sites.includes(r.site) && r.decidedAt && r.decidedAt.slice(0,10) >= from && r.decidedAt.slice(0,10) < to).length;
    const calls = X.ensure().shifts.filter(s => sites.includes(s.site) && s.callin && s.date >= from && s.date < to).length;
    const fixes = T.ensure().editReqs.filter(q => sites.includes(q.site) && q.status !== 'Pending').length;
    const edits = (S().audit||[]).filter(a => sites.includes(a.site) && /shift|week|Quick assign|Repeated|Copied|Moved/.test(a.what) && a.at.slice(0,10) >= from).length;
    const min = sites.length*4*45 + req*6 + calls*25 + fixes*5 + edits*2;
    return {hours:min/60/4, req, calls, fixes, edits, perWeekBase:45};
  }
  function callPattern(sites){
    const map = {};
    X.ensure().shifts.filter(s => sites.includes(s.site) && s.callin).forEach(s => { const k = siteObj(s.site).name+'|'+['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(s.date+'T12:00:00').getDay()]+'|'+X.tShort(s.start); map[k] = (map[k]||0) + 1; });
    return Object.entries(map).sort((a,b) => b[1]-a[1]);
  }

  function recs(sites, P, W, mt){
    const I = inputs(), out = [];
    const hourly = P.filter(p => p.kind === 'hourly' && p.wk.length);
    // 1. overtime hotspots and room to share hours
    const hot = hourly.filter(p => p.otWeeks >= 2 || p.near >= 3);
    const otHrsWk = hourly.reduce((t,p) => t+p.ot, 0)/4;
    const otPremWk = hourly.reduce((t,p) => t+p.ot*p.rate*0.5, 0)/4;
    if (hot.length){
      const room = hourly.filter(p => p.work/4 < 30 && p.role !== 'House manager' && prof(p.n).alone);
      out.push({grp:'ot', title:'Share overtime hours more evenly', save:otPremWk*WPM*0.6,
        why:hot.map(p => p.n+' ('+siteObj(p.site).name+') averaged '+Math.round(p.work/4)+' hours a week and went over 40 in '+p.otWeeks+' of 4 weeks.').join(' '),
        what:room.length ? 'Offer some of those hours first to people with room: '+room.map(p => p.n+' (about '+Math.round(p.work/4)+' hours a week)').join(', ')+'. Ask before assigning. Some people want the extra hours, and that is fine when it is their choice.' : 'No one has much room right now, which points to a hiring need (see below).',
        how:'About 60% of the overtime premium ('+$(otPremWk)+' a week across '+Math.round(otHrsWk)+' overtime hours) could be avoided by giving those hours to people under 40.'});
    }
    // 2. templates: 12s that add up to 48
    sites.forEach(site => {
      const sh = shiftsAt(site).filter(s => s.staff && s.kind !== 'training' && dn(s.date) >= W[0] && dn(s.date) < W[3]+7);
      const twelve = sh.filter(s => absB(s)-absA(s) >= 720).length;
      if (twelve / Math.max(1, sh.length) < 0.6) return;
      const ot = hourly.filter(p => p.site === site).reduce((t,p) => t+p.ot, 0)/4;
      if (ot < 4) return;
      const avgRate = hourly.filter(p => p.site === site).reduce((t,p,_,a) => t+p.rate/a.length, 0);
      out.push({grp:'ot', title:siteObj(site).name+': 12-hour shifts are pushing people to 48 hours', save:ot*avgRate*0.5*WPM,
        why:'Three 12-hour shifts make 36 hours, but a fourth makes 48, so every extra 12 creates 8 overtime hours. This home averaged '+Math.round(ot)+' overtime hours a week.',
        what:'Cover the extra shift with a part-time person (one or two 12s a week), or split it into two 6-hour shifts so no one goes past 40. Keep 12s where staff prefer them; this is only about the extra shift.',
        how:'Moving those '+Math.round(ot)+' hours to straight time saves the half-time premium at about '+$2(avgRate)+' an hour.'});
    });
    // 3. call-off patterns
    const pat = callPattern(sites), calls = pat.reduce((t,x) => t+x[1], 0);
    if (calls){
      const per = calls/5*WPM, mgrRate = 28;
      out.push({title:'Plan for the call-offs you can predict', save:per*(25/60*mgrRate + 12*18*0.5)*0.4,
        why:calls+' call-offs in the last 5 weeks. Most common: '+pat.slice(0,3).map(([k,n]) => { const [hm, day, t] = k.split('|'); return day+' '+t+' at '+hm+' ('+n+')'; }).join(', ')+'.',
        what:'Keep a short, voluntary standby list for those shifts, with a small standby bonus. Make swaps easy in the app so people trade instead of calling off. Never ask why someone called off; that stays private.',
        how:'Each last-minute call-off takes about 25 minutes of manager time and often becomes overtime. Planning ahead could remove about 40% of that cost.'});
    }
    // 4. agency or overtime vs hiring a part-timer
    const gaps = sites.reduce((t,site) => t + X.check(site, W[0], W[3]+6).filter(i => (i.cat === 'Coverage' || i.cat === 'Awake overnight') && i.b).reduce((u,i) => u+(i.b-i.a)*(i.short||1), 0), 0)/60/4;
    const need = otHrsWk + gaps;
    if (need >= 8){
      const avg = hourly.filter(p => p.role === 'Caregiver').reduce((t,p,_,a) => t+p.rate/a.length, 0) || 18;
      const agencyCost = gaps*I.agency*WPM + otHrsWk*avg*1.5*WPM;
      const hireCost = need*avg*WPM;
      const monthly = agencyCost - hireCost;
      out.push({grp:'ot', title:'Hire a part-timer instead of paying for overtime and agency staff', save:Math.max(0, monthly),
        why:'About '+Math.round(need)+' hours a week are covered by overtime ('+Math.round(otHrsWk)+') or left short ('+Math.round(gaps)+'). Short hours usually become agency shifts or a manager covering the floor.',
        what:'Hire one part-time caregiver for about '+Math.round(need)+' hours a week. Hiring and training cost about '+$(I.hireCost)+' once (change it below), so it pays for itself in about '+(monthly > 0 ? Math.max(1, Math.ceil(I.hireCost/monthly)) : '–')+' month'+(monthly > 0 && Math.ceil(I.hireCost/monthly) === 1 ? '' : 's')+'.',
        how:'Today: '+$(agencyCost)+' a month (agency at '+$2(I.agency)+' an hour, overtime at 1.5 times). With a part-timer at '+$2(avg)+' an hour: '+$(hireCost)+' a month.'});
    }
    // 5. wages vs benchmarks (retention). Uses the shared pay table (wages-data.js) when present.
    const cg = hourly.filter(p => p.role === 'Caregiver' || p.role === 'Lead caregiver');
    if (cg.length){
      const WG = window.SS_WAGES, fs = (S().facility||{}), cty = (sites.map(id => (fs[id]&&fs[id].profile||{}).county).find(Boolean)) || '';
      const county = cty || 'Marathon';
      let lines, floor = 18.91, floorName = 'Wausau-area healthcare support mean', link = null, areaName = 'Wausau';
      if (WG && WG.lookup){
        const L = ['cna','pca'].map(r => WG.lookup(r, county)), got = L.filter(x => x.hourly && x.hourly.median);
        areaName = L[0].areaName;
        lines = L.map(x => x.label+': '+(x.hourly && x.hourly.median ? $2(x.hourly.median)+' '+x.areaName+' median' : (x.anchor ? $2(x.anchor.median)+' '+x.anchor.where : 'not loaded yet')));
        if (L[0].area === 'wausau') lines = lines.concat(WG.GROUP.map(g => 'Wausau '+g.label.toLowerCase()+' '+$2(g.hourly)+' ('+g.period+')'));
        if (got.length){ floor = Math.min(...got.map(x => x.hourly.median)); floorName = areaName+' median for '+got.map(x => x.label.toLowerCase()).join(' and '); }
        else if (L[0].area !== 'wausau'){ floor = Math.min(...L.filter(x => x.anchor).map(x => x.anchor.median)); floorName = 'U.S. median for personal care aides'; }
        if (L.some(x => x.check)) link = {href:L[0].url, text:'Check '+areaName+' pay on the BLS site'};
      } else lines = SD.bench.map(b => b.label+' '+$2(b.hourly)+' ('+b.period+')');
      const avg = cg.reduce((t,p) => t+p.rate, 0)/cg.length, low = cg.filter(p => p.rate < floor);
      const raiseCost = low.length*I.raise*(low.reduce((t,p) => t+p.work, 0)/Math.max(1,low.length)/4)*WPM;
      out.push({title:'Check pay against the area, to keep good staff', save:0, invest:raiseCost, link,
        why:'Caregivers here average '+$2(avg)+' an hour. Public figures: '+lines.join('; ')+'. '+low.length+' caregiver'+(low.length === 1 ? ' is' : 's are')+' under the '+floorName+'.'+(cty ? '' : ' No county is set for this home yet, so this uses Marathon County (Wausau) as a sample. Add it in Facility setup.'),
        what:'A '+$2(I.raise)+' an hour raise for those '+low.length+' would cost about '+$(raiseCost)+' a month. Replacing one caregiver costs about '+$(I.turnover)+' (hiring, training and overtime while short), so it breaks even if it prevents one departure every '+(raiseCost ? Math.max(1, Math.round(I.turnover/raiseCost)) : '–')+' months.',
        how:'Benchmarks are U.S. Bureau of Labor Statistics figures'+(WG ? ', from the shared pay table' : '')+'. '+(link ? 'Area figures for your county are not loaded yet, so check them before deciding. ' : '')+'Pay decisions are yours; this is context, not advice.'});
    }
    // 6. manager time
    const mgrRate = (P.find(p => p.role === 'House manager' || p.role === 'Manager')||{rate:28}).rate;
    const saved = Math.max(0, I.beforeHrs*sites.length - mt.hours);
    out.push({title:'Manager time on schedules', save:saved*mgrRate*WPM, kind:'time',
      why:'Estimated '+(Math.round(mt.hours*10)/10)+' manager hours a week on scheduling, from what the app recorded: '+mt.req+' requests answered, '+mt.calls+' call-offs covered, '+mt.fixes+' time fixes and '+mt.edits+' schedule edits in 4 weeks, plus about 45 minutes a week per home to build and publish.',
      what:'Before the app you estimated '+I.beforeHrs+' hours a week per home (change it below). Use the saved time on the floor, training or rest. Letting a lead build the schedule (Services and access) moves more of it off the manager.',
      how:'Saved hours times the manager\'s hourly cost ('+$2(mgrRate)+').'});
    return out.sort((a,b) => (b.save||0) - (a.save||0));
  }

  let lastLog = 0;
  R.labor = v => {
    v.classList.add('wide');
    if (!OWNER()){ ap(v, head('Labor and pay', 'Pay is visible to owners only', 'Switch "View as" to Owner. Managers can see hours and overtime in Time sheets and Owner insights, without pay rates.')); return; }
    X.ensure(); T.ensure();
    const all = S().site === 'family' || X.ensure().ui.insAll;
    const sites = all ? D.SITES.filter(s => s.id !== 'family').map(s => s.id) : [S().site];
    if (Date.now() - lastLog > 60000){ lastLog = Date.now(); X.audit('Opened Labor and pay ('+(all ? 'all homes' : siteObj(sites[0]).name)+')', sites[0]); A.save(); }
    const W = weeks(), P = people(sites, W), mt = mgrTime(sites, W), I = inputs();
    const total = P.reduce((t,p) => t+p.pay, 0), otCost = P.reduce((t,p) => t+p.ot*p.rate*1.5, 0), otPrem = P.reduce((t,p) => t+p.ot*p.rate*0.5, 0);
    const worked = P.filter(p => p.kind === 'hourly' && p.wk.length).reduce((t,p) => t+p.work, 0), plan = P.reduce((t,p) => t+p.plan, 0);
    const R0 = recs(sites, P, W, mt), saveSum = R0.filter(r => r.grp !== 'ot').reduce((t,r) => t+(r.save||0), 0) + Math.max(0, ...R0.filter(r => r.grp === 'ot').map(r => r.save||0));

    ap(v, head('Owner only · '+(all ? 'All homes' : siteObj(sites[0]).name), 'Labor and pay', 'The last 4 full weeks ('+dayFmt(W[0],{month:'short', day:'numeric'})+' to '+dayFmt(W[3]+6,{month:'short', day:'numeric'})+'). Sample wages. Opening this page is recorded in the change log.'));
    ap(v, h('div',{class:'row'}, h('div',{class:'seg',role:'group','aria-label':'Which homes'},
      h('button',{type:'button','aria-pressed':String(!all),onclick:()=>{ X.ensure().ui.insAll = false; if (S().site === 'family') S().site = 'maple'; A.save(); A.fillSwitchers(); A.route(); }},'This home'),
      h('button',{type:'button','aria-pressed':String(!!all),onclick:()=>{ X.ensure().ui.insAll = true; A.save(); A.route(); }},'All homes')),
      h('a',{class:'btn quiet sm',href:'#/insights'},'Owner insights')));
    const tile = (big, label, note, cls) => h('div',{class:'card'}, h('div',{class:'stat '+(cls||'')}, h('b',null,big), h('span',null,label)), note ? h('span',{class:'small muted'},note) : null);
    ap(v, h('div',{class:'grid g4'},
      tile($(total/4*WPM), 'labor cost a month', $(total)+' over 4 weeks'),
      tile($(otCost/4*WPM), 'overtime pay a month', $(otPrem/4*WPM)+' of it is the extra half-time', otCost ? 'warnc' : 'good'),
      tile(Math.round(worked/4)+' / '+Math.round(plan/4), 'hours worked vs scheduled a week', worked > plan ? 'Worked more than planned' : 'Within plan'),
      tile($(saveSum), 'possible savings a month', 'Ideas that tackle the same overtime are counted once. Estimates.', 'good')));

    // pay by role
    const roles = [...new Set(P.map(p => p.role))].sort((a,b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
    const tb = h('table',{class:'t'}, h('caption',{class:'sr'},'Pay by role'), h('thead',null, h('tr',null, ['Role','People','Pay range','Average','Hours a week','Overtime a week','Cost a month','Share'].map(x => h('th',{scope:'col'},x)))));
    const body = h('tbody');
    roles.forEach(r => { const g = P.filter(p => p.role === r), rates = g.map(p => p.rate), cost = g.reduce((t,p) => t+p.pay, 0)/4*WPM;
      ap(body, h('tr',null, h('th',{scope:'row'},r), h('td',null,String(g.length)), h('td',null, g.some(p => p.kind === 'salary') && g.length === 1 ? $(g[0].annual)+' a year' : (Math.min(...rates) === Math.max(...rates) ? $2(rates[0]) : $2(Math.min(...rates))+' to '+$2(Math.max(...rates)))),
        h('td',null,$2(rates.reduce((t,x) => t+x, 0)/rates.length)), h('td',null,String(Math.round(g.reduce((t,p) => t+p.work, 0)/4))), h('td',null,String(Math.round(g.reduce((t,p) => t+p.ot, 0)/4*10)/10)),
        h('td',null,$(cost)), h('td',null, h('span',{class:'share'}, h('i',{style:'width:'+Math.round(cost/(total/4*WPM)*100)+'%'})), ' '+Math.round(cost/(total/4*WPM)*100)+'%'))); });
    ap(tb, body);
    ap(v, h('div',{class:'card'}, h('h2',null,'Pay by role, from caregiver to nurse'), h('div',{class:'tablewrap',tabindex:'0',role:'region','aria-label':'Pay by role table'}, tb),
      h('p',{class:'small muted'},'Salaried roles show the hourly equivalent at 2,080 hours a year. Contract RN hours are their usual weekly hours.')));

    // weekly trend: hours and overtime cost
    const trend = W.map(ws => { let work = 0, plan = 0, ot = 0, cost = 0; sites.forEach(site => staffNames(site).forEach(n => { const t = T.weekTotals(site, n, ws); work += t.work; plan += t.plan; ot += t.ot*(prof(n).rate||18)*1.5/60; cost += t.cost; })); return {ws, work:work/60, plan:plan/60, ot, cost}; });
    const tb2 = h('table',{class:'t'}, h('caption',{class:'sr'},'Weekly hours and cost'), h('thead',null, h('tr',null, ['Week of','Scheduled hours','Worked hours','Difference','Overtime pay','Shift staff cost'].map(x => h('th',{scope:'col'},x)))),
      h('tbody',null, trend.map(t => h('tr',null, h('th',{scope:'row'},dayFmt(t.ws,{month:'short', day:'numeric'})), h('td',null,String(Math.round(t.plan))), h('td',null,String(Math.round(t.work))), h('td',null,(t.work-t.plan >= 0 ? '+' : '')+Math.round(t.work-t.plan)), h('td',null,$(t.ot)), h('td',null,$(t.cost))))));
    ap(v, h('div',{class:'card'}, h('h2',null,'Scheduled vs worked, week by week'), h('div',{class:'tablewrap',tabindex:'0',role:'region','aria-label':'Weekly hours table'}, tb2),
      h('p',{class:'small muted'},'A gap between scheduled and worked hours usually means late relief, shifts running long, or punches to fix. Time sheets show which.')));

    // manager time
    ap(v, h('div',{class:'card'}, h('h2',null,'Manager time on scheduling and requests'),
      h('div',{class:'grid g3'},
        h('div',{class:'stat'}, h('b',null,String(Math.round(mt.hours*10)/10)), h('span',null,'estimated hours a week')),
        h('div',{class:'stat'}, h('b',null,String(mt.req)), h('span',null,'requests answered in 4 weeks')),
        h('div',{class:'stat'}, h('b',null,String(mt.calls)), h('span',null,'call-offs covered in 4 weeks'))),
      h('p',{class:'small muted'},'Estimate from what the app recorded: 6 minutes per request, 25 per call-off, 5 per time fix, 2 per schedule edit, and about 45 minutes a week per home to build and publish.')));

    // recommendations
    const list = h('div',{class:'list'}, R0.map((r, i) => h('div',{class:'item rec'},
      h('div',{class:'meta'}, r.save ? h('span',{class:'chip calm'},'About '+$(r.save)+' a month') : null, r.grp === 'ot' ? h('span',{class:'chip grey'},'Overtime idea') : null, r.save ? null : r.invest ? h('span',{class:'chip'},'Costs about '+$(r.invest)+' a month') : null, h('span',null,'Idea '+(i+1))),
      h('b',null,r.title), h('span',{class:'small'},h('b',null,'What the data shows: '),r.why), h('span',{class:'small'},h('b',null,'What to try: '),r.what), h('span',{class:'small muted'},h('b',null,'How we estimated: '),r.how), r.link ? h('a',{class:'small',href:r.link.href,target:'_blank',rel:'noopener'},r.link.text+' (opens BLS)') : null)));
    ap(v, h('div',{class:'card'}, h('h2',null,'Ideas to save money and keep staff'),
      h('p',{class:'small muted'},'These are about staffing and fairness, not about rating anyone. Ideas marked "Overtime idea" are different ways to cut the same overtime, so pick one. Talk with staff before changing hours, and check numbers with your bookkeeper.'), list));

    // assumptions
    const num = (k, label, step) => { const i = h('input',{type:'number',min:'0',step:step||'1',value:String(I[k])}); i.addEventListener('change',()=>{ I[k] = Math.max(0, +i.value||0); X.audit('Changed a Labor and pay assumption: '+label, sites[0]); A.save(); A.route(); }); return X.field(label, i); };
    ap(v, h('details',{class:'card'}, h('summary',null,h('h2',{style:'display:inline'},'Your numbers for the estimates')),
      h('div',{class:'grid g3'}, num('agency','Agency rate you pay, $ an hour','0.5'), num('hireCost','Cost to hire and train one person, $'), num('turnover','Cost when a caregiver leaves, $'), num('beforeHrs','Manager hours a week on schedules before the app, per home','0.5'), num('raise','Raise to test, $ an hour','0.25')),
      h('p',{class:'small muted'},'Saved on this device in the test version.')));

    // people (owner only), csv
    const pt = h('table',{class:'t'}, h('caption',{class:'sr'},'Hours and pay by person'), h('thead',null, h('tr',null, ['Home','Name','Role','Rate','Hours a week','Weeks over 40','Pay, 4 weeks'].map(x => h('th',{scope:'col'},x)))),
      h('tbody',null, P.map(p => h('tr',null, h('td',null,siteObj(p.site).name), h('th',{scope:'row'},p.n), h('td',null,p.role), h('td',null,p.kind === 'salary' ? $(p.annual)+'/yr' : $2(p.rate)), h('td',null,String(Math.round(p.work/4))), h('td',null,String(p.otWeeks)), h('td',null,$(p.pay))))));
    ap(v, h('details',{class:'card'}, h('summary',null,h('h2',{style:'display:inline'},'By person')), h('p',{class:'small muted'},'For fair hours and pay, not a ranking. Not shown to managers or staff.'), h('div',{class:'tablewrap',tabindex:'0',role:'region','aria-label':'By person table'}, pt),
      h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ X.audit('Downloaded the Labor and pay spreadsheet', sites[0]); A.save();
        download('labor-and-pay.csv','text/csv',[['Home','Name','Role','Pay type','Rate','Hours worked (4 wk)','Overtime hours (4 wk)','Pay (4 wk)']].concat(P.map(p => [siteObj(p.site).name, p.n, p.role, p.kind, Math.round(p.rate*100)/100, Math.round(p.work), Math.round(p.ot*10)/10, Math.round(p.pay)])).map(r => r.map(csvCell).join(',')).join('\r\n')); }},'Download (.csv)'))));
    ap(v, h('p',{class:'small muted'},'Benchmarks: U.S. Bureau of Labor Statistics, Occupational Outlook Handbook (May 2025 national medians) and OEWS Wausau area release (May 2024 means).'));
  };
})();
