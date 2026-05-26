# @earendil-works/pi-orchestrator

Multi-model agent orchestration for the pi ecosystem.

## Features

- Task classification (coding, architecture, writing, creative, etc.)
- Category-to-model routing with fallback chains
- Parallel agent execution
- Configurable via `~/.pi/agent/model-categories.json`

## Usage

```typescript
import { orchestrate, loadConfig } from "@earendil-works/pi-orchestrator";

const config = loadConfig();
const result = await orchestrate("Write a sorting function", config);
console.log(result.primary.messages);
```
