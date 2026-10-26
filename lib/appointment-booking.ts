import {resolvePatient} from './patient-record.ts';
import {amount,normalizeDocument,type CommerceRecord} from './commerce.ts';
type Row=Record<string,unknown>;
export type BookingRequest={record:Row;billing?:{create?:boolean;discount?:unknown;paid?:unknown;method?:string;reference?:string};request_id:string};
const clinic='skinuvia';
const appointmentColumns=['patient_id','patient_name','phone','doctor','service','appointment_date','appointment_time','status','payment_status','token','source','price','notes','parent_appointment_id'];
export async function saveAppointment(db:D1Database,actor:string,input:BookingRequest){
 const r=input.record||{},editing=Boolean(r.id);
 if(!/^[a-f0-9-]{36}$/i.test(input.request_id||''))throw new Error('Missing booking request identifier');
 const id=editing?String(r.id):'APT-'+input.request_id;
 const previous=await db.prepare('SELECT * FROM appointments WHERE clinic_id=? AND id=?').bind(clinic,id).first<Row>();
 if(editing&&!previous)throw new Error('This appointment no longer exists');
 const storedBill=await db.prepare("SELECT id,body,revision FROM commerce_documents WHERE clinic_id=? AND kind='invoices' AND json_extract(body,'$.appointment_id')=?").bind(clinic,id).first<{id:string;body:string;revision:number}>();
 const existingInvoice=storedBill?{...JSON.parse(storedBill.body),id:storedBill.id,revision:storedBill.revision} as CommerceRecord:null;
 if(!editing&&previous)return {appointment:previous,invoice:existingInvoice,replayed:true};
 for(const key of ['patient_name','phone','doctor','service','appointment_date','appointment_time'])if(!String(r[key]||'').trim())throw new Error(key.replaceAll('_',' ')+' is required');
 const date=String(r.appointment_date),time=String(r.appointment_time);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new Error('Enter a valid appointment date');
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Enter a valid appointment time');
 if((!editing||time!==previous?.appointment_time)&&Number(time.slice(3))%15!==0)throw new Error('Choose an appointment time in 15-minute intervals (00, 15, 30 or 45).');
 if(existingInvoice&&input.billing?.create){if(existingInvoice.id==='INV-'+input.request_id)return {appointment:previous,invoice:existingInvoice,replayed:true};throw new Error('An invoice already exists. Use Edit invoice to change its payment or charges.');}
 const resolved=await resolvePatient(db,clinic,r);
 if(existingInvoice&&existingInvoice.patient_id!==resolved.patient.id)throw new Error('This appointment has an invoice. Edit the patient details in Patients to preserve its financial history.');
 const record:Row={patient_id:resolved.patient.id,patient_name:resolved.patient.name,phone:String(r.phone).trim(),doctor:String(r.doctor).trim(),service:String(r.service).trim(),appointment_date:date,appointment_time:time,source:String(r.source||'Reception').trim(),token:String(r.token||'').trim()||null,price:amount(r.price,'Service price'),notes:String(r.notes||'').trim(),parent_appointment_id:previous?.parent_appointment_id||r.parent_appointment_id||null,status:previous?.status||(r.source==='Walk-in'?'Waiting':'Confirmed'),payment_status:existingInvoice?(existingInvoice.state==='Finalized'?existingInvoice.status:'Unpaid'):(previous?.payment_status||'Unpaid')};
 let invoice:CommerceRecord|null=null;
 if(input.billing?.create){
  const billing=input.billing;invoice=normalizeDocument('invoices',{id:'INV-'+input.request_id,appointment_id:id,patient_id:record.patient_id,patient_name:record.patient_name,doctor:record.doctor,phone:resolved.patient.phone,patient_age:resolved.patient.age,date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),state:'Finalized',items:[{description:String(record.service),quantity:1,price:Number(record.price)}],discount:billing.discount||0,paid:billing.paid||0,method:String(billing.method||'Cash').trim()||'Cash',reference:String(billing.reference||'').trim()});record.payment_status=invoice.status;
 }
 const statements=[...resolved.statements];
 const audit=(action:string,entity:string,entityId:string,detail:unknown)=>db.prepare('INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),clinic,actor,action,entity,entityId,JSON.stringify(detail));
 if(resolved.statements.length)statements.push(audit('AUTO_CREATE','patients',resolved.patient.id,{after:resolved.patient}));
 if(editing){
  if(r.updated_at&&r.updated_at!==previous!.updated_at)throw new Error('This appointment changed. Refresh before editing.');
  statements.push(db.prepare(`UPDATE appointments SET ${appointmentColumns.map(c=>c+'=?').join(',')},updated_at=CURRENT_TIMESTAMP WHERE clinic_id=? AND id=? AND updated_at=?`).bind(...appointmentColumns.map(c=>record[c]??null),clinic,id,previous!.updated_at));
  const guard=crypto.randomUUID();statements.push(db.prepare('INSERT INTO commerce_guards(id,valid) VALUES(?,changes())').bind(guard),db.prepare('DELETE FROM commerce_guards WHERE id=?').bind(guard));
 }else statements.push(db.prepare(`INSERT INTO appointments(id,clinic_id,${appointmentColumns.join(',')}) VALUES(?,?,${appointmentColumns.map(()=>'?').join(',')})`).bind(id,clinic,...appointmentColumns.map(c=>record[c]??null)));
 if(record.parent_appointment_id){
  const parent=await db.prepare('SELECT patient_id FROM appointments WHERE clinic_id=? AND id=?').bind(clinic,record.parent_appointment_id).first<{patient_id:string}>();if(!parent||parent.patient_id!==record.patient_id)throw new Error('Follow-up must belong to the same patient as the original appointment');
  statements.push(db.prepare("INSERT INTO followups(id,clinic_id,patient_id,patient_name,doctor,reason,due_date,priority,status) VALUES(?,?,?,?,?,?,?,'Normal',?) ON CONFLICT(id) DO UPDATE SET due_date=excluded.due_date,reason=excluded.reason,status=excluded.status,updated_at=CURRENT_TIMESTAMP").bind('FU-'+id,clinic,record.patient_id,record.patient_name,record.doctor,record.service,record.appointment_date,record.status==='Completed'?'Completed':record.status==='Cancelled'?'Cancelled':'Scheduled'));
 }
 if(invoice){statements.push(db.prepare("INSERT INTO commerce_documents(id,clinic_id,kind,body) VALUES(?,?,'invoices',?)").bind(invoice.id!,clinic,JSON.stringify(invoice)),audit('CREATE','invoices',invoice.id!,{after:invoice}));}
 statements.push(audit(editing?'UPDATE':'CREATE','appointments',id,{before:previous,after:record}));
 await db.batch(statements);
 const appointment=await db.prepare('SELECT * FROM appointments WHERE clinic_id=? AND id=?').bind(clinic,id).first<Row>();
 return {appointment,invoice:invoice?{...invoice,revision:1}:existingInvoice,replayed:false};
}
