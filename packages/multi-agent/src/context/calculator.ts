import type { Message } from "@earendil-works/pi-ai";

const CHARS_PER_TOKEN = 4;

function safeJsonStringify(value: unknown): string {
	try {
		return JSON.stringify(value) ?? "undefined";
	} catch {
		return "[unserializable]";
	}
}

export function estimateTokens(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateMessageTokens(message: Message): number {
	let chars = 0;

	switch (message.role) {
		case "user": {
			const content = message.content;
			if (typeof content === "string") {
				chars = content.length;
			} else if (Array.isArray(content)) {
				for (const block of content) {
					if (block.type === "text" && block.text) {
						chars += block.text.length;
					}
				}
			}
			return Math.ceil(chars / CHARS_PER_TOKEN);
		}
		case "assistant": {
			for (const block of message.content) {
				if (block.type === "text") {
					chars += block.text.length;
				} else if (block.type === "thinking") {
					chars += block.thinking.length;
				} else if (block.type === "toolCall") {
					chars += block.name.length + safeJsonStringify(block.arguments).length;
				}
			}
			return Math.ceil(chars / CHARS_PER_TOKEN);
		}
		case "toolResult": {
			const content = (message as { role: "toolResult"; content: string | Array<{ type: string; text?: string }> })
				.content;
			if (typeof content === "string") {
				chars = content.length;
			} else if (Array.isArray(content)) {
				for (const block of content) {
					if (block.type === "text" && block.text) {
						chars += block.text.length;
					}
				}
			}
			return Math.ceil(chars / CHARS_PER_TOKEN);
		}
	}

	return 0;
}

export function estimateContextTokens(messages: Message[]): number {
	let total = 0;
	for (const message of messages) {
		total += estimateMessageTokens(message);
	}
	return total;
}
