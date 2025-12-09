#!/bin/bash

# Bentana Python Backend Service Stop Script

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

BACKEND_DIR="/home/ubuntu/polymarket-insights/python-backend"
PID_FILE="$BACKEND_DIR/service.pid"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}🛑 Stopping Bentana Python Backend${NC}"
echo -e "${CYAN}========================================${NC}"

if [ ! -f "$PID_FILE" ]; then
    echo -e "${YELLOW}⚠️  Service is not running (no PID file found)${NC}"
    exit 0
fi

SERVICE_PID=$(cat "$PID_FILE")

if ! ps -p "$SERVICE_PID" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Service is not running (stale PID file)${NC}"
    rm -f "$PID_FILE"
    exit 0
fi

echo -e "${CYAN}📍 Found service running with PID: $SERVICE_PID${NC}"
echo -e "${CYAN}🔪 Sending SIGTERM...${NC}"

kill "$SERVICE_PID"

# 等待進程結束（最多 10 秒）
for i in {1..10}; do
    if ! ps -p "$SERVICE_PID" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Service stopped successfully${NC}"
        rm -f "$PID_FILE"
        exit 0
    fi
    sleep 1
done

# 如果還沒停止，強制終止
echo -e "${YELLOW}⚠️  Service did not stop gracefully, forcing...${NC}"
kill -9 "$SERVICE_PID" 2>/dev/null || true
rm -f "$PID_FILE"

echo -e "${GREEN}✅ Service forcefully stopped${NC}"
