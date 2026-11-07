# Phase 3 测试报告 · 上下文去重检测 + KV Cache 风险（dry-run）

> 版本：1.0.0（Phase 3）｜日期：2026-11-01｜环境：DSH 0.2.1-rc.5 / Electron 44.7 / Node 24.21
> 测试环境：隔离 profile `tm-sandbox`；生产 `desktop` profile 零改动。

## 1. 交付范围

| 模块 | 文件 |
|---|---|
| schema v3 + 迁移 | `src/storage/{schema.ts,db.ts}`（`optimization_records` + 2 索引，v0/v1/v2→v3 幂等） |
| 优化记录仓库 | `src/storage/optimization-repository.ts`（record/list/stats） |
| KV Cache 风险 | `src/host/kv-risk.ts`（有价成本模型 / 无价 Token 代理） |
| 上下文分析 | `src/host/context-analyzer.ts`（surface 分类、重复检测、候选、只读 dry-run） |
| 上下文 API | `src/host/context-api.ts` + `src/host/http-api.ts`（4 条路由） |
| 设置 | `src/host/settings-store.ts`（`context` 默认值与深合并） |
| 客户端 | `src/client/{context.tsx,settings.tsx,api-client.ts,index.tsx}` + locale 391 键 |
| 设计 | `docs/PHASE3_DESIGN.md` |

## 2. 构建与测试

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| `npm run build` | Host + Client 均 built，`node --check` 通过 |
| `npm test` | **177/177 通过**（Phase 1/2 回归 144 + Phase 3 新增 33） |
| 集成交叉核对 | 30 会话，0 失败 |
| 单文件行数 | kv-risk 154 / context-analyzer 472 / context-api 169 / http-api 582（≤700） |

测试覆盖：受限来源（system/developer/user/mnemon）候选数=0；同内容 tool/result 检测；不同内容不误报；removable/invalidated 计算；有价/无价风险判定；recommend 阈值；`analyze/optimize` 后 fake session 写方法调用 **0 次**；空会话 `found:false`；v0/v1/v2→v3 迁移；优化记录 CRUD/分页/stats。

## 3. 真实沙箱验收

### 3.1 数据库迁移

现有 v2 库（219 会话、132 条测试后的真实数据）启动后自动升 **v3**（`PRAGMA user_version=3`），历史数据保留；`optimization_records` 表就绪。

### 3.2 上下文构成（真实 live 会话）

```
surface 78 节点 / 32,552 tokens
byRole:  tool 25.0K(76.9%) · user 4.09K · assistant 1.91K · system 1.45K · developer 66
bySource: tool 25.0K · agent-instructions 2.13K(受保护) · model 1.91K
          system-prompt 1.45K(受保护) · skill-catalog 1.04K(受保护) · user 441(受保护)
          time-context 294(受保护) · runtime-context 190(受保护) · tool-registry 66
```
UI 对受保护来源打「受保护」徽标，说明不会进入候选。

### 3.3 重复检测（真实产生）

构造两个内容完全相同的工具输出（同命令、不同 description，规避官方 `repeat-tool-reminder` 对完全重复调用的拦截），得到两条 3,992 字节的相同 `tool/result`：

| 候选 | 出现次数 | 可移除 tokens | changePoint | 失效 tokens | 风险 | 建议 |
|---|---|---|---|---|---|---|
| 尾部重复 | 2 | 631 | seq 270 | 645 | **safe** | **推荐** |
| 早期重复 | 2 | 309 | seq 163 | 7,041 | risky | 不建议 |
| 早期重复 | 2 | 56 | seq 202 | 5,408 | risky | 不建议 |

同一会话中另有两条“小重复”（309 / 56 tokens）保留在结果里用于对照——风险模型正确区分了「改早期前缀会拖垮大量后缀缓存」和「改尾部重复成本可接受」。

### 3.4 dry-run 记录与只读证明

```
POST /context/optimize → {"recorded":1}
optimization_records: id=1, type=context-dedup, original=32,552, optimized=31,921,
  estimated_savings=631, cache_delta=-645, verified=0, status=proposed
detail: {"dryRun":true,"readOnly":true,...}
```
**会话日志零变化**（同一会话优化前后）：
```
events 277 → 277 ｜ lastSeq 276 → 276 ｜ fileBytes 146,351 → 146,351
```
代码层也无任何 `session.append`/surface replace 调用（测试断言写方法调用为 0）。

### 3.5 成本模型分支（临时配置测试价格后删除）

配置 `deepseek-account/deepseek-flash`：input 1、cacheRead 0.1、output 2（CNY/百万 token）后：

| 候选 | extraCost | savingCost | 判定 |
|---|---|---|---|
| 631 / 645 | 0.000581 | 0.000631 | safe（0.000581 ≤ 0.000631×1.5） |
| 309 / 7,041 | 0.006337 | 0.000309 | risky |
| 56 / 5,408 | 0.004867 | 0.000056 | risky |

与手算一致；测试价格已删除，价格表恢复为空（未伪造正式价格）。

### 3.6 界面（截图 `.verify/real-user/14–18`）

| 文件 | 内容 |
|---|---|
| `14-context-1600.png` | 上下文分析页：7 标签、会话选择、dry-run/只读徽标、4 卡、role/source 组成、候选表（风险徽标+建议）、优化历史 |
| `15-context-897.png` | 897 宽：卡片两列、组成与候选纵排 |
| `16-context-390.png` | 390 宽：单列；标签折行（见限制） |
| `17-settings-phase3-1600.png` | 设置页总览（含工具缓存区块） |
| `18-settings-context-1600.png` | 设置「上下文分析」：模式 + 5 个参数 |

## 4. 安全与边界

| 项 | 结果 |
|---|---|
| 不改写会话 | ✅ 日志字节级不变；代码无写路径；测试断言 |
| 受保护消息 | ✅ system/developer/user + `dsh-mnemon` 等来源不产生候选 |
| 改写工具结果以外的内容 | ✅ 只分析 `tool` 角色节点，且只输出建议 |
| 默认安全 | ✅ 默认 `dry-run`；模式只有 off / dry-run（本阶段无 apply） |
| 虚构价格 | ✅ 未配置时用 Token 代理并明确标注；测试价格已清理 |
| 生产 profile | ✅ 未触碰 |

## 5. 已知限制

1. 390 宽度下 7 个标签会折行、个别标签文字换行（建议后续改为横向滚动）。
2. 风险徽标内的 reason 在表格中截断（hover 有完整 tooltip）。
3. 只分析 **live** 会话（需打开会话后才有 surface）；历史会话不参与。
4. 检测基于工具结果**内容哈希**：同一文件在不同路径读取时 read 工具会带路径头，因此不判为重复（符合预期）；官方 `repeat-tool-reminder` 会拦截参数完全相同的重复调用，因此真实重复更多来自“同内容不同参数/不同路径”的场景。
5. 本阶段不存在 apply 路径；是否开启改写留待 Phase 6 用 A/B 实测（PRD 12.4）后决定。

## 6. Phase 3 门禁结论

| 验收项（设计 §8） | 结果 |
|---|---|
| 1 单元测试（保护规则/重复检测/风险/只读） | ✅ 177/177 |
| 2 真实沙箱：组成+候选+dry-run 记录+日志不变 | ✅ |
| 3 不存在改写路径 | ✅ 代码审查 + 测试断言 |
| 4 UI 7 标签/风险/空态/三档宽度 | ✅（390 折行登记为限制） |

**Phase 3 通过。** 下一步 Phase 4：任务与项目管理增强（手动任务、项目摘要、任务成本归因与导出）。
