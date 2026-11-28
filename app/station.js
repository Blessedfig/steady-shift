// Steady Shift test app: the always-on shift station (the shared house tablet).
// A manager makes a tablet a station once. After that the app opens straight to the station after a restart, staff unlock
// their own view with a personal PIN or a shift code, it locks itself again, and the shift board (tasks, hand-off note,
// cleaning, reminders) carries over between people and restarts. It never shows owner, pay or resident screens.
// Test version: the station list, PINs and board live in this browser. In the real app the device token and the list
// live on the server, so a manager can remove a lost tablet from their own phone.
(function(){
  const A = window.SSApp, X = window.SSSched, T = window.SSTime; if (!A || !X || !T || !window.SSAccess) return;
  const {h, toast, head, R} = A;
  const S = () => A.state();
  const ap = (el, ...k) => { el.append(...k.flat(9).filter(x => x != null && x !== false)); return el; };
  const {dn, di, todayN, absA, absB, tLong, dayFmt, staffNames, shiftsAt, siteObj, field, sel} = X;
  const KEY = 'ss-station', PASS = 'ss-station-pass';
  const NAME_TRIES = 5, ALL_TRIES = 10, ALL_WINDOW = 10*60000, LOCK_MS = 5*60000;

  const hex = a => [...new Uint8Array(a)].map(x => x.toString(16).padStart(2,'0')).join('');
  const sha = async s => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const rnd = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return hex(a); };
  const nowMin = () => { const d = new Date(); return dn(A.isoDay(d))*1440 + d.getHours()*60 + d.getMinutes(); };
  const hm = d => tLong(String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'));

  // ---------- device registration ----------
  const stations = () => { const s = S(); s.stations = s.stations || []; return s.stations; };
  const dev = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e){ return null; } };
  const setDev = v => { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch(e){} };
  function here(){ const d = dev(); if (!d) return null; const r = stations().find(x => x.id === d.id); return r && !r.revoked ? r : null; }
  async function verify(){
    const d = dev(); if (!d) return null;
    const r = stations().find(x => x.id === d.id);
    if (!r || r.revoked || r.hash !== await sha(d.token)){ setDev(null); return {gone:true, r}; }
    return {r};
  }
  const passOn = () => { try { return Date.now() < +(sessionStorage.getItem(PASS) || 0); } catch(e){ return false; } };
  // ---------- care screens on the tablet (all-in-one mode for small homes and family care) ----------
  // After someone unlocks with their own PIN, they can open the everyday care screens. The tablet goes back to the
  // locked station after a few minutes without a tap, or when they press "Done, lock it". Each screen they open is logged.
  const CARE = 'ss-station-care';
  const CARE_BTNS = [['face','✅','Shift checklist'],['mar','💊','Medications'],['notes','📝','Care notes'],['report','⚠️','Report something'],['shift','🔁','Shift report'],['meals','🍽️','Meals'],['clean','🧽','Cleaning'],['night','📞','Who do I call?'],['check','❓','Ask a question'],['tabletlearn','📘','Learn the tablet']];
  // Family tablet: only the family screens (Angelika, 2026-11-28: nothing AFH or CBRF, no night help).
  const FAMILY_BTNS = [['home','🏠','Today'],['family','👪','Medicines and notes'],['handoff','🧾','Hand-off sheet'],['tabletlearn','📘','Learn the tablet']];
  // Screens those buttons link on to. Nothing here shows pay, owner, HR files or other people's schedules.
  const CARE_OK = new Set(['home','whatif','askpolicy','behavior','cards','monitor','menu','forms','sharing'].concat(CARE_BTNS.map(x => x[0]), FAMILY_BTNS.map(x => x[0])));
  const careBtns = site => (site === 'family' ? FAMILY_BTNS : CARE_BTNS).filter(x => A.VIEWS[x[0]] && SSAccess.viewOn(x[0]));
  function care(){ try { const c = JSON.parse(sessionStorage.getItem(CARE) || 'null'); return c && here() && c.site === here().site ? c : null; } catch(e){ return null; } }
  const setCare = c => { try { if (c) sessionStorage.setItem(CARE, JSON.stringify(c)); else sessionStorage.removeItem(CARE); } catch(e){} };
  const careMin = site => +(SSAccess.kioskCfg(site).careMin || 3);
  function startCare(who, site, view){
    const s = S();
    setCare({who, site, until:Date.now() + careMin(site)*60000, prev:{tier:s.tier, simple:s.simple}});
    s.tier = site === 'family' ? 'family' : 'caregiver'; s.simple = true;
    log(who, 'Opened the care screens on the tablet', site, here()); A.save(); A.fillSwitchers(); careBar();
    location.hash = '#/'+(view || 'home');
  }
  function endCare(why, stay){
    const c = care(); setCare(null);
    if (c){ const s = S(); if (c.prev){ s.tier = c.prev.tier; s.simple = c.prev.simple; } log(c.who, why || 'Locked the tablet', c.site, here()); A.save(); A.fillSwitchers(); }
    careBar();
    if (stay) return;
    if (!/^#\/kiosk/.test(location.hash)) location.hash = '#/kiosk'; else A.route();
  }
  function careBar(){
    const c = care(); let bar = document.getElementById('careBar');
    document.body.classList.toggle('carepass', !!c);
    if (!c){ if (bar) bar.remove(); return; }
    if (!bar){
      bar = h('div',{id:'careBar',class:'carebar noprint',role:'region','aria-label':'House tablet'}, h('span',{class:'cbtxt','aria-live':'polite'}), h('button',{class:'btn sm',type:'button',onclick:()=>endCare('Locked the tablet')},'Done, lock it'));
      const app = document.getElementById('app'); app.insertBefore(bar, app.firstChild);
    }
    const left = Math.max(0, Math.round((c.until - Date.now())/1000));
    bar.querySelector('.cbtxt').textContent = left <= 30 ? 'Locking in '+left+' seconds. Tap anywhere to keep going.' : c.who+' is using the tablet. It locks itself after '+careMin(c.site)+' minutes without a tap.';
    bar.classList.toggle('soon', left <= 30);
  }
  function careNav(nav, view){
    const c = care(); if (!c) return false;
    nav.append(h('div',{class:'grp'},'On the house tablet'));
    careBtns(c.site).forEach(([v, ic, t]) => nav.append(h('a',{href:'#/'+v,'aria-current':v===view?'page':null},h('span',{class:'ic','aria-hidden':'true'},ic),t)));
    nav.append(h('a',{href:'#/kiosk',onclick:e=>{ e.preventDefault(); endCare('Locked the tablet'); }},h('span',{class:'ic','aria-hidden':'true'},'🔒'),'Done, lock it'));
    return true;
  }
  let bumped = 0;
  ['pointerdown','keydown'].forEach(ev => document.addEventListener(ev, () => {
    const c = care(); if (!c || Date.now() - bumped < 5000) return;
    bumped = Date.now(); c.until = Date.now() + careMin(c.site)*60000; setCare(c); careBar();
  }, true));
  setInterval(() => { const c = care(); if (!c){ if (document.body.classList.contains('carepass')) careBar(); return; } if (Date.now() > c.until) endCare('The tablet locked itself after '+careMin(c.site)+' minutes without a tap'); else careBar(); }, 5000);
  let lastView = '';
  window.addEventListener('hashchange', () => { const c = care(), v = ((location.hash.match(/^#\/([a-z]+)/)||[])[1]) || 'home';
    if (c && v !== lastView && CARE_OK.has(v) && A.VIEWS[v]){ log(c.who, 'Opened '+A.VIEWS[v].t+' on the tablet', c.site, here()); A.save(); } lastView = v; });
  // True when this device is a station and the screen asked for is not allowed right now (the app then shows the station).
  const holds = view => { if (!here() || passOn()) return false; if (view === 'kiosk') return false; const c = care(); return !(c && CARE_OK.has(view || 'home')); };
  function log(who, what, site, r){ const s = S(); s.audit = s.audit || []; s.audit.unshift({at:new Date().toISOString(), who, what:what+(r ? ' (station: '+r.name+')' : ''), site}); if (s.audit.length > 400) s.audit.length = 400; }
  async function register(site, name, by){
    const token = rnd(32), id = 'ST'+rnd(3);
    const r = {id, site, name:name || 'House tablet', hash:await sha(token), at:new Date().toISOString(), by, lastSeen:new Date().toISOString(), revoked:false};
    stations().push(r); setDev({id, token, site});
    log(by, 'Made a tablet a shift station: '+r.name, site); A.save();
    return r;
  }
  function revoke(id, by){
    const r = stations().find(x => x.id === id); if (!r || r.revoked) return;
    r.revoked = true; r.revokedAt = new Date().toISOString(); r.revokedBy = by;
    const d = dev(); if (d && d.id === id) setDev(null);
    log(by, 'Removed shift station: '+r.name, r.site); A.save();
  }

  // ---------- wrong-PIN limits (kept in saved state, so a restart does not reset them) ----------
  function lim(site){ const s = S(); s.stationLock = s.stationLock || {}; return s.stationLock[site] || (s.stationLock[site] = {names:{}, recent:[], until:0}); }
  function blocked(site, who){
    const L = lim(site), now = Date.now();
    if (L.until > now) return 'The tablet is paused for '+Math.ceil((L.until-now)/60000)+' minutes after too many wrong tries. Ask your manager if you need in now.';
    const n = who && L.names[who];
    if (n && n.until > now) return 'Too many wrong tries for '+who+'. Try again in '+Math.ceil((n.until-now)/60000)+' minutes, or ask your manager.';
    return '';
  }
  function failed(site, who, r){
    const L = lim(site), now = Date.now();
    L.recent = L.recent.filter(t => now - t < ALL_WINDOW).concat(now);
    const n = L.names[who] = L.names[who] || {fails:0, until:0};
    n.fails++;
    let left = NAME_TRIES - n.fails;
    if (n.fails >= NAME_TRIES){ n.fails = 0; n.until = now + LOCK_MS; left = 0; log('Station', 'Locked '+(who === '__exit' ? 'the manager exit' : who === '__code' ? 'shift codes' : who)+' for 5 minutes after '+NAME_TRIES+' wrong tries', site, r); }
    if (L.recent.length >= ALL_TRIES){ L.until = now + LOCK_MS; L.recent = []; log('Station', 'Paused the tablet for 5 minutes after '+ALL_TRIES+' wrong tries in 10 minutes', site, r); }
    A.save();
    return left;
  }
  function passed(site, who){ const L = lim(site); delete L.names[who]; A.save(); }

  // ---------- shift codes ----------
  function codeFor(s){ if (!s.code){ const a = new Uint32Array(1); crypto.getRandomValues(a); s.code = String(100000 + a[0] % 900000); A.save(); } return s.code; }
  const codeOpen = s => { const n = nowMin(); return n >= absA(s) - 60 && n <= absB(s); };
  const usesCodes = site => (SSAccess.kioskCfg(site).unlock || 'both') !== 'pin';
  function codeChip(s){
    if (!s || !s.staff || !usesCodes(s.site || S().site)) return null;
    const n = nowMin(); if (absA(s) - n > 24*60 || absB(s) < n) return null;
    return h('span',{class:'chip grey',title:'Type this on the house tablet to unlock it during this shift'},'Tablet code '+codeFor(s));
  }

  // ---------- the shift board (shared by everyone on the station) ----------
  const CLEAN = ['Kitchen counters and sink','Bathrooms wiped and restocked','Trash and recycling out','High-touch spots (handles, switches, remotes)','Common room floors','Fridge: old food out, temperature checked'];
  function period(){ const d = new Date(), hr = d.getHours(); if (hr >= 6 && hr < 18) return {key:A.isoDay(d)+'|day', label:'Day shift'}; const day = hr < 6 ? new Date(d.getTime() - 86400000) : d; return {key:A.isoDay(day)+'|night', label:'Night shift'}; }
  function board(site){
    const s = S(); s.board = s.board || {};
    let b = s.board[site];
    if (!b){
      const t = new Date().toISOString(), names = staffNames(site), a = names[0] || 'Staff', c = names[1] || a;
      b = s.board[site] = {
        tasks:[{id:A.uid(), text:'Restock gloves and wipes', by:a, at:t}, {id:A.uid(), text:'Laundry: towels are in the dryer', by:c, at:t}, {id:A.uid(), text:'Recycling goes out Thursday night', by:a, at:t}],
        handoff:{text:'Quiet shift. Towels are in the dryer. The back door sticks, so pull it tight when you lock it.', by:c, at:t, read:[]}, handoffLog:[],
        clean:null, cleanLast:null,
        reminders:[{id:A.uid(), time:'10:00', text:'Check fridge and freezer temperatures', done:{}}, {id:A.uid(), time:'16:00', text:'Start the evening laundry', done:{}}, {id:A.uid(), time:'21:00', text:'Lock doors and check windows', done:{}}]};
    }
    const p = period();
    if (!b.clean || b.clean.key !== p.key){
      if (b.clean) b.cleanLast = {key:b.clean.key, done:b.clean.items.filter(i => i.by).length, of:b.clean.items.length};
      b.clean = {key:p.key, items:CLEAN.map(t => ({t}))};
      A.save();
    }
    return b;
  }
  // When the cleaning checklist (cleaning.js) is in use, the board shows and checks off that same list, so the tablet,
  // the shift checklist and the clock-out reminder always agree. The six-job list above is only the fallback.
  function realJobs(site){ try { if (window.SSClean && SSClean.shiftJobs && site === S().site && (!SSAccess.viewOn || SSAccess.viewOn('clean'))) return SSClean.shiftJobs(); } catch(e){} return null; }
  function summary(site){
    const b = board(site), today = A.isoDay(new Date()), now = new Date(), nowHM = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    const open = b.tasks.filter(t => !t.done).length, rc = realJobs(site), cl = rc ? rc.filter(j => j.done).length : b.clean.items.filter(i => i.by).length;
    const due = b.reminders.filter(r => !r.done[today] && r.time <= nowHM).length;
    const next = b.reminders.filter(r => !r.done[today] && r.time > nowHM).sort((a,c) => a.time.localeCompare(c.time))[0];
    return [open+' open task'+(open === 1 ? '' : 's'), b.handoff && b.handoff.text ? 'Hand-off note from '+b.handoff.by : 'No hand-off note', period().label+' cleaning '+cl+' of '+(rc ? rc.length : b.clean.items.length),
      due ? due+' reminder'+(due === 1 ? '' : 's')+' due' : next ? 'Next reminder '+tLong(next.time) : 'No more reminders today'];
  }

  // ---------- the station screen ----------
  let wake = null;
  async function keepAwake(){ try { if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wake){ wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch(e){} }
  document.addEventListener('visibilitychange', () => { if (/^#\/kiosk/.test(location.hash)) keepAwake(); });

  R.kiosk = v => {
    if (care()) endCare('Locked the tablet', true);
    const st = here(), temp = !st;
    const site = st ? st.site : S().site;
    if (st && S().site !== site){ S().site = site; A.save(); A.fillSwitchers(); }
    if (!st){
      if (!['manager','owner','multi','family'].includes(S().tier)){ ap(v, head('House tablet', 'A manager sets up the house tablet', 'Switch "View as" to House manager to open it.')); return; }
    }
    const k = SSAccess.kioskCfg(site);
    if (!k.on){ ap(v, head('House tablet', 'House tablet sign-in is off for this home', 'Turn it on in Services and access.'), temp ? h('a',{class:'btn ghost',href:'#/access'},'Services and access') : null); return; }
    document.body.classList.add('kiosk');
    const stage = h('div',{class:'kstage'});
    let timer = null, who = null, clockT = null;
    const lockMs = () => (k.lockSec || 20)*1000;
    const arm = (ms) => { clearTimeout(timer); timer = setTimeout(lock, ms || (who ? Math.max(lockMs(), 60000) : lockMs())); };
    ['pointerdown','keydown','input'].forEach(e => stage.addEventListener(e, () => arm()));
    const say = (n, what) => { log(n, what, site, st); A.save(); };
    const unlocks = k.unlock || 'both';

    function lock(){
      clearTimeout(timer); clearInterval(clockT); if (who) say(who, 'Station locked'); who = null; stage.textContent = '';
      if (st){ const t = Date.now(); if (!st.lastSeen || t - Date.parse(st.lastSeen) > 300000){ st.lastSeen = new Date().toISOString(); A.save(); } }
      const when = h('p',{class:'muted'});
      const tick = () => { const t = new Date(); when.textContent = t.toLocaleDateString(undefined,{weekday:'long', month:'long', day:'numeric'})+' · '+hm(t); };
      tick(); clockT = setInterval(tick, 30000);
      const stop = blocked(site);
      ap(stage, h('div',{class:'khead'}, h('span',{class:'mark','aria-hidden':'true'}), h('div',null, h('h1',null,siteObj(site).name+(st ? '' : ' (trying it out)')), when)),
        h('div',{class:'card soft kboard',role:'region','aria-label':'Shift board summary'}, h('b',null,'Shift board'), h('ul',{class:'ksum'}, summary(site).map(x => h('li',null,x))), h('span',{class:'small muted'},'Unlock to see and update it.')),
        stop ? h('div',{class:'card alert',role:'alert'}, stop) : null,
        !stop && unlocks !== 'code' ? [h('h2',null,'Tap your name'), h('div',{class:'kgrid'}, staffNames(site).map(n => { const c = T.current(site, n); return h('button',{class:'kname',type:'button',onclick:()=>pin(n)}, h('b',null,n), h('span',{class:'small'}, c ? 'On the clock' : '')); }))] : null,
        !stop && unlocks !== 'pin' ? h('div',{class:'row'}, h('button',{class:unlocks === 'code' ? 'btn big' : 'btn ghost',type:'button',onclick:code},'Use my shift code')) : null,
        h('div',{class:'row',style:'justify-content:space-between'},
          h('p',{class:'small muted'},'Test version: sample PINs are 1234, the manager exit PIN is 0000. Locks after '+(k.lockSec||20)+' seconds.'),
          h('div',{class:'row'},
            document.fullscreenEnabled && !document.fullscreenElement ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>document.documentElement.requestFullscreen().catch(() => toast('Full screen is not available here'))},'Full screen') : null,
            h('button',{class:'btn quiet sm',type:'button',onclick:exit},'Manager menu'))));
      keepAwake();
    }
    function pad(onDone, label, max){
      const inp = h('input',{type:'password',inputmode:'numeric',autocomplete:'off',maxlength:String(max||6),class:'kpin','aria-label':label});
      const keys = h('div',{class:'kpad'}, ['1','2','3','4','5','6','7','8','9','⌫','0','OK'].map(d => h('button',{type:'button',class:'kkey'+(d==='OK'?' ok':''),'aria-label':d==='⌫'?'Delete':d==='OK'?'Enter':d,onclick:()=>{ if (d==='⌫') inp.value = inp.value.slice(0,-1); else if (d==='OK') onDone(inp.value); else if (inp.value.length < (max||6)) inp.value += d; inp.focus(); }}, d)));
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') onDone(inp.value); });
      setTimeout(() => inp.focus(), 30);
      return [inp, keys];
    }
    function tries(left){ return left > 0 ? left+' tr'+(left === 1 ? 'y' : 'ies')+' left before a 5 minute pause.' : 'Paused for 5 minutes.'; }
    function pin(n){
      arm(); clearInterval(clockT); stage.textContent = '';
      const msg = h('p',{class:'small','aria-live':'assertive'});
      const [inp, keys] = pad(async val => {
        const b = blocked(site, n); if (b){ msg.textContent = b; return; }
        if (await SSAccess.checkPin(site, n, val)){ passed(site, n); open(n, 'PIN'); }
        else { const left = failed(site, n, st); inp.value = ''; msg.textContent = 'That PIN did not match. '+tries(left); if (left <= 0) setTimeout(lock, 2500); }
      }, 'PIN for '+n);
      ap(stage, h('h2',null,'Hi, '+n), h('p',{class:'muted'},'Type your PIN'), inp, keys, msg, h('button',{class:'btn quiet',type:'button',onclick:lock},'Not me'));
    }
    function code(){
      arm(); clearInterval(clockT); stage.textContent = '';
      const msg = h('p',{class:'small','aria-live':'assertive'});
      const [inp, keys] = pad(async val => {
        const b = blocked(site, '__code'); if (b){ msg.textContent = b; return; }
        const s = /^\d{6}$/.test(val) && shiftsAt(site).find(x => x.staff && x.code === val && codeOpen(x));
        if (s){ passed(site, '__code'); open(s.staff, 'shift code'); }
        else { const left = failed(site, '__code', st); inp.value = ''; msg.textContent = 'That code is not open right now. Codes work from an hour before your shift until it ends. '+tries(left); if (left <= 0) setTimeout(lock, 2500); }
      }, 'Shift code', 6);
      ap(stage, h('h2',null,'Shift code'), h('p',{class:'muted'},'Type the 6 digit code from your schedule in the app, or ask your manager.'), inp, keys, msg, h('button',{class:'btn quiet',type:'button',onclick:lock},'Back'));
    }
    function open(n, how){ who = n; say(n, 'Unlocked the station with a '+how); menu(); }
    function done(r){ stage.textContent = ''; ap(stage, h('div',{class:'card calm',role:'status'}, !r.err && /^Clocked out/.test(r.msg||'') ? A.art('handoff') : null, h('h2',null, r.err ? 'Not done' : 'Done'), h('p',null, r.err || r.msg), h('p',{class:'small muted'},'Locking now.'))); arm(3500); }
    function menu(){
      arm(); stage.textContent = '';
      const n = who, out = h('div',{class:'grid'});
      const row = h('div',{class:'row'},
        h('button',{class:'btn',type:'button',onclick:()=>boardView(out)},'Shift board'),
        k.allow.sched ? h('button',{class:'btn ghost',type:'button',onclick:()=>{ const t = todayN(); const mine = shiftsAt(site).filter(s => s.staff === n && dn(s.date) >= t && dn(s.date) < t+7).sort((a,b) => absA(a)-absA(b));
          out.textContent = ''; ap(out, h('h3',null,'Your next 7 days'), mine.length ? h('div',{class:'list'}, mine.map(s => h('div',{class:'item'}, h('b',null,dayFmt(dn(s.date))+' · '+tLong(s.start)+' to '+tLong(s.end)), codeChip(s)))) : h('p',{class:'muted'},'No shifts.')); }},'My schedule') : null,
        k.allow.req ? h('button',{class:'btn ghost',type:'button',onclick:()=>{ const from = h('input',{type:'date',value:di(todayN()+7)}), to = h('input',{type:'date',value:di(todayN()+7)});
          out.textContent = ''; ap(out, h('h3',null,'Ask for time off'), h('div',{class:'grid g2'}, field('From', from), field('To', to)), h('button',{class:'btn',type:'button',onclick:()=>{ if (!from.value || to.value < from.value){ toast('Check the dates'); return; }
            X.ensure().requests.push({id:A.uid(), site, type:'timeoff', by:n, from:from.value, to:to.value, pto:'PTO', status:'Pending', at:new Date().toISOString(), note:'Sent from the house tablet'}); say(n, 'Asked for time off'); done({msg:'Sent to your manager. You will see the answer in the app.'}); }},'Send')); }},'Ask for time off') : null,
        h('button',{class:'btn quiet',type:'button',onclick:lock},'Done, lock it'));
      const btns = k.care && st ? careBtns(site) : [];
      const grid = btns.length ? [h('h3',null,'What do you need?'), h('div',{class:'biggrid'}, btns.map(([id, ic, t]) => h('button',{class:'bigbtn',type:'button',onclick:()=>{ clearTimeout(timer); clearInterval(clockT); document.body.classList.remove('kiosk'); who = null; startCare(n, site, id); }}, h('span',{class:'ic','aria-hidden':'true'},ic), h('b',null,t))))] : null;
      ap(stage, h('h2',null,n), k.allow.clock && site !== 'family' ? T.clockCard(site, n, 'kiosk', done) : null, grid, row, out);
    }
    function boardView(out){
      arm(); const n = who, b = board(site), today = A.isoDay(new Date());
      const redo = () => { A.save(); boardView(out); };
      const when = iso => dayFmt(dn(A.isoDay(new Date(iso))),{weekday:'short'})+' '+hm(new Date(iso));
      out.textContent = '';
      // tasks
      const tIn = h('input',{type:'text',maxlength:'120','aria-label':'New task',placeholder:'Something the next person should do'});
      const add = () => { const t = tIn.value.trim(); if (!t) return; b.tasks.unshift({id:A.uid(), text:t, by:n, at:new Date().toISOString()}); say(n, 'Added a shift task'); redo(); };
      tIn.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
      const openT = b.tasks.filter(t => !t.done), doneT = b.tasks.filter(t => t.done).slice(0, 8);
      const tick = (t, label, on) => { const id = 'bt_'+t.id; return h('label',{class:'row kcheck',for:id}, h('input',{type:'checkbox',id,checked:on,onchange:e=>{ if (e.target.checked){ t.done = true; t.doneBy = n; t.doneAt = new Date().toISOString(); say(n, 'Finished a shift task'); } else { t.done = false; delete t.doneBy; delete t.doneAt; say(n, 'Reopened a shift task'); } b.tasks = b.tasks.filter(x => !x.done).concat(b.tasks.filter(x => x.done).slice(0, 20)); redo(); }}), label); };
      ap(out, h('div',{class:'card'}, h('h3',null,'Tasks ('+openT.length+' open)'),
        h('p',{class:'small muted'},'House jobs only. Keep resident names and health details in the resident\'s record.'),
        openT.length ? h('div',{class:'list'}, openT.map(t => tick(t, h('span',null, t.text, h('span',{class:'small muted'},' · added by '+t.by+', '+when(t.at))), false))) : h('p',{class:'muted'},'Nothing open.'),
        h('div',{class:'row'}, tIn, h('button',{class:'btn sm',type:'button',onclick:add},'Add')),
        doneT.length ? h('details',null, h('summary',{class:'small'},'Recently finished'), h('div',{class:'list'}, doneT.map(t => tick(t, h('span',{class:'small'}, t.text+' · '+t.doneBy+', '+when(t.doneAt)), true)))) : null));
      // follow-up checks due (resident codes only; the checks themselves are entered in the app)
      const mon = window.SSMonitor ? SSMonitor.pending(site) : [];
      if (mon.length) ap(out, h('div',{class:'card warn'}, h('h3',null,'Follow-up checks due ('+mon.length+')'),
        h('ul',null, mon.map(x => h('li',null, h('b',null,x.res+': '), x.text))),
        h('p',{class:'small muted'},'Enter them under Follow-up checks in the app. A reading outside the limits means call the nurse.')));
      // hand-off note
      const ho = b.handoff, note = h('textarea',{rows:'3',maxlength:'600','aria-label':'Hand-off note for the next person'});
      const read = ho && ho.read.some(r => r.by === n);
      ap(out, h('div',{class:'card'}, h('h3',null,'Hand-off note'),
        ho && ho.text ? h('div',{class:'item'}, h('p',null,ho.text), h('span',{class:'small muted'},'From '+ho.by+', '+when(ho.at)+(ho.read.length ? ' · read by '+ho.read.map(r => r.by).join(', ') : '')),
          ho.by !== n && !read ? h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ ho.read.push({by:n, at:new Date().toISOString()}); say(n, 'Read the hand-off note'); redo(); }},'I read this') : null) : h('p',{class:'muted'},'No note yet.'),
        field('Write the note for the next person (replaces the one above)', note),
        h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ const t = note.value.trim(); if (!t){ toast('Write the note first'); return; }
          if (ho && ho.text) b.handoffLog = [ho].concat(b.handoffLog || []).slice(0, 5);
          b.handoff = {text:t, by:n, at:new Date().toISOString(), read:[]}; say(n, 'Wrote the hand-off note'); redo(); toast('Saved for the next person'); }},'Save note')),
        h('p',{class:'small muted'},'For anything about a resident\'s care, use the hand-off packet or report screens in the app.')));
      // cleaning
      const rj = realJobs(site);
      if (rj) ap(out, h('div',{class:'card'}, h('h3',null,period().label+' cleaning ('+rj.filter(j => j.done).length+' of '+rj.length+')'),
        h('div',{class:'list'}, rj.map((j, i) => { const id = 'bj_'+i; return h('label',{class:'row kcheck',for:id}, h('input',{type:'checkbox',id,checked:j.done,onchange:e=>{
            const r = SSClean.markJob(j.id, e.target.checked, n);
            if (r === 'photo'){ e.target.checked = false; toast('Photo proof is on for you. Check this one on the Cleaning screen with a photo.'); return; }
            say(n, (e.target.checked ? 'Cleaning done: ' : 'Cleaning unchecked: ')+j.text); redo(); }}),
          h('span',null, j.text, j.done && j.by ? h('span',{class:'small muted'},' · '+j.by+(j.at ? ', '+hm(new Date(j.at)) : '')) : null)); }))));
      const cl = b.clean;
      if (!rj) ap(out, h('div',{class:'card'}, h('h3',null,period().label+' cleaning ('+cl.items.filter(i => i.by).length+' of '+cl.items.length+')'),
        h('div',{class:'list'}, cl.items.map((it, i) => { const id = 'bc_'+i; return h('label',{class:'row kcheck',for:id}, h('input',{type:'checkbox',id,checked:!!it.by,onchange:e=>{ if (e.target.checked){ it.by = n; it.at = new Date().toISOString(); say(n, 'Cleaning done: '+it.t); } else { delete it.by; delete it.at; say(n, 'Cleaning unchecked: '+it.t); } redo(); }}),
          h('span',null, it.t, it.by ? h('span',{class:'small muted'},' · '+it.by+', '+hm(new Date(it.at))) : null)); })),
        b.cleanLast ? h('p',{class:'small muted'},'Last shift finished '+b.cleanLast.done+' of '+b.cleanLast.of+'.') : null));
      // reminders
      const nowHM = String(new Date().getHours()).padStart(2,'0')+':'+String(new Date().getMinutes()).padStart(2,'0');
      const rT = h('input',{type:'time',value:'12:00','aria-label':'Reminder time'}), rX = h('input',{type:'text',maxlength:'100','aria-label':'Reminder',placeholder:'Daily reminder'});
      ap(out, h('div',{class:'card'}, h('h3',null,'Daily reminders'),
        h('div',{class:'list'}, b.reminders.slice().sort((a,c) => a.time.localeCompare(c.time)).map(r => { const d = r.done[today];
          return h('div',{class:'item'}, h('div',{class:'meta'}, h('span',{class:'chip '+(d ? 'calm' : r.time <= nowHM ? 'amber' : 'grey')}, tLong(r.time)+(d ? ' · done' : r.time <= nowHM ? ' · due' : '')), h('b',null,r.text)),
            d ? h('span',{class:'small muted'},'Done by '+d.by+', '+hm(new Date(d.at))) : h('div',{class:'row'}, h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ r.done = {[today]:{by:n, at:new Date().toISOString()}}; say(n, 'Reminder done: '+r.text); redo(); }},'Mark done'),
              h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ b.reminders = b.reminders.filter(x => x !== r); say(n, 'Removed a reminder: '+r.text); redo(); }},'Remove'))); })),
        h('div',{class:'row'}, h('div',{style:'max-width:9rem'}, rT), rX, h('button',{class:'btn sm',type:'button',onclick:()=>{ const t = rX.value.trim(); if (!t || !rT.value){ toast('Add a time and a reminder'); return; } b.reminders.push({id:A.uid(), time:rT.value, text:t, done:{}}); say(n, 'Added a reminder: '+t); redo(); }},'Add'))));
    }
    function exit(){
      arm(); clearInterval(clockT); stage.textContent = '';
      const msg = h('p',{class:'small','aria-live':'assertive'});
      const [inp, keys] = pad(async val => {
        const b = blocked(site, '__exit'); if (b){ msg.textContent = b; return; }
        if (await SSAccess.checkPin(site, '__exit', val)){ passed(site, '__exit'); say('Manager', 'Opened the station manager menu'); manager(); }
        else { const left = failed(site, '__exit', st); inp.value = ''; msg.textContent = 'Wrong PIN. '+tries(left); if (left <= 0) setTimeout(lock, 2500); }
      }, 'Manager exit PIN');
      ap(stage, h('h2',null,'Manager'), h('p',{class:'muted'},'Type the manager exit PIN'), inp, keys, msg, h('button',{class:'btn quiet',type:'button',onclick:lock},'Cancel'));
    }
    function leave(hash){ clearTimeout(timer); clearInterval(clockT); document.body.classList.remove('kiosk'); location.hash = hash; }
    function manager(){
      arm(60000); stage.textContent = '';
      if (temp){ ap(stage, h('h2',null,'Manager'), h('div',{class:'row'}, h('button',{class:'btn',type:'button',onclick:()=>{ say('Manager', 'Left house tablet mode'); leave('#/access'); }},'Leave tablet mode'), h('button',{class:'btn quiet',type:'button',onclick:lock},'Back to the station'))); return; }
      const sure = h('div',{class:'row',hidden:true}, h('span',{class:'small'},'This tablet will need a manager to set it up again.'),
        h('button',{class:'btn sm',type:'button',onclick:()=>{ revoke(st.id, 'Manager'); try { sessionStorage.removeItem(PASS); } catch(e){} leave('#/access'); }},'Yes, remove it'));
      ap(stage, h('h2',null,'Manager: '+st.name),
        h('p',{class:'small muted'},'Station since '+A.fmtDate(st.at)+'. Locks after '+(k.lockSec||20)+' seconds. Unlock with '+({pin:'personal PINs',code:'shift codes',both:'personal PINs or shift codes'})[unlocks]+'.'),
        h('div',{class:'row'},
          h('button',{class:'btn quiet',type:'button',onclick:lock},'Back to the station'),
          h('button',{class:'btn ghost',type:'button',onclick:()=>{ try { sessionStorage.setItem(PASS, String(Date.now() + 10*60000)); } catch(e){} say('Manager', 'Opened the full app for 10 minutes'); toast('Full app open for 10 minutes, then the station comes back'); leave('#/access'); }},'Open the full app for 10 minutes'),
          h('button',{class:'btn quiet',type:'button',onclick:()=>{ sure.hidden = false; }},'Stop using this tablet as a station')), sure);
    }
    ap(v, stage); lock();
    say(st ? 'Station' : 'Manager', st ? 'Station opened' : 'Opened house tablet mode (trying it out)');
    const off = () => { if (!/^#\/kiosk/.test(location.hash)){ document.body.classList.remove('kiosk'); clearTimeout(timer); clearInterval(clockT); window.removeEventListener('hashchange', off); } };
    window.addEventListener('hashchange', off);
  };

  // ---------- manager setup card (Services and access) ----------
  function setupCard(site){
    if (!['manager','owner','multi','family'].includes(S().tier)) return null;
    const k = SSAccess.kioskCfg(site), mine = here(), list = stations().filter(x => x.site === site);
    const by = A.tier().name;
    const nameIn = h('input',{type:'text',maxlength:'40',value:'Kitchen tablet','aria-label':'Station name'});
    const how = sel([['both','Personal PIN or shift code'],['pin','Personal PIN only'],['code','Shift code only']], k.unlock || 'both');
    how.addEventListener('change', () => { k.unlock = how.value; SSAccess.log('Shift station unlock set to: '+how.options[how.selectedIndex].text, site); A.save(); });
    const n = nowMin();
    const todays = shiftsAt(site).filter(s => s.staff && absB(s) >= n && absA(s) - n <= 24*60).sort((a,b) => absA(a)-absA(b));
    const codes = h('div',{class:'list'});
    const showCodes = () => { codes.textContent = ''; ap(codes, todays.length ? todays.map(s => h('div',{class:'item'}, h('b',null,s.staff+' · '+dayFmt(dn(s.date),{weekday:'short'})+' '+tLong(s.start)+' to '+tLong(s.end)), h('b',{class:'code'},codeFor(s)))) : h('p',{class:'muted'},'No shifts in the next 24 hours.')); SSAccess.log('Viewed today\'s shift codes', site); A.save(); };
    const step = (...x) => h('li',null,...x);
    const careSw = h('input',{type:'checkbox',id:'k_care',checked:!!k.care,onchange:e=>{ k.care = e.target.checked; SSAccess.log('House tablet care screens '+(k.care ? 'on' : 'off'), site); A.save(); }});
    const careMinSel = sel([['2','2 minutes'],['3','3 minutes'],['5','5 minutes']], String(k.careMin || 3));
    careMinSel.addEventListener('change', () => { k.careMin = +careMinSel.value; SSAccess.log('House tablet care screens lock after '+k.careMin+' minutes', site); A.save(); });
    return h('div',{class:'card'}, h('h2',null,'Shift station (always-on house tablet)'),
      h('div',{class:'row'}, h('a',{class:'btn ghost sm',href:'#/tablet'},'Guided setup for one central tablet'), h('a',{class:'btn quiet sm',href:'#/tabletlearn'},'Learn the tablet (training)')),
      h('label',{class:'row small',for:'k_care'}, careSw, 'All-in-one: after unlocking, people can open the everyday care screens (medications, notes, reports, checklist)'),
      h('div',{class:'grid g2'}, field('Care screens lock after no taps for', careMinSel)),
      h('p',{class:'small'},'Set it up once on the tablet. It stays signed in through restarts, opens straight to the station, and locks itself after each person. Staff unlock with their own PIN or a shift code. It never shows owner, pay or resident screens.'),
      mine ? h('div',{class:'card soft',role:'status'}, h('b',null,'This device is the shift station "'+mine.name+'".'), h('span',{class:'small'},'It opens to the station when the app starts. Use the Manager button on the station to step out.'), h('div',{class:'row'}, h('a',{class:'btn sm',href:'#/kiosk'},'Back to the station')))
        : h('div',{class:'grid'}, h('b',null,'Make this device a station'), h('div',{class:'grid g2'}, field('Station name', nameIn), field('How staff unlock it', how)),
            h('div',{class:'row'}, h('button',{class:'btn',type:'button',onclick:async ()=>{ const r = await register(site, nameIn.value.trim() || 'House tablet', by); toast('This device is now the station "'+r.name+'"'); location.hash = '#/kiosk'; }},'Make this device a shift station'),
              h('a',{class:'btn quiet sm',href:'#/kiosk'},'Just try it without saving'))),
      list.length ? h('div',null, h('h3',null,'Stations for this home'), h('div',{class:'list'}, list.map(r => h('div',{class:'item'},
        h('div',{class:'meta'}, h('span',{class:'chip '+(r.revoked ? 'grey' : 'calm')}, r.revoked ? 'Removed' : 'Active'), mine && mine.id === r.id ? h('span',{class:'chip'},'This device') : null),
        h('b',null,r.name), h('span',{class:'small muted'},'Set up by '+r.by+' on '+A.fmtDate(r.at)+(r.revoked ? ' · removed by '+r.revokedBy+' on '+A.fmtDate(r.revokedAt) : ' · last used '+A.fmtDate(r.lastSeen))),
        r.revoked ? null : h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ revoke(r.id, by); toast('Removed. That tablet will need a manager to set it up again.'); A.route(); }},'Remove this station'))))),
        h('p',{class:'small muted'},'Test version: this list lives on this device. In the real app it lives on the server, so you can remove a lost or stolen tablet from your own phone.')) : null,
      usesCodes(site) ? h('details',null, h('summary',{class:'small',onclick:e=>{ if (!e.currentTarget.parentNode.open) showCodes(); }},'Shift codes for the next 24 hours'), h('p',{class:'small muted'},'Staff also see their own code in their schedule. A code works from an hour before the shift until it ends.'), codes) : null,
      h('details',null, h('summary',{class:'small'},'How to set up the tablet'),
        h('h3',null,'Android tablet'),
        h('ol',{class:'small steps'},
          step('Open the app link in Chrome and sign in as the manager.'),
          step('Tap the Chrome menu (⋮), then "Install app" or "Add to Home screen". Open Steady Shift from the new icon so it runs full screen.'),
          step('In the app, go to Services and access and tap "Make this device a shift station".'),
          step('Lock the tablet to the app: Settings, then Security (or Security and privacy, More security settings), then turn on App pinning and "Ask for PIN before unpinning". Open Steady Shift, open Recent apps, tap the app icon at the top, then Pin.'),
          step('Settings, Display: set the screen timeout to the longest. Keep the tablet plugged in. Under Battery, set Steady Shift and Chrome to "Unrestricted".'),
          step('After a restart, open Steady Shift and pin it again. It is still signed in and opens to the station.')),
        h('p',{class:'small muted'},'Several tablets? A device management service (Android Enterprise "dedicated device" mode) can lock them to the app without pinning by hand.'),
        h('h3',null,'iPad'),
        h('ol',{class:'small steps'},
          step('Open the app link in Safari, tap Share, then "Add to Home Screen".'),
          step('Open Steady Shift from the Home Screen and sign in there. The Home Screen app keeps its own sign-in, separate from Safari.'),
          step('In the app, go to Services and access and tap "Make this device a shift station".'),
          step('Settings, Accessibility, Guided Access: turn it on and set a passcode only the manager knows.'),
          step('Open Steady Shift, triple-click the top (or Home) button, and tap Start. Staff cannot leave the app until the manager ends Guided Access.'),
          step('Settings, Display and Brightness: set Auto-Lock to Never while it is plugged in. After a restart, open the app and start Guided Access again.')),
        h('p',{class:'small muted'},'The station keeps the screen on while it is open where the tablet allows it. Use a wall or stand mount near the staff area, away from where visitors sit.')));
  }

  // Full app pass for a manager runs out: go back to the station.
  setInterval(() => { if (holds(((location.hash.match(/^#\/([a-z]+)/)||[])[1]) || 'home') && !/^#\/kiosk/.test(location.hash) && !document.getElementById('app').hidden) location.hash = '#/kiosk'; }, 30000);

  setTimeout(careBar, 0);
  window.SSStation = {here, holds, care, careNav, startCare, endCare, careBtns, verify, register, revoke, setupCard, codeChip, codeFor, board, summary, stations};
})();
