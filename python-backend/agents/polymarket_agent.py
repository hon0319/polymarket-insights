"""
Polymarket Agent - 連接到 Polymarket Real-Time Data Socket (RTDS)
參考: https://docs.polymarket.com/developers/RTDS/RTDS-overview
官方客戶端: https://github.com/Polymarket/real-time-data-client
"""

import json
import time
import threading
import websocket
from typing import Callable, Optional, Dict, Any, List
from termcolor import colored
import traceback


class PolymarketAgent:
    """
    Polymarket 數據收集代理
    使用 Polymarket Real-Time Data Socket (RTDS) 接收實時市場數據和交易信息
    """
    
    # Polymarket RTDS WebSocket URL
    WEBSOCKET_URL = "wss://ws-live-data.polymarket.com"
    
    # Ping 間隔（秒）
    PING_INTERVAL = 5
    
    def __init__(
        self,
        on_message: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_trade: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_error: Optional[Callable[[Exception], None]] = None
    ):
        """
        初始化 Polymarket Agent
        
        Args:
            on_message: 接收到消息時的回調函數
            on_trade: 接收到交易數據時的回調函數
            on_error: 發生錯誤時的回調函數
        """
        self.on_message = on_message
        self.on_trade = on_trade
        self.on_error = on_error
        
        self.ws: Optional[websocket.WebSocketApp] = None
        self.ws_thread: Optional[threading.Thread] = None
        self.ping_thread: Optional[threading.Thread] = None
        self.is_connected = False
        self.is_running = False
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 10
        self.reconnect_delay = 5  # 秒
        
        # 訂閱配置
        self.subscriptions: List[Dict[str, Any]] = []
        
        # WebSocket clients (for pushing to frontend)
        self.ws_clients = set()
        
    def add_subscription(
        self,
        topic: str,
        message_type: str = "*",
        filters: Optional[Dict[str, Any]] = None
    ):
        """
        添加訂閱
        
        Args:
            topic: 主題名稱 ("activity", "comments", "crypto_prices")
            message_type: 消息類型 ("trades", "*" 表示所有類型)
            filters: 可選的過濾器
        """
        subscription = {
            "topic": topic,
            "type": message_type
        }
        
        if filters:
            subscription["filters"] = filters
            
        self.subscriptions.append(subscription)
        print(colored(f"📋 Added subscription: {topic}/{message_type}", "cyan"))
        
    def subscribe_to_trades(self):
        """訂閱所有交易數據"""
        self.add_subscription(topic="activity", message_type="trades")
        
    def subscribe_to_comments(self):
        """訂閱所有評論"""
        self.add_subscription(topic="comments", message_type="*")
        
    def subscribe_to_crypto_prices(self):
        """訂閱加密貨幣價格"""
        self.add_subscription(topic="crypto_prices", message_type="*")
        
    def _send_subscribe_message(self):
        """發送訂閱消息"""
        if not self.ws or not self.is_connected:
            return
            
        if not self.subscriptions:
            print(colored("⚠️ No subscriptions configured", "yellow"))
            return
            
        subscribe_message = {
            "action": "subscribe",
            "subscriptions": self.subscriptions
        }
        
        try:
            self.ws.send(json.dumps(subscribe_message))
            print(colored(f"📡 Subscribed to {len(self.subscriptions)} topics", "green"))
            for sub in self.subscriptions:
                print(colored(f"   • {sub['topic']}/{sub['type']}", "cyan"))
        except Exception as e:
            print(colored(f"❌ Failed to send subscribe message: {e}", "red"))
            
    def _send_ping(self):
        """發送 PING 消息以維持連接"""
        while self.is_running and self.is_connected:
            try:
                if self.ws:
                    self.ws.send("PING")
                    # print(colored("💓 Sent PING", "blue"))
                time.sleep(self.PING_INTERVAL)
            except Exception as e:
                print(colored(f"❌ Ping error: {e}", "red"))
                break
                
    def _on_open(self, ws):
        """WebSocket 連接建立時的回調"""
        self.is_connected = True
        self.reconnect_attempts = 0
        print(colored("✅ WebSocket Connected to Polymarket RTDS", "green"))
        
        # 發送訂閱消息
        self._send_subscribe_message()
        
        # 啟動 Ping 線程
        if self.ping_thread is None or not self.ping_thread.is_alive():
            self.ping_thread = threading.Thread(target=self._send_ping, daemon=True)
            self.ping_thread.start()
            print(colored("💓 Ping thread started", "blue"))
        
    def _on_message(self, ws, message):
        """接收到 WebSocket 消息時的回調"""
        try:
            # 處理 PONG 消息
            if message == "PONG":
                # print(colored("💓 Received PONG", "blue"))
                return
                
            # 解析 JSON 消息
            data = json.loads(message)
            
            # 打印接收到的消息（用於調試）
            topic = data.get("topic", "unknown")
            msg_type = data.get("type", "unknown")
            print(colored(f"📨 Received: {topic}/{msg_type}", "cyan"))
            
            # 調用通用消息回調
            if self.on_message:
                self.on_message(data)
                
            # 如果是交易數據，調用交易回調
            if topic == "activity" and msg_type == "trades" and self.on_trade:
                self.on_trade(data)
                
            # 廣播到前端客戶端
            self._broadcast_to_clients(data)
                
        except json.JSONDecodeError as e:
            print(colored(f"❌ JSON decode error: {e}", "red"))
            print(colored(f"   Message: {message[:200]}", "yellow"))
        except Exception as e:
            print(colored(f"❌ Message processing error: {e}", "red"))
            traceback.print_exc()
            if self.on_error:
                self.on_error(e)
                
    def _on_error(self, ws, error):
        """WebSocket 錯誤時的回調"""
        print(colored(f"❌ WebSocket Error: {error}", "red"))
        if self.on_error:
            self.on_error(error)
            
    def _on_close(self, ws, close_status_code, close_msg):
        """WebSocket 關閉時的回調"""
        self.is_connected = False
        print(colored(f"⚠️ WebSocket Closed: {close_status_code} - {close_msg}", "yellow"))
        
        # 自動重連
        if self.is_running and self.reconnect_attempts < self.max_reconnect_attempts:
            self.reconnect_attempts += 1
            print(colored(
                f"🔄 Reconnecting... (Attempt {self.reconnect_attempts}/{self.max_reconnect_attempts})",
                "yellow"
            ))
            time.sleep(self.reconnect_delay)
            self._start_websocket()
        elif self.reconnect_attempts >= self.max_reconnect_attempts:
            print(colored("❌ Max reconnection attempts reached", "red"))
            self.is_running = False
            
    def _start_websocket(self):
        """啟動 WebSocket 連接"""
        try:
            self.ws = websocket.WebSocketApp(
                self.WEBSOCKET_URL,
                on_open=self._on_open,
                on_message=self._on_message,
                on_error=self._on_error,
                on_close=self._on_close
            )
            
            # 在新線程中運行 WebSocket
            self.ws_thread = threading.Thread(
                target=self.ws.run_forever,
                daemon=True
            )
            self.ws_thread.start()
            print(colored("🚀 WebSocket thread started", "green"))
            
        except Exception as e:
            print(colored(f"❌ Failed to start WebSocket: {e}", "red"))
            traceback.print_exc()
            if self.on_error:
                self.on_error(e)
                
    def start(self):
        """啟動 Polymarket Agent"""
        if self.is_running:
            print(colored("⚠️ Agent is already running", "yellow"))
            return
            
        self.is_running = True
        print(colored("\n📡 Connecting to Polymarket RTDS...", "cyan"))
        self._start_websocket()
        
    def stop(self):
        """停止 Polymarket Agent"""
        print(colored("\n🛑 Stopping Polymarket Agent...", "yellow"))
        self.is_running = False
        
        if self.ws:
            self.ws.close()
            
        if self.ws_thread and self.ws_thread.is_alive():
            self.ws_thread.join(timeout=5)
            
        if self.ping_thread and self.ping_thread.is_alive():
            self.ping_thread.join(timeout=5)
            
        print(colored("✅ Polymarket Agent stopped", "green"))
        
    def is_alive(self) -> bool:
        """檢查 Agent 是否正在運行"""
        return self.is_running and self.is_connected
    
    # ============ WebSocket Broadcasting (to Frontend) ============
    
    def add_ws_client(self, client):
        """添加 WebSocket 客戶端"""
        self.ws_clients.add(client)
        print(colored(f"✅ New WebSocket client connected. Total: {len(self.ws_clients)}", "green"))
    
    def remove_ws_client(self, client):
        """移除 WebSocket 客戶端"""
        self.ws_clients.discard(client)
        print(colored(f"⚠️ WebSocket client disconnected. Total: {len(self.ws_clients)}", "yellow"))
    
    def _broadcast_to_clients(self, message: Dict[str, Any]):
        """向所有連接的前端客戶端廣播消息"""
        import asyncio
        
        disconnected_clients = set()
        
        for client in self.ws_clients:
            try:
                asyncio.run(client.send(json.dumps(message)))
            except Exception:
                disconnected_clients.add(client)
        
        # Remove disconnected clients
        self.ws_clients -= disconnected_clients


# 測試代碼
if __name__ == "__main__":
    def on_message_handler(data: Dict[str, Any]):
        print(colored(f"\n📬 Message received:", "green"))
        print(json.dumps(data, indent=2))
        
    def on_trade_handler(data: Dict[str, Any]):
        print(colored(f"\n💰 Trade received:", "magenta"))
        payload = data.get("payload", {})
        print(f"   Market: {payload.get('market', 'N/A')}")
        print(f"   Side: {payload.get('side', 'N/A')}")
        print(f"   Size: {payload.get('size', 'N/A')}")
        print(f"   Price: {payload.get('price', 'N/A')}")
        
    # 創建 Agent
    agent = PolymarketAgent(
        on_message=on_message_handler,
        on_trade=on_trade_handler
    )
    
    # 添加訂閱
    agent.subscribe_to_trades()
    agent.subscribe_to_comments()
    
    # 啟動 Agent
    agent.start()
    
    # 保持運行
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print(colored("\n\n🛑 Received interrupt signal", "yellow"))
        agent.stop()
