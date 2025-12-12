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

export async function getMarketCategoryStats() {
  const db = await getDb();
  if (!db) return [];

  try {
    // Get all active markets
    const allMarkets = await db.select().from(markets).where(eq(markets.isActive, true));
    
    // Group by category and calculate stats
    const categoryMap = new Map<string, { count: number; totalVolume: number }>();
    
    allMarkets.forEach(market => {
      const category = market.category || 'Other';
      const existing = categoryMap.get(category) || { count: 0, totalVolume: 0 };
      categoryMap.set(category, {
        count: existing.count + 1,
        totalVolume: existing.totalVolume + (market.totalVolume || 0)
      });
    });
    
    // Convert to array and sort by count
    return Array.from(categoryMap.entries())
      .map(([category, stats]) => ({
        category,
        count: stats.count,
        totalVolume: stats.totalVolume
      }))
      .sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error('[Database] Error getting category stats:', error);
    return [];
  }
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


/**
 * 獲取地址的交易歷史時間線（模擬數據）
 */
export async function getAddressTradeHistory(addressId: number, params: {
  limit?: number;
  offset?: number;
}) {
  const { limit = 50, offset = 0 } = params;
  
  // 模擬數據
  const mockTrades = [
    {
      id: 1,
      marketId: 1,
      marketTitle: 'Will Trump win 2024 election?',
      category: 'Politics',
      side: 'YES',
      amount: 15000,
      price: 0.65,
      timestamp: new Date('2024-12-08T10:30:00'),
      outcome: 'pending',
      profit: null
    },
    {
      id: 2,
      marketId: 2,
      marketTitle: 'Bitcoin above $100k by end of 2024?',
      category: 'Crypto',
      side: 'NO',
      amount: 8500,
      price: 0.45,
      timestamp: new Date('2024-12-07T15:20:00'),
      outcome: 'won',
      profit: 4675
    },
    {
      id: 3,
      marketId: 3,
      marketTitle: 'Lakers win NBA championship 2025?',
      category: 'Sports',
      side: 'YES',
      amount: 12000,
      price: 0.30,
      timestamp: new Date('2024-12-06T09:15:00'),
      outcome: 'lost',
      profit: -12000
    }
  ];
  
  return mockTrades.slice(offset, offset + limit);
}

/**
 * 獲取地址的市場表現分析（按類別）（模擬數據）
 */
export async function getAddressMarketPerformance(addressId: number) {
  // 模擬數據
  return [
    {
      category: 'Politics',
      total_trades: 85,
      total_volume: 520000,
      win_rate: 75.3,
      avg_profit: 3200,
      roi: 0.52
    },
    {
      category: 'Crypto',
      total_trades: 62,
      total_volume: 380000,
      win_rate: 71.0,
      avg_profit: 2850,
      roi: 0.47
    },
    {
      category: 'Sports',
      total_trades: 48,
      total_volume: 290000,
      win_rate: 68.8,
      avg_profit: 2100,
      roi: 0.35
    },
    {
      category: 'Other',
      total_trades: 50,
      total_volume: 310000,
      win_rate: 66.0,
      avg_profit: 1950,
      roi: 0.31
    }
  ];
}

/**
 * 獲取地址的勝率趨勢數據（模擬數據）
 */
export async function getAddressWinRateTrend(addressId: number) {
  // 模擬數據 - 過去 12 個月的勝率趨勢
  return [
    { month: '2024-01', win_rate: 65.0, trades: 18 },
    { month: '2024-02', win_rate: 68.5, trades: 22 },
    { month: '2024-03', win_rate: 70.2, trades: 25 },
    { month: '2024-04', win_rate: 72.8, trades: 28 },
    { month: '2024-05', win_rate: 71.5, trades: 24 },
    { month: '2024-06', win_rate: 73.9, trades: 30 },
    { month: '2024-07', win_rate: 75.1, trades: 32 },
    { month: '2024-08', win_rate: 74.3, trades: 29 },
    { month: '2024-09', win_rate: 76.2, trades: 35 },
    { month: '2024-10', win_rate: 75.8, trades: 33 },
    { month: '2024-11', win_rate: 74.5, trades: 31 },
    { month: '2024-12', win_rate: 72.5, trades: 18 }
  ];
}

/**
 * 獲取地址的市場類別專注度（模擬數據）
 */
export async function getAddressCategoryFocus(addressId: number) {
  // 模擬數據
  return [
    { category: 'Politics', percentage: 34.7, trades: 85 },
    { category: 'Crypto', percentage: 25.3, trades: 62 },
    { category: 'Sports', percentage: 19.6, trades: 48 },
    { category: 'Other', percentage: 20.4, trades: 50 }
  ];
}


// ============ Alert Subscription Operations ============

export interface AlertSubscription {
  id: number;
  user_id: number;
  subscription_type: 'address' | 'market' | 'category';
  target_id: string;
  target_name: string | null;
  alert_types: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface InsertAlertSubscription {
  user_id: number;
  subscription_type: 'address' | 'market' | 'category';
  target_id: string;
  target_name?: string;
  alert_types: string[];
  is_active?: boolean;
}

export interface AlertNotification {
  id: number;
  user_id: number;
  subscription_id: number;
  alert_type: 'suspicious_trade' | 'large_trade' | 'price_spike' | 'high_suspicion_address';
  title: string;
  message: string;
  metadata: any;
  is_read: boolean;
  created_at: Date;
}

export interface InsertAlertNotification {
  user_id: number;
  subscription_id: number;
  alert_type: 'suspicious_trade' | 'large_trade' | 'price_spike' | 'high_suspicion_address';
  title: string;
  message: string;
  metadata?: any;
  is_read?: boolean;
}

/**
 * 創建警報訂閱
 */
export async function createAlertSubscription(subscription: InsertAlertSubscription): Promise<AlertSubscription | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create alert subscription: database not available");
    return null;
  }

  try {
    await db.execute(sql`
      INSERT INTO alert_subscriptions 
      (user_id, subscription_type, target_id, target_name, alert_types, is_active)
      VALUES (
        ${subscription.user_id},
        ${subscription.subscription_type},
        ${subscription.target_id},
        ${subscription.target_name || null},
        ${JSON.stringify(subscription.alert_types)},
        ${subscription.is_active ?? true}
      )
      ON DUPLICATE KEY UPDATE
        alert_types = VALUES(alert_types),
        is_active = VALUES(is_active),
        updated_at = CURRENT_TIMESTAMP
    `);

    // 獲取插入的訂閱
    const subscriptions: any = await db.execute(sql`
      SELECT * FROM alert_subscriptions
      WHERE user_id = ${subscription.user_id}
        AND subscription_type = ${subscription.subscription_type}
        AND target_id = ${subscription.target_id}
      LIMIT 1
    `);

    if (subscriptions && subscriptions[0] && subscriptions[0].length > 0) {
      const row = subscriptions[0][0] as any;
      return {
        ...row,
        alert_types: JSON.parse(row.alert_types),
        is_active: Boolean(row.is_active)
      };
    }

    return null;
  } catch (error) {
    console.error("[Database] Error creating alert subscription:", error);
    return null;
  }
}

/**
 * 獲取用戶的所有訂閱
 */
export async function getUserAlertSubscriptions(userId: number): Promise<AlertSubscription[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user alert subscriptions: database not available");
    return [];
  }

  try {
    const result: any = await db.execute(sql`
      SELECT * FROM alert_subscriptions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `);

    if (!result || !result[0]) return [];

    return result[0].map((row: any) => ({
      ...row,
      alert_types: JSON.parse(row.alert_types),
      is_active: Boolean(row.is_active)
    }));
  } catch (error) {
    console.error("[Database] Error getting user alert subscriptions:", error);
    return [];
  }
}

/**
 * 獲取特定訂閱
 */
export async function getAlertSubscription(subscriptionId: number): Promise<AlertSubscription | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get alert subscription: database not available");
    return null;
  }

  try {
    const result: any = await db.execute(sql`
      SELECT * FROM alert_subscriptions
      WHERE id = ${subscriptionId}
      LIMIT 1
    `);

    if (result && result[0] && result[0].length > 0) {
      const row = result[0][0] as any;
      return {
        ...row,
        alert_types: JSON.parse(row.alert_types),
        is_active: Boolean(row.is_active)
      };
    }

    return null;
  } catch (error) {
    console.error("[Database] Error getting alert subscription:", error);
    return null;
  }
}

/**
 * 更新訂閱
 */
export async function updateAlertSubscription(
  subscriptionId: number,
  updates: Partial<InsertAlertSubscription>
): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update alert subscription: database not available");
    return false;
  }

  try {
    // 先獲取現有訂閱
    const existing = await getAlertSubscription(subscriptionId);
    if (!existing) {
      return false;
    }

    // 合併更新
    const merged = {
      ...existing,
      ...updates
    };

    // 重新創建（使用 ON DUPLICATE KEY UPDATE）
    await db.execute(sql`
      UPDATE alert_subscriptions
      SET 
        alert_types = ${JSON.stringify(merged.alert_types)},
        is_active = ${merged.is_active},
        target_name = ${merged.target_name || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${subscriptionId}
    `);

    return true;
  } catch (error) {
    console.error("[Database] Error updating alert subscription:", error);
    return false;
  }
}

/**
 * 刪除訂閱
 */
export async function deleteAlertSubscription(subscriptionId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete alert subscription: database not available");
    return false;
  }

  try {
    await db.execute(sql`
      DELETE FROM alert_subscriptions
      WHERE id = ${subscriptionId}
    `);

    return true;
  } catch (error) {
    console.error("[Database] Error deleting alert subscription:", error);
    return false;
  }
}

/**
 * 創建警報通知
 */
export async function createAlertNotification(notification: InsertAlertNotification): Promise<AlertNotification | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create alert notification: database not available");
    return null;
  }

  try {
    await db.execute(sql`
      INSERT INTO alert_notifications
      (user_id, subscription_id, alert_type, title, message, metadata, is_read)
      VALUES (
        ${notification.user_id},
        ${notification.subscription_id},
        ${notification.alert_type},
        ${notification.title},
        ${notification.message},
        ${notification.metadata ? JSON.stringify(notification.metadata) : null},
        ${notification.is_read ?? false}
      )
    `);

    // 獲取插入的通知
    const notifications: any = await db.execute(sql`
      SELECT * FROM alert_notifications
      WHERE id = LAST_INSERT_ID()
      LIMIT 1
    `);

    if (notifications && notifications[0] && notifications[0].length > 0) {
      const row = notifications[0][0] as any;
      return {
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
        is_read: Boolean(row.is_read)
      };
    }

    return null;
  } catch (error) {
    console.error("[Database] Error creating alert notification:", error);
    return null;
  }
}

/**
 * 獲取用戶的通知
 */
export async function getUserAlertNotifications(
  userId: number,
  limit: number = 50,
  offset: number = 0
): Promise<AlertNotification[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user alert notifications: database not available");
    return [];
  }

  try {
    const result: any = await db.execute(sql`
      SELECT * FROM alert_notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    if (!result || !result[0]) return [];

    return result[0].map((row: any) => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      is_read: Boolean(row.is_read)
    }));
  } catch (error) {
    console.error("[Database] Error getting user alert notifications:", error);
    return [];
  }
}

/**
 * 獲取未讀警報通知數量
 */
export async function getUnreadAlertNotificationCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get unread alert notification count: database not available");
    return 0;
  }

  try {
    const result: any = await db.execute(sql`
      SELECT COUNT(*) as count FROM alert_notifications
      WHERE user_id = ${userId} AND is_read = FALSE
    `);

    if (result && result[0] && result[0].length > 0) {
      return result[0][0].count;
    }

    return 0;
  } catch (error) {
    console.error("[Database] Error getting unread alert notification count:", error);
    return 0;
  }
}

/**
 * 標記警報通知為已讀
 */
export async function markAlertNotificationAsRead(notificationId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot mark alert notification as read: database not available");
    return false;
  }

  try {
    await db.execute(sql`
      UPDATE alert_notifications
      SET is_read = TRUE
      WHERE id = ${notificationId}
    `);

    return true;
  } catch (error) {
    console.error("[Database] Error marking alert notification as read:", error);
    return false;
  }
}

/**
 * 標記所有通知為已讀
 */
export async function markAllNotificationsAsRead(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot mark all notifications as read: database not available");
    return false;
  }

  try {
    await db.execute(sql`
      UPDATE alert_notifications
      SET is_read = TRUE
      WHERE user_id = ${userId} AND is_read = FALSE
    `);

    return true;
  } catch (error) {
    console.error("[Database] Error marking all notifications as read:", error);
    return false;
  }
}

/**
 * 獲取活躍的訂閱（用於警報檢測）
 */
export async function getActiveSubscriptionsByType(
  subscriptionType: 'address' | 'market' | 'category',
  targetId?: string
): Promise<AlertSubscription[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get active subscriptions: database not available");
    return [];
  }

  try {
    let query = sql`
      SELECT * FROM alert_subscriptions
      WHERE subscription_type = ${subscriptionType}
        AND is_active = TRUE
    `;

    if (targetId) {
      query = sql`${query} AND target_id = ${targetId}`;
    }

    const result: any = await db.execute(query);

    if (!result || !result[0]) return [];

    return result[0].map((row: any) => ({
      ...row,
      alert_types: JSON.parse(row.alert_types),
      is_active: Boolean(row.is_active)
    }));
  } catch (error) {
    console.error("[Database] Error getting active subscriptions:", error);
    return [];
  }
}


// ============ Address Comparison Operations ============

export async function compareAddresses(addressIds: number[]) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot compare addresses: database not available');
    return [];
  }

  try {
    // 使用 IN 子句查詢多個地址
    const result: any = await db.execute(sql`
      SELECT 
        id,
        address,
        suspicion_score,
        win_rate,
        total_volume,
        total_trades,
        avg_trade_size,
        win_rate_high_score,
        early_trading_score,
        large_trade_score,
        timing_score,
        selectivity_score,
        first_seen_at,
        last_active_at
      FROM addresses
      WHERE id IN (${addressIds.join(',')})
    `);
    return result[0] as any[];
  } catch (error) {
    console.error('[Database] Error comparing addresses:', error);
    return [];
  }
}

export async function searchAddresses(searchTerm: string, limit: number = 20) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot search addresses: database not available');
    return [];
  }

  try {
    // 嘗試將搜索詞解析為數字 ID
    const numericId = parseInt(searchTerm);
    const searchPattern = `%${searchTerm}%`;

    const result: any = await db.execute(sql`
      SELECT 
        id,
        address,
        suspicion_score,
        win_rate,
        total_volume,
        total_trades
      FROM addresses
      WHERE address LIKE ${searchPattern} OR id = ${isNaN(numericId) ? 0 : numericId}
      ORDER BY total_volume DESC
      LIMIT ${limit}
    `);
    return result[0] as any[];
  } catch (error) {
    console.error('[Database] Error searching addresses:', error);
    return [];
  }
}
