ALTER TABLE `trades` MODIFY COLUMN `price` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `trades` MODIFY COLUMN `amount` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `trades` MODIFY COLUMN `fee` bigint;