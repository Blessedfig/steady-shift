// Steady Shift test app: owner insights. Numbers and charts from the sample schedule, requests and time sheets.
// Patterns, not people: charts show homes and weeks; the per-person table is for managers and owners only.
(function(){
  const A = window.SSApp, X = window.SSSched, T = window.SSTime; if (!A || !X || !T) return;
  const {D, h, head, R, download, csvCell} = A;
  const S = () => A.state();
  const ap = (el, ...k) => { el.append(...k.flat(9).filter(x => x != null && x !== false)); return el; };
  const {dn, di, todayN, absA, absB, hrs, dayFmt, weekStartOf, staffNames, shiftsAt, check, siteObj} = X;
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs, ...kids) => { const e = document.createElementNS(NS, tag); for (const k in attrs||{}) e.setAttribute(k, attrs[k]); kids.flat().forEach(c => c != null && ap(e, c.nodeType ? c : document.createTextNode(String(c)))); return e; };

  // Single-series column chart: thin bars, 4px rounded tops, recessive grid, the latest value labeled, a tooltip on each bar, and a table view.
  function columns(title, sub, rows, unit, fmt){
    fmt = fmt || (v => String(Math.round(v*10)/10));
    const W = 560, H = 210, L = 44, B = 30, Tp = 16, max = Math.max(1, ...rows.map(r => r.v)), nice = fmt.int ? Math.max(2, Math.ceil(max/2)*2) : niceMax(max);
    const bw = Math.min(46, (W-L-8)/rows.length*0.55), step = (W-L-8)/rows.length;
    const y = v => Tp + (H-Tp-B) * (1 - v/nice);
    const svg = sv('svg',{viewBox:'0 0 '+W+' '+H, class:'chart', role:'img', 'aria-label':title+'. '+rows.map(r => r.k+': '+fmt(r.v)+' '+unit).join('; ')});
    [0, .5, 1].forEach(f => { const yy = y(nice*f); ap(svg, sv('line',{x1:L, x2:W-4, y1:yy, y2:yy, class:'grid'}), sv('text',{x:L-6, y:yy+4, class:'ax', 'text-anchor':'end'}, fmt(nice*f))); });
    rows.forEach((r, i) => {
      const x = L + step*i + (step-bw)/2, top = y(r.v), base = y(0), hgt = Math.max(0, base-top), rr = Math.min(4, hgt);
      const d = hgt ? 'M'+x+','+base+' V'+(top+rr)+' Q'+x+','+top+' '+(x+rr)+','+top+' H'+(x+bw-rr)+' Q'+(x+bw)+','+top+' '+(x+bw)+','+(top+rr)+' V'+base+' Z' : '';
      const g = sv('g',{class:'bar'+(r.now?' now':''), tabindex:'0'}, sv('title',null, r.k+': '+fmt(r.v)+' '+unit+(r.tip?' · '+r.tip:'')), sv('rect',{x:x-4, y:Tp, width:bw+8, height:H-Tp-B, class:'hit'}), d ? sv('path',{d}) : null);
      ap(svg, g, sv('text',{x:x+bw/2, y:H-10, class:'ax', 'text-anchor':'middle'}, r.k));
      if (i === rows.length-1 || r.v === max) ap(svg, sv('text',{x:x+bw/2, y:top-6, class:'val', 'text-anchor':'middle'}, fmt(r.v)));
    });
    return h('figure',{class:'card fig'}, h('figcaption',null, h('h3',null,title), sub ? h('span',{class:'small muted'},sub) : null), svg,
      h('details',null, h('summary',{class:'small'},'Show as a table'), h('table',{class:'t'}, h('thead',null,h('tr',null,h('th',{scope:'col'},'Week of'),h('th',{scope:'col'},unit[0].toUpperCase()+unit.slice(1)))), h('tbody',null, rows.map(r => h('tr',null, h('td',null,r.k), h('td',null,fmt(r.v))))))));
  }
  function niceMax(m){ const p = Math.pow(10, Math.floor(Math.log10(m))), n = m/p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
  // Requests by type, split by status. Status colors always come with words.
  function stacked(rows){
    const ST = [['Approved','ok'],['Declined','no'],['Pending','wait']];
    const max = Math.max(1, ...rows.map(r => r.Approved + r.Declined + r.Pending));
    return h('figure',{class:'card fig'}, h('figcaption',null, h('h3',null,'Requests by type'), h('span',{class:'small muted'},'Last 5 weeks, all requests staff sent')),
      h('div',{class:'legend'}, ST.map(s => h('span',null, h('i',{class:'sw '+s[1],'aria-hidden':'true'}), s[0]))),
      h('div',{class:'hbars'}, rows.map(r => { const tot = r.Approved + r.Declined + r.Pending;
        return h('div',{class:'hrow'}, h('span',{class:'hl'}, r.k), h('span',{class:'htrack', title:r.k+': '+ST.map(s => r[s[0]]+' '+s[0].toLowerCase()).join(', ')},
          ST.map(s => r[s[0]] ? h('i',{class:'sg '+s[1], style:'width:'+(r[s[0]]/max*100)+'%'}) : null)), h('span',{class:'hv'}, String(tot))); })),
      h('details',null, h('summary',{class:'small'},'Show as a table'), h('table',{class:'t'}, h('thead',null,h('tr',null,['Type','Approved','Declined','Waiting'].map(x => h('th',{scope:'col'},x)))), h('tbody',null, rows.map(r => h('tr',null, h('td',null,r.k), h('td',null,r.Approved), h('td',null,r.Declined), h('td',null,r.Pending)))))));
  }

  function weeks(n){ const w0 = weekStartOf(todayN(), 0); const out = []; for (let i = n-1; i >= 0; i--) out.push(w0 - 7*i); return out; }
  function siteWeek(site, ws){
    const r = X.rulesFor(site), names = staffNames(site);
    const tot = names.map(n => T.weekTotals(site, n, ws));
    const iss = check(site, ws, ws+6);
    const gap = iss.filter(i => i.cat === 'Coverage' && i.b).reduce((t,i) => t + (i.b - Math.max(i.a, ws*1440))*(i.short||1), 0);
    const calls = shiftsAt(site).filter(s => s.callin && dn(s.date) >= ws && dn(s.date) < ws+7).length;
    const sched = shiftsAt(site).filter(s => s.staff && dn(s.date) >= ws && dn(s.date) < ws+7).reduce((t,s) => t + (absB(s)-absA(s)), 0);
    return {work:tot.reduce((t,x) => t+x.work, 0), ot:tot.reduce((t,x) => t+x.ot, 0), cost:tot.reduce((t,x) => t+x.cost, 0), sched, gap, calls, flags:tot.reduce((t,x) => t+x.flags, 0)};
  }

  R.insights = v => {
    X.ensure(); T.ensure();
    v.classList.add('wide');
    const all = ['owner','multi'].includes(S().tier) && S().site === 'family' || (X.ensure().ui.insAll && ['owner','multi'].includes(S().tier));
    const sites = all ? D.SITES.filter(s => s.id !== 'family' && SSAccess.mod(s.id,'insights').on).map(s => s.id) : [S().site];
    if (!all && S().site === 'family'){ ap(v, head('Owner insights', 'Insights are for homes with staff', 'Pick a home at the top.')); return; }
    const W = weeks(5), lbl = ws => dayFmt(ws, {month:'short', day:'numeric'});
    const data = W.map(ws => { const x = {work:0, ot:0, cost:0, sched:0, gap:0, calls:0, flags:0}; sites.forEach(s => { const y = siteWeek(s, ws); for (const k in x) x[k] += y[k]; }); return Object.assign(x, {ws}); });
    const cur = data[data.length-1], prev = data.slice(0,-1);
    const avg = k => prev.reduce((t,x) => t+x[k], 0) / Math.max(1, prev.length);
    const reqs = X.ensure().requests.filter(r => sites.includes(r.site) && dn(r.at.slice(0,10)) >= W[0]);
    const decided = reqs.filter(r => r.decidedAt).map(r => (new Date(r.decidedAt) - new Date(r.at)) / 3600e3).sort((a,b) => a-b);
    const median = decided.length ? decided[Math.floor(decided.length/2)] : 0;
    const types = Object.keys(X.TYPES).map(t => { const g = reqs.filter(r => r.type === t); return {k:X.TYPES[t], Approved:g.filter(r => r.status==='Approved').length, Declined:g.filter(r => r.status==='Declined').length, Pending:g.filter(r => r.status==='Pending').length}; }).filter(r => r.Approved + r.Declined + r.Pending);

    ap(v, head(all ? 'Owner insights · All homes' : 'Owner insights · '+siteObj(S().site).name, 'How staffing is going', 'Weekly numbers from the schedule, requests and time sheets. Sample data. This week is still in progress.'));
    if (['owner','multi'].includes(S().tier)) ap(v, h('div',{class:'row'}, h('div',{class:'seg',role:'group','aria-label':'Which homes'},
      h('button',{type:'button','aria-pressed':String(!all),onclick:()=>{ X.ensure().ui.insAll = false; if (S().site==='family') S().site = 'maple'; A.save(); A.fillSwitchers(); A.route(); }},'This home'),
      h('button',{type:'button','aria-pressed':String(!!all),onclick:()=>{ X.ensure().ui.insAll = true; A.save(); A.route(); }},'All homes'))));
    const tile = (big, label, note, cls) => h('div',{class:'card'}, h('div',{class:'stat '+(cls||'')}, h('b',null,big), h('span',null,label)), note ? h('span',{class:'small muted'},note) : null);
    const last = prev[prev.length-1], before = prev.slice(0,-1);
    const trend = (k, f) => { const a = before.reduce((t,x) => t+x[k], 0) / Math.max(1, before.length); if (!a) return ''; const p = Math.round((last[k]-a)/a*100); return (p > 0 ? '+' : '')+p+'% vs the 3 weeks before'+(f||''); };
    ap(v, h('div',{class:'grid g4'},
      tile(String(hrs(prev[prev.length-1].ot)), 'overtime hours last week', trend('ot'), prev[prev.length-1].ot ? 'warnc' : 'good'),
      tile(String(Math.round(prev[prev.length-1].gap/60)), 'staff-hours short of your minimums last week', 'Counts each missing person for each hour.', prev[prev.length-1].gap ? 'warnc' : 'good'),
      tile(decided.length ? (median < 24 ? Math.round(median)+' hrs' : Math.round(median/24*10)/10+' days') : '–', 'typical time to answer a request', decided.length+' answered in 5 weeks', median <= 24 ? 'good' : 'warnc'),
      tile('$'+Math.round(prev[prev.length-1].cost).toLocaleString(), 'labor cost last week (sample wages)', 'Overtime adds $'+Math.round(prev[prev.length-1].ot/60*0.5*18).toLocaleString()+' in premium (approx.)')));
    const rows = k => data.map((x, i) => ({k:lbl(x.ws), v:x[k], now:i === data.length-1}));
    ap(v, h('div',{class:'grid g2'},
      columns('Hours worked', 'From clock-in and clock-out', rows('work').map(r => Object.assign(r, {v:r.v/60})), 'hours'),
      columns('Overtime hours', 'Over 40 in the workweek', rows('ot').map(r => Object.assign(r, {v:r.v/60})), 'hours'),
      columns('Coverage short', 'Staff-hours below your minimums, from the schedule', rows('gap').map(r => Object.assign(r, {v:r.v/60})), 'staff-hours'),
      columns('Call-offs', 'Shifts someone called off from', rows('calls'), 'call-offs', Object.assign(v => String(Math.round(v)), {int:true})),
      columns('Labor cost', 'Regular plus 1.5 times for overtime, sample wages', rows('cost'), 'dollars', v => '$'+Math.round(v).toLocaleString()),
      types.length ? stacked(types) : null));

    // per person (managers and owners only): hours and overtime for the last full week
    const ws = W[W.length-2];
    const tb = h('table',{class:'t'}, h('thead',null,h('tr',null,['Home','Staff','Scheduled','Worked','Overtime','Flags','Requests (5 wk)'].map(x => h('th',{scope:'col'},x)))));
    const body = h('tbody'); const csv = [['Home','Staff','Week of','Scheduled hours','Worked hours','Overtime hours','Flags','Requests (5 weeks)']];
    sites.forEach(s => staffNames(s).forEach(n => { const t = T.weekTotals(s, n, ws); if (!t.plan && !t.work) return; const rq = reqs.filter(r => r.site === s && r.by === n).length;
      ap(body, h('tr',null, h('td',null,siteObj(s).name), h('th',{scope:'row'},n), h('td',null,hrs(t.plan)), h('td',null,hrs(t.work)), h('td',null, t.ot ? h('span',{class:'chip amber'},hrs(t.ot)) : '0'), h('td',null,t.flags), h('td',null,rq)));
      csv.push([siteObj(s).name, n, di(ws), hrs(t.plan), hrs(t.work), hrs(t.ot), t.flags, rq]); }));
    ap(tb, body);
    ap(v, h('details',{class:'card'}, h('summary',null,h('h2',{style:'display:inline'},'By person, week of '+lbl(ws))), h('p',{class:'small muted'},'For spreading hours fairly and catching burnout early. Not a ranking.'), h('div',{class:'tablewrap'}, tb),
      h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>download('insights-'+di(ws)+'.csv','text/csv',csv.map(r => r.map(csvCell).join(',')).join('\r\n'))},'Download (.csv)'))));
    if (['owner','multi'].includes(S().tier)) ap(v, h('a',{class:'tile',href:'#/labor'}, h('span',{class:'ic','aria-hidden':'true'},'💵'), h('b',null,'Labor and pay (owner only)'), h('span',null,'Pay by role, overtime cost, manager time on schedules, and ideas with estimated savings.')));
    ap(v, h('div',{class:'card soft'}, h('h3',null,'What to look for'), h('ul',{class:'small'},
      h('li',null,'Overtime that keeps landing on the same people is a burnout and turnover warning before it is a cost.'),
      h('li',null,'Coverage short on the same weekday each week usually means the template needs a change, not more phone calls.'),
      h('li',null,'Slow answers to requests lead to no-shows. A same-day answer is a good target.'))));
  };
})();
