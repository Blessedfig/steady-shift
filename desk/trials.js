// Owner Desk "Trial codes" tab: make free trial codes, copy them to hand out, and see who signed up.
// The database rules are in trials.sql: only desk members can see or make codes.
(function(){
  const $ = id => document.getElementById(id);
  function el(tag, cls, text){ const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(text, cls, on){ const b = el('button', 'btn ghost' + (cls ? ' ' + cls : ''), text); b.type = 'button'; b.style.padding = '.5rem .85rem'; b.addEventListener('click', on); return b; }
  const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L: easy to read aloud and type
  function newCode(){
    const out = []; const buf = new Uint8Array(16);
    while (out.length < 8){ crypto.getRandomValues(buf); for (const x of buf){ if (x < 248 && out.length < 8) out.push(ABC[x % 31]); } }
    return 'SS-' + out.slice(0,4).join('') + '-' + out.slice(4).join('');
  }
  const appUrl = () => location.origin + location.pathname.replace(/desk\/.*$/, '') + 'app/';
  const linkFor = c => appUrl() + '?code=' + encodeURIComponent(c);
  const day = d => d ? new Date(d).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}) : '';
  const PLAN = {home:'Home suite', facility:'Facility suite', family:'Family', nurse:'Nurse Pro', agency:'Agency', group:'Multi-site',
                reduced:'Price help: Rules Check only ($22)', more_time:'Asked for one more free month', not_now:'Not right now'};
  const TYPE = {afh:'Adult family home', cbrf:'CBRF', agency:'Agency', multi:'Several sites', nurse:'Nurse', family:'Family caregiver', other:'Other'};
  function copy(text, b, label){
    const done = () => { b.textContent = 'Copied'; setTimeout(() => b.textContent = label, 1500); };
    try { navigator.clipboard.writeText(text).then(done, () => prompt('Copy this:', text)); } catch(e){ prompt('Copy this:', text); }
  }
  function message(c, name, viaAngelika){
    const hi = name ? 'Hi ' + name + '! Here is' : 'Hi! Here is';
    const core = hi + ' a free ' + c.trial_days + '-day trial of Steady Shift, a shift helper for Wisconsin adult family homes and CBRFs.\n\n'
      + '1. Open this link: ' + linkFor(c.code) + '\n'
      + '2. Create your account with your email and a password. Your trial code is ' + c.code + '\n'
      + '3. Check your email for a 6-digit code to confirm, and you\'re in.\n\n'
      + 'It\'s an early test version, so please use made-up names only and no real resident information.'
      + (c.expires_at ? '\nPlease use the code by ' + day(c.expires_at) + '.' : '')
      + '\n\nI\'d love to hear what you think!';
    return viaAngelika ? 'Hi Angelika! Here is a free trial code for ' + (name || 'your contact') + '. Could you pass this along?\n\n---\n\n' + core : core;
  }
  // open the person's own Messages or email app with the message filled in; nothing is sent automatically
  const isApple = /iPhone|iPad|Macintosh/.test(navigator.userAgent);
  function smsLink(to, body){ return 'sms:' + encodeURIComponent((to || '').replace(/[^\d+]/g, '')) + (isApple ? '&' : '?') + 'body=' + encodeURIComponent(body); }
  function mailLink(to, body){ return 'mailto:' + encodeURIComponent((to || '').trim()) + '?subject=' + encodeURIComponent('Your free Steady Shift trial') + '&body=' + encodeURIComponent(body); }
  function sendButtons(box, getText, opts){
    opts = opts || {};
    box.textContent = '';
    const a = (label, href, main) => { const x = el('a', 'btn' + (main ? '' : ' ghost'), label); x.href = href(); x.style.padding = '.5rem .85rem'; x.style.textDecoration = 'none'; x.addEventListener('click', () => { x.href = href(); }); return x; };
    const order = opts.how === 'email' ? ['email', 'text'] : ['text', 'email'];
    const shareFirst = !!navigator.share && (opts.how === 'share' || opts.how === 'angelika');
    order.forEach((k, i) => box.append(k === 'text' ? a('Send by text', () => smsLink(opts.how === 'text' ? opts.to : '', getText()), i === 0 && !shareFirst)
                                                   : a('Send by email', () => mailLink(opts.how === 'email' ? opts.to : '', getText()), i === 0 && !shareFirst)));
    if (navigator.share){ const sh = btn('Share…', '', () => navigator.share({text:getText()}).catch(() => {})); box.prepend(sh); if (shareFirst) sh.className = 'btn'; sh.style.padding = '.5rem .85rem'; }
    const cp = btn('Copy message', '', () => copy(getText(), cp, 'Copy message')); box.append(cp);
  }

  let sb = null, codes = [], people = [];
  function setup(msg){ const s = $('trSetup'); s.textContent = msg || ''; s.hidden = !msg; }
  function say(msg){ const m = $('trMsg'); m.textContent = msg || ''; m.hidden = !msg; }

  async function load(){
    const r = await sb.from('trial_codes').select('*').order('created_at', {ascending:false});
    if (r.error){
      setup(/42P01|PGRST20[25]|does not exist|schema cache/i.test(String(r.error.code) + ' ' + r.error.message)
        ? 'Trial codes are not switched on yet. Christian: run desk/trials.sql in the Supabase SQL Editor, then the steps in desk/README.md under "Turn on trial codes".'
        : 'Could not load trial codes (' + (r.error.code || r.error.message) + ').');
      $('trCodes').textContent = ''; $('trPeople').textContent = ''; return;
    }
    setup('');
    codes = r.data || [];
    const p = await sb.rpc('trial_report');
    people = p.error ? [] : (p.data || []);
    render();
  }

  function status(c){
    if (!c.active) return ['Turned off', ''];
    if (c.uses >= c.max_uses) return ['Used up', ''];
    if (c.expires_at && new Date(c.expires_at) < Date.now()) return ['Expired', ''];
    return ['Ready to give out', 'ok'];
  }
  function render(){
    const showOff = $('trShowOff').checked;
    const box = $('trCodes'); box.textContent = '';
    const list = codes.filter(c => showOff || status(c)[0] === 'Ready to give out');
    if (!list.length) box.append(el('p', 'empty', codes.length ? 'No codes ready to give out. Make some above, or tick "Show used up and turned off".' : 'No codes yet. Make one above.'));
    list.forEach(c => {
      const [st, cls] = status(c);
      const card = el('div', 'req');
      const meta = el('div', 'meta');
      meta.append(el('span', 'chip ' + cls, st), el('span', null, c.uses + ' of ' + c.max_uses + ' used'), el('span', null, c.trial_days + '-day trial'),
        el('span', null, c.expires_at ? 'Use by ' + day(c.expires_at) : 'No last day'), el('span', null, 'Made ' + day(c.created_at) + (c.created_by ? ' by ' + String(c.created_by).split('@')[0] : '')));
      const code = el('b', null, c.code); code.style.cssText = 'font:700 1.15rem/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em';
      card.append(meta, code);
      if (c.note) card.append(el('span', 'muted', c.note));
      const who = people.filter(p => p.code === c.code).map(p => p.name ? p.name + ' (' + p.email + ')' : p.email);
      if (who.length) card.append(el('span', 'muted', 'Used by: ' + who.join(', ')));
      const row = el('div', 'row');
      const b1 = btn('Copy code', '', () => copy(c.code, b1, 'Copy code'));
      const b2 = btn('Copy message to send', '', () => copy(message(c), b2, 'Copy message to send'));
      const b3 = btn('Copy link', '', () => copy(linkFor(c.code), b3, 'Copy link'));
      const b4 = btn(c.active ? 'Turn off' : 'Turn back on', '', async () => {
        b4.disabled = true;
        const {error} = await sb.from('trial_codes').update({active: !c.active}).eq('code', c.code);
        b4.disabled = false;
        if (error){ say('Could not change it (' + (error.code || error.message) + ').'); return; }
        await load();
      });
      const sendRow = el('div', 'row'); sendRow.hidden = true;
      const b5 = btn('Send it', '', () => { if (sendRow.hidden){ sendButtons(sendRow, () => message(c), {how:'share'}); sendRow.hidden = false; } else sendRow.hidden = true; });
      if (st === 'Ready to give out') row.append(b5, b1, b2, b3);
      row.append(b4);
      card.append(row, sendRow);
      box.append(card);
    });

    const pb = $('trPeople'); pb.textContent = '';
    if (!people.length) pb.append(el('p', 'empty', 'Nobody has used a code yet.'));
    people.forEach(p => {
      const ends = new Date(p.ends_at), left = Math.ceil((ends - Date.now()) / 86400000);
      const isPaid = p.paid_until && new Date(p.paid_until) > Date.now();
      const card = el('div', 'req' + (left <= 0 && !p.plan && !isPaid ? ' done' : ''));
      const meta = el('div', 'meta');
      meta.append(...[
        el('span', 'chip ' + (isPaid ? 'ok' : left > 3 ? 'ok' : ''), isPaid ? 'Paid until ' + day(p.paid_until) : left > 0 ? left + (left === 1 ? ' day left' : ' days left') : 'Trial ended ' + day(p.ends_at)),
        el('span', 'chip ' + (p.confirmed ? 'ok' : ''), p.confirmed ? 'Email confirmed' : 'Email not confirmed yet'),
        el('span', null, p.code ? 'Code ' + p.code : 'Open sign-up, no code'), el('span', null, 'Started ' + day(p.started_at)),
        p.last_sign_in ? el('span', null, 'Last in ' + day(p.last_sign_in)) : null].filter(Boolean));
      card.append(meta, el('b', null, (p.name ? p.name + ' · ' : '') + p.email));
      if (p.home_type) card.append(el('span', 'muted', TYPE[p.home_type] || p.home_type));
      if (p.plan){
        const r = el('div', 'reply');
        r.textContent = 'Picked: ' + (PLAN[p.plan] || p.plan) + ' (' + day(p.plan_chosen_at) + ')' + (p.plan_note ? '\n"' + p.plan_note + '"' : '');
        r.style.whiteSpace = 'pre-wrap';
        card.append(r);
      }
      const row = el('div', 'row');
      const ext = btn('Give 7 more days', '', async () => {
        ext.disabled = true;
        const base = Math.max(Date.now(), ends.getTime());
        const {error} = await sb.from('trials').update({ends_at: new Date(base + 7 * 86400000).toISOString()}).eq('email', p.email);
        ext.disabled = false;
        if (error){ say('Could not extend (' + (error.code || error.message) + ').'); return; }
        await load();
      });
      const mail = el('a', 'btn ghost', 'Email them'); mail.style.padding = '.5rem .85rem';
      mail.href = 'mailto:' + encodeURIComponent(p.email) + '?subject=' + encodeURIComponent('Your Steady Shift trial');
      row.append(ext, mail);
      card.append(row);
      pb.append(card);
    });
  }

  function start(client){
    if (sb) { load(); return; }
    sb = client;
    const exp = $('tr-exp');
    if (exp && !exp.value){ const d = new Date(Date.now() + 60 * 86400000); exp.value = d.toISOString().slice(0, 10); }
    $('trShowOff').addEventListener('change', render);
    // make one code for one named person, then offer text / email / share with the message filled in
    const how = $('ts-how'), toWrap = $('ts-toWrap'), to = $('ts-to');
    function howChanged(){
      const v = how.value; toWrap.hidden = !(v === 'text' || v === 'email');
      toWrap.firstChild.textContent = v === 'email' ? 'Their email (optional)' : 'Their phone number (optional)';
      to.inputMode = v === 'email' ? 'email' : 'tel';
    }
    how.addEventListener('change', howChanged); howChanged();
    $('tsForm').addEventListener('submit', async e => {
      e.preventDefault();
      const name = $('ts-name').value.trim().slice(0, 60); if (!name) return;
      const v = how.value, b = $('ts-make');
      const row = {code:newCode(), max_uses:1, trial_days:14, expires_at:new Date(Date.now() + 60 * 86400000).toISOString(),
                   note:(name + (v === 'angelika' ? ' (via Angelika)' : v === 'text' ? ' (sent by text)' : v === 'email' ? ' (sent by email)' : '') + ', made ' + day(new Date())).slice(0, 200)};
      b.disabled = true; b.textContent = 'Making…';
      let {error} = await sb.from('trial_codes').insert(row);
      if (error && String(error.code) === '23505'){ row.code = newCode(); ({error} = await sb.from('trial_codes').insert(row)); }
      b.disabled = false; b.textContent = 'Make code';
      if (error){ say('Could not make the code (' + (error.code || error.message) + ').'); return; }
      $('tsCode').textContent = row.code + ' for ' + name;
      $('tsMsg').value = message(row, name, v === 'angelika');
      sendButtons($('tsBtns'), () => $('tsMsg').value, {how:v, to:to.value});
      $('tsOut').hidden = false; $('tsOut').scrollIntoView({block:'nearest'});
      $('ts-name').value = ''; to.value = '';
      await load();
    });
    $('trForm').addEventListener('submit', async e => {
      e.preventDefault();
      const n = Math.min(50, Math.max(1, parseInt($('tr-count').value, 10) || 1));
      const max_uses = Math.min(500, Math.max(1, parseInt($('tr-uses').value, 10) || 1));
      const trial_days = Math.min(90, Math.max(1, parseInt($('tr-days').value, 10) || 14));
      const expires_at = $('tr-exp').value ? new Date($('tr-exp').value + 'T23:59:59').toISOString() : null;
      const note = $('tr-note').value.trim().slice(0, 200) || null;
      const b = $('tr-make'); b.disabled = true; say('Making ' + n + (n === 1 ? ' code…' : ' codes…'));
      let rows = Array.from({length:n}, () => ({code:newCode(), max_uses, trial_days, expires_at, note}));
      let {error} = await sb.from('trial_codes').insert(rows);
      if (error && String(error.code) === '23505'){ rows = rows.map(r => ({...r, code:newCode()})); ({error} = await sb.from('trial_codes').insert(rows)); }
      b.disabled = false;
      if (error){ say('Could not make codes (' + (error.code || error.message) + ').'); return; }
      say('Made ' + n + (n === 1 ? ' code: ' + rows[0].code + '. Use "Copy message to send" below to share it.' : ' codes. They are at the top of the list below.'));
      $('tr-note').value = '';
      await load();
    });
    load();
  }
  window.SSTrialDesk = {start};
})();
