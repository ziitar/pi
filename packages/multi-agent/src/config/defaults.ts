import type { MultiAgentConfig } from "./schema.ts";

export const DEFAULT_CONFIG: MultiAgentConfig = {
	agents: [
		{
			name: "default",
			model: "auto",
			systemPrompt: "You are a helpful assistant.",
		},
	],
	maxConcurrency: 3,
	defaultTimeout: 30000,
	classifierModel: "auto",
};
