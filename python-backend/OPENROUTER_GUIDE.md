# OpenRouter 使用指南

本指南將幫助您配置和使用 OpenRouter API 來訪問多個 AI 模型。

## 什麼是 OpenRouter？

[OpenRouter](https://openrouter.ai/) 是一個統一的 AI 模型 API 網關，讓您可以使用單一 API Key 訪問來自多個提供商的 AI 模型，包括：
- OpenAI (GPT-4, GPT-3.5, etc.)
- Anthropic (Claude)
- Google (Gemini)
- Meta (Llama)
- Mistral AI
- 以及更多...

### 優勢

1. **統一接口**：一個 API Key 訪問所有模型
2. **靈活定價**：按使用量付費，無需多個訂閱
3. **模型多樣性**：輕鬆切換和比較不同模型
4. **成本透明**：清晰的定價和使用追蹤
5. **無需管理多個 API Keys**：簡化配置和管理

## 快速開始

### 1. 註冊 OpenRouter 帳戶

1. 訪問 [OpenRouter](https://openrouter.ai/)
2. 點擊右上角的 "Sign In"
3. 使用 Google、GitHub 或郵箱註冊

### 2. 獲取 API Key

1. 登入後，前往 [API Keys 頁面](https://openrouter.ai/keys)
2. 點擊 "Create Key"
3. 給 Key 起個名字（例如 "Polymarket Insights"）
4. 複製生成的 API Key（格式：`sk-or-v1-...`）

### 3. 添加餘額

OpenRouter 採用預付費模式：

1. 前往 [Credits 頁面](https://openrouter.ai/credits)
2. 選擇充值金額（最低 $5）
3. 使用信用卡支付

**建議**：先充值 $10-20 進行測試。

### 4. 配置環境變數

在專案根目錄的 `.env` 文件中添加：

```env
OPENROUTER_API_KEY=sk-or-v1-your-actual-api-key-here
```

### 5. 啟動 Python 後端

```bash
cd python-backend
./start.sh
```

## 模型選擇

### 推薦配置

#### 預算優先（每月 ~$5-10）
```python
SWARM_MODELS = [
    "openai/gpt-4o-mini",              # $0.15/1M tokens
    "google/gemini-2.0-flash-exp"      # $0.075/1M tokens (實驗性)
]
```

#### 平衡配置（每月 ~$20-30）
```python
SWARM_MODELS = [
    "openai/gpt-4o-mini",              # $0.15/1M tokens
    "anthropic/claude-3.5-haiku",      # $0.80/1M tokens
    "google/gemini-2.0-flash-exp"      # $0.075/1M tokens
]
```

#### 高性能配置（每月 ~$50-100）
```python
SWARM_MODELS = [
    "openai/gpt-4o",                   # $2.50/1M tokens
    "anthropic/claude-3.5-sonnet",     # $3.00/1M tokens
    "google/gemini-pro-1.5"            # $1.25/1M tokens
]
```

### 完整模型列表

訪問 [OpenRouter Models](https://openrouter.ai/models) 查看所有可用模型和實時定價。

熱門模型：
- `openai/gpt-4o-mini` - 快速、便宜、高質量
- `anthropic/claude-3.5-haiku` - 平衡性能和成本
- `google/gemini-2.0-flash-exp` - 實驗性、超快、超便宜
- `meta-llama/llama-3.1-70b-instruct` - 開源、強大
- `mistralai/mistral-large` - 歐洲模型、多語言支援

## 成本估算

### 典型使用場景

假設每次 AI 預測使用 ~500 tokens（輸入 + 輸出）：

#### 預算配置（GPT-4o Mini + Gemini Flash）
- 每次預測：~$0.0001
- 每天 100 次預測：~$0.01
- **每月成本：~$3**

#### 平衡配置（GPT-4o Mini + Claude Haiku + Gemini Flash）
- 每次預測：~$0.0003
- 每天 100 次預測：~$0.03
- **每月成本：~$9**

#### 高性能配置（GPT-4o + Claude Sonnet + Gemini Pro）
- 每次預測：~$0.002
- 每天 100 次預測：~$0.20
- **每月成本：~$60**

### 節省成本的技巧

1. **使用更便宜的模型**：
   - Gemini Flash 比 GPT-4o 便宜 30 倍
   - 對於簡單任務，便宜的模型也能表現很好

2. **減少分析頻率**：
   ```python
   REANALYSIS_HOURS = 24  # 從 8 小時改為 24 小時
   ```

3. **限制 token 數量**：
   ```python
   AI_MAX_TOKENS = 300  # 減少最大輸出長度
   ```

4. **只在必要時使用 Swarm 模式**：
   ```python
   USE_SWARM_MODE = False  # 只使用單一模型
   SINGLE_MODEL = "openai/gpt-4o-mini"
   ```

5. **設置每日預算**：
   - 在 OpenRouter Dashboard 設置每日支出限制

## 監控使用情況

### OpenRouter Dashboard

訪問 [Activity 頁面](https://openrouter.ai/activity) 查看：
- 實時 API 調用
- 每個模型的使用量
- 成本明細
- 剩餘餘額

### 設置警報

1. 前往 [Settings](https://openrouter.ai/settings)
2. 設置 "Low Balance Alert"
3. 當餘額低於閾值時收到郵件通知

## 故障排除

### API Key 無效

**錯誤**：`401 Unauthorized`

**解決方案**：
1. 確認 API Key 格式正確（`sk-or-v1-...`）
2. 檢查 Key 是否已啟用
3. 重新生成新的 Key

### 餘額不足

**錯誤**：`402 Payment Required`

**解決方案**：
1. 訪問 [Credits 頁面](https://openrouter.ai/credits)
2. 充值餘額
3. 等待幾分鐘後重試

### 模型不可用

**錯誤**：`503 Service Unavailable`

**解決方案**：
1. 查看 [OpenRouter 狀態頁面](https://status.openrouter.ai/)
2. 嘗試使用其他模型
3. 等待幾分鐘後重試

### 速率限制

**錯誤**：`429 Too Many Requests`

**解決方案**：
1. 減少請求頻率
2. 添加重試邏輯
3. 考慮升級到更高的速率限制

## 進階配置

### 自定義模型參數

在 `model_factory.py` 中，您可以自定義每個請求的參數：

```python
payload = {
    "model": model,
    "messages": [...],
    "temperature": 0.7,        # 創造性（0-1）
    "max_tokens": 500,         # 最大輸出長度
    "top_p": 0.9,              # 核採樣
    "frequency_penalty": 0.0,  # 頻率懲罰
    "presence_penalty": 0.0,   # 存在懲罰
}
```

### 添加自定義模型

在 `config.py` 中添加任何 OpenRouter 支援的模型：

```python
SWARM_MODELS = [
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-haiku",
    "meta-llama/llama-3.1-405b-instruct",  # 新增
    "mistralai/mistral-large",              # 新增
]
```

### 模型回退策略

如果主要模型失敗，自動切換到備用模型：

```python
# 在 model_factory.py 中
FALLBACK_MODELS = [
    "openai/gpt-4o-mini",
    "google/gemini-2.0-flash-exp"
]
```

## 最佳實踐

### 1. 開發環境

- 使用便宜的模型進行測試
- 設置較低的每日預算
- 頻繁檢查使用情況

### 2. 生產環境

- 使用經過驗證的模型組合
- 設置合理的預算和警報
- 實施錯誤處理和重試邏輯
- 定期審查成本和性能

### 3. 安全性

- 不要將 API Key 提交到版本控制
- 使用環境變數管理 Key
- 定期輪換 API Key
- 限制 Key 的權限範圍

### 4. 性能優化

- 使用更快的模型（Gemini Flash, GPT-4o Mini）
- 減少不必要的 API 調用
- 實施緩存策略
- 批量處理請求

## 相關資源

- [OpenRouter 官網](https://openrouter.ai/)
- [OpenRouter 文檔](https://openrouter.ai/docs)
- [模型列表和定價](https://openrouter.ai/models)
- [API 參考](https://openrouter.ai/docs/api-reference)
- [Discord 社群](https://discord.gg/openrouter)

## 支持

如有問題：
1. 查看 [OpenRouter 文檔](https://openrouter.ai/docs)
2. 訪問 [Discord 社群](https://discord.gg/openrouter)
3. 聯繫 OpenRouter 支持團隊

---

**最後更新**：2025-12-09
