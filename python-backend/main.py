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

from config import *
from agents.polymarket_agent import PolymarketAgent


class PolymarketBackendService:
    """Python 後端服務主類"""
    
    def __init__(self):
        self.db_connection = None
        self.agent = None
        self.ws_server = None
        
        cprint("=" * 60, "cyan")
        cprint("🌙 Polymarket Insights - Python Backend Service", "cyan", attrs=['bold'])
        cprint("=" * 60, "cyan")
    
    def connect_database(self):
        """連接到資料庫"""
        try:
            # Parse DATABASE_URL
            # Format: mysql://user:password@host:port/database
            if not DATABASE_URL:
                raise ValueError("DATABASE_URL not set in environment")
            
            # Simple parsing (you might want to use urllib.parse for production)
            url_parts = DATABASE_URL.replace("mysql://", "").split("@")
            user_pass = url_parts[0].split(":")
            host_db = url_parts[1].split("/")
            host_port = host_db[0].split(":")
            
            self.db_connection = mysql.connector.connect(
                host=host_port[0],
                port=int(host_port[1]) if len(host_port) > 1 else 3306,
                user=user_pass[0],
                password=user_pass[1],
                database=host_db[1].split("?")[0]  # Remove query params
            )
            
            cprint("✅ Database connected successfully", "green")
            return True
            
        except Exception as e:
            cprint(f"❌ Database connection failed: {e}", "red")
            return False
    
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
            # self.agent.subscribe_to_crypto_prices()  # 可選
            
            cprint("🤖 Polymarket Agent initialized", "green")
            cprint(f"   Subscriptions: {len(self.agent.subscriptions)}", "cyan")
            
            return True
        except Exception as e:
            cprint(f"❌ Agent initialization failed: {e}", "red")
            return False
    
    def on_polymarket_message(self, data: dict):
        """處理 Polymarket 消息"""
        topic = data.get("topic", "unknown")
        msg_type = data.get("type", "unknown")
        # cprint(f"📨 Polymarket Message: {topic}/{msg_type}", "cyan")
        
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
        payload = data.get("payload", {})
        cprint(f"💰 Trade: {payload}", "magenta")
        
        # 廣播到前端客戶端（使用線程安全的方式）
        if hasattr(self, '_event_loop') and self._event_loop:
            asyncio.run_coroutine_threadsafe(
                self.broadcast_to_clients({
                    "type": "trade",
                    "data": data,
                    "timestamp": datetime.now().isoformat()
                }),
                self._event_loop
            )
    
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
            # TODO: Implement market-specific subscriptions
        
        elif msg_type == "request_analysis":
            market_id = data.get("market_id")
            cprint(f"🧠 AI analysis requested for market {market_id}", "cyan")
            # TODO: Trigger AI analysis and send result
    
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
        
        cprint("🛑 Closing database connection...", "yellow")
        if self.db_connection:
            self.db_connection.close()
        
        cprint("👋 Goodbye!", "cyan")


if __name__ == "__main__":
    service = PolymarketBackendService()
    service.start()
