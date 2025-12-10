"""
警報檢測服務
定期掃描新的交易和市場變化，根據用戶訂閱發送通知
"""

import mysql.connector
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json
import os

class AlertDetector:
    def __init__(self):
        self.db_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'user': os.getenv('DB_USER', 'root'),
            'password': os.getenv('DB_PASSWORD', ''),
            'database': os.getenv('DB_NAME', 'polymarket_insights'),
        }
        # 從環境變量解析 DATABASE_URL
        database_url = os.getenv('DATABASE_URL', '')
        if database_url:
            self._parse_database_url(database_url)
    
    def _parse_database_url(self, url: str):
        """解析 DATABASE_URL 環境變量"""
        # 格式: mysql://user:password@host:port/database
        if url.startswith('mysql://'):
            url = url[8:]  # 移除 mysql://
            
            # 分離用戶名密碼和主機
            if '@' in url:
                auth, rest = url.split('@', 1)
                if ':' in auth:
                    user, password = auth.split(':', 1)
                    self.db_config['user'] = user
                    self.db_config['password'] = password
                
                # 分離主機和數據庫
                if '/' in rest:
                    host_port, database = rest.split('/', 1)
                    # 移除查詢參數
                    if '?' in database:
                        database = database.split('?')[0]
                    self.db_config['database'] = database
                    
                    # 分離主機和端口
                    if ':' in host_port:
                        host, port = host_port.split(':', 1)
                        self.db_config['host'] = host
                        self.db_config['port'] = int(port)
                    else:
                        self.db_config['host'] = host_port
    
    def get_connection(self):
        """獲取資料庫連接"""
        return mysql.connector.connect(**self.db_config)
    
    def detect_high_suspicion_addresses(self) -> List[Dict[str, Any]]:
        """
        檢測高可疑度地址
        返回可疑度分數 >= 80 的地址
        """
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 查詢高可疑度地址（最近 24 小時內更新的）
            cursor.execute("""
                SELECT id, address, suspicion_score, win_rate, total_volume, total_trades
                FROM addresses
                WHERE suspicion_score >= 80
                  AND updated_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                ORDER BY suspicion_score DESC
                LIMIT 50
            """)
            
            addresses = cursor.fetchall()
            return addresses
        finally:
            cursor.close()
            conn.close()
    
    def detect_large_trades(self, threshold: float = 10000) -> List[Dict[str, Any]]:
        """
        檢測大額交易
        threshold: 交易金額閾值（美元）
        """
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 查詢最近 1 小時內的大額交易
            cursor.execute("""
                SELECT 
                    t.id,
                    t.userId,
                    t.marketId,
                    t.outcome,
                    t.amount,
                    t.price,
                    t.timestamp,
                    m.question as market_name
                FROM trades t
                LEFT JOIN markets m ON t.marketId = m.id
                WHERE t.timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                  AND t.amount >= %s
                ORDER BY t.timestamp DESC
                LIMIT 100
            """, (threshold,))
            
            trades = cursor.fetchall()
            return trades
        finally:
            cursor.close()
            conn.close()
    
    def detect_price_spikes(self, threshold: float = 0.2) -> List[Dict[str, Any]]:
        """
        檢測價格異常變動
        threshold: 價格變動閾值（20% = 0.2）
        """
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 查詢最近檢測到的價格異常
            cursor.execute("""
                SELECT 
                    ma.id,
                    ma.market_id,
                    ma.anomaly_type,
                    ma.price_before,
                    ma.price_after,
                    ma.change_percentage,
                    ma.detected_at,
                    m.question as market_name
                FROM market_anomalies ma
                LEFT JOIN markets m ON ma.market_id = m.id
                WHERE ma.detected_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                  AND ma.anomaly_type = 'price_spike'
                  AND ABS(ma.change_percentage) >= %s
                ORDER BY ma.detected_at DESC
                LIMIT 50
            """, (threshold * 100,))
            
            anomalies = cursor.fetchall()
            return anomalies
        finally:
            cursor.close()
            conn.close()
    
    def get_subscriptions_for_alert_type(
        self, 
        alert_type: str,
        subscription_type: Optional[str] = None,
        target_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        獲取符合條件的訂閱
        """
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            query = """
                SELECT *
                FROM alert_subscriptions
                WHERE is_active = TRUE
                  AND JSON_CONTAINS(alert_types, %s)
            """
            params = [json.dumps(alert_type)]
            
            if subscription_type:
                query += " AND subscription_type = %s"
                params.append(subscription_type)
            
            if target_id:
                query += " AND target_id = %s"
                params.append(target_id)
            
            cursor.execute(query, params)
            subscriptions = cursor.fetchall()
            
            # 解析 JSON 欄位
            for sub in subscriptions:
                if isinstance(sub['alert_types'], str):
                    sub['alert_types'] = json.loads(sub['alert_types'])
            
            return subscriptions
        finally:
            cursor.close()
            conn.close()
    
    def create_notification(
        self,
        user_id: int,
        subscription_id: int,
        alert_type: str,
        title: str,
        message: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        創建通知記錄
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO alert_notifications
                (user_id, subscription_id, alert_type, title, message, metadata, is_read)
                VALUES (%s, %s, %s, %s, %s, %s, FALSE)
            """, (
                user_id,
                subscription_id,
                alert_type,
                title,
                message,
                json.dumps(metadata) if metadata else None
            ))
            
            conn.commit()
            return True
        except Exception as e:
            print(f"Error creating notification: {e}")
            conn.rollback()
            return False
        finally:
            cursor.close()
            conn.close()
    
    def check_duplicate_notification(
        self,
        user_id: int,
        alert_type: str,
        metadata: Dict[str, Any],
        hours: int = 24
    ) -> bool:
        """
        檢查是否已經發送過類似的通知（去重）
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # 檢查最近 N 小時內是否有相同的通知
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM alert_notifications
                WHERE user_id = %s
                  AND alert_type = %s
                  AND created_at >= DATE_SUB(NOW(), INTERVAL %s HOUR)
                  AND JSON_EXTRACT(metadata, '$.target_id') = %s
            """, (
                user_id,
                alert_type,
                hours,
                metadata.get('target_id', '')
            ))
            
            result = cursor.fetchone()
            return result[0] > 0
        finally:
            cursor.close()
            conn.close()
    
    def process_high_suspicion_alerts(self):
        """
        處理高可疑度地址警報
        """
        print("[AlertDetector] Checking for high suspicion addresses...")
        
        addresses = self.detect_high_suspicion_addresses()
        print(f"[AlertDetector] Found {len(addresses)} high suspicion addresses")
        
        for addr in addresses:
            # 獲取訂閱了這個地址的用戶
            subscriptions = self.get_subscriptions_for_alert_type(
                'high_suspicion_address',
                subscription_type='address',
                target_id=str(addr['id'])
            )
            
            for sub in subscriptions:
                # 檢查是否已經發送過通知
                if self.check_duplicate_notification(
                    sub['user_id'],
                    'high_suspicion_address',
                    {'target_id': str(addr['id'])},
                    hours=24
                ):
                    continue
                
                # 創建通知
                title = f"高可疑度地址警報：{addr['address'][:10]}..."
                message = f"地址 {addr['address']} 的可疑度分數達到 {addr['suspicion_score']}，勝率 {addr['win_rate']:.1f}%，總交易量 ${addr['total_volume']:,.0f}"
                
                self.create_notification(
                    user_id=sub['user_id'],
                    subscription_id=sub['id'],
                    alert_type='high_suspicion_address',
                    title=title,
                    message=message,
                    metadata={
                        'target_id': str(addr['id']),
                        'address': addr['address'],
                        'suspicion_score': addr['suspicion_score'],
                        'win_rate': float(addr['win_rate']),
                        'total_volume': float(addr['total_volume'])
                    }
                )
                
                print(f"[AlertDetector] Created notification for user {sub['user_id']}")
    
    def process_large_trade_alerts(self):
        """
        處理大額交易警報
        """
        print("[AlertDetector] Checking for large trades...")
        
        trades = self.detect_large_trades(threshold=10000)
        print(f"[AlertDetector] Found {len(trades)} large trades")
        
        for trade in trades:
            # 獲取訂閱了這個市場的用戶
            market_subs = self.get_subscriptions_for_alert_type(
                'large_trade',
                subscription_type='market',
                target_id=str(trade['marketId'])
            )
            
            all_subs = market_subs
            
            for sub in all_subs:
                # 檢查是否已經發送過通知
                if self.check_duplicate_notification(
                    sub['user_id'],
                    'large_trade',
                    {'target_id': str(trade['id'])},
                    hours=1
                ):
                    continue
                
                # 創建通知
                trade_value = trade['amount']
                title = f"大額交易警報：${trade_value:,.0f}"
                message = f"檢測到大額交易：{trade['market_name']} - {trade['outcome']}，交易金額 ${trade_value:,.0f}"
                
                self.create_notification(
                    user_id=sub['user_id'],
                    subscription_id=sub['id'],
                    alert_type='large_trade',
                    title=title,
                    message=message,
                    metadata={
                        'target_id': str(trade['id']),
                        'user_id': trade['userId'],
                        'market_id': trade['marketId'],
                        'market_name': trade['market_name'],
                        'outcome': trade['outcome'],
                        'amount': float(trade['amount']),
                        'price': float(trade['price']),
                        'value': float(trade_value)
                    }
                )
                
                print(f"[AlertDetector] Created notification for user {sub['user_id']}")
    
    def process_price_spike_alerts(self):
        """
        處理價格異常警報
        """
        print("[AlertDetector] Checking for price spikes...")
        
        anomalies = self.detect_price_spikes(threshold=0.2)
        print(f"[AlertDetector] Found {len(anomalies)} price spikes")
        
        for anomaly in anomalies:
            # 獲取訂閱了這個市場的用戶
            subscriptions = self.get_subscriptions_for_alert_type(
                'price_spike',
                subscription_type='market',
                target_id=str(anomaly['market_id'])
            )
            
            for sub in subscriptions:
                # 檢查是否已經發送過通知
                if self.check_duplicate_notification(
                    sub['user_id'],
                    'price_spike',
                    {'target_id': str(anomaly['id'])},
                    hours=1
                ):
                    continue
                
                # 創建通知
                title = f"價格異常警報：{anomaly['market_name'][:50]}..."
                message = f"市場 {anomaly['market_name']} 價格變動 {anomaly['change_percentage']:.1f}%（從 {anomaly['price_before']:.2f} 到 {anomaly['price_after']:.2f}）"
                
                self.create_notification(
                    user_id=sub['user_id'],
                    subscription_id=sub['id'],
                    alert_type='price_spike',
                    title=title,
                    message=message,
                    metadata={
                        'target_id': str(anomaly['id']),
                        'market_id': anomaly['market_id'],
                        'market_name': anomaly['market_name'],
                        'price_before': float(anomaly['price_before']),
                        'price_after': float(anomaly['price_after']),
                        'change_percentage': float(anomaly['change_percentage'])
                    }
                )
                
                print(f"[AlertDetector] Created notification for user {sub['user_id']}")
    
    def run_detection_cycle(self):
        """
        運行一次完整的檢測週期
        """
        print(f"\n[AlertDetector] Starting detection cycle at {datetime.now()}")
        
        try:
            self.process_high_suspicion_alerts()
            self.process_large_trade_alerts()
            self.process_price_spike_alerts()
            
            print(f"[AlertDetector] Detection cycle completed at {datetime.now()}\n")
        except Exception as e:
            print(f"[AlertDetector] Error during detection cycle: {e}")


if __name__ == "__main__":
    detector = AlertDetector()
    detector.run_detection_cycle()
