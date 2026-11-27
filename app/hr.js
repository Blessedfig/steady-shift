// Steady Shift test app: Employee files (HR). One file per staff member: compliance records with expirations, a separate
// restricted medical file, write-ups with acknowledgment and the employee's response, reviews, raises and promotions (tied to
// the owner's Labor and pay view), an opt-in development profile, a "character sheet" with manager notes, onboarding and
// offboarding, time off, documents, birthdays and milestones, individual insights, Wisconsin inspection rights (Wis. Stat. 103.13),
// record retention and an access log of every view. Sample staff only; everything stays in this browser.
(function(){
  const A = window.SSApp, H = window.SS_HR;
  if (!A || !H) return;
  const {D, h, save, toast, head, R, VIEWS, NAV, uid, fmtDate, fmtTime, tier, download, csvCell} = A;
  const S = () => A.state();
  const X = () => window.SSSched;
  const ap = (el, ...k) => { el.append(...k.flat(9).filter(x => x != null && x !== false)); return el; };
  const chip = (t, cls) => h('span',{class:'chip'+(cls?' '+cls:'')}, t);
  const card = (cls, ...k) => h('div',{class:'card'+(cls?' '+cls:'')}, ...k);
  const field = (label, el) => { el.id = el.id || 'hr'+uid(); return h('label',{class:'f',for:el.id}, label, el); };
  const sel = (opts, val) => h('select',null, opts.map(o => Array.isArray(o) ? h('option',{value:o[0], selected:String(o[0])===String(val)}, o[1]) : h('option',{selected:o===val}, o)));
  const inp = (val, attrs) => h('input', Object.assign({type:'text', value:val==null?'':String(val), maxlength:'200'}, attrs||{}));
  const area = (val, attrs) => { const t = h('textarea', Object.assign({rows:'3', maxlength:'3000'}, attrs||{})); t.value = val||''; return t; };
  const pad = n => String(n).padStart(2,'0');
  const iso = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const today = () => iso(new Date());
  const addMonths = (s, m) => { const d = new Date(s+'T12:00:00'); d.setMonth(d.getMonth()+m); return iso(d); };
  const addDays = (s, n) => { const d = new Date(s+'T12:00:00'); d.setDate(d.getDate()+n); return iso(d); };
  const daysTo = s => Math.round((new Date(s+'T12:00:00') - new Date(today()+'T12:00:00'))/864e5);
  const SITES = ['maple','birch','cedar'];
  const siteName = sid => (D.SITES.find(x => x.id === sid)||{}).name || sid;
  const settingOf = sid => (D.SITES.find(x => x.id === sid)||{}).setting || 'afh';
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const mdText = md => { if (!md) return ''; const [m,d] = md.split('-').map(Number); return MONTHS[m-1]+' '+d; };
  const $2 = n => '$'+(Math.round(n*100)/100).toFixed(2);
  const src = id => H.SRC[id] ? h('a',{href:H.SRC[id].u,target:'_blank',rel:'noopener'}, H.SRC[id].t) : null;
  const initials = n => n.replace(/^Caregiver /,'').split(/\s+/).map(w => w[0]).join('').slice(0,2).toUpperCase();

  // ---------- who is looking ----------
  const T = () => S().tier;
  const isOwner = () => ['owner','multi'].includes(T());
  const isMgr = () => T() === 'manager';
  const isBoss = () => isOwner() || isMgr();
  const me = () => { try { if (X() && X().me) return X().me(); } catch(e){} return tier().name; };
  const actor = () => { try { if (X() && X().actor) return X().actor(); } catch(e){} return tier().name; };
  const staffOf = sid => (S().staff[sid]||[]).map(p => p.n);
  const rec = (sid, n) => (S().staff[sid]||[]).find(p => p.n === n);
  const siteOf = n => { const p = st().people[n]; return p ? p.site : SITES.find(s => staffOf(s).includes(n)); };

  // ---------- state ----------
  function st(){
    const s = S();
    if (!s.hr || s.hr.v !== 1){ s.hr = seed(); save(); applyPay(s.hr); }
    // people added later (by the scheduler or a new hire) get a file too
    SITES.forEach(sid => staffOf(sid).forEach((n, i) => { if (!s.hr.people[n]) { addPerson(s.hr, sid, n, i); save(); } }));
    return s.hr;
  }
  function cfg(sid){ const c = st(); c.settings[sid] = Object.assign({medAccess:'owner', mgrPay:false, remindBday:true, remindAnniv:true, teamCelebrate:true, ptoRate:1, ptoPer:30, ptoCap:80}, c.settings[sid]||{}); return c.settings[sid]; }
  function seed(){
    const c = {v:1, people:{}, items:{}, medical:{}, writeups:[], reviews:[], pay:[], notes:[], kudos:[], pto:{}, docs:[], onb:{}, inspect:[], statements:[], log:[], settings:{}, resDates:JSON.parse(JSON.stringify(H.RES_DATES))};
    const t = today();
    SITES.forEach(sid => staffOf(sid).forEach((n, i) => addPerson(c, sid, n, i)));
    c.medical['Caregiver K'].accom.push({date:'2026-03-02', what:'No lifting over 35 lb without a helper or lift (sample)', until:'2026-12-31', by:'Owner', note:'From a provider note kept here. Staff only need to know: "use the lift or a second helper."'});
    // sample write-up (behavior-based), acknowledged with a response
    c.writeups.push({id:'w1', site:'maple', who:'Caregiver C', step:'coach', date:addDays(t, -20), by:'Manager', at:addDays(t, -20)+'T15:00:00',
      facts:'Clocked in after the 6:00 PM shift start on Oct 28 (6:22), Nov 2 (6:18) and Nov 4 (6:25). The day caregiver stayed late each time to cover.',
      expect:'Be clocked in and ready for hand-off at 6:00 PM. If running late, call the manager before 5:30 PM.', impact:'The day caregiver went into overtime and the hand-off was rushed.',
      support:'Talked about the bus schedule. Offered a 6:30 PM start on Tuesdays as a trial.', follow:addDays(t, 10), status:'Given',
      ack:{at:addDays(t, -19)+'T18:05:00'}, response:'The bus changed its times in October. The 6:30 Tuesday start would help a lot. Thank you for asking.', responseAt:addDays(t, -19)+'T18:07:00'});
    // review, with a raise the manager proposed for the owner to decide
    c.reviews.push({id:'r1', site:'maple', who:'Caregiver B', period:'2025 to 2026', date:addDays(t, -9), by:'Manager', status:'Shared',
      scores:{care:4, safety:4, team:5, reliable:4, doc:3, growth:5},
      examples:'Trained Caregiver A on transfers and the night routine. Caught the change in M-3\'s blood sugar pattern on Oct 12 and called the nurse. Charting is sometimes finished after the shift ends.',
      goals:'Lead the Saturday shift twice a month. Finish charting before clock-out. Take the medication refresher in January.', self:'I want to lead more and learn more about diabetes care.', empComment:'', ack:null});
    c.pay.push({id:'p1', site:'maple', who:'Caregiver B', kind:'Raise', from:19, to:20, role:'', eff:addDays(t, 6), reason:'Annual review (see review 2025 to 2026). Training new staff.', by:'Manager', at:addDays(t, -9)+'T10:00:00', status:'Proposed'});
    c.pay.push({id:'p0', site:'birch', who:'Caregiver F', kind:'Promotion', from:18, to:19, role:'Lead caregiver', eff:'2025-03-01', reason:'Promoted to lead caregiver.', by:'House manager', at:'2025-02-20T10:00:00', status:'Approved', decidedBy:'Owner', decidedAt:'2025-02-21T09:00:00'});
    c.kudos.push({id:'k1', site:'maple', to:'Caregiver A', from:'Caregiver B', text:'Stayed calm and kind with Walt during sundowning on Saturday. He sat down for supper.', at:addDays(t, -4)+'T20:00:00', team:true});
    c.kudos.push({id:'k2', site:'maple', to:'Caregiver E', from:'Manager', text:'Picked up a night shift on short notice so Caregiver D could be with family.', at:addDays(t, -12)+'T09:00:00', team:true});
    c.kudos.push({id:'k3', site:'birch', to:'Caregiver G', from:'Caregiver F', text:'Made the hallway walk part of the evening routine. Fewer falls this month.', at:addDays(t, -6)+'T19:00:00', team:true});
    c.notes.push({id:'n1', site:'maple', who:'Caregiver A', kind:'Observation', text:'Completed the first solo night shift on Nov 14. All checks charted on time.', by:'Manager', at:addDays(t, -13)+'T08:00:00'});
    c.notes.push({id:'n2', site:'maple', who:'Caregiver B', kind:'Planning (not shown to the employee)', text:'Consider for a lead caregiver role at Cedar Lane if it opens in spring.', by:'Owner', at:addDays(t, -30)+'T08:00:00'});
    c.docs.push({id:'d1', who:'Caregiver B', area:'personnel', kind:'Signed job description', name:'Job description, lead caregiver (sample).pdf', at:'2021-04-05T09:00:00', by:'Manager'});
    c.docs.push({id:'d2', who:'Caregiver B', area:'medical', kind:'Health screening', name:'TB screening (sample).pdf', at:'2021-03-06T09:00:00', by:'Manager'});
    c.docs.push({id:'d3', who:'Caregiver B', area:'i9', kind:'Form I-9', name:'I-9 (sample).pdf', at:'2021-04-05T09:00:00', by:'Manager'});
    c.inspect.push({id:'i1', site:'birch', who:'Caregiver G', at:addDays(t, -2)+'T12:00:00', due:workdays(addDays(t, -2), 7), status:'Requested', note:'Would like to see training records and the last review.'});
    return c;
  }
  function addPerson(c, sid, n, i){
    const t = today();
      const smp = H.SAMPLE[n] || {hire:'2024-01-01', role:'Caregiver', bday:'', share:{bday:'manager', anniv:'manager'}, pref:{shifts:'Any', contact:'Text', max:40, notes:''}};
      const prof = (D.SCHED.profiles||{})[n] || {};
      c.people[n] = Object.assign({site:sid, status:'Active', end:null, legalHold:false, strengths:[], style:{}, devShare:false, devOn:!!smp.style || !!(smp.strengths||[]).length}, JSON.parse(JSON.stringify(smp)), {site:sid});
      const r = rec(sid, n) || {};
      const hire = c.people[n].hire, isNew = daysTo(addMonths(hire, 6)) > 0;
      const it = c.items[n] = {};
      const done = (id, date, extra) => { it[id] = Object.assign({date, by:'Manager', note:''}, extra||{}); };
      if (r.bg) done('bg', r.bg); else done('bg', hire);
      done('tb', addDays(hire, -30));
      if (n !== 'Caregiver H') { done('i9', hire); done('w4', hire); done('jd', hire); }
      else { done('w4', hire); }
      if (prof.alone !== false) done('orient', addDays(hire, 7));
      done('cpr', n === 'Caregiver C' ? addMonths(t, -23) : n === 'Caregiver K' ? addMonths(t, -25) : addMonths(t, -((i*5)%20) - 2));
      if (prof.meds) done('meds', addDays(hire, 30));
      done('fire', n === 'Caregiver G' ? addMonths(t, -13) : addMonths(t, -((i*3)%10) - 1));
      if (!isNew || n === 'Caregiver A') done('bbp', addMonths(t, -((i*2)%11) - 1));
      if (sid === 'birch' && n !== 'Caregiver H') done('dementia', addDays(hire, 60));
      if (prof.licensed){ done('cna', addMonths(t, -8), {note:prof.licensed+' license verified on the state lookup'}); }
      else it.cna = {na:true};
      it.drive = (n === 'Caregiver B' || n === 'Caregiver F') ? {date:addMonths(t, -3), by:'Manager', note:'Drives residents to appointments'} : {na:true};
      c.medical[n] = {tb:{date:addDays(hire, -30), type:'Two-step skin test (sample)', result:'Negative (sample)', by:'Sample Clinic RN', note:''}, accom:[], exposures:[]};
      c.pto[n] = [{date:addMonths(t, -2), hrs:prof.pto||0, kind:'Balance carried in', note:'Starting balance (sample)'}];
      c.onb[n] = {};
      if (n !== 'Caregiver H') ONB.forEach(o => { c.onb[n][o.id] = hire; });
      else ONB.slice(0,4).forEach(o => { c.onb[n][o.id] = hire; });
  }
  function workdays(from, n){ let d = from, k = 0; while (k < n){ d = addDays(d, 1); const w = new Date(d+'T12:00:00').getDay(); if (w !== 0 && w !== 6) k++; } return d; }

  const ONB = [
    {id:'offer', t:'Offer letter signed', phase:'Before day one'},
    {id:'bgc', t:'Background check started (BID form) and cleared before working with residents', phase:'Before day one'},
    {id:'tbs', t:'Health screening with TB done within 90 days before starting', phase:'Before day one'},
    {id:'tax', t:'W-4, WT-4 and direct deposit form', phase:'Day one'},
    {id:'i9a', t:'I-9 section 1 on day one, section 2 within 3 business days', phase:'Day one'},
    {id:'tour', t:'House tour: exits, fire plan, first aid kit, where policies are kept', phase:'Day one'},
    {id:'rights', t:'Resident rights, abuse and neglect reporting, and the grievance process', phase:'First week'},
    {id:'shadow', t:'Shadow shifts with a lead caregiver', phase:'First week'},
    {id:'app', t:'Steady Shift sign-in, clock-in PIN and phone rules', phase:'First week'},
    {id:'meds1', t:'Medication training (if they will pass meds)', phase:'First month'},
    {id:'check30', t:'30-day check-in with the manager', phase:'First month'},
    {id:'check90', t:'90-day check-in and training plan', phase:'First 90 days'}
  ];
  const OFFB = [
    {id:'date', t:'Last day and reason recorded (factual, no opinions)'},
    {id:'pay', t:'Final pay on time (Wisconsin: by the next regular payday) and PTO handled per your written policy'},
    {id:'keys', t:'Keys, badges and house tablet PIN collected or turned off'},
    {id:'access', t:'Steady Shift sign-in and shared access removed'},
    {id:'exit', t:'Optional exit conversation offered'},
    {id:'ref', t:'Reference policy noted (what the home will confirm)'},
    {id:'retain', t:'Retention dates set for the file, medical file and I-9'}
  ];

  // ---------- pay changes reach the owner's Labor and pay view ----------
  function applyPay(c){
    c = c || st();
    c.pay.filter(p => p.status === 'Approved' && p.eff <= today()).sort((a,b) => a.eff < b.eff ? -1 : 1).forEach(p => {
      const pr = D.SCHED.profiles[p.who] = D.SCHED.profiles[p.who] || {alone:true, meds:false, rate:18, pto:0};
      pr.rate = p.to; if (p.role === 'Lead caregiver') pr.lead = true;
      if (p.role && c.people[p.who]) c.people[p.who].role = p.role;
    });
  }
  const rateOf = n => ((D.SCHED.profiles||{})[n]||{}).rate;

  // ---------- access rules ----------
  // part: file, medical, pay, dev, planning
  function canSee(n, part){
    const t = T(), mine = n === me();
    if (t === 'family') return false;
    if (part === 'planning') return isBoss() && !mine;
    if (mine) return true;
    if (isOwner()) return part !== 'dev' || !!st().people[n].devShare;
    if (isMgr()){
      const sid = siteOf(n); if (sid !== S().site) return false;
      if (part === 'medical') return cfg(sid).medAccess === 'owner+manager';
      if (part === 'pay') return cfg(sid).mgrPay;
      if (part === 'dev') return !!st().people[n].devShare;
      return true;
    }
    return false;
  }
  function visiblePeople(){
    if (isOwner()) return (T() === 'multi' ? SITES : [S().site]).flatMap(sid => staffOf(sid));
    if (isMgr()) return staffOf(S().site);
    return staffOf(S().site).includes(me()) ? [me()] : [];
  }
  let lastLog = '';
  const MEDOPEN = {};  // medical file unlocked for this page visit only, never saved
  function logView(n, part){
    const key = n+'|'+part+'|'+T();
    if (key === lastLog) return; lastLog = key;
    const c = st(); c.log.unshift({at:new Date().toISOString(), who:actor(), tier:tier().name, file:n, part, site:siteOf(n)});
    if (c.log.length > 600) c.log.length = 600; save();
  }

  // ---------- compliance status ----------
  function reqsFor(n){ const sid = siteOf(n); return H.REQ.filter(r => r.settings.includes(settingOf(sid))); }
  function itemState(n, r){
    const x = (st().items[n]||{})[r.id];
    if (x && x.na) return {s:'na', label:'Does not apply', cls:'grey'};
    if (!x || !x.date) return {s:'missing', label:'Missing', cls:'red'};
    if (!r.months) return {s:'ok', label:'On file '+fmtDate(x.date), cls:'calm', date:x.date};
    const due = addMonths(x.date, r.months), d = daysTo(due);
    if (d < 0) return {s:'expired', label:'Expired '+fmtDate(due), cls:'red', due, date:x.date};
    if (d <= 60) return {s:'soon', label:'Due '+fmtDate(due)+' ('+d+' days)', cls:'amber', due, date:x.date};
    return {s:'ok', label:'Good until '+fmtDate(due), cls:'calm', due, date:x.date};
  }
  function summary(n){
    const out = {missing:0, expired:0, soon:0, ok:0, list:[]};
    reqsFor(n).forEach(r => { const s = itemState(n, r); if (out[s.s] != null) out[s.s]++; if (['missing','expired','soon'].includes(s.s)) out.list.push({n, r, s}); });
    const tr = rec(siteOf(n), n); if (tr && tr.need && tr.hours < tr.need) out.list.push({n, r:{t:'Training hours this year', cat:'Training'}, s:{s:'soon', label:tr.hours+' of '+tr.need+' hours', cls:'amber'}});
    return out;
  }
  function statusChip(n){ const m = summary(n); return m.expired || m.missing ? chip((m.expired+m.missing)+' to fix','red') : m.soon ? chip(m.soon+' due soon','amber') : chip('Up to date','calm'); }

  // ---------- wording check ----------
  function wordCheck(textEl, box){
    const run = () => {
      box.textContent = '';
      const hits = H.WORDS.filter(w => w.re.test(textEl.value));
      if (!textEl.value.trim()) return;
      if (!hits.length){ box.append(h('p',{class:'small',style:'color:var(--calm)'},'✓ Reads as factual. Dates, what happened and the effect are what make a note fair and useful.')); return; }
      box.append(h('div',{class:'card warn',role:'status'}, h('b',null,'Wording to look at again ('+hits.length+')'),
        h('ul',{class:'small'}, hits.map(w => { const m = textEl.value.match(w.re); return h('li',null, h('b',null,'"'+m[0]+'": '), w.why+' Try: '+w.try); })),
        h('p',{class:'small muted'},'This is a nudge, not a block. Notes in a personnel file can be read by the employee (Wis. Stat. 103.13), by a surveyor, and in a dispute.')));
    };
    textEl.addEventListener('input', run); run();
    return () => H.WORDS.filter(w => w.re.test(textEl.value)).length;
  }

  // ---------- views ----------
  VIEWS.hr = {t:'Employee files', ic:'🪪'};
  VIEWS.myfile = {t:'My employee file', ic:'🪪'};
  VIEWS.celebrate = {t:'Birthdays and milestones', ic:'🎂'};
  const addNav = (t, id, after) => { const n = NAV[t]; if (!n || n.includes(id)) return; const at = n.indexOf(after) >= 0 ? n.indexOf(after)+1 : n.length; n.splice(at, 0, id); };
  addNav('manager','hr','team'); addNav('manager','celebrate','hr'); addNav('owner','hr','labor'); addNav('owner','celebrate','hr'); addNav('multi','hr','labor');
  addNav('caregiver','myfile','mytraining'); addNav('caregiver','celebrate','myfile'); addNav('rn','myfile','time');
  if (window.SSAccess && SSAccess.register) try { SSAccess.register({id:'hr', name:'Employee files', ic:'🪪', what:'Personnel files with compliance dates, a separate medical file, write-ups, reviews and raises, development profiles, time off, birthdays and inspection rights.', views:['hr','myfile','celebrate'], tiers:['caregiver','manager','rn','owner','multi']}); } catch(e){}
  const viewOn = () => { try { return !window.SSAccess || !SSAccess.viewOn || SSAccess.viewOn('hr'); } catch(e){ return true; } };

  const legal = () => h('p',{class:'foot'},'Built to Wisconsin and federal rules as read '+fmtDate(H.CHECKED)+'. Sample staff only. Not legal advice: check big decisions with an employment lawyer.');

  R.myfile = v => {
    st();
    if (T() === 'family'){ v.append(head('Employee files','Not used in family caregiving', null)); return; }
    const n = me();
    if (!siteOf(n) || !st().people[n]){ v.append(head('My employee file', 'Your file is not in the sample', 'Switch "View as" to Caregiver to see a sample employee\'s own file.')); return; }
    personFile(v, n, A.param ? (A.param()||'') : '');
  };

  R.hr = v => {
    st();
    const p = (A.param && A.param()) || '';
    if (T() === 'family'){ v.append(head('Employee files','Not used in family caregiving', null)); return; }
    if (!isBoss()){ location.hash = '#/myfile'; return; }
    const m = p.match(/^p\/([^/]+)(?:\/(.*))?$/);
    if (m){ const n = decodeURIComponent(m[1]); if (!st().people[n] || !canSee(n, 'file')){ v.append(head('Employee files','You do not have access to this file', 'Managers see the staff of their own home. Owners see everyone.'), h('a',{href:'#/hr'},'← Back to employee files')); return; } personFile(v, n, m[2]||''); return; }
    const TABS = [['','Team'],['due','Due and expiring'],['inspect','Requests to see a file'],['retain','Record keeping'],['log','Who opened what']].concat(isOwner() ? [['settings','Settings']] : []);
    const cur = TABS.some(t => t[0] === p) ? p : '';
    v.append(head((isOwner() ? 'Owner' : 'House manager')+' · '+siteName(S().site), 'Employee files', 'Everything HR in one place: dates that expire, write-ups, reviews, raises and time off. Medical papers live in a separate, locked file.'));
    v.append(h('div',{class:'tabs',role:'tablist'}, TABS.map(([id, l]) => h('button',{role:'tab',type:'button','aria-selected':String(cur===id),onclick:()=>{ location.hash = '#/hr'+(id?'/'+id:''); }}, l))));
    ({'':team, due, inspect:inspectList, retain, log:logList, settings})[cur](v);
    v.append(legal());
  };

  function team(v){
    const ppl = visiblePeople();
    const waiting = st().pay.filter(p => p.status === 'Proposed' && ppl.includes(p.who));
    if (isOwner() && waiting.length) v.append(card('warn', h('b',null,waiting.length+' pay change'+(waiting.length===1?'':'s')+' waiting for you'), h('div',{class:'list'}, waiting.map(p => h('a',{class:'item',href:'#/hr/p/'+encodeURIComponent(p.who)+'/pay'}, h('b',null,p.who+': '+p.kind), h('span',{class:'small'},$2(p.from)+' to '+$2(p.to)+' an hour, from '+fmtDate(p.eff)+'. Proposed by '+p.by+'.'))))));
    const req = st().inspect.filter(r => r.status !== 'Done' && ppl.includes(r.who));
    if (req.length) v.append(card('warn', h('b',null,req.length+' request'+(req.length===1?'':'s')+' to see a personnel file'), h('p',{class:'small'},'Wisconsin law gives 7 working days. ', h('a',{href:'#/hr/inspect'},'Open requests'))));
    v.append(card('', h('h2',null,'People'),
      h('div',{class:'list'}, ppl.map(n => { const pe = st().people[n]; return h('a',{class:'item',href:'#/hr/p/'+encodeURIComponent(n),style:'text-decoration:none;color:inherit'},
        h('div',{class:'meta'}, statusChip(n), chip(pe.role,'grey'), T()==='multi' ? chip(siteName(pe.site),'grey') : null, pe.status !== 'Active' ? chip(pe.status,'amber') : null),
        h('b',null,n), h('span',{class:'small muted'},'Started '+fmtDate(pe.hire)+' · '+tenure(pe.hire))); })),
      h('p',{class:'small muted'},'Names are placeholders. Each person sees only their own file. Every file you open is written to the access log, and the employee can see who opened theirs.')));
  }
  function tenure(hire){ const d = Math.max(0, -daysTo(hire)); const y = Math.floor(d/365), mo = Math.floor((d%365)/30.4); return y ? y+' yr'+(y===1?'':'s')+(mo?' '+mo+' mo':'') : mo ? mo+' month'+(mo===1?'':'s') : d+' days'; }

  function due(v){
    const all = visiblePeople().flatMap(n => summary(n).list);
    const order = {expired:0, missing:1, soon:2};
    all.sort((a,b) => order[a.s.s]-order[b.s.s]);
    v.append(card('', h('h2',null,'Due and expiring'), h('p',{class:'small muted'},'Missing, expired, and anything due in the next 60 days. Background rechecks and training hours also show on the schedule\'s checks.'),
      all.length ? h('div',{class:'tablewrap'}, h('table',{class:'t'}, h('thead',null,h('tr',null,['Person','Item','Status',''].map(x => h('th',null,x)))),
        h('tbody',null, all.map(x => h('tr',null, h('td',null,x.n), h('td',null,x.r.t), h('td',null,chip(x.s.label, x.s.cls)), h('td',null,h('a',{href:'#/hr/p/'+encodeURIComponent(x.n)+'/comp'},'Open'))))))) : h('p',{class:'muted'},'Nothing due. Nice work.'),
      all.length ? h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>download('hr-due.csv','text/csv',[['Person','Item','Status']].concat(all.map(x => [x.n, x.r.t, x.s.label])).map(r => r.map(csvCell).join(',')).join('\r\n'))},'Download list (.csv)')) : null));
  }

  function inspectList(v){
    const ppl = visiblePeople(); const list = st().inspect.filter(r => ppl.includes(r.who));
    v.append(card('soft', h('h2',null,'The employee\'s right to see their file'), h('ul',{class:'small'}, H.INSPECT.points.map(p => h('li',null,p))),
      h('details',{class:'small'}, h('summary',null,'What the home does not have to show'), h('ul',null, H.INSPECT.excluded.map(x => h('li',null,x)))), h('p',{class:'small'}, src('s10313'))));
    v.append(card('', h('h2',null,'Requests'), list.length ? h('div',{class:'list'}, list.map(r => {
      const left = daysTo(r.due);
      return h('div',{class:'item'}, h('div',{class:'meta'}, chip(r.status, r.status==='Done'?'calm':left<2?'red':'amber'), h('span',null,'Asked '+fmtDate(r.at)), r.status!=='Done' ? h('span',null,'Due by '+fmtDate(r.due)+' (7 working days)') : h('span',null,'Shown '+fmtDate(r.doneAt))),
        h('b',null,r.who), r.note ? h('span',{class:'small'},r.note) : null,
        r.status !== 'Done' ? h('div',{class:'row'},
          h('button',{class:'btn sm',type:'button',onclick:()=>{ r.status = 'Done'; r.doneAt = new Date().toISOString(); r.doneBy = actor(); st().log.unshift({at:r.doneAt, who:actor(), tier:tier().name, file:r.who, part:'Shown to the employee (inspection)', site:siteOf(r.who)}); save(); toast('Marked as shown'); A.route(); }},'Mark as shown'),
          h('a',{class:'btn quiet sm',href:'#/hr/p/'+encodeURIComponent(r.who)+'/inspect'},'Print the file')) : null);
    })) : h('p',{class:'muted'},'No requests.')));
  }

  function retain(v){
    v.append(card('', h('h2',null,'How long to keep records'), h('p',{class:'small muted'},'Counted from the last day of work unless noted. Medical papers and I-9s are stored apart from the personnel file. A legal hold (a claim, complaint or investigation) stops any deletion until it is lifted.'),
      h('div',{class:'list'}, H.RETAIN.map(r => h('div',{class:'item'}, h('b',null,r.t), h('span',null,'Keep: '+r.keep), h('span',{class:'small muted'},r.why), r.check ? h('span',{class:'small'}, chip(r.check,'amber'), ' ', r.checkWhy||'') : null, h('span',{class:'small',style:'overflow-wrap:anywhere'}, r.src.map(src).filter(Boolean).reduce((a,x,i) => a.concat(i?[' · ',x]:[x]),[])))))));
    const gone = Object.entries(st().people).filter(([n,p]) => p.status !== 'Active' && visiblePeople().includes(n));
    v.append(card('', h('h2',null,'Former staff files'), gone.length ? h('div',{class:'list'}, gone.map(([n,p]) => { const r = retainDates(n); return h('div',{class:'item'}, h('b',null,n), h('span',{class:'small'},'Ended '+fmtDate(p.end)+'. Personnel file until '+fmtDate(r.personnel)+'. I-9 until '+fmtDate(r.i9)+'. Exposure records until '+fmtDate(r.exposure)+'.'), p.legalHold ? chip('Legal hold: keep everything','red') : null); })) : h('p',{class:'small muted'},'No former staff yet. When someone leaves, use Offboarding in their file and the dates are set for you.')));
  }
  function retainDates(n){
    const p = st().people[n], end = p.end || today(), y = (k) => addMonths(end, 12*k);
    const i9 = [addMonths(p.hire, 36), y(1)].sort().pop();
    return {personnel:y(3), tax:y(4), i9, exposure:y(30)};
  }

  function logList(v){
    const ppl = visiblePeople(); const items = st().log.filter(l => ppl.includes(l.file) && (isOwner() || l.site === S().site)).slice(0, 150);
    v.append(card('', h('h2',null,'Who opened what'), h('p',{class:'small muted'},'Every view of a file, the medical file, pay and notes. Owners see all of it. Each employee sees the views of their own file.'),
      items.length ? h('div',{class:'tablewrap'}, h('table',{class:'t'}, h('thead',null,h('tr',null,['When','Who','Role','File','Part'].map(x => h('th',null,x)))), h('tbody',null, items.map(l => h('tr',null, h('td',null,fmtTime(l.at)), h('td',null,l.who), h('td',null,l.tier), h('td',null,l.file), h('td',null,l.part)))))) : h('p',{class:'muted'},'No views yet.'),
      h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>download('hr-access-log.csv','text/csv',[['When','Who','Role','File','Part']].concat(items.map(l => [l.at,l.who,l.tier,l.file,l.part])).map(r => r.map(csvCell).join(',')).join('\r\n'))},'Download log (.csv)'))));
  }

  function settings(v){
    const sid = S().site, c = cfg(sid);
    const sw = (k, label, help) => { const id = 'hrs_'+k; return h('div',null, h('label',{class:'checkrow',for:id}, h('input',{type:'checkbox',id,checked:!!c[k],onchange:e=>{ c[k] = e.target.checked; save(); toast('Saved'); }}), label), help ? h('p',{class:'small muted'},help) : null); };
    const med = sel([['owner','Owner only'],['owner+manager','Owner and the house manager']], c.medAccess);
    med.addEventListener('change',()=>{ c.medAccess = med.value; st().log.unshift({at:new Date().toISOString(), who:actor(), tier:tier().name, file:'(setting)', part:'Medical file access set to: '+med.selectedOptions[0].text, site:sid}); save(); toast('Saved'); });
    const num = (k, label) => { const i = h('input',{type:'number',min:'0',step:'0.5',value:String(c[k])}); i.addEventListener('change',()=>{ c[k] = +i.value; save(); }); return field(label, i); };
    v.append(card('', h('h2',null,'Settings for '+siteName(sid)),
      field('Who can open medical files', med), h('p',{class:'small muted'},'Keep this to the fewest people who need it (ADA confidentiality). Everyone else sees only "screening on file" or "due".'),
      sw('mgrPay','House manager can see pay rates','Off by default. Managers can still suggest a raise for you to approve.'),
      sw('remindBday','Remind managers of birthdays people chose to share'), sw('remindAnniv','Remind managers of work anniversaries'), sw('teamCelebrate','Show shared birthdays and anniversaries to the whole team'),
      h('h3',null,'Paid time off'), h('div',{class:'grid g3'}, num('ptoRate','Hours earned'), num('ptoPer','per hours worked'), num('ptoCap','Most hours a person can bank')),
      h('p',{class:'small muted'},'Wisconsin does not require paid time off. Whatever you offer, write it down and follow it the same way for everyone. Wisconsin and federal family and medical leave may apply to larger employers.')));
  }

  // ---------- one person's file ----------
  function personFile(v, n, sub){
    const c = st(), pe = c.people[n], sid = pe.site, mine = n === me();
    const base = mine && !isBoss() ? '#/myfile' : '#/hr/p/'+encodeURIComponent(n);
    const TABS = [['','Character sheet'],['comp','Compliance'],['med','Medical file'],['wu','Write-ups'],['rev','Reviews'],['pay','Pay and promotions'],['dev','Development'],['pto','Time off'],['onb','On and offboarding'],['docs','Documents'],['ins','Insights'],['inspect','See my file']]
      .filter(([id]) => id === 'med' ? canSee(n,'medical') || mine || isBoss() : id === 'pay' ? canSee(n,'pay') || mine || isMgr() : id === 'dev' ? mine || canSee(n,'dev') : true);
    const cur = TABS.some(t => t[0] === sub) ? sub : '';
    logView(n, (TABS.find(t => t[0]===cur)||TABS[0])[1]);
    if (isBoss() && !mine) v.append(h('a',{href:'#/hr',class:'small'},'← All employee files'));
    v.append(head(mine ? 'Your file · '+siteName(sid) : siteName(sid), n, mine ? 'This is your file. You can ask to see all of it at any time (twice a year at least, by Wisconsin law), add your side to anything, and see who has opened it.' : pe.role+' · started '+fmtDate(pe.hire)+' · '+tenure(pe.hire)));
    v.append(h('div',{class:'tabs',role:'tablist'}, TABS.map(([id, l]) => h('button',{role:'tab',type:'button','aria-selected':String(cur===id),onclick:()=>{ location.hash = base+(id ? '/'+id : ''); }}, l))));
    const body = h('div',{class:'grid'}); v.append(body);
    ({'':sheet, comp, med, wu, rev, pay, dev, pto, onb, docs, ins, inspect:inspectMine})[cur](body, n);
    v.append(legal());
  }

  // character sheet: a one-page picture of the person, human first
  function sheet(b, n){
    const c = st(), pe = c.people[n], mine = n === me(), tr = rec(pe.site, n) || {}, pr = (D.SCHED.profiles||{})[n] || {};
    const skills = [pr.alone ? 'Cleared to work alone' : 'Orientation in progress', pr.meds ? 'Passes medications' : null, pr.licensed ? pr.licensed+' license' : null, pr.lead ? 'Leads a shift' : null]
      .concat((S().delegations||[]).filter(d => d.cg === n && d.status !== 'Expired').map(d => 'RN-delegated: '+d.task)).filter(Boolean);
    const kud = c.kudos.filter(k => k.to === n);
    b.append(card('soft', h('div',{class:'row',style:'align-items:center;gap:1rem'}, h('div',{class:'avatar','aria-hidden':'true',style:'width:64px;height:64px;font-size:1.4rem'}, initials(n)),
        h('div',{class:'grid',style:'gap:.2rem'}, h('b',{style:'font-size:1.2rem'},n), h('span',null,pe.role+' · '+tenure(pe.hire)+' with us'), h('div',{class:'meta'}, statusChip(n), pe.bday && (mine || isBoss() && pe.share.bday !== 'private') ? chip('🎂 '+mdText(pe.bday),'grey') : null, chip('🗓️ Started '+fmtDate(pe.hire),'grey')))),
      h('div',{class:'grid g3'},
        stat(tr.need ? tr.hours+' of '+tr.need : (tr.hours||0)+'', 'training hours this year'),
        stat(String(kud.length), 'thank-yous from the team'),
        stat(String(skills.length), 'skills and clearances'))));
    b.append(card('', h('h2',null,'Skills and clearances'), h('div',{class:'chips'}, skills.map(s => chip(s,'calm'))),
      pe.devOn && (pe.strengths||[]).length && (mine || pe.devShare) ? h('div',null, h('h3',null,'Strengths they chose'), h('div',{class:'chips'}, pe.strengths.map(s => chip(s,'grey'))), h('p',{class:'small muted'},'Development only. Never used for pay, promotion, discipline or scheduling.')) : null));
    // preferences
    const pf = pe.pref || {};
    const prefBox = card('', h('h2',null,'Work preferences'), h('div',{class:'grid g2'},
      h('div',{class:'item'}, h('b',null,'Shifts they like'), h('span',null,pf.shifts||'Not said')), h('div',{class:'item'}, h('b',null,'Best way to reach them'), h('span',null,pf.contact||'Not said')),
      h('div',{class:'item'}, h('b',null,'Most hours a week'), h('span',null,pf.max ? pf.max+' hours' : 'Not said')), h('div',{class:'item'}, h('b',null,'Good to know'), h('span',null,pf.notes||'Nothing added'))));
    if (mine || isMgr()) prefBox.append(h('details',null, h('summary',{class:'small'},mine ? 'Change my preferences' : 'Update with them'), (() => {
      const s1 = inp(pf.shifts), s2 = sel(['Text','Call','App message','Email'], pf.contact), s3 = h('input',{type:'number',min:'0',max:'80',value:String(pf.max||'')}), s4 = inp(pf.notes);
      return h('div',{class:'grid'}, h('div',{class:'grid g2'}, field('Shifts', s1), field('Reach me by', s2), field('Most hours a week', s3), field('Good to know (no health details)', s4)),
        h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ pe.pref = {shifts:s1.value, contact:s2.value, max:+s3.value||null, notes:s4.value}; save(); toast('Saved'); A.route(); }},'Save')));
    })()));
    b.append(prefBox);
    // Social Security number: masked, reason to view, logged in this file's log too, never printed
    if (window.SSSSN && (mine || isBoss())){
      const ssn = pe.ssn || ('000-77-'+String(1000 + Object.keys(c.people).indexOf(n)).slice(-4));
      b.append(card('', h('h2',null,'Payroll and tax ID'), SSSSN.field({ssn, site:pe.site, label:n, kind:'staff', self:mine, onLog:what => { c.log.unshift({at:new Date().toISOString(), who:actor(), tier:tier().name, file:n, part:what, site:siteOf(n)}); save(); }}),
        h('p',{class:'small muted'},'Needed for payroll, W-4 and I-9 forms and background checks. Sample numbers start with 000, which are never issued.')));
    }
    // kudos
    const kb = card('', h('h2',null,'Thank-yous'), kud.length ? h('div',{class:'list'}, kud.slice(0,6).map(k => h('div',{class:'item'}, h('div',{class:'meta'}, h('span',null,fmtDate(k.at)), h('span',null,'from '+k.from)), h('span',null,k.text)))) : h('p',{class:'small muted'},'None yet.'));
    if (!mine){ const t = area('', {rows:'2','aria-label':'Say thank you'}); const pub = h('input',{type:'checkbox',id:'kpub'+uid(),checked:true});
      kb.append(h('div',{class:'grid'}, field('Say thank you for something specific', t), h('label',{class:'checkrow',for:pub.id}, pub, 'Share with the team'),
        h('div',{class:'row'}, h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ if (!t.value.trim()) return toast('Write what they did'); c.kudos.unshift({id:uid(), site:pe.site, to:n, from:me(), text:t.value.trim(), at:new Date().toISOString(), team:pub.checked}); save(); toast('Thank-you sent'); A.route(); }},'Send thank-you')))); }
    b.append(kb);
    // manager notes
    if (isBoss() && !mine) b.append(notesBox(n));
    else if (mine){ const ns = c.notes.filter(x => x.who === n && !/^Planning/.test(x.kind)); if (ns.length) b.append(card('', h('h2',null,'Notes your manager added'), h('div',{class:'list'}, ns.map(x => h('div',{class:'item'}, h('div',{class:'meta'}, chip(x.kind,'grey'), h('span',null,fmtDate(x.at)+' · '+x.by)), h('span',null,x.text), stmtFor('note:'+x.id, n)))))); }
  }
  const stat = (b, s) => h('div',{class:'stat'}, h('b',null,b), h('span',null,s));

  function notesBox(n){
    const c = st(), pe = c.people[n];
    const ns = c.notes.filter(x => x.who === n);
    const box = card('', h('h2',null,'Manager notes'), h('p',{class:'small muted'},'Facts and dates, good and hard. The employee can read these notes when they ask to see their file. "Planning" notes about future raises or roles are the exception under Wisconsin law.'),
      ns.length ? h('div',{class:'list'}, ns.map(x => h('div',{class:'item'}, h('div',{class:'meta'}, chip(x.kind, /^Planning/.test(x.kind)?'amber':'grey'), h('span',null,fmtDate(x.at)+' · '+x.by)), h('span',null,x.text)))) : h('p',{class:'small muted'},'No notes yet.'));
    const kind = sel(['Recognition','Observation','Conversation','Follow-up','Planning (not shown to the employee)'], 'Observation');
    const t = area('', {rows:'3'}); const chk = h('div');
    const n2 = wordCheck(t, chk);
    box.append(h('h3',null,'Add a note'), h('div',{class:'grid'}, field('Kind', kind), field('What happened (date, what you saw or heard, the effect)', t), chk,
      h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ if (!t.value.trim()) return toast('Write the note'); if (n2() && !confirmFlag(box)) return; c.notes.unshift({id:uid(), site:pe.site, who:n, kind:kind.value, text:t.value.trim(), by:actor(), at:new Date().toISOString()}); save(); toast('Note saved'); A.route(); }},'Save note'))));
    return box;
  }
  // flagged wording needs one more tap: the writer looked at it and chose to keep it
  function confirmFlag(box){ if (box.dataset.ok) return true; box.dataset.ok = '1'; toast('Some wording was flagged. Look at the tips, then tap Save again to keep it.'); return false; }

  // employee's own written statement attached to a part of the file (Wis. Stat. 103.13(4))
  function stmtFor(about, n){
    const c = st(), mine = n === me(), list = c.statements.filter(s => s.about === about);
    const wrap = h('div',{class:'grid',style:'gap:.3rem'}, list.map(s => h('div',{class:'card soft'}, h('b',{class:'small'},'Employee\'s statement, '+fmtDate(s.at)), h('span',{class:'small'},s.text))));
    if (mine){ const t = area('', {rows:'2'}); wrap.append(h('details',null, h('summary',{class:'small'},'Add my side to this'), h('div',{class:'grid'}, field('Your statement (it stays attached to this part of your file)', t), h('div',{class:'row'}, h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ if (!t.value.trim()) return; c.statements.push({id:uid(), who:n, about, text:t.value.trim(), at:new Date().toISOString()}); save(); toast('Your statement is attached'); A.route(); }},'Attach my statement'))))); }
    return wrap;
  }

  // compliance
  function comp(b, n){
    const c = st(), mine = n === me(), canEdit = isBoss() && !mine, it = c.items[n] = c.items[n] || {}, tr = rec(c.people[n].site, n) || {};
    b.append(card('soft', h('p',{class:'small'},'What a surveyor looks for in each file, with the date each one runs out. The background check date here is the one the schedule uses for its 4-year recheck warning, and training hours come from Team training and the Academy.')));
    const groups = {};
    reqsFor(n).forEach(r => (groups[r.cat] = groups[r.cat] || []).push(r));
    Object.entries(groups).forEach(([g, rs]) => {
      b.append(card('', h('h2',null,g), h('div',{class:'list'}, rs.map(r => {
        const s = itemState(n, r), x = it[r.id] || {};
        const row = h('div',{class:'item'}, h('div',{class:'meta'}, chip(s.label, s.cls), r.medical ? chip('Papers in the medical file','grey') : null, r.separate ? chip('Stored apart from this file','grey') : null, r.optional ? chip('Only if it applies','grey') : null),
          h('b',null,r.t), h('span',{class:'small muted'},r.why+' ('+r.cite+')'), x.note ? h('span',{class:'small'},x.note) : null);
        if (canEdit){
          const d = h('input',{type:'date',value:x.date||''}), note = inp(r.medical ? '' : x.note||'', {placeholder:r.medical ? 'Result goes in the medical file, not here' : 'Note (card number, who checked)', disabled:r.medical||null});
          row.append(h('details',null, h('summary',{class:'small'},'Update'), h('div',{class:'grid g2'}, field(r.months ? 'Date done' : 'Date on file', d), field('Note', note)),
            h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ if (!d.value) return toast('Pick the date'); it[r.id] = {date:d.value, by:actor(), note:r.medical ? '' : note.value}; if (r.id === 'bg' && tr) tr.bg = d.value; save(); toast('Saved'); A.route(); }},'Save'),
              r.optional ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ it[r.id] = {na:true}; save(); A.route(); }},'Does not apply') : null)));
        }
        return row;
      }))));
    });
    const certs = ((S().academy||{}).certs||[]).filter(x => x.who === n);
    b.append(card('', h('h2',null,'Training hours'), h('div',{class:'stat'}, h('b',null,(tr.hours||0)+(tr.need?' of '+tr.need:'')), h('span',null,'hours counted this year')),
      certs.length ? h('div',{class:'list'}, certs.map(x => h('div',{class:'item'}, h('div',{class:'meta'}, h('span',null,fmtDate(x.at)), chip(x.counted?'Counted':'Waiting for the manager', x.counted?'calm':'amber')), h('b',null,x.title)))) : h('p',{class:'small muted'},'No Academy certificates yet.'),
      h('div',{class:'row'}, isBoss() ? h('a',{href:'#/team'},'Team training') : h('a',{href:'#/mytraining'},'My training'), VIEWS.academy ? h('a',{href:'#/academy/roles'},'Academy modules') : null)));
  }

  // medical file: separate, restricted, logged
  function med(b, n){
    const c = st(), mine = n === me(), m = c.medical[n] = c.medical[n] || {tb:null, accom:[], exposures:[]};
    b.append(card('soft', h('b',null,'🔒 Separate medical file'), h('p',{class:'small'},'Health screening results, accommodations and exposure records are kept here, apart from the personnel file, as the ADA requires. Only '+(cfg(c.people[n].site).medAccess==='owner'?'the owner':'the owner and house manager')+' and the employee can open it. Supervisors only learn what they need, such as a work limit, never a diagnosis. ', src('ada'))));
    if (!mine && !canSee(n, 'medical')){
      const s = itemState(n, H.REQ.find(r => r.id === 'tb'));
      b.append(card('', h('h2',null,'What you can see'), h('div',{class:'item'}, h('b',null,'Health screening'), chip(s.label, s.cls)),
        (m.accom||[]).filter(a => !a.until || a.until >= today()).length ? h('div',{class:'item'}, h('b',null,'Work limits to follow'), h('ul',{class:'small'}, m.accom.filter(a => !a.until || a.until >= today()).map(a => h('li',null,a.what.replace(/ \(sample\)$/,'')+(a.until?' (until '+fmtDate(a.until)+')':''))))) : null,
        h('p',{class:'small muted'},'The details are locked. Ask the owner if you need more to keep someone safe.')));
      return;
    }
    const key = n+'|'+T();
    if (!mine && !MEDOPEN[key]){
      const why = sel(['Checking screening is on file for a survey','Setting up an accommodation','Recording an exposure','Employee asked','Other'], '');
      b.append(card('', h('h2',null,'Why are you opening it?'), h('p',{class:'small'},'Your reason is saved in the access log, and the employee can see it.'), field('Reason', why),
        h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ MEDOPEN[key] = true; c.log.unshift({at:new Date().toISOString(), who:actor(), tier:tier().name, file:n, part:'Medical file opened: '+why.value, site:siteOf(n)}); save(); A.route(); }},'Open the medical file'))));
      return;
    }
    const tb = m.tb;
    const tbBox = card('', h('h2',null,'Health screening (TB)'), tb ? h('div',{class:'grid g2'}, h('div',{class:'item'}, h('b',null,'Date'), h('span',null,fmtDate(tb.date))), h('div',{class:'item'}, h('b',null,'Type'), h('span',null,tb.type)), h('div',{class:'item'}, h('b',null,'Result'), h('span',null,tb.result)), h('div',{class:'item'}, h('b',null,'Signed by'), h('span',null,tb.by))) : h('p',{class:'muted'},'Nothing on file.'),
      h('p',{class:'small muted'},'Wisconsin: a physician, PA or RN (AFH) or a physician, PA or nurse practitioner (CBRF) documents that the person was screened for illness that could harm residents, including TB, within 90 days before starting. Kept confidential; the licensing agency may check it. DHS 88.04(2)(g); DHS 83.17(2).'));
    if (!mine){ const d = h('input',{type:'date',value:tb?tb.date:''}), ty = sel(['Two-step skin test','Blood test (IGRA)','Symptom screen and risk review','Chest X-ray (after a positive test)'], ''), rs = inp('', {placeholder:'e.g. Negative'}), by = inp('', {placeholder:'Who signed it'});
      tbBox.append(h('details',null, h('summary',{class:'small'},'Record a screening'), h('div',{class:'grid g2'}, field('Date', d), field('Type', ty), field('Result', rs), field('Signed by', by)), h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ if (!d.value) return toast('Pick the date'); m.tb = {date:d.value, type:ty.value, result:rs.value, by:by.value}; (c.items[n] = c.items[n]||{}).tb = {date:d.value, by:actor(), note:''}; save(); toast('Saved. Only "on file" shows in the personnel file.'); A.route(); }},'Save')))); }
    b.append(tbBox);
    const ac = card('', h('h2',null,'Accommodations'), (m.accom||[]).length ? h('div',{class:'list'}, m.accom.map(a => h('div',{class:'item'}, h('div',{class:'meta'}, h('span',null,'From '+fmtDate(a.date)), a.until ? h('span',null,'until '+fmtDate(a.until)) : null), h('b',null,a.what), a.note ? h('span',{class:'small muted'},a.note) : null))) : h('p',{class:'small muted'},'None.'),
      h('p',{class:'small muted'},'Write the work limit, not the condition. Talk it through with the employee (the "interactive process") and keep the provider note here.'));
    if (!mine){ const w = inp('', {placeholder:'e.g. Use the lift or a second helper for transfers'}), u = h('input',{type:'date'});
      ac.append(h('details',null, h('summary',{class:'small'},'Add an accommodation'), h('div',{class:'grid g2'}, field('Work limit or change', w), field('Until (optional)', u)), h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ if (!w.value.trim()) return; m.accom.push({date:today(), what:w.value.trim(), until:u.value||null, by:actor()}); save(); A.route(); }},'Save')))); }
    b.append(ac);
    b.append(card('', h('h2',null,'Exposure records'), (m.exposures||[]).length ? h('ul',null, m.exposures.map(e => h('li',null,fmtDate(e.date)+': '+e.what))) : h('p',{class:'small muted'},'None. Needlestick, blood or TB exposures are kept for the length of employment plus 30 years (OSHA).'),
      !mine ? (() => { const d = h('input',{type:'date'}), w = inp('', {placeholder:'What happened (no resident names)'}); return h('details',null, h('summary',{class:'small'},'Record an exposure'), h('div',{class:'grid g2'}, field('Date', d), field('What happened', w)), h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ if (!d.value || !w.value.trim()) return toast('Add the date and what happened'); m.exposures.push({date:d.value, what:w.value.trim(), by:actor()}); save(); A.route(); }},'Save'))); })() : null));
  }

  // write-ups and corrective action
  function wu(b, n){
    const c = st(), mine = n === me(), list = c.writeups.filter(w => w.who === n);
    b.append(card('soft', h('p',{class:'small'}, mine ? 'Write-ups about you. Signing means you received it, not that you agree. You can always add your side, and it stays attached.' : 'Fair, private and specific: what happened (dates), what is expected, the effect, and the support offered. Signing means the employee received it, not that they agree. They can add their side.')));
    list.forEach(w => {
      const step = H.STEPS.find(s => s.id === w.step) || {t:w.step};
      const box = card('', h('div',{class:'meta'}, chip(step.t, ['final','suspend','end'].includes(w.step)?'red':w.step==='coach'?'grey':'amber'), h('span',null,fmtDate(w.date)+' · by '+w.by), chip(w.ack ? 'Received '+fmtDate(w.ack.at) : 'Not signed yet', w.ack?'calm':'amber')),
        h('h3',null,'What happened'), h('p',null,w.facts), h('h3',null,'What is expected'), h('p',null,w.expect),
        w.impact ? h('div',null, h('h3',null,'Why it matters'), h('p',null,w.impact)) : null, w.support ? h('div',null, h('h3',null,'Support offered'), h('p',null,w.support)) : null,
        w.follow ? h('p',{class:'small'},'Follow-up on '+fmtDate(w.follow)) : null,
        w.response ? h('div',{class:'card soft'}, h('b',{class:'small'},'Employee\'s response, '+fmtDate(w.responseAt)), h('p',{class:'small'},w.response)) : null);
      if (mine && !w.ack){ const r = area('', {rows:'3'});
        box.append(h('div',{class:'grid'}, field('Your response (optional, stays attached)', r), h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ w.ack = {at:new Date().toISOString()}; if (r.value.trim()){ w.response = r.value.trim(); w.responseAt = w.ack.at; } save(); toast('Signed as received'); A.route(); }},'I received this')))); }
      else if (mine && !w.response){ box.append(stmtFor('wu:'+w.id, n)); }
      b.append(box);
    });
    if (!list.length) b.append(card('', h('p',{class:'muted'},'No write-ups.')));
    if (!isBoss() || mine) return;
    // new write-up
    const step = sel(H.STEPS.map(s => [s.id, s.t]), 'coach'), date = h('input',{type:'date',value:today()});
    const facts = area('', {rows:'4'}), expect = area('', {rows:'2'}), impact = area('', {rows:'2'}), support = area('', {rows:'2'}), follow = h('input',{type:'date',value:addDays(today(), 14)});
    const chk = h('div'), run = wordCheck(facts, chk);
    const box = card('', h('h2',null,'Write something up'), h('details',{class:'small'}, h('summary',null,'The steps, and when to involve the owner'), h('ul',null, H.STEPS.map(s => h('li',null, h('b',null,s.t+': '), s.d)))),
      h('div',{class:'grid g2'}, field('Step', step), field('Date', date)), field('What happened: dates, times, what you saw or heard', facts), chk, field('What is expected from now on (link a policy if you have one)', expect),
      field('Why it matters (residents, coworkers, safety)', impact), field('Support offered (training, schedule change, a buddy)', support), field('Follow-up date', follow),
      h('p',{class:'small muted'},'Before you save: did you talk with them first? Is it the same as what others got for the same thing? Is anything here about health, family, religion, age or pay talk? Those belong out.'));
    box.append(h('div',{class:'row'}, h('button',{class:'btn',type:'button',onclick:()=>{
      if (!facts.value.trim() || !expect.value.trim()) return toast('Add what happened and what is expected');
      if ((run() || H.WORDS.some(w => w.re.test(expect.value))) && !confirmFlag(box)) return;
      const big = ['final','suspend','end'].includes(step.value);
      c.writeups.unshift({id:uid(), site:c.people[n].site, who:n, step:step.value, date:date.value, facts:facts.value.trim(), expect:expect.value.trim(), impact:impact.value.trim(), support:support.value.trim(), follow:follow.value, by:actor(), at:new Date().toISOString(), status:big && !isOwner() ? 'Waiting for owner review' : 'Given', ack:null});
      save(); toast(big && !isOwner() ? 'Saved. The owner reviews it before it is given.' : 'Saved. The employee can sign that they received it.'); A.route(); }},'Save write-up')));
    b.append(box);
  }

  // reviews
  const COMP = [['care','Resident care and dignity'],['safety','Safety and infection control'],['team','Teamwork and communication'],['reliable','Reliability (shows up, follows the schedule)'],['doc','Charting and paperwork'],['growth','Learning and growth']];
  const RATE = ['','Needs support','Building','Meets the job','Strong','Leads others'];
  function rev(b, n){
    const c = st(), mine = n === me(), list = c.reviews.filter(r => r.who === n);
    b.append(card('soft', h('p',{class:'small'},'Reviews look at the job, with examples. Personality and development answers are never part of a review.')));
    list.forEach(r => {
      const box = card('', h('div',{class:'meta'}, chip(r.period,'grey'), h('span',null,fmtDate(r.date)+' · '+r.by), chip(r.ack ? 'Read '+fmtDate(r.ack.at) : 'Not read yet', r.ack?'calm':'amber')),
        h('div',{class:'tablewrap'}, h('table',{class:'t'}, h('tbody',null, COMP.map(([k, l]) => h('tr',null, h('td',null,l), h('td',null, chip(RATE[r.scores[k]]||'–', r.scores[k]>=4?'calm':r.scores[k]>=3?'grey':'amber'))))))),
        h('h3',null,'Examples'), h('p',null,r.examples), h('h3',null,'Goals for next year'), h('p',null,r.goals), r.self ? h('div',null, h('h3',null,'Their own view'), h('p',null,r.self)) : null,
        r.empComment ? h('div',{class:'card soft'}, h('b',{class:'small'},'Employee comment'), h('p',{class:'small'},r.empComment)) : null);
      if (mine && !r.ack){ const t = area('', {rows:'2'}); box.append(field('Comment (optional)', t), h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ r.ack = {at:new Date().toISOString()}; r.empComment = t.value.trim(); save(); toast('Marked as read'); A.route(); }},'I read this review'))); }
      b.append(box);
    });
    if (!list.length) b.append(card('', h('p',{class:'muted'},'No reviews yet.')));
    if (!isBoss() || mine) return;
    const per = inp(new Date().getFullYear()-1+' to '+new Date().getFullYear()), scores = {};
    const rows = COMP.map(([k, l]) => { const s = sel(RATE.map((x,i) => [i, x||'Pick']).slice(1), 3); scores[k] = s; return field(l, s); });
    const ex = area('', {rows:'3'}), goals = area('', {rows:'2'}), self = area('', {rows:'2'}), chk = h('div'), run = wordCheck(ex, chk);
    const raise = h('input',{type:'checkbox',id:'rvr'+uid()});
    const box = card('', h('h2',null,'Write a review'), field('Period', per), h('div',{class:'grid g2'}, rows), field('Examples for each rating (dates and what happened)', ex), chk, field('Goals for next year', goals), field('Their own view (from a self-review talk)', self),
      h('label',{class:'checkrow',for:raise.id}, raise, 'Suggest a raise or promotion with this review (goes to Pay and promotions)'));
    box.append(h('div',{class:'row'}, h('button',{class:'btn',type:'button',onclick:()=>{
      if (!ex.value.trim()) return toast('Add examples');
      if (run() && !confirmFlag(box)) return;
      const sc = {}; Object.entries(scores).forEach(([k, s]) => sc[k] = +s.value);
      c.reviews.unshift({id:uid(), site:c.people[n].site, who:n, period:per.value, date:today(), by:actor(), status:'Shared', scores:sc, examples:ex.value.trim(), goals:goals.value.trim(), self:self.value.trim(), empComment:'', ack:null});
      save(); toast('Review saved and shared with them'); location.hash = raise.checked ? '#/hr/p/'+encodeURIComponent(n)+'/pay' : location.hash; A.route(); }},'Save and share')));
    b.append(box);
  }

  // pay and promotions: managers suggest, owners decide; approved changes reach Labor and pay
  function pay(b, n){
    const c = st(), mine = n === me(), seeAmt = mine || canSee(n, 'pay'), list = c.pay.filter(p => p.who === n);
    b.append(card('soft', h('p',{class:'small'}, isOwner() ? 'Approved changes update this person\'s rate in Labor and pay on the date they start.' : mine ? 'Your pay history. Only you and the owner see amounts.' : 'You can suggest a raise or promotion. The owner sees the amounts and decides.'),
      isOwner() && VIEWS.labor ? h('a',{href:'#/labor',class:'small'},'Open Labor and pay') : null));
    if (seeAmt && rateOf(n)) b.append(card('', stat($2(rateOf(n)), 'an hour now')));
    b.append(card('', h('h2',null,'History'), list.length ? h('div',{class:'list'}, list.map(p => h('div',{class:'item'},
      h('div',{class:'meta'}, chip(p.status, p.status==='Approved'?'calm':p.status==='Declined'?'grey':'amber'), h('span',null,p.kind), h('span',null,'from '+fmtDate(p.eff))),
      h('b',null, seeAmt ? $2(p.from)+' → '+$2(p.to)+' an hour'+(p.role?' · new role: '+p.role:'') : (p.role ? 'New role: '+p.role : 'Pay change')+' (amount hidden)'),
      h('span',{class:'small'},p.reason+' Suggested by '+p.by+(p.decidedBy?'. '+p.status+' by '+p.decidedBy+' '+fmtDate(p.decidedAt):'')),
      isOwner() && p.status === 'Proposed' ? h('div',{class:'row'},
        h('button',{class:'btn sm',type:'button',onclick:()=>{ p.status = 'Approved'; p.decidedBy = actor(); p.decidedAt = new Date().toISOString(); applyPay(); save(); toast('Approved. Labor and pay uses it from '+fmtDate(p.eff)); A.route(); }},'Approve'),
        h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ p.status = 'Declined'; p.decidedBy = actor(); p.decidedAt = new Date().toISOString(); save(); A.route(); }},'Decline')) : null))) : h('p',{class:'small muted'},'No changes recorded.')));
    if (!isBoss() || mine) return;
    const kind = sel(['Raise','Promotion','Market adjustment','One-time bonus'], 'Raise');
    const cur = rateOf(n) || 18;
    const amt = h('input',{type:'number',min:'0',step:'0.25',value:'1'}), role = sel([['','No role change'],['Lead caregiver','Lead caregiver'],['Med passer','Med passer'],['House manager','House manager'],['Trainer','Trainer']], ''), eff = h('input',{type:'date',value:addDays(today(), 14)}), why = area('', {rows:'2'});
    b.append(card('', h('h2',null, isOwner() ? 'Give a raise or promotion' : 'Suggest a raise or promotion'),
      h('div',{class:'grid g2'}, field('Kind', kind), field('Raise ($ an hour)', amt), field('New role (if a promotion)', role), field('Starts', eff)), field('Why (tie it to the review or job, not personality or development answers)', why),
      h('div',{class:'row'}, h('button',{class:'btn',type:'button',onclick:()=>{ if (!why.value.trim()) return toast('Say why');
        const p = {id:uid(), site:c.people[n].site, who:n, kind:kind.value, from:cur, to:Math.round((cur + (+amt.value||0))*100)/100, role:role.value, eff:eff.value, reason:why.value.trim(), by:actor(), at:new Date().toISOString(), status:isOwner() ? 'Approved' : 'Proposed'};
        if (isOwner()){ p.decidedBy = actor(); p.decidedAt = p.at; }
        c.pay.unshift(p); applyPay(); save(); toast(isOwner() ? 'Saved' : 'Sent to the owner'); A.route(); }}, isOwner() ? 'Save' : 'Send to the owner'))));
  }

  // development (opt-in, never for decisions)
  function dev(b, n){
    const c = st(), pe = c.people[n], mine = n === me();
    b.append(card('warn', h('b',null,'Development only'), h('p',{class:'small'},'This is optional and belongs to the employee. It is never used for hiring, firing, pay, promotion, discipline or scheduling, and it is not a personality test. Tests used for job decisions can screen people out unfairly and break federal law. ', src('eeocTest'))));
    if (!mine){
      if (!pe.devOn || !pe.devShare){ b.append(card('', h('p',{class:'muted'},'Not shared with you. Only the employee can turn this on and choose to share it.'))); return; }
    }
    if (mine){ const on = h('input',{type:'checkbox',id:'dvon',checked:!!pe.devOn}), sh = h('input',{type:'checkbox',id:'dvsh',checked:!!pe.devShare});
      on.addEventListener('change',()=>{ pe.devOn = on.checked; if (!on.checked) pe.devShare = false; save(); A.route(); });
      sh.addEventListener('change',()=>{ pe.devShare = sh.checked; c.log.unshift({at:new Date().toISOString(), who:actor(), tier:tier().name, file:n, part:'Development profile sharing '+(sh.checked?'on':'off'), site:pe.site}); save(); toast(sh.checked ? 'Your manager can see it' : 'Only you can see it'); });
      b.append(card('', h('label',{class:'checkrow',for:'dvon'}, on, 'Use the development check-in'), pe.devOn ? h('label',{class:'checkrow',for:'dvsh'}, sh, 'Share it with my manager and owner') : null, h('p',{class:'small muted'},'You can turn sharing off at any time.')));
      if (!pe.devOn) return;
    }
    const style = pe.style || {};
    const box = card('', h('h2',null,'How I work best'));
    H.STYLE.forEach(q => { const s = sel([['','Pick one']].concat(q.a.map(a => [a,a])), style[q.id]||''); if (!mine) s.disabled = true; s.addEventListener('change',()=>{ pe.style = Object.assign(pe.style||{}, {[q.id]:s.value}); save(); }); box.append(field(q.q, s)); });
    b.append(box);
    const sb = card('', h('h2',null,'Strengths'), h('p',{class:'small muted'},mine ? 'Pick up to 5 that sound like you.' : 'Chosen by them.'));
    const chosen = new Set(pe.strengths||[]);
    sb.append(h('div',{class:'chips'}, H.STRENGTHS.map(s => mine ? h('button',{type:'button',class:'chip'+(chosen.has(s)?' calm':''),'aria-pressed':String(chosen.has(s)),style:'cursor:pointer;min-height:36px',onclick:()=>{ if (chosen.has(s)) chosen.delete(s); else if (chosen.size < 5) chosen.add(s); else return toast('Pick up to 5'); pe.strengths = [...chosen]; save(); A.route(); }}, s) : chosen.has(s) ? chip(s,'calm') : null)));
    if (mine){ const other = inp('', {placeholder:'Took a strengths or style test somewhere else? Note the result for yourself'}); sb.append(field('Other (optional)', other)); other.value = pe.otherStyle||''; other.addEventListener('change',()=>{ pe.otherStyle = other.value; save(); }); }
    else if (pe.otherStyle) sb.append(h('p',{class:'small'},'They added: '+pe.otherStyle));
    b.append(sb);
  }

  // time off
  function ptoBal(n){ return (st().pto[n]||[]).reduce((t, x) => t + (x.kind === 'Used' ? -x.hrs : x.hrs), 0); }
  function pto(b, n){
    const c = st(), mine = n === me(), cf = cfg(c.people[n].site), led = c.pto[n] = c.pto[n] || [];
    const reqs = X() ? X().ensure().requests.filter(r => r.by === n && r.type === 'timeoff') : [];
    b.append(card('', h('div',{class:'grid g3'}, stat(ptoBal(n)+' hrs', 'paid time off banked'), stat(cf.ptoRate+' per '+cf.ptoPer, 'hours earned per hours worked'), stat(cf.ptoCap+' hrs', 'most you can bank')),
      h('p',{class:'small muted'},'From the home\'s written policy. Time-off requests are made on the schedule.'), VIEWS.schedule ? h('a',{href:'#/schedule',class:'small'},mine ? 'Ask for time off on the schedule' : 'Open the schedule') : null));
    b.append(card('', h('h2',null,'History'), h('div',{class:'tablewrap'}, h('table',{class:'t'}, h('thead',null,h('tr',null,['Date','Kind','Hours','Note'].map(x => h('th',null,x)))), h('tbody',null, led.slice().reverse().map(x => h('tr',null, h('td',null,fmtDate(x.date)), h('td',null,x.kind), h('td',null,(x.kind==='Used'?'−':'+')+x.hrs), h('td',null,x.note||'')))))),
      reqs.length ? h('p',{class:'small'},reqs.length+' time-off request'+(reqs.length===1?'':'s')+' on the schedule ('+reqs.filter(r => r.status==='Approved').length+' approved).') : null));
    if (!isBoss() || mine) return;
    const kind = sel(['Earned','Used','Adjustment'], 'Used'), hrs = h('input',{type:'number',min:'0',step:'0.5',value:'8'}), d = h('input',{type:'date',value:today()}), note = inp('');
    b.append(card('', h('h2',null,'Add to the ledger'), h('div',{class:'grid g2'}, field('Kind', kind), field('Hours', hrs), field('Date', d), field('Note', note)),
      h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ const v = +hrs.value; if (!v) return; if (kind.value !== 'Used' && ptoBal(n)+v > cf.ptoCap) toast('That goes over the '+cf.ptoCap+'-hour cap in your policy'); led.push({date:d.value, hrs:v, kind:kind.value, note:note.value, by:actor()}); save(); A.route(); }},'Save'))));
  }

  // onboarding and offboarding
  function onb(b, n){
    const c = st(), pe = c.people[n], mine = n === me(), done = c.onb[n] = c.onb[n] || {}, canEdit = isBoss() && !mine;
    const phases = [...new Set(ONB.map(o => o.phase))];
    const k = ONB.filter(o => done[o.id]).length;
    b.append(card('', h('h2',null,'Onboarding'), h('div',{class:'bar calm'}, h('i',{style:'width:'+Math.round(k/ONB.length*100)+'%'})), h('p',{class:'small'},k+' of '+ONB.length+' done'),
      phases.map(ph => h('div',null, h('h3',null,ph), h('ul',{class:'tourlist'}, ONB.filter(o => o.phase === ph).map(o => { const id = 'ob'+o.id; const cb = h('input',{type:'checkbox',id,checked:!!done[o.id],disabled:!canEdit||null}); cb.addEventListener('change',()=>{ if (cb.checked) done[o.id] = today(); else delete done[o.id]; save(); A.route(); }); return h('li',null, cb, h('label',{for:id,class:done[o.id]?'done':''}, o.t+(done[o.id]?' ('+fmtDate(done[o.id])+')':''))); }))))));
    if (!canEdit) return;
    const off = pe.off = pe.off || {};
    const box = card('', h('h2',null,'Offboarding'), h('p',{class:'small muted'},'When someone leaves. Keep the reason factual. The file is kept, not deleted, for the times on Record keeping.'),
      h('ul',{class:'tourlist'}, OFFB.map(o => { const id = 'of'+o.id; const cb = h('input',{type:'checkbox',id,checked:!!off[o.id]}); cb.addEventListener('change',()=>{ if (cb.checked) off[o.id] = today(); else delete off[o.id]; save(); }); return h('li',null, cb, h('label',{for:id}, o.t)); })));
    if (pe.status === 'Active' && isOwner()){ const d = h('input',{type:'date',value:today()}), why = sel(['Resigned','Ended by the home','Retired','Seasonal or temporary end','Other'], 'Resigned');
      box.append(h('div',{class:'grid g2'}, field('Last day', d), field('Reason', why)), h('div',{class:'row'}, h('button',{class:'btn quiet',type:'button',onclick:()=>{ pe.status = 'Former ('+why.value.toLowerCase()+')'; pe.end = d.value; save(); toast('Marked as former staff. Retention dates are set.'); A.route(); }},'Mark as former staff'))); }
    else if (pe.status !== 'Active'){ const r = retainDates(n); box.append(h('p',{class:'small'},'Ended '+fmtDate(pe.end)+'. Keep the personnel file until '+fmtDate(r.personnel)+', the I-9 until '+fmtDate(r.i9)+', tax forms until '+fmtDate(r.tax)+'.'));
      const lh = h('input',{type:'checkbox',id:'lh'+uid(),checked:!!pe.legalHold}); lh.addEventListener('change',()=>{ pe.legalHold = lh.checked; save(); }); box.append(h('label',{class:'checkrow',for:lh.id}, lh, 'Legal hold (a claim or complaint): keep everything until it is lifted')); }
    b.append(box);
  }

  // documents (test: names only, no file contents are stored)
  function docs(b, n){
    const c = st(), mine = n === me(), list = c.docs.filter(d => d.who === n && (d.area !== 'medical' || mine || canSee(n, 'medical')));
    const AREA = {personnel:'Personnel file', medical:'Medical file (locked)', i9:'I-9 file (kept apart)'};
    b.append(card('', h('h2',null,'Documents'), h('p',{class:'small muted'},'Test version: only the name is saved, never the file. The live version keeps files encrypted, sorted into the personnel, medical and I-9 files so each has its own access.'),
      Object.keys(AREA).map(a => { const ds = list.filter(d => d.area === a); return ds.length ? h('div',null, h('h3',null,AREA[a]), h('div',{class:'list'}, ds.map(d => h('div',{class:'item'}, h('div',{class:'meta'}, chip(d.kind,'grey'), h('span',null,fmtDate(d.at)+' · '+d.by)), h('b',null,d.name))))) : null; }),
      !list.length ? h('p',{class:'muted'},'Nothing yet.') : null));
    if (!isBoss() && !mine) return;
    const f = h('input',{type:'file',accept:'.pdf,.jpg,.jpeg,.png,.doc,.docx'}), kind = sel(['Signed job description','Offer letter','Certificate or card','Policy sign-off','Health screening','Accommodation note','Form I-9','W-4 or WT-4','Other'], 'Certificate or card');
    b.append(card('', h('h2',null, mine ? 'Add a document (like a CPR card)' : 'Add a document'), h('div',{class:'grid g2'}, field('File', f), field('What it is', kind)),
      h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ const file = f.files && f.files[0]; if (!file) return toast('Pick a file');
        const ar = /Health|Accommodation/.test(kind.value) ? 'medical' : /I-9/.test(kind.value) ? 'i9' : 'personnel';
        c.docs.push({id:uid(), who:n, area:ar, kind:kind.value, name:file.name, at:new Date().toISOString(), by:actor()}); f.value = ''; save(); toast('Filed in the '+AREA[ar].toLowerCase()); A.route(); }},'Add'))));
  }

  // individual insights: development focused, shared with the person, no scores
  function ins(b, n){
    const c = st(), pe = c.people[n], sid = pe.site, tr = rec(sid, n) || {};
    b.append(card('soft', h('p',{class:'small'},'A look back to support growth and fair scheduling. The employee sees the same page. No productivity scores, no rankings, and nothing from the development check-in.')));
    const t0 = today(), from = addDays(t0, -28);
    let shifts = [];
    try { shifts = X().shiftsAt(sid).filter(s => s.staff === n && s.date >= from && s.date < t0); } catch(e){}
    const hrs = shifts.reduce((t, s) => t + (s.kind === 'training' ? 0 : X().mins(s)/60), 0);
    const nights = shifts.filter(s => s.kind !== 'training' && (s.start >= '18:00' || s.start < '05:00')).length;
    const wkend = shifts.filter(s => [0,6].includes(new Date(s.date+'T12:00:00').getDay())).length;
    const train = shifts.filter(s => s.kind === 'training').length;
    const pf = pe.pref || {};
    b.append(card('', h('h2',null,'The last 4 weeks'), h('div',{class:'grid g4'}, stat(String(shifts.length - train), 'shifts worked'), stat(Math.round(hrs)+' hrs', 'scheduled hours'), stat(String(nights), 'evening or night shifts'), stat(String(wkend), 'weekend shifts')),
      pf.max && hrs/4 > pf.max ? h('p',{class:'small'},'Averaging '+Math.round(hrs/4)+' hours a week, more than the '+pf.max+' they asked for. Worth a check-in about workload.') : null,
      pf.shifts && /Night/i.test(pf.shifts) === false && nights > (shifts.length-train)/2 ? h('p',{class:'small'},'Most shifts were evenings or nights, but they prefer '+pf.shifts.toLowerCase()+'.') : null));
    const certs = ((S().academy||{}).certs||[]).filter(x => x.who === n);
    b.append(card('', h('h2',null,'Growth'), h('div',{class:'grid g3'}, stat(tenure(pe.hire), 'with the home'), stat((tr.hours||0)+(tr.need?' of '+tr.need:''), 'training hours this year'), stat(String(certs.length), 'Academy certificates')),
      (() => { const next = [addMonths(pe.hire, 12*Math.ceil(Math.max(1, -daysTo(pe.hire)/365)))].map(d => d)[0]; return h('p',{class:'small'},'Next work anniversary: '+fmtDate(next)+'.'); })()));
    const kud = c.kudos.filter(k => k.to === n), gave = c.kudos.filter(k => k.from === n);
    b.append(card('', h('h2',null,'Recognition'), h('p',null,kud.length+' thank-you'+(kud.length===1?'':'s')+' received, '+gave.length+' given.'), kud.slice(0,3).map(k => h('p',{class:'small'},'"'+k.text+'" ('+k.from+')'))));
    const rv = c.reviews.filter(r => r.who === n);
    b.append(card('', h('h2',null,'Reviews'), rv.length ? h('div',{class:'list'}, rv.map(r => h('div',{class:'item'}, h('b',null,r.period), h('span',{class:'small'},'Goals: '+r.goals)))) : h('p',{class:'small muted'},'No reviews yet.')));
    // the person's own questions, concerns and ideas from the staff voice log (choices.js), never anonymous ones
    try { if (window.SSVoice && SSVoice.card){ const el = SSVoice.card(sid, n); if (el) b.append(el); } } catch(e){ console.error(e); }
    profileHooks.forEach(f => { try { f(b, {site:sid, name:n, mine:n === me(), tier:T()}); } catch(e){ console.error(e); } });
  }
  const profileHooks = [];

  // inspection: the employee's request, and a printable file
  function inspectMine(b, n){
    const c = st(), mine = n === me(), yr = String(new Date().getFullYear()), reqs = c.inspect.filter(r => r.who === n);
    b.append(card('soft', h('h2',null,'Your right to see your file'), h('ul',{class:'small'}, H.INSPECT.points.map(p => h('li',null,p))), h('p',{class:'small'}, src('s10313'))));
    if (mine){ const t = area('', {rows:'2'}); const used = reqs.filter(r => r.at.slice(0,4) === yr).length;
      b.append(card('', h('h2',null,'Ask to see my file'), h('p',{class:'small'},'You have asked '+used+' time'+(used===1?'':'s')+' this year. The home must allow at least 2.'), field('What would you like to see? (optional)', t),
        h('div',{class:'row'}, h('button',{class:'btn',type:'button',onclick:()=>{ c.inspect.unshift({id:uid(), site:c.people[n].site, who:n, at:new Date().toISOString(), due:workdays(today(), 7), status:'Requested', note:t.value.trim()}); save(); toast('Sent. Your manager has 7 working days.'); A.route(); }},'Send request'))));
      const seen = c.log.filter(l => l.file === n).slice(0, 25);
      b.append(card('', h('h2',null,'Who opened your file'), seen.length ? h('div',{class:'list'}, seen.map(l => h('div',{class:'item'}, h('div',{class:'meta'}, h('span',null,fmtTime(l.at)), chip(l.tier,'grey')), h('span',{class:'small'},l.who+': '+l.part)))) : h('p',{class:'small muted'},'No one yet.')));
    }
    if (reqs.length) b.append(card('', h('h2',null,'Requests'), h('div',{class:'list'}, reqs.map(r => h('div',{class:'item'}, h('div',{class:'meta'}, chip(r.status, r.status==='Done'?'calm':'amber'), h('span',null,'Asked '+fmtDate(r.at)), r.status!=='Done' ? h('span',null,'Due by '+fmtDate(r.due)) : null))))));
    if (isBoss() || mine) b.append(card('', h('h2',null,'Printable copy'), h('p',{class:'small muted'},'Everything the employee may see: compliance, write-ups, reviews, pay history and non-planning notes. Medical records print from the medical file. Copies may cost no more than the actual cost to copy.'),
      h('div',{class:'row'}, h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ download('personnel-file-'+n.replace(/\W+/g,'-').toLowerCase()+'.txt','text/plain', printable(n)); c.log.unshift({at:new Date().toISOString(), who:actor(), tier:tier().name, file:n, part:'Printed a copy', site:siteOf(n)}); save(); }},'Download a copy (.txt)'))));
  }
  function printable(n){
    const c = st(), pe = c.people[n], L = [];
    L.push('PERSONNEL FILE (sample) - '+n, siteName(pe.site)+' · '+pe.role+' · started '+pe.hire, 'Printed '+new Date().toLocaleString(), '');
    L.push('COMPLIANCE'); reqsFor(n).forEach(r => L.push('- '+r.t+': '+itemState(n, r).label)); L.push('');
    L.push('WRITE-UPS'); c.writeups.filter(w => w.who === n).forEach(w => { L.push('- '+w.date+' '+((H.STEPS.find(s => s.id===w.step)||{}).t||w.step)+': '+w.facts, '  Expected: '+w.expect, w.response ? '  Employee response: '+w.response : ''); c.statements.filter(s => s.about === 'wu:'+w.id).forEach(s => L.push('  Employee statement: '+s.text)); }); L.push('');
    L.push('REVIEWS'); c.reviews.filter(r => r.who === n).forEach(r => L.push('- '+r.period+': '+r.examples, '  Goals: '+r.goals)); L.push('');
    L.push('PAY HISTORY'); c.pay.filter(p => p.who === n && p.status === 'Approved').forEach(p => L.push('- '+p.eff+' '+p.kind+': '+p.from+' to '+p.to+(p.role?' ('+p.role+')':''))); L.push('');
    L.push('NOTES'); c.notes.filter(x => x.who === n && !/^Planning/.test(x.kind)).forEach(x => { L.push('- '+x.at.slice(0,10)+' '+x.kind+': '+x.text); c.statements.filter(s => s.about === 'note:'+x.id).forEach(s => L.push('  Employee statement: '+s.text)); });
    return L.filter(x => x !== '').join('\n');
  }

  // ---------- birthdays and milestones ----------
  function upcoming(days){
    const c = st(), out = [], t = new Date(today()+'T12:00:00'), boss = isBoss(), cf = cfg(S().site);
    const nextOf = md => { const [m, d] = md.split('-').map(Number); let x = new Date(t.getFullYear(), m-1, d, 12); if (x < t) x = new Date(t.getFullYear()+1, m-1, d, 12); return x; };
    const within = x => (x - t)/864e5 <= days;
    staffOf(S().site).forEach(n => { const pe = c.people[n]; if (!pe) return;
      const mine = n === me();
      const showB = pe.bday && (mine || pe.share.bday === 'team' && cf.teamCelebrate || pe.share.bday !== 'private' && boss && cf.remindBday);
      if (showB){ const x = nextOf(pe.bday); if (within(x)) out.push({d:x, kind:'Birthday', who:n, ic:'🎂', text:n+'\'s birthday', staff:true}); }
      const showA = mine || pe.share.anniv === 'team' && cf.teamCelebrate || pe.share.anniv !== 'private' && boss && cf.remindAnniv;
      if (showA && pe.hire){ const x = nextOf(pe.hire.slice(5)); const yrs = x.getFullYear() - +pe.hire.slice(0,4); if (yrs > 0 && within(x)) out.push({d:x, kind:'Work anniversary', who:n, ic:'🎉', text:n+': '+yrs+' year'+(yrs===1?'':'s')+' with the home', staff:true}); }
    });
    if (S().tier !== 'family') (A.residents ? A.residents() : []).forEach(r => {
      const f = window.SSFace && SSFace.face ? SSFace.face(r.code) : null;
      if (f && f.dob){ const x = nextOf(f.dob.slice(5)); if (within(x)) out.push({d:x, kind:'Resident birthday', who:r.code, ic:'🎂', text:r.nick+' ('+r.code+') turns '+(x.getFullYear() - +f.dob.slice(0,4)), helps:(f.helps||[]).slice(0,2), res:r.code}); }
      ((c.resDates[S().site]||{})[r.code]||[]).forEach(m => { const x = nextOf(m.md); if (within(x)) out.push({d:x, kind:'Meaningful date', who:r.code, ic:'💛', text:r.nick+' ('+r.code+'): '+m.t, note:m.note, res:r.code}); });
    });
    return out.sort((a,b) => a.d - b.d);
  }
  R.celebrate = v => {
    st();
    if (S().tier === 'family'){ v.append(head('Birthdays and milestones','Not used in family caregiving', null)); return; }
    const pe = st().people[me()];
    v.append(head('Team · '+siteName(S().site), 'Birthdays and milestones', 'Birthdays people chose to share, work anniversaries, and resident dates that matter, with ideas from what helps them.'));
    const list = upcoming(45);
    v.append(card('', h('h2',null,'Next 45 days'), list.length ? h('div',{class:'list'}, list.map(x => h('div',{class:'item'}, h('div',{class:'meta'}, h('span',null,x.d.toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric'})), chip(x.kind, x.staff?'calm':'grey')), h('b',null,x.ic+' '+x.text),
      x.note ? h('span',{class:'small'},x.note) : null, x.helps && x.helps.length ? h('span',{class:'small'},'What they enjoy: '+x.helps.join('; ')) : null,
      x.res && VIEWS.face ? h('a',{class:'small',href:'#/face/'+encodeURIComponent(x.res)},'Face sheet and what helps') : null))) : h('p',{class:'muted'},'Nothing in the next 45 days.'),
      h('p',{class:'small muted'},'Resident ages and dates come from the face sheet and stay inside the home. Use first names only on any card or sign.')));
    if (pe){
      const b1 = sel([['private','Only me'],['manager','Me and my managers'],['team','The whole team']], pe.share.bday), b2 = sel([['private','Only me'],['manager','Me and my managers'],['team','The whole team']], pe.share.anniv);
      const md = h('input',{type:'text',value:pe.bday||'',placeholder:'MM-DD',maxlength:'5',pattern:'[0-1][0-9]-[0-3][0-9]',inputmode:'numeric'});
      v.append(card('', h('h2',null,'My privacy choices'), h('p',{class:'small muted'},'Your birthday is never required. Only the month and day are kept, not the year.'),
        h('div',{class:'grid g3'}, field('My birthday (MM-DD)', md), field('Who sees my birthday', b1), field('Who sees my work anniversary', b2)),
        h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ if (md.value && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(md.value)) return toast('Use MM-DD, like 03-22'); pe.bday = md.value; pe.share = {bday:b1.value, anniv:b2.value}; save(); toast('Saved'); A.route(); }},'Save'))));
    }
    if (isBoss()){
      const res = A.residents ? A.residents() : [];
      const who = sel(res.map(r => [r.code, r.nick+' ('+r.code+')']), res[0] && res[0].code), md = h('input',{type:'text',placeholder:'MM-DD',maxlength:'5'}), t = inp('', {placeholder:'e.g. Daughter\'s birthday'}), note = inp('', {placeholder:'What helps on that day'});
      v.append(card('', h('h2',null,'Add a resident\'s meaningful date'), h('p',{class:'small muted'},'Anniversaries, a late spouse\'s birthday, a holiday from their culture or faith. Some dates are hard days; say what helps.'),
        h('div',{class:'grid g2'}, field('Resident', who), field('Date (MM-DD)', md), field('What it is', t), field('What helps', note)),
        h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(md.value) || !t.value.trim()) return toast('Add the date (MM-DD) and what it is'); const c = st(); c.resDates[S().site] = c.resDates[S().site]||{}; (c.resDates[S().site][who.value] = c.resDates[S().site][who.value]||[]).push({md:md.value, t:t.value.trim(), note:note.value.trim()}); save(); toast('Added'); A.route(); }},'Add date'))));
    }
  };

  // ---------- home and owner tiles ----------
  (A.homeHooks = A.homeHooks || []).push((v, t) => {
    if (S().site === 'family' || !viewOn()) return;
    try {
      const c = st();
      if (t === 'manager' || t === 'owner'){
        const n = staffOf(S().site).reduce((k, p) => k + summary(p).list.length, 0);
        const soon = upcoming(7);
        v.append(h('div',{class:'grid g2'}, A.tile('hr/due','🪪', n ? 'Employee files: '+n+' to check' : 'Employee files up to date', n ? 'Expired, missing or due within 60 days.' : 'Nothing due in the next 60 days.', n ? 'urgent' : ''),
          soon.length ? A.tile('celebrate','🎂', soon.length+' to celebrate this week', soon.slice(0,2).map(x => x.text).join(' · ')) : null));
      } else if (t === 'caregiver'){
        const n = me(), wus = c.writeups.filter(w => w.who === n && !w.ack).length + c.reviews.filter(r => r.who === n && !r.ack).length;
        const s = summary(n);
        v.append(h('div',{class:'grid g2'}, A.tile('myfile','🪪', wus ? 'My file: '+wus+' to read' : 'My employee file', wus ? 'A review or write-up is waiting for you to read.' : s.list.length ? s.list.length+' item'+(s.list.length===1?'':'s')+' coming due.' : 'Everything is up to date.', wus ? 'urgent' : '')));
      }
    } catch(e){ console.error(e); }
  });
  (A.ownerHooks = A.ownerHooks || []).push(v => {
    if (!viewOn()) return;
    const c = st(), wait = c.pay.filter(p => p.status === 'Proposed').length, fix = SITES.flatMap(s => staffOf(s)).filter(n => summary(n).expired || summary(n).missing).length;
    v.append(card('', h('h2',null,'🪪 Employee files'), h('p',null, (wait ? wait+' pay change'+(wait===1?'':'s')+' waiting for you. ' : '')+(fix ? fix+' staff file'+(fix===1?' has':'s have')+' something expired or missing.' : 'Every file is current.')), h('a',{href:'#/hr'},'Open employee files')));
  });

  window.SSHR = {summary, itemState, canSee, upcoming, ptoBal, profileHooks};
  try { applyPay(); } catch(e){}
})();
