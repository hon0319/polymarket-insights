ALTER TABLE `trades` MODIFY COLUMN `marketId` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `trades` MODIFY COLUMN `marketId` int;--> statement-breakpoint
ALTER TABLE `trades` MODIFY COLUMN `makerAmount` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `trades` MODIFY COLUMN `takerAmount` bigint NOT NULL;