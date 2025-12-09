"""
市場分類器 - 根據標題關鍵字自動分類市場
"""

def categorize_market(title: str) -> str:
    """
    根據市場標題自動分類
    
    Args:
        title: 市場標題
    
    Returns:
        分類名稱（Politics, Crypto, Sports, Entertainment, Economics, Other）
    """
    title_lower = title.lower()
    
    # 政治類關鍵字
    politics_keywords = [
        "president", "election", "政治", "選舉", "trump", "biden", "harris",
        "senate", "congress", "governor", "政府", "party", "democrat", "republican",
        "policy", "legislation", "vote", "campaign", "白宮", "國會"
    ]
    
    # 加密貨幣類關鍵字
    crypto_keywords = [
        "bitcoin", "btc", "ethereum", "eth", "crypto", "加密", "coin", "token",
        "blockchain", "區塊鏈", "defi", "nft", "solana", "cardano", "dogecoin",
        "binance", "coinbase", "價格", "price"
    ]
    
    # 體育類關鍵字
    sports_keywords = [
        "sport", "體育", "football", "basketball", "baseball", "soccer", "nba",
        "nfl", "mlb", "nhl", "world cup", "olympics", "championship", "game",
        "match", "player", "team", "球", "賽", "冠軍"
    ]
    
    # 娛樂類關鍵字
    entertainment_keywords = [
        "movie", "film", "電影", "oscar", "emmy", "grammy", "music", "音樂",
        "celebrity", "明星", "actor", "actress", "演員", "show", "節目",
        "netflix", "disney", "award", "獎"
    ]
    
    # 經濟類關鍵字
    economics_keywords = [
        "economy", "經濟", "gdp", "inflation", "通膨", "stock", "股票", "market",
        "recession", "衰退", "fed", "interest rate", "利率", "unemployment",
        "失業", "trade", "貿易", "dollar", "美元"
    ]
    
    # 檢查分類
    for keyword in politics_keywords:
        if keyword in title_lower:
            return "Politics"
    
    for keyword in crypto_keywords:
        if keyword in title_lower:
            return "Crypto"
    
    for keyword in sports_keywords:
        if keyword in title_lower:
            return "Sports"
    
    for keyword in entertainment_keywords:
        if keyword in title_lower:
            return "Entertainment"
    
    for keyword in economics_keywords:
        if keyword in title_lower:
            return "Economics"
    
    return "Other"
