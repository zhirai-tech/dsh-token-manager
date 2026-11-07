# Phase 0 环境核验 · Lead 实测记录

> 采集时间：2026-11-01（Europe/Berlin）
> 采集方式：本机真实命令 / cordis_inspect_query / 只读探测插件 / 投影缓存实读
> 项目根：`E:\ZHIRAI Harness\dsh-token-manager`

## 1. 运行环境

| 项目 | 实测值 | 证据 |
|---|---|---|
| DeepSeek Harness 版本 | `0.2.1-rc.5` | `dsh --version` |
| 宿主形态 | Electron 桌面应用（app.asar），Web GUI | 安装目录 `.../resources/app.asar` |
| DSH_HOME | `C:\Users\Administrator\.dsh` | 环境变量 |
| 当前 profile | `desktop`（由 Electron 独占管理） | `dsh --profile desktop --dump-config` → `error: profile "desktop" is managed exclusively by the Electron application` |
| profile 目录 | `C:\Users\Administrator\.dsh\profiles\desktop` | 环境变量 `DSH_PROFILE_DIR` |
| 内置 Node | `24.21.0` | `resources/runtime/versions.json` |
| 内置 pnpm | `11.28.5` | `resources/runtime/versions.json`；`dsh plugin --profile ...` 内部会自动加版本提示 |
| 系统 Node / pnpm | `v24.14.0` / `10.32.1` | `node -v` / `pnpm -v` |
| Web GUI（生产） | `http://127.0.0.1:62186` | 运行时上下文 `DSH_WEB_URL` |
| 当前会话 | `session-b7153413-0584-44c8-9148-1362793e00af` | `DSH_SESSION_ID` |
| 内置 sqlite 查询 | `include:session-query-sqlite` 为 active（官方用 SQLite 存会话索引） | `plugin_manager list_plugins` |
| TypeScript / esbuild | 未全局安装；npm registry 可达（ping 200）；临时目录实测 `npm i typescript@7.0.2 esbuild@0.28.2` 6 秒成功 | 见 §5 |

## 2. 插件体系实测（关键结论）

### 2.1 插件包（bundle）格式

- `package.json` 声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`，Node ESM（`"type": "module"`）。
- `cordis.patch.yml` 里 `insert` 一行：`{ id, name: '<包名>', config: {} }`。
- Host 入口 `index.js` 导出 `export function apply(ctx, config)`，**必须**声明 `export const inject = [...]` 才能访问对应服务。
  - 实测反例：未声明 `inject` 时访问 `ctx.tools` 直接抛 `Error: cannot get property "tools" without inject`（插件条目“未激活”，整条 entry 被跳过）。
  - 声明 `inject: ['tools','tokenMeter']` 后：`ctx.tools`、`ctx.tokenMeter` 可用；`ctx.get('sessionProjections'|'agentLoop'|'sessions'|'llm'|'settings'|'storageDomain'|'spillStore'|'systemPrompt')` 均可用。
  - 本版本 `ctx` 自身几乎没有可枚举自有属性，只有 `fiber`；服务需经 `ctx.<name>` / `ctx.get(name)` 获取。
- 事件注册：`ctx.on('session/event', (session, event) => {...})` 实测可收到 `request/header`（`reason: initial`, `provider: deepseek-official`, `model: deepseek-flash`）、`assistant/message`、`tool/result`。
- 插件加载失败不会阻断 Harness，只会 `warning: 1 entry did not activate`，其余功能正常 → 符合 PRD“插件异常不能阻断开发任务”。

### 2.2 隔离测试 profile（已建立并验证）

```powershell
# 1) 从官方 web 模板生成隔离 profile（不碰生产 desktop）
dsh tm-sandbox --from-default-profile web --dump-config
#    → 生成 C:\Users\Administrator\.dsh\profiles\tm-sandbox（base + web-app 两个 bundle）

# 2) 安装本地 bundle（会自动写入 dependencies 与 dsh.profile.bundles）
dsh plugin --profile tm-sandbox add "file:E:/ZHIRAI Harness/dsh-token-manager/probe/hello"

# 3) 启动独立 Web GUI（端口自选，URL 带一次性 token；无 token 直接访问返回 401）
dsh tm-sandbox --port 62300 --no-open
#   → dsh web: http://127.0.0.1:62300/?token=<token>
```

- 生产 `desktop` profile **未被修改**；`plugin_manager` 的所有动作都作用于当前 profile（desktop），因此本轮 Phase 0 未调用任何 `plugin_manager` 写操作。
- 沙箱与生产共享 `DSH_HOME`：会话列表、工作区、凭据、投影缓存都可见（沙箱侧栏能看到生产会话）。这对“历史会话回溯统计”是好事，但**沙箱内插件会看到生产历史数据**，交付时需说明。

### 2.3 开发循环（已实测）

- `dsh plugin add file:<dir>` 走 pnpm，`file:` 依赖是**硬链接复制**，改源码不生效（实测重启后仍是旧代码）。
- 解决：把 `profiles/tm-sandbox/node_modules/<pkg>` 换成指向工作区的 junction 后，重启即加载最新源码：
  ```powershell
  Remove-Item <profile>\node_modules\<pkg> -Recurse -Force
  cmd /c mklink /J <profile>\node_modules\<pkg> "E:\ZHIRAI Harness\dsh-token-manager\probe\hello"
  ```
- 正式安装（Phase 5/6）用 `plugin_manager install_bundle`，届时需用户明确授权，且必须针对隔离 profile 或经用户同意后再动生产 profile。

### 2.4 文件写入坑（已实测，影响所有后续阶段）

- `E:` 为 exFAT：`write` 工具写 `E:\...` 报 `EISDIR: illegal operation on a directory`（原子重命名不支持）。
  - 可靠做法 A：`write` 工具先写 `C:\Users\Administrator\AppData\Local\Temp\<file>`，再 `Copy-Item` 到 E:。
  - 可靠做法 B：pwsh 中 `[System.IO.File]::WriteAllText($path,$text,(New-Object System.Text.UTF8Encoding($false)))`。
- 本机 `pwsh` 实际是 **PowerShell 5.1**：`Set-Content -Encoding utf8` 会写 BOM。实测带 BOM 的 `package.json` 被 dsh 安装器拒绝：
  `installation rejected: Cannot validate installed package ... SyntaxError: Unexpected token '﻿' ... is not valid JSON`。

## 3. 官方扩展点目录（本机实测，非文档抄录）

### 3.1 可用 Host 事件（与 PRD 相关的）

| 事件 | 模式 | 实测签名 |
|---|---|---|
| `agent/created` | serial | `(payload: { agent; source; signal? }) => undefined \| Promise<undefined>` |
| `agent/disposed` | emit | `(payload: { agent }) => void` |
| `agent/pre-step` | waterfall | `(payload: { agent; messages: UserMessage[]; turn; step; signal }, next) => Promise<PreStepDecision>` |
| `agent/request` | waterfall | `(payload: { agent; turn; step; signal }, next) => Promise<LlmCallConfig>` |
| `agent/request-error` | waterfall | `(payload: {...; provider; failure; retryPolicy; signal }, next) => Promise<RequestErrorAction>` |
| `tools/pre-execute` | waterfall | `(exec, next) => Promise<PreToolDecision>` |
| `tools/execute` | waterfall | `(exec, next) => Promise<ToolExecutionResult>` |
| `tools/post-execute` | waterfall | `(exec, result, next) => Promise<PostToolDecision>` |
| `tools/result` | emit | `(exec, result) => undefined`（只读观察，符合 PRD 假设） |
| `session/event` | emit | `(session, event) => void`（提交后 fire-and-forget） |
| `llm/stream` | waterfall | `(options, next) => AsyncIterable<StreamChunk>` |
| `subagent/start` / `subagent/end` | emit | 子 Agent 生命周期 |
| `workflow/*` | emit | workflow 运行事件 |
| `compaction/summary-error` | waterfall | 摘要失败恢复 |

### 3.2 关键 Service

- `tokenMeter`：`measure(session, requestHeader?) → TokenMeasurement`（baseline kind: usage/estimated/none）、`estimateMessage(message) → number`。
- `tools`：`register(definition)`、`schemas(scope?)`、`execute(exec)`、`get(name)`、`restrict`、`guard`。
- `sessionProjections`：`register({key,stateSchema,init,apply,wire?,stateVersion})`、`snapshot(session, keys?)`、`stateOf`、`onChanged`。
- `sessionQuery` / `sessionPersistence` / `sessions`：历史会话查询与持久化。
- `storage` / `storageDomain` / `spillStore`：通用存储（`DSH_HOME/storages/*.json`）。
- `webServer.register(WebRoute)`：插件自定义 HTTP 路由（Host→Client 数据通道候选）。
- `settings`：profile 级设置文档（可做配置项持久化）。

### 3.3 与本产品直接相关的官方现有能力（重要：避免重复造轮子）

- `@deepseek-ai/dsh-token-meter`（active）：官方 token 计量。
- `@deepseek-ai/dsh-session-stats`（active，投影 key `sessionStats`）：turns/steps/llmMs/toolMs/ttftMs/decodeTokens。
- 官方投影 `tokenUsage`（见 §4）：`uncachedInputTokens / outputTokens / cacheReadTokens / cacheWriteTokens`。
- 官方投影 `contextPressure`、`contextBreakdown`：上下文压力与构成（system/tools/messages）。
- `@deepseek-ai/dsh-compaction-tool-result-pruner`（**disabled**）：官方已有“工具结果 head/middle/tail 剪枝”实现，但本机未启用 → Phase 2 与其是“可对比、可替代、默认不冲突”的关系，需在实现前读其实现作为参考并避免同时启用。
- `@deepseek-ai/dsh-compaction-basic`、`command-compact`（disabled）：官方压缩插件，本机未启用。
- `@deepseek-ai/dsh-repeat-tool-reminder`（active）：官方已有“重复工具调用提醒”，Phase 3 重复检测需与它协同，不得重复打扰模型。

### 3.4 生产 profile 的插件清单规模

`plugin_manager list_plugins` 共 **217** 条（分页 100/100/17）；bundles：`dsh-base`、`dsh-web-app`、voice-input、auto-review、agent-team、plugin-market、`dsh-pet`、`dsh-better-sidebar`、`dsh-mnemon@0.5.36`、`@local/zhirai-short-drama-agents`（disabled）。`dsh-mnemon` 的 10 个 row 全部 active。

## 4. 官方 Token 计量的真实数据（实测，Phase 1 交叉核对基准）

投影缓存文件：`C:\Users\Administrator\.dsh\storages\session_projcache\sessions\<sessionId>.json`
结构：`{ version, record: { identity: { formatVersion, createdAt, cwd, isSeeded, inheritedEventCount }, rows: { <projectionKey>: { ver, seq, val } } } }`

实测某真实会话的 `rows` key 全量：
`title, titleInput, llmRetry, sandboxMode, goal, tokenUsage, contextPressure, contextBreakdown, turnBoundary, inbox, sessionStats, turnOutline, agentPreset, userQuestions, permissions, workingDirectory, subagentCatalog, subagentTiming, subagent, agentTeam, timeContext, todos, plan, subagentModelSelectionPolicy, harnessDevLegacyPrompt, modelSelection, sessionListMetadata, imageLimits`

其中（原文）：
```json
"tokenUsage": {
  "ver": 2,
  "seq": 1084,
  "val": {
    "totals": { "uncachedInputTokens": 161013, "outputTokens": 210223, "cacheReadTokens": 38104320, "cacheWriteTokens": 0 },
    "last": { "turn": 3, "step": 53,
      "buckets": { "uncachedInputTokens": 168, "outputTokens": 637, "cacheReadTokens": 352256, "cacheWriteTokens": 0 } }
  }
}
```
```json
"contextPressure": { "val": { "surfaceTokens": 299445, "contextWindow": 1000000, "pressureTokens": 352424, "sampledSurfaceTokens": 299034 } }
"contextBreakdown": { "val": { "systems": [{ "seq": 8, "tokens": 1952 }], "surfaceTokens": 299445,
  "breakdown": { "systemTokens": 1952, "toolsTokens": 12872, "messageTokens": 297493 } } }
"sessionStats": { "val": { "turns": 3, "steps": 156, "llmMs": 1710230, "toolMs": 49956, "ttftMs": 237266,
  "ttftSteps": 156, "decodeMs": 1472964, "decodeTokens": 210223, "lastTurn": 3, "openStep": null, "pendingCalls": {} } }
```

结论（Phase 1 必须遵守）：
1. 官方口径里 **input 是“未命中”**：`uncachedInputTokens` 与 `cacheReadTokens`、`cacheWriteTokens` 分列 → 我们的 `input_tokens` 字段语义必须与之一致，并明确标注。
2. 该会话缓存命中量极大（38.1M cacheRead vs 0.16M uncached input），说明 DeepSeek 前缀缓存是本机成本结构的主导因素 → PRD 第九部分“KV Cache 保护”不是理论问题，是主要风险。
3. 每个会话都有历史投影缓存 → 可离线回溯“所有历史任务”统计；但缓存可能被裁剪，需与 `sessions/<cwd>/<sessionId>/session.v4.jsonl.zstd` 交叉验证。
4. 会话日志实际是 **zstd 压缩的 JSONL（v4）**，不是纯文本；离线导入需解压能力。

## 5. 工具链与构建可行性（Phase 1 起使用）

- npm registry 可访问；临时目录验证：
  - `typescript@7.0.2`、`esbuild@0.28.2` 安装成功（6s）。
- 结论：
  - Host 侧：TS 源码 → `tsc` 或 esbuild 打包成 ESM `dist/index.js`，运行时零第三方依赖（DSH 服务经 ctx 获取）。
  - Client 侧：TSX → esbuild 打包成浏览器模块，外层包 `window.__ModuleLoader__.load({ id, factory(require) {...} })`（详见 UI 审计 03-ui.md）。
- 注意：官方包类型定义在 app.asar 内，纯 Node 的 `tsc` **不能**直接读取 asar → 采用本地 `src/shared/dsh-types.d.ts` 按审计结果声明的 ambient 类型（保证可编译、可替换），不 import asar 内路径。

## 6. 生产环境限制（必须报告给用户）

- 隔离 profile（`tm-sandbox`）内 DeepSeek 账号鉴权失败：`[deepseek-account] request failed { path: '/auth-api/v0/users/current', status: 403, errorCode: 'network' }`，因此沙箱内无法完成真实 DeepSeek 模型调用；`llm-deepseek-api-key` 模型列表也 401。
- 影响：Phase 1 的“与官方统计交叉核对”若需要**新产生真实调用**，必须在生产 profile 验证（需用户授权安装）或改用本地/第三方 OpenAI 兼容模型（Ollama）。
- 已有历史会话的 usage 数据可直接离线读取 → 先做“历史数据回放式验收”，再做“实时调用验收”。

## 7. Phase 0 结论

| 核验项 | 结论 |
|---|---|
| DSH/Cordis 版本与插件目录规范 | ✅ 已确认（bundle + patch + ESM apply） |
| 客户端插件规范 | 由 ui-auditor 产出（03-ui.md） |
| `agent/pre-step` 实际签名 | ✅ 已确认（waterfall，`{agent,messages,turn,step,signal}`，详见 01） |
| `tools/post-execute` 实际签名 | ✅ 已确认（waterfall，`(exec,result,next)`，详见 01） |
| session/event usage 数据结构 | ✅ 已确认（`assistant/message.data.usage: TokenUsage`，详见 02） |
| 官方 Token Meter | ✅ 已确认（`tokenMeter.measure`、`tokenUsage` 投影、`sessionStats`） |
| dsh-mnemon 加载方式 | ✅ 已确认（bundle，10 rows active；注入链路详见 04） |
| 现有 compaction 插件 | ✅ 已确认（tool-result-pruner / compaction-basic / command-compact 均 disabled） |
| 隔离测试环境 | ✅ 已建立（tm-sandbox，可装、可启、可回滚） |
| 真实模型调用 | ⚠️ 沙箱鉴权受限，需用户授权或本地模型 |
