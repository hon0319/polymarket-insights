import os
import mysql.connector
from urllib.parse import urlparse

# 解析 DATABASE_URL
database_url = os.getenv('DATABASE_URL')
parsed = urlparse(database_url)

# 提取連接信息
username = parsed.username
password = parsed.password
hostname = parsed.hostname
port = parsed.port or 4000
database = parsed.path.lstrip('/')

print(f"Connecting to database: {hostname}/{database}")

# 連接數據庫
conn = mysql.connector.connect(
    host=hostname,
    port=port,
    user=username,
    password=password,
    database=database,
    ssl_ca='/etc/ssl/certs/ca-certificates.crt',
    ssl_verify_cert=True,
    ssl_verify_identity=True
)

cursor = conn.cursor()

# 查詢地址統計數據
print("\n=== Checking addresses table ===")
cursor.execute("""
    SELECT 
        COUNT(*) as total_addresses,
        COUNT(CASE WHEN total_volume > 0 THEN 1 END) as addresses_with_volume,
        COUNT(CASE WHEN total_trades > 0 THEN 1 END) as addresses_with_trades,
        SUM(total_volume) as total_volume_sum,
        SUM(total_trades) as total_trades_sum
    FROM addresses
""")
result = cursor.fetchone()
print(f"Total addresses: {result[0]}")
print(f"Addresses with volume > 0: {result[1]}")
print(f"Addresses with trades > 0: {result[2]}")
print(f"Total volume sum: {result[3]}")
print(f"Total trades sum: {result[4]}")

# 查詢前 5 個地址的詳細數據
print("\n=== Top 5 addresses by total_volume ===")
cursor.execute("""
    SELECT 
        id,
        address,
        total_volume,
        total_trades,
        avg_trade_size,
        win_rate,
        suspicion_score,
        is_whale
    FROM addresses
    ORDER BY total_volume DESC
    LIMIT 5
""")
for row in cursor.fetchall():
    print(f"ID: {row[0]}, Address: {row[1]}, Volume: {row[2]}, Trades: {row[3]}, Avg: {row[4]}, Win Rate: {row[5]}, Suspicion: {row[6]}, Whale: {row[7]}")

cursor.close()
conn.close()
