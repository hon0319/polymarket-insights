import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, TrendingUp, Brain, Activity, Settings, LogOut } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();

  const { data: markets, isLoading: marketsLoading } = trpc.markets.list.useQuery({ limit: 10 });
  const { data: whaleTrades, isLoading: whaleLoading } = trpc.trades.getWhaleTrades.useQuery({ limit: 20 });
  const { data: alerts } = trpc.alerts.list.useQuery();
  const { data: notifications } = trpc.notifications.list.useQuery({ limit: 10 });
  const { data: unreadCount } = trpc.notifications.getUnreadCount.useQuery();
  const { data: subscription } = trpc.subscriptions.getMy.useQuery();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      logout();
      toast.success("已成功登出");
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-12 text-center">
          <p className="text-xl font-semibold mb-4">請先登入</p>
          <a href={"/api/oauth/login"}>
            <Button>登入</Button>
          </a>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold neon-glow-pink">儀表板</h1>
              <p className="text-muted-foreground mt-1">歡迎回來，{user.name || user.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/settings">
                <Button variant="outline" size="sm">
                  <Settings className="mr-2 h-4 w-4" />
                  設定
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                登出
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Subscription Status */}
        <Card className="p-6 mb-8 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-xl font-bold mb-2">訂閱狀態</h3>
              <div className="flex items-center gap-3">
                <Badge className="text-lg px-4 py-1">
                  {user.subscriptionTier === "free" ? "免費版" :
                   user.subscriptionTier === "basic" ? "基礎版" :
                   user.subscriptionTier === "pro" ? "專業版" : "企業版"}
                </Badge>
                {subscription && (
                  <span className="text-sm text-muted-foreground">
                    到期日: {new Date(subscription.currentPeriodEnd).toLocaleDateString('zh-TW')}
                  </span>
                )}
              </div>
            </div>
            {user.subscriptionTier === "free" && (
              <Link href="/pricing">
                <Button className="neon-border">
                  升級訂閱
                </Button>
              </Link>
            )}
          </div>
        </Card>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Recent Markets */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-primary" />
                  熱門市場
                </h2>
                <Link href="/markets">
                  <Button variant="outline" size="sm">查看全部</Button>
                </Link>
              </div>

              {marketsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : markets && markets.length > 0 ? (
                <div className="space-y-4">
                  {markets.map((market) => (
                    <Link key={market.id} href={`/market/${market.id}`}>
                      <Card className="p-4 bg-card/50 backdrop-blur-sm border-border hover:border-primary/50 transition-all cursor-pointer">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {market.category && (
                                <Badge variant="secondary" className="text-xs">{market.category}</Badge>
                              )}
                            </div>
                            <h3 className="font-semibold mb-1 line-clamp-2">{market.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              24h 交易量: ${((market.volume24h || 0) / 100).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">
                              ${(market.currentPrice / 100).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center bg-card/50">
                  <p className="text-muted-foreground">暫無市場數據</p>
                </Card>
              )}
            </div>

            {/* Whale Trades */}
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Activity className="h-6 w-6 text-accent" />
                🐋 大額交易
              </h2>

              {whaleLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : whaleTrades && whaleTrades.length > 0 ? (
                <div className="space-y-3">
                  {whaleTrades.slice(0, 10).map((trade) => (
                    <Card key={trade.id} className="p-4 bg-card/50 backdrop-blur-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant={trade.side === "YES" ? "default" : "secondary"}>
                            {trade.side}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Market #{trade.marketId}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">${(trade.amount / 100).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(trade.timestamp).toLocaleTimeString('zh-TW')}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center bg-card/50">
                  <p className="text-muted-foreground">暫無大額交易</p>
                </Card>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Notifications */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  通知
                  {unreadCount && unreadCount > 0 && (
                    <Badge className="ml-2">{unreadCount}</Badge>
                  )}
                </h2>
              </div>

              {notifications && notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.slice(0, 5).map((notif) => (
                    <Card key={notif.id} className={`p-4 ${notif.isRead ? 'bg-card/30' : 'bg-card/50 border-primary/30'}`}>
                      <h4 className="font-semibold mb-1">{notif.title}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2">{notif.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(notif.createdAt).toLocaleString('zh-TW')}
                      </p>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center bg-card/50">
                  <p className="text-sm text-muted-foreground">暫無通知</p>
                </Card>
              )}
            </div>

            {/* Alerts */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Brain className="h-5 w-5 text-accent" />
                  我的警報
                </h2>
                <Link href="/alerts">
                  <Button variant="outline" size="sm">管理</Button>
                </Link>
              </div>

              {alerts && alerts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.slice(0, 5).map((alert) => (
                    <Card key={alert.id} className="p-4 bg-card/50">
                      <div className="flex items-center justify-between mb-2">
                        <Badge>{alert.alertType}</Badge>
                        <Badge variant={alert.isActive ? "default" : "secondary"}>
                          {alert.isActive ? "啟用" : "停用"}
                        </Badge>
                      </div>
                      {alert.threshold && (
                        <p className="text-sm text-muted-foreground">
                          閾值: ${(alert.threshold / 100).toLocaleString()}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center bg-card/50">
                  <p className="text-sm text-muted-foreground mb-3">尚未設定警報</p>
                  <Link href="/alerts">
                    <Button size="sm">創建警報</Button>
                  </Link>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
