import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  markets, 
  predictions, 
  trades, 
  subscriptions, 
  alerts, 
  notifications,
  type Market,
  type InsertMarket,
  type Prediction,
  type InsertPrediction,
  type Trade,
  type InsertTrade,
  type Subscription,
  type InsertSubscription,
  type Alert,
  type InsertAlert,
  type Notification,
  type InsertNotification
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ User Operations ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "stripeCustomerId"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (user.subscriptionTier !== undefined) {
      values.subscriptionTier = user.subscriptionTier;
      updateSet.subscriptionTier = user.subscriptionTier;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ Market Operations ============

export async function upsertMarket(market: InsertMarket) {
  const db = await getDb();
  if (!db) return;

  await db.insert(markets).values(market).onDuplicateKeyUpdate({
    set: {
      title: market.title,
      question: market.question,
      description: market.description,
      currentPrice: market.currentPrice,
      volume24h: market.volume24h,
      totalVolume: market.totalVolume,
      lastTradeTimestamp: market.lastTradeTimestamp,
      updatedAt: new Date(),
    },
  });
}

export async function getMarkets(filters?: {
  category?: string;
  country?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(markets);

  const conditions = [];
  if (filters?.category) {
    conditions.push(eq(markets.category, filters.category));
  }
  if (filters?.country) {
    conditions.push(eq(markets.country, filters.country));
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(markets.isActive, filters.isActive));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  query = query.orderBy(desc(markets.volume24h)) as any;

  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }
  if (filters?.offset) {
    query = query.offset(filters.offset) as any;
  }

  return await query;
}

export async function getMarketById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(markets).where(eq(markets.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getMarketByConditionId(conditionId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(markets).where(eq(markets.conditionId, conditionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ Prediction Operations ============

export async function createPrediction(prediction: InsertPrediction) {
  const db = await getDb();
  if (!db) return;

  await db.insert(predictions).values(prediction);
}

export async function getPredictionsByMarketId(marketId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(predictions).where(eq(predictions.marketId, marketId)).orderBy(desc(predictions.createdAt));
}

export async function getLatestPredictionByMarketId(marketId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(predictions).where(eq(predictions.marketId, marketId)).orderBy(desc(predictions.createdAt)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ Trade Operations ============

export async function createTrade(trade: InsertTrade) {
  const db = await getDb();
  if (!db) return;

  await db.insert(trades).values(trade);
}

export async function getTradesByMarketId(marketId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(trades).where(eq(trades.marketId, marketId)).orderBy(desc(trades.timestamp)).limit(limit);
}

export async function getWhaleTrades(limit = 100) {
  const db = await getDb();
  if (!db) return [];

  // 第一步：獲取所有大額交易和市場信息
  const tradesWithMarkets = await db
    .select({
      id: trades.id,
      tradeId: trades.tradeId,
      side: trades.side,
      price: trades.price,
      amount: trades.amount,
      timestamp: trades.timestamp,
      marketId: trades.marketId,
      marketTitle: markets.title,
      conditionId: markets.conditionId,
      category: markets.category,
    })
    .from(trades)
    .innerJoin(markets, eq(trades.marketId, markets.id))
    .where(eq(trades.isWhale, true))
    .orderBy(desc(trades.timestamp))
    .limit(limit);

  // 第二步：為每個交易獲取最新的預測
  const result = await Promise.all(
    tradesWithMarkets.map(async (trade) => {
      const latestPrediction = await getLatestPredictionByMarketId(trade.marketId);
      
      return {
        ...trade,
        predictionId: latestPrediction?.id || null,
        aiModel: latestPrediction?.aiModel || null,
        prediction: latestPrediction?.prediction || null,
        confidence: latestPrediction?.confidence || null,
        reasoning: latestPrediction?.reasoning || null,
        consensusVote: latestPrediction?.consensusVote || null,
        consensusConfidence: latestPrediction?.consensusConfidence || null,
        totalModels: latestPrediction?.totalModels || null,
        agreeModels: latestPrediction?.agreeModels || null,
        predictionCreatedAt: latestPrediction?.createdAt || null,
      };
    })
  );

  return result;
}

// ============ Subscription Operations ============

export async function createSubscription(subscription: InsertSubscription) {
  const db = await getDb();
  if (!db) return;

  await db.insert(subscriptions).values(subscription);
}

export async function updateSubscription(stripeSubscriptionId: string, updates: Partial<InsertSubscription>) {
  const db = await getDb();
  if (!db) return;

  await db.update(subscriptions).set(updates).where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
}

export async function getSubscriptionByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.createdAt)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getSubscriptionByStripeId(stripeSubscriptionId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ Alert Operations ============

export async function createAlert(alert: InsertAlert) {
  const db = await getDb();
  if (!db) return;

  await db.insert(alerts).values(alert);
}

export async function getAlertsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(alerts).where(eq(alerts.userId, userId)).orderBy(desc(alerts.createdAt));
}

export async function updateAlert(id: number, updates: Partial<InsertAlert>) {
  const db = await getDb();
  if (!db) return;

  await db.update(alerts).set(updates).where(eq(alerts.id, id));
}

export async function deleteAlert(id: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(alerts).where(eq(alerts.id, id));
}

// ============ Notification Operations ============

export async function createNotification(notification: InsertNotification) {
  const db = await getDb();
  if (!db) return;

  await db.insert(notifications).values(notification);
}

export async function getNotificationsByUserId(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function markNotificationAsRead(id: number) {
  const db = await getDb();
  if (!db) return;

  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;

  const result = await db.select({ count: sql<number>`count(*)` }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result[0]?.count ?? 0;
}


// ============ Address Operations ============
// 注意：由於 addresses 表是通過 SQL 直接創建的，而不是通過 drizzle schema，
// 所以這裡我們返回簡單的模擬數據作為演示。
// 待後續完善 drizzle schema 後再使用真實數據。

/**
 * 獲取地址列表（模擬數據）
 */
export async function getAddresses(params: {
  limit?: number;
  offset?: number;
}) {
  // 模擬數據
  const mockAddresses = [
    {
      id: 1,
      address: '0x8f3ff3c5750c20479f68db28407912bd8df67afa',
      total_volume: 1500000,
      total_trades: 245,
      avg_trade_size: 6122.45,
      win_rate: 72.5,
      suspicion_score: 85,
      is_suspicious: true,
      first_seen_at: new Date('2024-01-15'),
      last_active_at: new Date('2024-12-08')
    },
    {
      id: 2,
      address: '0x742d35cc6634c0532925a3b844bc9e7595f0beb',
      total_volume: 890000,
      total_trades: 156,
      avg_trade_size: 5705.13,
      win_rate: 68.2,
      suspicion_score: 78,
      is_suspicious: true,
      first_seen_at: new Date('2024-02-20'),
      last_active_at: new Date('2024-12-07')
    },
    {
      id: 3,
      address: '0x1234567890abcdef1234567890abcdef12345678',
      total_volume: 650000,
      total_trades: 98,
      avg_trade_size: 6632.65,
      win_rate: 65.3,
      suspicion_score: 72,
      is_suspicious: true,
      first_seen_at: new Date('2024-03-10'),
      last_active_at: new Date('2024-12-06')
    }
  ];

  const { limit = 20, offset = 0 } = params;
  return mockAddresses.slice(offset, offset + limit);
}

/**
 * 根據 ID 獲取地址詳情（模擬數據）
 */
export async function getAddressById(addressId: number) {
  const addresses = await getAddresses({ limit: 100 });
  return addresses.find(a => a.id === addressId) || null;
}

/**
 * 獲取地址的交易記錄（模擬數據）
 */
export async function getAddressTrades(addressId: number, params: {
  limit?: number;
  offset?: number;
}) {
  // 模擬數據
  return [];
}

/**
 * 獲取地址排行榜（模擬數據）
 */
export async function getAddressLeaderboard(params: {
  metric?: 'suspicion_score' | 'win_rate' | 'total_volume';
  limit?: number;
}) {
  const { limit = 10 } = params;
  const addresses = await getAddresses({ limit });
  return addresses;
}

/**
 * 獲取地址統計數據（模擬數據）
 */
export async function getAddressStats() {
  return {
    total_addresses: 100,
    suspicious_addresses: 15,
    avg_suspicion_score: 45.2,
    avg_win_rate: 55.8,
    total_volume: 8500000,
    total_trades: 2450
  };
}
