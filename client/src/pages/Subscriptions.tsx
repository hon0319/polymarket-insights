import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Bell, BellOff, Plus, Trash2, Edit, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function Subscriptions() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [subscriptionType, setSubscriptionType] = useState<'address' | 'market' | 'category'>('address');
  const [targetId, setTargetId] = useState('');
  const [targetName, setTargetName] = useState('');
  const [selectedAlertTypes, setSelectedAlertTypes] = useState<string[]>([
    'suspicious_trade',
    'large_trade',
    'price_spike'
  ]);

  const utils = trpc.useUtils();
  const { data: subscriptions, isLoading } = trpc.alertSubscriptions.list.useQuery();
  const createMutation = trpc.alertSubscriptions.create.useMutation({
    onSuccess: () => {
      utils.alertSubscriptions.list.invalidate();
      setIsCreateDialogOpen(false);
      setTargetId('');
      setTargetName('');
      toast.success('訂閱創建成功');
    },
    onError: (error) => {
      toast.error(`創建失敗：${error.message}`);
    }
  });

  const deleteMutation = trpc.alertSubscriptions.delete.useMutation({
    onSuccess: () => {
      utils.alertSubscriptions.list.invalidate();
      toast.success('訂閱已刪除');
    },
    onError: (error) => {
      toast.error(`刪除失敗：${error.message}`);
    }
  });

  const updateMutation = trpc.alertSubscriptions.update.useMutation({
    onSuccess: () => {
      utils.alertSubscriptions.list.invalidate();
      toast.success('訂閱已更新');
    },
    onError: (error) => {
      toast.error(`更新失敗：${error.message}`);
    }
  });

  const handleCreate = () => {
    if (!targetId.trim()) {
      toast.error('請輸入目標 ID');
      return;
    }

    if (selectedAlertTypes.length === 0) {
      toast.error('請至少選擇一種警報類型');
      return;
    }

    createMutation.mutate({
      subscription_type: subscriptionType,
      target_id: targetId.trim(),
      target_name: targetName.trim() || undefined,
      alert_types: selectedAlertTypes,
      is_active: true
    });
  };

  const handleDelete = (id: number) => {
    if (confirm('確定要刪除這個訂閱嗎？')) {
      deleteMutation.mutate({ id });
    }
  };

  const handleToggleActive = (id: number, currentActive: boolean) => {
    updateMutation.mutate({
      id,
      is_active: !currentActive
    });
  };

  const alertTypeLabels: Record<string, string> = {
    suspicious_trade: '可疑交易',
    large_trade: '大額交易',
    price_spike: '價格異常',
    high_suspicion_address: '高可疑度地址'
  };

  const subscriptionTypeLabels: Record<string, string> = {
    address: '地址',
    market: '市場',
    category: '類別'
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">警報訂閱</h1>
          <p className="text-muted-foreground mt-2">
            訂閱特定地址或市場，當檢測到可疑活動時自動接收通知
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              創建訂閱
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>創建新訂閱</DialogTitle>
              <DialogDescription>
                訂閱特定地址或市場，接收警報通知
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>訂閱類型</Label>
                <Select value={subscriptionType} onValueChange={(v: any) => setSubscriptionType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="address">地址</SelectItem>
                    <SelectItem value="market">市場</SelectItem>
                    <SelectItem value="category">類別</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>目標 ID</Label>
                <Input
                  placeholder={subscriptionType === 'address' ? '輸入地址 ID' : subscriptionType === 'market' ? '輸入市場 ID' : '輸入類別名稱'}
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>目標名稱（可選）</Label>
                <Input
                  placeholder="輸入易於識別的名稱"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>警報類型</Label>
                <div className="space-y-2">
                  {Object.entries(alertTypeLabels).map(([value, label]) => (
                    <div key={value} className="flex items-center space-x-2">
                      <Checkbox
                        id={value}
                        checked={selectedAlertTypes.includes(value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedAlertTypes([...selectedAlertTypes, value]);
                          } else {
                            setSelectedAlertTypes(selectedAlertTypes.filter(t => t !== value));
                          }
                        }}
                      />
                      <label htmlFor={value} className="text-sm cursor-pointer">
                        {label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? '創建中...' : '創建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!subscriptions || subscriptions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">還沒有訂閱</h3>
            <p className="text-muted-foreground mb-4">
              創建訂閱以接收警報通知
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              創建第一個訂閱
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {subscriptions.map((sub) => (
            <Card key={sub.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">
                        {sub.target_name || `${subscriptionTypeLabels[sub.subscription_type]} ${sub.target_id}`}
                      </CardTitle>
                      <Badge variant={sub.is_active ? 'default' : 'secondary'}>
                        {sub.is_active ? '啟用' : '停用'}
                      </Badge>
                    </div>
                    <CardDescription>
                      {subscriptionTypeLabels[sub.subscription_type]} ID: {sub.target_id}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleActive(sub.id, sub.is_active)}
                      title={sub.is_active ? '停用' : '啟用'}
                    >
                      {sub.is_active ? (
                        <Bell className="w-4 h-4" />
                      ) : (
                        <BellOff className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(sub.id)}
                      title="刪除"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">警報類型：</div>
                  <div className="flex flex-wrap gap-2">
                    {sub.alert_types.map((type) => (
                      <Badge key={type} variant="outline">
                        {alertTypeLabels[type] || type}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
