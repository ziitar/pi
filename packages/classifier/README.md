# @earendil-works/pi-classifier

LLM-based task classifier for intent recognition.

## Features

- Classifies user input into task categories
- Supports: coding, architecture, code-review, writing-cn, creative, fast
- Returns confidence scores
- Handles malformed responses gracefully

## Usage

```typescript
import { classifyTask } from "@earendil-works/pi-classifier";
import { getModel } from "@earendil-works/pi-ai";

const model = getModel("deepseek", "deepseek-chat");
const result = await classifyTask("Write a React component", model);
console.log(result); // { category: "coding", confidence: 0.9 }
```
