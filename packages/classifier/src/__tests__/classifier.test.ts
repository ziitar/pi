import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyTask } from "../classifier.ts";
import { parseClassificationResponse } from "../parsers.ts";

// Mock the stream function
vi.mock("@earendil-works/pi-ai", () => ({
  getModel: vi.fn((provider: string, modelId: string) => ({
    id: modelId,
    name: modelId,
    api: "openai-completions",
    provider,
    baseUrl: "",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 4096,
    maxTokens: 1024,
  })),
  streamSimple: vi.fn(() => ({
    [Symbol.asyncIterator]() {
      let done = false;
      return {
        async next() {
          if (done) return { done: true, value: undefined };
          done = true;
          return {
            done: false,
            value: { type: "text_delta", delta: '{"category": "coding", "confidence": 0.9}' },
          };
        },
      };
    },
  })),
}));

describe("classifyTask", () => {
  it("returns classification result", async () => {
    const result = await classifyTask("Write a function");
    expect(result.category).toBe("coding");
    expect(result.confidence).toBe(0.9);
  });

  it("uses custom model when provided", async () => {
    const { getModel } = await import("@earendil-works/pi-ai");
    const customModel = getModel("openai", "gpt-4o");
    await classifyTask("test", customModel);
    // The mock will be called with the custom model
  });

  it("handles timeout gracefully", async () => {
    const result = await classifyTask("test", undefined, { timeout: 1 });
    expect(result).toBeDefined();
    expect(result.category).toBeDefined();
  });
});

describe("parseClassificationResponse", () => {
  it("parses valid JSON", () => {
    const result = parseClassificationResponse('{"category": "coding", "confidence": 0.9}');
    expect(result.category).toBe("coding");
    expect(result.confidence).toBe(0.9);
  });

  it("handles markdown-fenced JSON", () => {
    const result = parseClassificationResponse('```json\n{"category": "creative", "confidence": 0.8}\n```');
    expect(result.category).toBe("creative");
    expect(result.confidence).toBe(0.8);
  });

  it("handles invalid JSON gracefully", () => {
    const result = parseClassificationResponse("not json");
    expect(result.category).toBe("coding");
    expect(result.confidence).toBe(0);
  });

  it("handles empty string", () => {
    const result = parseClassificationResponse("");
    expect(result.category).toBe("coding");
    expect(result.confidence).toBe(0);
  });

  it("clamps confidence to 0-1", () => {
    const result = parseClassificationResponse('{"category": "coding", "confidence": 1.5}');
    expect(result.confidence).toBe(1);

    const result2 = parseClassificationResponse('{"category": "coding", "confidence": -0.5}');
    expect(result2.confidence).toBe(0);
  });

  it("handles missing fields", () => {
    const result = parseClassificationResponse('{"category": "coding"}');
    expect(result.category).toBe("coding");
    expect(result.confidence).toBe(0);
  });

  it("extracts JSON from surrounding text", () => {
    const result = parseClassificationResponse('Here is the classification: {"category": "fast", "confidence": 0.95} done.');
    expect(result.category).toBe("fast");
    expect(result.confidence).toBe(0.95);
  });
});
