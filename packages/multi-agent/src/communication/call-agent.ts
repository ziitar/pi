import type { AgentInstanceManager } from "../agent/manager.ts";
import type { AgentConfig, AgentSessionFactory } from "../types.ts";
import type { AgentRequest, AgentResponse } from "./protocol.ts";
import { ORCHESTRATOR_AGENT_NAME } from "./protocol.ts";

export interface CallAgentOptions {
	manager: AgentInstanceManager;
	factory: AgentSessionFactory;
	config: AgentConfig;
	request: AgentRequest;
	timeoutMs?: number;
}

export async function callAgent(options: CallAgentOptions): Promise<AgentResponse> {
	const { manager, factory, config, request, timeoutMs } = options;

	if (config.sessionId === ORCHESTRATOR_AGENT_NAME) {
		return {
			from: ORCHESTRATOR_AGENT_NAME,
			stepId: request.stepId,
			status: "error",
			error: "Cannot call the orchestrator agent directly",
		};
	}

	let sessionId: string | undefined;
	try {
		const handle = await manager.createInstance(config, factory, { timeoutMs });
		sessionId = handle.getSessionId();

		await handle.prompt(request.task);
		await handle.waitForIdle();

		const state = handle.getState();
		const lastAssistant = [...state.messages].reverse().find((m) => m.role === "assistant");

		const resultText =
			lastAssistant && "content" in lastAssistant
				? lastAssistant.content
						.filter((c: any) => c.type === "text")
						.map((c: any) => c.text)
						.join("")
				: undefined;

		return {
			from: sessionId,
			stepId: request.stepId,
			status: state.errorMessage ? "error" : "success",
			result: resultText,
			error: state.errorMessage,
		};
	} catch (err) {
		return {
			from: sessionId ?? config.sessionId ?? "unknown",
			stepId: request.stepId,
			status: "error",
			error: err instanceof Error ? err.message : String(err),
		};
	} finally {
		if (sessionId) {
			await manager.disposeInstance(sessionId).catch(() => {});
		}
	}
}
