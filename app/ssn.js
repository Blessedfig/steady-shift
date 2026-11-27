// Steady Shift test app: Social Security numbers, masked by default (face sheets and employee files).
// - Shows the last 4 digits only. Never printed (class "ssn" is hidden in print) and never on the emergency packet.
// - Owners and house managers can reveal it for 30 seconds. Each reveal needs a reason and is logged.
// - "Benefits and insurance" holders (an owner turns it on per home for the house manager, or themselves) skip the reason, but every view is still logged.
// Sample numbers start with 000, which the SSA never issues.
(function(){
  const A = window.SSApp; if (!A) return;
  const {h, save, toast} = A;
  const S = () => A.state();
  const REVEAL = ['owner','multi','manager'];
  const REASONS = ['Medicaid or ForwardHealth','Medicare or Social Security office','SSI or SSDI, or the representative payee','Family Care or IRIS enrollment','Pharmacy or insurance claim','Payroll or tax form (staff)','Other'];
  const isOwner = () => ['owner','multi'].includes(S().tier);
  function ben(site){ const s = S(); s.benefits = s.benefits || {}; s.benefits[site] = s.benefits[site] || {manager:false, owner:false}; return s.benefits[site]; }
  const holder = site => { const b = ben(site), t = S().tier; return (t === 'manager' && b.manager) || (isOwner() && b.owner); };
  const mask = ssn => '•••-••-'+String(ssn||'').replace(/\D/g,'').slice(-4);
  function log(what, site, extra){
    try { if (window.SSAccess && SSAccess.log){ SSAccess.log(what, site); } else { const s = S(); s.audit = s.audit || []; s.audit.unshift({at:new Date().toISOString(), who:A.tier().name+' (you)', what, site}); save(); } } catch(e){}
    if (extra) try { extra(what); } catch(e){}
  }

  // A masked SSN line. opts: {ssn, site, label ('M-1' or a staff name), self (true when it is the viewer's own), onLog(fn)}
  function field(o){
    const wrap = h('div',{class:'item ssn'});
    const val = h('span',{class:'mono','aria-live':'polite'}, mask(o.ssn));
    const meta = h('div',{class:'meta'}, h('b',{style:'color:var(--ink)'},'Social Security number'), h('span',{class:'chip grey'},'Masked'));
    wrap.append(meta, val);
    const canReveal = REVEAL.includes(S().tier) || o.self;
    if (!canReveal){ wrap.append(h('span',{class:'small muted'},'Only an owner or house manager can view the full number.')); return wrap; }
    let timer = 0;
    const show = reason => {
      val.textContent = o.ssn; log('Viewed SSN for '+o.label+(reason ? ' (reason: '+reason+')' : o.self ? ' (own record)' : ' (benefits and insurance access)'), o.site, o.onLog);
      btn.hidden = true; form.hidden = true; clearTimeout(timer);
      timer = setTimeout(() => { val.textContent = mask(o.ssn); btn.hidden = false; }, 30000);
      toast('Shown for 30 seconds. This view is logged.');
    };
    const why = h('select',{'aria-label':'Reason for viewing'}, h('option',{value:''},'Why do you need it?'), REASONS.map(r => h('option',null,r)));
    const other = h('input',{type:'text',maxlength:'120',placeholder:'Type the reason',hidden:true,'aria-label':'Other reason'});
    why.addEventListener('change', () => { other.hidden = why.value !== 'Other'; });
    const form = h('div',{class:'grid',style:'gap:.4rem',hidden:true}, why, other,
      h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:() => { const r = why.value === 'Other' ? other.value.trim() : why.value; if (!r){ toast('Pick a reason first'); why.focus(); return; } show(r); }},'Show for 30 seconds'), h('button',{class:'btn quiet sm',type:'button',onclick:() => { form.hidden = true; btn.hidden = false; }},'Cancel')));
    const skip = o.self || (o.kind !== 'staff' && holder(o.site));
    const btn = h('button',{class:'btn quiet sm',type:'button',onclick:() => { if (skip) show(''); else { form.hidden = false; btn.hidden = true; why.focus(); } }}, skip ? 'Show (logged)' : 'Show full number');
    wrap.append(btn, form, h('span',{class:'small muted'}, skip && !o.self ? 'You have benefits and insurance access here, so no reason is needed. Every view is still logged.' : 'A reason is needed and the view is logged. Never printed.'));
    return wrap;
  }

  // Owner card: who at this home handles benefits and insurance (sees resident SSNs without a reason each time).
  function grantCard(site){
    if (!isOwner()) return null;
    const b = ben(site);
    const box = (k, label) => { const id = 'ben-'+k+'-'+site; const cb = h('input',{type:'checkbox',id,checked:!!b[k]});
      cb.addEventListener('change', () => { b[k] = cb.checked; b.by = A.tier().name+' (you)'; b.at = new Date().toISOString(); log((cb.checked ? 'Gave ' : 'Removed ')+'benefits and insurance access: '+label, site); save(); toast('Saved'); });
      return h('label',{class:'row small',for:id,style:'align-items:flex-start'}, cb, h('span',null,label)); };
    return h('details',{class:'item noprint'}, h('summary',null,h('b',null,'Benefits and insurance access (owner setting)')),
      h('p',{class:'small'},'Whoever handles residents\' Medicaid, Medicare, SSI or SSDI, the payee and Family Care or IRIS enrollment needs Social Security numbers more often. People with this access can view them without typing a reason each time. Every view is still logged, and numbers are never printed.'),
      box('manager','House manager at this home'), box('owner','Me (owner)'),
      b.at ? h('span',{class:'small muted'},'Last changed '+A.fmtTime(b.at)+' by '+b.by) : null);
  }

  window.SSSSN = {field, grantCard, mask, holder};
})();
