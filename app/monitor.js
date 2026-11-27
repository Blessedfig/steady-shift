// Steady Shift test app: follow-up checks after an event (post-event monitoring).
// After a head strike or unwitnessed fall, a medication error, a new medication or a change in condition, a schedule of
// vital-sign and neuro checks starts (house default 72 hours: frequent at first, then every shift). Each check lands on the
// shift it falls in, shows as due or overdue on Home, the shift change report and the house tablet, and a reading outside
// the limits tells staff to call the nurse. Nurse or prescriber orders override the house defaults. Sample data only.
(function(){
  const A = window.SSApp, C = window.SSCare;
  if (!A || !C) return;
  const {h, save, toast, head, R, VIEWS, NAV, uid, fmtDate, fmtTime, site, tier} = A;
  const S = () => A.state();
  const {chip, card, helpBox} = C;
  const residents = A.residents || (() => A.D.RESIDENTS[S().site] || []);
  const isNurse = () => ['rn','manager','owner'].includes(S().tier);
  const MIN = 60000, HOUR = 60*MIN;

  // ---------- house defaults (editable) ----------
  // steps: [minutes between checks, how many]; then "shift" = one check each shift until the window ends.
  const PROTOCOLS = {
    head:{name:'Hit their head, or a fall no one saw', neuro:true, hours:72, steps:[[15,4],[30,2],[60,4],[240,4]], shift:true,
      first:'Do not move them if you think they are hurt. Check for injury, then call the nurse. Call 911 for a lost or changing level of alertness, a seizure, repeated vomiting, or if they take a blood thinner and hit their head.'},
    fall:{name:'Fall, no head strike', neuro:false, hours:72, steps:[[60,4]], shift:true, first:'Check for injury before helping them up. New pain, swelling or not bearing weight: call the nurse.'},
    med:{name:'Medication error (wrong med, dose, time or person)', neuro:false, hours:72, steps:[[60,4],[240,5]], shift:true, first:'Call the nurse and the pharmacist or prescriber now and follow their instructions. Write facts only.'},
    newmed:{name:'New medication or dose change', neuro:false, hours:72, steps:[], shift:true, first:'Watch for side effects listed on the pharmacy sheet: dizziness, drowsiness, rash, upset stomach, confusion.'},
    change:{name:'Change in condition', neuro:false, hours:72, steps:[[240,3]], shift:true, first:'Tell the nurse what changed, when, and what you saw.'}
  };
  const LIMITS = {sbpLo:90, sbpHi:180, hrLo:50, hrHi:120, rrLo:10, rrHi:24, temp:100.4, spo2:90};
  function cfg(){ const c = C.ensure(); c.monitor = c.monitor || {}; const m = c.monitor; m.protocols = m.protocols || JSON.parse(JSON.stringify(PROTOCOLS)); m.limits = m.limits || Object.assign({}, LIMITS); m.episodes = m.episodes || seed(); return m; }

  // ---------- schedule ----------
  function shiftStarts(){ return [7, 19]; }  // check once in each 6-to-6 shift, an hour in
  function build(startMs, p){
    const out = []; let t = startMs;
    p.steps.forEach(([gap, n]) => { for (let i = 0; i < n; i++){ t += gap*MIN; out.push(t); } });
    const end = startMs + p.hours*HOUR;
    if (p.shift){
      const d = new Date(t); d.setMinutes(0,0,0);
      for (let k = 0; k < 20; k++){
        const cand = shiftStarts().map(hh => { const x = new Date(d); x.setHours(hh); return x.getTime(); }).filter(x => x > t + 2*HOUR);
        if (cand.length){ t = cand[0]; if (t > end) break; out.push(t); }
        else { d.setDate(d.getDate()+1); d.setHours(0); }
      }
    }
    return out.filter(x => x <= end);
  }
  function seed(){
    const now = Date.now();
    const ep = (res, sid, kind, hoursAgo, extra) => { const start = now - hoursAgo*HOUR; const p = PROTOCOLS[kind];
      const due = build(start, p); const checks = [];
      due.forEach((d, i) => { if (d < now - 3*HOUR) checks.push({slot:i, at:new Date(d + 5*MIN).toISOString(), by:'Caregiver (sample)', vals:{sbp:128, dbp:76, hr:78, rr:16, temp:98.2, spo2:96, pain:i<3?3:1, alert:'Yes', pupils:'Yes', grip:'Yes', speech:'Yes', headache:'No', vomit:'No'}, out:[]}); });
      return Object.assign({id:uid(), site:sid, res, kind, start:new Date(start).toISOString(), by:'House manager (sample)', due, checks, order:null, ended:null}, extra||{}); };
    return [
      ep('M-1','maple','head', 20, {note:'Found sitting on the bathroom floor at 5 AM. Small bump on the back of the head.'}),
      ep('B-7','birch','newmed', 30, {note:'New evening medication started (sample).', order:{by:'RN (sample)', note:'Blood pressure each shift for 72 hours. Call if top number under 100.', at:new Date(now - 29*HOUR).toISOString(), limits:{sbpLo:100}}})
    ];
  }
  const limitsFor = ep => Object.assign({}, cfg().limits, (ep.order && ep.order.limits) || {});
  function status(ep){
    const now = Date.now(); const done = new Set(ep.checks.map(c => c.slot));
    const rows = ep.due.map((d, i) => ({i, d, done:done.has(i), late: !done.has(i) && d < now - (i < 10 ? 15 : 60)*MIN}));
    const overdue = rows.filter(r => r.late);
    const next = rows.find(r => !r.done && !r.late);
    const ends = new Date(ep.start).getTime() + cfg().protocols[ep.kind].hours*HOUR;
    return {rows, overdue, next, ends, open: !ep.ended && now < ends + HOUR};
  }
  function shiftWindow(){ const sh = C.shiftNow(); const [eh, em] = (sh.end||'18:00').split(':').map(Number); const e = new Date(); e.setHours(eh, em||0, 0, 0); if (e.getTime() < Date.now() - HOUR) e.setDate(e.getDate()+1); return {start:e.getTime() - 12*HOUR, end:e.getTime(), name:sh.name}; }
  function active(sid){ return cfg().episodes.filter(e => e.site === (sid||S().site) && status(e).open); }
  function dueThisShift(sid){
    const w = shiftWindow(); const out = [];
    active(sid).forEach(ep => { const st = status(ep);
      st.overdue.forEach(r => out.push({ep, r, state:'overdue'}));
      st.rows.filter(r => !r.done && !r.late && r.d <= w.end).forEach(r => out.push({ep, r, state: r.d <= Date.now() + 15*MIN ? 'due' : 'later'})); });
    return out;
  }
  function outOfRange(v, L, neuro){
    const o = [];
    if (v.sbp != null && (v.sbp < L.sbpLo || v.sbp > L.sbpHi)) o.push('Blood pressure '+v.sbp+(v.dbp?'/'+v.dbp:''));
    if (v.hr != null && (v.hr < L.hrLo || v.hr > L.hrHi)) o.push('Pulse '+v.hr);
    if (v.rr != null && (v.rr < L.rrLo || v.rr > L.rrHi)) o.push('Breathing '+v.rr);
    if (v.temp != null && v.temp >= L.temp) o.push('Temperature '+v.temp);
    if (v.spo2 != null && v.spo2 < L.spo2) o.push('Oxygen '+v.spo2+'%');
    if (v.pain != null && v.pain >= 7) o.push('Pain '+v.pain+' of 10');
    if (neuro){ ['alert','pupils','grip','speech'].forEach(k => { if (v[k]==='No') o.push(NEURO[k]+': no'); }); ['headache','vomit'].forEach(k => { if (v[k]==='Yes') o.push(NEURO[k]+': yes'); }); }
    return o;
  }
  const NEURO = {alert:'Awake and knows where they are (as usual for them)', pupils:'Pupils equal and react to light', grip:'Hand grips equal', speech:'Speech normal for them', headache:'New or worse headache', vomit:'Vomiting'};

  // ---------- view ----------
  R.monitor = v => {
    const m = cfg(); const sid = S().site;
    v.append(head('Follow-up checks · '+site().name, 'After a fall, head bump or medication problem', 'Checks are scheduled for you, shift by shift, so nothing is missed at shift change. A nurse or doctor\'s order always comes first.'));
    const tabs = h('div',{class:'tabs',role:'tablist'}); const body = h('div',{class:'grid'});
    const TABS = [['now','Due this shift'],['start','Start checks'],['all','All episodes']].concat(isNurse() ? [['defaults','House defaults']] : []);
    const p = C.param ? C.param() : ''; let cur = TABS.some(t => t[0]===p) ? p : 'now';
    TABS.forEach(([id,lab]) => tabs.append(h('button',{role:'tab',type:'button','aria-selected':String(cur===id),onclick:()=>{ cur = id; tabs.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-selected',String(TABS[i][0]===id))); draw(); }},lab)));
    v.append(tabs, body);
    function draw(){ body.textContent=''; ({now, start, all, defaults})[cur](); }

    function now(){
      const list = dueThisShift(sid);
      suggestions(body);
      if (!list.length){ body.append(card('calm', h('p',null,'No follow-up checks due this shift.'))); return; }
      list.forEach(({ep, r, state}) => body.append(checkCard(ep, r, state, draw)));
    }
    function start(){
      const rs = residents();
      const res = h('select',{'aria-label':'Resident'}, rs.map(r => h('option',{value:r.code},r.code+' '+r.nick)));
      const kind = h('select',{'aria-label':'What happened'}, Object.entries(m.protocols).map(([k,p]) => h('option',{value:k},p.name)));
      const when = h('input',{type:'datetime-local','aria-label':'When it happened',value:new Date(Date.now() - new Date().getTimezoneOffset()*MIN).toISOString().slice(0,16)});
      const note = h('input',{type:'text',maxlength:'300','aria-label':'What happened, in a sentence',placeholder:'Facts only: where, what you saw'});
      const first = h('div',{class:'house gap'});
      const showFirst = () => { first.textContent=''; first.append(h('b',null,'Right now'), h('span',{class:'small'}, m.protocols[kind.value].first)); };
      kind.addEventListener('change', showFirst); showFirst();
      body.append(card('', h('h2',null,'Start follow-up checks'), h('div',{class:'grid g2'}, h('label',{class:'f'},'Resident',res), h('label',{class:'f'},'What happened',kind), h('label',{class:'f'},'When',when), h('label',{class:'f'},'In a sentence',note)), first,
        h('div',{class:'row'}, h('button',{type:'button',class:'btn',onclick:()=>{ startEpisode(res.value, kind.value, when.value ? new Date(when.value).getTime() : Date.now(), note.value.trim()); cur='now'; draw(); }},'Start the schedule'), h('a',{href:'#/report'},'Write the incident report')),
        h('p',{class:'small muted'},'Uses your home\'s defaults ('+m.protocols[kind.value].hours+' hours). The nurse can change it for this person after they are told.')));
    }
    function all(){
      const eps = cfg().episodes.filter(e => e.site===sid).sort((a,b)=>a.start<b.start?1:-1);
      if (!eps.length) body.append(card('', h('p',{class:'muted'},'No follow-up checks yet.')));
      eps.forEach(ep => body.append(episodeCard(ep, draw)));
    }
    function defaults(){
      const L = m.limits;
      const num = (obj, k, lbl, step) => { const i = h('input',{type:'number',step:step||'1',value:String(obj[k])}); i.addEventListener('change',()=>{ obj[k] = +i.value; save(); }); return h('label',{class:'f'},lbl,i); };
      body.append(card('warn', h('p',{class:'small'},h('b',null,'House defaults. '),'These are starting points so checks happen even before the nurse is reached. Set them with your nurse. A nurse or prescriber\'s order for a resident replaces them for that person.')));
      body.append(card('', h('h2',null,'Call the nurse when a reading is outside'), h('div',{class:'grid g4'},
        num(L,'sbpLo','Top BP under'), num(L,'sbpHi','Top BP over'), num(L,'hrLo','Pulse under'), num(L,'hrHi','Pulse over'), num(L,'rrLo','Breaths under'), num(L,'rrHi','Breaths over'), num(L,'temp','Temp at or over (°F)','0.1'), num(L,'spo2','Oxygen under (%)'))));
      Object.entries(m.protocols).forEach(([k,p]) => {
        const steps = h('input',{type:'text',value:p.steps.map(s => s[1]+'x every '+s[0]+' min').join(', '),'aria-label':'Early checks for '+p.name});
        steps.addEventListener('change',()=>{ const parsed = steps.value.split(',').map(x => x.match(/(\d+)\s*x\s*every\s*(\d+)/i)).filter(Boolean).map(mm => [+mm[2], +mm[1]]); p.steps = parsed; save(); toast('Saved'); });
        body.append(card('', h('h3',null,p.name), h('div',{class:'grid g2'}, num(p,'hours','How many hours'), h('label',{class:'f'},'Early checks (e.g. "4x every 15 min, 2x every 30 min")',steps)),
          h('p',{class:'small muted'},(p.shift?'Then one check each shift until the window ends. ':'')+(p.neuro?'Includes neuro checks.':''))));
      });
    }
    draw();
  };

  function startEpisode(res, kind, startMs, note, reportId){
    const m = cfg(); const p = m.protocols[kind];
    const ep = {id:uid(), site:S().site, res, kind, start:new Date(startMs).toISOString(), by:tier().name+' (you)', due:build(startMs, p), checks:[], order:null, ended:null, note, reportId:reportId||null};
    m.episodes.push(ep); save(); toast('Checks scheduled: '+ep.due.length+' over '+p.hours+' hours. Tell the nurse.');
    return ep;
  }
  function suggestions(out){
    // incident reports from the last day that look like a fall, head bump or medication error, with no schedule yet
    const m = cfg(); const since = new Date(Date.now() - 24*HOUR).toISOString();
    const rs = (S().reports||[]).filter(r => r.site===S().site && r.at >= since && /fall|head|med|medication|wrong/i.test((r.type||'')+' '+(r.raw||'')) && !m.episodes.some(e => e.reportId===r.id));
    rs.forEach(r => { const kind = /head|hit|bump/i.test(r.raw||'') ? 'head' : /med|pill|dose/i.test((r.type||'')+(r.raw||'')) ? 'med' : 'fall';
      out.append(card('warn', h('b',null,'Report filed '+fmtTime(r.at)+(r.resident?' for '+r.resident:'')+': '+(r.type||'Incident')), h('p',{class:'small'},'Start '+m.protocols[kind].name.toLowerCase()+' checks?'),
        h('div',{class:'row'}, h('button',{type:'button',class:'btn sm',onclick:()=>{ startEpisode(r.resident || residents()[0].code, kind, new Date(r.at).getTime(), (r.clean||r.raw||'').slice(0,200), r.id); A.route(); }},'Start checks'),
          h('button',{type:'button',class:'btn quiet sm',onclick:()=>{ m.episodes.push({id:uid(), site:S().site, res:r.resident||'', kind, start:r.at, by:tier().name+' (you)', due:[], checks:[], ended:new Date().toISOString(), reportId:r.id, note:'Not needed (decided by '+tier().name+')'}); save(); A.route(); }},'Not needed')))); });
  }
  function nurseLine(code){ try { const f = window.SSFace && SSFace.face(code); const n = f && (f.team||[]).find(x => /nurse|RN/i.test(x.role+' '+(x.specialty||''))); if (n) return h('a',{class:'btn ghost sm',href:'tel:+1'+n.phone.replace(/\D/g,'')},'📞 Call '+n.name); } catch(e){} return h('a',{href:'#/night'},'Who to call (Night help)'); }

  function checkCard(ep, r, state, redraw){
    const p = cfg().protocols[ep.kind]; const L = limitsFor(ep);
    const box = card(state==='overdue' ? 'alert' : state==='due' ? 'warn' : '',
      h('div',{class:'meta'}, chip(ep.res), chip(state==='overdue'?'Overdue':state==='due'?'Due now':'Later this shift', state==='overdue'?'red':state==='due'?'amber':'grey'), h('span',null,'Check '+(r.i+1)+' of '+ep.due.length+' · '+fmtTime(new Date(r.d).toISOString()))),
      h('b',null,p.name), ep.order ? h('p',{class:'small'},h('b',null,'Order: '),ep.order.note+' ('+ep.order.by+')') : h('p',{class:'small'},'House default schedule'));
    if (state === 'later') return box;
    const v = {};
    const num = (k, lbl, step) => { const i = h('input',{type:'number',step:step||'1',inputmode:'decimal','aria-label':lbl}); i.addEventListener('input',()=>v[k] = i.value===''?null:+i.value); return h('label',{class:'f'},lbl,i); };
    const form = h('div',{class:'grid'}, h('div',{class:'grid g4'}, num('sbp','BP top'), num('dbp','BP bottom'), num('hr','Pulse'), num('rr','Breaths a minute'), num('temp','Temp °F','0.1'), num('spo2','Oxygen %'), num('pain','Pain 0 to 10')));
    if (p.neuro) Object.entries(NEURO).forEach(([k,lbl]) => form.append(h('div',{class:'f2'}, h('span',{class:'flab'},lbl), (() => { const w = h('div',{class:'pick',role:'group','aria-label':lbl}); ['Yes','No'].forEach(o => { const b = h('button',{type:'button','aria-pressed':'false',onclick:()=>{ w.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed','false')); b.setAttribute('aria-pressed','true'); v[k] = o; }},o); w.append(b); }); return w; })())));
    const note = h('input',{type:'text',maxlength:'300','aria-label':'Anything else you noticed',placeholder:'Anything else you noticed'});
    form.append(h('label',{class:'f'},'Notes',note));
    const result = h('div');
    form.append(result, h('div',{class:'row'}, h('button',{type:'button',class:'btn sm',onclick:()=>{
      if (v.sbp == null && v.hr == null && !p.neuro) return toast('Enter at least blood pressure or pulse');
      if (p.neuro && Object.keys(NEURO).some(k => !v[k])) return toast('Answer each neuro check');
      const out = outOfRange(v, L, p.neuro);
      ep.checks.push({slot:r.i, at:new Date().toISOString(), by:(window.SSSched && SSSched.me ? SSSched.me() : tier().name+' (you)'), vals:Object.assign({note:note.value.trim()}, v), out});
      save();
      if (out.length){ result.textContent=''; result.append(h('div',{class:'card alert',style:'box-shadow:none'}, h('b',null,'Call the nurse now: '+out.join(', ')), h('p',{class:'small'},'Call 911 for trouble breathing, a seizure, can\'t wake them, or a sudden change in alertness.'), nurseLine(ep.res))); toast('Outside the limits. Call the nurse.'); }
      else { toast('Check saved'); redraw(); }
    }},'Save check'), h('button',{type:'button',class:'btn quiet sm',onclick:()=>{ ep.checks.push({slot:r.i, at:new Date().toISOString(), by:tier().name+' (you)', vals:{refused:true, note:note.value.trim()}, out:['Refused']}); save(); toast('Logged as refused (resident choice). Tell the nurse.'); redraw(); }},'Resident refused')));
    box.append(form);
    return box;
  }
  function episodeCard(ep, redraw){
    const st = status(ep); const p = cfg().protocols[ep.kind] || {name:ep.kind}; const done = ep.checks.length;
    const det = h('details',{class:'card'}, h('summary',null, h('span',{class:'meta'}, chip(ep.res), chip(st.open ? (st.overdue.length ? st.overdue.length+' overdue' : 'Active') : 'Ended', st.open ? (st.overdue.length?'red':'amber') : 'calm'), h('span',null,p.name+' · '+fmtTime(ep.start)))));
    det.append(h('p',{class:'small'},(ep.note||'')+(ep.reportId?' · linked to an incident report':'')), h('p',{class:'small'},done+' of '+ep.due.length+' checks done · ends '+fmtTime(new Date(st.ends).toISOString())));
    if (ep.order) det.append(h('p',{class:'small'},h('b',null,'Order: '),ep.order.note+' · '+ep.order.by+' '+fmtDate(ep.order.at)));
    const out = ep.checks.filter(c => c.out && c.out.length);
    if (out.length) det.append(h('div',{class:'house gap'}, h('b',null,'Readings outside the limits'), out.map(c => h('span',{class:'small'},fmtTime(c.at)+': '+c.out.join(', ')))));
    const tb = h('table',{class:'t'}, h('caption',{class:'sr'},'Checks'), h('thead',null,h('tr',null,['Due','Done','BP','Pulse','Temp','O2','By'].map(x => h('th',{scope:'col'},x)))));
    const tbody = h('tbody'); st.rows.forEach(r => { const c = ep.checks.find(x => x.slot===r.i); tbody.append(h('tr',null, h('td',null,fmtTime(new Date(r.d).toISOString())), h('td',null,c ? fmtTime(c.at) : r.late ? 'Missed' : '–'), h('td',null,c&&c.vals.sbp?c.vals.sbp+'/'+(c.vals.dbp||''):''), h('td',null,c&&c.vals.hr||''), h('td',null,c&&c.vals.temp||''), h('td',null,c&&c.vals.spo2||''), h('td',null,c?c.by:''))); });
    tb.append(tbody); det.append(h('div',{class:'tablewrap',tabindex:'0',role:'region','aria-label':'Scrollable table'},tb));
    if (isNurse() && st.open){
      const on = h('input',{type:'text',maxlength:'300','aria-label':'Nurse or prescriber order',placeholder:'e.g. Vitals every 4 hours for 48 hours, then stop'});
      const hrs = h('input',{type:'number',min:'0',max:'336',value:String(p.hours),'aria-label':'Total hours'});
      const gap = h('input',{type:'number',min:'0',placeholder:'Hours between checks (blank = each shift)','aria-label':'Hours between checks'});
      det.append(h('h3',null,'Nurse or prescriber order'), h('div',{class:'grid g3'}, on, h('label',{class:'f'},'Total hours',hrs), h('label',{class:'f'},'Hours between checks',gap)),
        h('div',{class:'row'}, h('button',{type:'button',class:'btn ghost sm',onclick:()=>{ if (!on.value.trim()) return toast('Type the order'); const start = new Date(ep.start).getTime(); const H = +hrs.value||p.hours;
          const done = new Set(ep.checks.map(c => c.slot)); const keepTimes = ep.due.filter((d,i) => done.has(i));
          let next; if (+gap.value > 0){ next = []; for (let t = Date.now() + (+gap.value)*HOUR; t <= start + H*HOUR; t += (+gap.value)*HOUR) next.push(t); } else next = build(Date.now(), {steps:[], shift:true, hours:Math.max(0,(start + H*HOUR - Date.now())/HOUR)});
          const oldChecks = ep.checks.map(c => Object.assign({}, c, {slot:keepTimes.indexOf(ep.due[c.slot])}));
          ep.due = keepTimes.concat(next); ep.checks = oldChecks; ep.order = {by:tier().name+' (you)', note:on.value.trim(), at:new Date().toISOString()}; cfg().protocols[ep.kind] && (ep.hoursOverride = H);
          save(); toast('Order applied to '+ep.res+'\'s schedule'); redraw(); }},'Apply order'),
          h('button',{type:'button',class:'btn quiet sm',onclick:()=>{ ep.ended = new Date().toISOString(); ep.endedBy = tier().name+' (you)'; save(); redraw(); }},'End monitoring early')));
    }
    return det;
  }

  // ---------- register and connect ----------
  VIEWS.monitor = {t:'Follow-up checks', ic:'🩺'};
  const addNav = (t, after) => { const n = NAV[t]; if (!n || n.includes('monitor')) return; const at = n.indexOf(after) >= 0 ? n.indexOf(after)+1 : n.length; n.splice(at, 0, 'monitor'); };
  addNav('caregiver','shift'); addNav('manager','shift'); addNav('rn','home');
  if (window.SSAccess && SSAccess.register) try { SSAccess.register({id:'monitor', name:'Follow-up checks', ic:'🩺', what:'Vitals and neuro checks after a fall, head bump, medication error, new medication or change in condition, scheduled by shift.', views:['monitor'], tiers:['caregiver','manager','rn','owner']}); } catch(e){}
  const viewOn = () => { try { return !window.SSAccess || !SSAccess.viewOn || SSAccess.viewOn('monitor'); } catch(e){ return true; } };
  (A.homeHooks = A.homeHooks || []).push((v, t) => {
    if (S().site === 'family' || !viewOn() || !['caregiver','manager','rn'].includes(t)) return;
    const d = dueThisShift(); if (!d.length) return;
    const od = d.filter(x => x.state==='overdue').length, now = d.filter(x => x.state==='due').length;
    const tl = A.tile('monitor','🩺', od ? od+' follow-up check'+(od===1?'':'s')+' overdue' : now ? now+' follow-up check'+(now===1?'':'s')+' due now' : d.length+' follow-up check'+(d.length===1?'':'s')+' this shift', [...new Set(d.map(x => x.ep.res))].join(', ')+' · vitals'+(d.some(x => cfg().protocols[x.ep.kind].neuro)?' and neuro':'')+' checks', od||now ? 'urgent' : '');
    const anchor = v.querySelector('.head'); if (anchor && anchor.nextSibling) v.insertBefore(tl, anchor.nextSibling); else v.append(tl);
  });
  window.SSMonitor = {
    // for the shift change report and the house tablet
    pending: sid => dueThisShift(sid).filter(x => x.state !== 'later').map(x => ({res:x.ep.res, state:x.state, text:(x.state==='overdue'?'Overdue: ':'Due: ')+cfg().protocols[x.ep.kind].name.toLowerCase()+' check '+(x.r.i+1)+' of '+x.ep.due.length+' ('+fmtTime(new Date(x.r.d).toISOString())+')'})),
    active: sid => active(sid).map(ep => ({res:ep.res, kind:cfg().protocols[ep.kind].name, ends:new Date(status(ep).ends).toISOString(), left:status(ep).rows.filter(r => !r.done).length}))
  };
})();
