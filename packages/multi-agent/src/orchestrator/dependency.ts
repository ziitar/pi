import type { ExecutionPhase, PlanStep, StepDependency } from "./plan-types.ts";

/**
 * Analyzes dependencies between plan steps and groups them into execution phases.
 *
 * Uses topological sort (Kahn's algorithm) to determine execution order.
 * Steps in the same phase have no dependencies on each other and can run in parallel.
 */
export function analyzeDependencies(steps: PlanStep[]): {
	phases: ExecutionPhase[];
	dependencies: StepDependency[];
} {
	if (steps.length === 0) {
		return { phases: [], dependencies: [] };
	}

	const stepMap = new Map<string, PlanStep>();
	for (const step of steps) {
		stepMap.set(step.id, step);
	}

	const dependencies = extractDependencies(steps, stepMap);
	const phases = topologicalPhaseGrouping(steps, stepMap);

	return { phases, dependencies };
}

function extractDependencies(steps: PlanStep[], stepMap: Map<string, PlanStep>): StepDependency[] {
	const deps: StepDependency[] = [];
	for (const step of steps) {
		for (const depId of step.dependencies) {
			if (stepMap.has(depId)) {
				deps.push({ from: depId, to: step.id, type: "data" });
			}
		}
	}
	return deps;
}

/**
 * Kahn's algorithm adapted for phase grouping.
 * Assigns each step a "level" = longest path from any root to that node.
 * Steps with the same level form a parallel phase.
 */
function topologicalPhaseGrouping(steps: PlanStep[], stepMap: Map<string, PlanStep>): ExecutionPhase[] {
	const inDegree = new Map<string, number>();
	for (const step of steps) {
		inDegree.set(step.id, 0);
	}
	for (const step of steps) {
		for (const depId of step.dependencies) {
			if (stepMap.has(depId)) {
				inDegree.set(step.id, (inDegree.get(step.id) ?? 0) + 1);
			}
		}
	}

	const level = new Map<string, number>();
	for (const step of steps) {
		level.set(step.id, 0);
	}

	const queue: string[] = [];
	for (const step of steps) {
		if ((inDegree.get(step.id) ?? 0) === 0) {
			queue.push(step.id);
		}
	}

	while (queue.length > 0) {
		const currentId = queue.shift()!;
		const _currentStep = stepMap.get(currentId)!;

		for (const step of steps) {
			if (step.dependencies.includes(currentId)) {
				const newLevel = (level.get(currentId) ?? 0) + 1;
				level.set(step.id, Math.max(level.get(step.id) ?? 0, newLevel));
				inDegree.set(step.id, (inDegree.get(step.id) ?? 1) - 1);
				if ((inDegree.get(step.id) ?? 0) === 0) {
					queue.push(step.id);
				}
			}
		}
	}

	const phaseMap = new Map<number, PlanStep[]>();
	for (const step of steps) {
		const stepLevel = level.get(step.id) ?? 0;
		if (!phaseMap.has(stepLevel)) {
			phaseMap.set(stepLevel, []);
		}
		phaseMap.get(stepLevel)!.push(step);
	}

	const phases: ExecutionPhase[] = [];
	const sortedLevels = [...phaseMap.keys()].sort((a, b) => a - b);
	for (const lvl of sortedLevels) {
		phases.push({ index: phases.length, steps: phaseMap.get(lvl)! });
	}

	return phases;
}
