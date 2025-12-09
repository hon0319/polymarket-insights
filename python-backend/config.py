"""
Polymarket Insights - Python Backend Configuration
"""
import os
from dotenv import load_dotenv

# Load environment variables from parent directory
load_dotenv("../.env")

# ============ Database Configuration ============
DATABASE_URL = os.getenv("DATABASE_URL")

# ============ OpenRouter API Configuration ============
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# ============ AI Model Configuration ============
USE_SWARM_MODE = os.getenv("USE_SWARM_MODE", "true").lower() == "true"

# OpenRouter 模型列表
# 完整模型列表請參考: https://openrouter.ai/models
SWARM_MODELS = [
    "openai/gpt-4o-mini",              # OpenAI GPT-4o Mini
    "anthropic/claude-3.5-haiku",      # Anthropic Claude 3.5 Haiku
    "google/gemini-2.0-flash-exp:free" # Google Gemini 2.0 Flash (Free)
]

# 單一模型（當 USE_SWARM_MODE = False 時使用）
SINGLE_MODEL = "openai/gpt-4o-mini"

# ============ Polymarket API Configuration ============
POLYMARKET_GAMMA_API = "https://gamma-api.polymarket.com"
POLYMARKET_API_BASE = "https://clob.polymarket.com"
POLYMARKET_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market"

# ============ Trading Thresholds ============
# 最小交易金額（美元）- 低於此金額的交易將被忽略
TRADE_NOTIONAL_THRESHOLD = float(os.getenv("TRADE_NOTIONAL_THRESHOLD", "1000"))

# 大額交易閾值（美元）- 超過此金額的交易將被標記為「鯨魚」交易
WHALE_TRADE_THRESHOLD = float(os.getenv("WHALE_TRADE_THRESHOLD", "10000"))

# 忽略接近結算價格的交易（0-1）
# 例如：0.05 表示忽略價格 < 0.05 或 > 0.95 的交易
IGNORE_PRICE_THRESHOLD = float(os.getenv("IGNORE_PRICE_THRESHOLD", "0.05"))

# ============ Market Filtering ============
# 要排除的加密貨幣關鍵字
IGNORE_CRYPTO_KEYWORDS = [
    "bitcoin", "btc", "ethereum", "eth", "crypto", "cryptocurrency",
    "solana", "sol", "cardano", "ada", "dogecoin", "doge",
    "ripple", "xrp", "polkadot", "dot", "avalanche", "avax",
    "polygon", "matic", "chainlink", "link", "uniswap", "uni",
    "litecoin", "ltc", "stellar", "xlm", "monero", "xmr",
    "tron", "trx", "eos", "tezos", "xtz", "cosmos", "atom",
    "algorand", "algo", "vechain", "vet", "theta", "tfuel",
    "filecoin", "fil", "aave", "comp", "maker", "mkr",
    "sushi", "cake", "bnb", "binance", "ftx", "ftm", "fantom",
    "blockchain"
]

# 要排除的體育關鍵字
IGNORE_SPORTS_KEYWORDS = [
    "nfl", "nba", "mlb", "nhl", "soccer", "football", "basketball",
    "baseball", "hockey", "tennis", "golf", "boxing", "mma", "ufc",
    "formula 1", "f1", "nascar", "olympics", "world cup", "super bowl",
    "playoffs", "championship", "league", "tournament", "match",
    "game", "season", "draft", "trade", "player", "team", "coach",
    "score", "win", "lose", "defeat", "victory", "champion", "sports"
]

# ============ WebSocket Server Configuration ============
WS_SERVER_HOST = os.getenv("WS_SERVER_HOST", "localhost")
WS_SERVER_PORT = int(os.getenv("WS_SERVER_PORT", "8765"))

# ============ AI Analysis Configuration ============
# AI 分析間隔（小時）
REANALYSIS_HOURS = int(os.getenv("REANALYSIS_HOURS", "8"))

# 每次分析的最小市場數量
MIN_MARKETS_PER_ANALYSIS = int(os.getenv("MIN_MARKETS_PER_ANALYSIS", "5"))

# 分析檢查間隔（秒）
ANALYSIS_CHECK_INTERVAL_SECONDS = int(os.getenv("ANALYSIS_CHECK_INTERVAL_SECONDS", "300"))  # 5 minutes

# 回溯時間（小時）
LOOKBACK_HOURS = int(os.getenv("LOOKBACK_HOURS", "24"))

# AI 溫度參數（0-1）
AI_TEMPERATURE = float(os.getenv("AI_TEMPERATURE", "0.7"))

# AI 最大 token 數
AI_MAX_TOKENS = int(os.getenv("AI_MAX_TOKENS", "500"))

# ============ Logging Configuration ============
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_TO_FILE = os.getenv("LOG_TO_FILE", "false").lower() == "true"
LOG_FILE_PATH = os.getenv("LOG_FILE_PATH", "logs/polymarket_backend.log")

# ============ Feature Flags ============
ENABLE_AI_PREDICTION = os.getenv("ENABLE_AI_PREDICTION", "true").lower() == "true"
ENABLE_WHALE_DETECTION = os.getenv("ENABLE_WHALE_DETECTION", "true").lower() == "true"
ENABLE_MARKET_FILTERING = os.getenv("ENABLE_MARKET_FILTERING", "true").lower() == "true"


# ============ Validation ============
def validate_config():
    """驗證配置是否完整"""
    errors = []
    
    if not DATABASE_URL:
        errors.append("DATABASE_URL is not set")
    
    if not OPENROUTER_API_KEY:
        errors.append("OPENROUTER_API_KEY is not set")
    
    if errors:
        raise ValueError(f"Configuration errors:\n" + "\n".join(f"  • {e}" for e in errors))


# Run validation on import
try:
    validate_config()
except ValueError as e:
    print(f"⚠️ Configuration Warning: {e}")
    print("Please set the required environment variables in .env file")
