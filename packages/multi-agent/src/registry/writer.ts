import type { AgentPool } from "./types.ts";

export function writeAgentIndex(pool: AgentPool): string {
	const lines: string[] = [];

	lines.push("# Agent Pool");
	lines.push(`version: ${pool.version}`);
	lines.push("");
	lines.push("| Agent | Categories | Model | Status |");
	lines.push("|-------|-----------|-------|--------|");

	for (const agent of pool.agents) {
		const categories = agent.categories.join(", ");
		lines.push(`| ${agent.name} | ${categories} | ${agent.model} | ${agent.status} |`);
	}

	lines.push("");
	return lines.join("\n");
}
