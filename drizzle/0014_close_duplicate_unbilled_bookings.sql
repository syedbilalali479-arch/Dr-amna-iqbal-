-- A patient booked (reception / WhatsApp) and was then billed through "Walk-in & bill", which created a
-- second, paid appointment the same day. The original booking stayed "Unpaid". Close such duplicates:
-- same clinic, date, phone and name; the booking has no bill; the other appointment has a finalized paid bill.
CREATE TEMP TABLE _mig14_dupes AS
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
DELETE FROM _mig14_dupes WHERE paid_id IS NULL;
--> statement-breakpoint
INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail)
SELECT 'AUD-MIG14-'||lower(hex(randomblob(8))),clinic_id,'system','CLOSE_DUPLICATE_BOOKING','appointments',id,
       json_object('before_status',old_status,'after_status','Cancelled','paid_appointment_id',paid_id,'reason','Unbilled booking duplicated by a paid walk-in the same day (migration 0014)')
FROM _mig14_dupes;
--> statement-breakpoint
UPDATE appointments
SET status='Cancelled',
    notes=trim(coalesce(notes,'')||' [Duplicate booking: patient was billed and paid on walk-in appointment '||(SELECT paid_id FROM _mig14_dupes m WHERE m.id=appointments.id)||']')
WHERE id IN (SELECT id FROM _mig14_dupes);
--> statement-breakpoint
UPDATE followups SET status='Cancelled' WHERE id IN (SELECT 'FU-'||id FROM _mig14_dupes);
--> statement-breakpoint
DROP TABLE _mig14_dupes;
