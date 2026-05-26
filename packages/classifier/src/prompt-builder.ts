import { CATEGORIES } from "./types.ts";

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  coding: "Writing, fixing, or explaining code. Programming tasks, implementing features, debugging.",
  architecture: "System design, architecture decisions, high-level planning, design patterns.",
  "code-review": "Reviewing, analyzing, or critiquing existing code. Finding bugs, suggesting improvements.",
  "writing-cn": "Chinese content creation, writing articles, stories, or documents in Chinese.",
  creative: "Creative writing, brainstorming, ideas, stories, poems, artistic content.",
  fast: "Simple questions, quick lookups, trivia, factual answers, translations.",
};

export function buildClassifierPrompt(): string {
  const categoryList = CATEGORIES.map((cat) => {
    const desc = CATEGORY_DESCRIPTIONS[cat] || cat;
    return `- ${cat}: ${desc}`;
  }).join("\n");

  return `You are a task classifier. Your job is to analyze user input and classify it into exactly one category.

## Categories

${categoryList}

## Rules

1. Respond with ONLY a JSON object, no other text
2. The JSON must have exactly two fields: "category" (string) and "confidence" (number 0-1)
3. Choose the SINGLE most appropriate category
4. Confidence should reflect how certain you are (0.5 = guessing, 0.9 = very confident)
5. If the input is ambiguous, choose the most likely category and lower confidence

## Examples

Input: "Write a React component for a login form"
Output: {"category": "coding", "confidence": 0.9}

Input: "帮我写一篇关于人工智能的文章"
Output: {"category": "writing-cn", "confidence": 0.95}

Input: "Review this code for security issues"
Output: {"category": "code-review", "confidence": 0.85}

Input: "Design a microservice architecture for an e-commerce platform"
Output: {"category": "architecture", "confidence": 0.9}

Input: "Write a poem about the ocean"
Output: {"category": "creative", "confidence": 0.95}

Input: "What is the capital of France?"
Output: {"category": "fast", "confidence": 0.99}

## Output Format

Respond with ONLY this JSON format:
{"category": "<category>", "confidence": <number>}`;
}
