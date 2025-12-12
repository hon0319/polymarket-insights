# 當前系統數據流和痛點分析

**分析日期**: 2024-12-12  
**分析目的**: 識別數據時效性、地址覆蓋率和數據完整性問題，為整合 Goldsky API 做準備

---

## 📊 當前系統架構

### 數據源
1. **Polymarket Subgraph API** (Goldsky hosted)
   - PNL Subgraph: 用戶盈虧和持倉數據
   - Activity Subgraph: 市場活動（splits/merges/redemptions）
   - Positions Subgraph: 用戶持倉

2. **數據收集服務**
   - `subgraph_client.py`: GraphQL 客戶端，查詢 Subgraph API
   - `sync_service.py`: 歷史數據同步服務
   - `price_sync_service.py`: 價格同步服務

### 數據流程

```
┌─────────────────────────────────────────────────────────────┐
│                    當前數據流                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Polymarket Subgraph API (Goldsky)                          │
│  ├─ PNL Subgraph                                            │
│  ├─ Activity Subgraph                                       │
│  └─ Positions Subgraph                                      │
│                    ↓                                        │
│  subgraph_client.py (GraphQL 客戶端)                         │
│  ├─ get_whale_traders()                                     │
│  ├─ get_market_activity()                                   │
│  ├─ get_user_positions()                                    │
│  └─ get_early_traders()                                     │
│                    ↓                                        │
│  sync_service.py (數據同步服務)                               │
│  ├─ sync_whale_traders()                                    │
│  ├─ sync_market_activity()                                  │
│  ├─ sync_top_markets()                                      │
│  └─ update_address_statistics()                             │
│                    ↓                                        │
│  MySQL 數據庫                                                │
│  ├─ markets (市場數據)                                       │
│  ├─ trades (交易記錄)                                        │
│  ├─ addresses (地址數據) [Python backend only]              │
│  ├─ address_trades (地址交易) [Python backend only]         │
│  └─ predictions (AI 預測)                                    │
│                    ↓                                        │
│  tRPC API (Node.js backend)                                 │
│  └─ 前端展示                                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 數據庫現狀分析

### 1. 地址數據（addresses 表）
**注意**: 這個表只存在於 Python backend 的本地數據庫中，**不在** Drizzle schema 中

**統計數據**:
- 總地址數: **未知**（需要查詢 Python backend 數據庫）
- 巨鯨數量（交易量 >= $10k）: **未知**
- 最新活動時間: **未知**
- 最早發現時間: **未知**
- 平均交易量: **未知**

**問題**:
- ❌ Python backend 和 Node.js backend 使用**不同的數據庫**
- ❌ 地址數據沒有整合到主數據庫（Drizzle schema）
- ❌ 前端無法直接訪問地址數據

### 2. 交易數據（trades 表）
**統計數據**:
- 總交易數: **0**（表為空）
- 最新交易時間: **NULL**
- 最早交易時間: **NULL**
- 有交易的市場數: **0**
- 巨鯨交易數: **0**

**問題**:
- ❌ **沒有任何交易數據**
- ❌ 數據同步服務未運行或未連接到正確的數據庫

### 3. 市場數據（markets 表）
**統計數據**: 需要查詢

**問題**:
- ⚠️ 可能有市場數據，但沒有對應的交易記錄
- ⚠️ 價格更新可能不及時

---

## 🚨 核心痛點

### 痛點 1: 數據時效性問題 ⚠️⚠️⚠️

#### 現狀
- **沒有實時數據更新機制**
- 依賴手動運行 `sync_service.py`
- 沒有定時任務或自動化流程
- 交易表完全為空，說明數據同步從未成功運行

#### 根本原因
1. **缺少 OrderFilled 事件追蹤**
   - 當前只追蹤 splits/merges（Activity Subgraph）
   - 沒有使用 **Orderbook Subgraph** 獲取實時訂單事件
   - splits/merges 只是部分交易，不包含所有訂單填充

2. **沒有增量更新機制**
   - 每次查詢都從頭開始
   - 沒有記錄上次同步的時間戳
   - 效率低下，容易超時

3. **沒有自動化調度**
   - 需要手動運行腳本
   - 沒有 cron job 或定時任務
   - 數據更新不穩定

#### 影響
- ❌ 用戶看到的數據可能是數小時甚至數天前的
- ❌ 無法及時發現可疑交易
- ❌ 巨鯨追蹤失去時效性
- ❌ 警報系統無法正常工作

---

### 痛點 2: 地址覆蓋率不足 ⚠️⚠️

#### 現狀
- **地址數據未知**（Python backend 本地數據庫）
- 只追蹤「大額交易者」（min_volume >= $1000）
- 沒有追蹤所有參與交易的地址

#### 根本原因
1. **選擇性追蹤策略**
   - `sync_whale_traders()` 只獲取交易量 >= $1000 的地址
   - 忽略了大量小額交易者
   - 可能錯過可疑的小額高頻交易

2. **數據源限制**
   - 使用 PNL Subgraph 的 `userPositions` 查詢
   - 只返回前 100 個大額交易者
   - 沒有遍歷所有地址

3. **缺少交易事件追蹤**
   - 沒有從 orderFilledEvents 提取 maker/taker 地址
   - 無法自動發現新地址

#### 影響
- ❌ 無法追蹤所有參與者
- ❌ 可能錯過可疑的小額交易
- ❌ 地址網絡分析不完整
- ❌ 無法識別新興巨鯨

---

### 痛點 3: 數據完整性問題 ⚠️⚠️⚠️

#### 現狀
- **交易表完全為空**
- 只追蹤 splits/merges，不追蹤 orderFilled 事件
- 缺少完整的交易歷史

#### 根本原因
1. **使用錯誤的 Subgraph**
   - 當前使用 Activity Subgraph（splits/merges）
   - **應該使用 Orderbook Subgraph**（orderFilledEvents）
   - splits/merges 只是交易的一部分，不包含所有訂單

2. **數據庫架構分裂**
   - Python backend 使用本地 MySQL 數據庫
   - Node.js backend 使用 Drizzle + 遠程數據庫
   - 兩個系統沒有整合

3. **缺少關鍵欄位**
   - trades 表沒有 `maker`/`taker` 地址欄位
   - 無法追蹤交易雙方
   - 無法進行地址行為分析

#### 影響
- ❌ 無法進行完整的交易分析
- ❌ 無法識別交易模式
- ❌ 無法計算準確的持倉
- ❌ 無法檢測可疑交易

---

### 痛點 4: 系統架構問題 ⚠️⚠️

#### 現狀
- **雙後端架構**
  - Python backend: 數據收集和分析
  - Node.js backend: API 和前端服務
- **數據庫分裂**
  - Python backend: 本地 MySQL（addresses, address_trades）
  - Node.js backend: 遠程數據庫（markets, trades, users）
- **沒有統一的數據模型**

#### 根本原因
1. **歷史遺留問題**
   - Python backend 是早期開發的數據收集工具
   - Node.js backend 是後來添加的 Web 服務
   - 沒有進行系統整合

2. **缺少統一規劃**
   - 沒有統一的數據 schema
   - 沒有統一的 API 層
   - 數據同步邏輯分散

#### 影響
- ❌ 數據不一致
- ❌ 開發和維護複雜
- ❌ 難以擴展
- ❌ 前端無法訪問地址數據

---

## 📋 關鍵發現

### 1. 缺少 Orderbook Subgraph 整合 🔴
**最嚴重的問題**

當前系統使用的 Subgraph:
- ✅ PNL Subgraph
- ✅ Activity Subgraph
- ✅ Positions Subgraph
- ❌ **Orderbook Subgraph** ← **缺失！**

**Orderbook Subgraph** 是關鍵：
- 提供 `orderFilledEvents` 查詢
- 包含 maker/taker 地址
- 包含完整的交易金額和價格
- 包含交易時間戳和哈希
- **這是 warproxxx/poly_data 使用的核心 API**

**API 端點**:
```
https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/orderbook-subgraph/0.0.1/gn
```

### 2. 數據庫 Schema 需要擴展 🔴

當前 `trades` 表缺少關鍵欄位：

```typescript
// 當前 schema
export const trades = mysqlTable("trades", {
  id: int("id").autoincrement().primaryKey(),
  marketId: int("marketId").notNull(),
  tradeId: varchar("tradeId", { length: 255 }).notNull().unique(),
  side: mysqlEnum("side", ["YES", "NO"]).notNull(),
  price: int("price").notNull(),
  amount: int("amount").notNull(),
  isWhale: boolean("isWhale").default(false).notNull(),
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

**需要添加的欄位**:
- `makerAddress`: maker 地址
- `takerAddress`: taker 地址
- `makerAssetId`: maker 的 token ID
- `takerAssetId`: taker 的 token ID
- `makerAmount`: maker 交易金額
- `takerAmount`: taker 交易金額
- `transactionHash`: 交易哈希
- `fee`: 交易手續費

### 3. 需要新的 addresses 表 🔴

當前 Drizzle schema **沒有** addresses 表，需要創建：

```typescript
export const addresses = mysqlTable("addresses", {
  id: int("id").autoincrement().primaryKey(),
  address: varchar("address", { length: 42 }).notNull().unique(),
  label: varchar("label", { length: 255 }), // 地址標籤（巨鯨、可疑等）
  totalVolume: int("totalVolume").default(0), // 總交易量（美元，以分為單位）
  totalTrades: int("totalTrades").default(0), // 總交易次數
  avgTradeSize: int("avgTradeSize").default(0), // 平均交易金額
  winRate: int("winRate").default(0), // 勝率（0-100）
  realizedPnl: int("realizedPnl").default(0), // 已實現盈虧
  suspicionScore: int("suspicionScore").default(0), // 可疑評分（0-100）
  isWhale: boolean("isWhale").default(false).notNull(), // 是否為巨鯨
  isSuspicious: boolean("isSuspicious").default(false).notNull(), // 是否可疑
  firstSeenAt: timestamp("firstSeenAt").notNull(), // 首次發現時間
  lastActiveAt: timestamp("lastActiveAt").notNull(), // 最後活動時間
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
```

### 4. Python Backend 需要重構 🟡

**問題**:
- 使用本地數據庫，與主數據庫分離
- 數據同步邏輯未運行
- 缺少自動化調度

**解決方案**:
1. **選項 A**: 將 Python backend 整合到 Node.js backend
   - 使用 Python 子進程或微服務
   - 統一使用 Drizzle 數據庫
   - 通過 tRPC 暴露 API

2. **選項 B**: 保留 Python backend，但統一數據庫
   - Python backend 連接到 Drizzle 數據庫
   - 使用相同的 DATABASE_URL
   - 定時運行數據同步

3. **選項 C**: 完全用 Node.js 重寫數據收集邏輯
   - 使用 Node.js GraphQL 客戶端
   - 整合到 tRPC 後端
   - 統一技術棧

**推薦**: 選項 B（短期）+ 選項 C（長期）

---

## 🎯 解決方案路線圖

### Phase 1: 整合 Orderbook Subgraph（最優先）⭐⭐⭐

#### 目標
解決數據完整性和時效性問題

#### 行動
1. **添加 Orderbook Subgraph 客戶端**
   ```python
   # 在 subgraph_client.py 中添加
   self.orderbook_endpoint = 'https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/orderbook-subgraph/0.0.1/gn'
   
   async def get_order_filled_events(self, start_timestamp=0, limit=1000):
       """獲取訂單填充事件"""
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
       # ... 實現邏輯
   ```

2. **實現增量更新機制**
   ```python
   def get_last_synced_timestamp(self):
       """從數據庫獲取最後同步的時間戳"""
       cursor.execute("SELECT MAX(timestamp) FROM trades")
       result = cursor.fetchone()
       return result[0] if result[0] else 0
   
   async def sync_order_filled_events(self):
       """增量同步訂單事件"""
       last_timestamp = self.get_last_synced_timestamp()
       events = await self.get_order_filled_events(start_timestamp=last_timestamp)
       # 處理和保存事件
   ```

3. **設置定時任務**
   ```bash
   # 使用 cron 每 5 分鐘運行一次
   */5 * * * * cd /path/to/python-backend && python3 sync_service.py
   ```

#### 預期效果
- ✅ 獲取完整的交易數據
- ✅ 數據延遲降低到 5 分鐘
- ✅ 自動發現所有交易地址

---

### Phase 2: 擴展數據庫 Schema ⭐⭐⭐

#### 目標
支持完整的地址追蹤和分析

#### 行動
1. **更新 trades 表**
   ```typescript
   // drizzle/schema.ts
   export const trades = mysqlTable("trades", {
     // ... 現有欄位
     makerAddress: varchar("makerAddress", { length: 42 }).notNull(),
     takerAddress: varchar("takerAddress", { length: 42 }).notNull(),
     makerAssetId: varchar("makerAssetId", { length: 255 }).notNull(),
     takerAssetId: varchar("takerAssetId", { length: 255 }).notNull(),
     makerAmount: int("makerAmount").notNull(),
     takerAmount: int("takerAmount").notNull(),
     transactionHash: varchar("transactionHash", { length: 66 }).notNull().unique(),
     fee: int("fee").default(0),
   });
   ```

2. **創建 addresses 表**
   ```typescript
   export const addresses = mysqlTable("addresses", {
     // ... 如上所述
   });
   ```

3. **運行數據庫遷移**
   ```bash
   pnpm db:push
   ```

#### 預期效果
- ✅ 支持完整的交易數據存儲
- ✅ 支持地址追蹤和分析
- ✅ 統一數據模型

---

### Phase 3: 統一數據庫連接 ⭐⭐

#### 目標
解決雙數據庫問題

#### 行動
1. **修改 Python backend 數據庫配置**
   ```python
   # config.py
   import os
   
   # 使用與 Node.js backend 相同的 DATABASE_URL
   DATABASE_URL = os.getenv('DATABASE_URL')
   ```

2. **更新 sync_service.py**
   - 連接到遠程數據庫
   - 使用 Drizzle schema 的表結構
   - 刪除本地數據庫相關代碼

3. **測試數據同步**
   ```bash
   python3 sync_service.py
   ```

#### 預期效果
- ✅ 單一數據源
- ✅ 數據一致性
- ✅ 前端可訪問地址數據

---

### Phase 4: 實現地址分析功能 ⭐⭐

#### 目標
提供完整的地址行為分析

#### 行動
1. **創建地址分析服務**
   ```python
   # address_analyzer.py
   class AddressAnalyzer:
       def analyze_address(self, address):
           """分析地址行為"""
           # 計算交易統計
           # 識別交易模式
           # 計算可疑評分
           # 判斷是否為巨鯨
       
       def detect_suspicious_activity(self, address):
           """檢測可疑活動"""
           # 大額交易檢測
           # 異常價格檢測
           # 高頻交易檢測
           # 勝率異常檢測
   ```

2. **整合到 tRPC API**
   ```typescript
   // server/routers.ts
   addresses: {
     getAddress: publicProcedure
       .input(z.object({ address: z.string() }))
       .query(async ({ input }) => {
         // 調用 Python 分析服務或直接查詢數據庫
       }),
     
     getSuspiciousAddresses: publicProcedure
       .query(async () => {
         // 返回可疑地址列表
       }),
   }
   ```

3. **創建前端頁面**
   - 地址詳情頁
   - 可疑地址列表
   - 巨鯨排行榜

#### 預期效果
- ✅ 完整的地址追蹤
- ✅ 自動化的可疑檢測
- ✅ 用戶友好的界面

---

### Phase 5: 實現實時警報系統 ⭐

#### 目標
及時通知用戶可疑活動

#### 行動
1. **創建警報檢測服務**
   ```python
   # alert_detector.py
   class AlertDetector:
       def check_whale_trades(self):
           """檢測巨鯨交易"""
           # 查詢最近的大額交易
           # 觸發警報
       
       def check_suspicious_activity(self):
           """檢測可疑活動"""
           # 查詢可疑地址的新交易
           # 觸發警報
   ```

2. **整合到通知系統**
   - 使用現有的 notifications 表
   - 通過 tRPC 推送通知
   - 前端實時顯示

3. **設置定時檢測**
   ```bash
   # 每分鐘檢測一次
   * * * * * cd /path/to/python-backend && python3 alert_detector.py
   ```

#### 預期效果
- ✅ 實時警報通知
- ✅ 及時發現可疑活動
- ✅ 提升用戶體驗

---

## 📈 預期改進

### 數據時效性
- **當前**: 數小時延遲（手動更新）
- **改進後**: 5 分鐘延遲（自動更新）
- **提升**: **95%+**

### 地址覆蓋率
- **當前**: 數百個地址（僅大額交易者）
- **改進後**: 數萬個地址（所有參與者）
- **提升**: **100倍+**

### 數據完整性
- **當前**: 0 筆交易記錄
- **改進後**: 完整的交易歷史
- **提升**: **無限**

### 系統可靠性
- **當前**: 手動運行，不穩定
- **改進後**: 自動化，穩定運行
- **提升**: **顯著**

---

## 🚀 下一步行動

### 立即執行（本週）
1. ✅ 完成當前系統分析
2. [ ] 設計新的數據庫 schema
3. [ ] 實現 Orderbook Subgraph 客戶端
4. [ ] 測試數據同步邏輯

### 短期目標（2 週內）
1. [ ] 完成數據庫遷移
2. [ ] 統一數據庫連接
3. [ ] 實現增量更新機制
4. [ ] 部署定時任務

### 中期目標（1 個月內）
1. [ ] 實現地址分析功能
2. [ ] 實現可疑地址檢測
3. [ ] 創建前端頁面
4. [ ] 優化系統效能

### 長期目標（3 個月內）
1. [ ] 實現實時警報系統
2. [ ] 添加機器學習模型
3. [ ] 實現地址網絡分析
4. [ ] 發布產品級功能

---

## 💡 關鍵洞察

### 1. Orderbook Subgraph 是關鍵
- 提供最完整的交易數據
- 包含 maker/taker 地址
- 支持增量更新
- **必須立即整合**

### 2. 數據庫架構需要統一
- 雙數據庫導致數據不一致
- 前端無法訪問地址數據
- 維護成本高
- **必須合併**

### 3. 自動化是必須的
- 手動運行不可靠
- 數據更新不及時
- 無法支持實時警報
- **必須實現定時任務**

### 4. 地址追蹤需要全面覆蓋
- 不能只追蹤大額交易者
- 需要追蹤所有參與者
- 自動發現新地址
- **必須從 orderFilledEvents 提取**

---

## 📚 參考資料

### 代碼文件
- `/home/ubuntu/polymarket-insights/python-backend/subgraph_client.py`
- `/home/ubuntu/polymarket-insights/python-backend/sync_service.py`
- `/home/ubuntu/polymarket-insights/drizzle/schema.ts`

### API 端點
- Orderbook Subgraph: https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/orderbook-subgraph/0.0.1/gn
- PNL Subgraph: https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/pnl-subgraph/0.0.14/gn
- Activity Subgraph: https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/activity-subgraph/0.0.4/gn

### 參考項目
- warproxxx/poly_data: https://github.com/warproxxx/poly_data
- polymarket-apis: https://pypi.org/project/polymarket-apis/
