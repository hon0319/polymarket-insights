"""
定時任務調度器
每 5 分鐘運行 Orderbook 收集器和地址發現系統
"""

import os
import sys
import logging
import time
from datetime import datetime
from orderbook_collector import OrderbookCollector
from address_discovery import AddressDiscovery

logger = logging.getLogger(__name__)


class CronScheduler:
    """定時任務調度器"""
    
    def __init__(self):
        self.orderbook_collector = OrderbookCollector()
        self.address_discovery = AddressDiscovery()
        
        # 定時任務間隔（秒）
        self.collection_interval = 5 * 60  # 5 分鐘
        self.address_discovery_interval = 30 * 60  # 30 分鐘（地址發現較慢，不需要太頻繁）
        
        # 上次執行時間
        self.last_collection_time = 0
        self.last_discovery_time = 0
        
        logger.info("CronScheduler initialized")
        logger.info(f"Collection interval: {self.collection_interval} seconds")
        logger.info(f"Address discovery interval: {self.address_discovery_interval} seconds")
    
    def run_collection_task(self):
        """運行數據收集任務"""
        try:
            logger.info("=" * 60)
            logger.info(f"Running collection task at {datetime.now()}")
            logger.info("=" * 60)
            
            # 運行 Orderbook 收集器
            result = self.orderbook_collector.run_collection()
            
            logger.info(f"Collection task completed: {result}")
            logger.info("=" * 60)
            
            return result
            
        except Exception as e:
            logger.error(f"Error in collection task: {e}")
            return None
    
    def run_address_discovery_task(self):
        """運行地址發現任務"""
        try:
            logger.info("=" * 60)
            logger.info(f"Running address discovery task at {datetime.now()}")
            logger.info("=" * 60)
            
            # 運行地址發現
            result = self.address_discovery.discover_addresses()
            
            logger.info(f"Address discovery task completed: {result}")
            logger.info("=" * 60)
            
            return result
            
        except Exception as e:
            logger.error(f"Error in address discovery task: {e}")
            return None
    
    def run_once(self):
        """運行一次所有任務（用於測試）"""
        logger.info("Running all tasks once...")
        
        # 運行數據收集
        collection_result = self.run_collection_task()
        
        # 運行地址發現
        discovery_result = self.run_address_discovery_task()
        
        return {
            'collection': collection_result,
            'address_discovery': discovery_result
        }
    
    def run_forever(self):
        """持續運行定時任務"""
        logger.info("Starting cron scheduler (running forever)...")
        logger.info("Press Ctrl+C to stop")
        
        try:
            while True:
                current_time = time.time()
                
                # 檢查是否需要運行數據收集任務
                if current_time - self.last_collection_time >= self.collection_interval:
                    self.run_collection_task()
                    self.last_collection_time = current_time
                
                # 檢查是否需要運行地址發現任務
                if current_time - self.last_discovery_time >= self.address_discovery_interval:
                    self.run_address_discovery_task()
                    self.last_discovery_time = current_time
                
                # 休眠 30 秒再檢查
                time.sleep(30)
                
        except KeyboardInterrupt:
            logger.info("Cron scheduler stopped by user")
        except Exception as e:
            logger.error(f"Fatal error in cron scheduler: {e}")
            raise


def main():
    """主函數"""
    # 配置日誌
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # 創建調度器
    scheduler = CronScheduler()
    
    # 檢查命令行參數
    if len(sys.argv) > 1 and sys.argv[1] == '--once':
        # 運行一次
        result = scheduler.run_once()
        logger.info(f"Task result: {result}")
    else:
        # 持續運行
        scheduler.run_forever()


if __name__ == "__main__":
    main()
