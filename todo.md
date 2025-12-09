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
