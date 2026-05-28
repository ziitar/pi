import type { Message } from "@earendil-works/pi-ai";
import type { CompressionContext } from "./types.ts";

// ── CompressionStrategy ──────────────────────────────────────

/** Result returned by a compression strategy. */
export interface CompressionStrategyResult {
	/** The compressed/restructured message list. */
	messages: Message[];
	/** Estimated tokens saved by the compression. */
	tokensSaved: number;
	/** Summary text generated during compression, if any. */
	summary?: string;
}

/** A strategy for compressing context messages. */
export interface CompressionStrategy {
	/** Unique identifier for this strategy. */
	readonly name: string;
	/** Compress messages using this strategy. */
	compress(messages: Message[], context: CompressionContext): Promise<CompressionStrategyResult>;
}

// ── Strategy Registry ────────────────────────────────────────

const strategyRegistry = new Map<string, CompressionStrategy>();

/** Register a compression strategy. Throws if the name is already registered. */
export function registerStrategy(strategy: CompressionStrategy): void {
	if (strategyRegistry.has(strategy.name)) {
		throw new Error(`Compression strategy "${strategy.name}" is already registered`);
	}
	strategyRegistry.set(strategy.name, strategy);
}

/** Unregister a compression strategy by name. Returns true if it existed. */
export function unregisterStrategy(name: string): boolean {
	return strategyRegistry.delete(name);
}

/** Get a registered strategy by name, or undefined if not found. */
export function getStrategy(name: string): CompressionStrategy | undefined {
	return strategyRegistry.get(name);
}

/** Get all registered strategy names. */
export function getStrategyNames(): string[] {
	return [...strategyRegistry.keys()];
}

/** Clear all registered strategies. Primarily for testing. */
export function clearStrategies(): void {
	strategyRegistry.clear();
}
