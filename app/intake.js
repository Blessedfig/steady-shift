// Steady Shift test app: New resident admission intake (#/intake).
// Bulk upload or in-app photo capture -> structured profile with every field linked to its source page ->
// RN or manager review with conflict flags -> DHS 88 / DHS 83 admission checklist -> sets up orders, meals and handoff.
// Test version: sample documents only. Photos and files stay in this page's memory and are never saved to the device.
(function(){
  const A = window.SSApp, D = window.SS_DATA, SAMPLE = window.SS_INTAKE_SAMPLES;
  if (!A || !D) return;
  const h = A.h, S = () => A.state(), save = () => A.save(), toast = A.toast;
  const uid = () => Math.random().toString(36).slice(2,9);
  const today = () => new Date().toISOString().slice(0,10);
  const addDays = (d, n) => { const x = new Date(d+'T12:00:00'); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); };
  const fmt = s => { if (!s) return ''; const d = new Date(s.length===10 ? s+'T12:00:00' : s); return isNaN(d) ? s : d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); };
  const site = () => D.SITES.find(s => s.id === S().site) || D.SITES[0];
  const tierName = () => (D.TIERS.find(t => t.id === S().tier) || {name:'Someone'}).name;
  const norm = s => String(s||'').toLowerCase().replace(/\bpo\b|by mouth/g,'').replace(/\bbid\b/g,'twice daily').replace(/[^a-z0-9.]+/g,' ').trim();

  // ---------- state ----------
  function st(){ const s = S(); if (!s.intake || s.intake.v !== 1) s.intake = {v:1, list:[], log:[], okSample:false}; return s.intake; }
  // Memory-only store for photos and uploaded files. Never written to localStorage, IndexedDB or the device gallery.
  const MEM = {blobs:{}};
  function forget(docId){ const b = MEM.blobs[docId]; if (b){ b.forEach(p => { try { URL.revokeObjectURL(p.url); } catch(e){} }); delete MEM.blobs[docId]; } }
  function forgetAll(){ Object.keys(MEM.blobs).forEach(forget); }
  function log(adm, what){ const L = st().log; L.push({at:new Date().toISOString(), who:tierName()+' (you)', site:S().site, adm:adm ? adm.id : null, what}); if (L.length > 500) L.splice(0, L.length-500); save(); }

  // Residents admitted here show up in every other screen (orders, meals, handoff).
  function syncResidents(){
    st().list.filter(a => a.status === 'live').forEach(a => {
      const arr = D.RESIDENTS[a.site] = D.RESIDENTS[a.site] || [];
      if (!arr.some(r => r.code === a.code)) arr.push({code:a.code, nick:a.nick, note:a.note || 'New admission', admitted:a.admit});
    });
  }
  function nextCode(siteId){
    const pre = {maple:'M', birch:'B', cedar:'C'}[siteId] || 'R';
    const used = new Set([...(D.RESIDENTS[siteId]||[]).map(r => r.code), ...st().list.filter(a => a.site===siteId).map(a => a.code)]);
    let n = 1; while (used.has(pre+'-'+n)) n++; return pre+'-'+n;
  }

  // ---------- sections of the resident profile ----------
  const SECS = [
    ['demo','About the person','🪪'], ['dx','Diagnoses','🩺'], ['meds','Medications','💊'], ['allergy','Allergies','⚠️'],
    ['diet','Diet, texture and liquids','🍽️'], ['mobility','Mobility and fall risk','🦯'], ['behavior','Behaviors, triggers and what helps','🤝'],
    ['directives','Advance directives and code status','📄'], ['decision','Guardian, POA and who decides','👪'],
    ['team','Care team by specialty','🏥'], ['appts','Appointments','📅'], ['monitor','Checks and daily care','✅']
  ];
  const STRICT = ['meds','allergy','directives','decision'];
  const CONFLICTABLE = ['demo','meds','allergy','diet','mobility','directives','decision']; // never bulk-confirmed: each one is looked at on purpose
  const SPEC = {dc:'hospital', face:'primary', mco:'primary', psych:'psych', dental:'dental', swallow:'therapy', polst:'primary'};

  // ---------- parsers for structured files (these run for real on uploads too) ----------
  function parseFHIR(text, doc){
    const out = []; let b; try { b = JSON.parse(text); } catch(e){ return null; }
    const entries = b.resourceType === 'Bundle' ? (b.entry||[]).map(e => e.resource).filter(Boolean) : [b];
    doc.pages = entries.map((r,i) => 'Entry '+(i+1)+' ('+r.resourceType+')\n'+JSON.stringify(r, null, 1));
    const cc = c => c ? (c.text || (c.coding && c.coding[0] && c.coding[0].display) || '') : '';
    entries.forEach((r, i) => {
      const add = (sec, key, label, value) => value && out.push({doc:doc.id, page:i, sec, key, label, value, quote:String(value).split(' ').slice(0,4).join(' ')});
      switch (r.resourceType){
        case 'Patient': add('demo','demo:name','Name', (r.name && r.name[0] && (r.name[0].text || [].concat(r.name[0].given||[]).join(' ')+' '+(r.name[0].family||''))).trim()); add('demo','demo:dob','Date of birth', r.birthDate); break;
        case 'Condition': { const v = cc(r.code); add('dx','dx:'+norm(v),'Diagnosis', v); break; }
        case 'MedicationRequest': case 'MedicationStatement': {
          const m = cc(r.medicationCodeableConcept) || (r.medicationReference && r.medicationReference.display) || '';
          const dose = r.dosageInstruction ? (r.dosageInstruction[0]||{}).text : r.dosage ? (r.dosage[0]||{}).text : '';
          if (r.status && /stopped|cancelled|completed|entered-in-error/.test(r.status)) add('meds','med:'+norm(m).split(' ')[0],'Medication','STOPPED: '+m);
          else add('meds','med:'+norm(m).split(' ')[0],'Medication',(m+' '+(dose||'')).trim()); break; }
        case 'AllergyIntolerance': { const v = cc(r.code); const re = r.reaction && r.reaction[0] && r.reaction[0].manifestation && cc(r.reaction[0].manifestation[0]); add('allergy','allergy:'+norm(v).split(' ')[0],'Allergy', v + (re ? ' ('+re.toLowerCase()+')' : '')); break; }
        case 'NutritionOrder': { const o = r.oralDiet || {}; add('diet','diet:name','Diet', (o.type||[]).map(cc).join(', ')); add('diet','diet:texture','Food texture', (o.texture||[]).map(t => cc(t.modifier)).join(', ')); add('diet','diet:liquids','Liquids', (o.fluidConsistencyType||[]).map(cc).join(', ')); break; }
        case 'CareTeam': (r.participant||[]).forEach(p => { const role = (p.role||[]).map(cc).join(', '); add('team','team:'+norm(role),role||'Care team', p.member && p.member.display); }); break;
        case 'Appointment': { const sv = (r.serviceType||[]).map(cc).join(', '); add('appts','appt:'+(r.start||'').slice(0,10)+':'+norm(sv),'Appointment', (sv ? sv+', ' : '')+(r.start||'').slice(0,10)+(r.description ? ': '+r.description : '')); break; }
        case 'RelatedPerson': add('decision','contact:'+norm(cc((r.relationship||[])[0])),'Contact', ((r.name&&r.name[0]&&r.name[0].text)||'')+' ('+cc((r.relationship||[])[0])+')'); break;
        case 'Consent': add('directives','directive:'+i,'Advance directive or consent', cc(r.category && r.category[0]) || cc(r.scope)); break;
      }
    });
    return out;
  }
  function parseCCDA(text, doc){
    let x; try { x = new DOMParser().parseFromString(text, 'application/xml'); } catch(e){ return null; }
    if (!x || x.getElementsByTagName('parsererror').length) return null;
    const out = [], pages = [];
    const pat = x.getElementsByTagNameNS('*','patient')[0];
    if (pat){
      const nm = [...pat.getElementsByTagNameNS('*','given')].map(g => g.textContent).join(' ')+' '+[...pat.getElementsByTagNameNS('*','family')].map(g => g.textContent).join(' ');
      const bt = pat.getElementsByTagNameNS('*','birthTime')[0]; const b = bt && bt.getAttribute('value');
      pages.push('Patient: '+nm.trim()+(b ? '\nBorn: '+b : ''));
      out.push({doc:doc.id, page:0, sec:'demo', key:'demo:name', label:'Name', value:nm.trim(), quote:'Patient'});
      if (b && b.length >= 8) out.push({doc:doc.id, page:0, sec:'demo', key:'demo:dob', label:'Date of birth', value:b.slice(0,4)+'-'+b.slice(4,6)+'-'+b.slice(6,8), quote:'Born'});
    }
    const MAP = {'11450-4':['dx','Diagnosis','dx'], '10160-0':['meds','Medication','med'], '48765-2':['allergy','Allergy','allergy'], '42348-3':['directives','Advance directive','directive'], '29762-2':['behavior','Social history','social']};
    [...x.getElementsByTagNameNS('*','section')].forEach(sec => {
      const code = sec.getElementsByTagNameNS('*','code')[0]; const m = code && MAP[code.getAttribute('code')]; if (!m) return;
      const title = (sec.getElementsByTagNameNS('*','title')[0]||{}).textContent || m[1];
      const rows = [...sec.getElementsByTagNameNS('*','tr')].map(tr => [...tr.getElementsByTagNameNS('*','td')].map(td => td.textContent.trim())).filter(r => r.length);
      const page = pages.length; pages.push(title+'\n'+rows.map(r => r.join(' | ')).join('\n'));
      rows.forEach(r => {
        let v = r[0];
        if (m[0] === 'meds') v = (r[0]+' '+(r[1]||'')).trim();
        if (m[0] === 'allergy' && r[1]) v = r[0]+' ('+r[1].toLowerCase()+')';
        const key = m[0]==='dx' ? 'dx:'+norm(r[0]) : m[2]+':'+norm(r[0]).split(' ')[0];
        out.push({doc:doc.id, page, sec:m[0], key, label:m[1], value:v, quote:r[0]});
      });
    });
    doc.pages = pages;
    return out;
  }
  // Plain text (or lines typed from a photo or PDF): "Label: value" lines and "- item" lists.
  const LABELS = [
    [/^(name|resident|patient|member)$/,'demo','demo:name','Name'], [/^(dob|date of birth|born)$/,'demo','demo:dob','Date of birth'],
    [/^(diagnos[ie]s|problems?|dx)$/,'dx','dx','Diagnosis'], [/^(med(ication)?s?|discharge medications|current medications)$/,'meds','med','Medication'],
    [/^(allerg(y|ies))$/,'allergy','allergy','Allergy'], [/^(diet)$/,'diet','diet:name','Diet'], [/^(texture|food texture)$/,'diet','diet:texture','Food texture'],
    [/^(liquids?|fluids?)$/,'diet','diet:liquids','Liquids'], [/^(mobility|activity|transfers?)$/,'mobility','mobility','Mobility'], [/^(fall risk)$/,'mobility','fallrisk','Fall risk'],
    [/^(behaviou?rs?|triggers?|what helps|likes|notes?)$/,'behavior','beh','Behavior or preference'], [/^(code status|dnr|polst|advance directive)$/,'directives','code','Code status'],
    [/^(guardian|poa|power of attorney|health care poa|decision maker)$/,'decision','decision','Who makes health decisions'],
    [/^(physician|pcp|doctor|primary care)$/,'team','team:primary','Primary care'], [/^(psychiatr(y|ist)|behavioral health)$/,'team','team:psych','Psychiatry'],
    [/^(dentist|dental)$/,'team','team:dental','Dental'], [/^(pharmacy)$/,'team','team:pharmacy','Pharmacy'], [/^(hospice|home health)$/,'team','team:hh','Hospice or home health'], [/^(care manager|case manager)$/,'team','team:mco','Care manager (MCO)'], [/^(nurse manager|mco nurse|iris nurse)$/,'team','team:mco-rn','Nurse manager (MCO RN)'],
    [/^(appointments?|follow[- ]?up|next visit)$/,'appts','appt','Appointment'], [/^(monitoring|checks?)$/,'monitor','mon','Check']
  ];
  function parseText(text, doc, pageLabel){
    const out = []; const lines = String(text||'').split(/\r?\n/); let cur = null;
    const page = (doc.pages = doc.pages || []).push((pageLabel ? pageLabel+'\n' : '')+text) - 1;
    const push = (L, v, q) => { v = v.trim().replace(/[.;]+$/,''); if (!v) return; let key = L[2];
      if (/^(dx|med|allergy|beh|appt|mon)$/.test(key)) key = key+':'+(key==='dx'||key==='beh'||key==='appt'||key==='mon' ? norm(v) : norm(v).split(' ')[0]);
      if (L[1]==='allergy' && /nkda|no known/i.test(v)) key = 'allergy:none';
      if (L[1]==='meds' && /^stop/i.test(v)) { v = 'STOPPED: '+v.replace(/^stop(ped)?:?\s*/i,''); key = 'med:'+norm(v.replace(/^STOPPED: /,'')).split(' ')[0]; }
      out.push({doc:doc.id, page, sec:L[1], key, label:L[3], value:v, quote:q.trim().slice(0,80)}); };
    lines.forEach(raw => {
      const line = raw.trim(); if (!line) { cur = null; return; }
      const li = line.match(/^[-*•]\s*(.+)$/);
      if (li && cur) { push(cur, li[1], line); return; }
      const m = line.match(/^([A-Za-z][A-Za-z /()-]{1,30}):\s*(.*)$/);
      if (m){ const lab = m[1].toLowerCase().trim(); const L = LABELS.find(x => x[0].test(lab));
        if (L){ cur = L; if (m[2]) (/^(dx|meds|allergy)$/.test(L[1]) ? m[2].split(/;\s*/) : [m[2]]).forEach(v => push(L, v, line)); return; } }
      if (/^stop/i.test(line)) push(LABELS[3], line, line);
    });
    return out;
  }

  // ---------- documents ----------
  function kindOf(name, type){
    const n = name.toLowerCase();
    if (/\.json$/.test(n)) return 'fhir'; if (/\.(xml|cda|ccd)$/.test(n)) return 'ccda';
    if (/\.(txt|md|csv|hl7)$/.test(n)) return 'text'; if (/\.pdf$/.test(n)) return 'pdf';
    if (/\.(docx?|rtf|odt)$/.test(n)) return 'word'; if (/^image\//.test(type||'') || /\.(jpe?g|png|heic|webp|tiff?)$/.test(n)) return 'photo';
    return 'other';
  }
  const KIND = {pdf:['PDF','📄'], scan:['Scanned PDF','🖨️'], photo:['Photo','📷'], word:['Word','📝'], ccda:['C-CDA (structured)','🧬'], fhir:['FHIR (structured)','🧬'], text:['Text','📃'], capture:['In-app photo','📸'], other:['Other file','📎']};
  function loadSample(adm){
    adm.docs = SAMPLE.DOCS.map(d => Object.assign({}, d, {sample:true, pages:d.pages ? d.pages.slice() : null}));
    adm.facts = SAMPLE.FACTS.map(f => Object.assign({id:uid()}, f));
    adm.docs.forEach(d => { if (d.kind === 'fhir') addFacts(adm, parseFHIR(d.text, d)); if (d.kind === 'ccda') addFacts(adm, parseCCDA(d.text, d)); delete d.text; });
    adm.nick = SAMPLE.nick; adm.from = 'Hospital (after a stay), previous AFH, Family Care MCO, guardian';
    log(adm, 'Loaded the sample packet ('+adm.docs.length+' documents)'); save();
  }
  function addFacts(adm, list){ (list||[]).forEach(f => adm.facts.push(Object.assign({id:uid()}, f))); }

  async function addFiles(adm, files, refresh){
    for (const f of files){
      if (f.size > 25*1024*1024){ toast(f.name+' is over 25 MB. Split it and try again.'); continue; }
      const kind = kindOf(f.name, f.type);
      const doc = {id:'u'+uid(), name:f.name, kind, from:'Uploaded', date:today(), types:[], pages:null, added:new Date().toISOString()};
      adm.docs.push(doc);
      if (/^(fhir|ccda|text)$/.test(kind)){
        const text = await f.text();
        const got = kind==='fhir' ? parseFHIR(text, doc) : kind==='ccda' ? parseCCDA(text, doc) : parseText(text, doc);
        if (got === null){ doc.pages = [text.slice(0, 20000)]; doc.note = 'Could not read this as '+KIND[kind][0]+'. Check the file.'; }
        else { addFacts(adm, got); doc.note = got.length+' items found'; }
      } else {
        // Kept in page memory only so the reviewer can look at it. Cleared when they leave intake or the app goes to the background.
        MEM.blobs[doc.id] = [{url:URL.createObjectURL(f), type:f.type}];
        doc.pages = null; doc.note = 'Waiting to be read';
      }
      log(adm, 'Added a file ('+KIND[kind][0]+')');
    }
    save(); refresh();
  }

  // ---------- secure in-app capture ----------
  // The camera runs inside the page. Frames are drawn to a canvas and kept as in-memory blobs.
  // Nothing is written to the camera roll, iCloud or Google Photos, and there is no download or share button.
  function capturePanel(adm, onDone){
    const box = h('div',{class:'card soft ss-cap',role:'region','aria-label':'Take photos of pages'});
    const video = h('video',{autoplay:true, playsinline:true, muted:true, disablepictureinpicture:true, 'aria-label':'Camera preview'});
    const shots = h('div',{class:'ss-thumbs'});
    const status = h('p',{class:'small',role:'status'},'Starting the camera…');
    const doc = {id:'c'+uid(), name:'Pages photographed in the app', kind:'capture', from:'In-app camera', date:today(), types:[], pages:null, added:new Date().toISOString(), count:0};
    let stream = null;
    const stop = () => { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; };
    const snap = () => {
      if (!video.videoWidth) return;
      const c = document.createElement('canvas'); const sc = Math.min(1, 2000 / video.videoWidth);
      c.width = Math.round(video.videoWidth*sc); c.height = Math.round(video.videoHeight*sc);
      c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
      c.toBlob(b => { if (!b) return; addShot(b); }, 'image/jpeg', 0.85);
    };
    const addShot = b => {
      (MEM.blobs[doc.id] = MEM.blobs[doc.id] || []).push({url:URL.createObjectURL(b), type:'image/jpeg'});
      doc.count = MEM.blobs[doc.id].length; log(adm, 'Photographed page '+doc.count+' in the app');
      shots.append(h('img',{src:MEM.blobs[doc.id][doc.count-1].url, alt:'Page '+doc.count, draggable:'false', oncontextmenu:e => e.preventDefault()}));
      status.textContent = doc.count+' page'+(doc.count>1?'s':'')+' taken. Kept in the app only.';
    };
    // Fallback for browsers without camera access: the system camera via a capture input. On phones this hands the picture
    // straight back to the page; we still never save it. (Gallery saving depends on the phone; the native app blocks it.)
    const fallback = h('input',{type:'file', accept:'image/*', capture:'environment', class:'sr', id:'capFallback', onchange:e => { [...e.target.files].forEach(addShot); e.target.value=''; }});
    const finish = () => { stop(); if (doc.count){ adm.docs.push(doc); save(); } onDone(doc.count ? doc : null); };
    box.append(h('h3',null,'📸 Take photos of the pages'),
      h('p',{class:'small'},'Hold the page flat in good light. Photos stay inside Steady Shift, are not saved to this device\'s photos, and are cleared from this device once they are sent to your home\'s secure storage.'),
      video, status,
      h('div',{class:'row'}, h('button',{class:'btn',type:'button',onclick:snap},'Take photo of this page'), h('label',{class:'btn ghost sm',for:'capFallback'},'Use the phone camera instead'), fallback, h('button',{class:'btn quiet sm',type:'button',onclick:finish},'Done')),
      shots);
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
      navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}, width:{ideal:1920}}, audio:false})
        .then(s => { stream = s; video.srcObject = s; status.textContent = 'Camera on. Line up the page and tap "Take photo".'; log(adm, 'Opened the in-app camera'); })
        .catch(() => { video.hidden = true; status.textContent = 'This browser did not allow the camera. Use "Use the phone camera instead", or upload a file.'; });
    } else { video.hidden = true; status.textContent = 'No in-app camera in this browser. Use "Use the phone camera instead".'; }
    box._stop = stop;
    return box;
  }
  // Clear in-memory images when the app goes to the background or the person leaves intake.
  // A short grace period, because opening the phone's file picker or camera also sends the page to the background.
  let bgTimer = 0;
  document.addEventListener('visibilitychange', () => {
    clearTimeout(bgTimer);
    if (document.hidden && Object.keys(MEM.blobs).length) bgTimer = setTimeout(() => {
      forgetAll(); st().list.forEach(a => a.docs.forEach(d => { if (/^(capture|photo|pdf|word|other)$/.test(d.kind) && !d.pages) d.cleared = true; }));
      log(null, 'Cleared photos and files from this device (app was in the background for 2 minutes)');
    }, 120000);
  });
  window.addEventListener('hashchange', () => { if (!/^#\/intake/.test(location.hash) && Object.keys(MEM.blobs).length){ forgetAll(); log(null, 'Cleared photos and files from this device (left admissions)'); } });

  // "Send to secure storage": in production an encrypted upload to the home's private bucket, then server-side reading.
  function sendSecure(adm, doc){
    forget(doc.id); doc.stored = new Date().toISOString(); doc.cleared = true; doc.note = 'Sent to your home\'s secure storage (simulated). Cleared from this device.';
    log(adm, 'Sent '+(KIND[doc.kind]||KIND.other)[0].toLowerCase()+' to secure storage and cleared it from the device'); save();
  }

  // ---------- source viewer ----------
  let dlg;
  function showSource(adm, f){
    const doc = adm.docs.find(d => d.id === f.doc); if (!doc) return;
    log(adm, 'Viewed source: '+doc.name+(f.page!=null ? ', page '+(f.page+1) : ''));
    if (!dlg){ dlg = h('dialog',{class:'ss-dlg','aria-labelledby':'srcTitle'}); document.body.append(dlg); dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); }); }
    dlg.textContent = '';
    const body = h('div',{class:'ss-src'});
    const pageText = doc.pages && doc.pages[f.page||0];
    if (pageText){
      const i = f.quote ? pageText.indexOf(f.quote) : -1;
      body.append(...(i < 0 ? [pageText] : [pageText.slice(0,i), h('mark',{class:'flag'},f.quote), pageText.slice(i+f.quote.length)]));
    } else if (MEM.blobs[doc.id] && /^image\//.test(MEM.blobs[doc.id][0].type)) {
      MEM.blobs[doc.id].forEach((p,i) => body.append(h('img',{src:p.url, alt:'Page '+(i+1), draggable:'false', oncontextmenu:e => e.preventDefault(), style:'max-width:100%;border-radius:12px'})));
    } else body.append(h('p',{class:'muted'}, doc.cleared ? 'The original is in your home\'s secure storage. In this test it was cleared from the device.' : 'Preview for this file type comes with the live version.'));
    dlg.append(h('div',{class:'grid',style:'gap:.6rem'},
      h('div',{class:'row',style:'justify-content:space-between'}, h('h2',{id:'srcTitle'},'Source'), h('button',{class:'btn quiet sm',type:'button',onclick:() => dlg.close()},'Close')),
      h('div',{class:'meta small muted'}, (KIND[doc.kind]||KIND.other)[1]+' '+doc.name+' · '+doc.from+(doc.date ? ' · '+fmt(doc.date) : '')+(f.page!=null && doc.pages && doc.pages.length>1 ? ' · page '+(f.page+1)+' of '+doc.pages.length : '')),
      doc.sensitive ? h('p',{class:'chip amber'},'🔒 '+doc.sensitive+'. RN and manager only.') : null,
      f.quote && pageText ? h('p',{class:'small'},'Highlighted: the words this field came from.') : null,
      body));
    dlg.showModal();
  }
  function srcChip(adm, f){
    const doc = adm.docs.find(d => d.id === f.doc) || {name:'?', kind:'other'};
    const short = doc.name.replace(/\.(pdf|jpg|json|xml|docx?)$/i,'').replace(/ \((photo|scan|FHIR|C-CDA)\)/,'');
    return h('button',{class:'chip grey ss-srcchip',type:'button',title:'Open the source',onclick:() => showSource(adm, f)}, (KIND[doc.kind]||KIND.other)[1]+' '+short+(doc.pages && doc.pages.length>1 && f.page!=null ? ' p.'+(f.page+1) : ''));
  }

  // ---------- grouping and conflicts ----------
  function groups(adm){
    const by = {};
    adm.facts.forEach(f => { (by[f.key] = by[f.key] || {key:f.key, sec:f.sec, label:f.label, facts:[]}).facts.push(f); });
    const out = Object.values(by);
    out.forEach(g => {
      const vals = {}; g.facts.forEach(f => (vals[norm(f.value)] = vals[norm(f.value)] || []).push(f));
      g.options = Object.values(vals).map(fs => ({value:fs[0].value, facts:fs, newest:fs.map(f => (adm.docs.find(d => d.id===f.doc)||{}).date||'').sort().pop()}));
      // Only safety-relevant sections can conflict. Elsewhere (appointments, care team, behaviors) keep the fullest wording, with every source.
      if (!CONFLICTABLE.includes(g.sec) && g.options.length > 1){ const best = g.options.slice().sort((a,b) => b.value.length - a.value.length)[0]; g.options = [{value:best.value, facts:g.facts, newest:best.newest}]; }
      g.conflict = g.options.length > 1;
    });
    // "No known allergies" on one paper and a listed allergy on another is a conflict, even though the keys differ.
    const none = out.find(g => g.key === 'allergy:none'), any = out.filter(g => g.sec === 'allergy' && g.key !== 'allergy:none');
    if (none && any.length){ none.conflict = true; none.allergyClash = any.map(g => g.options[0].value); }
    return out;
  }
  const decOf = (adm, key) => adm.dec[key] || null;
  function finalValue(adm, g){ const d = decOf(adm, g.key); if (!d || d.s === 'removed' || d.s === 'hold') return null; return d.val != null ? d.val : g.options[0].value; }
  function decide(adm, key, s, val, note){ adm.dec[key] = {s, val, note, by:tierName()+' (you)', at:new Date().toISOString()}; log(adm, (s==='hold'?'Held for the prescriber: ':s==='removed'?'Removed: ':'Confirmed: ')+key.split(':')[0]); save(); }
  function counts(adm){
    const gs = groups(adm); const c = {total:gs.length, done:0, conflicts:0, open:0, strictOpen:0};
    gs.forEach(g => { const d = decOf(adm, g.key); if (d) c.done++; else { c.open++; if (g.conflict) c.conflicts++; if (STRICT.includes(g.sec)) c.strictOpen++; } });
    return c;
  }

  // ---------- admission checklist (DHS 88 for AFHs, DHS 83 for CBRFs) ----------
  // when: 'before' | 'at' | number of days after admission. have: document types that satisfy it. home: done by the home itself.
  const CHECK = {
    afh:[
      {id:'pre-info', t:'Before admission, give the person and guardian in writing: how to file a complaint, what it costs and who pays, and roles and expectations (including the program statement)', when:'before', cite:'DHS 88.06(1)(a)', home:true},
      {id:'pre-visit', t:'Offer a visit to meet the residents (and an overnight if possible), talk about religious and cultural beliefs, and confirm your program statement covers their needs', when:'before', cite:'DHS 88.06(1)(c)-(e)', home:true},
      {id:'exam', t:'Physician health exam, plus communicable disease screening including TB (by a physician, RN or PA)', when:'90 days before to 7 days after', due:7, cite:'DHS 88.06(2)(a)', have:['physician','tb'], tb:true},
      {id:'agreement', t:'Service agreement signed and dated by you and the resident, guardian or representative, with copies to everyone and the placing agency (MCO)', when:'before', cite:'DHS 88.06(2)(b)-(c)', home:true},
      {id:'rights', t:'Rights and grievance procedure explained, with copies given (the service agreement must say so)', when:'at', cite:'DHS 88.06(2)(c)8; 88.10', home:true},
      {id:'orders', t:'Written orders from the prescriber for every medication before staff give it', when:'at', cite:'DHS 88.07(3)(d)', have:['orders'], meds:true},
      {id:'psychotropic', t:'Written informed consent before a psychotropic medicine for a resident with dementia', when:'at', cite:'Wis. Stat. 50.08 (which settings it covers is being checked)', verify:true, ifPsych:true, home:true},
      {id:'evac', t:'Evacuation evaluation on the department form', when:'at', cite:'DHS 88.05(4) (subsection being checked)', verify:true, home:true},
      {id:'record', t:'Record set up: name and birth date; guardian contact; emergency contacts including the physician; placing agency, care manager and nurse manager (with phone, fax and email); Medicaid or Medicare number and pharmacy', when:'at', cite:'DHS 88.09(1)(d)', verify:true, have:['facesheet','guardian','contacts']},
      {id:'guardian', t:'Copy of guardianship letters or activated health care POA, and who decides what', when:'at', cite:'DHS 88.09(1)(d); Wis. Stat. ch. 54 and 155', have:['guardian']},
      {id:'mco', t:'Family Care member-centered plan and any approved rights restrictions (HCBS settings rule, form P-03794)', when:'at', cite:'Family Care contract; 42 CFR 441.301(c)(4)', have:['mcoplan']},
      {id:'isp', t:'Written assessment and individual service plan (ADLs, meds, health, supervision, social, transport), developed with the resident, guardian and placing agency, signed and dated by all', when:30, cite:'DHS 88.06(3)(a)-(e)', home:true},
      {id:'delegation', t:'RN delegation and competency check for any nursing task (insulin, blood sugar checks and so on) before caregivers do it', when:'at', cite:'Wis. Admin. Code N 6.03(3)', home:true},
      {id:'brief', t:'Brief every shift on the new resident before their first shift together (house practice)', when:'at', cite:'House practice', house:true, home:true}
    ],
    cbrf:[
      {id:'program', t:'Give the program statement to the person or representative before the admission agreement is final', when:'before', cite:'DHS 83.06(2)(a)', home:true},
      {id:'fit', t:'Confirm the person fits your license class and program statement, and won\'t need more than 3 hours of nursing care a week', when:'before', cite:'DHS 83.27', home:true},
      {id:'assess', t:'Pre-admission assessment: face-to-face interview with the person and representative, written report in the record (emergency admission: within 5 days)', when:'before', cite:'DHS 83.35(1)', home:true},
      {id:'charges', t:'Written information on services and charges, including extra charges, fees and deposit', when:'at', cite:'DHS 83.29(1)', verify:true, home:true},
      {id:'agreement', t:'Admission agreement in writing, explained out loud, signed and dated (rates, notice of changes, discharge, refunds, deposit no more than one month)', when:'at', cite:'DHS 83.29(2)', verify:true, home:true},
      {id:'rights', t:'Rights, house rules and grievance procedure given and explained, with ombudsman and Disability Rights Wisconsin contacts; resident signs', when:'at', cite:'DHS 83.28(6); 83.32; 83.33', verify:true, home:true},
      {id:'directive', t:'Ask about advance directives (never a condition of admission)', when:'at', cite:'DHS 83.28(7)', verify:true, have:['directive']},
      {id:'tsp', t:'Temporary service plan in place on admission day', when:'at', cite:'DHS 83.35(2)', home:true},
      {id:'tb', t:'Communicable disease screening including TB (physician, PA, nurse practitioner or RN), documented in the record', when:'90 days before to 7 days after', due:7, cite:'DHS 83.28(4)(a)', verify:true, have:['tb'], tb:true},
      {id:'orders', t:'Prescriber orders for every medication staff will give', when:'at', cite:'DHS 83.37', verify:true, have:['orders'], meds:true},
      {id:'psychotropic', t:'Written informed consent before a psychotropic medicine for a resident with dementia', when:'at', cite:'Wis. Stat. 50.08; DHS 83.37', verify:true, ifPsych:true, home:true},
      {id:'evac', t:'Evacuation evaluation on the department form; tell staff if it takes over 2 minutes', when:3, cite:'DHS 83.35(5)(a), (c)', home:true},
      {id:'medreview', t:'Pharmacist or physician review of the medication regimen (if staff give meds)', when:30, cite:'DHS 83.37(1)(e)', verify:true, home:true},
      {id:'mco', t:'Family Care member-centered plan and any approved rights restrictions (HCBS settings rule, form P-03794)', when:'at', cite:'Family Care contract; 42 CFR 441.301(c)(4)', have:['mcoplan']},
      {id:'guardian', t:'Copy of guardianship letters or activated health care POA, and who decides what', when:'at', cite:'DHS 83.42; Wis. Stat. ch. 54 and 155', verify:true, have:['guardian']},
      {id:'isp', t:'Individual service plan with measurable goals, signed by the resident or representative; invite the care manager and health providers', when:30, cite:'DHS 83.35(3)', home:true},
      {id:'brief', t:'Brief every shift on the new resident before their first shift together (house practice)', when:'at', cite:'House practice', house:true, home:true}
    ]
  };
  function checkItems(adm){
    const setting = (D.SITES.find(s => s.id === adm.site)||{}).setting;
    const list = CHECK[setting] || CHECK.afh;
    const hasPsych = adm.facts.some(f => /sertraline|quetiapine|risperidone|olanzapine|lorazepam|haloperidol|citalopram|trazodone/i.test(f.value) && f.sec==='meds' && !/^STOPPED/.test(f.value));
    return list.filter(it => !it.ifPsych || hasPsych).map(it => {
      const m = adm.check[it.id];
      const docs = it.have ? adm.docs.filter(d => (d.types||[]).some(t => it.have.includes(t))) : [];
      let state = m && m.done ? 'done' : docs.length ? 'received' : 'missing';
      if (it.tb && !(m && m.done) && !adm.docs.some(d => (d.types||[]).includes('tb'))) state = 'missing';
      const due = it.when === 'before' ? adm.admit : it.when === 'at' ? adm.admit : typeof it.when === 'number' ? addDays(adm.admit, it.when) : it.due ? addDays(adm.admit, it.due) : adm.admit;
      return Object.assign({}, it, {state, docs, due, mark:m});
    });
  }

  // ---------- views ----------
  const TABS = [['files','1. Files'],['review','2. Review'],['checklist','3. Admission checklist'],['confirm','4. Confirm and set up']];
  function view(v){
    const s = st(); syncResidents();
    const m = (location.hash||'').match(/^#\/intake(?:\/([^/]+))?(?:\/([a-z]+))?/);
    const id = m && m[1], tab = (m && m[2]) || 'files';
    if (id === 'policy') return policyView(v);
    if (id === 'new'){ const a = {id:uid(), site:S().site, code:nextCode(S().site), nick:'New resident', admit:today(), status:'draft', docs:[], facts:[], dec:{}, check:{}, created:new Date().toISOString()}; s.list.push(a); log(a, 'Started an admission from face sheets'); save(); location.replace('#/intake/'+a.id+'/files'); return; }
    const adm = id && s.list.find(a => a.id === id);
    if (!adm) return listView(v);
    if (!adm.dec) adm.dec = {}; if (!adm.check) adm.check = {};
    v.append(h('a',{href:'#/intake'},'← All admissions'));
    v.append(A.head('New resident · '+(D.SITES.find(x=>x.id===adm.site)||{}).name, adm.nick+' ('+adm.code+')'+(adm.status==='live'?' · admitted':''), 'Coming from: '+(adm.from || 'not set yet')+'. Admission date '+fmt(adm.admit)+'.'));
    if (adm.status === 'live') return liveView(v, adm);
    const c = counts(adm);
    v.append(h('nav',{class:'chips','aria-label':'Admission steps'}, TABS.map(([k,t]) => h('a',{class:'chip'+(k===tab?'':' grey'),style:'min-height:44px;padding:.5em 1em',href:'#/intake/'+adm.id+'/'+k,'aria-current':k===tab?'page':null}, t + (k==='review' && c.open ? ' ('+c.open+' to check)' : '')))));
    ({files:filesTab, review:reviewTab, checklist:checklistTab, confirm:confirmTab}[tab] || filesTab)(v, adm);
    v.append(logCard(adm));
  }

  function listView(v){
    const s = st();
    v.append(A.head('Admissions', 'Admit a new resident', 'Drop in everything you were given, from any hospital, old home, care manager or family. We sort it into one profile, show where every detail came from, and flag what doesn\'t match. A nurse or manager checks it before anything goes live.'));
    if (!['manager','rn','owner','multi'].includes(S().tier)) v.append(h('div',{class:'card warn'}, h('p',null,'Caregivers see a new resident\'s handoff and meal needs once a nurse or manager confirms the admission. Switch "View as" to House manager or RN to try the full intake.')));
    const mine = s.list.filter(a => a.site === S().site);
    const start = sample => { const a = {id:uid(), site:S().site, code:nextCode(S().site), nick:'New resident', admit:today(), status:'draft', docs:[], facts:[], dec:{}, check:{}, created:new Date().toISOString()};
      s.list.push(a); if (sample) loadSample(a); else log(a, 'Started an admission'); save(); location.hash = '#/intake/'+a.id+'/'+(sample?'review':'files'); };
    v.append(h('div',{class:'grid g2'},
      h('button',{class:'tile',type:'button',onclick:() => start(true),style:'text-align:left;cursor:pointer'}, h('span',{class:'ic','aria-hidden':'true'},'🧪'), h('b',null,'Try the sample packet'), h('span',null,'10 made-up documents for "Dot": hospital discharge, old home MAR, MCO plan, guardian letters, POLST, psychiatry, dental, swallow study, C-CDA and FHIR files.')),
      h('button',{class:'tile',type:'button',onclick:() => start(false),style:'text-align:left;cursor:pointer'}, h('span',{class:'ic','aria-hidden':'true'},'➕'), h('b',null,'Start a new admission'), h('span',null,'Upload files or photograph pages in the app. Test version: sample or made-up papers only.'))));
    v.append(h('div',{class:'card'}, h('h2',null,'Admissions at this home'),
      mine.length ? h('div',{class:'list'}, mine.slice().reverse().map(a => { const c = counts(a); const ck = checkItems(a); const miss = ck.filter(x => x.state==='missing').length;
        return h('a',{class:'item',href:'#/intake/'+a.id,style:'text-decoration:none;color:inherit'}, h('div',{class:'meta'}, h('span',{class:'chip'},a.code), a.status==='live' ? h('span',{class:'chip calm'},'Admitted') : h('span',{class:'chip amber'},'In review'), h('span',null,a.docs.length+' files'), a.status!=='live' && c.conflicts ? h('span',{class:'chip red'},c.conflicts+' don\'t match') : null, miss ? h('span',{class:'chip grey'},miss+' checklist items missing') : null), h('b',null,a.nick+' · admit '+fmt(a.admit))); })) : h('p',{class:'muted'},'None yet.')));
    v.append(h('div',{class:'card soft'}, h('h3',null,'Photos of medical papers'), h('p',{class:'small'},'Please don\'t photograph resident papers with your phone\'s camera app. Use "Take photos" inside Steady Shift, ideally on the home\'s tablet. Photos stay in the app, never go to your camera roll or cloud photos, and are cleared once sent.'), h('a',{href:'#/intake/policy'},'Phone and tablet rules for staff')));
  }

  function filesTab(v, adm){
    const s = st();
    const refresh = () => A.route();
    const basics = h('div',{class:'grid g3'},
      h('label',{class:'f'},'Name the team will use', h('input',{type:'text',value:adm.nick,maxlength:'40',onchange:e => { adm.nick = e.target.value.trim()||'New resident'; save(); }})),
      h('label',{class:'f'},'Admission date', h('input',{type:'text',inputmode:'numeric',value:adm.admit,pattern:'\\d{4}-\\d{2}-\\d{2}','aria-describedby':'admHint',onchange:e => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)){ adm.admit = e.target.value; save(); } }})),
      h('label',{class:'f'},'Coming from', h('input',{type:'text',value:adm.from||'',placeholder:'Hospital, another home, home with family…',onchange:e => { adm.from = e.target.value.trim(); save(); }})));
    v.append(h('div',{class:'card'}, h('h2',null,'The basics'), basics, h('p',{id:'admHint',class:'small muted'},'Dates as year-month-day, like '+today()+'. Resident code '+adm.code+' is used in records instead of a full name.')));

    const ok = s.okSample;
    const input = h('input',{type:'file',multiple:true,id:'intakeFiles',class:'sr',onchange:e => { addFiles(adm, [...e.target.files], refresh); e.target.value=''; }});
    const zone = h('div',{class:'ss-drop'+(ok?'':' off'),tabindex:ok?'0':'-1'},
      h('span',{class:'ic','aria-hidden':'true',style:'font-size:2rem'},'📥'),
      h('b',null,'Drop all the files here'),
      h('span',{class:'small muted'},'PDFs, scans, photos, Word files, C-CDA (.xml) and FHIR (.json) exports. As many as you have, in any order.'),
      h('div',{class:'row',style:'justify-content:center'}, h('label',{class:'btn',for:'intakeFiles','aria-disabled':ok?null:'true',style:ok?'':'pointer-events:none;opacity:.5'},'Choose files'), h('button',{class:'btn ghost',type:'button',disabled:!ok,onclick:e => { const p = capturePanel(adm, doc => { p.replaceWith(); refresh(); if (doc) toast(doc.count+' pages added'); }); e.target.closest('.card').after(p); }},'📸 Take photos of pages')), input);
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('on'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('on'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('on'); if (st().okSample) addFiles(adm, [...e.dataTransfer.files], refresh); });
    v.append(h('div',{class:'card'}, h('h2',null,'Add files'),
      ok ? null : h('div',{class:'card warn',style:'gap:.5rem'}, h('b',null,'Test version: sample or made-up papers only'), h('span',{class:'small'},'Real resident records can only go in after the HIPAA setup and signed agreements are in place. Files stay in this page\'s memory and are not sent anywhere.'),
        h('div',null, h('button',{class:'btn sm',type:'button',onclick:() => { s.okSample = true; save(); refresh(); }},'I\'m only using sample or made-up papers'))),
      zone,
      adm.docs.length ? null : h('button',{class:'btn quiet sm',type:'button',onclick:() => { loadSample(adm); location.hash = '#/intake/'+adm.id+'/review'; }},'Or load the sample packet')));

    if (adm.docs.length){
      v.append(h('div',{class:'card'}, h('h2',null,'Files in this admission ('+adm.docs.length+')'),
        h('div',{class:'list'}, adm.docs.map(d => {
          const n = adm.facts.filter(f => f.doc === d.id).length;
          const live = MEM.blobs[d.id];
          const needsTyping = !d.pages && !n;
          const row = h('div',{class:'item'},
            h('div',{class:'meta'}, h('span',{class:'chip grey'},(KIND[d.kind]||KIND.other)[1]+' '+(KIND[d.kind]||KIND.other)[0]), h('span',null,d.from), d.date ? h('span',null,fmt(d.date)) : null, d.sensitive ? h('span',{class:'chip amber'},'🔒 '+d.sensitive) : null, d.sample ? h('span',{class:'chip grey'},'Sample') : null),
            h('b',null,d.kind==='capture' ? d.name+' ('+(d.count||0)+' pages)' : d.name),
            h('span',{class:'small'}, n ? n+' details found' + (d.sample && !/ccda|fhir/.test(d.kind) ? ' (sample of what text recognition and AI would find)' : /ccda|fhir/.test(d.kind) ? ' (read from the structured file)' : '') : (d.note || '')));
          const acts = h('div',{class:'row'});
          if (d.pages || live) acts.append(h('button',{class:'btn ghost sm',type:'button',onclick:() => showSource(adm, {doc:d.id, page:0})},'Look at it'));
          if (live) acts.append(h('button',{class:'btn ghost sm',type:'button',onclick:() => { sendSecure(adm, d); refresh(); }},'Send to secure storage'));
          if (needsTyping){
            const ta = h('textarea',{'aria-label':'Key lines from '+d.name,placeholder:'In the live version this file is read for you on the server. For this test, type a few lines, like:\nMedications:\n- Metoprolol 25 mg twice daily\nAllergies: Penicillin\nCode status: DNR'});
            acts.append(h('details',{style:'width:100%'}, h('summary',{class:'small'},'Type the key lines (test only)'), ta, h('button',{class:'btn sm',type:'button',onclick:() => { const got = parseText(ta.value, d, 'Typed from '+d.name); addFacts(adm, got); d.note = got.length+' details from typed lines'; log(adm, 'Typed lines from a '+(KIND[d.kind]||KIND.other)[0].toLowerCase()); save(); refresh(); }},'Read these lines')));
          }
          const tsel = h('select',{'aria-label':'What this file counts as',onchange:e => { d.types = e.target.value ? [e.target.value] : []; save(); }}, h('option',{value:''},'Counts as… (for the checklist)'), [['discharge','Hospital discharge'],['orders','Medication or treatment orders'],['physician','Physician exam or statement'],['tb','TB screening result'],['facesheet','Face sheet'],['mar','Medication record (MAR)'],['mcoplan','MCO member-centered plan'],['guardian','Guardianship or POA papers'],['directive','Advance directive or POLST'],['psych','Psychiatry or counseling'],['dental','Dental'],['therapy','Therapy'],['contacts','Contacts']].map(([k,t]) => h('option',{value:k,selected:(d.types||[]).includes(k)},t)));
          if (!d.sample) acts.append(tsel);
          acts.append(h('button',{class:'btn quiet sm',type:'button',onclick:() => { forget(d.id); adm.docs = adm.docs.filter(x => x !== d); adm.facts = adm.facts.filter(f => f.doc !== d.id); log(adm, 'Removed a file'); save(); refresh(); }},'Remove'));
          row.append(acts); return row;
        })),
        h('a',{class:'btn',href:'#/intake/'+adm.id+'/review'},'Next: review what we found')));
    }
  }

  function reviewTab(v, adm){
    const gs = groups(adm); const c = counts(adm); const refresh = () => A.route();
    v.append(h('div',{class:'grid g3'},
      h('div',{class:'card'}, h('div',{class:'stat'}, h('b',null,String(c.total)), h('span',null,'details found in '+adm.docs.length+' files'))),
      h('div',{class:'card'}, h('div',{class:'stat '+(c.conflicts?'warnc':'good')}, h('b',null,String(c.conflicts)), h('span',null,'places the papers don\'t agree'))),
      h('div',{class:'card'}, h('div',{class:'stat good'}, h('b',null,String(c.done)), h('span',null,'checked so far')))));
    if (!gs.length){ v.append(h('div',{class:'card'}, h('p',null,'Nothing to review yet. Add files first.'), h('a',{href:'#/intake/'+adm.id+'/files'},'Add files'))); return; }
    v.append(h('div',{class:'card soft',style:'gap:.4rem'}, h('p',null,'Tap any grey source chip to see the exact page and words it came from. Medications, allergies, code status and who decides are checked one by one on purpose.'),
      h('div',{class:'row'}, h('button',{class:'btn ghost sm',type:'button',onclick:() => { gs.filter(g => !g.conflict && !STRICT.includes(g.sec) && !decOf(adm,g.key)).forEach(g => decide(adm, g.key, 'ok')); refresh(); }},'Confirm the rest that match (not meds, allergies, code status or who decides)'))));
    const conf = gs.filter(g => g.conflict && !decOf(adm, g.key));
    if (conf.length) v.append(h('div',{class:'card warn'}, h('h2',null,'⚠️ The papers don\'t agree ('+conf.length+')'), h('p',{class:'small'},'Newest is marked, but newest isn\'t always right. For medicines, check with the prescriber or pharmacy before the first dose. Don\'t guess.'), h('div',{class:'list'}, conf.map(g => conflictCard(adm, g, refresh)))));
    SECS.forEach(([sec, title, ic]) => {
      const rows = gs.filter(g => g.sec === sec && !(g.conflict && !decOf(adm, g.key)));
      if (!rows.length) return;
      v.append(h('div',{class:'card'}, h('h2',null,h('span',{'aria-hidden':'true'},ic+' '),title), sec==='decision' ? h('p',{class:'small muted'},'Get a copy of the court order or activated POA. If both exist, ask your care manager or lawyer who decides what. Don\'t decide this yourself.') : null,
        h('div',{class:'list'}, rows.map(g => rowCard(adm, g, refresh)))));
    });
    v.append(h('a',{class:'btn',href:'#/intake/'+adm.id+'/checklist'},'Next: admission checklist'));
  }
  function conflictCard(adm, g, refresh){
    const isMed = g.sec === 'meds';
    const newest = g.options.map(o => o.newest).sort().pop();
    const box = h('div',{class:'item',style:'border-color:#E9C995'}, h('div',{class:'meta'}, h('span',{class:'chip amber'},(SECS.find(s => s[0]===g.sec)||[,''])[1]), h('b',{style:'color:var(--ink)'},g.label + (isMed ? ': '+g.key.split(':')[1] : ''))));
    if (g.allergyClash){
      box.append(h('p',null,'One paper says no known allergies, but another lists: '+g.allergyClash.join(', ')+'.'), h('div',{class:'row'}, g.facts.map(f => srcChip(adm, f))),
        h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:() => { decide(adm, g.key, 'removed', null, 'Listed allergy kept for safety'); refresh(); }},'Keep the listed allergy (safer)'), h('button',{class:'btn quiet sm',type:'button',onclick:() => { decide(adm, g.key, 'hold', null, 'Ask the prescriber and family'); refresh(); }},'Ask the prescriber and family')));
      return box;
    }
    g.options.forEach(o => box.append(h('div',{class:'ss-opt'}, h('div',null, h('b',null,o.value), o.newest===newest ? h('span',{class:'chip calm',style:'margin-left:.4rem'},'Newest') : null), h('div',{class:'row'}, o.facts.map(f => srcChip(adm, f))),
      h('button',{class:'btn ghost sm',type:'button',onclick:() => { decide(adm, g.key, 'chose', o.value, isMed ? 'Confirmed with prescriber or pharmacy' : ''); refresh(); }}, isMed ? 'Prescriber or pharmacy confirmed this one' : 'Use this one'))));
    box.append(h('button',{class:'btn quiet sm',type:'button',onclick:() => { decide(adm, g.key, 'hold', null, isMed ? 'Call the prescriber or pharmacy today' : 'Ask the source'); refresh(); }}, isMed ? 'Hold: call the prescriber or pharmacy first' : 'Hold: ask first'));
    return box;
  }
  function rowCard(adm, g, refresh){
    const d = decOf(adm, g.key);
    const sens = g.facts.some(f => (adm.docs.find(x => x.id===f.doc)||{}).sensitive);
    const agree = g.facts.length > 1 ? h('span',{class:'chip calm'},g.facts.length+' sources agree') : null;
    const val = d && d.val != null ? d.val : g.options[0].value;
    const row = h('div',{class:'item'+(d && d.s==='removed' ? ' ss-removed' : '')}, h('div',{class:'meta'}, h('span',null,g.label), agree, sens ? h('span',{class:'chip amber'},'🔒 Restricted') : null,
      d ? h('span',{class:'chip '+(d.s==='hold'?'amber':d.s==='removed'?'grey':'calm')}, d.s==='hold' ? 'On hold: '+(d.note||'ask first') : d.s==='removed' ? 'Removed' : d.s==='edited' ? 'Corrected' : 'Checked') : null),
      h('b',null,val), h('div',{class:'row'}, g.facts.map(f => srcChip(adm, f))));
    if (!d || d.s === 'hold'){
      const acts = h('div',{class:'row'},
        h('button',{class:'btn sm',type:'button',onclick:() => { decide(adm, g.key, 'ok'); refresh(); }},'Looks right'),
        h('button',{class:'btn ghost sm',type:'button',onclick:() => { const inp = h('input',{type:'text',value:val,'aria-label':'Corrected '+g.label}); acts.replaceWith(h('div',{class:'row'}, inp, h('button',{class:'btn sm',type:'button',onclick:() => { decide(adm, g.key, 'edited', inp.value.trim()); refresh(); }},'Save'))); inp.focus(); }},'Correct it'),
        h('button',{class:'btn quiet sm',type:'button',onclick:() => { decide(adm, g.key, 'removed'); refresh(); }},'Not right, remove'));
      row.append(acts);
    } else row.append(h('button',{class:'linkbtn small',type:'button',style:'justify-self:start',onclick:() => { delete adm.dec[g.key]; save(); refresh(); }},'Undo'));
    return row;
  }

  function checklistTab(v, adm){
    const items = checkItems(adm); const setting = (D.SITES.find(s => s.id===adm.site)||{}).setting; const refresh = () => A.route();
    const miss = items.filter(i => i.state === 'missing');
    v.append(h('div',{class:'card soft'}, h('h2',null,(setting==='cbrf'?'CBRF (DHS 83)':'Adult family home (DHS 88)')+' admission checklist'),
      h('p',{class:'small'}, items.filter(i => i.state!=='missing').length+' of '+items.length+' in hand. Dates count from the admission date, '+fmt(adm.admit)+'. Items marked "being checked" are still being confirmed against the code text. Not legal advice.')));
    const card = (it) => {
      const late = it.state==='missing' && it.due < today();
      return h('div',{class:'item'}, h('div',{class:'meta'},
        h('span',{class:'chip '+(it.state==='done'?'calm':it.state==='received'?'':late?'red':'amber')}, it.state==='done'?'Done':it.state==='received'?'Received':late?'Overdue':'Missing'),
        h('span',null, it.when==='before' ? 'Before admission' : it.when==='at' ? 'At admission' : typeof it.when==='number' ? 'Within '+it.when+' days (by '+fmt(it.due)+')' : it.when),
        h('span',null,it.cite), it.verify ? h('span',{class:'chip grey'},'Being checked') : null, it.house ? h('span',{class:'chip grey'},'House practice') : null),
        h('b',null,it.t),
        it.docs.length ? h('div',{class:'row'}, it.docs.map(d => h('button',{class:'chip grey',type:'button',onclick:() => showSource(adm, {doc:d.id, page:0})},(KIND[d.kind]||KIND.other)[1]+' '+d.name))) : null,
        it.meds ? medsNote(adm) : null,
        it.tb && it.state==='missing' && it.docs.length ? h('span',{class:'small'},'The papers have exam notes, but no TB screening result was found. Ask the hospital or clinic for it.') : null,
        it.mark && it.mark.done ? h('span',{class:'small muted'},'Marked done by '+it.mark.by+' on '+fmt(it.mark.at)) : null,
        h('div',{class:'row'}, it.mark && it.mark.done ? h('button',{class:'linkbtn small',type:'button',onclick:() => { delete adm.check[it.id]; save(); refresh(); }},'Undo') : h('button',{class:'btn ghost sm',type:'button',onclick:() => { adm.check[it.id] = {done:true, by:tierName()+' (you)', at:new Date().toISOString()}; log(adm, 'Checklist: '+it.id+' done'); save(); refresh(); }}, it.home ? 'We did this' : 'We have it')));
    };
    v.append(h('div',{class:'list'}, items.map(card)));
    if (miss.length){
      const need = miss.filter(i => i.have).map(i => '- '+i.t.replace(/\s*\(.*?\)/g,''));
      const text = 'Hello,\n\nWe are admitting a resident (our code '+adm.code+') who was in your care. To finish the admission safely, please send:\n'+(need.length ? need.join('\n') : '- A current medication list and orders')+'\n\nPlease send by secure fax or Direct secure message, not regular email. Thank you.\n\n'+site().name;
      v.append(h('div',{class:'card'}, h('h3',null,'Ask for what\'s missing'), h('p',{class:'small muted'},'A ready-to-send request. It uses the resident code only. Send it by your home\'s secure fax or Direct address.'), h('div',{class:'out'},text), h('div',{class:'row'}, h('button',{class:'btn ghost sm',type:'button',onclick:e => { try { navigator.clipboard.writeText(text).then(() => toast('Copied')); } catch(x){ toast('Select the text and copy it'); } }},'Copy request'))));
    }
    v.append(h('a',{class:'btn',href:'#/intake/'+adm.id+'/confirm'},'Next: confirm and set up'));
  }
  function medsNote(adm){
    const gs = groups(adm).filter(g => g.sec==='meds');
    const held = gs.filter(g => (decOf(adm,g.key)||{}).s==='hold').length, open = gs.filter(g => !decOf(adm,g.key)).length;
    return h('span',{class:'small'+(held||open?'':' muted')}, gs.length+' medications found. '+(open ? open+' not checked yet. ' : '')+(held ? held+' on hold until the prescriber or pharmacy answers.' : ''));
  }

  function confirmTab(v, adm){
    const c = counts(adm); const tier = S().tier; const canSign = tier === 'rn' || tier === 'manager';
    const items = checkItems(adm); const miss = items.filter(i => i.state==='missing');
    const blockers = [];
    if (c.conflicts) blockers.push(c.conflicts+' places where the papers don\'t agree');
    if (c.strictOpen) blockers.push(c.strictOpen+' medications, allergies, code status or decision-maker details not checked one by one');
    if (!canSign) blockers.push('A nurse (RN) or house manager needs to confirm. Switch "View as" to RN or House manager.');
    const plan = buildPlan(adm);
    v.append(h('div',{class:'card'}, h('h2',null,'What happens when you confirm'),
      h('ul',null,
        h('li',null,adm.code+' ('+adm.nick+') is added to '+site().name+' so every screen shows them.'),
        h('li',null,plan.orders.length+' orders go to the shared order list'+(tier==='rn' ? ', marked nurse-checked by you.' : ', waiting for the nurse check.')),
        h('li',null,'Meals: '+(plan.diet ? plan.diet.name+'; '+plan.diet.texture+'; liquids '+plan.diet.liquids+(plan.diet.allergies.length ? '; allergies '+plan.diet.allergies.join(', ') : '') : 'no diet order found')+'.'),
        h('li',null,'Handoff: a starter summary with risks, what upsets them, what helps, code status and who to call.'),
        h('li',null,plan.appts.length+' appointments added by specialty. '+miss.length+' checklist items stay open as follow-ups.'),
        c.open ? h('li',null,c.open+' details not checked yet stay out of the live record.') : null)));
    const sum = h('div',{class:'card soft'}, h('h3',null,'Handoff starter (preview)'), h('div',{class:'out'}, handoffText(plan.handoff)));
    v.append(sum);
    const ack = h('input',{type:'checkbox',id:'ackOrig'});
    v.append(h('div',{class:'card'+(blockers.length?' warn':'')},
      blockers.length ? [h('h3',null,'Before you can confirm'), h('ul',null, blockers.map(b => h('li',null,b)))] : h('h3',null,'Ready to confirm'),
      h('label',{class:'row',for:'ackOrig',style:'align-items:flex-start'}, ack, h('span',null,'I compared the checked details with the original papers, and medicine questions on hold will be answered by the prescriber or pharmacy before those doses.')),
      h('button',{class:'btn',type:'button',disabled:!!blockers.length,onclick:() => { if (!ack.checked){ toast('Tick the box first'); ack.focus(); return; } goLive(adm, plan); }}, tier==='rn' ? 'Confirm as RN and set up' : 'Confirm and set up')));
  }

  function buildPlan(adm){
    const gs = groups(adm); const val = key => { const g = gs.find(x => x.key === key); return g ? finalValue(adm, g) : null; };
    const pick = sec => gs.filter(g => g.sec === sec).map(g => ({g, v:finalValue(adm, g)})).filter(x => x.v);
    const allergies = pick('allergy').filter(x => x.g.key !== 'allergy:none').map(x => x.v);
    const diet = val('diet:name') || val('diet:texture') ? {name:val('diet:name')||'Regular', texture:val('diet:texture')||'Regular', liquids:val('diet:liquids')||'Thin', allergies:allergies.map(a => a.replace(/\s*\(.*\)/,'').toLowerCase()), notes:val('diet:how')||''} : null;
    const at = new Date().toISOString(); const rn = S().tier === 'rn';
    const base = {site:adm.site, res:adm.code, start:adm.admit, end:'', source:'Admission intake', enteredBy:tierName()+' (you)', enteredAt:at, status:rn?'verified':'pending', verifiedBy:rn?'RN (you)':undefined, verifiedAt:rn?at:undefined, intake:adm.id};
    const specFor = f => { const d = f && adm.docs.find(x => x.id === f.doc); return (d && SPEC[d.id]) || (d && d.kind==='fhir' ? 'hospital' : 'primary'); };
    const orders = [];
    pick('meds').filter(x => !/^STOPPED/.test(x.v)).forEach(x => orders.push(Object.assign({}, base, {id:'adm-'+uid(), kind:'med', specialty:specFor(x.g.facts[0]), text:x.v+' (from admission papers)', prescriber:'See source papers'})));
    pick('meds').filter(x => /^STOPPED/.test(x.v)).forEach(x => orders.push(Object.assign({}, base, {id:'adm-'+uid(), kind:'other', specialty:'hospital', text:x.v+'. Do not give. Remove any supply from the cart.', prescriber:'Hospital discharge'})));
    gs.filter(g => g.sec==='meds' && (decOf(adm,g.key)||{}).s==='hold').forEach(g => orders.push(Object.assign({}, base, {id:'adm-'+uid(), kind:'med', specialty:'pharmacy', status:'pending', verifiedBy:undefined, verifiedAt:undefined, text:'ON HOLD: '+g.key.split(':')[1]+'. Papers disagree ('+g.options.map(o => o.value).join(' vs ')+'). Call the prescriber or pharmacy before giving.', prescriber:'To be confirmed'})));
    if (diet) orders.push(Object.assign({}, base, {id:'adm-'+uid(), kind:'diet', specialty:'therapy', text:diet.name+'; '+diet.texture+'; liquids '+diet.liquids+'.', prescriber:'Hospital discharge and speech therapy', diet}));
    const TRACK = [[/blood sugar/i,{label:'Blood sugar', type:'number', freq:'daily', where:['meal','handoff']}], [/skin/i,{label:'Skin check, heels and hips', type:'yesno', freq:'every shift', where:['handoff']}], [/weigh/i,{label:'Weight', type:'lb', freq:'weekly', where:['handoff']}], [/denture/i,{label:'Dentures cleaned and soaked', type:'check', freq:'daily', where:['handoff']}], [/fluid|intake/i,{label:'Fluid intake', type:'ml', freq:'every shift', where:['meal','handoff']}]];
    pick('monitor').forEach(x => { const t = TRACK.find(r => r[0].test(x.v)); orders.push(Object.assign({}, base, {id:'adm-'+uid(), kind:'monitor', specialty:specFor(x.g.facts[0]), text:x.v+'.', prescriber:'See source papers', track:t ? t[1] : {label:x.v.slice(0,40), type:'check', freq:'daily', where:['handoff']}})); });
    const appts = pick('appts').map(x => { const MON = ['january','february','march','april','may','june','july','august','september','october','november','december']; const mm = x.v.match(/(january|february|march|april|may|june|july|august|september|october|november|december) (\d{4})/i); const m = x.v.match(/(\d{4}-\d{2}-\d{2})/) || (mm && [0, mm[2]+'-'+String(MON.indexOf(mm[1].toLowerCase())+1).padStart(2,'0')+'-01']); const doc = adm.docs.find(d => d.id === x.g.facts[0].doc) || {};
      const sp = /psych/i.test(x.v) ? 'psych' : /dental/i.test(x.v) ? 'dental' : /primary/i.test(x.v) ? 'primary' : /ortho|cardio/i.test(x.v) ? 'specialist' : (SPEC[doc.id]||'specialist');
      return Object.assign({}, base, {id:'adm-'+uid(), kind:'appointment', specialty:sp, text:x.v.replace(/^Psychiatry/,'Behavioral health visit')+'.', start:m ? m[1] : addDays(adm.admit, 7), prescriber:x.g.facts[0] ? (adm.docs.find(d => d.id===x.g.facts[0].doc)||{}).from : ''}); });
    orders.push(...appts);
    orders.forEach(o => { Object.keys(o).forEach(k => o[k] === undefined && delete o[k]); });
    const code = val('code'); const dec = pick('decision').filter(x => x.g.key==='decision').map(x => x.v)[0];
    const handoff = {
      summary:adm.nick+' ('+adm.code+') is new as of '+fmt(adm.admit)+'. '+(val('demo:why')||''),
      risks:[val('fallrisk') ? 'Fall risk: '+val('fallrisk')+'. '+(val('mobility')||'') : val('mobility'), diet ? 'Swallowing: '+diet.texture+', liquids '+diet.liquids+'. '+(diet.notes||'') : null, allergies.length ? 'Allergies: '+allergies.join(', ') : null].filter(Boolean),
      triggers:pick('behavior').filter(x => /^(beh:rushed|beh:4pm|beh:exit)/.test(x.g.key) || x.g.label==='Trigger' || x.g.label==='Pattern').map(x => x.v),
      whatHelps:pick('behavior').filter(x => x.g.label==='What helps' || x.g.label==='Likes' || /^What matters/.test(x.g.label)).map(x => x.v),
      codeStatus:code || 'Not confirmed yet. Ask the nurse or manager.',
      contacts:[dec ? 'Decides health care: '+dec : 'Who decides: not confirmed yet'].concat(pick('team').map(x => x.g.label+': '+x.v))
    };
    return {orders, diet, appts, handoff};
  }
  function handoffText(ho){
    return [ho.summary, 'Code status: '+ho.codeStatus, ho.risks.length ? 'Watch for:\n- '+ho.risks.join('\n- ') : '', ho.triggers.length ? 'Triggers and patterns:\n- '+ho.triggers.join('\n- ') : '', ho.whatHelps.length ? 'What helps:\n- '+ho.whatHelps.join('\n- ') : '', 'Contacts:\n- '+ho.contacts.join('\n- ')].filter(Boolean).join('\n\n');
  }
  function goLive(adm, plan){
    const s = S();
    if (!Array.isArray(s.orders)) s.orders = [];
    s.orders = s.orders.filter(o => o.intake !== adm.id).concat(plan.orders);
    adm.profile = {handoff:plan.handoff, diet:plan.diet, at:new Date().toISOString()};
    adm.status = 'live'; adm.signed = {by:tierName()+' (you)', tier:s.tier, at:new Date().toISOString()};
    adm.note = 'New '+fmt(adm.admit)+'. '+(plan.handoff.risks[0]||'');
    (st().profiles = st().profiles || {})[adm.site+'/'+adm.code] = {handoff:plan.handoff, diet:plan.diet, intake:adm.id};
    const what = 'Admitted '+adm.code+' from intake ('+plan.orders.length+' orders)';
    if (window.SSAccess && SSAccess.log) SSAccess.log(what, adm.site); else if (Array.isArray(s.audit)) s.audit.unshift({at:adm.signed.at, who:adm.signed.by, what, site:adm.site});
    log(adm, 'Confirmed the admission and set up '+plan.orders.length+' orders, meals and handoff');
    forgetAll(); save(); syncResidents();
    toast(adm.code+' is set up'); location.hash = '#/intake/'+adm.id;
  }
  // Read by the meals and handoff screens: window.SS_residentProfile(site, code) -> {handoff, diet, intake} or null.
  window.SS_residentProfile = (siteId, code) => { const p = (st().profiles||{})[siteId+'/'+code]; return p ? JSON.parse(JSON.stringify(p)) : null; };

  function liveView(v, adm){
    const p = adm.profile || {}; const ho = p.handoff;
    const mine = (S().orders||[]).filter(o => o.intake === adm.id);
    const has = id => !!A.VIEWS[id];
    v.append(h('div',{class:'card calm'}, h('h2',null,'✅ Admitted and set up'), h('p',null,'Confirmed by '+adm.signed.by+' on '+fmt(adm.signed.at)+'. '+mine.length+' orders, the meal plan and a handoff starter are in place.'),
      h('div',{class:'row'}, has('orders') ? h('a',{class:'btn ghost sm',href:'#/orders'},'Orders ('+mine.filter(o=>o.status==='pending').length+' waiting for nurse check)') : null, has('meals') ? h('a',{class:'btn ghost sm',href:'#/meals'},'Meals') : null, has('shift') ? h('a',{class:'btn ghost sm',href:'#/shift'},'Shift handoff') : null, h('a',{class:'btn ghost sm',href:'#/intake/'+adm.id+'/checklist'},'Open checklist items'))));
    if (ho) v.append(h('div',{class:'card'}, h('h2',null,'Handoff starter'), h('div',{class:'out'}, handoffText(ho))));
    const gs = groups(adm);
    SECS.forEach(([sec, title, ic]) => {
      const rows = gs.filter(g => g.sec === sec && finalValue(adm, g));
      if (!rows.length) return;
      v.append(h('div',{class:'card'}, h('h3',null,ic+' '+title), h('div',{class:'list'}, rows.map(g => h('div',{class:'item'}, h('div',{class:'meta'}, h('span',null,g.label), g.facts.some(f => (adm.docs.find(x=>x.id===f.doc)||{}).sensitive) ? h('span',{class:'chip amber'},'🔒 Restricted') : null), h('b',null,finalValue(adm, g)), h('div',{class:'row'}, g.facts.filter(f => norm(f.value)===norm(finalValue(adm,g)) || g.facts.length===1).concat(g.facts.length ? [] : []).map(f => srcChip(adm, f))))))));
    });
    const held = gs.filter(g => (decOf(adm,g.key)||{}).s==='hold');
    if (held.length) v.append(h('div',{class:'card warn'}, h('h3',null,'Still waiting on answers'), h('ul',null, held.map(g => h('li',null,g.label+': '+g.options.map(o => o.value).join(' vs '))))));
    v.append(logCard(adm));
  }

  function logCard(adm){
    const L = st().log.filter(x => x.adm === adm.id || (!x.adm && x.site === adm.site)).slice(-40).reverse();
    return h('details',{class:'card'}, h('summary',null,h('b',null,'Access log ('+L.length+')')), h('p',{class:'small muted'},'Every capture, upload, view and change is logged with who and when, never the content.'),
      h('div',{class:'tablewrap'}, h('table',{class:'t'}, h('thead',null,h('tr',null,h('th',null,'When'),h('th',null,'Who'),h('th',null,'What'))), h('tbody',null, L.map(x => h('tr',null, h('td',null,new Date(x.at).toLocaleString()), h('td',null,x.who), h('td',null,x.what)))))));
  }

  function policyView(v){
    v.append(h('a',{href:'#/intake'},'← Admissions'));
    v.append(A.head('Staff rules', 'Phones, tablets and photos of resident papers', 'Short version for staff. Your home can make it stricter, never looser.'));
    v.append(h('div',{class:'card'}, h('h2',null,'The rules'), h('ol',null,
      h('li',null,'Use the home\'s tablet when you can. It is the recommended device for admissions and orders.'),
      h('li',null,'Never photograph resident papers, screens, wristbands or the resident with your phone\'s camera app, or text or email them. Use "Take photos" inside Steady Shift.'),
      h('li',null,'Your phone needs a screen lock (PIN, fingerprint or face) and the Steady Shift app lock. The app signs out after idle time.'),
      h('li',null,'Don\'t screenshot resident information. The Android app blocks screenshots; on iPhone, the app hides the screen in the app switcher and notes screenshots.'),
      h('li',null,'If your phone is lost or stolen, or you leave the job, tell the manager the same day. They sign you out of every device remotely.'),
      h('li',null,'No resident details in personal texts, group chats, social media or personal cloud notes.'),
      h('li',null,'Shared tablet: sign out at the end of your shift. Don\'t save your password in the browser.'),
      h('li',null,'Saw a photo saved somewhere it shouldn\'t be? Tell the manager. It may need to be reported as a privacy incident. Reporting it is the right thing and won\'t get you in trouble for speaking up.'))));
    v.append(h('div',{class:'card soft'}, h('h2',null,'How the in-app camera protects the papers'), h('ul',null,
      h('li',null,'The camera runs inside Steady Shift. Pictures are held in the app\'s memory, not saved to Photos, Gallery, iCloud or Google Photos, and there is no share or download button.'),
      h('li',null,'Pictures are encrypted and sent straight to your home\'s private storage, then cleared from the device. If the app sits in the background for 2 minutes first, they are cleared anyway.'),
      h('li',null,'Reading the page (text recognition and AI) happens on the server, under a signed business associate agreement. A nurse or manager checks the result before anything goes live.'),
      h('li',null,'Every capture, view and change is in the access log.'))));
    v.append(h('div',{class:'card'}, h('h2',null,'What the live version needs first'), h('ul',null,
      h('li',null,'HIPAA program in place (risk analysis, policies, training) and a business associate agreement with each home.'),
      h('li',null,'HIPAA-eligible storage with a BAA (for example AWS or Supabase with its HIPAA add-on), encrypted per home, with row-level access rules.'),
      h('li',null,'Text recognition and AI vendor with a BAA and no data retention or training on the files.'),
      h('li',null,'Native app settings: Android FLAG_SECURE (blocks screenshots), iOS app-switcher privacy screen, in-app camera only, app PIN or biometric lock, remote sign-out, and managed tablets (MDM) for the home\'s devices.'),
      h('li',null,'Virus scan on uploads, original files kept 7 years after discharge, and stricter handling for mental health (Wis. Stat. 51.30), substance use treatment (42 CFR Part 2) and psychotherapy notes.'))));
  }

  // ---------- register with the app ----------
  A.VIEWS.intake = {t:'New resident admission', ic:'🧳'};
  A.R.intake = view;
  ['manager','rn','owner','multi'].forEach(t => { const n = A.NAV[t]; if (n && !n.includes('intake')) n.splice(Math.min(2, n.length), 0, 'intake'); });
  if (window.SSAccess && SSAccess.register) try { SSAccess.register({id:'intake', name:'New resident admission', ic:'🧳', what:'Bulk upload and in-app photos, a checked profile with sources, the admission checklist, and setup of orders, meals and handoff.', views:['intake'], tiers:['manager','rn','owner','multi']}); } catch(e){}
  syncResidents();
  window.SSCapture = {panel:capturePanel, forget, forgetAll};
})();
