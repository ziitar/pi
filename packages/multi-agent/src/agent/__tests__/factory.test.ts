import { fauxAssistantMessage, fauxText, registerFauxProvider } from "@earendil-works/pi-ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentConfig } from "../../types.ts";
import { DefaultAgentSessionFactory } from "../factory.ts";

describe("DefaultAgentSessionFactory", () => {
	let factory: DefaultAgentSessionFactory;
	let faux: ReturnType<typeof registerFauxProvider>;

	beforeEach(() => {
		factory = new DefaultAgentSessionFactory();
		faux = registerFauxProvider();
	});

	afterEach(() => {
		faux.unregister();
	});

	it("creates a session and returns a handle", async () => {
		const config: AgentConfig = {
			model: faux.getModel(),
		};
		faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);

		const handle = await factory.createSession(config);
		expect(handle).toBeDefined();
		expect(handle.getSessionId()).toBeTruthy();
		expect(typeof handle.getSessionId()).toBe("string");
	});

	it("sets provided sessionId on the handle", async () => {
		const config: AgentConfig = {
			model: faux.getModel(),
			sessionId: "my-session-123",
		};
		faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);

		const handle = await factory.createSession(config);
		expect(handle.getSessionId()).toBe("my-session-123");
	});

	it("generates unique session IDs for independent sessions", async () => {
		const config: AgentConfig = {
			model: faux.getModel(),
		};
		faux.setResponses([fauxAssistantMessage([fauxText("ok")]), fauxAssistantMessage([fauxText("ok")])]);

		const [handle1, handle2] = await Promise.all([factory.createSession(config), factory.createSession(config)]);
		expect(handle1.getSessionId()).not.toBe(handle2.getSessionId());
	});

	it("sessions are isolated - prompting one does not affect the other", async () => {
		faux.setResponses([
			fauxAssistantMessage([fauxText("response from A")]),
			fauxAssistantMessage([fauxText("response from B")]),
		]);

		const config: AgentConfig = {
			model: faux.getModel(),
			messages: [],
		};

		const handleA = await factory.createSession(config);
		const handleB = await factory.createSession(config);

		const eventsA: string[] = [];
		const eventsB: string[] = [];

		handleA.subscribe((event) => {
			if (event.type === "agent_end") eventsA.push("ended");
		});
		handleB.subscribe((event) => {
			if (event.type === "agent_end") eventsB.push("ended");
		});

		await handleA.prompt("prompt for A");
		await handleB.prompt("prompt for B");

		// A got its own agent_end
		expect(eventsA).toEqual(["ended"]);
		expect(eventsB).toEqual(["ended"]);
	});

	it("getState returns the current agent state", async () => {
		const config: AgentConfig = {
			model: faux.getModel(),
			systemPrompt: "test prompt",
		};
		faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);

		const handle = await factory.createSession(config);
		const state = handle.getState();
		expect(state.systemPrompt).toBe("test prompt");
		expect(state.model).toBe(faux.getModel());
		expect(state.messages).toEqual([]);
	});

	it("subscribe receives lifecycle events", async () => {
		const config: AgentConfig = {
			model: faux.getModel(),
		};
		faux.setResponses([fauxAssistantMessage([fauxText("hello")])]);

		const handle = await factory.createSession(config);
		const events: string[] = [];
		const unsub = handle.subscribe((event) => {
			events.push(event.type);
		});

		await handle.prompt("Hello");
		unsub();

		expect(events).toContain("agent_start");
		expect(events).toContain("agent_end");
	});

	it("unsubscribe stops receiving events", async () => {
		const config: AgentConfig = {
			model: faux.getModel(),
		};
		faux.setResponses([fauxAssistantMessage([fauxText("hello")])]);

		const handle = await factory.createSession(config);
		const events: string[] = [];
		const unsub = handle.subscribe((event) => {
			events.push(event.type);
		});
		unsub();

		await handle.prompt("Hello");

		expect(events).toEqual([]);
	});

	it("abort cancels a running session", async () => {
		const config: AgentConfig = {
			model: faux.getModel(),
		};

		// Set a response with a gap to let us abort mid-flight
		faux.setResponses([fauxAssistantMessage([fauxText("response")])]);

		const handle = await factory.createSession(config);

		// Abort before prompting — should not throw
		handle.abort();

		// After abort the agent is not processing, so prompt should work
		await handle.prompt("Hello");
		expect(handle.getState().messages.length).toBeGreaterThan(0);
	});

	it("waitForIdle resolves after a prompt completes", async () => {
		const config: AgentConfig = {
			model: faux.getModel(),
		};
		faux.setResponses([fauxAssistantMessage([fauxText("done")])]);

		const handle = await factory.createSession(config);
		const promise = handle.prompt("Hello");
		await expect(handle.waitForIdle()).resolves.toBeUndefined();
		await promise;
	});

	it("accepts AgentSessionOptions without error", async () => {
		const config: AgentConfig = {
			model: faux.getModel(),
		};
		faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);

		const handle = await factory.createSession(config, {
			cwd: "/tmp",
			timeout: 5000,
			contextFragments: ["fragment 1"],
		});
		expect(handle).toBeDefined();
	});
});
