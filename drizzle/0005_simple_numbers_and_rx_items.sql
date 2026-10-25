CREATE TABLE `record_numbers` (
	`clinic_id` text NOT NULL,
	`kind` text NOT NULL,
	`entity_id` text NOT NULL,
	`number` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `record_number_entity` ON `record_numbers` (`clinic_id`,`kind`,`entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `record_number_sequence` ON `record_numbers` (`clinic_id`,`kind`,`number`);--> statement-breakpoint
ALTER TABLE `prescriptions` ADD `medicine_items` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `prescriptions` ADD `medicine_notes` text DEFAULT '';
--> statement-breakpoint
INSERT INTO record_numbers SELECT clinic_id,'patients',id,row_number() OVER(PARTITION BY clinic_id ORDER BY created_at,id) FROM patients;

--> statement-breakpoint
INSERT INTO record_numbers SELECT clinic_id,'appointments',id,row_number() OVER(PARTITION BY clinic_id ORDER BY created_at,id) FROM appointments;

--> statement-breakpoint
INSERT INTO record_numbers SELECT clinic_id,'prescriptions',id,row_number() OVER(PARTITION BY clinic_id ORDER BY created_at,id) FROM prescriptions;

--> statement-breakpoint
INSERT INTO record_numbers SELECT clinic_id,'medicines',id,row_number() OVER(PARTITION BY clinic_id ORDER BY created_at,id) FROM medicines;

--> statement-breakpoint
INSERT INTO record_numbers SELECT clinic_id,'leads',id,row_number() OVER(PARTITION BY clinic_id ORDER BY created_at,id) FROM leads;

--> statement-breakpoint
INSERT INTO record_numbers SELECT clinic_id,'followups',id,row_number() OVER(PARTITION BY clinic_id ORDER BY created_at,id) FROM followups;

--> statement-breakpoint
INSERT INTO record_numbers SELECT clinic_id,'plans',id,row_number() OVER(PARTITION BY clinic_id ORDER BY created_at,id) FROM treatment_plans;

--> statement-breakpoint
INSERT INTO record_numbers SELECT clinic_id,'promotions',id,row_number() OVER(PARTITION BY clinic_id ORDER BY created_at,id) FROM promotions;

--> statement-breakpoint
INSERT INTO record_numbers SELECT clinic_id,'treatments',id,row_number() OVER(PARTITION BY clinic_id ORDER BY created_at,id) FROM treatments;

--> statement-breakpoint
INSERT INTO record_numbers SELECT clinic_id,'conversations',id,row_number() OVER(PARTITION BY clinic_id ORDER BY created_at,id) FROM conversations;

--> statement-breakpoint
INSERT INTO record_numbers SELECT clinic_id,'patterns',id,row_number() OVER(PARTITION BY clinic_id ORDER BY created_at,id) FROM intent_patterns;

--> statement-breakpoint
INSERT INTO record_numbers SELECT clinic_id,'stock_movements',id,row_number() OVER(PARTITION BY clinic_id ORDER BY created_at,id) FROM stock_movements;

--> statement-breakpoint
INSERT INTO record_numbers SELECT clinic_id,kind,id,row_number() OVER(PARTITION BY clinic_id,kind ORDER BY created_at,id) FROM (SELECT clinic_id,kind,id,created_at FROM commerce_documents UNION ALL SELECT clinic_id,'invoices',id,created_at FROM invoices);
