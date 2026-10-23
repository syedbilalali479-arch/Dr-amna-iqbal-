CREATE TABLE `ai_learning_events` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`conversation_id` text,
	`phone` text NOT NULL,
	`message` text NOT NULL,
	`deterministic_intent` text,
	`brain_intent` text,
	`resolved_intent` text NOT NULL,
	`confidence` real NOT NULL,
	`route` text NOT NULL,
	`outcome` text NOT NULL,
	`candidate_phrase` text,
	`review_status` text DEFAULT 'Observed' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversation_states` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`phone` text NOT NULL,
	`current_intent` text,
	`pending_intent` text,
	`known_fields` text DEFAULT '{}' NOT NULL,
	`missing_fields` text DEFAULT '[]' NOT NULL,
	`last_question` text,
	`last_action` text,
	`last_message_hash` text,
	`loop_count` integer DEFAULT 0 NOT NULL,
	`turn_count` integer DEFAULT 0 NOT NULL,
	`handoff` integer DEFAULT false NOT NULL,
	`expires_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_state_phone_unique` ON `conversation_states` (`clinic_id`,`phone`);--> statement-breakpoint
CREATE TABLE `intent_patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`intent` text NOT NULL,
	`phrase` text NOT NULL,
	`normalized_phrase` text NOT NULL,
	`language` text DEFAULT 'Roman Urdu' NOT NULL,
	`weight` real DEFAULT 1 NOT NULL,
	`hits` integer DEFAULT 0 NOT NULL,
	`success_count` integer DEFAULT 0 NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'Manual' NOT NULL,
	`status` text DEFAULT 'Approved' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `intent_pattern_unique` ON `intent_patterns` (`clinic_id`,`intent`,`normalized_phrase`);