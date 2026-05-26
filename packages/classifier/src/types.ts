import type { Model } from "@earendil-works/pi-ai";

export const CATEGORIES = [
  "coding",
  "architecture",
  "code-review",
  "writing-cn",
  "creative",
  "fast",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface ClassificationResult {
  category: Category | string;
  confidence: number;
  reasoning?: string;
}

export interface ClassifierOptions {
  timeout?: number;
  retries?: number;
}
