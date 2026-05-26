import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveModel, resolveClassifierModel, ModelResolutionError } from "../router.ts";
import type { ModelCategoriesConfig } from "../config/schema.ts";
import { getModel } from "@earendil-works/pi-ai";
import type { Model } from "@earendil-works/pi-ai";

const createMockModel = (provider: string, modelId: string): Model<any> => ({
  id: modelId,
  name: modelId,
  api: "openai-completions" as const,
  provider: provider as any,
  baseUrl: "",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 4096,
  maxTokens: 1024,
});

vi.mock("@earendil-works/pi-ai", () => ({
  getModel: vi.fn((provider: string, modelId: string) => createMockModel(provider, modelId)),
}));

const TEST_CONFIG: ModelCategoriesConfig = {
  categories: {
    coding: {
      primary: { provider: "anthropic", modelId: "claude-sonnet" },
      fallback: [{ provider: "deepseek", modelId: "deepseek-v4-flash" }],
    },
    "code-review": {
      primary: { provider: "deepseek", modelId: "deepseek-v4-flash" },
    },
    "writing-cn": {
      primary: { provider: "moonshotai", modelId: "moonshot-v1-32k" },
    },
  },
};

describe("resolveModel", () => {
  beforeEach(() => {
    vi.mocked(getModel).mockImplementation((provider: string, modelId: string) => createMockModel(provider, modelId));
  });

  it("resolves coding to anthropic", () => {
    const result = resolveModel("coding", TEST_CONFIG);
    expect(result.model.provider).toBe("anthropic");
    expect(result.model.id).toBe("claude-sonnet");
  });

  it("resolves code-review to deepseek", () => {
    const result = resolveModel("code-review", TEST_CONFIG);
    expect(result.model.provider).toBe("deepseek");
    expect(result.model.id).toBe("deepseek-v4-flash");
  });

  it("resolves writing-cn to moonshotai", () => {
    const result = resolveModel("writing-cn", TEST_CONFIG);
    expect(result.model.provider).toBe("moonshotai");
    expect(result.model.id).toBe("moonshot-v1-32k");
  });

  it("throws for unknown category", () => {
    expect(() => resolveModel("unknown", TEST_CONFIG)).toThrow(ModelResolutionError);
    expect(() => resolveModel("unknown", TEST_CONFIG)).toThrow("Unknown category");
  });

  it("uses fallback when primary fails", () => {
    vi.mocked(getModel).mockImplementation((provider: string, modelId: string) => {
      if (provider === "anthropic") throw new Error("Auth failed");
      return createMockModel(provider, modelId);
    });

    const result = resolveModel("coding", TEST_CONFIG);
    expect(result.model.provider).toBe("deepseek");
    expect(result.model.id).toBe("deepseek-v4-flash");
  });

  it("throws when all models fail", () => {
    vi.mocked(getModel).mockImplementation(() => {
      throw new Error("Auth failed");
    });

    expect(() => resolveModel("coding", TEST_CONFIG)).toThrow(ModelResolutionError);
    expect(() => resolveModel("coding", TEST_CONFIG)).toThrow("All models failed");
  });
});

describe("resolveClassifierModel", () => {
  beforeEach(() => {
    vi.mocked(getModel).mockImplementation((provider: string, modelId: string) => createMockModel(provider, modelId));
  });

  it("resolves configured classifier", () => {
    const config: ModelCategoriesConfig = {
      classifier: { provider: "openai", modelId: "gpt-4o-mini" },
      categories: {},
    };
    const result = resolveClassifierModel(config);
    expect(result.model.provider).toBe("openai");
    expect(result.model.id).toBe("gpt-4o-mini");
  });

  it("defaults to deepseek when no classifier configured", () => {
    const config: ModelCategoriesConfig = { categories: {} };
    const result = resolveClassifierModel(config);
    expect(result.model.provider).toBe("deepseek");
  });
});
