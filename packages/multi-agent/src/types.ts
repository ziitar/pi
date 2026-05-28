import type {
	AfterToolCallContext,
	AfterToolCallResult,
	AgentEvent,
	AgentMessage,
	AgentState,
	AgentTool,
	BeforeToolCallContext,
	BeforeToolCallResult,
	QueueMode,
	StreamFn,
} from "@earendil-works/pi-agent-core";
import type { ImageContent, Model, ThinkingBudgets, ThinkingLevel, Transport } from "@earendil-works/pi-ai";

// ── Re-exports ──────────────────────────────────────────────
export type { ThinkingLevel, AgentMessage, Model };

// ── AgentConfig ─────────────────────────────────────────────
/** Configuration passed to `AgentSessionFactory.createSession()`. */
export interface AgentConfig {
	systemPrompt?: string;
	model: Model<any>;
	thinkingLevel?: ThinkingLevel;
	tools?: AgentTool<any>[];
	messages?: AgentMessage[];

	/** Unique session identifier (auto-generated if not provided). */
	sessionId?: string;

	/** Custom stream function for proxy backends. */
	streamFn?: StreamFn;

	/** Message conversion from AgentMessage to LLM Message. */
	convertToLlm?: (messages: AgentMessage[]) => import("@earendil-works/pi-ai").Message[];

	/** Context transform before convertToLlm. */
	transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;

	/** Dynamic API key resolution (e.g. for expiring OAuth tokens). */
	getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;

	/** Steering and follow-up queue modes. */
	steeringMode?: QueueMode;
	followUpMode?: QueueMode;

	/** Per-level thinking token budgets. */
	thinkingBudgets?: ThinkingBudgets;

	/** Preferred provider transport. */
	transport?: Transport;

	/** Optional cap for provider-requested retry delays. */
	maxRetryDelayMs?: number;

	/** Tool execution strategy for assistant messages with multiple tool calls. */
	toolExecution?: import("@earendil-works/pi-agent-core").ToolExecutionMode;

	/** Called before a tool is executed. Return `{ block: true }` to prevent execution. */
	beforeToolCall?: (context: BeforeToolCallContext, signal?: AbortSignal) => Promise<BeforeToolCallResult | undefined>;

	/** Called after a tool finishes, before tool-result events are emitted. */
	afterToolCall?: (context: AfterToolCallContext, signal?: AbortSignal) => Promise<AfterToolCallResult | undefined>;
}

// ── AgentSessionOptions ─────────────────────────────────────
/** Session-level options for `AgentSessionFactory.createSession()`. */
export interface AgentSessionOptions {
	/** Working directory for the session. */
	cwd?: string;
	/** Timeout for operations in milliseconds. */
	timeout?: number;
	/** Abort signal to cancel the session. */
	abortSignal?: AbortSignal;
	/** Context fragments to inject into the system prompt. */
	contextFragments?: string[];
}

// ── AgentSessionHandle ──────────────────────────────────────
/** Handle to an active agent session with lifecycle control. */
export interface AgentSessionHandle {
	/** Send a text prompt to the agent. */
	prompt(input: string, images?: ImageContent[]): Promise<void>;
	/** Send a pre-built message or batch to the agent. */
	prompt(message: AgentMessage | AgentMessage[]): Promise<void>;

	/** Abort the current operation. */
	abort(): void;

	/** Get the current agent state. */
	getState(): AgentState;

	/** Get the unique session identifier. */
	getSessionId(): string;

	/** Subscribe to agent lifecycle events. Returns an unsubscribe function. */
	subscribe(listener: (event: AgentEvent, signal: AbortSignal) => Promise<void> | void): () => void;

	/** Wait for the current run to complete. */
	waitForIdle(): Promise<void>;
}

// ── AgentSessionFactory ─────────────────────────────────────
/** Factory that creates independent agent sessions. */
export interface AgentSessionFactory {
	createSession(config: AgentConfig, options?: AgentSessionOptions): Promise<AgentSessionHandle>;
}
