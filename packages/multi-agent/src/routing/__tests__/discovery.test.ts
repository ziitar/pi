import { describe, expect, it, vi } from "vitest";
import type { AgentPool } from "../../registry/types.ts";
import type { ClassificationResult } from "../discovery.ts";
import { discoverAgentForTask, discoverAgentsForTask, routeTask } from "../discovery.ts";
import { AgentDiscoveryError } from "../types.ts";

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

const testPool: AgentPool = {
	version: 1,
	agents: [
		{
			name: "coder",
			categories: ["coding", "debug", "refactor"],
			model: "anthropic/claude-sonnet",
			status: "active",
		},
		{
			name: "reviewer",
			categories: ["review", "security", "testing"],
			model: "openai/gpt-4o",
			status: "active",
		},
		{
			name: "architect",
			categories: ["architecture", "design", "coding"],
			model: "anthropic/claude-sonnet",
			status: "active",
		},
		{
			name: "inactive-agent",
			categories: ["coding"],
			model: "openai/gpt-4o",
			status: "inactive",
		},
	],
};

describe("discoverAgentForTask", () => {
	it("finds agent with exact category match", () => {
		const classification: ClassificationResult = { category: "coding", confidence: 0.95 };
		const agent = discoverAgentForTask(classification, testPool);

		expect(agent.name).toBe("coder");
	});

	it("finds agent with partial category match", () => {
		const classification: ClassificationResult = { category: "debug", confidence: 0.8 };
		const agent = discoverAgentForTask(classification, testPool);

		expect(agent.name).toBe("coder");
	});

	it("throws when no agent matches", () => {
		const classification: ClassificationResult = { category: "cooking", confidence: 0.9 };

		expect(() => discoverAgentForTask(classification, testPool)).toThrow(AgentDiscoveryError);
	});

	it("ignores inactive agents", () => {
		const inactivePool: AgentPool = {
			version: 1,
			agents: [{ name: "inactive", categories: ["coding"], model: "auto", status: "inactive" }],
		};
		const classification: ClassificationResult = { category: "coding", confidence: 0.9 };

		expect(() => discoverAgentForTask(classification, inactivePool)).toThrow(AgentDiscoveryError);
	});

	it("handles case-insensitive matching", () => {
		const classification: ClassificationResult = { category: "CODING", confidence: 0.9 };
		const agent = discoverAgentForTask(classification, testPool);

		expect(agent.name).toBe("coder");
	});
});

describe("discoverAgentsForTask", () => {
	it("returns all matching agents sorted by score", () => {
		const classification: ClassificationResult = { category: "coding", confidence: 0.9 };
		const agents = discoverAgentsForTask(classification, testPool);

		expect(agents).toHaveLength(2);
		expect(agents[0].name).toBe("coder");
		expect(agents[1].name).toBe("architect");
	});

	it("returns empty array for no matches", () => {
		const classification: ClassificationResult = { category: "cooking", confidence: 0.9 };
		const agents = discoverAgentsForTask(classification, testPool);

		expect(agents).toEqual([]);
	});

	it("respects limit parameter", () => {
		const classification: ClassificationResult = { category: "coding", confidence: 0.9 };
		const agents = discoverAgentsForTask(classification, testPool, 1);

		expect(agents).toHaveLength(1);
		expect(agents[0].name).toBe("coder");
	});

	it("excludes inactive agents", () => {
		const classification: ClassificationResult = { category: "coding", confidence: 0.9 };
		const agents = discoverAgentsForTask(classification, testPool);

		expect(agents.every((a) => a.name !== "inactive-agent")).toBe(true);
	});
});

describe("routeTask", () => {
	it("returns routing result with agent and resolved model", () => {
		const classification: ClassificationResult = { category: "coding", confidence: 0.9 };
		const result = routeTask(classification, testPool);

		expect(result.agent.name).toBe("coder");
		expect(result.resolved.model).toBeDefined();
		expect(result.resolved.model.provider).toBe("anthropic");
		expect(result.score).toBeGreaterThan(0);
		expect(result.matchedCategory).toBe("coding");
	});

	it("throws when no agent matches", () => {
		const classification: ClassificationResult = { category: "cooking", confidence: 0.9 };

		expect(() => routeTask(classification, testPool)).toThrow(AgentDiscoveryError);
	});

	it("uses fallback models when primary fails", () => {
		const poolWithBadModel: AgentPool = {
			version: 1,
			agents: [
				{
					name: "agent-with-bad-model",
					categories: ["test-category"],
					model: "invalid/model",
					status: "active",
				},
			],
		};
		const classification: ClassificationResult = { category: "test-category", confidence: 0.9 };
		const result = routeTask(classification, poolWithBadModel, ["openai/gpt-4o"]);

		expect(result.resolved.model.provider).toBe("openai");
		expect(result.resolved.model.id).toBe("gpt-4o");
	});

	it("returns correct match score", () => {
		const classification: ClassificationResult = { category: "coding", confidence: 0.9 };
		const result = routeTask(classification, testPool);

		expect(result.score).toBeGreaterThan(0);
		expect(result.score).toBeLessThanOrEqual(1);
	});
});
