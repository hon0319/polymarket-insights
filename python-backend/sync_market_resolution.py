#!/usr/bin/env python3
"""
市場結算狀態同步服務
從 Polymarket Positions Subgraph 獲取市場結算狀態和地址持倉數據
"""

import os
import sys
import asyncio
import aiohttp
from datetime import datetime
from dotenv import load_dotenv
import mysql.connector
from mysql.connector import pooling

# 加載環境變量
load_dotenv()

# Polymarket Subgraph API
POSITIONS_SUBGRAPH_URL = "https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/positions-subgraph/0.0.7/gn"

class MarketResolutionSyncer:
    def __init__(self):
        self.db_pool = self._create_db_pool()
        
    def _parse_database_url(self, url):
        """解析 DATABASE_URL"""
        # mysql://user:password@host:port/database?ssl=...
        if not url.startswith('mysql://'):
            raise ValueError('Invalid DATABASE_URL format')
        
        url = url[8:]  # 移除 'mysql://'
        auth, rest = url.split('@')
        user, password = auth.split(':')
        host_port, database_part = rest.split('/')
        
        # 移除 SSL 參數
        database = database_part.split('?')[0]
        
        if ':' in host_port:
            host, port = host_port.split(':')
            port = int(port)
        else:
            host = host_port
            port = 3306
            
        return {
            'user': user,
            'password': password,
            'host': host,
            'port': port,
            'database': database
        }
    
    def _create_db_pool(self):
        """創建數據庫連接池"""
        db_config = self._parse_database_url(os.getenv('DATABASE_URL'))
        return pooling.MySQLConnectionPool(
            pool_name="market_resolution_pool",
            pool_size=5,
            **db_config
        )
    
    async def fetch_markets_with_resolution(self, session):
        """從 Positions Subgraph 獲取市場和結算狀態"""
        query = """
        query GetMarkets($skip: Int!) {
          markets(
            first: 1000
            skip: $skip
            orderBy: createdAt
            orderDirection: desc
          ) {
            id
            conditionId
            question
            outcomes
            outcomePrices
            volume
            liquidity
            createdAt
            resolved
            winningOutcomeIndex
          }
        }
        """
        
        all_markets = []
        skip = 0
        
        while True:
            try:
                async with session.post(
                    POSITIONS_SUBGRAPH_URL,
                    json={'query': query, 'variables': {'skip': skip}},
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status != 200:
                        print(f"❌ GraphQL request failed: {response.status}")
                        text = await response.text()
                        print(f"Response: {text}")
                        break
                    
                    data = await response.json()
                    
                    if 'errors' in data:
                        print(f"❌ GraphQL errors: {data['errors']}")
                        break
                    
                    markets = data.get('data', {}).get('markets', [])
                    
                    if not markets:
                        break
                    
                    all_markets.extend(markets)
                    print(f"✅ Fetched {len(markets)} markets (total: {len(all_markets)})")
                    
                    skip += 1000
                    
                    # 避免請求過快
                    await asyncio.sleep(0.5)
                    
            except Exception as e:
                print(f"❌ Error fetching markets: {e}")
                break
        
        return all_markets
    
    def update_markets_in_db(self, markets):
        """更新數據庫中的市場數據"""
        conn = self.db_pool.get_connection()
        cursor = conn.cursor()
        
        updated_count = 0
        inserted_count = 0
        resolved_count = 0
        
        try:
            for market in markets:
                condition_id = market['conditionId']
                question = market.get('question', '')
                resolved = market.get('resolved', False)
                winning_outcome_index = market.get('winningOutcomeIndex')
                
                # 判斷結算結果
                if resolved and winning_outcome_index is not None:
                    outcomes = market.get('outcomes', [])
                    if winning_outcome_index < len(outcomes):
                        outcome = outcomes[winning_outcome_index]
                    else:
                        outcome = 'Unknown'
                    resolved_count += 1
                else:
                    outcome = None
                
                # 檢查市場是否已存在
                cursor.execute("""
                    SELECT id FROM markets 
                    WHERE condition_id = %s
                    LIMIT 1
                """, (condition_id,))
                
                result = cursor.fetchone()
                
                if result:
                    # 更新現有市場
                    market_id = result[0]
                    cursor.execute("""
                        UPDATE markets 
                        SET resolved = %s,
                            outcome = %s,
                            question = %s
                        WHERE id = %s
                    """, (1 if resolved else 0, outcome, question, market_id))
                    updated_count += 1
                else:
                    # 插入新市場（如果數據庫中沒有這個 condition_id）
                    try:
                        cursor.execute("""
                            INSERT INTO markets (
                                condition_id, question, resolved, outcome, 
                                category, createdAt
                            ) VALUES (%s, %s, %s, %s, %s, NOW())
                        """, (
                            condition_id, 
                            question, 
                            1 if resolved else 0, 
                            outcome,
                            'Unknown'
                        ))
                        inserted_count += 1
                    except mysql.connector.IntegrityError:
                        # 如果插入失敗（可能是重複的 condition_id），跳過
                        pass
            
            conn.commit()
            print(f"✅ Updated {updated_count} markets")
            print(f"✅ Inserted {inserted_count} new markets")
            print(f"✅ Found {resolved_count} resolved markets")
            
        except Exception as e:
            conn.rollback()
            print(f"❌ Error updating markets: {e}")
            import traceback
            traceback.print_exc()
        finally:
            cursor.close()
            conn.close()
    
    async def run(self):
        """運行同步服務"""
        print("🚀 Starting market resolution sync...")
        
        async with aiohttp.ClientSession() as session:
            # 獲取市場數據
            markets = await self.fetch_markets_with_resolution(session)
            print(f"📊 Total markets fetched: {len(markets)}")
            
            if markets:
                # 更新數據庫
                self.update_markets_in_db(markets)
        
        print("✅ Market resolution sync completed!")

if __name__ == '__main__':
    syncer = MarketResolutionSyncer()
    asyncio.run(syncer.run())
