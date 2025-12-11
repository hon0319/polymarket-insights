# 環境變量配置說明

本文檔列出了部署 Bentana Insights 所需的所有環境變量。

## 🔑 必需的環境變量

### 數據庫配置
```
DATABASE_URL=mysql://user:password@host:port/database
```
- **說明**：MySQL/TiDB 數據庫連接字符串
- **獲取方式**：
  - Railway：在 Railway 項目中添加 MySQL 插件，會自動生成
  - 其他：使用您自己的 MySQL 數據庫連接字符串

### JWT Secret
```
JWT_SECRET=your-jwt-secret-key-here
```
- **說明**：用於簽名 session cookie 的密鑰
- **獲取方式**：生成一個隨機字符串（建議 32 字符以上）
- **生成命令**：`openssl rand -base64 32`

### OpenRouter API Key
```
OPENROUTER_API_KEY=your-openrouter-api-key
```
- **說明**：用於 AI 預測功能的 API 密鑰
- **獲取方式**：
  1. 訪問 https://openrouter.ai
  2. 註冊帳號並登入
  3. 在 Dashboard 創建 API Key

## 🎨 應用配置

### 應用標題和 Logo
```
VITE_APP_TITLE=Bentana Insights
VITE_APP_LOGO=/logo.svg
```
- **說明**：應用的標題和 Logo 路徑
- **默認值**：已設置為 "Bentana Insights"

### 應用 ID
```
VITE_APP_ID=your-app-id
```
- **說明**：應用的唯一標識符
- **獲取方式**：生成一個唯一的 ID（例如：UUID）

## 🌐 前端 API 配置（Vercel 部署）

### API URL
```
VITE_API_URL=https://your-railway-backend.railway.app
```
- **說明**：後端 API 的基礎 URL
- **設置時機**：在 Railway 部署後端後，將生成的 URL 填入此處
- **格式**：`https://your-project-name.railway.app`

## 🔐 OAuth 配置（可選）

如果您使用 Manus OAuth 系統，需要配置以下變量：

```
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://oauth.manus.im
OWNER_OPEN_ID=your-owner-open-id
OWNER_NAME=your-owner-name
```

**注意**：如果不使用 Manus OAuth，可以移除相關代碼或實作自己的認證系統。

## 🛠️ Built-in Forge API（可選）

如果您使用 Manus 內建服務，需要配置以下變量：

```
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=your-forge-api-key
VITE_FRONTEND_FORGE_API_KEY=your-frontend-forge-api-key
VITE_FRONTEND_FORGE_API_URL=https://forge.manus.im
```

**注意**：如果不使用 Manus 服務，可以移除相關代碼。

## 📊 Analytics（可選）

```
VITE_ANALYTICS_ENDPOINT=https://analytics.example.com
VITE_ANALYTICS_WEBSITE_ID=your-website-id
```

- **說明**：網站分析服務配置
- **可選**：如果不需要分析功能，可以不設置

## 🐍 Python 後端配置

```
PYTHON_BACKEND_URL=http://localhost:8000
```

- **說明**：Python 後端服務的 URL
- **本地開發**：`http://localhost:8000`
- **生產環境**：Railway 部署後的 URL

## 📝 配置步驟

### 1. Vercel 環境變量配置

在 Vercel 項目設置中添加以下環境變量：

1. 進入 Vercel 項目 → Settings → Environment Variables
2. 添加以下變量：
   - `VITE_APP_TITLE`
   - `VITE_APP_LOGO`
   - `VITE_APP_ID`
   - `VITE_API_URL`（Railway 後端 URL）
   - 其他可選的前端變量

### 2. Railway 環境變量配置

在 Railway 項目設置中添加以下環境變量：

1. 進入 Railway 項目 → Variables
2. 添加以下變量：
   - `DATABASE_URL`（Railway MySQL 插件會自動提供）
   - `JWT_SECRET`
   - `OPENROUTER_API_KEY`
   - 其他後端需要的變量

### 3. 驗證配置

部署後，檢查以下內容：

- ✅ 前端可以正常訪問
- ✅ API 請求成功（檢查瀏覽器 Network 面板）
- ✅ 數據庫連接正常
- ✅ AI 預測功能正常

## ⚠️ 安全注意事項

1. **永遠不要**將 `.env` 文件提交到 Git
2. **永遠不要**在前端代碼中暴露後端 API 密鑰
3. **定期輪換** JWT Secret 和 API Keys
4. **使用環境變量**管理所有敏感信息
5. **限制 API Key 權限**到最小必要範圍

## 🔍 故障排除

### 問題：前端無法連接後端

**解決方案**：
1. 檢查 `VITE_API_URL` 是否正確設置
2. 檢查 Railway 後端是否正常運行
3. 檢查 CORS 配置是否正確

### 問題：數據庫連接失敗

**解決方案**：
1. 檢查 `DATABASE_URL` 格式是否正確
2. 檢查數據庫服務是否正常運行
3. 檢查網絡連接和防火牆設置

### 問題：AI 預測功能不工作

**解決方案**：
1. 檢查 `OPENROUTER_API_KEY` 是否正確
2. 檢查 OpenRouter 帳戶餘額
3. 檢查 Python 後端日誌

## 📚 相關文檔

- [部署指南](./DEPLOYMENT.md)
- [README](./README.md)
- [Vercel 文檔](https://vercel.com/docs)
- [Railway 文檔](https://docs.railway.app)
