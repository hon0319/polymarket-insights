import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useWebSocket, WebSocketMessage } from '@/hooks/useWebSocket';
import { toast } from 'sonner';

interface WhaleTrade {
  market: string;
  side: string;
  amount: number;
  price: number;
  timestamp: string;
}

interface MarketUpdate {
  condition_id: string;
  title: string;
  price: number;
  volume_24h: number;
  timestamp: string;
}

interface RealtimeContextType {
  isConnected: boolean;
  whaleTrades: WhaleTrade[];
  marketUpdates: Map<string, MarketUpdate>;
  lastUpdate: Date | null;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

// WebSocket server URL (Python backend)
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8765';

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [whaleTrades, setWhaleTrades] = useState<WhaleTrade[]>([]);
  const [marketUpdates, setMarketUpdates] = useState<Map<string, MarketUpdate>>(new Map());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const handleMessage = (message: WebSocketMessage) => {
    setLastUpdate(new Date());

    switch (message.type) {
      case 'connected':
        toast.success('已連接到實時數據服務');
        break;

      case 'whale_trade':
        if (message.data) {
          const trade: WhaleTrade = message.data;
          setWhaleTrades((prev) => [trade, ...prev].slice(0, 50)); // Keep last 50 trades
          
          // Show toast notification
          toast.info(`🐋 大額交易: ${trade.side} $${trade.amount.toLocaleString()}`, {
            description: trade.market,
          });
        }
        break;

      case 'market_update':
        if (message.data) {
          const update: MarketUpdate = message.data;
          setMarketUpdates((prev) => {
            const newMap = new Map(prev);
            newMap.set(update.condition_id, update);
            return newMap;
          });
        }
        break;

      case 'pong':
        // Heartbeat response
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const handleConnect = () => {
    console.log('✅ Connected to realtime service');
  };

  const handleDisconnect = () => {
    console.log('⚠️ Disconnected from realtime service');
    toast.warning('實時數據連接已斷開，正在重新連接...');
  };

  const handleError = (error: Event) => {
    console.error('❌ WebSocket error:', error);
  };

  const { isConnected, sendMessage } = useWebSocket(WS_URL, {
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onError: handleError,
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
  });

  // Send periodic ping to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      sendMessage({ type: 'ping' });
    }, 30000); // Every 30 seconds

    return () => clearInterval(pingInterval);
  }, [isConnected, sendMessage]);

  const value: RealtimeContextType = {
    isConnected,
    whaleTrades,
    marketUpdates,
    lastUpdate,
  };

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}
