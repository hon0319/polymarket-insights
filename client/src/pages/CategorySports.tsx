import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Search, Trophy, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function CategorySports() {
  const [searchQuery, setSearchQuery] = useState("");
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  const { data: markets, isLoading } = trpc.markets.list.useQuery({
    category: "Sports",
    limit,
    offset,
    isActive: true,
  });

  const filteredMarkets = markets?.filter(market =>
    market.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate stats
  const totalMarkets = markets?.length || 0;
  const totalVolume = markets?.reduce((sum, m) => sum + (m.totalVolume || 0), 0) || 0;
  const avgPrice = markets && markets.length > 0
    ? markets.reduce((sum, m) => sum + m.currentPrice, 0) / markets.length
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-gradient-to-r from-green-500/10 to-green-600/10 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-8">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <Link href="/markets">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回市場列表
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline">返回首頁</Button>
              </Link>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-lg bg-green-500/20 border-2 border-green-500/50">
                <Trophy className="h-12 w-12 text-green-500" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold neon-glow-pink">體育市場</h1>
                <p className="text-muted-foreground mt-2 text-lg">
                  追蹤足球、籃球、網球等體育賽事的預測市場走勢
                </p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 bg-card/50 backdrop-blur-sm border-green-500/30">
                <div className="text-sm text-muted-foreground mb-1">活躍市場</div>
                <div className="text-2xl font-bold">{totalMarkets}</div>
              </Card>
              <Card className="p-4 bg-card/50 backdrop-blur-sm border-green-500/30">
                <div className="text-sm text-muted-foreground mb-1">總交易量</div>
                <div className="text-2xl font-bold">${(totalVolume / 100).toLocaleString()}</div>
              </Card>
              <Card className="p-4 bg-card/50 backdrop-blur-sm border-green-500/30">
                <div className="text-sm text-muted-foreground mb-1">平均價格</div>
                <div className="text-2xl font-bold">${(avgPrice / 100).toFixed(2)}</div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Search */}
        <Card className="p-6 mb-8 bg-card/50 backdrop-blur-sm border-green-500/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋體育市場..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        {/* Markets Grid */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </Card>
            ))}
          </div>
        ) : filteredMarkets && filteredMarkets.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMarkets.map((market) => (
              <Link key={market.id} href={`/market/${market.id}`}>
                <Card className="p-6 bg-card/50 backdrop-blur-sm border-border hover:border-green-500/50 transition-all duration-300 cursor-pointer group h-full">
                  {/* Title */}
                  <h3 className="text-lg font-bold mb-3 group-hover:text-green-500 transition-colors line-clamp-2">
                    {market.title}
                  </h3>

                  {/* Price */}
                  <div className="mb-4">
                    <div className="text-sm text-muted-foreground mb-1">當前價格</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-green-500">
                        ${(market.currentPrice / 100).toFixed(2)}
                      </span>
                      {market.currentPrice > 50 ? (
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  </div>

                  {/* Volume Stats */}
                  <div className="space-y-2 pt-4 border-t border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">24h 交易量</span>
                      <span className="font-semibold">
                        ${((market.volume24h || 0) / 100).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">總交易量</span>
                      <span className="font-semibold">
                        ${((market.totalVolume || 0) / 100).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* End Date */}
                  {market.endDate && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="text-xs text-muted-foreground">
                        結束時間: {new Date(market.endDate).toLocaleString('zh-TW')}
                      </div>
                    </div>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center bg-card/50 backdrop-blur-sm border-border">
            <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg text-muted-foreground mb-2">
              {searchQuery ? "未找到符合條件的體育市場" : "暫無體育市場數據"}
            </p>
            {searchQuery && (
              <Button
                variant="outline"
                onClick={() => setSearchQuery("")}
                className="mt-4"
              >
                清除搜尋
              </Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
