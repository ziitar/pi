import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ClassificationResult } from "@earendil-works/pi-classifier";
import type { ThinkingLevel } from "../config/schema.ts";

export interface AgentResult {
  category: string;
  provider: string;
  modelId: string;
  messages: AgentMessage[];
  error?: string;
  duration?: number;
}

export interface OrchestrationResult {
  primary: AgentResult;
  secondaries: AgentResult[];
  classification: ClassificationResult;
  totalDuration: number;
}

export interface OrchestrationOptions {
  mode?: "single" | "parallel";
  cwd?: string;
  maxConcurrency?: number;
  timeout?: number;
  tools?: string[];
}
