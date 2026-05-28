import type { AgentRegistryEntry } from "../registry/types.ts";
import { analyzeDependencies } from "./dependency.ts";
import type { ExecutionPlan, PlanStep, TaskInput } from "./plan-types.ts";

const SIMPLE_TASK_MAX_LENGTH = 100;
const SIMPLE_TASK_MIN_CONFIDENCE = 0.7;

/**
 * Static planner: decomposes a task into an ExecutionPlan.
 *
 * Simple tasks (short, high-confidence single category) get a single step.
 * Complex tasks are decomposed using keyword heuristics into multi-step plans.
 */
export function planTask(input: TaskInput, agents: AgentRegistryEntry[]): ExecutionPlan {
	if (isSimpleTask(input)) {
		return buildSimplePlan(input, agents);
	}
	return buildComplexPlan(input, agents);
}

function isSimpleTask(input: TaskInput): boolean {
	return (
		input.task.length <= SIMPLE_TASK_MAX_LENGTH &&
		input.confidence >= SIMPLE_TASK_MIN_CONFIDENCE &&
		!hasSequencingKeywords(input.task)
	);
}

function hasSequencingKeywords(task: string): boolean {
	const keywords = [
		/\bfirst\b/i,
		/\bthen\b/i,
		/\bafter\b/i,
		/\bbefore\b/i,
		/\bfinally\b/i,
		/\bstep\s*\d/i,
		/\band\s+then\b/i,
	];
	return keywords.some((re) => re.test(task));
}

function buildSimplePlan(input: TaskInput, agents: AgentRegistryEntry[]): ExecutionPlan {
	const agent = findBestAgent(input.category, agents);
	const step: PlanStep = {
		id: "step-1",
		task: input.task,
		agentName: agent?.name ?? "default",
		mode: "sync",
		dependencies: [],
		stepId: "step-1",
	};

	const { phases, dependencies } = analyzeDependencies([step]);
	return { steps: [step], phases, isSimple: true, input, dependencies };
}

function buildComplexPlan(input: TaskInput, agents: AgentRegistryEntry[]): ExecutionPlan {
	const subtasks = decomposeTask(input.task);
	const steps: PlanStep[] = subtasks.map((sub, i) => {
		const agent = findBestAgent(sub.category ?? input.category, agents);
		return {
			id: `step-${i + 1}`,
			task: sub.description,
			agentName: agent?.name ?? "default",
			mode: sub.blocking ? "sync" : "async",
			dependencies: sub.dependsOn,
			stepId: `step-${i + 1}`,
		};
	});

	const { phases, dependencies } = analyzeDependencies(steps);
	return { steps, phases, isSimple: false, input, dependencies };
}

interface Subtask {
	description: string;
	category?: string;
	dependsOn: string[];
	blocking: boolean;
}

function decomposeTask(task: string): Subtask[] {
	const segments = splitBySequencingKeywords(task);
	if (segments.length <= 1) {
		return [{ description: task, dependsOn: [], blocking: true }];
	}

	return segments.map((seg, i) => ({
		description: seg.text,
		dependsOn: i > 0 ? [`step-${i}`] : [],
		blocking: i < segments.length - 1,
	}));
}

interface Segment {
	text: string;
}

function splitBySequencingKeywords(task: string): Segment[] {
	const parts = task.split(/\b(?:first|then|after that|finally|and then)\b[,:;\s]*/i);
	return parts.map((p) => ({ text: p.trim() })).filter((s) => s.text.length > 0);
}

function findBestAgent(category: string, agents: AgentRegistryEntry[]): AgentRegistryEntry | undefined {
	const matching = agents.filter((a) => a.categories.includes(category) && a.status === "active");
	if (matching.length > 0) return matching[0];

	const partial = agents.filter(
		(a) => a.status === "active" && a.categories.some((c) => c.includes(category) || category.includes(c)),
	);
	if (partial.length > 0) return partial[0];

	return agents.find((a) => a.status === "active");
}
