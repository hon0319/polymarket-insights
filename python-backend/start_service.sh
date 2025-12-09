#!/bin/bash

# Bentana Python Backend Service Startup Script
# 此腳本負責啟動 Python 後端服務並確保其穩定運行

set -e  # 遇到錯誤立即退出

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 項目路徑
PROJECT_DIR="/home/ubuntu/polymarket-insights"
BACKEND_DIR="$PROJECT_DIR/python-backend"
VENV_DIR="$BACKEND_DIR/venv"
LOG_FILE="$BACKEND_DIR/service.log"
PID_FILE="$BACKEND_DIR/service.pid"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}🌙 Bentana Python Backend Service${NC}"
echo -e "${CYAN}========================================${NC}"

# 檢查是否已經在運行
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Service is already running (PID: $OLD_PID)${NC}"
        echo -e "${YELLOW}   Use './stop_service.sh' to stop it first${NC}"
        exit 1
    else
        echo -e "${YELLOW}⚠️  Stale PID file found, removing...${NC}"
        rm -f "$PID_FILE"
    fi
fi

# 切換到後端目錄
cd "$BACKEND_DIR"

# 檢查虛擬環境
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment not found, creating...${NC}"
    python3.11 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    echo -e "${GREEN}✅ Virtual environment created${NC}"
else
    echo -e "${GREEN}✅ Virtual environment found${NC}"
    source venv/bin/activate
fi

# 檢查依賴
echo -e "${CYAN}📦 Checking dependencies...${NC}"
pip install -q -r requirements.txt

# 檢查環境變數
if [ -z "$OPENROUTER_API_KEY" ]; then
    echo -e "${RED}❌ OPENROUTER_API_KEY not set in environment${NC}"
    echo -e "${YELLOW}   Please set it in your .env file or export it${NC}"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL not set in environment${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables configured${NC}"

# 清理舊日誌（保留最近 7 天）
find "$BACKEND_DIR" -name "*.log" -mtime +7 -delete 2>/dev/null || true

# 啟動服務
echo -e "${CYAN}🚀 Starting Python backend service...${NC}"
echo -e "${CYAN}   Log file: $LOG_FILE${NC}"

# 使用 nohup 在後台運行，並將輸出重定向到日誌文件
nohup python3.11 main.py > "$LOG_FILE" 2>&1 &
SERVICE_PID=$!

# 保存 PID
echo "$SERVICE_PID" > "$PID_FILE"

# 等待 3 秒檢查服務是否成功啟動
sleep 3

if ps -p "$SERVICE_PID" > /dev/null 2>&1; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✅ Service started successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "${CYAN}   PID: $SERVICE_PID${NC}"
    echo -e "${CYAN}   Log: $LOG_FILE${NC}"
    echo -e "${CYAN}   WebSocket: ws://localhost:8765${NC}"
    echo ""
    echo -e "${YELLOW}📝 Useful commands:${NC}"
    echo -e "   ${CYAN}tail -f $LOG_FILE${NC}  # View logs"
    echo -e "   ${CYAN}./stop_service.sh${NC}  # Stop service"
    echo -e "   ${CYAN}./restart_service.sh${NC}  # Restart service"
    echo ""
    
    # 顯示最近的日誌
    echo -e "${CYAN}📋 Recent logs:${NC}"
    tail -n 20 "$LOG_FILE"
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}❌ Service failed to start${NC}"
    echo -e "${RED}========================================${NC}"
    echo -e "${YELLOW}📋 Last 30 lines of log:${NC}"
    tail -n 30 "$LOG_FILE"
    rm -f "$PID_FILE"
    exit 1
fi
