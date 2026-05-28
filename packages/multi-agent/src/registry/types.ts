/**
 * Agent Registry Types
 *
 * Types for the agents-index.md registry system.
 */

/** Status of an agent in the registry */
export type AgentStatus = "active" | "inactive" | "error";

/** A single agent entry in the registry */
export interface AgentRegistryEntry {
	/** Unique agent name (matches directory name in ~/.pi/agents/) */
	name: string;
	/** Task categories this agent handles */
	categories: string[];
	/** Model identifier (provider/modelId or "auto") */
	model: string;
	/** Current agent status */
	status: AgentStatus;
}

/** The full agent pool parsed from agents-index.md */
export interface AgentPool {
	/** Registry format version */
	version: number;
	/** All registered agents */
	agents: AgentRegistryEntry[];
}

/** Version marker for registry format compatibility */
export interface RegistryVersion {
	/** Version number (currently 1) */
	version: number;
}

/** Parsed config.yaml for a single agent */
export interface AgentConfig {
	/** Agent name */
	name: string;
	/** Model binding (provider/modelId or "auto") */
	model: string;
	/** Task categories */
	categories: string[];
	/** Path to system prompt file */
	systemPrompt?: string;
	/** Additional agent-specific settings */
	settings?: Record<string, unknown>;
}

/** Result of agent discovery from filesystem */
export interface DiscoveredAgent {
	/** Agent name (directory name) */
	name: string;
	/** Path to agent directory */
	path: string;
	/** Parsed config */
	config: AgentConfig;
}

/** Match result with relevance scoring */
export interface AgentMatch {
	/** Matched agent entry */
	agent: AgentRegistryEntry;
	/** Relevance score (0-1, higher is better) */
	score: number;
}
