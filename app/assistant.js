// Steady Shift test app: "Do it by chat" (#/assistant).
// People type what they want ("schedule Caregiver B 7-3 Tuesday", "log a fall for M-2", "what's due this week")
// and the assistant does it with the same actions the screens use.
//
// How it works
// - Every action is a tool in TOOLS below. Read tools answer right away. Write tools never save on their own:
//   they show a confirm card, and only the person's "Yes, save it" runs the save.
// - Each tool lists the roles that may use it, and the screen it belongs to. A tool is offered only when the
//   person's role (the "View as" switcher) has it, or a manager shared that permission with them (Services and access),
//   and the screen's service is switched on for this home.
// - With the AI helper on (Supabase Edge Function "app-chat", mode "assistant"), Claude reads the request and picks
//   the tools. The API key stays on the server. Without it, a built-in command reader handles the common requests,
//   using the same tools and the same confirm cards.
// - The conversation is kept in page memory only (never saved in the browser). Sample data only.
(function(){
  const A = window.SSApp; if (!A) return;
  const {D, h, toast, head, R, VIEWS, NAV, uid, fmtDate, site, tier} = A;
  const S = () => A.state();
  const X = () => window.SSSched;
  const MGR = ['manager','owner','multi'];
  const ALL = ['caregiver','manager','rn','owner','multi','family'];
  const STAFF = ['caregiver','manager','rn','owner','multi'];

  // ---------- small helpers ----------
  const pad = n => String(n).padStart(2,'0');
  const today = () => A.isoDay(new Date());
  const addDays = (iso, n) => A.addDays(iso, n);
  const isIso = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s||'')) && !isNaN(new Date(s+'T12:00:00'));
  const isTime = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s||''));
  const dayName = iso => new Date(iso+'T12:00:00').toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric'});
  const tLong = t => { const [hh,mm] = t.split(':').map(Number); return (hh%12||12)+(mm?':'+pad(mm):'')+(hh<12?' AM':' PM'); };
  const clip = (s, n) => String(s == null ? '' : s).slice(0, n || 400);
  const viewOn = v => { try { return !window.SSAccess || SSAccess.viewOn(v); } catch(e){ return true; } };
  const me = () => X() ? X().me() : tier().name;
  const staffNames = () => X() ? X().staffNames(S().site) : ((S().staff||{})[S().site]||[]).map(p => p.n);
  const residents = () => A.residents();
  const granted = perm => { try { return !!(window.SSAccess && SSAccess.can(perm, me())); } catch(e){ return false; } };

  function findPerson(name, extra){
    const raw = String(name||'').trim(); if (!raw) return {err:'Say who.'};
    if (/^(me|myself|i)$/i.test(raw)) return {n:me()};
    const list = staffNames().concat(extra||[]);
    const q = raw.toLowerCase();
    let hit = list.find(n => n.toLowerCase() === q)
      || list.find(n => /^[a-z]$/i.test(raw) && n.toLowerCase() === 'caregiver '+q)
      || list.filter(n => n.toLowerCase().includes(q)).sort((a,b) => a.length-b.length)[0];
    if (hit) return {n:hit};
    return {err:'No one named "'+clip(raw,40)+'" works at '+site().name+'. Staff here: '+list.join(', ')+'.'};
  }
  function findResident(ref){
    const raw = String(ref||'').trim(); if (!raw) return {code:''};
    const list = residents();
    const room = raw.match(/^(?:room|rm|bed|#)\s*(\d+)$/i);
    let r = list.find(x => x.code.toLowerCase() === raw.toLowerCase())
      || list.find(x => x.nick.toLowerCase() === raw.toLowerCase())
      || (room ? list.find(x => x.code.split('-')[1] === room[1]) : null);
    if (r) return {code:r.code, nick:r.nick};
    return {err:'No resident "'+clip(raw,40)+'" at '+site().name+'. Residents here (sample codes): '+list.map(x => x.code).join(', ')+'.'};
  }
  const resLabel = r => r && r.code ? 'Resident '+r.code+(r.nick ? ' ('+r.nick+', sample)' : '') : 'No resident named';

  // ---------- the tools ----------
  // kind 'read': run(input) -> {text, lines?, links?}
  // kind 'write': preview(input) -> {err} or {title, lines, warn?, alert?, edit?, yes?, commit(editedText) -> text}
  const TOOLS = {
    whats_due:{kind:'read', tiers:ALL, label:'What\'s due', run(inp){
      const days = Math.max(1, Math.min(31, +inp.days || 7)), end = addDays(today(), days);
      const items = (A.dueItems() || []).filter(e => e.date <= end);
      const lines = items.slice(0, 25).map(e => dayName(e.date)+(e.time ? ' · '+tLong(e.time) : '')+' · '+e.title+' ('+e.who+')');
      const links = [...new Set(items.map(e => e.link))].slice(0, 4);
      if (X() && STAFF.includes(S().tier)){
        const pend = X().ensure().requests.filter(r => r.site === S().site && r.status === 'Pending');
        if (pend.length && (MGR.includes(S().tier) || granted('sched.approve'))) { lines.push(pend.length+' schedule request'+(pend.length>1?'s':'')+' waiting for approval'); links.push('#/schedule'); }
        const mine = X().ensure().requests.filter(r => r.site === S().site && r.status === 'Pending' && r.by === me());
        if (mine.length && !MGR.includes(S().tier)) lines.push('You have '+mine.length+' request'+(mine.length>1?'s':'')+' waiting for your manager');
      }
      if (window.SSClean && S().site !== 'family' && viewOn('clean')){ const n = SSClean.openTasks(S().site).length; if (n){ lines.push(n+' cleaning job'+(n>1?'s':'')+' open this shift'); links.push('#/clean'); } }
      const text = lines.length ? 'Due in the next '+days+' days at '+site().name+':\n- '+lines.join('\n- ') : 'Nothing due in the next '+days+' days.';
      return {text, lines:lines.length ? lines : ['Nothing due in the next '+days+' days.'], links:[...new Set(links)]};
    }},
    get_schedule:{kind:'read', tiers:STAFF, view:'schedule', label:'Schedule', run(inp){
      const from = isIso(inp.from) ? inp.from : today();
      let to = isIso(inp.to) ? inp.to : from; if (to < from) to = from; if (to > addDays(from, 13)) to = addDays(from, 13);
      let who = null; if (inp.person){ const p = findPerson(inp.person); if (p.err) return {text:p.err, error:true}; who = p.n; }
      const list = X().shiftsAt(S().site).filter(s => s.date >= from && s.date <= to && (!who || s.staff === who) && (!inp.only_open || (!s.staff && s.kind !== 'training')))
        .sort((a,b) => X().absA(a) - X().absA(b));
      const oc = X().ensure().oncall[S().site] || {def:'Manager', days:{}};
      const lines = list.slice(0, 60).map(s => dayName(s.date)+' · '+tLong(s.start)+' to '+tLong(s.end)+' · '+(s.staff || 'OPEN')+(s.kind === 'training' ? ' (training)' : ''));
      const ids = list.slice(0, 60).map((s,i) => lines[i]+' [shift '+s.id+']');
      const ocLines = []; for (let d = from; d <= to; d = addDays(d, 1)) ocLines.push(dayName(d)+': on call '+(oc.days[d] || oc.def));
      const head = (inp.only_open ? 'Open shifts' : 'Shifts')+(who ? ' for '+who : '')+' at '+site().name+', '+dayName(from)+(to !== from ? ' to '+dayName(to) : '');
      return {text:head+':\n'+(ids.length ? ids.join('\n') : 'None.')+'\nOn call:\n'+ocLines.join('\n'), lines:(lines.length ? lines : ['None.']).concat(ocLines.length <= 3 ? ocLines : []), head, links:['#/schedule']};
    }},
    pending_requests:{kind:'read', tiers:STAFF, view:'schedule', label:'Requests', run(){
      const all = X().ensure().requests.filter(r => r.site === S().site && r.status === 'Pending');
      const mgr = MGR.includes(S().tier) || granted('sched.approve');
      const list = mgr ? all : all.filter(r => r.by === me());
      const lines = list.map(r => X().reqText(r)+(r.note ? ' "'+clip(r.note,120)+'"' : ''));
      return {text:(mgr ? 'Requests waiting for approval' : 'Your requests waiting')+':\n'+(list.length ? list.map((r,i) => lines[i]+' [request '+r.id+']').join('\n') : 'None.'), lines:lines.length ? lines : ['Nothing waiting.'], links:['#/schedule']};
    }},
    reports_waiting:{kind:'read', tiers:MGR, view:'inbox', label:'Reports to review', run(){
      const list = S().reports.filter(r => r.site === S().site && r.status !== 'Filed');
      const lines = list.map(r => fmtDate(r.at)+' · '+(r.type||'General')+' · '+r.status+(r.resident ? ' · resident '+r.resident : ''));
      return {text:'Reports waiting at '+site().name+':\n'+(lines.join('\n') || 'None.'), lines:lines.length ? lines : ['No reports waiting.'], links:['#/inbox']};
    }},
    find_procedure:{kind:'read', tiers:ALL, view:'check', label:'Procedure check', run(inp){
      const q = clip(inp.question, 300).trim(); if (!q) return {text:'What is the question?', error:true};
      const hits = A.searchRules(q) || [];
      if (!hits.length) return {text:'No answer on file for "'+q+'". Offer to send it to the manager\'s question log (log_question).', lines:['No clear answer on file yet. I can send this question to your manager\'s question log.'], nohit:q};
      const r = hits[0], st = A.setting(), a = r[st] || r.afh;
      const lines = [r.q, a.a, 'Source: '+a.cite].concat((r.steps||[]).map((s,i) => (i+1)+'. '+s));
      const rel = hits.slice(1,3).map(x => 'Related: '+x.q);
      return {text:lines.concat(rel).join('\n')+'\n(Label: '+r.label+'. Not legal advice.)', lines:lines.concat(['Not legal advice. Your home\'s own policy may add steps.']), links:['#/check/'+r.id]};
    }},
    list_residents:{kind:'read', tiers:ALL, label:'Residents', run(){
      const lines = residents().map(r => r.code+' ('+r.nick+', sample)');
      return {text:'Residents at '+site().name+' (sample, use codes in records): '+(lines.join(', ') || 'none'), lines:lines.length ? lines : ['No residents on file.']};
    }},
    list_staff:{kind:'read', tiers:STAFF, label:'Staff', run(){
      return {text:'Staff at '+site().name+': '+staffNames().join(', ')+'. You are '+me()+'.', lines:staffNames()};
    }},
    open_screen:{kind:'read', tiers:ALL, label:'Open a screen', run(inp){
      const v = String(inp.screen||'').trim();
      if ((!VIEWS[v] || v === 'assistant') && window.SSSearch){
        // words, not a screen id: use quick search ("fax inbox", "face sheet Ruth", "add a policy")
        const hits = SSSearch.find(v, 3).filter(x => x.href !== '#/assistant');
        if (!hits.length) return {text:'No screen matches "'+clip(v,40)+'".', error:true};
        return {text:'Showed links to: '+hits.map(x => x.title).join('; ')+'.', head:'Go to', lines:[], links:hits.map(x => ({href:x.href, label:x.title}))};
      }
      if (!VIEWS[v] || v === 'assistant') return {text:'There is no screen called "'+clip(v,40)+'".', error:true};
      if (!viewOn(v)) return {text:VIEWS[v].t+' is switched off for this home.', error:true};
      return {text:'Showed a link to '+VIEWS[v].t+'.', lines:[], links:['#/'+v]};
    }},

    // ----- writes (each shows a confirm card first) -----
    add_shift:{kind:'write', tiers:MGR, perm:'sched.edit', view:'schedule', label:'Add a shift', preview(inp){
      if (!isIso(inp.date)) return {err:'Which day? Use a date like '+today()+'.'};
      if (!isTime(inp.start) || !isTime(inp.end) || inp.start === inp.end) return {err:'Give a start and end time, like 07:00 to 15:00.'};
      let n = null; if (inp.person){ const p = findPerson(inp.person); if (p.err) return {err:p.err}; n = p.n; }
      const sh = {id:uid(), site:S().site, date:inp.date, start:inp.start, end:inp.end, staff:n, kind:'shift', note:clip(inp.note,200)||undefined, via:'chat'};
      const d = X().dn(sh.date);
      const issues = n ? X().fitFor(sh, n) : X().diffIssues(sh.site, d-1, d+7, X().withChange(L => L.push(Object.assign({}, sh))));
      const warn = issues.slice(0,5).map(i => i.text);
      if (n && X().timeOffFor(sh.site, n, sh.date)) warn.unshift(n+' has time off that day.');
      if (X().shiftsAt(sh.site).some(s => s.date === sh.date && s.start === sh.start && s.end === sh.end && s.staff === n)) warn.unshift('This exact shift is already on the schedule.');
      return {title:'Add this shift?', lines:[dayName(sh.date)+', '+tLong(sh.start)+' to '+tLong(sh.end), n ? 'Who: '+n : 'Open shift (no one assigned yet)', 'Home: '+site().name].concat(sh.note ? ['Note: '+sh.note] : []), warn,
        commit(){ X().snap(); X().ensure().shifts.push(sh); X().audit('Added a shift by chat: '+dayName(sh.date)+' '+X().span(sh)+' '+(n||'open'), sh.site); A.save();
          return 'Added '+dayName(sh.date)+' '+tLong(sh.start)+' to '+tLong(sh.end)+' for '+(n||'an open shift')+'. The week still needs publishing from the Schedule screen if it was already published.'; }};
    }},
    assign_shift:{kind:'write', tiers:MGR, perm:'sched.edit', view:'schedule', label:'Assign a shift', preview(inp){
      const s = X().shiftsAt(S().site).find(x => x.id === inp.shift_id); if (!s) return {err:'That shift was not found. Look it up with get_schedule first.'};
      let n = null; if (inp.person && !/^(open|nobody|no one)$/i.test(inp.person)){ const p = findPerson(inp.person); if (p.err) return {err:p.err}; n = p.n; }
      const warn = n ? X().fitFor(s, n).slice(0,5).map(i => i.text) : ['This makes it an open shift.'];
      if (n && X().timeOffFor(s.site, n, s.date)) warn.unshift(n+' has time off that day.');
      return {title:n ? 'Give this shift to '+n+'?' : 'Make this an open shift?', lines:[dayName(s.date)+', '+tLong(s.start)+' to '+tLong(s.end), 'Now: '+(s.staff || 'open'), 'After: '+(n || 'open')], warn,
        commit(){ X().snap(); const was = s.staff; s.staff = n; X().audit('Changed a shift by chat: '+dayName(s.date)+' '+X().span(s)+' from '+(was||'open')+' to '+(n||'open'), s.site); A.save(); return 'Done. '+dayName(s.date)+' '+X().span(s)+' is now '+(n||'open')+'.'; }};
    }},
    request_time_off:{kind:'write', tiers:['caregiver','manager','rn'], view:'schedule', label:'Ask for time off', preview(inp){
      if (!isIso(inp.from)) return {err:'Which day does the time off start?'};
      const to = isIso(inp.to) ? inp.to : inp.from; if (to < inp.from) return {err:'The end date is before the start date.'};
      let n = me(); if (inp.person && MGR.includes(S().tier)){ const p = findPerson(inp.person); if (p.err) return {err:p.err}; n = p.n; }
      if (!staffNames().includes(n)) return {err:'You are not on the staff list for '+site().name+', so there is no schedule to take time off from.'};
      const kind = ['PTO','Unpaid','Other'].includes(inp.kind) ? inp.kind : 'PTO';
      const on = X().shiftsAt(S().site).filter(s => s.staff === n && s.date >= inp.from && s.date <= to);
      const warn = on.slice(0,5).map(s => n+' is scheduled '+dayName(s.date)+' '+X().span(s)+'. If approved, it becomes an open shift.');
      if (kind === 'PTO') warn.push('Paid time off left (sample): '+X().prof(n).pto+' hours.');
      return {title:'Send this time-off request?', lines:[n+': '+(kind === 'PTO' ? 'paid time off' : kind.toLowerCase()+' time off'), dayName(inp.from)+(to !== inp.from ? ' to '+dayName(to) : '')].concat(inp.note ? ['Note: '+clip(inp.note,300)] : []), warn,
        yes:'Yes, send it', commit(){ const r = {id:uid(), site:S().site, type:'timeoff', by:n, from:inp.from, to, pto:kind, status:'Pending', at:new Date().toISOString(), note:clip(inp.note,300), via:'chat'};
          X().ensure().requests.push(r); X().audit('Sent a request by chat: Time off', S().site); A.save(); return 'Sent privately to the manager. You\'ll see the answer on the Schedule screen.'; }};
    }},
    decide_request:{kind:'write', tiers:MGR, perm:'sched.approve', view:'schedule', label:'Approve or decline', preview(inp){
      const x = X().ensure().requests.find(r => r.id === inp.request_id && r.site === S().site && r.status === 'Pending');
      if (!x) return {err:'That request was not found or was already decided. Look it up with pending_requests.'};
      const st = /^decl|^den|^no/i.test(inp.decision) ? 'Declined' : 'Approved';
      let warn = [];
      const s = x.shift && X().ensure().shifts.find(y => y.id === x.shift);
      if (st === 'Approved' && s){ const d = X().dn(s.date); warn = X().diffIssues(S().site, d-1, d+7, X().withChange(L => X().applyReq(x, L))).slice(0,4).map(i => i.text); }
      if (st === 'Approved' && x.type === 'timeoff') warn = X().shiftsAt(S().site).filter(y => y.staff === x.by && y.date >= x.from && y.date <= x.to).map(y => x.by+' is scheduled '+dayName(y.date)+' '+X().span(y)+'. Approving opens this shift.');
      return {title:(st === 'Approved' ? 'Approve' : 'Decline')+' this request?', lines:[X().reqText(x)].concat(inp.reply ? ['Your reply: "'+clip(inp.reply,200)+'"'] : []), warn,
        yes:'Yes, '+st.toLowerCase().replace('ed','e'), commit(){ X().decideReq(x, st, inp.reply); return st+'. '+X().reqText(x); }};
    }},
    set_on_call:{kind:'write', tiers:MGR, perm:'sched.edit', view:'schedule', label:'Set on call', preview(inp){
      const p = findPerson(inp.person, ['Manager','On-call RN']); if (p.err) return {err:p.err};
      if (inp.date && !isIso(inp.date)) return {err:'Use a date like '+today()+', or leave the date out to change the usual person.'};
      const oc = X().ensure().oncall[S().site] || {def:'Manager', days:{}};
      return {title:'Change who is on call?', lines:[inp.date ? dayName(inp.date)+': '+(oc.days[inp.date] || oc.def)+' → '+p.n : 'Usual on-call person: '+oc.def+' → '+p.n, 'Night help calls go to this person.'],
        commit(){ const sc = X().ensure(); sc.oncall[S().site] = oc; if (inp.date) oc.days[inp.date] = p.n; else { oc.def = p.n; } X().audit('Set on call by chat: '+(inp.date ? dayName(inp.date) : '(usual)')+' '+p.n, S().site); A.save(); return p.n+' is now on call '+(inp.date ? dayName(inp.date) : 'by default')+'.'; }};
    }},
    log_incident:{kind:'write', tiers:ALL, view:'report', label:'Write a report', preview(inp){
      const what = clip(inp.what_happened, 2000).trim(); if (!what) return {err:'What happened? Facts only: what you saw and heard.'};
      const r0 = findResident(inp.resident); if (r0.err) return {err:r0.err};
      const when = inp.when && !isNaN(new Date(inp.when)) ? inp.when : new Date().toISOString();
      const r = A.rewrite({res:r0.code, when, where:clip(inp.where,120) || 'not given', who:clip(inp.people_present,200), raw:what, did:clip(inp.what_you_did,600), told:clip(inp.who_you_told,300)});
      const warn = r.missing.map(m => 'Missing: '+m+'. Add it in the box before saving.').concat(r.flags.slice(0,4).map(f => '"'+f.w+'": '+f.why));
      return {title:'Send this report to the manager?', lines:[resLabel(r0)+' · '+(r.routes.map(x => x.type).join(', ') || 'General')], warn,
        alert:r.report ? (A.setting() === 'afh' ? 'This may be a mandatory report. Make sure everyone is safe, tell the person your home designates today. An adult family home reports to DQA right away (DHS 88.11(1)), and police if it may be a crime.' : 'This may be a mandatory report. Make sure everyone is safe and tell the person your home designates today. Follow your home\'s reporting steps.') : null,
        edit:r.text, yes:'Yes, send it', commit(text){
          S().reports.push({id:uid(), site:S().site, at:new Date().toISOString(), type:r.routes.map(x => x.type).join(', ') || 'General', status:'Waiting for manager', resident:r0.code, raw:what, clean:text, by:tier().name+' (you, by chat)', via:'chat'}); A.save();
          return 'Sent privately to the manager\'s review list (Reports to review).'; }};
    }},
    log_meal:{kind:'write', tiers:['caregiver','manager','rn','family'], view:'meals', label:'Log a meal', preview(inp){
      const C = window.SSCare; if (!C) return {err:'Meals is not available in this version.'};
      const r0 = findResident(inp.resident); if (r0.err || !r0.code) return {err:r0.err || 'Which resident?'};
      const meal = {breakfast:'b', lunch:'l', supper:'s', dinner:'s'}[String(inp.meal||'').toLowerCase()]; if (!meal) return {err:'Which meal: breakfast, lunch or supper?'};
      const refused = !!inp.refused;
      let pct = refused ? 0 : Math.round((+inp.percent_eaten || 0)/25)*25; pct = Math.max(0, Math.min(100, pct));
      if (!refused && inp.percent_eaten == null) return {err:'About how much was eaten: 0, 25, 50, 75 or 100 percent?'};
      const date = isIso(inp.date) ? inp.date : today(), c = C.ensure();
      const prev = c.meals.find(m => m.site === S().site && m.res === r0.code && m.date === date && m.meal === meal);
      let need = []; try { need = (C.trackItems(S().site, r0.code, 'meal') || []).map(o => o.track.label); } catch(e){}
      const warn = (prev ? ['This replaces the entry already saved for this meal.'] : []).concat(need.map(l => 'Order item to record on the Meals screen: '+l));
      const mName = {b:'Breakfast', l:'Lunch', s:'Supper'}[meal];
      return {title:'Save this meal log?', lines:[resLabel(r0), mName+', '+dayName(date), refused ? 'Refused the meal' : 'Ate about '+pct+'%'].concat(inp.fluids_ml ? ['Fluids: '+Math.round(+inp.fluids_ml)+' mL'] : []).concat(inp.note ? ['Note: '+clip(inp.note,200)] : []), warn,
        commit(){ if (prev) c.meals = c.meals.filter(m => m !== prev);
          c.meals.push({id:uid(), site:S().site, res:r0.code, date, meal, at:new Date().toISOString(), by:tier().name+' (you, by chat)', form:1, via:'chat', vals:{pct, fluids:inp.fluids_ml ? Math.round(+inp.fluids_ml) : '', refused, sub:clip(inp.substitute,200), assist:'', note:clip(inp.note,200)}, orders:{}}); A.save();
          return mName+' saved for '+r0.code+'.'; }};
    }},
    clock:{kind:'write', tiers:['caregiver','manager'], view:'time', label:'Clock in or out', preview(inp){
      const T = window.SSTime; if (!T || !T.punch) return {err:'Time sheets are not available in this version.'};
      const n = me(); if (!staffNames().includes(n)) return {err:'You are not on the staff list for '+site().name+'.'};
      const act = ['in','out','break','back'].includes(inp.action) ? inp.action : null; if (!act) return {err:'Clock in, clock out, start a break, or back from break?'};
      const cur = T.current(S().site, n);
      if (act === 'in' && cur) return {err:'You are already clocked in.'};
      if (act !== 'in' && !cur) return {err:'You are not clocked in.'};
      const sh = T.shiftNow && T.shiftNow(S().site, n);
      const words = {in:'Clock in', out:'Clock out', break:'Start a break', back:'End your break'}[act];
      return {title:words+' now?', lines:[n+' at '+site().name, 'Time: '+new Date().toLocaleTimeString(undefined,{hour:'numeric', minute:'2-digit'}), sh ? 'Shift: '+X().span(sh) : (act === 'in' ? 'Not on the schedule right now. Your manager will check it.' : '')].filter(Boolean),
        yes:'Yes, '+words.toLowerCase(), async commit(){ const r = await T.punch(S().site, n, act, 'phone'); if (r.err) throw new Error(r.err); return r.msg; }};
    }},
    log_question:{kind:'write', tiers:ALL, label:'Ask the manager', preview(inp){
      const q = clip(inp.question, 300).trim(); if (!q) return {err:'What is the question?'};
      return {title:'Send this question to the manager\'s question log?', lines:['"'+q+'"', 'Your name is not attached. The manager answers it and adds it for everyone.'], yes:'Yes, send it',
        commit(){ S().questions.push({q, id:null, site:S().site, tier:S().tier, at:new Date().toISOString(), shift:A.shiftName(), via:'chat'}); A.save(); return 'Sent to the question log.'; }};
    }}
  };

  // A tool is offered when the role has it (or a manager shared the permission) and its service is on for this home.
  function allowed(name){
    const t = TOOLS[name]; if (!t) return false;
    if (S().site === 'family' && ['get_schedule','pending_requests','list_staff','add_shift','assign_shift','request_time_off','decide_request','set_on_call','clock'].includes(name)) return false;
    const role = t.tiers.includes(S().tier) || (t.perm && granted(t.perm));
    if (!role) return false;
    if (t.view && !viewOn(t.view)) return false;
    if (t.view && ['get_schedule','pending_requests','add_shift','assign_shift','request_time_off','decide_request','set_on_call'].includes(name) && !X()) return false;
    return true;
  }
  const allowedNames = () => Object.keys(TOOLS).filter(allowed);
  function whyNot(name){
    const t = TOOLS[name]; if (!t) return 'That is not something I can do.';
    if (t.view && !viewOn(t.view)) return (VIEWS[t.view] ? VIEWS[t.view].t : 'That service')+' is switched off for this home.';
    return 'Your role ('+tier().name+') can\'t do "'+t.label+'". Ask your manager, or a manager can share it with you in Services and access.';
  }

  // ---------- page state (memory only) ----------
  let mode = null;          // 'ai' or 'local'
  let probing = null;
  let convo = [];           // AI messages in Anthropic format
  let shown = [];           // rendered items, so the chat survives moving between screens
  let busy = false;
  let pendingConfirm = null;
  let logEl = null, inputEl = null, statusEl = null;

  function probe(){
    if (probing) return probing;
    probing = (async () => {
      const sb = A.sb && A.sb();
      if (!sb){ mode = 'local'; return; }
      try { const {data, error} = await sb.functions.invoke('app-chat', {body:{ping:true}}); mode = !error && data && data.ok ? 'ai' : 'local'; }
      catch(e){ mode = 'local'; }
    })();
    return probing;
  }

  // ---------- rendering ----------
  function push(node){ shown.push(node); if (logEl){ logEl.append(node); logEl.scrollTop = logEl.scrollHeight; } return node; }
  const bot = text => push(h('div',{class:'bub bot'}, text));
  const mine = text => push(h('div',{class:'bub me'}, text));
  function linkRow(links){
    // a link is '#/view' or {href, label}
    const ls = (links||[]).map(l => typeof l === 'string' ? {href:l} : l).filter(l => { const v = l.href.replace(/^#\//,'').split('/')[0]; return VIEWS[v] && viewOn(v); });
    if (!ls.length) return null;
    return h('div',{class:'row'}, ls.map(l => { const v = l.href.replace(/^#\//,'').split('/')[0]; return h('a',{class:'btn ghost sm',href:l.href}, VIEWS[v].ic+' Open '+(l.label || VIEWS[v].t)); }));
  }
  function resultCard(name, res){
    const t = TOOLS[name];
    const lines = res.lines || [res.text];
    return push(h('div',{class:'bub sum as-res'}, h('b',null,res.head || t.label),
      lines.length ? h('ul',{class:'as-lines'}, lines.slice(0,30).map(l => h('li',null,l))) : null,
      lines.length > 30 ? h('p',{class:'small muted'},'And '+(lines.length-30)+' more.') : null,
      linkRow(res.links)));
  }

  // Confirm card: nothing is saved until the person taps the green button.
  function confirmCard(p){
    return new Promise(resolve => {
      const ta = p.edit != null ? h('textarea',{class:'as-edit','aria-label':'Edit before sending'}) : null; if (ta) ta.value = p.edit;
      const out = h('p',{class:'small','aria-live':'polite'});
      const yes = h('button',{class:'btn sm',type:'button'}, p.yes || 'Yes, save it');
      const no = h('button',{class:'btn quiet sm',type:'button'}, 'No, cancel');
      const card = push(h('div',{class:'card as-confirm',role:'group','aria-label':p.title},
        h('b',null,p.title),
        h('ul',{class:'as-lines'}, p.lines.map(l => h('li',null,l))),
        p.alert ? h('div',{class:'card alert',role:'alert'}, h('b',null,'Read first'), h('p',{class:'small'},p.alert)) : null,
        (p.warn||[]).length ? h('div',{class:'card warn'}, h('b',null,'Check before you save'), h('ul',{class:'small'}, p.warn.map(w => h('li',null,w)))) : null,
        ta, h('div',{class:'row'}, yes, no), out));
      const finish = (r, label) => { yes.disabled = no.disabled = true; if (ta) ta.readOnly = true; card.classList.add('done'); out.textContent = label; pendingConfirm = null; resolve(r); };
      yes.addEventListener('click', async () => {
        yes.disabled = no.disabled = true;
        try { const msg = await p.commit(ta ? ta.value : undefined); finish({ok:true, text:msg}, '✓ '+msg); toast('Saved'); }
        catch(e){ finish({ok:false, text:'Could not save: '+(e && e.message || 'error')}, 'Could not save: '+(e && e.message || 'error')); }
      });
      no.addEventListener('click', () => finish({ok:false, cancelled:true, text:'The person tapped "No, cancel". Nothing was saved.'}, 'Cancelled. Nothing was saved.'));
      pendingConfirm = text => finish({ok:false, cancelled:true, text:'Not saved: the person typed a new message instead of confirming: "'+clip(text,300)+'"'}, 'Not saved.');
      (ta || yes).focus({preventScroll:true});
    });
  }

  // Runs one tool call. Returns the text that goes back to the AI (or is shown in local mode).
  async function runTool(name, input){
    input = input && typeof input === 'object' ? input : {};
    if (!allowed(name)){ const why = whyNot(name); bot(why); return {text:why, error:true}; }
    const t = TOOLS[name];
    try {
      if (t.kind === 'read'){
        const res = t.run(input);
        if (res.error) { if (mode === 'local') bot(res.text); return res; }
        if (name !== 'open_screen' || (res.links||[]).length) resultCard(name, res);
        return res;
      }
      const p = t.preview(input);
      if (p.err){ if (mode === 'local') bot(p.err); return {text:p.err, error:true}; }
      const r = await confirmCard(p);
      return {text:r.text, error:!r.ok};
    } catch(e){ console.error(e); const m = 'Something went wrong with "'+t.label+'".'; bot(m); return {text:m, error:true}; }
  }

  // ---------- AI mode ----------
  function context(){
    const views = Object.keys(VIEWS).filter(v => v !== 'assistant' && viewOn(v)).map(v => v+' ('+VIEWS[v].t+')');
    const now = new Date();
    return {today:today(), weekday:now.toLocaleDateString('en-US',{weekday:'long'}), time:pad(now.getHours())+':'+pad(now.getMinutes()),
      tier:S().tier, tierName:tier().name, site:site().name, setting:A.setting(), me:me(),
      staff:STAFF.includes(S().tier) ? staffNames() : [], residents:residents().map(r => r.code), screens:views, tools:allowedNames()};
  }
  function trimConvo(){
    while (convo.length > 40){
      const i = convo.findIndex((m, k) => k > 0 && m.role === 'user' && typeof m.content === 'string');
      if (i <= 0) { convo = convo.slice(-1); break; }
      convo = convo.slice(i);
    }
  }
  async function aiTurn(){
    for (let step = 0; step < 6; step++){
      trimConvo();
      const typing = bot('…');
      let data, error;
      try { ({data, error} = await A.sb().functions.invoke('app-chat', {body:{mode:'assistant', messages:convo, context:context()}})); } catch(e){ error = e; }
      typing.remove(); shown = shown.filter(x => x !== typing);
      if (error || !data || !Array.isArray(data.content)){
        if (step === 0) return false;
        bot('The AI helper stopped answering. Anything you confirmed above is saved; try your next request again.'); return true;
      }
      convo.push({role:'assistant', content:data.content});
      data.content.filter(b => b.type === 'text' && b.text.trim()).forEach(b => bot(b.text.trim()));
      const uses = data.content.filter(b => b.type === 'tool_use');
      if (!uses.length) return true;
      const results = [];
      for (const u of uses){
        const r = await runTool(u.name, u.input);
        results.push({type:'tool_result', tool_use_id:u.id, content:clip(r.text, 6000), is_error:!!r.error});
      }
      const extra = afterConfirm.splice(0);
      convo.push({role:'user', content:results.concat(extra.map(t => ({type:'text', text:t})))});
    }
    bot('I\'ll stop here so nothing runs away. What would you like next?');
    return true;
  }
  const afterConfirm = [];

  // ---------- quick commands (no AI): the common requests, same tools ----------
  const DOWS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  function datesIn(t){
    const out = [], base = new Date(today()+'T12:00:00');
    const re = /\b(today|tonight|tomorrow|(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|mon|tues|tue|wed|thurs|thur|thu|fri)|(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?|(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?)\b/gi;
    let m;
    while ((m = re.exec(t))){
      const w = m[0].toLowerCase(); let iso = null;
      if (w === 'today' || w === 'tonight') iso = today();
      else if (w === 'tomorrow') iso = addDays(today(), 1);
      else if (m[3]){ const k = DOWS.findIndex(d => d.startsWith(m[3].toLowerCase().slice(0,3))); let diff = (k - base.getDay() + 7) % 7; if (m[2] && diff === 0) diff = 7; iso = addDays(today(), diff); }
      else if (m[4]) iso = m[4]+'-'+m[5]+'-'+m[6];
      else if (m[7]){ let y = m[9] ? +m[9] : base.getFullYear(); if (y < 100) y += 2000; iso = y+'-'+pad(+m[7])+'-'+pad(+m[8]); if (!m[9] && iso < addDays(today(), -60)) iso = (y+1)+iso.slice(4); }
      else if (m[10]){ const mo = MONTHS.indexOf(m[10].toLowerCase().slice(0,3)); let y = base.getFullYear(); iso = y+'-'+pad(mo+1)+'-'+pad(+m[11]); if (iso < addDays(today(), -60)) iso = (y+1)+iso.slice(4); }
      if (iso && isIso(iso)) out.push({iso, at:m.index, len:m[0].length});
    }
    return out;
  }
  // "7-3" -> 07:00-15:00, "3-11" -> 15:00-23:00, "11-7" -> 23:00-07:00, "6p-6a", "7:30am to 3:30pm", "07:00-15:00"
  function timeRange(t){
    const m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a|p|am|pm|a\.m\.|p\.m\.)?\s*(?:-|–|to|until|till)\s*(\d{1,2})(?::(\d{2}))?\s*(a|p|am|pm|a\.m\.|p\.m\.)?(?![\/\d])/i);
    if (!m) return null;
    let a = +m[1], b = +m[4]; const am = m[2] ? +m[2] : 0, bm = m[5] ? +m[5] : 0;
    if (a > 23 || b > 24 || am > 59 || bm > 59) return null;
    const ap = s => s ? s[0].toLowerCase() : '';
    const to24 = (x, s) => s === 'a' ? x % 12 : s === 'p' ? x % 12 + 12 : x;
    let A0, B0;
    if (ap(m[3]) || ap(m[6]) || a > 12 || b > 12 || m[2] && m[1].length === 2 && a >= 13){
      A0 = ap(m[3]) ? to24(a, ap(m[3])) : a; B0 = ap(m[6]) ? to24(b, ap(m[6])) : b;
      if (!ap(m[3]) && ap(m[6]) && a <= 12 && !(a > 12)){ // "6-6pm": pick the start that gives 4 to 16 hours
        const c = [a % 12, a % 12 + 12].map(x => ({x, d:((B0*60+bm) - (x*60+am) + 1440) % 1440})).filter(o => o.d >= 240 && o.d <= 960)[0]; if (c) A0 = c.x; }
    } else {
      A0 = a === 12 ? 12 : (a >= 1 && a <= 4) ? a + 12 : (a === 11 && b <= 8) ? 23 : a;
      const c = [b % 12, b % 12 + 12].map(x => ({x, d:((x*60+bm) - (A0*60+am) + 1440) % 1440})).filter(o => o.d > 0 && o.d <= 960).sort((p,q) => q.d - p.d);
      // prefer a common shift length: 8 or 12 hours, otherwise the shorter one
      const pick = c.find(o => o.d === 480 || o.d === 720) || c.sort((p,q) => p.d - q.d)[0];
      if (!pick) return null; B0 = pick.x;
    }
    if (B0 === 24) B0 = 0;
    return {start:pad(A0 % 24)+':'+pad(am), end:pad(B0 % 24)+':'+pad(bm), text:m[0]};
  }
  function personIn(t){
    const names = staffNames().concat(['Manager','On-call RN']);
    const low = t.toLowerCase();
    const hit = names.filter(n => low.includes(n.toLowerCase())).sort((a,b) => b.length-a.length)[0];
    if (hit) return hit;
    const m = t.match(/\b(?:schedule|put|add|book|assign|give|make)\s+(?!a\b|an\b|the\b|me\b|shift\b|open\b)([A-Za-z][\w'-]*(?:\s+[A-Z]\b)?)/i);
    return m ? m[1] : null;
  }
  function residentIn(t){
    const m = t.match(/\b(?:room|rm|bed)\s*#?\s*(\d+)\b/i); if (m) return 'room '+m[1];
    const c = t.match(/\b([A-Z])-(\d+)\b/i); if (c) return c[0].toUpperCase();
    const r = residents().find(x => new RegExp('\\b'+x.nick+'\\b','i').test(t)); return r ? r.code : '';
  }
  function parse(t){
    const low = t.toLowerCase().trim();
    const dates = datesIn(t), d0 = dates[0] ? dates[0].iso : null;
    if (/^(help|\?|hi|hello|hey|what can you do|commands?)\b/.test(low)) return [{help:true}];
    if (/\b(clock(ed)?|punch(ed)?)\s*(me\s*)?(in|out)\b/.test(low)) return [{name:'clock', input:{action:/\b(out)\b/.test(low.replace(/clock(ed)?\s*(me\s*)?in/,'')) ? 'out' : 'in'}}];
    if (/\b(start(ing)?|take|taking|go on)\s+(my\s+|a\s+)?break\b/.test(low)) return [{name:'clock', input:{action:'break'}}];
    if (/\b(back from|end(ing)?|done with)\s+(my\s+|a\s+)?break\b/.test(low)) return [{name:'clock', input:{action:'back'}}];
    if (/\b(log|report|write( it)? up|document|record)\b/.test(low) && /\b(fall|fell|found on (the )?floor|incident|injur|bruise|skin tear|hit|struck|kick|bit|behavior|aggress|med(ication)? (error|mistake)|missed dose|wrong (med|dose)|elope|wander|left the (home|building)|choking|seizure|abuse|neglect|theft|missing)\w*/.test(low))
      return [{name:'log_incident', input:{resident:residentIn(t), what_happened:t.replace(/^\s*(please\s+)?(log|report|write( it)? up|document|record)\s+(a|an|the)?\s*/i,'').replace(/\s+for\s+(room|rm|bed)\s*#?\s*\d+/i,'') || t}}];
    if (/\b(ate|eaten|breakfast|lunch|supper|dinner)\b/.test(low) && (/\d+\s*%|percent|refused|all of|none of|half/.test(low))){
      const meal = (low.match(/\b(breakfast|lunch|supper|dinner)\b/)||[])[1] || (new Date().getHours() < 10 ? 'breakfast' : new Date().getHours() < 15 ? 'lunch' : 'supper');
      const pm = low.match(/(\d{1,3})\s*(%|percent)/); const pct = pm ? +pm[1] : /all of|everything/.test(low) ? 100 : /half/.test(low) ? 50 : /none|nothing/.test(low) ? 0 : null;
      return [{name:'log_meal', input:{resident:residentIn(t), meal, percent_eaten:pct, refused:/\brefused\b/.test(low), date:d0 || today()}}];
    }
    if ((/\b(time off|days? off|pto|vacation)\b/.test(low) || /\b(need|want|request|ask(ing)? for|take|have)\b.*\boff\b/.test(low)) && dates.length)
      return [{name:'request_time_off', input:{from:dates[0].iso, to:dates[dates.length-1].iso, kind:/unpaid/.test(low) ? 'Unpaid' : 'PTO', person:MGR.includes(S().tier) ? personIn(t) : null}}];
    if (/on[- ]?call/.test(low) && !/\bwho\b/.test(low) && personIn(t))
      return [{name:'set_on_call', input:{person:personIn(t), date:d0}}];
    if (/\b(approve|decline|deny|okay|ok)\b/.test(low) && /request|time off|swap|pick ?up|cover/.test(low)){
      const who = personIn(t), pend = X() ? X().ensure().requests.filter(r => r.site === S().site && r.status === 'Pending' && (!who || r.by === who)) : [];
      if (pend.length === 1) return [{name:'decide_request', input:{request_id:pend[0].id, decision:/decline|deny/.test(low) ? 'Declined' : 'Approved'}}];
      return [{name:'pending_requests', input:{}, note:pend.length ? 'More than one request matches. Say whose, like "approve Caregiver E\'s request".' : 'No waiting request matched.'}];
    }
    const tr = timeRange(t.replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g,' '));
    if (tr && /\b(schedule|put|add|book|assign|open shift|shift)\b/.test(low) && !/\b(who|what|when)\b/.test(low)){
      if (!d0) return [{say:'Which day? For example: "schedule Caregiver B 7-3 Tuesday".'}];
      const open = /\bopen shift\b/.test(low) && !personIn(t.replace(/open shift/i,''));
      return [{name:'add_shift', input:{person:open ? null : personIn(t), date:d0, start:tr.start, end:tr.end}}];
    }
    if (/\b(add|upload|enter|input|put in|update|where (do|can) i (add|put|upload))\b.*\b(polic|procedure|handbook)/.test(low)) return [{name:'open_screen', input:{screen:'add policy procedures'}}];
    const scr = low.match(/^(?:open|go to|take me to|jump to|find|show me|where(?:'s| is| are| do i find| can i find)?)\s+(?:the\s+)?(.+?)(?:\s+screen|\s+page)?\??$/);
    if (scr && window.SSSearch && SSSearch.find(scr[1], 1).length) return [{name:'open_screen', input:{screen:scr[1]}}];
    if (/\b(due|to-?do|coming up|what'?s (up|next|on)|deadlines?|this week)\b/.test(low) && !/\bwho\b/.test(low)) return [{name:'whats_due', input:{days:/month/.test(low) ? 30 : /today/.test(low) ? 1 : 7}}];
    if (/\bopen shifts?\b/.test(low)) return [{name:'get_schedule', input:{from:d0 || today(), to:dates[1] ? dates[1].iso : addDays(d0 || today(), 6), only_open:true}}];
    if (/\bmy (next )?shifts?\b|when do i work|my schedule/.test(low)) return [{name:'get_schedule', input:{from:d0 || today(), to:addDays(d0 || today(), 6), person:'me'}}];
    if (/\b(who'?s|who is|who are)\b.*\b(working|on|scheduled|on call|on-call)\b|\bschedule\b|\bwho works\b/.test(low)){
      const p = personIn(t);
      return [{name:'get_schedule', input:{from:d0 || today(), to:dates[1] ? dates[1].iso : (/week/.test(low) ? addDays(d0 || today(), 6) : d0 || today()), person:p && staffNames().includes(p) ? p : null}}];
    }
    if (/\b(requests?|approvals?|pending)\b/.test(low)) return [{name:'pending_requests', input:{}}];
    if (/\breports?\b/.test(low) && /\b(waiting|review|inbox|new|open)\b/.test(low)) return [{name:'reports_waiting', input:{}}];
    if (/\b(residents?|who lives)\b/.test(low) && /\b(list|who|show|codes?)\b/.test(low)) return [{name:'list_residents', input:{}}];
    if (/\b(staff list|list (the )?staff|who works here)\b/.test(low)) return [{name:'list_staff', input:{}}];
    // short words that name a screen ("vendors", "fax inbox", "face sheet Ruth") open it
    if (window.SSSearch && low.split(/\s+/).length <= 4){ const top = SSSearch.find(t, 1)[0]; if (top && top.score >= 3) return [{name:'open_screen', input:{screen:t}}]; }
    return [{name:'find_procedure', input:{question:t}}];
  }
  function helpText(){
    const ex = examples();
    return 'I can look things up and do things for you here at '+site().name+'. Try:\n- '+ex.join('\n- ')+'\n\nAnything that saves or sends shows you a confirm card first. Nothing is saved until you tap yes.';
  }
  async function localTurn(t){
    const plan = parse(t);
    for (const step of plan){
      if (step.help){ bot(helpText()); continue; }
      if (step.say){ bot(step.say); continue; }
      if (step.note) bot(step.note);
      const res = await runTool(step.name, step.input);
      if (step.name === 'find_procedure' && res.nohit && allowed('log_question')) await runTool('log_question', {question:res.nohit});
    }
  }

  async function send(t){
    t = String(t||'').trim(); if (!t) return;
    if (/\b(dob|date of birth|ssn|social security|medicaid (id|number)|diagnos\w*)\b/i.test(t)) bot('Quick reminder: this is the test version, so please use the sample residents (codes like M-2), not real people or health details.');
    mine(t);
    if (pendingConfirm){ afterConfirm.push(t); pendingConfirm(t); return; }
    if (busy){ afterConfirm.push(t); return; }
    busy = true; setBusy();
    try {
      await probe();
      let next = t;
      while (next != null){
        if (mode === 'ai'){
          convo.push({role:'user', content:next});
          const ok = await aiTurn();
          if (!ok){ convo.pop(); mode = 'local'; setStatus(); bot('The AI helper isn\'t answering right now, so I\'ll use quick commands.'); await localTurn(next); }
        } else await localTurn(next);
        // messages typed while it was working (in AI mode most are already passed along with the tool results)
        next = afterConfirm.length ? afterConfirm.splice(0).join('\n') : null;
      }
    } finally { busy = false; setBusy(); }
  }

  function examples(){
    const t = S().tier, ex = [];
    if (allowed('whats_due')) ex.push('What\'s due this week?');
    if (allowed('add_shift')) ex.push('Schedule '+(staffNames()[1] || 'Caregiver B')+' 7-3 Tuesday');
    if (allowed('get_schedule')) ex.push(t === 'caregiver' ? 'When is my next shift?' : 'Who\'s working tonight?');
    if (allowed('log_incident')) ex.push('Log a fall for room 2. Found on the floor by the bed, helped up with 2 staff, told the nurse.');
    if (allowed('clock') && staffNames().includes(me())) ex.push('Clock me in');
    if (allowed('request_time_off') && staffNames().includes(me())) ex.push('I need Dec 24 off');
    if (allowed('decide_request')) ex.push('Show the requests waiting');
    if (allowed('log_meal')) ex.push((residents()[0] ? residents()[0].nick : 'Ruth')+' ate 75% of lunch');
    if (allowed('find_procedure')) ex.push('Can I pre-pour meds for later?');
    return ex.slice(0, 7);
  }
  // The Send button stays on while it works: a new message during a confirm card cancels that card.
  function setBusy(){ if (logEl) logEl.setAttribute('aria-busy', busy && !pendingConfirm ? 'true' : 'false'); }
  function setStatus(){
    if (!statusEl) return;
    statusEl.textContent = mode === 'ai' ? 'AI helper on. It asks before saving anything.' : mode === 'local' ? 'Quick commands. The AI helper is not switched on yet, so type short requests like the examples.' : 'Checking the AI helper…';
  }

  // ---------- the screen ----------
  VIEWS.assistant = {t:'Do it by chat', ic:'💬'};
  for (const k in NAV) if (!NAV[k].includes('assistant')) NAV[k].splice(1, 0, 'assistant');
  // An owner can switch chat off for a home or a role in Services and access, like any other service.
  if (window.SSAccess && SSAccess.register) try { SSAccess.register({id:'assistant', name:'Do it by chat', ic:'💬', what:'Look things up and do everyday jobs by typing, with a confirm step before anything is saved.', views:['assistant'], tiers:ALL}); } catch(e){}
  R.assistant = v => {
    v.append(head('Chat', 'Do it by chat', 'Type what you need the way you\'d say it to a coworker. It looks things up, and anything that saves or sends asks you first.'));
    statusEl = h('p',{class:'small muted',role:'status'});
    logEl = h('div',{class:'as-log','aria-live':'polite','aria-label':'Conversation'});
    inputEl = h('textarea',{rows:'2',maxlength:'2000',placeholder:'For example: '+(examples()[1] || 'What\'s due this week?'),'aria-label':'Your message'});
    const form = h('form',{class:'as-input'}, inputEl, h('button',{class:'btn',type:'submit'},'Send'));
    form.addEventListener('submit', e => { e.preventDefault(); const t = inputEl.value; inputEl.value = ''; send(t); });
    inputEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); form.requestSubmit(); } });
    const chips = h('div',{class:'chips'}, examples().map(x => h('button',{class:'chip',type:'button',onclick:()=>send(x)}, x)));
    const tools = allowedNames().filter(n => TOOLS[n].kind === 'write').map(n => TOOLS[n].label);
    v.append(h('div',{class:'card as-wrap'}, statusEl, logEl, chips, form),
      h('details',{class:'card'}, h('summary',null,'What it can do as '+tier().name.toLowerCase()),
        h('p',{class:'small'},'Look up: what\'s due, the schedule and who\'s on call, requests, reports waiting, procedure answers, residents (sample codes).'),
        h('p',{class:'small'},'Do, after you confirm: '+(tools.join(', ') || 'nothing for this role')+'.'),
        h('p',{class:'small'},'It follows your role and what your manager shared with you in Services and access. Switch "View as" to see another role. The conversation is not saved; leaving the app clears it.'),
        h('p',{class:'small muted'},'Test version: sample data only. Please don\'t type real resident names or health details.')));
    if (shown.length) shown.forEach(n => logEl.append(n));
    else bot('Hi! What do you need? '+(examples()[0] ? 'For example: "'+examples()[0]+'"' : ''));
    setStatus(); setBusy();
    probe().then(setStatus);
    if (askNext){ const q = askNext; askNext = null; setTimeout(() => send(q), 0); }
    setTimeout(() => { logEl.scrollTop = logEl.scrollHeight; }, 0);
  };
  // the conversation belongs to one role and home; start fresh when either changes
  ['tierSel','siteSel'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('change', () => { convo = []; shown = []; pendingConfirm = null; }); });

  (A.homeHooks = A.homeHooks || []).push(v => {
    if (!viewOn('assistant')) return;
    v.append(h('div',{class:'grid g2'}, A.tile('assistant','💬','Do it by chat','Type "what\'s due this week" or "schedule Caregiver B 7-3 Tuesday". It asks before saving.')));
  });

  // for tests and for the server's tool list
  let askNext = null; // a question handed over from quick search, sent when the chat screen opens
  window.SSAssistant = {ask:q => { askNext = String(q||'').slice(0,2000); },TOOLS, allowed, allowedNames, parse, timeRange, datesIn, runTool, send, context, reset:() => { convo = []; shown = []; mode = null; probing = null; }, setMode:m => { mode = m; probing = Promise.resolve(); }};
})();
