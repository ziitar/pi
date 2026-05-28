
## 2026-05-28: Deleted old orchestrator and classifier packages

Task 17 completed. Removed:
- packages/orchestrator/ (entire directory)
- packages/classifier/ (entire directory)
- coding-agent/package.json: removed @earendil-works/pi-classifier and @earendil-works/pi-orchestrator deps
- tsconfig.json: removed path aliases for both packages
- root package.json: removed classifier/orchestrator from build script
- classification-router.ts: simplified classifyAndRouteSingleAgent to return null (no config fallback). Multi-agent path via @earendil-works/pi-multi-agent is the replacement.
- package-lock.json: removed stale workspace entries
- Regenerated coding-agent npm-shrinkwrap.json

The single-agent routing path (for users without agents-index.md) now returns null, falling back to the default model. This is fine since the multi-agent system is the intended replacement.
