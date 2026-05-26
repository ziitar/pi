import { CATEGORIES, type ClassificationResult } from "./types.ts";

const FALLBACK_RESULT: ClassificationResult = {
  category: "coding",
  confidence: 0,
};

export function parseClassificationResponse(text: string): ClassificationResult {
  if (!text || text.trim().length === 0) {
    return FALLBACK_RESULT;
  }

  try {
    // Try to extract JSON from the response
    let jsonStr = text.trim();

    // Remove markdown code fences if present
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    // Find first { ... } in the string
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return FALLBACK_RESULT;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate category
    const category = parsed.category;
    if (typeof category !== "string") {
      return FALLBACK_RESULT;
    }

    // Validate confidence
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
    return FALLBACK_RESULT;
  }
}
