// Steady Shift test app: one place for every required report (Wisconsin, sample data only).
// Staff describe what happened once on "Report something". This file works out every report that event needs,
// who gets each one (DQA regional office from the home's county, licensing agency, Misconduct Reporting System,
// police, county adult protective services, ombudsman, health department, MCO, guardian), the deadline,
// and a pre-filled draft for each. Each report is tracked until it's marked sent, and a copy is filed for the home.
// Rules and contacts come from data/reports/wi-reports.json (DQA P-02007, DHS 88, DHS 83). Not legal advice.
(function(){
  const A = window.SSApp; if (!A) return;
  const {D, h, toast, copy, head, fmtTime, R, uid} = A;
  const S = () => A.state();
  const ap = (el, ...k) => { el.append(...k.flat(9).filter(x => x != null && x !== false)); return el; };

  let RJ = null, RERR = '';
  function load(){
    if (RJ) return Promise.resolve(RJ);
    return fetch('../data/reports/wi-reports.json',{cache:'no-cache'}).then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(j => { RJ = j; j.events.forEach(e => e.re = new RegExp(e.match,'i')); countyList(); return j; })
      .catch(e => { RERR = 'Could not load the report rules ('+e.message+').'; return null; });
  }
  load();

  // County list for Facility setup (a datalist the setup screen points to).
  function countyList(){
    if (document.getElementById('wiCounties')) return;
    const dl = h('datalist',{id:'wiCounties'});
    Object.values(RJ.regions).flatMap(r => r.counties).sort().forEach(c => dl.append(h('option',{value:c})));
    document.body.append(dl);
  }

  // ---------- facility ----------
  const facOf = id => { const s = S(); s.facility = s.facility || {}; return s.facility[id] || (s.facility[id] = {profile:{}, docs:[]}); };
  const normCounty = c => String(c||'').trim().replace(/\s+county$/i,'').replace(/^st\.?\s+/i,'St. ').toLowerCase();
  function regionFor(county){
    const n = normCounty(county); if (!n || !RJ) return null;
    for (const k in RJ.regions){ const r = RJ.regions[k]; if (r.counties.some(c => c.toLowerCase() === n)) return Object.assign({key:k}, r); }
    return null;
  }
  const setting = () => A.setting();

  // ---------- recipients resolved for this home ----------
  function resolve(key){
    const rc = RJ.recipients[key] || {name:key};
    const p = facOf(S().site).profile || {};
    const reg = regionFor(p.county);
    const lines = [];
    let name = rc.name, warn = '';
    const regionLines = () => { if (reg){ lines.push(reg.name+' ('+reg.city+'), for '+p.county.replace(/\s+county$/i,'')+' County'); lines.push('Fax '+reg.fax+' · Email '+reg.email+' · Phone '+reg.phone); } else warn = 'Add your county in Facility setup to see the right regional office.'; };
    if (key === 'dqa_region'){ regionLines(); }
    else if (key === 'licensing'){
      if (p.licensor === 'county'){ name = 'County licensing agency'; lines.push('Your home was licensed by '+(p.county ? p.county.replace(/\s+county$/i,'')+' County' : 'a county')+'. Use the contact on your license.'); }
      else { name = 'Licensing agency: DQA regional office'; regionLines(); }
    }
    else if (key === 'aps'){ lines.push(p.aps ? 'County intake: '+p.aps : 'Add the county adult protective services number in Facility setup.'); if (!p.aps) warn = warn || ''; }
    else if (key === 'ombudsman'){ lines.push('Ombudsman (60 and over): '+RJ.recipients.ombudsman.phone); lines.push('Under 60: Disability Rights Wisconsin (check the number at disabilityrightswi.org)'); }
    else {
      if (rc.phone) lines.push('Phone '+rc.phone);
      if (rc.fax) lines.push('Fax '+rc.fax);
      if (rc.email) lines.push('Email '+rc.email);
    }
    return {key, name, how:rc.how||'', lines, warn, status:rc.status};
  }

  // ---------- deadlines ----------
  function addBusinessDays(d, n){ const x = new Date(d); let k = 0; while (k < n){ x.setDate(x.getDate()+1); const w = x.getDay(); if (w && w !== 6) k++; } return x; }
  function due(clock, start){
    const s = new Date(start); if (isNaN(s)) return null;
    switch (clock.type){
      case 'immediate': return s;
      case 'hours': return new Date(+s + clock.n*36e5);
      case 'days': { const x = new Date(s); x.setDate(x.getDate()+clock.n); return x; }
      case 'business_days': { const x = addBusinessDays(s, clock.n); x.setHours(23,59,0,0); return x; }
      case 'next_business_day': { const x = addBusinessDays(s, 1); x.setHours(23,59,0,0); return x; }
      default: return null;
    }
  }
  function clockText(c){
    switch (c.type){
      case 'immediate': return 'Right away';
      case 'hours': return 'Within '+c.n+' hours';
      case 'days': return 'Within '+c.n+' calendar days';
      case 'business_days': return 'Within '+c.n+' working days';
      case 'next_business_day': return 'By the next business day';
      case 'before_days': return 'At least '+c.n+' days before';
      default: return 'No set deadline';
    }
  }
  function left(d, clock){
    if (!d) return {t:'', cls:'grey'};
    if (clock && clock.type === 'immediate') return {t:'Right away', cls:'red'};
    const ms = d - new Date(), hr = Math.abs(ms)/36e5;
    const amt = hr < 1 ? Math.max(1,Math.round(hr*60))+' min' : hr < 48 ? Math.round(hr)+' h' : Math.round(hr/24)+' days';
    if (ms <= 0) return {t: hr < 0.02 ? 'Due now' : 'Overdue by '+amt, cls:'red'};
    return {t:'Due in '+amt, cls: hr < 6 ? 'red' : hr < 24 ? 'amber' : 'calm'};
  }
  const STAT = {verified:['Verified','calm'], unverified:['Unverified','amber'], open:['Open question','red'], house:['Contract or house rule','grey']};
  const statChip = s => { const x = STAT[s] || [s,'grey']; return h('span',{class:'chip '+x[1]},x[0]); };

  // ---------- which reports an event set needs ----------
  function applies(rep, st, pay){ return rep.settings.includes(st) && (!rep.when_pay || (pay||[]).includes(rep.when_pay)); }
  function compute(eventIds, start){
    const st = setting(), pay = (facOf(S().site).profile||{}).pay;
    const all = RJ.events.concat(RJ.changes);
    const byKey = {};
    eventIds.forEach(id => {
      const ev = all.find(e => e.id === id); if (!ev) return;
      ev.reports.filter(r => applies(r, st, pay)).forEach(r => {
        const k = r.to+'|'+(r.form||'')+'|'+(r.required?1:0);
        const d = due(r.clock, start);
        const cur = byKey[k];
        const cs = String(r.cite||'').split(/;\s*/).filter(Boolean);
        if (!cur){ byKey[k] = {k, to:r.to, form:r.form||'', required:r.required, clock:r.clock, due:d ? d.toISOString() : '', cites:cs, notes:[r.note].filter(Boolean), status:r.status, events:[ev.title]}; return; }
        cs.forEach(x => { if (!cur.cites.includes(x)) cur.cites.push(x); });
        if (r.note && !cur.notes.includes(r.note)) cur.notes.push(r.note);
        if (!cur.events.includes(ev.title)) cur.events.push(ev.title);
        if (r.status === 'open') cur.status = 'open';
        if (d && (!cur.due || d < new Date(cur.due))){ cur.due = d.toISOString(); cur.clock = r.clock; }
      });
    });
    const rank = c => ({immediate:0, hours:1, next_business_day:2, business_days:3, days:4, before_days:5, none:6}[c.type] ?? 7);
    return Object.values(byKey).sort((a,b) => (b.required - a.required) || ((a.due && b.due) ? new Date(a.due) - new Date(b.due) : rank(a.clock) - rank(b.clock)));
  }

  // ---------- pre-filled draft for one report ----------
  function draft(item, c){
    const s = A.site(), p = facOf(s.id).profile || {}, rc = resolve(item.to);
    return [
      'TEST DATA. Do not send real resident information from the test app.',
      'To: '+rc.name+(rc.lines.length ? ' ('+rc.lines.join('; ')+')' : ''),
      item.form ? 'Form: '+item.form : null,
      'Regarding: '+item.events.join('; '),
      'Facility: '+s.name+' ('+D.SETTINGS[s.setting].short+')'+(p.county ? ', '+p.county.replace(/\s+county$/i,'')+' County' : ''),
      'Rule: '+(item.cites.join('; ') || 'not a state rule'),
      '',
      c.text
    ].filter(x => x !== null).join('\n');
  }

  // ---------- panel shown under the professional version on "Report something" ----------
  function panel(out, r){
    const wrap = h('div',{class:'card soft'}); out.append(wrap);
    load().then(j => {
      if (!j){ wrap.append(h('p',null,RERR)); return; }
      if (setting() === 'home'){ wrap.append(h('h3',null,'Who needs to know'), h('p',{class:'small'},'Family caregivers at home don\'t report to DQA. If someone may be harmed, call 911 or the county adult protective services line.')); return; }
      const text = r.x.raw+' '+r.facts;
      const found = j.events.filter(e => e.re.test(text)).map(e => e.id);
      const picked = new Set(found);
      ap(wrap, h('h2',null,'Reports this needs'),
        h('p',{class:'small'},'We matched what you wrote to these events. Tick anything else that happened, untick anything that didn\'t. The clock starts at the time you entered: '+(r.x.when ? fmtTime(r.x.when) : 'now')+'.'));
      const groups = {}; j.events.forEach(e => (groups[e.group] = groups[e.group] || []).push(e));
      const box = h('div',{class:'grid'});
      const fs = h('fieldset',{style:'border:0;padding:0;margin:0'}, h('legend',{class:'small muted'},'What happened'));
      const shown = h('div',{class:'list'});
      const more = h('details',null,h('summary',{style:'cursor:pointer'},'Something else happened'), h('div',{class:'list'}));
      const tick = e => { const cb = h('input',{type:'checkbox',checked:picked.has(e.id)}); cb.addEventListener('change',()=>{ cb.checked ? picked.add(e.id) : picked.delete(e.id); draw(); }); return h('label',{class:'row small'},cb,e.title); };
      j.events.filter(e => found.includes(e.id)).forEach(e => shown.append(tick(e)));
      if (!found.length) shown.append(h('p',{class:'small muted'},'Nothing in your note matched a reportable event.'));
      Object.keys(groups).forEach(g => { const l = groups[g].filter(e => !found.includes(e.id)); if (l.length) more.lastChild.append(h('b',{class:'small'},g), l.map(tick)); });
      ap(fs, shown, more); wrap.append(fs, box);
      function draw(){
        box.textContent = '';
        const items = compute([...picked], r.x.when || new Date());
        if (!items.length){ box.append(h('p',{class:'small'},'No state report is needed for this. Your manager still sees it in their review list.')); return; }
        const req = items.filter(i => i.required);
        box.append(h('p',null,h('b',null,req.length+' required'), items.length > req.length ? ', plus '+(items.length-req.length)+' to consider' : ''));
        box.append(h('div',{class:'list'}, items.map(i => itemRow(i))));
        const start = h('button',{class:'btn',type:'button'},'Track these reports');
        start.addEventListener('click',()=>{
          const s = S(); s.cases = s.cases || [];
          const c = {id:uid(), site:s.site, setting:setting(), at:new Date(r.x.when||Date.now()).toISOString(), created:new Date().toISOString(), events:[...picked], titles:items.flatMap(i=>i.events).filter((x,k,a)=>a.indexOf(x)===k), resident:r.x.res||'', text:r.text, items:items.map(i => Object.assign({}, i, {state:'todo'}))};
          s.cases.unshift(c);
          s.reports.push({id:uid(), site:s.site, at:new Date().toISOString(), type:c.titles.join(', ')||'General', status:'Waiting for manager', resident:r.x.res, raw:r.x.raw, clean:r.text, by:A.tier().name+' (you)', caseId:c.id});
          A.save(); toast('Filed for '+A.site().name+'. Each report is tracked below.');
          A.go('report/case:'+c.id);
        });
        box.append(h('div',{class:'row'}, start), h('p',{class:'small muted'},'Tracking files a copy of the report for this home, sends it to your manager\'s review list, and starts a timer for each report.'));
      }
      draw();
    });
  }
  function itemRow(i){
    const rc = resolve(i.to), d = i.due ? new Date(i.due) : null, lf = left(d);
    return h('div',{class:'item'},
      h('div',{class:'chips'}, i.required ? h('span',{class:'chip '+(lf.cls==='grey'?'calm':lf.cls)}, clockText(i.clock)) : h('span',{class:'chip grey'},'Consider'), statChip(i.status), i.form ? h('span',{class:'chip grey'},'Form '+i.form) : null),
      h('b',null,rc.name),
      rc.lines.map(l => h('span',{class:'small'},l)),
      rc.warn ? h('span',{class:'small'},h('a',{href:'#/setup'},rc.warn)) : null,
      d && i.clock.type !== 'immediate' ? h('span',{class:'small'},'Due '+fmtTime(d)+(i.clock.type==='business_days'||i.clock.type==='next_business_day'?' (weekends skipped; check for state holidays)':'')) : null,
      i.notes.map(n => h('span',{class:'small muted'},n)),
      i.cites.length ? h('span',{class:'small muted'},'Rule: '+i.cites.join('; ')) : null);
  }

  // ---------- tracking one filed case ----------
  const METHODS = ['Fax','Email','Misconduct Reporting System (online)','Phone','In person','Online portal (other)'];
  function caseView(v, id){
    const s = S(); const c = (s.cases||[]).find(x => x.id === id && x.site === s.site);
    if (!c){ v.append(h('div',{class:'card'},'That report isn\'t in this home\'s file.')); return; }
    load().then(j => {
      if (!j){ v.append(h('div',{class:'card alert'},RERR)); return; }
      const done = c.items.filter(i => i.state === 'sent').length, req = c.items.filter(i => i.required);
      v.append(head('Report tracker · '+A.site().name, c.titles.join(', ') || 'Report', 'Filed '+fmtTime(c.created)+'. '+done+' of '+c.items.length+' sent. Clocks started '+fmtTime(c.at)+'.'));
      if (req.some(i => i.state !== 'sent' && i.clock.type !== 'immediate' && i.due && new Date(i.due) < new Date())) v.append(h('div',{class:'card alert',role:'alert'},h('b',null,'A required report is past due.'),h('span',null,'Send it now and note why it was late. Late is better than never.')));
      c.items.forEach(i => {
        const rc = resolve(i.to), d = i.due ? new Date(i.due) : null, lf = left(d, i.clock);
        const card = h('div',{class:'card'+(i.state==='sent'?' calm':'')});
        ap(card, h('div',{class:'chips'}, i.state === 'sent' ? h('span',{class:'chip calm'},'Done '+fmtTime(i.sent.at)) : i.required ? h('span',{class:'chip '+lf.cls}, d ? lf.t : clockText(i.clock)) : h('span',{class:'chip grey'},'Consider'), statChip(i.status), i.form ? h('span',{class:'chip grey'},'Form '+i.form) : null),
          h('h2',null,rc.name), rc.lines.map(l => h('p',{class:'small'},l)), rc.how ? h('p',{class:'small muted'},rc.how) : null,
          i.notes.map(n => h('p',{class:'small'},n)), i.cites.length ? h('p',{class:'cite'},'Rule: '+i.cites.join('; ')) : null);
        if (i.state === 'sent'){ card.append(h('p',{class:'small'},'Sent by '+i.sent.method+(i.sent.conf ? ' · '+i.sent.conf : '')+' · marked by '+i.sent.by)); v.append(card); return; }
        const txt = draft(i, c);
        const pre = h('details',null,h('summary',{style:'cursor:pointer'},'Pre-filled draft'),h('div',{class:'out'},txt));
        const cb = h('button',{class:'btn ghost sm',type:'button'},'Copy draft'); cb.addEventListener('click',()=>copy(txt, cb));
        const isRec = i.to === 'record' || i.to === 'e911';
        const mk = h('button',{class:'btn sm',type:'button'},isRec ? 'Mark done' : 'Mark sent');
        const row = h('div',{class:'row noprint'}, cb, mk);
        mk.addEventListener('click',()=>{
          if (card.querySelector('form')) return;
          const now = new Date(); now.setMinutes(now.getMinutes()-now.getTimezoneOffset());
          const m = h('select',null,(isRec ? ['Done','Phone'] : METHODS).map(x=>h('option',null,x))), t = h('input',{type:'datetime-local',value:now.toISOString().slice(0,16)}), cf = h('input',{type:'text',maxlength:'120',placeholder:'Confirmation number, or who you spoke with (role)'});
          const f = h('form',{class:'grid'}, h('div',{class:'grid g2'},h('label',{class:'f'},'How',m),h('label',{class:'f'},'When',t)), h('label',{class:'f'},'Confirmation',cf), h('div',{class:'row'},h('button',{class:'btn sm',type:'submit'},'Save'),h('button',{class:'btn quiet sm',type:'button',onclick:()=>f.remove()},'Cancel')));
          f.addEventListener('submit', e => { e.preventDefault(); i.state = 'sent'; i.sent = {method:m.value, at:new Date(t.value).toISOString(), conf:cf.value.trim(), by:A.tier().name}; A.save(); toast(isRec ? 'Marked done' : 'Marked sent'); A.route(); });
          card.append(f); m.focus();
        });
        ap(card, pre, row); v.append(card);
      });
      v.append(h('details',{class:'card'},h('summary',{style:'cursor:pointer;font-weight:700'},'Copy filed for this home'),h('div',{class:'out'},c.text)));
      v.append(h('div',{class:'row noprint'}, h('a',{class:'btn ghost sm',href:'#/report'},'Back to Report something'), h('a',{class:'btn ghost sm',href:'#/required'},'All required reports'), h('button',{class:'btn ghost sm',type:'button',onclick:()=>window.print()},'Print')));
      v.append(h('p',{class:'foot'},'Test version. '+j.disclaimer));
    });
  }

  // Open cases for this home, shown above the report form.
  function openCases(v){
    const s = S(), list = (s.cases||[]).filter(c => c.site === s.site && c.items.some(i => i.required && i.state !== 'sent'));
    if (!list.length) return;
    const card = h('div',{class:'card warn'}, h('h2',null,'Reports still to send ('+list.length+')'));
    card.append(h('div',{class:'list'}, list.slice(0,5).map(c => {
      const next = c.items.filter(i => i.required && i.state !== 'sent' && i.due && i.clock.type !== 'immediate').sort((a,b) => new Date(a.due)-new Date(b.due))[0];
      const lf = left(next ? new Date(next.due) : null);
      return h('a',{class:'item',href:'#/report/case:'+c.id}, h('b',null,c.titles.join(', ')||'Report'), h('span',{class:'small'}, c.items.filter(i=>i.state==='sent').length+' of '+c.items.length+' sent'+(next ? ' · next: '+lf.t : '')));
    })));
    v.append(card);
  }

  // ---------- "Required reports": everything an AFH or CBRF must report, keep and do ----------
  const TABS = [['events','When something happens'],['changes','Changes at the home'],['records','Records to keep'],['duties','Regular duties'],['where','Where reports go']];
  R.required = v => {
    const st0 = setting();
    v.append(head('Required reports', 'Every report, record and regular duty', 'Wisconsin rules for '+(st0==='cbrf'?'CBRFs (DHS 83)':'adult family homes (DHS 88)')+'. Use "Report something" when it happens: it works these out for you.'));
    const area = h('div',{class:'grid'}); v.append(area);
    load().then(j => {
      if (!j){ area.append(h('div',{class:'card alert'},RERR)); return; }
      if (st0 === 'home'){ area.append(h('div',{class:'card'},'Family caregivers at home have no state reports. Switch to a licensed home to see its list.')); return; }
      const st = st0, s = A.site(), p = facOf(s.id).profile || {}, reg = regionFor(p.county);
      let tab = (A.param()||'events'); if (!TABS.some(t => t[0]===tab)) tab = 'events';
      const bar = h('div',{class:'chips noprint',role:'tablist','aria-label':'Sections'});
      TABS.forEach(([k,t]) => bar.append(h('a',{class:'chip'+(k===tab?' calm':' grey'),href:'#/required/'+k,role:'tab','aria-selected':String(k===tab)},t)));
      area.append(bar);
      const body = h('div',{class:'grid',style:'overflow-wrap:anywhere;min-width:0'}); area.append(body);
      const nm = k => k === 'dqa_region' && reg ? 'DQA '+reg.name : k === 'licensing' ? (p.licensor==='county' ? 'County licensing agency' : 'Licensing agency (DQA regional office'+(reg?', '+reg.city:'')+')') : (j.recipients[k]||{name:k}).name;
      const repTable = list => h('div',{class:'tablewrap',tabindex:'0',role:'region','aria-label':'Table, scrolls sideways'}, h('table',{class:'t'},
        h('thead',null,h('tr',null,['What','Who gets it','Deadline','Form','Rule',''].map(x=>h('th',{scope:'col'},x)))),
        h('tbody',null, list.flatMap(e => {
          const rs = e.reports.filter(r => r.settings.includes(st));
          if (!rs.length) return [];
          return rs.map((r,k) => h('tr',null, h('td',null,k ? '' : h('b',null,e.title), k===0 && e.not_dqa ? h('div',{class:'small muted'},e.not_dqa) : null), h('td',null,nm(r.to), r.required ? null : h('div',{class:'small muted'},'If it applies'), r.when_pay ? h('div',{class:'small muted'},'If '+r.when_pay) : null), h('td',null,clockText(r.clock)), h('td',null,r.form||''), h('td',{class:'small'},r.cite||''), h('td',null,statChip(r.status))));
        }))));
      if (tab === 'events'){
        if (!reg) body.append(h('div',{class:'card soft'},h('span',{class:'small'},h('a',{href:'#/setup'},'Add this home\'s county in Facility setup'),' so reports go to the right DQA regional office.')));
        const groups = {}; j.events.forEach(e => (groups[e.group] = groups[e.group] || []).push(e));
        Object.keys(groups).forEach(g => body.append(h('div',{class:'card'}, h('h2',null,g), repTable(groups[g]))));
        body.append(h('div',{class:'card soft'}, h('h3',null,'Open questions we flag'), h('ul',null, j.open_questions.map(q => h('li',null,q.q,' ',h('b',null,q.app))))));
      }
      if (tab === 'changes') body.append(h('div',{class:'card'}, h('h2',null,'Planned changes'), h('p',{class:'small muted'},'These are sent ahead of time, not after an incident.'), repTable(j.changes)));
      const kept = (list, keyRule) => {
        const rows = list.map(x => ({t:x.title, d:x[st]})).filter(x => x.d);
        const miss = list.filter(x => !x[st]);
        const c = h('div',{class:'card'});
        if (rows.length) c.append(h('div',{class:'tablewrap',tabindex:'0',role:'region','aria-label':'Table, scrolls sideways'},h('table',{class:'t'}, h('thead',null,h('tr',null,['What',keyRule==='every'?'How often':'Rule','Keep for','Rule cite',''].map(x=>h('th',{scope:'col'},x)))),
          h('tbody',null, rows.map(x => h('tr',null, h('td',null,h('b',null,x.t)), h('td',null,x.d[keyRule]||x.d.rule||''), h('td',null,x.d.keep||''), h('td',{class:'small'},x.d.cite||''), h('td',null,statChip(x.d.status))))))));
        if (miss.length) c.append(h('p',{class:'small muted'},'Still being checked for '+(st==='cbrf'?'CBRFs':'adult family homes')+': '+miss.map(x=>x.title).join(', ')+'.'));
        return c;
      };
      if (tab === 'records') body.append(kept(j.records, 'rule'));
      if (tab === 'duties') body.append(kept(j.periodic, 'every'));
      if (tab === 'where'){
        if (reg) body.append(h('div',{class:'card calm'}, h('h2',null,'For '+s.name+': '+reg.name), h('p',null,reg.address), h('p',null,'Phone '+reg.phone+' · Fax '+reg.fax+' · '+reg.email),
          h('p',{class:'small muted'},'DQA asks for completed forms to be faxed or emailed to the regional office for the home\'s county, unless the form says otherwise (P-02007).')));
        else body.append(h('div',{class:'card soft'},h('a',{href:'#/setup'},'Add this home\'s county in Facility setup'),' to pick its regional office.'));
        const other = ['dqa_death','plan_review','mrs','health','ombudsman','drw'].map(k => ({k, r:j.recipients[k]}));
        body.append(h('div',{class:'card'}, h('h2',null,'Statewide offices'), h('div',{class:'list'}, other.map(({r}) => h('div',{class:'item'}, h('b',null,r.name), h('span',{class:'small'},r.how), r.email ? h('span',{class:'small'},r.email) : null, r.phone ? h('span',{class:'small'},r.phone) : null, r.fax ? h('span',{class:'small'},'Fax '+r.fax) : null)))));
        body.append(h('div',{class:'card'}, h('h2',null,'All four DQA regional offices'), h('div',{class:'tablewrap',tabindex:'0',role:'region','aria-label':'Table, scrolls sideways'},h('table',{class:'t'},
          h('thead',null,h('tr',null,['Office','Contact','Counties'].map(x=>h('th',{scope:'col'},x)))),
          h('tbody',null, Object.values(j.regions).map(r => h('tr',null, h('td',null,h('b',null,r.name),h('div',{class:'small'},r.address)), h('td',{class:'small'},'Phone '+r.phone,h('br'),'Fax '+r.fax,h('br'),r.email), h('td',{class:'small'},r.counties.join(', ')))))))));
      }
      area.append(h('p',{class:'foot'},'Sources: '+Object.values(j.sources).map(x=>x.title).join('; ')+'. Checked '+j.checked+'. '+j.disclaimer));
    });
  };

  window.SSReports = {panel, caseView, openCases, regionFor, load};
})();
