import { describe, it, expect, vi } from "vitest";
import { runParallel } from "../parallel.ts";
import type { ModelCategoriesConfig } from "../../config/schema.ts";

vi.mock("../../router/router.ts", () => ({
  resolveModel: vi.fn((category: string) => ({
    model: {
      provider: "openai",
      modelId: "gpt-4o",
    },
  })),
}));

vi.mock("../orchestrator.ts", () => ({
  runSingleAgent: vi.fn().mockResolvedValue({
    provider: "openai",
    modelId: "gpt-4o",
    messages: [{ role: "assistant", content: [] }],
  }),
}));

const TEST_CONFIG: ModelCategoriesConfig = {
  categories: {
    coding: { primary: { provider: "anthropic", modelId: "claude" } },
    creative: { primary: { provider: "google", modelId: "gemini" } },
  },
};

describe("runParallel", () => {
  it("returns results for all secondaries", async () => {
    const results = await runParallel(
      "test",
      [
        { category: "coding", config: TEST_CONFIG },
        { category: "creative", config: TEST_CONFIG },
      ],
    );

    expect(results).toHaveLength(2);
    expect(results[0].category).toBe("coding");
    expect(results[1].category).toBe("creative");
  });

  it("handles individual failures", async () => {
    const { runSingleAgent } = await import("../orchestrator.ts");
    vi.mocked(runSingleAgent)
      .mockResolvedValueOnce({ category: "coding", provider: "openai", modelId: "gpt-4o", messages: [] })
      .mockRejectedValueOnce(new Error("Failed"));

    const results = await runParallel(
      "test",
      [
        { category: "coding", config: TEST_CONFIG },
        { category: "creative", config: TEST_CONFIG },
      ],
    );

    expect(results).toHaveLength(2);
    expect(results[0].messages).toBeDefined();
    expect(results[1].error).toBeDefined();
  });

  it("uses allSettled for resilience", async () => {
    const { runSingleAgent } = await import("../orchestrator.ts");
    vi.mocked(runSingleAgent).mockRejectedValue(new Error("All fail"));

    const results = await runParallel(
      "test",
      [
        { category: "coding", config: TEST_CONFIG },
        { category: "creative", config: TEST_CONFIG },
      ],
    );

    // Should still return results (with errors), not throw
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.error)).toBe(true);
  });
});
