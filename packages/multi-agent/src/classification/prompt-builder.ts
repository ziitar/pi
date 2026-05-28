const CATEGORY_DESCRIPTIONS: Record<string, string> = {
	coding: "Writing, fixing, or explaining code. Programming tasks, implementing features, debugging.",
	architecture: "System design, architecture decisions, high-level planning, design patterns.",
	"code-review": "Reviewing, analyzing, or critiquing existing code. Finding bugs, suggesting improvements.",
	"writing-cn": "Chinese content creation, writing articles, stories, or documents in Chinese.",
	creative: "Creative writing, brainstorming, ideas, stories, poems, artistic content.",
	fast: "Simple questions, quick lookups, trivia, factual answers, translations.",
	debug: "Debugging, troubleshooting, diagnosing issues in code or systems.",
	refactor: "Refactoring, restructuring, improving code quality without changing behavior.",
	review: "Code review, pull request review, providing feedback on code changes.",
	security: "Security analysis, vulnerability assessment, security best practices.",
	testing: "Writing tests, test strategy, test coverage, testing methodologies.",
	design: "UI/UX design, API design, database schema design, component design.",
};

export function buildClassifierPrompt(categories: string[]): string {
	const categoryList = categories
		.map((cat) => {
			const desc = CATEGORY_DESCRIPTIONS[cat.toLowerCase()] || cat;
			return `- ${cat}: ${desc}`;
		})
		.join("\n");

	return `You are a task classifier. Your job is to analyze user input and classify it into exactly one category.

## Categories

${categoryList}

## Rules

1. Respond with ONLY a JSON object, no other text
2. The JSON must have exactly two fields: "category" (string) and "confidence" (number 0-1)
3. Choose the SINGLE most appropriate category
4. Confidence should reflect how certain you are (0.5 = guessing, 0.9 = very confident)
5. If the input is ambiguous, choose the most likely category and lower confidence

## Output Format

Respond with ONLY this JSON format:
{"category": "<category>", "confidence": <number>}`;
}
