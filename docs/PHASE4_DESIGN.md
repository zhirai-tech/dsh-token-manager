# Phase 4 设计：任务与项目管理增强

> 依据：PRD 第六部分（6.1–6.4）、Phase 1 已实现「自动任务 = 一个 turn」。
> 硬约束：**任务/项目摘要只用本地已有数据生成，不新增任何模型调用**（PRD 6.4）；项目摘要只存本插件目录，不自动写入 dsh-mnemon。

## 1. 目标

- 长会话拆分：自动任务（每个用户 turn）之外，支持**手动任务**、**合并多个 turn 为一个任务**、改名/改类型/改状态。
- 任务摘要：只保存 9 个字段（PRD 6.3）：本次目标、实际完成内容、关键技术决策、修改文件、接口变化、测试结果、未完成事项、下一步计划、Token 使用统计。
- 项目摘要：8 个 section（PRD 6.4）：项目基本情况、技术架构、数据库结构、关键接口、已完成模块、当前开发状态、未完成事项、用户明确限制；版本化保存、可导出。
- 导出：任务报告（JSON / Markdown / CSV）、项目摘要（JSON / Markdown）。

## 2. 数据模型（schema v4）

```sql
project_summaries(
  id INTEGER PK AUTOINCREMENT,
  project_id TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  summary TEXT NOT NULL,          -- JSON：8 个 section
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
ALTER TABLE tasks ADD COLUMN merged_into TEXT;   -- 被合并到哪个任务
ALTER TABLE tasks ADD COLUMN updated_at INTEGER;
```
- `summary` 存 JSON；未知 key 忽略；`version` 每次保存 +1。
- `tasks.summary` 继续存任务摘要 JSON（9 字段）。

## 3. 任务服务

| 能力 | 说明 |
|---|---|
| create | 手动任务：名称（脱敏/截断 80 字）、类型、所属会话（缺省最近 live 会话）、project 由会话 cwd 推导 |
| update | name / taskType / status（校验枚举）/ summary 局部更新；写 updated_at |
| merge | ids ≥2 且同 session；目标 = 最早 started_at；其余置 merged_into；列表默认隐藏已合并项 |
| detail | 任务 + 指标（calls/四桶/cost/duration/toolCalls）+ 最近 200 条调用 + 写入文件/命令聚合 + findings + 结构化摘要 |
| summary 自动草稿 | **纯本地**：objective=首条用户 prompt；files=写工具 target_path 去重；tests=测试类命令与 findings；tokenStats=四桶+cost；decisions/apiChanges/pending/nextSteps 留空待人填；用户已编辑字段优先保留（summaryEdited 标记） |
| updateSummary | 合并用户编辑字段，不覆盖未提供项 |
| exportTask | json / markdown / csv（CSV 带 BOM + 公式注入防护） |

## 4. 项目服务

- `list`：按 `sessions.project_id` 聚合会话/任务/调用/四桶/费用/最近活动 + 是否有摘要。
- `summary`：无保存记录时生成**本地事实草稿**：
  - overview：cwd、会话数、任务数、总 tokens；
  - architecture：按被修改文件扩展名 top5（推断，标注为草稿）；
  - database / apis / constraints：无法本地推断 → 空，需人工填写；
  - completed：最近 10 个已完成任务名；
  - status：最近活动时间 + 最近 3 个任务；
  - pending：未完成任务数 + 未处理 findings 数。
- `update`：合并 8 段（未知 key 忽略），version+1。
- `exportSummary`：json / markdown（含版本与更新时间）。
- 所有操作不写 mnemon、不发模型调用。

## 5. API

| 路由 | 说明 |
|---|---|
| `POST /tasks/create` | 手动任务 |
| `POST /tasks/update` | 改名/类型/状态/摘要 |
| `POST /tasks/merge` | 合并任务 |
| `POST /tasks/detail` | 任务详情 |
| `POST /tasks/summary/update` | 保存 9 字段摘要 |
| `POST /tasks/export` | json / markdown / csv 文本 |
| `POST /projects/list` | 项目列表 |
| `POST /projects/summary` | 已保存摘要 + 本地草稿 + 统计 |
| `POST /projects/summary/update` | 保存 8 段摘要 |
| `POST /projects/export` | json / markdown 文本 |

## 6. UI

- 任务页顶部子视图「任务 / 项目」（不新增顶层标签）：
  - 任务：新建（弹窗）、合并（多选同会话）、状态 chips、类型与名称编辑、详情抽屉（9 字段编辑 + 自动草稿徽标 + 文件/命令聚合 + findings + 调用明细 + 三种导出）。
  - 项目：项目列表（路径/会话/任务/调用/tokens/费用/最近活动/摘要状态）；选中后 8 段摘要编辑器（草稿 vs 已保存、保存后提示版本）、导出 JSON/Markdown。
- 说明文案进 `?` 图标；深色 token；1600/897/390。

## 7. 验收（Phase 4 门禁）

1. 单元测试：任务 create/update 校验、merge（同 session/目标选择/默认隐藏）、detail 聚合、摘要草稿字段正确且**usage_records 行数不变（无模型调用）**、updateSummary 局部合并、三种导出（BOM/公式防护）、项目 list/summary 草稿/update 版本自增/export、v3→v4 迁移幂等。
2. 真实沙箱：新建手动任务 → 改名/改状态/改类型 → 合并两个自动任务 → 打开详情看到自动草稿（文件/命令/token）+ 编辑保存 → 导出三种格式；项目页看到本项目摘要草稿 → 编辑保存（版本 1）→ 再保存（版本 2）→ 导出。
3. 无模型调用：上述操作前后 `usage_records` 计数不变；项目摘要不写 mnemon（代码审查 + 测试）。
4. UI：三档宽度截图、空态、`?` 图标。
