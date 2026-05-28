import type { Model } from "@earendil-works/pi-ai";
import { getModel, streamSimple } from "@earendil-works/pi-ai";
import { parseClassificationResponse } from "./parsers.ts";
import { buildClassifierPrompt } from "./prompt-builder.ts";
import type { ClassificationResult, ClassifierOptions } from "./types.ts";

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_CATEGORIES = ["coding"];

export async function classifyTask(
	input: string,
	model?: Model<any>,
	options?: ClassifierOptions,
): Promise<ClassificationResult> {
	const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
	const categories = options?.categories?.length ? options.categories : DEFAULT_CATEGORIES;
	const fallbackCategory = categories[0];
	const classifierModel = model ?? getModel("deepseek", "deepseek-v4-flash");

	const systemPrompt = buildClassifierPrompt(categories);
	const userMessage = `Classify this input:\n\n${input}`;

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const context = {
			systemPrompt,
			messages: [
				{ role: "user" as const, content: [{ type: "text" as const, text: userMessage }], timestamp: Date.now() },
			],
		};

		const stream = streamSimple(classifierModel, context, {
			signal: controller.signal,
			maxTokens: 256,
		});

		let responseText = "";

		for await (const event of stream) {
			if (event.type === "text_delta") {
				responseText += event.delta;
			}
			if (event.type === "done") {
				break;
			}
		}

		return parseClassificationResponse(responseText, fallbackCategory);
	} catch (error) {
		return {
			category: fallbackCategory,
			confidence: 0,
			reasoning: error instanceof Error ? error.message : "Unknown error",
		};
	} finally {
		clearTimeout(timeoutId);
	}
}
