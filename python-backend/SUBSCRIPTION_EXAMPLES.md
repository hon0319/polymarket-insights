# Polymarket RTDS 訂閱範例

## 關鍵發現

根據官方 GitHub 客戶端，正確的訂閱方式是：

### 1. 訂閱交易數據（Trades）

```typescript
client.subscribe({
    subscriptions: [
        {
            topic: "activity",
            type: "trades",
        },
    ],
});
```

### 2. 訂閱評論數據（Comments）

```typescript
client.subscribe({
    subscriptions: [
        {
            topic: "comments",
            type: "*", // "*" 可用於連接該主題的所有類型
            filters: {"parentEntityID":"100","parentEntityType":"Event"}, // 可選過濾器
        },
    ],
});
```

### 3. 訂閱所有類型

使用 `type: "*"` 可以訂閱某個主題的所有消息類型。

## Python 實作

我們需要將訂閱格式改為：

```python
subscribe_message = {
    "action": "subscribe",
    "subscriptions": [
        {
            "topic": "activity",
            "type": "trades"
        }
    ]
}
```

## 重要注意事項

1. **WebSocket URL**: `wss://ws-live-data.polymarket.com`
2. **訂閱格式**: 必須使用 `action: "subscribe"` 和 `subscriptions` 數組
3. **Topic**: 
   - `"activity"` - 用於交易數據
   - `"comments"` - 用於評論
   - `"crypto_prices"` - 用於加密貨幣價格
4. **Type**: 
   - `"trades"` - 交易事件
   - `"*"` - 所有類型
5. **Filters**: 可選的過濾器對象

## 下一步

1. 更新 `polymarket_agent.py` 使用正確的 WebSocket URL
2. 修改訂閱消息格式
3. 添加 Ping/Pong 心跳機制（每 5 秒）
4. 測試連接穩定性
