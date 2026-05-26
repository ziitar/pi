#!/usr/bin/env bun

import { orchestrate } from "../orchestrator/orchestrator.ts";
import { loadConfig } from "../config/loader.ts";
import { aggregateResults } from "../orchestrator/aggregator.ts";
import type { OrchestrationOptions } from "../orchestrator/types.ts";

interface CliArgs {
  prompt: string;
  category?: string;
  parallel: boolean;
  config?: string;
  cwd?: string;
  verbose: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    prompt: "",
    parallel: false,
    verbose: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--parallel" || arg === "-p") {
      args.parallel = true;
      continue;
    }

    if (arg === "--verbose" || arg === "-v") {
      args.verbose = true;
      continue;
    }

    if (arg === "--category" || arg === "-c") {
      args.category = argv[++i];
      continue;
    }

    if (arg === "--config") {
      args.config = argv[++i];
      continue;
    }

    if (arg === "--cwd") {
      args.cwd = argv[++i];
      continue;
    }

    // Otherwise, treat as the prompt
    if (!args.prompt) {
      args.prompt = arg;
    } else {
      args.prompt += " " + arg;
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
pi-orchestrate - Multi-model agent orchestration

USAGE:
  pi-orchestrate [options] <prompt>

OPTIONS:
  -c, --category <name>    Force a specific category (coding, architecture, etc.)
  -p, --parallel           Run parallel agents for multiple categories
  --config <path>          Path to model-categories.json config file
  --cwd <path>             Working directory for agent sessions
  -v, --verbose            Show detailed output
  -h, --help               Show this help message

EXAMPLES:
  pi-orchestrate "Write a sorting function in Python"
  pi-orchestrate --category architecture "Design a caching system"
  pi-orchestrate --parallel "Review this code and suggest improvements"

CATEGORIES:
  coding        - Write, fix, or explain code
  architecture  - System design and architecture decisions
  code-review   - Review and analyze existing code
  writing-cn    - Chinese content creation
  creative      - Creative writing and brainstorming
  fast          - Simple questions and quick answers
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (!args.prompt) {
    console.error("Error: No prompt provided. Use --help for usage information.");
    process.exit(1);
  }

  try {
    // Load config
    const config = loadConfig(args.config);

    // Override category if specified
    if (args.category) {
      if (!config.categories[args.category]) {
        console.error(`Error: Unknown category "${args.category}".`);
        console.error(`Available categories: ${Object.keys(config.categories).join(", ")}`);
        process.exit(1);
      }
    }

    // Build options
    const options: OrchestrationOptions = {
      mode: args.parallel ? "parallel" : "single",
      cwd: args.cwd || process.cwd(),
    };

    if (args.verbose) {
      console.log(`Mode: ${options.mode}`);
      console.log(`Category: ${args.category || "auto-detect"}`);
      console.log(`Config: ${args.config || "default"}`);
      console.log("---");
    }

    // Run orchestration
    const result = await orchestrate(args.prompt, config, options);

    // Output results
    const output = aggregateResults(result);
    console.log(output);

    // Exit with error if primary failed
    if (result.primary.error) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    process.exit(1);
  }
}

main();
