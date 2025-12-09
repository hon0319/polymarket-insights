# Polymarket Insights - 部署和使用指南

## 系統架構

Polymarket Insights 採用雙後端架構：

1. **Node.js 後端**（Express + tRPC）
   - 處理用戶認證和授權
   - 提供 RESTful API 和 tRPC 端點
   - 管理資料庫操作
   - 服務前端靜態資源

2. **Python 後端**（WebSocket 服務）
   - 連接 Polymarket WebSocket 獲取實時數據
   - 運行 AI 模型進行市場預測
   - 通過 WebSocket 向前端推送實時更新
   - 檢測和廣播大額交易

3. **前端**（React 19 + TypeScript）
   - 霓虹黑色主題界面
   - 實時數據可視化
   - 響應式設計

## 快速開始

### 前置要求

- Node.js 18+ 和 pnpm
- Python 3.8+
- MySQL/TiDB 資料庫
- AI API Keys（OpenAI, Anthropic, Google）

### 1. 安裝 Node.js 依賴

```bash
cd /home/ubuntu/polymarket-insights
pnpm install
```

### 2. 配置環境變數

創建 `.env` 文件（如果不存在）：

```env
# Database
DATABASE_URL=mysql://user:password@host:port/database

# Manus OAuth (已自動配置)
JWT_SECRET=auto_configured
OAUTH_SERVER_URL=auto_configured
VITE_APP_ID=auto_configured
# ... 其他 Manus 相關變數

# AI API Keys (需要手動添加)
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_API_KEY=your_google_api_key

# Python WebSocket Server
WS_SERVER_HOST=localhost
WS_SERVER_PORT=8765
VITE_WS_URL=ws://localhost:8765

# Trading Configuration
TRADE_NOTIONAL_THRESHOLD=1000
WHALE_TRADE_THRESHOLD=10000
IGNORE_PRICE_THRESHOLD=0.05
USE_SWARM_MODE=true
```

### 3. 執行資料庫遷移

```bash
pnpm db:push
```

### 4. 啟動 Node.js 開發服務器

```bash
pnpm dev
```

服務器將在 `http://localhost:3000` 啟動。

### 5. 啟動 Python 後端服務

在**新的終端窗口**中：

```bash
cd /home/ubuntu/polymarket-insights/python-backend
./start.sh
```

或手動啟動：

```bash
cd /home/ubuntu/polymarket-insights/python-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

Python 服務將在 `ws://localhost:8765` 啟動 WebSocket 服務器。

## 功能說明

### 1. 實時市場數據

- **數據源**：Polymarket WebSocket (`wss://ws-subscriptions-clob.polymarket.com/ws/market`)
- **更新頻率**：實時（毫秒級）
- **市場範圍**：所有類別（政治、經濟、科技等）
- **過濾規則**：
  - 排除加密貨幣市場
  - 排除體育賽事市場
  - 過濾小於 $1,000 的交易
  - 過濾接近結算價格的交易（0.05 或 0.95）

### 2. AI 共識預測

- **模型**：
  - GPT-4o-mini (OpenAI)
  - Claude 3.5 Haiku (Anthropic)
  - Gemini 2.0 Flash (Google)

- **預測流程**：
  1. 三個模型並行分析市場
  2. 每個模型給出 YES/NO 預測和理由
  3. 計算共識結果和信心指數
  4. 存儲到資料庫供查詢

- **觸發條件**：
  - 新市場出現
  - 定期重新分析（每 8 小時）
  - 手動請求分析

### 3. 大額交易追蹤

- **閾值**：$10,000（可配置）
- **通知方式**：
  - 實時 WebSocket 推送到前端
  - Toast 通知提示
  - 顯示在大額交易頁面
- **信息包含**：
  - 市場名稱
  - 交易方向（YES/NO）
  - 交易金額
  - 交易價格
  - 時間戳

### 4. 頁面導航

- **首頁** (`/`)：品牌展示、功能介紹、訂閱方案
- **市場列表** (`/markets`)：瀏覽所有活躍市場
- **市場詳情** (`/market/:id`)：價格走勢、交易記錄、AI 預測
- **用戶儀表板** (`/dashboard`)：個人化數據和警報管理
- **大額交易** (`/whale-trades`)：實時大額交易追蹤

## 開發工作流

### 前端開發

```bash
# 啟動開發服務器（熱重載）
pnpm dev

# 類型檢查
pnpm check

# 運行測試
pnpm test

# 格式化代碼
pnpm format
```

### 後端開發

```bash
# 修改 schema 後推送到資料庫
pnpm db:push

# 運行 API 測試
pnpm test
```

### Python 後端開發

```bash
cd python-backend
source venv/bin/activate

# 安裝新依賴後更新 requirements.txt
pip freeze > requirements.txt

# 運行服務
python main.py
```

## 生產部署

### Node.js 應用

```bash
# 構建生產版本
pnpm build

# 啟動生產服務器
pnpm start
```

### Python 後端

建議使用 **systemd** 或 **supervisor** 管理 Python 服務：

**systemd 配置示例** (`/etc/systemd/system/polymarket-python.service`):

```ini
[Unit]
Description=Polymarket Insights Python Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/polymarket-insights/python-backend
Environment="PATH=/home/ubuntu/polymarket-insights/python-backend/venv/bin"
ExecStart=/home/ubuntu/polymarket-insights/python-backend/venv/bin/python main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

啟動服務：

```bash
sudo systemctl enable polymarket-python
sudo systemctl start polymarket-python
sudo systemctl status polymarket-python
```

### 環境變數管理

生產環境建議使用：
- **Docker Secrets**
- **Kubernetes ConfigMaps/Secrets**
- **AWS Secrets Manager**
- **HashiCorp Vault**

### 反向代理配置

**Nginx 配置示例**：

```nginx
# Node.js 應用
upstream nodejs_backend {
    server localhost:3000;
}

# Python WebSocket
upstream python_websocket {
    server localhost:8765;
}

server {
    listen 80;
    server_name polymarket-insights.com;

    # Node.js 應用
    location / {
        proxy_pass http://nodejs_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Python WebSocket
    location /ws {
        proxy_pass http://python_websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

## 監控和日誌

### Node.js 日誌

開發環境日誌會輸出到控制台。生產環境建議使用：
- **PM2** 的日誌管理
- **Winston** 或 **Pino** 日誌庫
- **ELK Stack** 或 **Datadog** 集中式日誌

### Python 日誌

Python 後端使用 `termcolor` 輸出彩色日誌：
- ✅ 綠色：成功操作
- ⚠️ 黃色：警告信息
- ❌ 紅色：錯誤信息
- 🐋 黃色粗體：大額交易

生產環境建議配置 Python `logging` 模塊輸出到文件。

### 性能監控

建議監控指標：
- WebSocket 連接數
- 每秒處理的交易數
- AI 預測響應時間
- 資料庫查詢性能
- 內存和 CPU 使用率

## 故障排除

### 前端無法連接 WebSocket

1. 確認 Python 後端正在運行：
   ```bash
   ps aux | grep python
   ```

2. 檢查 WebSocket 端口是否開放：
   ```bash
   netstat -tuln | grep 8765
   ```

3. 驗證環境變數 `VITE_WS_URL` 設置正確

### 資料庫連接失敗

1. 檢查 `DATABASE_URL` 格式：
   ```
   mysql://username:password@hostname:port/database
   ```

2. 測試資料庫連接：
   ```bash
   mysql -h hostname -P port -u username -p database
   ```

3. 確認資料庫表已創建：
   ```bash
   pnpm db:push
   ```

### AI 預測不工作

1. 驗證 API Keys 有效：
   ```bash
   echo $OPENAI_API_KEY
   echo $ANTHROPIC_API_KEY
   echo $GOOGLE_API_KEY
   ```

2. 檢查 API 配額和限制

3. 查看 Python 後端日誌中的錯誤信息

### Polymarket WebSocket 斷線

- 自動重連機制會在 5 秒後嘗試重新連接
- 檢查網絡連接
- 確認 Polymarket API 服務正常

## 安全建議

1. **環境變數**：
   - 永遠不要提交 `.env` 文件到版本控制
   - 使用 `.env.example` 作為模板

2. **API Keys**：
   - 定期輪換 API Keys
   - 設置 API 使用限額
   - 監控異常使用

3. **資料庫**：
   - 使用強密碼
   - 啟用 SSL 連接
   - 定期備份

4. **WebSocket**：
   - 在生產環境使用 WSS（加密）
   - 實施速率限制
   - 驗證客戶端身份

## 擴展建議

### 水平擴展

- 使用 **Redis** 作為 WebSocket 消息隊列
- 部署多個 Python 後端實例
- 使用負載均衡器分發連接

### 數據持久化

- 定期備份資料庫
- 實施數據歸檔策略
- 考慮使用時序資料庫（如 InfluxDB）存儲歷史價格數據

### 功能增強

- 添加更多 AI 模型提供商
- 實施用戶自定義警報規則
- 開發移動應用（React Native）
- 添加社交分享功能

## 相關資源

- [Polymarket API 文檔](https://docs.polymarket.com/)
- [moon-dev-ai-agents GitHub](https://github.com/moondevonyt/moon-dev-ai-agents)
- [Manus 平台文檔](https://docs.manus.im/)
- [tRPC 文檔](https://trpc.io/)
- [React 19 文檔](https://react.dev/)

## 支持

如有問題或建議，請：
1. 查看本文檔的故障排除部分
2. 檢查 GitHub Issues
3. 聯繫開發團隊

---

**最後更新**：2025-12-09
**版本**：1.0.0
