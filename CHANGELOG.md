# 版本记录（CHANGELOG）

本项目遵循“阶段交付 + 版本号”记录方式。首版 `1.0.0` 汇总 Phase 1–6 的交付内容。

## 1.4.0 — 2026-11-07

### Added — AUTO 自动推理调度（真实接入模型请求链路）
- composer 模型/推理档位选择区域新增 **AUTO** 控件（AUTO / OFF / LOW / HIGH / MAX + 最近决策原因），与官方模型选择器同排；手动档位完整保留，手动选择即退出 AUTO。
- Host 侧真实链路：`agent/inbox/inserted` 同步分类并 `agent.model.select()`（**同一任务第一步即生效**）；`agent/pre-step` 按证据升级（下一步生效）；`agent/request` 已弃用且会拒绝改档位，故完全不依赖它。
- 自动升级规则：`OFF → LOW → HIGH → MAX` 逐级、单任务最多 3 次；只有推理性证据（写文件数/推理性失败/多方案未果/步骤兜底）才升级；**环境类失败（文件/路径/权限/依赖/网络/命令/测试环境/外部 API）绝不升级**；新任务重新判断、不继承上一任务档位；`monitorOnly` 只记录不生效；子 Agent 可纳入或排除。
- 决策留痕：`auto_decisions` / `auto_sessions` 两表 + HTTP `/token-manager/api/auto/{status,enable,manual,classify,decisions,summary}`；「成本分析」页新增 AUTO vs 手动对比、档位分布与最近决策；设置页新增 AUTO 区块（开关/初始档位/升级阈值/观察模式/子 Agent）。

### Added — Token 统计真实性
- `usage_records` 新增 5 列（幂等迁移，旧库与新库都走 PRAGMA/ALTER）：`usage_basis`（api/estimated/missing）、`effort_source`（explicit/adapter-default/auto）、`reasoning_source`（api/estimated/NULL）、`reasoning_estimated`、`usage_partial`。
- 推理 Token 优先级：API `reasoningTokens` → 真实值；**本构建的 DeepSeek 适配器不返回任何 reasoning token 字段，实测恒为 NULL，不伪造 0**；否则按 reasoning 内容块/流文本量估算并标 `estimated`（报表显式展示 note）。
- 费用：`costOfDetailed` 四桶 + 缓存 + 可选独立推理计价；估算推理不计费；缺失 usage 的行费用恒为 null。
- 维度报表：`dimensions()` 输出按 Agent（主/子）、按档位、AUTO vs 手动、按 usage 来源、按任务，附 `estimates` 说明。

### Added — 上下文与 Agent 开销优化
- 上下文复用 `context-reuse`：同一会话内完全相同（tool+args+result 哈希一致）且 ≥512B 的工具结果，第二次起替换为含 `Blob ID` 的极小引用，可 `token_manager_read` 恢复；默认 `observe`，`on` 模式真实任务验证模型可正确理解引用。
- 子 Agent 审计 `subagent-audit`：记录 spawn（fresh，不继承父历史）/ fork（继承历史快照）、委派 prompt 字节与估算 token、子会话 input/output/cache token，产出 `subagent_fork_history` / `subagent_prompt_oversize` 发现项。
- 模型工具 `token_manager_context`：按需生成分层最小上下文包（项目摘要 8 段 + 任务摘要 9 段/最近决策 + 最近变更文件），受字符预算约束并显式标注省略，用于委派子 Agent 或长会话续接时替代粘贴完整历史。

### Changed
- 测试基础设施：`scripts/build-tests.mjs` 自动汇总 host/shared/storage 模块，新模块无需手动登记 harness。

### Tests
- 单元测试 231 → **339 项全部通过**；真实 DeepSeek 调用验收（A–G）见 `docs/AUTO-TEST-REPORT.md`，成本对比见 `docs/AUTO-COST-COMPARE.md`。

### 已知限制（如实记录）
- DeepSeek Messages 适配器（本构建）不提供 reasoning token 字段 → `reasoning_tokens` 恒为 NULL，只能估算并标注；`output_tokens` 是否包含推理由上游决定，插件不推断。
- AUTO 改档位只能从「下一步」生效（`agent/pre-step` 窗口）；任务第一步只能在 prompt 进入 inbox 的同步窗口改，已验证可行但依赖该事件顺序（已在真实调用中复核）。
- fork 子 Agent 的历史快照由 Harness 管理，插件只能审计/提示，不能删除其继承历史；独立子任务建议用 spawn + `token_manager_context`。
- 上下文复用在 `on` 模式会改变模型可见内容（引用化），默认保持 `observe` 以最保守姿态交付。

## 1.2.0 — 2026-11-01

### Added — compression 2.0 (accuracy-first)
- Shell-output aware summarizer: file lists / JSON / JSONL / Markdown / git diff/log / build / test output / generic logs.
- Every error/warning line is preserved **with its original line number, in every output kind**; summaries that are not clearly smaller are skipped.
- Accuracy guards: `read` results are never compressed, error results are never compressed; history is never rewritten (no prefix rewriting, no stale-message replacement).
- Offline audit on a real 493k-token session: 12 compressible shell outputs 521,347 B → 169,738 B (**67.4% saved**), error lines preserved **20/20**.
- Real A/B accuracy check: compressed vs observe answered identical and correct facts (line count, exact L777 error text, ERROR/WARNING counts).
- 11 new tests (231 total). Docs: `docs/COMPRESSION2.md`.

## 1.1.0 — 2026-11-01

### Added
- **Live top strip** (`shell.overlay` slot): always-visible floating bar with today's tokens, current session tokens, estimated tokens saved by compression, and estimated saved cost; refreshes every 5 s, click opens the panel.
- **Automatic reference pricing**: when no price row exists, the overlay loads a public-list reference price for the active model (DeepSeek list price, CNY per 1M tokens) so cost is shown immediately; the note states it is a reference, not a live bill, and it stays editable in Settings.
- `POST /token-manager/api/live`, `POST /token-manager/api/prices/reference`, `POST /token-manager/api/prices/apply-reference`; 4 new unit tests (220 total).
- Live overlay screenshot in `docs/screenshots/12-live-overlay.png`.

### Notes
- "Saved tokens" is an estimate derived from compressed blob bytes (4 bytes ≈ 1 token) and is labelled as such.
- No account-billing API is exposed to plugins, so reference prices come from DeepSeek's public price list; operators can overwrite them with their own bill prices.

## 1.0.0 — 2026-11-01（首个稳定版）

### Phase 1 · Token 只读监控 MVP
- 逐调用台账：provider/model/轮次/步骤/未命中输入/缓存命中/缓存写入/输出/合计/耗时；`(session,turn,step,attempt)` 去重，重试不重复计费。
- 任务快照与费用估算：价格表（四桶/币种/单位/生效时间），未配置价格时显示“价格未配置”。
- 中文仪表盘：今日/本会话/本任务/历史累计、缓存命中率、趋势、模型/项目/任务排行。
- CSV 导出（UTF-8 BOM + 公式注入防护）。
- 历史导入：只读解析 DSH 投影缓存（219 会话实测 0.1s），导入行不污染逐调用统计。
- 模型调用效率分析：重复读文件/重复工具/重复构建测试部署/多余确认/重复计划总结/步骤膨胀/缓存命中下降/任务成本异常（11 类发现，均可单独开关）。
- 5 类任务分类（启发式，可人工覆盖）+ 同类型历史基线（median/p80）。
- 交叉核对：逐调用汇总与官方 `tokenUsage` 投影逐字段一致（真实 49 会话验证 0 误差）。

### Phase 2 · 工具输出缓存
- 内容寻址 blob 存储（SHA-256、原子写、回读校验、去重引用、TTL/LRU 清理、一致性检查）。
- `tools/post-execute` 可逆替换：构建日志/测试输出/JSON/XML/文件列表/ZIP/文本七类摘要；默认观察模式，需手动启用自动压缩。
- `token_manager_read` 原文恢复工具（blobId 分页 / 会话内文件路径）。
- 失败回退：任何存储或摘要异常保留原始工具结果，不阻断任务。
- 工具缓存管理页 + 缓存设置区块。

### Phase 3 · 上下文去重与 KV Cache 风险（只检测）
- 上下文组成分析（按 role / source），mnemon 等来源标记为受保护。
- 重复工具内容检测与可移除量计算。
- KV Cache 风险估算（有价用成本模型，无价用 Token 代理）。
- dry-run 建议记录（`optimization_records`），不修改任何会话（日志字节级不变）。

### Phase 4 · 任务与项目管理
- 手动任务、改名、改类型/状态、多任务合并（用量数据级汇总）。
- 任务 9 段摘要（本地自动草稿 + 人工编辑）、项目 8 段摘要（版本化）。
- 任务报告 JSON/Markdown/CSV、项目摘要 JSON/Markdown 导出。
- 全程不调用模型。

### Phase 5 · UI 完善与 dsh-mnemon 兼容
- 窄屏标签横向滚动、页面级溢出收敛、帮助气泡移动端适配。
- 与 dsh-mnemon 共存验证：记忆消息受保护且哈希不变、压缩与恢复链路正常、统计口径一致、会话恢复、卸载/重装无残留。

### Phase 6 · 稳定版交付
- 发布包（zip）+ SHA-256 校验文件。
- 中文文档：README / 安装指南 / 配置指南 / 故障排查 / 版本记录 / 各阶段测试报告 / 交付说明。
- 216 项单元测试、真实历史交叉核对、真实页面验收（1600/897/390）。

### 修复记录
- 合并任务后用量未汇总（Phase 4 修复）。
- 项目摘要抽屉内联说明改为帮助图标（Phase 4/5 修复）。
- 任务表窄屏列裁切、390 标签折行（Phase 4/5 修复）。
- 上下文分析缺省会选中空 surface 会话（Phase 5 修复）。
- 多版本 schema 迁移统一为逐级幂等（v0→v4）。

### 已知限制
- 上下文分析仅支持 live 会话。
- 项目摘要的数据库结构/关键接口/用户限制需人工填写。
- 观察模式仍会保存 blob（受容量与保留天数限制）。
- mnemon 的 `mnemon_*` 工具结果不参与压缩。
- 生产 profile 安装需用户授权后执行。
