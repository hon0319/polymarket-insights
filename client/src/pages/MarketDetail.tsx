import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, Brain, Activity, DollarSign } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

export default function MarketDetail() {
  const [, params] = useRoute("/market/:id");
  const marketId = params?.id ? parseInt(params.id) : 0;

  const { data: market, isLoading: marketLoading } = trpc.markets.getById.useQuery({ id: marketId });
  const { data: predictions, isLoading: predictionsLoading } = trpc.predictions.getByMarketId.useQuery({ marketId });
  const { data: trades, isLoading: tradesLoading } = trpc.trades.getByMarketId.useQuery({ marketId, limit: 50 });
  const { data: latestPrediction } = trpc.predictions.getLatest.useQuery({ marketId });

  if (marketLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-8">
          <Skeleton className="h-12 w-48 mb-8" />
          <Skeleton className="h-64 w-full mb-8" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-12 text-center">
          <p className="text-xl font-semibold mb-4">市場不存在</p>
          <Link href="/markets">
            <Button>返回市場列表</Button>
          </Link>
        </Card>
      </div>
    );
  }

  // Prepare chart data
  const priceHistory = trades?.slice().reverse().map((trade, index) => ({
    time: new Date(trade.timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
    price: trade.price / 100,
    amount: trade.amount / 100,
  })) || [];

  const volumeData = trades?.slice(0, 20).reverse().map((trade) => ({
    time: new Date(trade.timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
    volume: trade.amount / 100,
    side: trade.side,
  })) || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-6">
          <Link href="/markets">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回市場列表
            </Button>
          </Link>
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {market.category && (
                  <Badge variant="secondary">{market.category}</Badge>
                )}
                {market.isActive && (
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/50">
                    活躍中
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold neon-glow-pink mb-2">
                {market.title}
              </h1>
              {market.question && (
                <p className="text-muted-foreground">{market.question}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground mb-1">當前價格</p>
              <p className="text-4xl font-black text-primary neon-glow-pink">
                ${(market.currentPrice / 100).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">24h 交易量</p>
            </div>
            <p className="text-2xl font-bold">${((market.volume24h || 0) / 100).toLocaleString()}</p>
          </Card>

          <Card className="p-6 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-5 w-5 text-secondary" />
              <p className="text-sm text-muted-foreground">總交易量</p>
            </div>
            <p className="text-2xl font-bold">${((market.totalVolume || 0) / 100).toLocaleString()}</p>
          </Card>

          <Card className="p-6 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="h-5 w-5 text-accent" />
              <p className="text-sm text-muted-foreground">交易次數</p>
            </div>
            <p className="text-2xl font-bold">{trades?.length || 0}</p>
          </Card>

          <Card className="p-6 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <Brain className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">AI 預測</p>
            </div>
            <p className="text-2xl font-bold">
              {latestPrediction?.consensusVote || "N/A"}
            </p>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="chart" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto">
            <TabsTrigger value="chart">價格走勢</TabsTrigger>
            <TabsTrigger value="volume">交易量</TabsTrigger>
            <TabsTrigger value="ai">AI 預測</TabsTrigger>
            <TabsTrigger value="trades">交易記錄</TabsTrigger>
          </TabsList>

          {/* Price Chart */}
          <TabsContent value="chart">
            <Card className="p-6 bg-card/50 backdrop-blur-sm">
              <h3 className="text-xl font-bold mb-6">價格走勢圖</h3>
              {priceHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={priceHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" />
                    <YAxis stroke="rgba(255,255,255,0.5)" />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(15, 20, 45, 0.9)', border: '1px solid rgba(255,20,147,0.5)' }}
                    />
                    <Line type="monotone" dataKey="price" stroke="rgb(255, 20, 147)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-96 flex items-center justify-center text-muted-foreground">
                  暫無價格數據
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Volume Chart */}
          <TabsContent value="volume">
            <Card className="p-6 bg-card/50 backdrop-blur-sm">
              <h3 className="text-xl font-bold mb-6">交易量分析</h3>
              {volumeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={volumeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" />
                    <YAxis stroke="rgba(255,255,255,0.5)" />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(15, 20, 45, 0.9)', border: '1px solid rgba(0,255,255,0.5)' }}
                    />
                    <Bar dataKey="volume" fill="rgb(0, 255, 255)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-96 flex items-center justify-center text-muted-foreground">
                  暫無交易量數據
                </div>
              )}
            </Card>
          </TabsContent>

          {/* AI Predictions */}
          <TabsContent value="ai">
            <Card className="p-6 bg-card/50 backdrop-blur-sm">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Brain className="h-6 w-6 text-primary" />
                AI 共識預測
              </h3>
              {predictionsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : predictions && predictions.length > 0 ? (
                <div className="space-y-6">
                  {/* Latest Consensus */}
                  {latestPrediction && (
                    <div className="p-6 border-2 border-primary/50 rounded-lg neon-border">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-bold">最新共識</h4>
                        <Badge className="text-lg px-4 py-1">
                          {latestPrediction.consensusVote}
                        </Badge>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">信心指數</p>
                          <p className="text-2xl font-bold text-primary">
                            {latestPrediction.consensusConfidence}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">模型共識</p>
                          <p className="text-2xl font-bold text-secondary">
                            {latestPrediction.agreeModels}/{latestPrediction.totalModels}
                          </p>
                        </div>
                      </div>
                      {latestPrediction.reasoning && (
                        <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                          <p className="text-sm">{latestPrediction.reasoning}</p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-4">
                        {new Date(latestPrediction.createdAt).toLocaleString('zh-TW')}
                      </p>
                    </div>
                  )}

                  {/* Prediction History */}
                  <div>
                    <h4 className="text-lg font-bold mb-4">預測歷史</h4>
                    <div className="space-y-3">
                      {predictions.slice(0, 5).map((pred) => (
                        <div key={pred.id} className="p-4 border border-border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold">{pred.aiModel}</span>
                            <Badge variant={pred.prediction === "YES" ? "default" : "secondary"}>
                              {pred.prediction}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-muted-foreground">
                              信心: <span className="text-foreground font-semibold">{pred.confidence}%</span>
                            </span>
                            <span className="text-muted-foreground">
                              {new Date(pred.createdAt).toLocaleDateString('zh-TW')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  暫無 AI 預測數據
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Trades List */}
          <TabsContent value="trades">
            <Card className="p-6 bg-card/50 backdrop-blur-sm">
              <h3 className="text-xl font-bold mb-6">最近交易</h3>
              {tradesLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : trades && trades.length > 0 ? (
                <div className="space-y-2">
                  {trades.map((trade) => (
                    <div
                      key={trade.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Badge variant={trade.side === "YES" ? "default" : "secondary"}>
                          {trade.side}
                        </Badge>
                        {trade.isWhale && (
                          <Badge className="bg-accent/20 text-accent border-accent/50">
                            🐋 鯨魚
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">價格</p>
                          <p className="font-semibold">${(trade.price / 100).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">金額</p>
                          <p className="font-semibold">${(trade.amount / 100).toLocaleString()}</p>
                        </div>
                        <div className="text-right min-w-32">
                          <p className="text-xs text-muted-foreground">
                            {new Date(trade.timestamp).toLocaleString('zh-TW')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  暫無交易記錄
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
