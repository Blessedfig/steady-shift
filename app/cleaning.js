// Steady Shift test app: shift cleaning and housekeeping checklist.
// A starter checklist built from Wisconsin rules and common standards (CDC environmental infection control, FDA Food Code,
// OSHA bloodborne pathogens, fire safety), per-home templates managers edit, tasks by shift and frequency, reminders and an
// end-of-shift warning, questions to the manager, and history for surveys. Photos are off by default: they turn on only when a
// manager sets time-limited photo proof for one caregiver (noted in the HR file), or when someone reports a job that wasn't done
// and attaches a photo as evidence. Rooms and equipment only, never residents; in-app camera; kept in memory in this test version.
// Sample data only.
(function(){
  const A = window.SSApp, C = window.SSCare;
  if (!A || !C) return;
  const {h, save, toast, head, R, VIEWS, NAV, uid, fmtDate, fmtTime, site, tier} = A;
  const S = () => A.state();
  const {chip, card, helpBox, today, addDays} = C;
  const isMgr = () => ['manager','owner','multi','rn'].includes(S().tier);
  const CHECKED = '2026-11-27';

  // ---------- sources ("where to check or ask") ----------
  const SRC = {
    dhs88:{t:'DHS 88, adult family homes (state rule text)', u:'https://docs.legis.wisconsin.gov/code/admin_code/dhs/030/88'},
    dhs83:{t:'DHS 83, CBRFs (state rule text)', u:'https://docs.legis.wisconsin.gov/code/admin_code/dhs/030/83'},
    cdc:{t:'CDC Environmental Infection Control Guidelines', u:'https://www.cdc.gov/infection-control/hcp/environmental-control/index.html'},
    epa:{t:'EPA list of registered disinfectants', u:'https://www.epa.gov/pesticide-registration/selected-epa-registered-disinfectants'},
    food:{t:'FDA Food Code', u:'https://www.fda.gov/food/retail-food-protection/fda-food-code'},
    osha:{t:'OSHA bloodborne pathogens and needlestick prevention', u:'https://www.osha.gov/bloodborne-pathogens'},
    lhd:{t:'Find your local health department (Wisconsin DHS)', u:'https://www.dhs.wisconsin.gov/lh-depts/index.htm'}
  };

  // ---------- starter checklist ----------
  // freq: shift (every shift), daily, weekly, monthly. shift: Any, Day, Night (who usually does it).
  const T = (area, text, freq, shift, why, src, opts) => Object.assign({area, text, freq, shift, why, src}, opts||{});
  const STARTER = [
    T('Hand hygiene and supplies','Soap, paper towels and hand sanitizer stocked at every sink and by the door','shift','Any','Hand hygiene is the first step in every infection-control standard.','cdc'),
    T('Hand hygiene and supplies','Gloves, gowns and masks stocked where care happens','shift','Any','Standard precautions need gear at hand.','cdc'),
    T('Kitchen and food','Wipe and sanitize counters, table and cutting boards after each meal','shift','Any','Food contact surfaces are cleaned and sanitized after use. AFHs must prepare and store food in a sanitary way.','food',{cite:'DHS 88.07(4)(c); FDA Food Code'}),
    T('Kitchen and food','Check fridge is 41°F or below and freezer 0°F or below; write the temps','daily','Day','Cold holding at 41°F or below slows bacteria.','food',{cite:'FDA Food Code'}),
    T('Kitchen and food','Label and date leftovers; throw out anything older than 7 days','daily','Night','Ready-to-eat food kept cold is used within 7 days.','food',{cite:'FDA Food Code'}),
    T('Kitchen and food','Run the dishwasher or wash, rinse and sanitize dishes; empty the sink','shift','Any','Clean dishes and an empty sink keep pests and germs down.','food'),
    T('Kitchen and food','Clean inside the microwave and wipe fridge shelves','weekly','Day','Spills feed bacteria and smells.','food'),
    T('Kitchen and food','Clean the fridge out fully and wipe the gaskets','monthly','Day','Deep clean catches what weekly wipes miss.','food'),
    T('Bathrooms','Clean and disinfect toilets, sinks, faucets and grab bars','daily','Day','Daily cleaning of bathroom surfaces with a registered disinfectant, left wet for its contact time.','epa',{cite:'CDC environmental guidelines; EPA label contact time'}),
    T('Bathrooms','Wipe shower chair, tub bench and hand-held shower after each use','shift','Any','Shared bathing equipment is cleaned between residents.','cdc'),
    T('Bathrooms','Empty bathroom trash and restock toilet paper','shift','Any','','cdc'),
    T('High-touch surfaces','Disinfect door handles, light switches, railings, remotes and phones','daily','Night','High-touch surfaces carry the most germs and get cleaned at least daily.','cdc'),
    T('High-touch surfaces','Wipe walkers, wheelchairs and lift handles','daily','Night','Shared or hand-held equipment is cleaned regularly and between residents.','cdc'),
    T('Resident rooms','Make beds; change linens if wet or soiled','shift','Day','','cdc'),
    T('Resident rooms','Change all bed linens (weekly, or sooner if soiled)','weekly','Day','A set weekly change, plus right away when soiled.','cdc'),
    T('Resident rooms','Dust, empty trash and tidy each room, respecting the resident\'s things','daily','Day','A clean, homelike room. Ask before moving belongings.','dhs88',{cite:'DHS 88.05 (environment); resident rights'}),
    T('Resident rooms','Clean under beds, behind furniture and wipe window sills','monthly','Day','','cdc'),
    T('Laundry','Bag soiled linens where they are used; do not shake them; wear gloves','shift','Any','Handle soiled laundry with minimal agitation and gloves.','cdc'),
    T('Laundry','Wash, dry and put away resident laundry; keep each person\'s clothes separate','daily','Day','','cdc'),
    T('Laundry','Clean the dryer lint trap','shift','Any','Lint is a common cause of dryer fires.','dhs88'),
    T('Floors and common areas','Sweep and mop the kitchen and bathroom floors','daily','Night','','cdc'),
    T('Floors and common areas','Vacuum common areas; pick up anything someone could trip on','daily','Day','Clear floors prevent falls.','dhs88',{cite:'DHS 88.05 (safety)'}),
    T('Sharps and biohazard','Check the sharps container: closed lid, not over 3/4 full, out of reach','shift','Any','Sharps go in a closable, puncture-resistant container, replaced before it is full. Never recap needles.','osha'),
    T('Sharps and biohazard','Clean up any blood or body fluid spill right away with gloves and disinfectant','shift','Any','Spills are contained, cleaned, then disinfected.','osha',{always:true}),
    T('Sharps and biohazard','Empty and wipe the soiled-brief trash; tie bags and take them out','shift','Any','','cdc'),
    T('Fire and safety','Walk the exits: doors unlocked from inside, nothing blocking halls or exits','shift','Any','Exits and paths must stay clear for evacuation.','dhs88',{cite:'DHS 88.05; DHS 83 fire safety'}),
    T('Fire and safety','Check fire extinguisher gauge is in the green and the pin is in','monthly','Day','Monthly visual check of extinguishers is common practice (NFPA 10).','dhs88'),
    T('Fire and safety','Test smoke and carbon monoxide alarms','monthly','Day','Test monthly with the test button and replace batteries as needed.','dhs88'),
    T('Fire and safety','Chemicals and cleaners locked up or out of reach of residents who need it','shift','Any','Cleaning products are stored safely, away from food.','dhs88'),
    T('Outside','Check walkways and steps for ice, snow or clutter','shift','Day','Seasonal. Turn off in summer.','dhs88')
  ];

  // ---------- state ----------
  function st(){
    const s = S();
    if (!s.clean || s.clean.v !== 1){
      s.clean = {v:1, tpl:{}, done:{}, hist:[], questions:[], reminders:{}};
      ['maple','birch','cedar'].forEach(sid => {
        s.clean.tpl[sid] = {v:1, at:'2026-11-27T09:00:00', by:'Steady Shift starter', items:STARTER.map((x,i) => Object.assign({id:'k'+i, on:true, who:'', photo:false}, x))};
        s.clean.done[sid] = [];
      });
      seedHistory(s.clean);
      save();
    }
    const c = s.clean;
    if (c.photoRule !== 2){   // photos are no longer a per-job default
      Object.values(c.tpl).forEach(t => t.items.forEach(x => x.photo = false));
      c.proof = c.proof || []; c.notDone = c.notDone || []; c.photoRule = 2; save();
    }
    return c;
  }
  function tpl(){ const c = st(); const sid = S().site; if (!c.tpl[sid]) { c.tpl[sid] = {v:1, at:new Date().toISOString(), by:'Steady Shift starter', items:STARTER.map((x,i) => Object.assign({id:'k'+i, on:true, who:'', photo:false}, x))}; c.done[sid] = []; save(); } return c.tpl[sid]; }
  const monday = d => { const x = new Date(d+'T12:00:00'); x.setDate(x.getDate() - ((x.getDay()+6)%7)); return x.toISOString().slice(0,10); };
  function periodKey(freq, sh){ const t = today(); sh = sh || C.shiftNow(); return freq==='shift' ? sh.key : freq==='daily' ? t : freq==='weekly' ? 'wk '+monday(t) : t.slice(0,7); }
  const FREQ = {shift:'Every shift', daily:'Daily', weekly:'Weekly', monthly:'Monthly'};
  function seedHistory(c){
    // two weeks of sample completions so the history view has something to show
    const names = sid => ((S().staff||{})[sid]||[]).map(x => x.n);
    ['maple','birch','cedar'].forEach(sid => {
      const nm = names(sid); const items = c.tpl[sid].items;
      for (let i = 14; i >= 1; i--){
        const d = addDays(today(), -i);
        ['Day','Night'].forEach(shName => {
          const cur = C.shiftNow().key;
          items.filter(x => !x.always && (x.freq==='shift' || (x.freq==='daily' && x.shift===shName))).forEach(x => {
            const period = x.freq==='shift' ? d+' '+shName : d;
            if (period === cur || period === today()) return;   // leave the current shift for people to do
            if (Math.random() < (sid==='cedar' && i < 5 ? 0.7 : 0.93)) c.done[sid].push({task:x.id, period, at:d+'T'+(shName==='Day'?'14':'02')+':'+String(10+Math.floor(Math.random()*40))+':00', by:nm[Math.floor(Math.random()*nm.length)]||'Caregiver', photos:0});
          });
        });
      }
    });
  }

  function doneFor(item){ const c = st(); const k = periodKey(item.freq); return c.done[S().site].find(d => d.task===item.id && d.period===k); }
  function dueNow(){
    const sh = C.shiftNow();
    return tpl().items.filter(x => x.on && (x.freq!=='shift' && x.freq!=='daily' ? true : x.shift==='Any' || x.shift===sh.name || x.freq==='shift'));
  }
  function openTasks(sid){
    if (sid && sid !== S().site) return [];
    const sh = C.shiftNow();
    // the end-of-shift warning covers every-shift tasks and daily tasks owned by this shift
    return dueNow().filter(x => (x.freq==='shift' || (x.freq==='daily' && (x.shift===sh.name || x.shift==='Any'))) && !x.always && !doneFor(x));
  }
  function minsLeft(){ const sh = C.shiftNow(); const [a,b] = (sh.end||'18:00').split(':').map(Number); const now = new Date(); let d = a*60+(b||0) - (now.getHours()*60+now.getMinutes()); if (d < -60) d += 1440; return d; }
  function me(){ try { if (window.SSSched && SSSched.me) return SSSched.me(); } catch(e){} return tier().name+' (you)'; }

  // ---------- photo proof (manager, one caregiver, time-limited) and "wasn't done" reports ----------
  function proofFor(name, sid){ sid = sid || S().site; return st().proof.find(p => p.site===sid && p.who===name && !p.ended && p.until >= today()); }
  function hrNote(who, text){
    // writes a dated, factual note into the employee's HR file (if the HR module is in use)
    try { const hr = S().hr; if (hr && hr.notes) hr.notes.unshift({id:uid(), site:S().site, who, kind:'Follow-up', text, by:tier().name+' (you)', at:new Date().toISOString()}); } catch(e){}
  }
  function prevShiftKey(){ const k = C.shiftNow().key; const [d, n] = [k.slice(0,10), k.slice(11)]; return n==='Night' ? d+' Day' : addDays(d,-1)+' Night'; }
  const shiftLabel = k => fmtDate(k.slice(0,10))+' '+k.slice(11).toLowerCase()+' shift';
  const ND_MEM = {};  // report id -> [objectURL], memory only

  // ---------- photos: in-app camera, kept in memory only ----------
  const MEM = {};  // taskId -> [objectURL]
  function camera(onShot){
    const box = h('div',{class:'card soft',role:'region','aria-label':'Take a photo of the room or equipment'});
    const video = h('video',{autoplay:true, playsinline:true, muted:true, disablepictureinpicture:true, 'aria-label':'Camera preview', style:'width:100%;max-height:50vh;border-radius:12px;background:#000'});
    const status = h('p',{class:'small',role:'status'},'Starting the camera…');
    let stream = null;
    const stop = () => { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; box.remove(); };
    box.append(h('p',{class:'small'},h('b',null,'Photograph the room or equipment only. '),'No residents, faces or paperwork in the picture.'), video, status,
      h('div',{class:'row'}, h('button',{type:'button',class:'btn sm',onclick:()=>{ if (!video.videoWidth) return; const cv = document.createElement('canvas'); const sc = Math.min(1, 1280/video.videoWidth); cv.width = Math.round(video.videoWidth*sc); cv.height = Math.round(video.videoHeight*sc); cv.getContext('2d').drawImage(video,0,0,cv.width,cv.height); cv.toBlob(b => { onShot(URL.createObjectURL(b)); stop(); }, 'image/jpeg', .8); }},'Take photo'),
        h('button',{type:'button',class:'btn quiet sm',onclick:stop},'Cancel')));
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
      navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}, audio:false}).then(s => { stream = s; video.srcObject = s; status.textContent = 'Point at the room or equipment and tap Take photo.'; }).catch(() => { status.textContent = 'The camera is blocked or not available. Allow the camera for this app, or tell your manager. Photos from the camera roll are not accepted, so the time stays trustworthy.'; video.hidden = true; });
    } else { status.textContent = 'This browser has no in-app camera. Use the house tablet or tell your manager.'; video.hidden = true; }
    return box;
  }
  window.addEventListener('hashchange', () => { if (!/^#\/clean/.test(location.hash)) Object.keys(MEM).forEach(k => { MEM[k].forEach(u => URL.revokeObjectURL(u)); delete MEM[k]; }); });

  // ---------- view ----------
  R.clean = v => {
    st();
    const sh = C.shiftNow();
    v.append(head('Housekeeping · '+site().name, 'Shift cleaning checklist', 'Tap each job as you finish it. Every-shift jobs and this shift\'s daily jobs are on the end-of-shift reminder.'));
    const tabs = h('div',{class:'tabs',role:'tablist'}); const body = h('div',{class:'grid'});
    const TABS = [['now','This shift'],['history','History'],['ask','Where to check or ask']].concat(isMgr() ? [['edit','Edit checklist']] : []);
    const p = C.param ? C.param() : '';
    let cur = TABS.some(t => t[0]===p) ? p : 'now';
    TABS.forEach(([id,lab]) => tabs.append(h('button',{role:'tab',type:'button','aria-selected':String(cur===id),onclick:()=>{ cur = id; tabs.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-selected',String(TABS[i][0]===id))); draw(); }},lab)));
    v.append(tabs, body);
    function draw(){ body.textContent=''; ({now, history, ask, edit})[cur](); }

    function now(){
      const left = minsLeft(); const open = openTasks();
      const items = dueNow();
      const counted = items.filter(x => !x.always);
      const doneN = counted.filter(x => doneFor(x)).length;
      body.append(card(left <= 60 && left >= -60 && open.length ? 'warn' : 'soft',
        h('div',{class:'meta'}, chip(sh.name+' shift · '+sh.label), chip(doneN+' of '+counted.length+' done', doneN===counted.length?'calm':'grey')),
        h('div',{class:'bar calm'},h('i',{style:'width:'+(counted.length?Math.round(doneN/counted.length*100):0)+'%'})),
        left <= 60 && left >= -60 && open.length ? h('p',null,h('b',null,'Shift ends '+(left>0?'in '+left+' minutes':'now')+'. '+open.length+' cleaning job'+(open.length===1?' is':'s are')+' not done. '),'Finish them, or they go on the ',h('a',{href:'#/shift/give'},'shift change report'),' for the next shift. No one is blamed.') : null));
      const mine = me();
      const proof = proofFor(mine);
      if (proof) body.append(card('warn', h('p',null,h('b',null,'Photo proof is on for you until '+fmtDate(proof.until)+'. '),'Take a photo of the room or equipment before you check off each job. Your manager set this up and it is noted in your employee file. Ask your manager if you have questions.')));
      const groups = {};
      items.forEach(x => { const g = x.freq==='weekly' ? 'This week' : x.freq==='monthly' ? 'This month' : x.area; (groups[g] = groups[g] || []).push(x); });
      const order = Object.keys(groups).sort((a,b) => (/^This /.test(a)?1:0) - (/^This /.test(b)?1:0));
      order.forEach(g => {
        const list = h('ul',{class:'tourlist tasks'});
        groups[g].forEach(x => {
          const d = doneFor(x);
          const id = 'cl-'+x.id;
          const cb = h('input',{type:'checkbox',id,checked:!!d});
          const lab = h('label',{for:id,class:d?'done':''}, x.text);
          const meta = h('span',{class:'small muted'}, ' · '+(x.always?'As needed':FREQ[x.freq])+(x.who?' · '+x.who+(x.who===mine?' (you)':''):'')+(d?' · done by '+d.by+' '+fmtTime(d.at)+(d.photos?' · '+d.photos+' photo'+(d.photos===1?'':'s'):''):'')+(proof&&!d?' · photo needed':''));
          const li = h('li',null, cb, h('div',{class:'grid',style:'gap:.2rem;flex:1'}, h('div',null,lab, meta), x.why ? h('details',{class:'small'},h('summary',null,'Why'),h('p',null,x.why+(x.cite?' ('+x.cite+')':'')), SRC[x.src] ? h('a',{href:SRC[x.src].u,target:'_blank',rel:'noopener'},SRC[x.src].t) : null) : null));
          const thumbs = h('div',{class:'row'});
          (MEM[x.id]||[]).forEach(u => thumbs.append(h('img',{src:u,alt:'Photo of the cleaned area',style:'width:72px;height:72px;object-fit:cover;border-radius:10px'})));
          const camBtn = h('button',{type:'button',class:'btn quiet sm',onclick:()=>{ li.append(camera(url => { (MEM[x.id] = MEM[x.id] || []).push(url); const dd = doneFor(x); if (dd){ dd.photos = (dd.photos||0)+1; save(); } toast('Photo added. It stays on this device until you leave this screen.'); draw(); })); }},'📷 Photo');
          if (proof && (!d || (MEM[x.id]||[]).length)) li.lastChild.append(h('div',{class:'row'}, d ? null : camBtn, thumbs));
          cb.addEventListener('change', () => {
            const c = st();
            if (cb.checked){
              if (proof && !(MEM[x.id]||[]).length){ cb.checked = false; toast('Photo proof is on. Tap 📷 Photo first.'); return; }
              c.done[S().site].push({task:x.id, period:periodKey(x.freq), at:new Date().toISOString(), by:mine, photos:(MEM[x.id]||[]).length});
            } else c.done[S().site] = c.done[S().site].filter(z => !(z.task===x.id && z.period===periodKey(x.freq)));
            save(); draw();
          });
          list.append(li);
        });
        body.append(card('', h('h2',null,g), list));
      });
      body.append(notDoneCard(items));
      body.append(helpBox('About photos', h('p',{class:'small'},'Photos are off for everyday checking. They are used only in two cases: your manager turns on photo proof for one person for a set time, or you report a job that was left undone and take a photo so it is a record, not hearsay. Photograph rooms and equipment only, never residents, faces or paperwork. In this test version a photo stays only on this device and only until you leave this screen. The record keeps that a photo was taken, when, and on which shift.')));
    }

    function notDoneCard(items){
      // any staff member: a job left undone by the shift before, with a photo as evidence
      const sel = h('select',{'aria-label':'Which job was not done'}, h('option',{value:''},'Pick the job'), items.filter(x => !x.always).map(x => h('option',{value:x.id},x.area+': '+x.text)), h('option',{value:'other'},'Something else'));
      const other = h('input',{type:'text',maxlength:'200',placeholder:'What was left undone (the room or task, not the person)','aria-label':'What was left undone',hidden:true});
      sel.addEventListener('change',()=>{ other.hidden = sel.value!=='other'; });
      const note = h('textarea',{maxlength:'500',placeholder:'What you found, e.g. "Sink full of dishes at 6:05 AM." Facts only.','aria-label':'What you found'});
      const shots = []; const thumbs = h('div',{class:'row'});
      const box = card('', h('h2',null,'Something wasn\'t done?'), h('p',{class:'small muted'},'Report a job the last shift left undone. A photo is required so the record is evidence, not hearsay. It is tied to the shift that handed over ('+shiftLabel(prevShiftKey())+') and to your shift. Describe the room or task, not the person.'),
        h('label',{class:'f'},'Job',sel), other, h('label',{class:'f'},'What you found',note), thumbs);
      const camBtn = h('button',{type:'button',class:'btn quiet sm',onclick:()=>{ box.append(camera(url => { shots.push(url); thumbs.append(h('img',{src:url,alt:'Photo of the area that was not done',style:'width:72px;height:72px;object-fit:cover;border-radius:10px'})); })); }},'📷 Take photo');
      const send = h('button',{type:'button',class:'btn sm',onclick:()=>{
        if (!sel.value) return toast('Pick the job');
        if (sel.value==='other' && !other.value.trim()) return toast('Say what was left undone');
        if (!shots.length) return toast('Take a photo first. It is the evidence.');
        const x = items.find(i => i.id===sel.value);
        const r = {id:uid(), site:S().site, task:x?x.id:'', text:x?x.text:other.value.trim(), note:note.value.trim(), at:new Date().toISOString(), by:me(), prevShift:prevShiftKey(), curShift:C.shiftNow().key, photos:shots.length, status:'new'};
        st().notDone.push(r); ND_MEM[r.id] = shots.slice(); save(); toast('Sent to the manager with the photo and time'); draw();
      }},'Send to manager');
      box.append(h('div',{class:'row'}, camBtn, send));
      return box;
    }

    function history(){
      const c = st(); const sid = S().site; const items = tpl().items.filter(x => x.on);
      const perShift = items.filter(x => x.freq==='shift').length;
      const days = []; for (let i = 13; i >= 0; i--) days.push(addDays(today(), -i));
      const rows = days.map(d => {
        const shiftDone = c.done[sid].filter(z => z.period===d+' Day' || z.period===d+' Night').length;
        const daily = items.filter(x => x.freq==='daily');
        const dailyDone = daily.filter(x => c.done[sid].some(z => z.task===x.id && z.period===d)).length;
        const need = perShift*2 + daily.length; const got = shiftDone + dailyDone;
        return {d, pct: need ? Math.min(100, Math.round(got/need*100)) : 100, got, need};
      });
      const avg = Math.round(rows.reduce((a,r)=>a+r.pct,0)/rows.length);
      body.append(card('', h('h2',null,'Last 14 days'), h('p',{class:'small muted'},'Share of each day\'s every-shift and daily jobs checked off. Weekly and monthly jobs are listed below.'),
        h('div',{class:'stat '+(avg>=90?'good':'warnc')},h('b',null,avg+'%'),h('span',null,'average completion')),
        h('div',{class:'list'}, rows.slice().reverse().map(r => h('div',{class:'item'}, h('div',{class:'meta'},h('span',null,fmtDate(r.d)),h('span',null,r.got+' of '+r.need)), h('div',{class:'bar '+(r.pct>=90?'calm':'amber')},h('i',{style:'width:'+r.pct+'%'})))))));
      const reps = c.notDone.filter(r => r.site===sid && (isMgr() || r.by===me())).slice().reverse();
      body.append(card('', h('h2',null,'Jobs reported not done'), h('p',{class:'small muted'},'Each report has a photo, a time, the shift that handed over and the shift that found it. Use it to coach, not to blame: talk privately with the shift first.'),
        reps.length ? h('div',{class:'list'}, reps.map(r => h('div',{class:'item'},
          h('div',{class:'meta'}, chip(r.status==='new'?'New':'Reviewed', r.status==='new'?'amber':'calm'), h('span',null,fmtDate(r.at)+' '+fmtTime(r.at)), chip('Left by the '+shiftLabel(r.prevShift),'grey'), chip(r.photos+' photo'+(r.photos===1?'':'s'),'grey')),
          h('b',null,r.text), r.note ? h('span',{class:'small'},r.note) : null, h('span',{class:'small muted'},'Reported by '+r.by+' on the '+shiftLabel(r.curShift)),
          (ND_MEM[r.id]||[]).length ? h('div',{class:'row'}, ND_MEM[r.id].map(u => h('img',{src:u,alt:'Evidence photo of the area',style:'width:72px;height:72px;object-fit:cover;border-radius:10px'}))) : null,
          isMgr() && r.status==='new' ? h('div',{class:'row'}, h('button',{type:'button',class:'btn ghost sm',onclick:()=>{ r.status='reviewed'; r.reviewedBy = tier().name+' (you)'; r.reviewedAt = new Date().toISOString(); save(); draw(); }},'Mark reviewed')) : null))) : h('p',{class:'small muted'},'None reported.')));
      const longer = items.filter(x => x.freq==='weekly' || x.freq==='monthly');
      body.append(card('', h('h2',null,'Weekly and monthly jobs'), h('div',{class:'list'}, longer.map(x => { const last = c.done[sid].filter(z => z.task===x.id).sort((a,b)=>a.at<b.at?1:-1)[0];
        return h('div',{class:'item'}, h('div',{class:'meta'},chip(FREQ[x.freq],'grey'), last ? chip('Last done '+fmtDate(last.at),'calm') : chip('Not done yet','amber')), h('span',null,x.text)); }))));
      body.append(h('div',{class:'row'}, h('button',{type:'button',class:'btn ghost sm',onclick:()=>{
        const csv = [['date and time','period','job','area','frequency','done by','photos taken']].concat(c.done[sid].slice().sort((a,b)=>a.at<b.at?-1:1).map(z => { const x = tpl().items.find(i => i.id===z.task) || {text:z.task, area:'', freq:''}; return [z.at, z.period, x.text, x.area, FREQ[x.freq]||'', z.by, z.photos||0]; }));
        A.download('cleaning-log-'+sid+'.csv','text/csv',csv.map(r => r.map(A.csvCell).join(',')).join('\n'));
      }},'Download cleaning log for a survey (.csv)'), h('span',{class:'small muted'},'Sample data. Staff names, no residents.')));
    }

    function ask(){
      const set = (A.setting ? A.setting() : 'afh');
      const links = [set==='cbrf' ? SRC.dhs83 : SRC.dhs88, SRC.cdc, SRC.epa, SRC.food, SRC.osha, SRC.lhd];
      body.append(card('', h('h2',null,'Where to check'), h('ul',null, links.map(l => h('li',null,h('a',{href:l.u,target:'_blank',rel:'noopener'},l.t)))),
        h('p',{class:'small'},'Your local health department answers questions about food safety, outbreaks (like a stomach bug going through the house), and how to clean up after one. Your licensing specialist at DQA answers questions about what the rule requires. Your disinfectant\'s label says how long the surface must stay wet to work.'),
        h('p',{class:'foot'},'Links checked '+fmtDate(CHECKED)+'. Not legal advice.')));
      const q = h('textarea',{maxlength:'500',placeholder:'e.g. What do we use to clean up after someone has the stomach flu?','aria-label':'Your question for the manager'});
      body.append(card('', h('h2',null,'Ask the manager'), h('p',{class:'small muted'},'Goes to the house manager without your name on the question log.'), q,
        h('div',{class:'row'}, h('button',{type:'button',class:'btn sm',onclick:()=>{ const t = q.value.trim(); if (!t) return toast('Type your question first'); const c = st();
          c.questions.push({id:uid(), site:S().site, q:t, at:new Date().toISOString(), shift:C.shiftNow().name, answer:''});
          (S().questions = S().questions || []).push({q:t, id:null, site:S().site, tier:S().tier, at:new Date().toISOString(), shift:C.shiftNow().name});
          save(); toast('Sent to the manager'); draw(); }},'Send question'))));
      const qs = st().questions.filter(x => x.site===S().site).slice().reverse();
      if (qs.length) body.append(card('', h('h2',null,'Cleaning questions'), h('div',{class:'list'}, qs.map(x => {
        const ans = h('input',{type:'text',maxlength:'500','aria-label':'Answer',placeholder:'Type the home\'s answer'});
        return h('div',{class:'item'}, h('div',{class:'meta'},h('span',null,fmtTime(x.at)),chip(x.answer?'Answered':'Waiting',x.answer?'calm':'amber')), h('b',null,x.q), x.answer ? h('span',{class:'small'},'Answer: '+x.answer) : null,
          !x.answer && isMgr() ? h('div',{class:'row'}, ans, h('button',{type:'button',class:'btn ghost sm',onclick:()=>{ if (!ans.value.trim()) return; x.answer = ans.value.trim(); save(); draw(); }},'Answer')) : null);
      }))));
    }

    function edit(){
      const t = tpl(); const work = JSON.parse(JSON.stringify(t.items));
      const names = C.staffNames(S().site);
      body.append(card('soft', h('p',{class:'small'},'This is your home\'s checklist (version '+t.v+', saved '+fmtDate(t.at)+' by '+t.by+'). It started from the Steady Shift starter list. Change the wording, how often, which shift and who owns it. Turn off what doesn\'t fit your home. Saving makes a new version and keeps the history.')));
      const list = h('div',{class:'list'});
      function drawList(){
        list.textContent = '';
        work.forEach((x, i) => {
          const txt = h('input',{type:'text',value:x.text,maxlength:'200','aria-label':'Job'}); txt.addEventListener('input',()=>x.text = txt.value);
          const fq = h('select',{'aria-label':'How often'}, Object.entries(FREQ).map(([k,l]) => h('option',{value:k,selected:x.freq===k},l))); fq.addEventListener('change',()=>x.freq = fq.value);
          const sf = h('select',{'aria-label':'Which shift'}, ['Any','Day','Night'].map(s => h('option',{selected:x.shift===s},s))); sf.addEventListener('change',()=>x.shift = sf.value);
          const who = h('select',{'aria-label':'Who owns it'}, h('option',{value:''},'Whoever is on'), names.map(n => h('option',{selected:x.who===n},n))); who.addEventListener('change',()=>x.who = who.value);
          const on = h('input',{type:'checkbox',id:'con'+i,checked:x.on}); on.addEventListener('change',()=>x.on = on.checked);
          list.append(h('div',{class:'item'}, h('div',{class:'meta'},chip(x.area,'grey'), x.custom ? chip('Added by your home','calm') : null), txt,
            h('div',{class:'grid g3'}, h('label',{class:'f'},'How often',fq), h('label',{class:'f'},'Shift',sf), h('label',{class:'f'},'Owner',who)),
            h('div',{class:'row'}, h('label',{class:'checkrow',for:'con'+i},on,'Use'),
              x.custom ? h('button',{type:'button',class:'btn quiet sm',onclick:()=>{ work.splice(i,1); drawList(); }},'Remove') : null)));
        });
      }
      drawList();
      const na = h('input',{type:'text',maxlength:'60',placeholder:'Area, e.g. Basement','aria-label':'Area'}); const nt = h('input',{type:'text',maxlength:'200',placeholder:'Job','aria-label':'New job'});
      body.append(card('', h('h2',null,'Jobs'), list, h('h3',null,'Add a job'), h('div',{class:'grid g2'},na,nt),
        h('div',{class:'row'}, h('button',{type:'button',class:'btn ghost sm',onclick:()=>{ if (!nt.value.trim()) return toast('Type the job'); work.push({id:'c'+uid(), area:na.value.trim()||'Other', text:nt.value.trim(), freq:'daily', shift:'Any', on:true, who:'', photo:false, custom:true, why:'', src:''}); nt.value=''; drawList(); }},'Add job'),
          h('button',{type:'button',class:'btn sm',onclick:()=>{ const c = st(); c.hist.push({site:S().site, v:t.v, at:t.at, by:t.by, items:t.items}); c.tpl[S().site] = {v:t.v+1, at:new Date().toISOString(), by:tier().name+' (you)', items:work}; save(); toast('Saved as version '+(t.v+1)); draw(); }},'Save as version '+(t.v+1)),
          h('button',{type:'button',class:'btn quiet sm',onclick:()=>{ STARTER.forEach((s,i) => { if (!work.some(x => x.text===s.text)) work.push(Object.assign({id:'k'+i+'r'+uid(), on:true, who:'', photo:false}, s)); }); drawList(); toast('Added back any starter jobs you had removed'); }},'Restore starter jobs'))));
      body.append(proofCard(names));
      const hist = st().hist.filter(x => x.site===S().site);
      if (hist.length) body.append(h('details',{class:'card'}, h('summary',null,'Earlier versions ('+hist.length+')'), h('ul',{class:'small'}, hist.slice().reverse().map(x => h('li',null,'v'+x.v+' · '+fmtDate(x.at)+' · '+x.by+' · '+x.items.filter(i=>i.on).length+' jobs')))));
      body.append(helpBox('New manager? How this starter list was built',
        h('p',{class:'small'},'It pulls from: the Wisconsin rules for a clean, safe, sanitary home and kitchen (DHS 88 for adult family homes, DHS 83 for CBRFs); CDC environmental infection-control guidance (daily cleaning of bathrooms and high-touch surfaces, cleaning shared equipment between residents, careful handling of soiled laundry); the FDA Food Code (cold food at 41°F or below, leftovers dated and used within 7 days, sanitized food surfaces); OSHA bloodborne pathogen practices for sharps and spills; and common fire-safety checks (clear exits, monthly extinguisher and alarm checks).'),
        h('p',{class:'small'},'Use a disinfectant with an EPA registration number and follow its label, especially how long the surface must stay wet. Your licensing specialist or local health department can tell you anything your home needs beyond this list.'),
        h('p',{class:'foot'},'Wisconsin section numbers for housekeeping details are being verified. Checked '+fmtDate(CHECKED)+'. Not legal advice.')));
    }
    function proofCard(names){
      // time-limited photo proof for one caregiver who isn't getting jobs done; noted in their HR file
      const c = st(); const sid = S().site;
      const who = h('select',{'aria-label':'Caregiver'}, h('option',{value:''},'Pick a caregiver'), names.map(n => h('option',null,n)));
      const days = h('select',{'aria-label':'For how long'}, [7,14,30].map(n => h('option',{value:String(n),selected:n===14},n+' days')));
      const why = h('textarea',{maxlength:'300',placeholder:'Facts and dates, e.g. "Kitchen jobs left undone on Nov 20, 22 and 24 (3 photo reports)."','aria-label':'Reason, facts only'});
      const active = c.proof.filter(p => p.site===sid && !p.ended && p.until >= today());
      const nd = n => c.notDone.filter(r => r.site===sid).length;
      return card('', h('h2',null,'Photo proof for one caregiver'), h('p',{class:'small muted'},'Off by default. Turn it on only when someone isn\'t getting jobs done, for a set time. They see why and until when, and it is noted in their employee file. Talk with them first. '+nd()+' "not done" report'+(nd()===1?'':'s')+' on file for this home.'),
        active.length ? h('div',{class:'list'}, active.map(p => h('div',{class:'item'}, h('div',{class:'meta'}, chip('On until '+fmtDate(p.until),'amber'), h('span',null,p.who)), h('span',{class:'small'},p.reason),
          h('div',{class:'row'}, h('button',{type:'button',class:'btn quiet sm',onclick:()=>{ p.ended = new Date().toISOString(); hrNote(p.who, 'Photo proof for the cleaning checklist ended early on '+today()+'.'); save(); toast('Photo proof turned off'); draw(); }},'End early'))))) : h('p',{class:'small muted'},'No one has photo proof on.'),
        h('div',{class:'grid g2'}, h('label',{class:'f'},'Caregiver',who), h('label',{class:'f'},'For',days)), h('label',{class:'f'},'Reason (facts only)',why),
        h('div',{class:'row'}, h('button',{type:'button',class:'btn sm',onclick:()=>{
          if (!who.value) return toast('Pick a caregiver'); if (why.value.trim().length < 10) return toast('Write the reason with facts and dates');
          if (proofFor(who.value)) return toast(who.value+' already has photo proof on');
          const until = addDays(today(), +days.value);
          c.proof.push({id:uid(), site:sid, who:who.value, from:today(), until, reason:why.value.trim(), by:tier().name+' (you)', at:new Date().toISOString()});
          hrNote(who.value, 'Photo proof turned on for the cleaning checklist from '+today()+' to '+until+'. Reason: '+why.value.trim());
          save(); toast('Photo proof on for '+who.value+' until '+fmtDate(until)+'. Noted in their file.'); draw();
        }},'Turn on photo proof')));
    }
    draw();
  };

  // ---------- register ----------
  VIEWS.clean = {t:'Cleaning checklist', ic:'🧽'};
  const addNav = (t, after) => { const n = NAV[t]; if (!n || n.includes('clean')) return; const at = n.indexOf(after) >= 0 ? n.indexOf(after)+1 : n.length; n.splice(at, 0, 'clean'); };
  addNav('caregiver','face'); addNav('manager','face'); addNav('owner','forms');
  if (window.SSAccess && SSAccess.register) try { SSAccess.register({id:'clean', name:'Cleaning checklist', ic:'🧽', what:'Shift and weekly housekeeping jobs from a standards-based starter list, with reminders, history, and photo evidence only when needed.', views:['clean'], tiers:['caregiver','manager','owner','multi']}); } catch(e){}
  const viewOn = () => { try { return !window.SSAccess || !SSAccess.viewOn || SSAccess.viewOn('clean'); } catch(e){ return true; } };
  (A.homeHooks = A.homeHooks || []).push((v, t) => {
    if (S().site === 'family' || !viewOn() || !['caregiver','manager'].includes(t)) return;
    const open = openTasks(); const left = minsLeft(); const ending = left <= 60 && left >= -60 && open.length;
    v.append(h('div',{class:'grid g2'}, A.tile('clean','🧽', ending ? 'Cleaning: '+open.length+' job'+(open.length===1?'':'s')+' left before shift change' : 'Cleaning checklist', ending ? 'Finish or pass them on in the shift report.' : open.length+' job'+(open.length===1?'':'s')+' this shift.', ending ? 'urgent' : '')));
  });
  // For the shift checklist on the Start of shift screen: this shift's jobs (every-shift and today's), done or not.
  function shiftJobs(){
    const sh = C.shiftNow();
    return dueNow().filter(x => !x.always && (x.freq==='shift' || (x.freq==='daily' && (x.shift===sh.name || x.shift==='Any')))).map(x => { const d = doneFor(x); return {id:x.id, text:x.text, area:x.area, done:!!d, by:d ? d.by : '', at:d ? d.at : ''}; });
  }
  function markJob(id, on){
    const x = tpl().items.find(i => i.id === id); if (!x) return false;
    const mine = me(), c = st();
    if (on){
      if (proofFor(mine)) return 'photo';
      if (!doneFor(x)) c.done[S().site].push({task:x.id, period:periodKey(x.freq), at:new Date().toISOString(), by:mine, photos:0});
    } else c.done[S().site] = c.done[S().site].filter(z => !(z.task===x.id && z.period===periodKey(x.freq)));
    save(); return true;
  }
  window.SSClean = {openTasks: sid => openTasks(sid).map(x => ({res:'House', text:x.text})), shiftJobs, markJob};
})();
