import { describe, it, expect, vi, beforeEach } from "vitest";
import { orchestrate } from "../orchestrator.ts";
import type { ModelCategoriesConfig } from "../../config/schema.ts";

// Mock dependencies
vi.mock("@earendil-works/pi-classifier", () => ({
  classifyTask: vi.fn().mockResolvedValue({
    category: "coding",
    confidence: 0.9,
  }),
}));

vi.mock("@earendil-works/pi-coding-agent", () => ({
  createAgentSession: vi.fn().mockResolvedValue({
    session: {
      prompt: vi.fn().mockResolvedValue(undefined),
      state: {
        messages: [
          {
            role: "assistant",
            content: [{ type: "text", text: "Hello from mock agent" }],
          },
        ],
      },
    },
    dispose: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../../router/router.ts", () => ({
  resolveModel: vi.fn().mockReturnValue({
    model: { provider: "anthropic", modelId: "claude-sonnet" },
  }),
  resolveClassifierModel: vi.fn().mockReturnValue({
    model: { provider: "deepseek", modelId: "deepseek-chat" },
  }),
}));

vi.mock("../parallel.ts", () => ({
  runParallel: vi.fn().mockResolvedValue([
    {
      category: "creative",
      provider: "google",
      modelId: "gemini-2.5-flash",
      messages: [],
    },
  ]),
}));

const TEST_CONFIG: ModelCategoriesConfig = {
  categories: {
    coding: {
      primary: { provider: "anthropic", modelId: "claude-sonnet" },
    },
    creative: {
      primary: { provider: "google", modelId: "gemini-2.5-flash" },
    },
  },
};

describe("orchestrate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates session and returns result in single mode", async () => {
    const result = await orchestrate("Write a function", TEST_CONFIG, {
      mode: "single",
    });

    expect(result.primary.messages).toHaveLength(1);
    expect(result.classification.category).toBe("coding");
    expect(result.secondaries).toHaveLength(0);
  });

  it("returns secondary results in parallel mode", async () => {
    const result = await orchestrate("Write a function", TEST_CONFIG, {
      mode: "parallel",
    });

    expect(result.secondaries).toHaveLength(1);
    expect(result.secondaries[0].category).toBe("creative");
  });

  it("handles agent errors gracefully", async () => {
    const { createAgentSession } = await import("@earendil-works/pi-coding-agent");
    vi.mocked(createAgentSession).mockRejectedValueOnce(new Error("Auth failed"));

    const result = await orchestrate("test", TEST_CONFIG);

    expect(result.primary.error).toContain("Auth failed");
  });

  it("tracks total duration", async () => {
    const result = await orchestrate("test", TEST_CONFIG);

    expect(result.totalDuration).toBeGreaterThanOrEqual(0);
  });
});
