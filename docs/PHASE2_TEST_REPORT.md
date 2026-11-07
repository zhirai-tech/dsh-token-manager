# Phase 2 测试报告 · 工具输出缓存 / 智能压缩 / 原文恢复

> 版本：1.0.0（Phase 2）｜日期：2026-11-01｜环境：DSH 0.2.1-rc.5 / Electron 44.7 / Node 24.21
> 测试环境：隔离 profile `tm-sandbox`；生产 `desktop` profile 零改动。

## 1. 交付范围

| 模块 | 文件 |
|---|---|
| schema v2 + 迁移 | `src/storage/{schema.ts,db.ts}`（v1→v2 幂等、`blobs`/`tool_results` + 4 索引） |
| 内容寻址存储 | `src/storage/blob-store.ts`（原子写、回读 sha256、去重 ref_count、prune TTL/LRU、verify、usageBytes） |
| 缓存仓库 | `src/storage/blob-repository.ts`（record/findReusable/markAccessed/list/stats/blobForSession/clear） |
| 摘要器 | `src/host/summarizer.ts`（7 类内容确定性中文摘要 + `[Token Manager]` 头） |
| 压缩处理器 | `src/host/tool-cache.ts`（跳过规则、分层阈值、去重、observe/on、失败回退） |
| 缓存 API | `src/host/cache-api.ts` + `src/host/http-api.ts`（5 条 `/cache/*` 路由） |
| 原文恢复工具 | `src/host/read-tool.ts`（`token_manager_read`：blobId/path、字节/行范围、分页、会话归属校验） |
| 接线 | `src/index.ts`（`tools/post-execute` 监听、工具注册、缓存服务注入、启动 prune、卸载清理） |
| 客户端 | `src/client/{cache.tsx,viewer.tsx,settings.tsx,api-client.ts,index.tsx}` + locale 317 键 |
| 设计 | `docs/PHASE2_DESIGN.md` |

## 2. 构建与静态检查

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| `npm run build` | Host `lib/index.js`、Client `lib/client.js` 均 built + `node --check` 通过 |
| 运行时依赖 | 0（仅 node 内置 + DevDeps） |
| 单文件行数 | summarizer 381 / tool-cache 371 / cache-api 261 / http-api 546 / blob-store 474 / blob-repository 326（均 ≤700） |

## 3. 单元/集成测试

```
npm test                     → 132 passed / 0 failed
  · Phase 1 回归               69
  · blob-store / storage       25
  · cache / summarizer / api   30
  · read-tool                  7
TM_CROSSCHECK_SESSIONS=30 npm run test:integration
  → sessions=30 officialFresh=30 logFailures=0 officialFailures=0
```

覆盖：v1→v2 迁移、原子写/哈希校验/去重/prune/verify/clear、跳过规则（错误/图片/黑名单/mnemon_/PTC 子派发/小结果）、分层阈值、observe 不改 content、on 才替换、additionalContexts 保留、异常回退、7 类摘要关键字段、缓存 API 参数校验与 503、read 工具字节/行分页/会话归属/路径穿越拒绝/规范值 schema。

## 4. 真实沙箱验收（端到端）

现有 v1 数据库（219 会话、6 次真实调用）启动后自动迁移：`PRAGMA user_version = 2`，历史数据保留。

### 4.1 启用自动压缩（mode=on）

构造 >50KB 工具输出（pwsh 4000 行模拟构建错误，工具自身截断到 **64,138 字节 / 570 行**）：

| 指标 | 值 |
|---|---|
| tool_results | 1 行：`pwsh`，original 64,138 → compressed 7,229，`smart`，mode `on` |
| blob | 1 个，路径 `blobs/35/35d730…`，sha256 校验通过 |
| 持久化日志 | `tool/result` 内容以 `[Token Manager] 工具输出已压缩（通用文本）` 开头，含 Blob ID、原始大小、摘要、恢复提示 → **模型与 UI 看到的是摘要** |
| 压缩率 | **88.7%** |

随后在同一会话让模型调用恢复工具：
```
tool/call token_manager_read {"blobId":"c414c40c-…","offset":2,"lines":1}
tool/result: [token_manager_read] 第 2-2 行 / 共 570 行
             src/module34.ts(3434): error TS2345: ...
             还有更多内容，offset=3
assistant 最终回复：src/module34.ts(3434): error TS2345: ...
```
分页完整性（服务层）：9 个分片拼回 **64,138 字节，与原文逐字节一致**。

### 4.2 观察模式（mode=observe，默认）

同一类大输出再次产生：

| 指标 | 值 |
|---|---|
| tool_results | `would-smart`，mode `observe`，compressed 3,460（仅记录“本可压缩到多少”） |
| 持久化日志 | **原始内容**（64,138 字节，含原始行标记，无 `[Token Manager]` 头） |
| 模型行为 | 正常完成任务，无感知 |

### 4.3 失败回退（blob 存储不可用）

把 `blobs/` 目录替换为同名文件（写入必然 `ENOTDIR`），mode=on 再触发大输出：

| 指标 | 结果 |
|---|---|
| 工具结果 | **原文**（39,393 字节，无摘要头） |
| 任务 | 正常完成，无中断 |
| 错误记录 | `meta.cache_last_error = {"where":"blob.put","message":"ENOTDIR: not a directory, mkdir '…\\blobs\\7e'"}` |
| 数据 | 未产生半成品记录；恢复目录后功能正常 |

### 4.4 界面（截图见 `.verify/real-user/`）

| 文件 | 内容 |
|---|---|
| `11-cache-1600.png` | 第 6 标签「工具缓存」：缓存条目 2、原始 125KB、压缩后 10.4KB、节省 115KB(91.7%)；表格含 would-smart/观察模式 与 smart/启用自动压缩 两类 |
| `12-cache-viewer-1600.png` | 原文抽屉：blobId/哈希/大小/类型/摘要 + 当前范围 0–8192 / 总字节 62.6KB + 上一段/下一段 |
| `13-settings-cache-1600.png` | 设置「工具输出缓存」：模式 chips、Blob 数/占用/缺失、5 阈值、7 类型开关、一致性检查、清空缓存 |

### 4.5 卸载与残留

```
dsh plugin remove dsh-token-manager → 重启
· 左栏无「Token 监控」；GET /token-manager/api/health → 404
· 会话 request/header 工具清单（31 个）**不含 token_manager_read**
· 数据保留：token-manager.db（schema v2，219 会话）+ 2 个 blob 文件
```

## 5. 安全与边界

| 项 | 结果 |
|---|---|
| 只改工具结果、不改用户/系统/记忆消息 | ✅（仅 `tools/post-execute` 的 text 工具结果；mnemon_* 与提问类工具在跳过名单） |
| 可逆 | ✅ 原文按 SHA-256 存本地，`token_manager_read` 恢复；分页逐字节一致 |
| 会话隔离 | ✅ `repo.blobForSession` 校验；跨会话读取返回未找到 |
| 路径读取 | ✅ 仅限会话工作目录，`..` 穿越拒绝，单文件 1MB 上限 |
| 敏感内容 | 不缓存非文本（image/file）；文本摘要不含完整原文；发现项仍脱敏 |
| 失败不阻断 | ✅ 实测 ENOTDIR 回退原文 |
| 默认安全 | ✅ 默认 observe（不替换模型可见内容）；自动压缩需手动启用 |
| 外部网络 | 无 |

## 6. 已知限制

1. 工具自身会先截断超大输出（本机 pwsh 截断到约 64KB），插件处理的是“工具实际返回的内容”。
2. 观察模式仍会保存 blob（用于“可切换启用”与统计），会占用磁盘；受 `maxCacheMB`/`ttlDays` 限制，可手动清空。
3. 摘要质量是启发式：构建日志/测试输出/JSON/XML 有结构化提取；其他文本是首尾行 + 省略行数。
4. 去重按 `(session, tool, argsHash, resultHash)`，跨会话不共享 blob 引用（保守设计）。
5. `blobs` 目录权限异常时只记录错误并回退，不自动修复目录（需人工处理）。

## 7. Phase 2 门禁结论

| 验收项（设计 §9） | 结果 |
|---|---|
| 1 单元测试（跳过/分层/去重/observe/on/回退/摘要/存储/read） | ✅ 132/132 |
| 2 真实沙箱 >50KB：observe 原文可见、on 摘要 + blob + 恢复一致 | ✅ |
| 3 失败回退：工具结果仍为原文、任务不中断 | ✅ |
| 4 关闭插件无残留（路由/UI/工具），数据保留 | ✅ |

**Phase 2 通过。** 下一步 Phase 3：上下文去重（默认 dry-run，KV Cache 风险检测），按 Phase 0 门禁 D1 采用「只检测 + 可选可逆替换」，不依赖 `agent/pre-step` 改写历史。
