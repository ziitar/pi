import { createAgentSession } from "@earendil-works/pi-coding-agent";
import { classifyTask } from "@earendil-works/pi-classifier";
import type { ClassificationResult } from "@earendil-works/pi-classifier";
import type { ModelCategoriesConfig } from "../config/schema.ts";
import { resolveModel, resolveClassifierModel } from "../router/router.ts";
import type { OrchestrationResult, OrchestrationOptions, AgentResult } from "./types.ts";
import { runParallel } from "./parallel.ts";

const DEFAULT_TIMEOUT = 120000; // 2 minutes

export async function orchestrate(
  input: string,
  config: ModelCategoriesConfig,
  options?: OrchestrationOptions,
): Promise<OrchestrationResult> {
  const startTime = Date.now();
  const mode = options?.mode ?? "single";
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

  // Step 1: Classify the input
  const classifierModel = resolveClassifierModel(config);
  const classification = await classifyTask(input, classifierModel.model, {
    timeout: 10000,
  });

  // Step 2: Resolve the primary model
  const primaryResolved = resolveModel(classification.category, config);

  // Step 3: Create and run the primary agent
  const primaryResult = await runSingleAgent(
    input,
    primaryResolved.model.provider,
    primaryResolved.model.id,
    primaryResolved.thinkingLevel,
    options?.cwd,
    options?.tools,
    timeout,
  );

  // Step 4: If parallel mode, run secondary agents
  let secondaries: AgentResult[] = [];
  if (mode === "parallel") {
    const maxConcurrency = options?.maxConcurrency ?? config.maxConcurrency ?? 3;

    // Get secondary categories (other than the primary)
    const secondaryCategories = Object.keys(config.categories)
      .filter((cat) => cat !== classification.category)
      .slice(0, maxConcurrency - 1);

    secondaries = await runParallel(
      input,
      secondaryCategories.map((cat) => ({
        category: cat,
        config: config,
      })),
      options?.cwd,
      options?.tools,
      timeout,
    );
  }

  return {
    primary: primaryResult,
    secondaries,
    classification,
    totalDuration: Date.now() - startTime,
  };
}

async function runSingleAgent(
  input: string,
  provider: string,
  modelId: string,
  thinkingLevel?: string,
  cwd?: string,
  tools?: string[],
  timeout?: number,
): Promise<AgentResult> {
  const startTime = Date.now();

  try {
    const { session } = await createAgentSession({
      model: { provider, modelId } as any,
      cwd: cwd || process.cwd(),
      tools: tools as any,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Agent timeout")), timeout);
    });

    const workPromise = (async () => {
      await session.prompt(input);
      return session.state.messages;
    })();

    const messages = await Promise.race([workPromise, timeoutPromise]);

    return {
      category: "",
      provider,
      modelId,
      messages,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      category: "",
      provider,
      modelId,
      messages: [],
      error: error instanceof Error ? error.message : "Unknown error",
      duration: Date.now() - startTime,
    };
  }
}

export { runSingleAgent };
