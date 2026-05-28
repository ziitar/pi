# PRD: Multi-Agent Orchestration System

## Problem Statement

当前 pi 的 orchestrator 和 classifier 包只实现了基础的任务分类和单模型路由。用户需要一个更强大的多 agent 系统，能够：

1. 定义多个独立的 agent，每个 agent 有自己的系统提示词、模型、工具集和思考模式
2. 根据任务类型动态路由到最合适的 agent
3. Agent 之间能够互相通信和协作完成复杂任务
4. 每个 agent 有独立的上下文管理和 session 存储
5. 通过编排者（Orchestrator）协调多个 agent 共同完成大型任务

## Solution

构建一个完整的多 agent 编排系统，包含以下核心能力：

- **Agent 注册与发现**：通过 Agent池.md 文件管理所有可用 agent
- **动态路由**：根据任务内容和 agent 擅长领域自动选择最合适的 agent
- **Agent 间通信**：统一的 `call_agent` 工具，支持同步/异步调用
- **独立上下文管理**：每个 agent 根据模型限制自动压缩上下文
- **静态任务规划**：Orchestrator 先制定完整计划再执行
- **异步执行与通知**：支持并行派发任务，消息通知优先，超时轮询兜底

## User Stories

1. As a developer, I want to define multiple agents with different specialties (coding, review, research), so that tasks are handled by the most suitable expert
2. As a developer, I want each agent to have its own system prompt, so that each agent behaves according to its defined role
3. As a developer, I want each agent to be bound to a specific model, so that I can use the best model for each task type
4. As a developer, I want each agent to have its own tool set, so that agents only have access to tools relevant to their tasks
5. As a developer, I want each agent to have its own thinking level, so that I can control the reasoning depth per agent
6. As a developer, I want to define "categories" for each agent (independent of the model), so that the router knows which agent to use for which task type
7. As a developer, I want the system to automatically match models to agents based on categories, so that I don't have to manually configure model bindings
8. As a developer, I want to override the automatic model binding, so that I have full control when needed
9. As a developer, I want each agent to have independent context management, so that context limits are respected per agent
10. As a developer, I want automatic context compression when approaching model limits, so that long conversations don't fail
11. As a developer, I want different compression strategies per agent, so that coding agents preserve code details while review agents preserve issues
12. As a developer, I want each agent to have its own workspace with isolated sessions, so that agent histories are organized and separate
13. As a developer, I want an Agent池.md file that lists all available agents and their capabilities, so that agents can discover each other
14. As a developer, I want agents to be able to read Agent池.md and call other agents, so that complex tasks can be delegated
15. As a developer, I want a unified `call_agent` tool, so that agent communication is consistent
16. As a developer, I want synchronous agent calls when results are dependencies for the next step, so that execution waits for required results
17. As a developer, I want asynchronous agent calls when results are just references or for parallel execution, so that multiple agents can work simultaneously
18. As a developer, I want structured JSON data for agent requests and responses, so that communication is machine-parseable
19. As a developer, I want agent responses to include completion status (completed/partial/failed), so that callers know the state of delegated work
20. As a developer, I want an Orchestrator agent that can plan and coordinate multi-agent tasks, so that complex workflows are managed centrally
21. As a developer, I want the Orchestrator to use static planning (plan first, then execute), so that task execution is predictable and debuggable
22. As a developer, I want the Orchestrator to handle small tasks directly without delegation, so that simple requests don't have unnecessary overhead
23. As a developer, I want the Orchestrator to not be callable by other agents, so that there's a clear hierarchy
24. As a developer, I want regular agents to be able to call other agents directly, so that they can delegate sub-tasks without going through the Orchestrator
25. As a developer, I want each agent invocation to create a fresh instance, so that there are no circular dependency issues
26. As a developer, I want message-based notification for async completion, so that the Orchestrator is notified immediately when tasks finish
27. As a developer, I want timeout-based polling as a fallback, so that stuck agents are detected
28. As a developer, I want to wait for all async agents to complete before proceeding to the next phase, so that all results are available
29. As a developer, I want to create new agents through configuration files, so that I can extend the system
30. As a developer, I want the system to help me create new agents automatically when I request it, so that I don't have to write configs manually
31. As a developer, I want agent configs to reference separate system-prompt.md files, so that prompts are easy to edit
32. As a developer, I want context limits to be automatically derived from the bound model, so that I don't have to configure them manually
33. As a developer, I want the existing classifier and orchestrator packages to be refactored into this new system, so that the codebase is unified

## Implementation Decisions

### 模块划分

将重构现有 packages/orchestrator 和 packages/classifier，整合为一个新的包结构：

**1. Agent Core 模块**
- Agent 定义（config.yaml 解析）
- Agent 实例化（创建独立 session）
- Agent 生命周期管理

**2. Registry 模块**
- Agent池.md 读写
- Agent 发现与匹配（基于 categories）
- 自动创建 agent（生成配置和提示词）

**3. Communication 模块**
- AgentRequest / AgentResponse 协议定义
- call_agent 工具实现
- 消息通知机制
- 超时轮询机制

**4. Orchestrator 模块**
- 静态规划器（任务拆解 + 依赖分析）
- 计划执行器（同步/异步调度）
- 结果聚合器

**5. Context Management 模块**
- 上下文 token 计算
- LLM 总结压缩
- 压缩策略抽象（可按 agent 定制）

**6. Config 模块**
- 配置 schema（TypeBox）
- 配置加载器
- 默认配置

### Agent 配置 Schema

```typescript
interface AgentConfig {
  name: string;
  model: {
    provider: string;
    modelId: string;
  };
  thinkingLevel: ThinkingLevel;
  tools: string[];
  categories: string[];           // 擅长类别，与模型无关
  systemPrompt: string;           // 引用同目录下的 md 文件路径
  contextLimit: "auto" | number;  // auto = 从模型获取
  compressionStrategy?: string;   // 压缩策略标识
  workspace?: string;             // 自定义工作区路径
}
```

### 通信协议

```typescript
interface AgentRequest {
  from: string;                    // 调用者 agent 名
  task: string;                    // 任务描述
  mode: "sync" | "async";         // 同步/异步
  stepId?: string;                 // 步骤标识（用于依赖追踪）
  dependencies?: {
    agentResults?: { agent: string; stepId: string }[];
    files?: string[];
  };
  context?: {
    fragments?: string[];          // 上下文片段
    attachments?: string[];        // 文件路径
  };
}

interface AgentResponse {
  from: string;                    // 响应者 agent 名
  stepId?: string;                 // 对应的步骤标识
  status: "completed" | "partial" | "failed";
  result: string;                  // 结果文本
  artifacts?: {
    files?: string[];              // 写入的文件路径
    data?: Record<string, any>;    // 结构化数据
  };
  partialCheckpoint?: string;      // 阶段性返回标识
  error?: string;                  // 失败原因
}
```

### 目录结构

```
~/.pi/agents/
├── Agent池.md                    # 全局 agent 注册表
├── orchestrator/
│   ├── config.yaml
│   ├── system-prompt.md
│   └── sessions/
├── coder/
│   ├── config.yaml
│   ├── system-prompt.md
│   └── sessions/
└── ...
```

### Agent 池文件格式

```markdown
# Agent Pool

| Agent | 擅长类别 | 模型 | 状态 |
|-------|---------|------|------|
| orchestrator | 任务拆解, 编排, 汇总 | anthropic/claude-sonnet | active |
| coder | coding, debug, refactor | anthropic/claude-sonnet | active |
| reviewer | review, security, testing | openai/gpt-4o | active |
| researcher | research, analysis | deepseek/deepseek-chat | active |
```

### 执行流程

1. 用户请求到达
2. Orchestrator 解析需求，读取 Agent池.md
3. 静态规划：拆解步骤，选择 agent，标记依赖关系
4. 执行计划：
   - 无依赖步骤 → 并行派发（async + 消息通知）
   - 有依赖步骤 → 等前置完成后同步调用
   - 简单任务 → Orchestrator 自己执行
5. 收集结果，进入下一阶段
6. 汇总所有结果，返回给用户

### 异步机制

```
派发 async 任务:
  → 创建 agent 实例
  → 注册 complete 事件监听
  → 记录 { agent, startTime, timeout }
  → 继续其他工作

Agent 完成:
  → 触发 complete 事件
  → 调用者收到，记录结果

超时兜底:
  → 每 N 秒检查一次
  → 超时 → 轮询 agent 状态
  → 仍无响应 → 报错/重试

全部完成:
  → 进入下一阶段
```

### 循环调用处理

每次 agent 调用创建全新实例（独立 session），不存在循环依赖问题。每个 agent 只需关心：
- 谁调用了自己（from 字段）
- 自己调用了谁（记录在 session 中）

### 与现有包的关系

- `packages/classifier` 的分类能力 → 融入 orchestrator 的规划阶段
- `packages/orchestrator` 的路由能力 → 融入新的 agent 发现 & 匹配机制
- `packages/coding-agent` 的 `createAgentSession` → 作为 agent 实例化的底层依赖

## Testing Decisions

### 测试原则

1. 只测试外部行为，不测试实现细节
2. 核心模块需要独立可测试
3. 使用 mock 避免真实的 LLM 调用
4. 参考现有测试结构（vitest）

### 需要测试的模块

1. **Agent Registry**
   - 解析 Agent池.md
   - 根据 category 匹配 agent
   - 创建新 agent 配置

2. **Communication Protocol**
   - AgentRequest/Response 序列化/反序列化
   - call_agent 工具调用流程
   - 同步/异步调用逻辑

3. **Orchestrator Planner**
   - 任务拆解逻辑
   - 依赖关系分析
   - 执行计划生成

4. **Orchestrator Executor**
   - 同步调用执行
   - 异步调用 + 通知
   - 超时轮询
   - 结果聚合

5. **Context Management**
   - Token 计算
   - 压缩触发条件
   - LLM 总结压缩

6. **Agent Instance**
   - 配置加载
   - Session 创建
   - 独立上下文管理

### 测试工具

- 使用 faux provider 避免真实 API 调用
- 使用 in-memory session manager
- Mock 消息通知机制

## Out of Scope

1. **MCP 集成** — 不在本次范围内，可通过扩展实现
2. **UI 组件** — 本次只实现核心逻辑，TUI 集成后续再做
3. **持久化 Agent 状态** — Agent 实例是临时的，不跨 session 保持状态
4. **Agent 学习/记忆** — 不实现跨任务的 agent 记忆系统
5. **权限控制** — 不实现 agent 间的权限隔离
6. **分布式执行** — 所有 agent 在同一进程内执行

## Further Notes

### 后续扩展方向

1. **动态规划** — 在静态规划基础上增加动态调整能力
2. **Agent 市场** — 社区共享 agent 配置
3. **可视化编排** — 拖拽式 agent 工作流设计
4. **性能监控** — Agent 执行时间、token 消耗统计
5. **错误恢复** — 更智能的重试和降级策略

### 依赖关系

- `@earendil-works/pi-ai` — LLM 调用
- `@earendil-works/pi-agent-core` — Agent 核心
- `@earendil-works/pi-coding-agent` — Session 管理、工具定义

### 包命名建议

`@earendil-works/pi-multi-agent` 或在现有 `packages/orchestrator` 基础上重构
