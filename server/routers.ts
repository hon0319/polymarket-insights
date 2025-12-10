import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Markets API
  markets: router({
    list: publicProcedure
      .input(z.object({
        category: z.string().optional(),
        country: z.string().optional(),
        isActive: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ input }) => {
        return await db.getMarkets(input);
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getMarketById(input.id);
      }),

    getByConditionId: publicProcedure
      .input(z.object({ conditionId: z.string() }))
      .query(async ({ input }) => {
        return await db.getMarketByConditionId(input.conditionId);
      }),
  }),

  // Predictions API
  predictions: router({
    getByMarketId: publicProcedure
      .input(z.object({ marketId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPredictionsByMarketId(input.marketId);
      }),

    getLatest: publicProcedure
      .input(z.object({ marketId: z.number() }))
      .query(async ({ input }) => {
        return await db.getLatestPredictionByMarketId(input.marketId);
      }),
  }),

  // Trades API
  trades: router({
    getByMarketId: publicProcedure
      .input(z.object({ 
        marketId: z.number(),
        limit: z.number().min(1).max(200).default(50),
      }))
      .query(async ({ input }) => {
        return await db.getTradesByMarketId(input.marketId, input.limit);
      }),

    getWhaleTrades: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(200).default(100),
      }).optional())
      .query(async ({ input }) => {
        return await db.getWhaleTrades(input?.limit);
      }),
  }),

  // Subscriptions API (Protected)
  subscriptions: router({
    getMy: protectedProcedure.query(async ({ ctx }) => {
      return await db.getSubscriptionByUserId(ctx.user.id);
    }),

    // Placeholder for Stripe integration
    createCheckoutSession: protectedProcedure
      .input(z.object({
        tier: z.enum(["basic", "pro", "enterprise"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // TODO: Implement Stripe checkout session creation
        return { 
          checkoutUrl: "https://stripe.com/checkout/placeholder",
          message: "Stripe integration pending"
        };
      }),
  }),

  // Alerts API (Protected)
  alerts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getAlertsByUserId(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        marketId: z.number().optional(),
        alertType: z.enum(["whale_trade", "price_change", "ai_prediction_change"]),
        threshold: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createAlert({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        isActive: z.boolean().optional(),
        threshold: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;
        await db.updateAlert(id, updates);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteAlert(input.id);
        return { success: true };
      }),
  }),

  // Addresses API (Public)
  addresses: router({ list: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAddresses(input || {});
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getAddressById(input.id);
      }),

    getLeaderboard: publicProcedure
      .input(z.object({
        metric: z.enum(['suspicion_score', 'win_rate', 'total_volume']).default('suspicion_score'),
        limit: z.number().min(1).max(50).default(10),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAddressLeaderboard(input || {});
      }),

    getTrades: publicProcedure
      .input(z.object({
        addressId: z.number(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        const { addressId, ...params } = input;
        return await db.getAddressTrades(addressId, params);
      }),

    getStats: publicProcedure.query(async () => {
      return await db.getAddressStats();
    }),

    getTradeHistory: publicProcedure
      .input(z.object({
        addressId: z.number(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        const { addressId, ...params } = input;
        return await db.getAddressTradeHistory(addressId, params);
      }),

    getMarketPerformance: publicProcedure
      .input(z.object({ addressId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAddressMarketPerformance(input.addressId);
      }),

    getWinRateTrend: publicProcedure
      .input(z.object({ addressId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAddressWinRateTrend(input.addressId);
      }),

    getCategoryFocus: publicProcedure
      .input(z.object({ addressId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAddressCategoryFocus(input.addressId);
      }),

    getSuspicionScoreBreakdown: publicProcedure
      .input(z.object({ addressId: z.number() }))
      .query(async ({ input }) => {
        // 模擬可疑度分數分解（後續可以替換為真實數據）
        const addressId = input.addressId;
        
        // 使用 addressId 生成可重u8907的模擬數據
        const seed = addressId;
        const random = (min: number, max: number) => {
          const x = Math.sin(seed * 9999) * 10000;
          return min + (x - Math.floor(x)) * (max - min);
        };

        const winRateScore = Math.round(random(15, 30));
        const earlyTradingScore = Math.round(random(10, 25));
        const tradeSizeScore = Math.round(random(8, 20));
        const timingScore = Math.round(random(6, 15));
        const selectivityScore = Math.round(random(4, 10));

        const totalScore = winRateScore + earlyTradingScore + tradeSizeScore + timingScore + selectivityScore;

        return {
          totalScore,
          breakdown: {
            winRateScore,
            earlyTradingScore,
            tradeSizeScore,
            timingScore,
            selectivityScore,
          },
          maxScores: {
            winRate: 30,
            earlyTrading: 25,
            tradeSize: 20,
            timing: 15,
            selectivity: 10,
          },
        };
      }),

    // 地址比較 API
    compare: publicProcedure
      .input(z.object({
        addressIds: z.array(z.number()).min(2).max(4),
      }))
      .query(async ({ input }) => {
        const addresses = await db.compareAddresses(input.addressIds);
        
        // 計算每個地址的綜合評分
        const addressesWithScore = addresses.map((addr: any) => {
          // 綜合評分 = 勝率 * 0.3 + 可疑度 * 0.3 + 交易量 * 0.2 + 交易次數 * 0.2
          const normalizedWinRate = (addr.win_rate || 0) / 100;
          const normalizedSuspicion = (addr.suspicion_score || 0) / 100;
          const normalizedVolume = Math.min((addr.total_volume || 0) / 1000000, 1); // 正規化到 1M
          const normalizedTrades = Math.min((addr.total_trades || 0) / 1000, 1); // 正規化到 1000
          
          const overallScore = Math.round(
            normalizedWinRate * 30 +
            normalizedSuspicion * 30 +
            normalizedVolume * 20 +
            normalizedTrades * 20
          );

          return {
            ...addr,
            overallScore,
          };
        });

        // 排序，最高分在前
        addressesWithScore.sort((a: any, b: any) => b.overallScore - a.overallScore);

        return addressesWithScore;
      }),

    // 地址搜索 API
    search: publicProcedure
      .input(z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(20),
      }))
      .query(async ({ input }) => {
        return await db.searchAddresses(input.query, input.limit);
      }),
  }),

  // Notifications API (Protected)
  notifications: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getNotificationsByUserId(ctx.user.id, input?.limit);
      }),

    markAsRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.markNotificationAsRead(input.id);
        return { success: true };
      }),

    getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUnreadNotificationCount(ctx.user.id);
    }),
  }),

  // Alert Subscriptions API
  alertSubscriptions: router({
    // 獲取用戶的所有訂閱
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserAlertSubscriptions(ctx.user.id);
    }),

    // 獲取單個訂閱
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getAlertSubscription(input.id);
      }),

    // 創建訂閱
    create: protectedProcedure
      .input(z.object({
        subscription_type: z.enum(['address', 'market', 'category']),
        target_id: z.string(),
        target_name: z.string().optional(),
        alert_types: z.array(z.string()),
        is_active: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createAlertSubscription({
          user_id: ctx.user.id,
          ...input,
        });
      }),

    // 更新訂閱
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        alert_types: z.array(z.string()).optional(),
        is_active: z.boolean().optional(),
        target_name: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        const success = await db.updateAlertSubscription(id, updates);
        return { success };
      }),

    // 刪u9664訂閱
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const success = await db.deleteAlertSubscription(input.id);
        return { success };
      }),
  }),

  // Alert Notifications API
  alertNotifications: router({
    // 獲取用戶的通知
    list: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ ctx, input }) => {
        const limit = input?.limit ?? 50;
        const offset = input?.offset ?? 0;
        return await db.getUserAlertNotifications(ctx.user.id, limit, offset);
      }),

    // 獲取未u8b80通知數量
    getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUnreadAlertNotificationCount(ctx.user.id);
    }),

    // 標記通知為已讀
    markAsRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const success = await db.markAlertNotificationAsRead(input.id);
        return { success };
      }),

    // 標記所有通知為已讀
    markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
      const success = await db.markAllNotificationsAsRead(ctx.user.id);
      return { success };
    }),
  }),
});

export type AppRouter = typeof appRouter;
