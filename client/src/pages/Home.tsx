import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { TrendingUp, Brain, Bell, BarChart3, Zap, Shield, ArrowRight, TrendingDown } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  
  // 獲取最新的大額交易（用於實時演示）
  const { data: whaleTrades, isLoading } = trpc.trades.getWhaleTrades.useQuery(
    { limit: 5 },
    { refetchInterval: 10000 } // 每 10 秒刷新一次
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Neon grid background */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(255, 20, 147, 0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }} />
        </div>

        <div className="container relative py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Logo/Brand */}
            <div className="inline-block">
              <h1 className="text-6xl md:text-8xl font-black tracking-tight neon-glow-pink">
                BENTANA
              </h1>
              <p className="text-2xl md:text-3xl font-bold tracking-widest neon-glow-cyan mt-2">
                INSIGHTS
              </p>
            </div>

            {/* Tagline */}
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              多元預測市場分析平台
              <br />
              <span className="text-primary">政治</span> · <span className="text-secondary">加密貨幣</span> · <span className="text-accent">體育</span> · <span className="text-primary">娛樂</span>
            </p>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mt-4">
              AI 驅動的實時分析 · 智能預測 · 大額警報
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
              {isAuthenticated ? (
                <Link href="/dashboard">
                  <Button size="lg" className="text-lg px-8 py-6 neon-border">
                    <Zap className="mr-2 h-5 w-5" />
                    進入儀表板
                  </Button>
                </Link>
              ) : (
                <a href={getLoginUrl()}>
                  <Button size="lg" className="text-lg px-8 py-6 neon-border">
                    <Zap className="mr-2 h-5 w-5" />
                    開始使用
                  </Button>
                </a>
              )}
              <Link href="/markets">
                <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                  探索市場
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Decorative lines */}
        <div className="absolute left-0 top-1/4 w-1 h-64 bg-gradient-to-b from-primary/50 to-transparent" />
        <div className="absolute right-0 top-1/3 w-1 h-64 bg-gradient-to-b from-secondary/50 to-transparent" />
      </section>

      {/* Live Demo Section */}
      <section className="py-24 border-t border-border bg-gradient-to-b from-background to-background/50">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 neon-glow-pink">
              實時演示
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              查看最新的大額交易和 AI 預測結果，體驗 Bentana 的實時分析能力
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : whaleTrades && whaleTrades.length > 0 ? (
            <div className="space-y-4 max-w-4xl mx-auto">
              {whaleTrades.slice(0, 5).map((trade) => (
                <Link key={trade.id} href={`/market/${trade.marketId}`}>
                  <Card 
                    className="p-6 bg-card/50 backdrop-blur-sm border-border hover:border-primary/50 transition-all duration-300 group cursor-pointer hover:scale-[1.01] hover:shadow-lg hover:shadow-primary/10"
                  >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs font-bold rounded ${
                          trade.side === 'YES' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {trade.side}
                        </span>
                        {trade.category && (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-primary/10 text-primary">
                            {trade.category}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors line-clamp-2">
                        {trade.marketTitle}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(trade.timestamp).toLocaleString('zh-TW', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">
                          ${(trade.amount / 100).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">交易金額</p>
                      </div>
                      
                      {trade.consensusVote && (
                        <div className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30">
                          <div className="flex items-center gap-1">
                            <Brain className="h-4 w-4 text-primary" />
                            <span className="text-xs font-medium text-muted-foreground">AI 預測</span>
                          </div>
                          <span className={`text-lg font-bold ${
                            trade.consensusVote === 'YES' ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {trade.consensusVote}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {trade.consensusConfidence}% 信心
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  </Card>
                </Link>
              ))}
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
                <Link href="/whale-trades">
                  <Button size="lg" className="neon-border">
                    查看所有大額交易
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/addresses">
                  <Button size="lg" variant="outline" className="border-pink-600 text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950">
                    🕵️ 追蹤聰明錢
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <Card className="p-12 text-center bg-card/50 backdrop-blur-sm border-border max-w-2xl mx-auto">
              <TrendingDown className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg text-muted-foreground mb-4">
                正在等待實時交易數據...
              </p>
              <p className="text-sm text-muted-foreground">
                Python 後端正在連接 Polymarket，大額交易將在此展示
              </p>
            </Card>
          )}
        </div>
      </section>

      {/* Category Stats Section */}
      <CategoryStatsSection />

      {/* Features Section */}
      <section className="py-24 border-t border-border">
        <div className="container">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 neon-glow-cyan">
            核心功能
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="p-6 bg-card/50 backdrop-blur-sm border-border hover:border-primary/50 transition-all duration-300 group">
                <div className="mb-4 inline-block p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 border-t border-border">
        <div className="container">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 neon-glow-pink">
            訂閱方案
          </h2>
          <p className="text-center text-muted-foreground mb-16 text-lg">
            選擇最適合您的方案，隨時升級或取消
          </p>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingTiers.map((tier, index) => (
              <Card 
                key={index} 
                className={`p-8 bg-card/50 backdrop-blur-sm border-2 transition-all duration-300 hover:scale-105 ${
                  tier.featured ? 'border-primary neon-border' : 'border-border hover:border-primary/30'
                }`}
              >
                {tier.featured && (
                  <div className="text-center mb-4">
                    <span className="inline-block px-4 py-1 text-sm font-bold bg-primary text-primary-foreground rounded-full">
                      最受歡迎
                    </span>
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-black">${tier.price}</span>
                  <span className="text-muted-foreground">/月</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start">
                      <span className="text-primary mr-2">✓</span>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  className="w-full" 
                  variant={tier.featured ? "default" : "outline"}
                  disabled={tier.price === 0}
                >
                  {tier.price === 0 ? "當前方案" : "選擇方案"}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-center md:text-left">
              <p className="font-bold text-lg neon-glow-pink">BENTANA INSIGHTS</p>
              <p className="text-sm text-muted-foreground mt-1">
                多元預測市場分析平台 · AI 驅動的實時分析
              </p>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">關於我們</a>
              <a href="#" className="hover:text-primary transition-colors">使用條款</a>
              <a href="#" className="hover:text-primary transition-colors">隱私政策</a>
              <a href="#" className="hover:text-primary transition-colors">聯繫我們</a>
            </div>
          </div>
          <div className="text-center mt-8 text-sm text-muted-foreground">
            © 2025 Bentana. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    icon: TrendingUp,
    title: "多元市場追蹤",
    description: "追蹤政治、加密貨幣、體育、娛樂等多類別預測市場，實時掌握市場動態。"
  },
  {
    icon: Brain,
    title: "AI 共識預測",
    description: "多個 AI 模型並行分析，形成共識預測，提供更可靠的市場判斷和信心指數。"
  },
  {
    icon: Bell,
    title: "大額交易警報",
    description: "自動追蹤「鯨魚」級別的大額交易，及時通知您市場中的重要資金流動。"
  },
  {
    icon: BarChart3,
    title: "數據可視化",
    description: "直觀的圖表展示價格走勢、交易量變化和市場趨勢，幫助您快速理解市場狀況。"
  },
  {
    icon: Shield,
    title: "個人化警報",
    description: "自定義關注的市場和觸發條件，當符合條件時立即收到通知，不錯過任何機會。"
  },
  {
    icon: Zap,
    title: "閃電般快速",
    description: "優化的查詢性能和緩存機制，確保您能以最快的速度獲取所需的市場信息。"
  }
];

const pricingTiers = [
  {
    name: "免費版",
    price: 0,
    featured: false,
    features: [
      "查看最近 10 個市場",
      "延遲 5 分鐘的數據",
      "每日 3 次 AI 預測查看",
      "基礎市場過濾功能"
    ]
  },
  {
    name: "專業版",
    price: 49,
    featured: true,
    features: [
      "查看所有市場",
      "實時數據更新",
      "無限 AI 預測查看",
      "大額交易警報",
      "歷史數據下載",
      "個人化警報設定",
      "優先 AI 分析",
      "API 訪問（限額）"
    ]
  },
  {
    name: "企業版",
    price: 199,
    featured: false,
    features: [
      "專業版所有功能",
      "無限 API 訪問",
      "白標服務",
      "專屬客服支持",
      "自定義數據導出",
      "團隊協作功能"
    ]
  }
];

// Category Stats Section Component
function CategoryStatsSection() {
  const { data: categoryStats, isLoading } = trpc.markets.getCategoryStats.useQuery();

  if (isLoading) {
    return (
      <section className="py-24 border-t border-border bg-gradient-to-b from-background/50 to-background">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 neon-glow-cyan">
              市場分布
            </h2>
            <p className="text-lg text-muted-foreground">
              探索不同類別的預測市場
            </p>
          </div>
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </section>
    );
  }

  if (!categoryStats || categoryStats.length === 0) {
    return null;
  }

  const categoryColors: Record<string, string> = {
    'Politics': 'from-blue-500/20 to-blue-600/20 border-blue-500/50',
    'Crypto': 'from-orange-500/20 to-orange-600/20 border-orange-500/50',
    'Sports': 'from-green-500/20 to-green-600/20 border-green-500/50',
    'Entertainment': 'from-purple-500/20 to-purple-600/20 border-purple-500/50',
    'Economics': 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/50',
    'Other': 'from-gray-500/20 to-gray-600/20 border-gray-500/50'
  };

  const categoryLabels: Record<string, string> = {
    'Politics': '政治',
    'Crypto': '加密貨幣',
    'Sports': '體育',
    'Entertainment': '娛樂',
    'Economics': '經濟',
    'Other': '其他'
  };

  return (
    <section className="py-24 border-t border-border bg-gradient-to-b from-background/50 to-background">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 neon-glow-cyan">
            市場分布
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            探索不同類別的預測市場，找到您感興趣的領域
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-6xl mx-auto">
          {categoryStats.map((stat) => {
            // Use dedicated category pages for Crypto and Sports
            const categoryUrls: Record<string, string> = {
              'Crypto': '/category/crypto',
              'Sports': '/category/sports',
            };
            const href = categoryUrls[stat.category] || `/markets?category=${stat.category}`;
            
            return (
            <Link key={stat.category} href={href}>
              <Card className={`p-6 bg-gradient-to-br ${categoryColors[stat.category] || categoryColors['Other']} backdrop-blur-sm border-2 hover:scale-105 transition-all duration-300 cursor-pointer group h-full`}>
                <div className="text-center">
                  <div className="text-3xl font-black mb-2 group-hover:scale-110 transition-transform">
                    {stat.count}
                  </div>
                  <div className="text-sm font-semibold mb-1">
                    {categoryLabels[stat.category] || stat.category}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    市場
                  </div>
                </div>
              </Card>
            </Link>
            );
          })}
        </div>

        <div className="text-center mt-8">
          <Link href="/markets">
            <Button variant="outline" size="lg">
              查看所有市場
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
