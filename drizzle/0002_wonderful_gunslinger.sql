-- addresses 表已存在，跳過創建

-- 創建 sync_state 表
CREATE TABLE IF NOT EXISTS `sync_state` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceName` varchar(100) NOT NULL,
	`lastTimestamp` int NOT NULL,
	`lastSyncAt` timestamp NOT NULL,
	`status` enum('idle','running','error') NOT NULL DEFAULT 'idle',
	`errorMessage` text,
	`totalProcessed` int DEFAULT 0,
	`lastBatchSize` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sync_state_id` PRIMARY KEY(`id`),
	CONSTRAINT `sync_state_serviceName_unique` UNIQUE(`serviceName`)
);
--> statement-breakpoint

-- 擴展 trades 表
ALTER TABLE `trades` ADD COLUMN IF NOT EXISTS `conditionId` varchar(255);--> statement-breakpoint
ALTER TABLE `trades` ADD COLUMN IF NOT EXISTS `transactionHash` varchar(66) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `trades` ADD COLUMN IF NOT EXISTS `makerAddress` varchar(42) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `trades` ADD COLUMN IF NOT EXISTS `makerAssetId` varchar(255) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `trades` ADD COLUMN IF NOT EXISTS `makerAmount` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `trades` ADD COLUMN IF NOT EXISTS `takerAddress` varchar(42) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `trades` ADD COLUMN IF NOT EXISTS `takerAssetId` varchar(255) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `trades` ADD COLUMN IF NOT EXISTS `takerAmount` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `trades` ADD COLUMN IF NOT EXISTS `fee` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `trades` ADD COLUMN IF NOT EXISTS `isSuspicious` boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- 為 trades 表創建索引
CREATE INDEX IF NOT EXISTS `maker_address_idx` ON `trades` (`makerAddress`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `taker_address_idx` ON `trades` (`takerAddress`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `timestamp_idx` ON `trades` (`timestamp`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `transaction_hash_idx` ON `trades` (`transactionHash`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `market_timestamp_idx` ON `trades` (`marketId`,`timestamp`);
