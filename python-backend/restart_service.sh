#!/bin/bash

# Bentana Python Backend Service Restart Script

set -e

BACKEND_DIR="/home/ubuntu/polymarket-insights/python-backend"

echo "🔄 Restarting Bentana Python Backend Service..."
echo ""

# 停止服務
if [ -f "$BACKEND_DIR/stop_service.sh" ]; then
    bash "$BACKEND_DIR/stop_service.sh"
    echo ""
    sleep 2
fi

# 啟動服務
if [ -f "$BACKEND_DIR/start_service.sh" ]; then
    bash "$BACKEND_DIR/start_service.sh"
else
    echo "❌ start_service.sh not found"
    exit 1
fi
