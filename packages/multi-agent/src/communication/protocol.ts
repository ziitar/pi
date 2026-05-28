/**
 * Communication Protocol Types
 *
 * Defines the message interfaces for inter-agent communication.
 * AgentRequest is sent from one agent to another; AgentResponse is the reply.
 */

/** Communication mode for agent requests. */
export type CommunicationMode = "sync" | "async";

/** Status of an agent response. */
export type ResponseStatus = "success" | "error" | "timeout";

/** Artifact produced by an agent during task execution. */
export interface AgentArtifact {
	/** Artifact type identifier (e.g., "file", "code", "data"). */
	type: string;
	/** Artifact content or reference. */
	content: string;
	/** Optional metadata for the artifact. */
	metadata?: Record<string, unknown>;
}

/**
 * Request sent from one agent to another.
 *
 * This is the wire format for inter-agent communication.
 * The `from` field identifies the requesting agent; `task` describes what to do.
 */
export interface AgentRequest {
	/** Session ID of the requesting agent. */
	from: string;
	/** Task description or prompt for the target agent. */
	task: string;
	/** Communication mode: "sync" (wait for response) or "async" (fire-and-forget). */
	mode: CommunicationMode;
	/** Optional step identifier for tracking in multi-step workflows. */
	stepId?: string;
	/** Step IDs that must complete before this request can be processed. */
	dependencies?: string[];
	/** Additional context data for the target agent. */
	context?: Record<string, unknown>;
}

/**
 * Response from an agent after processing a request.
 *
 * Contains the execution result, any produced artifacts, and error information.
 */
export interface AgentResponse {
	/** Session ID of the responding agent. */
	from: string;
	/** Step ID from the original request (for correlation). */
	stepId?: string;
	/** Execution status. */
	status: ResponseStatus;
	/** Result text or data from the agent. */
	result?: string;
	/** Artifacts produced during execution. */
	artifacts?: AgentArtifact[];
	/** Error message if status is "error" or "timeout". */
	error?: string;
}

/** Well-known agent name for the orchestrator. */
export const ORCHESTRATOR_AGENT_NAME = "orchestrator";
