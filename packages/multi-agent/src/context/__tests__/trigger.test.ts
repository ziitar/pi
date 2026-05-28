import type { Api, Model } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { shouldCompress } from "../trigger.ts";

function makeModel(contextWindow: number): Model<Api> {
	return {
		id: "test-model",
		name: "Test Model",
		api: "openai-completions",
		provider: "openai",
		baseUrl: "http://localhost",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow,
		maxTokens: 4096,
	};
}

describe("shouldCompress", () => {
	it("returns shouldCompress false when under threshold", () => {
		const result = shouldCompress(50000, { limit: 200000 });
		expect(result.shouldCompress).toBe(false);
		expect(result.utilizationRatio).toBeCloseTo(0.25);
	});

	it("returns shouldCompress true when at 80% threshold", () => {
		const result = shouldCompress(160000, { limit: 200000 });
		expect(result.shouldCompress).toBe(true);
		expect(result.utilizationRatio).toBeCloseTo(0.8);
	});

	it("returns shouldCompress true when over threshold", () => {
		const result = shouldCompress(180000, { limit: 200000 });
		expect(result.shouldCompress).toBe(true);
		expect(result.utilizationRatio).toBeCloseTo(0.9);
	});

	it("resolves context limit from model.contextWindow when limit is 'auto'", () => {
		const model = makeModel(128000);
		const result = shouldCompress(100000, { limit: "auto" }, model);
		expect(result.contextLimit).toBe(128000);
		expect(result.shouldCompress).toBe(false);
		expect(result.utilizationRatio).toBeCloseTo(100000 / 128000);
	});

	it("triggers compression with auto context limit from model", () => {
		const model = makeModel(128000);
		const result = shouldCompress(110000, { limit: "auto" }, model);
		expect(result.contextLimit).toBe(128000);
		expect(result.shouldCompress).toBe(true);
	});

	it("uses explicit limit over model.contextWindow", () => {
		const model = makeModel(128000);
		const result = shouldCompress(50000, { limit: 100000 }, model);
		expect(result.contextLimit).toBe(100000);
		expect(result.shouldCompress).toBe(false);
	});

	it("supports custom threshold", () => {
		const result = shouldCompress(190000, { limit: 200000 }, undefined, 0.9);
		expect(result.shouldCompress).toBe(true);
		expect(result.threshold).toBe(0.9);
	});

	it("returns false when custom threshold not met", () => {
		const result = shouldCompress(90000, { limit: 200000 }, undefined, 0.5);
		expect(result.shouldCompress).toBe(false);
	});

	it("throws when limit is 'auto' and no model provided", () => {
		expect(() => shouldCompress(1000, { limit: "auto" })).toThrow("Cannot resolve context limit");
	});

	it("returns correct result with default config", () => {
		const model = makeModel(200000);
		const result = shouldCompress(100000, undefined, model);
		expect(result.contextLimit).toBe(200000);
		expect(result.shouldCompress).toBe(false);
	});

	it("handles zero context limit gracefully", () => {
		const result = shouldCompress(100, { limit: 0 });
		expect(result.utilizationRatio).toBe(0);
		expect(result.shouldCompress).toBe(false);
	});
});
