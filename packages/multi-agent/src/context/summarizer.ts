import type { Message, Model } from "@earendil-works/pi-ai";
import { completeSimple } from "@earendil-works/pi-ai";

const SUMMARIZATION_SYSTEM_PROMPT = `You are a context compression assistant. Your task is to read messages from a multi-agent conversation and produce a concise structured summary that preserves all essential information for continuing the work.

Do NOT continue the conversation. Do NOT respond to any questions in the messages. ONLY output the structured summary.`;

const SUMMARIZATION_PROMPT = `The messages above are from a multi-agent conversation. Create a structured summary that preserves all essential context for continuing the work.

Use this EXACT format:

## Goal
[What is being accomplished]

## Progress
### Done
- [x] [Completed items]

### In Progress
- [ ] [Current work]

### Blocked
- [Issues preventing progress, if any]

## Key Decisions
- **[Decision]**: [Brief rationale]

## Critical Context
- [Any data, file paths, function names, error messages needed to continue]

Keep each section concise. Preserve exact file paths, function names, and error messages.`;

function serializeMessages(messages: Message[]): string {
	const parts: string[] = [];

	for (const msg of messages) {
		if (msg.role === "user") {
			const content =
				typeof msg.content === "string"
					? msg.content
					: msg.content
							.filter((c): c is { type: "text"; text: string } => c.type === "text")
							.map((c) => c.text)
							.join("");
			if (content) parts.push(`[User]: ${content}`);
		} else if (msg.role === "assistant") {
			const textParts: string[] = [];
			for (const block of msg.content) {
				if (block.type === "text") {
					textParts.push(block.text);
				} else if (block.type === "toolCall") {
					textParts.push(`[tool call: ${block.name}]`);
				}
			}
			if (textParts.length > 0) parts.push(`[Assistant]: ${textParts.join("\n")}`);
		} else if (msg.role === "toolResult") {
			const content = msg.content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("");
			if (content) {
				const truncated = content.length > 2000 ? `${content.slice(0, 2000)}\n…[truncated]` : content;
				parts.push(`[Tool result (${msg.toolName})]: ${truncated}`);
			}
		}
	}

	return parts.join("\n\n");
}

export interface SummarizeOptions {
	model: Model<any>;
	messages: Message[];
	maxTokens?: number;
	signal?: AbortSignal;
	apiKey?: string;
	headers?: Record<string, string>;
}

export interface SummarizeResult {
	summary: string;
	tokensUsed: number;
}

export async function summarizeMessages(options: SummarizeOptions): Promise<SummarizeResult> {
	const { model, messages, maxTokens = 4096, signal, apiKey, headers } = options;

	if (messages.length === 0) {
		return { summary: "No messages to summarize.", tokensUsed: 0 };
	}

	const conversationText = serializeMessages(messages);
	const promptText = `<messages>\n${conversationText}\n</messages>\n\n${SUMMARIZATION_PROMPT}`;

	const summarizationMessages = [
		{
			role: "user" as const,
			content: [{ type: "text" as const, text: promptText }],
			timestamp: Date.now(),
		},
	];

	const response = await completeSimple(
		model,
		{ systemPrompt: SUMMARIZATION_SYSTEM_PROMPT, messages: summarizationMessages },
		{ maxTokens, signal, apiKey, headers },
	);

	if (response.stopReason === "error" || response.stopReason === "aborted") {
		throw new Error(`Summarization failed: ${response.errorMessage ?? response.stopReason}`);
	}

	const summary = response.content
		.filter((c): c is { type: "text"; text: string } => c.type === "text")
		.map((c) => c.text)
		.join("\n");

	return {
		summary: summary || "No summary generated.",
		tokensUsed: response.usage.totalTokens,
	};
}
