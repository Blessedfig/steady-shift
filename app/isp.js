// Steady Shift test app: Individual Service Plans (#/isp).
// DHS 88 / DHS 83 timelines, suggestions pre-filled from the resident's record and public plan formats (each shows its source),
// a guided walkthrough for new managers, an auto-made staff summary with tracked read-and-acknowledge,
// participation and signatures, review reminders and version history. Sample residents only.
(function(){
  const A = window.SSApp, D = window.SS_DATA, L = window.SS_ISP_LIB;
  if (!A || !D || !L) return;
  const h = A.h, S = () => A.state(), save = () => A.save(), toast = A.toast;
  const uid = () => Math.random().toString(36).slice(2,9);
  const today = () => new Date().toISOString().slice(0,10);
  const addDays = (d, n) => { const x = new Date(String(d).slice(0,10)+'T12:00:00'); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); };
  const addMonths = (d, n) => { const x = new Date(String(d).slice(0,10)+'T12:00:00'); x.setMonth(x.getMonth()+n); return x.toISOString().slice(0,10); };
  const daysTo = d => Math.round((new Date(String(d).slice(0,10)+'T12:00:00') - new Date(today()+'T12:00:00')) / 864e5);
  const fmt = s => { if (!s) return ''; const d = new Date(String(s).length===10 ? s+'T12:00:00' : s); return isNaN(d) ? s : d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); };
  const site = () => D.SITES.find(s => s.id === S().site) || D.SITES[0];
  const setting = () => site().setting;
  const tierName = () => (D.TIERS.find(t => t.id === S().tier) || {name:'Someone'}).name;
  const MGR = ['manager','rn','owner','multi'];
  const isMgr = () => MGR.includes(S().tier);
  const residents = () => D.RESIDENTS[S().site] || [];
  const resObj = code => residents().find(r => r.code === code);
  const key = (sid, code) => sid+'/'+code;
  const me = () => { try { if (window.SSSched && SSSched.me) return SSSched.me(); } catch(e){} return tierName(); };
  const staffNames = sid => { let n = []; try { if (window.SSSched && SSSched.staffNames) n = SSSched.staffNames(sid) || []; } catch(e){} return n.length ? n : ['Caregiver A','Caregiver B','Caregiver C','Caregiver D']; };
  const chip = (t, c) => h('span',{class:'chip'+(c?' '+c:'')},t);
  const lines = t => String(t||'').split('\n').map(x => x.trim()).filter(Boolean);
  function audit(what){ try { if (window.SSAccess && SSAccess.log) return SSAccess.log(what, S().site); } catch(e){} const s = S(); if (Array.isArray(s.audit)) s.audit.unshift({at:new Date().toISOString(), who:tierName()+' (you)', what, site:s.site}); }

  // ---------- state ----------
  function st(){ const s = S(); if (!s.isp || s.isp.v !== 1){ s.isp = {v:1, plans:{}, guide:true, seeded:false}; } if (!s.isp.seeded) seed(s.isp); return s.isp; }
  function plan(sid, code){ const P = st().plans; return P[key(sid,code)] || (P[key(sid,code)] = {site:sid, code, versions:[], draft:null, acks:{}, sigs:{}, copies:{}, reminded:{}}); }
  const cur = p => p.versions[p.versions.length-1] || null;
  // The face sheet (facesheet.js) is the main record when it is installed; the library's sample details fill the gaps.
  function person(sid, code){
    const base = Object.assign({}, L.PEOPLE[key(sid,code)] || {});
    let f = null; try { f = window.SSFace && SSFace.face ? SSFace.face(code) : null; } catch(e){}
    if (!f) return base;
    const dx = (f.dx||[]).filter(x => !/See the service plan/.test(x));
    const dec = f.guardian ? f.guardian.name+' ('+f.guardian.type+')' : f.poa ? f.poa.name+' ('+f.poa.type+(f.poa.activated ? ', activated' : ', not activated: the resident decides')+')' : '';
    return Object.assign(base, {
      dx: dx.length ? dx : base.dx || [],
      likes: [f.history, f.culture].filter(x => x && !/^Sample resident/.test(x)).length ? [f.history, f.culture].filter(Boolean) : base.likes || [],
      helps: (f.helps||[]).concat(f.calm||[]).length ? [...new Set([...(f.helps||[]), ...(f.calm||[])])] : base.helps || [],
      triggers: f.triggers || [], mobility: f.mobility || '', falls: f.risks ? f.risks.fall : '', elope: f.risks ? f.risks.elope : '', choke: f.risks ? f.risks.choke : '',
      comm: f.comm || base.comm || '', faith: f.faith || base.faith || '',
      code: f.code ? f.code+(f.docs ? ' ('+f.docs+')' : '') : base.code,
      decides: dec || base.decides || 'The resident',
      fromFace: true
    });
  }
  function admitOf(sid, code){
    const p = plan(sid, code); if (p.admit) return p.admit;
    const r = (D.RESIDENTS[sid]||[]).find(x => x.code === code) || {};
    return r.admitted || person(sid, code).admit || addDays(today(), -400);
  }
  const months = sid => { const set = (D.SITES.find(s => s.id === sid)||{}).setting || 'afh'; return ((L.REQ[set]||L.REQ.afh).items.find(i => i.k === 'review')||{}).months || 12; };

  // ---------- evidence from the resident's record ----------
  function evidence(sid, code){
    const out = [], add = (text, from) => { if (text) out.push({text:String(text), from}); };
    const r = (D.RESIDENTS[sid]||[]).find(x => x.code === code) || {};
    add(r.note, 'Resident notes');
    const pp = person(sid, code);
    (pp.dx||[]).forEach(x => add(x, 'Diagnosis (resident record)'));
    (pp.helps||[]).forEach(x => add(x, 'What helps (resident record)'));
    (pp.triggers||[]).forEach(x => add(x, 'Face sheet: watch for'));
    if (pp.mobility) add(pp.mobility, 'Face sheet: mobility');
    if (/High|Medium/.test(pp.falls||'')) add('Fall risk '+pp.falls, 'Face sheet: risks');
    if (/High/.test(pp.elope||'')) add('Wandering or leaving risk high', 'Face sheet: risks');
    if (/High/.test(pp.choke||'')) add('Choking risk high, swallow precautions', 'Face sheet: risks');
    try { (window.SS_ordersFor ? SS_ordersFor(sid, code) : []).forEach(o => { add(o.text, 'Order, nurse-checked ('+(o.prescriber||'prescriber')+')'); if (o.diet) add([o.diet.texture, o.diet.liquids].join(' '), 'Diet order'); }); } catch(e){}
    try { const ip = window.SS_residentProfile && SS_residentProfile(sid, code); const ho = ip && ip.handoff;
      if (ho){ add(ho.summary, 'Admission intake'); (ho.risks||[]).forEach(x => add(x, 'Admission intake: risk')); (ho.triggers||[]).forEach(x => add(x, 'Admission intake: trigger')); (ho.whatHelps||[]).forEach(x => add(x, 'Admission intake: what helps')); } } catch(e){}
    return out;
  }
  function matches(sid, code){
    const ev = evidence(sid, code);
    return L.LIB.map(item => {
      const from = item.always ? [] : ev.filter(e => item.on && item.on.test(e.text));
      return (item.always || from.length) ? {item, from} : null;
    }).filter(Boolean);
  }
  function fromLib(m, nick){
    const it = m.item;
    return {id:uid(), lib:it.id, dom:it.dom, need:it.need, goal:it.goal.replace('[Name]', nick), steps:it.steps.slice(), measure:it.measure, who:'All caregivers on shift', freq:'', src:it.src,
      from:m.from.map(f => f.from+': "'+f.text.slice(0,90)+'"').slice(0,3), edited:false};
  }
  // A first draft built from the record and the suggestion library. Every part is editable and keeps its source.
  function draftFrom(sid, code){
    const r = (D.RESIDENTS[sid]||[]).find(x => x.code === code) || {nick:code};
    const pp = person(sid, code), ms = matches(sid, code);
    const about = [
      pp.likes && pp.likes.length ? 'My story and what I enjoy: '+pp.likes.join('; ')+'.' : '',
      pp.helps && pp.helps.length ? 'What helps me: '+pp.helps.join('; ')+'.' : '',
      pp.comm ? 'How to talk with me: '+pp.comm : '',
      pp.faith ? 'Faith and culture: '+pp.faith : '',
      (() => { try { const cl = window.SSChoices ? SSChoices.planLines(sid, code) : []; return cl.length ? 'From the choices log:\n'+cl.map(l => '- '+l).join('\n') : ''; } catch(e){ return ''; } })(),
      'Ask '+r.nick+': "What should staff always know about you?" and add it here in their words.'
    ].filter(Boolean).join('\n');
    const needs = ms.filter(m => m.item.need && !m.item.always).map(m => m.item.need);
    const assess = [(pp.dx||[]).length ? 'Diagnoses: '+pp.dx.join('; ')+'.' : '', needs.length ? 'Needs found:\n'+needs.map(n => '- '+n).join('\n') : '', 'Strengths: (add what they do on their own)'].filter(Boolean).join('\n');
    const rights = ms.find(m => m.item.id === 'norestr');
    return {
      assessDate:'', assessBy:'', about, aboutSrc:['Resident record','Wisconsin Family Care member-centered plan format (public)'], assess,
      goals:ms.filter(m => m.item.sec === 'goals').map(m => fromLib(m, r.nick)),
      risks:ms.filter(m => m.item.sec === 'risks').map(m => fromLib(m, r.nick)),
      rights:rights ? rights.item.goal.replace('[Name]', r.nick) : '', restr:[],
      team:[{role:'resident', name:r.nick+' (sample)'}].concat(pp.decides && !/^(Herself|Himself|The resident)$|not activated/.test(pp.decides) ? [{role:'rep', name:pp.decides.replace(/ \(.*$/,'')}] : []).concat([{role:'mgr', name:'House manager'}]),
      code:pp.code || '', decides:pp.decides || '', evac:pp.evac || '',
      reviewMonths:months(sid), triggers:'Any fall with injury or 2 falls in 30 days; a hospital or ER stay; new or changed orders; a new behavior; the resident or guardian asks.'
    };
  }

  // ---------- versions ----------
  function sectionText(d, sec){
    const g = x => [x.dom+': '+x.goal, x.need ? 'Need: '+x.need : '', ...x.steps.map(s => '- '+s), x.measure ? 'Measure: '+x.measure : '', x.who ? 'Who: '+x.who+(x.freq ? ', '+x.freq : '') : ''].filter(Boolean).join('\n');
    switch (sec){
      case 'about': return d.about;
      case 'assess': return ['Assessed '+(d.assessDate ? fmt(d.assessDate) : '(date missing)')+(d.assessBy ? ' by '+d.assessBy : ''), d.assess].join('\n');
      case 'goals': return d.goals.map(g).join('\n\n');
      case 'risks': return [d.risks.map(g).join('\n\n'), 'Code status: '+(d.code||'not recorded'), 'Who decides: '+(d.decides||'not recorded'), 'Evacuation: '+(d.evac||'not recorded')].join('\n');
      case 'rights': return [d.rights].concat(d.restr.map(x => 'Restriction: '+x.desc+' (review '+fmt(x.review)+')')).join('\n');
      case 'team': return d.team.map(t => roleName(t.role)+': '+t.name).join('\n');
      case 'review': return 'Every '+d.reviewMonths+' months\nAlso when: '+d.triggers;
    }
    return '';
  }
  const roleName = k => (L.ROLES.find(r => r.k === k)||{t:k}).t;
  function changedSecs(a, b){ return L.SECTIONS.filter(s => !a || sectionText(a, s.id) !== sectionText(b, s.id)).map(s => s.id); }
  function finalize(p, reason){
    const prev = cur(p), d = JSON.parse(JSON.stringify(p.draft));
    const v = {n:(prev ? prev.n : 0)+1, at:new Date().toISOString(), by:tierName()+' (you)', reason, data:d, changed:changedSecs(prev && prev.data, d)};
    p.versions.push(v); p.draft = null; p.sigs[v.n] = {};
    audit('Finished care plan v'+v.n+' for '+p.code+' ('+reason+')');
    save(); return v;
  }

  // ---------- staff summary (one screen, plain language) ----------
  const CALL = {fall:'After any fall, even if they seem fine.', ins:'Blood sugar outside the range in the order, or signs of low sugar that don\'t get better.', neb:'Harder breathing, a color change, or a treatment that doesn\'t help.', eve:'Evening changes that are new or worse.', skin:'Redness that does not fade, or any open skin.', diet:'Coughing or a wet voice while eating or drinking.', home:'If they get outside alone, use Night help: Missing resident.', refuse:'3 refusals in 7 days, or a skin or health concern.', prn:'If an as-needed dose is needed more than the order allows.', mh:'Big changes in sleep, mood or eating.'};
  function summary(p, v){
    const d = v.data, r = resObj(p.code) || {nick:p.code};
    const all = d.goals.concat(d.risks);
    return {
      nick:r.nick, rc:p.code, version:v.n, at:v.at,
      matters:lines(d.about).filter(l => !/^Ask /.test(l)).slice(0,4),
      help:all.filter(g => g.lib !== 'evac').map(g => ({dom:g.dom, steps:g.steps.slice(0,2)})).filter(x => x.steps.length).slice(0,7),
      watch:d.risks.filter(g => g.lib !== 'evac').map(g => g.need).filter(Boolean).concat(d.goals.filter(g => /behavior|Feelings/i.test(g.dom)).map(g => g.need)).filter(Boolean).slice(0,5),
      call:[...new Set(all.map(g => CALL[g.lib]).filter(Boolean))].slice(0,4).concat(['New confusion, fever, pain, or not eating or taking meds for a day: tell the nurse or manager.']),
      rights:d.rights, restr:d.restr.map(x => x.desc),
      code:d.code || 'Ask the nurse or manager', decides:d.decides || 'Ask the manager', evac:d.evac || 'Ask the manager',
      changed:v.n > 1 ? v.changed.map(id => (L.SECTIONS.find(s => s.id === id)||{t:id}).t) : [], reason:v.n > 1 ? v.reason : ''
    };
  }
  function ackState(p, name){ const v = cur(p); if (!v) return 'none'; const a = p.acks[name]; return !a ? 'never' : a.v >= v.n ? 'ok' : 'stale'; }
  function ack(p){ const v = cur(p); p.acks[me()] = {v:v.n, at:new Date().toISOString()}; audit('Read and acknowledged the care plan summary for '+p.code+' (v'+v.n+')'); save(); toast('Thanks. Your acknowledgment is saved.'); }
  function summaryCard(p, opts){
    opts = opts || {};
    const v = cur(p); if (!v) return h('div',{class:'card warn'}, h('p',null,'No finished care plan yet for '+p.code+'. Follow the admission handoff and ask the manager.'));
    const s = summary(p, v), state = ackState(p, me());
    const box = h('section',{class:'card isp-sum','aria-label':'Care plan summary for '+s.nick},
      h('div',{class:'meta'}, chip(s.rc), chip('Plan version '+s.version,'grey'), chip('Updated '+fmt(s.at),'grey'), opts.noAck ? null : state === 'ok' ? chip('✓ You read this version','calm') : state === 'stale' ? chip('Updated since you last read it','amber') : chip('Not read yet','amber')),
      h('h2',null, s.nick+' (sample): what staff need to know'),
      s.changed.length ? h('div',{class:'house gap'}, h('b',null,'What changed: '), s.changed.join(', ')+(s.reason ? '. Why: '+s.reason : '')) : null,
      h('div',{class:'isp-band'},
        h('div',null, h('span',null,'Code status'), h('b',null,s.code)),
        h('div',null, h('span',null,'Who decides'), h('b',null,s.decides)),
        h('div',null, h('span',null,'In a fire'), h('b',null,s.evac))),
      h('div',{class:'grid g2'},
        h('div',null, h('h3',null,'🌱 What matters to them'), h('ul',{class:'small'}, s.matters.map(x => h('li',null,x)))),
        h('div',null, h('h3',null,'👀 Watch for'), s.watch.length ? h('ul',{class:'small'}, s.watch.map(x => h('li',null,x))) : h('p',{class:'small muted'},'Nothing special beyond normal care.'))),
      h('div',null, h('h3',null,'🤝 How to help'), h('ul',{class:'small'}, s.help.map(x => h('li',null, h('b',null,x.dom+': '), x.steps.join(' '))))),
      h('div',{class:'grid g2'},
        h('div',null, h('h3',null,'📞 Tell the nurse or manager'), h('ul',{class:'small'}, s.call.map(x => h('li',null,x)))),
        h('div',null, h('h3',null,'🗝️ Rights and choices'), h('p',{class:'small'}, s.restr.length ? 'Limits in place (follow exactly, see the full plan): '+s.restr.join('; ') : s.rights || 'No limits on their rights.')))
    );
    if (!opts.noAck){
      const btn = h('button',{class:'btn',type:'button',onclick:()=>{ ack(p); if (opts.after) opts.after(); else A.route(); }}, state === 'stale' ? 'I read the changes and understand them' : 'I read this and understand it');
      box.append(state === 'ok' ? h('p',{class:'small muted'},'You acknowledged version '+p.acks[me()].v+' on '+fmt(p.acks[me()].at)+'.') : h('div',{class:'row noprint'}, btn, h('span',{class:'small muted'},'Saved with your name and the time. Questions? Ask before your shift starts.')));
    }
    box.append(h('div',{class:'row noprint'}, isMgr() || opts.full ? h('a',{class:'btn ghost sm',href:'#/isp/'+encodeURIComponent(p.code)},'Full plan') : null, h('button',{class:'btn quiet sm',type:'button',onclick:()=>window.print()},'Print')));
    return box;
  }

  // ---------- status and reminders ----------
  function status(sid, code){
    const p = plan(sid, code), v = cur(p), set = (D.SITES.find(s => s.id === sid)||{}).setting;
    const admit = admitOf(sid, code);
    const out = {p, v, items:[]};
    if (!v){
      const due = addDays(admit, 30), dt = daysTo(due);
      out.items.push({lvl: dt < 0 ? 'red' : dt <= 10 ? 'amber' : 'grey', t: (p.draft ? 'Draft started. ' : 'No plan yet. ')+'Due '+fmt(due)+' ('+(dt < 0 ? (-dt)+' days late' : dt+' days left')+'), 30 days after admission.'});
      if (set === 'cbrf' && daysTo(admit) > -30) out.items.push({lvl:'grey', t:'Until then, staff follow the temporary service plan (DHS 83.35(2)).'});
      out.due = due; return out;
    }
    const due = addMonths(v.at, v.data.reviewMonths || months(sid)), dt = daysTo(due); out.due = due;
    out.items.push({lvl: dt < 0 ? 'red' : dt <= 30 ? 'amber' : 'calm', t:(dt < 0 ? 'Review overdue since ' : 'Next review ')+fmt(due)+(dt >= 0 ? ' ('+dt+' days)' : '')});
    if (p.draft) out.items.push({lvl:'amber', t:'Changes in progress (draft not finished).'});
    try { const newer = (window.SS_ordersFor ? SS_ordersFor(sid, code) : []).filter(o => (o.verifiedAt||o.enteredAt||'') > v.at); if (newer.length) out.items.push({lvl:'amber', t:newer.length+' new order'+(newer.length>1?'s':'')+' since this plan. Check if the plan needs an update.'}); } catch(e){}
    const miss = sigMissing(p, v, set); if (miss.length) out.items.push({lvl:'amber', t:'Signatures missing: '+miss.join(', ')});
    const names = staffNames(sid), notOk = names.filter(n => ackState(p, n) !== 'ok');
    out.acks = {ok:names.length - notOk.length, all:names.length, notOk};
    if (notOk.length) out.items.push({lvl:'amber', t:(names.length - notOk.length)+' of '+names.length+' staff have read the current summary.'});
    return out;
  }
  function sigMissing(p, v, set){
    const sg = p.sigs[v.n] || {};
    const need = set === 'cbrf' ? v.data.team.filter(t => t.role === 'resident' || t.role === 'rep').slice(0, v.data.team.some(t => t.role === 'rep') ? 2 : 1) : v.data.team;
    const done = t => sg[t.role+':'+t.name] && /signed|paper/.test(sg[t.role+':'+t.name].status);
    if (set === 'cbrf'){ const any = need.some(done); return any ? [] : ['resident or legal representative']; }
    return need.filter(t => !done(t)).map(t => roleName(t.role));
  }
  const lvlChip = it => chip(it.t, it.lvl);

  // ---------- seed: sample plans in different states ----------
  function seed(I){
    I.seeded = true;
    const t = today();
    const mk = (sid, code, versions, o) => {
      const p = I.plans[key(sid,code)] = {site:sid, code, versions:[], draft:null, acks:{}, sigs:{}, copies:{}, reminded:{}};
      if (o && o.admit) p.admit = o.admit;
      versions.forEach((x, i) => {
        const d = draftFrom(sid, code); d.assessDate = addDays(x.at, -3); d.assessBy = 'House manager with the RN (sample)';
        if (x.edit) x.edit(d);
        const prev = p.versions[i-1];
        const v = {n:i+1, at:x.at+'T15:00:00', by:x.by || 'House manager (sample)', reason:x.reason, data:d, changed:changedSecs(prev && prev.data, d)};
        p.versions.push(v);
        p.sigs[v.n] = {}; d.team.forEach(tm => { if (x.sign !== false && !(x.skipRole === tm.role)) p.sigs[v.n][tm.role+':'+tm.name] = {status:'signed', how:tm.role === 'rep' ? 'Phone, then e-sign' : 'In person', at:x.at+'T16:00:00', name:tm.name}; });
        p.copies[v.n] = x.sign !== false ? x.at : '';
      });
      const v = cur(p), names = staffNames(sid);
      if (v) names.forEach((n, i) => { const lvl = (o && o.ackOld) ? (i % 2 ? v.n-1 : v.n) : v.n; if (lvl > 0 && !(o && o.skip === i)) p.acks[n] = {v:lvl, at:addDays(v.at, 1)+'T08:00:00'}; });
      return p;
    };
    const noDiet = d => { d.goals = d.goals.filter(g => g.lib !== 'diet'); };
    mk('maple','M-1',[{at:addDays(t,-260), reason:'First plan after admission'},{at:addDays(t,-80), reason:'6-month review: added knee exercises', edit:d => { const f = d.goals.find(g => g.lib === 'fall'); if (f) f.steps.push('Knee exercises from PT, 3 times a week.'); }}]);
    mk('maple','M-2',[{at:addDays(t,-330), reason:'First plan after admission', edit:noDiet},{at:addDays(t,-150), reason:'6-month review', edit:noDiet},{at:addDays(t,-3), reason:'New swallowing order from speech therapy; evening routine changed', skipRole:'cm'}], {ackOld:true});
    const m3 = plan('maple','M-3'); m3.admit = addDays(t,-20); m3.draft = draftFrom('maple','M-3');
    mk('maple','M-4',[{at:addDays(t,-200), reason:'Yearly review'}], {skip:2});
    const b9 = plan('birch','B-9'); b9.admit = addDays(t,-13);
    mk('birch','B-2',[{at:addDays(t,-120), reason:'Yearly review'}]);
    mk('birch','B-5',[{at:addDays(t,-350), reason:'Yearly review'}], {skip:1});
    mk('birch','B-7',[{at:addDays(t,-60), reason:'Added calming steps before as-needed medicine', sign:false}]);
    mk('cedar','C-1',[{at:addDays(t,-90), reason:'6-month review'}]);
    mk('cedar','C-3',[{at:addDays(t,-170), reason:'6-month review'}]);
  }

  // ---------- views ----------
  function tabs(code, now){
    const T = [['','Plan'],['edit','Write or update'],['summary','Staff summary'],['sign','Who took part and signatures'],['history','Versions']];
    return h('nav',{class:'isp-tabs noprint','aria-label':'Care plan sections'}, T.map(([id, t]) => h('a',{href:'#/isp/'+encodeURIComponent(code)+(id ? '/'+id : ''),'aria-current':now === id ? 'page' : null}, t)));
  }
  function reqCard(open){
    const set = setting(), R = L.REQ[set] || L.REQ.afh;
    return h('details',{class:'card soft', open:open || null},
      h('summary',{style:'cursor:pointer'}, h('b',null,'⚖️ What the rules require: '+R.name)),
      h('div',{class:'tablewrap'}, h('table',{class:'t'}, h('thead',null,h('tr',null,h('th',null,'What'),h('th',null,'When'),h('th',null,'Rule'))),
        h('tbody',null, R.items.map(i => h('tr',null, h('td',null,i.t), h('td',null,i.when), h('td',null,i.cite)))))),
      h('p',{class:'foot'}, L.CHECKED+' Federal HCBS person-centered planning (42 CFR 441.301(c)) applies when Medicaid waiver funds pay for the stay. Your care manager\'s plan does not replace the home\'s own plan. Not legal advice.'));
  }
  function pathCard(){
    const has = v => !!A.VIEWS[v];
    const S0 = S(); S0.isp.path = S0.isp.path || {};
    return h('details',{class:'card calm'},
      h('summary',{style:'cursor:pointer'}, h('b',null,'🧭 New to managing? Your first-month path')),
      h('p',{class:'small'},'Many managers are promoted from the floor and never taught this. Work down the list. Each step opens the screen that does it, and the care plan guide explains every section as you go.'),
      h('ul',{class:'tourlist'}, L.PATH.filter(x => has(x[0])).map(([v, t, name]) => { const id = 'isp-path-'+v; const cb = h('input',{type:'checkbox',id,checked:!!S0.isp.path[v]}); cb.addEventListener('change',()=>{ S0.isp.path[v] = cb.checked; save(); });
        return h('li',null, cb, h('label',{for:id}, t+' '), h('a',{href:'#/'+v,class:'small'},'Open '+name)); })));
  }

  function listView(v){
    const sid = S().site, set = setting();
    if (!isMgr()) return staffList(v);
    v.append(A.head('Care plans (ISP) · '+site().name, 'Individual service plans', 'Each resident\'s plan, the dates the rules set, who has signed, and which staff have read the summary.'));
    if (set === 'home') v.append(h('div',{class:'card soft'}, h('p',null,'At home, the care manager or agency usually owns the plan. You can still keep a simple plan and staff summary here for helpers.')));
    const I = st();
    const g = h('input',{type:'checkbox',id:'isp-guide',checked:I.guide});
    g.addEventListener('change',()=>{ I.guide = g.checked; save(); });
    v.append(h('div',{class:'row'}, g, h('label',{for:'isp-guide'}, h('b',null,'Guide me'), h('span',{class:'small muted'},' (step-by-step help with each section, the legal must-haves and common mistakes)'))));
    const rs = residents();
    const rows = rs.map(r => ({r, s:status(sid, r.code)}));
    const late = rows.filter(x => x.s.items.some(i => i.lvl === 'red')).length, soon = rows.filter(x => !x.s.items.some(i => i.lvl === 'red') && x.s.items.some(i => i.lvl === 'amber')).length;
    v.append(h('div',{class:'grid g3'},
      h('div',{class:'card'},h('div',{class:'stat'+(late?' warnc':' good')},h('b',null,String(late)),h('span',null,'late or overdue'))),
      h('div',{class:'card'},h('div',{class:'stat warnc'},h('b',null,String(soon)),h('span',null,'need something soon'))),
      h('div',{class:'card'},h('div',{class:'stat good'},h('b',null,String(rows.filter(x => x.s.v).length)+' of '+rows.length),h('span',null,'residents with a finished plan')))));
    v.append(h('div',{class:'list'}, rows.map(({r, s}) => h('div',{class:'item'},
      h('div',{class:'meta'}, chip(r.code), h('b',{style:'color:var(--ink)'}, r.nick+' (sample)'), s.v ? chip('Version '+s.v.n+' · '+fmt(s.v.at),'grey') : chip('No finished plan','amber')),
      h('div',{class:'chips'}, s.items.map(lvlChip)),
      h('div',{class:'row'},
        h('a',{class:'btn sm',href:'#/isp/'+encodeURIComponent(r.code)+(s.v ? '' : '/edit')}, s.v ? 'Open plan' : s.p.draft ? 'Keep writing' : 'Start the plan'),
        s.v ? h('a',{class:'btn ghost sm',href:'#/isp/'+encodeURIComponent(r.code)+'/summary'},'Staff summary ('+s.acks.ok+'/'+s.acks.all+' read)') : null)))));
    v.append(pathCard(), reqCard(false));
  }

  function staffList(v){
    const sid = S().site;
    v.append(A.head('Care plans · '+site().name, 'Care plan summaries to read', 'One screen per resident: what matters to them, how to help, what to watch for. Read each one and tap "I read this". When a plan changes, you\'ll be asked to read it again.'));
    const rs = residents().map(r => ({r, p:plan(sid, r.code)}));
    const todo = rs.filter(x => cur(x.p) && ackState(x.p, me()) !== 'ok');
    v.append(h('div',{class:'card '+(todo.length ? 'warn' : 'calm')}, h('b',null, todo.length ? todo.length+' to read before your shift' : 'You\'re up to date. Thank you.')));
    rs.forEach(({r, p}) => {
      const stt = ackState(p, me());
      if (!cur(p)) { v.append(h('div',{class:'item'}, h('div',{class:'meta'}, chip(r.code), h('b',{style:'color:var(--ink)'}, r.nick+' (sample)'), chip('Plan being written','grey')), h('span',{class:'small'},'New resident. Follow the admission handoff and the face sheet until the plan is ready.'))); return; }
      v.append(h('details',{class:'item', open:stt !== 'ok' && todo[0] && todo[0].r === r || null},
        h('summary',{style:'cursor:pointer'}, h('span',{class:'meta'}, chip(r.code), h('b',{style:'color:var(--ink)'}, r.nick+' (sample)'), stt === 'ok' ? chip('✓ Read','calm') : stt === 'stale' ? chip('Changed: read again','amber') : chip('Not read yet','amber'))),
        summaryCard(p, {full:true})));
    });
  }

  function planView(v, code){
    const sid = S().site, p = plan(sid, code), r = resObj(code);
    if (!r) { v.append(h('a',{href:'#/isp'},'← Care plans'), h('div',{class:'card warn'}, h('p',null,'That resident is not at '+site().name+'. Pick another home at the top, or go back.'))); return; }
    const sub = (A.param().split('/')[1] || '');
    v.append(h('a',{href:'#/isp',class:'noprint'},'← Care plans'));
    if (!isMgr()){ v.append(A.head('Care plan', r.nick+' (sample)', null), summaryCard(p), h('details',{class:'card'}, h('summary',{style:'cursor:pointer'}, h('b',null,'Full plan (read only)')), readOnly(p))); return; }
    v.append(A.head('Care plan · '+r.code, r.nick+' (sample)', null));
    const s = status(sid, code);
    v.append(h('div',{class:'chips'}, s.items.map(lvlChip)));
    v.append(tabs(code, sub));
    ({'':() => readOnly(p, v), edit:() => editView(v, p, r), summary:() => summaryView(v, p), sign:() => signView(v, p), history:() => historyView(v, p)}[sub] || (() => readOnly(p, v)))();
  }

  function readOnly(p, v){
    const cv = cur(p);
    const box = v || h('div',{class:'grid'});
    if (!cv){ box.append(h('div',{class:'card warn'}, h('p',null,'No finished plan yet.'), isMgr() ? h('a',{class:'btn sm',href:'#/isp/'+encodeURIComponent(p.code)+'/edit'}, p.draft ? 'Keep writing' : 'Start the plan') : null)); return box; }
    const d = cv.data;
    box.append(h('p',{class:'small muted'},'Version '+cv.n+', finished '+fmt(cv.at)+' by '+cv.by+'. '+(cv.reason ? 'Reason: '+cv.reason+'.' : '')));
    L.SECTIONS.forEach(sec => {
      const c = h('div',{class:'card'}, h('h2',null, sec.ic+' '+sec.t));
      if (sec.id === 'goals' || sec.id === 'risks'){
        d[sec.id].forEach(g => c.append(goalRead(g)));
        if (sec.id === 'risks') c.append(h('div',{class:'isp-band'}, h('div',null,h('span',null,'Code status'),h('b',null,d.code||'Not recorded')), h('div',null,h('span',null,'Who decides'),h('b',null,d.decides||'Not recorded')), h('div',null,h('span',null,'Evacuation'),h('b',null,d.evac||'Not recorded'))));
      } else c.append(h('div',{class:'out'}, sectionText(d, sec.id)));
      box.append(c);
    });
    return box;
  }
  function srcChip(g){ const s = L.SRC[g.src]; return s ? h('span',{class:'chip grey',title:s.label}, (s.kind === 'rule' ? '⚖️ ' : s.kind === 'format' ? '📋 ' : '📚 ')+s.label) : g.src === 'custom' ? chip('✍️ Written by the team','grey') : null; }
  function goalRead(g){
    return h('div',{class:'item'}, h('div',{class:'meta'}, chip(g.dom), g.edited ? chip('Edited','grey') : null), h('b',null,g.goal), g.need ? h('span',{class:'small'},'Need: '+g.need) : null,
      h('ul',{class:'small'}, g.steps.map(x => h('li',null,x))), g.measure ? h('span',{class:'small'},'How we\'ll know: '+g.measure) : null, h('span',{class:'small muted'},'Who: '+(g.who||'')+(g.freq ? ' · '+g.freq : '')),
      h('div',{class:'chips'}, srcChip(g), (g.from||[]).map(f => chip('From '+f,'grey'))));
  }

  // ---------- editor with the guided walkthrough ----------
  function guideBox(sec){
    return h('details',{class:'house isp-guide',open:st().guide || null},
      h('summary',{style:'cursor:pointer'}, h('b',null,'💡 Guide: '+sec.t)),
      h('p',{class:'small'}, sec.what),
      h('p',{class:'small'}, h('b',null,'What good looks like: '), sec.good),
      h('div',{class:'small'}, h('b',null,'Must-haves'), h('ul',null, sec.must.map(x => h('li',null,x)))),
      h('div',{class:'small'}, h('b',null,'Common mistakes'), h('ul',null, sec.mistakes.map(x => h('li',null,x)))));
  }
  function editView(v, p, r){
    const sid = S().site;
    if (!p.draft) p.draft = cur(p) ? JSON.parse(JSON.stringify(cur(p).data)) : draftFrom(sid, p.code);
    const d = p.draft, I = st();
    I.step = I.step || {}; const k = key(sid, p.code);
    const guided = I.guide; let step = Math.min(I.step[k] || 0, L.SECTIONS.length);
    const body = h('div',{class:'grid'});
    const top = h('div',{class:'card soft'},
      h('p',{class:'small'}, cur(p) ? 'You are updating version '+cur(p).n+'. Staff keep seeing the current version until you finish this one.' : 'We started this plan from '+r.nick+'\'s record, orders, admission papers and public plan formats. Every line is a suggestion: change anything, and each part shows where it came from.'),
      h('div',{class:'row'}, (() => { const c = h('input',{type:'checkbox',id:'isp-g2',checked:guided}); c.addEventListener('change',()=>{ I.guide = c.checked; save(); A.route(); }); return [c, h('label',{for:'isp-g2'},'Guide me one section at a time')]; })(),
        h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ if (confirm('Throw away this draft and start again from the record?')){ p.draft = null; save(); A.route(); } }},'Start over')));
    v.append(top, body);
    const autosave = () => { save(); };
    function draw(){
      body.textContent = '';
      const secs = guided ? (step < L.SECTIONS.length ? [L.SECTIONS[step]] : []) : L.SECTIONS;
      if (guided) body.append(h('div',{class:'isp-steps'}, L.SECTIONS.map((s, i) => h('button',{type:'button',class:'chip'+(i === step ? '' : ' grey'),'aria-pressed':String(i === step),onclick:()=>{ step = I.step[k] = i; save(); draw(); }}, (i+1)+'. '+s.t)), h('button',{type:'button',class:'chip'+(step === L.SECTIONS.length ? '' : ' grey'),'aria-pressed':String(step === L.SECTIONS.length),onclick:()=>{ step = I.step[k] = L.SECTIONS.length; save(); draw(); }}, (L.SECTIONS.length+1)+'. Check and finish')));
      secs.forEach(sec => body.append(sectionEditor(sec, d, sid, p, r, autosave, draw)));
      if (guided){
        body.append(h('div',{class:'row'}, step > 0 ? h('button',{class:'btn quiet',type:'button',onclick:()=>{ step = I.step[k] = step-1; save(); draw(); window.scrollTo(0,0); }},'← Back') : null,
          step < L.SECTIONS.length ? h('button',{class:'btn',type:'button',onclick:()=>{ step = I.step[k] = step+1; save(); draw(); window.scrollTo(0,0); }},'Next →') : null));
        if (step === L.SECTIONS.length) body.append(finishCard(p, d));
      } else body.append(finishCard(p, d));
    }
    draw();
  }
  function area(label, val, set, rows){ const t = h('textarea',{rows:String(rows||4)}); t.value = val || ''; t.addEventListener('input',()=>set(t.value)); return h('label',{class:'f'}, label, t); }
  function input(label, val, set, type){ const t = h('input',{type:type||'text'}); t.value = val || ''; t.addEventListener('input',()=>set(t.value)); return h('label',{class:'f'}, label, t); }
  function sectionEditor(sec, d, sid, p, r, autosave, redraw){
    const c = h('div',{class:'card'}, h('h2',null, sec.ic+' '+sec.t), guideBox(sec));
    const ch = () => autosave();
    switch (sec.id){
      case 'about':
        c.append(area('In their words where you can', d.about, x => { d.about = x; ch(); }, 7), h('div',{class:'chips'}, (d.aboutSrc||[]).map(x => chip('From '+x,'grey'))));
        break;
      case 'assess':
        c.append(h('div',{class:'grid g2'}, input('Assessment date', d.assessDate, x => { d.assessDate = x; ch(); }, 'date'), input('Assessed by', d.assessBy, x => { d.assessBy = x; ch(); })),
          area('Needs, abilities, strengths and risks found', d.assess, x => { d.assess = x; ch(); }, 7));
        if (setting() === 'afh') c.append(h('p',{class:'small muted'},'DHS 88 asks the assessment to cover activities of daily living, medications, health, supervision in the home and community, vocational, recreational, social and transportation needs. Add any that are missing.'));
        break;
      case 'goals': case 'risks':
        d[sec.id].forEach((g, i) => c.append(goalEditor(g, () => { d[sec.id].splice(i,1); ch(); redraw(); }, ch)));
        c.append(suggestBox(sec.id, d, sid, p, r, ch, redraw));
        if (sec.id === 'risks') c.append(h('div',{class:'grid g3'}, input('Code status', d.code, x => { d.code = x; ch(); }), input('Who decides (guardian, POA or the resident)', d.decides, x => { d.decides = x; ch(); }), input('Evacuation ability', d.evac, x => { d.evac = x; ch(); })));
        break;
      case 'rights':
        c.append(area('Rights and choices', d.rights, x => { d.rights = x; ch(); }, 3));
        d.restr.forEach((x, i) => c.append(restrEditor(x, () => { d.restr.splice(i,1); ch(); redraw(); }, ch)));
        c.append(h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ d.restr.push({desc:'', need:'', tried:'', less:'', data:'', review:addDays(today(),90), consent:'', noharm:false}); ch(); redraw(); }},'Add a restriction (8 required steps)'));
        break;
      case 'team':
        d.team.forEach((t, i) => c.append(h('div',{class:'row'},
          (() => { const s = h('select',{'aria-label':'Role'}, L.ROLES.map(rr => h('option',{value:rr.k,selected:rr.k === t.role || null}, rr.t))); s.addEventListener('change',()=>{ t.role = s.value; ch(); }); return s; })(),
          (() => { const n = h('input',{type:'text','aria-label':'Name',value:t.name}); n.addEventListener('input',()=>{ t.name = n.value; ch(); }); return n; })(),
          h('button',{class:'btn quiet sm',type:'button','aria-label':'Remove '+t.name,onclick:()=>{ d.team.splice(i,1); ch(); redraw(); }},'Remove'))));
        c.append(h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ d.team.push({role:'cm', name:''}); ch(); redraw(); }},'Add someone'));
        const missing = L.ROLES.filter(rr => !d.team.some(t => t.role === rr.k) && (rr.k === 'cm' || rr.k === 'rep' || rr.k === 'rn'));
        if (missing.length) c.append(h('p',{class:'small muted'},'Not listed yet: '+missing.map(m => m.t+(m.note ? ' ('+m.note+')' : '')).join('; ')+'.'));
        break;
      case 'review':
        c.append(h('div',{class:'grid g2'}, (() => { const s = h('select',null, [3,6,12].map(m => h('option',{value:m,selected:+d.reviewMonths === m || null}, 'Every '+m+' months'))); s.addEventListener('change',()=>{ d.reviewMonths = +s.value; ch(); }); return h('label',{class:'f'},'Scheduled review', s); })(),
          h('p',{class:'small'}, 'Rule minimum for this home: every '+months(sid)+' months. You can choose sooner, not later.')),
          area('Also review when', d.triggers, x => { d.triggers = x; ch(); }, 3));
        break;
    }
    return c;
  }
  function goalEditor(g, remove, ch){
    const mark = () => { g.edited = true; ch(); };
    return h('div',{class:'item'},
      h('div',{class:'meta'}, chip(g.dom), srcChip(g), (g.from||[]).map(f => chip('From '+f,'grey'))),
      area('Goal (the outcome they want, in their words)', g.goal, x => { g.goal = x; mark(); }, 2),
      area('Need', g.need, x => { g.need = x; mark(); }, 2),
      area('Supports and staff steps (one per line)', g.steps.join('\n'), x => { g.steps = lines(x); mark(); }, 5),
      h('div',{class:'grid g3'}, input('How we\'ll know it\'s working', g.measure, x => { g.measure = x; mark(); }), input('Who', g.who, x => { g.who = x; mark(); }), input('How often', g.freq, x => { g.freq = x; mark(); })),
      h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:remove},'Remove')));
  }
  function restrEditor(x, remove, ch){
    const f = (lab, k) => area(lab, x[k], val => { x[k] = val; ch(); }, 2);
    const nh = h('input',{type:'checkbox',checked:x.noharm}); nh.addEventListener('change',()=>{ x.noharm = nh.checked; ch(); });
    return h('div',{class:'item'}, h('b',null,'Restriction (all 8 steps are required, 42 CFR 441.301(c)(4)(vi)(F))'),
      f('1. Describe the limit exactly', 'desc'), f('2. The specific assessed need', 'need'), f('3. Positive supports tried first', 'tried'), f('4. Less intrusive ways tried, and what happened', 'less'),
      f('5. How data will be collected to see if it works', 'data'), input('6. Review by (time limit)', x.review, val => { x.review = val; ch(); }, 'date'), f('7. Informed consent: who, when, how', 'consent'),
      h('label',{class:'agree'}, nh, h('span',null,'8. This limit will not cause harm to the person.')),
      h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:remove},'Remove')));
  }
  function suggestBox(secId, d, sid, p, r, ch, redraw){
    const have = new Set(d[secId].map(g => g.lib));
    const ms = matches(sid, p.code).filter(m => m.item.sec === secId && !have.has(m.item.id));
    const extra = L.LIB.filter(it => it.sec === secId && !have.has(it.id) && !ms.some(m => m.item.id === it.id));
    const box = h('details',{class:'card soft',style:'box-shadow:none'}, h('summary',{style:'cursor:pointer'}, h('b',null,'➕ Suggestions ('+ms.length+' from '+r.nick+'\'s record, '+extra.length+' more in the library)')));
    const row = (it, from) => h('div',{class:'item'}, h('div',{class:'meta'}, chip(it.dom), srcChip({src:it.src})), h('b',null,it.goal.replace('[Name]', r.nick)), it.need ? h('span',{class:'small'},it.need) : null,
      from && from.length ? h('span',{class:'small muted'},'Why: '+from.map(f => f.from+' says "'+f.text.slice(0,70)+'"').join('; ')) : null,
      h('div',{class:'row'}, h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ d[secId].push(fromLib({item:it, from:from||[]}, r.nick)); ch(); redraw(); }},'Add to plan')));
    ms.forEach(m => box.append(row(m.item, m.from)));
    extra.forEach(it => box.append(row(it, null)));
    box.append(h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ d[secId].push({id:uid(), lib:'', dom:secId === 'risks' ? 'Safety' : 'Other', need:'', goal:'', steps:[], measure:'', who:'All caregivers on shift', freq:'', src:'custom', from:[], edited:true}); ch(); redraw(); }},'Write my own'));
    return box;
  }
  function checks(d, set){
    const out = [];
    const ok = (c, t, hard) => out.push({ok:!!c, t, hard});
    ok(d.assessDate, 'Assessment date filled in', true);
    ok(d.about && lines(d.about).length >= 2, 'About the person is filled in');
    ok(d.goals.length, 'At least one goal', true);
    ok(d.goals.concat(d.risks).every(g => g.goal && g.steps.length), 'Every goal has supports and staff steps', true);
    ok(d.goals.every(g => g.measure), set === 'cbrf' ? 'Every goal is measurable (DHS 83.35(3)(a))' : 'Every goal says how you\'ll know it\'s working');
    ok(d.goals.concat(d.risks).every(g => g.who), 'Every goal says who gives the support');
    ok(d.team.some(t => t.role === 'resident'), 'The resident took part', true);
    ok(d.code && d.decides, 'Code status and who decides are recorded');
    ok(d.evac, 'Evacuation ability is recorded');
    ok(d.restr.every(x => x.desc && x.need && x.tried && x.less && x.data && x.review && x.consent && x.noharm), 'Any restriction has all 8 steps', true);
    ok(!/\b(non-?compliant|uncooperative|combative|refuses to cooperate)\b/i.test(JSON.stringify(d)), 'No blaming labels ("non-compliant", "combative"); describe what happened and what helps');
    return out;
  }
  function finishCard(p, d){
    const set = setting(), cs = checks(d, set), hard = cs.filter(c => !c.ok && c.hard);
    const reason = h('input',{type:'text',maxlength:'160',placeholder:cur(p) ? 'For example: 6-month review, new swallowing order' : 'First plan after admission'});
    return h('div',{class:'card'}, h('h2',null,'✅ Check and finish'),
      h('ul',{class:'tourlist'}, cs.map(c => h('li',null, h('span',{'aria-hidden':'true'}, c.ok ? '✅' : c.hard ? '⛔' : '⚠️'), h('span',{class:c.ok ? 'muted' : ''}, c.t)))),
      h('label',{class:'f'}, 'What changed and why (goes into the version history and the staff summary)', reason),
      h('div',{class:'row'}, h('button',{class:'btn',type:'button',disabled:hard.length ? true : null,onclick:()=>{
        const why = reason.value.trim() || (cur(p) ? 'Plan updated' : 'First plan after admission');
        const v = finalize(p, why); toast('Version '+v.n+' finished. Staff will be asked to read the summary.'); location.hash = '#/isp/'+encodeURIComponent(p.code)+'/sign'; }}, 'Finish this version'),
        h('span',{class:'small muted'}, hard.length ? 'Fix the ⛔ items first.' : 'Next: signatures, then staff read the summary.')));
  }

  // ---------- staff summary and acknowledgments ----------
  function summaryView(v, p){
    v.append(summaryCard(p, {noAck:true}));
    const cv = cur(p); if (!cv) return;
    const names = staffNames(p.site);
    const t = h('table',{class:'t'}, h('thead',null,h('tr',null,h('th',null,'Staff'),h('th',null,'Status'),h('th',null,'When'),h('th',{class:'noprint'},''))),
      h('tbody',null, names.map(n => { const s = ackState(p, n), a = p.acks[n];
        return h('tr',null, h('td',null,n), h('td',null, s === 'ok' ? chip('Read v'+cv.n,'calm') : s === 'stale' ? chip('Read v'+a.v+', needs v'+cv.n,'amber') : chip('Not read','amber')), h('td',null, a ? fmt(a.at) : ''),
          h('td',{class:'noprint'}, s !== 'ok' ? h('button',{class:'btn quiet sm',type:'button',onclick:e=>{ p.reminded[n] = new Date().toISOString(); audit('Reminder to read '+p.code+' summary sent to '+n); save(); e.target.textContent = 'Reminder set'; e.target.disabled = true; }}, p.reminded[n] ? 'Remind again' : 'Remind') : null)); })));
    v.append(h('div',{class:'card'}, h('h2',null,'Who has read it'),
      h('p',{class:'small muted'},'Each person reads the current version on their own phone or the house tablet. A reminder shows at the start of their next shift and on their face sheet. No one is called out in front of others.'),
      h('div',{class:'tablewrap'}, t),
      setting() === 'cbrf' ? h('p',{class:'foot'},'DHS 83.35(3)(f): every caregiver must have continual access to the assessment and plan. The summary is the quick version; the full plan is one tap away.') : null));
  }

  // ---------- participation and signatures ----------
  function signView(v, p){
    const cv = cur(p); if (!cv){ v.append(h('p',null,'Finish the plan first.')); return; }
    const set = setting(), sg = p.sigs[cv.n] = p.sigs[cv.n] || {};
    v.append(h('div',{class:'card soft'}, h('p',{class:'small'}, set === 'cbrf' ? 'CBRF: the resident or legal representative signs to show they took part, understand and agree, at writing and at every review (DHS 83.35(3)(b), (d)). Invite the case manager and health care providers.' : set === 'afh' ? 'AFH: everyone who helped develop the plan signs and dates a statement of agreement, and each gets a copy (DHS 88.06(3)(d)5, (e)).' : 'At home, signatures are good practice.'),
      h('p',{class:'small muted'},'Test version: signatures here are typed names. The live version needs a proper e-signature with identity check and a stored, unchangeable copy.')));
    cv.data.team.forEach(t => {
      const k = t.role+':'+t.name, cur0 = sg[k] || {status:'waiting'};
      const how = h('select',{'aria-label':'How '+t.name+' took part'}, ['In person','Phone','Video','By mail','Did not take part'].map(x => h('option',{selected:cur0.how === x || null},x)));
      const nm = h('input',{type:'text','aria-label':'Type full name to sign for '+t.name,placeholder:'Type full name to sign'});
      const note = h('input',{type:'text','aria-label':'Reason or note for '+t.name,placeholder:'Reason if declined (optional)'});
      const set1 = status => { sg[k] = {status, how:how.value, name:status === 'signed' ? nm.value.trim() : t.name, note:note.value.trim(), at:new Date().toISOString()}; audit('Care plan '+p.code+' v'+cv.n+': '+roleName(t.role)+' '+status); save(); A.route(); };
      v.append(h('div',{class:'item'},
        h('div',{class:'meta'}, h('b',{style:'color:var(--ink)'}, roleName(t.role)), h('span',null,t.name),
          cur0.status === 'signed' ? chip('✓ Signed '+fmt(cur0.at),'calm') : cur0.status === 'paper' ? chip('✓ Signed on paper '+fmt(cur0.at),'calm') : cur0.status === 'declined' ? chip('Declined to sign '+fmt(cur0.at)+(cur0.note ? ': '+cur0.note : ''),'amber') : chip('Waiting','amber')),
        cur0.status === 'waiting' ? h('div',{class:'grid g2'}, h('label',{class:'f'},'How they took part', how), nm) : null,
        cur0.status === 'waiting' ? note : null,
        cur0.status === 'waiting' ? h('div',{class:'row'},
          h('button',{class:'btn sm',type:'button',onclick:()=>{ if (!nm.value.trim()) { toast('Type the full name to sign'); nm.focus(); return; } set1('signed'); }},'Sign: I took part and agree'),
          h('button',{class:'btn ghost sm',type:'button',onclick:()=>set1('paper')},'Signed on paper'),
          h('button',{class:'btn quiet sm',type:'button',onclick:()=>set1('declined')},'Declined to sign')) :
          h('button',{class:'linkbtn small',type:'button',onclick:()=>{ delete sg[k]; save(); A.route(); }},'Undo')));
    });
    const cp = h('input',{type:'checkbox',id:'isp-copy',checked:!!p.copies[cv.n]}); cp.addEventListener('change',()=>{ p.copies[cv.n] = cp.checked ? today() : ''; audit('Care plan '+p.code+' v'+cv.n+': copies '+(cp.checked ? 'given' : 'not given')); save(); });
    v.append(h('div',{class:'card'}, h('div',{class:'row'}, cp, h('label',{for:'isp-copy'}, 'Copies given to the resident'+(set === 'afh' ? ' and everyone who helped develop the plan' : ' or representative')+(p.copies[cv.n] ? ' ('+fmt(p.copies[cv.n])+')' : ''))),
      h('p',{class:'small muted'},'Missing: '+(sigMissing(p, cv, set).join(', ') || 'nothing. Every needed signature is in.'))));
  }

  // ---------- version history and compare ----------
  function diffLines(a, b){
    const A0 = lines(a), B0 = lines(b), sa = new Set(A0), sb = new Set(B0);
    return B0.map(l => ({t:l, k:sa.has(l) ? 'same' : 'add'})).concat(A0.filter(l => !sb.has(l)).map(l => ({t:l, k:'del'})));
  }
  function historyView(v, p){
    if (!p.versions.length){ v.append(h('p',null,'No versions yet.')); return; }
    const vs = p.versions.slice().reverse();
    v.append(h('div',{class:'list'}, vs.map(x => h('div',{class:'item'},
      h('div',{class:'meta'}, chip('Version '+x.n), h('span',null,fmt(x.at)+' · '+x.by)), h('b',null,x.reason||''),
      h('span',{class:'small muted'}, x.n === 1 ? 'First version' : 'Changed: '+(x.changed.map(id => (L.SECTIONS.find(s => s.id === id)||{t:id}).t).join(', ') || 'no wording changes'))))));
    if (p.versions.length < 2) return;
    const opt = (sel) => h('select',null, p.versions.map(x => h('option',{value:x.n,selected:x.n === sel || null},'Version '+x.n+' ('+fmt(x.at)+')')));
    const a = opt(p.versions.length-1), b = opt(p.versions.length), out = h('div',{class:'grid'});
    const draw = () => {
      out.textContent = '';
      const va = p.versions[+a.value-1], vb = p.versions[+b.value-1];
      L.SECTIONS.forEach(sec => {
        const ta = sectionText(va.data, sec.id), tb = sectionText(vb.data, sec.id); if (ta === tb) return;
        out.append(h('div',{class:'card'}, h('h3',null, sec.ic+' '+sec.t), h('div',{class:'isp-diff'}, diffLines(ta, tb).filter(x => x.k !== 'same').map(x => h('p',{class:x.k}, h('span',{class:'sr'}, x.k === 'add' ? 'Added: ' : 'Removed: '), (x.k === 'add' ? '+ ' : '− ')+x.t)))));
      });
      if (!out.children.length) out.append(h('p',{class:'muted'},'No differences.'));
    };
    a.addEventListener('change', draw); b.addEventListener('change', draw);
    v.append(h('div',{class:'card soft'}, h('h2',null,'Compare versions'), h('div',{class:'grid g2'}, h('label',{class:'f'},'From',a), h('label',{class:'f'},'To',b))), out);
    draw();
  }

  // ---------- route ----------
  function view(v){
    st(); v.classList.add('isp');
    const prm = A.param() || '';
    const code = prm.split('/')[0];
    if (!code) return listView(v);
    planView(v, code);
  }

  // ---------- cards for other screens ----------
  // Manager home: reviews due and summaries not read. Caregiver home and face sheet: summaries to read.
  function homeCard(){
    try {
      if (!(!window.SSAccess || SSAccess.viewOn('isp'))) return null;
      const sid = S().site; if (setting() === 'home') return null;
      const rows = residents().map(r => ({r, s:status(sid, r.code)}));
      if (isMgr()){
        const due = rows.filter(x => x.s.items.some(i => i.lvl === 'red' || i.lvl === 'amber'));
        if (!due.length) return null;
        return h('a',{class:'card warn',href:'#/isp',style:'text-decoration:none;color:inherit'}, h('b',null,'📋 Care plans: '+due.length+' need attention'),
          h('ul',{class:'small'}, due.slice(0,4).map(x => h('li',null, x.r.code+' '+x.r.nick+': '+x.s.items.filter(i => i.lvl !== 'calm' && i.lvl !== 'grey').map(i => i.t).join(' ')))));
      }
      const todo = rows.filter(x => x.s.v && ackState(x.s.p, me()) !== 'ok');
      if (!todo.length) return null;
      return h('a',{class:'card warn',href:'#/isp',style:'text-decoration:none;color:inherit'}, h('b',null,'📋 '+todo.length+' care plan summar'+(todo.length === 1 ? 'y' : 'ies')+' to read'),
        h('span',{class:'small'}, todo.map(x => x.r.code+' '+x.r.nick+(ackState(x.s.p, me()) === 'stale' ? ' (changed)' : '')).join(', ')));
    } catch(e){ return null; }
  }
  // Compact block for one resident's face sheet.
  function faceBlock(code){
    try {
      const p = plan(S().site, code), v = cur(p); if (!v) return null;
      const s = summary(p, v), stt = ackState(p, me());
      return h('div',{class:'card soft isp-face',style:'box-shadow:none'},
        h('div',{class:'meta'}, h('b',{style:'color:var(--ink)'},'📋 Care plan summary'), stt === 'ok' ? chip('✓ Read','calm') : chip(stt === 'stale' ? 'Changed: read again' : 'Not read yet','amber')),
        h('ul',{class:'small'}, s.help.slice(0,4).map(x => h('li',null, h('b',null,x.dom+': '), x.steps[0]))),
        h('div',{class:'row'}, h('a',{class:'btn ghost sm',href:'#/isp/'+encodeURIComponent(code)+'/summary'}, stt === 'ok' ? 'Open summary' : 'Read and acknowledge')));
    } catch(e){ return null; }
  }

  // ---------- register with the app ----------
  A.VIEWS.isp = {t:'Care plans (ISP)', ic:'📋'};
  A.R.isp = view;
  const put = (t, after) => { const n = A.NAV[t]; if (!n || n.includes('isp')) return; const i = n.indexOf(after); n.splice(i >= 0 ? i+1 : Math.min(2, n.length), 0, 'isp'); };
  put('manager','orders'); put('rn','orders'); put('owner','insights'); put('multi','insights'); put('caregiver','time');
  if (window.SSAccess && SSAccess.register) try { SSAccess.register({id:'isp', name:'Care plans (ISP)', ic:'📋', what:'Individual service plans with DHS 88 and 83 timelines, sourced suggestions, a guide for new managers, staff summaries with read-and-acknowledge, signatures and versions.', views:['isp'], tiers:['caregiver','manager','rn','owner','multi']}); } catch(e){}
  // Face sheet (when that screen is installed): show what still needs reading at the top.
  window.addEventListener('load', () => {
    const f = A.R.face; if (typeof f !== 'function' || f.__isp) return;
    const w = function(v){ const r = f.apply(this, arguments); try { const c = homeCard(); if (c && !isMgr()) v.insertBefore(c, v.children[1] || null); } catch(e){} return r; };
    w.__isp = true; A.R.face = w;
  });
  window.SSISP = {homeCard, faceBlock, summaryCard:(code, o) => summaryCard(plan(S().site, code), o), status, plan};
})();
