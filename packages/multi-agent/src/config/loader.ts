import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Compile } from "typebox/compile";
import { DEFAULT_CONFIG } from "./defaults.ts";
import { AgentConfigSchema, type MultiAgentConfig } from "./schema.ts";

function getConfigDir(): string {
	const home = process.env.HOME || process.env.USERPROFILE || "";
	return join(home, ".pi", "agents");
}

function stripJsonComments(text: string): string {
	let result = text.replace(/\/\/.*$/gm, "");
	result = result.replace(/\/\*[\s\S]*?\*\//g, "");
	result = result.replace(/,(\s*[}\]])/g, "$1");
	return result;
}

export function loadConfig(configDir?: string): MultiAgentConfig {
	const dir = configDir || getConfigDir();

	if (!existsSync(dir)) {
		return DEFAULT_CONFIG;
	}

	try {
		const entries = readdirSync(dir);
		const agents: MultiAgentConfig["agents"] = [];

		for (const entry of entries) {
			const entryPath = join(dir, entry);
			if (!statSync(entryPath).isDirectory()) {
				continue;
			}

			const configPath = join(entryPath, "config.json");
			if (!existsSync(configPath)) {
				continue;
			}

			const raw = readFileSync(configPath, "utf-8");
			const cleaned = stripJsonComments(raw);
			const parsed = JSON.parse(cleaned);

			const C = Compile(AgentConfigSchema);
			if (!C.Check(parsed)) {
				const errors = [...C.Errors(parsed)];
				const messages = errors.map((e: any) => `${e.path}: ${e.message}`).join("\n");
				throw new Error(`Invalid agent config at ${configPath}:\n${messages}`);
			}

			agents.push(parsed);
		}

		if (agents.length === 0) {
			return DEFAULT_CONFIG;
		}

		return { agents };
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new Error(`Invalid JSON in config: ${error.message}`);
		}
		throw error;
	}
}
