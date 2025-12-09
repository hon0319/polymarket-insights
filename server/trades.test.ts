import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return ctx;
}

describe("trades API", () => {
  it("should return whale trades list", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.trades.getWhaleTrades({ limit: 10 });

    expect(Array.isArray(result)).toBe(true);
    // 如果有數據，驗證數據結構
    if (result.length > 0) {
      const trade = result[0];
      expect(trade).toHaveProperty("id");
      expect(trade).toHaveProperty("tradeId");
      expect(trade).toHaveProperty("side");
      expect(trade).toHaveProperty("price");
      expect(trade).toHaveProperty("amount");
      expect(trade).toHaveProperty("marketTitle");
      expect(["YES", "NO"]).toContain(trade.side);
    }
  });

  it("should respect limit parameter", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.trades.getWhaleTrades({ limit: 5 });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("should return trades for specific market", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // 首先獲取一個市場
    const markets = await caller.markets.list({ limit: 1 });
    
    if (markets.length > 0) {
      const marketId = markets[0].id;
      const result = await caller.trades.getByMarketId({ marketId, limit: 10 });

      expect(Array.isArray(result)).toBe(true);
      // 所有交易都應該屬於同一個市場
      result.forEach(trade => {
        expect(trade.marketId).toBe(marketId);
      });
    }
  });
});

describe("markets API", () => {
  it("should return markets list", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.markets.list({ limit: 10 });

    expect(Array.isArray(result)).toBe(true);
    // 如果有數據，驗證數據結構
    if (result.length > 0) {
      const market = result[0];
      expect(market).toHaveProperty("id");
      expect(market).toHaveProperty("conditionId");
      expect(market).toHaveProperty("title");
      expect(market).toHaveProperty("currentPrice");
    }
  });

  it("should filter markets by category", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.markets.list({ category: "Politics", limit: 10 });

    expect(Array.isArray(result)).toBe(true);
    // 所有市場都應該是 Politics 類別
    result.forEach(market => {
      if (market.category) {
        expect(market.category).toBe("Politics");
      }
    });
  });
});
