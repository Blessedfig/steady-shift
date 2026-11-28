// Steady Shift test app: shift progress notes.
// A quick note in the staff member's own words ("edna ate here", "went out w guardian 3-5"), turned into professional wording
// with one tap. Both versions are kept and the writer picks which one goes on the report. Optional DAR detail (Data, Action,
// Response). The rewrite only rewords; it never adds facts. Linked to the resident's care plan (ISP) goals. Drafts save as you type, so nothing is lost if the
// phone locks or the app closes. "Make it professional" reuses the same casual-to-professional wording as incident reports.
// Signing stamps the note with name and time; after that it can't be changed, only added to with a signed addendum.
// Notes show in the shift change report, on the face sheet, on #/notes, and in the executive summary. Sample data only.
(function(){
  const A = window.SSApp, C = window.SSCare;
  if (!A || !C) return;
  const {h, save, toast, head, R, VIEWS, NAV, uid, fmtDate, fmtTime, site, tier, D} = A;
  const S = () => A.state();
  const {chip, card, helpBox, today, addDays} = C;
  const isMgr = () => ['manager','owner','multi','rn'].includes(S().tier);
  const PARTS = [
    {id:'data', label:'Data: what you saw or heard', ph:'e.g. Ate about half of breakfast. Said "my knee hurts" when standing. Walked to the dining room with the walker.'},
    {id:'action', label:'Action: what you did', ph:'e.g. Offered the shake and a warm pack for the knee. Reminded to use the walker.'},
    {id:'response', label:'Response: how they responded', ph:'e.g. Drank the whole shake. Said the knee felt better after 20 minutes.'}
  ];

  // ---------- state ----------
  function st(){
    const c = C.ensure();
    if (!c.notes || c.notesV !== 1){ c.notes = seed(); c.notesV = 1; c.noteDrafts = c.noteDrafts || {}; save(); }
    c.noteDrafts = c.noteDrafts || {};
    return c;
  }
  function me(){ try { if (window.SSSched && SSSched.me) { const m = SSSched.me(); if (m) return m; } } catch(e){} return tier().name+' (you)'; }
  function goalsFor(sid, code){
    try { const p = window.SSISP && SSISP.plan(sid, code); const v = p && p.versions[p.versions.length-1]; if (v && v.data) return (v.data.goals||[]).map(g => ({id:g.lib||g.id, dom:g.dom, goal:g.goal})); } catch(e){}
    return [];
  }
  function seed(){
    const out = []; const t = today();
    out.push({id:uid(), site:'maple', res:'M-2', shift:addDays(t,-1)+' Day', at:addDays(t,-1)+'T16:05:00', by:'Caregiver B', raw:'went out w daughter (guardian) 3-5pm for coffee, got back happy, ate good at supper', pro:'The resident left the home with daughter (guardian) from 3:00 to 5:00 PM for coffee, returned happy, ate well at supper.', use:'pro', data:'', action:'', response:'', goals:[], signed:{by:'Caregiver B', at:addDays(t,-1)+'T16:05:00'}, addenda:[]});
    const S1 = [
      ['maple','M-1',1,'Day','Ate about 75% of lunch. Walked to the porch with the walker, steady. Said she was "tired of the cold."','Offered a warm drink and a blanket on the porch. Reminded to sit before turning.','Sat 20 minutes and chatted. Returned inside without help.',['fall']],
      ['maple','M-1',0,'Night','Woke at 2:10 AM and asked for the bathroom. Steady with the walker and one staff nearby.','Walked beside her, night light on, back to bed by 2:20.','Slept until 6 AM per checks.',['fall']],
      ['maple','M-2',1,'Day','Declined shower at 9 AM. Said "not today, I\'m cold."','Offered a warm room and a later time. Did not push.','Accepted a shower at 2 PM after lunch.',[]],
      ['birch','B-9',1,'Day','Ate 25% of breakfast and 50% of lunch. Weight not due today.','Offered the shake and preferred foods from the choices list.','Drank half the shake. Will offer again at supper.',['diet']]
    ];
    S1.forEach(([site,res,ago,shift,data,action,response,goals]) => {
      const d = addDays(t, -ago); const at = d+'T'+(shift==='Day'?'14:30':'05:40')+':00';
      out.push({id:uid(), site, res, shift:d+' '+shift, at, by:'Caregiver A', raw:'', pro:'', use:'pro', data, action, response, goals, signed:{by:'Caregiver A', at}, addenda:[]});
    });
    return out;
  }
  const notesFor = (sid, code) => st().notes.filter(n => n.site===sid && (!code || n.res===code)).sort((a,b) => a.at<b.at?1:-1);
  const draftKey = (sid, code) => sid+'|'+code+'|'+C.shiftNow().key;

  // ---------- professional wording (reuses the incident-report rewrite) ----------
  const SHORT = [
    [/\bw\/o\b/gi,'without'], [/\bw\/(?=\s|$)/gi,'with'], [/\bw\b(?=\s)/gi,'with'], [/\bb\/c\b|\bbc\b|\bbcuz\b/gi,'because'], [/\babt\b/gi,'about'], [/\bthru\b/gi,'through'],
    [/\bappt\b/gi,'appointment'], [/\bdr\b\.?/gi,'doctor'], [/\bbm\b/gi,'bowel movement'], [/\bpls\b/gi,'please'], [/\bnxt\b/gi,'next'], [/\btmrw\b/gi,'tomorrow'],
    [/\bmins?\b/gi,'minutes'], [/\bhrs?\b/gi,'hours'], [/\bgot back\b/gi,'returned'], [/\bwent out\b/gi,'left the home'], [/\bnap(ped)?\b/gi,'rested'],
    [/\bate good\b/gi,'ate well'], [/\bslept good\b/gi,'slept well'], [/\bok\b/gi,'okay']
  ];
  function expand(text, code){
    const ch = []; let t = text;
    const r = (D.RESIDENTS[S().site]||[]).find(x => x.code === code);
    (D.RESIDENTS[S().site]||[]).forEach(x => { const re = new RegExp('\\b'+x.nick+'\\b','gi'); if (re.test(t)){ t = t.replace(re, x.code===code ? 'the resident' : 'resident '+x.code); ch.push('Replaced the name "'+x.nick+'" with '+(x.code===code ? '"the resident"' : 'the resident code')+'.'); } });
    SHORT.forEach(([re, to]) => { t = t.replace(re, m => { if (m.toLowerCase() !== to) ch.push('"'+m+'" → "'+to+'"'); return to; }); });
    // "3-5" or "3-5pm" -> "from 3:00 to 5:00" (AM or PM only if the writer said it)
    t = t.replace(/\b(\d{1,2})(?::(\d{2}))?\s*(?:-|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?(?=\W|$)/gi, (m, a, am, b, bm, ap) => {
      if (+a > 12 || +b > 12) return m;
      const out = 'from '+a+':'+(am||'00')+' to '+b+':'+(bm||'00')+(ap ? ' '+ap.replace(/\./g,'').toUpperCase() : '');
      ch.push('"'+m.trim()+'" → "'+out+'"'); return out; });
    t = t.replace(/\bfrom from\b/gi,'from');
    return {t, ch};
  }
  function polish(text, code){
    if (!text || !text.trim()) return {text:'', changes:[], flags:[]};
    const ex = expand(text, code); const ch = ex.ch.slice(); let t = ' '+ex.t+' ';
    // same casual-to-professional swaps and word flags as incident reports (data.js WORDING and FLAGS)
    t = t.replace(/\b(didnt|dont|wouldnt|cant|wasnt|isnt|wont)\b/gi, m => m.slice(0,-1)+"'"+m.slice(-1));
    (D.WORDING||[]).forEach(([re, to]) => { t = t.replace(re, m => { if (m.toLowerCase() !== to.toLowerCase()) ch.push('"'+m+'" → "'+to+'"'); return to; }); });
    // other capitalized words mid-sentence may be names: ask for a role instead
    const known = new Set(['I','AM','PM','ER','RN','LPN','CNA','DQA','PRN','DNR','EMS','OK','PT','OT']);
    const names = new Set();
    t.replace(/\b([A-Z][a-z]{2,})\b/g, (m, w, off) => { const before = t.slice(0, off).trimEnd(); if (before && !/[.!?]$/.test(before) && !known.has(w) && !/^(Resident|Staff|Manager|Nurse|Mom|Dad|Guardian|Doctor|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/.test(w)) names.add(w); return m; });
    names.forEach(n => { t = t.replace(new RegExp('\\b'+n+'\\b','g'), '[name: use a role]'); ch.push('Removed the name "'+n+'". Use a role, like visitor or nurse.'); });
    const flags = [];
    (D.FLAGS||[]).forEach(fl => { const m = t.match(fl.re); if (m) [...new Set(m.map(x => x.toLowerCase()))].forEach(w => flags.push({w, why:fl.why})); });
    t = t.replace(/\s+/g,' ').trim().replace(/\bi\b/g,'I').replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a+b.toUpperCase());
    if (t && !/[.!?]$/.test(t)) t += '.';
    return {text:t, changes:[...new Set(ch)], flags};
  }

  // ---------- one note: editor for this shift, or the signed note ----------
  // the text that goes on the report: the version the writer chose, plus any DAR detail
  function chosen(n){ return n.use === 'raw' ? (n.raw||'') : (n.pro || n.raw || ''); }
  function noteText(n){ return [chosen(n), n.data ? 'D: '+n.data : '', n.action ? 'A: '+n.action : '', n.response ? 'R: '+n.response : ''].filter(Boolean).join('\n'); }
  function signedView(n, opts){
    opts = opts || {};
    const gl = goalsFor(n.site, n.res).filter(g => (n.goals||[]).includes(g.id));
    const box = h('div',{class:'item note'},
      h('div',{class:'meta'}, opts.showRes ? chip(n.res) : null, h('span',null, fmtTime(n.at)+' · '+n.shift.slice(11)+' shift'), chip('Signed: '+n.signed.by,'calm')),
      chosen(n) ? h('span',null, chosen(n)) : null,
      PARTS.filter(p => n[p.id]).map(p => h('span',{class:'small'}, h('b',null,p.label.split(':')[0]+': '), n[p.id])),
      n.raw && n.pro && n.raw !== n.pro ? h('details',{class:'small'}, h('summary',null, n.use === 'raw' ? 'Professional version' : 'Original words'), h('p',null, n.use === 'raw' ? n.pro : n.raw)) : null,
      gl.length ? h('div',{class:'chips'}, gl.map(g => chip('Goal: '+g.dom,'grey'))) : null,
      (n.addenda||[]).map(a => h('span',{class:'small addm'}, h('b',null,'Addendum '+fmtTime(a.at)+', '+a.by+': '), a.text)));
    if (opts.addendum !== false){
      const t = h('textarea',{maxlength:'600','aria-label':'Addendum to the note from '+fmtTime(n.at),placeholder:'Add a correction or late detail. The first note stays as written.',style:'min-height:3rem'});
      const det = h('details',{class:'small'}, h('summary',null,'Add an addendum'), t,
        h('div',{class:'row'}, h('button',{type:'button',class:'btn ghost sm',onclick:()=>{ const v = polish(t.value, n.res).text; if (!v) return toast('Write the addendum first'); (n.addenda = n.addenda||[]).push({at:new Date().toISOString(), by:me(), text:v}); save(); toast('Addendum signed and added'); box.replaceWith(signedView(n, opts)); }},'Sign addendum')));
      box.append(det);
    }
    return box;
  }
  function editor(sid, code, onSigned){
    const c = st(); const k = draftKey(sid, code);
    const dr = c.noteDrafts[k] || {raw:'', pro:'', use:'pro', data:'', action:'', response:'', goals:[], saved:null};
    const wrap = h('div',{class:'grid noteed'});
    const status = h('span',{class:'small muted',role:'status','aria-live':'polite'}, dr.saved ? 'Draft saved '+fmtTime(dr.saved) : 'Drafts save as you type.');
    let timer = null;
    const keep = () => { c.noteDrafts[k] = dr; clearTimeout(timer); timer = setTimeout(() => { dr.saved = new Date().toISOString(); save(); status.textContent = 'Draft saved '+fmtTime(dr.saved); }, 400); };
    const els = {};
    const raw = h('textarea',{maxlength:'800',placeholder:'e.g. ate good at lunch. went out w guardian 3-5, got back happy','aria-label':'Quick note in your own words for '+code,style:'min-height:3.2rem'}); raw.value = dr.raw||'';
    raw.addEventListener('input', () => { dr.raw = raw.value; keep(); });
    const pro = h('textarea',{maxlength:'1000','aria-label':'Professional version for '+code,placeholder:'Tap "Make it professional", then read it.',style:'min-height:3.2rem'}); pro.value = dr.pro||'';
    pro.addEventListener('input', () => { dr.pro = pro.value; keep(); });
    els.raw = raw; els.pro = pro;
    const rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const mic = rec ? h('button',{type:'button',class:'btn quiet sm',onclick:()=>{ try { const r = new rec(); r.lang = 'en-US'; r.onresult = e => { raw.value = (raw.value ? raw.value+' ' : '')+e.results[0][0].transcript; dr.raw = raw.value; keep(); }; r.start(); toast('Listening… speak your note. Your browser\'s speech service turns it into text (in Chrome, that is Google), so sample details only.'); } catch(e){ toast('Speaking is not available here. Type the note.'); } }},'🎤 Speak') : null;
    const tips = h('div',{class:'small',hidden:true});
    const btnRow = h('div',{class:'row'});
    wrap.append(h('label',{class:'f'},'Quick note in your own words', raw), btnRow, tips);
    const proLab = h('label',{class:'f'},'Professional version (edit anything that is not exactly right)', pro);
    wrap.append(proLab);
    const useName = 'use-'+code+'-'+uid();
    const useRow = h('fieldset',{class:'goals'}, h('legend',{class:'small'},'Which goes on the report'),
      [['pro','Professional version'],['raw','My own words']].map(([val, lab]) => { const id = useName+val; const r = h('input',{type:'radio',name:useName,id,value:val,checked:(dr.use||'pro')===val}); r.addEventListener('change',()=>{ dr.use = val; keep(); }); return h('label',{class:'checkrow',for:id}, r, lab); }),
      h('p',{class:'small muted'},'Both are saved with the note.'));
    wrap.append(useRow);
    const dar = h('details',{class:'small',open:PARTS.some(p => (dr[p.id]||'').trim())}, h('summary',null,'Add more detail (Data, Action, Response)'));
    PARTS.forEach(p => {
      const ta = h('textarea',{maxlength:'800',placeholder:p.ph,'aria-label':p.label+' for '+code,style:'min-height:3rem'}); ta.value = dr[p.id]||'';
      ta.addEventListener('input', () => { dr[p.id] = ta.value; keep(); });
      els[p.id] = ta; dar.append(h('label',{class:'f'}, p.label, ta));
    });
    wrap.append(dar);
    const goals = goalsFor(sid, code);
    if (goals.length){
      const gb = h('fieldset',{class:'goals'}, h('legend',{class:'small'},'Care plan goals this note is about'));
      goals.forEach((g, i) => { const id = 'ng-'+code+'-'+i; const cb = h('input',{type:'checkbox',id,checked:dr.goals.includes(g.id)});
        cb.addEventListener('change',()=>{ dr.goals = cb.checked ? dr.goals.concat(g.id) : dr.goals.filter(x => x!==g.id); keep(); });
        gb.append(h('label',{class:'checkrow',for:id}, cb, h('span',{class:'small'}, h('b',null,g.dom+': '), g.goal))); });
      wrap.append(gb);
    } else wrap.append(h('p',{class:'small muted'},'No care plan goals on file yet. ', h('a',{href:'#/isp'},'Care plans')));
    const polishBtn = h('button',{type:'button',class:'btn quiet sm',onclick:()=>{
      const ch = [], fl = [];
      if (raw.value.trim()){ const r = polish(raw.value, code); pro.value = r.text; dr.pro = r.text; ch.push(...r.changes); fl.push(...r.flags); }
      PARTS.forEach(p => { const r = polish(els[p.id].value, code); if (r.text){ els[p.id].value = r.text; dr[p.id] = r.text; } ch.push(...r.changes); fl.push(...r.flags); });
      keep(); tips.hidden = false; tips.textContent = '';
      tips.append(ch.length ? h('p',null,h('b',null,'Changed: '), [...new Set(ch)].join(' · ')) : h('p',null,'Reads professionally already.'),
        ...(fl.length ? [h('p',null,h('b',null,'Check these words: '), [...new Set(fl.map(f => f.w+' ('+f.why+')'))].join(' · '))] : []),
        h('p',{class:'muted'},'This only rewords what you wrote. It never adds facts. Read it and fix anything that is not exactly what happened.'));
    }},'Make it professional');
    const signBtn = h('button',{type:'button',class:'btn sm',onclick:()=>{
      if (!raw.value.trim() && !els.data.value.trim()) return toast('Write a quick note first');
      const use = dr.use || 'pro';
      if (use === 'pro' && raw.value.trim() && !pro.value.trim()) return toast('Tap "Make it professional" and read it, or choose "My own words"');
      const by = me(); const at = new Date().toISOString();
      const n = {id:uid(), site:sid, res:code, shift:C.shiftNow().key, at, by, raw:raw.value.trim(), pro:pro.value.trim(), use, data:els.data.value.trim(), action:els.action.value.trim(), response:els.response.value.trim(), goals:dr.goals.slice(), signed:{by, at}, addenda:[]};
      c.notes.push(n); delete c.noteDrafts[k]; save(); toast('Note signed '+fmtTime(at)); if (onSigned) onSigned(n);
    }},'Sign note');
    btnRow.append(...[mic, polishBtn].filter(Boolean));
    wrap.append(h('div',{class:'row'}, signBtn, h('button',{type:'button',class:'btn quiet sm',onclick:()=>{ ['raw','pro'].concat(PARTS.map(p => p.id)).forEach(k2 => { els[k2].value=''; dr[k2]=''; }); keep(); }},'Clear draft')), status);
    return wrap;
  }
  // Block for the shift report: this shift's signed notes plus an editor for another one.
  function shiftBlock(sid, code){
    const key = C.shiftNow().key;
    const box = h('div',{class:'grid'});
    function draw(){
      box.textContent = '';
      const mine = notesFor(sid, code).filter(n => n.shift === key);
      mine.forEach(n => box.append(signedView(n)));
      box.append(editor(sid, code, () => draw()));
    }
    draw();
    const has = notesFor(sid, code).some(n => n.shift === key);
    const dr = st().noteDrafts[draftKey(sid, code)];
    const hasDraft = dr && ['raw','pro'].concat(PARTS.map(p => p.id)).some(k2 => (dr[k2]||'').trim());
    return h('details',{class:'adl about pnote',open:hasDraft}, h('summary',null,'Progress note ', has ? chip('Signed this shift','calm') : hasDraft ? chip('Draft saved','amber') : chip('Not written yet','grey')), box);
  }
  function shiftStatus(sid){
    const key = C.shiftNow().key; const c = st();
    return (D.RESIDENTS[sid]||[]).map(r => {
      const dr = c.noteDrafts[sid+'|'+r.code+'|'+key];
      return {code:r.code, signed:c.notes.filter(n => n.site===sid && n.res===r.code && n.shift===key).map(n => n.id), draft:!!(dr && ['raw','pro'].concat(PARTS.map(p => p.id)).some(k2 => (dr[k2]||'').trim()))};
    });
  }
  // Face sheet block: the latest notes.
  function faceBlock(code){
    const ns = notesFor(S().site, code).slice(0, 3);
    return h('div',{class:'card soft',style:'box-shadow:none'},
      h('div',{class:'meta'}, h('b',{style:'color:var(--ink)'},'📝 Recent progress notes'), h('a',{class:'small',href:'#/notes/'+encodeURIComponent(code)},'All notes')),
      ns.length ? h('div',{class:'list'}, ns.map(n => signedView(n, {addendum:false}))) : h('p',{class:'small muted'},'No progress notes yet.'));
  }

  // ---------- #/notes ----------
  R.notes = v => {
    const sid = S().site; const p = C.param ? C.param() : '';
    const res = A.residents();
    const code = res.some(r => r.code === p) ? p : '';
    v.append(head('Progress notes · '+site().name, code ? 'Notes for '+code : 'Progress notes', 'Quick notes from each shift, in staff\'s own words and a professional version. Signed notes can only be added to, never changed.'));
    const sel = h('select',{'aria-label':'Resident'}, h('option',{value:''},'All residents'), res.map(r => h('option',{value:r.code,selected:r.code===code},r.code+' '+r.nick)));
    sel.addEventListener('change',()=>{ location.hash = '#/notes'+(sel.value?'/'+encodeURIComponent(sel.value):''); });
    v.append(h('div',{class:'row'}, h('label',{class:'f'},'Resident',sel), h('a',{class:'btn ghost sm',href:'#/shift/give'},'Write a note in the shift report')));
    const ns = notesFor(sid, code);
    v.append(card('', ns.length ? h('div',{class:'list'}, ns.map(n => signedView(n, {showRes:!code}))) : h('p',{class:'muted'},'No notes yet.')));
    v.append(h('div',{class:'row'}, h('button',{type:'button',class:'btn quiet sm',onclick:()=>{
      const csv = [['signed at','shift','resident','by','on report','own words','professional','data','action','response','goals','addenda']].concat(ns.slice().reverse().map(n => [n.signed.at, n.shift, n.res, n.signed.by, chosen(n), n.raw||'', n.pro||'', n.data, n.action, n.response, (n.goals||[]).join('; '), (n.addenda||[]).map(a => a.at+' '+a.by+': '+a.text).join(' | ')]));
      A.download('progress-notes-'+sid+(code?'-'+code:'')+'.csv','text/csv',csv.map(r => r.map(A.csvCell).join(',')).join('\n'));
    }},'Download (.csv)'), h('span',{class:'small muted'},'Sample data.')));
    v.append(helpBox('How to write a good progress note',
      h('p',{class:'small'},'Start with a quick note in your own words, then tap "Make it professional". It only rewords what you wrote: names become "the resident", shorthand like "w" and "3-5" is spelled out. Both versions are saved and you choose which goes on the report. For more detail use DAR: Data (what you saw or heard, with exact words in quotes), Action (what you did), Response (how the person responded). Write facts, not opinions: "ate 25% of lunch" instead of "picky eater". Use the resident\'s code or room, never another resident\'s name. Tick the care plan goal the note is about, so the plan review can show progress.'),
      h('p',{class:'small'},'Signed notes are never edited or deleted. To correct one, add an addendum: it is signed and timed, and the first note stays as written. This is the standard for records in licensed homes.')));
  };

  // ---------- executive summary section ----------
  (window.SSBriefHooks = window.SSBriefHooks || []).push((out, text, list, days) => {
    const since = addDays(today(), -days);
    const rows = [];
    list.forEach(sid => (D.RESIDENTS[sid]||[]).forEach(r => {
      const ns = notesFor(sid, r.code).filter(n => n.at.slice(0,10) >= since);
      const last = notesFor(sid, r.code)[0];
      const gap = last ? Math.round((new Date(today()+'T12:00:00') - new Date(last.at.slice(0,10)+'T12:00:00'))/864e5) : null;
      const goals = {}; ns.forEach(n => (n.goals||[]).forEach(g => goals[g] = (goals[g]||0)+1));
      rows.push({sid, r, n:ns.length, gap, goals});
    }));
    const quiet = rows.filter(x => x.gap == null || x.gap >= 3);
    const total = rows.reduce((a,x) => a+x.n, 0);
    out.append(h('h2',null,'Progress notes'), card(quiet.length ? 'warn' : '',
      h('p',{class:'small'}, total+' signed note'+(total===1?'':'s')+' in the last '+days+' days. '+(quiet.length ? quiet.length+' resident'+(quiet.length===1?' has':'s have')+' no note in 3 or more days: '+quiet.map(x => x.r.code).join(', ')+'.' : 'Every resident has a recent note.')),
      h('ul',{class:'small'}, rows.filter(x => x.n).map(x => h('li',null, (list.length > 1 ? (D.SITES||[]).find?.(s => s.id===x.sid)?.name+', ' : '')+x.r.code+': '+x.n+' note'+(x.n===1?'':'s')+(Object.keys(x.goals).length ? ' · goals: '+Object.entries(x.goals).map(([g,k]) => g+' ('+k+')').join(', ') : '')))),
      h('a',{class:'small',href:'#/notes'},'Open progress notes')));
    text.push('', 'Progress notes: '+total+' signed in the last '+days+' days.'+(quiet.length ? ' No note in 3+ days: '+quiet.map(x => x.r.code).join(', ')+'.' : ''));
  });

  // ---------- register ----------
  VIEWS.notes = {t:'Progress notes', ic:'📝'};
  const addNav = (t, after) => { const n = NAV[t]; if (!n || n.includes('notes')) return; const at = n.indexOf(after) >= 0 ? n.indexOf(after)+1 : n.length; n.splice(at, 0, 'notes'); };
  addNav('caregiver','shift'); addNav('manager','shift'); addNav('rn','shift');
  if (window.SSAccess && SSAccess.register) try { SSAccess.register({id:'notes', name:'Progress notes', ic:'📝', what:'Quick notes in your own words, made professional with one tap, linked to care plan goals, signed, with addenda only.', views:['notes'], tiers:['caregiver','manager','rn','owner','multi']}); } catch(e){}
  window.SSNotes = {shiftBlock, shiftStatus, faceBlock, notesFor, signedView, noteText};
})();
