import type { AgentMatch, AgentPool, AgentRegistryEntry } from "./types.ts";

export function matchAgent(taskCategory: string, pool: AgentPool): AgentMatch | null {
	const activeAgents = pool.agents.filter((a) => a.status === "active");

	if (activeAgents.length === 0) {
		return null;
	}

	const matches = activeAgents
		.map((agent) => ({ agent, score: calculateScore(taskCategory, agent) }))
		.filter((m) => m.score > 0)
		.sort((a, b) => b.score - a.score);

	return matches[0] ?? null;
}

export function matchAllAgents(taskCategory: string, pool: AgentPool): AgentMatch[] {
	const activeAgents = pool.agents.filter((a) => a.status === "active");

	return activeAgents
		.map((agent) => ({ agent, score: calculateScore(taskCategory, agent) }))
		.filter((m) => m.score > 0)
		.sort((a, b) => b.score - a.score);
}

function calculateScore(taskCategory: string, agent: AgentRegistryEntry): number {
	const normalizedTask = taskCategory.toLowerCase().trim();

	const categories = agent.categories.map((c) => c.toLowerCase().trim());

	if (categories.length === 0) {
		return 0;
	}

	const exactIndex = categories.indexOf(normalizedTask);
	if (exactIndex !== -1) {
		return 1.0 - exactIndex * 0.01;
	}

	for (let i = 0; i < categories.length; i++) {
		const cat = categories[i];
		if (cat.includes(normalizedTask) || normalizedTask.includes(cat)) {
			return 0.7 - i * 0.01;
		}
	}

	return 0;
}
