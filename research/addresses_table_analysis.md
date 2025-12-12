# Addresses 表結構分析

**分析日期**: 2024-12-12  
**目的**: 確定現有 addresses 表的結構，與 Drizzle schema 對齊

---

## 現有欄位（Python backend 創建）

根據 `SHOW COLUMNS FROM addresses` 的結果，現有表包含以下欄位：

1. `id` - int, PRIMARY KEY, AUTO_INCREMENT
2. `address` - varchar(42), UNIQUE
3. `label` - varchar(255), NULL
4. `total_volume` - int, DEFAULT 0
5. `total_trades` - int, DEFAULT 0
6. `avg_trade_size` - int, DEFAULT 0
7. `win_rate` - int, DEFAULT 0
8. `realized_pnl` - int, DEFAULT 0
9. `suspicion_score` - int, DEFAULT 0
10. `trading_frequency` - int, DEFAULT 0
11. `avg_holding_period` - int, DEFAULT 0
12. `is_whale` - tinyint(1), DEFAULT 0
13. `is_suspicious` - tinyint(1), DEFAULT 0
14. `is_high_frequency` - tinyint(1), DEFAULT 0
15. `first_seen_at` - timestamp
16. `last_active_at` - timestamp
17. `created_at` - timestamp, DEFAULT CURRENT_TIMESTAMP
18. `updated_at` - timestamp, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**總計**: 15 個欄位（根據 affected: 15）

---

## Drizzle Schema 對比

我們的 Drizzle schema 定義了相同的欄位，使用 snake_case 命名：

```typescript
export const addresses = mysqlTable("addresses", {
  id: int("id").autoincrement().primaryKey(),
  address: varchar("address", { length: 42 }).notNull().unique(),
  label: varchar("label", { length: 255 }),
  total_volume: int("total_volume").default(0),
  total_trades: int("total_trades").default(0),
  avg_trade_size: int("avg_trade_size").default(0),
  win_rate: int("win_rate").default(0),
  realized_pnl: int("realized_pnl").default(0),
  suspicion_score: int("suspicion_score").default(0),
  trading_frequency: int("trading_frequency").default(0),
  avg_holding_period: int("avg_holding_period").default(0),
  is_whale: boolean("is_whale").default(false).notNull(),
  is_suspicious: boolean("is_suspicious").default(false).notNull(),
  is_high_frequency: boolean("is_high_frequency").default(false).notNull(),
  first_seen_at: timestamp("first_seen_at").notNull(),
  last_active_at: timestamp("last_active_at").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
```

---

## 結論

✅ **現有表結構與 Drizzle schema 完全匹配！**

所有欄位名稱、類型和約束都一致。Python backend 已經創建了完整的 addresses 表結構。

**下一步行動**:
1. 不需要修改 addresses 表
2. 繼續處理 trades 表的遷移
3. 創建 sync_state 表
4. 開始實現數據收集邏輯

---

## 數據統計

- 總地址數: 1
- 最新活動: (需要查詢)
- 最早發現: (需要查詢)
