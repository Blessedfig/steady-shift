// Steady Shift test app: resident grievance log (#/grievance).
// A resident, family member, guardian or advocate raises a complaint; the home records it in the person's words, looks
// into it, and writes the summary the rules ask for: the grievance, what was found and what was done, sent to the
// resident and others and filed in the record (AFH DHS 88.10(5)(d); CBRF DHS 83.33, text still being checked).
// It also shows where else a resident can go (licensing agency, ombudsman, MCO for Family Care members) and keeps
// retaliation out. Rule text from the Wisconsin compliance rulebook and required-reports data (read 2026-11-26/27).
// Sample data only. State lives in S.care.grievances (this browser only).
(function(){
  const A = window.SSApp, C = window.SSCare;
  if (!A || !C) return;
  const {h, save, toast, head, R, VIEWS, NAV, uid, fmtDate, site, tier} = A;
  const S = () => A.state();
  const {chip, card, helpBox, today, addDays} = C;
  const residents = () => (A.residents ? A.residents() : (A.D.RESIDENTS[S().site] || []));
  const setting = () => (site() || {}).setting;
  const isMgr = () => ['manager','owner','multi','rn'].includes(S().tier);
  const CHECKED = '2026-11-27';
  const TARGET_DAYS = 10; // house default for a written answer; the home's own procedure may set a different time

  const RULE = {
    afh:{cite:'DHS 88.10(5)(d)', text:'Write a summary of the grievance, what you found and what you did. Give it to the resident and the others involved, and file it in the record.', status:'Rule text read'},
    cbrf:{cite:'DHS 83.33', text:'Follow the written grievance procedure given at admission. Send a written summary of findings and action to the resident, their representative and case manager, and keep a copy of the investigation (2 years, DHS 83.13(2)(a)).', status:'Being checked'}
  };
  const FROM = ['Resident','Family member','Guardian or POA','Advocate or ombudsman','Staff member on the resident\'s behalf','Other'];
  const TOPICS = ['Care or services','Food','Rights or privacy','Another resident','A staff member','Money or belongings','Room or building','Rules or house routines','Other'];
  const STAGES = {open:['Open','amber'], looking:['Looking into it','amber'], answered:['Answered','calm'], closed:['Closed','grey']};

  function st(){
    const c = C.ensure();
    if (!Array.isArray(c.grievances)) c.grievances = seed();
    return c.grievances;
  }
  function seed(){
    const t = today();
    return [
      {id:uid(), site:'birch', res:'B-5', from:'Family member', topic:'Food', got:addDays(t,-12), words:'Dad says dinner is cold by the time it reaches his room.', anon:false,
        stage:'answered', steps:[{at:addDays(t,-11), by:'House manager (sample)', note:'Talked with B-5 and the evening cook. Trays wait about 15 minutes on the cart.'}],
        found:'Trays for the east hall waited on the cart while the dining room was served first.', action:'East hall trays now go out first, in a covered insulated cart. Checked temps for 5 nights.',
        sentTo:['Resident','Family member','Case manager'], sentOn:addDays(t,-6), by:'House manager (sample)'},
      {id:uid(), site:'maple', res:'M-4', from:'Resident', topic:'Rules or house routines', got:addDays(t,-3), words:'I want my shower after lunch, not in the morning.', anon:false,
        stage:'looking', steps:[{at:addDays(t,-2), by:'Licensee (sample)', note:'Checked the schedule. The morning slot was set for staffing, not by M-4.'}], found:'', action:'', sentTo:[], sentOn:'', by:''}
    ];
  }
  const daysSince = d => Math.round((new Date(today()+'T12:00:00') - new Date(d+'T12:00:00')) / 864e5);
  const overdue = g => (g.stage === 'open' || g.stage === 'looking') && daysSince(g.got) > TARGET_DAYS;

  R.grievance = v => {
    const set = setting(), rule = RULE[set];
    if (!rule){ v.append(head('Grievances', 'For licensed homes', 'This log is for adult family homes and CBRFs.')); return; }
    const sid = S().site, all = st(), list = all.filter(g => g.site === sid).sort((a,b) => b.got.localeCompare(a.got));
    v.append(head('Grievances · '+site().name, 'Complaints from residents and families', 'Write it down in their words, look into it, and send a written answer. Raising a concern must never cost a resident anything.'));
    v.append(card('soft', h('div',{class:'meta'}, chip('Rule says','calm'), h('span',{class:'small muted'},rule.cite+' · '+rule.status)), h('span',{class:'small'},rule.text)));

    // new grievance (any staff member can write one down for a resident)
    const res = h('select',{'aria-label':'Resident'}, residents().map(r => h('option',{value:r.code},'Resident '+r.code)));
    const from = h('select',{'aria-label':'Who raised it'}, FROM.map(x => h('option',null,x)));
    const topic = h('select',{'aria-label':'Topic'}, TOPICS.map(x => h('option',null,x)));
    const got = h('input',{type:'date',value:today(),max:today()});
    const words = h('textarea',{maxlength:'600',placeholder:'Their words, as close as you can. For example: "Nobody answers my call light at night."'});
    const f = h('form',{class:'card'}, h('h2',null,'Write down a grievance'),
      h('p',{class:'small muted'},'Anyone on staff can take a complaint. Write what they said, not what you think of it. The manager gets it right away.'),
      h('div',{class:'grid g2'}, h('label',{class:'f'},'About',res), h('label',{class:'f'},'Raised by',from)),
      h('div',{class:'grid g2'}, h('label',{class:'f'},'Topic',topic), h('label',{class:'f'},'Date received',got)),
      h('label',{class:'f'},'What they said',words),
      h('button',{class:'btn',type:'submit'},'Save and send to the manager'));
    f.addEventListener('submit', e => { e.preventDefault();
      if (words.value.trim().length < 5) return toast('Write what they said');
      const flag = /\b(abuse|abused|hit|slapped|pushed|neglect|stole|stolen|threat)/i.test(words.value);
      all.push({id:uid(), site:sid, res:res.value, from:from.value, topic:topic.value, got:got.value||today(), words:words.value.trim(), stage:'open', steps:[], found:'', action:'', sentTo:[], sentOn:'', by:'', takenBy:tier().name+' (you)'});
      save(); toast(flag ? 'Saved. This may also be a report: open Report something now.' : 'Saved and sent to the manager.');
      if (flag) A.go ? A.go('report') : (location.hash = '#/report'); else A.route();
    });
    v.append(f);

    // list
    const box = card('', h('h2',null,'Log ('+list.length+')'));
    if (!list.length) box.append(h('p',{class:'muted'},'Nothing logged yet.'));
    list.forEach(g => {
      const it = h('div',{class:'item'},
        h('div',{class:'meta'}, chip(STAGES[g.stage][0], STAGES[g.stage][1]), overdue(g) ? chip('Over '+TARGET_DAYS+' days','red') : null, h('b',null,'Resident '+g.res+' · '+g.topic), h('span',{class:'small muted'},'From '+g.from.toLowerCase()+', '+fmtDate(g.got))),
        h('span',{class:'small'},'"'+g.words+'"'),
        g.steps.map(s => h('span',{class:'small muted'},fmtDate(s.at)+': '+s.note+' ('+s.by+')')),
        g.found ? h('span',{class:'small'},h('b',null,'Found: '),g.found) : null,
        g.action ? h('span',{class:'small'},h('b',null,'Done: '),g.action) : null,
        g.sentOn ? h('span',{class:'small muted'},'Written answer sent '+fmtDate(g.sentOn)+' to '+g.sentTo.join(', ')) : null);
      if (isMgr() && g.stage !== 'closed') it.append(workBox(g));
      if (g.sentOn) it.append(h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ A.download('grievance-summary-'+g.res+'-'+g.got+'.txt','text/plain', summary(g)); }},'Download the written summary')));
      box.append(it);
    });
    v.append(box);

    v.append(helpBox('Where else a resident can go',
      h('ul',null,
        h('li',null,'The licensing agency (DQA regional office for this county, or the county that licensed an AFH).'),
        h('li',null,'The long-term care ombudsman (Wisconsin Board on Aging and Long Term Care), for residents 60 and over; Disability Rights Wisconsin for younger residents.'),
        h('li',null,'Family Care members can also file a grievance with their managed care organization. The MCO must answer within 90 days (42 CFR 438.408(b)(1)).'),
        h('li',null,'If it may be abuse, neglect or theft, it is also a report with its own deadline: use Report something.')),
      h('p',{class:'small'},'Give these contacts with the rights notice at admission ('+(set === 'afh' ? 'DHS 88.10(2)' : 'DHS 83.28(6)')+'). The '+TARGET_DAYS+'-day answer time on this screen is a house default; follow your own written procedure.'),
      h('p',{class:'foot'},'Checked '+fmtDate(CHECKED)+'. Not legal advice.')));
  };

  function workBox(g){
    const note = h('input',{type:'text',maxlength:'240',placeholder:'What you did or learned today'});
    const found = h('textarea',{maxlength:'500',placeholder:'What you found, facts only'}); found.value = g.found;
    const action = h('textarea',{maxlength:'500',placeholder:'What the home did or will do, and by when'}); action.value = g.action;
    const to = ['Resident','Family member','Guardian or POA','Case manager'].map(x => { const b = h('input',{type:'checkbox'}); b.checked = g.sentTo.includes(x) || x === 'Resident'; return {x, b, el:h('label',{class:'row small'}, b, x)}; });
    return h('details',{class:'card soft'}, h('summary',null,'Work on it'),
      h('label',{class:'f'},'Add a step',note),
      h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ if (!note.value.trim()) return toast('Write the step'); g.steps.push({at:today(), by:tier().name+' (you)', note:note.value.trim()}); if (g.stage === 'open') g.stage = 'looking'; save(); A.route(); }},'Add step')),
      h('label',{class:'f'},'Findings',found), h('label',{class:'f'},'Action',action),
      h('fieldset',null, h('legend',{class:'small'},'Send the written answer to'), to.map(x => x.el)),
      h('div',{class:'row'},
        h('button',{class:'btn sm',type:'button',onclick:()=>{
          if (found.value.trim().length < 5 || action.value.trim().length < 5) return toast('Write the findings and the action first');
          g.found = found.value.trim(); g.action = action.value.trim(); g.sentTo = to.filter(x => x.b.checked).map(x => x.x); g.sentOn = today(); g.by = tier().name+' (you)'; g.stage = 'answered';
          save(); toast('Written answer recorded. Download it to give or mail.'); A.route(); }},'Record the written answer'),
        g.stage === 'answered' ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ g.stage = 'closed'; save(); A.route(); }},'Close') : null));
  }

  function summary(g){
    const s = A.D.SITES.find(x => x.id === g.site) || {name:''};
    return ['Grievance summary · '+s.name, '', 'Resident: '+g.res, 'Raised by: '+g.from, 'Received: '+g.got, 'Topic: '+g.topic, '',
      'The concern, in their words:', g.words, '', 'What we looked at:', ...g.steps.map(x => '- '+x.at+': '+x.note), '',
      'What we found:', g.found, '', 'What we did:', g.action, '', 'Sent to: '+g.sentTo.join(', ')+' on '+g.sentOn, 'Written by: '+g.by, '',
      'If you are not satisfied, you may contact the licensing agency, the ombudsman or advocate, or (Family Care members) your managed care organization. Raising a concern will never affect your care.',
      '', 'Rule: '+(RULE[s.setting] || {cite:''}).cite+'. Sample data only.'].join('\n');
  }

  // ---------- register ----------
  VIEWS.grievance = {t:'Grievances', ic:'📝'};
  ['caregiver','manager','owner','rn','multi'].forEach(t => { const n = NAV[t]; if (n && !n.includes('grievance')) n.push('grievance'); });
  if (window.SSAccess && SSAccess.register) try { SSAccess.register({id:'grievance', name:'Grievances', ic:'📝', what:'Resident and family complaints in their words, the look into it, and the written answer the rules ask for.', views:['grievance'], tiers:['caregiver','manager','rn','owner','multi']}); } catch(e){}
  const viewOn = () => { try { return !window.SSAccess || !SSAccess.viewOn || SSAccess.viewOn('grievance'); } catch(e){ return true; } };
  (A.homeHooks = A.homeHooks || []).push((v, t) => {
    if (!RULE[setting()] || !viewOn() || !['manager','owner'].includes(t)) return;
    const open = st().filter(g => g.site === S().site && (g.stage === 'open' || g.stage === 'looking'));
    if (!open.length) return;
    const late = open.filter(overdue).length;
    v.append(h('div',{class:'grid g2'}, A.tile('grievance','📝', 'Grievances: '+open.length+' open', late ? late+' past '+TARGET_DAYS+' days without a written answer.' : 'Look into each and send a written answer.', late ? 'urgent' : '')));
  });
  window.SSGrievance = {open: sid => st().filter(g => g.site === sid && g.stage !== 'closed')};
})();
