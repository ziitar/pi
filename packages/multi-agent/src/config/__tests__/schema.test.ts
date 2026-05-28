import { Compile } from "typebox/compile";
import { describe, expect, it } from "vitest";
import { AgentConfigSchema, MultiAgentConfigSchema } from "../schema.ts";

describe("AgentConfigSchema", () => {
	it("accepts a valid agent config with only required fields", () => {
		const config = { name: "coder", model: "claude-sonnet-4-20250514" };
		const C = Compile(AgentConfigSchema);
		expect(C.Check(config)).toBe(true);
	});

	it("accepts a valid agent config with all optional fields", () => {
		const config = {
			name: "coder",
			model: "claude-sonnet-4-20250514",
			thinkingLevel: "high",
			tools: ["read_file", "write_file"],
			categories: ["coding", "code-review"],
			systemPrompt: "You are a coding expert.",
			contextLimit: 64000,
			compressionStrategy: "summary",
			workspace: "/projects/foo",
		};
		const C = Compile(AgentConfigSchema);
		expect(C.Check(config)).toBe(true);
	});

	it("rejects config with empty name", () => {
		const config = { name: "", model: "gpt-4o" };
		const C = Compile(AgentConfigSchema);
		expect(C.Check(config)).toBe(false);
	});

	it("rejects config with empty model", () => {
		const config = { name: "agent", model: "" };
		const C = Compile(AgentConfigSchema);
		expect(C.Check(config)).toBe(false);
	});

	it("rejects config with invalid thinkingLevel", () => {
		const config = {
			name: "agent",
			model: "gpt-4o",
			thinkingLevel: "turbo",
		};
		const C = Compile(AgentConfigSchema);
		expect(C.Check(config)).toBe(false);
	});

	it("rejects config with negative contextLimit", () => {
		const config = {
			name: "agent",
			model: "gpt-4o",
			contextLimit: -1,
		};
		const C = Compile(AgentConfigSchema);
		expect(C.Check(config)).toBe(false);
	});

	it("rejects config with invalid compressionStrategy", () => {
		const config = {
			name: "agent",
			model: "gpt-4o",
			compressionStrategy: "gzip",
		};
		const C = Compile(AgentConfigSchema);
		expect(C.Check(config)).toBe(false);
	});
});

describe("MultiAgentConfigSchema", () => {
	it("accepts a valid multi-agent config with agents array", () => {
		const config = {
			agents: [
				{ name: "coder", model: "claude-sonnet-4-20250514" },
				{ name: "writer", model: "gpt-4o" },
			],
		};
		const C = Compile(MultiAgentConfigSchema);
		expect(C.Check(config)).toBe(true);
	});

	it("accepts config with all optional fields", () => {
		const config = {
			agents: [{ name: "coder", model: "claude-sonnet-4-20250514" }],
			maxConcurrency: 5,
			defaultTimeout: 60000,
			classifierModel: "deepseek-v4-flash",
		};
		const C = Compile(MultiAgentConfigSchema);
		expect(C.Check(config)).toBe(true);
	});

	it("rejects config with maxConcurrency above 10", () => {
		const config = {
			agents: [{ name: "coder", model: "gpt-4o" }],
			maxConcurrency: 20,
		};
		const C = Compile(MultiAgentConfigSchema);
		expect(C.Check(config)).toBe(false);
	});

	it("rejects config with defaultTimeout above 600000", () => {
		const config = {
			agents: [{ name: "coder", model: "gpt-4o" }],
			defaultTimeout: 999999,
		};
		const C = Compile(MultiAgentConfigSchema);
		expect(C.Check(config)).toBe(false);
	});

	it("rejects config with empty agents array", () => {
		const config = { agents: [] };
		const C = Compile(MultiAgentConfigSchema);
		expect(C.Check(config)).toBe(false);
	});

	it("rejects config with missing agents field", () => {
		const config = { maxConcurrency: 3 };
		const C = Compile(MultiAgentConfigSchema);
		expect(C.Check(config)).toBe(false);
	});
});
