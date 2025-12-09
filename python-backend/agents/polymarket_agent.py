"""
Polymarket Data Collection Agent
整合 WebSocket 實時數據和 AI 預測功能
"""
import json
import time
import asyncio
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import websocket
import requests
from termcolor import cprint

from config import *
from models.model_factory import SwarmAgent


class PolymarketAgent:
    """Polymarket 數據收集和分析代理"""
    
    def __init__(self, db_connection):
        self.db = db_connection
        self.ws = None
        self.ws_connected = False
        self.total_trades_received = 0
        self.filtered_trades_count = 0
        
        # Market tracking
        self.markets_cache = {}  # {condition_id: market_data}
        self.last_analysis_run = None
        
        # AI Agent
        if USE_SWARM_MODE:
            self.ai_agent = SwarmAgent(models=SWARM_MODELS)
        else:
            self.ai_agent = None
        
        # WebSocket clients (for pushing to frontend)
        self.ws_clients = set()
        
        cprint("🌙 Polymarket Agent initialized", "cyan", attrs=['bold'])
    
    # ============ WebSocket Connection (Polymarket) ============
    
    def connect_websocket(self):
        """連接到 Polymarket WebSocket"""
        def on_message(ws, message):
            self.on_ws_message(ws, message)
        
        def on_error(ws, error):
            cprint(f"❌ WebSocket Error: {error}", "red")
            self.ws_connected = False
        
        def on_close(ws, close_status_code, close_msg):
            cprint(f"⚠️ WebSocket Closed: {close_status_code} - {close_msg}", "yellow")
            self.ws_connected = False
            # Auto reconnect after 5 seconds
            time.sleep(5)
            self.connect_websocket()
        
        def on_open(ws):
            cprint("✅ WebSocket Connected to Polymarket", "green", attrs=['bold'])
            self.ws_connected = True
            
            # Subscribe to all markets
            subscribe_msg = {
                "type": "subscribe",
                "channel": "market",
                "markets": ["all"]  # 訂閱所有市場
            }
            ws.send(json.dumps(subscribe_msg))
            cprint("📡 Subscribed to all markets", "cyan")
        
        self.ws = websocket.WebSocketApp(
            POLYMARKET_WS_URL,
            on_message=on_message,
            on_error=on_error,
            on_close=on_close,
            on_open=on_open
        )
        
        # Run in separate thread
        ws_thread = threading.Thread(target=self.ws.run_forever, daemon=True)
        ws_thread.start()
        cprint("🚀 WebSocket thread started", "green")
    
    def on_ws_message(self, ws, message):
        """處理 WebSocket 消息"""
        try:
            data = json.loads(message)
            self.total_trades_received += 1
            
            # Check if it's a trade event
            if data.get("event_type") == "trade":
                self.process_trade(data)
            elif data.get("event_type") == "market_update":
                self.process_market_update(data)
            
        except Exception as e:
            cprint(f"❌ Error processing message: {e}", "red")
    
    # ============ Data Processing ============
    
    def process_trade(self, trade_data: Dict[str, Any]):
        """處理交易數據"""
        try:
            # Extract trade info
            condition_id = trade_data.get("condition_id")
            side = trade_data.get("side", "").upper()  # YES or NO
            price = float(trade_data.get("price", 0))
            size = float(trade_data.get("size", 0))
            amount = price * size  # 交易金額
            
            # Filter by threshold
            if amount < TRADE_NOTIONAL_THRESHOLD:
                return
            
            # Filter near-resolution prices
            if price < IGNORE_PRICE_THRESHOLD or price > (1 - IGNORE_PRICE_THRESHOLD):
                return
            
            self.filtered_trades_count += 1
            
            # Get or fetch market info
            market = self.get_market_info(condition_id)
            if not market:
                return
            
            # Check if should ignore (crypto/sports)
            if self.should_ignore_market(market.get("title", "")):
                return
            
            # Save to database
            self.save_trade_to_db(trade_data, market, amount)
            
            # Check if whale trade
            is_whale = amount >= WHALE_TRADE_THRESHOLD
            if is_whale:
                cprint(f"🐋 WHALE TRADE: ${amount:,.2f} on {market.get('title', 'Unknown')}", "yellow", attrs=['bold'])
                # Broadcast to frontend clients
                self.broadcast_whale_trade(trade_data, market, amount)
            
            # Broadcast market update to frontend
            self.broadcast_market_update(market)
            
        except Exception as e:
            cprint(f"❌ Error processing trade: {e}", "red")
    
    def process_market_update(self, market_data: Dict[str, Any]):
        """處理市場更新"""
        try:
            condition_id = market_data.get("condition_id")
            if condition_id:
                self.markets_cache[condition_id] = market_data
                self.save_market_to_db(market_data)
        except Exception as e:
            cprint(f"❌ Error processing market update: {e}", "red")
    
    def should_ignore_market(self, title: str) -> bool:
        """檢查是否應該忽略此市場"""
        title_lower = title.lower()
        
        # Check crypto keywords
        for keyword in IGNORE_CRYPTO_KEYWORDS:
            if keyword in title_lower:
                return True
        
        # Check sports keywords
        for keyword in IGNORE_SPORTS_KEYWORDS:
            if keyword in title_lower:
                return True
        
        return False
    
    # ============ Market Data Fetching ============
    
    def get_market_info(self, condition_id: str) -> Optional[Dict[str, Any]]:
        """獲取市場信息（從緩存或 API）"""
        # Check cache first
        if condition_id in self.markets_cache:
            return self.markets_cache[condition_id]
        
        # Fetch from API
        try:
            url = f"{POLYMARKET_GAMMA_API}/markets/{condition_id}"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                market_data = response.json()
                self.markets_cache[condition_id] = market_data
                return market_data
        except Exception as e:
            cprint(f"⚠️ Failed to fetch market {condition_id}: {e}", "yellow")
        
        return None
    
    def fetch_all_active_markets(self) -> List[Dict[str, Any]]:
        """獲取所有活躍市場"""
        try:
            url = f"{POLYMARKET_GAMMA_API}/markets"
            params = {"active": "true", "limit": 100}
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            else:
                cprint(f"⚠️ Failed to fetch markets: {response.status_code}", "yellow")
                return []
        except Exception as e:
            cprint(f"❌ Error fetching markets: {e}", "red")
            return []
    
    # ============ Database Operations ============
    
    def save_market_to_db(self, market_data: Dict[str, Any]):
        """保存市場數據到資料庫"""
        try:
            cursor = self.db.cursor()
            
            query = """
                INSERT INTO markets (
                    conditionId, title, question, description, category, 
                    currentPrice, volume24h, totalVolume, lastTradeTimestamp, isActive
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    title = VALUES(title),
                    currentPrice = VALUES(currentPrice),
                    volume24h = VALUES(volume24h),
                    totalVolume = VALUES(totalVolume),
                    lastTradeTimestamp = VALUES(lastTradeTimestamp),
                    updatedAt = CURRENT_TIMESTAMP
            """
            
            values = (
                market_data.get("condition_id"),
                market_data.get("title", ""),
                market_data.get("question", ""),
                market_data.get("description", ""),
                market_data.get("category", ""),
                int(market_data.get("price", 0) * 100),  # 轉為分
                int(market_data.get("volume_24h", 0) * 100),
                int(market_data.get("total_volume", 0) * 100),
                datetime.now(),
                market_data.get("active", True)
            )
            
            cursor.execute(query, values)
            self.db.commit()
            cursor.close()
            
        except Exception as e:
            cprint(f"❌ Error saving market to DB: {e}", "red")
    
    def save_trade_to_db(self, trade_data: Dict[str, Any], market: Dict[str, Any], amount: float):
        """保存交易數據到資料庫"""
        try:
            cursor = self.db.cursor()
            
            # First, get market ID
            cursor.execute("SELECT id FROM markets WHERE conditionId = %s", (market.get("condition_id"),))
            result = cursor.fetchone()
            
            if not result:
                cursor.close()
                return
            
            market_id = result[0]
            is_whale = amount >= WHALE_TRADE_THRESHOLD
            
            query = """
                INSERT INTO trades (
                    marketId, tradeId, side, price, amount, isWhale, timestamp
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            
            values = (
                market_id,
                trade_data.get("trade_id", f"trade_{int(time.time())}"),
                trade_data.get("side", "").upper(),
                int(float(trade_data.get("price", 0)) * 100),
                int(amount * 100),
                is_whale,
                datetime.now()
            )
            
            cursor.execute(query, values)
            self.db.commit()
            cursor.close()
            
        except Exception as e:
            cprint(f"❌ Error saving trade to DB: {e}", "red")
    
    # ============ AI Prediction ============
    
    def run_ai_analysis(self, market: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """對市場運行 AI 分析"""
        if not self.ai_agent:
            return None
        
        try:
            system_prompt = """You are a prediction market analyst. 
            Analyze the given market and predict whether the outcome will be YES or NO.
            Respond with ONLY "YES" or "NO" followed by a brief reasoning (max 200 words)."""
            
            user_prompt = f"""
            Market: {market.get('title', '')}
            Question: {market.get('question', '')}
            Description: {market.get('description', '')}
            Current Price: ${market.get('price', 0):.2f}
            
            Based on this information, will this market resolve to YES or NO?
            """
            
            result = self.ai_agent.get_consensus(
                prompt=user_prompt,
                system_prompt=system_prompt,
                temperature=0.7,
                max_tokens=500
            )
            
            return result
            
        except Exception as e:
            cprint(f"❌ Error running AI analysis: {e}", "red")
            return None
    
    def save_prediction_to_db(self, market_id: int, prediction_result: Dict[str, Any]):
        """保存 AI 預測到資料庫"""
        try:
            cursor = self.db.cursor()
            
            # Save individual model predictions
            for response in prediction_result.get("responses", []):
                query = """
                    INSERT INTO predictions (
                        marketId, aiModel, prediction, confidence, reasoning,
                        consensusVote, consensusConfidence, totalModels, agreeModels
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                
                values = (
                    market_id,
                    response.get("model"),
                    response.get("prediction"),
                    prediction_result.get("confidence", 0),
                    response.get("reasoning", "")[:1000],
                    prediction_result.get("consensus"),
                    prediction_result.get("confidence"),
                    prediction_result.get("total_models"),
                    prediction_result.get("agree_models")
                )
                
                cursor.execute(query, values)
            
            self.db.commit()
            cursor.close()
            
        except Exception as e:
            cprint(f"❌ Error saving prediction to DB: {e}", "red")
    
    # ============ WebSocket Broadcasting (to Frontend) ============
    
    def broadcast_whale_trade(self, trade_data: Dict[str, Any], market: Dict[str, Any], amount: float):
        """廣播大額交易到前端"""
        message = {
            "type": "whale_trade",
            "data": {
                "market": market.get("title"),
                "side": trade_data.get("side"),
                "amount": amount,
                "price": trade_data.get("price"),
                "timestamp": datetime.now().isoformat()
            }
        }
        self._broadcast_to_clients(message)
    
    def broadcast_market_update(self, market: Dict[str, Any]):
        """廣播市場更新到前端"""
        message = {
            "type": "market_update",
            "data": {
                "condition_id": market.get("condition_id"),
                "title": market.get("title"),
                "price": market.get("price"),
                "volume_24h": market.get("volume_24h"),
                "timestamp": datetime.now().isoformat()
            }
        }
        self._broadcast_to_clients(message)
    
    def _broadcast_to_clients(self, message: Dict[str, Any]):
        """向所有連接的前端客戶端廣播消息"""
        disconnected_clients = set()
        
        for client in self.ws_clients:
            try:
                asyncio.run(client.send(json.dumps(message)))
            except Exception:
                disconnected_clients.add(client)
        
        # Remove disconnected clients
        self.ws_clients -= disconnected_clients
    
    def add_ws_client(self, client):
        """添加 WebSocket 客戶端"""
        self.ws_clients.add(client)
        cprint(f"✅ New WebSocket client connected. Total: {len(self.ws_clients)}", "green")
    
    def remove_ws_client(self, client):
        """移除 WebSocket 客戶端"""
        self.ws_clients.discard(client)
        cprint(f"⚠️ WebSocket client disconnected. Total: {len(self.ws_clients)}", "yellow")
