import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Search, Filter } from "lucide-react";
import { Link } from "wouter";

export default function Markets() {
  const [category, setCategory] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);

  const { data: markets, isLoading } = trpc.markets.list.useQuery({
    category,
    limit,
    offset,
    isActive: true,
  });

  const filteredMarkets = markets?.filter(market =>
    market.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold neon-glow-pink">政治市場</h1>
              <p className="text-muted-foreground mt-1">實時追蹤 Polymarket 政治預測市場</p>
            </div>
            <Link href="/">
              <Button variant="outline">返回首頁</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Filters */}
        <Card className="p-6 mb-8 bg-card/50 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜尋市場..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="所有類別" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有類別</SelectItem>
                <SelectItem value="Politics">政治</SelectItem>
                <SelectItem value="Elections">選舉</SelectItem>
                <SelectItem value="Policy">政策</SelectItem>
              </SelectContent>
            </Select>
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
                <Card className="p-6 bg-card/50 backdrop-blur-sm border-border hover:border-primary/50 transition-all duration-300 cursor-pointer group h-full">
                  {/* Category Badge */}
                  {market.category && (
                    <div className="mb-3">
                      <span className="inline-block px-3 py-1 text-xs font-semibold bg-primary/20 text-primary rounded-full">
                        {market.category}
                      </span>
                    </div>
                  )}

                  {/* Title */}
                  <h3 className="text-lg font-bold mb-3 group-hover:text-primary transition-colors line-clamp-2">
                    {market.title}
                  </h3>

                  {/* Price */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">當前價格</p>
                      <p className="text-2xl font-bold text-primary">
                        ${(market.currentPrice / 100).toFixed(2)}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 ${market.currentPrice > 5000 ? 'text-green-500' : 'text-red-500'}`}>
                      {market.currentPrice > 5000 ? (
                        <TrendingUp className="h-5 w-5" />
                      ) : (
                        <TrendingDown className="h-5 w-5" />
                      )}
                    </div>
                  </div>

                  {/* Volume */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">24h 交易量</span>
                      <span className="font-semibold">${((market.volume24h || 0) / 100).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">總交易量</span>
                      <span className="font-semibold">${((market.totalVolume || 0) / 100).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Last Trade */}
                  {market.lastTradeTimestamp && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        最後交易: {new Date(market.lastTradeTimestamp).toLocaleString('zh-TW')}
                      </p>
                    </div>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center bg-card/50 backdrop-blur-sm">
            <p className="text-muted-foreground text-lg">沒有找到符合條件的市場</p>
            <p className="text-sm text-muted-foreground mt-2">請嘗試調整搜尋條件或過濾器</p>
          </Card>
        )}

        {/* Pagination */}
        {filteredMarkets && filteredMarkets.length >= limit && (
          <div className="flex justify-center gap-4 mt-8">
            <Button
              variant="outline"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              上一頁
            </Button>
            <Button
              variant="outline"
              onClick={() => setOffset(offset + limit)}
            >
              下一頁
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
