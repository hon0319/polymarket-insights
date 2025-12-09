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
});

export type AppRouter = typeof appRouter;
