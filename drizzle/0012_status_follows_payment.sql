-- Appointment status now follows the bill:
--   paid / partially paid bill  -> Confirmed
--   no bill or unpaid bill      -> Awaiting Payment
-- Completed, Cancelled, No-show and Rescheduled appointments are left untouched.
INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail)
SELECT 'AUD-MIG12-'||lower(hex(randomblob(8))),clinic_id,'system','STATUS_MIGRATION','appointments',id,
       json_object('before',status,'after',CASE WHEN payment_status IN ('Paid','Partially Paid') THEN 'Confirmed' ELSE 'Awaiting Payment' END,'payment_status',payment_status,'reason','Status now follows payment (migration 0012)')
FROM appointments
WHERE status IN ('Pending','Confirmed','Arrived','Waiting','In Consultation')
  AND status <> CASE WHEN payment_status IN ('Paid','Partially Paid') THEN 'Confirmed' ELSE 'Awaiting Payment' END;
--> statement-breakpoint
UPDATE appointments SET status='Confirmed'
WHERE status IN ('Pending','Arrived','Waiting','In Consultation') AND payment_status IN ('Paid','Partially Paid');
--> statement-breakpoint
UPDATE appointments SET status='Awaiting Payment'
WHERE status IN ('Pending','Confirmed','Arrived','Waiting','In Consultation') AND payment_status NOT IN ('Paid','Partially Paid');
