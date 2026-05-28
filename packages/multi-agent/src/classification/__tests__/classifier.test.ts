import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyTask } from "../classifier.ts";
import { parseClassificationResponse } from "../parsers.ts";

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
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("returns classification result", async () => {
		const result = await classifyTask("Write a function");
		expect(result.category).toBe("coding");
		expect(result.confidence).toBe(0.9);
	});

	it("uses custom model when provided", async () => {
		const { getModel } = await import("@earendil-works/pi-ai");
		const customModel = getModel("openai", "gpt-4o");
		const result = await classifyTask("test", customModel);
		expect(result.category).toBeDefined();
	});

	it("passes dynamic categories to prompt builder", async () => {
		const { streamSimple } = await import("@earendil-works/pi-ai");
		const mockStreamSimple = vi.mocked(streamSimple);

		await classifyTask("test", undefined, { categories: ["review", "security", "testing"] });

		const lastCall = mockStreamSimple.mock.calls[mockStreamSimple.mock.calls.length - 1];
		const context = lastCall[1];
		expect(context.systemPrompt).toContain("review");
		expect(context.systemPrompt).toContain("security");
		expect(context.systemPrompt).toContain("testing");
	});

	it("falls back to first category on error", async () => {
		const { streamSimple } = await import("@earendil-works/pi-ai");
		const mockStreamSimple = vi.mocked(streamSimple);
		mockStreamSimple.mockImplementationOnce(() => {
			throw new Error("LLM unavailable");
		});

		const result = await classifyTask("test", undefined, { categories: ["design", "architecture"] });
		expect(result.category).toBe("design");
		expect(result.confidence).toBe(0);
		expect(result.reasoning).toBe("LLM unavailable");
	});

	it("falls back to coding when no categories provided", async () => {
		const { streamSimple } = await import("@earendil-works/pi-ai");
		const mockStreamSimple = vi.mocked(streamSimple);
		mockStreamSimple.mockImplementationOnce(() => {
			throw new Error("fail");
		});

		const result = await classifyTask("test");
		expect(result.category).toBe("coding");
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
		const result = parseClassificationResponse(
			'Here is the classification: {"category": "fast", "confidence": 0.95} done.',
		);
		expect(result.category).toBe("fast");
		expect(result.confidence).toBe(0.95);
	});

	it("uses custom fallback category", () => {
		const result = parseClassificationResponse("not json", "design");
		expect(result.category).toBe("design");
		expect(result.confidence).toBe(0);
	});

	it("uses custom fallback for empty input", () => {
		const result = parseClassificationResponse("", "review");
		expect(result.category).toBe("review");
	});
});
