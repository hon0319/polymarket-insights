import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const db = await mysql.createConnection(process.env.DATABASE_URL);

// 檢查 trades 表
const [trades] = await db.execute('SELECT COUNT(*) as count FROM trades WHERE makerAddress IS NOT NULL');
console.log('✅ Trades with makerAddress:', trades[0].count);

// 檢查一個地址的交易記錄
const [addressTrades] = await db.execute(`
  SELECT COUNT(*) as count 
  FROM trades 
  WHERE makerAddress = '0x4bfb41e0dd8ed0527b2ce0f9e7cff1f2982e' 
     OR takerAddress = '0x4bfb41e0dd8ed0527b2ce0f9e7cff1f2982e'
`);
console.log('✅ Trades for top address (0x4bfb...982e):', addressTrades[0].count);

// 檢查 address_trades 表
const [addrTrades] = await db.execute('SELECT COUNT(*) as count FROM address_trades');
console.log('✅ Address trades table:', addrTrades[0].count);

// 檢查市場數據
const [markets] = await db.execute('SELECT COUNT(*) as count, COUNT(DISTINCT condition_id) as unique_markets FROM markets');
console.log('✅ Markets:', markets[0].count, '| Unique condition_ids:', markets[0].unique_markets);

// 檢查市場結算狀態
const [resolved] = await db.execute('SELECT COUNT(*) as count FROM markets WHERE resolved = 1');
console.log('✅ Resolved markets:', resolved[0].count);

await db.end();
