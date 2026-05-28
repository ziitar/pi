import type { AsyncCallEntry, CompletionTracker } from "./completion-tracker.ts";
import type { AsyncCallNotifier } from "./notification.ts";

export interface PollingOptions {
	tracker: CompletionTracker;
	notifier: AsyncCallNotifier;
	pollingIntervalMs?: number;
	defaultTimeoutMs?: number;
}

export class AsyncPoller {
	private readonly tracker: CompletionTracker;
	private readonly notifier: AsyncCallNotifier;
	private readonly pollingIntervalMs: number;
	private readonly defaultTimeoutMs: number;
	private intervalId: ReturnType<typeof setInterval> | undefined;

	constructor(options: PollingOptions) {
		this.tracker = options.tracker;
		this.notifier = options.notifier;
		this.pollingIntervalMs = options.pollingIntervalMs ?? 5_000;
		this.defaultTimeoutMs = options.defaultTimeoutMs ?? 60_000;
	}

	start(): void {
		if (this.intervalId !== undefined) return;
		this.intervalId = setInterval(() => this.checkTimeouts(), this.pollingIntervalMs);
	}

	stop(): void {
		if (this.intervalId !== undefined) {
			clearInterval(this.intervalId);
			this.intervalId = undefined;
		}
	}

	checkTimeouts(): void {
		const now = Date.now();
		const pending = this.tracker.getPending();

		for (const stepId of pending) {
			const entry = this.tracker.getEntry(stepId);
			if (!entry) continue;

			const elapsed = now - entry.startedAt;
			if (elapsed >= this.defaultTimeoutMs) {
				this.tracker.timeout(stepId);
				this.notifier.emitTimedOut({ stepId, sessionId: entry.sessionId });
			}
		}
	}

	get isRunning(): boolean {
		return this.intervalId !== undefined;
	}
}

export interface WaitForCompletionOptions {
	timeoutMs?: number;
}

export async function waitForCompletion(
	stepIds: string[],
	tracker: CompletionTracker,
	notifier: AsyncCallNotifier,
	options?: WaitForCompletionOptions,
): Promise<AsyncCallEntry[]> {
	const timeoutMs = options?.timeoutMs ?? 60_000;

	const pending = stepIds.filter((id) => !tracker.isComplete(id));

	if (pending.length === 0) {
		return stepIds.map((id) => tracker.getEntry(id)!);
	}

	return new Promise((resolve, reject) => {
		const unsubs: Array<() => void> = [];
		let settled = false;
		let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

		function cleanup() {
			for (const unsub of unsubs) unsub();
			unsubs.length = 0;
			if (timeoutHandle !== undefined) {
				clearTimeout(timeoutHandle);
				timeoutHandle = undefined;
			}
		}

		function tryResolve() {
			if (settled) return;
			const allDone = stepIds.every((id) => tracker.isComplete(id));
			if (allDone) {
				settled = true;
				cleanup();
				resolve(stepIds.map((id) => tracker.getEntry(id)!));
			}
		}

		function onCompleted(event: { stepId: string }) {
			if (stepIds.includes(event.stepId)) {
				tryResolve();
			}
		}

		function onFailed(event: { stepId: string }) {
			if (stepIds.includes(event.stepId)) {
				tryResolve();
			}
		}

		function onTimedOut(event: { stepId: string }) {
			if (stepIds.includes(event.stepId)) {
				tryResolve();
			}
		}

		unsubs.push(notifier.on("completed", onCompleted));
		unsubs.push(notifier.on("failed", onFailed));
		unsubs.push(notifier.on("timedOut", onTimedOut));

		timeoutHandle = setTimeout(() => {
			if (settled) return;
			settled = true;
			cleanup();
			reject(new Error(`waitForCompletion timed out after ${timeoutMs}ms`));
		}, timeoutMs);

		tryResolve();
	});
}
