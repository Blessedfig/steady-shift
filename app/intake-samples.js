// Steady Shift test app: admission intake sample packet.
// EVERYTHING HERE IS FICTIONAL. "Dot Sample" is a made-up resident; every provider, court and plan is invented.
// No real resident, staff, provider or facility information belongs in this file.
window.SS_INTAKE_SAMPLES = (function(){
  const FHIR = {
    resourceType:'Bundle', type:'collection', meta:{tag:[{display:'SAMPLE - FICTIONAL'}]},
    entry:[
      {resource:{resourceType:'Patient', id:'p1', name:[{text:'Dot Sample'}], gender:'female', birthDate:'1942-03-14', communication:[{language:{text:'English'}}]}},
      {resource:{resourceType:'Condition', code:{text:'Closed fracture of left hip, repaired (ORIF)'}, onsetDateTime:'2026-11-18'}},
      {resource:{resourceType:'Condition', code:{text:'Atrial fibrillation'}}},
      {resource:{resourceType:'Condition', code:{text:'Type 2 diabetes'}}},
      {resource:{resourceType:'Condition', code:{text:'Alzheimer\'s dementia, moderate'}}},
      {resource:{resourceType:'MedicationRequest', status:'active', medicationCodeableConcept:{text:'Metoprolol tartrate 25 mg'}, dosageInstruction:[{text:'twice daily'}], requester:{display:'Dr. Lee Sample'}}},
      {resource:{resourceType:'MedicationRequest', status:'active', medicationCodeableConcept:{text:'Apixaban 5 mg'}, dosageInstruction:[{text:'twice daily'}], requester:{display:'Dr. Kim Sample'}, authoredOn:'2026-06-02'}},
      {resource:{resourceType:'MedicationRequest', status:'active', medicationCodeableConcept:{text:'Metformin 500 mg'}, dosageInstruction:[{text:'twice daily with meals'}], requester:{display:'Dr. Lee Sample'}}},
      {resource:{resourceType:'AllergyIntolerance', code:{text:'Penicillin'}, reaction:[{manifestation:[{text:'Hives'}]}]}},
      {resource:{resourceType:'NutritionOrder', oralDiet:{type:[{text:'Consistent carbohydrate'}], texture:[{modifier:{text:'IDDSI Level 5 Minced & moist'}}], fluidConsistencyType:[{text:'IDDSI Level 0 Thin'}]}}},
      {resource:{resourceType:'CareTeam', participant:[
        {role:[{text:'Primary care'}], member:{display:'Dr. Lee Sample, Internal Medicine (Sample Clinic)'}},
        {role:[{text:'Cardiology'}], member:{display:'Dr. Kim Sample (Sample Heart Center)'}},
        {role:[{text:'Orthopedics'}], member:{display:'Dr. Pat Sample (Sample Regional Hospital)'}}]}},
      {resource:{resourceType:'Appointment', status:'booked', serviceType:[{text:'Orthopedics'}], description:'Wound check and staple removal', start:'2026-12-04T10:30:00-06:00'}},
      {resource:{resourceType:'Appointment', status:'booked', serviceType:[{text:'Cardiology'}], description:'Atrial fibrillation follow-up', start:'2026-12-08T14:00:00-06:00'}}
    ]
  };

  const CCDA = `<?xml version="1.0"?>
<ClinicalDocument xmlns="urn:hl7-org:v3">
  <title>Continuity of Care Document (SAMPLE - FICTIONAL)</title>
  <recordTarget><patientRole><patient><name><given>Dot</given><family>Sample</family></name><birthTime value="19420314"/></patient></patientRole></recordTarget>
  <component><structuredBody>
    <component><section><code code="11450-4" displayName="Problems"/><title>Problems</title><text><table><tbody>
      <tr><td>Hypertension</td><td>Active</td></tr>
      <tr><td>Atrial fibrillation</td><td>Active</td></tr>
      <tr><td>Type 2 diabetes</td><td>Active</td></tr>
    </tbody></table></text></section></component>
    <component><section><code code="10160-0" displayName="Medications"/><title>Medications</title><text><table><tbody>
      <tr><td>Metoprolol succinate ER 50 mg</td><td>once daily</td></tr>
      <tr><td>Apixaban 5 mg</td><td>twice daily</td></tr>
      <tr><td>Donepezil 10 mg</td><td>at bedtime</td></tr>
    </tbody></table></text></section></component>
    <component><section><code code="48765-2" displayName="Allergies"/><title>Allergies</title><text><table><tbody>
      <tr><td>Penicillin</td><td>Hives</td></tr>
    </tbody></table></text></section></component>
  </structuredBody></component>
</ClinicalDocument>`;

  // kind: pdf | scan | photo | word | ccda | fhir | text. types: what the document counts as on the admission checklist.
  const DOCS = [
    {id:'dc', name:'Hospital discharge summary.pdf', kind:'pdf', from:'Sample Regional Hospital', date:'2026-11-27', types:['discharge','orders','physician'], pages:[
      'SAMPLE - FICTIONAL RECORD\nPatient: Dot Sample   DOB: 03/14/1942   Sex: F\nAdmitted 11/18/2026   Discharged 11/27/2026\nReason for stay: Fall at previous home with left hip fracture, repaired 11/19 (ORIF). Delirium during stay, improving.\nDiagnoses: Left hip fracture s/p ORIF; Alzheimer\'s dementia, moderate; Atrial fibrillation; Type 2 diabetes; Dysphagia (mild).\nAllergies: Penicillin (hives).',
      'Discharge medications:\n- Metoprolol tartrate 25 mg twice daily\n- Apixaban 2.5 mg twice daily\n- Metformin 500 mg twice daily with meals\n- Acetaminophen 650 mg every 6 hours as needed for pain (max 3 g/day)\n- Donepezil 10 mg at bedtime\nSTOP: Lorazepam (caused confusion)\nCode status: DNR (POLST on chart)',
      'Activity: Weight bearing as tolerated. Walker with 1 assist. High fall risk.\nDiet: Consistent carbohydrate, IDDSI Level 5 Minced & moist, thin liquids per speech therapy.\nMonitoring: Blood sugar before breakfast and supper. Check heels and hips for skin breakdown every shift. Weigh weekly.\nFollow-up: Orthopedics 12/04/2026 (staple removal). Primary care within 7 days. Cardiology 12/08/2026.\nHome health physical therapy 3 times a week for 4 weeks (Sample Home Health).\nSigned: Hospitalist (sample), MD'
    ]},
    {id:'face', name:'Previous home face sheet and MAR (scan).pdf', kind:'scan', from:'Previous adult family home (sample)', date:'2026-11-01', types:['facesheet','mar','contacts'], pages:[
      'FACE SHEET (SAMPLE)\nResident: Dot S.   DOB 3/14/42\nAllergies: NKDA\nCode status: Full code\nHealth care POA: Daughter, Ann Sample (activated 2025)\nPhysician: Dr. Lee Sample, Internal Medicine\nPharmacy: Sample Pharmacy\nDiet: Regular, diabetic\nMobility: Walker, independent\nNotes: Likes word puzzles and gospel music. Gets upset when rushed in the morning. Asks for her late husband around 4 PM.',
      'MAR, November 2026 (SAMPLE)\nMetoprolol succinate ER 50 mg once daily (8 AM)\nApixaban 5 mg twice daily\nMetformin 500 mg twice daily with meals\nDonepezil 10 mg at bedtime\nLorazepam 0.5 mg as needed for anxiety'
    ]},
    {id:'mco', name:'Member-centered plan.docx', kind:'word', from:'Family Care MCO (sample)', date:'2026-10-15', types:['mcoplan'], pages:[
      'MEMBER-CENTERED PLAN (SAMPLE)\nMember: Dot Sample.\nCare manager: Care manager (sample), phone 715-555-0123, fax 715-555-0133, care.manager3@mco.example\nNurse manager: Nurse manager (sample), RN, phone 715-555-0173, fax 715-555-0133, nurse.manager3@mco.example\nOutcomes: Stay safe from falls. Keep going to church on Sundays. Stay close to her daughter.\nAuthorized services: Residential care (AFH), home health PT, rides to appointments.\nRights restrictions (HCBS settings rule): none approved.\nBehaviors: Tried to leave once in October 2026 near sundown. What helps: walking with her, gospel music, offering a call to her daughter.'
    ]},
    {id:'guard', name:'Guardianship letters (photo).jpg', kind:'photo', from:'Sample County Circuit Court', date:'2026-10-30', types:['guardian'], pages:[
      'LETTERS OF GUARDIANSHIP OF THE PERSON (SAMPLE)\nWard: Dot Sample\nGuardian: Robert Sample (son)\nOrdered 10/30/2026, Sample County Circuit Court.\nThe guardian has authority over health care and where she lives.'
    ]},
    {id:'polst', name:'POLST form (photo).jpg', kind:'photo', from:'Sample Regional Hospital', date:'2026-11-25', types:['directive'], pages:[
      'WISCONSIN POLST (SAMPLE)\nSection A: Do Not Attempt Resuscitation (DNR)\nSection B: Limited interventions\nSigned 11/25/2026 by the physician and by the guardian, Robert Sample.'
    ]},
    {id:'psych', name:'Psychiatry visit note.pdf', kind:'pdf', from:'Sample Behavioral Health', date:'2026-11-10', sensitive:'Mental health record (Wis. Stat. 51.30)', types:['psych'], pages:[
      'PSYCHIATRY FOLLOW-UP (SAMPLE). Restricted: mental health record.\nAssessment: Behavioral symptoms of dementia. Mild depression.\nPlan: Start sertraline 25 mg once daily. Avoid benzodiazepines. Non-drug first: same routine, music, unhurried mornings.\nNext visit: 01/12/2027 (video visit OK).'
    ]},
    {id:'dental', name:'Dental visit (photo).jpg', kind:'photo', from:'Sample Family Dental', date:'2026-10-02', types:['dental'], pages:[
      'DENTAL VISIT (SAMPLE) 10/02/2026\nUpper partial denture. Brush and soak nightly.\nNext cleaning: April 2027.'
    ]},
    {id:'swallow', name:'Swallow evaluation.pdf', kind:'pdf', from:'Sample Regional Hospital (speech therapy)', date:'2026-11-24', types:['therapy'], pages:[
      'BEDSIDE SWALLOW EVALUATION (SAMPLE) 11/24/2026\nRecommend IDDSI Level 5 Minced & moist solids, Level 0 thin liquids.\nSit fully upright for meals and 30 minutes after. Small bites. Check mouth for pocketed food.\nDentures in for meals.'
    ]},
    {id:'ccda', name:'Clinic summary (C-CDA).xml', kind:'ccda', from:'Sample Clinic patient portal', date:'2026-09-20', types:['physician'], text:CCDA},
    {id:'fhir', name:'Hospital portal export (FHIR).json', kind:'fhir', from:'Sample Regional Hospital portal', date:'2026-11-26', types:['orders'], text:JSON.stringify(FHIR, null, 1)}
  ];

  // What text recognition plus AI would pull from the unstructured documents. Structured files (C-CDA, FHIR) are read live by the parser.
  // [doc, page, section, key, label, value, quote]
  const F = (doc, page, sec, key, label, value, quote) => ({doc, page, sec, key, label, value, quote: quote || value});
  const FACTS = [
    F('dc',0,'demo','demo:name','Name','Dot Sample','Patient: Dot Sample'),
    F('dc',0,'demo','demo:dob','Date of birth','1942-03-14','DOB: 03/14/1942'),
    F('dc',0,'demo','demo:why','Why she\'s coming','After a hospital stay for a hip fracture (fall at previous home). Delirium improving.','Reason for stay: Fall at previous home with left hip fracture'),
    F('dc',0,'dx','dx:hip','Diagnosis','Left hip fracture, repaired (ORIF 11/19/2026)','Left hip fracture s/p ORIF'),
    F('dc',0,'dx','dx:dementia','Diagnosis','Alzheimer\'s dementia, moderate','Alzheimer\'s dementia, moderate'),
    F('dc',0,'dx','dx:afib','Diagnosis','Atrial fibrillation','Atrial fibrillation'),
    F('dc',0,'dx','dx:diabetes','Diagnosis','Type 2 diabetes','Type 2 diabetes'),
    F('dc',0,'dx','dx:dysphagia','Diagnosis','Dysphagia (mild)','Dysphagia (mild)'),
    F('dc',0,'allergy','allergy:penicillin','Allergy','Penicillin (hives)','Allergies: Penicillin (hives).'),
    F('dc',1,'meds','med:metoprolol','Medication','Metoprolol tartrate 25 mg twice daily','- Metoprolol tartrate 25 mg twice daily'),
    F('dc',1,'meds','med:apixaban','Medication','Apixaban 2.5 mg twice daily','- Apixaban 2.5 mg twice daily'),
    F('dc',1,'meds','med:metformin','Medication','Metformin 500 mg twice daily with meals','- Metformin 500 mg twice daily with meals'),
    F('dc',1,'meds','med:acetaminophen','Medication','Acetaminophen 650 mg every 6 hours as needed for pain (max 3 g/day)','- Acetaminophen 650 mg every 6 hours as needed for pain (max 3 g/day)'),
    F('dc',1,'meds','med:donepezil','Medication','Donepezil 10 mg at bedtime','- Donepezil 10 mg at bedtime'),
    F('dc',1,'meds','med:lorazepam','Medication','STOPPED: Lorazepam (caused confusion)','STOP: Lorazepam (caused confusion)'),
    F('dc',1,'directives','code','Code status','DNR (do not resuscitate)','Code status: DNR (POLST on chart)'),
    F('dc',2,'mobility','mobility','Mobility','Walker with 1 assist. Weight bearing as tolerated.','Walker with 1 assist.'),
    F('dc',2,'mobility','fallrisk','Fall risk','High','High fall risk.'),
    F('dc',2,'diet','diet:name','Diet','Consistent carbohydrate','Diet: Consistent carbohydrate'),
    F('dc',2,'diet','diet:texture','Food texture','IDDSI Level 5 Minced & moist','IDDSI Level 5 Minced & moist'),
    F('dc',2,'diet','diet:liquids','Liquids','IDDSI Level 0 Thin','thin liquids per speech therapy'),
    F('dc',2,'monitor','mon:bg','Check','Blood sugar before breakfast and supper','Blood sugar before breakfast and supper.'),
    F('dc',2,'monitor','mon:skin','Check','Heels and hips for skin breakdown every shift','Check heels and hips for skin breakdown every shift.'),
    F('dc',2,'monitor','mon:weight','Check','Weigh weekly','Weigh weekly.'),
    F('dc',2,'appts','appt:2026-12-04:orthopedics','Appointment','Orthopedics, 2026-12-04: staple removal','Orthopedics 12/04/2026 (staple removal).'),
    F('dc',2,'appts','appt:pcp','Appointment','Primary care within 7 days of discharge (needs booking)','Primary care within 7 days.'),
    F('dc',2,'appts','appt:2026-12-08:cardiology','Appointment','Cardiology, 2026-12-08','Cardiology 12/08/2026.'),
    F('dc',2,'team','team:homehealth','Home health','Sample Home Health: physical therapy 3 times a week for 4 weeks','Home health physical therapy 3 times a week for 4 weeks (Sample Home Health).'),

    F('face',0,'allergy','allergy:none','Allergy','No known drug allergies (NKDA)','Allergies: NKDA'),
    F('face',0,'directives','code','Code status','Full code','Code status: Full code'),
    F('face',0,'decision','decision','Who makes health decisions','Ann Sample (daughter), health care POA, activated 2025','Health care POA: Daughter, Ann Sample (activated 2025)'),
    F('face',0,'team','team:pharmacy','Pharmacy','Sample Pharmacy','Pharmacy: Sample Pharmacy'),
    F('face',0,'diet','diet:name','Diet','Regular, diabetic','Diet: Regular, diabetic'),
    F('face',0,'diet','diet:texture','Food texture','Regular','Diet: Regular, diabetic'),
    F('face',0,'mobility','mobility','Mobility','Walker, independent','Mobility: Walker, independent'),
    F('face',0,'behavior','beh:likes','Likes','Word puzzles, gospel music','Likes word puzzles and gospel music.'),
    F('face',0,'behavior','beh:rushed','Trigger','Gets upset when rushed in the morning','Gets upset when rushed in the morning.'),
    F('face',0,'behavior','beh:4pm','Pattern','Asks for her late husband around 4 PM','Asks for her late husband around 4 PM.'),
    F('face',1,'meds','med:metoprolol','Medication','Metoprolol succinate ER 50 mg once daily','Metoprolol succinate ER 50 mg once daily (8 AM)'),
    F('face',1,'meds','med:apixaban','Medication','Apixaban 5 mg twice daily','Apixaban 5 mg twice daily'),
    F('face',1,'meds','med:metformin','Medication','Metformin 500 mg twice daily with meals','Metformin 500 mg twice daily with meals'),
    F('face',1,'meds','med:donepezil','Medication','Donepezil 10 mg at bedtime','Donepezil 10 mg at bedtime'),
    F('face',1,'meds','med:lorazepam','Medication','Lorazepam 0.5 mg as needed for anxiety','Lorazepam 0.5 mg as needed for anxiety'),

    F('mco',0,'team','team:mco','Care manager (MCO)','Care manager (sample), Family Care MCO · phone 715-555-0123 · fax 715-555-0133 · care.manager3@mco.example','Care manager: Care manager (sample)'),
    F('mco',0,'team','team:mco-rn','Nurse manager (MCO RN)','Nurse manager (sample), RN, Family Care MCO · phone 715-555-0173 · fax 715-555-0133 · nurse.manager3@mco.example','Nurse manager: Nurse manager (sample), RN'),
    F('mco',0,'behavior','beh:goals','What matters to them','Stay safe from falls. Keep going to church on Sundays. Stay close to her daughter.','Outcomes: Stay safe from falls. Keep going to church on Sundays. Stay close to her daughter.'),
    F('mco',0,'behavior','beh:exit','Pattern','Tried to leave once in October 2026 near sundown','Tried to leave once in October 2026 near sundown.'),
    F('mco',0,'behavior','beh:helps','What helps','Walking with her, gospel music, offering a call to her daughter','What helps: walking with her, gospel music, offering a call to her daughter.'),
    F('mco',0,'decision','hcbs','Rights restrictions (HCBS)','None approved','Rights restrictions (HCBS settings rule): none approved.'),

    F('guard',0,'decision','decision','Who makes health decisions','Robert Sample (son), court-appointed guardian of the person (health care and placement)','Guardian: Robert Sample (son)'),
    F('polst',0,'directives','code','Code status','DNR (do not resuscitate)','Section A: Do Not Attempt Resuscitation (DNR)'),
    F('polst',0,'directives','polst','POLST','Limited interventions. Signed 11/25/2026 by physician and guardian.','Section B: Limited interventions'),

    F('psych',0,'dx','dx:bpsd','Diagnosis','Behavioral symptoms of dementia; mild depression','Assessment: Behavioral symptoms of dementia. Mild depression.'),
    F('psych',0,'meds','med:sertraline','Medication','Sertraline 25 mg once daily (new)','Plan: Start sertraline 25 mg once daily.'),
    F('psych',0,'behavior','beh:nondrug','What helps','Non-drug first: same routine, music, unhurried mornings. Avoid benzodiazepines.','Non-drug first: same routine, music, unhurried mornings.'),
    F('psych',0,'team','team:psych','Psychiatry','Sample Behavioral Health','PSYCHIATRY FOLLOW-UP (SAMPLE)'),
    F('psych',0,'appts','appt:psych','Appointment','Psychiatry, 2027-01-12 (video visit OK)','Next visit: 01/12/2027 (video visit OK).'),

    F('dental',0,'team','team:dental','Dental','Sample Family Dental','DENTAL VISIT (SAMPLE)'),
    F('dental',0,'monitor','mon:denture','Daily care','Upper partial denture: brush and soak nightly','Upper partial denture. Brush and soak nightly.'),
    F('dental',0,'appts','appt:dental','Appointment','Dental cleaning, April 2027','Next cleaning: April 2027.'),

    F('swallow',0,'diet','diet:texture','Food texture','IDDSI Level 5 Minced & moist','Recommend IDDSI Level 5 Minced & moist solids'),
    F('swallow',0,'diet','diet:liquids','Liquids','IDDSI Level 0 Thin','Level 0 thin liquids.'),
    F('swallow',0,'diet','diet:how','How to eat safely','Sit fully upright for meals and 30 minutes after. Small bites. Check mouth for pocketed food. Dentures in for meals.','Sit fully upright for meals and 30 minutes after.'),
    F('swallow',0,'team','team:slp','Speech therapy','Sample Regional Hospital speech therapy','BEDSIDE SWALLOW EVALUATION (SAMPLE)')
  ];

  return {DOCS, FACTS, nick:'Dot'};
})();
