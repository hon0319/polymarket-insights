import os
from dotenv import load_dotenv

load_dotenv()

# Polymarket Configuration
POLYMARKET_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market"
POLYMARKET_API_BASE = "https://clob.polymarket.com"
POLYMARKET_GAMMA_API = "https://gamma-api.polymarket.com"

# Trading Thresholds
TRADE_NOTIONAL_THRESHOLD = float(os.getenv("TRADE_NOTIONAL_THRESHOLD", "1000"))  # $1000
IGNORE_PRICE_THRESHOLD = float(os.getenv("IGNORE_PRICE_THRESHOLD", "0.05"))  # 0.05 (5%)
WHALE_TRADE_THRESHOLD = float(os.getenv("WHALE_TRADE_THRESHOLD", "10000"))  # $10,000

# Market Filters
IGNORE_CRYPTO_KEYWORDS = [
    "bitcoin", "btc", "ethereum", "eth", "crypto", "cryptocurrency",
    "solana", "sol", "dogecoin", "doge", "blockchain"
]

IGNORE_SPORTS_KEYWORDS = [
    "nfl", "nba", "mlb", "nhl", "soccer", "football", "basketball",
    "baseball", "hockey", "sports", "game", "match", "championship"
]

# AI Configuration
USE_SWARM_MODE = os.getenv("USE_SWARM_MODE", "true").lower() == "true"
SWARM_MODELS = [
    "gpt-4o-mini",
    "claude-3-5-haiku-20241022",
    "gemini-2.0-flash-exp",
]

# Analysis Configuration
MIN_MARKETS_PER_ANALYSIS = int(os.getenv("MIN_MARKETS_PER_ANALYSIS", "5"))
ANALYSIS_CHECK_INTERVAL_SECONDS = int(os.getenv("ANALYSIS_CHECK_INTERVAL_SECONDS", "300"))  # 5 minutes
REANALYSIS_HOURS = int(os.getenv("REANALYSIS_HOURS", "8"))
LOOKBACK_HOURS = int(os.getenv("LOOKBACK_HOURS", "24"))

# Database Configuration (from environment)
DATABASE_URL = os.getenv("DATABASE_URL")

# WebSocket Server Configuration
WS_SERVER_HOST = os.getenv("WS_SERVER_HOST", "localhost")
WS_SERVER_PORT = int(os.getenv("WS_SERVER_PORT", "8765"))

# API Keys (from environment)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
