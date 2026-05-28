import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentPool } from "@earendil-works/pi-multi-agent";
import { parseAgentIndex } from "@earendil-works/pi-multi-agent";

export interface ClassificationResult {
	category: string;
	confidence: number;
	reasoning?: string;
}

export interface RoutingResult {
	model: any;
	modelInfo: string;
	agentName?: string;
}

export interface ClassificationRouter {
	readonly isMultiAgent: boolean;
	readonly agentPool: AgentPool | null;
	classifyAndRoute(input: string): Promise<RoutingResult | null>;
}

const AGENTS_INDEX_FILENAME = "agents-index.md";

function getAgentsDir(): string {
	const home = process.env.HOME || process.env.USERPROFILE || "";
	return join(home, ".pi", "agents");
}

function findAgentsIndex(agentsDir?: string): string | null {
	const dir = agentsDir ?? getAgentsDir();
	const indexPath = join(dir, AGENTS_INDEX_FILENAME);
	return existsSync(indexPath) ? indexPath : null;
}

function loadAgentPool(indexPath: string): AgentPool | null {
	try {
		const content = readFileSync(indexPath, "utf-8");
		return parseAgentIndex(content);
	} catch {
		return null;
	}
}

async function classifyAndRouteSingleAgent(_input: string): Promise<RoutingResult | null> {
	return null;
}

async function classifyAndRouteMultiAgent(input: string, pool: AgentPool): Promise<RoutingResult | null> {
	try {
		const { classifyTask } = await import("@earendil-works/pi-multi-agent");
		const { matchAgent } = await import("@earendil-works/pi-multi-agent");
		const { resolveModelWithFallback } = await import("@earendil-works/pi-multi-agent");

		const classification = await classifyTask(input);
		const match = matchAgent(classification.category, pool);

		if (!match) {
			return null;
		}

		const agentConfig = {
			name: match.agent.name,
			model: match.agent.model,
		};

		const resolved = resolveModelWithFallback(agentConfig);

		return {
			model: resolved.model,
			modelInfo: `${resolved.model.provider}/${resolved.model.id}`,
			agentName: match.agent.name,
		};
	} catch {
		return null;
	}
}

export function createClassificationRouter(agentsDir?: string): ClassificationRouter {
	const indexPath = findAgentsIndex(agentsDir);
	let agentPool: AgentPool | null = null;

	if (indexPath) {
		agentPool = loadAgentPool(indexPath);
	}

	const isMultiAgent = agentPool !== null && agentPool.version > 0;

	return {
		isMultiAgent,
		agentPool,

		async classifyAndRoute(input: string): Promise<RoutingResult | null> {
			if (isMultiAgent && agentPool) {
				return classifyAndRouteMultiAgent(input, agentPool);
			}
			return classifyAndRouteSingleAgent(input);
		},
	};
}
