# 01 · Host 扩展点审计（DSH 0.2.1-rc.5 / profile=desktop）

> 审计员：host-hooks-auditor（共享任务 task-1）
> 审计时间：2026-11-01（Europe/Berlin）
> 审计对象：本机真实安装的 DeepSeek Harness `0.2.1-rc.5`（Electron 桌面版，`resources/app.asar`）
> 审计方式：只读。读取本机安装包源码 / 同版本 npm 类型声明 / 运行时 `cordis_inspect_query` / 本机已装第三方插件源码；**未安装任何插件，未修改 profile，未修改 dsh-mnemon**。
> 唯一写入目标：本文件。

---

## 0. 结论速览（TL;DR）

| # | 扩展点 | 实测结论 | 对 PRD 的影响 |
|---|---|---|---|
| 1 | `agent/pre-step` | waterfall；`payload.messages` = **本 step 从 inbox 新领取的消息**（`UserMessage[]`，`role:'user'`），**不是**完整历史；`PreStepDecision = {kind:'reject'} \| {kind:'enter', messages, startsRequestSeries?}` | PRD「在 pre-step 里对历史上下文去重/裁剪」**不能直接实现**；pre-step 只能改「本步进入模型的新消息」 |
| 2 | 历史消息替换 | 历史 = `session.surface`，只能通过 `session.append(event, data, {surfaceOp:{op:'replace',…}})` + `compaction/prune` 影子事件做**可重放的**替换（官方 `dsh-compaction-tool-result-pruner` 就是这么做的） | Phase 3 若要做历史裁剪，必须走 surface replace，不能走 pre-step |
| 3 | `tools/post-execute` | waterfall；返回 `{kind:'accept', content}` 可替换模型可见内容，返回 `{kind:'accept', value}` 可替换规范值（失败结果不可），`{kind:'block', feedback}` 可把结果改成错误 | **可替换大工具输出**；且因为替换发生在 commit 之前，**替换后的内容就是写进 `tool/result` 持久化日志的内容** |
| 4 | 替换是否改日志 | **会改**。工具执行链：`post-execute → finalizeContent → appendToolResult()`，`tool/result` 事件用的是最终 `result.content` | 「只在模型上下文替换、日志保持原文」在官方口子上**做不到**（DSH 的设计是 replay 即日志） |
| 5 | 失败回退 | post-execute 监听器**抛错**会让整个工具结果变成 `isError`（外层 try/catch）；`accept` 不能同时给 `value`+`content`（抛 TypeError），不能给失败结果换 `value` | 替换逻辑必须自己 try/catch 并 `return decision` 原样回退 |
| 6 | `tools/result` | **只读**：`emit` 模式、`exec` 被 `Object.freeze`、监听器异常只 `logger.warn`、返回值 `undefined` | 可做统计/记账，**不可**用于改写结果 |
| 7 | `ctx.tools.register` | `ToolDefinition` 必须**同时**给 `parameters`(JSON Schema 方言) 与 `output.schema + output.render`；`execute` 返回**规范值**（`JsonValue`），模型可见文本由 `output.render` 生成 | 新增工具必须写 output 契约，不能只返回文本 |
| 8 | 插件导出 | `export function apply(ctx, config)` + `export const inject = [...]` + `export const Config = z.object({...})`（schemastery，走 StandardSchema `~standard`）+ `export const name`；`inject` 未声明的服务**直接抛错** | 参考 §5，`ctx.tools`/`ctx.tokenMeter` 必须写进 `inject` |
| 9 | 生命周期 | 禁用/卸载 = loader `fiber.dispose()` → 全部 `ctx.effect`/`ctx.on`/`register` disposer 逆序执行；**数据不会被清理** | 插件自有数据目录、`plugin:` 会话记录需自己设计清理/兼容策略 |
| 10 | **重大差异（已按 Lead 运行时实测修正，见 §8.2）** | base patch 里**存在** `token-meter`、`compaction-basic`、`spill-local`、`spill-policy`、`tool-result-pruner` 这些 row，但 `@deepseek-ai/dsh-web-app` 的 patch **把 `compaction-basic`、`command-compact`、`tool-result-pruner` 覆盖为 `disabled: true`**；本机运行时只有 `token-meter`、`spill-local`、`spill-policy`(12500)、`image-offload`、`repeat-tool-reminder` 为 active | **本机没有自动压缩、也没有确定性工具结果裁剪**（Phase 2 的真实空白）；只有 `spill-policy` 的 12500-token「内联上限兜底」。PRD 应定位为「配置面 + 归因面 + 策略面 + 可选的压缩内核」 |

---

## 0.1 对 Lead 三个问题（A/B/C）的直接回答

- **A) `payload.messages` 只是「本次进入该 step 的新消息」**，不是完整历史：类型注释写的是 "messages removed from the inbox for this step"（§2.1），实现是先 `inbox.claim()` 再原样放进 payload（§2.2），Lead 实测 `length=1`、`roles={user:1}` 与之吻合（§1.5）。`PreStepDecision` 的精确字段只有 `{kind:'reject'}` 与 `{kind:'enter', messages: UserMessage[], startsRequestSeries?: true}` —— **它是 `kind` 判别式，没有 `action`、没有 `replace`、没有"替换整个上下文"的字段**（§2.1）。
- **B) 只能改本次 messages ⇒ 历史裁剪必须换扩展点**：历史 = `session.surface`，唯一 replay-safe 的方式是 `session.append(..., {surfaceOp:{op:'replace',startSeq,endSeq}, sourceEventSeqs})` + 前导 `compaction/prune` 影子价格事件；官方 `dsh-compaction-tool-result-pruner` 就是范例（§2.4，但本机 **inactive**，只能当参考，见 §8.2）。另一条路是复用 `ctx.compaction` 契约（本机 `compaction-basic` 被禁用，服务当前不存在）。`tools/post-execute` 的替换只覆盖"单次工具结果"，属于可逆替换的一个特例（§3.3）。
- **C) `totalTokens` vs `surfaceTokens`**：`surfaceTokens` = 当前 surface 全部节点（system/user/assistant/tool-result）路由定价之和；`totalTokens = max(0, baseline.tokens + surfaceDeltaTokens)`，`baseline` 是**上次成功请求的整封压力锚**（能对上 header 且 usage 足够大时用真实 usage，否则 `estimateToolsTokens(header) + 锚点 surface`），`surfaceDeltaTokens = 当前 surface − 锚点 surface`。因此**无锚点/首步时 `totalTokens = toolsTokens + surfaceTokens`**；Lead 的 `12095 / 4890 / estimated` 正是此式 → 工具声明约 **7205 tokens**（§6.6 有实现原文与公式推导）。

---

## 1. 环境与取证

### 1.1 环境快照

| 项 | 实测值 | 证据 |
|---|---|---|
| DSH 版本 | `0.2.1-rc.5` | 各包 `package.json` 的 `version`，如 `...\@deepseek-ai\dsh-tools\package.json:L4` |
| 宿主形态 | Electron，代码在 `resources\app.asar` | 路径可读、shell 不可读（见 §1.2） |
| 内置运行时 | Node `24.21.0` / pnpm `11.28.5` | `...\resources\runtime\versions.json:L2-L5` |
| 当前 shell Node | `v24.14.0` | `node -v`（与内置运行时不同，注意别拿 shell Node 跑插件） |
| `DSH_HOME` | `C:\Users\Administrator\.dsh` | 环境变量 |
| profile | `desktop`，目录 `C:\Users\Administrator\.dsh\profiles\desktop` | 环境变量 `DSH_PROFILE_DIR` |
| Web GUI | `http://127.0.0.1:62186` | 运行时上下文 |
| 工作区 | `E:\ZHIRAI Harness`（exFAT） | `pwd` |
| 本机已装第三方插件（可 grep 的真实目录） | `dsh-mnemon@0.5.36` 及 18 个 `dsh-mnemon-*` 子包、`dsh-better-sidebar`、`dsh-pet` | `C:\Users\Administrator\.dsh\profiles\desktop\node_modules\` |

### 1.2 证据分级与路径约定（重要）

shell / `glob` / `grep` **完全无法访问** asar（实测 `rg: ... 系统找不到指定的路径 (os error 3)`）；只有 `read` 工具能按绝对路径读 asar 内的文件，且它拒绝读目录（`not a regular file`）。因此本审计用三种来源，文中统一缩写：

| 标记 | 含义 | 基础路径 |
|---|---|---|
| **[L]** | **本地安装的运行时源码**（app.asar 内，`read` 可读；行号即真实构建产物行号） | `C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness\resources\app.asar\dsh\node_modules\@deepseek-ai` |
| **[T]** | **同版本 npm 包的类型声明**（安装包把 `.d.ts` 裁掉了，见 §1.3） | `@deepseek-ai/<pkg>@0.2.1-rc.5` → `lib/types/**/*.d.ts` |
| **[C]** | **本地安装包内的 cordis TypeScript 源码**（cordis 是唯一随包发 `src/*.ts` 的核心依赖之一） | `C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness\resources\app.asar\node_modules\@deepseek-ai\cordis\src` |
| **[I]** | 运行时 `cordis_inspect_query`（Host `Event` / `Service` / `Config` provider，读的是**活进程**的真实契约） | 本次全部 `listEvents` / `listService` 输出 |
| **[M]** | 本机已装插件 `dsh-mnemon` 源码 | `C:\Users\Administrator\.dsh\profiles\desktop\node_modules\dsh-mnemon\lib\index.js` |

> ⚠️ **[I] 是"类型目录"，不是"激活状态"。** `Event`/`Service` provider 的目录来自随包的 typert/API 目录（甚至能在 `[L] dsh-tool-cordis/lib/types/api-catalog.js` 里找到逐条 signature 原文），所以**出现在目录里 ≠ 运行时已启用**。实证：本机 `include:tool-result-pruner` 的运行时状态是 `enabled:false, fiberPhase:null`（inactive），但 `Service` 目录仍列出 `toolResultPruner` 的方法签名。**判断"是否生效"必须看运行时插件状态**（Lead 的 `plugin_manager list_plugins` 217 条记录，见 §8.2）。

引用写法：`[L] dsh-tools/lib/index.js:3599-3627`、`[T] dsh-tools/lib/types/index.d.ts:465-479`。

### 1.3 为什么类型声明要用 [T]：安装包裁掉了 `.d.ts`（已做哈希校验）

- 本机 asar 内共 21317 个条目、307 个 `@deepseek-ai/*` 包目录；**`.d.ts` 数量 = 0**，`.js.map` 数量 = 0（用 Node 解析 asar header 全量枚举；脚本见 §1.4）。
  每个包的 `lib/types/*.js` 都是纯类型占位（例：`[L] dsh-tools/lib/types/types.js` 全文只有 `export {};`），`package.json` 却仍声明 `"types": "lib/types/index.d.ts"`（`[L] dsh-tools/package.json:L15`）——即桌面发行版**刻意裁剪**了类型文件。
- 因此类型摘录取自 npm 上的**同版本**包，并用 `lib/index.js` 的 SHA-256 证明「npm 包 = 本地安装」：

| 包 | `lib/index.js` SHA-256 比对（本地 asar vs npm 0.2.1-rc.5） |
|---|---|
| `dsh-tools` (3806 行) | **SAME** |
| `dsh-agent` (702) | **SAME** |
| `dsh-agent-loop` (2023) | **SAME** |
| `dsh-session` (2051) | **SAME** |
| `dsh-llm` (2426) | **SAME** |
| `dsh-scope` (357) | **SAME** |
| `dsh-subagent` (3331) | **SAME** |
| `dsh-system-prompt` (409) | **SAME** |
| `dsh-token-meter` (876) | **SAME** |
| `dsh-compaction-tool-result-pruner` (194) | **SAME** |
| `dsh-spill` (58) | **SAME** |
| `cordis` (4.0.5) | **SAME** |

结论：**[T] 的类型声明与 [L] 的运行时是同一次构建**，行号/字段可直接对应本地安装。此结论对升级敏感：升级 DSH 后必须重做哈希校验（见 §9-R1）。

### 1.4 本次为读 asar 自建的只读工具（可复用）

1. **asar 头部解析**：前 16 字节里 `UInt32LE(12) = header JSON 长度`，JSON 从 offset 16 开始。用于全量文件清单/精确文件提取/包内全文搜索（829 个 `lib/*.js` 全文扫一遍 < 2s）。
   - 生成清单：`asar-list.txt`（21317 条）
   - 提取单包：`asar-extract.cjs <asar> <树内路径> <输出目录>`
   - 包内全文 grep（带行号）：`asar-grep.cjs <asar> <正则>` —— 这是本审计能给出「全量注册者清单」的原因。
2. 运行时契约：`cordis_inspect_query(platform=host, provider=Event|Service|Config, ...)`，无需读文件即可拿到**活进程**的类型声明与 `packageDir`。

### 1.5 沙箱实测交叉验证（Lead 实测，纳入本审计）

Lead 在隔离 profile `tm-sandbox` 用只读探针插件做了一次真实模型调用，记录（`request/header reason=resume provider=deepseek-account model=deepseek-flash`）：

```
agent/pre-step  seq=1 turn=2 step=1
  payload.messages.length = 1        roles = {user: 1}   tailRoles = ["user"]
  ctx.tokenMeter.measure(agent.session) =>
    totalTokens: 12095, surfaceTokens: 4890, baseline.kind: "estimated"
assistant/message turn=2 step=1 usage =>
  inputTokens: 13611, outputTokens: 2, cacheReadTokens: 512, cacheWriteTokens: 0, totalTokens: 14125
```

三点与源码完全吻合，见 §2.3（messages 只是本步新消息）、§2.4（历史在 surface 里）、§6.5（`12095 = 工具声明 7205 + surface 4890`）。

---

## 2. `agent/pre-step`（waterfall）

### 2.1 原始声明

`[T] dsh-agent/lib/types/runtime-types.d.ts:293-310`：

```ts
        /**
         * Reject a proposed step or replace the messages that enter it. Calling
         * `next()` preserves the current messages.
         * @param payload.agent - the agent proposing the step.
         * @param payload.messages - messages removed from the inbox for this step.
         * @param payload.turn - the turn that will own the step.
         * @param payload.step - the step proposed by the loop.
         * @param payload.signal - the current turn's cancellation signal.
         * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent.
         * @mode waterfall
         */
        'agent/pre-step'(this: Scoped<Agent>, payload: {
            agent: Agent;
            messages: UserMessage[];
            turn: number;
            step: number;
            signal: AbortSignal;
        }, next: () => Promise<PreStepDecision>): Promise<PreStepDecision>;
```

`[T] dsh-agent/lib/types/runtime-types.d.ts:91-99`：

```ts
/** Whether and with which messages the loop enters a proposed step. */
export type PreStepDecision = {
    kind: 'reject';
} | {
    kind: 'enter';
    messages: UserMessage[];
    /** Start a distinct model-message series before this step's admitted messages. */
    startsRequestSeries?: true;
};
```

`[T] dsh-agent/lib/types/runtime-types.d.ts:83-90` 说明 `messages` 的类型来源（`UserMessage extends MessageBase`，`role:'user'`；`[T] dsh-llm/lib/types/message.d.ts:144-146`）。

> 注意：**没有** `{action:'...'}`、**没有** `{replace:...}`、**没有** `{messages}` 裸字段。判别式字段是 **`kind`**，取值仅 `'reject' | 'enter'`。

### 2.2 运行时实现（默认 `next()` 做什么、reject 怎么收场、消息怎么写进日志）

`[L] dsh-agent-loop/lib/index.js:902-927` 是整个语义的核心：

```js
	async preStep(target, position) {
		...
		const claimed = this.inbox.claim(target, position.turn);                       // ① 从 inbox 领取本步消息
		const assembly = await this.loopCtx.systemPrompt.assemble(assembleContextFor(this, signal));
		signal.throwIfAborted();
		const decision = await this.dispatch.waterfall("agent/pre-step", {           // ② 派发 waterfall
			messages: claimed,
			...position,
			signal
		}, () => {                                                                    // ③ 最内层 next()
			const sections = renderContextSections(assembly);
			const context = this.runtimeContext.project(joinContextSections(sections), sections);
			return Promise.resolve({
				kind: "enter",
				messages: context === void 0 ? claimed : [...claimed, context]         // ④ 默认 = 领取消息 + runtime-context 投影
			});
		});
		signal.throwIfAborted();
		if (decision.kind === "reject") return decision;                              // ⑤ reject 直接返回
		return { ...decision, assembly };
	}
```

- ③④：**默认 `next()` 的返回里已经包含** host 侧 runtime-context 投影（时间上下文、harness 上下文等）。**监听器若不调用 `next()` 而直接返回自己的数组，会静默丢掉这块注入**（`decision.messages` 变成你的数组）。
- ⑤ + `[L] dsh-agent-loop/lib/index.js:956-968`：`reject` 使该 turn 以 `{kind:'blocked'}` 结束，且**被领取的消息既不入日志也不再回到 inbox**：

```js
				const decision = await this.preStep(target, { turn, step });
				if (decision.kind === "reject") {
					turnEnds = { kind: "blocked" };
					return false;
				}
```

- `decision.messages` 的落地在 `[L] dsh-agent-loop/lib/index.js:1043-1073`（`step()`）：逐条 `session.append("user/message", message, {surfaceOp:"append"})`；其中 `source.kind === 'runtime-context'` 的消息会被替换成合并后的 runtime-context 投影（`L1066-L1073`）。也就是说 **pre-step 决定的消息会以 `user/message` 事件写进持久化日志**。
- ⚠️ 因此**自己造消息时不要用 `source.kind:'runtime-context'`**：`L1066-L1073` 的 `contextAdmitted` 逻辑只会写入 host 合并后的那一份 context，你自造的同 kind 消息**不会**作为独立 `user/message` 落盘。用插件自有 source（见 §7.2 的 `createPluginMessage`）。

### 2.3 A) `payload.messages` 只是「本次进入该 step 的新消息」

证据链（三处独立证据一致）：

1. 类型注释原文：`messages removed from the inbox for this step`（`[T] dsh-agent/lib/types/runtime-types.d.ts:297`）。
2. 实现：`const claimed = this.inbox.claim(target, position.turn)` 之后原样放进 payload（`[L] dsh-agent-loop/lib/index.js:906-911`）；inbox 的语义见 `[T] dsh-agent/lib/types/runtime-types.d.ts:41-46`（`nextTurn` / `nextStep` 两个待办列表）。
3. Lead 实测：`messages.length = 1`、`roles = {user:1}`，而同一时刻 `measure().surfaceTokens = 4890` —— 若 messages 是全量历史，绝不会只有 1 条。

**结论（对 Phase 3 关键）**：`agent/pre-step` 的 `messages` **不是**完整历史上下文，也**不包含**已提交的 `assistant/message`、`tool/result`。它只包含：
- `turn` 首步：本 turn 领取的用户输入（含 `agent.inject()` 注入的上下文消息、goal 延续、cron 等，见 `[T] dsh-session/lib/types/types.d.ts:286-295` 对 `user/message` 三种来源的说明）；
- 后续步：`next-step` 边界上的 steering / 注入上下文。

因此 **PRD 第五部分「在 pre-step 里对历史上下文去重/裁剪」不可实现**。pre-step 能做的只有：改本步新消息的集合（追加/删除/替换这些条目）、或整步拒绝（`reject`）——后者会阻断该 turn，不能当"裁剪"用。

### 2.4 A/B) 历史上下文怎么改：`session.surface` + `surfaceOp: replace`（官方已有先例）

`PreStepDecision` **不能**替换整个上下文（无此字段），只能替换「本步进入的 messages」。要动历史，唯一可重放（replay-safe）的方式是**往日志追加一个替换事件**，用 surface shadow 协议：

- `[T] dsh-session/lib/types/types.d.ts:459-476`：

```ts
export type SurfaceOp = 'append' | {
    op: 'replace';
    startSeq: SessionSeq;
    endSeq: SessionSeq;
};
export type SurfaceIntent<T extends SurfaceEventType = SurfaceEventType> = {
    surfaceOp: SurfaceOp;
} & (T extends 'assistant/message' ? {...} : {
    /** Complete non-empty set of known earlier source-event seqs. */
    sourceEventSeqs?: SessionSeq[];
});
```

- 官方实现样板（**可直接照抄的范式**）：`[L] dsh-compaction-tool-result-pruner/lib/index.js:137-191`（`pruneSession`）：
  1. 遍历 `session.surface.nodes` 找 `tool/result`（`L139-146`）；
  2. 先 `session.append("compaction/prune", { shadowedRange, shadowedSeqs, shadowedTokenCount })`（`L159-166`）——影子事件给纯消费者一个"可减掉"的价格锚；
  3. 再 `session.append("tool/result", {...event.data, message}, { surfaceOp:{op:'replace',startSeq:seq,endSeq:seq}, sourceEventSeqs:[seq] })`（`L167-177`）。

**结论 B**：
- 历史（system/assistant/tool/result/user 的当前视图）只能通过 **surface replace + 影子事件**改，且必须保证「替换后仍能 replay」；
- `tools/post-execute` 的替换针对**单次调用的结果**，天然是「可逆替换」的一个特例（新事件覆盖旧节点），但不适用于"历史去重"这类跨节点操作；
- 另一条可行路径是**官方 compaction 服务契约**：`ctx.compaction`（`[I] Service.compaction`：`compactIfNeeded` / `compactNow` / `compactRegion`）。⚠️ 但**本机 web profile 把唯一实现 `compaction-basic` 禁用了**（`[L] dsh-web-app/cordis.patch.yml:544-545`，运行时 active=false），所以现在 `ctx.get('compaction')` 大概率为 `undefined`；要用它得先启用该 row 或自己提供实现。契约层面，历史压缩**优先复用 `ctx.compaction` 而不是自造 surface 改写**。

### 2.5 顺序语义：waterfall 顺序由什么决定

- `[C] cordis/src/events.ts:224-243`：

```ts
   * Compose listeners around the final `next` callback.
   * The last dispatch argument is treated as the innermost `next`. Listeners
   * run outermost-first; a listener that does not call `next()` vetoes the
   * rest of the chain, including the built-in behavior.
  waterfall(...args: any[]) {
    const cbs = this.dispatch('waterfall', args)
    const inner = args.pop()
    const next = () => {
      const cb = cbs.shift() ?? inner
      return cb(...args)
    }
```

- 监听器列表是 **每个事件名一个全局数组**，插入位置由 `EventOptions.prepend` 决定（`[C] cordis/src/events.ts:111-117`、`254-260`）：

```ts
export interface EventOptions {
  /** Add the listener before existing listeners for the same event. */
  prepend?: boolean
  /** Receive the event regardless of context filter checks. */
  global?: boolean
}
...
  register(label, hooks, callback, options) {
    const method = options.prepend ? 'unshift' : 'push'
```

所以精确语义是：

1. **同一事件**所有监听器（全局 `ctx.on` 与 agent 作用域 `agent.ctx.on` 混排）在**同一个数组**里；
2. 默认 = **注册顺序**（先注册先执行，最外层）；
3. `{prepend:true}` = `unshift` 到数组头 → **后注册的 prepend 更靠前**（后 prepend 覆盖先 prepend 的执行位置）；
4. waterfall 中**最外层（最先执行）的监听器对最终返回值有最后发言权**，因为它拿到的是整条链的返回；
5. 不调用 `next()` = 否决内层（包括内置默认行为）。

作用域过滤（`[C] cordis/src/events.ts:165-175` 的 `filter.call(thisArg, hook.ctx)` + `[T] dsh-scope/lib/types/index.d.ts:85-97`）：`scopeTarget(agent, agent)` 作为 dispatch 的 `thisArg`，标签匹配的 owner **及其祖先**收到事件（`事件向上流，不向下`）；未加标签的全局监听器收到全部 agent 的事件。

**与 mnemon 的实际关系（[M] 实测源码）**：mnemon 在 `agent/created` 时给**每个 agent** 装监听器，其中 pre-step 是 **prepend**：

```js
[M] dsh-mnemon/lib/index.js:11896-11902
	start() {
		const disposers = [
			this.agent.ctx.on("session/event", ((session, event) => this.sessionEvent(session, event))),
			this.agent.ctx.on("system-prompt/assemble", ((assembly, context, next) => this.assemblePrompt(assembly, context, next))),
			this.agent.ctx.on("agent/pre-step", ((payload, next) => this.preStep(payload, next)), { prepend: true }),
			this.agent.ctx.on("agent/turn-stopping", ((payload) => this.finishTurn(payload)))
		];
```

```js
[M] dsh-mnemon/lib/index.js:11983-12019   preStep(payload, next)
  const decision = await next();                       // 先让内层（含内置默认）跑完
  ... if (decision.kind === "reject" ...) return decision;
  ... if (decision.messages.some(isMnemonMessageSource)) return decision;
  ... return { kind: "enter", messages: withSnapshot([...decision.messages, pluginMessage]) }
```

即：**mnemon 是"包在内层外面"的包装器**——先 `await next()` 拿到底层结果，再往尾部追加自己的 memory snapshot / reminder 消息。

**关键风险**：mnemon 的 prepend 发生在**每个 agent 创建时**（`agent/created`，`[M] ...:12274-12278`），而本插件若在 profile 加载时 `ctx.on('agent/pre-step', …, {prepend:true})`，则**谁在数组头完全取决于两者相对注册时刻**（大量官方内置也 prepend，例如 `dsh-session-reference`、`dsh-agent` 的模型切换提示）。**不要依赖与 mnemon 的固定先后**（见 §9-R4）。

### 2.6 本机全量扫描：谁在监听 `agent/pre-step`（13 处，去重后 10 个内置包 + mnemon）

用 `asar-grep.cjs` 扫全部 829 个 `lib/*.js`（排除 client/renderer）得到的真实注册点：

| 包 | 位置 | 是否 prepend | 行为 |
|---|---|---|---|
| `dsh-agent` | `[L] dsh-agent/lib/index.js:193-204` | **是** | 模型切换提示：`[...decision.messages, modelSwitchNotice]` |
| `dsh-agent-instructions` | `[L] dsh-agent-instructions/lib/index.js:1406-1419` | 否 | `decision.messages.toSpliced(...)` 插入 AGENTS.md 上下文 |
| `dsh-compaction-basic`（**本机 row 被 web bundle 禁用 → 未激活，该监听器实际不存在**） | `[L] dsh-compaction-basic/lib/index.js:839-855` | 否 | 按压力 `compactIfNeeded(agent,"pressure",signal)` |
| `dsh-goal-round-driver` | `[L] dsh-goal-round-driver/lib/index.js:291` | 否 | goal 轮次校验 |
| `dsh-plan-mode` | `[L] dsh-plan-mode/lib/index.js:151-165` | 否 | 追加 plan 叙述 |
| `dsh-repeat-tool-reminder` | `[L] dsh-repeat-tool-reminder/lib/index.js:2261` | 否 | 重复工具提醒 |
| `dsh-session-checkpoint-policy` | `[L] dsh-session-checkpoint-policy/lib/index.js:72-75` | 否 | 每步前 `ctx.sessions.flush()` 持久化检查点 |
| `dsh-session-reference` | `[L] dsh-session-reference/lib/index.js:470-480` | **是** | 替换 `@session` 引用为快照 |
| `dsh-time-context` | `[L] dsh-time-context/lib/index.js:215-...` | 否 | 注入时间上下文 |
| `dsh-tmux-context` | `[L] dsh-tmux-context/lib/index.js:2265` | 未逐一确认 | 注入 tmux 位置 |
| `dsh-tool-skill` | `[L] dsh-tool-skill/lib/index.js:896-...` | 否 | 注入被调用技能内容 |
| `dsh-api-session-controller` | `[L] dsh-api-session-controller/lib/index.js:2516` | 否 | 归档会话直接 `{kind:'reject'}`（**不调用 next()** 的范式） |
| `dsh-mnemon`（第三方） | `[M] .../lib/index.js:11900` | **是** | 追加 memory snapshot / guided reminder |

> 结论：pre-step 是**本版本最拥挤的扩展点**。新增监听器必须 (a) 调用 `next()`；(b) 只在 `decision.kind === 'enter'` 时改；(c) 用 `signal.throwIfAborted()`/`signal.aborted` 做取消检查；(d) 不要假设自己排在 mnemon 前后。

### 2.7 `agent/pre-step` 结论

- ✅ 可用来：**向本步追加"模型可见的提示/上下文消息"**（如 Token 预警、超预算提示、去重后的本步消息）、**修改本步消息内容**、**在极端情况下拒绝该步**。
- ❌ 不可用来：读取/修改完整历史、删除已提交消息、替换 system prompt（那是 `system-prompt/assemble`，`[I] Event.system-prompt/assemble`）。
- ⚠️ 不调用 `next()` 会丢掉 host runtime-context 注入，且会让后续官方 pre-step 监听器全部失效。
- 📌 同一个 signal 会传入，`[T] ...:300` 明确 "the current turn's cancellation signal"，异步监听器必须观察它（否则取消后仍会往日志写）。

---

## 3. `tools/post-execute` 与 `tools/result`（waterfall / emit）

### 3.1 原始声明

`[T] dsh-tools/lib/types/index.d.ts:59-70`：

```ts
        /**
         * Accept, replace, enrich, or block a normalized dispatch result. `next()`
         * accepts it unchanged; thrown tools still reach this waterfall as errors. Async
         * listeners must observe `exec.signal`; after they settle, caller
         * cancellation replaces only a successful accepted outcome with the code
         * selected by whether the tool body was invoked.
         * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): agent-scoped listeners receive only that agent's calls.
         * @param exec - the call that just ran (name, parsed arguments, caller agent).
         * @param result - the dispatch outcome a listener may accept, replace, or block.
         * @mode waterfall
         */
        'tools/post-execute'(this: Scoped<ToolRuntime>, exec: ToolExecution, result: Readonly<ToolExecutionResult>, next: () => Promise<PostToolDecision>): Promise<PostToolDecision>;
```

`[T] dsh-tools/lib/types/index.d.ts:461-479`：

```ts
/**
 * Post-dispatch decision: accept, replace one projection, attach context for the
 * next request, or block by turning corrective feedback into an error result.
 */
export type PostToolDecision = {
    kind: 'accept';
    content?: ContentBlock[];
    value?: never;
    additionalContexts?: UserMessage[];
} | {
    kind: 'accept';
    value: JsonValue;
    content?: never;
    additionalContexts?: UserMessage[];
} | {
    kind: 'block';
    feedback: ContentBlock[];
    additionalContexts?: UserMessage[];
};
```

`tool/result`（**只读**）`[T] dsh-tools/lib/types/index.d.ts:85-92`：

```ts
        /**
         * Observe the frozen, lossless-JSON final outcome. Listener failures are contained.
         * Scope-filtered dispatch (`@deepseek-ai/dsh-scope`): keyed by `exec.agent`.
         * @param exec - the execution object that traversed the pipeline.
         * @param result - a deep-frozen snapshot of the final returned result.
         * @mode emit
         */
        'tools/result'(this: Scoped<ToolRuntime>, exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>): undefined;
```

相关类型（`[T] dsh-tools/lib/types/index.d.ts`）：

```ts
282: export interface ToolExecution extends ToolExecutionInput {
283:     /** Root model-requested call, resolved for every root and nested execution. */
284:     readonly rootCallId: ToolCallId;
285:     /** Registry-assigned identity shared with nested calls only as their opaque `parent` token. */
286:     readonly token: ToolExecutionToken;
287: }
...
426: /** Failed canonical tool execution; failures never carry a successful value. */
427: export interface ToolExecutionFailure {
428:     readonly isError: true;
429:     readonly error: ToolFailure;
430:     readonly value?: never;
431:     readonly content: ContentBlock[];
432:     readonly meta?: JsonValue;
433:     readonly additionalContexts?: UserMessage[];
434:     readonly concludesTurn?: never;
435: }
436: export type ToolExecutionResult = ToolExecutionSuccess | ToolExecutionFailure;
```

`ToolExecutionInput` 字段（`[T] …:216-242`）：`callId`、`rootCallId?`、`name`、`schema?`、`arguments`（已反序列化）、`agent?`、`parent?`（PTC 子派发 token）、`signal`。

### 3.2 实现：决策如何被应用

`[L] dsh-tools/lib/index.js:3599-3627`：

```js
	async postExecute(exec, result) {
		const decision = await this.ctx.waterfall(scopeTarget(this, exec.agent), "tools/post-execute", exec, result, () => Promise.resolve({ kind: "accept" }));
		const decisionContexts = decision.additionalContexts ?? [];
		if (decision.kind === "block") {
			const message = failureMessageFromContent(decision.feedback);
			return this.markCanonical(exec, {
				content: decision.feedback, isError: true, error: { message }, ...decisionContexts.length > 0 ? { additionalContexts: decisionContexts } : {}
			});
		}
		if (Object.hasOwn(decision, "content") && Object.hasOwn(decision, "value")) throw new TypeError("tools/post-execute accept decision cannot replace both value and content");
		const additionalContexts = [...result.additionalContexts ?? [], ...decisionContexts];
		if (Object.hasOwn(decision, "value")) {
			if (result.isError) throw new TypeError("tools/post-execute cannot replace the value of a failed result");
			const tool = this.resolveExecution(exec.name, exec.agent, exec.parent !== void 0);
			if (tool === void 0) throw new ToolNotFoundError(exec.name);
			const replaced = this.createSuccessResult(exec, tool, decision.value);   // 会重新走 output.schema 校验 + output.render
			return this.markCanonical(exec, { ...replaced, ...additionalContexts.length > 0 ? { additionalContexts } : {} });
		}
		return this.markCanonical(exec, {
			...result,
			...decision.content !== void 0 ? { content: decision.content } : {},
			...additionalContexts.length > 0 ? { additionalContexts } : {}
		});
	}
```

要点：
- `accept.content` → **只替换模型可见 content**，`value` 保留原规范值（`L3623-L3627`）。
- `accept.value` → 用新值重新校验/重渲染（`createSuccessResult`，`L3637-L3667`），且**失败结果不能换 value**。
- `block.feedback` → 结果变成 `isError:true`，content 就是 feedback（`L3602-L3610`）。
- `additionalContexts` 会**在结果之后**由 loop 接受进下一批上下文（见 §3.4）。

### 3.3 B) 替换后是否改变会话持久化日志 —— **会**

完整提交链（`[L] dsh-agent-loop/lib/index.js`）：

```
runGroup.commitReady()            L565-575
  const result = slot.needsPost
    ? await ctx.tools[TOOL_RUNTIME_SCHEDULER].finalize(slot.exec, slot.result)   // post-execute + finalizeContent
    : ctx.tools[TOOL_RUNTIME_SCHEDULER].finish(slot.exec, slot.result)
  appendToolResult(session, turn, step, call.block, result, callSeqs[committed]);  // ← 用最终 result 写日志
  for (const context of result.additionalContexts ?? []) acceptContext(context);
```

```
appendToolResult()                L690-707
	const message = createToolResultMessage({ callId: block.id, content: result.content, isError: result.isError });
	session.append("tool/result", { turn, step, message, ...error, ...meta }, { surfaceOp: "append", sourceEventSeqs: [callSeq] });
```

`finalize` 的定义（`[T] dsh-tools/lib/types/index.d.ts:358-367`）：`finalize()` = "Run post-execute and definition-owned content finalization, then materialize and notify"；对应实现 `[L] dsh-tools/lib/index.js:3478-3523`（`finishScheduledExecution` → `applyFinalContent` → `notifyResult`）。

**结论**：`tools/post-execute` 的 `accept.content` 替换发生在**持久化事件生成之前**，所以：
- 模型下一次请求看到的是替换后内容；
- `session` 里的 `tool/result.message.content` **也是替换后内容**；
- 因此"只改模型上下文、日志保原文"在官方口子上**无法实现**。要保原文只能自己另存一份（例如插件自写 `plugin:` 记录，见 §5.4），或者接受"日志也变"。
- 这也意味着 **替换逻辑要考虑 replay 一致性**：文本摘要必须可复现或至少可自解释（不要写入时间戳/随机数，或把它落到插件记录里）。

### 3.4 失败回退

| 场景 | 实际行为 | 依据 |
|---|---|---|
| 工具体 `throw` | 规范化成 `isError:true` 结果，**仍然进入** post-execute | `[T] …:60-61` "thrown tools still reach this waterfall as errors" |
| post-execute 监听器 `throw` | 整个 `execute()` 外层 try/catch 把它变成 `isError` 结果（`toolErrorResult`），即**工具调用失败** | `[L] dsh-tools/lib/index.js:3597-3598` 注释 "Runs inside `execute`'s outer try/catch (a throwing listener → isError)" |
| 监听器只想"不改" | 必须 `return decision`（`next()` 的结果）——不要 `return undefined` | `[L] …:3599-3600`，`next` 的默认是 `{kind:'accept'}` |
| 同时给 `value`+`content` | 抛 `TypeError`（→ 结果变错误） | `[L] …:3611` |
| 给失败结果换 `value` | 抛 `TypeError` | `[L] …:3614` |
| 取消（caller abort） | post-execute 之后，成功且已 accepted 的结果会被替换成取消码 | `[T] …:60-64` |

**实践建议**：替换逻辑必须写成

```js
try { /* 你的摘要/裁剪 */ } catch { return decision }   // 原样回退，绝不让异常逃出监听器
```

### 3.5 `tools/result` 是只读观察（PRD 假设成立）

- 模式 `emit`：同步派发，返回值 `undefined`（`[T] …:92`）。
- `exec` 在通知前被冻结：`[L] dsh-tools/lib/index.js:3506` `Object.freeze(exec)`；结果按 `[T] …:86-89` 是 "deep-frozen snapshot"。
- 监听器异常被包含：`[L] …:3508-3522` 只 `logger.warn("... tools/result observer failed: ...")`，并 `Promise.resolve(returned).catch(reportFailure)`。
- 无法改变结果：`notifyResult` 不接收返回值、不改 result。

**结论**：`tools/result` 适合做**统计/记账/副作用**（例如把每次工具结果的 token 数写进插件自己的存储），**不能**做内容改写。改写请用 `tools/post-execute`（提交前）或 `tools/ptc-dispatch-log`（仅 PTC 日志副本）。

### 3.6 本机全量扫描：谁在监听 `tools/post-execute` / `tools/result`

| 事件 | 注册者 | 位置 | prepend |
|---|---|---|---|
| `tools/post-execute` | **`dsh-spill-policy`**（官方：大结果溢出到 spill 存储 + preview） | `[L] dsh-spill-policy/lib/index.js:237-255` | **是** |
| | `dsh-repeat-tool-reminder` | `[L] dsh-repeat-tool-reminder/lib/index.js:2247` | 否 |
| | `dsh-tool-fs-search`（两处） | `[L] dsh-tool-fs-search/lib/index.js:848, 1159` | 否 |
| `tools/ptc-dispatch-log` | **`dsh-spill-policy`** | `[L] dsh-spill-policy/lib/index.js:256-259` | **是** |
| `tools/result` | `dsh-agent-instructions` / `dsh-tool-present` / `dsh-subagent` | `[L] dsh-agent-instructions/lib/index.js:1425`、`dsh-tool-present/lib/index.js:114`、`dsh-subagent/lib/index.js:940` | — |

`dsh-spill-policy` 是**本机唯一 active 的"大工具输出替换"实现**（阈值 `maxInlineTokens: 12500`，只兜底超大结果，见 §8.2），写法就是本 PRD 想要的形状：

```js
[L] dsh-spill-policy/lib/index.js:237-255
	ctx.on("tools/post-execute", async (exec, result, next) => {
		const decision = await next();                                        // 先让内层决定
		if (decision.kind !== "accept" || Object.hasOwn(decision, "value") || exec.name === "read") return decision;
		const content = decision.content ?? result.content;
		const hasImages = content.some((block) => block.type === "image");
		if (exec.parent !== void 0 && !hasImages) return decision;
		const retained = await bound(exec, content, exec.name, exec.callId, exec.parent === void 0 ? "result" : "dispatch");
		if (retained === void 0) return decision;                             // 未超预算 → 原样
		...
		return { kind: "accept", content: retained, ...additionalContexts };
	}, { prepend: true });
```

其预算来自配置（`[L] dsh-spill-policy/lib/index.js:123-127`）：`inject = ["tools"]`、`Config = z.object({ maxInlineTokens: z.number() })`；desktop 的 base bundle 已挂 `maxInlineTokens: 12500`（见 §8）。

### 3.7 `tools/post-execute` / `tools/result` 结论

- ✅ 可以在**模型看到之前**替换任意工具结果内容（含 images/text），并可跨工具统一处理（按 `exec.name`、`exec.agent`、`exec.parent` 区分）。
- ✅ 替换后的内容**同时**进入持久化日志（`tool/result`），replay/UI 与模型看到的一致。
- ✅ `tools/result` 只读，适合统计；`exec.agent?.session` 可用于归因。
- ⚠️ 不能"只改模型上下文不改日志"；替换逻辑必须吞掉自身异常；不要同时给 `value`+`content`。
- ⚠️ 与 `spill-policy` 的叠加顺序由 `prepend` + 注册时刻决定；若两者都裁剪，注意**二次裁剪**（你的输出会被 spill 再裁一次）或**互相抵消**。

---

## 4. `ctx.tools.register(definition)` 与 `ToolDefinition`

### 4.1 原始声明

`[T] dsh-tools/lib/types/index.d.ts:105-191`（核心，节选）：

```ts
/** Tool-owned canonical output contract used after the body returns a JSON value. */
export interface ToolOutputDefinition {
    /** Raw supported JSON Schema enforced against every successful canonical value. */
    readonly schema: JsonSchemaNode;
    /** Pure projection from validated arguments and value to Native/model content. */
    render(args: unknown, value: JsonValue): ContentBlock[];
    /** Pure replayable presentation projection for native and nested calls. */
    presentationMeta?(args: unknown, value: JsonValue): JsonValue;
}
/** A registered tool: its schema plus the execution function. */
export interface ToolDefinition extends ToolSchema {
    /** Mandatory canonical output declaration. */
    readonly output: ToolOutputDefinition;
    execute(args: unknown, exec: ToolRunContext): Promise<unknown>;
    projectContent?(exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>): ContentBlock[] | undefined;
    finalizeContent?(exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>): ContentBlock[] | undefined;
    timeoutMs?: number;
    isConcurrencySafe?(args: unknown): boolean;
    presentCall?(args: unknown): ToolCallView | undefined;
    presentResult?(args: unknown, result: ToolResult): ToolResultView | undefined;
}
```

`ToolSchema`（模型可见字段，`[T] dsh-llm/lib/types/types.d.ts:472-483`，被 `dsh-tools` 复用）：

```ts
export interface ToolSchema {
    deferLoading?: true;
    name: string;
    description: string;
    /** JSON Schema object for the arguments. */
    parameters: Record<string, unknown>;
}
```

`ToolRunContext`（`execute` 的第二个参数，`[T] dsh-tools/lib/types/index.d.ts:297-322`）：

```ts
export interface ToolRunContext extends ToolExecution {
    deferContext(context: UserMessage): void;   // 结果之后追加模型可见上下文
    concludeTurn(): void;                       // 本 turn 到此结束
}
```

注册 API（`[T] …:631-637`）：

```ts
    /**
     * Register globally or in the calling agent scope. Scoped tools shadow
     * globals; duplicates within one layer and the reserved `run_code` name fail.
     * @param definition - tool schema, execution, and optional finalization/presentation callbacks.
     * @returns the exact disposer that unregisters the tool.
     */
    register(definition: ToolDefinition): () => void;
```

`register` 返回**精确 disposer**，且该 disposer 作为 effect 挂在插件 fiber 上（插件卸载自动注销）。

### 4.2 参数 schema 写法：`defineTool` + `ParameterSchemaSpec`

内置包不直接手写 `parameters`，而是用 `defineTool`（`[T] dsh-tools/lib/types/schema.d.ts:178-248`）。注意它有**两套 schema 方言**：

1. **参数**：`ParameterSchemaSpec` = 「隐式开放 object 根」+ 每个属性 `required: true` 标注（`[T] dsh-tools/lib/types/schema.d.ts:73-84`）；
2. **输出**：`ValueSchemaSpec`（`type` + `enum/const/items/properties/additionalProperties/oneOf`，`json` 表示任意 JSON；`[T] …:19-72`），编译成 `JsonSchemaNode`（`[T] dsh-tools/lib/types/json-schema.d.ts`）。

关键约束：
- 输出契约**必需**：`output.schema` 会**真的校验** `execute` 的返回值，违反抛 `ToolOutputError`（`[T] …:406-411`；实现 `[L] dsh-tools/lib/index.js:3637-3667`）。
- `execute` 返回的是**规范值**（`JsonValue`），**不是**模型文本；模型文本来自 `output.render(args, value)`（`[L] …:3642-3648`）。想给模型"一句话摘要"，就写在 `render` 里。
- `parameters` 会经 `parameterSchemaSpecToJsonSchema` 编译（`[T] dsh-tools/lib/types/schema.d.ts:163`）；`schemas()` 只白名单 `name/description/parameters` 三个字段给模型（`[T] dsh-tools/lib/types/index.d.ts:706-712`）。

### 4.3 真实内置实现示例（可直接照抄的形状）

`dsh-tool-todo`（196 行，最小的完整工具插件）：`[L] dsh-tool-todo/lib/index.js`

```js
[L] dsh-tool-todo/lib/index.js:1-12
import z from "@deepseek-ai/schemastery";
import { z as z$1 } from "zod";
import { defineTool } from "@deepseek-ai/dsh-tools";
const name = "tool-todo";
const inject = ["tools", "sessionProjections"];
const Config = z.object({ allowParallelInProgress: z.boolean().required() });
...
[L] dsh-tool-todo/lib/index.js:78-193
function apply(ctx, config) {
	const allowParallel = config.allowParallelInProgress;
	ctx.sessionProjections.register({ /* 投影定义 ... */ });
	ctx.tools.register(defineTool({
		name: "todo_write",
		description: describe(allowParallel),
		parameters: { todos: {
			type: "array",
			required: true,
			description: "The COMPLETE task list, replacing any previous list.",
			items: {
				type: "object",
				additionalProperties: false,
				properties: {
					content: { type: "string", required: true, description: "..." },
					status:  { type: "string", required: true, enum: [...STATUSES], description: "..." }
				}
			}
		} },
		output: {
			schema: { type: "object", additionalProperties: false, properties: {
				todos:  { type: "array", required: true, items: { /* ... */ } },
				counts: { type: "object", additionalProperties: false, required: true, properties: { pending: {type:"integer",required:true}, inProgress: {...}, completed: {...} } }
			} },
			render: (_args, value) => [{
				type: "text",
				text: `Updated todo list: ${value.counts.pending} pending, ...`
			}]
		},
		execute(args, exec) {
			const todos = toTodoList(args.todos, allowParallel);
			if (!exec.agent) throw new Error("todo_write requires an owning agent session");
			exec.agent.session.append("todo/write", { todos });        // ← 工具自己写 durable 事件
			const count = (status) => todos.filter((t) => t.status === status).length;
			return Promise.resolve({ todos: [...], counts: {...} });    // ← 返回规范值
		},
		presentCall: (args) => ({ card: "generic", title: "Update todo list", kind: "other", rawInput: args.todos })
	}));
}
export { Config, apply, inject, name };
```

要点（对 Token Manager 直接可用）：
- 工具内可以 `exec.agent.session.append(...)` 写自己的 durable 事件（`TodoItem` 那种），并用 `sessionProjections.register` 做纯重放投影；
- `execute` 里抛错 → 自动变成 `isError` 结果（不需要自己 try/catch 来"报错"）；
- `presentCall`/`presentResult` 决定 Client 卡片；不写就落到通用卡片。

### 4.4 可见性与其它限制

| 项 | 语义 | 依据 |
|---|---|---|
| 作用域 | scoped 注册覆盖全局；同一层重名、保留名 `run_code` 会失败 | `[T] dsh-tools/lib/types/index.d.ts:631-637` |
| `restrict` | `allow`/`deny` 只过滤**继承来的**全局工具；本层注册不受影响；多个 restrict 取交集 | `[T] …:504-513`、`659-681` |
| `guard` | 在**所有** pre-execute 监听器之后、tool body 之前；返回字符串即拒绝，**只否决不肯定** | `[T] …:514-522`、`646-656` |
| PTC 模式 | `mode:'ptc'` 时模型只能直接调 `run_code`；子派发（带 `parent` token）才能调原生工具 | `[T] …:480-503`、`692-705` |
| 超时 | `timeoutMs` 只是声明，由 `dsh-tool-call-timeout-policy` 这个 `tools/execute` wrapper 执行；从不发给模型 | `[T] …:151-158` |
| 并发 | 仅 `isConcurrencySafe(args)===true` 才可并行；未声明=独占 | `[T] …:159-172` |

### 4.5 结论

- 注册模型可调工具的最小完备形状是：`defineTool({ name, description, parameters, output:{schema, render}, execute })` + `ctx.tools.register(...)`。
- `inject` 必须包含 `'tools'`（否则 `ctx.tools` 读取即抛错，见 §5.2）。
- 想让模型**直接**调用 Token 报告工具，用 `ctx.tools.register`；想**在模型上下文里自动注入**警告，用 §2 的 `agent/pre-step` 或 `deferContext`。

---

## 5. 插件导出形式 / Config / inject / 生命周期

### 5.1 支持的导出形状（供 patch 行加载）

`[C] cordis/src/registry.ts:91-133`：

```ts
/** Supported plugin entrypoint shapes. */
export type Plugin<T = any> = Plugin.Function<T> | Plugin.Constructor<T> | Plugin.Object<T>;
export namespace Plugin {
  export interface Base<T = any> {
    name?: string
    /** Standard-schema validator applied to config before the plugin starts. */
    Config?: StandardSchemaV1<any, T>
    /** Services the plugin requires; it only loads while all are available. */
    inject?: Inject
    /** Service name(s) the plugin provides (read by `Service` and by loaders). */
    provide?: string | string[]
    intercept?: Dict<boolean>
  }
  export interface Function<T = any> extends Base<T> { (ctx: Context, config: T): any }
  export interface Constructor<T = any> extends Base<T> { new (ctx: Context, config: T): any }
  export interface Object<T = any> extends Base<T> { apply(ctx: Context, config: T): any }
}
```

ESM 模块命名导出如何变成 plugin 对象：`[C] cordis-plugin-loader/src/index.ts:201-209`

```ts
  unwrapExports(exports: any) {
    if (isNullable(exports)) return exports
    exports = exports.default ?? exports
    if (!exports.__esModule) return exports
    return exports.default ?? exports
  }
```

→ 所以 **`export function apply` / `export const inject` / `export const Config` / `export const name` 命名导出即可**（`dsh-tool-todo` 就是这么做的，见 §4.3）；`default` 导出优先级更高。

### 5.2 `inject` 是硬约束（Lead 实测 + 源码定位）

- 报错原文：`cannot get property "<name>" without inject` —— 产生于 `[C] cordis/src/reflect.ts:144`：

```ts
      const error = new Error(`cannot get property "${prop}" without inject`)
      ...
        if (!ctx.fiber.runtime) return ctx.reflect.get(prop, false)
        return ctx.events.waterfall('internal/get', ctx, prop, error, () => {
          ...
          while (true) {
            const impl = fiber.store?.[prop]
            if (impl) return getTraceable(ctx, impl.value)
            if (prop in fiber.inject) { error.message = `cannot get required service "${prop}" in inactive context`; throw error }
            if (!fiber.runtime) throw error
            if (fiber.parent[symbols.isolate][prop] !== key) throw error
            fiber = fiber.parent.fiber
          }
        })
```

- 服务的可见集合来自 **该 fiber 的 inject 名单**：`[C] cordis/src/fiber.ts:596-620`

```ts
  _checkImpl(name: string) {
    const impl = this.ctx.reflect._getImpl(name, true)
    if (!impl) return delete this._store[name]
    ...
    this._store[name] = impl
  }
  _refresh() {
    let epoch: string | boolean = false
    epoch = ''
    for (const name of Object.keys(this.inject)) {
      const impl = this._store[name]
      if (!impl) { epoch = INACTIVE; break }
      epoch += ':' + impl.fiber.uid
    }
    this._setEpoch(epoch)
  }
```

  → **只有 `inject` 里列出的服务会进入 `_store`**；任何一个依赖缺席，fiber 的 epoch 为 `INACTIVE`，`apply` 不会被调用（这正是「插件条目未激活」的机制）。
- 加载器还允许在 patch 行上声明 `inject`：`[C] cordis-plugin-loader/src/config/entry.ts:21-22`（`inject?: Inject | null`）；fiber 侧注释也写明 loader 可以在 `internal/plugin` 通知里扩展 inject 集合（`[C] cordis/src/fiber.ts:310-318`）。

**Lead 实测结论（本版本 Cordis 语义）**：`inject = ['tools','tokenMeter']` 后 `ctx.tools`、`ctx.tokenMeter` 可用；`ctx.get('sessionProjections'|'agentLoop'|'sessions'|'llm'|'settings'|'storageDomain'|'spillStore'|'systemPrompt')` 均可用（`ctx.get` 走 `reflect.get`，不受 inject 限制，`[C] cordis/src/reflect.ts:225-243`）。

> 实践规则：**`ctx.<service>` 必须在 `inject` 里声明；可选依赖用 `ctx.get('name')` 并判 `undefined`。**

### 5.3 Config 校验：schemastery（StandardSchema），不是 zod 专用

- 校验发生在 fiber 启动前：`[C] cordis/src/fiber.ts:42-62`

```ts
export function resolveConfig(runtime: Plugin.Runtime, config: any) {
  if (!runtime.Config) return config
  const result = runtime.Config['~standard'].validate(config)
  if ('then' in result) throw new TypeError('Async config validation is not supported')
  if (result.issues) throw new ValidationError(result.issues)
  else return result.value
}
```

- schemastery 的 `Schema` 实现 `~standard`：`[C] schemastery/src/index.ts:154`（`'~standard': StandardSchemaV1.Props`）、`290`（`Object.defineProperty(Schema.prototype, '~standard', …)`）。
- 因此 `export const Config = z.object({...})`（`z` 来自 `@deepseek-ai/schemastery`）是正解；zod 4 亦实现 `~standard`，但内置包统一用 schemastery，**建议保持一致**（例：`[L] dsh-tool-todo/lib/index.js:1,20`；`[T] dsh-token-meter/.../index.d.ts:6-7,21` 也是 schemastery）。
- 配置非法 → `ValidationError` → 该 entry 不激活（不阻塞 Harness，Lead 已实测 warning 行为）。
- 运行时改配置有两条路：loader 普通更新（重挂 fiber）与 **volatile 更新**（仅 `Volatile` 引用，不重挂）：`[C] cordis-plugin-loader/src/config/entry.ts:118-157`、`164-197`。

### 5.4 清理语义：`ctx.effect` / `ctx.on` / `ctx.inject`

| API | 语义（源码） |
|---|---|
| `ctx.effect(execute, label?)` | `execute` 立即执行，返回的 disposer 被收集；**fiber 卸载或调用 disposer 时逆序执行**；可两次调用（第二次 no-op）；fiber 已 disposed 时抛 `INACTIVE_EFFECT`。`[C] cordis/src/fiber.ts:402-442` |
| `ctx.on(name, listener, opts?)` | 通过 `ctx.fiber.effect` 注册，**fiber 卸载自动移除**；`opts` 可为 boolean（= prepend）或 `{prepend, global}`；已 disposed 抛错。`[C] cordis/src/events.ts:254-302` |
| `ctx.inject(deps, cb)` | 等价于 `ctx.plugin({inject:deps, apply:cb})`：**依赖服务变化时自动卸载并重跑 cb**。`[C] cordis/src/registry.ts:164-176, 293-302` |
| `ctx.plugin(plugin, config)` | 在当前 context 起一个新 fiber；返回的 fiber 是 thenable（`await` 到加载完成）。`[C] cordis/src/registry.ts:304-336` |
| 返回值 disposer | `ctx.tools.register` / `ctx.tools.guard` / `ctx.tools.restrict` / `ctx.sessionProjections.register` 等都返回"精确 disposer"，**都挂在当前 fiber 上**（插件卸载自动注销）。`[T] dsh-tools/lib/types/index.d.ts:631-656` |

### 5.5 被禁用 / 卸载时：资源与数据

- 禁用 = loader 把 entry 标为 `disabled`，并 **dispose 其 fiber**：`[C] cordis-plugin-loader/src/config/entry.ts:136-139`

```ts
    // step 2: execute
    if (this.disabled) {
      this.fiber?.dispose()
      return
    }
```

  以及 `[C] cordis-plugin-loader/src/config/entry.ts:111-115`（disabled 时 `refresh()` 不初始化）。父 group 禁用会连带（`disabled` getter 向上遍历，`L75-85`）。
- 重新启用 = 再次 `init()` → 重新 `import` + `registry.plugin()`（`L209-238`），即 `apply` 重新执行、所有注册重新建立。
- 卸载（loader 侧行为）时会把 `disabled: true` 写回 patch：`[C] cordis-plugin-loader/src/index.ts:158-166`。
- **资源**：`ctx.effect`/`ctx.on`/`register` 的 disposer 会随 fiber 逆序执行 → 监听器、服务、工具注册、定时器（`ctx.timer.*`）都自动清掉。
- **数据不会被清理**：Cordis/loader 只卸载代码，不触碰插件写过的任何持久数据（profile 目录、`DSH_HOME` 下自建目录、会话日志里的 `plugin:` 记录）。官方没有"卸载时清数据"的钩子——**插件要自己设计迁移/清理**。
- 会话日志兼容：插件写会话事件必须用 `plugin:` 命名空间（`[T] dsh-session/lib/types/types.d.ts:514-544`），并可标记 `ignorable?: true`（`[T] …:498-508`），这样**卸载后旧会话仍可重建**、未知记录可安全跳过。这是 Token Manager 落历史统计数据时**必须遵守**的协议。

### 5.6 结论

- 导出形状：`apply` + `inject` + `Config`(schemastery) + `name` 命名的 ESM 模块即可。
- `inject` 决定"能不能读到服务"和"插件是否激活"；`ctx.get()` 用于可选服务。
- 资源清理全自动（fiber effect 模型），**数据清理全手动**。
- 不要自己订阅 `ctx.on('loader/...')` 之类内部事件来管理生命周期；用 `ctx.effect` 的 disposer 表达所有权即可。

---

## 6. Token 归因相关事件（真实 handler 签名与可用字段）

> 全部签名可在活进程用 `cordis_inspect_query(host, Event, listEvents, {event:'...'})` 复核；下面同时给出 `[T]` 类型出处。

### 6.1 `agent/created`（serial，可 await，可失败创建）

`[T] dsh-agent/lib/types/runtime-types.d.ts:227-231`：

```ts
        'agent/created'(this: Scoped<Agent>, payload: {
            agent: Agent;
            source: SessionStartSource;
            signal?: AbortSignal;
        }): undefined | Promise<undefined>;
```

- `SessionStartSource = 'startup' | 'resume' | 'clear' | 'compact'`（`[T] …:104-105`）。
- 语义（`[T] …:214-226`）：监听器按序 await；**抛错会失败创建**；AgentLoop 会挂起排队输入直到所有监听器完成；不得 `await agent.whenIdle()`。
- `Agent` 的可用字段（`[T] dsh-agent/lib/types/runtime-types.d.ts:138-210` 的 module augmentation）：`id`、`options`(provider/model/reasoningEffort/maxTokens)、`session`、`inbox`、`status`、`ctx`、`cancel()/whenIdle()/runMaintenance()/send()/followup()/steer()/inject()`。
- 归因用途：在这里为每个 agent 建立"会话→内存状态/监听器"的映射（mnemon 就是这么做的，`[M] …:12275-12278`）；可读 `agent.options.provider/model` 记录路由。

### 6.2 `agent/disposed`（emit）

`[T] …:240-242`：

```ts
        'agent/disposed'(this: Scoped<Agent>, payload: {
            agent: Agent;
        }): void;
```

- 时机（`[T] …:232-239`）：AgentLoop 在 driver 静默、作用域注册回卷之后、session 解绑之前发出。
- 归因用途：把内存聚合 flush 到磁盘/汇总（**emit 是 fire-and-forget，异常只会被 warn**，见 `[C] …/events.ts:194-196`；关键记账不要只靠这里，应该写 durable 记录）。

### 6.3 `session/event`（emit，提交后的追加订阅）

`[T] dsh-session`（`[I] Event.session/event`）：

```ts
'session/event'(this: Scoped<Session>, session: Session, event: SessionEvent): void
```

- Lead 已实测：handler 是 **两个位置参数** `(session, event)`（不是 payload 对象）。
- `SessionEvent` 是 `{type, seq, time, data}` 判别联合（`[T] dsh-session/lib/types/types.d.ts:490-513`），`data` 形状按 type 收窄。
- **Token 归因最关键的字段**：`assistant/message` 携带 usage（`[T] …:321-339`）：

```ts
    'assistant/message': {
        turn: number;
        step: number;
        message: AssistantMessage;
        /** Exact timed model stream, compacted without joining delta boundaries. */
        stream: AssistantStreamRecord[];
        usage?: TokenUsage;
        interrupted?: true;
    };
```

- `TokenUsage` 的计数是**互斥**的（`[T] dsh-llm/lib/types/types.d.ts:152-174`）：

```ts
export interface TokenUsage {
    inputTokens: number;       // 未缓存输入
    outputTokens: number;
    totalTokens?: number;      // 完整调用总量（provider 有就给）
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    reasoningTokens?: number;
}
```

  → 计费口径应为 `inputTokens + cacheReadTokens + cacheWriteTokens + outputTokens`（官方 `usageTokens()` 就这么算：`[L] dsh-token-meter/lib/index.js:673-676`）。
  → Lead 实测 `13611 + 2 + 512 = 14125 = totalTokens`，验证了"`inputTokens` 是未命中输入"。
- 其它可归因事件：`tool/call`（`L355-361`）、`tool/result`（`L375-389`）、`request/header`（`L394-399`，含 provider/model/`config`）、`turn/start|end`、`step/start`、`compaction/prune`、`plugin:*`。
- 用途：这是**唯一**能拿到"每次请求真实 usage + 每次工具结果体积"的持久订阅口；适合做账本落盘（写自己的 `plugin:` 记录或用外部存储）。

### 6.4 `llm/stream`（waterfall，包住**每一次**模型流式调用）

`[T] dsh-llm/lib/types/index.d.ts:28-46`：

```ts
declare module '@deepseek-ai/cordis' {
    interface Context { llm: LlmRuntime; }
    interface Events {
        /**
         * Waterfall around every streaming model call (retry, replay, routing).
         * ...
         * @param options - the full request. A LOOP-built request carries the
         *   process-local markAgentLoopRequest identity and arrives deep-frozen
         *   (mutation throws): its content is a pure function of the session log (the
         *   reconstructability Agent Note), so listeners read it, never rewrite it.
         * @mode waterfall
         */
        'llm/stream'(this: LlmRuntime, options: GenerateOptions, next: () => AsyncIterable<StreamChunk>): AsyncIterable<StreamChunk>;
    }
}
```

- `GenerateOptions`（`[T] dsh-llm/lib/types/types.d.ts:506-548`）字段：`provider`、`model`、`reasoningEffort?`、`messages`、`system?`、`tools?`、`toolHistory?`、`temperature?`、`maxTokens?`、`stop?`、`signal?`、`sessionId?`、`purpose?`（`'compaction' | 'session-title'`）。
- `StreamChunk`（`[T] …:426-464`）包含 `{type:'usage', usage: TokenUsage}` —— **流内也能拿到 usage**，可做实时计量；`finish` 带 `reason`。
- 结论：`llm/stream` 适合做**实时/旁路计量**（包装 AsyncIterable，统计 chunks 与 usage）与**路由观测**；**不能**改 loop 构建的请求内容（深冻结、抛错），也不适合做重活（每次调用都在关键路径上）。

### 6.5 `subagent/start` / `subagent/end`（emit）

`[T] dsh-subagent/lib/types/types.d.ts:70-108`：

```ts
export interface SubagentRunInfo {
    readonly runId: SubagentRunId;
    readonly provider: string;
    readonly id: SessionId;       // 子 agent 的 session id
    readonly local: boolean;
}
export interface SubagentRunEndInfo {
    readonly runId: SubagentRunId;
    readonly provider: string;
    readonly id: SessionId;
    readonly local: boolean;
    readonly stopReason: SubagentResult['stopReason'];
    readonly lastAssistantMessage?: readonly ContentBlock[];
}
```

`[I] Event`：`'subagent/start'(this: Scoped<SubagentRuntime>, info: SubagentRunInfo)`、`'subagent/end'(this: Scoped<SubagentRuntime>, info: SubagentRunEndInfo)`，均 `emit`。

- 归因：拿到 `info.id` 后可用 `ctx.get('sessions')` / `ctx.get('agentLoop')` 或 `ctx.subagents.listChildren(parentSessionId)`（`[I] Service.subagents`）把子会话的 usage 汇总到父；**子 agent 自己的 usage 仍写在其自身 session 的 `assistant/message` 上**，不会自动冒泡。

### 6.6 `ctx.tokenMeter`（C 答案：`totalTokens` vs `surfaceTokens`）

类型：`[T] dsh-token-meter/lib/types/index.d.ts:19-57`、`[T] dsh-token-meter/lib/types/types.d.ts:23-55`：

```ts
export interface TokenMeasurement {
    readonly logRevision: SessionLogOffset;
    readonly baseline: TokenMeasurementBaseline;  // {kind:'none',tokens:0} | {kind:'estimated',tokens} | {kind:'usage',tokens,usage}
    readonly surfaceDeltaTokens: number;
    readonly totalTokens: number;      // 非负的"本次请求压力"
    readonly surfaceTokens: number;    // 当前 surface 全部节点的路由定价总和
    readonly nodes: readonly TokenSurfaceNode[];  // 每个 surface 节点 {seq,tokens,heuristicTokens}
}
```

实现（`[L] dsh-token-meter/lib/index.js:722-765`）：

```js
	measure(session, requestHeader) {
		...
		const surface = priceSurface(state.surface, pricing, fileText);   // 当前 surface 全部节点定价
		const anchor = state.anchor;                                      // 上一次成功请求的锚点
		if (anchor !== void 0 && optionalHeaderEquals(anchor.header, header)) {
			const anchorSurfaceTokens = priceSurface(anchor.nodes, pricing, fileText).surfaceTokens + anchor.assistantTokens;
			const estimatedAnchorTokens = estimateToolsTokens(header) + anchorSurfaceTokens;
			const usage = anchor.usage;
			baseline = usage !== void 0 && usageTokens(usage) >= estimatedAnchorTokens
				? { kind: "usage", tokens: usageTokens(usage), usage }
				: { kind: "estimated", tokens: estimatedAnchorTokens };
			surfaceDeltaTokens = surface.surfaceTokens - anchorSurfaceTokens;
		} else if (header === void 0 && surface.surfaceTokens === 0) {
			baseline = { kind: "none", tokens: 0 }; surfaceDeltaTokens = 0;
		} else {
			baseline = { kind: "estimated", tokens: estimateToolsTokens(header) + surface.surfaceTokens };
			surfaceDeltaTokens = 0;
		}
		return { ..., totalTokens: Math.max(0, baseline.tokens + surfaceDeltaTokens), surfaceTokens: surface.surfaceTokens, nodes: surface.nodes };
	}
```

`[L] dsh-token-meter/lib/index.js:76-85`（唯一被"另算"的非 surface 部分）：

```js
/**
* Price the tool-schema part of a canonical request envelope — the envelope's
* only priced field, since the system prompt is a surface node.
*/
function estimateToolsTokens(header) {
	if (header?.tools === void 0 || header.tools.length === 0) return 0;
	return Math.ceil(JSON.stringify(header.tools).length / CHARS_PER_TOKEN) + BLOCK_OVERHEAD;
}
```

**结论 C（用 Lead 的数字验算）**：

- `surfaceTokens` = **当前会话 surface 节点**（`system/message`、`user/message`、`assistant/message`、`tool/result`…）按路由定价之和。system prompt 是 surface 节点，**包含在内**。
- `baseline` = 上一次成功请求的"整封请求压力锚"：
  - 若锚点的 request header 与当前一致、且那次 provider usage 总量 ≥ 估计锚点 → 用**真实 usage**（`kind:'usage'`）；
  - 否则用**估计值** `kind:'estimated', tokens = estimateToolsTokens(header) + 锚点 surface`。
- `totalTokens = max(0, baseline.tokens + surfaceDeltaTokens)`，其中 `surfaceDeltaTokens = 当前 surface − 锚点 surface`。因此：
  - 锚点存在时：`totalTokens = 锚点总压力 + surface 增量`（**含工具声明**，因为锚点里含 `estimateToolsTokens`）；
  - 无锚点/首步时：`totalTokens = estimateToolsTokens(header) + surfaceTokens`（`surfaceDeltaTokens = 0`）。
- Lead 的 `totalTokens=12095, surfaceTokens=4890, baseline=estimated` 落在"有锚点、估计分支"：`12095 = (7205 + anchorSurface) + (4890 − anchorSurface)` → **工具声明部分 ≈ 7205 tokens**（工具 schema JSON 的 1/4 字符数 + 4），且 `surfaceDelta` 在两侧抵消，所以直接读作 `totalTokens = toolsTokens + surfaceTokens`。
- 实践含义：
  - 想降 `totalTokens`，**两条独立杠杆**：降 `surfaceTokens`（裁消息）与降 tools 声明（`deferLoading`、`tools.restrict`、PTC 模式收敛工具面）。对 7205 这种量级，**工具面比几条消息更值钱**；
  - `surfaceTokens + toolsTokens` 才是"上下文占用估算"，`baseline.kind==='usage'` 时 `totalTokens` 更接近真实计费量（含缓存/输出）；
  - `nodes[]` 给出**逐节点**价格（含 `seq`），是"哪些节点最贵"的直接依据，可直接用于 Phase 3 的裁剪决策。
- 另有三个已注册的投影可直接给 UI 用：`tokenUsage`（累计 4 桶 + last turn/step，`[L] …:394`）、`contextPressure`（`[L] …:449`）、`contextBreakdown`（`systemTokens`/`toolsTokens`/`messageTokens`，`[L] …:108-200`）。
- **注意**：DSH **没有货币计价**（`[T] dsh-token-meter/lib/types/route-pricing.d.ts` 只做 image/file 的 token 定价）。要做"费用（¥/$）"，Token Manager 必须自建单价表（按 `provider+model` 映射），这部分**官方无接口**。

### 6.7 归因结论

| 目标 | 推荐接入点 | 理由 |
|---|---|---|
| 每次请求真实用量（input/cache/output） | `session/event` → `assistant/message.usage` | 唯一持久、可 replay、无副作用 |
| 每次工具结果的体积/裁剪收益 | `tools/result`（只读）+ `tools/post-execute`（写策略） | 前者可精确对比裁剪前后 |
| 当前上下文压力/逐节点价格 | `ctx.tokenMeter.measure(session)` | O(surface)，可缓存；**不要每 step 都调**（见 §9-R6） |
| 实时流式计量 | `llm/stream`（包 AsyncIterable） | 能拿 chunk 级 usage，但在热路径 |
| 子 agent 归属 | `subagent/start|end` + 子 session 事件 | runId/session id 可对账 |
| 会话生命周期 | `agent/created` / `agent/disposed` | 建/拆内存聚合 |

---

## 7. 最小可用示例（ESM JS，Host 半）

> 状态：**未在本会话安装/运行**（本轮禁装插件）。以下按本审计确认的契约书写，可直接作为 `probe/` 下一版骨架；安装与真机验证留到 Phase 5/6。

### 7.1 包结构（bundle）

```
dsh-token-manager/
  package.json
  cordis.patch.yml
  index.js
  locale/en.json
```

`package.json`（关键点：`type: module`、`dsh.bundle.patch`、`engines.dsh`）：

```json
{
  "name": "dsh-token-manager",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "index.js",
  "exports": { ".": "./index.js" },
  "engines": { "dsh": ">=0.2.1-rc.1 <0.3.0-0" },
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

`cordis.patch.yml`：

```yaml
- insert:
    - id: token-manager
      name: "dsh-token-manager"
      config:
        warnAtTokens: 100000
        hardAtTokens: 150000
        replaceToolResultsOverTokens: 2000
```

### 7.2 `index.js`

```js
// dsh-token-manager · Host half
// 契约来源：dsh-tools / dsh-agent / dsh-session / dsh-token-meter @0.2.1-rc.5
import { randomUUID } from 'node:crypto'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

/** 插件自有来源的 user 消息：照抄 dsh-mnemon 的 createPluginMessage 形状（[M] .../lib/index.js:8614-8633）。 */
function createPluginMessage(text) {
  return structuredClone({
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'token-manager' },
  })
}

export const name = 'token-manager'

// 必须声明：未声明的服务读取会抛 `cannot get property "<name>" without inject`
export const inject = ['tools', 'tokenMeter']

export const Config = z.object({
  warnAtTokens: z.number().step(1).min(1).default(100_000),
  hardAtTokens: z.number().step(1).min(1).default(150_000),
  // 0 = 关闭本插件的工具结果替换（官方 spill-policy 仍在工作）
  replaceToolResultsOverTokens: z.number().step(1).min(0).default(2_000),
})

export function apply(ctx, config) {
  // ── 1) 归因：持久订阅 session/event，累计真实 usage（emit，异常被包含，不要在这里做重活）
  const usage = new Map() // sessionId -> { input, cacheRead, cacheWrite, output, turns }
  ctx.effect(() => ctx.on('session/event', (session, event) => {
    if (event.type !== 'assistant/message') return
    const u = event.data.usage
    if (u === undefined) return
    const row = usage.get(session.id) ?? { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, turns: 0 }
    row.input += u.inputTokens
    row.cacheRead += u.cacheReadTokens ?? 0
    row.cacheWrite += u.cacheWriteTokens ?? 0
    row.output += u.outputTokens
    row.turns += 1
    usage.set(session.id, row)
    // 持久化请在 Phase 3 换成写自己的 plugin: 记录 或 外部存储
  }), 'token-manager: usage fold')

  // ── 2) 上下文预警：pre-step 里只“追加本步消息”，绝不替换历史
  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next() // 必须调用：保住 host 的 runtime-context 注入与后续官方监听器
    if (decision.kind === 'reject' || payload.signal.aborted) return decision
    if (payload.step !== 1) return decision

    const m = ctx.tokenMeter.measure(payload.agent.session) // O(surface)，按需/缓存
    if (m.totalTokens < config.warnAtTokens) return decision

    const text = `[token-manager] 当前上下文压力约 ${m.totalTokens} tokens`
      + `（surface ${m.surfaceTokens}）。请优先精简工具输出、避免重复贴长文件。`
    // 用插件自有 source.kind（不要用 'runtime-context'：那种会被 loop 的 runtime-context
    // 投影去重逻辑吞掉，见 [L] dsh-agent-loop/lib/index.js:1066-1073）
    return {
      kind: 'enter',
      ...decision, // 保留 startsRequestSeries 等既有字段
      messages: [...decision.messages, createPluginMessage(text)],
    }
  }, { prepend: true })

  // ── 3) 工具结果“可逆替换”：post-execute（提交前），失败必须原样回退
  if (config.replaceToolResultsOverTokens > 0) {
    ctx.on('tools/post-execute', async (exec, result, next) => {
      const decision = await next() // 先让内层（含官方 spill-policy）决定
      try {
        if (decision.kind !== 'accept') return decision
        if (Object.hasOwn(decision, 'value')) return decision // 已换规范值 → 不要碰 content
        const content = decision.content ?? result.content
        if (result.isError) return decision
        if (!content.every((b) => b.type === 'text' || b.type === 'image')) return decision

        const chars = content.reduce((n, b) => n + (b.type === 'text' ? b.text.length : 0), 0)
        if (chars <= config.replaceToolResultsOverTokens * 4) return decision // 粗估：4 chars ≈ 1 token

        const head = content.find((b) => b.type === 'text')?.text.slice(0, 800) ?? ''
        const replaced = [{
          type: 'text',
          text: `${head}\n\n[token-manager] 已省略 ${chars} 字符的工具输出；原始内容保存在会话事件 tool/result 之前的历史事件中。`,
        }]
        return {
          kind: 'accept',
          content: replaced,                                   // 只替换模型可见 content
          additionalContexts: decision.additionalContexts,     // 透传，别丢
        }
      } catch {
        return decision // 任何异常 → 原样回退，绝不让它变成 isError
      }
    }, { prepend: true })
  }

  // ── 4) 给模型一个只读查询工具（规范值 + render）
  const disposeTool = ctx.tools.register(defineTool({
    name: 'token_usage_report',
    description: '读取当前会话的累计 token 用量与当前上下文压力（只读）。',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          totalTokens: { type: 'integer', required: true },
          surfaceTokens: { type: 'integer', required: true },
          inputTokens: { type: 'integer', required: true },
          outputTokens: { type: 'integer', required: true },
          cacheReadTokens: { type: 'integer', required: true },
        },
      },
      render: (_args, v) => [{
        type: 'text',
        text: `压力 ${v.totalTokens}（surface ${v.surfaceTokens}）｜累计 input ${v.inputTokens} / output ${v.outputTokens} / cacheRead ${v.cacheReadTokens}`,
      }],
    },
    execute(_args, exec) {
      const agent = exec.agent
      if (agent === undefined) throw new Error('token_usage_report 需要 agent 上下文')
      const m = ctx.tokenMeter.measure(agent.session)
      const u = usage.get(agent.session.id) ?? { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 }
      return Promise.resolve({
        totalTokens: m.totalTokens,
        surfaceTokens: m.surfaceTokens,
        inputTokens: u.input,
        outputTokens: u.output,
        cacheReadTokens: u.cacheRead,
      })
    },
  }))
  ctx.effect(() => disposeTool, 'token-manager: token_usage_report')

  // ── 5) 卸载时把内存聚合落盘（示例；真正实现放 Phase 3）
  ctx.effect(() => () => {
    // usage.clear() / 写 DSH_HOME 下的自建文件
    usage.clear()
  }, 'token-manager: flush')
}
```

### 7.3 示例的契约要点（逐条可核对）

1. `inject` 含 `'tools'`、`'tokenMeter'` → 否则 §5.2 的报错。
2. `pre-step` **一定先 `await next()`**，且只 **追加**消息（不重建数组）。
   ⚠️ **不要**用 `source.kind = 'runtime-context'` 造消息：`[L] dsh-agent-loop/lib/index.js:1066-1073` 会对这种 source 做"投影去重"（只写入 host 合并后的 context，**你自己的那条不会被写入**）。要用插件自有 kind（示例用 `'token-manager'`，形状照抄 mnemon 的 `createPluginMessage`：`[M] dsh-mnemon/lib/index.js:8614-8633`）。
3. `post-execute` 三件套：`next()` → 判 `kind`/`value`/`isError` → `try/catch` 回退。
4. `defineTool` 的 `output.schema` 会真校验，`render` 才是模型可见文本。
5. 所有 disposer 都包在 `ctx.effect` 里（`ctx.tools.register` 本身已挂 fiber，额外包裹只是显式表达所有权）。
6. **不要**在 `pre-step` 里直接 `session.append` 改写历史；要写历史走 §2.4 的 `surfaceOp: replace` + 影子事件（或 `ctx.compaction`）。

---

## 8. 与 PRD 设想的差异（重点）

### 8.1 PRD 第五部分「pre-step 里对历史上下文去重/裁剪」→ **不可直接实现**

| PRD 设想 | 实测契约 | 结论 |
|---|---|---|
| pre-step 能拿到全部历史消息并去重 | `payload.messages` 只是本步从 inbox 领取的新消息（§2.3），历史在 `session.surface`（`[T] dsh-session/lib/types/types.d.ts:459-476`） | ❌ 不能；只能"追加/修改本步消息"或 `reject` 该步 |
| `decision.messages` 可替换整个上下文 | `PreStepDecision` 只有 `kind:'enter'` + `messages`（本步），无历史字段（§2.1） | ❌ |
| 可"静默裁剪"历史 | 历史改写必须落日志（surface replace + `compaction/prune` 影子事件，`[L] dsh-compaction-tool-result-pruner/...:159-177`） | ✅ 但要做成 replay-safe 的**追加替换**，不是原地改 |

**可替代路径（按推荐度）**：
1. **复用官方 compaction 契约**：`ctx.compaction`（`[I] Service.compaction`：`compactIfNeeded/compactNow/compactRegion`）。⚠️ 但本机 `compaction-basic`（唯一实现）被 web bundle 禁用（§8.2），服务当前不存在；要复用**必须先把该 row 打开**，否则 `ctx.get('compaction') === undefined`。`dsh-compaction-basic` 自己确实挂在 `agent/pre-step` 按压力触发（`[L] dsh-compaction-basic/lib/index.js:839-855`），但那条路径本机没跑。
2. **工具结果层用 `tools/post-execute`**（§3）：命中率最高、最安全、已被官方 `spill-policy` 验证。
3. **确需历史去重**时，学 `tool-result-pruner` 的 surface replace + 影子事件写法，**并只处理 `tool/result` 节点**（官方样板的目标节点）；跨 role 重写风险高（replay、UI、缓存均受影响）。

### 8.2 "大工具输出替换成摘要" → **配置行存在，但本机运行时只启用了一个高阈值兜底**

> **本节已按 Lead 的运行时实测修正。** 原稿只读 patch 文件就断言"已默认开启"，是错的：**patch 里出现 row ≠ 运行时启用**。

三层事实必须分开看。

**(1) base patch 里确实有这些 row**（`[L] dsh-base/cordis.patch.yml`）：

| 行 | 内容 |
|---|---|
| `347-348` | `- id: token-meter` / `name: '@deepseek-ai/dsh-token-meter'` |
| `350-351` | `- id: compaction-basic` / `name: '@deepseek-ai/dsh-compaction-basic'` |
| `355-356` | `- id: command-compact`（`/compact` 命令） |
| `410-411` | `- id: spill-local` / `name: '@deepseek-ai/dsh-spill-local'` |
| `413-416` | `- id: spill-policy` / `config: { maxInlineTokens: 12500 }` |
| `422-429` | `- id: tool-result-pruner` / `config: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 }` |
| `431-434` | `- id: image-offload`（`@deepseek-ai/dsh-compaction-image-offload`） |

**(2) web bundle 把其中三行显式覆盖为 `disabled: true`**（`[L] dsh-web-app/cordis.patch.yml:537-551`，原文）：

```yaml
537: # The token METER stays on the host plane; only the compaction backend that
538: # reads it moves. It owns the context-meter projection units, and that table is
...
544: - id: compaction-basic
545:   disabled: true
546:
547: - id: command-compact
548:   disabled: true
549:
550: - id: tool-result-pruner
551:   disabled: true
```

**(3) 运行时实测（Lead，`plugin_manager list_plugins` 217 条真实条目）**：

| row | 运行时状态 |
|---|---|
| `include:token-meter` | enabled:true / active |
| `include:spill-local` | enabled:true / active |
| `include:spill-policy` | enabled:true / active |
| `include:image-offload` | enabled:true / active |
| `include:repeat-tool-reminder` | enabled:true / active |
| `include:compaction-basic` | **enabled:false / fiberPhase:null（inactive）** |
| `include:command-compact` | **enabled:false / fiberPhase:null（inactive）** |
| `include:tool-result-pruner` | **enabled:false / fiberPhase:null（inactive）** |

> ⚠️ **`spill-policy` 阈值的待复核点**：`maxInlineTokens: 12500` 只是 base patch 的**静态配置**（web 层没有覆盖它）。按源码 `[L] dsh-spill-policy/lib/index.js:141-144`，`cap === undefined` 时 `apply()` 直接 `return`（**连 `tools/post-execute` 监听器都不会挂**），所以"row active"只能证明插件起来了，不能证明阈值已生效。建议用 `plugin_manager list_plugins` 输出里的 config 字段（或 `dsh --dump-config`）**再确认一次运行值**；本审计未直接读到该运行配置值（见 §10-11）。

**结论（本机 desktop profile 真实生效的能力）**：

- ✅ **`spill-policy`（active）**：对**单次工具结果**做"内联上限"兜底——估算 tokens > `maxInlineTokens(12500)` 时，完整文本写入 `spillStore`，模型只见 head + `[...]` + tail + `Full formatted result stored at: …` 定位提示（`[L] dsh-spill-policy/lib/index.js:179-255`）。
  - 但它是**高阈值兜底**，不是常规压缩：`totalPrice <= maxTokens` 时直接 `return void 0`（`L184`）→ 2k–12k tokens 的中等大结果**完全不动**，而这正是收益最大的区间。
  - 还有两类被显式跳过：`exec.name === 'read'`（读文件结果不 spill，`L239`）与「PTC 子派发且无图片」（`L242`，改走 `tools/ptc-dispatch-log`）。
  - 它**不做**确定性 head/middle/tail 裁剪，也**不写** `compaction/prune` 影子计价。
- ❌ **`tool-result-pruner`（inactive）**：8192 字符以上结果的确定性裁剪**完全没有运行**；而且它唯一调用方就是 `dsh-compaction-basic`（`[L] dsh-compaction-basic/lib/index.js:926-931` / `942-945`：`const prune = this.ctx.get("toolResultPruner")` → `prune.pruneSession(agent.session)`），`compaction-basic` 也被禁用 → **双重不可达**。
- ❌ **`compaction-basic` / `command-compact`（inactive）**：**没有自动上下文压缩，也没有 `/compact` 命令**。

→ 因此 **Phase 2「工具结果压缩」在本机是真实空白，不是重复造轮子**。两点补充：
1. **别把 `spill-policy` 当成"压缩已就绪"**：它只兜底 >12500 tokens 的极端结果，且跳过 `read` 与 PTC 子派发。
2. **`toolResultPruner` 的实现仍是最佳参考**：确定性、可配 `thresholdChars/headChars/tailChars`、写 `compaction/prune` 影子价格、`surfaceOp:'replace'` 可重放（`[L] dsh-compaction-tool-result-pruner/lib/index.js:137-191`）。可复用思路；注意本机**该服务未提供**（`ctx.get('toolResultPruner')` 会是 `undefined`），不要盲调。

**建议定位**：
1. **配置面**：把 `spill-policy` / pruner / compaction 的阈值暴露成 UI（当前只能改 YAML），并提供"启用官方 pruner + compaction"的开关；
2. **归因面**：真实 usage + 逐节点价格 + 每工具成本排行（官方只给数据，不给产品化视图）；
3. **策略面**：在 `post-execute` 做 **12500 tokens 以下区间**的摘要/裁剪（官方空白区），并与 `spill-policy` 叠加顺序明确（先 `await next()` 再处理它已缩过的内容，或按阈值错开）；
4. **成本面**：DSH **无货币计价**（`[T] dsh-token-meter/lib/types/route-pricing.d.ts` 只有 token 定价），单价表必须自建。

### 8.3 "只在模型上下文里替换、不改日志" → **不可行**

DSH 的模型输入是**会话日志的纯函数**（`[T] dsh-llm/lib/types/index.d.ts:37-41`：loop-built request 深冻结，"listeners read it, never rewrite it"；`[T] dsh-tools/lib/types/index.d.ts:129-137` 的 `projectContent` 都排在 post-execute 之前）。因此任何上下文变换都必须在**日志层面**发生。产品叙述要改成"**可重放的内容替换**"，而不是"悄悄改上下文"。

### 8.4 其它差异

| PRD 假设 | 实测 | 影响 |
|---|---|---|
| 可以用 `tools/result` 改写工具输出 | `emit` 只读、结果深冻结、异常被吞（§3.5） | 改写必须用 `tools/post-execute` |
| 插件只要 `apply` 就能读服务 | 未在 `inject` 声明 → 抛错、entry 不激活（§5.2） | 骨架必须带 `inject` |
| 插件卸载会清理数据 | 只卸载代码，数据不动（§5.5） | 需自设计数据目录与 `plugin:` 记录兼容 |
| 有货币成本接口 | 无；只有 token 定价 | 单价表自建，且要版本化 |
| `agent/pre-step` 顺序可控 | 由全局注册顺序 + `prepend` 决定；mnemon/官方多处 prepend，顺序依赖注册时刻（§2.5） | 不能依赖"我在 mnemon 之后" |

### 8.5 Phase 3 设计建议（基于本审计）

1. **不要**在 pre-step 里做历史裁剪；历史压缩有两条路：(a) surface replace（只处理 `tool/result`，学 pruner 的写法）；(b) 复用 `ctx.compaction` 契约——但**本机 `compaction-basic` 被 web bundle 禁用，`ctx.get('compaction')` 大概率为 `undefined`**（§8.2），要用就先打开该 row 或自己实现。
2. **工具结果压缩**做成 `post-execute` 的**包装层**（先 `await next()`）：官方 `spill-policy` 只兜底 **>12500 tokens** 的极端结果（且跳过 `read`），**低于该阈值的中等大结果是空白区** —— 正好是 Token Manager 的主战场；不要重复实现 >12500 那段兜底。
3. **归因账本**用 `session/event` 的 `assistant/message.usage` + `tools/result` 落 `plugin:` 记录/独立库；`agent/created|disposed` 管生命周期；`subagent/start|end` 做跨 agent 对账。
4. **压力面板**用 `ctx.tokenMeter.measure()` 的 `nodes[]`（逐 seq 价格）+ `contextBreakdown` 投影（system/tools/message 三分），这是官方已有但无 UI 的数据。
5. **成本**：自建 `provider×model` 单价表，用 `assistant/message.usage` 的四个互斥桶计算；不要把 `totalTokens` 当计费量（它含缓存读/写的不同单价）。

---

## 9. 风险与建议

| ID | 风险 | 证据 | 建议 |
|---|---|---|---|
| R1 | **版本漂移**：安装包不含 `.d.ts`，类型只能靠 npm 同版本对齐；升级后行号/类型可能变 | §1.3 | 在 CI 里做「asar `lib/index.js` 哈希 vs npm 包」校验；运行时用 `ctx.get()` + 特性探测，别硬编码行号 |
| R2 | **历史改写破坏 replay**：直接 `session.append('user/message')` 无法删旧节点 | §2.4 | 必须 `surfaceOp:{op:'replace'}` + `compaction/prune` 影子事件；先抄官方 pruner |
| R3 | **pre-step 不调用 `next()`** 会静默丢失 host runtime-context，且让后续官方 pre-step 监听器失效 | `[L] dsh-agent-loop/lib/index.js:913-920` | 永远 `const decision = await next()` 后再改；用 `signal.aborted` 早退 |
| R4 | **顺序不稳定**：mnemon 与多个官方包都 `{prepend:true}`；谁在最外层取决于注册时刻 | `[M] …:11900`、`[C] events.ts:254-260` | 不依赖固定先后；需要"必须在 mnemon 之后"时，用 `setTimeout`/`agent/created` 后注册或改为读 mnemon 产出的消息 `source`（mnemon 自己就是这么避环的，`[M] …:11993`） |
| R5 | **post-execute 抛错 = 工具调用失败** | `[L] dsh-tools/lib/index.js:3597-3598` | 全部替换逻辑包 `try/catch` 并 `return decision` |
| R6 | **`tokenMeter.measure()` 是 O(surface)**，每 step 调用会放大开销 | `[T] dsh-token-meter/.../index.d.ts:38-45` 注释 "Every call clones those positional nodes, so measurement is O(surface)" | 只在 turn 首步/超阈值时测；缓存 `logRevision` 变化再重算 |
| R7 | **emit 监听器异常被吞**（只 warn）→ 关键记账静默丢失 | `[C] cordis/src/events.ts:194-196`；`[L] dsh-tools/lib/index.js:3508-3522` | 关键数据写 durable 记录（`plugin:` 事件/外部库），不要在 emit 里做唯一记账 |
| R8 | **与官方 `spill-policy` 叠加**：二次裁剪、摘要被再裁、`additionalContexts` 被丢；`read`/PTC 子派发会被 spill 跳过 | §3.6、§8.2 | 先 `await next()`；用 `decision.content ?? result.content` 判断是否已被官方改写；保留 `additionalContexts`；阈值与 12500 错开 |
| R9 | **`llm/stream` 在热路径**：包装 AsyncIterable 若未正确转发 `signal`/背压，会拖慢或泄漏 | `[T] dsh-llm/.../types.d.ts:426-433` | 只做轻量旁路（计数/采样）；不要在流中做同步 IO |
| R10 | **高权限面**：能改模型可见内容与会话日志 ⇒ 可被用于提示注入/审计规避 | §3、§2.4 | 所有替换写入 `plugin:` 记录（谁改的、改了哪个 seq、原文 hash）；默认关闭高风险改写 |
| R11 | **卸载后数据残留**：账本/摘要仍在 DSH_HOME 与旧会话日志里 | §5.5 | 数据目录带版本号 + 迁移脚本；会话内记录用 `plugin:` + `ignorable: true` |
| R12 | **PTC 模式**：`mode:'ptc'` 时模型只能直接调 `run_code`，你的工具会"消失" | `[T] dsh-tools/.../index.d.ts:480-503` | 注册工具时同时考虑 PTC 路径，或用 `presentAs` 明确预期 |

---

## 10. 未确认项（明确标注，不用猜测填充）

1. **`plugin_manager` 卸载 bundle 对磁盘数据的清理范围**：本轮禁用 `plugin_manager` 动作（会改 profile），未实测；从 loader 源码只确认「代码卸载」，未找到数据清理代码路径。
2. **HMR / 热重载期间的监听器顺序与重复注册**：`loader/entry-init`、`loader/partial-dispose` 存在（`[C] cordis-plugin-loader/src/config/entry.ts:58-61`、`152`），但"重载后 prepend 相对顺序是否改变"未实测。
3. **`ctx.tools.restrict` / `ctx.tools.guard` 与 Token Manager 的交互**：类型已读（§4.4），未做行为验证。
4. **`agent/request` 是否能改 `maxTokens` 从而改变成本**：`LlmCallConfig` 可被 waterfall 替换（`[I] Event.agent/request`、`[T] dsh-agent/...:311-332`），但实际计费影响未实测。
5. **`subagent/start|end` 的跨 agent token 汇总路径**：字段已确认（§6.5），"用 `ctx.subagents.listChildren` 逐个子会话统计"未做端到端验证。
6. **`llm/stream` 中 `GenerateOptions.messages` 是否可安全只读遍历**：类型说深冻结（改会抛），未实测异常文案。
7. **DSH 是否提供模型单价/费用 API**：`[T] dsh-token-meter/lib/types/route-pricing.d.ts` 只做 image/file token 定价；未发现货币计价接口（结论倾向"没有"，但未穷举全部包）。
8. **`system-prompt/assemble` 的精确改写能力**（PRD 若想改 system prompt）：仅从 `[I] Event.system-prompt/assemble` 拿到签名 `(assembly, context, next) → Promise<PromptAssembly>`，本篇未逐字段审计（不在本任务 5 个问题范围内）。
9. ~~`dsh-spill-policy` 与 `tool-result-pruner` 的交互顺序~~ → **已解决**：`tool-result-pruner` 在本机 inactive，且它唯一调用方 `compaction-basic` 也 inactive（`[L] dsh-compaction-basic/lib/index.js:926-945`），两者不存在叠加；`spill-policy`（active，12500 tokens）与**未来自研裁剪**的叠加仍需真机复测。
10. **本会话未运行任何示例代码**（§7 为设计稿，不是验证过的产物）。
11. **`spill-policy` 的运行配置值未直接读取**：只确认 row 为 active + base patch 静态配置 `maxInlineTokens: 12500`；实际挂载值需用 `plugin_manager list_plugins` 的 config 字段或 dump-config 再核一次（源码 `[L] dsh-spill-policy/lib/index.js:141-144` 显示 cap 缺失时监听器不挂）。

---

## 附录 A：快速对照表（记不住的只用看这里）

```
agent/pre-step      waterfall  (payload.agent,messages,turn,step,signal, next)
                    messages = 本步新消息（非历史）；decision = {kind:'reject'} | {kind:'enter',messages,startsRequestSeries?}
                    历史改写 → session.append(..., {surfaceOp:{op:'replace',startSeq,endSeq}, sourceEventSeqs})

tools/post-execute  waterfall  (exec, result(Readonly), next) → {kind:'accept',content} | {kind:'accept',value} | {kind:'block',feedback}
                    替换发生在 commit 前 ⇒ 同时改日志；异常 ⇒ isError；同时给 content+value ⇒ TypeError
tools/result        emit       只读、deep-freeze、异常被吞

tools.register      ToolDefinition = {name,description,parameters,output:{schema,render[,presentationMeta]},execute(args,exec)}
                    execute 返回规范值；模型文本 = render；抛错 ⇒ isError
                    推荐用 defineTool({...})（@deepseek-ai/dsh-tools）

插件导出            export function apply(ctx, config) {}
                    export const inject = ['tools','tokenMeter']   // 硬要求
                    export const Config = z.object({...})          // @deepseek-ai/schemastery
                    export const name = 'token-manager'

清理                ctx.effect(fn) / ctx.on(...) 随 fiber 卸载逆序执行；数据不清理

Token 归因          session/event → assistant/message.data.usage（四桶互斥）
                    ctx.tokenMeter.measure(session) → {totalTokens, surfaceTokens, nodes[], baseline}
                    totalTokens = baseline + surfaceDelta；无锚点时 = toolsTokens + surfaceTokens
                    llm/stream（热路径，只读）、subagent/start|end（runId/session id）
```
