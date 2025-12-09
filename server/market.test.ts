import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock context for testing
function createMockContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Market Detail API Tests", () => {
  const ctx = createMockContext();
  const caller = appRouter.createCaller(ctx);

  describe("markets.getById", () => {
    it("should return market details for valid market ID", async () => {
      // Use a known market ID from the database
      const result = await caller.markets.getById({ id: 2 });
      
      expect(result).toBeDefined();
      expect(result.id).toBe(2);
      expect(result.title).toBeDefined();
      expect(result.conditionId).toBeDefined();
    });

    it("should return undefined for non-existent market", async () => {
      const result = await caller.markets.getById({ id: 999999 });
      expect(result).toBeUndefined();
    });
  });

  describe("trades.getByMarketId", () => {
    it("should return trades for a market", async () => {
      const result = await caller.trades.getByMarketId({ 
        marketId: 2,
        limit: 10 
      });
      
      expect(Array.isArray(result)).toBe(true);
      // Each trade should have required fields
      if (result.length > 0) {
        const trade = result[0];
        expect(trade).toHaveProperty("id");
        expect(trade).toHaveProperty("marketId");
        expect(trade).toHaveProperty("price");
        expect(trade).toHaveProperty("amount");
        expect(trade).toHaveProperty("side");
      }
    });

    it("should respect limit parameter", async () => {
      const result = await caller.trades.getByMarketId({ 
        marketId: 2,
        limit: 5 
      });
      
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it("should return empty array for market with no trades", async () => {
      const result = await caller.trades.getByMarketId({ 
        marketId: 1,
        limit: 10 
      });
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("predictions.getByMarketId", () => {
    it("should return predictions for a market", async () => {
      const result = await caller.predictions.getByMarketId({ 
        marketId: 30415 
      });
      
      expect(Array.isArray(result)).toBe(true);
      // Each prediction should have required fields
      if (result.length > 0) {
        const prediction = result[0];
        expect(prediction).toHaveProperty("id");
        expect(prediction).toHaveProperty("aiModel");
        expect(prediction).toHaveProperty("prediction");
        expect(prediction).toHaveProperty("confidence");
        expect(prediction).toHaveProperty("reasoning");
      }
    });

    it("should return empty array for market with no predictions", async () => {
      const result = await caller.predictions.getByMarketId({ 
        marketId: 1 
      });
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("trades.getWhaleTrades", () => {
    it("should return whale trades", async () => {
      const result = await caller.trades.getWhaleTrades({ 
        limit: 10
      });
      
      expect(Array.isArray(result)).toBe(true);
      
      if (result.length > 0) {
        const trade = result[0];
        expect(trade).toHaveProperty("id");
        expect(trade).toHaveProperty("amount");
        expect(trade).toHaveProperty("marketId");
        expect(trade).toHaveProperty("side");
      }
    });

    it("should respect limit parameter", async () => {
      const result = await caller.trades.getWhaleTrades({ 
        limit: 5
      });
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe("markets.list", () => {
    it("should return list of markets", async () => {
      const result = await caller.markets.list({ 
        limit: 10
      });
      
      expect(Array.isArray(result)).toBe(true);
      
      if (result.length > 0) {
        const market = result[0];
        expect(market).toHaveProperty("id");
        expect(market).toHaveProperty("title");
        expect(market).toHaveProperty("conditionId");
        expect(market).toHaveProperty("category");
      }
    });

    it("should filter by category", async () => {
      const result = await caller.markets.list({ 
        category: "Sports",
        limit: 10
      });
      
      expect(Array.isArray(result)).toBe(true);
      
      // All markets should be in Sports category
      result.forEach(market => {
        expect(market.category).toBe("Sports");
      });
    });

    it("should respect limit parameter", async () => {
      const result = await caller.markets.list({ 
        limit: 5
      });
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });
});
