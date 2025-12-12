/**
 * Address-related database operations
 * 地址相關的數據庫操作
 */

import { getDb } from './db';

/**
 * 獲取地址列表（真實數據）
 */
export async function getAddresses(params: {
  limit?: number;
  offset?: number;
  sortBy?: 'total_volume' | 'total_trades' | 'suspicion_score' | 'win_rate';
  sortOrder?: 'asc' | 'desc';
  search?: string;
}) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot get addresses: database not available');
    return [];
  }

  try {
    const { limit = 20, offset = 0, sortBy = 'total_volume', sortOrder = 'desc', search } = params;
    
    let query = `
      SELECT 
        id,
        address,
        total_volume,
        total_trades,
        avg_trade_size,
        win_rate,
        suspicion_score,
        is_suspicious,
        first_seen_at,
        last_active_at,
        created_at,
        updated_at
      FROM addresses
    `;
    
    // 添加搜索條件
    if (search) {
      query += ` WHERE address LIKE '%${search}%'`;
    }
    
    // 添加排序
    query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
    
    // 添加分頁
    query += ` LIMIT ${limit} OFFSET ${offset}`;
    
    const [rows] = await db.execute(query);
    
    // 轉換數值類型（MySQL 返回的 decimal 是字符串）
    return (rows as unknown as any[]).map((row: any) => ({
      ...row,
      total_volume: parseFloat(row.total_volume || '0'),
      total_trades: parseInt(row.total_trades || '0', 10),
      avg_trade_size: parseFloat(row.avg_trade_size || '0'),
      win_rate: parseFloat(row.win_rate || '0'),
      suspicion_score: parseFloat(row.suspicion_score || '0'),
      is_suspicious: Boolean(row.is_suspicious)
    }));
  } catch (error) {
    console.error('[Database] Error getting addresses:', error);
    return [];
  }
}

/**
 * 獲取地址總數
 */
export async function getAddressCount(params: {
  search?: string;
}) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot get address count: database not available');
    return 0;
  }

  try {
    const { search } = params;
    
    let query = 'SELECT COUNT(*) as count FROM addresses';
    
    // 添加搜索條件
    if (search) {
      query += ` WHERE address LIKE '%${search}%'`;
    }
    
    const [rows] = await db.execute(query);
    return (rows as any)[0]?.count || 0;
  } catch (error) {
    console.error('[Database] Error getting address count:', error);
    return 0;
  }
}

/**
 * 根據 ID 獲取地址詳情
 */
export async function getAddressById(addressId: number) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot get address: database not available');
    return null;
  }

  try {
    const query = `
      SELECT 
        id,
        address,
        total_volume,
        total_trades,
        avg_trade_size,
        win_rate,
        win_count,
        loss_count,
        settled_count,
        suspicion_score,
        is_suspicious,
        first_seen_at,
        last_active_at,
        created_at,
        updated_at
      FROM addresses
      WHERE id = ${addressId}
    `;
    
    const [rows] = await db.execute(query);
    const row = (rows as any)[0];
    if (!row) return null;
    
    // 轉換數值類型
    return {
      ...row,
      total_volume: parseFloat(row.total_volume || '0'),
      total_trades: parseInt(row.total_trades || '0', 10),
      avg_trade_size: parseFloat(row.avg_trade_size || '0'),
      win_rate: parseFloat(row.win_rate || '0'),
      win_count: parseInt(row.win_count || '0', 10),
      loss_count: parseInt(row.loss_count || '0', 10),
      settled_count: parseInt(row.settled_count || '0', 10),
      suspicion_score: parseFloat(row.suspicion_score || '0'),
      is_suspicious: Boolean(row.is_suspicious)
    };
  } catch (error) {
    console.error('[Database] Error getting address by ID:', error);
    return null;
  }
}

/**
 * 獲取地址排行榜
 */
export async function getAddressLeaderboard(params: {
  metric?: 'suspicion_score' | 'win_rate' | 'total_volume' | 'total_trades';
  limit?: number;
  offset?: number;
}) {
  const { metric = 'total_volume', limit = 10, offset = 0 } = params;
  
  return getAddresses({
    limit,
    offset,
    sortBy: metric as any,
    sortOrder: 'desc'
  });
}

/**
 * 獲取地址統計數據
 */
export async function getAddressStats() {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot get address stats: database not available');
    return {
      total_addresses: 0,
      suspicious_addresses: 0,
      whale_addresses: 0,
      avg_suspicion_score: 0,
      avg_win_rate: 0,
      total_volume: 0,
      total_trades: 0
    };
  }

  try {
    const query = `
      SELECT 
        COUNT(*) as total_addresses,
        SUM(CASE WHEN is_suspicious = 1 THEN 1 ELSE 0 END) as suspicious_addresses,
        SUM(CASE WHEN total_volume >= 100000000000 THEN 1 ELSE 0 END) as whale_addresses,
        AVG(suspicion_score) as avg_suspicion_score,
        AVG(win_rate) as avg_win_rate,
        SUM(total_volume) as total_volume,
        SUM(total_trades) as total_trades
      FROM addresses
    `;
    
    const [rows] = await db.execute(query);
    const row = (rows as any)[0];
    if (!row) {
      return {
        total_addresses: 0,
        suspicious_addresses: 0,
        whale_addresses: 0,
        avg_suspicion_score: 0,
        avg_win_rate: 0,
        total_volume: 0,
        total_trades: 0
      };
    }
    
    // 轉換數值類型
    return {
      total_addresses: parseInt(row.total_addresses || '0', 10),
      suspicious_addresses: parseInt(row.suspicious_addresses || '0', 10),
      whale_addresses: parseInt(row.whale_addresses || '0', 10),
      avg_suspicion_score: parseFloat(row.avg_suspicion_score || '0'),
      avg_win_rate: parseFloat(row.avg_win_rate || '0'),
      total_volume: parseFloat(row.total_volume || '0'),
      total_trades: parseInt(row.total_trades || '0', 10)
    };
  } catch (error) {
    console.error('[Database] Error getting address stats:', error);
    return {
      total_addresses: 0,
      suspicious_addresses: 0,
      whale_addresses: 0,
      avg_suspicion_score: 0,
      avg_win_rate: 0,
      total_volume: 0,
      total_trades: 0
    };
  }
}
