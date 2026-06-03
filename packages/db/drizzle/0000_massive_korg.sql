CREATE TABLE `calendar_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gcal_id` text NOT NULL,
	`title` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`is_all_day` integer DEFAULT false NOT NULL,
	`location` text,
	`attendee_person_ids` text DEFAULT '[]' NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_events_gcal_id_unique` ON `calendar_events` (`gcal_id`);--> statement-breakpoint
CREATE TABLE `email_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gmail_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`from_person_id` integer,
	`to_person_ids` text DEFAULT '[]' NOT NULL,
	`subject` text,
	`snippet` text,
	`received_at` integer NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`labels` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`from_person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_messages_gmail_id_unique` ON `email_messages` (`gmail_id`);--> statement-breakpoint
CREATE TABLE `extracted_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_email_id` integer NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`from_person_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`source_email_id`) REFERENCES `email_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`display_name` text NOT NULL,
	`relationship` text DEFAULT 'unknown' NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL,
	`known_emails` text DEFAULT '[]' NOT NULL,
	`known_phones` text DEFAULT '[]' NOT NULL,
	`known_handles` text DEFAULT '[]' NOT NULL,
	`birthday` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`connector` text NOT NULL,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer,
	`status` text DEFAULT 'running' NOT NULL,
	`error` text,
	`items_synced` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`setup_step` text DEFAULT 'welcome' NOT NULL,
	`backfill_days_email` integer DEFAULT 30 NOT NULL,
	`backfill_days_calendar` integer DEFAULT 60 NOT NULL,
	`poll_interval_seconds` integer DEFAULT 120 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
