# 02 · Token 用量数据源审计（DSH 0.2.1-rc.5）

> 审计人：usage-auditor（Team 子任务 task-2）
> 采集时间：2026-11-01（Europe/Berlin），DSH `0.2.1-rc.5`，profile=`desktop`，`DSH_HOME=C:\Users\Administrator\.dsh`
> 审计方式（全部只读）：
> 1. `cordis_inspect_query(platform=host, provider=Service|Config)` 读取 live 服务契约与 `packageDir`；
> 2. 用 `read` 工具读 app.asar 内官方包绝对路径源码（包根：`C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness\resources\app.asar\dsh\node_modules\@deepseek-ai\`；下文简写为 `app.asar:dsh/node_modules/@deepseek-ai/<pkg>/<file>:<line>`）；
> 3. 把官方包 `lib/**/*.js` 只读复制到 `%TEMP%\dsh-src*` 后用 grep/read 定位行号（未改动 app.asar、未安装插件、未改 profile）；
> 4. 用 Node `node:zlib` 实解 `DSH_HOME\sessions` 下 218 个真实会话日志 + 实读 215 个投影缓存，做算术交叉核对（脚本见附录 B，未写入项目目录）。
> 证据等级：**A=源码原文有行号；B=本机真实数据实算；C=契约/服务签名；D=推断/未验证**。下文逐条标注。
> 唯一写入文件：`E:\ZHIRAI Harness\dsh-token-manager\docs\audit\02-usage.md`。

---

## 0. 结论速览（先看这 12 条）

1. **`TokenUsage.inputTokens` 是“未命中缓存”的输入 token，不含 cacheRead/cacheWrite。** 官方 DeepSeek 适配器把 provider 的 `input_tokens` 直接映射为 `inputTokens`，`cache_read_input_tokens → cacheReadTokens`、`cache_creation_input_tokens → cacheWriteTokens`，并在同一处算出 `totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens`（A：`app.asar:.../dsh-llm-deepseek/lib/index.js:1832-1845, 2017`）。投影层同样把它改名为 `uncachedInputTokens`（A：`dsh-token-meter/lib/types/usage-projection.js:14-19`）。
2. **`totalTokens` 在 DeepSeek 路线恒存在**；本机 50,886 条真实 `assistant/message.usage` 样本里 100% 带 `totalTokens`，且与该四桶之和 100% 相等（B）。但类型声明里它是 `optional`（A：`dsh-llm/lib/typert.host.js:608`），pi-ai 路线直接透传 provider 的 `totalTokens`（A：`dsh-llm-pi-ai/lib/index.js:1439-1445`），因此代码必须容错。
3. **`reasoningTokens` 在本版本 DeepSeek 路线不会出现**：适配器不写该字段，本机 50,886 条样本 0 条含 `reasoningTokens`；只有“读取/校验/展示”侧代码存在（A：`dsh-token-meter/lib/types/turn-usage.js:29`；`dsh-client-ui-chat/lib/client.js:6935-6938`）。语义（将来若出现）：**它是 `outputTokens` 的子集**（校验 `reasoningTokens <= outputTokens`；UI 显示“（其中推理 N）”）。→ 结论：**推理 token 接口未提供，已含在 outputTokens 内，禁止另加**。
4. **`assistant/message` 的 usage 与流里的 `usage` chunk 是同一份数据的两次落盘。** 事件结构：`{turn, step, message, stream, usage?, interrupted?}`；`stream` 里含 `{type:"chunk", chunk:{type:"usage", usage}}`（A：`dsh-session` 事件表声明 `app.asar:.../dsh-subagent/lib/typert.host.js:757`；写入处 `dsh-agent-loop/lib/index.js:1148-1162`）。`assistant/attempt` **没有顶层 usage**，只能从 `stream` 里的 usage chunk 拿（A：同处 1113-1135；读取封装 `dsh-token-meter/lib/types/usage-projection.js:60-66`）。
5. **正确去重键 = `(sessionId, turn, step)` + attempt 生命周期**（不是 `${sessionId}+turn+step+providerRequestId`）：成功调用的 `providerRequestId` **接口未提供**（只在 `LlmFailure.requestId` 上，仅失败才有，A：`EpochHeader`/`LlmFailure` 声明与 `dsh-llm-deepseek/lib/index.js:1783-1787`）。官方 tokenUsage 投影就是按 `(turn, step)` 覆盖式累加，并用 `llm/retry-started` 清空 last 槽（A：`dsh-token-meter/lib/types/usage-projection.js:86-119`）。真实数据中 `(sessionId, turn, step)` 的 `assistant/message` 重复数 = **0 / 50,886**（B）。
6. **`tokenMeter.measure()` 的 baseline 有三种**：`usage`（复用最近一次成功调用、且其上界不低于重放锚点的 provider 用量）/ `estimated`（4 字符/token 的启发式重放）/ `none`（无 header 且 surface 为空）；`totalTokens = max(0, baseline.tokens + surfaceDeltaTokens)`（A：`dsh-token-meter/lib/index.js:722-765`；`usageTokens()` 在 673-676）。
7. **官方“上下文压力/占比”链路**：`contextPressure`（provider 报的 prompt 侧压力 + 下一次请求投影，A：`dsh-token-meter/lib/types/usage-projection.js:120-188`）+ `contextBreakdown`（纯启发式三分类 system/tools/messages，A：`dsh-token-meter/lib/types/breakdown-projection.js:111-151`）。UI 在 composer 的圆环/面板里读这两个 key（A：`dsh-client-ui-conversation/lib/client.js:18681-18740`）。
8. **官方 Web UI 的 Token 用量有两个层级**：① 会话级 `UsagePill` 读 projection `tokenUsage`，显示 `billedInput(=uncached+cacheRead+cacheWrite) + output` 与缓存命中率（A：`dsh-client-ui-chat/lib/client.js:7635-7672`，`billedInputTokens` 定义在 7505）；② 单轮 `TurnUsagePanel` 由**前端用该轮事件在本地重算** `deriveTurnTokenUsage(...)`（A：`dsh-client-ui-chat/lib/client.js:11140-11147`；纯函数源码 `dsh-token-meter/lib/types/turn-usage.js:115-228`，client 子路径导出 `dsh-token-meter/lib/types/client.js:6`）。两者都不显示“费用”。
9. **`sessionProjections` 在本机组装里注册的 key 至少 29 个（官方 28 + 第三方 mnemon 1）**，其中 usage 相关 3 个：`tokenUsage`、`contextPressure`、`contextBreakdown`；另有耗时类 `sessionStats`（含 `decodeTokens`，但只是 output token 的计时用合计）、`turnOutline`。注意：`api-session-controller` 契约里显式声明的 client-visible key 只有 19 个（见 §4.3 开头），其余为 host-only / 其他包的声明合并；全表与出处见 §4.3。
10. **历史会话可完全离线回溯**：`DSH_HOME\sessions\--<cwd编码>--\<sessionId>\session.v4.jsonl.zstd`，是 **多帧拼接的 zstd 容器**，首帧恰好是 1 行 header，其后每帧是 JSONL 事件批次（A：`dsh-session-persistence-jsonl/lib/index.js:1288-1291, 1305-1368, 1898, 2297-2300`）。Node 24.14 的 `zlib.zstdDecompressSync` **可用但只能解单帧**，必须先用官方同款 `scanZstdFrames` 逻辑切帧再逐帧解压（B：本机 218 个日志全部成功解出，0 个 torn 尾帧）。
11. **本机历史总量（B，审计时点）**：217 个会话头（其中 196 个子 Agent 会话、0 个 fork/inherited），带 usage 的 `assistant/message` 约 5.08 万条（两次扫描分别为 50,803 / 50,886——会话仍在持续写入，数字会漂移），四桶合计 `uncachedInput=77,845,652 / output=38,006,128 / cacheRead=15,722,463,360 / cacheWrite=0`，**cacheRead 占计费 token 的 99.27%**。→ 任何“按 inputTokens 求和”的统计都会把用量低估约两个数量级。
12. **“费用/成本”数据官方接口未提供**：全部官方包内没有 token 单价表，唯一“钱”的数据是账号钱包余额 `{currency: CNY|USD, balance}`（A：`dsh-deepseek-account-platform/lib/types/details.js:12-15`）。费用只能由本插件维护可配置价格表（按 provider/model/bucket）自行计算，并标注“估算”。

---

## 1. 数据源清单

| # | 数据源 | 位置 / 获取方式 | 内容 | 证据 | 等级 | 审计建议 |
|---|---|---|---|---|---|---|
| S1 | `session/event` live 事件 | 插件 `ctx.on('session/event', (session, event) => …)`（需 `inject` 含对应服务；本会话 Lead 探针已实测） | 逐事件 `assistant/message`（含 usage）、`assistant/attempt`（含 stream）、`request/header`、`turn/step`、`llm/retry*`、`subagent/*`… | `dsh-session` 事件表；`dsh-agent-loop/lib/index.js:1148-1162` | A | **主采集源**：唯一能拿到“事件时间/轮次/步/模型路由”的实时来源 |
| S2 | `tokenMeter` 服务 | `ctx.tokenMeter.measure(session, requestHeader?)` / `.estimateMessage(message)` | `TokenMeasurement{logRevision,baseline{kind,tokens,usage?},surfaceDeltaTokens,totalTokens,surfaceTokens,nodes[]}` | `dsh-token-meter/lib/index.js:686-785`；契约见 §3.4 | A/C | 用于“上下文压力/预计下一次请求成本”，**不是计费口径** |
| S3 | 持久化投影缓存 | `DSH_HOME\storages\session_projcache\sessions\<sessionId>.json` | `{version,record:{identity:{formatVersion,createdAt,cwd,isSeeded,inheritedEventCount},rows:{key:{ver,seq,val}}}}`，实测 version=7、215 条记录 | 实读；`dsh-session-projection-cache/lib/index.js:15,67,90,127` | A/B | **官方口径的现成快照**，做交叉核对与“无需解压日志”的快速回溯 |
| S4 | 会话日志（真源） | `DSH_HOME\sessions\<projectKey>\<sessionId>\session.v4.jsonl.zstd` | 首行 header + 全部事件（含 usage） | `dsh-session-persistence-jsonl/lib/index.js:880-933, 1898` | A/B | 需要精确到“每次调用”或做审计对齐时使用；可离线 |
| S5 | `sessionProjections` 服务 | `ctx.sessionProjections.snapshot(session, keys?)` / `stateOf` / `cachedSnapshot` | 至少 29 个已注册 key（含 tokenUsage/contextPressure/contextBreakdown；全表见 §4.3） | 契约 `cordis_inspect_query(host,Service,sessionProjections)`；A：`dsh-token-meter/lib/index.js:694-696` | C/A | 插件内拿“官方同口径”数值的最短路径；`inject: ['sessionProjections']` |
| S6 | `sessionQuery` 服务 | `ctx.sessionQuery.readSession/listSessions/filterSessions/listEvents/readSurface/traceSession` | 无 live 会话时的只读回放（含 header 与全部事件） | 契约 `cordis_inspect_query(host,Service,sessionQuery)` | C | 在线回溯历史；不依赖自己解 zstd |
| S7 | `sessions` 服务 | `ctx.sessions.get/list` | **仅内存中的 live 会话**；持久化不在该服务内 | 契约描述原文 “In-memory session store… Persistence is intentionally not implemented here” | C | 不能用于历史回溯 |
| S8 | 事件流展示帧 | `agent/assistant-stream`（进程内 dispatch，非持久事件） | 实时 chunk 帧（含 usage chunk） | `dsh-agent-loop/lib/index.js:1079-1081` | A | 仅 UI 展示用，**不可用于计费**（断线丢失、无 seq） |
| S9 | Web API（官方 UI 用） | Gateway RPC 前缀 `/api`；流复用 WebSocket `/api/remote.mux`；客户端 `remote.session.projections({sessionId})`、`remote.session.follow(...)`、`remote.session.list(...)` | 投影值随 snapshot/follow 帧下发 | A：`dsh-api-gateway/lib/types/index.js:83`、`lib/types/stream-protocol.js:4`、`dsh-api-session-controller/lib/client.js:3191,431,3256` | A | 自建统计**不要**依赖此路由；仅用于交叉核对官方 UI 显示值 |
| S10 | 账号钱包 | `deepseek-account` 平台查询 | `{currency:CNY|USD, balance:string}` | A：`dsh-deepseek-account-platform/lib/types/details.js:12-15` | A | 与 token 用量无换算关系；**token 单价接口未提供** |

---

## 2. 字段语义表

### 2.1 `TokenUsage`（类型声明原文）

```ts
export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    reasoningTokens?: number;
}
```

出处：`app.asar:dsh/node_modules/@deepseek-ai/dsh-llm/lib/typert.host.js:608`（该版本包内未发布 `.d.ts`，此 declaration 字符串是官方生成的类型投影；同样的声明也出现在 `dsh-api-session-controller/lib/typert.host.js:3131`、`dsh-subagent/lib/typert.host.js:977`）。

| 字段 | 语义（本机 DeepSeek 路线） | 是否包含其它桶 | 证据 | 等级 |
|---|---|---|---|---|
| `inputTokens` | **未命中缓存的 prompt token**（provider `input_tokens` 原样） | **不含** cacheRead / cacheWrite；不含 output | `dsh-llm-deepseek/lib/index.js:1834-1844`；投影改名 `usage-projection.js:14-19`；实测 `13611+512+2=14125`、`34207+2816+886=37909` | A/B |
| `outputTokens` | 生成 token（含推理过程；pi-ai 明确 “reasoning folded into output”） | 包含 reasoningTokens（子集） | `dsh-llm-pi-ai/lib/index.js:1434-1445`；校验 `reasoning<=output` `turn-usage.js:29` | A |
| `totalTokens` | **prompt 全量 + output**；DeepSeek 路线 = 四桶之和；类型上 optional | 含全部四桶 | `dsh-llm-deepseek/lib/index.js:2017`；实测 50,886/50,886 相等 | A/B |
| `cacheReadTokens` | 命中前缀缓存、按缓存价计费的输入 token | 独立桶，不重复计入 input | 同上；`cacheRead` 占计费总量 99.27%（B） | A/B |
| `cacheWriteTokens` | 写入缓存的输入 token（DeepSeek 实测恒为 0） | 独立桶 | 同上；50,886 样本中字段存在但值 0 | A/B |
| `reasoningTokens` | **本构建不产生（接口未提供）**；若出现则为 output 的子集、只用于展示 | ⊂ output | 适配器无写入；`turn-usage.js:29`、`chat/client.js:6935` 仅读 | A/B |

### 2.2 事件字段

| 事件 | data 结构 | usage 来源 | 证据 | 等级 |
|---|---|---|---|---|
| `assistant/message` | `{turn, step, message, stream: AssistantStreamRecord[], usage?: TokenUsage, interrupted?: true}` | 顶层 `usage` = 适配器最后一次 `usage` chunk（`AssistantStreamAccumulator.usage`）；**同一对象也在 `stream` 的 `{type:'chunk', chunk:{type:'usage'}}` 里** | 声明：`dsh-subagent/lib/typert.host.js:757`（SessionEventMap 全文）；写入：`dsh-agent-loop/lib/index.js:1098-1112, 1148-1162`；取值：`dsh-agent-loop/lib/index.js:460-462` → `dsh-llm/lib/index.js:1096-1099`（`get usage()`），`lastAssistantStreamChunk` 在 `dsh-llm/lib/index.js:1411` | A/B |
| `assistant/attempt` | `{turn, step, stream}`（**无顶层 usage**） | 只能从 `stream` 内 usage chunk 读（4/45 条真实 attempt 有 usage chunk） | `dsh-agent-loop/lib/index.js:1113-1135`；读取：`usage-projection.js:60-66` | A/B |
| `request/header` | `{header: EpochHeader{config:{provider,model,…}, adapterDefaults?, tools?}, reason: 'initial'\|'resume'\|'change'\|'series', startsSeries?}` | —（路由来源） | `dsh-agent-loop/lib/index.js:1175-1189`；`EpochHeader` 声明见 §3.4 引用 | A |
| `request/context` | `{provider, model, contextWindow?, systemPromptUpdate?}` | —（上下文窗口来源） | `dsh-session` `RequestContext` 声明 | A |
| `llm/retry` | `{retryId, turn, step, provider, mode, policyKey, retry, maxRetries?, delayMs, failure}` | —（去重/重试归属必需） | `dsh-llm-retry/lib/types/index.js:105-132` | A |
| `llm/retry-started` | `{retryId, turn, step, retry}` | —（tokenUsage 投影清空 last 槽） | 同上 132；`usage-projection.js:91-96` | A |
| `subagent/catalog` | `{version, childId, childCreatedAt, mode, label}` | —（父子归属） | `dsh-subagent/lib/types/catalog.js:87-95` | A |
| `subagent/descriptor` | `{version:3, mode, provider, label, agentProvider?, agentModel?, agentReasoningEffort?, persona?, toolFilter?}`（写在**子会话**） | — | `dsh-subagent/lib/types/descriptor.js:30-45`；写入 `dsh-subagent/lib/index.js:1800` | A |
| `tool-workflow/run-start` | `{runId, name}` | — | `dsh-tool-workflow/lib/types/index.js:79-88` | A |
| `tool-workflow/agent-start` | `{runId, seq, label, phase?, childId}` | — | 同上 52-65 | A |
| `tool-workflow/agent-end` | `{runId, seq, outcome}` | — | 同上 66-77 | A |
| `tool-workflow/run-end` | `{runId, stopReason}` | — | 同上 84-88 | A |

### 2.3 “接口未提供”清单（缺失即写，不猜）

| 需求 | 官方是否有 | 结论 | 依据 |
|---|---|---|---|
| 成功调用的 `providerRequestId`（用于精确去重） | **无** | 只有 `LlmFailure.requestId`（失败才有）。`assistant/message` 无请求 id。可用 `assistant/message.data.message.id`（UUID，50,886/50,886 存在）作单消息唯一键 | `dsh-llm-deepseek/lib/index.js:1783-1787`（仅错误路径）；`dsh-llm/lib/types/message.js:34-38,64-72`；B |
| `reasoningTokens`（DeepSeek 值） | **无** | 适配器不产生；推理已折进 output | A/B（50,886 样本 0 条） |
| token 单价 / 单次费用 / 币种换算 | **无** | 无价格表；仅账户余额 | A：全包 grep 无 price/cost 表；`details.js:12-15` |
| 独立 `llm/stream` 持久事件 | **无** | 持久层只有 `assistant/message`/`assistant/attempt` 携带 `stream`；`agent/assistant-stream` 是进程内展示帧 | `known-event-types.js:21-84` 无该类型（A） |
| 历史“所有任务”的 usage 列表 API | **部分** | `sessionQuery.listSessions` 只给 header；`readSession` 给全事件（可自行求和）；SQLite 搜索索引不含 token 列 | `dsh-session-query-sqlite/lib/index.js:85-140`（仅 FTS 文本表） |
| 跨会话全局用量聚合 API | **无** | 官方只有 per-session 投影；全局需自己遍历 | A：projection 契约是 per-session |
| `subagent/start`、`subagent/end` 事件 | **无该名字** | 实际用：子会话 header（`parentSession/origin/delegationDepth`）+ 父会话 `subagent/catalog` + 子会话 `subagent/descriptor` + `subagentTiming` 投影 | `known-event-types.js:61-63`；A |
| session 级“父→子 token 汇总” | **官方无（但第三方有先例）** | mnemon 注册了 `mnemonSubagentTokenUsage`：按 `subagent/descriptor` 重置后折叠 usage，正是我们需要的归属范式 | `C:\Users\Administrator\.dsh\profiles\desktop\node_modules\dsh-mnemon\lib\index.js:16232-16270`（A） |

---

## 3. `tokenMeter` 实现细节

### 3.1 服务注册与投影注册（同一构造函数）

A：`app.asar:.../dsh-token-meter/lib/index.js:686-700`

```js
var TokenMeter = class extends Service {
  static Config = z.object({});
  static inject = ["sessionProjections"];
  constructor(ctx, config = {}) {
    super(ctx, "tokenMeter");
    validateConfigKeys(config);                       // 任何配置键都报错：没有设置项
    ctx.sessionProjections.register(tokenUsageProjectionDefinition);
    ctx.sessionProjections.register(contextPressureProjectionDefinition);
    ctx.sessionProjections.register(contextBreakdownProjectionDefinition);
    ctx.on("session/event", (session) => { if (this.states.has(session)) this._sync(session); });
  }
```

→ 插件注入方式：`export const inject = ['tokenMeter']`（硬依赖，`ctx.tokenMeter`），或 `ctx.get('tokenMeter')`（可选，需判空；服务契约 `access.optional` 已注明 `requiresUndefinedCheck`）。无任何 Config 键，写配置会抛错（A）。

### 3.2 `measure()` 语义（A：`lib/index.js:722-765`）

| 字段 | 语义 | 三条分支 |
|---|---|---|
| `baseline.kind='usage'` | 复用“最近一次成功调用的 provider 用量”，条件是：最新 `request/header` 的规范化 header 与锚点 header 相等，且 `usageTokens(usage) >= 重放后的锚点估计`（`estimateToolsTokens(header)+锚点 surface+assistant`） | 有锚点+header 匹配+用量不低于下界 |
| `baseline.kind='estimated'` | 固定启发式重放：tools 估算 + 整个 surface 的启发式价（4 字符/token，块结构 +4） | 有锚点但用量不达标；或 header 存在/表面非空却无锚点 |
| `baseline.kind='none'` | `tokens: 0`，仅在“没有 header 且 surface 为空”时 | 会话初始 |
| `surfaceDeltaTokens` | 当前 surface 价格 − 锚点时刻 surface 价格（即“这次采样之后新增/替换的差值”） | 有锚点分支；否则 0 |
| `totalTokens` | `max(0, baseline.tokens + surfaceDeltaTokens)` | 恒成立 |
| `surfaceTokens` | 当前 surface 的全部节点启发式（或路由）价格和 | 恒有 |
| `nodes[]` | `{seq, tokens, heuristicTokens}` 每个 surface 节点；`tokens` 可能被路由图片/文件定价改写，`heuristicTokens` 保留纯启发式原值 | 恒有 |
| `logRevision` | 已 fold 到的事件数（不是 seq 本身，但同步推进） | 恒有 |

锚点建立规则（A：`lib/index.js:844-861`）：只有 `assistant/message` 会刷新锚点；有 `event.data.usage` 且有 header 时锚点保存**该次调用的 provider 用量**，否则保存启发式 assistant 估计。

`usageTokens()`（A：`lib/index.js:673-676`）：

```js
/** Sum disjoint provider usage buckets without double-counting reasoning output. */
function usageTokens(usage) {
  return usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0) + usage.outputTokens;
}
```

→ 再次确认：**四桶互斥**（注释原文 “disjoint… without double-counting reasoning output”）。

### 3.3 `estimateMessage` / 启发式（A：`lib/index.js:16-18, 39-52, 73-76`；`lib/types/estimate.js`）

- `CHARS_PER_TOKEN = 4`；每块 `BLOCK_OVERHEAD = 4`；text/reasoning = `ceil(len/4)+4`；tool-call = `ceil(name/4)+ceil(args/4)+4`；system 消息 = `ceil(chars/4)+4`。
- 该启发式**同时**被 `contextBreakdown` 投影使用（A：`breakdown-projection.js:143-145`），因此“估算节省”标注必须声明：**它是固定密度估算，不是分词器，误差随语言/JSON/图片变化**；只适合做“相对节省”的展示，不能与 provider 计费数值混算。
- 实例方法 `tokenMeter.estimateMessage(message)` 即纯函数 face（A：`lib/index.js:783-785`）。

### 3.4 类型契约（官方 typert 投影）

```ts
export interface TokenMeasurement {
    readonly logRevision: SessionLogOffset;
    readonly baseline: TokenMeasurementBaseline;
    readonly surfaceDeltaTokens: number;
    readonly totalTokens: number;
    readonly surfaceTokens: number;
    readonly nodes: readonly TokenSurfaceNode[];
}
export type TokenMeasurementBaseline =
  | { readonly kind: 'none'; readonly tokens: 0 }
  | { readonly kind: 'estimated'; readonly tokens: number }
  | { readonly kind: 'usage'; readonly tokens: number; readonly usage: Readonly<TokenUsage> };
export interface TokenSurfaceNode { readonly seq: SessionSeq; readonly tokens: number; readonly heuristicTokens: number; }
```

（`cordis_inspect_query(host, Service, tokenMeter)` 返回的 `referencedTypes`；签名 `measure(session: Session, requestHeader?: EpochHeader): TokenMeasurement`。）

---

## 4. 官方“上下文压力 / Token 用量 / 费用”展示数据链路

### 4.1 浏览器侧读取方式

- 客户端拿到 projection 的方式是 React hook `useProjection("tokenUsage")` / `useProjection("contextPressure")` / `useProjection("contextBreakdown")`；值随会话 snapshot/follow 帧下发（A：`dsh-client-ui-chat/lib/client.js:7638`、`dsh-client-ui-conversation/lib/client.js:18727-18728`）。
- 客户端主动刷新投影的远程方法：`remote.session.projections({ sessionId }, signal)`（A：`dsh-api-session-controller/lib/client.js:3191`）；会话数据来自 `remote.session.follow(...)`（431）、`remote.session.list({})`（3256）。
- 传输层：Gateway RPC 前缀 `/api`（`dsh-api-gateway/lib/types/index.js:83`，`connection.rpc.intercept('/api', …)`），流复用固定 WebSocket 路径 `/api/remote.mux`（`lib/index.js:133`、`lib/types/stream-protocol.js:4`）。

### 4.2 Token 用量 UI（两个层级 + 上下文环）

| UI | 数据来源 | 关键行 |
|---|---|---|
| 会话级 `UsagePill`（右上角用量/缓存命中） | projection `tokenUsage`；总量 = `billedInputTokens(usage) + outputTokens`，`billedInput = uncachedInput + cacheRead + cacheWrite` | `dsh-client-ui-chat/lib/client.js:7505, 7635-7672` |
| 单轮 `TurnUsagePanel`（每轮脚的“本轮用量”对话框：provider/model、缓存命中%、未缓存输入、缓存读取、缓存写入、输出（其中推理）） | **本地重算**：`deriveTurnTokenUsage(该轮事件)`，不读投影 | `dsh-client-ui-chat/lib/client.js:6867-6944, 11140-11147`；算法 `dsh-token-meter/lib/types/turn-usage.js:115-228` |
| 会话 `sessionStats`（turns/steps/llm 时间/tool 时间/TTFT/速度） | projection `sessionStats`；`decodeTokens` 只是“有 usage 的步”的 output 合计，用于算 tok/s | `dsh-session-stats/lib/types/projection.js:27-36, 100-122, 154-166`；UI `dsh-client-ui-chat/lib/client.js:7620-7633` |
| composer 上下文占用环 + 三分类面板 | projection `contextPressure`（百分比）；`contextBreakdown`（system/tools/messages 三段） | `dsh-client-ui-conversation/lib/client.js:18681-18740` |
| 费用/成本 | **无任何展示**（全局 grep 官方包无 token 价格表） | 见 §2.3 |

### 4.3 `sessionProjections` 当前注册 key 全表（读注册处源码）

> 契约：`ctx.sessionProjections.register(definition)`；`definition.key` 若在 `SessionProjectionMap` 里则对外可见，否则 host-only。下表“可见性”以 §4.3 的 `SessionProjectionMap` 声明为准。

`SessionProjectionMap` 官方声明（`app.asar:.../dsh-api-session-controller/lib/typert.host.js:2887` 的 declaration 字符串；**这是该包契约里可达的 19 个 client-visible key，不是运行时全部 key**）：
`inbox, workingDirectory, agentPreset, title, todos, sessionListMetadata, imageLimits, modelSelection, permissions, subagentCatalog, subagentTiming, subagent, tokenUsage, contextPressure, contextBreakdown, agentTeam, userQuestions, goal, plan`。

下表按“注册处源码”给出本机组装实际会注册的 29 个 key（含 host-only 与其他包声明合并的 key；以 live 注册表为准）：

| key | 注册处（A） | 与 token 的关系 |
|---|---|---|
| `tokenUsage` | `dsh-token-meter/lib/index.js:694`（key 定义 `lib/types/usage-projection.js:87`） | **官方会话/轮次用量口径** |
| `contextPressure` | 同 695（`usage-projection.js:142`） | prompt 侧压力 + 下一次请求预测 |
| `contextBreakdown` | 同 696（`breakdown-projection.js:112`） | 纯启发式三分类 |
| `sessionStats` | `dsh-session-stats/lib/index.js:195`；key `lib/types/projection.js:67` | 耗时/步数；`decodeTokens`=output 合计 |
| `turnOutline` | `dsh-session-turn-outline/lib/index.js:164` | 轮次大纲（无 token） |
| `turnBoundary` | `dsh-agent-loop/lib/index.js:1581`（key 1366） | 轮次边界，辅助切分 |
| `inbox` | 同 1583（key 27） | 待处理输入（无 token） |
| `agentPreset` | `dsh-agent-preset-registry/lib/index.js:454`（key `lib/types/session.js:20`） | 预设名（可按预设归因） |
| `sessionListMetadata` | `dsh-api-session-controller/lib/index.js:1907`（key `lib/types/list.js:67`） | 列表元数据（blank、lastPromptAt） |
| `imageLimits` | 同 1922（key `list.js:76`） | 图片限额 |
| `modelSelection` | `dsh-api-session-controller/lib/index.js:2198`（key `lib/types/model-selection-projection.js:43`） | lastUsed provider/model（可辅助归因） |
| `subagentCatalog` | `dsh-subagent/lib/index.js:3010`（key `lib/types/catalog.js:70`） | 父会话的直属子目录（归属） |
| `subagentTiming` | 同 3011（key `lib/types/projection.js:39`） | 子 Agent 活跃时长（**无 token**） |
| `subagent` | 同 3012（key `lib/types/projection.js:143`） | 子会话的 mode/label 身份（归属） |
| `subagentModelSelectionPolicy` | `dsh-tool-subagent/lib/index.js:361` | 子 Agent 模型策略（归属辅助） |
| `agentTeam` | `dsh-experimental-agent-team/lib/index.js:1474`（key `types/projection.js:320`） | Team 成员/任务（归属） |
| `permissions` | `dsh-permission-presets/lib/index.js:188` | 权限预设 |
| `sandboxMode` | `dsh-sandbox-policy/lib/index.js:114` | 沙箱模式 |
| `workingDirectory` | `dsh-working-directory/lib/index.js:30` | cwd 变化 |
| `goal` | `dsh-goal/lib/index.js:597` | 目标 |
| `plan` | `dsh-plan-mode/lib/index.js:178` | 计划模式 |
| `llmRetry` | `dsh-llm-retry/lib/index.js:88` | 重试状态（去重辅助） |
| `todos` | `dsh-tool-todo/lib/index.js:80` | 待办 |
| `userQuestions` | `dsh-user-questions/lib/index.js:492` | 提问 |
| `timeContext` | `dsh-time-context/lib/index.js:181` | 时间上下文 |
| `title` / `titleInput` | `dsh-session-title/lib/index.js:235-236` | 标题/首个输入 |
| `harnessDevLegacyPrompt` | `dsh-harness-dev-context/lib/index.js:87`（常量 `LEGACY_PROMPT` 在 45） | 开发上下文段落 |
| `mnemonSubagentTokenUsage`（**第三方**，非官方） | `C:\Users\Administrator\.dsh\profiles\desktop\node_modules\dsh-mnemon\lib\index.js:16266-16269` | **子 Agent token 归属的现成先例**（见 §7.3） |

> 说明：实测 projcache 里还能看到 `llmRetry / sandboxMode / sessionStats / turnOutline / harnessDevLegacyPrompt / mnemonSubagentTokenUsage` 等行，说明这些 key 在当前 desktop 组装里确实被注册过；**以 live 注册表为准**（插件可注册/卸载，注册是 fiber effect）。

---

## 5. 去重与归属算法建议（伪代码）

### 5.1 去重键与规则（核心结论）

- **去重键：`(sessionId, turn, step)`**。同一 `(session, turn, step)` 下 `assistant/message` 只会 settle 一次；重试时 `assistant/attempt` + `llm/retry`/`llm/retry-started` 负责把“失败的尝试”与“最终成功”分开。
- **不要**使用 `providerRequestId`：成功路径不提供（§2.3）。
- **不要**把 `stream` 里的 usage chunk 与顶层 `usage` 相加：它们是同一份数据（B：本机 56/56、57/57 采样 `streamUsageEqual=true`）。
- 同一 `(turn,step)` 的重复 `assistant/message` 在真实数据中为 0（B），但投影实现仍做了覆盖式保护（A：`usage-projection.js:106-116`）。
- `reasoningTokens` 永远不计入 total（本构建也不会出现）。

### 5.2 实时采集（插件内，主路径）

```ts
// 依据：dsh-token-meter/lib/types/usage-projection.js:60-119 与 turn-usage.js:115-228 的官方状态机
type CallUsage = {
  sessionId: string; turn: number; step: number;
  provider: string; model: string;            // 来自 assistant/message.data.message.source
  inputTokens: number; outputTokens: number;
  cacheReadTokens?: number; cacheWriteTokens?: number;
  totalTokens?: number;                        // 官方口径：input+output+cacheRead+cacheWrite
  observedAt: number; seq: number;
};

const seen = new Map<string, CallUsage>();     // key = `${sessionId}#${turn}#${step}`
const attempts = new Map<string, CallUsage[]>();// key 同上；存失败/重试 attempt 的 usage

onSessionEvent(session, e) {
  const sid = session.id;

  if (e.type === 'assistant/attempt') {          // 失败的尝试：无顶层 usage
    const u = lastUsageChunk(e.data.stream);     // 见 §5.3
    if (u) attempts.set(`${sid}#${e.data.turn}#${e.data.step}`)?.push(toCallUsage(sid, e, u));
    return;
  }

  if (e.type === 'assistant/message') {
    const u = e.data.usage ?? lastUsageChunk(e.data.stream); // 顶层优先，stream 兜底
    if (!u) return;                                          // 无 usage：计费缺失，记 warning
    const key = `${sid}#${e.data.turn}#${e.data.step}`;
    const call = toCallUsage(sid, e, u);            // provider/model 从 message.source 取
    const prev = seen.get(key);
    if (prev && sameBuckets(prev, call)) return;    // 完全重复 → 丢弃（官方 also 如此）
    seen.set(key, call);                            // 覆盖式（同一 turn/step 只保留最终 settle）
    emit('usage.call', call);
    return;
  }

  if (e.type === 'llm/retry-started') {
    // 新 attempt 开始：把该 (turn,step) 的“最终 settled”候选清空，避免把重试前样本当最终值
    const key = `${sid}#${e.data.turn}#${e.data.step}`;
    seen.delete(key);
  }
}
```

伪代码中的 `toCallUsage` 细节：

```ts
function toCallUsage(sid, e, u): CallUsage {
  return {
    sessionId: sid, turn: e.data.turn, step: e.data.step,
    provider: e.data.message.source.provider,   // 'deepseek-account' 等，禁止硬编码
    model:    e.data.message.source.model,      // 'deepseek-flash'
    inputTokens: u.inputTokens, outputTokens: u.outputTokens,
    ...u.cacheReadTokens  === undefined ? {} : { cacheReadTokens:  u.cacheReadTokens },
    ...u.cacheWriteTokens === undefined ? {} : { cacheWriteTokens: u.cacheWriteTokens },
    totalTokens: u.totalTokens
      ?? u.inputTokens + u.outputTokens + (u.cacheReadTokens ?? 0) + (u.cacheWriteTokens ?? 0),
    observedAt: e.time, seq: e.seq,
  };
}
```

### 5.3 `lastUsageChunk` 与“总量”口径

```ts
function lastUsageChunk(stream: AssistantStreamRecord[]): TokenUsage | undefined {
  for (let i = stream.length - 1; i >= 0; i--) {
    const r = stream[i];
    if (r.type === 'chunk' && r.chunk.type === 'usage') return r.chunk.usage;
  }
  return undefined;
}
const billedTokens = (u) =>
  u.inputTokens + u.outputTokens + (u.cacheReadTokens ?? 0) + (u.cacheWriteTokens ?? 0);
// 注意：billedTokens 与 provider 的 totalTokens 同义（DeepSeek 路线）；pi-ai 路线以 provider totalTokens 为准。
```

官方等价实现：`dsh-llm/lib/index.js:1411`（`lastAssistantStreamChunk`）；`dsh-token-meter/lib/types/turn-usage.js:18-20, 39-58`（`streamUsage` + `normalizeUsage` 的总量校验）。

### 5.4 Turn 级汇总（对齐官方 `deriveTurnTokenUsage`）

```ts
// 官方语义（dsh-token-meter/lib/types/turn-usage.js:115-228）：
// - 一个 turn = 若干 attempt：assistant/attempt 关闭一次 attempt；assistant/message 结算最终 attempt
// - 缺任何生命周期边界、usage 不完整、数字不安全、总量自相矛盾 → 整个 turn 的精确用量返回 undefined
// - 输出：{uncachedInputTokens, outputTokens, totalTokens, cacheReadTokens?, cacheWriteTokens?,
//          reasoningTokens?, routes?: [{provider,model}]}
// 关键校验（turn-usage.js:21-58）：
//   knownPrompt = inputTokens + cacheRead + cacheWrite
//   totalTokens 存在时：totalTokens - outputTokens >= knownPrompt；
//     且当两个 cache 桶都存在时要求 exactPrompt === knownPrompt（否则判为不可信 → 整轮不披露）
//   两个 cache 桶都缺失时：无法推导总量 → 该轮不可信
//   reasoningTokens 存在时必须 <= outputTokens
```

→ 建议插件对“轮次用量”直接复用这套规则（可作为“官方口径一致性”的验收断言）。

### 5.5 子 Agent 归属

```ts
// 归属键：child session header（origin==='subagent'）→ parentSession；delegationDepth 表示层级
// 父会话的 subagent/catalog 已经给出 childId（可离线构建父子图，无需 live 服务）
// 归属算法：
attributionOf(sessionHeader) =
  sessionHeader.origin === 'subagent'
    ? { kind: 'subagent', parentSessionId: sessionHeader.parentSession,
        delegationDepth: sessionHeader.delegationDepth ?? 0 }
    : { kind: 'root' };

// 报表：
//   root 直接用量   = Σ usage.call(session = root)
//   root 子树用量   = Σ usage.call(session ∈ subtree(root))     // 含所有后代
//   子树构建        = header.parentSession 邻接表（离线可算）
//   Team/workflow   = 同一子树，用 team/member、tool-workflow/agent-start 的 childId 加注
```

注意：**fork/inherited（`isSeeded=true`）会话的投影 totals 会包含继承前缀**（`tokenUsage` 的 `init` 不按 `inheritedEventCount` 过滤，A：`usage-projection.js:90,145`），因此子树求和或“全部历史”求和时必须排除 inherited 前缀或直接跳过 seeded 会话；本机当前 0 个 seeded 会话，但代码必须处理。

---

## 6. 官方口径交叉核对方案

### 6.1 三层核对（建议实现为插件的自检）

| 层 | 参考值 | 取法 | 预期关系 |
|---|---|---|---|
| L1 事件级 | 插件自己按 §5 采集的 `Σ billedTokens` | `session/event` 或离线解码 | 应与 L2 的 `tokenUsage.totals` **逐桶相等**（同 `asOfSeq` 切点） |
| L2 投影级 | `tokenUsage` 投影（live `sessionProjections.snapshot` 或 projcache 行） | `{totals:{uncachedInputTokens,outputTokens,cacheReadTokens,cacheWriteTokens}, last}` | 与 L1 相等；`last` 是最后一步样本，便于定位偏差 |
| L3 UI 显示 | `UsagePill` 展示 `(uncached+cacheRead+cacheWrite)+output` 与缓存命中率 | 直接读官方 UI 或 `remote.session.projections` | 与 L1/L2 一致（缓存命中率 = `cacheRead/(total-output)`，A：`chat/client.js:6882,7497`） |

### 6.2 具体步骤（官方 UI 侧）

1. 打开会话，记下右上角 `UsagePill` 的紧凑值（K/M）与 hover 对话框的精确值（`data-session-stats-usage` 的 `<dl>` 已给精确数）。
2. 调 `remote.session.projections({sessionId})`（或在插件里 `ctx.sessionProjections.snapshot(session, ['tokenUsage'])`）取 `tokenUsage`。
3. 与插件本地 `Σ usage.call` 对比四桶；不一致时按 `asOfSeq` 对齐（取同一 seq 前缀重算）。
4. 单轮视图：展开某轮 `TurnUsagePanel`（`data-turn-usage-details`），与插件对同一 `(turn)` 的汇总对比；该面板是**纯前端重算**，因此若插件与 `deriveTurnTokenUsage` 规则一致就必然一致（可用于回归验收）。

### 6.3 已做过的实测交叉核对（B）

| 核对项 | 结果 |
|---|---|
| 50,886 条 `assistant/message.usage` 的 `totalTokens === input+output+cacheRead+cacheWrite`（另一次扫描 50,803 条，结论相同——会话持续写入导致样本数漂移） | 50,886 通过 / 0 失败 |
| usage 字段集合 | 100% 恰为 `{inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, totalTokens}`（**无 reasoningTokens**） |
| `(sessionId,turn,step)` 重复 `assistant/message` | 0 |
| `assistant/message` 的 message.id 存在率 | 100% |
| `assistant/attempt` 携带 usage chunk | 4 / 45（其余 41 条是未能拿到 usage 的失败尝试 → 不应计入） |
| `llm/retry` | 36 条（历史确实存在重试，去重逻辑必须覆盖） |
| 日志汇总 vs projcache 汇总 | 日志：`{input:77,845,652, output:38,006,128, cacheRead:15,722,463,360, cacheWrite:0}`；projcache 215 行：`{83,921,694, 39,630,807, 16,620,294,784, 0}` → 聚合差 ≈ 5.7%；需要**按会话+seq 水位逐条核对**，不能直接相加（见 §9 R2/R3） |
| cacheRead 占比 | 日志口径 99.27%（15.72B / 15.84B） |

---

## 7. 历史会话回溯可行性

### 7.1 存储位置与格式（A/B）

- 根目录来自 `sessionPersistence` 的 Config `root`（`dsh-session-persistence-jsonl/lib/index.js:3613-3617`：`root` required、`compression` 默认 `zstd`、`listConcurrency`）。本机实测 `root = C:\Users\Administrator\.dsh\sessions`。
- 目录编码（A：`lib/index.js:880-899` `projectKey`）：cwd 里的 `/ \ :` 连续段替换为 `-`，其余非 `[A-Za-z0-9._-]` 字符编码为 `~XXXX`（大写十六进制），整体包成 `--…--`，截断到 251 字符；无 cwd → `_no-cwd`。
  - 例：`E:\ZHIRAI Harness` → `--E-ZHIRAI~0020Harness--`；`D:\AI-Content-OS\AI-Content-OS` → `--D-AI-Content-OS-AI-Content-OS--`。
  - 注意：编码对分隔符是**有损**的，不能反推原始 cwd；但 header 行里有精确 `cwd`。
- 会话目录：`<projectDir>/<encodeSegment(sessionId)>/session.v4.jsonl.zstd`（A：`919-933`；sessionId 编码规则 `858-870`，`~XXXX` 转义，防路径穿越）。
- Header 行（A：`782-845`）：必填 `type:"session", version:4, id, createdAt, isSeeded, delegationDepth`；可选 `cwd, parentSession, origin:'subagent', agentPreset`。
- 物理编码（A：`1288-1291`）：“concatenated-frame container so it can append and recover batches”；**首帧恰好是 1 行 header**（`1898`、`2297-2300`），后续帧是 JSONL 批次；每帧独立可解且带 checksum（`1370-1376`）。

### 7.2 离线解码可行性（B，已验证）

- Node 24.14 内置 `zlib.zstdDecompressSync` **可用**，但它是**单帧**接口：直接对整文件解压只会得到首帧（实测只拿到 198 字节 header 行）。必须复刻官方的 `scanZstdFrames()` 切帧（A：`1305-1368`），再逐帧 `zstdDecompressSync`（官方 public 回退实现 A：`1252-1284`）。
- 实测：`C:\Users\Administrator\.dsh\sessions` 下 **218 个日志、217 个会话头、196 个 subagent 子会话、0 个 torn 尾帧**，全部成功解出；脚本见附录 B。
- 结论：**不依赖 DSH 进程即可离线统计“所有历史任务”**；代价是 `<cwd编码>` 与 `<sessionId>` 两段目录名需要按官方规则定位（也可以直接遍历，不强依赖编码规则）。

### 7.3 三种回溯路线对比

| 路线 | 数据完整度 | 成本 | 适用 |
|---|---|---|---|
| A. 解 zstd 日志（自研解码器，附录 B） | 最全：每次调用、seq、turn/step、provider/model、失败 attempt、重试、父子关系全在 | 需解压 15.7B 级 cache 数据量（本机 218 文件 ≈ 秒级~十秒级） | “所有历史任务”精确统计、审计对账 |
| B. 读 projcache（官方投影快照） | 会话级 `tokenUsage.totals` + 水位 seq；不含逐调用明细 | 极低（175KB/会话 JSON 量级；本机 215 个文件） | 快速看板、与官方数字对账；**注意可能被裁剪/滞后** |
| C. `sessionQuery.readSession/listSessions`（服务） | 同 A（事件级），但需 live host | 零解码成本 | DSH 在线时回溯；插件内首选 |

### 7.4 `sessionQuery` / SQLite 索引的能力边界（A/C）

- `sessionQuery`：`listSessions()` 只返回 `SessionRecord{header, live, persisted, formatStatus}`（无 usage）；`readSession()` 返回**全部事件**（可求和）；`listEvents()` 只返回 `{sessionId, seq, type, time, surface}`（**无 data/usage**）；`filterEvents()` 返回带 text 的语义文档（同样无 usage）。
- SQLite 索引（`dsh-session-query-sqlite`）只为全文检索：`persisted_sessions` + FTS5 `persisted_docs(text, session_id, seq, type, time, surface, codepoint_length)`（A：`lib/index.js:85-140`）——**没有 token 列**；DB 路径是必填配置 `path`（A：`478-497`），由 launcher 的 boot 槽 `launcherSessionQueryPath` 注入（A：`466-467`），不是可枚举的固定文件（本机 `DSH_HOME` 内未发现该 sqlite 文件，说明由启动器放在别处或内存/临时路径；**该文件位置未验证**）。
- → 想要“历史 usage”，必须走事件级（日志或 `readSession`），SQLite 索引帮不上。

---

## 8. 子 Agent / Agent Team / workflow 的归属

### 8.1 事实（A）

1. **没有 `subagent/start|end` 事件**；`KNOWN_SESSION_EVENT_TYPES` 里与子 Agent 相关的是 `subagent/catalog`、`subagent/descriptor`、`subagent/model-selection-policy`（`dsh-session/lib/types/known-event-types.js:61-63`）。
2. 子会话 header 由 `childSessionMeta()` 生成：`{cwd 继承, agentPreset, parentSession: parent.id, isSeeded, origin:'subagent', delegationDepth: childDepth}`（A：`dsh-subagent/lib/types/child-agent.js:107-121`；`delegationDepthOf` 见 `lib/types/depth.js:18-25`，`childDepth = parent+1`）。
3. 父会话在建立子会话时 append `subagent/catalog`（`{version, childId, childCreatedAt, mode, label}`，A：`lib/types/catalog.js:87-95`），对应投影 `subagentCatalog`（`lib/types/catalog.js:69-80`）。
4. 子会话在首个 turn 内 append `subagent/descriptor`（version 3，含 `mode/provider/label` + continuable 时的 `agentProvider/agentModel/agentReasoningEffort/persona/toolFilter`，A：`lib/types/descriptor.js:30-45`；写入 `lib/index.js:1800`），对应投影 `subagent`（identity，`projection.js:142-156`）。
5. `subagentTiming` 只有 `settledMs/active`（**无 token**，A：`projection.js:38-57`）。
6. **Agent Team**：`team/member`、`team/task`、`team/message/queued|delivered` 等事件（`known-event-types.js:65-68`），投影 `agentTeam`（key A：`dsh-experimental-agent-team/lib/index.js:728`）。真实会话中确实出现（本次 E:\ZHIRAI Harness 的父会话里 `team/task: 8, team/member: 8`）。
7. **workflow**：`tool-workflow/run-start|run-end|agent-start|agent-end` 是**父会话里的 log-only 事件**，带 `runId`、子 Agent 的 `seq/label/phase/childId`（A：`dsh-tool-workflow/lib/types/index.js:52-91`），**不含任何 token 字段**。workflow 派生的子 Agent 本身也是 `origin:'subagent'` 的子会话（`@deepseek-ai/dsh-workflow-ptc` 通过 subagent runtime 拉起），所以 token 仍按子会话归属。
8. 既有先例：**mnemon 的 `mnemonSubagentTokenUsage` 投影**正是“从 `subagent/descriptor` 起算、按 `(turn,step)` 覆盖累加”的子 Agent token 归属实现（A：`...\dsh-mnemon\lib\index.js:16232-16270`），可直接作为我们算法的官方风格参照。

### 8.2 归属算法建议

```ts
// 图模型（离线可建，来自 header + 两类事件）
type Node = { sessionId: string; parent?: string; depth: number; origin?: 'subagent' };
// edges: header.parentSession；附加注解：subagentCatalog(childId,label,mode)、
//        tool-workflow/agent-start(childId,label,runId,phase)、team/member(memberId,...)

rootOf(id) = follow(parent) until undefined;
subtree(id) = all sessions whose ancestor chain contains id;
usage(rootInclusive) = Σ over subtree(root): Σ usage.call(session)   // 排除 isSeeded 前缀
teamUsage(turnScope) = Σ usage.call over members attributed to that team/run
```

归属规则建议（按优先级）：
1. `header.origin === 'subagent'` → 归父 `parentSession`（多级则逐级上卷，`delegationDepth` 校验）；
2. `tool-workflow/agent-start.childId` → 叠加“流程 runId/label”标签；
3. `team/member` → 叠加团队/角色标签；
4. 无上述标记 → root 会话。  
所有上卷同时输出“含子树”和“不含子树”两个口径，避免把子 Agent 成本重复算入 root 直接成本。

---

## 9. provider / model 名称获取路径

| 途径 | 字段 | 可用性 | 证据 |
|---|---|---|---|
| `assistant/message.data.message.source` | `{kind:'model', provider, model, replayState?}` | **最可靠**（每次成功调用的实际路由） | A：`dsh-llm/lib/types/message.js:64-72`；真实样本 `{provider:"deepseek-account", model:"deepseek-flash"}`（B） |
| `request/header.data.header.config` | `{provider, model, reasoningEffort?, temperature?, maxTokens?, stop?}` + `adapterDefaults` | 请求前记录，`reason ∈ initial/resume/change/series` | A：`dsh-agent-loop/lib/index.js:1175-1189`；Lead 探针实测 `request/header(reason=initial)` |
| `request/context` | `{provider, model, contextWindow?}` | 提供 contextWindow（压力分母） | A：`RequestContext` 声明；`contextPressure` 用 `request/context.contextWindow` 作分母（A：`usage-projection.js:149-159`） |
| `modelSelection` 投影 | `lastUsed:{provider, model, reasoningEffort?}` | 会话级“最后使用” | A：`api-session-controller/lib/types/model-selection-projection.js:43`；实测 projcache 有该行 |
| 子 Agent 路由 | 子会话自己的 `assistant/message.source`；descriptor 的 `agentProvider/agentModel` 是**创建时的意图**，实际以 source 为准 | A | `descriptor.js:38-45` |
| 硬编码 provider 名 | **禁止** | 生产 desktop: `deepseek-account`；沙箱 resume 时也曾出现 `deepseek-official` → 名字随组装/连接变化 | B（本机日志 + Lead 探针） |

价格表设计必须 `(provider, model, bucket)` 三维可配置，且未配置时显示“未定价”，不要用默认价格猜。

---

## 10. 风险清单

| # | 风险 | 影响 | 证据 | 缓解 |
|---|---|---|---|---|
| R1 | 把 `inputTokens` 当“总输入” | **严重低估约 2 个数量级**（实测 cacheRead 占计费 99.27%） | B | 一律 `billed = input + cacheRead + cacheWrite + output`；展示时单列“未缓存输入/缓存读/缓存写” |
| R2 | `totalTokens` 视为必有 | pi-ai/未来适配器可能缺 → NaN | A：类型 optional；实测 DeepSeek 恒有 | 缺失时用四桶求和兜底并标记“推导值” |
| R3 | 直接把各会话 projcache totals 相加当“全部历史” | 与日志口径差 ≈5.7%（本机实测），含已删除会话/滞后/裁剪/重复 | B | 以会话为键做 `(id, asOfSeq)` 对账；差异行标记；优先日志真源 |
| R4 | 忽略 fork/inherited（`isSeeded`） | 同一段 usage 在父子会话重复计 | A：`tokenUsage.init` 不过滤 inherited；`usage-projection.js:90,145` | 跳过 seeded 会话或减去 `inheritedEventCount` 前缀；本机当前 0 个 seeded，但必须实现 |
| R5 | 把 stream 的 usage chunk 和顶层 usage 都算一次 | 翻倍 | A/B：同一对象（56/56 采样相等） | 顶层优先，stream 仅兜底 |
| R6 | 忽略重试 attempt | 漏计失败尝试的 token（provider 已计费） | B：历史 45 条 attempt、36 条 retry | 用 `llm/retry`/`llm/retry-started` 生命周期结算 attempt；官方 `deriveTurnTokenUsage` 是正确参照 |
| R7 | 以为有 `providerRequestId` 可去重 | 逻辑无法实现 | A | 用 `(sessionId,turn,step)` + `message.id` 兜底 |
| R8 | 期待 `reasoningTokens` | UI 会长期空；若将来出现，误加成 total 会重复计费 | A/B | 定义为 output 子集，永不并入 total；字段缺失时不展示 |
| R9 | 用 `tokenMeter.totalTokens` 当计费 | 它含 `baseline.estimated` 分支与 heuristic surface，不是 provider 账单 | A：`measure()` docstring 明说 provider usage 只在匹配且不低于下界时复用 | 仅用于“上下文压力/下一次请求预估”，计费只认 `TokenUsage` |
| R10 | 用启发式 `estimateMessage` 标注“节省” | 与真实分词误差随语言/JSON/图片变化 | A：`CHARS_PER_TOKEN=4` | 标注“估算”；仅做相对比较；不要与 provider 数直接相加 |
| R11 | 硬编码 provider/价格 | 沙箱/生产/连接方式不同名（`deepseek-account` vs `deepseek-official`） | B | 以 `message.source` 记录实际路由；价格表可配置 |
| R12 | 把 SQLite 搜索索引当 usage 源 | 索引无 token 列 | A：`query-sqlite:85-140` | 用日志/`readSession`/projcache |
| R13 | 依赖 `agent/assistant-stream` 展示帧统计 | 进程内、断线丢失、无 seq | A | 只做 UI 流式展示 |
| R14 | 压缩帧解析错误（单帧解压） | 只能拿到 header，statistics 全 0 | B | 复刻 `scanZstdFrames`（附录 B），逐帧解；校验 checksum |
| R15 | 直接读正在写入的日志 | 尾部 torn 帧 / 缓存领先 | 官方有恢复逻辑（`zstd.js:1394-1401` 等） | 允许“torn 尾帧”并丢弃不完整帧；或用 projcache+seq 对齐 |
| R16 | 费用数据 | 官方**无** token 单价 | A：全包无价格表；只有钱包余额 | 插件内可配置价格表；显示“估算/未定价”；不要声称官方口径 |
| R17 | E 盘 exFAT 写文件 | `write` 工具可能报 EISDIR；PS 5.1 `Set-Content -Encoding utf8` 带 BOM | 本机/Lead 实测 | 写 `%TEMP%` 后 `Copy-Item`；或 `[System.IO.File]::WriteAllText(..., UTF8Encoding($false))`；回读校验 |
| R18 | 插件 `inject` 缺服务 | entry 不激活且只有 warning，容易误判“插件没工作” | Lead 实测（00 文档 §2.1） | 显式 `inject: ['tokenMeter','sessionProjections']`，可选服务用 `ctx.get()` + 判空 |

---

## 11. 未验证项与下一步

| 项 | 状态 | 建议 |
|---|---|---|
| 沙箱 profile 真实 DeepSeek 调用 | **已可用**（Lead 实测：`tm-sandbox` 可调 `deepseek-account`；先前 403 是首启瞬时失败）——**据此撤回本审计早期“沙箱无法真实调用、需用户授权”的说法**；DeepSeek 403 只是首次启动瞬时失败，重试即通。 | 可在沙箱做真实 usage 回归；插件验收应在真实调用下比对其采集值与 `tokenUsage` 投影 |
| pi-ai（OpenAI 兼容/本地 Ollama）产生真实 usage | **未实测**（仅读源码） | 备选方案：`llm-pi-ai` 的 Config = `{ providers: z.dict(profile) }`，`profile` 支持 `api: 'openai-completions'|'openai-responses'|'anthropic-messages'`、`baseURL`、`models[]（id/name/contextWindow/maxTokens/input…）`、`apiKeyEnv`、`headers`、`compat` 等（A：`dsh-llm-pi-ai/lib/index.js:1043-1083`）；本地 OpenAI 兼容端点（如 Ollama 的 `/v1`）需在 providers 下新增路由并把 `agent-default-model.provider` 指过去；pi-ai 只有在端点返回 usage 时才会有 `TokenUsage`（A：`1434-1445`），否则 `usage` 缺失 → 正好可用来验证“接口未提供”的降级路径。**未验证 Ollama 实测链路**。 |
| SQLite 索引 DB 实际路径 | 未验证（`DSH_HOME` 内未见该文件） | 若需搜索历史，可读 launcher 启动参数；不影响 usage 统计 |
| `sessionStats` 是否在当前 desktop 组装中注册 | projcache 存在该行 → 高度可能已注册；但 Config 目录里显示 `include:session-stats` 为 `absent`（该状态语义=无 Config schema，不等于未加载） | 以 live `sessionProjections` 注册表为准；插件不要强依赖该 key |
| 价格/汇率 | 未提供 | 插件设置项：每 provider/model/bucket 单价（可留空 → “未定价”） |

---

## 附录 A · 关键源码摘录（原文）

**A1. DeepSeek 适配器 usage 归一化**（`app.asar:.../dsh-llm-deepseek/lib/index.js:1832-1845`）

```js
function updateUsage(usage, raw) {
	const fields = object(raw);
	for (const [wire, local] of Object.entries({
		input_tokens: "inputTokens",
		output_tokens: "outputTokens",
		cache_read_input_tokens: "cacheReadTokens",
		cache_creation_input_tokens: "cacheWriteTokens"
	})) {
		const value = fields[wire];
		if (value === void 0) continue;
		if (!Number.isSafeInteger(value) || value < 0) return malformed(`invalid ${wire}`);
		usage[local] = value;
	}
}
```

**A2. 总量与唯一 usage chunk**（同文件 `:2017-2026`）

```js
usage.totalTokens = usage.inputTokens + usage.outputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
yield { type: "usage", usage };
yield { type: "finish", reason, replayState: ... };
```

**A3. account provider 复用同一适配器**（`dsh-llm-deepseek-account/lib/index.js:3, 70, 157-169`）
`import { registerDeepSeekProvider, … } from "@deepseek-ai/dsh-llm-deepseek"`；`const PROVIDER = "deepseek-account"`；`registerDeepSeekProvider(ctx, PROVIDER, {...})` → 生产走的就是 A1/A2 的口径。

**A4. tokenUsage 投影（官方去重/口径）**（`dsh-token-meter/lib/types/usage-projection.js:8-19, 86-119`）

```js
const bucketsFrom = (usage) => ({
    uncachedInputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens ?? 0,
    cacheWriteTokens: usage.cacheWriteTokens ?? 0,
});
...
export const tokenUsageProjectionDefinition = {
    key: 'tokenUsage', stateVersion: 2, stateSchema: tokenUsageStateSchema,
    init: () => ({ totals: zeroBuckets(), last: null }),      // ← 不按 inheritedEventCount 过滤
    apply: (state, event) => {
        if (event.type === 'llm/retry-started') {
            return state.last?.turn === event.data.turn && state.last.step === event.data.step
                ? { ...state, last: null } : state;
        }
        if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') return state;
        const sample = usageOf(event);                        // 顶层 usage 优先，stream 兜底
        if (sample === undefined) return state;
        const { turn, step } = event.data;
        const buckets = bucketsFrom(sample);
        const previous = state.last !== null && state.last.turn === turn && state.last.step === step
            ? state.last.buckets : undefined;
        if (previous !== undefined && bucketsEqual(previous, buckets)) return state;
        return { totals: addReplacing(state.totals, previous, buckets), last: { turn, step, buckets } };
    },
    wire: { viewSchema: projectionSchema, view: state => state.totals },
};
```

**A5. `usageOf`（顶层优先、stream 兜底）**（同文件 `:60-66`）

```js
function usageOf(event) {
    if (event.type === 'assistant/message' && event.data.usage !== undefined)
        return event.data.usage;
    if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt')
        return undefined;
    return lastAssistantStreamChunk(event.data.stream, 'usage')?.usage;
}
```

**A6. contextPressure 口径**（同文件 `:57-58`）

```js
/** Prompt-side pressure of one request: input plus cache traffic, no output. */
const pressureFrom = (usage) => usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
```

**A7. 事件写入：usage 与 stream 同源**（`dsh-agent-loop/lib/index.js:1156-1162`）

```js
live.settle("assistant/message", () => this.session.append("assistant/message", {
    turn, step, message,
    ...live.usage === void 0 ? {} : { usage: live.usage },
    stream: live.stream
}, { surfaceOp: "append" }).seq);
```

（`live.usage` 即 `AssistantStreamAttempt.usage` → `this.assembler.usage`，`:460-462`；assembler `get usage()` 见 `dsh-llm/lib/index.js:1096-1099`。）

**A8. 首帧必须是单行 header + 多帧容器**（`dsh-session-persistence-jsonl/lib/index.js:1288-1291, 1898`）

```
* Zstandard frame primitives for the JSONL persistence backend. The backend
* owns a concatenated-frame container so it can append and recover batches
* without exposing compression mechanics through the persistence seam.
...
if (plaintext.length === 0 || plaintext.indexOf(10) !== plaintext.length - 1) throw new Error("corrupt Zstandard session log: first frame is not exactly one header line");
```

**A9. 无 token 价格表**：官方包 grep `cost|pricing|price` 仅命中“请求图片定价/模型容量”等非货币语义；唯一的钱是 `dsh-deepseek-account-platform/lib/types/details.js:12-15` 的钱包余额。

---

## 附录 B · 离线解码脚本（本审计实际使用，只读）

> 与官方 `scanZstdFrames`（`dsh-session-persistence-jsonl/lib/index.js:1305-1368`）等价的最小实现；仅用 Node 内置模块，无需安装依赖。

```js
const fs = require('node:fs');
const zlib = require('node:zlib');
const MAGIC = 0xFD2FB528; // zstd frame magic, little-endian 28 B5 2F FD

function scanZstdFrames(buf) {
  const frames = []; let off = 0; const len = buf.length;
  while (off < len) {
    const start = off;
    if (len - off < 4) break;
    if (buf.readUInt32LE(off) !== MAGIC) throw new Error(`bad frame magic at ${off}`);
    off += 4;
    if (off === len) break;
    const d = buf.readUInt8(off); off += 1;
    const csf = d >>> 6, single = (d & 32) !== 0, chk = (d & 4) !== 0, df = d & 3;
    const dictBytes = df === 3 ? 4 : df;
    const csBytes = csf === 0 ? (single ? 1 : 0) : (1 << csf);
    const rem = (single ? 0 : 1) + dictBytes + csBytes;
    if (len - off < rem) break;
    off += rem;
    let ok = true;
    for (;;) {
      if (len - off < 3) { ok = false; break; }
      const bh = buf.readUIntLE(off, 3); off += 3;
      const last = (bh & 1) !== 0, bt = (bh >>> 1) & 3, bs = bh >>> 3;
      const payload = bt === 1 ? 1 : bs;      // RLE block = 1 byte
      if (len - off < payload) { ok = false; break; }
      off += payload;
      if (last) break;
    }
    if (!ok) break;                            // torn tail: drop the incomplete frame
    if (chk) { if (len - off < 4) break; off += 4; }
    frames.push({ start, end: off });
  }
  return frames;
}

function readSessionLog(file) {
  const buf = fs.readFileSync(file);
  let text = '';
  for (const f of scanZstdFrames(buf)) {
    text += zlib.zstdDecompressSync(buf.subarray(f.start, f.end)).toString('utf8');
  }
  return text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// 用法：header = lines[0]；usage = lines.filter(e => e.type === 'assistant/message' && e.data.usage)
```

实测统计命令要点：遍历 `C:\Users\Administrator\.dsh\sessions\*\*\session.v4.jsonl.zstd`，对每条 `assistant/message` 累加 `inputTokens/outputTokens/cacheReadTokens/cacheWriteTokens`，结果见 §0.11 与 §6.3。

---

## 附录 C · 本审计对“真实调用”的取证

- Lead 在 `tm-sandbox` 的真实探针：`assistant/message turn=2 step=1`，`message.source={kind:"model", provider:"deepseek-account", model:"deepseek-flash"}`，`usage={inputTokens:13611, outputTokens:2, cacheReadTokens:512, cacheWriteTokens:0, totalTokens:14125}`；`13611+512+2=14125` ✅ → **inputTokens 为未命中输入，total = 四桶和**（与源码 A1/A2、与本机 50,886 条历史样本一致）。
- 本审计自身的验证方式为“离线解码真实历史日志 + 与官方投影缓存对账”，未另开 live 插件写 `DSH_HOME`；因此**“插件在真实调用中实时采集”仍需在沙箱/生产各做一次端到端回归**（建议验收标准：插件 `Σ usage.call` 与 `tokenUsage` 投影四桶完全相等，且与 `TurnUsagePanel` 单轮数字一致）。
