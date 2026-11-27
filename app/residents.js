// Steady Shift test app: Residents, move-outs and returns (#/residents).
// Idea from Angelika (2026-11-27, marked urgent): "a remove resident option for when they're no longer in the facility".
// A manager marks a resident as moved out (date, where they went, why). They leave every active list (meals, handoff,
// orders, care plans, drills, banners), but their records stay on file and can be brought back with one tap.
// Sample data only. State lives in S.movedOut (this browser only).
(function(){
  const A = window.SSApp; if (!A) return;
  const {D, h, save, toast, head, R, VIEWS, NAV, isoDay, fmtDate:fmtAny} = A;
  const S = () => A.state();
  const today = () => isoDay(new Date());
  const fmtDate = d => fmtAny(/^\d{4}-\d{2}-\d{2}$/.test(d||'') ? d+'T12:00:00' : d);
  const isMgr = () => ['manager','owner','multi'].includes(S().tier);
  const REASONS = ['Moved to another home or facility', 'Moved home or with family', 'Hospital or nursing home stay (not coming back)', 'Passed away', 'Discharged by the home (notice given)', 'Other'];
  const hidden = {}; // site -> removed resident objects, so they can be restored

  function list(){ const s = S(); if (!Array.isArray(s.movedOut)) { s.movedOut = []; save(); } return s.movedOut; }
  // Take moved-out residents off the shared resident lists that every screen reads (D.RESIDENTS), in place.
  function apply(){
    const out = list();
    Object.keys(D.RESIDENTS).forEach(sid => {
      const arr = D.RESIDENTS[sid]; if (!Array.isArray(arr)) return;
      for (let i = arr.length - 1; i >= 0; i--){
        const r = arr[i];
        if (out.some(x => x.site === sid && x.code === r.code)){ (hidden[sid] = hidden[sid] || {})[r.code] = r; arr.splice(i, 1); }
      }
    });
  }
  function restore(x){
    S().movedOut = list().filter(y => y !== x); save();
    const r = (hidden[x.site] || {})[x.code] || {code:x.code, nick:x.nick, note:'Returned'};
    const arr = D.RESIDENTS[x.site] = D.RESIDENTS[x.site] || [];
    if (!arr.some(y => y.code === r.code)) arr.push(r);
    toast(x.nick+' is back on the active lists');
  }

  R.residents = v => {
    apply();
    const sid = S().site, name = (D.SITES.find(s => s.id === sid) || {}).name || '';
    v.append(head('Residents · '+name, 'Who lives here now', 'When someone moves out, mark it here. They leave every active list (meals, shift handoff, orders, care plans, reminders) but their records stay on file, and you can bring them back if they return.'));
    if (sid === 'family'){ v.append(h('p',{class:'muted'},'Pick one of the homes to manage residents.')); return; }
    const cur = D.RESIDENTS[sid] || [];
    v.append(h('div',{class:'card'}, h('h2',null,'Current residents ('+cur.length+')'),
      cur.length ? h('div',{class:'list'}, cur.map(r => {
        const row = h('div',{class:'item'},
          h('div',{class:'meta'}, h('span',{class:'chip'}, r.code), h('b',{style:'color:var(--ink)'}, r.nick+' (sample)')),
          r.note ? h('span',{class:'small muted'}, r.note) : null);
        if (isMgr()) row.append(h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ row.replaceWith(form(r)); }}, 'Mark as moved out')));
        return row;
      })) : h('p',{class:'muted'},'No current residents.'),
      h('p',{class:'small muted'},'New residents are added through New admission (Admission intake).'),
      VIEWS.intake ? h('a',{class:'btn ghost sm',href:'#/intake'},'New admission') : null));

    function form(r){
      const date = h('input',{type:'date',value:today(),max:addDaysISO(today(), 60),'aria-label':'Move-out date'});
      const why = h('select',{'aria-label':'Why'}, REASONS.map(x => h('option',{value:x},x)));
      const to = h('input',{type:'text',maxlength:'120',placeholder:'Where to (optional), e.g. "another AFH", "family in Madison"','aria-label':'Where to'});
      const notice = h('p',{class:'small',hidden:true},'If the home is ending the stay, the rules require written notice ahead of time in most cases (usually 30 days) and a reason that the rules allow. Check the discharge Clarity Card before you give notice.');
      why.addEventListener('change', () => { notice.hidden = !/Discharged by the home/.test(why.value); });
      const f = h('form',{class:'card soft grid',style:'gap:.6rem'},
        h('h3',null,'Move out: '+r.code+' '+r.nick),
        h('div',{class:'grid g2'}, h('label',{class:'f'},'Date', date), h('label',{class:'f'},'Why', why)),
        h('label',{class:'f'},'Where to', to), notice,
        h('p',{class:'small muted'},'Records stay on file. No resident names or health details: this is a test version with made-up people.'),
        h('div',{class:'row'}, h('button',{class:'btn sm',type:'submit'},'Confirm move-out'), h('button',{class:'btn quiet sm',type:'button',onclick:()=>A.route()},'Cancel')));
      f.addEventListener('submit', e => { e.preventDefault();
        list().push({site:sid, code:r.code, nick:r.nick, date:date.value || today(), why:why.value, to:to.value.trim(), by:(A.tier().name)+' (you)', at:new Date().toISOString()});
        save(); apply(); toast(r.nick+' moved out. Records kept.'); A.route(); });
      return f;
    }

    const past = list().filter(x => x.site === sid).slice().sort((a,b) => b.date.localeCompare(a.date));
    v.append(h('div',{class:'card'}, h('h2',null,'Moved out'),
      past.length ? h('div',{class:'list'}, past.map(x => h('div',{class:'item'},
        h('div',{class:'meta'}, h('span',{class:'chip'}, x.code), h('span',null,'Moved out '+fmtDate(x.date)), h('span',null,x.by)),
        h('b',{style:'color:var(--ink)'}, x.nick+' (sample)'),
        h('span',{class:'small'}, x.why+(x.to ? ' · '+x.to : '')),
        isMgr() ? h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:()=>{ restore(x); A.route(); }},'Undo: they\'re back')) : null)))
      : h('p',{class:'muted'},'Nobody has moved out.')));
  };
  function addDaysISO(d, n){ const x = new Date(d+'T12:00:00'); x.setDate(x.getDate()+n); return isoDay(x); }

  VIEWS.residents = {t:'Residents', ic:'🛏️'};
  ['manager','owner','multi'].forEach(t => { if (NAV[t] && !NAV[t].includes('residents')) NAV[t].splice(2, 0, 'residents'); });
  window.SSResidents = {apply, list};
  apply();
})();
