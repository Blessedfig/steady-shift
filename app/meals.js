// Steady Shift test app: meal documenting, shift change report (handoff), menu and grocery management,
// and a report form builder. Sample data only: every resident, staff member and record here is made up.
// Plugs into app.js through window.SSApp. Reads the scheduler (SSSched, SSTime), service switches (SSAccess)
// and doctor/nurse orders (SS_ordersFor) when those modules are present, and falls back to sample data when not.
(function(){
  const A = window.SSApp;
  if (!A) return;
  const {h, save, toast, copy, head, R, VIEWS, NAV, uid, fmtDate, fmtTime, site, setting, tier} = A;
  const residents = A.residents || (() => A.D.RESIDENTS[A.state().site] || []);
  if (!A.tile) A.tile = (href, ic, b, span, cls) => h('a',{class:'tile'+(cls?' '+cls:''),href:'#/'+href},h('span',{class:'ic','aria-hidden':'true'},ic),h('b',null,b),h('span',null,span));
  A.homeHooks = A.homeHooks || []; A.ownerHooks = A.ownerHooks || [];
  const S = () => A.state();
  const CHECKED = '2026-11-26';

  // ---------- dates ----------
  const pad = n => String(n).padStart(2,'0');
  const ymd = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const today = () => ymd(new Date());
  const addDays = (s, n) => { const d = new Date(s+'T12:00:00'); d.setDate(d.getDate()+n); return ymd(d); };
  const dayName = s => new Date(s+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'});
  const money = n => '$'+(Math.round(n*100)/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const money0 = n => '$'+Math.round(n).toLocaleString();
  const MEALS = [['b','Breakfast'],['l','Lunch'],['s','Supper'],['sn','Snack']];
  const mealName = k => (MEALS.find(m => m[0]===k)||[k,k])[1];

  // ---------- diet profiles (sample) ----------
  // IDDSI levels: foods 3 liquidised, 4 pureed, 5 minced & moist, 6 soft & bite-sized, 7 regular. Drinks 0 thin to 4 extremely thick.
  const ALLERGENS = {milk:'Milk', egg:'Egg', wheat:'Wheat / gluten', peanut:'Peanut', treenut:'Tree nuts', soy:'Soy', fish:'Fish', shellfish:'Shellfish', sesame:'Sesame'};
  const PROFILES = {
    'M-1':{diet:'Regular', texture:'IDDSI 7 Regular', liquids:'Thin', allergies:['shellfish'], likes:'Coffee at 7, oatmeal', dislikes:'Spicy food'},
    'M-2':{diet:'Regular, finger foods offered', texture:'IDDSI 7 Regular', liquids:'Thin', allergies:[], likes:'Sandwiches, pie', dislikes:'Mixed casseroles', cue:'Eats better with one item at a time and someone sitting with him.'},
    'M-3':{diet:'Consistent carbohydrate (diabetic)', texture:'IDDSI 7 Regular', liquids:'Thin', allergies:[], likes:'Chicken, green beans', dislikes:'Fish', carb:true},
    'M-4':{diet:'Regular', texture:'IDDSI 6 Soft & bite-sized', liquids:'IDDSI 2 Mildly thick', allergies:['peanut'], likes:'Mashed potatoes, pudding', dislikes:'Dry meat'},
    'B-2':{diet:'2 g sodium (low salt)', texture:'IDDSI 7 Regular', liquids:'Thin', allergies:['egg'], likes:'Soup', dislikes:'', lowna:true},
    'B-5':{diet:'Regular', texture:'IDDSI 7 Regular', liquids:'Thin', allergies:[], likes:'Burgers', dislikes:'Peas'},
    'B-7':{diet:'Regular, lactose free', texture:'IDDSI 7 Regular', liquids:'Thin', allergies:['milk'], likes:'Toast, tea', dislikes:''},
    'B-9':{diet:'Regular, fortified foods', texture:'IDDSI 4 Pureed', liquids:'IDDSI 1 Slightly thick', allergies:[], likes:'Applesauce, ice cream', dislikes:'', cue:'Needs hands-on help to eat.'},
    'C-1':{diet:'Gluten free (celiac)', texture:'IDDSI 7 Regular', liquids:'Thin', allergies:['wheat'], likes:'Rice dishes', dislikes:''},
    'C-3':{diet:'Regular', texture:'IDDSI 7 Regular', liquids:'Thin', allergies:['fish'], likes:'Meat and potatoes', dislikes:''},
    'Mom':{diet:'Consistent carbohydrate (diabetic)', texture:'IDDSI 7 Regular', liquids:'Thin', allergies:[], likes:'Tea, toast', dislikes:'', carb:true}
  };

  // Sample orders, in the shape the orders module uses. Only used when that module is not loaded.
  const SAMPLE_ORDERS = [
    {id:'so1', site:'maple', res:'M-3', kind:'other', text:'Record fluid intake every shift. Goal 1,500 mL a day.', start:'2026-11-01', end:'', prescriber:'Dr. Sample (prescriber)', enteredBy:'House manager', enteredAt:'2026-11-01T10:00:00', status:'verified', verifiedBy:'RN (sample)', verifiedAt:'2026-11-01T15:00:00',
      track:{label:'Fluids this shift (mL)', type:'ml', freq:'every shift', where:['meal','handoff']}},
    {id:'so2', site:'maple', res:'M-4', kind:'other', text:'Weigh weekly on the same scale before breakfast. Report a loss of 3 lb or more.', start:'2026-10-15', end:'', prescriber:'RN (sample)', enteredBy:'RN (sample)', enteredAt:'2026-10-15T09:00:00', status:'verified', verifiedBy:'RN (sample)', verifiedAt:'2026-10-15T09:00:00',
      track:{label:'Weight (lb)', type:'lb', freq:'weekly', where:['handoff']}},
    {id:'so3', site:'birch', res:'B-9', kind:'other', text:'Check skin on heels and tailbone every shift. Report redness that does not fade.', start:'2026-11-10', end:'2026-12-10', prescriber:'RN (sample)', enteredBy:'RN (sample)', enteredAt:'2026-11-10T08:00:00', status:'verified', verifiedBy:'RN (sample)', verifiedAt:'2026-11-10T08:00:00',
      track:{label:'Skin on heels and tailbone OK?', type:'yesno', freq:'every shift', where:['handoff']}},
    {id:'so4', site:'birch', res:'B-9', kind:'diet', text:'Pureed diet (IDDSI 4), slightly thick liquids. Offer a nutrition shake with each meal.', start:'2026-11-10', end:'', prescriber:'Dr. Sample (prescriber)', enteredBy:'House manager', enteredAt:'2026-11-10T08:30:00', status:'verified', verifiedBy:'RN (sample)', verifiedAt:'2026-11-10T12:00:00',
      track:{label:'Nutrition shake offered', type:'check', freq:'each meal', where:['meal']}},
    {id:'so5', site:'maple', res:'M-1', kind:'diet', text:'Offer a nutrition shake with lunch.', start:'2026-11-25', end:'', prescriber:'Dr. Sample (prescriber)', enteredBy:'House manager', enteredAt:'2026-11-25T14:00:00', status:'pending',
      track:{label:'Shake offered at lunch', type:'check', freq:'each meal', where:['meal']}}
  ];
  function ordersFor(siteId, res){
    const d = today();
    const active = o => (!o.start || o.start <= d) && (!o.end || o.end >= d);
    if (typeof window.SS_ordersFor === 'function') { try { return (window.SS_ordersFor(siteId, res) || []).filter(active); } catch(e){ return []; } }
    return SAMPLE_ORDERS.filter(o => o.site===siteId && o.res===res && o.status==='verified' && active(o));
  }
  function pendingOrders(siteId){
    const st = S();
    if (Array.isArray(st.orders)) return st.orders.filter(o => o.site===siteId && o.status==='pending');
    return SAMPLE_ORDERS.filter(o => o.site===siteId && o.status==='pending');
  }
  const trackItems = (siteId, res, where) => ordersFor(siteId, res).filter(o => o.track && (o.track.where||[]).includes(where));
  function profile(code){
    const p = Object.assign({diet:'Regular', texture:'IDDSI 7 Regular', liquids:'Thin', allergies:[]}, PROFILES[code]||{});
    // a verified diet order overrides the profile where it says so
    ordersFor(S().site, code).filter(o => o.kind==='diet' && o.diet).forEach(o => {
      ['name','texture','liquids','notes'].forEach(k => { if (o.diet[k]) p[k==='name'?'diet':k] = o.diet[k]; });
      if (o.diet.allergies) p.allergies = [...new Set([...p.allergies, ...o.diet.allergies])];
    });
    return p;
  }

  // ---------- recipes (sample library; costs are rough sample estimates per serving) ----------
  // contains: allergens. tags: salty (high sodium), carb (high carbohydrate), firm (needs texture change below IDDSI 7)
  const ING = (n, q, u, cat, cost) => ({n, q, u, cat, cost});
  const RECIPES = [
    {id:'oat', n:'Oatmeal with brown sugar and raisins', meal:'b', contains:['milk'], tags:['carb'], ing:[ING('Rolled oats',.5,'cup','Dry goods',.15),ING('Milk',.5,'cup','Dairy',.18),ING('Raisins',2,'tbsp','Dry goods',.12)]},
    {id:'eggs', n:'Scrambled eggs, toast and fruit', meal:'b', contains:['egg','wheat','milk'], tags:[], ing:[ING('Eggs',2,'each','Dairy',.5),ING('Bread',1,'slice','Bakery',.15),ING('Butter',1,'tsp','Dairy',.05),ING('Banana',1,'each','Produce',.25)]},
    {id:'pancake', n:'Pancakes with applesauce', meal:'b', contains:['egg','wheat','milk'], tags:['carb'], ing:[ING('Pancake mix',.5,'cup','Dry goods',.25),ING('Applesauce',.5,'cup','Canned',.3),ING('Syrup',2,'tbsp','Dry goods',.15)]},
    {id:'yogurt', n:'Yogurt, granola and berries', meal:'b', contains:['milk','wheat','treenut'], tags:[], ing:[ING('Yogurt',1,'cup','Dairy',.6),ING('Granola',.25,'cup','Dry goods',.3),ING('Frozen berries',.5,'cup','Frozen',.45)]},
    {id:'cream', n:'Cream of wheat with banana', meal:'b', contains:['wheat','milk'], tags:['carb'], ing:[ING('Cream of wheat',.25,'cup','Dry goods',.12),ING('Milk',.5,'cup','Dairy',.18),ING('Banana',1,'each','Produce',.25)]},
    {id:'soup', n:'Chicken noodle soup and grilled cheese', meal:'l', contains:['wheat','milk'], tags:['salty'], ing:[ING('Chicken noodle soup',1,'cup','Canned',.6),ING('Bread',2,'slice','Bakery',.3),ING('Cheese slices',2,'each','Dairy',.4)]},
    {id:'turkey', n:'Turkey sandwich with tomato soup', meal:'l', contains:['wheat','milk'], tags:['salty'], ing:[ING('Sliced turkey',3,'oz','Meat',1.1),ING('Bread',2,'slice','Bakery',.3),ING('Tomato soup',1,'cup','Canned',.5)]},
    {id:'tuna', n:'Tuna salad on lettuce with crackers', meal:'l', contains:['fish','egg','wheat'], tags:['firm'], ing:[ING('Canned tuna',3,'oz','Canned',.9),ING('Mayonnaise',1,'tbsp','Dry goods',.1),ING('Crackers',6,'each','Dry goods',.25),ING('Lettuce',1,'cup','Produce',.3)]},
    {id:'chili', n:'Beef chili with cornbread', meal:'l', contains:['wheat','milk','egg'], tags:['salty','carb'], ing:[ING('Ground beef',3,'oz','Meat',1.0),ING('Kidney beans',.5,'cup','Canned',.25),ING('Diced tomatoes',.5,'cup','Canned',.3),ING('Cornbread mix',.25,'box','Dry goods',.3)]},
    {id:'macveg', n:'Mac and cheese with peas', meal:'l', contains:['wheat','milk'], tags:['carb'], ing:[ING('Macaroni',.75,'cup','Dry goods',.2),ING('Cheddar cheese',1,'oz','Dairy',.35),ING('Milk',.25,'cup','Dairy',.09),ING('Frozen peas',.5,'cup','Frozen',.25)]},
    {id:'ricebowl', n:'Chicken and rice bowl with carrots', meal:'l', contains:[], tags:[], ing:[ING('Chicken thighs',4,'oz','Meat',1.0),ING('Rice',.5,'cup','Dry goods',.15),ING('Carrots',.5,'cup','Produce',.2)]},
    {id:'meatloaf', n:'Meatloaf, mashed potatoes and green beans', meal:'s', contains:['egg','wheat','milk'], tags:['firm'], ing:[ING('Ground beef',4,'oz','Meat',1.3),ING('Potatoes',1,'each','Produce',.3),ING('Milk',.25,'cup','Dairy',.09),ING('Green beans',.5,'cup','Frozen',.25),ING('Bread crumbs',2,'tbsp','Dry goods',.05)]},
    {id:'chicken', n:'Baked chicken, rice and broccoli', meal:'s', contains:[], tags:['firm'], ing:[ING('Chicken breast',4,'oz','Meat',1.2),ING('Rice',.5,'cup','Dry goods',.15),ING('Frozen broccoli',.5,'cup','Frozen',.3)]},
    {id:'fish', n:'Baked cod, potatoes and coleslaw', meal:'s', contains:['fish','egg'], tags:[], ing:[ING('Cod fillet',4,'oz','Meat',2.0),ING('Potatoes',1,'each','Produce',.3),ING('Coleslaw mix',1,'cup','Produce',.4),ING('Mayonnaise',1,'tbsp','Dry goods',.1)]},
    {id:'spag', n:'Spaghetti with meat sauce and salad', meal:'s', contains:['wheat','milk'], tags:['salty','carb'], ing:[ING('Spaghetti',2,'oz','Dry goods',.2),ING('Ground beef',3,'oz','Meat',1.0),ING('Pasta sauce',.5,'cup','Canned',.45),ING('Lettuce',1,'cup','Produce',.3),ING('Parmesan',1,'tbsp','Dairy',.15)]},
    {id:'pork', n:'Pork roast, sweet potatoes and corn', meal:'s', contains:[], tags:['firm'], ing:[ING('Pork loin',4,'oz','Meat',1.2),ING('Sweet potatoes',1,'each','Produce',.5),ING('Frozen corn',.5,'cup','Frozen',.2)]},
    {id:'stew', n:'Beef stew with dinner roll', meal:'s', contains:['wheat'], tags:['salty'], ing:[ING('Stew beef',4,'oz','Meat',1.6),ING('Potatoes',1,'each','Produce',.3),ING('Carrots',.5,'cup','Produce',.2),ING('Dinner rolls',1,'each','Bakery',.25)]},
    {id:'pudding', n:'Vanilla pudding', meal:'sn', contains:['milk'], tags:['carb'], ing:[ING('Pudding cups',1,'each','Dairy',.4)]},
    {id:'fruitcup', n:'Fruit cup and graham crackers', meal:'sn', contains:['wheat'], tags:['carb'], ing:[ING('Fruit cups',1,'each','Canned',.45),ING('Graham crackers',2,'each','Dry goods',.15)]},
    {id:'pbtoast', n:'Peanut butter toast', meal:'sn', contains:['peanut','wheat'], tags:[], ing:[ING('Peanut butter',1,'tbsp','Dry goods',.1),ING('Bread',1,'slice','Bakery',.15)]},
    {id:'cheese', n:'Cheese and crackers', meal:'sn', contains:['milk','wheat'], tags:['salty'], ing:[ING('Cheese sticks',1,'each','Dairy',.35),ING('Crackers',6,'each','Dry goods',.25)]},
    {id:'shake', n:'Nutrition shake', meal:'sn', contains:['milk','soy'], tags:[], ing:[ING('Nutrition shakes',1,'each','Supplements',1.5)]},
    {id:'gfpasta', n:'Gluten-free pasta with meat sauce', meal:'s', contains:[], tags:['salty'], ing:[ING('Gluten-free pasta',2,'oz','Dry goods',.6),ING('Ground beef',3,'oz','Meat',1.0),ING('Pasta sauce',.5,'cup','Canned',.45)]},
    {id:'lactose', n:'Lactose-free yogurt and fruit', meal:'sn', contains:[], tags:[], ing:[ING('Lactose-free yogurt',1,'each','Dairy',.8),ING('Banana',1,'each','Produce',.25)]},
    {id:'eggfree', n:'Oatmeal made with water, and fruit', meal:'b', contains:[], tags:['carb'], ing:[ING('Rolled oats',.5,'cup','Dry goods',.15),ING('Banana',1,'each','Produce',.25)]},
    {id:'gftoast', n:'Gluten-free toast with eggs', meal:'b', contains:['egg'], tags:[], ing:[ING('Gluten-free bread',1,'slice','Bakery',.45),ING('Eggs',2,'each','Dairy',.5)]},
    {id:'chickensoup', n:'Low-sodium chicken and rice soup', meal:'l', contains:[], tags:[], ing:[ING('Low-sodium broth',1,'cup','Canned',.4),ING('Chicken breast',2,'oz','Meat',.6),ING('Rice',.25,'cup','Dry goods',.08)]}
  ];
  const recipe = id => RECIPES.find(r => r.id===id);
  const WEEK1 = [
    {b:'oat', l:'soup', s:'meatloaf', sn:'pudding'},
    {b:'eggs', l:'turkey', s:'chicken', sn:'fruitcup'},
    {b:'pancake', l:'ricebowl', s:'fish', sn:'cheese'},
    {b:'yogurt', l:'chili', s:'pork', sn:'pbtoast'},
    {b:'cream', l:'macveg', s:'spag', sn:'pudding'},
    {b:'eggs', l:'tuna', s:'stew', sn:'fruitcup'},
    {b:'pancake', l:'soup', s:'chicken', sn:'cheese'}
  ];
  const WEEK2 = [
    {b:'eggs', l:'ricebowl', s:'pork', sn:'fruitcup'},
    {b:'oat', l:'turkey', s:'spag', sn:'pudding'},
    {b:'yogurt', l:'macveg', s:'meatloaf', sn:'cheese'},
    {b:'cream', l:'soup', s:'fish', sn:'fruitcup'},
    {b:'pancake', l:'chili', s:'chicken', sn:'pudding'},
    {b:'eggs', l:'tuna', s:'stew', sn:'cheese'},
    {b:'oat', l:'ricebowl', s:'pork', sn:'fruitcup'}
  ];

  // ---------- report forms (customizable per home, versioned) ----------
  // core fields cannot be removed (they carry the standard), but can be renamed or reordered.
  const FORM_DEFS = {
    meal:{name:'Meal log (each resident, each meal)', fields:[
      {id:'pct', label:'How much was eaten', type:'pct', core:true, req:true, on:true},
      {id:'fluids', label:'Fluids with the meal (mL)', type:'ml', on:true},
      {id:'refused', label:'Refused the meal', type:'check', on:true},
      {id:'sub', label:'Substitute offered', type:'text', on:true, hint:'e.g. soup instead of meatloaf'},
      {id:'assist', label:'Help needed', type:'choice', options:['Ate on their own','Set-up only','Cueing','Hands-on help'], on:true},
      {id:'note', label:'Anything to note', type:'text', on:true, hint:'Coughing, choking, chewing trouble, said they are not hungry'}
    ]},
    handoffRes:{name:'Shift change report: each resident', fields:[
      {id:'status', label:'How are they this shift?', type:'choice', options:['Stable','Watch closely','Changed'], core:true, req:true, on:true},
      {id:'situation', label:'What is going on', type:'text', on:true, hint:'Say what changed and what you did. Facts only.'},
      {id:'meds', label:'Medications', type:'choice', options:['All given as ordered','Refused or held','As-needed (PRN) given','Not on my shift'], on:true},
      {id:'behavior', label:'Mood or behavior', type:'text', on:true, hint:'What happened, what helped'},
      {id:'sleep', label:'Sleep (night shift)', type:'choice', options:['Slept well','Up a few times','Up most of the night'], on:false},
      {id:'bm', label:'Bowel movement this shift', type:'yesno', on:false}
    ]},
    handoffShift:{name:'Shift change report: whole house', fields:[
      {id:'safety', label:'Any safety concern in the house?', type:'text', core:true, on:true, hint:'Doors, alarms, equipment, weather, supplies. Write "none" if none.'},
      {id:'appts', label:'Appointments or visitors coming', type:'text', on:true},
      {id:'house', label:'House tasks left', type:'text', on:true, hint:'Laundry, dishes, cleaning'},
      {id:'low', label:'Running low on', type:'text', on:true, hint:'Gloves, briefs, thickener, groceries'}
    ]}
  };
  function forms(){
    const st = S(); st.care.forms = st.care.forms || {};
    const f = st.care.forms[st.site] = st.care.forms[st.site] || {};
    for (const k in FORM_DEFS) if (!f[k]) f[k] = {v:1, at:'2026-11-26T09:00:00', by:'Steady Shift default', fields:JSON.parse(JSON.stringify(FORM_DEFS[k].fields))};
    return f;
  }
  const liveFields = k => forms()[k].fields.filter(x => x.on);

  // ---------- state (this browser only) ----------
  function ensure(){
    const st = S();
    if (st.care && st.care.v === 1) return st.care;
    const c = st.care = {v:1, meals:[], handoffs:[], weights:[], flags:[], forms:{}, formHist:[], menu:{}, pantry:{}, spend:[], budget:{}, posted:{}, settings:{}};
    // seed 10 days of meal logs so patterns show up
    const t = today();
    const rnd = (a) => a[Math.floor(Math.random()*a.length)];
    Object.keys(A.D.RESIDENTS).forEach(sid => (A.D.RESIDENTS[sid]||[]).forEach(r => {
      for (let i = 10; i >= 1; i--){
        const d = addDays(t, -i);
        ['b','l','s'].forEach(m => {
          let pct = rnd([75,100,100,75,50]);
          let refused = false;
          if (r.code==='B-9') pct = i > 6 ? rnd([75,50]) : rnd([25,50,25,0]);
          if (r.code==='M-4' && m==='l' && i <= 6 && i % 2 === 0){ pct = 0; refused = true; }
          c.meals.push({id:uid(), site:sid, res:r.code, date:d, meal:m, at:d+'T'+({b:'08',l:'12',s:'17'}[m])+':15:00', by:'Caregiver (sample)', form:1,
            vals:{pct, fluids:rnd([120,180,240,240]), refused, sub:refused?'Offered soup and pudding':'', assist:r.code==='B-9'?'Hands-on help':'Ate on their own', note:''}});
        });
      }
    }));
    // weights (lb), sample: B-9 is losing weight
    const wt = (sid, res, list) => list.forEach(([ago, lb]) => c.weights.push({site:sid, res, date:addDays(t,-ago), lb, by:'Caregiver (sample)'}));
    wt('birch','B-9',[[60,156],[45,155],[30,154],[21,151.5],[14,149],[7,146.5]]);
    wt('maple','M-4',[[35,182],[28,181.5],[21,182],[14,181],[7,180.5]]);
    wt('maple','M-1',[[30,128],[0,128.5]]);
    // menu: 4-week cycle, weeks 1 and 2 written out, 3 and 4 copy them
    ['maple','birch','cedar','family'].forEach(sid => {
      c.menu[sid] = {cycle:4, start:mondayOf(t), weeks:{1:JSON.parse(JSON.stringify(WEEK1)), 2:JSON.parse(JSON.stringify(WEEK2)), 3:JSON.parse(JSON.stringify(WEEK1)), 4:JSON.parse(JSON.stringify(WEEK2))}, subs:{}, notes:{}};
      c.pantry[sid] = seedPantry(sid);
      const people = (A.D.RESIDENTS[sid]||[]).length || 1;
      c.budget[sid] = {perDay:9.5, staffMeals:sid==='birch'?2:1, people};
    });
    c.budget.birch.perDay = 8.75;
    // spend (sample), last 6 weeks
    const stores = ['Grocery store','Warehouse club','Farm stand','Pharmacy (supplements)'];
    ['maple','birch','cedar'].forEach(sid => {
      const people = (A.D.RESIDENTS[sid]||[]).length;
      for (let w = 6; w >= 0; w--){
        const base = people * 9 * 7 * (sid==='birch' ? 3 : 1);
        c.spend.push({id:uid(), site:sid, date:addDays(t, -w*7-2), store:stores[0], amt:Math.round(base*(0.55+Math.random()*0.2)*100)/100, cat:'Groceries', note:'Weekly order (sample)'});
        if (w % 2 === 0) c.spend.push({id:uid(), site:sid, date:addDays(t, -w*7-4), store:stores[1], amt:Math.round(base*(0.25+Math.random()*0.15)*100)/100, cat:'Groceries', note:'Bulk items (sample)'});
        if (sid==='birch' && w % 3 === 0) c.spend.push({id:uid(), site:sid, date:addDays(t, -w*7-1), store:stores[3], amt:84.0, cat:'Supplements', note:'Nutrition shakes (sample)'});
      }
    });
    // a sample handoff waiting at Birch Hollow
    c.handoffs.push({id:'hs1', site:'birch', at:addDays(t,0)+'T05:52:00', shift:'Night to Day', from:'Caregiver G', to:'', status:'Waiting', forms:{res:1, shift:1},
      fieldsRes:FORM_DEFS.handoffRes.fields.filter(f=>f.on).map(f=>({id:f.id,label:f.label,type:f.type})), fieldsShift:FORM_DEFS.handoffShift.fields.filter(f=>f.on).map(f=>({id:f.id,label:f.label,type:f.type})),
      res:{'B-2':{vals:{status:'Stable',meds:'All given as ordered'}}, 'B-5':{vals:{status:'Watch closely', situation:'Up and walking halls 1 to 2 AM. Warm milk and music helped. Slept after 2.', behavior:'Asked for the door twice. Walked with him.'}},
        'B-7':{vals:{status:'Stable'}}, 'B-9':{vals:{status:'Watch closely', situation:'Ate about a quarter of supper. Weight trend is down (see meal flags).', meds:'All given as ordered'}, orders:{so3:'Yes'}}},
      shiftVals:{safety:'None', appts:'B-2 eye appointment 10 AM. Ride is booked.', low:'Thickener (1 tub left)'},
      todos:[{id:'t1', text:'Help B-2 get ready for the 10 AM eye appointment', res:'B-2'},{id:'t2', text:'Offer B-9 the nutrition shake at breakfast and log it', res:'B-9'},{id:'t3', text:'Add thickener to the grocery list', res:''}],
      auto:['Night help: B-5 awake and walking halls 1 to 2 AM, warm milk and music helped.']});
    st.care = c; save();
    return c;
  }
  function mondayOf(s){ const d = new Date(s+'T12:00:00'); const k = (d.getDay()+6)%7; d.setDate(d.getDate()-k); return ymd(d); }
  function seedPantry(sid){
    const mult = sid==='birch' ? 3 : 1;
    const P = (n, have, u, min, cat) => ({id:uid(), n, have:have*mult, u, min:min*mult, cat});
    return [P('Rolled oats',6,'cup',4,'Dry goods'),P('Rice',4,'cup',4,'Dry goods'),P('Eggs',10,'each',12,'Dairy'),P('Milk',8,'cup',8,'Dairy'),P('Bread',12,'slice',10,'Bakery'),
      P('Canned tuna',6,'oz',0,'Canned'),P('Pasta sauce',2,'cup',1,'Canned'),P('Frozen peas',3,'cup',2,'Frozen'),P('Thickener',1,'tub',2,'Supplements'),P('Nutrition shakes',4,'each',12,'Supplements'),
      P('Bottled water',24,'each',24,'Emergency supply'),P('Canned soup',4,'cup',6,'Emergency supply')];
  }

  // ---------- small UI helpers ----------
  const chip = (txt, cls) => h('span',{class:'chip'+(cls?' '+cls:'')},txt);
  function seg(name, options, value, onPick, opts){
    opts = opts || {};
    const wrap = h('div',{class:'seg'+(opts.big?' big':''),role:'group','aria-label':name});
    options.forEach(o => {
      const val = Array.isArray(o) ? o[0] : o, lab = Array.isArray(o) ? o[1] : o;
      const b = h('button',{type:'button','aria-pressed':String(value===val),onclick:()=>{ const now = b.getAttribute('aria-pressed')==='true' && opts.toggle ? null : val; wrap.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed','false')); if (now!=null) b.setAttribute('aria-pressed','true'); onPick(now); }}, lab);
      wrap.append(b);
    });
    return wrap;
  }
  let fid = 0;
  function field(f, value, onChange){
    const id = 'mf'+(++fid);
    const lab = f.label + (f.req ? ' (required)' : '');
    if (f.type === 'pct') return h('div',{class:'f2'}, h('span',{class:'flab'},lab), seg(f.label, [[0,'0%'],[25,'25%'],[50,'50%'],[75,'75%'],[100,'100%']], value, onChange, {big:true}));
    if (f.type === 'choice') return h('div',{class:'f2'}, h('span',{class:'flab'},lab), seg(f.label, f.options, value, onChange, {toggle:true}));
    if (f.type === 'yesno') return h('div',{class:'f2'}, h('span',{class:'flab'},lab), seg(f.label, ['Yes','No'], value, onChange, {toggle:true}));
    if (f.type === 'check'){ const cb = h('input',{type:'checkbox',id,checked:!!value,onchange:()=>onChange(cb.checked)}); return h('label',{class:'checkrow',for:id}, cb, h('span',null,lab)); }
    if (f.type === 'ml'){
      const inp = h('input',{type:'number',id,min:'0',step:'30',inputmode:'numeric',value:value==null?'':String(value),oninput:()=>onChange(inp.value===''?null:+inp.value)});
      const add = n => h('button',{type:'button',class:'chip',onclick:()=>{ inp.value = String((+inp.value||0)+n); onChange(+inp.value); }},'+'+n);
      return h('div',{class:'f2'}, h('label',{class:'flab',for:id},lab), h('div',{class:'row'}, h('div',{style:'max-width:9rem'},inp), add(120), add(240), h('span',{class:'small muted'},'1 cup = 240 mL')));
    }
    if (f.type === 'number' || f.type === 'lb'){ const inp = h('input',{type:'number',id,step:f.type==='lb'?'0.5':'1',inputmode:'decimal',value:value==null?'':String(value),oninput:()=>onChange(inp.value===''?null:+inp.value)}); return h('label',{class:'f',for:id}, lab, h('div',{style:'max-width:10rem'},inp)); }
    const ta = h('input',{type:'text',id,maxlength:'500',placeholder:f.hint||'',value:value||'',oninput:()=>onChange(ta.value)});
    return h('label',{class:'f',for:id}, lab, ta);
  }
  const empty = v => v == null || v === '' || v === false;
  function dietChips(code){
    const p = profile(code);
    return h('div',{class:'chips'},
      chip(p.diet,'grey'), p.texture && !/7 Regular/.test(p.texture) ? chip(p.texture,'amber') : null,
      p.liquids && p.liquids !== 'Thin' ? chip('Drinks: '+p.liquids,'amber') : null,
      p.allergies.length ? chip('Allergy: '+p.allergies.map(a=>ALLERGENS[a]||a).join(', '),'red') : null);
  }
  function card(cls, ...kids){ return h('div',{class:'card'+(cls?' '+cls:'')}, ...kids); }
  function helpBox(summary, ...kids){ return h('details',{class:'card soft help'}, h('summary',null,summary), ...kids); }
  function download(name, type, text){ const a = h('a',{href:URL.createObjectURL(new Blob([text],{type})),download:name}); document.body.append(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); }
  const csvCell = x => /[",\n]/.test(String(x)) ? '"'+String(x).replace(/"/g,'""')+'"' : String(x);
  const staffNames = sid => { try { if (window.SSSched && SSSched.staffNames) { const n = SSSched.staffNames(sid); if (n && n.length) return n; } } catch(e){} return ((S().staff||{})[sid]||[]).map(x => x.n); };
  const isManager = () => ['manager','owner','multi','rn'].includes(S().tier);

  // ---------- meal flags ----------
  // Starting points a home can change on the Report forms screen. Weight thresholds follow the common long-term care
  // screen (5% in 30 days, 10% in 180 days). Refusal and intake thresholds are house defaults, not rules.
  function thresholds(){ const c = ensure(); return Object.assign({refuse:3, lowPct:50, lowDays:3, wt30:5, wt180:10, fluidGoal:1500}, c.settings[S().site]||{}); }
  function mealFlags(sid){
    const c = ensure(); const th = thresholds(); const t = today(); const out = [];
    (A.D.RESIDENTS[sid]||[]).forEach(r => {
      const logs = c.meals.filter(m => m.site===sid && m.res===r.code);
      const wk = logs.filter(m => m.date > addDays(t,-7));
      const refusals = wk.filter(m => m.vals.refused).length;
      if (refusals >= th.refuse) out.push({res:r.code, kind:'refuse', level:'amber', text:refusals+' meals refused in the last 7 days', why:'House default: '+th.refuse+' or more in 7 days. Ask what is going on (teeth, taste, mood, pain) and tell the manager.'});
      const recent = logs.filter(m => m.date > addDays(t,-(th.lowDays+1)) && ['b','l','s'].includes(m.meal) && m.vals.pct != null);
      if (recent.length >= 3){ const avg = recent.reduce((a,m)=>a+m.vals.pct,0)/recent.length; if (avg < th.lowPct) out.push({res:r.code, kind:'low', level:'amber', text:'Eating about '+Math.round(avg)+'% of meals over '+th.lowDays+' days', why:'House default: under '+th.lowPct+'% on average. Tell the manager or RN.'}); }
      const ws = c.weights.filter(w => w.site===sid && w.res===r.code).sort((a,b)=>a.date<b.date?-1:1);
      if (ws.length >= 2){
        const last = ws[ws.length-1];
        const base30 = ws.filter(w => w.date >= addDays(last.date,-30))[0];
        const base180 = ws.filter(w => w.date >= addDays(last.date,-180))[0];
        const p30 = base30 && base30 !== last ? (base30.lb-last.lb)/base30.lb*100 : 0;
        const p180 = base180 && base180 !== last ? (base180.lb-last.lb)/base180.lb*100 : 0;
        if (p30 >= th.wt30) out.push({res:r.code, kind:'weight', level:'red', text:'Lost '+p30.toFixed(1)+'% of body weight in 30 days ('+base30.lb+' to '+last.lb+' lb)', why:'Common screen: 5% in 30 days is a significant loss. Tell the RN and the resident\'s doctor, and check the service plan.'});
        else if (p180 >= th.wt180) out.push({res:r.code, kind:'weight', level:'red', text:'Lost '+p180.toFixed(1)+'% of body weight in 6 months', why:'Common screen: 10% in 180 days is a significant loss.'});
      }
      trackItems(sid, r.code, 'meal').concat(trackItems(sid, r.code, 'handoff')).filter(o => o.track.type==='ml').forEach(o => {
        const y = addDays(t,-1);
        const ml = fluidsOn(sid, r.code, y);
        if (ml < th.fluidGoal) out.push({res:r.code, kind:'fluids', level:'amber', text:'Fluids yesterday: '+ml+' mL (order goal '+th.fluidGoal.toLocaleString()+' mL)', why:'From the order: '+o.text});
      });
    });
    return out;
  }
  function fluidsOn(sid, res, d){
    const c = ensure();
    const m = c.meals.filter(x => x.site===sid && x.res===res && x.date===d).reduce((a,x)=>a+(+x.vals.fluids||0)+(+((x.orders||{}).fluids)||0),0);
    const hnd = c.handoffs.filter(x => x.site===sid && x.at.slice(0,10)===d).reduce((a,x)=>{ const o = ((x.res||{})[res]||{}).orders||{}; return a + Object.values(o).filter(v=>typeof v==='number' && v>50).reduce((p,q)=>p+q,0); },0);
    return m + hnd;
  }

  // =====================================================================
  // MEALS
  // =====================================================================
  R.meals = v => {
    ensure();
    if (S().site === 'family'){ /* family caregivers can log too */ }
    const hr = new Date().getHours();
    let meal = hr < 10 ? 'b' : hr < 15 ? 'l' : hr < 20 ? 's' : 'sn';
    let date = today();
    v.append(head('Meals · '+site().name, 'Log a meal', 'Tap how much each person ate. Diets, textures and allergies are shown on each card.'));
    const tabs = h('div',{class:'tabs',role:'tablist'});
    const body = h('div',{class:'grid'});
    const T = [['log','Log a meal'],['history','This week'],['flags','Flags ('+mealFlags(S().site).length+')']];
    if (isManager()) T.push(['weights','Weights']);
    let cur = param() || 'log';
    T.forEach(([id,lab]) => tabs.append(h('button',{role:'tab',type:'button','aria-selected':String(cur===id),onclick:()=>{ cur = id; tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b.textContent===lab))); draw(); }},lab)));
    v.append(tabs, body);
    function draw(){
      body.textContent = '';
      if (cur==='log') drawLog(); else if (cur==='history') drawHistory(); else if (cur==='flags') drawFlags(); else drawWeights();
    }
    function drawLog(){
      const fields = liveFields('meal');
      const top = h('div',{class:'row'},
        seg('Which meal', MEALS.map(m=>[m[0],m[1]]), meal, x => { meal = x; drawLog(); }),
        h('label',{class:'f',style:'max-width:12rem'},'Date', (()=>{ const d = h('input',{type:'date',value:date,max:today(),onchange:()=>{ date = d.value || today(); drawLog(); }}); return d; })()));
      body.textContent = '';
      body.append(card('', top, menuLine(date, meal)));
      const c = ensure();
      const rs = residents();
      const draft = {};
      rs.forEach(r => {
        const prev = c.meals.find(m => m.site===S().site && m.res===r.code && m.date===date && m.meal===meal);
        const d = draft[r.code] = {vals: prev ? Object.assign({}, prev.vals) : {}, orders: prev ? Object.assign({}, prev.orders||{}) : {}, prev};
        const p = profile(r.code);
        const box = card('res', h('div',{class:'meta'}, chip(r.code), h('b',null,r.nick+' (sample)'), prev ? chip('Logged '+fmtTime(prev.at),'calm') : null), dietChips(r.code),
          p.cue ? h('p',{class:'small'},'Tip: '+p.cue) : null);
        const sub = substituteFor(r.code, date, meal);
        if (sub) box.append(h('p',{class:'small house gap'},sub));
        box.append(h('div',{class:'row'}, h('button',{type:'button',class:'btn ghost sm',onclick:()=>{ d.vals = {pct:100, assist:'Ate on their own'}; d.quick = true; saveOne(r.code); }},'✓ Ate it all, no concerns')));
        // required and standard fields up front; the rest tucked under "More" so a phone screen stays short
        const more = h('div',{class:'grid'});
        fields.forEach(f => { const el = field(f, d.vals[f.id], val => { d.vals[f.id] = val; if (f.id==='refused' && val){ d.vals.pct = 0; } }); (f.req || f.core || f.id==='refused' ? box : more).append(el); });
        const tr = trackItems(S().site, r.code, 'meal');
        tr.forEach(o => box.append(h('div',{class:'order'}, h('span',{class:'small'},'Order: '+o.text), field({label:o.track.label, type:o.track.type, req:true}, d.orders[o.id], val => d.orders[o.id] = val))));
        if (more.childNodes.length) box.append(h('details',{class:'about'}, h('summary',null,'More: '+fields.filter(f => !(f.req || f.core || f.id==='refused')).map(f => f.label.replace(/ \(.*\)$/,'').toLowerCase()).join(', ')), more));
        body.append(box);
      });
      function missing(code){
        const d = draft[code];
        const reqs = fields.filter(f => f.req && empty(d.vals[f.id]) && !(f.id==='pct' && d.vals.refused)).map(f=>f.label);
        trackItems(S().site, code, 'meal').forEach(o => { if (empty(d.orders[o.id])) reqs.push(o.track.label); });
        return reqs;
      }
      function saveOne(code){
        const d = draft[code];
        if (d.quick){ trackItems(S().site, code, 'meal').forEach(o => { if (o.track.type==='check' && empty(d.orders[o.id])) d.orders[o.id] = true; }); }
        const miss = missing(code);
        if (miss.length){ toast(code+': still need '+miss.join(', ')); return false; }
        const c = ensure();
        if (d.prev) c.meals = c.meals.filter(m => m !== d.prev);
        c.meals.push({id:uid(), site:S().site, res:code, date, meal, at:new Date().toISOString(), by:tier().name+' (you)', form:forms().meal.v, fieldsUsed:fields.map(f=>({id:f.id,label:f.label})), vals:d.vals, orders:d.orders});
        save(); toast('Saved for '+code); drawLog(); return true;
      }
      const btn = h('button',{class:'btn',type:'button',onclick:()=>{
        const touched = rs.filter(r => Object.keys(draft[r.code].vals).some(k => !empty(draft[r.code].vals[k])));
        if (!touched.length){ toast('Tap how much someone ate first'); return; }
        const bad = touched.map(r => [r.code, missing(r.code)]).filter(x => x[1].length);
        if (bad.length){ toast(bad.map(b => b[0]+': '+b[1].join(', ')).join(' · ')); return; }
        const c = ensure();
        touched.forEach(r => { const d = draft[r.code]; if (d.prev) c.meals = c.meals.filter(m => m !== d.prev);
          c.meals.push({id:uid(), site:S().site, res:r.code, date, meal, at:new Date().toISOString(), by:tier().name+' (you)', form:forms().meal.v, fieldsUsed:fields.map(f=>({id:f.id,label:f.label})), vals:d.vals, orders:d.orders}); });
        save(); toast('Saved '+mealName(meal)+' for '+touched.length+(touched.length===1?' person':' people'));
        const fl = mealFlags(S().site); if (fl.length) setTimeout(()=>toast(fl.length+' meal flag'+(fl.length===1?'':'s')+' for the manager. See the Flags tab.'), 2700);
        drawLog();
      }},'Save '+mealName(meal).toLowerCase()+' for everyone I filled in');
      body.append(h('div',{class:'stickybar'}, btn));
      body.append(helpBox('Why we log meals, and what the rules say', ...ruleNotes('meal')));
    }
    function drawHistory(){
      const c = ensure(); const days = []; for (let i = 6; i >= 0; i--) days.push(addDays(date,-i));
      const tb = h('table',{class:'t'}, h('caption',{class:'sr'},'Percent eaten by meal, last 7 days'), h('thead',null,h('tr',null,h('th',{scope:'col'},'Resident'), days.map(d => h('th',{scope:'col'},dayName(d)+' '+d.slice(8))))));
      const tbody = h('tbody');
      residents().forEach(r => {
        const tr = h('tr',null,h('th',{scope:'row'},r.code+' '+r.nick));
        days.forEach(d => {
          const cell = h('td',{class:'mcell'});
          ['b','l','s'].forEach(m => { const x = c.meals.find(y => y.site===S().site && y.res===r.code && y.date===d && y.meal===m);
            const pc = x ? (x.vals.refused ? 'R' : x.vals.pct!=null ? x.vals.pct : '?') : '–';
            cell.append(h('span',{class:'mdot '+(pc==='R'||pc===0||pc===25?'lo':pc===50?'mid':pc==='–'?'none':'ok'),title:mealName(m)+': '+(pc==='R'?'refused':pc==='–'?'not logged':pc+'%')}, pc==='R'?'R':pc==='–'?'–':String(pc))); });
          tr.append(cell);
        });
        tbody.append(tr);
      });
      tb.append(tbody);
      body.append(card('', h('h2',null,'Percent eaten, last 7 days'), h('p',{class:'small muted'},'Each day shows breakfast, lunch and supper. R = refused, – = not logged.'), h('div',{class:'tablewrap',tabindex:'0',role:'region','aria-label':'Scrollable table'},tb),
        h('div',{class:'row'}, h('button',{type:'button',class:'btn ghost sm',onclick:()=>{
          const rows = [['date','meal','resident code','percent eaten','fluids mL','refused','substitute','help needed','note','logged by','form version']];
          c.meals.filter(m => m.site===S().site).sort((a,b)=>a.at<b.at?-1:1).forEach(m => rows.push([m.date, mealName(m.meal), m.res, m.vals.pct==null?'':m.vals.pct, m.vals.fluids||'', m.vals.refused?'yes':'', m.vals.sub||'', m.vals.assist||'', m.vals.note||'', m.by, m.form||1]));
          download('meal-log-'+S().site+'.csv','text/csv',rows.map(r=>r.map(csvCell).join(',')).join('\n'));
        }},'Download meal log (.csv)'), h('span',{class:'small muted'},'Sample data only. Resident codes, no names.'))));
    }
    function drawFlags(){
      const fl = mealFlags(S().site);
      const c = ensure();
      body.append(card('soft', h('p',null,'Flags look for patterns, not mistakes. They go to the house manager and the RN, never to a staff member by name.')));
      if (!fl.length) body.append(card('calm', h('p',null,'No meal or weight patterns right now.')));
      fl.forEach(f => {
        const sent = c.flags.find(x => x.site===S().site && x.res===f.res && x.kind===f.kind && x.date===today());
        body.append(card(f.level==='red'?'alert':'warn', h('div',{class:'meta'}, chip(f.res), chip({refuse:'Refusals',low:'Low intake',weight:'Weight loss',fluids:'Fluids'}[f.kind], f.level==='red'?'red':'amber')),
          h('b',null,f.text), h('p',{class:'small'},f.why),
          sent ? h('p',{class:'small'},'Sent to '+sent.to+' '+fmtTime(sent.at)+(sent.ack?' · seen by '+sent.ack:'')) :
          h('div',{class:'row'}, ['House manager','RN'].map(to => h('button',{type:'button',class:'btn ghost sm',onclick:()=>{ c.flags.push({id:uid(), site:S().site, res:f.res, kind:f.kind, text:f.text, to, at:new Date().toISOString(), date:today()}); save(); toast('Sent to '+to); draw(); }},'Send to '+to)))));
      });
      body.append(helpBox('How flags are set', h('p',{class:'small'},'Weight: a loss of 5% in 30 days or 10% in 6 months, the common screen used in long-term care. Refusals and low intake: house defaults a manager can change on the Report forms screen. They are starting points, not rules.')));
    }
    function drawWeights(){
      const c = ensure();
      const sel = h('select',{'aria-label':'Resident'}, residents().map(r => h('option',{value:r.code},r.code+' '+r.nick)));
      const lb = h('input',{type:'number',step:'0.5',min:'40',max:'500',inputmode:'decimal','aria-label':'Weight in pounds'});
      const list = h('div',{class:'list'});
      function drawList(){ list.textContent=''; const ws = c.weights.filter(w => w.site===S().site && w.res===sel.value).sort((a,b)=>a.date<b.date?1:-1);
        if (!ws.length) list.append(h('p',{class:'muted'},'No weights yet.'));
        ws.forEach(w => list.append(h('div',{class:'item'}, h('div',{class:'meta'},h('span',null,fmtDate(w.date)),h('span',null,w.by)), h('b',null,w.lb+' lb')))); }
      sel.addEventListener('change', drawList);
      body.append(card('', h('h2',null,'Weights'), h('div',{class:'row'}, h('label',{class:'f'},'Resident',sel), h('label',{class:'f'},'Weight (lb)',lb),
        h('button',{type:'button',class:'btn sm',onclick:()=>{ if (!(+lb.value>0)) return toast('Enter a weight'); c.weights.push({site:S().site, res:sel.value, date:today(), lb:+lb.value, by:tier().name+' (you)'}); save(); lb.value=''; toast('Weight saved'); drawList(); }},'Save weight')),
        h('p',{class:'small muted'},'Use the same scale at the same time of day.'), list));
      drawList();
    }
    draw();
  };
  function menuLine(date, meal){
    const dish = dishFor(S().site, date, meal);
    return dish ? h('p',{class:'small'},h('b',null,'On the menu: '),dish.n) : h('p',{class:'small muted'},'No menu planned for this meal.');
  }
  function substituteFor(code, date, meal){
    const dish = dishFor(S().site, date, meal); if (!dish) return null;
    const p = profile(code); const out = [];
    const bad = dish.contains.filter(a => p.allergies.includes(a));
    const subs = (ensure().menu[S().site]||{}).subs||{};
    const subId = subs[keyFor(date, meal)+':'+code];
    if (bad.length) out.push('Allergy: '+dish.n+' has '+bad.map(a=>ALLERGENS[a]).join(', ')+'. Serve '+(subId ? recipe(subId).n : 'the planned substitute')+'.');
    if (p.lowna && dish.tags.includes('salty')) out.push('Low salt: '+dish.n+' is high in sodium. Use the low-sodium version or a substitute.');
    if (p.carb && dish.tags.includes('carb')) out.push('Consistent carb: keep the starch portion steady.');
    if (dish.tags.includes('firm') && /IDDSI [3-6]/.test(p.texture)) out.push('Texture: prepare as '+p.texture+'.');
    return out.join(' ');
  }

  // =====================================================================
  // SHIFT CHANGE REPORT
  // =====================================================================
  function shiftNow(){
    const d = new Date(); const hr = d.getHours();
    // Use the scheduler's shifts when it is installed; otherwise the common 6-to-6 pattern.
    try { if (window.SSSched && SSSched.shiftsAt){
      const list = SSSched.shiftsAt(S().site) || [];
      const nowMin = d.getHours()*60 + d.getMinutes();
      const todays = list.filter(s => s.date === today() && s.staff);
      if (todays.length){ const s = todays.find(x => { const a = toMin(x.start), b = toMin(x.end); return b > a ? nowMin >= a && nowMin < b : nowMin >= a || nowMin < b; }); if (s) return {label:s.start+' to '+s.end, name:(hr>=6&&hr<18?'Day':'Night')}; }
    } } catch(e){}
    return hr >= 6 && hr < 18 ? {label:'6 AM to 6 PM', name:'Day', next:'Night'} : {label:'6 PM to 6 AM', name:'Night', next:'Day'};
  }
  const toMin = s => { const [a,b] = String(s||'0:0').split(':'); return (+a)*60 + (+b||0); };
  function whoIsOn(){
    const sid = S().site; const out = {on:[], next:[]};
    try { if (window.SSTime && SSTime.ensure) out.on = (SSTime.ensure().punches||[]).filter(p => p.site===sid && !p.out).map(p => p.staff); } catch(e){}
    try { if (window.SSSched && SSSched.shiftsAt){ const now = new Date(); const nowMin = now.getHours()*60+now.getMinutes();
      out.next = (SSSched.shiftsAt(sid)||[]).filter(s => s.staff && s.date===today() && toMin(s.start) > nowMin && toMin(s.start) - nowMin < 240).map(s => s.staff+' at '+s.start); } } catch(e){}
    return out;
  }
  function pulledIn(sid, since){
    // what the app already knows about this shift: incident reports, night help logs, meal flags, call-ins, appointments
    const st = S(); const out = [];
    (st.reports||[]).filter(r => r.site===sid && r.at >= since).forEach(r => out.push({kind:'Report', text:(r.type||'Report')+(r.resident?' · '+r.resident:'')+' · '+r.status, res:r.resident}));
    (st.triage||[]).filter(t => t.site===sid && t.at >= since).forEach(t => out.push({kind:'Night help', text:t.note}));
    mealFlags(sid).forEach(f => out.push({kind:'Meal flag', text:f.res+': '+f.text, res:f.res}));
    try { if (window.SSSched && SSSched.ensure){ const sc = SSSched.ensure(); (sc.shifts||[]).filter(s => s.site===sid && s.callin && s.date >= since.slice(0,10)).forEach(s => out.push({kind:'Call-in', text:(s.staff||'Open shift')+' called in for '+s.date+' '+s.start})); (sc.shifts||[]).filter(s => s.site===sid && !s.staff && s.date===today()).forEach(s => out.push({kind:'Open shift', text:'Nobody yet for '+s.start+' to '+s.end+' today'})); } } catch(e){}
    return out;
  }

  R.shift = v => {
    const c = ensure(); const sid = S().site;
    const sh = shiftNow();
    v.append(head('Shift change report · '+site().name, 'Hand off to the next shift', 'A short, structured hand-off. Tap "No change" for anyone who is fine. The next person reads it, asks questions, and confirms they have it.'));
    const waiting = c.handoffs.filter(x => x.site===sid && x.status!=='Accepted').sort((a,b)=>a.at<b.at?1:-1);
    const tabs = h('div',{class:'tabs',role:'tablist'}); const body = h('div',{class:'grid'});
    let cur = param()==='receive' && waiting.length ? 'receive' : waiting.length && S().tier==='caregiver' && param()!=='give' ? 'receive' : (isManager() && param()!=='give' ? 'all' : 'give');
    const T = [['give','Give report'],['receive','Receive report'+(waiting.length?' ('+waiting.length+')':'')],['all','All reports']];
    T.forEach(([id,lab]) => tabs.append(h('button',{role:'tab',type:'button','aria-selected':String(cur===id),onclick:()=>{ cur = id; tabs.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-selected',String(T[i][0]===id))); draw(); }},lab)));
    v.append(tabs, body);
    function draw(){ body.textContent=''; if (cur==='give') give(); else if (cur==='receive') receive(); else all(); }

    function give(){
      const fr = liveFields('handoffRes'), fs = liveFields('handoffShift');
      const since = new Date(Date.now() - 12*3600e3).toISOString().slice(0,19);
      const auto = pulledIn(sid, since);
      const who = whoIsOn();
      const names = staffNames(sid);
      const d = {res:{}, shiftVals:{}, todos:[]};
      let me = ''; try { if (window.SSSched && SSSched.me) me = SSSched.me(); } catch(e){}
      const nextName = (who.next[0]||'').replace(/ at .*$/,'');
      const fromSel = h('select',{'aria-label':'Your name'}, names.map(n => h('option',{selected:n===me},n)));
      const toSel = h('select',{'aria-label':'Who is coming in'}, h('option',{value:''},'Not sure yet'), names.map(n => h('option',{selected:n===nextName},n)));
      body.append(card('', h('div',{class:'meta'}, chip(sh.name+' shift · '+sh.label)),
        who.on.length ? h('p',{class:'small'},h('b',null,'Clocked in now: '),who.on.join(', ')) : null,
        who.next.length ? h('p',{class:'small'},h('b',null,'Coming in: '),who.next.join(', ')) : null,
        h('div',{class:'grid g2'}, h('label',{class:'f'},'Your name',fromSel), h('label',{class:'f'},'Handing off to',toSel))));
      // I: illness severity and what the app already knows
      body.append(card(auto.length ? 'warn' : 'calm', h('h2',null,'Already in the app this shift'),
        auto.length ? h('ul',null, auto.map(a => h('li',null,h('b',null,a.kind+': '),a.text))) : h('p',{class:'small'},'No reports, night calls or flags in the last 12 hours.'),
        h('p',{class:'small muted'},'Pulled in automatically from reports, Night help, meal flags and the schedule, so you don\'t type it twice.')));
      // each resident
      residents().forEach(r => {
        const rd = d.res[r.code] = {vals:{}, orders:{}};
        const box = card('res', h('div',{class:'meta'}, chip(r.code), h('b',null,r.nick+' (sample)')), dietChips(r.code), h('p',{class:'small muted'},r.note), aboutRes(sid, r.code));
        const inner = h('div',{class:'grid'});
        const nc = h('button',{type:'button',class:'btn ghost sm','aria-pressed':'false',onclick:()=>{ const on = nc.getAttribute('aria-pressed')!=='true'; nc.setAttribute('aria-pressed',String(on)); rd.noChange = on; if (on){ rd.vals.status = 'Stable'; inner.hidden = true; } else inner.hidden = false; }},'No change, doing well');
        box.append(h('div',{class:'row'},nc));
        fr.forEach(f => inner.append(field(f, rd.vals[f.id], val => rd.vals[f.id] = val)));
        const meals = c.meals.filter(m => m.site===sid && m.res===r.code && m.at >= since);
        if (meals.length) inner.append(h('p',{class:'small'},h('b',null,'Meals this shift: '), meals.map(m => mealName(m.meal)+' '+(m.vals.refused?'refused':m.vals.pct+'%')).join(', ')));
        trackItems(sid, r.code, 'handoff').forEach(o => {
          const due = o.track.freq !== 'weekly' || !c.weights.some(w => w.site===sid && w.res===r.code && w.date > addDays(today(),-7));
          if (!due) return;
          let pre = o.track.type==='ml' ? (fluidsOn(sid, r.code, today()) || null) : null;
          if (pre != null) rd.orders[o.id] = pre;
          box.append(h('div',{class:'order'}, h('span',{class:'small'},'Order: '+o.text+(o.verifiedBy && o.specialty!=='psych'?' · checked by '+o.verifiedBy:'')), field({label:o.track.label, type:o.track.type, req:true}, pre, val => rd.orders[o.id] = val)));
        });
        const todo = h('input',{type:'text',maxlength:'200',placeholder:'e.g. Offer the shake at breakfast','aria-label':'To-do for the next shift for '+r.code});
        inner.append(h('label',{class:'f'},'Next shift needs to (optional)',todo));
        rd.todoEl = todo;
        box.append(inner);
        body.append(box);
      });
      // whole house
      const hb = card('', h('h2',null,'Whole house'));
      fs.forEach(f => hb.append(field(f, d.shiftVals[f.id], val => d.shiftVals[f.id] = val)));
      const extra = h('textarea',{placeholder:'One per line','aria-label':'Other to-dos for the next shift',style:'min-height:4rem'});
      hb.append(h('label',{class:'f'},'Other to-dos for the next shift', extra));
      body.append(hb);
      const send = h('button',{class:'btn',type:'button',onclick:()=>{
        const miss = [];
        residents().forEach(r => { const rd = d.res[r.code];
          if (!rd.noChange) fr.filter(f => f.req && empty(rd.vals[f.id])).forEach(f => miss.push(r.code+' '+f.label));
          trackItems(sid, r.code, 'handoff').forEach(o => { if (o.track.freq==='weekly' && c.weights.some(w => w.site===sid && w.res===r.code && w.date > addDays(today(),-7))) return; if (empty(rd.orders[o.id])) miss.push(r.code+' '+o.track.label); });
          if (rd.vals.status === 'Changed' && empty(rd.vals.situation)) miss.push(r.code+': say what changed');
        });
        fs.filter(f => (f.req||f.core) && empty(d.shiftVals[f.id])).forEach(f => miss.push(f.label));
        if (miss.length){ toast('Still needed: '+miss.slice(0,4).join(' · ')+(miss.length>4?' and '+(miss.length-4)+' more':'')); return; }
        const todos = [];
        residents().forEach(r => { const t = d.res[r.code].todoEl.value.trim(); if (t) todos.push({id:uid(), text:t, res:r.code}); delete d.res[r.code].todoEl; });
        extra.value.split('\n').map(s=>s.trim()).filter(Boolean).forEach(t => todos.push({id:uid(), text:t, res:''}));
        // weights entered through the handoff also go to the weight log
        residents().forEach(r => trackItems(sid, r.code, 'handoff').filter(o => o.track.type==='lb').forEach(o => { const lb = d.res[r.code].orders[o.id]; if (lb > 0) c.weights.push({site:sid, res:r.code, date:today(), lb, by:fromSel.value}); }));
        c.handoffs.push({id:uid(), site:sid, at:new Date().toISOString(), shift:sh.name+' to '+(sh.next||(sh.name==='Day'?'Night':'Day')), from:fromSel.value, to:toSel.value, status:'Waiting',
          forms:{res:forms().handoffRes.v, shift:forms().handoffShift.v}, fieldsRes:fr.map(f=>({id:f.id,label:f.label,type:f.type})), fieldsShift:fs.map(f=>({id:f.id,label:f.label,type:f.type})),
          res:d.res, shiftVals:d.shiftVals, todos, auto:auto.map(a => a.kind+': '+a.text)});
        save(); toast('Report sent. The next shift confirms it when they read it.'); cur = 'all'; draw();
      }},'Send report to the next shift');
      body.append(h('div',{class:'stickybar'}, send));
      body.append(standardsHelp());
    }

    function receive(){
      const list = c.handoffs.filter(x => x.site===sid && x.status!=='Accepted').sort((a,b)=>a.at<b.at?1:-1);
      if (!list.length){ body.append(card('calm', h('p',null,'Nothing waiting. When the outgoing shift sends a report, it shows here.'))); return; }
      const x = list[0];
      body.append(reportView(x));
      const names = staffNames(sid);
      const me = h('select',{'aria-label':'Your name'}, names.map(n => h('option',{selected:n===x.to},n)));
      const got = {};
      const items = [...x.todos.map(t => ({id:t.id, text:(t.res?t.res+': ':'')+t.text})), ...Object.entries(x.res).filter(([,r]) => r.vals && ['Watch closely','Changed'].includes(r.vals.status)).map(([code, r]) => ({id:'w-'+code, text:code+' is "'+r.vals.status.toLowerCase()+'"'+(r.vals.situation?': '+r.vals.situation:'')}))];
      const ul = h('ul',{class:'tourlist'}, items.map(i => { const id = 'ack-'+i.id; const cb = h('input',{type:'checkbox',id,onchange:()=>got[i.id]=cb.checked}); return h('li',null,cb,h('label',{for:id},i.text)); }));
      const say = h('textarea',{placeholder:'e.g. Watch B-9\'s eating, shake at breakfast, B-2 leaves for the eye doctor at 10.','aria-label':'Say it back in your own words',style:'min-height:4rem'});
      const q = h('input',{type:'text',maxlength:'300','aria-label':'Question for the outgoing shift',placeholder:'Optional'});
      body.append(card('', h('h2',null,'Confirm you have it'),
        h('p',{class:'small muted'},'Tick each item as you read it. This is the "read-back" step that keeps things from getting lost between shifts.'),
        h('label',{class:'f'},'Your name',me), items.length ? ul : h('p',{class:'small'},'No to-dos or residents to watch.'),
        h('label',{class:'f'},'Say it back in a sentence (encouraged)',say), h('label',{class:'f'},'Anything unclear? Ask the outgoing shift',q),
        h('div',{class:'row'}, h('button',{class:'btn',type:'button',onclick:()=>{
          const left = items.filter(i => !got[i.id]);
          if (left.length){ toast('Tick each item first ('+left.length+' left)'); return; }
          x.ack = {by:me.value, at:new Date().toISOString(), readback:say.value.trim(), question:q.value.trim()};
          x.to = me.value; x.status = q.value.trim() ? 'Question' : 'Accepted';
          if (x.status==='Question') x.ack.questionOpen = true;
          save(); toast(x.status==='Accepted' ? 'Hand-off confirmed' : 'Confirmed with a question. The outgoing shift and manager will see it.'); cur='all'; draw();
        }},'I have the report'))));
    }

    function all(){
      const list = c.handoffs.filter(x => x.site===sid).sort((a,b)=>a.at<b.at?1:-1);
      const acc = list.filter(x => x.ack);
      const mins = acc.map(x => (new Date(x.ack.at) - new Date(x.at))/60000).filter(n => n >= 0);
      body.append(h('div',{class:'grid g3'},
        card('', h('div',{class:'stat'},h('b',null,String(list.length)),h('span',null,'reports on file'))),
        card('', h('div',{class:'stat '+(list.some(x=>x.status!=='Accepted')?'warnc':'good')},h('b',null,String(list.filter(x=>x.status!=='Accepted').length)),h('span',null,'waiting or with a question'))),
        card('', h('div',{class:'stat'},h('b',null,mins.length?Math.round(mins.reduce((a,b)=>a+b,0)/mins.length)+' min':'–'),h('span',null,'average time to confirm')))));
      if (!list.length) body.append(card('', h('p',{class:'muted'},'No reports yet.')));
      list.forEach(x => {
        const det = h('details',{class:'card'}, h('summary',null, h('span',{class:'meta'}, chip(x.status, x.status==='Accepted'?'calm':x.status==='Question'?'amber':'grey'), h('span',null,fmtTime(x.at)+' · '+x.shift+' · '+x.from+(x.to?' to '+x.to:'')))), reportView(x, true));
        if (x.status==='Question' && isManager()) det.append(h('button',{type:'button',class:'btn ghost sm',onclick:()=>{ x.status='Accepted'; x.ack.questionOpen=false; x.ack.answered = new Date().toISOString(); save(); draw(); }},'Mark question answered'));
        body.append(det);
      });
    }
    draw();
  };
  // background from the admission intake (SBAR "B"), when that module has filled it in
  function aboutRes(sid, code){
    let p = null; try { p = ((((S().intake||{}).profiles||{})[sid]||{})[code]||{}).handoff; } catch(e){}
    if (!p) return null;
    const line = (l, a) => a && a.length ? h('span',{class:'small'},h('b',null,l+': '),[].concat(a).join('; ')) : null;
    return h('details',{class:'about'}, h('summary',null,'About this resident'), h('div',{class:'grid',style:'gap:.25rem'}, p.summary ? h('span',{class:'small'},p.summary) : null, line('Watch for',p.risks), line('Triggers',p.triggers), line('What helps',p.whatHelps), line('Code status',p.codeStatus)));
  }
  function reportView(x, compact){
    const box = h('div',{class:'grid'});
    if (!compact) box.append(head('From '+x.from+' · '+fmtTime(x.at), x.shift+' hand-off', null));
    if (x.auto && x.auto.length) box.append(h('div',{class:'house'}, h('b',null,'Already in the app'), x.auto.map(a => h('span',{class:'small'},a))));
    const lab = (fs, id) => (fs.find(f=>f.id===id)||{label:id}).label;
    Object.entries(x.res).forEach(([code, r]) => {
      const vals = r.vals||{};
      const st = r.noChange ? 'No change' : vals.status || '';
      const row = h('div',{class:'item'}, h('div',{class:'meta'}, chip(code), st ? chip(st, st==='Changed'?'red':st==='Watch closely'?'amber':'calm') : null));
      Object.entries(vals).filter(([k,val]) => k!=='status' && !empty(val)).forEach(([k,val]) => row.append(h('span',{class:'small'},h('b',null,lab(x.fieldsRes||[],k)+': '),String(val))));
      Object.entries(r.orders||{}).filter(([,val]) => !empty(val)).forEach(([oid,val]) => { const o = ordersFor(x.site, code).find(z=>z.id===oid) || SAMPLE_ORDERS.find(z=>z.id===oid); row.append(h('span',{class:'small'},h('b',null,(o&&o.track?o.track.label:'Order item')+': '),val===true?'Done':String(val))); });
      box.append(row);
    });
    const sv = Object.entries(x.shiftVals||{}).filter(([,val]) => !empty(val));
    if (sv.length) box.append(h('div',{class:'item'}, h('b',null,'Whole house'), sv.map(([k,val]) => h('span',{class:'small'},h('b',null,lab(x.fieldsShift||[],k)+': '),String(val)))));
    if (x.todos.length) box.append(h('div',{class:'item'}, h('b',null,'To-do for the next shift'), h('ul',null,x.todos.map(t => h('li',null,(t.res?t.res+': ':'')+t.text)))));
    if (x.ack) box.append(h('div',{class:'house ok'}, h('b',null,'Confirmed by '+x.ack.by+' · '+fmtTime(x.ack.at)), x.ack.readback ? h('span',{class:'small'},'Said back: '+x.ack.readback) : null, x.ack.question ? h('span',{class:'small'},'Question: '+x.ack.question+(x.ack.questionOpen?' (open)':' (answered)')) : null));
    box.append(h('p',{class:'foot'},'Form version: residents v'+((x.forms||{}).res||1)+', house v'+((x.forms||{}).shift||1)+'. Past reports keep the form they were written on.'));
    return box;
  }
  function standardsHelp(){
    return helpBox('Why the report is built this way (industry standards)',
      h('ul',null,
        h('li',null,h('b',null,'SBAR'),' (Situation, Background, Assessment, Recommendation): the most common hand-off format in nursing and long-term care, spread in health care by Kaiser Permanente and the Institute for Healthcare Improvement. Here: "What is going on", the resident\'s diet and notes, "How are they", and "Next shift needs to".'),
        h('li',null,h('b',null,'I-PASS'),' (Illness severity, Patient summary, Action list, Situation awareness, Synthesis by receiver), backed by AHRQ. A 2014 study in the New England Journal of Medicine found about 23% fewer medical errors after hospitals adopted it. Here: "Stable / Watch closely / Changed", the to-do list, and the incoming person saying it back.'),
        h('li',null,h('b',null,'The Joint Commission, Sentinel Event Alert 58 (2017)'),' asks for a standard format, a hand-off that is interactive with time for questions, few interruptions, and the receiver confirming. Here: the same form every shift, the question box, and the "I have the report" step.')),
      h('p',{class:'small'},'Wisconsin\'s rules for adult family homes (DHS 88) and CBRFs (DHS 83) do not set a hand-off format. They do expect staff to know each resident\'s current needs and to watch for and pass on changes in condition (for example DHS 88.07(2)(b)5, observing and documenting changes). A written, confirmed hand-off is a simple way to show that.'),
      h('p',{class:'foot'},'Checked '+fmtDate(CHECKED)+'. Not legal advice.'));
  }

  // =====================================================================
  // MENU, GROCERY, PANTRY, BUDGET
  // =====================================================================
  const keyFor = (date, meal) => date+':'+meal;
  function cycleWeek(sid, date){ const m = ensure().menu[sid]; if (!m) return null; const weeks = Math.floor((new Date(mondayOf(date)+'T12:00:00') - new Date(m.start+'T12:00:00'))/(7*864e5)); return ((weeks % m.cycle) + m.cycle) % m.cycle + 1; }
  function dishFor(sid, date, meal){ const m = ensure().menu[sid]; if (!m) return null; const w = cycleWeek(sid, date); const dIdx = (new Date(date+'T12:00:00').getDay()+6)%7; const id = ((m.weeks[w]||[])[dIdx]||{})[meal]; return id ? recipe(id) : null; }
  function setDish(sid, w, dIdx, meal, id){ const m = ensure().menu[sid]; m.weeks[w][dIdx][meal] = id; save(); }
  function conflicts(sid, dish){
    const out = [];
    (A.D.RESIDENTS[sid]||[]).forEach(r => { const p = profile(r.code);
      const bad = dish.contains.filter(a => p.allergies.includes(a));
      if (bad.length) out.push({res:r.code, level:'red', text:r.code+' allergy: '+bad.map(a=>ALLERGENS[a]).join(', ')});
      if (p.lowna && dish.tags.includes('salty')) out.push({res:r.code, level:'amber', text:r.code+' low salt'});
      if (dish.tags.includes('firm') && /IDDSI [3-6]/.test(p.texture)) out.push({res:r.code, level:'grey', text:r.code+' texture: '+p.texture.replace('IDDSI ','')});
    });
    return out;
  }

  R.menu = v => {
    const c = ensure(); const sid = S().site; const m = c.menu[sid];
    v.append(head('Kitchen · '+site().name, 'Menu, groceries and food budget', 'Plan a cycle menu that fits each resident\'s diet, post it, and turn it into a grocery list. Sample recipes and prices.'));
    const tabs = h('div',{class:'tabs',role:'tablist'}); const body = h('div',{class:'grid'});
    const T = [['plan','Menu'],['post','Posted menu'],['grocery','Grocery list'],['pantry','Pantry'],['budget','Budget']];
    let cur = param() || 'plan';
    T.forEach(([id,lab]) => tabs.append(h('button',{role:'tab',type:'button','aria-selected':String(cur===id),onclick:()=>{ cur = id; tabs.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-selected',String(T[i][0]===id))); draw(); }},lab)));
    v.append(tabs, body);
    let wk = cycleWeek(sid, today());
    function draw(){ body.textContent=''; ({plan, post, grocery, pantry, budget})[cur](); }
    function weekDates(){ const start = addDays(mondayOf(today()), (wk - cycleWeek(sid, today()))*7); return [0,1,2,3,4,5,6].map(i => addDays(start, i)); }
    function weekPick(){ return h('div',{class:'row'}, h('span',{class:'small muted'},'Cycle week'), seg('Cycle week', [1,2,3,4].map(n=>[n,String(n)]), wk, x => { wk = x; draw(); }), h('span',{class:'small muted'},'Week of '+fmtDate(weekDates()[0]))); }

    function plan(){
      body.append(card('', weekPick(), h('p',{class:'small muted'},'A '+m.cycle+'-week cycle repeats. Change any meal from the recipe list. Allergy and diet conflicts show under each meal, with a substitute picker for the person affected.')));
      const dates = weekDates();
      const grid = h('div',{class:'menugrid'});
      dates.forEach((d, dIdx) => {
        const col = card('day', h('h3',null,dayName(d)+' '+fmtDate(d).replace(/, \d{4}$/,'')));
        MEALS.forEach(([mk, ml]) => {
          const id = m.weeks[wk][dIdx][mk];
          const sel = h('select',{'aria-label':ml+' on '+dayName(d)}, h('option',{value:''},'(none)'), RECIPES.filter(r => r.meal===mk || (mk==='sn' && r.meal==='sn')).concat(RECIPES.filter(r => r.meal!==mk && mk!=='sn' && r.meal!=='sn')).map(r => h('option',{value:r.id,selected:r.id===id},r.n)));
          sel.addEventListener('change', () => { setDish(sid, wk, dIdx, mk, sel.value); draw(); });
          const slot = h('div',{class:'slot'}, h('span',{class:'flab'},ml), sel);
          const dish = id && recipe(id);
          if (dish){
            const cf = conflicts(sid, dish);
            cf.forEach(x => {
              const k = keyFor(d, mk)+':'+x.res;
              if (x.level==='red' || x.level==='amber'){
                const ok = RECIPES.filter(r => (r.meal===mk || r.meal==='sn' || mk==='sn') && !r.contains.some(a => profile(x.res).allergies.includes(a)) && !(profile(x.res).lowna && r.tags.includes('salty')));
                const ss = h('select',{'aria-label':'Substitute for '+x.res}, h('option',{value:''},'Pick a substitute'), ok.map(r => h('option',{value:r.id,selected:m.subs[k]===r.id},r.n)));
                ss.addEventListener('change', () => { if (ss.value) m.subs[k] = ss.value; else delete m.subs[k]; save(); draw(); });
                slot.append(h('div',{class:'conf'}, chip(x.text, m.subs[k]?'calm':x.level), ss));
              } else slot.append(h('div',{class:'conf'}, chip(x.text,'grey')));
            });
          }
          col.append(slot);
        });
        grid.append(col);
      });
      body.append(grid);
      const unfixed = []; dates.forEach((d,dIdx) => MEALS.forEach(([mk]) => { const dish = recipe(m.weeks[wk][dIdx][mk]); if (dish) conflicts(sid, dish).filter(x => x.level==='red' && !m.subs[keyFor(d,mk)+':'+x.res]).forEach(x => unfixed.push(dayName(d)+' '+mealName(mk)+': '+x.text)); }));
      body.append(card(unfixed.length?'alert':'calm', h('b',null, unfixed.length ? unfixed.length+' allergy conflict'+(unfixed.length===1?'':'s')+' this week still need a substitute' : 'Every allergy conflict this week has a substitute'), unfixed.length ? h('ul',{class:'small'}, unfixed.slice(0,8).map(u => h('li',null,u))) : null));
      body.append(card('', h('h2',null,'Diets in this home'), h('div',{class:'list'}, residents().map(r => h('div',{class:'item'}, h('div',{class:'meta'},chip(r.code),h('b',null,r.nick+' (sample)')), dietChips(r.code), profile(r.code).likes ? h('span',{class:'small'},'Likes: '+profile(r.code).likes+(profile(r.code).dislikes?' · Dislikes: '+profile(r.code).dislikes:'')) : null))),
        h('p',{class:'small muted'},'Diets come from each resident\'s profile and any verified diet order. Residents choose what and whether to eat.')));
      body.append(helpBox('What the rules say about menus and food', ...ruleNotes('menu')));
    }

    function post(){
      const dates = weekDates();
      const pk = sid+':'+dates[0];
      const p = c.posted[pk];
      body.append(card('noprint', weekPick(), h('div',{class:'row'},
        h('button',{type:'button',class:'btn sm',onclick:()=>{ c.posted[pk] = {at:new Date().toISOString(), by:tier().name+' (you)', changes:(p&&p.changes)||[]}; save(); toast('Marked as posted'); draw(); }}, p ? 'Posted '+fmtDate(p.at)+'. Mark posted again' : 'Mark this week as posted'),
        h('button',{type:'button',class:'btn ghost sm',onclick:()=>window.print()},'Print menu')),
        h('p',{class:'small muted'},'Post it where residents and visitors can see it. Changes you make after posting are logged below the menu, which is how many homes show "substitutions noted".')));
      const tb = h('table',{class:'t postmenu'}, h('caption',null, site().name+' menu, week of '+fmtDate(dates[0])), h('thead',null,h('tr',null,h('th',{scope:'col'},'Day'), MEALS.map(([,ml]) => h('th',{scope:'col'},ml)))));
      const tbody = h('tbody');
      dates.forEach((d,dIdx) => tbody.append(h('tr',null, h('th',{scope:'row'},dayName(d)+' '+d.slice(5).replace('-','/')), MEALS.map(([mk]) => { const r = recipe(m.weeks[wk][dIdx][mk]); return h('td',null, r ? r.n : '–'); }))));
      tb.append(tbody);
      body.append(card('', h('div',{class:'tablewrap',tabindex:'0',role:'region','aria-label':'Scrollable table'},tb), h('p',{class:'small'},'Other choices are always available. Ask staff. Special diets are prepared as ordered.'),
        p ? h('p',{class:'foot'},'Posted '+fmtTime(p.at)+' by '+p.by) : h('p',{class:'foot'},'Not marked as posted yet.')));
      const log = h('input',{type:'text',maxlength:'200',placeholder:'e.g. Thu supper: chicken instead of pork (delivery late)','aria-label':'Menu change after posting'});
      body.append(card('noprint', h('h3',null,'Changes after posting'), (p&&p.changes&&p.changes.length) ? h('ul',null,p.changes.map(x => h('li',null,fmtDate(x.at)+': '+x.text))) : h('p',{class:'small muted'},'None logged.'),
        h('div',{class:'row'}, log, h('button',{type:'button',class:'btn ghost sm',onclick:()=>{ if (!log.value.trim()) return; c.posted[pk] = c.posted[pk] || {at:new Date().toISOString(), by:tier().name+' (you)', changes:[]}; c.posted[pk].changes.push({at:new Date().toISOString(), text:log.value.trim()}); save(); draw(); }},'Log change'))));
    }

    function needs(){
      // ingredient totals for the week: servings = residents + staff meals, minus pantry on hand
      const b = c.budget[sid]; const servings = residents().length + (b.staffMeals||0);
      const tot = {};
      for (let dIdx = 0; dIdx < 7; dIdx++) MEALS.forEach(([mk]) => {
        const d = weekDates()[dIdx];
        const base = recipe(m.weeks[wk][dIdx][mk]);
        if (!base) return;
        // subs replace the dish for that one person
        const subbed = Object.keys(m.subs).filter(k => k.startsWith(keyFor(d,mk)+':'));
        const add = (r, n) => r.ing.forEach(i => { const k = i.n+'|'+i.u; tot[k] = tot[k] || {n:i.n, u:i.u, cat:i.cat, q:0, cost:0}; tot[k].q += i.q*n; tot[k].cost += i.cost*n; });
        add(base, servings - subbed.length);
        subbed.forEach(k => add(recipe(m.subs[k]), 1));
      });
      // order items that need supplies (shakes)
      return {tot, servings};
    }
    function grocery(){
      const {tot, servings} = needs();
      const pan = c.pantry[sid];
      const rows = Object.values(tot).map(x => { const p = pan.find(y => y.n===x.n && y.u===x.u); const have = p ? p.have : 0; const buy = Math.max(0, x.q - have); return Object.assign({}, x, {have, buy, est: x.q ? x.cost*buy/x.q : 0}); });
      pan.filter(p => p.have < p.min && !rows.some(r => r.n===p.n)).forEach(p => rows.push({n:p.n, u:p.u, cat:p.cat, q:0, have:p.have, buy:p.min-p.have, est:0, low:true}));
      const buy = rows.filter(r => r.buy > 0.01).sort((a,b) => a.cat < b.cat ? -1 : a.cat > b.cat ? 1 : a.n < b.n ? -1 : 1);
      const est = buy.reduce((a,r)=>a+r.est,0);
      c.checked = c.checked || {};
      body.append(card('', weekPick(), h('p',{class:'small'},'For '+servings+' servings a meal ('+residents().length+' residents plus '+(c.budget[sid].staffMeals||0)+' staff), minus what the pantry has.'),
        h('div',{class:'grid g3'}, h('div',{class:'stat'},h('b',null,String(buy.length)),h('span',null,'items to buy')), h('div',{class:'stat'},h('b',null,money0(est)),h('span',null,'estimated cost (sample prices)')), h('div',{class:'stat '+(est > weekBudget(sid)?'warnc':'good')},h('b',null,money0(weekBudget(sid))),h('span',null,'weekly food budget')))));
      let cat = '';
      const list = h('div',{class:'list grocery'});
      buy.forEach(r => {
        if (r.cat !== cat){ cat = r.cat; list.append(h('h3',null,cat)); }
        const id = 'g-'+r.n.replace(/\W/g,'');
        const cb = h('input',{type:'checkbox',id,checked:!!c.checked[sid+r.n],onchange:()=>{ c.checked[sid+r.n] = cb.checked; save(); }});
        list.append(h('div',{class:'checkrow item'}, cb, h('label',{for:id}, h('b',null,r.n), ' ', h('span',{class:'small muted'}, fmtQty(r.buy)+' '+r.u+(r.have?' (have '+fmtQty(r.have)+')':'')+(r.low?' · below pantry minimum':'')+(r.est?' · about '+money(r.est):'')))));
      });
      const text = buy.map(r => '[ ] '+r.n+': '+fmtQty(r.buy)+' '+r.u).join('\n');
      body.append(card('', list.childNodes.length ? list : h('p',{class:'muted'},'The pantry covers this week.'),
        h('div',{class:'row'},
          h('button',{type:'button',class:'btn ghost sm',onclick:e=>copy(site().name+' grocery list\n'+text, e.target)},'Copy list'),
          h('button',{type:'button',class:'btn ghost sm',onclick:()=>download('grocery-list.csv','text/csv',[['category','item','amount','unit','estimated cost']].concat(buy.map(r=>[r.cat,r.n,fmtQty(r.buy),r.u,r.est.toFixed(2)])).map(r=>r.map(csvCell).join(',')).join('\n'))},'Download (.csv)'),
          h('button',{type:'button',class:'btn quiet sm',onclick:()=>{ buy.forEach(r => { const p = pan.find(y => y.n===r.n && y.u===r.u); if (p) p.have += r.buy; else pan.push({id:uid(), n:r.n, have:r.buy, u:r.u, min:0, cat:r.cat}); delete c.checked[sid+r.n]; }); save(); toast('Added to the pantry. Log the receipt on the Budget tab.'); cur='budget'; draw(); }},'Shopping done: add to pantry'))));
    }
    const fmtQty = n => (Math.round(n*4)/4).toString();

    function pantry(){
      const pan = c.pantry[sid];
      const list = h('div',{class:'list'});
      pan.slice().sort((a,b)=>a.cat<b.cat?-1:1).forEach(p => {
        const inp = h('input',{type:'number',min:'0',step:'0.25',value:String(p.have),'aria-label':'On hand: '+p.n,style:'max-width:7rem'});
        inp.addEventListener('change', () => { p.have = Math.max(0, +inp.value||0); save(); draw(); });
        list.append(h('div',{class:'item'}, h('div',{class:'meta'}, chip(p.cat,'grey'), p.have < p.min ? chip('Low','amber') : null), h('div',{class:'row'}, h('b',{style:'flex:1;min-width:10rem'},p.n), inp, h('span',{class:'small muted'},p.u+(p.min?' · keep at least '+p.min:'')))));
      });
      const n = h('input',{type:'text',placeholder:'Item','aria-label':'New pantry item'}); const q = h('input',{type:'number',min:'0',placeholder:'On hand','aria-label':'Amount on hand'}); const u = h('input',{type:'text',placeholder:'Unit','aria-label':'Unit'});
      body.append(card('', h('h2',null,'Pantry and supplies on hand'), h('p',{class:'small muted'},'Count what you have. The grocery list subtracts it, and anything under its minimum is added.'), list,
        h('div',{class:'grid g3'}, n, q, u), h('div',{class:'row'},h('button',{type:'button',class:'btn ghost sm',onclick:()=>{ if(!n.value.trim()) return; pan.push({id:uid(), n:n.value.trim(), have:+q.value||0, u:u.value.trim()||'each', min:0, cat:'Other'}); save(); draw(); }},'Add item'))));
      body.append(helpBox('Emergency food and water', h('p',{class:'small'},'Many homes keep a few days of food and water that do not need cooking or power, as part of their emergency plan. Wisconsin CBRFs must have an emergency plan (DHS 83), and so must adult family homes (DHS 88). Ask your licensing specialist what amount your home\'s plan should list.'), h('p',{class:'foot'},'Best reading, being verified. Not legal advice.')));
    }

    function budget(){
      const b = c.budget[sid];
      const spend = c.spend.filter(s => s.site===sid);
      const per = h('input',{type:'number',min:'0',step:'0.25',value:String(b.perDay),'aria-label':'Food budget per resident per day'});
      const staff = h('input',{type:'number',min:'0',step:'1',value:String(b.staffMeals||0),'aria-label':'Staff meals per meal'});
      per.addEventListener('change',()=>{ b.perDay = +per.value||0; save(); draw(); }); staff.addEventListener('change',()=>{ b.staffMeals = +staff.value||0; save(); draw(); });
      const t = today(); const mStart = t.slice(0,8)+'01';
      const monthSpend = spend.filter(s => s.date >= mStart).reduce((a,s)=>a+s.amt,0);
      const daysIn = new Date(+t.slice(0,4), +t.slice(5,7), 0).getDate(); const dayNo = +t.slice(8);
      const monthBudget = b.perDay * residents().length * daysIn;
      const pace = dayNo ? monthSpend / dayNo * daysIn : 0;
      const residentDays = residents().length * dayNo;
      body.append(h('div',{class:'grid g4'},
        card('', h('div',{class:'stat'},h('b',null,money0(monthSpend)),h('span',null,'spent this month'))),
        card('', h('div',{class:'stat'},h('b',null,money0(monthBudget)),h('span',null,'monthly budget'))),
        card('', h('div',{class:'stat '+(pace>monthBudget?'warnc':'good')},h('b',null,money0(pace)),h('span',null,'on pace for this month'))),
        card('', h('div',{class:'stat'},h('b',null,residentDays?money(monthSpend/residentDays):'–'),h('span',null,'per resident per day')))));
      // weekly bars
      const weeks = []; for (let w = 7; w >= 0; w--){ const s = addDays(mondayOf(t), -w*7); const e = addDays(s, 6); weeks.push({s, amt: spend.filter(x => x.date >= s && x.date <= e).reduce((a,x)=>a+x.amt,0)}); }
      const wb = weekBudget(sid); const max = Math.max(wb, ...weeks.map(w=>w.amt)) || 1;
      body.append(card('', h('h2',null,'Weekly spend'), h('p',{class:'small muted'},'Bars are spending each week. The line marks the weekly budget ('+money0(wb)+').'),
        h('div',{class:'bars',role:'img','aria-label':'Weekly food spending for the last 8 weeks against a budget of '+money0(wb)+': '+weeks.map(w=>'week of '+fmtDate(w.s)+' '+money0(w.amt)).join(', ')},
          h('div',{class:'bline',style:'bottom:'+(wb/max*100)+'%'}),
          weeks.map(w => h('div',{class:'bcol'}, h('span',{class:'bval'},money0(w.amt)), h('i',{class:w.amt>wb?'over':'',style:'height:'+(w.amt/max*100)+'%'}), h('span',{class:'blab'},w.s.slice(5).replace('-','/'))))),
        h('div',{class:'grid g2'}, h('label',{class:'f'},'Budget per resident per day ($)',per), h('label',{class:'f'},'Staff meals per meal',staff)),
        h('p',{class:'small muted'},'Sample starting point. USDA food plans put a moderate budget for an older adult at roughly $9 to $11 a day (check the current USDA Food Plans: Cost of Food report).')));
      // log a receipt
      const amt = h('input',{type:'number',min:'0',step:'0.01',inputmode:'decimal','aria-label':'Amount'}); const store = h('input',{type:'text',maxlength:'60','aria-label':'Store',placeholder:'Store'});
      const cat = h('select',{'aria-label':'Category'}, ['Groceries','Supplements','Special diet items','Paper and kitchen supplies'].map(x=>h('option',null,x)));
      const dt = h('input',{type:'date',value:t,max:t,'aria-label':'Date'});
      body.append(card('', h('h2',null,'Log a receipt'), h('div',{class:'grid g4'}, h('label',{class:'f'},'Amount ($)',amt), h('label',{class:'f'},'Store',store), h('label',{class:'f'},'Category',cat), h('label',{class:'f'},'Date',dt)),
        h('div',{class:'row'}, h('button',{type:'button',class:'btn sm',onclick:()=>{ if (!(+amt.value>0)) return toast('Enter the amount'); c.spend.push({id:uid(), site:sid, date:dt.value||t, store:store.value.trim()||'Store', amt:+amt.value, cat:cat.value, note:''}); save(); toast('Receipt logged'); draw(); }},'Save receipt'), h('span',{class:'small muted'},'Feeds the owner\'s money view.')),
        h('div',{class:'list'}, spend.slice().sort((a,b)=>a.date<b.date?1:-1).slice(0,8).map(s => h('div',{class:'item'}, h('div',{class:'meta'},h('span',null,fmtDate(s.date)),chip(s.cat,'grey')), h('span',null,h('b',null,money(s.amt)),' · '+s.store))))));
    }
    draw();
  };
  function weekBudget(sid){ const c = ensure(); const b = c.budget[sid]; return b.perDay * (A.D.RESIDENTS[sid]||[]).length * 7; }

  // ---------- rule notes ----------
  function ruleNotes(kind){
    const cbrf = setting()==='cbrf';
    const L = (lbl, cls) => h('span',{class:'chip '+cls},lbl);
    const afh = [
      h('div',{class:'house ok'}, h('div',{class:'chips'},L('Rule says','calm'),L('AFH','grey')), h('span',{class:'small'},'Give each resident enough variety and amount of food to meet their nutritional needs and preferences, 3 nutritious meals a day and snacks typical in a family setting, prepared and stored in a sanitary way. Serve meals in the common dining area with the household. Take special physical and religious dietary needs into account, and serve a special diet when the resident\'s physician prescribes one.'), h('span',{class:'foot'},'DHS 88.07(4)(a) to (e)')),
      h('div',{class:'house ok'}, h('div',{class:'chips'},L('Rule says','calm'),L('AFH','grey')), h('span',{class:'small'},'Watch for and write down changes in a resident\'s health, and refer when needed. Respect choices: a resident may refuse, and preferences are part of care.'), h('span',{class:'foot'},'DHS 88.07(1)(b), 88.07(2)(b)5, 88.10(3)(e) and (j)')),
      h('div',{class:'house'}, h('div',{class:'chips'},L('Not in the rule','grey')), h('span',{class:'small'},'DHS 88 does not require a posted menu, a cycle menu or meal-by-meal intake logs. Homes use them anyway because they show the "nutritious meals" and "special diet" rules are being met, and they catch weight loss early.'))
    ];
    const cb = [
      h('div',{class:'house gap'}, h('div',{class:'chips'},L('Best reading','amber'),L('CBRF','grey')), h('span',{class:'small'},'DHS 83.41 (food service) sets the CBRF food rules: meals that meet residents\' nutritional needs, menus planned ahead and posted, substitutions noted, therapeutic or modified diets only as ordered by a physician (with dietitian input where needed), safe food storage, and a supply of food on hand. Check the exact wording for advance planning, posting and how long menus are kept before you set your policy.'), h('span',{class:'foot'},'DHS 83.41 · We could not reach the state code site to re-read this section on '+fmtDate(CHECKED)+'. Being verified.')),
      h('div',{class:'house ok'}, h('div',{class:'chips'},L('Rule says','calm'),L('Both','grey')), h('span',{class:'small'},'Residents have the right to make choices about their care and daily life, including food, unless a limit is in the person\'s plan with consent (the HCBS settings rule).'), h('span',{class:'foot'},'HCBS Settings Rule; see Clarity Card C09'))
    ];
    const base = cbrf ? cb.concat(afh.slice(2)) : afh;
    if (kind === 'meal') base.push(h('p',{class:'small'},'Intake, refusals and weights are the facts a nurse or doctor needs when someone stops eating. Log what you saw, not why you think it happened. A refusal is the resident\'s right: offer, offer a substitute, write it down, and tell the manager if it keeps happening.'));
    if (kind === 'menu') base.push(h('p',{class:'small'},'Textures and drink thickness use IDDSI levels (International Dysphagia Diet Standardisation Initiative), the standard most speech therapists now use.'));
    base.push(h('p',{class:'foot'},'Checked '+fmtDate(CHECKED)+'. Not legal advice.'));
    return base;
  }

  // =====================================================================
  // REPORT FORMS (form builder, per home, versioned)
  // =====================================================================
  R.forms = v => {
    ensure();
    v.append(head('Settings · '+site().name, 'Report forms', 'Choose what staff fill in on the meal log and the shift change report. Turn fields on or off, make them required, rename them, change the order, or add your own. Each save makes a new version, and past reports keep the version they were written on.'));
    if (!isManager()) v.append(card('warn', h('p',null,'Managers and owners change report forms. You can look, but your changes here are only a preview.')));
    const fm = forms(); const c = ensure();
    Object.keys(FORM_DEFS).forEach(k => {
      const f = fm[k];
      const work = JSON.parse(JSON.stringify(f.fields));
      const box = card('', h('h2',null,FORM_DEFS[k].name), h('p',{class:'small muted'},'Version '+f.v+' · saved '+fmtDate(f.at)+' by '+f.by));
      const list = h('ol',{class:'formlist'});
      function drawList(){
        list.textContent = '';
        work.forEach((x, i) => {
          const lbl = h('input',{type:'text',value:x.label,maxlength:'80','aria-label':'Field name'}); lbl.addEventListener('input',()=>x.label = lbl.value);
          const on = h('input',{type:'checkbox',checked:x.on,disabled:!!x.core,id:'on'+k+i}); on.addEventListener('change',()=>x.on = on.checked);
          const rq = h('input',{type:'checkbox',checked:!!x.req,id:'rq'+k+i}); rq.addEventListener('change',()=>x.req = rq.checked);
          list.append(h('li',{class:'item'},
            h('div',{class:'meta'}, chip(typeLabel(x.type),'grey'), x.core ? chip('Standard, always on') : null, x.custom ? chip('Added by your home','calm') : null),
            lbl,
            h('div',{class:'row'},
              h('label',{class:'checkrow',for:'on'+k+i}, on, 'Show'), h('label',{class:'checkrow',for:'rq'+k+i}, rq, 'Required'),
              h('button',{type:'button',class:'btn quiet sm','aria-label':'Move '+x.label+' up',disabled:i===0,onclick:()=>{ work.splice(i-1,0,work.splice(i,1)[0]); drawList(); }},'↑ Up'),
              h('button',{type:'button',class:'btn quiet sm','aria-label':'Move '+x.label+' down',disabled:i===work.length-1,onclick:()=>{ work.splice(i+1,0,work.splice(i,1)[0]); drawList(); }},'↓ Down'),
              x.custom ? h('button',{type:'button',class:'btn quiet sm',onclick:()=>{ work.splice(i,1); drawList(); }},'Remove') : null)));
        });
      }
      drawList();
      const nl = h('input',{type:'text',maxlength:'80',placeholder:'e.g. Dentures in?','aria-label':'New field name'});
      const nt = h('select',{'aria-label':'New field type'}, [['yesno','Yes or no'],['text','Short note'],['number','Number'],['check','Checkbox'],['ml','Fluids (mL)'],['choice','Pick one']].map(([v2,l]) => h('option',{value:v2},l)));
      const no = h('input',{type:'text',placeholder:'Choices, separated by commas','aria-label':'Choices',hidden:true});
      nt.addEventListener('change',()=>no.hidden = nt.value!=='choice');
      box.append(list, h('div',{class:'grid g3'}, nl, nt, no), h('div',{class:'row'},
        h('button',{type:'button',class:'btn ghost sm',onclick:()=>{ if (!nl.value.trim()) return toast('Name the field'); work.push({id:'x'+uid(), label:nl.value.trim(), type:nt.value, options:nt.value==='choice'?no.value.split(',').map(s=>s.trim()).filter(Boolean):undefined, on:true, custom:true}); nl.value=''; drawList(); }},'Add field'),
        h('button',{type:'button',class:'btn sm',onclick:()=>{
          if (!isManager()) return toast('Switch "View as" to a manager or owner to save');
          c.formHist.push({site:S().site, form:k, v:f.v, at:f.at, by:f.by, fields:f.fields});
          fm[k] = {v:f.v+1, at:new Date().toISOString(), by:tier().name+' (you)', fields:work};
          save(); toast('Saved as version '+(f.v+1)); A.route();
        }},'Save as version '+(f.v+1)),
        ['owner','multi'].includes(S().tier) ? h('button',{type:'button',class:'btn quiet sm',onclick:()=>{
          c.forms = c.forms || {};
          ['maple','birch','cedar'].filter(x => x !== S().site).forEach(sid => { const cf = c.forms[sid] = c.forms[sid] || {}; const old = cf[k]; if (old) c.formHist.push({site:sid, form:k, v:old.v, at:old.at, by:old.by, fields:old.fields}); cf[k] = {v:(old?old.v:1)+1, at:new Date().toISOString(), by:tier().name+' (you), copied from '+site().name, fields:JSON.parse(JSON.stringify(work))}; });
          save(); toast('Copied to your other homes');
        }},'Copy to all my homes') : null));
      const hist = c.formHist.filter(x => x.site===S().site && x.form===k);
      if (hist.length) box.append(h('details',null, h('summary',null,'Earlier versions ('+hist.length+')'), h('ul',{class:'small'}, hist.slice().reverse().map(x => h('li',null,'v'+x.v+' · '+fmtDate(x.at)+' · '+x.by+': '+x.fields.filter(z=>z.on).map(z=>z.label).join(', '))))));
      v.append(box);
    });
    // thresholds
    const th = thresholds(); const st = c.settings[S().site] = c.settings[S().site] || {};
    const num = (k, lbl) => { const i = h('input',{type:'number',min:'0',value:String(th[k])}); i.addEventListener('change',()=>{ st[k] = +i.value; save(); }); return h('label',{class:'f'},lbl,i); };
    v.append(card('', h('h2',null,'Meal flag settings'), h('p',{class:'small muted'},'When a pattern is flagged for the manager or RN. Ask your RN before changing the weight screen.'),
      h('div',{class:'grid g3'}, num('refuse','Refusals in 7 days'), num('lowPct','Low intake: average under (%)'), num('lowDays','Low intake: over how many days'), num('wt30','Weight loss in 30 days (%)'), num('wt180','Weight loss in 180 days (%)'), num('fluidGoal','Default fluid goal (mL a day)'))));
    // orders from doctors and nurses
    const ords = residents().map(r => [r, ordersFor(S().site, r.code).filter(o => o.track)]).filter(x => x[1].length);
    const pend = pendingOrders(S().site);
    v.append(card('soft', h('h2',null,'Items added by doctor and nurse orders'),
      h('p',{class:'small'},'A verified order with something to track (fluids every shift, weigh weekly, check skin) adds a required item for that one resident on the meal log or the shift change report, for as long as the order runs. Orders are entered and checked by the RN on the orders screen.'),
      ords.length ? h('div',{class:'list'}, ords.map(([r, os]) => os.map(o => h('div',{class:'item'}, h('div',{class:'meta'},chip(r.code), chip(o.track.freq,'grey'), chip((o.track.where||[]).map(w=>w==='meal'?'Meal log':'Shift report').join(' + '),'grey')),
        h('b',null,o.text), (o.specialty==='psych' && S().tier==='caregiver') ? null : h('span',{class:'small muted'},'From '+(o.prescriber||'–')+' · entered by '+(o.enteredBy||'–')+(o.enteredAt?' '+fmtDate(o.enteredAt):'')+' · '+(o.start?'starts '+fmtDate(o.start):'')+(o.end?', stops '+fmtDate(o.end):', no stop date')+' · RN check: '+(o.verifiedBy?o.verifiedBy+' '+fmtDate(o.verifiedAt):'pending')))))) : h('p',{class:'small muted'},'No active orders with tracking items in this home.'),
      pend.length ? h('p',{class:'small'},pend.length+' order'+(pend.length===1?' is':'s are')+' waiting for the RN to check. They will appear on forms once verified.') : null,
      VIEWS.orders ? h('a',{href:'#/orders'},'Open orders') : h('p',{class:'foot'},'Sample orders shown until the orders screen is installed.')));
  };
  const typeLabel = t => ({pct:'Percent eaten',ml:'Fluids (mL)',lb:'Weight (lb)',check:'Checkbox',yesno:'Yes or no',choice:'Pick one',text:'Short note',number:'Number'})[t] || t;

  // ---------- route param helper ----------
  function param(){ const m = (location.hash||'').match(/^#\/[a-z]+\/(.+)/); return m ? decodeURIComponent(m[1]) : ''; }

  // ---------- register views, nav, home tiles, owner card ----------
  VIEWS.meals = {t:'Meals', ic:'🍽️'};
  VIEWS.shift = {t:'Shift change report', ic:'🔁'};
  VIEWS.menu = {t:'Menu and groceries', ic:'🛒'};
  VIEWS.forms = {t:'Report forms', ic:'🧩'};
  const addNav = (t, ids, after) => { const n = NAV[t]; if (!n) return; const at = after && n.indexOf(after) >= 0 ? n.indexOf(after)+1 : n.length; n.splice(at, 0, ...ids.filter(x => !n.includes(x))); };
  addNav('caregiver', ['shift','meals'], 'home');
  addNav('manager', ['shift','meals','menu'], 'questions'); addNav('manager', ['forms']);
  addNav('rn', ['meals','shift'], 'delegations'); addNav('rn', ['forms']);
  addNav('owner', ['menu','forms'], 'owner');
  addNav('multi', ['forms'], 'owner');
  addNav('family', ['meals','menu'], 'home');
  if (window.SSAccess && typeof SSAccess.register === 'function'){
    try {
      SSAccess.register({id:'meals', name:'Meal documenting', ic:'🍽️', what:'Per-resident intake, fluids, refusals, substitutions, weights and pattern flags.', views:['meals'], tiers:['caregiver','manager','rn','owner','family']});
      SSAccess.register({id:'shift', name:'Shift change report', ic:'🔁', what:'Structured hand-off (SBAR / I-PASS) with read-back and manager view.', views:['shift'], tiers:['caregiver','manager','rn','owner']});
      SSAccess.register({id:'menu', name:'Menu and groceries', ic:'🛒', what:'Cycle menu with diet checks, posted menu, grocery list, pantry and food budget.', views:['menu'], tiers:['manager','owner','multi','family']});
      SSAccess.register({id:'forms', name:'Report forms', ic:'🧩', what:'Customize meal and hand-off report fields per home, with versions.', views:['forms'], tiers:['manager','rn','owner','multi']});
    } catch(e){ console.error(e); }
  }
  const viewOn = id => { try { return !window.SSAccess || !SSAccess.viewOn || SSAccess.viewOn(id); } catch(e){ return true; } };

  A.homeHooks.push((v, t) => {
    const c = ensure(); const sid = S().site;
    if (sid === 'family') return;
    const waiting = c.handoffs.filter(x => x.site===sid && x.status!=='Accepted');
    const fl = mealFlags(sid);
    const tiles = [];
    if (t === 'caregiver'){
      if (viewOn('shift')) tiles.push(A.tile('shift'+(waiting.length?'/receive':''),'🔁', waiting.length ? 'Read the shift report ('+waiting.length+')' : 'Shift change report', waiting.length ? 'The last shift left you a report. Read it and confirm.' : 'Hand off to the next shift in a few taps.', waiting.length ? 'urgent' : ''));
      if (viewOn('meals')) tiles.push(A.tile('meals','🍽️','Log a meal','Tap how much each person ate. Diets and allergies shown.'));
    }
    if (t === 'manager' || t === 'rn'){
      if (viewOn('meals')) tiles.push(A.tile('meals/flags','🍽️','Meal flags ('+fl.length+')', fl.length ? fl.slice(0,2).map(f => f.res+': '+f.text).join(' · ') : 'No meal or weight patterns right now.', fl.some(f=>f.level==='red') ? 'urgent' : ''));
      if (viewOn('shift')) tiles.push(A.tile('shift','🔁','Shift reports', waiting.length ? waiting.length+' not yet confirmed by the next shift' : 'Every hand-off confirmed.'));
      if (t === 'manager' && viewOn('menu')) tiles.push(A.tile('menu','🛒','Menu and groceries','This week\'s menu, grocery list and food budget.'));
    }
    if (tiles.length) v.append(h('div',{class:'grid g2'}, tiles));
  });

  A.ownerHooks.push(v => {
    if (!viewOn('menu')) return;
    const c = ensure(); const sid = S().site; if (!c.budget[sid]) return;
    const t = today(); const mStart = t.slice(0,8)+'01';
    const spend = c.spend.filter(s => s.site===sid && s.date >= mStart).reduce((a,s)=>a+s.amt,0);
    const daysIn = new Date(+t.slice(0,4), +t.slice(5,7), 0).getDate(); const dayNo = +t.slice(8);
    const n = (A.D.RESIDENTS[sid]||[]).length; const bud = c.budget[sid].perDay * n * daysIn; const pace = dayNo ? spend/dayNo*daysIn : 0;
    const fl = mealFlags(sid); const ho = c.handoffs.filter(x => x.site===sid); const conf = ho.filter(x => x.ack).length;
    v.append(h('div',{class:'grid g2'},
      card('', h('h2',null,'Food spending'), h('div',{class:'grid g3'},
        h('div',{class:'stat'},h('b',null,money0(spend)),h('span',null,'spent this month')),
        h('div',{class:'stat '+(pace>bud?'warnc':'good')},h('b',null,money0(pace)),h('span',null,'on pace vs '+money0(bud)+' budget')),
        h('div',{class:'stat'},h('b',null,dayNo&&n?money(spend/(dayNo*n)):'–'),h('span',null,'per resident per day'))),
        h('p',{class:'small muted'},'From receipts logged on the Budget tab. Sample data.'), h('a',{href:'#/menu/budget'},'Open the food budget')),
      card('', h('h2',null,'Care signals'), h('ul',null, h('li',null,fl.length+' meal or weight pattern'+(fl.length===1?'':'s')+' flagged for the manager or RN'), h('li',null,conf+' of '+ho.length+' shift reports confirmed by the next shift')), h('p',{class:'small muted'},'Counts only. No resident or staff names on the owner view.'))));
  });
})();
