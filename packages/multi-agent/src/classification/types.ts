export type Category = string;

export interface ClassificationResult {
	category: Category;
	confidence: number;
	reasoning?: string;
}

export interface ClassifierOptions {
	/** Timeout in ms for the LLM call (default: 10000). */
	timeout?: number;
	/** Categories to classify into. Falls back to ["coding"]. */
	categories?: string[];
}
