export async function resolvePatient(db:D1Database,clinic:string,record:Record<string,unknown>) {
 const statements:D1PreparedStatement[]=[];
 if(record.patient_id&&record.patient_id!=='unlinked') {
  const patient=await db.prepare('SELECT id,name,phone,age FROM patients WHERE clinic_id=? AND id=?').bind(clinic,String(record.patient_id)).first<{id:string;name:string;phone:string;age:number|null}>();
  if(!patient)throw new Error('Patient no longer exists');return {patient,statements};
 }
 const name=String(record.patient_name||'').trim(),phone=String(record.phone||'').trim();if(!name)throw new Error('Enter a patient name');
 const matches=(await db.prepare('SELECT id,name,phone,age FROM patients WHERE clinic_id=? AND lower(name)=lower(?) AND (?=\'\' OR phone=?)').bind(clinic,name,phone,phone).all<{id:string;name:string;phone:string;age:number|null}>()).results;
 if(matches.length>1)throw new Error('More than one patient has this name. Select the patient with their phone number.');
 if(matches[0])return {patient:matches[0],statements};
 const patient={id:'PT-'+crypto.randomUUID(),name,phone,age:record.patient_age?Number(record.patient_age):null};
 statements.push(db.prepare('INSERT INTO patients(id,clinic_id,name,phone,age,notes) VALUES(?,?,?,?,?,?)').bind(patient.id,clinic,name,phone,patient.age,'Added from reception form'));
 return {patient,statements};
}
