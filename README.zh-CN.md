# DSH Token Manager

[![DSH](https://img.shields.io/badge/DeepSeek%20Harness-0.2.x-4c6ef5)](https://github.com/deepseek-ai/deepseek-harness)
[![Tests](https://img.shields.io/badge/tests-231%20passing-2f9e44)](#发行版说明)
[![License](https://img.shields.io/badge/license-proprietary%20(UNLICENSED)-868e96)](#许可)

**DeepSeek Harness（DSH）的 Token 成本监控、模型调用效率分析与可逆工具输出缓存插件。**

ZHIRAI · 智睿科技 · 独立开发者

[English](README.md) | **中文**

---

![插件未启动 vs 启用后](docs/screenshots/annotated-07-compare.png)

| 仪表盘 | 顶部实时条 | 压缩记录 |
|---|---|---|
| ![仪表盘](docs/screenshots/annotated-02-after.png) | ![实时条](docs/screenshots/annotated-03-overlay.png) | ![压缩记录](docs/screenshots/annotated-04-cache.png) |

![A/B 实测](docs/screenshots/annotated-05-ab.png)

> 截图来自真实运行的 DSH 桌面应用：**左边插件未启动，右边插件启用后**（同一台机器，仅切换插件）。A/B 图来自真实模型调用对照：**44,067 → 30,068 token（−31.8%），两组回答完全一致**。

---

## 它解决什么问题

在不修改模型、不降推理等级、不改 Harness 核心与 dsh-mnemon 的前提下，回答四个问题：

1. **Token 花在哪了？** 逐调用四桶台账，按任务 / 会话 / 项目 / 今日 / 历史累计。
2. **哪些调用在浪费？** 11 类发现：重复读文件、重复工具、重复构建/测试/部署、多次确认、重复计划/总结、简单任务步骤膨胀、缓存命中下降、任务成本异常等。
3. **哪些可以安全压缩？** 大段命令/构建/测试/日志输出替换为结构化摘要，原文随时可用 `token_manager_read` 恢复。
4. **花了多少、省了多少？** 按你的价格表算任务费用，并估算压缩节省的 Token 与费用。

| 模块 | 能力 |
|---|---|
| **计量** | 逐调用四桶（未命中输入 / 缓存命中 / 缓存写入 / 输出），按 `(session, turn, step, attempt)` 去重；与官方 `tokenUsage` 逐字段核对一致 |
| **效率分析** | 11 类发现，可单独开关与设阈值；5 类任务 + 同类型历史基线（median / p80） |
| **压缩 2.0** | 按 shell 输出分类（文件列表、JSON/JSONL、Markdown、git diff/log、构建、测试、日志）；**所有错误/警告行带原始行号保留**；`read` 结果与错误结果**永不压缩**；历史前缀**永不重写** |
| **恢复** | 内容寻址 blob；`token_manager_read` 按 blob id 分页读取，或读取会话工作目录内文件 |
| **任务/项目** | 任务合并、9 段任务摘要、8 段版本化项目摘要、JSON/Markdown/CSV 导出 |
| **界面** | 中文深色仪表盘、顶部实时条、1600/897/390 自适应、说明收进 `?` |

## 实测数据（不是宣传数字）

| 场景 | 结果 |
|---|---|
| A/B：同一命令，压缩关 → 开 | **44,067 → 30,068 token（−31.8%）**，两组回答完全一致 |
| 准确性核对：1500 行输出，问行数 + 第 777 行原文 | 两种模式回答**完全一致且正确**（1500 行、原文精确、ERROR 1 / WARNING 1） |
| 真实 493k token 会话（12 条 shell 输出离线审计） | 521,347 B → 169,738 B（**−67.4%**），错误/警告行保留 **20/20** |
| 历史项目累计可避免 Token（估算） | 大型/长会话 **30%–50%**，小项目 **5%–15%** |

> 历史项目百分比是按“被压缩 Token × 后续携带它的调用次数”的离线估算；A/B 是真实模型调用。费用取决于你的套餐，内置价格是公开参考价、不是实时账单。

## 发行版说明

本仓库是**发行版**，不是开源仓库：

- `lib/` 是编译压缩后的 host/client 产物（DSH 实际加载的文件）；
- `src/`、`tests/` 只有说明文件——源码与测试**不公开**；
- `scripts/` 是两个真实可用的辅助脚本；
- 插件为专有软件（**UNLICENSED**，保留所有权利）。

| 路径 | 内容 |
|---|---|
| `lib/` | `index.js`（host，197KB）、`client.js`（浏览器，188KB），已压缩 |
| `src/` | 仅说明：源码不发布 |
| `tests/` | 仅说明：测试套件概况（231 项），不含测试源码 |
| `scripts/` | `token-report.mjs`（逐调用 Token 报告）、`install-sandbox.ps1`（隔离 profile 安装） |
| `locale/` | 中英文语言包 |
| `docs/` | 安装、配置、故障排查、压缩 2.0 报告、市场说明、视频脚本、截图 |
| `.github/` | Issue 模板 |

## 安装

```bash
# 从本仓库安装（链接式开发安装）
dsh plugin --profile <profile> add "file:<本仓库绝对路径>"

# 或从 Release 包安装
#   下载 dsh-token-manager-1.3.1.zip 解压，再安装解压目录
dsh <profile> --no-open
```

或在 DSH 桌面版：设置 → 插件 → 从本地目录安装。

验证：左栏出现「Token 监控」，`/token-manager/api/health` 返回 `ok: true`。

完整步骤、升级、卸载见 [docs/INSTALL.md](docs/INSTALL.md)。

### 环境要求

DeepSeek Harness `0.2.x`（本机验证 0.2.1-rc.5）、DSH 自带 Node.js 24.x、无需联网、无需 API Key。

## 配置

全部在「Token 监控 → 设置」：采集开关、11 类分析开关与阈值、价格表（四桶 / 币种 / 单位）、压缩模式（关闭 / 观察 / 启用）与阈值、缓存上限、上下文分析（仅 dry-run）。

默认是安全模式：监控开、**压缩为观察模式**（只记录不替换）、上下文分析只检测。自动压缩需手动开启。

逐项说明见 [docs/CONFIG.md](docs/CONFIG.md)。

## 兼容与安全

- **不改核心**：不修改 Harness 核心、dsh-mnemon、模型配置与推理等级；
- **与 dsh-mnemon 共存**：mnemon 注入消息标记为受保护，不压缩、不去重、不删除（真实会话哈希前后一致）；
- **数据本地**：`%DSH_HOME%\dsh-token-manager\`（SQLite + 内容寻址 blob），无遥测、无网络请求；
- **HTTP 边界**：所有请求经 DSH 连接围栏；`token_manager_read` 校验会话归属、路径限制在工作目录；
- **可逆**：卸载后监听器、路由、工具、UI 全部移除，数据保留到用户删除。

## 市场

DSH 市场本质是一个 JSON 索引，本仓库内置：

```
https://raw.githubusercontent.com/zhirai-tech/dsh-token-manager/main/docs/market/index.json
```

在「插件 → 发现 → 添加索引源」填入即可。索引格式与社区目录收录见 [docs/MARKET.md](docs/MARKET.md)。

## 许可

**专有软件 / 保留所有权利（UNLICENSED）**，详见 [LICENSE](LICENSE)。未经书面许可，不得复制、修改或再分发。

---

<p align="center">
  <strong>ZHIRAI</strong> · 智睿科技<br/>
  把想法变成现实 · Build Ideas Into Reality<br/>
  <a href="https://zhirai.cloud">zhirai.cloud</a> · xtang3125@gmail.com<br/>
  © 2026 智睿科技 保留所有权利。
</p>
