// Steady Shift test app: "Getting started" academy (#/academy).
// Track 1 start a home in Wisconsin, Track 2 set up Steady Shift, Track 3 role training with quizzes, certificates and
// training hours (a manager confirms before hours count, then the scheduler's training check uses them),
// Track 4 run the business, plus a toolkit: inventory and expenses, pay benchmarks, hiring planner, startup and expansion model.
// Content lives in academy-data.js and pay data in wages-data.js. Everything here is sample data kept in this browser.
(function(){
  const A = window.SSApp, AC = window.SS_ACADEMY;
  if (!A || !AC) return;
  const {h, save, toast, head, R, VIEWS, NAV, uid, fmtDate, site, tier, D} = A;
  const S = () => A.state();
  const W = () => window.SS_WAGES || null;
  const PAY = () => (W() && W().PAYROLL) || AC.PAYROLL;
  const money = n => (n < 0 ? '-$' : '$')+Math.abs(Math.round(n)).toLocaleString();
  const money2 = n => '$'+(Math.round(n*100)/100).toFixed(2);
  const todayIso = () => new Date().toISOString().slice(0,10);
  const daysAgo = n => { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); };
  const MGR = ['manager','owner','multi'];

  function st(){
    const s = S();
    if (!s.academy || s.academy.v !== 1){
      s.academy = {v:1, checks:{}, quiz:{}, certs:[], vertical:'residential',
        inv:AC.INV_SEED.map(x => Object.assign({id:uid()}, x)),
        exp:AC.EXP_SEED.map(x => ({id:uid(), site:x.site, date:daysAgo(x.daysAgo), cat:x.cat, amt:x.amt, note:x.note})),
        startup:{}, hire:{}};
      save();
    }
    return s.academy;
  }
  const allUnits = () => AC.START.concat(AC.BUSINESS);
  const unitById = id => allUnits().find(u => u.id === id);
  const modById = id => AC.MODULES.find(m => m.id === id);
  const TRACKS = [
    {id:'start', n:1, title:'Start a home in Wisconsin', ic:'🏡', what:'AFH or CBRF, licensing through DQA, policies and training, contracts, money, and first-year citations.'},
    {id:'setup', n:2, title:'Set up Steady Shift', ic:'🏁', what:'Profile and policies, staff and roles, scheduler, residents and intake, reports and triage.'},
    {id:'roles', n:3, title:'Role-based staff training', ic:'🎓', what:'Short modules for new caregivers, new managers and owners, with quizzes, certificates and training hours.'},
    {id:'business', n:4, title:'Run the business', ic:'💼', what:'LLC and registrations, permits, insurance, bookkeeping, the building, pay and growth, with tools.'}
  ];

  // ---------- small parts ----------
  const kindChip = k => k === 'official' ? h('span',{class:'chip calm'},'Official rule, linked') : k === 'mixed' ? h('span',{class:'chip amber'},'Official rules plus Steady Shift guidance') : h('span',{class:'chip grey'},'Steady Shift guidance, not official');
  const bar = (pct, cls) => h('div',{class:'bar '+(cls||(pct>=100?'calm':'')),role:'img','aria-label':pct+'% done'},h('i',{style:'width:'+pct+'%'}));
  const pctOf = (done, total) => total ? Math.round(done/total*100) : 0;
  function notOfficial(){ return h('div',{class:'card warn'}, h('b',null,'About this training'), h('p',{class:'small'},AC.NOTE), h('p',{class:'small'},'Rule facts were checked against DHS pages on '+fmtDate(AC.CHECKED)+'. Items marked "being checked" still need the code text confirmed. Not legal, tax or financial advice.')); }
  function sourcesCard(keys){
    const list = (keys||[]).map(k => AC.SRC[k]).filter(Boolean);
    if (!list.length) return null;
    return h('div',{class:'card'}, h('h2',null,'Sources'), h('ul',{class:'small'}, list.map(s => h('li',null, h('a',{href:s.url,target:'_blank',rel:'noopener'},s.label), ' ', s.official ? h('span',{class:'chip calm'},'Official') : h('span',{class:'chip grey'},'Not a government source')))));
  }
  function unitProgress(u){ const items = u.checklist || []; const done = items.filter(i => st().checks[i.id]).length; const q = u.quiz ? (st().quiz[u.id] && st().quiz[u.id].passed ? 1 : 0) : 0; return {done:done+q, total:items.length+(u.quiz?1:0)}; }
  function trackProgress(id){
    if (id === 'start' || id === 'business'){ const us = id==='start' ? AC.START : bizUnits(); let d=0,t=0; us.forEach(u => { const p = unitProgress(u); d+=p.done; t+=p.total; }); return pctOf(d,t); }
    if (id === 'setup'){ let d=0,t=0; AC.SETUP.forEach(g => g.items.forEach(i => { t++; if (setupDone(i)) d++; })); return pctOf(d,t); }
    const mods = AC.MODULES; return pctOf(mods.filter(m => certFor(m.id)).length, mods.length);
  }
  const bizUnits = () => AC.BUSINESS.filter(u => u.verticals.includes('all') || u.verticals.includes(st().vertical));
  const certFor = (modId, who) => st().certs.find(c => c.mod === modId && (!who || c.who === who));

  function checklist(items, onChange){
    const ul = h('div',{class:'list'});
    items.forEach(i => {
      const cb = h('input',{type:'checkbox',id:'ck-'+i.id,checked:!!st().checks[i.id]});
      cb.addEventListener('change', () => { st().checks[i.id] = cb.checked; save(); if (onChange) onChange(); });
      ul.append(h('label',{class:'item',for:'ck-'+i.id,style:'grid-template-columns:auto 1fr;align-items:start;cursor:pointer'}, cb, h('span',null, i.t, i.cite ? h('span',{class:'small muted'},' ('+i.cite+')') : null)));
    });
    return ul;
  }

  function quizBlock(q, key, onPass){
    const box = h('form',{class:'card','aria-label':'Quiz'});
    const prev = st().quiz[key];
    box.append(h('h2',null,'Check what you learned'), prev ? h('p',{class:'small '+(prev.passed?'':'muted')}, (prev.passed?'Passed':'Last try')+': '+prev.score+' of '+q.length+' on '+fmtDate(prev.at)+'. You can take it again.') : h('p',{class:'small muted'},'Pass mark: '+Math.round(AC.PASS*100)+'%.'));
    const groups = q.map((x, qi) => {
      const fs = h('fieldset',{class:'item',style:'border:1px solid var(--line)'}, h('legend',{style:'font-weight:700;padding:0 .3rem'}, (qi+1)+'. '+x.q));
      x.a.forEach((a, ai) => fs.append(h('label',{class:'row small',style:'min-height:40px'}, h('input',{type:'radio',name:key+'-q'+qi,value:String(ai),required:true}), a)));
      const why = h('p',{class:'small',hidden:true,'aria-live':'polite'}); fs.append(why);
      return {fs, why, x};
    });
    groups.forEach(g => box.append(g.fs));
    const result = h('p',{role:'status',class:'small'});
    box.append(h('div',{class:'row'}, h('button',{class:'btn sm',type:'submit'},'Check my answers')), result);
    box.addEventListener('submit', e => {
      e.preventDefault();
      let score = 0;
      groups.forEach((g, qi) => { const sel = box.querySelector('input[name="'+key+'-q'+qi+'"]:checked'); const ok = sel && +sel.value === g.x.c; if (ok) score++; g.why.hidden = false; g.why.textContent = (ok ? '✅ Right. ' : '↩️ Not quite. ') + g.x.why; });
      const passed = score/q.length >= AC.PASS;
      st().quiz[key] = {score, passed, at:new Date().toISOString()}; save();
      result.textContent = passed ? 'Passed: '+score+' of '+q.length+'.' : score+' of '+q.length+'. Read the notes above and try again.';
      if (passed && onPass) onPass(score);
    });
    return box;
  }

  // ---------- overview ----------
  function overview(v){
    const a = st();
    v.append(head('Getting started', 'Getting started academy', 'For new homes, new owners and people thinking about getting into care. Start with the business, then set up the app, then train your team.'), A.art('night-shift'));
    const vs = h('select',{id:'acVert','aria-label':'Kind of care business'}, Object.keys(AC.VERTICALS).map(k => h('option',{value:k,selected:a.vertical===k,disabled:!AC.VERTICALS[k].live}, AC.VERTICALS[k].name+(AC.VERTICALS[k].live?'':' (coming later)'))));
    vs.addEventListener('change', () => { a.vertical = vs.value; save(); A.route(); });
    v.append(h('div',{class:'card soft'}, h('label',{class:'f',for:'acVert'},'Your kind of care business', vs), h('p',{class:'small'},'Adult family homes and CBRFs are first. In-home care and adult day services will reuse the same business track and tools.')));
    v.append(h('div',{class:'grid g2'}, TRACKS.map(t => { const p = trackProgress(t.id); return h('a',{class:'tile',href:'#/academy/'+t.id}, h('span',{class:'ic','aria-hidden':'true'},t.ic), h('b',null,'Track '+t.n+': '+t.title), h('span',null,t.what), bar(p), h('span',{class:'small'},p+'% done')); })));
    v.append(h('div',{class:'card'}, h('h2',null,'Business toolkit'), h('div',{class:'grid g2'},
      A.tile('academy/tool/inventory','📦','Inventory and expenses','Supplies, PPE, food and equipment. Feeds the Owner view.'),
      A.tile('academy/tool/wages','💵','Pay benchmarks','Market pay by role and Wisconsin area, next to your rates.'),
      A.tile('academy/tool/hire','🧮','Hiring planner','The real cost of adding a staff member.'),
      A.tile('academy/tool/startup','🏗️','Startup and expansion model','A new home or more beds: costs, break-even and payback.'))));
    if (a.certs.length) v.append(certList(a.certs.slice(-5).reverse(), 'Recent certificates'));
    v.append(notOfficial());
  }

  // ---------- tracks ----------
  function trackPage(v, id){
    const t = TRACKS.find(x => x.id === id);
    v.append(h('a',{href:'#/academy',class:'small'},'← Academy'), head('Track '+t.n, t.title, t.what));
    v.append(h('div',{class:'card'}, bar(trackProgress(id)), h('span',{class:'small'},trackProgress(id)+'% done')));
    if (id === 'start' || id === 'business'){
      const us = id === 'start' ? AC.START : bizUnits();
      v.append(h('div',{class:'list'}, us.map((u, i) => { const p = unitProgress(u); return h('a',{class:'item',href:'#/academy/u/'+u.id,style:'text-decoration:none;color:inherit'}, h('div',{class:'meta'}, h('span',null,(i+1)+' of '+us.length), h('span',null,u.mins+' min'), kindChip(u.kind), p.total && p.done===p.total ? h('span',{class:'chip calm'},'Done') : null), h('b',null,u.title), bar(pctOf(p.done,p.total))); })));
      if (id === 'business') v.append(h('p',{class:'small muted'},'Not legal, tax or financial advice. Check with an attorney and an accountant for your situation.'));
    }
    if (id === 'setup') setupTrack(v);
    if (id === 'roles') rolesTrack(v);
    v.append(notOfficial());
  }

  function unitPage(v, id){
    const u = unitById(id); if (!u){ overview(v); return; }
    const tr = AC.START.includes(u) ? 'start' : 'business';
    v.append(h('a',{href:'#/academy/'+tr,class:'small'},'← '+TRACKS.find(t => t.id===tr).title), head(u.mins+' minute read', u.title, u.intro));
    v.append(h('div',{class:'row'}, kindChip(u.kind), u.tax ? h('span',{class:'chip amber'},'Not legal or tax advice') : null));
    if (u.steps) v.append(h('div',{class:'card'}, h('h2',null,'Step by step'), h('ol',null, u.steps.map(s => h('li',null, s.t, s.cite ? h('span',{class:'small muted'},' ('+s.cite+')') : null)))));
    if (u.points) v.append(h('div',{class:'card'}, h('h2',null,'What to know'), h('ul',null, u.points.map(p => h('li',null,p)))));
    if (u.citations) citationsCard(v);
    if (u.calc) v.append(h('div',{class:'card soft'}, h('b',null,'Work out your numbers'), h('p',{class:'small'},'The startup and expansion model gives your break-even occupancy and payback time.'), h('a',{class:'btn ghost sm',href:'#/academy/tool/startup'},'Open the startup model')));
    if (u.tools) v.append(h('div',{class:'grid g3'}, u.tools.map(t => ({wages:A.tile('academy/tool/wages','💵','Pay benchmarks','By role and area'), hire:A.tile('academy/tool/hire','🧮','Hiring planner','Full cost of a new hire'), startup:A.tile('academy/tool/startup','🏗️','Startup and expansion','Break-even and payback')})[t])));
    if (u.checklist){
      const p0 = unitProgress(u); const prog = h('span',{class:'small'});
      const upd = () => { const p = unitProgress(u); prog.textContent = p.done+' of '+p.total+' done'; };
      v.append(h('div',{class:'card'}, h('h2',null,'Your checklist'), checklist(u.checklist, upd), prog)); upd(); void p0;
    }
    if (u.quiz) v.append(quizBlock(u.quiz, u.id, () => {}));
    const s = sourcesCard(u.sources); if (s) v.append(s);
    const list = tr === 'start' ? AC.START : bizUnits(); const i = list.indexOf(u);
    v.append(h('div',{class:'row'}, i > 0 ? h('a',{class:'btn quiet sm',href:'#/academy/u/'+list[i-1].id},'← '+list[i-1].title) : null, i < list.length-1 ? h('a',{class:'btn sm',href:'#/academy/u/'+list[i+1].id},'Next: '+list[i+1].title) : h('a',{class:'btn sm',href:'#/academy/'+(tr==='start'?'setup':'')},tr==='start'?'Next track: set up Steady Shift':'Back to the academy')));
  }

  function citationsCard(v){
    const set = site().setting === 'cbrf' ? 'cbrf' : 'afh';
    const top = (D.SURVEY[set]||[]).filter(x => x.top);
    v.append(h('div',{class:'card alert'}, h('h2',null,'Most-cited rules for '+(set==='cbrf'?'CBRFs':'adult family homes')), h('p',{class:'small'},'From DQA\'s CY2025 statistics. Switch the home at the top to see the other license type.'),
      h('div',{class:'list'}, top.map(x => h('div',{class:'item'}, h('div',{class:'meta'},h('span',{class:'chip red'},x.top),h('span',null,x.cite)), h('b',null,x.q), h('span',{class:'small'},'Fix: '+x.fix)))),
      h('div',{class:'row'}, h('a',{class:'btn ghost sm',href:'#/survey'},'Run the Survey-Ready Check'), h('a',{class:'btn ghost sm',href:'#/peer'},'What\'s worked for others'), h('a',{class:'btn ghost sm',href:'#/cards'},'Clarity Cards'))));
    const P = window.SS_PEER;
    if (P && P.ENTRIES){
      const cited = P.ENTRIES.filter(e => e.outcome === 'cited' && e.settings.includes(set)).slice(0,4);
      if (cited.length) v.append(h('div',{class:'card'}, h('h2',null,'What homes did about it'), h('p',{class:'small muted'},'Peer practice from public sources, not legal advice.'), h('div',{class:'list'}, cited.map(e => h('div',{class:'item'}, h('b',null,e.title), h('span',{class:'small'},e.practice), h('span',{class:'small muted'},e.cite))))));
    }
    const soon = (D.WATCH||[]).filter(w => w.applies && w.applies.includes(set)).slice(0,3);
    if (soon.length) v.append(h('div',{class:'card soft'}, h('h2',null,'Rules that are changing'), h('div',{class:'list'}, soon.map(w => h('div',{class:'item'}, h('div',{class:'meta'},h('span',null,fmtDate(w.date))), h('b',null,w.title), h('span',{class:'small'},w.status)))), h('a',{href:'#/watch'},'Regulatory Watch')));
  }

  // ---------- Track 2: setup ----------
  function setupDone(i){
    if (st().checks[i.id]) return true;
    const s = S(), sid = s.site;
    try {
      switch (i.auto){
        case 'profile': return !!(s.facility && s.facility[sid] && s.facility[sid].profile && s.facility[sid].profile.county);
        case 'docs': return !!(s.facility && s.facility[sid] && (s.facility[sid].docs||[]).length);
        case 'procs': return (s.orgProcs||[]).some(p => p.site === sid);
        case 'shifts': return !!(s.sched && (s.sched.shifts||[]).some(x => x.site === sid && x.custom));
        case 'trainblock': return !!(s.sched && (s.sched.shifts||[]).some(x => x.site === sid && x.kind === 'training' && !/sample/i.test(x.note||'')));
        case 'intake': return (s.orders||[]).some(o => o.source === 'Admission intake' && o.site === sid);
        case 'reports': return (s.reports||[]).some(r => r.site === sid && /\(you\)/.test(r.by||''));
        case 'reviewed': return (s.reports||[]).some(r => r.site === sid && /\(you\)/.test(r.by||'') && r.status !== 'Waiting for manager');
        case 'cert': return st().certs.length > 0;
      }
    } catch(e){}
    return false;
  }
  function setupTrack(v){
    v.append(h('p',{class:'small muted'},'Steps for '+site().name+'. Some tick themselves when the app can tell you did them. Tick the rest yourself.'));
    AC.SETUP.forEach(g => {
      const done = g.items.filter(setupDone).length;
      const box = h('div',{class:'card'}, h('div',{class:'row',style:'justify-content:space-between'}, h('h2',null,g.title), h('span',{class:'chip '+(done===g.items.length?'calm':'grey')},done+' of '+g.items.length)), bar(pctOf(done,g.items.length)));
      const list = h('div',{class:'list'});
      g.items.forEach(i => {
        const auto = !st().checks[i.id] && setupDone(i);
        const cb = h('input',{type:'checkbox',id:'ck-'+i.id,checked:setupDone(i),disabled:auto});
        cb.addEventListener('change', () => { st().checks[i.id] = cb.checked; save(); A.route(); });
        list.append(h('div',{class:'item',style:'grid-template-columns:auto 1fr auto;align-items:center'}, cb, h('label',{for:'ck-'+i.id}, i.t, auto ? h('span',{class:'chip calm',style:'margin-left:.4rem'},'Done in the app') : null), i.link ? h('a',{class:'btn ghost sm',href:'#/'+i.link},'Open') : null));
      });
      box.append(list); v.append(box);
    });
  }

  // ---------- Track 3: role modules ----------
  function learners(){ const names = (S().staff[S().site]||[]).map(p => p.n); return names; }
  function defaultLearner(){ const n = learners(); const t = S().tier; if (t === 'caregiver') return n[1] || n[0] || 'Caregiver'; if (t === 'manager') return n.includes('Manager') ? 'Manager' : (n[0]||'Manager'); return tier().name; }
  function rolesTrack(v){
    const mine = S().tier === 'caregiver' ? ['caregiver'] : S().tier === 'manager' ? ['manager','caregiver'] : ['owner','manager','caregiver'];
    v.append(h('p',{class:'small muted'},'Each module takes 10 to 20 minutes and ends with a short quiz. Pass to get a certificate. Suggested hours go to the manager to confirm before they count toward yearly training.'));
    (OWNER_TIERS.includes(S().tier) ? mine.concat(Object.keys(AC.ROLES).filter(r => !mine.includes(r))) : mine).forEach(r => {
      const mods = AC.MODULES.filter(m => m.role === r);
      v.append(h('div',{class:'card'}, h('h2',null,AC.ROLES[r].ic+' '+AC.ROLES[r].name), h('div',{class:'list'}, mods.map(m => { const c = certFor(m.id); return h('a',{class:'item',href:'#/'+BASE+'/m/'+m.id,style:'text-decoration:none;color:inherit'}, h('div',{class:'meta'}, h('span',null,m.hours+' hr'), h('span',null,m.quiz.length+' questions'), c ? h('span',{class:'chip calm'},'Certificate: '+c.who) : null), h('b',null,m.title)); }))));
    });
  }
  function modulePage(v, id){
    const m = modById(id); if (!m){ overview(v); return; }
    v.append(h('a',{href:'#/'+(BASE==='training'?'training':'academy/roles'),class:'small'},'← '+(BASE==='training'?'Staff training':'Role-based staff training')), head(AC.ROLES[m.role].name+' · '+m.hours+' hour', m.title, null));
    v.append(h('div',{class:'row'}, kindChip('guide')));
    v.append(h('div',{class:'card'}, h('h2',null,'The short version'), h('ol',null, m.lessons.map(l => h('li',null,l))), m.try ? h('a',{class:'btn ghost sm',href:'#/'+m.try.link,style:'justify-self:start'},m.try.label+' to practice') : null));
    const names = learners(); const def = defaultLearner();
    const sel = h('select',{id:'acWho'}, (names.includes(def) ? names : [def].concat(names)).map(n => h('option',{value:n,selected:n===def},n)));
    const canPick = MGR.includes(S().tier);
    v.append(h('div',{class:'card soft'}, h('label',{class:'f',for:'acWho'},'Who is taking this?', sel), h('p',{class:'small'}, canPick ? 'Managers can run a module with a staff member at a team meeting. Pick their name.' : 'Your certificate and hours go on your own training record.')));
    if (!canPick) sel.disabled = true;
    const out = h('div');
    v.append(quizBlock(m.quiz, m.id, score => {
      const who = sel.value;
      const c = {id:uid(), mod:m.id, title:m.title, role:m.role, who, site:S().site, at:new Date().toISOString(), score, of:m.quiz.length, hours:m.hours, counted:false};
      st().certs.push(c); save();
      out.textContent = '';
      out.append(h('div',{class:'card calm'}, h('b',null,'Certificate earned'), h('p',{class:'small'}, who+' passed "'+m.title+'". '+m.hours+' suggested hour'+(m.hours===1?'':'s')+' sent to the manager to confirm.'), h('a',{class:'btn sm',href:'#/'+BASE+'/cert/'+c.id,style:'justify-self:start'},'View and print the certificate')));
      toast('Certificate earned');
    }), out, notOfficial());
  }

  function certList(certs, title){
    return h('div',{class:'card'}, h('h2',null,title), h('div',{class:'list'}, certs.map(c => h('div',{class:'item'}, h('div',{class:'meta'}, h('span',null,fmtDate(c.at)), h('span',null,c.hours+' hr'), c.counted ? h('span',{class:'chip calm'},'Counted') : h('span',{class:'chip amber'},'Waiting for manager')), h('b',null,c.who+': '+c.title), h('a',{class:'small',href:'#/'+BASE+'/cert/'+c.id},'Certificate')))));
  }
  function certPage(v, id){
    const c = st().certs.find(x => x.id === id); if (!c){ overview(v); return; }
    const home = (D.SITES.find(x => x.id === c.site) || site()).name;
    v.append(h('a',{href:'#/'+BASE,class:'small noprint'},'← '+(BASE==='training'?'Staff training':'Academy')));
    v.append(h('div',{class:'card',style:'text-align:center;padding:2.2rem 1.4rem;border-width:3px;border-color:var(--sky-deep)'},
      h('span',{class:'eyebrow'},'Certificate of completion'), h('h1',null,c.who), h('p',null,'completed the Steady Shift in-house training module'), h('h2',null,c.title),
      h('p',{class:'small'}, 'Score '+c.score+' of '+c.of+' · '+c.hours+' suggested training hour'+(c.hours===1?'':'s')+' · '+fmtDate(c.at)+' · '+home+' (sample)'),
      h('p',{class:'small muted'}, AC.NOTE), h('p',{class:'small muted'},'Certificate ID '+c.id.toUpperCase())));
    v.append(h('div',{class:'row noprint'}, h('button',{class:'btn sm',type:'button',onclick:()=>window.print()},'Print or save as PDF')));
  }

  // ---------- toolkit ----------
  function toolPage(v, which){
    v.append(h('a',{href:'#/academy',class:'small'},'← Academy'));
    ({inventory, wages, hire, startup})[which] ? ({inventory, wages, hire, startup})[which](v) : overview(v);
  }
  const num = (val, lbl, attrs) => { const i = h('input',Object.assign({type:'number',min:'0',step:'any',value:String(val)},attrs||{})); return {i, l:h('label',{class:'f'},lbl,i)}; };

  function inventory(v){
    const a = st(), sid = S().site;
    v.append(head('Toolkit · '+site().name, 'Inventory and expenses', 'Track supplies, PPE and equipment with low-stock alerts, and log spending. Food receipts from Menu and groceries are added in. Totals feed the Owner view.'));
    const items = a.inv.filter(x => x.site === sid);
    const low = items.filter(x => x.have < x.min);
    v.append(h('div',{class:'grid g3'},
      h('div',{class:'card'},h('div',{class:'stat '+(low.length?'warnc':'good')},h('b',null,String(low.length)),h('span',null,'items below minimum'))),
      h('div',{class:'card'},h('div',{class:'stat'},h('b',null,money(monthSpend(sid,30))),h('span',null,'spent in the last 30 days'))),
      h('div',{class:'card'},h('div',{class:'stat'},h('b',null,money2(perResidentDay(sid))),h('span',null,'per resident per day (last 30 days)')))));
    // stock table
    const tb = h('table',{class:'t'}, h('caption',{class:'small muted',style:'text-align:left'},'Stock on hand (sample)'), h('thead',null,h('tr',null,['Item','Category','Have','Minimum','Unit cost',''].map(x => h('th',{scope:'col'},x)))));
    const body = h('tbody');
    items.forEach(x => {
      const have = h('input',{type:'number',min:'0',value:String(x.have),'aria-label':'Have: '+x.n,style:'width:5.5rem'});
      have.addEventListener('change', () => { x.have = +have.value||0; save(); A.route(); });
      body.append(h('tr',null, h('td',null,x.n), h('td',null,x.cat), h('td',null,have), h('td',null,String(x.min)), h('td',null,money2(x.cost)), h('td',null, x.have < x.min ? h('span',{class:'chip amber'},'Order '+(x.min-x.have)) : h('span',{class:'chip calm'},'OK'))));
    });
    tb.append(body);
    const nN = h('input',{type:'text','aria-label':'New item name',placeholder:'Item'}), nC = h('select',{'aria-label':'Category'}, AC.EXP_CATS.map(c => h('option',null,c)));
    const nH = num(0,'Have'), nM = num(1,'Minimum'), nU = num(0,'Unit cost ($)');
    v.append(h('div',{class:'card'}, h('h2',null,'Stock'), h('div',{class:'tablewrap'},tb),
      low.length ? h('button',{class:'btn ghost sm',type:'button',style:'justify-self:start',onclick:()=>{ const lines = low.map(x => '- '+x.n+': order '+(x.min-x.have)); A.copy('Order list for '+site().name+'\n'+lines.join('\n')); }},'Copy an order list') : null,
      h('details',null, h('summary',null,'Add an item'), h('div',{class:'grid g3'}, h('label',{class:'f'},'Item',nN), h('label',{class:'f'},'Category',nC), nH.l, nM.l, nU.l),
        h('button',{class:'btn sm',type:'button',onclick:()=>{ if (!nN.value.trim()) return toast('Name the item'); a.inv.push({id:uid(), site:sid, cat:nC.value, n:nN.value.trim(), have:+nH.i.value||0, min:+nM.i.value||0, cost:+nU.i.value||0}); save(); A.route(); toast('Item added'); }},'Add item'))));
    // expenses
    const eA = num('', 'Amount ($)'), eC = h('select',{'aria-label':'Expense category'}, AC.EXP_CATS.filter(c => c !== 'Food').map(c => h('option',null,c))), eD = h('input',{type:'date',value:todayIso(),'aria-label':'Date'}), eN = h('input',{type:'text','aria-label':'Note',placeholder:'What it was (no resident names)'});
    const byCat = catTotals(sid, 30);
    v.append(h('div',{class:'card'}, h('h2',null,'Spending, last 30 days'),
      h('div',{class:'list'}, Object.keys(byCat).sort((x,y) => byCat[y]-byCat[x]).map(k => h('div',{class:'item',style:'grid-template-columns:1fr auto;align-items:center'}, h('span',null,k), h('b',null,money(byCat[k]))))),
      h('p',{class:'small muted'},'Food comes from receipts logged in Menu and groceries.'),
      h('h3',null,'Log an expense'), h('div',{class:'grid g4'}, eA.l, h('label',{class:'f'},'Category',eC), h('label',{class:'f'},'Date',eD), h('label',{class:'f'},'Note',eN)),
      h('button',{class:'btn sm',type:'button',style:'justify-self:start',onclick:()=>{ if (!(+eA.i.value > 0)) return toast('Enter the amount'); a.exp.push({id:uid(), site:sid, date:eD.value||todayIso(), cat:eC.value, amt:+eA.i.value, note:eN.value.trim()}); save(); A.route(); toast('Expense logged'); }},'Save expense'),
      h('button',{class:'btn quiet sm',type:'button',style:'justify-self:start',onclick:()=>{ const rows = [['date','category','amount','note']].concat(allExp(sid).map(e => [e.date, e.cat, e.amt, e.note||''])); A.download('expenses-'+sid+'.csv', 'text/csv', rows.map(r => r.map(A.csvCell).join(',')).join('\n')); }},'Export CSV')));
  }
  function allExp(sid){
    const own = st().exp.filter(e => e.site === sid);
    const food = (((S().care||{}).spend)||[]).filter(e => e.site === sid).map(e => ({date:e.date, cat:'Food', amt:e.amt, note:e.store||''}));
    return own.concat(food).sort((a,b) => a.date < b.date ? 1 : -1);
  }
  function catTotals(sid, days){ const from = daysAgo(days), out = {}; allExp(sid).filter(e => e.date >= from).forEach(e => { out[e.cat] = (out[e.cat]||0) + e.amt; }); return out; }
  function monthSpend(sid, days){ const t = catTotals(sid, days); return Object.values(t).reduce((a,b) => a+b, 0); }
  function perResidentDay(sid){ const n = (D.RESIDENTS[sid]||[]).length || 1; return monthSpend(sid, 30) / (n*30); }

  function countyOf(){ const f = S().facility && S().facility[S().site]; return (f && f.profile && f.profile.county) || ({maple:'Marathon', birch:'Shawano', cedar:'Dane'})[S().site] || ''; }
  function wages(v){
    v.append(head('Toolkit', 'Pay benchmarks', 'What the market pays by role and Wisconsin area, next to the rates in your schedule. From the BLS Occupational Employment and Wage Statistics (OEWS).'));
    const Wg = W(); if (!Wg){ v.append(h('p',null,'Pay data is not loaded.')); return; }
    const cs = h('input',{type:'text',id:'acCounty',value:countyOf(),'aria-label':'County',list:'acCounties'});
    const dl = h('datalist',{id:'acCounties'}, Object.keys(Wg.COUNTY).map(c => h('option',{value:c})));
    const out = h('div',{class:'list'});
    function draw(){
      out.textContent = '';
      const areaId = Wg.areaFor(cs.value), areaName = Wg.lookup('cna', cs.value).areaName;
      out.append(h('p',{class:'small'}, h('b',null,(cs.value||'Statewide')+' → '+areaName+'. '), h('a',{href:Wg.blsUrl(areaId),target:'_blank',rel:'noopener'},'Open this area on BLS')));
      Object.keys(Wg.ROLES).forEach(r => {
        const x = Wg.lookup(r, cs.value);
        out.append(h('div',{class:'item'}, h('div',{class:'meta'}, h('span',null,'SOC '+x.soc), x.check ? h('span',{class:'chip amber'},'Area figures being checked') : h('span',{class:'chip calm'},'Official, '+Wg.asOf)),
          h('b',null,x.label),
          x.hourly ? h('span',null,'Median '+money2(x.hourly.median)+'/hr · middle half '+money2(x.hourly.p25)+' to '+money2(x.hourly.p75)) : x.anchor ? h('span',{class:'small'},'National anchor: '+money2(x.anchor.median)+'/hr ('+x.anchor.where+', '+x.anchor.src+'). Wisconsin area figure not loaded yet.') : h('span',{class:'small muted'},'Not loaded yet. Use the BLS link above for this area.')));
      });
    }
    cs.addEventListener('input', draw);
    v.append(h('div',{class:'card'}, h('label',{class:'f',for:'acCounty'},'County', cs), dl, out));
    if (Wg.GROUP && Wg.GROUP.length) v.append(h('div',{class:'card soft'}, h('h2',null,'Area figures we have read so far'), h('ul',{class:'small'}, Wg.GROUP.map(g => h('li',null,(Wg.AREAS[g.area]||{}).name+': '+g.label+' '+money2(g.hourly)+'/hr ('+g.period+')')))));
    // home's own rates
    const SD = D.SCHED; const names = (S().staff[S().site]||[]).map(p => p.n);
    const rates = names.map(n => ({n, r:(SD.profiles[n]||{}).rate})).filter(x => x.r);
    const anchor = (Wg.lookup('pca', cs.value).hourly || {}).median || (Wg.ANCHORS.pca||{}).median;
    if (rates.length) v.append(h('div',{class:'card'}, h('h2',null,'Your caregiver rates (sample)'), h('div',{class:'list'}, rates.map(x => h('div',{class:'item',style:'grid-template-columns:1fr auto auto;align-items:center;gap:.6rem'}, h('span',null,x.n), h('b',null,money2(x.r)), anchor ? h('span',{class:'chip '+(x.r>=anchor?'calm':'amber')}, (x.r>=anchor?'+':'')+money2(x.r-anchor)+' vs benchmark') : null))),
      h('p',{class:'small muted'},'Compared with the caregiver benchmark shown above. Pay is one part of keeping staff; schedules, respect and a manager who answers matter too.')));
    v.append(h('p',{class:'small muted'}, Wg.asOf+'. Benchmarks are a guide, not a pay recommendation.'));
  }

  function hire(v){
    const a = st(), p = PAY(), Wg = W();
    v.append(head('Toolkit', 'Hiring planner', 'What one more staff member really costs in a year, beyond the hourly wage.'));
    const role = h('select',{id:'acRole'}, Object.keys((Wg && Wg.ROLES) || {pca:1}).map(r => h('option',{value:r,selected:r===(a.hire.role||'pca')}, Wg ? Wg.ROLES[r].label : r)));
    const base = () => { const x = Wg ? Wg.lookup(role.value, countyOf()) : null; return (x && x.hourly && x.hourly.median) || (x && x.anchor && x.anchor.median) || 18; };
    const f = {
      wage:num(a.hire.wage||base(),'Hourly wage ($)'), hrs:num(a.hire.hrs||32,'Hours a week'), ot:num(a.hire.ot||2,'Overtime hours a week (average)'),
      ben:num(a.hire.ben||5,'Benefits (% of wages)'), wc:num(a.hire.wc||p.wcPer100,'Workers\' comp ($ per $100 of payroll)'), suta:num(a.hire.suta||p.suta,'WI unemployment rate (%)'),
      trainH:num(a.hire.trainH||(site().setting==='cbrf'?40:15),'Paid training hours, first year'), course:num(a.hire.course||(site().setting==='cbrf'?350:120),'Course fees ($)'),
      bg:num(a.hire.bg||25,'Background check and screening ($)'), rec:num(a.hire.rec||400,'Recruiting and ads ($)'), turn:num(a.hire.turn||45,'Chance they leave in year one (%)')
    };
    const out = h('div');
    function calc(){
      const g = k => +f[k].i.value||0;
      Object.keys(f).forEach(k => a.hire[k] = g(k)); a.hire.role = role.value; save();
      const wagesYr = g('wage')*g('hrs')*52 + g('wage')*1.5*g('ot')*52 + g('wage')*g('trainH');
      const fica = wagesYr*p.fica/100, futa = Math.min(wagesYr,p.futaBase)*p.futa/100, suta = Math.min(wagesYr,p.sutaBase)*g('suta')/100, wc = wagesYr/100*g('wc'), ben = wagesYr*g('ben')/100;
      const oneTime = g('course')+g('bg')+g('rec');
      const turnover = g('turn')/100 * (oneTime + g('wage')*g('trainH') + 0.1*wagesYr);
      const total = wagesYr+fica+futa+suta+wc+ben+oneTime+turnover;
      const rows = [['Wages (regular, overtime, training hours)', wagesYr], ['Social Security and Medicare (FICA)', fica], ['Federal unemployment (FUTA)', futa], ['Wisconsin unemployment', suta], ['Workers\' compensation', wc], ['Benefits', ben], ['Courses, checks and recruiting', oneTime], ['Expected turnover cost', turnover]];
      out.textContent = '';
      out.append(h('div',{class:'grid g3'}, h('div',{class:'stat'},h('b',null,money(total)),h('span',null,'first-year cost')), h('div',{class:'stat'},h('b',null,money2(total/Math.max(1,(g('hrs')+g('ot'))*52))),h('span',null,'real cost per hour worked')), h('div',{class:'stat'},h('b',null,Math.round((total/wagesYr-1)*100)+'%'),h('span',null,'on top of wages'))),
        h('div',{class:'tablewrap'}, h('table',{class:'t'}, h('caption',{class:'small muted',style:'text-align:left'},'First-year cost breakdown'), h('tbody',null, rows.map(r => h('tr',null, h('th',{scope:'row',style:'text-align:left;font-weight:600'},r[0]), h('td',null,money(r[1]))))))));
    }
    role.addEventListener('change', () => { f.wage.i.value = String(base()); calc(); });
    Object.values(f).forEach(x => x.i.addEventListener('input', calc));
    v.append(h('div',{class:'card'}, h('label',{class:'f',for:'acRole'},'Role', role), h('div',{class:'grid g3'}, Object.values(f).map(x => x.l)), out,
      h('p',{class:'small muted'}, p.note || p.check), h('p',{class:'small muted'},'Turnover cost assumes recruiting, training and about 10% of a year\'s wages in overtime and lost time to replace someone. Not tax advice.')));
    calc();
  }

  function startup(v){
    const a = st(), vert = AC.STARTUP[a.vertical] || AC.STARTUP.residential;
    v.append(head('Toolkit', 'Startup and expansion model', 'A new home, or more beds in the one you have. Change any number. All starting figures are sample assumptions, not quotes.'));
    const kinds = Object.keys(vert);
    const kind = h('select',{id:'acKind'}, kinds.map(k => h('option',{value:k,selected:k===(a.startup.kind||kinds[0])},vert[k].label)));
    const box = h('div');
    function draw(){
      a.startup.kind = kind.value; save();
      const P = vert[kind.value]; const saved = (a.startup[kind.value] = a.startup[kind.value] || {});
      box.textContent = '';
      const val = (k, d) => saved[k] != null ? saved[k] : d;
      const f = {beds:num(val('beds',P.beds),'Beds'), rate:num(val('rate',P.rate),'Monthly rate per resident ($)'), occ:num(val('occ',P.occ),'Expected occupancy (%)'), hrs:num(val('hrs',Math.round(P.staffHrs)),'Staff hours a month'), wage:num(val('wage',P.wage),'Average wage ($/hr)'), load:num(val('load',22),'Payroll taxes, comp and benefits (%)'), ramp:num(val('ramp',4),'Months to fill beds')};
      const one = P.oneTime.map((r, i) => num(val('o'+i, Math.round(r[1])), r[0]));
      const mon = P.monthly.map((r, i) => num(val('m'+i, r[1]), r[0]));
      const out = h('div');
      function calc(){
        Object.keys(f).forEach(k => saved[k] = +f[k].i.value||0); one.forEach((x,i) => saved['o'+i] = +x.i.value||0); mon.forEach((x,i) => saved['m'+i] = +x.i.value||0); save();
        const g = k => saved[k];
        const startCost = one.reduce((s,x) => s + (+x.i.value||0), 0);
        const fixed = mon.reduce((s,x) => s + (+x.i.value||0), 0);
        const staff = g('hrs')*g('wage')*(1+g('load')/100);
        const costs = fixed + staff;
        const revFull = g('beds')*g('rate');
        const rev = revFull*g('occ')/100;
        const margin = rev - costs;
        const beOcc = revFull ? Math.ceil(costs/g('rate')*10)/10 : 0;
        const rampLoss = g('ramp') ? (costs*g('ramp') - rev*g('ramp')/2) : 0;
        const need = startCost + Math.max(0, rampLoss) + 3*costs;
        const payback = margin > 0 ? Math.ceil((startCost + Math.max(0,rampLoss)) / margin) : null;
        out.textContent = '';
        out.append(h('div',{class:'grid g3'},
          h('div',{class:'stat '+(margin>=0?'good':'warnc')},h('b',null,money(margin)),h('span',null,'monthly margin at '+g('occ')+'% full')),
          h('div',{class:'stat '+(beOcc>g('beds')?'warnc':'')},h('b',null,beOcc>g('beds') ? 'More than '+g('beds') : beOcc+' of '+g('beds')),h('span',null,'beds filled to break even')),
          h('div',{class:'stat'},h('b',null,payback ? payback+' mo' : 'No payback'),h('span',null,'to earn back startup and fill-up costs')),
          h('div',{class:'stat'},h('b',null,money(startCost)),h('span',null,'one-time startup cost')),
          h('div',{class:'stat'},h('b',null,money(costs)),h('span',null,'monthly costs, staff '+money(staff))),
          h('div',{class:'stat'},h('b',null,money(need)),h('span',null,'cash to have ready (startup, fill-up and 3 months of costs)'))),
          margin < 0 ? h('p',{class:'small',style:'color:var(--red)'},'At this occupancy the home loses money each month. Look at the rate, staffing hours or fixed costs.') : null);
      }
      [...Object.values(f), ...one, ...mon].forEach(x => x.i.addEventListener('input', calc));
      box.append(h('div',{class:'card'}, h('h2',null,'Revenue and staffing'), h('div',{class:'grid g3'}, Object.values(f).map(x => x.l))),
        h('div',{class:'card'}, out),
        h('details',{class:'card'}, h('summary',null,'One-time startup costs'), h('div',{class:'grid g2'}, one.map(x => x.l))),
        h('details',{class:'card'}, h('summary',null,'Monthly costs (besides staff)'), h('div',{class:'grid g2'}, mon.map(x => x.l)), h('p',{class:'small muted'},'Tip: your real monthly supplies, utilities and food from Inventory and expenses are a good check on these.')),
        h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ a.startup[kind.value] = {}; save(); draw(); }},'Reset to sample numbers'));
      calc();
    }
    kind.addEventListener('change', draw);
    v.append(h('div',{class:'card soft'}, h('label',{class:'f',for:'acKind'},'What are you planning?', kind), h('p',{class:'small'},'The license fee uses the DQA fee schedule. Everything else is a sample to replace with your quotes. Not financial advice.')), box);
    draw();
  }

  // ---------- router ----------
  // The academy (business, licensing, app setup and toolkit) is for owners and people starting a home, not staff.
  // Staff get the role modules on their own screen, Staff training (#/training).
  const OWNER_TIERS = ['owner','multi'];
  const isOwner = () => OWNER_TIERS.includes(S().tier);
  let BASE = 'academy';
  R.academy = v => {
    st();
    if (!isOwner()){
      v.append(head('Owners only', 'The Getting started academy is for owners', 'It covers starting and running the business. Your role modules and certificates are in Staff training.'),
        h('div',{class:'row'}, h('a',{class:'btn',href:'#/training'},'Open Staff training')));
      return;
    }
    BASE = 'academy';
    const p = (location.hash.match(/^#\/academy\/?(.*)$/)||[])[1] || '';
    const [a, b] = p.split('/');
    if (!a) return overview(v);
    if (TRACKS.some(t => t.id === a)) return trackPage(v, a);
    if (a === 'u') return unitPage(v, b);
    if (a === 'm') return modulePage(v, b);
    if (a === 'cert') return certPage(v, b);
    if (a === 'tool') return toolPage(v, b);
    overview(v);
  };
  R.training = v => {
    st(); BASE = 'training';
    const p = (location.hash.match(/^#\/training\/?(.*)$/)||[])[1] || '';
    const [a, b] = p.split('/');
    if (a === 'm') return modulePage(v, b);
    if (a === 'cert') return certPage(v, b);
    v.append(head('Staff training', 'Short trainings for your role', 'Ten to twenty minutes each, with a quiz and a certificate. Your manager confirms the hours before they count toward your yearly training.'), A.art('night-shift'));
    const mine = st().certs.filter(c => c.who === defaultLearner());
    rolesTrack(v);
    if (mine.length) v.append(certList(mine.slice().reverse(), 'My certificates'));
    v.append(notOfficial());
  };
  VIEWS.academy = {t:'Getting started academy', ic:'🎒'};
  VIEWS.training = {t:'Staff training', ic:'🎓'};
  const addNav = (t, view, at) => { const n = NAV[t]; if (n && !n.includes(view)) n.splice(Math.min(at, n.length), 0, view); };
  // Undo the earlier placement for staff menus, then add each screen to its own roles.
  ['caregiver','manager','rn'].forEach(t => { const n = NAV[t]; if (n && n.includes('academy')) n.splice(n.indexOf('academy'), 1); addNav(t, 'training', 1); });
  OWNER_TIERS.forEach(t => addNav(t, 'academy', 1));
  if (window.SSAccess && SSAccess.register) try {
    SSAccess.register({id:'academy', name:'Getting started academy', ic:'🎒', what:'For owners: starting a home, setting up the app, running the business, and business tools.', views:['academy'], tiers:OWNER_TIERS.slice()});
    SSAccess.register({id:'training', name:'Staff training', ic:'🎓', what:'Short role modules with quizzes, certificates and training hours a manager confirms.', views:['training'], tiers:['caregiver','manager','rn','owner','multi']});
    // Never show the academy to staff, even if older saved settings or a shared permission would.
    const viewOn0 = SSAccess.viewOn;
    SSAccess.viewOn = view => view === 'academy' ? isOwner() && viewOn0(view) : viewOn0(view);
    const mods = S().mods; if (mods) Object.keys(mods).forEach(sid => { const x = mods[sid] && mods[sid].academy; if (x && x.tiers) x.tiers = x.tiers.filter(t => OWNER_TIERS.includes(t)); });
  } catch(e){}

  // ---------- hooks into other screens ----------
  // Team training: confirm academy hours so they count. The scheduler's training-hours check reads the same staff record.
  const oldTeam = R.team;
  R.team = v => {
    oldTeam(v);
    const sid = S().site, waiting = st().certs.filter(c => c.site === sid && !c.counted);
    const recOf = n => (S().staff[sid]||[]).find(p => p.n === n);
    v.append(h('div',{class:'card'}, h('h2',null,'Academy training waiting to count'),
      h('p',{class:'small muted'},'In-house Steady Shift modules. You decide whether each counts toward yearly hours for your home. They never replace the CBRF approved courses.'),
      waiting.length ? h('div',{class:'list'}, waiting.map(c => h('div',{class:'item'}, h('div',{class:'meta'},h('span',null,fmtDate(c.at)),h('span',null,c.hours+' hr'),h('span',null,'Score '+c.score+' of '+c.of)), h('b',null,c.who+': '+c.title),
        h('div',{class:'row'},
          recOf(c.who) ? h('button',{class:'btn sm',type:'button',onclick:()=>{ const r = recOf(c.who); r.hours = Math.round((r.hours + c.hours)*10)/10; c.counted = true; c.countedBy = tier().name+' (you)'; save(); toast(c.hours+' hours added for '+c.who); A.route(); }},'Count '+c.hours+' hr') : h('span',{class:'small muted'},'Not on this home\'s staff list.'),
          h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ c.counted = true; c.hours = 0; c.countedBy = 'Not counted'; save(); A.route(); }},'Don\'t count'),
          h('a',{class:'small',href:'#/training/cert/'+c.id},'Certificate'))))) : h('p',{class:'muted'},'Nothing waiting. ', h('a',{href:'#/training'},'Run a module with a staff member')),
      h('p',{class:'small'},'Counted hours update the schedule\'s training check right away.')));
  };
  const oldMy = R.mytraining;
  R.mytraining = v => {
    oldMy(v);
    const me = defaultLearner(), mine = st().certs.filter(c => c.who === me);
    v.append(mine.length ? certList(mine.slice().reverse(), 'My training certificates') : h('div',{class:'card soft'}, h('b',null,'Short trainings for you'), h('p',{class:'small'},'New caregiver modules take 10 minutes each and end with a certificate.'), h('a',{class:'btn ghost sm',href:'#/training',style:'justify-self:start'},'Start one')));
  };
  // Owner view: supplies and expenses from the tracker.
  (A.ownerHooks = A.ownerHooks || []).push(v => {
    const sid = S().site, t = catTotals(sid, 30), low = st().inv.filter(x => x.site === sid && x.have < x.min).length;
    v.append(h('div',{class:'card'}, h('h2',null,'Supplies and expenses (last 30 days)'),
      h('div',{class:'grid g3'}, h('div',{class:'stat'},h('b',null,money(monthSpend(sid,30))),h('span',null,'spent')), h('div',{class:'stat'},h('b',null,money2(perResidentDay(sid))),h('span',null,'per resident per day')), h('div',{class:'stat '+(low?'warnc':'good')},h('b',null,String(low)),h('span',null,'items below minimum'))),
      h('p',{class:'small'}, Object.keys(t).sort((x,y) => t[y]-t[x]).slice(0,4).map(k => k+' '+money(t[k])).join(' · ')),
      h('div',{class:'row'}, h('a',{class:'btn ghost sm',href:'#/academy/tool/inventory'},'Inventory and expenses'), h('a',{class:'btn ghost sm',href:'#/academy/tool/startup'},'Startup and expansion model'), h('a',{class:'btn ghost sm',href:'#/academy/tool/hire'},'Hiring planner'), h('a',{class:'btn ghost sm',href:'#/academy'},'Getting started academy'))));
  });
  // Home: staff get a nudge to Staff training. Owners see the academy on the Owner view card.
  (A.homeHooks = A.homeHooks || []).push((v, t) => {
    if (S().site === 'family' || !['caregiver','manager'].includes(t)) return;
    const me = defaultLearner(), mods = AC.MODULES.filter(m => m.role === t);
    if (mods.every(m => certFor(m.id, me))) return;
    v.append(A.tile('training','🎓', t==='caregiver' ? 'New here? Short trainings' : 'Trainings for new managers', '10 to 20 minute modules with a certificate.'));
  });
  window.SSAcademy = {state:st, trackProgress, catTotals, monthSpend};
})();
