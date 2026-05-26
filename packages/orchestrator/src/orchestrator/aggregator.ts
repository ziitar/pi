import type { OrchestrationResult, AgentResult } from "./types.ts";

function formatAgentResult(label: string, result: AgentResult): string {
  const modelInfo = `${result.provider}/${result.modelId}`;
  const duration = result.duration ? ` (${result.duration}ms)` : "";

  if (result.error) {
    return `## ${label}: ${modelInfo}${duration}\n\nERROR: ${result.error}`;
  }

  const lastMessage = result.messages[result.messages.length - 1];
  if (!lastMessage || lastMessage.role !== "assistant") {
    return `## ${label}: ${modelInfo}${duration}\n\nNo response generated.`;
  }

  const content = lastMessage.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  return `## ${label}: ${modelInfo}${duration}\n\n${content}`;
}

export function aggregateResults(result: OrchestrationResult): string {
  const sections: string[] = [];

  // Classification info
  sections.push(
    `### Classification: ${result.classification.category} (confidence: ${result.classification.confidence.toFixed(2)})`,
  );

  // Primary result
  sections.push(formatAgentResult("Primary", result.primary));

  // Secondary results
  if (result.secondaries.length > 0) {
    sections.push("---\n## Secondary Results");
    for (const secondary of result.secondaries) {
      sections.push(formatAgentResult(secondary.category, secondary));
    }
  }

  // Summary
  sections.push(`\n---\n*Total duration: ${result.totalDuration}ms*`);

  return sections.join("\n\n");
}
