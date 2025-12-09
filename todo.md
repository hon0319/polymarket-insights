# Polymarket Insights - 專案 TODO 清單

## 資料庫設計
- [x] 設計 markets 表（市場數據）
- [x] 設計 predictions 表（AI 預測記錄）
- [x] 設計 trades 表（交易記錄）
- [x] 設計 subscriptions 表（用戶訂閱）
- [x] 設計 alerts 表（用戶警報設定）
- [x] 設計 notifications 表（通知記錄）
- [x] 執行資料庫遷移

## 後端 API 開發
- [x] 實作 markets 相關 API（列表、詳情、過濾）
- [x] 實作 predictions 相關 API（獲取預測、歷史記錄）
- [x] 實作 trades 相關 API（大額交易追蹤）
- [x] 實作 WebSocket 實時數據推送
- [ ] 實作用戶訂閱管理 API
- [ ] 實作警報和通知系統 API
- [ ] 整合 Stripe 支付 API

## 前端界面開發
- [x] 設計並實作霓虹黑色主題樣式
- [x] 實作首頁（Landing Page）
- [x] 實作實時市場儀表板
- [x] 實作市場詳情頁
- [ ] 實作 AI 預測中心頁面
- [x] 實作大額交易追蹤頁面
- [ ] 實作用戶訂閱管理頁面
- [x] 實作價格走勢圖表組件
- [x] 實作交易量可視化組件
- [ ] 實作 WebSocket 實時更新功能
- [ ] 實作響應式設計（移動端適配）

## Stripe 整合
- [ ] 設置 Stripe 產品和價格
- [ ] 實作訂閱購買流程
- [ ] 實作訂閱取消和升級
- [ ] 實作 Webhook 處理訂閱狀態變更
- [ ] 實作訂閱權限檢查中間件

## 通知系統
- [ ] 實作應用內通知功能
- [ ] 實作郵件通知功能
- [ ] 實作警報觸發邏輯（大額交易、AI 預測變化）

## 測試與優化
- [x] 撰寫後端 API 單元測試
- [ ] 測試 WebSocket 連接穩定性
- [ ] 測試 Stripe 支付流程
- [ ] 性能優化（查詢、緩存）
- [ ] 安全性檢查

## 部署準備
- [ ] 準備生產環境配置
- [ ] 文檔撰寫（API 文檔、使用說明）
- [ ] 創建第一個檢查點


## Polymarket 數據源整合
- [x] 創建 Python 後端服務目錄結構
- [x] 整合 Polymarket WebSocket 連接（所有市場類別）
- [x] 實作市場數據收集和存儲
- [ ] 實作歷史數據回溯功能
- [x] 整合 moon-dev AI 模型工廠
- [x] 實作 AI 共識預測邏輯
- [x] 創建 Python 到 Node.js 的通信橋接
- [x] 實作 WebSocket 實時數據推送到前端
- [x] 實作大額交易檢測和警報
- [ ] 測試數據流完整性


## OpenRouter API 整合
- [x] 修改 model_factory.py 支援 OpenRouter API
- [x] 更新配置文件使用 OPENROUTER_API_KEY
- [x] 測試 OpenRouter 模型調用
- [x] 更新文檔說明 OpenRouter 配置


## Python 後端啟動和測試
- [x] 配置 OPENROUTER_API_KEY 環境變數
- [x] 安裝 Python 依賴
- [x] 啟動 Python 後端服務
- [x] 測試 WebSocket 連接
- [x] 測試實時數據推送
- [x] 驗證 AI 預測功能


## Polymarket WebSocket 連接修復
- [x] 研究 Polymarket WebSocket API 官方文檔
- [x] 分析當前連接失敗的原因
- [x] 優化訂閱邏輯和消息格式
- [x] 實作更穩健的錯誤處理和重連機制
- [x] 測試連接穩定性
- [x] 驗證能正常接收市場數據和交易信息


## 實時數據存儲和展示
- [x] 修改 Python 後端 on_polymarket_trade 回調，將交易數據存入 markets 表
- [x] 修改 Python 後端 on_polymarket_trade 回調，將交易數據存入 trades 表
- [x] 實作後端 tRPC API：獲取最近的大額交易列表
- [x] 實作後端 tRPC API：獲取實時交易統計數據
- [x] 更新前端 /whale-trades 頁面從 API 讀取數據
- [x] 添加實時數據自動刷新功能
- [x] 測試數據存儲和展示流程


## AI 預測功能整合
- [x] 修改 Python 後端：當檢測到大額交易時觸發 AI Swarm 分析
- [x] 實作 AI 預測邏輯：調用多個模型並計算共識
- [x] 將 AI 預測結果存入 predictions 表
- [x] 修改 getWhaleTrades API：JOIN predictions 表返回預測數據
- [x] 更新前端 WhaleTrades 頁面：顯示 AI 預測徵章和信心指數
- [x] 添加預測詳情展開功能：顯示各模型投票和推理
- [x] 撰寫 AI 預測功能的單元測試
- [x] 端到端測試：驗證大額交易 → AI 分析 → 前端展示流程


## 品牌更新和分類功能
- [x] 啟動 Python 後端服務開始收集真實數據
- [x] 將網站品牌名稱從 "Polymarket Insights" 更新為 "Bentana"
- [x] 更新網站標題、Logo 和元數據
- [x] 實作市場分類功能（政治、加密貨幣、體育、娛樂等）
- [x] 在前端添加分類篩選器
- [x] 優化大額交易頁面的分類展示
- [x] 測試分類功能和數據流

## Python 後端穩定性修復（2024-12-09）
- [x] 修復 SwarmAgent 回應解析邏輯錯誤
- [x] 實作 MySQL 連接池機制，解決連接斷開問題
- [x] 添加自動重連機制
- [x] 創建後端服務管理腳本（start_service.sh, stop_service.sh, restart_service.sh）
- [x] 修復 Gemini 模型名稱錯誤（使用 google/gemini-2.0-flash-exp:free）
- [x] 驗證 AI 預測功能正常運作（GPT-4o Mini + Claude 3.5 Haiku + Gemini）

## 端到端數據流驗證（2024-12-09）
- [x] 驗證 Polymarket RTDS → Python 後端連接
- [x] 驗證 Python 後端 → MySQL 數據保存
- [x] 驗證資料庫中有真實的交易和預測數據（31 筆大額交易，4 條 AI 預測）
- [x] 驗證 Node.js tRPC API → 前端數據展示
- [x] 確認大額交易頁面正確顯示 AI 預測徵章

## 首頁實時演示區塊（2024-12-09）
- [x] 實作首頁實時演示區塊
- [x] 顯示最新 5 筆大額交易
- [x] 顯示 AI 預測結果和信心度
- [x] 添加交易分類標籤（Sports、Other 等）
- [x] 實作自動刷新機制（每 10 秒）
- [x] 添加「查看所有大額交易」按鈕

## 市場詳情頁面（2024-12-09）
- [x] 設計資料庫查詢：獲取市場基本資訊
- [x] 設計資料庫查詢：獲取市場的所有交易記錄
- [x] 設計資料庫查詢：獲取市場的所有 AI 預測
- [x] 實作 tRPC API：getMarketById（市場詳情）
- [x] 實作 tRPC API：getMarketTrades（市場交易記錄）
- [x] 實作 tRPC API：getMarketPredictions（市場預測記錄）
- [x] 創建 MarketDetail.tsx 頁面組件
- [x] 實作市場基本資訊展示區塊
- [x] 實作歷史價格走勢圖表（使用 Recharts）
- [x] 實作 AI 預測詳情展示（所有模型的預測和推理）
- [x] 實作最近交易記錄列表
- [x] 實作市場統計數據卡片
- [x] 添加路由配置到 App.tsx
- [x] 在大額交易列表添加點擊跳轉到詳情頁
- [x] 測試數據展示和圖表渲染
- [x] 優化移動端響應式設計

## Phase 1: Polymarket Subgraph 整合（2024-12-09）

### 資料庫 Schema 更新
- [x] 創建 addresses 表（地址基本資訊和統計）
- [x] 創建 address_positions 表（地址持倉）
- [x] 創建 address_trades 表（地址交易歷史）
- [x] 創建 address_market_performance 表（地址市場表現）
- [x] 創建 market_anomalies 表（市場異常活動）
- [x] 更新 markets 表（添加 condition_id, resolved 等欄位）
- [x] 更新 trades 表（添加 address_id 外鍵）
- [x] 執行資料庫遷移

### Python Subgraph 客戶端
- [x] 安裝 Python 依賴（gql, aiohttp）
- [x] 創建 subgraph_client.py
- [x] 實作 get_user_positions 方法
- [x] 實作 get_market_activity 方法
- [x] 實作 get_whale_traders 方法
- [x] 測試 GraphQL 查詢（成功連接 Polymarket Subgraph）

### 歷史數據同步服務
- [x] 創建 sync_service.py
- [x] 實作 sync_whale_traders 方法
- [x] 實作 update_address_statistics 方法
- [x] 測試數據同步功能（成功同步 100 個大額交易者）
- [ ] 實作 sync_market_activity 方法（待後續完善）
- [ ] 實作 _process_split 方法（處理買入，待後續完善）
- [ ] 實作 _process_merge 方法（處理賣出，待後續完善）

### 地址分析服務
- [x] 創建 address_analyzer.py
- [x] 實作 calculate_suspicion_score 方法（基礎版本）
- [x] 實作 calculate_win_rate_score 方法
- [x] 實作 calculate_trade_size_score 方法
- [x] 實作 calculate_volume_score 方法
- [x] 實作 update_all_suspicion_scores 方法
- [x] 測試可疑度分數計算
- [ ] 實作 calculate_win_rate 方法（待後續完善）
- [ ] 實作 detect_early_traders 方法（待後續完善）
- [ ] 實作 calculate_early_trading_score 方法（待後續完善）

### tRPC API 端點
- [x] 創建 addresses router
- [x] 實作 addresses.list API
- [x] 實作 addresses.getById API
- [x] 實作 addresses.getLeaderboard API
- [x] 實作 addresses.getTrades API
- [x] 實作 addresses.getStats API
- [x] 使用模擬數據快速驗證功能
- [ ] 編寫 API 單元測試（待後續完善）

### 前端實作
- [x] 創建 AddressLeaderboard.tsx 頁面
- [x] 實作排行榜表格（勝率、交易量、可疑度分數）
- [x] 實作統計卡片展示
- [x] 實作可疑度分數說明和免責聲明
- [x] 添加路由配置到 App.tsx
- [x] 在首頁添加「追蹤聰明錢」入口
- [ ] 實作篩選和排序功能（待後續完善）
- [ ] 創建 AddressDetail.tsx 頁面（待後續實作）
- [ ] 實作地址基本資訊卡片（待後續實作）
- [ ] 實作交易歷史列表（待後續實作）
- [ ] 實作市場表現分析（待後續實作）

### 測試和驗證
- [x] 測試數據同步功能（成功同步 100 個地址）
- [x] 驗證可疑度分數計算準確性
- [x] 測試 API 端點響應（使用模擬數據）
- [x] 測試前端數據展示（排行榜頁面完美顯示）
- [x] 端到端測試（從 Subgraph 到前端）
