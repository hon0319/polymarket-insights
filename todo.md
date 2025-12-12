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

## Phase 2: 地址詳情頁面、完善可疑度算法、實時警報功能（2024-12-09）

### 地址詳情頁面 API
- [x] 在 server/db.ts 添加地址詳情相關的查詢函數
- [x] 在 server/routers.ts 添加 addresses.getTradeHistory API
- [x] 在 server/routers.ts 添加 addresses.getMarketPerformance API
- [x] 在 server/routers.ts 添加 addresses.getWinRateTrend API
- [x] 在 server/routers.ts 添加 addresses.getCategoryFocus API
- [x] 使用模擬數據快速驗證 API 功能
- [ ] 編寫 API 單元測試（待後續完善）

### 地址詳情頁面前端
- [x] 創建 AddressDetail.tsx 頁面組件
- [x] 實作地址基本資訊卡片（地址、可疑度、勝率、交易統計）
- [x] 實作交易歷史時間線組件
- [x] 實作市場表現分析表格（按類別）
- [x] 實作勝率趨勢圖表（使用 Recharts LineChart）
- [x] 實作市場專注度分析圖表（使用 Recharts PieChart）
- [x] 添加路由配置到 App.tsx
- [x] 測試從排行榜點擊跳轉到詳情頁（成功）

### 完善可疑度算法
- [ ] 實作早期交易檢測算法（detect_early_trades）
- [ ] 實作時機精準度分析（calculate_timing_precision）
- [ ] 更新 calculate_suspicion_score 方法（整合所有維度）
- [ ] 實作 calculate_early_trading_score 方法（25 分）
- [ ] 實作 calculate_timing_score 方法（15 分）
- [ ] 實作 calculate_selectivity_score 方法（10 分）
- [ ] 重新計算所有地址的可疑度分數
- [ ] 驗證新算法的準確性

### 警報訂閱系統
- [ ] 設計 address_subscriptions 表（用戶訂閱地址）
- [ ] 設計 address_alerts 表（警報記錄）
- [ ] 執行資料庫遷移
- [ ] 實作 subscribeToAddress API
- [ ] 實作 unsubscribeFromAddress API
- [ ] 實作 getMySubscriptions API
- [ ] 實作 getAddressAlerts API

### 警報觸發邏輯
- [ ] 在 Python 後端添加警報檢測邏輯
- [ ] 當訂閱的地址下注時觸發警報
- [ ] 將警報記錄保存到 address_alerts 表
- [ ] 調用通知系統發送警報
- [ ] 測試警報觸發流程

### 前端訂閱管理界面
- [ ] 在地址詳情頁添加「訂閱」按鈕
- [ ] 實作訂閱狀態顯示
- [ ] 創建「我的訂閱」頁面
- [ ] 實作訂閱列表展示
- [ ] 實作取消訂閱功能
- [ ] 實作警報歷史查看

### 測試和驗證
- [ ] 測試地址詳情頁面數據展示
- [ ] 驗證可疑度分數計算準確性
- [ ] 測試警報訂閱流程
- [ ] 測試警報觸發和通知
- [ ] 端到端測試

## Phase 3: 完善可疑度算法（2024-12-09）

### 同步詳細的交易數據
- [ ] 從 Polymarket Subgraph 同步市場的歷史價格數據
- [ ] 從 Polymarket Subgraph 同步地址的詳細交易記錄（包含時間戳、價格、數量）
- [ ] 將交易數據保存到 address_trades 表
- [ ] 計算並保存市場的價格變動歷史

### 價格變動檢測算法
- [ ] 實作 detect_price_movements 方法（檢測市場價格的大幅變動 >20%）
- [ ] 計算每個市場的價格變動時間點
- [ ] 將價格變動數據保存到 market_anomalies 表

### 早期交易檢測算法
- [ ] 實作 detect_early_trades 方法
- [ ] 識別在價格大幅變動前 24-72 小時就下注的交易
- [ ] 計算每個地址的早期交易比例
- [ ] 實作 calculate_early_trading_score 方法（最高 25 分）

### 時機精準度分析
- [ ] 實作 calculate_timing_precision 方法
- [ ] 分析交易者的平均持倉時間
- [ ] 計算交易者在最佳時機進出市場的頻率
- [ ] 實作 calculate_timing_score 方法（最高 15 分）

### 選擇性參與分析
- [ ] 實作 calculate_selectivity 方法
- [ ] 計算交易者的市場參與率（實際參與 / 可參與市場）
- [ ] 分析交易者是否只參與特定類型的市場
- [ ] 實作 calculate_selectivity_score 方法（最高 10 分）

### 更新可疑度分數計算邏輯
- [ ] 更新 calculate_suspicion_score 方法整合所有維度
- [ ] 實作動態調整機制（根據市場類型調整係數）
- [ ] 重新計算所有地址的可疑度分數
- [ ] 更新 addresses 表中的 suspicion_score 欄位

### 測試和驗證
- [ ] 測試價格變動檢測算法的準確性
- [ ] 測試早期交易檢測算法
- [ ] 驗證可疑度分數計算的合理性
- [ ] 比較新舊算法的結果差異
- [ ] 編寫單元測試

### 前端更新
- [x] 更新地址詳情頁面顯示新的可疑度分數維度
- [x] 添加可疑度分數詳細分解（各維度的得分）
- [ ] 更新排行榜頁面的可疑度分數說明

## Phase 4: 完善可疑度算法 - 真實數據同步和高級分析（2024-12-09）

### 市場歷史價格數據同步
- [x] 設計 market_price_history 表（記錄市場的歷史價格數據）
- [x] 執行資料庫遷移
- [x] 創建 price_sync_service.py 服務
- [x] 實作 sync_market_price_history 方法（從 trades 表提取價格數據）
- [x] 測試價格數據同步功能

### 詳細交易數據同步
- [x] address_trades 表已存在
- [ ] 從 Polymarket Subgraph 同步詳細交易記錄（需要大量時間）
- [ ] 測試交易數據同步功能

### 價格變動檢測算法
- [x] 創建 price_movement_detector.py 服務
- [x] 實作 detect_price_movements 方法
- [x] 實作算法檢測市場價格的大幅變動（>20%）
- [x] 計算價格變動的時間點和幅度
- [x] 將價格變動數據保存到 market_anomalies 表
- [x] 測試價格變動檢測功能

### 早期交易檢測算法
- [x] 更新 address_analyzer.py 中的 _calculate_early_trading_score 方法
- [x] 嘗試使用 address_trades 表數據（但發現數據不足）
- [ ] 從 Polymarket Subgraph 同步詳細交易記錄（需要大量時間）
- [x] 保留基於統計數據的算法版本

### 時機精準度分析算法
- [x] 更新 address_analyzer.py 中的 _calculate_timing_score 方法
- [x] 嘗試使用 address_trades 表數據（但發現數據不足）
- [x] 保留基於統計數據的算法版本

### 選擇性參與分析算法
- [x] 更新 address_analyzer.py 中的 _calculate_selectivity_score 方法
- [x] 嘗試使用 address_trades 表數據（但發現數據不足）
- [x] 保留基於統計數據的算法版本

### 更新可疑度分數計算邏輯
- [x] calculate_suspicion_score 方法已整合所有維度
- [x] 使用基於統計數據的算法（勝率、交易量、交易次數）
- [ ] 等待同步詳細交易記錄後升級算法

### 測試和驗證
- [x] 測試價格同步服務
- [x] 測試價格變動檢測器
- [x] 測試更新後的算法（但發現數據不足）
- [ ] 等待同步詳細交易記錄後再測試

### 前端更新
- [x] API 已經使用真實的算法（基於統計數據）
- [x] 前端顯示可疑度分數分解卡片
- [ ] 等待同步詳細交易記錄後升級


## Phase 5: 警報訂閱系統實作（2024-12-09）

### 資料庫設計
- [x] 檢查現有的 subscriptions 和 alerts 表結構
- [x] 創建 alert_subscriptions 表（用戶訂閱記錄）
- [x] 創建 alert_notifications 表（警報通知記錄）
- [x] 執行資料庫遷移

### 後端 API 開發
- [x] 實作訂閱管理 API（創建、查看、更新、刪u9664訂閱）
- [x] 實作警報類型配置 API
- [x] 實作通知歷史查詢 API
- [x] 實作通知標記為已讀 ### 警報檢測邏輯
- [x] 實作高可疑度地址交易檢測
- [x] 實作大額交易檢測
- [x] 實作價格異常檢測
- [ ] 實作定期掃描任務（每 5-10 分鐘）
- [x] 實作通知去u91cd邏輯（避免重u8907通知）### 通知發送系統
- [x] 實作應用內通知功能
- [ ] 整合 Manus 內建通知 API（待後續完善）
- [x] 實作通知批量發送功能
- [x] 實作通知優u5148級### 前端界面開發
- [x] 設計訂閱管理頁面 UI
- [x] 實作訂閱列表組件
- [x] 實作創建訂閱表單
- [x] 實作編輯訂閱對話框
- [x] 實作通知中心組件
- [x] 在地址詳情頁添加「訂閱此地址」按鈕
- [ ] 在市場詳情頁添加「訂閱此市場」按鈕
### 測試和驗證
- [x] 測試訂閱創建和管理功能
- [x] 測試警報檢測邏輯
- [x] 測試通知發送功能
- [x] 測試通知去u91cd邏輯
- [ ] 編寫單元測試

### 文檔和交付
- [ ] 編寫警報系統使用說明
- [ ] 更新 API 文檔
- [ ] 保存 checkpoint


## Phase 6: 地址比較頁面開發（2024-12-10）

### 功能設計
- [x] 設計地址比較頁面的 UI/UX
- [x] 定義比較指標和評分算法
- [x] 設計並排對比布局

### 後端 API 開發
- [x] 實作 addresses.compare API（批量獲取多個地址的詳細數據）
- [x] 實作 addresses.search API（搜索地址）
- [x] 實作綜合評分計算邏輯
- [x] 優化查詢性能（一次查詢獲取所有需要的數據）

### 前端組件開發
- [x] 創建 AddressCompare.tsx 頁面
- [x] 實作地址搜索和選擇器組件
- [x] 實作並排對比卡片組件
- [x] 實作綜合評分展示組件
- [x] 實作雷達圖對比組件（多維度表現）
- [x] 實作詳細指標對比表格
- [x] 添加「推薦最佳」標記

### 路由和導航
- [x] 在 App.tsx 添加 /compare 路由
- [ ] 在地址排行榜頁面添加「比較地址」入口
- [ ] 在地址詳情頁添加「添加到比較」按鈕

### 測試和優化
- [x] 測試 2-4 個地址的比較功能
- [x] 測試搜索和選擇功能
- [x] 測試雷達圖和表格顯示
- [x] 測試綜合評分算法的合理性

### 文檔和交付
- [x] 編寫地址比較功能測試驗證文檔
- [ ] 保存 checkpoint


## Phase 7: 外部部署平台配置（2024-12-10）

### Vercel 前端部署
- [ ] 創建 vercel.json 配置文件
- [ ] 配置構建命令和輸出目錄
- [ ] 配置環境變量模板
- [ ] 配置 API 路由代理

### Railway 後端部署
- [ ] 創建 railway.json 配置文件
- [ ] 配置 Node.js 後端服務
- [ ] 配置 Python 後端服務
- [ ] 配置數據庫連接

### 環境變量配置
- [ ] 準備 .env.example 文件
- [ ] 列出所有必需的環境變量
- [ ] 提供環境變量配置說明

### 部署文檔
- [ ] 撰寫 DEPLOYMENT.md 部署指南
- [ ] 創建部署檢查清單
- [ ] 提供故障排除指南

### 測試和驗證
- [ ] 測試配置文件的正確性
- [ ] 驗證環境變量配置
- [ ] 保存 checkpoint


## Phase 8: 前端網頁優化（2024-12-11）

### 視覺設計優化
- [ ] 優化配色方案（統一品牌色、強調色、中性色）
- [ ] 改進深色主題對比度和可讀性
- [ ] 優化卡片和組件的視覺層次（陰影、邊框、間距）
- [ ] 統一字體大小和行高
- [ ] 添加微動畫和過渡效果
- [ ] 優化按鈕和交互元素的視覺反饋
- [ ] 改進圖表的配色和樣式
- [ ] 優化表格的視覺設計

### 用戶體驗優化
- [ ] 添加加載骨架屏（Skeleton）到所有主要頁面
- [ ] 改進空狀態提示（Empty State）
- [ ] 優化錯誤處理和錯誤提示
- [ ] 添加頁面過渡動畫
- [ ] 改進 Toast 通知的樣式和位置
- [ ] 優化表單驗證和錯誤提示
- [ ] 添加確認對話框（刪除操作等）
- [ ] 改進加載指示器的視覺效果

### 功能增強
- [ ] 在導航欄添加通知圖標（顯示未讀數量徽章）
- [ ] 實作通知下拉面板（快速查看最新通知）
- [ ] 添加全局搜索功能（搜索地址和市場）
- [ ] 實作麵包屑導航
- [ ] 添加「返回頂部」按鈕
- [ ] 優化移動端導航菜單
- [ ] 添加鍵盤快捷鍵支持

### 測試和驗證
- [ ] 測試所有頁面的視覺效果
- [ ] 驗證響應式設計（移動端、平板端）
- [ ] 測試加載狀態和錯誤狀態
- [ ] 驗證通知功能正常工作
- [ ] 測試全局搜索功能
- [ ] 檢查瀏覽器兼容性
- [ ] 性能測試（Lighthouse）


## Phase 8: 前端優化（2024-12-12）

### 視覺設計優化
- [x] 優化全局 CSS 配色方案
- [x] 改進顏色對比度和可讀性
- [x] 添加霓虹光效和漸變效果
- [x] 優化卡片背景和邊框

### 全局導航欄
- [x] 創建 Navbar.tsx 組件
- [x] 添加品牌 Logo 和導航鏈接
- [x] 實作通知鈴鐺圖標
- [x] 顯示未讀通知數量徽章
- [x] 實作通知下拉菜單
- [x] 添加用戶頭像圖標
- [x] 整合到 App.tsx
- [x] 測試通知功能

### 組件視覺改進
- [ ] 優化卡片陰影和邊框效果
- [ ] 改進表格和列表的視覺層次
- [ ] 統一按鈕和輸入框樣式
- [ ] 優化圖表配色方案

### 加載狀態和骨架屏
- [ ] 添加數據加載骨架屏
- [ ] 改進空狀態提示
- [ ] 優化錯誤提示樣式
- [ ] 添加加載動畫

### 動畫和過渡效果
- [ ] 添加頁面切換動畫
- [ ] 優化懸停和點擊反饋
- [ ] 改進數據更新的過渡效果
- [ ] 添加微交互動畫

### 響應式設計
- [ ] 優化移動端佈局
- [ ] 改進平板電腦適配
- [ ] 測試不同屏幕尺寸

### 測試和交付
- [ ] 跨頁面測試導航欄
- [ ] 測試通知功能
- [ ] 保存 checkpoint
