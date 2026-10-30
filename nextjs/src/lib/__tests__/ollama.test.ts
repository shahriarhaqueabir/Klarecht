import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkOllamaHealth, chatWithOllama, embedWithOllama } from "../ollama";

describe("ollama", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns healthy when Ollama responds", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ models: [{ name: "qwen3:8b" }] }), {
        status: 200,
      }),
    );
    const health = await checkOllamaHealth();
    expect(health.healthy).toBe(true);
    expect(health.models).toContain("qwen3:8b");
  });

  it("returns unhealthy when Ollama is down", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const health = await checkOllamaHealth();
    expect(health.healthy).toBe(false);
  });

  it("sends chat request to Ollama", async () => {
    // Mock health check first
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ models: [{ name: "qwen3:8b" }] }), {
          status: 200,
        }),
      )
      // Then chat response
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: { content: "Hello!" } }), {
          status: 200,
        }),
      );
    const result = await chatWithOllama([{ role: "user", content: "Hi" }]);
    expect(result).toBe("Hello!");
  });
});
