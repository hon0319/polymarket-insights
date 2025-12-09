# Polymarket Insights - Python Backend

這是 Polymarket Insights 的 Python 後端服務，負責：
- 連接 Polymarket WebSocket 接收實時交易數據
- 使用 AI 模型進行市場預測分析
- 通過 WebSocket 向前端推送實時數據
- 將數據存儲到 MySQL 資料庫

## 架構

```
python-backend/
├── agents/
│   └── polymarket_agent.py    # Polymarket 數據收集代理
├── models/
│   └── model_factory.py       # AI 模型工廠（OpenAI, Anthropic, Google）
├── utils/                      # 工具函數
├── config.py                   # 配置文件
├── main.py                     # 主程序入口
├── requirements.txt            # Python 依賴
└── start.sh                    # 啟動腳本
```

## 功能特點

### 1. 實時數據收集
- 連接到 Polymarket WebSocket (`wss://ws-subscriptions-clob.polymarket.com/ws/market`)
- 訂閱所有市場的交易數據
- 過濾掉低於閾值的小額交易（默認 $1,000）
- 排除加密貨幣和體育類市場

### 2. AI 預測分析
- 整合多個 AI 模型（GPT-4, Claude, Gemini）
- Swarm 模式：多模型共識預測
- 自動計算信心指數和投票結果
- 將預測結果存儲到資料庫

### 3. 大額交易追蹤
- 自動檢測超過 $10,000 的「鯨魚」交易
- 實時廣播到所有連接的前端客戶端
- 過濾接近結算價格的交易（0.05 或 0.95）

### 4. WebSocket 服務器
- 為前端提供 WebSocket 連接
- 推送實時市場更新和大額交易
- 支持多客戶端連接
- 自動處理斷線重連

## 安裝和運行

### 1. 環境要求
- Python 3.8+
- MySQL/TiDB 資料庫
- API Keys（OpenAI, Anthropic, Google）

### 2. 安裝依賴

```bash
cd python-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. 配置環境變數

在專案根目錄創建 `.env` 文件：

```env
# Database
DATABASE_URL=mysql://user:password@host:port/database

# AI API Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_API_KEY=your_google_key

# Trading Thresholds
TRADE_NOTIONAL_THRESHOLD=1000
WHALE_TRADE_THRESHOLD=10000
IGNORE_PRICE_THRESHOLD=0.05

# WebSocket Server
WS_SERVER_HOST=localhost
WS_SERVER_PORT=8765

# AI Configuration
USE_SWARM_MODE=true
```

### 4. 啟動服務

```bash
./start.sh
```

或手動啟動：

```bash
source venv/bin/activate
python main.py
```

## 使用方式

### 前端連接

前端通過 WebSocket 連接到 Python 後端：

```typescript
const ws = new WebSocket('ws://localhost:8765');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'whale_trade':
      console.log('大額交易:', message.data);
      break;
    case 'market_update':
      console.log('市場更新:', message.data);
      break;
  }
};
```

### 消息格式

#### 大額交易
```json
{
  "type": "whale_trade",
  "data": {
    "market": "Will Trump win 2024?",
    "side": "YES",
    "amount": 15000,
    "price": 0.65,
    "timestamp": "2025-12-09T02:30:00Z"
  }
}
```

#### 市場更新
```json
{
  "type": "market_update",
  "data": {
    "condition_id": "0x123...",
    "title": "Will Trump win 2024?",
    "price": 0.65,
    "volume_24h": 500000,
    "timestamp": "2025-12-09T02:30:00Z"
  }
}
```

## 配置說明

### 交易過濾

- `TRADE_NOTIONAL_THRESHOLD`: 最小交易金額（默認 $1,000）
- `WHALE_TRADE_THRESHOLD`: 大額交易閾值（默認 $10,000）
- `IGNORE_PRICE_THRESHOLD`: 忽略接近結算的價格（默認 0.05）

### 市場過濾

在 `config.py` 中配置要排除的關鍵字：

```python
IGNORE_CRYPTO_KEYWORDS = ["bitcoin", "ethereum", "crypto", ...]
IGNORE_SPORTS_KEYWORDS = ["nfl", "nba", "soccer", ...]
```

### AI 模型配置

```python
USE_SWARM_MODE = True  # 啟用多模型共識
SWARM_MODELS = [
    "gpt-4o-mini",
    "claude-3-5-haiku-20241022",
    "gemini-2.0-flash-exp",
]
```

## 故障排除

### 1. WebSocket 連接失敗
- 檢查 Polymarket WebSocket URL 是否正確
- 確認網絡連接正常
- 查看防火牆設置

### 2. 資料庫連接失敗
- 驗證 `DATABASE_URL` 格式正確
- 確認資料庫服務運行中
- 檢查資料庫權限

### 3. AI API 錯誤
- 確認 API Keys 有效
- 檢查 API 配額和限制
- 查看錯誤日誌

## 開發建議

### 添加新的 AI 模型

在 `models/model_factory.py` 中添加新的提供商：

```python
def _get_custom_completion(self, model, messages, temperature, max_tokens):
    # 實現自定義 AI 提供商的調用邏輯
    pass
```

### 自定義市場過濾

修改 `agents/polymarket_agent.py` 中的 `should_ignore_market` 方法：

```python
def should_ignore_market(self, title: str) -> bool:
    # 添加自定義過濾邏輯
    return False
```

### 添加新的事件類型

在 `on_ws_message` 方法中處理新的事件：

```python
if data.get("event_type") == "custom_event":
    self.process_custom_event(data)
```

## 參考資料

- [Polymarket API 文檔](https://docs.polymarket.com/)
- [moon-dev-ai-agents](https://github.com/moondevonyt/moon-dev-ai-agents)
- [OpenAI API](https://platform.openai.com/docs)
- [Anthropic API](https://docs.anthropic.com/)
- [Google Gemini API](https://ai.google.dev/)
