"""
Polymarket Orderbook Collector
從 Goldsky Orderbook Subgraph 收集實時訂單填充事件
解決數據時效性、地址覆蓋率和數據完整性問題
"""

from gql import gql, Client
from gql.transport.aiohttp import AIOHTTPTransport
import os
import logging
import asyncio
from datetime import datetime
from typing import List, Dict, Optional
import mysql.connector
from mysql.connector import Error

logger = logging.getLogger(__name__)

# Disable GQL debug logging
logging.getLogger('gql').setLevel(logging.WARNING)
logging.getLogger('graphql').setLevel(logging.WARNING)


class OrderbookCollector:
    """Orderbook Subgraph 收集器"""
    
    def __init__(self):
        # Goldsky Orderbook Subgraph endpoint
        self.orderbook_endpoint = os.getenv(
            'POLYMARKET_ORDERBOOK_SUBGRAPH_URL',
            'https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/orderbook-subgraph/0.0.1/gn'
        )
        
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
        
        # GraphQL client
        self.client = None
        
        # Service name for sync_state tracking
        self.service_name = 'orderbook_collector'
        
        # Batch size for processing
        self.batch_size = 1000
        
        # Retry configuration
        self.max_retries = 3
        self.retry_delay = 5  # seconds
        
        logger.info(f"OrderbookCollector initialized")
        logger.info(f"Orderbook endpoint: {self.orderbook_endpoint}")
        logger.info(f"Database: {self.db_config.get('host')}/{self.db_config.get('database')}")
    
    def _parse_database_url(self, url: str):
        """解析 DATABASE_URL 環境變量"""
        # Format: mysql://user:password@host:port/database
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            
            self.db_config['host'] = parsed.hostname
            self.db_config['user'] = parsed.username
            self.db_config['password'] = parsed.password
            self.db_config['database'] = parsed.path.lstrip('/')
            
            if parsed.port:
                self.db_config['port'] = parsed.port
                
            logger.info(f"Parsed DATABASE_URL: {self.db_config['host']}/{self.db_config['database']}")
        except Exception as e:
            logger.error(f"Error parsing DATABASE_URL: {e}")
    
    def _create_client(self):
        """創建 GraphQL 客戶端"""
        transport = AIOHTTPTransport(url=self.orderbook_endpoint)
        return Client(transport=transport, fetch_schema_from_transport=False)
    
    async def _ensure_client(self):
        """確保客戶端已初始化"""
        if self.client is None:
            self.client = self._create_client()
    
    def _get_db_connection(self):
        """獲取數據庫連接"""
        try:
            connection = mysql.connector.connect(**self.db_config)
            if connection.is_connected():
                return connection
        except Error as e:
            logger.error(f"Error connecting to MySQL: {e}")
            return None
    
    def _get_last_sync_timestamp(self) -> int:
        """從 sync_state 表獲取最後同步的時間戳"""
        connection = self._get_db_connection()
        if not connection:
            return 0
        
        try:
            cursor = connection.cursor(dictionary=True)
            query = """
                SELECT lastTimestamp FROM sync_state 
                WHERE serviceName = %s
            """
            cursor.execute(query, (self.service_name,))
            result = cursor.fetchone()
            
            if result:
                timestamp = result['lastTimestamp']
                logger.info(f"Last sync timestamp: {timestamp} ({datetime.fromtimestamp(timestamp)})")
                return timestamp
            else:
                logger.info("No previous sync state found, starting from 0")
                return 0
                
        except Error as e:
            logger.error(f"Error getting last sync timestamp: {e}")
            return 0
        finally:
            if connection.is_connected():
                cursor.close()
                connection.close()
    
    def _update_sync_state(self, last_timestamp: int, total_processed: int, 
                          batch_size: int, status: str = 'idle', error_message: str = None):
        """更新 sync_state 表"""
        connection = self._get_db_connection()
        if not connection:
            return False
        
        try:
            cursor = connection.cursor()
            
            # Upsert sync_state
            query = """
                INSERT INTO sync_state 
                    (serviceName, lastTimestamp, lastSyncAt, status, errorMessage, 
                     totalProcessed, lastBatchSize, createdAt, updatedAt)
                VALUES 
                    (%s, %s, NOW(), %s, %s, %s, %s, NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                    lastTimestamp = VALUES(lastTimestamp),
                    lastSyncAt = VALUES(lastSyncAt),
                    status = VALUES(status),
                    errorMessage = VALUES(errorMessage),
                    totalProcessed = VALUES(totalProcessed),
                    lastBatchSize = VALUES(lastBatchSize),
                    updatedAt = NOW()
            """
            
            cursor.execute(query, (
                self.service_name,
                last_timestamp,
                status,
                error_message,
                total_processed,
                batch_size
            ))
            
            connection.commit()
            logger.info(f"Updated sync_state: timestamp={last_timestamp}, processed={total_processed}")
            return True
            
        except Error as e:
            logger.error(f"Error updating sync_state: {e}")
            return False
        finally:
            if connection.is_connected():
                cursor.close()
                connection.close()
    
    async def get_order_filled_events(self, start_timestamp: int, limit: int = 1000) -> List[Dict]:
        """
        獲取訂單填充事件
        
        Args:
            start_timestamp: 開始時間戳
            limit: 返回結果數量限制
        
        Returns:
            訂單填充事件列表
        """
        await self._ensure_client()
        
        query = gql("""
            query GetOrderFilledEvents($startTimestamp: BigInt!, $limit: Int!) {
                orderFilledEvents(
                    where: { timestamp_gte: $startTimestamp }
                    orderBy: timestamp
                    orderDirection: asc
                    first: $limit
                ) {
                    id
                    transactionHash
                    timestamp
                    maker
                    taker
                    makerAssetId
                    takerAssetId
                    makerAmountFilled
                    takerAmountFilled
                    fee
                }
            }
        """)
        
        params = {
            "startTimestamp": str(start_timestamp),
            "limit": limit
        }
        
        try:
            async with self.client as session:
                result = await session.execute(query, variable_values=params)
                events = result.get('orderFilledEvents', [])
                logger.info(f"Retrieved {len(events)} order filled events from timestamp {start_timestamp}")
                return events
        except Exception as e:
            logger.error(f"Error fetching order filled events: {e}")
            raise
    
    def _process_events_to_trades(self, events: List[Dict]) -> List[Dict]:
        """
        將訂單填充事件轉換為交易記錄格式
        
        Args:
            events: 訂單填充事件列表
        
        Returns:
            交易記錄列表
        """
        trades = []
        
        for event in events:
            try:
                # 解析 asset IDs 以確定交易方向
                maker_asset_id = event['makerAssetId']
                taker_asset_id = event['takerAssetId']
                
                # 簡化邏輯：假設較小的 asset ID 是 YES token
                # 實際應該查詢 market 數據來確定
                side = 'YES' if maker_asset_id < taker_asset_id else 'NO'
                
                # 計算價格和金額
                maker_amount = int(event['makerAmountFilled'])
                taker_amount = int(event['takerAmountFilled'])
                
                # 價格 = taker_amount / maker_amount (以分為單位)
                if maker_amount > 0:
                    price = int((taker_amount / maker_amount) * 100)  # 轉換為百分比
                else:
                    price = 0
                
                # 金額（以 USDC 的最小單位，6 decimals）
                amount = taker_amount
                
                trade = {
                    'tradeId': event['id'],
                    'transactionHash': event['transactionHash'],
                    'timestamp': int(event['timestamp']),
                    'makerAddress': event['maker'].lower(),
                    'takerAddress': event['taker'].lower(),
                    'makerAssetId': maker_asset_id,
                    'takerAssetId': taker_asset_id,
                    'makerAmount': maker_amount,
                    'takerAmount': taker_amount,
                    'side': side,
                    'price': price,
                    'amount': amount,
                    'fee': int(event.get('fee', 0)),
                }
                
                trades.append(trade)
                
            except Exception as e:
                logger.error(f"Error processing event {event.get('id')}: {e}")
                continue
        
        logger.info(f"Processed {len(trades)} trades from {len(events)} events")
        return trades
    
    def _save_trades_to_db(self, trades: List[Dict]) -> int:
        """
        保存交易記錄到數據庫
        
        Args:
            trades: 交易記錄列表
        
        Returns:
            成功保存的記錄數
        """
        if not trades:
            return 0
        
        connection = self._get_db_connection()
        if not connection:
            return 0
        
        try:
            cursor = connection.cursor()
            
            # 批量插入交易記錄
            query = """
                INSERT INTO trades 
                    (tradeId, transactionHash, timestamp, 
                     makerAddress, takerAddress, 
                     makerAssetId, takerAssetId, 
                     makerAmount, takerAmount, 
                     side, price, amount, fee, 
                     isWhale, isSuspicious, createdAt)
                VALUES 
                    (%s, %s, FROM_UNIXTIME(%s), 
                     %s, %s, 
                     %s, %s, 
                     %s, %s, 
                     %s, %s, %s, %s, 
                     FALSE, FALSE, NOW())
                ON DUPLICATE KEY UPDATE
                    transactionHash = VALUES(transactionHash),
                    timestamp = VALUES(timestamp),
                    makerAddress = VALUES(makerAddress),
                    takerAddress = VALUES(takerAddress)
            """
            
            # 準備批量插入數據
            values = []
            for trade in trades:
                values.append((
                    trade['tradeId'],
                    trade['transactionHash'],
                    trade['timestamp'],
                    trade['makerAddress'],
                    trade['takerAddress'],
                    trade['makerAssetId'],
                    trade['takerAssetId'],
                    trade['makerAmount'],
                    trade['takerAmount'],
                    trade['side'],
                    trade['price'],
                    trade['amount'],
                    trade['fee'],
                ))
            
            # 執行批量插入
            cursor.executemany(query, values)
            connection.commit()
            
            inserted_count = cursor.rowcount
            logger.info(f"Saved {inserted_count} trades to database")
            return inserted_count
            
        except Error as e:
            logger.error(f"Error saving trades to database: {e}")
            connection.rollback()
            return 0
        finally:
            if connection.is_connected():
                cursor.close()
                connection.close()
    
    async def collect_with_retry(self, start_timestamp: int) -> tuple[int, int]:
        """
        帶重試機制的收集函數
        
        Args:
            start_timestamp: 開始時間戳
        
        Returns:
            (處理的事件數, 最後的時間戳)
        """
        for attempt in range(self.max_retries):
            try:
                # 獲取訂單填充事件
                events = await self.get_order_filled_events(start_timestamp, self.batch_size)
                
                if not events:
                    logger.info("No new events found")
                    return 0, start_timestamp
                
                # 轉換為交易記錄
                trades = self._process_events_to_trades(events)
                
                # 保存到數據庫
                saved_count = self._save_trades_to_db(trades)
                
                # 獲取最後的時間戳
                last_timestamp = int(events[-1]['timestamp'])
                
                return len(events), last_timestamp
                
            except Exception as e:
                logger.error(f"Attempt {attempt + 1}/{self.max_retries} failed: {e}")
                
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay * (2 ** attempt))  # 指數退避
                else:
                    raise
    
    async def run_collection(self):
        """運行一次完整的收集流程"""
        logger.info("=" * 60)
        logger.info("Starting orderbook collection...")
        logger.info("=" * 60)
        
        try:
            # 更新狀態為 running
            self._update_sync_state(0, 0, 0, status='running')
            
            # 獲取最後同步的時間戳
            last_timestamp = self._get_last_sync_timestamp()
            
            # 收集數據
            total_processed = 0
            current_timestamp = last_timestamp
            
            while True:
                # 收集一批數據
                processed, new_timestamp = await self.collect_with_retry(current_timestamp)
                
                if processed == 0:
                    break
                
                total_processed += processed
                current_timestamp = new_timestamp + 1  # 下次從下一秒開始
                
                # 更新同步狀態
                self._update_sync_state(
                    new_timestamp,
                    total_processed,
                    processed,
                    status='running'
                )
                
                # 如果處理的數量少於批次大小，說明已經到最新數據
                if processed < self.batch_size:
                    break
            
            # 更新最終狀態為 idle
            self._update_sync_state(
                current_timestamp - 1,
                total_processed,
                0,
                status='idle'
            )
            
            logger.info(f"Collection completed: {total_processed} events processed")
            logger.info("=" * 60)
            
            return total_processed
            
        except Exception as e:
            logger.error(f"Collection failed: {e}")
            
            # 更新狀態為 error
            self._update_sync_state(
                last_timestamp,
                0,
                0,
                status='error',
                error_message=str(e)
            )
            
            raise


# 測試代碼
if __name__ == "__main__":
    import sys
    
    # 配置日誌
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    async def test():
        collector = OrderbookCollector()
        
        try:
            # 運行收集
            total = await collector.run_collection()
            print(f"\n✅ Collection successful: {total} events processed")
        except Exception as e:
            print(f"\n❌ Collection failed: {e}")
            sys.exit(1)
    
    # 運行測試
    asyncio.run(test())
