# Phase 5 测试报告 · UI 完善与 dsh-mnemon 兼容测试

> 版本：1.0.0（Phase 5）｜日期：2026-11-01｜环境：DSH 0.2.1-rc.5 / Electron 44.7 / Node 24.21
> 测试环境：新建隔离 profile `tm-mnemon`（base + web-app + **dsh-mnemon 0.5.36** + dsh-token-manager），端口 62302；另一隔离 profile `tm-sandbox`（无 mnemon）用于对照。生产 `desktop` profile 零改动。

## 1. 范围

| 项 | 内容 |
|---|---|
| UI 完善 | 顶部 8 标签 390 宽改单行横向滚动；页面级横向溢出收敛；帮助气泡移动端改底部浮层；任务表列宽修复 |
| Mnemon 兼容 | 同时启用 mnemon 的真实会话：注入识别、工具输出压缩、原文恢复、Token 统计交叉核对、上下文分析保护、会话恢复、卸载/重载 |
| 验收项（PRD Phase 5） | 总览/任务/明细/缓存/配置页（Phase 1–4 已完成）、安装、卸载、会话恢复 |

## 2. UI 改动与验证

| 问题 | 修复 | 验证 |
|---|---|---|
| 390 宽 8 个顶层标签折行、文字换行 | `.tm-tabs` nowrap + 横向滚动（隐藏滚动条）、当前标签自动滚入可见 | `28-tabs-scroll-390.png`：单行、可滑动、无折行 |
| 页面级横向溢出 | `.tm-body overflow-x hidden`，宽表格只在 `.tm-tablewrap` 内滚动 | 1600/897/390 各页无页面级横向滚动 |
| 移动端帮助气泡被裁切 | ≤640 改底部固定浮层；右对齐工具行右锚定 | 390 上下文分析页 `?` 正常展开 |
| 任务表最后一列被裁切 | 列宽收敛 + 截断 + 短时间格式 | Phase 4 截图 23 |

## 3. dsh-mnemon 兼容测试（真实会话）

### 3.1 环境

- `tm-mnemon` profile 从官方 web 模板创建，安装 `dsh-mnemon@0.5.36` 与本插件；补 `agent-default-model = deepseek-account / deepseek-flash / high` 与 `danger-full-access` 权限补丁后正常真实调用。
- 启动后左栏同时出现「记忆系统」（mnemon）与「Token 监控」；`/token-manager/api/health` 正常（schema v4）。

### 3.2 记忆注入识别（真实日志）

会话 `session-b9227985-…` 的用户消息来源：

```
8  user               raw prompt（148 字符）
9  agent-instructions 8480
10 runtime-context    656
11 skill-catalog      4124
12 time-context       262
13 dsh-mnemon  instructions  207 字符
14 dsh-mnemon  recall        2340 字符（MNEMON RUNTIME MEMORY SNAPSHOT）
```
- 本插件只按 `message.source.kind` 分类，`dsh-mnemon` 两条消息被标为**受保护**，不进入任何压缩/候选路径。

### 3.3 工具输出压缩 + 原文恢复（mnemon 同时启用）

- pwsh 生成 2000 行输出（工具自身截断到 **64,139 字节 / 1,127 行**）→ 本插件替换为 **4,027 字节摘要**（Blob `555826d2-…`），模型在回复中明确提到输出被压缩。
- 下一轮模型调用 `token_manager_read {blobId, offset:1, lines:2}` → 返回 `第 1-2 行 / 共 1127 行`，内容正确。
- 说明：在 mnemon 注入存在的上下文里，压缩与恢复链路均正常。

### 3.4 Mnemon 消息未被修改（硬证据）

对两条 `source.kind='dsh-mnemon'` 消息做内容 SHA-256（前缀）：

| seq | form | 字符数 | 压缩前哈希 | 压缩/恢复后哈希 |
|---|---|---|---|---|
| 13 | instructions | 207 | `fa7cbbcbc2a872ed` | `fa7cbbcbc2a872ed` |
| 14 | recall | 2340 | `05e18bd4be4057c7` | `05e18bd4be4057c7` |

→ **完全一致**；代码路径也只处理 `role='tool' && source.kind='tool'` 的 tool/result。

### 3.5 Token 统计交叉核对（mnemon 会话）

```
本插件台账：calls=5, input=20,991, cacheRead=82,176, cacheWrite=0, output=868
官方投影 tokenUsage.totals：20,991 / 82,176 / 0 / 868  → 逐字段一致
```
（会话内 4 次工具调用：glob 1、read 2、pwsh 1；任务 1 个，状态 completed。）

### 3.6 上下文分析（mnemon 来源受保护）

对恢复后的会话分析：
- surface 25 节点 / 9,211 tokens；
- 按来源：system-prompt 2.57K、agent-instructions 2.13K、**dsh-mnemon 1.25K（13.5%，受保护）**、tool 1.04K、skill-catalog 1.04K、model 834…
- 与 mnemon 自己的 projection key（`mnemonSubagentTokenUsage`）无冲突：本插件不注册任何 projection key。

### 3.7 会话恢复

- 关闭进程 → 重新启动 `tm-mnemon` → 打开原会话：标题、历史、工具调用均正常。
- 本插件数据在恢复后仍可用：该会话 7 条调用（2 轮）、任务 15 个、缓存 13 条（含 `555826d2` 可恢复）、上下文分析 `found=true`、优化建议历史保留。
- 会话日志事件数在重启后未丢失（崩溃恢复若补齐 `step/end` 属官方行为）。

### 3.8 卸载与重新加载

```
dsh plugin --profile tm-mnemon remove dsh-token-manager → 重启
· 左栏仅剩「记忆系统」（无 Token 监控）
· GET /token-manager/api/health → 404
· 新 turn 的 request/header：tools 48 个，token_manager_read **不在**（有插件时 49 个）
· mnemon 仍正常注入（seq 73：dsh-mnemon recall 2340 字符）
· 数据保留：token-manager.db（schema v4）+ blobs + 历史统计
重新安装并重启 → 左栏恢复、缓存 9 个 blob、优化记录 1 条、上下文模式 dry-run 全部保留
```

### 3.9 本轮发现并修复

| 问题 | 修复 |
|---|---|
| 上下文分析“最近活跃会话”选到空 surface 的会话，页面误显示“当前会话还没有可分析的上下文” | `context-api` 缺省改为按 last_seen_at 倒序探测前 10 个会话，返回第一个 `found=true` 的；新增 3 个测试；复测 `analyze {}` 正确返回 `session-b9227985`（含 mnemon 1246 tokens） |
| 390 标签折行 | 横向滚动 |
| 页面级横向溢出 / 帮助气泡裁切 | 见 §2 |

## 4. 测试与构建

| 项 | 结果 |
|---|---|
| `npm test` | **216/216 通过** |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | Host + Client built，`node --check` 通过 |
| 真实历史交叉核对 | 30 会话，0 失败（1 个投影滞后单独标记） |
| 运行时依赖 | 0 |

## 5. 已知限制

1. 上下文分析只支持 **live** 会话（需在进程中打开过）；历史会话只能看统计数据。
2. `tm-mnemon` 测试 profile 需要显式配置模型与权限补丁（文档化，不影响生产）。
3. 390 宽下标签可横向滑动，但一屏只能看到约 5 个标签（导航设计取舍）。
4. mnemon 的 `mnemon_*` 工具结果不在压缩范围（符合红线），因此其输出仍会占用上下文。
5. 本轮未测 mnemon 的「项目记忆」跨会话读取路径（其记忆注入已在 3.2 覆盖），标记为 Phase 6 回归项。

## 6. Phase 5 门禁结论

| 验收项 | 结果 |
|---|---|
| UI 完善（390 标签、溢出、帮助气泡） | ✅ |
| Mnemon 开启时正常会话 / 注入识别 | ✅ |
| 记忆注入后执行工具 + 工具输出压缩 + 持续调用模型 | ✅ |
| `token_manager_read` 在 mnemon 会话中恢复原文 | ✅ |
| Mnemon 消息未被修改（哈希一致） | ✅ |
| Token 统计与官方口径一致（mnemon 会话） | ✅ |
| 会话恢复 | ✅ |
| 插件卸载与重新加载（mnemon 同时启用） | ✅ |

**Phase 5 通过。** 下一步 Phase 6：稳定版交付（安装包、完整中文文档：安装/配置/故障排查、测试报告汇总、版本记录、生产安装需用户授权）。
