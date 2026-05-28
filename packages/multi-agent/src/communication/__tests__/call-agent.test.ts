import { fauxAssistantMessage, fauxText, registerFauxProvider } from "@earendil-works/pi-ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DefaultAgentSessionFactory } from "../../agent/factory.ts";
import { AgentInstanceManager } from "../../agent/manager.ts";
import type { AgentConfig, AgentSessionFactory } from "../../types.ts";
import { callAgent } from "../call-agent.ts";
import type { AgentRequest } from "../protocol.ts";
import { ORCHESTRATOR_AGENT_NAME } from "../protocol.ts";

describe("callAgent", () => {
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

	function makeRequest(overrides?: Partial<AgentRequest>): AgentRequest {
		return {
			from: "caller",
			task: "do something",
			mode: "sync",
			...overrides,
		};
	}

	function makeConfig(sessionId?: string): AgentConfig {
		return {
			model: faux.getModel(),
			sessionId,
		};
	}

	it("returns success response for a completed sync call", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("result text")])]);

		const response = await callAgent({
			manager,
			factory,
			config: makeConfig("worker-1"),
			request: makeRequest(),
		});

		expect(response.status).toBe("success");
		expect(response.from).toBe("worker-1");
		expect(response.result).toBe("result text");
	});

	it("correlates stepId from request to response", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);

		const response = await callAgent({
			manager,
			factory,
			config: makeConfig("worker-2"),
			request: makeRequest({ stepId: "step-42" }),
		});

		expect(response.stepId).toBe("step-42");
	});

	it("blocks calling the orchestrator agent", async () => {
		const response = await callAgent({
			manager,
			factory,
			config: makeConfig(ORCHESTRATOR_AGENT_NAME),
			request: makeRequest(),
		});

		expect(response.status).toBe("error");
		expect(response.error).toBe("Cannot call the orchestrator agent directly");
		expect(response.from).toBe(ORCHESTRATOR_AGENT_NAME);
	});

	it("handles errors gracefully", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);

		const response = await callAgent({
			manager,
			factory,
			config: makeConfig("worker-3"),
			request: makeRequest(),
			timeoutMs: 1,
		});

		expect(response.status).toBeDefined();
		expect(response.from).toBeDefined();
	});

	it("disposes the agent instance after completion", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("done")])]);

		await callAgent({
			manager,
			factory,
			config: makeConfig("disposable"),
			request: makeRequest(),
		});

		expect(manager.getInstance("disposable")).toBeUndefined();
		expect(manager.activeCount).toBe(0);
	});

	it("disposes the agent instance even on error", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);

		await callAgent({
			manager,
			factory,
			config: makeConfig("error-session"),
			request: makeRequest(),
			timeoutMs: 1,
		});

		expect(manager.getInstance("error-session")).toBeUndefined();
	});
});
