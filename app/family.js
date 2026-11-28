// Steady Shift test app: family caregiver version (#/family).
// Angelika (2026-11-28, marked urgent): for the family caregiver plan, add medication times, let 2 or 3 family members
// share it, and help people who don't know how healthcare works, based on their own legal situation.
// Christian (2026-11-28): the family option was thin. This file gives the family plan its own big-button home,
// a medicine list with times and a pop-up alarm, a family circle (up to 3 more people), today's tasks with who did
// what, and a plain-language guide that changes with the family's situation (who decides, how pay works, papers).
// Test version: sample data only, kept in this browser. In the real app the family circle shares one account
// space through invites, and the alarm also arrives as a phone notification with no medicine names on it.
(function(){
  const A = window.SSApp; if (!A) return;
  const {h, save, toast, head, R, VIEWS, NAV, uid, fmtDate, fmtTime, copy} = A;
  const S = () => A.state();
  const today = () => A.isoDay(new Date());
  const chip = (t, c) => h('span',{class:'chip'+(c ? ' '+c : '')}, t);
  const card = (c, ...k) => h('div',{class:'card'+(c ? ' '+c : '')}, ...k);
  const toMin = s => { const [a,b] = String(s||'0:0').split(':').map(Number); return a*60 + (b||0); };
  const clock12 = t => { const [a,b] = t.split(':').map(Number); return ((a+11)%12+1)+(b ? ':'+String(b).padStart(2,'0') : '')+(a < 12 ? ' AM' : ' PM'); };
  const WINDOW = 60;   // pharmacy-label "about this time": an hour either side unless the label says otherwise
  const MAX_CIRCLE = 3;

  function st(){
    const s = S();
    if (!s.fam || s.fam.v !== 1){
      s.fam = {v:1,
        who:'Mom',
        me:'You',
        meds:[
          {id:uid(), name:'Blood pressure pill (sample)', dose:'1 tablet', times:['08:00'], how:'With breakfast and a full glass of water', why:'Blood pressure'},
          {id:uid(), name:'Metformin (sample)', dose:'1 tablet', times:['08:00','17:30'], how:'With food', why:'Blood sugar'},
          {id:uid(), name:'Eye drops (sample)', dose:'1 drop each eye', times:['09:00','21:00'], how:'Wait 5 minutes between drops', why:'Glaucoma'},
          {id:uid(), name:'Evening memory pill (sample)', dose:'1 tablet', times:['20:00'], how:'', why:'Memory'}
        ],
        log:[], circle:[
          {id:uid(), name:'Sister (sample)', rel:'Sister', role:'helper', how:'Text', invited:today()},
          {id:uid(), name:'Brother (sample)', rel:'Brother', role:'view', how:'Email', invited:today()}
        ],
        tasks:['Check blood sugar before lunch','Walk around the block if the weather allows','Fill the pill box for next week (Sundays)','Check the smoke detector (monthly)'],
        done:{}, sit:{}, alarm:{lead:0, every:10},
        notes:[{id:uid(), by:'Sister (sample)', at:new Date(Date.now()-20*3600e3).toISOString(), eat:'Ate most', sleep:'Slept well', mood:'Calm', text:'Good day. Watched a movie, walked to the mailbox.'}],
        info:{name:'Mom (sample)', dob:'1944-03-12', allergies:'Penicillin (sample)', conditions:'High blood pressure, type 2 diabetes, early memory loss (sample)', doctor:'Dr. Sample, Family Medicine · 555-0100', pharmacy:'Sample Pharmacy · 555-0101', insurance:'Medicare card and supplement card are in the blue folder (sample)', papers:'Health care POA copy in the blue folder and in the car (sample)'},
        appts:[{id:uid(), date:A.addDays(today(), 6), time:'10:30', with:'Dr. Sample (yearly checkup)', bring:'Ask about the new dizziness'}]};
      save();
    }
    return s.fam;
  }
  const isFamily = () => S().tier === 'family';
  const people = () => [st().me].concat(st().circle.filter(p => p.role !== 'view').map(p => p.name));
  const canEdit = name => { const f = st(); if (!name || name === f.me) return true; const p = f.circle.find(x => x.name === name); return !!p && p.role === 'main'; };
  function actor(){ try { const v = sessionStorage.getItem('ss-fam-actor'); if (v && people().includes(v)) return v; } catch(e){} return st().me; }

  // ---------- today's doses ----------
  function doses(){
    const f = st(), t = today(), n = new Date(), nm = n.getHours()*60 + n.getMinutes(), out = [];
    f.meds.forEach(m => m.times.forEach(tm => {
      const e = f.log.find(l => l.med === m.id && l.day === t && l.tm === tm);
      const d = nm - toMin(tm);
      out.push({m, tm, e, state:e ? e.status : d > WINDOW ? 'late' : d >= -WINDOW ? 'due' : 'later'});
    }));
    return out.sort((a, b) => a.tm.localeCompare(b.tm));
  }
  function record(m, tm, status, note){
    const f = st();
    f.log = f.log.filter(l => !(l.med === m.id && l.day === today() && l.tm === tm));
    f.log.push({id:uid(), med:m.id, day:today(), tm, status, note:note||'', by:actor(), at:new Date().toISOString()});
    save(); toast(status === 'given' ? 'Marked as given' : 'Noted');
  }
  const LAB = {given:['Given','calm'], skipped:['Skipped','amber'], refused:['Said no','amber'], late:['Late','red'], due:['Due now','amber'], later:['Later','grey']};

  // ---------- home ----------
  function home(v){
    const f = st();
    v.append(head('Family caregiver · caring for '+f.who+' (sample)', 'What do you need?', null));
    const ds = doses(), now = ds.filter(d => d.state === 'due' || d.state === 'late');
    if (now.length){
      const late = now.some(d => d.state === 'late');
      v.append(h('a',{class:'bigbtn wide '+(late ? 'urgent' : 'info'),href:'#/family/meds',style:'margin-bottom:.9rem'},
        h('span',{class:'ic','aria-hidden':'true'},'💊'), h('b',null,(late ? 'Late: ' : '')+'Medicine time '+clock12(now[0].tm)+' · '+now.filter(d => d.tm === now[0].tm).length+' to give'+(now.some(d => d.tm !== now[0].tm) ? ', more soon' : ''))));
    }
    const left = f.tasks.filter(t => !(f.done[today()]||{})[t]).length;
    const next = ds.find(d => d.state === 'later');
    const B = [
      ['family/meds','💊','Medicines', next ? 'Next: '+clock12(next.tm) : ds.length ? 'All done today' : ''],
      ['family/today','✅','Today\'s tasks', left ? left+' left today' : 'All done'],
      ['family/notes','📝','Daily notes', f.notes.some(n => n.at.slice(0,10) === today()) ? 'Written today' : 'Nothing yet today'],
      ['family/about','📅','Appointments and info', nextAppt() ? 'Next: '+fmtDate(nextAppt().date+'T12:00:00') : 'Birth date, doctors, papers'],
      ['family/log','📖','Medicine log', 'Who gave what, by day'],
      ['family/circle','👪','Family circle', f.circle.length ? f.circle.length+' of '+MAX_CIRCLE+' added' : 'Share with family'],
      ['family/guide','🧭','Your situation', 'Who decides, pay, papers'],
      ['night','📞','Who do I call?', '']
    ];
    v.append(h('div',{class:'biggrid'}, B.map(([href, ic, label, stx]) => h('a',{class:'bigbtn',href:'#/'+href}, h('span',{class:'ic','aria-hidden':'true'},ic), h('b',null,label), stx ? h('span',{class:'st'},stx) : null))));
    const recent = f.log.slice(-3).reverse();
    if (recent.length) v.append(card('soft', h('h3',null,'Latest from the family'), h('ul',{class:'small'}, recent.map(l => { const m = f.meds.find(x => x.id === l.med); return h('li',null, l.by+': '+(m ? m.name : 'medicine')+' '+clock12(l.tm)+' '+(LAB[l.status]||[l.status])[0].toLowerCase()+' · '+fmtTime(l.at)); }))));
  }

  // ---------- area with tabs ----------
  R.family = v => {
    const tab = (A.param && A.param()) || 'meds';
    v.append(head('Family caregiver · '+st().who+' (sample)', {meds:'Medicines and times', log:'Medicine log', today:'Today\'s tasks', notes:'Daily notes', about:'Appointments and info', circle:'Family circle', guide:'Your situation, in plain words'}[tab] || 'Family caregiver', null));
    v.append(h('div',{class:'row',role:'tablist',style:'margin-bottom:.6rem'}, [['meds','💊 Medicines'],['log','📖 Log'],['today','✅ Today'],['notes','📝 Notes'],['about','📅 Info'],['circle','👪 Family'],['guide','🧭 Situation']].map(([k,l]) =>
      h('a',{class:'btn '+(k === tab ? '' : 'quiet ')+'sm',href:'#/family/'+k,role:'tab','aria-selected':String(k === tab)}, l))));
    if (people().length > 1) v.append(whoBar());
    ({meds, log:medLog, today:todayTab, notes, about, circle, guide}[tab] || meds)(v);
  };
  function whoBar(){
    const sel = h('select',{'aria-label':'Who is using this phone'}, people().map(n => h('option',{value:n,selected:n === actor()}, n)));
    sel.addEventListener('change', () => { try { sessionStorage.setItem('ss-fam-actor', sel.value); } catch(e){} A.route(); });
    return h('div',{class:'row small',style:'margin-bottom:.6rem;align-items:center'}, h('span',{class:'muted'},'Who\'s using this phone:'), sel);
  }

  function meds(v){
    const f = st(), ds = doses(), may = canEdit(actor());
    const times = {}; ds.forEach(d => (times[d.tm] = times[d.tm] || []).push(d));
    v.append(card(ds.some(d => d.state === 'late') ? 'warn' : '',
      h('h2',null,'Today'),
      Object.keys(times).length ? h('ul',{class:'medtimes'}, Object.keys(times).map(tm => h('li',null, h('b',{class:'mt-time'},clock12(tm)),
        h('div',{class:'grid',style:'gap:.5rem;flex:1'}, times[tm].map(d => { const l = LAB[d.state] || [d.state,'grey'];
          return h('div',{class:'grid',style:'gap:.3rem'},
            h('div',{class:'row',style:'gap:.4rem;align-items:center'}, chip(l[0], l[1]), h('b',null,d.m.name), h('span',null,d.m.dose)),
            d.m.how ? h('span',{class:'small muted'},d.m.how) : null,
            d.e ? h('span',{class:'small muted'},'By '+d.e.by+' at '+fmtTime(d.e.at)+(d.e.note ? ' · '+d.e.note : '')) : null,
            d.state === 'later' ? null : h('div',{class:'row'},
              h('button',{class:'btn sm',type:'button',onclick:()=>{ record(d.m, d.tm, 'given'); A.route(); }}, d.e ? 'Given' : '✓ Given'),
              h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ const n = prompt('What happened? (optional)') || ''; record(d.m, d.tm, 'refused', n); A.route(); }},'Said no'),
              h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ const n = prompt('Why was it skipped? (optional)') || ''; record(d.m, d.tm, 'skipped', n); A.route(); }},'Skipped'))); }))))) : h('p',{class:'muted'},'No medicine times yet. Add one below.'),
      h('p',{class:'small muted'},'Follow the pharmacy label. If a dose was missed or doubled, call the pharmacist (the number is on the bottle) before the next dose.')));

    v.append(card('soft', h('h2',null,'🔔 Medicine alarm'),
      h('p',{class:'small'},'When it is time, a pop-up shows on this phone with a sound, and comes back every '+f.alarm.every+' minutes until someone marks it. Everyone in the family circle who gives medicines gets it.'),
      h('p',{class:'small'},'The lock screen only says "Medicine time", never the medicine.'),
      soundOn() ? h('p',{class:'small'},'Sound is on for this phone.') : h('button',{class:'btn ghost sm',type:'button',onclick:enableSound},'🔔 Turn on sound and notifications on this phone')));

    const list = card('', h('h2',null,'Medicine list'), may ? null : h('p',{class:'small'},'Only the main caregiver can change this list. Ask them if something looks wrong.'));
    f.meds.forEach(m => {
      const row = h('div',{class:'item'}, h('b',null,m.name+' · '+m.dose), h('span',{class:'small'},'Times: '+m.times.map(clock12).join(', ')+(m.why ? ' · For: '+m.why : '')+(m.how ? ' · '+m.how : '')));
      if (may) row.append(h('div',{class:'row'},
        h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ list.replaceWith(medForm(m)); }},'Change'),
        h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ if (!confirm('Take '+m.name+' off the list? Do this only if the doctor stopped it.')) return; f.meds = f.meds.filter(x => x !== m); save(); toast('Removed'); A.route(); }},'Stopped by the doctor')));
      list.append(row);
    });
    if (may) list.append(h('button',{class:'btn sm',type:'button',onclick:()=>{ list.replaceWith(medForm()); }},'+ Add a medicine'));
    v.append(list);
  }
  function medForm(m){
    const f = st(), edit = !!m;
    const name = h('input',{type:'text',maxlength:'80',value:m ? m.name : '',placeholder:'Name on the bottle','aria-label':'Medicine name',required:true});
    const dose = h('input',{type:'text',maxlength:'60',value:m ? m.dose : '',placeholder:'e.g. 1 tablet, 2 puffs','aria-label':'How much'});
    const why = h('input',{type:'text',maxlength:'60',value:m ? m.why : '',placeholder:'e.g. blood pressure (optional)','aria-label':'What it is for'});
    const how = h('input',{type:'text',maxlength:'120',value:m ? m.how : '',placeholder:'e.g. with food (optional)','aria-label':'How to give it'});
    const tbox = h('div',{class:'row',style:'gap:.4rem'});
    let times = m ? m.times.slice() : [];
    const drawT = () => { tbox.textContent = ''; times.slice().sort().forEach(t => tbox.append(h('span',{class:'chip'}, clock12(t), h('button',{type:'button',class:'linkbtn','aria-label':'Remove '+clock12(t),onclick:()=>{ times = times.filter(x => x !== t); drawT(); }},' ✕')))); };
    drawT();
    const nt = h('input',{type:'time','aria-label':'Add a time',style:'max-width:9rem'});
    const form = h('form',{class:'card grid',style:'gap:.6rem'},
      h('h2',null, edit ? 'Change '+m.name : 'Add a medicine'),
      h('label',{class:'f'},'Medicine', name), h('div',{class:'grid g2'}, h('label',{class:'f'},'How much', dose), h('label',{class:'f'},'What it\'s for', why)),
      h('label',{class:'f'},'How to give it', how),
      h('div',{class:'f'}, h('span',null,'Times of day'), tbox, h('div',{class:'row'}, nt, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ if (nt.value && !times.includes(nt.value)){ times.push(nt.value); drawT(); } }},'Add time'))),
      h('p',{class:'small muted'},'Copy it from the pharmacy label. This list does not replace the label or the doctor\'s instructions.'),
      h('div',{class:'row'}, h('button',{class:'btn',type:'submit'},'Save'), h('button',{class:'btn quiet',type:'button',onclick:()=>A.route()},'Cancel')));
    form.addEventListener('submit', e => { e.preventDefault();
      if (!name.value.trim()) return toast('Add the medicine name');
      if (!times.length) return toast('Add at least one time');
      const x = {name:name.value.trim(), dose:dose.value.trim(), why:why.value.trim(), how:how.value.trim(), times:times.slice().sort()};
      if (edit) Object.assign(m, x); else f.meds.push(Object.assign({id:uid()}, x));
      save(); toast('Saved'); A.route(); });
    return form;
  }

  // ---------- medicine log: its own record, separate from any facility record ----------
  function medLog(v){
    const f = st(), days = [0,1,2,3,4,5,6,7,8,9,10,11,12,13].map(n => A.addDays(today(), -n)).filter(d => d === today() || f.log.some(l => l.day === d));
    if (!f.log.length){ v.append(card('soft', h('p',null,'Nothing logged yet. When anyone in the family marks a medicine as given, said no or skipped, it shows here by day.'))); return; }
    days.forEach(d => {
      const rows = f.log.filter(l => l.day === d).sort((a, b) => a.tm.localeCompare(b.tm));
      const due = d === today() ? doses().filter(x => !x.e && x.state !== 'later') : [];
      v.append(card('', h('h2',null, d === today() ? 'Today' : fmtDate(d+'T12:00:00')),
        h('ul',{class:'medtimes'}, rows.map(l => { const m = f.meds.find(x => x.id === l.med); const lb = LAB[l.status] || [l.status,'grey'];
          return h('li',null, h('b',{class:'mt-time'},clock12(l.tm)), h('div',{class:'grid',style:'gap:.2rem;flex:1'}, h('div',{class:'row',style:'gap:.4rem;align-items:center'}, chip(lb[0], lb[1]), h('span',null,(m ? m.name+' · '+m.dose : 'Medicine no longer on the list'))), h('span',{class:'small muted'},l.by+' at '+fmtTime(l.at)+(l.note ? ' · '+l.note : '')))); }),
          due.map(x => h('li',null, h('b',{class:'mt-time'},clock12(x.tm)), h('div',{class:'row',style:'gap:.4rem;align-items:center'}, chip(LAB[x.state][0], LAB[x.state][1]), h('span',null,x.m.name+' · not marked yet')))))));
    });
    v.append(h('div',{class:'row'}, h('button',{class:'btn ghost sm',type:'button',onclick:()=>{
      const lines = ['MEDICINE LOG: '+f.info.name+' (test data)', ''];
      days.slice().reverse().forEach(d => { lines.push(d); f.log.filter(l => l.day === d).sort((a,b) => a.tm.localeCompare(b.tm)).forEach(l => { const m = f.meds.find(x => x.id === l.med); lines.push('  '+clock12(l.tm)+'  '+(m ? m.name+' '+m.dose : 'medicine')+'  '+l.status+'  by '+l.by+(l.note ? ' ('+l.note+')' : '')); }); });
      copy(lines.join('\n')); toast('Copied. Paste it into an email or bring it to the doctor.'); }},'Copy the log for the doctor'), h('button',{class:'btn ghost sm',type:'button',onclick:()=>window.print()},'Print')));
  }

  // ---------- daily notes: shared by everyone in the family circle ----------
  function notes(v){
    const f = st();
    const pick = (label, opts) => { const sel = h('select',{'aria-label':label}, h('option',{value:''},label), opts.map(o => h('option',null,o))); return sel; };
    const eat = pick('Eating', ['Ate well','Ate most','Ate a little','Did not eat']);
    const sleep = pick('Sleep', ['Slept well','Woke up some','Up a lot at night']);
    const mood = pick('Mood', ['Calm','Happy','Worried','Upset','Confused','Tired']);
    const text = h('textarea',{rows:'3',maxlength:'1000',placeholder:'How was the day? Anything new: pain, falls, confusion, bathroom, skin, visitors.','aria-label':'Note'});
    const form = h('form',{class:'card grid',style:'gap:.6rem'}, h('h2',null,'Write today\'s note'),
      h('div',{class:'grid g3'}, eat, sleep, mood), text,
      h('p',{class:'small muted'},'Everyone in the family circle sees these, with who wrote them and when. Write what you saw and heard.'),
      h('div',{class:'row'}, h('button',{class:'btn',type:'submit'},'Save note')));
    form.addEventListener('submit', e => { e.preventDefault(); if (!text.value.trim() && !eat.value && !sleep.value && !mood.value) return toast('Write a line or pick how they did');
      f.notes.push({id:uid(), by:actor(), at:new Date().toISOString(), eat:eat.value, sleep:sleep.value, mood:mood.value, text:text.value.trim()}); save(); toast('Note saved'); A.route(); });
    v.append(form);
    const list = f.notes.slice().reverse();
    v.append(card('', h('h2',null,'Recent notes'), list.length ? h('div',{class:'list'}, list.slice(0, 30).map(n => h('div',{class:'item'},
      h('div',{class:'meta'}, h('b',null,n.by), h('span',null,fmtDate(n.at)+' '+fmtTime(n.at)), n.eat ? chip(n.eat) : null, n.sleep ? chip(n.sleep) : null, n.mood ? chip(n.mood) : null),
      n.text ? h('span',null,n.text) : null))) : h('p',{class:'muted'},'No notes yet.'),
      list.length ? h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ copy(list.slice(0, 14).reverse().map(n => fmtDate(n.at)+' · '+n.by+': '+[n.eat, n.sleep, n.mood].filter(Boolean).join(', ')+(n.text ? '. '+n.text : '')).join('\n')); toast('Last notes copied for the doctor'); }},'Copy recent notes for the doctor') : null));
  }

  // ---------- about them: birth date and the things appointments ask for ----------
  function nextAppt(){ return st().appts.filter(a => a.date >= today()).sort((a, b) => (a.date+a.time).localeCompare(b.date+b.time))[0]; }
  const ageOf = dob => { const d = new Date(dob+'T12:00:00'), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };
  function about(v){
    const f = st(), i = f.info, may = canEdit(actor());
    const F = [['name','Name'],['dob','Date of birth'],['allergies','Allergies'],['conditions','Health conditions'],['doctor','Main doctor and phone'],['pharmacy','Pharmacy and phone'],['insurance','Insurance cards (where they are)'],['papers','Legal papers (where they are)']];
    const box = card('', h('h2',null,'About '+i.name),
      h('div',{class:'list'}, F.map(([k, l]) => h('div',{class:'item'}, h('span',{class:'small muted'},l), h('b',null, k === 'dob' && i.dob ? fmtDate(i.dob+'T12:00:00')+' (age '+ageOf(i.dob)+')' : (i[k] || '—'))))),
      h('div',{class:'row'}, may ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ box.replaceWith(infoForm(F)); }},'Change') : null,
        h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ copy(apptSheet()); toast('Copied. Show it at the front desk or paste it into a form.'); }},'Copy for the front desk')));
    v.append(box);
    const appts = f.appts.slice().sort((a, b) => (a.date+a.time).localeCompare(b.date+b.time));
    const ac = card('', h('h2',null,'Appointments'),
      appts.length ? h('div',{class:'list'}, appts.map(a => h('div',{class:'item'+(a.date < today() ? ' muted' : '')},
        h('div',{class:'meta'}, chip(fmtDate(a.date+'T12:00:00')+(a.time ? ' · '+clock12(a.time) : ''), a.date === today() ? 'amber' : ''), a.date < today() ? chip('Past','grey') : null),
        h('b',null,a.with), a.bring ? h('span',{class:'small'},'To ask or bring: '+a.bring) : null,
        h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ f.appts = f.appts.filter(x => x !== a); save(); A.route(); }},'Remove'))))) : h('p',{class:'muted'},'No appointments yet.'));
    const d = h('input',{type:'date','aria-label':'Appointment date',value:A.addDays(today(), 7)}), t = h('input',{type:'time','aria-label':'Appointment time'});
    const w = h('input',{type:'text',maxlength:'80',placeholder:'Who with, e.g. Dr. Sample, eye doctor','aria-label':'Who with'});
    const b = h('input',{type:'text',maxlength:'160',placeholder:'Questions to ask, things to bring (optional)','aria-label':'Questions or things to bring'});
    ac.append(h('div',{class:'grid',style:'gap:.5rem;margin-top:.6rem'}, h('div',{class:'grid g2'}, d, t), w, b, h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ if (!d.value || !w.value.trim()) return toast('Add the date and who it\'s with'); f.appts.push({id:uid(), date:d.value, time:t.value, with:w.value.trim(), bring:b.value.trim()}); save(); toast('Appointment added'); A.route(); }},'Add appointment'))));
    v.append(ac);
    v.append(card('soft', h('h3',null,'What to bring to every appointment'), h('ul',{class:'small'},
      h('li',null,'Their date of birth (every office asks first), insurance cards and photo ID.'),
      h('li',null,'The medicine list, including vitamins and anything taken as needed. "Copy for the front desk" above includes it.'),
      h('li',null,'The last two weeks of daily notes, and your written questions.'),
      h('li',null,'A copy of the power of attorney or guardianship papers if you speak for them.'))));
  }
  function infoForm(F){
    const f = st(), i = f.info, inputs = {};
    const form = h('form',{class:'card grid',style:'gap:.6rem'}, h('h2',null,'Change their information'),
      F.map(([k, l]) => { inputs[k] = h('input',{type:k === 'dob' ? 'date' : 'text',maxlength:'160',value:i[k]||'','aria-label':l}); return h('label',{class:'f'}, l, inputs[k]); }),
      h('p',{class:'small muted'},'Test version: please keep using made-up details.'),
      h('div',{class:'row'}, h('button',{class:'btn',type:'submit'},'Save'), h('button',{class:'btn quiet',type:'button',onclick:()=>A.route()},'Cancel')));
    form.addEventListener('submit', e => { e.preventDefault(); F.forEach(([k]) => i[k] = inputs[k].value.trim()); save(); toast('Saved'); A.route(); });
    return form;
  }
  function apptSheet(){
    const f = st(), i = f.info;
    return [i.name, 'Date of birth: '+(i.dob ? fmtDate(i.dob+'T12:00:00') : '—'), 'Allergies: '+(i.allergies||'—'), 'Conditions: '+(i.conditions||'—'), 'Doctor: '+(i.doctor||'—'), 'Pharmacy: '+(i.pharmacy||'—'), '', 'Medicines:']
      .concat(f.meds.map(m => '  '+m.name+' · '+m.dose+' · '+m.times.map(clock12).join(', ')+(m.why ? ' · for '+m.why : ''))).concat(['', '(Test data)']).join('\n');
  }

  function todayTab(v){
    const f = st(), t = today(); f.done[t] = f.done[t] || {};
    const ul = h('ul',{class:'tourlist tasks'});
    f.tasks.forEach((x, i) => {
      const id = 'ft-'+i, d = f.done[t][x];
      const cb = h('input',{type:'checkbox',id,checked:!!d});
      cb.addEventListener('change', () => { if (cb.checked) f.done[t][x] = {by:actor(), at:new Date().toISOString()}; else delete f.done[t][x]; save(); A.route(); });
      ul.append(h('li',null, cb, h('label',{for:id,class:d ? 'done' : ''}, x, d ? h('span',{class:'small muted'},' · '+d.by+' '+fmtTime(d.at)) : null)));
    });
    const add = h('input',{type:'text',maxlength:'100',placeholder:'Add a task for every day','aria-label':'New task'});
    v.append(card('', h('h2',null,'Every day'), ul,
      h('div',{class:'row'}, add, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ const x = add.value.trim(); if (!x) return; f.tasks.push(x); save(); A.route(); }},'Add'))));
    v.append(card('soft', h('h3',null,'Keep a short daily note'), h('p',{class:'small'},'A line or two a day (how they ate, slept, moods, falls, new pain) helps the doctor and anyone who helps you. Bring the last two weeks to appointments.'),
      h('a',{class:'btn ghost sm',href:'#/handoff'},'Make a hand-off sheet')));
  }

  function circle(v){
    const f = st(), mine = canEdit(actor());
    v.append(card('soft', h('p',null,'Share the medicine list, alarms and tasks with up to '+MAX_CIRCLE+' more family members or friends. Everyone sees who gave what and when, so no one doubles a dose.'),
      h('ul',{class:'small'}, h('li',null,h('b',null,'Main caregiver: '),'can change the medicine list and times.'), h('li',null,h('b',null,'Helper: '),'gets the alarm and marks medicines and tasks.'), h('li',null,h('b',null,'View only: '),'sees the day, gets no alarm. Good for family far away.'))));
    const list = card('', h('h2',null,'Your circle'), h('div',{class:'item'}, h('b',null,f.me+' (main caregiver)'), h('span',{class:'small muted'},'This phone')));
    const ROLE = {main:'Main caregiver', helper:'Helper', view:'View only'};
    f.circle.forEach(p => {
      const sel = h('select',{'aria-label':'Role for '+p.name, disabled:!mine}, Object.keys(ROLE).map(k => h('option',{value:k,selected:k === p.role}, ROLE[k])));
      sel.addEventListener('change', () => { p.role = sel.value; save(); toast('Saved'); });
      list.append(h('div',{class:'item'}, h('b',null,p.name+(p.rel ? ' · '+p.rel : '')), h('div',{class:'row'}, sel,
        h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ copy(inviteText(p)); toast('Invite copied. Paste it into a text or email.'); }},'Copy invite'),
        mine ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ if (!confirm('Remove '+p.name+' from the circle?')) return; f.circle = f.circle.filter(x => x !== p); save(); A.route(); }},'Remove') : null),
        h('span',{class:'small muted'},'Invited '+fmtDate(p.invited+'T12:00:00')+' · '+p.how)));
    });
    v.append(list);
    if (mine && f.circle.length < MAX_CIRCLE){
      const name = h('input',{type:'text',maxlength:'40',placeholder:'First name','aria-label':'Their first name'});
      const rel = h('input',{type:'text',maxlength:'30',placeholder:'e.g. daughter, neighbor','aria-label':'How they\'re related'});
      const role = h('select',{'aria-label':'Their role'}, Object.keys(ROLE).map(k => h('option',{value:k,selected:k === 'helper'}, ROLE[k])));
      const how = h('select',{'aria-label':'How to invite'}, ['Text','Email','Show them this phone'].map(x => h('option',null,x)));
      const form = h('form',{class:'card grid',style:'gap:.6rem'}, h('h2',null,'Add someone ('+(MAX_CIRCLE - f.circle.length)+' spot'+(MAX_CIRCLE - f.circle.length === 1 ? '' : 's')+' left)'),
        h('div',{class:'grid g2'}, h('label',{class:'f'},'First name', name), h('label',{class:'f'},'Relationship', rel)),
        h('div',{class:'grid g2'}, h('label',{class:'f'},'Role', role), h('label',{class:'f'},'Invite by', how)),
        h('div',{class:'row'}, h('button',{class:'btn',type:'submit'},'Add and copy invite')));
      form.addEventListener('submit', e => { e.preventDefault(); if (!name.value.trim()) return toast('Add their first name');
        const p = {id:uid(), name:name.value.trim(), rel:rel.value.trim(), role:role.value, how:how.value, invited:today()};
        f.circle.push(p); save(); copy(inviteText(p)); toast('Added. The invite is copied, ready to paste.'); A.route(); });
      v.append(form);
    } else if (f.circle.length >= MAX_CIRCLE) v.append(h('p',{class:'small muted'},'The circle is full ('+MAX_CIRCLE+' plus you). Remove someone to add another.'));
    v.append(h('p',{class:'small muted'},'Test version: invites are a message for you to send yourself, and everything stays on this phone. In the real app each person signs in on their own phone and sees the same day.'));
  }
  function inviteText(p){
    return 'Hi '+p.name+', I\'m using Steady Shift to keep track of '+st().who+'\'s medicines and care. I added you as '+({main:'a main caregiver', helper:'a helper', view:'view only'}[p.role])+' so we can see who gave what and when. (Test version, sample data only.)';
  }

  // ---------- your situation: plain-language guide, by legal situation ----------
  const Q = [
    ['decide','Who makes health decisions for them?', [['self','They still decide for themselves'],['poa','I or someone else is health care power of attorney (activated)'],['guardian','A court named a guardian'],['unsure','Not sure']]],
    ['money','Who handles their money?', [['self','They do'],['poafin','Someone is financial power of attorney'],['payee','Someone is Social Security rep payee'],['guardian','A court-named guardian of the estate'],['unsure','Not sure']]],
    ['pay','Are you paid to care for them?', [['no','No, unpaid'],['iris','Yes, through IRIS (self-directed)'],['fc','Yes, through Family Care'],['private','Yes, the family pays me'],['want','No, but I want to look into it']]],
    ['live','Where do they live?', [['mine','With me'],['own','In their own home'],['other','Somewhere else']]]
  ];
  function guide(v){
    const f = st(), s = f.sit;
    const form = card('', h('h2',null,'Tell us your situation'), h('p',{class:'small muted'},'Four questions. The guide below changes with your answers. Nothing here is sent anywhere.'));
    Q.forEach(([k, q, opts]) => {
      const sel = h('select',{'aria-label':q}, h('option',{value:''},'Pick one'), opts.map(([val, lab]) => h('option',{value:val,selected:s[k] === val}, lab)));
      sel.addEventListener('change', () => { s[k] = sel.value; save(); A.route(); });
      form.append(h('label',{class:'f'}, q, sel));
    });
    v.append(form);
    plainGuide(s).forEach(c => v.append(c));
    v.append(card('soft', h('h3',null,'Free help in Wisconsin'),
      h('ul',{class:'small'},
        h('li',null,h('b',null,'Aging and Disability Resource Center (ADRC): '),'free, unbiased help for older adults, people with disabilities and their families. Start here for programs, respite and paperwork.'),
        h('li',null,h('b',null,'Respite: '),'short breaks for you. Ask the ADRC about respite and the caregiver support program in your county.'),
        h('li',null,h('b',null,'Elder benefit specialists and disability benefit specialists: '),'free help with Medicare, Medicaid and benefit problems, through the ADRC.'),
        h('li',null,h('b',null,'Pharmacist: '),'free and often the fastest answer for any medicine question.')),
      h('p',{class:'foot'},'Plain-language summary for families, checked November 2026. Not legal or medical advice. For a legal question about guardianship or power of attorney, talk to a lawyer or your county\'s ADRC.')));
  }
  function plainGuide(s){
    const out = [];
    const D = {
      self:['They decide for themselves','Even with memory changes, a person makes their own health choices until a doctor finds them unable to, or a court names a guardian. Your job is to help them understand and to speak up for what they want.','Good time now: help them fill out a Wisconsin health care power of attorney and a financial power of attorney while they can. The forms are free from the state and need witnesses.'],
      poa:['Health care power of attorney','In Wisconsin it usually starts only after two doctors (or a doctor and a psychologist) find the person unable to decide, and it is written in their chart. Until then they still decide.','Keep a copy of the signed form and the activation letter in this app\'s hand-off sheet and in the car. Hospitals will ask for it.'],
      guardian:['Court-named guardian','The guardian makes the decisions the court order lists, and must still consider what the person wants. Some guardian decisions need the court\'s OK first.','Keep a copy of the court order (letters of guardianship) handy. If you are the guardian, the court will ask for a yearly report.'],
      unsure:['Not sure who decides?','Ask the doctor\'s office what is on file, and look for any signed power of attorney papers at home. The ADRC can explain the options for free.','If no papers exist and the person can still sign, a health care power of attorney is the simplest way to plan ahead.']
    };
    const d = D[s.decide];
    if (d) out.push(card('', h('h2',null,'🧭 '+d[0]), h('p',null,d[1]), h('p',{class:'small'},d[2])));
    const P = {
      no:['Caring without pay','You can still get help: respite, a caregiver support program, and equipment loans through the ADRC. If care is more than you can do, ask the ADRC about a long-term care screen.'],
      iris:['Paid through IRIS','IRIS lets the person choose and pay their own workers, including family. Pay goes through a fiscal agent (in Wisconsin: GT Independence, iLIFE or Premier). You need a background check before you can be paid, and personal care shifts are usually checked in and out with an app called Sandata (EVV). Live-in caregivers are usually exempt from EVV for personal care, so ask your IRIS consultant.'],
      fc:['Paid through Family Care','Family Care members can use self-directed supports to hire family. You\'ll need a background check, and personal care is usually checked in and out with Sandata (EVV). Ask the care team which of your hours count.'],
      private:['Paid by the family','Write a simple caregiver agreement (hours, duties, pay) and keep time records. This matters if the person ever applies for Medicaid, because unexplained payments to family can look like gifts. A lawyer or the ADRC can point you to a sample agreement.'],
      want:['Looking into getting paid','In Wisconsin, family can often be paid through IRIS or Family Care self-directed supports once the person qualifies for long-term care. Wisconsin does not offer a "structured family caregiving" program. Start with a call to your ADRC and ask for a long-term care functional screen.']
    };
    const p = P[s.pay];
    if (p) out.push(card('', h('h2',null,'💵 '+p[0]), h('p',null,p[1])));
    const M = {poafin:'The financial power of attorney pays bills and handles accounts for them, and must keep their money separate and keep records.', payee:'A rep payee manages only the Social Security or SSI payment, must spend it on the person\'s needs, and reports to Social Security.', guardian:'A guardian of the estate manages money under court rules and files an accounting.', self:'If they still manage money, watch for scams and missed bills. A trusted contact on their bank account is an easy safety step.'};
    if (M[s.money]) out.push(card('', h('h2',null,'🏦 Money'), h('p',null,M[s.money])));
    if (s.live) out.push(card('soft', h('h2',null,'🏠 Safety at home'), h('ul',{class:'small'},
      h('li',null,'Fall check: night lights, grab bars, no loose rugs, a clear path to the bathroom.'),
      h('li',null,'Keep a list of medicines, allergies, doctors and papers on the fridge for EMTs.'),
      s.live === 'own' ? h('li',null,'Living alone: plan a daily check-in call, and consider a medical alert button.') : null,
      h('li',null,'Medicines in one place, in a weekly pill box, filled by one person.'))));
    out.push(card('soft', h('h2',null,'📞 Who to call'), h('ul',null,
      h('li',null,h('b',null,'911: '),'trouble breathing, chest pain, signs of a stroke (face droop, arm weakness, speech), a fall with a hurt head or can\'t get up, not waking up.'),
      h('li',null,h('b',null,'Doctor\'s nurse line (24 hours on most clinics): '),'new fever, new confusion, not eating or drinking for a day, a new rash after a new medicine.'),
      h('li',null,h('b',null,'Pharmacist: '),'missed or doubled dose, side effects, can these be taken together.'),
      h('li',null,h('b',null,'Next visit: '),'slow changes, questions about the plan. Write them down as they come up.'))));
    if (!out.length || !s.decide) out.unshift(card('soft', h('p',null,'Answer the questions above and this page fills in with what applies to you: who decides, how pay works, and which papers to keep.')));
    return out;
  }

  // ---------- alarm ----------
  const soundOn = () => { try { return !!(window.SSAlerts && SSAlerts.st().sound); } catch(e){ return false; } };
  async function enableSound(){
    try { if (window.SSAlerts){ SSAlerts.st().sound = true; save(); } } catch(e){}
    chime();
    try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch(e){}
    toast('Medicine alarms will sound on this phone'); A.route();
  }
  let actx = null;
  function chime(){ try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); [0,.3,.6].forEach((t,i) => { const g = actx.createGain(), o = actx.createOscillator(); o.frequency.value = i === 1 ? 660 : 880; g.gain.value = .15; o.connect(g); g.connect(actx.destination); o.start(actx.currentTime+t); o.stop(actx.currentTime+t+.18); }); } catch(e){} }
  const snz = () => { try { return JSON.parse(sessionStorage.getItem('ss-famalarm')||'{}'); } catch(e){ return {}; } };
  const setSnz = o => { try { sessionStorage.setItem('ss-famalarm', JSON.stringify(o)); } catch(e){} };
  function tick(){
    const box = document.getElementById('ssFamAlarm');
    if (!isFamily() || document.getElementById('ssMedAlarm')){ if (box) box.remove(); return; }
    const me = actor(), f = st();
    const p = f.circle.find(x => x.name === me); if (p && p.role === 'view'){ if (box) box.remove(); return; }
    const n = new Date(), nm = n.getHours()*60 + n.getMinutes(), lead = f.alarm.lead || 0;
    const due = doses().filter(d => !d.e && nm >= toMin(d.tm) - lead && nm <= toMin(d.tm) + 120);
    if (!due.length){ if (box) box.remove(); return; }
    if (box) return;
    const o = snz(), k = due[0].tm; if (o[today()+k] > Date.now()) return;
    const list = due.filter(d => d.tm === k), late = list.some(d => d.state === 'late');
    const close = mins => { const x = snz(); x[today()+k] = Date.now() + mins*60000; setSnz(x); el.remove(); };
    const el = h('div',{id:'ssFamAlarm',class:'medalarm',role:'alertdialog','aria-modal':'true','aria-labelledby':'ssFamAlarmT'},
      h('div',{class:'medalarm-card'+(late ? ' late' : '')}, h('div',{class:'ic','aria-hidden':'true'},'💊'),
        h('h2',{id:'ssFamAlarmT'}, (late ? 'Late: ' : '')+'Medicine time '+clock12(k)),
        h('ul',null, list.map(d => h('li',null, h('b',null,d.m.name), ' · '+d.m.dose+(d.m.how ? ' · '+d.m.how : '')))),
        h('div',{class:'medalarm-btns'},
          h('button',{class:'btn',type:'button',onclick:()=>{ list.forEach(d => record(d.m, d.tm, 'given')); el.remove(); A.route(); }},'✓ Given'),
          h('a',{class:'btn ghost',href:'#/family/meds',onclick:()=>close(f.alarm.every)},'Open the list'),
          h('button',{class:'btn quiet',type:'button',onclick:()=>close(5)},'Remind me in 5 minutes')),
        soundOn() ? null : h('button',{class:'linkbtn small',type:'button',onclick:enableSound},'Turn on sound for these alarms')));
    document.body.append(el);
    const b = el.querySelector('.btn'); if (b) b.focus();
    if (soundOn()){
      chime(); try { navigator.vibrate && navigator.vibrate([300,150,300,150,300]); } catch(e){}
      if (document.visibilityState !== 'visible') try { if ('Notification' in window && Notification.permission === 'granted'){
        const opt = {body:'Open Steady Shift.', tag:'ss-fam-'+k, renotify:true, requireInteraction:true, icon:'icons/icon-192.png'};
        if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(r => r.showNotification('Medicine time', opt)).catch(() => new Notification('Medicine time', opt)); else new Notification('Medicine time', opt);
      } } catch(e){}
    }
  }
  setInterval(tick, 20000); setTimeout(tick, 1500);
  window.addEventListener('hashchange', () => setTimeout(tick, 300));

  VIEWS.family = {t:'Caring for family', ic:'👪'};
  if (NAV.family) NAV.family.splice(0, NAV.family.length, 'home', 'family', 'night', 'handoff', 'behavior');
  window.SSFamily = {home, st, doses, tick};
})();
