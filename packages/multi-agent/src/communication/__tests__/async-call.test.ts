import { fauxAssistantMessage, fauxText, registerFauxProvider } from "@earendil-works/pi-ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DefaultAgentSessionFactory } from "../../agent/factory.ts";
import { AgentInstanceManager } from "../../agent/manager.ts";
import type { AgentConfig, AgentSessionFactory } from "../../types.ts";
import { callAgentAsync } from "../async-call.ts";
import { CompletionTracker } from "../completion-tracker.ts";
import { AsyncCallNotifier } from "../notification.ts";
import { AsyncPoller, waitForCompletion } from "../polling.ts";
import type { AgentRequest } from "../protocol.ts";

describe("async-call", () => {
	let manager: AgentInstanceManager;
	let factory: AgentSessionFactory;
	let faux: ReturnType<typeof registerFauxProvider>;
	let tracker: CompletionTracker;
	let notifier: AsyncCallNotifier;

	beforeEach(() => {
		vi.useFakeTimers();
		manager = new AgentInstanceManager({ maxConcurrent: 3 });
		factory = new DefaultAgentSessionFactory();
		faux = registerFauxProvider();
		tracker = new CompletionTracker();
		notifier = new AsyncCallNotifier();
	});

	afterEach(async () => {
		await manager.disposeAll();
		faux.unregister();
		notifier.removeAllListeners();
		tracker.clear();
		vi.useRealTimers();
	});

	function makeRequest(overrides?: Partial<AgentRequest>): AgentRequest {
		return {
			from: "caller",
			task: "do something",
			mode: "async",
			...overrides,
		};
	}

	function makeConfig(sessionId?: string): AgentConfig {
		return {
			model: faux.getModel(),
			sessionId,
		};
	}

	it("returns a stepId immediately", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("result")])]);

		const stepId = callAgentAsync({
			manager,
			factory,
			config: makeConfig("worker-1"),
			request: makeRequest(),
			tracker,
			notifier,
		});

		expect(stepId).toBeDefined();
		expect(typeof stepId).toBe("string");

		await vi.advanceTimersByTimeAsync(100);
	});

	it("uses provided stepId from request", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);

		const stepId = callAgentAsync({
			manager,
			factory,
			config: makeConfig("worker-2"),
			request: makeRequest({ stepId: "custom-step" }),
			tracker,
			notifier,
		});

		expect(stepId).toBe("custom-step");

		await vi.advanceTimersByTimeAsync(100);
	});

	it("registers the call in the tracker", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);

		const stepId = callAgentAsync({
			manager,
			factory,
			config: makeConfig("worker-3"),
			request: makeRequest({ stepId: "step-track" }),
			tracker,
			notifier,
		});

		await vi.advanceTimersByTimeAsync(100);

		expect(tracker.getEntry(stepId)).toBeDefined();
		expect(tracker.isComplete(stepId)).toBe(true);
	});

	it("completes the call and emits notification", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("done")])]);

		const completedEvents: Array<{ stepId: string; sessionId: string }> = [];
		notifier.on("completed", (event) => {
			completedEvents.push(event);
		});

		const stepId = callAgentAsync({
			manager,
			factory,
			config: makeConfig("worker-4"),
			request: makeRequest({ stepId: "step-complete" }),
			tracker,
			notifier,
		});

		await vi.advanceTimersByTimeAsync(100);

		expect(tracker.isComplete(stepId)).toBe(true);
		const entry = tracker.getEntry(stepId);
		expect(entry?.status).toBe("completed");
		expect(entry?.result?.status).toBe("success");
		expect(entry?.result?.result).toBe("done");
		expect(completedEvents).toHaveLength(1);
		expect(completedEvents[0].stepId).toBe("step-complete");
	});

	it("handles errors and emits failed notification", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("ok")])]);

		const failedEvents: Array<{ stepId: string; error: string }> = [];
		notifier.on("failed", (event) => {
			failedEvents.push(event);
		});

		const stepId = callAgentAsync({
			manager,
			factory,
			config: makeConfig("worker-5"),
			request: makeRequest({ stepId: "step-error" }),
			tracker,
			notifier,
			timeoutMs: 1,
		});

		await vi.advanceTimersByTimeAsync(100);

		const entry = tracker.getEntry(stepId);
		expect(entry).toBeDefined();
		expect(entry?.status).toBeDefined();
	});

	it("blocks calling the orchestrator agent", () => {
		expect(() =>
			callAgentAsync({
				manager,
				factory,
				config: makeConfig("orchestrator"),
				request: makeRequest(),
				tracker,
				notifier,
			}),
		).toThrow("Cannot call the orchestrator agent directly");
	});

	it("disposes the agent instance after completion", async () => {
		faux.setResponses([fauxAssistantMessage([fauxText("done")])]);

		callAgentAsync({
			manager,
			factory,
			config: makeConfig("disposable"),
			request: makeRequest({ stepId: "step-dispose" }),
			tracker,
			notifier,
		});

		await vi.advanceTimersByTimeAsync(100);

		expect(manager.getInstance("disposable")).toBeUndefined();
		expect(manager.activeCount).toBe(0);
	});
});

describe("CompletionTracker", () => {
	let tracker: CompletionTracker;

	beforeEach(() => {
		tracker = new CompletionTracker();
	});

	it("registers and retrieves entries", () => {
		tracker.register("s1", "session-1");
		const entry = tracker.getEntry("s1");
		expect(entry?.stepId).toBe("s1");
		expect(entry?.sessionId).toBe("session-1");
		expect(entry?.status).toBe("pending");
	});

	it("throws on duplicate registration", () => {
		tracker.register("s1", "session-1");
		expect(() => tracker.register("s1", "session-2")).toThrow("already registered");
	});

	it("marks entries as completed", () => {
		tracker.register("s1", "session-1");
		tracker.complete("s1", { from: "session-1", stepId: "s1", status: "success", result: "ok" });

		expect(tracker.isComplete("s1")).toBe(true);
		expect(tracker.isPending("s1")).toBe(false);
		expect(tracker.getEntry("s1")?.result?.result).toBe("ok");
	});

	it("marks entries as failed", () => {
		tracker.register("s1", "session-1");
		tracker.fail("s1", "boom");

		expect(tracker.isComplete("s1")).toBe(true);
		expect(tracker.getEntry("s1")?.status).toBe("failed");
		expect(tracker.getEntry("s1")?.error).toBe("boom");
	});

	it("marks entries as timed out", () => {
		tracker.register("s1", "session-1");
		tracker.timeout("s1");

		expect(tracker.isComplete("s1")).toBe(true);
		expect(tracker.getEntry("s1")?.status).toBe("timeout");
	});

	it("returns pending stepIds", () => {
		tracker.register("s1", "a");
		tracker.register("s2", "b");
		tracker.complete("s1", { from: "a", stepId: "s1", status: "success" });

		expect(tracker.getPending()).toEqual(["s2"]);
	});

	it("returns entries by status", () => {
		tracker.register("s1", "a");
		tracker.register("s2", "b");
		tracker.register("s3", "c");
		tracker.complete("s1", { from: "a", stepId: "s1", status: "success" });
		tracker.fail("s2", "err");

		expect(tracker.getByStatus("completed")).toEqual(["s1"]);
		expect(tracker.getByStatus("failed")).toEqual(["s2"]);
		expect(tracker.getByStatus("pending")).toEqual(["s3"]);
	});

	it("removes entries", () => {
		tracker.register("s1", "a");
		expect(tracker.remove("s1")).toBe(true);
		expect(tracker.getEntry("s1")).toBeUndefined();
		expect(tracker.size).toBe(0);
	});

	it("clears all entries", () => {
		tracker.register("s1", "a");
		tracker.register("s2", "b");
		tracker.clear();
		expect(tracker.size).toBe(0);
	});
});

describe("AsyncCallNotifier", () => {
	let notifier: AsyncCallNotifier;

	beforeEach(() => {
		notifier = new AsyncCallNotifier();
	});

	afterEach(() => {
		notifier.removeAllListeners();
	});

	it("emits and receives completed events", () => {
		let received: { stepId: string } | undefined;
		notifier.on("completed", (event) => {
			received = event;
		});

		notifier.emitCompleted({
			stepId: "s1",
			sessionId: "session-1",
			response: { from: "session-1", status: "success" },
		});

		expect(received?.stepId).toBe("s1");
	});

	it("emits and receives failed events", () => {
		let received: { stepId: string; error: string } | undefined;
		notifier.on("failed", (event) => {
			received = event;
		});

		notifier.emitFailed({ stepId: "s2", sessionId: "session-2", error: "oops" });

		expect(received?.stepId).toBe("s2");
		expect(received?.error).toBe("oops");
	});

	it("emits and receives timedOut events", () => {
		let received: { stepId: string } | undefined;
		notifier.on("timedOut", (event) => {
			received = event;
		});

		notifier.emitTimedOut({ stepId: "s3", sessionId: "session-3" });

		expect(received?.stepId).toBe("s3");
	});

	it("unsubscribes via returned function", () => {
		let count = 0;
		const unsub = notifier.on("completed", () => {
			count++;
		});

		notifier.emitCompleted({ stepId: "s1", sessionId: "a", response: { from: "a", status: "success" } });
		unsub();
		notifier.emitCompleted({ stepId: "s2", sessionId: "b", response: { from: "b", status: "success" } });

		expect(count).toBe(1);
	});

	it("supports once listeners", () => {
		let count = 0;
		notifier.once("completed", () => {
			count++;
		});

		notifier.emitCompleted({ stepId: "s1", sessionId: "a", response: { from: "a", status: "success" } });
		notifier.emitCompleted({ stepId: "s2", sessionId: "b", response: { from: "b", status: "success" } });

		expect(count).toBe(1);
	});
});

describe("AsyncPoller", () => {
	let tracker: CompletionTracker;
	let notifier: AsyncCallNotifier;

	beforeEach(() => {
		vi.useFakeTimers();
		tracker = new CompletionTracker();
		notifier = new AsyncCallNotifier();
	});

	afterEach(() => {
		notifier.removeAllListeners();
		tracker.clear();
		vi.useRealTimers();
	});

	it("starts and stops polling", () => {
		const poller = new AsyncPoller({ tracker, notifier });
		expect(poller.isRunning).toBe(false);

		poller.start();
		expect(poller.isRunning).toBe(true);

		poller.stop();
		expect(poller.isRunning).toBe(false);
	});

	it("does not start twice", () => {
		const poller = new AsyncPoller({ tracker, notifier });
		poller.start();
		poller.start();
		expect(poller.isRunning).toBe(true);
		poller.stop();
	});

	it("times out pending calls that exceed the deadline", () => {
		const timedOutEvents: Array<{ stepId: string }> = [];
		notifier.on("timedOut", (event) => timedOutEvents.push(event));

		tracker.register("s1", "session-1");

		const poller = new AsyncPoller({
			tracker,
			notifier,
			pollingIntervalMs: 1000,
			defaultTimeoutMs: 5000,
		});

		poller.start();

		vi.advanceTimersByTime(5000);
		poller.checkTimeouts();

		expect(tracker.getEntry("s1")?.status).toBe("timeout");
		expect(timedOutEvents).toHaveLength(1);
		expect(timedOutEvents[0].stepId).toBe("s1");

		poller.stop();
	});

	it("does not time out calls within the deadline", () => {
		tracker.register("s1", "session-1");

		const poller = new AsyncPoller({
			tracker,
			notifier,
			pollingIntervalMs: 1000,
			defaultTimeoutMs: 5000,
		});

		poller.start();

		vi.advanceTimersByTime(3000);
		poller.checkTimeouts();

		expect(tracker.isPending("s1")).toBe(true);

		poller.stop();
	});

	it("does not time out already completed calls", () => {
		tracker.register("s1", "session-1");
		tracker.complete("s1", { from: "session-1", stepId: "s1", status: "success" });

		const poller = new AsyncPoller({
			tracker,
			notifier,
			pollingIntervalMs: 1000,
			defaultTimeoutMs: 1,
		});

		poller.start();
		vi.advanceTimersByTime(1000);
		poller.checkTimeouts();

		expect(tracker.getEntry("s1")?.status).toBe("completed");

		poller.stop();
	});

	it("fires periodic checks on the interval", () => {
		tracker.register("s1", "session-1");

		const timedOutEvents: Array<{ stepId: string }> = [];
		notifier.on("timedOut", (event) => timedOutEvents.push(event));

		const poller = new AsyncPoller({
			tracker,
			notifier,
			pollingIntervalMs: 1000,
			defaultTimeoutMs: 3000,
		});

		poller.start();

		vi.advanceTimersByTime(3000);

		expect(timedOutEvents).toHaveLength(1);

		poller.stop();
	});
});

describe("waitForCompletion", () => {
	let tracker: CompletionTracker;
	let notifier: AsyncCallNotifier;

	beforeEach(() => {
		vi.useFakeTimers();
		tracker = new CompletionTracker();
		notifier = new AsyncCallNotifier();
	});

	afterEach(() => {
		notifier.removeAllListeners();
		tracker.clear();
		vi.useRealTimers();
	});

	it("resolves immediately if all steps already complete", async () => {
		tracker.register("s1", "a");
		tracker.complete("s1", { from: "a", stepId: "s1", status: "success" });

		const result = await waitForCompletion(["s1"], tracker, notifier);
		expect(result).toHaveLength(1);
		expect(result[0].status).toBe("completed");
	});

	it("resolves when all steps complete via notification", async () => {
		tracker.register("s1", "a");
		tracker.register("s2", "b");

		const promise = waitForCompletion(["s1", "s2"], tracker, notifier, { timeoutMs: 10_000 });

		await vi.advanceTimersByTimeAsync(10);

		tracker.complete("s1", { from: "a", stepId: "s1", status: "success" });
		notifier.emitCompleted({ stepId: "s1", sessionId: "a", response: { from: "a", status: "success" } });

		await vi.advanceTimersByTimeAsync(10);

		tracker.complete("s2", { from: "b", stepId: "s2", status: "success" });
		notifier.emitCompleted({ stepId: "s2", sessionId: "b", response: { from: "b", status: "success" } });

		await vi.advanceTimersByTimeAsync(10);

		const result = await promise;
		expect(result).toHaveLength(2);
		expect(result.every((e) => e.status === "completed")).toBe(true);
	});

	it("resolves when steps fail", async () => {
		tracker.register("s1", "a");

		const promise = waitForCompletion(["s1"], tracker, notifier, { timeoutMs: 10_000 });

		await vi.advanceTimersByTimeAsync(10);

		tracker.fail("s1", "boom");
		notifier.emitFailed({ stepId: "s1", sessionId: "a", error: "boom" });

		await vi.advanceTimersByTimeAsync(10);

		const result = await promise;
		expect(result).toHaveLength(1);
		expect(result[0].status).toBe("failed");
	});

	it("resolves when steps time out", async () => {
		tracker.register("s1", "a");

		const promise = waitForCompletion(["s1"], tracker, notifier, { timeoutMs: 10_000 });

		await vi.advanceTimersByTimeAsync(10);

		tracker.timeout("s1");
		notifier.emitTimedOut({ stepId: "s1", sessionId: "a" });

		await vi.advanceTimersByTimeAsync(10);

		const result = await promise;
		expect(result).toHaveLength(1);
		expect(result[0].status).toBe("timeout");
	});

	it("rejects on overall timeout", async () => {
		tracker.register("s1", "a");

		const promise = waitForCompletion(["s1"], tracker, notifier, { timeoutMs: 5000 });

		vi.advanceTimersByTime(5000);

		await expect(promise).rejects.toThrow("waitForCompletion timed out after 5000ms");
	});

	it("handles mixed completed and pending steps", async () => {
		tracker.register("s1", "a");
		tracker.register("s2", "b");
		tracker.complete("s1", { from: "a", stepId: "s1", status: "success" });

		const promise = waitForCompletion(["s1", "s2"], tracker, notifier, { timeoutMs: 10_000 });

		await vi.advanceTimersByTimeAsync(10);

		tracker.complete("s2", { from: "b", stepId: "s2", status: "success" });
		notifier.emitCompleted({ stepId: "s2", sessionId: "b", response: { from: "b", status: "success" } });

		await vi.advanceTimersByTimeAsync(10);

		const result = await promise;
		expect(result).toHaveLength(2);
	});

	it("returns empty array for empty stepIds", async () => {
		const result = await waitForCompletion([], tracker, notifier);
		expect(result).toEqual([]);
	});
});
