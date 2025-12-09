"""
歷史數據同步服務
從 Polymarket Subgraph 同步歷史交易數據到本地資料庫
"""

import asyncio
import logging
from datetime import datetime, timedelta
from decimal import Decimal
import mysql.connector
from mysql.connector import pooling
import os
from subgraph_client import PolymarketSubgraphClient

logger = logging.getLogger(__name__)


class SyncService:
    """歷史數據同步服務"""
    
    def __init__(self):
        self.subgraph_client = PolymarketSubgraphClient()
        self.db_pool = self._create_db_pool()
        
    def _create_db_pool(self):
        """創建資料庫連接池"""
        db_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'user': os.getenv('DB_USER', 'root'),
            'password': os.getenv('DB_PASSWORD', ''),
            'database': os.getenv('DB_NAME', 'polymarket_insights'),
            'pool_name': 'sync_pool',
            'pool_size': 5
        }
        
        # 從 DATABASE_URL 解析配置
        database_url = os.getenv('DATABASE_URL')
        if database_url:
            # mysql://user:password@host:port/database
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
    
    async def sync_whale_traders(self, min_volume=1000):
        """
        同步大額交易者數據
        
        Args:
            min_volume: 最小交易量（USDC）
        """
        logger.info(f"Starting to sync whale traders (min volume: ${min_volume})...")
        
        # 從 Subgraph 獲取大額交易者
        whales = await self.subgraph_client.get_whale_traders(min_volume=min_volume)
        
        if not whales:
            logger.warning("No whale traders found")
            return
        
        logger.info(f"Found {len(whales)} whale traders")
        
        # 保存到資料庫
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        synced_count = 0
        
        try:
            for whale in whales:
                address = whale['user'].lower()
                total_bought = Decimal(whale['totalBought']) / Decimal(10**6)  # Convert from USDC decimals
                realized_pnl = Decimal(whale.get('realizedPnl', 0)) / Decimal(10**6)
                
                # 檢查地址是否已存在
                cursor.execute(
                    "SELECT id FROM addresses WHERE address = %s",
                    (address,)
                )
                result = cursor.fetchone()
                
                if result:
                    # 更新現有地址
                    cursor.execute("""
                        UPDATE addresses 
                        SET total_volume = %s,
                            last_active_at = NOW(),
                            updated_at = NOW()
                        WHERE address = %s
                    """, (total_bought, address))
                else:
                    # 插入新地址
                    cursor.execute("""
                        INSERT INTO addresses (
                            address, 
                            total_volume,
                            first_seen_at,
                            last_active_at
                        ) VALUES (%s, %s, NOW(), NOW())
                    """, (address, total_bought))
                
                synced_count += 1
                
                if synced_count % 10 == 0:
                    logger.info(f"Synced {synced_count}/{len(whales)} whale traders...")
            
            conn.commit()
            logger.info(f"✅ Successfully synced {synced_count} whale traders")
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error syncing whale traders: {e}")
            raise
        finally:
            cursor.close()
            conn.close()
    
    async def sync_market_activity(self, condition_id, market_id):
        """
        同步特定市場的交易活動
        
        Args:
            condition_id: Polymarket condition ID
            market_id: 本地資料庫中的市場 ID
        """
        logger.info(f"Syncing activity for market {market_id} (condition: {condition_id})...")
        
        # 獲取市場活動數據
        activity = await self.subgraph_client.get_market_activity(condition_id)
        
        splits = activity.get('splits', [])
        merges = activity.get('merges', [])
        redemptions = activity.get('redemptions', [])
        
        logger.info(f"Found {len(splits)} splits, {len(merges)} merges, {len(redemptions)} redemptions")
        
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        synced_trades = 0
        
        try:
            # 處理 splits（買入）
            for split in splits:
                address = split['stakeholder'].lower()
                amount = Decimal(split['amount']) / Decimal(10**6)
                timestamp = datetime.fromtimestamp(int(split['timestamp']))
                tx_hash = split['id']
                
                # 確保地址存在
                address_id = self._ensure_address_exists(cursor, address)
                
                # 插入交易記錄
                try:
                    cursor.execute("""
                        INSERT INTO address_trades (
                            address_id,
                            market_id,
                            tx_hash,
                            trade_type,
                            amount,
                            side,
                            timestamp,
                            is_whale
                        ) VALUES (%s, %s, %s, 'split', %s, 'buy', %s, %s)
                        ON DUPLICATE KEY UPDATE
                            amount = VALUES(amount),
                            is_whale = VALUES(is_whale)
                    """, (address_id, market_id, tx_hash, amount, timestamp, amount >= 100))
                    synced_trades += 1
                except mysql.connector.IntegrityError:
                    # 交易已存在，跳過
                    pass
            
            # 處理 merges（賣出）
            for merge in merges:
                address = merge['stakeholder'].lower()
                amount = Decimal(merge['amount']) / Decimal(10**6)
                timestamp = datetime.fromtimestamp(int(merge['timestamp']))
                tx_hash = merge['id']
                
                # 確保地址存在
                address_id = self._ensure_address_exists(cursor, address)
                
                # 插入交易記錄
                try:
                    cursor.execute("""
                        INSERT INTO address_trades (
                            address_id,
                            market_id,
                            tx_hash,
                            trade_type,
                            amount,
                            side,
                            timestamp,
                            is_whale
                        ) VALUES (%s, %s, %s, 'merge', %s, 'sell', %s, %s)
                        ON DUPLICATE KEY UPDATE
                            amount = VALUES(amount),
                            is_whale = VALUES(is_whale)
                    """, (address_id, market_id, tx_hash, amount, timestamp, amount >= 100))
                    synced_trades += 1
                except mysql.connector.IntegrityError:
                    # 交易已存在，跳過
                    pass
            
            conn.commit()
            logger.info(f"✅ Successfully synced {synced_trades} trades for market {market_id}")
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error syncing market activity: {e}")
            raise
        finally:
            cursor.close()
            conn.close()
    
    def _ensure_address_exists(self, cursor, address):
        """確保地址存在於資料庫中，如果不存在則創建"""
        cursor.execute("SELECT id FROM addresses WHERE address = %s", (address,))
        result = cursor.fetchone()
        
        if result:
            return result[0]
        
        # 創建新地址
        cursor.execute("""
            INSERT INTO addresses (address, first_seen_at, last_active_at)
            VALUES (%s, NOW(), NOW())
        """, (address,))
        
        return cursor.lastrowid
    
    async def sync_top_markets(self, limit=5):
        """
        同步資料庫中交易量最大的前 N 個市場
        
        Args:
            limit: 同步的市場數量
        """
        logger.info(f"Syncing top {limit} markets by trade count...")
        
        conn = self._get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 獲取交易量最大的市場
            cursor.execute("""
                SELECT m.id, m.condition_id, m.title, COUNT(t.id) as trade_count
                FROM markets m
                LEFT JOIN trades t ON m.id = t.market_id
                WHERE m.condition_id IS NOT NULL
                GROUP BY m.id
                ORDER BY trade_count DESC
                LIMIT %s
            """, (limit,))
            
            markets = cursor.fetchall()
            
            if not markets:
                logger.warning("No markets with condition_id found")
                return
            
            logger.info(f"Found {len(markets)} markets to sync")
            
            # 同步每個市場的活動
            for market in markets:
                if market['condition_id']:
                    logger.info(f"Syncing market: {market['title']}")
                    await self.sync_market_activity(
                        market['condition_id'],
                        market['id']
                    )
                    
                    # 避免請求過快
                    await asyncio.sleep(1)
            
            logger.info(f"✅ Completed syncing {len(markets)} markets")
            
        except Exception as e:
            logger.error(f"Error syncing top markets: {e}")
            raise
        finally:
            cursor.close()
            conn.close()
    
    async def update_address_statistics(self):
        """更新所有地址的統計數據"""
        logger.info("Updating address statistics...")
        
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        try:
            # 更新交易次數和總交易量
            cursor.execute("""
                UPDATE addresses a
                SET 
                    total_trades = (
                        SELECT COUNT(*) 
                        FROM address_trades at 
                        WHERE at.address_id = a.id
                    ),
                    total_volume = (
                        SELECT COALESCE(SUM(amount), 0)
                        FROM address_trades at
                        WHERE at.address_id = a.id AND at.side = 'buy'
                    ),
                    avg_trade_size = (
                        SELECT COALESCE(AVG(amount), 0)
                        FROM address_trades at
                        WHERE at.address_id = a.id
                    ),
                    last_active_at = (
                        SELECT MAX(timestamp)
                        FROM address_trades at
                        WHERE at.address_id = a.id
                    )
            """)
            
            conn.commit()
            logger.info(f"✅ Updated statistics for all addresses")
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error updating address statistics: {e}")
            raise
        finally:
            cursor.close()
            conn.close()


# 測試代碼
if __name__ == "__main__":
    import sys
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    async def main():
        service = SyncService()
        
        # 同步大額交易者
        await service.sync_whale_traders(min_volume=1000)
        
        # 更新地址統計
        await service.update_address_statistics()
        
        logger.info("✅ Sync completed!")
    
    asyncio.run(main())
