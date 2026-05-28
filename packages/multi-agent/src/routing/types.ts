import type { Api, Model, ThinkingLevel } from "@earendil-works/pi-ai";
import type { AgentRegistryEntry } from "../registry/types.ts";

// ── Model Resolution ─────────────────────────────────────────

/** A resolved model with optional thinking level and temperature overrides. */
export interface ResolvedModel {
	model: Model<Api>;
	thinkingLevel?: ThinkingLevel;
	temperature?: number;
}

/** Model specification in "provider/modelId" format or "auto". */
export interface ModelSpec {
	provider: string;
	modelId: string;
}

// ── Routing ──────────────────────────────────────────────────

/** Result of routing a task to an agent with a resolved model. */
export interface RoutingResult {
	/** The matched agent from the registry. */
	agent: AgentRegistryEntry;
	/** The resolved model for this agent. */
	resolved: ResolvedModel;
	/** Match confidence score (0-1). */
	score: number;
	/** Category that was matched. */
	matchedCategory: string;
}

// ── Errors ───────────────────────────────────────────────────

/** Error thrown when model resolution fails. */
export class ModelResolutionError extends Error {
	provider?: string;
	modelId?: string;

	constructor(message: string, provider?: string, modelId?: string) {
		super(message);
		this.name = "ModelResolutionError";
		this.provider = provider;
		this.modelId = modelId;
	}
}

/** Error thrown when no agent matches the task. */
export class AgentDiscoveryError extends Error {
	category: string;

	constructor(message: string, category: string) {
		super(message);
		this.name = "AgentDiscoveryError";
		this.category = category;
	}
}
