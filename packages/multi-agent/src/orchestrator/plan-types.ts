/**
 * Planning Types
 *
 * Types for the static planner that decomposes tasks into executable steps.
 */

import type { CommunicationMode } from "../communication/protocol.ts";

/** A single step in an execution plan. */
export interface PlanStep {
	/** Unique step identifier (e.g., "step-1", "step-2a"). */
	id: string;
	/** Task description for this step. */
	task: string;
	/** Name of the agent assigned to execute this step. */
	agentName: string;
	/** Communication mode: "sync" (wait) or "async" (fire-and-forget). */
	mode: CommunicationMode;
	/** IDs of steps that must complete before this step can start. */
	dependencies: string[];
	/** Optional step ID for tracking in the communication protocol. */
	stepId?: string;
}

/** A dependency relationship between two steps. */
export interface StepDependency {
	/** The step that produces a result (must run first). */
	from: string;
	/** The step that consumes the result (runs after `from`). */
	to: string;
	/** Type of dependency. */
	type: DependencyType;
}

/** Type of dependency between steps. */
export type DependencyType = "data" | "order" | "resource";

/** Input for the planner. */
export interface TaskInput {
	/** The task description to plan for. */
	task: string;
	/** Classification category for the task. */
	category: string;
	/** Confidence of the classification (0-1). */
	confidence: number;
}

/** A phase groups steps that can execute in parallel. */
export interface ExecutionPhase {
	/** Phase index (0-based). */
	index: number;
	/** Steps in this phase that can run in parallel. */
	steps: PlanStep[];
}

/** The complete execution plan produced by the planner. */
export interface ExecutionPlan {
	/** All steps in execution order. */
	steps: PlanStep[];
	/** Steps grouped into phases by dependency level (parallel execution groups). */
	phases: ExecutionPhase[];
	/** Whether this is a simple task that can be handled directly (single step). */
	isSimple: boolean;
	/** The original task input. */
	input: TaskInput;
	/** Dependencies between steps. */
	dependencies: StepDependency[];
}
