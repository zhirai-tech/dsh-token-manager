# AUTO 真实运行验收报告（A–G）

> 项目：`E:\ZHIRAI Harness\dsh-token-manager` · 验证人：verifier · 采集时间：2026-11-07（Europe/Berlin）
> 设计基线：`docs/AUTO-DESIGN.md` v1.4.0（§0.4 环境 / §5 测试矩阵 / §6 验收口径）
> 口径：**只认真实运行证据**（真实 `dsh --profile tm-auto-test` 调用 + 插件 SQLite 行 + DSH 会话日志 + 浏览器截图）。
> 未执行、未通过、受接口限制的项目在本报告如实标注，不用静态检查代替运行验收。

---

## 0. 结论摘要

**最终 A–G 全部通过：`stamp=final` 共 100 条断言 pass / 0 fail / 0 pending，G 12/12。**
被测构建：`lib/index.js` **2026-11-07 18:47:02**（522,141 B，sha256 `66f5163d57e80a0a5da705aa4a8ec39b678edb427c2e66a197ada656fcfd5206`），
运行窗口 2026-11-07T17:48:11Z–17:51:28Z（本地 18:48–18:51），批次开始/结束 `lib/index.js` sha 一致（无中途重建）。

| 用例 | 结果 | 关键档位证据 |
|---|---|---|
| A 简单（改按钮颜色） | **PASS 18/18** | classify `simple-edit → off`；`request/header` 仅 initial=off；6 请求全 off |
| B 普通（新增函数） | **PASS 17/17** | classify `normal-dev → low`；本批因 2 次真实测试失败升级 high（另一次重复运行全 low，见 §3.B.3） |
| C 复杂（3 文件联动） | **PASS 19/19** | `low → high`（只读分析 7 文件≥5）→ `max`（已改 3 文件≥3）；3 文件全部修复，独立行为断言通过 |
| D 环境失败（禁止升级） | **PASS 16/16** | 5 行决策：classify low + 4 行 hold（`fs-not-found`/`missing-module`/`command-not-found`），无 escalate，10 请求全 low |
| D1/D2/D3 环境失败分型 | **PASS 16/16 ×3** | 各自单行 hold：`fs-not-found` / `missing-module` / `command-not-found`，均无 escalate |
| E 任务切换 | **PASS 15/15** | turn1 `low→high→max`；turn2 resume 重新 classify `simple-edit → off`，turn2 全部请求 off |
| F 子 Agent（fresh spawn） | **PASS 15/15** | 2 个子会话 + `subagent_runs`：`provider=spawn, inherits_context=0, prompt_bytes≈1.7KB`，独立计费 |
| G Token 统计 | **PASS 12/12** | 70 条最终请求：`usage_basis=api`、`total=四桶和`、`reasoning_tokens=NULL`、DB↔会话日志 70/70 一致 |

**成本对照（A–D 四题，真值 token + 估算费用）**：AUTO 合计 620,623 tokens / ¥0.4612 / 123.5s，手动 HIGH 1,063,769 / ¥0.8347 / 271.0s
→ **AUTO 省 41.7% tokens、44.7% 费用、54.4% 耗时**；手动 LOW 554,596 / ¥0.3962 / 143.6s。
典型收益：A 简单任务 AUTO 仅为手动 HIGH 的 36% tokens；D 环境失败 AUTO 比“手动 HIGH 错用高档”省 76% tokens（详见 `docs/AUTO-COST-COMPARE.md`）。

**验收中发现并已修复的 5 个真实问题**（§6）：`usage_records` 新列迁移缺失、环境失败误判 `unknown`、只读文件计入升级规则、`context-pack.init` 缺 import、验证脚本自身 3 处 bug。

---

## 1. 验收环境与方法

### 1.1 环境

| 项目 | 实测值 |
|---|---|
| DSH 版本 | `0.2.2-rc.1`（Electron 桌面 Harness CLI） |
| 测试 profile | `tm-auto-test`（headless 模板 + 重新启用 credentials/authorization/deepseek-account） |
| 模型 | `deepseek-account / deepseek-flash`（`reasoningEffort` 由 AUTO 决策 / profile 决定） |
| 插件加载 | `%DSH_HOME%/profiles/tm-auto-test/node_modules/dsh-token-manager` → 工作区 junction；`node scripts/build.mjs` 后新进程生效 |
| 插件数据隔离 | 每次运行独立 `DSH_TOKEN_MANAGER_DATA_DIR=C:\Users\Administrator\.dsh\tm-e2e\<variant>-<case>-<stamp>\data` |
| 会话日志 | `%DSH_HOME%/sessions/<project>/<sessionId>/session.v4.jsonl.zstd` |
| 沙箱 | `DSH_PERMISSION_MODE=danger-full-access`（= 生产桌面会话策略；默认 `workspace-write` 的差异见 §1.3） |

### 1.2 执行链路（可复现）

```powershell
cd "E:\ZHIRAI Harness\dsh-token-manager"
node scripts/build.mjs                                   # 构建当前源码
node scripts/e2e/probe.mjs                               # 环境自检（零成本）
node scripts/e2e/run-case.mjs --all --stamp final        # A–G 全矩阵（本次最终证据）
node scripts/e2e/run-case.mjs --cases D1,D2,D3 --stamp final-env   # 环境失败分型
node scripts/e2e/run-case.mjs --variant manual-low  --cases A,B,C,D --stamp low3
node scripts/e2e/run-case.mjs --variant manual-high --cases A,B,C,D --stamp high2
node scripts/e2e/compare.mjs
```

每个用例：复制 fixture 到临时工作区（记录修改前哈希）→ 预写隔离 DB `settings.auto.enabled`（仅 AUTO 变体）→ 起独立 `dsh` 子进程（不经 shell，中文原样传参）→ 读插件 DB + DSH 会话日志 → 执行用例断言 → 落证据（含 `lib/index.js` 构建 sha，批次前后不一致会警告）。

### 1.3 沙箱模式差异（如实记录）

- 默认 `workspace-write` 下，模型在会话里跑 `npm test`（`node --test` 通过管道 spawn 子进程）会得到 `spawn EPERM`（DSH Windows 沙箱限制），属**环境类失败**，会干扰“复杂任务应升档”的判定。首轮证据 `manual-low-b1/C` 出现过。
- 生产桌面会话实际文件策略为 `danger-full-access`，故 e2e 默认 `--sandbox-mode danger-full-access`；该差异不影响 AUTO 规则本身，但影响模型能否正常跑测试。

### 1.4 证据目录

| 内容 | 路径 |
|---|---|
| 最终 A–G | `.verify/auto/runs/auto-final/<case>/{meta,stdout,stderr,db,session,diff,metrics,checks}.json` + `.verify/auto/logs/auto-<case>-final.log` |
| D1–D3 | `.verify/auto/runs/auto-final-env/` |
| B 重复 | `.verify/auto/runs/auto-final-b2/` |
| 基线 LOW/HIGH | `.verify/auto/runs/manual-low-low3/`、`.verify/auto/runs/manual-high-high2/` |
| 对比 | `.verify/auto/compare-20261107-190030.md`（三列对比，AUTO 列含 E/F）、`docs/AUTO-COST-COMPARE.md` |
| GUI | `.verify/auto/ui/lead-*.png` |
| 临时 DB/工作区 | `C:\Users\Administrator\.dsh\tm-e2e\<variant>-<case>-<stamp>\` |

---

## 2. 基线：现有插件手动档位（A–D×LOW/HIGH，真实运行）

> token 为插件 ledger 记录的 **API 真值**；费用为**估算**（内置参考价 deepseek-flash：输入 ¥2 / 缓存命中 ¥0.5 / 输出 ¥8 每百万 tokens，CNY）。

### 2.1 手动 LOW（`manual-low-low3`）

> 批次期间发生过重建：A=`c0391c7c…`、B/C=`244480ca…`、D=`7059b1e8…`（每用例 `meta.json` 有记录）。手动档位不依赖 AUTO 代码，token 口径不受影响；final 批次同一构建内完成。

| 用例 | 请求数 | 输入(未命中) | 缓存命中 | 输出 | 合计 tokens | 费用估算 | 耗时 | 成功率 |
|---|---|---|---|---|---|---|---|---|
| A | 11 | 8,348 | 141,184 | 1,984 | 151,516 | ¥0.1032 | 50.2s | 1/1 |
| B | 8 | 6,614 | 124,672 | 2,163 | 133,449 | ¥0.0929 | 25.7s | 1/1 |
| C | 7 | 6,480 | 99,328 | 2,448 | 108,256 | ¥0.0822 | 27.9s | 1/1 |
| D | 11 | 4,792 | 152,576 | 4,007 | 161,375 | ¥0.1179 | 39.8s | 1/1 |
| **合计** | **37** | **26,234** | **517,760** | **10,602** | **554,596** | **¥0.3962** | **143.6s** | **4/4** |

### 2.2 手动 HIGH（`manual-high-high2`）

> 批次期间发生过重建：A/B=`7059b1e8…`、C=`2a1478b8…`、D=`3025240a…`（每用例 `meta.json` 有记录）。

| 用例 | 请求数 | 输入(未命中) | 缓存命中 | 输出 | 合计 tokens | 费用估算 | 耗时 | 成功率 |
|---|---|---|---|---|---|---|---|---|
| A | 12 | 12,391 | 188,672 | 3,699 | 204,762 | ¥0.1487 | 45.7s | 1/1 |
| B | 9 | 10,018 | 129,792 | 2,255 | 142,065 | ¥0.1030 | 27.7s | 1/1 |
| C | 6 | 6,623 | 90,752 | 2,461 | 99,836 | ¥0.0783 | 25.7s | 1/1 |
| D | 24 | 19,653 | 575,232 | 22,221 | 617,106 | ¥0.5047 | 171.9s | 1/1 |
| **合计** | **51** | **48,685** | **984,448** | **30,636** | **1,063,769** | **¥0.8347** | **271.0s** | **4/4** |

**基线结论**：同样 4 道任务，手动 HIGH 比 LOW 多 **91.8% tokens、110.7% 费用、88.7% 耗时**，成功率相同（4/4）。
**D 的“错升档代价”样本**：同一环境失败任务，手动 HIGH 24 请求 / 617,106 tokens / ¥0.5047 / 171.9s；手动 LOW 11 请求 / 161,375 / ¥0.1179 / 39.8s。

---

## 3. A–G 逐项结果（`auto-final`，构建 18:47:02）

> 每项给出：fixture、任务、命令、`auto_decisions` 原始行、`request/header` 实际档位、`usage_records` 关键列、结论。
> 完整原始输出见证据目录；以下 JSON 均为真实落库行（长行做了截断/换行，未改数值）。

### 3.0 汇总

| 用例 | checks | 请求数 | 输入 | 缓存命中 | 输出 | 合计 tokens | 费用估算 | 耗时 | 档位序列 |
|---|---|---|---|---|---|---|---|---|---|
| A | 18/18 pass | 6 | 2,705 | 71,168 | 591 | 74,464 | ¥0.0457 | 14.1s | off |
| B | 17/17 pass | 16 | 24,152 | 298,240 | 4,868 | 327,260 | ¥0.2364 | 53.5s | low→high |
| C | 19/19 pass | 5 | 13,215 | 56,832 | 1,435 | 71,482 | ¥0.0663 | 16.9s | low→high→max |
| D | 16/16 pass | 10 | 4,156 | 138,880 | 4,381 | 147,417 | ¥0.1128 | 39.1s | low（hold×4） |
| E | 15/15 pass | 11 | 16,724 | 143,232 | 1,819 | 161,775 | ¥0.1196 | 29.9s | turn1 low→high→max；turn2 off |
| F | 15/15 pass | 22 | 28,215 | 277,248 | 7,540 | 313,003 | ¥0.2554 | 42.3s | 主 low→high；子 low |
| **G** | **12/12 pass** | 70 条最终请求 | — | — | — | — | — | — | 全部可核对 |

### 3.A 简单任务（A）

- fixture：`scripts/e2e/fixtures/simple-ui`（`styles.css` 按钮 `#ff0000`）；任务：`把按钮颜色改成 #2563eb`
- 命令：`node scripts/e2e/run-case.mjs --cases A --stamp final`（本项由 `--all` 执行）
- `auto_decisions` 原始行：
  ```json
  {"id":1,"step":0,"turn":1,"task_type":"simple-edit","from_effort":"low","to_effort":"off","stage":0,"action":"classify","applied":1,
   "reasons":"[\"关键词：颜色、按钮\",\"短文本单句\",\"简单 UI/文字/查询意图\"]",
   "evidence":"{\"files\":[],\"tools\":[],\"failures\":0,\"environmentFailures\":0,\"reasoningFailures\":0,\"failureKinds\":[],\"steps\":0,\"signals\":[]}"}
  ```
- `request/header`：只有 1 条 `reason:"initial"`、`reasoningEffort:"off"`（无 change）。
- `usage_records`（6 条最终请求）：如 step1 `reasoning_effort=off, effort_source=auto, usage_basis=api, input_tokens=1106, cache_read_tokens=10496, output_tokens=80, total_tokens=11682, reasoning_tokens=NULL`；全部 6 条 effort=off。
- 文件结果：`diff.changed=["styles.css"]`，`.btn` 背景已改为 `#2563eb`（断言通过）。
- **结论：PASS 18/18**。AUTO 初始 off、全程不升档，与 §5 A 预期一致。

### 3.B 普通任务（B）

- fixture：`normal-feature`（新增 `formatCurrency` + 测试）；任务：`在 src/index.mjs 中新增并导出函数 formatCurrency(amount)…并运行 npm test`
- `auto_decisions`：
  ```json
  {"step":0,"task_type":"normal-dev","from":"low","to":"low","stage":0,"action":"classify","applied":1,
   "reasons":"[\"关键词：新增、函数、导出\",\"提及 1 个文件\"]"}
  {"step":13,"task_type":"normal-dev","from":"low","to":"high","stage":1,"action":"escalate","applied":1,
   "reasons":"[\"推理性失败 2 次 ≥ 阈值 2\"]",
   "evidence":"{\"files\":[\"test/utils.test.mjs\",\"src/index.mjs\"],\"failures\":2,\"environmentFailures\":0,\"reasoningFailures\":2,\"failureKinds\":[\"test-failure\",\"assertion\"],\"signals\":[\"reason:test-failure\",\"failed-command:npm test\",\"reason:assertion\"]}"}
  ```
- `request/header`：`initial low`（step1）→ `change high`（step14）。
- `usage`：step1–13 `low/auto`，step14–16 `high/auto`；`formatCurrency` 行为探针 + `node --test` 全部通过。
- **结论：PASS 17/17**。初始 low 正确；升级由真实测试失败触发（模型本轮走了 TDD：先写测试→失败 2 次→修复），符合“只有推理性失败才升级”的规则。
- **3.B.3 重复运行**（`auto-final-b2`，同构建、同 fixture/任务）：classify `normal-dev/low`，无任何 escalate，9 请求全部 low，150,574 tokens / ¥0.1270 / 32.9s，PASS。
  → 说明 B 首轮的升级是**模型执行路径波动**（TDD 自证失败触发规则），不是 AUTO 对 B 类任务的系统性误升级；两次样本都如实保留。

### 3.C 复杂任务（C）

- fixture：`complex-bug`（3 个独立 bug：`constants.mjs` 税率 13→0.13、`format.mjs` 缺 `toFixed(2)`、`OrderCard.mjs` 金额多出“（含税）”后缀；`node --test` 初始 3 失败）
- 任务：`运行 npm test，定位并修复全部测试失败…（三文件联动，修完再跑直到全过）`
- `auto_decisions` 原始行：
  ```json
  {"step":0,"task_type":"complex-dev","from":"low","to":"low","action":"classify","applied":1,
   "reasons":"[\"关键词：component、修复、定位、失败\",\"提及 3 个文件\",\"命中架构/重构/多模块关键词\"]"}
  {"step":3,"task_type":"complex-dev","from":"low","to":"high","stage":1,"action":"escalate","applied":1,
   "reasons":"[\"只读分析 7 个文件 ≥ 5（complex-dev，无环境失败）\"]",
   "evidence":"{\"files\":[],\"tools\":[\"pwsh\",\"read\"],\"failures\":1,\"environmentFailures\":0,\"reasoningFailures\":1,\"failureKinds\":[\"assertion\"],\"signals\":[\"reason:assertion\",\"failed-command:...npm test 2>&1\"]}"}
  {"step":4,"task_type":"complex-dev","from":"high","to":"max","stage":2,"action":"escalate","applied":1,
   "reasons":"[\"已修改文件 3 个 ≥ 3（complex-dev）\"]",
   "evidence":"{\"files\":[\".../src/shared/constants.mjs\",\".../src/utils/format.mjs\",\".../src/components/OrderCard.mjs\"],...}"}
  {"step":5,"from":"max","to":"max","stage":2,"action":"hold","applied":0,"reasons":"[\"已是最高档位\"]"}
  ```
- `request/header`：`initial low`（step1）→ `change high`（step4）→ `change max`（step5）。
- `usage`：step1–3 low，step4 high，step5 max；全部 `effort_source=auto, usage_basis=api`。
- 文件结果：`diff.changed=["src/components/OrderCard.mjs","src/shared/constants.mjs","src/utils/format.mjs"]`；`node --test` 全过 + 三种行为的独立 node 探针（不经测试文件）通过。
- **结论：PASS 19/19**。初始 low、按证据逐级升档、一次一档、到 max 后 hold，符合 §5 C 预期（“必要时 max”）。

### 3.D 环境类失败（单一 fixture，多 kind）

- fixture：`env-failure`（缺 `config/app.json`、缺依赖 `absent-dependency-xyz`、缺命令 `missing-cli.exe`、缺 `dist/release`；4 个文件，避免只读文件规则干扰）
- 任务：`按 RUNBOOK.md 执行全部步骤…每条命令必须直接运行，不要用 try/catch/$LASTEXITCODE 改写退出码；不要修改任何文件`
- `auto_decisions` 原始行（classify + 4 行 hold，无 escalate）：
  ```json
  {"step":0,"task_type":"troubleshoot","from":"low","to":"low","action":"classify","applied":1,
   "reasons":"[\"关键词：改写、报错、report\",\"提及 2 个文件\",\"命中排查/bug/报错关键词\"]"}
  {"step":5,"from":"low","to":"low","action":"hold","applied":0,"reasons":"[\"环境类失败禁止升级：fs-not-found\"]",
   "evidence":"{\"failures\":1,\"environmentFailures\":1,\"reasoningFailures\":0,\"failureKinds\":[\"fs-not-found\"],\"signals\":[\"env:fs-not-found\"],\"steps\":5}"}
  {"step":6,"reasons":"[\"环境类失败禁止升级：fs-not-found\"]","evidence":"failureKinds=[\"fs-not-found\"], failures=2"}
  {"step":7,"reasons":"[\"环境类失败禁止升级：fs-not-found, missing-module\"]","evidence":"failureKinds=[\"fs-not-found\",\"missing-module\"], failures=3"}
  {"step":8,"reasons":"[\"环境类失败禁止升级：fs-not-found, missing-module, command-not-found\"]","evidence":"failureKinds=[...三种...], failures=4"}
  ```
- `request/header`：只有 1 条 `initial low`；10 条 usage 全部 `low/auto`。
- 文件结果：只新增 `REPORT.md`（模型未改 fixture，如实报告环境错误）。
- **结论：PASS 16/16**。三种环境 kind 全部识别、全部 hold、无升级，符合 §5 D 预期。

#### 3.D.1–D.3 环境失败分型（`final-env`，同一构建）

| 用例 | fixture | 任务 | classify | hold 行（reasons / failureKinds） | 请求数 | 结论 |
|---|---|---|---|---|---|---|
| D1 | `env-d1-fs-not-found` | 读取 `config/app.json` 的 theme.color | `troubleshoot/low` | `环境类失败禁止升级：fs-not-found` / `["fs-not-found"]` | 7 | PASS 16/16，无 escalate |
| D2 | `env-d2-missing-module` | 运行 `node scripts/build.mjs` | `troubleshoot/low` | `环境类失败禁止升级：missing-module` ×2 / `["missing-module"]` | 7 | PASS 16/16，无 escalate |
| D3 | `env-d3-command-not-found` | 运行 `scripts/deploy.ps1` | `troubleshoot/low` | `环境类失败禁止升级：command-not-found` / `["command-not-found"]` | 5 | PASS 16/16，无 escalate |

证据：`.verify/auto/runs/auto-final-env/{D1,D2,D3}/db.json`。

### 3.E 任务切换（E）

- 阶段 1：与 C 相同的复杂任务；阶段 2：`dsh --session-id <sessionId> --json "把 README.md 的第一行标题改成 # 订单模块"`（同会话续跑）
- `auto_decisions`（turn1 + turn2）：
  ```json
  {"turn":1,"step":0,"task_type":"complex-dev","from":"low","to":"low","action":"classify","applied":1}
  {"turn":1,"step":3,"from":"low","to":"high","stage":1,"action":"escalate","reasons":"[\"只读分析 5 个文件 ≥ 5（complex-dev，无环境失败）\"]"}
  {"turn":1,"step":5,"from":"high","to":"max","stage":2,"action":"escalate","reasons":"[\"已修改文件 3 个 ≥ 3（complex-dev）\"]"}
  {"turn":2,"step":0,"task_type":"simple-edit","from":"low","to":"off","stage":0,"action":"classify","applied":1,
   "reasons":"[\"关键词：标题、模块\",\"提及 1 个文件\",\"短文本单句\",\"简单 UI/文字/查询意图\"]"}
  ```
- `request/header`：`initial low` → `change high` → `change max`（turn1）→ **`reason:"resume"`, effort=off**（turn2 step1）。
- `usage`：turn2 的 5 条最终请求全部 `effort=off/auto`；README 标题已修改。
- **结论：PASS 15/15**。新任务重新分类为 off，不继承上一任务 max，符合 §5 E 预期。

### 3.F 子 Agent / 上下文（F）

- fixture：`complex-bug`；任务：`使用 subagent 工具（context=fresh）分别让两个子 Agent 阅读并总结 constants.mjs 与 format.mjs，汇总写入 REPORT.md`
- 证据（`db.json` / `session.json` / `auto-final/F`）：
  - `sessions`：主会话 1 个 + 子会话 2 个（`is_subagent=1`、`parent_session_id` 指向主会话、`origin="subagent"`）；
  - `subagent_runs`（token-context 审计表）2 行，示例（final 原始行）：
    ```json
    {"run_id":"c80bbd59-45c0-4a0d-91db-e83c88693ab0","provider":"spawn","inherits_context":0,"local":1,"seeded":0,"delegation_depth":1,
     "child_session_id":"defcb973-7706-4cf5-b2fe-b20bfae195f7","parent_session_id":"session-e30ab28b-f3f9-4b82-b3f0-6c53450cb861",
     "prompt_bytes":1734,"prompt_tokens_estimated":434,"seed_tokens_estimated":null,"calls":5,
     "input_tokens":15660,"output_tokens":1535,"cache_read_tokens":49792,"cache_write_tokens":0,"reasoning_tokens":null,"stop_reason":"completed"}
    {"run_id":"1cfb41fc-…","provider":"spawn","inherits_context":0,"prompt_bytes":1730,"prompt_tokens_estimated":433,"calls":6,
     "input_tokens":7536,"output_tokens":2062,"cache_read_tokens":71936,"stop_reason":"completed"}
    ```
  - 子会话首个请求 input ≈5.9k tokens（fresh 只收任务包，不含主会话历史）；子会话独立 `usage_records`，AUTO 也对子会话生效（`auto_decisions` 有子会话 classify 行，`includeSubagents=true` 默认）；
  - `REPORT.md` 写入，主/子会话分别计费。
- **结论：PASS 15/15**。fresh spawn 的“只收任务包”可被审计表 + 子会话首请求 input 佐证。
- 限制：本次只覆盖 `provider=spawn`（fresh）；`fork`（继承历史）路径未在真实任务中触发（见 §5）。

### 3.G Token 统计真实性（G）

- 聚合 A–F 共 **70 条最终请求**（含子会话），全部检查通过：
  - `G: 所有请求都记录了实际 reasoning_effort` → `finals=70, withEffort=70`
  - `G: totalTokens = input+cacheRead+cacheWrite+output` → 70/70 一致
  - `G: DB 计费行与 DSH 会话日志的 assistant/message usage 逐条一致` → `crossChecked=70, matched=70, mismatches=[]`（按 session_id 配对主/子会话）
  - `G: reasoning_tokens 仅在 API 返回时记录` → `nullRows=70, nonNullRows=0`（DeepSeek 适配器不返回，不伪造 0）
  - `G: usage_basis` → 全部 `api`；`G: effort_source` → 全部 `auto`；`G: reasoning_source` → `null` 或 `estimated`
  - `G: reasoning_source=estimated 的行不伪造成 reasoning_tokens 真值` → 示例 `{step:1, reasoning_tokens:null, estimated:60}`
  - `G: 可按参考价估算每次请求费用` → 示例单请求 ¥0.0081 / ¥0.006968 / ¥0.00784
  - `G: source='live'` → 全部 live
- **结论：PASS 12/12**。
- 真实字段样例（A 用例 step1）：`usage_basis=api, effort_source=auto, reasoning_source=null, reasoning_estimated=null, reasoning_tokens=null, input_tokens=1106, cache_read_tokens=10496, output_tokens=80, total_tokens=11682, source=live`。
- 注意：费用列是**估算**（内置参考价另算）；`reasoning` 为内容块估算并标 estimated——两者在 UI/报告均带“估算”标识。

---

## 4. 真实档位证据链路

1. **DSH 会话日志 `request/header`**：`dsh-agent-loop` 只在首个请求、header 变化（`reason:"change"`）、resume 系列时追加，记录实际发给适配器的 `config.reasoningEffort`。
2. **插件 DB `usage_records.reasoning_effort`**：每个最终请求一行的实际档位。
3. **`model/selection` 事件**：AUTO 调度器 `agent.model.select()` 的原始写入记录。
4. 三者交叉核对（用例 G），示例 C：`request/header` `initial low → change high → change max`；`usage` `low,low,low,high,max`。

---

## 5. 受接口限制 / 未执行项（如实说明）

| 项目 | 状态 | 原因 |
|---|---|---|
| `reasoning_tokens` API 真值 | **不可得** | 本构建 DeepSeek 适配器不返回 reasoningTokens；ledger 写 NULL，`reasoning_source='estimated'` 时另有 `reasoning_estimated`（内容块 bytes/4，估算），报告/UI 均标「估算」 |
| `fork` 子 Agent（继承历史） | **未覆盖** | F 只触发 `spawn`（fresh，`inherits_context=0`）；`fork` 的 seed 语义与 `subagent_runs.provider='fork'` 未实测 |
| 成本账单真值 | **不可得** | 无 API 账单接口；费用为内置参考价估算（`price_configs` 在测试库初始为空时 ledger cost=null） |
| `workspace-write` 下完整 A–G | **未全跑** | 默认沙箱以 `spawn EPERM` 阻断 `node --test` 子进程（环境类失败），只做对照观测；正式结论在 danger-full-access（=生产桌面策略） |
| GUI 里真实跑 A/B/C/E 任务 | **未做** | GUI 已完成 AUTO 控件/菜单/设置/总览/成本分析的三档验证；A/B/C/E 的**逻辑**证据来自 headless 真实运行（同一 host 构建、同一 DB 结构），GUI 未逐题重跑任务 |
| AUTO monitorOnly/手工退出等边界 | 部分 | GUI 上验证了 AUTO/手动档位切换控件存在；`manual-exit` 行为以 DB 决策行观察（成本分析页“手动退出”行），未做全组合矩阵 |
| 成本对比样本量 | 单次为主 | 每用例/变体 1 次（B 重复 1 次），模型路径有方差；见 `docs/AUTO-COST-COMPARE.md` §4 |

---

## 6. 验收过程中发现的问题与修复状态

| # | 问题 | 证据 | 状态 |
|---|---|---|---|
| 1 | `usage_records` 新列（usage_basis/effort_source/reasoning_source/reasoning_estimated/usage_partial）未迁移，INSERT 24 列 vs 表 19 列 → 所有计费行写库失败（`meta.last_error: Provided value cannot be bound to SQLite parameter 23`） | `.verify/auto/runs/manual-high-high1/A/db.json` | **已修复**（`ensureUsageColumns` 幂等补列；final 构建 70 行全部写入） |
| 2 | `classifyFailure` 不识别 read 工具的 `Error: cannot read "…": not found`，环境失败记为 `unknown`→推理性失败，AUTO 误升级 | D 首轮 `auto-auto-probe2/D`（step4 escalate, failureKinds=["unknown"]） | **已修复**（补 `cannot read … not found` / `file … not found` / `no such file` / 命令不存在等模式；`auto-d-fix3` 起验证 fs-not-found 正确阻断） |
| 3 | files 升级规则把只读文件计入“关联文件”（troubleshoot 读 3 个文件就升档，evidence.files 却为空） | `auto-probe2`/`auto-r1` 行：`"关联文件 3 个 ≥ 3（troubleshoot）"`、`"关联文件 8 个"` | **已修复**（只统计写文件；只读分析仅对 complex-dev/project-analysis 且 readFiles≥5 触发；D 复测无 escalate；C/E 的只读规则按新阈值工作） |
| 4 | 插件启动 `meta.last_error: context-pack.init: createContextPack is not defined`（esbuild 不校验未定义标识符） | `auto-auto-r1/{B,C}/db.json` | **已修复**（补 import；final 构建 `last_error` 全空） |
| 5 | 验收脚本自身 bug：`run.stdout` 缺失、E 断言套用首次 classify 期望、G 跨会话错配、env D fixture 只读文件触发 files 规则 | 见 `scripts/e2e/` 工作区改动 | **已修复**（属验证工具，非产品代码；D1–D3 分型夹具为此新增） |

> 代码冻结后未再修改任何 `src/`；本报告所有 final 证据均来自冻结构建 `66f5163d…`。

---

## 7. GUI 验收（独立实例 `http://127.0.0.1:62310`，final host 18:47:02 + 精修后 client）

> 状态：**已完成**（精修后的 `lib/client.js` 页面刷新后加载；host `lib/index.js` 仍为冻结的 18:47:02，A–G 逻辑结论不受影响）。
> 首轮截图（精修前）已由 ui-auto 归档到 `.verify/auto/ui/legacy-round1/`；本轮正式截图 `lead-*` 在 `.verify/auto/ui/`。
> ui-auto 同轮截图 `.verify/auto/ui/final-*` 作为交叉补充。

- 实例：profile `tm-auto-web`，数据隔离 `C:\Users\Administrator\.dsh\tm-auto-web-data`；未触碰生产 desktop（127.0.0.1:8415）与生产库。
- 三档视口：1600×900 / 897×900 / 390×844（PNG 实际尺寸已逐一校验）。
- 操作均为真实浏览器点击（MCP Playwright）：设置页实际打开 AUTO 开关（未启用 → 已启用）、打开/关闭 AUTO 菜单、切换 Tab；截图后未恢复 AUTO 关闭状态（AUTO 保持启用，便于后续人工复核）。

### 7.1 已验证结果（截图 + 页面真实文本）

| 场景 | 证据 | 结果 |
|---|---|---|
| G1 总览 · AUTO 面板 | `lead-g1-overview-auto-1600.png`、`lead-g1-overview-auto-897.png`、`lead-g1-overview-auto-390.png` | 显示「AUTO 自动推理 · 9 条决策 · 0 次升级」及 AUTO vs 手动对比表（任务数/调用数/未命中输入/缓存命中/输出/推理 Token（估算）/合计/费用估算/成功率/平均每任务）、档位分布；无「未知路由」错误 |
| G2 composer AUTO 控件 | `lead-g2-composer-chip-{1600,897,390}.png`、`lead-g2-auto-menu-{1600,897,390}.png` | 输入框工具行有档位 chip（实测两种状态：`手动 · 低` 与 `自动`）；菜单含 AUTO（勾选，“按任务难度自动选择档位，仅推理性失败升级”）、手动档位 OFF/LOW/HIGH/MAX（2 列网格）、最近决策（任务类型·阶段 + reasons）；390 下菜单向上弹出且未溢出 |
| G4 成本分析 · AUTO vs 手动 | `lead-g4-cost-compare-{1600,897,390}.png` | 显示 AUTO vs 手动对比表、档位分布（含「估算值」标识）、「最近 AUTO 决策」表（会话/任务/动作/档位/阶段/原因/生效；可见 classify / manual-exit 行） |
| G6 设置页 · AUTO 配置 | `lead-g6-settings-auto-{1600,897,390}.png` | 实测点击启用：状态「未启用 → 已启用」；可见启用开关、子 Agent 纳入 AUTO、观察模式、新任务重新判断；初始档位（简单修改=关闭推理，普通/复杂/排查/项目=低推理，上限=低推理）；推理失败升级次数 2、复杂任务文件数 3、最大无进展步数 40、单任务最大升级 3；价格表 deepseek-account/deepseek-flash 2 / 0.5 / 0 / 8 CNY/1M |
| G7 布局 1600/897/390 | 上述三档截图 | 三档宽度均无横向页面滚动、无元素重叠；390 下侧栏收为图标栏、卡片纵向堆叠、AUTO chip 与菜单完整可见；设置页控件对齐、数值完整 |

### 7.2 GUI 未覆盖项（如实）

- 未在 GUI 里重跑 A/B/C/E 的完整任务（逻辑与 DB 证据来自 headless 真实运行，同一 host 构建）；GUI 验证的是“AUTO 状态/决策/成本/设置在三档宽度下正确可见可操作”。
- 未做 GUI 上 manual-exit 的全组合操作矩阵（仅确认控件与已存在的 `manual-exit` 决策行）。
- 截图时实例 AUTO 全局开关被我启用并保持；如交付需要“默认关闭”现场，可在 UI 关闭后重拍设置页。

---

## 8. 复现与清理

```powershell
node scripts/e2e/probe.mjs
node scripts/e2e/run-case.mjs --all --stamp final
node scripts/e2e/run-case.mjs --cases D1,D2,D3 --stamp final-env
node scripts/e2e/run-case.mjs --variant manual-low  --cases A,B,C,D --stamp low3
node scripts/e2e/run-case.mjs --variant manual-high --cases A,B,C,D --stamp high2
node scripts/e2e/compare.mjs
node scripts/e2e/read-db.mjs --db C:\Users\Administrator\.dsh\tm-e2e\auto-D-final\data
# 清理临时数据（不动生产库）
Remove-Item C:\Users\Administrator\.dsh\tm-e2e -Recurse -Force
```
