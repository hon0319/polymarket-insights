import { describe, expect, it } from "vitest";

/**
 * OpenRouter API 驗證測試
 * 
 * 此測試驗證 OPENROUTER_API_KEY 是否有效
 * 通過調用 OpenRouter API 的 /models 端點來檢查 API Key
 */
describe("OpenRouter API", () => {
  it("should have valid OPENROUTER_API_KEY", async () => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    // 檢查 API Key 是否存在
    expect(apiKey).toBeDefined();
    expect(apiKey).toMatch(/^sk-or-v1-/);
    
    // 調用 OpenRouter API 驗證 Key 是否有效
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://polymarket-insights.com",
        "X-Title": "Polymarket Insights"
      }
    });
    
    // API Key 有效應該返回 200
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    // 應該返回模型列表
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
    
    // 檢查是否包含我們要使用的模型
    const modelIds = data.data.map((model: any) => model.id);
    expect(modelIds).toContain("openai/gpt-4o-mini");
    expect(modelIds).toContain("anthropic/claude-3.5-haiku");
    expect(modelIds).toContain("google/gemini-2.0-flash-exp");
  });
  
  it("should be able to make a simple chat completion", async () => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://polymarket-insights.com",
        "X-Title": "Polymarket Insights"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "user", content: "Say 'test successful' if you can read this." }
        ],
        max_tokens: 10
      })
    });
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.choices).toBeDefined();
    expect(data.choices.length).toBeGreaterThan(0);
    expect(data.choices[0].message.content).toBeDefined();
    
    // 驗證回應內容
    const content = data.choices[0].message.content.toLowerCase();
    expect(content).toContain("test");
  }, 30000); // 30 秒超時
});
