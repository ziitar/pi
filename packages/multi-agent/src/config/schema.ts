import type { ThinkingLevel } from "@earendil-works/pi-ai";
import { type Static, Type } from "typebox";

export const ThinkingLevelSchema = Type.Union([
	Type.Literal("off"),
	Type.Literal("minimal"),
	Type.Literal("low"),
	Type.Literal("medium"),
	Type.Literal("high"),
	Type.Literal("xhigh"),
]);

export const CompressionStrategySchema = Type.Union([
	Type.Literal("none"),
	Type.Literal("summary"),
	Type.Literal("truncate"),
]);

export const AgentConfigSchema = Type.Object({
	name: Type.String({ minLength: 1 }),
	model: Type.String({ minLength: 1 }),
	thinkingLevel: Type.Optional(ThinkingLevelSchema),
	tools: Type.Optional(Type.Array(Type.String())),
	categories: Type.Optional(Type.Array(Type.String())),
	systemPrompt: Type.Optional(Type.String()),
	contextLimit: Type.Optional(Type.Number({ minimum: 1, default: 128000 })),
	compressionStrategy: Type.Optional(CompressionStrategySchema),
	workspace: Type.Optional(Type.String()),
});

export const MultiAgentConfigSchema = Type.Object({
	agents: Type.Array(AgentConfigSchema, { minItems: 1 }),
	maxConcurrency: Type.Optional(Type.Number({ minimum: 1, maximum: 10, default: 3 })),
	defaultTimeout: Type.Optional(Type.Number({ minimum: 1, maximum: 600000, default: 30000 })),
	classifierModel: Type.Optional(Type.String({ minLength: 1 })),
});

export type AgentConfig = Static<typeof AgentConfigSchema>;
export type MultiAgentConfig = Static<typeof MultiAgentConfigSchema>;
export type { ThinkingLevel };
