# 數據收集和更新策略設計

**設計日期**: 2024-12-12  
**目標**: 設計完整的數據收集和更新策略，解決數據時效性、地址覆蓋率和數據完整性問題

---

## 🎯 設計目標

### 核心目標
1. **數據時效性**: 將數據延遲從數小時降低到 **5 分鐘以內**
2. **地址覆蓋率**: 追蹤**所有**參與交易的地址（從數百提升到數萬）
3. **數據完整性**: 捕獲**所有**訂單填充事件，無遺漏
4. **系統穩定性**: 自動化運行，錯誤自動恢復
5. **可擴展性**: 支持未來功能擴展

### 非功能性目標
- **可靠性**: 99.9% 正常運行時間
- **效能**: 每分鐘處理 1000+ 事件
- **可維護性**: 代碼清晰，易於調試
- **成本效益**: 最小化 API 調用次數

---

## 📊 整體架構

```
┌──────────────────────────────────────────────────────────────────┐
│                     數據收集和更新系統                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  1. 數據源層 (Data Sources)                                 │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  • Goldsky Orderbook Subgraph (核心)                        │  │
│  │  • Goldsky PNL Subgraph (補充)                              │  │
│  │  • Goldsky Activity Subgraph (補充)                         │  │
│  │  • Polymarket REST API (市場元數據)                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  2. 數據收集層 (Data Collection)                            │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  • OrderbookCollector (主要)                                │  │
│  │    - 增量收集 orderFilledEvents                             │  │
│  │    - 自動恢復機制                                            │  │
│  │    - 錯誤處理和重試                                          │  │
│  │  • MarketCollector (輔助)                                   │  │
│  │    - 收集市場元數據                                          │  │
│  │    - 更新市場狀態                                            │  │
│  │  • AddressCollector (輔助)                                  │  │
│  │    - 補充地址持倉數據                                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  3. 數據處理層 (Data Processing)                            │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  • EventProcessor                                           │  │
│  │    - 解析 orderFilledEvents                                 │  │
│  │    - 提取 maker/taker 地址                                  │  │
│  │    - 計算價格和方向                                          │  │
│  │    - 標準化金額                                              │  │
│  │  • AddressProcessor                                         │  │
│  │    - 更新地址統計                                            │  │
│  │    - 計算交易指標                                            │  │
│  │    - 識別巨鯨和可疑地址                                       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  4. 數據存儲層 (Data Storage)                               │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  • MySQL 數據庫 (Drizzle ORM)                               │  │
│  │    - trades (交易記錄)                                       │  │
│  │    - addresses (地址數據)                                    │  │
│  │    - markets (市場數據)                                      │  │
│  │    - sync_state (同步狀態)                                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  5. 調度層 (Scheduling)                                     │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  • 實時更新任務 (每 5 分鐘)                                  │  │
│  │    - 收集新的 orderFilledEvents                             │  │
│  │    - 更新地址統計                                            │  │
│  │  • 歷史補全任務 (一次性)                                     │  │
│  │    - 回填歷史交易數據                                         │  │
│  │  • 市場更新任務 (每 1 小時)                                  │  │
│  │    - 更新市場元數據                                          │  │
│  │    - 更新價格數據                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔄 實時數據更新機制

### 核心設計：增量更新

#### 原理
- 記錄上次同步的時間戳
- 每次只查詢新的事件（`timestamp_gt: last_timestamp`）
- 避免重複處理數據

#### 實現

```python
class OrderbookCollector:
    """Orderbook 數據收集器"""
    
    def __init__(self, db_connection):
        self.db = db_connection
        self.subgraph_url = "https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/orderbook-subgraph/0.0.1/gn"
        self.batch_size = 1000
    
    def get_last_synced_timestamp(self):
        """從數據庫獲取最後同步的時間戳"""
        query = """
            SELECT MAX(timestamp) as last_timestamp
            FROM trades
        """
        result = self.db.execute(query).fetchone()
        
        if result and result['last_timestamp']:
            return int(result['last_timestamp'].timestamp())
        
        # 如果沒有數據，從 30 天前開始
        return int((datetime.now() - timedelta(days=30)).timestamp())
    
    def save_last_synced_timestamp(self, timestamp):
        """保存最後同步的時間戳到 sync_state 表"""
        query = """
            INSERT INTO sync_state (service_name, last_timestamp, updated_at)
            VALUES ('orderbook_collector', %s, NOW())
            ON DUPLICATE KEY UPDATE
                last_timestamp = VALUES(last_timestamp),
                updated_at = NOW()
        """
        self.db.execute(query, (timestamp,))
        self.db.commit()
    
    async def collect_events(self):
        """收集新的 orderFilledEvents"""
        last_timestamp = self.get_last_synced_timestamp()
        logger.info(f"Starting collection from timestamp: {last_timestamp}")
        
        total_events = 0
        
        while True:
            # GraphQL 查詢
            query = gql("""
                query GetOrderFilledEvents($startTime: BigInt!, $limit: Int!) {
                    orderFilledEvents(
                        where: { timestamp_gt: $startTime }
                        orderBy: timestamp
                        orderDirection: asc
                        first: $limit
                    ) {
                        id
                        timestamp
                        maker
                        makerAssetId
                        makerAmountFilled
                        taker
                        takerAssetId
                        takerAmountFilled
                        transactionHash
                        fee
                    }
                }
            """)
            
            params = {
                "startTime": str(last_timestamp),
                "limit": self.batch_size
            }
            
            try:
                # 執行查詢
                result = await self.execute_query(query, params)
                events = result.get('orderFilledEvents', [])
                
                if not events:
                    logger.info("No more events to collect")
                    break
                
                # 處理事件
                processed_count = await self.process_events(events)
                total_events += processed_count
                
                # 更新 last_timestamp
                last_timestamp = int(events[-1]['timestamp'])
                self.save_last_synced_timestamp(last_timestamp)
                
                logger.info(f"Processed {processed_count} events, total: {total_events}")
                
                # 如果返回的事件少於批次大小，說明已經到最新
                if len(events) < self.batch_size:
                    break
                
                # 避免請求過快
                await asyncio.sleep(0.5)
                
            except Exception as e:
                logger.error(f"Error collecting events: {e}")
                # 重試邏輯
                await asyncio.sleep(5)
                continue
        
        logger.info(f"✅ Collection completed, total events: {total_events}")
        return total_events
```

### 調度策略

#### 1. 實時更新任務
**頻率**: 每 5 分鐘  
**觸發**: Cron job

```bash
# crontab
*/5 * * * * cd /path/to/python-backend && python3 -m collectors.orderbook_collector
```

**流程**:
1. 獲取上次同步的時間戳
2. 查詢新的 orderFilledEvents
3. 處理和保存事件
4. 更新地址統計
5. 記錄同步狀態

#### 2. 錯誤恢復機制
- 自動重試（最多 3 次）
- 指數退避（1s, 2s, 4s）
- 錯誤日誌記錄
- 失敗通知（發送警報）

```python
async def execute_query_with_retry(self, query, params, max_retries=3):
    """執行查詢，帶重試機制"""
    for attempt in range(max_retries):
        try:
            result = await self.client.execute(query, variable_values=params)
            return result
        except Exception as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # 指數退避
                logger.warning(f"Query failed (attempt {attempt + 1}/{max_retries}), retrying in {wait_time}s: {e}")
                await asyncio.sleep(wait_time)
            else:
                logger.error(f"Query failed after {max_retries} attempts: {e}")
                # 發送警報通知
                await self.send_alert(f"Orderbook collector failed: {e}")
                raise
```

---

## 🔍 地址發現和追蹤策略

### 自動地址發現

#### 從交易事件提取地址

```python
class AddressDiscovery:
    """地址發現服務"""
    
    async def discover_from_events(self, events):
        """從 orderFilledEvents 發現新地址"""
        discovered_addresses = set()
        
        for event in events:
            # 提取 maker 和 taker 地址
            maker = event['maker'].lower()
            taker = event['taker'].lower()
            
            discovered_addresses.add(maker)
            discovered_addresses.add(taker)
        
        # 批量檢查哪些是新地址
        new_addresses = await self.filter_new_addresses(discovered_addresses)
        
        # 批量插入新地址
        if new_addresses:
            await self.insert_addresses(new_addresses)
            logger.info(f"Discovered {len(new_addresses)} new addresses")
        
        return new_addresses
    
    async def filter_new_addresses(self, addresses):
        """過濾出新地址"""
        if not addresses:
            return []
        
        # 查詢數據庫中已存在的地址
        placeholders = ','.join(['%s'] * len(addresses))
        query = f"""
            SELECT address FROM addresses
            WHERE address IN ({placeholders})
        """
        
        existing = set(row['address'] for row in self.db.execute(query, tuple(addresses)))
        
        # 返回新地址
        return addresses - existing
    
    async def insert_addresses(self, addresses):
        """批量插入新地址"""
        if not addresses:
            return
        
        values = [(addr, datetime.now(), datetime.now()) for addr in addresses]
        
        query = """
            INSERT INTO addresses (address, first_seen_at, last_active_at)
            VALUES (%s, %s, %s)
        """
        
        self.db.executemany(query, values)
        self.db.commit()
```

### 地址分類策略

#### 自動標籤

```python
class AddressLabeling:
    """地址標籤服務"""
    
    # 巨鯨閾值
    WHALE_THRESHOLD = 10000  # $10,000
    
    # 可疑評分閾值
    SUSPICIOUS_THRESHOLD = 70  # 70/100
    
    async def update_address_labels(self, address_id):
        """更新地址標籤"""
        stats = await self.get_address_stats(address_id)
        
        labels = []
        
        # 巨鯨檢測
        if stats['total_volume'] >= self.WHALE_THRESHOLD:
            labels.append('whale')
        
        # 高頻交易者
        if stats['total_trades'] > 100 and stats['avg_trade_interval'] < 3600:
            labels.append('high_frequency')
        
        # 大額交易者
        if stats['avg_trade_size'] > 1000:
            labels.append('large_trader')
        
        # 可疑地址
        suspicion_score = await self.calculate_suspicion_score(address_id)
        if suspicion_score >= self.SUSPICIOUS_THRESHOLD:
            labels.append('suspicious')
        
        # 更新數據庫
        await self.save_labels(address_id, labels)
        
        return labels
```

---

## 📦 數據補全方案

### 歷史數據回填

#### 策略
1. **確定回填範圍**: 過去 30 天的數據
2. **分批回填**: 每批 1000 個事件
3. **優先級**: 活躍市場優先
4. **進度追蹤**: 記錄回填進度

#### 實現

```python
class HistoricalDataBackfill:
    """歷史數據回填服務"""
    
    async def backfill(self, start_date, end_date):
        """回填歷史數據"""
        start_timestamp = int(start_date.timestamp())
        end_timestamp = int(end_date.timestamp())
        
        logger.info(f"Starting backfill from {start_date} to {end_date}")
        
        total_events = 0
        current_timestamp = start_timestamp
        
        while current_timestamp < end_timestamp:
            # 查詢一批事件
            events = await self.fetch_events(current_timestamp, self.batch_size)
            
            if not events:
                break
            
            # 處理事件
            processed = await self.process_events(events)
            total_events += processed
            
            # 更新進度
            current_timestamp = int(events[-1]['timestamp'])
            progress = (current_timestamp - start_timestamp) / (end_timestamp - start_timestamp) * 100
            
            logger.info(f"Backfill progress: {progress:.1f}%, total events: {total_events}")
            
            # 保存進度
            await self.save_progress(current_timestamp)
            
            # 避免請求過快
            await asyncio.sleep(1)
        
        logger.info(f"✅ Backfill completed, total events: {total_events}")
        return total_events
    
    async def resume_backfill(self):
        """從上次中斷處恢復回填"""
        last_timestamp = await self.get_last_backfill_timestamp()
        
        if last_timestamp:
            logger.info(f"Resuming backfill from timestamp: {last_timestamp}")
            start_date = datetime.fromtimestamp(last_timestamp)
        else:
            start_date = datetime.now() - timedelta(days=30)
        
        end_date = datetime.now()
        
        return await self.backfill(start_date, end_date)
```

### 缺失數據檢測

```python
class MissingDataDetector:
    """缺失數據檢測器"""
    
    async def detect_gaps(self):
        """檢測時間序列中的缺口"""
        query = """
            SELECT 
                timestamp,
                LEAD(timestamp) OVER (ORDER BY timestamp) as next_timestamp
            FROM trades
            ORDER BY timestamp
        """
        
        results = self.db.execute(query).fetchall()
        
        gaps = []
        for row in results:
            if row['next_timestamp']:
                gap_seconds = (row['next_timestamp'] - row['timestamp']).total_seconds()
                
                # 如果間隔超過 1 小時，認為是缺口
                if gap_seconds > 3600:
                    gaps.append({
                        'start': row['timestamp'],
                        'end': row['next_timestamp'],
                        'duration': gap_seconds
                    })
        
        if gaps:
            logger.warning(f"Found {len(gaps)} data gaps")
            for gap in gaps:
                logger.warning(f"Gap: {gap['start']} to {gap['end']} ({gap['duration']/3600:.1f} hours)")
        
        return gaps
    
    async def fill_gaps(self, gaps):
        """填補缺口"""
        for gap in gaps:
            logger.info(f"Filling gap: {gap['start']} to {gap['end']}")
            await self.backfill(gap['start'], gap['end'])
```

---

## 🗄️ 數據存儲結構優化

### 數據庫 Schema 擴展

#### 1. 擴展 trades 表

```typescript
// drizzle/schema.ts

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
}));
```

#### 2. 創建 addresses 表

```typescript
export const addresses = mysqlTable("addresses", {
  id: int("id").autoincrement().primaryKey(),
  
  // 地址信息
  address: varchar("address", { length: 42 }).notNull().unique(),
  label: varchar("label", { length: 255 }), // 用戶自定義標籤
  
  // 統計數據
  totalVolume: int("totalVolume").default(0), // 總交易量（美元，以分為單位）
  totalTrades: int("totalTrades").default(0), // 總交易次數
  avgTradeSize: int("avgTradeSize").default(0), // 平均交易金額
  winRate: int("winRate").default(0), // 勝率（0-100）
  realizedPnl: int("realizedPnl").default(0), // 已實現盈虧
  
  // 行為特徵
  suspicionScore: int("suspicionScore").default(0), // 可疑評分（0-100）
  tradingFrequency: int("tradingFrequency").default(0), // 交易頻率（次/天）
  avgHoldingPeriod: int("avgHoldingPeriod").default(0), // 平均持倉時間（秒）
  
  // 標記
  isWhale: boolean("isWhale").default(false).notNull(),
  isSuspicious: boolean("isSuspicious").default(false).notNull(),
  isHighFrequency: boolean("isHighFrequency").default(false).notNull(),
  
  // 時間戳
  firstSeenAt: timestamp("firstSeenAt").notNull(),
  lastActiveAt: timestamp("lastActiveAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  addressIdx: index("address_idx").on(table.address),
  isWhaleIdx: index("is_whale_idx").on(table.isWhale),
  isSuspiciousIdx: index("is_suspicious_idx").on(table.isSuspicious),
}));
```

#### 3. 創建 sync_state 表

```typescript
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
```

### 數據庫遷移腳本

```bash
# 運行遷移
pnpm db:push

# 驗證 schema
pnpm db:studio
```

---

## 🛡️ API 限流和錯誤處理

### API 限流策略

#### Goldsky API 限制
- **速率限制**: 未公開（估計 ~100 req/min）
- **批次大小**: 建議 1000 個事件/次
- **並發請求**: 建議 1 個（避免觸發限制）

#### 實現

```python
class RateLimiter:
    """API 速率限制器"""
    
    def __init__(self, max_requests=60, time_window=60):
        self.max_requests = max_requests
        self.time_window = time_window  # 秒
        self.requests = []
    
    async def acquire(self):
        """獲取請求許可"""
        now = time.time()
        
        # 清理過期的請求記錄
        self.requests = [req_time for req_time in self.requests 
                        if now - req_time < self.time_window]
        
        # 檢查是否超過限制
        if len(self.requests) >= self.max_requests:
            # 計算需要等待的時間
            oldest_request = min(self.requests)
            wait_time = self.time_window - (now - oldest_request)
            
            if wait_time > 0:
                logger.warning(f"Rate limit reached, waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)
        
        # 記錄本次請求
        self.requests.append(time.time())
    
    async def __aenter__(self):
        await self.acquire()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

# 使用示例
rate_limiter = RateLimiter(max_requests=60, time_window=60)

async def fetch_data():
    async with rate_limiter:
        # 執行 API 請求
        result = await api_client.query(...)
        return result
```

### 錯誤處理策略

#### 錯誤分類

1. **網絡錯誤** (Network Errors)
   - 連接超時
   - DNS 解析失敗
   - 連接重置
   - **處理**: 自動重試（最多 3 次）

2. **API 錯誤** (API Errors)
   - 速率限制（429）
   - 服務器錯誤（500, 502, 503）
   - **處理**: 指數退避重試

3. **數據錯誤** (Data Errors)
   - 缺失欄位
   - 數據格式錯誤
   - 重複數據
   - **處理**: 記錄日誌，跳過該條數據

4. **數據庫錯誤** (Database Errors)
   - 連接失敗
   - 鎖超時
   - 約束違反
   - **處理**: 回滾事務，重試

#### 實現

```python
class ErrorHandler:
    """錯誤處理器"""
    
    @staticmethod
    async def handle_api_error(error, context):
        """處理 API 錯誤"""
        if isinstance(error, aiohttp.ClientError):
            # 網絡錯誤
            logger.error(f"Network error in {context}: {error}")
            return 'retry'
        
        elif hasattr(error, 'status'):
            if error.status == 429:
                # 速率限制
                logger.warning(f"Rate limit hit in {context}")
                return 'backoff'
            elif error.status >= 500:
                # 服務器錯誤
                logger.error(f"Server error in {context}: {error.status}")
                return 'retry'
            else:
                # 其他 HTTP 錯誤
                logger.error(f"HTTP error in {context}: {error.status}")
                return 'skip'
        
        else:
            # 未知錯誤
            logger.error(f"Unknown error in {context}: {error}")
            return 'skip'
    
    @staticmethod
    async def handle_data_error(error, data, context):
        """處理數據錯誤"""
        logger.error(f"Data error in {context}: {error}")
        logger.debug(f"Problematic data: {data}")
        
        # 記錄到錯誤日誌
        await ErrorHandler.log_error({
            'context': context,
            'error': str(error),
            'data': data,
            'timestamp': datetime.now()
        })
        
        return 'skip'
    
    @staticmethod
    async def log_error(error_info):
        """記錄錯誤到數據庫"""
        # 可以創建一個 error_logs 表
        pass

# 使用示例
async def process_event(event):
    try:
        # 處理事件
        result = await process(event)
        return result
    except Exception as e:
        action = await ErrorHandler.handle_data_error(e, event, 'process_event')
        
        if action == 'skip':
            return None
        elif action == 'retry':
            # 重試邏輯
            return await process_event(event)
```

### 監控和警報

#### 監控指標

1. **數據收集指標**
   - 每分鐘處理的事件數
   - API 請求成功率
   - 平均響應時間
   - 錯誤率

2. **數據質量指標**
   - 數據完整性（缺失欄位比例）
   - 數據新鮮度（最新數據的時間戳）
   - 數據缺口數量

3. **系統健康指標**
   - 服務運行時間
   - 內存使用量
   - 數據庫連接數
   - 隊列長度

#### 警報規則

```python
class AlertManager:
    """警報管理器"""
    
    async def check_and_alert(self):
        """檢查指標並發送警報"""
        # 檢查數據新鮮度
        latest_trade = await self.get_latest_trade_timestamp()
        data_age = datetime.now() - latest_trade
        
        if data_age.total_seconds() > 600:  # 10 分鐘
            await self.send_alert(
                title="數據更新延遲",
                message=f"最新數據已經 {data_age.total_seconds()/60:.1f} 分鐘未更新",
                severity="warning"
            )
        
        # 檢查錯誤率
        error_rate = await self.get_error_rate()
        
        if error_rate > 0.1:  # 10%
            await self.send_alert(
                title="錯誤率過高",
                message=f"當前錯誤率: {error_rate*100:.1f}%",
                severity="error"
            )
        
        # 檢查數據缺口
        gaps = await self.detect_data_gaps()
        
        if gaps:
            await self.send_alert(
                title="發現數據缺口",
                message=f"發現 {len(gaps)} 個數據缺口",
                severity="warning"
            )
    
    async def send_alert(self, title, message, severity):
        """發送警報通知"""
        # 可以通過多種方式發送：
        # 1. 系統通知表
        # 2. 郵件
        # 3. Slack/Discord webhook
        # 4. SMS
        
        logger.log(
            logging.ERROR if severity == "error" else logging.WARNING,
            f"[{severity.upper()}] {title}: {message}"
        )
        
        # 保存到數據庫
        await self.save_notification(title, message, severity)
```

---

## 📈 效能優化

### 批量處理

```python
class BatchProcessor:
    """批量處理器"""
    
    def __init__(self, batch_size=1000):
        self.batch_size = batch_size
    
    async def process_in_batches(self, items, processor_func):
        """批量處理項目"""
        total_processed = 0
        
        for i in range(0, len(items), self.batch_size):
            batch = items[i:i + self.batch_size]
            
            try:
                # 處理批次
                result = await processor_func(batch)
                total_processed += len(batch)
                
                logger.info(f"Processed batch {i//self.batch_size + 1}, total: {total_processed}/{len(items)}")
                
            except Exception as e:
                logger.error(f"Error processing batch: {e}")
                # 可以選擇跳過或重試
        
        return total_processed
```

### 數據庫優化

#### 1. 批量插入

```python
async def bulk_insert_trades(trades):
    """批量插入交易記錄"""
    if not trades:
        return
    
    # 準備批量插入的數據
    values = [
        (
            trade['marketId'],
            trade['tradeId'],
            trade['makerAddress'],
            trade['takerAddress'],
            # ... 其他欄位
        )
        for trade in trades
    ]
    
    query = """
        INSERT INTO trades (
            marketId, tradeId, makerAddress, takerAddress, ...
        ) VALUES (%s, %s, %s, %s, ...)
        ON DUPLICATE KEY UPDATE
            updatedAt = NOW()
    """
    
    # 使用 executemany 批量插入
    cursor.executemany(query, values)
    conn.commit()
    
    logger.info(f"Bulk inserted {len(trades)} trades")
```

#### 2. 索引優化

```sql
-- 為常用查詢添加索引
CREATE INDEX idx_trades_timestamp ON trades(timestamp);
CREATE INDEX idx_trades_maker ON trades(makerAddress);
CREATE INDEX idx_trades_taker ON trades(takerAddress);
CREATE INDEX idx_addresses_whale ON addresses(isWhale);
CREATE INDEX idx_addresses_suspicious ON addresses(isSuspicious);

-- 複合索引
CREATE INDEX idx_trades_market_timestamp ON trades(marketId, timestamp);
```

#### 3. 查詢優化

```python
# ❌ 不好的查詢（N+1 問題）
for address in addresses:
    trades = db.query(f"SELECT * FROM trades WHERE makerAddress = '{address}'")
    # 處理 trades

# ✅ 好的查詢（批量查詢）
addresses_str = ','.join([f"'{addr}'" for addr in addresses])
trades = db.query(f"SELECT * FROM trades WHERE makerAddress IN ({addresses_str})")
# 分組處理 trades
```

---

## 🚀 部署和運維

### 部署架構

```
┌─────────────────────────────────────────────────────────┐
│                    生產環境部署                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  數據收集服務 (Python)                             │  │
│  ├───────────────────────────────────────────────────┤  │
│  │  • Docker 容器                                     │  │
│  │  • 自動重啟（systemd/supervisor）                  │  │
│  │  • 日誌收集（stdout → file/syslog）                │  │
│  │  • 健康檢查（每 5 分鐘）                            │  │
│  └───────────────────────────────────────────────────┘  │
│                          ↓                              │
│  ┌───────────────────────────────────────────────────┐  │
│  │  調度服務 (Cron)                                   │  │
│  ├───────────────────────────────────────────────────┤  │
│  │  • 實時更新: */5 * * * *                           │  │
│  │  • 市場更新: 0 * * * *                             │  │
│  │  • 統計更新: 0 0 * * *                             │  │
│  │  • 健康檢查: */1 * * * *                           │  │
│  └───────────────────────────────────────────────────┘  │
│                          ↓                              │
│  ┌───────────────────────────────────────────────────┐  │
│  │  數據庫 (MySQL)                                    │  │
│  ├───────────────────────────────────────────────────┤  │
│  │  • 主從複製（讀寫分離）                             │  │
│  │  • 定期備份（每天）                                 │  │
│  │  • 慢查詢日誌                                       │  │
│  │  • 連接池管理                                       │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 運維檢查清單

#### 每日檢查
- [ ] 數據更新是否正常
- [ ] 錯誤日誌是否有異常
- [ ] 數據庫性能指標
- [ ] 磁盤空間使用率

#### 每週檢查
- [ ] 數據完整性驗證
- [ ] 性能指標趨勢
- [ ] 備份恢復測試
- [ ] 依賴更新檢查

#### 每月檢查
- [ ] 數據庫優化（ANALYZE TABLE）
- [ ] 清理過期數據
- [ ] 安全更新
- [ ] 容量規劃

---

## 📊 預期效果

### 數據時效性
- **當前**: 數小時延遲（手動更新）
- **目標**: 5 分鐘延遲（自動更新）
- **提升**: **95%+**

### 地址覆蓋率
- **當前**: 數百個地址
- **目標**: 數萬個地址
- **提升**: **100倍+**

### 數據完整性
- **當前**: 0 筆交易記錄
- **目標**: 完整的交易歷史
- **提升**: **無限**

### 系統可靠性
- **當前**: 手動運行，不穩定
- **目標**: 99.9% 正常運行時間
- **提升**: **顯著**

---

## 🎯 下一步行動

### Phase 4: 實作地址追蹤和分析功能
1. [ ] 實現 OrderbookCollector
2. [ ] 實現 AddressDiscovery
3. [ ] 實現 EventProcessor
4. [ ] 擴展數據庫 schema
5. [ ] 實現批量處理邏輯

### Phase 5: 實作可疑地址偵測系統
1. [ ] 定義可疑行為特徵
2. [ ] 實現異常檢測算法
3. [ ] 實現風險評分系統
4. [ ] 實現警報通知

### Phase 6: 測試和優化
1. [ ] 單元測試
2. [ ] 集成測試
3. [ ] 性能測試
4. [ ] 部署到生產環境

---

## 📚 參考資料

### 技術文檔
- Goldsky Subgraph API: https://docs.goldsky.com/
- Drizzle ORM: https://orm.drizzle.team/
- GraphQL: https://graphql.org/

### 參考項目
- warproxxx/poly_data: https://github.com/warproxxx/poly_data
- polymarket-apis: https://pypi.org/project/polymarket-apis/

### 最佳實踐
- 增量數據同步設計模式
- 錯誤處理和重試策略
- 數據庫索引優化
- API 速率限制處理
