import type {CommerceRecord} from './commerce.ts';
export async function deleteAppointment(db:D1Database,actor:string,id:string){
 const clinic='skinuvia';
 const before=await db.prepare('SELECT * FROM appointments WHERE clinic_id=? AND id=?').bind(clinic,id).first<Record<string,unknown>>();
 if(!before)return {ok:true,deleted:false,cancelledInvoices:0};
 const linked=(await db.prepare("SELECT id,body,revision FROM commerce_documents WHERE clinic_id=? AND kind='invoices' AND json_extract(body,'$.appointment_id')=?").bind(clinic,id).all<{id:string;body:string;revision:number}>()).results;
 const statements:D1PreparedStatement[]=[];
 const guard=()=>{const key=crypto.randomUUID();return [db.prepare('INSERT INTO commerce_guards(id,valid) VALUES(?,changes())').bind(key),db.prepare('DELETE FROM commerce_guards WHERE id=?').bind(key)]};
 const key=crypto.randomUUID();
 statements.push(db.prepare("INSERT INTO commerce_guards(id,valid) SELECT ?,CASE WHEN (SELECT count(*) FROM commerce_documents WHERE clinic_id=? AND kind='invoices' AND json_extract(body,'$.appointment_id')=?)=? THEN 1 ELSE 0 END").bind(key,clinic,id,linked.length),db.prepare('DELETE FROM commerce_guards WHERE id=?').bind(key));
 statements.push(db.prepare('DELETE FROM appointments WHERE clinic_id=? AND id=? AND updated_at=?').bind(clinic,id,before.updated_at),...guard());
 for(const row of linked){
  const invoice=JSON.parse(row.body) as CommerceRecord;
  const after={...invoice,state:'Voided',status:'Voided',balance:0,cancelled_balance:invoice.balance,appointment_deleted:true,cancellation_reason:'Appointment deleted',cancelled_at:new Date().toISOString(),appointment_snapshot:before};
  statements.push(db.prepare('UPDATE commerce_documents SET body=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE clinic_id=? AND id=? AND revision=?').bind(JSON.stringify(after),clinic,row.id,row.revision),...guard());
  statements.push(db.prepare('INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),clinic,actor,invoice.state==='Voided'?'APPOINTMENT_DELETED':'AUTO_CANCEL','invoices',row.id,JSON.stringify({before:invoice,after})));
 }
 statements.push(db.prepare("UPDATE followups SET status='Cancelled',updated_at=CURRENT_TIMESTAMP WHERE clinic_id=? AND id=?").bind(clinic,'FU-'+id));
 statements.push(db.prepare('INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),clinic,actor,'DELETE','appointments',id,JSON.stringify({before,cancelledInvoices:linked.map(r=>r.id)})));
 await db.batch(statements);return {ok:true,deleted:true,cancelledInvoices:linked.length};
}
