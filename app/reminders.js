// Steady Shift test app: manager reminder banner and Reminders screen (#/reminders).
// Idea from Angelika (2026-11-27): managers get red banners for ISP updates every six months, staff training,
// and anything else they want to be reminded of. The banner gathers what is due from the care plans (isp.js),
// employee files (hr.js) and RN delegations, plus the manager's own reminders. Amber = due within 30 days, red = overdue.
// Test version: sample data only, kept in this browser.
(function(){
  const A = window.SSApp; if (!A) return;
  const {D, h, save, toast, fmtDate:fmtAny, head, R, VIEWS, NAV, isoDay, addDays, uid} = A;
  const S = () => A.state();
  const today = () => isoDay(new Date());
  const fmtDate = d => fmtAny(/^\d{4}-\d{2}-\d{2}$/.test(d||'') ? d+'T12:00:00' : d);
  const days = d => Math.round((new Date(d+'T12:00:00') - new Date(today()+'T12:00:00'))/864e5);
  const iso = d => d ? (typeof d === 'string' ? d.slice(0,10) : isoDay(d)) : '';
  const SOON = 30;
  const REPEAT = {0:'Does not repeat', 1:'Every month', 3:'Every 3 months', 6:'Every 6 months', 12:'Every year'};
  const addMonths = (d, m) => { const x = new Date(d+'T12:00:00'); x.setMonth(x.getMonth()+m); return isoDay(x); };

  function st(){
    const s = S();
    if (!s.reminders){
      const t = today();
      s.reminders = [
        {id:uid(), site:'maple', title:'Fire drill (sample)', due:addDays(t, 12), repeat:3, note:'', done:[]},
        {id:uid(), site:'maple', title:'Check first aid kit and expiry dates (sample)', due:addDays(t, -2), repeat:1, note:'', done:[]},
        {id:uid(), site:'birch', title:'Fire drill (sample)', due:addDays(t, 20), repeat:3, note:'', done:[]},
        {id:uid(), site:'cedar', title:'Renew license posting check (sample)', due:addDays(t, 25), repeat:12, note:'', done:[]}
      ];
      save();
    }
    return s.reminders;
  }
  const lvl = d => { const n = days(d); return n < 0 ? 'red' : n <= SOON ? 'amber' : 'calm'; };
  const when = d => { const n = days(d); return n < 0 ? (-n)+' day'+(n === -1 ? '' : 's')+' overdue' : n === 0 ? 'due today' : 'due in '+n+' day'+(n === 1 ? '' : 's'); };

  // Everything due for one home, red first, then soonest.
  function collect(sid){
    const out = [];
    const isp = window.SSISP && (!window.SSAccess || SSAccess.viewOn('isp'));
    if (isp && sid !== 'family') (D.RESIDENTS[sid]||[]).forEach(r => { try {
      const s = SSISP.status(sid, r.code); if (!s || !s.due) return;
      const d = iso(s.due); if (lvl(d) === 'calm') return;
      out.push({src:'Care plan (ISP)', ic:'📋', title:(s.v ? 'ISP review' : 'First ISP')+' for '+r.code+' '+r.nick, due:d, href:'#/isp/'+encodeURIComponent(r.code)});
    } catch(e){} });
    if (window.SSHR) (S().staff && S().staff[sid] || []).forEach(p => { try {
      const m = SSHR.summary(p.n);
      m.list.forEach(x => {
        const d = x.s.due ? iso(x.s.due) : x.s.s === 'missing' ? today() : '';
        if (!d && x.s.s !== 'soon') return;
        out.push({src:x.r.cat === 'Training' ? 'Staff training' : 'Staff file', ic:'🎓', title:x.r.t+': '+p.n+(x.s.s === 'missing' ? ' (missing)' : ''), due:d || addDays(today(), SOON), href:'#/hr'});
      });
    } catch(e){} });
    (S().delegations||[]).filter(d => d.site === sid && d.review).forEach(d => {
      const dd = iso(d.review); if (lvl(dd) === 'calm') return;
      out.push({src:'RN delegation', ic:'🩺', title:'Recheck '+d.task+' ('+d.cg+')', due:dd, href:'#/delegations'});
    });
    st().filter(x => x.site === sid && x.due).forEach(x => {
      if (lvl(x.due) === 'calm') return;
      out.push({src:'Your reminder', ic:'🔔', title:x.title, due:x.due, href:'#/reminders', mine:x});
    });
    return out.sort((a, b) => a.due.localeCompare(b.due));
  }

  function hidden(){ try { return sessionStorage.getItem('ss-rem-hide') === today()+S().site; } catch(e){ return false; } }

  // Red or amber banner for the top of the manager's and owner's home screens.
  function banner(){
    if (hidden()) return null;
    const items = collect(S().site); if (!items.length) return null;
    const red = items.filter(x => lvl(x.due) === 'red').length;
    const box = h('div',{class:'card remind '+(red ? 'alert' : 'warn'),role:'region','aria-label':'Reminders'},
      h('div',{class:'row',style:'justify-content:space-between;align-items:baseline'},
        h('b',{style:'font-size:1.05rem'}, (red ? '🔴 '+red+' overdue' : '🟠 Coming up')+(items.length > red ? (red ? ', ' : ': ')+(items.length - red)+' due within '+SOON+' days' : '')),
        h('button',{class:'linkbtn small',type:'button',onclick:()=>{ try { sessionStorage.setItem('ss-rem-hide', today()+S().site); } catch(e){} box.remove(); }},'Hide for today')),
      h('ul',{class:'remind-list'}, items.slice(0,5).map(x => h('li',null, h('a',{href:x.href}, x.ic+' '+x.title), ' ', h('span',{class:'chip '+(lvl(x.due) === 'red' ? 'red' : 'amber')}, when(x.due))))),
      h('a',{class:'btn ghost sm',href:'#/reminders'}, items.length > 5 ? 'See all '+items.length+' reminders' : 'Reminders and your own'));
    return box;
  }

  function markDone(x){
    x.done = (x.done||[]).concat([{at:new Date().toISOString(), due:x.due}]);
    if (x.repeat) x.due = addMonths(x.due < today() ? today() : x.due, +x.repeat); else x.due = '';
    save(); toast(x.due ? 'Done. Next one '+fmtDate(x.due) : 'Done');
  }

  R.reminders = v => {
    const sid = S().site;
    v.append(head('Reminders · '+((D.SITES.find(s => s.id === sid)||{}).name||''), 'What\'s due, and your own reminders', 'Care plan reviews, staff training and files, RN rechecks, and anything you add. Amber means due within '+SOON+' days, red means overdue. These also show as a banner on your home screen.'));
    const items = collect(sid);
    v.append(h('div',{class:'card'}, h('h2',null,'Due now and soon'),
      items.length ? h('div',{class:'list'}, items.map(x => h('div',{class:'item'},
        h('div',{class:'meta'}, h('span',{class:'chip '+(lvl(x.due) === 'red' ? 'red' : 'amber')}, when(x.due)), h('span',null,x.src), h('span',null,fmtDate(x.due))),
        h('a',{href:x.href,style:'font-weight:700'}, x.ic+' '+x.title),
        x.mine ? h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:()=>{ markDone(x.mine); A.route(); }},'Mark done')) : null)))
      : h('p',{class:'muted'},'Nothing due in the next '+SOON+' days.')));

    const title = h('input',{type:'text',maxlength:'120',placeholder:'e.g. Fire drill, renew food license, check the van',required:true,'aria-label':'What to remember'});
    const due = h('input',{type:'date',value:addDays(today(), 7),required:true,'aria-label':'Due date'});
    const rep = h('select',{'aria-label':'Repeat'}, Object.keys(REPEAT).map(k => h('option',{value:k,selected:k === '0'}, REPEAT[k])));
    const form = h('form',{class:'card soft grid',style:'gap:.6rem'},
      h('h2',null,'Add your own reminder'),
      h('label',{class:'f'},'What to remember', title),
      h('div',{class:'grid g2'}, h('label',{class:'f'},'Due', due), h('label',{class:'f'},'Repeat', rep)),
      h('p',{class:'small muted'},'No resident names or health details. Use room numbers or codes.'),
      h('div',{class:'row'}, h('button',{class:'btn',type:'submit'},'Add reminder')));
    form.addEventListener('submit', e => { e.preventDefault(); const t = title.value.trim(); if (!t || !due.value) return;
      st().push({id:uid(), site:sid, title:t, due:due.value, repeat:+rep.value, note:'', done:[]}); save(); toast('Reminder added'); A.route(); });
    v.append(form);

    const mine = st().filter(x => x.site === sid);
    v.append(h('div',{class:'card'}, h('h2',null,'All your reminders'),
      mine.length ? h('div',{class:'list'}, mine.map(x => h('div',{class:'item'},
        h('div',{class:'meta'}, x.due ? h('span',{class:'chip '+(lvl(x.due) === 'calm' ? 'calm' : lvl(x.due) === 'red' ? 'red' : 'amber')}, x.due ? when(x.due) : 'Done') : h('span',{class:'chip calm'},'Done'), h('span',null,REPEAT[x.repeat]||''), x.done && x.done.length ? h('span',null,'Last done '+fmtDate(x.done[x.done.length-1].at)) : null),
        h('b',null,x.title),
        h('div',{class:'row'},
          x.due ? h('button',{class:'btn sm',type:'button',onclick:()=>{ markDone(x); A.route(); }},'Mark done') : null,
          h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ S().reminders = st().filter(y => y !== x); save(); toast('Removed'); A.route(); }},'Remove')))))
      : h('p',{class:'muted'},'None yet.')));
  };
  VIEWS.reminders = {t:'Reminders', ic:'🔔'};
  ['manager','owner','multi'].forEach(t => { if (NAV[t] && !NAV[t].includes('reminders')) NAV[t].splice(1, 0, 'reminders'); });

  window.SSReminders = {banner, collect};
})();
