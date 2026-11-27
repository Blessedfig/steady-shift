// Steady Shift shared pay benchmarks (one source for the academy toolkit and owner labor analytics).
// window.SS_WAGES.lookup(role, county) -> {role, area, areaName, hourly:{p10,p25,median,p75,p90}|null, anchor, src, check}
// Only figures someone on the team read from the official page are filled in. Every empty area value links to the
// official BLS lookup for that area, and the screens say "check" until the Wisconsin tables are loaded.
// To fill an area: copy the May 2025 values from the BLS area page into DATA[areaId][role] as {p10,p25,median,p75,p90}.
window.SS_WAGES = (function(){
  const asOf = 'BLS OEWS May 2025 (latest release, published 2026)';
  const ROLES = {
    cna:{soc:'31-1131', label:'Nursing assistant (CNA)'},
    pca:{soc:'31-1122', label:'Personal care aide / caregiver'},
    hha:{soc:'31-1121', label:'Home health aide'},
    lpn:{soc:'29-2061', label:'Licensed practical nurse (LPN)'},
    rn:{soc:'29-1141', label:'Registered nurse (RN)'},
    mgr:{soc:'11-9111', label:'Medical and health services manager'},
    cook:{soc:'35-2012', label:'Cook, institution'},
    hk:{soc:'37-2012', label:'Housekeeper'},
    admin:{soc:'43-6013', label:'Office and medical secretary'}
  };
  // BLS OEWS areas for Wisconsin (codes from the BLS May 2025 metro and nonmetro index).
  const AREAS = {
    wi:{name:'Wisconsin (statewide)', code:'5500000'},
    appleton:{name:'Appleton', code:'0011540'}, duluth:{name:'Duluth (MN-WI)', code:'0020260'}, eauclaire:{name:'Eau Claire', code:'0020740'},
    fdl:{name:'Fond du Lac', code:'0022540'}, greenbay:{name:'Green Bay', code:'0024580'}, janesville:{name:'Janesville-Beloit', code:'0027500'},
    kenosha:{name:'Kenosha', code:'0028450'}, lacrosse:{name:'La Crosse-Onalaska', code:'0029100'}, madison:{name:'Madison', code:'0031540'},
    milwaukee:{name:'Milwaukee-Waukesha', code:'0033340'}, msp:{name:'Minneapolis-St. Paul (MN-WI)', code:'0033460'}, oshkosh:{name:'Oshkosh-Neenah', code:'0036780'},
    racine:{name:'Racine-Mount Pleasant', code:'0039540'}, sheboygan:{name:'Sheboygan', code:'0043100'}, wausau:{name:'Wausau', code:'0048140'},
    nw:{name:'Northwestern Wisconsin nonmetro', code:'5500001'}, ne:{name:'Northeastern Wisconsin nonmetro', code:'5500002'},
    sc:{name:'South Central Wisconsin nonmetro', code:'5500003'}, west:{name:'Western Wisconsin nonmetro', code:'5500004'}
  };
  // County -> metro area. Counties not listed are nonmetro; which of the four nonmetro areas is being checked.
  const COUNTY = {
    Calumet:'appleton', Outagamie:'appleton', Douglas:'duluth', Chippewa:'eauclaire', 'Eau Claire':'eauclaire', 'Fond du Lac':'fdl',
    Brown:'greenbay', Kewaunee:'greenbay', Oconto:'greenbay', Rock:'janesville', Kenosha:'kenosha', 'La Crosse':'lacrosse',
    Columbia:'madison', Dane:'madison', Green:'madison', Iowa:'madison', Milwaukee:'milwaukee', Ozaukee:'milwaukee', Washington:'milwaukee', Waukesha:'milwaukee',
    Pierce:'msp', 'St. Croix':'msp', Winnebago:'oshkosh', Racine:'racine', Sheboygan:'sheboygan', Marathon:'wausau', Lincoln:'wausau'
  };
  // Filled area values (hourly). Empty until read from the official table.
  const DATA = {};
  // Figures read from official BLS pages (verified by the scheduler thread, 2026-11-26).
  const ANCHORS = {
    cna:{median:20.13, where:'United States median, May 2025', src:'BLS Occupational Outlook Handbook'},
    pca:{median:17.21, where:'United States median, May 2025 (home health and personal care aides)', src:'BLS Occupational Outlook Handbook'},
    hha:{median:17.21, where:'United States median, May 2025 (home health and personal care aides)', src:'BLS Occupational Outlook Handbook'}
  };
  const GROUP = [{area:'wausau', label:'Personal care and service occupations, mean', hourly:17.80, period:'May 2024'}, {area:'wausau', label:'Healthcare support occupations, mean', hourly:18.91, period:'May 2024'}];
  const areaFor = county => { const c = String(county||'').replace(/\s+county$/i,'').trim(); const k = Object.keys(COUNTY).find(x => x.toLowerCase() === c.toLowerCase()); return k ? COUNTY[k] : (c ? 'nonmetro' : 'wi'); };
  const blsUrl = areaId => { const a = AREAS[areaId]; return a ? 'https://data.bls.gov/oes/#/area/'+a.code : 'https://www.bls.gov/oes/2025/may/oessrcma.htm'; };
  function lookup(role, county){
    const areaId = areaFor(county), r = ROLES[role] || null;
    const vals = (DATA[areaId] && DATA[areaId][role]) || (DATA.wi && DATA.wi[role]) || null;
    return {role, label:r ? r.label : role, soc:r ? r.soc : '', area:areaId, areaName:areaId==='nonmetro' ? 'Wisconsin nonmetro area (check which of four)' : AREAS[areaId].name,
      hourly:vals, anchor:ANCHORS[role] || null, src:asOf, url:blsUrl(areaId), check:!vals};
  }
  // Employer payroll load used by planners. Check every January.
  const PAYROLL = {fica:7.65, futa:0.6, futaBase:7000, suta:3.05, sutaBase:14000, wcPer100:3.0,
    note:'FICA (7.65%) and FUTA (0.6% on the first $7,000 after the state credit) are from IRS Publication 15. The Wisconsin unemployment rate for new employers and the taxable wage base, and your workers\' compensation rate, are estimates: check with DWD and your insurer.'};
  return {asOf, ROLES, AREAS, COUNTY, DATA, ANCHORS, GROUP, PAYROLL, areaFor, blsUrl, lookup};
})();
