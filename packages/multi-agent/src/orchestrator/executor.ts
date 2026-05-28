import type { AgentResult } from "../execution/types.ts";
import type { ExecutionPhase, ExecutionPlan, PlanStep } from "./plan-types.ts";

export type StepExecutor = (step: PlanStep) => Promise<AgentResult>;

export interface StepResult {
	step: PlanStep;
	result: AgentResult;
}

export interface PlanExecutionResult {
	stepResults: StepResult[];
	totalDuration: number;
	failureCount: number;
	successCount: number;
}

export async function executePlan(plan: ExecutionPlan, executeStep: StepExecutor): Promise<PlanExecutionResult> {
	const startTime = Date.now();
	const allStepResults: StepResult[] = [];

	for (const phase of plan.phases) {
		const phaseResults = await executePhase(phase, executeStep);
		allStepResults.push(...phaseResults);
	}

	const totalDuration = Date.now() - startTime;
	const failureCount = allStepResults.filter((sr) => sr.result.status === "failed").length;
	const successCount = allStepResults.filter((sr) => sr.result.status === "completed").length;

	return {
		stepResults: allStepResults,
		totalDuration,
		failureCount,
		successCount,
	};
}

async function executePhase(phase: ExecutionPhase, executeStep: StepExecutor): Promise<StepResult[]> {
	const promises = phase.steps.map(async (step) => {
		try {
			const result = await executeStep(step);
			return { step, result };
		} catch (error) {
			const failedResult: AgentResult = {
				agentName: step.agentName,
				category: "unknown",
				model: "unknown",
				messages: [],
				status: "failed",
				duration: 0,
				error: error instanceof Error ? error.message : "Unknown execution error",
			};
			return { step, result: failedResult };
		}
	});

	const settled = await Promise.allSettled(promises);

	return settled.map((outcome, index) => {
		if (outcome.status === "fulfilled") {
			return outcome.value;
		}

		const step = phase.steps[index];
		return {
			step,
			result: {
				agentName: step.agentName,
				category: "unknown",
				model: "unknown",
				messages: [],
				status: "failed" as const,
				duration: 0,
				error: outcome.reason instanceof Error ? outcome.reason.message : "Unknown rejection",
			},
		};
	});
}
