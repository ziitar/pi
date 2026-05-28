/**
 * Agent lifecycle hooks for monitoring and controlling agent instances.
 *
 * These hooks are invoked by AgentInstanceManager at key points in an
 * agent instance's lifecycle. Implementations can use them for logging,
 * metrics, resource tracking, or coordination between agents.
 */

import type { AgentSessionHandle } from "../types.ts";

/** Context passed to lifecycle hooks. */
export interface LifecycleContext {
	/** The session ID of the agent instance. */
	readonly sessionId: string;
	/** The agent handle (available after creation). */
	readonly handle: AgentSessionHandle;
	/** Timestamp when the instance was created. */
	readonly createdAt: number;
}

/** Reason for agent completion. */
export type CompletionReason = "normal" | "error" | "timeout" | "aborted";

/** Result passed to onComplete hook. */
export interface CompletionResult {
	/** Why the agent completed. */
	readonly reason: CompletionReason;
	/** Error message if reason is "error" or "timeout". */
	readonly errorMessage?: string;
	/** Duration in milliseconds from creation to completion. */
	readonly durationMs: number;
}

/**
 * Lifecycle hooks for agent instances.
 *
 * All hooks are optional. Hooks are called in the order they are registered
 * on the AgentInstanceManager. If a hook throws, the error is caught and
 * logged but does not prevent subsequent hooks or agent operations.
 */
export interface AgentLifecycleHooks {
	/**
	 * Called when a new agent instance is created and registered.
	 * Use this for logging, metrics initialization, or resource allocation.
	 */
	onStart?: (context: LifecycleContext) => void | Promise<void>;

	/**
	 * Called when an agent instance completes (normally, with error, or timeout).
	 * Use this for cleanup, metrics finalization, or result aggregation.
	 */
	onComplete?: (context: LifecycleContext, result: CompletionResult) => void | Promise<void>;

	/**
	 * Called when an agent instance encounters an error.
	 * This is called before onComplete when the reason is "error".
	 * Use this for error reporting, retry decisions, or fallback logic.
	 */
	onError?: (context: LifecycleContext, error: Error) => void | Promise<void>;

	/**
	 * Called when an agent instance times out.
	 * This is called before onComplete when the reason is "timeout".
	 * Use this for timeout handling, partial result recovery, or escalation.
	 */
	onTimeout?: (context: LifecycleContext, timeoutMs: number) => void | Promise<void>;
}

/**
 * Manages lifecycle hook registration and invocation.
 *
 * Hooks are invoked in registration order. Errors in hooks are caught
 * and collected but do not prevent other hooks from running.
 */
export class LifecycleManager {
	private readonly hooks: AgentLifecycleHooks[] = [];

	/** Register a set of lifecycle hooks. Returns an unsubscribe function. */
	register(hooks: AgentLifecycleHooks): () => void {
		this.hooks.push(hooks);
		return () => {
			const index = this.hooks.indexOf(hooks);
			if (index !== -1) {
				this.hooks.splice(index, 1);
			}
		};
	}

	/** Get the number of registered hook sets. */
	get size(): number {
		return this.hooks.length;
	}

	/** Invoke onStart hooks. */
	async invokeOnStart(context: LifecycleContext): Promise<void> {
		for (const hooks of this.hooks) {
			if (hooks.onStart) {
				try {
					await hooks.onStart(context);
				} catch {
					// Hook errors are non-fatal
				}
			}
		}
	}

	/** Invoke onComplete hooks. */
	async invokeOnComplete(context: LifecycleContext, result: CompletionResult): Promise<void> {
		for (const hooks of this.hooks) {
			if (hooks.onComplete) {
				try {
					await hooks.onComplete(context, result);
				} catch {
					// Hook errors are non-fatal
				}
			}
		}
	}

	/** Invoke onError hooks. */
	async invokeOnError(context: LifecycleContext, error: Error): Promise<void> {
		for (const hooks of this.hooks) {
			if (hooks.onError) {
				try {
					await hooks.onError(context, error);
				} catch {
					// Hook errors are non-fatal
				}
			}
		}
	}

	/** Invoke onTimeout hooks. */
	async invokeOnTimeout(context: LifecycleContext, timeoutMs: number): Promise<void> {
		for (const hooks of this.hooks) {
			if (hooks.onTimeout) {
				try {
					await hooks.onTimeout(context, timeoutMs);
				} catch {
					// Hook errors are non-fatal
				}
			}
		}
	}
}
