import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, TrendingUp, TrendingDown, Clock, Activity, Brain, Target, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Link } from "wouter";

export default function WhaleTrades() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  // 獲取大額交易數據
  const { data: whaleTrades, isLoading, refetch } = trpc.trades.getWhaleTrades.useQuery(
    { limit: 50 },
    {
      refetchInterval: autoRefresh ? 5000 : false, // 每 5 秒自動刷新
    }
  );

  // 獲取所有可用的分類
  const categories = useMemo(() => {
    if (!whaleTrades) return ["all"];
    const cats = new Set(whaleTrades.map(t => t.category).filter(Boolean));
    return ["all", ...Array.from(cats)];
  }, [whaleTrades]);

  // 根據分類篩選交易
  const filteredTrades = useMemo(() => {
    if (!whaleTrades) return [];
    if (selectedCategory === "all") return whaleTrades;
    return whaleTrades.filter(t => t.category === selectedCategory);
  }, [whaleTrades, selectedCategory]);

  // 計算統計數據（基於篩選後的數據）
  const stats = {
    totalTrades: filteredTrades?.length || 0,
    totalVolume: filteredTrades?.reduce((sum, t) => sum + t.amount, 0) || 0,
    withPredictions: filteredTrades?.filter(t => t.consensusVote !== null).length || 0,
    avgConfidence: filteredTrades && filteredTrades.length > 0
      ? Math.round(
          filteredTrades
            .filter(t => t.consensusConfidence !== null)
            .reduce((sum, t) => sum + (t.consensusConfidence || 0), 0) /
          Math.max(1, filteredTrades.filter(t => t.consensusConfidence !== null).length)
        )
      : 0,
  };

  // 格式化價格（從 cents 轉為美元）
  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  // 格式化金額
  const formatAmount = (cents: number) => {
    const dollars = cents / 100;
    if (dollars >= 1000) {
      return `$${(dollars / 1000).toFixed(1)}k`;
    }
    return `$${dollars.toFixed(0)}`;
  };

  // 格式化時間
  const formatTime = (timestamp: Date) => {
    return formatDistanceToNow(new Date(timestamp), {
      addSuffix: true,
      locale: zhTW,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#0f1535] to-[#0a0e27]">
      {/* Header */}
      <header className="border-b border-cyan-500/20 bg-[#0a0e27]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 flex items-center gap-3">
                <Activity className="h-8 w-8 text-pink-500" />
                🐋 大額交易追蹤
              </h1>
              <p className="text-cyan-400/70 mt-1">實時監控 Bentana 鯨魚動向 + AI 預測分析</p>
            </div>
            
            <div className="flex items-center gap-4">
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={autoRefresh ? "bg-cyan-500 hover:bg-cyan-600" : "border-cyan-500/30 text-cyan-400"}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`} />
                {autoRefresh ? "自動刷新" : "手動模式"}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
                className="border-cyan-500/30 text-cyan-400"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                立即刷新
              </Button>
              
              <Link href="/">
                <Button variant="outline" size="sm" className="border-pink-500/30 text-pink-400">
                  返回首頁
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Category Filter */}
        <Card className="bg-gradient-to-r from-[#0f1535]/80 to-[#1a1f3a]/80 border-cyan-500/20 p-4 mb-6">
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-cyan-400" />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48 bg-[#0a0e27]/50 border-cyan-500/30 text-cyan-400">
                <SelectValue placeholder="選擇分類" />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1535] border-cyan-500/30">
                <SelectItem value="all">所有分類</SelectItem>
                {categories.filter(c => c !== "all").map(category => (
                  <SelectItem key={category || "other"} value={category || "Other"}>
                    {getCategoryLabel(category)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-cyan-400/70">
              顯示 {filteredTrades?.length || 0} 筆交易
            </span>
          </div>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 border-pink-500/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-pink-400/70 text-sm">總交易數</p>
                <p className="text-3xl font-bold text-pink-400 mt-1">
                  {stats.totalTrades}
                </p>
              </div>
              <TrendingUp className="w-12 h-12 text-pink-400/30" />
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-400/70 text-sm">總交易額</p>
                <p className="text-3xl font-bold text-cyan-400 mt-1">
                  {formatAmount(stats.totalVolume)}
                </p>
              </div>
              <TrendingDown className="w-12 h-12 text-cyan-400/30" />
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-400/70 text-sm">AI 預測數</p>
                <p className="text-3xl font-bold text-purple-400 mt-1">
                  {stats.withPredictions}
                </p>
                <p className="text-xs text-purple-400/50 mt-1">
                  {stats.totalTrades > 0 ? Math.round((stats.withPredictions / stats.totalTrades) * 100) : 0}% 覆蓋率
                </p>
              </div>
              <Brain className="w-12 h-12 text-purple-400/30" />
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-pink-500/10 to-cyan-500/10 border-pink-500/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-pink-400/70 text-sm">平均信心</p>
                <p className="text-3xl font-bold text-pink-400 mt-1">
                  {stats.avgConfidence}%
                </p>
              </div>
              <Target className="w-12 h-12 text-pink-400/30" />
            </div>
          </Card>
        </div>

        {/* Trades List */}
        <div className="space-y-4">
          {isLoading && (
            <div className="text-center py-12">
              <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
              <p className="text-cyan-400/70">載入中...</p>
            </div>
          )}

          {!isLoading && (!filteredTrades || filteredTrades.length === 0) && (
            <Card className="bg-[#0f1535]/50 border-cyan-500/20 p-12 text-center">
              <Activity className="w-16 h-16 text-cyan-400/30 mx-auto mb-4" />
              <p className="text-cyan-400/70 text-lg">
                {selectedCategory === "all" ? "暫無大額交易數據" : `該分類下暫無大額交易`}
              </p>
              <p className="text-cyan-400/50 text-sm mt-2">
                請確保 Python 後端服務正在運行並連接到 Bentana
              </p>
              <p className="text-cyan-400/50 text-xs mt-4">
                啟動命令: cd python-backend && ./start.sh
              </p>
            </Card>
          )}

          {!isLoading && filteredTrades && filteredTrades.length > 0 && (
            <>
              {filteredTrades.map((trade) => (
                <Link key={trade.id} href={`/market/${trade.marketId}`}>
                  <Card
                    className="bg-gradient-to-r from-[#0f1535]/80 to-[#1a1f3a]/80 border-cyan-500/20 hover:border-cyan-500/40 transition-all p-6 cursor-pointer hover:scale-[1.02] hover:shadow-lg hover:shadow-cyan-500/20"
                  >
                  <div className="flex items-start justify-between gap-6">
                    {/* 左側：市場信息 */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge
                          variant={trade.side === "YES" ? "default" : "destructive"}
                          className={
                            trade.side === "YES"
                              ? "bg-green-500/20 text-green-400 border-green-500/30"
                              : "bg-red-500/20 text-red-400 border-red-500/30"
                          }
                        >
                          {trade.side}
                        </Badge>
                        
                        {trade.category && (
                          <Badge variant="outline" className={getCategoryColor(trade.category)}>
                            {getCategoryLabel(trade.category)}
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">
                        {trade.marketTitle}
                      </h3>

                      <div className="flex items-center gap-6 text-sm text-cyan-400/70">
                        <div>
                          <span className="text-cyan-400/50">價格:</span>{" "}
                          <span className="text-cyan-400 font-mono">
                            ${formatPrice(trade.price)}
                          </span>
                        </div>
                        <div>
                          <span className="text-cyan-400/50">金額:</span>{" "}
                          <span className="text-pink-400 font-bold font-mono">
                            {formatAmount(trade.amount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-cyan-400/50">時間:</span>{" "}
                          <span className="text-purple-400">{formatTime(trade.timestamp)}</span>
                        </div>
                      </div>
                    </div>

                    {/* 右側：AI 預測 */}
                    <div className="flex flex-col items-end gap-3">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-cyan-400">
                          {formatAmount(trade.amount)}
                        </div>
                        <div className="text-xs text-cyan-400/50 mt-1">
                          ID: {trade.tradeId.slice(0, 8)}...
                        </div>
                      </div>

                      {/* AI 預測徽章 */}
                      {trade.consensusVote ? (
                        <div className="flex flex-col items-end gap-2 px-4 py-3 bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Brain className="h-4 w-4 text-pink-400" />
                            <Badge
                              variant="outline"
                              className={
                                trade.consensusVote === "YES"
                                  ? "border-green-500/50 text-green-400 bg-green-500/10"
                                  : trade.consensusVote === "NO"
                                  ? "border-red-500/50 text-red-400 bg-red-500/10"
                                  : "border-yellow-500/50 text-yellow-400 bg-yellow-500/10"
                              }
                            >
                              AI: {trade.consensusVote}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Target className="h-3 w-3 text-pink-400" />
                            <span className="text-xs text-pink-400 font-semibold">
                              {trade.consensusConfidence}% 信心
                            </span>
                          </div>
                          
                          {trade.totalModels && (
                            <div className="text-xs text-purple-400/70">
                              {trade.agreeModels}/{trade.totalModels} 模型同意
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="px-4 py-3 bg-slate-800/30 border border-slate-700/30 rounded-lg">
                          <div className="text-xs text-slate-400 flex items-center gap-2">
                            <Clock className="h-3 w-3 animate-pulse" />
                            等待 AI 分析...
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  </Card>
                </Link>
              ))}
            </>
          )}
        </div>

        {/* Info Card */}
        {filteredTrades && filteredTrades.length > 0 && (
          <Card className="p-6 mt-8 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-cyan-500/30">
            <h3 className="text-lg font-bold text-cyan-400 mb-3 flex items-center gap-2">
              <Brain className="h-5 w-5" />
              關於 AI 預測分析
            </h3>
            <div className="space-y-2 text-sm text-cyan-400/70">
              <p>• 自動追蹤所有超過 $100 的 Bentana 交易</p>
              <p>• 檢測到大額交易時，自動觸發 AI Swarm 分析（GPT-4, Claude, Gemini）</p>
              <p>• 多模型共識投票，計算平均信心指數</p>
              <p>• 實時數據存儲到 MySQL 資料庫，每 5 秒自動刷新</p>
              <p>• 支援所有市場類別（政治、加密貨幣、體育等）</p>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}


// 獲取分類標籤
function getCategoryLabel(category: string | null): string {
  if (!category) return "其他";
  const labels: Record<string, string> = {
    "Politics": "政治",
    "Crypto": "加密貨幣",
    "Sports": "體育",
    "Entertainment": "娛樂",
    "Economics": "經濟",
    "Other": "其他",
  };
  return labels[category] || category;
}

// 獲取分類顏色
function getCategoryColor(category: string | null): string {
  if (!category) return "border-gray-500/30 text-gray-400";
  const colors: Record<string, string> = {
    "Politics": "border-blue-500/50 text-blue-400",
    "Crypto": "border-orange-500/50 text-orange-400",
    "Sports": "border-green-500/50 text-green-400",
    "Entertainment": "border-purple-500/50 text-purple-400",
    "Economics": "border-yellow-500/50 text-yellow-400",
    "Other": "border-gray-500/50 text-gray-400",
  };
  return colors[category] || colors["Other"];
}
