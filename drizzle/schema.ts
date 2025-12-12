import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  subscriptionTier: mysqlEnum("subscriptionTier", ["free", "basic", "pro", "enterprise"]).default("free").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Polymarket 市場數據表
 */
export const markets = mysqlTable("markets", {
  id: int("id").autoincrement().primaryKey(),
  conditionId: varchar("conditionId", { length: 255 }).notNull().unique(),
  title: text("title").notNull(),
  question: text("question"),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  country: varchar("country", { length: 100 }),
  endDate: timestamp("endDate"),
  currentPrice: int("currentPrice").notNull(), // 以分為單位（避免浮點數問題）
  volume24h: int("volume24h").default(0), // 24小時交易量（美元，以分為單位）
  totalVolume: int("totalVolume").default(0), // 總交易量
  lastTradeTimestamp: timestamp("lastTradeTimestamp"),
  lastAnalyzed: timestamp("lastAnalyzed"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Market = typeof markets.$inferSelect;
export type InsertMarket = typeof markets.$inferInsert;

/**
 * AI 預測記錄表
 */
export const predictions = mysqlTable("predictions", {
  id: int("id").autoincrement().primaryKey(),
  marketId: int("marketId").notNull(),
  aiModel: varchar("aiModel", { length: 100 }).notNull(),
  prediction: mysqlEnum("prediction", ["YES", "NO", "UNCERTAIN"]).notNull(),
  confidence: int("confidence").notNull(), // 信心指數 0-100
  reasoning: text("reasoning"),
  consensusVote: mysqlEnum("consensusVote", ["YES", "NO", "UNCERTAIN"]),
  consensusConfidence: int("consensusConfidence"), // 共識信心指數
  totalModels: int("totalModels"), // 參與投票的模型總數
  agreeModels: int("agreeModels"), // 同意的模型數量
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Prediction = typeof predictions.$inferSelect;
export type InsertPrediction = typeof predictions.$inferInsert;

/**
 * 交易記錄表
 */
export const trades = mysqlTable("trades", {
  id: int("id").autoincrement().primaryKey(),
  
  // 市場信息
  marketId: int("marketId").notNull(),
  conditionId: varchar("conditionId", { length: 255 }),
  
  // 交易基本信息
  tradeId: varchar("tradeId", { length: 255 }).notNull().unique(),
  transactionHash: varchar("transactionHash", { length: 66 }).notNull(),
  
  // Maker 信息
  makerAddress: varchar("makerAddress", { length: 42 }).notNull(),
  makerAssetId: varchar("makerAssetId", { length: 255 }).notNull(),
  makerAmount: int("makerAmount").notNull(), // 原始金額（以最小單位）
  
  // Taker 信息
  takerAddress: varchar("takerAddress", { length: 42 }).notNull(),
  takerAssetId: varchar("takerAssetId", { length: 255 }).notNull(),
  takerAmount: int("takerAmount").notNull(),
  
  // 交易詳情
  side: mysqlEnum("side", ["YES", "NO"]).notNull(),
  price: int("price").notNull(), // 以分為單位
  amount: int("amount").notNull(), // 交易金額（美元，以分為單位）
  fee: int("fee").default(0), // 手續費
  
  // 標記
  isWhale: boolean("isWhale").default(false).notNull(),
  isSuspicious: boolean("isSuspicious").default(false).notNull(),
  
  // 時間戳
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  // 索引優化
  makerAddressIdx: index("maker_address_idx").on(table.makerAddress),
  takerAddressIdx: index("taker_address_idx").on(table.takerAddress),
  timestampIdx: index("timestamp_idx").on(table.timestamp),
  transactionHashIdx: index("transaction_hash_idx").on(table.transactionHash),
  marketTimestampIdx: index("market_timestamp_idx").on(table.marketId, table.timestamp),
}));

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;

/**
 * 訂閱記錄表
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }).notNull().unique(),
  tier: mysqlEnum("tier", ["basic", "pro", "enterprise"]).notNull(),
  status: mysqlEnum("status", ["active", "canceled", "past_due", "unpaid"]).notNull(),
  currentPeriodStart: timestamp("currentPeriodStart").notNull(),
  currentPeriodEnd: timestamp("currentPeriodEnd").notNull(),
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * 用戶警報設定表
 */
export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  marketId: int("marketId"),
  alertType: mysqlEnum("alertType", ["whale_trade", "price_change", "ai_prediction_change"]).notNull(),
  threshold: int("threshold"), // 閾值（例如：大額交易金額）
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;

/**
 * 通知記錄表
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  alertId: int("alertId"),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: mysqlEnum("type", ["whale_trade", "price_change", "ai_prediction_change", "system"]).notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * 地址追蹤表（與 Python backend 現有表結構保持一致）
 */
export const addresses = mysqlTable("addresses", {
  id: int("id").autoincrement().primaryKey(),
  
  // 地址信息
  address: varchar("address", { length: 42 }).notNull().unique(),
  
  // 時間戳
  first_seen_at: timestamp("first_seen_at").defaultNow(),
  last_active_at: timestamp("last_active_at"),
  
  // 統計數據
  total_trades: int("total_trades").default(0),
  total_volume: decimal("total_volume", { precision: 20, scale: 6 }).default("0"),
  
  // 勝負統計
  win_count: int("win_count").default(0),
  loss_count: int("loss_count").default(0),
  settled_count: int("settled_count").default(0),
  win_rate: decimal("win_rate", { precision: 5, scale: 2 }),
  
  // 交易特徵
  avg_trade_size: decimal("avg_trade_size", { precision: 20, scale: 6 }),
  
  // 可疑分析
  is_suspicious: boolean("is_suspicious").default(false),
  suspicion_score: decimal("suspicion_score", { precision: 5, scale: 2 }),
  
  // 系統時間戳
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export type Address = typeof addresses.$inferSelect;
export type InsertAddress = typeof addresses.$inferInsert;

/**
 * 同步狀態表
 */
export const syncState = mysqlTable("sync_state", {
  id: int("id").autoincrement().primaryKey(),
  
  // 服務名稱
  serviceName: varchar("serviceName", { length: 100 }).notNull().unique(),
  
  // 同步狀態
  lastTimestamp: int("lastTimestamp").notNull(), // 最後同步的時間戳
  lastSyncAt: timestamp("lastSyncAt").notNull(), // 最後同步時間
  status: mysqlEnum("status", ["idle", "running", "error"]).default("idle").notNull(),
  errorMessage: text("errorMessage"),
  
  // 統計
  totalProcessed: int("totalProcessed").default(0), // 總處理數量
  lastBatchSize: int("lastBatchSize").default(0), // 最後一批的大小
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SyncState = typeof syncState.$inferSelect;
export type InsertSyncState = typeof syncState.$inferInsert;
