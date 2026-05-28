import type { Model } from "@earendil-works/pi-ai";

// ── CompressionContext ────────────────────────────────────────

/** Context provided to compression operations. */
export interface CompressionContext {
	/** Current token count in the context window. */
	currentTokens: number;

	/** Maximum context window size in tokens. */
	contextLimit: number;

	/** Model being used (for contextWindow reference). */
	model?: Model<any>;

	/** Agent-defined context limit override. When set, takes precedence over model.contextWindow. */
	contextLimitOverride?: number;

	/** Messages in the current context. */
	messages: unknown[];
}

// ── CompressionResult ─────────────────────────────────────────

/** Result of a compression check or operation. */
export interface CompressionResult {
	/** Whether compression is needed. */
	shouldCompress: boolean;

	/** Current token count. */
	currentTokens: number;

	/** The context limit being used. */
	contextLimit: number;

	/** Ratio of currentTokens to contextLimit (0.0–1.0+). */
	utilizationRatio: number;

	/** Threshold ratio that triggers compression (default: 0.8). */
	threshold: number;
}

// ── ContextLimitConfig ────────────────────────────────────────

/** Configuration for how the context limit is resolved. */
export interface ContextLimitConfig {
	/**
	 * Context limit in tokens.
	 * - "auto": resolve from model.contextWindow
	 * - number: explicit token count override
	 */
	limit: "auto" | number;
}

/** Default threshold ratio that triggers compression (80%). */
export const COMPRESSION_THRESHOLD = 0.8;

/** Default context limit configuration. */
export const DEFAULT_CONTEXT_LIMIT_CONFIG: ContextLimitConfig = {
	limit: "auto",
};
