# Phase 3 设计：上下文去重与 KV Cache 风险检测（dry-run）

> 依据：PRD 第五部分、Phase 0 门禁裁决（D1：`agent/pre-step` 不能改历史；历史只能 surface replace）、usage 审计（cacheRead 占计费 99.27%）。
> 本阶段结论：**只检测、不改写**。任何改写历史前缀的策略都会让后缀缓存失效，必须在 Phase 6 用 A/B 实测证明"省了 Token 且没变贵"之后才允许开启。

## 1. 为什么不做自动改写

- DeepSeek 前缀缓存按"从头匹配"计费；改一个早期节点 → 该节点之后全部按未命中输入计费。
- 本机历史数据：cacheRead ≈ 99.27% 计费 token。改写早期重复内容省下的 Token 往往远小于缓存失效造成的额外成本。
- 因此 Phase 3 输出的是「候选 + 风险估算 + dry-run 记录」，由用户/后续阶段决定是否实施。

## 2. 数据与范围

- 分析对象：**live Session 的 surface**（`session.surface.nodes`），逐节点通过 `session.eventAt(seq)` 取事件。
- 节点分类：
  - role：system / developer / user / assistant / tool；
  - source：`message.source.kind`（`user`、`system-prompt`、`agent-instructions`、`runtime-context`、`skill-catalog`、`time-context`、`dsh-mnemon`、`model`、`tool`…）。
- **受保护**（永不产生候选）：role 为 system/developer/user 的节点；`source.kind` 属于 `CONTEXT_PROTECTED_SOURCES`（含 `dsh-mnemon`、`plugin:dsh-mnemon`）。
- 候选只来自 **`role='tool'` 且 `source.kind='tool'` 的 tool/result 节点**。

## 3. 重复检测

1. 对每个 tool/result 节点取 content 的 text 块拼接，计算 SHA-256。
2. 同 hash 出现 ≥ `minOccurrences`（默认 2）→ 候选 `kind='tool-result'`。
3. subject：通过 `message.source.callId` 关联 surface 中的 `tool/call` 事件，取工具名 + 参数摘要；关联失败则 "tool"。
4. 每个候选：
   - `removableTokens` = 保留**最后一次**出现，其余出现节点的 tokens 之和；
   - `changePointSeq` = 第二次出现的 seq（改写从这里开始破坏前缀）；
   - `invalidatedTokens` = surface 中 `seq >= changePointSeq` 的 tokens 之和（可能失效的缓存量）。
5. 排序：removableTokens 降序，最多 `maxCandidates` 个。

## 4. KV Cache 风险估算

有价格配置时（`price_configs`）：

```
extraCost   = invalidatedTokens × (inputPrice − cacheReadPrice) / unit
savingCost  = removableTokens   × inputPrice / unit
risky       = extraCost > savingCost × riskFactor(默认1.5)
```

无价格时使用 Token 代理：

```
risky = invalidatedTokens > removableTokens × riskFactor
```

返回值：`{changePointSeq, invalidatedTokens, extraCost, savingCost, risky, verdict: safe|risky|unknown, reason}`。
建议（recommend）= `!risky && removableTokens >= 512`。

## 5. 记录（`optimization_records`，schema v3）

- `optimization_type='context-dedupe'`、`status='proposed'`、`verified=0`
- `original_tokens_estimated` = 当前 surface tokens
- `optimized_tokens_estimated` = surface tokens − ΣremovableTokens（仅推荐候选）
- `estimated_savings` = ΣremovableTokens
- `cache_delta` = −首个候选 invalidatedTokens（保守估计）
- `detail` = JSON（候选摘要、风险、模式）
- **不写任何 session 事件**；`analyze/optimize` 全部只读（测试断言 session 写方法调用为 0）。

## 6. API

| 路由 | 说明 |
|---|---|
| `POST /context/analyze` `{sessionId?}` | 缺省取最近 live 会话；返回 surface 组成 + 候选 + 风险 |
| `POST /context/optimize` `{sessionId?}` | 把推荐候选写入 `optimization_records`（dry-run），返回 `{recorded, analysis}` |
| `POST /optimizations/list` `{sessionId?,limit,offset}` | 优化建议历史 |
| `POST /context/stats` | 统计：候选数、潜在节省、风险数、历史记录 |

## 7. UI

「上下文分析」标签（第 5 个业务页）：
- 会话选择 + 刷新分析；
- 组成：节点数 / 估算 tokens + 按 role 堆叠条 + 按 source 明细（mnemon 标“受保护”）；
- 候选表：类型 / 对象 / 出现次数 / 可移除 tokens / 缓存风险徽标（safe/risky/unknown + tooltip 原因）/ 建议；
- 展开候选看每次出现位置；
- 「记录本次 dry-run 建议」+ 优化历史表；
- `?` 帮助解释“为什么只检测不改写”。
- 设置页新增「上下文分析」区块（模式、阈值、风险倍数）。

## 8. 验收（Phase 3 门禁）

1. 单元测试：分类与保护规则（mnemon/system/user 不产候选）、重复检测、removable/invalidated 计算、有价/无价风险判定、recommend 阈值、optimize 写记录且 session 只读（写方法调用 0 次）、空会话 found=false。
2. 真实沙箱：打开上下文分析，能看到当前会话组成与候选（重复读取同一文件/重复工具输出），dry-run 记录后 `optimization_records` 有行；**会话事件数不变**。
3. 改写安全：本阶段不存在任何改写/apply 代码路径（代码审查 + 测试断言）。
4. UI：7 标签、风险徽标、空态、三档宽度截图。
