-- Production ran an older build between 11 Nov 20:42 UTC and 12 Nov 16:08 UTC. That build set
-- payment_status from bills without updating status, gave walk-ins "Waiting" and did not merge a
-- walk-in into an existing booking. Re-sync every open appointment from its bill, then close the
-- unbilled bookings duplicated by a paid walk-in the same day. Every change is audited.
CREATE TEMP TABLE _mig16 AS
SELECT a.id,a.clinic_id,a.status AS old_status,a.payment_status AS old_payment,
       CASE WHEN d.id IS NULL THEN a.payment_status
            WHEN json_extract(d.body,'$.state')='Finalized' THEN json_extract(d.body,'$.status')
            ELSE 'Unpaid' END AS new_payment
FROM appointments a
LEFT JOIN commerce_documents d ON d.clinic_id=a.clinic_id AND d.kind='invoices' AND json_extract(d.body,'$.appointment_id')=a.id;
--> statement-breakpoint
UPDATE _mig16 SET new_payment='Unpaid' WHERE new_payment IS NULL OR new_payment NOT IN ('Paid','Partially Paid','Refunded','Unpaid');
--> statement-breakpoint
ALTER TABLE _mig16 ADD COLUMN new_status TEXT;
--> statement-breakpoint
UPDATE _mig16 SET new_status=CASE WHEN old_status NOT IN ('Pending','Confirmed','Arrived','Waiting','In Consultation','Awaiting Payment') THEN old_status WHEN new_payment IN ('Paid','Partially Paid','Refunded') THEN 'Confirmed' ELSE 'Awaiting Payment' END;
--> statement-breakpoint
INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail)
SELECT 'AUD-MIG16-'||lower(hex(randomblob(8))),clinic_id,'system','STATUS_RESYNC','appointments',id,
       json_object('before_status',old_status,'after_status',new_status,'before_payment',old_payment,'after_payment',new_payment,'reason','Re-synced after older build was live (migration 0016)')
FROM _mig16 WHERE old_status IS NOT new_status OR old_payment IS NOT new_payment;
--> statement-breakpoint
UPDATE appointments
SET status=(SELECT new_status FROM _mig16 m WHERE m.id=appointments.id),
    payment_status=(SELECT new_payment FROM _mig16 m WHERE m.id=appointments.id)
WHERE id IN (SELECT id FROM _mig16 WHERE old_status IS NOT new_status OR old_payment IS NOT new_payment);
--> statement-breakpoint
DROP TABLE _mig16;
--> statement-breakpoint
CREATE TEMP TABLE _mig16_dupes AS
SELECT a.id,a.clinic_id,a.status AS old_status,
       (SELECT b.id FROM appointments b JOIN commerce_documents d ON d.clinic_id=b.clinic_id AND d.kind='invoices' AND json_extract(d.body,'$.appointment_id')=b.id
        WHERE b.clinic_id=a.clinic_id AND b.id<>a.id AND b.appointment_date=a.appointment_date AND b.phone=a.phone
          AND lower(trim(b.patient_name))=lower(trim(a.patient_name)) AND json_extract(d.body,'$.state')='Finalized'
          AND json_extract(d.body,'$.status') IN ('Paid','Partially Paid') ORDER BY b.appointment_time LIMIT 1) AS paid_id
FROM appointments a
WHERE a.status IN ('Pending','Confirmed','Arrived','Waiting','In Consultation','Awaiting Payment')
  AND trim(coalesce(a.phone,''))<>''
  AND NOT EXISTS (SELECT 1 FROM commerce_documents d WHERE d.clinic_id=a.clinic_id AND d.kind='invoices' AND json_extract(d.body,'$.appointment_id')=a.id);
--> statement-breakpoint
DELETE FROM _mig16_dupes WHERE paid_id IS NULL;
--> statement-breakpoint
INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail)
SELECT 'AUD-MIG16-'||lower(hex(randomblob(8))),clinic_id,'system','CLOSE_DUPLICATE_BOOKING','appointments',id,
       json_object('before_status',old_status,'after_status','Cancelled','paid_appointment_id',paid_id,'reason','Unbilled booking duplicated by a paid walk-in the same day (migration 0016)')
FROM _mig16_dupes;
--> statement-breakpoint
UPDATE appointments
SET status='Cancelled',
    notes=trim(coalesce(notes,'')||' [Duplicate booking: patient was billed and paid on walk-in appointment '||(SELECT paid_id FROM _mig16_dupes m WHERE m.id=appointments.id)||']')
WHERE id IN (SELECT id FROM _mig16_dupes);
--> statement-breakpoint
UPDATE followups SET status='Cancelled' WHERE id IN (SELECT 'FU-'||id FROM _mig16_dupes);
--> statement-breakpoint
DROP TABLE _mig16_dupes;
