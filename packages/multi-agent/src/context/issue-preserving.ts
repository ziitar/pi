import type { Message } from "@earendil-works/pi-ai";
import { estimateMessageTokens } from "./calculator.ts";
import type { CompressionStrategy, CompressionStrategyResult } from "./strategy.ts";

const ISSUE_PATTERNS = [
	/^#\s+\d+/m,
	/\bissue\b[:\s]*#?\d+/i,
	/\bbug\b[:\s]*#?\d+/i,
	/\berror\b[:\s]+/i,
	/\bfail(ed|ure|ing)?\b/i,
	/\bexception\b/i,
	/\bstack\s*trace\b/i,
	/\btraceback\b/i,
];

function containsIssueContent(text: string): boolean {
	return ISSUE_PATTERNS.some((p) => p.test(text));
}

function preserveIssueText(text: string): string {
	if (containsIssueContent(text)) {
		const lines = text.split("\n");
		const preserved: string[] = [];
		for (const line of lines) {
			if (ISSUE_PATTERNS.some((p) => p.test(line)) || line.trim().startsWith("```")) {
				preserved.push(line);
			}
		}
		if (preserved.length > 0 && preserved.length < lines.length) {
			return preserved.join("\n");
		}
		return text;
	}

	const lines = text.split("\n").filter((l) => l.trim().length > 0);
	if (lines.length <= 2) return text;
	return `${lines.slice(0, 2).join("\n")}\n…`;
}

function compressMessage(message: Message): Message {
	if (message.role === "user") {
		if (typeof message.content === "string") {
			return { ...message, content: preserveIssueText(message.content) };
		}
		return {
			...message,
			content: message.content.map((block) => {
				if (block.type === "text") {
					return { ...block, text: preserveIssueText(block.text) };
				}
				return block;
			}),
		};
	}

	if (message.role === "assistant") {
		return {
			...message,
			content: message.content.map((block) => {
				if (block.type === "text") {
					return { ...block, text: preserveIssueText(block.text) };
				}
				return block;
			}),
		};
	}

	if (message.role === "toolResult") {
		return {
			...message,
			content: message.content.map((block) => {
				if (block.type === "text") {
					return { ...block, text: preserveIssueText(block.text) };
				}
				return block;
			}),
		};
	}

	return message;
}

const DEFAULT_KEEP_RECENT = 3;

export function createIssuePreservingStrategy(keepRecent: number = DEFAULT_KEEP_RECENT): CompressionStrategy {
	return {
		name: "issue-preserving",
		async compress(messages, _context): Promise<CompressionStrategyResult> {
			if (messages.length === 0) {
				return { messages: [], tokensSaved: 0 };
			}

			const splitIndex = Math.max(0, messages.length - keepRecent);
			const oldMessages = messages.slice(0, splitIndex);
			const recentMessages = messages.slice(splitIndex);

			if (oldMessages.length === 0) {
				return { messages, tokensSaved: 0 };
			}

			let tokensBefore = 0;
			let tokensAfter = 0;
			const compressed: Message[] = [];

			for (const msg of oldMessages) {
				tokensBefore += estimateMessageTokens(msg);
				const result = compressMessage(msg);
				tokensAfter += estimateMessageTokens(result);
				compressed.push(result);
			}

			for (const msg of recentMessages) {
				tokensAfter += estimateMessageTokens(msg);
				compressed.push(msg);
			}

			return {
				messages: compressed,
				tokensSaved: Math.max(0, tokensBefore - tokensAfter),
			};
		},
	};
}
