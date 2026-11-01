# DSH Token Manager · Token 成本监控与模型调用效率分析

> DeepSeek Harness（DSH）Cordis 插件 · 简体中文 · 本地数据 · 只读监控
> 版本 1.0.0（Phase 1–6，稳定版）· Powered by 智睿

![icon](icon.png)

## 这是什么

DSH Token Manager 在**不修改模型上下文、不限制调用、不更换模型、不降低推理等级**的前提下，回答四个问题：

1. 我的 Token 花在哪了？（按调用 / 任务 / 会话 / 项目 / 今日 / 历史累计）
2. 哪些调用最贵？为什么贵？（未命中输入 / 缓存命中 / 输出 / 合计）
3. 这个任务是不是调用了太多次模型、重复读了同一个文件、重复跑了构建或测试、反复确认/计划/总结？
4. 和同类型的历史任务比，这次是不是异常消耗？

Phase 1 只做**监控与分析**；Phase 2 增加**默认关闭的**工具输出缓存；Phase 3 增加**只检测**的上下文重复分析与 KV Cache 风险估算；Phase 4 增加本地任务/项目摘要与导出。全程不做自动限制、不降推理等级、不换模型。

## 功能（Phase 1）

### 1. 逐调用 Token 台账
- 每次模型调用记录：provider / model / 轮次 / 步骤 / 未命中输入 / 缓存命中 / 缓存写入 / 输出 / 合计 / 耗时。
- 口径与 DSH 官方投影一致：`inputTokens` = **未命中**输入；`合计 = 四桶之和`；`reasoningTokens` 本版本接口未提供（显示为空，不当作 0）。
- 去重键 `(sessionId, turn, step, attempt)`；重试不重复计费。
- **交叉核对**：逐调用汇总 == 官方 `tokenUsage` 投影（真实历史会话已验证 0 误差）。

### 2. 任务成本
- 自动把每个用户 turn 记为任务；可手动创建/改名/改类型/标记完成。
- 五种任务类型：简单修改 / 普通开发 / 复杂开发 / 故障排查 / 项目分析（启发式建议，可人工覆盖）。
- 任务快照（开始/结束累计值）、并发干扰标记、任务成本报告（Top 成本调用 + 原因 + 建议）。

### 3. 模型调用效率分析（只读）
| 分析项 | 说明 |
|---|---|
| 重复读取同一文件 | 同路径多次读取；内容哈希相同才判为重复，文件已变化只记录为信息 |
| 重复执行相同工具 | 工具名 + 参数哈希 + 结果哈希都相同 |
| 重复执行构建 / 测试 / 部署 | 命令归一化后同类命令重复 |
| 疑似多轮确认 | 同一 turn 内多次短文本、无工具调用的 assistant 消息（使用了提问工具则不判） |
| 疑似重复计划 / 总结 | 同一任务内计划类/总结类措辞反复出现 |
| 模型步骤偏多 | 调用次数超过同类型基线 p80×1.5，或简单任务超过绝对上限 |
| 缓存命中率下降 | 低于同项目历史中位数的一半 |
| 任务成本异常 | Token 或费用超过同类型基线 p80×1.5 |

每项都有独立开关与阈值；发现只生成"发现项"，不阻断、不修改任何内容。

### 4. 中文仪表盘
左栏「Token 监控」入口 + 独立整页，5 个标签：总览 / 调用明细 / 任务 / 成本分析 / 设置。
深色主题、紧凑卡片、纯 SVG 图表、1600/897/390 三档响应式；说明类文案收进 `?` 帮助图标。

### 5. 费用估算
- 自定义价格表：provider + model 的四桶单价、币种、计量单位（默认每百万 Token）、生效时间。
- 未配置价格时显示「价格未配置」，**不显示 0 或虚构金额**；实际账单与本地估算分开标识。

### 6. 历史导入
- 一键导入 DSH 历史会话投影（只读，不改任何会话文件），用于「所有历史」累计与趋势。
- 导入行为按会话汇总，不混入逐调用明细。

## 发布包（v1.0.0）

| 包 | 位置 |
|---|---|
| 运行时安装包 | `E:\ZHIRAI Harness\release\dsh-token-manager-1.0.0.zip` |
| 完整源码包 | `E:\ZHIRAI Harness\release\dsh-token-manager-1.0.0-source.zip` |

校验值：见同目录 `RELEASE_SHA256.txt`（zip 内外不内嵌自身哈希）。安装/升级/卸载见 [docs/INSTALL.md](docs/INSTALL.md)，配置见 [docs/CONFIG.md](docs/CONFIG.md)，故障排查见 [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)，交付清单见 [docs/DELIVERY.md](docs/DELIVERY.md)。
## 安装

### 前置条件
- DeepSeek Harness 0.2.x（本机验证版本 `0.2.1-rc.5`）
- Node.js ≥ 22（宿主内置 24.x 即可）

### 构建
```powershell
cd "E:\ZHIRAI Harness\dsh-token-manager"
npm install          # 仅开发依赖：typescript / esbuild / 类型
npm run build        # 产物：lib/index.js（Host）、lib/client.js（Client）
npm test             # 单元测试
npm run test:integration   # 真实历史会话交叉核对
```

### 发布包（v1.0.0）

| 包 | 位置 |
|---|---|
| 运行时安装包 | `E:\ZHIRAI Harness\release\dsh-token-manager-1.0.0.zip` |
| 完整源码包 | `E:\ZHIRAI Harness\release\dsh-token-manager-1.0.0-source.zip` |

校验值：见同目录 `RELEASE_SHA256.txt`（zip 内外不内嵌自身哈希）。安装/升级/卸载见 [docs/INSTALL.md](docs/INSTALL.md)，配置见 [docs/CONFIG.md](docs/CONFIG.md)，故障排查见 [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)，交付清单见 [docs/DELIVERY.md](docs/DELIVERY.md)。
## 安装到隔离测试 profile（推荐先这样验证）
```powershell
# 1) 创建隔离 profile（不碰生产 desktop）
dsh tm-sandbox --from-default-profile web --dump-config

# 2) 构建并安装（脚本会自动把安装副本换成指向源码目录的 junction，便于热更新）
powershell -ExecutionPolicy Bypass -File scripts\install-sandbox.ps1

# 3) 启动独立 GUI（URL 带一次性 token）
dsh tm-sandbox --port 62300 --no-open
```

### 发布包（v1.0.0）

| 包 | 位置 |
|---|---|
| 运行时安装包 | `E:\ZHIRAI Harness\release\dsh-token-manager-1.0.0.zip` |
| 完整源码包 | `E:\ZHIRAI Harness\release\dsh-token-manager-1.0.0-source.zip` |

校验值：见同目录 `RELEASE_SHA256.txt`（zip 内外不内嵌自身哈希）。安装/升级/卸载见 [docs/INSTALL.md](docs/INSTALL.md)，配置见 [docs/CONFIG.md](docs/CONFIG.md)，故障排查见 [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)，交付清单见 [docs/DELIVERY.md](docs/DELIVERY.md)。
## 安装到生产 profile
**尚未获得用户授权前不要执行。** 获得授权后可用插件管理器安装本目录（`plugin_manager install_bundle`，target 指向本目录绝对路径），或在设置 → 插件中安装。安装后重启 Harness。

### 卸载
1. 设置 → 插件中禁用或移除 `dsh-token-manager`；
2. 重启 Harness（监听器、HTTP 路由、UI 注入会随插件 fiber 卸载自动清理）；
3. 数据保留在 `%DSH_HOME%\dsh-token-manager\`，如需彻底删除请先备份再手动删除该目录。

## 数据与隐私
- 数据目录：`%DSH_HOME%\dsh-token-manager\`（默认 `C:\Users\Administrator\.dsh\dsh-token-manager`），可用环境变量 `DSH_TOKEN_MANAGER_DATA_DIR` 或插件配置 `dataDir` 覆盖。
- SQLite 单文件 `token-manager.db`（WAL）+ `backups/`（后续版本）。
- **不记录** API Key、密码、授权凭据；发现项中的文本证据截断并脱敏。
- 所有数据保存在本机，不上传任何服务器；不写入 DSH 的 `sessions/`、`storages/`。
- Phase 2 起，被压缩的工具结果原文以内容寻址方式保存在本插件自己的 `blobs/` 目录（SHA-256 校验、会话级权限），可通过 `token_manager_read` 或界面恢复。

## 与 dsh-mnemon 的兼容
- 不修改 mnemon 源码、不覆盖其投影、不删除其记忆消息。
- 识别 mnemon 注入消息使用**来源字段** `message.source.kind === 'dsh-mnemon'`（兼容 `plugin:dsh-mnemon`），不靠文本前缀猜测。
- 统计只按消息来源分类（真实用户 = `source.kind === 'user'`），记忆消息原样保留。

## 配置
配置文件不在插件里，而在运行时 UI 的「设置」标签，保存在数据库 `kv` 表。可配置项：
- 采集开关、观察模式、仅提示不干预
- 10 个分析项开关、12 个阈值
- 价格表（增 / 改 / 删）
- 历史导入、CSV 导出、恢复默认

## 故障排查
| 现象 | 排查 |
|---|---|
| 左栏没有「Token 监控」 | 确认插件条目已启用且 client 半部已构建：`lib/client.js` 存在；设置 → 插件里查看状态 |
| 页面显示"接口返回错误" | 浏览器控制台看 `/token-manager/api/*` 状态；`GET /token-manager/api/health` 查看 DB 可写、最近错误 |
| 数字全是 0 | 确认是「今日 / 本会话 / 本任务」哪个范围；历史累计需先点「导入历史投影缓存」 |
| 费用显示"价格未配置" | 在设置 → 价格表新增对应 provider/model 四桶单价 |
| 导入失败 | 查看 `%DSH_HOME%\storages\session_projcache\sessions` 是否存在；health 的 `lastError` |
| 插件未激活（日志告警） | 查看 DSH 日志中 `[token-manager]` 前缀；本插件失败不会阻断 Harness |

## 工具输出缓存（Phase 2）

- **默认观察模式**：只记录“本可压缩到多少”，模型看到的仍是原文；在 设置 → 工具输出缓存 中切换为「启用自动压缩」才会替换。
- 大于阈值（默认 2KB 起，10KB 选择性摘要，50KB 智能压缩）的工具文本会被保存为本地 blob（内容寻址、SHA-256 校验），模型看到结构化摘要 + Blob ID。
- 摘要覆盖：构建日志、测试输出、JSON、XML、文件列表、ZIP/其他文本；用户消息、系统/开发者消息、mnemon 记忆、提问类工具、错误结果、图片一律不处理。
- 模型需要完整内容时调用 `token_manager_read`（按 blobId 分页读取，或按会话工作目录内的文件路径读取）；原文逐字节可恢复。
- 会话级权限：只能恢复本会话产生的 blob；缓存目录默认上限 512MB / 保留 30 天，可手动一致性检查与清空。
- 失败回退：任何存储/摘要异常都会保留原始工具结果，绝不阻断任务。

### 使用建议
1. 先保持「观察模式」跑几天，在「工具缓存」页看哪些工具输出最大、压缩收益如何；
2. 确认无影响后再切换「启用自动压缩」；
3. 需要核对时，用摘要里的 Blob ID 调 `token_manager_read`，或直接在「工具缓存 → 原文」抽屉里查看。
## 上下文分析（Phase 3，只检测）

- 「上下文分析」标签展示当前 live 会话的**上下文组成**（按角色 / 按来源，`dsh-mnemon` 等来源标为「受保护」）与**重复内容候选**（同一工具输出出现多次）。
- 每个候选给出：可移除 Token、改动位置、会失效的缓存 Token、**KV Cache 风险**（有价格时按“重算缓存成本 vs 移除节省”比较；无价格时用 Token 代理）、建议（推荐/不建议）。
- 「记录本次 dry-run 建议」只把建议写入本地 `optimization_records`（status=proposed、verified=0），**不会修改任何会话**。
- 本阶段没有“应用改写”入口：改写历史前缀会让后缀缓存失效，本机历史中缓存命中占计费 99% 以上，必须先用 A/B 实测证明“更省且不更贵”才会考虑开放。
- 设置页可配置：模式（关闭/仅检测）、最少出现次数、最少节点、最大候选数、风险倍数、缓存读取价格比例。
## 任务与项目管理（Phase 4）

- **任务**：自动任务（每个用户 turn）之外，可手动新建任务、改名、改类型/状态、把多个 turn 合并成一个任务（合并后用量自动汇总），任务详情页有 9 段摘要（本次目标/完成内容/技术决策/修改文件/接口变化/测试结果/未完成事项/下一步/Token 统计）。
- **摘要生成本地完成**：只用已有 usage / 工具调用 / findings 数据推导，不额外调用模型；用户编辑过的字段优先保留。
- **项目摘要**：8 个 section（基本情况/技术架构/数据库结构/关键接口/已完成模块/当前状态/未完成事项/用户限制），版本化保存在本插件目录，可导出 JSON / Markdown；**不会自动写入 dsh-mnemon**。
- **导出**：任务报告 JSON / Markdown / CSV（CSV 带 BOM 与公式注入防护），项目摘要 JSON / Markdown。
## 与 dsh-mnemon 共存（Phase 5 已验证）

- 与 dsh-mnemon 同时启用时互不干扰：mnemon 注入的记忆消息按 `message.source.kind='dsh-mnemon'` 识别并**受保护**，不会被压缩、改写或删除。
- 真实会话已验证：记忆注入 → 工具执行 → 大输出压缩 → 模型调用 → `token_manager_read` 恢复原文全链路正常；Token 统计与官方口径逐字段一致。
- 插件卸载后监听器/路由/工具/UI 全部移除，mnemon 继续正常工作；重新安装后历史数据保留。
- 测试环境：隔离 profile `tm-mnemon`（需按 `docs/PHASE5_TEST_REPORT.md` 配置模型与权限补丁）。
## 版本与阶段
- **Phase 1（已完成）**：只读监控 + 任务成本 + 效率分析 + 仪表盘 + 历史导入。
- **Phase 2（已完成）**：工具输出缓存 / 可逆压缩 / token_manager_read 原文恢复 / 工具缓存页面。
- **Phase 3（已完成）**：上下文组成分析 / 重复内容检测 / KV Cache 风险估算 / dry-run 建议记录。
- **Phase 4（已完成）**：任务新建/改名/合并/状态与类型、9 段任务摘要、8 段项目摘要（版本化）、任务与项目导出。
- **Phase 5（已完成）**：UI 完善（窄屏标签横向滚动 / 溢出收敛）、dsh-mnemon 兼容测试、会话恢复、卸载与重载验证。
- **Phase 6（已完成）**：稳定版交付（发布 zip + SHA-256、安装/配置/故障排查/交付说明、版本记录）。

## 许可
UNLICENSED · 私有项目
© 2026 智睿科技 保留所有权利。