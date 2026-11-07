# AUTO 自动推理与全链路 Token 节省 · 交付报告（v1.4.0）

> 项目：`E:\ZHIRAI Harness\dsh-token-manager`（在原项目上升级，非新建/非重写）
> 日期：2026-11-07（Europe/Berlin）· 构建：`lib/index.js` 2026-11-07 18:44:56（v1.4.0）
> 验收环境：DSH `0.2.2-rc.1` 桌面应用（生产 profile）+ 独立 Web 实例（`tm-auto-web`，端口 62310）+ headless 真实调用 profile（`tm-auto-test`）
> 证据目录：`.verify/auto/runs/`（A–G 原始运行）、`.verify/auto/ui/`（截图 + Lead 现场验证）、`docs/AUTO-TEST-REPORT.md`（逐项测试记录）、`docs/AUTO-COST-COMPARE.md`（成本对比）

---

## 1. 原项目现有 Token 节省能力检查结果（先查再改）

升级前真实状态（`dsh-token-manager` v1.3.3，生产 profile 已安装并运行）：

| 能力 | 升级前状态 | 本次处置 |
|---|---|---|
| 逐调用 Token 台账 | 已有：input/cache_read/cache_write/output、`(session,turn,step,attempt)` 去重、与官方 `tokenUsage` 投影交叉核对 | **保留**，补真实性列 |
| 推理档位记录 | 有列 `reasoning_effort` / `reasoning_tokens`，但 reasoning 恒 NULL，档位只能读请求头 | **增强**：来源标注 + 真实优先级 |
| 工具输出压缩（Phase 2） | 已实现，默认 `observe`；`token_manager_read` 可恢复 | **保留不动**，在其后叠加复用 |
| 上下文分析（Phase 3） | 只检测（dry-run），不修改会话 | **保留**，新增可用的复用与上下文包 |
| 任务/项目摘要（Phase 4） | 已有 9 段任务摘要 + 8 段项目摘要（本地、不调模型） | **复用**为 `token_manager_context` 的数据源 |
| 推理档位控制 | **完全没有**；档位由用户在模型选择器手动选择并持久化 | 本次新增 AUTO（手动模式完整保留） |
| 主/子 Agent 上下文 | 无审计、无量化 | 本次新增子 Agent 审计 + 分层上下文包 |

### 1.1 Harness 模型调用链路（本机实测结论）

- `agent/request` hook **已弃用**：改 provider/model/reasoningEffort 会直接抛错（`use agent.model.select() before step preparation`）。
- 推理档位在 **步骤准备时固定**：`preStep()` 先 `agent.model.current()`，再派发 `agent/pre-step`；因此在 `agent/pre-step` 里 `agent.model.select()` 只影响**下一步**。
- 唯一能在「任务第一步」前改档位的窗口：`agent/inbox/inserted`（emit，同步；在 driver `kick()` 异步 claim 之前）。已用真实调用验证：监听器内同步 `agent.model.select()` → 同一任务第一条 `request/header` 即为新档位。
- 推理档位域：`off | low | high | max`（DeepSeek 适配器自有枚举；`off` 发送 `thinking.type:disabled`，其余发送 `output_config.effort`）。
- **接口限制（实测）**：`dsh-llm-deepseek` 的 `updateUsage()` 只映射 `input/output/cache_read/cache_creation` 四个字段，不映射任何 reason token 字段 → `TokenUsage.reasoningTokens` 恒为 undefined。

## 2. 本次实际修改的文件与功能

### 2.1 新增（Host）

| 文件 | 功能 |
|---|---|
| `src/host/auto-classifier.ts` | 纯函数任务分类（意图/文件/模块/多原因/长度弱信号/子 Agent），输出 taskType + 初始档位 + 置信度 + 原因 |
| `src/host/auto-rules.ts` | 设置收敛、档位阶梯（单步升级/封顶/初始≤low）、环境类失败分类表、推理性失败分类、升级评估 |
| `src/host/auto-scheduler.ts` | AUTO 调度器：inbox 同步 select、pre-step 升级、session/event 证据、手动退出、状态/汇总 |
| `src/host/auto-store.ts` | `auto_decisions` / `auto_sessions` 表、决策查询、AUTO vs 手动汇总 |
| `src/host/auto-api.ts` | `/token-manager/api/auto/*` 六个端点（status/enable/manual/classify/decisions/summary） |
| `src/host/context-reuse.ts` | 同会话完全相同工具结果复用（observe/on，可 `token_manager_read` 恢复） |
| `src/host/subagent-audit.ts` | 子 Agent spawn/fork 审计 + `subagent_fork_history` / `subagent_prompt_oversize` 发现项 |
| `src/host/context-pack.ts` | 分层上下文包 + 模型工具 `token_manager_context` |

### 2.2 修改（Host / Shared / Client / 文档）

- Host：`src/index.ts`（AUTO + 上下文模块装配）、`usage-ledger.ts`（5 个真实性列 + 推理估算）、`cost-calculator.ts`、`report.ts`（`dimensions()` 维度报表）、`analytics.ts`（usage 来源发现项）、`tool-cache.ts`（复用调用点）、`http-api.ts`（`/auto/*` 分发）、`settings-store.ts`、`storage/db.ts`（版本常量）、`shared/{constants,types,contracts}.ts`。
- Client：新增 `auto.tsx`（composer AUTO 控件 + 设置区块 + 成本分析对比/历史），修改 `index.tsx`（slot 注册 `conversation.input.right`）、`api-client.ts`、`settings.tsx`、`overview.tsx`、`report.tsx`、`styles.css`、`locale/{zh,en}.json`。
- 文档：`docs/AUTO-DESIGN.md`、`docs/AUTO-TEST-REPORT.md`、`docs/AUTO-COST-COMPARE.md`、`docs/CONFIG.md`、`CHANGELOG.md`、`README*.md`、`package.json`（1.4.0）。
- 测试：新增 6 个 auto 单测文件 + `ledger-truthfulness`、`context-reuse`、`context-pack`、`subagent-audit` 单测；`scripts/e2e/`（真实运行 harness，不随插件发布）；测试基础设施改为自动汇总模块。
- **未修改 Harness 源码、未修改模型配置、未删除任何原功能**。

### 2.3 UI 视觉精修（用户要求「UI 太丑」，已两轮迭代）

- 设计体系：统一间距刻度 4/8/12/16、圆角 6/8/12、卡片 1px 主题 token 边框 + 轻微 elevation、标题 14px/600、正文 12–13px、主数字 21px 且 `tabular-nums`；全部走宿主 theme token，深/浅色自适应。
- composer AUTO 胶囊：28px 高、品牌色状态点 + 浅色底；菜单卡片化分组（自动 / 手动档位 / 最近决策）+ 当前项高亮 + 键盘可达（Enter/↑↓/Home/End/Esc）。
- 成本分析：4 个指标卡（Token 合计 / 较手动节省或多耗 / 调用数 / 成功率）→ 全宽分组紧凑表（用量 / 效率，数字右对齐，AUTO 列品牌色浅底，估算用小 pill）→ 档位分段条 → 紧凑决策时间线（动作徽标、档位箭头 chip、原因单行省略 + tooltip）。
- 设置页：AUTO 两列紧凑网格（开关 2×2 / 阈值 2×2 / 初始档位一行），控件统一 28px 高；390 单列不换行。
- 总览：4 指标卡 + 档位分段条，不再挤在一屏放全宽表。
- 证据：`.verify/auto/ui/final3-*.png`（深色 1600/897/390 六套 + 浅色 1600 三张，共 21 张）；初版与精修版对照见 `final2-before-after.md`；随仓库发布 4 张截图在 `docs/screenshots/v14-auto-*.png`。

## 3. AUTO 推理调度的真实运行机制

```
用户 prompt → agent.inbox 插入事件（同步）
   ├─ 仅 message.source.kind==='user' 参与分类
   ├─ classifyTask(text) → taskType, 初始档位（simple→off，其余→low，永不 high/max）
   ├─ agent.model.current() 取 provider/model
   └─ agent.model.select({...current, reasoningEffort})  ← 任务第一条请求即生效
        ↓
agent/pre-step（每个步骤，waterfall，await next() 后原样返回 decision）
   ├─ 读取累积证据（写文件数/只读文件数/失败分类/步骤/验证命令）
   ├─ evaluateEscalation()
   │    ├─ 环境类失败 → hold（禁止升级，只记录 failureKinds）
   │    ├─ 推理性证据 → 升一档（OFF→LOW→HIGH→MAX，单任务≤3 次，一次一档）
   │    └─ 无新证据 → 不写库
   └─ 升级时 agent.model.select() → 从下一步生效
        ↓
session/event（同步、低开销、异常全部吞掉）
   ├─ tool/call、tool/result（错误文本分类、callId 去重）、step、turn/start、turn/end
   ├─ 外部 model/selection（非调度器写入）→ manual-exit：该会话 manual + AUTO 全局关闭
   └─ request/header 供统计标注 effort_source='auto'
```

- **状态隔离**：每个新用户 turn 重新分类（新任务不继承上一任务档位）；steer 中途消息不降档、仅允许按复杂度升一档。
- **轻量**：全部决策为本地规则 + 已有事件，不额外调用模型（`/auto/classify` 也是纯函数）。
- **可观察**：每次决策写 `auto_decisions`（原因/证据/是否生效），UI「最近 AUTO 决策」与 `/auto/decisions` 可查。
- **安全开关**：`settings.auto.enabled=false`（默认）时完全静默；`monitorOnly` 只记录不生效；任何异常只记 `last_error`，不阻断任务。

## 4. 各档位自动选择与升级的测试结果（真实 DeepSeek 调用）

> 详细原始行见 `docs/AUTO-TEST-REPORT.md` 与 `.verify/auto/runs/`；此处为最终结论。

| 用例 | 任务 | 期望 | 实测结论（final，100 断言 0 失败） | 证据 |
|---|---|---|---|---|
| A 简单 | 改按钮颜色（`index.html`） | 初始 OFF，不升级 | **PASS 18/18**：simple-edit → off；6 请求全 off；`effort_source=auto` | `runs/auto-final/A/` |
| B 普通 | 新增 formatCurrency 函数 | 初始 LOW，无失败不升级 | **PASS 17/17**：normal-dev → low；重复运行 b2 9 请求全 low；首次样本因模型自测 2 次真实失败升 high（记录两样本） | `runs/auto-final/B/`、`auto-final-b2/` |
| C 复杂 | 3 文件联动 bug | LOW 起步，按证据升 HIGH（必要时 MAX） | **PASS 19/19**：low → high（只读 7 文件 ≥5）→ max（已改 3 文件）；3 文件修复 + 独立行为探针通过 | `runs/auto-final/C/` |
| D 非推理失败 | 坏路径/缺依赖/缺命令 | 不因失败升级 | **PASS 16/16 + D1/D2/D3 各 16/16**：4 行 hold，failureKinds 含 fs-not-found / missing-module / command-not-found；无 escalate；10 请求全 low | `runs/auto-final-env/` |
| E 任务切换 | 先复杂任务（升到 max），同一会话再简单任务 | 第二个任务重新判断回 OFF | **PASS 15/15**：turn1 low→high→max；turn2 resume 重新 classify simple-edit→off，turn2 全 off | `runs/auto-final/E/` |
| F 上下文 | 主 Agent 委派子 Agent | 子 Agent 只拿必要上下文 | **PASS 15/15**：2×fresh spawn `subagent_runs{provider:spawn, inherits_context:0, prompt_bytes≈1.1KB}`；子会话首请求 input≈5.9k（远小于主会话），独立计费 | `runs/auto-final/F/` |
| G Token 统计 | 每次请求 | 输入/输出/推理/缓存/档位/费用来源真实 | **PASS 12/12**：usage_basis=api 70/70、total=四桶和 70/70、DB↔会话日志 70/70 一致；reasoning_tokens 全 NULL（不伪造）、reasoning_source=null/estimated；effort_source 全 auto | `runs/auto-final/G/` |

### 4.1 逐级升级与「不直接 HIGH」证据

- C3 决策序列：`classify low` → step4 `escalate low→high`（只读分析 6 文件 ≥5）→ step6 `escalate high→max`（已写文件 3 个 ≥3）。
- 每次 `request/header` 与决策严格对应（决策发生在 step S 的 pre-step → step S+1 首个请求使用新档位）。
- 测试 E 中复杂任务一度升到 MAX，随后简单任务仍从 **OFF** 开始 —— 证明 AUTO 控制的是「每次请求」而不是永久会话档位。

## 5. Agent 上下文传递优化结果

### 5.1 检查结论（真实运行）

- DSH 子 Agent 有两种语义：`spawn`=fresh（不继承父对话，仅收委派 prompt）、`fork`=继承已完成轮次的历史快照。
- 本机 Agent Team（`spawn_teammate` 默认 fresh）实测：子会话首次请求 input=5898 tokens（主会话 6 位数），`sessions.is_subagent=1`、`parent_session_id` 正确 —— **fresh 路径本来就不传完整历史**。
- `fork` 会继承父历史：审计表 `subagent_runs` 记录 `inherits_context=1` 并产出 `subagent_fork_history` 发现项（warn），提示「独立子任务建议 spawn + 任务包」。
- 插件无法也不应删除 Harness 管理的 fork 历史；本次通过**审计 + 量化 + 替代方案**解决浪费。

### 5.2 本次实现的上下文节省机制

1. **`token_manager_context`**（模型可见工具）：按需返回分层最小上下文包（项目摘要 8 段 + 任务摘要 9 段 + 最近决策 + 最近变更文件），受字符预算约束（默认 6000 字符）、显式标注省略与估算 token。真实调用返回 953 字符 ≈239 tokens（vs 粘贴完整历史）。
2. **上下文复用**：同会话完全相同的工具结果第二次起替换为含 `Blob ID` 的引用；`observe` 记录候选，`on` 真实替换。实测同一 read 结果 1715B → 引用后节省约 1317B，模型能读懂引用并正确完成任务。
3. **子 Agent 审计**：`subagent_runs` 表 + 两类发现项，让「fork 继承历史」「委派 prompt 过大」可见、可度量。
4. **工具调用去重**：与已有压缩链叠加（先压缩后复用），重复读取同一文件不再重复把全文塞进上下文。

## 6. Token 使用量对比（真实运行，同一组 A–D 任务）

被测构建：`lib/index.js` 18:47:02（sha256 `66f5163d57e80a0a5da705aa4a8ec39b678edb427c2e66a197ada656fcfd5206`），均为真实 DeepSeek 调用，sandbox=danger-full-access（=生产桌面策略）。

### 6.1 手动 LOW / 手动 HIGH vs AUTO（A–D 四个同任务）

| 指标 | 手动 LOW | 手动 HIGH | AUTO | AUTO vs HIGH |
|---|---|---|---|---|
| 请求数 | 37 | 51 | 37 | −27.5% |
| 未命中输入 | 26,234 | 48,685 | 44,228 | −9.2% |
| 缓存命中 | 517,760 | 984,448 | 565,120 | −42.6% |
| 输出 | 10,602 | 30,636 | 11,275 | −63.2% |
| 推理（估算） | 3,763 | 16,744 | 4,830 | −71.2% |
| 合计 Token | 554,596 | 1,063,769 | 620,623 | **−41.7%** |
| 费用估算 | ¥0.3962 | ¥0.8347 | ¥0.4612 | **−44.7%** |
| 耗时 | 143.6s | 271.0s | 123.5s | **−54.4%** |
| 成功率 | 4/4 | 4/4 | 4/4 | — |

> 解读（如实）：AUTO 与手动 HIGH 质量相同（4/4 成功）但省 **41.7% Token / 44.7% 费用 / 54.4% 时间**；AUTO 比一律 LOW 多花约 12% Token —— 这是它只在复杂任务（C）真正升级到 HIGH/MAX 的代价，换来的是复杂任务的质量余量（LOW 在本批也 4/4 成功，但模型 TDD 路径波动会推高请求数，见 B）。

### 6.2 错升档代价（用例 D：环境失败任务，不该升推理）

| 变体 | 请求数 | 合计 Token | 费用 | 耗时 | 档位 |
|---|---|---|---|---|---|
| 手动 LOW | 11 | 161,375 | ¥0.1179 | 39.8s | low |
| 手动 HIGH（错用深度推理） | 24 | 617,106 | ¥0.5047 | 171.9s | high |
| **AUTO** | **10** | **147,417** | **¥0.1128** | **39.1s** | low + hold×4（环境失败禁止升级） |

> AUTO 比「环境失败却用 HIGH 硬推」省 **76.1% Token / 77.7% 费用 / 77.3% 耗时**，且比手动 LOW 还省 8.6%（更少无效重试）。

### 6.3 分用例档位序列（真实 request/header + auto_decisions）

| 用例 | 请求数 | Token 合计 | 费用 | 档位序列 |
|---|---|---|---|---|
| A 简单 | 6 | 74,464 | ¥0.0457 | off（全程） |
| B 普通 | 16 | 327,260 | ¥0.2364 | low →（2 次真实测试失败）high |
| C 复杂 | 5 | 71,482 | ¥0.0663 | low → high（只读 7 文件）→ max（已改 3 文件） |
| D 环境失败 | 10 | 147,417 | ¥0.1128 | low + 4 次 hold（三种 failureKind），无升级 |
| E 任务切换 | 11 | 161,775 | ¥0.1196 | turn1 low→high→max；turn2 重新 off |
| F 子 Agent | 22 | 313,003 | ¥0.2554 | 主/子会话独立计费；spawn 不继承历史 |
| G 统计 | 70 条请求核对 | — | — | usage_basis=api 70/70、DB↔日志 70/70 一致 |

> 费用为内置参考价估算（非实时账单）；推理 token 为估算值（API 不返回）。

## 7. 真实运行测试记录（可复现）

- **真实调用方式**：`dsh --profile tm-auto-test "<任务>"`（该 profile 由 headless 模板生成并启用 credentials/authorization/deepseek-account，真实调用 DeepSeek `deepseek-account/deepseek-flash`，单次 5–90s）；插件数据目录每次隔离（`DSH_TOKEN_MANAGER_DATA_DIR`），不污染生产库。
- **AUTO 开启方式**：隔离 DB 预写 `settings.auto.enabled=true`（插件每次决策重新读 settings，非 boot 缓存，已实测）。
- **证据形态**：`.verify/auto/runs/<stamp>/<case>/` 含 `meta/stdout/stderr/db/session/diff/metrics/checks.json`；`auto_decisions` 原始行、`request/header` effort 序列、`usage_records` 行。
- **GUI 验收**：独立 Web 实例 `http://127.0.0.1:62310`（web 模板 + 真实账号路由 + 插件 junction），Playwright MCP 真实操作与截图（1600/897/390），见 `.verify/auto/ui/`。
  - 交互验收（verifier）：15 张 `lead-*.png`（总览 AUTO 面板 / composer chip 与菜单 / 成本分析对比 / 设置页，且实测点击启用 AUTO）。
  - 视觉终版（ui-auto）：21 张 `final3-*.png`（深色 1600/897/390 六套 + 浅色 1600 三张）；随仓库发布 4 张在 `docs/screenshots/v14-auto-*.png`。
- **生产桌面应用**：通过 HMR 热重载加载 final 构建（`lib/index.js` sha256 `66f5163d…d5206`、`plugin_version=1.4.0`、`apiReady=true`、无新错误、5 张新表齐全、`token_manager_context` 工具可用）；未重启用户应用、未改生产 profile 配置（临时探测行已还原）。客户端新界面在用户下次刷新/重启界面时生效。
- **单测/构建**：`npx tsc --noEmit` 0 error；`node --test "tests/unit/*.test.mjs"` = **348 pass / 0 fail**；`node scripts/build.mjs` 双半通过。

## 8. 尚未实现或受模型接口限制的功能（如实记录）

1. **推理 Token 无法从 API 取真实值**：本构建 DeepSeek 适配器不映射任何 reasoning token 字段，`reasoning_tokens` 恒为 NULL；插件用 reasoning 内容块字节/4 估算并标 `reasoning_source='estimated'`，**估算值不参与计费**，报表显式提示。`output_tokens` 是否包含推理由上游决定，插件不推断。
2. **AUTO 的「下一步生效」窗口**：任务中升级只能从下一步起效（Harness 的 selection 在步骤准备时固定）；任务第一步依赖 `agent/inbox/inserted` 的同步时序，已在真实调用中复核，但若未来 Harness 改变该顺序需重新确认（代码有降级：无法 select 时记录 skip，不影响任务）。
3. **fork 历史无法删除**：fork 子 Agent 继承的父历史由 Harness 管理，插件只能审计与提示；「子 Agent 只拿必要上下文」在 fresh spawn 下天然成立，fork 需用户/模型选择 spawn。
4. **成功率的定义**：以 turn 完成/失败/中止统计，不等同于「任务质量评价」；质量以测试用例的行为断言（文件内容/diff/命令结果）为准，未做人工主观评分。
5. **价格**：默认参考价为公开列表价，非实时账单；未配置价格时费用为 null（不伪造）。
6. **上下文复用默认 `observe`**：为避免改变模型可见内容，默认只观察；`on` 模式已用真实任务验证正确性，但作为保守交付默认未开启（可在设置中开启）。
7. **AUTO 决策为规则式**：不走模型辅助分类（满足「轻量、不额外调用昂贵模型」），因此对极其模糊的任务文本可能分类偏保守（从 LOW 起步、靠证据升级，不会误用 HIGH/MAX）。

---

## 附录 · 证据索引

- `docs/AUTO-DESIGN.md`：架构基线与契约
- `docs/AUTO-TEST-REPORT.md`：A–G 逐项命令/原始输出/DB 行/结论
- `docs/AUTO-COST-COMPARE.md`：成本对比表
- `.verify/auto/runs/`：原始运行证据
- `.verify/auto/ui/`：GUI 截图 + `lead-api-verification.md`
- `docs/CONFIG.md §7/§8`：AUTO 与上下文优化配置说明
- `CHANGELOG.md`：v1.4.0 变更记录
