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
  function fresh(){ const s = JSON.parse(JSON.stringify(D.SEED)); return Object.assign(s,{tier:'caregiver', site:'maple', survey:{}, tour:{}, watch:{}, policies:[], orgProcs:[], pulse:{}, oncall:{fallok:false,medq:false,callin:true}}); }
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch(e){ S = fresh(); }
  for (const k in fresh()) if (!(k in S)) S[k] = fresh()[k];
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
    report:{t:'Write a report', ic:'📝'},
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
    procedures:{t:'Company procedures', ic:'🗂️'},
    review:{t:'Feedback review', ic:'👍'}
  };
  const NAV = {
    caregiver:['home','check','whatif','report','night','behavior','cards','mytraining'],
    manager:['home','inbox','questions','check','whatif','report','night','behavior','team','review','survey','decide','ask','cards','watch','procedures'],
    rn:['home','delegations','check','whatif','cards','night','behavior','watch'],
    owner:['home','owner','review','whatif','procedures','survey','questions','decide','ask','watch','cards'],
    multi:['home','sites','owner','review','whatif','procedures','survey','watch','ask','cards'],
    family:['home','check','night','behavior','handoff','cards','watch']
  };

  function renderNav(view){
    const nav = $('nav'); nav.textContent = '';
    const mine = NAV[S.tier];
    nav.append(h('div',{class:'grp'},(/^[aeiou]/i.test(tier().name)?'For an ':'For a ')+tier().name.toLowerCase()));
    mine.forEach(v => nav.append(navLink(v, view)));
    const rest = Object.keys(VIEWS).filter(v => !mine.includes(v));
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
    renderNav(current);
    const main = $('main'); main.textContent = '';
    const view = h('div',{class:'view'});
    (R[current] || R.home)(view);
    main.append(view);
    if (S.tour) { S.tour[current] = true; save(); }
    window.scrollTo(0,0);
  }
  window.addEventListener('hashchange', route);

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

  R.home = v => {
    const t = S.tier;
    if (t === 'owner') return R.owner(v, true);
    if (t === 'multi') return R.sites(v, true);
    const pc = pulseCard(); if (pc) v.append(pc);
    if (t === 'caregiver') homeCaregiver(v);
    if (t === 'manager') homeManager(v);
    if (t === 'rn') homeRN(v);
    if (t === 'family') homeFamily(v);
    v.append(tourCard());
  };

  function tile(href, ic, b, span, cls){ return h('a',{class:'tile'+(cls?' '+cls:''),href:'#/'+href},h('span',{class:'ic','aria-hidden':'true'},ic),h('b',null,b),h('span',null,span)); }

  function homeCaregiver(v){
    const hr = new Date().getHours();
    const shift = hr < 6 || hr >= 22 ? 'Night shift' : hr < 14 ? 'Day shift' : 'Evening shift';
    v.append(head(shift+' · '+site().name, 'What do you need right now?', 'Pick one. Everything is two taps or less.'));
    v.append(h('div',{class:'grid g2'},
      tile('check','✅','Check a procedure','"Can I…?" "How do I…?" Answers with the rule behind them.'),
      tile('report','📝','Write a note or report','Type it the way you\'d say it. We make it professional.'),
      tile('night','🌙','Night help: who do I call?','Sorts what wakes the manager and what waits for morning.'),
      tile('behavior','🤝','Behavior help','Calm, respectful ideas for hard moments.')));
    const rs = residents();
    v.append(h('div',{class:'card'}, h('h2',null,'Residents tonight'), h('p',{class:'small muted'},'Sample residents. Records use codes, not names.'),
      h('div',{class:'list'}, rs.map(r => h('div',{class:'item'}, h('div',{class:'meta'},h('span',{class:'chip'},r.code),h('b',{style:'color:var(--ink)'},r.nick+' (sample)')), h('span',{class:'small'},r.note))))));
    const mine = S.delegations.filter(d => d.site === S.site && d.cg === 'Caregiver B');
    if (mine.length) v.append(h('div',{class:'card calm'},h('h3',null,'Tasks you\'re cleared for'), mine.map(d => h('p',null,d.task+' for '+d.res+' · review by '+fmtDate(d.review)))));
  }

  function homeManager(v){
    v.append(head('House manager · '+site().name, 'Good morning. Here\'s what happened.', null));
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
    const items = [['check','Look up a procedure (try "pre-pour" or "shower")'],['whatif','Open the What-if library (try "missing")'],['procedures','Import a company procedure and see baseline flags'],['report','Turn a casual note into a report'],['night','Walk through a night question'],['behavior','Open a behavior guide'],['cards','Browse Clarity Cards and compare AFH vs CBRF'],['survey','Run the Survey-Ready Check'],['decide','Record a gray-area decision'],['ask','Draft a question for DQA'],['watch','See upcoming rule changes'],['owner','Open the owner view'],['sites','See the multi-site view'],['delegations','Look at the RN delegation ledger']];
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
    v.append(head('Write a report', 'Say what happened. We\'ll make it professional.', 'Facts only, calm wording, no blame. Nothing here goes anywhere until you send it.'));
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
      h('ol',{class:'steps'}, ['Make sure every resident is safe right now.','Tell the person your home designates to report (usually the administrator) today.','Write facts only. The home reports to DQA within 7 calendar days (DHS 13.05).','You can also report directly to DQA or the county adult-at-risk line. Good-faith reporters are protected from retaliation.'].map(s=>h('li',null,h('span',null,s))))));
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
        opt('fallok','Wake me for falls even without injury'), opt('callin','Wake me if a shift is uncovered by 5 AM')));
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
          h('h3',null,w.title), h('p',{class:'small muted'},w.status), h('p',null,w.what), w.todo.length ? h('div',null,h('b',{class:'small'},'Get ready'),todo) : null));
      });
    }
    tg.addEventListener('click',()=>{ mineOnly = !mineOnly; tg.setAttribute('aria-pressed',String(mineOnly)); draw(); });
    v.append(h('div',{class:'row'},tg), list); draw();
  };

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
    v.append(h('div',{class:'card'}, h('div',{class:'tablewrap'},tb), h('p',{class:'small muted'},'Names are placeholders. Caregivers only see their own record.')));
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
      h('div',{class:'card'}, h('h2',null,'Funding and rate watch'), h('ul',null, h('li',null,'Wisconsin budget items for caregiver pay and training (amounts being checked).'), h('li',null,'Medicaid payment caps proposed from 2028 may affect care manager rates.'), h('li',null,'WisCaregiver Careers can offset hiring and training costs.')), h('a',{href:'#/watch'},'Regulatory Watch'))));
    if (isHome){ const pc = pulseCard(); if (pc) v.append(pc); v.append(tourCard()); }
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
    if (isHome){ const pc = pulseCard(); if (pc) v.append(pc); v.append(tourCard()); }
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
    S.signals.push(Object.assign({id:uid(), at:new Date().toISOString(), site:S.site, tier:S.tier, status:'New', mine:true}, o)); save(); return true;
  }
  function consentBox(onYes){
    return h('div',{class:'card soft',style:'gap:.5rem'},
      h('b',null,'Help improve the guidance?'),
      h('span',{class:'small'},'Your ratings and notes go to a review queue your owner sees, without your name. A person reviews them before any guidance changes. Please never type resident names or health details.'),
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
  const orgFor = id => (S.orgProcs || []).filter(p => p.scenario_id === id);

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
    'WI-FIRE-01':/fire|smoke|evacuat/i, 'WI-BLDG-01':/power|outage|heat|weather|storm|utility/i, 'WI-POL-01':/police|law enforcement/i,
    'WI-ILL-01':/outbreak|infection|contagious|flu|covid|norovirus/i, 'WI-BEH-01':/resident.{0,20}(hit|strike|hurt).{0,20}resident|resident.to.resident/i,
    'WI-BEH-02':/aggress|assault.{0,20}staff|workplace violence/i, 'WI-RESTR-01':/restrain|seclusion|hold/i, 'WI-BEH-03':/suicid|self.harm|wants to die/i,
    'WI-ABUSE-01':/abuse|neglect|mistreat|misconduct/i, 'WI-ABUSE-02':/theft|stolen|missing (money|item|property)|misappropriat/i, 'WI-ABUSE-03':/exploit|family.{0,30}(harm|abuse)/i,
    'WI-STAFF-01':/\bcall.?ins?\b|called in sick|cannot work|no.?show|short.?staff|coverage|call.?off/i, 'WI-STAFF-02':/impair|intoxicat|drug test|arrest|charged|background/i,
    'WI-RIGHTS-01':/refus.{0,20}(care|shower|bath)/i, 'WI-RIGHTS-02':/guardian|power of attorney|poa/i, 'WI-COMP-01':/complain|grievance/i,
    'WI-DISCH-01':/discharge|terminat.{0,20}(stay|services|admission)|30.day notice/i, 'WI-SURV-01':/survey|inspect|dqa visit|state visit/i,
    'WI-MCO-01':/care manager|mco|inclusa|lakeland|my choice/i, 'WI-OMB-01':/ombudsman|advocate/i, 'WI-REC-01':/confidential|hipaa|release of information|records request/i
  };
  const WHO = [['911',/911|ambulance|ems/i],['police',/police|law enforcement|sheriff/i],['rep',/guardian|family|representative|poa/i],['physician',/physician|doctor|prescriber|md\b/i],['nurse',/nurse|rn\b/i],['mco',/care manager|mco|idt|care team|inclusa|lakeland/i],['dqa',/dqa|state|department/i],['licensing',/licensing/i],['manager',/manager|supervisor|on.call/i],['owner',/owner|administrator/i],['aps',/adult protective|aps|elder abuse/i],['health',/health department/i]];
  function localMap(text, source){
    const paras = text.split(/\n\s*\n|\n(?=#|\d+\.|[A-Z][A-Za-z ]{3,40}:)/).map(p => p.trim()).filter(p => p.length > 30);
    const out = [];
    paras.forEach(p => {
      const ids = Object.keys(KEYWORDS).filter(id => KEYWORDS[id].test(p));
      if (!ids.length) return;
      const id = ids.find(x => /FALL-01|DEATH-02|ABUSE-0|MISS|RESTR/.test(x)) || ids[0];
      const notify = [];
      p.split(/(?<=[.;])\s+/).forEach(sent => {
        const who = WHO.find(w => w[1].test(sent)); if (!who) return;
        let hrs = null; for (const [re,f] of HOURS){ const m = sent.match(re); if (m){ hrs = typeof f === 'function' ? f(m) : f; break; } }
        if (!notify.some(n => n.key === who[0])) notify.push({key:who[0], within_hours:hrs, text:sent.slice(0,160)});
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
    v.append(head('Company procedures', 'Bring your own procedures', 'Your procedures sit on top of the law, never under it. The app maps them to each what-if and flags any place where a step falls below the legal baseline.'));
    const area = h('div',{class:'grid'}); v.append(area);
    loadLib().then(async lib => {
      if (!lib){ area.append(h('div',{class:'card alert'},LIBERR)); return; }
      const ai = await aiAvailable();
      const name = h('input',{type:'text',placeholder:'Document name, for example "Employee handbook 2026"','aria-label':'Document name'});
      const txt = h('textarea',{style:'min-height:10rem',placeholder:'Paste a procedure, policy or handbook section. Leave out resident names, health details, phone numbers and passwords.'});
      const file = h('input',{type:'file',accept:'.txt,.md,.csv,.json,text/plain'});
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
        save.addEventListener('click',()=>{ S.orgProcs = (S.orgProcs||[]).filter(x => !items.some(i => i.scenario_id===x.scenario_id && (i.role||'')===(x.role||''))).concat(items.map(i => Object.assign({}, i, {saved:new Date().toISOString()}))); save2(); toast('Saved. Open any what-if to see it.'); route(); });
        out.append(h('div',{class:'row'}, save));
      });
      area.append(h('div',{class:'card'},
        h('h2',null,'1. Add your document'),
        h('p',{class:'small'}, ai ? 'AI reads the text and maps each procedure to a what-if. Private details are removed on your device first. Rule checks are done by the app, not the AI.' : 'AI mapping is not switched on yet, so this uses a simple keyword matcher. Structured files (the CSV or JSON template) import exactly.'),
        h('label',{class:'f'},'Name',name), txt, h('div',{class:'row'}, file, sample),
        h('div',{class:'row'}, go, h('a',{class:'btn ghost sm',href:'../data/scenarios/org-procedures-template.csv',download:''},'CSV template'), h('a',{class:'btn ghost sm',href:'../data/scenarios/org-procedures-template.json',download:''},'JSON template'))), out);
      const mine = S.orgProcs || [];
      area.append(h('div',{class:'card'}, h('h2',null,'2. Your company layer ('+mine.length+')'),
        mine.length ? h('div',{class:'list'}, mine.map(p => { const sc = lib.scenarios.find(x=>x.id===p.scenario_id); const fl = sc ? compareProc(sc,p).filter(f=>f.kind==='below').length : 0;
          return h('a',{class:'item',href:'#/whatif/'+p.scenario_id,style:'text-decoration:none;color:inherit'}, h('div',{class:'meta'}, h('span',null,p.source||''), fl ? h('span',{class:'chip amber'},fl+' below baseline') : h('span',{class:'chip calm'},'OK')), h('b',null, sc ? sc.title : p.scenario_id)); }))
        : h('p',{class:'muted small'},'Nothing yet. Import a document above.'),
        mine.length ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ S.orgProcs = []; save2(); route(); }},'Clear my company layer') : null));
    });
  };
  const save2 = () => save();

  // ---------- "Ideas and fixes" chat: a guided helper that saves to the desk's Requests for Claude ----------
  // Uses the AI helper (Supabase Edge Function "app-chat") when it is set up; otherwise a scripted helper
  // asks short follow-ups and saves the conversation as one request.
  let sb = null, user = null;
  const chat = $('chat'), log = $('chatLog'), chips = $('chatChips'), txt = $('chatText');
  const TOPICS = [
    {k:'wording', label:'Change some wording', kind:'Update'},
    {k:'broken',  label:'Something isn\'t working', kind:'Action to take'},
    {k:'feature', label:'Add a feature', kind:'Suggestion'},
    {k:'website', label:'Change the public website', kind:'Suggestion'},
    {k:'question',label:'Ask a question', kind:'Question'}
  ];
  let step = 'start', draft = {}, opened = false;
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
    step = 'where';
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
    step = 'why';
    say(draft.topic.k === 'question' ? 'Anything that would help us answer, like where this comes up on a shift? (Or skip.)' : 'Why does it matter? Who would it help on a real shift, or what goes wrong without it? (Or skip.)');
    setChips([{label:'Skip', run:askWhen}]);
    txt.focus();
  }
  function askWhen(){
    step = 'when';
    say('How soon would you like it?');
    setChips(['Whenever','This week','Urgent'].map(w => ({label:w, run:()=>{ draft.when = w; confirm(); }})));
  }
  function summary(){
    return 'Type: '+draft.topic.label+'\nWhere: '+(draft.where||'not said')+'\nWhat: '+draft.what+(draft.why?'\nWhy: '+draft.why:'')+((draft.more||[]).length?'\nMore: '+draft.more.join(' / '):'')+'\nHow soon: '+(draft.when||'Whenever');
  }
  function confirm(){
    step = 'confirm';
    say('Here\'s what I\'ll send. Anything to add?');
    bub('sum', summary());
    setChips([
      {label:'Send it', go:true, run:send},
      {label:'Add more detail', run:()=>{ step = 'more'; say('Go ahead, type what to add.'); setChips([]); txt.focus(); }},
      {label:'Start over', run:()=>{ log.textContent = ''; start(); }, silent:true}
    ]);
  }
  async function send(){
    setChips([]);
    if (!sb || !user){ say('You\'re signed out, so I couldn\'t send it. Sign in and try again.'); return; }
    const text = summary()+'\n\n(From the test app chat. Screen open: '+screenName()+', viewing as '+tier().name+', '+site().name+')';
    const data = {kind:draft.topic.kind, biz:draft.where==='Public website'?'Website (from test app chat)':'Test app: '+(draft.where||screenName()), when:draft.when||'Whenever', text, status:'New', reply:'', by:user.email||'', source:'test-app-chat', tier:S.tier, screen:current};
    const {error} = await sb.from('desk_items').insert({kind:'request', data});
    if (error){ say('That didn\'t go through ('+(error.code||error.message)+'). Try "Send it" again in a moment.'); setChips([{label:'Send it', go:true, run:send}]); return; }
    say('Sent! It\'s on the Owner Desk under Requests for Claude. When someone replies, you\'ll see it under "Your notes and replies".');
    step = 'done';
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
    if (!mine.length){ box.append(h('p',{class:'small muted'},'Nothing sent yet. Your notes and any replies show up here.')); return; }
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

  // ---------- sign-in (same Supabase project and session as the Owner Desk) ----------
  function gate(msg, err){ $('app').hidden = true; $('gate').hidden = false; const m = $('gateMsg'); m.textContent = msg||''; m.hidden = !msg; m.className = 'msg'+(err?' err':''); }
  const cfg = window.DESK_CONFIG || {};
  if (!cfg.supabaseUrl || !window.supabase){ gate('The app could not reach its sign-in service. Try reloading.', true); $('emailForm').hidden = true; return; }
  sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {auth:{flowType:'implicit',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

  try { $('email').value = localStorage.getItem('desk-email') || ''; } catch(e){}
  $('emailForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('email').value.trim().toLowerCase(); if (!email) return;
    const b = $('sendBtn'); b.disabled = true; b.textContent = 'Sending…';
    try { localStorage.setItem('desk-email', email); localStorage.setItem('ss-after-signin','app'); } catch(err){}
    const {error} = await sb.auth.signInWithOtp({email, options:{shouldCreateUser:false, emailRedirectTo:location.origin+location.pathname}});
    b.disabled = false; b.textContent = 'Email me a sign-in link';
    if (error){
      const m = String(error.message||'');
      if (/signups? not allowed|not found|otp_disabled/i.test(m)) gate('That email is not set up yet. Ask Christian to add you.', true);
      else if (/rate|seconds/i.test(m)) gate('Too many sign-in emails just now. Please wait a few minutes and try again, or open the Owner Desk if you are already signed in there.', true);
      else gate('Could not send the link: '+m, true);
      return;
    }
    gate('Check '+email+' for a sign-in email (it may land in spam). The link brings you straight back here.');
  });
  $('signOut').addEventListener('click', async () => { await sb.auth.signOut(); });

  async function onSession(session){
    if (!session){ user = null; gate(''); return; }
    if (user && user.id === session.user.id) return;
    user = session.user;
    const {data:ok, error} = await sb.rpc('is_desk_member');
    if (error || !ok){ user = null; gate(error ? 'Could not check access ('+(error.code||error.message)+'). Try reloading.' : 'This email is signed in but is not on the list for the test app. Ask Christian to add it.', true); return; }
    try { localStorage.removeItem('ss-after-signin'); } catch(e){}
    if (location.hash && /access_token|error/.test(location.hash)) history.replaceState(null,'',location.pathname+'#/home');
    $('whoEmail').textContent = user.email || '';
    $('gate').hidden = true; $('app').hidden = false;
    fillSwitchers(); route();
  }
  sb.auth.onAuthStateChange((_e, session) => setTimeout(() => onSession(session), 0));
  sb.auth.getSession().then(({data}) => onSession(data.session));
  if (/error_description=/.test(location.hash)){
    const p = new URLSearchParams(location.hash.slice(1));
    gate('That sign-in link did not work ('+(p.get('error_description')||'expired')+'). Ask for a new one below.', true);
    history.replaceState(null,'',location.pathname);
  }
})();
