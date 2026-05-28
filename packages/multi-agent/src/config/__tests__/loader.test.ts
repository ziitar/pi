import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../defaults.ts";
import { loadConfig } from "../loader.ts";

let tempDir: string;

beforeEach(() => {
	tempDir = join(tmpdir(), `pi-multi-agent-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
});

afterEach(() => {
	rmSync(tempDir, { recursive: true, force: true });
});

describe("loadConfig", () => {
	it("returns DEFAULT_CONFIG when config directory does not exist", () => {
		const result = loadConfig(join(tempDir, "nonexistent"));
		expect(result).toEqual(DEFAULT_CONFIG);
	});

	it("returns DEFAULT_CONFIG when config directory is empty", () => {
		mkdirSync(tempDir, { recursive: true });
		const result = loadConfig(tempDir);
		expect(result).toEqual(DEFAULT_CONFIG);
	});

	it("returns DEFAULT_CONFIG when directory has no subdirectories with config.json", () => {
		mkdirSync(join(tempDir, "subdir"), { recursive: true });
		const result = loadConfig(tempDir);
		expect(result).toEqual(DEFAULT_CONFIG);
	});

	it("loads a single agent config from subdirectory", () => {
		const agentDir = join(tempDir, "coder");
		mkdirSync(agentDir, { recursive: true });
		writeFileSync(
			join(agentDir, "config.json"),
			JSON.stringify({
				name: "coder",
				model: "claude-sonnet-4-20250514",
				systemPrompt: "You are a coding expert.",
			}),
		);

		const result = loadConfig(tempDir);
		expect(result.agents).toHaveLength(1);
		expect(result.agents[0].name).toBe("coder");
		expect(result.agents[0].model).toBe("claude-sonnet-4-20250514");
	});

	it("loads multiple agent configs from subdirectories", () => {
		const coderDir = join(tempDir, "coder");
		mkdirSync(coderDir, { recursive: true });
		writeFileSync(
			join(coderDir, "config.json"),
			JSON.stringify({ name: "coder", model: "claude-sonnet-4-20250514" }),
		);

		const writerDir = join(tempDir, "writer");
		mkdirSync(writerDir, { recursive: true });
		writeFileSync(join(writerDir, "config.json"), JSON.stringify({ name: "writer", model: "gpt-4o" }));

		const result = loadConfig(tempDir);
		expect(result.agents).toHaveLength(2);
		const names = result.agents.map((a) => a.name).sort();
		expect(names).toEqual(["coder", "writer"]);
	});

	it("skips subdirectories without config.json", () => {
		const goodDir = join(tempDir, "good-agent");
		mkdirSync(goodDir, { recursive: true });
		writeFileSync(join(goodDir, "config.json"), JSON.stringify({ name: "good", model: "gpt-4o" }));

		const emptyDir = join(tempDir, "empty-agent");
		mkdirSync(emptyDir, { recursive: true });

		const result = loadConfig(tempDir);
		expect(result.agents).toHaveLength(1);
		expect(result.agents[0].name).toBe("good");
	});

	it("skips files (not directories) at the top level", () => {
		mkdirSync(tempDir, { recursive: true });
		writeFileSync(join(tempDir, "some-file.json"), JSON.stringify({ name: "should-not-load", model: "gpt-4o" }));

		const result = loadConfig(tempDir);
		// Falls back to DEFAULT_CONFIG when no agent subdirectories exist
		expect(result).toEqual(DEFAULT_CONFIG);
	});

	it("throws on invalid agent config in subdirectory", () => {
		const agentDir = join(tempDir, "bad-agent");
		mkdirSync(agentDir, { recursive: true });
		writeFileSync(join(agentDir, "config.json"), JSON.stringify({ name: "", model: "" }));

		expect(() => loadConfig(tempDir)).toThrow("Invalid agent config");
	});

	it("strips JSON comments from config files", () => {
		const agentDir = join(tempDir, "coder");
		mkdirSync(agentDir, { recursive: true });
		writeFileSync(
			join(agentDir, "config.json"),
			`{
				// This is a comment
				"name": "coder",
				"model": "claude-sonnet-4-20250514" /* inline */,
				/* block
				   comment */
				"systemPrompt": "hello"
			}`,
		);

		const result = loadConfig(tempDir);
		expect(result.agents).toHaveLength(1);
		expect(result.agents[0].name).toBe("coder");
	});

	it("throws on malformed JSON in config file", () => {
		const agentDir = join(tempDir, "bad");
		mkdirSync(agentDir, { recursive: true });
		writeFileSync(join(agentDir, "config.json"), "not valid json");

		expect(() => loadConfig(tempDir)).toThrow("Invalid JSON in config");
	});

	it("does not mutate DEFAULT_CONFIG between calls", () => {
		const result1 = loadConfig(join(tempDir, "nonexistent1"));
		const result2 = loadConfig(join(tempDir, "nonexistent2"));
		expect(result1).toEqual(result2);
		expect(result1).toEqual(DEFAULT_CONFIG);
	});
});
