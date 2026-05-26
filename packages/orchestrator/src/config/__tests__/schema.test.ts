import { describe, it, expect } from "vitest";
import { Compile } from "typebox/compile";
import {
  ModelCategoriesConfigSchema,
  CategoryConfigSchema,
  type ModelCategoriesConfig,
} from "../schema.ts";
import { DEFAULT_CONFIG } from "../defaults.ts";

describe("ModelCategoriesConfigSchema", () => {
  const C = Compile(ModelCategoriesConfigSchema);

  it("accepts valid config", () => {
    expect(C.Check(DEFAULT_CONFIG)).toBe(true);
  });

  it("rejects empty provider", () => {
    const invalid = {
      categories: {
        coding: {
          primary: { provider: "", modelId: "model" },
        },
      },
    };
    expect(C.Check(invalid)).toBe(false);
  });

  it("rejects empty modelId", () => {
    const invalid = {
      categories: {
        coding: {
          primary: { provider: "openai", modelId: "" },
        },
      },
    };
    expect(C.Check(invalid)).toBe(false);
  });

  it("rejects concurrency out of range", () => {
    const invalid = {
      categories: {},
      maxConcurrency: 11,
    };
    expect(C.Check(invalid)).toBe(false);
  });

  it("accepts empty categories", () => {
    const config = { categories: {} };
    expect(C.Check(config)).toBe(true);
  });

  it("accepts single category", () => {
    const config = {
      categories: {
        coding: {
          primary: { provider: "openai", modelId: "gpt-4o" },
        },
      },
    };
    expect(C.Check(config)).toBe(true);
  });

  it("accepts multiple fallbacks", () => {
    const config = {
      categories: {
        coding: {
          primary: { provider: "openai", modelId: "gpt-4o" },
          fallback: [
            { provider: "deepseek", modelId: "deepseek-chat" },
            { provider: "anthropic", modelId: "claude-sonnet" },
          ],
        },
      },
    };
    expect(C.Check(config)).toBe(true);
  });

  it("accepts thinkingLevel", () => {
    const config = {
      categories: {
        coding: {
          primary: {
            provider: "openai",
            modelId: "gpt-4o",
            thinkingLevel: "high",
          },
        },
      },
    };
    expect(C.Check(config)).toBe(true);
  });
});

describe("CategoryConfigSchema", () => {
  const C = Compile(CategoryConfigSchema);

  it("rejects invalid thinkingLevel", () => {
    const invalid = {
      provider: "openai",
      modelId: "gpt-4o",
      thinkingLevel: "invalid",
    };
    expect(C.Check(invalid)).toBe(false);
  });

  it("rejects temperature out of range", () => {
    const invalid = {
      provider: "openai",
      modelId: "gpt-4o",
      temperature: 3,
    };
    expect(C.Check(invalid)).toBe(false);
  });
});
