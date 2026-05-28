import { fauxAssistantMessage, fauxText, registerFauxProvider } from "@earendil-works/pi-ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentConfig, AgentSessionFactory } from "../../types.ts";
import { DefaultAgentSessionFactory } from "../factory.ts";
import type { AgentLifecycleHooks, CompletionResult, LifecycleContext } from "../lifecycle.ts";
import { AgentInstanceManager } from "../manager.ts";

describe("AgentInstanceManager", () => {
	let manager: AgentInstanceManager;
	let factory: AgentSessionFactory;
	let faux: ReturnType<typeof registerFauxProvider>;

	beforeEach(() => {
		manager = new AgentInstanceManager({ maxConcurrent: 3 });
		factory = new DefaultAgentSessionFactory();
		faux = registerFauxProvider();
	});

	afterEach(async () => {
		await manager.disposeAll();
		faux.unregister();
	});

	function makeConfig(sessionId?: string): AgentConfig {
		return {
			model: faux.getModel(),
			sessionId,
		};
	}

	describe("createInstance", () => {
		it("creates a new agent instance and returns a handle", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);
			const handle = await manager.createInstance(makeConfig(), factory);
			expect(handle).toBeDefined();
			expect(handle.getSessionId()).toBeTruthy();
		});

		it("uses provided sessionId", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);
			const handle = await manager.createInstance(makeConfig("custom-id"), factory);
			expect(handle.getSessionId()).toBe("custom-id");
		});

		it("generates unique sessionId when not provided", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("ok")]), fauxAssistantMessage([fauxText("ok")])]);
			const h1 = await manager.createInstance(makeConfig(), factory);
			const h2 = await manager.createInstance(makeConfig(), factory);
			expect(h1.getSessionId()).not.toBe(h2.getSessionId());
		});

		it("rejects when max concurrent limit is reached", async () => {
			faux.setResponses([
				fauxAssistantMessage([fauxText("a")]),
				fauxAssistantMessage([fauxText("b")]),
				fauxAssistantMessage([fauxText("c")]),
			]);

			await manager.createInstance(makeConfig(), factory);
			await manager.createInstance(makeConfig(), factory);
			await manager.createInstance(makeConfig(), factory);

			await expect(manager.createInstance(makeConfig(), factory)).rejects.toThrow(
				"maximum concurrent limit (3) reached",
			);
		});

		it("rejects duplicate sessionId", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);
			await manager.createInstance(makeConfig("dup-id"), factory);

			await expect(manager.createInstance(makeConfig("dup-id"), factory)).rejects.toThrow("already exists");
		});

		it("increments activeCount", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);
			expect(manager.activeCount).toBe(0);
			await manager.createInstance(makeConfig(), factory);
			expect(manager.activeCount).toBe(1);
		});

		it("blocks model registry refresh after creation", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);
			expect(manager.refreshBlocked).toBe(false);
			await manager.createInstance(makeConfig(), factory);
			expect(manager.refreshBlocked).toBe(true);
		});
	});

	describe("getInstance", () => {
		it("returns handle for active instance", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);
			const handle = await manager.createInstance(makeConfig("test-id"), factory);
			const retrieved = manager.getInstance("test-id");
			expect(retrieved).toBe(handle);
		});

		it("returns undefined for unknown sessionId", () => {
			expect(manager.getInstance("nonexistent")).toBeUndefined();
		});

		it("returns undefined for disposed instance", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);
			await manager.createInstance(makeConfig("test-id"), factory);
			await manager.disposeInstance("test-id");
			expect(manager.getInstance("test-id")).toBeUndefined();
		});
	});

	describe("disposeInstance", () => {
		it("disposes an active instance and returns true", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);
			await manager.createInstance(makeConfig("test-id"), factory);
			const result = await manager.disposeInstance("test-id");
			expect(result).toBe(true);
			expect(manager.activeCount).toBe(0);
		});

		it("returns false for unknown sessionId", async () => {
			const result = await manager.disposeInstance("nonexistent");
			expect(result).toBe(false);
		});

		it("cleans up the instance completely", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);
			await manager.createInstance(makeConfig("test-id"), factory);
			await manager.disposeInstance("test-id");
			expect(manager.getInstance("test-id")).toBeUndefined();
			expect(manager.activeCount).toBe(0);
		});

		it("unblocks model registry refresh after all disposed", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("a")]), fauxAssistantMessage([fauxText("b")])]);
			await manager.createInstance(makeConfig("a"), factory);
			await manager.createInstance(makeConfig("b"), factory);
			expect(manager.refreshBlocked).toBe(true);

			await manager.disposeInstance("a");
			expect(manager.refreshBlocked).toBe(true);

			await manager.disposeInstance("b");
			expect(manager.refreshBlocked).toBe(false);
		});
	});

	describe("disposeAll", () => {
		it("disposes all active instances", async () => {
			faux.setResponses([
				fauxAssistantMessage([fauxText("a")]),
				fauxAssistantMessage([fauxText("b")]),
				fauxAssistantMessage([fauxText("c")]),
			]);

			await manager.createInstance(makeConfig("a"), factory);
			await manager.createInstance(makeConfig("b"), factory);
			await manager.createInstance(makeConfig("c"), factory);

			await manager.disposeAll();

			expect(manager.activeCount).toBe(0);
			expect(manager.getInstance("a")).toBeUndefined();
			expect(manager.getInstance("b")).toBeUndefined();
			expect(manager.getInstance("c")).toBeUndefined();
		});

		it("unblocks model registry refresh", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);
			await manager.createInstance(makeConfig(), factory);
			expect(manager.refreshBlocked).toBe(true);

			await manager.disposeAll();
			expect(manager.refreshBlocked).toBe(false);
		});

		it("is safe to call when no instances exist", async () => {
			await expect(manager.disposeAll()).resolves.toBeUndefined();
		});
	});

	describe("assertRefreshAllowed", () => {
		it("does not throw when no instances are active", () => {
			expect(() => manager.assertRefreshAllowed()).not.toThrow();
		});

		it("throws when instances are active", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);
			await manager.createInstance(makeConfig(), factory);
			expect(() => manager.assertRefreshAllowed()).toThrow("Cannot refresh ModelRegistry");
		});

		it("does not throw after all instances disposed", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);
			await manager.createInstance(makeConfig(), factory);
			await manager.disposeAll();
			expect(() => manager.assertRefreshAllowed()).not.toThrow();
		});
	});

	describe("session isolation", () => {
		it("sessions have independent state", async () => {
			faux.setResponses([
				fauxAssistantMessage([fauxText("response A")]),
				fauxAssistantMessage([fauxText("response B")]),
			]);

			const hA = await manager.createInstance(makeConfig("a"), factory);
			const hB = await manager.createInstance(makeConfig("b"), factory);

			await hA.prompt("prompt A");
			await hB.prompt("prompt B");

			const stateA = hA.getState();
			const stateB = hB.getState();

			expect(stateA.messages.length).toBeGreaterThan(0);
			expect(stateB.messages.length).toBeGreaterThan(0);
			expect(stateA.messages).not.toEqual(stateB.messages);
		});

		it("sessions have unique sessionIds", async () => {
			faux.setResponses([
				fauxAssistantMessage([fauxText("a")]),
				fauxAssistantMessage([fauxText("b")]),
				fauxAssistantMessage([fauxText("c")]),
			]);

			const h1 = await manager.createInstance(makeConfig(), factory);
			const h2 = await manager.createInstance(makeConfig(), factory);
			const h3 = await manager.createInstance(makeConfig("custom"), factory);

			const ids = new Set([h1.getSessionId(), h2.getSessionId(), h3.getSessionId()]);
			expect(ids.size).toBe(3);
		});

		it("disposing one session does not affect others", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("a")]), fauxAssistantMessage([fauxText("b")])]);

			await manager.createInstance(makeConfig("a"), factory);
			await manager.createInstance(makeConfig("b"), factory);

			await manager.disposeInstance("a");

			expect(manager.getInstance("a")).toBeUndefined();
			expect(manager.getInstance("b")).toBeDefined();
			expect(manager.activeCount).toBe(1);
		});
	});

	describe("lifecycle hooks", () => {
		it("invokes onStart when instance is created", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);

			let capturedContext: LifecycleContext | undefined;
			const hooks: AgentLifecycleHooks = {
				onStart: (ctx) => {
					capturedContext = ctx;
				},
			};

			manager.registerHooks(hooks);
			const handle = await manager.createInstance(makeConfig("test-id"), factory);

			expect(capturedContext).toBeDefined();
			expect(capturedContext!.sessionId).toBe("test-id");
			expect(capturedContext!.handle).toBe(handle);
			expect(capturedContext!.createdAt).toBeGreaterThan(0);
		});

		it("invokes onComplete when instance is disposed", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);

			let capturedResult: CompletionResult | undefined;
			const hooks: AgentLifecycleHooks = {
				onComplete: (_ctx, result) => {
					capturedResult = result;
				},
			};

			manager.registerHooks(hooks);
			await manager.createInstance(makeConfig("test-id"), factory);
			await manager.disposeInstance("test-id", "normal");

			expect(capturedResult).toBeDefined();
			expect(capturedResult!.reason).toBe("normal");
			expect(capturedResult!.durationMs).toBeGreaterThanOrEqual(0);
		});

		it("invokes onComplete with 'aborted' reason on disposeAll", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);

			const results: CompletionResult[] = [];
			const hooks: AgentLifecycleHooks = {
				onComplete: (_ctx, result) => {
					results.push(result);
				},
			};

			manager.registerHooks(hooks);
			await manager.createInstance(makeConfig(), factory);
			await manager.disposeAll();

			expect(results).toHaveLength(1);
			expect(results[0].reason).toBe("aborted");
		});

		it("supports multiple hook registrations", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);

			let hook1Called = false;
			let hook2Called = false;

			manager.registerHooks({
				onStart: () => {
					hook1Called = true;
				},
			});
			manager.registerHooks({
				onStart: () => {
					hook2Called = true;
				},
			});

			await manager.createInstance(makeConfig(), factory);

			expect(hook1Called).toBe(true);
			expect(hook2Called).toBe(true);
		});

		it("unsubscribe removes hooks", async () => {
			faux.setResponses([fauxAssistantMessage([fauxText("ok")]), fauxAssistantMessage([fauxText("ok")])]);

			let callCount = 0;
			const unsub = manager.registerHooks({
				onStart: () => {
					callCount++;
				},
			});

			await manager.createInstance(makeConfig("first"), factory);
			expect(callCount).toBe(1);

			unsub();

			await manager.createInstance(makeConfig("second"), factory);
			expect(callCount).toBe(1);
		});
	});
});
