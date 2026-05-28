import { describe, expect, it } from "vitest";
import type { AgentRegistryEntry } from "../../registry/types.ts";
import { analyzeDependencies } from "../dependency.ts";
import type { PlanStep, TaskInput } from "../plan-types.ts";
import { planTask } from "../planner.ts";

function makeAgent(name: string, categories: string[], status: "active" | "inactive" = "active"): AgentRegistryEntry {
	return { name, categories, model: "auto", status };
}

function makeInput(task: string, category = "coding", confidence = 0.9): TaskInput {
	return { task, category, confidence };
}

describe("planner", () => {
	const agents: AgentRegistryEntry[] = [
		makeAgent("coder", ["coding"]),
		makeAgent("researcher", ["research"]),
		makeAgent("reviewer", ["review"]),
		makeAgent("writer", ["writing"]),
	];

	describe("simple task detection", () => {
		it("treats short high-confidence tasks as simple", () => {
			const plan = planTask(makeInput("Fix the login bug"), agents);
			expect(plan.isSimple).toBe(true);
			expect(plan.steps).toHaveLength(1);
			expect(plan.steps[0].task).toBe("Fix the login bug");
		});

		it("treats tasks with low confidence as complex", () => {
			const plan = planTask(makeInput("Fix the login bug", "coding", 0.5), agents);
			expect(plan.isSimple).toBe(false);
		});

		it("treats long tasks as complex", () => {
			const longTask = "A".repeat(101);
			const plan = planTask(makeInput(longTask), agents);
			expect(plan.isSimple).toBe(false);
		});

		it("treats tasks with sequencing keywords as complex", () => {
			const plan = planTask(makeInput("First fix the bug then write tests", "coding", 0.9), agents);
			expect(plan.isSimple).toBe(false);
		});

		it("handles empty task string", () => {
			const plan = planTask(makeInput(""), agents);
			expect(plan.isSimple).toBe(true);
			expect(plan.steps).toHaveLength(1);
		});
	});

	describe("simple plan construction", () => {
		it("assigns the matching agent for simple tasks", () => {
			const plan = planTask(makeInput("Fix the bug"), agents);
			expect(plan.steps[0].agentName).toBe("coder");
		});

		it("uses sync mode for simple tasks", () => {
			const plan = planTask(makeInput("Fix the bug"), agents);
			expect(plan.steps[0].mode).toBe("sync");
		});

		it("falls back to first active agent when no category match", () => {
			const plan = planTask(makeInput("Do something", "unknown"), agents);
			expect(plan.steps[0].agentName).toBe("coder");
		});

		it("uses first active agent as fallback", () => {
			const plan = planTask(makeInput("Do something", "unknown"), [makeAgent("a", ["x"])]);
			expect(plan.steps[0].agentName).toBe("a");
		});

		it("skips inactive agents", () => {
			const plan = planTask(makeInput("Fix the bug"), [makeAgent("coder", ["coding"], "inactive")]);
			expect(plan.steps[0].agentName).toBe("default");
		});
	});

	describe("complex plan decomposition", () => {
		it("decomposes tasks with 'then' keyword", () => {
			const plan = planTask(makeInput("Research the API then write the client"), agents);
			expect(plan.isSimple).toBe(false);
			expect(plan.steps.length).toBeGreaterThanOrEqual(2);
		});

		it("decomposes tasks with 'first' keyword", () => {
			const plan = planTask(makeInput("First analyze the code then refactor it"), agents);
			expect(plan.isSimple).toBe(false);
			expect(plan.steps.length).toBeGreaterThanOrEqual(2);
		});

		it("creates dependencies between sequential steps", () => {
			const plan = planTask(makeInput("Research the API then write the client"), agents);
			if (plan.steps.length >= 2) {
				expect(plan.steps[1].dependencies).toContain(plan.steps[0].id);
			}
		});

		it("assigns agents to each step", () => {
			const plan = planTask(makeInput("Research the API then write the client"), agents);
			for (const step of plan.steps) {
				expect(step.agentName).toBeTruthy();
			}
		});

		it("sets blocking steps to sync mode", () => {
			const plan = planTask(makeInput("First analyze then write"), agents);
			if (plan.steps.length >= 2) {
				expect(plan.steps[0].mode).toBe("sync");
			}
		});
	});

	describe("plan structure", () => {
		it("includes the original input", () => {
			const input = makeInput("Fix the bug");
			const plan = planTask(input, agents);
			expect(plan.input).toBe(input);
		});

		it("generates unique step IDs", () => {
			const plan = planTask(makeInput("First research then write then review"), agents);
			const ids = plan.steps.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		it("creates phases for the plan", () => {
			const plan = planTask(makeInput("Fix the bug"), agents);
			expect(plan.phases.length).toBeGreaterThanOrEqual(1);
		});

		it("populates dependencies array", () => {
			const plan = planTask(makeInput("Research then write"), agents);
			if (plan.steps.length >= 2) {
				expect(plan.dependencies.length).toBeGreaterThanOrEqual(1);
			}
		});
	});
});

describe("analyzeDependencies", () => {
	it("returns empty phases for no steps", () => {
		const result = analyzeDependencies([]);
		expect(result.phases).toEqual([]);
		expect(result.dependencies).toEqual([]);
	});

	it("puts a single step in one phase", () => {
		const step: PlanStep = { id: "s1", task: "x", agentName: "a", mode: "sync", dependencies: [] };
		const result = analyzeDependencies([step]);
		expect(result.phases).toHaveLength(1);
		expect(result.phases[0].steps).toHaveLength(1);
	});

	it("groups independent steps in the same phase", () => {
		const steps: PlanStep[] = [
			{ id: "s1", task: "a", agentName: "x", mode: "sync", dependencies: [] },
			{ id: "s2", task: "b", agentName: "y", mode: "sync", dependencies: [] },
			{ id: "s3", task: "c", agentName: "z", mode: "sync", dependencies: [] },
		];
		const result = analyzeDependencies(steps);
		expect(result.phases).toHaveLength(1);
		expect(result.phases[0].steps).toHaveLength(3);
	});

	it("separates dependent steps into different phases", () => {
		const steps: PlanStep[] = [
			{ id: "s1", task: "first", agentName: "a", mode: "sync", dependencies: [] },
			{ id: "s2", task: "second", agentName: "b", mode: "sync", dependencies: ["s1"] },
		];
		const result = analyzeDependencies(steps);
		expect(result.phases).toHaveLength(2);
		expect(result.phases[0].steps[0].id).toBe("s1");
		expect(result.phases[1].steps[0].id).toBe("s2");
	});

	it("handles diamond dependency pattern", () => {
		// s1 -> s2, s1 -> s3, s2 -> s4, s3 -> s4
		const steps: PlanStep[] = [
			{ id: "s1", task: "root", agentName: "a", mode: "sync", dependencies: [] },
			{ id: "s2", task: "left", agentName: "b", mode: "async", dependencies: ["s1"] },
			{ id: "s3", task: "right", agentName: "c", mode: "async", dependencies: ["s1"] },
			{ id: "s4", task: "merge", agentName: "d", mode: "sync", dependencies: ["s2", "s3"] },
		];
		const result = analyzeDependencies(steps);
		expect(result.phases).toHaveLength(3);
		expect(result.phases[0].steps.map((s) => s.id)).toEqual(["s1"]);
		expect(result.phases[1].steps.map((s) => s.id).sort()).toEqual(["s2", "s3"]);
		expect(result.phases[2].steps.map((s) => s.id)).toEqual(["s4"]);
	});

	it("extracts dependency relationships", () => {
		const steps: PlanStep[] = [
			{ id: "s1", task: "a", agentName: "x", mode: "sync", dependencies: [] },
			{ id: "s2", task: "b", agentName: "y", mode: "sync", dependencies: ["s1"] },
		];
		const result = analyzeDependencies(steps);
		expect(result.dependencies).toHaveLength(1);
		expect(result.dependencies[0]).toEqual({ from: "s1", to: "s2", type: "data" });
	});

	it("handles chain of three dependencies", () => {
		const steps: PlanStep[] = [
			{ id: "s1", task: "a", agentName: "x", mode: "sync", dependencies: [] },
			{ id: "s2", task: "b", agentName: "y", mode: "sync", dependencies: ["s1"] },
			{ id: "s3", task: "c", agentName: "z", mode: "sync", dependencies: ["s2"] },
		];
		const result = analyzeDependencies(steps);
		expect(result.phases).toHaveLength(3);
		expect(result.dependencies).toHaveLength(2);
	});

	it("assigns phase indices sequentially", () => {
		const steps: PlanStep[] = [
			{ id: "s1", task: "a", agentName: "x", mode: "sync", dependencies: [] },
			{ id: "s2", task: "b", agentName: "y", mode: "sync", dependencies: ["s1"] },
			{ id: "s3", task: "c", agentName: "z", mode: "sync", dependencies: ["s2"] },
		];
		const result = analyzeDependencies(steps);
		result.phases.forEach((phase, i) => {
			expect(phase.index).toBe(i);
		});
	});
});
