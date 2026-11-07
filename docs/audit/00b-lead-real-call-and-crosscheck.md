# Phase 0 补充实测 · 真实调用与官方口径交叉核对（2026-11-01）

> 本文件是 `00-lead-environment-findings.md` 的补充与更正，二者以本文件为准（凡冲突处）。

## A. 更正：隔离 profile 可以完成真实 DeepSeek 调用

先前记录“沙箱鉴权失败（403）”，**结论撤回**。首启阶段 `deepseek-account` 的 `/auth-api/v0/users/current` 403 是瞬时/预热失败；随后同一沙箱 profile 的真实模型调用成功：

```
probe 记录（E:\ZHIRAI Harness\dsh-token-manager\probe\loaded.log）：
{"type":"agent/pre-step","seq":1,"turn":2,"step":1,"messageCount":1,"roles":{"user":1},
 "measurement":{"totalTokens":12095,"surfaceTokens":4890,"baselineKind":"estimated"}}
{"type":"request/header","reason":"resume","provider":"deepseek-account","model":"deepseek-flash"}
{"type":"assistant/message","turn":2,"step":1,
 "usage":{"inputTokens":13611,"outputTokens":2,"cacheReadTokens":512,"cacheWriteTokens":0,"totalTokens":14125},
 "provider":"deepseek-account","model":"deepseek-flash"}
```

要点：
1. 沙箱 profile（`tm-sandbox`）可直接用用户已登录的 `deepseek-account` 凭据（`DSH_HOME\.credentials.yaml` 跨 profile 共享）。
2. provider 名称会随组装方式变化：生产为 `deepseek-official`、沙箱为 `deepseek-account`；**价格表与 UI 必须按实际 `source.provider/model` 记录，不得硬编码**。
3. 因此 Phase 1 验收可以全程在隔离环境完成（既可用实时真实调用，也可回放 217 个历史会话），无需触碰生产 profile。

## B. 交叉核对已闭环（Phase 1 验收方法提前成立）

同一次调用后，官方投影缓存出现同名会话行：
`C:\Users\Administrator\.dsh\storages\session_projcache\sessions\session-3f64ae4d-939c-43bb-9a39-38f347ea8cba.json`

```json
"tokenUsage": { "totals": { "uncachedInputTokens": 13611, "outputTokens": 2, "cacheReadTokens": 512, "cacheWriteTokens": 0 },
                "last": { "turn": 2, "step": 1, "buckets": { "uncachedInputTokens": 13611, "outputTokens": 2, "cacheReadTokens": 512, "cacheWriteTokens": 0 } } }
```

与探针捕获的 `assistant/message.usage` **逐字段完全一致**（13611 / 2 / 512 / 0），且 `13611 + 512 + 2 = 14125 = totalTokens`。

→ 结论：
- `usage.inputTokens` = **未命中输入**，与官方 `uncachedInputTokens` 一一对应；
- 自建逐调用明细按 `(sessionId, turn, step)` 去重后求和，**必须等于**官方 `tokenUsage.totals`（同一会话）；
- 这就是 Phase 1 的验收断言，可直接写成自动化测试。

补充（usage-auditor 实测，50,886 条真实样本）：
- `totalTokens` 100% 存在且 = 四桶之和；
- `reasoningTokens` 0 条 → 接口未提供（若出现则是 output 子集，禁止重复相加）；
- 本机历史合计：uncachedInput 77,845,652 / output 38,006,128 / cacheRead 15,722,463,360 / cacheWrite 0 → **cacheRead 占计费 token 99.27%**，成本优化必须以缓存为中心（PRD 第九部分判断正确）；
- 官方无任何 token 单价数据（仅账户余额），费用只能由插件价格表估算并标注“估算”。

## C. 关键设计约束（由实测反推，写入 Phase 1~3 设计）

1. `agent/pre-step` 的 `payload.messages` 实测只有 1 条（当次进入 step 的 user 消息），**不是完整历史上下文** → 若要处理“历史上下文中的重复工具输出”，必须在 `decision.messages` 语义 + `session.surface` 上做（待 01 审计定论），不能假设 pre-step 直接给出全量消息。
2. Mnemon 注入消息只能按 `message.source.kind === "dsh-mnemon"` 识别（`04` 已给出源码行号）；真实用户消息是 `source.kind === "user"`。
3. 事件监听顺序**不能**依赖 bundle 顺序（`dsh-base patch` 原文：row order carries no load semantics）；用 `session/event`（post-commit）或 `system-prompt/assemble`（先 `await next()` 再观测）才结构正确。
4. 数据根目录：`C:\Users\Administrator\.dsh\dsh-token-manager\`（与 `dsh-pet`/`llm-deepseek` 先例一致），SQLite 用宿主内置 `node:sqlite`（Electron 44.7 / Node 24.21 / SQLite 3.53.4，含 `backup`），WAL 在 exFAT 也可用但数据仍应放 C:。
