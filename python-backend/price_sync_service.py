"""
價格同步服務
從 Polymarket CLOB API 和 Subgraph 同步市場的歷史價格數據
"""

import logging
import requests
import mysql.connector
from mysql.connector import pooling
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import time

logger = logging.getLogger(__name__)


class PriceSyncService:
    """價格同步服務 - 從 Polymarket 同步市場歷史價格"""
    
    def __init__(self):
        self.db_pool = self._create_db_pool()
        self.clob_api_base = "https://clob.polymarket.com"
        
    def _create_db_pool(self):
        """創建資料庫連接池"""
        db_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'user': os.getenv('DB_USER', 'root'),
            'password': os.getenv('DB_PASSWORD', ''),
            'database': os.getenv('DB_NAME', 'polymarket_insights'),
            'pool_name': 'price_sync_pool',
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
    
    def get_market_price_from_trades(self, condition_id: str, start_time: int, end_time: int) -> List[Dict]:
        """
        從 Polymarket CLOB API 獲取市場的歷史成交價格
        
        Args:
            condition_id: 市場條件 ID
            start_time: 開始時間（Unix 時間戳，秒）
            end_time: 結束時間（Unix 時間戳，秒）
        
        Returns:
            價格歷史列表
        """
        try:
            # 使用 Polymarket CLOB API 的 trades endpoint
            # 注意：這個 API 可能需要 token_id 而不是 condition_id
            # 我們需要先獲取市場的 token_id
            
            # 簡化版本：從我們自己的 trades 表中提取價格數據
            conn = self._get_db_connection()
            cursor = conn.cursor(dictionary=True)
            
            try:
                # 獲取市場 ID
                cursor.execute("""
                    SELECT id FROM markets WHERE conditionId = %s
                """, (condition_id,))
                
                market = cursor.fetchone()
                if not market:
                    logger.warning(f"Market not found for condition_id: {condition_id}")
                    return []
                
                market_id = market['id']
                
                # 從 trades 表獲取價格數據
                cursor.execute("""
                    SELECT 
                        price,
                        amount,
                        timestamp
                    FROM trades
                    WHERE marketId = %s
                        AND timestamp >= FROM_UNIXTIME(%s)
                        AND timestamp <= FROM_UNIXTIME(%s)
                    ORDER BY timestamp ASC
                """, (market_id, start_time, end_time))
                
                trades = cursor.fetchall()
                
                # 將交易數據轉換為價格歷史
                price_history = []
                for trade in trades:
                    price_history.append({
                        'price': trade['price'],
                        'volume': trade['amount'],
                        'timestamp': int(trade['timestamp'].timestamp())
                    })
                
                logger.info(f"Retrieved {len(price_history)} price points for condition {condition_id}")
                return price_history
                
            finally:
                cursor.close()
                conn.close()
                
        except Exception as e:
            logger.error(f"Error fetching market price history: {e}")
            return []
    
    def aggregate_price_by_interval(self, price_history: List[Dict], interval_seconds: int = 3600) -> List[Dict]:
        """
        將價格數據按時間間隔聚合（例如每小時一個數據點）
        
        Args:
            price_history: 原始價格歷史列表
            interval_seconds: 時間間隔（秒），默認 3600 = 1 小時
        
        Returns:
            聚合後的價格歷史
        """
        if not price_history:
            return []
        
        aggregated = []
        current_interval_start = None
        interval_trades = []
        
        for price_point in price_history:
            timestamp = price_point['timestamp']
            
            # 計算當前時間點所屬的時間間隔
            interval_start = (timestamp // interval_seconds) * interval_seconds
            
            if current_interval_start is None:
                current_interval_start = interval_start
            
            if interval_start == current_interval_start:
                # 同一個時間間隔，累積數據
                interval_trades.append(price_point)
            else:
                # 新的時間間隔，處理上一個間隔的數據
                if interval_trades:
                    # 計算加權平均價格（按交易量加權）
                    total_volume = sum(t['volume'] for t in interval_trades)
                    if total_volume > 0:
                        weighted_avg_price = sum(t['price'] * t['volume'] for t in interval_trades) / total_volume
                    else:
                        weighted_avg_price = sum(t['price'] for t in interval_trades) / len(interval_trades)
                    
                    aggregated.append({
                        'price': int(weighted_avg_price),
                        'volume': total_volume,
                        'timestamp': current_interval_start
                    })
                
                # 開始新的時間間隔
                current_interval_start = interval_start
                interval_trades = [price_point]
        
        # 處理最後一個時間間隔
        if interval_trades:
            total_volume = sum(t['volume'] for t in interval_trades)
            if total_volume > 0:
                weighted_avg_price = sum(t['price'] * t['volume'] for t in interval_trades) / total_volume
            else:
                weighted_avg_price = sum(t['price'] for t in interval_trades) / len(interval_trades)
            
            aggregated.append({
                'price': int(weighted_avg_price),
                'volume': total_volume,
                'timestamp': current_interval_start
            })
        
        return aggregated
    
    def save_price_history(self, condition_id: str, price_history: List[Dict]):
        """
        將價格歷史保存到資料庫
        
        Args:
            condition_id: 市場條件 ID
            price_history: 價格歷史列表
        """
        if not price_history:
            logger.warning(f"No price history to save for condition {condition_id}")
            return
        
        conn = self._get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 獲取市場 ID
            cursor.execute("""
                SELECT id FROM markets WHERE conditionId = %s
            """, (condition_id,))
            
            market = cursor.fetchone()
            if not market:
                logger.warning(f"Market not found for condition_id: {condition_id}")
                return
            
            market_id = market['id']
            
            # 批量插入價格數據
            insert_query = """
                INSERT INTO market_price_history 
                (market_id, condition_id, price, volume, timestamp)
                VALUES (%s, %s, %s, %s, FROM_UNIXTIME(%s))
                ON DUPLICATE KEY UPDATE
                    price = VALUES(price),
                    volume = VALUES(volume)
            """
            
            values = [
                (market_id, condition_id, point['price'], point['volume'], point['timestamp'])
                for point in price_history
            ]
            
            cursor.executemany(insert_query, values)
            conn.commit()
            
            logger.info(f"✅ Saved {len(price_history)} price points for condition {condition_id}")
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error saving price history: {e}")
            raise
        finally:
            cursor.close()
            conn.close()
    
    def sync_market_price_history(self, condition_id: str, days_back: int = 30):
        """
        同步市場的價格歷史（從當前時間往回 N 天）
        
        Args:
            condition_id: 市場條件 ID
            days_back: 往回同步的天數
        """
        logger.info(f"Syncing price history for condition {condition_id} (last {days_back} days)")
        
        # 計算時間範圍
        end_time = int(time.time())
        start_time = end_time - (days_back * 24 * 3600)
        
        # 獲取價格數據
        price_history = self.get_market_price_from_trades(condition_id, start_time, end_time)
        
        if not price_history:
            logger.warning(f"No price data found for condition {condition_id}")
            return
        
        # 聚合價格數據（每 15 分鐘一個數據點，獲取更多數據點）
        aggregated_prices = self.aggregate_price_by_interval(price_history, interval_seconds=900)
        
        # 保存到資料庫
        self.save_price_history(condition_id, aggregated_prices)
        
        logger.info(f"✅ Synced {len(aggregated_prices)} price points for condition {condition_id}")
    
    def sync_all_active_markets(self, days_back: int = 7):
        """
        同步所有活躍市場的價格歷史
        
        Args:
            days_back: 往回同步的天數
        """
        logger.info(f"Syncing price history for all active markets (last {days_back} days)")
        
        conn = self._get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 獲取所有活躍市場
            cursor.execute("""
                SELECT conditionId, title
                FROM markets
                WHERE isActive = TRUE
                ORDER BY totalVolume DESC
                LIMIT 50
            """)
            
            markets = cursor.fetchall()
            logger.info(f"Found {len(markets)} active markets to sync")
            
            synced_count = 0
            for market in markets:
                condition_id = market['conditionId']
                title = market['title']
                
                try:
                    logger.info(f"Syncing market: {title[:50]}...")
                    self.sync_market_price_history(condition_id, days_back)
                    synced_count += 1
                    
                    # 避免請求過快
                    time.sleep(0.5)
                    
                except Exception as e:
                    logger.error(f"Error syncing market {condition_id}: {e}")
                    continue
            
            logger.info(f"✅ Successfully synced {synced_count}/{len(markets)} markets")
            
        finally:
            cursor.close()
            conn.close()


# 測試代碼
if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    service = PriceSyncService()
    
    # 同步所有活躍市場的價格歷史（過去 7 天）
    service.sync_all_active_markets(days_back=7)
