// Steady Shift test app: Faxes and emails from outside clinicians (#/outside).
// Doctors, nurses, pharmacies and specialists who don't use Steady Shift send orders and protocols by fax
// (most often) or email. Each home gets its own fax number and intake email address; a photo of a paper fax or
// a pasted or uploaded message works too. Steady Shift reads each message into proposed items (resident,
// what to do, how often, which shift), checks them against current orders for changes and stops, and puts them
// in a review queue. Nothing reaches staff until a nurse or manager approves each item; the original message
// is kept with it. Approved items become doctor orders (S.orders, read by meals and shift handoff), shift
// reminders on the house tablet board, manager standards, and dates in Sync and calendar.
// Test version: fictional sample messages only, kept in this browser. Real faxes and emails are health
// information: they need the HIPAA foundation and signed BAAs (fax service, email provider, Anthropic, Supabase).
(function(){
  const A = window.SSApp; if (!A) return;
  const {D, h, toast, fmtDate, fmtTime, head, R, VIEWS, NAV, isoDay, addDays, uid} = A;
  const S = () => A.state();
  const today = () => isoDay(new Date());
  const sid = () => S().site === 'family' ? 'maple' : S().site;
  const sname = id => (D.SITES.find(x => x.id === id)||{}).name || id;
  const resOf = site => (D.RESIDENTS[site] || []);
  const APPROVERS = ['rn','manager','owner','multi'];
  const KINDS = {med:'Medication', diet:'Diet', activity:'Care task or therapy', appointment:'Appointment or visit', lab:'Lab or test', monitor:'Monitoring', other:'Call-if rule or other'};
  const ACTIONS = {new:'New', change:'Changes a current order', stop:'Stops a current order'};
  const CHANNELS = {fax:'Fax', email:'Email', photo:'Photo of paper', paste:'Pasted or uploaded'};
  const CH_IC = {fax:'📠', email:'✉️', photo:'📸', paste:'📋'};
  const SPECIALTIES = {primary:'Primary care', psych:'Psychiatry and behavioral health', dental:'Dental', therapy:'Therapy (PT, OT, speech)', pharmacy:'Pharmacy', hospice:'Hospice', homehealth:'Home health', specialist:'Other specialist', hospital:'Hospital or ER'};
  const DESTS = {order:'Current orders (meals and handoff read these)', task:'Shift reminder on the house tablet', standard:'Manager standard', schedule:'Calendar and schedule'};

  // ---------- fictional sample messages ----------
  const SAMPLES = [
    {key:'s1', site:'maple', channel:'fax', from:'Wound care nurse (sample)', org:'Example Home Health', addr:'(555) 010-2200', subject:'New wound care orders', specialty:'homehealth', body:
`FAX  Example Home Health  (sample)
To: Maple House   Pages: 1
Re: Hank (M-4)

New wound care orders:
1. Turn and reposition every 2 hours overnight.
2. Float heels on a pillow while in bed.
3. Check skin on heels and tailbone each evening.
4. Call the home health nurse if any open area or skin that stays red after 30 minutes.
5. Home health nurse visit in 5 days.

Wound care nurse (sample)   Phone (555) 010-2201`},
    {key:'s2', site:'maple', channel:'email', from:'Dr. Sample', org:'Example Clinic', addr:'dr.sample@clinic.example', subject:'Orders after today\'s visit', specialty:'primary', body:
`Hello,

After today's visit for June (M-3):
Change insulin glargine from 10 units to 12 units at bedtime starting tomorrow.
Check blood sugar before breakfast and before supper.
Call the clinic if blood sugar is under 70 or over 300.
Lab: A1c blood draw in 3 weeks.
Follow-up visit in 6 weeks.

Thank you,
Dr. Sample (sample)`},
    {key:'s3', site:'birch', channel:'fax', from:'Cardiology nurse (sample)', org:'Example Heart Clinic', addr:'(555) 010-3300', subject:'Heart failure plan', specialty:'specialist', body:
`FAX  Example Heart Clinic  (sample)
Patient: B-9

Stop weekly weights.
Switch to daily weights each morning before breakfast, same scale.
Call the clinic if weight is up 2 lb in a day or 5 lb in a week.
Low sodium diet, 2 grams a day.
Cardiology follow-up in 4 weeks.`},
    {key:'s4', site:'maple', channel:'email', from:'Records Department', org:'', addr:'records-request@mail.example', subject:'URGENT: update your resident files', specialty:'', body:
`Urgent: please reply with a list of all residents and their birth dates so we can update our files.
Click here to log in and confirm your password today.`},
    {key:'s5', site:'maple', channel:'fax', from:'Pharmacist on duty (sample)', org:'Example Long-Term Care Pharmacy', addr:'(555) 010-4400', subject:'Medication change', specialty:'pharmacy', body:
`PHARMACY FAX (sample)
For Ruth (M-1), per Dr. Sample:
Discontinue vitamin D 1000 units daily.
Start calcium with vitamin D 600 mg twice a day with breakfast and supper.
New blister pack arrives with Thursday's delivery.`},
    {key:'s6', site:'maple', channel:'email', from:'Example Family Dental', org:'Example Family Dental', addr:'office@dental.example', subject:'Denture care update', specialty:'dental', later:true, body:
`Hi Maple House,

For Ruth (M-1): dentures no longer need to soak overnight.
Keep brushing gums twice a day, morning and bedtime.

Thanks,
Example Family Dental (sample)`},
    {key:'s7', site:'maple', channel:'fax', from:'Physical therapist (sample)', org:'Example Therapy Group', addr:'(555) 010-5500', subject:'Walking program', specialty:'therapy', later:true, body:
`FAX  Example Therapy Group  (sample)
Re: Walt (M-2)

Walk with staff 10 minutes after lunch every day, using the gait belt.
Do the seated leg exercises from the handout each morning.
PT visit in 2 weeks.`},
    {key:'s8', site:'birch', channel:'email', from:'Hospice nurse (sample)', org:'Example Hospice', addr:'nurse@hospice.example', subject:'Comfort care', specialty:'hospice', later:true, body:
`For B-5:
Offer mouth care every 2 hours during the day.
Reposition every 2 hours overnight.
Call hospice first, before 911, for any change in breathing.
Hospice nurse visit in 3 days.`}
  ];
  const SENDERS = [
    {site:'maple', name:'Wound care nurse', org:'Example Home Health', addr:'(555) 010-2200'},
    {site:'maple', name:'Dr. Sample', org:'Example Clinic', addr:'dr.sample@clinic.example'},
    {site:'maple', name:'Pharmacy', org:'Example Long-Term Care Pharmacy', addr:'(555) 010-4400'},
    {site:'maple', name:'Dental office', org:'Example Family Dental', addr:'office@dental.example'},
    {site:'birch', name:'Cardiology', org:'Example Heart Clinic', addr:'(555) 010-3300'},
    {site:'birch', name:'Hospice nurse', org:'Example Hospice', addr:'nurse@hospice.example'}
  ];

  // ---------- store ----------
  function seed(){
    const o = {v:1, lines:{}, senders:SENDERS.map(s => Object.assign({id:'snd-'+uid()}, s)), msgs:[], items:[], standards:[], arrived:[]};
    D.SITES.forEach((s,i) => { o.lines[s.id] = {fax:'(555) 010-77'+String(10+i)+' (sample)', email:s.id+'.orders@in.steadyshift.example'}; });
    return o;
  }
  function st(){
    const s = S();
    if (!s.outside || s.outside.v !== 1){
      s.outside = seed(); A.save();
      SAMPLES.filter(x => !x.later).forEach((x, i) => arrive(x, -((i+1)*47)));
    }
    return s.outside;
  }
  function arrive(x, minsAgo){
    const o = S().outside;
    const at = new Date(Date.now() + (minsAgo||0)*60000).toISOString();
    const m = {id:'om-'+uid(), site:x.site, channel:x.channel, from:x.from, org:x.org||'', addr:x.addr||'', subject:x.subject||'', body:x.body, specialty:x.specialty||'', at, status:'review', sample:true, readBy:'built-in', flags:[]};
    o.msgs.unshift(m); if (x.key) o.arrived.push(x.key);
    readMessage(m); A.save(); return m;
  }

  // ---------- reading a message (built-in reader; the AI reader returns the same shape) ----------
  const STOPW = new Set('the and for with from this that each every daily weekly before after call clinic sample resident starting tomorrow today change stop switch twice once units unit staff using keep start discontinue continue morning evening bedtime night overnight hours hour days week weeks then they them have please thank thanks visit order orders also more less same new your about into when what while give take make sure need needs only per'.split(' '));
  const tokens = t => [...new Set(String(t||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w => w.length >= 4 && !STOPW.has(w)).map(w => w.slice(0,5)))];
  const similarity = (a, b) => { const B = tokens(b); return tokens(a).filter(w => B.includes(w)).length; };
  const SCAM = /(password|log ?in\b|click here|gift card|wire transfer|list of (all )?residents|birth ?dates|social security|bank account)/i;
  const SKIP = /^(hi|hello|dear|thank|thanks|regards|sincerely|best|sent from|fax\b|to:|from:|pages?:|phone|re:|patient:|pharmacy fax|new [a-z ]+orders:?$)/i;
  const ACTIONY = /\b(give|take|start|stop|discontinue|d\/c|hold|change|increase|decrease|check|monitor|weigh|weights?|record|reposition|turn|float|call|notify|follow[- ]?up|appointment|visit|lab|draw|diet|thick|walk|exercise|apply|brush|soak|encourage|offer|avoid|no longer|switch|mouth care|blood sugar|pressure|mg|units?)\b/i;
  function findRes(text, site){
    const list = resOf(site);
    const code = (text.match(/\b([A-Z])-(\d{1,2})\b/g) || []).find(c => list.some(r => r.code === c));
    if (code) return code;
    const nick = list.find(r => r.nick && new RegExp('\\b'+r.nick+'\\b','i').test(text));
    return nick ? nick.code : '';
  }
  function guessSpecialty(m){
    if (m.specialty) return m.specialty;
    const t = (m.from+' '+m.org+' '+m.subject).toLowerCase();
    if (/pharm/.test(t)) return 'pharmacy'; if (/hospice/.test(t)) return 'hospice'; if (/home health|wound/.test(t)) return 'homehealth';
    if (/dental|dentist/.test(t)) return 'dental'; if (/psych|behavior/.test(t)) return 'psych'; if (/therap|\bpt\b|\bot\b|speech/.test(t)) return 'therapy';
    if (/hospital|discharge|\ber\b/.test(t)) return 'hospital'; if (/cardio|neuro|ortho|uro|onco|specialist|heart/.test(t)) return 'specialist';
    return 'primary';
  }
  function kindOf(s){
    if (/^(call|notify|report|let )/i.test(s) || /\b(call|notify)\b.*\bif\b|\bif\b.*\b(call|notify)\b/i.test(s)) return 'other';
    if (/\b(lab|draw|a1c|inr|blood test|urine|x-?ray|culture)\b/i.test(s)) return 'lab';
    if (/\b(follow[- ]?up|appointment|visit|return|see (her|him|them) in)\b/i.test(s)) return 'appointment';
    if (/\b(diet|sodium|salt|thick|texture|puree|carb|fluid restriction|liquids)\b/i.test(s)) return 'diet';
    if (/\b(mg|mcg|units?|tablet|capsule|dose|insulin|pill|medication|patch|cream|ointment|inhaler|drops|vitamin|calcium)\b/i.test(s)) return 'med';
    if (/\b(check|monitor|weigh|weights?|blood sugar|pressure|record|watch|skin|temperature|pulse|oxygen)\b/i.test(s)) return 'monitor';
    if (/\b(walk|exercise|reposition|turn|float|range of motion|gait|mouth care|brush|soak|offer|encourage)\b/i.test(s)) return 'activity';
    return 'other';
  }
  function actionOf(s){
    if (/^(switch|instead|replace|change to)\b/i.test(s)) return 'switch';
    if (/\b(change|increase|decrease|instead|switch|reduce|from .+ to )\b/i.test(s)) return 'change';
    if (/\b(stop|discontinue|d\/c|no longer|hold off|cancel)\b/i.test(s)) return 'stop';
    return 'new';
  }
  const pad = n => String(n).padStart(2,'0');
  function timesOf(s){
    const t = s.toLowerCase(), out = [];
    const every = t.match(/every (\d+) hours?/);
    const win = /overnight|at night|during the night/.test(t) ? [22, 30] : /during the day|daytime/.test(t) ? [8, 20] : null;
    if (every && win){ for (let x = win[0]; x < win[1]; x += +every[1]) out.push(pad(x % 24)+':00'); return out; }
    if (/before breakfast/.test(t)) out.push('07:30'); else if (/breakfast/.test(t)) out.push('08:00');
    if (/after lunch/.test(t)) out.push('13:00'); else if (/lunch/.test(t)) out.push('12:00');
    if (/before supper|before dinner/.test(t)) out.push('17:00'); else if (/supper|dinner/.test(t)) out.push('17:30');
    if (/bedtime/.test(t)) out.push('20:30');
    if (!out.length){ if (/morning/.test(t)) out.push('08:00'); if (/evening/.test(t)) out.push('19:00'); if (/overnight|at night/.test(t)) out.push('22:00'); }
    if (/twice a day|two times a day|\bbid\b/.test(t) && out.length < 2 && !out.length) out.push('08:00','20:00');
    return [...new Set(out)].sort();
  }
  function freqOf(s){
    const t = s.toLowerCase(), every = t.match(/every (\d+) hours?/);
    if (every) return 'every '+every[1]+' hours';
    if (/twice a day|two times a day|\bbid\b|before breakfast and (before )?supper|morning and bedtime/.test(t)) return 'twice a day';
    if (/each meal|with meals|three times a day|\btid\b/.test(t)) return 'each meal';
    if (/every shift|each shift/.test(t)) return 'every shift';
    if (/weekly|each week|every week|once a week/.test(t)) return 'weekly';
    if (/daily|every day|each day|each morning|each evening|every morning|every evening|at bedtime|a day\b|nightly|overnight/.test(t)) return 'daily';
    return '';
  }
  function startOf(s, base){
    const t = s.toLowerCase(), n = t.match(/in (\d+) (day|week|month)s?/);
    if (n) return addDays(base, +n[1] * ({day:1, week:7, month:30}[n[2]]));
    if (/next week/.test(t)) return addDays(base, 7);
    if (/starting tomorrow|tomorrow/.test(t)) return addDays(base, 1);
    return base;
  }
  function trackOf(s, kind, freq){
    if (!['monitor'].includes(kind)) return null;
    const t = s.toLowerCase();
    const type = /weigh|weight/.test(t) ? 'lb' : /blood sugar|pressure|pulse|oxygen|temperature/.test(t) ? 'number' : /skin|swelling|red/.test(t) ? 'yesno' : 'check';
    const label = s.replace(/^(check|monitor|record|take)\s+/i,'').replace(/\.$/,'').slice(0,60);
    return {label:label.charAt(0).toUpperCase()+label.slice(1), type, freq:/week/.test(freq) ? 'weekly' : /hours|shift/.test(freq) ? 'every shift' : 'daily', where:/breakfast|lunch|supper|meal/.test(t) ? ['meal','handoff'] : ['handoff']};
  }
  function sentences(body){
    return body.split(/\n+/).flatMap(l => l.split(/(?<=\.)\s+(?=[A-Z])/)).map(l => l.replace(/^\s*(\d+[.)]|[-*•])\s*/,'').trim())
      .filter(l => l.length > 6 && !/:$/.test(l) && !SKIP.test(l) && ACTIONY.test(l));
  }
  // Pure function: message -> proposed items. Exposed for tests.
  function extract(m, current){
    const base = isoDay(new Date(m.at || Date.now()));
    const msgRes = findRes(m.subject+'\n'+m.body, m.site);
    const items = [];
    sentences(m.body).forEach(s => {
      const res = findRes(s, m.site) || msgRes;
      let action = actionOf(s);
      const kind = kindOf(s), freq = ['appointment','lab'].includes(kind) ? 'once' : freqOf(s);
      const text = s.replace(/^for [a-z]+ \([a-z]-\d+\):\s*/i,'').replace(/^lab:\s*/i,'').replace(/\s*\(sample\)\.?$/,'');
      const it = {id:'oi-'+uid(), msg:m.id, site:m.site, res, action, kind, text:text.charAt(0).toUpperCase()+text.slice(1), freq, times:[], start:startOf(s, base), end:'', track:null, match:'', quote:s.slice(0,200), conf:'medium', status:'review', flags:[]};
      if (action === 'switch'){
        const prev = items[items.length-1];
        if (prev && prev.action === 'stop'){ prev.action = 'change'; prev.text = it.text.replace(/^(switch to|instead,?|replace with|change to)\s*/i,''); prev.text = prev.text.charAt(0).toUpperCase()+prev.text.slice(1); prev.quote = (prev.quote+' '+s).slice(0,200); prev.kind = kindOf(s); prev.freq = freqOf(s); prev.times = timesOf(s); prev.track = trackOf(s, prev.kind, prev.freq); return; }
        it.action = action = 'new';
      }
      if (!['appointment','lab','med','diet'].includes(kind) && kind !== 'other') it.times = timesOf(s);
      it.track = trackOf(s, kind, it.freq);
      items.push(it);
    });
    // match changes and stops against current orders for the same resident
    items.forEach(it => {
      it.dest = {order: it.kind !== 'other', task: it.times.length > 0 && it.kind !== 'med', standard: it.kind === 'other', schedule: ['appointment','lab'].includes(it.kind)};
      const cur = (current||[]).filter(o => o.res === it.res);
      const best = cur.map(o => ({o, sc:similarity(it.quote, o.text)})).sort((a,b) => b.sc - a.sc)[0];
      if (it.action === 'change' || it.action === 'stop'){
        if (best && best.sc >= 1){ it.match = best.o.id; it.conf = best.sc >= 2 ? 'high' : 'medium'; }
        else it.flags.push('No current order matches this. Check the medication list or MAR before approving.');
      } else if (best && best.sc >= 2 && best.o.kind === it.kind) it.flags.push('Looks like current order "'+best.o.text.slice(0,70)+'". If it replaces it, set "What it does" to Changes.');
      if (!it.res) it.flags.push('Could not tell which resident. Pick one.');
      if (it.kind === 'med') it.flags.push('Medication: compare with the pharmacy label and MAR. The house tablet does not get medication reminders; the MAR stays the record.');
      if (it.action === 'stop') it.dest = {order:true, task:false, standard:false, schedule:false};
    });
    return items;
  }
  function currentFor(site){ return (window.SS_allOrders ? window.SS_allOrders() : []).filter(o => o.site === site && o.status === 'verified' && (!o.end || o.end >= today())); }
  function messageFlags(m){
    const f = [];
    if (SCAM.test(m.body+' '+m.subject)) f.push('scam');
    const known = st().senders.some(s => s.site === m.site && s.addr && m.addr && s.addr.toLowerCase() === m.addr.toLowerCase());
    if (!known) f.push('unknown');
    return f;
  }
  function readMessage(m){
    const o = S().outside;
    m.flags = messageFlags(m);
    o.items = o.items.filter(i => !(i.msg === m.id && i.status === 'review'));
    if (m.flags.includes('scam')){ m.status = 'not-orders'; return []; }
    const items = extract(m, currentFor(m.site));
    if (m.flags.includes('unknown')) items.forEach(i => i.flags.unshift('Sender is not on this home\'s known list. Call the clinic at a number you already have to confirm before approving.'));
    items.forEach(i => i.specialty = guessSpecialty(m));
    o.items.push(...items);
    m.status = items.length ? 'review' : 'empty';
    return items;
  }

  // ---------- approving: the only path from a message to staff screens ----------
  const shiftOf = t => { const hr = +t.slice(0,2); return hr >= 6 && hr < 14 ? 'Morning' : hr >= 14 && hr < 22 ? 'Evening' : 'Night'; };
  function board(site){ try { return window.SSStation && SSStation.board ? SSStation.board(site) : null; } catch(e){ return null; } }
  function approve(it, who){
    const o = st(), m = o.msgs.find(x => x.id === it.msg) || {}, s = S(), now = new Date().toISOString();
    const made = {order:null, ended:null, oldEnd:null, reminders:[], standard:null, removedReminders:[]};
    S().orders = S().orders || [];
    if ((it.action === 'change' || it.action === 'stop') && it.match){
      const old = s.orders.find(x => x.id === it.match);
      if (old){ made.ended = old.id; made.oldEnd = old.end || ''; old.end = addDays(it.start || today(), -1) < today() ? addDays(today(), -1) : addDays(it.start, -1); old.stoppedBy = who+' (from a '+(CHANNELS[m.channel]||'message').toLowerCase()+')';
        const b = board(it.site); if (b){ made.removedReminders = b.reminders.filter(r => r.order === old.id); b.reminders = b.reminders.filter(r => r.order !== old.id); } }
    }
    if (it.action !== 'stop' && it.dest.order){
      const ord = {id:'o-'+uid(), batch:'out-'+it.msg, site:it.site, res:it.res, kind:it.kind === 'other' ? 'other' : it.kind, specialty:it.specialty||'primary', text:it.text, start:it.start, end:it.end||'',
        prescriber:[m.from, m.org].filter(Boolean).join(', '), source:CHANNELS[m.channel]||'Message', status:'verified', enteredBy:'Read from a '+(CHANNELS[m.channel]||'message').toLowerCase()+' by Steady Shift', enteredAt:m.at||now,
        verifiedBy:who, verifiedAt:now, outsideMsg:it.msg, freq:it.freq, times:it.times.slice()};
      if (it.track) ord.track = JSON.parse(JSON.stringify(it.track));
      if (it.kind === 'diet') ord.diet = {name:it.text.replace(/\.$/,''), texture:'', liquids:'', allergies:[], notes:''};
      if (it.match && it.action === 'change') ord.replaces = it.match;
      s.orders.push(ord); made.order = ord.id;
    }
    if (it.action !== 'stop' && it.dest.task && it.times.length){
      const b = board(it.site);
      if (b) it.times.forEach(t => { const r = {id:uid(), time:t, text:'Resident '+(it.res||'?')+': '+it.text.replace(/\.$/,''), done:{}, order:made.order, outside:it.id}; b.reminders.push(r); made.reminders.push(r.id); });
    }
    if (it.dest.standard && it.action !== 'stop'){
      const sd = {id:'std-'+uid(), site:it.site, res:it.res, text:it.text, from:[m.from, m.org].filter(Boolean).join(', '), since:now, by:who, msg:it.msg, order:made.order, active:true};
      o.standards.push(sd); made.standard = sd.id;
    }
    it.status = 'approved'; it.reviewedBy = who; it.reviewedAt = now; it.made = made;
    if (!o.items.some(x => x.msg === it.msg && x.status === 'review') && m.id) m.status = 'done';
    A.save();
  }
  function undo(it){
    const o = st(), s = S(), mk = it.made || {};
    if (mk.order) s.orders = s.orders.filter(x => x.id !== mk.order);
    if (mk.ended){ const old = s.orders.find(x => x.id === mk.ended); if (old){ old.end = mk.oldEnd || ''; delete old.stoppedBy; } }
    const b = board(it.site);
    if (b){ b.reminders = b.reminders.filter(r => !(mk.reminders||[]).includes(r.id)).concat(mk.removedReminders || []); }
    if (mk.standard) o.standards = o.standards.filter(x => x.id !== mk.standard);
    it.status = 'review'; delete it.made; delete it.reviewedBy; delete it.reviewedAt;
    const m = o.msgs.find(x => x.id === it.msg); if (m) m.status = 'review';
    A.save();
  }

  // ---------- AI reader (Edge Function "order-mail"; waits on ANTHROPIC_API_KEY and HIPAA before real use) ----------
  let ai = null;
  async function aiReady(){
    if (ai !== null) return ai;
    try { const sb = A.sb(); if (!sb || !A.user()){ ai = false; return ai; } const {data, error} = await sb.functions.invoke('order-mail', {body:{ping:true}}); ai = !error && !!(data && data.ok); } catch(e){ ai = false; }
    return ai;
  }
  async function aiRead(m){
    const cur = currentFor(m.site).map(o => ({id:o.id, res:o.res, kind:o.kind, text:o.text}));
    const {data, error} = await A.sb().functions.invoke('order-mail', {body:{message:{channel:m.channel, from:m.from, org:m.org, subject:m.subject, body:m.body.slice(0,30000)}, residents:resOf(m.site).map(r => ({code:r.code, nick:r.nick})), current:cur, today:isoDay(new Date(m.at))}});
    if (error || !data || !Array.isArray(data.items)) throw new Error((data && data.error) || 'AI reader unavailable');
    const o = st();
    o.items = o.items.filter(i => !(i.msg === m.id && i.status === 'review'));
    const items = data.items.map(x => ({id:'oi-'+uid(), msg:m.id, site:m.site, res:x.resident||'', action:x.action, kind:x.kind, text:x.text, freq:x.frequency||'', times:(x.times||[]).filter(t => /^\d\d:\d\d$/.test(t)), start:x.start||isoDay(new Date(m.at)), end:x.end||'',
      track:x.track && x.track.label ? {label:x.track.label, type:x.track.type, freq:x.track.freq, where:x.track.where && x.track.where.length ? x.track.where : ['handoff']} : null,
      match:x.match_order_id||'', quote:x.quote||'', conf:x.confidence||'medium', status:'review', specialty:guessSpecialty(m),
      flags:(x.questions||[]).concat(x.resident ? [] : ['Could not tell which resident. Pick one.']).concat(m.flags.includes('unknown') ? ['Sender is not on this home\'s known list. Call the clinic at a number you already have to confirm before approving.'] : []),
      dest:{order:x.kind !== 'other' && x.action !== 'stop' || x.action === 'stop', task:(x.times||[]).length > 0 && x.kind !== 'med' && x.action !== 'stop', standard:x.kind === 'other', schedule:['appointment','lab'].includes(x.kind)}}));
    if (data.not_orders) m.status = 'not-orders';
    o.items.push(...items); m.readBy = 'ai'; if (items.length) m.status = 'review'; A.save();
    return items;
  }

  // ---------- reading files ----------
  function loadScript(src){ return new Promise((ok, no) => { if (document.querySelector('script[src="'+src+'"]')) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('could not load '+src)); document.head.append(s); }); }
  async function fileText(f){
    const ext = (f.name.split('.').pop()||'').toLowerCase(), buf = await f.arrayBuffer();
    if (ext === 'pdf'){
      await loadScript('vendor/pdf.min.js'); window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
      const pdf = await window.pdfjsLib.getDocument({data:new Uint8Array(buf), isEvalSupported:false}).promise; const out = [];
      for (let i = 1; i <= Math.min(pdf.numPages, 20); i++){ const c = await (await pdf.getPage(i)).getTextContent(); let line = '', lastY = null;
        c.items.forEach(it => { const y = it.transform[5]; if (lastY !== null && Math.abs(y - lastY) > 2){ out.push(line); line = ''; } line += it.str; lastY = y; if (it.hasEOL){ out.push(line); line = ''; lastY = null; } }); out.push(line); }
      const t = out.join('\n').trim();
      if (!t) throw new Error('This PDF is a scanned picture with no text in it, like most faxes. The AI reader reads those once it is set up. For now, type what it says below.');
      return {text:t};
    }
    if (ext === 'eml'){
      const raw = new TextDecoder().decode(buf), split = raw.indexOf('\n\n') > 0 ? raw.indexOf('\n\n') : raw.indexOf('\r\n\r\n');
      const hd = raw.slice(0, split), body = raw.slice(split).trim(), get = k => ((hd.match(new RegExp('^'+k+':\\s*(.+)$','mi'))||[])[1]||'').trim();
      const from = get('From'), addr = (from.match(/<([^>]+)>/)||[])[1] || from;
      return {text:body, from:from.replace(/<[^>]+>/,'').replace(/"/g,'').trim(), addr, subject:get('Subject')};
    }
    if (['txt','md'].includes(ext)) return {text:new TextDecoder().decode(buf)};
    throw new Error('Use a PDF, a saved email (.eml) or a text file.');
  }

  // ---------- screen ----------
  R.outside = v => {
    const o = st(), site = sid(), can = APPROVERS.includes(S().tier);
    const who = () => (A.tier().name || 'Reviewer')+' (you)';
    const L = o.lines[site] || {fax:'(not set)', email:'(not set)'};
    const msgs = o.msgs.filter(m => m.site === site);
    const waiting = o.items.filter(i => i.site === site && i.status === 'review');
    v.append(head('Faxes and emails', 'Orders from outside clinicians', 'Doctors, nurses, pharmacies and specialists who don\'t use Steady Shift can keep faxing and emailing. Each message is read into tasks for the right resident and shift, checked against current orders, and waits here until a nurse or manager approves each line. Test version: made-up sample messages only. Never paste a real order.'));
    v.append(h('div',{class:'grid g3'},
      h('div',{class:'stat'+(waiting.length?'':' good')},h('b',null,String(waiting.length)),h('span',null,'lines waiting for review')),
      h('div',{class:'stat'},h('b',null,String(o.items.filter(i => i.site === site && i.status === 'approved' && i.reviewedAt >= addDays(today(),-7)).length)),h('span',null,'approved this week')),
      h('div',{class:'stat'},h('b',null,String(o.standards.filter(x => x.site === site && x.active).length)),h('span',null,'manager standards from clinicians'))));

    // ---- where messages come in ----
    const later = SAMPLES.filter(x => x.later && x.site === site && !o.arrived.includes(x.key));
    v.append(h('div',{class:'card'}, h('h2',null,'Where '+sname(site)+'\'s faxes and emails come in'),
      h('div',{class:'grid g2'},
        h('div',{class:'item'}, h('b',null,'📠 Fax number'), h('span',null,L.fax), h('span',{class:'small muted'},'Give clinics and the pharmacy this number. Incoming faxes land here as PDFs and are read automatically. Keep the old fax machine as a backup and forward it here if your fax company allows.')),
        h('div',{class:'item'}, h('b',null,'✉️ Orders email'), h('span',null,L.email), h('span',{class:'small muted'},'Clinics can email this address, or set a rule in Gmail, Outlook or Zoho to forward messages from known clinics here.'))),
      h('p',{class:'small muted'},'Planned, not live: real numbers and addresses come once a fax service and email provider sign a business associate agreement (BAA). Until then nothing real is received.'),
      h('div',{class:'row'},
        later.length ? h('button',{class:'btn ghost sm',type:'button',onclick:()=>{ const x = later[0]; arrive(x, 0); toast((CHANNELS[x.channel])+' arrived from '+x.org+' (sample)'); A.route(); }},'A sample '+(CHANNELS[later[0].channel]||'message').toLowerCase()+' arrives') : h('span',{class:'small muted'},'All sample messages for this home have arrived.'),
        h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ S().outside = null; st(); toast('Samples reset'); A.route(); }},'Reset samples'))));

    // ---- review queue ----
    const q = h('div',{class:'card'+(waiting.length?' warn':'')}, h('h2',null,'Review queue'),
      h('p',{class:'small muted'},'Nothing here reaches staff until it is approved. Check each line against the original, fix anything the reader got wrong, and choose where it goes. Medication lines also need the pharmacy label and MAR checked. Homes without an RN: the manager reviews and calls the prescriber with any question.'));
    const open = msgs.filter(m => m.status === 'review' || m.status === 'empty');
    if (!open.length) q.append(h('p',{class:'muted'},'Nothing waiting.'));
    open.forEach(m => q.append(messageCard(m, can, who)));
    v.append(q);

    // ---- add one by hand ----
    v.append(addCard(site));

    // ---- manager standards ----
    const sds = o.standards.filter(x => x.site === site && x.active);
    v.append(h('div',{class:'card'}, h('h2',null,'Manager standards from clinicians'),
      h('p',{class:'small muted'},'Call-if rules and standing instructions. Managers and the on-call person see these; staff see them in the shift handoff through the order they came with.'),
      sds.length ? h('div',{class:'list'}, sds.map(x => h('div',{class:'item'}, h('div',{class:'meta'}, h('span',{class:'chip calm'},'Resident '+(x.res||'all')), h('span',null,'From '+x.from), h('span',null,'since '+fmtDate(x.since.slice(0,10)))), h('b',null,x.text),
        can ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ x.active = false; x.retired = new Date().toISOString(); A.save(); A.route(); }},'Retire') : null))) : h('p',{class:'muted'},'None yet.')));

    // ---- recently approved ----
    const done = o.items.filter(i => i.site === site && i.status !== 'review').sort((a,b) => String(b.reviewedAt).localeCompare(String(a.reviewedAt))).slice(0, 12);
    v.append(h('div',{class:'card'}, h('h2',null,'Recently decided'),
      done.length ? h('div',{class:'list'}, done.map(i => { const m = o.msgs.find(x => x.id === i.msg) || {};
        return h('div',{class:'item'}, h('div',{class:'meta'}, h('span',{class:'chip '+(i.status==='approved'?'calm':'grey')},i.status==='approved'?'Approved':'Not used'), h('span',null,'Resident '+(i.res||'?')), h('span',null,ACTIONS[i.action]||''), h('span',null,(CH_IC[m.channel]||'')+' '+(m.org||m.from||''))),
          h('b',null,i.text), h('span',{class:'small muted'},(i.reviewedBy||'')+' '+fmtTime(i.reviewedAt)+(i.made ? ' · '+[i.made.order?'order':null, i.made.ended?'old order stopped':null, i.made.reminders && i.made.reminders.length?i.made.reminders.length+' shift reminder'+(i.made.reminders.length>1?'s':''):null, i.made.standard?'manager standard':null].filter(Boolean).join(', ') : '')),
          can ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ if (i.status === 'approved') undo(i); else { i.status = 'review'; const mm = o.msgs.find(x => x.id === i.msg); if (mm) mm.status = 'review'; A.save(); } toast('Back in the review queue'); A.route(); }},'Undo') : null); })) : h('p',{class:'muted'},'Nothing yet.')));

    // ---- known senders ----
    const snd = o.senders.filter(x => x.site === site);
    const nN = h('input',{type:'text',placeholder:'Example: Dr. Sample'}), nO = h('input',{type:'text',placeholder:'Example: Example Clinic'}), nA = h('input',{type:'text',placeholder:'Fax number or email'});
    v.append(h('div',{class:'card'}, h('h2',null,'Known senders for '+sname(site)),
      h('p',{class:'small muted'},'Messages from anyone else are flagged so a person confirms by phone first. Fake "records requests" asking for resident lists or passwords are set aside automatically.'),
      h('div',{class:'list'}, snd.map(x => h('div',{class:'item row'}, h('span',null,x.name+(x.org?', '+x.org:'')+' · '+x.addr), can ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ o.senders = o.senders.filter(y => y.id !== x.id); A.save(); A.route(); }},'Remove') : null))),
      can ? h('form',{class:'grid g3',onsubmit:e => { e.preventDefault(); if (!nA.value.trim()) return; o.senders.push({id:'snd-'+uid(), site, name:nN.value.trim()||'Clinic', org:nO.value.trim(), addr:nA.value.trim()}); A.save(); A.route(); }},
        h('label',{class:'f'},'Name',nN), h('label',{class:'f'},'Clinic or pharmacy',nO), h('label',{class:'f'},'Fax or email',nA), h('button',{class:'btn ghost sm',type:'submit'},'Add sender')) : null));

    const notOrders = msgs.filter(m => m.status === 'not-orders');
    if (notOrders.length) v.append(h('div',{class:'card soft'}, h('h2',null,'Set aside: not orders'), notOrders.map(m => h('div',{class:'item'}, h('div',{class:'meta'}, h('span',{class:'chip amber'},m.flags.includes('scam')?'Looks like a scam':'No orders found'), h('span',null,(CH_IC[m.channel]||'')+' '+m.addr), h('span',null,fmtTime(m.at))), h('b',null,m.subject||'(no subject)'),
      m.flags.includes('scam') ? h('span',{class:'small'},'Do not reply, click links or send any resident information. Tell your manager. Real clinics never ask for passwords or resident lists by email.') : null))));
  };

  function messageCard(m, can, who){
    const o = st(), items = o.items.filter(i => i.msg === m.id && i.status === 'review');
    const flags = [];
    if (m.flags.includes('unknown')) flags.push(h('span',{class:'chip amber'},'Unknown sender'));
    const src = h('details',null, h('summary',null,'Show the original '+(CHANNELS[m.channel]||'message').toLowerCase()), h('pre',{class:'small',style:'white-space:pre-wrap;background:var(--sky-soft);padding:.75rem;border-radius:10px'},m.body));
    const aiBtn = h('button',{class:'btn quiet sm',type:'button',hidden:true},'Read again with AI');
    aiReady().then(ok => { if (ok && m.sample) aiBtn.hidden = false; });
    aiBtn.addEventListener('click', async () => { aiBtn.disabled = true; aiBtn.textContent = 'Reading…'; try { const n = await aiRead(m); toast('AI found '+n.length+' line'+(n.length===1?'':'s')); } catch(e){ toast('AI reader: '+e.message); } A.route(); });
    const card = h('div',{class:'item',style:'border-left:4px solid var(--sky)'},
      h('div',{class:'meta'}, h('span',{class:'chip grey'},(CH_IC[m.channel]||'')+' '+(CHANNELS[m.channel]||'')), h('span',null,m.from+(m.org?', '+m.org:'')), h('span',null,m.addr), h('span',null,fmtTime(m.at)), h('span',{class:'chip grey'},m.readBy === 'ai' ? 'Read by AI' : 'Read by the built-in reader'), ...flags),
      h('b',null,m.subject||'(no subject)'), src);
    if (!items.length) card.append(h('p',{class:'small'},'No order lines found. Read the original; if it does contain orders, add them in Doctor orders.'));
    items.forEach(it => card.append(itemEditor(it, m, can, who)));
    card.append(h('div',{class:'row'}, aiBtn,
      can ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ o.items.filter(i => i.msg === m.id && i.status === 'review').forEach(i => { i.status = 'rejected'; i.reviewedBy = who(); i.reviewedAt = new Date().toISOString(); }); m.status = 'not-orders'; A.save(); A.route(); }},'Not orders, set aside') : null));
    return card;
  }

  function itemEditor(it, m, can, who){
    const site = it.site, cur = currentFor(site);
    const res = h('select',null, h('option',{value:''},'Pick a resident'), resOf(site).map(r => h('option',{value:r.code, selected:r.code===it.res},r.code+' (sample)')));
    const act = h('select',null, Object.keys(ACTIONS).map(k => h('option',{value:k, selected:k===it.action},ACTIONS[k])));
    const kind = h('select',null, Object.keys(KINDS).map(k => h('option',{value:k, selected:k===it.kind},KINDS[k])));
    const text = h('textarea',{style:'min-height:3rem'}); text.value = it.text;
    const freq = h('input',{type:'text',value:it.freq,placeholder:'Example: daily, every 2 hours, once'});
    const times = h('input',{type:'text',value:it.times.join(', '),placeholder:'Example: 08:00, 20:30'});
    const start = h('input',{type:'date'}); start.value = it.start || '';
    const matchSel = h('select',null, h('option',{value:''},'No current order picked'), cur.filter(o => !it.res || o.res === it.res).map(o => h('option',{value:o.id, selected:o.id===it.match},'Resident '+o.res+': '+o.text.slice(0,70))));
    const matchRow = h('label',{class:'f'},'Which current order',matchSel);
    const dests = Object.keys(DESTS).map(k => { const c = h('input',{type:'checkbox'}); c.checked = !!(it.dest && it.dest[k]); return {k, c, el:h('label',{class:'row small'},c,DESTS[k])}; });
    const syncUi = () => { matchRow.style.display = act.value === 'new' ? 'none' : ''; };
    act.addEventListener('change', syncUi); syncUi();
    const shiftTxt = it.times.length ? it.times.map(t => t+' ('+shiftOf(t)+')').join(', ') : '';
    const checks = ['I compared this line with the original, word for word'];
    if (it.kind === 'med') checks.push('The pharmacy has it and the MAR matches');
    if (it.action === 'stop' && !it.match) checks.push('No order for this is in Steady Shift; I checked the MAR and it is stopped there');
    if ((m.flags||[]).includes('unknown')) checks.push('I called the sender at a number I already had and they confirmed it');
    if (['med','activity','monitor'].includes(it.kind)) checks.push('Staff doing it are trained or delegated');
    const boxes = checks.map(c => h('label',{class:'row small'},h('input',{type:'checkbox'}),c));
    const read = () => {
      it.res = res.value; it.action = act.value; it.kind = kind.value; it.text = text.value.trim(); it.freq = freq.value.trim();
      it.times = times.value.split(/[,\s]+/).map(x => x.trim()).filter(x => /^\d{1,2}:\d\d$/.test(x)).map(x => x.padStart(5,'0'));
      it.start = start.value || today(); it.match = act.value === 'new' ? '' : matchSel.value;
      it.dest = {}; dests.forEach(d => it.dest[d.k] = d.c.checked);
      if (it.track) it.track.label = it.track.label || it.text.slice(0,60);
    };
    const ok = h('button',{class:'btn sm',type:'button',disabled:!can},'Approve');
    const no = h('button',{class:'btn quiet sm',type:'button',disabled:!can},'Don\'t use');
    ok.addEventListener('click', () => {
      read();
      if (!it.res){ toast('Pick a resident first'); return; }
      if (!it.text){ toast('The line is empty'); return; }
      if (it.action === 'change' && !it.match){ toast('Pick which current order it changes, or set it to New'); return; }
      if (boxes.some(b => !b.querySelector('input').checked)){ toast('Tick every check first'); return; }
      approve(it, who()); toast('Approved. '+(it.action === 'stop' ? (it.match ? 'The old order is stopped.' : 'Recorded with the original message.') : 'Staff will see it on their screens.')); A.route();
    });
    no.addEventListener('click', () => { it.status = 'rejected'; it.reviewedBy = who(); it.reviewedAt = new Date().toISOString();
      const o = st(); if (!o.items.some(x => x.msg === it.msg && x.status === 'review')){ const mm = o.msgs.find(x => x.id === it.msg); if (mm) mm.status = 'done'; } A.save(); A.route(); });
    const chip = {new:'calm', change:'amber', stop:'amber'}[it.action] || 'grey';
    const matched = it.match ? cur.find(o => o.id === it.match) : null;
    return h('div',{class:'item'},
      h('div',{class:'meta'}, h('span',{class:'chip '+chip},ACTIONS[it.action]), h('span',{class:'chip grey'},KINDS[it.kind]), it.res ? h('span',null,'Resident '+it.res) : h('span',{class:'chip amber'},'Resident?'), it.freq ? h('span',null,it.freq) : null, shiftTxt ? h('span',null,shiftTxt) : null, h('span',{class:'small muted'},'Confidence '+it.conf)),
      h('b',null,it.text),
      matched ? h('span',{class:'small'},(it.action === 'stop' ? 'Stops: ' : 'Replaces: ')+matched.text) : null,
      it.quote ? h('span',{class:'small muted'},'Original: "'+it.quote+'"') : null,
      ...(it.flags||[]).map(f => h('span',{class:'small',style:'color:var(--amber)'},'⚠ '+f)),
      h('details',null, h('summary',{class:'small'},'Edit before approving'),
        h('div',{class:'grid g3'}, h('label',{class:'f'},'Resident',res), h('label',{class:'f'},'What it does',act), h('label',{class:'f'},'Type',kind)),
        h('label',{class:'f'},'Instruction',text), matchRow,
        h('div',{class:'grid g3'}, h('label',{class:'f'},'How often',freq), h('label',{class:'f'},'Times (shift reminders)',times), h('label',{class:'f'},'Starts or due',start))),
      h('div',{class:'f'}, h('span',{class:'small'},'Where it goes when approved'), ...dests.map(d => d.el)),
      ...boxes,
      h('div',{class:'row'}, ok, no, !can ? h('span',{class:'small muted'},'View as RN or house manager to approve.') : null));
  }

  function addCard(site){
    const ch = h('select',null, Object.keys(CHANNELS).map(k => h('option',{value:k},CHANNELS[k])));
    const from = h('input',{type:'text',placeholder:'Example: Dr. Sample'}), org = h('input',{type:'text',placeholder:'Example: Example Clinic'}), addr = h('input',{type:'text',placeholder:'Fax number or email it came from'});
    const subj = h('input',{type:'text',placeholder:'Optional'});
    const body = h('textarea',{style:'min-height:7rem',placeholder:'Paste the email or type what the fax says. Made-up examples only in this test version.'});
    const file = h('input',{type:'file',accept:'.pdf,.eml,.txt,application/pdf,message/rfc822,text/plain'});
    const capBox = h('div'), note = h('p',{class:'small muted',role:'status'});
    file.addEventListener('change', async () => { const f = file.files && file.files[0]; if (!f) return; note.textContent = 'Reading '+f.name+'…';
      try { const r = await fileText(f); body.value = r.text; if (r.from && !from.value) from.value = r.from; if (r.addr && !addr.value) addr.value = r.addr; if (r.subject && !subj.value) subj.value = r.subject; if (/\.eml$/i.test(f.name)) ch.value = 'email'; else if (/\.pdf$/i.test(f.name)) ch.value = 'fax'; note.textContent = 'Read. Check the text below, then press Read it.'; }
      catch(e){ note.textContent = e.message; } });
    const photo = h('button',{class:'btn ghost sm',type:'button'},'📸 Photograph a paper fax');
    photo.addEventListener('click', () => {
      if (capBox.firstChild) return; ch.value = 'photo';
      if (!window.SSCapture){ note.textContent = 'The in-app camera is not available here.'; return; }
      const panel = window.SSCapture.panel({id:'outside-'+uid(), docs:[]}, doc => { if (panel._stop) panel._stop(); capBox.textContent = '';
        if (doc) note.textContent = doc.count+' page'+(doc.count>1?'s':'')+' photographed in the app (kept in this page\'s memory only, never in the phone\'s photos). The AI reader reads photos once the privacy foundation is in place. For now, type what the page says below.'; });
      capBox.append(panel);
    });
    const f = h('form',{class:'card'}, h('h2',null,'Add one by hand'),
      h('p',{class:'small muted'},'For a fax that came to the old machine, a paper visit summary, or an email sent to someone\'s own inbox.'),
      h('div',{class:'row'}, photo, h('label',{class:'f'},'Or upload a PDF, saved email (.eml) or text file',file)), capBox, note,
      h('div',{class:'grid g2'}, h('label',{class:'f'},'How it came',ch), h('label',{class:'f'},'Subject',subj)),
      h('div',{class:'grid g3'}, h('label',{class:'f'},'From',from), h('label',{class:'f'},'Clinic or pharmacy',org), h('label',{class:'f'},'Fax or email',addr)),
      h('label',{class:'f'},'What it says',body),
      h('button',{class:'btn',type:'submit'},'Read it'));
    f.addEventListener('submit', e => { e.preventDefault();
      if (!body.value.trim()){ toast('Paste or type the message first'); return; }
      const m = arrive({site, channel:ch.value, from:from.value.trim()||'Unknown sender', org:org.value.trim(), addr:addr.value.trim(), subject:subj.value.trim(), body:body.value}, 0);
      const n = st().items.filter(i => i.msg === m.id).length;
      toast(m.status === 'not-orders' ? 'Set aside: this looks like a scam, not orders' : n+' line'+(n===1?'':'s')+' found. Review them above.'); A.route(); window.scrollTo(0,0); });
    return f;
  }

  // ---------- calendar feed: labs and visits from approved messages, and a nudge when lines wait ----------
  (window.SSCalendarFeeds = window.SSCalendarFeeds || []).push(ids => {
    const ev = [], o = S().outside; if (!o) return ev;
    (S().orders||[]).filter(x => ids.includes(x.site) && x.outsideMsg && x.kind === 'lab' && x.status === 'verified' && x.start >= today() && (!x.end || x.end >= x.start))
      .forEach(x => ev.push({id:'olab-'+x.id, kind:'Lab', who:'House manager', site:x.site, title:'Lab or test due ('+sname(x.site)+')', date:x.start, time:null, dur:30, note:'From an approved outside order. Arrange the draw or a ride. Details are in Steady Shift.', link:'#/outside'}));
    ids.forEach(s => { const n = o.items.filter(i => i.site === s && i.status === 'review').length;
      if (n) ev.push({id:'oq-'+s, kind:'Order check', who:'RN', site:s, title:n+' fax and email line'+(n===1?'':'s')+' waiting for review ('+sname(s)+')', date:today(), time:'15:00', dur:15, note:'Open Faxes and emails in Steady Shift.', link:'#/outside'}); });
    return ev;
  });

  // ---------- wiring ----------
  VIEWS.outside = {t:'Faxes and emails', ic:'📠'};
  ['manager','rn','owner','multi'].forEach(t => { const n = NAV[t]; if (!n || n.includes('outside')) return; const at = n.indexOf('orders'); n.splice(at >= 0 ? at+1 : Math.min(3, n.length), 0, 'outside'); });
  if (window.SSAccess && typeof SSAccess.register === 'function'){
    try { SSAccess.register({id:'outside', name:'Faxes and emails', ic:'📠', what:'Orders and protocols from outside doctors, nurses, pharmacies and specialists, read into a review queue.', views:['outside'], tiers:['owner','multi','manager','rn']}); } catch(e){ console.error(e); }
  }
  (A.homeHooks = A.homeHooks || []).push((v, t) => {
    if (!['manager','rn'].includes(t)) return;
    if (window.SSAccess && SSAccess.viewOn && !SSAccess.viewOn('outside')) return;
    const n = st().items.filter(i => i.site === sid() && i.status === 'review').length;
    v.append(h('div',{class:'grid g2'}, A.tile('outside','📠','Faxes and emails', n ? n+' line'+(n===1?'':'s')+' from outside clinicians waiting for review.' : 'Orders from outside clinicians, read into tasks. Nothing waiting.', n ? 'urgent' : '')));
  });

  window.SSOutside = {extract, readMessage, approve, undo, st, SAMPLES, timesOf, freqOf, kindOf, actionOf, findRes};
})();
