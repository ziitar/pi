import { describe, expect, it } from "vitest";
import { buildClassifierPrompt } from "../prompt-builder.ts";

describe("buildClassifierPrompt", () => {
	it("includes all provided categories", () => {
		const prompt = buildClassifierPrompt(["coding", "architecture", "review"]);
		expect(prompt).toContain("- coding:");
		expect(prompt).toContain("- architecture:");
		expect(prompt).toContain("- review:");
	});

	it("uses known descriptions for recognized categories", () => {
		const prompt = buildClassifierPrompt(["coding"]);
		expect(prompt).toContain("Writing, fixing, or explaining code");
	});

	it("uses category name as description for unknown categories", () => {
		const prompt = buildClassifierPrompt(["custom-agent-task"]);
		expect(prompt).toContain("- custom-agent-task: custom-agent-task");
	});

	it("includes output format instructions", () => {
		const prompt = buildClassifierPrompt(["coding"]);
		expect(prompt).toContain('"category"');
		expect(prompt).toContain('"confidence"');
	});

	it("includes rules section", () => {
		const prompt = buildClassifierPrompt(["coding"]);
		expect(prompt).toContain("## Rules");
		expect(prompt).toContain("ONLY a JSON object");
	});

	it("generates different prompts for different category sets", () => {
		const prompt1 = buildClassifierPrompt(["coding", "review"]);
		const prompt2 = buildClassifierPrompt(["design", "testing"]);
		expect(prompt1).not.toBe(prompt2);
		expect(prompt1).toContain("review");
		expect(prompt2).toContain("design");
	});

	it("handles single category", () => {
		const prompt = buildClassifierPrompt(["fast"]);
		expect(prompt).toContain("- fast:");
		expect(prompt).toContain("Simple questions");
	});

	it("handles empty categories array", () => {
		const prompt = buildClassifierPrompt([]);
		expect(prompt).toContain("## Categories");
		expect(prompt).toContain("## Rules");
	});

	it("includes dynamic categories from registry-style agent configs", () => {
		const categories = ["coding", "debug", "refactor"];
		const prompt = buildClassifierPrompt(categories);
		expect(prompt).toContain("- coding:");
		expect(prompt).toContain("- debug:");
		expect(prompt).toContain("- refactor:");
	});

	it("preserves category order", () => {
		const prompt = buildClassifierPrompt(["alpha", "beta", "gamma"]);
		const alphaIdx = prompt.indexOf("- alpha:");
		const betaIdx = prompt.indexOf("- beta:");
		const gammaIdx = prompt.indexOf("- gamma:");
		expect(alphaIdx).toBeLessThan(betaIdx);
		expect(betaIdx).toBeLessThan(gammaIdx);
	});
});
