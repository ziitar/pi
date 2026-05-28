import type { AgentResponse } from "./protocol.ts";

/** Status of a tracked async call. */
export type AsyncCallStatus = "pending" | "completed" | "failed" | "timeout";

/** Entry tracking a single async call lifecycle. */
export interface AsyncCallEntry {
	stepId: string;
	sessionId: string;
	status: AsyncCallStatus;
	result?: AgentResponse;
	error?: string;
	startedAt: number;
	completedAt?: number;
}

/**
 * Tracks pending async agent calls by stepId.
 *
 * Shared between callAgentAsync, notification, and polling modules.
 * Each stepId maps to an AsyncCallEntry that progresses through its lifecycle.
 */
export class CompletionTracker {
	private readonly entries = new Map<string, AsyncCallEntry>();

	/** Register a new pending async call. Throws if stepId already exists. */
	register(stepId: string, sessionId: string): void {
		if (this.entries.has(stepId)) {
			throw new Error(`Step "${stepId}" is already registered`);
		}
		this.entries.set(stepId, {
			stepId,
			sessionId,
			status: "pending",
			startedAt: Date.now(),
		});
	}

	/** Mark a call as completed with its response. */
	complete(stepId: string, response: AgentResponse): void {
		const entry = this.entries.get(stepId);
		if (!entry) {
			throw new Error(`Step "${stepId}" not found`);
		}
		entry.status = "completed";
		entry.result = response;
		entry.completedAt = Date.now();
	}

	/** Mark a call as failed with an error message. */
	fail(stepId: string, error: string): void {
		const entry = this.entries.get(stepId);
		if (!entry) {
			throw new Error(`Step "${stepId}" not found`);
		}
		entry.status = "failed";
		entry.error = error;
		entry.completedAt = Date.now();
	}

	/** Mark a call as timed out. */
	timeout(stepId: string): void {
		const entry = this.entries.get(stepId);
		if (!entry) {
			throw new Error(`Step "${stepId}" not found`);
		}
		entry.status = "timeout";
		entry.error = `Step "${stepId}" timed out`;
		entry.completedAt = Date.now();
	}

	/** Get the full entry for a stepId. */
	getEntry(stepId: string): AsyncCallEntry | undefined {
		return this.entries.get(stepId);
	}

	/** Check if a stepId is still pending. */
	isPending(stepId: string): boolean {
		return this.entries.get(stepId)?.status === "pending";
	}

	/** Check if a stepId has completed (success, failure, or timeout). */
	isComplete(stepId: string): boolean {
		const status = this.entries.get(stepId)?.status;
		return status === "completed" || status === "failed" || status === "timeout";
	}

	/** Get all stepIds with a given status. */
	getByStatus(status: AsyncCallStatus): string[] {
		const result: string[] = [];
		for (const [stepId, entry] of this.entries) {
			if (entry.status === status) {
				result.push(stepId);
			}
		}
		return result;
	}

	/** Get all pending stepIds. */
	getPending(): string[] {
		return this.getByStatus("pending");
	}

	/** Remove a completed entry from tracking. */
	remove(stepId: string): boolean {
		return this.entries.delete(stepId);
	}

	/** Clear all entries. */
	clear(): void {
		this.entries.clear();
	}

	/** Number of tracked entries. */
	get size(): number {
		return this.entries.size;
	}
}
