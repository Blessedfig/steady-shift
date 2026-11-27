// Steady Shift test app: start-of-shift face sheets and daily tasks for each resident.
// Modeled on standard long-term care admission face sheets (resident identity, code status and advance directives,
// allergies, diagnoses, diet, risks, devices, contacts, insurance) plus that shift's tasks and an end-of-shift reminder.
// Every person, number and ID here is made up. Phone numbers use the 555-01xx range reserved for fiction.
(function(){
  const A = window.SSApp, C = window.SSCare;
  if (!A || !C) return;
  const {h, save, toast, head, R, VIEWS, NAV, uid, fmtDate, fmtTime, site, tier} = A;
  const S = () => A.state();
  const residents = A.residents || (() => A.D.RESIDENTS[S().site] || []);
  const {chip, card, helpBox, today, addDays} = C;
  const CAN_SEE_IDS = ['manager','rn','owner','multi'];   // insurance IDs and payee: people who make calls and book appointments
  const canSeeIds = () => CAN_SEE_IDS.includes(S().tier) || (window.SSAccess && SSAccess.can && (() => { try { return SSAccess.can('face-ids'); } catch(e){ return false; } })());
  const tel = n => 'tel:+1'+n.replace(/\D/g,'');

  // ---------- sample face sheets ----------
  const P = (role, name, phone, extra) => Object.assign({role, name, phone}, extra||{});
  const PHARM = P('Pharmacy','Sample Pharmacy (Main St.)','715-555-0150',{call:'all',note:'Refills: call by 2 PM for next-day delivery'});
  const HOSP = 'Sample Regional Hospital';
  // MCO (Family Care) or IRIS team. The nurse manager is the team's RN: call them about health changes, hospital stays and med changes.
  const MCO = (n, prog) => prog === 'iris' ? [
      P('IRIS consultant','IRIS consultant (sample)','715-555-01'+(40+n),{agency:'Sample IRIS Consultant Agency', fax:'715-555-01'+(50+n), email:'consultant'+n+'@iris.example', call:'manager', key:'cm'}),
      P('Nurse manager (RN)','IRIS nurse (sample)','715-555-01'+(60+n),{agency:'Sample IRIS Consultant Agency', fax:'715-555-01'+(50+n), email:'rn'+n+'@iris.example', call:'manager', key:'rn', note:'Call about health changes, hospital stays and medicine changes.'})] : [
      P('Care manager (case manager)','Care manager (sample)','715-555-01'+(20+n),{agency:'Family Care MCO (sample)', fax:'715-555-01'+(30+n), email:'care.manager'+n+'@mco.example', call:'manager', key:'cm'}),
      P('Nurse manager (RN)','Nurse manager (sample), RN','715-555-01'+(70+n),{agency:'Family Care MCO (sample)', fax:'715-555-01'+(30+n), email:'nurse.manager'+n+'@mco.example', call:'manager', key:'rn', note:'Call about health changes, hospital stays and medicine changes.'})];
  const FACE = {
    'M-1':{dob:'1939-03-14', admit:'2023-06-01', room:'1', sex:'F', lang:'English', comm:'Hard of hearing on the left. Face her and speak low and clear.', vision:'Reading glasses', hearing:'Hearing aid, left ear (charge at night)', dentures:'Upper denture (soak at night)', mobility:'Walker at all times',
      code:'DNR', directive:'POLST (DNR, selective treatment) signed 2025-02-10', docs:'Red folder in the office, and a copy on the fridge', dx:['Osteoarthritis, both knees','High blood pressure','Mild hearing loss'], history:'Retired school cook. Widowed. Hip fracture 2021, fully healed.',
      risks:{fall:'High',elope:'Low',choke:'Low'}, faith:'Lutheran. Likes the Sunday TV service.', culture:'Prefers to be called "Mrs. R."',
      helps:['Coffee at 7 before anything else','Talk about her grandchildren'], triggers:['Being rushed in the morning'], calm:['Sit with her, slow down, offer coffee'],
      guardian:null, poa:{name:'Daughter (sample)', type:'Health care POA', activated:false, phone:'715-555-0101', papers:'Copy in red folder'},
      payee:null, family:[P('Daughter','Daughter (sample)','715-555-0101',{call:'all'})], emergency:[P('Daughter','Daughter (sample)','715-555-0101',{call:'all', alt:'715-555-0161', when:'Any emergency, hospital trip, fall or big change, day or night'}),P('Son','Son (sample)','715-555-0102',{call:'all', when:'If the daughter does not answer in 15 minutes'})],
      team:[P('Primary doctor','Dr. Sample, family medicine','715-555-0110',{specialty:'primary', call:'all'}),P('Eye doctor','Sample Eye Clinic','715-555-0111',{specialty:'specialist', call:'manager'})],
      mco:MCO(0), pharmacy:PHARM, hospital:HOSP,
      ins:{medicare:'SAMPLE-MBI-0001', medicaid:'SAMPLE-FH-1001', program:'Family Care (MCO)', partD:'Sample Part D plan, ID SAMPLE-D-11', supp:'None'},
      funeral:{home:'Sample Funeral Home', wishes:'Burial, church service', prepaid:'Yes, prepaid plan on file'},
      isp:[{t:'Help with shower (Tue and Fri)', shift:'Day', days:[2,5]},{t:'Walk to the mailbox with walker, if weather allows', shift:'Day'},{t:'Charge hearing aid and soak denture', shift:'Night'}]},
    'M-2':{dob:'1944-11-02', admit:'2024-01-15', room:'2', sex:'M', lang:'English', comm:'Short sentences, one step at a time.', vision:'None', hearing:'Normal', dentures:'None', mobility:'Walks on his own',
      code:'Full code', directive:'No advance directive. Guardian decides.', docs:'Guardianship letters in red folder', dx:['Alzheimer\'s disease, moderate','Type 2 diabetes, diet controlled'], history:'Retired farmer. Married 50 years, wife passed 2022.',
      risks:{fall:'Medium',elope:'High',choke:'Low'}, faith:'Catholic. A priest visits monthly.', culture:'',
      helps:['Walk with him instead of blocking the door','Talk about the farm and his cows','Finger foods, one item at a time'], triggers:['Late afternoon (after 4 PM)','Loud TV'], calm:['Offer a task like folding towels','Lower the lights and noise before supper'],
      guardian:{name:'Guardian (sample)', type:'Guardian of the person and estate', scope:'Health care, placement, finances', letters:'Letters of guardianship (sample county court), copy in red folder', phone:'715-555-0103'},
      poa:null, payee:{name:'Sample Payee Services', phone:'715-555-0130', handles:'Pays rent to the home on the 1st; gives a $45 a month personal allowance', note:'SSA representative payee'},
      family:[P('Son','Son (sample)','715-555-0104',{call:'all'})], emergency:[P('Guardian','Guardian (sample)','715-555-0103',{call:'all', alt:'715-555-0163', when:'Any emergency, hospital trip, missing or left the home, or a health decision'}),P('Son','Son (sample)','715-555-0104',{call:'all', when:'Family news and visits; if the guardian can\'t be reached in an emergency'})],
      team:[P('Primary doctor','Dr. Sample, family medicine','715-555-0110',{specialty:'primary', call:'all'}),P('Psychiatry','Sample Behavioral Health','715-555-0112',{specialty:'psych', call:'manager'})],
      mco:MCO(1), pharmacy:PHARM, hospital:HOSP,
      ins:{medicare:'SAMPLE-MBI-0002', medicaid:'SAMPLE-FH-1002', program:'Family Care (MCO)', partD:'Sample Part D plan, ID SAMPLE-D-12', supp:'None'},
      funeral:{home:'Sample Funeral Home', wishes:'Catholic funeral Mass, burial next to his wife', prepaid:'Guardian has the details'},
      isp:[{t:'Check door alarm works at start of shift', shift:'Both'},{t:'Offer a walk outside with staff', shift:'Day'},{t:'Bedtime routine at 9: music, warm milk', shift:'Night'}]},
    'M-3':{dob:'1947-07-21', admit:'2025-03-03', room:'3', sex:'F', lang:'Spanish and English. Prefers Spanish when tired.', comm:'Uses short Spanish phrases. Card with phrases on her door.', vision:'Glasses', hearing:'Normal', dentures:'Full upper and lower', mobility:'Cane',
      code:'POLST: Full treatment', directive:'POLST (attempt CPR, full treatment) signed 2025-03-10', docs:'Red folder in the office', dx:['Type 2 diabetes on insulin (RN-delegated pen)','Heart failure','Chronic kidney disease, stage 3'], history:'Former seamstress. Moved from Texas to be near family.',
      risks:{fall:'Medium',elope:'Low',choke:'Low'}, faith:'Catholic. Rosary at night.', culture:'Likes rice and beans. Family visits Sunday.',
      helps:['Speak Spanish if you can','Let her sew or fold'], triggers:['Feeling rushed at meals'], calm:['Rosary and quiet music'],
      guardian:null, poa:{name:'Niece (sample)', type:'Health care POA', activated:true, phone:'715-555-0105', papers:'Activation letter in red folder'},
      payee:null, family:[P('Niece','Niece (sample)','715-555-0105',{call:'all'})], emergency:[P('Niece (POA)','Niece (sample)','715-555-0105',{call:'all'})],
      team:[P('Primary doctor','Dr. Sample, internal medicine','715-555-0113',{specialty:'primary', call:'all'}),P('Heart doctor','Sample Heart Clinic','715-555-0114',{specialty:'specialist', call:'manager'}),P('Delegating RN','RN (sample)','715-555-0115',{specialty:'nurse', call:'all'})],
      mco:MCO(0), pharmacy:PHARM, hospital:HOSP,
      ins:{medicare:'SAMPLE-MBI-0003', medicaid:'SAMPLE-FH-1003', program:'Family Care (MCO)', partD:'Sample Part D plan, ID SAMPLE-D-13', supp:'None'},
      funeral:{home:'Not chosen yet', wishes:'Niece to decide', prepaid:'No'},
      isp:[{t:'Daily weight before breakfast (heart failure)', shift:'Day'},{t:'Check feet for sores at bedtime', shift:'Night'}]},
    'M-4':{dob:'1941-01-30', admit:'2022-09-12', room:'4', sex:'M', lang:'English', comm:'Clear', vision:'None', hearing:'Hard of hearing, both ears', dentures:'None (own teeth, some missing)', mobility:'Wheelchair for distance, transfers with one helper',
      code:'DNR', directive:'DNR order and living will', docs:'Red folder; DNR bracelet on right wrist', dx:['Stroke (2022) with weakness on the left','Trouble swallowing (dysphagia)','Depression'], history:'Retired mail carrier. Army veteran.',
      risks:{fall:'High',elope:'Low',choke:'High'}, faith:'None stated', culture:'Veteran. Likes being thanked for his service.',
      helps:['Shower after lunch, not mornings','Talk about the Army and baseball'], triggers:['Being told he "has to"'], calm:['Give him two choices','Come back in 15 minutes'],
      guardian:null, poa:{name:'Wife (sample)', type:'Health care POA and financial POA', activated:true, phone:'715-555-0106', papers:'Copies in red folder'},
      payee:null, family:[P('Wife','Wife (sample)','715-555-0106',{call:'all'})], emergency:[P('Wife (POA)','Wife (sample)','715-555-0106',{call:'all'})],
      team:[P('Primary doctor','Dr. Sample, family medicine','715-555-0110',{specialty:'primary', call:'all'}),P('Speech therapy','Sample Therapy (swallowing)','715-555-0116',{specialty:'therapy', call:'manager'}),P('VA clinic','Sample VA Clinic','715-555-0117',{specialty:'specialist', call:'manager'})],
      mco:MCO(1), pharmacy:PHARM, hospital:HOSP,
      ins:{medicare:'SAMPLE-MBI-0004', medicaid:'SAMPLE-FH-1004', program:'Family Care (MCO)', partD:'VA pharmacy benefit', supp:'VA health care'},
      funeral:{home:'Sample Funeral Home', wishes:'Military honors, burial at a veterans cemetery', prepaid:'Yes'},
      isp:[{t:'Thicken all drinks to mildly thick (IDDSI 2)', shift:'Both'},{t:'Sit upright 30 minutes after meals', shift:'Both'},{t:'Turn and check skin every 2 hours in bed', shift:'Night'}]}
  };
  // Simple sheets for the other sample homes, so every resident has one.
  function basic(code, nick){ return {dob:'1945-05-05', admit:'2024-05-01', room:code.split('-')[1]||'1', sex:'', lang:'English', comm:'Clear', vision:'Glasses', hearing:'Normal', dentures:'None', mobility:'Walks on their own',
    code:'Full code', directive:'Not on file yet. Ask the manager.', docs:'Office binder', dx:['See the service plan'], history:'Sample resident.', risks:{fall:'Medium',elope:'Low',choke:'Low'}, faith:'', culture:'',
    helps:[], triggers:[], calm:[], guardian:null, poa:null, payee:null, family:[], emergency:[P('Family','Family contact (sample)','715-555-0190',{call:'all'})],
    team:[P('Primary doctor','Dr. Sample','715-555-0110',{specialty:'primary', call:'all'})], mco:MCO(2), pharmacy:PHARM, hospital:HOSP,
    ins:{medicare:'SAMPLE-MBI-0'+code.replace(/\D/g,'').padStart(3,'0'), medicaid:'SAMPLE-FH-2'+code.replace(/\D/g,'').padStart(3,'0'), program:'Family Care (MCO)', partD:'Sample Part D plan', supp:'None'},
    funeral:{home:'Not on file', wishes:'Not on file', prepaid:'Unknown'}, isp:[] }; }
  const OVER = {
    'B-2':{code:'DNR', dx:['COPD (nebulizer twice a day)','High blood pressure'], risks:{fall:'Medium',elope:'Low',choke:'Low'}, isp:[{t:'Nebulizer at 8 and 8 (RN-delegated)', shift:'Both'}]},
    'B-5':{dx:['Vascular dementia'], risks:{fall:'Medium',elope:'High',choke:'Low'}, helps:['Walk with him near shift change'], triggers:['Shift change noise and coats by the door'], guardian:{name:'Guardian (sample)', type:'Limited guardian of the person', scope:'Health care and placement only', letters:'Letters (sample), office binder', phone:'715-555-0107'}, payee:{name:'Sample Payee Services', phone:'715-555-0130', handles:'Rent and a weekly allowance', note:'SSA representative payee'}},
    'B-7':{mco:MCO(3,'iris'), ins:{medicare:'SAMPLE-MBI-0007', medicaid:'SAMPLE-FH-2007', program:'IRIS (self-directed)', partD:'Sample Part D plan', supp:'None'}, dx:['Anxiety','Lactose intolerance'], helps:['Tea and quiet talk'], isp:[{t:'Offer PRN only per plan; call the nurse if unsure', shift:'Both'}]},
    'B-9':{code:'POLST: DNR, comfort-focused', dx:['Advanced dementia','Weight loss','Pressure injury risk'], risks:{fall:'High',elope:'Low',choke:'High'}, mobility:'Wheelchair, two-person transfer', isp:[{t:'Hands-on help at every meal, pureed (IDDSI 4)', shift:'Both'},{t:'Turn every 2 hours, heels off the bed', shift:'Night'}]},
    'C-1':{dx:['Celiac disease','Osteoporosis']}, 'C-3':{dx:['Dementia with sundowning'], triggers:['After 4 PM'], calm:['Music from the 1950s']}
  };
  function face(code){
    const r = residents().find(x => x.code === code) || {code, nick:code};
    const f = JSON.parse(JSON.stringify(FACE[code] || Object.assign(basic(code, r.nick), OVER[code]||{})));
    // admission intake fills in what it knows for new residents
    try { const ip = window.SS_residentProfile && SS_residentProfile(S().site, code); if (ip && ip.handoff){ const ho = ip.handoff;
      if (ho.codeStatus && /Not confirmed/.test(f.directive||'')) f.code = ho.codeStatus;
      if (ho.risks && ho.risks.length) f.riskNotes = ho.risks; if (ho.whatHelps && ho.whatHelps.length) f.helps = [...new Set([...(f.helps||[]), ...ho.whatHelps])];
      if (ho.triggers && ho.triggers.length) f.triggers = [...new Set([...(f.triggers||[]), ...ho.triggers])];
      if (ho.summary) f.history = ho.summary; } } catch(e){}
    f.ssn = f.ssn || '000-'+String(40+code.charCodeAt(0)%50)+'-'+code.replace(/\D/g,'').padStart(4,'0');   // 000 numbers are never issued
    const ed = ((S().faceEdits||{})[S().site]||{})[code]; if (ed) ['emergency','family','team','mco'].forEach(k => { if (Array.isArray(ed[k])) f[k] = ed[k]; });
    if (f.mco && !Array.isArray(f.mco)) f.mco = [f.mco];
    f.mco = f.mco || [];
    f.nick = r.nick; f.code0 = code; f.note = r.note;
    return f;
  }
  const age = dob => { const d = new Date(dob+'T12:00:00'), n = new Date(); let a = n.getFullYear()-d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };

  // ---------- tasks for this shift ----------
  function tasksFor(code){
    const sid = S().site, sh = C.shiftNow(), f = face(code), out = [], c = C.ensure(), t = today();
    const dow = new Date().getDay();
    (f.isp||[]).filter(x => (x.shift==='Both' || x.shift===sh.name) && (!x.days || x.days.includes(dow))).forEach((x,i) => out.push({id:'isp'+i, src:'Service plan', text:x.t}));
    C.ordersFor(sid, code).filter(o => o.track && (o.track.where||[]).length).forEach(o => {
      if (o.track.freq === 'weekly' && c.weights.some(w => w.site===sid && w.res===code && w.date > addDays(t,-7))) return;
      out.push({id:'o'+o.id, src:o.specialty==='psych' ? 'Order' : 'Order'+(o.prescriber?' ('+o.prescriber+')':''), text:o.track.label+(o.track.freq?' · '+o.track.freq:''), auto:o.track.where.includes('meal') ? 'Logged on the meal screen' : 'Logged on the shift report'});
    });
    // appointments from orders, today and tomorrow
    let all = []; try { all = window.SS_allOrders ? SS_allOrders() : (S().orders||[]); } catch(e){}
    all.filter(o => o.site===sid && o.res===code && o.kind==='appointment' && o.status==='verified' && o.start && o.start >= t && o.start <= addDays(t,1)).forEach(o => out.push({id:'a'+o.id, src:'Appointment '+(o.start===t?'today':'tomorrow'), text:(o.specialty==='psych'&&S().tier==='caregiver')?'Appointment (see the manager for details)':o.text, appt:true}));
    // to-dos the last shift left for this resident
    const last = c.handoffs.filter(x => x.site===sid).sort((a,b)=>a.at<b.at?1:-1)[0];
    if (last && (Date.now() - new Date(last.at)) < 14*3600e3) last.todos.filter(x => x.res===code).forEach(x => out.push({id:'h'+x.id, src:'From the last shift', text:x.text}));
    return out;
  }
  function doneMap(){ const c = C.ensure(); c.tasksDone = c.tasksDone || {}; const k = S().site+' '+C.shiftNow().key; c.tasksDone[k] = c.tasksDone[k] || {}; return c.tasksDone[k]; }
  function openTasks(sid){
    if (sid && sid !== S().site) return [];
    const dm = doneMap(); const out = [];
    residents().forEach(r => tasksFor(r.code).forEach(t => { if (!dm[r.code+':'+t.id]) out.push(Object.assign({res:r.code}, t)); }));
    return out;
  }
  function minsLeft(){ const sh = C.shiftNow(); const [a,b] = (sh.end||'18:00').split(':').map(Number); const now = new Date(); let e = a*60+(b||0), n = now.getHours()*60+now.getMinutes(); let d = e - n; if (d < -60) d += 1440; return d; }

  // ---------- view log for restricted items ----------
  function logView(what){
    const msg = what;
    try { if (window.SSAccess && SSAccess.log) { SSAccess.log(msg, S().site); return; } } catch(e){}
    const st = S(); st.audit = st.audit || []; st.audit.unshift({at:new Date().toISOString(), who:tier().name+' (you)', what:msg, site:st.site}); save();
  }

  // ---------- face sheet view ----------
  R.face = v => {
    const rs = residents();
    const sh = C.shiftNow();
    const pick = C.param ? C.param() : '';
    let cur = rs.find(r => r.code === pick) ? pick : '';
    v.append(head('Start of shift · '+site().name, 'Face sheets and today\'s tasks', 'Read the top of each sheet before you start. Allergies, code status and risks are always first.'));
    const left = minsLeft(); const open = openTasks();
    if (left <= 60 && left >= -60 && open.length) v.append(card('warn', h('b',null,'Shift ends '+(left > 0 ? 'in '+left+' minutes' : 'now')+'. '+open.length+' task'+(open.length===1?' is':'s are')+' not done yet.'),
      h('ul',{class:'small'}, open.slice(0,6).map(t => h('li',null,t.res+': '+t.text))), h('p',{class:'small'},'Do them, or pass them on in the ', h('a',{href:'#/shift/give'},'shift change report'), '. Nothing is marked as your fault.')));
    const tabs = h('div',{class:'tabs',role:'tablist'});
    const body = h('div',{class:'grid'});
    const T = [['','Everyone']].concat(rs.map(r => [r.code, r.code+' '+r.nick]));
    T.forEach(([id,lab]) => tabs.append(h('button',{role:'tab',type:'button','aria-selected':String(cur===id),onclick:()=>{ cur = id; tabs.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-selected',String(T[i][0]===id))); draw(); }},lab)));
    v.append(tabs);
    if (canEditEC() && VIEWS.intake) v.append(h('div',{class:'row noprint'}, h('a',{class:'btn ghost sm',href:'#/intake/new'},'+ Add a resident'), h('span',{class:'small muted'},'Starts a new admission. Upload their papers, or just type the basics.')));
    v.append(body);
    function draw(){
      body.textContent = '';
      if (!cur){
        body.append(card('soft', h('div',{class:'meta'}, chip(sh.name+' shift · '+sh.label)), h('p',{class:'small'},'Tap a name for the full face sheet, contacts and what helps.')));
        rs.forEach(r => body.append(sheet(r.code, true)));
      } else body.append(sheet(cur, false));
      body.append(helpBox('What is on a face sheet, and who sees what',
        h('p',{class:'small'},'Laid out like a standard long-term care admission face sheet: who the person is, code status and where the papers are, allergies, diagnoses, diet, risks, devices, contacts, insurance and end-of-life wishes. Wisconsin adult family homes must keep the resident\'s name, birth date, guardian, emergency contacts, physician, placing agency and Medicaid or Medicare number in the record (DHS 88.09(1)(d)), and CBRFs keep similar records (DHS 83.42).'),
        h('p',{class:'small'},'Insurance numbers and payee details show only to managers, nurses and owners, who make the calls and book the appointments. Each time someone opens them it is logged. Caregivers see everything they need for care and emergencies.'),
        h('p',{class:'foot'},'Sample people and numbers only. Not legal advice.')));
    }
    draw();
  };

  function sheet(code, brief){
    const f = face(code); const sid = S().site;
    const p = C.profile(code);
    const box = card('face', h('div',{class:'facehead'},
      h('div',{class:'avatar','aria-hidden':'true'}, f.nick[0]),
      h('div',null, h('h2',null, f.nick+' (sample) ', h('span',{class:'chip'},code)), h('p',{class:'dob'}, h('span',null,'Date of birth '), h('b',null,fmtDate(f.dob)), h('span',null,' · age '+age(f.dob))), h('p',{class:'small muted'},'Room '+f.room+' · here since '+fmtDate(f.admit)))));
    // the band that can't be missed
    const allergy = p.allergies.length ? p.allergies.map(a => C.ALLERGENS[a]||a).join(', ') : 'No known allergies';
    const codeCls = /DNR|comfort/i.test(f.code) ? 'red' : 'amber';
    box.append(h('div',{class:'band'},
      h('div',{class:'bandi '+(p.allergies.length?'red':'calm')}, h('span',null,'Allergies'), h('b',null,allergy)),
      h('div',{class:'bandi '+codeCls}, h('span',null,'Code status'), h('b',null,f.code), h('small',null,f.docs)),
      h('div',{class:'bandi'}, h('span',null,'Diet'), h('b',null,p.diet), h('small',null,[p.texture, p.liquids && p.liquids!=='Thin' ? 'Drinks: '+p.liquids : 'Thin drinks'].join(' · '))),
      h('div',{class:'bandi'}, h('span',null,'Risks'), h('b',null,['fall','elope','choke'].map(k => ({fall:'Falls',elope:'Wandering/leaving',choke:'Choking'})[k]+': '+f.risks[k]).join(' · ')))));
    box.append(h('p',{class:'small'},h('b',null,'Diagnoses: '),f.dx.join('; ')));
    box.append(emergencyBlock(f, code, brief));
    // care plan summary from isp.js: what helps, with read-and-acknowledge
    try { const ib = window.SSISP && SSISP.faceBlock(code); if (ib) box.append(ib); } catch(e){}
    try { const cb = window.SSChoices && SSChoices.faceBlock(code); if (cb) box.append(cb); } catch(e){}
    try { const nb = window.SSNotes && SSNotes.faceBlock(code); if (nb) box.append(nb); } catch(e){}
    // tasks
    const tasks = tasksFor(code); const dm = doneMap();
    const tl = h('ul',{class:'tourlist tasks'});
    tasks.forEach(t => { const k = code+':'+t.id, id = 'tk-'+k.replace(/\W/g,''); const cb = h('input',{type:'checkbox',id,checked:!!dm[k]});
      const lb = h('label',{for:id,class:dm[k]?'done':''}, t.text, h('span',{class:'small muted'},' · '+t.src+(t.auto?' · '+t.auto:'')));
      cb.addEventListener('change',()=>{ if (cb.checked) dm[k] = {by:tier().name+' (you)', at:new Date().toISOString()}; else delete dm[k]; save(); lb.className = cb.checked?'done':''; });
      tl.append(h('li',null,cb,lb)); });
    box.append(h('div',{class:'grid',style:'gap:.4rem'}, h('h3',null,'This shift ('+tasks.filter(t => !dm[code+':'+t.id]).length+' left)'), tasks.length ? tl : h('p',{class:'small muted'},'No set tasks this shift beyond normal care.')));
    if (brief){ box.append(h('div',{class:'row'}, h('a',{class:'btn ghost sm',href:'#/face/'+encodeURIComponent(code)},'Full face sheet and contacts'))); return box; }
    // who they are
    const line = (l, val) => val ? h('p',{class:'small'},h('b',null,l+': '),val) : null;
    box.append(h('div',{class:'grid g2'},
      h('div',{class:'grid',style:'gap:.3rem'}, h('h3',null,'Communication and devices'), line('Language',f.lang), line('Communication',f.comm), line('Vision',f.vision), line('Hearing',f.hearing), line('Dentures',f.dentures), line('Mobility',f.mobility)),
      h('div',{class:'grid',style:'gap:.3rem'}, h('h3',null,'Who they are'), line('History',f.history), line('Faith',f.faith), line('Culture and preferences',f.culture), line('Advance directive',f.directive))));
    box.append(h('div',{class:'card calm',style:'box-shadow:none'}, h('h3',null,'What helps'),
      f.helps.length ? h('ul',{class:'small'},f.helps.map(x => h('li',null,x))) : h('p',{class:'small muted'},'Not filled in yet.'),
      f.triggers.length ? h('p',{class:'small'},h('b',null,'Watch for: '),f.triggers.join('; ')) : null,
      f.calm.length ? h('p',{class:'small'},h('b',null,'Calming: '),f.calm.join('; ')) : null,
      f.riskNotes ? h('p',{class:'small'},h('b',null,'From admission: '),f.riskNotes.join('; ')) : null));
    box.append(contacts(f, code));
    box.append(insurance(f, code));
    box.append(h('div',{class:'grid',style:'gap:.3rem'}, h('h3',null,'End-of-life wishes'), line('Funeral home',f.funeral.home), line('Wishes',f.funeral.wishes), line('Prepaid',f.funeral.prepaid)));
    box.append(h('div',{class:'row noprint'}, h('button',{type:'button',class:'btn ghost sm',onclick:()=>window.print()},'Print face sheet'), h('button',{type:'button',class:'btn ghost sm',onclick:e=>{ const pk = packet(code); const host = e.target.closest('.card'); host.replaceWith(pk); pk.scrollIntoView(); }},'🚑 Emergency packet')));
    return box;
  }

  function person(x, allowCall){
    return h('div',{class:'item'}, h('div',{class:'meta'}, h('b',{style:'color:var(--ink)'},x.role), x.specialty ? chip(x.specialty,'grey') : null),
      h('span',null,x.name+(x.agency ? ' · '+x.agency : '')), x.note ? h('span',{class:'small muted'},x.note) : null, x.fax && allowCall ? h('span',{class:'small'},'Fax: '+x.fax) : null,
      x.phone ? (allowCall ? h('a',{class:'btn ghost sm callbtn',href:tel(x.phone)},'📞 Call '+x.phone) : h('span',{class:'small muted'},'Manager or nurse calls this contact')) : null);
  }
  // Emergency contacts: everyone on shift sees them and can tap to call; managers, nurses and owners edit them.
  const canEditEC = () => ['manager','rn','owner','multi'].includes(S().tier);
  function decides(f, x){
    const same = p => p && x.phone && p.phone && p.phone.replace(/\D/g,'') === x.phone.replace(/\D/g,'');
    if (same(f.guardian)) return f.guardian.type;
    if (same(f.poa)) return f.poa.type+(f.poa.activated ? ' (activated)' : ' (not activated)');
    return '';
  }
  function emergencyBlock(f, code, brief){
    const box = h('section',{class:'ec','aria-label':'Emergency contacts'});
    const list = f.emergency || [];
    box.append(h('div',{class:'row',style:'justify-content:space-between'}, h('h3',null,'🚨 Emergency contacts'), !brief ? addEdit(f, code, 'emergency', () => box) : null));
    box.append(h('p',{class:'small'},'Call 911 first for a medical emergency. Then call in this order.'));
    if (!list.length) box.append(h('p',{class:'small',style:'color:var(--amber)'},'No emergency contact on file. Tell the manager today.'));
    const ol = h('ol',{class:'eclist'});
    (brief ? list.slice(0,1) : list).forEach((x, i) => { const d = decides(f, x);
      ol.append(h('li',{class:'item'},
        h('div',{class:'meta'}, h('b',{style:'color:var(--ink)'},(i+1)+'. '+x.name), h('span',null,x.role), d ? chip('Decides: '+d,'amber') : null),
        x.when ? h('span',{class:'small'},'When to call: '+x.when) : (i === 0 ? h('span',{class:'small'},'When to call: any emergency, hospital trip, fall or big change') : null),
        h('div',{class:'row'}, x.phone ? h('a',{class:'btn sm callbtn',href:tel(x.phone)},'📞 Call '+x.phone) : null, x.alt ? h('a',{class:'btn ghost sm callbtn',href:tel(x.alt)},'📞 Other phone '+x.alt) : null))); });
    box.append(ol);
    if (brief && list.length > 1) box.append(h('span',{class:'small'},list.length-1+' more on the full face sheet'));
    return box;
  }
  // One editor for every list of people on a face sheet. Managers, nurses and owners add, reorder, change and remove; each save is logged.
  const SPECS = [['primary','Primary care'],['specialist','Specialist'],['psych','Behavioral health'],['dental','Dental'],['therapy','Therapy'],['nurse','Nurse'],['hospice','Hospice'],['homehealth','Home health'],['pharmacy','Pharmacy'],['other','Other']];
  const LISTS = {
    emergency:{t:'emergency contacts', one:'contact', hint:'In the order staff should call.', staffCall:true, fields:[['name','Name'],['role','Relationship','Daughter, guardian, friend…'],['phone','Phone','715-555-0100','tel'],['alt','Other phone','','tel'],['when','When to call','Any emergency, day or night']]},
    family:{t:'family and friends', one:'person', hint:'People who visit or call. Emergency contacts are listed above.', fields:[['name','Name'],['role','Relationship','Niece, friend, neighbor…'],['phone','Phone','','tel'],['note','Good to know','Visits Sundays']], callable:true},
    team:{t:'doctors and specialists', one:'provider', hint:'Primary doctor, specialists, dentist, therapists, hospice and home health.', fields:[['role','What they do','Primary doctor, heart doctor, dentist…'],['name','Name or clinic'],['specialty','Type','','spec'],['phone','Phone','','tel'],['fax','Fax','','tel'],['note','Good to know','Refills, visit days…']], callable:true},
    mco:{t:'Family Care or IRIS team', one:'team member', hint:'Care manager (case manager), nurse manager (RN), IRIS consultant.', fields:[['role','Role','Care manager, nurse manager (RN)…'],['name','Name'],['agency','Agency'],['phone','Phone','','tel'],['fax','Fax','','tel'],['email','Email','','email']]}
  };
  function listEditor(f, code, key, startAdding){
    const L = LISTS[key];
    const rows = (f[key]||[]).map(x => Object.assign({}, x));
    if (startAdding) rows.push({call: L.staffCall ? 'all' : 'manager'});
    const box = h('section',{class:'card soft editbox','aria-label':'Edit '+L.t});
    const draw = () => {
      box.textContent = '';
      box.append(h('h3',null,'Edit '+L.t), h('p',{class:'small muted'},L.hint+' Changes are logged. Sample people only.'));
      rows.forEach((x, i) => {
        const input = ([k, lab, ph, type]) => type === 'spec'
          ? h('label',{class:'f'},lab, h('select',{onchange:e=>{ x[k] = e.target.value; }}, SPECS.map(([v,t]) => h('option',{value:v,selected:(x[k]||'other')===v},t))))
          : h('label',{class:'f'},lab, h('input',{type:type||'text',value:x[k]||'',placeholder:ph||'',oninput:e=>{ x[k] = e.target.value; }}));
        const callBox = L.callable ? (() => { const id = 'call-'+key+i; const cb = h('input',{type:'checkbox',id,checked:x.call==='all',onchange:e=>{ x.call = e.target.checked ? 'all' : 'manager'; }}); return h('label',{class:'row small',for:id}, cb, 'Caregivers may call this person directly'); })() : null;
        box.append(h('div',{class:'item'}, h('b',null,(L.one[0].toUpperCase()+L.one.slice(1))+' '+(i+1)),
          h('div',{class:'grid g2'}, L.fields.map(input)), callBox,
          h('div',{class:'row'}, i ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ [rows[i-1], rows[i]] = [rows[i], rows[i-1]]; draw(); }},'Move up') : null,
            h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ rows.splice(i,1); draw(); }},'Remove'))));
      });
      box.append(h('div',{class:'row'},
        h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ rows.push({call: L.staffCall ? 'all' : 'manager'}); draw(); const ins = box.querySelectorAll('.item input'); const last = box.querySelectorAll('.item'); const li = last[last.length-1]; if (li) li.querySelector('input,select').focus(); }},'+ Add a '+L.one),
        h('button',{class:'btn sm',type:'button',onclick:()=>{
          const clean = rows.filter(x => (x.name||'').trim() && (key === 'team' || key === 'mco' || (x.phone||'').trim())).map(x => { if (L.staffCall) x.call = 'all'; if (key==='mco' && /nurse|rn\b/i.test(x.role||'')) x.key = 'rn'; return x; });
          if (key === 'emergency' && !clean.length){ toast('Add at least one contact with a name and phone'); return; }
          const st = S(); st.faceEdits = st.faceEdits || {}; st.faceEdits[st.site] = st.faceEdits[st.site] || {};
          st.faceEdits[st.site][code] = Object.assign(st.faceEdits[st.site][code]||{}, {[key]:clean, by:tier().name+' (you)', at:new Date().toISOString()});
          save(); logView('Updated '+L.t+' for '+code+' ('+clean.length+')'); toast('Saved'); A.route(); }},'Save'),
        h('button',{class:'btn quiet sm',type:'button',onclick:()=>A.route()},'Cancel')));
    };
    draw(); return box;
  }
  // "+ Add" and "Edit" buttons shown to managers, nurses and owners next to each list
  function addEdit(f, code, key, host){
    if (!canEditEC()) return null;
    const open = adding => { const ed = listEditor(f, code, key, adding); host().replaceWith(ed); const first = ed.querySelector('.item:last-of-type input, .item:last-of-type select'); if (first) first.focus(); };
    return h('div',{class:'row noprint'}, h('button',{class:'btn ghost sm',type:'button',onclick:()=>open(true)},'+ Add a '+LISTS[key].one), (f[key]||[]).length ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>open(false)},'Edit') : null);
  }

  // Care team from the MCO or IRIS: care manager and nurse manager, with phone, fax and email.
  function teamBlock(f, may, code){
    const prog = /IRIS/i.test((f.ins||{}).program||'') ? 'IRIS team' : 'Family Care (MCO) team';
    const missingRN = !f.mco.some(x => x.key === 'rn');
    let wrap; const add = addEdit(f, code, 'mco', () => wrap);
    return wrap = h('div',{class:'grid',style:'gap:.5rem'}, h('div',{class:'row',style:'justify-content:space-between'}, h('h3',null,prog), add),
      h('div',{class:'grid g2'}, f.mco.map(x => h('div',{class:'item'}, h('div',{class:'meta'}, h('b',{style:'color:var(--ink)'},x.role), x.key==='rn' ? chip('RN','grey') : null),
        h('span',null,x.name+(x.agency ? ' · '+x.agency : '')), x.note ? h('span',{class:'small muted'},x.note) : null,
        may(x) ? h('div',{class:'grid',style:'gap:.3rem'},
          x.phone ? h('a',{class:'btn ghost sm callbtn',href:tel(x.phone)},'📞 Call '+x.phone) : null,
          x.fax ? h('span',{class:'small'},'Fax: '+x.fax) : null,
          x.email ? h('a',{class:'small',href:'mailto:'+x.email},x.email) : null) : h('span',{class:'small muted'},'Manager or nurse contacts the team')))),
      missingRN ? h('p',{class:'small',style:'color:var(--amber)'},'No nurse manager on file yet. Ask the care manager who the team\'s RN is.') : null);
  }
  function contacts(f, code){
    const mgr = C.isManager();
    const may = x => x.call === 'all' || mgr;
    const box = h('div',{class:'grid',style:'gap:.5rem'}, h('h3',null,'Contacts'));
    const list = h('div',{class:'grid g2'});
    if (f.guardian) list.append(h('div',{class:'item'}, h('div',{class:'meta'},h('b',{style:'color:var(--ink)'},'Guardian'),chip(f.guardian.type,'amber')), h('span',null,f.guardian.name),
      h('span',{class:'small'},'Decides: '+f.guardian.scope), h('span',{class:'small muted'},'Papers: '+f.guardian.letters), h('a',{class:'btn ghost sm callbtn',href:tel(f.guardian.phone)},'📞 Call '+f.guardian.phone)));
    if (f.poa) list.append(h('div',{class:'item'}, h('div',{class:'meta'},h('b',{style:'color:var(--ink)'},'Power of attorney'),chip(f.poa.type,'grey'),chip(f.poa.activated?'Activated':'Not activated (resident decides)',f.poa.activated?'amber':'calm')), h('span',null,f.poa.name), h('span',{class:'small muted'},'Papers: '+f.poa.papers), h('a',{class:'btn ghost sm callbtn',href:tel(f.poa.phone)},'📞 Call '+f.poa.phone)));
    if (!f.guardian && !f.poa) list.append(h('div',{class:'item'}, h('b',null,'Decision maker'), h('span',{class:'small'},'The resident makes their own decisions.')));
    box.append(list);
    const section = (key, title, items, extra) => { let wrap; const add = addEdit(f, code, key, () => wrap);
      const g = h('div',{class:'grid g2'}, items.map(x => person(x, may(x))), extra || []);
      return wrap = h('div',{class:'grid',style:'gap:.5rem'}, h('div',{class:'row',style:'justify-content:space-between'}, h('h3',null,title), add),
        items.length || (extra||[]).length ? g : h('p',{class:'small muted'},'None on file yet.')); };
    box.append(section('family','Family and friends', f.family.filter(x => !f.emergency.some(e => e.phone===x.phone))));
    box.append(section('team','Doctors and specialists', f.team.map(x => Object.assign({}, x, {specialty:x.specialty==='psych' && S().tier==='caregiver' ? null : x.specialty})),
      [person(f.pharmacy, may(f.pharmacy)), h('div',{class:'item'}, h('b',null,'Preferred hospital'), h('span',null,f.hospital), h('span',{class:'small muted'},'In an emergency, call 911 first. Paramedics choose the closest safe hospital.'))]));
    box.append(teamBlock(f, may, code));
    if (f.payee){
      if (canSeeIds()){
        const det = h('details',{class:'item'}, h('summary',null,'Representative payee (restricted)'));
        det.addEventListener('toggle', () => { if (det.open) logView('Viewed payee details for '+code); }, {once:true});
        det.append(h('span',null,f.payee.name+' · '+f.payee.note), h('span',{class:'small'},'Handles: '+f.payee.handles), h('a',{class:'btn ghost sm callbtn',href:tel(f.payee.phone)},'📞 Call '+f.payee.phone));
        box.append(det);
      } else box.append(h('p',{class:'small muted'},'A representative payee handles money for this resident. Ask the manager about money questions.'));
    }
    return box;
  }
  // One-page emergency and hospital transfer packet: goes with the resident in the ambulance.
  function packet(code){
    const f = face(code), p = C.profile(code);
    logView('Opened the emergency packet for '+code);
    const L = (l, v) => h('p',{class:'small'}, h('b',null,l+': '), v || 'Not on file');
    const ppl = (arr) => h('ul',{class:'small'}, arr.map(x => h('li',null, h('b',null,x.role+': '), x.name+(x.agency?' ('+x.agency+')':'')+(x.phone?' · phone '+x.phone:'')+(x.fax?' · fax '+x.fax:'')+(x.email?' · '+x.email:''))));
    const dec = f.guardian ? 'Guardian: '+f.guardian.name+' ('+f.guardian.scope+') · '+f.guardian.phone : f.poa ? 'POA: '+f.poa.name+' ('+f.poa.type+(f.poa.activated?', activated':', not activated')+') · '+f.poa.phone : 'The resident decides';
    const ids = canSeeIds() ? 'Medicare '+f.ins.medicare+' · Medicaid '+f.ins.medicaid+' · ' : '';
    const box = card('face epacket',
      h('div',{class:'row noprint',style:'justify-content:space-between'}, h('button',{type:'button',class:'btn quiet sm',onclick:()=>A.route()},'← Back to the face sheet'), h('button',{type:'button',class:'btn sm',onclick:()=>{ logView('Printed the emergency packet for '+code); window.print(); }},'Print packet')),
      h('h2',null,'Emergency and hospital transfer packet'),
      h('p',{class:'small muted'}, site().name+' · printed '+new Date().toLocaleString()+' · SAMPLE DATA'),
      h('div',{class:'band'},
        h('div',{class:'bandi '+(p.allergies.length?'red':'calm')}, h('span',null,'Allergies'), h('b',null,p.allergies.length ? p.allergies.map(a => C.ALLERGENS[a]||a).join(', ') : 'No known allergies')),
        h('div',{class:'bandi '+(/DNR|comfort/i.test(f.code)?'red':'amber')}, h('span',null,'Code status'), h('b',null,f.code), h('small',null,f.directive))),
      L('Resident', f.nick+' (sample) · '+code+' · born '+fmtDate(f.dob)+' · '+f.sex),
      L('Diagnoses', f.dx.join('; ')),
      L('Medicines', 'Send the current MAR and the pharmacy list with this sheet'),
      L('Diet', [p.diet, p.texture, p.liquids && p.liquids!=='Thin' ? 'Drinks: '+p.liquids : 'Thin drinks'].join(' · ')),
      L('Mobility and risks', f.mobility+' · Falls '+f.risks.fall+' · Wandering '+f.risks.elope+' · Choking '+f.risks.choke),
      L('Communication', [f.lang, f.comm, 'Hearing: '+f.hearing, 'Vision: '+f.vision, f.dentures && f.dentures!=='None' ? 'Dentures: '+f.dentures : null].filter(Boolean).join(' · ')),
      L('Who decides', dec),
      h('h3',null,'Call'), ppl(f.emergency),
      h('h3',null,(/IRIS/i.test(f.ins.program)?'IRIS':'Family Care (MCO)')+' team: tell them about the hospital stay'), f.mco.length ? ppl(f.mco) : h('p',{class:'small'},'Not on file'),
      h('h3',null,'Doctors and pharmacy'), ppl(f.team.filter(x => x.specialty!=='psych').concat([f.pharmacy])),
      L('Insurance', ids+f.ins.program+' · '+f.ins.partD),
      h('p',{class:'foot'},'Call 911 first in an emergency. Send copies of the POLST or DNR, guardianship or POA papers, and the MAR. The home tells the nurse manager and care manager the same day.'));
    return box;
  }
  function insurance(f, code){
    const box = h('div',{class:'grid',style:'gap:.4rem'}, h('h3',null,'Insurance and benefits'));
    box.append(h('p',{class:'small'},h('b',null,'Program: '),f.ins.program+' · ',h('b',null,'Drug plan: '),f.ins.partD+' · ',h('b',null,'Other: '),f.ins.supp));
    if (window.SSSSN){ box.append(SSSSN.field({ssn:f.ssn, site:S().site, label:code, kind:'resident'})); const g = SSSSN.grantCard(S().site); if (g) box.append(g); }
    if (!canSeeIds()){ box.append(h('p',{class:'small muted'},'Medicare and Medicaid numbers are kept with the manager and nurse, who book appointments and make insurance calls.')); return box; }
    const out = h('div',{class:'grid g2'});
    const btn = h('button',{type:'button',class:'btn quiet sm',onclick:()=>{
      out.textContent = '';
      out.append(h('div',{class:'item'}, h('b',null,'Medicare (MBI)'), h('span',{class:'mono'},f.ins.medicare)), h('div',{class:'item'}, h('b',null,'Medicaid / ForwardHealth ID'), h('span',{class:'mono'},f.ins.medicaid)));
      btn.remove(); logView('Viewed insurance numbers for '+code); toast('Shown. This view is logged.');
    }},'Show Medicare and Medicaid numbers (logged)');
    box.append(btn, out);
    return box;
  }

  // ---------- register ----------
  VIEWS.face = {t:'Face sheets and tasks', ic:'🪪'};
  const addNav = (t, after) => { const n = NAV[t]; if (!n || n.includes('face')) return; const at = n.indexOf(after) >= 0 ? n.indexOf(after)+1 : 1; n.splice(at, 0, 'face'); };
  addNav('caregiver','home'); addNav('manager','home'); addNav('rn','home'); addNav('owner','owner');
  if (window.SSAccess && SSAccess.register) try { SSAccess.register({id:'face', name:'Face sheets and shift tasks', ic:'🪪', what:'Allergies, code status, risks, contacts and each shift\'s tasks per resident, with an end-of-shift reminder.', views:['face'], tiers:['caregiver','manager','rn','owner','multi']}); } catch(e){}
  const viewOn = id => { try { return !window.SSAccess || !SSAccess.viewOn || SSAccess.viewOn(id); } catch(e){ return true; } };
  (A.homeHooks = A.homeHooks || []).unshift((v, t) => {
    if (S().site === 'family' || !viewOn('face') || !['caregiver','manager','rn'].includes(t)) return;
    const open = openTasks(); const left = minsLeft();
    const ending = left <= 60 && left >= -60 && open.length;
    const tl = A.tile('face','🪪', ending ? 'Shift ends soon: '+open.length+' task'+(open.length===1?'':'s')+' left' : 'Start of shift: face sheets and tasks', ending ? 'Finish them or pass them on in the shift report.' : open.length+' task'+(open.length===1?'':'s')+' this shift. Allergies, code status and risks for everyone.', ending ? 'urgent' : '');
    // near the top of home, right under the greeting
    const anchor = v.querySelector('.head'); if (anchor && anchor.nextSibling) v.insertBefore(tl, anchor.nextSibling); else v.append(tl);
  });
  window.SSFace = {openTasks, tasksFor, face};
})();
