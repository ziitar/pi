import { describe, expect, it } from "vitest";
import { matchAgent, matchAllAgents } from "../match.ts";
import type { AgentPool } from "../types.ts";

describe("matchAgent", () => {
	const pool: AgentPool = {
		version: 1,
		agents: [
			{
				name: "coder",
				categories: ["coding", "debug", "refactor"],
				model: "anthropic/claude-sonnet",
				status: "active",
			},
			{ name: "reviewer", categories: ["review", "security", "testing"], model: "openai/gpt-4o", status: "active" },
			{
				name: "architect",
				categories: ["architecture", "design", "coding"],
				model: "anthropic/claude-sonnet",
				status: "active",
			},
		],
	};

	it("finds agent with exact category match", () => {
		const result = matchAgent("coding", pool);

		expect(result).not.toBeNull();
		expect(result!.agent.name).toBe("coder");
		expect(result!.score).toBeGreaterThan(0);
	});

	it("finds agent with partial category match", () => {
		const partialPool: AgentPool = {
			version: 1,
			agents: [{ name: "debugger", categories: ["debugging", "troubleshooting"], model: "auto", status: "active" }],
		};
		const result = matchAgent("debug", partialPool);

		expect(result).not.toBeNull();
		expect(result!.agent.name).toBe("debugger");
	});

	it("returns null for no match", () => {
		const result = matchAgent("cooking", pool);

		expect(result).toBeNull();
	});

	it("returns null for empty pool", () => {
		const emptyPool: AgentPool = { version: 1, agents: [] };
		const result = matchAgent("coding", emptyPool);

		expect(result).toBeNull();
	});

	it("ignores inactive agents", () => {
		const inactivePool: AgentPool = {
			version: 1,
			agents: [{ name: "coder", categories: ["coding"], model: "auto", status: "inactive" }],
		};

		const result = matchAgent("coding", inactivePool);
		expect(result).toBeNull();
	});

	it("ranks exact match higher than partial match", () => {
		const result = matchAgent("coding", pool);

		expect(result).not.toBeNull();
		expect(result!.agent.name).toBe("coder");
	});

	it("handles case-insensitive matching", () => {
		const result = matchAgent("CODING", pool);

		expect(result).not.toBeNull();
		expect(result!.agent.name).toBe("coder");
	});

	it("handles whitespace in category", () => {
		const result = matchAgent("  coding  ", pool);

		expect(result).not.toBeNull();
		expect(result!.agent.name).toBe("coder");
	});

	it("ranks by category position (first match wins)", () => {
		const poolWithOverlap: AgentPool = {
			version: 1,
			agents: [
				{ name: "a", categories: ["coding", "debug"], model: "auto", status: "active" },
				{ name: "b", categories: ["debug", "coding"], model: "auto", status: "active" },
			],
		};

		const result = matchAgent("coding", poolWithOverlap);
		expect(result!.agent.name).toBe("a");
	});
});

describe("matchAllAgents", () => {
	const pool: AgentPool = {
		version: 1,
		agents: [
			{ name: "coder", categories: ["coding", "debug"], model: "auto", status: "active" },
			{ name: "architect", categories: ["architecture", "coding"], model: "auto", status: "active" },
			{ name: "reviewer", categories: ["review"], model: "auto", status: "active" },
		],
	};

	it("returns all matching agents sorted by score", () => {
		const results = matchAllAgents("coding", pool);

		expect(results).toHaveLength(2);
		expect(results[0].agent.name).toBe("coder");
		expect(results[1].agent.name).toBe("architect");
		expect(results[0].score).toBeGreaterThan(results[1].score);
	});

	it("returns empty array for no matches", () => {
		const results = matchAllAgents("cooking", pool);

		expect(results).toEqual([]);
	});

	it("excludes inactive agents", () => {
		const mixedPool: AgentPool = {
			version: 1,
			agents: [
				{ name: "active", categories: ["coding"], model: "auto", status: "active" },
				{ name: "inactive", categories: ["coding"], model: "auto", status: "inactive" },
			],
		};

		const results = matchAllAgents("coding", mixedPool);
		expect(results).toHaveLength(1);
		expect(results[0].agent.name).toBe("active");
	});
});
