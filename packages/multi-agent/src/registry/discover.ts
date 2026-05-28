import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentConfig, DiscoveredAgent } from "./types.ts";

export function discoverAgents(agentsDir?: string): DiscoveredAgent[] {
	const dir = agentsDir || getDefaultAgentsDir();

	if (!existsSync(dir)) {
		return [];
	}

	const entries = readdirSync(dir, { withFileTypes: true });
	const agents: DiscoveredAgent[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}

		const agentPath = join(dir, entry.name);
		const configPath = join(agentPath, "config.yaml");

		if (!existsSync(configPath)) {
			continue;
		}

		try {
			const content = readFileSync(configPath, "utf-8");
			const config = parseAgentConfig(content, entry.name, agentPath);
			agents.push({
				name: entry.name,
				path: agentPath,
				config,
			});
		} catch {}
	}

	return agents;
}

function getDefaultAgentsDir(): string {
	const home = process.env.HOME || process.env.USERPROFILE || "";
	return join(home, ".pi", "agents");
}

function parseAgentConfig(content: string, defaultName: string, agentPath?: string): AgentConfig {
	const parsed = parseSimpleYaml(content);

	let systemPrompt: string | undefined;
	if (typeof parsed.systemPrompt === "string") {
		systemPrompt = parsed.systemPrompt;
	} else if (agentPath) {
		const systemPath = join(agentPath, "SYSTEM.md");
		if (existsSync(systemPath)) {
			try {
				systemPrompt = readFileSync(systemPath, "utf-8").trim();
			} catch {}
		}
	}

	return {
		name: typeof parsed.name === "string" ? parsed.name : defaultName,
		model: typeof parsed.model === "string" ? parsed.model : "auto",
		categories: Array.isArray(parsed.categories) ? parsed.categories : [],
		systemPrompt,
		settings:
			typeof parsed.settings === "object" && parsed.settings !== null
				? (parsed.settings as Record<string, unknown>)
				: undefined,
	};
}

function parseSimpleYaml(content: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	let currentArray: string | null = null;
	let arrayItems: string[] = [];

	for (const line of content.split("\n")) {
		const trimmed = line.trim();

		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}

		if (trimmed.startsWith("- ") && currentArray) {
			arrayItems.push(
				trimmed
					.slice(2)
					.trim()
					.replace(/^["']|["']$/g, ""),
			);
			continue;
		}

		if (currentArray) {
			result[currentArray] = arrayItems;
			currentArray = null;
			arrayItems = [];
		}

		const colonIndex = trimmed.indexOf(":");
		if (colonIndex === -1) {
			continue;
		}

		const key = trimmed.slice(0, colonIndex).trim();
		const value = trimmed.slice(colonIndex + 1).trim();

		if (value === "") {
			currentArray = key;
			arrayItems = [];
			continue;
		}

		result[key] = parseYamlValue(value);
	}

	if (currentArray) {
		result[currentArray] = arrayItems;
	}

	return result;
}

function parseYamlValue(raw: string): unknown {
	const unquoted = raw.replace(/^["']|["']$/g, "");

	if (unquoted === "true") return true;
	if (unquoted === "false") return false;
	if (unquoted === "null" || unquoted === "~") return null;

	const num = Number(unquoted);
	if (!Number.isNaN(num) && unquoted !== "") return num;

	return unquoted;
}
