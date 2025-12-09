# Polymarket Real-Time Data Socket (RTDS) 重點筆記

## 關鍵發現

我們之前使用的 WebSocket URL 是**錯誤的**！

### 正確的 WebSocket URL

- **舊的（錯誤）**: `wss://ws-subscriptions-clob.polymarket.com/ws/market`
- **新的（正確）**: `wss://ws-live-data.polymarket.com`

## 連接細節

- **Protocol**: WebSocket
- **Data Format**: JSON
- **Ping/Pong**: 必須每 5 秒發送 PING 消息以維持連接

## 訂閱格式

### 訂閱消息結構

```json
{
  "action": "subscribe",
  "subscriptions": [
    {
      "topic": "topic_name",
      "type": "message_type",
      "filters": "optional_filter_string",
      "clob_auth": {
        "key": "api_key",
        "secret": "api_secret",
        "passphrase": "api_passphrase"
      },
      "gamma_auth": {
        "address": "wallet_address"
      }
    }
  ]
}
```

### 取消訂閱

```json
{
  "action": "unsubscribe",
  "subscriptions": [...]
}
```

## 可用的訂閱類型

1. **Crypto Prices** - 實時加密貨幣價格更新
2. **Comments** - 評論相關事件（包括反應）

**注意**: 雖然技術上支持其他活動和訂閱類型，但它們目前並未完全支持，可能會有意外行為。

## 接收消息結構

```json
{
  "topic": "string",
  "type": "string",
  "timestamp": "number",
  "payload": "object"
}
```

- `topic`: 訂閱主題（例如 "crypto_prices", "comments", "activity"）
- `type`: 消息類型/事件（例如 "update", "reaction_created", "orders_matched"）
- `timestamp`: Unix 時間戳（毫秒）
- `payload`: 事件特定的數據對象

## 認證類型

### 1. CLOB Authentication
用於交易相關訂閱：
- `key`: API key
- `secret`: API secret
- `passphrase`: API passphrase

### 2. Gamma Authentication
用於用戶特定數據：
- `address`: 用戶錢包地址

## 連接管理特性

- **動態訂閱**: 無需斷開連接即可添加、刪除和修改訂閱主題和過濾器
- **Ping/Pong**: 應該發送 PING 消息（理想情況下每 5 秒）以維持連接

## 錯誤處理

- 連接錯誤會觸發自動重連嘗試
- 無效的訂閱消息可能導致連接關閉
- 認證失敗將阻止成功訂閱受保護的主題

## 需要進一步研究

我們需要查看：
1. 如何訂閱市場數據（不僅僅是 crypto prices）
2. 如何訂閱交易數據
3. 是否有公開的市場數據流（不需要認證）

## 官方 TypeScript 客戶端

Polymarket 提供了 TypeScript 客戶端來與此流服務交互。
文檔: https://docs.polymarket.com/developers/RTDS/RTDS-overview

## 下一步

1. 更新 WebSocket URL 為 `wss://ws-live-data.polymarket.com`
2. 實作正確的訂閱消息格式
3. 添加 Ping/Pong 心跳機制
4. 研究如何訂閱市場交易數據
5. 測試連接穩定性
