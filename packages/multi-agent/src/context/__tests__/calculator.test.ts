import type { Message } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { estimateContextTokens, estimateMessageTokens, estimateTokens } from "../calculator.ts";

describe("estimateTokens", () => {
	it("estimates tokens from text length (~4 chars per token)", () => {
		expect(estimateTokens("hello")).toBe(2);
		expect(estimateTokens("a".repeat(4))).toBe(1);
		expect(estimateTokens("a".repeat(8))).toBe(2);
		expect(estimateTokens("a".repeat(100))).toBe(25);
	});

	it("returns 0 for empty string", () => {
		expect(estimateTokens("")).toBe(0);
	});

	it("rounds up for partial tokens", () => {
		expect(estimateTokens("abc")).toBe(1);
		expect(estimateTokens("abcde")).toBe(2);
	});
});

describe("estimateMessageTokens", () => {
	it("estimates user message with string content", () => {
		const message: Message = {
			role: "user",
			content: "hello world",
			timestamp: Date.now(),
		};
		expect(estimateMessageTokens(message)).toBe(Math.ceil(11 / 4));
	});

	it("estimates user message with array content", () => {
		const message: Message = {
			role: "user",
			content: [
				{ type: "text", text: "hello " },
				{ type: "text", text: "world" },
			],
			timestamp: Date.now(),
		};
		expect(estimateMessageTokens(message)).toBe(Math.ceil(11 / 4));
	});

	it("estimates assistant message with text content", () => {
		const message: Message = {
			role: "assistant",
			content: [{ type: "text", text: "hello world" }],
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
		expect(estimateMessageTokens(message)).toBe(Math.ceil(11 / 4));
	});

	it("estimates assistant message with thinking content", () => {
		const message: Message = {
			role: "assistant",
			content: [{ type: "thinking", thinking: "let me think about this" }],
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
		expect(estimateMessageTokens(message)).toBe(Math.ceil(22 / 4));
	});

	it("estimates assistant message with tool call", () => {
		const message: Message = {
			role: "assistant",
			content: [{ type: "toolCall", id: "tc1", name: "read_file", arguments: { path: "/foo" } }],
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
		const result = estimateMessageTokens(message);
		expect(result).toBeGreaterThan(0);
	});

	it("estimates tool result message", () => {
		const message: Message = {
			role: "toolResult",
			toolCallId: "tc1",
			toolName: "read_file",
			content: [{ type: "text", text: "file contents here" }],
			isError: false,
			timestamp: Date.now(),
		};
		expect(estimateMessageTokens(message)).toBe(Math.ceil(18 / 4));
	});

	it("returns 0 for empty assistant content", () => {
		const message: Message = {
			role: "assistant",
			content: [],
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
		expect(estimateMessageTokens(message)).toBe(0);
	});
});

describe("estimateContextTokens", () => {
	it("sums tokens across multiple messages", () => {
		const messages: Message[] = [
			{ role: "user", content: "hello", timestamp: Date.now() },
			{ role: "user", content: "world", timestamp: Date.now() },
		];
		const result = estimateContextTokens(messages);
		expect(result).toBe(estimateTokens("hello") + estimateTokens("world"));
	});

	it("returns 0 for empty message array", () => {
		expect(estimateContextTokens([])).toBe(0);
	});
});
