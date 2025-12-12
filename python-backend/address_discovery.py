"""
地址自動發現系統
從交易數據中提取所有唯一地址，計算統計數據，自動標記巨鯨
"""

import os
import logging
import mysql.connector
from mysql.connector import Error
from typing import List, Dict, Set
from datetime import datetime
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class AddressDiscovery:
    """地址自動發現系統"""
    
    def __init__(self):
        # Database configuration
        self.db_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'user': os.getenv('DB_USER', 'root'),
            'password': os.getenv('DB_PASSWORD', ''),
            'database': os.getenv('DB_NAME', 'polymarket'),
        }
        
        # Parse DATABASE_URL if available
        database_url = os.getenv('DATABASE_URL')
        if database_url:
            self._parse_database_url(database_url)
        
        # 巨鯨閾值（總交易量 > $100,000）
        self.whale_threshold = 100000 * 1000000  # 以最小單位（6 位小數）
        
        logger.info(f"AddressDiscovery initialized")
        logger.info(f"Database: {self.db_config['host']}/{self.db_config['database']}")
        logger.info(f"Whale threshold: ${self.whale_threshold / 1000000:,.2f}")
    
    def _parse_database_url(self, url: str):
        """解析 DATABASE_URL 環境變量"""
        try:
            # mysql://user:password@host:port/database
            parsed = urlparse(url)
            
            self.db_config['host'] = parsed.hostname
            self.db_config['user'] = parsed.username
            self.db_config['password'] = parsed.password
            self.db_config['database'] = parsed.path.lstrip('/')
            
            if parsed.port:
                self.db_config['port'] = parsed.port
            
            logger.info(f"Parsed DATABASE_URL: {parsed.hostname}/{parsed.path.lstrip('/')}")
        except Exception as e:
            logger.error(f"Error parsing DATABASE_URL: {e}")
    
    def _get_db_connection(self):
        """獲取數據庫連接"""
        try:
            connection = mysql.connector.connect(**self.db_config)
            return connection
        except Error as e:
            logger.error(f"Error connecting to database: {e}")
            raise
    
    def discover_addresses(self) -> Dict[str, any]:
        """
        從 trades 表發現所有唯一地址
        返回統計信息
        """
        logger.info("=" * 60)
        logger.info("Starting address discovery...")
        logger.info("=" * 60)
        
        connection = None
        try:
            connection = self._get_db_connection()
            cursor = connection.cursor(dictionary=True)
            
            # 1. 提取所有唯一地址（maker + taker）
            logger.info("Step 1: Extracting unique addresses from trades...")
            
            query = """
                SELECT DISTINCT address FROM (
                    SELECT makerAddress as address FROM trades WHERE makerAddress IS NOT NULL
                    UNION
                    SELECT takerAddress as address FROM trades WHERE takerAddress IS NOT NULL
                ) AS all_addresses
            """
            
            cursor.execute(query)
            unique_addresses = [row['address'] for row in cursor.fetchall()]
            
            logger.info(f"Found {len(unique_addresses)} unique addresses")
            
            # 2. 計算每個地址的統計數據
            logger.info("Step 2: Calculating statistics for each address...")
            
            address_stats = []
            for i, address in enumerate(unique_addresses, 1):
                if i % 100 == 0:
                    logger.info(f"Processing address {i}/{len(unique_addresses)}...")
                
                stats = self._calculate_address_stats(cursor, address)
                if stats:
                    address_stats.append(stats)
            
            logger.info(f"Calculated statistics for {len(address_stats)} addresses")
            
            # 3. 批量插入或更新 addresses 表
            logger.info("Step 3: Saving addresses to database...")
            
            saved_count = self._save_addresses(connection, address_stats)
            
            logger.info(f"Successfully saved {saved_count} addresses")
            
            # 4. 統計巨鯨數量
            whale_count = sum(1 for stats in address_stats if stats['is_whale'])
            
            logger.info("=" * 60)
            logger.info("Address discovery completed!")
            logger.info(f"Total addresses: {len(unique_addresses)}")
            logger.info(f"Addresses with stats: {len(address_stats)}")
            logger.info(f"Whale addresses: {whale_count}")
            logger.info("=" * 60)
            
            return {
                'total_addresses': len(unique_addresses),
                'addresses_with_stats': len(address_stats),
                'whale_count': whale_count,
                'saved_count': saved_count
            }
            
        except Exception as e:
            logger.error(f"Error in address discovery: {e}")
            raise
        finally:
            if connection and connection.is_connected():
                connection.close()
    
    def _calculate_address_stats(self, cursor, address: str) -> Dict:
        """計算單個地址的統計數據"""
        try:
            # 查詢該地址的所有交易（作為 maker 或 taker）
            query = """
                SELECT 
                    COUNT(*) as total_trades,
                    SUM(CASE WHEN makerAddress = %s THEN makerAmount ELSE takerAmount END) as total_volume,
                    AVG(CASE WHEN makerAddress = %s THEN makerAmount ELSE takerAmount END) as avg_trade_size,
                    MIN(timestamp) as first_seen,
                    MAX(timestamp) as last_active
                FROM trades
                WHERE makerAddress = %s OR takerAddress = %s
            """
            
            cursor.execute(query, (address, address, address, address))
            result = cursor.fetchone()
            
            if not result or result['total_trades'] == 0:
                return None
            
            total_volume = float(result['total_volume'] or 0)
            is_whale = total_volume >= self.whale_threshold
            
            return {
                'address': address,
                'total_trades': result['total_trades'],
                'total_volume': total_volume,
                'avg_trade_size': float(result['avg_trade_size'] or 0),
                'first_seen': result['first_seen'],
                'last_active': result['last_active'],
                'is_whale': is_whale
            }
            
        except Exception as e:
            logger.error(f"Error calculating stats for address {address}: {e}")
            return None
    
    def _save_addresses(self, connection, address_stats: List[Dict]) -> int:
        """批量保存地址到數據庫"""
        try:
            cursor = connection.cursor()
            
            # 使用 INSERT ... ON DUPLICATE KEY UPDATE 語法
            query = """
                INSERT INTO addresses 
                    (address, first_seen_at, last_active_at, total_trades, total_volume, 
                     avg_trade_size, created_at, updated_at)
                VALUES 
                    (%s, %s, %s, %s, %s, %s, NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                    last_active_at = VALUES(last_active_at),
                    total_trades = VALUES(total_trades),
                    total_volume = VALUES(total_volume),
                    avg_trade_size = VALUES(avg_trade_size),
                    updated_at = NOW()
            """
            
            # 準備批量插入數據
            values = []
            for stats in address_stats:
                values.append((
                    stats['address'],
                    stats['first_seen'],
                    stats['last_active'],
                    stats['total_trades'],
                    stats['total_volume'],
                    stats['avg_trade_size']
                ))
            
            # 批量執行
            cursor.executemany(query, values)
            connection.commit()
            
            saved_count = cursor.rowcount
            logger.info(f"Batch insert completed: {saved_count} rows affected")
            
            return saved_count
            
        except Exception as e:
            logger.error(f"Error saving addresses: {e}")
            connection.rollback()
            raise


def main():
    """主函數"""
    # 配置日誌
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # 創建地址發現實例
    discovery = AddressDiscovery()
    
    # 執行地址發現
    result = discovery.discover_addresses()
    
    logger.info(f"Address discovery result: {result}")


if __name__ == "__main__":
    main()
