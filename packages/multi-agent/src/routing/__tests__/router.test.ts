import { describe, expect, it, vi } from "vitest";
import type { AgentConfig } from "../../config/schema.ts";
import { parseModelSpec, resolveModel, resolveModelWithFallback } from "../router.ts";
import { ModelResolutionError } from "../types.ts";

vi.mock("@earendil-works/pi-ai", () => ({
	getModel: vi.fn((provider: string, modelId: string) => {
		if (provider === "invalid") {
			throw new Error(`Unknown provider: ${provider}`);
		}
		return {
			id: modelId,
			name: `${provider}/${modelId}`,
			api: "openai-completions",
			provider,
			baseUrl: "https://api.example.com",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128000,
			maxTokens: 4096,
		};
	}),
}));

describe("parseModelSpec", () => {
	it("parses provider/modelId format", () => {
		const spec = parseModelSpec("anthropic/claude-sonnet");
		expect(spec).toEqual({ provider: "anthropic", modelId: "claude-sonnet" });
	});

	it("parses deepseek model", () => {
		const spec = parseModelSpec("deepseek/deepseek-v4");
		expect(spec).toEqual({ provider: "deepseek", modelId: "deepseek-v4" });
	});

	it("returns default for 'auto'", () => {
		const spec = parseModelSpec("auto");
		expect(spec).toEqual({ provider: "deepseek", modelId: "deepseek-v4-flash" });
	});

	it("returns default for empty string", () => {
		const spec = parseModelSpec("");
		expect(spec).toEqual({ provider: "deepseek", modelId: "deepseek-v4-flash" });
	});

	it("handles whitespace", () => {
		const spec = parseModelSpec("  anthropic/claude-sonnet  ");
		expect(spec).toEqual({ provider: "anthropic", modelId: "claude-sonnet" });
	});

	it("throws for invalid format without slash", () => {
		expect(() => parseModelSpec("invalid-format")).toThrow(ModelResolutionError);
	});

	it("throws for model with only provider", () => {
		expect(() => parseModelSpec("anthropic")).toThrow(ModelResolutionError);
	});
});

describe("resolveModel", () => {
	it("resolves valid agent config", () => {
		const config: AgentConfig = {
			name: "test-agent",
			model: "anthropic/claude-sonnet",
		};

		const result = resolveModel(config);
		expect(result.model).toBeDefined();
		expect(result.model.provider).toBe("anthropic");
		expect(result.model.id).toBe("claude-sonnet");
	});

	it("resolves auto model to deepseek default", () => {
		const config: AgentConfig = {
			name: "test-agent",
			model: "auto",
		};

		const result = resolveModel(config);
		expect(result.model.provider).toBe("deepseek");
		expect(result.model.id).toBe("deepseek-v4-flash");
	});

	it("includes thinking level from config", () => {
		const config: AgentConfig = {
			name: "test-agent",
			model: "anthropic/claude-sonnet",
			thinkingLevel: "high",
		};

		const result = resolveModel(config);
		expect(result.thinkingLevel).toBe("high");
	});

	it("throws for invalid provider", () => {
		const config: AgentConfig = {
			name: "test-agent",
			model: "invalid/model",
		};

		expect(() => resolveModel(config)).toThrow(ModelResolutionError);
	});
});

describe("resolveModelWithFallback", () => {
	it("resolves primary model when available", () => {
		const config: AgentConfig = {
			name: "test-agent",
			model: "anthropic/claude-sonnet",
		};

		const result = resolveModelWithFallback(config);
		expect(result.model.provider).toBe("anthropic");
		expect(result.model.id).toBe("claude-sonnet");
	});

	it("falls back to first available model when primary fails", () => {
		const config: AgentConfig = {
			name: "test-agent",
			model: "invalid/model",
		};

		const result = resolveModelWithFallback(config, ["openai/gpt-4o", "anthropic/claude-sonnet"]);
		expect(result.model.provider).toBe("openai");
		expect(result.model.id).toBe("gpt-4o");
	});

	it("tries all fallbacks in order", () => {
		const config: AgentConfig = {
			name: "test-agent",
			model: "invalid/model",
		};

		const result = resolveModelWithFallback(config, ["invalid/also-bad", "deepseek/deepseek-v4"]);
		expect(result.model.provider).toBe("deepseek");
		expect(result.model.id).toBe("deepseek-v4");
	});

	it("throws when all models fail", () => {
		const config: AgentConfig = {
			name: "test-agent",
			model: "invalid/model",
		};

		expect(() => resolveModelWithFallback(config, ["invalid/bad1", "invalid/bad2"])).toThrow(ModelResolutionError);
	});

	it("throws when no fallbacks provided and primary fails", () => {
		const config: AgentConfig = {
			name: "test-agent",
			model: "invalid/model",
		};

		expect(() => resolveModelWithFallback(config)).toThrow(ModelResolutionError);
	});

	it("works with empty fallback array", () => {
		const config: AgentConfig = {
			name: "test-agent",
			model: "anthropic/claude-sonnet",
		};

		const result = resolveModelWithFallback(config, []);
		expect(result.model.provider).toBe("anthropic");
	});
});
