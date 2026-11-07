# Phase 1 设计：Token 只读监控 + 模型调用效率与任务成本分析

> 依据：`docs/ENVIRONMENT_AUDIT.md`（Phase 0 门禁通过）+ 用户 2026-11-01 补充需求。
> 门禁：**Phase 1 只监控与分析，不修改模型上下文、不压缩工具结果、不限制调用次数、不降推理等级、不换模型**。
> 数据根：`%DSH_HOME%\dsh-token-manager\`（默认 `C:\Users\Administrator\.dsh\dsh-token-manager\`）；SQLite `node:sqlite`。

## 1. 范围

### 1.1 PRD Phase 1 原定
Usage Ledger、逐调用记录、任务快照、费用配置、基础中文仪表盘、CSV 导出。

### 1.2 用户补充需求（本阶段必须交付）
| # | 能力 | 落点 |
|---|---|---|
| E1 | 每项任务实际触发的模型调用次数 | `tasks` + `usage_records` 聚合 |
| E2 | 每次调用的输入/缓存命中/未命中/输出 Token | `usage_records`（四桶） |
| E3 | 重复读取相同文件、重复执行相同工具 | `tool_calls` + `findings.repeated_read / repeated_tool` |
| E4 | 无必要多轮确认、重复计划、重复总结 | `findings.confirmation_rounds / repeated_plan / repeated_summary` |
| E5 | 简单任务是否触发过多模型步骤 | `findings.step_inflation`（对比任务类型基线） |
| E6 | 构建/测试/部署是否重复执行 | `findings.repeated_build / repeated_test / repeated_deploy` |
| E7 | 任务成本分析报告（指出高成本调用） | `/api/task-report` + 成本排行 |
| E8 | 任务类型分类（5 类） | `tasks.task_type`：simple-edit / normal-dev / complex-dev / troubleshoot / project-analysis |
| E9 | 同类型历史基线 + 异常消耗 | `task_baselines` + `findings.task_cost_anomaly` |
| E10 | 仅监控、不限制 | 全局无任何限制/阻断逻辑；设置项只有开关与阈值 |

## 2. 架构

```
dsh-token-manager/                 # 即 bundle 根目录
  package.json  cordis.patch.yml  tsconfig.json  icon.png  locale/{zh,en}.json
  scripts/build.mjs                # esbuild：Host ESM + Client CJS 包壳
  src/
    index.ts                       # 插件入口：装配服务 + 注册事件/HTTP/工具
    shared/  types.ts constants.ts contracts.ts api.ts dsh.d.ts
    storage/ db.ts schema.ts       # node:sqlite + 迁移 + 预处理语句
    host/    usage-ledger.ts task-manager.ts cost-calculator.ts baseline.ts
             analytics.ts report.ts http-api.ts settings-store.ts
             importer.ts           # 历史会话离线导入（projcache + zstd 日志）
    client/  index.tsx overview.tsx calls.tsx tasks.tsx report.tsx settings.tsx
             components.tsx styles.css api-client.ts
  tests/     unit/*.test.mjs integration/*.test.mjs fixtures/
  docs/
```

**运行时零第三方依赖**：只用 `node:*` 内置模块与 `ctx` 提供的服务。构建期 devDependencies：`typescript`、`esbuild`。

**Host 与 Client 的唯一数据通道**：`ctx.webServer.register({kind:'prefix', path:'/token-manager/api'})`，每个请求第一行 `ctx.connection.requestRejection(req)` 围栏。

## 3. 数据模型（SQLite，`PRAGMA user_version=1`）

```sql
meta(key PK, value)
sessions(session_id PK, project_id, cwd, parent_session_id, origin, agent_preset,
         created_at, last_seen_at, is_subagent)
tasks(id PK, session_id, project_id, task_name, task_type, task_type_source, status,
      origin, turn, started_at, ended_at, start_snapshot JSON, end_snapshot JSON,
      summary JSON, interference INT, first_prompt)
usage_records(id PK, session_id, task_id, turn, step, attempt, is_final, provider, model,
      reasoning_effort, input_tokens, cache_read_tokens, cache_write_tokens, output_tokens,
      reasoning_tokens NULL, total_tokens, duration_ms, ts, message_id, source,
      UNIQUE(session_id, turn, step, attempt))
tool_calls(id PK, session_id, task_id, turn, step, call_id, tool_name, args_hash, args_summary,
      target_path, command, result_hash, result_bytes, is_error, ts)
findings(id PK, session_id, task_id, kind, severity, subject, detail JSON, evidence JSON,
      created_at, UNIQUE(session_id, task_id, kind, subject))
task_baselines(task_type, project_id, sample_count, median_calls, p80_calls, median_tokens,
      p80_tokens, median_cost, p80_cost, updated_at, PK(task_type, project_id))
price_configs(id PK, provider, model_name, input_price, cache_read_price, cache_write_price,
      output_price, currency, unit_tokens, effective_at, UNIQUE(provider,model_name,effective_at))
kv(k PK, v)
```

索引：`usage_records(ts)`、`usage_records(session_id,turn,step)`、`usage_records(task_id)`、`tool_calls(task_id,tool_name,args_hash)`、`tool_calls(session_id,turn,step)`、`findings(task_id,kind)`。

**Token 语义（来自 Phase 0 实测，不可改动）**：`input_tokens`=未命中输入；`total_tokens`=四桶之和；去重键 `(session_id,turn,step,attempt)`，`is_final=1` 表示该 step 最终 `assistant/message`。交叉核对断言：`Σ(is_final=1 的四桶) == 官方 tokenUsage.totals`。

## 4. 采集管线

`ctx.on('session/event', (session, event) => ledger.handle(session, event))`，另在 `agent/created/disposed` 维护 live 标记。

| 事件 | 处理 |
|---|---|
| `user/message` 且 `source.kind==='user'` | 新建/切换自动任务（=一个 turn），记录首条 prompt 摘要与开始快照 |
| `request/header` | 记录本会话当前 provider/model/reasoningEffort（按 turn 记忆） |
| `assistant/message` | 写 `usage_records`（`is_final=1`，同键 UPSERT 覆盖）；`assistant/attempt` 若带 usage 记 `attempt=n,is_final=0`；fed to analytics |
| `tool/call` | 写 `tool_calls`（args_hash=SHA-256(规范化 JSON)，抽取 target_path/command） |
| `tool/result` | 回填 `result_hash/result_bytes/is_error`；触发重复检测 |
| `turn/end` | 结束任务、汇总 summary、跑基线比对与异常发现 |
| `llm/retry` / `llm/retry-started` | 标记该 step 发生过重试（不重复计费） |

**降级原则**：所有 handler 包 `try/catch`，异常只记 `kv.last_error` 并继续；任何 DB 写失败不得抛给 Harness。

## 5. 任务模型

- **自动任务 = 一个 turn**（`origin='auto'`）：task_name 取首条真实用户消息前 40 字；`started_at/ended_at` 取 turn 边界；`start_snapshot/end_snapshot` 记录该会话累计四桶（用于 PRD 3.3 增量与并发干扰标记）。
- **手动任务**：API 创建/合并/改名/改类型/标记完成（Phase 4 增强 UI）。
- **并发干扰标记**：任务窗口内若其他会话 session 也有 usage 写入 → `interference=1`，报告注明"统计受并发任务干扰"。
- **分类（启发式，可人工覆盖）**：依据工具画像
  - `simple-edit`：写工具 ≤2 且模型调用 ≤6；
  - `troubleshoot`：读/检索/命令多、写 ≤1、出现错误输出；
  - `project-analysis`：写 0、读取类 ≥5；
  - `complex-dev`：写 ≥5 或多文件；
  - 其余 `normal-dev`。
  每条给出 `task_type_source` 与置信度（存 summary）。

## 6. 效率分析（E3–E6）

全部只读分析，输出 `findings`（含 severity + 证据），**不产生任何干预**。阈值全部可配置（`kv.settings.analytics`）。

| kind | 规则（默认） | 证据字段 |
|---|---|---|
| `repeated_read` | 同一 `target_path` 在同一任务内读取 ≥2 次且 `result_hash` 相同 → warn；hash 不同 → 仅 info，标注"文件已变化" | 次数、turn/step、字节、hash 相同/不同 |
| `repeated_tool` | 同 `(tool_name,args_hash,result_hash)` 在同一任务内 ≥2 次 → warn | 次数、首次/末次时间 |
| `repeated_build` / `repeated_test` / `repeated_deploy` | 命令归一化后同类命令重复 ≥2 次 → warn（构建正则：`npm|pnpm|yarn .*(build\|tsc\|vite build)`、`esbuild`；测试：`npm test`、`vitest`、`jest`、`playwright test`；部署：`deploy`、`pm2`、`ssh`+`script`） | 归一化命令、次数、耗时合计 |
| `confirmation_rounds` | 同一 turn 内"纯文本、无工具调用、≤240 字"的 assistant 消息 ≥2 条 → info（若用 `ask_user_question` 则不报） | 消息 seq、文本摘要 |
| `repeated_plan` | 同一任务内匹配计划类措辞（计划/方案/步骤/plan/PLAN）的 assistant 消息 ≥3 条 → info | 命中文本摘要 |
| `repeated_summary` | 同一任务内匹配总结类措辞（总结/已完成/完成情况/summary）的 assistant 消息 ≥3 条 → info | 同上 |
| `step_inflation` | 模型调用数超过同类型基线 `p80×1.5`，或 `simple-edit` ≥6/`normal-dev` ≥15 次 → warn | 实际值 vs 基线、分类置信度 |
| `cache_hit_drop` | 任务缓存命中率 < 同项目历史中位数×0.5 且调用 ≥3 → info | 命中率对比 |
| `task_cost_anomaly` | 任务总 Token 或费用 > 同类型基线 `p80×1.5` → warn | 分位、基线、差值 |

**证据最小化**：文本只存前 200 字摘要，不存完整 prompt/工具输出；敏感键名（KEY/TOKEN/SECRET/PASSWORD）在摘要前脱敏。

## 7. 费用

- `price_configs`：provider+model 四桶单价、币种、`unit_tokens`（默认 1,000,000）、生效时间；UI 可增删改，支持导入导出 JSON。
- `cost = (input×p_in + cacheRead×p_cr + cacheWrite×p_cw + output×p_out) / unit_tokens`。
- 未配置价格 → `cost=null`，UI 显示"价格未配置"（**不显示 0 或虚构值**）。
- 报告区分"本地估算费用"，并保留 `verified` 概念（Phase 2 起才有实测节省）。

## 8. 基线（E9）

- 样本：已完成、非干扰、`origin='auto'` 的任务，按 `task_type` 汇总（同时也按 `project_id`）。
- 指标：calls、total_tokens、cost 的中位数与 p80；样本 <5 时不给异常结论（显示"样本不足"）。
- 重算时机：任务结束后节流重算（最多 1 次/分钟）或 API 手动触发。

## 9. HTTP API（`/token-manager/api`，全部 POST JSON 除 CSV）

| 路由 | 说明 |
|---|---|
| `POST /overview` | `{range:'today'\|'session'\|'task'\|'project'\|'all', sessionId?, taskId?, projectId?}` → 卡片指标 + 趋势序列 + 模型/项目/任务排行 |
| `POST /calls` | 分页 + 筛选（时间/模型/会话/任务/是否有异常）+ 排序；返回行含四桶、费用、任务名 |
| `POST /tasks` | 任务列表（含调用次数、四桶、费用、类型、状态、异常标记） |
| `POST /task-report` | 单任务成本分析报告：调用清单、Top 成本调用与原因、findings、与基线对比、建议（仅建议） |
| `POST /findings` | 异常/发现列表（可按 kind/task 过滤） |
| `POST /baselines` | 基线表 + 重算触发 |
| `POST /prices` / `POST /prices/update` / `POST /prices/delete` / `POST /prices/import` | 价格表 CRUD |
| `POST /settings` / `POST /settings/update` | 读取/更新设置 |
| `POST /sessions` | 会话列表（含项目、子 Agent、累计用量） |
| `POST /import` | 历史导入（projcache / 日志），带进度返回值（同步小批量） |
| `GET /export/calls.csv` | CSV（BOM + 公式注入转义 + Content-Disposition） |
| `GET /health` | 自检：DB 可写、schema 版本、最近错误、交叉核对结果 |

统一响应 `{ok:true,data}` / `{ok:false,error:{code,message}}`；请求体上限 64KB；所有查询 LIMIT ≤ 500。

## 10. 界面（简体中文，深色优先，紧凑）

左栏 `sidebar.panellist` 入口 + `main` 整页（key=`token-manager`），页内 5 个标签：

1. **总览**：今日/本会话/本任务卡片、缓存命中率、输入/输出、估算费用、调用次数、异常数量、趋势图（7/30 天）、模型占比、项目/任务成本排行、优化状态（Phase 1 = 只读监控）。
2. **调用明细**：表格（时间/模型/任务/四桶/合计/费用/耗时/异常标记），筛选排序，CSV 导出。
3. **任务**：任务列表 + 类型/状态/调用次数/Token/费用/异常；点击展开任务详情与基线对比。
4. **成本分析**：任务成本报告（Top 成本调用、原因、findings、基线分位、建议）。
5. **设置**：开关（观察模式、各分析项独立开关）、阈值、价格表、任务类型映射、数据导出/导入、恢复默认。

UI 规则：说明类文案一律收进 `?` 帮助图标；只用 `var(--dsw-alias-*)` 主题 token；深色为默认；1600/897/390 三档响应式；页脚 `Powered by 智睿`。

## 11. 验收标准（Phase 1 门禁）

1. `npm run build` 成功，`node --check` 通过（Host/Client 产物）。
2. 单元测试覆盖：去重 UPSERT、四桶求和与费用、重复读取/工具/构建检测、步骤膨胀、基线分位、CSV 转义。
3. 集成测试：用本机真实历史数据回放，**逐会话断言 `Σ usage == 官方 tokenUsage.totals`**（误差 0）。
4. 隔离 profile 安装并启动，真实会话产生数据后仪表盘显示正确；三个宽度截图验证。
5. 全部分析项可单独关闭；关闭后不再产生 findings。
6. 关闭插件后无残留监听/路由（`/api/health` 404），数据目录保留。
7. 不修改 Harness 核心、dsh-mnemon、生产 profile；插件异常不阻断任务。

## 12. 分工（不重叠写域）

| 角色 | 写域 |
|---|---|
| Lead | `package.json` `tsconfig.json` `scripts/build.mjs` `cordis.patch.yml` `locale/**` `icon.png` `src/index.ts` `src/shared/**` `src/storage/**` `tests/**` `docs/**` `scripts/verify-*.mjs` |
| host-core | `src/host/usage-ledger.ts` `task-manager.ts` `cost-calculator.ts` `baseline.ts` `settings-store.ts` |
| analytics-api | `src/host/analytics.ts` `report.ts` `http-api.ts` `importer.ts` |
| client-ui | `src/client/**`（index.tsx 及页面/组件/样式/API 客户端） |
