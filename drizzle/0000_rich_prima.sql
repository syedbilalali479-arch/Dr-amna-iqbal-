CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`patient_name` text NOT NULL,
	`phone` text NOT NULL,
	`doctor` text NOT NULL,
	`service` text NOT NULL,
	`appointment_date` text NOT NULL,
	`appointment_time` text NOT NULL,
	`status` text DEFAULT 'Confirmed' NOT NULL,
	`payment_status` text DEFAULT 'Unpaid' NOT NULL,
	`token` text,
	`source` text DEFAULT 'Reception' NOT NULL,
	`price` real DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '',
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appointment_token_unique` ON `appointments` (`clinic_id`,`appointment_date`,`token`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`detail` text DEFAULT '',
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clinics` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`timezone` text DEFAULT 'Asia/Karachi' NOT NULL,
	`owner_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`contact_name` text NOT NULL,
	`phone` text NOT NULL,
	`last_message` text NOT NULL,
	`mode` text DEFAULT 'AI' NOT NULL,
	`intent` text DEFAULT 'Other',
	`status` text DEFAULT 'Open' NOT NULL,
	`unread` integer DEFAULT 0 NOT NULL,
	`state` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `followups` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`patient_name` text NOT NULL,
	`doctor` text NOT NULL,
	`reason` text NOT NULL,
	`due_date` text NOT NULL,
	`priority` text DEFAULT 'Normal' NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`patient_name` text NOT NULL,
	`service` text NOT NULL,
	`total` real NOT NULL,
	`discount` real DEFAULT 0 NOT NULL,
	`paid` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Unpaid' NOT NULL,
	`method` text DEFAULT 'Cash',
	`reference` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`source` text DEFAULT 'Unknown' NOT NULL,
	`service` text DEFAULT '',
	`temperature` text DEFAULT 'Warm' NOT NULL,
	`stage` text DEFAULT 'New' NOT NULL,
	`notes` text DEFAULT '',
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `medicines` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`name` text NOT NULL,
	`generic_name` text DEFAULT '',
	`batch` text NOT NULL,
	`expiry` text NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`minimum_stock` integer DEFAULT 10 NOT NULL,
	`purchase_rate` real DEFAULT 0 NOT NULL,
	`selling_price` real DEFAULT 0 NOT NULL,
	`vendor` text DEFAULT '',
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `medicine_batch_unique` ON `medicines` (`clinic_id`,`name`,`batch`);--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`age` integer,
	`gender` text,
	`allergies` text DEFAULT '',
	`notes` text DEFAULT '',
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prescriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`patient_name` text NOT NULL,
	`doctor` text NOT NULL,
	`diagnosis` text NOT NULL,
	`medicines` text NOT NULL,
	`instructions` text DEFAULT '',
	`status` text DEFAULT 'Draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`approved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `promotions` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`name` text NOT NULL,
	`service` text NOT NULL,
	`original_price` real NOT NULL,
	`offer_price` real NOT NULL,
	`start_date` text NOT NULL,
	`expiry_date` text NOT NULL,
	`channels` text DEFAULT 'Website' NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `treatment_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`patient_name` text NOT NULL,
	`name` text NOT NULL,
	`total_sessions` integer NOT NULL,
	`completed_sessions` integer DEFAULT 0 NOT NULL,
	`total_price` real DEFAULT 0 NOT NULL,
	`paid` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
