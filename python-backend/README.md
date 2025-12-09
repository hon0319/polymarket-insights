# Polymarket Insights - Python Backend

這是 Polymarket Insights 的 Python 後端服務，負責：
- 連接 Polymarket WebSocket 接收實時交易數據
- 使用 OpenRouter API 訪問多個 AI 模型進行市場預測分析
- 通過 WebSocket 向前端推送實時數據
- 將數據存儲到 MySQL 資料庫

## 架構

```
python-backend/
├── agents/
│   └── polymarket_agent.py    # Polymarket 數據收集代理
├── models/
│   └── model_factory.py       # AI 模型工廠（OpenRouter 整合）
├── utils/                      # 工具函數
├── config.py                   # 配置文件
├── main.py                     # 主程序入口
├── requirements.txt            # Python 依賴
├── start.sh                    # 啟動腳本
└── README.md                   # 本文件
```

## 功能特點

### 1. 實時數據收集
- 連接到 Polymarket WebSocket (`wss://ws-subscriptions-clob.polymarket.com/ws/market`)
- 訂閱所有市場的交易數據
- 過濾掉低於閾值的小額交易（默認 $1,000）
- 排除加密貨幣和體育類市場

### 2. AI 預測分析（OpenRouter）
- **統一 API**：使用 OpenRouter 訪問多個 AI 提供商
- **支援模型**：
  - OpenAI GPT-4o Mini
  - Anthropic Claude 3.5 Haiku
  - Google Gemini 2.0 Flash
  - 以及 OpenRouter 支援的所有其他模型
- **Swarm 模式**：多模型共識預測
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
- OpenRouter API Key

### 2. 安裝依賴

```bash
cd python-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. 配置環境變數

在專案根目錄的 `.env` 文件中添加：

```env
# Database
DATABASE_URL=mysql://user:password@host:port/database

# OpenRouter API Key
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here

# Trading Thresholds (可選)
TRADE_NOTIONAL_THRESHOLD=1000
WHALE_TRADE_THRESHOLD=10000
IGNORE_PRICE_THRESHOLD=0.05

# WebSocket Server (可選)
WS_SERVER_HOST=localhost
WS_SERVER_PORT=8765

# AI Configuration (可選)
USE_SWARM_MODE=true
```

### 4. 啟動服務

使用啟動腳本：

```bash
./start.sh
```

或手動啟動：

```bash
source venv/bin/activate
python main.py
```

## OpenRouter 配置

### 獲取 API Key

1. 訪問 [OpenRouter](https://openrouter.ai/)
2. 註冊並登入帳戶
3. 前往 [API Keys](https://openrouter.ai/keys) 頁面
4. 創建新的 API Key
5. 將 Key 添加到 `.env` 文件

### 選擇模型

在 `config.py` 中配置要使用的模型：

```python
SWARM_MODELS = [
    "openai/gpt-4o-mini",              # 快速且經濟
    "anthropic/claude-3.5-haiku",      # 平衡性能和成本
    "google/gemini-2.0-flash-exp"      # 實驗性功能
]
```

完整的模型列表請參考：https://openrouter.ai/models

### 定價

OpenRouter 採用按使用量計費：
- GPT-4o Mini: ~$0.15/1M tokens
- Claude 3.5 Haiku: ~$0.80/1M tokens
- Gemini 2.0 Flash: ~$0.075/1M tokens

實際價格請查看 [OpenRouter 定價頁面](https://openrouter.ai/models)。

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
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-haiku",
    "google/gemini-2.0-flash-exp",
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

### 3. OpenRouter API 錯誤
- 確認 `OPENROUTER_API_KEY` 有效
- 檢查 API 配額和餘額
- 查看錯誤日誌中的詳細信息
- 訪問 [OpenRouter Dashboard](https://openrouter.ai/activity) 查看使用情況

### 4. 模型不可用
- 某些模型可能暫時不可用
- 嘗試使用其他模型
- 查看 [OpenRouter 狀態頁面](https://status.openrouter.ai/)

## 開發建議

### 添加新的 AI 模型

在 `config.py` 中添加模型名稱：

```python
SWARM_MODELS = [
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-haiku",
    "google/gemini-2.0-flash-exp",
    "meta-llama/llama-3.1-70b-instruct",  # 新增模型
]
```

### 自定義市場過濾

修改 `agents/polymarket_agent.py` 中的 `should_ignore_market` 方法：

```python
def should_ignore_market(self, title: str) -> bool:
    # 添加自定義過濾邏輯
    return False
```

### 調整 AI 預測提示

修改 `agents/polymarket_agent.py` 中的 `run_ai_analysis` 方法：

```python
system_prompt = """Your custom system prompt here"""
user_prompt = f"""Your custom user prompt with {market_data}"""
```

## 性能優化

### 減少 API 調用成本

1. **使用更便宜的模型**：
   ```python
   SWARM_MODELS = ["openai/gpt-4o-mini"]  # 只使用最便宜的模型
   ```

2. **減少分析頻率**：
   ```python
   REANALYSIS_HOURS = 24  # 從 8 小時改為 24 小時
   ```

3. **限制最大 token 數**：
   ```python
   AI_MAX_TOKENS = 300  # 從 500 減少到 300
   ```

### 提高響應速度

1. **使用更快的模型**：
   ```python
   SWARM_MODELS = [
       "openai/gpt-4o-mini",        # 非常快
       "google/gemini-2.0-flash-exp"  # 也很快
   ]
   ```

2. **減少模型數量**：
   ```python
   SWARM_MODELS = ["openai/gpt-4o-mini"]  # 只用一個模型
   USE_SWARM_MODE = False
   ```

## 參考資料

- [Polymarket API 文檔](https://docs.polymarket.com/)
- [OpenRouter 文檔](https://openrouter.ai/docs)
- [OpenRouter 模型列表](https://openrouter.ai/models)
- [moon-dev-ai-agents](https://github.com/moondevonyt/moon-dev-ai-agents)

## 支持

如有問題或建議，請：
1. 查看本文檔的故障排除部分
2. 檢查 OpenRouter 文檔
3. 聯繫開發團隊

---

**最後更新**：2025-12-09
**版本**：2.0.0（OpenRouter 整合版）
