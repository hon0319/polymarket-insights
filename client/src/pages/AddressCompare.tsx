import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X, TrendingUp, Trophy, AlertTriangle } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export default function AddressCompare() {
  const [selectedAddresses, setSelectedAddresses] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // 搜索地址
  const { data: searchResults, isLoading: searchLoading } = trpc.addresses.search.useQuery(
    { query: searchQuery, limit: 10 },
    { enabled: searchQuery.length > 0 }
  );

  // 比較地址
  const { data: comparisonData, isLoading: compareLoading } = trpc.addresses.compare.useQuery(
    { addressIds: selectedAddresses },
    { enabled: selectedAddresses.length >= 2 }
  );

  const handleAddAddress = (addressId: number) => {
    if (selectedAddresses.length < 4 && !selectedAddresses.includes(addressId)) {
      setSelectedAddresses([...selectedAddresses, addressId]);
      setSearchQuery('');
      setShowSearchResults(false);
    }
  };

  const handleRemoveAddress = (addressId: number) => {
    setSelectedAddresses(selectedAddresses.filter(id => id !== addressId));
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value.toFixed(0)}`;
  };

  const getSuspicionBadge = (score: number) => {
    if (score >= 80) return <Badge variant="destructive" className="bg-red-500">極高風險</Badge>;
    if (score >= 60) return <Badge variant="destructive" className="bg-orange-500">高風險</Badge>;
    if (score >= 40) return <Badge className="bg-yellow-500">中等風險</Badge>;
    return <Badge className="bg-green-500">低風險</Badge>;
  };

  // 準備雷達圖數據
  const radarData = comparisonData ? [
    {
      metric: '勝率',
      ...Object.fromEntries(
        comparisonData.map((addr: any, idx: number) => [
          `地址${idx + 1}`,
          addr.win_rate || 0
        ])
      )
    },
    {
      metric: '可疑度',
      ...Object.fromEntries(
        comparisonData.map((addr: any, idx: number) => [
          `地址${idx + 1}`,
          addr.suspicion_score || 0
        ])
      )
    },
    {
      metric: '交易量',
      ...Object.fromEntries(
        comparisonData.map((addr: any, idx: number) => [
          `地址${idx + 1}`,
          Math.min((addr.total_volume || 0) / 10000, 100) // 正規化到 100
        ])
      )
    },
    {
      metric: '交易次數',
      ...Object.fromEntries(
        comparisonData.map((addr: any, idx: number) => [
          `地址${idx + 1}`,
          Math.min((addr.total_trades || 0) / 10, 100) // 正規化到 100
        ])
      )
    },
    {
      metric: '平均交易額',
      ...Object.fromEntries(
        comparisonData.map((addr: any, idx: number) => [
          `地址${idx + 1}`,
          Math.min((addr.avg_trade_size || 0) / 1000, 100) // 正規化到 100
        ])
      )
    },
  ] : [];

  const colors = ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981'];

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">地址比較</h1>
        <p className="text-muted-foreground">
          並排比較多個地址的詳細表現，找出最佳跟單對象
        </p>
      </div>

      {/* 地址選擇器 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>選擇地址（2-4 個）</CardTitle>
          <CardDescription>
            搜索並選擇要比較的地址
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索地址 ID 或地址..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
                className="pl-10"
                disabled={selectedAddresses.length >= 4}
              />
              
              {/* 搜索結果下拉列表 */}
              {showSearchResults && searchQuery && searchResults && searchResults.length > 0 && (
                <Card className="absolute z-10 w-full mt-2">
                  <CardContent className="p-2">
                    {searchResults.map((addr: any) => (
                      <Button
                        key={addr.id}
                        variant="ghost"
                        className="w-full justify-start mb-1"
                        onClick={() => handleAddAddress(addr.id)}
                        disabled={selectedAddresses.includes(addr.id)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">
                              {addr.address.slice(0, 6)}...{addr.address.slice(-4)}
                            </span>
                            {getSuspicionBadge(addr.suspicion_score)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            勝率 {(addr.win_rate || 0).toFixed(1)}%
                          </div>
                        </div>
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* 已選擇的地址 */}
            <div className="flex flex-wrap gap-2">
              {selectedAddresses.map((id) => {
                const addr = searchResults?.find((a: any) => a.id === id);
                return (
                  <Badge key={id} variant="secondary" className="px-3 py-2">
                    <span className="font-mono">
                      {addr ? `${addr.address.slice(0, 6)}...${addr.address.slice(-4)}` : `ID: ${id}`}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 h-4 w-4 p-0"
                      onClick={() => handleRemoveAddress(id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                );
              })}
            </div>

            {selectedAddresses.length < 2 && (
              <p className="text-sm text-muted-foreground">
                請至少選擇 2 個地址進行比較
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 比較結果 */}
      {selectedAddresses.length >= 2 && comparisonData && (
        <>
          {/* 綜合評分卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {comparisonData.map((addr: any, index: number) => (
              <Card key={addr.id} className={index === 0 ? 'border-2 border-pink-500' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-mono">
                      {addr.address.slice(0, 6)}...{addr.address.slice(-4)}
                    </CardTitle>
                    {index === 0 && (
                      <Trophy className="h-5 w-5 text-pink-500" />
                    )}
                  </div>
                  <CardDescription>
                    {index === 0 ? '推薦最佳' : `排名 #${index + 1}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">綜合評分</span>
                      <span className="text-2xl font-bold text-pink-500">{addr.overallScore}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">勝率</span>
                      <span className="font-semibold">{(addr.win_rate || 0).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">可疑度</span>
                      <span className="font-semibold">{addr.suspicion_score}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">交易量</span>
                      <span className="font-semibold">{formatCurrency(addr.total_volume || 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 雷達圖對比 */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>多維度表現對比</CardTitle>
              <CardDescription>
                雷達圖展示各地址在不同維度的表現
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  {comparisonData.map((addr: any, idx: number) => (
                    <Radar
                      key={addr.id}
                      name={`${addr.address.slice(0, 6)}...${addr.address.slice(-4)}`}
                      dataKey={`地址${idx + 1}`}
                      stroke={colors[idx]}
                      fill={colors[idx]}
                      fillOpacity={0.3}
                    />
                  ))}
                  <Legend />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 詳細指標對比表格 */}
          <Card>
            <CardHeader>
              <CardTitle>詳細指標對比</CardTitle>
              <CardDescription>
                並排比較各地址的關鍵指標
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4">指標</th>
                      {comparisonData.map((addr: any, idx: number) => (
                        <th key={addr.id} className="text-center py-3 px-4">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-mono text-sm">
                              {addr.address.slice(0, 6)}...{addr.address.slice(-4)}
                            </span>
                            {idx === 0 && (
                              <Trophy className="h-4 w-4 text-pink-500" />
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="py-3 px-4 font-medium">綜合評分</td>
                      {comparisonData.map((addr: any) => (
                        <td key={addr.id} className="text-center py-3 px-4">
                          <span className="text-lg font-bold text-pink-500">{addr.overallScore}</span>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 px-4 font-medium">勝率</td>
                      {comparisonData.map((addr: any) => (
                        <td key={addr.id} className="text-center py-3 px-4">
                          {(addr.win_rate || 0).toFixed(1)}%
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 px-4 font-medium">可疑度分數</td>
                      {comparisonData.map((addr: any) => (
                        <td key={addr.id} className="text-center py-3 px-4">
                          <div className="flex justify-center">
                            {getSuspicionBadge(addr.suspicion_score)}
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 px-4 font-medium">總交易量</td>
                      {comparisonData.map((addr: any) => (
                        <td key={addr.id} className="text-center py-3 px-4">
                          {formatCurrency(addr.total_volume || 0)}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 px-4 font-medium">交易次數</td>
                      {comparisonData.map((addr: any) => (
                        <td key={addr.id} className="text-center py-3 px-4">
                          {(addr.total_trades || 0).toLocaleString()}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 px-4 font-medium">平均交易額</td>
                      {comparisonData.map((addr: any) => (
                        <td key={addr.id} className="text-center py-3 px-4">
                          {formatCurrency(addr.avg_trade_size || 0)}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 px-4 font-medium">首次出現</td>
                      {comparisonData.map((addr: any) => (
                        <td key={addr.id} className="text-center py-3 px-4 text-sm text-muted-foreground">
                          {new Date(addr.first_seen_at).toLocaleDateString('zh-TW')}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-medium">最後活躍</td>
                      {comparisonData.map((addr: any) => (
                        <td key={addr.id} className="text-center py-3 px-4 text-sm text-muted-foreground">
                          {new Date(addr.last_active_at).toLocaleDateString('zh-TW')}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {compareLoading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">載入比較數據中...</p>
        </div>
      )}
    </div>
  );
}
