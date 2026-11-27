// Steady Shift test app: resident choices and preferences, staff voice, and the executive summary.
// 1. Resident choices (#/choices): food and drink choices (including declined meals), smoking and tobacco, daily routine,
//    activities, care choices, faith and culture. Written as the resident's rights and preferences, not as compliance problems.
//    Patterns roll up per resident and can be added to the care plan (isp.js) and shown on the face sheet.
// 2. Staff voice (#/voice): questions, concerns, wants and thanks from staff, routed to the manager, the nurse or the owner,
//    with an anonymous choice, replies, status and "you asked, we did". A person's own named notes feed their HR file (SSVoice.forStaff).
// 3. Executive summary (#/brief): one page for managers (their home) and owners (every home) with decisions to make.
// Sample data only: every resident, staff member and note here is made up. Everything stays in this browser.
(function(){
  const A = window.SSApp;
  if (!A) return;
  const {D, h, save, toast, copy, head, R, VIEWS, NAV, uid, fmtDate, fmtTime, download, csvCell} = A;
  const S = () => A.state();
  const CHECKED = '2026-11-27';
  const pad = n => String(n).padStart(2,'0');
  const ymd = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const today = () => ymd(new Date());
  const addDays = (s, n) => { const d = new Date(s+'T12:00:00'); d.setDate(d.getDate()+n); return ymd(d); };
  const daysAgo = iso => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  const chip = (t, c) => h('span',{class:'chip'+(c?' '+c:'')}, t);
  const card = (cls, ...k) => h('div',{class:'card'+(cls?' '+cls:'')}, ...k);
  const plural = (n, w, ws) => n+' '+(n === 1 ? w : (ws || w+'s'));
  const tierId = () => S().tier;
  const isMgr = () => ['manager','owner','multi','rn'].includes(tierId());
  const isOwner = () => ['owner','multi'].includes(tierId());
  const sid = () => S().site;
  const sites = () => D.SITES.filter(s => s.id !== 'family');
  const siteName = id => (D.SITES.find(s => s.id === id) || {name:id}).name;
  const resOf = (site, code) => (D.RESIDENTS[site] || []).find(r => r.code === code) || {code, nick:code};
  const staffNames = site => { try { if (window.SSSched && SSSched.staffNames){ const n = SSSched.staffNames(site); if (n && n.length) return n; } } catch(e){} return ((S().staff||{})[site]||[]).map(x => x.n); };
  const me = () => { try { if (window.SSSched && SSSched.me) return SSSched.me(); } catch(e){} return A.tier().name; };
  const can = p => { try { return !!(window.SSAccess && SSAccess.can && SSAccess.can(p)); } catch(e){ return false; } };
  const audit = (what, site) => { try { if (window.SSAccess && SSAccess.log) SSAccess.log(what, site); } catch(e){} };

  // ---------- where the rules come from ----------
  const SRC = {
    afhRights:{t:'DHS 88.10, AFH resident rights', u:'https://docs.legis.wisconsin.gov/code/admin_code/dhs/030/88/10'},
    cbrfRights:{t:'DHS 83.32, CBRF resident rights', u:'https://docs.legis.wisconsin.gov/code/admin_code/dhs/030/83/IV/32'},
    stat5009:{t:'Wis. Stat. 50.09, rights of residents', u:'https://docs.legis.wisconsin.gov/statutes/statutes/50/09'},
    hcbs:{t:'Federal HCBS settings rule, 42 CFR 441.301(c)(4)', u:'https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-C/part-441/subpart-G/section-441.301'},
    cbrfSmoke:{t:'DHS 83.47(5), CBRF smoking policy', u:'https://docs.legis.wisconsin.gov/code/admin_code/dhs/030/83'},
    smokeFree:{t:'Wis. Stat. 101.123, smoke-free air law', u:'https://docs.legis.wisconsin.gov/statutes/statutes/101/i/123'},
    whistle:{t:'Wis. Stat. 146.997, health care worker protection', u:'https://docs.legis.wisconsin.gov/statutes/statutes/146/997'},
    nlra:{t:'NLRB: employee rights to talk about pay and conditions', u:'https://www.nlrb.gov/about-nlrb/rights-we-protect/the-law/interfering-with-employee-rights-section-7-8a1'}
  };
  const srcLink = k => h('a',{href:SRC[k].u, target:'_blank', rel:'noopener'}, SRC[k].t);

  // =====================================================================
  // RESIDENT CHOICES
  // =====================================================================
  const CATS = [
    {id:'food', t:'Food and drink', ic:'🍽️', hint:'What they chose, liked, skipped or asked for at meals and snacks.'},
    {id:'smoke', t:'Smoking and tobacco', ic:'🚬', hint:'When and how much they chose to smoke, and any safety supports in their plan.'},
    {id:'routine', t:'Sleep, bathing and routine', ic:'🛏️', hint:'Wake and bed times, bathing times, how they like their day to go.'},
    {id:'activity', t:'Activities and people', ic:'🎲', hint:'What they enjoy, who they like to see, outings they want or skip.'},
    {id:'care', t:'Care choices', ic:'🩺', hint:'Help they accepted or declined (for example a shower or a walk). A declined medicine also goes on the MAR and to the nurse under your med policy.'},
    {id:'faith', t:'Faith and culture', ic:'🕊️', hint:'Faith practices, holidays, food customs, language.'},
    {id:'other', t:'Other', ic:'📝', hint:'Belongings, money, clothes, anything else they care about.'}
  ];
  const catOf = id => CATS.find(c => c.id === id) || CATS[CATS.length-1];
  const KINDS = [
    {id:'pref', t:'Likes or prefers', w:'prefers'},
    {id:'declined', t:'Said no to something offered', w:'said no to'},
    {id:'chose', t:'Chose or asked for something', w:'chose'},
    {id:'habit', t:'Usual pattern or habit', w:'usually'}
  ];
  const kindOf = id => KINDS.find(k => k.id === id) || KINDS[0];
  const WHEN = [['am','Morning'],['b','Breakfast'],['l','Lunch'],['pm','Afternoon'],['s','Supper'],['eve','Evening'],['night','Night']];
  const whenName = k => (WHEN.find(w => w[0] === k) || ['',''])[1];

  // Blaming or judging words, with a calmer way to say it. Used for resident notes and staff notes.
  const BLAME = [
    [/\bnon-?compliant\b/gi, 'chose not to'], [/\brefused to cooperate\b/gi, 'said no'], [/\buncooperative\b/gi, 'said no'],
    [/\bcombative\b/gi, '(describe what they did, for example "pushed my hand away")'], [/\bdifficult\b/gi, '(describe what happened)'],
    [/\bstubborn\b/gi, 'had a clear preference'], [/\bnon-?complian(ce|t)\b/gi, 'their choice'], [/\bbad behaviou?r\b/gi, '(describe what happened)'],
    [/\bmanipulative\b/gi, '(describe what they asked for)'], [/\bdemanding\b/gi, 'asked several times'], [/\bacting out\b/gi, '(describe what happened)'],
    [/\blazy\b/gi, '(describe what was not done)'], [/\bwhin(ing|y)\b/gi, 'asked'], [/\balways complains?\b/gi, 'has raised this before']
  ];
  function calm(text){
    let out = String(text||''), hits = [];
    BLAME.forEach(([re, rep]) => { if (re.test(out)){ hits.push(out.match(re)[0]); out = out.replace(re, rep); } re.lastIndex = 0; });
    return {text:out, hits};
  }

  // Sample smoking plans (fictional). "Safety" comes from a smoking safety assessment in the care plan.
  const SMOKE_PLANS = {
    'B-5':{safety:'Smokes on his own', where:'Patio bench by the side door (house smoking area)', keeps:'Keeps his own cigarettes; the house keeps the lighter by his choice', usual:'About 8 a day, most after meals', supports:'Ashtray with sand; apron offered (he usually says no)'},
    'C-3':{safety:'Staff stay nearby (assessment 2026-10)', where:'Back porch', keeps:'House keeps cigarettes and lighter at his request and gives them when he asks', usual:'About 5 a day; more in late afternoon', supports:'Smoking apron; staff within sight'}
  };

  function st(){
    const s = S();
    if (!s.choices || s.choices.v !== 1){
      s.choices = {v:1, res:[], voice:[], decisions:[], smoke:JSON.parse(JSON.stringify(SMOKE_PLANS)), seen:{}};
      seed(s.choices);
      save();
    }
    return s.choices;
  }

  // ---------- sample history (fictional) ----------
  function seed(c){
    let n = 7; const rnd = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
    const at = (d, hr) => addDays(today(), -d)+'T'+pad(hr)+':'+pad(Math.floor(rnd()*50)+5)+':00';
    const add = (site, res, cat, kind, what, d, o) => c.res.push(Object.assign({id:uid(), site, res, cat, kind, what, at:at(d, (o&&o.hr)||12), by:(staffNames(site)[Math.floor(rnd()*3)] || 'Caregiver'), when:'', offered:'', said:'', helped:''}, o||{}));
    // Maple Grove (AFH)
    add('maple','M-1','food','pref','Coffee as soon as she is up, black, in her own mug',27,{when:'am',hr:7,said:'"Coffee first, then talk to me."'});
    add('maple','M-1','food','pref','Coffee as soon as she is up, black, in her own mug',12,{when:'am',hr:7});
    add('maple','M-1','routine','habit','Up at 6:30 and dressed before breakfast; likes to choose her own clothes',20,{when:'am',hr:6});
    add('maple','M-1','activity','chose','Asked to call her sister on Sunday afternoons',9,{when:'pm',hr:15,helped:'Set the phone up on the table for her'});
    add('maple','M-1','activity','chose','Asked to call her sister on Sunday afternoons',2,{when:'pm',hr:15});
    add('maple','M-2','food','pref','Sandwiches he can hold; skips casseroles',25,{when:'s',hr:17,helped:'Cut the sandwich in quarters'});
    add('maple','M-2','food','declined','Beef casserole at supper',18,{when:'s',hr:17,offered:'Turkey sandwich',helped:'Ate the sandwich'});
    add('maple','M-2','food','declined','Chicken and rice casserole at supper',6,{when:'s',hr:17,offered:'Grilled cheese',helped:'Ate most of it with someone sitting with him'});
    add('maple','M-2','routine','habit','Walks the hallway after supper and talks about going home',15,{when:'eve',hr:19,helped:'Walked with him and talked about his farm'});
    add('maple','M-2','routine','habit','Walks the hallway after supper and talks about going home',4,{when:'eve',hr:19,helped:'Folding towels with him'});
    add('maple','M-3','food','chose','Asked for a second dessert at a birthday party',10,{when:'pm',hr:14,said:'"It\'s a party!"',helped:'Talked with her about her carb plan; she chose a small piece and the nurse was told'});
    add('maple','M-3','faith','pref','Watches Sunday Mass on TV at 10',14,{when:'am',hr:10});
    add('maple','M-3','faith','pref','Watches Sunday Mass on TV at 10',7,{when:'am',hr:10});
    [26,22,19,15,11,8,5,3,1].forEach((d,i) => add('maple','M-4','care','declined', i % 3 === 2 ? 'Shower in the morning' : 'Shower before lunch', d, {when: i % 3 === 2 ? 'am' : 'l', hr: i % 3 === 2 ? 9 : 11, offered:'Shower after lunch', helped: i % 2 ? 'Took a shower after lunch' : 'Washed up at the sink instead', said: i === 0 ? '"I always showered after dinner at noon on the farm."' : ''}));
    add('maple','M-4','food','pref','Mashed potatoes and gravy; pudding for dessert',21,{when:'l',hr:12});
    add('maple','M-4','food','declined','Dry pork chop at lunch',8,{when:'l',hr:12,offered:'Soup and pudding',helped:'Ate the soup'});
    // Birch Hollow (CBRF)
    add('birch','B-2','food','pref','Soup with every lunch, low salt',23,{when:'l',hr:12});
    add('birch','B-2','food','pref','Soup with every lunch, low salt',9,{when:'l',hr:12});
    add('birch','B-2','activity','declined','Group bingo',16,{when:'pm',hr:14,said:'"Too loud for me."',offered:'Puzzle in the quiet room',helped:'Did the puzzle with another resident'});
    add('birch','B-2','activity','declined','Group bingo',6,{when:'pm',hr:14,offered:'Puzzle in the quiet room',helped:'Did the puzzle'});
    for (let d = 28; d >= 1; d -= 2) add('birch','B-5','smoke','habit', d < 9 ? 'Smoked about 11 cigarettes today' : 'Smoked about 8 cigarettes today', d, {when:'pm',hr:16, count: d < 9 ? 11 + (d % 3) : 7 + (d % 3)});
    add('birch','B-5','smoke','chose','Asked to smoke right at shift change',12,{when:'pm',hr:14,helped:'Day staff walked him out at 1:45 before report'});
    add('birch','B-5','smoke','chose','Asked to buy a carton early; his spending money was low',5,{when:'pm',hr:15,helped:'Told the manager so it can go to his payee and care manager'});
    add('birch','B-5','food','pref','Burgers on Fridays',13,{when:'s',hr:17});
    add('birch','B-7','food','pref','Tea and toast before bed',17,{when:'eve',hr:20});
    add('birch','B-7','food','pref','Tea and toast before bed',3,{when:'eve',hr:20});
    add('birch','B-7','routine','pref','Sleeps in on weekends; breakfast saved for her',11,{when:'am',hr:9,helped:'Kept a plate warm'});
    add('birch','B-9','food','declined','Pureed peas',19,{when:'s',hr:17,offered:'Pureed carrots',helped:'Ate the carrots'});
    add('birch','B-9','food','declined','Pureed peas',5,{when:'s',hr:17,offered:'Pureed squash',helped:'Ate the squash'});
    // Cedar Lane (AFH)
    add('cedar','C-1','other','pref','Manages her own spending money and keeps receipts in her room',20,{when:'pm',hr:13});
    for (let d = 27; d >= 1; d -= 3) add('cedar','C-3','smoke','habit','Smoked about '+(5 + (d % 2))+' cigarettes today',d,{when:'pm',hr:16,count:5 + (d % 2)});
    add('cedar','C-3','routine','habit','Restless after 4 PM; a porch smoke and coffee help him settle',10,{when:'pm',hr:16,helped:'Sat on the porch with him'});
    add('cedar','C-3','food','declined','Fish sticks at supper (fish allergy is on his face sheet)',7,{when:'s',hr:17,offered:'Meatloaf',helped:'Ate the meatloaf; kitchen reminded about his allergy'});
    c.res.sort((a,b) => a.at.localeCompare(b.at));

    // Staff voice (fictional)
    const v = (site, by, kind, topic, text, d, o) => c.voice.push(Object.assign({id:uid(), site, by, anon:false, kind, topic, text, to:'manager', urgent:false, at:at(d, (o&&o.hr)||13), status:'new', reply:'', replyAt:'', replyBy:'', log:[]}, o||{}));
    const mn = staffNames('maple'), bn = staffNames('birch'), cn = staffNames('cedar');
    v('maple', mn[1]||'Caregiver B','question','schedule','Can we post the holiday schedule earlier? Some of us need to plan childcare.',18,{status:'done',reply:'Yes. The December schedule will be posted by the 1st from now on.',replyAt:at(16,10),replyBy:'Manager'});
    v('maple', mn[2]||'Caregiver C','want','training','I would like hands-on practice with the Hoyer lift before I use it alone.',12,{status:'working',reply:'Good idea. Setting up a practice hour with the RN.',replyAt:at(10,9),replyBy:'Manager'});
    v('maple', mn[3]||'Caregiver D','concern','workload','Night shift is hard alone when Walt is up walking. Can we talk about a second person from 7 to 11 PM?',9,{to:'owner'});
    v('maple', '', 'concern','teamwork','Report at shift change keeps running 20 minutes over, and it is not paid.',6,{anon:true,to:'owner'});
    v('maple', mn[1]||'Caregiver B','thanks','teamwork','Thank you for covering my shift when my kid was sick.',4,{status:'heard'});
    v('maple', mn[2]||'Caregiver C','want','supplies','The shower chair in the main bath is wobbly. Can we get a new one?',2,{urgent:true});
    v('birch', bn[1]||'Caregiver F','question','pay','When do the direct care workforce funds show up on our checks?',20,{status:'done',reply:'They are paid out on the second check of each month. The owner will send a note with the amounts.',replyAt:at(17,11),replyBy:'Manager'});
    v('birch', bn[2]||'Caregiver G','concern','schedule','I have worked three doubles this week. I am worn out.',8,{status:'heard',reply:'Thank you for saying so. No more doubles for you this pay period.',replyAt:at(7,15),replyBy:'Manager'});
    v('birch', '', 'concern','schedule','Schedules keep changing after they are posted.',7,{anon:true});
    v('birch', bn[3]||'Caregiver H','want','schedule','Could we try 8-hour shifts as an option for people with kids?',5);
    v('birch', bn[1]||'Caregiver F','question','care','Do we need a new order to give Pearl her tea later at night?',3,{to:'rn'});
    v('birch', '', 'want','pay','A small shift differential for nights would help people stay.',11,{anon:true,to:'owner'});
    v('cedar', cn[1]||'Caregiver J','question','policy','What do we do if Roy wants to smoke at night?',14,{status:'done',reply:'Same as days: staff stay within sight on the porch. It is in his plan, and it is on the face sheet now.',replyAt:at(13,9),replyBy:'Manager'});
    v('cedar', cn[1]||'Caregiver J','thanks','teamwork','New coffee maker is great. Roy loves it too.',2,{status:'heard'});
    c.voice.sort((a,b) => a.at.localeCompare(b.at));
    c.decisions.push({id:uid(), site:'maple', topic:'schedule', text:'Holiday and monthly schedules are posted by the 1st of each month.', at:at(16,10), by:'Manager', status:'done'});
    c.decisions.push({id:uid(), site:'cedar', topic:'supplies', text:'Bought a new coffee maker for the kitchen.', at:at(5,10), by:'Owner', status:'done'});
  }

  // ---------- pattern roll-up ----------
  const inRange = (x, days) => daysAgo(x.at) < days;
  function mealRefusals(site, code, days){
    // read-only: refusals already logged on the Meals screen
    try {
      const care = window.SSCare && SSCare.ensure ? SSCare.ensure() : S().care;
      return ((care && care.meals) || []).filter(m => m.site === site && m.res === code && m.vals && m.vals.refused && daysAgo(m.date+'T12:00:00') < days);
    } catch(e){ return []; }
  }
  const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
  function pattern(site, code, days){
    days = days || 30;
    const c = st();
    const all = c.res.filter(x => x.site === site && x.res === code);
    const now = all.filter(x => inRange(x, days)), before = all.filter(x => !inRange(x, days) && inRange(x, days*2));
    const meals = mealRefusals(site, code, days);
    const byCat = {}; now.forEach(x => { byCat[x.cat] = (byCat[x.cat]||0)+1; });
    const groups = {}; now.filter(x => x.count == null).forEach(x => { const k = x.cat+'|'+x.kind+'|'+norm(x.what).replace(/\b(in the morning|before lunch|at supper|at lunch)\b/g,'').trim(); (groups[k] = groups[k] || []).push(x); });
    const repeats = Object.values(groups).filter(g => g.length >= 2).sort((a,b) => b.length - a.length);
    const declined = now.filter(x => x.kind === 'declined');
    const whenCount = {}; declined.forEach(x => { if (x.when) whenCount[x.when] = (whenCount[x.when]||0)+1; });
    const topWhen = Object.entries(whenCount).sort((a,b) => b[1]-a[1])[0];
    const helped = {}; now.filter(x => x.helped).forEach(x => { const k = x.helped; helped[k] = (helped[k]||0)+1; });
    const topHelped = Object.entries(helped).sort((a,b) => b[1]-a[1]).slice(0,2).map(x => x[0]);
    const smokeDays = now.filter(x => x.cat === 'smoke' && x.count != null);
    const smokeBefore = all.filter(x => x.cat === 'smoke' && x.count != null && !inRange(x, Math.round(days/3)) && inRange(x, days));
    const smokeRecent = all.filter(x => x.cat === 'smoke' && x.count != null && inRange(x, Math.round(days/3)));
    const avg = arr => arr.length ? arr.reduce((s,x) => s + x.count, 0) / arr.length : null;
    const smoke = smokeDays.length ? {avg:avg(smokeDays), recent:avg(smokeRecent), earlier:avg(smokeBefore)} : null;
    const lastAdd = c.seen['plan|'+site+'|'+code] || '';
    const fresh = now.filter(x => !lastAdd || x.at > lastAdd);
    // Plan suggestions: only things seen at least twice, worded in the resident's terms
    const sug = [];
    repeats.forEach(g => {
      const x = g[g.length-1], r = resOf(site, code);
      if (x.kind === 'pref' || x.kind === 'habit' || x.kind === 'chose') sug.push({sec:'about', text:r.nick+' '+kindOf(x.kind).w+': '+lower(x.what)+(x.helped ? '. What helps: '+lower(x.helped) : '')+'.', n:g.length, last:x.at, cat:x.cat});
      else sug.push({sec:'about', text:r.nick+' often says no to '+lower(x.what)+(x.offered ? '; offer '+lower(x.offered)+' instead' : '')+(x.helped ? ' ('+lower(x.helped)+' has worked)' : '')+'.', n:g.length, last:x.at, cat:x.cat});
    });
    if (smoke){ const r = resOf(site, code), sw = {}; smokeDays.forEach(x => { if (x.when) sw[x.when] = (sw[x.when]||0)+1; }); const tw = Object.entries(sw).sort((a,b) => b[1]-a[1])[0];
      sug.push({sec:'about', text:r.nick+' chooses to smoke, about '+Math.round(smoke.recent || smoke.avg)+' cigarettes a day'+(tw ? ', mostly in the '+whenName(tw[0]).toLowerCase() : '')+'. Follow the smoking safety plan.', n:smokeDays.length, last:smokeDays[smokeDays.length-1].at, cat:'smoke'}); }
    const flags = [];
    const foodNo = declined.filter(x => x.cat === 'food' && inRange(x, 7)).length + mealRefusals(site, code, 7).length;
    if (foodNo >= 3) flags.push({lvl:'amber', text:plural(foodNo,'meal or food choice')+' declined in 7 days', next:'Their choice to make. Ask what is going on (teeth, taste, mood, pain, the menu) and tell the nurse, as the meal log does.'});
    const careNo = declined.filter(x => x.cat === 'care');
    if (careNo.length >= 3) flags.push({lvl:'calm', text:plural(careNo.length,'time')+' said no to '+lower(careNo[careNo.length-1].what.replace(/ in the morning| before lunch/,'')), next:topWhen ? 'Mostly at '+whenName(topWhen[0]).toLowerCase()+'. Try their preferred time and put it in the plan, so it stops being a daily "no".' : 'Ask when and how they would like it, and put that in the plan.'});
    if (smoke && smoke.recent && smoke.earlier && smoke.recent >= smoke.earlier * 1.25) flags.push({lvl:'calm', text:'Smoking up from about '+Math.round(smoke.earlier)+' to '+Math.round(smoke.recent)+' a day', next:'Their choice. Check in on how they are doing (stress, sleep, boredom), and whether their spending money covers it. Never hold cigarettes back as a consequence.'});
    return {all, now, before, meals, byCat, repeats, declined, topWhen, topHelped, smoke, sug, flags, fresh, lastAdd};
  }
  const lower = s => { s = String(s||'').trim().replace(/\.$/,''); return s ? s[0].toLowerCase()+s.slice(1) : s; };

  // a short paragraph for the summary and the face sheet
  function sentence(site, code, days){
    const p = pattern(site, code, days), r = resOf(site, code), bits = [];
    if (!p.now.length && !p.meals.length) return r.nick+': nothing new logged in the last '+days+' days.';
    const cats = Object.entries(p.byCat).sort((a,b) => b[1]-a[1]).map(([k,n]) => catOf(k).t.toLowerCase()+' '+n);
    bits.push(r.nick+' ('+code+'): '+plural(p.now.length,'choice')+' logged ('+cats.join(', ')+').');
    if (p.meals.length) bits.push(plural(p.meals.length,'meal')+' declined in the meal log.');
    p.repeats.slice(0,2).forEach(g => { const x = g[g.length-1]; bits.push((x.kind === 'declined' ? 'Said no to ' : kindOf(x.kind).t.split(' ')[0]+': ')+lower(x.what)+' ('+g.length+'×)'+(x.helped ? ', '+lower(x.helped)+' helped' : '')+'.'); });
    if (p.smoke) bits.push('Smoking about '+Math.round(p.smoke.recent || p.smoke.avg)+' a day.');
    return bits.join(' ');
  }

  // ---------- care plan bridge (isp.js) ----------
  function addToPlan(site, code, lines){
    const c = st();
    if (window.SSISP && SSISP.plan){
      const P = SSISP.plan(site, code);
      const cur = P.versions[P.versions.length-1];
      if (!P.draft && cur) P.draft = JSON.parse(JSON.stringify(cur.data));
      if (P.draft) lines = lines.filter(l => !(P.draft.about||'').includes(l));
      const text = lines.map(l => '- '+l).join('\n');
      if (P.draft && lines.length){
        P.draft.about = (P.draft.about ? P.draft.about.trim()+'\n' : '')+'From the choices log ('+fmtDate(today())+'):\n'+text;
        P.draft.aboutSrc = (P.draft.aboutSrc||[]).concat(P.draft.aboutSrc && P.draft.aboutSrc.includes('Resident choices log') ? [] : ['Resident choices log']);
      } else if (!P.draft) {
        (P.fromChoices = P.fromChoices || []).push(...lines);  // picked up when the plan is first started
      }
      c.seen['plan|'+site+'|'+code] = new Date().toISOString();
      audit('Added '+plural(lines.length,'line')+' from the choices log to '+code+'\'s care plan draft', site);
      save();
      return true;
    }
    copy(lines.join('\n'));
    return false;
  }
  // lines a brand-new plan should start with (isp.js asks for these)
  function planLines(site, code){
    const P = window.SSISP && SSISP.plan ? SSISP.plan(site, code) : null;
    const queued = P && P.fromChoices ? P.fromChoices.splice(0) : [];
    return queued.concat(pattern(site, code, 90).sug.map(s => s.text)).filter((x, i, a) => a.indexOf(x) === i);
  }

  // ---------- resident choices screen ----------
  R.choices = v => {
    const param = A.param ? A.param() : '';
    if (sid() === 'family'){ v.append(head('Resident choices','Choices and preferences','This screen is for adult family homes and CBRFs. Switch to one of the sample homes at the top.')); return; }
    const c = st();
    const code = (param||'').split('/')[0];
    v.append(head('Resident choices · '+A.site().name, code ? 'Choices and preferences: '+resOf(sid(), code).nick : 'Choices and preferences',
      'Write down what residents choose, like, skip or say no to, in a few words. Over time it shows patterns that belong in their care plan. Saying no is a right, not a problem to fix.'));
    v.append(rightsBox());
    const body = h('div',{class:'grid'}); v.append(body);
    if (code) residentView(body, code); else listView(body);
  };

  function rightsBox(){
    const set = A.setting();
    return h('details',{class:'card soft help'}, h('summary',null,'Why we log choices this way (rules and rights)'),
      h('p',{class:'small'}, 'Residents have the right to make their own choices, including saying no to food, care or activities, and to be treated with dignity. ', set === 'cbrf' ? 'CBRFs: DHS 83.32 lists resident rights, including the right to refuse care and treatment.' : 'Adult family homes: DHS 88.10 lists resident rights, and the home must respect resident choice in daily life.', ' Homes paid through Family Care or IRIS also follow the federal HCBS settings rule: residents control their own schedules and activities and have access to food at any time.'),
      h('p',{class:'small'}, 'Log what you saw and what they said, not a label. "Said no to the shower before lunch; showered after lunch" helps the next person. "Non-compliant" does not.'),
      h('p',{class:'small'}, 'Smoking: ', set === 'cbrf' ? 'a CBRF must have a written smoking policy that names where smoking is allowed, if anywhere, and tells residents (DHS 83.47(5)). ' : 'an adult family home sets its smoking rules in its house rules and the resident\'s plan (no AFH smoking section found yet; being checked). ', 'Wisconsin\'s smoke-free air law treats CBRFs and AFHs as assisted living facilities: a room used by one resident is exempt, and a shared room only when every resident in it smokes and asked in writing (Wis. Stat. 101.123(3)(i) and (j)). Safety supports (supervision, who keeps the lighter) come from a smoking safety assessment in the plan. Holding cigarettes back as a consequence is a restriction and needs the plan\'s restriction steps.'),
      h('p',{class:'foot'}, 'Sources: ', srcLink(set === 'cbrf' ? 'cbrfRights' : 'afhRights'), ' · ', srcLink('stat5009'), ' · ', srcLink('hcbs'), ' · ', srcLink('cbrfSmoke'), ' · ', srcLink('smokeFree'), '. Checked '+fmtDate(CHECKED)+'. Not legal advice.'));
  }

  function listView(body){
    const rs = A.residents();
    body.append(logForm(null));
    const days = 30;
    body.append(h('h2',null,'Patterns in the last 30 days'));
    body.append(h('div',{class:'grid g2'}, rs.map(r => {
      const p = pattern(sid(), r.code, days);
      return card(p.flags.some(f => f.lvl === 'amber') ? 'warn' : '',
        h('div',{class:'row',style:'justify-content:space-between'}, h('h3',{style:'margin:0'}, r.nick+' ', h('span',{class:'small muted'}, r.code)), p.sug.length && isMgr() ? chip(plural(p.sug.length,'plan idea'),'calm') : null),
        h('p',{class:'small'}, sentence(sid(), r.code, days).replace(/^[^:]+: /,'')),
        p.flags.map(f => h('p',{class:'small'}, chip(f.text, f.lvl === 'amber' ? 'amber' : 'calm'), ' ', f.next)),
        h('a',{class:'btn quiet sm',href:'#/choices/'+encodeURIComponent(r.code)}, 'Open '+r.nick+'\'s choices'));
    })));
    const recent = st().res.filter(x => x.site === sid()).slice(-8).reverse();
    body.append(card('', h('h2',null,'Latest entries'), entryList(recent, true)));
  }

  function entryList(items, showRes){
    if (!items.length) return h('p',{class:'muted'},'Nothing logged yet.');
    return h('div',{class:'list'}, items.map(x => h('div',{class:'item'},
      h('div',{class:'meta'}, showRes ? chip(resOf(x.site, x.res).nick) : null, chip(catOf(x.cat).ic+' '+catOf(x.cat).t,'grey'), chip(kindOf(x.kind).t, x.kind === 'declined' ? 'amber' : 'calm'), x.when ? chip(whenName(x.when),'grey') : null),
      h('span',null, x.what + (x.count != null && !/\d/.test(x.what) ? ' ('+x.count+')' : '')),
      x.said ? h('span',{class:'small'}, 'In their words: ', h('i',null, x.said)) : null,
      x.offered ? h('span',{class:'small'}, 'Offered instead: '+x.offered) : null,
      x.helped ? h('span',{class:'small'}, 'What helped: '+x.helped) : null,
      h('span',{class:'small muted'}, fmtTime(x.at)+' · '+x.by))));
  }

  function logForm(code){
    const rs = A.residents();
    const form = h('form',{class:'card','aria-label':'Log a choice'});
    const resSel = h('select',{id:'ch-res'}, rs.map(r => h('option',{value:r.code, selected:r.code === code || null}, r.nick+' ('+r.code+')')));
    let cat = 'food', kind = 'pref';
    const catBox = h('div',{class:'row',role:'group','aria-label':'What it is about'});
    const kindBox = h('div',{class:'row',role:'group','aria-label':'What kind'});
    const hint = h('p',{class:'small muted'});
    const what = h('input',{id:'ch-what',type:'text',maxlength:'200',required:true,placeholder:'For example: said no to eggs, asked for oatmeal'});
    const when = h('select',{id:'ch-when'}, h('option',{value:''},'Not sure'), WHEN.map(w => h('option',{value:w[0]}, w[1])));
    const said = h('input',{id:'ch-said',type:'text',maxlength:'200',placeholder:'Optional, in quotes if you can'});
    const offered = h('input',{id:'ch-off',type:'text',maxlength:'160',placeholder:'Optional'});
    const helped = h('input',{id:'ch-help',type:'text',maxlength:'160',placeholder:'Optional'});
    const count = h('input',{id:'ch-count',type:'number',min:'0',max:'60',inputmode:'numeric'});
    const countWrap = h('label',{class:'f',for:'ch-count',hidden:true}, 'How many today (optional)', count);
    const warn = h('p',{class:'small',role:'status'});
    const smokeNote = h('p',{class:'small muted',hidden:true});
    const drawSeg = () => {
      catBox.textContent = ''; kindBox.textContent = '';
      CATS.forEach(c => catBox.append(h('button',{type:'button',class:'chip','aria-pressed':String(c.id === cat),onclick:()=>{ cat = c.id; drawSeg(); }}, c.ic+' '+c.t)));
      KINDS.forEach(k => kindBox.append(h('button',{type:'button',class:'chip','aria-pressed':String(k.id === kind),onclick:()=>{ kind = k.id; drawSeg(); }}, k.t)));
      hint.textContent = catOf(cat).hint;
      countWrap.hidden = cat !== 'smoke';
      const sp = st().smoke[resSel.value];
      smokeNote.hidden = cat !== 'smoke';
      smokeNote.textContent = sp ? 'Their plan: '+sp.safety+'. Where: '+sp.where+'. '+sp.keeps+'.' : 'No smoking plan on file for this resident. If they smoke, the manager adds a smoking safety assessment to their care plan.';
    };
    resSel.addEventListener('change', drawSeg);
    what.addEventListener('input', () => { const r = calm(what.value + ' ' + said.value); warn.textContent = r.hits.length ? 'Try describing what happened instead of "'+r.hits.join('", "')+'".' : ''; });
    drawSeg();
    form.append(h('h2',null,'Log a choice'),
      h('label',{class:'f',for:'ch-res'},'Resident', resSel),
      h('p',{class:'small',style:'margin:.4rem 0 .2rem'},h('b',null,'About')), catBox, hint, smokeNote,
      h('p',{class:'small',style:'margin:.4rem 0 .2rem'},h('b',null,'What kind')), kindBox,
      h('label',{class:'f',for:'ch-what'},'What happened, in a few words', what), warn,
      h('div',{class:'grid g2'}, h('label',{class:'f',for:'ch-when'},'When', when), countWrap),
      h('details',null, h('summary',{class:'small'},'Add more (their words, what you offered, what helped)'),
        h('label',{class:'f',for:'ch-said'},'What they said', said),
        h('label',{class:'f',for:'ch-off'},'What you offered instead', offered),
        h('label',{class:'f',for:'ch-help'},'What helped', helped)),
      h('p',{class:'small muted'},'Use first names or codes only. No diagnoses or private health details here; those go in the record.'),
      h('div',{class:'row'}, h('button',{class:'btn',type:'submit'},'Save')));
    form.addEventListener('submit', e => {
      e.preventDefault();
      const t = what.value.trim(); if (!t) { what.focus(); return; }
      const x = {id:uid(), site:sid(), res:resSel.value, cat, kind, what:t, when:when.value, said:said.value.trim(), offered:offered.value.trim(), helped:helped.value.trim(), at:new Date().toISOString(), by:me()};
      if (cat === 'smoke' && count.value !== '') x.count = Math.max(0, Math.min(60, +count.value));
      st().res.push(x); save(); toast('Saved to '+resOf(sid(), x.res).nick+'\'s choices');
      A.route();
    });
    return form;
  }

  function residentView(body, code){
    const site = sid(), r = resOf(site, code), p = pattern(site, code, 30), p90 = pattern(site, code, 90);
    body.append(h('div',{class:'row'}, h('a',{class:'btn quiet sm',href:'#/choices'},'← All residents'), window.SSISP ? h('a',{class:'btn quiet sm',href:'#/isp/'+encodeURIComponent(code)},'Open care plan') : null, h('a',{class:'btn quiet sm',href:'#/face'},'Face sheets')));
    body.append(card('soft', h('h2',null,'Summary'), h('p',null, sentence(site, code, 30)),
      p.topHelped.length ? h('p',{class:'small'}, h('b',null,'What has helped: '), p.topHelped.join('; ')) : null,
      p.flags.map(f => h('p',{class:'small'}, chip(f.text, f.lvl === 'amber' ? 'amber' : 'calm'), ' ', f.next))));
    const sp = st().smoke[code];
    if (sp || p90.byCat.smoke){
      const s = p90.smoke;
      body.append(card('', h('h2',null,'🚬 Smoking plan and pattern'),
        sp ? h('dl',{class:'small'}, [['Safety',sp.safety],['Where',sp.where],['Cigarettes and lighter',sp.keeps],['Usual',sp.usual],['Supports',sp.supports]].map(([k,val]) => [h('dt',null,h('b',null,k)), h('dd',null,val)])) : h('p',{class:'small'},'No smoking plan yet. The manager adds a smoking safety assessment and plan to the care plan.'),
        s ? h('p',{class:'small'}, 'Average about '+Math.round(s.avg)+' a day over the period'+(s.recent && s.earlier ? '; lately about '+Math.round(s.recent)+' (earlier about '+Math.round(s.earlier)+')' : '')+'.') : null,
        spark(p90.all.filter(x => x.cat === 'smoke' && x.count != null))));
    }
    if (isMgr() && p90.sug.length){
      const boxes = p90.sug.map((s, i) => { const id = 'sug'+i; const cb = h('input',{type:'checkbox',id,checked:!p.lastAdd || s.last > p.lastAdd}); return {s, cb, el:h('div',{class:'row small'}, cb, h('label',{for:id}, s.text+' ', h('span',{class:'muted'},'(seen '+s.n+'×)')))}; });
      body.append(card('', h('h2',null,'Ideas for the care plan'),
        h('p',{class:'small muted'},'Things seen at least twice in 90 days, written the way the plan\'s "What matters to them" section reads. Tick what fits and add it to the plan draft. You still review and finish the plan, and '+r.nick+' (or their representative) takes part.'),
        p.lastAdd ? h('p',{class:'small'},'Last added to the plan '+fmtTime(p.lastAdd)+'.') : null,
        boxes.map(b => b.el),
        h('div',{class:'row'}, h('button',{class:'btn',type:'button',onclick:()=>{
          const lines = boxes.filter(b => b.cb.checked).map(b => b.s.text);
          if (!lines.length){ toast('Tick at least one line'); return; }
          const ok = addToPlan(site, code, lines);
          toast(ok ? 'Added to '+r.nick+'\'s care plan draft' : 'Copied. Paste it into the care plan.');
          A.route();
        }}, window.SSISP ? 'Add to care plan draft' : 'Copy for the care plan'))));
    }
    body.append(logForm(code));
    body.append(card('', h('h2',null,'History'), entryList(p90.all.filter(x => inRange(x, 90)).slice().reverse(), false)));
  }

  function spark(rows){
    if (rows.length < 3) return null;
    const W = 300, H = 60, max = Math.max(...rows.map(x => x.count), 1);
    const xs = rows.map((x, i) => [Math.round(i * (W-10) / (rows.length-1)) + 5, Math.round(H - 6 - (x.count / max) * (H - 14))]);
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox','0 0 '+W+' '+H); svg.setAttribute('role','img'); svg.setAttribute('aria-label','Cigarettes a day, oldest to newest: '+rows.map(x => x.count).join(', '));
    svg.setAttribute('style','width:100%;max-width:340px;height:auto;display:block');
    const pl = document.createElementNS(ns, 'polyline'); pl.setAttribute('points', xs.map(p => p.join(',')).join(' ')); pl.setAttribute('fill','none'); pl.setAttribute('stroke','currentColor'); pl.setAttribute('stroke-width','2');
    svg.append(pl);
    return h('div',{style:'color:var(--sky)'}, svg);
  }

  // =====================================================================
  // STAFF VOICE
  // =====================================================================
  const VKINDS = [
    {id:'question', t:'Question', ic:'❓'}, {id:'concern', t:'Concern', ic:'⚠️'}, {id:'want', t:'Idea or want', ic:'💡'}, {id:'thanks', t:'Thanks', ic:'🙏'}
  ];
  const vkind = id => VKINDS.find(k => k.id === id) || VKINDS[0];
  const TOPICS = [
    ['schedule','Schedule and hours'], ['pay','Pay and benefits'], ['training','Training'], ['workload','Workload and staffing'], ['safety','Safety'],
    ['care','Resident care'], ['teamwork','Teamwork'], ['supplies','Supplies and equipment'], ['policy','Policies and rules'], ['other','Other']
  ];
  const topicName = id => (TOPICS.find(t => t[0] === id) || ['', id])[1];
  const TO = {manager:'My manager', rn:'The nurse (care questions)', owner:'The owner only'};
  const STATUS = {new:['New','amber'], heard:['Heard','calm'], working:['Working on it',''], done:['Done','calm'], later:['Not now (with a reason)','grey']};

  // Who can read a note. Caregivers: their own named notes only. Managers: notes to the manager or nurse in their home,
  // never notes sent to the owner only. RNs: notes to the nurse. Owners: everything. A lead with shared access ("voice.read")
  // can read manager notes in that home.
  function canSee(x){
    const t = tierId();
    if (t === 'owner' || t === 'multi') return true;
    if (x.site !== sid()) return false;
    if (t === 'manager') return x.to !== 'owner';
    if (t === 'rn') return x.to === 'rn';
    if (can('voice.read') && x.to === 'manager') return true;
    return !x.anon && x.by === me();
  }
  const canAnswer = x => (isOwner() || (tierId() === 'manager' && x.to !== 'owner') || (tierId() === 'rn' && x.to === 'rn') || (can('voice.read') && x.to === 'manager')) && canSee(x);
  const mine = () => st().voice.filter(x => x.site === sid() && !x.anon && x.by === me());

  R.voice = v => {
    if (sid() === 'family'){ v.append(head('Staff voice','Staff questions and ideas','This screen is for adult family homes and CBRFs. Switch to one of the sample homes at the top.')); return; }
    const c = st(), t = tierId();
    const reader = ['manager','owner','multi','rn'].includes(t) || can('voice.read');
    v.append(head('Staff voice · '+(isOwner() ? 'All homes' : A.site().name), reader ? 'What your team is asking and wanting' : 'Ask, raise a concern, or share an idea',
      reader ? 'Questions, concerns, ideas and thanks from staff. Answer each one, even with "not now, and here is why". People stay when they feel heard.' : 'Say it here instead of in the hallway. You choose who sees it. You\'ll see the answer here.'));
    const body = h('div',{class:'grid'}); v.append(body);
    if (t === 'caregiver' || !reader || t === 'rn') body.append(voiceForm());
    const wd = wedid(); if (wd) body.append(wd);
    if (reader) inbox(body); else body.append(card('', h('h2',null,'My notes and answers'), noteList(mine().slice().reverse(), false)));
    body.append(h('details',{class:'card soft help'}, h('summary',null,'Who can see what, and your protections'),
      h('ul',{class:'small'},
        h('li',null,'"My manager": your house manager (and a lead they share access with) and the owner.'),
        h('li',null,'"The nurse": the RN and your manager, for care questions.'),
        h('li',null,'"The owner only": the owner. Your manager does not see it. Use this when the concern is about your manager.'),
        h('li',null,'Anonymous: your name is not saved with the note, so no one can answer you directly; the answer is posted for the whole team in "You asked, we did". In a small home people may still guess, so keep details general.'),
        h('li',null,'Named notes go in your own HR file as a record that you spoke up. Anonymous and owner-only notes never do.'),
        h('li',null,'This is not for reporting abuse, neglect or an injury. Use Report something for those, or call the state hotline.')),
      h('p',{class:'small'},'Wisconsin law protects health care workers who report a rule violation or unsafe care in good faith from being punished for it (Wis. Stat. 146.997). Federal labor law also protects employees who talk with each other about pay and working conditions.'),
      h('p',{class:'foot'}, 'Sources: ', srcLink('whistle'), ' · ', srcLink('nlra'), '. Checked '+fmtDate(CHECKED)+'. Not legal advice.')));
  };

  function voiceForm(){
    const f = h('form',{class:'card','aria-label':'Send a note'});
    let kind = 'question', to = 'manager';
    const kb = h('div',{class:'row',role:'group','aria-label':'What kind of note'}), tb = h('div',{class:'row',role:'group','aria-label':'Who should see it'});
    const topic = h('select',{id:'vo-topic'}, TOPICS.map(x => h('option',{value:x[0]}, x[1])));
    const text = h('textarea',{id:'vo-text',rows:'4',maxlength:'1000',required:true,placeholder:'Say it the way you would say it out loud. The app can help make it sound calm and clear.'});
    const anon = h('input',{type:'checkbox',id:'vo-anon'});
    const urgent = h('input',{type:'checkbox',id:'vo-urg'});
    const tip = h('div',{class:'small',role:'status'});
    const draw = () => {
      kb.textContent = ''; tb.textContent = '';
      VKINDS.forEach(k => kb.append(h('button',{type:'button',class:'chip','aria-pressed':String(k.id === kind),onclick:()=>{ kind = k.id; draw(); }}, k.ic+' '+k.t)));
      Object.entries(TO).forEach(([k, l]) => tb.append(h('button',{type:'button',class:'chip','aria-pressed':String(k === to),onclick:()=>{ to = k; draw(); }}, l)));
    };
    draw();
    const tidy = h('button',{class:'btn quiet sm',type:'button',onclick:()=>{
      const r = calm(text.value);
      const names = staffNames(sid()).filter(n => n !== me() && n.length > 2 && new RegExp('\\b'+n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(text.value));
      text.value = r.text.replace(/\byou guys\b/gi,'the team').replace(/!{2,}/g,'.').replace(/\?{2,}/g,'?');
      tip.textContent = '';
      tip.append(r.hits.length ? 'Softened: '+r.hits.join(', ')+'. ' : 'Reads calm and clear. ',
        names.length ? 'You named '+names.join(', ')+'. If this is about how a coworker acted, think about sending it to the owner only, or use Report something.' : '',
        ' Tip: say what happened, how it affects residents or the team, and what would help.');
    }}, 'Help me word it');
    f.append(h('h2',null,'Send a note'), h('p',{class:'small',style:'margin:.2rem 0'},h('b',null,'What is it?')), kb,
      h('label',{class:'f',for:'vo-topic'},'Topic', topic),
      h('label',{class:'f',for:'vo-text'},'Your note', text), h('div',{class:'row'}, tidy), tip,
      h('p',{class:'small',style:'margin:.4rem 0 .2rem'},h('b',null,'Who should see it?')), tb,
      h('div',{class:'row small'}, anon, h('label',{for:'vo-anon'},'Send without my name')),
      h('div',{class:'row small'}, urgent, h('label',{for:'vo-urg'},'It is a safety issue that cannot wait (the manager gets a nudge)')),
      h('div',{class:'row'}, h('button',{class:'btn',type:'submit'},'Send')));
    f.addEventListener('submit', e => {
      e.preventDefault();
      const tx = text.value.trim(); if (!tx){ text.focus(); return; }
      const x = {id:uid(), site:sid(), by:anon.checked ? '' : me(), anon:anon.checked, kind, topic:topic.value, text:tx, to, urgent:urgent.checked, at:new Date().toISOString(), status:'new', reply:'', replyAt:'', replyBy:'', log:[]};
      st().voice.push(x); save();
      toast(anon.checked ? 'Sent without your name' : 'Sent to '+TO[to].toLowerCase().replace(/^my /,'your ').replace(/ \(.*$/,''));
      A.route();
    });
    return f;
  }

  function noteList(items, manage){
    if (!items.length) return h('p',{class:'muted'}, manage ? 'Nothing here.' : 'You have not sent a note yet.');
    return h('div',{class:'list'}, items.map(x => {
      const s = STATUS[x.status] || STATUS.new, wait = !x.replyAt ? daysAgo(x.at) : 0;
      const it = h('div',{class:'item'},
        h('div',{class:'meta'}, chip(vkind(x.kind).ic+' '+vkind(x.kind).t), chip(topicName(x.topic),'grey'), chip(s[0], s[1]), x.urgent ? chip('Safety','red') : null, manage && isOwner() ? chip(siteName(x.site),'grey') : null, manage ? chip(x.to === 'owner' ? 'Owner only' : x.to === 'rn' ? 'To the nurse' : 'To the manager','grey') : null, manage && wait >= 7 && x.status !== 'done' && x.kind !== 'thanks' ? chip('Waiting '+wait+' days','amber') : null),
        h('span',null, x.text),
        h('span',{class:'small muted'}, (x.anon ? 'A team member' : x.by)+' · '+fmtTime(x.at)),
        x.reply ? h('span',{class:'small'}, h('b',null,'Answer from '+x.replyBy+': '), x.reply) : null);
      if (manage && canAnswer(x)) it.append(answerBox(x));
      return it;
    }));
  }

  function answerBox(x){
    const box = h('details',null, h('summary',{class:'small'}, x.reply ? 'Change the answer or status' : 'Answer'));
    const id = 'ans-'+x.id;
    const ta = h('textarea',{id,rows:'2',maxlength:'600'}); ta.value = x.reply || '';
    const sel = h('select',{id:id+'s'}, Object.entries(STATUS).map(([k, s]) => h('option',{value:k,selected:k === x.status || null}, s[0])));
    box.append(h('label',{class:'f',for:id}, x.anon ? 'Answer (posted to the whole team, since no name was given)' : 'Answer to '+x.by, ta),
      h('label',{class:'f',for:id+'s'},'Status', sel),
      h('div',{class:'row'},
        h('button',{class:'btn sm',type:'button',onclick:()=>{
          if (sel.value === 'later' && !ta.value.trim()){ toast('Add a short reason for "not now"'); ta.focus(); return; }
          x.reply = ta.value.trim(); x.status = sel.value; x.replyAt = new Date().toISOString(); x.replyBy = A.tier().name;
          x.log.push({at:x.replyAt, by:x.replyBy, status:x.status});
          save(); toast('Saved'); A.route(); }}, 'Save'),
        x.kind === 'want' || x.kind === 'concern' ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ decide(x); }}, 'Record a decision') : null));
    return box;
  }

  function decide(x){
    const text = prompt('What did you decide? This shows to the team in "You asked, we did" without anyone\'s name.', x.reply || '');
    if (!text) return;
    st().decisions.push({id:uid(), site:x.site, topic:x.topic, text:text.trim(), at:new Date().toISOString(), by:A.tier().name, status:'done', from:x.id});
    x.status = 'done'; x.reply = x.reply || text.trim(); x.replyAt = x.replyAt || new Date().toISOString(); x.replyBy = x.replyBy || A.tier().name;
    save(); toast('Shared with the team'); A.route();
  }

  function wedid(){
    const ds = st().decisions.filter(d => isOwner() || d.site === sid()).slice().reverse().slice(0,5);
    const anonAns = st().voice.filter(x => x.anon && x.reply && (isOwner() || x.site === sid()) && x.to !== 'owner').slice().reverse().slice(0,3);
    if (!ds.length && !anonAns.length) return null;
    return card('soft', h('h2',null,'You asked, we did'),
      h('div',{class:'list'}, ds.map(d => h('div',{class:'item'}, h('div',{class:'meta'}, chip(topicName(d.topic),'grey'), isOwner() ? chip(siteName(d.site),'grey') : null), h('span',null,d.text), h('span',{class:'small muted'}, fmtDate(d.at)))),
        anonAns.map(x => h('div',{class:'item'}, h('div',{class:'meta'}, chip('Answer to an unsigned note','grey')), h('span',{class:'small'}, h('i',null,'"'+x.text+'"')), h('span',null, x.reply)))));
  }

  function inbox(body){
    const all = st().voice.filter(canSee);
    let filt = 'open';
    const tabs = h('div',{class:'row',role:'group','aria-label':'Show'});
    const list = h('div');
    const draw = () => {
      tabs.textContent = '';
      [['open','Needs an answer'],['all','All'],['thanks','Thanks']].forEach(([k, l]) => tabs.append(h('button',{type:'button',class:'chip','aria-pressed':String(k === filt),onclick:()=>{ filt = k; draw(); }}, l)));
      const items = all.filter(x => filt === 'all' ? true : filt === 'thanks' ? x.kind === 'thanks' : x.kind !== 'thanks' && !['done','later'].includes(x.status)).slice().reverse()
        .sort((a,b) => (b.urgent - a.urgent));
      list.textContent = ''; list.append(noteList(items, true));
    };
    draw();
    body.append(themes(all, 30));
    body.append(card('', h('h2',null,'Notes'), tabs, list));
    if (tierId() === 'manager') body.append(h('p',{class:'small muted'},'Notes staff sent to the owner only are not shown to managers.'));
  }

  // topic roll-up used by the voice inbox and the executive summary
  function voiceStats(items, days){
    const now = items.filter(x => inRange(x, days));
    const topics = {}; now.forEach(x => { const t = topics[x.topic] = topics[x.topic] || {n:0, people:new Set(), open:0, kinds:{}}; t.n++; t.people.add(x.anon ? 'anon-'+x.id : x.by); if (x.kind !== 'thanks' && !['done','later'].includes(x.status)) t.open++; t.kinds[x.kind] = (t.kinds[x.kind]||0)+1; });
    const answered = now.filter(x => x.replyAt && x.kind !== 'thanks').map(x => (new Date(x.replyAt) - new Date(x.at)) / 86400000).sort((a,b) => a-b);
    const median = answered.length ? answered[Math.floor(answered.length/2)] : null;
    const open = items.filter(x => x.kind !== 'thanks' && !['done','later'].includes(x.status));
    const waiting = open.filter(x => daysAgo(x.at) >= 7);
    const themes = Object.entries(topics).filter(([,t]) => t.people.size >= 2 && t.kinds.thanks !== t.n).sort((a,b) => b[1].n - a[1].n);
    return {now, topics, median, open, waiting, themes, thanks:now.filter(x => x.kind === 'thanks').length, urgent:open.filter(x => x.urgent)};
  }

  function themes(items, days){
    const s = voiceStats(items, days);
    const rows = Object.entries(s.topics).sort((a,b) => b[1].n - a[1].n);
    return card('', h('h2',null,'Themes in the last '+days+' days'),
      h('p',{class:'small'}, plural(s.now.length,'note')+', '+s.open.length+' still open'+(s.waiting.length ? ', '+s.waiting.length+' waiting a week or more' : '')+'. '+(s.median != null ? 'Typical time to answer: '+(s.median < 1 ? 'same day' : Math.round(s.median)+' days')+'.' : '')),
      rows.length ? h('div',{class:'tablewrap',tabindex:'0',role:'region','aria-label':'Topics table'}, h('table',null,
        h('thead',null,h('tr',null, ['Topic','Notes','People','Open','Kinds'].map(c => h('th',{scope:'col'},c)))),
        h('tbody',null, rows.map(([k,t]) => h('tr',null, h('td',null,topicName(k)), h('td',null,String(t.n)), h('td',null,String(t.people.size)), h('td',null,String(t.open)), h('td',{class:'small'}, Object.entries(t.kinds).map(([kk,n]) => vkind(kk).t.toLowerCase()+' '+n).join(', '))))))) : null,
      s.themes.length ? h('p',{class:'small'}, h('b',null,'Raised by more than one person: '), s.themes.map(([k]) => topicName(k)).join(', ')+'. These are worth a decision, not just a reply.') : null);
  }

  // what the HR employee file shows for one person (named notes only)
  function forStaff(site, name){
    return st().voice.filter(x => x.site === site && !x.anon && x.to !== 'owner' && x.by === name).map(x => ({at:x.at, kind:vkind(x.kind).t, topic:topicName(x.topic), text:x.text, status:(STATUS[x.status]||STATUS.new)[0], reply:x.reply}));
  }
  function staffCard(site, name){
    if (!isMgr() && name !== me()) return null;
    const items = forStaff(site, name);
    return card('', h('h3',null,'🗣️ Staff voice'),
      items.length ? h('p',{class:'small'}, plural(items.length,'note')+' sent: '+['Question','Concern','Idea or want','Thanks'].map(k => [k, items.filter(i => i.kind === k).length]).filter(x => x[1]).map(x => x[0].toLowerCase()+' '+x[1]).join(', ')+'. '+items.filter(i => i.status !== 'Done' && i.kind !== 'Thanks').length+' still open.') : h('p',{class:'small muted'},'No named notes yet.'),
      items.slice(-3).reverse().map(i => h('p',{class:'small'}, chip(i.kind,'grey'), ' ', i.text, i.reply ? h('span',{class:'muted'},' Answer: '+i.reply) : null)),
      h('p',{class:'small muted'},'Speaking up is a good thing. Notes are never used as a write-up.'));
  }

  // =====================================================================
  // EXECUTIVE SUMMARY
  // =====================================================================
  R.brief = v => {
    if (!isMgr() || tierId() === 'rn'){ v.append(head('Executive summary','For managers and owners','Switch "View as" to House manager or Owner to see the summary.')); return; }
    const c = st();
    let days = 30, which = isOwner() ? 'all' : sid();
    v.append(head('Executive summary', isOwner() ? 'Residents and team at a glance' : 'Your home at a glance', 'Patterns from resident choices and what staff are asking for, with the decisions they point to. Codes and first names only; nothing here is a record.'));
    const ctl = h('div',{class:'row'});
    const out = h('div',{class:'grid'});
    v.append(ctl, out);
    const pSel = h('select',{id:'br-days'}, [7,30,90].map(d => h('option',{value:d,selected:d === days || null}, 'Last '+d+' days')));
    pSel.addEventListener('change', () => { days = +pSel.value; draw(); });
    ctl.append(h('label',{class:'f',for:'br-days'},'Period', pSel));
    if (isOwner()){
      const sSel = h('select',{id:'br-site'}, h('option',{value:'all'},'All homes'), sites().map(s => h('option',{value:s.id}, s.name)));
      sSel.addEventListener('change', () => { which = sSel.value; draw(); });
      ctl.append(h('label',{class:'f',for:'br-site'},'Home', sSel));
    }
    function draw(){
      out.textContent = '';
      const list = which === 'all' ? sites().map(s => s.id) : [which];
      const text = [];
      const resRows = [], decisions = [];
      list.forEach(site => (D.RESIDENTS[site]||[]).forEach(r => {
        const p = pattern(site, r.code, days);
        const fresh = p.sug.filter(s => !p.lastAdd || s.last > p.lastAdd);
        resRows.push({site, r, p, fresh});
        p.flags.filter(f => f.lvl === 'amber').forEach(f => decisions.push({k:'check', site, text:r.nick+' ('+r.code+'): '+f.text+'. '+f.next, href:'#/choices/'+encodeURIComponent(r.code)}));
      }));
      list.forEach(site => { const ready = resRows.filter(x => x.site === site && x.fresh.length); if (ready.length) decisions.push({k:'plan', site, text:(ready.length === 1 ? ready[0].r.nick+' has ' : plural(ready.length,'resident')+' have ')+'patterns ready to add to the care plan'+(ready.length > 1 ? ' ('+ready.map(x => x.r.nick).join(', ')+')' : ''), href: ready.length === 1 ? '#/choices/'+encodeURIComponent(ready[0].r.code) : '#/choices'}); });
      const vItems = c.voice.filter(x => list.includes(x.site) && canSee(x));
      const vs = voiceStats(vItems, days);
      vs.urgent.forEach(x => decisions.push({k:'safety', site:x.site, text:'Safety note: '+x.text, href:'#/voice'}));
      vs.themes.forEach(([k, t]) => { if (t.open) decisions.push({k:'theme', site:list.length === 1 ? list[0] : '', text:topicName(k)+': raised by '+t.people.size+' people ('+t.open+' open). Decide and tell the team.', href:'#/voice'}); });
      vs.waiting.filter(x => !x.urgent).forEach(x => decisions.push({k:'wait', site:x.site, text:'Waiting '+daysAgo(x.at)+' days: '+vkind(x.kind).t.toLowerCase()+' about '+topicName(x.topic).toLowerCase(), href:'#/voice'}));
      const withPat = resRows.filter(x => x.p.now.length || x.p.meals.length);
      const head1 = [plural(withPat.length,'resident')+' with choices logged', plural(resRows.filter(x => x.fresh.length).length,'resident')+' with patterns ready for the care plan', plural(vs.now.length,'staff note')+' ('+vs.open.length+' open, '+vs.thanks+' thanks)'];
      if (vs.themes.length) head1.push('top staff theme: '+topicName(vs.themes[0][0]).toLowerCase());
      out.append(card('soft', h('h2',null,'In short'), h('p',null, head1.join(' · ')+'.'),
        h('p',{class:'small muted'}, (which === 'all' ? 'All homes' : siteName(which))+', last '+days+' days. '+(tierId() === 'manager' ? 'Owner-only staff notes are left out of your view.' : ''))));
      text.push('Executive summary: '+(which === 'all' ? 'all homes' : siteName(which))+', last '+days+' days ('+fmtDate(today())+')', head1.join('; ')+'.', '');
      const order = {safety:0, check:1, theme:2, plan:3, wait:4};
      decisions.sort((a,b) => order[a.k] - order[b.k]);
      out.append(card(decisions.some(d => d.k === 'safety') ? 'warn' : '', h('h2',null,'Decisions to make'),
        decisions.length ? h('ol',{class:'small'}, decisions.map(d => h('li',null, list.length > 1 && d.site ? h('b',null, siteName(d.site)+': ') : null, d.text+' ', h('a',{href:d.href,onclick:()=>{ if (d.site && d.site !== sid()){ S().site = d.site; save(); A.fillSwitchers(); } }},'Open')))) : h('p',{class:'small muted'},'Nothing waiting. Nice.')));
      text.push('Decisions to make:'); decisions.forEach((d, i) => text.push((i+1)+'. '+(list.length > 1 && d.site ? siteName(d.site)+': ' : '')+d.text)); text.push('');
      // residents
      const rb = h('div',{class:'grid g2'});
      text.push('Residents (choices and preferences):');
      list.forEach(site => {
        const rows = resRows.filter(x => x.site === site);
        rb.append(card('', h('h3',null, siteName(site)), rows.map(x => h('p',{class:'small'}, sentence(site, x.r.code, days), x.p.flags.length ? [' ', chip(x.p.flags[0].text, x.p.flags[0].lvl === 'amber' ? 'amber' : 'calm')] : null))));
        rows.forEach(x => text.push('- '+(list.length > 1 ? siteName(site)+', ' : '')+sentence(site, x.r.code, days)));
      });
      out.append(h('h2',null,'Residents: choices and preferences'), rb,
        h('p',{class:'small muted'},'Choices are rights. These summaries help the plan fit the person; they are not a list of problems.'));
      text.push('', 'Staff voice:');
      out.append(h('h2',null,'Team: questions, concerns and wants'), themes(vItems, days));
      Object.entries(vs.topics).sort((a,b) => b[1].n - a[1].n).forEach(([k, t]) => text.push('- '+topicName(k)+': '+t.n+' notes from '+t.people.size+' people, '+t.open+' open'));
      if (vs.median != null) text.push('- Typical time to answer: '+(vs.median < 1 ? 'same day' : Math.round(vs.median)+' days'));
      const wants = vs.now.filter(x => x.kind === 'want');
      if (wants.length){
        out.append(card('', h('h3',null,'💡 Ideas and wants'), h('ul',{class:'small'}, wants.map(x => h('li',null, x.text+' ', chip((STATUS[x.status]||STATUS.new)[0], (STATUS[x.status]||STATUS.new)[1]))))));
        text.push('', 'Ideas and wants:'); wants.forEach(x => text.push('- '+x.text+' ('+(STATUS[x.status]||STATUS.new)[0]+')'));
      }
      const qs = (S().questions||[]).filter(q => list.includes(q.site) && daysAgo(q.at) < days);
      if (qs.length){
        const none = qs.filter(q => !q.id).length;
        out.append(card('', h('h3',null,'💬 Procedure questions'), h('p',{class:'small'}, plural(qs.length,'question')+' asked in Procedure check'+(none ? ', '+none+' with no answer in the rulebook yet' : '')+'. ', h('a',{href:'#/questions'},'Open the question log'))));
        text.push('', 'Procedure questions: '+qs.length+' asked'+(none ? ', '+none+' not answered by the rulebook' : '')+'.');
      }
      const ds = c.decisions.filter(d => list.includes(d.site) && daysAgo(d.at) < days);
      if (ds.length){ out.append(card('soft', h('h3',null,'Decisions already shared with the team'), h('ul',{class:'small'}, ds.map(d => h('li',null, d.text+' ('+fmtDate(d.at)+')'))))); text.push('', 'Decided and shared:'); ds.forEach(d => text.push('- '+d.text)); }
      const all = text.join('\n');
      out.append(h('div',{class:'row'},
        h('button',{class:'btn quiet',type:'button',onclick:e => copy(all, e.target)}, 'Copy as text'),
        h('button',{class:'btn quiet',type:'button',onclick:()=>{ download('executive-summary-'+today()+'.txt', all, 'text/plain'); audit('Downloaded the executive summary'); }}, 'Download'),
        h('button',{class:'btn quiet',type:'button',onclick:()=>window.print()}, 'Print')),
        h('p',{class:'foot'},'Sample data. Staff names are left out of the summary; anonymous notes stay anonymous. Test version: everything stays in this browser.'));
    }
    draw();
  };

  // =====================================================================
  // REGISTER
  // =====================================================================
  VIEWS.choices = {t:'Resident choices', ic:'🌱'};
  VIEWS.voice = {t:'Staff voice', ic:'🗣️'};
  VIEWS.brief = {t:'Executive summary', ic:'📑'};
  const addNav = (t, id, after) => { const n = NAV[t]; if (!n || n.includes(id)) return; const at = after && n.indexOf(after) >= 0 ? n.indexOf(after)+1 : n.length; n.splice(at, 0, id); };
  addNav('caregiver','choices','report'); addNav('caregiver','voice','choices');
  addNav('manager','brief','home'); addNav('manager','voice','questions'); addNav('manager','choices','voice');
  addNav('rn','choices','orders'); addNav('rn','voice','choices');
  addNav('owner','brief','owner'); addNav('owner','voice','brief'); addNav('owner','choices','voice');
  addNav('multi','brief','sites'); addNav('multi','voice','brief'); addNav('multi','choices','voice');
  try { if (D.SCHED && D.SCHED.perms && !D.SCHED.perms.some(p => p.id === 'voice.read')) D.SCHED.perms.push({id:'voice.read', name:'Read and answer staff notes sent to the manager', mod:'voice'}); } catch(e){}
  if (window.SSAccess && SSAccess.register) try {
    SSAccess.register({id:'choices', name:'Resident choices', ic:'🌱', what:'Food, smoking, routine and other choices logged as resident rights, with patterns that feed the care plan and face sheet.', views:['choices'], tiers:['caregiver','manager','rn','owner','multi']});
    SSAccess.register({id:'voice', name:'Staff voice', ic:'🗣️', what:'Staff questions, concerns, ideas and thanks, routed to the manager, nurse or owner, with answers and "you asked, we did".', views:['voice'], tiers:['caregiver','manager','rn','owner','multi']});
    SSAccess.register({id:'brief', name:'Executive summary', ic:'📑', what:'One page for managers and owners: resident patterns, staff themes and the decisions they point to.', views:['brief'], tiers:['manager','owner','multi']});
  } catch(e){}
  const on = view => { try { return !window.SSAccess || SSAccess.viewOn(view); } catch(e){ return true; } };

  A.homeHooks = A.homeHooks || []; A.ownerHooks = A.ownerHooks || [];
  A.homeHooks.push((v, t) => {
    if (sid() === 'family') return;
    const tiles = [];
    if (t === 'caregiver'){
      if (on('choices')) tiles.push(A.tile('choices','🌱','Log a choice','Food, smoking, routine: what residents chose or said no to.'));
      if (on('voice')){ const unread = mine().filter(x => x.replyAt && x.replyAt > (st().seen['voice|'+me()] || '')).length; tiles.push(A.tile('voice','🗣️', unread ? plural(unread,'new answer')+' to your notes' : 'Ask or share an idea', 'Questions, concerns and ideas, to your manager or the owner.', unread ? 'urgent' : '')); }
    }
    if (t === 'manager'){
      const open = st().voice.filter(x => canSee(x) && x.kind !== 'thanks' && !['done','later'].includes(x.status));
      const urg = open.filter(x => x.urgent).length;
      if (on('voice')) tiles.push(A.tile('voice','🗣️', open.length ? plural(open.length,'staff note')+' to answer' : 'Staff voice', urg ? plural(urg,'safety note')+' first.' : 'Questions, concerns and ideas from your team.', urg ? 'urgent' : ''));
      if (on('brief')) tiles.push(A.tile('brief','📑','Executive summary','Resident patterns and team themes, with decisions to make.'));
    }
    if (tiles.length) v.append(h('div',{class:'grid g2'}, tiles));
  });
  A.ownerHooks.push(v => {
    if (!on('brief')) return;
    const vs = voiceStats(st().voice, 30);
    const ready = sites().reduce((n, s) => n + (D.RESIDENTS[s.id]||[]).filter(r => { const p = pattern(s.id, r.code, 30); return p.sug.some(x => !p.lastAdd || x.last > p.lastAdd); }).length, 0);
    v.append(card('soft', h('h2',null,'📑 Executive summary'),
      h('p',{class:'small'}, plural(vs.open.length,'staff note')+' open'+(vs.waiting.length ? ' ('+vs.waiting.length+' waiting a week or more)' : '')+(vs.themes.length ? '; top theme: '+topicName(vs.themes[0][0]).toLowerCase() : '')+'. '+plural(ready,'resident')+' with patterns ready for the care plan.'),
      h('div',{class:'row'}, h('a',{class:'btn sm',href:'#/brief'},'Open the summary'), h('a',{class:'btn quiet sm',href:'#/voice'},'Staff voice'))));
  });
  // mark answers as seen when a caregiver opens their notes
  window.addEventListener('hashchange', () => { if (/^#\/voice/.test(location.hash) && tierId() === 'caregiver'){ st().seen['voice|'+me()] = new Date().toISOString(); save(); } });

  // face sheet block: a short "choices" line under the care plan summary
  function faceBlock(code){
    if (!on('choices')) return null;
    const p = pattern(sid(), code, 30);
    if (!p.now.length && !p.meals.length) return null;
    const sp = st().smoke[code];
    return h('div',{class:'card soft'}, h('h3',null,'🌱 Recent choices'), h('p',{class:'small'}, sentence(sid(), code, 30).replace(/^[^:]+: /,'')),
      sp ? h('p',{class:'small'}, h('b',null,'Smoking: '), sp.safety+'; '+sp.where+'. '+sp.keeps+'.') : null,
      h('a',{class:'small',href:'#/choices/'+encodeURIComponent(code)},'Open choices'));
  }

  window.SSChoices = {pattern, sentence, planLines, faceBlock, log:x => { st().res.push(Object.assign({id:uid(), site:sid(), at:new Date().toISOString(), by:me(), when:'', said:'', offered:'', helped:''}, x)); save(); }};
  window.SSVoice = {forStaff, card:staffCard, stats:(site, days) => voiceStats(st().voice.filter(x => !site || x.site === site), days || 30)};
})();
