import type { AgentPool, AgentRegistryEntry, AgentStatus } from "./types.ts";

const VERSION_PATTERN = /^version:\s*(\d+)\s*$/;
const TABLE_SEPARATOR = /^\|[-:|\s]+\|$/;

export function parseAgentIndex(content: string): AgentPool | null {
	const lines = content.split("\n");

	const version = extractVersion(lines);
	if (version === null) {
		return null;
	}

	const agents = extractAgents(lines);

	return { version, agents };
}

function extractVersion(lines: string[]): number | null {
	for (const line of lines) {
		const match = line.trim().match(VERSION_PATTERN);
		if (match) {
			return parseInt(match[1], 10);
		}
	}
	return null;
}

function extractAgents(lines: string[]): AgentRegistryEntry[] {
	const agents: AgentRegistryEntry[] = [];
	let inTable = false;
	let headerParsed = false;

	for (const line of lines) {
		const trimmed = line.trim();

		if (!trimmed.startsWith("|")) {
			if (inTable && headerParsed) {
				break;
			}
			continue;
		}

		if (!inTable) {
			inTable = true;
			continue;
		}

		if (!headerParsed && TABLE_SEPARATOR.test(trimmed)) {
			headerParsed = true;
			continue;
		}

		if (!headerParsed) {
			continue;
		}

		const entry = parseTableRow(trimmed);
		if (entry) {
			agents.push(entry);
		}
	}

	return agents;
}

function parseTableRow(line: string): AgentRegistryEntry | null {
	const cells = line
		.split("|")
		.map((c) => c.trim())
		.filter((c) => c !== "");

	if (cells.length < 4) {
		return null;
	}

	const [name, categoriesStr, model, statusStr] = cells;
	const categories = categoriesStr
		.split(",")
		.map((c) => c.trim())
		.filter(Boolean);
	const status = parseStatus(statusStr);

	return { name, categories, model, status };
}

function parseStatus(raw: string): AgentStatus {
	const normalized = raw.toLowerCase().trim();
	if (normalized === "active" || normalized === "inactive" || normalized === "error") {
		return normalized;
	}
	return "active";
}
