// Steady Shift test app: Backup and export (owners only).
// One-click full export (JSON + CSV + printable pages in one zip), optional passphrase encryption
// (AES-256-GCM, key from PBKDF2-SHA-256), a backup schedule with history and overdue alerts,
// restore from a backup file, an offline emergency packet, and an audit log of every backup action.
// Test app: everything runs in this browser on fictional sample data. Cloud destinations are shown
// as "ready to connect"; the live product connects them with OAuth on the server, and only after a
// Business Associate Agreement (BAA) is signed with that provider for any real resident information.
(function(){
  const A = window.SSApp; if (!A) return;
  const {h, head, R, VIEWS, NAV, save, toast, D, fmtTime, site} = A;
  const S = () => A.state();
  const OWNER = ['owner','multi'];
  const isOwner = () => OWNER.includes(S().tier);
  const who = () => (A.tier && A.tier().name) || S().tier;
  const DAY = 86400000;
  const FREQ = {daily:{label:'Every day', ms:DAY}, weekly:{label:'Every week', ms:7*DAY}, monthly:{label:'Every month', ms:30*DAY}, off:{label:'Off', ms:0}};
  const DEST = {
    download:{label:'Download to this device', ic:'💻', note:'Saved to this device\'s Downloads folder. Copy it to a USB drive or your cloud folder.'},
    gdrive:{label:'Google Drive', ic:'🟢', oauth:true, baa:'Google Workspace signs a BAA for paid Workspace plans. Personal Gmail accounts can\'t be used for resident information.'},
    onedrive:{label:'OneDrive or SharePoint', ic:'🔷', oauth:true, baa:'Microsoft signs a BAA through its business plans (Microsoft 365 Business). Personal OneDrive can\'t be used for resident information.'},
    dropbox:{label:'Dropbox', ic:'📦', oauth:true, baa:'Dropbox signs a BAA on Business plans only, after the owner accepts it in the admin console.'},
    email:{label:'Email a download link to the owner', ic:'✉️', note:'The email holds a link, never the file. The link expires in 7 days and needs a sign-in.'}
  };
  const DEFAULT_PLAN = {
    meet:'Front sidewalk by the mailbox. Second place if the yard is unsafe: neighbor\'s garage (sample).',
    routes:'Front door and back patio door. Bedrooms 1 and 2 use the hallway to the front door; bedrooms 3 and 4 use the patio door.',
    shelter:'Tornado or severe storm: basement family room. Bring the go-bag, residents\' meds and this packet.',
    utilities:'Water shutoff: basement, north wall. Gas: meter outside east side (wrench hangs next to it). Breaker panel: laundry room.',
    gobag:'Flashlight, radio, 3 days of meds per resident, copies of face sheets and this packet, phone chargers, blankets, water.',
    relocate:'Sample sister home (Cedar Lane) or Sample Regional Hospital lobby. Call the owner before moving residents.',
    power:'Fridge meds (insulin) go in the cooler with ice packs. Oxygen concentrator users switch to tanks; supplier number on their sheet.'
  };

  function bk(){
    const s = S();
    if (!s.backup) s.backup = {};
    const b = s.backup;
    b.settings = b.settings || {};
    const def = {freq:'weekly', dest:'download', encrypt:true, time:'02:00', keep:12};
    for (const k in def) if (!(k in b.settings)) b.settings[k] = def[k]; // fill in place so the screen keeps one settings object
    b.history = b.history || []; b.log = b.log || []; b.links = b.links || {};
    b.plan = b.plan || {}; b.packet = b.packet || {};
    return b;
  }
  function log(action, detail){
    const b = bk();
    b.log.unshift({at:new Date().toISOString(), by:who(), role:S().tier, home:site().name, action, detail:detail||''});
    b.log = b.log.slice(0, 500); save();
  }

  // ---------- small helpers ----------
  const enc = new TextEncoder(), dec = new TextDecoder();
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stamp = () => new Date().toISOString().slice(0,16).replace(/[:T]/g,'-');
  const size = n => n < 1024 ? n+' B' : n < 1048576 ? (n/1024).toFixed(1)+' KB' : (n/1048576).toFixed(1)+' MB';
  const plan = () => Object.assign({}, DEFAULT_PLAN, bk().plan[S().site]||{});
  function saveBytes(name, bytes, type){
    const a = h('a',{href:URL.createObjectURL(new Blob([bytes],{type:type||'application/octet-stream'})), download:name, hidden:true, 'aria-hidden':'true', tabindex:'-1'}, name);
    document.body.append(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  async function sha256(bytes){ const d = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join(''); }

  // ---------- zip (stored, no compression) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n=0;n<256;n++){ let c=n; for (let k=0;k<8;k++) c = c&1 ? 0xEDB88320^(c>>>1) : c>>>1; t[n]=c>>>0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i=0;i<b.length;i++) c = CRC[(c^b[i])&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; };
  function zip(files){
    const parts = [], central = []; let off = 0;
    const d = new Date(), dt = ((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1)), dd = (((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate());
    for (const f of files){
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      [[0,0x04034b50,4],[4,20,2],[6,0x0800,2],[8,0,2],[10,dt,2],[12,dd,2],[14,crc,4],[18,data.length,4],[22,data.length,4],[26,name.length,2],[28,0,2]].forEach(([o,v,n]) => n===4 ? lh.setUint32(o,v,true) : lh.setUint16(o,v,true));
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      [[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x0800,2],[10,0,2],[12,dt,2],[14,dd,2],[16,crc,4],[20,data.length,4],[24,data.length,4],[28,name.length,2],[30,0,2],[32,0,2],[34,0,2],[36,0,2],[38,0,4],[42,off,4]].forEach(([o,v,n]) => n===4 ? ch.setUint32(o,v,true) : ch.setUint16(o,v,true));
      central.push(new Uint8Array(ch.buffer), name);
      off += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((n,p)=>n+p.length,0);
    const end = new DataView(new ArrayBuffer(22));
    [[0,0x06054b50,4],[4,0,2],[6,0,2],[8,files.length,2],[10,files.length,2],[12,cdSize,4],[16,off,4],[20,0,2]].forEach(([o,v,n]) => n===4 ? end.setUint32(o,v,true) : end.setUint16(o,v,true));
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((n,p)=>n+p.length,0)); let p = 0; all.forEach(x => { out.set(x,p); p += x.length; });
    return out;
  }
  function unzip(bytes){ // reads stored (uncompressed) zips, like the ones this screen makes
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), files = {}; let p = 0;
    while (p + 30 <= bytes.length && v.getUint32(p,true) === 0x04034b50){
      const method = v.getUint16(p+8,true), csize = v.getUint32(p+18,true), nlen = v.getUint16(p+26,true), xlen = v.getUint16(p+28,true);
      const name = dec.decode(bytes.subarray(p+30, p+30+nlen)), start = p+30+nlen+xlen;
      if (method === 0) files[name] = bytes.subarray(start, start+csize);
      p = start + csize;
    }
    return files;
  }

  // ---------- encryption: "SSBK1" + salt(16) + iv(12) + AES-GCM ciphertext ----------
  const MAGIC = enc.encode('SSBK1'), ITER = 310000;
  async function keyFrom(pass, salt){
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:ITER, hash:'SHA-256'}, base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
  }
  async function encrypt(bytes, pass){
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv}, await keyFrom(pass, salt), bytes));
    const out = new Uint8Array(5+16+12+ct.length); out.set(MAGIC,0); out.set(salt,5); out.set(iv,21); out.set(ct,33); return out;
  }
  const isEncrypted = b => b.length > 33 && MAGIC.every((x,i) => b[i] === x);
  async function decrypt(bytes, pass){
    const salt = bytes.subarray(5,21), iv = bytes.subarray(21,33);
    return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM', iv}, await keyFrom(pass, salt), bytes.subarray(33)));
  }

  // ---------- what goes in an export ----------
  const CATS = [
    ['Resident records', /^(face|isp|intake|orders|meals|famTasks|delegations|residents)/i],
    ['Reports and incidents', /(report|forms|incident|shift|questions|review|signals|pulse)/i],
    ['Schedules and time sheets', /(sched|time|kiosk|station|oncall|labor)/i],
    ['HR, training and access', /(academy|training|team|staff|access|members|codes|trial)/i],
    ['Policies and documents', /(polic|proc|orgProcs|facility|survey|watch|peer|menu|clean|outlook)/i]
  ];
  const catOf = name => (CATS.find(([,re]) => re.test(name))||['Other settings'])[0];
  const isRows = a => Array.isArray(a) && a.length && a.every(x => x && typeof x === 'object' && !Array.isArray(x));
  function tables(state){
    const out = {};
    const walk = (name, v, depth) => {
      if (isRows(v)) { out[name] = v; return; }
      if (depth < 3 && v && typeof v === 'object' && !Array.isArray(v)) for (const [k, x] of Object.entries(v)) walk(name+'-'+k, x, depth+1);
    };
    for (const [k, v] of Object.entries(state)) if (k !== 'backup') walk(k, v, 0);
    return out;
  }
  function csv(rows){
    const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
    const cell = v => { const s = v==null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\r\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
    return [cols.map(cell).join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\r\n')+'\r\n';
  }
  function residentRows(siteId){
    return (D.RESIDENTS[siteId]||[]).map(r => {
      let f = {}, p = {}; try { if (siteId === S().site && window.SSFace) f = SSFace.face(r.code) || {}; } catch(e){}
      try { if (window.SSCare) p = SSCare.profile(r.code) || {}; } catch(e){}
      return {home:siteId, code:r.code, name:r.nick, room:f.room||'', code_status:f.code||'', directive:f.directive||'', allergies:(p.allergies||[]).join('; '), diet:p.diet||'',
        diagnoses:(f.dx||[]).join('; '), mobility:f.mobility||'', fall_risk:(f.risks||{}).fall||'', elope_risk:(f.risks||{}).elope||'', choke_risk:(f.risks||{}).choke||'', note:r.note||''};
    });
  }
  function homes(){ return S().tier === 'multi' ? D.SITES.map(s => s.id) : [S().site]; }

  async function buildExport(){
    const s = S(), when = new Date().toISOString(), files = [], counts = {};
    const state = JSON.parse(JSON.stringify(s)); delete state.backup;
    const tb = tables(state);
    files.push({name:'data/full-backup.json', data:JSON.stringify({format:'steady-shift-backup', version:1, exported:when, by:who(), homes:homes(), sample:true, state}, null, 1)});
    const res = homes().flatMap(residentRows);
    files.push({name:'csv/Resident records/residents.csv', data:csv(res)}); counts['Resident records'] = (counts['Resident records']||0) + res.length;
    for (const [name, rows] of Object.entries(tb)){ const c = catOf(name); counts[c] = (counts[c]||0) + rows.length; files.push({name:'csv/'+c+'/'+name+'.csv', data:csv(rows)}); }
    for (const id of homes()) files.push({name:'printable/emergency-packet-'+id+'.html', data:packetHtml(id)});
    files.push({name:'printable/face-sheets-'+s.site+'.html', data:faceSheetsHtml(s.site)});
    const list = files.map(f => f.name);
    files.unshift({name:'README.txt', data:[
      'Steady Shift backup', 'Exported '+when+' by '+who(), 'Homes: '+homes().map(id => (D.SITES.find(x=>x.id===id)||{}).name).join(', '), '',
      'data/full-backup.json   Everything, for restoring into Steady Shift (Backup and export > Restore).',
      'csv/                    One spreadsheet per record type, grouped by category. Opens in Excel or Google Sheets.',
      'printable/              Emergency packet and face sheets. Open in a browser and print, or Print > Save as PDF.', '',
      'TEST APP: all residents and records are fictional sample data.', '', 'Files:', ...list].join('\r\n')});
    const manifest = [];
    for (const f of files){ const b = typeof f.data === 'string' ? enc.encode(f.data) : f.data; manifest.push({file:f.name, bytes:b.length, sha256:await sha256(b)}); }
    files.push({name:'manifest.json', data:JSON.stringify({exported:when, files:manifest}, null, 1)});
    return {bytes:zip(files), counts, files:files.length, tables:Object.keys(tb).length};
  }

  // ---------- printable pages ----------
  const PAGE_CSS = 'body{font:15px/1.45 system-ui,Segoe UI,Arial,sans-serif;color:#1F3A52;margin:24px;max-width:900px}h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:22px 0 6px;border-bottom:2px solid #1D6AA8;padding-bottom:3px}h3{font-size:16px;margin:14px 0 4px}.note{background:#FFF4E5;border:1px solid #E9C995;padding:8px 10px;border-radius:8px}.red{background:#FBE9E7;border:1px solid #EBB4AE;padding:8px 10px;border-radius:8px}table{border-collapse:collapse;width:100%;margin:6px 0}td,th{border:1px solid #C9D6E2;padding:5px 7px;text-align:left;vertical-align:top}th{background:#E8F3FC}.res{page-break-inside:avoid;border:1px solid #C9D6E2;border-radius:10px;padding:10px 12px;margin:10px 0}.muted{color:#5A6F80;font-size:13px}@media print{body{margin:0}.noprint{display:none}}';
  function contactsFor(siteId){
    const st = D.SITES.find(x => x.id === siteId) || {};
    return [['Emergency (fire, police, ambulance)','911'],['Poison Control','1-800-222-1222'],['House manager on call (sample)','715-555-0140'],['Owner (sample)','715-555-0141'],
      ['Sample Pharmacy (Main St.)','715-555-0150'],['Sample Regional Hospital','715-555-0160'],['Utility outage line (sample)','715-555-0170'],
      ['Licensing agency (DHS Division of Quality Assurance) regional office (sample)','715-555-0180'],['Home address (sample)', st.city||'']];
  }
  function packetHtml(siteId){
    const st = D.SITES.find(x => x.id === siteId) || site(), pl = Object.assign({}, DEFAULT_PLAN, bk().plan[siteId]||{});
    const res = residentRows(siteId), when = new Date().toLocaleString();
    const meds = code => { try { return window.SSCare ? SSCare.ordersFor(siteId, code).map(o => o.text) : []; } catch(e){ return []; } };
    const faceOf = code => { try { return siteId === S().site && window.SSFace ? SSFace.face(code) : null; } catch(e){ return null; } };
    const people = f => f ? [f.guardian && ('Guardian: '+f.guardian.name+' '+(f.guardian.phone||'')), f.poa && (f.poa.type+': '+f.poa.name+' '+(f.poa.phone||'')+(f.poa.activated?' (activated)':'')),
      ...(f.emergency||[]).map(p => p.role+': '+p.name+' '+p.phone), ...(f.team||[]).filter(p => /primary/.test(p.specialty||'')).map(p => 'Doctor: '+p.name+' '+p.phone)].filter(Boolean).filter((x, i, a) => { const ph = x.match(/\d{3}-\d{3}-\d{4}/); return !ph || a.findIndex(y => y.includes(ph[0])) === i; }) : [];
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Emergency packet: '+esc(st.name)+'</title><style>'+PAGE_CSS+'</style></head><body>'+
      '<h1>Emergency packet: '+esc(st.name)+'</h1><p class="muted">Printed '+esc(when)+'. Use this if the app, phones or internet are down. Replace it each month and after any admission, discharge or code status change.</p>'+
      '<p class="note"><b>Test app sample.</b> Every name and number here is made up.</p>'+
      '<div class="red"><b>Life or safety at risk? Call 911 first.</b> Then call the house manager. Guardians and family are called after the person is safe.</div>'+
      '<h2>Who to call</h2><table>'+contactsFor(siteId).map(([a,b]) => '<tr><th>'+esc(a)+'</th><td>'+esc(b)+'</td></tr>').join('')+'</table>'+
      '<h2>Emergency plan</h2><table>'+[['Meeting place',pl.meet],['Ways out',pl.routes],['Shelter in place',pl.shelter],['Utility shutoffs',pl.utilities],['Go-bag',pl.gobag],['If we must move residents',pl.relocate],['Power outage',pl.power]].map(([a,b]) => '<tr><th style="width:24%">'+esc(a)+'</th><td>'+esc(b)+'</td></tr>').join('')+'</table>'+
      '<h2>Residents ('+res.length+')</h2>'+res.map(r => { const f = faceOf(r.code), m = meds(r.code), pp = people(f);
        return '<div class="res"><h3>'+esc(r.name)+' ('+esc(r.code)+')'+(r.room?', room '+esc(r.room):'')+'</h3><table>'+
          '<tr><th style="width:24%">Code status</th><td><b>'+esc(r.code_status||'Check the red folder')+'</b>'+(r.directive?'<br>'+esc(r.directive):'')+'</td></tr>'+
          '<tr><th>Allergies</th><td>'+esc(r.allergies||'None known')+'</td></tr>'+
          '<tr><th>Diagnoses</th><td>'+esc(r.diagnoses||'See face sheet')+'</td></tr>'+
          '<tr><th>Getting out</th><td>'+esc(r.mobility||'Ask the manager')+(r.elope_risk==='High'?'<br><b>Wandering risk: count this person at the meeting place first.</b>':'')+'</td></tr>'+
          '<tr><th>Orders and meds to bring</th><td>'+(m.length ? m.map(esc).join('<br>') : 'Bring the MAR binder and bubble packs.')+'</td></tr>'+
          '<tr><th>Who to call for them</th><td>'+(pp.length ? pp.map(esc).join('<br>') : 'See face sheet')+'</td></tr></table></div>'; }).join('')+
      '<h2>Rules this packet supports</h2><p>Wisconsin requires a written emergency and evacuation plan that staff know and practice: DHS 88 for adult family homes and DHS 83 for CBRFs (check the exact sections in the compliance rulebook). Keep a printed copy where night staff can reach it without a phone or the internet.</p>'+
      '</body></html>';
  }
  function faceSheetsHtml(siteId){
    const st = D.SITES.find(x => x.id === siteId) || site();
    const res = residentRows(siteId);
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Face sheets: '+esc(st.name)+'</title><style>'+PAGE_CSS+'</style></head><body><h1>Face sheets: '+esc(st.name)+'</h1><p class="note"><b>Test app sample.</b> Fictional residents.</p>'+
      '<table><tr><th>Resident</th><th>Room</th><th>Code status</th><th>Allergies</th><th>Diet</th><th>Mobility</th><th>Fall</th><th>Wander</th><th>Choke</th></tr>'+
      res.map(r => '<tr><td>'+esc(r.name)+' ('+esc(r.code)+')</td><td>'+esc(r.room)+'</td><td>'+esc(r.code_status)+'</td><td>'+esc(r.allergies||'None known')+'</td><td>'+esc(r.diet)+'</td><td>'+esc(r.mobility)+'</td><td>'+esc(r.fall_risk)+'</td><td>'+esc(r.elope_risk)+'</td><td>'+esc(r.choke_risk)+'</td></tr>').join('')+'</table></body></html>';
  }

  // ---------- schedule and status ----------
  function lastGood(){ return bk().history.find(x => x.status === 'ok'); }
  function nextDue(){
    const st = bk().settings, f = FREQ[st.freq]; if (!f || !f.ms) return null;
    const last = lastGood(); if (!last) return new Date();
    const d = new Date(new Date(last.at).getTime() + f.ms); const [hh, mm] = (st.time||'02:00').split(':').map(Number); d.setHours(hh||0, mm||0, 0, 0); return d;
  }
  function status(){
    const b = bk(), st = b.settings, last = lastGood(), due = nextDue(), fail = b.history[0] && b.history[0].status !== 'ok';
    if (st.freq === 'off') return {cls:'warn', text:'Automatic backups are off.', short:'Backups are off'};
    if (fail) return {cls:'alert', text:'The last backup failed: '+(b.history[0].error||'unknown error')+'. Run one now.', short:'Last backup failed'};
    if (!last) return {cls:'warn', text:'No backup yet. Make the first one now.', short:'No backup yet'};
    if (due && due < new Date(Date.now() - DAY)) return {cls:'warn', text:'Backup overdue since '+fmtTime(due.toISOString())+'.', short:'Backup overdue'};
    return {cls:'calm', text:'Last backup '+fmtTime(last.at)+'. Next one '+(due ? fmtTime(due.toISOString()) : 'not scheduled')+'.', short:'Backups up to date'};
  }

  async function runBackup(opts){
    const b = bk(), st = b.settings, dest = (opts && opts.dest) || st.dest, entry = {id:Math.random().toString(36).slice(2,9), at:new Date().toISOString(), by:who(), kind:(opts&&opts.kind)||'manual', dest, encrypted:false, status:'ok'};
    try {
      const out = await buildExport();
      let bytes = out.bytes, name = 'steady-shift-backup-'+site().id+'-'+stamp();
      const pass = opts && opts.pass;
      if (st.encrypt){ if (!pass || pass.length < 10) throw new Error('A passphrase of at least 10 characters is needed for an encrypted backup'); bytes = await encrypt(bytes, pass); name += '.ssbk'; entry.encrypted = true; }
      else name += '.zip';
      Object.assign(entry, {file:name, bytes:bytes.length, files:out.files, counts:out.counts, sha256:(await sha256(bytes)).slice(0,16)});
      if (DEST[dest].oauth){
        if (!b.links[dest]) throw new Error(DEST[dest].label+' is not connected yet');
        entry.note = 'Test app: the file was downloaded here instead. The live product uploads it to '+DEST[dest].label+'.';
      }
      if (dest === 'email') entry.note = 'Test app: downloaded here. The live product emails the owner a 7-day sign-in link.';
      saveBytes(name, bytes, st.encrypt ? 'application/octet-stream' : 'application/zip');
      toast('Backup saved: '+name);
    } catch(e){ entry.status = 'failed'; entry.error = e.message || String(e); toast('Backup failed: '+entry.error); }
    b.history.unshift(entry); b.history = b.history.slice(0, Math.max(3, b.settings.keep||12) * 3);
    log(entry.status === 'ok' ? 'Backup made' : 'Backup failed', [entry.kind, DEST[dest].label, entry.encrypted?'encrypted':'not encrypted', entry.file||entry.error].join(' · '));
    return entry;
  }

  async function readBackupFile(file, pass){
    let bytes = new Uint8Array(await file.arrayBuffer());
    if (isEncrypted(bytes)){ if (!pass) throw new Error('This backup is encrypted. Type its passphrase.'); try { bytes = await decrypt(bytes, pass); } catch(e){ throw new Error('Wrong passphrase, or the file is damaged.'); } }
    let json;
    if (bytes[0] === 0x50 && bytes[1] === 0x4b){ const fs = unzip(bytes); if (!fs['data/full-backup.json']) throw new Error('No data/full-backup.json inside this zip.'); json = dec.decode(fs['data/full-backup.json']); }
    else json = dec.decode(bytes);
    const data = JSON.parse(json);
    if (data.format !== 'steady-shift-backup' || !data.state) throw new Error('This is not a Steady Shift backup.');
    return data;
  }

  // ---------- the screen ----------
  const field = (label, input, hint) => h('label',{class:'f'}, label, input, hint ? h('span',{class:'small muted'},hint) : null);
  const card = (cls, ...k) => h('div',{class:'card'+(cls?' '+cls:'')}, ...k);

  R.backup = v => {
    v.append(head('Owners', 'Backup and export', 'Keep your own copy of everything: records, reports, schedules, training and documents. Make one now, set a schedule, restore from a file, and print an emergency packet for when the internet is down.'));
    if (!isOwner()){
      v.append(card('soft', h('h2',null,'Owners only'), h('p',null,'Backups hold every record in the home, so only the owner (or a multi-site owner) can make, download or restore them. Ask your owner if you need a copy of something.'),
        h('p',{class:'small muted'},'Test app: switch "View as" to Owner to try this screen.')));
      return;
    }
    const b = bk(), st = b.settings; if (!R.backup.opened){ R.backup.opened = true; log('Opened Backup and export'); }
    const s = status();
    v.append(card(s.cls, h('h2',null,s.short), h('p',null,s.text)));

    // 1. back up now
    const passIn = h('input',{type:'password',autocomplete:'new-password',placeholder:'At least 10 characters'});
    const pass2 = h('input',{type:'password',autocomplete:'new-password',placeholder:'Type it again'});
    const encBox = h('input',{type:'checkbox',checked:st.encrypt?'':null,onchange:e => { st.encrypt = e.target.checked; save(); log('Changed encryption', st.encrypt?'on':'off'); passWrap.hidden = !st.encrypt; }});
    const passWrap = h('div',{class:'grid'}, field('Backup passphrase', passIn, 'Write it down and keep it apart from the backup. Without it nobody, including us, can open the file.'), field('Passphrase again', pass2));
    passWrap.hidden = !st.encrypt;
    const out = h('div',{class:'small','aria-live':'polite'});
    const go = h('button',{class:'btn',type:'button',onclick:async () => {
      if (st.encrypt && passIn.value !== pass2.value){ out.textContent = 'The two passphrases don\'t match.'; return; }
      go.disabled = true; out.textContent = 'Building the backup…';
      const e = await runBackup({pass:passIn.value, kind:'manual'});
      go.disabled = false; passIn.value = pass2.value = '';
      out.textContent = e.status === 'ok' ? 'Saved '+e.file+' ('+size(e.bytes)+', '+e.files+' files). '+(e.note||'') : 'Failed: '+e.error;
      A.route();
    }},'Back up everything now');
    v.append(card('', h('h2',null,'Back up now'),
      h('p',null, S().tier === 'multi' ? 'One zip with every home you own.' : 'One zip with everything in '+site().name+'.' ,' Inside: a full data file for restoring, a spreadsheet (CSV) for each kind of record, and printable face sheets and emergency packets you can save as PDF.'),
      h('label',{class:'row'}, encBox, h('span',null,'Encrypt the backup (recommended, required for real resident records)')), passWrap, h('div',{class:'row'}, go), out,
      h('details',{class:'small'}, h('summary',null,'What\'s in the zip'), h('ul',null, ...CATS.map(([c]) => h('li',null,c)), h('li',null,'Other settings'), h('li',null,'README and a manifest with a checksum for every file, so you can tell if anything was changed')))));

    // 2. schedule
    const freq = h('select',{onchange:e => { st.freq = e.target.value; save(); log('Changed schedule', FREQ[st.freq].label); A.route(); }}, ...Object.entries(FREQ).map(([k,f]) => h('option',{value:k,selected:k===st.freq?'':null},f.label)));
    const time = h('input',{type:'text',value:st.time,inputmode:'numeric',pattern:'[0-2][0-9]:[0-5][0-9]',onchange:e => { if (/^([01]\d|2[0-3]):[0-5]\d$/.test(e.target.value)){ st.time = e.target.value; save(); log('Changed backup time', st.time); } else toast('Use 24-hour time, like 02:00'); }});
    const keep = h('select',{onchange:e => { st.keep = +e.target.value; save(); log('Changed how many to keep', String(st.keep)); }}, ...[4,12,26,52].map(n => h('option',{value:n,selected:n===st.keep?'':null}, n+' backups')));
    const dests = h('div',{class:'grid'}, ...Object.entries(DEST).map(([k,d]) => {
      const linked = b.links[k];
      return h('div',{class:'card'+(st.dest===k?' soft':'')},
        h('label',{class:'row'}, h('input',{type:'radio',name:'bkdest',checked:st.dest===k?'':null,onchange:() => { st.dest = k; save(); log('Changed destination', d.label); A.route(); }}), h('b',null,d.ic+' '+d.label)),
        d.note ? h('p',{class:'small muted'},d.note) : null,
        d.oauth ? h('div',{class:'grid'},
          h('div',{class:'row'}, linked ? h('span',{class:'chip calm'},'Connected (test)') : h('span',{class:'chip grey'},'Not connected'),
            h('button',{class:'btn ghost sm',type:'button',onclick:() => { if (linked){ delete b.links[k]; log('Disconnected', d.label); } else { b.links[k] = {at:new Date().toISOString(), by:who()}; log('Connected (test)', d.label); } save(); A.route(); }}, linked ? 'Disconnect' : 'Connect '+d.label)),
          h('p',{class:'small muted'},'Live product: you sign in to '+d.label+' and allow Steady Shift to write to one folder only. We never see your password. '+d.baa)) : null);
    }));
    v.append(card('', h('h2',null,'Automatic backups'),
      h('div',{class:'grid',style:'grid-template-columns:repeat(auto-fit,minmax(180px,1fr))'}, field('How often', freq), field('Time (24-hour)', time), field('Keep the newest', keep)),
      h('p',{class:'small muted'},'Test app: a browser can\'t run on a timer while closed, so when a backup is due you\'ll see a reminder on the owner home screen. The live product runs it on our server at this time and sends you an alert if one fails.'),
      h('h3',null,'Where backups go'), dests,
      card('warn', h('b',null,'Before real resident information is backed up to a cloud account'), h('p',{class:'small'},'HIPAA treats a cloud provider that stores health information as a business associate. Sign that provider\'s Business Associate Agreement (BAA) first, use a business account, and keep encryption on. Until then, back up to this device and an encrypted USB drive only.'))));

    // 3. emergency packet
    const pl = plan(), planEd = {};
    const planFields = [['meet','Meeting place'],['routes','Ways out'],['shelter','Shelter in place'],['utilities','Utility shutoffs'],['gobag','Go-bag'],['relocate','If we must move residents'],['power','Power outage']];
    v.append(card('', h('h2',null,'Offline emergency packet'),
      h('p',null,'Face sheets, code status, allergies, orders, contacts and the home\'s emergency plan on a few printed pages. Keep it in the red folder by the door so night staff have it if the app, phones or internet are down.'),
      h('div',{class:'row'},
        h('button',{class:'btn',type:'button',onclick:() => { const name = 'emergency-packet-'+site().id+'-'+stamp().slice(0,10)+'.html'; saveBytes(name, enc.encode(packetHtml(S().site)), 'text/html'); b.packet[S().site] = {at:new Date().toISOString(), by:who()}; log('Emergency packet downloaded', site().name); toast('Downloaded '+name); A.route(); }},'Download packet (works offline)'),
        h('button',{class:'btn ghost',type:'button',onclick:() => { const w = window.open('', '_blank'); if (!w){ toast('Allow pop-ups to print, or use Download'); return; } w.document.write(packetHtml(S().site)); w.document.close(); b.packet[S().site] = {at:new Date().toISOString(), by:who()}; log('Emergency packet printed', site().name); setTimeout(() => w.print(), 400); }},'Print it')),
      h('p',{class:'small muted'}, b.packet[S().site] ? 'Last printed or downloaded '+fmtTime(b.packet[S().site].at)+'. Print a fresh copy every month and after any admission, discharge or code status change.' : 'Not printed yet for this home.'),
      h('details',null, h('summary',null,'Edit this home\'s emergency plan'),
        h('div',{class:'grid'}, ...planFields.map(([k,l]) => { planEd[k] = h('textarea',{rows:2}, pl[k]); return field(l, planEd[k]); }),
          h('div',{class:'row'}, h('button',{class:'btn sm',type:'button',onclick:() => { b.plan[S().site] = Object.fromEntries(planFields.map(([k]) => [k, planEd[k].value.trim()])); save(); log('Emergency plan edited', site().name); toast('Plan saved'); }},'Save plan'),
            h('button',{class:'btn quiet sm',type:'button',onclick:() => { delete b.plan[S().site]; save(); log('Emergency plan reset to sample', site().name); A.route(); }},'Reset to sample')))),
      h('p',{class:'small muted'},'Wisconsin requires a written emergency and evacuation plan that staff know and practice (DHS 88 for adult family homes, DHS 83 for CBRFs). This packet is the printed copy that still works with no power or signal.')));

    // 4. restore
    const fileIn = h('input',{type:'file',accept:'.ssbk,.zip,.json'});
    const rPass = h('input',{type:'password',autocomplete:'off',placeholder:'Only for encrypted (.ssbk) backups'});
    const preview = h('div',{class:'grid','aria-live':'polite'});
    const check = h('button',{class:'btn ghost',type:'button',onclick:async () => {
      preview.textContent = ''; const f = fileIn.files[0]; if (!f){ preview.append(h('p',null,'Choose a backup file first.')); return; }
      try {
        const data = await readBackupFile(f, rPass.value);
        const tb = tables(data.state), byCat = {}; Object.entries(tb).forEach(([n,rows]) => { const c = catOf(n); byCat[c] = (byCat[c]||0) + rows.length; });
        log('Backup checked for restore', f.name+' · exported '+data.exported);
        preview.append(card('soft', h('b',null,'Backup from '+fmtTime(data.exported)+' by '+(data.by||'unknown')),
          h('ul',null, ...Object.entries(byCat).map(([c,n]) => h('li',null, c+': '+n+' records'))),
          h('p',{class:'small'},'Restoring replaces everything on this device with this backup. We save a safety backup of what\'s here now first, so you can undo.'),
          h('div',{class:'row'}, h('button',{class:'btn red',type:'button',onclick:async () => {
            if (!confirm('Replace all data on this device with the backup from '+fmtTime(data.exported)+'?')) return;
            const safety = JSON.stringify({format:'steady-shift-backup', version:1, exported:new Date().toISOString(), by:who(), sample:true, state:Object.assign({}, S(), {backup:undefined})});
            saveBytes('safety-before-restore-'+stamp()+'.json', enc.encode(safety), 'application/json');
            const keepB = bk(), cur = S();
            Object.keys(cur).forEach(k => { delete cur[k]; }); Object.assign(cur, data.state, {backup:keepB});
            log('Restored from backup', f.name+' · exported '+data.exported); save(); toast('Restored. A safety copy of the old data was downloaded.'); A.fillSwitchers(); A.route();
          }},'Restore this backup'))));
      } catch(e){ preview.append(card('alert', h('p',null, e.message || String(e)))); log('Restore check failed', f.name+' · '+(e.message||e)); }
    }},'Check the file');
    v.append(card('', h('h2',null,'Restore or import'),
      h('p',null,'Bring back data from a Steady Shift backup: after a lost tablet, a new device, or a mistake. We show what\'s inside before anything changes.'),
      field('Backup file (.ssbk, .zip or .json)', fileIn), field('Passphrase', rPass), h('div',{class:'row'}, check), preview,
      h('p',{class:'small muted'},'Moving from paper or another program? Use the CSV templates from an export to bring records in. A guided import for other systems comes with the live product.')));

    // 5. history
    const hist = b.history;
    v.append(card('', h('h2',null,'Backup history'),
      hist.length ? h('div',{class:'tablewrap',tabindex:'0',role:'region','aria-label':'Backup history'}, h('table',{class:'t'}, h('thead',null, h('tr',null, ...['When','By','Type','Where','Encrypted','Size','Result'].map(x => h('th',null,x)))),
        h('tbody',null, ...hist.slice(0, 30).map(x => h('tr',null, h('td',null,fmtTime(x.at)), h('td',null,x.by), h('td',null,x.kind), h('td',null,(DEST[x.dest]||{}).label||x.dest), h('td',null,x.encrypted?'Yes':'No'), h('td',null,x.bytes?size(x.bytes):''),
          h('td',null, x.status === 'ok' ? h('span',{class:'chip calm',title:'Checksum '+(x.sha256||'')},'Saved') : h('span',{class:'chip red'},'Failed: '+x.error))))))) : h('p',{class:'muted'},'No backups yet.')));

    // 6. audit log
    v.append(card('', h('h2',null,'Who did what'),
      h('p',{class:'small muted'},'Every backup, download, restore and setting change is logged here and kept with the home\'s records. Only owners can see this log.'),
      h('div',{class:'row'}, h('button',{class:'btn quiet sm',type:'button',onclick:() => { A.download('backup-audit-log-'+stamp()+'.csv', 'text/csv', csv(b.log.map(x => ({when:x.at, by:x.by, role:x.role, home:x.home, action:x.action, detail:x.detail})))); log('Audit log downloaded'); }},'Download the log (CSV)')),
      h('div',{class:'tablewrap',tabindex:'0',role:'region','aria-label':'Backup audit log'}, h('table',{class:'t'}, h('thead',null, h('tr',null, h('th',null,'When'), h('th',null,'Who'), h('th',null,'What'), h('th',null,'Details'))),
        h('tbody',null, ...b.log.slice(0, 40).map(x => h('tr',null, h('td',null,fmtTime(x.at)), h('td',null,x.by), h('td',null,x.action), h('td',{class:'small'},x.detail))))))));

    v.append(card('soft', h('h2',null,'How backups are protected'), h('ul',null,
      h('li',null,'Only owners can make, download or restore a backup. Managers and staff see this screen as locked.'),
      h('li',null,'Encrypted backups use AES-256 with a key made from your passphrase. The passphrase never leaves this device and we can\'t recover it.'),
      h('li',null,'Each zip has a manifest with a SHA-256 checksum for every file, so a changed file is easy to spot.'),
      h('li',null,'Cloud copies go only to a business account with a signed BAA, into a folder Steady Shift can write to and nothing else.'),
      h('li',null,'Every action is logged with who, when and which home.'),
      h('li',null,'Test app: all residents and records are fictional, and nothing leaves this browser except the files you download.'))));
  };

  // ---------- register ----------
  VIEWS.backup = {t:'Backup and export', ic:'🛟'};
  ['owner','multi'].forEach(t => { const n = NAV[t]; if (n && !n.includes('backup')) { const i = n.indexOf('access'); n.splice(i >= 0 ? i+1 : n.length, 0, 'backup'); } });
  if (window.SSAccess && SSAccess.register) try { SSAccess.register({id:'backup', name:'Backup and export', ic:'🛟', what:'Owner backups with encryption, a schedule, restore, an audit log and an offline emergency packet.', views:['backup'], tiers:['owner','multi']}); } catch(e){}
  (A.ownerHooks = A.ownerHooks || []).push(v => {
    if (!isOwner()) return;
    const s = status();
    if (s.cls === 'calm') return;
    v.append(A.tile('backup','🛟', s.short, s.text, s.cls === 'alert' ? 'urgent' : ''));
  });
  (A.homeHooks = A.homeHooks || []).push((v, t) => {
    if (!OWNER.includes(t)) return;
    const s = status(); if (s.cls === 'calm') return;
    v.append(A.tile('backup','🛟', s.short, s.text, s.cls === 'alert' ? 'urgent' : ''));
  });
  window.SSBackup = {buildExport, packetHtml, status, zip, unzip, encrypt, decrypt, isEncrypted, readBackupFile, tables};
})();
