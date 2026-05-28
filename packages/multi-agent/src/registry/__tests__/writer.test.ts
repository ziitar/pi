import { describe, expect, it } from "vitest";
import { parseAgentIndex } from "../parser.ts";
import type { AgentPool } from "../types.ts";
import { writeAgentIndex } from "../writer.ts";

describe("writeAgentIndex", () => {
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
		],
	};

	it("writes version marker", () => {
		const result = writeAgentIndex(pool);

		expect(result).toContain("version: 1");
	});

	it("writes header row", () => {
		const result = writeAgentIndex(pool);

		expect(result).toContain("| Agent | Categories | Model | Status |");
	});

	it("writes separator row", () => {
		const result = writeAgentIndex(pool);

		expect(result).toContain("|-------|-----------|-------|--------|");
	});

	it("writes agent entries", () => {
		const result = writeAgentIndex(pool);

		expect(result).toContain("| coder | coding, debug, refactor | anthropic/claude-sonnet | active |");
		expect(result).toContain("| reviewer | review, security, testing | openai/gpt-4o | active |");
	});

	it("writes title", () => {
		const result = writeAgentIndex(pool);

		expect(result).toContain("# Agent Pool");
	});

	it("roundtrips with parseAgentIndex", () => {
		const written = writeAgentIndex(pool);
		const parsed = parseAgentIndex(written);

		expect(parsed).not.toBeNull();
		expect(parsed!.version).toBe(pool.version);
		expect(parsed!.agents).toHaveLength(pool.agents.length);

		for (let i = 0; i < pool.agents.length; i++) {
			expect(parsed!.agents[i].name).toBe(pool.agents[i].name);
			expect(parsed!.agents[i].categories).toEqual(pool.agents[i].categories);
			expect(parsed!.agents[i].model).toBe(pool.agents[i].model);
			expect(parsed!.agents[i].status).toBe(pool.agents[i].status);
		}
	});

	it("handles empty agents list", () => {
		const emptyPool: AgentPool = { version: 1, agents: [] };
		const result = writeAgentIndex(emptyPool);

		expect(result).toContain("version: 1");
		expect(result).toContain("| Agent | Categories | Model | Status |");
		expect(parseAgentIndex(result)!.agents).toEqual([]);
	});

	it("handles single agent", () => {
		const singlePool: AgentPool = {
			version: 1,
			agents: [{ name: "coder", categories: ["coding"], model: "auto", status: "active" }],
		};
		const result = writeAgentIndex(singlePool);

		expect(result).toContain("| coder | coding | auto | active |");
	});

	it("handles inactive status", () => {
		const inactivePool: AgentPool = {
			version: 1,
			agents: [{ name: "coder", categories: ["coding"], model: "auto", status: "inactive" }],
		};
		const result = writeAgentIndex(inactivePool);

		expect(result).toContain("inactive");
	});
});
