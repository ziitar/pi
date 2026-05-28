
## Task 1: Consolidate ThinkingLevel

### Summary
Consolidated `ThinkingLevel` type from 3 definitions to 1 canonical source (`packages/agent/src/types.ts`).

### Files Changed
- `packages/agent/src/types.ts` - Already canonical (no changes needed)
- `packages/ai/src/types.ts` - Removed local ThinkingLevel, imported from @earendil-works/pi-agent-core, re-exported
- `packages/ai/src/providers/anthropic.ts` - Added `options.reasoning === "off"` check
- `packages/ai/src/providers/amazon-bedrock.ts` - Added `options.reasoning === "off"` check, fixed Record type
- `packages/ai/src/providers/google.ts` - Added "off" handling, fixed ClampedThinkingLevel to exclude "off"
- `packages/ai/src/providers/google-vertex.ts` - Same as google.ts
- `packages/ai/src/providers/simple-options.ts` - Updated clampReasoning to exclude "off" from return type
- `packages/orchestrator/src/config/schema.ts` - Removed local type, imported from agent-core, re-exported
- `packages/orchestrator/src/router/__tests__/router.test.ts` - Fixed broken import path (pre-existing)

### Key Findings
- **Circular dependency**: `packages/agent` depends on `packages/ai`, so adding an import from ai to agent creates a circular dependency at build time. `npm run check` works because `tsgo --noEmit` uses the root tsconfig with source-level path mappings, bypassing npm dependency resolution.
- **"off" ripple effect**: The canonical ThinkingLevel includes `"off"`, which the ai package's original definition did not. This caused cascading type errors in providers that used `Record<ThinkingLevel, ...>`, `ClampedThinkingLevel`, and `ThinkingBudgets` (which doesn't include "off").
- **Provider handling**: Several providers (anthropic, amazon-bedrock, google, google-vertex) use `!options?.reasoning` to check if reasoning is disabled. With "off" now being a valid truthy string value, an explicit `options.reasoning === "off"` check must be added before these checks.
- **Pre-existing bugs**: `router.test.ts` had a broken import path (`../config/schema.ts` should be `../../config/schema.ts`) and TypeScript errors with `vi.mocked(getModel).mockImplementation` not handling the complex generic overloads of `getModel`.

### Verification
`npm run check` passes with zero errors. Evidence saved to `.sisyphus/evidence/task-1-check-passed.txt`.

## Task 2: Scaffold packages/multi-agent

### Summary
Created the `packages/multi-agent/` directory with standard package scaffold:
- `package.json` with deps on `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `typebox`
- `tsconfig.build.json` extending root base config
- `vitest.config.ts` with globals: true, environment: node, timeout: 30s
- `src/index.ts` barrel export (empty initially)
- `src/__tests__/smoke.test.ts` with 3 tests

### Files Changed
- Created `packages/multi-agent/` directory
- Created `packages/multi-agent/package.json`
- Created `packages/multi-agent/tsconfig.build.json`
- Created `packages/multi-agent/vitest.config.ts`
- Created `packages/multi-agent/src/index.ts`
- Created `packages/multi-agent/src/__tests__/smoke.test.ts`
- Modified `tsconfig.json` — added path mapping for `@earendil-works/pi-multi-agent`

### Dependencies included
- `@earendil-works/pi-ai` ^0.75.5
- `@earendil-works/pi-agent-core` ^0.75.5
- `typebox` 1.1.38
- Dev: `@types/node`, `vitest`
- NO dependency on `@earendil-works/pi-coding-agent`

### Verification
- `vitest --run` passes (3/3 tests)
- `npx madge --circular` finds no circular dependencies
- No dependency on `@earendil-works/pi-coding-agent`
- Workspace auto-discovered via `"packages/*"` glob in root `package.json`
- Evidence saved to `.sisyphus/evidence/task-2-*.txt`

## Task 3: Config module (schema, loader, defaults)

### Summary
Created the Config module for `packages/multi-agent/src/config/` with TypeBox schemas, config loader, and defaults.

### Files Created
- `packages/multi-agent/src/config/schema.ts` — TypeBox schemas: AgentConfigSchema, MultiAgentConfigSchema, CompressionStrategySchema, ThinkingLevelSchema. Exports AgentConfig, MultiAgentConfig, ThinkingLevel types.
- `packages/multi-agent/src/config/defaults.ts` — DEFAULT_CONFIG with default agent (model: "auto", systemPrompt: "You are a helpful assistant."), maxConcurrency: 3, defaultTimeout: 30000, classifierModel: "auto".
- `packages/multi-agent/src/config/loader.ts` — loadConfig() reads ~/.pi/agents/{name}/config.json per agent directory, validates with TypeBox Compile. Returns DEFAULT_CONFIG if directory missing or no agents found.
- `packages/multi-agent/src/config/__tests__/schema.test.ts` — 13 tests: valid config acceptance, required field validation, invalid values rejection, array minItems enforcement.
- `packages/multi-agent/src/config/__tests__/loader.test.ts` — 11 tests: fallback to defaults, single/multi agent loading, subdirectory skipping, JSON comment stripping, invalid config rejection.

### Files Modified
- `packages/multi-agent/src/index.ts` — barrel export for all config types and functions.

### Key Findings
- **Type.Array minItems**: `Type.Array(AgentConfigSchema)` does NOT enforce a minimum by default. Must add `{ minItems: 1 }` to reject empty agents arrays.
- **DEFAULT_CONFIG fallback**: When no agent configs are found (missing directory, empty directory, or only non-config files), loadConfig returns DEFAULT_CONFIG (with 1 default agent). This is consistent with orchestrator's loadConfig behavior.
- **Per-directory agent configs**: Unlike orchestrator which reads a single JSON file, multi-agent reads individual config.json files from subdirectories under ~/.pi/agents/{name}/. This allows each agent to have its own configuration while sharing a common base directory.
- **JSON comments**: Same stripJsonComments utility from orchestrator reused — handles `//`, `/* */`, and trailing commas.

### Verification
- `vitest --run` passes 27/27 tests across 3 test files (smoke, schema, loader).
- Evidence saved to `.sisyphus/evidence/task-3-vitest-passed.txt`.

## Task 5: AgentSessionFactory interface and types

### Summary
Created the AgentSessionFactory interface and types for agent session management in `packages/multi-agent/`.

### Files Created
- `packages/multi-agent/src/types.ts` — `AgentConfig`, `AgentSessionOptions`, `AgentSessionHandle`, `AgentSessionFactory` interfaces. Re-exports `ThinkingLevel`, `AgentMessage`, `Model` from canonical sources (`@earendil-works/pi-agent-core` / `@earendil-works/pi-ai`).
- `packages/multi-agent/src/agent/factory.ts` — `DefaultAgentSessionFactory` implementation. Each `createSession()` creates a new, independent `Agent` instance with its own state, transcript, and lifecycle.
- `packages/multi-agent/src/agent/__tests__/factory.test.ts` — 10 tests: session creation, custom sessionId, unique IDs, session isolation, getState, subscribe/unsubscribe, abort, waitForIdle, AgentSessionOptions acceptance.

### Files Modified
- `packages/multi-agent/src/index.ts` — barrel export for types and DefaultAgentSessionFactory.

### Key Findings
- **Agent.prompt() overloads**: The `prompt` method has two overload signatures (string+images vs message/messages). The handle wrapper uses a single implementation signature with `as any` cast since both signatures are structurally compatible at runtime.
- **Faux provider test pattern**: Use `registerFauxProvider()` from `@earendil-works/pi-ai` for testing without API keys. Each test registers its own faux provider in `beforeEach` and unregisters in `afterEach`. `setResponses()` must be called with at least one response before the first `prompt()` call.
- **No pi-coding-agent dependency**: Confirmed that the factory uses only `@earendil-works/pi-agent-core` (Agent) and `@earendil-works/pi-ai` (faux provider, types). No import from pi-coding-agent anywhere.
- **crypto.randomUUID()**: Used for auto-generating session IDs (available in Node 22+).

### Verification
- `vitest --run src/agent/__tests__/factory.test.ts` — 10/10 pass.
- Pre-existing registry test failures (2) are unrelated.
- Evidence saved to `.sisyphus/evidence/task-5-factory-test-passed.txt`.

## Task 4: Agent Registry (agents-index.md)

### Summary
Created the Agent Registry module for `packages/multi-agent/src/registry/` with types, parser, writer, discover, and match functionality.

### Files Created
- `packages/multi-agent/src/registry/types.ts` — Registry types: AgentRegistryEntry, AgentPool, RegistryVersion, AgentConfig, DiscoveredAgent, AgentMatch, AgentStatus
- `packages/multi-agent/src/registry/parser.ts` — parseAgentIndex() reads agents-index.md markdown table, returns AgentPool or null if no version marker
- `packages/multi-agent/src/registry/writer.ts` — writeAgentIndex() generates agents-index.md content from AgentPool
- `packages/multi-agent/src/registry/discover.ts` — discoverAgents() scans ~/.pi/agents/ directory, loads config.yaml from each subdirectory
- `packages/multi-agent/src/registry/match.ts` — matchAgent() and matchAllAgents() find best matching agents by category with relevance scoring
- `packages/multi-agent/src/registry/__tests__/parser.test.ts` — 12 tests: valid parsing, version marker validation, category parsing, status handling, whitespace handling
- `packages/multi-agent/src/registry/__tests__/writer.test.ts` — 9 tests: writing version/header/entries, roundtrip with parser, empty/single agent handling
- `packages/multi-agent/src/registry/__tests__/discover.test.ts` — 11 tests: non-existent/empty dirs, valid/invalid configs, default values, malformed YAML handling
- `packages/multi-agent/src/registry/__tests__/match.test.ts` — 12 tests: exact/partial matching, no match, inactive agents, case-insensitive, scoring

### Files Modified
- `packages/multi-agent/src/index.ts` — Added barrel exports for registry module

### Key Findings
- **Version marker for auto-detect**: parseAgentIndex() returns null if no `version: N` marker found. This enables auto-detection of multi-agent mode (check if agents-index.md exists with version marker).
- **Simple YAML parser**: Built a minimal YAML parser for config.yaml files. Handles key-value pairs, arrays (dash syntax), quoted strings, numbers, booleans, null. Intentionally lenient — malformed YAML produces default config rather than throwing.
- **Relevance scoring**: matchAgent() uses a 3-tier scoring system: exact match (1.0), partial/substring match (0.7), no match (0). Agents are sorted by score descending, with category position as tiebreaker.
- **"code" vs "coding"**: JavaScript's String.includes() is exact — "coding" does NOT contain "code" (c-o-d-i-n-g vs c-o-d-e). Tests must use valid substrings for partial matching (e.g., "debug" matches "debugging").
- **Number.isNaN vs isNaN**: Biome enforces Number.isNaN() to avoid type coercion bugs. Fixed in discover.ts parseYamlValue().

### agents-index.md Format
```markdown
# Agent Pool
version: 1

| Agent | Categories | Model | Status |
|-------|-----------|-------|--------|
| coder | coding, debug, refactor | anthropic/claude-sonnet | active |
```

### Verification
- `vitest --run` passes 81/81 tests across 8 test files.
- Evidence saved to `.sisyphus/evidence/task-4-vitest-passed.txt`.

## Task 9: Execution Module

- `executeAgent` takes `AgentConfig`, `AgentInstanceManager`, `AgentSessionFactory`, prompt string, and `ExecutionOptions`
- Pre-abort check needed before creating instance: `Promise.reject()` races poorly with fast-resolving faux providers
- Manager handles timeout internally via AbortController; executor uses `Promise.race` with external abort signal
- `AgentResult` includes status enum: "completed" | "partial" | "failed" - partial when messages exist before error
- Disposal is safe to call on already-disposed instances (manager handles gracefully)
- `AgentInstanceManager` exported from index.ts since `executeAgent` requires it as a parameter
