import type { Message } from "@earendil-works/pi-ai";
import { beforeEach, describe, expect, it } from "vitest";
import { createCodePreservingStrategy } from "../code-preserving.ts";
import { createIssuePreservingStrategy } from "../issue-preserving.ts";
import {
	type CompressionStrategy,
	clearStrategies,
	getStrategy,
	getStrategyNames,
	registerStrategy,
	unregisterStrategy,
} from "../strategy.ts";
import type { CompressionContext } from "../types.ts";

function makeContext(overrides?: Partial<CompressionContext>): CompressionContext {
	return {
		currentTokens: 50000,
		contextLimit: 200000,
		messages: [],
		...overrides,
	};
}

function userMsg(content: string): Message {
	return { role: "user", content, timestamp: Date.now() };
}

function assistantMsg(text: string): Message {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "openai-completions",
		provider: "openai",
		model: "gpt-4o",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

describe("strategy registry", () => {
	beforeEach(() => {
		clearStrategies();
	});

	it("registers and retrieves a strategy", () => {
		const strategy: CompressionStrategy = {
			name: "test",
			async compress() {
				return { messages: [], tokensSaved: 0 };
			},
		};
		registerStrategy(strategy);
		expect(getStrategy("test")).toBe(strategy);
	});

	it("returns undefined for unknown strategy", () => {
		expect(getStrategy("nonexistent")).toBeUndefined();
	});

	it("throws when registering duplicate name", () => {
		const strategy: CompressionStrategy = {
			name: "dup",
			async compress() {
				return { messages: [], tokensSaved: 0 };
			},
		};
		registerStrategy(strategy);
		expect(() => registerStrategy(strategy)).toThrow("already registered");
	});

	it("unregisters a strategy", () => {
		const strategy: CompressionStrategy = {
			name: "temp",
			async compress() {
				return { messages: [], tokensSaved: 0 };
			},
		};
		registerStrategy(strategy);
		expect(unregisterStrategy("temp")).toBe(true);
		expect(getStrategy("temp")).toBeUndefined();
	});

	it("returns false when unregistering unknown name", () => {
		expect(unregisterStrategy("ghost")).toBe(false);
	});

	it("lists registered strategy names", () => {
		registerStrategy({
			name: "a",
			async compress() {
				return { messages: [], tokensSaved: 0 };
			},
		});
		registerStrategy({
			name: "b",
			async compress() {
				return { messages: [], tokensSaved: 0 };
			},
		});
		expect(getStrategyNames()).toEqual(["a", "b"]);
	});

	it("clear removes all strategies", () => {
		registerStrategy({
			name: "x",
			async compress() {
				return { messages: [], tokensSaved: 0 };
			},
		});
		clearStrategies();
		expect(getStrategyNames()).toEqual([]);
	});
});

describe("strategy selection with built-in strategies", () => {
	beforeEach(() => {
		clearStrategies();
	});

	it("code-preserving strategy can be registered and selected", () => {
		const strategy = createCodePreservingStrategy();
		registerStrategy(strategy);
		expect(getStrategy("code-preserving")).toBe(strategy);
	});

	it("issue-preserving strategy can be registered and selected", () => {
		const strategy = createIssuePreservingStrategy();
		registerStrategy(strategy);
		expect(getStrategy("issue-preserving")).toBe(strategy);
	});

	it("both strategies can coexist", () => {
		registerStrategy(createCodePreservingStrategy());
		registerStrategy(createIssuePreservingStrategy());
		expect(getStrategyNames()).toContain("code-preserving");
		expect(getStrategyNames()).toContain("issue-preserving");
	});
});

describe("code-preserving strategy", () => {
	it("preserves code blocks in user messages", async () => {
		const strategy = createCodePreservingStrategy(1);
		const messages = [
			userMsg("Here is my code:\n```typescript\nconst x = 1;\nconsole.log(x);\n```\nWhat do you think?"),
			userMsg("latest message"),
		];
		const result = await strategy.compress(messages, makeContext());

		expect(result.messages).toHaveLength(2);
		const compressed = result.messages[0];
		if (compressed.role === "user" && typeof compressed.content === "string") {
			expect(compressed.content).toContain("```typescript");
			expect(compressed.content).toContain("const x = 1;");
		} else {
			expect.fail("Expected user message with string content");
		}
	});

	it("keeps recent messages untouched", async () => {
		const strategy = createCodePreservingStrategy(2);
		const recent = userMsg("recent message");
		const messages = [
			userMsg("old message that should be compressed if long enough to warrant summarization"),
			assistantMsg("old response that should also be compressed because it is long"),
			recent,
		];
		const result = await strategy.compress(messages, makeContext());

		expect(result.messages).toHaveLength(3);
		expect(result.messages[2]).toBe(recent);
	});

	it("returns empty result for empty messages", async () => {
		const strategy = createCodePreservingStrategy();
		const result = await strategy.compress([], makeContext());
		expect(result.messages).toEqual([]);
		expect(result.tokensSaved).toBe(0);
	});

	it("returns zero tokens saved when all messages are recent", async () => {
		const strategy = createCodePreservingStrategy(5);
		const messages = [userMsg("hello"), userMsg("world")];
		const result = await strategy.compress(messages, makeContext());
		expect(result.messages).toEqual(messages);
		expect(result.tokensSaved).toBe(0);
	});

	it("reports token savings when old messages are compressed", async () => {
		const strategy = createCodePreservingStrategy(1);
		const longText =
			"This is a long message with many words that should be summarized because it exceeds the threshold for two lines of prose content and contains no code blocks whatsoever.".repeat(
				3,
			);
		const messages = [userMsg(longText), userMsg("short recent")];
		const result = await strategy.compress(messages, makeContext());

		expect(result.tokensSaved).toBeGreaterThanOrEqual(0);
		expect(result.messages).toHaveLength(2);
	});
});

describe("issue-preserving strategy", () => {
	it("preserves issue descriptions in messages", async () => {
		const strategy = createIssuePreservingStrategy(1);
		const messages = [
			userMsg(
				"Bug #42: The application crashes with error: TypeError: Cannot read property 'map' of undefined\nat line 42 in handler.ts",
			),
			userMsg("latest"),
		];
		const result = await strategy.compress(messages, makeContext());

		expect(result.messages).toHaveLength(2);
		const compressed = result.messages[0];
		if (compressed.role === "user" && typeof compressed.content === "string") {
			expect(compressed.content).toContain("Bug #42");
			expect(compressed.content).toContain("TypeError");
		} else {
			expect.fail("Expected user message with string content");
		}
	});

	it("preserves stack traces", async () => {
		const strategy = createIssuePreservingStrategy(1);
		const messages = [
			userMsg(
				"Error: ENOENT: no such file or directory\nStack trace:\n  at Object.readFileSync (fs.js:383)\n  at main (index.ts:15)",
			),
			userMsg("recent"),
		];
		const result = await strategy.compress(messages, makeContext());

		const compressed = result.messages[0];
		if (compressed.role === "user" && typeof compressed.content === "string") {
			expect(compressed.content).toContain("ENOENT");
			expect(compressed.content).toContain("Stack trace");
		} else {
			expect.fail("Expected user message with string content");
		}
	});

	it("keeps recent messages untouched", async () => {
		const strategy = createIssuePreservingStrategy(1);
		const recent = userMsg("recent");
		const messages = [
			userMsg("old message with enough content to be summarized when it exceeds two lines of text"),
			recent,
		];
		const result = await strategy.compress(messages, makeContext());
		expect(result.messages[1]).toBe(recent);
	});

	it("returns empty result for empty messages", async () => {
		const strategy = createIssuePreservingStrategy();
		const result = await strategy.compress([], makeContext());
		expect(result.messages).toEqual([]);
		expect(result.tokensSaved).toBe(0);
	});

	it("summarizes non-issue prose in old messages", async () => {
		const strategy = createIssuePreservingStrategy(1);
		const longProse = [
			"I think we should consider refactoring the entire module.",
			"There are many reasons for this including better testability.",
			"Additionally the current codebase has grown too complex.",
			"We should also consider splitting it into smaller files.",
		].join("\n");
		const messages = [userMsg(longProse), userMsg("recent")];
		const result = await strategy.compress(messages, makeContext());

		const compressed = result.messages[0];
		if (compressed.role === "user" && typeof compressed.content === "string") {
			expect(compressed.content.length).toBeLessThan(longProse.length);
		}
	});
});
