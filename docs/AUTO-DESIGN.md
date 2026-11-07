# AUTO 自动推理调度 · 设计基线与实现契约（v1.4.0）

> 采集时间：2026-11-07（Europe/Berlin）· 项目根：`E:\ZHIRAI Harness\dsh-token-manager`
> 本文是本次升级的**唯一架构基线**：所有实现、测试、报告都以此为准。修改接口前先在团队任务板登记。

## 0. 环境与链路实测结论（Phase 0，真实命令/真实读取）

| 项目 | 实测值 | 证据 |
|---|---|---|
| DSH 版本 | `0.2.2-rc.1`（2026-11-04 安装） | `dsh --version` |
| 当前 profile | `desktop`（Electron 桌面应用，HMR 开启） | env `DSH_PROFILE` |
| 插件安装方式 | `dsh-token-manager: "link:E:/ZHIRAI Harness/dsh-token-manager"` | `%DSH_HOME%/profiles/desktop/package.json` |
| 真实模型调用 | `deepseek-account` / `deepseek-flash`，input/cache_read/output 均由 API 返回 | 真实 headless 调用 + 插件 ledger 落库 |
| 推理档位域 | **`off` / `low` / `high` / `max`**（适配器自有枚举，不跨适配器共享） | `dsh-llm-deepseek` README §reasoningEffort |
| 逐档位含义 | `low/high/max` 开 thinking 并序列化为 `output_config.effort`；`off` 发送 `thinking.type:disabled` | 同上 |

### 0.1 关键发现：推理档位在「步骤准备」时固定，`agent/request` 已被弃用

- `dsh-agent-loop` 的 `preStep()`：先 `this.model.current()` 捕获 selection，再做 prompt 组装，最后才派发 `agent/pre-step` waterfall（payload 带 `modelSelection`）。
- `agent/request` waterfall 仍存在但**已弃用**，且改动 provider/model/reasoningEffort 会直接抛错：
  `agent/request proposed reasoning effort ... after step preparation fixed ... use agent.model.select() before step preparation`。
- 因此 **AUTO 唯一合法写入点** = `agent.model.select(selection)`（`AgentModel` 类），它 `session.append('model/selection', ...)`，投影 `modelSelection.pending`，**从下一个步骤（含同一轮次内的工具续步）开始生效**。
- 读取当前档位：`agent.model.current()`；投影 `modelSelection`（`lastUsed`/`next`）也可读。

### 0.2 任务开始前改写档位的挂钩（已确认存在）

| 事件 | 模式 | 签名/要点 |
|---|---|---|
| `agent/inbox/inserted` | emit | `payload = { agent, message }`；消息进入 inbox 后、driver 唤醒 claim 之前派发；**同步**监听器可在本任务第一步前 `agent.model.select()` |
| `agent/pre-step` | waterfall | `payload = { agent, messages, turn, step, signal, modelSelection }`；此处 `select()` 只影响**下一步** |
| `agent/status` | emit | `{ status }`，用于识别 idle/running |
| `session/event` | emit | `(session, event)`；`model/selection`、`request/header`、`tool/call`、`tool/result`、`assistant/message` |
| `agent/turn-stopping` | waterfall | 轮次关闭前；只读观察，不用于改档 |
| `subagent/start` / `subagent/end` | emit | 子 Agent 生命周期（上下文审计用） |

### 0.3 可用服务（`ctx.get(...)` / `ctx.<name>`）

- `agents.get(sessionId) → Agent`、`agents.list()`、`agents.turnBoundaryOf(session)`；运行期 Agent 实体带 `.model`（`AgentModel`：`current()/select()`）、`.session`。
- `llm.listModels(provider)` / `llm.resolveModelInfo(provider, model)` → 含 `reasoning: { efforts: [{id,name,description}], defaultEffort }`；`llm.resolveCallConfig()`。
- `sessionProjections`、`sessions`、`tokenMeter`、`tools`、`webServer`、`connection`、`settings`（沿用现有插件用法）。
- 事件/服务/类型的权威清单（本机提取自 asar，只读）：
  `C:\Users\Administrator\AppData\Local\Temp\dsh-src\dsh\node_modules\@deepseek-ai\dsh-tool-cordis\lib\types\api-catalog.js`

### 0.4 真实运行/热更新环境（已实测通过）

1. **真实调用测试 profile**：`tm-auto-test`（由 `headless` 模板生成）
   - patch 已把 headless 禁用的 `credentials` / `authorization` / `deepseek-account` 重新启用，`agent-default-model = deepseek-account/deepseek-flash`。
   - 单次真实调用命令：`dsh --profile tm-auto-test "<任务>"`（约 5s，输出最终答案）。
   - 插件数据目录隔离：设置环境变量 `DSH_TOKEN_MANAGER_DATA_DIR=<测试目录>`，避免污染生产库。
   - `node_modules/dsh-token-manager` 已改为指向工作区的 junction，改源码 + `node scripts/build.mjs` 后立即生效。
2. **生产桌面应用热更新**（不用重启应用）：改 `src` → `node scripts/build.mjs` → 触碰 `%DSH_HOME%\profiles\desktop\cordis.patch.yml`（加/删一行无害配置）→ 约 5–8s 后 HMR 重新加载插件。
   - 判定依据：插件 meta `last_start` 时间戳变化（DB: `%DSH_HOME%\dsh-token-manager\token-manager.db`）。
   - **注意**：该机制会重载生产 profile 里的本插件，动作要小、先构建通过再触发。
3. **客户端插件**：改 `src/client` 后 build，刷新浏览器页面即加载新 `lib/client.js`（host 半的重载不自动刷新页面）。

## 1. 产品目标与硬约束

1. 推理档位选择区域新增 **AUTO**；手动 OFF/LOW/HIGH/MAX 行为**完全保留**（原有选择、持久化、快捷键、行为都不变）。
2. AUTO 依据**每次任务**判断难度，控制**每次模型请求**的实际档位；不永久改会话档位，不跨任务继承高档位。
3. 逐级升级 `OFF → LOW → HIGH → MAX`，一次最多升一档；任务开始不得直接 HIGH/MAX。
4. 只有「推理性失败」才允许升级；环境类失败（文件不存在/路径/权限/依赖/网络/命令/测试环境/外部 API）**禁止升级**，只记录原因。
5. AUTO 决策必须轻量：只用本地规则 + 已产生的 Agent Loop 信息，**不额外调用模型**。
6. 不绕过现有 Token 控制（压缩/缓存/统计），不重复造轮子，不删除现有功能。
7. 无法从模型 API 得到的数字必须标为「估算」，不得伪造。

## 2. 模块与文件归属（写作用域）

| 模块 | 文件 | 负责人 |
|---|---|---|
| 共享契约/设置/类型 | `src/shared/constants.ts`、`src/shared/types.ts`、`src/shared/contracts.ts`、`docs/AUTO-DESIGN.md` | Lead |
| 插件入口装配 | `src/index.ts`、`tests/harness.ts` | Lead |
| AUTO 规则 | `src/host/auto-rules.ts`（新） | auto-engine |
| AUTO 分类 | `src/host/auto-classifier.ts`（新） | auto-engine |
| AUTO 调度器 | `src/host/auto-scheduler.ts`（新） | auto-engine |
| AUTO 状态/决策存储 | `src/host/auto-store.ts`（新） | auto-engine |
| AUTO HTTP | `src/host/auto-api.ts`（新） | auto-engine |
| AUTO 单测 | `tests/unit/auto-*.test.mjs`（新） | auto-engine |
| 客户端 AUTO UI | `src/client/auto.tsx`（新）、`src/client/index.tsx`、`src/client/api-client.ts`、`src/client/settings.tsx`、`src/client/overview.tsx`、`src/client/report.tsx`、`src/client/styles.css` | ui-auto |
| 语言包 | `locale/zh.json`、`locale/en.json` | ui-auto |
| 统计/成本 | `src/host/usage-ledger.ts`、`src/host/analytics.ts`、`src/host/report.ts`、`src/host/cost-calculator.ts` | token-context |
| 上下文复用 | `src/host/context-reuse.ts`（新）、`src/host/tool-cache.ts`（只加调用点） | token-context |
| 子 Agent 审计 | `src/host/subagent-audit.ts`（新） | token-context |
| 分层上下文包 | `src/host/context-pack.ts`（新）+ 工具 `token_manager_context` | token-context |
| 真实测试/证据 | `scripts/e2e/**`、`docs/AUTO-TEST-REPORT.md`、`.verify/auto/**` | verifier |

**禁止**：任何人不要改别人的文件；需要跨文件改动先在团队任务板留言或找 Lead。
**不提交**：`lib/`（gitignore）、`node_modules/`、`.verify/`、临时 DB。

## 3. 共享契约（Lead 提供，实现按此对齐）

### 3.1 设置（`settings.auto`，默认关闭）

```ts
export const AUTO_DEFAULTS = {
  enabled: false,                 // AUTO 总开关；关闭时插件绝不调用 model.select
  includeSubagents: true,         // 子 Agent 会话也纳入 AUTO
  initial: { simple: 'off', normal: 'low', complex: 'low' }, // 任务开始档位（不得为 high/max）
  maxInitial: 'low',              // 初始档位上限
  ladder: ['off', 'low', 'high', 'max'],
  escalateOnReasoningFailure: true,
  reasoningFailuresToEscalate: 2, // 同任务内「推理性失败」次数达到即升一档
  maxStepsWithoutProgress: 40,    // 兜底：推理性卡死
  filesForComplex: 3,             // 涉及 ≥N 个文件的写操作视为复杂
  maxEscalationsPerTask: 3,       // 单任务最多升级次数（3 次即 low→max）
  resetOnNewTurn: true,           // 新任务重新判断
  monitorOnly: false,             // true=只记录决策不真正 select（观察模式）
}
```

### 3.2 决策记录（DB 表 `auto_decisions`，由 auto-store 建表，`CREATE TABLE IF NOT EXISTS`）

```sql
CREATE TABLE IF NOT EXISTS auto_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  turn INTEGER,
  step INTEGER,
  task_type TEXT,          -- simple-edit | normal-dev | complex-dev | troubleshoot | project-analysis
  from_effort TEXT,        -- 当前档位；可用 'unknown'
  to_effort TEXT NOT NULL, -- off | low | high | max
  stage INTEGER NOT NULL,  -- 0=初始, 1..N=升级序
  action TEXT NOT NULL,    -- classify | escalate | hold | reset | manual-exit | skip
  reasons TEXT NOT NULL,   -- JSON string[]
  evidence TEXT,           -- JSON: {files, tools, failures, failureKinds, steps, signals}
  applied INTEGER NOT NULL -- 1=已 select 生效, 0=仅记录
);
CREATE TABLE IF NOT EXISTS auto_sessions (
  session_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  started_at INTEGER,
  last_task_type TEXT,
  last_effort TEXT,
  updated_at INTEGER
);
```

### 3.3 HTTP API（挂到现有 `src/host/http-api.ts` 路由之外的新模块，仍需经过同一 fence）

前缀 `/token-manager/api/auto/`：

| 方法 | 路径 | 请求 | 响应 |
|---|---|---|---|
| GET | `status?sessionId=` | – | `AutoStatus` |
| POST | `enable` | `{enabled:boolean}` | `{enabled}` + `AutoStatus` |
| POST | `manual` | `{sessionId}` | `{manual:true}`（该会话退出 AUTO，恢复手动；全局 enabled 不变） |
| POST | `classify` | `{text:string}` | `AutoClassification`（dry-run，不落库） |
| GET | `decisions?sessionId=&limit=` | – | `AutoDecision[]` |
| GET | `summary` | – | AUTO vs manual 对比统计（token/成本/档位分布/成功率） |

```ts
interface AutoStatus {
  enabled: boolean
  sessionId: string | null
  mode: 'auto' | 'manual' | 'off'
  current: { provider: string; model: string; effort: string | null } | null
  supportedEfforts: string[]
  task: { type: string; stage: number; effort: string; confidence: number; reasons: string[] } | null
  lastDecision: AutoDecision | null
  estimates: boolean   // 统计中是否含估算值
}
interface AutoClassification {
  taskType: 'simple-edit'|'normal-dev'|'complex-dev'|'troubleshoot'|'project-analysis'
  effort: 'off'|'low'            // 初始档位
  confidence: number             // 0..1
  reasons: string[]
  signals: { length: number; files: number; modules: number; keywords: string[]; intent: string }
}
```

### 3.4 事件顺序契约（调度器实现必须遵守）

1. `agent/inbox/inserted` **同步**完成：分类 → `agent.model.select()` → 落 `auto_decisions(action='classify')`，不得 await 重活。
2. `agent/pre-step`：先 `await next()` 拿到 decision；再依据内存证据计算目标档位；若升级则 `agent.model.select()`（下一步生效）并落库；**必须原样返回 decision**（不能吞掉）。
3. `session/event`：同步累积证据（工具调用/结果/错误/文件），异常全部吞掉，绝不打断 Harness。
4. 外部 `model/selection`（非本调度器写入）→ 视为用户手动选择：该会话 `manual`，落 `manual-exit`，`settings.auto.enabled` 置 false（AUTO 与手动是互斥模式）。
5. 所有回调 try/catch；失败只记录 `last_error`，不抛。

## 4. AUTO 判定规则（auto-rules.ts 要点）

### 4.1 初始分类（任务开始，仅 OFF/LOW）

不按文字长度单判；综合信号：

| 信号 | 权重 | 说明 |
|---|---|---|
| 意图/关键词：改颜色/文案/文字/标题/按钮/样式/查询/查看/命令 | simple | 简单 UI/文字/查询/简单命令 |
| 意图：修 bug/排查/为什么/报错/定位/分析多个原因 | troubleshoot | 一般 LOW；出现「多个可能原因」→ complex |
| 架构/设计/重构/多模块/跨模块/方案/迁移/性能 | complex | 初始 LOW（不得 HIGH），升级证据来得更快 |
| 提及文件/路径/函数数量 | files≥3 → complex；files≥1 → normal | 从文本正则 + 会话 cwd 文件存在性不做 IO |
| 文本长度 | 仅作弱信号（<80 字且单句 → 倾向 simple） | 不作为主判据 |
| 已有上下文：本会话前几轮是否复杂、是否有失败 | 弱信号 | 新任务不继承高档位 |
| 子 Agent 派活文本（task prompt） | 按同一规则 | spawn 子任务通常 normal |

输出 `taskType` + `effort`（simple→off，normal/troubleshoot/complex→low）+ `confidence` + `reasons`。

### 4.2 升级证据（`agent/pre-step` 每步评估）

只有满足以下**推理性**信号才升级（一次一档）：

1. `taskType=complex-dev|troubleshoot` 且 已修改/关联文件 ≥ `filesForComplex`（3）→ 升一档。
2. 同一目标上「推理性失败」累计 ≥ `reasoningFailuresToEscalate`（默认 2）→ 升一档。
3. 步骤数 ≥ `maxStepsWithoutProgress` 且任务未结束、无环境类失败 → 升一档（兜底）。
4. 已尝试 ≥2 种不同方案仍未通过验证（命令失败/测试失败重复出现且命令不同）→ 升一档。

「推理性失败」= 失败原因不属于环境类、且发生在模型产出/验证链（例如测试断言失败、构建语法错误由模型改动引入、用户反馈仍不对、验证命令连续失败）。
累计与判定只用本地事件，不调模型。

### 4.3 环境类失败（**禁止升级**，只记录）

按错误文本/错误码分类，至少覆盖：`ENOENT`、`ENOTDIR`、`EISDIR`、`EACCES`/`EPERM`、路径不存在/无效路径、`Cannot find module`/依赖缺失、`ECONNREFUSED`/`ETIMEDOUT`/`ENOTFOUND`/网络、`command not found`/不是内部或外部命令、测试环境缺依赖、外部 API 4xx/5xx/不可用、端口占用、权限/沙箱拒绝。
规则：出现环境类失败 → 本次不升级；若此前已升级不再回退；记录 `failureKinds` 到 evidence。

### 4.4 任务切换（测试 E）

每个新 `agent/inbox/inserted`（且 agent 空闲/新轮次）都重新分类，**忽略上一任务档位**：
- 上一任务 HIGH，下一任务「改按钮颜色」→ `off`。
- 用户中途 steer（agent running）→ 不降档，只按新指令的复杂度**允许升档**。

### 4.5 手动优先

- `settings.auto.enabled=false` → 调度器完全静默（不 select、不写 decision，只可观察）。
- 用户在官方选择器选任何档位 → `manual-exit`，AUTO 关闭。
- `monitorOnly=true` → 记录决策但 `applied=0`。

## 5. 真实测试矩阵（verifier 执行并出证据）

| 用例 | 任务 | 预期 | 证据 |
|---|---|---|---|
| A 简单 | 「把按钮颜色改成 #2563eb」（真实文件） | AUTO 初始 `off`，全程不升档；请求 header reasoningEffort=off | 决策表 + request/header 日志 + token 记录 |
| B 普通 | 「新增一个普通功能函数并接上导出」 | 初始 `low`；无推理失败则不升级 | 同上 |
| C 复杂 | 「分析涉及 3+ 文件的联动问题并修复」 | 初始 `low` → 证据满足后升 `high`（必要时 max） | 决策表 stage 序列 |
| D 非推理失败 | 人为路径/依赖错误 | 不发生升级；failureKinds 记录环境类 | 决策表 hold + evidence |
| E 任务切换 | 先复杂任务（已升 high），再简单任务 | 第二个任务初始回 `off` | 决策表两条 classify |
| F 上下文 | 主 Agent 调子 Agent | spawn=fresh 只收任务包；fork=继承历史被审计标记 | subagent 审计表 + 子会话 input 统计 |
| G Token 统计 | 每次请求 | 输入/输出/推理/缓存命中/未命中/实际档位/费用；真实字段来源标记 | ledger 行 + API 原始 usage |

**执行方式**：`dsh --profile tm-auto-test "<任务>"` 真实调用（每次独立进程、独立测试数据目录），失败/环境类任务用预置坏路径；GUI 验收在桌面应用（HMR 重载后）用浏览器 MCP 截图。

## 6. 验收口径（deliverable）

1. `npm test`（现有 231 项 + 新增）全绿；`npm run build` 通过。
2. 上述 A–G 全部有真实运行证据（命令、输出、DB 行、截图）。
3. 统计字段区分 **API 真实值 / 估算值**；`reasoning_tokens` 仅在 API 返回时记录，否则 NULL 并在 UI 标注。
4. 最终报告含：现有能力检查、改动文件、AUTO 机制、测试结果、上下文优化结果、Token 对比（手动 HIGH vs AUTO）、限制与未实现项。
