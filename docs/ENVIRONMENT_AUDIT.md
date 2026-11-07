# DSH Token Manager · Phase 0 环境与接口核验报告

| 项目 | 值 |
|---|---|
| 报告版本 | v1.0（Phase 0 门禁版） |
| 核验日期 | 2026-11-01 |
| 目标机 | 本机 Windows（C: NTFS / E: exFAT 工作区） |
| DSH 版本 | 0.2.1-rc.5（Electron 桌面版） |
| 结论 | **Phase 0 通过（有 4 项设计必须调整）**，准予进入 Phase 1 |

> 证据分级：`[A]` 源码/类型原文（含文件+行号）｜`[B]` 本机实跑实测（命令+输出）｜`[C]` 运行时契约查询（cordis_inspect_query）｜`[D]` 推断（明确标注，不当结论用）。
> 详细分册：`docs/audit/01-host-hooks.md`、`02-usage.md`、`03-ui.md`、`04-storage-mnemon.md`、`00-lead-environment-findings.md`、`00b-lead-real-call-and-crosscheck.md`（本报告是它们的汇总与裁决）。

---

## 1. 环境基线

| 项 | 实测值 | 证据 |
|---|---|---|
| DSH | `0.2.1-rc.5` | `[B] dsh --version` |
| 宿主 | Electron 44.7.0 / Node 24.21.0（内置运行时） | `[B] ELECTRON_RUN_AS_NODE=1 "DeepSeek Harness.exe" -e ...` |
| CLI Node / pnpm | v24.14.0 / 10.32.1；DSH 内置 pnpm 11.28.5 | `[B]` |
| DSH_HOME | `C:\Users\Administrator\.dsh` | `[B]` 环境变量 |
| 生产 profile | `desktop`（Electron 独占，CLI 拒绝 `--dump-config`） | `[B]` |
| 生产 GUI | `http://127.0.0.1:62186`（带 token） | 运行时上下文 |
| 当前会话 | `session-b7153413-0584-44c8-9148-1362793e00af` | 运行时上下文 |
| 插件条目总数 | 217（bundle 10 个，第三方 3 个 active + 1 个 disabled） | `[B] plugin_manager list_plugins` |
| 已安装第三方插件 | `dsh-mnemon@0.5.36`、`dsh-better-sidebar@0.28.0`、`dsh-pet@0.3.8`、`@local/zhirai-short-drama-agents`(disabled) | `[B] list_bundles` |
| TypeScript / esbuild | 未全局安装；npm registry 可达；临时目录实测 `npm i typescript@7.0.2 esbuild@0.28.2` 成功（6s） | `[B]` |
| SQLite | 宿主内置 `node:sqlite`（SQLite 3.53.4，含 `backup`） | `[B]` 宿主运行时实测 |
| zstd | Node 24 `zlib.zstdDecompressSync` 可用（单帧） | `[B]` |

**核验方法**：① 官方包仅在 `app.asar` 内，`read` 工具可读绝对路径（shell/glob/grep 不可用）；② 用 `cordis_inspect_query` 取运行时契约；③ 自建只读探测插件在**隔离 profile** 中实测事件与数据；④ 实读 217 个历史会话日志与投影缓存。

---

## 2. 插件体系核验

### 2.1 插件包与入口（`[A][B]`）

```jsonc
// package.json
{ "type": "module",
  "exports": { ".": "./index.js", "./client": "./client.js", "./locale/*.json": "./locale/*.json", "./icon": "./icon.svg" },
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" },
           "client": { "platform": "web", "immediately": true, "inject": ["@deepseek-ai/dsh-client-ui-conversation"] } } }
```

```js
// index.js（Host 半）
export const name = 'dsh-token-manager'
export const inject = ['tools', 'tokenMeter']       // 未声明的服务访问会直接抛错
export const Config = z.object({ /* schemastery/StandardSchema */ })
export function apply(ctx, config) { /* 所有注册返回 disposer，或用 ctx.effect 包裹 */ }
```

- **硬约束（实测）**：未在 `inject` 声明的服务，访问 `ctx.tools` 直接抛 `cannot get property "tools" without inject`，整条插件 entry 不激活（Harness 仅告警，不阻断）。
- 已确认可用服务：`tools`、`tokenMeter`、`sessionProjections`、`agentLoop`、`sessions`、`llm`、`settings`、`storageDomain`、`spillStore`、`systemPrompt`。
- **未激活**（`ctx.get()` 为 false，实测）：`compaction`、`toolResultPruner`、`subagents`（apply 时点）。
- 生命周期：`ctx.on` / `register` / `section` 均挂在 fiber effect 上，禁用/卸载时逆序自动清理；**数据目录不会被清理**。

### 2.2 隔离测试环境（已建立，生产零改动）

```powershell
dsh tm-sandbox --from-default-profile web --dump-config     # 生成 C:\Users\Administrator\.dsh\profiles\tm-sandbox
dsh plugin --profile tm-sandbox add "file:E:/ZHIRAI Harness/dsh-token-manager"   # 安装（自动加入 bundles）
dsh tm-sandbox --port 62300 --no-open                        # 启动独立 GUI（URL 带 token，无 token 401）
```

- **沙箱可完成真实 DeepSeek 调用**（`deepseek-account` 凭据跨 profile 共享）。首启 `/auth-api/v0/users/current` 403 属瞬时预热，非权限问题（已实测后续成功）。
- 开发循环：`file:` 依赖是**硬链接复制**，改源码不生效 → 用 junction 指回工作区（`cmd /c mklink /J`）；junction 状态下不要再 `dsh plugin add`。
- **生产 `desktop` profile 未做任何写操作**；本轮未调用任何 `plugin_manager` 写动作。

---

## 3. 扩展点核验（对 PRD 有直接影响）

| # | 扩展点 | 实测契约 | PRD 影响 |
|---|---|---|---|
| 1 | `agent/pre-step`（waterfall） | `payload.messages` = **本 step 从 inbox 新领取的消息**（`UserMessage[]`），**不是完整历史**；decision = `{kind:'reject'} \| {kind:'enter', messages, startsRequestSeries?}` | PRD 5.1/5.4「在 pre-step 里对历史上下文去重」**不可直接实现**（见 §6 调整 D1） |
| 2 | 历史上下文修改 | 只能 `session.append(..., {surfaceOp:{op:'replace',startSeq,endSeq}, sourceEventSeqs})` + 影子事件（官方 pruner 即此范式）；或复用 `ctx.compaction.compactIfNeeded/compactNow/compactRegion` | Phase 3 若做历史裁剪必须走 surface replace；`reject` 会掐掉整步，不能当裁剪用 |
| 3 | `tools/post-execute`（waterfall） | 返回 `{kind:'accept', content}` 可替换**模型可见内容**；`{kind:'accept', value}` 可替换规范值（失败结果不可）；`{kind:'block', feedback}` 转成错误 | Phase 2 可行；但见 #4 |
| 4 | 替换是否改持久化日志 | **会改**：`post-execute → finalizeContent → appendToolResult()`，`tool/result` 落的就是最终 content | 「只在模型上下文替换、日志留原文」**做不到**；必须在 content 里保留 Blob ID + 恢复入口（PRD 4.6 设计成立） |
| 5 | 失败回退 | 监听器**抛错**会让工具结果变成 `isError`；`accept` 不能同时给 `value`+`content` | 替换逻辑必须自带 try/catch 并原样 `return decision` → 满足 PRD 10.2 回退要求 |
| 6 | `tools/result`（emit） | **只读**：`exec` 被 `Object.freeze`，监听器异常只 `logger.warn` | 只用于记账/统计，不能改写（PRD 假设成立） |
| 7 | `ctx.tools.register` | `ToolDefinition` 必须同时给 `parameters`(JSON Schema) 与 `output.schema + output.render`；`execute` 返回**规范值**，可见文本由 `output.render` 生成 | `token_manager_read` 必须写 output 契约，不能只返回字符串 |
| 8 | 事件顺序 | waterfall 顺序 = 注册序 × `prepend`，**与 bundle 顺序无关**（`dsh-base` patch 原文：row order carries no load semantics） | 不得依赖加载顺序；用 `session/event`（post-commit）或 `system-prompt/assemble`（先 `await next()` 再观测） |
| 9 | 官方已有能力 | `tokenMeter`、`tokenUsage`/`contextPressure`/`contextBreakdown`/`sessionStats` 投影 active；`compaction-basic`、`tool-result-pruner`、`command-compact` 在本机 **enabled:false / fiberPhase:null**（web-app bundle 覆盖禁用） | Phase 1 复用官方口径；Phase 2 压缩内核在本机确为空白（可参考包内实现，但**不可声称官方已启用**） |

---

## 4. Token 数据核验（Phase 1 的计量基础）

### 4.1 字段语义（`[A][B]`，50,886 条真实样本 + 沙箱真实调用）

```ts
interface TokenUsage {
  inputTokens: number        // 未命中缓存的 prompt token（不含 cache*）
  outputTokens: number       // 生成 token（推理已折入）
  totalTokens?: number       // = input + output + cacheRead + cacheWrite（DeepSeek 路线恒存在）
  cacheReadTokens?: number   // 命中前缀缓存
  cacheWriteTokens?: number  // DeepSeek 实测恒 0
  reasoningTokens?: number   // 本构建不产生 → “接口未提供”；若出现是 output 子集，禁止再加
}
```

- 映射源码：`dsh-llm-deepseek/lib/index.js:1832-1845, 2017`；投影改名 `uncachedInputTokens`（`dsh-token-meter/lib/types/usage-projection.js:14-19`）。
- **去重键 = `(sessionId, turn, step)` + `llm/retry*` 生命周期**；`providerRequestId` 成功路径接口未提供。真实数据同 `(turn,step)` 重复 = 0/50,886。
- `assistant/message.usage` 与 `stream` 内 usage chunk 是同一份数据的两次落盘（顶层优先、stream 兜底）。

### 4.2 交叉核对已闭环（可直接作为验收断言）

沙箱真实调用后：`assistant/message.usage = {inputTokens:13611, outputTokens:2, cacheReadTokens:512, cacheWriteTokens:0, totalTokens:14125}`，官方投影缓存同会话 `tokenUsage.totals = {uncachedInputTokens:13611, outputTokens:2, cacheReadTokens:512, cacheWriteTokens:0}` —— **逐字段一致**。

→ Phase 1 断言：`Σ(按 (session,turn,step) 去重后的每次调用桶值) == 官方 tokenUsage.totals`（逐会话；跨会话聚合差异见 4.3）。

### 4.3 历史与规模（`[B]`）

- 会话日志：`DSH_HOME\sessions\<编码cwd>\<sessionId>\session.v4.jsonl.zstd`，**多帧 zstd 容器**（首帧 1 行 header），须按帧切分后逐帧解压（218/218 全部成功解出）。
- 投影缓存：`DSH_HOME\storages\session_projcache\sessions\<id>.json`（rows 含 tokenUsage 等 29+ key）。
- 本机历史：217 个会话头（196 子 Agent）、约 5.08 万条带 usage 调用；合计 `uncachedInput 77,845,652 / output 38,006,128 / cacheRead 15,722,463,360 / cacheWrite 0`。
- **cacheRead 占计费 token 99.27%** → 成本优化必须以缓存为中心；任何重写历史前缀的策略都可能放大成本（PRD 5.5 判断正确）。
- 官方**无 token 单价数据**（仅账户余额）→ 费用只能由插件价格表估算并明确标注“估算”。

### 4.4 归属

- 子 Agent：无 `subagent/start|end` 事件；用子会话 header（`origin:'subagent'`、`parentSession`、`delegationDepth`）+ 父会话 `subagent/catalog` + 子会话 `subagent/descriptor`；`mnemonSubagentTokenUsage` 投影是现成归属范式。
- provider/model：以 `assistant/message.message.source` 为准（生产 `deepseek-official`、沙箱 `deepseek-account`）→ **禁止硬编码**。

---

## 5. dsh-mnemon 兼容核验（`[A][B]`）

- 注入通道：`systemPrompt.section('mnemon:routing', order:150)` + `system-prompt/assemble` 动态段 `mnemon:strategy`；`agent/pre-step`（`prepend:true`，先 `await next()` 再追加，仅 `step===1`，幂等）。
- **唯一可靠识别判据**：`message.source.kind === 'dsh-mnemon'`（兼容 `plugin:dsh-mnemon` / `{kind:'plugin',plugin:'dsh-mnemon'}`），`source.form = recall|instructions`；真实用户 = `source.kind === 'user'`。
- 实测同一日志 10 种 `source.kind`：`system-prompt / user / agent-instructions / runtime-context / skill-catalog / time-context / agent-message / dsh-mnemon / model / tool`。
- 它**未**改写 `tools/post-execute`、未注入 developer 消息、未改 `agent/request`；projection key 仅 `mnemonSubagentTokenUsage`。
- 红线（10 条，详见 `04`）：不删/不改/不重排 mnemon 消息；不按文本前缀判断；不 prune `mnemon_*` 工具结果；不复用其 projection key 与段落名；自己注入的消息必须带独立 `source.kind='dsh-token-manager'`；不 `reject` pre-step。

---

## 6. 与 PRD 的差异与必须调整的设计（门禁项）

| 编号 | PRD 原设 | 实测事实 | 调整（Phase 起） |
|---|---|---|---|
| **D1** | 5.1「`agent/pre-step` 处理历史上下文去重」 | pre-step 只拿到本步新消息 | Phase 3 改为「a) `tools/post-execute` 可逆替换（新结果）；b) 历史只做**检测与报告**，不默认改写；c) 如需裁剪历史，走 `ctx.compaction` 或 surface replace + 影子事件，默认 dry-run」。Phase 1/2 不受影响 |
| **D2** | 4.6「原文恢复」 | post-execute 替换会写进持久化日志 | 设计成立但要写清：**日志里存摘要+Blob 指针，原文在本地 blob 存储**；`token_manager_read` 是唯一恢复入口；恢复需校验会话归属（PRD 10.1） |
| **D3** | 第三部分「自建 Token 统计」 | 官方已有 `tokenUsage/contextPressure/contextBreakdown/sessionStats` 投影与 `tokenMeter` | Phase 1 定位改为「**官方口径的逐调用台账 + 任务/项目归因 + 费用估算 + 异常检测**」，复用官方数值做交叉核对，不重造计量内核 |
| **D4** | 第四部分「压缩工具输出」 | 官方 `tool-result-pruner`/`compaction-basic` 在本机 **disabled**；但有完整实现可参考，且 `spill-*` 只处理内联溢出（`maxInlineTokens:12500`），与工具结果压缩不是一回事 | Phase 2 仍是真实空白、值得做；实现前读官方 pruner 源码对齐阈值语义；两者不同时启用（避免双重裁剪） |
| **D5** | 9.1「完整中文仪表盘」 | `main`（keyed，key=`token-manager`）+ `sidebar.panellist(id 同名)` + `ctx.layout.selectPanel` 可做整页；数据通道用 `webServer.register({kind:'prefix'})` + `connection.requestRejection` 围栏；`@Remote`/projections 不适合 | Phase 5 按此实现；client 构建用 esbuild（CJS + `window.__ModuleLoader__.load` 包装，React external） |
| **D6** | 「所有历史任务」统计 | 历史日志 zstd 多帧、projcache 可对账但与日志聚合差 5.7% | Phase 1 历史导入器：优先 projcache（快），日志解压做精确回溯与校验；两者差异在 UI 标注 |
| **D7** | 费用 | 官方无价格接口 | Phase 1 自建价格表（provider/model/四桶/币种/生效时间），未配置时只显示 Token 并标注“价格未配置” |
| **D8** | 真实调用验收 | 沙箱可用真实 DeepSeek 调用（已更正 403 结论） | Phase 1 验收在隔离 profile 完成，无需触碰生产；生产安装留待用户授权（Phase 6） |

**未变、且被证据强化的 PRD 要求**：不降推理等级/不换模型（未发现任何需要）；KV Cache 保护（cacheRead 99.27% 是最大风险）；可关闭/可回退/可追踪；本地优先、不记录密钥；不修改 mnemon 与 Harness 核心。

---

## 7. 环境风险登记册

| 级别 | 风险 | 处置 |
|---|---|---|
| 高 | 改写历史前缀导致缓存全失效（cacheRead 占 99.27%），可能出现“省了 token 但更贵” | Phase 3 默认只检测；任何改写前估算 cache_read 变化并对比，成本上升自动回滚（PRD 5.5 落实为硬门禁） |
| 高 | 插件自身异常阻断主流程 | 所有 hook 包 try/catch，失败原样 `return decision/next()`；Phase 1 起加异常计数器与自检 |
| 中 | `node:sqlite` 为 Experimental（宿主 stderr 可能有警告） | 启动探测+降级到 JSON 存储，不阻塞主流程 |
| 中 | E: exFAT 写文件 EISDIR / PS5.1 BOM | 已定规范：数据不落 E:；源码用 UTF-8 无 BOM；文档写入走 C: 中转 |
| 中 | 沙箱与生产共享 DSH_HOME（会话/凭据） | 测试只读历史、只写沙箱自有数据目录；不触碰生产 profile 与 DSH 域目录 |
| 低 | client Inspect 对子代理会话超时 | UI 验证在生产主会话或沙箱页面按真实用户路径做，slot 以源码+主会话 Inspect 交叉确认 |

---

## 8. Phase 0 门禁结论

| 验收项 | 结果 |
|---|---|
| 1 本机 DSH/Cordis 版本与插件目录规范 | ✅ |
| 2 客户端插件规范与整页 UI 可行性 | ✅（`03`） |
| 3 `agent/pre-step` 实际签名 | ✅（且证明历史裁剪不能走它） |
| 4 `tools/post-execute` 实际签名与替换/回退语义 | ✅ |
| 5 `session/event` usage 结构与去重键 | ✅（50,886 样本 + 真实调用） |
| 6 官方 Token Meter 与官方统计口径 | ✅（含交叉核对闭环） |
| 7 dsh-mnemon 加载与注入识别 | ✅（唯一判据 = `source.kind`） |
| 8 现有 compaction 插件状态 | ✅（本机均 disabled，理由已查明） |
| 9 隔离测试环境 | ✅（tm-sandbox 可装/可启/可回滚/可真实调用） |
| 10 真实调用与历史数据可用性 | ✅（无需生产 profile） |

**结论：Phase 0 通过。准予进入 Phase 1（Token 只读监控 MVP），并按 D1–D8 调整设计；Phase 2 起再按阶段门禁推进。**

---

## 附录：分册索引

| 文件 | 内容 |
|---|---|
| `docs/audit/00-lead-environment-findings.md` | 环境/插件体系/工具链/投影缓存首轮实测 |
| `docs/audit/00b-lead-real-call-and-crosscheck.md` | 真实调用、交叉核对闭环、对前文的更正 |
| `docs/audit/01-host-hooks.md` | pre-step / post-execute / tools.register / 生命周期 / 事件签名 |
| `docs/audit/02-usage.md` | TokenUsage 语义、去重算法、官方统计链路、历史回溯、费用缺口 |
| `docs/audit/03-ui.md` | Slot 拓扑、整页 UI 方案、数据通道、构建方案 |
| `docs/audit/04-storage-mnemon.md` | 数据目录、SQLite 实测、mnemon 注入与红线、卸载/备份 |
