import type { Api, Model, ThinkingLevel } from "@earendil-works/pi-ai";
import { getModel } from "@earendil-works/pi-ai";
import type { AgentConfig } from "../config/schema.ts";
import type { ModelSpec, ResolvedModel } from "./types.ts";
import { ModelResolutionError } from "./types.ts";

export function parseModelSpec(modelString: string): ModelSpec {
	const trimmed = modelString.trim();

	if (trimmed === "auto" || trimmed === "") {
		return { provider: "deepseek", modelId: "deepseek-v4-flash" };
	}

	const slashIndex = trimmed.indexOf("/");
	if (slashIndex === -1) {
		throw new ModelResolutionError(`Invalid model format: "${trimmed}". Expected "provider/modelId" or "auto".`);
	}

	return {
		provider: trimmed.slice(0, slashIndex),
		modelId: trimmed.slice(slashIndex + 1),
	};
}

export function resolveSingleModel(spec: ModelSpec): Model<Api> {
	try {
		return getModel(spec.provider as any, spec.modelId as any);
	} catch {
		throw new ModelResolutionError(
			`Failed to resolve model: ${spec.provider}/${spec.modelId}`,
			spec.provider,
			spec.modelId,
		);
	}
}

export function resolveModel(agentConfig: AgentConfig): ResolvedModel {
	const spec = parseModelSpec(agentConfig.model);
	const model = resolveSingleModel(spec);

	return {
		model,
		thinkingLevel: agentConfig.thinkingLevel as ThinkingLevel | undefined,
	};
}

export function resolveModelWithFallback(agentConfig: AgentConfig, fallbackModels: string[] = []): ResolvedModel {
	try {
		return resolveModel(agentConfig);
	} catch {
		for (const fallback of fallbackModels) {
			try {
				const spec = parseModelSpec(fallback);
				const model = resolveSingleModel(spec);
				return { model };
			} catch {
				// continue to next fallback
			}
		}

		const spec = parseModelSpec(agentConfig.model);
		throw new ModelResolutionError(
			`All models failed for agent "${agentConfig.name}". Primary: ${spec.provider}/${spec.modelId}`,
			spec.provider,
			spec.modelId,
		);
	}
}
