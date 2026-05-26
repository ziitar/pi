import { getModel } from "@earendil-works/pi-ai";
import type { Model, KnownProvider } from "@earendil-works/pi-ai";
import type { ModelCategoriesConfig, CategoryConfig, ThinkingLevel } from "../config/schema.ts";

export interface ResolvedModel {
  model: Model<any>;
  thinkingLevel?: ThinkingLevel;
  temperature?: number;
}

export class ModelResolutionError extends Error {
  category: string;
  provider?: string;

  constructor(
    message: string,
    category: string,
    provider?: string,
  ) {
    super(message);
    this.name = "ModelResolutionError";
    this.category = category;
    this.provider = provider;
  }
}

function resolveSingleConfig(config: CategoryConfig): ResolvedModel {
  try {
    const model = getModel(config.provider as any, config.modelId as any);
    return {
      model,
      thinkingLevel: config.thinkingLevel,
      temperature: config.temperature,
    };
  } catch (error) {
    throw new ModelResolutionError(
      `Failed to resolve model: ${config.provider}/${config.modelId}`,
      "",
      config.provider,
    );
  }
}

export function resolveModel(
  category: string,
  config: ModelCategoriesConfig,
): ResolvedModel {
  const categoryConfig = config.categories[category];

  if (!categoryConfig) {
    throw new ModelResolutionError(
      `Unknown category: ${category}. Available: ${Object.keys(config.categories).join(", ")}`,
      category,
    );
  }

  try {
    return resolveSingleConfig(categoryConfig.primary);
  } catch (primaryError) {
    if (categoryConfig.fallback && categoryConfig.fallback.length > 0) {
      for (const fallback of categoryConfig.fallback) {
        try {
          return resolveSingleConfig(fallback);
        } catch {
          // Continue to next fallback
        }
      }
    }

    throw new ModelResolutionError(
      `All models failed for category "${category}". Primary: ${categoryConfig.primary.provider}/${categoryConfig.primary.modelId}`,
      category,
      categoryConfig.primary.provider,
    );
  }
}

export function resolveClassifierModel(config: ModelCategoriesConfig): ResolvedModel {
  if (!config.classifier) {
    return resolveSingleConfig({
      provider: "deepseek",
      modelId: "deepseek-v4-flash",
    });
  }

  return resolveSingleConfig(config.classifier);
}
