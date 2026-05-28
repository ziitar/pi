import { describe, expect, it } from "vitest";
import { parseAgentIndex } from "../parser.ts";

describe("parseAgentIndex", () => {
	const validIndex = `# Agent Pool
version: 1

| Agent | Categories | Model | Status |
|-------|-----------|-------|--------|
| coder | coding, debug, refactor | anthropic/claude-sonnet | active |
| reviewer | review, security, testing | openai/gpt-4o | active |
| architect | architecture, design | anthropic/claude-sonnet | active |
`;

	it("parses valid agents-index.md with 3 agents", () => {
		const result = parseAgentIndex(validIndex);

		expect(result).not.toBeNull();
		expect(result!.version).toBe(1);
		expect(result!.agents).toHaveLength(3);
	});

	it("parses agent names correctly", () => {
		const result = parseAgentIndex(validIndex);

		expect(result!.agents[0].name).toBe("coder");
		expect(result!.agents[1].name).toBe("reviewer");
		expect(result!.agents[2].name).toBe("architect");
	});

	it("parses categories as array", () => {
		const result = parseAgentIndex(validIndex);

		expect(result!.agents[0].categories).toEqual(["coding", "debug", "refactor"]);
		expect(result!.agents[1].categories).toEqual(["review", "security", "testing"]);
		expect(result!.agents[2].categories).toEqual(["architecture", "design"]);
	});

	it("parses model strings", () => {
		const result = parseAgentIndex(validIndex);

		expect(result!.agents[0].model).toBe("anthropic/claude-sonnet");
		expect(result!.agents[1].model).toBe("openai/gpt-4o");
	});

	it("parses status", () => {
		const result = parseAgentIndex(validIndex);

		expect(result!.agents[0].status).toBe("active");
	});

	it("returns null when version marker is missing", () => {
		const noVersion = `# Agent Pool

| Agent | Categories | Model | Status |
|-------|-----------|-------|--------|
| coder | coding | anthropic/claude-sonnet | active |
`;

		const result = parseAgentIndex(noVersion);
		expect(result).toBeNull();
	});

	it("returns empty agents array for valid version but no table", () => {
		const noTable = `# Agent Pool
version: 1
`;

		const result = parseAgentIndex(noTable);
		expect(result).not.toBeNull();
		expect(result!.agents).toEqual([]);
	});

	it("handles inactive status", () => {
		const content = `# Agent Pool
version: 1

| Agent | Categories | Model | Status |
|-------|-----------|-------|--------|
| coder | coding | anthropic/claude-sonnet | inactive |
`;

		const result = parseAgentIndex(content);
		expect(result!.agents[0].status).toBe("inactive");
	});

	it("handles error status", () => {
		const content = `# Agent Pool
version: 1

| Agent | Categories | Model | Status |
|-------|-----------|-------|--------|
| coder | coding | anthropic/claude-sonnet | error |
`;

		const result = parseAgentIndex(content);
		expect(result!.agents[0].status).toBe("error");
	});

	it("defaults unknown status to active", () => {
		const content = `# Agent Pool
version: 1

| Agent | Categories | Model | Status |
|-------|-----------|-------|--------|
| coder | coding | anthropic/claude-sonnet | unknown |
`;

		const result = parseAgentIndex(content);
		expect(result!.agents[0].status).toBe("active");
	});

	it("parses single category", () => {
		const content = `# Agent Pool
version: 1

| Agent | Categories | Model | Status |
|-------|-----------|-------|--------|
| coder | coding | anthropic/claude-sonnet | active |
`;

		const result = parseAgentIndex(content);
		expect(result!.agents[0].categories).toEqual(["coding"]);
	});

	it("handles extra whitespace in table cells", () => {
		const content = `# Agent Pool
version: 1

| Agent | Categories | Model | Status |
|-------|-----------|-------|--------|
|  coder  |  coding ,  debug  |  anthropic/claude-sonnet  |  active  |
`;

		const result = parseAgentIndex(content);
		expect(result!.agents[0].name).toBe("coder");
		expect(result!.agents[0].categories).toEqual(["coding", "debug"]);
	});
});
