"""
Polymarket Insights - Python Backend Service
實時數據收集、AI 分析和 WebSocket 服務器
"""
import asyncio
import json
import mysql.connector
from datetime import datetime
from termcolor import cprint, colored
import websockets
import traceback

from config import *
from agents.polymarket_agent import PolymarketAgent


class PolymarketBackendService:
    """Python 後端服務主類"""
    
    def __init__(self):
        self.db_connection = None
        self.agent = None
        self.ws_server = None
        self.swarm_agent = None
        self.prediction_cache = {}  # 緩存最近的預測，避免重複分析
        
        cprint("=" * 60, "cyan")
        cprint("🌙 Polymarket Insights - Python Backend Service", "cyan", attrs=['bold'])
        cprint("=" * 60, "cyan")
    
    def connect_database(self):
        """連接到資料庫（使用連接池）"""
        try:
            # Parse DATABASE_URL
            # Format: mysql://user:password@host:port/database
            if not DATABASE_URL:
                raise ValueError("DATABASE_URL not set in environment")
            
            # Simple parsing
            url_parts = DATABASE_URL.replace("mysql://", "").split("@")
            user_pass = url_parts[0].split(":")
            host_db = url_parts[1].split("/")
            host_port = host_db[0].split(":")
            
            # 使用連接池代替單一連接
            from mysql.connector import pooling
            
            self.db_pool = pooling.MySQLConnectionPool(
                pool_name="bentana_pool",
                pool_size=5,  # 連接池大小
                pool_reset_session=True,
                host=host_port[0],
                port=int(host_port[1]) if len(host_port) > 1 else 3306,
                user=user_pass[0],
                password=user_pass[1],
                database=host_db[1].split("?")[0],
                autocommit=True,
                # 連接超時設定
                connect_timeout=10,
                # 保持連接活躍
                use_pure=False  # 使用 C 擴展以獲得更好的性能
            )
            
            # 測試連接
            conn = self.db_pool.get_connection()
            conn.close()
            
            cprint("✅ Database connection pool created successfully", "green")
            return True
            
        except Exception as e:
            cprint(f"❌ Database connection failed: {e}", "red")
            traceback.print_exc()
            return False
    
    def get_db_connection(self):
        """從連接池獲取連接（自動重連）"""
        try:
            return self.db_pool.get_connection()
        except Exception as e:
            cprint(f"⚠️ Failed to get connection from pool: {e}", "yellow")
            # 嘗試重新連接
            if self.connect_database():
                return self.db_pool.get_connection()
            raise
    
    def initialize_agent(self):
        """初始化 Polymarket Agent"""
        try:
            # 創建 PolymarketAgent 實例
            self.agent = PolymarketAgent(
                on_message=self.on_polymarket_message,
                on_trade=self.on_polymarket_trade,
                on_error=self.on_polymarket_error
            )
            
            # 添加訂閱
            self.agent.subscribe_to_trades()
            self.agent.subscribe_to_comments()
            
            cprint("🤖 Polymarket Agent initialized", "green")
            cprint(f"   Subscriptions: {len(self.agent.subscriptions)}", "cyan")
            
            # 初始化 SwarmAgent
            self.initialize_swarm_agent()
            
            return True
        except Exception as e:
            cprint(f"❌ Agent initialization failed: {e}", "red")
            traceback.print_exc()
            return False
    
    def save_market_to_db(self, market_data: dict):
        """保存市場數據到資料庫"""
        conn = None
        cursor = None
        try:
            if not hasattr(self, 'db_pool'):
                return
            
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            # 提取市場信息
            condition_id = market_data.get("conditionId", "")
            title = market_data.get("title", "")[:500]  # 限制長度
            slug = market_data.get("slug", "")[:200]
            
            # 計算當前價格（cents）
            price = market_data.get("price", 0)
            current_price = int(price * 100) if price else 50  # 預設 50 cents
            
            # 自動分類
            from utils.categorizer import categorize_market
            category = categorize_market(title)
            
            # 插入或更新市場數據
            query = """
                INSERT INTO markets (
                    conditionId, title, category, currentPrice, lastTradeTimestamp, isActive
                ) VALUES (%s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    title = VALUES(title),
                    category = VALUES(category),
                    currentPrice = VALUES(currentPrice),
                    lastTradeTimestamp = VALUES(lastTradeTimestamp),
                    updatedAt = CURRENT_TIMESTAMP
            """
            
            values = (
                condition_id,
                title,
                category,
                current_price,
                datetime.now(),
                True
            )
            
            cursor.execute(query, values)
            
            # cprint(f"💾 Market saved: {title[:50]}...", "green")
            
        except Exception as e:
            cprint(f"❌ Error saving market: {e}", "red")
            traceback.print_exc()
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
    
    def save_trade_to_db(self, trade_data: dict, market_data: dict):
        """保存交易數據到資料庫"""
        conn = None
        cursor = None
        try:
            if not hasattr(self, 'db_pool'):
                return
            
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            # 首先獲取 market ID
            condition_id = market_data.get("conditionId", "")
            cursor.execute("SELECT id FROM markets WHERE conditionId = %s", (condition_id,))
            result = cursor.fetchone()
            
            if not result:
                cursor.close()
                return
            
            market_id = result[0]
            
            # 提取交易信息
            trade_id = trade_data.get("transactionHash", f"trade_{int(datetime.now().timestamp())}")
            raw_side = trade_data.get("side", "BUY").upper()
            # 將 BUY/SELL 轉換為 YES/NO，或直接使用 outcome 欄位
            if raw_side in ["BUY", "SELL"]:
                # 如果有 outcome 欄位，優先使用
                side = trade_data.get("outcome", "YES" if raw_side == "BUY" else "NO").upper()
            else:
                side = raw_side
            # 確保 side 只能是 YES 或 NO
            if side not in ["YES", "NO"]:
                side = "YES"  # 預設值
            
            price = trade_data.get("price", 0)
            size = trade_data.get("size", 0)
            amount = price * size
            
            # 判斷是否為大額交易（超過 $100）
            is_whale = amount >= 100
            
            # 插入交易數據
            query = """
                INSERT INTO trades (
                    marketId, tradeId, side, price, amount, isWhale, timestamp
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    side = VALUES(side),
                    price = VALUES(price),
                    amount = VALUES(amount)
            """
            
            values = (
                market_id,
                trade_id[:255],  # 限制長度
                side,
                int(price * 100),  # 轉為 cents
                int(amount * 100),  # 轉為 cents
                is_whale,
                datetime.now()
            )
            
            cursor.execute(query, values)
            
            if is_whale:
                cprint(f"🐋 Whale trade saved: ${amount:,.2f} on {market_data.get('title', 'Unknown')[:50]}", "yellow")
                # 觸發 AI 預測
                self.trigger_ai_prediction(market_id, market_data)
            
        except Exception as e:
            cprint(f"❌ Error saving trade: {e}", "red")
            traceback.print_exc()
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
    
    def on_polymarket_message(self, data: dict):
        """處理 Polymarket 消息"""
        topic = data.get("topic", "unknown")
        msg_type = data.get("type", "unknown")
        
        # 廣播到前端客戶端（使用線程安全的方式）
        if hasattr(self, '_event_loop') and self._event_loop:
            asyncio.run_coroutine_threadsafe(
                self.broadcast_to_clients({
                    "type": "polymarket_message",
                    "data": data,
                    "timestamp": datetime.now().isoformat()
                }),
                self._event_loop
            )
    
    def on_polymarket_trade(self, data: dict):
        """處理 Polymarket 交易數據"""
        try:
            payload = data.get("payload", {})
            
            # 提取市場和交易信息
            market_data = {
                "conditionId": payload.get("conditionId", ""),
                "title": payload.get("title", ""),
                "slug": payload.get("slug", ""),
                "price": payload.get("price", 0),
            }
            
            trade_data = {
                "transactionHash": payload.get("transactionHash", ""),
                "side": payload.get("side", "BUY"),
                "price": payload.get("price", 0),
                "size": payload.get("size", 0),
            }
            
            # 保存到資料庫
            self.save_market_to_db(market_data)
            self.save_trade_to_db(trade_data, market_data)
            
            # 計算交易金額
            amount = trade_data["price"] * trade_data["size"]
            
            # 廣播到前端客戶端（使用線程安全的方式）
            if hasattr(self, '_event_loop') and self._event_loop:
                asyncio.run_coroutine_threadsafe(
                    self.broadcast_to_clients({
                        "type": "trade",
                        "data": {
                            "market": market_data["title"],
                            "conditionId": market_data["conditionId"],
                            "side": trade_data["side"],
                            "price": trade_data["price"],
                            "size": trade_data["size"],
                            "amount": amount,
                            "isWhale": amount >= 100,
                            "timestamp": datetime.now().isoformat()
                        }
                    }),
                    self._event_loop
                )
            
        except Exception as e:
            cprint(f"❌ Error processing trade: {e}", "red")
            traceback.print_exc()
    
    def initialize_swarm_agent(self):
        """初始化 SwarmAgent（多模型 AI 共識）"""
        try:
            from models.model_factory import SwarmAgent
            
            # 初始化 SwarmAgent
            models = [
                "openai/gpt-4o-mini",
                "anthropic/claude-3.5-haiku",
                "google/gemini-2.0-flash-exp:free"  # 使用正確的 Gemini 模型名稱
            ]
            
            self.swarm_agent = SwarmAgent(models)
            self.swarm_models = [{"name": "Swarm", "agent": self.swarm_agent}]
            
            cprint(f"🤖 Swarm Agent initialized with {len(self.swarm_models)} models", "green")
            
        except Exception as e:
            cprint(f"⚠️ Swarm Agent initialization failed: {e}", "yellow")
            self.swarm_models = []
    
    def trigger_ai_prediction(self, market_id: int, market_data: dict):
        """觸發 AI 預測（異步執行）"""
        condition_id = market_data.get("conditionId", "")
        
        # 檢查是否最近已經分析過（避免重複）
        if condition_id in self.prediction_cache:
            last_prediction_time = self.prediction_cache[condition_id]
            if (datetime.now() - last_prediction_time).seconds < 300:  # 5 分鐘內不重複
                return
        
        # 異步執行 AI 分析（不阻塞主線程）
        if hasattr(self, '_event_loop') and self._event_loop:
            asyncio.run_coroutine_threadsafe(
                self.run_ai_prediction(market_id, market_data),
                self._event_loop
            )
    
    async def run_ai_prediction(self, market_id: int, market_data: dict):
        """執行 AI 預測（異步）"""
        try:
            condition_id = market_data.get("conditionId", "")
            title = market_data.get("title", "")
            
            cprint(f"🧠 Starting AI prediction for: {title[:50]}...", "magenta")
            
            if not self.swarm_models or len(self.swarm_models) == 0:
                cprint("⚠️ No AI models available for prediction", "yellow")
                return
            
            # 構建提示詞
            prompt = f"""
You are analyzing a Polymarket prediction market.

Market Title: {title}

Based on your knowledge and reasoning, predict the outcome of this market.
Respond with ONLY a JSON object in this format:
{{
    "prediction": "YES" or "NO",
    "confidence": 0-100 (integer),
    "reasoning": "Brief explanation (max 200 chars)"
}}
"""
            
            # 使用 SwarmAgent 獲取共識預測
            if not self.swarm_agent:
                cprint("⚠️ SwarmAgent not initialized", "yellow")
                return
            
            # 調用 SwarmAgent
            swarm_result = self.swarm_agent.get_consensus(
                prompt=prompt,
                system_prompt="You are an expert at analyzing prediction markets. Provide concise, data-driven predictions."
            )
            
            # 解析 SwarmAgent 的回應
            # swarm_result 結構: {"consensus": str, "confidence": float, "responses": list}
            predictions = []
            for response_data in swarm_result.get("responses", []):
                try:
                    model_name = response_data.get("model", "Unknown")
                    prediction = response_data.get("prediction", "YES")
                    reasoning = response_data.get("reasoning", "")[:200]
                    
                    # 嘗試從 reasoning 中提取 confidence，或使用共識信心度
                    confidence = int(swarm_result.get("confidence", 0.5) * 100)  # 轉為百分比
                    import re
                    conf_match = re.search(r'confidence["\s:]+([0-9]+)', reasoning, re.IGNORECASE)
                    if conf_match:
                        confidence = int(conf_match.group(1))
                    
                    predictions.append({
                        "model": model_name,
                        "prediction": prediction,
                        "confidence": confidence,
                        "reasoning": reasoning
                    })
                    cprint(f"  ✅ {model_name}: {prediction} ({confidence}%)", "green")
                except Exception as e:
                    cprint(f"  ⚠️ Parsing failed: {e}", "yellow")
                    continue
            
            if len(predictions) == 0:
                cprint("⚠️ No valid predictions received", "yellow")
                return
            
            # 使用 SwarmAgent 提供的共識結果
            consensus = swarm_result.get("consensus", "YES")
            avg_confidence = int(swarm_result.get("confidence", 0.5) * 100)
            yes_count = swarm_result.get("agree_models", 0) if consensus == "YES" else swarm_result.get("total_models", 0) - swarm_result.get("agree_models", 0)
            no_count = swarm_result.get("total_models", 0) - yes_count
            
            cprint(f"🎯 Consensus: {consensus} (Confidence: {avg_confidence}%, {yes_count} YES / {no_count} NO)", "cyan", attrs=['bold'])
            
            # 存入資料庫
            self.save_prediction_to_db(market_id, consensus, avg_confidence, predictions)
            
            # 更新緩存
            self.prediction_cache[condition_id] = datetime.now()
            
        except Exception as e:
            cprint(f"❌ AI prediction failed: {e}", "red")
            traceback.print_exc()
    
    def save_prediction_to_db(self, market_id: int, consensus: str, confidence: int, model_predictions: list):
        """儲存 AI 預測到資料庫"""
        conn = None
        cursor = None
        try:
            if not hasattr(self, 'db_pool'):
                return
            
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            # 計算共識數據
            total_models = len(model_predictions)
            agree_models = sum(1 for p in model_predictions if p["prediction"] == consensus)
            
            # 為每個模型儲存一條預測記錄
            query = """
                INSERT INTO predictions (
                    marketId, aiModel, prediction, confidence, reasoning,
                    consensusVote, consensusConfidence, totalModels, agreeModels, createdAt
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            for pred in model_predictions:
                values = (
                    market_id,
                    pred["model"],
                    pred["prediction"],
                    pred["confidence"],
                    pred["reasoning"][:500] if pred.get("reasoning") else None,  # 限制長度
                    consensus,
                    confidence,
                    total_models,
                    agree_models,
                    datetime.now()
                )
                
                cursor.execute(query, values)
            
            cprint(f"💾 {len(model_predictions)} predictions saved to database", "green")
            
        except Exception as e:
            cprint(f"❌ Error saving prediction: {e}", "red")
            traceback.print_exc()
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
    
    def on_polymarket_error(self, error: Exception):
        """處理 Polymarket 錯誤"""
        cprint(f"❌ Polymarket Error: {error}", "red")
    
    async def websocket_handler(self, websocket, path):
        """處理 WebSocket 連接（前端客戶端）"""
        cprint(f"🔌 New WebSocket connection from {websocket.remote_address}", "cyan")
        
        # Add client to agent's client list
        if self.agent:
            self.agent.add_ws_client(websocket)
        
        try:
            # Send welcome message
            await websocket.send(json.dumps({
                "type": "connected",
                "message": "Connected to Polymarket Insights Backend",
                "timestamp": datetime.now().isoformat()
            }))
            
            # Keep connection alive and handle incoming messages
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.handle_client_message(websocket, data)
                except json.JSONDecodeError:
                    cprint(f"⚠️ Invalid JSON from client: {message}", "yellow")
                    
        except websockets.exceptions.ConnectionClosed:
            cprint(f"⚠️ Client disconnected: {websocket.remote_address}", "yellow")
        finally:
            if self.agent:
                self.agent.remove_ws_client(websocket)
    
    async def handle_client_message(self, websocket, data: dict):
        """處理來自前端的消息"""
        msg_type = data.get("type")
        
        if msg_type == "ping":
            await websocket.send(json.dumps({"type": "pong"}))
        
        elif msg_type == "subscribe_market":
            market_id = data.get("market_id")
            cprint(f"📡 Client subscribed to market {market_id}", "cyan")
        
        elif msg_type == "request_analysis":
            market_id = data.get("market_id")
            cprint(f"🧠 AI analysis requested for market {market_id}", "cyan")
    
    async def broadcast_to_clients(self, message: dict):
        """向所有連接的前端客戶端廣播消息"""
        if not self.agent or not self.agent.ws_clients:
            return
        
        disconnected_clients = set()
        message_json = json.dumps(message)
        
        for client in self.agent.ws_clients:
            try:
                await client.send(message_json)
            except Exception:
                disconnected_clients.add(client)
        
        # Remove disconnected clients
        self.agent.ws_clients -= disconnected_clients
    
    async def start_websocket_server(self):
        """啟動 WebSocket 服務器"""
        try:
            # 保存 event loop 以便從其他線程調用
            self._event_loop = asyncio.get_running_loop()
            
            self.ws_server = await websockets.serve(
                self.websocket_handler,
                WS_SERVER_HOST,
                WS_SERVER_PORT
            )
            cprint(f"✅ WebSocket server started on {WS_SERVER_HOST}:{WS_SERVER_PORT}", "green", attrs=['bold'])
            
            # Keep server running
            await asyncio.Future()  # Run forever
            
        except Exception as e:
            cprint(f"❌ WebSocket server failed: {e}", "red")
            traceback.print_exc()
    
    def start(self):
        """啟動服務"""
        cprint("\n🚀 Starting Polymarket Insights Backend...\n", "green", attrs=['bold'])
        
        # 1. Connect to database
        if not self.connect_database():
            cprint("❌ Failed to start: Database connection error", "red")
            return
        
        # 2. Initialize agent
        if not self.initialize_agent():
            cprint("❌ Failed to start: Agent initialization error", "red")
            return
        
        # 3. Start Polymarket Agent
        cprint("\n📡 Connecting to Polymarket RTDS...", "cyan")
        self.agent.start()
        
        # 4. Start WebSocket server for frontend
        cprint("\n🌐 Starting WebSocket server for frontend...", "cyan")
        try:
            asyncio.run(self.start_websocket_server())
        except KeyboardInterrupt:
            cprint("\n\n⚠️ Shutting down gracefully...", "yellow")
            self.shutdown()
    
    def shutdown(self):
        """關閉服務"""
        cprint("🛑 Stopping Polymarket Agent...", "yellow")
        if self.agent:
            self.agent.stop()
        
        cprint("🛑 Closing database connection pool...", "yellow")
        if hasattr(self, 'db_pool'):
            # 連接池會自動關閉所有連接
            pass
        
        cprint("👋 Goodbye!", "cyan")


if __name__ == "__main__":
    service = PolymarketBackendService()
    service.start()
