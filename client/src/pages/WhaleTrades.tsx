import { useRealtime } from "@/contexts/RealtimeContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { Link } from "wouter";

export default function WhaleTrades() {
  const { isConnected, whaleTrades, lastUpdate } = useRealtime();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold neon-glow-pink flex items-center gap-3">
                <Activity className="h-8 w-8" />
                🐋 大額交易追蹤
              </h1>
              <p className="text-muted-foreground mt-1">實時監控 Polymarket 上的鯨魚級交易</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <Wifi className="h-5 w-5 text-green-500" />
                    <Badge className="bg-green-500/20 text-green-500 border-green-500/50">
                      已連接
                    </Badge>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-5 w-5 text-red-500" />
                    <Badge className="bg-red-500/20 text-red-500 border-red-500/50">
                      未連接
                    </Badge>
                  </>
                )}
              </div>
              <Link href="/">
                <Button variant="outline">返回首頁</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Connection Status */}
        {!isConnected && (
          <Card className="p-6 mb-8 bg-red-500/10 border-red-500/30">
            <div className="flex items-center gap-3">
              <WifiOff className="h-6 w-6 text-red-500" />
              <div>
                <h3 className="font-bold text-red-500">實時數據服務未連接</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  正在嘗試重新連接到數據服務器...
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">總交易數</p>
            </div>
            <p className="text-3xl font-bold">{whaleTrades.length}</p>
          </Card>

          <Card className="p-6 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="h-5 w-5 text-secondary" />
              <p className="text-sm text-muted-foreground">最後更新</p>
            </div>
            <p className="text-xl font-bold">
              {lastUpdate ? lastUpdate.toLocaleTimeString('zh-TW') : '--:--:--'}
            </p>
          </Card>

          <Card className="p-6 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="h-5 w-5 text-accent" />
              <p className="text-sm text-muted-foreground">連接狀態</p>
            </div>
            <p className="text-xl font-bold">
              {isConnected ? (
                <span className="text-green-500">運行中</span>
              ) : (
                <span className="text-red-500">離線</span>
              )}
            </p>
          </Card>
        </div>

        {/* Whale Trades List */}
        <Card className="p-6 bg-card/50 backdrop-blur-sm">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            實時大額交易
          </h2>

          {whaleTrades.length > 0 ? (
            <div className="space-y-3">
              {whaleTrades.map((trade, index) => (
                <div
                  key={`${trade.timestamp}-${index}`}
                  className="p-4 border border-border rounded-lg hover:border-primary/50 transition-all bg-background/50"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge 
                          variant={trade.side === "YES" ? "default" : "secondary"}
                          className="text-sm"
                        >
                          {trade.side}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(trade.timestamp).toLocaleString('zh-TW')}
                        </span>
                      </div>
                      <p className="font-semibold line-clamp-2">{trade.market}</p>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-1">交易金額</p>
                        <p className="text-2xl font-bold text-primary">
                          ${trade.amount.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-1">價格</p>
                        <p className="text-lg font-semibold">
                          ${trade.price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-24 text-center">
              <Activity className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-xl font-semibold text-muted-foreground mb-2">
                {isConnected ? "等待大額交易..." : "未連接到數據服務"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isConnected 
                  ? "當檢測到超過 $10,000 的交易時，將自動顯示在此處"
                  : "請確保 Python 後端服務正在運行"
                }
              </p>
            </div>
          )}
        </Card>

        {/* Info Card */}
        <Card className="p-6 mt-8 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30">
          <h3 className="text-lg font-bold mb-3">關於大額交易追蹤</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• 自動追蹤所有超過 $10,000 的 Polymarket 交易</p>
            <p>• 實時 WebSocket 連接，無延遲數據推送</p>
            <p>• 過濾掉接近結算價格（0.05 或 0.95）的交易</p>
            <p>• 排除加密貨幣和體育類市場</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
