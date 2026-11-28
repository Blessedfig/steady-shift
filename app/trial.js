// Free trial codes for the test app: sign up with a code, a countdown while the trial runs,
// and a plan choice near the end and after it. The rules live in desk/trials.sql (Supabase);
// this file only shows screens. Payment is handled by the "trial-checkout" server function once
// Christian switches Stripe on. No payment keys or secrets are ever in this file.
(function(){
  const $ = id => document.getElementById(id);
  function h(tag, attrs, ...kids){
    const e = document.createElement(tag);
    Object.entries(attrs||{}).forEach(([k,v]) => { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); });
    kids.flat().forEach(k => { if (k != null && k !== false) e.append(k); });
    return e;
  }
  const DAY = 86400000;
  const daysLeft = t => Math.max(0, Math.ceil((new Date(t.ends_at) - Date.now()) / DAY));
  const paid = t => !!(t && t.paid_until && new Date(t.paid_until) > Date.now());
  const active = t => !!(t && (new Date(t.ends_at) > Date.now() || paid(t)));
  const fmt = d => new Date(d).toLocaleDateString(undefined, {weekday:'long', month:'long', day:'numeric'});
  const cleanCode = s => String(s||'').toUpperCase().replace(/[^A-Z0-9-]/g,'');

  // Prices from the pricing decision of Nov 27, 2026 (Lower entry prices). Family, Nurse Pro and Agency are still drafts.
  const PLANS = [
    {id:'home',     name:'Home suite',     price:'$59',  per:'a month per adult family home', deal:'Founding homes: $35 a month for the first 12 months', fits:['afh'], pts:['Every screen you used in the trial','All caregivers, manager and owner','Pay yearly: $590 (2 months free)']},
    {id:'facility', name:'Facility suite', price:'$149', per:'a month per CBRF up to 20 beds', deal:'Founding homes: $89 a month for the first 12 months', fits:['cbrf'], pts:['$229 a month above 20 beds','All staff, manager, nurse and owner','Survey-Ready Check and reports']},
    {id:'group',    name:'Multi-site',     price:'$119', per:'a month per site, 4 sites or more', fits:['multi'], pts:['Each site keeps its own private space','A view across all your sites','We set this one up with you']},
    {id:'family',   name:'Family',         price:'about $10',  per:'a month', fits:['family'], pts:['One family caregiver','You and the person you care for','Hand-off packet for helpers']},
    {id:'nurse',    name:'Nurse Pro',      price:'$29 to $49', per:'a month', fits:['nurse'],  pts:['Free when a home invites you','Pro puts all your homes in one place']},
    {id:'agency',   name:'Agency',         price:'about $5',   per:'per caregiver a month, $99 minimum', fits:['agency'], pts:['Home care agencies','Caregivers, office and nurse views']}
  ];

  // ---------- after sign-in: may this person use the app? ----------
  async function check(sb){
    const r = await sb.rpc('app_access');
    if (r.error){
      // trials.sql not run yet: fall back to the original members-only rule
      if (/PGRST202|42883|not find|does not exist/i.test(String(r.error.code)+' '+String(r.error.message))){
        const m = await sb.rpc('is_desk_member');
        if (m.error) return {error:m.error};
        return {member:!!m.data, trial:null, active:!!m.data};
      }
      return {error:r.error};
    }
    const d = r.data || {}, t = d.trial || null;
    return {member:!!d.member, trial:t, active:!!d.member || active(t), trialOnly:!d.member && !!t};
  }

  // ---------- countdown bar at the top of the app ----------
  function bar(t, openPlans){
    const b = $('trialBar'); if (!b) return;
    b.textContent = '';
    if (!t){ b.hidden = true; return; }
    if (paid(t)){ b.hidden = true; return; }
    const n = daysLeft(t), soon = n <= 3;
    b.className = 'trialbar noprint' + (soon ? ' soon' : '');
    const what = n <= 1 ? 'Your free trial ends today.' : 'Free trial: '+n+' days left (ends '+fmt(t.ends_at)+').';
    const picked = t.plan ? ' You picked a plan, thank you. We\'ll be in touch.' : '';
    b.append(h('div',{class:'in'},
      h('span',null, h('b',null,what), picked),
      h('button',{class:'btn '+(soon && !t.plan ? '' : 'ghost')+' sm',type:'button',onclick:openPlans}, t.plan ? 'See plans' : soon ? 'Choose a plan' : 'See plans')));
    b.hidden = false;
  }
  // a gentle reminder in the last 3 days, at most once a day and only until they pick something
  function shouldNudge(t){
    if (!t || t.plan || paid(t) || daysLeft(t) > 3) return false;
    const today = new Date().toDateString();
    try { if (localStorage.getItem('ss-trial-nudge') === today) return false; localStorage.setItem('ss-trial-nudge', today); } catch(e){ return false; }
    return true;
  }

  // ---------- plan choice ----------
  let checkout = null; // null = not asked yet; {ok, plans:[...]} once asked
  async function probeCheckout(sb){
    if (checkout) return checkout;
    try { const {data, error} = await sb.functions.invoke('trial-checkout', {body:{ping:true}}); checkout = !error && data && data.ok ? data : {ok:false, plans:[]}; }
    catch(e){ checkout = {ok:false, plans:[]}; }
    return checkout;
  }
  async function plans(sb, user, t, opts){
    opts = opts || {};
    const box = $('plans'); box.textContent = ''; box.hidden = false;
    $('app').hidden = true; $('gate').hidden = true;
    const ended = !active(t);
    const msg = h('p',{class:'msg',hidden:true,role:'status'});
    const say = (text, err) => { msg.textContent = text; msg.className = 'msg'+(err?' err':''); msg.hidden = !text; msg.scrollIntoView({block:'nearest'}); };
    const pay = await probeCheckout(sb);
    const fit = t && t.home_type;

    async function pick(planId, note, btn){
      if (btn){ btn.disabled = true; btn.setAttribute('aria-busy','true'); }
      try {
        if (pay.ok && (pay.plans||[]).includes(planId)){
          const {data, error} = await sb.functions.invoke('trial-checkout', {body:{plan:planId, return_url:location.origin+location.pathname}});
          if (!error && data && data.url && /^https:\/\/checkout\.stripe\.com\//.test(data.url)){ location.href = data.url; return; }
          say('The payment page didn\'t open. We saved your choice instead, and we\'ll email you to finish.', true);
        }
        const {data, error} = await sb.rpc('choose_plan', {p_plan:planId, p_note:note||null});
        if (error || !data){ say('That didn\'t save ('+((error&&(error.code||error.message))||'no trial found')+'). Please try again in a moment.', true); return; }
        t.plan = planId;
        const done = {
          reduced:'Thank you! We\'ll email you to set up Rules Check at $22 a month. Angelika reads every note personally.',
          more_time:'Got it. We\'ll email you about your extra free month.',
          not_now:'Thanks for trying Steady Shift. If you change your mind, sign in any time and pick a plan.'
        }[planId] || 'Thank you! Online payment isn\'t switched on yet, so we\'ll email '+user.email+' to set up your plan. You don\'t need to do anything else right now.';
        say(done);
      } finally { if (btn){ btn.disabled = false; btn.removeAttribute('aria-busy'); } }
    }

    const head = h('div',{class:'grid',style:'gap:.5rem'},
      h('span',{class:'eyebrow'}, ended ? 'Your free trial has ended' : 'Keep going after your trial'),
      h('h1',{tabindex:'-1',id:'plansTitle'}, ended ? 'Thanks for trying Steady Shift. Pick how you\'d like to continue.' : 'Choose the plan that fits your home'),
      h('p',{class:'muted'}, ended
        ? 'Your trial ended on '+fmt(t.ends_at)+'. Anything you typed is still saved on this device. Choose a plan to keep using the app.'
        : 'Your trial runs until '+fmt(t.ends_at)+'. Picking a plan now doesn\'t cut your trial short.'),
      t.plan ? h('p',{class:'msg'},'You already picked "'+(PLANS.find(p=>p.id===t.plan)||{name:t.plan}).name+'". You can change it below.') : null);

    const grid = h('div',{class:'plangrid'});
    const order = PLANS.slice().sort((a,b) => (b.fits.includes(fit)?1:0) - (a.fits.includes(fit)?1:0));
    order.forEach(p => {
      const best = p.fits.includes(fit);
      const btn = h('button',{class:'btn'+(best?'':' ghost')+' sm',type:'button'}, pay.ok && (pay.plans||[]).includes(p.id) ? 'Continue to payment' : 'Choose '+p.name);
      btn.addEventListener('click', () => pick(p.id, null, btn));
      grid.append(h('div',{class:'card plan'+(best?' pick':'')},
        best ? h('span',{class:'chip'},'Fits what you told us') : null,
        h('h2',{style:'margin:0;font:800 1.15rem var(--display)'}, p.name),
        h('div',{class:'price'}, p.price, ' ', h('small',null,p.per)),
        p.deal ? h('span',{class:'chip'}, p.deal) : null,
        h('ul',null, p.pts.map(x => h('li',null,x))),
        h('div',{class:'row'}, btn)));
    });

    // the gentle option for homes that can't stretch to full price right now:
    // start with Rules Check alone ($22 a month), or ask for one more free month
    const note = h('textarea',{id:'reducedNote',maxlength:'900','aria-labelledby':'reducedH',placeholder:'Anything you\'d like Angelika to know (optional)'});
    const rb = h('button',{class:'btn sm',type:'button'},'Start with Rules Check, $22 a month');
    rb.addEventListener('click', () => pick('reduced', 'Rules Check only ($22 a month).' + (note.value.trim() ? ' ' + note.value.trim() : ''), rb));
    const mt = h('button',{class:'btn quiet sm',type:'button'},'Ask for one more free month');
    mt.addEventListener('click', () => pick('more_time', 'One more free month.' + (note.value.trim() ? ' ' + note.value.trim() : ''), mt));
    const help = h('div',{class:'card soft'},
      h('h2',{id:'reducedH',style:'margin:0;font:800 1.1rem var(--display)'},'Is the price a stretch right now?'),
      h('p',{class:'small'},'Small homes run on thin margins, and we were a small home too. You can start with just Rules Check (procedure and rule answers for your staff) for $22 a month, or ask for one more free month to decide. Nothing is charged today.'),
      note, h('div',{class:'row'}, rb, mt));

    const foot = h('div',{class:'card warn'},
      h('p',{class:'small',style:'margin:0'}, h('b',null,'Test version. '),'Pay yearly and get 2 months free. Prices may change before release. Even on a paid plan, this version is for made-up sample data only: please don\'t enter real resident names or health details until we tell you the secure version is ready.'));

    const actions = h('div',{class:'row'},
      opts.locked ? null : h('button',{class:'btn ghost sm',type:'button',onclick:() => { box.hidden = true; $('app').hidden = false; if (opts.onBack) opts.onBack(); }},'Back to the app'),
      ended ? h('button',{class:'btn quiet sm',type:'button',onclick:() => pick('not_now', null)},'No thanks, not right now') : null,
      h('button',{class:'linkbtn',type:'button',onclick:opts.onSignOut},'Sign out'));

    // Automatic renewal terms, shown before anyone reaches the payment page (FTC ROSCA; Wis. Stat. 134.49 for business plans).
    const renew = pay.ok ? h('p',{class:'small',style:'margin:0'}, h('b',null,'How paid plans work. '),
      'Plans paid online are monthly subscriptions. They renew automatically each month at the price shown, and you are charged on the same day each month until you cancel. A first-year founding price moves to the regular monthly price after 12 months. To cancel, email ',
      h('a',{href:'mailto:owner@theblessedfigtree.com'},'owner@theblessedfigtree.com'), ' any time before your next renewal date. The payment page shows the exact amount before you agree.') : null;
    box.append(...[head, msg, renew, grid, help, foot, actions].filter(Boolean));
    const ti = $('plansTitle'); if (ti) ti.focus();
  }

  // ---------- sign-up with a code (on the sign-in screen) ----------
  function setupRedeem(sb, gate, busy){
    const open = $('trialOpen'), form = $('trialForm'), verify = $('trialVerify');
    if (!open || !form) return;
    const intro = $('gateIntro') ? $('gateIntro').textContent : '';
    function show(on){
      form.hidden = !on; open.setAttribute('aria-expanded', String(on)); $('trialCard').hidden = on;
      $('pwForm').hidden = on; $('firstCard').hidden = on; $('codeForm').hidden = true; if (verify) verify.hidden = true;
      $('gateTitle').textContent = on ? 'Start your free trial' : 'Sign in';
      $('gateIntro').textContent = on ? 'Two weeks with everything unlocked. No card needed. Create your account with the code you were given.' : intro;
      gate('');
      if (on) ($('t-code').value ? $('t-name') : $('t-code')).focus(); else $('email').focus();
    }
    open.addEventListener('click', () => show(true));
    $('trialBack').addEventListener('click', () => show(false));
    // links Angelika shares: .../app/?code=SS-XXXX-XXXX
    const q = new URLSearchParams(location.search).get('code') || new URLSearchParams(location.search).get('trial');
    if (q !== null){ $('t-code').value = cleanCode(q); show(true); window.scrollTo(0,0); }
    let pendingEmail = '';
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const code = cleanCode($('t-code').value), email = $('t-email').value.trim().toLowerCase(), pw = $('t-pw').value;
      $('t-code').value = code;
      if (!$('t-agree').checked){ gate('Please tick the box about made-up data first.', true, $('t-btn')); return; }
      if (pw.length < 10){ gate('Choose a password with at least 10 characters.', true, $('t-btn')); $('t-pw').focus(); return; }
      if (window.SSPw){ const sug = SSPw.emailTypo(email); if (sug){ gate('Check your email address. Did you mean '+sug+'?', true, $('t-btn')); $('t-email').focus(); return; } }
      const b = $('t-btn'); busy(b, true, 'Creating your account…');
      try { localStorage.setItem('desk-email', email); localStorage.setItem('ss-after-signin','app'); } catch(err){}
      const {data, error} = await sb.auth.signUp({email, password:pw, options:{
        emailRedirectTo: location.origin + location.pathname,
        data:{trial_code:code, name:$('t-name').value.trim().slice(0,60), home_type:$('t-type').value, password_set:true}}});
      busy(b, false, 'Create my account');
      if (error){
        const m = String(error.message||'');
        if (/signups? not allowed|signup.*disabled/i.test(m)) gate('Trial sign-ups aren\'t switched on yet. Please let the person who gave you the code know.', true, b);
        else if (/already (been )?registered|already exists/i.test(m)) gate('This email already has an account. Sign in above with your password, or use "Email me a sign-in code".', true, b);
        else if (/rate|seconds|too many/i.test(m)) gate('Too many tries just now. Please wait a few minutes and try again.', true, b);
        else if (/password/i.test(m)) gate(m, true, b);
        else gate(m.replace(/^.*?(Steady Shift|That trial code|This email)/, '$1') || 'Could not create the account.', true, b);
        return;
      }
      // Supabase answers this way when the email already has an account
      if (data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0){
        gate('This email already has an account. Sign in above with your password, or use "Email me a sign-in code".', true, b); return;
      }
      if (data && data.session) return; // email confirmation is off: already signed in, the app opens
      pendingEmail = email;
      form.hidden = true; verify.hidden = false;
      gate('Almost done. We emailed a 6-digit code to '+email+' (it may land in spam). Type it below, or tap the link in the email.', false, verify);
      $('t-otp').focus();
    });
    if (verify) verify.addEventListener('submit', async e => {
      e.preventDefault();
      const token = $('t-otp').value.replace(/\D/g,''), email = pendingEmail || $('t-email').value.trim().toLowerCase();
      const b = $('t-otpBtn'); busy(b, true, 'Checking…');
      let r = await sb.auth.verifyOtp({email, token, type:'signup'});
      if (r.error) r = await sb.auth.verifyOtp({email, token, type:'email'});
      busy(b, false, 'Confirm my email');
      if (r.error) gate(/expired|invalid/i.test(String(r.error.message)) ? 'That code didn\'t work or has expired. Tap "Send the email again" for a new one.' : 'Could not confirm: '+r.error.message, true, b);
    });
    if (verify){
      const again = h('button',{class:'linkbtn',type:'button'},'Send the email again');
      again.addEventListener('click', async () => {
        const email = pendingEmail || $('t-email').value.trim().toLowerCase(); if (!email) return;
        const {error} = await sb.auth.resend({type:'signup', email, options:{emailRedirectTo:location.origin+location.pathname}});
        gate(error ? (/rate|seconds/i.test(error.message) ? 'Please wait a minute before asking for another email.' : 'Could not resend: '+error.message) : 'Sent a new email to '+email+'. Use the newest code.', !!error, again);
      });
      verify.append(again);
    }
  }

  window.SSTrial = {check, bar, plans, setupRedeem, shouldNudge, daysLeft, active};
})();
