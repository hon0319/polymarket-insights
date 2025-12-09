# Phase 1: Polymarket Subgraph 整合與地址追蹤系統

## 目標

整合 Polymarket Subgraph 獲取歷史交易數據，建立地址追蹤系統和勝率計算功能，為內幕交易分析平台奠定數據基礎。

---

## 1. Polymarket Subgraph 架構

Polymarket 提供了多個 subgraph，每個專注於不同的數據類型：

### 1.1 可用的 Subgraph

| Subgraph | 用途 | 關鍵數據 |
|----------|------|----------|
| **PNL Subgraph** | 用戶盈虧數據 | UserPosition（持倉、平均價格、已實現盈虧） |
| **Activity Subgraph** | 交易活動歷史 | Split, Merge, Redemption（交易時間、金額、地址） |
| **Orders Subgraph** | 訂單數據 | 訂單簿、掛單、成交 |
| **Positions Subgraph** | 用戶持倉 | 當前持倉、持倉變化 |
| **Open Interest Subgraph** | 未平倉合約 | 市場流動性、總持倉量 |

### 1.2 GraphQL 端點

```
# The Graph Network (推薦)
https://gateway.thegraph.com/api/{api-key}/subgraphs/id/{subgraph-id}

# Goldsky Hosted (Polymarket 官方推薦)
- activity_subgraph
- pnl_subgraph
- orderbook_subgraph
- oi_subgraph
```

---

## 2. 核心數據模型

### 2.1 UserPosition (PNL Subgraph)

```graphql
type UserPosition @entity {
  id: ID!                    # User Address + Token ID
  user: String!              # 用戶地址
  tokenId: BigInt!           # Token ID (對應市場的某個結果)
  amount: BigInt!            # 持倉數量
  avgPrice: BigInt!          # 平均買入價格
  realizedPnl: BigInt!       # 已實現盈虧
  totalBought: BigInt!       # 總買入量
}
```

### 2.2 Activity Events (Activity Subgraph)

```graphql
# Split: 用戶買入（將 USDC 分割成結果 token）
type Split @entity {
  id: ID!                    # Transaction Hash
  timestamp: BigInt!         # 交易時間
  stakeholder: String!       # 交易地址
  condition: String!         # 市場條件 ID
  amount: BigInt!            # 交易金額
}

# Merge: 用戶賣出（將結果 token 合併回 USDC）
type Merge @entity {
  id: ID!
  timestamp: BigInt!
  stakeholder: String!
  condition: String!
  amount: BigInt!
}

# Redemption: 市場結算後領取獎金
type Redemption @entity {
  id: ID!
  timestamp: BigInt!
  redeemer: String!
  condition: String!
  indexSets: [BigInt!]!
  payout: BigInt!            # 領取金額
}
```

---

## 3. 數據庫 Schema 設計

### 3.1 新增表結構

```sql
-- 地址表（追蹤所有交易地址）
CREATE TABLE addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  address VARCHAR(42) NOT NULL UNIQUE,
  first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP,
  total_trades INT DEFAULT 0,
  total_volume DECIMAL(20, 6) DEFAULT 0,
  win_count INT DEFAULT 0,
  loss_count INT DEFAULT 0,
  settled_count INT DEFAULT 0,
  win_rate DECIMAL(5, 2),
  avg_trade_size DECIMAL(20, 6),
  is_suspicious BOOLEAN DEFAULT FALSE,
  suspicion_score DECIMAL(5, 2),
  INDEX idx_address (address),
  INDEX idx_win_rate (win_rate),
  INDEX idx_suspicious (is_suspicious, suspicion_score)
);

-- 地址持倉表（從 PNL Subgraph 同步）
CREATE TABLE address_positions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  address_id INT NOT NULL,
  market_id INT NOT NULL,
  token_id VARCHAR(100) NOT NULL,
  amount DECIMAL(20, 6) NOT NULL,
  avg_price DECIMAL(10, 6) NOT NULL,
  realized_pnl DECIMAL(20, 6) DEFAULT 0,
  total_bought DECIMAL(20, 6) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (address_id) REFERENCES addresses(id),
  FOREIGN KEY (market_id) REFERENCES markets(id),
  UNIQUE KEY unique_position (address_id, market_id, token_id)
);

-- 地址交易歷史表（從 Activity Subgraph 同步）
CREATE TABLE address_trades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  address_id INT NOT NULL,
  market_id INT NOT NULL,
  tx_hash VARCHAR(66) NOT NULL UNIQUE,
  trade_type ENUM('split', 'merge', 'redemption') NOT NULL,
  amount DECIMAL(20, 6) NOT NULL,
  price DECIMAL(10, 6),
  side ENUM('buy', 'sell', 'redeem') NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  market_price_at_time DECIMAL(10, 6),
  is_whale BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (address_id) REFERENCES addresses(id),
  FOREIGN KEY (market_id) REFERENCES markets(id),
  INDEX idx_address_time (address_id, timestamp),
  INDEX idx_market_time (market_id, timestamp),
  INDEX idx_whale (is_whale, timestamp)
);

-- 地址市場表現表（每個地址在每個市場的表現）
CREATE TABLE address_market_performance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  address_id INT NOT NULL,
  market_id INT NOT NULL,
  entry_time TIMESTAMP NOT NULL,
  exit_time TIMESTAMP,
  entry_price DECIMAL(10, 6) NOT NULL,
  exit_price DECIMAL(10, 6),
  position_side ENUM('YES', 'NO') NOT NULL,
  total_invested DECIMAL(20, 6) NOT NULL,
  realized_pnl DECIMAL(20, 6),
  is_winner BOOLEAN,
  market_resolved BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (address_id) REFERENCES addresses(id),
  FOREIGN KEY (market_id) REFERENCES markets(id),
  UNIQUE KEY unique_address_market (address_id, market_id)
);

-- 市場異常活動表（檢測可疑交易模式）
CREATE TABLE market_anomalies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  market_id INT NOT NULL,
  anomaly_type ENUM('early_whale', 'sudden_volume', 'coordinated_trading', 'price_manipulation') NOT NULL,
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  involved_addresses JSON,
  confidence_score DECIMAL(5, 2),
  description TEXT,
  FOREIGN KEY (market_id) REFERENCES markets(id),
  INDEX idx_market_type (market_id, anomaly_type),
  INDEX idx_confidence (confidence_score)
);
```

### 3.2 更新現有表

```sql
-- 更新 markets 表，添加市場結算資訊
ALTER TABLE markets 
ADD COLUMN resolved BOOLEAN DEFAULT FALSE,
ADD COLUMN resolved_at TIMESTAMP NULL,
ADD COLUMN winning_outcome VARCHAR(10),
ADD COLUMN final_price DECIMAL(10, 6);

-- 更新 trades 表，添加地址關聯
ALTER TABLE trades
ADD COLUMN address_id INT,
ADD FOREIGN KEY (address_id) REFERENCES addresses(id);
```

---

## 4. GraphQL 查詢範例

### 4.1 獲取用戶所有持倉（PNL Subgraph）

```graphql
query GetUserPositions($userAddress: String!) {
  userPositions(
    where: { user: $userAddress }
    orderBy: totalBought
    orderDirection: desc
  ) {
    id
    user
    tokenId
    amount
    avgPrice
    realizedPnl
    totalBought
  }
}
```

### 4.2 獲取市場的所有交易活動（Activity Subgraph）

```graphql
query GetMarketActivity($conditionId: String!, $startTime: BigInt!) {
  splits(
    where: { 
      condition: $conditionId
      timestamp_gte: $startTime
    }
    orderBy: timestamp
    orderDirection: asc
    first: 1000
  ) {
    id
    timestamp
    stakeholder
    amount
  }
  
  merges(
    where: { 
      condition: $conditionId
      timestamp_gte: $startTime
    }
    orderBy: timestamp
    orderDirection: asc
    first: 1000
  ) {
    id
    timestamp
    stakeholder
    amount
  }
  
  redemptions(
    where: { 
      condition: $conditionId
      timestamp_gte: $startTime
    }
    orderBy: timestamp
    orderDirection: asc
    first: 1000
  ) {
    id
    timestamp
    redeemer
    payout
  }
}
```

### 4.3 獲取大額交易者（PNL Subgraph）

```graphql
query GetWhaleTraders($minVolume: BigInt!) {
  userPositions(
    where: { totalBought_gte: $minVolume }
    orderBy: totalBought
    orderDirection: desc
    first: 100
  ) {
    user
    totalBought
    realizedPnl
  }
}
```

### 4.4 獲取早期交易者（Activity Subgraph）

```graphql
query GetEarlyTraders($conditionId: String!, $endTime: BigInt!) {
  splits(
    where: { 
      condition: $conditionId
      timestamp_lte: $endTime
    }
    orderBy: amount
    orderDirection: desc
    first: 50
  ) {
    id
    timestamp
    stakeholder
    amount
  }
}
```

---

## 5. Python 後端實作步驟

### 5.1 安裝依賴

```bash
pip install gql aiohttp python-dotenv
```

### 5.2 創建 Subgraph 客戶端

```python
# python-backend/subgraph_client.py

from gql import gql, Client
from gql.transport.aiohttp import AIOHTTPTransport
import os

class PolymarketSubgraphClient:
    def __init__(self):
        # Goldsky hosted subgraph endpoints
        self.pnl_endpoint = os.getenv('POLYMARKET_PNL_SUBGRAPH_URL')
        self.activity_endpoint = os.getenv('POLYMARKET_ACTIVITY_SUBGRAPH_URL')
        
        # Initialize clients
        self.pnl_client = self._create_client(self.pnl_endpoint)
        self.activity_client = self._create_client(self.activity_endpoint)
    
    def _create_client(self, endpoint):
        transport = AIOHTTPTransport(url=endpoint)
        return Client(transport=transport, fetch_schema_from_transport=True)
    
    async def get_user_positions(self, user_address):
        """獲取用戶所有持倉"""
        query = gql("""
            query GetUserPositions($userAddress: String!) {
                userPositions(
                    where: { user: $userAddress }
                    orderBy: totalBought
                    orderDirection: desc
                ) {
                    id
                    user
                    tokenId
                    amount
                    avgPrice
                    realizedPnl
                    totalBought
                }
            }
        """)
        
        params = {"userAddress": user_address.lower()}
        result = await self.pnl_client.execute_async(query, variable_values=params)
        return result['userPositions']
    
    async def get_market_activity(self, condition_id, start_time=0):
        """獲取市場的所有交易活動"""
        query = gql("""
            query GetMarketActivity($conditionId: String!, $startTime: BigInt!) {
                splits(
                    where: { 
                        condition: $conditionId
                        timestamp_gte: $startTime
                    }
                    orderBy: timestamp
                    orderDirection: asc
                    first: 1000
                ) {
                    id
                    timestamp
                    stakeholder
                    amount
                }
                
                merges(
                    where: { 
                        condition: $conditionId
                        timestamp_gte: $startTime
                    }
                    orderBy: timestamp
                    orderDirection: asc
                    first: 1000
                ) {
                    id
                    timestamp
                    stakeholder
                    amount
                }
            }
        """)
        
        params = {
            "conditionId": condition_id,
            "startTime": str(start_time)
        }
        result = await self.activity_client.execute_async(query, variable_values=params)
        return result
    
    async def get_whale_traders(self, min_volume=100000):
        """獲取大額交易者（最小交易量 $100,000）"""
        query = gql("""
            query GetWhaleTraders($minVolume: BigInt!) {
                userPositions(
                    where: { totalBought_gte: $minVolume }
                    orderBy: totalBought
                    orderDirection: desc
                    first: 100
                ) {
                    user
                    totalBought
                    realizedPnl
                }
            }
        """)
        
        params = {"minVolume": str(min_volume * 10**6)}  # Convert to USDC decimals
        result = await self.pnl_client.execute_async(query, variable_values=params)
        return result['userPositions']
```

### 5.3 創建歷史數據同步服務

```python
# python-backend/sync_service.py

import asyncio
from datetime import datetime, timedelta
from subgraph_client import PolymarketSubgraphClient
import mysql.connector
from mysql.connector import pooling

class HistoricalDataSyncService:
    def __init__(self, db_config):
        self.subgraph_client = PolymarketSubgraphClient()
        self.db_pool = pooling.MySQLConnectionPool(
            pool_name="sync_pool",
            pool_size=5,
            **db_config
        )
    
    async def sync_market_history(self, market_id, condition_id):
        """同步單個市場的歷史數據"""
        # 獲取市場創建時間
        conn = self.db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT created_at FROM markets WHERE id = %s
        """, (market_id,))
        market = cursor.fetchone()
        
        if not market:
            cursor.close()
            conn.close()
            return
        
        start_time = int(market['created_at'].timestamp())
        
        # 獲取交易活動
        activity = await self.subgraph_client.get_market_activity(
            condition_id, 
            start_time
        )
        
        # 處理 Split 事件（買入）
        for split in activity['splits']:
            await self._process_split(split, market_id, cursor)
        
        # 處理 Merge 事件（賣出）
        for merge in activity['merges']:
            await self._process_merge(merge, market_id, cursor)
        
        conn.commit()
        cursor.close()
        conn.close()
    
    async def _process_split(self, split, market_id, cursor):
        """處理買入事件"""
        address = split['stakeholder'].lower()
        amount = int(split['amount']) / 10**6  # Convert from USDC decimals
        timestamp = datetime.fromtimestamp(int(split['timestamp']))
        
        # 確保地址存在
        address_id = self._ensure_address_exists(address, cursor)
        
        # 插入交易記錄
        cursor.execute("""
            INSERT INTO address_trades 
            (address_id, market_id, tx_hash, trade_type, amount, side, timestamp, is_whale)
            VALUES (%s, %s, %s, 'split', %s, 'buy', %s, %s)
            ON DUPLICATE KEY UPDATE amount = VALUES(amount)
        """, (
            address_id, 
            market_id, 
            split['id'], 
            amount, 
            timestamp,
            amount >= 100  # 標記大額交易
        ))
        
        # 更新地址統計
        cursor.execute("""
            UPDATE addresses 
            SET total_trades = total_trades + 1,
                total_volume = total_volume + %s,
                last_active_at = %s
            WHERE id = %s
        """, (amount, timestamp, address_id))
    
    async def _process_merge(self, merge, market_id, cursor):
        """處理賣出事件"""
        address = merge['stakeholder'].lower()
        amount = int(merge['amount']) / 10**6
        timestamp = datetime.fromtimestamp(int(merge['timestamp']))
        
        address_id = self._ensure_address_exists(address, cursor)
        
        cursor.execute("""
            INSERT INTO address_trades 
            (address_id, market_id, tx_hash, trade_type, amount, side, timestamp, is_whale)
            VALUES (%s, %s, %s, 'merge', %s, 'sell', %s, %s)
            ON DUPLICATE KEY UPDATE amount = VALUES(amount)
        """, (
            address_id, 
            market_id, 
            merge['id'], 
            amount, 
            timestamp,
            amount >= 100
        ))
        
        cursor.execute("""
            UPDATE addresses 
            SET total_trades = total_trades + 1,
                total_volume = total_volume + %s,
                last_active_at = %s
            WHERE id = %s
        """, (amount, timestamp, address_id))
    
    def _ensure_address_exists(self, address, cursor):
        """確保地址存在於資料庫，返回 address_id"""
        cursor.execute("""
            INSERT INTO addresses (address, first_seen_at)
            VALUES (%s, NOW())
            ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
        """, (address,))
        
        return cursor.lastrowid
    
    async def sync_all_markets(self):
        """同步所有市場的歷史數據"""
        conn = self.db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT id, condition_id FROM markets 
            WHERE condition_id IS NOT NULL
        """)
        markets = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        for market in markets:
            print(f"Syncing market {market['id']}...")
            await self.sync_market_history(market['id'], market['condition_id'])
            await asyncio.sleep(1)  # 避免 API 限流
```

### 5.4 創建地址分析服務

```python
# python-backend/address_analyzer.py

class AddressAnalyzer:
    def __init__(self, db_pool):
        self.db_pool = db_pool
    
    def calculate_win_rate(self, address_id):
        """計算地址的勝率"""
        conn = self.db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT 
                COUNT(*) as total_markets,
                SUM(CASE WHEN is_winner = TRUE THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN is_winner = FALSE THEN 1 ELSE 0 END) as losses
            FROM address_market_performance
            WHERE address_id = %s AND market_resolved = TRUE
        """, (address_id,))
        
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if result['total_markets'] == 0:
            return None
        
        win_rate = (result['wins'] / result['total_markets']) * 100
        return {
            'win_rate': round(win_rate, 2),
            'total_markets': result['total_markets'],
            'wins': result['wins'],
            'losses': result['losses']
        }
    
    def detect_early_traders(self, market_id, hours_before_pump=24):
        """檢測在價格大幅變動前就下注的地址"""
        conn = self.db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        # 找出市場價格大幅變動的時間點
        cursor.execute("""
            SELECT MIN(timestamp) as pump_time
            FROM trades
            WHERE market_id = %s 
            AND price > (
                SELECT AVG(price) * 1.5 
                FROM trades 
                WHERE market_id = %s
            )
        """, (market_id, market_id))
        
        pump_time = cursor.fetchone()['pump_time']
        
        if not pump_time:
            cursor.close()
            conn.close()
            return []
        
        # 找出在價格變動前就下注的地址
        early_threshold = pump_time - timedelta(hours=hours_before_pump)
        
        cursor.execute("""
            SELECT 
                a.address,
                t.timestamp,
                t.amount,
                t.price,
                TIMESTAMPDIFF(HOUR, t.timestamp, %s) as hours_before_pump
            FROM address_trades t
            JOIN addresses a ON t.address_id = a.id
            WHERE t.market_id = %s 
            AND t.timestamp < %s
            AND t.side = 'buy'
            AND t.amount >= 100
            ORDER BY t.amount DESC
        """, (pump_time, market_id, early_threshold))
        
        early_traders = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return early_traders
    
    def calculate_suspicion_score(self, address_id):
        """計算地址的可疑度分數（0-100）"""
        conn = self.db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        # 獲取地址統計
        cursor.execute("""
            SELECT * FROM addresses WHERE id = %s
        """, (address_id,))
        address = cursor.fetchone()
        
        # 獲取早期交易次數
        cursor.execute("""
            SELECT COUNT(*) as early_trades
            FROM address_market_performance amp
            JOIN markets m ON amp.market_id = m.id
            WHERE amp.address_id = %s
            AND TIMESTAMPDIFF(HOUR, amp.entry_time, m.created_at) <= 24
        """, (address_id,))
        early_trades = cursor.fetchone()['early_trades']
        
        cursor.close()
        conn.close()
        
        # 計算可疑度分數
        score = 0
        
        # 勝率異常高（>70%）
        if address['win_rate'] and address['win_rate'] > 70:
            score += 30
        
        # 經常在早期下注
        if address['total_trades'] > 0:
            early_rate = (early_trades / address['total_trades']) * 100
            if early_rate > 50:
                score += 25
        
        # 大額交易者
        if address['avg_trade_size'] and address['avg_trade_size'] > 500:
            score += 20
        
        # 交易頻率異常（每天多次交易）
        if address['total_trades'] > 0:
            days_active = (datetime.now() - address['first_seen_at']).days + 1
            trades_per_day = address['total_trades'] / days_active
            if trades_per_day > 5:
                score += 15
        
        # 總交易量大
        if address['total_volume'] and address['total_volume'] > 10000:
            score += 10
        
        return min(score, 100)
```

---

## 6. 實作時間表

### Week 1: 基礎設施
- [ ] 設置 Subgraph 客戶端
- [ ] 創建新的資料庫表
- [ ] 測試 GraphQL 查詢

### Week 2: 數據同步
- [ ] 實作歷史數據同步服務
- [ ] 同步所有現有市場的交易記錄
- [ ] 驗證數據完整性

### Week 3: 地址分析
- [ ] 實作勝率計算
- [ ] 實作早期交易者檢測
- [ ] 實作可疑度分數計算

### Week 4: API 和前端
- [ ] 創建 tRPC API 端點
- [ ] 實作地址排行榜頁面
- [ ] 實作地址詳情頁面

---

## 7. 成功指標

- ✅ 成功同步至少 100 個市場的歷史交易數據
- ✅ 識別至少 50 個高勝率地址（>60%）
- ✅ 檢測至少 10 個早期交易模式
- ✅ 地址排行榜顯示前 100 名交易者
- ✅ 所有 API 端點響應時間 < 500ms

---

## 8. 風險和挑戰

### 8.1 數據量問題
- **挑戰**：Polymarket 有數千個市場，每個市場可能有數萬筆交易
- **解決方案**：
  - 優先同步活躍市場和大額交易
  - 實作分頁和批量處理
  - 使用資料庫索引優化查詢

### 8.2 API 限流
- **挑戰**：Subgraph API 可能有請求限制
- **解決方案**：
  - 實作請求速率限制
  - 使用指數退避重試策略
  - 考慮使用自己的 Subgraph 節點

### 8.3 數據一致性
- **挑戰**：實時數據和歷史數據可能不一致
- **解決方案**：
  - 定期重新同步
  - 實作數據驗證機制
  - 使用事務確保原子性

---

## 9. 下一步

完成 Phase 1 後，我們將進入 Phase 2：

1. **異常檢測算法**：使用統計方法識別異常交易模式
2. **警報系統**：當可疑地址有新動作時通知用戶
3. **地址關聯分析**：識別可能由同一實體控制的多個地址
4. **機器學習模型**：訓練模型預測哪些地址可能是內幕交易者

---

## 10. 參考資源

- [Polymarket Subgraph Documentation](https://docs.polymarket.com/developers/subgraph/overview)
- [The Graph Documentation](https://thegraph.com/docs/)
- [Polymarket Subgraph GitHub](https://github.com/Polymarket/polymarket-subgraph)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
