import type { AssistantMessage, Message } from "@earendil-works/pi-ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@earendil-works/pi-ai", () => ({
	completeSimple: vi.fn(),
}));

import { completeSimple } from "@earendil-works/pi-ai";
import { summarizeMessages } from "../summarizer.ts";

const mockCompleteSimple = vi.mocked(completeSimple);

function makeModel() {
	return {
		id: "test-model",
		name: "Test Model",
		api: "openai-completions" as const,
		provider: "openai" as const,
		baseUrl: "http://localhost",
		reasoning: false,
		input: ["text" as const],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 4096,
	};
}

function makeAssistantResponse(text: string): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "openai-completions",
		provider: "openai",
		model: "test-model",
		usage: {
			input: 100,
			output: 50,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 150,
			cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.003 },
		},
		stopReason: "stop",
		timestamp: Date.now(),
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
		model: "test-model",
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

describe("summarizeMessages", () => {
	beforeEach(() => {
		mockCompleteSimple.mockReset();
	});

	it("returns early summary for empty messages", async () => {
		const result = await summarizeMessages({ model: makeModel(), messages: [] });
		expect(result.summary).toBe("No messages to summarize.");
		expect(result.tokensUsed).toBe(0);
		expect(mockCompleteSimple).not.toHaveBeenCalled();
	});

	it("calls completeSimple with correct system prompt and messages", async () => {
		const summaryText = "## Goal\nTest goal\n\n## Progress\n### Done\n- [x] Completed task";
		mockCompleteSimple.mockResolvedValue(makeAssistantResponse(summaryText));

		const messages = [userMsg("Do the thing"), assistantMsg("Done the thing")];
		await summarizeMessages({ model: makeModel(), messages });

		expect(mockCompleteSimple).toHaveBeenCalledOnce();
		const [_model, context, _options] = mockCompleteSimple.mock.calls[0];
		expect(context.systemPrompt).toContain("context compression assistant");
		expect(context.messages).toHaveLength(1);
		expect(context.messages[0].role).toBe("user");
	});

	it("returns summary text and token usage", async () => {
		const summaryText = "## Goal\nBuild widget\n\n## Progress\n### Done\n- [x] Setup";
		mockCompleteSimple.mockResolvedValue(makeAssistantResponse(summaryText));

		const result = await summarizeMessages({
			model: makeModel(),
			messages: [userMsg("Build a widget"), assistantMsg("I'll build it")],
		});

		expect(result.summary).toBe(summaryText);
		expect(result.tokensUsed).toBe(150);
	});

	it("throws on error stop reason", async () => {
		mockCompleteSimple.mockResolvedValue({
			...makeAssistantResponse(""),
			stopReason: "error",
			errorMessage: "API failure",
		});

		await expect(summarizeMessages({ model: makeModel(), messages: [userMsg("test")] })).rejects.toThrow(
			"Summarization failed: API failure",
		);
	});

	it("throws on aborted stop reason", async () => {
		mockCompleteSimple.mockResolvedValue({
			...makeAssistantResponse(""),
			stopReason: "aborted",
			errorMessage: "Cancelled",
		});

		await expect(summarizeMessages({ model: makeModel(), messages: [userMsg("test")] })).rejects.toThrow(
			"Summarization failed: Cancelled",
		);
	});

	it("uses default error message when errorMessage is undefined", async () => {
		mockCompleteSimple.mockResolvedValue({
			...makeAssistantResponse(""),
			stopReason: "error",
		});

		await expect(summarizeMessages({ model: makeModel(), messages: [userMsg("test")] })).rejects.toThrow(
			"Summarization failed: error",
		);
	});

	it("passes maxTokens option to completeSimple", async () => {
		mockCompleteSimple.mockResolvedValue(makeAssistantResponse("summary"));

		await summarizeMessages({
			model: makeModel(),
			messages: [userMsg("test")],
			maxTokens: 2048,
		});

		const call = mockCompleteSimple.mock.calls[0];
		expect(call[2]).toBeDefined();
		expect(call[2]!.maxTokens).toBe(2048);
	});

	it("passes signal option to completeSimple", async () => {
		mockCompleteSimple.mockResolvedValue(makeAssistantResponse("summary"));
		const controller = new AbortController();

		await summarizeMessages({
			model: makeModel(),
			messages: [userMsg("test")],
			signal: controller.signal,
		});

		const call = mockCompleteSimple.mock.calls[0];
		expect(call[2]).toBeDefined();
		expect(call[2]!.signal).toBe(controller.signal);
	});

	it("serializes user, assistant, and tool result messages", async () => {
		mockCompleteSimple.mockResolvedValue(makeAssistantResponse("ok"));

		const toolResult: Message = {
			role: "toolResult",
			toolCallId: "tc1",
			toolName: "read_file",
			content: [{ type: "text", text: "file contents" }],
			isError: false,
			timestamp: Date.now(),
		};

		await summarizeMessages({
			model: makeModel(),
			messages: [userMsg("read file"), assistantMsg("reading"), toolResult],
		});

		const [, context] = mockCompleteSimple.mock.calls[0];
		const userMessage = context.messages[0];
		if (userMessage.role === "user" && typeof userMessage.content !== "string") {
			const text = userMessage.content[0];
			if (text.type === "text") {
				expect(text.text).toContain("[User]:");
				expect(text.text).toContain("[Assistant]:");
				expect(text.text).toContain("[Tool result (read_file)]:");
			}
		}
	});

	it("handles multiple text blocks in summary response", async () => {
		const assistantResponse: AssistantMessage = {
			...makeAssistantResponse(""),
			content: [
				{ type: "text", text: "## Goal\n" },
				{ type: "text", text: "Build something" },
			],
		};
		mockCompleteSimple.mockResolvedValue(assistantResponse);

		const result = await summarizeMessages({
			model: makeModel(),
			messages: [userMsg("test")],
		});

		expect(result.summary).toBe("## Goal\n\nBuild something");
	});
});
