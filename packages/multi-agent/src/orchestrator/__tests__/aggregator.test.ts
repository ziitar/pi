import { describe, expect, it } from "vitest";
import type { AgentResult } from "../../execution/types.ts";
import { aggregateResults } from "../aggregator.ts";
import type { PlanExecutionResult, StepResult } from "../executor.ts";
import type { ExecutionPlan, PlanStep } from "../plan-types.ts";

function makeStep(id: string, agentName = "agent"): PlanStep {
	return { id, task: `task-${id}`, agentName, mode: "sync", dependencies: [] };
}

function makePlan(steps: PlanStep[]): ExecutionPlan {
	return {
		steps,
		phases: [{ index: 0, steps }],
		isSimple: steps.length === 1,
		input: { task: "test task", category: "coding", confidence: 0.9 },
		dependencies: [],
	};
}

function makeResult(agentName: string, status: "completed" | "failed" = "completed", duration = 100): AgentResult {
	return {
		agentName,
		category: "coding",
		model: "test-model",
		messages: [],
		status,
		duration,
	};
}

function makeStepResult(step: PlanStep, result: AgentResult): StepResult {
	return { step, result };
}

describe("aggregateResults", () => {
	it("uses the first completed result as primary", () => {
		const s1 = makeStep("s1", "agent-a");
		const s2 = makeStep("s2", "agent-b");
		const plan = makePlan([s1, s2]);

		const r1 = makeResult("agent-a", "completed");
		const r2 = makeResult("agent-b", "completed");

		const execution: PlanExecutionResult = {
			stepResults: [makeStepResult(s1, r1), makeStepResult(s2, r2)],
			totalDuration: 200,
			failureCount: 0,
			successCount: 2,
		};

		const result = aggregateResults(execution, plan);

		expect(result.primary).toBe(r1);
		expect(result.secondaries).toHaveLength(1);
		expect(result.secondaries[0]).toBe(r2);
	});

	it("uses a failed result as primary if no completed results exist", () => {
		const s1 = makeStep("s1", "agent-a");
		const plan = makePlan([s1]);

		const r1 = makeResult("agent-a", "failed");

		const execution: PlanExecutionResult = {
			stepResults: [makeStepResult(s1, r1)],
			totalDuration: 50,
			failureCount: 1,
			successCount: 0,
		};

		const result = aggregateResults(execution, plan);

		expect(result.primary).toBe(r1);
		expect(result.secondaries).toHaveLength(0);
	});

	it("creates a synthetic primary when no steps were executed", () => {
		const s1 = makeStep("s1", "agent-a");
		const plan = makePlan([s1]);

		const execution: PlanExecutionResult = {
			stepResults: [],
			totalDuration: 0,
			failureCount: 0,
			successCount: 0,
		};

		const result = aggregateResults(execution, plan);

		expect(result.primary.status).toBe("failed");
		expect(result.primary.error).toBe("No steps were executed");
		expect(result.secondaries).toHaveLength(0);
	});

	it("includes the plan in the result", () => {
		const s1 = makeStep("s1");
		const plan = makePlan([s1]);

		const execution: PlanExecutionResult = {
			stepResults: [makeStepResult(s1, makeResult("agent"))],
			totalDuration: 100,
			failureCount: 0,
			successCount: 1,
		};

		const result = aggregateResults(execution, plan);

		expect(result.plan).toBe(plan);
	});

	it("includes total duration from execution", () => {
		const s1 = makeStep("s1");
		const plan = makePlan([s1]);

		const execution: PlanExecutionResult = {
			stepResults: [makeStepResult(s1, makeResult("agent"))],
			totalDuration: 42,
			failureCount: 0,
			successCount: 1,
		};

		const result = aggregateResults(execution, plan);

		expect(result.totalDuration).toBe(42);
	});

	it("includes all step results", () => {
		const s1 = makeStep("s1", "a");
		const s2 = makeStep("s2", "b");
		const s3 = makeStep("s3", "c");
		const plan = makePlan([s1, s2, s3]);

		const sr1 = makeStepResult(s1, makeResult("a"));
		const sr2 = makeStepResult(s2, makeResult("b"));
		const sr3 = makeStepResult(s3, makeResult("c", "failed"));

		const execution: PlanExecutionResult = {
			stepResults: [sr1, sr2, sr3],
			totalDuration: 300,
			failureCount: 1,
			successCount: 2,
		};

		const result = aggregateResults(execution, plan);

		expect(result.stepResults).toHaveLength(3);
		expect(result.stepResults).toEqual([sr1, sr2, sr3]);
	});

	it("assigns remaining results as secondaries", () => {
		const steps = [makeStep("s1", "a"), makeStep("s2", "b"), makeStep("s3", "c"), makeStep("s4", "d")];
		const plan = makePlan(steps);

		const results = steps.map((s) => makeResult(s.agentName));
		const stepResults = steps.map((s, i) => makeStepResult(s, results[i]));

		const execution: PlanExecutionResult = {
			stepResults,
			totalDuration: 400,
			failureCount: 0,
			successCount: 4,
		};

		const agg = aggregateResults(execution, plan);

		expect(agg.primary).toBe(results[0]);
		expect(agg.secondaries).toHaveLength(3);
		expect(agg.secondaries).toEqual([results[1], results[2], results[3]]);
	});

	it("picks the first completed result as primary even if earlier steps failed", () => {
		const s1 = makeStep("s1", "a");
		const s2 = makeStep("s2", "b");
		const plan = makePlan([s1, s2]);

		const r1 = makeResult("a", "failed");
		const r2 = makeResult("b", "completed");

		const execution: PlanExecutionResult = {
			stepResults: [makeStepResult(s1, r1), makeStepResult(s2, r2)],
			totalDuration: 150,
			failureCount: 1,
			successCount: 1,
		};

		const result = aggregateResults(execution, plan);

		expect(result.primary).toBe(r2);
		expect(result.secondaries).toHaveLength(1);
		expect(result.secondaries[0]).toBe(r1);
	});
});
