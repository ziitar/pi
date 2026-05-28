import type { AgentInstanceManager } from "../agent/manager.ts";
import type { AgentConfig, AgentSessionFactory } from "../types.ts";
import type { AgentResult, ExecutionOptions } from "./types.ts";

const DEFAULT_TIMEOUT_MS = 120_000;

export async function executeAgent(
	config: AgentConfig,
	manager: AgentInstanceManager,
	factory: AgentSessionFactory,
	prompt: string,
	options?: ExecutionOptions,
): Promise<AgentResult> {
	const startTime = Date.now();

	if (options?.abortSignal?.aborted) {
		return {
			agentName: config.sessionId ?? "unknown",
			category: "",
			model: String(config.model),
			messages: [],
			status: "failed",
			duration: Date.now() - startTime,
			error: "Execution aborted",
		};
	}

	const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	const mergedConfig: AgentConfig = {
		...config,
		...(options?.systemPrompt !== undefined && { systemPrompt: options.systemPrompt }),
	};

	let handle: import("../types.ts").AgentSessionHandle;
	try {
		handle = await manager.createInstance(mergedConfig, factory, {
			timeoutMs,
			cwd: options?.cwd,
			abortSignal: options?.abortSignal,
		});
	} catch (error) {
		return {
			agentName: mergedConfig.sessionId ?? "unknown",
			category: "",
			model: String(mergedConfig.model),
			messages: [],
			status: "failed",
			duration: Date.now() - startTime,
			error: error instanceof Error ? error.message : "Failed to create agent instance",
		};
	}

	const sessionId = handle.getSessionId();

	const externalAbortPromise = createAbortPromise(options?.abortSignal);

	try {
		await Promise.race([handle.prompt(prompt), externalAbortPromise]);
		await Promise.race([handle.waitForIdle(), externalAbortPromise]);

		const messages = handle.getState().messages;

		await manager.disposeInstance(sessionId, "normal");

		return {
			agentName: sessionId,
			category: "",
			model: String(mergedConfig.model),
			messages,
			status: "completed",
			duration: Date.now() - startTime,
		};
	} catch (error) {
		const isTimeout = error instanceof Error && error.message === "Agent timeout";
		const isAbort = error instanceof Error && error.message === "Execution aborted";

		let messages: import("@earendil-works/pi-agent-core").AgentMessage[];
		try {
			messages = handle.getState().messages;
		} catch {
			messages = [];
		}

		await manager.disposeInstance(sessionId, isTimeout ? "timeout" : isAbort ? "aborted" : "error");

		return {
			agentName: sessionId,
			category: "",
			model: String(mergedConfig.model),
			messages,
			status: messages.length > 0 ? "partial" : "failed",
			duration: Date.now() - startTime,
			error: error instanceof Error ? error.message : "Unknown execution error",
		};
	}
}

function createAbortPromise(signal?: AbortSignal): Promise<never> | undefined {
	if (!signal) return undefined;

	if (signal.aborted) {
		return Promise.reject(new Error("Execution aborted"));
	}

	return new Promise<never>((_resolve, reject) => {
		signal.addEventListener("abort", () => reject(new Error("Execution aborted")), { once: true });
	});
}
