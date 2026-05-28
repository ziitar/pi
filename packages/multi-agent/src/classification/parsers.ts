import type { ClassificationResult } from "./types.ts";

export function parseClassificationResponse(text: string, fallbackCategory = "coding"): ClassificationResult {
	const fallback: ClassificationResult = {
		category: fallbackCategory,
		confidence: 0,
	};

	if (!text || text.trim().length === 0) {
		return fallback;
	}

	try {
		let jsonStr = text.trim();

		const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (fenceMatch) {
			jsonStr = fenceMatch[1].trim();
		}

		const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return fallback;
		}

		const parsed = JSON.parse(jsonMatch[0]);

		const category = parsed.category;
		if (typeof category !== "string") {
			return fallback;
		}

		let confidence = parsed.confidence;
		if (typeof confidence !== "number") {
			confidence = 0;
		}
		confidence = Math.max(0, Math.min(1, confidence));

		return {
			category,
			confidence,
			reasoning: parsed.reasoning,
		};
	} catch {
		return fallback;
	}
}
