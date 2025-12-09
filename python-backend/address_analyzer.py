"""
地址分析服務
計算地址的可疑度分數、勝率等指標
"""

import logging
from decimal import Decimal
import mysql.connector
from mysql.connector import pooling
import os

logger = logging.getLogger(__name__)


class AddressAnalyzer:
    """地址分析器"""
    
    def __init__(self):
        self.db_pool = self._create_db_pool()
        
    def _create_db_pool(self):
        """創建資料庫連接池"""
        db_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'user': os.getenv('DB_USER', 'root'),
            'password': os.getenv('DB_PASSWORD', ''),
            'database': os.getenv('DB_NAME', 'polymarket_insights'),
            'pool_name': 'analyzer_pool',
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
    
    def calculate_suspicion_score(self, address_id):
        """
        計算地址的可疑度分數（基礎版本）
        
        當前版本只基於交易規模計算，後續會添加勝率、早期交易等維度
        
        Args:
            address_id: 地址 ID
        
        Returns:
            可疑度分數（0-100）
        """
        conn = self._get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 獲取地址統計數據
            cursor.execute("""
                SELECT 
                    total_volume,
                    total_trades,
                    avg_trade_size,
                    win_count,
                    loss_count,
                    settled_count
                FROM addresses
                WHERE id = %s
            """, (address_id,))
            
            address = cursor.fetchone()
            
            if not address:
                return 0
            
            score = 0
            
            # 1. 交易規模分數（最高 20 分）
            trade_size_score = self._calculate_trade_size_score(
                float(address.get('avg_trade_size', 0))
            )
            score += trade_size_score
            
            # 2. 勝率分數（最高 30 分）- 需要有已結算的市場
            if address.get('settled_count', 0) >= 5:
                win_rate_score = self._calculate_win_rate_score(
                    address.get('win_count', 0),
                    address.get('loss_count', 0)
                )
                score += win_rate_score
            
            # 3. 交易量分數（最高 10 分）- 總交易量越大越可疑
            volume_score = self._calculate_volume_score(
                float(address.get('total_volume', 0))
            )
            score += volume_score
            
            # 確保分數在 0-100 範圍內
            score = max(0, min(100, score))
            
            logger.info(f"Address {address_id} suspicion score: {score:.2f} "
                       f"(trade_size: {trade_size_score:.2f}, volume: {volume_score:.2f})")
            
            return score
            
        except Exception as e:
            logger.error(f"Error calculating suspicion score: {e}")
            return 0
        finally:
            cursor.close()
            conn.close()
    
    def _calculate_trade_size_score(self, avg_trade_size):
        """
        計算交易規模分數（0-20）
        
        | 平均交易金額 | 分數 |
        |------------|------|
        | < $50 | 0 |
        | $50-$100 | 5 |
        | $100-$200 | 8 |
        | $200-$500 | 12 |
        | $500-$1,000 | 15 |
        | $1,000-$5,000 | 18 |
        | > $5,000 | 20 |
        """
        if avg_trade_size < 50:
            return 0
        elif avg_trade_size < 100:
            return 5
        elif avg_trade_size < 200:
            return 8
        elif avg_trade_size < 500:
            return 12
        elif avg_trade_size < 1000:
            return 15
        elif avg_trade_size < 5000:
            return 18
        else:
            return 20
    
    def _calculate_win_rate_score(self, win_count, loss_count):
        """
        計算勝率分數（0-30）
        
        | 勝率範圍 | 分數 |
        |---------|------|
        | < 45% | 0 |
        | 45-55% | 5 |
        | 55-60% | 10 |
        | 60-65% | 15 |
        | 65-70% | 20 |
        | 70-75% | 25 |
        | > 75% | 30 |
        """
        total = win_count + loss_count
        if total == 0:
            return 0
        
        win_rate = (win_count / total) * 100
        
        if win_rate < 45:
            return 0
        elif win_rate < 55:
            return 5
        elif win_rate < 60:
            return 10
        elif win_rate < 65:
            return 15
        elif win_rate < 70:
            return 20
        elif win_rate < 75:
            return 25
        else:
            return 30
    
    def _calculate_volume_score(self, total_volume):
        """
        計算總交易量分數（0-10）
        
        | 總交易量 | 分數 |
        |---------|------|
        | < $1,000 | 0 |
        | $1,000-$5,000 | 2 |
        | $5,000-$10,000 | 4 |
        | $10,000-$50,000 | 6 |
        | $50,000-$100,000 | 8 |
        | > $100,000 | 10 |
        """
        if total_volume < 1000:
            return 0
        elif total_volume < 5000:
            return 2
        elif total_volume < 10000:
            return 4
        elif total_volume < 50000:
            return 6
        elif total_volume < 100000:
            return 8
        else:
            return 10
    
    def update_all_suspicion_scores(self):
        """更新所有地址的可疑度分數"""
        logger.info("Updating suspicion scores for all addresses...")
        
        conn = self._get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 獲取所有地址
            cursor.execute("SELECT id FROM addresses")
            addresses = cursor.fetchall()
            
            logger.info(f"Found {len(addresses)} addresses to analyze")
            
            updated_count = 0
            
            for address in addresses:
                address_id = address['id']
                
                # 計算可疑度分數
                score = self.calculate_suspicion_score(address_id)
                
                # 更新資料庫
                cursor.execute("""
                    UPDATE addresses
                    SET suspicion_score = %s,
                        is_suspicious = %s,
                        updated_at = NOW()
                    WHERE id = %s
                """, (score, score >= 50, address_id))
                
                updated_count += 1
                
                if updated_count % 10 == 0:
                    conn.commit()
                    logger.info(f"Updated {updated_count}/{len(addresses)} addresses...")
            
            conn.commit()
            logger.info(f"✅ Successfully updated suspicion scores for {updated_count} addresses")
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error updating suspicion scores: {e}")
            raise
        finally:
            cursor.close()
            conn.close()
    
    def get_top_suspicious_addresses(self, limit=10):
        """獲取可疑度最高的地址"""
        conn = self._get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            cursor.execute("""
                SELECT 
                    id,
                    address,
                    total_volume,
                    total_trades,
                    avg_trade_size,
                    win_rate,
                    suspicion_score,
                    is_suspicious
                FROM addresses
                WHERE suspicion_score > 0
                ORDER BY suspicion_score DESC
                LIMIT %s
            """, (limit,))
            
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
    
    analyzer = AddressAnalyzer()
    
    # 更新所有地址的可疑度分數
    analyzer.update_all_suspicion_scores()
    
    # 獲取最可疑的地址
    top_suspicious = analyzer.get_top_suspicious_addresses(limit=10)
    
    print("\n" + "="*80)
    print("TOP 10 MOST SUSPICIOUS ADDRESSES")
    print("="*80)
    
    for i, addr in enumerate(top_suspicious, 1):
        print(f"\n{i}. Address: {addr['address']}")
        print(f"   Suspicion Score: {addr['suspicion_score']:.2f}/100")
        print(f"   Total Volume: ${addr['total_volume']:,.2f}")
        print(f"   Total Trades: {addr['total_trades']}")
        print(f"   Avg Trade Size: ${addr['avg_trade_size']:,.2f}")
        print(f"   Win Rate: {addr['win_rate'] or 'N/A'}")
        print(f"   Is Suspicious: {'🚨 YES' if addr['is_suspicious'] else 'NO'}")
    
    print("\n" + "="*80)
