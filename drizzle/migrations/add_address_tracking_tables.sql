-- Phase 1: 地址追蹤系統資料庫遷移
-- 創建日期: 2024-12-09

-- 1. 創建 addresses 表（地址基本資訊和統計）
CREATE TABLE IF NOT EXISTS addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  address VARCHAR(42) NOT NULL UNIQUE COMMENT '以太坊地址',
  first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '首次出現時間',
  last_active_at TIMESTAMP NULL COMMENT '最後活躍時間',
  total_trades INT DEFAULT 0 COMMENT '總交易次數',
  total_volume DECIMAL(20, 6) DEFAULT 0 COMMENT '總交易量（USDC）',
  win_count INT DEFAULT 0 COMMENT '勝利次數',
  loss_count INT DEFAULT 0 COMMENT '失敗次數',
  settled_count INT DEFAULT 0 COMMENT '已結算市場數',
  win_rate DECIMAL(5, 2) NULL COMMENT '勝率（百分比）',
  avg_trade_size DECIMAL(20, 6) NULL COMMENT '平均交易金額',
  is_suspicious BOOLEAN DEFAULT FALSE COMMENT '是否可疑',
  suspicion_score DECIMAL(5, 2) DEFAULT 0 COMMENT '可疑度分數（0-100）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_address (address),
  INDEX idx_win_rate (win_rate DESC),
  INDEX idx_suspicious (is_suspicious, suspicion_score DESC),
  INDEX idx_total_volume (total_volume DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地址基本資訊和統計';

-- 2. 創建 address_positions 表（地址持倉）
CREATE TABLE IF NOT EXISTS address_positions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  address_id INT NOT NULL COMMENT '地址 ID',
  market_id INT NOT NULL COMMENT '市場 ID',
  token_id VARCHAR(100) NOT NULL COMMENT 'Token ID（對應市場的某個結果）',
  amount DECIMAL(20, 6) NOT NULL COMMENT '持倉數量',
  avg_price DECIMAL(10, 6) NOT NULL COMMENT '平均買入價格',
  realized_pnl DECIMAL(20, 6) DEFAULT 0 COMMENT '已實現盈虧',
  total_bought DECIMAL(20, 6) DEFAULT 0 COMMENT '總買入量',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE CASCADE,
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE,
  UNIQUE KEY unique_position (address_id, market_id, token_id),
  INDEX idx_address_market (address_id, market_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地址持倉';

-- 3. 創建 address_trades 表（地址交易歷史）
CREATE TABLE IF NOT EXISTS address_trades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  address_id INT NOT NULL COMMENT '地址 ID',
  market_id INT NOT NULL COMMENT '市場 ID',
  tx_hash VARCHAR(66) NOT NULL UNIQUE COMMENT '交易哈希',
  trade_type ENUM('split', 'merge', 'redemption') NOT NULL COMMENT '交易類型',
  amount DECIMAL(20, 6) NOT NULL COMMENT '交易金額（USDC）',
  price DECIMAL(10, 6) NULL COMMENT '交易價格',
  side ENUM('buy', 'sell', 'redeem') NOT NULL COMMENT '交易方向',
  timestamp TIMESTAMP NOT NULL COMMENT '交易時間',
  market_price_at_time DECIMAL(10, 6) NULL COMMENT '當時市場價格',
  is_whale BOOLEAN DEFAULT FALSE COMMENT '是否為大額交易',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE CASCADE,
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE,
  INDEX idx_address_time (address_id, timestamp DESC),
  INDEX idx_market_time (market_id, timestamp DESC),
  INDEX idx_whale (is_whale, timestamp DESC),
  INDEX idx_tx_hash (tx_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地址交易歷史';

-- 4. 創建 address_market_performance 表（地址市場表現）
CREATE TABLE IF NOT EXISTS address_market_performance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  address_id INT NOT NULL COMMENT '地址 ID',
  market_id INT NOT NULL COMMENT '市場 ID',
  entry_time TIMESTAMP NOT NULL COMMENT '進場時間',
  exit_time TIMESTAMP NULL COMMENT '退出時間',
  entry_price DECIMAL(10, 6) NOT NULL COMMENT '進場價格',
  exit_price DECIMAL(10, 6) NULL COMMENT '退出價格',
  position_side ENUM('YES', 'NO') NOT NULL COMMENT '持倉方向',
  total_invested DECIMAL(20, 6) NOT NULL COMMENT '總投資金額',
  realized_pnl DECIMAL(20, 6) NULL COMMENT '已實現盈虧',
  is_winner BOOLEAN NULL COMMENT '是否獲勝',
  market_resolved BOOLEAN DEFAULT FALSE COMMENT '市場是否已結算',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE CASCADE,
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE,
  UNIQUE KEY unique_address_market (address_id, market_id),
  INDEX idx_address_resolved (address_id, market_resolved),
  INDEX idx_market_resolved (market_id, market_resolved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地址市場表現';

-- 5. 創建 market_anomalies 表（市場異常活動）
CREATE TABLE IF NOT EXISTS market_anomalies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  market_id INT NOT NULL COMMENT '市場 ID',
  anomaly_type ENUM('early_whale', 'sudden_volume', 'coordinated_trading', 'price_manipulation') NOT NULL COMMENT '異常類型',
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '檢測時間',
  involved_addresses JSON NULL COMMENT '涉及的地址列表',
  confidence_score DECIMAL(5, 2) NULL COMMENT '信心分數（0-100）',
  description TEXT NULL COMMENT '描述',
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE,
  INDEX idx_market_type (market_id, anomaly_type),
  INDEX idx_confidence (confidence_score DESC),
  INDEX idx_detected_at (detected_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='市場異常活動';

-- 6. 更新 markets 表（添加新欄位）
-- 檢查欄位是否存在，如果不存在則添加
SET @dbname = DATABASE();
SET @tablename = 'markets';
SET @columnname = 'condition_id';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (table_name = @tablename)
   AND (table_schema = @dbname)
   AND (column_name = @columnname)) > 0,
  'SELECT 1',
  'ALTER TABLE markets ADD COLUMN condition_id VARCHAR(100) NULL COMMENT "Polymarket Condition ID"'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'resolved';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (table_name = @tablename)
   AND (table_schema = @dbname)
   AND (column_name = @columnname)) > 0,
  'SELECT 1',
  'ALTER TABLE markets ADD COLUMN resolved BOOLEAN DEFAULT FALSE COMMENT "是否已結算"'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'resolved_at';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (table_name = @tablename)
   AND (table_schema = @dbname)
   AND (column_name = @columnname)) > 0,
  'SELECT 1',
  'ALTER TABLE markets ADD COLUMN resolved_at TIMESTAMP NULL COMMENT "結算時間"'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'winning_outcome';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (table_name = @tablename)
   AND (table_schema = @dbname)
   AND (column_name = @columnname)) > 0,
  'SELECT 1',
  'ALTER TABLE markets ADD COLUMN winning_outcome VARCHAR(10) NULL COMMENT "獲勝結果（YES/NO）"'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'final_price';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (table_name = @tablename)
   AND (table_schema = @dbname)
   AND (column_name = @columnname)) > 0,
  'SELECT 1',
  'ALTER TABLE markets ADD COLUMN final_price DECIMAL(10, 6) NULL COMMENT "最終價格"'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 添加索引（如果不存在）
SET @indexname = 'idx_condition_id';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE (table_name = @tablename)
   AND (table_schema = @dbname)
   AND (index_name = @indexname)) > 0,
  'SELECT 1',
  'ALTER TABLE markets ADD INDEX idx_condition_id (condition_id)'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @indexname = 'idx_resolved';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE (table_name = @tablename)
   AND (table_schema = @dbname)
   AND (index_name = @indexname)) > 0,
  'SELECT 1',
  'ALTER TABLE markets ADD INDEX idx_resolved (resolved)'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 7. 更新 trades 表（添加 address_id 外鍵）
SET @tablename = 'trades';
SET @columnname = 'address_id';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (table_name = @tablename)
   AND (table_schema = @dbname)
   AND (column_name = @columnname)) > 0,
  'SELECT 1',
  'ALTER TABLE trades ADD COLUMN address_id INT NULL COMMENT "交易地址 ID"'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 添加外鍵（如果不存在）
SET @constraintname = 'trades_ibfk_address';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
   WHERE (table_name = @tablename)
   AND (table_schema = @dbname)
   AND (constraint_name = @constraintname)) > 0,
  'SELECT 1',
  'ALTER TABLE trades ADD CONSTRAINT trades_ibfk_address FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 添加索引（如果不存在）
SET @indexname = 'idx_address_id';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE (table_name = @tablename)
   AND (table_schema = @dbname)
   AND (index_name = @indexname)) > 0,
  'SELECT 1',
  'ALTER TABLE trades ADD INDEX idx_address_id (address_id)'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 完成
SELECT 'Phase 1 資料庫遷移完成！' AS status;
