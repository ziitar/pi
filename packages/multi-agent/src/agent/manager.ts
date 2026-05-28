import type { AgentConfig, AgentSessionFactory, AgentSessionHandle, AgentSessionOptions } from "../types.ts";
import { type AgentLifecycleHooks, type CompletionReason, LifecycleManager } from "./lifecycle.ts";
import { type AgentInstanceEntry, createInstanceEntry, disposeInstanceEntry, isInstanceActive } from "./session.ts";

export interface AgentInstanceManagerOptions {
	maxConcurrent?: number;
	defaultTimeoutMs?: number;
}

export class AgentInstanceManager {
	private readonly instances = new Map<string, AgentInstanceEntry>();
	private readonly lifecycleManager = new LifecycleManager();
	private readonly maxConcurrent: number;
	private readonly defaultTimeoutMs?: number;
	private _refreshBlocked = false;

	constructor(options?: AgentInstanceManagerOptions) {
		this.maxConcurrent = options?.maxConcurrent ?? 3;
		this.defaultTimeoutMs = options?.defaultTimeoutMs;
	}

	get activeCount(): number {
		let count = 0;
		for (const entry of this.instances.values()) {
			if (isInstanceActive(entry)) {
				count++;
			}
		}
		return count;
	}

	get refreshBlocked(): boolean {
		return this._refreshBlocked;
	}

	registerHooks(hooks: AgentLifecycleHooks): () => void {
		return this.lifecycleManager.register(hooks);
	}

	async createInstance(
		config: AgentConfig,
		factory: AgentSessionFactory,
		options?: AgentSessionOptions & { timeoutMs?: number },
	): Promise<AgentSessionHandle> {
		this.purgeDisposed();

		if (this.activeCount >= this.maxConcurrent) {
			throw new Error(`Cannot create agent instance: maximum concurrent limit (${this.maxConcurrent}) reached`);
		}

		const sessionId = config.sessionId ?? crypto.randomUUID();

		if (this.instances.has(sessionId)) {
			throw new Error(`Agent instance with sessionId "${sessionId}" already exists`);
		}

		const handle = await factory.createSession({ ...config, sessionId }, options);

		const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
		const entry = createInstanceEntry(sessionId, handle, timeoutMs);
		this.instances.set(sessionId, entry);

		this._refreshBlocked = true;

		const lifecycleContext = {
			sessionId,
			handle,
			createdAt: entry.createdAt,
		};

		await this.lifecycleManager.invokeOnStart(lifecycleContext);

		if (entry.timeoutId !== undefined) {
			entry.abortController.signal.addEventListener(
				"abort",
				() => {
					if (entry.disposed) return;
					const durationMs = Date.now() - entry.createdAt;
					void this.lifecycleManager.invokeOnTimeout(lifecycleContext, timeoutMs!).then(() =>
						this.lifecycleManager.invokeOnComplete(lifecycleContext, {
							reason: "timeout",
							errorMessage: `Agent instance timed out after ${timeoutMs}ms`,
							durationMs,
						}),
					);
					disposeInstanceEntry(entry);
					this.updateRefreshBlock();
				},
				{ once: true },
			);
		}

		return handle;
	}

	getInstance(sessionId: string): AgentSessionHandle | undefined {
		const entry = this.instances.get(sessionId);
		if (!entry || !isInstanceActive(entry)) {
			return undefined;
		}
		return entry.handle;
	}

	async disposeInstance(sessionId: string, reason: CompletionReason = "normal"): Promise<boolean> {
		const entry = this.instances.get(sessionId);
		if (!entry) {
			return false;
		}

		if (entry.disposed) {
			this.instances.delete(sessionId);
			return false;
		}

		const durationMs = Date.now() - entry.createdAt;
		const lifecycleContext = {
			sessionId,
			handle: entry.handle,
			createdAt: entry.createdAt,
		};

		disposeInstanceEntry(entry);
		this.instances.delete(sessionId);

		await this.lifecycleManager.invokeOnComplete(lifecycleContext, {
			reason,
			durationMs,
		});

		this.updateRefreshBlock();
		return true;
	}

	async disposeAll(): Promise<void> {
		const entries = Array.from(this.instances.entries());
		this.instances.clear();

		for (const [sessionId, entry] of entries) {
			if (!entry.disposed) {
				const durationMs = Date.now() - entry.createdAt;
				const lifecycleContext = {
					sessionId,
					handle: entry.handle,
					createdAt: entry.createdAt,
				};

				disposeInstanceEntry(entry);

				await this.lifecycleManager.invokeOnComplete(lifecycleContext, {
					reason: "aborted",
					durationMs,
				});
			}
		}

		this._refreshBlocked = false;
	}

	assertRefreshAllowed(): void {
		if (this._refreshBlocked) {
			throw new Error("Cannot refresh ModelRegistry while agent instances are active. Dispose all instances first.");
		}
	}

	private purgeDisposed(): void {
		for (const [sessionId, entry] of this.instances) {
			if (entry.disposed || (!isInstanceActive(entry) && entry.timeoutId === undefined)) {
				this.instances.delete(sessionId);
			}
		}
	}

	private updateRefreshBlock(): void {
		this._refreshBlocked = this.activeCount > 0;
	}
}
