// Steady Shift test app: time sheets. Sample data only, stored in this browser.
// Clock in and out against scheduled shifts, breaks, late and missed-punch flags, fixes that need a reason and approval,
// weekly confirm and approve, overtime, and payroll spreadsheets. EVV for in-home Medicaid care is a later step.
(function(){
  const A = window.SSApp, X = window.SSSched; if (!A || !X) return;
  const {D, h, toast, fmtDate, head, download, csvCell, R} = A;
  const S = () => A.state();
  const ap = (el, ...k) => { el.append(...k.flat(9).filter(x => x != null && x !== false)); return el; };
  const {dn, di, todayN, tmin, absA, absB, hrs, span, tShort, tLong, dayFmt, weekStartOf, rulesFor, staffNames, prof, shiftsAt, me, audit, siteObj, dialog, field, sel} = X;
  const pad = n => String(n).padStart(2,'0');
  // minutes since the epoch day 0, in local wall-clock time (matches the schedule's numbers)
  const toM = iso => { const d = new Date(iso); return dn(A.isoDay(d))*1440 + d.getHours()*60 + d.getMinutes(); };
  const fromM = m => { const d = di(Math.floor(m/1440)), t = ((m%1440)+1440)%1440; return new Date(d+'T'+pad(Math.floor(t/60))+':'+pad(t%60)+':00').toISOString(); };
  const nowM = () => toM(new Date().toISOString());
  const clock = iso => iso ? tLong(pad(new Date(iso).getHours())+':'+pad(new Date(iso).getMinutes())) : '—';
  const GRACE = 7;

  function device(kind){
    let id = ''; try { id = localStorage.getItem('ss-device-id') || ''; if (!id){ id = Math.random().toString(36).slice(2,8); localStorage.setItem('ss-device-id', id); } } catch(e){}
    const ua = navigator.userAgent, os = /iPhone|iPad/.test(ua) ? 'iPhone or iPad' : /Android/.test(ua) ? 'Android' : 'Computer';
    return kind === 'kiosk' ? {kind:'kiosk', label:'House tablet · '+siteObj(S().site).name+' ('+id+')'} : {kind:'phone', label:'Personal device · '+os+' ('+id+')'};
  }
  function ensure(){
    X.ensure();
    const s = S();
    if (s.time && s.time.v === 1) return s.time;
    s.time = seed(); A.save(); return s.time;
  }
  function seed(){
    const punches = [], now = nowM(), t0 = todayN();
    let k = 0;
    const devs = [{kind:'kiosk', label:'House tablet · sample'}, {kind:'phone', label:'Personal device · sample'}];
    X.ensure().shifts.filter(s => s.staff && ['maple','birch'].includes(s.site) && dn(s.date) >= t0-36 && absA(s) < now).sort((a,b) => absA(a)-absA(b)).forEach(s => {
      k++;
      const j = [-4,-2,0,1,3,-6,2,-1,5,0,-3,12,1,-2,0,4,-5,2,9,-1][k%20];
      const a = absA(s) + j, b0 = absB(s), out = b0 + [3,-2,6,0,1,-9,14,2,0,4,-3,1][k%12];
      const p = {id:A.uid(), site:s.site, staff:s.staff, shift:s.id, in:fromM(a), out:out < now ? fromM(out) : null, breaks:[], dev:devs[k%2], edits:[]};
      if (s.site === 'birch' && s.kind !== 'training' && out < now) p.breaks.push({s:fromM(a+240), e:fromM(a+270)});
      if (k % 37 === 5 && out < now - 120) p.out = null; // a forgotten clock-out
      punches.push(p);
    });
    const editReqs = [];
    const missing = punches.filter(p => !p.out && toM(p.in) < now - 24*60)[0];
    if (missing){ const s = X.ensure().shifts.find(x => x.id === missing.shift); editReqs.push({id:A.uid(), punch:missing.id, site:missing.site, by:missing.staff, in:missing.in, out:fromM(absB(s)), reason:'Forgot to clock out, left on time after report to night shift.', status:'Pending', at:new Date().toISOString()}); }
    return {v:1, punches, editReqs, weeks:{}, settings:{}};
  }
  const setFor = site => Object.assign({grace:GRACE, sleepExcl:false, unpaidBreakMin:30}, ensure().settings[site]||{});
  const shiftById = id => X.ensure().shifts.find(s => s.id === id);
  const breakMin = p => p.breaks.reduce((t,b) => t + (b.e ? Math.max(0, toM(b.e)-toM(b.s)) : 0), 0);
  // Breaks of 30 minutes or more, when the person is fully relieved, are unpaid. Shorter ones are paid (federal and Wisconsin rules).
  const unpaid = (p, site) => p.breaks.reduce((t,b) => { const m = b.e ? toM(b.e)-toM(b.s) : 0; return t + (m >= setFor(site).unpaidBreakMin ? m : 0); }, 0);
  const worked = p => p.out ? Math.max(0, toM(p.out) - toM(p.in) - unpaid(p, p.site)) : 0;
  function flags(p){
    const f = [], s = p.shift && shiftById(p.shift), g = setFor(p.site).grace;
    if (!s) f.push('Not on the schedule');
    if (s && toM(p.in) > absA(s) + g) f.push('Late '+(toM(p.in)-absA(s))+' min');
    if (s && p.out && toM(p.out) < absB(s) - g) f.push('Left '+(absB(s)-toM(p.out))+' min early');
    if (!p.out && (!s || nowM() > absB(s) + 60)) f.push('Missed clock-out');
    if (p.breaks.some(b => !b.e) && p.out) f.push('Break not ended');
    if (p.edits.length) f.push('Edited');
    return f;
  }
  const weekKey = (site, n, ws) => site+'|'+n+'|'+di(ws);
  function weekRows(site, n, ws){
    const L = ensure().punches.filter(p => p.site === site && p.staff === n && dn(A.isoDay(new Date(p.in))) >= ws && dn(A.isoDay(new Date(p.in))) < ws+7).sort((a,b) => a.in.localeCompare(b.in));
    const sched = shiftsAt(site).filter(s => s.staff === n && dn(s.date) >= ws && dn(s.date) < ws+7);
    const noShow = sched.filter(s => absB(s) < nowM() && !L.some(p => p.shift === s.id));
    return {L, sched, noShow};
  }
  function weekTotals(site, n, ws){
    const {L, sched} = weekRows(site, n, ws), r = rulesFor(site);
    const work = L.reduce((t,p) => t + worked(p), 0), plan = sched.reduce((t,s) => t + (absB(s)-absA(s)), 0);
    const ot = Math.max(0, work - r.otWeek*60);
    const pto = X.ensure().requests.filter(q => q.type==='timeoff' && q.pto==='PTO' && q.status==='Approved' && q.site===site && q.by===n).reduce((t,q) => { let c = 0; for (let d = dn(q.from); d <= dn(q.to); d++) if (d >= ws && d < ws+7) c++; return t + c*8; }, 0);
    const fl = L.reduce((t,p) => t + flags(p).filter(f => f !== 'Edited').length, 0);
    const rate = prof(n).rate || 18;
    return {work, plan, ot, reg:work-ot, pto, flags:fl, cost:(work-ot)/60*rate + ot/60*rate*1.5, rate};
  }

  // ---------- clock in and out ----------
  function current(site, n){ return ensure().punches.find(p => p.site === site && p.staff === n && !p.out && nowM() - toM(p.in) < 20*60); }
  function shiftNow(site, n){ const now = nowM(); return shiftsAt(site).filter(s => s.staff === n && absA(s) - 60 <= now && absB(s) > now).sort((a,b) => absA(a)-absA(b))[0]; }
  async function placeOk(site, kind){
    const k = window.SSAccess ? SSAccess.kioskCfg(site) : {};
    if (kind !== 'kiosk' || !k.geo) return '';
    if (!k.home) return '';
    if (!navigator.geolocation) return 'This device cannot check its location.';
    return new Promise(res => navigator.geolocation.getCurrentPosition(p => {
      const R0 = 6371000, rad = x => x*Math.PI/180, dLa = rad(p.coords.latitude-k.home.lat), dLo = rad(p.coords.longitude-k.home.lng);
      const a = Math.sin(dLa/2)**2 + Math.cos(rad(k.home.lat))*Math.cos(rad(p.coords.latitude))*Math.sin(dLo/2)**2;
      res(2*R0*Math.asin(Math.sqrt(a)) > 250 ? 'Clock-in needs to happen at the home.' : '');
    }, () => res('Location is needed to clock in here.'), {timeout:8000}));
  }
  async function punch(site, n, action, kind){
    const T = ensure(), cur = current(site, n), dev = device(kind), now = new Date().toISOString();
    if (action === 'in'){
      const bad = await placeOk(site, kind); if (bad) return {err:bad};
      const s = shiftNow(site, n);
      T.punches.push({id:A.uid(), site, staff:n, shift:s ? s.id : null, in:now, out:null, breaks:[], dev, edits:[]});
      audit(n+' clocked in ('+dev.label+')', site); A.save();
      const late = s && nowM() > absA(s) + setFor(site).grace;
      return {msg:'Clocked in at '+clock(now)+'.'+(s ? ' Shift '+span(s)+'.' : ' This is not on the schedule, so your manager will check it.')+(late ? ' Marked late.' : '')};
    }
    if (!cur) return {err:'You are not clocked in.'};
    if (action === 'break'){ cur.breaks.push({s:now, e:null}); audit(n+' started a break ('+dev.label+')', site); A.save(); return {msg:'Break started at '+clock(now)+'. Breaks of 30 minutes or more are unpaid when you are fully off duty.'}; }
    if (action === 'back'){ const b = cur.breaks.find(x => !x.e); if (b) b.e = now; audit(n+' ended a break ('+dev.label+')', site); A.save(); return {msg:'Back from break at '+clock(now)+'.'}; }
    if (action === 'out'){ const b = cur.breaks.find(x => !x.e); if (b) b.e = now; cur.out = now; audit(n+' clocked out ('+dev.label+')', site); A.save(); return {msg:'Clocked out at '+clock(now)+'. '+hrs(worked(cur))+' hours. Thank you.'}; }
  }
  function clockCard(site, n, kind, after){
    const cur = current(site, n), s = shiftNow(site, n), onBreak = cur && cur.breaks.some(b => !b.e);
    const out = h('p',{'aria-live':'polite',class:'small'});
    const go = async action => { const r = await punch(site, n, action, kind); out.textContent = r.err || r.msg; if (r.err) toast(r.err); if (after) after(r); else setTimeout(() => A.route(), 900); };
    const big = (txt, action, cls) => h('button',{class:'btn big '+(cls||''),type:'button',onclick:()=>go(action)}, txt);
    return h('div',{class:'card clock'},
      h('div',{class:'meta small'}, h('b',null, cur ? (onBreak ? 'On break' : 'On the clock since '+clock(cur.in)) : 'Not clocked in'), s ? h('span',null,' · Scheduled '+span(s)) : h('span',null,' · No shift scheduled right now')),
      h('div',{class:'row'}, !cur ? big('Clock in','in') : onBreak ? big('End break','back') : [big('Clock out','out'), big('Start break','break','ghost')]),
      out);
  }

  // ---------- fixes that need a reason and approval ----------
  function fixDialog(site, n, p, mgr){
    const s = p && shiftById(p.shift);
    dialog(p ? 'Fix a time' : 'Add a missed punch', (box, dlg) => {
      const day = h('input',{type:'date',value:p ? A.isoDay(new Date(p.in)) : A.isoDay(new Date())});
      const tin = h('input',{type:'time',value:p ? pad(new Date(p.in).getHours())+':'+pad(new Date(p.in).getMinutes()) : (s ? s.start : '07:00')});
      const tout = h('input',{type:'time',value:p && p.out ? pad(new Date(p.out).getHours())+':'+pad(new Date(p.out).getMinutes()) : (s ? s.end : '15:00')});
      const reason = h('textarea',{style:'min-height:4rem',maxlength:'240',placeholder:mgr ? 'Why the change? For example: tablet was offline, confirmed with the night lead.' : 'What happened? For example: forgot to clock out, left at 7 PM.'});
      ap(box, h('p',{class:'small'}, n+(s ? ' · scheduled '+span(s) : '')), h('div',{class:'grid g3'}, field('Day it started', day), field('Clock in', tin), field('Clock out', tout)),
        h('p',{class:'small muted'},'An out time earlier than the in time means the next morning.'), field('Reason (required)', reason),
        h('p',{class:'small muted'}, mgr ? 'Saved right away and kept in the change log with your name and the reason.' : 'Goes to your manager to approve. The original punch is kept.'),
        h('div',{class:'row'}, h('button',{class:'btn',type:'button',onclick:()=>{
          if (reason.value.trim().length < 5){ toast('Add a short reason'); return; }
          const a = dn(day.value)*1440 + tmin(tin.value); let b = dn(day.value)*1440 + tmin(tout.value); if (b <= a) b += 1440;
          const req = {id:A.uid(), punch:p ? p.id : null, site, by:n, in:fromM(a), out:fromM(b), reason:reason.value.trim(), status:'Pending', at:new Date().toISOString()};
          if (mgr){ applyFix(req, true); toast('Saved'); } else { ensure().editReqs.push(req); audit(n+' asked to fix a time: '+req.reason, site); A.save(); toast('Sent to your manager'); }
          dlg.close(); A.route(); }}, mgr ? 'Save change' : 'Send for approval')));
    });
  }
  function applyFix(q, direct){
    const T = ensure(); let p = q.punch && T.punches.find(x => x.id === q.punch);
    if (!p){ const s = shiftsAt(q.site).find(x => x.staff === q.by && Math.abs(absA(x) - toM(q.in)) < 180); p = {id:A.uid(), site:q.site, staff:q.by, shift:s ? s.id : null, in:q.in, out:q.out, breaks:[], dev:{kind:'manual', label:'Added by manager'}, edits:[]}; T.punches.push(p); }
    p.edits.push({at:new Date().toISOString(), by:X.actor(), from:{in:p.in, out:p.out}, to:{in:q.in, out:q.out}, reason:q.reason, asked:direct ? null : q.by});
    p.in = q.in; p.out = q.out;
    q.status = 'Approved'; q.decidedAt = new Date().toISOString(); q.decidedBy = X.actor();
    audit((direct ? 'Edited ' : 'Approved a time fix for ')+q.by+': '+clock(q.in)+' to '+clock(q.out)+'. Reason: '+q.reason, q.site); A.save();
  }

  // ---------- screen ----------
  R.time = v => {
    const T = ensure(), site = S().site;
    v.classList.add('wide');
    if (site === 'family'){ ap(v, head('Time sheets', 'Time sheets are for homes with staff', 'Pick Maple Grove, Birch Hollow or Cedar Lane at the top.')); return; }
    const mgr = ['manager','owner','multi'].includes(S().tier) || (window.SSAccess && SSAccess.can('time.approve', me()));
    const cg = S().tier === 'caregiver';
    const r = rulesFor(site), ui = X.ensure().ui;
    const ws = weekStartOf(dn(ui.tsWeek || A.isoDay(new Date())), r.weekStart);
    const move = k => { ui.tsWeek = di(ws + 7*k); A.save(); A.route(); };
    const bar = h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button','aria-label':'Previous week',onclick:()=>move(-1)},'‹'), h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ ui.tsWeek = ''; A.save(); A.route(); }},'This week'), h('button',{class:'btn quiet sm',type:'button','aria-label':'Next week',onclick:()=>move(1)},'›'),
      h('h2',{class:'stitle'},'Week of '+dayFmt(ws,{month:'short', day:'numeric', year:'numeric'})));
    if (cg){
      const n = me();
      ap(v, head('My time · '+siteObj(site).name, 'Clock in, breaks and your weekly hours', 'Clock in on your own phone, or on the house tablet with your PIN. If you forget a punch, ask for a fix here.'));
      ap(v, clockCard(site, n, 'phone'));
      ap(v, h('div',{class:'card'}, bar, sheet(site, n, ws, false)));
      return;
    }
    ap(v, head('Time sheets · '+siteObj(site).name, 'Hours, punches and payroll', 'Punches match the schedule. Flags show late starts, early leaves and missed punches. Fixes need a reason and are logged.'));
    if (!mgr){ ap(v, h('div',{class:'card'}, bar, h('p',{class:'muted'},'You can see totals. A manager or owner can share time sheet approval with you in Services and access.'), summaryTable(site, ws, false))); return; }
    const pend = T.editReqs.filter(q => q.site === site && q.status === 'Pending');
    if (pend.length) ap(v, h('div',{class:'card warn'}, h('h2',null,'Time fixes to approve ('+pend.length+')'), h('div',{class:'list'}, pend.map(q => h('div',{class:'item'},
      h('b',null,q.by+': '+dayFmt(dn(A.isoDay(new Date(q.in))))+', '+clock(q.in)+' to '+clock(q.out)), h('span',{class:'small'},'"'+q.reason+'"'), h('span',{class:'small muted'},'Asked '+A.fmtTime(q.at)),
      h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ applyFix(q, false); A.route(); toast('Approved'); }},'Approve'), h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ q.status = 'Declined'; q.decidedAt = new Date().toISOString(); q.decidedBy = X.actor(); audit('Declined a time fix for '+q.by, site); A.save(); A.route(); }},'Decline')))))));
    const onNow = staffNames(site).filter(n => current(site, n));
    ap(v, h('div',{class:'card'}, h('h2',null,'On the clock now'), onNow.length ? h('div',{class:'chips'}, onNow.map(n => { const c = current(site, n); return h('span',{class:'chip calm'}, n+' since '+clock(c.in)+(c.breaks.some(b => !b.e) ? ' (break)' : '')); })) : h('p',{class:'muted'},'No one right now.')));
    const pick = h('div');
    ap(v, h('div',{class:'card'}, bar, summaryTable(site, ws, true, n => { pick.textContent = ''; ap(pick, h('div',{class:'card'}, h('h2',null,n), sheet(site, n, ws, true))); pick.scrollIntoView({behavior:'smooth'}); })), pick);
    ap(v, payrollCard(site, ws), rulesNote(site));
  };
  function summaryTable(site, ws, mgr, open){
    const tb = h('table',{class:'t'}, h('thead',null, h('tr',null, ['Staff','Scheduled','Worked','Overtime','PTO','Flags','Status',''].map(x => h('th',{scope:'col'},x)))));
    const body = h('tbody'); const W = ensure().weeks;
    staffNames(site).forEach(n => {
      const t = weekTotals(site, n, ws), {noShow} = weekRows(site, n, ws), w = W[weekKey(site, n, ws)] || {};
      if (!t.plan && !t.work) return;
      const fl = t.flags + noShow.length;
      ap(body, h('tr',null, h('th',{scope:'row'},n), h('td',null,hrs(t.plan)), h('td',null,hrs(t.work)), h('td',null, t.ot ? h('span',{class:'chip amber'},hrs(t.ot)) : '0'), h('td',null,t.pto || '0'),
        h('td',null, fl ? h('span',{class:'chip amber'},String(fl)) : h('span',{class:'chip calm'},'0')),
        h('td',null, w.approvedAt ? h('span',{class:'chip calm'},'Approved') : w.confirmedAt ? h('span',{class:'chip'},'Staff confirmed') : h('span',{class:'chip grey'},'Open')),
        h('td',null, mgr && open ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>open(n),'aria-label':'Open '+n+'\'s time sheet'},'Open') : null)));
    });
    ap(tb, body);
    return h('div',{class:'tablewrap'}, tb);
  }
  function sheet(site, n, ws, mgr){
    const {L, noShow} = weekRows(site, n, ws), t = weekTotals(site, n, ws), key = weekKey(site, n, ws), W = ensure().weeks, w = W[key] || {};
    const wrap = h('div',{class:'grid'});
    const rows = L.map(p => ({p, at:p.in})).concat(noShow.map(s => ({s, at:fromM(absA(s))}))).sort((a,b) => a.at.localeCompare(b.at));
    ap(wrap, rows.length ? h('div',{class:'list'}, rows.map(x => {
      if (x.s) return h('div',{class:'item'}, h('div',{class:'meta'}, h('span',{class:'chip amber'},'No punches'), h('span',null,dayFmt(dn(x.s.date))+' · scheduled '+span(x.s))), h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ fixDialog(site, n, {id:null, site, staff:n, shift:x.s.id, in:fromM(absA(x.s)), out:fromM(absB(x.s)), breaks:[], edits:[]}, mgr); }}, mgr ? 'Enter the time' : 'Ask for a fix')));
      const p = x.p, s = p.shift && shiftById(p.shift), f = flags(p);
      return h('div',{class:'item'},
        h('div',{class:'meta'}, h('span',{class:'chip'},dayFmt(dn(A.isoDay(new Date(p.in))))), f.map(z => h('span',{class:'chip '+(z==='Edited'?'grey':'amber')},z)), h('span',null,p.dev ? p.dev.label : '')),
        h('b',null, clock(p.in)+' to '+clock(p.out)+(p.out ? ' · '+hrs(worked(p))+' hrs' : '')),
        h('span',{class:'small muted'}, (s ? 'Scheduled '+span(s) : 'Not scheduled')+(p.breaks.length ? ' · breaks: '+p.breaks.map(b => clock(b.s)+'–'+clock(b.e)).join(', ')+' ('+breakMin(p)+' min)' : '')),
        p.edits.length ? h('details',null, h('summary',{class:'small'},'Change history ('+p.edits.length+')'), p.edits.map(e => h('p',{class:'small'}, A.fmtTime(e.at)+' · '+e.by+': '+clock(e.from.in)+'–'+clock(e.from.out)+' → '+clock(e.to.in)+'–'+clock(e.to.out)+'. "'+e.reason+'"'))) : null,
        !w.approvedAt ? h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>fixDialog(site, n, p, mgr)}, mgr ? 'Edit' : 'Ask for a fix')) : null);
    })) : h('p',{class:'muted'},'No punches this week.'));
    ap(wrap, h('div',{class:'grid g4'},
      h('div',{class:'stat'}, h('b',null,String(hrs(t.work))), h('span',null,'hours worked')),
      h('div',{class:'stat '+(t.ot?'warnc':'')}, h('b',null,String(hrs(t.ot))), h('span',null,'overtime hours (over '+rulesFor(site).otWeek+')')),
      h('div',{class:'stat'}, h('b',null,String(t.pto)), h('span',null,'PTO hours')),
      h('div',{class:'stat'}, h('b',null,String(hrs(t.plan))), h('span',null,'hours scheduled'))));
    const row = h('div',{class:'row'});
    if (!mgr && !w.confirmedAt) ap(row, h('button',{class:'btn sm',type:'button',onclick:()=>{ W[key] = Object.assign(w, {confirmedAt:new Date().toISOString()}); audit(n+' confirmed their time sheet for the week of '+fmtDate(di(ws)), site); A.save(); A.route(); toast('Confirmed. Your manager approves it next.'); }},'These hours are right'));
    if (!mgr) ap(row, h('button',{class:'btn quiet sm',type:'button',onclick:()=>fixDialog(site, n, null, false)},'Add a missed punch'));
    if (mgr && !w.approvedAt) ap(row, h('button',{class:'btn sm',type:'button',onclick:()=>{ const open = t.flags + noShow.length; if (open && !confirm(open+' flag'+(open>1?'s':'')+' still open. Approve anyway?')) return; W[key] = Object.assign(w, {approvedAt:new Date().toISOString(), approvedBy:X.actor()}); audit('Approved '+n+'\'s time sheet for the week of '+fmtDate(di(ws)), site); A.save(); A.route(); toast('Approved'); }},'Approve week'));
    if (mgr && w.approvedAt) ap(row, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ delete w.approvedAt; audit('Reopened '+n+'\'s time sheet for the week of '+fmtDate(di(ws)), site); A.save(); A.route(); }},'Reopen'));
    ap(wrap, h('p',{class:'small muted'}, w.confirmedAt ? 'Confirmed by '+n+' '+A.fmtTime(w.confirmedAt)+'. ' : '', w.approvedAt ? 'Approved by '+w.approvedBy+' '+A.fmtTime(w.approvedAt)+'.' : ''), row);
    return wrap;
  }
  function payrollCard(site, ws){
    const fmt = sel([['generic','Detailed (every punch)'],['qb','QuickBooks style'],['gusto','Gusto style'],['adp','ADP style']], 'generic');
    const only = h('input',{type:'checkbox',id:'payOnly',checked:true});
    const build = () => {
      const names = staffNames(site).filter(n => { const w = ensure().weeks[weekKey(site, n, ws)] || {}; return !only.checked || w.approvedAt; });
      const home = siteObj(site).name, rows = [];
      if (fmt.value === 'generic'){ rows.push(['Employee','Home','Date','Clock in','Clock out','Unpaid break (min)','Hours','Scheduled shift','Device','Edited','Week approved by']);
        names.forEach(n => { const w = ensure().weeks[weekKey(site, n, ws)] || {}; weekRows(site, n, ws).L.forEach(p => { const s = p.shift && shiftById(p.shift); rows.push([n, home, A.isoDay(new Date(p.in)), clock(p.in), clock(p.out), unpaid(p, site), hrs(worked(p)), s ? span(s) : '', p.dev ? p.dev.label : '', p.edits.length ? 'Yes' : 'No', w.approvedBy || '']); }); }); }
      if (fmt.value === 'qb'){ rows.push(['Employee','Date','Start time','End time','Duration (hours)','Customer or location','Notes']);
        names.forEach(n => weekRows(site, n, ws).L.forEach(p => rows.push([n, A.isoDay(new Date(p.in)), clock(p.in), clock(p.out), hrs(worked(p)), home, p.edits.length ? 'Edited with reason' : '']))); }
      if (fmt.value === 'gusto'){ rows.push(['Employee','Regular hours','Overtime hours','Double overtime hours','PTO hours','Pay period start','Pay period end']);
        names.forEach(n => { const t = weekTotals(site, n, ws); rows.push([n, hrs(t.reg), hrs(t.ot), 0, t.pto, di(ws), di(ws+6)]); }); }
      if (fmt.value === 'adp'){ rows.push(['Co Code','Batch ID','File #','Employee','Reg Hours','O/T Hours','Hours 3 Code','Hours 3 Amount']);
        names.forEach(n => { const t = weekTotals(site, n, ws); rows.push(['', 'SS'+di(ws).replace(/-/g,''), '', n, hrs(t.reg), hrs(t.ot), t.pto ? 'PTO' : '', t.pto || '']); }); }
      return {csv:rows.map(r => r.map(csvCell).join(',')).join('\r\n')+'\r\n', count:names.length};
    };
    return h('div',{class:'card'}, h('h2',null,'Payroll export'),
      h('p',{class:'small'},'One spreadsheet for the week. Overtime is over 40 hours in the workweek at time and a half (FLSA and Wisconsin DWD 274).'),
      h('div',{class:'grid g2'}, field('Layout', fmt)), h('label',{class:'row small',for:'payOnly'}, only, 'Only approved time sheets'),
      h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ const b = build(); if (!b.count){ toast('No approved time sheets for this week yet'); return; } download('payroll-'+site+'-'+di(ws)+'-'+fmt.value+'.csv','text/csv',b.csv); audit('Exported payroll ('+fmt.options[fmt.selectedIndex].text+') for the week of '+fmtDate(di(ws)), site); A.save(); }},'Download (.csv)')),
      h('p',{class:'small muted'},'The QuickBooks, Gusto and ADP layouts are starting points. Column names differ by plan and setup, so match them to your provider\'s import template the first time. Direct connections come later.'));
  }
  function rulesNote(site){
    const st = setFor(site);
    const gr = h('input',{type:'number',min:'0',max:'15',value:String(st.grace)}); gr.addEventListener('change',()=>{ ensure().settings[site] = Object.assign(setFor(site), {grace:Math.max(0, Math.min(15, +gr.value||0))}); A.save(); });
    return h('details',{class:'card'}, h('summary',null,h('h2',{style:'display:inline'},'Pay rules and sleep time')),
      field('Minutes before a punch counts as late or early', gr),
      h('ul',{class:'small'},
        h('li',null,'Overtime: over 40 hours in the workweek, at 1.5 times the regular rate (federal FLSA; Wisconsin DWD 274). Wisconsin has no daily overtime for adults.'),
        h('li',null,'Breaks: under 30 minutes are paid. A meal period of 30 minutes or more is unpaid only when the person is fully relieved of duty. In a small home where staff must stay available, it is paid.'),
        h('li',null,'Sleep time: for shifts under 24 hours, all hours count, even when staff may sleep. For 24-hour or longer shifts, federal rules let up to 8 hours of sleep be left out only with a written agreement, a real bed, and at least 5 hours of uninterrupted sleep; any interruption is paid. Wisconsin rules can be stricter, so the app counts every hour unless your payroll advisor confirms otherwise.'),
        h('li',null,'Live-in and companionship exemptions mostly apply to private in-home care, not AFH or CBRF staff employed by the home.'),
        h('li',null,'Later, for the in-home care version: Wisconsin Medicaid electronic visit verification (EVV). Not built yet.')));
  }

  // The house tablet (shift station) lives in station.js.

  window.SSTime = {ensure, weekTotals, weekRows, worked, flags, toM, clockCard, current, punch, shiftNow};
})();
