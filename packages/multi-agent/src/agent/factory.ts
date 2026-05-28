import type { AgentMessage, AgentState } from "@earendil-works/pi-agent-core";
import { Agent } from "@earendil-works/pi-agent-core";
import type { ImageContent } from "@earendil-works/pi-ai";

import type { AgentConfig, AgentSessionFactory, AgentSessionHandle, AgentSessionOptions } from "../types.ts";

/**
 * Default implementation of `AgentSessionFactory`.
 *
 * Each call to `createSession()` creates a new, independent `Agent` instance
 * with its own state, transcript, and lifecycle. Sessions are fully isolated
 * from each other.
 */
export class DefaultAgentSessionFactory implements AgentSessionFactory {
	async createSession(config: AgentConfig, _options?: AgentSessionOptions): Promise<AgentSessionHandle> {
		const sessionId = config.sessionId ?? crypto.randomUUID();

		const agent = new Agent({
			initialState: {
				systemPrompt: config.systemPrompt ?? "",
				model: config.model,
				thinkingLevel: config.thinkingLevel,
				tools: config.tools,
				messages: config.messages,
			},
			convertToLlm: config.convertToLlm,
			transformContext: config.transformContext,
			streamFn: config.streamFn,
			getApiKey: config.getApiKey,
			beforeToolCall: config.beforeToolCall,
			afterToolCall: config.afterToolCall,
			steeringMode: config.steeringMode,
			followUpMode: config.followUpMode,
			sessionId,
			thinkingBudgets: config.thinkingBudgets,
			transport: config.transport,
			maxRetryDelayMs: config.maxRetryDelayMs,
			toolExecution: config.toolExecution,
		});

		const handle: AgentSessionHandle = {
			prompt: (input: string | AgentMessage | AgentMessage[], images?: ImageContent[]) =>
				agent.prompt(input as any, images),
			abort: () => agent.abort(),
			getState: (): AgentState => agent.state,
			getSessionId: (): string => sessionId,
			subscribe: (listener) => agent.subscribe(listener),
			waitForIdle: (): Promise<void> => agent.waitForIdle(),
		};

		return handle;
	}
}
