-- Bills opened from an appointment's "Bill" button were saved as Draft, which kept the
-- appointment "Unpaid" even after the patient paid. Finalize those bills, then re-sync every
-- appointment's payment status (and payment-driven status) from its linked bill.
INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail)
SELECT 'AUD-MIG13-'||lower(hex(randomblob(8))),clinic_id,'system','FINALIZE_DRAFT_BILL','invoices',id,
       json_object('appointment_id',json_extract(body,'$.appointment_id'),'paid',json_extract(body,'$.paid'),'net',json_extract(body,'$.net'),'reason','Draft appointment bill finalized (migration 0013)')
FROM commerce_documents
WHERE kind='invoices' AND json_extract(body,'$.state')='Draft' AND json_extract(body,'$.appointment_id') IS NOT NULL;
--> statement-breakpoint
UPDATE commerce_documents
SET body=json_set(body,'$.state','Finalized'),revision=revision+1,updated_at=CURRENT_TIMESTAMP
WHERE kind='invoices' AND json_extract(body,'$.state')='Draft' AND json_extract(body,'$.appointment_id') IS NOT NULL;
--> statement-breakpoint
CREATE TEMP TABLE _mig13_sync AS
SELECT a.id,a.clinic_id,a.status AS old_status,a.payment_status AS old_payment,
       CASE WHEN json_extract(d.body,'$.state')='Finalized' THEN json_extract(d.body,'$.status') ELSE 'Unpaid' END AS new_payment
FROM appointments a
JOIN commerce_documents d ON d.clinic_id=a.clinic_id AND d.kind='invoices' AND json_extract(d.body,'$.appointment_id')=a.id;
--> statement-breakpoint
UPDATE _mig13_sync SET new_payment='Unpaid' WHERE new_payment IS NULL OR new_payment NOT IN ('Paid','Partially Paid','Unpaid');
--> statement-breakpoint
INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail)
SELECT 'AUD-MIG13-'||lower(hex(randomblob(8))),s.clinic_id,'system','PAYMENT_SYNC','appointments',s.id,
       json_object('before_payment',s.old_payment,'after_payment',s.new_payment,'before_status',s.old_status,'reason','Payment status re-synced from bill (migration 0013)')
FROM _mig13_sync s
WHERE s.old_payment IS NOT s.new_payment
   OR (s.old_status IN ('Pending','Confirmed','Arrived','Waiting','In Consultation','Awaiting Payment')
       AND s.old_status <> CASE WHEN s.new_payment IN ('Paid','Partially Paid') THEN 'Confirmed' ELSE 'Awaiting Payment' END);
--> statement-breakpoint
UPDATE appointments
SET payment_status=(SELECT new_payment FROM _mig13_sync s WHERE s.id=appointments.id),
    status=CASE WHEN status IN ('Pending','Confirmed','Arrived','Waiting','In Consultation','Awaiting Payment')
                THEN CASE WHEN (SELECT new_payment FROM _mig13_sync s WHERE s.id=appointments.id) IN ('Paid','Partially Paid') THEN 'Confirmed' ELSE 'Awaiting Payment' END
                ELSE status END
WHERE id IN (SELECT id FROM _mig13_sync);
--> statement-breakpoint
DROP TABLE _mig13_sync;
