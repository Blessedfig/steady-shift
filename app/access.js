// Steady Shift test app: switchable services, shared access (per-person toggles and invite codes), sign-in choices and the change log.
// Test version: everything is stored in this browser. In the real app, grants and codes live on the server and are checked there.
(function(){
  const A = window.SSApp; if (!A) return;
  const {D, h, toast, fmtDate, head, R} = A;
  const S = () => A.state();
  const ap = (el, ...k) => { el.append(...k.flat(9).filter(x => x != null && x !== false)); return el; };
  const SD = D.SCHED;
  const VIEW_MOD = {schedule:'schedule', time:'time', kiosk:'time', insights:'insights', labor:'insights'};
  const ALL_TIERS = D.TIERS.map(t => t.id);
  const STAFF_TIERS = ALL_TIERS.filter(t => t !== 'family' && t !== 'kin');
  const DEFAULT_TIERS = {schedule:STAFF_TIERS.slice(), time:STAFF_TIERS.slice(), insights:['owner','multi']};

  function st(){
    const s = S();
    s.mods = s.mods || {};
    s.grants = s.grants || [];
    s.invites = s.invites || [];
    s.audit = s.audit || [];
    s.signin = s.signin || {};
    return s;
  }
  function mod(site, id){
    const s = st(); s.mods[site] = s.mods[site] || {};
    if (!s.mods[site][id]) s.mods[site][id] = {on:true, tiers:DEFAULT_TIERS[id].slice()};
    return s.mods[site][id];
  }
  const actor = () => window.SSSched ? SSSched.actor() : A.tier().name;
  const meName = () => window.SSSched ? SSSched.me() : A.tier().name;
  function log(what, site){ const s = st(); s.audit.unshift({at:new Date().toISOString(), who:actor(), what, site:site||s.site}); if (s.audit.length > 400) s.audit.length = 400; A.save(); }
  const active = g => !g.revoked && (!g.expires || g.expires > new Date().toISOString());
  function can(perm, name){ const s = st(); return s.grants.some(g => active(g) && g.site === s.site && g.staff === (name||meName()) && g.perms.includes(perm)); }
  const isBoss = () => ['manager','owner','multi'].includes(S().tier);
  const isOwner = () => ['owner','multi'].includes(S().tier);
  function viewOn(view){
    const m = VIEW_MOD[view]; if (!m) return true;
    const s = st(), x = mod(s.site, m);
    if (!x.on) return false;
    if (x.tiers.includes(s.tier)) return true;
    return SD.perms.some(p => p.mod === m && can(p.id));
  }
  function offView(v, view){
    const m = SD.modules.find(x => x.id === VIEW_MOD[view]), x = mod(S().site, m.id);
    ap(v, head('Not turned on', m.name+(x.on ? ' is not part of your role' : ' is off for this home'),
      x.on ? 'An owner can turn it on for your role, or a manager can share access with you for a set time in Services and access.' : 'An owner can turn it on in Services and access. Each service can be switched on for one home at a time.'),
      h('div',{class:'row'}, h('a',{class:'btn ghost',href:'#/access'},'Services and access')));
  }
  const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function code(){ const a = new Uint32Array(8); crypto.getRandomValues(a); return 'AC-'+[...a].map((n,i) => (i===4?'-':'')+ALPH[n % ALPH.length]).join(''); }
  const DUR = [['1','1 day'],['7','1 week'],['30','30 days'],['90','90 days'],['0','Until removed']];
  const until = days => +days ? new Date(Date.now() + days*864e5).toISOString() : null;
  const permName = id => (SD.perms.find(p => p.id === id)||{}).name || id;
  const field = (label, el) => { el.id = el.id || 'a'+A.uid(); return h('label',{class:'f',for:el.id},label,el); };
  const sel = (opts, val) => h('select',null, opts.map(o => h('option',{value:o[0], selected:String(o[0])===String(val)}, o[1])));
  function permBoxes(prefix){
    return SD.perms.map(p => { const id = prefix+p.id.replace('.','_'); return h('label',{class:'row small',for:id}, h('input',{type:'checkbox',id,value:p.id,'data-perm':'1'}), p.name); });
  }
  const pickedPerms = box => [...box.querySelectorAll('input[data-perm]:checked')].map(i => i.value);

  function redeem(c){
    const s = st(); c = String(c||'').trim().toUpperCase();
    const inv = s.invites.find(i => i.code === c);
    if (!inv || inv.revoked) return 'That code is not valid.';
    if (inv.expires && inv.expires < new Date().toISOString()) return 'That code has expired. Ask your manager for a new one.';
    if (inv.max && inv.used >= inv.max) return 'That code has been used up.';
    if (S().tier !== 'caregiver') return 'Switch "View as" to Caregiver to try a code as a staff member.';
    if (inv.site !== S().site) return 'That code is for '+(D.SITES.find(x => x.id === inv.site)||{}).name+'. Switch homes at the top.';
    inv.used = (inv.used||0) + 1;
    s.grants.push({id:A.uid(), site:inv.site, staff:meName(), perms:inv.perms.slice(), by:inv.by+' (code '+inv.code+')', at:new Date().toISOString(), expires:inv.grantExpires ? until(inv.grantDays) : inv.expires, via:'code'});
    log(meName()+' used code '+inv.code+' for: '+inv.perms.map(permName).join(', '), inv.site);
    return '';
  }

  R.access = v => {
    const s = st(), site = s.site, siteName = (D.SITES.find(x => x.id === site)||{}).name;
    const p = A.param();
    if (/^redeem\//.test(p)){ const err = redeem(p.slice(7)); history.replaceState(null,'','#/access'); setTimeout(() => toast(err || 'Access added. New options are in your menu.'), 50); A.renderNav(); }
    ap(v, head('Services and access · '+siteName, isBoss() ? 'Choose what this home uses, and who can do what' : 'Your access and sign-in',
      isBoss() ? 'Turn services on per home and per role. Share a manager option with a lead for a set time. Every change is logged.' : 'If your manager shares scheduling or other options with you, they show here.'));

    // services
    if (site !== 'family'){
      const card = h('div',{class:'card'}, h('h2',null,'Services for this home'),
        h('p',{class:'small muted'}, isOwner() ? 'Homes can start with one service and add more. Turning one off hides it for everyone at this home. Data is kept.' : 'The owner chooses which services this home uses.'));
      SD.modules.forEach(m => {
        const x = mod(site, m.id), id = 'mod_'+m.id;
        const sw = h('input',{type:'checkbox',id,role:'switch',checked:x.on,disabled:!isOwner(),onchange:e=>{ x.on = e.target.checked; log((x.on?'Turned on ':'Turned off ')+m.name, site); A.renderNav(); A.route(); }});
        const tiers = h('div',{class:'chips',role:'group','aria-label':'Roles that see '+m.name}, D.TIERS.filter(t => t.id !== 'family' && t.id !== 'kin').map(t => h('button',{type:'button',class:'chip','aria-pressed':String(x.tiers.includes(t.id)),disabled:!isOwner(),onclick:e=>{
          if (x.tiers.includes(t.id)) x.tiers = x.tiers.filter(y => y !== t.id); else x.tiers.push(t.id);
          e.currentTarget.setAttribute('aria-pressed', String(x.tiers.includes(t.id))); log(m.name+': '+(x.tiers.includes(t.id)?'shown to ':'hidden from ')+t.name, site); A.renderNav(); }}, t.name)));
        ap(card, h('div',{class:'item'}, h('label',{class:'row',for:id}, sw, h('b',null,m.ic+' '+m.name)), h('span',{class:'small'},m.what), x.on ? h('div',null, h('span',{class:'small muted'},'Roles that see it'), tiers) : null));
      });
      ap(card, h('p',{class:'small muted'},'Draft pricing idea: each service on its own, or all of them together at a lower combined price. Not final.'));
      ap(v, card);
    }

    if (isBoss() && site !== 'family'){
      // share with a person
      const who = sel((S().staff[site]||[]).map(p => [p.n, p.n]).filter(x => x[0] !== 'Manager'), '');
      const dur = sel(DUR, '30');
      const box = h('div',{class:'grid'}, permBoxes('g_'));
      const grants = s.grants.filter(g => g.site === site).sort((a,b) => b.at.localeCompare(a.at));
      ap(v, h('div',{class:'card'}, h('h2',null,'Share an option with one person'),
        h('p',{class:'small muted'},'For example, let a lead build next month\'s schedule or approve swaps while you are away. It ends on its own.'),
        h('div',{class:'grid g2'}, field('Person', who), field('For how long', dur)), box,
        h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{
          const perms = pickedPerms(box); if (!perms.length){ toast('Pick at least one option'); return; }
          s.grants.push({id:A.uid(), site, staff:who.value, perms, by:actor(), at:new Date().toISOString(), expires:until(+dur.value), via:'toggle'});
          log('Shared with '+who.value+': '+perms.map(permName).join(', ')+' ('+dur.options[dur.selectedIndex].text+')', site); A.route(); toast('Shared with '+who.value); }},'Share')),
        grants.length ? h('div',{class:'list'}, grants.map(g => h('div',{class:'item'},
          h('div',{class:'meta'}, h('span',{class:'chip '+(active(g)?'calm':'grey')}, active(g) ? 'Active' : g.revoked ? 'Removed' : 'Ended'), h('span',null, g.expires ? (active(g)?'Ends ':'Ended ')+A.fmtTime(g.expires) : 'No end date'), h('span',null,'via '+(g.via==='code'?'code':'manager'))),
          h('b',null,g.staff), h('span',{class:'small'}, g.perms.map(permName).join(' · ')),
          active(g) ? h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ g.revoked = new Date().toISOString(); log('Removed '+g.staff+'\'s shared access', site); A.route(); }},'Remove now')) : null))) : h('p',{class:'small muted'},'Nothing shared yet.')));

      // invite code or link
      const box2 = h('div',{class:'grid'}, permBoxes('i_'));
      const valid = sel([['1','24 hours'],['3','3 days'],['7','1 week']], '3');
      const gdur = sel(DUR, '30');
      const uses = h('input',{type:'number',min:'1',max:'50',value:'1'});
      const invites = s.invites.filter(i => i.site === site).sort((a,b) => b.at.localeCompare(a.at));
      ap(v, h('div',{class:'card'}, h('h2',null,'Invite code or link'),
        h('p',{class:'small muted'},'Make a short code for someone to type in, or a link to tap. Useful on a shift handoff or for a new lead. You choose what it opens, how long the code works, and how long the access lasts.'),
        box2, h('div',{class:'grid g3'}, field('Code works for', valid), field('Access lasts', gdur), field('How many people can use it', uses)),
        h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{
          const perms = pickedPerms(box2); if (!perms.length){ toast('Pick at least one option'); return; }
          const inv = {code:code(), site, perms, by:actor(), at:new Date().toISOString(), expires:until(+valid.value), grantDays:+gdur.value, grantExpires:true, max:Math.max(1, Math.min(50, +uses.value||1)), used:0};
          s.invites.push(inv); log('Made invite code '+inv.code+' for: '+perms.map(permName).join(', '), site); A.route(); toast('Code ready: '+inv.code); }},'Make a code')),
        invites.length ? h('div',{class:'list'}, invites.map(i => { const ok = !i.revoked && i.expires > new Date().toISOString() && i.used < i.max; const link = location.origin+location.pathname+'#/access/redeem/'+i.code;
          return h('div',{class:'item'}, h('div',{class:'meta'}, h('span',{class:'chip '+(ok?'calm':'grey')}, ok ? 'Works' : i.revoked ? 'Cancelled' : 'Used or expired'), h('span',null,'Used '+i.used+' of '+i.max), h('span',null,'Code ends '+A.fmtTime(i.expires))),
            h('b',{class:'code'},i.code), h('span',{class:'small'}, i.perms.map(permName).join(' · ')),
            ok ? h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:e=>A.copy(i.code, e.target)},'Copy code'), h('button',{class:'btn quiet sm',type:'button',onclick:e=>A.copy(link, e.target)},'Copy link'), h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ i.revoked = new Date().toISOString(); log('Cancelled code '+i.code, site); A.route(); }},'Cancel code')) : null); })) : null,
        h('p',{class:'small muted'},'Test version: codes work only in this browser. To try one, switch "View as" to Caregiver and enter it below.')));
    }

    // my access (caregiver) and code entry
    if (S().tier === 'caregiver'){
      const mine = s.grants.filter(g => g.site === site && g.staff === meName() && active(g));
      const inp = h('input',{type:'text',autocomplete:'off',placeholder:'AC-XXXX-XXXX',style:'text-transform:uppercase'});
      ap(v, h('div',{class:'card'}, h('h2',null,'Your extra access ('+meName()+')'),
        mine.length ? h('div',{class:'list'}, mine.map(g => h('div',{class:'item'}, h('span',null,g.perms.map(permName).join(' · ')), h('span',{class:'small muted'},'Shared by '+g.by+(g.expires ? ' · ends '+A.fmtTime(g.expires) : ''))))) : h('p',{class:'muted'},'None right now.'),
        h('form',{class:'row',onsubmit:e=>{ e.preventDefault(); const err = redeem(inp.value); if (err) toast(err); else { toast('Access added. New options are in your menu.'); A.renderNav(); A.route(); } }}, field('Have a code?', inp), h('button',{class:'btn sm',type:'submit'},'Use code'))));
    }

    ap(v, signinCard(site));
    if (window.SSStation) ap(v, SSStation.setupCard(site));

    // change log
    const items = s.audit.filter(a => isOwner() || a.site === site).slice(0, 40);
    if (isBoss()) ap(v, h('details',{class:'card'}, h('summary',null,h('h2',{style:'display:inline'},'Change log ('+items.length+')')),
      h('p',{class:'small muted'},'Who changed what and when: schedules, approvals, punches, access and settings. Kept for audits and fair decisions.'),
      items.length ? h('div',{class:'list'}, items.map(a => h('div',{class:'item'}, h('div',{class:'meta'}, h('span',null,A.fmtTime(a.at)), h('span',{class:'chip grey'},a.who), isOwner() ? h('span',null,(D.SITES.find(x => x.id === a.site)||{}).name||'') : null), h('span',{class:'small'},a.what)))) : h('p',{class:'muted'},'No changes yet.'),
      h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>A.download('change-log.csv','text/csv',[['When','Who','Home','What']].concat(items.map(a => [a.at, a.who, a.site, a.what])).map(r => r.map(A.csvCell).join(',')).join('\r\n'))},'Download log (.csv)'))));
  };

  // ---------- sign-in choices (personal phone, email, shared house tablet) ----------
  function kioskCfg(site){ const s = st(); s.kiosk = s.kiosk || {}; s.kiosk[site] = s.kiosk[site] || {on:true, lockSec:20, unlock:'both', geo:false, home:null, net:false, allow:{clock:true, sched:true, req:true}}; return s.kiosk[site]; }
  async function hashPin(site, name, pin){ const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ss-pin|'+site+'|'+name+'|'+pin)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join(''); }
  async function checkPin(site, name, pin){ const s = st(); s.pins = s.pins || {}; const set = (s.pins[site]||{})[name]; if (!set) return pin === (name === '__exit' ? '0000' : '1234'); return set === await hashPin(site, name, pin); }
  async function setPin(site, name, pin){ const s = st(); s.pins = s.pins || {}; s.pins[site] = s.pins[site] || {}; s.pins[site][name] = await hashPin(site, name, pin); log((name === '__exit' ? 'Changed the tablet exit PIN' : 'Set a clock-in PIN for '+name), site); }
  function signinCard(site){
    if (site === 'family') return null;
    const k = kioskCfg(site), boss = isBoss();
    const card = h('div',{class:'card'}, h('h2',null,'Ways to sign in'),
      h('div',{class:'grid g3'},
        h('div',{class:'item'}, h('b',null,'📱 Personal phone'), h('span',{class:'small'},'Install the app and sign in with email and password. Staff see their own schedule, requests and time sheet.')),
        h('div',{class:'item'}, h('b',null,'✉️ Email code'), h('span',{class:'small'},'No password to remember: we email a one-time code. Works on any phone or computer.')),
        h('div',{class:'item'}, h('b',null,'🖥️ House tablet'), h('span',{class:'small'},'One shared tablet at the home. Staff tap their name and type a 4 to 6 digit PIN. It locks itself after each use.'))));
    if (boss){
      const sw = (key, label, obj) => { const id = 'k_'+key; obj = obj || k; return h('label',{class:'row small',for:id}, h('input',{type:'checkbox',id,checked:!!obj[key],onchange:e=>{ obj[key] = e.target.checked; log('House tablet: '+label+' '+(e.target.checked?'on':'off'), site); }}), label); };
      const lock = sel([['10','10 seconds'],['20','20 seconds'],['45','45 seconds']], k.lockSec); lock.addEventListener('change',()=>{ k.lockSec = +lock.value; A.save(); });
      const homeNote = h('span',{class:'small muted'}, k.home ? 'Home location saved.' : 'No home location saved yet.');
      ap(card, h('h3',null,'House tablet settings'),
        sw('on','Allow house tablet sign-in at this home'),
        h('div',{class:'grid g2'}, field('Lock again after', lock)),
        h('div',null, h('span',{class:'small',style:'font-weight:600;color:var(--muted)'},'What staff can do on the tablet'), sw('clock','Clock in and out', k.allow), sw('sched','See their own schedule', k.allow), sw('req','Send a request (time off, can\'t make a shift)', k.allow)),
        sw('geo','Clock-in must happen at the home (location check)'),
        h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ if (!navigator.geolocation){ toast('This device cannot share its location'); return; }
          navigator.geolocation.getCurrentPosition(p => { k.home = {lat:p.coords.latitude, lng:p.coords.longitude}; log('Saved the home location for clock-in checks', site); homeNote.textContent = 'Home location saved.'; toast('Saved this spot as the home'); }, () => toast('Location was not shared'), {enableHighAccuracy:true, timeout:10000}); }},'Use this spot as the home'), homeNote),
        sw('net','Clock-in must use the home\'s internet'),
        h('p',{class:'small muted'},'In the real app the server checks the home\'s internet address, so this cannot be faked from another place. The test version only shows the setting.'),
        h('p',{class:'small muted'},'The tablet never shows owner screens, reports, residents or anyone else\'s hours. Every punch records which device it came from.'),
        h('div',{class:'row'}, pinBtn(site, '__exit', 'Change the manager exit PIN')),
        h('p',{class:'small muted'},'Test version: every sample PIN is 1234 and the exit PIN is 0000 until you change them.'));
    }
    if (S().tier === 'caregiver') ap(card, h('div',{class:'row'}, pinBtn(site, meName(), 'Set my clock-in PIN')));
    else if (boss) ap(card, h('details',null, h('summary',{class:'small'},'Reset a staff member\'s PIN'), h('div',{class:'row'}, (S().staff[site]||[]).map(p => pinBtn(site, p.n, p.n)))));
    return card;
  }
  function pinBtn(site, name, label){
    return h('button',{class:'btn quiet sm',type:'button',onclick:()=>SSSched.dialog(label, (box, dlg) => {
      const a = h('input',{type:'password',inputmode:'numeric',autocomplete:'new-password',maxlength:'6',pattern:'[0-9]*'});
      const b = h('input',{type:'password',inputmode:'numeric',autocomplete:'new-password',maxlength:'6',pattern:'[0-9]*'});
      ap(box, h('p',{class:'small'},'4 to 6 digits. Avoid birthdays and 1111-style PINs.'), field('New PIN', a), field('Type it again', b),
        h('div',{class:'row'}, h('button',{class:'btn',type:'button',onclick:async ()=>{
          if (!/^\d{4,6}$/.test(a.value)){ toast('Use 4 to 6 digits'); return; }
          if (/^(\d)\1+$/.test(a.value) || '0123456789'.includes(a.value) || '9876543210'.includes(a.value)){ toast('Pick a less obvious PIN'); return; }
          if (a.value !== b.value){ toast('The two PINs do not match'); return; }
          await setPin(site, name, a.value); A.save(); dlg.close(); toast('PIN saved'); }},'Save PIN')));
    })}, label);
  }

  // Other modules (for example meals or handoff) join the same switches: SSAccess.register({id, name, ic, what, views:['viewId'], tiers:['manager',...]})
  function register(m){
    if (!m || !m.id || SD.modules.some(x => x.id === m.id)) return;
    SD.modules.push({id:m.id, name:m.name||m.id, ic:m.ic||'', what:m.what||''});
    DEFAULT_TIERS[m.id] = (m.tiers || STAFF_TIERS).slice();
    (m.views||[]).forEach(v => { VIEW_MOD[v] = m.id; });
  }
  window.SSAccess = {viewOn, offView, can, log, kioskCfg, checkPin, setPin, mod, active, register};
})();
