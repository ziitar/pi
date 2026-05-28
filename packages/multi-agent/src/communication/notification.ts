import { EventEmitter } from "node:events";
import type { AgentResponse } from "./protocol.ts";

export interface CompletionEvent {
	stepId: string;
	sessionId: string;
	response: AgentResponse;
}

export interface ErrorEvent {
	stepId: string;
	sessionId: string;
	error: string;
}

export interface TimeoutEvent {
	stepId: string;
	sessionId: string;
}

export interface AsyncCallEvents {
	completed: [CompletionEvent];
	failed: [ErrorEvent];
	timedOut: [TimeoutEvent];
}

export class AsyncCallNotifier {
	private readonly emitter = new EventEmitter();

	on<K extends keyof AsyncCallEvents>(event: K, listener: (...args: AsyncCallEvents[K]) => void): () => void {
		this.emitter.on(event, listener as (...args: unknown[]) => void);
		return () => {
			this.emitter.off(event, listener as (...args: unknown[]) => void);
		};
	}

	once<K extends keyof AsyncCallEvents>(event: K, listener: (...args: AsyncCallEvents[K]) => void): () => void {
		this.emitter.once(event, listener as (...args: unknown[]) => void);
		return () => {
			this.emitter.off(event, listener as (...args: unknown[]) => void);
		};
	}

	emitCompleted(event: CompletionEvent): void {
		this.emitter.emit("completed", event);
	}

	emitFailed(event: ErrorEvent): void {
		this.emitter.emit("failed", event);
	}

	emitTimedOut(event: TimeoutEvent): void {
		this.emitter.emit("timedOut", event);
	}

	removeAllListeners(): void {
		this.emitter.removeAllListeners();
	}
}
