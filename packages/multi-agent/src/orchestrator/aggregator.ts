import type { AgentResult } from "../execution/types.ts";
import type { PlanExecutionResult, StepResult } from "./executor.ts";
import type { ExecutionPlan } from "./plan-types.ts";

export interface OrchestrationResult {
	primary: AgentResult;
	secondaries: AgentResult[];
	plan: ExecutionPlan;
	totalDuration: number;
	stepResults: StepResult[];
}

export function aggregateResults(executionResult: PlanExecutionResult, plan: ExecutionPlan): OrchestrationResult {
	const { stepResults, totalDuration } = executionResult;

	const primary = findPrimaryResult(stepResults, plan);
	const secondaries = findSecondaryResults(stepResults, primary);

	return {
		primary,
		secondaries,
		plan,
		totalDuration,
		stepResults,
	};
}

function findPrimaryResult(stepResults: StepResult[], plan: ExecutionPlan): AgentResult {
	const completedResults = stepResults.filter((sr) => sr.result.status === "completed");

	if (completedResults.length > 0) {
		return completedResults[0].result;
	}

	if (stepResults.length > 0) {
		return stepResults[0].result;
	}

	return {
		agentName: plan.steps[0]?.agentName ?? "unknown",
		category: plan.input.category,
		model: "unknown",
		messages: [],
		status: "failed",
		duration: 0,
		error: "No steps were executed",
	};
}

function findSecondaryResults(stepResults: StepResult[], primary: AgentResult): AgentResult[] {
	return stepResults.filter((sr) => sr.result !== primary).map((sr) => sr.result);
}
