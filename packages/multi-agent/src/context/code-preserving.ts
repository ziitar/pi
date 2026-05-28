import type { Message } from "@earendil-works/pi-ai";
import { estimateMessageTokens } from "./calculator.ts";
import type { CompressionStrategy, CompressionStrategyResult } from "./strategy.ts";

const CODE_BLOCK_PATTERN = /^```[\s\S]*?^```/gm;
const INLINE_CODE_PATTERN = /`[^`\n]+`/g;

function extractCodeBlocks(text: string): string[] {
	const blocks: string[] = [];
	for (const match of text.matchAll(CODE_BLOCK_PATTERN)) {
		blocks.push(match[0]);
	}
	return blocks;
}

function summarizeProse(text: string): string {
	const withoutCode = text.replace(CODE_BLOCK_PATTERN, "").replace(INLINE_CODE_PATTERN, "`…`");
	const lines = withoutCode.split("\n").filter((l) => l.trim().length > 0);
	if (lines.length <= 2) return text;
	return `${lines.slice(0, 2).join("\n")}\n…`;
}

function compressTextContent(text: string): string {
	const codeBlocks = extractCodeBlocks(text);
	if (codeBlocks.length === 0) {
		return summarizeProse(text);
	}
	const summarized = summarizeProse(text);
	return `${summarized}\n\n${codeBlocks.join("\n\n")}`;
}

function compressMessage(message: Message): Message {
	if (message.role === "user") {
		if (typeof message.content === "string") {
			return { ...message, content: compressTextContent(message.content) };
		}
		return {
			...message,
			content: message.content.map((block) => {
				if (block.type === "text") {
					return { ...block, text: compressTextContent(block.text) };
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
					return { ...block, text: compressTextContent(block.text) };
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
					return { ...block, text: compressTextContent(block.text) };
				}
				return block;
			}),
		};
	}

	return message;
}

const DEFAULT_KEEP_RECENT = 3;

export function createCodePreservingStrategy(keepRecent: number = DEFAULT_KEEP_RECENT): CompressionStrategy {
	return {
		name: "code-preserving",
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
