import type { AgentSessionHandle } from "../types.ts";

export interface AgentInstanceEntry {
	readonly sessionId: string;
	readonly handle: AgentSessionHandle;
	readonly createdAt: number;
	disposed: boolean;
	timeoutId?: ReturnType<typeof setTimeout>;
	abortController: AbortController;
}

export function createInstanceEntry(
	sessionId: string,
	handle: AgentSessionHandle,
	timeoutMs?: number,
): AgentInstanceEntry {
	const entry: AgentInstanceEntry = {
		sessionId,
		handle,
		createdAt: Date.now(),
		disposed: false,
		abortController: new AbortController(),
	};

	if (timeoutMs !== undefined && timeoutMs > 0) {
		entry.timeoutId = setTimeout(() => {
			entry.abortController.abort();
		}, timeoutMs);
	}

	return entry;
}

export function disposeInstanceEntry(entry: AgentInstanceEntry): void {
	if (entry.disposed) return;
	entry.disposed = true;

	if (entry.timeoutId !== undefined) {
		clearTimeout(entry.timeoutId);
		entry.timeoutId = undefined;
	}

	entry.abortController.abort();
	entry.handle.abort();
}

export function isInstanceActive(entry: AgentInstanceEntry): boolean {
	return !entry.disposed && !entry.abortController.signal.aborted;
}
