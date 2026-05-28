import type { Model } from "@earendil-works/pi-ai";
import type { CompressionResult, ContextLimitConfig } from "./types.ts";
import { COMPRESSION_THRESHOLD, DEFAULT_CONTEXT_LIMIT_CONFIG } from "./types.ts";

function resolveContextLimit(config: ContextLimitConfig, model?: Model<any>): number {
	if (typeof config.limit === "number") {
		return config.limit;
	}
	if (model?.contextWindow) {
		return model.contextWindow;
	}
	throw new Error("Cannot resolve context limit: no explicit limit and no model.contextWindow available");
}

export function shouldCompress(
	currentTokens: number,
	config: ContextLimitConfig = DEFAULT_CONTEXT_LIMIT_CONFIG,
	model?: Model<any>,
	threshold: number = COMPRESSION_THRESHOLD,
): CompressionResult {
	const contextLimit = resolveContextLimit(config, model);
	const utilizationRatio = contextLimit > 0 ? currentTokens / contextLimit : 0;

	return {
		shouldCompress: utilizationRatio >= threshold,
		currentTokens,
		contextLimit,
		utilizationRatio,
		threshold,
	};
}
