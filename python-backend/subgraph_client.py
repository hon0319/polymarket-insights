"""
Polymarket Subgraph Client
整合 Polymarket 的 Subgraph API，獲取歷史交易數據
"""

from gql import gql, Client
from gql.transport.aiohttp import AIOHTTPTransport
import os
import logging

logger = logging.getLogger(__name__)


class PolymarketSubgraphClient:
    """Polymarket Subgraph 客戶端"""
    
    def __init__(self):
        # Goldsky hosted subgraph endpoints (官方端點)
        self.pnl_endpoint = os.getenv(
            'POLYMARKET_PNL_SUBGRAPH_URL',
            'https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/pnl-subgraph/0.0.14/gn'
        )
        self.activity_endpoint = os.getenv(
            'POLYMARKET_ACTIVITY_SUBGRAPH_URL',
            'https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/activity-subgraph/0.0.4/gn'
        )
        self.positions_endpoint = os.getenv(
            'POLYMARKET_POSITIONS_SUBGRAPH_URL',
            'https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/positions-subgraph/0.0.7/gn'
        )
        
        # Initialize clients
        self.pnl_client = None
        self.activity_client = None
        self.positions_client = None
        
        logger.info(f"Polymarket Subgraph Client initialized")
        logger.info(f"PNL endpoint: {self.pnl_endpoint}")
        logger.info(f"Activity endpoint: {self.activity_endpoint}")
        logger.info(f"Positions endpoint: {self.positions_endpoint}")
    
    def _create_client(self, endpoint):
        """創建 GraphQL 客戶端"""
        transport = AIOHTTPTransport(url=endpoint)
        return Client(transport=transport, fetch_schema_from_transport=False)
    
    async def _ensure_clients(self):
        """確保客戶端已初始化"""
        if self.pnl_client is None:
            self.pnl_client = self._create_client(self.pnl_endpoint)
        if self.activity_client is None:
            self.activity_client = self._create_client(self.activity_endpoint)
        if self.positions_client is None:
            self.positions_client = self._create_client(self.positions_endpoint)
    
    async def get_user_positions(self, user_address):
        """
        獲取用戶所有持倉
        
        Args:
            user_address: 用戶地址（以太坊地址）
        
        Returns:
            用戶持倉列表
        """
        await self._ensure_clients()
        
        query = gql("""
            query GetUserPositions($userAddress: String!) {
                userPositions(
                    where: { user: $userAddress }
                    orderBy: totalBought
                    orderDirection: desc
                    first: 1000
                ) {
                    id
                    user
                    tokenId
                    amount
                    avgPrice
                    realizedPnl
                    totalBought
                }
            }
        """)
        
        params = {"userAddress": user_address.lower()}
        
        try:
            async with self.pnl_client as session:
                result = await session.execute(query, variable_values=params)
                logger.info(f"Retrieved {len(result['userPositions'])} positions for {user_address}")
                return result['userPositions']
        except Exception as e:
            logger.error(f"Error fetching user positions: {e}")
            return []
    
    async def get_market_activity(self, condition_id, start_time=0, limit=1000):
        """
        獲取市場的所有交易活動
        
        Args:
            condition_id: 市場條件 ID
            start_time: 開始時間（Unix 時間戳）
            limit: 返回結果數量限制
        
        Returns:
            包含 splits 和 merges 的字典
        """
        await self._ensure_clients()
        
        query = gql("""
            query GetMarketActivity($conditionId: String!, $startTime: BigInt!, $limit: Int!) {
                splits(
                    where: { 
                        condition: $conditionId
                        timestamp_gte: $startTime
                    }
                    orderBy: timestamp
                    orderDirection: asc
                    first: $limit
                ) {
                    id
                    timestamp
                    stakeholder
                    amount
                    condition
                }
                
                merges(
                    where: { 
                        condition: $conditionId
                        timestamp_gte: $startTime
                    }
                    orderBy: timestamp
                    orderDirection: asc
                    first: $limit
                ) {
                    id
                    timestamp
                    stakeholder
                    amount
                    condition
                }
                
                redemptions(
                    where: { 
                        condition: $conditionId
                        timestamp_gte: $startTime
                    }
                    orderBy: timestamp
                    orderDirection: asc
                    first: $limit
                ) {
                    id
                    timestamp
                    redeemer
                    payout
                    condition
                }
            }
        """)
        
        params = {
            "conditionId": condition_id,
            "startTime": str(start_time),
            "limit": limit
        }
        
        try:
            async with self.activity_client as session:
                result = await session.execute(query, variable_values=params)
                logger.info(f"Retrieved activity for condition {condition_id}: "
                          f"{len(result.get('splits', []))} splits, "
                          f"{len(result.get('merges', []))} merges, "
                          f"{len(result.get('redemptions', []))} redemptions")
                return result
        except Exception as e:
            logger.error(f"Error fetching market activity: {e}")
            return {'splits': [], 'merges': [], 'redemptions': []}
    
    async def get_whale_traders(self, min_volume=100000):
        """
        獲取大額交易者（最小交易量 $100,000）
        
        Args:
            min_volume: 最小交易量（USDC）
        
        Returns:
            大額交易者列表
        """
        await self._ensure_clients()
        
        query = gql("""
            query GetWhaleTraders($minVolume: BigInt!) {
                userPositions(
                    where: { totalBought_gte: $minVolume }
                    orderBy: totalBought
                    orderDirection: desc
                    first: 100
                ) {
                    user
                    totalBought
                    realizedPnl
                }
            }
        """)
        
        # Convert to USDC decimals (6 decimals)
        params = {"minVolume": str(min_volume * 10**6)}
        
        try:
            async with self.pnl_client as session:
                result = await session.execute(query, variable_values=params)
                logger.info(f"Retrieved {len(result['userPositions'])} whale traders")
                return result['userPositions']
        except Exception as e:
            logger.error(f"Error fetching whale traders: {e}")
            return []
    
    async def get_early_traders(self, condition_id, end_time):
        """
        獲取早期交易者（在特定時間前就下注的地址）
        
        Args:
            condition_id: 市場條件 ID
            end_time: 截止時間（Unix 時間戳）
        
        Returns:
            早期交易者列表
        """
        await self._ensure_clients()
        
        query = gql("""
            query GetEarlyTraders($conditionId: String!, $endTime: BigInt!) {
                splits(
                    where: { 
                        condition: $conditionId
                        timestamp_lte: $endTime
                    }
                    orderBy: amount
                    orderDirection: desc
                    first: 50
                ) {
                    id
                    timestamp
                    stakeholder
                    amount
                }
            }
        """)
        
        params = {
            "conditionId": condition_id,
            "endTime": str(end_time)
        }
        
        try:
            async with self.activity_client as session:
                result = await session.execute(query, variable_values=params)
                logger.info(f"Retrieved {len(result['splits'])} early traders for condition {condition_id}")
                return result['splits']
        except Exception as e:
            logger.error(f"Error fetching early traders: {e}")
            return []
    
    async def test_connection(self):
        """測試 Subgraph 連接"""
        logger.info("Testing Subgraph connections...")
        
        # Test PNL subgraph
        try:
            await self._ensure_clients()
            query = gql("""
                query TestQuery {
                    userPositions(first: 1) {
                        id
                        user
                    }
                }
            """)
            async with self.pnl_client as session:
                result = await session.execute(query)
                logger.info(f"✅ PNL Subgraph connection successful")
                return True
        except Exception as e:
            logger.error(f"❌ PNL Subgraph connection failed: {e}")
            return False


# 測試代碼
if __name__ == "__main__":
    import asyncio
    
    logging.basicConfig(level=logging.INFO)
    
    async def test():
        client = PolymarketSubgraphClient()
        
        # 測試連接
        success = await client.test_connection()
        
        if success:
            # 測試獲取大額交易者
            whales = await client.get_whale_traders(min_volume=1000)
            print(f"\nFound {len(whales)} whale traders")
            if whales:
                print(f"Top whale: {whales[0]}")
    
    asyncio.run(test())
