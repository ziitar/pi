import type { ModelCategoriesConfig } from "../config/schema.ts";
import { resolveModel } from "../router/router.ts";
import type { AgentResult } from "./types.ts";
import { runSingleAgent } from "./orchestrator.ts";

interface SecondaryConfig {
  category: string;
  config: ModelCategoriesConfig;
}

export async function runParallel(
  input: string,
  secondaries: SecondaryConfig[],
  cwd?: string,
  tools?: string[],
  timeout?: number,
): Promise<AgentResult[]> {
  const promises = secondaries.map(async (secondary) => {
    const resolved = resolveModel(secondary.category, secondary.config);

    return runSingleAgent(
      input,
      resolved.model.provider,
      resolved.model.id,
      resolved.thinkingLevel,
      cwd,
      tools,
      timeout,
    ).then((result) => ({
      ...result,
      category: secondary.category,
    }));
  });

  const results = await Promise.allSettled(promises);

  return results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    return {
      category: secondaries[index].category,
      provider: "unknown",
      modelId: "unknown",
      messages: [],
      error: result.reason instanceof Error ? result.reason.message : "Unknown error",
    };
  });
}
