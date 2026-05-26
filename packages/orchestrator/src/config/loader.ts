import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Compile } from "typebox/compile";
import { ModelCategoriesConfigSchema, type ModelCategoriesConfig } from "./schema.ts";
import { DEFAULT_CONFIG } from "./defaults.ts";

function getConfigPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  return join(home, ".pi", "agent", "model-categories.json");
}

function stripJsonComments(text: string): string {
  // Remove single-line comments (// ...)
  let result = text.replace(/\/\/.*$/gm, "");
  // Remove multi-line comments (/* ... */)
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove trailing commas
  result = result.replace(/,(\s*[}\]])/g, "$1");
  return result;
}

export function loadConfig(configPath?: string): ModelCategoriesConfig {
  const path = configPath || getConfigPath();

  if (!existsSync(path)) {
    return DEFAULT_CONFIG;
  }

  try {
    const raw = readFileSync(path, "utf-8");
    const cleaned = stripJsonComments(raw);
    const parsed = JSON.parse(cleaned);

    const C = Compile(ModelCategoriesConfigSchema);
    if (!C.Check(parsed)) {
      const errors = [...C.Errors(parsed)];
      const messages = errors.map((e: any) => `${e.path}: ${e.message}`).join("\n");
      throw new Error(`Invalid config at ${path}:\n${messages}`);
    }

    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config at ${path}: ${error.message}`);
    }
    throw error;
  }
}
