# 版本记录（CHANGELOG）

本项目遵循“阶段交付 + 版本号”记录方式。首版 `1.0.0` 汇总 Phase 1–6 的交付内容。

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
