// Steady Shift test app. Sign-in reuses the Owner Desk's Supabase project.
// Sample records live in this browser only (localStorage). Feedback is saved to the desk's Requests for Claude.
(function(){
  const D = window.SS_DATA;
  const $ = id => document.getElementById(id);

  // ---------- tiny element builder (never sets innerHTML from user text) ----------
  function h(tag, attrs, ...kids){
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs){
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'style') e.setAttribute('style', v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    }
    for (const c of kids.flat(9)){
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return e;
  }
  const fmtDate = s => { if(!s) return ''; const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); };
  const fmtTime = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); };
  const daysUntil = s => Math.ceil((new Date(s+'T12:00:00') - new Date()) / 86400000);
  const uid = () => Math.random().toString(36).slice(2,9);
  function toast(msg){ const t = h('div',{class:'toast',role:'status'},msg); document.body.append(t); setTimeout(()=>t.remove(),2600); }
  function copy(text, btn){
    const done = () => { if(btn){ const o = btn.textContent; btn.textContent = 'Copied'; setTimeout(()=>btn.textContent=o,1500);} else toast('Copied'); };
    try { navigator.clipboard.writeText(text).then(done, ()=>toast('Select the text and copy it')); } catch(e){ toast('Select the text and copy it'); }
  }

  // ---------- saved test state (this browser only) ----------
  const KEY = 'ss-app-v1';
  function fresh(){ const s = JSON.parse(JSON.stringify(D.SEED)); return Object.assign(s,{tier:'caregiver', site:'maple', survey:{}, tour:{}, watch:{}, policies:[], orgProcs:[], facility:{}, pulse:{}, peer:{votes:{},queue:[],published:[]}, oncall:{fallok:false,medq:false,callin:true}}); }
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch(e){ S = fresh(); }
  for (const k in fresh()) if (!(k in S)) S[k] = fresh()[k];
  (S.orgProcs || []).forEach(p => { if (!p.site) p.site = 'maple'; }); // older test data had no home
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){} }

  const site = () => D.SITES.find(s => s.id === S.site) || D.SITES[0];
  const setting = () => site().setting;
  const tier = () => D.TIERS.find(t => t.id === S.tier) || D.TIERS[0];
  const residents = () => D.RESIDENTS[S.site] || [];
  const ruleById = id => D.RULES.find(r => r.id === id);
  const forSite = arr => arr.filter(x => x.site === S.site);

  // ---------- navigation ----------
  const VIEWS = {
    home:{t:'Home', ic:'🏠'},
    check:{t:'Procedure check', ic:'✅'},
    report:{t:'Report something', ic:'📝'},
    required:{t:'Required reports', ic:'📋'},
    night:{t:'Night help', ic:'🌙'},
    whatif:{t:'What-if library', ic:'🧭'},
    behavior:{t:'Behavior help', ic:'🤝'},
    cards:{t:'Clarity Cards', ic:'📇'},
    survey:{t:'Survey-Ready Check', ic:'📋'},
    decide:{t:'Decide and Document', ic:'⚖️'},
    ask:{t:'Ask the Regulator', ic:'✉️'},
    watch:{t:'Regulatory Watch', ic:'🔔'},
    inbox:{t:'Reports to review', ic:'📥'},
    questions:{t:'Question log', ic:'💬'},
    team:{t:'Team training', ic:'🎓'},
    delegations:{t:'Delegation ledger', ic:'🩺'},
    owner:{t:'Owner view', ic:'📊'},
    sites:{t:'All sites', ic:'🏘️'},
    handoff:{t:'Hand-off packet', ic:'🧾'},
    mytraining:{t:'My training', ic:'🎓'},
    procedures:{t:'Policies and procedures', ic:'🗂️'},
    setup:{t:'Facility setup and policy upload', ic:'🏁'},
    askpolicy:{t:'Ask our policy', ic:'🔎'},
    review:{t:'Feedback review', ic:'👍'},
    sync:{t:'Sync and calendar', ic:'🔗'},
    orders:{t:'Doctor orders', ic:'📄'},
    peer:{t:'What\'s worked for others', ic:'🤲'},
    schedule:{t:'Schedule', ic:'📅'},
    time:{t:'Time sheets', ic:'⏱️'},
    insights:{t:'Owner insights', ic:'📈'},
    outlook:{t:'Owner Outlook', ic:'🔭'},
    labor:{t:'Labor and pay', ic:'💵'},
    access:{t:'Services and access', ic:'🔑'},
    kiosk:{t:'House tablet', ic:'🖥️'}
  };
  const NAV = {
    caregiver:['home','schedule','time','check','askpolicy','whatif','report','night','behavior','cards','peer','mytraining','access'],
    manager:['home','setup','procedures','schedule','time','kiosk','inbox','orders','questions','check','askpolicy','whatif','report','night','behavior','team','review','survey','decide','ask','cards','peer','watch','required','sync','access'],
    rn:['home','delegations','orders','schedule','time','sync','check','askpolicy','whatif','cards','night','behavior','watch'],
    owner:['home','owner','insights','outlook','labor','setup','procedures','schedule','time','access','sync','review','peer','askpolicy','whatif','required','survey','questions','decide','ask','watch','cards'],
    multi:['home','sites','owner','insights','outlook','labor','setup','procedures','schedule','time','access','sync','review','peer','askpolicy','whatif','required','survey','watch','ask','cards'],
    family:['home','check','night','behavior','handoff','cards','watch']
  };

  function renderNav(view){
    const nav = $('nav'); nav.textContent = '';
    const on = v => !window.SSAccess || SSAccess.viewOn(v);
    if (simpleOn()){
      // Simple view for floor staff: only the everyday buttons, plus one way out to everything else.
      nav.append(h('div',{class:'grp'},'On shift'));
      nav.append(navLink('home', view));
      SIMPLE.filter(x => VIEWS[x[0]] && on(x[0])).forEach(([v, ic, t]) => nav.append(h('a',{href:'#/'+v,'aria-current':v===view?'page':null},h('span',{class:'ic','aria-hidden':'true'},ic),t)));
      nav.append(h('a',{href:'#/home',onclick:e=>{ e.preventDefault(); setSimple(false); }},h('span',{class:'ic','aria-hidden':'true'},'➕'),'Show all options'));
      return;
    }
    const mine = NAV[S.tier].filter(on);
    nav.append(h('div',{class:'grp'},(/^[aeiou]/i.test(tier().name)?'For an ':'For a ')+tier().name.toLowerCase()));
    if (S.tier === 'caregiver') nav.append(h('a',{href:'#/home',onclick:e=>{ e.preventDefault(); setSimple(true); }},h('span',{class:'ic','aria-hidden':'true'},'🔲'),'Back to simple view'));
    mine.forEach(v => nav.append(navLink(v, view)));
    const rest = Object.keys(VIEWS).filter(v => !mine.includes(v) && on(v));
    nav.append(h('div',{class:'grp'},'Everything else (unlocked)'));
    rest.forEach(v => nav.append(navLink(v, view)));
  }
  function navLink(v, cur){ return h('a',{href:'#/'+v,'aria-current':v===cur?'page':null},h('span',{class:'ic','aria-hidden':'true'},VIEWS[v].ic),VIEWS[v].t); }

  function fillSwitchers(){
    const ts = $('tierSel'); ts.textContent = '';
    D.TIERS.forEach(t => ts.append(h('option',{value:t.id,selected:t.id===S.tier},t.name)));
    const ss = $('siteSel'); ss.textContent = '';
    D.SITES.forEach(s => ss.append(h('option',{value:s.id,selected:s.id===S.site},s.name+' ('+D.SETTINGS[s.setting].short+')')));
  }
  $('tierSel').addEventListener('change', e => {
    S.tier = e.target.value;
    if (S.tier === 'family') S.site = 'family';
    else if (S.site === 'family') S.site = 'maple';
    save(); fillSwitchers(); go('home');
  });
  $('siteSel').addEventListener('change', e => { S.site = e.target.value; save(); route(); });

  function go(v){ if (location.hash === '#/'+v) route(); else location.hash = '#/'+v; }
  let current = 'home', param = '';
  function route(){
    logDropoff();
    const m = (location.hash||'').match(/^#\/([a-z]+)(?:\/(.*))?/);
    current = m && VIEWS[m[1]] ? m[1] : 'home';
    param = m && m[2] ? decodeURIComponent(m[2]) : '';
    // A registered shift station only ever shows the station (see station.js).
    if (window.SSStation && SSStation.holds() && current !== 'kiosk'){ history.replaceState(null,'','#/kiosk'); current = 'kiosk'; param = ''; }
    if (window.SSResidents) SSResidents.apply(); // moved-out residents leave every active list
    renderNav(current);
    const main = $('main'); main.textContent = '';
    const view = h('div',{class:'view'});
    if (window.SSAccess && !SSAccess.viewOn(current)) SSAccess.offView(view, current); else (R[current] || R.home)(view);
    main.append(view);
    if (S.tour) { S.tour[current] = true; save(); }
    window.scrollTo(0,0);
  }
  window.addEventListener('hashchange', route);
  // wide tables scroll sideways on phones; let keyboard users reach and scroll them too
  new MutationObserver(() => $('main').querySelectorAll('.tablewrap:not([tabindex])').forEach(w => { w.tabIndex = 0; w.setAttribute('role','region'); w.setAttribute('aria-label','Table (scrolls sideways)'); }))
    .observe($('main'), {childList:true, subtree:true});

  function head(eyebrow, title, lede){ return h('div',{class:'head'}, h('span',{class:'eyebrow'},eyebrow), h('h1',null,title), lede ? h('p',{class:'muted'},lede) : null); }
  const LABEL = {rule:['Rule says','calm'], reading:['Best reading','amber'], open:['Open question','red']};
  function labelChip(l){ const x = LABEL[l]; return h('span',{class:'chip '+x[1]},x[0]); }
  function settingChip(){ return h('span',{class:'chip grey'},D.SETTINGS[setting()].name); }

  // ---------- rule card (Procedure check and Clarity Cards) ----------
  function ruleCard(r, opts){
    opts = opts || {};
    const sets = opts.compare ? ['afh','cbrf'] : [setting()];
    const c = h('div',{class:'card rule'});
    c.append(h('div',{class:'chips'}, labelChip(r.label), h('span',{class:'chip grey'},r.topic), h('span',{class:'chip grey'},'Checked '+fmtDate(D.CHECKED))));
    c.append(h('h2',null,r.q));
    sets.forEach(st => {
      const a = r[st];
      c.append(h('div',{class:'grid',style:'gap:.25rem'},
        opts.compare ? h('h4',null,D.SETTINGS[st].name) : null,
        h('p',{class:'ans'},a.a),
        h('p',{class:'cite'},'Source: '+a.cite)));
    });
    if (r.steps && !opts.compact){
      c.append(h('h3',null,'What to do'), h('ol',{class:'steps'}, r.steps.map(s => h('li',null,h('span',null,s)))));
    }
    if (r.house && setting() !== 'home' && !opts.compact){
      const f = r.house.flag;
      c.append(h('div',{class:'house '+f},
        h('b',null, f==='gap' ? 'Your home\'s policy may differ from the rule' : f==='house' ? 'House rule, not a state rule' : 'Your home\'s policy matches'),
        h('span',null,r.house.text), r.house.note ? h('span',null,r.house.note) : null));
    }
    if (!opts.compact){
      const row = h('div',{class:'row noprint'});
      row.append(h('button',{class:'btn ghost sm',type:'button',onclick:()=>confused(r, c)},'This rule confused me'));
      if (r.label === 'open' || D.GRAY.some(g=>g.id===r.id)) row.append(h('a',{class:'btn ghost sm',href:'#/decide/'+r.id},'Decide and Document'));
      if (D.ASK_TOPICS.some(a=>a.id===r.id)) row.append(h('a',{class:'btn ghost sm',href:'#/ask/'+r.id},'Ask the Regulator'));
      c.append(row);
    }
    if (!opts.compact) c.append(rateBar('check', r.id, r.q));
    c.append(h('p',{class:'foot'},'Not legal advice. Check with your licensing specialist or attorney for your situation.'));
    return c;
  }
  function confused(r, card){
    if (card.querySelector('.confuse')) return;
    const box = h('form',{class:'card soft confuse'});
    const txt = h('textarea',{maxlength:'600',placeholder:'What felt contradictory? No names or health details, please.'});
    const from = h('select',null,['Manager','Nurse','Care manager','County','Family','Another facility','Internet'].map(o=>h('option',null,o)));
    box.append(h('h3',null,'What confused you?'), h('p',{class:'small muted'},'Anonymous. Your manager sees the topic and count, not who asked.'),
      txt, h('label',{class:'f'},'Who told you something different?',from),
      h('div',{class:'row'},h('button',{class:'btn sm',type:'submit'},'Send'),h('button',{class:'btn quiet sm',type:'button',onclick:()=>box.remove()},'Cancel')));
    box.addEventListener('submit', e => {
      e.preventDefault();
      if (/\b(abuse|hurt|hit|neglect|stole)\b/i.test(txt.value)){ toast('If someone may be harmed, tell your manager now. This button is not a reporting channel.'); }
      S.confusions.push({rule:r.id, text:txt.value.trim(), from:from.value, site:S.site, at:new Date().toISOString()}); save();
      box.replaceWith(h('div',{class:'card calm'},h('b',null,'Thanks. It\'s logged.'),h('span',{class:'small'},'When this one gets a clearer answer, you\'ll see a "you asked, here\'s the answer" note.')));
    });
    card.append(box); txt.focus();
  }

  function searchRules(q){
    const words = q.toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
    if (!words.length) return [];
    return D.RULES.map(r => {
      const hay = (r.q+' '+r.keys+' '+r.topic).toLowerCase();
      let s = 0; words.forEach(w => { if (hay.includes(w)) s += 2; else if (w.length > 4 && hay.includes(w.slice(0,-1))) s += 1; });
      return {r, s};
    }).filter(x => x.s > 0).sort((a,b) => b.s - a.s).map(x => x.r);
  }
  const STOP = new Set('the and can for how what when who our does with that this have has are was not you your they them about need into from should'.split(' '));

  // ---------- views ----------
  const R = {};
  // Plug-in point for add-on modules (meals.js and others). Modules add views, nav items, home tiles and owner cards.
  const homeHooks = [], ownerHooks = [];

  R.home = v => {
    const t = S.tier;
    // manager and owner reminders (ISP reviews, staff training, their own) go first, above everything else
    if (['manager','owner','multi'].includes(t) && window.SSReminders){ const rb = SSReminders.banner(); if (rb) v.append(rb); }
    if (t === 'owner') return R.owner(v, true);
    if (t === 'multi') return R.sites(v, true);
    if (simpleOn()) return homeSimple(v);
    const ic = installCard(); if (ic) v.append(ic); const pc = pulseCard(); if (pc) v.append(pc);
    if (t === 'caregiver') homeCaregiver(v);
    if (t === 'manager') homeManager(v);
    if (t === 'rn') homeRN(v);
    if (t === 'family') homeFamily(v);
    homeHooks.forEach(f => { try { f(v, t); } catch(e){ console.error(e); } });
    v.append(tourCard());
  };

  function tile(href, ic, b, span, cls){ return h('a',{class:'tile'+(cls?' '+cls:''),href:'#/'+href},h('span',{class:'ic','aria-hidden':'true'},ic),h('b',null,b),h('span',null,span)); }

  function homeCaregiver(v){
    const hr = new Date().getHours();
    const shift = hr < 6 || hr >= 22 ? 'Night shift' : hr < 14 ? 'Day shift' : 'Evening shift';
    v.append(head(shift+' · '+site().name, 'What do you need right now?', 'Pick one. Everything is two taps or less.'));
    v.append(h('div',{class:'grid g2'},
      tile('check','✅','Check a procedure','"Can I…?" "How do I…?" Answers with the rule behind them.'),
      tile('report','📝','Report something','Say it once, your way. We make it professional and work out who needs it by when.'),
      tile('night','🌙','Night help: who do I call?','Sorts what wakes the manager and what waits for morning.'),
      tile('behavior','🤝','Behavior help','Calm, respectful ideas for hard moments.')));
    const rs = residents();
    v.append(h('div',{class:'card'}, h('h2',null,'Residents tonight'), h('p',{class:'small muted'},'Sample residents. Records use codes, not names.'),
      h('div',{class:'list'}, rs.map(r => h('div',{class:'item'}, h('div',{class:'meta'},h('span',{class:'chip'},r.code),h('b',{style:'color:var(--ink)'},r.nick+' (sample)')), h('span',{class:'small'},r.note))))));
    const mine = S.delegations.filter(d => d.site === S.site && d.cg === 'Caregiver B');
    if (window.SSISP) { const ic = SSISP.homeCard(); if (ic) v.append(ic); }
    if (window.SSSched && SSAccess.viewOn('schedule')) { const nc = SSSched.myNextCard(); if (nc) v.append(nc); }
    if (mine.length) v.append(h('div',{class:'card calm'},h('h3',null,'Tasks you\'re cleared for'), mine.map(d => h('p',null,d.task+' for '+d.res+' · review by '+fmtDate(d.review)))));
  }

  // ---------- Simple view for caregivers (Christian, 2026-11-27): big buttons, few choices ----------
  // On by default for the caregiver plan. "Show all options" switches to the full view, and it can be switched back.
  const SIMPLE = [
    ['face','✅','Shift checklist'],
    ['mar','💊','Medications'],
    ['notes','📝','Care notes'],
    ['report','⚠️','Report something'],
    ['shift','🔁','Shift report'],
    ['meals','🍽️','Meals'],
    ['clean','🧽','Cleaning'],
    ['night','📞','Who do I call?'],
    ['check','❓','Ask a question']
  ];
  function simpleOn(){ return S.tier === 'caregiver' && S.simple !== false; }
  function setSimple(on){ S.simple = !!on; save(); toast(on ? 'Simple view' : 'All options are showing'); go('home'); }
  function homeSimple(v){
    const hr = new Date().getHours();
    const shift = hr < 6 || hr >= 22 ? 'Night shift' : hr < 14 ? 'Day shift' : 'Evening shift';
    v.append(head(shift+' · '+site().name, 'What do you need?', null));
    const on = x => VIEWS[x] && (!window.SSAccess || SSAccess.viewOn(x));
    // Run the usual home cards off screen and keep only what they say: counts for the buttons, and anything urgent.
    const scratch = h('div',null);
    homeHooks.forEach(f => { try { f(scratch, 'caregiver'); } catch(e){ console.error(e); } });
    const info = {};
    scratch.querySelectorAll('a.tile').forEach(a => {
      const key = (a.getAttribute('href')||'').replace(/^#\//,'').split('/')[0];
      const b = a.querySelector('b'); if (!key || !b || info[key]) return;
      info[key] = {text:b.textContent.trim(), urgent:a.classList.contains('urgent'), href:a.getAttribute('href')};
    });
    const mine = SIMPLE.filter(x => on(x[0]));
    const now = Object.keys(info).filter(k => info[k].urgent && !mine.some(x => x[0] === k) && on(k)).slice(0, 3);
    if (now.length) v.append(h('div',{class:'bignow',role:'region','aria-label':'Needs you now'},
      now.map(k => h('a',{class:'bigbtn wide '+(['voice','myfile','hr','celebrate'].includes(k) ? 'info' : 'urgent'),href:info[k].href}, h('span',{class:'ic','aria-hidden':'true'},VIEWS[k].ic), h('b',null,info[k].text)))));
    v.append(h('div',{class:'biggrid'}, mine.map(([id, ic, label]) => {
      const x = info[id]; const status = x && /\d/.test(x.text) ? x.text.replace(/^[^:]*:\s*/,'') : '';
      return h('a',{class:'bigbtn'+(x && x.urgent ? ' urgent' : ''),href:x && x.href ? x.href : '#/'+id},
        h('span',{class:'ic','aria-hidden':'true'},ic), h('b',null,label), status ? h('span',{class:'st'},status) : null);
    })));
    const more = [];
    if (on('time')) more.push(['time','⏱️','Clock in or out']);
    if (on('schedule')) more.push(['schedule','📅','My schedule']);
    v.append(h('div',{class:'bigmore'},
      more.map(([id, ic, t]) => h('a',{class:'btn ghost',href:'#/'+id}, ic+' '+t)),
      h('button',{class:'btn quiet',type:'button',onclick:()=>setSimple(false)},'➕ Show all options')));
    const ic = installCard(); if (ic) v.append(ic); const pc = pulseCard(); if (pc) v.append(pc);
  }

  function homeManager(v){
    v.append(head('House manager · '+site().name, 'Good morning. Here\'s what happened.', null));
    if (!fac(S.site).docs.length && site().setting !== 'home') v.append(h('a',{class:'card soft',href:'#/setup',style:'text-decoration:none;color:inherit'}, h('b',null,'Finish setting up '+site().name), h('span',{class:'small'},'Add this home\'s handbook and policies so staff get answers specific to this home, with the law shown first.')));
    const tri = forSite(S.triage);
    const slept = tri.filter(x => !x.woke).length;
    const pend = forSite(S.reports).filter(r => r.status !== 'Filed').length;
    const qs = forSite(S.questions).length;
    v.append(h('div',{class:'grid g3'},
      h('div',{class:'card'},h('div',{class:'stat good'},h('b',null,String(slept)),h('span',null,'night questions handled without waking you'))),
      h('div',{class:'card'},h('div',{class:'stat warnc'},h('b',null,String(pend)),h('span',null,'reports waiting for your review'))),
      h('div',{class:'card'},h('div',{class:'stat'},h('b',null,String(qs)),h('span',null,'questions staff looked up this week')))));
    v.append(h('div',{class:'card'},h('h2',null,'While you slept'),
      tri.length ? h('div',{class:'list'}, tri.slice().reverse().map(x => {
        const t = D.TRIAGE.find(y=>y.id===x.id) || {name:x.id,level:'morning'};
        return h('div',{class:'item'},h('div',{class:'meta'},levelBadge(t.level),h('span',null,fmtTime(x.at))),h('b',null,t.name),h('span',{class:'small'},x.note));
      })) : h('p',{class:'muted'},'Quiet night. Nothing logged.')));
    v.append(h('div',{class:'grid g2'},
      tile('inbox','📥','Review reports','Approve, or ask for more facts. No one is named in public.'),
      tile('questions','💬','What staff asked','Patterns show where training or policy is unclear.')));
    if (window.SSISP) { const ic = SSISP.homeCard(); if (ic) v.append(ic); }
    if (window.SSSched && SSAccess.viewOn('schedule')) { const hc = SSSched.homeCard(); if (hc) v.append(hc); }
    const soon = D.WATCH.filter(w => w.date && w.applies.includes(setting()) && daysUntil(w.date) >= 0).slice(0,2);
    if (soon.length) v.append(h('div',{class:'card soft'},h('h3',null,'Coming up'), soon.map(w => h('p',null,h('b',null,w.title),' · in '+daysUntil(w.date)+' days')), h('a',{href:'#/watch'},'All rule changes')));
  }

  function homeRN(v){
    v.append(head('RN · delegations across your homes', 'Your delegation queue', 'Each delegation is one record that maps to the four N 6.03(3) duties.'));
    const exp = S.delegations.filter(d => d.status !== 'Active');
    v.append(h('div',{class:'grid g3'},
      h('div',{class:'card'},h('div',{class:'stat'},h('b',null,String(S.delegations.length)),h('span',null,'delegations on file'))),
      h('div',{class:'card'},h('div',{class:'stat warnc'},h('b',null,String(exp.length)),h('span',null,'expiring or expired'))),
      h('div',{class:'card'},h('div',{class:'stat'},h('b',null,String(new Set(S.delegations.map(d=>d.site)).size)),h('span',null,'homes you serve')))));
    v.append(tile('delegations','🩺','Open the ledger','Renew, check competency, or pause a delegation.'));
  }

  function homeFamily(v){
    v.append(head('Family caregiver · '+site().name, 'Today with Mom (sample)', 'Your tasks, who to call, and a hand-off packet for your helper.'));
    S.famTasks = S.famTasks || {};
    const tasks = ['Morning meds at 8 AM','Blood sugar check before lunch','Walk around the block if weather allows','Evening meds at 8 PM','Check smoke detector (monthly)'];
    const ul = h('ul',{class:'tourlist'});
    tasks.forEach((t,i) => {
      const id = 'ft'+i; const cb = h('input',{type:'checkbox',id,checked:!!S.famTasks[t]});
      const lb = h('label',{for:id,class:S.famTasks[t]?'done':''},t);
      cb.addEventListener('change',()=>{ S.famTasks[t]=cb.checked; save(); lb.className = cb.checked?'done':''; });
      ul.append(h('li',null,cb,lb));
    });
    v.append(h('div',{class:'card'},h('h2',null,'Today\'s tasks'),ul));
    v.append(h('div',{class:'grid g2'},
      tile('night','📞','Who do I call?','Sorts emergencies from nurse questions and things that can wait.'),
      tile('handoff','🧾','Hand-off packet','One page for a weekend or respite helper.'),
      tile('behavior','🤝','Behavior help','Calm ideas for a hard afternoon.'),
      tile('check','✅','Check something','Plain answers with the source.')));
  }

  function tourCard(){
    const items = [['check','Look up a procedure (try "pre-pour" or "shower")'],['whatif','Open the What-if library (try "missing")'],['procedures','Import a company procedure and see baseline flags'],['setup','Set up a home with its own documents'],['askpolicy','Ask our policy (try "visitors" at Maple Grove)'],['report','Turn a casual note into a report'],['night','Walk through a night question'],['behavior','Open a behavior guide'],['cards','Browse Clarity Cards and compare AFH vs CBRF'],['survey','Run the Survey-Ready Check'],['decide','Record a gray-area decision'],['ask','Draft a question for DQA'],['watch','See upcoming rule changes'],['owner','Open the owner view'],['sites','See the multi-site view'],['delegations','Look at the RN delegation ledger']];
    const done = items.filter(i => S.tour[i[0]]).length;
    return h('details',{class:'card soft noprint',open:done < items.length},
      h('summary',{style:'cursor:pointer;font:800 1.05rem var(--display)'},'Testing checklist for Angelika ('+done+' of '+items.length+' tried)'),
      h('p',{class:'small'},'Switch "View as" at the top to see each plan. Every feature is unlocked. Tap "Ideas and fixes" anywhere to chat about what to change, on the app or the public website.'),
      h('ul',{class:'tourlist'}, items.map(i => h('li',null, h('span',{'aria-hidden':'true'},S.tour[i[0]]?'✅':'○'), h('a',{href:'#/'+i[0],class:S.tour[i[0]]?'done':''},i[1])))),
      h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ if(confirm('Reset all sample data and the checklist on this device?')){ localStorage.removeItem(KEY); location.hash='#/home'; location.reload(); } }},'Reset sample data'));
  }

  // Procedure check
  R.check = v => {
    v.append(head('Procedure check', 'Ask it the way you\'d ask a coworker', 'Answers come from Wisconsin rules for this home ('+D.SETTINGS[setting()].name+'), next to its own policy.'));
    const inp = h('input',{type:'search',placeholder:'e.g. Can I pre-pour meds for the night shift?','aria-label':'Your question',value:param && !ruleById(param) ? param : ''});
    const form = h('form',{class:'search',role:'search'},inp);
    const out = h('div',{class:'grid'});
    const sugg = h('div',{class:'chips'}, ['pre-pour meds','shower refusal','resident fell','PRN','training hours','visitors','missed dose'].map(s => h('button',{class:'chip',type:'button',onclick:()=>{inp.value=s;run(true);}},s)));
    v.append(form, sugg, out);
    let logged = '';
    function run(log){
      out.textContent = '';
      const q = inp.value.trim(); if (!q) return;
      const hits = searchRules(q);
      if (!hits.length){
        out.append(h('div',{class:'card warn'},h('h3',null,'No clear answer on file yet'),h('p',null,'Your question was sent to your manager\'s question log so it gets answered and added for everyone.'),h('p',{class:'small'},'If someone could be hurt, use Night help or call 911.')));
        if (log && logged !== q){ S.questions.push({q, id:null, site:S.site, tier:S.tier, at:new Date().toISOString(), shift:shiftName()}); save(); logged = q; }
        return;
      }
      if (log && logged !== q){ S.questions.push({q, id:hits[0].id, site:S.site, tier:S.tier, at:new Date().toISOString(), shift:shiftName()}); save(); logged = q; }
      out.append(ruleCard(hits[0]));
      if (hits.length > 1) out.append(h('div',{class:'card'},h('h3',null,'Related'), h('div',{class:'list'}, hits.slice(1,4).map(r => h('button',{class:'item',type:'button',onclick:()=>{inp.value=r.q;run(true);}},h('div',{class:'meta'},labelChip(r.label),h('span',null,r.topic)),h('b',null,r.q))))));
    }
    form.addEventListener('submit', e => { e.preventDefault(); run(true); });
    let tmr; inp.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(()=>run(false), 250); });
    if (param && ruleById(param)){ inp.value = ruleById(param).q; out.append(ruleCard(ruleById(param))); }
    else if (inp.value) run(true);
    inp.focus();
  };
  function shiftName(){ const hr = new Date().getHours(); return hr < 6 || hr >= 22 ? 'Night' : hr < 14 ? 'Day' : 'Evening'; }

  // Clarity Cards
  R.cards = v => {
    v.append(head('Clarity Cards', 'One question, one plain answer, one source', 'Each card says how sure we are: Rule says, Best reading, or Open question.'));
    const topics = ['All', ...new Set(D.RULES.map(r => r.topic))];
    let pick = 'All', compare = false;
    const bar = h('div',{class:'chips'});
    const cmp = h('button',{class:'chip',type:'button','aria-pressed':'false'},'Compare AFH and CBRF');
    const list = h('div',{class:'grid'});
    function draw(){
      bar.textContent = '';
      topics.forEach(t => bar.append(h('button',{class:'chip',type:'button','aria-pressed':String(t===pick),onclick:()=>{pick=t;draw();}},t)));
      list.textContent = '';
      D.RULES.filter(r => pick === 'All' || r.topic === pick).forEach(r => {
        const d = h('details',{class:'card'});
        d.append(h('summary',{style:'cursor:pointer;list-style:none;display:grid;gap:.4rem'}, h('div',{class:'chips'},labelChip(r.label),h('span',{class:'chip grey'},r.topic),h('span',{class:'chip grey'},r.id)), h('b',{style:'font:700 1.05rem var(--display)'},r.q)));
        d.addEventListener('toggle', () => { if (d.open && !d.dataset.full){ d.dataset.full = 1; const c = ruleCard(r,{compare}); c.classList.remove('card'); c.style.marginTop = '.5rem'; d.append(c); } });
        list.append(d);
      });
    }
    cmp.addEventListener('click', () => { compare = !compare; cmp.setAttribute('aria-pressed', String(compare)); draw(); });
    v.append(h('div',{class:'row'},cmp, settingChip()), bar, list);
    draw();
  };

  // Write a report
  R.report = v => {
    if (param.startsWith('case:') && window.SSReports) return SSReports.caseView(v, param.slice(5));
    v.append(head('Report something', 'Say what happened, once.', 'Facts only, calm wording, no blame. We make it professional, then work out every report it needs, who gets each one and by when.'));
    if (window.SSReports) SSReports.openCases(v);
    const rs = residents();
    const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const f = {
      res: h('select',null, h('option',{value:''},'No resident involved'), rs.map(r => h('option',{value:r.code},r.code+' ('+r.nick+', sample)'))),
      when: h('input',{type:'datetime-local',value:now.toISOString().slice(0,16)}),
      where: h('select',null, ['Bedroom','Bathroom','Dining room','Living room','Hallway','Kitchen','Outside','Vehicle','Other'].map(o=>h('option',null,o))),
      who: h('input',{type:'text',placeholder:'Roles, not names: e.g. "me and one coworker"'}),
      raw: h('textarea',{placeholder:'e.g. Walt freaked out at supper and hit Sam cuz he wanted to go home again. I think he was tired.'}),
      did: h('textarea',{style:'min-height:4.5rem',placeholder:'e.g. gave him space, offered coffee, he calmed down in 10 min'}),
      told: h('input',{type:'text',placeholder:'e.g. texted manager 7:45 PM'})
    };
    if (param && param.startsWith('behavior:')) f.raw.value = '';
    const ex = h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ f.res.value = rs[1] ? rs[1].code : ''; f.where.value='Dining room'; f.who.value='me and one coworker'; f.raw.value=(rs[1]?rs[1].nick:'He')+' freaked out at supper and hit Sam cuz he wanted to go home again. I think he was tired and lazy staff didnt help. He wouldnt take his meds after.'; f.did.value='gave him space, offered coffee, he calmed down in 10 min'; f.told.value='texted manager 7:45 PM'; }},'Fill in an example');
    const out = h('div',{class:'grid'});
    const form = h('form',{class:'card'},
      h('div',{class:'grid g2'}, h('label',{class:'f'},'Resident',f.res), h('label',{class:'f'},'When',f.when), h('label',{class:'f'},'Where',f.where), h('label',{class:'f'},'Who was there',f.who)),
      h('label',{class:'f'},'What happened, in your own words',f.raw),
      h('label',{class:'f'},'What you did',f.did),
      h('label',{class:'f'},'Who you told, and when',f.told),
      h('div',{class:'row'},h('button',{class:'btn',type:'submit'},'Make it professional'),ex));
    f.raw.addEventListener('input', () => { if (f.raw.value.trim()) pending = {area:'report', step:'Typed a note but did not make the report'}; });
    form.addEventListener('submit', e => {
      e.preventDefault(); out.textContent = ''; pending = null;
      if (!f.raw.value.trim()){ f.raw.focus(); return; }
      const r = rewrite({res:f.res.value, when:f.when.value, where:f.where.value, who:f.who.value, raw:f.raw.value, did:f.did.value, told:f.told.value});
      showRewrite(out, r, true);
      out.scrollIntoView({behavior:'smooth',block:'start'});
    });
    v.append(form, out);
  };

  function sentence(s){
    s = s.trim().replace(/\s+/g,' ');
    if (!s) return '';
    s = s.replace(/\bi\b/g,'I').replace(/(^|[.!?]\s+)([a-z])/g,(m,a,b)=>a+b.toUpperCase());
    if (!/[.!?]$/.test(s)) s += '.';
    return s;
  }
  function rewrite(x){
    const changes = []; const flags = [];
    let t = ' '+x.raw+' ';
    let did = x.did || ''; let who = x.who || '';
    // names of sample residents -> codes
    (D.RESIDENTS[S.site]||[]).forEach(r => {
      const re = new RegExp('\\b'+r.nick+'\\b','g');
      if (re.test(t)){ t = t.replace(re,'resident '+r.code); changes.push('Replaced the name "'+r.nick+'" with resident code '+r.code+'.'); }
    });
    t = t.replace(/\b(didnt|dont|wouldnt|cant|wasnt|isnt|wont)\b/gi, m => m.slice(0,-1)+'\''+m.slice(-1));
    D.WORDING.forEach(([re, rep]) => {
      const run = s => s.replace(re, m => { if (m.toLowerCase() !== rep.toLowerCase()) changes.push('"'+m+'" → "'+rep+'"'); return rep; });
      t = run(t); did = run(did);
    });
    // other capitalized words mid-sentence are possible names
    const known = new Set(['I','AM','PM','ER','RN','LPN','CNA','DQA','MCO','PRN','DNR','EMS','OK']);
    const names = new Set();
    t.replace(/([^\s])?(\s*)\b([A-Z][a-z]{2,})\b/g, (m, prev, sp, w, off) => {
      const before = t.slice(0, off + (prev ? 1 : 0)).trimEnd();
      if (before && !/[.!?]$/.test(before) && !known.has(w) && !/^(Resident|Staff|Manager|Nurse|Mom|Dad)$/.test(w)) names.add(w);
      return m; });
    names.forEach(n => { const re = new RegExp('\\b'+n+'\\b','g'); t = t.replace(re,'[name removed: use a role]'); changes.push('Removed the name "'+n+'". Use a role, like coworker or visitor.'); });
    let report = false;
    D.FLAGS.forEach(fl => { const m = t.match(fl.re); if (m){ [...new Set(m.map(s=>s.toLowerCase()))].forEach(w => flags.push({w, why:fl.why})); if (fl.report) report = true; } });
    const facts = sentence(t);
    const routes = D.ROUTES.filter(r => r.re.test(x.raw+' '+facts));
    const st = setting();
    const missing = [];
    if (!x.told) missing.push('Who you told and when');
    if (!x.did) missing.push('What you did');
    if (!/["“]/.test(x.raw) && /\b(said|says|told|yelled|asked)\b/i.test(x.raw)) missing.push('Exact words in quotes, if someone said something');
    const lines = [
      'INCIDENT REPORT (TEST DATA)',
      'Home: '+site().name+' (sample, '+D.SETTINGS[st].short+')',
      'Date and time: '+(x.when ? fmtTime(x.when) : 'not given'),
      'Location: '+x.where,
      'Resident: '+(x.res || 'none'),
      'People present: '+(who ? sentence(who).replace(/\.$/,'') : 'not given'),
      routes.length ? 'Type: '+routes.map(r=>r.type).join(', ') : null,
      '',
      'What happened (observed facts):',
      facts,
      '',
      'Actions taken by staff:',
      did ? sentence(did) : '(add what you did)',
      '',
      'Notified:',
      x.told ? sentence(x.told) : '(add who you told and when)',
      '',
      'Written by: '+tier().name+' on shift, '+fmtTime(new Date())
    ].filter(l => l !== null);
    return {text:lines.join('\n'), changes:[...new Set(changes)], flags, report, routes, missing, x, facts};
  }

  function showRewrite(out, r, canSend){
    if (r.report) out.append(h('div',{class:'card alert',role:'alert'},
      h('h2',null,'This may be a mandatory report'),
      h('ol',{class:'steps'}, ['Make sure every resident is safe right now.','Tell the person your home designates to report (usually the administrator) today.',setting()==='afh' ? 'Write facts only. An adult family home reports to DQA right away (DHS 88.11(1)), and to police if it may be a crime.' : 'Write facts only. The home reports to DQA within 7 calendar days (DHS 13.05).','You can also report directly to DQA or the county adult-at-risk line. Good-faith reporters are protected from retaliation.'].map(s=>h('li',null,h('span',null,s))))));
    const pre = h('div',{class:'out'});
    // highlight flagged words
    const parts = r.text.split(new RegExp('('+r.flags.map(f=>f.w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','gi'));
    if (r.flags.length) parts.forEach((p,i) => pre.append(i % 2 ? h('mark',{class:'flag'},p) : p)); else pre.textContent = r.text;
    const ed = h('textarea',{style:'min-height:18rem;font-size:.95rem',hidden:true,'aria-label':'Edit the report'}); ed.value = r.text;
    const card = h('div',{class:'card'}, h('h2',null,'Professional version'), h('p',{class:'small muted'},'Templated rewrite for testing. Read it, fix anything that is not exactly what happened.'), pre, ed);
    const row = h('div',{class:'row noprint'});
    let editLogged = false;
    const finalText = () => {
      const t = ed.value;
      if (!editLogged && t.trim() !== r.text.trim()){ const d = editSummary(r.text, t); if (d.n) { signal({type:'edit', area:'report', ref:(r.routes.map(x=>x.type).join(', ')||'General'), label:'Report rewrite ('+(r.routes.map(x=>x.type).join(', ')||'general')+')', added:d.added, removed:d.removed}); editLogged = true; } }
      return t;
    };
    const eb = h('button',{class:'btn ghost sm',type:'button'},'Edit');
    eb.addEventListener('click',()=>{ ed.hidden = !ed.hidden; pre.hidden = !ed.hidden; eb.textContent = ed.hidden ? 'Edit' : 'Done editing'; if (ed.hidden){ pre.textContent = ed.value; } else ed.focus(); });
    const cb = h('button',{class:'btn ghost sm',type:'button'},'Copy');
    cb.addEventListener('click',()=>copy(finalText(), cb));
    row.append(eb);
    row.append(cb, h('button',{class:'btn ghost sm',type:'button',onclick:()=>window.print()},'Print'));
    if (canSend){
      const sb = h('button',{class:'btn sm',type:'button'},'Send to my manager');
      sb.addEventListener('click',()=>{
        S.reports.push({id:uid(), site:S.site, at:new Date().toISOString(), type:r.routes.map(x=>x.type).join(', ')||'General', status:'Waiting for manager', resident:r.x.res, raw:r.x.raw, clean:finalText(), by:tier().name+' (you)'}); save();
        sb.disabled = true; sb.textContent = 'Sent'; toast('Sent privately to the manager\'s review list.');
      });
      row.append(sb);
    }
    card.append(row, rateBar('report', 'rw-'+uid(), 'Report rewrite ('+(r.routes.map(x=>x.type).join(', ')||'general')+')')); out.append(card);
    if (r.flags.length || r.missing.length) out.append(h('div',{class:'card warn'}, h('h3',null,'Check before sending'),
      h('ul',null, r.flags.map(f => h('li',null,h('b',null,'"'+f.w+'": '),f.why)), r.missing.map(m => h('li',null,h('b',null,'Missing: '),m)))));
    if (r.changes.length) out.append(h('details',{class:'card'}, h('summary',{style:'cursor:pointer;font-weight:700'},'What we changed ('+r.changes.length+')'), h('ul',null,r.changes.map(c=>h('li',null,c)))));
    if (window.SSReports && canSend) return SSReports.panel(out, r);
    const st = setting();
    out.append(h('div',{class:'card soft'}, h('h3',null,'Who needs to know, and by when'),
      r.routes.length ? h('div',{class:'list'}, r.routes.map(rt => h('div',{class:'item'}, h('b',null,rt.type), h('span',{class:'small'},'Tell: '+rt.to.join(', ')), (st==='cbrf' && rt.cbrf) || (st==='afh' && rt.afh) ? h('span',{class:'small'},'State deadline: '+(st==='cbrf'?rt.cbrf:rt.afh)) : st==='afh' && rt.cbrf ? h('span',{class:'small muted'},'AFH deadline: check DQA P-02007 (being verified)') : null)))
      : h('p',{class:'small'},'No reportable event detected. Your manager still sees it in their review list.')));
  }

  // Reports to review (manager)
  R.inbox = v => {
    v.append(head('House manager', 'Reports to review', 'Staff send reports here privately. You approve, ask for more facts, or file. Nothing is posted to the team.'));
    const rs = forSite(S.reports).slice().reverse();
    if (!rs.length){ v.append(h('p',{class:'muted'},'No reports for this home yet. Try Write a report.')); return; }
    rs.forEach(r => {
      if (!r.clean) r.clean = rewrite({res:r.resident, when:r.at, where:'Dining room', who:'', raw:r.raw, did:'', told:''}).text;
      const st = h('span',{class:'chip '+(r.status==='Filed'?'calm':r.status==='Needs more facts'?'amber':'')},r.status);
      const c = h('div',{class:'card'}, h('div',{class:'meta row small muted'}, st, h('span',null,r.type), h('span',null,fmtTime(r.at)), h('span',null,'from '+r.by)),
        h('details',null,h('summary',{style:'cursor:pointer'},'What the caregiver typed'),h('p',{class:'out',style:'margin-top:.5rem'},r.raw)),
        h('div',{class:'out'},r.clean),
        r.mgrNote ? h('p',{class:'small'},h('b',null,'Your note: '),r.mgrNote) : null);
      const row = h('div',{class:'row'});
      const set = (s, note) => { r.status = s; if (note != null) r.mgrNote = note; save(); route(); };
      row.append(h('button',{class:'btn sm',type:'button',onclick:()=>set('Filed')},'Approve and file'));
      row.append(h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ const n = prompt('What facts are missing? (Goes privately to the writer)','Please add the exact words used and who was notified.'); if(n) set('Needs more facts', n); }},'Ask for more facts'));
      c.append(row); v.append(c);
    });
    save();
  };

  // Question log (manager / owner)
  R.questions = v => {
    const all = S.tier === 'owner' || S.tier === 'multi';
    const qs = all ? S.questions : forSite(S.questions);
    v.append(head(all ? 'Owner report' : 'House manager', 'What staff asked', 'Counts and topics only. No names, so asking is never risky.'));
    const by = {};
    qs.forEach(q => { const k = q.id || 'unanswered'; by[k] = by[k] || {n:0, q:q.q, id:q.id, shifts:{}}; by[k].n++; by[k].shifts[q.shift] = (by[k].shifts[q.shift]||0)+1; });
    const rows = Object.values(by).sort((a,b) => b.n - a.n);
    const max = Math.max(1, ...rows.map(r => r.n));
    v.append(h('div',{class:'card'}, h('h2',null,'Top questions'),
      rows.length ? h('div',{class:'list'}, rows.slice(0,8).map(r => h('div',{class:'item'},
        h('div',{class:'meta'}, r.id ? labelChip(ruleById(r.id).label) : h('span',{class:'chip amber'},'No answer on file'), h('span',null,r.n+' time'+(r.n>1?'s':'')), h('span',null,Object.entries(r.shifts).map(([s,n])=>s+' '+n).join(' · '))),
        h('b',null, r.id ? ruleById(r.id).q : r.q),
        h('div',{class:'bar'},h('i',{style:'width:'+Math.round(r.n/max*100)+'%'})),
        r.id ? h('a',{class:'small',href:'#/check/'+r.id},'See the answer staff got') : h('span',{class:'small muted'},'Add your home\'s answer, or use Ask the Regulator.')))) : h('p',{class:'muted'},'No questions yet.')));
    const conf = all ? S.confusions : forSite(S.confusions);
    v.append(h('div',{class:'card'}, h('h2',null,'"This rule confused me"'), h('p',{class:'small muted'},'Anonymous reports from the Clarity Cards. A sign of where policy and practice drift apart.'),
      conf.length ? h('div',{class:'list'}, conf.slice().reverse().map(c => h('div',{class:'item'}, h('div',{class:'meta'},h('span',{class:'chip grey'},c.rule),h('span',null,'heard different from: '+c.from),h('span',null,fmtDate(c.at))), h('span',null,c.text||'(no details)')))) : h('p',{class:'muted'},'None yet.')));
    const lines = ['Question report for '+(all?'all homes':site().name)+' (test data, '+fmtDate(new Date())+')',''];
    rows.slice(0,5).forEach((r,i) => lines.push((i+1)+'. '+(r.id?ruleById(r.id).q:r.q)+' ('+r.n+')'));
    lines.push('','Suggested training: the top topic above at the next staff meeting.');
    const cb = h('button',{class:'btn ghost sm',type:'button'},'Copy report for the owner');
    cb.addEventListener('click',()=>copy(lines.join('\n'), cb));
    v.append(h('div',{class:'row'},cb));
  };

  // Night help
  function levelBadge(l){ return h('span',{class:'level '+l},{now:'Call 911 now',wake:'Call the manager',nurse:'Call the on-call nurse',morning:'Can wait for morning'}[l]); }
  R.night = v => {
    const fam = S.tier === 'family';
    v.append(head(fam ? 'Who do I call?' : 'Night help', fam ? 'Not sure who to call?' : 'Not sure if this should wake the manager?', 'Answer one question, then pick what\'s going on.'));
    const area = h('div',{class:'grid'});
    v.append(h('div',{class:'card'}, h('h2',null,'Is anyone in danger right now?'),
      h('div',{class:'row'}, h('button',{class:'btn red',type:'button',onclick:danger},'Yes, someone may be in danger'), h('button',{class:'btn ghost',type:'button',onclick:pick},'No, but I need help deciding'))), area);
    function danger(){
      area.textContent = '';
      area.append(h('div',{class:'card alert',role:'alert'}, h('h2',null,'Call 911 now'), h('ol',{class:'steps'}, ['Call 911 and follow the dispatcher.','Check the code status (DNR) sheet.','Keep others safe.', fam ? 'Call the nurse or family after.' : 'Call the manager after 911.'].map(s=>h('li',null,h('span',null,s)))), h('a',{class:'btn red',href:'tel:911'},'Call 911')));
    }
    function pick(){
      area.textContent = '';
      area.append(h('div',{class:'list'}, D.TRIAGE.filter(t => !fam || !['callin','staff'].includes(t.id)).map(t => h('button',{class:'item',type:'button',onclick:()=>show(t)}, h('div',{class:'meta'},levelBadge(t.level)), h('b',null,t.name)))));
    }
    function show(t){
      area.textContent = ''; pending = {area:'night', ref:t.id, step:'Opened "'+t.name+'" but did not log it'};
      let level = t.level;
      if (level === 'morning' && ((t.id==='fall-ok' && S.oncall.fallok))) level = 'wake';
      const note = h('textarea',{style:'min-height:4.5rem',placeholder:'Short note: time, resident code, what you saw, what you did.'});
      const card = h('div',{class:'card'+(level==='now'?' alert':'')}, h('div',{class:'row'},levelBadge(level)), h('h2',null,t.name),
        h('ol',{class:'steps'}, t.steps.map(s=>h('li',null,h('span',null,s)))),
        h('p',null,h('b',null,'Who: '),t.who), t.clock ? h('p',{class:'small'},h('b',null,'Deadline: '),t.clock) : null,
        t.id==='behav' ? h('a',{href:'#/behavior'},'Open Behavior help') : null,
        t.id==='callin' && window.SSSched && SSAccess.viewOn('schedule') ? h('p',null,h('a',{href:'#/schedule/cover'},'Open the shift and see who can cover'),h('span',{class:'small muted'},' (lists staff with no overtime or rest problems first)')) : null,
        h('label',{class:'f'},'Log it',note));
      const lb = h('button',{class:'btn',type:'button'}, level==='morning' ? 'Log it for the morning' : 'Log it');
      lb.addEventListener('click',()=>{ S.triage.push({id:t.id, site:S.site, at:new Date().toISOString(), note:note.value.trim()||'(no note)', woke:level==='now'||level==='wake'}); save();
        pending = null; card.append(h('div',{class:'card calm'}, h('b',null, level==='morning' ? 'Logged. Your manager sees it first thing in the morning.' : 'Logged.'), h('span',{class:'small'},'Thanks for handling it calmly.')), rateBar('night', t.id, t.name)); lb.disabled = true; });
      card.append(h('div',{class:'row'},lb,h('button',{class:'btn quiet',type:'button',onclick:pick},'Something else')));
      area.append(card);
    }
    if (S.tier === 'manager' || S.tier === 'owner'){
      const opt = (k, label) => { const cb = h('input',{type:'checkbox',checked:!!S.oncall[k]}); cb.addEventListener('change',()=>{S.oncall[k]=cb.checked;save();}); return h('label',{class:'row small'},cb,label); };
      v.append(h('div',{class:'card soft'}, h('h3',null,'Your on-call rules'), h('p',{class:'small'},'Emergencies and missing residents always call. Choose what else wakes you.'),
        opt('fallok','Wake me for falls even without injury'), opt('callin','Wake me if a shift is uncovered by 5 AM'),
        window.SSSched && SSAccess.viewOn('schedule') ? h('p',{class:'small'},'On call tonight: ',h('b',null,SSSched.onCallTonight()),'. ',h('a',{href:'#/schedule'},'Change it in the schedule')) : null));
    }
  };

  // Behavior help
  R.behavior = v => {
    v.append(head('Behavior help', 'What\'s happening?', 'Ideas that respect the person\'s choices and dignity. Safety first, then calm.'));
    const area = h('div');
    const list = h('div',{class:'grid g2'}, D.BEHAVIORS.map(b => h('button',{class:'tile',type:'button',style:'text-align:left;cursor:pointer;font:inherit',onclick:()=>show(b)},h('b',null,b.name))));
    v.append(list, area);
    function show(b){
      area.textContent = '';
      const c = h('div',{class:'card'}, h('h2',null,b.name), h('div',{class:'card soft'},h('b',null,'First: '),b.first),
        h('h3',null,'Try'), h('ol',{class:'steps'}, b.try.map(s=>h('li',null,h('span',null,s)))),
        h('h3',null,'Avoid'), h('ul',null, b.avoid.map(s=>h('li',null,s))),
        h('p',null,h('b',null,'Write down: '),b.doc), h('p',null,h('b',null,'Get help when: '),b.escalate),
        h('div',{class:'row'}, h('a',{class:'btn ghost sm',href:'#/report'},'Write it up'), b.id==='refuse' ? h('a',{class:'btn ghost sm',href:'#/decide/C05'},'Decide and Document') : null),
        rateBar('behavior', b.id, b.name),
        h('p',{class:'foot'},'Guidance only. The resident\'s plan and your nurse come first.'));
      area.append(c); c.scrollIntoView({behavior:'smooth',block:'start'});
    }
  };

  // Survey-Ready Check
  R.survey = v => {
    const st = setting();
    const qs = D.SURVEY[st];
    v.append(head('Survey-Ready Check · '+site().name, 'Are you ready if the surveyor came tomorrow?', 'Built on DQA\'s most-cited rules for '+D.SETTINGS[st].short+'s in 2025. Answer honestly. Only you see this.'));
    S.survey[S.site] = S.survey[S.site] || {};
    const A = S.survey[S.site];
    const score = h('div',{class:'card soft'});
    const list = h('div',{class:'list'});
    const opts = [['yes','Yes',2],['partly','Partly',1],['no','No',0],['unsure','Not sure',0]];
    function draw(){
      list.textContent = '';
      qs.forEach((q,i) => {
        const row = h('div',{class:'chips'}, opts.map(o => h('button',{class:'chip',type:'button','aria-pressed':String(A[i]===o[0]),onclick:()=>{A[i]=o[0];save();draw();}},o[1])));
        list.append(h('div',{class:'item'}, h('div',{class:'meta'},h('span',null,q.cite), q.top ? h('span',{class:'chip amber'},q.top) : null), h('b',null,(i+1)+'. '+q.q), row));
      });
      const answered = Object.keys(A).length;
      pending = answered > 0 && answered < qs.length ? {area:'survey', step:'Survey-Ready Check stopped at '+answered+' of '+qs.length} : null;
      const pts = qs.reduce((s,q,i) => s + (opts.find(o=>o[0]===A[i])||[0,0,0])[2], 0);
      const pct = Math.round(pts / (qs.length*2) * 100);
      const fixes = qs.map((q,i)=>({q,i})).filter(x => A[x.i] && A[x.i] !== 'yes');
      score.textContent = '';
      score.append(h('div',{class:'grid g2'}, h('div',{class:'stat '+(pct>=80?'good':pct>=50?'':'warnc')},h('b',null,answered?pct+'%':'–'),h('span',null,'ready ('+answered+' of '+qs.length+' answered)')),
        h('div',{class:'bar '+(pct>=80?'calm':'amber'),style:'align-self:center'},h('i',{style:'width:'+pct+'%'}))));
      if (fixes.length){
        const txt = 'Survey-Ready fix list, '+site().name+' (test data)\n'+fixes.map((x,n)=>(n+1)+'. '+x.q.fix+' ('+x.q.cite+')').join('\n');
        const cb = h('button',{class:'btn ghost sm',type:'button'},'Copy fix list'); cb.addEventListener('click',()=>copy(txt,cb));
        score.append(h('h3',null,'Your fix list'), h('ol',null, fixes.map(x => h('li',null,x.q.fix,h('span',{class:'small muted'},' ('+x.q.cite+')')))), cb);
      }
    }
    v.append(score, list); draw();
  };

  // Decide and Document
  R.decide = v => {
    v.append(head('Decide and Document', 'When the rule is unclear, your paper trail shouldn\'t be', 'Pick the gray area, see both sides, record what you chose and why.'));
    const area = h('div',{class:'grid'});
    const g0 = D.GRAY.find(g => g.id === param);
    v.append(h('div',{class:'chips'}, D.GRAY.map(g => h('button',{class:'chip',type:'button','aria-pressed':String(g0&&g0.id===g.id),onclick:()=>go('decide/'+g.id)},g.title))), area);
    if (g0){
      const r = ruleById(g0.id);
      const choice = h('div',{class:'list'});
      let picked = '';
      g0.options.concat(['Something else (write it in "why")']).forEach((o,i) => {
        const id = 'opt'+i; const rb = h('input',{type:'radio',name:'opt',id,value:o}); rb.addEventListener('change',()=>picked=o);
        choice.append(h('label',{class:'item',for:id,style:'grid-template-columns:auto 1fr;align-items:center;cursor:pointer'},rb,h('span',null,o)));
      });
      const why = h('textarea',{placeholder:'Why this option fits this resident or situation. No names.'});
      const appr = h('select',null,['House manager','Owner','RN','Owner and RN'].map(o=>h('option',null,o)));
      const rev = h('input',{type:'text',value:new Date(Date.now()+90*86400000).toISOString().slice(0,10),'aria-label':'Review date'});
      const form = h('form',{class:'card'}, h('h2',null,g0.title), r ? h('p',{class:'small muted'},r.q) : null,
        h('div',{class:'card soft'},h('b',null,'Rules on each side'),h('p',null,g0.sides)),
        h('h3',null,'What did you decide?'), choice, h('label',{class:'f'},'Why',why),
        h('div',{class:'grid g2'}, h('label',{class:'f'},'Approved by',appr), h('label',{class:'f'},'Review again on',rev)),
        h('div',{class:'row'},h('button',{class:'btn',type:'submit'},'Save the decision'), r ? h('a',{class:'btn quiet',href:'#/ask/'+g0.id},'Ask the Regulator instead') : null));
      form.addEventListener('submit', e => { e.preventDefault(); if (!picked){ toast('Pick an option first'); return; }
        S.decisions.push({id:uid(), site:S.site, gray:g0.id, choice:picked, why:why.value.trim(), approver:appr.value, review:rev.value, at:new Date().toISOString()}); save(); toast('Saved with today\'s date'); go('decide'); });
      area.append(form);
    }
    const ds = forSite(S.decisions).slice().reverse();
    area.append(h('div',{class:'card'}, h('h2',null,'Decisions on file'),
      ds.length ? h('div',{class:'list'}, ds.map(d => { const g = D.GRAY.find(x=>x.id===d.gray)||{title:d.gray};
        return h('div',{class:'item'}, h('div',{class:'meta'},h('span',null,fmtDate(d.at)),h('span',null,'approved by '+d.approver), d.review ? h('span',null,'review '+fmtDate(d.review)) : null), h('b',null,g.title), h('span',null,'Chose: '+d.choice), d.why ? h('span',{class:'small'},d.why) : null); }))
      : h('p',{class:'muted'},'None yet.'),
      h('button',{class:'btn ghost sm noprint',type:'button',onclick:()=>window.print()},'Print for the survey binder')));
  };

  // Ask the Regulator
  R.ask = v => {
    v.append(head('Ask the Regulator', 'Stop guessing. Ask once, and everyone learns.', 'A neutral question with the citations filled in. You send it yourself; we track the answer.'));
    const t0 = D.ASK_TOPICS.find(a => a.id === param);
    v.append(h('div',{class:'chips'}, D.ASK_TOPICS.map(a => h('button',{class:'chip',type:'button','aria-pressed':String(t0&&t0.id===a.id),onclick:()=>go('ask/'+a.id)},a.subject))));
    if (t0){
      const st = D.SETTINGS[setting()].name.toLowerCase();
      const body = 'To: '+t0.to+'\nSubject: Question about '+t0.subject.toLowerCase()+'\n\nHello,\n\nI manage a '+st+' in Wisconsin and want to make sure we follow the rules correctly.\n\n'+t0.body+'\n\nA short answer or a pointer to written guidance would help us train staff consistently. Thank you for your time.\n\nKind regards,\n[Your name]\n[Home name and license number]';
      const ta = h('textarea',{style:'min-height:16rem'}); ta.value = body;
      const cb = h('button',{class:'btn ghost sm',type:'button'},'Copy');
      cb.addEventListener('click',()=>copy(ta.value, cb));
      const tb = h('button',{class:'btn sm',type:'button'},'Track this question');
      tb.addEventListener('click',()=>{ S.asks.push({id:uid(), topic:t0.id, to:t0.to, status:'Draft', at:new Date().toISOString(), answer:''}); save(); toast('Added to your tracked questions'); go('ask'); });
      v.append(h('div',{class:'card'}, h('h2',null,t0.subject), h('p',{class:'small muted'},'Edit anything. Nothing is sent from the app.'), ta, h('div',{class:'row'},cb,tb)));
    }
    const list = h('div',{class:'list'});
    S.asks.slice().reverse().forEach(a => {
      const t = D.ASK_TOPICS.find(x => x.id === a.topic) || {subject:a.topic};
      const sel = h('select',{'aria-label':'Status',style:'max-width:180px'}, ['Draft','Sent','Answered'].map(s => h('option',{selected:s===a.status},s)));
      sel.addEventListener('change',()=>{ a.status = sel.value; if (a.status==='Answered' && !a.answer){ a.answer = prompt('Paste or summarize the answer (no names):','')||''; } save(); route(); });
      list.append(h('div',{class:'item'}, h('div',{class:'meta'},h('span',null,'to '+a.to),h('span',null,fmtDate(a.at))), h('b',null,t.subject), sel, a.answer ? h('p',{class:'small'},h('b',null,'Answer: '),a.answer) : null));
    });
    v.append(h('div',{class:'card'}, h('h2',null,'Tracked questions'), S.asks.length ? list : h('p',{class:'muted'},'None yet.')));
  };

  // Regulatory Watch
  R.watch = v => {
    v.append(head('Regulatory Watch', 'What\'s changing, and does it apply to me?', 'Sorted by the next date that matters. Each status is rechecked monthly.'));
    let mineOnly = true;
    const tg = h('button',{class:'chip',type:'button','aria-pressed':'true'},'Only what applies to '+D.SETTINGS[setting()].short+'s');
    const list = h('div',{class:'list'});
    function draw(){
      list.textContent = '';
      D.WATCH.filter(w => !mineOnly || w.applies.includes(setting())).sort((a,b) => (a.date||'9999').localeCompare(b.date||'9999')).forEach(w => {
        S.watch[w.id] = S.watch[w.id] || {};
        const dd = w.date ? daysUntil(w.date) : null;
        const todo = h('ul',{class:'tourlist'}, w.todo.map((t,i) => { const id = w.id+'t'+i; const cb = h('input',{type:'checkbox',id,checked:!!S.watch[w.id][i]}); const lb = h('label',{for:id,class:S.watch[w.id][i]?'done':''},t); cb.addEventListener('change',()=>{S.watch[w.id][i]=cb.checked;save();lb.className=cb.checked?'done':'';}); return h('li',null,cb,lb); }));
        list.append(h('div',{class:'card'},
          h('div',{class:'chips'}, h('span',{class:'chip grey'},w.layer), dd!=null ? h('span',{class:'chip '+(dd<45?'amber':'')}, dd>=0 ? 'in '+dd+' days' : 'date passed') : h('span',{class:'chip grey'},'no date'), h('span',{class:'chip '+(w.check==='Verified'?'calm':'grey')},w.check)),
          h('h3',null,w.title), h('p',{class:'small muted'},w.status), h('p',null,w.what), w.todo.length ? h('div',null,h('b',{class:'small'},'Get ready'),todo) : null,
          (window.SSOutlook ? SSOutlook.byWatch(w.id) : []).map(o => h('p',{class:'small'}, h('a',{href:'#/outlook/'+o.id},'Money impact in Owner Outlook: '+o.title)))));
      });
    }
    tg.addEventListener('click',()=>{ mineOnly = !mineOnly; tg.setAttribute('aria-pressed',String(mineOnly)); draw(); });
    v.append(h('div',{class:'row'},tg), list); draw();
  };

  // ---------- What's worked for others: the shared peer layer ----------
  // Kept apart from each home's private documents (S.orgProcs, S.policies, reports): it never reads them.
  // Something reaches it only when a person submits it here, after scrubbing, consent and a human review.
  const P = window.SS_PEER;
  const PEER_TABS = [['', 'Browse'], ['share', 'Share what worked'], ['incident', 'Share an incident pattern'], ['review', 'Review queue'], ['legal', 'Before real data']];
  function peerHead(v, sub){
    v.append(head('What\'s worked for others', 'How other homes handle the same rule conflicts', 'Peer practice from public sources and member homes. No home, staff or resident is ever named.'));
    v.append(h('div',{class:'card warn'}, h('b',null,'Peer practice, not legal advice.'), h('span',{class:'small'},' Each entry links to the rule it relates to. Check the rule and your own policy before changing what you do. Test version: anything you add stays in this browser.')));
    v.append(h('nav',{class:'chips','aria-label':'What\'s worked for others sections'}, PEER_TABS.map(([k,t]) => h('a',{class:'chip'+(k===sub?'':' grey'),style:'min-height:40px',href:'#/peer'+(k?'/'+k:''),'aria-current':k===sub?'page':null},t))));
  }
  const ruleLabel = id => { const r = ruleById(id); return r ? id+' · '+r.topic : id; };

  // Safe Harbor scrub: removes or generalizes identifiers and reports which of the 18 categories it touched.
  function deid(text){
    let t = String(text||''); const hits = {};
    const hit = (i, re, rep) => { t = t.replace(re, (...m) => { hits[i] = (hits[i]||0)+1; return typeof rep === 'function' ? rep(...m) : rep; }); };
    Object.values(D.RESIDENTS).flat().forEach(r => { hit(0, new RegExp('\\b'+r.nick+'\\b','g'), 'the resident'); hit(17, new RegExp('\\b'+r.code.replace('-','\\-')+'\\b','g'), 'the resident'); });
    hit(3, /\b\d{3}[-. )]\s?\d{3}[-.]\d{4}\b/g, '[removed]');
    hit(5, /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '[removed]');
    hit(6, /\b\d{3}-\d{2}-\d{4}\b/g, '[removed]');
    hit(7, /\b(mrn|medical record( number)?)\b[:#\s]*\w+/gi, '[removed]');
    hit(8, /\b(medicaid|member|ma|policy) (id|number|#)[:#\s]*\w+/gi, '[removed]');
    hit(13, /\bhttps?:\/\/\S+/gi, '[removed]');
    hit(14, /\b\d{1,3}(\.\d{1,3}){3}\b/g, '[removed]');
    hit(2, /\b\d{1,2}[\/-]\d{1,2}[\/-](\d{2,4})\b/g, (m, y) => y.length === 4 ? y : '[date]');
    hit(2, /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\.? \d{1,2}(st|nd|rd|th)?\b/gi, '[date]');
    hit(2, /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|yesterday|today|tonight|last night)\b/gi, 'on the shift');
    hit(2, /\b(?:at |around |about )?(1[0-2]|0?[1-9])(:[0-5]\d)?\s?(am|pm|a\.m\.|p\.m\.)(?![a-z])/gi, (m, hh, mm, ap) => { const pm = /p/i.test(ap); const hr = parseInt(hh,10)%12 + (pm?12:0); return hr < 7 ? 'overnight' : hr < 15 ? 'during the day shift' : hr < 23 ? 'during the evening shift' : 'overnight'; });
    hit(1, /\b\d{3,5} [A-Z][a-z]+ (st|street|ave|avenue|rd|road|ln|lane|dr|drive)\b/gi, '[place]');
    hit(1, /\b(in|at|near) [A-Z][a-z]+( County)?\b/g, (m, w) => w+' [place]');
    hit(1, /\b\d{5}(-\d{4})?\b/g, '[place]');
    hit(17, /\b(room|rm\.?|bed) ?#?\d+[a-z]?\b/gi, 'their room');
    hit(17, /\b(9\d|1[01]\d)[- ]?(years?[- ]old|yo|y\/o)\b/gi, 'over 89');
    hit(17, /\b(aged?|age of) (9\d|1[01]\d)\b/gi, 'over 89');
    hit(11, /\b(plate|license plate)\b[:#\s]*\w+/gi, '[removed]');
    // staff and other names: capitalized words that are not common words
    t = t.replace(/(^|[^.!?]\s)([A-Z][a-z]{2,})\b/g, (m, pre, w) => /^(I|The|This|That|They|She|He|Her|His|Their|We|Our|Staff|Resident|Nurse|Manager|Caregiver|RN|LPN|CNA|DQA|MCO|PRN|DNR|AFH|CBRF|DHS|EMS|ER|Wisconsin|After|Before|When|Then|Called|Checked|Gave|Offered)$/.test(w) ? m : (hits[0]=(hits[0]||0)+1, pre+'[name]'));
    return {text:t, hits};
  }

  function voteBtn(e){
    const mine = !!S.peer.votes[e.id];
    const n = e.votes + (mine ? 1 : 0);
    return h('button',{class:'btn quiet sm',type:'button','aria-pressed':String(mine),'aria-label':'Mark helpful, '+n+' so far',onclick:ev=>{ S.peer.votes[e.id] = !mine; save(); ev.currentTarget.replaceWith(voteBtn(e)); }}, (mine?'▲ ':'△ ')+n+' found this helpful');
  }

  function entryCard(e){
    const o = P.OUTCOMES[e.outcome] || P.OUTCOMES.untested;
    const r = ruleById(e.conflict);
    return h('div',{class:'card'},
      h('div',{class:'chips'}, h('span',{class:'chip '+o.cls},o.label), h('span',{class:'chip grey'},P.SOURCE_KIND[e.source]||'Member home'), h('span',{class:'chip '+(e.verified?'calm':'grey')},e.verified?'Source checked':'Unverified'),
        e.settingNote ? h('span',{class:'chip grey'},e.settingNote) : e.settings.map(s => h('span',{class:'chip grey'},D.SETTINGS[s].short)), h('span',{class:'chip grey'},e.state+(e.county&&e.county!=='Not given'&&e.county!=='Statewide'?' · '+e.county:''))),
      h('h3',null,e.title),
      e.situation ? h('p',null,h('b',null,'What happened: '),e.situation) : null,
      h('p',null,h('b',null,'What they do: '),e.practice),
      h('p',null,h('b',null,'How it played out: '),e.result),
      h('p',{class:'small muted'},'Rule: '+e.cite+(r?' · Conflict '+ruleLabel(e.conflict):'')+(e.ref && !e.ref.url ? ' · Source: '+e.ref.label : '')),
      h('div',{class:'row'}, voteBtn(e), r ? h('a',{class:'btn ghost sm',href:'#/cards'},'Clarity Cards') : null,
        e.ref && e.ref.url ? h('a',{class:'btn ghost sm',href:e.ref.url,target:'_blank',rel:'noopener'},'Source: '+e.ref.label) : null,
        e.also ? h('a',{class:'btn ghost sm',href:e.also.url,target:'_blank',rel:'noopener'},e.also.label) : null));
  }

  R.peer = v => {
    const sub = (param||'').split('/')[0];
    peerHead(v, sub);
    if (sub === 'share') return peerShare(v);
    if (sub === 'incident') return peerIncident(v);
    if (sub === 'review') return peerReview(v);
    if (sub === 'legal') return peerLegal(v);

    const all = P.ENTRIES.concat(S.peer.published.filter(x => x.kind === 'practice'));
    const topicOf = e => e.topic || (ruleById(e.conflict)||{}).topic || 'Other';
    let f = {conflict:'', topic:'', state:'', outcome:'', mine:true};
    const topics = [...new Set(all.map(topicOf))].sort();
    const cs = h('select',{'aria-label':'Topic'}, h('option',{value:''},'All topics'), topics.map(t => h('option',{value:t},t+' ('+all.filter(e=>topicOf(e)===t).length+')')));
    const states = [...new Set(all.map(e => e.state))].sort();
    const ss = h('select',{'aria-label':'State'}, h('option',{value:''},'All states'), states.map(t => h('option',{value:t},t==='Any'?'Not state-specific':t)));
    const os = h('select',{'aria-label':'Outcome'}, h('option',{value:''},'Any outcome'), Object.entries(P.OUTCOMES).map(([k,o]) => h('option',{value:k},o.label)));
    const tg = h('button',{class:'chip',type:'button','aria-pressed':'true'},'Only '+D.SETTINGS[setting()].short+' entries');
    const list = h('div',{class:'list'});
    function draw(){
      list.textContent = '';
      const rows = all.filter(e => (!f.conflict || e.conflict === f.conflict) && (!f.topic || topicOf(e) === f.topic) && (!f.state || e.state === f.state) && (!f.outcome || e.outcome === f.outcome) && (!f.mine || setting()==='home' || e.settings.includes(setting())))
        .sort((a,b) => (b.votes + (S.peer.votes[b.id]?1:0)) - (a.votes + (S.peer.votes[a.id]?1:0)));
      list.append(h('p',{class:'small muted'}, rows.length+' entries · most helpful first · checked '+fmtDate(P.CHECKED)));
      rows.forEach(e => list.append(entryCard(e)));
      if (!rows.length) list.append(h('p',{class:'muted'},'Nothing matches yet.'));
    }
    cs.addEventListener('change',()=>{f.topic = cs.value; f.conflict = ''; draw();});
    ss.addEventListener('change',()=>{f.state = ss.value; draw();});
    os.addEventListener('change',()=>{f.outcome = os.value; draw();});
    tg.addEventListener('click',()=>{ f.mine = !f.mine; tg.setAttribute('aria-pressed',String(f.mine)); draw(); });
    if (param && ruleById(param)) { f.conflict = param; }

    // de-identified incident patterns, shown only when enough homes contributed
    const pub = S.peer.published.filter(x => x.kind === 'incident');
    const pats = P.PATTERNS.map(p => Object.assign({}, p, {homes: p.homes + pub.filter(x => x.type === p.type).length}));
    const pv = h('div',{class:'card'}, h('h2',null,'How common situations played out'),
      h('p',{class:'small muted'},'De-identified scenarios pooled from member homes (sample numbers). A pattern shows only when at least '+P.MIN_HOMES+' different homes contributed, so no home can be singled out.'),
      h('div',{class:'list'}, pats.map(p => p.homes >= P.MIN_HOMES
        ? h('div',{class:'item'}, h('div',{class:'meta'},h('span',null,p.shift+' shift'),h('span',null,p.n+' reports from '+p.homes+' homes')), h('b',null,p.type), h('span',null,h('b',null,'Situation: '),p.situation), h('span',null,h('b',null,'Response: '),p.response), h('span',null,h('b',null,'Outcome: '),p.outcome))
        : h('div',{class:'item'}, h('b',null,p.type), h('span',{class:'small muted'},'Hidden until '+P.MIN_HOMES+' homes contribute (now fewer).')))));
    v.append(h('div',{class:'grid g2'}, h('label',{class:'f'},'Topic',cs), h('label',{class:'f'},'State',ss), h('label',{class:'f'},'Outcome',os)), h('div',{class:'row'},tg, h('a',{class:'btn sm',href:'#/peer/share'},'Share what worked for you')), list, pv);
    draw();
  };

  function consentBlock(){
    const a = h('input',{type:'checkbox',id:'pc1'}), b = h('input',{type:'checkbox',id:'pc2'});
    return {a, b, el:h('fieldset',{class:'card soft'}, h('legend',null,h('b',null,'Consent')),
      h('div',{class:'row'},a,h('label',{for:'pc1'},'Our home has opted in to sharing de-identified scenarios (subscription terms). In this test, no home has signed these terms yet.')),
      h('div',{class:'row'},b,h('label',{for:'pc2'},'A manager approves sharing this one. It goes to a human reviewer first and can be withdrawn.')))};
  }
  function scrubPreview(src, target){
    const box = h('div',{class:'out',role:'status'});
    function run(){ const r = deid(src.value); target.value = r.text; box.textContent = '';
      const ks = Object.keys(r.hits); box.append(ks.length ? 'Removed or generalized: '+ks.map(i => P.SAFE_HARBOR[i].split(' (')[0]+' ×'+r.hits[i]).join(', ') : 'No identifiers found. A reviewer still checks by hand.'); }
    return {box, run};
  }

  function peerShare(v){
    const conf = h('select',null, D.RULES.map(r => h('option',{value:r.id},r.id+': '+r.q)));
    const sit = h('textarea',{placeholder:'What was the situation? Example: night staff kept asking whether they could pour meds ahead of time.'});
    const prac = h('textarea',{placeholder:'What does your home do now?'});
    const res = h('textarea',{placeholder:'How did it play out? Did a surveyor see it?'});
    const oc = h('select',null, Object.entries(P.OUTCOMES).map(([k,o]) => h('option',{value:k},o.label)));
    const raw = h('div',{class:'small muted'},'Names, places, dates and numbers are removed automatically when you press Check. Please keep it general anyway.');
    const out = h('div');
    const c = consentBlock();
    const form = h('form',{class:'card'}, h('h2',null,'Share what worked'),
      h('label',{class:'f'},'Which rule conflict?',conf), h('label',{class:'f'},'Situation',sit), h('label',{class:'f'},'What you do',prac), h('label',{class:'f'},'How it played out',res), h('label',{class:'f'},'Outcome',oc), raw, c.el,
      h('div',{class:'row'},h('button',{class:'btn',type:'submit'},'Check and send for review')), out);
    form.addEventListener('submit', e => { e.preventDefault();
      if (!prac.value.trim()){ toast('Add what your home does'); return; }
      if (!c.a.checked || !c.b.checked){ toast('Both consent boxes are needed'); return; }
      const parts = [sit, prac, res].map(x => deid(x.value)); const hits = {}; parts.forEach(p => Object.keys(p.hits).forEach(k => hits[k] = (hits[k]||0)+p.hits[k]));
      S.peer.queue.push({id:'M'+uid(), kind:'practice', conflict:conf.value, settings:[setting()==='home'?'afh':setting()], state:'WI', county:'Not given', outcome:oc.value, source:'member', verified:false, votes:0,
        title:(ruleById(conf.value)||{q:'Shared practice'}).q, situation:parts[0].text, practice:parts[1].text, result:parts[2].text, cite:(ruleById(conf.value)||{}).topic||'', hits, at:new Date().toISOString(), status:'Waiting for review'});
      save(); out.textContent=''; out.append(h('p',{class:'small'},'Sent to the review queue. '+(Object.keys(hits).length?'The scrub removed '+Object.keys(hits).length+' kinds of identifiers. ':'')+'Nothing is published until a reviewer approves it.'));
      form.reset(); });
    v.append(form);
  }

  function peerIncident(v){
    const reps = forSite(S.reports);
    v.append(h('div',{class:'card soft'}, h('b',null,'How an incident becomes a shareable scenario'),
      h('ol',{class:'steps'}, ['Pick a report (sample data only in this test).','The app removes the 18 HIPAA Safe Harbor identifiers and generalizes dates, times and places.','You keep only the situation, the response and the outcome, in your own general words.','Consent: your home opted in, and a manager approves this one.','A trained reviewer checks it by hand.','It joins the pooled scenarios, shown only once '+P.MIN_HOMES+' or more homes contribute.'].map(s => h('li',null,s)))));
    const pick = h('select',{'aria-label':'Report'}, h('option',{value:''},'Type or paste a sample scenario instead'), reps.map(r => h('option',{value:r.id},fmtDate(r.at)+' · '+r.type)));
    const src = h('textarea',{placeholder:'Example: Walt fell at 2:40 am in room 3 on Nov 24, Sam helped him up and called the nurse.'});
    const type = h('select',null, P.PATTERNS.map(p => h('option',null,p.type)), h('option',null,'Other'));
    const shift = h('select',null, ['Night','Morning','Day','Evening'].map(s => h('option',null,s)));
    const sit = h('textarea'), resp = h('textarea',{placeholder:'What staff did, in order.'}), outc = h('textarea',{placeholder:'How it turned out. No health details beyond what the pattern needs.'});
    const sp = scrubPreview(src, sit);
    pick.addEventListener('change',()=>{ const r = reps.find(x => x.id === pick.value); src.value = r ? (r.clean || r.raw) : ''; sp.run(); });
    src.addEventListener('input', sp.run);
    const c = consentBlock();
    const out = h('div');
    const form = h('form',{class:'card'}, h('h2',null,'Share an incident pattern'),
      h('label',{class:'f'},'Start from',pick), h('label',{class:'f'},'Original (stays in your home, never shared)',src), sp.box,
      h('div',{class:'grid g2'}, h('label',{class:'f'},'Kind of situation',type), h('label',{class:'f'},'Shift',shift)),
      h('label',{class:'f'},'Situation (scrubbed, edit to keep it general)',sit), h('label',{class:'f'},'Response',resp), h('label',{class:'f'},'Outcome',outc), c.el,
      h('div',{class:'row'},h('button',{class:'btn',type:'submit'},'Send for review')), out);
    form.addEventListener('submit', e => { e.preventDefault();
      if (!sit.value.trim() || !resp.value.trim()){ toast('Add the situation and the response'); return; }
      if (!c.a.checked || !c.b.checked){ toast('Both consent boxes are needed'); return; }
      const parts = [sit, resp, outc].map(x => deid(x.value)); const hits = {}; parts.forEach(p => Object.keys(p.hits).forEach(k => hits[k] = (hits[k]||0)+p.hits[k]));
      S.peer.queue.push({id:'I'+uid(), kind:'incident', type:type.value, shift:shift.value, situation:parts[0].text, response:parts[1].text, outcome:parts[2].text, hits, at:new Date().toISOString(), status:'Waiting for review'});
      save(); out.textContent=''; out.append(h('p',{class:'small'},'Sent to the review queue. The original report did not leave your home\'s records.')); form.reset(); });
    v.append(form);
  }

  function peerReview(v){
    v.append(h('p',{class:'muted'},'In the real service, a trained Steady Shift reviewer does this, not the home. Here you can try it.'));
    const q = S.peer.queue.filter(x => x.status === 'Waiting for review');
    if (!q.length) v.append(h('div',{class:'card'},h('p',{class:'muted'},'Nothing waiting. Share a practice or an incident pattern to see it here.')));
    q.forEach(x => {
      const checks = P.SAFE_HARBOR.map((s,i) => { const id = x.id+'sh'+i; const cb = h('input',{type:'checkbox',id}); return {cb, el:h('li',{class:'row'},cb,h('label',{for:id},s+(x.hits&&x.hits[i]?' (scrub removed '+x.hits[i]+')':'')))}; });
      const all = h('button',{class:'btn quiet sm',type:'button',onclick:()=>checks.forEach(c => c.cb.checked = true)},'I checked all 18');
      const body = x.kind === 'incident' ? [h('p',null,h('b',null,x.type+' · '+x.shift+' shift')), h('p',null,h('b',null,'Situation: '),x.situation), h('p',null,h('b',null,'Response: '),x.response), x.outcome ? h('p',null,h('b',null,'Outcome: '),x.outcome) : null]
        : [h('p',null,h('b',null,x.title)), x.situation ? h('p',null,h('b',null,'Situation: '),x.situation) : null, h('p',null,h('b',null,'Practice: '),x.practice), x.result ? h('p',null,h('b',null,'How it played out: '),x.result) : null];
      const reason = h('input',{type:'text','aria-label':'Reason if sent back',placeholder:'Reason if you send it back'});
      v.append(h('div',{class:'card'}, h('div',{class:'chips'},h('span',{class:'chip'},x.kind==='incident'?'Incident pattern':'Practice'),h('span',{class:'chip grey'},fmtDate(x.at))), body,
        h('details',null,h('summary',null,'Safe Harbor checklist: no identifier remains'), h('ul',{class:'tourlist'},checks.map(c => c.el)), all),
        h('p',{class:'small muted'}, x.kind==='incident' ? 'Small-group rule: this pattern stays hidden until '+P.MIN_HOMES+' homes contribute.' : 'Practices show with "Member home" and the state only.'),
        h('div',{class:'row'},
          h('button',{class:'btn sm',type:'button',onclick:()=>{ if (!checks.every(c => c.cb.checked)){ toast('Tick all 18 checks first'); return; } x.status = 'Published'; S.peer.published.push(x); save(); toast('Published to the shared layer'); route(); }},'Approve and publish'),
          reason, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ x.status = 'Sent back'; x.reason = reason.value.trim(); save(); route(); }},'Send back'))));
    });
    const done = S.peer.queue.filter(x => x.status !== 'Waiting for review');
    if (done.length) v.append(h('div',{class:'card'},h('h2',null,'Decided'), h('div',{class:'list'}, done.slice().reverse().map(x => h('div',{class:'item'},h('div',{class:'meta'},h('span',null,x.status),h('span',null,fmtDate(x.at))), h('span',null,x.kind==='incident'?x.type:x.title), x.reason ? h('span',{class:'small'},'Reason: '+x.reason) : null)))));
  }

  function peerLegal(v){
    v.append(h('div',{class:'card'}, h('h2',null,'What must be in place before a real report is shared'),
      h('p',{class:'small muted'},'Until every item is done, this screen runs on fictional sample data only. Peer practices from public sources can be shown now. Incident scenarios from real homes cannot.'),
      h('div',{class:'list'}, P.GATES.map(g => h('div',{class:'item'}, h('div',{class:'meta'},h('span',{class:'chip red'},'Not in place')), h('b',null,g.t), h('span',{class:'small'},g.d))))));
    v.append(h('div',{class:'card'}, h('h2',null,'The 18 Safe Harbor identifiers'), h('p',{class:'small muted'},'45 CFR 164.514(b)(2). All must be gone, and the home must have no actual knowledge that what is left could identify someone.'), h('ol',null,P.SAFE_HARBOR.map(s => h('li',null,s)))));
    v.append(h('div',{class:'card'}, h('h2',null,'Kept separate from private documents'), h('p',null,'Each home\'s uploaded policies, procedures and reports live in that home\'s private space. The shared layer never reads them. Something reaches it only when a person in the home submits it on this screen, the scrub runs, consent is given, and a reviewer approves it.')));
  }

  // Team training (manager)
  R.team = v => {
    const st = setting();
    v.append(head('House manager · '+site().name, 'Team training and checks', st==='afh' ? 'AFH: 15 hours within 6 months, then 8 a year (DHS 88.04(5)). Background rechecks every 4 years.' : 'CBRF: 90-day topics, then 15 CE hours a year (DHS 83.20-83.25). Background rechecks every 4 years.'));
    const staff = (S.staff[S.site]||[]);
    const tb = h('table',{class:'t'}, h('thead',null,h('tr',null,['Staff (sample)','Hours this year','Background recheck due','Status'].map(x=>h('th',null,x)))));
    const body = h('tbody');
    staff.forEach(p => {
      const due = p.bg ? new Date(new Date(p.bg).getTime()+4*365*86400000) : null;
      const soon = due && (due - new Date()) < 120*86400000;
      const pct = p.need ? Math.min(100, Math.round(p.hours/p.need*100)) : 100;
      body.append(h('tr',null, h('td',null,p.n), h('td',null, h('div',{class:'bar '+(pct>=100?'calm':'amber')},h('i',{style:'width:'+pct+'%'})), h('span',{class:'small'},p.hours+' of '+p.need)), h('td',null, due ? h('span',{class:'chip '+(soon?'amber':'grey')},fmtDate(due)) : '–'), h('td',null,p.status)));
    });
    tb.append(body);
    v.append(h('div',{class:'card'}, h('div',{class:'tablewrap'},tb), h('p',{class:'small muted'},'Names are placeholders. Caregivers only see their own record.'),
      window.SSAccess && SSAccess.viewOn('schedule') ? h('p',{class:'small'},'Training blocks you put on the schedule add hours here when you mark them attended. ',h('a',{href:'#/schedule'},'Schedule training time')) : null));
  };

  // My training (caregiver)
  R.mytraining = v => {
    const me = (S.staff[S.site]||[])[1] || {hours:0,need:8};
    v.append(head('My training', 'Your hours and what you\'re cleared for', 'This is yours. Only you and your manager see it.'));
    const pct = me.need ? Math.min(100, Math.round(me.hours/me.need*100)) : 100;
    v.append(h('div',{class:'card'}, h('div',{class:'stat '+(pct>=100?'good':'')},h('b',null,me.hours+' of '+me.need),h('span',null,'training hours this year')), h('div',{class:'bar calm'},h('i',{style:'width:'+pct+'%'}))));
    const mine = S.delegations.filter(d => d.cg === 'Caregiver B' || (S.site==='family' && d.cg==='You'));
    v.append(h('div',{class:'card'}, h('h2',null,'Tasks an RN cleared you for'), mine.length ? h('div',{class:'list'}, mine.map(d=>h('div',{class:'item'},h('b',null,d.task+' · '+d.res),h('span',{class:'small'},'Checked '+fmtDate(d.checked)+' · review by '+fmtDate(d.review))))) : h('p',{class:'muted'},'None yet.'),
      h('p',{class:'small muted'},'A portable training record you keep between jobs is a planned add-on.')));
  };

  // Delegation ledger (RN)
  R.delegations = v => {
    v.append(head('RN delegation ledger', 'Who is cleared for what, and until when', 'Maps to N 6.03(3): match the task, direct, monitor, evaluate. N 6 sets no renewal interval; the app suggests 12 months.'));
    const tb = h('table',{class:'t'}, h('thead',null,h('tr',null,['Home','Task','Resident','Caregiver','Competency checked','Review by','Status',''].map(x=>h('th',null,x)))));
    const body = h('tbody');
    S.delegations.forEach(d => {
      const s = D.SITES.find(x=>x.id===d.site);
      const btn = h('button',{class:'btn ghost sm',type:'button',onclick:()=>checkoff(d)},d.status==='Active'?'Review':'Renew');
      body.append(h('tr',null, h('td',null,s?s.name:d.site), h('td',null,d.task), h('td',null,d.res), h('td',null,d.cg), h('td',null,fmtDate(d.checked)), h('td',null,fmtDate(d.review)), h('td',null,h('span',{class:'chip '+(d.status==='Active'?'calm':d.status==='Expiring'?'amber':'red')},d.status)), h('td',null,btn)));
    });
    tb.append(body);
    const area = h('div');
    v.append(h('div',{class:'card'},h('div',{class:'tablewrap'},tb)), area);
    function checkoff(d){
      area.textContent = '';
      const steps = ['Explains why the task is done and what to watch for','Washes hands and gathers supplies','Checks the order and the resident code','Does the task step by step while explaining','Records it correctly','Knows when to stop and call the RN'];
      const boxes = steps.map((s,i) => { const id='co'+i; return h('label',{class:'row',for:id},h('input',{type:'checkbox',id}),s); });
      const f = h('form',{class:'card soft'}, h('h2',null,'Competency check-off: '+d.task), h('p',{class:'small'},d.cg+' · resident '+d.res+' · return demonstration'), boxes,
        h('button',{class:'btn',type:'submit'},'Sign and renew for 12 months'));
      f.addEventListener('submit', e => { e.preventDefault(); if (boxes.some(b => !b.querySelector('input').checked)){ toast('Every step needs a check before signing'); return; }
        const t = new Date(); d.checked = t.toISOString().slice(0,10); t.setFullYear(t.getFullYear()+1); d.review = t.toISOString().slice(0,10); d.status = 'Active'; save(); toast('Signed. The caregiver sees the task as cleared.'); route(); });
      area.append(f); f.scrollIntoView({behavior:'smooth'});
    }
  };

  // ---------- Sync and calendar (sample data only; no resident names or codes leave the app) ----------
  const TZ = 'America/Chicago';
  const pad = n => String(n).padStart(2,'0');
  const isoDay = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  function addDays(s, n){ const d = new Date(s+'T12:00:00'); d.setDate(d.getDate()+n); return isoDay(d); }
  function nextWeekday(n){ const d = new Date(); d.setDate(d.getDate()+n); while (d.getDay()===0 || d.getDay()===6) d.setDate(d.getDate()+1); return isoDay(d); }
  function addMin(time, m){ const [hh,mm] = time.split(':').map(Number); const t = hh*60+mm+m; return pad(Math.floor(t/60)%24)+':'+pad(t%60); }
  function syncEvents(){
    const all = ['owner','multi'].includes(S.tier);
    const sites = all ? D.SITES.filter(s => s.id !== 'family') : [site()];
    const ids = sites.map(s => s.id);
    const nm = id => (D.SITES.find(s=>s.id===id)||{}).name || id;
    const today = isoDay(new Date());
    const ev = [];
    S.reports.filter(r => ids.includes(r.site) && r.status !== 'Filed').forEach(r => ev.push({id:'rep-'+r.id, kind:'Report follow-up', who:'House manager', site:r.site,
      title:'Review report: '+(r.type||'General')+' ('+nm(r.site)+')', date:nextWeekday(1), time:'09:00', dur:30,
      note:'A report is waiting for manager review in Steady Shift. Open the app to read it. Details stay in the app.', link:'#/inbox'}));
    S.delegations.filter(d => ids.includes(d.site) && (d.status !== 'Active' || daysUntil(d.review) < 75)).forEach((d,i) => {
      const late = d.review < today;
      ev.push({id:'del-'+d.site+'-'+i, kind:'RN delegation', who:'RN', site:d.site,
        title:(late?'Overdue: ':'')+'RN competency check, '+d.task+' ('+d.cg+', '+nm(d.site)+')', date:late ? nextWeekday(1) : d.review, time:'10:00', dur:30,
        note:'Return demonstration and sign-off in the delegation ledger. '+(late?'Review date has passed; the caregiver should not do this task until signed.':'Review is due.'), link:'#/delegations'});
    });
    sites.forEach(s => (S.staff[s.id]||[]).filter(p => p.need && p.hours < p.need).forEach((p,i) => ev.push({id:'trn-'+s.id+'-'+i, kind:'Training', who:'House manager', site:s.id,
      title:'Training catch-up: '+p.n+' needs '+(p.need-p.hours)+' more hours ('+s.name+')', date:nextWeekday(7), time:'13:00', dur:60,
      note:'Plan or schedule the training hours. Track them in Team training.', link:'#/team'})));
    const settings = [...new Set(sites.map(s => s.setting))];
    D.WATCH.filter(w => w.date && w.date >= today && w.applies.some(a => settings.includes(a))).forEach(w => ev.push({id:'w-'+w.id, kind:'Rule change', who:'Owner', site:'',
      title:w.title, date:w.date, time:w.id==='W1' ? '16:00' : null, dur:60, note:(w.status||'')+' '+(w.todo ? 'To do: '+w.todo.join('; ')+'.' : ''), link:'#/watch'}));
    if (S.oncall && S.oncall.callin) ev.push({id:'oncall', kind:'Staffing', who:'House manager', site:sites[0].id,
      title:'On-call coverage check for tonight ('+nm(sites[0].id)+')', date:today, time:'17:30', dur:15,
      note:'Confirm who answers call-ins tonight so the manager can sleep. Set in Night help.', link:'#/night'});
    (S.orders||[]).filter(o => ids.includes(o.site) && o.status === 'verified' && o.kind === 'appointment' && o.start && o.start >= today).forEach(o => ev.push({id:'ord-'+o.id, kind:'Appointment', who:'House manager', site:o.site,
      title:(SENSITIVE.includes(o.specialty)?'Resident':(SPECIALTIES[o.specialty]||'Resident'))+' appointment ('+nm(o.site)+')', date:o.start, time:null, dur:60, note:'From a nurse-checked order. Arrange a ride and send the visit form. Details are in Steady Shift.', link:'#/orders'}));
    (S.orders||[]).filter(o => ids.includes(o.site) && o.status === 'pending').slice(0,1).forEach(() => ev.push({id:'ord-pending', kind:'Order check', who:'RN', site:sites[0].id,
      title:'New doctor orders waiting for a nurse check', date:today, time:'16:00', dur:15, note:'Open Doctor orders in Steady Shift to check them.', link:'#/orders'}));
    if (window.SSPeopleDates) { try { ev.push(...window.SSPeopleDates(ids)); } catch(e){ console.error(e); } }
    (window.SSCalendarFeeds||[]).forEach(f => { try { ev.push(...f(ids)); } catch(e){ console.error(e); } });
    return ev.sort((a,b) => (a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
  }
  const appUrl = e => location.origin + location.pathname + e.link;
  const compact = (date, time) => date.replace(/-/g,'') + (time ? 'T'+time.replace(':','')+'00' : '');
  function gcalUrl(e){
    const dates = e.time ? compact(e.date,e.time)+'/'+compact(e.endDate||e.date,addMin(e.time,e.dur)) : compact(e.date)+'/'+compact(addDays(e.date,1));
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(e.title)+'&dates='+dates+'&ctz='+encodeURIComponent(TZ)+'&details='+encodeURIComponent(e.note+'\n\nOpen in Steady Shift: '+appUrl(e));
  }
  function outlookUrl(e){
    const p = new URLSearchParams({path:'/calendar/action/compose', rru:'addevent', subject:e.title, body:e.note+'\n\nOpen in Steady Shift: '+appUrl(e)});
    if (e.time){ p.set('startdt', e.date+'T'+e.time+':00'); p.set('enddt', (e.endDate||e.date)+'T'+addMin(e.time,e.dur)+':00'); }
    else { p.set('startdt', e.date); p.set('enddt', addDays(e.date,1)); p.set('allday','true'); }
    return 'https://outlook.office.com/calendar/0/deeplink/compose?'+p.toString();
  }
  const icsEsc = s => String(s).replace(/\\/g,'\\\\').replace(/;/g,'\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
  function icsFold(line){ const out = []; while (line.length > 74){ out.push(line.slice(0,74)); line = ' '+line.slice(74); } out.push(line); return out.join('\r\n'); }
  function toIcs(list){
    const stamp = new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
    const L = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Steady Shift//Test app//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Steady Shift (sample)',
      'BEGIN:VTIMEZONE','TZID:America/Chicago','BEGIN:DAYLIGHT','TZOFFSETFROM:-0600','TZOFFSETTO:-0500','TZNAME:CDT','DTSTART:19700308T020000','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU','END:DAYLIGHT',
      'BEGIN:STANDARD','TZOFFSETFROM:-0500','TZOFFSETTO:-0600','TZNAME:CST','DTSTART:19701101T020000','RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU','END:STANDARD','END:VTIMEZONE'];
    list.forEach(e => {
      L.push('BEGIN:VEVENT', 'UID:'+e.id+'-'+e.date+'@steady-shift.test', 'DTSTAMP:'+stamp);
      if (e.time){ L.push('DTSTART;TZID='+TZ+':'+compact(e.date,e.time), 'DTEND;TZID='+TZ+':'+compact(e.endDate||e.date,addMin(e.time,e.dur))); }
      else { L.push('DTSTART;VALUE=DATE:'+compact(e.date), 'DTEND;VALUE=DATE:'+compact(addDays(e.date,1))); }
      L.push('SUMMARY:'+icsEsc(e.title), 'DESCRIPTION:'+icsEsc(e.note+'\nOpen in Steady Shift: '+appUrl(e)), 'CATEGORIES:'+icsEsc(e.kind), 'URL:'+appUrl(e));
      if (e.time) L.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+icsEsc(e.title),'TRIGGER:-PT15M','END:VALARM');
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(icsFold).join('\r\n')+'\r\n';
  }
  const csvCell = s => { s = String(s==null?'':s); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
  function toCsv(list){
    const nm = id => (D.SITES.find(s=>s.id===id)||{}).name || '';
    const rows = [['Date','Start time','End time','Title','Assign to (role)','Location','Type','Notes']];
    list.forEach(e => rows.push([e.date, e.time||'', e.time?addMin(e.time,e.dur):'', e.title, e.who, nm(e.site), e.kind, e.note]));
    return rows.map(r => r.map(csvCell).join(',')).join('\r\n')+'\r\n';
  }
  function download(name, type, text){
    const a = h('a',{href:URL.createObjectURL(new Blob([text],{type})), download:name});
    document.body.append(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Downloaded '+name);
  }
  function teamsPayload(e){
    return {type:'message', attachments:[{contentType:'application/vnd.microsoft.card.adaptive', contentUrl:null, content:{
      $schema:'http://adaptivecards.io/schemas/adaptive-card.json', type:'AdaptiveCard', version:'1.4',
      body:[{type:'TextBlock', text:e.kind, size:'Small', color:'Accent', weight:'Bolder'},
            {type:'TextBlock', text:e.title, wrap:true, weight:'Bolder', size:'Medium'},
            {type:'FactSet', facts:[{title:'When', value:fmtDate(e.date)+(e.time?' · '+e.time+' CT':'')},{title:'For', value:e.who}]},
            {type:'TextBlock', text:e.note, wrap:true}],
      actions:[{type:'Action.OpenUrl', title:'Open in Steady Shift', url:appUrl(e)}]}}]};
  }
  function chatPayload(e){ return {text:'*'+e.kind+'*: '+e.title+'\nWhen: '+fmtDate(e.date)+(e.time?' · '+e.time+' CT':'')+' · For: '+e.who+'\n'+e.note+'\n<'+appUrl(e)+'|Open in Steady Shift>'}; }

  R.sync = v => {
    v.append(head('Connect your tools', 'Sync and calendar', 'Send what gets decided here to the calendar, scheduling tool and team chat your home already uses. Test version: sample data only.'));
    const ev = syncEvents();
    v.append(h('div',{class:'card calm'}, h('b',null,'What leaves the app'),
      h('p',{class:'small'},'Only the task, the home, the role and a link back. Resident names, resident codes and report details never go into a calendar, a spreadsheet or a chat message. People open the link and sign in to see more.')));
    const list = h('div',{class:'list'});
    ev.forEach(e => list.append(h('div',{class:'item'},
      h('div',{class:'meta'}, h('span',{class:'chip'},e.kind), h('span',{class:'chip grey'},e.who), h('span',null,fmtDate(e.date)+(e.time?' · '+e.time+' CT':' · all day'))),
      h('b',null,e.title),
      h('div',{class:'row'},
        h('a',{class:'btn ghost sm',href:gcalUrl(e),target:'_blank',rel:'noopener'},'Google Calendar'),
        h('a',{class:'btn ghost sm',href:outlookUrl(e),target:'_blank',rel:'noopener'},'Outlook'),
        h('button',{class:'btn quiet sm',type:'button',onclick:()=>download('steady-shift-'+e.id+'.ics','text/calendar',toIcs([e]))},'.ics file')))));
    v.append(h('div',{class:'card'}, h('h2',null,'Coming up from the app ('+ev.length+')'),
      h('p',{class:'small muted'},['owner','multi'].includes(S.tier)?'All your homes.':'For '+site().name+'. Switch homes at the top, or view as owner for every home.'),
      ev.length ? list : h('p',{class:'muted'},'Nothing scheduled from the app right now.'),
      h('div',{class:'row'},
        h('button',{class:'btn sm',type:'button',onclick:()=>download('steady-shift-calendar.ics','text/calendar',toIcs(ev)),disabled:!ev.length},'Download all (.ics)'),
        h('button',{class:'btn ghost sm',type:'button',onclick:()=>download('steady-shift-tasks.csv','text/csv',toCsv(ev)),disabled:!ev.length},'Spreadsheet or shift tool (.csv)')),
      h('p',{class:'small muted'},'The .ics file opens in Google Calendar, Outlook and Apple Calendar. The .csv opens in Google Sheets or Excel, and is a starting point for importing tasks into scheduling tools such as When I Work or Deputy (each tool names its columns a little differently).')));

    // Team chat demo
    const sel = h('select',{id:'syncEv'}, ev.map((e,i) => h('option',{value:i},e.title)));
    const dest = h('select',{id:'syncDest'}, h('option',{value:'teams'},'Microsoft Teams (Workflows webhook)'), h('option',{value:'gchat'},'Google Chat (space webhook)'));
    const url = h('input',{type:'password',id:'syncUrl',placeholder:'Paste a test webhook link (optional)',autocomplete:'off'});
    const pre = h('pre',{class:'small',style:'white-space:pre-wrap;overflow:auto;max-height:18rem;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:.8rem;margin:0'});
    const preview = h('div',{class:'item'});
    const payload = () => { const e = ev[+sel.value]; return e ? (dest.value==='teams' ? teamsPayload(e) : chatPayload(e)) : null; };
    function show(){
      const p = payload(); pre.textContent = p ? JSON.stringify(p, null, 2) : '';
      preview.textContent = ''; const e = ev[+sel.value];
      if (e) preview.append(h('div',{class:'meta'},h('span',{class:'chip'},dest.value==='teams'?'Teams card':'Chat message'),h('span',null,e.kind)), h('b',null,e.title), h('span',{class:'small'},fmtDate(e.date)+(e.time?' · '+e.time+' CT':'')+' · For: '+e.who), h('span',{class:'small'},e.note), h('a',{class:'small',href:e.link},'Open in Steady Shift'));
    }
    sel.addEventListener('change', show); dest.addEventListener('change', show); show();
    const curl = () => "curl -X POST -H 'Content-Type: application/json' --data '"+JSON.stringify(payload()).replace(/'/g,"'\\''")+"' '"+(url.value.trim()||'PASTE_WEBHOOK_LINK_HERE')+"'";
    const sendBtn = h('button',{class:'btn ghost sm',type:'button',onclick:async ()=>{
      const u = url.value.trim();
      if (!/^https:\/\/([a-z0-9-]+\.)*(logic\.azure\.com|powerplatform\.com|chat\.googleapis\.com)(:443)?\//i.test(u)){ toast('Paste a Teams Workflows or Google Chat webhook link first'); return; }
      try { await fetch(u, {method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain'}, body:JSON.stringify(payload())}); toast('Sent. Check the channel. If nothing shows, use the copy command below.'); }
      catch(err){ toast('The browser blocked it. Use the copy command instead.'); }
    }},'Try sending');
    v.append(h('div',{class:'card'}, h('h2',null,'Team chat alert (demo)'),
      h('p',{class:'small'},'Post a decision to a Teams channel or a Google Chat space so the right shift sees it without a group text.'),
      h('label',{for:'syncEv'},'Which item'), sel, h('label',{for:'syncDest'},'Where'), dest,
      h('h3',null,'What the team would see'), preview,
      h('label',{for:'syncUrl'},'Test webhook link'), url,
      h('p',{class:'small muted'},'Kept on this page only, never saved. In the real app the link is stored on our server, encrypted, and messages are sent from there.'),
      h('div',{class:'row'}, sendBtn, h('button',{class:'btn quiet sm',type:'button',onclick:e=>copy(curl(), e.target)},'Copy test command'), h('button',{class:'btn quiet sm',type:'button',onclick:e=>copy(pre.textContent, e.target)},'Copy message')),
      h('details',null,h('summary',{class:'small'},'Message format'), pre),
      h('details',null,h('summary',{class:'small'},'How to get a test link'),
        h('ul',{class:'small'},
          h('li',null,'Teams: in the channel, open Workflows, pick "Send webhook alerts to a channel", and copy the link it gives you.'),
          h('li',null,'Google Chat: in the space, open Apps and integrations, then Webhooks, add one, and copy the link.'),
          h('li',null,'Use a test channel. Sample data only.')))));

    if (window.SSSched && SSAccess.viewOn('schedule')) v.append(h('div',{class:'card'}, h('h2',null,'Shift schedule'),
      h('p',{class:'small'},'The built-in schedule exports the same way: a calendar file for the whole team or one person, Google and Outlook links for each shift, and a spreadsheet for When I Work, Deputy or ShiftCare. Shifts carry the staff name, the home and the times, never resident details.'),
      h('div',{class:'row'}, h('a',{class:'btn ghost sm',href:'#/schedule/export'},'Export the schedule'))));
    v.append(h('div',{class:'card soft'}, h('h2',null,'Coming next'),
      h('ul',{class:'small'},
        h('li',null,'A live calendar feed each manager subscribes to once, so new items appear on their own.'),
        h('li',null,'Two-way sign-in to Google Workspace and Microsoft 365, set up by the owner.'),
        h('li',null,'Scheduling tools: open shifts and call-in coverage pushed to When I Work, Deputy and similar.'),
        h('li',null,'Health record systems only after the privacy foundation and signed agreements are in place.'))));
  };

  // Shared helpers for the scheduling, time sheet, insights and access modules (schedule.js, time.js, insights.js, access.js)
  window.SSApp = {D, h, state:()=>S, save, toast, copy, site, setting, tier, fmtDate, fmtTime, head, download, toIcs, gcalUrl, outlookUrl, csvCell, R, VIEWS, NAV, route:()=>route(), go:v=>go(v), isoDay, addDays, uid, renderNav:()=>renderNav(current), fillSwitchers:()=>fillSwitchers(), param:()=>param};
  Object.assign(window.SSApp, {tile:(...a) => tile(...a), residents, forSite, homeHooks, ownerHooks, rewrite:x => rewrite(x), searchRules:q => searchRules(q), ruleById, dueItems:() => syncEvents(), shiftName:() => shiftName(), labelChip:l => labelChip(l), sb:() => sb, user:() => user});
  // ---------- Doctor orders: intake, RN verification, current orders (sample data only) ----------
  // One shared order store (S.orders). Other screens read verified, active orders through window.SS_ordersFor(site, res).
  const ORDER_KINDS = {med:'Medication', diet:'Diet', activity:'Activity or therapy', appointment:'Appointment or follow-up', lab:'Lab or test', monitor:'Monitoring', other:'Other'};
  const ORDER_SOURCES = ['Visit summary (paper)','Fax','Phone order (read back)','Hospital discharge','Pharmacy','Patient portal printout'];
  const SPECIALTIES = {primary:'Primary care', psych:'Psychiatry and behavioral health', dental:'Dental', therapy:'Therapy (PT, OT, speech)', pharmacy:'Pharmacy', hospice:'Hospice', homehealth:'Home health', specialist:'Other specialist', hospital:'Hospital or ER'};
  const SENSITIVE = ['psych'];
  const TRACK_TYPES = {check:'Checkbox', yesno:'Yes or no', number:'Number', ml:'Fluid (ml)', lb:'Weight (lb)', text:'Short note'};
  const TRACK_FREQ = ['each meal','every shift','daily','weekly'];
  function seedOrders(){
    const t = isoDay(new Date());
    return [
      {id:'o-m3-ins', batch:'b1', site:'maple', res:'M-3', kind:'med', specialty:'primary', text:'Insulin glargine 10 units under the skin at bedtime (sample).', start:'2026-11-01', end:'', prescriber:'Dr. Sample, Example Clinic', source:'Visit summary (paper)', status:'verified', enteredBy:'House manager (sample)', enteredAt:'2026-11-01T15:00:00', verifiedBy:'RN (sample)', verifiedAt:'2026-11-01T18:20:00',
        track:{label:'Blood sugar before supper', type:'number', freq:'daily', where:['meal','handoff']}},
      {id:'o-m2-diet', batch:'b2', site:'maple', res:'M-2', kind:'diet', specialty:'therapy', text:'Soft and bite-sized foods, mildly thick liquids, no peanuts (sample).', start:'2026-11-20', end:'', prescriber:'Speech therapy, Example Clinic', source:'Fax', status:'verified', enteredBy:'House manager (sample)', enteredAt:'2026-11-20T10:00:00', verifiedBy:'RN (sample)', verifiedAt:'2026-11-20T13:05:00',
        diet:{name:'Regular', texture:'IDDSI 6 Soft & bite-sized', liquids:'IDDSI 2 Mildly thick', allergies:['peanut'], notes:'Sit upright for meals and 30 minutes after.'},
        track:{label:'Fluid intake', type:'ml', freq:'every shift', where:['meal','handoff']}},
      {id:'o-b9-wt', batch:'b3', site:'birch', res:'B-9', kind:'monitor', specialty:'hospital', text:'Weigh weekly, same scale, before breakfast. Call if up 3 lb in a week (sample).', start:'2026-11-15', end:'', prescriber:'Dr. Sample, Example Clinic', source:'Hospital discharge', status:'verified', enteredBy:'House manager (sample)', enteredAt:'2026-11-15T09:00:00', verifiedBy:'RN (sample)', verifiedAt:'2026-11-15T11:30:00',
        track:{label:'Weight', type:'lb', freq:'weekly', where:['handoff']}},
      {id:'o-b9-fu', batch:'b3', site:'birch', res:'B-9', kind:'appointment', specialty:'primary', text:'Follow-up with primary care in 2 weeks (sample).', start:addDays(t,10), end:'', prescriber:'Dr. Sample, Example Clinic', source:'Hospital discharge', status:'verified', enteredBy:'House manager (sample)', enteredAt:'2026-11-15T09:00:00', verifiedBy:'RN (sample)', verifiedAt:'2026-11-15T11:30:00'},
      {id:'o-m4-skin', batch:'b4', site:'maple', res:'M-4', kind:'monitor', specialty:'homehealth', text:'Check skin on heels and tailbone each evening; report redness that does not fade (sample).', start:t, end:'', prescriber:'Wound nurse, Example Clinic', source:'Fax', status:'pending', enteredBy:'Caregiver (sample)', enteredAt:new Date().toISOString(),
        track:{label:'Skin check, heels and tailbone', type:'yesno', freq:'every shift', where:['handoff']}},
      {id:'o-m2-psy', batch:'b5', site:'maple', res:'M-2', kind:'med', specialty:'psych', text:'Medication change from the psychiatry visit: follow the new pharmacy label; watch for more sleepiness in the evening (sample).', start:'2026-11-18', end:'', prescriber:'Psychiatric nurse practitioner, Example Behavioral Health', source:'Visit summary (paper)', status:'verified', enteredBy:'House manager (sample)', enteredAt:'2026-11-18T14:00:00', verifiedBy:'RN (sample)', verifiedAt:'2026-11-18T16:40:00',
        track:{label:'Evening sleepiness', type:'yesno', freq:'daily', where:['handoff']}},
      {id:'o-m2-psyfu', batch:'b5', site:'maple', res:'M-2', kind:'appointment', specialty:'psych', text:'Psychiatry follow-up in 4 weeks (sample).', start:addDays(t,20), end:'', prescriber:'Psychiatric nurse practitioner, Example Behavioral Health', source:'Visit summary (paper)', status:'verified', enteredBy:'House manager (sample)', enteredAt:'2026-11-18T14:00:00', verifiedBy:'RN (sample)', verifiedAt:'2026-11-18T16:40:00'},
      {id:'o-m1-dent', batch:'b6', site:'maple', res:'M-1', kind:'appointment', specialty:'dental', text:'Dental cleaning and denture fit check (sample).', start:addDays(t,6), end:'', prescriber:'Example Family Dental', source:'Phone order (read back)', status:'verified', enteredBy:'House manager (sample)', enteredAt:'2026-11-20T09:00:00', verifiedBy:'RN (sample)', verifiedAt:'2026-11-20T09:30:00'},
      {id:'o-m1-dent2', batch:'b6', site:'maple', res:'M-1', kind:'other', specialty:'dental', text:'Soak dentures overnight; brush gums twice a day (sample).', start:'2026-11-20', end:'', prescriber:'Example Family Dental', source:'Phone order (read back)', status:'verified', enteredBy:'House manager (sample)', enteredAt:'2026-11-20T09:00:00', verifiedBy:'RN (sample)', verifiedAt:'2026-11-20T09:30:00',
        track:{label:'Dentures soaked', type:'check', freq:'daily', where:['handoff']}}
    ];
  }
  if (!Array.isArray(S.orders) || S.ordersSeed !== 2) { const mineOnly = (S.orders||[]).filter(o => !/^o-(m|b)\d/.test(o.id)); S.orders = seedOrders().concat(mineOnly); S.ordersSeed = 2; save(); }
  const orderActive = (o, day) => o.status === 'verified' && (!o.start || o.start <= day || o.kind === 'appointment') && (!o.end || o.end >= day);
  window.SS_ordersFor = (siteId, res) => { const d = isoDay(new Date()); return (S.orders||[]).filter(o => o.site === siteId && (!res || o.res === res) && orderActive(o, d)).map(o => JSON.parse(JSON.stringify(o))); };
  window.SS_allOrders = () => JSON.parse(JSON.stringify(S.orders||[]));
  const KIND_CHIP = {med:'', diet:'calm', activity:'grey', appointment:'amber', lab:'grey', monitor:'grey', other:'grey'};
  function orderMeta(o){
    return h('div',{class:'meta'}, o.specialty ? h('span',{class:'chip grey'},SPECIALTIES[o.specialty]||o.specialty) : null, h('span',{class:'chip '+(KIND_CHIP[o.kind]||'')},ORDER_KINDS[o.kind]||o.kind), h('span',null,'Resident '+o.res), o.start ? h('span',null,(o.kind==='appointment'?'On or by ':'From ')+fmtDate(o.start)) : null, o.end ? h('span',null,'until '+fmtDate(o.end)) : null);
  }
  function orderDetail(o){
    const bits = [];
    if (o.diet) bits.push(h('span',{class:'small'},'Diet: '+[o.diet.name, o.diet.texture, o.diet.liquids].filter(Boolean).join(' · ')+(o.diet.allergies && o.diet.allergies.length ? ' · Allergies: '+o.diet.allergies.join(', ') : '')+(o.diet.notes ? ' · '+o.diet.notes : '')));
    if (o.track) bits.push(h('span',{class:'small'},'Record: '+o.track.label+' ('+(TRACK_TYPES[o.track.type]||o.track.type)+', '+o.track.freq+', in '+o.track.where.map(w=>w==='meal'?'meal log':'shift handoff').join(' and ')+')'));
    if (SENSITIVE.includes(o.specialty)) bits.push(h('span',{class:'small'},'Behavioral health: only the instruction staff need is entered. No therapy or visit notes are kept here.'));
    if (SENSITIVE.includes(o.specialty) && S.tier === 'caregiver') return bits;
    bits.push(h('span',{class:'small muted'},'From '+(o.prescriber||'prescriber not given')+' · '+o.source+' · entered by '+o.enteredBy+' '+fmtTime(o.enteredAt)+(o.verifiedAt ? ' · checked by '+o.verifiedBy+' '+fmtTime(o.verifiedAt) : '')));
    return bits;
  }
  const SAMPLE_VISIT = {source:'Visit summary (paper)', specialty:'primary', prescriber:'Dr. Sample, Example Clinic', lines:[
    {kind:'med', text:'Stop the evening dose of the sample water pill. Keep the morning dose.', start:'', end:''},
    {kind:'monitor', text:'Check ankles for swelling each evening.', track:{label:'Ankle swelling', type:'yesno', freq:'daily', where:['handoff']}},
    {kind:'appointment', text:'Return visit in 3 weeks.', start:''}]};

  R.orders = v => {
    const rn = ['rn','manager','owner','multi'].includes(S.tier);
    v.append(head('Orders', 'Doctor orders', 'Get new orders from visits, faxes and discharges into the plan, checked by a nurse before staff act on them. Test version: sample data only, never a real order or a real picture.'));
    const pend = S.orders.filter(o => o.status === 'pending' && (o.site === S.site || ['owner','multi'].includes(S.tier)));
    const back = S.orders.filter(o => o.status === 'returned' && o.site === S.site);
    v.append(h('div',{class:'grid g2'},
      h('div',{class:'stat'+(pend.length?'':' good')},h('b',null,String(pend.length)),h('span',null,'waiting for a nurse check')),
      h('div',{class:'stat'},h('b',null,String(S.orders.filter(o => o.site === S.site && orderActive(o, isoDay(new Date()))).length)),h('span',null,'current orders at '+site().name))));

    // ---- intake form ----
    const resSel = h('select',{id:'oRes'}, residents().map(r => h('option',{value:r.code},r.code+' (sample)')));
    const srcSel = h('select',{id:'oSrc'}, ORDER_SOURCES.map(s => h('option',null,s)));
    const spSel = h('select',{id:'oSpec'}, Object.keys(SPECIALTIES).map(k => h('option',{value:k},SPECIALTIES[k])));
    const spNote = h('p',{class:'small',hidden:true},'Behavioral health: enter only the instruction staff need, such as a medication change or what to watch for. Do not copy therapy or visit notes. Records of substance use treatment have stricter federal rules; leave those out.');
    spSel.addEventListener('change', () => { spNote.hidden = !SENSITIVE.includes(spSel.value); });
    const presc = h('input',{type:'text',id:'oPresc',placeholder:'Example: Dr. Sample, Example Clinic'});
    const file = h('input',{type:'file',id:'oFile',accept:'image/*,application/pdf',capture:null});
    const prev = h('div',{class:'row'});
    file.addEventListener('change', () => { prev.textContent = ''; const f = file.files && file.files[0]; if (!f) return;
      if (/^image\//.test(f.type)) prev.append(h('img',{src:URL.createObjectURL(f),alt:'Picture of the order (not saved)',style:'max-width:220px;max-height:220px;border-radius:12px;border:1px solid var(--line)'}));
      prev.append(h('span',{class:'small muted'},f.name+' attached to this page only. The test app does not save pictures.')); });
    const capBox = h('div'); let capCount = 0;
    const linesBox = h('div',{class:'list'});
    function addLine(pre){
      pre = pre || {};
      const kind = h('select',null, Object.keys(ORDER_KINDS).map(k => h('option',{value:k,selected:k===pre.kind},ORDER_KINDS[k])));
      const text = h('textarea',{style:'min-height:4rem',placeholder:'Write the order as it reads on the paper'}); text.value = pre.text||'';
      const start = h('input',{type:'date'}); start.value = pre.start||isoDay(new Date());
      const end = h('input',{type:'date'}); end.value = pre.end||'';
      const dietBox = h('div',{class:'grid g2'});
      const dName = h('input',{type:'text',placeholder:'Example: Consistent carb'}), dTex = h('input',{type:'text',placeholder:'Example: IDDSI 6 Soft & bite-sized'}), dLiq = h('input',{type:'text',placeholder:'Example: IDDSI 2 Mildly thick'}), dAll = h('input',{type:'text',placeholder:'Example: peanut, shellfish'});
      dietBox.append(h('label',{class:'f'},'Diet name',dName), h('label',{class:'f'},'Food texture',dTex), h('label',{class:'f'},'Liquids',dLiq), h('label',{class:'f'},'Allergies (commas)',dAll));
      const tOn = h('input',{type:'checkbox'}); tOn.checked = !!pre.track;
      const tLabel = h('input',{type:'text',placeholder:'Example: Fluid intake'}); tLabel.value = pre.track ? pre.track.label : '';
      const tType = h('select',null, Object.keys(TRACK_TYPES).map(k => h('option',{value:k,selected:pre.track && pre.track.type===k},TRACK_TYPES[k])));
      const tFreq = h('select',null, TRACK_FREQ.map(f => h('option',{selected:pre.track && pre.track.freq===f},f)));
      const wMeal = h('input',{type:'checkbox'}), wHand = h('input',{type:'checkbox'});
      wMeal.checked = pre.track ? pre.track.where.includes('meal') : false; wHand.checked = pre.track ? pre.track.where.includes('handoff') : true;
      const trackBox = h('div',{class:'grid g2'}, h('label',{class:'f'},'What to record',tLabel), h('label',{class:'f'},'Type',tType), h('label',{class:'f'},'How often',tFreq),
        h('div',{class:'f'}, h('span',{class:'small'},'Show it in'), h('label',{class:'row small'},wMeal,'Meal log'), h('label',{class:'row small'},wHand,'Shift handoff')));
      const sync = () => { dietBox.style.display = kind.value === 'diet' ? '' : 'none'; trackBox.style.display = tOn.checked ? '' : 'none'; };
      kind.addEventListener('change', sync); tOn.addEventListener('change', sync);
      const rm = h('button',{class:'btn quiet sm',type:'button'},'Remove line');
      const box = h('div',{class:'item'}, h('div',{class:'grid g2'}, h('label',{class:'f'},'Type of order',kind), h('div')), h('label',{class:'f'},'Order',text),
        h('div',{class:'grid g2'}, h('label',{class:'f'},'Start (or appointment date)',start), h('label',{class:'f'},'Stop date, if any',end)),
        dietBox, h('label',{class:'row small'},tOn,'Staff need to record something for this order'), trackBox, rm);
      rm.addEventListener('click', () => { if (linesBox.children.length > 1) box.remove(); });
      box._read = () => {
        if (!text.value.trim()) return null;
        const o = {kind:kind.value, text:text.value.trim(), start:start.value, end:end.value};
        if (o.kind === 'diet') o.diet = {name:dName.value.trim(), texture:dTex.value.trim(), liquids:dLiq.value.trim(), allergies:dAll.value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean), notes:''};
        if (tOn.checked && tLabel.value.trim()) o.track = {label:tLabel.value.trim(), type:tType.value, freq:tFreq.value, where:[wMeal.checked?'meal':null, wHand.checked?'handoff':null].filter(Boolean)};
        if (o.track && !o.track.where.length) o.track.where = ['handoff'];
        return o;
      };
      sync(); linesBox.append(box);
    }
    addLine();
    const f = h('form',{class:'card'}, h('h2',null,'A new order came in'),
      h('div',{class:'grid g2'}, h('label',{class:'f'},'Resident',resSel), h('label',{class:'f'},'Care area',spSel)), spNote,
      h('div',{class:'grid g2'}, h('label',{class:'f'},'Where it came from',srcSel), h('label',{class:'f'},'Doctor, dentist or clinic',presc)),
      h('div',{class:'row'}, h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ if (capBox.firstChild) return;
        if (!window.SSCapture){ file.setAttribute('capture','environment'); file.click(); return; }
        const ctx = {id:'orders-'+uid(), docs:[]};
        const panel = window.SSCapture.panel(ctx, doc => { if (panel._stop) panel._stop(); capBox.textContent = ''; if (doc){ capCount += doc.count; prev.textContent = ''; prev.append(h('span',{class:'chip calm'},capCount+' page'+(capCount>1?'s':'')+' photographed in the app'), h('span',{class:'small muted'},'Kept in this page\'s memory only, never in the phone\'s photos. Cleared when you leave this screen.')); } });
        capBox.append(panel); }},'📸 Take photos in the app'), h('span',{class:'small muted'},'Photos stay inside Steady Shift, not in the phone\'s camera roll.')),
      capBox,
      h('label',{class:'f'},'Or upload a file (optional)',file), prev,
      h('h3',null,'What the order says'), linesBox,
      h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>addLine()},'Add another line'),
        h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ linesBox.textContent=''; srcSel.value = SAMPLE_VISIT.source; spSel.value = SAMPLE_VISIT.specialty; spNote.hidden = true; presc.value = SAMPLE_VISIT.prescriber; SAMPLE_VISIT.lines.forEach(l => addLine(Object.assign({}, l, {start: l.kind==='appointment' ? addDays(isoDay(new Date()),21) : ''}))); toast('Sample visit summary filled in'); }},'Fill in a sample visit summary')),
      h('p',{class:'small muted'},'Phone orders: read the order back to the prescriber, then enter it here. A medication from a phone order stays waiting until the signed written order is in the file (DHS 88.07(3)(d), DHS 83.37(1)(a)). Nothing changes for staff until a nurse checks it.'),
      h('button',{class:'btn',type:'submit'},'Send to the nurse to check'));
    f.addEventListener('submit', e => { e.preventDefault();
      const lines = [...linesBox.children].map(b => b._read()).filter(Boolean);
      if (!lines.length){ toast('Write at least one order line'); return; }
      const batch = uid(), at = new Date().toISOString();
      lines.forEach(l => S.orders.push(Object.assign({id:'o-'+uid(), batch, site:S.site, res:resSel.value, specialty:spSel.value, prescriber:presc.value.trim(), source:srcSel.value, status:'pending', enteredBy:tier().name+' (you)', enteredAt:at, hadFile:!!(file.files && file.files.length) || capCount > 0, photos:capCount}, l)));
      save(); toast('Sent to the nurse. '+lines.length+' line'+(lines.length>1?'s':'')+' waiting.'); route(); });

    // ---- nurse check ----
    const checkCard = h('div',{class:'card'+(pend.length?' warn':'')}, h('h2',null,'Waiting for a nurse check ('+pend.length+')'),
      h('p',{class:'small muted'},'Homes without an RN: the manager does this check and calls the prescriber with any question. Follow your home\'s medication and delegation rules.'));
    if (!pend.length) checkCard.append(h('p',{class:'muted'},'Nothing waiting.'));
    pend.forEach(o => {
      const steps = ['Matches the paper, fax or read-back word for word', 'Anything unclear was clarified with the prescriber', o.kind==='med' ? 'Pharmacy has it and the MAR is updated' : 'Care plan or service plan updated', 'Staff doing it are trained or delegated'];
      // Wisconsin AFHs and CBRFs need a signed written order on file before any medication is given (DHS 88.07(3)(d), DHS 83.37(1)(a)).
      if (o.kind === 'med' && /phone/i.test(o.source||'')) steps.unshift('Signed written order received (fax, portal or paper) and filed. Not given before then (DHS 88.07(3)(d), 83.37(1)(a))');
      const boxes = steps.map(s => h('label',{class:'row small'},h('input',{type:'checkbox'}),s));
      const note = h('input',{type:'text',placeholder:'Note for the sender (optional)'});
      const ok = h('button',{class:'btn sm',type:'button',disabled:!rn},'Checked, make it active');
      const no = h('button',{class:'btn quiet sm',type:'button',disabled:!rn},'Send back with a question');
      ok.addEventListener('click', () => { if (boxes.some(b => !b.querySelector('input').checked)){ toast('Tick every check first'); return; } o.status = 'verified'; o.verifiedBy = tier().name+' (you)'; o.verifiedAt = new Date().toISOString(); if (note.value.trim()) o.rnNote = note.value.trim(); save(); toast('Active. Staff will see it on their screens.'); route(); });
      no.addEventListener('click', () => { o.status = 'returned'; o.rnNote = note.value.trim() || 'Please clarify with the prescriber.'; o.verifiedBy = tier().name+' (you)'; o.verifiedAt = new Date().toISOString(); save(); toast('Sent back.'); route(); });
      checkCard.append(h('div',{class:'item'}, orderMeta(o), h('b',null,o.text), orderDetail(o), o.hadFile ? h('span',{class:'small'},'A picture was attached when it was entered.') : null, boxes, note, h('div',{class:'row'},ok,no), !rn ? h('span',{class:'small muted'},'View as RN or house manager to check orders.') : null));
    });
    if (back.length) checkCard.append(h('h3',null,'Sent back'), back.map(o => h('div',{class:'item'}, orderMeta(o), h('b',null,o.text), h('span',{class:'small'},'Question: '+o.rnNote),
      h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ o.status = 'pending'; save(); route(); }},'Clarified, send again'))));

    // ---- current orders ----
    const today = isoDay(new Date());
    const cur = h('div',{class:'card'}, h('h2',null,'Current orders at '+site().name),
      h('p',{class:'small muted'},'Only nurse-checked orders show here. Meal and shift handoff screens read these, so anything to record appears on them automatically.'));
    residents().forEach(r => {
      const mine = S.orders.filter(o => o.site === S.site && o.res === r.code && orderActive(o, today));
      if (!mine.length) return;
      cur.append(h('h3',null,'Resident '+r.code), h('div',{class:'list'}, mine.map(o => h('div',{class:'item'}, orderMeta(o), h('b',null,o.text), orderDetail(o),
        h('div',{class:'row'},
          o.kind==='appointment' && o.start ? h('a',{class:'btn ghost sm',target:'_blank',rel:'noopener',href:gcalUrl({title:(SENSITIVE.includes(o.specialty)?'Resident':(SPECIALTIES[o.specialty]||'Resident'))+' appointment ('+site().name+')', date:o.start, time:null, dur:60, note:'Details are in Steady Shift. Arrange a ride and send the visit form.', link:'#/orders'})},'Add to Google Calendar') : null,
          rn ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ o.end = addDays(today,-1); o.stoppedBy = tier().name+' (you)'; save(); toast('Stopped. It no longer shows for staff.'); route(); }},'Stop this order') : null)))));
    });
    if (cur.children.length === 2) cur.append(h('p',{class:'muted'},'No current orders for this home.'));

    // ---- care team hub: one view across specialties ----
    const hub = h('div',{class:'card'}, h('h2',null,'Care team at a glance'),
      h('p',{class:'small muted'},'Every care area in one place, built from nurse-checked orders: who is involved, what is active, and the next visit.'));
    const tb = h('table',{class:'t'}, h('thead',null,h('tr',null,['Resident','Care area','Active orders','Next visit'].map(x=>h('th',null,x)))));
    const body = h('tbody');
    residents().forEach(r => {
      const mine = S.orders.filter(o => o.site === S.site && o.res === r.code && orderActive(o, today));
      const areas = [...new Set(mine.map(o => o.specialty||'other'))];
      areas.forEach((a,i) => { const ao = mine.filter(o => (o.specialty||'other') === a); const nxt = ao.filter(o => o.kind === 'appointment' && o.start >= today).sort((x,y)=>x.start.localeCompare(y.start))[0];
        body.append(h('tr',null, h('td',null,i===0?r.code:''), h('td',null,SPECIALTIES[a]||'Other'), h('td',null,String(ao.filter(o=>o.kind!=='appointment').length)), h('td',null,nxt?fmtDate(nxt.start):'–'))); });
    });
    tb.append(body);
    hub.append(body.children.length ? h('div',{class:'tablewrap'},tb) : h('p',{class:'muted'},'No checked orders yet.'),
      h('p',{class:'small muted'},'Guardians and activated powers of attorney: record who consented to sharing with each provider. That consent record comes with the privacy foundation.'));

    v.append(f, checkCard, hub, cur);
    v.append(h('div',{class:'card soft'}, h('h2',null,'Later: orders that arrive on their own'),
      h('ul',{class:'small'},
        h('li',null,'A secure fax number for each home, so faxed orders land in this list instead of on paper.'),
        h('li',null,'Secure messages from clinics and the Wisconsin health information exchange.'),
        h('li',null,'Visit summaries pulled from the clinic\'s patient portal, with the resident\'s or guardian\'s permission.'),
        h('li',null,'Pharmacy updates to the medication list.')),
      h('p',{class:'small muted'},'All of these carry real health information, so they wait until the privacy and security foundation and signed agreements are in place.')));
  };

  // Owner view
  function siteStats(id){
    const s = D.SITES.find(x=>x.id===id);
    const A = (S.survey[id]||{}); const qs = D.SURVEY[s.setting]||[];
    const pts = qs.reduce((t,q,i)=>t+({yes:2,partly:1}[A[i]]||0),0);
    const ready = Object.keys(A).length ? Math.round(pts/(qs.length*2)*100) : (id==='maple'?70:id==='birch'?55:id==='cedar'?80:null);
    const staff = S.staff[id]||[];
    const trained = staff.length ? Math.round(staff.filter(p=>!p.need||p.hours>=p.need).length/staff.length*100) : 0;
    return {s, ready, readySample:!Object.keys(A).length, trained,
      night:S.triage.filter(x=>x.site===id && !x.woke).length,
      reports:S.reports.filter(x=>x.site===id && x.status!=='Filed').length,
      qs:S.questions.filter(x=>x.site===id).length,
      dele:S.delegations.filter(x=>x.site===id && x.status!=='Active').length};
  }
  R.owner = (v, isHome) => {
    if (S.site === 'family'){ S.site = 'maple'; save(); fillSwitchers(); }
    const st = siteStats(S.site);
    v.append(head('Owner view · '+site().name, 'How the home is doing', 'Patterns, not people. Resident names and raw incident text stay out unless you open a report on purpose.'));
    v.append(h('div',{class:'grid g4'},
      h('div',{class:'card'},h('div',{class:'stat '+(st.ready>=80?'good':'warnc')},h('b',null,st.ready!=null?st.ready+'%':'–'),h('span',null,'survey ready'+(st.readySample?' (sample)':'')))),
      h('div',{class:'card'},h('div',{class:'stat '+(st.trained>=80?'good':'warnc')},h('b',null,st.trained+'%'),h('span',null,'staff on track with training'))),
      h('div',{class:'card'},h('div',{class:'stat good'},h('b',null,String(st.night)),h('span',null,'night calls handled without waking the manager'))),
      h('div',{class:'card'},h('div',{class:'stat'},h('b',null,String(st.dele)),h('span',null,'RN delegations need renewal')))));
    // money view
    const price = setting()==='cbrf' ? 199 : 79;
    const inp = (val, lbl) => { const i = h('input',{type:'number',min:'0',value:String(val)}); return [i, h('label',{class:'f'},lbl,i)]; };
    const [mgr, mgrL] = inp(35,'Manager\'s time, $ per hour');
    const [calls, callsL] = inp(6,'Night calls avoided per month');
    const [rep, repL] = inp(2,'Hours saved on reports per week');
    const [cit, citL] = inp(1,'Citations avoided per year');
    const [fine, fineL] = inp(1500,'Average cost of a citation, $ (fix time + forfeiture)');
    const out = h('div',{class:'grid g3'});
    function calc(){
      const m = +mgr.value||0;
      const monthly = (+calls.value||0)*0.75*m + (+rep.value||0)*4.3*m + ((+cit.value||0)*(+fine.value||0))/12;
      out.textContent = '';
      out.append(h('div',{class:'stat good'},h('b',null,'$'+Math.round(monthly).toLocaleString()),h('span',null,'estimated value per month')),
        h('div',{class:'stat'},h('b',null,'$'+price),h('span',null,'draft plan price per month')),
        h('div',{class:'stat '+(monthly>price?'good':'warnc')},h('b',null,(monthly/price).toFixed(1)+'×'),h('span',null,'return on the subscription')));
    }
    [mgr,calls,rep,cit,fine].forEach(i=>i.addEventListener('input',calc));
    v.append(h('div',{class:'card'}, h('h2',null,'Money view'), h('p',{class:'small muted'},'Draft estimates. Change the numbers to match your home. Not a promise of savings.'),
      h('div',{class:'grid g3'},mgrL,callsL,repL,citL,fineL), out));
    calc();
    // top confusions
    const by = {}; S.questions.filter(q=>q.site===S.site && q.id).forEach(q=>by[q.id]=(by[q.id]||0)+1);
    const top = Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,5);
    v.append(h('div',{class:'grid g2'},
      h('div',{class:'card'}, h('h2',null,'Top 5 things your team asked'), top.length ? h('ol',null, top.map(([id,n]) => h('li',null,ruleById(id).q+' ('+n+')'))) : h('p',{class:'muted'},'Nothing yet.'), h('p',{class:'small muted'},'Use these to plan the next training. No names attached.'), h('a',{href:'#/questions'},'Full question report')),
      h('div',{class:'card'}, h('h2',null,'Funding and rate watch'), h('p',null,'Family Care rates, Direct Care Workforce Funding, wage pressure and federal Medicaid changes, with year-end scenarios for this home.'), h('div',{class:'row'}, h('a',{class:'btn sm',href:'#/outlook'},'Open Owner Outlook'), h('a',{href:'#/watch'},'Regulatory Watch')))));
    ownerHooks.forEach(f => { try { f(v); } catch(e){ console.error(e); } });
    if (isHome){ const ic = installCard(); if (ic) v.append(ic); const pc = pulseCard(); if (pc) v.append(pc); v.append(tourCard()); }
  };

  // All sites (multi-site)
  R.sites = (v, isHome) => {
    v.append(head('Multi-site operator', 'All your homes at a glance', 'Compare health by site. Resident detail stays inside each home.'));
    const ids = D.SITES.filter(s=>s.setting!=='home').map(s=>s.id);
    const tb = h('table',{class:'t'}, h('thead',null,h('tr',null,['Home','Type','Survey ready','Staff trained','Reports open','Questions','Delegations to renew',''].map(x=>h('th',null,x)))));
    const body = h('tbody');
    ids.forEach(id => { const st = siteStats(id);
      body.append(h('tr',null, h('td',null,h('b',null,st.s.name)), h('td',null,D.SETTINGS[st.s.setting].short), h('td',null,h('span',{class:'chip '+(st.ready>=80?'calm':'amber')},st.ready+'%')), h('td',null,st.trained+'%'), h('td',null,String(st.reports)), h('td',null,String(st.qs)), h('td',null,String(st.dele)),
        h('td',null,h('button',{class:'btn ghost sm',type:'button',onclick:()=>{S.site=id;save();fillSwitchers();go('owner');}},'Open'))));
    });
    tb.append(body);
    v.append(h('div',{class:'card'},h('div',{class:'tablewrap'},tb),h('p',{class:'small muted'},'Survey scores marked as sample until each home runs its own check.')));
    // push a policy
    const txt = h('textarea',{placeholder:'e.g. Starting Dec 1, every fall gets a check every hour for 4 hours, logged in Night help.'});
    const boxes = ids.map(id => { const s = D.SITES.find(x=>x.id===id); return h('label',{class:'row small'},h('input',{type:'checkbox',value:id,checked:true}),s.name); });
    const f = h('form',{class:'card'}, h('h2',null,'Send one policy to every home'), h('p',{class:'small muted'},'Each house manager confirms they\'ve read it and trained staff.'), txt, h('div',{class:'row'},boxes), h('div',{class:'row'},h('button',{class:'btn',type:'submit'},'Send policy')));
    f.addEventListener('submit', e => { e.preventDefault(); if(!txt.value.trim()) return; const to = boxes.filter(b=>b.querySelector('input').checked).map(b=>b.querySelector('input').value);
      S.policies.push({id:uid(), text:txt.value.trim(), to, acks:[], at:new Date().toISOString()}); save(); toast('Sent to '+to.length+' homes'); route(); });
    v.append(f);
    if (S.policies.length) v.append(h('div',{class:'card'}, h('h2',null,'Policies sent'), h('div',{class:'list'}, S.policies.slice().reverse().map(p => h('div',{class:'item'}, h('div',{class:'meta'},h('span',null,fmtDate(p.at)),h('span',{class:'chip '+(p.acks.length===p.to.length?'calm':'amber')},p.acks.length+' of '+p.to.length+' confirmed')), h('span',null,p.text),
      p.acks.length < p.to.length ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ const next = p.to.find(x=>!p.acks.includes(x)); p.acks.push(next); save(); route(); }},'Simulate a manager confirming') : null)))));
    if (isHome){ const ic = installCard(); if (ic) v.append(ic); const pc = pulseCard(); if (pc) v.append(pc); v.append(tourCard()); }
  };

  // Hand-off packet (family)
  R.handoff = v => {
    v.append(head('Hand-off packet', 'One page for your helper', 'Fill it in, print it, leave it on the fridge. Sample details are filled in.'));
    const fld = (lbl, val, big) => { const e = big ? h('textarea',{style:'min-height:5rem'}) : h('input',{type:'text'}); e.value = val; return [e, h('label',{class:'f'},lbl,e)]; };
    const [a,aL] = fld('Daily routine','Up at 7, coffee and breakfast. Rest after lunch. Supper at 5. Bed at 9.',true);
    const [b,bL] = fld('Medicines (from the pharmacy list)','8 AM: 2 pills from the blister pack. 8 PM: 1 pill. Do not give extra.',true);
    const [c,cL] = fld('Who to call','Emergency: 911. Nurse line: (sample) 555-0100. Me: (sample) 555-0123.');
    const [d,dL] = fld('Please don\'t','Don\'t argue about going home; offer a walk or coffee. Don\'t change medicines.',true);
    const [e,eL] = fld('Where things are','DNR form on the fridge. Spare key with neighbor.');
    const out = h('div');
    const f = h('form',{class:'card'}, aL,bL,cL,dL,eL, h('button',{class:'btn',type:'submit'},'Make the packet'));
    f.addEventListener('submit', ev => { ev.preventDefault(); out.textContent='';
      const txt = 'HAND-OFF PACKET (TEST DATA)\n\nDaily routine:\n'+a.value+'\n\nMedicines:\n'+b.value+'\n\nWho to call:\n'+c.value+'\n\nPlease don\'t:\n'+d.value+'\n\nWhere things are:\n'+e.value+'\n\nIf in doubt, call. Thank you for helping.';
      const cb = h('button',{class:'btn ghost sm',type:'button'},'Copy'); cb.addEventListener('click',()=>copy(txt,cb));
      out.append(h('div',{class:'card'},h('div',{class:'out'},txt),h('div',{class:'row noprint'},cb,h('button',{class:'btn ghost sm',type:'button',onclick:()=>window.print()},'Print')))); });
    v.append(f, out);
  };

  // ---------- feedback loop: ratings, edits, empty searches, drop-offs, monthly pulse ----------
  // Signals stay in this browser (test data). Only people who opt in are recorded, text is scrubbed of names,
  // and nothing changes the guidance until a person reviews it in the owner's Feedback review queue.
  const AREA = {whatif:'What-if scenario', survey:'Survey-Ready Check', check:'Procedure answer', report:'Report rewrite', behavior:'Behavior guide', night:'Night help', pulse:'Monthly pulse'};
  let pending = null; // a started-but-unfinished task, logged as a drop-off if the person leaves the screen
  function scrubNote(t){
    let s = String(t||'');
    Object.values(D.RESIDENTS).flat().forEach(r => { if (r.nick !== 'Mom') s = s.replace(new RegExp('\\b'+r.nick+'\\b','g'), r.code); });
    s = s.replace(/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g,'[date]').replace(/\b\d{3}[- ]?\d{2,3}[- ]?\d{4}\b/g,'[number]');
    s = s.replace(/([a-z,;:]\s+)([A-Z][a-z]{2,})\b/g, (m, pre, w) => /^(I|AM|PM|RN|LPN|CNA|DQA|MCO|PRN|DNR|AFH|CBRF|DHS|Resident|Staff|Manager|Nurse|Mom|Dad|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/.test(w) ? m : pre+'[name]');
    // a capitalized word that starts a sentence is kept only if it is a common opener, so "Bob wants..." becomes "[name] wants..."
    s = s.replace(/(^|[.!?]\s+)([A-Z][a-z]{2,})\b/g, (m, pre, w) => /^(The|This|That|These|Those|There|Then|They|Their|She|Her|His|Our|We|You|Your|It|Its|When|What|Why|How|Who|Where|Which|If|Maybe|Please|Can|Could|Would|Should|Need|Needs|Add|Make|Change|Use|Let|Also|And|But|For|Not|Too|More|Less|Some|Most|All|Any|Every|One|Two|After|Before|During|Night|Day|Morning|Evening|Shift|Staff|Resident|Residents|Family|Manager|Nurse|Owner|Caregiver|Caregivers|Report|Search|Answer|Answers|Rule|Rules|Policy|App|Great|Good|Thanks|Thank|Helpful|Confusing|Wrong|Yes|No|Okay|Our|Mom|Dad)$/.test(w) ? m : pre+'[name]');
    return s.slice(0, 600);
  }
  function signal(o){
    if (S.optin !== true) return false;
    const x = Object.assign({id:uid(), at:new Date().toISOString(), site:S.site, tier:S.tier, status:'New', mine:true}, o);
    S.signals.push(x); save();
    // Test version: a copy also goes to the Owner Desk (with the tester's email) so nothing a tester shares is lost.
    // Text is already scrubbed of names, dates and numbers; drop-offs stay local to keep the desk readable.
    if (x.type !== 'dropoff') queueDesk('sig-'+x.id, {kind:'Feedback', biz:'Test app feedback: '+(AREA[x.area]||x.area), when:'Whenever', text:signalText(x), status:'New', reply:'', source:'test-app-feedback', tier:x.tier, area:x.area, type:x.type});
    return true;
  }
  function signalText(x){
    const T = {rating:'Rating', edit:'Edited a generated report', pulse:'Monthly pulse', search:'Search with no results'};
    const l = [(T[x.type]||x.type)+': '+(x.label||x.ref||'')];
    if (x.type === 'rating') l.push('Helpful? '+(x.val === 'up' ? '👍 Yes' : '👎 Not really')+(x.team ? '. How our team handles it? '+x.team : ''));
    if (x.type === 'pulse') l.push('Score: '+x.val+' of 5');
    if (x.type === 'edit'){ if (x.added) l.push('Added: '+x.added); if (x.removed) l.push('Removed: '+x.removed); }
    if (x.q) l.push('Searched for: '+x.q);
    if (x.note) l.push('Note: "'+x.note+'"');
    l.push('', '(From the test app. Viewing as '+(D.TIERS.find(t=>t.id===x.tier)||{name:x.tier}).name+'. Test data only.)');
    return l.join('\n');
  }
  function consentBox(onYes){
    return h('div',{class:'card soft',style:'gap:.5rem'},
      h('b',null,'Help improve the guidance?'),
      h('span',{class:'small'},'Your ratings and notes go to a review queue your owner sees, without your name. In this test version, a copy also goes to Christian on the Owner Desk with your email, so he can follow up. A person reviews them before any guidance changes. Please never type resident names or health details.'),
      h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{S.optin=true;save();onYes();}},'Yes, share anonymously'), h('button',{class:'btn quiet sm',type:'button',onclick:e=>{S.optin=false;save();e.target.closest('.card').replaceWith(h('p',{class:'small muted'},'OK, nothing is shared. You can change this on the Feedback review screen.'));}},'No thanks')));
  }
  // Thumbs up/down plus "Is this how your team handles it?" and an optional note.
  function rateBar(area, ref, label){
    const box = h('div',{class:'rate noprint'});
    const done = S.signals.find(x => x.mine && x.type==='rating' && x.area===area && x.ref===ref && x.site===S.site);
    if (done){ box.append(h('span',{class:'small muted'},'Thanks, you rated this '+(done.val==='up'?'👍':'👎')+'.')); return box; }
    let val = null, team = null;
    const note = h('textarea',{maxlength:'500',style:'min-height:3.5rem',placeholder:'What would make it better? No names or health details.'});
    const more = h('div',{class:'grid',style:'gap:.5rem',hidden:true},
      h('div',{class:'row small'}, h('span',null,'Is this how your team handles it?'), ...['Yes','No','Not sure'].map(o => h('button',{class:'chip',type:'button','aria-pressed':'false',onclick:e=>{team=o;[...e.target.parentNode.querySelectorAll('button')].forEach(b=>b.setAttribute('aria-pressed',String(b===e.target)));}},o))),
      note, h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:submit},'Send feedback')));
    const thumbs = h('div',{class:'row small'}, h('span',null,'Was this helpful?'),
      h('button',{class:'chip',type:'button','aria-label':'Helpful',onclick:()=>pick('up')},'👍 Yes'),
      h('button',{class:'chip',type:'button','aria-label':'Not helpful',onclick:()=>pick('down')},'👎 Not really'));
    box.append(thumbs, more);
    function pick(v){
      val = v; [...thumbs.querySelectorAll('button')].forEach((b,i)=>b.setAttribute('aria-pressed',String((i===0)===(v==='up'))));
      if (S.optin === undefined){ more.hidden = true; if (!box.querySelector('.card')) box.append(consentBox(()=>{ box.querySelector('.card').remove(); more.hidden = false; })); return; }
      more.hidden = false; note.focus();
    }
    function submit(){
      const ok = signal({type:'rating', area, ref, label:label||ref, val, team, note:scrubNote(note.value.trim())});
      box.textContent = ''; box.append(h('span',{class:'small muted'}, ok ? 'Thank you. It\'s in the review queue.' : 'Thanks! (Not shared, since sharing is off.)'));
    }
    return box;
  }
  // word-level change summary between the generated text and what the person ended up with
  function editSummary(a, b){
    const wa = a.split(/\s+/), wb = b.split(/\s+/);
    const ca = {}; wa.forEach(w => ca[w] = (ca[w]||0)+1);
    const added = []; wb.forEach(w => { if (ca[w]) ca[w]--; else added.push(w); });
    const cb = {}; wb.forEach(w => cb[w] = (cb[w]||0)+1);
    const removed = []; wa.forEach(w => { if (cb[w]) cb[w]--; else removed.push(w); });
    return {added:scrubNote(added.join(' ')).slice(0,200), removed:scrubNote(removed.join(' ')).slice(0,200), n:added.length+removed.length};
  }
  function logDropoff(){
    if (pending){ signal({type:'dropoff', area:pending.area, ref:pending.ref||'', label:pending.step}); pending = null; }
  }
  window.addEventListener('pagehide', logDropoff);

  function pulseCard(){
    const month = new Date().toISOString().slice(0,7);
    S.pulse = S.pulse || {};
    if (S.pulse[month] || sessionStorage.getItem('ss-pulse-later')) return null;
    const q = ['owner','multi'].includes(S.tier) ? 'How much did the app help your homes this month?' : 'How much did the app help on your last shift?';
    const note = h('input',{type:'text',maxlength:'300',placeholder:'One thing to improve (optional, no names)'});
    let pickN = 0;
    const scale = h('div',{class:'chips'}, [1,2,3,4,5].map(n => h('button',{class:'chip',type:'button','aria-pressed':'false','aria-label':n+' of 5',onclick:e=>{pickN=n;[...scale.children].forEach(b=>b.setAttribute('aria-pressed',String(b===e.target)));}}, n===1?'1 Not at all':n===5?'5 A lot':String(n))));
    const c = h('div',{class:'card soft noprint'}, h('span',{class:'eyebrow'},'One question this month'), h('h3',null,q), scale, note,
      h('div',{class:'row'},
        h('button',{class:'btn sm',type:'button',onclick:()=>{ if(!pickN){toast('Pick a number first');return;}
          if (S.optin === undefined){ c.append(consentBox(()=>finish())); return; } finish(); }},'Send'),
        h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ try{sessionStorage.setItem('ss-pulse-later','1')}catch(e){} c.remove(); }},'Not now')));
    function finish(){ S.pulse[month] = pickN; save(); signal({type:'pulse', area:'pulse', ref:month, val:String(pickN), note:scrubNote(note.value.trim()), label:q}); c.replaceWith(h('div',{class:'card calm'},h('b',null,'Thanks! See you next month.'))); }
    return c;
  }

  // Owner / manager review queue
  R.review = v => {
    v.append(head('Feedback review', 'What your team says about the guidance', 'Anonymous, opted-in signals. Nothing changes until a person reviews it here.'));
    const all = ['owner','multi'].includes(S.tier) ? S.signals : forSite(S.signals);
    const rat = all.filter(x => x.type==='rating');
    const up = rat.filter(x => x.val==='up').length;
    const pulses = all.filter(x => x.type==='pulse');
    const avg = pulses.length ? (pulses.reduce((s,x)=>s+(+x.val||0),0)/pulses.length).toFixed(1) : '–';
    const emptyQ = S.questions.filter(q => !q.id && (['owner','multi'].includes(S.tier) || q.site===S.site));
    v.append(h('div',{class:'grid g4'},
      h('div',{class:'card'},h('div',{class:'stat '+(rat.length&&up/rat.length>=.7?'good':'warnc')},h('b',null,rat.length?Math.round(up/rat.length*100)+'%':'–'),h('span',null,'found it helpful ('+rat.length+' ratings)'))),
      h('div',{class:'card'},h('div',{class:'stat'},h('b',null,String(all.filter(x=>x.type==='edit').length)),h('span',null,'reports edited after the rewrite'))),
      h('div',{class:'card'},h('div',{class:'stat warnc'},h('b',null,String(emptyQ.length)),h('span',null,'searches with no answer'))),
      h('div',{class:'card'},h('div',{class:'stat'},h('b',null,avg),h('span',null,'monthly pulse average (of 5)')))));
    // by area
    const by = {}; rat.forEach(x => { const k = x.area; by[k] = by[k] || {up:0,down:0}; by[k][x.val]++; });
    if (Object.keys(by).length) v.append(h('div',{class:'card'}, h('h2',null,'Helpful by area'), h('div',{class:'list'}, Object.entries(by).map(([k,c]) => { const n=c.up+c.down; const p=Math.round(c.up/n*100);
      return h('div',{class:'item'}, h('div',{class:'meta'},h('b',{style:'color:var(--ink)'},AREA[k]||k),h('span',null,c.up+' 👍 · '+c.down+' 👎')), h('div',{class:'bar '+(p>=70?'calm':'amber')},h('i',{style:'width:'+p+'%'}))); }))));
    if (emptyQ.length) v.append(h('div',{class:'card warn'}, h('h2',null,'Searches that found nothing'), h('p',{class:'small'},'Each one is a gap: a Clarity Card to write, or a house policy to add.'),
      h('ul',null, emptyQ.slice(-8).reverse().map(q => h('li',null,'"'+scrubNote(q.q)+'" ',h('span',{class:'small muted'},fmtDate(q.at)))))));
    // queue
    let filter = 'New';
    const chipsBar = h('div',{class:'chips'});
    const list = h('div',{class:'list'});
    const TYPE = {rating:'Rating', edit:'Edit to a rewrite', dropoff:'Drop-off', pulse:'Monthly pulse'};
    function draw(){
      chipsBar.textContent = '';
      ['New','Reviewed','Guidance change proposed','All'].forEach(f => chipsBar.append(h('button',{class:'chip',type:'button','aria-pressed':String(f===filter),onclick:()=>{filter=f;draw();}}, f+' ('+(f==='All'?all.length:all.filter(x=>x.status===f).length)+')')));
      list.textContent = '';
      const items = all.filter(x => filter==='All' || x.status===filter).slice().reverse();
      if (!items.length) list.append(h('p',{class:'muted'},'Nothing here.'));
      items.forEach(x => {
        const site0 = D.SITES.find(s=>s.id===x.site);
        const body = [];
        if (x.type==='rating') body.push(h('span',null,(x.val==='up'?'👍 Helpful':'👎 Not helpful')+(x.team?' · Matches how we do it: '+x.team:'')));
        if (x.type==='edit') body.push(h('span',{class:'small'},h('b',null,'Added: '),x.added||'–'), h('span',{class:'small'},h('b',null,'Removed: '),x.removed||'–'));
        if (x.type==='dropoff') body.push(h('span',{class:'small'},'Started but did not finish: '+x.label));
        if (x.type==='pulse') body.push(h('span',null,'Score '+x.val+' of 5'));
        if (x.note) body.push(h('span',{class:'small'},'"'+x.note+'"'));
        const sel = h('select',{'aria-label':'Review status',style:'max-width:240px'}, ['New','Reviewed','Guidance change proposed'].map(s=>h('option',{selected:s===x.status},s)));
        sel.addEventListener('change',()=>{ x.status = sel.value; x.reviewedBy = tier().name; x.reviewedAt = new Date().toISOString(); save(); draw(); });
        const prop = h('button',{class:'btn ghost sm',type:'button'},'Propose a guidance change');
        prop.addEventListener('click', async () => {
          const what = prompt('What should change in the guidance? (No names or health details)', x.type==='rating' && x.note ? x.note : '');
          if (!what) return;
          x.status = 'Guidance change proposed'; x.proposal = scrubNote(what); x.reviewedBy = tier().name; save();
          if (sb && user){ await sb.from('desk_items').insert({kind:'request', data:{kind:'Update', biz:'Test app guidance: '+(AREA[x.area]||x.area), when:'Whenever', text:'Reviewed feedback ('+(TYPE[x.type]||x.type)+' on '+(x.label||x.ref||'')+'):\n'+(x.note?'"'+x.note+'"\n':'')+'\nProposed change: '+x.proposal+'\n\n(From the Feedback review queue, reviewed by '+tier().name+'. Anonymous, test data.)', status:'New', reply:'', by:user.email||'', source:'test-app-review'}}); }
          toast('Sent to the desk for Christian and Claude'); draw();
        });
        list.append(h('div',{class:'item'}, h('div',{class:'meta'}, h('span',{class:'chip grey'},TYPE[x.type]||x.type), h('span',null,AREA[x.area]||x.area), x.label ? h('span',null,String(x.label).slice(0,70)) : null, h('span',null,fmtDate(x.at)), site0 ? h('span',null,site0.name) : null),
          body, x.proposal ? h('span',{class:'small'},h('b',null,'Proposed: '),x.proposal) : null, h('div',{class:'row'},sel, x.status!=='Guidance change proposed' ? prop : null)));
      });
    }
    v.append(h('div',{class:'card'}, h('h2',null,'Review queue'), chipsBar, list));
    draw();
    // opt-in summary to the desk
    const sumBtn = h('button',{class:'btn ghost sm',type:'button'},'Send an anonymous summary to the desk');
    sumBtn.addEventListener('click', async () => {
      const lines = ['Feedback summary from the test app ('+fmtDate(new Date())+', '+(['owner','multi'].includes(S.tier)?'all homes':site().name)+', anonymous test data)',
        'Helpful: '+(rat.length?Math.round(up/rat.length*100)+'% of '+rat.length+' ratings':'no ratings'),
        ...Object.entries(by).map(([k,c])=>'- '+(AREA[k]||k)+': '+c.up+' up, '+c.down+' down'),
        'Edits after rewrite: '+all.filter(x=>x.type==='edit').length, 'Drop-offs: '+all.filter(x=>x.type==='dropoff').map(x=>x.label).slice(-5).join('; '),
        'Searches with no answer: '+emptyQ.slice(-5).map(q=>'"'+scrubNote(q.q)+'"').join(', '), 'Pulse average: '+avg,
        'Notes: '+rat.filter(x=>x.note).slice(-5).map(x=>'"'+x.note+'"').join(' | ')];
      if (!sb || !user) return;
      const {error} = await sb.from('desk_items').insert({kind:'request', data:{kind:'Update', biz:'Test app: feedback summary', when:'Whenever', text:lines.join('\n'), status:'New', reply:'', by:user.email||'', source:'test-app-review'}});
      toast(error ? 'Could not send ('+(error.code||error.message)+')' : 'Summary sent to the desk');
    });
    const optin = h('input',{type:'checkbox',checked:S.optin===true});
    optin.addEventListener('change',()=>{ S.optin = optin.checked; save(); toast(optin.checked?'Sharing on for this device':'Sharing off for this device'); });
    v.append(h('div',{class:'card soft'}, h('h3',null,'Privacy'), h('label',{class:'row small'},optin,'Share my own ratings and notes anonymously (this device)'),
      h('p',{class:'small'},'Signals never include who sent them. Notes are scrubbed of names and numbers. Ratings never train anything automatically; a reviewer decides what to change.'), sumBtn));
  };

  // ---------- What-if library and Company procedures (data in ../data/scenarios) ----------
  // Scenarios are plain JSON so other apps, states and companies can load them. See data/scenarios/README.md.
  let LIB = null, LIBERR = '';
  function loadLib(){
    if (LIB) return Promise.resolve(LIB);
    return fetch('../data/scenarios/wi.json',{cache:'no-cache'}).then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(j => (LIB = j)).catch(e => { LIBERR = 'Could not load the scenario library ('+e.message+').'; return null; });
  }
  const STATUS = {verified:['Verified','calm'], unverified:['Unverified','amber'], open:['Open question','red'], house:['House procedure','grey'], org:['Your company','grey']};
  const statusChip = s => { const x = STATUS[s] || [s,'grey']; return h('span',{class:'chip '+x[1]},x[0]); };
  const LAYER_ORDER = ['federal','state','county','city','payer','org','house'];
  const LAYER_NAME = {federal:'Federal',state:'State (Wisconsin)',county:'County',city:'City or town',payer:'Funding source (MCO)',org:'Your company',house:'House'};
  const roleFor = () => ({caregiver:'caregiver', family:'caregiver', manager:'manager', rn:'manager', owner:'owner', multi:'owner'}[S.tier] || 'caregiver');
  const inSetting = x => setting() === 'home' || !x.settings || x.settings.includes(setting());
  const baseHours = x => x.hours != null ? x.hours : x.business_days != null ? x.business_days * 24 : null;
  const orgFor = id => (S.orgProcs || []).filter(p => p.scenario_id === id && p.site === S.site);

  // Compare a company's procedure with the legal baseline. Code, not AI, makes this call.
  const RISKY = [
    {re:/(permission|ok|okay|approval).{0,40}before.{0,20}(911|ambulance|ems)|before calling 911/i, why:'Could delay emergency care. Call 911 first, then the guardian.'},
    {re:/do not call 911|don't call 911|never call 911/i, why:'A blanket no-911 rule can conflict with resident safety. Limit it to valid DNR or hospice plans.'},
    {re:/(wait|hold).{0,30}(until|till).{0,15}(morning|monday|next shift).{0,40}(report|abuse|neglect|missing)/i, why:'Some reports run on an immediate or 24-hour clock.'},
    {re:/(must|have to|required to).{0,30}(ask|tell|get approval from).{0,30}(manager|owner|supervisor).{0,40}before.{0,30}(report|calling)/i, why:'Anyone may report abuse directly. Approval steps cannot block a mandated or good-faith report (Wis. Stat. 46.90(4)).'},
    {re:/(lock|restrain|tie|hold down|seclude)/i, why:'Restraint and seclusion are limited by DHS 88.10(3)(n) and DHS 83. Check this step.'}
  ];
  function compareProc(sc, proc){
    const flags = [];
    const base = sc.notify.filter(x => x.required && x.layer !== 'house' && inSetting(x));
    (proc.notify || []).forEach(o => {
      const b = base.filter(x => x.key === o.key && baseHours(x) != null);
      if (!b.length || o.within_hours == null || o.within_hours === '') return;
      const strict = Math.min(...b.map(baseHours));
      const oh = Number(o.within_hours);
      if (oh > strict) flags.push({kind:'below', text:'Tells '+(D_KEY(o.key))+(oh===0?' immediately':' within '+oh+' h')+'; the rule says '+b.find(x=>baseHours(x)===strict).clock+' ('+b.find(x=>baseHours(x)===strict).cite+').'});
      else flags.push({kind:'ok', text:(D_KEY(o.key))+': '+oh+' h meets or beats the baseline.'});
    });
    const keys = new Set((proc.notify || []).map(o => o.key));
    base.forEach(x => { if (!keys.has(x.key) && x.status !== 'house') flags.push({kind:'missing', text:'Not mentioned: '+x.who+' ('+x.clock+'). The law still applies.'}); });
    const txt = (proc.steps || []).join(' ');
    RISKY.forEach(r => { if (r.re.test(txt)) flags.push({kind:'below', text:r.why}); });
    return flags;
  }
  const D_KEY = k => (LIB && LIB.notify_keys[k]) || k;
  function flagBox(flags){
    if (!flags.length) return null;
    const below = flags.filter(f => f.kind === 'below'), miss = flags.filter(f => f.kind === 'missing');
    return h('div',{class:'house '+(below.length ? 'gap' : 'ok')},
      h('b',null, below.length ? below.length+' place'+(below.length>1?'s':'')+' where this falls below the legal baseline' : miss.length ? 'Nothing slower than the law. It leaves out:' : 'Meets the legal baseline'),
      below.map(f => h('span',null,'• '+f.text)), miss.map(f => h('span',{class:'small'},'○ '+f.text)));
  }

  function scenarioCard(sc){
    const role = {v: roleFor()};
    const c = h('div',{class:'card'+(sc.level==='now'?' alert':'')});
    c.append(h('div',{class:'chips'}, levelBadge(sc.level), h('span',{class:'chip grey'},sc.category), h('span',{class:'chip grey'},sc.id), h('span',{class:'chip grey'},'Checked '+fmtDate(sc.checked))));
    c.append(h('h2',null,sc.title));
    (sc.triage || []).forEach(t => {
      const out = h('div');
      const yes = () => { out.textContent=''; if (LIB.scenarios.some(s=>s.id===t.yes)) location.hash = '#/whatif/'+t.yes; else out.append(h('div',{class:'row'},levelBadge(t.yes), t.yes==='now' ? h('a',{class:'btn red sm',href:'tel:911'},'Call 911') : null)); };
      const no = () => { out.textContent=''; if (LIB.scenarios.some(s=>s.id===t.no)) location.hash = '#/whatif/'+t.no; else out.append(h('div',{class:'row'},levelBadge(t.no), h('span',{class:'small'},'Keep going below.'))); };
      c.append(h('div',{class:'card soft'}, h('b',null,'First: '+t.ask), h('div',{class:'row'}, h('button',{class:'btn sm '+(t.yes==='now'?'red':''),type:'button',onclick:yes},'Yes'), h('button',{class:'btn ghost sm',type:'button',onclick:no},'No')), out));
    });
    const stepsBox = h('div');
    const tabs = h('div',{class:'chips'});
    const ROLES = [['caregiver','Caregiver'],['manager','Manager'],['owner','Owner']].filter(r => sc.roles[r[0]]);
    function drawSteps(){
      tabs.textContent=''; ROLES.forEach(r => tabs.append(h('button',{class:'chip',type:'button','aria-pressed':String(role.v===r[0]),onclick:()=>{role.v=r[0];drawSteps();}},r[1])));
      stepsBox.textContent='';
      stepsBox.append(h('ol',{class:'steps'}, (sc.roles[role.v]||[]).map(s => h('li',null,h('span',null,s)))));
      orgFor(sc.id).filter(p => !p.role || p.role === role.v).forEach(p => {
        stepsBox.append(h('div',{class:'house'}, h('b',null,'Your company\'s procedure'+(p.source?' ('+p.source+')':'')), (p.steps||[]).map(s => h('span',null,'• '+s))), flagBox(compareProc(sc,p)));
      });
    }
    if (!sc.roles[role.v]) role.v = ROLES[0][0];
    drawSteps();
    c.append(h('h3',null,'What to do'), tabs, stepsBox);
    const rows = sc.notify.filter(inSetting);
    if (rows.length) c.append(h('h3',null,'Who to tell, and by when'), h('div',{class:'tablewrap'}, h('table',{class:'t'},
      h('thead',null,h('tr',null,['Who','When','Rule','Status'].map(x=>h('th',null,x)))),
      h('tbody',null, rows.map(x => h('tr',null, h('td',null,x.who), h('td',null,x.clock), h('td',{class:'small'},x.cite), h('td',null,statusChip(x.status))))))));
    if (sc.document && sc.document.length) c.append(h('h3',null,'Write down'), h('ul',null, sc.document.map(d=>h('li',null,d))));
    if (sc.wording) c.append(h('h3',null,'Say it professionally'), h('div',{class:'grid g2'},
      h('div',{class:'card soft',style:'box-shadow:none'},h('span',{class:'small muted'},'Casual'),h('span',null,'"'+sc.wording.casual+'"')),
      h('div',{class:'card calm',style:'box-shadow:none'},h('span',{class:'small muted'},'Report'),h('span',null,sc.wording.professional))));
    const legal = sc.legal.filter(inSetting).sort((a,b)=>LAYER_ORDER.indexOf(a.layer)-LAYER_ORDER.indexOf(b.layer));
    c.append(h('details',null, h('summary',{style:'cursor:pointer;font-weight:700'},'Why: the rules, federal to local ('+legal.length+')'),
      h('div',{class:'list',style:'margin-top:.5rem'}, legal.map(l => h('div',{class:'item'}, h('div',{class:'meta'},h('b',null,LAYER_NAME[l.layer]||l.layer),statusChip(l.status), l.source && LIB.sources[l.source] ? h('a',{href:LIB.sources[l.source].url,target:'_blank',rel:'noopener'},'source') : null), h('span',{class:'small'},h('b',null,l.cite+': '),l.says))))));
    if (sc.clarity) c.append(h('div',{class:'card soft'}, h('div',{class:'chips'},labelChip(sc.clarity.label),h('span',{class:'chip grey'},'Clarity Card')), h('b',null,sc.clarity.q), h('span',null,sc.clarity.a)));
    c.append(h('div',{class:'row noprint'}, h('a',{class:'btn ghost sm',href:'#/report'},'Write it up'), h('a',{class:'btn ghost sm',href:'#/ask'},'Ask the Regulator')));
    c.append(rateBar('whatif', sc.id, sc.title));
    c.append(h('p',{class:'foot'},LIB.disclaimer));
    return c;
  }

  R.whatif = v => {
    v.append(head('What-if library', 'What do I do if...?', 'Steps for your role, who to tell and by when, and the rule behind it. Showing '+D.SETTINGS[setting()].name+'.'));
    const area = h('div',{class:'grid'}); v.append(area);
    area.append(h('p',{class:'muted'},'Loading...'));
    loadLib().then(lib => {
      area.textContent = '';
      if (!lib){ area.append(h('div',{class:'card alert'},LIBERR)); return; }
      if (param){ const sc = lib.scenarios.find(s => s.id === param); if (sc){ area.append(h('a',{href:'#/whatif'},'← All scenarios'), scenarioCard(sc)); return; } }
      const inp = h('input',{type:'search',placeholder:'Try "fall", "missing", "surveyor", "no-show"','aria-label':'Search scenarios'});
      const cats = ['All', ...new Set(lib.scenarios.map(s=>s.category))];
      let pick = 'All';
      const bar = h('div',{class:'chips'}), list = h('div',{class:'list'});
      function draw(){
        bar.textContent=''; cats.forEach(cn => bar.append(h('button',{class:'chip',type:'button','aria-pressed':String(cn===pick),onclick:()=>{pick=cn;draw();}},cn)));
        const q = inp.value.toLowerCase().trim();
        list.textContent='';
        lib.scenarios.filter(s => (pick==='All'||s.category===pick) && (!q || (s.title+' '+s.category+' '+(s.clarity?s.clarity.q:'')).toLowerCase().includes(q)) && (setting()==='home' || s.settings.includes(setting())))
          .forEach(s => list.append(h('a',{class:'item',href:'#/whatif/'+s.id,style:'text-decoration:none;color:inherit'}, h('div',{class:'meta'},levelBadge(s.level),h('span',null,s.category), orgFor(s.id).length ? h('span',{class:'chip grey'},'Company procedure added') : null), h('b',null,s.title))));
      }
      inp.addEventListener('input', draw);
      area.append(h('div',{class:'card'}, inp, bar), list);
      const counts = {}; lib.scenarios.forEach(s => [...s.notify,...s.legal].forEach(x => counts[x.status]=(counts[x.status]||0)+1));
      area.append(h('p',{class:'small muted'}, lib.scenarios.length+' scenarios. Rules checked '+fmtDate(lib.checked)+': '+(counts.verified||0)+' verified, '+(counts.unverified||0)+' unverified, '+(counts.open||0)+' open questions.'));
      draw();
    });
  };

  // ---- Company procedures: AI-assisted import, mapped onto the scenarios, checked against the baseline ----
  const PHI = [
    [/\b\d{3}[-. )]\s?\d{3}[-.]\d{4}\b/g,'[phone removed]'],
    [/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g,'[email removed]'],
    [/\b\d{3}-\d{2}-\d{4}\b/g,'[number removed]'],
    [/\b(dob|date of birth|born)\b[:\s]*\S+/gi,'[birth date removed]'],
    [/\b(password|passcode|pin|voicemail code)\b[:\s]*\S+/gi,'[secret removed]']
  ];
  function scrub(t){ let n = 0; PHI.forEach(([re,rep]) => { t = t.replace(re, () => { n++; return rep; }); }); return {text:t, removed:n}; }
  const HOURS = [[/immediately|right away|at once/i,0],[/next business day|next working day/i,24],[/within (\d+) hours?/i,m=>+m[1]],[/within (\d+) (working |business |calendar )?days?/i,m=>+m[1]*24],[/same day|same shift/i,8]];
  const KEYWORDS = {
    'WI-FALL-01':/fall.{0,40}(injur|hurt|head|hospital)/i, 'WI-FALL-02':/\bfall|fell\b/i, 'WI-INJ-01':/bruise|skin tear|unknown (source|cause)|unexplained injur/i,
    'WI-HLTH-01':/change (of|in) condition|seems sick|fever|vital|emergenc/i, 'WI-HLTH-02':/hospital|emergency room|\ber\b/i, 'WI-DEATH-01':/death|died|passed away|hospice/i,
    'WI-MED-01':/medication error|med error|wrong (dose|med)|missed dose/i, 'WI-MED-02':/refus.{0,20}med/i, 'WI-MISS-01':/missing|elope|wander|whereabouts/i,
    'WI-FIRE-01':/\bfire\b|evacuat|smoke (alarm|detector)/i, 'WI-BLDG-01':/power|outage|heat|weather|storm|utility/i, 'WI-POL-01':/police|law enforcement/i,
    'WI-ILL-01':/outbreak|infection|contagious|flu|covid|norovirus/i, 'WI-BEH-01':/resident.{0,20}(hit|strike|hurt).{0,20}resident|resident.to.resident/i,
    'WI-BEH-02':/aggress|assault.{0,20}staff|workplace violence/i, 'WI-RESTR-01':/restrain|seclusion|hold/i, 'WI-BEH-03':/suicid|self.harm|wants to die/i,
    'WI-ABUSE-01':/abuse|neglect|mistreat|misconduct/i, 'WI-ABUSE-02':/theft|stolen|missing (money|item|property)|misappropriat/i, 'WI-ABUSE-03':/exploit|family.{0,30}(harm|abuse)/i,
    'WI-STAFF-01':/\bcall.?ins?\b|called in sick|cannot work|no.?show|short.?staff|coverage|call.?off/i, 'WI-STAFF-02':/impair|intoxicat|drug test|arrest|charged|background/i,
    'WI-RIGHTS-01':/refus.{0,20}(care|shower|bath)/i, 'WI-RIGHTS-02':/guardian|power of attorney|poa/i, 'WI-COMP-01':/complain|grievance/i,
    'WI-DISCH-01':/discharge|terminat.{0,20}(stay|services|admission)|30.day notice/i, 'WI-SURV-01':/survey|inspect|dqa visit|state visit/i,
    'WI-MCO-01':/care manager|mco|inclusa|lakeland|my choice/i, 'WI-OMB-01':/ombudsman|advocate/i, 'WI-REC-01':/confidential|hipaa|release of information|records request/i
  };
  const WHO = [['911',/911|ambulance|ems/i],['police',/police|law enforcement|sheriff/i],['rep',/guardian|family|representative|poa/i],['physician',/physician|doctor|prescriber|md\b/i],['nurse',/nurse|rn\b/i],['mco',/care manager|mco|idt|care team|inclusa|lakeland/i],['dqa',/dqa|state|department/i],['licensing',/licensing/i],['manager',/manager|supervisor|on.call/i],['owner',/owner|administrator/i],['aps',/adult protective|\baps\b|elder abuse|county/i],['health',/health department/i]];
  function localMap(text, source){
    const paras = text.split(/\n\s*\n|\n(?=#|\d+\.|[A-Z][A-Za-z ]{3,40}:)/).map(p => p.trim()).filter(p => p.length > 30);
    const out = [];
    paras.forEach(p => {
      const ids = Object.keys(KEYWORDS).filter(id => KEYWORDS[id].test(p));
      if (!ids.length) return;
      const id = ids.find(x => /FALL-01|DEATH-02|ABUSE-0|MISS|RESTR/.test(x)) || ids[0];
      const notify = [];
      p.split(/(?<=[.;])\s+/).forEach(sent => {
        // Everyone named in the sentence, in order. The first one is dropped when it is the one doing the telling.
        let found = WHO.map(w => { const m = sent.match(w[1]); return m ? {key:w[0], at:m.index, end:m.index+m[0].length} : null; }).filter(Boolean).sort((x,y) => x.at - y.at);
        if (found.length > 1 && /^\s*(reports?|calls?|tells?|notif(y|ies)|emails?|contacts?|files?)\b/i.test(sent.slice(found[0].end))) found = found.slice(1);
        if (!found.length) return;
        let hrs = null; for (const [re,f] of HOURS){ const m = sent.match(re); if (m){ hrs = typeof f === 'function' ? f(m) : f; break; } }
        found.forEach(fd => {
          // In an AFH the licensing agency is usually the county (DHS 88.02(16)).
          const key = fd.key === 'aps' && /county/i.test(sent) && !/protective|aps\b/i.test(sent) && setting() === 'afh' ? 'licensing' : fd.key;
          if (!notify.some(n => n.key === key)) notify.push({key, within_hours:hrs, text:sent.slice(0,160)});
        });
      });
      out.push({scenario_id:id, role:'', steps:p.replace(/^[^\n.]{1,40}\n/,'').split(/(?<=[.;])\s+|\n/).map(s=>s.replace(/^[-*•\d.)\s]+/,'').trim()).filter(s=>s.length>3).slice(0,8), notify, source, confidence:'low', by:'keyword matcher'});
    });
    return out;
  }
  function parseCSV(t){
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < t.length; i++){ const ch = t[i];
      if (q){ if (ch === '"' && t[i+1] === '"'){ cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ','){ row.push(cur); cur=''; } else if (ch === '\n'){ row.push(cur); rows.push(row); row=[]; cur=''; } else if (ch !== '\r') cur += ch; }
    if (cur || row.length){ row.push(cur); rows.push(row); }
    const head = rows.shift().map(x => x.trim());
    const byKey = {};
    rows.filter(r => r.some(x => x.trim())).forEach(r => {
      const o = {}; head.forEach((k,i) => o[k] = (r[i]||'').trim());
      const k = o.scenario_id+'|'+(o.role||'');
      const p = byKey[k] = byKey[k] || {scenario_id:o.scenario_id, role:o.role, steps:[], notify:[], source:o.source_document||'CSV import', version:o.version, effective:o.effective_date, confidence:'high', by:'template'};
      if (o.step_text) p.steps.push(o.step_text);
      if (o.notify_key && !p.notify.some(n=>n.key===o.notify_key)) p.notify.push({key:o.notify_key, within_hours:o.notify_within_hours===''?null:Number(o.notify_within_hours)});
    });
    return Object.values(byKey);
  }
  let aiImport = null;
  async function aiAvailable(){
    if (aiImport !== null) return aiImport;
    if (!sb) return (aiImport = false);
    try { const {data, error} = await sb.functions.invoke('procedure-import',{body:{ping:true}}); aiImport = !error && data && data.ok; } catch(e){ aiImport = false; }
    return aiImport;
  }

  R.procedures = v => {
    v.append(head('Company procedures · '+site().name, 'Bring your own procedures', 'Saved only for '+site().name+'. Your procedures sit on top of the law, never under it. The app maps them to each what-if and flags any place where a step falls below the legal baseline.'));
    const area = h('div',{class:'grid'}); v.append(area);
    loadLib().then(async lib => {
      if (!lib){ area.append(h('div',{class:'card alert'},LIBERR)); return; }
      const ai = await aiAvailable();
      const name = h('input',{type:'text',placeholder:'Document name, for example "Employee handbook 2026"','aria-label':'Document name'});
      const txt = h('textarea',{style:'min-height:10rem',placeholder:'Paste a procedure, policy or handbook section. Leave out resident names, health details, phone numbers and passwords.'});
      const file = h('input',{type:'file',accept:'.txt,.md,.csv,.json,text/plain','aria-label':'Choose a text file to load'});
      file.addEventListener('change',()=>{ const f = file.files[0]; if (!f) return; if (!name.value) name.value = f.name; f.text().then(t => { txt.value = t.slice(0,60000); }); });
      const out = h('div',{class:'grid'});
      const go = h('button',{class:'btn',type:'button'}, ai ? 'Map it with AI' : 'Map it (keyword demo)');
      const sample = h('button',{class:'btn ghost sm',type:'button'},'Load a sample company handbook');
      sample.addEventListener('click',()=>{ fetch('../data/scenarios/org-procedures-sample.txt').then(r=>r.text()).then(t=>{ txt.value = t; name.value = 'Sample company handbook'; }); });
      go.addEventListener('click', async () => {
        out.textContent = '';
        const raw = txt.value.trim(); if (!raw){ toast('Paste or upload something first'); return; }
        let items = [];
        try {
          if (/^\s*[\[{]/.test(raw)){ const j = JSON.parse(raw); items = (j.procedures || j).map(p => Object.assign({confidence:'high', by:'template'}, p)); }
          else if (/^scenario_id,/i.test(raw)) items = parseCSV(raw);
          else {
            const s = scrub(raw);
            if (s.removed) out.append(h('div',{class:'house gap'},h('b',null,s.removed+' private detail'+(s.removed>1?'s were':' was')+' removed before mapping'),h('span',null,'Phone numbers, emails, ID numbers, birth dates and passwords stay on your device.')));
            if (ai){
              go.disabled = true; go.textContent = 'Reading your document...';
              const catalog = lib.scenarios.map(x => ({id:x.id, title:x.title, notify_keys:[...new Set(x.notify.map(n=>n.key))]}));
              const {data, error} = await sb.functions.invoke('procedure-import',{body:{text:s.text.slice(0,60000), source:name.value||'Pasted text', catalog, keys:lib.notify_keys}});
              go.disabled = false; go.textContent = 'Map it with AI';
              if (error || !data || data.error){ toast('AI mapping failed. Using the keyword demo.'); items = localMap(s.text, name.value||'Pasted text'); }
              else { items = data.procedures.map(p => Object.assign({by:'AI', source:name.value||'Pasted text'}, p)); if (data.unmapped && data.unmapped.length) out.append(h('div',{class:'house'},h('b',null,'Not matched to a scenario yet'),data.unmapped.slice(0,8).map(u=>h('span',{class:'small'},'• '+u)))); }
            } else items = localMap(s.text, name.value||'Pasted text');
          }
        } catch(e){ out.append(h('div',{class:'card alert'},'Could not read that: '+e.message)); return; }
        if (!items.length){ out.append(h('p',{class:'muted'},'Nothing matched a scenario. Try a longer section with headings.')); return; }
        out.append(h('h2',null,'Review before saving ('+items.length+')'), h('p',{class:'small muted'},'Check each match. Change the scenario if it picked the wrong one. Nothing is saved until you press Save.'));
        items.forEach(p => {
          const sel = h('select',{'aria-label':'Scenario'}, lib.scenarios.map(x => h('option',{value:x.id,selected:x.id===p.scenario_id},x.id+' '+x.title)));
          const box = h('div');
          const draw = () => { p.scenario_id = sel.value; box.textContent=''; const sc = lib.scenarios.find(x=>x.id===p.scenario_id); if (sc) box.append(flagBox(compareProc(sc,p)) || h('span',{class:'small muted'},'No timing found to compare.')); };
          sel.addEventListener('change', draw); draw();
          out.append(h('div',{class:'card'}, h('div',{class:'chips'}, h('span',{class:'chip grey'},'Mapped by '+(p.by||'import')), h('span',{class:'chip '+(p.confidence==='high'?'calm':p.confidence==='medium'?'amber':'grey')},'Confidence: '+(p.confidence||'n/a'))),
            h('label',{class:'f'},'Scenario',sel),
            h('ul',null,(p.steps||[]).map(s=>h('li',null,s))),
            (p.notify||[]).length ? h('p',{class:'small'},'Tells: '+p.notify.map(n => D_KEY(n.key)+(n.within_hours===0?' immediately':n.within_hours!=null?' within '+n.within_hours+' h':'')).join('; ')) : null,
            box));
        });
        const save = h('button',{class:'btn',type:'button'},'Save to my company layer');
        save.addEventListener('click',()=>{ S.orgProcs = (S.orgProcs||[]).filter(x => x.site !== S.site || !items.some(i => i.scenario_id===x.scenario_id && (i.role||'')===(x.role||''))).concat(items.map(i => Object.assign({}, i, {site:S.site, saved:new Date().toISOString()}))); save2(); toast('Saved. Open any what-if to see it.'); route(); });
        out.append(h('div',{class:'row'}, save));
      });
      area.append(h('div',{class:'card'},
        h('h2',null,'1. Add your document'),
        h('p',{class:'small'}, ai ? 'AI reads the text and maps each procedure to a what-if. Private details are removed on your device first. Rule checks are done by the app, not the AI.' : 'AI mapping is not switched on yet, so this uses a simple keyword matcher. Structured files (the CSV or JSON template) import exactly.'),
        h('label',{class:'f'},'Name',name), txt, h('div',{class:'row'}, file, sample),
        h('div',{class:'row'}, go, h('a',{class:'btn ghost sm',href:'../data/scenarios/org-procedures-template.csv',download:''},'CSV template'), h('a',{class:'btn ghost sm',href:'../data/scenarios/org-procedures-template.json',download:''},'JSON template'))), out);
      const mine = (S.orgProcs || []).filter(p => p.site === S.site);
      area.append(h('div',{class:'card'}, h('h2',null,'2. Your company layer ('+mine.length+')'),
        mine.length ? h('div',{class:'list'}, mine.map(p => { const sc = lib.scenarios.find(x=>x.id===p.scenario_id); const fl = sc ? compareProc(sc,p).filter(f=>f.kind==='below').length : 0;
          return h('a',{class:'item',href:'#/whatif/'+p.scenario_id,style:'text-decoration:none;color:inherit'}, h('div',{class:'meta'}, h('span',null,p.source||''), fl ? h('span',{class:'chip amber'},fl+' below baseline') : h('span',{class:'chip calm'},'OK')), h('b',null, sc ? sc.title : p.scenario_id)); }))
        : h('p',{class:'muted small'},'Nothing yet. Import a document above.'),
        mine.length ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ S.orgProcs = (S.orgProcs||[]).filter(p => p.site !== S.site); save2(); route(); }},'Clear this home\'s layer') : null));
    });
  };
  const save2 = () => save();

  // ---------- Facility setup and "Ask our policy": each home's own documents, kept apart ----------
  // Tenant rule: every read and write below goes through fac(S.site). Nothing searches another home's documents.
  // In this test version the documents live only in this browser. Production: per-facility rows with row-level security.
  const fac = id => { S.facility = S.facility || {}; return S.facility[id] || (S.facility[id] = {profile:{}, docs:[]}); };
  const SAMPLES = {
    maple:[{file:'../data/samples/maple-grove-house-manual.pdf', name:'Maple Grove House Manual (sample).pdf'}],
    birch:[{file:'../data/samples/birch-hollow-policies.docx', name:'Birch Hollow Policies (sample).docx'}],
    cedar:[], family:[]
  };
  function loadScript(src){ return new Promise((ok, no) => { if (document.querySelector('script[src="'+src+'"]')) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('could not load '+src)); document.head.append(s); }); }
  async function readFile(name, buf){
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf'){
      await loadScript('vendor/pdf.min.js');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
      const pdf = await window.pdfjsLib.getDocument({data:new Uint8Array(buf), isEvalSupported:false}).promise;
      const pages = [];
      for (let i = 1; i <= Math.min(pdf.numPages, 150); i++){
        const c = await (await pdf.getPage(i)).getTextContent();
        let line = '', out = [], lastY = null;
        c.items.forEach(it => { const y = it.transform[5]; if (lastY !== null && Math.abs(y - lastY) > 2){ out.push(line); line = ''; } line += it.str; lastY = y; if (it.hasEOL){ out.push(line); line = ''; lastY = null; } });
        out.push(line); pages.push({page:i, text:out.join('\n')});
      }
      return pages;
    }
    if (ext === 'docx'){
      await loadScript('vendor/mammoth.browser.min.js');
      const r = await window.mammoth.extractRawText({arrayBuffer:buf});
      return [{page:null, text:r.value}];
    }
    if (['txt','md','csv'].includes(ext)) return [{page:null, text:new TextDecoder().decode(buf)}];
    throw new Error('Use PDF, Word (.docx), or a text file. For a Google Doc: File > Download > Microsoft Word or PDF.');
  }
  // Split into short, citable passages under their headings.
  function chunk(pages, docId){
    const out = []; let head = '', buf = [], page = null, n = 0;
    const flush = () => { const t = buf.join(' ').replace(/\s+/g,' ').trim(); if (t.length > 25) out.push({id:docId+'-'+(++n), heading:head, page, text:t.slice(0,1200)}); buf = []; };
    const isHead = l => l.length < 70 && !/[.,;]$/.test(l) && (/^(\d+(\.\d+)*[.)]?\s+)?[A-Z][^a-z]{0,3}/.test(l) || /:$/.test(l)) && l.split(' ').length <= 9;
    pages.forEach(p => {
      p.text.split(/\n/).map(l => l.trim()).forEach(l => {
        if (!l){ if (buf.join(' ').length > 500) flush(); return; }
        if (isHead(l)){ flush(); head = l.replace(/:$/,''); page = p.page; return; }
        if (!buf.length) page = p.page;
        buf.push(l); if (buf.join(' ').length > 900) flush();
      });
      flush();
    });
    return out;
  }
  async function addDoc(name, buf){
    const f = fac(S.site);
    const id = 'D'+(f.docs.length+1)+uid().slice(0,3);
    const pages = await readFile(name, buf);
    let removed = 0;
    pages.forEach(p => { const s = scrub(p.text); p.text = s.text; removed += s.removed; });
    const chunks = chunk(pages, id);
    if (!chunks.length) throw new Error('No readable text found. If it is a scanned PDF, it needs text recognition first.');
    const doc = {id, name:name.slice(0,120), added:new Date().toISOString(), site:S.site, chunks, removed};
    f.docs = f.docs.filter(d => d.name !== doc.name).concat(doc);
    save();
    return doc;
  }
  // Map a home's documents onto the what-if library, as its own company layer.
  async function mapDocs(lib){
    const f = fac(S.site), ai = await aiAvailable();
    let items = [];
    for (const d of f.docs){
      const text = d.chunks.map(c => (c.heading ? c.heading+'\n' : '')+c.text).join('\n\n');
      let got = null;
      if (ai){
        try {
          const catalog = lib.scenarios.map(x => ({id:x.id, title:x.title, notify_keys:[...new Set(x.notify.map(n=>n.key))]}));
          const {data, error} = await sb.functions.invoke('procedure-import',{body:{text:text.slice(0,60000), source:d.name, catalog, keys:lib.notify_keys}});
          if (!error && data && data.procedures) got = data.procedures.map(p => Object.assign({by:'AI'}, p));
        } catch(e){}
      }
      if (!got) got = localMap(text, d.name);
      items = items.concat(got.map(p => Object.assign(p, {source:d.name, doc:d.id, site:S.site})));
    }
    S.orgProcs = (S.orgProcs||[]).filter(p => p.site !== S.site).concat(items.map(i => Object.assign({}, i, {saved:new Date().toISOString()})));
    f.mapped = new Date().toISOString(); save();
    return items;
  }
  const RIGHTS = [
    {re:/visit(or|ors|ing)?\b.{0,40}\b(hours?|only|between|until|before|after|not allowed|must leave)/i, why:'Visiting limits: residents may have visitors (DHS 88.10(3)(t); HCBS Settings Rule). A limit needs to be in that person\'s plan.'},
    {re:/\b(curfew|lights out|bedtime is|must be in bed)/i, why:'Set bedtimes or curfews limit schedule choice (HCBS Settings Rule). Make it optional or plan-specific.'},
    {re:/\bno (food|snacks?|eating)\b.{0,30}\b(after|before|between|in (their|the) rooms?)/i, why:'Residents have access to food at any time under the HCBS Settings Rule, unless their plan says otherwise.'},
    {re:/\b(phone|cell ?phones?)\b.{0,30}\b(not allowed|collected|only (in|at))/i, why:'Residents have a right to private phone use (DHS 88.10(3)(s)).'}
  ];

  // Search one home's passages. Never takes a site from anywhere but the argument.
  const SYN = {fell:'fall', falls:'fall', falling:'fall', elope:'missing', wander:'missing', wandering:'missing', eloped:'missing', lost:'missing', med:'medication', meds:'medication', medications:'medication', pills:'medication', visitor:'visit', visitors:'visit', visiting:'visit', visits:'visit', abused:'abuse', neglected:'neglect', hurt:'injury', injured:'injury', injuries:'injury', refuses:'refuse', refused:'refuse', refusal:'refuse', refusals:'refuse', drills:'drill', fires:'fire', er:'hospital', hospitalized:'hospital', shower:'bath', showers:'bath', bathing:'bath', died:'death', dies:'death', dead:'death', complaint:'complain', complaints:'complain', grievance:'complain', call:'call', calls:'call', callin:'callin'};
  const terms = t => t.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)).map(w => SYN[w] || w.replace(/(ing|ed|es|s)$/,'') ).filter(w => w.length > 2);
  function searchPassages(site, q, k){
    const docs = fac(site).docs || [], qs = [...new Set(terms(q))];
    const all = []; docs.forEach(d => d.chunks.forEach(c => all.push({d, c, t:terms(c.heading+' '+c.heading+' '+c.text)})));
    if (!all.length || !qs.length) return [];
    const df = {}; qs.forEach(w => df[w] = all.filter(x => x.t.includes(w)).length);
    return all.map(x => { let s = 0, hit = 0; qs.forEach(w => { const tf = x.t.filter(y => y === w).length; if (tf){ hit++; s += (1+Math.log(tf)) * Math.log(1 + all.length/(df[w]||1)); } }); return {d:x.d, c:x.c, s, hit}; })
      .filter(x => x.hit >= Math.min(2, qs.length)).sort((a,b) => b.s - a.s).slice(0, k||3);
  }
  function searchLaw(lib, q){
    const qs = [...new Set(terms(q))]; if (!qs.length) return null;
    const docs = lib.scenarios.filter(s => setting()==='home' || s.settings.includes(setting())).map(s => ({kind:'scenario', s, t:terms([s.title, s.title, s.category, s.clarity ? s.clarity.q : ''].join(' ')), body:terms(Object.values(s.roles).flat().join(' '))}))
      .concat(D.RULES.map(r => ({kind:'rule', r, t:terms(r.q+' '+r.q+' '+r.keys+' '+r.topic), body:[]})));
    const df = {}; qs.forEach(w => df[w] = docs.filter(d => d.t.includes(w) || d.body.includes(w)).length || 1);
    const scored = docs.map(d => { let n = d.kind === 'scenario' && KEYWORDS[d.s.id] && KEYWORDS[d.s.id].test(q) ? 3 : 0, hit = n ? 1 : 0; qs.forEach(w => { const idf = Math.log(1 + docs.length/df[w]); if (d.t.includes(w)){ n += 2*idf; hit++; } else if (d.body.includes(w)){ n += 0.5*idf; hit++; } }); return Object.assign(d, {n, hit}); })
      .filter(d => d.hit).sort((a,b) => b.n - a.n);
    return scored[0] && scored[0].n >= 2 ? scored[0] : null;
  }
  let aiAsk = null;
  async function askAvailable(){
    if (aiAsk !== null) return aiAsk;
    if (!sb) return (aiAsk = false);
    try { const {data, error} = await sb.functions.invoke('facility-ask',{body:{ping:true}}); aiAsk = !error && data && data.ok; } catch(e){ aiAsk = false; }
    return aiAsk;
  }
  function cite(d, c){ return d.name+(c.heading?' · '+c.heading:'')+(c.page?' · p. '+c.page:''); }
  async function answer(lib, q, out){
    const sid = S.site, home = site().name;
    out.textContent = '';
    const law = searchLaw(lib, q), hits = searchPassages(sid, q, 3), docs = fac(sid).docs;
    const card = h('div',{class:'card'});
    card.append(h('h2',null,q));
    // 1. The law first.
    const lawBox = h('div',{class:'card soft',style:'box-shadow:none'}, h('div',{class:'chips'}, h('span',{class:'chip calm'},'1 · The law'), h('span',{class:'chip grey'},D.SETTINGS[setting()].name)));
    let sc = null;
    if (law && law.kind === 'scenario'){
      sc = law.s;
      lawBox.append(h('b',null,sc.clarity ? sc.clarity.q : sc.title), h('span',null, sc.clarity ? sc.clarity.a : ''));
      const rows = sc.notify.filter(x => x.required && x.layer !== 'house' && inSetting(x));
      if (rows.length) lawBox.append(h('ul',{class:'small'}, rows.map(x => h('li',null, x.who+': '+x.clock+' ', h('span',{class:'muted'},'('+x.cite+') '), statusChip(x.status)))));
      lawBox.append(h('a',{href:'#/whatif/'+sc.id,class:'small'},'Open the full what-if: '+sc.title));
    } else if (law && law.kind === 'rule'){
      const a = law.r[setting()] || law.r.afh;
      lawBox.append(h('b',null,law.r.q), h('span',null,a.a), h('span',{class:'small muted'},'Source: '+a.cite), labelChip(law.r.label));
    } else lawBox.append(h('span',null,'No state or local rule in our library matches this question. '), h('a',{href:'#/ask'},'Draft a question for the regulator'));
    card.append(lawBox);
    // 2. The home's own policy, quoted with its source. No source, no answer.
    const polBox = h('div',{class:'card',style:'box-shadow:none'}, h('div',{class:'chips'}, h('span',{class:'chip'},'2 · '+home+'\'s policy')));
    let aiUsed = false;
    if (!docs.length){
      polBox.append(h('b',null,'No documents uploaded for '+home+' yet.'), h('a',{href:'#/setup'},'Set up this home\'s documents'));
    } else if (!hits.length){
      polBox.append(h('b',null,'Not covered by your policy.'), h('span',{class:'small'},'We searched '+docs.length+' document'+(docs.length>1?'s':'')+' for '+home+' and found nothing on this. Follow the law above, and consider adding a procedure.'));
    } else {
      if (await askAvailable()){
        try {
          const passages = hits.map(x => ({id:x.c.id, source:cite(x.d,x.c), text:x.c.text}));
          const lawText = sc ? [{id:'LAW', source:sc.id, text:(sc.clarity?sc.clarity.a+' ':'')+sc.notify.filter(inSetting).map(x=>x.who+': '+x.clock+' ('+x.cite+')').join('; ')}] : [];
          const {data, error} = await sb.functions.invoke('facility-ask',{body:{question:q, facility:sid, passages, law:lawText}});
          if (!error && data && Array.isArray(data.policy)){
            aiUsed = true;
            if (data.not_covered || !data.policy.length) polBox.append(h('b',null,'Not covered by your policy.'), h('span',{class:'small'},'The closest passages did not answer this question.'));
            else data.policy.forEach(p => { const x = hits.find(y => y.c.id === p.source_id); if (x) polBox.append(h('p',null,p.text,' ',h('span',{class:'chip grey'},cite(x.d,x.c)))); });
          }
        } catch(e){}
      }
      if (!aiUsed) hits.forEach(x => polBox.append(h('blockquote',{style:'margin:0;border-left:3px solid var(--line-strong);padding:.2rem .8rem'}, x.c.text.length > 420 ? x.c.text.slice(0,420)+'…' : x.c.text), h('span',{class:'small muted'},'From: '+cite(x.d,x.c))));
    }
    card.append(polBox);
    // 3. Conflicts, checked in code against the law.
    if (hits.length){
      const flags = [];
      hits.forEach(x => {
        RIGHTS.forEach(r => { if (r.re.test(x.c.text)) flags.push({kind:'below', text:r.why+' ('+cite(x.d,x.c)+')'}); });
        if (sc){ const m = localMap(x.c.text+'\n\n', x.d.name)[0] || {notify:[], steps:[x.c.text]}; m.steps = m.steps && m.steps.length ? m.steps : [x.c.text];
          compareProc(sc, m).filter(f => f.kind !== 'ok').forEach(f => flags.push({kind:f.kind, text:f.text+(f.kind==='below'?' ('+cite(x.d,x.c)+')':'')})); }
      });
      const uniq = [...new Map(flags.map(f => [f.text, f])).values()], below = uniq.filter(f => f.kind === 'below'), miss = uniq.filter(f => f.kind === 'missing');
      card.append(h('div',{class:'house '+(below.length?'gap':'ok')}, h('b',null, below.length ? '3 · Conflict: follow the law where your policy is weaker' : '3 · No conflict found between your policy and the law'), below.map(f => h('span',null,'• '+f.text)),
        miss.length ? h('span',{class:'small'},'Your policy doesn\'t mention these, and the law still applies:') : null, miss.slice(0,5).map(f => h('span',{class:'small'},'○ '+f.text.replace(/^Not mentioned: /,'').replace(/ The law still applies\.$/,'')))));
    }
    card.append(h('p',{class:'foot'},'Searched only '+home+'\'s '+docs.length+' document'+(docs.length===1?'':'s')+' and the Wisconsin rule library. Other homes\' documents are never searched. '+(aiUsed?'Wording by AI, limited to the quoted passages. ':'')+'Not legal advice.'));
    out.append(card);
    S.questions.push({q, id:law && law.kind==='rule' ? law.r.id : null, site:sid, tier:S.tier, at:new Date().toISOString(), shift:shiftName(), covered:!!hits.length}); save();
  }

  R.askpolicy = v => {
    v.append(head('Ask our policy', 'What does '+site().name+' say?', 'Answers show the law first, then this home\'s own policy with its source, and flag any conflict.'));
    const area = h('div',{class:'grid'}); v.append(area);
    loadLib().then(lib => {
      if (!lib){ area.append(h('div',{class:'card alert'},LIBERR)); return; }
      const inp = h('input',{type:'search',placeholder:'Try "visitors", "resident fell", "missing resident", "med refusal"','aria-label':'Your question'});
      const out = h('div');
      const f = h('form',{class:'card'}, h('label',{class:'f'},'Your question',inp), h('div',{class:'row'}, h('button',{class:'btn',type:'submit'},'Ask'), h('span',{class:'small muted'}, fac(S.site).docs.length+' document'+(fac(S.site).docs.length===1?'':'s')+' on file for this home')));
      f.addEventListener('submit', e => { e.preventDefault(); if (inp.value.trim()) answer(lib, inp.value.trim(), out); });
      area.append(f, out);
      if (param){ inp.value = param; answer(lib, param, out); }
      inp.focus();
    });
  };

  R.setup = v => {
    const f = fac(S.site), s = site();
    v.append(head('Facility setup', 'Set up '+s.name, 'Each home gets its own setup. Documents you add here are used only for '+s.name+'.'));
    const area = h('div',{class:'grid'}); v.append(area);
    loadLib().then(lib => {
      if (!lib){ area.append(h('div',{class:'card alert'},LIBERR)); return; }
      const p = f.profile;
      const done = [!!p.county, f.docs.length > 0, !!f.mapped];
      area.append(h('div',{class:'card soft'}, h('b',null, done.filter(Boolean).length+' of 3 steps done'),
        h('span',{class:'small'},'Test version: use the sample documents or your own made-up files. Do not upload real resident information.')));
      // Step 1: profile
      const county = h('input',{type:'text',value:p.county||'','aria-label':'County',list:'wiCounties',autocomplete:'off'}), city = h('input',{type:'text',value:p.city||'','aria-label':'City or town'});
      const aps = h('input',{type:'text',value:p.aps||'','aria-label':'Adult protective services number',placeholder:'County intake number'});
      const lic = h('select',{'aria-label':'Who licensed this home'}, h('option',{value:'dqa',selected:p.licensor!=='county'},'DQA regional office (most homes)'), h('option',{value:'county',selected:p.licensor==='county'},'A county agency'));
      const pay = ['Family Care (MCO)','IRIS','Private pay','Other county or VA'];
      const payBoxes = pay.map(x => { const cb = h('input',{type:'checkbox',checked:(p.pay||[]).includes(x)}); cb.dataset.v = x; return h('label',{class:'row small'},cb,x); });
      const s1 = h('form',{class:'card'}, h('h2',null,'1. About this home'),
        h('p',{class:'small muted'},D.SETTINGS[s.setting].name+'. County and city decide which local rules apply.'),
        h('div',{class:'grid g2'}, h('label',{class:'f'},'County',county), h('label',{class:'f'},'City or town',city)),
        h('label',{class:'f'},'County adult protective services number',aps),
        s.setting === 'afh' ? h('label',{class:'f'},'Who licensed this home? (see your license)',lic) : null,
        h('fieldset',{style:'border:0;padding:0;margin:0'}, h('legend',{class:'small'},'Funding sources'), payBoxes),
        h('div',{class:'row'}, h('button',{class:'btn sm',type:'submit'},'Save')));
      s1.addEventListener('submit', e => { e.preventDefault(); f.profile = {county:county.value.trim(), city:city.value.trim(), aps:aps.value.trim(), licensor:lic.value, pay:payBoxes.map(l => l.querySelector('input')).filter(c => c.checked).map(c => c.dataset.v)}; save(); toast('Saved for '+s.name); route(); });
      area.append(s1);
      // Step 2: documents
      const file = h('input',{type:'file',multiple:true,accept:'.pdf,.docx,.txt,.md','aria-label':'Choose documents'});
      const status = h('div',{class:'list'});
      async function take(list){
        for (const it of list){
          const line = h('div',{class:'item small'},'Reading '+it.name+'...'); status.append(line);
          try { const d = await addDoc(it.name, it.buf); line.textContent = '✓ '+d.name+': '+d.chunks.length+' passages'+(d.removed?', '+d.removed+' private details removed':''); }
          catch(e){ line.textContent = '✗ '+it.name+': '+e.message; }
        }
        setTimeout(route, 900);
      }
      file.addEventListener('change', async () => { const list = []; for (const x of file.files){ if (x.size > 15e6){ toast(x.name+' is over 15 MB'); continue; } list.push({name:x.name, buf:await x.arrayBuffer()}); } take(list); });
      const samples = SAMPLES[S.site] || [];
      const sampleBtn = samples.length ? h('button',{class:'btn ghost sm',type:'button',onclick:async()=>{ const list = []; for (const x of samples){ const r = await fetch(x.file); list.push({name:x.name, buf:await r.arrayBuffer()}); } take(list); }},'Add this home\'s sample document') : h('span',{class:'small muted'},'No sample for this home. Try Maple Grove (AFH) or Birch Hollow (CBRF).');
      area.append(h('div',{class:'card'}, h('h2',null,'2. Add this home\'s documents'),
        h('p',{class:'small'},'PDF, Word (.docx) or text. For a Google Doc: File > Download > Microsoft Word or PDF, then add it here. Phone numbers, emails, ID numbers, birth dates and passwords are removed on this device first.'),
        h('div',{class:'row'}, file, sampleBtn), status,
        f.docs.length ? h('div',{class:'list'}, f.docs.map(d => h('div',{class:'item'}, h('div',{class:'meta'}, h('span',null,d.chunks.length+' passages'), h('span',null,'added '+fmtDate(d.added))), h('b',null,d.name),
          h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ f.docs = f.docs.filter(x => x.id !== d.id); S.orgProcs = (S.orgProcs||[]).filter(x => x.doc !== d.id); save(); route(); }},'Remove')))) : null));
      // Step 3: map
      const mapBtn = h('button',{class:'btn',type:'button',disabled:!f.docs.length},'Build this home\'s procedure layer');
      const mapOut = h('div',{class:'list'});
      mapBtn.addEventListener('click', async () => {
        mapBtn.disabled = true; mapBtn.textContent = 'Reading your documents...';
        const items = await mapDocs(lib);
        mapBtn.disabled = false; mapBtn.textContent = 'Rebuild';
        mapOut.textContent = '';
        items.forEach(p => { const sc2 = lib.scenarios.find(x => x.id === p.scenario_id); if (!sc2) return; const fl = compareProc(sc2, p).filter(x => x.kind === 'below').length + (p.steps||[]).filter(t => RIGHTS.some(r => r.re.test(t))).length;
          mapOut.append(h('a',{class:'item',href:'#/whatif/'+sc2.id,style:'text-decoration:none;color:inherit'}, h('div',{class:'meta'}, h('span',null,p.source), fl ? h('span',{class:'chip amber'},fl+' conflict'+(fl>1?'s':'')+' with the law') : h('span',{class:'chip calm'},'No conflict found')), h('b',null,sc2.title))); });
        if (!items.length) mapOut.append(h('p',{class:'muted'},'No procedures matched a what-if. Add more detailed documents.'));
      });
      area.append(h('div',{class:'card'}, h('h2',null,'3. Build this home\'s procedure layer'),
        h('p',{class:'small'},'Each passage is matched to a what-if. The law stays on top: anything in your documents that is slower or weaker than the law is flagged, and staff see the law first.'),
        f.mapped ? h('p',{class:'small muted'},'Last built '+fmtTime(f.mapped)+'. '+(S.orgProcs||[]).filter(x=>x.site===S.site).length+' procedures in this home\'s layer.') : null,
        h('div',{class:'row'}, mapBtn, h('a',{class:'btn ghost sm',href:'#/procedures'},'Review procedures'), h('a',{class:'btn ghost sm',href:'#/askpolicy'},'Try Ask our policy')), mapOut));
    });
  };

  // ---------- "Ideas and fixes" chat: a guided helper that saves to the desk's Requests for Claude ----------
  // Uses the AI helper (Supabase Edge Function "app-chat") when it is set up; otherwise a scripted helper
  // asks short follow-ups and saves the conversation as one request.
  let sb = null, user = null;
  // ---- Outbox: everything meant for the desk is saved on this device first, then sent, and retried until the
  // desk has it. Nothing is shown as "sent" until the desk confirms it. Each item has a client id (cid), so a
  // note that grows (the chat's follow-up answers) updates its one row instead of adding new ones.
  const OBX = 'ss-outbox-v1';
  let obx = (() => { try { return JSON.parse(localStorage.getItem(OBX)) || {items:[], ids:{}}; } catch(e){ return {items:[], ids:{}}; } })();
  const obxWatch = {};
  let obxRun = null, obxErr = '';
  function obxSave(){ try { localStorage.setItem(OBX, JSON.stringify(obx)); } catch(e){} }
  function obxState(cid){ return obx.items.some(x => x.cid === cid) ? (obxErr ? 'error' : 'waiting') : (obx.ids[cid] ? 'sent' : 'none'); }
  function obxNotify(){
    Object.keys(obxWatch).forEach(cid => obxWatch[cid].forEach(f => f(obxState(cid))));
    const bar = $('outboxBar'), co = $('chatOutbox'); if (!bar) return;
    const n = obx.items.length; bar.hidden = !n; if (co) co.hidden = !n || !obxErr;
    if (n && co) co.textContent = '⚠ Not on the desk yet ('+obxErr+'). Your words are kept on this device and keep retrying.';
    if (n) $('outboxText').textContent = n+(n===1?' note is':' notes are')+' saved on this device and waiting to reach the Owner Desk.'+(obxErr ? ' Last try: '+obxErr+'.' : '')+' It retries on its own.';
  }
  function obxOn(cid, f){ (obxWatch[cid] = obxWatch[cid] || []).push(f); f(obxState(cid)); }
  function queueDesk(cid, data){
    const i = obx.items.findIndex(x => x.cid === cid);
    const item = {cid, data, at:new Date().toISOString()};
    if (i >= 0) obx.items[i] = item; else obx.items.push(item);
    obxSave(); obxNotify(); return flushDesk();
  }
  // one run at a time; a call during a run waits for it and then sends anything added meanwhile
  function flushDesk(){
    if (obxRun) return obxRun.then(() => (obx.items.length && !obxErr) ? flushDesk() : null);
    if (!obx.items.length) return Promise.resolve();
    obxRun = obxSend().finally(() => { obxRun = null; });
    return obxRun;
  }
  async function obxSend(){
    if (!sb || !user){ obxErr = 'not signed in'; obxNotify(); return; }
    obxErr = '';
    try {
      for (let pass = 0; pass < 3 && obx.items.length && !obxErr; pass++) for (const item of obx.items.slice()){
        const data = Object.assign({}, item.data, {by:item.data.by || user.email || '', cid:item.cid});
        let error, id = obx.ids[item.cid];
        if (id){
          // keep whatever the desk changed (status, reply) and update only what the person wrote
          const cur = await sb.from('desk_items').select('data').eq('id', id).maybeSingle();
          error = cur.error;
          if (!error && cur.data){ const d = cur.data.data || {}; ({error} = await sb.from('desk_items').update({data:Object.assign({}, data, {status:d.status || data.status, reply:d.reply || ''})}).eq('id', id)); }
          else if (!error) id = null; // the desk deleted it: send it again as new
        }
        if (!id && !error){
          const r = await sb.from('desk_items').insert({kind:'request', data}).select('id').single();
          error = r.error; if (!error) obx.ids[item.cid] = r.data.id;
        }
        if (error){ obxErr = error.code || error.message || 'no connection'; break; }
        const now = obx.items.find(x => x.cid === item.cid);
        if (now && now.at === item.at) obx.items = obx.items.filter(x => x !== now); // changed while sending: send again
        obxSave(); obxNotify();
      }
    } catch(e){ obxErr = navigator.onLine === false ? 'no connection' : String(e.message || e); }
    obxSave(); obxNotify();
  }
  window.addEventListener('online', () => flushDesk());
  $('outboxRetry').addEventListener('click', () => { obxErr = ''; flushDesk().then(() => { if (!obx.items.length) toast('Sent to the Owner Desk'); }); });
  obxNotify();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flushDesk(); });
  setInterval(() => { if (obx.items.length) flushDesk(); }, 30000);
  const chat = $('chat'), log = $('chatLog'), chips = $('chatChips'), txt = $('chatText');
  const TOPICS = [
    {k:'wording', label:'Change some wording', kind:'Update'},
    {k:'broken',  label:'Something isn\'t working', kind:'Action to take'},
    {k:'feature', label:'Add a feature', kind:'Suggestion'},
    {k:'website', label:'Change the public website', kind:'Suggestion'},
    {k:'question',label:'Ask a question', kind:'Question'}
  ];
  let step = 'start', draft = {}, opened = false;
  // Saves the note to the desk right away and again after each answer, so closing the chat early loses nothing.
  function saveDraft(final){
    if (!draft.what) return;
    const fresh = !draft.cid;
    if (fresh) draft.cid = 'chat-'+uid()+uid();
    if (final) draft.final = true;
    const text = summary()+(draft.final ? '' : '\n\n(Still answering the follow-up questions. This updates as they answer.)')+'\n\n(From the test app chat. Screen open: '+screenName()+', viewing as '+tier().name+', '+site().name+')';
    const data = {kind:draft.topic.kind, biz:draft.where==='Public website'?'Website (from test app chat)':'Test app: '+(draft.where||screenName()), when:draft.when||'Whenever', text, status:'New', reply:'', by:(user && user.email)||'', source:'test-app-chat', tier:S.tier, screen:current};
    if (fresh){
      const st = h('div',{class:'bub sum',role:'status'},'Saving…'); log.append(st); log.scrollTop = log.scrollHeight;
      obxOn(draft.cid, s => { st.textContent = s === 'sent' ? '✓ Saved on the Owner Desk. Any answers below are added to the same note, and you can stop at any time.' : s === 'error' ? '⚠ Not on the desk yet ('+obxErr+'). It\'s kept on this device and retries on its own.' : 'Saving to the Owner Desk…'; st.className = 'bub sum'+(s === 'error' ? ' warn' : ''); });
    }
    return queueDesk(draft.cid, data);
  }
  function bub(cls, text){ const b = h('div',{class:'bub '+cls}, text); log.append(b); log.scrollTop = log.scrollHeight; return b; }
  function say(text){ bub('bot', text); }
  function setChips(list){
    chips.textContent = '';
    list.forEach(c => chips.append(h('button',{type:'button',class:c.go?'go':null,onclick:()=>{ if(!c.silent) bub('me', c.label); c.run(); }}, c.label)));
  }
  function screenName(){ return VIEWS[current].t; }
  function guessTopic(t){
    if (/\b(website|public site|home ?page|landing|pricing page|plans page)\b/i.test(t)) return TOPICS[3];
    if (/\b(broken|doesn'?t work|not working|error|bug|wrong|stuck|can'?t)\b/i.test(t)) return TOPICS[1];
    if (/\?\s*$/.test(t) || /^(how|why|what|can|does|is|should)\b/i.test(t)) return TOPICS[4];
    if (/\b(word|wording|say|reads|sentence|phrase|rename|title)\b/i.test(t)) return TOPICS[0];
    return TOPICS[2];
  }
  function start(){
    step = 'start'; draft = {};
    say('Hi! I collect ideas and fixes for the app and the public website, and pass them to Christian and Claude.\n\nWhat would you like to change or add? Pick one, or just type it the way you\'d say it.');
    setChips(TOPICS.map(t => ({label:t.label, run:()=>{ draft.topic = t; step = 'what';
      say(t.k==='broken' ? 'Sorry about that. What happened, and what did you expect to happen?' : t.k==='question' ? 'Go ahead, what\'s your question?' : t.k==='website' ? 'What should change on the public website? Tell me which part if you can (for example the plans, the caregiver section, the wording at the top).' : 'Tell me what you\'d like, in your own words.');
      setChips([]); txt.focus(); }})));
  }
  function askWhere(){
    step = 'where'; saveDraft();
    if (draft.topic.k === 'website'){ draft.where = 'Public website'; return askWhy(); }
    say('Is this about the "'+screenName()+'" screen you were on, or somewhere else?');
    setChips([
      {label:'Yes, "'+screenName()+'"', run:()=>{ draft.where = screenName()+' (viewing as '+tier().name+')'; askWhy(); }},
      {label:'The whole app', run:()=>{ draft.where = 'Whole app'; askWhy(); }},
      {label:'The public website', run:()=>{ draft.where = 'Public website'; askWhy(); }},
      {label:'Another screen', run:()=>{ say('Which one?'); setChips(Object.keys(VIEWS).map(v => ({label:VIEWS[v].t, run:()=>{ draft.where = VIEWS[v].t; askWhy(); }}))); }}
    ]);
  }
  function askWhy(){
    step = 'why'; saveDraft();
    say(draft.topic.k === 'question' ? 'Anything that would help us answer, like where this comes up on a shift? (Or skip.)' : 'Why does it matter? Who would it help on a real shift, or what goes wrong without it? (Or skip.)');
    setChips([{label:'Skip', run:askWhen}]);
    txt.focus();
  }
  function askWhen(){
    step = 'when'; saveDraft();
    say('How soon would you like it?');
    setChips(['Whenever','This week','Urgent'].map(w => ({label:w, run:()=>{ draft.when = w; confirm(); }})));
  }
  function summary(){
    return 'Type: '+draft.topic.label+'\nWhere: '+(draft.where||'not said')+'\nWhat: '+draft.what+(draft.why?'\nWhy: '+draft.why:'')+((draft.more||[]).length?'\nMore: '+draft.more.join(' / '):'')+'\nHow soon: '+(draft.when||'Whenever');
  }
  function confirm(){
    step = 'confirm'; saveDraft();
    say('Here\'s your note. Anything to add?');
    bub('sum', summary());
    setChips([
      {label:'That\'s everything', go:true, run:send},
      {label:'Add more detail', run:()=>{ step = 'more'; say('Go ahead, type what to add.'); setChips([]); txt.focus(); }},
      {label:'Start a new note', run:()=>{ log.textContent = ''; start(); }, silent:true}
    ]);
  }
  async function send(){
    setChips([]);
    const cid = draft.cid;
    await saveDraft(true);
    step = 'done';
    const st = obxState(cid);
    if (st === 'sent') say('Done! It\'s on the Owner Desk under Requests for Claude. When someone replies, you\'ll see it under "Your notes and replies".');
    else say('It\'s saved on this device'+(!user ? ' (you\'re signed out)' : '')+' and will reach the Owner Desk on its own as soon as it can. You can close the app; it keeps trying next time you open it.');
    setChips([{label:'Something else', run:()=>start(), silent:false}]);
  }
  // ---- AI mode: used when the app-chat server function is set up with an API key ----
  let aiMode = false, aiTurns = [];
  async function probeAI(){
    try { const {data, error} = await sb.functions.invoke('app-chat', {body:{ping:true}}); return !error && data && data.ok; } catch(e){ return false; }
  }
  function startAI(){
    aiTurns = [];
    const hello = 'Hi! I\'m the app\'s helper. Tell me anything you\'d change or add, on this app or the public website, and I\'ll ask a question or two and send it to the desk for Christian and Claude.\n\nYou can also ask me what a screen does.';
    say(hello); aiTurns.push({role:'assistant', content:hello});
    setChips([]);
  }
  async function aiSend(t){
    aiTurns.push({role:'user', content:t});
    const typing = bub('bot','…');
    const ctx = {screen:screenName(), tier:tier().name, site:site().name};
    let data, error;
    try { ({data, error} = await sb.functions.invoke('app-chat', {body:{messages:aiTurns.slice(-20), context:ctx}})); } catch(e){ error = e; }
    typing.remove();
    if (error || !data || !data.reply){
      aiTurns.pop();
      say('The AI helper isn\'t answering right now, so I\'ll ask you a few quick questions instead.');
      aiMode = false; draft = {topic:guessTopic(t), what:t}; askWhere(); return;
    }
    say(data.reply); aiTurns.push({role:'assistant', content:data.reply});
    (data.saved||[]).forEach(w => bub('sum','Saved to the desk: '+w));
    setChips([{label:'Start over', silent:true, run:()=>{ log.textContent=''; startAI(); }}]);
  }
  function onText(t){
    if (aiMode){ aiSend(t); return; }
    if (/\b(dob|date of birth|ssn|social security|medicaid (id|number)|diagnos\w*)\b/i.test(t)) say('Quick reminder: please leave out real resident names and health details. Made-up examples are perfect.');
    if (step === 'start' || step === 'done'){ draft = {topic:guessTopic(t), what:t}; askWhere(); return; }
    if (step === 'what'){ draft.what = t; askWhere(); return; }
    if (step === 'where'){ draft.where = t; askWhy(); return; }
    if (step === 'why'){ draft.why = t; askWhen(); return; }
    if (step === 'when'){ draft.when = /urgent|asap|now/i.test(t) ? 'Urgent' : /week/i.test(t) ? 'This week' : 'Whenever'; draft.more = (draft.more||[]).concat(t); confirm(); return; }
    if (step === 'more' || step === 'confirm'){ draft.more = (draft.more||[]).concat(t); confirm(); return; }
  }
  $('chatForm').addEventListener('submit', e => {
    e.preventDefault(); const t = txt.value.trim(); if (!t) return;
    bub('me', t); txt.value = ''; setChips([]); onText(t);
  });
  txt.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); $('chatForm').requestSubmit(); } });
  function tab(mine){
    $('tabTalk').setAttribute('aria-selected', String(!mine)); $('tabMine').setAttribute('aria-selected', String(mine));
    log.hidden = mine; chips.hidden = mine; $('chatForm').hidden = mine; $('chatMine').hidden = !mine;
    if (mine) loadMine();
  }
  $('tabTalk').addEventListener('click', () => tab(false));
  $('tabMine').addEventListener('click', () => tab(true));
  async function loadMine(){
    const box = $('chatMine'); box.textContent = ''; box.append(h('p',{class:'small muted'},'Loading…'));
    const {data, error} = await sb.from('desk_items').select('id,data,created_at').eq('kind','request').order('created_at',{ascending:false}).limit(50);
    box.textContent = '';
    if (error){ box.append(h('p',{class:'small'},'Couldn\'t load your notes ('+(error.code||error.message)+').')); return; }
    const mine = (data||[]).filter(r => String(r.data.by||'').toLowerCase() === String(user.email||'').toLowerCase());
    obx.items.filter(x => !obx.ids[x.cid]).forEach(x => box.append(h('div',{class:'item'},
      h('div',{class:'meta'}, h('span',{class:'chip amber'},'Waiting to send'), h('span',null,fmtDate(x.at))),
      h('span',{class:'small',style:'white-space:pre-wrap'}, String(x.data.text||'').split('\n\n(')[0].slice(0,400)))));
    if (!mine.length && !obx.items.length){ box.append(h('p',{class:'small muted'},'Nothing sent yet. Your notes and any replies show up here.')); return; }
    mine.forEach(r => {
      const d = r.data, st = d.status || 'New';
      box.append(h('div',{class:'item'},
        h('div',{class:'meta'}, h('span',{class:'chip '+(st==='Done'?'calm':st==='In progress'?'':'amber')},st), h('span',null,fmtDate(r.created_at))),
        h('span',{class:'small',style:'white-space:pre-wrap'}, String(d.text||'').split('\n\n(')[0].slice(0,400)),
        d.reply ? h('div',{class:'bub sum',style:'font-size:.9rem'}, 'Reply: '+d.reply) : null));
    });
  }
  $('fbOpen').addEventListener('click', () => {
    chat.hidden = false; $('fbOpen').hidden = true;
    if (!opened){ opened = true; const wait = bub('bot','…'); probeAI().then(ok => { wait.remove(); aiMode = !!ok; aiMode ? startAI() : start(); }); }
    tab(false); txt.focus();
  });
  $('chatClose').addEventListener('click', () => { chat.hidden = true; $('fbOpen').hidden = false; });

  // ---------- install on a phone (home-screen app) ----------
  function standalone(){ return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true || /SteadyShiftApp/.test(navigator.userAgent); }
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  function installCard(){
    if (standalone()) return null;
    try { if (localStorage.getItem('ss-install-hide')) return null; } catch(e){}
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /Android/.test(navigator.userAgent);
    if (!ios && !android) return null;
    const c = h('div',{class:'card soft noprint'}, h('span',{class:'eyebrow'},'Use it like an app'), h('h3',null,'Put Steady Shift on your home screen'),
      ios ? h('p',{class:'small'},'In Safari, tap the Share button (the square with an arrow), then "Add to Home Screen". Open it from the new icon and sign in once with the code from the email.')
          : h('p',{class:'small'},'Tap "Install" below, or open the Chrome menu (⋮) and choose "Add to Home screen" or "Install app". Then open it from the new icon and sign in once with the code from the email.'),
      h('div',{class:'row'},
        android ? h('button',{class:'btn sm',type:'button',onclick:async()=>{ if (installEvt){ installEvt.prompt(); await installEvt.userChoice; installEvt = null; c.remove(); } else toast('Use the Chrome menu (⋮), then "Add to Home screen".'); }},'Install') : null,
        h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ try{localStorage.setItem('ss-install-hide','1')}catch(e){} c.remove(); }},'Not now')));
    return c;
  }

  // ---------- sign-in (same Supabase project and session as the Owner Desk) ----------
  // near: the button or form the person just used, so the message shows right under it
  function gate(msg, err, near){ $('app').hidden = true; $('plans').hidden = true; $('gate').hidden = false; const m = $('gateMsg'); m.textContent = msg||''; m.hidden = !msg; m.className = 'msg'+(err?' err':''); if (msg && near && window.SSPw) SSPw.showNear(m, near); }
  const busy = (b, on, text) => { b.disabled = on; b.textContent = text; b.classList.toggle('sspw-busy', on); b.setAttribute('aria-busy', String(on)); };
  const cfg = window.DESK_CONFIG || {};
  if (!cfg.supabaseUrl || !window.supabase){ gate('The app could not reach its sign-in service. Try reloading.', true); $('pwForm').hidden = true; return; }
  sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {auth:{flowType:'implicit',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

  try { $('email').value = localStorage.getItem('desk-email') || ''; } catch(e){}
  let how = '';
  const emailVal = () => $('email').value.trim().toLowerCase();
  const typo = window.SSPw ? SSPw.watchEmail($('email')) : () => '';
  const typoStop = near => { const sug = typo(); if (sug){ gate('Check your email address. Did you mean '+sug+'? Tap "Fix it" under the email box.', true, near); $('email').focus(); return true; } return false; };
  $('pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = emailVal(), pw = $('password').value; if (!email || !pw) return;
    gate('');
    if (typoStop($('pwBtn'))) return;
    const b = $('pwBtn'); busy(b, true, 'Signing in…');
    try { localStorage.setItem('desk-email', email); } catch(err){}
    how = 'password';
    const msg = window.SSPw ? await SSPw.signIn(sb, email, pw) : 'Password sign-in is not available right now. Use the email code below.';
    busy(b, false, 'Sign in');
    if (msg){ how = ''; gate(msg, true, b); $('password').value = ''; }
  });
  $('sendBtn').addEventListener('click', async () => {
    const email = emailVal();
    if (!email || !$('email').checkValidity()){ gate('Type your email above first.', true, $('sendBtn')); $('email').focus(); return; }
    if (typoStop($('sendBtn'))) return;
    const b = $('sendBtn'); busy(b, true, 'Sending…');
    try { localStorage.setItem('desk-email', email); localStorage.setItem('ss-after-signin','app'); } catch(err){}
    const {error} = await sb.auth.signInWithOtp({email, options:{shouldCreateUser:false, emailRedirectTo:location.origin+location.pathname}});
    busy(b, false, 'Email me a sign-in code');
    if (error){
      const m = String(error.message||'');
      if (/signups? not allowed|not found|otp_disabled/i.test(m)) gate('That email is not set up yet. Check it for typos, or ask Christian to add you.', true, b);
      else if (/rate|seconds/i.test(m)) gate('Too many sign-in emails just now. Please wait a few minutes and try again.', true, b);
      else gate('Could not send the email: '+m, true, b);
      return;
    }
    gate(standalone() ? 'Check '+email+' for a sign-in email (it may land in spam). Type the code from the email below.' : 'Check '+email+' for a sign-in email (it may land in spam). Type the code below, or tap the link in the email.', false, b.closest('.card'));
    $('codeForm').hidden = false; $('code').focus();
  });
  $('codeForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = emailVal(), token = $('code').value.replace(/\D/g,'');
    if (!email){ gate('Type your email above first.', true, $('codeBtn')); $('codeForm').hidden = false; return; }
    const b = $('codeBtn'); busy(b, true, 'Checking…'); how = 'code';
    const {error} = await sb.auth.verifyOtp({email, token, type:'email'});
    busy(b, false, 'Sign in with the code');
    if (error){ $('codeForm').hidden = false; gate(/expired|invalid/i.test(String(error.message)) ? 'That code did not work or has expired. Send a new email and use the newest code.' : 'Could not sign in: '+error.message, true, b); }
  });
  async function signOut(){ try { sessionStorage.removeItem('sspw-later'); } catch(e){} await sb.auth.signOut(); }
  $('signOut').addEventListener('click', signOut);
  if (window.SSTrial) SSTrial.setupRedeem(sb, gate, busy);
  $('pwChange').addEventListener('click', () => { if (window.SSPw && user) SSPw.change(sb, user); });

  async function onSession(session){
    if (!session){ user = null; gate(''); $('codeForm').hidden = true; return; }
    if (user && user.id === session.user.id) return;
    user = session.user;
    // members of the Owner Desk, or people on a free trial (see trial.js and desk/trials.sql)
    let acc;
    if (window.SSTrial) acc = await SSTrial.check(sb);
    else { const r = await sb.rpc('is_desk_member'); acc = r.error ? {error:r.error} : {member:!!r.data, active:!!r.data}; }
    if (acc.error || (!acc.member && !acc.trial)){ user = null; gate(acc.error ? 'Could not check access ('+(acc.error.code||acc.error.message)+'). Try reloading.' : 'This email is signed in but is not on the list for the test app. If you were given a free trial code, sign out and use "Start my free trial". Otherwise ask Christian to add it.', true); return; }
    try { localStorage.removeItem('ss-after-signin'); } catch(e){}
    if (/[?&](code|trial|paid)=/.test(location.search)) history.replaceState(null,'',location.pathname+location.hash);
    trial = acc.trialOnly ? acc.trial : null;
    if (trial && !acc.active){ $('gate').hidden = true; SSTrial.plans(sb, user, trial, {locked:true, onSignOut:signOut}); if (window.SSPw) SSPw.afterSignIn(sb, user, how); return; }
    if (location.hash && /access_token|error/.test(location.hash)) history.replaceState(null,'',location.pathname+'#/home');
    $('whoEmail').textContent = user.email || '';
    $('gate').hidden = true; $('app').hidden = false;
    if (window.SSStation){ const sv = await SSStation.verify(); if (sv && sv.gone) toast('This tablet is no longer a shift station. A manager can set it up again in Services and access.'); }
    fillSwitchers(); route(); flushDesk();
    if (window.SSPw) SSPw.afterSignIn(sb, user, how);
    if (trial){
      const openPlans = () => SSTrial.plans(sb, user, trial, {onSignOut:signOut, onBack:() => SSTrial.bar(trial, openPlans)});
      SSTrial.bar(trial, openPlans);
      if (SSTrial.shouldNudge(trial)) setTimeout(openPlans, 1200);
      // if the trial runs out while the app is open, switch to the plan screen
      clearInterval(trialTimer);
      trialTimer = setInterval(() => { if (!user || !trial) return clearInterval(trialTimer); if (!SSTrial.active(trial)){ clearInterval(trialTimer); SSTrial.plans(sb, user, trial, {locked:true, onSignOut:signOut}); } else SSTrial.bar(trial, openPlans); }, 600000);
    } else { const b = $('trialBar'); if (b) b.hidden = true; }
  }
  let trial = null, trialTimer = 0;
  (window.SSIdle ? SSIdle.guard(sb) : Promise.resolve()).then(() => {
    sb.auth.onAuthStateChange((_e, session) => setTimeout(() => onSession(session), 0));
    sb.auth.getSession().then(({data}) => onSession(data.session));
  });
  if (/error_description=/.test(location.hash)){
    const p = new URLSearchParams(location.hash.slice(1));
    gate('That sign-in link did not work ('+(p.get('error_description')||'expired')+'). Sign in with your password, or ask for a new code below.', true);
    history.replaceState(null,'',location.pathname);
  }
})();
