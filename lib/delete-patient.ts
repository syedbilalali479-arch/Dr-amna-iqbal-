/** Permanently remove a patient and their linked clinic history in one transaction. */
export async function deletePatient(db:D1Database,id:string){
 const clinic='skinuvia';
 // Every statement resolves its targets inside the same write transaction. Never match
 // clinical records by name: different patients may have the same name or phone.
 const phone=(column:string)=>`replace(replace(replace(replace(${column},' ',''),'-',''),'+',''),'(','')`;
 const cte=`WITH target AS (SELECT * FROM patients WHERE clinic_id=? AND id=?),
 visits AS (SELECT id FROM appointments WHERE clinic_id=? AND patient_id=?),
 documents AS (SELECT id FROM commerce_documents WHERE clinic_id=? AND kind IN ('invoices','sales') AND (json_extract(body,'$.patient_id')=? OR json_extract(body,'$.appointment_snapshot.patient_id')=? OR json_extract(body,'$.appointment_id') IN (SELECT id FROM visits))),
 contact AS (SELECT phone,name FROM target t WHERE phone<>'' AND NOT EXISTS(SELECT 1 FROM patients p WHERE p.clinic_id=t.clinic_id AND p.id<>t.id AND ${phone('p.phone')}=${phone('t.phone')})),
 chats AS (SELECT c.id FROM conversations c WHERE c.clinic_id=? AND EXISTS(SELECT 1 FROM contact t WHERE ${phone('c.phone')}=${phone('t.phone')})),
 prospects AS (SELECT l.id FROM leads l WHERE l.clinic_id=? AND EXISTS(SELECT 1 FROM contact t WHERE ${phone('l.phone')}=${phone('t.phone')})),
 entities AS (SELECT id FROM target UNION SELECT id FROM visits UNION SELECT id FROM documents UNION SELECT id FROM prescriptions WHERE clinic_id=? AND patient_id=? UNION SELECT id FROM invoices WHERE clinic_id=? AND patient_id=? UNION SELECT id FROM followups WHERE clinic_id=? AND patient_id=? UNION SELECT id FROM treatment_plans WHERE clinic_id=? AND patient_id=? UNION SELECT id FROM chats UNION SELECT id FROM prospects)`;
 const params=[clinic,id,clinic,id,clinic,id,id,clinic,clinic,clinic,id,clinic,id,clinic,id,clinic,id];
 const statement=(sql:string,...bindings:unknown[])=>db.prepare(cte+' '+sql).bind(...params,...bindings);
 const statements:D1PreparedStatement[]=[];
 // Match normal sale deletion: return only finalized sales to inventory. Cancelled
 // sales were already reversed. Remove their movements with the deleted documents.
 statements.push(statement(`UPDATE medicines SET quantity=quantity+coalesce((SELECT sum(CAST(json_extract(item.value,'$.quantity') AS INTEGER)) FROM commerce_documents d,json_each(d.body,'$.items') item WHERE d.clinic_id=? AND d.id IN (SELECT id FROM documents) AND d.kind='sales' AND json_extract(d.body,'$.state')='Finalized' AND json_extract(item.value,'$.medicine_id')=medicines.id),0),updated_at=CURRENT_TIMESTAMP WHERE clinic_id=? AND id IN (SELECT json_extract(item.value,'$.medicine_id') FROM commerce_documents d,json_each(d.body,'$.items') item WHERE d.clinic_id=? AND d.id IN (SELECT id FROM documents) AND d.kind='sales' AND json_extract(d.body,'$.state')='Finalized')`,clinic,clinic,clinic));
 statements.push(statement('DELETE FROM stock_movements WHERE clinic_id=? AND document_id IN (SELECT id FROM documents)',clinic));
 // Remove snapshots and send logs as well as the currently linked records.
 statements.push(statement(`DELETE FROM audit_logs WHERE clinic_id=? AND (entity_id IN (SELECT id FROM entities) OR EXISTS(SELECT 1 FROM json_tree(CASE WHEN json_valid(detail) THEN detail ELSE '{}' END) j WHERE j.type='text' AND j.value IN (SELECT id FROM entities)))`,clinic));
 statements.push(statement(`DELETE FROM ai_learning_events WHERE clinic_id=? AND (conversation_id IN (SELECT id FROM chats) OR EXISTS(SELECT 1 FROM contact t WHERE ${phone('ai_learning_events.phone')}=${phone('t.phone')}))`,clinic));
 statements.push(statement(`DELETE FROM conversation_states WHERE clinic_id=? AND EXISTS(SELECT 1 FROM contact t WHERE ${phone('conversation_states.phone')}=${phone('t.phone')})`,clinic));
 statements.push(statement('DELETE FROM conversations WHERE clinic_id=? AND id IN (SELECT id FROM chats)',clinic));
 statements.push(statement('DELETE FROM leads WHERE clinic_id=? AND id IN (SELECT id FROM prospects)',clinic));
 statements.push(statement('DELETE FROM commerce_documents WHERE clinic_id=? AND id IN (SELECT id FROM documents)',clinic));
 for(const table of ['prescriptions','invoices','followups','treatment_plans','appointments'])statements.push(db.prepare(`DELETE FROM ${table} WHERE clinic_id=? AND patient_id=?`).bind(clinic,id));
 statements.push(db.prepare('DELETE FROM patients WHERE clinic_id=? AND id=?').bind(clinic,id));
 await db.batch(statements);return {ok:true,deleted:true,patientHistoryDeleted:true};
}
