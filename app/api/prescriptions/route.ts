import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {resolvePatient} from '../../../lib/patient-record';
const clinic='skinuvia';
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Authentication required'},{status:401});
 try{
  const input=await request.json() as Record<string,unknown>;const db=env.DB!,id=String(input.id||'RX-'+crypto.randomUUID());
  const previous=await db.prepare('SELECT * FROM prescriptions WHERE clinic_id=? AND id=?').bind(clinic,id).first<Record<string,unknown>>();
  if(input.id&&!previous)return Response.json({error:'Prescription no longer exists'},{status:404});
  if(previous&&Number(input.version)!==Number(previous.version))return Response.json({error:'Prescription changed. Reopen it before editing.'},{status:409});
  const record={...input};if(!String(record.doctor||'').trim())throw new Error('Doctor name is required');
  if(!['Draft','Approved','Amended'].includes(String(record.status)))throw new Error('Choose Draft, Approved or Amended');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(record.prescription_date||'')))throw new Error('Enter the prescription date');
  const strokes=JSON.parse(String(record.handwriting||'[]')) as unknown[];if(!Array.isArray(strokes)||JSON.stringify(strokes).length>500000)throw new Error('Handwriting is too large. Use fewer strokes or typed notes.');
  if(!String(record.medicines||'').trim()&&!String(record.diagnosis||'').trim()&&!String(record.instructions||'').trim()&&!strokes.length)throw new Error('Write the prescription before saving');
  if(record.patient_age!==''&&record.patient_age!==undefined&&(!Number.isFinite(Number(record.patient_age))||Number(record.patient_age)<0||Number(record.patient_age)>130))throw new Error('Enter a valid patient age');
  const resolved=await resolvePatient(db,clinic,record);record.patient_id=resolved.patient.id;record.patient_name=resolved.patient.name;record.phone=String(record.phone||resolved.patient.phone||'');record.patient_age=String(record.patient_age??resolved.patient.age??'');record.version=previous?Number(previous.version)+1:1;record.approved_at=record.status==='Approved'?new Date().toISOString():null;
  const cols=['patient_id','patient_name','doctor','diagnosis','medicines','instructions','status','version','approved_at','phone','patient_age','prescription_date','handwriting'];
  const batch=[...resolved.statements];
  if(resolved.statements.length)batch.push(db.prepare('INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),clinic,user.userId,'AUTO_CREATE','patients',resolved.patient.id,JSON.stringify({after:resolved.patient})));
  if(previous){batch.push(db.prepare(`UPDATE prescriptions SET ${cols.map(c=>c+'=?').join(',')},updated_at=CURRENT_TIMESTAMP WHERE clinic_id=? AND id=? AND version=?`).bind(...cols.map(c=>record[c]??''),clinic,id,previous.version));const guard=crypto.randomUUID();batch.push(db.prepare('INSERT INTO commerce_guards(id,valid) VALUES(?,changes())').bind(guard),db.prepare('DELETE FROM commerce_guards WHERE id=?').bind(guard));}
  else batch.push(db.prepare(`INSERT INTO prescriptions(id,clinic_id,${cols.join(',')}) VALUES(?,?,${cols.map(()=>'?').join(',')})`).bind(id,clinic,...cols.map(c=>record[c]??'')));
  batch.push(db.prepare('INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),clinic,user.userId,previous?'UPDATE':'CREATE','prescriptions',id,JSON.stringify({before:previous,after:record})));
  await db.batch(batch);return Response.json({record:{...record,id}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Unable to save prescription'},{status:400});}
}
