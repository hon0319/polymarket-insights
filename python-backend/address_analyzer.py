"""
地址分析服務
計算地址的可疑度分數、勝率等指標
完整的多維度評估系統
"""

import logging
from decimal import Decimal
import mysql.connector
from mysql.connector import pooling
import os
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)


class AddressAnalyzer:
    """地址分析器 - 完整的多維度可疑度評估系統"""
    
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
    
    def calculate_suspicion_score(self, address_id: int) -> Dict:
        """
        計算地址的可疑度分數（完整版本）
        
        多維度評估系統：
        1. 勝率異常高（30 分）
        2. 經常早期下注（25 分）
        3. 大額交易（20 分）
        4. 時機精準（15 分）
        5. 選擇性參與（10 分）
        
        Args:
            address_id: 地址 ID
        
        Returns:
            包含總分和各維度分數的字典
        """
        conn = self._get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 獲取地址統計數據
            cursor.execute("""
                SELECT 
                    address,
                    total_volume,
                    total_trades,
                    avg_trade_size,
                    win_count,
                    loss_count,
                    settled_count,
                    created_at
                FROM addresses
                WHERE id = %s
            """, (address_id,))
            
            address = cursor.fetchone()
            
            if not address:
                return self._empty_score_breakdown()
            
            # 計算各維度分數
            scores = {}
            
            # 1. 勝率分數（最高 30 分）
            scores['win_rate'] = self._calculate_win_rate_score(
                address.get('win_count', 0),
                address.get('loss_count', 0),
                address.get('settled_count', 0)
            )
            
            # 2. 早期交易分數（最高 25 分）
            scores['early_trading'] = self._calculate_early_trading_score(address_id)
            
            # 3. 交易規模分數（最高 20 分）
            scores['trade_size'] = self._calculate_trade_size_score(
                float(address.get('avg_trade_size', 0))
            )
            
            # 4. 時機精準度分數（最高 15 分）
            scores['timing'] = self._calculate_timing_score(address_id)
            
            # 5. 選擇性參與分數（最高 10 分）
            scores['selectivity'] = self._calculate_selectivity_score(address_id)
            
            # 計算總分
            total_score = sum(scores.values())
            
            # 確保分數在 0-100 範圍內
            total_score = max(0, min(100, total_score))
            
            result = {
                'total_score': round(total_score, 2),
                'breakdown': {
                    'win_rate_score': round(scores['win_rate'], 2),
                    'early_trading_score': round(scores['early_trading'], 2),
                    'trade_size_score': round(scores['trade_size'], 2),
                    'timing_score': round(scores['timing'], 2),
                    'selectivity_score': round(scores['selectivity'], 2)
                },
                'address': address.get('address', ''),
                'total_trades': address.get('total_trades', 0),
                'settled_count': address.get('settled_count', 0)
            }
            
            logger.info(f"Address {address_id} ({address.get('address', '')[:10]}...) "
                       f"suspicion score: {total_score:.2f} "
                       f"(win_rate: {scores['win_rate']:.1f}, "
                       f"early: {scores['early_trading']:.1f}, "
                       f"size: {scores['trade_size']:.1f}, "
                       f"timing: {scores['timing']:.1f}, "
                       f"selectivity: {scores['selectivity']:.1f})")
            
            return result
            
        except Exception as e:
            logger.error(f"Error calculating suspicion score: {e}")
            return self._empty_score_breakdown()
        finally:
            cursor.close()
            conn.close()
    
    def _empty_score_breakdown(self) -> Dict:
        """返回空的分數分解"""
        return {
            'total_score': 0,
            'breakdown': {
                'win_rate_score': 0,
                'early_trading_score': 0,
                'trade_size_score': 0,
                'timing_score': 0,
                'selectivity_score': 0
            },
            'address': '',
            'total_trades': 0,
            'settled_count': 0
        }
    
    def _calculate_win_rate_score(self, win_count: int, loss_count: int, settled_count: int) -> float:
        """
        計算勝率分數（0-30）
        
        需要至少 5 個已結算的市場才計算勝率
        
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
        if settled_count < 5:
            return 0
        
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
    
    def _calculate_early_trading_score(self, address_id: int) -> float:
        """
        計算早期交易分數（0-25）
        
        識別在市場價格大幅變動前 24-72 小時就下注的交易
        
        | 早期交易比例 | 分數 |
        |-------------|------|
        | < 10% | 0 |
        | 10-20% | 5 |
        | 20-30% | 10 |
        | 30-40% | 15 |
        | 40-50% | 20 |
        | > 50% | 25 |
        
        注意：當前使用模擬數據，實際實作需要從 Subgraph 同步歷史交易數據
        """
        # TODO: 實作真實的早期交易檢測
        # 當前使用模擬數據
        conn = self._get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 獲取地址的交易數量
            cursor.execute("""
                SELECT total_trades FROM addresses WHERE id = %s
            """, (address_id,))
            
            result = cursor.fetchone()
            if not result or result['total_trades'] < 10:
                return 0
            
            # 獲取地址的所有交易
            cursor.execute("""
                SELECT 
                    at.market_id,
                    at.timestamp as trade_timestamp,
                    m.createdAt as market_created_at,
                    m.endDate as market_end_date
                FROM address_trades at
                JOIN markets m ON at.market_id = m.id
                WHERE at.address_id = %s
                    AND m.createdAt IS NOT NULL
                    AND m.endDate IS NOT NULL
                ORDER BY at.timestamp ASC
            """, (address_id,))
            
            trades = cursor.fetchall()
            
            if len(trades) < 10:
                return 0
            
            # 計算早期交易比例
            early_trades = 0
            
            for trade in trades:
                market_created = trade['market_created_at']
                market_end = trade['market_end_date']
                trade_time = trade['trade_timestamp']
                
                # 計算市場生命週期
                market_duration = (market_end - market_created).total_seconds()
                
                # 計算交易時間相對於市場開放的位置
                trade_offset = (trade_time - market_created).total_seconds()
                
                # 如果交易發生在市場開放後的前 20% 時間，視為早期交易
                if market_duration > 0 and (trade_offset / market_duration) < 0.2:
                    early_trades += 1
            
            # 計算早期交易比例
            early_trade_ratio = early_trades / len(trades)
            
            if early_trade_ratio < 0.1:
                return 0
            elif early_trade_ratio < 0.2:
                return 5
            elif early_trade_ratio < 0.3:
                return 10
            elif early_trade_ratio < 0.4:
                return 15
            elif early_trade_ratio < 0.5:
                return 20
            else:
                return 25
                
        finally:
            cursor.close()
            conn.close()
    
    def _calculate_trade_size_score(self, avg_trade_size: float) -> float:
        """
        計算交易規模分數（0-20）
        
        | 平均交易金額 | 分數 |
        |------------|------|
        | < $100 | 0 |
        | $100-$500 | 5 |
        | $500-$1,000 | 10 |
        | $1,000-$5,000 | 15 |
        | > $5,000 | 20 |
        """
        if avg_trade_size < 100:
            return 0
        elif avg_trade_size < 500:
            return 5
        elif avg_trade_size < 1000:
            return 10
        elif avg_trade_size < 5000:
            return 15
        else:
            return 20
    
    def _calculate_timing_score(self, address_id: int) -> float:
        """
        計算時機精準度分數（0-15）
        
        分析交易者的平均持倉時間和進出市場的時機
        
        | 持倉時間 | 分數 |
        |---------|------|
        | > 240h (10天) | 0 |
        | 168-240h (7-10天) | 3 |
        | 120-168h (5-7天) | 6 |
        | 72-120h (3-5天) | 9 |
        | 48-72h (2-3天) | 12 |
        | < 48h (2天) | 15 |
        
        注意：當前使用模擬數據
        """
        # TODO: 實作真實的時機精準度分析
        # 當前使用模擬數據
        conn = self._get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 獲取地址的交易數量
            cursor.execute("""
                SELECT total_trades FROM addresses WHERE id = %s
            """, (address_id,))
            
            result = cursor.fetchone()
            if not result or result['total_trades'] < 10:
                return 0
            
            # 獲取地址的交易記錄，計算持倉時間
            cursor.execute("""
                SELECT 
                    at.timestamp as trade_timestamp,
                    m.endDate as market_end_date
                FROM address_trades at
                JOIN markets m ON at.market_id = m.id
                WHERE at.address_id = %s
                    AND m.endDate IS NOT NULL
                    AND at.timestamp < m.endDate
                ORDER BY at.timestamp ASC
            """, (address_id,))
            
            trades = cursor.fetchall()
            
            if len(trades) < 10:
                return 0
            
            # 計算平均持倉時間（從交易到市場結束）
            total_holding_hours = 0
            
            for trade in trades:
                trade_time = trade['trade_timestamp']
                market_end = trade['market_end_date']
                
                # 計算持倉時間（小時）
                holding_hours = (market_end - trade_time).total_seconds() / 3600
                total_holding_hours += holding_hours
            
            avg_holding_hours = total_holding_hours / len(trades)
            
            if avg_holding_hours > 240:
                return 0
            elif avg_holding_hours > 168:
                return 3
            elif avg_holding_hours > 120:
                return 6
            elif avg_holding_hours > 72:
                return 9
            elif avg_holding_hours > 48:
                return 12
            else:
                return 15
                
        finally:
            cursor.close()
            conn.close()
    
    def _calculate_selectivity_score(self, address_id: int) -> float:
        """
        計算選擇性參與分數（0-10）
        
        分析交易者是否只參與特定類型的市場
        
        | 參與率 | 分數 |
        |-------|------|
        | > 50% | 0 |
        | 40-50% | 2 |
        | 30-40% | 4 |
        | 20-30% | 6 |
        | 10-20% | 8 |
        | < 10% | 10 |
        
        參與率 = 實際參與的市場數 / 同期可參與的市場總數
        
        注意：當前使用模擬數據
        """
        # TODO: 實作真實的選擇性參與分析
        # 當前使用模擬數據
        conn = self._get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 獲取地址的交易數量
            cursor.execute("""
                SELECT total_trades FROM addresses WHERE id = %s
            """, (address_id,))
            
            result = cursor.fetchone()
            if not result or result['total_trades'] < 10:
                return 0
            
            # 獲取地址的交易記錄
            cursor.execute("""
                SELECT COUNT(DISTINCT at.market_id) as participated_markets
                FROM address_trades at
                WHERE at.address_id = %s
            """, (address_id,))
            
            result2 = cursor.fetchone()
            participated_markets = result2['participated_markets'] if result2 else 0
            
            if participated_markets == 0:
                return 0
            
            # 獲取同期可參與的市場總數（簡化版：使用所有活躍市場）
            cursor.execute("""
                SELECT COUNT(*) as total_markets
                FROM markets
                WHERE isActive = TRUE
            """)
            
            result3 = cursor.fetchone()
            total_markets = result3['total_markets'] if result3 else 1
            
            # 計算參與率
            participation_rate = participated_markets / total_markets if total_markets > 0 else 0
            
            if participation_rate > 0.5:
                return 0
            elif participation_rate > 0.4:
                return 2
            elif participation_rate > 0.3:
                return 4
            elif participation_rate > 0.2:
                return 6
            elif participation_rate > 0.1:
                return 8
            else:
                return 10
                
        finally:
            cursor.close()
            conn.close()
    
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
                score_data = self.calculate_suspicion_score(address_id)
                total_score = score_data['total_score']
                
                # 更新資料庫
                cursor.execute("""
                    UPDATE addresses
                    SET suspicion_score = %s,
                        is_suspicious = %s,
                        updated_at = NOW()
                    WHERE id = %s
                """, (total_score, total_score >= 50, address_id))
                
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
    
    def get_score_breakdown(self, address_id: int) -> Dict:
        """獲取地址的可疑度分數詳細分解"""
        return self.calculate_suspicion_score(address_id)


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
        
        # 獲取分數分解
        breakdown = analyzer.get_score_breakdown(addr['id'])
        if breakdown['breakdown']:
            print(f"\n   Score Breakdown:")
            print(f"   - Win Rate Score: {breakdown['breakdown']['win_rate_score']:.1f}/30")
            print(f"   - Early Trading Score: {breakdown['breakdown']['early_trading_score']:.1f}/25")
            print(f"   - Trade Size Score: {breakdown['breakdown']['trade_size_score']:.1f}/20")
            print(f"   - Timing Score: {breakdown['breakdown']['timing_score']:.1f}/15")
            print(f"   - Selectivity Score: {breakdown['breakdown']['selectivity_score']:.1f}/10")
    
    print("\n" + "="*80)
