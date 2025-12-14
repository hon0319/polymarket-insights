#!/usr/bin/env python3
"""
交易記錄轉換腳本
將 trades 表的數據轉換成 address_trades 表
為每筆交易創建兩條記錄（maker 和 taker）
"""

import os
import sys
from dotenv import load_dotenv
import mysql.connector
from mysql.connector import pooling
from datetime import datetime

# 加載環境變量
load_dotenv()

class AddressTradesBuilder:
    def __init__(self):
        self.db_pool = self._create_db_pool()
        
    def _parse_database_url(self, url):
        """解析 DATABASE_URL"""
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
            pool_name="address_trades_pool",
            pool_size=5,
            **db_config
        )
    
    def fetch_all_trades(self):
        """獲取所有交易記錄"""
        conn = self.db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            cursor.execute("""
                SELECT 
                    id,
                    marketId,
                    makerAddress,
                    takerAddress,
                    makerAmount,
                    takerAmount,
                    price,
                    side,
                    timestamp,
                    createdAt
                FROM trades
                WHERE makerAddress IS NOT NULL 
                  AND takerAddress IS NOT NULL
                ORDER BY timestamp ASC
            """)
            
            trades = cursor.fetchall()
            print(f"✅ Fetched {len(trades)} trades from database")
            return trades
            
        except Exception as e:
            print(f"❌ Error fetching trades: {e}")
            return []
        finally:
            cursor.close()
            conn.close()
    
    def build_address_map(self):
        """批量獲取所有地址 ID"""
        conn = self.db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            cursor.execute("SELECT id, address FROM addresses")
            addresses = cursor.fetchall()
            
            address_map = {}
            for addr in addresses:
                address_map[addr['address']] = addr['id']
            
            print(f"✅ Built address map with {len(address_map)} addresses")
            return address_map
            
        except Exception as e:
            print(f"❌ Error building address map: {e}")
            return {}
        finally:
            cursor.close()
            conn.close()
    
    def build_address_trades(self, trades, address_map):
        """將交易轉換成地址交易記錄"""
        conn = self.db_pool.get_connection()
        cursor = conn.cursor()
        
        try:
            # 清空現有的 address_trades 表
            cursor.execute("TRUNCATE TABLE address_trades")
            print("✅ Cleared existing address_trades table")
            
            address_trades = []
            skipped = 0
            
            print(f"Processing {len(trades)} trades...")
            
            for trade in trades:
                trade_id = trade['id']
                market_id = trade['marketId']
                maker_address = trade['makerAddress']
                taker_address = trade['takerAddress']
                maker_amount = float(trade['makerAmount']) if trade['makerAmount'] else 0
                taker_amount = float(trade['takerAmount']) if trade['takerAmount'] else 0
                price = float(trade['price']) if trade['price'] else 0
                side = trade['side']  # 'BUY' or 'SELL'
                timestamp = trade['timestamp']
                
                # 為 maker 和 taker 生成不同的 tx_hash
                maker_tx_hash = f"0x{trade_id:064x}"
                taker_tx_hash = f"0x{(trade_id + 1000000):064x}"
                
                # 跳過 market_id 為 NULL 的交易
                if not market_id:
                    skipped += 1
                    print(f"Skipped trade {trade_id}: market_id is NULL")
                    continue
                
                # 獲取地址 ID
                maker_address_id = address_map.get(maker_address)
                taker_address_id = address_map.get(taker_address)
                
                if not maker_address_id or not taker_address_id:
                    skipped += 1
                    print(f"Skipped trade {trade_id}: maker={maker_address} (ID={maker_address_id}), taker={taker_address} (ID={taker_address_id})")
                    continue
                
                # Maker 記錄
                # 如果 side 是 'BUY'，maker 是賣方（sell）
                # 如果 side 是 'SELL'，maker 是買方（buy）
                maker_side = 'sell' if side == 'BUY' else 'buy'
                maker_trade = (
                    maker_address_id,
                    market_id,
                    maker_tx_hash,
                    None,  # trade_type
                    maker_amount,
                    price,
                    maker_side,
                    timestamp,
                    price,  # market_price_at_time
                    0,  # is_whale
                    datetime.now()
                )
                address_trades.append(maker_trade)
                
                # Taker 記錄
                # 如果 side 是 'BUY'，taker 是買方（buy）
                # 如果 side 是 'SELL'，taker 是賣方（sell）
                taker_side = 'buy' if side == 'BUY' else 'sell'
                taker_trade = (
                    taker_address_id,
                    market_id,
                    taker_tx_hash,
                    None,  # trade_type
                    taker_amount,
                    price,
                    taker_side,
                    timestamp,
                    price,  # market_price_at_time
                    0,  # is_whale
                    datetime.now()
                )
                address_trades.append(taker_trade)
            
            print(f"\nTotal trades to insert: {len(address_trades)}")
            print(f"Skipped: {skipped}")
            
            # 批量插入
            if address_trades:
                cursor.executemany("""
                    INSERT INTO address_trades (
                        address_id, market_id, tx_hash, trade_type, amount, price, side, 
                        timestamp, market_price_at_time, is_whale, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, address_trades)
                
                conn.commit()
                print(f"✅ Inserted {len(address_trades)} address trades")
                print(f"   - Expected: {len(trades) * 2}")
                print(f"   - Actual: {len(address_trades)}")
                print(f"   - Skipped: {skipped} trades (address not found)")
            
        except Exception as e:
            conn.rollback()
            print(f"❌ Error building address trades: {e}")
            import traceback
            traceback.print_exc()
        finally:
            cursor.close()
            conn.close()
    
    def verify_data(self):
        """驗證數據完整性"""
        conn = self.db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 檢查 address_trades 表
            cursor.execute("SELECT COUNT(*) as count FROM address_trades")
            result = cursor.fetchone()
            total_address_trades = result['count']
            
            # 檢查每個地址的交易數
            cursor.execute("""
                SELECT a.address, COUNT(*) as trade_count
                FROM address_trades at
                JOIN addresses a ON at.address_id = a.id
                GROUP BY a.address
                ORDER BY trade_count DESC
                LIMIT 5
            """)
            top_addresses = cursor.fetchall()
            
            print(f"\n📊 Data Verification:")
            print(f"   - Total address trades: {total_address_trades}")
            print(f"   - Top 5 addresses by trade count:")
            for addr in top_addresses:
                print(f"     * {addr['address']}: {addr['trade_count']} trades")
            
        except Exception as e:
            print(f"❌ Error verifying data: {e}")
        finally:
            cursor.close()
            conn.close()
    
    def run(self):
        """運行轉換服務"""
        print("🚀 Starting address trades builder...")
        
        # 批量獲取所有地址 ID
        address_map = self.build_address_map()
        
        # 獲取所有交易
        trades = self.fetch_all_trades()
        
        if trades and address_map:
            # 轉換成地址交易記錄
            self.build_address_trades(trades, address_map)
            
            # 驗證數據
            self.verify_data()
        
        print("✅ Address trades builder completed!")

if __name__ == '__main__':
    builder = AddressTradesBuilder()
    builder.run()
