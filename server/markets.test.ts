import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createMockContext(): TrpcContext {
  return {
    user: undefined,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("markets API", () => {
  it("should list markets without authentication", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.markets.list();

    expect(Array.isArray(result)).toBe(true);
  });

  it("should accept filter parameters", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.markets.list({
      category: "Politics",
      limit: 10,
      offset: 0,
      isActive: true,
    });

    expect(Array.isArray(result)).toBe(true);
  });

  it("should get market by id", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    // Test with a non-existent ID
    const result = await caller.markets.getById({ id: 99999 });

    // Should return undefined for non-existent market
    expect(result).toBeUndefined();
  });

  it("should get market by condition id", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.markets.getByConditionId({ 
      conditionId: "test-condition-id" 
    });

    // Should return undefined for non-existent market
    expect(result).toBeUndefined();
  });
});

describe("predictions API", () => {
  it("should get predictions by market id", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.predictions.getByMarketId({ marketId: 1 });

    expect(Array.isArray(result)).toBe(true);
  });

  it("should get latest prediction", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.predictions.getLatest({ marketId: 1 });

    // Should return undefined or a prediction object
    expect(result === undefined || typeof result === 'object').toBe(true);
  });
});

describe("trades API", () => {
  it("should get trades by market id", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.trades.getByMarketId({ 
      marketId: 1,
      limit: 50 
    });

    expect(Array.isArray(result)).toBe(true);
  });

  it("should get whale trades", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.trades.getWhaleTrades({ limit: 100 });

    expect(Array.isArray(result)).toBe(true);
  });
});
