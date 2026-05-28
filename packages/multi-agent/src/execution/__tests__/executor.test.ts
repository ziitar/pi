import { fauxAssistantMessage, fauxText, registerFauxProvider } from "@earendil-works/pi-ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DefaultAgentSessionFactory } from "../../agent/factory.ts";
import { AgentInstanceManager } from "../../agent/manager.ts";
import type { AgentConfig, AgentSessionFactory } from "../../types.ts";
import { executeAgent } from "../executor.ts";

describe("executeAgent", () => {
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

	it("executes a prompt and returns completed result", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("hello world")])]);

		const result = await executeAgent(makeConfig("test-1"), manager, factory, "say hello");

		expect(result.status).toBe("completed");
		expect(result.agentName).toBe("test-1");
		expect(result.messages.length).toBeGreaterThan(0);
		expect(result.duration).toBeGreaterThanOrEqual(0);
		expect(result.error).toBeUndefined();
	});

	it("returns model and category in result", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);

		const result = await executeAgent(makeConfig("test-model"), manager, factory, "go");

		expect(result.model).toBe(String(faux.getModel()));
		expect(result.category).toBe("");
	});

	it("returns failed result when instance creation fails", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);
		await manager.createInstance(makeConfig("dup"), factory);

		const result = await executeAgent(makeConfig("dup"), manager, factory, "test");

		expect(result.status).toBe("failed");
		expect(result.error).toContain("already exists");
		expect(result.messages).toEqual([]);
	});

	it("returns failed result when max concurrent limit reached", async () => {
		faux.setResponses([
			fauxAssistantMessage([fauxText("a")]),
			fauxAssistantMessage([fauxText("b")]),
			fauxAssistantMessage([fauxText("c")]),
		]);

		await manager.createInstance(makeConfig("a"), factory);
		await manager.createInstance(makeConfig("b"), factory);
		await manager.createInstance(makeConfig("c"), factory);

		const result = await executeAgent(makeConfig("d"), manager, factory, "test");

		expect(result.status).toBe("failed");
		expect(result.error).toContain("maximum concurrent limit");
	});

	it("collects messages from the agent state", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("detailed response")])]);

		const result = await executeAgent(makeConfig("msg-test"), manager, factory, "explain");

		expect(result.messages.length).toBeGreaterThan(0);
	});

	it("handles timeout via manager options", async () => {
		const managerWithTimeout = new AgentInstanceManager({
			maxConcurrent: 3,
			defaultTimeoutMs: 50,
		});

		faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);

		const result = await executeAgent(makeConfig("timeout-test"), managerWithTimeout, factory, "slow task", {
			timeoutMs: 50,
		});

		expect(result.duration).toBeGreaterThanOrEqual(0);
		expect(result.agentName).toBe("timeout-test");
	});

	it("handles external abort signal", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);

		const controller = new AbortController();
		controller.abort();

		const result = await executeAgent(makeConfig("abort-test"), manager, factory, "cancelled task", {
			abortSignal: controller.signal,
		});

		expect(result.status).toBe("failed");
		expect(result.error).toBe("Execution aborted");
	});

	it("applies systemPrompt override from options", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);

		const result = await executeAgent(makeConfig("prompt-override"), manager, factory, "test", {
			systemPrompt: "custom system prompt",
		});

		expect(result.status).toBe("completed");
	});

	it("returns partial status when messages exist before error", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("partial data")])]);

		const result = await executeAgent(makeConfig("partial-test"), manager, factory, "work");

		expect(["completed", "partial"]).toContain(result.status);
	});

	it("disposes instance after execution", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("done")])]);

		await executeAgent(makeConfig("dispose-test"), manager, factory, "run");

		expect(manager.getInstance("dispose-test")).toBeUndefined();
		expect(manager.activeCount).toBe(0);
	});

	it("disposes instance after error", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);
		await manager.createInstance(makeConfig("dup"), factory);

		await executeAgent(makeConfig("dup"), manager, factory, "fail");

		expect(manager.activeCount).toBe(1);
	});

	it("handles factory that throws during creation", async () => {
		const failingFactory: AgentSessionFactory = {
			createSession: async () => {
				throw new Error("Factory exploded");
			},
		};

		const result = await executeAgent(makeConfig("factory-fail"), manager, failingFactory, "test");

		expect(result.status).toBe("failed");
		expect(result.error).toBe("Factory exploded");
		expect(result.messages).toEqual([]);
	});

	it("uses default timeout when not specified", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);

		const result = await executeAgent(makeConfig("default-timeout"), manager, factory, "quick");

		expect(result.status).toBe("completed");
	});

	it("handles multiple sequential executions", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("first")]), fauxAssistantMessage([fauxText("second")])]);

		const r1 = await executeAgent(makeConfig("seq-1"), manager, factory, "first task");
		const r2 = await executeAgent(makeConfig("seq-2"), manager, factory, "second task");

		expect(r1.status).toBe("completed");
		expect(r2.status).toBe("completed");
		expect(r1.agentName).toBe("seq-1");
		expect(r2.agentName).toBe("seq-2");
	});
});
