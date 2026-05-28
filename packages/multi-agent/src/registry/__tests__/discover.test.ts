import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverAgents } from "../discover.ts";

describe("discoverAgents", () => {
	const testDir = join(import.meta.dirname, "__test_agents__");

	beforeEach(() => {
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("returns empty array for non-existent directory", () => {
		const result = discoverAgents("/non/existent/path");
		expect(result).toEqual([]);
	});

	it("returns empty array for empty directory", () => {
		const result = discoverAgents(testDir);
		expect(result).toEqual([]);
	});

	it("discovers agent with valid config.yaml", () => {
		const agentDir = join(testDir, "coder");
		mkdirSync(agentDir);
		writeFileSync(
			join(agentDir, "config.yaml"),
			`name: coder
model: anthropic/claude-sonnet
categories:
  - coding
  - debug
`,
		);

		const result = discoverAgents(testDir);

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("coder");
		expect(result[0].path).toBe(agentDir);
		expect(result[0].config.name).toBe("coder");
		expect(result[0].config.model).toBe("anthropic/claude-sonnet");
		expect(result[0].config.categories).toEqual(["coding", "debug"]);
	});

	it("discovers multiple agents", () => {
		const coderDir = join(testDir, "coder");
		const reviewerDir = join(testDir, "reviewer");
		mkdirSync(coderDir);
		mkdirSync(reviewerDir);

		writeFileSync(
			join(coderDir, "config.yaml"),
			`name: coder
model: anthropic/claude-sonnet
categories:
  - coding
`,
		);
		writeFileSync(
			join(reviewerDir, "config.yaml"),
			`name: reviewer
model: openai/gpt-4o
categories:
  - review
`,
		);

		const result = discoverAgents(testDir);

		expect(result).toHaveLength(2);
		const names = result.map((a) => a.name).sort();
		expect(names).toEqual(["coder", "reviewer"]);
	});

	it("skips directories without config.yaml", () => {
		const agentDir = join(testDir, "no-config");
		mkdirSync(agentDir);
		writeFileSync(join(agentDir, "README.md"), "no config here");

		const result = discoverAgents(testDir);
		expect(result).toEqual([]);
	});

	it("skips non-directory entries", () => {
		writeFileSync(join(testDir, "file.txt"), "not a directory");

		const result = discoverAgents(testDir);
		expect(result).toEqual([]);
	});

	it("uses directory name as default agent name", () => {
		const agentDir = join(testDir, "my-agent");
		mkdirSync(agentDir);
		writeFileSync(
			join(agentDir, "config.yaml"),
			`model: auto
categories:
  - coding
`,
		);

		const result = discoverAgents(testDir);

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("my-agent");
		expect(result[0].config.name).toBe("my-agent");
	});

	it("defaults model to auto when not specified", () => {
		const agentDir = join(testDir, "coder");
		mkdirSync(agentDir);
		writeFileSync(
			join(agentDir, "config.yaml"),
			`name: coder
categories:
  - coding
`,
		);

		const result = discoverAgents(testDir);
		expect(result[0].config.model).toBe("auto");
	});

	it("defaults categories to empty array when not specified", () => {
		const agentDir = join(testDir, "coder");
		mkdirSync(agentDir);
		writeFileSync(
			join(agentDir, "config.yaml"),
			`name: coder
model: auto
`,
		);

		const result = discoverAgents(testDir);
		expect(result[0].config.categories).toEqual([]);
	});

	it("handles malformed YAML gracefully with defaults", () => {
		const agentDir = join(testDir, "bad-agent");
		mkdirSync(agentDir);
		writeFileSync(join(agentDir, "config.yaml"), `{{invalid yaml`);

		const result = discoverAgents(testDir);
		expect(result).toHaveLength(1);
		expect(result[0].config.name).toBe("bad-agent");
		expect(result[0].config.model).toBe("auto");
		expect(result[0].config.categories).toEqual([]);
	});

	it("parses systemPrompt field", () => {
		const agentDir = join(testDir, "coder");
		mkdirSync(agentDir);
		writeFileSync(
			join(agentDir, "config.yaml"),
			`name: coder
model: auto
categories:
  - coding
systemPrompt: /path/to/prompt.md
`,
		);

		const result = discoverAgents(testDir);
		expect(result[0].config.systemPrompt).toBe("/path/to/prompt.md");
	});
});
