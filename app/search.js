// Steady Shift test app: quick search. Jump to any screen, service or resident page from anywhere.
// Open it with the 🔎 Search button at the top, Ctrl+K (Cmd+K on a Mac), or "/" when not typing.
// Spelling mistakes are fine ("timeshet", "vender", "fax inbx"). It only lists screens this role can open
// (services switched off for the home or role are left out), and resident pages for the home that is picked.
// Do it by chat uses the same search for "open ...", "go to ..." and "where is ...".
(function(){
  const A = window.SSApp; if (!A) return;
  const {h, VIEWS} = A;
  const S = () => A.state();
  const MGR = ['manager','owner','multi'];
  const viewOn = v => { try { return !window.SSAccess || SSAccess.viewOn(v); } catch(e){ return true; } };

  // Extra words people use for each screen (the screen's own title always counts).
  const WORDS = {
    home:'start dashboard main',
    check:'procedure question rule answer how do i law',
    report:'incident write up fall injury event report something',
    required:'mandatory reporting dqa aps self report deadlines',
    night:'night help triage after hours call on call emergency',
    whatif:'what if scenarios situations',
    behavior:'behavior aggression refusal dementia wandering',
    cards:'clarity cards rules cheat sheet',
    survey:'survey ready inspection dqa audit mock survey',
    decide:'decision document gray area',
    ask:'regulator question dqa email letter',
    watch:'rule changes laws updates regulatory',
    inbox:'reports to review incident inbox manager review',
    questions:'question log staff questions',
    team:'team training hours staff training',
    delegations:'rn delegation nurse competency sign off',
    owner:'owner money roi savings view',
    sites:'all sites homes multi site',
    handoff:'hand off packet family',
    mytraining:'my training courses hours',
    procedures:'policies policy procedures handbook company procedures sop add policy upload policy employee handbook',
    setup:'facility setup policies policy upload documents handbook county license profile add policy',
    askpolicy:'ask our policy search policy handbook lookup',
    review:'feedback review thumbs',
    sync:'calendar google outlook teams sync ics export',
    orders:'doctor orders physician md prescription appointment fax orders',
    peer:'what worked others peer library',
    schedule:'schedule shifts calendar time off pto vacation swap cover pick up open shifts on call rota',
    time:'time sheets timesheet clock in clock out punch hours payroll breaks',
    insights:'owner insights charts reports analytics',
    outlook:'owner outlook funding rates family care forecast',
    labor:'labor pay wages overtime cost payroll',
    access:'services access permissions share codes invite switch off modules',
    kiosk:'house tablet kiosk shared tablet pin',
    assistant:'chat assistant do it by chat ask helper bot',
    clean:'cleaning housekeeping chores checklist sanitize',
    face:'face sheet resident info contacts allergies code status dnr',
    meals:'meals food intake eating fluids',
    menu:'menu groceries grocery budget shopping pantry',
    shift:'shift change report handoff sbar ipass end of shift',
    forms:'report forms custom forms builder fields',
    intake:'admission new resident move in intake referral',
    isp:'care plan isp service plan individual service plan',
    notes:'progress notes charting documentation',
    hr:'employee files hr hiring onboarding background check personnel',
    myfile:'my employee file my documents my hr',
    training:'staff training courses academy onboarding',
    academy:'getting started academy learn tutorial',
    vendors:'vendors suppliers pharmacy contractors contacts companies',
    outside:'faxes fax inbox email mail outside messages incoming',
    money:'money quickbooks payroll sync accounting',
    resfunds:'resident spending funds allowance trust money',
    monitor:'follow up checks monitoring',
    choices:'resident choices preferences rights',
    voice:'staff voice feedback anonymous suggestions survey',
    celebrate:'birthdays anniversaries milestones celebrate',
    brief:'executive summary brief overview'
  };
  // Pages for one resident (code in the link).
  const RES_PAGES = [['face','Face sheet'],['isp','Care plan'],['notes','Progress notes']];

  // ---------- fuzzy matching ----------
  const norm = s => String(s||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9\- ]+/g,' ').replace(/\s+/g,' ').trim();
  function dist(a, b, max){
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({length:b.length+1}, (_, j) => j), prev2 = null;
    for (let i = 1; i <= a.length; i++){
      const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++){
        let v = Math.min(prev[j] + 1, cur[j-1] + 1, prev[j-1] + (a[i-1] === b[j-1] ? 0 : 1));
        if (prev2 && i > 1 && j > 1 && a[i-1] === b[j-2] && a[i-2] === b[j-1]) v = Math.min(v, prev2[j-2] + 1);
        cur.push(v); if (v < best) best = v;
      }
      if (best > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[b.length];
  }
  // How well one typed word matches the words of an entry: 4 exact, 3 start of a word, 2 inside a word, 1 close spelling.
  function wordScore(q, words){
    let best = 0;
    for (const w of words){
      if (w === q) return 4;
      if (w.startsWith(q)) best = Math.max(best, q.length >= 2 ? 3 : 1);
      else if (q.length >= 3 && w.includes(q)) best = Math.max(best, 2);
      else if (q.length >= 4){
        const max = q.length >= 7 ? 2 : 1;
        if (dist(q, w.slice(0, q.length), max) <= max || dist(q, w.slice(0, q.length + max), max) <= max || dist(q, w, max) <= max) best = Math.max(best, 1.5);
      }
    }
    return best;
  }
  const STOP = new Set(['the','a','an','to','for','of','my','our','me','go','open','show','find','where','is','whats','page','screen','please','i','want','need','see','in','on','at','and']);
  function score(query, entry){
    const qs = norm(query).split(' ').filter(w => w && !STOP.has(w));
    if (!qs.length) return 0;
    let total = 0, missed = 0;
    for (const q of qs){ const s = Math.max(wordScore(q, entry.titleWords) * 1.3, wordScore(q, entry.words)); if (!s) missed++; total += s; }
    if (missed > (qs.length >= 3 ? 1 : 0)) return 0;
    if (norm(entry.title) === norm(query)) total += 3;
    return total / qs.length - missed + (entry.boost || 0);
  }

  // ---------- what can be searched ----------
  // words plus each pair run together, so "facesheet" or "timesheet" still matches
  const withPairs = ws => ws.concat(ws.slice(1).map((w, i) => ws[i] + w));
  function entries(){
    const out = [];
    const nav = (A.NAV[S().tier] || []);
    Object.keys(VIEWS).forEach(v => {
      if (!viewOn(v)) return;
      const t = VIEWS[v].t;
      out.push({kind:'Screen', title:t, ic:VIEWS[v].ic, href:'#/'+v, titleWords:withPairs(norm(t).split(' ')), words:norm(t+' '+v+' '+(WORDS[v]||'')).split(' '), boost:nav.includes(v) ? 0.2 : 0});
    });
    (A.residents() || []).forEach(r => RES_PAGES.forEach(([v, label]) => {
      if (!VIEWS[v] || !viewOn(v)) return;
      const t = label+' · '+r.nick+' ('+r.code+')';
      out.push({kind:'Resident', title:t, ic:VIEWS[v].ic, href:'#/'+v+'/'+encodeURIComponent(r.code), titleWords:withPairs(norm(t).split(' ')), words:norm(t+' '+(WORDS[v]||'')+' resident '+r.code.replace('-',' ')).split(' ')}); }));
    return out;
  }
  function find(query, n){
    const all = entries().map(e => ({e, s:score(query, e)})).filter(x => x.s > 0).sort((a,b) => b.s - a.s);
    return all.slice(0, n || 8).map(x => Object.assign({score:x.s}, x.e));
  }

  // ---------- the search box (a dialog) ----------
  let dlg = null, inp = null, list = null, items = [], sel = 0, lastFocus = null;
  function build(){
    inp = h('input',{type:'search',placeholder:'Search screens, services and residents','aria-label':'Search the app',autocomplete:'off',role:'combobox','aria-expanded':'true','aria-controls':'qsList','aria-autocomplete':'list'});
    list = h('ul',{id:'qsList',class:'qs-list',role:'listbox','aria-label':'Results'});
    dlg = h('dialog',{class:'qs','aria-label':'Quick search'},
      h('form',{method:'dialog',class:'qs-form'}, h('span',{'aria-hidden':'true'},'🔎'), inp, h('button',{class:'linkbtn',type:'submit',value:'close','aria-label':'Close search'},'Esc')),
      list, h('p',{class:'small muted qs-foot'},'↑ ↓ to move, Enter to open. Typos are fine.'));
    document.body.append(dlg);
    inp.addEventListener('input', draw);
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown'){ e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp'){ e.preventDefault(); move(-1); }
      else if (e.key === 'Enter'){ e.preventDefault(); if (items[sel]) go(items[sel]); }
    });
    dlg.addEventListener('close', () => { if (lastFocus && lastFocus.focus) lastFocus.focus(); });
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  }
  function move(d){ if (!items.length) return; sel = (sel + d + items.length) % items.length; mark(); }
  function mark(){
    [...list.children].forEach((li, i) => li.setAttribute('aria-selected', i === sel ? 'true' : 'false'));
    const cur = list.children[sel]; if (cur){ inp.setAttribute('aria-activedescendant', cur.id); cur.scrollIntoView({block:'nearest'}); }
  }
  function go(it){
    dlg.close();
    if (it.chat){ if (window.SSAssistant && SSAssistant.ask) SSAssistant.ask(it.chat); location.hash = '#/assistant'; return; }
    if (location.hash === it.href) A.route(); else location.hash = it.href;
  }
  function draw(){
    const q = inp.value.trim();
    list.textContent = ''; sel = 0;
    if (!q){
      const nav = (A.NAV[S().tier] || []).filter(v => VIEWS[v] && viewOn(v)).slice(0, 8);
      items = nav.map(v => ({kind:'Screen', title:VIEWS[v].t, ic:VIEWS[v].ic, href:'#/'+v}));
    } else {
      items = find(q, 8);
      if (window.SSAssistant && VIEWS.assistant && viewOn('assistant')) items.push({kind:'Chat', title:'Ask the chat: "'+q.slice(0,60)+'"', ic:'💬', chat:q});
      if (VIEWS.check && viewOn('check')) items.push({kind:'Rules', title:'Procedure check: "'+q.slice(0,60)+'"', ic:'✅', href:'#/check/'+encodeURIComponent(q.slice(0,200))});
    }
    items.forEach((it, i) => {
      const li = h('li',{id:'qs-'+i, role:'option', 'aria-selected':i === sel ? 'true' : 'false', class:'qs-item'},
        h('span',{class:'ic','aria-hidden':'true'}, it.ic || '•'), h('span',{class:'qs-t'}, it.title), h('span',{class:'chip grey'}, it.kind));
      li.addEventListener('click', () => go(it));
      li.addEventListener('mousemove', () => { if (sel !== i){ sel = i; mark(); } });
      list.append(li);
    });
    if (!items.length) list.append(h('li',{class:'small muted',role:'presentation'},'Nothing matches yet.'));
    mark();
  }
  function open(q){
    if (window.SSStation && SSStation.holds && SSStation.holds()) return; // a shift station tablet stays on the station screen
    if (!dlg) build();
    if (dlg.open) { inp.focus(); return; }
    lastFocus = document.activeElement;
    inp.value = q || ''; draw();
    try { dlg.showModal(); } catch(e){ dlg.setAttribute('open',''); }
    inp.focus(); inp.select();
  }

  // Search button in the top bar, and keyboard shortcuts.
  const bar = document.querySelector('.top .in');
  if (bar){
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const btn = h('button',{class:'btn ghost sm qs-btn',type:'button','aria-keyshortcuts':mac ? 'Meta+K' : 'Control+K',title:'Search ('+(mac ? '⌘K' : 'Ctrl+K')+')'}, '🔎 Search', h('kbd',{class:'qs-kbd','aria-hidden':'true'}, mac ? '⌘K' : 'Ctrl K'));
    btn.addEventListener('click', () => open());
    const brand = bar.querySelector('.brand');
    if (brand && brand.nextSibling) bar.insertBefore(btn, brand.nextSibling); else bar.append(btn);
  }
  document.addEventListener('keydown', e => {
    const app = document.getElementById('app'); if (!app || app.hidden) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')){ e.preventDefault(); open(); }
    else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey){ e.preventDefault(); open(); }
  });

  // Home tile for managers and owners: where the home's policies and procedures go in.
  (A.homeHooks = A.homeHooks || []).push((v, t) => {
    if (!MGR.includes(t) || S().site === 'family' || !viewOn('setup')) return;
    const f = (S().facility || {})[S().site] || {docs:[]}, n = (f.docs || []).length;
    const procs = (S().orgProcs || []).filter(p => p.site === S().site).length;
    v.append(h('div',{class:'grid g2'},
      A.tile('setup','🗂️', n ? 'Policies and procedures ('+n+' document'+(n === 1 ? '' : 's')+')' : 'Add your policies and procedures', 'Upload the handbook and policies (PDF or Word) in Facility setup, step 2. Staff get answers from them in Ask our policy.'),
      viewOn('procedures') ? A.tile('procedures','📑', 'Map procedures to situations'+(procs ? ' ('+procs+')' : ''), 'Paste or upload a procedure and the app checks it against the law for each what-if.') : null));
  });

  window.SSSearch = {find, open, entries, score};
})();
