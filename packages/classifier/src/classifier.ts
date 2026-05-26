import { getModel } from "@earendil-works/pi-ai";
import type { Model } from "@earendil-works/pi-ai";
import { buildClassifierPrompt } from "./prompt-builder.ts";
import { parseClassificationResponse } from "./parsers.ts";
import type { ClassificationResult, ClassifierOptions } from "./types.ts";

const DEFAULT_TIMEOUT = 10000; // 10 seconds

/**
 * Classify a user input into a task category using an LLM.
 *
 * @param input - The user's text input to classify
 * @param model - The model to use for classification (defaults to deepseek-chat)
 * @param options - Optional configuration (timeout, retries)
 * @returns ClassificationResult with category and confidence
 */
export async function classifyTask(
  input: string,
  model?: Model<any>,
  options?: ClassifierOptions,
): Promise<ClassificationResult> {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
  const classifierModel = model ?? getModel("deepseek", "deepseek-v4-flash");

  const systemPrompt = buildClassifierPrompt();
  const userMessage = `Classify this input:\n\n${input}`;

  // Create a simple completion request
  // We use a minimal agent-like approach: just send the prompt and get the response
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // Import the stream function dynamically to avoid circular deps
    const { streamSimple } = await import("@earendil-works/pi-ai");

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

    // Collect the streamed response
    for await (const event of stream) {
      if (event.type === "text_delta") {
        responseText += event.delta;
      }
      if (event.type === "done") {
        break;
      }
    }

    return parseClassificationResponse(responseText);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        category: "coding",
        confidence: 0,
        reasoning: "Classification timed out",
      };
    }
    // On any error, return fallback
    return {
      category: "coding",
      confidence: 0,
      reasoning: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
