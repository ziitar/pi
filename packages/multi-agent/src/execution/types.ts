import type { AgentMessage } from "../types.ts";

/** Status of an agent execution. */
export type ExecutionStatus = "completed" | "partial" | "failed";

/** Result returned after executing an agent. */
export interface AgentResult {
	/** Name of the agent that was executed. */
	agentName: string;
	/** Category/classification of the agent. */
	category: string;
	/** Model identifier used for the execution. */
	model: string;
	/** Messages produced during the execution. */
	messages: AgentMessage[];
	/** Final status of the execution. */
	status: ExecutionStatus;
	/** Duration of the execution in milliseconds. */
	duration: number;
	/** Error message if the execution failed or was partial. */
	error?: string;
}

/** Options for executing an agent. */
export interface ExecutionOptions {
	/** Timeout in milliseconds. Defaults to 120000 (2 minutes). */
	timeoutMs?: number;
	/** Abort signal to cancel the execution externally. */
	abortSignal?: AbortSignal;
	/** Working directory for the agent session. */
	cwd?: string;
	/** System prompt override for this execution. */
	systemPrompt?: string;
}
