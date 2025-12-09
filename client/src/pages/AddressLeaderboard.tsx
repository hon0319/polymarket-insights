import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Activity, Target } from "lucide-react";
import { Link } from "wouter";

export default function AddressLeaderboard() {
  const { data: stats, isLoading: statsLoading } = trpc.addresses.getStats.useQuery();
  const { data: leaderboard, isLoading: leaderboardLoading } = trpc.addresses.getLeaderboard.useQuery({
    metric: 'suspicion_score',
    limit: 20
  });

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getSuspicionColor = (score: number) => {
    if (score >= 75) return 'text-red-600 dark:text-red-400';
    if (score >= 50) return 'text-orange-600 dark:text-orange-400';
    if (score >= 25) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getSuspicionBadge = (score: number) => {
    if (score >= 75) return <Badge variant="destructive" className="ml-2">極高風險</Badge>;
    if (score >= 50) return <Badge variant="destructive" className="ml-2 bg-orange-600">高風險</Badge>;
    if (score >= 25) return <Badge variant="secondary" className="ml-2">中等風險</Badge>;
    return <Badge variant="outline" className="ml-2">低風險</Badge>;
  };

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">🕵️ 聰明錢追蹤器</h1>
        <p className="text-muted-foreground text-lg">
          發現並跟隨 Polymarket 上最成功的交易者
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">總追蹤地址</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.total_addresses || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.suspicious_addresses || 0} 個可疑地址
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">總交易量</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(stats?.total_volume || 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.total_trades || 0} 筆交易
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均勝率</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.avg_win_rate?.toFixed(1) || 0}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  已結算市場
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均可疑度</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.avg_suspicion_score?.toFixed(1) || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  滿分 100
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>🏆 可疑度排行榜</CardTitle>
          <CardDescription>
            根據交易模式、勝率和時機分析，這些地址可能擁有內幕資訊或優秀的交易策略
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboardLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">排名</TableHead>
                    <TableHead>地址</TableHead>
                    <TableHead className="text-right">可疑度分數</TableHead>
                    <TableHead className="text-right">勝率</TableHead>
                    <TableHead className="text-right">總交易量</TableHead>
                    <TableHead className="text-right">交易次數</TableHead>
                    <TableHead className="text-right">平均交易額</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard?.map((address, index) => (
                    <TableRow key={address.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {index === 0 && <span className="text-2xl">🥇</span>}
                        {index === 1 && <span className="text-2xl">🥈</span>}
                        {index === 2 && <span className="text-2xl">🥉</span>}
                        {index > 2 && <span className="text-muted-foreground">#{index + 1}</span>}
                      </TableCell>
                      <TableCell>
                        <Link href={`/address/${address.id}`}>
                          <div className="flex items-center space-x-2">
                            <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                              {formatAddress(address.address)}
                            </code>
                            {address.is_suspicious && (
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                            )}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                          <span className={`text-lg font-bold ${getSuspicionColor(address.suspicion_score)}`}>
                            {address.suspicion_score}
                          </span>
                          {getSuspicionBadge(address.suspicion_score)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {address.win_rate ? (
                          <div className="flex items-center justify-end space-x-1">
                            <span className="font-medium">{address.win_rate.toFixed(1)}%</span>
                            {address.win_rate >= 60 ? (
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(address.total_volume)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {address.total_trades}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(address.avg_trade_size)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="mt-8 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-blue-900 dark:text-blue-100">💡 關於可疑度分數</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800 dark:text-blue-200">
          <p className="mb-4">
            可疑度分數是基於多個維度計算的綜合指標，用於識別可能擁有內幕資訊或優秀交易策略的地址：
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>勝率異常高（30 分）</strong>：在已結算市場中的成功率超過 70%</li>
            <li><strong>經常早期下注（25 分）</strong>：在市場價格大幅變動前 24-72 小時就下注</li>
            <li><strong>大額交易（20 分）</strong>：平均交易金額遠高於普通用戶</li>
            <li><strong>時機精準（15 分）</strong>：總是在最佳時機進出市場</li>
            <li><strong>選擇性參與（10 分）</strong>：只參與特定類型的市場</li>
          </ul>
          <p className="mt-4 text-sm">
            ⚠️ <strong>免責聲明：</strong>高可疑度分數並不意味著該地址一定從事內幕交易，可能只是交易策略優秀或運氣好。
            本平台提供的數據僅供參考，不構成任何投資建議。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
