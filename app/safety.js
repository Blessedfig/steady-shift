// Steady Shift test app: fire and emergency log (#/safety).
// The records a surveyor asks for under fire safety: CBRF fire drills every quarter with one a year during sleeping hours
// and severe-weather drills twice a year (DHS 83.47(2)(d)-(e)); AFH evacuation evaluation of each resident at placement
// and yearly with a 2-minute target (DHS 88.05(4)(d)); the written emergency plan and when it was explained to each new
// resident (DHS 83.47(2)(a)-(c), DHS 88.05(4)(d)1-2); smoke alarm tests, extinguisher tags and inspections
// (DHS 88.05(4)(a)-(b), DHS 83.47(3)-(4), DHS 83.48). Rule text from the Wisconsin compliance rulebook (read 2026-11-26).
// Sample data only. State lives in S.care.safety (this browser only).
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
  const LIMIT_SEC = 120; // AFH evacuation target: 2 minutes (DHS 88.05(4)(d))

  const SRC = {
    dhs88:'https://docs.legis.wisconsin.gov/code/admin_code/dhs/030/88',
    dhs83:'https://docs.legis.wisconsin.gov/code/admin_code/dhs/030/83'
  };

  // ---------- what each setting must do ----------
  const DRILLS = {
    fire:{t:'Fire drill', ic:'🔥'},
    night:{t:'Fire drill during sleeping hours', ic:'🌙'},
    weather:{t:'Tornado or severe weather drill', ic:'🌪️'},
    evac:{t:'Evacuation evaluation (each resident timed)', ic:'⏱️'}
  };
  const EQUIP = {
    afh:[
      {id:'smoke', t:'Smoke alarms tested (every floor and sleeping room)', days:31, cite:'DHS 88.05(4)(b)', note:'Monthly test. Fix anything that fails right away.'},
      {id:'ext', t:'Fire extinguishers inspected and tagged', days:365, cite:'DHS 88.05(4)(a)', note:'At least one 2A,10-B:C per floor, at the head of each stairway and in or near the kitchen. Yearly dated tag.'}
    ],
    cbrf:[
      {id:'smoke', t:'Smoke and heat detection system tested', days:61, cite:'DHS 83.48', note:'Test every other month.'},
      {id:'nfpa72', t:'Yearly fire alarm system inspection (NFPA 72)', days:365, cite:'DHS 83.48', note:'By a qualified inspector. Keep the report.'},
      {id:'ext', t:'Fire extinguishers inspected and tagged', days:365, cite:'DHS 83.47(4)', note:'2A,10-B:C on each floor, no more than 75 feet apart, top no higher than 5 feet. Yearly dated tag.'},
      {id:'inspect', t:'Local fire authority inspection', days:365, cite:'DHS 83.47(3)', note:'Yearly. Keep the reports for 2 years.'}
    ]
  };
  const PLAN = {
    afh:{cite:'DHS 88.05(4)(d)1-2', due:'right after move-in', dueDays:1, items:[
      'Written evacuation plan for the home',
      'Outside meeting place named',
      'Each resident\'s evacuation ability and who helps them',
      'Staff told about any resident who takes longer than 2 minutes'
    ]},
    cbrf:{cite:'DHS 83.47(2)(a)-(c)', due:'within 72 hours of admission', dueDays:3, items:[
      'Evacuation, including residents who refuse to leave',
      'Missing residents',
      'Tornado and severe weather',
      'Shelter site if the building cannot be used',
      'Medications and meals at the shelter site',
      'Exit diagram posted on each floor'
    ]}
  };

  // ---------- state ----------
  function st(){
    const c = C.ensure();
    if (!c.safety || c.safety.v !== 1) c.safety = seed();
    return c.safety;
  }
  function seed(){
    const t = today();
    const s = {v:1, drills:[], equip:[], plan:{}, explained:[]};
    // Birch Hollow (CBRF): two quarters done, the night drill not yet this year
    s.drills.push({id:uid(), site:'birch', kind:'fire', date:addDays(t,-170), time:'14:10', secs:205, staff:'Day shift (3 staff)', over:['B-9'], fix:'B-9 needs two people; practice the bed-to-wheelchair transfer.', by:'House manager (sample)'});
    s.drills.push({id:uid(), site:'birch', kind:'fire', date:addDays(t,-80), time:'10:30', secs:180, staff:'Day shift (3 staff)', over:[], fix:'', by:'House manager (sample)'});
    s.drills.push({id:uid(), site:'birch', kind:'weather', date:addDays(t,-200), time:'15:00', secs:150, staff:'Day shift (3 staff)', over:[], fix:'Flashlights in the basement were dead. Replaced.', by:'House manager (sample)'});
    // Maple Grove (AFH): yearly evacuation evaluation, one resident over 2 minutes
    s.drills.push({id:uid(), site:'maple', kind:'evac', date:addDays(t,-300), time:'09:15', secs:0, staff:'Licensee and 1 caregiver', over:[], fix:'', by:'Licensee (sample)',
      times:{'M-1':95, 'M-2':140, 'M-3':70, 'M-4':85}});
    s.equip.push({id:uid(), site:'maple', kind:'smoke', date:addDays(t,-40), by:'Caregiver (sample)', note:'All passed.'});
    s.equip.push({id:uid(), site:'maple', kind:'ext', date:addDays(t,-250), by:'Licensee (sample)', note:'Tagged by the fire department.'});
    s.equip.push({id:uid(), site:'birch', kind:'smoke', date:addDays(t,-45), by:'House manager (sample)', note:''});
    s.equip.push({id:uid(), site:'birch', kind:'ext', date:addDays(t,-120), by:'House manager (sample)', note:'Vendor tag.'});
    s.equip.push({id:uid(), site:'birch', kind:'inspect', date:addDays(t,-330), by:'House manager (sample)', note:'No orders.'});
    s.plan.birch = {reviewed:addDays(t,-150), items:PLAN.cbrf.items.map((x,i) => i !== 4), by:'House manager (sample)'};
    s.plan.maple = {reviewed:addDays(t,-300), items:PLAN.afh.items.map(() => true), by:'Licensee (sample)'};
    ['B-2','B-5','B-7'].forEach(code => s.explained.push({site:'birch', res:code, date:addDays(t,-400), by:'House manager (sample)'}));
    ['M-1','M-2','M-3','M-4'].forEach(code => s.explained.push({site:'maple', res:code, date:addDays(t,-500), by:'Licensee (sample)'}));
    return s;
  }

  // ---------- due status ----------
  const daysSince = d => Math.round((new Date(today()+'T12:00:00') - new Date(d+'T12:00:00')) / 864e5);
  const quarterOf = d => { const x = new Date(d+'T12:00:00'); return x.getFullYear()+'-Q'+(Math.floor(x.getMonth()/3)+1); };
  const yearOf = d => d.slice(0,4);
  const mine = (list, sid) => list.filter(x => x.site === sid);
  const mmss = s => Math.floor(s/60)+':'+String(s%60).padStart(2,'0');

  function status(sid){
    const set = (A.D.SITES.find(x => x.id === sid) || {}).setting;
    const s = st(), out = [];
    const t = today(), dr = mine(s.drills, sid);
    if (set === 'cbrf'){
      const q = dr.some(d => (d.kind === 'fire' || d.kind === 'night') && quarterOf(d.date) === quarterOf(t));
      const m = new Date(t+'T12:00:00').getMonth() % 3; // months into the quarter
      out.push({id:'q', t:'Fire drill this quarter ('+quarterOf(t).replace('-',' ')+')', ok:q, sev:q ? 'ok' : (m === 2 ? 'over' : 'due'), cite:'DHS 83.47(2)(d)'});
      const n = dr.some(d => d.kind === 'night' && yearOf(d.date) === yearOf(t));
      const late = new Date(t+'T12:00:00').getMonth() >= 10; // November or December: the year is nearly over
      out.push({id:'n', t:'One fire drill during sleeping hours this year', ok:n, sev:n ? 'ok' : (late ? 'over' : 'due'), cite:'DHS 83.47(2)(d)'});
      const w = dr.filter(d => d.kind === 'weather' && yearOf(d.date) === yearOf(t)).length;
      out.push({id:'w', t:'Severe weather drills this year: '+w+' of 2', ok:w >= 2, sev:w >= 2 ? 'ok' : (late ? 'over' : 'due'), cite:'DHS 83.47(2)(e)'});
    }
    if (set === 'afh'){
      const last = {};
      dr.filter(d => d.kind === 'evac' && d.times).forEach(d => Object.keys(d.times).forEach(code => { if (!last[code] || d.date > last[code].date) last[code] = {date:d.date, secs:d.times[code]}; }));
      residents().forEach(r => {
        const l = last[r.code];
        const ok = l && daysSince(l.date) <= 365;
        out.push({id:'e-'+r.code, t:'Resident '+r.code+' evacuation evaluation'+(l ? ' ('+mmss(l.secs)+' on '+fmtDate(l.date)+')' : ' (none on file)'), ok, sev:ok ? (l.secs > LIMIT_SEC ? 'warn' : 'ok') : (l && daysSince(l.date) <= 395 ? 'due' : 'over'),
          cite:'DHS 88.05(4)(d)', extra:l && l.secs > LIMIT_SEC ? 'Over 2 minutes: staff must be told, and the plan should say who helps.' : ''});
      });
    }
    (EQUIP[set] || []).forEach(e => {
      const l = mine(s.equip, sid).filter(x => x.kind === e.id).sort((a,b) => b.date.localeCompare(a.date))[0];
      const age = l ? daysSince(l.date) : Infinity;
      out.push({id:'eq-'+e.id, t:e.t+(l ? ' (last '+fmtDate(l.date)+')' : ' (none on file)'), ok:age <= e.days, sev:age <= e.days ? (age > e.days - 14 ? 'due' : 'ok') : 'over', cite:e.cite});
    });
    const p = PLAN[set];
    if (p){
      const pl = s.plan[sid];
      const full = pl && pl.items.every(Boolean);
      out.push({id:'plan', t:'Written emergency plan covers every required part', ok:full, sev:full ? 'ok' : 'over', cite:p.cite});
      residents().forEach(r => {
        const e = s.explained.find(x => x.site === sid && x.res === r.code);
        if (!e) out.push({id:'x-'+r.code, t:'Emergency plan explained to resident '+r.code+' ('+p.due+')', ok:false, sev:'over', cite:p.cite});
      });
    }
    return out;
  }
  const openCount = sid => status(sid).filter(x => x.sev === 'over' || x.sev === 'due').length;

  // ---------- screen ----------
  const SEV = {ok:['Done','calm'], warn:['Done, see note','amber'], due:['Due soon','amber'], over:['Overdue','red']};
  R.safety = v => {
    const set = setting();
    if (!PLAN[set]){ v.append(head('Fire and emergency', 'For licensed homes', 'This log is for adult family homes and CBRFs.')); return; }
    const sid = S().site, s = st();
    v.append(head('Fire and emergency · '+site().name, 'Drills, evacuation times, emergency plan and equipment',
      set === 'cbrf' ? 'CBRFs run a fire drill every quarter, one a year during sleeping hours, and two severe weather drills a year. Fire safety drew 60 CBRF citations in 2025.'
                     : 'Adult family homes time each resident\'s evacuation when they move in and every year, with a 2-minute target. This drew 81 AFH citations in 2025.'));

    // status
    const items = status(sid);
    v.append(card(items.some(x => x.sev === 'over') ? 'warn' : '', h('h2',null,'Where this home stands'),
      h('div',{class:'list'}, items.map(x => h('div',{class:'item'},
        h('div',{class:'meta'}, chip(SEV[x.sev][0], SEV[x.sev][1]), h('span',{class:'small muted'},x.cite)),
        h('b',null,x.t), x.extra ? h('span',{class:'small'},x.extra) : null)))));

    // log a drill
    if (isMgr()){
      const kinds = set === 'cbrf' ? ['fire','night','weather'] : ['evac','fire'];
      const kind = h('select',{'aria-label':'Kind of drill'}, kinds.map(k => h('option',{value:k},DRILLS[k].t)));
      const date = h('input',{type:'date',value:today(),max:today()});
      const time = h('input',{type:'time',value:'10:00'});
      const mm = h('input',{type:'number',min:'0',max:'60',value:'2',inputmode:'numeric','aria-label':'Minutes'});
      const ss = h('input',{type:'number',min:'0',max:'59',value:'30',inputmode:'numeric','aria-label':'Seconds'});
      const staff = h('input',{type:'text',maxlength:'120',placeholder:'For example: night shift, 2 staff'});
      const fix = h('textarea',{maxlength:'400',placeholder:'What went well, what to fix, who needed help'});
      const resBox = h('div',{class:'grid g2'});
      const per = {};
      const drawRes = () => {
        resBox.textContent = '';
        residents().forEach(r => {
          const m = h('input',{type:'number',min:'0',max:'60',inputmode:'numeric','aria-label':'Minutes for '+r.code,placeholder:'min'});
          const sc = h('input',{type:'number',min:'0',max:'59',inputmode:'numeric','aria-label':'Seconds for '+r.code,placeholder:'sec'});
          const over = h('input',{type:'checkbox'});
          per[r.code] = {m, sc, over};
          resBox.append(h('div',{class:'item'}, h('b',null,'Resident '+r.code),
            kind.value === 'evac' ? h('div',{class:'row'}, m, h('span',null,':'), sc) : h('label',{class:'row small'}, over, 'Took longer than the plan allows')));
        });
      };
      kind.addEventListener('change', drawRes); drawRes();
      const f = h('form',{class:'card'}, h('h2',null,'Log a drill'),
        h('div',{class:'grid g2'}, h('label',{class:'f'},'Kind',kind), h('label',{class:'f'},'Date',date)),
        h('div',{class:'grid g2'}, h('label',{class:'f'},'Start time',time), h('label',{class:'f'},'Who was on shift',staff)),
        h('div',{class:'row'}, h('label',{class:'f'},'Total time to get everyone out (min)',mm), h('label',{class:'f'},'(sec)',ss)),
        h('h3',null,'Each resident'), resBox,
        h('label',{class:'f'},'Notes',fix),
        h('button',{class:'btn',type:'submit'},'Save the drill'));
      f.addEventListener('submit', e => { e.preventDefault();
        if (!date.value) return toast('Pick the date');
        const d = {id:uid(), site:sid, kind:kind.value, date:date.value, time:time.value, secs:(+mm.value||0)*60 + (+ss.value||0), staff:staff.value.trim(), fix:fix.value.trim(), over:[], by:tier().name+' (you)', at:new Date().toISOString()};
        if (d.kind === 'evac'){
          d.times = {};
          for (const code of Object.keys(per)){ const p = per[code]; if (p.m.value === '' && p.sc.value === '') continue; d.times[code] = (+p.m.value||0)*60 + (+p.sc.value||0); }
          if (!Object.keys(d.times).length) return toast('Enter at least one resident\'s time');
          d.over = Object.keys(d.times).filter(c => d.times[c] > LIMIT_SEC);
        } else d.over = Object.keys(per).filter(c => per[c].over.checked);
        s.drills.push(d); save();
        toast(d.over.length ? 'Saved. '+d.over.length+' resident'+(d.over.length>1?'s':'')+' over the limit: tell staff and update the plan.' : 'Drill saved.');
        A.route();
      });
      v.append(f);

      // equipment
      const ek = h('select',{'aria-label':'Check'}, EQUIP[set].map(e => h('option',{value:e.id},e.t)));
      const ed = h('input',{type:'date',value:today(),max:today()});
      const en = h('input',{type:'text',maxlength:'160',placeholder:'Result, vendor or tag number'});
      v.append(card('', h('h2',null,'Equipment checks'),
        h('div',{class:'list'}, EQUIP[set].map(e => h('div',{class:'item'}, h('b',null,e.t), h('span',{class:'small'},e.note), h('span',{class:'small muted'},e.cite)))),
        h('div',{class:'grid g2'}, h('label',{class:'f'},'Check',ek), h('label',{class:'f'},'Date',ed)), h('label',{class:'f'},'Result',en),
        h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ s.equip.push({id:uid(), site:sid, kind:ek.value, date:ed.value||today(), note:en.value.trim(), by:tier().name+' (you)'}); save(); toast('Check saved'); A.route(); }},'Save the check'))));

      // emergency plan
      const p = PLAN[set]; const pl = s.plan[sid] = s.plan[sid] || {reviewed:'', items:p.items.map(() => false)};
      const boxes = p.items.map((t,i) => { const b = h('input',{type:'checkbox'}); b.checked = !!pl.items[i]; return {b, el:h('label',{class:'row small'}, b, t)}; });
      const rList = h('div',{class:'list'}, residents().map(r => {
        const e = s.explained.find(x => x.site === sid && x.res === r.code);
        return h('div',{class:'item'}, h('div',{class:'meta'}, e ? chip('Explained '+fmtDate(e.date),'calm') : chip('Not yet','red'), h('b',null,'Resident '+r.code)),
          !e ? h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ s.explained.push({site:sid, res:r.code, date:today(), by:tier().name+' (you)'}); save(); toast('Noted for '+r.code); A.route(); }},'Explained today') : null);
      }));
      v.append(card('', h('h2',null,'Written emergency plan'),
        h('p',{class:'small muted'},'The plan must cover each part below and be explained to every new resident '+p.due+' ('+p.cite+').'+(pl.reviewed ? ' Last reviewed '+fmtDate(pl.reviewed)+'.' : '')),
        boxes.map(x => x.el),
        h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ pl.items = boxes.map(x => x.b.checked); pl.reviewed = today(); pl.by = tier().name+' (you)'; save(); toast('Plan review saved'); A.route(); }},'Save plan review')),
        h('h3',null,'Explained to each resident'), rList));
    }

    // history
    const hist = mine(s.drills, sid).slice().sort((a,b) => b.date.localeCompare(a.date));
    v.append(card('', h('h2',null,'Drill history'),
      hist.length ? h('div',{class:'list'}, hist.map(d => h('div',{class:'item'},
        h('div',{class:'meta'}, chip(fmtDate(d.date)+(d.time ? ' '+d.time : ''),'grey'), h('b',null,DRILLS[d.kind].ic+' '+DRILLS[d.kind].t)),
        d.kind === 'evac' && d.times ? h('span',{class:'small'}, Object.keys(d.times).map(c => c+' '+mmss(d.times[c])+(d.times[c] > LIMIT_SEC ? ' (over 2 min)' : '')).join(' · '))
                                    : h('span',{class:'small'},'Total time '+mmss(d.secs)+(d.staff ? ' · '+d.staff : '')+(d.over.length ? ' · Over the limit: '+d.over.join(', ') : '')),
        d.fix ? h('span',{class:'small muted'},d.fix) : null, h('span',{class:'small muted'},'Logged by '+d.by)))) : h('p',{class:'muted'},'No drills logged yet.'),
      h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{
        const rows = [['Date','Time','Kind','Total time','Who was on shift','Residents over the limit','Per-resident times','Notes','Logged by']];
        hist.forEach(d => rows.push([d.date, d.time||'', DRILLS[d.kind].t, mmss(d.secs), d.staff||'', d.over.join(' '), d.times ? Object.keys(d.times).map(c => c+' '+mmss(d.times[c])).join(' ') : '', d.fix||'', d.by]));
        mine(s.equip, sid).forEach(e => rows.push([e.date, '', (EQUIP[set].find(x => x.id === e.kind)||{t:e.kind}).t, '', '', '', '', e.note||'', e.by]));
        A.download('fire-and-emergency-'+sid+'.csv','text/csv',rows.map(r => r.map(A.csvCell).join(',')).join('\n'));
      }},'Download for the surveyor (CSV)'))));

    v.append(helpBox('Where these rules come from',
      h('p',{class:'small'}, h('a',{href:set === 'cbrf' ? SRC.dhs83 : SRC.dhs88, target:'_blank', rel:'noopener'}, set === 'cbrf' ? 'DHS 83, CBRFs' : 'DHS 88, adult family homes'),
        '. Your local fire department may ask for more. Ask your licensing specialist if your home has a waiver or a different schedule.'),
      h('p',{class:'foot'},'Checked '+fmtDate(CHECKED)+'. Not legal advice.')));
  };

  // ---------- register ----------
  VIEWS.safety = {t:'Fire and emergency', ic:'🧯'};
  ['manager','owner','rn','multi'].forEach(t => { const n = NAV[t]; if (n && !n.includes('safety')) n.splice(Math.max(0, n.indexOf('clean') + 1) || n.length, 0, 'safety'); });
  if (window.SSAccess && SSAccess.register) try { SSAccess.register({id:'safety', name:'Fire and emergency', ic:'🧯', what:'Fire and severe weather drills, evacuation times, the written emergency plan and equipment checks, with due dates from DHS 83 and 88.', views:['safety'], tiers:['manager','rn','owner']}); } catch(e){}
  const viewOn = () => { try { return !window.SSAccess || !SSAccess.viewOn || SSAccess.viewOn('safety'); } catch(e){ return true; } };
  (A.homeHooks = A.homeHooks || []).push((v, t) => {
    if (!PLAN[setting()] || !viewOn() || !['manager','owner','rn'].includes(t)) return;
    const n = openCount(S().site);
    v.append(h('div',{class:'grid g2'}, A.tile('safety','🧯', n ? 'Fire and emergency: '+n+' to do' : 'Fire and emergency', n ? 'Drills, evacuation times or checks are due.' : 'Drills and checks are up to date.', n ? 'urgent' : '')));
  });
  window.SSSafety = {status, openCount};
})();
