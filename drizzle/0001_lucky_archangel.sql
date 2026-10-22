CREATE TABLE `treatments` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '',
	`price` real DEFAULT 0 NOT NULL,
	`duration` integer DEFAULT 30 NOT NULL,
	`assigned_doctors` text DEFAULT 'Dr. Amna Iqbal' NOT NULL,
	`availability` text DEFAULT 'Mon–Sat' NOT NULL,
	`booking_instructions` text DEFAULT '',
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
