import { describe, expect, it } from "vitest";
import type { AgentResult } from "../../execution/types.ts";
import { executePlan, type StepExecutor } from "../executor.ts";
import type { ExecutionPlan, PlanStep } from "../plan-types.ts";

function makeStep(
	id: string,
	agentName = "agent",
	mode: "sync" | "async" = "sync",
	dependencies: string[] = [],
): PlanStep {
	return { id, task: `task-${id}`, agentName, mode, dependencies };
}

function makePlan(steps: PlanStep[], phases?: { index: number; steps: PlanStep[] }[]): ExecutionPlan {
	const effectivePhases = phases ?? [{ index: 0, steps }];
	return {
		steps,
		phases: effectivePhases,
		isSimple: steps.length === 1,
		input: { task: "test task", category: "coding", confidence: 0.9 },
		dependencies: [],
	};
}

function makeResult(agentName: string, status: "completed" | "failed" = "completed"): AgentResult {
	return {
		agentName,
		category: "coding",
		model: "test-model",
		messages: [],
		status,
		duration: 100,
	};
}

describe("executePlan", () => {
	it("executes a single-step plan", async () => {
		const step = makeStep("s1");
		const plan = makePlan([step]);
		const executor: StepExecutor = async () => makeResult("agent");

		const result = await executePlan(plan, executor);

		expect(result.stepResults).toHaveLength(1);
		expect(result.stepResults[0].step.id).toBe("s1");
		expect(result.stepResults[0].result.status).toBe("completed");
		expect(result.successCount).toBe(1);
		expect(result.failureCount).toBe(0);
	});

	it("executes multiple steps in the same phase in parallel", async () => {
		const executionOrder: string[] = [];
		const step1 = makeStep("s1");
		const step2 = makeStep("s2");
		const step3 = makeStep("s3");
		const plan = makePlan([step1, step2, step3]);

		const executor: StepExecutor = async (step) => {
			executionOrder.push(step.id);
			return makeResult(step.agentName);
		};

		const result = await executePlan(plan, executor);

		expect(result.stepResults).toHaveLength(3);
		expect(result.successCount).toBe(3);
		expect(executionOrder).toHaveLength(3);
	});

	it("executes phases sequentially", async () => {
		const executionOrder: string[] = [];
		const step1 = makeStep("s1");
		const step2 = makeStep("s2", "agent", "sync", ["s1"]);

		const plan: ExecutionPlan = {
			steps: [step1, step2],
			phases: [
				{ index: 0, steps: [step1] },
				{ index: 1, steps: [step2] },
			],
			isSimple: false,
			input: { task: "test", category: "coding", confidence: 0.9 },
			dependencies: [{ from: "s1", to: "s2", type: "data" }],
		};

		const executor: StepExecutor = async (step) => {
			executionOrder.push(`start-${step.id}`);
			if (step.id === "s2") {
				expect(executionOrder).toContain("start-s1");
			}
			executionOrder.push(`end-${step.id}`);
			return makeResult(step.agentName);
		};

		await executePlan(plan, executor);

		expect(executionOrder.indexOf("start-s1")).toBeLessThan(executionOrder.indexOf("start-s2"));
	});

	it("continues execution when a step fails", async () => {
		const step1 = makeStep("s1");
		const step2 = makeStep("s2");
		const plan = makePlan([step1, step2]);

		const executor: StepExecutor = async (step) => {
			if (step.id === "s1") {
				return makeResult("agent", "failed");
			}
			return makeResult("agent", "completed");
		};

		const result = await executePlan(plan, executor);

		expect(result.stepResults).toHaveLength(2);
		expect(result.failureCount).toBe(1);
		expect(result.successCount).toBe(1);
	});

	it("continues to next phase when a step in current phase fails", async () => {
		const step1 = makeStep("s1");
		const step2 = makeStep("s2", "agent", "sync", ["s1"]);

		const plan: ExecutionPlan = {
			steps: [step1, step2],
			phases: [
				{ index: 0, steps: [step1] },
				{ index: 1, steps: [step2] },
			],
			isSimple: false,
			input: { task: "test", category: "coding", confidence: 0.9 },
			dependencies: [{ from: "s1", to: "s2", type: "data" }],
		};

		const executedSteps: string[] = [];
		const executor: StepExecutor = async (step) => {
			executedSteps.push(step.id);
			if (step.id === "s1") {
				return makeResult("agent", "failed");
			}
			return makeResult("agent", "completed");
		};

		const result = await executePlan(plan, executor);

		expect(executedSteps).toContain("s1");
		expect(executedSteps).toContain("s2");
		expect(result.failureCount).toBe(1);
		expect(result.successCount).toBe(1);
	});

	it("handles executor throwing an error", async () => {
		const step = makeStep("s1");
		const plan = makePlan([step]);

		const executor: StepExecutor = async () => {
			throw new Error("executor exploded");
		};

		const result = await executePlan(plan, executor);

		expect(result.stepResults).toHaveLength(1);
		expect(result.stepResults[0].result.status).toBe("failed");
		expect(result.stepResults[0].result.error).toBe("executor exploded");
		expect(result.failureCount).toBe(1);
	});

	it("handles executor throwing a non-Error value", async () => {
		const step = makeStep("s1");
		const plan = makePlan([step]);

		const executor: StepExecutor = async () => {
			throw "string error";
		};

		const result = await executePlan(plan, executor);

		expect(result.stepResults[0].result.status).toBe("failed");
		expect(result.stepResults[0].result.error).toBe("Unknown execution error");
	});

	it("handles empty plan", async () => {
		const plan = makePlan([]);
		plan.phases = [];

		const executor: StepExecutor = async () => makeResult("agent");

		const result = await executePlan(plan, executor);

		expect(result.stepResults).toHaveLength(0);
		expect(result.successCount).toBe(0);
		expect(result.failureCount).toBe(0);
	});

	it("measures total duration", async () => {
		const step = makeStep("s1");
		const plan = makePlan([step]);

		const executor: StepExecutor = async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return makeResult("agent");
		};

		const result = await executePlan(plan, executor);

		expect(result.totalDuration).toBeGreaterThanOrEqual(5);
	});

	it("handles diamond dependency pattern", async () => {
		const s1 = makeStep("s1");
		const s2 = makeStep("s2", "agent", "async", ["s1"]);
		const s3 = makeStep("s3", "agent", "async", ["s1"]);
		const s4 = makeStep("s4", "agent", "sync", ["s2", "s3"]);

		const plan: ExecutionPlan = {
			steps: [s1, s2, s3, s4],
			phases: [
				{ index: 0, steps: [s1] },
				{ index: 1, steps: [s2, s3] },
				{ index: 2, steps: [s4] },
			],
			isSimple: false,
			input: { task: "diamond", category: "coding", confidence: 0.9 },
			dependencies: [
				{ from: "s1", to: "s2", type: "data" },
				{ from: "s1", to: "s3", type: "data" },
				{ from: "s2", to: "s4", type: "data" },
				{ from: "s3", to: "s4", type: "data" },
			],
		};

		const executionOrder: string[] = [];
		const executor: StepExecutor = async (step) => {
			executionOrder.push(step.id);
			return makeResult(step.agentName);
		};

		const result = await executePlan(plan, executor);

		expect(result.stepResults).toHaveLength(4);
		expect(result.successCount).toBe(4);
		expect(executionOrder.indexOf("s1")).toBeLessThan(executionOrder.indexOf("s2"));
		expect(executionOrder.indexOf("s1")).toBeLessThan(executionOrder.indexOf("s3"));
		expect(executionOrder.indexOf("s2")).toBeLessThan(executionOrder.indexOf("s4"));
		expect(executionOrder.indexOf("s3")).toBeLessThan(executionOrder.indexOf("s4"));
	});
});
