import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
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
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("predictions API", () => {
  it("should return predictions by market ID", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 測試獲取預測記錄（可能為空，因為資料庫可能沒有數據）
    const result = await caller.predictions.getByMarketId({ marketId: 1 });

    // 驗證返回的是數組
    expect(Array.isArray(result)).toBe(true);
    
    // 如果有數據，驗證數據結構
    if (result.length > 0) {
      const prediction = result[0];
      expect(prediction).toHaveProperty("id");
      expect(prediction).toHaveProperty("marketId");
      expect(prediction).toHaveProperty("aiModel");
      expect(prediction).toHaveProperty("prediction");
      expect(prediction).toHaveProperty("confidence");
      expect(prediction).toHaveProperty("consensusVote");
      expect(prediction).toHaveProperty("consensusConfidence");
      expect(prediction).toHaveProperty("totalModels");
      expect(prediction).toHaveProperty("agreeModels");
      expect(prediction).toHaveProperty("createdAt");
      
      // 驗證 prediction 的值是有效的枚舉值
      expect(["YES", "NO", "UNCERTAIN"]).toContain(prediction.prediction);
      
      // 驗證 confidence 是 0-100 的整數
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(100);
      
      // 如果有共識數據，驗證共識信心也在 0-100 範圍內
      if (prediction.consensusConfidence !== null) {
        expect(prediction.consensusConfidence).toBeGreaterThanOrEqual(0);
        expect(prediction.consensusConfidence).toBeLessThanOrEqual(100);
      }
      
      // 驗證模型數量邏輯
      if (prediction.totalModels !== null && prediction.agreeModels !== null) {
        expect(prediction.agreeModels).toBeLessThanOrEqual(prediction.totalModels);
        expect(prediction.agreeModels).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("should validate prediction data structure", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 測試獲取預測記錄
    const result = await caller.predictions.getByMarketId({ marketId: 1 });

    // 如果有數據，驗證共識數據的一致性
    if (result.length > 0) {
      const prediction = result[0];
      
      // 驗證共識數據的一致性
      if (prediction.consensusVote !== null) {
        expect(["YES", "NO", "UNCERTAIN"]).toContain(prediction.consensusVote);
      }
      
      // 驗證模型名稱不為空
      expect(prediction.aiModel).toBeTruthy();
      expect(typeof prediction.aiModel).toBe("string");
    }
  });

  it("should handle whale trades with predictions", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 測試獲取大額交易（包含預測數據）
    const result = await caller.trades.getWhaleTrades({ limit: 10 });

    // 驗證返回的是數組
    expect(Array.isArray(result)).toBe(true);
    
    // 如果有數據，驗證數據結構
    if (result.length > 0) {
      const trade = result[0];
      
      // 驗證交易基本字段
      expect(trade).toHaveProperty("id");
      expect(trade).toHaveProperty("marketId");
      expect(trade).toHaveProperty("marketTitle");
      expect(trade).toHaveProperty("side");
      expect(trade).toHaveProperty("price");
      expect(trade).toHaveProperty("amount");
      expect(trade).toHaveProperty("timestamp");
      
      // 驗證預測字段（可能為 null）
      expect(trade).toHaveProperty("predictionId");
      expect(trade).toHaveProperty("consensusVote");
      expect(trade).toHaveProperty("consensusConfidence");
      expect(trade).toHaveProperty("totalModels");
      expect(trade).toHaveProperty("agreeModels");
      
      // 如果有預測數據，驗證其有效性
      if (trade.consensusVote !== null) {
        expect(["YES", "NO", "UNCERTAIN"]).toContain(trade.consensusVote);
      }
      
      if (trade.consensusConfidence !== null) {
        expect(trade.consensusConfidence).toBeGreaterThanOrEqual(0);
        expect(trade.consensusConfidence).toBeLessThanOrEqual(100);
      }
    }
  });
});
