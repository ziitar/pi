import type { AgentInstanceManager } from "../agent/manager.ts";
import type { AgentConfig, AgentSessionFactory } from "../types.ts";
import type { CompletionTracker } from "./completion-tracker.ts";
import type { AsyncCallNotifier } from "./notification.ts";
import type { AgentRequest, AgentResponse } from "./protocol.ts";
import { ORCHESTRATOR_AGENT_NAME } from "./protocol.ts";

export interface CallAgentAsyncOptions {
	manager: AgentInstanceManager;
	factory: AgentSessionFactory;
	config: AgentConfig;
	request: AgentRequest;
	tracker: CompletionTracker;
	notifier: AsyncCallNotifier;
	timeoutMs?: number;
}

export function callAgentAsync(options: CallAgentAsyncOptions): string {
	const { manager, factory, config, request, tracker, notifier, timeoutMs } = options;

	if (config.sessionId === ORCHESTRATOR_AGENT_NAME) {
		throw new Error("Cannot call the orchestrator agent directly");
	}

	const stepId = request.stepId ?? crypto.randomUUID();

	void executeAsync(manager, factory, config, request, stepId, tracker, notifier, timeoutMs);

	return stepId;
}

async function executeAsync(
	manager: AgentInstanceManager,
	factory: AgentSessionFactory,
	config: AgentConfig,
	request: AgentRequest,
	stepId: string,
	tracker: CompletionTracker,
	notifier: AsyncCallNotifier,
	timeoutMs?: number,
): Promise<void> {
	let sessionId: string | undefined;
	try {
		const handle = await manager.createInstance(config, factory, { timeoutMs });
		sessionId = handle.getSessionId();
		tracker.register(stepId, sessionId);

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

		const response: AgentResponse = {
			from: sessionId,
			stepId,
			status: state.errorMessage ? "error" : "success",
			result: resultText,
			error: state.errorMessage,
		};

		tracker.complete(stepId, response);
		notifier.emitCompleted({ stepId, sessionId, response });
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		const resolvedSessionId = sessionId ?? config.sessionId ?? "unknown";

		try {
			if (sessionId) {
				tracker.fail(stepId, error);
			} else {
				tracker.register(stepId, resolvedSessionId);
				tracker.fail(stepId, error);
			}
		} catch {
			// Tracker may have been cleared by the caller; swallow.
		}

		const response: AgentResponse = {
			from: resolvedSessionId,
			stepId,
			status: "error",
			error,
		};
		notifier.emitCompleted({ stepId, sessionId: resolvedSessionId, response });
		notifier.emitFailed({ stepId, sessionId: resolvedSessionId, error });
	} finally {
		if (sessionId) {
			await manager.disposeInstance(sessionId).catch(() => {});
		}
	}
}
