// Owner Desk: sign-in and saved data through Supabase.
// Privacy comes from the database rules in setup.sql, not from this file.
(function(){
  const $=id=>document.getElementById(id);
  function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}

  // ---------- tabs ----------
  const tabs=[...document.querySelectorAll('[role=tab]')];
  function show(id){
    tabs.forEach(t=>{const on=t.getAttribute('aria-controls')===id;t.setAttribute('aria-selected',on);$(t.getAttribute('aria-controls')).hidden=!on;});
    try{localStorage.setItem('desk-tab',id)}catch(e){}
  }
  const ids=tabs.map(t=>t.getAttribute('aria-controls'));
  tabs.forEach(t=>t.addEventListener('click',()=>{const id=t.getAttribute('aria-controls');show(id);if(history.replaceState)history.replaceState(null,'','#'+id);}));
  let start=(location.hash||'').slice(1);
  if(!ids.includes(start)){try{start=localStorage.getItem('desk-tab')}catch(e){start=null}}
  show(ids.includes(start)?start:'summary');

  // ---------- marketing copy (static) ----------
  const COPY=[
    {t:'One-line pitch',b:'A shift-time helper for Wisconsin adult family homes and CBRFs: the right procedure, calm professional reports, and managers who get to sleep.'},
    {t:'Short pitch (30 seconds)',b:'I spent years as an adult family home manager and CNA. Most citations and staff fights I saw started with small moments: a 2 AM question nobody could answer, a shift note that sounded like an accusation, a binder that was out of date. Steady Shift gives caregivers the answer from your own procedures and DHS 88 or 83, turns their quick notes into professional reports, and only wakes the manager when it really matters.'},
    {t:'Outreach email',b:'Subject: Fewer 2 AM calls for your home\n\nHi [name],\n\nI\'m a former adult family home manager and CNA, and I\'m building a tool for homes like yours. It helps caregivers check procedures against DHS 88 and 83, write incident reports that stay factual and calm, and sort overnight questions so the manager only gets woken for real emergencies.\n\nI\'m looking for a few Wisconsin homes to try it first and help shape it. Would you have 15 minutes to see it?\n\nThank you,\n[your name]'},
    {t:'Social post',b:'Caregiving comes first. Paperwork follows.\n\nI\'m building a tool for Wisconsin adult family homes and CBRFs that helps staff find the right procedure, document without blame, and lets managers sleep through the night.\n\nLooking for a few pilot homes. Message me if you\'d like a look.\n\nhttps://blessedfig.github.io/steady-shift/'},
    {t:'What we never say',b:'Don\'t name or criticize any care management organization, county or competitor.\nDon\'t promise "HIPAA certified" (there is no such certificate).\nDon\'t claim customers or results we don\'t have yet.\nDon\'t say the app replaces a nurse, a manager or 911.'}
  ];
  const cb=$('copyBlocks');
  COPY.forEach(c=>{
    const d=el('div','copyblock');const bar=el('div','bar');
    const btn=el('button','btn ghost','Copy');btn.type='button';
    const pre=el('pre',null,c.b);
    btn.addEventListener('click',()=>{
      const done=()=>{btn.textContent='Copied';setTimeout(()=>btn.textContent='Copy',1500)};
      try{navigator.clipboard.writeText(c.b).then(done,()=>selectText(pre))}catch(e){selectText(pre)}
    });
    bar.append(el('h3',null,c.t),btn);d.append(bar,pre);cb.append(d);
  });
  function selectText(n){const r=document.createRange();r.selectNodeContents(n);const s=getSelection();s.removeAllRanges();s.addRange(r);}

  // ---------- screens ----------
  const gate=$('gate'),whoEl=$('who');
  function setGate(msg){gate.textContent=msg||'';gate.hidden=!msg}
  function signinMsg(msg,near){const m=$('signinMsg');m.textContent=msg||'';m.hidden=!msg;if(msg&&near&&window.SSPw)SSPw.showNear(m,near)}
  const busy=(b,on,text)=>{b.disabled=on;b.textContent=text;b.classList.toggle('sspw-busy',on);b.setAttribute('aria-busy',String(on))};
  function screen(which){$('signin').hidden=which!=='signin';$('app').hidden=which!=='app';$('signOut').hidden=which!=='app';$('pwChange').hidden=which!=='app';}

  const cfg=window.DESK_CONFIG||{};
  if(!cfg.supabaseUrl||!cfg.supabaseKey||!window.supabase){
    whoEl.textContent='Not set up yet';
    screen('signin');$('emailForm').hidden=true;
    signinMsg('The desk is not connected to its database yet. Christian finishes this in a few steps (see desk/README.md).');
    return;
  }
  const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{flowType:'implicit',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

  let pendingEmail='';
  try{pendingEmail=localStorage.getItem('desk-email')||''}catch(e){}
  if(pendingEmail)$('email').value=pendingEmail;

  let how='';
  const typo=window.SSPw?SSPw.watchEmail($('email')):()=>'';
  const typoStop=near=>{const sug=typo();if(sug){signinMsg('Check your email address. Did you mean '+sug+'? Tap "Fix it" under the email box.',near);$('email').focus();return true}return false};
  $('emailForm').addEventListener('submit',async e=>{
    e.preventDefault();signinMsg('');
    const email=$('email').value.trim().toLowerCase(),pw=$('password').value;if(!email||!pw)return;
    if(typoStop($('pwBtn')))return;
    const b=$('pwBtn');busy(b,true,'Signing in…');
    try{localStorage.setItem('desk-email',email)}catch(err){}
    how='password';
    const msg=window.SSPw?await SSPw.signIn(sb,email,pw):'Password sign-in is not available right now. Use the email code instead.';
    busy(b,false,'Sign in');
    if(msg){how='';signinMsg(msg,b);$('password').value='';}
  });
  $('sendBtn').addEventListener('click',async()=>{
    signinMsg('');
    const email=$('email').value.trim().toLowerCase();
    if(!email||!$('email').checkValidity()){signinMsg('Type your email above first.',$('sendBtn'));$('email').focus();return}
    if(typoStop($('sendBtn')))return;
    const b=$('sendBtn');busy(b,true,'Sending…');
    const {error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname}});
    busy(b,false,'Email me a sign-in code');
    if(error){
      const m=String(error.message||'');
      if(/signups? not allowed|not found|otp_disabled/i.test(m))signinMsg('That email is not set up for the desk yet. Check it for typos. If you were just invited, use the link in your invite email first, or ask Christian to add you.',b);
      else if(/rate|seconds/i.test(m))signinMsg('Please wait a minute before asking for another email.',b);
      else signinMsg('Could not send the email: '+m,b);
      return;
    }
    pendingEmail=email;try{localStorage.setItem('desk-email',email)}catch(e){}
    $('emailForm').hidden=true;$('sent').hidden=false;
    $('sentMsg').textContent='Check '+email+' for a sign-in email. It can take a minute, and may land in spam.';$('code').focus();
  });
  $('codeForm').addEventListener('submit',async e=>{
    e.preventDefault();signinMsg('');
    const token=$('code').value.replace(/\D/g,'');if(!token||!pendingEmail)return;
    how='code';
    const {error}=await sb.auth.verifyOtp({email:pendingEmail,token,type:'email'});
    if(error)signinMsg('That code did not work. Codes expire after about an hour, so you may need a new one.',$('codeForm'));
  });
  $('restart').addEventListener('click',()=>{$('sent').hidden=true;$('emailForm').hidden=false;$('code').value='';signinMsg('')});
  $('signOut').addEventListener('click',async()=>{try{sessionStorage.removeItem('sspw-later')}catch(e){}await sb.auth.signOut();});
  $('pwChange').addEventListener('click',()=>{if(window.SSPw&&currentUser)SSPw.change(sb,currentUser)});

  // ---------- data ----------
  const STAGES=['New','Contacted','Demo set','Pilot','Signed','Not now'];
  let items=[],ready=false,currentUser=null;
  const of=k=>items.filter(i=>i.kind===k).map(i=>({...i.data,id:i.id,_created:i.created_at}));

  async function load(){
    const {data,error}=await sb.from('desk_items').select('id,kind,data,created_at').order('created_at',{ascending:true});
    if(error){setGate('Could not load saved data ('+(error.code||error.message||'error')+'). Try reloading.');return}
    items=data||[];ready=true;renderAll();
  }
  function renderAll(){renderSummary();renderBoard();renderMilestones();renderNotes();renderRequests();}
  function report(err){setGate('That change did not save ('+(err&&(err.code||err.message)||'error')+'). Try again in a moment.')}
  async function add(kind,data){
    const {error}=await sb.from('desk_items').insert({kind,data});
    if(error){report(error);return false}
    setGate('');await load();return true;
  }
  async function patch(id,changes){
    const it=items.find(i=>i.id===id);if(!it)return;
    const {error}=await sb.from('desk_items').update({data:{...it.data,...changes},updated_at:new Date().toISOString()}).eq('id',id);
    if(error)report(error);else setGate('');
    await load();
  }
  async function remove(id){
    const {error}=await sb.from('desk_items').delete().eq('id',id);
    if(error)report(error);else setGate('');
    await load();
  }

  async function onSession(session){
    if(!session){currentUser=null;ready=false;items=[];whoEl.textContent='Not signed in';screen('signin');$('emailForm').hidden=false;$('sent').hidden=true;return}
    if(currentUser&&currentUser.id===session.user.id)return;
    currentUser=session.user;
    whoEl.textContent='Signed in as '+(session.user.email||'owner');
    const {data:ok,error}=await sb.rpc('is_desk_member');
    if(error||!ok){
      // free-trial people land here from their confirmation email: send them on to the app
      if(!error){try{const r=await sb.rpc('app_access');if(r.data&&r.data.trial){try{localStorage.removeItem('ss-after-signin')}catch(e){}location.replace('../app/');return}}catch(e){}}
      screen('signin');$('emailForm').hidden=true;$('sent').hidden=true;
      signinMsg(error?'Could not check access ('+(error.code||error.message)+').':'This email is signed in but is not on the desk\'s list. Ask Christian to add it.');
      $('signOut').hidden=false;return;
    }
    signinMsg('');
    // came here from the test app's sign-in link: go back there
    try{if(localStorage.getItem('ss-after-signin')==='app'){localStorage.removeItem('ss-after-signin');location.replace('../app/');return}}catch(e){}
    screen('app');
    if(location.hash&&/access_token|error/.test(location.hash))history.replaceState(null,'',location.pathname);
    if(window.SSPw)SSPw.afterSignIn(sb,session.user,how);
    if(window.SSTrialDesk)SSTrialDesk.start(sb);
    await load();
  }
  (window.SSIdle?SSIdle.guard(sb):Promise.resolve()).then(()=>{
    sb.auth.onAuthStateChange((_evt,session)=>{setTimeout(()=>onSession(session),0)});
    sb.auth.getSession().then(({data})=>onSession(data.session));
  });
  // a link that failed (expired or already used) comes back with an error in the address
  if(/error_description=/.test(location.hash)){
    const p=new URLSearchParams(location.hash.slice(1));
    signinMsg('That sign-in link did not work ('+(p.get('error_description')||'expired')+'). Ask for a new one below.');
    history.replaceState(null,'',location.pathname);
  }
  // pick up changes Angelika or Christian made on another device
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ready)load()});

  // ---------- executive summary ----------
  // Category summaries are rows of kind 'summary'; answers are rows of kind 'answer'
  // ({cat, q, question, text, by}). A row with data.only is private to that one email (enforced by the database).
  const drafts={};const openCats=new Set();let openInit=false;
  const me=()=>((currentUser&&currentUser.email)||'').toLowerCase();
  const who=e=>!e?'Someone':(e.toLowerCase()===me()?'You':e.split('@')[0]);
  function summaries(){return of('summary').sort((a,b)=>(a.order||0)-(b.order||0))}
  function answersFor(cat){return of('answer').filter(a=>a.cat===cat)}
  function myAnswer(cat,q){return of('answer').find(a=>a.cat===cat&&a.q===q&&String(a.by||'').toLowerCase()===me())}
  function renderSummary(){
    const box=$('sumList');
    const keepFocus=document.activeElement&&box.contains(document.activeElement)?document.activeElement.dataset.key:null;
    box.textContent='';
    const cats=summaries();
    let total=0,done=0;
    cats.forEach(c=>{(c.questions||[]).forEach((q,i)=>{total++;const a=myAnswer(c.cat,i);if(a&&a.text)done++;})});
    $('sumCount').textContent=ready?(total?done+' of '+total+' questions answered':'No questions yet'):'Loading…';
    $('sumBar').style.width=total?Math.round(done/total*100)+'%':'0';
    if(!cats.length){box.append(el('p','empty',ready?'The summaries have not been added yet. Christian will load them.':'Your summary appears here once you are signed in.'));return}
    if(!openInit&&cats.length){openCats.add(cats[0].cat);openInit=true}
    cats.forEach(c=>{
      const qs=c.questions||[];
      const mine=qs.filter((q,i)=>{const a=myAnswer(c.cat,i);return a&&a.text}).length;
      const d=el('details','card sum');d.open=openCats.has(c.cat);
      d.addEventListener('toggle',()=>{d.open?openCats.add(c.cat):openCats.delete(c.cat)});
      const sm=el('summary');
      const h=el('div');h.append(el('span','eyebrow',c.status||'Draft'),el('h3',null,c.title||c.cat));
      const chips=el('div','sum-chips');
      if(c.only)chips.append(el('span','chip priv','Only you can see this'));
      if(qs.length)chips.append(el('span','chip'+(mine===qs.length?' ok':''),mine===qs.length?'All answered':mine+' of '+qs.length+' answered'));
      sm.append(h,chips,el('p','lede',c.summary||''));
      const body=el('div','sum-body');
      body.append(el('p',null,c.summary||''));
      if((c.points||[]).length){const ul=el('ul','pts');c.points.forEach(p=>ul.append(el('li',null,p)));body.append(ul)}
      if(c.source){const s=el('p','src');const a=el('a',null,c.source.includes('claude.ai')?'Full plan in Claude':'Open it');a.href=c.source;a.target='_blank';a.rel='noopener';s.append(a);if(c.source.includes('claude.ai'))s.append(document.createTextNode(' (ask Christian to share it if it does not open)'));body.append(s)}
      if(qs.length){
        const wrap=el('div','qs');wrap.append(el('h4',null,'Questions for you'));
        qs.forEach((qt,i)=>{
          const key=c.cat+'#'+i;const a=myAnswer(c.cat,i);
          const q=el('div','q'+(a&&a.text?' answered':''));
          const id='ans-'+c.cat+'-'+i;
          const lb=el('label',null,(i+1)+'. '+qt);lb.htmlFor=id;q.append(lb);
          answersFor(c.cat).filter(o=>o.q===i&&String(o.by||'').toLowerCase()!==me()&&o.text).forEach(o=>{
            const p=el('div','other');p.append(el('b',null,who(o.by)+': '),document.createTextNode(o.text));q.append(p);
          });
          const ta=el('textarea');ta.id=id;ta.maxLength=4000;ta.dataset.key=key;ta.placeholder='Your answer, in your own words';
          ta.value=key in drafts?drafts[key]:(a&&a.text)||'';
          const row=el('div','qrow');
          const b=el('button','btn','Save');b.type='button';
          const st=el('span','saved',a&&a.text?'Saved':'');
          ta.addEventListener('input',()=>{drafts[key]=ta.value;st.textContent=(ta.value.trim()===((a&&a.text)||''))?(a&&a.text?'Saved':''):'Not saved yet'});
          b.addEventListener('click',async()=>{
            const t=ta.value.trim();b.disabled=true;st.textContent='Saving…';
            let ok;
            if(a){ok=await patchOk(a.id,{text:t,question:qt})}
            else if(t){const data={cat:c.cat,q:i,question:qt,text:t,by:me()};if(c.only)data.only=c.only;ok=await add('answer',data)}
            else ok=true;
            b.disabled=false;
            if(ok){delete drafts[key];renderSummary()}else st.textContent='Not saved. Try again.';
          });
          row.append(b,st);q.append(ta,row);wrap.append(q);
          if(keepFocus===key)setTimeout(()=>{const n=document.querySelector('[data-key="'+CSS.escape(key)+'"]');if(n)n.focus()},0);
        });
        body.append(wrap);
      }
      const ideas=el('div','ideas');ideas.append(el('h4',null,'Your own ideas for this area'));
      answersFor(c.cat).filter(o=>o.q==='idea').sort((x,y)=>String(x._created).localeCompare(String(y._created))).forEach(o=>{
        const r=el('div','idea');const t=el('div',null,o.text||'');t.append(el('small',null,who(o.by)+' · '+(o._created?new Date(o._created).toLocaleDateString():'')));r.append(t);
        if(String(o.by||'').toLowerCase()===me()){const x=el('button','x','×');x.type='button';x.setAttribute('aria-label','Delete idea');let armed=false;
          x.addEventListener('click',()=>{if(!armed){armed=true;x.textContent='Delete?';setTimeout(()=>{armed=false;x.textContent='×'},3000);return}remove(o.id)});r.append(x)}
        ideas.append(r);
      });
      const f=el('form','row');const ikey=c.cat+'#idea';
      const it=el('textarea');it.maxLength=4000;it.dataset.key=ikey;it.placeholder='Anything you would add, change or drop here';it.setAttribute('aria-label','New idea for '+(c.title||c.cat));it.style.minHeight='3rem';
      it.value=drafts[ikey]||'';it.addEventListener('input',()=>{drafts[ikey]=it.value});
      const ib=el('button','btn ghost','Add idea');ib.type='submit';
      f.append(it,ib);ideas.append(f);
      f.addEventListener('submit',async e=>{e.preventDefault();const t=it.value.trim();if(!t||!ready)return;
        const data={cat:c.cat,q:'idea',text:t,by:me()};if(c.only)data.only=c.only;
        if(await add('answer',data)){delete drafts[ikey];renderSummary()}});
      body.append(ideas);
      d.append(sm,body);box.append(d);
    });
  }
  async function patchOk(id,changes){
    const it=items.find(i=>i.id===id);if(!it)return false;
    const {error}=await sb.from('desk_items').update({data:{...it.data,...changes},updated_at:new Date().toISOString()}).eq('id',id);
    if(error){report(error);return false}
    setGate('');await load();return true;
  }
  $('sumCopy').addEventListener('click',()=>{
    const lines=['Owner Desk executive summary answers (copied '+new Date().toLocaleString()+')',''];
    summaries().forEach(c=>{
      const as=answersFor(c.cat).filter(a=>a.text);if(!as.length)return;
      lines.push('## '+(c.title||c.cat)+(c.only?' (private)':''));
      (c.questions||[]).forEach((qt,i)=>{as.filter(a=>a.q===i).forEach(a=>{lines.push('Q'+(i+1)+'. '+qt);lines.push('   '+String(a.by||'').split('@')[0]+': '+String(a.text).replace(/\n/g,'\n   '))})});
      as.filter(a=>a.q==='idea').forEach(a=>lines.push('Idea from '+String(a.by||'').split('@')[0]+': '+String(a.text).replace(/\n/g,'\n   ')));
      lines.push('');
    });
    if(lines.length===2)lines.push('No answers yet.');
    const txt=lines.join('\n');const b=$('sumCopy');
    const done=()=>{b.textContent='Copied';setTimeout(()=>b.textContent='Copy answers for Claude',1500)};
    try{navigator.clipboard.writeText(txt).then(done,()=>prompt('Copy this:',txt))}catch(err){prompt('Copy this:',txt)}
  });

  // ---------- leads ----------
  function renderBoard(){
    const leads=of('lead');
    $('leadCount').textContent=leads.filter(l=>l.stage!=='Not now').length;
    const board=$('board');board.textContent='';
    STAGES.forEach(st=>{
      const col=el('div','col');const list=leads.filter(l=>(l.stage||'New')===st).sort((a,b)=>(a.nextDate||'9999').localeCompare(b.nextDate||'9999'));
      const h=el('h3');h.append(el('span',null,st),el('span',null,String(list.length)));col.append(h);
      if(!list.length)col.append(el('p','empty',ready?'None yet':'—'));
      list.forEach(l=>{
        const c=el('div','lead');
        c.append(el('b',null,l.name||'Unnamed home'));
        const bits=[l.type,l.pay,l.county].filter(Boolean).join(' · ');if(bits)c.append(el('span','meta',bits));
        if(l.contact||l.reach)c.append(el('span',null,[l.contact,l.reach].filter(Boolean).join(' · ')));
        if(l.next||l.nextDate)c.append(el('span','meta due','Next: '+[l.next,l.nextDate].filter(Boolean).join(' · ')));
        if(l.notes){const p=el('span','meta',l.notes);p.style.whiteSpace='pre-wrap';c.append(p)}
        const act=el('div','lead-actions');
        const sel=el('select');sel.setAttribute('aria-label','Move '+(l.name||'home'));
        STAGES.forEach(s=>{const o=el('option',null,s);o.value=s;if(s===(l.stage||'New'))o.selected=true;sel.append(o)});
        sel.addEventListener('change',()=>patch(l.id,{stage:sel.value}));
        const del=el('button','x','Remove');del.type='button';
        let armed=false;
        del.addEventListener('click',()=>{if(!armed){armed=true;del.textContent='Confirm';setTimeout(()=>{armed=false;del.textContent='Remove'},3000);return}remove(l.id)});
        act.append(sel,del);c.append(act);col.append(c);
      });
      board.append(col);
    });
  }
  $('leadForm').addEventListener('submit',async e=>{
    e.preventDefault();if(!ready)return;
    const v=id=>$(id).value.trim();
    const data={name:v('lf-name'),contact:v('lf-contact'),type:v('lf-type'),pay:v('lf-pay'),county:v('lf-county'),reach:v('lf-reach'),next:v('lf-next'),nextDate:v('lf-date'),notes:v('lf-notes'),stage:'New'};
    if(!data.name)return;
    if(await add('lead',data)){e.target.reset();$('leadDetails').open=false}
  });

  // ---------- next steps ----------
  function renderMilestones(){
    const ul=$('milestoneList');ul.textContent='';const ms=of('milestone');
    if(!ms.length){ul.append(el('li','empty',ready?'No next steps yet. Add the first one below.':'Next steps appear here once you are signed in.'));return}
    ms.sort((a,b)=>(!!a.done-!!b.done)||String(a._created).localeCompare(String(b._created))).forEach(m=>{
      const li=el('li',m.done?'done':'');const id='m-'+m.id;
      const box=el('input');box.type='checkbox';box.id=id;box.checked=!!m.done;
      box.addEventListener('change',()=>patch(m.id,{done:box.checked}));
      const lb=el('label',null,m.text||'');lb.htmlFor=id;
      const x=el('button','x','×');x.type='button';x.setAttribute('aria-label','Delete '+(m.text||'step'));
      x.addEventListener('click',()=>remove(m.id));
      li.append(box,lb,x);ul.append(li);
    });
  }
  $('milestoneForm').addEventListener('submit',async e=>{
    e.preventDefault();const i=$('milestoneInput');const t=i.value.trim();if(!t||!ready)return;
    if(await add('milestone',{text:t,done:false}))i.value='';
  });

  // ---------- notes ----------
  function renderNotes(){
    const box=$('noteList');box.textContent='';const ns=of('note');
    if(!ns.length){box.append(el('p','empty',ready?'No notes yet.':'Notes appear here once you are signed in.'));return}
    ns.sort((a,b)=>String(b._created).localeCompare(String(a._created))).forEach(n=>{
      const c=el('div','note');const m=el('div','meta');
      const left=el('span');left.append(el('span','tag',n.tag||'Note'),document.createTextNode('  '+(n._created?new Date(n._created).toLocaleDateString():'')));
      const x=el('button','x','×');x.type='button';x.setAttribute('aria-label','Delete note');
      let armed=false;x.addEventListener('click',()=>{if(!armed){armed=true;x.textContent='Delete?';setTimeout(()=>{armed=false;x.textContent='×'},3000);return}remove(n.id)});
      m.append(left,x);c.append(m,el('p',null,n.text||''));box.append(c);
    });
  }
  $('noteForm').addEventListener('submit',async e=>{
    e.preventDefault();const t=$('noteText');const txt=t.value.trim();if(!txt||!ready)return;
    if(await add('note',{text:txt,tag:$('noteTag').value}))t.value='';
  });

  // ---------- requests for Claude ----------
  const RSTAT=['New','In progress','Done'];
  const rOrder=r=>({'New':0,'In progress':1,'Done':2}[r.status||'New']);
  function renderRequests(){
    const box=$('reqList');box.textContent='';const rs=of('request');
    if(!rs.length){box.append(el('p','empty',ready?'No requests yet.':'Requests appear here once you are signed in.'));return}
    rs.sort((a,b)=>(rOrder(a)-rOrder(b))||String(b._created).localeCompare(String(a._created))).forEach(r=>{
      const st=r.status||'New';
      const c=el('div','req'+(st==='Done'?' done':''));
      const m=el('div','meta');
      m.append(el('span','status'+(st==='In progress'?' s-progress':st==='Done'?' s-done':''),st),el('span','tag',r.kind||'Request'));
      if(r.biz)m.append(el('span',null,r.biz));
      if(r.when&&r.when!=='Whenever')m.append(el('span','due',r.when));
      m.append(el('span',null,(r._created?new Date(r._created).toLocaleDateString():'')+(r.by?' · '+r.by:'')));
      c.append(m,el('p',null,r.text||''));
      if(r.reply){const rp=el('div','reply');rp.append(el('b',null,'Reply: '),document.createTextNode(r.reply));c.append(rp)}
      const row=el('div','row');
      const sel=el('select');sel.setAttribute('aria-label','Status');
      RSTAT.forEach(s=>{const o=el('option',null,s);o.value=s;if(s===st)o.selected=true;sel.append(o)});
      sel.addEventListener('change',()=>patch(r.id,{status:sel.value}));
      const rb=el('button','btn ghost',r.reply?'Edit reply':'Add reply');rb.type='button';
      const del=el('button','x','Remove');del.type='button';
      let armed=false;del.addEventListener('click',()=>{if(!armed){armed=true;del.textContent='Confirm';setTimeout(()=>{armed=false;del.textContent='Remove'},3000);return}remove(r.id)});
      row.append(sel,rb,del);c.append(row);
      rb.addEventListener('click',()=>{
        const f=el('form');f.style.display='grid';f.style.gap='.5rem';
        const ta=el('textarea');ta.maxLength=4000;ta.value=r.reply||'';ta.setAttribute('aria-label','Reply');
        const sb2=el('button','btn','Save reply');sb2.type='submit';
        f.append(ta,sb2);rb.replaceWith(f);ta.focus();
        f.addEventListener('submit',e=>{e.preventDefault();patch(r.id,{reply:ta.value.trim()})});
      });
      box.append(c);
    });
  }
  $('reqForm').addEventListener('submit',async e=>{
    e.preventDefault();if(!ready)return;
    const t=$('rq-text').value.trim();if(!t)return;
    const data={kind:$('rq-kind').value,biz:$('rq-biz').value.trim(),when:$('rq-when').value,text:t,status:'New',reply:'',by:(currentUser&&currentUser.email)||''};
    if(await add('request',data)){e.target.reset()}
  });
  $('reqCopy').addEventListener('click',()=>{
    const open=of('request').filter(r=>(r.status||'New')!=='Done').sort((a,b)=>String(a._created).localeCompare(String(b._created)));
    const lines=['Owner Desk requests for Claude ('+open.length+' open, copied '+new Date().toLocaleString()+')',''];
    open.forEach((r,i)=>{
      lines.push((i+1)+'. ['+(r.status||'New')+'] '+(r.kind||'Request')+(r.biz?' / '+r.biz:'')+(r.when&&r.when!=='Whenever'?' / '+r.when:''));
      lines.push('   From '+(r.by||'unknown')+' on '+(r._created?new Date(r._created).toLocaleDateString():'')+' (id '+r.id+')');
      lines.push('   '+String(r.text||'').replace(/\n/g,'\n   '));
      if(r.reply)lines.push('   Reply so far: '+r.reply);
      lines.push('');
    });
    if(!open.length)lines.push('Nothing open right now.');
    const txt=lines.join('\n');const b=$('reqCopy');
    const done=()=>{b.textContent='Copied';setTimeout(()=>b.textContent='Copy open requests for Claude',1500)};
    try{navigator.clipboard.writeText(txt).then(done,()=>prompt('Copy this:',txt))}catch(err){prompt('Copy this:',txt)}
  });

  renderAll();
})();
