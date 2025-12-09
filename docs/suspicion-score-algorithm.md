# 可疑度分數計算算法

## 概述

可疑度分數（Suspicion Score）是一個 0-100 的數值，用於量化一個地址可能是內幕交易者的概率。分數越高，表示該地址的交易模式越異常，越可能擁有內幕資訊。

---

## 核心理念

**內幕交易者的典型特徵**：
1. **異常高的勝率**：比普通交易者更頻繁地押注正確方向
2. **早期下注**：在市場價格大幅變動前就提前布局
3. **大額交易**：有足夠的資金和信心進行大額下注
4. **精準時機**：在關鍵時刻進場，避免長時間持倉
5. **選擇性參與**：不是所有市場都參與，只在有把握的市場下注

---

## 計算公式

```
總可疑度分數 = 勝率分數 + 早期交易分數 + 交易規模分數 + 時機精準度分數 + 選擇性分數
```

每個維度的分數範圍和權重如下：

| 維度 | 最高分數 | 權重 | 說明 |
|------|---------|------|------|
| 勝率異常 | 30 | 30% | 最重要的指標 |
| 早期交易 | 25 | 25% | 提前布局能力 |
| 交易規模 | 20 | 20% | 資金實力和信心 |
| 時機精準度 | 15 | 15% | 進場時機的準確性 |
| 選擇性參與 | 10 | 10% | 只參與有把握的市場 |

---

## 1. 勝率分數（最高 30 分）

### 1.1 數據基礎

只計算**已結算市場**的勝率，排除未結算市場以避免噪音。

```sql
SELECT 
    COUNT(*) as total_settled_markets,
    SUM(CASE WHEN is_winner = TRUE THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN is_winner = FALSE THEN 1 ELSE 0 END) as losses
FROM address_market_performance
WHERE address_id = ? AND market_resolved = TRUE
```

### 1.2 閾值設定

基於 Polymarket 的真實數據分布（需要實際數據驗證）：

| 勝率範圍 | 百分位 | 分數 | 說明 |
|---------|--------|------|------|
| < 45% | 底部 25% | 0 | 虧損交易者 |
| 45-55% | 中位數 | 5 | 普通交易者（接近隨機） |
| 55-60% | 前 30% | 10 | 略有優勢 |
| 60-65% | 前 20% | 15 | 有明顯優勢 |
| 65-70% | 前 10% | 20 | 非常成功的交易者 |
| 70-75% | 前 5% | 25 | 極端成功（可疑） |
| > 75% | 前 1% | **30** | 幾乎不可能（高度可疑） |

### 1.3 計算邏輯

```python
def calculate_win_rate_score(win_rate, total_markets):
    """
    計算勝率分數
    
    Args:
        win_rate: 勝率百分比 (0-100)
        total_markets: 已結算市場總數
    
    Returns:
        分數 (0-30)
    """
    # 樣本量太小，不可靠
    if total_markets < 5:
        return 0
    
    # 勝率分段計分
    if win_rate < 45:
        return 0
    elif win_rate < 55:
        return 5
    elif win_rate < 60:
        return 10
    elif win_rate < 65:
        return 15
    elif win_rate < 70:
        return 20
    elif win_rate < 75:
        return 25
    else:
        # 超過 75% 的勝率極其罕見
        return 30
```

### 1.4 統計學驗證

假設市場結果是隨機的（50/50），一個交易者在 N 個市場中達到 X% 勝率的概率：

```
P(勝率 >= X%) = 二項分布累積概率
```

例如：
- 在 10 個市場中達到 70% 勝率：P ≈ 17%（不罕見）
- 在 20 個市場中達到 70% 勝率：P ≈ 5.8%（罕見）
- 在 50 個市場中達到 70% 勝率：P ≈ 0.0004%（幾乎不可能）

**結論**：勝率必須結合樣本量來評估。

---

## 2. 早期交易分數（最高 25 分）

### 2.1 定義「早期交易」

**早期交易**是指在市場價格大幅變動前就已經下注的交易。

**價格大幅變動的定義**：
- 市場價格在 24 小時內變動 > 20%
- 或者市場價格從創建時的 0.5 移動到 > 0.7 或 < 0.3

**早期的定義**：
- 在價格大幅變動前 24-72 小時就下注

### 2.2 數據查詢

```sql
-- 識別價格大幅變動的時間點
WITH price_pumps AS (
    SELECT 
        market_id,
        MIN(timestamp) as pump_time,
        MIN(price) as start_price,
        MAX(price) as peak_price
    FROM trades
    WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY market_id
    HAVING (peak_price - start_price) / start_price > 0.2
)

-- 找出在價格變動前就下注的地址
SELECT 
    a.address,
    COUNT(*) as early_trade_count,
    AVG(TIMESTAMPDIFF(HOUR, t.timestamp, p.pump_time)) as avg_hours_before_pump
FROM address_trades t
JOIN addresses a ON t.address_id = a.id
JOIN price_pumps p ON t.market_id = p.market_id
WHERE t.timestamp < p.pump_time
AND t.timestamp >= DATE_SUB(p.pump_time, INTERVAL 72 HOUR)
AND t.side = 'buy'
GROUP BY a.address
```

### 2.3 閾值設定

| 早期交易比例 | 分數 | 說明 |
|-------------|------|------|
| < 10% | 0 | 很少提前布局 |
| 10-20% | 5 | 偶爾提前布局 |
| 20-30% | 10 | 經常提前布局 |
| 30-40% | 15 | 頻繁提前布局（可疑） |
| 40-50% | 20 | 非常頻繁（高度可疑） |
| > 50% | **25** | 幾乎總是提前（極度可疑） |

### 2.4 計算邏輯

```python
def calculate_early_trading_score(address_id, db_connection):
    """
    計算早期交易分數
    
    Returns:
        分數 (0-25)
    """
    cursor = db_connection.cursor(dictionary=True)
    
    # 獲取地址的總交易次數
    cursor.execute("""
        SELECT total_trades FROM addresses WHERE id = %s
    """, (address_id,))
    total_trades = cursor.fetchone()['total_trades']
    
    if total_trades < 5:
        return 0
    
    # 計算早期交易次數
    cursor.execute("""
        WITH price_pumps AS (
            SELECT 
                market_id,
                MIN(timestamp) as pump_time
            FROM trades
            WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 90 DAY)
            GROUP BY market_id
            HAVING MAX(price) - MIN(price) > 0.2
        )
        SELECT COUNT(*) as early_trades
        FROM address_trades t
        JOIN price_pumps p ON t.market_id = p.market_id
        WHERE t.address_id = %s
        AND t.timestamp < p.pump_time
        AND t.timestamp >= DATE_SUB(p.pump_time, INTERVAL 72 HOUR)
        AND t.side = 'buy'
    """, (address_id,))
    
    early_trades = cursor.fetchone()['early_trades']
    early_rate = (early_trades / total_trades) * 100
    
    cursor.close()
    
    # 分段計分
    if early_rate < 10:
        return 0
    elif early_rate < 20:
        return 5
    elif early_rate < 30:
        return 10
    elif early_rate < 40:
        return 15
    elif early_rate < 50:
        return 20
    else:
        return 25
```

### 2.5 時間窗口的選擇

| 時間窗口 | 說明 | 可疑度 |
|---------|------|--------|
| 0-12 小時前 | 可能是對公開資訊的快速反應 | 低 |
| 12-24 小時前 | 可能有資訊優勢 | 中 |
| 24-48 小時前 | 很可能有內幕資訊 | 高 |
| 48-72 小時前 | 極可能有內幕資訊 | 極高 |
| > 72 小時前 | 可能是長期持倉，不一定是內幕 | 中 |

**建議**：重點關注 24-72 小時窗口的早期交易。

---

## 3. 交易規模分數（最高 20 分）

### 3.1 數據基礎

```sql
SELECT 
    AVG(amount) as avg_trade_size,
    MAX(amount) as max_trade_size,
    total_volume
FROM address_trades
WHERE address_id = ?
```

### 3.2 閾值設定

基於 Polymarket 的交易量分布：

| 平均交易金額 | 百分位 | 分數 | 說明 |
|------------|--------|------|------|
| < $50 | 底部 50% | 0 | 小額散戶 |
| $50-$100 | 前 40% | 5 | 普通散戶 |
| $100-$200 | 前 30% | 8 | 活躍散戶 |
| $200-$500 | 前 20% | 12 | 小型機構/大戶 |
| $500-$1,000 | 前 10% | 15 | 中型機構 |
| $1,000-$5,000 | 前 5% | 18 | 大型機構 |
| > $5,000 | 前 1% | **20** | 超大型機構（鯨魚） |

### 3.3 計算邏輯

```python
def calculate_trade_size_score(avg_trade_size, max_trade_size):
    """
    計算交易規模分數
    
    Args:
        avg_trade_size: 平均交易金額（美元）
        max_trade_size: 最大單筆交易金額（美元）
    
    Returns:
        分數 (0-20)
    """
    # 主要看平均交易金額
    if avg_trade_size < 50:
        base_score = 0
    elif avg_trade_size < 100:
        base_score = 5
    elif avg_trade_size < 200:
        base_score = 8
    elif avg_trade_size < 500:
        base_score = 12
    elif avg_trade_size < 1000:
        base_score = 15
    elif avg_trade_size < 5000:
        base_score = 18
    else:
        base_score = 20
    
    # 如果有超大單筆交易，額外加分
    if max_trade_size > 10000:
        base_score = min(base_score + 2, 20)
    
    return base_score
```

### 3.4 為什麼交易規模重要？

1. **信心指標**：大額交易表示交易者對結果有高度信心
2. **資金來源**：普通散戶很難持續進行大額交易
3. **風險承受能力**：內幕交易者因為有資訊優勢，敢於下大注

---

## 4. 時機精準度分數（最高 15 分）

### 4.1 定義「精準時機」

**精準時機**是指交易者在市場價格最有利的時候進場，並在最佳時機退出。

**衡量指標**：
- **進場時機**：買入時的價格 vs. 市場最終價格
- **持倉時間**：從進場到退出的時間（越短越可疑）
- **退出時機**：賣出時的價格 vs. 買入價格

### 4.2 數據查詢

```sql
SELECT 
    a.address,
    AVG(amp.exit_price - amp.entry_price) as avg_price_gain,
    AVG(TIMESTAMPDIFF(HOUR, amp.entry_time, amp.exit_time)) as avg_holding_hours,
    COUNT(*) as total_trades
FROM address_market_performance amp
JOIN addresses a ON amp.address_id = a.id
WHERE amp.market_resolved = TRUE
AND amp.exit_time IS NOT NULL
GROUP BY a.address
```

### 4.3 閾值設定

#### 4.3.1 價格收益率

| 平均價格收益 | 分數 | 說明 |
|------------|------|------|
| < 5% | 0 | 進場時機不佳 |
| 5-10% | 3 | 普通 |
| 10-15% | 6 | 不錯的時機 |
| 15-20% | 9 | 很好的時機 |
| > 20% | **12** | 極佳的時機（可疑） |

#### 4.3.2 持倉時間

| 平均持倉時間 | 分數 | 說明 |
|------------|------|------|
| > 7 天 | 0 | 長期持倉 |
| 3-7 天 | 1 | 中期持倉 |
| 1-3 天 | 2 | 短期持倉 |
| < 1 天 | **3** | 超短期（可疑） |

### 4.4 計算邏輯

```python
def calculate_timing_score(address_id, db_connection):
    """
    計算時機精準度分數
    
    Returns:
        分數 (0-15)
    """
    cursor = db_connection.cursor(dictionary=True)
    
    cursor.execute("""
        SELECT 
            AVG((exit_price - entry_price) / entry_price * 100) as avg_gain_pct,
            AVG(TIMESTAMPDIFF(HOUR, entry_time, exit_time)) as avg_holding_hours,
            COUNT(*) as completed_trades
        FROM address_market_performance
        WHERE address_id = %s
        AND market_resolved = TRUE
        AND exit_time IS NOT NULL
    """, (address_id,))
    
    result = cursor.fetchone()
    cursor.close()
    
    if result['completed_trades'] < 3:
        return 0
    
    avg_gain = result['avg_gain_pct'] or 0
    avg_hours = result['avg_holding_hours'] or 0
    
    # 價格收益分數 (0-12)
    if avg_gain < 5:
        gain_score = 0
    elif avg_gain < 10:
        gain_score = 3
    elif avg_gain < 15:
        gain_score = 6
    elif avg_gain < 20:
        gain_score = 9
    else:
        gain_score = 12
    
    # 持倉時間分數 (0-3)
    if avg_hours > 168:  # > 7 天
        time_score = 0
    elif avg_hours > 72:  # 3-7 天
        time_score = 1
    elif avg_hours > 24:  # 1-3 天
        time_score = 2
    else:  # < 1 天
        time_score = 3
    
    return gain_score + time_score
```

---

## 5. 選擇性參與分數（最高 10 分）

### 5.1 核心理念

內幕交易者不會參與所有市場，而是**選擇性地只參與有內幕資訊的市場**。

**衡量指標**：
- **參與率**：參與的市場數 / 同期活躍的總市場數
- **勝率一致性**：在參與的市場中勝率是否穩定

### 5.2 數據查詢

```sql
-- 計算地址的市場參與率
SELECT 
    a.address,
    COUNT(DISTINCT amp.market_id) as participated_markets,
    (SELECT COUNT(*) FROM markets WHERE created_at >= a.first_seen_at) as total_markets,
    COUNT(DISTINCT amp.market_id) / (SELECT COUNT(*) FROM markets WHERE created_at >= a.first_seen_at) * 100 as participation_rate
FROM addresses a
LEFT JOIN address_market_performance amp ON a.id = amp.address_id
GROUP BY a.address
```

### 5.3 閾值設定

| 參與率 | 分數 | 說明 |
|--------|------|------|
| > 50% | 0 | 參與太多市場（不選擇） |
| 30-50% | 2 | 較活躍 |
| 10-30% | 5 | 選擇性參與 |
| 5-10% | 8 | 高度選擇性（可疑） |
| < 5% | **10** | 極度選擇性（高度可疑） |

### 5.4 計算邏輯

```python
def calculate_selectivity_score(address_id, db_connection):
    """
    計算選擇性參與分數
    
    Returns:
        分數 (0-10)
    """
    cursor = db_connection.cursor(dictionary=True)
    
    cursor.execute("""
        SELECT 
            a.first_seen_at,
            COUNT(DISTINCT amp.market_id) as participated_markets,
            (SELECT COUNT(*) 
             FROM markets 
             WHERE created_at >= a.first_seen_at 
             AND created_at <= NOW()) as total_markets
        FROM addresses a
        LEFT JOIN address_market_performance amp ON a.id = amp.address_id
        WHERE a.id = %s
        GROUP BY a.id
    """, (address_id,))
    
    result = cursor.fetchone()
    cursor.close()
    
    if result['total_markets'] == 0:
        return 0
    
    participation_rate = (result['participated_markets'] / result['total_markets']) * 100
    
    # 分段計分
    if participation_rate > 50:
        return 0
    elif participation_rate > 30:
        return 2
    elif participation_rate > 10:
        return 5
    elif participation_rate > 5:
        return 8
    else:
        return 10
```

---

## 6. 綜合計算示例

### 示例 1：高度可疑的地址

```python
address_stats = {
    'win_rate': 78,           # 78% 勝率
    'total_markets': 25,      # 25 個已結算市場
    'early_trade_rate': 52,   # 52% 的交易是早期交易
    'avg_trade_size': 1200,   # 平均交易 $1,200
    'max_trade_size': 5000,   # 最大單筆 $5,000
    'avg_gain_pct': 22,       # 平均收益 22%
    'avg_holding_hours': 18,  # 平均持倉 18 小時
    'participation_rate': 4   # 只參與 4% 的市場
}

# 計算各維度分數
win_rate_score = 30        # > 75% 勝率
early_trade_score = 25     # > 50% 早期交易
trade_size_score = 18      # $1,000-$5,000
timing_score = 12 + 3 = 15 # 22% 收益 + < 1 天持倉
selectivity_score = 10     # < 5% 參與率

total_score = 30 + 25 + 18 + 15 + 10 = 98

# 結論：極度可疑（98/100）
```

### 示例 2：普通交易者

```python
address_stats = {
    'win_rate': 52,
    'total_markets': 15,
    'early_trade_rate': 8,
    'avg_trade_size': 75,
    'max_trade_size': 200,
    'avg_gain_pct': 6,
    'avg_holding_hours': 120,
    'participation_rate': 35
}

# 計算各維度分數
win_rate_score = 5         # 45-55% 勝率
early_trade_score = 0      # < 10% 早期交易
trade_size_score = 5       # $50-$100
timing_score = 3 + 1 = 4   # 6% 收益 + 3-7 天持倉
selectivity_score = 2      # 30-50% 參與率

total_score = 5 + 0 + 5 + 4 + 2 = 16

# 結論：普通交易者（16/100）
```

---

## 7. 動態閾值調整

### 7.1 為什麼需要動態調整？

固定閾值可能不適用於所有情況：
- 市場成熟度不同（新市場 vs. 老市場）
- 市場類型不同（政治 vs. 體育 vs. 加密貨幣）
- 時間段不同（牛市 vs. 熊市）

### 7.2 動態調整方法

```python
def adjust_thresholds_by_market_type(market_category):
    """
    根據市場類型調整閾值
    
    Returns:
        調整係數 (0.8-1.2)
    """
    adjustments = {
        'politics': 1.2,      # 政治市場更容易有內幕
        'crypto': 1.0,        # 加密貨幣市場正常
        'sports': 0.9,        # 體育市場較公開透明
        'entertainment': 0.8  # 娛樂市場較隨機
    }
    
    return adjustments.get(market_category, 1.0)

def calculate_dynamic_suspicion_score(address_id, market_category, db_connection):
    """
    計算動態可疑度分數
    """
    # 計算基礎分數
    base_score = (
        calculate_win_rate_score(...) +
        calculate_early_trading_score(...) +
        calculate_trade_size_score(...) +
        calculate_timing_score(...) +
        calculate_selectivity_score(...)
    )
    
    # 根據市場類型調整
    adjustment = adjust_thresholds_by_market_type(market_category)
    adjusted_score = base_score * adjustment
    
    return min(adjusted_score, 100)
```

---

## 8. 實作建議

### 8.1 分階段實作

**Phase 1：基礎版本**
- 只實作勝率分數和早期交易分數（佔總分 55%）
- 使用固定閾值
- 快速驗證概念

**Phase 2：完整版本**
- 實作所有 5 個維度
- 收集真實數據，校準閾值
- 添加動態調整機制

**Phase 3：機器學習版本**
- 使用歷史數據訓練模型
- 自動學習最佳閾值
- 發現新的可疑模式

### 8.2 數據收集和校準

```python
def calibrate_thresholds(db_connection):
    """
    基於真實數據校準閾值
    """
    cursor = db_connection.cursor(dictionary=True)
    
    # 獲取所有地址的勝率分布
    cursor.execute("""
        SELECT 
            win_rate,
            COUNT(*) as count
        FROM addresses
        WHERE settled_count >= 5
        GROUP BY FLOOR(win_rate / 5) * 5
        ORDER BY win_rate
    """)
    
    distribution = cursor.fetchall()
    
    # 計算百分位
    percentiles = calculate_percentiles(distribution)
    
    # 輸出建議的閾值
    print(f"50th percentile (median): {percentiles[50]}%")
    print(f"75th percentile: {percentiles[75]}%")
    print(f"90th percentile: {percentiles[90]}%")
    print(f"95th percentile: {percentiles[95]}%")
    print(f"99th percentile: {percentiles[99]}%")
    
    cursor.close()
```

### 8.3 可視化和驗證

創建儀表板展示：
1. **分數分布圖**：所有地址的可疑度分數分布
2. **各維度貢獻圖**：每個維度對總分的貢獻
3. **案例研究**：高分地址的詳細交易歷史
4. **假陽性率**：被標記為可疑但實際正常的比例

---

## 9. 倫理和法律考量

### 9.1 免責聲明

```
本平台提供的「可疑度分數」僅基於公開的鏈上數據和統計分析，
不構成任何法律指控或投資建議。高分數並不意味著該地址一定
從事內幕交易，可能只是交易策略優秀或運氣好。
```

### 9.2 隱私保護

- 不顯示地址的完整資訊（只顯示前 6 位和後 4 位）
- 不提供地址的個人身份資訊
- 用戶可以選擇匿名模式

### 9.3 誤報處理

- 提供申訴機制
- 允許地址擁有者解釋交易策略
- 定期審查和調整算法

---

## 10. 總結

可疑度分數是一個多維度的量化指標，結合了：
- **勝率異常**（30 分）：最重要的指標
- **早期交易**（25 分）：提前布局能力
- **交易規模**（20 分）：資金實力和信心
- **時機精準度**（15 分）：進退場時機
- **選擇性參與**（10 分）：只參與有把握的市場

通過科學的閾值設定和動態調整機制，我們可以有效識別可能的內幕交易者，為普通用戶提供有價值的參考資訊。
