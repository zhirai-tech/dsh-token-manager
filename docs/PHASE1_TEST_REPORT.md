# Phase 1 测试报告 · Token 只读监控 + 模型调用效率与任务成本分析

> 版本：1.0.0（Phase 1）｜日期：2026-11-01｜环境：DSH 0.2.1-rc.5 / Electron 44.7 / Node 24.21（宿主）
> 测试环境：隔离 profile `tm-sandbox`（`C:\Users\Administrator\.dsh\profiles\tm-sandbox`），生产 `desktop` profile 零改动。

## 1. 交付范围

| 模块 | 文件 |
|---|---|
| 插件入口 | `src/index.ts`（服务装配、事件订阅、HTTP 注册、异常隔离、卸载清理） |
| 存储 | `src/storage/{db.ts,schema.ts}`（node:sqlite + WAL + 迁移） |
| 采集台账 | `src/host/usage-ledger.ts` |
| 任务管理 | `src/host/task-manager.ts`（自动任务=turn、五类分类、快照、聚合） |
| 费用 | `src/host/cost-calculator.ts`、`src/host/settings-store.ts` |
| 基线 | `src/host/baseline.ts`（median/p80、节流、分位） |
| 分析 | `src/host/analytics.ts`（11 类发现） |
| 报告 | `src/host/report.ts`（overview/calls/taskReport/sessions/CSV/health） |
| API | `src/host/http-api.ts`（前缀路由 + 围栏 + 校验 + 错误码） |
| 历史导入 | `src/host/importer.ts`（projcache 只读导入 + 交叉核对） |
| 客户端 | `src/client/**`（5 标签整页、纯 SVG 图表、locale zh/en 239 键） |
| 构建 | `scripts/build.mjs`、`scripts/build-tests.mjs`、`tests/harness.ts` |
| 安装 | `scripts/install-sandbox.ps1` |
| 文档 | `README.md`、`docs/PHASE1_DESIGN.md`、`docs/ENVIRONMENT_AUDIT.md`、本报告 |

## 2. 构建与静态检查

| 检查 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npx tsc --noEmit` | **exit 0**（全项目 TS/TSX） |
| 构建 | `npm run build` | **Host `lib/index.js` 149.7KB + Client `lib/client.js` 136.8KB，`node --check` 双通过** |
| 客户端产物格式 | `Get-Content lib\client.js -TotalCount 1` | `window.__ModuleLoader__.load({ id: "dsh-token-manager", factory: (require) => {` |
| 运行时依赖 | `dependencies` | **空**（仅 devDependencies：typescript/esbuild/@types） |

## 3. 单元测试

```
npm test   →  build:test 后 node --test "tests/unit/*.test.mjs"
结果：69 passed / 0 failed（host-core 35 + analytics-api 34）
```

覆盖点：
- 设置深合并/恢复默认；价格四桶/未配置返回 null/单位换算；任务分类与聚合；基线 median/p80/样本不足；台账 UPSERT 去重、attempt、source.kind 红线、tool 关联、异常不外抛。
- 分析：重复读取（同哈希 warn / 不同哈希 info）、重复工具、重复构建/测试/部署、确认轮、重复计划/总结、步骤膨胀、缓存命中下降、成本异常；每项开关关闭后不产 findings。
- 报告：overview 五种范围（含 all 纳入导入行、calls 仅 live）、calls 分页筛选排序、taskReport 的 top 原因、CSV BOM 与公式注入防护、health。
- API：路由/方法/请求体上限（413）/统一 envelope/异常 500 不泄露堆栈/围栏拒绝。
- 导入：219 会话导入、导入行不污染逐调用、crossCheckSession。

## 4. 真实数据交叉核对（Phase 1 核心验收）

```
TM_CROSSCHECK_SESSIONS=50 node --test "tests/integration/*.test.mjs"
→ cross-check: sessions=49 officialFresh=48 staleProjections=1 logFailures=0 officialFailures=0
```

方法：逐帧解压真实 `session.v4.jsonl.zstd`，把 `assistant/message` 事件回放给台账，然后
1. 与**耐久日志自身**求和对比（ground truth）→ 49/49 完全一致；
2. 与官方 `tokenUsage` 投影对比 → 48/48 完全一致；1 个会话因投影快照落后日志尾部（lag 3–5 个事件）被单独标记为 stale，不计入失败。

结论：`inputTokens`=未命中、`total=四桶之和`、`(session,turn,step)` 去重口径与官方完全一致。

## 5. 真实页面验收（隔离 profile，真实模型调用）

### 5.1 真实数据
- 在沙箱页面发起 1 个真实任务（读两个文档），产生 **6 次模型调用 / 8 次工具调用**，任务自动识别为 1 个 `auto` 任务并完成。
- 台账：`Σ = 87,438 tokens`（未命中 6,684 / 缓存命中 80,256 / 缓存写入 0 / 输出 498），缓存命中率 **92.3%**，与官方投影一致。
- 价格表：新增测试价格后 `估算费用 = 0.0157`（与四桶手算一致），删除价格后恢复「价格未配置」；测试数据已清理。

### 5.2 历史导入
- `导入历史投影缓存` → **219 会话 / 219 次汇总行，86ms**。
- `全部` 范围：**16,879,223,768 tokens**、`importedSessions=219`、缓存命中率 **99.5%**、趋势 21 个日期桶；`calls` 仍为 6（导入行不污染逐调用）。

### 5.3 界面（截图见 `.verify/real-user/`）

| 文件 | 内容 |
|---|---|
| `08-overview-all-1600.png` | 总览（全部范围）：4 张卡片 + 第二行 6 项指标 + 趋势/每日调用/模型占比/项目排行/任务排行 |
| `09-overview-all-897.png` | 897 宽：侧栏收起为图标、卡片换行、图表纵排 |
| `10-overview-all-390.png` | 390 宽：单列卡片、标签页保持一行 |
| `03-calls-1709.png` | 调用明细：四桶、费用、耗时、标记、筛选、分页、CSV |
| `04-tasks-1709.png` | 任务列表：类型/状态/调用次数/四桶/费用/异常 |
| `05-task-report-1709.png` | 任务成本报告：指标、基线对比（样本不足）、Top 成本调用与原因、建议 |
| `06/07-settings-*.png` | 设置：开关、阈值、价格表增删、导入/导出 |
| `01/02-*.png` | 首版页面（修复前，留档对比） |

验收结论：注册成功（左栏「Token 监控」+ 整页）、5 标签可用、深色主题 token 生效、说明文案收进 `?` 图标、页脚 `Powered by 智睿`、无第三方 UI/图表依赖。

### 5.4 卸载与数据保留

```powershell
dsh plugin --profile tm-sandbox remove dsh-token-manager   # 从 bundles 移除
# 重启后
左栏无「Token 监控」；GET /token-manager/api/health → 404（路由已移除）
C:\Users\Administrator\.dsh\dsh-token-manager\token-manager.db 仍存在（数据保留）
```
随后重新安装并恢复运行。

## 6. 安全与边界检查

| 项 | 结果 |
|---|---|
| 生产 `desktop` profile | 未做任何写操作（仅读取其插件清单与审计文件） |
| Harness 核心 / dsh-mnemon | 未修改 |
| 模型 / 推理等级 | 未更换、未降级 |
| 自动限制 / 上下文改写 | **不存在**（Phase 1 无任何阻断或改写代码路径） |
| 密钥/凭据 | 不记录；发现项文本截断 200 字 + 敏感键脱敏 |
| 上传 | 无外部网络请求（仅本地 HTTP API 供同源页面读取） |
| 越权访问 | API 每请求 `ctx.connection.requestRejection(req)` 围栏；未通过 → 403 |
| 卸载残留 | 监听器/路由/UI 随 fiber 卸载清理（已实测） |

## 7. 已知限制（Phase 1，将在后续阶段处理）

1. **导入数据是会话级汇总**：历史 219 会话只能进入「全部」范围的 Token/费用/项目排行，不生成历史任务，因此任务类型基线目前只来自 live 任务（样本不足时显示"样本不足"）。
2. **模型占比 / 每日调用 / 任务排行** 目前只统计 live 调用（与导入行的"无逐调用"特性一致）；`全部` 范围的 Token 总量与项目排行已含导入。
3. **任务分类是启发式**（可人工覆盖）；单任务样本极少时分类可能不合理（如本次"读书两文件"被判为故障排查，因出现一次工具错误输出）。
4. **单日单点趋势** 已修复为圆点，但多日区间标签在 390 宽度下字号偏小。
5. `node:sqlite` 在宿主 stderr 有 ExperimentalWarning（Node 24 现状，不影响功能）。
6. 历史导入行使用 `identity.createdAt` 作为时间；fork/种子的会话不导入（避免与继承前缀重复计算）。

## 8. Phase 1 门禁结论

| 验收项（设计 §11） | 结果 |
|---|---|
| 1 构建成功 + `node --check` | ✅ |
| 2 单元测试覆盖去重/四桶费用/重复检测/步骤膨胀/基线/CSV | ✅ 69/69 |
| 3 真实历史回放与官方投影逐会话一致 | ✅ 48/48（1 个 stale 单独标记） |
| 4 隔离 profile 真实页面 + 三档宽度 | ✅ |
| 5 分析项可单独关闭 | ✅（单测 + 设置页） |
| 6 卸载无残留、数据保留 | ✅ |
| 7 不改核心/mnemon/生产 profile、异常不阻断 | ✅ |

**Phase 1 通过。** 未发现需要阻塞进入 Phase 2 的问题；上述限制已登记。
