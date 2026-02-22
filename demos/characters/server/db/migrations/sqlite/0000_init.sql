CREATE TABLE `app_agent_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`avatar` text DEFAULT '' NOT NULL,
	`username` text DEFAULT '' NOT NULL,
	`provider` text NOT NULL,
	`provider_id` text NOT NULL,
	`password_hash` text,
	`role` text DEFAULT 'registered' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_agent_users_email_unique` ON `app_agent_users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `app_agent_users_provider_id_idx` ON `app_agent_users` (`provider`,`provider_id`);--> statement-breakpoint
CREATE TABLE `app_agent_auth_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_id` text NOT NULL,
	`provider_email` text,
	`password_hash` text,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `app_agent_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_methods_provider_id_idx` ON `app_agent_auth_methods` (`provider`,`provider_id`);--> statement-breakpoint
CREATE INDEX `auth_methods_user_id_idx` ON `app_agent_auth_methods` (`user_id`);
