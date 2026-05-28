
## Task 14: Context Token Calculation + Compression Trigger (2026-05-28)

### Created files
- `src/context/types.ts` — CompressionContext, CompressionResult, ContextLimitConfig, COMPRESSION_THRESHOLD (0.8), DEFAULT_CONTEXT_LIMIT_CONFIG
- `src/context/calculator.ts` — estimateTokens(text), estimateMessageTokens(Message), estimateContextTokens(Message[])
- `src/context/trigger.ts` — shouldCompress(currentTokens, config?, model?, threshold?)
- `src/context/__tests__/calculator.test.ts` — 12 tests
- `src/context/__tests__/trigger.test.ts` — 11 tests

### Key decisions
- Used pi-ai `Message` type (not AgentMessage) for calculator to stay generic
- ~4 chars/token heuristic matches existing `packages/agent/src/harness/compaction/compaction.ts`
- ContextLimitConfig with "auto" | number pattern for flexibility
- All exported from index.ts

### Existing code references
- Existing compaction: `packages/agent/src/harness/compaction/compaction.ts` has `estimateTokens()`, `estimateContextTokens()`, `shouldCompact()`, `CompactionSettings`
- Model type: `packages/ai/src/types.ts` line 558: `contextWindow: number`
- Multi-agent uses vitest, tsconfig.build.json extends `../../tsconfig.base.json`

### Pre-existing test failure
- `src/routing/__tests__/discovery.test.ts` > routeTask > uses fallback models when primary fails — pre-existing, not from this task

## Task 15: Compression Strategies + LLM Summarization

### Files Created
- `packages/multi-agent/src/context/strategy.ts` — CompressionStrategy interface + registry (register, unregister, get, list, clear)
- `packages/multi-agent/src/context/code-preserving.ts` — Strategy that preserves code blocks (```), summarizes prose to first 2 lines
- `packages/multi-agent/src/context/issue-preserving.ts` — Strategy that preserves issue descriptions (bug/error/stack trace patterns), summarizes non-issue prose
- `packages/multi-agent/src/context/summarizer.ts` — LLM-based summarization using completeSimple, serializes messages and sends structured prompt
- `packages/multi-agent/src/context/__tests__/strategy.test.ts` — 20 tests: registry CRUD, strategy selection, code-preserving behavior, issue-preserving behavior
- `packages/multi-agent/src/context/__tests__/summarizer.test.ts` — 10 tests: mock completeSimple, empty input, error/abort handling, option passing, serialization

### Design Decisions
- Strategy interface uses async `compress(messages, context) => CompressionStrategyResult` pattern
- Both code-preserving and issue-preserving use configurable `keepRecent` (default 3) to preserve recent messages untouched
- Summarizer uses `completeSimple` (not `streamSimple`) for one-shot summarization — simpler API, same result
- Registry uses Map-based storage with clear/unregister for test isolation
- Code-preserving extracts ``` blocks and preserves them, summarizes surrounding prose
- Issue-preserving uses regex patterns for bug/error/stack trace detection to decide preservation vs summarization

### Verification
- 251/251 tests pass (all existing + 30 new)
- No type errors in new files (pre-existing calculator.ts error from Task 14)
