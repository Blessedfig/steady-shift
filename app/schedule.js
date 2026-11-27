// Steady Shift test app: built-in shift scheduler (sample data only, stored in this browser).
// Shift templates, quick assignment, week and month views with drag, copy and repeat,
// DHS 88 / DHS 83 aware checks, open shifts, swaps, time off, and calendar export through the Sync screen's helpers.
(function(){
  const A = window.SSApp; if (!A) return;
  const {D, h, toast, fmtDate, head, download, toIcs, gcalUrl, outlookUrl, csvCell, R} = A;
  const S = () => A.state();
  const ap = (el, ...k) => { el.append(...k.flat(9).filter(x => x != null && x !== false)); return el; };
  const SD = D.SCHED;

  // ---------- dates and times (whole days as numbers, times as minutes; no time-zone drift) ----------
  const pad = n => String(n).padStart(2,'0');
  const dn = iso => Date.UTC(+iso.slice(0,4), +iso.slice(5,7)-1, +iso.slice(8,10)) / 864e5;
  const di = n => new Date(n*864e5).toISOString().slice(0,10);
  const dow = n => new Date(n*864e5).getUTCDay();
  const todayN = () => dn(A.isoDay(new Date()));
  const tmin = t => { const [a,b] = String(t||'0:0').split(':').map(Number); return a*60+(b||0); };
  const mt = m => pad(Math.floor(((m%1440)+1440)%1440/60))+':'+pad(((m%60)+60)%60);
  const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const DOWL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dayFmt = (n, o) => new Date(n*864e5).toLocaleDateString(undefined, Object.assign({timeZone:'UTC'}, o||{weekday:'short', month:'short', day:'numeric'}));
  function tShort(t){ const m = tmin(t), hh = Math.floor(m/60), mm = m%60; const h12 = hh%12 || 12; return h12+(mm?':'+pad(mm):'')+(hh<12?'a':'p'); }
  function tLong(t){ const m = tmin(t), hh = Math.floor(m/60), mm = m%60; return (hh%12||12)+':'+pad(mm)+(hh<12?' AM':' PM'); }
  const span = s => tShort(s.start)+'–'+tShort(s.end);
  const absA = s => dn(s.date)*1440 + tmin(s.start);
  const absB = s => { const a = absA(s); let b = dn(s.date)*1440 + tmin(s.end); if (b <= a) b += 1440; return b; };
  const mins = s => absB(s) - absA(s);
  const hrs = m => Math.round(m/6)/10;
  const at = m => dayFmt(Math.floor(m/1440)) + ', ' + tLong(mt(m));
  function rangeText(a, b){ const da = Math.floor(a/1440), db = Math.floor((b-1)/1440); return dayFmt(da)+', '+tLong(mt(a))+' to '+(db!==da ? dayFmt(Math.floor(b/1440))+', ' : '')+tLong(mt(b)); }
  const weekStartOf = (n, ws) => n - ((dow(n) - (ws||0) + 7) % 7);

  // ---------- state ----------
  const uid = A.uid;
  function ensure(){
    const s = S();
    if (s.sched && s.sched.v === 1){ if (!s.sched.awakeOnly){ s.sched.templates = s.sched.templates.filter(t => !t.asleep); s.sched.shifts.forEach(x => { delete x.asleep; }); Object.values(s.sched.rules||{}).forEach(r => { delete r.awake; }); s.sched.awakeOnly = true; A.save(); } return s.sched; }
    // add the sample staff and RN clearances the scheduler needs (once)
    for (const k in SD.extraStaff){ s.staff[k] = s.staff[k] || []; SD.extraStaff[k].forEach(p => { if (!s.staff[k].some(x => x.n === p.n)) s.staff[k].push(Object.assign({}, p)); }); }
    SD.extraDelegations.forEach(d => { if (!s.delegations.some(x => x.site===d.site && x.cg===d.cg && x.task===d.task)) s.delegations.push(Object.assign({}, d)); });
    s.sched = seed(); s.audit = s.audit || [];
    A.save();
    return s.sched;
  }
  function seed(){
    const t0 = todayN(), w0 = weekStartOf(t0, 0);
    const shifts = [], requests = [];
    const add = (site, d, start, end, staff, x) => { const o = Object.assign({id:uid(), site, date:di(d), start, end, staff:staff||null, kind:'shift'}, x||{}); shifts.push(o); return o; };
    // Maple Grove (AFH): 12-hour 6a-6p / 6p-6a, overnight awake shift with night rounds. Helper shifts for the new caregiver.
    const mDay = ['Caregiver B','Caregiver C','Caregiver B','Caregiver C','Caregiver B','Caregiver C','Manager'];
    const mNight = ['Caregiver D','Caregiver E','Caregiver D','Caregiver E','Caregiver D',null,'Caregiver E'];
    // Birch Hollow (CBRF): 8-hour shifts, 2 on days and evenings, 1 overnight (awake, like every shift).
    const bDay = [['Caregiver L','Caregiver P'],['Caregiver F','Caregiver L'],['Caregiver F','Caregiver P'],['Caregiver F','Caregiver L'],['Caregiver F','Caregiver P'],['Caregiver L','Caregiver P'],['Caregiver F','Caregiver L']];
    const bEve = [['Caregiver G','Caregiver M'],['Caregiver G','Caregiver H'],['Caregiver M','Caregiver H'],['Caregiver G','Caregiver M'],['Caregiver G','Caregiver H'],['Caregiver M','Caregiver H'],['Caregiver G','Caregiver M']];
    const bNight = ['Caregiver N','Caregiver N','Caregiver N','Caregiver Q','Caregiver Q','Caregiver Q','Caregiver Q'];
    for (let w = -4; w <= 3; w++) for (let i = 0; i < 7; i++){
      const d = w0 + w*7 + i;
      add('maple', d, '06:00', '18:00', mDay[i], {tpl:'t6d'});
      const fri = mNight[i] || (w === 0 ? null : (w%2 ? 'Caregiver E' : 'Caregiver D'));
      add('maple', d, '18:00', '06:00', fri, {tpl:'t6n'});
      if (i === 2 || i === 4) add('maple', d, '09:00', '15:00', 'Caregiver A', {tpl:'thelp'});
      bDay[i].forEach(p => add('birch', d, '07:00', '15:00', p, {tpl:'t8d'}));
      bEve[i].forEach(p => add('birch', d, '15:00', '23:00', p, {tpl:'t8e'}));
      add('birch', d, '23:00', '07:00', bNight[i], {tpl:'t8n'});
    }
    add('maple', w0+1, '13:00', '15:00', 'Caregiver A', {tpl:'ttr', kind:'training', note:'Dementia care module (sample)', credit:2});
    add('maple', w0+8, '13:00', '15:00', 'Caregiver C', {tpl:'ttr', kind:'training', note:'Annual hours catch-up (sample)', credit:2});
    // sample call-offs in past weeks (shift stays covered by someone else)
    [[-3,2,'maple','18:00','Caregiver C'],[-2,5,'birch','15:00','Caregiver M'],[-1,1,'birch','07:00','Caregiver F'],[-1,4,'maple','06:00','Caregiver D']].forEach(([w,i,site,start,cover]) => {
      const s = shifts.find(x => x.site===site && x.date===di(w0+w*7+i) && x.start===start); if (s){ s.callin = true; s.staff = cover; }
    });
    // requests: a few waiting now, and decided ones in past weeks for the owner's charts
    const iso = (d, hh) => di(d)+'T'+pad(hh)+':00:00';
    const friNight = shifts.find(s => s.site==='maple' && s.date===di(w0+5) && s.start==='18:00');
    const wedDay = shifts.find(s => s.site==='maple' && s.date===di(w0+3) && s.start==='06:00');
    requests.push({id:uid(), site:'maple', type:'pickup', by:'Caregiver E', shift:friNight.id, status:'Pending', at:iso(t0-1,14), note:'I can take Friday night.'});
    requests.push({id:uid(), site:'maple', type:'cover', by:'Caregiver C', to:'Caregiver D', shift:wedDay.id, status:'Pending', at:iso(t0-1,9), note:'D said they could cover.'});
    requests.push({id:uid(), site:'maple', type:'timeoff', by:'Caregiver B', from:di(w0+14), to:di(w0+16), pto:'PTO', status:'Pending', at:iso(t0,8), note:''});
    requests.push({id:uid(), site:'birch', type:'change', by:'Caregiver H', status:'Pending', at:iso(t0-2,16), note:'Could I move to day shifts starting in January?'});
    const types = ['pickup','cover','timeoff','giveup','timeoff','change','cover','pickup'];
    const people = {maple:['Caregiver B','Caregiver C','Caregiver D','Caregiver E'], birch:['Caregiver F','Caregiver G','Caregiver L','Caregiver M','Caregiver N','Caregiver P']};
    for (let w = -4; w <= -1; w++) ['maple','birch'].forEach((site, si) => {
      const n = site==='birch' ? 3 + ((w+4)%2) : 2;
      for (let k = 0; k < n; k++){
        const d = w0 + w*7 + ((k*2+si)%7), t = types[(k+w+4+si)%types.length], who = people[site][(k+w+8)%people[site].length];
        const wait = [3,9,20,30,5,52,14][(k+w+8)%7];
        const st = (k+w)%4 === 0 ? 'Declined' : 'Approved';
        const r = {id:uid(), site, type:t, by:who, status:st, at:iso(d,9), decidedAt:new Date(new Date(iso(d,9)).getTime()+wait*3600e3).toISOString(), decidedBy:'Manager', note:''};
        if (t==='timeoff'){ r.from = di(d+7); r.to = di(d+7); r.pto = 'PTO'; }
        requests.push(r);
      }
    });
    return {v:1, awakeOnly:true, templates:SD.templates.map(t => Object.assign({}, t)), rules:JSON.parse(JSON.stringify(SD.rules)), shifts, requests,
      oncall:{maple:{def:'Manager', days:{}}, birch:{def:'On-call RN', days:{}}, cedar:{def:'Manager', days:{}}},
      published:{maple:{[di(w0-7)]:{at:iso(w0-10,15)}, [di(w0)]:{at:iso(w0-3,15)}}, birch:{[di(w0)]:{at:iso(w0-3,15)}}},
      ui:{view:'week', layout:'', cursor:di(t0), copyMode:false}};
  }
  function audit(what, site){ const s = S(); s.audit = s.audit || []; s.audit.unshift({at:new Date().toISOString(), who:actor(), what, site:site||s.site}); if (s.audit.length > 400) s.audit.length = 400; }
  const undoStack = [];
  function snap(){ undoStack.push(JSON.stringify({shifts:ensure().shifts, requests:ensure().requests})); if (undoStack.length > 30) undoStack.shift(); }
  function undo(){ const x = undoStack.pop(); if (!x) return; const o = JSON.parse(x); ensure().shifts = o.shifts; ensure().requests = o.requests; A.save(); audit('Undid the last schedule change'); A.save(); A.route(); toast('Undone'); }

  // ---------- people, rules and permissions ----------
  const siteObj = id => D.SITES.find(s => s.id === id) || D.SITES[0];
  const staffNames = site => (S().staff[site]||[]).map(p => p.n);
  const prof = n => SD.profiles[n] || {alone:true, meds:false, rate:18, pto:0};
  const rec = (site, n) => (S().staff[site]||[]).find(p => p.n === n);
  const rulesFor = site => Object.assign({dayMin:1, nightMin:1, nightStart:'22:00', nightEnd:'06:00', otWeek:40, minRest:8, maxStretch:16, weekStart:0}, ensure().rules[site]||{});
  const MGR = ['manager','owner','multi'];
  const me = () => { const t = S().tier; if (t === 'caregiver') return staffNames(S().site)[1] || 'Caregiver'; if (t === 'manager') return 'Manager'; return A.tier().name; };
  const actor = () => S().tier === 'caregiver' ? me() : A.tier().name;
  const can = p => MGR.includes(S().tier) || !!(window.SSAccess && SSAccess.can(p, me()));
  const canEdit = () => can('sched.edit');
  const canApprove = () => can('sched.approve');
  const inNight = (m, r) => { const a = tmin(r.nightStart), b = tmin(r.nightEnd); return a > b ? (m >= a || m < b) : (m >= a && m < b); };
  const shiftsAt = site => ensure().shifts.filter(s => s.site === site);
  const timeOffFor = (site, n, iso, list) => (list || ensure().requests).find(r => r.type==='timeoff' && r.site===site && r.by===n && r.from<=iso && r.to>=iso && r.status!=='Declined');
  function canDo(n, task, site, iso){
    const p = prof(n); if (p.licensed) return true;
    if (task.need === 'meds') return !!p.meds;
    return S().delegations.some(d => d.site===site && d.cg===n && d.task===task.task && (!task.res || d.res===task.res) && d.review >= iso && d.status !== 'Expired');
  }
  function citeFor(site, kind){
    const st = siteObj(site).setting;
    return ({
      cover: st==='cbrf' ? 'DHS 83 staffing: enough qualified staff for residents\' needs and your license class. The number is your home\'s own minimum.' : 'DHS 88: enough qualified staff on duty for residents\' needs. The number is your home\'s own minimum.',
      alone: st==='cbrf' ? 'Orientation and training before working alone (DHS 83.20 to 83.25).' : 'Training for new staff (DHS 88.04(5)).',
      meds: 'Medication training and your home\'s medication policy (DHS '+(st==='cbrf'?'83.37':'88.07')+').',
      delegation: 'RN delegation: task, resident and caregiver must match (N 6.03(3)).',
      ot: 'Overtime after 40 hours in a workweek (federal FLSA and Wisconsin DWD 274).',
      rest: 'Your home\'s fatigue rule. Wisconsin sets no daily hour limit for adult caregivers.',
      bg: 'Caregiver background checks every 4 years (DHS 12).',
      hours: st==='cbrf' ? 'CBRF: 15 continuing education hours a year (DHS 83.20 to 83.25).' : 'AFH: 8 training hours a year after the first year (DHS 88.04(5)).'
    })[kind];
  }

  // ---------- the checker ----------
  // Returns issues for days d0..d1. sev: 'fix' (must fix before publishing) or 'check' (look at it) or 'note'.
  function check(site, d0, d1, list){
    list = (list || ensure().shifts).filter(s => s.site === site);
    const r = rulesFor(site), out = [];
    const push = o => { if (o.d >= d0 && o.d <= d1){ o.date = di(o.d); o.key = o.cat+'|'+o.text; out.push(o); } };
    const work = list.filter(s => s.staff && s.kind !== 'training').map(s => ({s, a:absA(s), b:absB(s)}));
    const A0 = d0*1440, B0 = (d1+1)*1440;
    const pts = new Set([A0, B0]);
    for (let d = d0-1; d <= d1+1; d++){ pts.add(d*1440+tmin(r.nightStart)); pts.add(d*1440+tmin(r.nightEnd)); }
    work.forEach(x => { pts.add(x.a); pts.add(x.b); });
    const P = [...pts].filter(p => p >= A0 && p <= B0).sort((a,b) => a-b);
    let cur = null;
    const flush = () => { if (!cur) return;
      const opens = list.filter(s => !s.staff && s.kind!=='training' && absA(s) < cur.b && absB(s) > cur.a).length;
      if (cur.type === 'short') push({d:Math.floor(cur.a/1440), sev:'fix', cat:'Coverage', text:rangeText(cur.a,cur.b)+': '+cur.n+' on duty, your minimum is '+cur.need+'.'+(opens?' An open shift is posted for this time.':''), cite:citeFor(site,'cover'), a:cur.a, b:cur.b, short:cur.need-cur.n});
      if (cur.type === 'alone') push({d:Math.floor(cur.a/1440), sev:'fix', cat:'Training', text:cur.info+' would be the only staff on duty '+rangeText(cur.a,cur.b)+' and has not finished the training needed to work alone.', cite:citeFor(site,'alone'), a:cur.a, who:cur.info});
      cur = null; };
    for (let i = 0; i < P.length-1; i++){
      const a = P[i], b = P[i+1]; if (b <= a) continue;
      const on = work.filter(x => x.a <= a && x.b >= b), night = inNight(((a%1440)+1440)%1440, r), need = night ? r.nightMin : r.dayMin;
      let type = null, info = '';
      if (on.length < need){ type = 'short'; info = on.length+'/'+need; }
      else if (on.length && on.every(x => !prof(x.s.staff).alone)){ type = 'alone'; info = on.map(x => x.s.staff).join(' and '); }
      if (type && cur && cur.type === type && cur.info === info && cur.b === a) cur.b = b;
      else { flush(); if (type) cur = {type, info, a, b, n:on.length, need}; }
    }
    flush();
    // care tasks that need a cleared person on duty
    (SD.tasks[site]||[]).forEach(task => { for (let d = d0; d <= d1; d++) task.times.forEach(t => {
      const T = d*1440 + tmin(t), on = work.filter(x => x.a <= T && x.b > T);
      if (!on.length || on.some(x => canDo(x.s.staff, task, site, di(d)))) return;
      const why = on.map(x => { const dl = S().delegations.find(q => q.site===site && q.cg===x.s.staff && q.task===task.task); return dl ? x.s.staff+'\'s clearance '+(dl.review < di(d) ? 'ended '+fmtDate(dl.review) : 'is not active') : null; }).filter(Boolean);
      push({d, sev:'fix', cat:task.need==='meds' ? 'Medication' : 'RN delegation', text:tLong(t)+' '+dayFmt(d)+': no one on duty is cleared for '+task.task.toLowerCase()+(task.res?' ('+task.res+')':'')+'.'+(why.length?' '+why.join('. ')+'.':''), cite:citeFor(site, task.need), link:task.need==='delegation'?'#/delegations':'#/team', ids:on.map(x => x.s.id), a:T});
    }); });
    // per person
    const people = [...new Set(list.filter(s => s.staff).map(s => s.staff))];
    people.forEach(n => {
      const mine = list.filter(s => s.staff === n).map(s => ({s, a:absA(s), b:absB(s)})).sort((x,y) => x.a-y.a);
      let chain = null;
      for (let i = 0; i < mine.length; i++){
        const p = mine[i-1], q = mine[i];
        if (!p){ chain = q.a; continue; }
        if (q.a < p.b){ push({d:dn(q.s.date), sev:'fix', cat:'Double-booked', text:n+' is booked twice at the same time on '+dayFmt(dn(q.s.date))+' ('+span(p.s)+' and '+span(q.s)+').', ids:[p.s.id,q.s.id], who:n, a:q.a}); continue; }
        const gap = q.a - p.b;
        if (gap > 30) chain = q.a;
        if (gap <= 30 && q.b - chain > r.maxStretch*60) push({d:dn(q.s.date), sev:'check', cat:'Back-to-back', text:n+': '+hrs(q.b-chain)+' hours in a row ('+at(chain)+' to '+at(q.b)+'). Your limit is '+r.maxStretch+'.', cite:citeFor(site,'rest'), ids:[p.s.id,q.s.id], who:n, a:q.a});
        else if (gap > 30 && gap < r.minRest*60) push({d:dn(q.s.date), sev:'check', cat:'Back-to-back', text:n+': only '+hrs(gap)+' hours off between shifts before '+dayFmt(dn(q.s.date))+'. Your minimum is '+r.minRest+'.', cite:citeFor(site,'rest'), ids:[p.s.id,q.s.id], who:n, a:q.a});
      }
      // overtime by workweek (hours counted on the day the shift starts)
      for (let ws = weekStartOf(d0, r.weekStart); ws <= d1; ws += 7){
        const wk = mine.filter(x => { const d = dn(x.s.date); return d >= ws && d < ws+7; });
        let tot = 0, over = [];
        wk.forEach(x => { tot += (x.b-x.a); if (tot > r.otWeek*60) over.push(x.s.id); });
        if (tot > r.otWeek*60) push({d:Math.max(ws, d0), sev:'check', cat:'Overtime', text:n+': '+hrs(tot)+' hours the week of '+dayFmt(ws, {month:'short', day:'numeric'})+' ('+hrs(tot-r.otWeek*60)+' overtime hours).', cite:citeFor(site,'ot'), ids:over, who:n, a:ws*1440});
      }
      // time off, background recheck, training hours
      mine.forEach(x => { const t = timeOffFor(site, n, x.s.date); if (t) push({d:dn(x.s.date), sev:t.status==='Approved'?'fix':'note', cat:'Time off', text:n+(t.status==='Approved'?' is on approved time off ':' has asked for time off ')+dayFmt(dn(x.s.date))+' but is scheduled '+span(x.s)+'.', ids:[x.s.id], who:n, a:x.a}); });
      const pr = rec(site, n);
      if (pr && pr.bg){ const due = new Date(pr.bg+'T12:00:00'); due.setFullYear(due.getFullYear()+4); const dueIso = A.isoDay(due);
        const first = mine.find(x => x.s.date > dueIso && dn(x.s.date) >= d0 && dn(x.s.date) <= d1);
        if (first) push({d:dn(first.s.date), sev:'check', cat:'Background check', text:n+'\'s 4-year background recheck was due '+fmtDate(dueIso)+'. Confirm it was done before '+dayFmt(dn(first.s.date))+'.', cite:citeFor(site,'bg'), ids:[first.s.id], who:n, link:'#/team', a:first.a}); }
      if (pr && pr.need && pr.hours < pr.need){ const first = mine.find(x => dn(x.s.date) >= d0 && dn(x.s.date) <= d1);
        if (first && !mine.some(x => x.s.kind==='training' && dn(x.s.date) >= d0 && dn(x.s.date) <= d1+28)) push({d:dn(first.s.date), sev:'note', cat:'Training hours', text:n+' has '+pr.hours+' of '+pr.need+' training hours this year. Add a training block.', cite:citeFor(site,'hours'), who:n, link:'#/team', a:first.a, fixTraining:n}); }
    });
    const order = {fix:0, check:1, note:2};
    return out.sort((x,y) => order[x.sev]-order[y.sev] || x.a-y.a);
  }
  // What a proposed change adds: run the checker before and after.
  function diffIssues(site, d0, d1, after){ const before = new Set(check(site, d0, d1).map(i => i.key)); return check(site, d0, d1, after).filter(i => !before.has(i.key)); }
  function withChange(fn){ const list = JSON.parse(JSON.stringify(ensure().shifts)); fn(list); return list; }
  function fitFor(shift, n){
    const d = dn(shift.date);
    const list = withChange(L => { const x = L.find(s => s.id === shift.id); if (x) x.staff = n; else L.push(Object.assign({}, shift, {staff:n})); });
    return diffIssues(shift.site, d-1, d+7, list).filter(i => i.who === n || i.sev === 'fix');
  }
  function candidates(shift){
    return staffNames(shift.site).filter(n => n !== shift.staff).map(n => {
      const iss = fitFor(shift, n);
      const wk = weekStartOf(dn(shift.date), rulesFor(shift.site).weekStart);
      const hours = hrs(shiftsAt(shift.site).filter(s => s.staff===n && dn(s.date) >= wk && dn(s.date) < wk+7).reduce((t,s) => t+mins(s), 0));
      return {n, iss, fix:iss.filter(i => i.sev==='fix').length, chk:iss.filter(i => i.sev==='check').length, hours};
    }).sort((a,b) => a.fix-b.fix || a.chk-b.chk || a.hours-b.hours);
  }

  // ---------- shared bits of UI ----------
  const sevChip = sev => h('span',{class:'chip '+(sev==='fix'?'amber':sev==='check'?'':'grey')}, sev==='fix'?'Must fix':sev==='check'?'Check':'Note');
  function issueRow(i, onGo){
    return h('div',{class:'item'},
      h('div',{class:'meta'}, sevChip(i.sev), h('span',{class:'chip grey'},i.cat), h('span',null,dayFmt(dn(i.date)))),
      h('span',null,i.text), i.cite ? h('span',{class:'small muted'},i.cite) : null,
      h('div',{class:'row'},
        onGo ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>onGo(i)},'Show me') : null,
        i.link ? h('a',{class:'btn quiet sm',href:i.link}, i.link==='#/delegations'?'Delegation ledger':'Team training') : null,
        i.fixTraining && canEdit() ? h('button',{class:'btn ghost sm',type:'button',onclick:()=>addTraining(i)},'Add a 2-hour training block') : null));
  }
  function addTraining(i){
    const site = S().site, t = ensure().templates.find(x => x.kind==='training') || {start:'13:00', end:'15:00'};
    // the next day this person is not working, within two weeks
    const busy = new Set(shiftsAt(site).filter(s => s.staff===i.fixTraining).map(s => s.date));
    let d = Math.max(todayN()+1, dn(i.date)); while (busy.has(di(d)) && d < todayN()+21) d++;
    snap(); ensure().shifts.push({id:uid(), site, date:di(d), start:t.start, end:t.end, staff:i.fixTraining, kind:'training', tpl:t.id, credit:hrs(tmin(t.end)-tmin(t.start)), note:'Training (sample)'});
    audit('Added a training block for '+i.fixTraining+' on '+fmtDate(di(d))); A.save(); A.route(); toast('Training block added on '+dayFmt(d));
  }
  function dialog(title, build, opts){
    const dlg = h('dialog',{class:'sheet','aria-labelledby':'dlgT'});
    const box = h('div',{class:'card'}, h('div',{class:'row',style:'justify-content:space-between'}, h('h2',{id:'dlgT'},title), h('button',{class:'linkbtn',type:'button',onclick:()=>dlg.close()},'Close')));
    ap(dlg, box); document.body.append(dlg);
    dlg.addEventListener('close', () => { dlg.remove(); if (opts && opts.onClose) opts.onClose(); });
    build(box, dlg);
    dlg.showModal();
    return dlg;
  }
  const field = (label, el, id) => { el.id = el.id || id || 'f'+uid(); return h('label',{class:'f',for:el.id},label,el); };
  const sel = (opts, val) => h('select',null, opts.map(o => h('option',{value:o[0], selected:String(o[0])===String(val)}, o[1])));

  // ---------- shift editor ----------
  function editor(shift, isNew){
    const site = shift.site, editing = canEdit();
    const t = JSON.parse(JSON.stringify(shift));
    dialog(isNew ? 'Add a shift' : (editing ? 'Edit shift' : 'Shift'), (box, dlg) => {
      const tpls = ensure().templates;
      const tplSel = sel([['','Custom times']].concat(tpls.map(x => [x.id, x.name+' · '+tShort(x.start)+'–'+tShort(x.end)])), t.tpl||'');
      const date = h('input',{type:'date', value:t.date});
      const st = h('input',{type:'time', value:t.start, step:'900'}), en = h('input',{type:'time', value:t.end, step:'900'});
      const who = sel([['','Open shift (anyone can ask for it)']].concat(staffNames(site).map(n => [n, n])), t.staff||'');
      const kind = sel([['shift','Work shift'],['training','Training time']], t.kind||'shift');
      const note = h('input',{type:'text', value:t.note||'', maxlength:'120', placeholder:'Short note. No resident names or health details.'});
      const checks = h('div',{class:'list','aria-live':'polite'});
      const during = h('div');
      const fit = h('div');
      [tplSel,date,st,en,who,kind,note].forEach(x => x.disabled = !editing);
      const read = () => { t.date = date.value || t.date; t.start = st.value || t.start; t.end = en.value || t.end; t.staff = who.value || null; t.kind = kind.value; t.note = note.value.trim(); };
      function refresh(){
        read();
        const d = dn(t.date);
        const list = withChange(L => { const i = L.findIndex(s => s.id === t.id); if (i >= 0) L[i] = t; else L.push(t); });
        const iss = check(site, d-1, d+1, list).filter(i => (i.ids||[]).includes(t.id) || (i.a >= absA(t) && i.a < absB(t)) || (t.staff && i.who === t.staff));
        checks.textContent = '';
        ap(checks, iss.length ? iss.map(i => issueRow(i)) : h('p',{class:'small'},'✓ No problems found for this shift.'));
        fit.textContent = '';
        if (editing && t.kind !== 'training'){
          const c = candidates(t).slice(0, 5);
          ap(fit, h('h3',null, t.staff ? 'Others who could take it' : 'Who can cover'), h('div',{class:'list'}, c.map(x => h('div',{class:'item'},
            h('div',{class:'meta'}, x.fix ? h('span',{class:'chip amber'},x.fix+' must fix') : x.chk ? h('span',{class:'chip'},x.chk+' to check') : h('span',{class:'chip calm'},'Good fit'), h('span',null,x.hours+' hrs that week')),
            h('b',null,x.n), x.iss.length ? h('span',{class:'small'},x.iss.slice(0,2).map(i => i.text).join(' ')) : null,
            h('div',{class:'row'}, h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ who.value = x.n; refresh(); }},'Put '+x.n+' here'))))));
        }
      }
      tplSel.addEventListener('change', () => { const x = tpls.find(y => y.id === tplSel.value); if (x){ st.value = x.start; en.value = x.end; kind.value = x.kind||'shift'; t.tpl = x.id; } else t.tpl = ''; refresh(); });
      [date,st,en,who,kind].forEach(x => x.addEventListener('change', () => { if (x === st || x === en) { t.tpl = ''; tplSel.value = ''; } refresh(); }));
      // what happened during this shift (counts only)
      if (!isNew){
        const a = absA(shift), b = absB(shift);
        const inShift = x => { const m = new Date(x.at); const v = dn(A.isoDay(m))*1440 + m.getHours()*60 + m.getMinutes(); return x.site === site && v >= a && v < b; };
        const reps = S().reports.filter(inShift).length, calls = S().triage.filter(inShift).length;
        if (reps || calls) ap(during, h('p',{class:'small'}, h('b',null,'During this shift: '), [reps ? reps+' report'+(reps>1?'s':'') : null, calls ? calls+' night help call'+(calls>1?'s':'') : null].filter(Boolean).join(', ')+'. ', reps ? h('a',{href:'#/inbox'},'Open reports') : h('a',{href:'#/home'},'See the night log')));
        if (shift.callin) ap(during, h('p',{class:'small'},'This shift had a call-off and was re-covered.'));
      }
      ap(box, h('p',{class:'small muted'}, siteObj(site).name),
        editing ? field('Shift template', tplSel) : null,
        h('div',{class:'grid g3'}, field('Date', date), field('Starts', st), field('Ends', en)),
        h('p',{class:'small muted'},'Ending before it starts means it ends the next morning.'),
        field('Who', who), editing ? field('Type', kind) : null, field('Note', note),
        during, h('h3',null,'Checks'), checks, fit);
      const row = h('div',{class:'row'});
      if (editing){
        ap(row, h('button',{class:'btn',type:'button',onclick:()=>{ read(); snap(); const L = ensure().shifts, i = L.findIndex(s => s.id === t.id); if (i >= 0) L[i] = t; else L.push(t);
          audit((isNew?'Added':'Changed')+' a shift: '+(t.staff||'open')+', '+fmtDate(t.date)+' '+span(t), site); A.save(); dlg.close(); A.route(); toast('Saved'); }}, isNew ? 'Add shift' : 'Save'));
        if (!isNew){
          ap(row, h('button',{class:'btn ghost',type:'button',onclick:()=>{ dlg.close(); startCarry(shift.id, 'copy'); }},'Copy to…'),
            h('button',{class:'btn ghost',type:'button',onclick:()=>{ dlg.close(); repeatDialog(shift); }},'Repeat…'),
            h('button',{class:'btn ghost',type:'button',onclick:()=>{ dlg.close(); startCarry(shift.id, 'move'); }},'Move…'));
          if (shift.staff && shift.kind !== 'training') ap(row, h('button',{class:'btn quiet',type:'button',onclick:()=>{ snap(); const s = ensure().shifts.find(x => x.id === shift.id); s.staff = null; s.callin = true; audit('Marked a call-off and opened the shift '+fmtDate(s.date)+' '+span(s), site); A.save(); dlg.close(); A.route(); editor(s); }},'Called off'));
          if (shift.kind === 'training' && shift.staff && !shift.attended) ap(row, h('button',{class:'btn quiet',type:'button',onclick:()=>{ const s = ensure().shifts.find(x => x.id === shift.id); s.attended = true; const p = rec(site, s.staff); const add = s.credit || hrs(mins(s)); if (p) p.hours = Math.round((p.hours + add)*10)/10; audit('Marked training attended: '+s.staff+' +'+add+' hrs', site); A.save(); dlg.close(); A.route(); toast(add+' hours added to Team training'); }},'Mark attended'));
          ap(row, h('button',{class:'btn quiet',type:'button',onclick:()=>{ snap(); ensure().shifts = ensure().shifts.filter(x => x.id !== shift.id); audit('Deleted a shift '+fmtDate(shift.date)+' '+span(shift), site); A.save(); dlg.close(); A.route(); toast('Deleted. Use Undo to bring it back.'); }},'Delete'));
        }
      } else if (S().tier === 'caregiver'){
        const mine = shift.staff === me();
        if (!shift.staff) ap(row, h('button',{class:'btn',type:'button',onclick:()=>{ dlg.close(); requestDialog('pickup', shift); }},'I can take this shift'));
        if (mine) ap(row, h('button',{class:'btn ghost',type:'button',onclick:()=>{ dlg.close(); requestDialog('cover', shift); }},'Ask someone to cover'), h('button',{class:'btn quiet',type:'button',onclick:()=>{ dlg.close(); requestDialog('giveup', shift); }},'I can\'t make it'));
        if (mine) ap(row, calRow(shift));
      }
      ap(box, row);
      refresh();
    });
  }
  function calRow(s){
    const e = shiftEvent(s);
    return h('div',{class:'row'}, h('a',{class:'btn quiet sm',href:gcalUrl(e),target:'_blank',rel:'noopener'},'Google Calendar'), h('a',{class:'btn quiet sm',href:outlookUrl(e),target:'_blank',rel:'noopener'},'Outlook'), h('button',{class:'btn quiet sm',type:'button',onclick:()=>download('shift-'+s.date+'.ics','text/calendar',toIcs([e]))},'.ics'));
  }
  function repeatDialog(shift){
    dialog('Repeat this shift', (box, dlg) => {
      const how = sel([['week','Same day every week'],['day','Every day'],['alt','Every other day'],['pitman','2 on, 2 off, 3 on (2-2-3 rotation)']], 'week');
      const n = h('input',{type:'number', min:'1', max:'52', value:'4'});
      const out = h('p',{class:'small','aria-live':'polite'});
      ap(box, h('p',{class:'small'}, (shift.staff||'Open shift')+' · '+span(shift)+' · starting '+dayFmt(dn(shift.date))), field('Pattern', how), field('How many more times (weeks for the rotation)', n), out,
        h('div',{class:'row'}, h('button',{class:'btn',type:'button',onclick:go},'Repeat it'), h('button',{class:'btn quiet',type:'button',onclick:()=>dlg.close()},'Cancel')));
      function days(){
        const d0 = dn(shift.date), k = Math.max(1, Math.min(52, +n.value||1)), res = [];
        if (how.value === 'week') for (let i = 1; i <= k; i++) res.push(d0+7*i);
        if (how.value === 'day') for (let i = 1; i <= k; i++) res.push(d0+i);
        if (how.value === 'alt') for (let i = 1; i <= k; i++) res.push(d0+2*i);
        if (how.value === 'pitman'){ const on = [1,1,0,0,1,1,1, 0,0,1,1,0,0,0]; for (let i = 1; i < 14*k; i++) if (on[i%14]) res.push(d0+i); }
        return res;
      }
      const upd = () => out.textContent = 'Adds up to '+days().length+' shifts. Days where '+(shift.staff||'this slot')+' is already working are skipped.';
      how.addEventListener('change', upd); n.addEventListener('input', upd); upd();
      function go(){
        snap(); let added = 0, skipped = 0;
        days().forEach(d => { const c = Object.assign({}, shift, {id:uid(), date:di(d), callin:false, attended:false});
          const clash = c.staff && ensure().shifts.some(s => s.site===c.site && s.staff===c.staff && absA(s) < absB(c) && absB(s) > absA(c));
          if (clash) skipped++; else { ensure().shifts.push(c); added++; } });
        audit('Repeated a shift '+added+' times ('+how.options[how.selectedIndex].text+')', shift.site); A.save(); dlg.close(); A.route(); toast('Added '+added+(skipped?', skipped '+skipped+' that clashed':''));
      }
    });
  }

  // ---------- move and copy: drag with mouse or finger, or tap "Move…" / "Copy to…" then a place ----------
  let carry = null, justDragged = 0;
  function startCarry(id, mode){ carry = {id, mode}; A.route(); toast(mode==='copy' ? 'Tap where the copy should go' : 'Tap where the shift should go'); }
  function place(id, target, copyIt){
    const L = ensure().shifts, s = L.find(x => x.id === id); if (!s) return;
    const nd = target.date || s.date, ns = target.staff === undefined ? s.staff : (target.staff || null);
    if (!copyIt && nd === s.date && ns === s.staff) return;
    snap();
    const t = copyIt ? Object.assign({}, s, {id:uid(), callin:false, attended:false}) : s;
    t.date = nd; t.staff = ns;
    if (copyIt) L.push(t);
    audit((copyIt?'Copied':'Moved')+' a shift to '+(ns||'open')+', '+fmtDate(nd)+' '+span(t), s.site); A.save();
    carry = null; A.route();
    const iss = check(t.site, dn(nd)-1, dn(nd)+1).filter(i => (i.ids||[]).includes(t.id) || (ns && i.who === ns));
    toast((copyIt?'Copied':'Moved')+'. '+(iss.length ? iss.length+' thing'+(iss.length>1?'s':'')+' to check.' : 'No problems found.'));
  }
  function draggable(el, s){
    el.addEventListener('contextmenu', e => { if (e.pointerType !== 'mouse') e.preventDefault(); });
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !canEdit()) return;
      const touch = e.pointerType !== 'mouse', sx = e.clientX, sy = e.clientY;
      let started = false, timer = null, ghost = null, over = null, lx = sx, ly = sy;
      const begin = () => { started = true; ghost = el.cloneNode(true); ghost.classList.add('ghost'); ghost.removeAttribute('id'); ghost.setAttribute('aria-hidden','true'); document.body.append(ghost); document.body.classList.add('dragging'); pos(lx, ly); try { navigator.vibrate && navigator.vibrate(12); } catch(x){} };
      const pos = (x, y) => { if (ghost) ghost.style.transform = 'translate('+(x+10)+'px,'+(y+10)+'px)'; };
      const block = ev => { if (started) ev.preventDefault(); };
      const move = ev => {
        lx = ev.clientX; ly = ev.clientY;
        if (!started){ const d = Math.hypot(lx-sx, ly-sy); if (touch){ if (d > 10) cleanup(); return; } if (d > 6) begin(); else return; }
        ev.preventDefault(); pos(lx, ly);
        if (ly < 70) window.scrollBy(0, -14); else if (ly > innerHeight - 70) window.scrollBy(0, 14);
        const tEl = document.elementFromPoint(lx, ly), cell = tEl && tEl.closest('[data-drop]');
        if (over !== cell){ over && over.classList.remove('over'); over = cell; over && over.classList.add('over'); }
      };
      const up = ev => { if (started){ justDragged = Date.now(); if (over) place(s.id, {date:over.dataset.date, staff:over.dataset.staff === undefined ? undefined : over.dataset.staff}, ev.ctrlKey || ev.altKey || ev.metaKey || ensure().ui.copyMode); } cleanup(); };
      const cleanup = () => { clearTimeout(timer); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cleanup); document.removeEventListener('touchmove', block); ghost && ghost.remove(); over && over.classList.remove('over'); document.body.classList.remove('dragging'); };
      if (touch) timer = setTimeout(begin, 380);
      window.addEventListener('pointermove', move, {passive:false}); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cleanup);
      document.addEventListener('touchmove', block, {passive:false});
    });
  }

  // ---------- shift chip ----------
  function pill(s, issMap, showName){
    const iss = issMap.get(s.id) || [];
    const lbl = (s.staff || 'Open shift')+', '+dayFmt(dn(s.date),{weekday:'long', month:'long', day:'numeric'})+', '+tLong(s.start)+' to '+tLong(s.end)+(s.kind==='training'?', training':'')+(iss.length?', '+iss.length+' to check':'');
    const b = h('button',{type:'button', class:'sp'+(s.staff?'':' open')+(s.kind==='training'?' train':'')+(iss.some(i => i.sev==='fix')?' bad':iss.length?' warn':''), 'aria-label':lbl, 'data-id':s.id},
      h('b',null,span(s)),
      showName ? h('span',null, s.staff || 'Open shift') : (s.staff ? null : h('span',null,'Open')),
      s.kind==='training' ? h('span',{class:'tag'},'Training') : null,
      iss.length ? h('span',{class:'tag flag','aria-hidden':'true'},'⚠ '+iss.length) : null);
    b.addEventListener('click', () => { if (Date.now() - justDragged < 400) return; editor(s); });
    draggable(b, s);
    return b;
  }
  function dropCell(tag, data, kids, cls){
    const el = h(tag, Object.assign({class:(cls||'')+' cell', 'data-drop':'1'}, data), kids);
    if (carry){
      const c = ensure().shifts.find(x => x.id === carry.id);
      if (c) ap(el, h('button',{class:'btn ghost sm placeit',type:'button',onclick:()=>place(carry.id, {date:data['data-date'], staff:data['data-staff']}, carry.mode==='copy'), 'aria-label':(carry.mode==='copy'?'Put the copy':'Move it')+' here: '+(data['data-staff'] === undefined ? '' : (data['data-staff']||'Open shifts')+', ')+dayFmt(dn(data['data-date']),{weekday:'long', month:'long', day:'numeric'})}, carry.mode==='copy'?'Copy here':'Move here'));
    }
    return el;
  }

  // ---------- the screen ----------
  R.schedule = v => {
    const sc = ensure(), site = S().site, r = rulesFor(site), ui = sc.ui;
    v.classList.add('wide');
    if (site === 'family'){ ap(v, head('Schedule', 'Scheduling is for licensed homes', 'Pick Maple Grove, Birch Hollow or Cedar Lane at the top. Families can use the Hand-off packet for helpers.')); return; }
    const mgr = canEdit(), cg = S().tier === 'caregiver';
    const cur = dn(ui.cursor || A.isoDay(new Date()));
    const phone = window.matchMedia('(max-width: 760px)').matches;
    const layout = ui.layout || (phone ? 'day' : 'person');
    let d0, d1;
    if (ui.view === 'month'){ const m = new Date(cur*864e5); const first = dn(m.toISOString().slice(0,8)+'01'); d0 = weekStartOf(first, r.weekStart); const last = dn(di(dn(new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth()+1, 1)).toISOString().slice(0,10))-1)); d1 = weekStartOf(last, r.weekStart)+6; }
    else { d0 = weekStartOf(cur, r.weekStart); d1 = d0+6; }
    const issues = check(site, d0, d1);
    const issMap = new Map(); issues.forEach(i => (i.ids||[]).forEach(id => { if (!issMap.has(id)) issMap.set(id, []); issMap.get(id).push(i); }));
    const pend = sc.requests.filter(x => x.site === site && x.status === 'Pending');
    const pubKey = di(d0), pub = (sc.published[site]||{})[pubKey];

    ap(v, head(cg ? 'My schedule · '+siteObj(site).name : 'Schedule · '+siteObj(site).name, cg ? 'Your shifts, open shifts and requests' : 'Build, check and share the schedule',
      cg ? 'Everyone can see the team schedule. Ask for open shifts, swaps or time off here, and your manager approves.' : 'Drag a shift to move it (hold Ctrl or turn on Copy mode to copy). On a phone, press and hold a shift, then drag. Or tap a shift for Move, Copy and Repeat.'));
    if (cg) ap(v, mySection(site, issMap));
    if (carry) ap(v, h('div',{class:'card warn',role:'status'}, h('b',null, carry.mode==='copy' ? 'Copying a shift.' : 'Moving a shift.'), h('span',{class:'small'},'Tap "'+(carry.mode==='copy'?'Copy here':'Move here')+'" in the day or row where it should go.'), h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ carry = null; A.route(); }},'Cancel'))));

    // toolbar
    const step = ui.view === 'month' ? 'month' : 'week';
    const shiftCur = k => { if (step === 'month'){ const m = new Date(cur*864e5); ui.cursor = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth()+k, 1)).toISOString().slice(0,10); } else ui.cursor = di(cur + 7*k); A.save(); A.route(); };
    const seg = (key, opts) => h('div',{class:'seg',role:'group','aria-label':key==='view'?'Week or month':'Layout'}, opts.map(o => h('button',{type:'button','aria-pressed':String((key==='view'?ui.view:layout)===o[0]), onclick:()=>{ ui[key] = o[0]; A.save(); A.route(); }}, o[1])));
    const title = ui.view === 'month' ? dayFmt(cur, {month:'long', year:'numeric'}) : dayFmt(d0, {month:'short', day:'numeric'})+' – '+dayFmt(d1, {month:'short', day:'numeric', year:'numeric'});
    const sum = {fix:issues.filter(i => i.sev==='fix').length, check:issues.filter(i => i.sev==='check').length};
    ap(v, h('div',{class:'card schedbar'},
      h('div',{class:'row'},
        h('button',{class:'btn quiet sm',type:'button',onclick:()=>shiftCur(-1),'aria-label':'Previous '+step},'‹'),
        h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ ui.cursor = A.isoDay(new Date()); A.save(); A.route(); }},'Today'),
        h('button',{class:'btn quiet sm',type:'button',onclick:()=>shiftCur(1),'aria-label':'Next '+step},'›'),
        h('h2',{class:'stitle'},title)),
      h('div',{class:'row'}, seg('view', [['week','Week'],['month','Month']]), ui.view === 'week' ? seg('layout', [['person','By person'],['day','By day']]) : null,
        mgr ? h('label',{class:'row small',for:'cpMode'}, h('input',{type:'checkbox',id:'cpMode',checked:!!ui.copyMode,onchange:e=>{ ui.copyMode = e.target.checked; A.save(); }}),'Copy mode') : null,
        mgr ? h('button',{class:'btn quiet sm',type:'button',disabled:!undoStack.length,onclick:undo},'Undo') : null),
      h('div',{class:'row small'},
        sum.fix ? h('a',{class:'chip amber',href:'#sChk'},sum.fix+' must fix') : h('span',{class:'chip calm'},'✓ Nothing to fix'),
        sum.check ? h('a',{class:'chip',href:'#sChk'},sum.check+' to check') : null,
        pend.length && canApprove() ? h('a',{class:'chip',href:'#sReq'},pend.length+' request'+(pend.length>1?'s':'')+' waiting') : null,
        ui.view === 'week' ? h('span',{class:'chip grey'}, pub ? 'Published '+A.fmtTime(pub.at) : 'Draft, not published') : null)));

    if (ui.view === 'month') ap(v, monthView(site, d0, d1, cur, issues, issMap));
    else if (layout === 'person') ap(v, personView(site, d0, issues, issMap));
    else ap(v, dayView(site, d0, d0+6, issues, issMap));

    if (canApprove() && !cg) ap(v, requestsCard(site));
    ap(v, checkCard(site, issues));
    if (mgr){
      if (ui.view === 'week') ap(v, publishCard(site, d0, issues));
      ap(v, quickCard(site, d0), bulkCard(site, d0), weekToolsCard(site, d0), templatesCard(), rulesCard(site));
    }
    ap(v, exportCard(site, d0, d1));
    if (!mgr && !cg) ap(v, h('p',{class:'small muted'},'You can view the schedule. A manager or owner can give you permission to build it in Services and access.'));
    const p = A.param();
    if (p === 'export'){ const e = document.getElementById('sExport'); e && setTimeout(() => e.scrollIntoView(), 50); }
    if (p === 'cover' && mgr){ const open = shiftsAt(site).filter(s => !s.staff && s.kind !== 'training' && dn(s.date) >= todayN()).sort((a,b) => absA(a)-absA(b))[0]; if (open) setTimeout(() => editor(open), 60); else toast('No open shifts. Tap a shift and choose Called off to open it.'); history.replaceState(null,'','#/schedule'); }
  };

  function hoursIn(site, n, d0, d1){ return hrs(shiftsAt(site).filter(s => s.staff===n && dn(s.date) >= d0 && dn(s.date) <= d1).reduce((t,s) => t+mins(s), 0)); }
  function dayHead(site, d, issues){
    const di0 = di(d), fix = issues.filter(i => i.date === di0 && i.sev === 'fix').length;
    return h('span',{class:'dh'}, h('b',null,dayFmt(d,{weekday:'short'})+' '+dayFmt(d,{day:'numeric'})), fix ? h('span',{class:'chip amber'},'⚠ '+fix) : h('span',{class:'chip calm'},'✓'));
  }
  function addBtn(site, d, staff, label){
    if (!canEdit()) return null;
    return h('button',{class:'addb',type:'button','aria-label':label,onclick:()=>{
      const tp = ensure().templates.find(t => t.id === (ensure().ui.lastTpl||'')) || ensure().templates[0];
      editor({id:uid(), site, date:di(d), start:tp.start, end:tp.end, staff:staff||null, kind:tp.kind||'shift', tpl:tp.id}, true);
    }},'+');
  }
  function personView(site, d0, issues, issMap){
    const days = [0,1,2,3,4,5,6].map(i => d0+i), r = rulesFor(site), names = staffNames(site);
    const list = shiftsAt(site).filter(s => dn(s.date) >= d0 && dn(s.date) <= d0+6);
    const tb = h('table',{class:'sgrid'}, h('caption',{class:'sr'},'Schedule by person for the week of '+dayFmt(d0,{month:'long', day:'numeric'})),
      h('thead',null, h('tr',null, h('th',{scope:'col'},'Staff'), days.map(d => h('th',{scope:'col', class:d===todayN()?'today':''}, dayHead(site, d, issues))))));
    const body = h('tbody');
    const row = (label, n, sub) => {
      const tr = h('tr',null, h('th',{scope:'row'}, h('span',null,label), sub));
      days.forEach(d => {
        const here = list.filter(s => s.date === di(d) && (n ? s.staff === n : !s.staff)).sort((a,b) => absA(a)-absA(b));
        const off = n && timeOffFor(site, n, di(d));
        ap(tr, dropCell('td', {'data-date':di(d), 'data-staff':n||''}, [here.map(s => pill(s, issMap, false)), off ? h('span',{class:'chip '+(off.status==='Approved'?'grey':'amber')},off.status==='Approved'?'Time off':'Time off asked') : null, addBtn(site, d, n, 'Add a shift for '+(n||'open shifts')+' on '+dayFmt(d,{weekday:'long', month:'long', day:'numeric'}))]));
      });
      ap(body, tr);
    };
    names.forEach(n => { const hh = hoursIn(site, n, d0, d0+6); row(n, n, h('span',{class:'small '+(hh > r.otWeek ? 'ot' : 'muted')}, hh+' hrs'+(hh > r.otWeek ? ' (OT)' : ''))); });
    row('Open shifts', null, h('span',{class:'small muted'},'Anyone can ask'));
    // on call row
    const oc = h('tr',{class:'oncall'}, h('th',{scope:'row'},'On call', h('span',{class:'small muted'},'Night help calls')));
    days.forEach(d => ap(oc, h('td',null, onCallBtn(site, d))));
    ap(body, oc);
    ap(tb, body);
    return h('div',{class:'card'}, h('div',{class:'tablewrap'}, tb));
  }
  function onCallBtn(site, d){
    const oc = ensure().oncall[site] || {def:'Manager', days:{}}, who = oc.days[di(d)] || oc.def;
    if (!canEdit()) return h('span',{class:'small'},who);
    return h('button',{class:'linkbtn small',type:'button','aria-label':'On call '+dayFmt(d,{weekday:'long'})+': '+who+'. Change',onclick:()=>dialog('Who is on call '+dayFmt(d,{weekday:'long', month:'short', day:'numeric'})+'?', (box, dlg) => {
      const s = sel([['Manager','Manager'],['On-call RN','On-call RN'],['Owner','Owner']].concat(staffNames(site).filter(n => n !== 'Manager').map(n => [n, n+' (lead)'])), who);
      const all = h('input',{type:'checkbox',id:'ocAll'});
      ap(box, h('p',{class:'small'},'Night help sends calls that need a manager to this person. Calls that can wait go to the morning log.'), field('On call', s), h('label',{class:'row small',for:'ocAll'}, all, 'Make this the usual on-call person'),
        h('div',{class:'row'}, h('button',{class:'btn',type:'button',onclick:()=>{ ensure().oncall[site] = oc; if (all.checked){ oc.def = s.value; oc.days = {}; } else oc.days[di(d)] = s.value; audit('Set on call '+(all.checked?'(usual)':fmtDate(di(d)))+': '+s.value, site); A.save(); dlg.close(); A.route(); }},'Save')));
    })}, who);
  }
  function dayView(site, d0, d1, issues, issMap, only){
    const wrap = h('div',{class:'daylist'});
    for (let d = d0; d <= d1; d++){
      if (only != null && d !== only) continue;
      const list = shiftsAt(site).filter(s => s.date === di(d)).sort((a,b) => absA(a)-absA(b) || String(a.staff).localeCompare(String(b.staff)));
      const offs = ensure().requests.filter(x => x.type==='timeoff' && x.site===site && x.from<=di(d) && x.to>=di(d) && x.status!=='Declined');
      const dIss = issues.filter(i => i.date === di(d) && i.sev === 'fix');
      ap(wrap, dropCell('section', {'data-date':di(d), 'aria-label':dayFmt(d,{weekday:'long', month:'long', day:'numeric'})}, [
        h('div',{class:'row',style:'justify-content:space-between'}, h('h3',null, dayFmt(d,{weekday:'long', month:'short', day:'numeric'})+(d===todayN()?' · Today':'')), dIss.length ? h('span',{class:'chip amber'},'⚠ '+dIss.length+' must fix') : h('span',{class:'chip calm'},'✓ Covered')),
        h('div',{class:'pills'}, list.length ? list.map(s => pill(s, issMap, true)) : h('p',{class:'small muted'},'No shifts yet.')),
        offs.length ? h('p',{class:'small muted'}, offs.map(o => o.by+' '+(o.status==='Approved'?'off':'asked off')).join(' · ')) : null,
        h('div',{class:'row small'}, h('span',{class:'muted'},'On call: '), onCallBtn(site, d), canEdit() ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>addBtn(site, d, null, '').click()},'+ Add shift') : null)
      ], 'card day'+(d===todayN()?' today':'')));
    }
    return wrap;
  }
  function monthView(site, d0, d1, cur, issues, issMap){
    const ui = ensure().ui, month = new Date(cur*864e5).getUTCMonth();
    const g = h('div',{class:'mgrid',role:'grid','aria-label':'Month'});
    const r = rulesFor(site);
    ap(g, h('div',{class:'mrow',role:'row'}, [0,1,2,3,4,5,6].map(i => h('div',{class:'mh',role:'columnheader'}, DOW[(i+r.weekStart)%7]))));
    let row;
    for (let d = d0; d <= d1; d++){
      if ((d-d0) % 7 === 0){ row = h('div',{class:'mrow',role:'row'}); ap(g, row); }
      const list = shiftsAt(site).filter(s => s.date === di(d)).sort((a,b) => absA(a)-absA(b));
      const fix = issues.filter(i => i.date === di(d) && i.sev === 'fix').length, open = list.filter(s => !s.staff && s.kind!=='training').length;
      const btn = h('button',{type:'button',class:'mday'+(new Date(d*864e5).getUTCMonth()!==month?' other':'')+(d===todayN()?' today':'')+(di(d)===ui.cursor?' sel':''),'aria-label':dayFmt(d,{weekday:'long', month:'long', day:'numeric'})+': '+list.length+' shifts'+(open?', '+open+' open':'')+(fix?', '+fix+' must fix':''),
        onclick:()=>{ ui.cursor = di(d); A.save(); A.route(); setTimeout(() => { const x = document.getElementById('mDay'); x && x.scrollIntoView({behavior:'smooth', block:'nearest'}); }, 30); }},
        h('b',null,String(new Date(d*864e5).getUTCDate())),
        h('span',{class:'mstat'}, fix ? h('span',{class:'dot bad'},'⚠'+fix) : list.length ? h('span',{class:'dot ok'},'✓') : null, open ? h('span',{class:'dot open'},open+' open') : null),
        h('span',{class:'mlist'}, list.slice(0,3).map(s => h('span',null, tShort(s.start)+' '+(s.staff ? s.staff.replace('Caregiver ','') : 'Open')))), list.length > 3 ? h('span',{class:'mmore'},'+'+(list.length-3)) : null);
      ap(row, dropCell('div', {'data-date':di(d), role:'gridcell'}, [btn], 'mcell'));
    }
    const pick = dn(ui.cursor);
    return h('div',{class:'grid'}, h('div',{class:'card'}, g, h('p',{class:'small muted'},'Tap a day to see and edit its shifts below. Drag a day\'s shifts from the list to another day in the month.')),
      h('div',{id:'mDay'}, pick >= d0 && pick <= d1 ? dayView(site, pick, pick, issues, issMap) : null));
  }

  // ---------- caregiver: my shifts and open shifts ----------
  function mySection(site, issMap){
    const n = me(), sc = ensure(), t = todayN();
    const mine = shiftsAt(site).filter(s => s.staff === n && dn(s.date) >= t && dn(s.date) < t+14).sort((a,b) => absA(a)-absA(b));
    const open = shiftsAt(site).filter(s => !s.staff && s.kind !== 'training' && dn(s.date) >= t).sort((a,b) => absA(a)-absA(b));
    const reqs = sc.requests.filter(x => x.site === site && x.by === n).sort((a,b) => b.at.localeCompare(a.at)).slice(0,6);
    const wrap = h('div',{class:'grid g2'});
    ap(wrap, h('div',{class:'card'}, h('h2',null,'Your next two weeks ('+n+')'),
      mine.length ? h('div',{class:'list'}, mine.map(s => h('div',{class:'item'}, h('div',{class:'meta'}, h('span',{class:'chip'},dayFmt(dn(s.date),{weekday:'short', month:'short', day:'numeric'})), s.kind==='training' ? h('span',{class:'chip calm'},'Training') : null), h('b',null,tLong(s.start)+' to '+tLong(s.end)), window.SSStation ? SSStation.codeChip(s) : null,
        h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>requestDialog('cover', s)},'Ask someone to cover'), h('button',{class:'btn quiet sm',type:'button',onclick:()=>requestDialog('giveup', s)},'I can\'t make it')), calRow(s)))) : h('p',{class:'muted'},'No shifts in the next two weeks.'),
      h('div',{class:'row'}, h('button',{class:'btn ghost sm',type:'button',onclick:()=>requestDialog('timeoff')},'Ask for time off'), h('button',{class:'btn ghost sm',type:'button',onclick:()=>requestDialog('change')},'Ask for a schedule change'),
        mine.length ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>download('my-shifts.ics','text/calendar',toIcs(mine.map(shiftEvent)))},'All my shifts (.ics)') : null)));
    ap(wrap, h('div',{class:'grid'},
      h('div',{class:'card'}, h('h2',null,'Open shifts'), open.length ? h('div',{class:'list'}, open.slice(0,6).map(s => { const iss = fitFor(s, n).filter(i => i.who === n);
        return h('div',{class:'item'}, h('b',null,dayFmt(dn(s.date))+' · '+tLong(s.start)+' to '+tLong(s.end)), iss.length ? h('span',{class:'small'},'Heads up: '+iss.map(i => i.text).join(' ')) : null, h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>requestDialog('pickup', s)},'I can take it'))); })) : h('p',{class:'muted'},'No open shifts right now.')),
      h('div',{class:'card'}, h('h2',null,'Your requests'), reqs.length ? h('div',{class:'list'}, reqs.map(x => h('div',{class:'item'}, h('div',{class:'meta'}, h('span',{class:'chip '+(x.status==='Approved'?'calm':x.status==='Declined'?'grey':'amber')},x.status), h('span',null,A.fmtTime(x.at))), h('span',null,reqText(x)), x.reply ? h('span',{class:'small'},'Manager: '+x.reply) : null))) : h('p',{class:'muted'},'Nothing yet.'))));
    return wrap;
  }
  const TYPES = {pickup:'Pick up an open shift', cover:'Someone covers my shift', giveup:'Can\'t make a shift', timeoff:'Time off', change:'Schedule change'};
  function reqText(x){
    const s = x.shift && ensure().shifts.find(y => y.id === x.shift);
    const when = s ? dayFmt(dn(s.date))+', '+span(s) : '';
    if (x.type === 'pickup') return x.by+' asks to take the open shift '+when+'.';
    if (x.type === 'cover') return x.by+' asks '+(x.to||'someone')+' to cover '+when+'.';
    if (x.type === 'giveup') return x.by+' can\'t make '+when+'. It would become an open shift.';
    if (x.type === 'timeoff') return x.by+' asks for '+(x.pto||'time off')+' '+(x.from===x.to ? dayFmt(dn(x.from)) : dayFmt(dn(x.from))+' to '+dayFmt(dn(x.to)))+'.';
    return x.by+' asks for a schedule change.';
  }
  function requestDialog(type, shift){
    const site = S().site, n = me();
    dialog(TYPES[type], (box, dlg) => {
      const note = h('textarea',{maxlength:'300',style:'min-height:4rem',placeholder:'Optional. You don\'t have to give a reason.'});
      const extra = [];
      let to, from, until, kind;
      if (shift) ap(box, h('p',null,h('b',null,dayFmt(dn(shift.date))+' · '+tLong(shift.start)+' to '+tLong(shift.end))));
      if (type === 'cover'){ to = sel([['','Anyone the manager picks']].concat(staffNames(site).filter(x => x !== n).map(x => [x, x])), ''); extra.push(field('Who will cover?', to)); }
      if (type === 'timeoff'){ const t = di(todayN()+7); from = h('input',{type:'date',value:t}); until = h('input',{type:'date',value:t}); kind = sel([['PTO','Paid time off'],['Unpaid','Unpaid'],['Other','Other']], 'PTO');
        extra.push(h('div',{class:'grid g3'}, field('From', from), field('To', until), field('Kind', kind)), h('p',{class:'small muted'},'Paid time off left (sample): '+prof(n).pto+' hours.')); }
      if (type === 'change') note.placeholder = 'For example: could I move to day shifts in January?';
      const warn = h('div',{'aria-live':'polite'});
      if (type === 'pickup' && shift){ const iss = fitFor(shift, n).filter(i => i.who === n); if (iss.length) ap(warn, h('div',{class:'card warn'}, h('b',null,'Your manager will see this too:'), iss.map(i => h('span',{class:'small'},i.text)))); }
      ap(box, ...extra, warn, field(type === 'change' ? 'What would you like?' : 'Note to your manager', note),
        h('p',{class:'small muted'},'Your request goes to your manager privately. Coworkers don\'t see it.'),
        h('div',{class:'row'}, h('button',{class:'btn',type:'button',onclick:()=>{
          if (type === 'change' && !note.value.trim()){ toast('Say what change you would like'); return; }
          if (type === 'timeoff' && (!from.value || !until.value || until.value < from.value)){ toast('Check the dates'); return; }
          const r = {id:uid(), site, type, by:n, status:'Pending', at:new Date().toISOString(), note:note.value.trim()};
          if (shift) r.shift = shift.id; if (to) r.to = to.value || null;
          if (type === 'timeoff'){ r.from = from.value; r.to = until.value; r.pto = kind.value; }
          ensure().requests.push(r); audit('Sent a request: '+TYPES[type], site); A.save(); dlg.close(); A.route(); toast('Sent to your manager');
        }},'Send request'), h('button',{class:'btn quiet',type:'button',onclick:()=>dlg.close()},'Cancel')));
    });
  }

  // ---------- manager: approvals ----------
  function applyReq(x, L){
    const s = x.shift && L.find(y => y.id === x.shift);
    if (x.type === 'pickup' && s) s.staff = x.by;
    if (x.type === 'cover' && s) s.staff = x.to || null;
    if (x.type === 'giveup' && s){ s.staff = null; s.callin = true; }
  }
  // Approve or decline one request (used by the approvals card and by the chat assistant).
  function decideReq(x, st, replyText){
    const sc = ensure(), site = x.site;
    snap();
    x.status = st; x.decidedAt = new Date().toISOString(); x.decidedBy = actor(); x.reply = String(replyText||'').trim().slice(0,200);
    if (st === 'Approved'){ applyReq(x, sc.shifts);
      if (x.type === 'timeoff') sc.shifts.filter(y => y.site===site && y.staff===x.by && y.date>=x.from && y.date<=x.to).forEach(y => { y.staff = null; });
      if (x.type === 'timeoff' && x.pto === 'PTO'){ const p = prof(x.by); const days = dn(x.to)-dn(x.from)+1; p.pto = Math.max(0, (p.pto||0) - days*8); } }
    audit(st+' a request: '+reqText(x), site); A.save();
  }
  function requestsCard(site){
    const sc = ensure(), pend = sc.requests.filter(x => x.site === site && x.status === 'Pending').sort((a,b) => a.at.localeCompare(b.at));
    const done = sc.requests.filter(x => x.site === site && x.status !== 'Pending').sort((a,b) => (b.decidedAt||'').localeCompare(a.decidedAt||'')).slice(0,4);
    const card = h('div',{class:'card',id:'sReq'}, h('h2',null,'Requests to approve ('+pend.length+')'));
    if (!pend.length) ap(card, h('p',{class:'muted'},'Nothing waiting.'));
    pend.forEach(x => {
      const s = x.shift && sc.shifts.find(y => y.id === x.shift);
      let iss = [];
      if (s){ const d = dn(s.date); iss = diffIssues(site, d-1, d+7, withChange(L => applyReq(x, L))); }
      if (x.type === 'timeoff'){ iss = shiftsAt(site).filter(y => y.staff === x.by && y.date >= x.from && y.date <= x.to).map(y => ({sev:'check', text:x.by+' is scheduled '+dayFmt(dn(y.date))+' '+span(y)+'. Approving opens this shift.'})); }
      const reply = h('input',{type:'text',maxlength:'200',placeholder:'Optional reply (kind and short)'});
      const quick = ['Thanks, approved.','Already covered, thanks for offering.','This would put you into overtime.','We need someone cleared for this shift.','Let\'s talk at your next shift.'].map(q => h('button',{type:'button',class:'chip',onclick:()=>{ reply.value = q; }},q));
      const decide = st => { decideReq(x, st, reply.value); A.route(); toast(st); };
      ap(card, h('div',{class:'item'},
        h('div',{class:'meta'}, h('span',{class:'chip'},TYPES[x.type]), h('span',null,'Asked '+A.fmtTime(x.at))),
        h('b',null,reqText(x)), x.note ? h('span',{class:'small'},'"'+x.note+'"') : null,
        iss.length ? h('div',{class:'list'}, iss.slice(0,4).map(i => h('div',{class:'small'}, sevChip(i.sev||'check'), ' ', i.text))) : (s || x.type === 'timeoff' ? h('span',{class:'small'},'✓ Approving adds no new problems.') : null),
        field('Reply', reply), h('div',{class:'chips'}, quick),
        h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>decide('Approved')},'Approve'), h('button',{class:'btn quiet sm',type:'button',onclick:()=>decide('Declined')},'Decline'))));
    });
    if (done.length) ap(card, h('details',null, h('summary',{class:'small'},'Recently decided'), h('div',{class:'list'}, done.map(x => h('div',{class:'small'}, x.status+' · '+reqText(x))))));
    return card;
  }
  function checkCard(site, issues){
    const card = h('div',{class:'card',id:'sChk'}, h('h2',null,'Schedule check'),
      h('p',{class:'small muted'},'Checks staffing minimums, who is cleared to work alone, medication and RN-delegated tasks, double bookings, rest between shifts, overtime, time off and background rechecks. The minimums are your home\'s settings below.'));
    if (!issues.length){ ap(card, h('p',null,'✓ Nothing found for these dates.')); return card; }
    const groups = {fix:'Must fix before you publish', check:'Worth a look', note:'Notes'};
    Object.keys(groups).forEach(k => { const g = issues.filter(i => i.sev === k); if (!g.length) return;
      const list = h('div',{class:'list'}, g.slice(0,12).map(i => issueRow(i, goTo)));
      ap(card, h('h3',null,groups[k]+' ('+g.length+')'), list, g.length > 12 ? h('p',{class:'small muted'},'And '+(g.length-12)+' more. Narrow to one week to see them all.') : null);
    });
    return card;
  }
  function goTo(i){
    const ui = ensure().ui; ui.cursor = i.date; if (ui.view === 'month'){ A.save(); A.route(); }
    setTimeout(() => {
      const id = (i.ids||[])[0], el = id && document.querySelector('.sp[data-id="'+id+'"]');
      if (el){ el.scrollIntoView({behavior:'smooth', block:'center'}); el.classList.add('pulse'); setTimeout(() => el.classList.remove('pulse'), 1600); el.focus({preventScroll:true}); }
      else { const c = document.querySelector('[data-date="'+i.date+'"]'); c && c.scrollIntoView({behavior:'smooth', block:'center'}); }
    }, 40);
  }
  function publishCard(site, d0, issues){
    const sc = ensure(), key = di(d0), pub = (sc.published[site]||{})[key];
    const fix = issues.filter(i => i.sev === 'fix' && i.date >= key && i.date <= di(d0+6)).length;
    return h('div',{class:'card soft'}, h('h2',null,'Publish this week'),
      h('p',{class:'small'}, pub ? 'Published '+A.fmtTime(pub.at)+(pub.note ? '. Note: '+pub.note : '')+'. Changes after publishing show to staff right away.' : 'Staff see a draft label until you publish. Publishing tells the team the week is final.'),
      h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{
        const done = note => { sc.published[site] = sc.published[site] || {}; sc.published[site][key] = {at:new Date().toISOString(), note:note||''}; audit('Published the week of '+fmtDate(key)+(fix?' with '+fix+' open items':''), site); A.save(); A.route(); toast('Published. Staff see it in My schedule.'); };
        if (!fix) return done();
        dialog('Publish with '+fix+' item'+(fix>1?'s':'')+' to fix?', (box, dlg) => {
          const note = h('textarea',{style:'min-height:4rem',placeholder:'What is the plan? For example: agency staff confirmed for Friday night.'});
          ap(box, h('p',{class:'small'},'You can publish now and fix them after. A short note keeps a record of the plan.'), field('Plan', note),
            h('div',{class:'row'}, h('button',{class:'btn',type:'button',onclick:()=>{ if (!note.value.trim()){ toast('Add a short plan first'); return; } dlg.close(); done(note.value.trim()); }},'Publish with this note'), h('button',{class:'btn quiet',type:'button',onclick:()=>dlg.close()},'Go back and fix')));
        });
      }}, pub ? 'Publish again' : 'Publish this week')));
  }
  function quickCard(site, d0){
    const sc = ensure();
    const tp = sel(sc.templates.map(t => [t.id, t.name+' · '+tShort(t.start)+'–'+tShort(t.end)]), sc.ui.lastTpl || sc.templates[0].id);
    const who = sel([['','Open shift']].concat(staffNames(site).map(n => [n, n])), '');
    const picked = new Set();
    const r = rulesFor(site);
    const dayBtns = [0,1,2,3,4,5,6].map(i => { const dd = (i + r.weekStart) % 7; return h('button',{type:'button',class:'chip','aria-pressed':'false',onclick:e=>{ if (picked.has(dd)) picked.delete(dd); else picked.add(dd); e.currentTarget.setAttribute('aria-pressed', String(picked.has(dd))); upd(); }}, DOW[dd]); });
    const weeks = h('input',{type:'number',min:'1',max:'12',value:'1'});
    const out = h('p',{class:'small','aria-live':'polite'});
    const upd = () => out.textContent = picked.size ? 'Adds '+(picked.size*Math.max(1,Math.min(12,+weeks.value||1)))+' shifts starting the week of '+dayFmt(d0,{month:'short', day:'numeric'})+'.' : 'Pick the days.';
    weeks.addEventListener('input', upd); upd();
    return h('div',{class:'card'}, h('h2',null,'Quick assign'),
      h('p',{class:'small muted'},'Pick a shift template, a person and the days. Good for setting up a regular rotation in one go.'),
      h('div',{class:'grid g2'}, field('Shift', tp), field('Who', who)),
      h('div',null, h('span',{class:'small',style:'font-weight:600;color:var(--muted)'},'Days'), h('div',{class:'chips',role:'group','aria-label':'Days of the week'}, dayBtns)),
      field('For how many weeks', weeks), out,
      h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{
        if (!picked.size){ toast('Pick at least one day'); return; }
        const t = sc.templates.find(x => x.id === tp.value); sc.ui.lastTpl = t.id; snap();
        let added = 0, skipped = 0;
        for (let w = 0; w < Math.max(1, Math.min(12, +weeks.value||1)); w++) for (let i = 0; i < 7; i++){
          const d = d0 + w*7 + i; if (!picked.has(dow(d))) continue;
          const s = {id:uid(), site, date:di(d), start:t.start, end:t.end, staff:who.value||null, kind:t.kind||'shift', tpl:t.id};
          if (s.staff && sc.shifts.some(x => x.site===site && x.staff===s.staff && absA(x) < absB(s) && absB(x) > absA(s))){ skipped++; continue; }
          sc.shifts.push(s); added++;
        }
        audit('Quick assign: '+added+' '+t.name+' shifts for '+(who.value||'open'), site); A.save(); A.route(); toast('Added '+added+(skipped?', skipped '+skipped+' that clashed':''));
      }},'Add shifts')));
  }
  // ---------- change many shifts at once (for example every Mon, Tue and Wed day shift for a month) ----------
  function bulkCard(site, d0){
    return h('div',{class:'card'}, h('h2',null,'Change many shifts at once'),
      h('p',{class:'small'},'Pick days of the week and a date range, then change the times, the length (8 or 12 hours), who works them, or remove them. You see every change and any new warnings before anything is saved, and you can undo.'),
      h('div',{class:'row'}, h('button',{class:'btn ghost sm',type:'button',onclick:()=>bulkDialog(site, d0)},'Change many shifts')));
  }
  function bulkDialog(site, d0){
    const sc = ensure(), names = staffNames(site), DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    dialog('Change many shifts', (box, dlg) => {
      const on = new Set([1,2,3]);
      const dayBox = h('fieldset',{class:'bdays'}, h('legend',{class:'small'},'Days of the week'), DAYS.map((d, i) => { const id = 'bd_'+i; return h('label',{class:'row small',for:id}, h('input',{type:'checkbox',id,checked:on.has(i),'aria-label':LONG[i],onchange:e=>{ e.target.checked ? on.add(i) : on.delete(i); reset(); }}), d); }));
      const from = h('input',{type:'date',value:di(d0)}), to = h('input',{type:'date',value:di(d0+27)});
      const inRange = () => shiftsAt(site).filter(x => x.kind !== 'training' && dn(x.date) >= dn(from.value) && dn(x.date) <= dn(to.value));
      const combos = () => [...new Set(inRange().map(x => x.start+'-'+x.end))].sort();
      const which = sel([['all','Every shift on those days']], 'all');
      const fillWhich = () => { const v = which.value; which.textContent = ''; [['all','Every shift on those days']].concat(combos().map(c => { const [a,b] = c.split('-'); return [c, 'Only '+tLong(a)+' to '+tLong(b)+' shifts']; })).forEach(([val, lab]) => which.append(h('option',{value:val, selected:val === v}, lab))); };
      const whoF = sel([['any','Anyone'],['open','Open shifts only']].concat(names.map(n => [n, n+' only'])), 'any');
      const act = sel([['time','Change times or length'],['staff','Change who works them'],['both','Change times and who works them'],['remove','Remove them']], 'time');
      const tpl = sel(sc.templates.filter(t => t.kind !== 'training').map(t => [t.id, t.name+' · '+tShort(t.start)+' to '+tShort(t.end)]).concat([['custom','Custom times']]), sc.templates[0].id);
      const cs = h('input',{type:'time',value:'07:00',step:'900'}), ce = h('input',{type:'time',value:'15:00',step:'900'});
      const custom = h('div',{class:'grid g2',hidden:true}, field('Start', cs), field('End', ce));
      const timeBox = h('div',{class:'grid'}, field('New times', tpl), custom);
      const toWho = sel([['__open','Make them open shifts']].concat(names.map(n => [n, n])), names[0] || '__open');
      const staffBox = h('div',{hidden:true}, field('Give them to', toWho));
      const out = h('div',{class:'grid','aria-live':'polite'});
      let plan = null;
      function reset(){ plan = null; out.textContent = ''; apply.disabled = true; }
      const show = () => { const a = act.value; timeBox.hidden = !(a === 'time' || a === 'both'); staffBox.hidden = !(a === 'staff' || a === 'both'); custom.hidden = tpl.value !== 'custom'; reset(); };
      [act, tpl].forEach(x => x.addEventListener('change', show));
      [which, whoF, toWho, cs, ce].forEach(x => x.addEventListener('change', reset));
      [from, to].forEach(x => x.addEventListener('change', () => { fillWhich(); reset(); }));
      function picked(){
        if (!from.value || !to.value || to.value < from.value){ toast('Check the dates'); return null; }
        if (dn(to.value) - dn(from.value) > 92){ toast('Pick up to 3 months at a time'); return null; }
        if (!on.size){ toast('Pick at least one day'); return null; }
        return inRange().filter(x => on.has(dow(dn(x.date))) && (which.value === 'all' || x.start+'-'+x.end === which.value)
          && (whoF.value === 'any' || (whoF.value === 'open' ? !x.staff : x.staff === whoF.value)));
      }
      function preview(){
        const hit = picked(); if (!hit) return;
        out.textContent = '';
        if (!hit.length){ ap(out, h('p',{class:'muted'},'No shifts match. Try other days, dates or filters.')); return; }
        const a = act.value, t = sc.templates.find(x => x.id === tpl.value);
        if ((a === 'time' || a === 'both') && tpl.value === 'custom' && (!cs.value || !ce.value || cs.value === ce.value)){ toast('Set a start and end time'); return; }
        const nt = (a === 'time' || a === 'both') ? (t ? {start:t.start, end:t.end, tpl:t.id} : {start:cs.value, end:ce.value, tpl:null}) : null;
        const ns = (a === 'staff' || a === 'both') ? (toWho.value === '__open' ? '' : toWho.value) : undefined;
        const ids = new Set(hit.map(x => x.id));
        const after = withChange(L => { if (a === 'remove') { for (let i = L.length-1; i >= 0; i--) if (ids.has(L[i].id)) L.splice(i, 1); return; }
          L.forEach(x => { if (!ids.has(x.id)) return; if (nt) Object.assign(x, nt); if (ns !== undefined) x.staff = ns; }); });
        const lo = Math.min(...hit.map(x => dn(x.date))), hi = Math.max(...hit.map(x => dn(x.date)));
        const news = diffIssues(site, lo-1, hi+7, after);
        const byCat = {}; news.forEach(i => { byCat[i.cat] = (byCat[i.cat]||0) + 1; });
        const desc = x => dayFmt(dn(x.date),{weekday:'short', month:'short', day:'numeric'})+' · '+tShort(x.start)+'–'+tShort(x.end)+' · '+(x.staff || 'open');
        const rows = hit.slice().sort((p,q) => absA(p)-absA(q)).map(x => { const y = after.find(z => z.id === x.id); return h('li',null, desc(x), y ? ' → '+tShort(y.start)+'–'+tShort(y.end)+' · '+(y.staff || 'open') : ' → removed'); });
        const hrsBefore = hit.reduce((s0, x) => s0 + (absB(x)-absA(x)), 0)/60, hrsAfter = a === 'remove' ? 0 : after.filter(x => ids.has(x.id)).reduce((s0, x) => s0 + (absB(x)-absA(x)), 0)/60;
        ap(out, h('div',{class:'card soft'}, h('b',null, hit.length+' shift'+(hit.length === 1 ? '' : 's')+' will change'),
            h('span',{class:'small'},'Scheduled hours: '+Math.round(hrsBefore*10)/10+' now, '+Math.round(hrsAfter*10)/10+' after.')),
          news.length ? h('div',{class:'card alert',role:'alert'}, h('b',null, news.length+' new warning'+(news.length === 1 ? '' : 's')),
              h('div',{class:'chips'}, Object.keys(byCat).map(c => h('span',{class:'chip amber'}, c+': '+byCat[c]))),
              h('ul',{class:'small blist'}, news.slice(0, 8).map(i => h('li',null, i.text))), news.length > 8 ? h('span',{class:'small'},'And '+(news.length-8)+' more. You can still save and fix them in the schedule.') : null)
            : h('div',{class:'card calm',role:'status'}, h('b',null,'No new warnings'), h('span',{class:'small'},'Coverage, double-booking, rest and overtime were checked.')),
          h('details',{open:hit.length <= 12}, h('summary',{class:'small'},'See every change'), h('ul',{class:'small blist'}, rows)));
        plan = {after, n:hit.length, a, warn:news.length};
        apply.disabled = false;
      }
      const apply = h('button',{class:'btn',type:'button',disabled:true,onclick:()=>{ if (!plan) return; snap(); sc.shifts = plan.after;
        const what = {time:'changed the times of', staff:'reassigned', both:'changed the times and staff of', remove:'removed'}[plan.a];
        audit('Bulk change: '+what+' '+plan.n+' shifts ('+[...on].sort().map(i => DAYS[i]).join(', ')+', '+fmtDate(from.value)+' to '+fmtDate(to.value)+')'+(plan.warn ? ', '+plan.warn+' new warnings' : ''), site);
        A.save(); dlg.close(); A.route(); toast('Changed '+plan.n+' shifts. Undo is at the top of the schedule.'); }},'Save changes');
      fillWhich();
      ap(box, dayBox, h('div',{class:'grid g2'}, field('From', from), field('To', to)), h('div',{class:'grid g2'}, field('Which shifts', which), field('Who is on them', whoF)),
        field('What to change', act), timeBox, staffBox,
        h('div',{class:'row'}, h('button',{class:'btn ghost',type:'button',onclick:preview},'Preview changes'), apply), out,
        h('p',{class:'small muted'},'Only this home ('+siteObj(site).name+'). Training shifts are left alone. If the week is already published, staff see the changes after you publish again.'));
      show();
    });
  }
  function weekToolsCard(site, d0){
    const sc = ensure();
    const n = h('input',{type:'number',min:'1',max:'12',value:'4'});
    const copyWeek = (from, to) => { let added = 0;
      shiftsAt(site).filter(s => dn(s.date) >= from && dn(s.date) < from+7).forEach(s => { const c = Object.assign({}, s, {id:uid(), date:di(dn(s.date)-from+to), callin:false, attended:false});
        if (sc.shifts.some(x => x.site===site && absA(x)===absA(c) && x.staff===c.staff)) return;
        if (c.staff && sc.shifts.some(x => x.site===site && x.staff===c.staff && absA(x) < absB(c) && absB(x) > absA(c))) return;
        sc.shifts.push(c); added++; }); return added; };
    return h('div',{class:'card'}, h('h2',null,'Week tools'),
      h('div',{class:'row'},
        h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ snap(); const a = copyWeek(d0-7, d0); audit('Copied last week into the week of '+fmtDate(di(d0))+' ('+a+')', site); A.save(); A.route(); toast('Copied '+a+' shifts from last week'); }},'Copy last week into this week'),
        h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ if (!confirm('Remove every shift in this week at '+siteObj(site).name+'? You can undo.')) return; snap(); sc.shifts = sc.shifts.filter(s => !(s.site===site && dn(s.date) >= d0 && dn(s.date) < d0+7)); audit('Cleared the week of '+fmtDate(di(d0)), site); A.save(); A.route(); }},'Clear this week')),
      h('div',{class:'row'}, field('Repeat this week for the next … weeks', n), h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ snap(); let a = 0; for (let w = 1; w <= Math.max(1, Math.min(12, +n.value||1)); w++) a += copyWeek(d0, d0+7*w); audit('Repeated the week of '+fmtDate(di(d0))+' ('+a+' shifts)', site); A.save(); A.route(); toast('Added '+a+' shifts. Shifts already there were kept.'); }},'Repeat week')));
  }
  function templatesCard(){
    const sc = ensure();
    const name = h('input',{type:'text',maxlength:'40',placeholder:'For example: Short evening'});
    const st = h('input',{type:'time',value:'16:00',step:'900'}), en = h('input',{type:'time',value:'22:00',step:'900'});
    const tr = h('input',{type:'checkbox',id:'tplTr'});
    return h('div',{class:'card'}, h('h2',null,'Shift templates'),
      h('div',{class:'chips'}, sc.templates.map(t => h('span',{class:'chip '+(t.kind==='training'?'calm':'grey')}, t.name+' · '+tShort(t.start)+'–'+tShort(t.end)+' · '+hrs((tmin(t.end)-tmin(t.start)+1440)%1440||1440)+' hrs',
        t.custom ? h('button',{type:'button',class:'x','aria-label':'Remove template '+t.name,onclick:()=>{ sc.templates = sc.templates.filter(x => x !== t); A.save(); A.route(); }},'×') : null))),
      h('h3',null,'Add your own'),
      h('div',{class:'grid g3'}, field('Name', name), field('Starts', st), field('Ends', en)),
      h('div',{class:'row'}, h('label',{class:'row small',for:'tplTr'}, tr, 'Training time')),
      h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ if (!name.value.trim()){ toast('Name the template'); return; }
        sc.templates.push({id:'c'+uid(), name:name.value.trim(), start:st.value, end:en.value, kind:tr.checked?'training':'shift', custom:true}); audit('Added shift template '+name.value.trim()); A.save(); A.route(); toast('Template added'); }},'Add template')));
  }
  function rulesCard(site){
    const r = Object.assign({}, rulesFor(site)), st = siteObj(site).setting;
    const num = (k, min, max) => { const i = h('input',{type:'number',min:String(min),max:String(max),value:String(r[k])}); i.addEventListener('change',()=>{ r[k] = Math.max(min, Math.min(max, +i.value||min)); }); return i; };
    const tm = k => { const i = h('input',{type:'time',value:r[k],step:'900'}); i.addEventListener('change',()=>{ r[k] = i.value; }); return i; };
    const ws = sel(DOWL.map((d,i) => [i, d]), r.weekStart); ws.addEventListener('change',()=>{ r.weekStart = +ws.value; });
    return h('details',{class:'card'}, h('summary',null,h('h2',{style:'display:inline'},'Coverage and fairness rules')),
      h('p',{class:'small'}, st==='cbrf' ? 'CBRF rules (DHS 83) tie staffing to residents\' needs and your license class, including staff on duty overnight. Set the minimums your license and resident plans require.' : 'AFH rules (DHS 88) tie staffing to residents\' needs. Set the overnight minimum for residents who need help at night (toileting rounds, wandering, turning).'),
      h('div',{class:'grid g3'}, field('Minimum staff, day and evening', num('dayMin',0,20)), field('Minimum staff, overnight', num('nightMin',0,20)), field('Workweek starts', ws)),
      h('div',{class:'grid g3'}, field('Overnight starts', tm('nightStart')), field('Overnight ends', tm('nightEnd'))),
      h('p',{class:'small muted'},'Every overnight shift is an awake, working shift.'),
      h('div',{class:'grid g3'}, field('Overtime after (hours a week)', num('otWeek',1,80)), field('Least hours off between shifts', num('minRest',0,16)), field('Most hours in a row', num('maxStretch',8,26))),
      h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ ensure().rules[site] = r; audit('Changed coverage rules', site); A.save(); A.route(); toast('Rules saved'); }},'Save rules')));
  }
  function shiftEvent(s){
    const m = mins(s), endDate = di(Math.floor(absB(s)/1440));
    return {id:'shift-'+s.id, kind:s.kind==='training'?'Training':'Shift', who:s.staff||'Open shift', site:s.site,
      title:(s.staff ? s.staff+': ' : 'Open shift: ')+(s.kind==='training'?'Training ':'Shift ')+span(s)+' ('+siteObj(s.site).name+')', date:s.date, time:s.start, dur:m, endDate:endDate !== s.date ? endDate : null,
      note:'From the Steady Shift schedule. Swaps, call-offs and time off go through the app so the manager can approve them.', link:'#/schedule'};
  }
  function exportCard(site, d0, d1){
    const list = shiftsAt(site).filter(s => dn(s.date) >= d0 && dn(s.date) <= d1).sort((a,b) => absA(a)-absA(b));
    const who = sel([['','Everyone']].concat(staffNames(site).map(n => [n, n])), S().tier==='caregiver' ? me() : '');
    const pick = () => list.filter(s => !who.value || s.staff === who.value);
    const csv = () => { const rows = [['Date','Start time','End date','End time','Employee','Position','Location','Shift type','Notes']];
      pick().forEach(s => rows.push([s.date, s.start, di(Math.floor(absB(s)/1440)), s.end, s.staff||'(open)', s.kind==='training'?'Training':'Caregiver', siteObj(s.site).name, 'Awake', s.note||'']));
      return rows.map(r => r.map(csvCell).join(',')).join('\r\n')+'\r\n'; };
    return h('div',{class:'card',id:'sExport'}, h('h2',null,'Export and sync'),
      h('p',{class:'small'},'Uses the same calendar files as Sync and calendar. Shifts carry the staff name, times and home. No resident details.'),
      field('Whose shifts', who),
      h('div',{class:'row'},
        h('button',{class:'btn sm',type:'button',onclick:()=>{ const p = pick(); if (!p.length){ toast('No shifts in these dates'); return; } download('schedule-'+site+'-'+di(d0)+'.ics','text/calendar',toIcs(p.map(shiftEvent))); }},'Calendar file (.ics)'),
        h('button',{class:'btn ghost sm',type:'button',onclick:()=>download('schedule-'+site+'-'+di(d0)+'.csv','text/csv',csv())},'Spreadsheet (.csv)'),
        h('a',{class:'btn quiet sm',href:'#/sync'},'Team chat and other tools')),
      h('p',{class:'small muted'},'The spreadsheet is a starting point for When I Work, Deputy or ShiftCare imports (each names its columns a little differently). Live two-way sync with those tools is planned.'));
  }

  // ---------- small cards for other screens ----------
  function homeCard(){
    const site = S().site; if (site === 'family') return null;
    const t = todayN(), r = rulesFor(site), w = weekStartOf(t, r.weekStart);
    const iss = check(site, t, w+6), fix = iss.filter(i => i.sev==='fix').length, pend = ensure().requests.filter(x => x.site===site && x.status==='Pending').length;
    const open = shiftsAt(site).filter(s => !s.staff && s.kind!=='training' && dn(s.date) >= t && dn(s.date) <= t+7).length;
    return h('a',{class:'tile',href:'#/schedule'}, h('span',{class:'ic','aria-hidden':'true'},'📅'), h('b',null,'Schedule this week'),
      h('span',null, [fix ? fix+' to fix' : 'Fully covered', open ? open+' open shift'+(open>1?'s':'') : null, pend ? pend+' request'+(pend>1?'s':'')+' waiting' : null].filter(Boolean).join(' · ')));
  }
  function myNextCard(){
    const site = S().site; if (site === 'family') return null;
    const n = me(), t = todayN(), now = t*1440 + new Date().getHours()*60 + new Date().getMinutes();
    const next = shiftsAt(site).filter(s => s.staff === n && absB(s) > now).sort((a,b) => absA(a)-absA(b))[0];
    const open = shiftsAt(site).filter(s => !s.staff && s.kind!=='training' && dn(s.date) >= t).length;
    return h('a',{class:'tile',href:'#/schedule'}, h('span',{class:'ic','aria-hidden':'true'},'📅'), h('b',null, next ? 'Your next shift: '+dayFmt(dn(next.date),{weekday:'short'})+' '+span(next) : 'My schedule'),
      h('span',null, (open ? open+' open shift'+(open>1?'s':'')+' you could ask for. ' : '')+'Ask for swaps or time off here.'));
  }
  function onCallTonight(){ const site = S().site, oc = (ensure().oncall[site]||{def:'Manager', days:{}}); return oc.days[A.isoDay(new Date())] || oc.def; }

  window.SSSched = {ensure, dn, di, dow, todayN, tmin, absA, absB, mins, hrs, span, tShort, tLong, dayFmt, weekStartOf, rulesFor, staffNames, prof, rec, shiftsAt, check, me, actor, audit, siteObj,
    homeCard, myNextCard, onCallTonight, dialog, field, sel, TYPES, reqText,
    can, canEdit, canApprove, decideReq, applyReq, diffIssues, withChange, fitFor, snap, timeOffFor, mt};
})();
