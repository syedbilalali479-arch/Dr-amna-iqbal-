-- Bills whose appointment no longer exists (deleted before bills were cancelled on delete)
-- were still Finalized, so the Account Book counted their appointments and payments.
-- Cancel them exactly as deleting an appointment does today, and audit each one.
INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail)
SELECT 'AUD-MIG15-'||lower(hex(randomblob(8))),d.clinic_id,'system','APPOINTMENT_DELETED','invoices',d.id,
       json_object('appointment_id',json_extract(d.body,'$.appointment_id'),'paid',json_extract(d.body,'$.paid'),'net',json_extract(d.body,'$.net'),'reason','Appointment was deleted; bill cancelled (migration 0015)')
FROM commerce_documents d
WHERE d.kind='invoices' AND json_extract(d.body,'$.appointment_id') IS NOT NULL
  AND coalesce(json_extract(d.body,'$.state'),'')<>'Voided'
  AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.clinic_id=d.clinic_id AND a.id=json_extract(d.body,'$.appointment_id'));
--> statement-breakpoint
UPDATE commerce_documents
SET body=json_set(body,'$.state','Voided','$.status','Voided','$.cancelled_balance',json_extract(body,'$.balance'),'$.balance',0,
                  '$.appointment_deleted',json('true'),'$.cancellation_reason','Appointment deleted','$.cancelled_at',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    revision=revision+1,updated_at=CURRENT_TIMESTAMP
WHERE kind='invoices' AND json_extract(body,'$.appointment_id') IS NOT NULL
  AND coalesce(json_extract(body,'$.state'),'')<>'Voided'
  AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.clinic_id=commerce_documents.clinic_id AND a.id=json_extract(commerce_documents.body,'$.appointment_id'));
