#!/usr/bin/env python3
"""
地址發現腳本
從 trades 表中提取所有唯一的 maker 和 taker 地址
並插入到 addresses 表中
"""

import os
import sys
from dotenv import load_dotenv
import mysql.connector
from mysql.connector import pooling
from datetime import datetime

# 加載環境變量
load_dotenv()

class AddressDiscovery:
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
            pool_name="discovery_pool",
            pool_size=5,
            **db_config
        )
    
    def discover_addresses(self):
        """從 trades 表中發現所有地址"""
        conn = self.db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 獲取所有唯一的 maker 和 taker 地址
            cursor.execute("""
                SELECT DISTINCT makerAddress as address FROM trades 
                WHERE makerAddress IS NOT NULL AND makerAddress != ''
                UNION
                SELECT DISTINCT takerAddress as address FROM trades 
                WHERE takerAddress IS NOT NULL AND takerAddress != ''
            """)
            
            addresses = cursor.fetchall()
            print(f"✅ Found {len(addresses)} unique addresses in trades")
            return [addr['address'] for addr in addresses]
            
        except Exception as e:
            print(f"❌ Error discovering addresses: {e}")
            return []
        finally:
            cursor.close()
            conn.close()
    
    def insert_addresses(self, addresses):
        """插入地址到 addresses 表"""
        conn = self.db_pool.get_connection()
        cursor = conn.cursor()
        
        try:
            # 批量插入
            values = [(addr, datetime.now()) for addr in addresses]
            
            cursor.executemany("""
                INSERT IGNORE INTO addresses (address, created_at)
                VALUES (%s, %s)
            """, values)
            
            conn.commit()
            inserted = cursor.rowcount
            skipped = len(addresses) - inserted
            
            print(f"✅ Inserted {inserted} new addresses")
            print(f"   - Skipped {skipped} existing addresses")
            
        except Exception as e:
            conn.rollback()
            print(f"❌ Error inserting addresses: {e}")
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
            # 檢查 addresses 表
            cursor.execute("SELECT COUNT(*) as count FROM addresses")
            result = cursor.fetchone()
            total_addresses = result['count']
            
            print(f"\n📊 Data Verification:")
            print(f"   - Total addresses: {total_addresses}")
            
        except Exception as e:
            print(f"❌ Error verifying data: {e}")
        finally:
            cursor.close()
            conn.close()
    
    def run(self):
        """運行地址發現服務"""
        print("🚀 Starting address discovery...")
        
        # 發現所有地址
        addresses = self.discover_addresses()
        
        if addresses:
            # 插入到數據庫
            self.insert_addresses(addresses)
            
            # 驗證數據
            self.verify_data()
        
        print("✅ Address discovery completed!")

if __name__ == '__main__':
    discovery = AddressDiscovery()
    discovery.run()
