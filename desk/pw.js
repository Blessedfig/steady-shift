// Shared password sign-in helpers for the Owner Desk and the test app (same Supabase project).
// Everyone picks their own password. Nobody else sees it, and Claude never sets one.
// Accounts stay invite only: there is no sign-up here, only sign-in for people already on the list.
(function(){
  const MIN = 10;
  const css = `
  .sspw-back{position:fixed;inset:0;background:rgba(20,40,60,.45);display:grid;place-items:center;padding:16px;z-index:1000}
  .sspw{background:#fff;color:#1F3A52;border-radius:18px;max-width:420px;width:100%;padding:1.4rem 1.3rem;display:grid;gap:.8rem;box-shadow:0 20px 50px -20px rgba(20,50,80,.5);font:inherit}
  .sspw h2{margin:0;font-size:1.25rem}
  .sspw p{margin:0;font-size:.95rem;color:#5A6F80}
  .sspw label{display:grid;gap:.3rem;font-weight:700;font-size:.92rem}
  .sspw input{font:inherit;font-weight:400;padding:.7rem .8rem;border:1px solid #B9CDDD;border-radius:12px;min-height:44px;width:100%;box-sizing:border-box}
  .sspw .row{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center}
  .sspw button{font:inherit;font-weight:700;border-radius:999px;min-height:44px;padding:.55rem 1.1rem;cursor:pointer;border:1px solid #1D6AA8}
  .sspw .go{background:#1D6AA8;color:#fff}
  .sspw .later{background:#fff;color:#1D6AA8}
  .sspw .show{border:0;background:none;color:#1D6AA8;text-decoration:underline;padding:.3rem;min-height:auto;font-weight:600}
  .sspw .msg{font-size:.9rem;padding:.6rem .8rem;border-radius:10px;background:#FBF1E2;color:#7a4a0c}
  .sspw .ok{background:#E6F2EC;color:#1f5e43}
  .sspw-typo{font-size:.9rem;margin-top:.35rem;padding:.5rem .7rem;border-radius:10px;background:#FBF1E2;color:#7a4a0c;font-weight:400}
  .sspw-typo button{font:inherit;font-weight:700;background:none;border:0;color:#1D6AA8;text-decoration:underline;cursor:pointer;padding:.2rem .3rem;min-height:32px}
  .sspw-busy{opacity:.75;cursor:progress}
  .sspw-busy::after{content:"";width:1em;height:1em;margin-left:.5em;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;display:inline-block;vertical-align:-.15em;animation:sspw-spin .8s linear infinite}
  @keyframes sspw-spin{to{transform:rotate(360deg)}}
  @media (prefers-reduced-motion:reduce){.sspw-busy::after{animation:none}}`;
  function addCss(){ if (document.getElementById('sspw-css')) return; const s = document.createElement('style'); s.id = 'sspw-css'; s.textContent = css; document.head.appendChild(s); }
  function el(tag, attrs, ...kids){ const e = document.createElement(tag); Object.entries(attrs||{}).forEach(([k,v]) => { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); }); kids.flat().forEach(k => { if (k != null) e.append(k); }); return e; }

  function friendly(error){
    const m = String((error && error.message) || error || '');
    if (/invalid login credentials/i.test(m)) return 'That email and password do not match. Check the email for typos. First time? Use "Email me a sign-in code" below to set your password.';
    if (/email not confirmed/i.test(m)) return 'This email is not confirmed yet. Use "Email me a sign-in code" below.';
    if (/rate|too many|seconds/i.test(m)) return 'Too many tries just now. Please wait a few minutes and try again.';
    if (/should be different|same password/i.test(m)) return 'That is already your password. Pick a new one, or keep using it.';
    if (/reauth|recent|nonce/i.test(m)) return 'For safety, please sign out, sign in again with an email code, and then change your password.';
    if (/weak|at least|characters|pwned|leaked/i.test(m)) return 'Please pick a longer or less common password (at least '+MIN+' characters).';
    return m || 'Something went wrong. Please try again.';
  }

  async function signIn(sb, email, password){
    const {error} = await sb.auth.signInWithPassword({email, password});
    return error ? friendly(error) : '';
  }

  const hasPassword = user => !!(user && user.user_metadata && user.user_metadata.password_set);

  // "Choose a password" dialog. mode 'first' (after a code or link sign-in) or 'change'.
  function dialog(sb, user, mode, done){
    addCss();
    if (document.querySelector('.sspw-back')) return;
    const p1 = el('input',{type:'password',autocomplete:'new-password',minlength:String(MIN),required:true,id:'sspw-new'});
    const p2 = el('input',{type:'password',autocomplete:'new-password',minlength:String(MIN),required:true,id:'sspw-again'});
    const hidden = el('input',{type:'email',autocomplete:'username',value:(user && user.email)||'',hidden:true,readonly:true});
    const msg = el('div',{class:'msg',hidden:true,role:'status'});
    const show = el('button',{type:'button',class:'show',onclick:()=>{ const t = p1.type === 'password' ? 'text' : 'password'; p1.type = t; p2.type = t; show.textContent = t === 'password' ? 'Show' : 'Hide'; }},'Show');
    const save = el('button',{type:'submit',class:'go'},'Save password');
    const later = el('button',{type:'button',class:'later',onclick:()=>{ if (mode === 'first') { try { sessionStorage.setItem('sspw-later','1'); } catch(e){} } close(); }}, mode === 'first' ? 'Not now' : 'Cancel');
    const form = el('form',{class:'sspw',role:'dialog','aria-modal':'true','aria-labelledby':'sspw-h'},
      el('h2',{id:'sspw-h'}, mode === 'first' ? 'Choose a password for next time' : 'Change your password'),
      el('p',null, mode === 'first' ? 'Then you can sign in with your email and password on any device, including the phone app. Pick at least '+MIN+' characters. Only you will know it.' : 'Pick at least '+MIN+' characters. Only you will know it.'),
      hidden,
      el('label',{for:'sspw-new'},'New password', p1),
      el('label',{for:'sspw-again'},'Type it again', p2),
      show, msg, el('div',{class:'row'}, save, later));
    const back = el('div',{class:'sspw-back'}, form);
    function close(){ back.remove(); if (done) done(); }
    form.addEventListener('submit', async e => {
      e.preventDefault(); msg.hidden = true; msg.className = 'msg';
      if (p1.value.length < MIN){ msg.textContent = 'Please use at least '+MIN+' characters.'; msg.hidden = false; return; }
      if (p1.value !== p2.value){ msg.textContent = 'The two passwords do not match.'; msg.hidden = false; return; }
      save.disabled = true; save.textContent = 'Saving…';
      const {error} = await sb.auth.updateUser({password:p1.value, data:{password_set:true}});
      save.disabled = false; save.textContent = 'Save password';
      if (error){ msg.textContent = friendly(error); msg.hidden = false; return; }
      p1.value = ''; p2.value = '';
      form.replaceChildren(el('h2',null,'Password saved'), el('p',null,'Next time, sign in with '+((user && user.email)||'your email')+' and this password. If you ever forget it, use "Email me a sign-in code" and choose a new one.'), el('div',{class:'row'}, el('button',{type:'button',class:'go',onclick:close},'Done')));
    });
    document.body.appendChild(back);
    p1.focus();
  }

  // Call after a successful sign-in and access check.
  function afterSignIn(sb, user, how){
    if (how === 'password'){
      if (!hasPassword(user)) sb.auth.updateUser({data:{password_set:true}});
      return;
    }
    let later = false; try { later = !!sessionStorage.getItem('sspw-later'); } catch(e){}
    if (!hasPassword(user) && !later) dialog(sb, user, 'first');
  }

  // Likely typos in the email address (".con" for ".com", "gmial" for "gmail" ...). Returns the suggested address or ''.
  const TLD = {con:'com',cmo:'com',ocm:'com',comm:'com',vom:'com',xom:'com',cpm:'com',coom:'com',ner:'net',nte:'net',ogr:'org',orh:'org'};
  const DOM = {gmial:'gmail',gmal:'gmail',gmai:'gmail',gnail:'gmail',gamil:'gmail',yahooo:'yahoo',yaho:'yahoo',hotmial:'hotmail',hotmal:'hotmail',outlok:'outlook',outloo:'outlook',iclod:'icloud',icoud:'icloud'};
  function emailTypo(email){
    const m = /^([^@\s]+)@([^@\s]+)\.([a-z]+)$/i.exec(String(email||'').trim()); if (!m) return '';
    let dom = m[2].toLowerCase(), tld = m[3].toLowerCase(), changed = false;
    if (TLD[tld]){ tld = TLD[tld]; changed = true; }
    if (DOM[dom]){ dom = DOM[dom]; changed = true; }
    return changed ? m[1]+'@'+dom+'.'+tld : '';
  }
  // Shows a "Did you mean ...?" line under an email input, with a one-tap fix.
  function watchEmail(input){
    addCss();
    const hint = el('div',{class:'sspw-typo',role:'status',hidden:true});
    input.insertAdjacentElement('afterend', hint);
    let shown = null;
    const check = () => {
      const sug = emailTypo(input.value);
      if (sug === shown) return; // keep the same button, so a tap on "Fix it" isn't lost when the box loses focus
      shown = sug; hint.replaceChildren(); hint.hidden = !sug; if (!sug) return;
      hint.append('Did you mean ', el('b',null,sug), '? ', el('button',{type:'button',onclick:()=>{ input.value = sug; check(); input.focus(); }},'Fix it'));
    };
    ['input','blur','change'].forEach(ev => input.addEventListener(ev, check));
    check();
    return () => { check(); return emailTypo(input.value); };
  }
  // Moves a message box right under the thing the person just tapped, and scrolls it into view.
  function showNear(msgEl, anchor){
    if (anchor && msgEl.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', msgEl);
    msgEl.hidden = false;
    try { msgEl.scrollIntoView({block:'center', behavior:'smooth'}); } catch(e){ msgEl.scrollIntoView(); }
  }

  window.SSPw = {MIN, signIn, friendly, hasPassword, afterSignIn, emailTypo, watchEmail, showNear, change:(sb,user)=>dialog(sb,user,'change')};
})();
