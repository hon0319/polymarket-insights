import { useParams, Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, XCircle, Clock, Bell, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AddressDetail() {
  const params = useParams();
  const addressId = params.id ? parseInt(params.id) : 1;

  const { data: address, isLoading: addressLoading } = trpc.addresses.getById.useQuery({ id: addressId });
  const { data: tradeHistory, isLoading: historyLoading } = trpc.addresses.getTradeHistory.useQuery({ addressId });
  const { data: marketPerformance, isLoading: performanceLoading } = trpc.addresses.getMarketPerformance.useQuery({ addressId });
  const { data: winRateTrend, isLoading: trendLoading } = trpc.addresses.getWinRateTrend.useQuery({ addressId });
  const { data: categoryFocus, isLoading: focusLoading } = trpc.addresses.getCategoryFocus.useQuery({ addressId });
  const { data: scoreBreakdown, isLoading: breakdownLoading } = trpc.addresses.getSuspicionScoreBreakdown.useQuery({ addressId });
  const { data: subscriptions } = trpc.alertSubscriptions.list.useQuery();
  const utils = trpc.useUtils();

  // 檢查是否已訂閱此地址
  const isSubscribed = subscriptions?.some(
    sub => sub.subscription_type === 'address' && sub.target_id === String(addressId) && sub.is_active
  );

  const createSubscriptionMutation = trpc.alertSubscriptions.create.useMutation({
    onSuccess: () => {
      utils.alertSubscriptions.list.invalidate();
      toast.success('訂閱成功！您將收到此地址的警報通知');
    },
    onError: (error) => {
      toast.error(`訂閱失敗：${error.message}`);
    }
  });

  const handleSubscribe = () => {
    if (!address) return;
    createSubscriptionMutation.mutate({
      subscription_type: 'address',
      target_id: String(addressId),
      target_name: `${address.address.slice(0, 6)}...${address.address.slice(-4)}`,
      alert_types: ['high_suspicion_address', 'suspicious_trade', 'large_trade'],
      is_active: true
    });
  };

  if (addressLoading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">地址不存在</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getSuspicionBadge = (score: number) => {
    if (score >= 70) return <Badge variant="destructive" className="text-sm">極高風險 🔴</Badge>;
    if (score >= 50) return <Badge className="bg-orange-500 text-white text-sm">高風險 🟠</Badge>;
    if (score >= 30) return <Badge className="bg-yellow-500 text-white text-sm">中等風險 🟡</Badge>;
    return <Badge variant="secondary" className="text-sm">低風險 🟢</Badge>;
  };

  const getOutcomeIcon = (outcome: string) => {
    if (outcome === 'won') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (outcome === 'lost') return <XCircle className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-yellow-500" />;
  };

  const COLORS = ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981'];

  return (
    <div className="container py-8 space-y-6">
      {/* 返回按鈕 */}
      <Link href="/addresses">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回排行榜
        </Button>
      </Link>

      {/* 地址基本資訊卡片 */}
      <Card className="border-pink-500/20 bg-gradient-to-br from-background to-pink-500/5">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold">
                {address.address.slice(0, 6)}...{address.address.slice(-4)}
              </CardTitle>
              <CardDescription className="text-base">
                首次出現：{new Date(address.first_seen_at).toLocaleDateString('zh-TW')} | 
                最後活躍：{new Date(address.last_active_at).toLocaleDateString('zh-TW')}
              </CardDescription>
            </div>
            <div className="text-right space-y-2">
              {getSuspicionBadge(address.suspicion_score)}
              <div className="text-3xl font-bold text-pink-500">{address.suspicion_score}</div>
              <div className="text-sm text-muted-foreground">可疑度分數</div>
              <Button
                variant={isSubscribed ? "secondary" : "default"}
                size="sm"
                onClick={handleSubscribe}
                disabled={isSubscribed || createSubscriptionMutation.isPending}
                className="mt-2"
              >
                {isSubscribed ? (
                  <>
                    <BellOff className="w-4 h-4 mr-2" />
                    已訂閱
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    訂閱此地址
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">勝率</div>
              <div className="text-2xl font-bold flex items-center gap-2">
                {address.win_rate}%
                {address.win_rate > 60 ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">總交易量</div>
              <div className="text-2xl font-bold">
                ${(address.total_volume / 1000).toFixed(1)}k
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">交易次數</div>
              <div className="text-2xl font-bold">{address.total_trades}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">平均交易額</div>
              <div className="text-2xl font-bold">
                ${address.avg_trade_size.toFixed(0)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 勝率趨勢圖表 */}
      <Card>
        <CardHeader>
          <CardTitle>勝率趨勢</CardTitle>
          <CardDescription>過去 12 個月的勝率變化</CardDescription>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
            </div>
          ) : winRateTrend && winRateTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={winRateTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="month" 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="win_rate" 
                  stroke="#ec4899" 
                  strokeWidth={2}
                  name="勝率 (%)"
                  dot={{ fill: '#ec4899', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              暫無趨勢數據
            </div>
          )}
        </CardContent>
      </Card>

      {/* 可疑度分數分解 */}
      <Card className="border-pink-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-pink-500" />
            可疑度分數詳細分解
          </CardTitle>
          <CardDescription>多維度評估系統（總分 100 分）</CardDescription>
        </CardHeader>
        <CardContent>
          {breakdownLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
            </div>
          ) : scoreBreakdown ? (
            <div className="space-y-4">
              {/* 總分 */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-pink-500/10 border border-pink-500/20">
                <div className="text-lg font-semibold">總可疑度分數</div>
                <div className="text-3xl font-bold text-pink-500">{scoreBreakdown.totalScore}</div>
              </div>

              {/* 分數分解 */}
              <div className="space-y-3">
                {/* 勝率異常高 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">🏆 勝率異常高</span>
                    <span className="text-muted-foreground">
                      {scoreBreakdown.breakdown.winRateScore} / {scoreBreakdown.maxScores.winRate}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-pink-500 transition-all"
                      style={{ width: `${(scoreBreakdown.breakdown.winRateScore / scoreBreakdown.maxScores.winRate) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    勝率超過 70% 的機率極低，可能有內幕資訊
                  </p>
                </div>

                {/* 經常早期下注 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">⏰ 經常早期下注</span>
                    <span className="text-muted-foreground">
                      {scoreBreakdown.breakdown.earlyTradingScore} / {scoreBreakdown.maxScores.earlyTrading}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 transition-all"
                      style={{ width: `${(scoreBreakdown.breakdown.earlyTradingScore / scoreBreakdown.maxScores.earlyTrading) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    在市場價格大幅變動前 24-72 小時就下注
                  </p>
                </div>

                {/* 大額交易 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">🐳 大額交易</span>
                    <span className="text-muted-foreground">
                      {scoreBreakdown.breakdown.tradeSizeScore} / {scoreBreakdown.maxScores.tradeSize}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-cyan-500 transition-all"
                      style={{ width: `${(scoreBreakdown.breakdown.tradeSizeScore / scoreBreakdown.maxScores.tradeSize) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    平均交易金額遠高於一般交易者
                  </p>
                </div>

                {/* 時機精準 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">🎯 時機精準</span>
                    <span className="text-muted-foreground">
                      {scoreBreakdown.breakdown.timingScore} / {scoreBreakdown.maxScores.timing}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${(scoreBreakdown.breakdown.timingScore / scoreBreakdown.maxScores.timing) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    進出市場的時機總是在最佳時刻
                  </p>
                </div>

                {/* 選擇性參與 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">🎯 選擇性參與</span>
                    <span className="text-muted-foreground">
                      {scoreBreakdown.breakdown.selectivityScore} / {scoreBreakdown.maxScores.selectivity}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-500 transition-all"
                      style={{ width: `${(scoreBreakdown.breakdown.selectivityScore / scoreBreakdown.maxScores.selectivity) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    只參與特定類型的市場，不隨意下注
                  </p>
                </div>
              </div>

              {/* 說明 */}
              <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                <p>⚠️ 注意：可疑度分數僅基於公開的鏈上數據和統計分析，不構成任何法律指控或投資建議。高分數並不意味著該地址一定從事內幕交易，可能只是交易策略優秀或運氣好。</p>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              無法載入分數分解
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 市場類別專注度 */}
        <Card>
          <CardHeader>
            <CardTitle>市場類別專注度</CardTitle>
            <CardDescription>交易分布按類別</CardDescription>
          </CardHeader>
          <CardContent>
            {focusLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
              </div>
            ) : categoryFocus && categoryFocus.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryFocus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, percentage }) => `${category} ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="percentage"
                  >
                    {categoryFocus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                暫無專注度數據
              </div>
            )}
          </CardContent>
        </Card>

        {/* 市場表現分析 */}
        <Card>
          <CardHeader>
            <CardTitle>市場表現分析</CardTitle>
            <CardDescription>按類別的勝率和 ROI</CardDescription>
          </CardHeader>
          <CardContent>
            {performanceLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
              </div>
            ) : marketPerformance && marketPerformance.length > 0 ? (
              <div className="space-y-3">
                {marketPerformance.map((perf) => (
                  <div key={perf.category} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="space-y-1">
                      <div className="font-semibold">{perf.category}</div>
                      <div className="text-sm text-muted-foreground">
                        {perf.total_trades} 筆交易 | ${(perf.total_volume / 1000).toFixed(1)}k
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-sm font-semibold text-pink-500">
                        {perf.win_rate}% 勝率
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ROI: {(perf.roi * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                暫無表現數據
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 交易歷史時間線 */}
      <Card>
        <CardHeader>
          <CardTitle>交易歷史</CardTitle>
          <CardDescription>最近的交易記錄</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-20 bg-muted rounded"></div>
              ))}
            </div>
          ) : tradeHistory && tradeHistory.length > 0 ? (
            <div className="space-y-3">
              {tradeHistory.map((trade) => (
                <div key={trade.id} className="flex items-start gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <div className="flex-shrink-0 mt-1">
                    {getOutcomeIcon(trade.outcome)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{trade.marketTitle}</span>
                      <Badge variant="outline" className="text-xs">{trade.category}</Badge>
                      <Badge variant={trade.side === 'YES' ? 'default' : 'secondary'} className="text-xs">
                        {trade.side}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>金額: ${trade.amount.toLocaleString()}</span>
                      <span>價格: ${trade.price}</span>
                      <span>{new Date(trade.timestamp).toLocaleString('zh-TW')}</span>
                    </div>
                    {trade.profit !== null && (
                      <div className={`text-sm font-semibold ${trade.profit > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {trade.profit > 0 ? '+' : ''}{trade.profit > 0 ? `$${trade.profit.toLocaleString()}` : `-$${Math.abs(trade.profit).toLocaleString()}`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              暫無交易記錄
            </div>
          )}
        </CardContent>
      </Card>

      {/* 警告說明 */}
      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-semibold">免責聲明</p>
              <p className="text-muted-foreground">
                本頁面顯示的可疑度分數僅基於公開的鏈上數據和統計分析，不構成任何法律指控或投資建議。
                高分數並不意味著該地址一定從事內幕交易，可能只是交易策略優秀或運氣好。
                請謹慎使用此資訊，並自行承擔投資風險。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
