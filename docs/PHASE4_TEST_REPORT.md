# Phase 4 测试报告 · 任务与项目管理增强

> 版本：1.0.0（Phase 4）｜日期：2026-11-01｜环境：DSH 0.2.1-rc.5 / Electron 44.7 / Node 24.21
> 测试环境：隔离 profile `tm-sandbox`；生产 `desktop` profile 零改动。

## 1. 交付范围

| 模块 | 文件 |
|---|---|
| schema v4 + 迁移 | `src/storage/{schema.ts,db.ts}`（`project_summaries` 表；`tasks.merged_into` / `tasks.updated_at`；v0–v3→v4 幂等） |
| 项目摘要仓库 | `src/storage/project-repository.ts`（get/upsert 版本自增/list） |
| 任务合并 | `src/host/task-manager.ts`（`mergeTasks`、`includeMerged`、`updated_at`） |
| 任务服务 | `src/host/task-service.ts`（创建/更新/合并/详情/摘要/三种导出） |
| 项目服务 | `src/host/project-service.ts`（列表/摘要草稿/保存/两种导出） |
| API | `src/host/http-api.ts`（10 条新路由） |
| 客户端 | `src/client/{tasks.tsx,task-detail.tsx,projects.tsx,api-client.ts,components.tsx,format.ts,styles.css}` + locale 492 键 |
| 设计 | `docs/PHASE4_DESIGN.md` |

## 2. 构建与测试

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| `npm run build` | Host + Client 均 built，`node --check` 通过 |
| `npm test` | **213/213 通过**（Phase 1–3 回归 177 + Phase 4 新增 36） |
| 集成交叉核对 | 30 会话 0 失败 |
| 单文件行数 | task-service 675 / project-service 382 / http-api 671 / task-manager 675（≤700） |

测试覆盖：v0/v3→v4 迁移与幂等、project repository CRUD/版本自增/list 排序、mergeTasks（同 session/最早目标/merged_into/默认隐藏与 total 一致）、任务 create/update 校验、merge 用量数据级合并（Σcalls == 目标 calls，usage/tool_calls 重归属）、detail 聚合、摘要草稿字段、updateSummary 局部合并、三种导出（BOM/公式防护）、项目列表聚合、摘要草稿/保存版本自增/导出。

## 3. 真实沙箱验收

### 3.1 任务管理

- **新建手动任务**：`POST /tasks/create` → `manual:fc51fe47-…`，类型 `normal-dev`，状态可改。
- **改名 / 状态 / 类型**：`{id, name}` 与 `{id, status}` 生效（`name` 字段为改名入口）；`taskName` 旧字段名被忽略（已记录）。
- **合并**：
  - 第一次合并 task11+task12（修复前）→ 目标只有 3 次调用（发现缺口）。
  - 修复后再次合并 task9+task10：合并前各 2 次调用 → 合并后目标 **4 次调用 / 222,628 tokens**，`Σcalls` 断言一致；`merged_into` 落库、列表默认隐藏被合并项（10 行）。
- **任务详情**：指标卡（4 次/222.6K/价格未配置/3.7s + 四桶）、9 段摘要、修改文件/命令聚合、findings、前 50 条调用明细。
- **摘要自动草稿（本地，无模型调用）**：objective 取首条 prompt，tokenStats 由四桶合成；files/tests 在无写工具/测试命令时为空——符合预期。
- **摘要编辑保存**：改「本次目标」→ 保存 → `summaryEdited=true`，重新读取值正确。
- **导出**：Markdown（含标题/指标表/明细）、CSV（BOM 65279 + 表头）、JSON（4,079 字节）均成功，filename/contentType 正确。

### 3.2 项目管理

- **项目列表**：15 个项目（来自 219 个导入会话 + live 会话），`E:\ZHIRAI Harness`：11 会话 / 10 任务 / 30 调用 / 1.19M tokens / 摘要「已保存」；其余项目显示「无摘要」。
- **摘要草稿**：8 个 section 完整返回；overview（路径/会话/任务/累计 tokens）与 status（最近活动 + 最近 3 个任务）由本地数据生成；database/apis 等留空待填。
- **保存版本**：两次保存 → v1 → v2；未知 section 被忽略；再次读取 `record.version=2`。
- **导出**：Markdown 含版本/更新时间/8 段（空段显示「（空）」）；JSON 271 字节。

### 3.3 无模型调用证明

任务/项目操作前后 `usage_records` 行数 **249 → 249**；全部摘要为本地推导（代码中无 LLM/agent 调用；测试断言行数不变）。

### 3.4 界面（截图 `.verify/real-user/19–26`）

| 文件 | 内容 |
|---|---|
| `23-tasks-final-1600.png` | 任务子视图：子视图切换、筛选、新建/合并/导出、类型与状态下拉、开始时间短格式（不再横向裁切） |
| `20-task-detail-1600.png` | 任务详情抽屉：指标卡 + 9 段摘要 + 文件/命令聚合 + findings + 调用明细 + 三种导出 |
| `21-projects-1600.png` | 项目列表：15 行、项目路径/会话/任务/调用/tokens/费用/最近活动/摘要状态 |
| `26-project-summary-final-1600.png` | 项目摘要抽屉：8 段编辑器、`已保存 v2`、`?` 帮助（原内联提示已移入）、JSON/Markdown 导出 |
| `24-tasks-897.png` / `25-tasks-390.png` | 897 / 390：页面无横向溢出，表格在自身容器内滚动 |
| `19-tasks-before-fix-1600.png` / `22-project-summary-before-fix-1600.png` | 修复前留档（列被裁切 / 内联说明） |

## 4. 修复记录

| 问题 | 修复 |
|---|---|
| 合并任务后目标任务的用量没有汇总 | `TaskService.merge` 成功后把 `usage_records`/`tool_calls` 的 `task_id` 重归属目标、`findings` UPDATE OR IGNORE、刷新 tokenStats 并重算 findings；三处测试断言 |
| 项目摘要抽屉存在内联说明文案 | 移入标题旁 `?`（ui-help-icons 规则） |
| 任务表 1600/897 宽下最后一列被裁切 | 列宽收敛 + 截断 + title 全文 + 开始时间短格式 + 页面级 overflow hidden |

## 5. 已知限制

1. 改名入口只接受 `name`（`taskName` 会被忽略）；前端已按 `name` 发送。
2. 合并会改写历史 `usage_records.task_id`（归因字段，不影响逐调用 Token 总和）；`merged_into` 保留可追溯关系。
3. 项目摘要的 database/apis/constraints 无法本地推断，需人工填写。
4. 390 宽度下 8 个顶部标签仍会折行（Phase 3 已登记，属于全局导航问题）。
5. 任务/项目导出通过 API 文本返回（前端 Blob 下载），未使用浏览器原生下载校验。

## 6. Phase 4 门禁结论

| 验收项（设计 §7） | 结果 |
|---|---|
| 1 单元测试（迁移/合并/摘要/导出/项目） | ✅ 213/213 |
| 2 真实沙箱：新建/改名/状态/合并/详情/摘要/项目/导出 | ✅ |
| 3 无模型调用（usage 行数不变） | ✅ |
| 4 UI 三档宽度、空态、`?` 图标 | ✅（390 标签折行已登记） |

**Phase 4 通过。** 下一步 Phase 5：UI 完善与 dsh-mnemon 兼容测试（真实会话中同时启用 mnemon，验证记忆消息不被误压缩/误删、Token 统计不重复、插件卸载与重载、会话恢复）。
