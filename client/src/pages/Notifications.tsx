import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, CheckCheck, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';

export default function Notifications() {
  const utils = trpc.useUtils();
  const { data: notifications, isLoading } = trpc.alertNotifications.list.useQuery();
  const { data: unreadCount } = trpc.alertNotifications.getUnreadCount.useQuery();

  const markAsReadMutation = trpc.alertNotifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.alertNotifications.list.invalidate();
      utils.alertNotifications.getUnreadCount.invalidate();
    },
    onError: (error) => {
      toast.error(`標記失敗：${error.message}`);
    }
  });

  const markAllAsReadMutation = trpc.alertNotifications.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.alertNotifications.list.invalidate();
      utils.alertNotifications.getUnreadCount.invalidate();
      toast.success('所有通知已標記為已讀');
    },
    onError: (error) => {
      toast.error(`標記失敗：${error.message}`);
    }
  });

  const handleMarkAsRead = (id: number) => {
    markAsReadMutation.mutate({ id });
  };

  const handleMarkAllAsRead = () => {
    if (confirm('確定要將所有通知標記為已讀嗎？')) {
      markAllAsReadMutation.mutate();
    }
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'suspicious_trade':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'large_trade':
        return <DollarSign className="w-5 h-5 text-green-500" />;
      case 'price_spike':
        return <TrendingUp className="w-5 h-5 text-blue-500" />;
      case 'high_suspicion_address':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Bell className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getAlertTypeLabel = (alertType: string) => {
    const labels: Record<string, string> = {
      suspicious_trade: '可疑交易',
      large_trade: '大額交易',
      price_spike: '價格異常',
      high_suspicion_address: '高可疑度地址'
    };
    return labels[alertType] || alertType;
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
          <h1 className="text-3xl font-bold">通知中心</h1>
          <p className="text-muted-foreground mt-2">
            {unreadCount && unreadCount > 0 ? `您有 ${unreadCount} 條未讀通知` : '沒有未讀通知'}
          </p>
        </div>
        {unreadCount && unreadCount > 0 && (
          <Button onClick={handleMarkAllAsRead} disabled={markAllAsReadMutation.isPending}>
            <CheckCheck className="w-4 h-4 mr-2" />
            全部標記為已讀
          </Button>
        )}
      </div>

      {!notifications || notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">還沒有通知</h3>
            <p className="text-muted-foreground">
              當有警報觸發時，您會在這裡看到通知
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={notification.is_read ? 'opacity-60' : 'border-primary'}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">
                      {getAlertIcon(notification.alert_type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">
                          {notification.title}
                        </CardTitle>
                        {!notification.is_read && (
                          <Badge variant="default" className="text-xs">
                            新
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {getAlertTypeLabel(notification.alert_type)}
                        </Badge>
                      </div>
                      <CardDescription className="text-sm">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: zhTW
                        })}
                      </CardDescription>
                    </div>
                  </div>
                  {!notification.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkAsRead(notification.id)}
                      disabled={markAsReadMutation.isPending}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      標記為已讀
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{notification.message}</p>
                {notification.metadata && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-2">詳細資訊</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {notification.metadata.market_name && (
                        <div>
                          <span className="text-muted-foreground">市場：</span>
                          <span className="ml-1">{notification.metadata.market_name}</span>
                        </div>
                      )}
                      {notification.metadata.suspicion_score && (
                        <div>
                          <span className="text-muted-foreground">可疑度：</span>
                          <span className="ml-1 font-semibold">{notification.metadata.suspicion_score}</span>
                        </div>
                      )}
                      {notification.metadata.win_rate && (
                        <div>
                          <span className="text-muted-foreground">勝率：</span>
                          <span className="ml-1">{notification.metadata.win_rate.toFixed(1)}%</span>
                        </div>
                      )}
                      {notification.metadata.value && (
                        <div>
                          <span className="text-muted-foreground">金額：</span>
                          <span className="ml-1 font-semibold">${notification.metadata.value.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
