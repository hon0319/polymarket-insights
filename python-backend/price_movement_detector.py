"""
價格變動檢測器
檢測市場價格的大幅變動，用於識別早期交易者
"""

import logging
import mysql.connector
from mysql.connector import pooling
import os
from datetime import datetime, timedelta
from typing import List, Dict, Tuple

logger = logging.getLogger(__name__)


class PriceMovementDetector:
    """價格變動檢測器 - 識別市場價格的異常變動"""
    
    def __init__(self):
        self.db_pool = self._create_db_pool()
        
    def _create_db_pool(self):
        """創建資料庫連接池"""
        db_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'user': os.getenv('DB_USER', 'root'),
            'password': os.getenv('DB_PASSWORD', ''),
            'database': os.getenv('DB_NAME', 'polymarket_insights'),
            'pool_name': 'detector_pool',
            'pool_size': 3
        }
        
        # 從 DATABASE_URL 解析配置
        database_url = os.getenv('DATABASE_URL')
        if database_url:
            import re
            match = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', database_url)
            if match:
                db_config['user'] = match.group(1)
                db_config['password'] = match.group(2)
                db_config['host'] = match.group(3)
                db_config['port'] = int(match.group(4))
                db_config['database'] = match.group(5)
        
        return pooling.MySQLConnectionPool(**db_config)
    
    def _get_db_connection(self):
        """從連接池獲取資料庫連接"""
        return self.db_pool.get_connection()
    
    def detect_price_movements(self, market_id: int, threshold_percent: float = 20.0) -> List[Dict]:
        """
        檢測市場價格的大幅變動
        
        Args:
            market_id: 市場 ID
            threshold_percent: 價格變動閾值（百分比），默認 20%
        
        Returns:
            價格異常變動列表
        """
        conn = self._get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 獲取市場的價格歷史（按時間排序）
            cursor.execute("""
                SELECT 
                    id,
                    price,
                    volume,
                    timestamp
                FROM market_price_history
                WHERE market_id = %s
                ORDER BY timestamp ASC
            """, (market_id,))
            
            price_history = cursor.fetchall()
            
            if len(price_history) < 2:
                logger.warning(f"Not enough price data for market {market_id}")
                return []
            
            # 檢測價格變動
            anomalies = []
            
            for i in range(1, len(price_history)):
                prev_point = price_history[i - 1]
                curr_point = price_history[i]
                
                prev_price = prev_point['price']
                curr_price = curr_point['price']
                
                # 避免除以零
                if prev_price == 0:
                    continue
                
                # 計算價格變動百分比
                price_change_percent = ((curr_price - prev_price) / prev_price) * 100
                
                # 檢查是否超過閾值
                if abs(price_change_percent) >= threshold_percent:
                    anomalies.append({
                        'market_id': market_id,
                        'timestamp': curr_point['timestamp'],
                        'price_before': prev_price,
                        'price_after': curr_price,
                        'price_change_percent': price_change_percent,
                        'volume': curr_point['volume']
                    })
                    
                    logger.info(f"Detected price movement: Market {market_id}, "
                              f"Change: {price_change_percent:.2f}%, "
                              f"Time: {curr_point['timestamp']}")
            
            return anomalies
            
        except Exception as e:
            logger.error(f"Error detecting price movements: {e}")
            return []
        finally:
            cursor.close()
            conn.close()
    
    def save_price_anomalies(self, anomalies: List[Dict]):
        """
        將價格異常保存到資料庫
        
        Args:
            anomalies: 價格異常列表
        """
        if not anomalies:
            logger.warning("No anomalies to save")
            return
        
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        try:
            # 批量插入異常數據
            insert_query = """
                INSERT INTO market_anomalies 
                (market_id, anomaly_type, timestamp, price_change_percent, detected_at)
                VALUES (%s, %s, %s, %s, NOW())
                ON DUPLICATE KEY UPDATE
                    price_change_percent = VALUES(price_change_percent),
                    detected_at = NOW()
            """
            
            values = [
                (
                    anomaly['market_id'],
                    'price_spike',
                    anomaly['timestamp'],
                    int(anomaly['price_change_percent'] * 100)  # 轉換為整數（以分為單位）
                )
                for anomaly in anomalies
            ]
            
            cursor.executemany(insert_query, values)
            conn.commit()
            
            logger.info(f"✅ Saved {len(anomalies)} price anomalies")
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error saving price anomalies: {e}")
            raise
        finally:
            cursor.close()
            conn.close()
    
    def detect_and_save_all_markets(self, threshold_percent: float = 20.0):
        """
        檢測所有市場的價格異常並保存
        
        Args:
            threshold_percent: 價格變動閾值（百分比）
        """
        logger.info(f"Detecting price movements for all markets (threshold: {threshold_percent}%)")
        
        conn = self._get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 獲取所有有價格歷史的市場
            cursor.execute("""
                SELECT DISTINCT market_id
                FROM market_price_history
            """)
            
            markets = cursor.fetchall()
            logger.info(f"Found {len(markets)} markets with price history")
            
            total_anomalies = 0
            
            for market in markets:
                market_id = market['market_id']
                
                try:
                    # 檢測價格變動
                    anomalies = self.detect_price_movements(market_id, threshold_percent)
                    
                    if anomalies:
                        # 保存異常
                        self.save_price_anomalies(anomalies)
                        total_anomalies += len(anomalies)
                    
                except Exception as e:
                    logger.error(f"Error processing market {market_id}: {e}")
                    continue
            
            logger.info(f"✅ Detected and saved {total_anomalies} price anomalies across {len(markets)} markets")
            
        finally:
            cursor.close()
            conn.close()
    
    def get_price_movements_before_timestamp(self, market_id: int, timestamp: datetime, hours_before: int = 72) -> List[Dict]:
        """
        獲取特定時間點之前的價格變動
        
        Args:
            market_id: 市場 ID
            timestamp: 參考時間點
            hours_before: 往前查找的小時數
        
        Returns:
            價格變動列表
        """
        conn = self._get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            start_time = timestamp - timedelta(hours=hours_before)
            
            cursor.execute("""
                SELECT *
                FROM market_anomalies
                WHERE market_id = %s
                    AND timestamp >= %s
                    AND timestamp <= %s
                ORDER BY timestamp ASC
            """, (market_id, start_time, timestamp))
            
            return cursor.fetchall()
            
        finally:
            cursor.close()
            conn.close()


# 測試代碼
if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    detector = PriceMovementDetector()
    
    # 檢測所有市場的價格異常（閾值 20%）
    detector.detect_and_save_all_markets(threshold_percent=20.0)
