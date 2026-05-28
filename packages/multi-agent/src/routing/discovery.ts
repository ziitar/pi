import type { AgentConfig } from "../config/schema.ts";
import { matchAgent, matchAllAgents } from "../registry/match.ts";
import type { AgentPool, AgentRegistryEntry } from "../registry/types.ts";
import { resolveModelWithFallback } from "./router.ts";
import type { RoutingResult } from "./types.ts";
import { AgentDiscoveryError } from "./types.ts";

export interface ClassificationResult {
	category: string;
	confidence: number;
}

export function discoverAgentForTask(classification: ClassificationResult, pool: AgentPool): AgentRegistryEntry {
	const match = matchAgent(classification.category, pool);

	if (!match) {
		throw new AgentDiscoveryError(
			`No active agent found for category "${classification.category}". Available agents: ${pool.agents.map((a) => a.name).join(", ")}`,
			classification.category,
		);
	}

	return match.agent;
}

export function discoverAgentsForTask(
	classification: ClassificationResult,
	pool: AgentPool,
	limit?: number,
): AgentRegistryEntry[] {
	const matches = matchAllAgents(classification.category, pool);

	if (matches.length === 0) {
		return [];
	}

	const agents = matches.map((m) => m.agent);
	return limit ? agents.slice(0, limit) : agents;
}

export function routeTask(
	classification: ClassificationResult,
	pool: AgentPool,
	fallbackModels: string[] = [],
): RoutingResult {
	const match = matchAgent(classification.category, pool);

	if (!match) {
		throw new AgentDiscoveryError(
			`No active agent found for category "${classification.category}"`,
			classification.category,
		);
	}

	const agentConfig: AgentConfig = {
		name: match.agent.name,
		model: match.agent.model,
	};

	const resolved = resolveModelWithFallback(agentConfig, fallbackModels);

	return {
		agent: match.agent,
		resolved,
		score: match.score,
		matchedCategory: classification.category,
	};
}
