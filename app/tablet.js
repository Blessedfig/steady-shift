// Steady Shift test app: one central tablet for small homes and family care.
// #/tablet is a five-step guided setup (kind of home, people and PINs, privacy checklist, lock it to the app, finish).
// #/tabletlearn is short hands-on training on using the tablet, with a practice PIN pad and one question per lesson.
// Asked for by Christian (2026-11-28): set it all up on a central tablet for small homes and family care, HIPAA-respecting,
// with onboarding training and a simple setup. Builds on the shift station (station.js) and house tablet settings (access.js).
// Test version: everything is kept in this browser and every name is made up.
(function(){
  const A = window.SSApp, X = window.SSSched; if (!A || !X || !window.SSAccess || !window.SSStation) return;
  const {h, toast, head, R, VIEWS, NAV} = A;
  const S = () => A.state();
  const ap = (el, ...k) => { el.append(...k.flat(9).filter(x => x != null && x !== false)); return el; };
  const {field, sel, siteObj} = X;

  VIEWS.tablet = {t:'Set up the house tablet', ic:'📲'};
  VIEWS.tabletlearn = {t:'Learn the tablet', ic:'📘'};
  ['manager','owner','multi','family'].forEach(t => { if (NAV[t] && !NAV[t].includes('tablet')) NAV[t].splice(1, 0, 'tablet'); });
  Object.keys(NAV).forEach(t => { if (!NAV[t].includes('tabletlearn')) NAV[t].push('tabletlearn'); });

  const BOSS = ['manager','owner','multi','family'];
  const isFam = site => site === 'family';
  const lead = site => isFam(site) ? 'the main family caregiver' : 'the manager';
  const res = site => isFam(site) ? 'your loved one' : 'a resident';
  const people = site => (S().staff[site] || []).map(p => p.n);
  const pinSet = (site, n) => !!((S().pins || {})[site] || {})[n];
  const fmt = iso => A.fmtDate(iso);

  function st(site){
    const s = S(); s.tabletSetup = s.tabletSetup || {};
    if (!s.tabletSetup[site]){
      const set = siteObj(site).setting;
      s.tabletSetup[site] = {step:0, kind:set === 'home' ? 'family' : set === 'cbrf' ? 'cbrf' : 'afh', mode:'all', checks:{}, device:'', name:isFam(site) ? 'Kitchen tablet' : 'Staff room tablet', done:false};
    }
    return s.tabletSetup[site];
  }

  // ---------- presets by kind of home ----------
  const KINDS = {
    afh:{t:'Small adult family home', d:'1 to 4 residents. One tablet in the staff area runs the whole shift.', unlock:'both', lockSec:20, careMin:3},
    family:{t:'Family care at home', d:'You and a few helpers caring for one person at home.', unlock:'pin', lockSec:45, careMin:5},
    cbrf:{t:'Bigger home or CBRF', d:'One tablet per floor or wing, each set up the same way.', unlock:'both', lockSec:20, careMin:2}
  };

  // ---------- privacy checklist (HIPAA safeguards in plain words) ----------
  const CHECKS = [
    {id:'lock', t:'The tablet has its own screen-lock passcode.', why:'A passcode also switches on the tablet\'s built-in encryption, so a lost tablet stays unreadable.', ipad:'Settings, Face ID (or Touch ID) and Passcode, Turn Passcode On.', android:'Settings, Security (or Security and privacy), Screen lock, PIN.'},
    {id:'spot', t:'It lives in a staff-only spot, facing away from visitors and other residents.', why:'Only the people giving care should see care information.', fam:'It lives in a spot where visitors and guests can\'t read it.'},
    {id:'only', t:'It is only for care: no personal email, social media, games or shopping accounts.', why:'Personal apps and accounts are the most common way in for scams and leaks.'},
    {id:'updates', t:'Automatic updates are on.', why:'Updates close security holes.', ipad:'Settings, General, Software Update, Automatic Updates.', android:'Settings, System (or Software update), turn on automatic download.'},
    {id:'find', t:'Find My iPad or Find My Device is on, so a lost tablet can be locked and erased.', why:'You can lock and wipe it from any phone or computer.', ipad:'Settings, your name, Find My, Find My iPad.', android:'Settings, Security (or Google), Find My Device.'},
    {id:'wifi', t:'The home Wi-Fi has a password, and the tablet never joins public Wi-Fi.', why:'Open networks let strangers watch traffic.'},
    {id:'notif', t:'Lock-screen messages hide their details.', why:'The medicine alarm already hides medicine names. This covers every other app too.', ipad:'Settings, Notifications, Show Previews, When Unlocked.', android:'Settings, Notifications, Notifications on lock screen, hide sensitive content.'},
    {id:'own', t:'Everyone knows the three rules: use your own PIN, never share it, and lock the tablet when you walk away.', why:'Every entry is signed by the person who unlocked the tablet. That keeps the record trustworthy.'}
  ];
  const checksDone = x => CHECKS.every(c => x.checks[c.id]);
  const recheckDue = x => { if (!x.checkedAt) return ''; const d = new Date(x.checkedAt); d.setMonth(d.getMonth()+6); return A.isoDay(d); };

  // ---------- PIN form for one person ----------
  function pinForm(site, n, after){
    const a = h('input',{type:'password',inputmode:'numeric',autocomplete:'new-password',maxlength:'6',pattern:'[0-9]*'});
    const b = h('input',{type:'password',inputmode:'numeric',autocomplete:'new-password',maxlength:'6',pattern:'[0-9]*'});
    return h('div',{class:'grid'}, h('div',{class:'grid g2'}, field('New PIN (4 to 6 digits)', a), field('Type it again', b)),
      h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:async ()=>{
        if (!/^\d{4,6}$/.test(a.value)){ toast('Use 4 to 6 digits'); return; }
        if (/^(\d)\1+$/.test(a.value) || '0123456789'.includes(a.value) || '9876543210'.includes(a.value)){ toast('Pick a less obvious PIN'); return; }
        if (a.value !== b.value){ toast('The two PINs do not match'); return; }
        await SSAccess.setPin(site, n, a.value); A.save(); toast('PIN saved for '+(n === '__exit' ? 'the person in charge' : n)); after(); }},'Save PIN')),
      h('p',{class:'small muted'},'Let each person type their own PIN on the tablet when you can. Avoid birthdays and 1111-style PINs.'));
  }

  // ---------- printable tablet card (no PINs, no names of people cared for) ----------
  function cardEl(site){
    const k = SSAccess.kioskCfg(site), fam = isFam(site);
    return h('div',{class:'card tabletcard'},
      h('h2',null,siteObj(site).name+': house tablet'),
      h('ol',{class:'steps'},
        h('li',null,h('span',null,h('b',null,'Tap your name. '),'Then type your own PIN.')),
        h('li',null,h('span',null,h('b',null,'Tap a big button. '),'Red ones at the top need you now.')),
        h('li',null,h('span',null,h('b',null,'Record it as you go. '),'Medications right after you give them.')),
        h('li',null,h('span',null,h('b',null,'Tap "Done, lock it" '),'every time you walk away. It also locks itself after '+(k.careMin || 3)+' minutes.'))),
      h('div',{class:'card alert'}, h('b',null,'Emergency? Call 911 first.'), h('span',null,'Then tell '+lead(site)+' and report it on the tablet.')),
      h('h3',null,'Keep it private'),
      h('ul',{class:'small'},
        h('li',null,'Your PIN is yours alone. Never share it or write it down here.'),
        h('li',null,'Keep the tablet in its spot, facing away from '+(fam ? 'guests' : 'visitors')+'.'),
        h('li',null,'No photos or screenshots of the screen.'),
        h('li',null,'Lost tablet or a problem? Tell '+lead(site)+' right away.')),
      h('p',{class:'small muted'},'New here? Unlock and tap "Learn the tablet". It takes about 15 minutes.'));
  }
  function printCard(site, v){
    const old = v.querySelector('.tabletcard.forprint'); if (old) old.remove();
    const c = cardEl(site); c.classList.add('forprint'); v.append(c);
    document.body.classList.add('printcard');
    const done = () => { document.body.classList.remove('printcard'); c.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => { try { window.print(); } catch(e){ done(); } }, 50);
  }

  // ---------- training progress ----------
  function learner(){
    const c = SSStation.care(); if (c) return c.who;
    const t = S().tier; if (t === 'caregiver') return X.me(); if (t === 'family') return 'You';
    return A.tier().name;
  }
  function prog(site, n){ const s = S(); s.tabletLearn = s.tabletLearn || {}; s.tabletLearn[site] = s.tabletLearn[site] || {}; return s.tabletLearn[site][n] || (s.tabletLearn[site][n] = {done:{}}); }

  // ---------- the setup wizard ----------
  const STEPS = ['Your home','People and PINs','Privacy checklist','Lock it to the app','Finish'];
  R.tablet = v => {
    const site = S().site, x = st(site), fam = isFam(site);
    if (!BOSS.includes(S().tier)){
      ap(v, head('House tablet', 'Your manager sets up the house tablet', 'You can still learn how to use it.'), h('a',{class:'btn',href:'#/tabletlearn'},'Learn the tablet'));
      return;
    }
    const redo = () => { A.save(); A.route(); };
    ap(v, head(fam ? 'Family care' : 'Small homes', 'One tablet for the whole '+(fam ? 'care team' : 'home'),
      'One shared tablet that everyone unlocks with their own PIN. It shows only the everyday care screens, locks itself, and keeps a record of who did what. About 15 minutes to set up.'));

    if (x.done && x.step !== 'redo'){ overview(v, site, x, redo); return; }
    if (x.step === 'redo'){ x.step = 0; x.done = false; }

    const n = x.step;
    ap(v, h('ol',{class:'wsteps','aria-label':'Setup steps'}, STEPS.map((t, i) => h('li',{class:i === n ? 'on' : i < n ? 'past' : '', 'aria-current':i === n ? 'step' : null},
      h('span',{class:'num','aria-hidden':'true'}, i < n ? '✓' : String(i+1)), h('span',null,t)))));
    const body = h('div',{class:'card'});
    const go = d => { x.step = Math.max(0, Math.min(STEPS.length-1, n + d)); redo(); };
    const nav = (okNext, why) => h('div',{class:'row wnav'},
      n > 0 ? h('button',{class:'btn quiet',type:'button',onclick:()=>go(-1)},'Back') : null,
      n < STEPS.length-1 ? h('button',{class:'btn',type:'button',disabled:okNext === false,onclick:()=>go(1)},'Next: '+STEPS[n+1]) : null,
      okNext === false && why ? h('span',{class:'small muted'},why) : null);

    if (n === 0){
      const opts = Object.entries(KINDS).map(([id, k]) => { const rid = 'tk_'+id;
        return h('label',{class:'pick'+(x.kind === id ? ' on' : ''),for:rid}, h('input',{type:'radio',name:'tkind',id:rid,checked:x.kind === id,onchange:()=>{ x.kind = id; redo(); }}), h('span',null, h('b',null,k.t), h('span',{class:'small muted'},k.d))); });
      const modes = [['all','All-in-one (best for small homes)','After unlocking, people open the care screens: shift checklist, medications, care notes, reports, meals, cleaning, and who to call.'],
        ['house','Time clock and house jobs only','The tablet keeps the clock, schedule, shift board and hand-off note. Care is recorded on work phones.']]
        .map(([id, t, d]) => { const rid = 'tm_'+id; return h('label',{class:'pick'+(x.mode === id ? ' on' : ''),for:rid}, h('input',{type:'radio',name:'tmode',id:rid,checked:x.mode === id,onchange:()=>{ x.mode = id; redo(); }}), h('span',null, h('b',null,t), h('span',{class:'small muted'},d))); });
      ap(body, h('h2',null,'What kind of home is '+siteObj(site).name+'?'), h('div',{class:'grid g3'}, opts),
        h('h3',null,'What should the tablet do?'), h('div',{class:'grid g2'}, modes),
        h('div',{class:'card soft'}, h('b',null,'What you need'),
          h('ul',{class:'small'},
            h('li',null,'Any recent iPad or Android tablet. A basic one is fine.'),
            h('li',null,'A stand or wall mount and a charger, in a '+(fam ? 'spot guests don\'t use' : 'staff-only spot')+'.'),
            h('li',null,'Home Wi-Fi with a password.'),
            h('li',null,'About 15 minutes, and the people who will use it nearby to pick their PINs.'))),
        nav(true));
    }

    if (n === 1){
      const names = people(site), have = names.filter(p => pinSet(site, p)).length;
      const addIn = h('input',{type:'text',maxlength:'30',placeholder:fam ? 'Weekend helper' : 'Caregiver name or role','aria-label':'Name of a new person'});
      const add = () => { const t = addIn.value.trim(); if (!t) return; if (names.includes(t)){ toast('That name is already on the list'); return; }
        S().staff[site] = S().staff[site] || []; S().staff[site].push({n:t, hours:0, need:fam ? 0 : 15, bg:'', status:'New'}); SSAccess.log('Added '+t+' to the house tablet', site); toast('Added '+t); redo(); };
      addIn.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
      ap(body, h('h2',null,'Who will use the tablet?'),
        h('p',{class:'small'},'Each person gets their own 4 to 6 digit PIN. Their name shows on the tablet\'s start screen, and everything they record is signed with it.'),
        h('p',{class:'small muted'},have+' of '+names.length+' have their own PIN. Test version: people without one use the sample PIN 1234.'),
        h('div',{class:'list'}, names.map(p => h('div',{class:'item'},
          h('div',{class:'meta'}, h('span',{class:'chip '+(pinSet(site, p) ? 'calm' : 'grey')}, pinSet(site, p) ? 'Own PIN set' : 'No PIN yet')),
          h('b',null,p),
          h('details',null, h('summary',{class:'small'}, pinSet(site, p) ? 'Reset PIN' : 'Set PIN'), pinForm(site, p, redo))))),
        h('div',{class:'row'}, addIn, h('button',{class:'btn ghost sm',type:'button',onclick:add},'Add person')),
        h('div',{class:'card soft'}, h('b',null,'PIN for the person in charge'),
          h('span',{class:'small'},'This PIN opens the setup menu on the tablet and lets you step out of tablet mode. Only '+lead(site)+' should know it.'),
          h('span',{class:'small muted'},pinSet(site, '__exit') ? 'Set.' : 'Not set yet. Test version: 0000.'),
          h('details',null, h('summary',{class:'small'}, pinSet(site, '__exit') ? 'Change it' : 'Set it'), pinForm(site, '__exit', redo))),
        nav(true));
    }

    if (n === 2){
      const dev = x.device || 'ipad';
      ap(body, h('h2',null,'Privacy checklist'),
        h('p',{class:'small'},'HIPAA\'s Security Rule expects three things from a shared tablet: each person has their own sign-in, the screen locks itself, and there is a record of who did what. The app is built for those three. These checks cover the tablet itself. Your home still needs its own privacy policies and staff training.'),
        h('div',{class:'row'}, h('span',{class:'small'},'Show steps for'), ...[['ipad','iPad'],['android','Android tablet']].map(([id, t]) => h('button',{class:'btn sm '+(dev === id ? '' : 'quiet'),type:'button','aria-pressed':String(dev === id),onclick:()=>{ x.device = id; redo(); }},t))),
        h('div',{class:'list'}, CHECKS.map(c => { const id = 'pc_'+c.id;
          return h('div',{class:'item'}, h('label',{class:'row kcheck',for:id}, h('input',{type:'checkbox',id,checked:!!x.checks[c.id],onchange:e=>{ x.checks[c.id] = e.target.checked; redo(); }}), h('b',null, fam && c.fam ? c.fam : c.t)),
            h('span',{class:'small muted'},c.why), c[dev] ? h('span',{class:'small'},'How: '+c[dev]) : null); })),
        h('div',{class:'card calm'}, h('b',null,'What the app already does'),
          h('ul',{class:'small'},
            h('li',null,'Each person unlocks with their own PIN. Five wrong tries pause that name, and ten pause the whole tablet.'),
            h('li',null,'It locks itself after each person, and the care screens lock after a few minutes without a tap.'),
            h('li',null,'Every unlock and every screen opened is logged with the person\'s name.'),
            h('li',null,'It never shows pay, owner reports, HR files or anyone else\'s hours.'),
            h('li',null,'Medicine alarms never show medicine names on the lock screen.'),
            h('li',null,'A lost tablet can be removed from the app. In the real app you can do this from your phone.'))),
        h('p',{class:'small muted'},'Test version: use made-up names only. Real resident information waits until the server, the signed agreements and the rest of our HIPAA safeguards are in place.'),
        nav(checksDone(x), 'Tick every check to go on.'));
      if (checksDone(x) && !x.checkedAt){ x.checkedAt = new Date().toISOString(); A.save(); }
    }

    if (n === 3){
      const dev = x.device || 'ipad';
      const steps = dev === 'ipad' ? [
        'On the tablet, open the app link in Safari, tap Share, then "Add to Home Screen".',
        'Open Steady Shift from the Home Screen and sign in there with the home\'s account.',
        'Settings, Accessibility, Guided Access: turn it on and set a passcode only '+lead(site)+' knows.',
        'Open Steady Shift, triple-click the top (or Home) button, and tap Start. Nobody can leave the app until Guided Access ends.',
        'Settings, Display and Brightness: set Auto-Lock to Never while it is plugged in.'
      ] : [
        'On the tablet, open the app link in Chrome and sign in with the home\'s account.',
        'Tap the Chrome menu (⋮), then "Install app" or "Add to Home screen". Open Steady Shift from the new icon.',
        'Settings, Security, App pinning: turn it on, with "Ask for PIN before unpinning".',
        'Open Steady Shift, open Recent apps, tap the app icon at the top, then Pin.',
        'Settings, Display: longest screen timeout. Battery: set Steady Shift and Chrome to Unrestricted. Keep it plugged in.'
      ];
      const mins = sel([['2','2 minutes'],['3','3 minutes'],['5','5 minutes']], String(x.careMin || KINDS[x.kind].careMin));
      mins.addEventListener('change', () => { x.careMin = +mins.value; A.save(); });
      ap(body, h('h2',null,'Lock the tablet to the app'),
        h('p',{class:'small'},'This keeps the tablet on Steady Shift only, so nobody can wander into the web browser, email or settings.'),
        h('div',{class:'row'}, h('span',{class:'small'},'Steps for'), ...[['ipad','iPad'],['android','Android tablet']].map(([id, t]) => h('button',{class:'btn sm '+(dev === id ? '' : 'quiet'),type:'button','aria-pressed':String(dev === id),onclick:()=>{ x.device = id; redo(); }},t))),
        h('ol',{class:'steps'}, steps.map(t => h('li',null,h('span',null,t)))),
        x.mode === 'all' ? h('div',{class:'grid g2'}, field('Care screens lock after no taps for', mins)) : null,
        h('p',{class:'small muted'},'After a restart, open the app and turn Guided Access or App pinning on again. The tablet stays signed in and opens to its start screen.'),
        nav(true));
    }

    if (n === 4){
      const k = KINDS[x.kind];
      const nameIn = h('input',{type:'text',maxlength:'40',value:x.name,'aria-label':'Name for this tablet'});
      nameIn.addEventListener('input', () => { x.name = nameIn.value; A.save(); });
      const mine = SSStation.here();
      ap(body, h('h2',null,'Finish'),
        h('div',{class:'grid g2'}, field('Name for this tablet', nameIn)),
        h('ul',{class:'small'},
          h('li',null,'Home: '+siteObj(site).name+' ('+k.t.toLowerCase()+')'),
          h('li',null,'Unlock with '+(k.unlock === 'pin' ? 'personal PINs' : 'personal PINs or a shift code from the schedule')),
          h('li',null, x.mode === 'all' ? 'All-in-one: care screens after unlocking, locking after '+(x.careMin || k.careMin)+' minutes without a tap' : 'Time clock and house jobs only'),
          x.checkedAt ? h('li',null,'Privacy checklist done '+fmt(x.checkedAt)+'. Check it again by '+fmt(recheckDue(x)+'T12:00:00')+'.') : null),
        h('div',{class:'row'},
          mine ? h('span',{class:'chip calm'},'This device is already the house tablet "'+mine.name+'"') :
            h('button',{class:'btn',type:'button',onclick:async ()=>{ await finish(site, x, true); }},'Make this device the house tablet'),
          h('button',{class:'btn ghost',type:'button',onclick:async ()=>{ await finish(site, x, false); }}, mine ? 'Save these settings' : 'Save, and finish on the tablet later'),
          h('button',{class:'btn quiet',type:'button',onclick:()=>printCard(site, v)},'Print the tablet card')),
        h('p',{class:'small muted'},'Setting this up from your phone? Save it, then open the app on the tablet, sign in, and come back here to tap "Make this device the house tablet". Test version: progress stays in this browser.'),
        nav(true));
    }
    v.append(body);
  };

  async function finish(site, x, here){
    const k = SSAccess.kioskCfg(site), p = KINDS[x.kind];
    Object.assign(k, {on:true, unlock:p.unlock, lockSec:p.lockSec, care:x.mode === 'all', careMin:x.careMin || p.careMin});
    if (isFam(site)) k.allow = Object.assign({}, k.allow, {clock:false, req:false});
    x.done = true; x.at = new Date().toISOString(); x.by = A.tier().name; x.step = 0;
    SSAccess.log('Finished the house tablet setup ('+p.t.toLowerCase()+', '+(k.care ? 'all-in-one' : 'clock and house jobs')+')', site);
    if (here && !SSStation.here()){
      const r = await SSStation.register(site, (x.name || '').trim() || 'House tablet', A.tier().name);
      toast('This device is now the house tablet "'+r.name+'"'); A.save(); location.hash = '#/kiosk'; return;
    }
    A.save(); toast('Saved'); A.route();
  }

  function overview(v, site, x, redo){
    const mine = SSStation.here(), list = SSStation.stations().filter(r => r.site === site && !r.revoked), due = recheckDue(x);
    const overdue = due && due < A.isoDay(new Date());
    const names = people(site), learnAll = LESSONS.filter(l => !l.lead).length;
    ap(v, h('div',{class:'card calm',role:'status'}, h('h2',null,'The house tablet is set up'),
        h('span',{class:'small'},'Set up by '+(x.by || 'the manager')+' on '+fmt(x.at)+'. '+(list.length ? 'Active tablets: '+list.map(r => r.name).join(', ')+'.' : 'Not turned on on a tablet yet.')),
        h('div',{class:'row'},
          mine ? h('a',{class:'btn',href:'#/kiosk'},'Open the tablet screen') : h('button',{class:'btn',type:'button',onclick:()=>{ x.step = 4; x.done = false; redo(); }},'Make this device the house tablet'),
          h('button',{class:'btn ghost',type:'button',onclick:()=>printCard(site, v)},'Print the tablet card'),
          h('a',{class:'btn quiet',href:'#/access'},'Tablet settings'))),
      h('div',{class:'card '+(overdue ? 'warn' : '')}, h('h3',null,'Privacy check'),
        h('span',{class:'small'}, x.checkedAt ? 'Last done '+fmt(x.checkedAt)+'. '+(overdue ? 'Due again now.' : 'Next one by '+fmt(due+'T12:00:00')+'.') : 'Not done yet.'),
        h('div',{class:'row'}, h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ x.checks = {}; x.checkedAt = null; x.step = 2; x.done = false; redo(); }},'Do the privacy check again'))),
      h('div',{class:'card'}, h('h3',null,'Who is ready'),
        h('p',{class:'small muted'},'Own PIN and the '+learnAll+' "Learn the tablet" lessons for everyone.'),
        h('div',{class:'list'}, names.map(n => { const d = Object.keys(prog(site, n).done).filter(id => LESSONS.some(l => l.id === id && !l.lead)).length;
          return h('div',{class:'item'}, h('b',null,n), h('div',{class:'meta'},
            h('span',{class:'chip '+(pinSet(site, n) ? 'calm' : 'grey')}, pinSet(site, n) ? 'Own PIN' : 'No PIN yet'),
            h('span',{class:'chip '+(d >= learnAll ? 'calm' : d ? 'amber' : 'grey')}, d >= learnAll ? 'Training done' : 'Training '+d+' of '+learnAll))); })),
        h('div',{class:'row'}, h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ x.step = 1; x.done = false; redo(); }},'Add people or set PINs'), h('a',{class:'btn quiet sm',href:'#/tabletlearn'},'Open the training'))),
      h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ x.step = 'redo'; redo(); }},'Run the setup again')));
  }

  // ---------- training ----------
  const mock = (...k) => h('div',{class:'tmock','aria-hidden':'true'}, ...k);
  const LESSONS = [
    {id:'unlock', t:'Unlock with your name and PIN', mins:2,
      steps:s => ['Tap your name on the tablet\'s start screen.', 'Type your own PIN and tap OK.', 'Forgot it? Ask '+lead(s)+' to reset it. After 5 wrong tries your name pauses for 5 minutes.', 'Never use someone else\'s PIN, and never tell anyone yours. Everything you record is signed with your name.'],
      pic:s => mock(h('b',null,'Tap your name'), h('div',{class:'tgrid'}, people(s).slice(0,4).map(n => h('span',{class:'tname'},n)))),
      practice:true,
      q:s => ({q:(isFam(s) ? 'Another helper' : 'A coworker')+'\'s PIN is not working, and they ask to use yours for a minute. What do you do?', a:[
        ['Let them, just this once', false, 'Everything they record would be signed with your name.'],
        ['Say no kindly, and get '+lead(s)+' to reset their PIN', true, 'Right. Their own PIN keeps their work under their name.'],
        ['Write your PIN on a sticky note for them', false, 'A written PIN can be found by anyone.']]})},
    {id:'buttons', t:'The big buttons', mins:2,
      steps:() => ['After you unlock, you see big buttons for the everyday work.', 'A red button at the top means something needs you now, like a dose that is due.', 'Tap a button to open it. The menu (on the side, or across the top on a smaller screen) moves you between them.', 'The green bar at the top shows whose turn it is on the tablet.'],
      pic:() => mock(h('div',{class:'tgrid'}, h('span',{class:'tbig red'},'💊 Dose due'), h('span',{class:'tbig'},'✅ Checklist'), h('span',{class:'tbig'},'📝 Notes'), h('span',{class:'tbig'},'⚠️ Report'))),
      q:() => ({q:'What does a red button at the top mean?', a:[
        ['Something needs you now, like a dose that is due', true, 'Right. Start there.'],
        ['The tablet is broken', false, 'Red means something is due or overdue.'],
        ['You did something wrong', false, 'Red is a heads-up, not a mark against you.']]})},
    {id:'meds', t:'Medications and the alarm', mins:3,
      steps:s => ['The alarm sounds when a dose is due and repeats until it is recorded.', 'Give the medicine the way the order says, then record it right away: given, refused or held, with a short reason.', 'The lock screen never shows medicine names.', 'Only a nurse or '+lead(s)+' can change dose times or alarm settings. If a time looks wrong, tell them. Don\'t work around it.'],
      pic:() => mock(h('b',null,'8:00 AM dose'), h('div',{class:'tgrid'}, h('span',{class:'tbig'},'Given'), h('span',{class:'tbig'},'Refused'), h('span',{class:'tbig'},'Held'))),
      q:() => ({q:'When do you record a dose?', a:[
        ['Right after you give it', true, 'Right. That keeps the next person from giving it again.'],
        ['At the end of the shift, all at once', false, 'Memory fades, and the next person might give it again.'],
        ['Only if something went wrong', false, 'Every dose gets recorded, given or not.']]})},
    {id:'notes', t:'Care notes in your own words', mins:2,
      steps:() => ['Write what you saw and did, the way you would say it.', 'Tap "Make it professional" for a clean version. Read it before you save. It is your note, so fix anything that is not right.', 'Stick to facts: what happened, when, and what you did. Leave out guesses and blame.'],
      pic:() => mock(h('span',{class:'small'},'"ate half her lunch, said tummy hurt, gave water"'), h('span',{class:'tbig'},'✨ Make it professional')),
      q:() => ({q:'Which note is best?', a:[
        ['Ate half of lunch. Said her stomach hurt. Offered water and told the manager at 1 PM.', true, 'Right. Facts, a time, and what you did.'],
        ['She was being difficult again at lunch.', false, '"Difficult" is an opinion. Say what happened.'],
        ['Lunch was fine I guess.', false, 'Too vague to help the next person.']]})},
    {id:'report', t:'Report something, and who to call', mins:3,
      steps:s => ['Emergency? Call 911 first. Then follow the care plan and '+lead(s)+'\'s instructions.', 'Then tap "Report something". Say what happened in your own words. The app helps make it calm and clear, and shows who needs to know and by when.', '"Who do I call?" shows the right person for the time of day, so '+lead(s)+' is only woken up when it really matters.', 'Reports go to '+lead(s)+', not to the whole team.'],
      pic:() => mock(h('span',{class:'tbig red'},'⚠️ Report something'), h('span',{class:'tbig'},'📞 Who do I call?')),
      q:s => ({q:(isFam(s) ? 'Your loved one' : 'A resident')+' falls and hits their head. What comes first?', a:[
        ['Make sure they are safe and get help the way the plan says, then report it on the tablet', true, 'Right. Safety first, then the report.'],
        ['Write the report first so you don\'t forget', false, 'The person comes first. The report can wait a few minutes.'],
        ['Text a coworker to ask what to do', false, 'Use the plan and "Who do I call?" instead of guessing.']]})},
    {id:'handoff', t:'Shift board and hand-off', mins:2,
      steps:() => ['The shift board holds house jobs: tasks, cleaning and daily reminders. Everyone on the tablet sees it.', 'Write a short hand-off note for the next person, and tap "I read this" when you start your shift.', 'Keep names and health details off the board. Those go in care notes, the shift report, or a report.'],
      pic:() => mock(h('b',null,'Shift board'), h('span',{class:'small'},'☐ Restock gloves'), h('span',{class:'small'},'☐ Towels in the dryer'), h('span',{class:'small'},'Hand-off: back door sticks')),
      q:s => ({q:'Where does "'+(isFam(s) ? 'Mom' : 'M-2')+' had a fall at 3 PM" go?', a:[
        ['In a report and the shift report', true, 'Right. Health details stay in the care record.'],
        ['On the shift board task list', false, 'The board is for house jobs. Everyone sees it.'],
        ['In the hand-off note only', false, 'A fall needs a report so the right people hear about it.']]})},
    {id:'lock', t:'Lock it and keep it private', mins:2,
      steps:s => ['Tap "Done, lock it" every time you walk away. It also locks itself after '+(SSAccess.kioskCfg(s).careMin || 3)+' minutes without a tap.', 'Keep the tablet in its spot, facing away from '+(isFam(s) ? 'guests' : 'visitors')+'.', 'No photos or screenshots of the screen, and don\'t copy information to your own phone.', 'Lost tablet, broken screen, or someone saw what they should not have? Tell '+lead(s)+' right away. They can remove the tablet and decide if anything needs reporting.'],
      pic:() => mock(h('span',{class:'tbar'},'Sam is using the tablet'), h('span',{class:'tbig'},'🔒 Done, lock it')),
      lockTry:true,
      q:() => ({q:'You get called away in the middle of a note. What do you do?', a:[
        ['Tap "Done, lock it" and come back to it', true, 'Right. Nobody else can see or add to your work.'],
        ['Leave it open, you\'ll be right back', false, 'Anyone walking by could see it or add to it under your name.'],
        ['Ask a visitor to keep an eye on it', false, 'Visitors should never see care information.']]})},
    {id:'people', lead:true, t:'For the person in charge: people and PINs', mins:3,
      steps:() => ['Open "Set up the house tablet" to add a person or reset a PIN.', 'When someone leaves, remove their access the same day.', 'Look at the activity log in Services and access now and then. It shows who unlocked the tablet and which screens they opened.', 'Do the privacy check again every 6 months. The setup page reminds you.'],
      q:() => ({q:'A caregiver quits today. When do you remove their access?', a:[
        ['Today', true, 'Right. Same day, every time.'],
        ['At the end of the month', false, 'They could still unlock the tablet until then.'],
        ['Only if there is a problem', false, 'Removing access is routine, not an accusation.']]})},
    {id:'lost', lead:true, t:'For the person in charge: a lost or broken tablet', mins:2,
      steps:() => ['Remove it as a station right away (Services and access, Stations for this home). In the real app you can do this from your phone.', 'Use Find My to lock and erase it.', 'Tell the owner. A lost device with care information may need a privacy breach review. A passcode-locked, encrypted tablet usually lowers the risk, which is why the checklist asks for both.', 'Set up a replacement with the guided setup. It takes about 15 minutes.'],
      q:() => ({q:'The tablet is missing. What is the first step?', a:[
        ['Remove it as a station and lock it with Find My', true, 'Right. Then tell the owner.'],
        ['Wait a few days to see if it turns up', false, 'Lock it now. You can always undo it if it turns up.'],
        ['Buy a new one and say nothing', false, 'The owner needs to know, in case it is a privacy breach.']]})}
  ];

  R.tabletlearn = v => {
    const site = S().site, n = learner(), p = prog(site, n), boss = BOSS.includes(S().tier) && !SSStation.care();
    const mineL = LESSONS.filter(l => !l.lead || boss), done = mineL.filter(l => p.done[l.id]).length, pct = Math.round(done/mineL.length*100);
    ap(v, head('Training', 'Learn the tablet', 'Short lessons on using the '+(isFam(site) ? 'family' : 'house')+' tablet, about 15 minutes in all. Each one ends with a quick question.'),
      h('div',{class:'card soft'}, h('b',null,n+': '+done+' of '+mineL.length+' lessons done'),
        h('div',{class:'tbarprog',role:'progressbar','aria-valuemin':'0','aria-valuemax':'100','aria-valuenow':String(pct),'aria-label':'Training progress'}, h('i',{style:'width:'+pct+'%'})),
        done >= mineL.length ? h('span',{class:'small'},'All done'+(p.finished ? ' on '+fmt(p.finished) : '')+'. You are ready to use the tablet.') : null));
    const box = h('div',{class:'grid'});
    mineL.forEach((l, i) => {
      const q = l.q(site), fb = h('p',{class:'small','aria-live':'polite'});
      const qid = 'q_'+l.id;
      const body = h('div',{class:'grid'},
        l.pic ? l.pic(site) : null,
        h('ol',{class:'steps'}, l.steps(site).map(t => h('li',null,h('span',null,t)))),
        l.practice ? practicePad() : null,
        l.lockTry ? lockTry() : null,
        h('fieldset',{class:'tq'}, h('legend',null,q.q),
          q.a.map(([t, ok, why], j) => { const id = qid+'_'+j; return h('label',{class:'row kcheck',for:id}, h('input',{type:'radio',name:qid,id,onchange:()=>{
            fb.textContent = why; fb.className = 'small '+(ok ? 'okmsg' : 'nomsg');
            if (ok && !p.done[l.id]){ p.done[l.id] = new Date().toISOString();
              if (mineL.every(x => p.done[x.id]) && !p.finished){ p.finished = new Date().toISOString(); SSAccess.log(n+' finished "Learn the tablet"', site); toast('Training done. Nice work.'); }
              A.save(); setTimeout(A.route, 1400); } }}), h('span',null,t)); }), fb));
      box.append(h('details',{class:'card lesson',open:!p.done[l.id] && mineL.findIndex(x => !p.done[x.id]) === i},
        h('summary',null, h('span',{class:'chip '+(p.done[l.id] ? 'calm' : 'grey')}, p.done[l.id] ? 'Done' : (l.lead ? 'For the person in charge' : 'Lesson '+(i+1))), h('b',null,l.t), h('span',{class:'small muted'},l.mins+' min')), body));
    });
    v.append(box);
    if (boss) v.append(h('p',{class:'small muted'},'Progress for each person shows on "Set up the house tablet". In-house training, not DHS-approved.'));
  };

  function practicePad(){
    const inp = h('input',{type:'password',inputmode:'numeric',autocomplete:'off',maxlength:'6',class:'kpin','aria-label':'Practice PIN'});
    const msg = h('p',{class:'small','aria-live':'polite'},'Practice: type 1234 and tap OK.');
    const ok = () => { if (inp.value === '1234'){ msg.textContent = 'Unlocked. That is all there is to it.'; msg.className = 'small okmsg'; } else { msg.textContent = 'Not quite. Try 1234.'; msg.className = 'small nomsg'; } inp.value = ''; };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    return h('div',{class:'card tpractice'}, h('b',null,'Try it'), inp,
      h('div',{class:'kpad'}, ['1','2','3','4','5','6','7','8','9','⌫','0','OK'].map(d => h('button',{type:'button',class:'kkey'+(d === 'OK' ? ' ok' : ''),'aria-label':d === '⌫' ? 'Delete' : d === 'OK' ? 'Enter' : d,onclick:()=>{ if (d === '⌫') inp.value = inp.value.slice(0,-1); else if (d === 'OK') ok(); else if (inp.value.length < 6) inp.value += d; }}, d))), msg);
  }
  function lockTry(){
    const msg = h('p',{class:'small','aria-live':'polite'});
    return h('div',{class:'card tpractice'}, h('b',null,'Try it'), h('button',{class:'btn',type:'button',onclick:()=>{ msg.textContent = 'Locked. The next person taps their own name.'; msg.className = 'small okmsg'; }},'🔒 Done, lock it'), msg);
  }

  window.SSTablet = {lessons:LESSONS, progress:prog, card:cardEl};
})();
