// Steady Shift test app: Priority care updates (#/alerts).
// When a medical change goes live in the middle of a shift (a nurse-checked order, a fax or email line approved in
// Faxes and emails, a changed or stopped order, or a precaution a nurse or manager posts), everyone on shift gets a
// high-priority alert right away: a banner on every screen and on the house tablet, a sound and vibration, and a
// phone notification. Each person on shift confirms they read it. Anyone who hasn't is reminded every few minutes;
// if nobody confirms in time it goes to the manager or on-call person; whatever is still open at shift change is
// carried into the shift change report and the next shift must confirm it.
// It watches the shared order store (S.orders), so every way an order goes live raises it, with no AI and no cost.
// Lock screens and the locked house tablet show only "Priority care update" and the resident code (initials or room
// in the real app), never the order itself.
// Test version: sample data only, kept in this browser. Changes made in another tab of this browser arrive live
// (storage events). The real app sends the same alert to every phone through Supabase Realtime and Web Push.
(function(){
  const A = window.SSApp; if (!A) return;
  const {D, h, toast, fmtTime, head, R, VIEWS, NAV, isoDay, uid} = A;
  const S = () => A.state();
  const sname = id => (D.SITES.find(x => x.id === id)||{}).name || id;
  const MGR = ['manager','rn','owner','multi'];
  const URGENT_KINDS = ['med','diet','activity','monitor','other'];
  const KIND_WORD = {med:'Medication', diet:'Diet', activity:'Care task', monitor:'Monitoring', other:'Instruction', appointment:'Appointment', lab:'Lab'};
  const DEF = {realert:5, escalate:15};

  function st(){
    const s = S();
    if (!s.alerts || s.alerts.v !== 1){
      s.alerts = {v:1, seen:{}, list:[], cfg:{}, sound:false};
      (s.orders||[]).forEach(o => s.alerts.seen[o.id] = sig(o));   // existing orders never alert
      A.save();
    }
    return s.alerts;
  }
  const cfg = site => Object.assign({}, DEF, st().cfg[site]||{});
  const sig = o => [o.status, o.start||'', o.end||'', o.text||''].join('|');
  const nowIso = () => new Date().toISOString();
  const mins = (a, b) => (new Date(b) - new Date(a)) / 60000;

  // ---------- who is on shift now (scheduler, else the first two staff) ----------
  function shiftWindow(sh){
    const T = window.SSSched.tmin, st0 = new Date(sh.date+'T00:00:00'); const s = new Date(st0.getTime() + T(sh.start)*60000);
    let e = new Date(st0.getTime() + T(sh.end)*60000); if (e <= s) e = new Date(e.getTime() + 86400000);
    return {s, e};
  }
  function onShift(site, at){
    at = at ? new Date(at) : new Date();
    try {
      if (window.SSSched && SSSched.shiftsAt){
        const list = SSSched.shiftsAt(site).filter(sh => sh.staff && sh.kind !== 'training').map(sh => Object.assign({}, sh, shiftWindow(sh))).filter(sh => sh.s <= at && at < sh.e);
        if (list.length) return {names:[...new Set(list.map(sh => sh.staff))], ends:new Date(Math.max(...list.map(sh => sh.e.getTime()))).toISOString()};
      }
    } catch(e){}
    const names = ((S().staff||{})[site]||[]).map(p => p.n).slice(0, 2);
    const hr = at.getHours(), end = new Date(at); end.setMinutes(0,0,0);
    end.setHours(hr < 6 ? 6 : hr < 14 ? 14 : hr < 22 ? 22 : 30);
    return {names:names.length ? names : ['Staff on shift'], ends:end.toISOString()};
  }
  function onCall(site){
    try { const oc = (SSSched.ensure().oncall||{})[site] || {def:'Manager', days:{}}; return oc.days[isoDay(new Date())] || oc.def; } catch(e){ return 'Manager'; }
  }

  // ---------- raising alerts ----------
  function raise(site, x){
    const o = st(), sh = onShift(site);
    const a = Object.assign({id:'al-'+uid(), site, at:nowIso(), need:sh.names.slice(), shiftEnds:sh.ends, acks:[], pings:[nowIso()], escalated:null, escalatedTo:'', carried:false, closed:false}, x);
    o.list.unshift(a); A.save(); ping(a, true); return a;
  }
  // Watch the order store: anything newly nurse-checked, changed or stopped raises one alert.
  function scan(){
    const s = S(), o = st(); let n = 0;
    (s.orders||[]).forEach(ord => {
      const now = sig(ord), was = o.seen[ord.id];
      if (was === now) return;
      o.seen[ord.id] = now;
      if (ord.status !== 'verified' || !URGENT_KINDS.includes(ord.kind)) return;
      const ended = ord.end && ord.end < isoDay(new Date());
      let kind = 'new';
      if (was && was.startsWith('verified')) kind = ended ? 'stop' : 'change';
      else if (ord.replaces) kind = 'change';
      if (kind === 'new' && ended) return;
      // a "replaces" order and the order it ends arrive together; the new order's alert is enough
      if (kind !== 'new' && (s.orders||[]).some(x => x.replaces === ord.id)) return;
      const source = ord.outsideMsg ? (ord.source||'Fax or email')+' from '+(ord.prescriber||'a clinician') : 'Doctor orders, checked by '+(ord.verifiedBy||'the nurse');
      raise(ord.site, {res:ord.res, kind, order:ord.id, what:KIND_WORD[ord.kind]||'Order', text:kind === 'stop' ? 'Stopped: '+ord.text : ord.text, source});
      n++;
    });
    if (n) A.save();
    return n;
  }

  // ---------- reminders, escalation and carry-over (every 30 seconds) ----------
  function tick(){
    const o = st(), now = new Date(); let changed = false;
    o.list.filter(a => !a.closed).forEach(a => {
      const c = cfg(a.site), missing = a.need.filter(n => !a.acks.some(k => k.n === n));
      if (!missing.length){ a.closed = true; changed = true; return; }
      if (a.shiftEnds && now >= new Date(a.shiftEnds) && !a.carried){
        const nx = onShift(a.site); a.carried = true; a.need = [...new Set(a.need.concat(nx.names))]; a.shiftEnds = nx.ends; changed = true;
        ping(a, true);
      }
      const last = a.pings[a.pings.length-1];
      if (mins(last, now) >= c.realert){ a.pings.push(now.toISOString()); changed = true; ping(a, false); }
      if (!a.escalated && !a.acks.length && mins(a.at, now) >= c.escalate){ a.escalated = now.toISOString(); a.escalatedTo = onCall(a.site); changed = true; ping(a, true, true); }
    });
    if (changed){ A.save(); paint(); }
  }

  // ---------- sound, vibration and the lock-screen notification (no order text) ----------
  let actx = null;
  function beep(){
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); [0, 0.25].forEach(t => { const g = actx.createGain(), os = actx.createOscillator(); os.frequency.value = 880; g.gain.value = 0.15; os.connect(g); g.connect(actx.destination); os.start(actx.currentTime + t); os.stop(actx.currentTime + t + 0.15); }); } catch(e){}
  }
  function lockText(a, esc){ return {title:esc ? 'Not yet confirmed: priority care update' : 'Priority care update', body:sname(a.site)+' · Resident '+(a.res||'')+'. Open Steady Shift to read and confirm.'}; }
  function ping(a, loud, esc){
    if (a.site !== S().site && !['owner','multi'].includes(S().tier)) return;
    if (!st().sound) return;
    beep(); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch(e){}
    if (document.visibilityState === 'visible' && !loud) return;
    try {
      if ('Notification' in window && Notification.permission === 'granted'){
        const t = lockText(a, esc), opt = {body:t.body, tag:'ss-alert-'+a.id, renotify:true, requireInteraction:true, icon:'icons/icon-192.png'};
        if (navigator.serviceWorker) navigator.serviceWorker.getRegistration().then(r => r ? r.showNotification(t.title, opt) : new Notification(t.title, opt)).catch(() => { try { new Notification(t.title, opt); } catch(e){} }); // .ready never settles when no worker is registered
        else new Notification(t.title, opt);
      }
    } catch(e){}
  }
  async function enableSound(){
    st().sound = true; A.save(); beep();
    try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch(e){}
    toast(('Notification' in window && Notification.permission === 'granted') ? 'Alerts will sound and show on this device' : 'Alerts will sound on this device. Notifications are blocked in this browser.');
    A.route();
  }

  // ---------- confirming ----------
  async function confirmAs(a, name, pin, kiosk){
    if (!name){ toast('Pick your name'); return false; }
    if (kiosk && window.SSAccess && SSAccess.checkPin && !(await SSAccess.checkPin(a.site, name, pin))){ toast('That PIN did not match'); return false; }
    if (!a.acks.some(k => k.n === name)) a.acks.push({n:name, at:nowIso(), via:kiosk ? 'House tablet' : 'Own device'});
    if (!a.need.includes(name)) a.need.push(name);
    if (a.need.every(n => a.acks.some(k => k.n === n))) a.closed = true;
    A.save(); toast('Confirmed. Thank you.'); return true;
  }
  const myName = () => { try { return SSSched.me(); } catch(e){ return A.tier().name; } };
  const openFor = site => st().list.filter(a => a.site === site && !a.closed);

  function alertCard(a, opts){
    opts = opts || {};
    const kiosk = !!opts.kiosk, locked = !!opts.locked;
    const missing = a.need.filter(n => !a.acks.some(k => k.n === n));
    const verb = {new:'New', change:'Changed', stop:'Stopped', precaution:'Precaution'}[a.kind] || 'Update';
    const box = h('div',{class:'item',role:'alert',style:'border-left:5px solid var(--red);background:var(--red-soft)'},
      h('div',{class:'meta'}, h('span',{class:'chip',style:'background:var(--red);color:#fff'},'Priority'), h('span',null,verb+(a.what?' · '+a.what:'')), h('b',null,'Resident '+(a.res||'')), h('span',null,fmtTime(a.at)),
        a.carried ? h('span',{class:'chip amber'},'Carried from last shift') : null, a.escalated ? h('span',{class:'chip amber'},'Sent to '+a.escalatedTo) : null));
    if (locked){ box.append(h('span',null,'Unlock to read it and confirm.')); return box; }
    box.append(h('b',null,a.text), a.source ? h('span',{class:'small muted'},a.source) : null,
      h('span',{class:'small'},missing.length ? 'Waiting for: '+missing.join(', ') : 'Everyone on shift confirmed.'),
      a.acks.length ? h('span',{class:'small muted'},'Confirmed: '+a.acks.map(k => k.n+' '+fmtTime(k.at)).join(', ')) : null);
    if (missing.length && !opts.readOnly){
      const names = [...new Set(missing.concat(a.need))];
      const sel = h('select',{'aria-label':'Your name'}, h('option',{value:''},'Your name'), names.map(n => h('option',{value:n, selected:!kiosk && n === myName()},n)));
      const pin = kiosk ? h('input',{type:'password',inputmode:'numeric',maxlength:'8',placeholder:'PIN','aria-label':'Your PIN',style:'max-width:7rem'}) : null;
      const btn = h('button',{class:'btn sm',type:'button'},'I read it');
      btn.addEventListener('click', async () => { if (await confirmAs(a, sel.value, pin && pin.value, kiosk)){ if (opts.after) opts.after(); else A.route(); } });
      box.append(h('div',{class:'row'}, sel, pin, btn));
    }
    return box;
  }

  // ---------- banner on every screen ----------
  function paint(){
    const main = document.getElementById('main'); if (!main) return;
    const old = document.getElementById('ssAlerts'); if (old) old.remove();
    const view = (location.hash.match(/^#\/([a-z]+)/)||[])[1] || 'home';
    if (view === 'alerts' || view === 'kiosk' || S().site === 'family' || S().tier === 'family') return;
    const list = openFor(S().site); if (!list.length) return;
    const bar = h('section',{id:'ssAlerts',class:'card',style:'border:2px solid var(--red);margin-bottom:1rem','aria-label':'Priority care updates'},
      h('h2',null,'Priority care update'+(list.length > 1 ? 's ('+list.length+')' : '')),
      list.slice(0, 3).map(a => alertCard(a, {after:() => paint()})),
      h('div',{class:'row'}, list.length > 3 ? h('a',{class:'btn quiet sm',href:'#/alerts'},'See all '+list.length) : null,
        !st().sound ? h('button',{class:'btn ghost sm',type:'button',onclick:enableSound},'🔔 Turn on sound and notifications on this device') : null));
    main.prepend(bar);
  }

  // ---------- house tablet: shows even while locked, details after unlock ----------
  const kioskWrap = R.kiosk;
  if (kioskWrap) R.kiosk = v => {
    kioskWrap(v);
    const site = (window.SSStation && SSStation.here && SSStation.here()) ? SSStation.here().site : S().site;
    const list = openFor(site); if (!list.length) return;
    const box = h('div',{class:'card',style:'border:2px solid var(--red)',id:'ssKioskAlerts'}, h('h2',null,'Priority care update'),
      h('p',{class:'small'},'Everyone on shift taps "I read it" with their PIN.'));
    const draw = () => { box.querySelectorAll('.item').forEach(x => x.remove()); const l = openFor(site); if (!l.length){ box.remove(); return; } l.forEach(a => box.append(alertCard(a, {kiosk:true, after:draw}))); };
    const reveal = h('button',{class:'btn ghost sm',type:'button'},'Show details');
    list.forEach(a => box.append(alertCard(a, {kiosk:true, locked:true})));
    reveal.addEventListener('click', () => { reveal.remove(); draw(); });
    box.append(reveal);
    v.prepend(box);
  };

  // ---------- shift change report: this shift's priority updates, open ones carried ----------
  const shiftWrap = R.shift;
  if (shiftWrap) R.shift = v => {
    const site = S().site, since = new Date(Date.now() - 16*3600000).toISOString();
    const recent = st().list.filter(a => a.site === site && a.at >= since);
    if (recent.length){
      const open = recent.filter(a => !a.closed);
      v.append(h('div',{class:'card'+(open.length?' warn':'')}, h('h2',null,'Priority care updates to hand off ('+recent.length+')'),
        h('p',{class:'small muted'},open.length ? 'Not everyone has confirmed these. Anything still open at shift change carries over, and the next shift confirms it too.' : 'Everyone confirmed these. Mention them in your report if they changed how the shift went.'),
        recent.slice(0, 8).map(a => alertCard(a, {readOnly:a.closed}))));
    }
    shiftWrap(v);
  };

  // ---------- the Priority updates screen ----------
  R.alerts = v => {
    const site = S().site, o = st(), can = MGR.includes(S().tier), c = cfg(site);
    v.append(head('Priority', 'Priority care updates', 'When a medical change goes live mid-shift, everyone on shift is alerted right away and confirms they read it. Reminders repeat until they do; if nobody confirms, it goes to the manager or on-call person; anything still open carries into the next shift. Test version: sample data only.'));
    const list = o.list.filter(a => a.site === site);
    const open = list.filter(a => !a.closed), esc = open.filter(a => a.escalated);
    const sh = onShift(site);
    v.append(h('div',{class:'grid g3'},
      h('div',{class:'stat'+(open.length?'':' good')},h('b',null,String(open.length)),h('span',null,'waiting for someone to confirm')),
      h('div',{class:'stat'+(esc.length?'':' good')},h('b',null,String(esc.length)),h('span',null,'sent to the manager or on call')),
      h('div',{class:'stat'},h('b',null,String(sh.names.length)),h('span',null,'on shift now: '+sh.names.join(', ')))));
    if (!o.sound) v.append(h('div',{class:'card soft'}, h('p',null,'This device is quiet. Turn on sound and notifications so priority updates ring here and show on the lock screen. The lock screen shows only "Priority care update" and the resident code, never the order.'),
      h('button',{class:'btn',type:'button',onclick:enableSound},'🔔 Turn on sound and notifications')));

    const oc = h('div',{class:'card'}, h('h2',null,'Open now'));
    if (!open.length) oc.append(h('p',{class:'muted'},'Nothing open. New orders, changes and stops alert the shift here as soon as they are checked or approved.'));
    open.forEach(a => oc.append(alertCard(a)));
    v.append(oc);

    if (can){
      const res = h('select',null, A.residents().map(r => h('option',{value:r.code},r.code+' (sample)')));
      const kind = h('select',null, h('option',{value:'precaution'},'Precaution'), h('option',{value:'change'},'Care change'), h('option',{value:'stop'},'Something stopped'));
      const txt = h('textarea',{style:'min-height:4rem',placeholder:'Example: Fall risk is higher tonight after the new medication. Bed alarm on, check every hour. (made-up example)'});
      const f = h('form',{class:'card'}, h('h2',null,'Send a priority update to the shift'),
        h('p',{class:'small muted'},'For a precaution or change that can\'t wait for the shift change report. New, changed and stopped orders alert on their own.'),
        h('div',{class:'grid g2'}, h('label',{class:'f'},'Resident',res), h('label',{class:'f'},'Kind',kind)), h('label',{class:'f'},'What staff need to know',txt),
        h('button',{class:'btn',type:'submit'},'Alert everyone on shift'));
      f.addEventListener('submit', e => { e.preventDefault(); if (!txt.value.trim()){ toast('Write what staff need to know'); return; }
        raise(site, {res:res.value, kind:kind.value, what:kind.value === 'precaution' ? 'Precaution' : 'Care', text:txt.value.trim(), source:'Posted by '+A.tier().name+' (you)'}); toast('Sent to everyone on shift'); A.route(); });
      const re = h('input',{type:'number',min:'1',max:'60',value:String(c.realert),style:'max-width:6rem'}), es = h('input',{type:'number',min:'5',max:'120',value:String(c.escalate),style:'max-width:6rem'});
      const sf = h('form',{class:'card'}, h('h2',null,'Timing for '+sname(site)),
        h('div',{class:'grid g2'}, h('label',{class:'f'},'Remind people who haven\'t confirmed every (minutes)',re), h('label',{class:'f'},'Send to the manager or on call if nobody confirms within (minutes)',es)),
        h('p',{class:'small muted'},'Tonight\'s on-call person: '+onCall(site)+' (set in the schedule).'),
        h('button',{class:'btn ghost sm',type:'submit'},'Save timing'));
      sf.addEventListener('submit', e => { e.preventDefault(); o.cfg[site] = {realert:Math.max(1, +re.value||DEF.realert), escalate:Math.max(5, +es.value||DEF.escalate)}; A.save(); toast('Saved'); A.route(); });
      v.append(f, sf);
    }
    const done = list.filter(a => a.closed).slice(0, 15);
    v.append(h('div',{class:'card'}, h('h2',null,'Confirmed'), done.length ? h('div',{class:'list'}, done.map(a => alertCard(a, {readOnly:true}))) : h('p',{class:'muted'},'Nothing yet.')));
    v.append(h('div',{class:'card soft'}, h('h2',null,'In the real app'),
      h('ul',{class:'small'}, h('li',null,'The alert reaches every phone and the house tablet within seconds through Supabase Realtime, and phones that are asleep get a Web Push notification. No AI is involved, so it adds no AI cost.'),
        h('li',null,'Lock screens show only "Priority care update", the home and the resident\'s initials or room. The order itself shows after the person unlocks the app.'),
        h('li',null,'Every alert, reminder, confirmation and escalation is kept in the audit log for surveys.'))));
  };

  // ---------- manager home: anything escalated ----------
  (A.homeHooks = A.homeHooks || []).push((v, t) => {
    if (!['manager','rn','owner','multi'].includes(t)) return;
    const esc = st().list.filter(a => !a.closed && a.escalated && (a.site === S().site || ['owner','multi'].includes(t)));
    if (esc.length) v.prepend(h('div',{class:'card',style:'border:2px solid var(--red)'}, h('h2',null,'Nobody on shift has confirmed '+esc.length+' priority update'+(esc.length>1?'s':'')),
      h('p',null,'Call the home and make sure the shift knows.'), h('a',{class:'btn',href:'#/alerts'},'Open priority updates')));
  });

  // ---------- wiring ----------
  VIEWS.alerts = {t:'Priority updates', ic:'🚨'};
  ['caregiver','manager','rn','owner','multi'].forEach(t => { const n = NAV[t]; if (!n || n.includes('alerts')) return; n.splice(1, 0, 'alerts'); });
  if (window.SSAccess && typeof SSAccess.register === 'function'){
    try { SSAccess.register({id:'alerts', name:'Priority updates', ic:'🚨', what:'Alerts everyone on shift to medical changes mid-shift, with confirm, reminders, escalation and handoff carry-over.', views:['alerts'], tiers:['caregiver','manager','rn','owner','multi']}); } catch(e){ console.error(e); }
  }
  const run = () => { scan(); tick(); paint(); };
  // Every screen redraw (including saves that re-render without a hash change) re-checks orders and repaints the banner.
  let busy = false;
  const watchMain = () => { const main = document.getElementById('main'); if (!main) return;
    new MutationObserver(() => { if (busy || document.getElementById('ssAlerts')) return; busy = true; try { run(); } finally { busy = false; } }).observe(main, {childList:true}); };
  watchMain();
  // Live across tabs of this browser (stand-in for Realtime): take the other tab's orders, alerts and boards.
  window.addEventListener('storage', e => {
    if (e.key !== 'ss-app-v1' || !e.newValue) return;
    try { const other = JSON.parse(e.newValue), s = S(); ['orders','alerts','outside','board'].forEach(k => { if (k in other) s[k] = other[k]; }); } catch(err){ return; }
    setTimeout(() => { run(); if (/^#\/(alerts|kiosk|shift)/.test(location.hash)) A.route(); }, 50);
  });
  setInterval(run, 30000);
  setTimeout(run, 0);
  window.SSAlerts = {scan, tick, raise, onShift, confirmAs, st, paint};
})();
