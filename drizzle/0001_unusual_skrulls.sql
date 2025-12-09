CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`marketId` int,
	`alertType` enum('whale_trade','price_change','ai_prediction_change') NOT NULL,
	`threshold` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `markets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conditionId` varchar(255) NOT NULL,
	`title` text NOT NULL,
	`question` text,
	`description` text,
	`category` varchar(100),
	`country` varchar(100),
	`endDate` timestamp,
	`currentPrice` int NOT NULL,
	`volume24h` int DEFAULT 0,
	`totalVolume` int DEFAULT 0,
	`lastTradeTimestamp` timestamp,
	`lastAnalyzed` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `markets_id` PRIMARY KEY(`id`),
	CONSTRAINT `markets_conditionId_unique` UNIQUE(`conditionId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`alertId` int,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`type` enum('whale_trade','price_change','ai_prediction_change','system') NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `predictions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`marketId` int NOT NULL,
	`aiModel` varchar(100) NOT NULL,
	`prediction` enum('YES','NO','UNCERTAIN') NOT NULL,
	`confidence` int NOT NULL,
	`reasoning` text,
	`consensusVote` enum('YES','NO','UNCERTAIN'),
	`consensusConfidence` int,
	`totalModels` int,
	`agreeModels` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `predictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripeSubscriptionId` varchar(255) NOT NULL,
	`tier` enum('basic','pro','enterprise') NOT NULL,
	`status` enum('active','canceled','past_due','unpaid') NOT NULL,
	`currentPeriodStart` timestamp NOT NULL,
	`currentPeriodEnd` timestamp NOT NULL,
	`cancelAtPeriodEnd` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_stripeSubscriptionId_unique` UNIQUE(`stripeSubscriptionId`)
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`marketId` int NOT NULL,
	`tradeId` varchar(255) NOT NULL,
	`side` enum('YES','NO') NOT NULL,
	`price` int NOT NULL,
	`amount` int NOT NULL,
	`isWhale` boolean NOT NULL DEFAULT false,
	`timestamp` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trades_id` PRIMARY KEY(`id`),
	CONSTRAINT `trades_tradeId_unique` UNIQUE(`tradeId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionTier` enum('free','basic','pro','enterprise') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(255);