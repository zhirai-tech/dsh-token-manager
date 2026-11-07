# Phase 2 设计：工具输出缓存 / 智能压缩 / 原文恢复

> 依据：PRD 第四部分（4.1–4.7）、Phase 0 审计结论（`docs/audit/01-host-hooks.md` §3/§4）。
> 原则：**可逆、可关闭、可追踪、失败必回退**；默认观察模式；模型可见内容被替换时，替换后的文本同时进入持久化日志（官方设计如此），因此摘要必须自带恢复入口。

## 1. 扩展点与事实

- `tools/post-execute`（waterfall）：`(exec, result, next) => PostToolDecision`。
  - `exec`：`{callId, name, arguments(已解析), agent?, parent?, signal}`。
  - `result`：`{content: ContentBlock[], value?, meta?, isError?}`。
  - 返回 `{kind:'accept', content: ContentBlock[]}` 即替换模型可见内容；**同时写入 `tool/result` 持久化日志**。
  - `tools/result` 只读（emit，`exec` 冻结），仅用于统计。
- `ctx.tools.register(ToolDefinition)`：`parameters` 与 `output.schema` 都必须是**已编译 JSON Schema**（register 不做 spec 编译）；`output.render(args, value)` 产出模型可见文本；`execute` 返回被 schema 校验的规范值；`exec.agent?.session` 可用于权限校验；插件 `apply` 里注册的是全局层。
- 与 `spill-policy`（>12500 tokens 内联溢出）叠加时注意二次裁剪：本插件只对文本工具结果做**摘要替换**，不依赖 spill；若 spill 先发生，本插件看到的是已溢出引用文本（小），通常自然跳过。

## 2. 数据模型（schema v2）

```sql
blobs(id TEXT PK, hash TEXT UNIQUE, content_type, byte_size, storage_path,
      created_at, last_accessed_at, expires_at, ref_count)
tool_results(id PK, session_id, task_id, turn, step, tool_name, arguments_hash,
      result_hash, blob_id, original_size, compressed_size, compression_type,
      mode, created_at, dedupe_of)
```
索引：`blobs(hash)`、`tool_results(session_id, created_at)`、`tool_results(tool_name, arguments_hash, result_hash)`、`tool_results(blob_id)`。

- 内容寻址：`<dataDir>/blobs/<sha256前2位>/<sha256>`；原子写（临时文件 + rename），写入后回读校验。
- 去重：同 `(session_id, tool_name, arguments_hash, result_hash)` 且 blob 文件仍存在且 hash 校验通过 → 返回引用（`dedupe_of` 指向已有行）。
- 一致性：启动时/按需 `verify()` 报告缺文件 / 孤儿文件 / hash 不符；`prune()` 按 `last_accessed_at` LRU + `expires_at` 清理，遵守容量上限。

## 3. 处理流程

1. 跳过判定：`isError`、含 image/file block、工具名黑名单（`token_manager_read`、`mnemon_*`、提问/任务/团队工具等）、`exec.parent` 非空（PTC 子派发）、文本 < `minBytes`。
2. 拼接 text blocks → 原始字节数 → `argsHash`（规范化 JSON，键排序）→ `resultHash`（拼接文本）。
3. 去重命中 → 记录 `dedupe_of`，返回引用摘要（不重复存 blob）。
4. 未命中 → `blobStore.put()` 保存原文（超过 `maxBlobBytes` 放弃并保留原文）。
5. 分层策略（阈值可配）：
   - `< 2KB`：不处理（回到 1）；
   - `2–10KB`：只做重复检测，不压缩；
   - `10–50KB`：选择性摘要；
   - `> 50KB`：智能压缩。
6. 模式：
   - `off`：完全不处理；
   - `observe`（默认）：保存原文、写 `tool_results(mode='observe')`、记录“本可压缩为 X 字节”，但**返回 next()**（模型看原文）；
   - `on`：返回 `{kind:'accept', content:[摘要文本]}`。
7. 失败回退：任何异常 `return next()`，写 `meta('cache_last_error')`；绝不阻断工具。

## 4. 摘要格式（模型可见）

```
[Token Manager] 原始工具输出已保存，可按需恢复。
Blob ID: <id>
原始大小: 123456 字节（约 3.2 万字符）
内容类型: build-log
摘要:
- 构建失败：2 个错误
- 关键错误：TS2345 at src/a.ts:42 ...
- 末尾 20 行：...
需要完整内容时调用 token_manager_read（blobId=<id>；支持 offset/lines 分片）。
```

## 5. `token_manager_read`

参数：`blobId`（或 `path`，仅限会话工作目录内）、`offset`（字节偏移；`lines` 模式时为 1-based 行号）、`lines`、`maxChars`（默认 8000，上限 32000）。
返回规范值（全部为具体类型，无 null）：`found/blobId/hash/contentType/byteSize/offset/endOffset/totalBytes/nextOffset(-1 表示结束)/text/message`。
权限：`repo.blobForSession(blobId, sessionId)` —— 只允许产生该 blob 的会话读取；无会话身份时才允许全局读取（并记录）。
限制：单文件 1MB（path 模式）、单次 32000 字符、超过 16MB 的 blob 只支持按范围读。

## 6. 设置项（`settings.compression`）

`mode`（off/observe/on）、`minBytes`(2048)、`selectiveBytes`(10240)、`smartBytes`(51200)、`maxBlobBytes`(64MB)、`maxCacheMB`(512)、`ttlDays`(30)、`headLines`/`tailLines`、各内容类型开关。

## 7. HTTP API（Phase 2 新增）

- `POST /cache/list` `{limit,offset,sessionId?,tool?}` → `{total,rows[]}`
- `POST /cache/stats` → `{blobs,totalOriginalBytes,totalCompressedBytes,savedBytes,dedupeCount,missingBlobs,usageBytes}`
- `POST /cache/read` `{blobId,sessionId?,offset?,limit?}` → `{blobId,content,offset,totalBytes,nextOffset}`
- `POST /cache/verify` → `{missingFiles,orphanFiles,hashMismatch}`
- `POST /cache/clear` → `{removed,freedBytes}`
- `POST /settings/update` 支持 `{compression:{...}}` 深合并

## 8. UI

第 6 个标签「工具缓存」：指标卡（条目/原始/压缩后/节省/去重命中）、表格（工具/大小/压缩类型/模式/会话/时间/可恢复）、原文抽屉（分页读取）；设置页新增「工具输出缓存」区块（模式、阈值、类型开关、存储状态、一致性检查、清空缓存）。

## 9. 验收（Phase 2 门禁）

1. 单元测试：跳过规则、分层阈值、去重、observe 不改内容、on 改内容、异常回退、摘要关键字段、blob 存储/校验/prune/verify、read 工具分页与权限。
2. 真实沙箱：构造 >50KB 工具输出 → observe 模式：原文可见、DB 有记录；切 on：模型看到摘要、blob 落盘；再让模型调 `token_manager_read` 恢复原文并校验字节一致。
3. 失败回退：人为让 blob 目录不可写 → 工具结果必须仍是原文，任务不中断。
4. 关闭插件后：无 post-execute 残留（工具结果恢复原样）、数据保留。
