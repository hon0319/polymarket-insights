#!/bin/bash

# Polymarket Insights - Python Backend Startup Script

echo "🌙 Starting Polymarket Insights Python Backend..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Check if .env file exists
if [ ! -f "../.env" ]; then
    echo "⚠️ Warning: .env file not found in parent directory"
    echo "Please create a .env file with the following variables:"
    echo "  - DATABASE_URL"
    echo "  - OPENAI_API_KEY"
    echo "  - ANTHROPIC_API_KEY"
    echo "  - GOOGLE_API_KEY"
    exit 1
fi

# Run the Python backend
echo "🚀 Starting Python backend service..."
python main.py
