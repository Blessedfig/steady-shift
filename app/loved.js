// Steady Shift test app: Family sharing (#/sharing) and Your loved one (#/loved).
// Christian (2026-11-28): approved people can see updates about their loved one, either as a summary sent to them or the
// specific details they choose, with prompts to check in. The permission must be signed by the resident or their
// guardian (or activated health care POA), with full signature documentation. Signing is how a person is pre-approved,
// so staff can share with them without asking each time. If anyone is upset about access later, the home needs papers
// that show permission was given. Warm words ("resident", "your loved one"), never "client".
//
// Built to the parts of a valid HIPAA authorization (45 CFR 164.508(c): what is shared, who shares, who receives, purpose,
// end date or event, signature and date, and the signer's authority when a representative signs; plus the three required
// statements: revoking in writing, care is not conditioned on signing, and redisclosure) and Wisconsin informed consent
// for health records (Wis. Stat. 146.81(2) and 146.82). Mental health (51.30), alcohol and drug treatment (42 CFR Part 2)
// and HIV test results (252.15) are never shared through this form; they need their own consent.
// Test version: sample people only, kept in this browser. Not legal advice; a Wisconsin health law attorney should review
// the form wording and the "Proof and protection" page before real use.
(function(){
  const A = window.SSApp; if (!A) return;
  const {D, h, save, toast, head, R, VIEWS, NAV, uid, fmtDate, fmtTime, copy} = A;
  const S = () => A.state();
  const today = () => A.isoDay(new Date());
  const chip = (t, c) => h('span',{class:'chip'+(c ? ' '+c : '')}, t);
  const card = (c, ...k) => h('div',{class:'card'+(c ? ' '+c : '')}, ...k);
  const tierId = () => S().tier;
  const isMgr = () => ['manager','owner','multi','rn'].includes(tierId());
  const canSign = () => ['manager','owner','multi'].includes(tierId());   // the person who collects and witnesses signatures
  const sites = () => D.SITES.filter(s => s.id !== 'family');
  const sid = () => S().site === 'family' ? 'maple' : S().site;
  const siteName = id => (D.SITES.find(s => s.id === id)||{}).name || id;
  const resOf = (site, code) => (D.RESIDENTS[site]||[]).find(r => r.code === code) || {code, nick:code};
  const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 864e5);
  const field = (label, el, hint) => { el.id = el.id || 'ls'+uid(); return h('label',{class:'f',for:el.id}, label, el, hint ? h('span',{class:'small muted',style:'font-weight:400'},hint) : null); };
  const plural = (n, w) => n+' '+w+(n === 1 ? '' : 's');
  function me(){ try { if (window.SSSched && SSSched.me) { const m = SSSched.me(); if (m) return m; } } catch(e){} return A.tier().name+' (you)'; }

  // ---------- what can be shared ----------
  const TOPICS = [
    {id:'wellbeing', t:'How they are doing', d:'Mood, sleep and eating, in a few warm sentences', sum:true},
    {id:'activities', t:'Activities and outings', d:'What they did and enjoyed', sum:true},
    {id:'appts', t:'Appointments', d:'Dates and who the visit is with', sum:true},
    {id:'meals', t:'Meals and appetite', d:'How they are eating and drinking'},
    {id:'health', t:'Health changes', d:'New concerns, illness, and what the nurse or doctor said'},
    {id:'meds', t:'Medicine changes', d:'That a medicine was started, stopped or changed, and why'},
    {id:'falls', t:'Falls and incidents', d:'What happened and what the home did about it'},
    {id:'plan', t:'Care plan meetings', d:'Invitations and the plan summary'},
    {id:'money', t:'Personal spending', d:'Allowance and purchases'}
  ];
  const SUMMARY = TOPICS.filter(t => t.sum).map(t => t.id);
  const topicName = id => (TOPICS.find(t => t.id === id)||{t:id}).t;
  const NEVER = [
    'Mental health or counseling treatment records (Wis. Stat. 51.30 needs its own consent form)',
    'Alcohol or drug treatment records (42 CFR Part 2 needs its own consent form)',
    'HIV test results (Wis. Stat. 252.15 needs its own consent)',
    'Psychotherapy notes',
    'Social Security, Medicaid and Medicare numbers'
  ];
  // words that should never be in a family update; the manager must take them out before sending
  const NEVER_WORDS = /\b(psychiatr\w*|counsel(?:or|ing)|therap(?:y|ist) session|AODA|alcohol treatment|drug treatment|rehab program|methadone|suboxone|HIV|\d{3}-\d{2}-\d{4}|medicaid (?:id|number)|medicare (?:id|number))\b/i;
  const CAP = {
    self:{t:'The resident, for themselves', short:'Resident'},
    guardian:{t:'Court-appointed guardian', short:'Guardian'},
    poa:{t:'Health care power of attorney (activated)', short:'Health care POA'},
    other:{t:'Other legal representative (papers checked)', short:'Legal representative'}
  };
  const LEVEL = {summary:'Summary only', details:'Chosen details'};
  const FREQ = {7:'Every week', 14:'Every 2 weeks', 30:'Every month'};

  // ---------- state ----------
  function st(){
    const s = S();
    if (!s.share || s.share.v !== 1){ s.share = seed(); save(); }
    return s.share;
  }
  const iso = (d, t) => d+'T'+(t||'10:00')+':00';
  function seed(){
    const t = today(), ago = n => A.addDays(t, -n);
    const sh = {v:1, auths:[], log:[], updates:[], checkins:[], notes:[], kinAs:''};
    const mk = (o) => { const a = Object.assign({id:'au-'+uid(), version:1, status:'active', statements:{revoke:true, noCondition:true, redisclose:true}, sig:{method:'typed'}, nudge:{on:true, every:7, best:''}, freq:14, rightAway:false, wishes:'', purpose:'At the request of the resident, so family can stay close and check in', expiresEvent:'', hash:'', copy:{how:'Printed copy handed to the signer', at:''}}, o); a.copy.at = a.copy.at || a.signedAt; return a; };
    sh.auths.push(mk({site:'maple', res:'M-1', to:{name:'Carol (sample)', rel:'Daughter', phone:'715-555-0101', email:'carol@family.example', idCheck:'Known to staff for 2 years'},
      level:'summary', topics:SUMMARY.slice(), freq:7, rightAway:true, signer:{name:'Ruth (sample)', cap:'self', authority:'Makes her own decisions. Health care POA on file is not activated.'},
      sig:{method:'typed', typed:'Ruth (sample)'}, witness:'House manager (sample)', signedAt:iso(ago(40)), start:ago(40), expires:A.addDays(ago(40), 365),
      nudge:{on:true, every:7, best:'Sunday afternoons, after her TV service'}, wishes:''}));
    sh.auths.push(mk({site:'maple', res:'M-1', to:{name:'Grandson (sample)', rel:'Grandson', phone:'715-555-0111', email:'', idCheck:'Photo ID seen at visit'},
      level:'details', topics:['wellbeing','activities','appts','meals','falls'], freq:14, rightAway:true, signer:{name:'Ruth (sample)', cap:'self', authority:'Makes her own decisions.'},
      sig:{method:'typed', typed:'Ruth (sample)'}, witness:'House manager (sample)', signedAt:iso(ago(12)), start:ago(12), expires:A.addDays(ago(12), 365),
      nudge:{on:true, every:10, best:'Evenings before 8 PM'}}));
    sh.auths.push(mk({site:'maple', res:'M-2', to:{name:'Son (sample)', rel:'Son', phone:'715-555-0104', email:'son@family.example', idCheck:'Guardian confirmed by phone'},
      level:'details', topics:['wellbeing','activities','appts','health','falls','plan'], freq:7, rightAway:true, signer:{name:'Guardian (sample)', cap:'guardian', authority:'Guardian of the person and estate. Letters of guardianship (sample county court) cover health care. Copy in red folder.'},
      sig:{method:'typed', typed:'Guardian (sample)'}, witness:'House manager (sample)', signedAt:iso(ago(25)), start:ago(25), expires:A.addDays(ago(25), 365),
      wishes:'Walt smiled and said "my boy should know how I am." He asked that his son hear about his walks.', nudge:{on:true, every:7, best:'Late mornings'}, emailOk:{text:EMAIL_RISK}}));
    sh.auths.push(mk({site:'maple', res:'M-3', to:{name:'Old friend (sample)', rel:'Friend from church', phone:'715-555-0121', email:'', idCheck:'Niece (POA) introduced in person'},
      level:'summary', topics:SUMMARY.slice(), freq:30, signer:{name:'Niece (sample)', cap:'poa', authority:'Health care POA, activated. Activation letter in red folder.'},
      sig:{method:'typed', typed:'Niece (sample)'}, witness:'House manager (sample)', signedAt:iso(ago(200)), start:ago(200), expires:ago(20), nudge:{on:false, every:14, best:''}}));
    sh.auths.push(mk({site:'birch', res:'B-2', to:{name:'Nephew (sample)', rel:'Nephew', phone:'715-555-0131', email:'nephew@family.example', idCheck:'Photo ID seen'},
      level:'details', topics:['wellbeing','activities','appts','health'], signer:{name:'Lois (sample)', cap:'self', authority:'Makes her own decisions.'},
      sig:{method:'typed', typed:'Lois (sample)'}, witness:'House manager (sample)', signedAt:iso(ago(90)), start:ago(90), expires:A.addDays(ago(90), 365),
      status:'revoked', revoked:{at:iso(ago(6),'14:20'), by:'Lois (sample)', how:'Told the house manager in person, then signed the revoke form', reason:'Asked to keep things private for now', staff:'House manager (sample)'}}));
    sh.auths.forEach(a => { a.hash = 'sample-'+a.id; a.account = {code:inviteCode(), invitedAt:a.signedAt, joinedAt:status(a) === 'active' ? a.signedAt : '', get:a.to.email ? 'notice' : 'app'}; });
    const lg = (at, kind, text, a) => sh.log.push({id:uid(), at, kind, who:'House manager (sample)', text, auth:a ? a.id : '', res:a ? a.res : '', site:a ? a.site : 'maple'});
    sh.auths.forEach(a => { lg(a.signedAt, 'signed', 'Permission signed by '+a.signer.name+' ('+CAP[a.signer.cap].short+') for '+a.to.name, a); lg(a.signedAt, 'copy', 'Copy given: '+a.copy.how, a); });
    const rv = sh.auths[4]; lg(rv.revoked.at, 'revoked', 'Permission ended by '+rv.revoked.by+': '+rv.revoked.how, rv);
    const [carol, gs, son] = sh.auths;
    sh.updates.push({id:'up-'+uid(), site:'maple', res:'M-1', at:iso(ago(7),'16:00'), by:'House manager (sample)', kind:'summary', topics:['wellbeing','activities','appts'],
      text:'Ruth had a good week. She ate well most days, slept through most nights, and enjoyed coffee on the porch with a blanket. She has a dental cleaning coming up next week.', to:[carol.id, gs.id], reads:{[carol.id]:iso(ago(6),'09:12')}});
    sh.updates.push({id:'up-'+uid(), site:'maple', res:'M-2', at:iso(ago(3),'15:30'), by:'House manager (sample)', kind:'detail', topics:['wellbeing','activities'],
      text:'Walt went out for coffee on Tuesday afternoon and came back happy. He ate well at supper and has been walking the hallway with staff most evenings.', to:[son.id], reads:{}});
    sh.checkins.push({id:uid(), auth:carol.id, at:iso(ago(9),'14:00'), kind:'call', text:''});
    sh.checkins.push({id:uid(), auth:son.id, at:iso(ago(2),'11:00'), kind:'visit', text:''});
    sh.notes.push({id:uid(), auth:carol.id, site:'maple', res:'M-1', at:iso(ago(5),'19:40'), kind:'note', text:'Please tell Mom the baby is due in March and we will bring photos at Christmas.', status:'done', doneBy:'Caregiver B (sample)', doneAt:iso(ago(4),'08:10')});
    sh.log.sort((a,b) => a.at < b.at ? 1 : -1);
    return sh;
  }
  function log(kind, text, a, extra){
    const sh = st();
    sh.log.unshift(Object.assign({id:uid(), at:new Date().toISOString(), kind, who:tierId() === 'kin' ? (kinAuth()||{to:{name:'Family'}}).to.name : me(), text, auth:a ? a.id : '', res:a ? a.res : '', site:a ? a.site : sid()}, extra||{}));
    if (sh.log.length > 1500) sh.log.length = 1500;
    save();
  }

  // ---------- status ----------
  function status(a){
    if (a.status === 'revoked') return 'revoked';
    if (a.expires && a.expires < today()) return 'expired';
    if (a.start && a.start > today()) return 'later';
    return 'active';
  }
  const STAT = {active:['Active','calm'], revoked:['Ended by signer','grey'], expired:['Expired','amber'], later:['Starts later','grey']};
  const soon = a => status(a) === 'active' && a.expires && daysBetween(today(), a.expires) <= 30;
  const live = (site, code) => st().auths.filter(a => a.site === site && (!code || a.res === code) && status(a) === 'active');
  const allows = (a, topics) => topics.every(t => (a.level === 'summary' ? SUMMARY : a.topics).includes(t));

  // who may sign, from the face sheet's decision maker
  function decider(code){
    let f = null; try { f = window.SSFace && SSFace.face(code); } catch(e){}
    const r = resOf(sid(), code);
    if (f && f.guardian){
      const health = /health|person/i.test((f.guardian.scope||'')+' '+(f.guardian.type||''));
      return {cap:'guardian', name:f.guardian.name, authority:f.guardian.type+'. Decides: '+(f.guardian.scope||'see court letters')+'. Papers: '+(f.guardian.letters||'on file'),
        why:'A guardian is on file, so the guardian signs. '+r.nick+'\'s own wishes are still asked and written down.', warn:health ? '' : 'The guardian\'s papers may not cover health care. Check the court letters before going on.'};
    }
    if (f && f.poa && f.poa.activated && /health/i.test(f.poa.type)){
      return {cap:'poa', name:f.poa.name, authority:f.poa.type+', activated. Papers: '+(f.poa.papers||'on file'),
        why:'The health care POA is activated, so the agent signs. '+r.nick+'\'s own wishes are still asked and written down.', warn:''};
    }
    return {cap:'self', name:r.nick+' (sample)', authority:f && f.poa ? 'Makes their own decisions. The POA on file is not activated.' : 'Makes their own decisions.',
      why:f && f.poa ? 'The POA is not activated, so '+r.nick+' decides and signs.' : r.nick+' makes their own decisions and signs.', warn:''};
  }

  // ---------- the form text (what is signed, printed and hashed) ----------
  function formText(a){
    const r = resOf(a.site, a.res), sh = a.level === 'summary' ? SUMMARY : a.topics;
    return [
      'PERMISSION TO SHARE UPDATES WITH FAMILY OR FRIENDS',
      'Home: '+siteName(a.site)+' (the home shares the updates)',
      'Resident: '+r.nick+' (sample), code '+a.res,
      '',
      '1. Who may get updates: '+a.to.name+', '+a.to.rel+(a.to.phone ? ', phone '+a.to.phone : '')+(a.to.email ? ', email '+a.to.email : '')+'.',
      '2. What may be shared: '+LEVEL[a.level]+'. Topics: '+sh.map(topicName).join('; ')+'.'+(a.rightAway ? ' The home may also call or message right away about a fall, an emergency room or hospital trip, or a serious illness.' : ''),
      '   Never shared under this permission: '+NEVER.join('; ')+'.',
      '3. Why: '+a.purpose+'.',
      '4. How often and how: summary updates '+FREQ[a.freq].toLowerCase()+', in the Steady Shift app.'+(a.to.email ? (a.emailOk ? ' Full updates may also be sent by regular email. '+EMAIL_RISK : ' Emails only say there is a new update, with no details.') : ''),
      '5. Starts: '+fmtDate(a.start+'T12:00:00')+'. Ends: '+(a.expires ? fmtDate(a.expires+'T12:00:00') : '')+(a.expiresEvent ? (a.expires ? ', or sooner if: ' : '')+a.expiresEvent : '')+'.',
      '',
      'Please read:',
      '- You can end this permission at any time. Tell the home in writing (a note, the form in the app, or an email to the manager). Ending it stops future sharing; it cannot take back what was already shared.',
      '- The home will not change care, housing, payment or admission because of signing or not signing this.',
      '- Once information is shared, the person who gets it could share it further, and federal privacy law may no longer protect it.',
      '- You get a copy of this signed form.',
      '',
      'Signed by: '+a.signer.name+', as '+CAP[a.signer.cap].t+'.',
      a.signer.cap !== 'self' ? 'Authority: '+a.signer.authority : 'Decision making: '+a.signer.authority,
      a.wishes ? 'What the resident said about this: '+a.wishes : '',
      'Signature: '+(a.sig.method === 'drawn' ? 'signed by hand on screen' : a.sig.method === 'mark' ? 'signed with a mark, witnessed' : 'typed signature')+' ('+(a.sig.typed||a.signer.name)+')',
      'Date and time signed: '+fmtTime(a.signedAt),
      'Witnessed and collected by: '+a.witness,
      'How the recipient was confirmed: '+(a.to.idCheck||'not recorded'),
      'Form version: Steady Shift family sharing v1 (test). Record id: '+a.id
    ].filter(x => x !== '').join('\n');
  }
  async function sha(text){
    try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join(''); }
    catch(e){ let x = 0; for (let i = 0; i < text.length; i++) x = (x*31 + text.charCodeAt(i)) >>> 0; return 'weak-'+x.toString(16); }
  }

  // a family account invite (test: a code shown on screen; live: an email invite to a family-only sign-in)
  const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function inviteCode(){ const x = new Uint32Array(8); crypto.getRandomValues(x); return 'FAM-'+[...x].map((n, i) => (i === 4 ? '-' : '')+ALPH[n % ALPH.length]).join(''); }
  // Email is not secure. By default an email only says there is a new update, with a sign-in link. Full updates by
  // email need the signer's written OK that they understand the risk (HHS allows unencrypted email when the person
  // has been warned and still wants it); that OK is part of the signed form and the log.
  const GET = {app:'In the app only', notice:'In the app, plus an email notice (no details)', full:'Full updates by email too'};
  const EMAIL_RISK = 'Regular email is not secure. Someone else could read it, and it could go to the wrong person. The signer still wants full updates sent by email.';
  const getOk = (a, k) => k === 'app' || (!!a.to.email && (k === 'notice' || (k === 'full' && !!a.emailOk)));
  const getOpts = (a, cur) => Object.entries(GET).map(([k, l]) => h('option',{value:k, selected:k === cur || null, disabled:!getOk(a, k) || null}, l+(k === 'full' && !a.emailOk ? ' (the signer has not allowed this)' : '')));
  const acct = a => a.account || (a.account = {code:'', invitedAt:'', joinedAt:'', get:'app'});
  // the basics every approved person gets, whatever level they chose
  function basics(a){
    const r = resOf(a.site, a.res), site = D.SITES.find(x => x.id === a.site) || {};
    let appts = [];
    if (allows(a, ['appts'])) try { appts = (window.SS_ordersFor ? SS_ordersFor(a.site, a.res) : []).filter(o => o.kind === 'appointment' && o.start >= today()).map(o => fmtDate(o.start+'T12:00:00')+' · '+o.text.replace(/\s*\(sample\)\.?/,'').replace(/\.$/,'')); } catch(e){}
    return {name:r.nick, home:site.name || '', city:site.city || '', phone:'715-555-0100 (sample)', manager:'House manager (sample)', visiting:'Any time that suits '+r.nick+'. Please call ahead after 8 PM.', best:a.nudge.best, appts};
  }

  // =====================================================================
  // STAFF: Family sharing
  // =====================================================================
  R.sharing = v => {
    if (S().site === 'family'){ v.append(head('Family sharing','Who can see updates','This screen is for adult family homes and CBRFs. Switch to one of the sample homes at the top.')); return; }
    st();
    const p = (A.param() || '').split('/');
    const tab = p[0] || (isMgr() ? 'list' : 'who');
    if (tab === 'new' && canSign()) return wizard(v, p[1]);
    if (tab === 'record') return record(v, p[1]);
    v.append(head('Family sharing · '+siteName(sid()), {who:'Who can I tell?', list:'Signed permissions', send:'Send an update', notes:'Notes from family', log:'Access log', proof:'Proof and protection'}[tab] || 'Family sharing',
      'Residents, or their guardian or activated health care POA, sign who may get updates and what kind. Once signed, staff can share within it without asking each time.'));
    const tabs = [['who','🙋 Who can I tell?']];
    if (isMgr()) tabs.push(['list','✍️ Permissions'], ['send','💌 Send an update'], ['notes','📨 Notes from family'], ['log','📜 Access log'], ['proof','🛡️ Proof and protection']);
    else tabs.push(['notes','📨 Notes from family']);
    v.append(h('div',{class:'row noprint',role:'tablist',style:'margin-bottom:.6rem'}, tabs.map(([k,l]) => h('a',{class:'btn '+(k === tab ? '' : 'quiet ')+'sm',href:'#/sharing/'+k,role:'tab','aria-selected':String(k === tab)}, l))));
    ({who, list, send, notes:famNotes, log:logTab, proof}[tab] || who)(v);
  };

  // ---------- Who can I tell? (all staff) ----------
  function who(v){
    const res = D.RESIDENTS[sid()] || [];
    const sel = h('select',null, h('option',{value:''},'Pick a resident'), res.map(r => h('option',{value:r.code}, r.nick+' ('+r.code+')')));
    const out = h('div',{class:'grid'});
    sel.addEventListener('change', () => draw(sel.value));
    v.append(card('', h('h2',null,'Someone is asking about a resident'), field('Who are they asking about?', sel), out));
    v.append(card('soft', h('h3',null,'If the person is not on the list'),
      h('ul',{class:'small'}, h('li',null,'Be kind. Say: "I\'m not able to share details, but I\'ll let the manager know you called."'),
        h('li',null,'Take their name, number and who they are. Do not confirm health details.'),
        h('li',null,'In an emergency, the manager or nurse decides what to share. The law allows sharing what is needed in an emergency, and the resident\'s best interest comes first.')),
      h('p',{class:'small muted'},'You can always tell anyone general things that are not about one person, like visiting hours.')));
    function draw(code){
      out.textContent = '';
      if (!code) return;
      const r = resOf(sid(), code), on = live(sid(), code);
      log('lookup', 'Checked who may get updates about '+r.nick, {id:'', res:code, site:sid()});
      if (!on.length){ out.append(card('warn', h('b',null,'No one has signed permission for '+r.nick+' yet.'), h('p',{class:'small'},'Share nothing about '+r.nick+'\'s health or care. Take a message for the manager.'))); return; }
      on.forEach(a => {
        const sh = a.level === 'summary' ? SUMMARY : a.topics;
        out.append(h('div',{class:'item'},
          h('div',{class:'meta'}, chip(LEVEL[a.level], a.level === 'summary' ? 'grey' : 'calm'), a.rightAway ? chip('Call right away for emergencies','amber') : null, soon(a) ? chip('Ends '+fmtDate(a.expires+'T12:00:00'),'amber') : null),
          h('b',null, a.to.name+' · '+a.to.rel),
          h('span',{class:'small'}, h('b',null,'You may share: '), sh.map(topicName).join(', ')+'.'),
          h('span',{class:'small muted'}, 'Not: anything else, and never '+['mental health treatment','alcohol or drug treatment','HIV results'].join(', ')+'.'),
          h('span',{class:'small muted'}, 'Signed by '+a.signer.name+' ('+CAP[a.signer.cap].short+') on '+fmtDate(a.signedAt)+'. Confirm it is really them: '+(a.to.phone ? 'call back at '+a.to.phone+' if unsure.' : 'ask the manager if unsure.'))));
      });
    }
  }

  // ---------- Permissions list (managers) ----------
  function list(v){
    const sh = st(), res = D.RESIDENTS[sid()] || [];
    const all = sh.auths.filter(a => a.site === sid());
    const ending = all.filter(soon);
    if (ending.length) v.append(card('warn', h('b',null, plural(ending.length,'permission')+' ending in the next 30 days'), h('p',{class:'small'}, ending.map(a => a.to.name+' for '+resOf(a.site,a.res).nick+' ('+fmtDate(a.expires+'T12:00:00')+')').join('; ')+'. Ask the signer if they want to renew.')));
    res.forEach(r => {
      const mine = all.filter(a => a.res === r.code), d = decider(r.code);
      const c = card('', h('div',{class:'row',style:'justify-content:space-between'}, h('h2',{style:'margin:0'}, r.nick+' ('+r.code+')'),
        canSign() ? h('a',{class:'btn sm',href:'#/sharing/new/'+encodeURIComponent(r.code)},'+ New permission') : null),
        h('p',{class:'small muted'}, 'Who signs: '+d.why));
      if (!mine.length) c.append(h('p',{class:'small muted'},'No one has permission yet.'));
      mine.sort((a,b) => (status(a) === 'active' ? 0 : 1) - (status(b) === 'active' ? 0 : 1)).forEach(a => {
        const s = STAT[status(a)];
        const reads = sh.updates.filter(u => u.to.includes(a.id)).length;
        c.append(h('div',{class:'item'},
          h('div',{class:'meta'}, chip(s[0], s[1]), chip(LEVEL[a.level], 'grey'), soon(a) ? chip('Ends soon','amber') : null, status(a) === 'active' ? chip(acct(a).joinedAt ? 'Family account · '+(GET[acct(a).get]||GET.app).toLowerCase() : acct(a).code ? 'Invited, not joined yet' : 'No family account', acct(a).joinedAt ? 'calm' : 'grey') : null),
          h('b',null, a.to.name+' · '+a.to.rel),
          h('span',{class:'small'}, (a.level === 'summary' ? SUMMARY : a.topics).map(topicName).join(', ')),
          h('span',{class:'small muted'}, 'Signed by '+a.signer.name+' ('+CAP[a.signer.cap].short+'), '+fmtDate(a.signedAt)+(a.expires ? ' · ends '+fmtDate(a.expires+'T12:00:00') : '')+' · '+plural(reads,'update')+' sent'),
          a.revoked ? h('span',{class:'small muted'}, 'Ended '+fmtDate(a.revoked.at)+' by '+a.revoked.by+': '+a.revoked.how+(a.revoked.reason ? ' ('+a.revoked.reason+')' : '')) : null,
          h('div',{class:'row'}, h('a',{class:'btn quiet sm',href:'#/sharing/record/'+a.id},'Open the signed record'),
            status(a) === 'active' && canSign() ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>revoke(a)},'End this permission') : null,
            status(a) !== 'active' && canSign() && status(a) !== 'later' ? h('a',{class:'btn quiet sm',href:'#/sharing/new/'+encodeURIComponent(a.res)+'?from='+a.id},'Sign a new one') : null)));
      });
      v.append(c);
    });
    if (!canSign()) v.append(h('p',{class:'small muted'},'Only a house manager or owner collects and witnesses signatures.'));
  }

  function revoke(a){
    const dlg = h('dialog',{class:'qs',style:'padding:1.1rem'});
    const by = h('select',null, [a.signer.name+' ('+CAP[a.signer.cap].short+')', resOf(a.site,a.res).nick+' (the resident)', 'The home (recipient no longer appropriate)'].map(x => h('option',{value:x},x)));
    const how = h('select',null, ['Signed the end form in the app','Gave a written note','Sent an email','Told staff in person (written down and read back)'].map(x => h('option',{value:x},x)));
    const why = h('input',{type:'text',placeholder:'Optional, in their words'});
    dlg.append(h('form',{method:'dialog',class:'grid'}, h('h2',null,'End permission for '+a.to.name),
      h('p',{class:'small'},'This stops new updates right away. It cannot take back what was already shared. The signed record and log stay on file.'),
      field('Who is ending it?', by), field('How did they tell the home?', how), field('Reason', why),
      h('div',{class:'row'}, h('button',{class:'btn red',type:'button',onclick:()=>{
        a.status = 'revoked'; a.revoked = {at:new Date().toISOString(), by:by.value, how:how.value, reason:why.value.trim(), staff:me()};
        log('revoked', 'Permission for '+a.to.name+' ended by '+by.value+': '+how.value, a); dlg.close(); dlg.remove(); toast('Permission ended. '+a.to.name+' will see that access has ended.'); A.route(); }},'End permission'),
        h('button',{class:'btn quiet',type:'button',onclick:()=>{ dlg.close(); dlg.remove(); }},'Keep it'))));
    document.body.append(dlg); dlg.showModal();
  }

  // ---------- New permission: guided signing ----------
  function wizard(v, codeAndQuery){
    const [code, q] = String(codeAndQuery||'').split('?');
    const r = resOf(sid(), code); if (!code || !(D.RESIDENTS[sid()]||[]).some(x => x.code === code)){ v.append(head('Family sharing','Pick a resident first',''), h('a',{class:'btn',href:'#/sharing/list'},'Back')); return; }
    const from = q && q.startsWith('from=') ? st().auths.find(a => a.id === q.slice(5)) : null;
    const d = decider(code);
    const a = {id:'au-'+uid(), version:1, site:sid(), res:code, status:'active', to:from ? Object.assign({}, from.to) : {name:'', rel:'', phone:'', email:'', idCheck:''},
      level:from ? from.level : 'summary', topics:from ? from.topics.slice() : SUMMARY.slice(), freq:from ? from.freq : 14, rightAway:from ? from.rightAway : true,
      purpose:'At the request of '+(d.cap === 'self' ? 'the resident' : 'the resident\'s '+CAP[d.cap].short.toLowerCase())+', so family can stay close and check in',
      start:today(), expires:A.addDays(today(), 365), expiresEvent:r.nick+' moves out of this home',
      signer:{name:d.name, cap:d.cap, authority:d.authority}, wishes:'', statements:{}, nudge:{on:true, every:7, best:''}, sig:{method:'drawn', typed:''}, witness:me(), copy:{how:'', at:''}};
    let step = 0;
    const STEPS = ['Who signs','Who gets updates','What they see','How long','Read together','Sign','Give a copy'];
    v.append(head('New permission · '+r.nick+' ('+code+')', 'Who may see updates about '+r.nick, 'Do this with '+(d.cap === 'self' ? r.nick : 'the '+CAP[d.cap].short.toLowerCase())+' in person, on this tablet or phone. Read each part out loud if that helps.'));
    const bar = h('ol',{class:'row small',style:'list-style:none;padding:0;margin:0 0 .6rem;gap:.4rem','aria-label':'Steps'});
    const body = h('div',{class:'grid'});
    v.append(bar, body);
    function draw(){
      bar.textContent = '';
      STEPS.forEach((s, i) => bar.append(h('li',null, chip((i < step ? '✓ ' : '')+(i+1)+'. '+s, i === step ? '' : i < step ? 'calm' : 'grey'))));
      body.textContent = '';
      [signer, recipient, scope, length, statements, sign, give][step]();
      const f = body.querySelector('input,select,textarea'); if (f && step) setTimeout(() => { try { f.focus({preventScroll:true}); } catch(e){} }, 30);
    }
    const nav = (ok, nextLabel) => h('div',{class:'row'},
      step && step < 6 ? h('button',{class:'btn quiet',type:'button',onclick:()=>{ step--; draw(); }},'Back') : null,
      step < 6 ? h('button',{class:'btn',type:'button',onclick:()=>{ const m = ok ? ok() : ''; if (m){ toast(m); return; } step++; draw(); }}, nextLabel || 'Next') : null,
      step < 5 ? h('a',{class:'btn quiet',href:'#/sharing/list'},'Cancel') : null);

    function signer(){
      const cap = h('select',null, Object.entries(CAP).map(([k, c]) => h('option',{value:k, selected:k === a.signer.cap || null}, c.t)));
      const nm = h('input',{type:'text',value:a.signer.name,autocomplete:'off'});
      const au = h('textarea',{style:'min-height:3.5rem'}, a.signer.authority);
      const wish = h('textarea',{style:'min-height:3.5rem',placeholder:'In their own words, for example: "Yes, my daughter should know how I am."'}, a.wishes);
      const note = h('div');
      const upd = () => {
        note.textContent = '';
        if (cap.value !== d.cap) note.append(card('warn', h('b',null,'This is different from the face sheet.'), h('p',{class:'small'}, 'The face sheet says: '+d.why+' Only change this if you have seen newer legal papers. Write what you saw below, and update the face sheet too.')));
        if (cap.value === 'self' && d.cap !== 'self') note.append(card('alert', h('b',null,'A '+CAP[d.cap].short.toLowerCase()+' is on file.'), h('p',{class:'small'},'When a guardian or activated POA is on file, they sign. Ask the manager or the nurse before going on.')));
      };
      cap.addEventListener('change', upd);
      body.append(card('', h('h2',null,'1. Who is signing?'),
        h('p',null, d.why), d.warn ? card('warn', h('p',{class:'small'}, d.warn)) : null,
        field('Signing as', cap), note, field('Full name of the person signing', nm), field('Their authority (what papers you saw)', au, 'Guardian: court letters and what they cover. POA: the document and the activation letter. Resident: say they make their own decisions.'),
        d.cap !== 'self' ? field('What did '+r.nick+' say about sharing?', wish, 'Even with a guardian or POA, ask the resident and write down their wishes. Wisconsin resident rights protect their privacy and their say.') : null,
        nav(() => { a.signer = {name:nm.value.trim(), cap:cap.value, authority:au.value.trim()}; a.wishes = wish.value.trim();
          if (!a.signer.name) return 'Add the name of the person signing';
          if (a.signer.cap !== 'self' && a.signer.authority.length < 8) return 'Write what legal papers you saw';
          if (a.signer.cap === 'self' && d.cap !== 'self') return 'A guardian or activated POA is on file, so they sign';
          return ''; })));
      upd();
    }

    function recipient(){
      const nm = h('input',{type:'text',value:a.to.name,autocomplete:'off'});
      const rel = h('input',{type:'text',value:a.to.rel,placeholder:'Daughter, son, friend, neighbor…',autocomplete:'off'});
      const ph = h('input',{type:'tel',value:a.to.phone,autocomplete:'off'});
      const em = h('input',{type:'email',value:a.to.email,autocomplete:'off'});
      const idc = h('select',null, ['Photo ID seen in person','Known to staff for a long time','Introduced in person by the signer','Called back at a number the signer gave'].map(x => h('option',{value:x,selected:x === a.to.idCheck || null},x)));
      let f = null; try { f = SSFace.face(code); } catch(e){}
      const known = f ? [].concat(f.family||[], f.emergency||[]).filter((x, i, arr) => x && x.name && arr.findIndex(y => y.name === x.name) === i) : [];
      body.append(card('', h('h2',null,'2. Who may get updates?'),
        h('p',{class:'small'},'One person per permission, so each one can be ended on its own. Add another person after this one.'),
        known.length ? h('div',null, h('span',{class:'small muted'},'From the face sheet: '), h('div',{class:'row'}, known.map(x => h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ nm.value = x.name; rel.value = x.role||x.rel||''; ph.value = x.phone||''; }}, x.name)))) : null,
        field('Their name', nm), field('How they know '+r.nick, rel), field('Phone', ph), field('Email (optional)', em),
        field('How the home will know it is really them', idc, 'Staff check this before sharing on the phone. In the live app they sign in with their own account.'),
        nav(() => { a.to = {name:nm.value.trim(), rel:rel.value.trim(), phone:ph.value.trim(), email:em.value.trim(), idCheck:idc.value};
          if (!a.to.name || !a.to.rel) return 'Add their name and how they know '+r.nick;
          if (!a.to.phone && !a.to.email) return 'Add a phone or email';
          if (live(sid(), code).some(x => x.to.name.toLowerCase() === a.to.name.toLowerCase())) return a.to.name+' already has an active permission. End it first to change it.';
          return ''; })));
    }

    function scope(){
      const lv = k => h('button',{type:'button',class:'item','aria-pressed':String(a.level === k),style:a.level === k ? 'border:2px solid var(--sky)' : '',onclick:()=>{ a.level = k; draw(); }},
        h('b',null,(a.level === k ? '● ' : '○ ')+LEVEL[k]),
        h('span',{class:'small'}, k === 'summary' ? 'A short, warm update now and then: how they are doing, what they enjoyed, and upcoming appointment dates. No health details.' : 'Pick the topics. Good for a close family member who helps with care.'));
      const boxes = a.level === 'details' ? h('div',{class:'grid',style:'gap:.35rem'}, TOPICS.map(t => { const id = 'tp-'+t.id; const cb = h('input',{type:'checkbox',id,checked:a.topics.includes(t.id) || null});
        cb.addEventListener('change', () => { a.topics = cb.checked ? [...new Set([...a.topics, t.id])] : a.topics.filter(x => x !== t.id); });
        return h('label',{class:'row small',for:id}, cb, h('span',null, h('b',null,t.t), ' · '+t.d)); })) : null;
      const fq = h('select',null, Object.entries(FREQ).map(([k, l]) => h('option',{value:k,selected:+k === a.freq || null}, l)));
      const ra = h('input',{type:'checkbox',id:'ls-ra',checked:a.rightAway || null});
      const eo = h('input',{type:'checkbox',id:'ls-eo',checked:!!a.emailOk || null,disabled:!a.to.email || null});
      const nOn = h('input',{type:'checkbox',id:'ls-non',checked:a.nudge.on || null});
      const nEv = h('select',null, [[3,'Every 3 days'],[7,'Every week'],[10,'Every 10 days'],[14,'Every 2 weeks']].map(([k,l]) => h('option',{value:k,selected:k === a.nudge.every || null},l)));
      const best = h('input',{type:'text',value:a.nudge.best,placeholder:'e.g. Sunday afternoons, after lunch'});
      body.append(card('', h('h2',null,'3. What may '+(a.to.name||'they')+' see?'),
        h('div',{class:'grid g2'}, lv('summary'), lv('details')), boxes,
        h('label',{class:'row small',for:'ls-ra'}, ra, 'Call or message right away about a fall, an emergency room or hospital trip, or a serious illness'),
        field('How often to send a summary', fq),
        card('', h('h3',null,'✉️ Email'),
          h('p',{class:'small'}, a.to.email ? 'Emails to '+a.to.name+' only say there is a new update, with a link to sign in. No health details go in the email.' : 'No email given, so updates stay in the app.'),
          a.to.email ? h('label',{class:'row small',for:'ls-eo',style:'align-items:start'}, eo, h('span',null, h('b',null,'Also allow full updates by regular email. '), EMAIL_RISK.replace('The signer still wants','I still want'))) : null),
        card('soft', h('b',null,'Never shared with this form'), h('ul',{class:'small'}, NEVER.map(x => h('li',null,x))), h('p',{class:'small muted'},'These need their own consent form with extra steps.')),
        card('', h('h3',null,'💛 Check-in reminders for '+(a.to.name||'them')),
          h('p',{class:'small'},'A gentle nudge in their app when it has been a while since they called or visited.'),
          h('label',{class:'row small',for:'ls-non'}, nOn, 'Send check-in reminders'), field('How often', nEv), field('Best time to reach '+r.nick+' (shown to them)', best)),
        nav(() => { a.freq = +fq.value; a.rightAway = ra.checked; a.emailOk = eo.checked && a.to.email ? {text:EMAIL_RISK} : null; a.nudge = {on:nOn.checked, every:+nEv.value, best:best.value.trim()};
          if (a.level === 'summary') a.topics = SUMMARY.slice();
          if (!a.topics.length) return 'Pick at least one topic';
          if (a.rightAway && a.level === 'details' && !a.topics.some(t => ['health','falls'].includes(t))) a.topics.push('falls');
          return ''; })));
    }

    function length(){
      const ex = h('input',{type:'date',value:a.expires,min:A.addDays(today(),1)});
      const ev = h('input',{type:'text',value:a.expiresEvent});
      body.append(card('', h('h2',null,'4. How long does it last?'),
        h('p',{class:'small'},'Every permission needs an end date or an event. One year is common; the app reminds the manager 30 days before.'),
        h('div',{class:'row'}, [[90,'3 months'],[182,'6 months'],[365,'1 year']].map(([n, l]) => h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ ex.value = A.addDays(today(), n); }}, l))),
        field('Ends on', ex), field('Or ends sooner if', ev, 'Optional. For example: '+r.nick+' moves out of this home.'),
        nav(() => { a.expires = ex.value; a.expiresEvent = ev.value.trim(); if (!a.expires || a.expires <= today()) return 'Pick an end date after today'; return ''; })));
    }

    function statements(){
      const items = [
        ['revoke','You can end this permission at any time by telling the home in writing: a note, the form in the app, or an email to the manager. Ending it stops future sharing. It cannot take back what was already shared.'],
        ['noCondition','The home will not change '+r.nick+'\'s care, housing, payment or admission because of signing or not signing.'],
        ['redisclose','Once information is shared, '+(a.to.name||'the person')+' could share it with others, and federal privacy law may no longer protect it. Choose people you trust.']
      ];
      body.append(card('', h('h2',null,'5. Read these together'),
        h('p',{class:'small'},'Read each one out loud. Tick it when '+a.signer.name+' says they understand.'),
        items.map(([k, t]) => { const id = 'st-'+k, cb = h('input',{type:'checkbox',id,checked:a.statements[k] || null}); cb.addEventListener('change', () => { a.statements[k] = cb.checked; });
          return h('label',{class:'item',for:id,style:'grid-template-columns:auto 1fr;align-items:start'}, cb, h('span',null,t)); }),
        card('soft', h('h3',null,'The whole form'), h('pre',{class:'small',style:'white-space:pre-wrap;font:inherit;margin:0'}, formText(Object.assign({}, a, {signedAt:new Date().toISOString()})))),
        nav(() => Object.keys(Object.fromEntries(items)).every(k => a.statements[k]) ? '' : 'Tick each statement after reading it')));
    }

    function sign(){
      const method = h('select',null, [['drawn','Sign with a finger or stylus'],['mark','Sign with a mark (X), with a witness'],['typed','Type their name (when drawing is hard)']].map(([k,l]) => h('option',{value:k,selected:k === a.sig.method || null},l)));
      const pad = h('canvas',{width:640,height:200,style:'width:100%;max-width:640px;height:auto;aspect-ratio:16/5;border:2px dashed var(--line-strong);border-radius:14px;background:#fff;touch-action:none;cursor:crosshair','aria-label':'Signature pad. Draw the signature here.',role:'img'});
      const typed = h('input',{type:'text',value:a.signer.name,autocomplete:'off'});
      const wit2 = h('input',{type:'text',placeholder:'Second witness for a mark',autocomplete:'off'});
      const wit = h('input',{type:'text',value:a.witness,autocomplete:'off'});
      const ctx = pad.getContext('2d'); let drawing = false, inked = 0;
      ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#1F3A52';
      const pt = e => { const b = pad.getBoundingClientRect(); return [(e.clientX - b.left) * pad.width / b.width, (e.clientY - b.top) * pad.height / b.height]; };
      pad.addEventListener('pointerdown', e => { drawing = true; pad.setPointerCapture(e.pointerId); const [x,y] = pt(e); ctx.beginPath(); ctx.moveTo(x,y); });
      pad.addEventListener('pointermove', e => { if (!drawing) return; const [x,y] = pt(e); ctx.lineTo(x,y); ctx.stroke(); inked++; });
      ['pointerup','pointercancel','pointerleave'].forEach(t => pad.addEventListener(t, () => { drawing = false; }));
      const padWrap = h('div',{class:'grid',style:'gap:.4rem'}, pad, h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ ctx.clearRect(0,0,pad.width,pad.height); inked = 0; }},'Clear'), h('span',{class:'small muted'},'Sign above the line')));
      const markRow = field('Second witness (needed for a mark)', wit2);
      const sync = () => { padWrap.style.display = method.value === 'typed' ? 'none' : ''; markRow.style.display = method.value === 'mark' ? '' : 'none'; };
      method.addEventListener('change', sync);
      const btn = h('button',{class:'btn',type:'button'},'✍️ Sign and save');
      btn.addEventListener('click', async () => {
        if (method.value !== 'typed' && inked < 8) { toast('Please sign in the box'); return; }
        if (!typed.value.trim()) { toast('Type the signer\'s full name too'); return; }
        if (method.value === 'mark' && !wit2.value.trim()) { toast('A mark needs a second witness'); return; }
        if (!wit.value.trim()) { toast('Add the name of the staff witness'); return; }
        btn.disabled = true;
        a.sig = {method:method.value, typed:typed.value.trim(), img:method.value === 'typed' ? '' : pad.toDataURL('image/png'), witness2:wit2.value.trim()};
        a.witness = wit.value.trim(); a.signedAt = new Date().toISOString();
        a.device = (navigator.userAgent.match(/\(([^)]+)\)/)||['',''])[1].slice(0,60);
        a.hash = await sha(formText(a)+'|'+(a.sig.img||''));
        st().auths.push(a);
        if (from && status(from) === 'active'){ from.status = 'revoked'; from.revoked = {at:a.signedAt, by:a.signer.name, how:'Replaced by a newly signed permission', reason:'', staff:me()}; }
        log('signed', 'Permission signed by '+a.signer.name+' ('+CAP[a.signer.cap].short+') for '+a.to.name+': '+LEVEL[a.level].toLowerCase()+', until '+fmtDate(a.expires+'T12:00:00'), a);
        step++; draw();
      });
      body.append(card('', h('h2',null,'6. Sign'),
        h('p',null, a.signer.name+', as '+CAP[a.signer.cap].t.toLowerCase()+', gives permission for '+siteName(a.site)+' to share '+(a.level === 'summary' ? 'summary updates' : 'updates about '+a.topics.map(topicName).join(', ').toLowerCase())+' about '+r.nick+' with '+a.to.name+' until '+fmtDate(a.expires+'T12:00:00')+'.'),
        field('How are they signing?', method), padWrap, field('Signer\'s full name, typed', typed), markRow, field('Staff witness', wit),
        h('p',{class:'small muted'},'The date and time are added when you save. The app stores a fingerprint (SHA-256) of the signed form so any later change can be spotted.'),
        h('div',{class:'row'}, h('button',{class:'btn quiet',type:'button',onclick:()=>{ step--; draw(); }},'Back'), btn)));
      sync();
    }

    function give(){
      const how = h('select',null, ['Printed copy handed to the signer','Emailed a copy to the signer','Signer declined a copy'].map(x => h('option',{value:x},x)));
      const getSel = h('select',null, getOpts(a, a.to.email ? 'notice' : 'app'));
      const inv = h('div');
      const invite = () => { acct(a).code = inviteCode(); a.account.invitedAt = new Date().toISOString(); a.account.get = getSel.value; log('invite', 'Family account invite made for '+a.to.name+' (updates '+GET[getSel.value].toLowerCase()+')', a); save();
        inv.textContent = ''; inv.append(card('calm', h('b',null,'Invite code: '+a.account.code), h('p',{class:'small'},'Give this to '+a.to.name+'. They open the app, tap "I have a family code", and set a password. Their account only ever shows updates about '+r.nick+', within this permission.'),
          h('p',{class:'small muted'},'Test version: the code works only in this browser (View as "Approved family"). The live app emails the invite'+(a.to.email ? ' to '+a.to.email : '')+'.'))); };
      body.append(card('calm', h('h2',null,'✓ Signed and saved'),
        h('p',null, a.to.name+' is now approved to get '+LEVEL[a.level].toLowerCase()+' about '+r.nick+'. Staff will see them in "Who can I tell?" right away.'),
        card('', h('h3',null,'👪 Family account for '+a.to.name),
          h('p',{class:'small'},'A free, light account just for family: '+r.nick+'\'s basics, the updates they are allowed, and check-in reminders. Nothing else in the app.'),
          field('How should they get updates?', getSel, a.to.email ? (a.emailOk ? '' : 'Full updates by email were not allowed on the form, so emails are notices only.') : 'Add an email on step 2 to send email notices.'),
          h('div',{class:'row'}, h('button',{class:'btn ghost sm',type:'button',onclick:invite},'Make an invite')), inv),
        h('p',{class:'small'}, 'The law asks that the signer gets a copy. Print it or email it, then mark how it was given.'),
        h('div',{class:'row'}, h('a',{class:'btn ghost sm',href:'#/sharing/record/'+a.id},'Open and print the record')),
        field('How was the copy given?', how),
        h('div',{class:'row'}, h('button',{class:'btn',type:'button',onclick:()=>{ acct(a).get = getSel.value; a.copy = {how:how.value, at:new Date().toISOString()}; log('copy', 'Copy of the signed form: '+how.value, a); save(); toast('Saved'); location.hash = '#/sharing/list'; }},'Done'))));
    }
    draw();
  }

  // ---------- one signed record (printable, for proof) ----------
  function record(v, id){
    const a = st().auths.find(x => x.id === id);
    if (!a){ v.append(head('Family sharing','Record not found',''), h('a',{class:'btn',href:'#/sharing/list'},'Back')); return; }
    if (!isMgr()){ v.append(head('Family sharing','Managers only','Signed records are kept by the manager and owner.')); return; }
    log('printed', 'Opened the signed record for '+a.to.name, a);
    const s = STAT[status(a)], trail = st().log.filter(l => l.auth === a.id).slice().reverse();
    const sent = st().updates.filter(u => u.to.includes(a.id));
    const text = formText(a);
    const full = [text, '', 'Record fingerprint (SHA-256): '+a.hash, 'Status: '+s[0]+(a.revoked ? ' on '+fmtTime(a.revoked.at)+' by '+a.revoked.by+' ('+a.revoked.how+')' : ''), 'Copy given: '+(a.copy.how||'not recorded')+(a.copy.at ? ', '+fmtTime(a.copy.at) : ''), '', 'Access and change log:'].concat(trail.map(l => '- '+fmtTime(l.at)+' · '+l.who+' · '+l.text), ['', 'Updates sent under this permission:'], sent.map(u => '- '+fmtTime(u.at)+' · '+u.topics.map(topicName).join(', ')+(u.reads[a.id] ? ' · opened '+fmtTime(u.reads[a.id]) : ''))).join('\n');
    v.append(head('Signed record · '+resOf(a.site,a.res).nick, 'Permission for '+a.to.name, 'Print this or download it if anyone asks who had access and why.'));
    v.append(h('div',{class:'row noprint'}, h('a',{class:'btn quiet sm',href:'#/sharing/list'},'← Back'),
      h('button',{class:'btn sm',type:'button',onclick:()=>{ log('printed','Printed the signed record', a); window.print(); }},'Print'),
      h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ A.download ? A.download('permission-'+a.res+'-'+a.id+'.txt', 'text/plain', full) : copy(full); log('printed','Downloaded the signed record', a); }},'Download as text')));
    v.append(card('', h('div',{class:'meta row'}, chip(s[0], s[1]), chip(LEVEL[a.level],'grey')),
      h('pre',{style:'white-space:pre-wrap;font:inherit;margin:0'}, text),
      a.sig.img ? h('div',null, h('span',{class:'small muted'},'Signature'), h('img',{src:a.sig.img,alt:'Signature of '+a.signer.name,style:'display:block;max-width:320px;width:100%;border-bottom:1px solid var(--ink);background:#fff'})) : null,
      a.sig.witness2 ? h('p',{class:'small'},'Second witness for the mark: '+a.sig.witness2) : null,
      h('p',{class:'small',style:'overflow-wrap:anywhere'}, h('b',null,'Fingerprint (SHA-256): '), a.hash),
      h('p',{class:'small'}, h('b',null,'Copy given: '), (a.copy.how||'not recorded')+(a.copy.at ? ', '+fmtTime(a.copy.at) : '')),
      a.revoked ? h('p',{class:'small'}, h('b',null,'Ended: '), fmtTime(a.revoked.at)+' by '+a.revoked.by+'. '+a.revoked.how+(a.revoked.reason ? '. Reason: '+a.revoked.reason : '')+'. Recorded by '+(a.revoked.staff||'staff')+'.') : null));
    v.append(card('', h('h3',null,'Access and change log'), h('ul',{class:'small'}, trail.map(l => h('li',null, fmtTime(l.at)+' · '+l.who+' · '+l.text)))));
    v.append(card('', h('h3',null,'Updates sent under this permission'), sent.length ? h('ul',{class:'small'}, sent.map(u => h('li',null, fmtTime(u.at)+' · '+u.topics.map(topicName).join(', ')+(u.reads[a.id] ? ' · opened '+fmtTime(u.reads[a.id]) : ' · not opened yet')))) : h('p',{class:'small muted'},'None yet.')));
    v.append(h('p',{class:'foot'},'Test record with sample people. Keep signed permissions at least 6 years from the date signed or last in effect (45 CFR 164.530(j)), and as long as the resident record (7 years after discharge in Wisconsin, DHS 88.09 and DHS 83.42), whichever is longer.'));
  }

  // ---------- Send an update (managers) ----------
  function send(v){
    const res = D.RESIDENTS[sid()] || [];
    const withPerm = res.filter(r => live(sid(), r.code).length);
    if (!withPerm.length){ v.append(card('', h('p',null,'No one at this home has signed permission yet.'), h('a',{class:'btn sm',href:'#/sharing/list'},'Start one'))); return; }
    const rs = h('select',null, withPerm.map(r => h('option',{value:r.code}, r.nick+' ('+r.code+')')));
    const kind = h('select',null, [['summary','Summary (how they are doing)'],['detail','Specific details'],['right-away','Right away: fall, ER or hospital, serious illness']].map(([k,l]) => h('option',{value:k},l)));
    const tp = h('div',{class:'grid',style:'gap:.3rem'});
    const txt = h('textarea',{style:'min-height:8rem'});
    const who = h('div',{class:'grid',style:'gap:.35rem'});
    const warn = h('div');
    let topics = [];
    const sendBtn = h('button',{class:'btn',type:'button'},'💌 Send');
    function drawTopics(){
      tp.textContent = '';
      const ids = kind.value === 'summary' ? SUMMARY : kind.value === 'right-away' ? ['falls','health'] : TOPICS.map(t => t.id);
      topics = topics.filter(t => ids.includes(t)); if (!topics.length) topics = kind.value === 'right-away' ? ['falls'] : ids.slice(0, kind.value === 'summary' ? 3 : 1);
      ids.forEach(id => { const cid = 'snd-'+id, cb = h('input',{type:'checkbox',id:cid,checked:topics.includes(id) || null});
        cb.addEventListener('change', () => { topics = cb.checked ? [...new Set([...topics, id])] : topics.filter(x => x !== id); recips(); });
        tp.append(h('label',{class:'row small',for:cid}, cb, topicName(id))); });
    }
    function draft(){
      const code = rs.value, r = resOf(sid(), code), since = A.addDays(today(), -7), bits = [];
      try { if (window.SSNotes){ const ns = SSNotes.notesFor(sid(), code).filter(n => n.at.slice(0,10) >= since && n.signed);
        ns.slice(0, 3).forEach(n => { const t = (n.use === 'raw' ? n.raw : n.pro || n.raw || n.data || '').split(/(?<=\.)\s/)[0]; if (t) bits.push(t.replace(/\bThe resident\b/g, r.nick).replace(/\bthe resident\b/g, r.nick)); }); } } catch(e){}
      let ap = []; try { ap = (window.SS_ordersFor ? SS_ordersFor(sid(), code) : []).filter(o => o.kind === 'appointment' && o.start >= today()).map(o => fmtDate(o.start+'T12:00:00')+': '+o.text.replace(/\s*\(sample\)\.?/,'').replace(/\.$/,'')); } catch(e){}
      if (kind.value === 'right-away') return 'We want to let you know that '+r.nick+' [what happened, in plain words] today at [time]. [What the home did, and how they are now.] The nurse [was told / will check]. We will call again if anything changes. Please call the home with any questions.';
      const lines = ['Hello from '+siteName(sid())+'. Here is how '+r.nick+' has been this week.'];
      if (bits.length) lines.push(bits.join(' ')); else lines.push(r.nick+' has had a calm week. [Add a moment they enjoyed.]');
      if (topics.includes('appts') && ap.length) lines.push('Coming up: '+ap.join('; ')+'.');
      lines.push('Thank you for staying close.');
      return lines.join('\n\n');
    }
    function recips(){
      who.textContent = ''; warn.textContent = '';
      const on = live(sid(), rs.value);
      const ok = on.filter(a => allows(a, topics) && (kind.value !== 'right-away' || a.rightAway));
      on.forEach(a => { const yes = ok.includes(a);
        who.append(h('div',{class:'row small'}, chip(yes ? 'Will get it' : 'Left out', yes ? 'calm' : 'grey'), h('b',null,a.to.name+' ('+a.to.rel+')'),
          yes ? h('span',{class:'muted'}, (GET[acct(a).get]||GET.app).toLowerCase()) : h('span',{class:'muted'}, kind.value === 'right-away' && !a.rightAway ? 'did not ask for right-away calls' : 'permission covers '+(a.level === 'summary' ? SUMMARY : a.topics).map(topicName).join(', ').toLowerCase()))); });
      const bad = txt.value.match(NEVER_WORDS);
      if (bad) warn.append(card('alert', h('b',null,'Take out "'+bad[0]+'" before sending.'), h('p',{class:'small'},'Mental health treatment, alcohol or drug treatment, HIV results and ID numbers are never shared through family updates.')));
      sendBtn.disabled = !ok.length || !!bad || !txt.value.trim() || !topics.length;
      return ok;
    }
    rs.addEventListener('change', () => { txt.value = draft(); recips(); });
    kind.addEventListener('change', () => { drawTopics(); txt.value = draft(); recips(); });
    txt.addEventListener('input', recips);
    sendBtn.addEventListener('click', () => {
      const ok = recips(); if (!ok.length) return;
      const r = resOf(sid(), rs.value);
      const u = {id:'up-'+uid(), site:sid(), res:rs.value, at:new Date().toISOString(), by:me(), kind:kind.value === 'summary' ? 'summary' : kind.value === 'right-away' ? 'right-away' : 'detail', topics:topics.slice(), text:txt.value.trim(), to:ok.map(a => a.id), reads:{}};
      st().updates.push(u);
      const how = a => !a.to.email || acct(a).get === 'app' ? 'app' : acct(a).get === 'full' && a.emailOk ? 'full' : 'notice';
      u.email = {}; ok.forEach(a => { if (how(a) !== 'app') u.email[a.id] = how(a); });
      ok.forEach(a => log('sent', 'Sent a '+(u.kind === 'right-away' ? 'right-away message' : u.kind)+' about '+r.nick+' to '+a.to.name+' ('+topics.map(topicName).join(', ')+'), '+{app:'in the app', notice:'in the app, with an email notice (no details)', full:'in the app and in full by email (signer allowed email)'}[how(a)], a));
      toast('Sent to '+ok.map(a => a.to.name).join(', ')+(Object.keys(u.email).length ? '. Emails: '+Object.keys(u.email).length+' (test: not really sent)' : '')); A.route();
    });
    v.append(card('', h('h2',null,'Write an update'),
      h('div',{class:'grid g2'}, field('About', rs), field('Kind', kind)),
      h('div',null, h('span',{class:'small muted'},'Topics in this update'), tp),
      field('Message (edit before sending; warm and plain)', txt, 'Drafted from this week\'s signed progress notes. Read it over: only what you would say to them in person.'),
      card('soft', h('h3',null,'Who gets it'), who, h('p',{class:'small muted'},'The app only sends to people whose signed permission covers every topic in this update.')),
      warn, h('div',{class:'row'}, sendBtn)));
    drawTopics(); txt.value = draft(); recips();
    const sent = st().updates.filter(u => u.site === sid()).slice().reverse().slice(0, 8);
    if (sent.length) v.append(card('', h('h3',null,'Recently sent'), h('div',{class:'list'}, sent.map(u => h('div',{class:'item'},
      h('div',{class:'meta'}, chip(resOf(u.site,u.res).nick), chip(u.kind === 'right-away' ? 'Right away' : u.kind === 'summary' ? 'Summary' : 'Details', u.kind === 'right-away' ? 'amber' : 'grey'), h('span',{class:'small muted'}, fmtTime(u.at)+' · '+u.by)),
      h('span',{class:'small'}, u.text.length > 180 ? u.text.slice(0, 180)+'…' : u.text),
      h('span',{class:'small muted'}, 'To: '+u.to.map(id => { const a = st().auths.find(x => x.id === id); return a ? a.to.name+(u.reads[id] ? ' (opened)' : '') : ''; }).filter(Boolean).join(', ')))))));
  }

  // ---------- Notes from family (to read to the resident) ----------
  function famNotes(v){
    const ns = st().notes.filter(n => n.site === sid()).slice().reverse();
    v.append(card('', h('h2',null,'Notes and questions from family'),
      h('p',{class:'small'},'Approved family can send a short note for staff to read to their loved one, or ask the home a question. Tick it when done.'),
      ns.length ? h('div',{class:'list'}, ns.map(n => { const a = st().auths.find(x => x.id === n.auth) || {to:{name:'Family'}};
        return h('div',{class:'item'}, h('div',{class:'meta'}, chip(resOf(n.site,n.res).nick), chip(n.kind === 'question' ? 'Question for the home' : 'Read to '+resOf(n.site,n.res).nick, n.kind === 'question' ? 'amber' : 'calm'), h('span',{class:'small muted'}, fmtTime(n.at)+' · from '+a.to.name)),
          h('span',null, n.text),
          n.status === 'done' ? h('span',{class:'small muted'}, '✓ '+(n.kind === 'question' ? 'Answered' : 'Read to them')+' by '+n.doneBy+', '+fmtTime(n.doneAt)+(n.reply ? ': '+n.reply : '')) :
            h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{
              let reply = ''; if (n.kind === 'question'){ if (!isMgr()){ toast('The manager answers questions'); return; } reply = prompt('Your answer (only what their permission covers):') || ''; if (!reply.trim()) return;
                const bad = reply.match(NEVER_WORDS); if (bad){ toast('Take out "'+bad[0]+'"'); return; } }
              n.status = 'done'; n.doneBy = me(); n.doneAt = new Date().toISOString(); n.reply = reply.trim();
              log(n.kind === 'question' ? 'sent' : 'note', n.kind === 'question' ? 'Answered a question from '+a.to.name : 'Read a family note to '+resOf(n.site,n.res).nick, a); A.route(); }}, n.kind === 'question' ? 'Answer' : '✓ Read it to them'))); })) : h('p',{class:'small muted'},'Nothing yet.')));
  }

  // ---------- Access log ----------
  function logTab(v){
    const sh = st(), rows = sh.log.filter(l => l.site === sid());
    const KIND = {signed:'Signed', copy:'Copy given', revoked:'Ended', expired:'Expired', sent:'Sent', viewed:'Opened by family', lookup:'Staff checked', printed:'Record opened', note:'Family note', checkin:'Check-in', invite:'Account invite', account:'Family account'};
    const text = ['Family sharing access log: '+siteName(sid())+' ('+fmtDate(new Date())+')'].concat(rows.map(l => fmtTime(l.at)+' | '+(KIND[l.kind]||l.kind)+' | '+l.who+' | '+l.text)).join('\n');
    v.append(card('', h('h2',null,'Every signature, change, update and view'),
      h('p',{class:'small'},'Nothing here can be edited or deleted. Each signed record also shows its own part of this log.'),
      h('div',{class:'row noprint'}, h('button',{class:'btn quiet sm',type:'button',onclick:e => copy(text, e.target)},'Copy'), h('button',{class:'btn quiet sm',type:'button',onclick:()=>window.print()},'Print')),
      h('div',{class:'tablewrap'}, h('table',null, h('thead',null, h('tr',null, ['When','What','Who','Details'].map(c => h('th',{scope:'col'},c)))),
        h('tbody',null, rows.slice(0, 200).map(l => h('tr',null, h('td',{class:'small'},fmtTime(l.at)), h('td',null,chip(KIND[l.kind]||l.kind,'grey')), h('td',{class:'small'},l.who), h('td',{class:'small'},l.text))))))));
  }

  // ---------- Proof and protection ----------
  function proof(v){
    v.append(card('warn', h('b',null,'Draft for review.'), h('p',{class:'small'},'This page explains how the records protect the home. Have a Wisconsin health law attorney review the form wording and this page before using it with real residents. It is not legal advice.')));
    v.append(card('', h('h2',null,'If someone is upset about who saw what'),
      h('p',null,'Stay calm and kind. Then open the signed record and show three things:'),
      h('ol',{class:'steps'}, [
        'Who gave permission, in what legal role, and what papers the home saw (resident, guardian with court letters, or activated health care POA).',
        'Exactly what they allowed: the person, the topics, and the dates. The app would not send anything outside that.',
        'The log: every update sent, when, and when it was opened, plus when the permission ended if it did.'
      ].map(s => h('li',null,h('span',null,s)))),
      h('p',{class:'small'},'Print or download the record from Permissions → Open the signed record. It includes the full form, the signature, a fingerprint that shows the form was not changed after signing, and the log.')));
    v.append(card('', h('h2',null,'Why a signed permission protects the home'),
      h('ul',null,
        h('li',null, h('b',null,'Federal law: '), 'HIPAA lets a home share health information with anyone the resident (or their personal representative) names in a valid written authorization (45 CFR 164.508). The form has every required part: what is shared, who shares, who gets it, why, an end date, the signature and date, the signer\'s authority, and the three required statements. The signer gets a copy.'),
        h('li',null, h('b',null,'Personal representatives: '), 'A guardian, or a health care agent whose POA is activated, stands in the resident\'s shoes for health information (45 CFR 164.502(g)). The app checks the face sheet so the right person signs, and records the papers staff saw.'),
        h('li',null, h('b',null,'Wisconsin law: '), 'Health records may be released with informed consent (Wis. Stat. 146.82), which needs the resident\'s name, the type of information, who discloses it, the purpose, who gets it, the signature (and the signer\'s authority), the date, and how long it lasts (146.81(2)). The form covers each one.'),
        h('li',null, h('b',null,'Resident rights: '), 'Residents keep the right to privacy and confidential records in adult family homes and CBRFs (DHS 88.10, DHS 83.32, Wis. Stat. 50.09). The resident\'s own wishes are asked and written down even when a guardian signs.'),
        h('li',null, h('b',null,'Electronic signatures: '), 'Wisconsin\'s electronic transactions law gives an electronic signature the same effect as ink (Wis. Stat. 137.15), and HHS allows electronic HIPAA authorizations. The app keeps the drawn signature, typed name, date and time, the staff witness, and a fingerprint of the signed form.'))));
    v.append(card('', h('h2',null,'What the home still has to do'),
      h('ul',{class:'small'},
        h('li',null,'Share only what the permission covers, and only what is needed.'),
        h('li',null,'Check it is really the approved person before sharing on the phone.'),
        h('li',null,'Stop right away when a permission is ended or expires. The app does this automatically.'),
        h('li',null,'Keep health details out of email unless the signer allowed full updates by email after being told email is not secure. By default, emails only say there is a new update.'),
        h('li',null,'Keep signed permissions at least 6 years (45 CFR 164.530(j)) and as long as the resident record.'),
        h('li',null,'Use separate consent forms for mental health treatment (Wis. Stat. 51.30), alcohol or drug treatment (42 CFR Part 2) and HIV test results (252.15).'),
        h('li',null,'Before real residents: HIPAA program, business associate agreements, and real sign-in accounts for family (see the HIPAA plan).'))));
    v.append(card('soft', h('h3',null,'Plain words for an upset family member'),
      h('p',{class:'small'},'"I understand this is upsetting. '+'Here is the permission '+'[name] signed on [date], as [role]. It lets us share [topics] with [person] until [date]. Here is everything we sent and when. If you would like to change or end it, '+'the person who signed can do that today."'),
      h('p',{class:'small muted'},'If the person asking is not the signer, do not share the form\'s details with them. Offer to have the signer or the manager call them.')));
  }

  // =====================================================================
  // APPROVED FAMILY: Your loved one
  // =====================================================================
  function kinAuth(){
    const sh = st(), mine = sh.auths.filter(a => a.status !== 'draft');
    return mine.find(a => a.id === sh.kinAs) || mine.find(a => status(a) === 'active') || mine[0];
  }
  R.loved = v => {
    const sh = st();
    const a = kinAuth();
    if (!a){ v.append(head('Your loved one','No updates yet','When your loved one or their guardian signs a permission at the home, their updates show here.')); return; }
    const r = resOf(a.site, a.res), s = status(a);
    // test switcher: which approved person am I?
    const people = sh.auths.slice().sort((x, y) => (status(x) === 'active' ? 0 : 1) - (status(y) === 'active' ? 0 : 1));
    const pick = h('select',{'aria-label':'Test: view as which approved person'}, people.map(x => h('option',{value:x.id,selected:x.id === a.id || null}, x.to.name+' → '+resOf(x.site,x.res).nick+' ('+STAT[status(x)][0].toLowerCase()+')')));
    pick.addEventListener('change', () => { sh.kinAs = pick.value; save(); A.route(); });
    v.append(h('div',{class:'row small noprint',style:'margin-bottom:.4rem'}, h('span',{class:'muted'},'Test: viewing as'), pick));
    v.append(head('Hi '+a.to.name.replace(/\s*\(sample\)/,''), 'Updates about '+r.nick, s === 'active' ? siteName(a.site)+' shares these with you because '+(a.signer.cap === 'self' ? r.nick : r.nick+'\'s '+CAP[a.signer.cap].short.toLowerCase())+' said yes.' : siteName(a.site)));
    if (s === 'active' && !acct(a).joinedAt){ a.account.joinedAt = new Date().toISOString(); log('account', a.to.name+' joined with their family account', a); }
    if (s !== 'active'){
      v.append(card('soft', h('h2',null, s === 'revoked' ? 'Updates have stopped' : 'Your permission has ended'),
        h('p',null, s === 'revoked' ? 'The person who signed has chosen to stop sharing updates for now. This is their right, and it is not a judgment about you.' : 'The signed permission reached its end date on '+fmtDate(a.expires+'T12:00:00')+'.'),
        h('p',null,'You can still call or visit '+r.nick+' as usual. If you would like updates again, ask '+(a.signer.cap === 'self' ? r.nick : 'their '+CAP[a.signer.cap].short.toLowerCase())+' or call the home.')));
      log('viewed', a.to.name+' opened the app after access ended (nothing shown)', a);
      return;
    }
    // check-in nudge
    const mine = sh.checkins.filter(c => c.auth === a.id).sort((x, y) => x.at < y.at ? 1 : -1);
    const last = mine[0], since = last ? daysBetween(last.at, new Date()) : null;
    if (a.nudge.on && (since == null || since >= a.nudge.every)){
      v.append(card('warn', h('h2',null,'💛 Time to check in with '+r.nick+'?'),
        h('p',null, since == null ? 'A call or a visit means a lot.' : 'It has been '+plural(since,'day')+' since your last '+(last.kind === 'visit' ? 'visit' : 'call')+'.'+(a.nudge.best ? ' A good time: '+a.nudge.best+'.' : '')),
        checkinRow(a)));
    }
    // the basics, always shown
    const b = basics(a);
    v.append(card('soft', h('h2',null,'💛 '+b.name+' at '+b.home),
      h('ul',{class:'small',style:'margin:0'},
        h('li',null, h('b',null,'Home phone: '), h('a',{href:'tel:715-555-0100'}, b.phone), ' · ask for '+b.manager),
        h('li',null, h('b',null,'Visiting: '), b.visiting),
        b.best ? h('li',null, h('b',null,'Best time to reach '+b.name+': '), b.best) : null,
        b.appts.length ? h('li',null, h('b',null,'Coming up: '), b.appts.join('; ')) : null)));
    // updates feed
    const ups = sh.updates.filter(u => u.to.includes(a.id)).sort((x, y) => x.at < y.at ? 1 : -1);
    const feed = card('', h('h2',null,'Updates'));
    if (!ups.length) feed.append(h('p',{class:'muted'},'No updates yet. The home sends a summary '+FREQ[a.freq].toLowerCase()+'.'));
    ups.forEach(u => {
      if (!u.reads[a.id]){ u.reads[a.id] = new Date().toISOString(); log('viewed', a.to.name+' opened the '+fmtDate(u.at)+' update about '+r.nick, a); }
      feed.append(h('div',{class:'item'+(u.kind === 'right-away' ? ' warn' : '')}, h('div',{class:'meta'}, chip(u.kind === 'right-away' ? 'Right away' : u.kind === 'summary' ? 'Summary' : 'Update', u.kind === 'right-away' ? 'amber' : 'calm'), h('span',{class:'small muted'}, fmtTime(u.at)+' · from '+u.by)),
        h('p',{style:'white-space:pre-wrap;margin:0'}, u.text)));
    });
    save();
    v.append(feed);
    // actions
    const note = h('textarea',{style:'min-height:4rem',placeholder:'Tell Mom the grandkids say hi…'});
    const kind = h('select',null, h('option',{value:'note'},'A note to read to '+r.nick), h('option',{value:'question'},'A question for the home'));
    v.append(card('', h('h2',null,'Stay close'),
      h('div',{class:'row'}, checkinRow(a)),
      field('Send something', kind), field('Your words', note),
      h('div',{class:'row'}, h('button',{class:'btn',type:'button',onclick:()=>{ const t = note.value.trim(); if (!t){ toast('Write a few words first'); return; }
        sh.notes.push({id:uid(), auth:a.id, site:a.site, res:a.res, at:new Date().toISOString(), kind:kind.value, text:t, status:'new'});
        log('note', a.to.name+' sent '+(kind.value === 'question' ? 'a question to the home' : 'a note for '+r.nick), a); toast(kind.value === 'question' ? 'Sent. The manager will answer.' : 'Sent. Staff will read it to '+r.nick+'.'); A.route(); }},'Send'))));
    const myNotes = sh.notes.filter(n => n.auth === a.id).slice().reverse().slice(0, 5);
    if (myNotes.length) v.append(card('', h('h3',null,'What you sent'), h('ul',{class:'small'}, myNotes.map(n => h('li',null, fmtDate(n.at)+': '+n.text+' · ', n.status === 'done' ? h('b',null, n.kind === 'question' ? 'Answered: '+(n.reply||'') : 'Read to '+r.nick+' ✓') : h('span',{class:'muted'},'Waiting'))))));
    // how updates reach me
    const gs = h('select',null, getOpts(a, acct(a).get));
    gs.addEventListener('change', () => { acct(a).get = gs.value; log('account', a.to.name+' chose: '+GET[gs.value].toLowerCase(), a); toast('Saved'); });
    v.append(card('', h('h3',null,'How you get updates'), field('Send me updates', gs, !a.to.email ? 'To get email notices, ask the home to add your email address.' : a.emailOk ? 'Full updates by email were allowed by the person who signed. Email is not secure, so the app and email notices are the safer choice.' : 'Emails go to '+a.to.email+' and only say there is a new update, with a link to sign in. Health details stay in the app.')));
    // what you can see
    const sh2 = a.level === 'summary' ? SUMMARY : a.topics;
    v.append(card('soft', h('h2',null,'What you can see'),
      h('p',{class:'small'}, LEVEL[a.level]+': '+sh2.map(topicName).join(', ').toLowerCase()+'.'+(a.rightAway ? ' The home calls you right away about a fall, a hospital trip or a serious illness.' : '')),
      h('p',{class:'small'}, 'Signed by '+a.signer.name+(a.signer.cap === 'self' ? '' : ' ('+CAP[a.signer.cap].short+')')+' on '+fmtDate(a.signedAt)+'. Ends '+fmtDate(a.expires+'T12:00:00')+'.'),
      h('p',{class:'small muted'},'Please keep these updates private. If you share them, privacy laws may no longer protect them. Only the person who signed can change what you see.')));
  };
  function checkinRow(a){
    const r = resOf(a.site, a.res), sh = st();
    const mark = kind => { sh.checkins.push({id:uid(), auth:a.id, at:new Date().toISOString(), kind, text:''}); log('checkin', a.to.name+' '+(kind === 'visit' ? 'visited' : 'called')+' '+r.nick, a); toast('Thank you. '+r.nick+' is lucky to have you.'); A.route(); };
    return h('div',{class:'row'},
      h('a',{class:'btn ghost sm',href:'tel:715-555-0100',onclick:()=>{ setTimeout(() => mark('call'), 300); }},'📞 Call the home'),
      h('button',{class:'btn quiet sm',type:'button',onclick:()=>mark('call')},'I called'),
      h('button',{class:'btn quiet sm',type:'button',onclick:()=>mark('visit')},'I visited'));
  }

  // =====================================================================
  // REGISTER
  // =====================================================================
  VIEWS.sharing = {t:'Family sharing', ic:'💌'};
  VIEWS.loved = {t:'Your loved one', ic:'💛'};
  const addNav = (t, id, after) => { const n = NAV[t]; if (!n || n.includes(id)) return; const at = after && n.indexOf(after) >= 0 ? n.indexOf(after)+1 : n.length; n.splice(at, 0, id); };
  addNav('caregiver','sharing','night'); addNav('manager','sharing','inbox'); addNav('rn','sharing','orders');
  addNav('owner','sharing','owner'); addNav('multi','sharing','owner'); addNav('kin','loved');
  if (window.SSAccess && SSAccess.register) try {
    SSAccess.register({id:'sharing', name:'Family sharing', ic:'💌', what:'Signed permissions for family to get updates, a "Who can I tell?" list for staff, updates and check-in reminders for approved family, and a full access log.', views:['sharing','loved'], tiers:['caregiver','manager','rn','owner','multi','kin']});
  } catch(e){}
  const on = () => { try { return !window.SSAccess || SSAccess.viewOn('sharing'); } catch(e){ return true; } };

  A.homeHooks = A.homeHooks || [];
  A.homeHooks.push((v, t) => {
    if (S().site === 'family' || !on() || !['manager','owner','caregiver'].includes(t)) return;
    const sh = st(), site = sid();
    if (t === 'caregiver'){
      const waiting = sh.notes.filter(n => n.site === site && n.status !== 'done' && n.kind === 'note').length;
      if (waiting) v.append(h('div',{class:'grid g2'}, A.tile('sharing/notes','💌', plural(waiting,'family note')+' to read to a resident', 'Short notes from approved family.', 'urgent')));
      return;
    }
    const ending = sh.auths.filter(a => a.site === site && soon(a)).length;
    const qs = sh.notes.filter(n => n.site === site && n.status !== 'done').length;
    const due = (D.RESIDENTS[site]||[]).filter(r => live(site, r.code).some(a => { const last = sh.updates.filter(u => u.to.includes(a.id)).map(u => u.at).sort().pop(); return !last || daysBetween(last, new Date()) >= a.freq; })).length;
    v.append(h('div',{class:'grid g2'}, A.tile('sharing/send','💌', due ? plural(due,'family update')+' due' : 'Family sharing', (qs ? plural(qs,'note or question')+' from family. ' : '')+(ending ? plural(ending,'permission')+' ending soon.' : 'Signed permissions, updates and the access log.'), due || qs ? 'urgent' : '')));
  });

  // the Night help "Family member calls at night" card points here
  try { const fm = D.TRIAGE.find(x => x.id === 'family'); if (fm) fm.steps = ['Be kind and brief.','Open Family sharing → "Who can I tell?" and share only what their signed permission allows.','Take a message for the manager.']; } catch(e){}

  window.SSShare = {live, allows, status, decider, formText};
})();
