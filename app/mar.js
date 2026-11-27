// Steady Shift test app: medication administration record (MAR), #/mar.
// Records every scheduled and as-needed dose the way Wisconsin asks: resident, medicine, dose, date, time, who gave it,
// refusals, omissions, errors, side effects, and for PRN doses the reason and the result (DHS 88.07(3)(e)1-2,
// DHS 83.37(2)(d)). Two refusals in a row at a CBRF go to the prescriber (DHS 83.37(1)(k)). Controlled drug counts keep a
// running balance (DHS 88.07(3)(e)1, DHS 83.37(3)(g)); disposals need two witnesses (DHS 83.37(1)(g)); psychotropic and
// pharmacist reviews show when due (DHS 83.37(1)(e), (h)-(i)). Residents who manage their own medicines are marked
// (DHS 88.07(3)(c), DHS 83.37(2)(a)). Rule text from the Wisconsin compliance rulebook (read 2026-11-26).
// Test version: fictional sample medicines only, never real resident data. State lives in S.care.mar (this browser only).
(function(){
  const A = window.SSApp, C = window.SSCare;
  if (!A || !C) return;
  const {h, save, toast, head, R, VIEWS, NAV, uid, fmtDate, site, tier} = A;
  const S = () => A.state();
  const {chip, card, helpBox, today, addDays} = C;
  const residents = () => (A.residents ? A.residents() : (A.D.RESIDENTS[S().site] || []));
  const setting = () => (site() || {}).setting;
  const isNurse = () => ['rn','manager','owner','multi'].includes(S().tier);
  const CHECKED = '2026-11-27';
  const WINDOW_MIN = 60; // house rule (common pharmacy practice, not a DHS rule): give within an hour of the label time

  const RULES = {
    record:{afh:'DHS 88.07(3)(e)1-2', cbrf:'DHS 83.37(2)(d)'},
    refuse:{afh:'DHS 88.07(3)(b)', cbrf:'DHS 83.37(1)(k)'},
    self:{afh:'DHS 88.07(3)(c)', cbrf:'DHS 83.37(2)(a)'},
    count:{afh:'DHS 88.07(3)(e)1', cbrf:'DHS 83.37(3)(g)'},
    order:{afh:'DHS 88.07(3)(d)', cbrf:'DHS 83.37(1)(a)'}
  };
  const cite = k => (RULES[k] || {})[setting()] || '';

  // ---------- sample medicine list ----------
  // times: label times (HH:MM). prn: as needed, with the most often it may be given. route nurse: an RN/LPN task or delegated.
  function seed(){
    const t = today();
    const M = (site, res, name, dose, route, times, o) => Object.assign({id:uid(), site, res, name, dose, route, times, prn:false, controlled:false, psych:false, nurse:false, start:addDays(t,-60)}, o||{});
    const meds = [
      M('maple','M-1','Lisinopril (sample)','10 mg tablet','By mouth',['08:00']),
      M('maple','M-1','Acetaminophen (sample)','500 mg tablet','By mouth',[],{prn:true, prnFor:'Pain over 3 of 10', prnMax:'Every 6 hours, no more than 3 doses a day'}),
      M('maple','M-2','Donepezil (sample)','10 mg tablet','By mouth',['20:00']),
      M('maple','M-2','Sertraline (sample)','50 mg tablet','By mouth',['08:00'],{psych:true, psychReview:addDays(t,-80)}),
      M('maple','M-3','Insulin glargine (sample)','10 units','Under the skin (pen)',['21:00'],{nurse:true, nurseNote:'RN-delegated task. Only staff on the delegation list.'}),
      M('maple','M-3','Metformin (sample)','500 mg tablet','By mouth',['08:00','17:00']),
      M('maple','M-4','Docusate (sample)','100 mg capsule','By mouth',['08:00']),
      M('birch','B-2','Albuterol nebulizer (sample)','2.5 mg vial','Inhaled (nebulizer)',['08:00','20:00'],{nurse:true, nurseNote:'Nebulizers are a nurse task in a CBRF unless delegated (DHS 83.37(2)(e)).'}),
      M('birch','B-5','Sertraline (sample)','25 mg tablet','By mouth',['08:00'],{psych:true, psychReview:addDays(t,-100)}),
      M('birch','B-7','Lorazepam (sample)','0.5 mg tablet','By mouth',[],{prn:true, controlled:true, psych:true, prnFor:'Anxiety that does not ease with the calming steps in the plan', prnMax:'Every 8 hours, no more than 2 doses a day', count:30, psychReview:addDays(t,-20), prnCheck:addDays(t,-40)}),
      M('birch','B-9','Vitamin D (sample)','1,000 unit tablet','By mouth',['08:00']),
      M('birch','B-9','Oxycodone (sample)','5 mg tablet','By mouth',[],{prn:true, controlled:true, prnFor:'Hip pain over 5 of 10', prnMax:'Every 6 hours', count:12})
    ];
    const log = [];
    // a week of history so refusal and PRN patterns show
    for (let d = 6; d >= 1; d--){
      const day = addDays(t, -d);
      meds.filter(m => !m.prn).forEach(m => m.times.forEach(tm => {
        const refused = (m.res === 'B-5' && d <= 2) || (m.res === 'M-4' && d === 1);
        log.push({id:uid(), site:m.site, res:m.res, med:m.id, day, slot:tm, status:refused ? 'refused' : 'given', at:day+'T'+tm, by:'Caregiver (sample)', reason:refused ? 'Said no, "I don\'t want it." Offered again in 15 minutes, still no.' : ''});
      }));
    }
    const b7 = meds.find(m => m.name.startsWith('Lorazepam'));
    log.push({id:uid(), site:'birch', res:'B-7', med:b7.id, day:addDays(t,-1), slot:'PRN', status:'given', at:addDays(t,-1)+'T19:40', by:'Caregiver (sample)', prnReason:'Pacing and crying after a phone call; calming steps tried for 20 minutes.', prnResult:'Calm and watching TV at 20:30.', resultAt:addDays(t,-1)+'T20:30'});
    b7.count = 29;
    return {v:1, meds, log, counts:[{id:uid(), site:'birch', med:b7.id, day:addDays(t,-1), expected:29, found:29, by:'Caregiver (sample)', witness:'House manager (sample)'}], disposals:[], selfRes:{'cedar:C-1':true}, pharm:{'birch':addDays(t,-200), 'maple':addDays(t,-400)}};
  }
  function st(){ const c = C.ensure(); if (!c.mar || c.mar.v !== 1) c.mar = seed(); return c.mar; }

  // ---------- helpers ----------
  const now = () => new Date();
  const hhmm = d => String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  const toMin = s => { const [a,b] = s.split(':').map(Number); return a*60+b; };
  const medsFor = (sid, res) => st().meds.filter(m => m.site === sid && m.res === res && !m.stopped);
  const entry = (m, day, slot) => st().log.find(l => l.med === m.id && l.day === day && l.slot === slot);
  const daysSince = d => Math.round((new Date(today()+'T12:00:00') - new Date(d+'T12:00:00')) / 864e5);
  const me = () => tier().name+' (you)';
  // two scheduled refusals in a row for the same medicine
  function refusedTwice(m){
    const l = st().log.filter(x => x.med === m.id && x.slot !== 'PRN').sort((a,b) => (a.day+a.slot).localeCompare(b.day+b.slot));
    const last2 = l.slice(-2);
    return last2.length === 2 && last2.every(x => x.status === 'refused') && !last2[1].prescriberTold;
  }
  const prnWaiting = sid => st().log.filter(l => l.site === sid && l.slot === 'PRN' && l.status === 'given' && !l.prnResult);
  function dueNow(sid){
    const d = today(), n = toMin(hhmm(now())), out = [];
    residents().forEach(r => { if (st().selfRes[sid+':'+r.code]) return;
      medsFor(sid, r.code).filter(m => !m.prn).forEach(m => m.times.forEach(tm => { if (!entry(m, d, tm) && toMin(tm) < n + WINDOW_MIN) out.push({m, tm, late:toMin(tm) + WINDOW_MIN < n}); })); });
    return out;
  }
  function alerts(sid){
    const out = [], set = setting(), s = st();
    s.meds.filter(m => m.site === sid && !m.stopped).forEach(m => {
      if (refusedTwice(m)) out.push({sev:'red', m, t:'Resident '+m.res+' refused '+m.name+' twice in a row.', what:set === 'cbrf' ? 'Tell the prescriber as soon as possible ('+cite('refuse')+'). Then mark it told.' : 'Write each refusal and tell the nurse or prescriber. If a court ordered this medicine, tell the court and the physician ('+cite('refuse')+').', act:'told'});
      if (m.psych && !m.prn && m.psychReview && daysSince(m.psychReview) > 90) out.push({sev:'amber', m, t:m.name+' for '+m.res+': psychotropic reassessment is past 3 months (last '+fmtDate(m.psychReview)+').', what:'Scheduled psychotropics are reassessed at least every quarter (DHS 83.37(1)(h); AFH rule being checked).', act:'psych'});
      if (m.psych && m.prn && (!m.prnCheck || daysSince(m.prnCheck) > 31)) out.push({sev:'amber', m, t:m.name+' (as needed) for '+m.res+': monthly check for how often it is used is due.', what:'PRN psychotropics need a written reason and target behavior in the plan and a monthly check (DHS 83.37(1)(i)).', act:'prncheck'});
    });
    prnWaiting(sid).forEach(l => { const m = s.meds.find(x => x.id === l.med); if (m && (now() - new Date(l.at)) > 60*60000) out.push({sev:'amber', m, l, t:'Write the result of the as-needed '+m.name+' given to '+l.res+' at '+l.at.slice(11,16)+'.', what:'Every PRN dose records why it was given and what happened ('+cite('record')+').', act:'result'}); });
    const ph = s.pharm[sid];
    if (!ph || daysSince(ph) > 365) out.push({sev:'amber', t:'Yearly pharmacist or physician review of each resident\'s medicines is due'+(ph ? ' (last '+fmtDate(ph)+')' : '')+'.', what:'Also within 30 days of admission and after big changes (DHS 83.37(1)(e); AFH rule being checked).', act:'pharm'});
    return out;
  }

  // ---------- screen ----------
  const STATUS = {given:['Given','calm'], refused:['Refused','amber'], held:['Held','grey'], missed:['Not given','red']};
  R.mar = v => {
    const set = setting(), sid = S().site, s = st();
    if (!RULES.record[set]){ v.append(head('Medication record', 'For licensed homes', 'This record is for adult family homes and CBRFs. At home, follow the pharmacy label.')); return; }
    const tab = (A.param && A.param()) || 'pass';
    v.append(head('Medication record · '+site().name, 'Every dose, refusal and as-needed result',
      'Sample medicines only. Give only from a signed written order on file ('+cite('order')+') and only if you have finished medication training.'));
    v.append(h('div',{class:'row',role:'tablist'}, [['pass','Med pass'],['history','History'],['counts','Counts and disposal']].map(([k,l]) =>
      h('a',{class:'btn '+(k === tab ? '' : 'quiet ')+'sm', href:'#/mar/'+k, role:'tab','aria-selected':String(k === tab)}, l))));

    const al = alerts(sid);
    if (al.length) v.append(card('warn', h('h2',null,'Needs attention ('+al.length+')'), h('div',{class:'list'}, al.map(a => h('div',{class:'item'},
      h('div',{class:'meta'}, chip(a.sev === 'red' ? 'Now' : 'Soon', a.sev)), h('b',null,a.t), h('span',{class:'small'},a.what), actBtn(a))))));

    if (tab === 'history') return history(v, sid);
    if (tab === 'counts') return counts(v, sid);

    const d = today(), n = toMin(hhmm(now()));
    residents().forEach(r => {
      if (s.selfRes[sid+':'+r.code]) { v.append(card('soft', h('h2',null,'Resident '+r.code), h('p',{class:'small'},'Manages their own medicines. Keep them locked in their room; staff only remind if asked ('+cite('self')+').'))); return; }
      const ms = medsFor(sid, r.code);
      if (!ms.length) return;
      const c = card('', h('h2',null,'Resident '+r.code));
      ms.forEach(m => {
        const row = h('div',{class:'item'},
          h('div',{class:'meta'}, m.prn ? chip('As needed','grey') : null, m.controlled ? chip('Controlled: count '+(m.count ?? '?'),'amber') : null, m.psych ? chip('Psychotropic','grey') : null, m.nurse ? chip('Nurse or delegated','amber') : null),
          h('b',null,m.name+' · '+m.dose+' · '+m.route), m.nurse && m.nurseNote ? h('span',{class:'small'},m.nurseNote) : null,
          m.prn ? h('span',{class:'small muted'},'For: '+m.prnFor+'. '+m.prnMax+'.') : null);
        if (m.prn){
          const why = h('input',{type:'text',maxlength:'200',placeholder:'Why now? What you saw and what you tried first','aria-label':'Reason for '+m.name});
          row.append(h('div',{class:'row'}, why, h('button',{class:'btn sm',type:'button',onclick:()=>{
            if (why.value.trim().length < 5) return toast('Write why it is needed now');
            const at = now(); s.log.push({id:uid(), site:sid, res:r.code, med:m.id, day:d, slot:'PRN', status:'given', at:d+'T'+hhmm(at), by:me(), prnReason:why.value.trim()});
            if (m.controlled && typeof m.count === 'number') m.count -= 1;
            save(); toast('Recorded. Come back within an hour to write the result.'); A.route(); }},'Give and record')));
          s.log.filter(l => l.med === m.id && l.day === d).forEach(l => row.append(h('span',{class:'small'}, 'Given '+l.at.slice(11,16)+' by '+l.by+': '+l.prnReason+(l.prnResult ? ' → '+l.prnResult : ' (result not written yet)'))));
        } else m.times.forEach(tm => {
          const e = entry(m, d, tm);
          if (e){ row.append(h('div',{class:'meta small'}, chip(STATUS[e.status][0], STATUS[e.status][1]), h('span',null,tm+' dose · '+e.at.slice(11,16)+' · '+e.by+(e.reason ? ' · '+e.reason : '')))); return; }
          const late = toMin(tm) + WINDOW_MIN < n, early = toMin(tm) - WINDOW_MIN > n;
          const why = h('input',{type:'text',maxlength:'200',placeholder:'What happened (needed for refused, held or not given)','aria-label':'Note for the '+tm+' dose of '+m.name});
          const rec = st2 => () => {
            if (st2 !== 'given' && why.value.trim().length < 5) return toast('Write what happened');
            s.log.push({id:uid(), site:sid, res:r.code, med:m.id, day:d, slot:tm, status:st2, at:d+'T'+hhmm(now()), by:me(), reason:why.value.trim(), late:late && st2 === 'given'});
            save(); toast(st2 === 'given' ? (late ? 'Recorded as late. Tell the nurse if your home\'s rule asks.' : 'Recorded.') : 'Recorded. The manager and nurse will see it.'); A.route();
          };
          row.append(h('div',{class:'item'}, h('div',{class:'meta small'}, chip(tm, late ? 'red' : early ? 'grey' : 'amber'), h('span',null, late ? 'Past the 1-hour window (house rule)' : early ? 'Not due yet' : 'Due now')),
            early ? null : h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:rec('given')},'Given'), h('button',{class:'btn quiet sm',type:'button',onclick:rec('refused')},'Refused'),
              h('button',{class:'btn quiet sm',type:'button',onclick:rec('held')},'Held'), h('button',{class:'btn quiet sm',type:'button',onclick:rec('missed')},'Not given')), early ? null : why));
        });
        c.append(row);
      });
      v.append(c);
    });

    v.append(card('soft', h('h2',null,'Wrong medicine, dose, time or person?'),
      h('p',{class:'small'},'Check the resident first. Call the nurse and the pharmacist or prescriber right away and follow what they say. Then write a report with facts only, and start follow-up checks.'),
      h('div',{class:'row'}, h('a',{class:'btn sm',href:'#/report'},'Report a medication error'), h('a',{class:'btn quiet sm',href:'#/monitor'},'Start follow-up checks'))));

    if (isNurse()) v.append(selfCard(sid));
    v.append(helpBox('Where these rules come from',
      h('ul',null,
        h('li',null,'Record each dose: resident, medicine, dose, date and time, who gave it, side effects, and for as-needed doses the reason and result ('+cite('record')+').'),
        h('li',null,'Residents may refuse. Write down every refusal. '+(set === 'cbrf' ? 'Two refusals in a row go to the prescriber as soon as possible (DHS 83.37(1)(k)).' : 'If a court ordered the medicine, tell the court and the physician (DHS 88.07(3)(b)).')),
        h('li',null,'The 1-hour window is common pharmacy practice, not a state rule. Put your pharmacy\'s window in writing.'),
        h('li',null,'Injections, nebulizers, tube, rectal and vaginal medicines are a nurse task unless delegated (DHS 83.37(2)(e); Wisconsin N 6.03(3)).')),
      h('p',{class:'foot'},'Checked '+fmtDate(CHECKED)+'. Test version with sample medicines. Not legal or clinical advice.')));
  };

  function actBtn(a){
    const s = st(), sid = S().site;
    if (a.act === 'told') return h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ const l = s.log.filter(x => x.med === a.m.id && x.slot !== 'PRN').sort((x,y) => (x.day+x.slot).localeCompare(y.day+y.slot)).pop(); l.prescriberTold = {by:me(), at:new Date().toISOString()}; save(); toast('Marked: prescriber told.'); A.route(); }},'Prescriber told');
    if (a.act === 'result'){ const inp = h('input',{type:'text',maxlength:'200',placeholder:'What happened after the dose','aria-label':'Result'});
      return h('div',{class:'row'}, inp, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ if (inp.value.trim().length < 3) return toast('Write the result'); a.l.prnResult = inp.value.trim(); a.l.resultAt = today()+'T'+hhmm(now()); a.l.resultBy = me(); save(); A.route(); }},'Save result')); }
    if (!isNurse()) return null;
    if (a.act === 'psych') return h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ a.m.psychReview = today(); save(); toast('Reassessment noted for today.'); A.route(); }},'Reassessed today');
    if (a.act === 'prncheck') return h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ a.m.prnCheck = today(); save(); toast('Monthly check noted.'); A.route(); }},'Checked today');
    if (a.act === 'pharm') return h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ s.pharm[sid] = today(); save(); toast('Review noted.'); A.route(); }},'Review done today');
    return null;
  }

  function selfCard(sid){
    const s = st();
    return helpBox('Residents who manage their own medicines',
      h('p',{class:'small'},'A resident manages their own medicines unless found unable to, or they ask staff in writing to do it ('+cite('self')+').'),
      residents().map(r => { const b = h('input',{type:'checkbox'}); b.checked = !!s.selfRes[sid+':'+r.code];
        b.addEventListener('change', () => { if (b.checked) s.selfRes[sid+':'+r.code] = true; else delete s.selfRes[sid+':'+r.code]; save(); A.route(); });
        return h('label',{class:'row small'}, b, 'Resident '+r.code+' manages their own'); }));
  }

  function history(v, sid){
    const s = st(), days = [6,5,4,3,2,1,0].map(n => addDays(today(), -n));
    residents().forEach(r => {
      const ms = medsFor(sid, r.code); if (!ms.length) return;
      const tb = h('table',{class:'t'}, h('caption',{class:'small muted'},'Resident '+r.code+', last 7 days'), h('thead',null, h('tr',null, h('th',{scope:'col'},'Medicine and time'), days.map(d => h('th',{scope:'col'},d.slice(5))))));
      const body = h('tbody');
      ms.forEach(m => (m.prn ? ['PRN'] : m.times).forEach(tm => body.append(h('tr',null, h('th',{scope:'row'},m.name+' '+tm),
        days.map(d => { const es = s.log.filter(l => l.med === m.id && l.day === d && l.slot === tm);
          return h('td',null, es.length ? es.map(e => (STATUS[e.status]||['?'])[0]+(e.slot === 'PRN' ? ' '+e.at.slice(11,16) : '')).join(', ') : (m.prn || d === today() ? '' : '—')); })))));
      tb.append(body);
      v.append(card('', h('div',{style:'overflow-x:auto'}, tb)));
    });
    v.append(h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{
      const rows = [['Date','Time slot','Recorded at','Resident','Medicine','Dose','Route','Status','By','Note','PRN reason','PRN result','Prescriber told']];
      s.log.filter(l => l.site === sid).sort((a,b) => a.at.localeCompare(b.at)).forEach(l => { const m = s.meds.find(x => x.id === l.med) || {};
        rows.push([l.day, l.slot, l.at.slice(11,16), l.res, m.name||'', m.dose||'', m.route||'', l.status, l.by, l.reason||'', l.prnReason||'', l.prnResult||'', l.prescriberTold ? 'Yes' : '']); });
      A.download('medication-record-'+sid+'.csv','text/csv',rows.map(r => r.map(A.csvCell).join(',')).join('\n'));
    }},'Download the record (CSV)')));
  }

  function counts(v, sid){
    const s = st(), ctrl = s.meds.filter(m => m.site === sid && m.controlled && !m.stopped);
    const c = card('', h('h2',null,'Controlled medicine count'), h('p',{class:'small muted'},'Count at each shift change with a second person. Every dose comes off the balance; a count that does not match goes to the manager right away ('+cite('count')+').'));
    if (!ctrl.length) c.append(h('p',{class:'muted'},'No controlled medicines at this home.'));
    ctrl.forEach(m => {
      const found = h('input',{type:'number',min:'0',inputmode:'numeric','aria-label':'Count for '+m.name});
      const wit = h('input',{type:'text',maxlength:'80',placeholder:'Second person','aria-label':'Witness for '+m.name});
      const last = s.counts.filter(x => x.med === m.id).pop();
      c.append(h('div',{class:'item'}, h('b',null,'Resident '+m.res+' · '+m.name+' · '+m.dose), h('span',{class:'small'},'Balance on the record: '+m.count+(last ? ' · last count '+fmtDate(last.day)+': '+last.found+(last.found !== last.expected ? ' (did not match)' : ' (matched)') : '')),
        h('div',{class:'row'}, found, wit, h('button',{class:'btn sm',type:'button',onclick:()=>{
          if (found.value === '' || wit.value.trim().length < 2) return toast('Enter the count and the second person');
          const rec = {id:uid(), site:sid, med:m.id, day:today(), expected:m.count, found:+found.value, by:me(), witness:wit.value.trim()};
          s.counts.push(rec); save(); toast(rec.found === rec.expected ? 'Count matches.' : 'Count does not match. Tell the manager now and write a report.'); A.route(); }},'Save count'))));
    });
    v.append(c);
    const med = h('select',{'aria-label':'Medicine'}, s.meds.filter(m => m.site === sid).map(m => h('option',{value:m.id},m.res+' · '+m.name)));
    const qty = h('input',{type:'text',maxlength:'40',placeholder:'How many'}), why = h('input',{type:'text',maxlength:'120',placeholder:'Why (stopped, expired, dropped)'});
    const w1 = h('input',{type:'text',maxlength:'80',placeholder:'First witness'}), w2 = h('input',{type:'text',maxlength:'80',placeholder:'Second witness'});
    v.append(card('', h('h2',null,'Medicine disposal'), h('p',{class:'small muted'},'Two staff watch, sign and date. Stopped medicines are not kept more than 30 days without a new order (DHS 83.37(1)(g)).'),
      h('div',{class:'grid g2'}, h('label',{class:'f'},'Medicine',med), h('label',{class:'f'},'Amount',qty)), h('label',{class:'f'},'Reason',why),
      h('div',{class:'grid g2'}, h('label',{class:'f'},'Witness 1',w1), h('label',{class:'f'},'Witness 2',w2)),
      h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{
        if (!qty.value.trim() || !why.value.trim() || w1.value.trim().length < 2 || w2.value.trim().length < 2) return toast('Fill in the amount, reason and both witnesses');
        if (w1.value.trim().toLowerCase() === w2.value.trim().toLowerCase()) return toast('Two different people must witness');
        s.disposals.push({id:uid(), site:sid, med:med.value, qty:qty.value.trim(), why:why.value.trim(), w1:w1.value.trim(), w2:w2.value.trim(), day:today(), by:me()}); save(); toast('Disposal recorded.'); A.route(); }},'Record disposal')),
      s.disposals.filter(x => x.site === sid).map(x => { const m = s.meds.find(y => y.id === x.med) || {}; return h('span',{class:'small'},fmtDate(x.day)+': '+x.qty+' of '+(m.name||'')+' ('+x.why+'), witnessed by '+x.w1+' and '+x.w2); })));
  }

  // ---------- register ----------
  VIEWS.mar = {t:'Medication record', ic:'💊'};
  ['caregiver','manager','rn','owner'].forEach(t => { const n = NAV[t]; if (n && !n.includes('mar')) n.splice(Math.min(n.length, 1), 0, 'mar'); });
  if (window.SSAccess && SSAccess.register) try { SSAccess.register({id:'mar', name:'Medication record', ic:'💊', what:'Each dose, refusal and as-needed result, two-refusal alerts, controlled counts, disposal with witnesses and review reminders.', views:['mar'], tiers:['caregiver','manager','rn','owner']}); } catch(e){}
  const viewOn = () => { try { return !window.SSAccess || !SSAccess.viewOn || SSAccess.viewOn('mar'); } catch(e){ return true; } };
  (A.homeHooks = A.homeHooks || []).push((v, t) => {
    if (!RULES.record[setting()] || !viewOn() || !['caregiver','manager','rn'].includes(t)) return;
    const sid = S().site, due = dueNow(sid), al = alerts(sid).filter(a => a.sev === 'red');
    if (!due.length && !al.length) return;
    v.append(h('div',{class:'grid g2'}, A.tile('mar','💊', due.length ? 'Medications: '+due.length+' dose'+(due.length>1?'s':'')+' to record' : 'Medications: '+al.length+' alert'+(al.length>1?'s':''), due.some(x => x.late) || al.length ? 'Some are late or need the prescriber.' : 'Due within the hour.', due.some(x => x.late) || al.length ? 'urgent' : '')));
  });
  window.SSMar = {dueNow, alerts:sid => alerts(sid).map(a => a.t)};
})();
