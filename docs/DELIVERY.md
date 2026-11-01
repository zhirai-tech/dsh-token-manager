# DSH Token Manager · 交付说明（v1.0.0）

> 交付日期：2026-11-01｜作者：ZHIRAI / 智睿科技｜许可：私有（UNLICENSED）
> 全部交付物在本机完成构建与真实验收；生产 profile 未做任何修改（安装需用户授权）。

## 1. 交付物清单

| 文件 | 说明 |
|---|---|
| `E:\ZHIRAI Harness\release\dsh-token-manager-1.0.0.zip` | 运行时安装包（解压后根目录即插件包） |
| `E:\ZHIRAI Harness\release\dsh-token-manager-1.0.0-source.zip` | 完整源码包（src/tests/scripts/docs 等） |
| `E:\ZHIRAI Harness\release\RELEASE_SHA256.txt` | 上述两个 zip 的 SHA-256 校验值（以此为准） |
| `E:\ZHIRAI Harness\dsh-token-manager\` | 工作区源码（含 `.verify/real-user/` 31 张验收截图） |

> 校验方式：`Get-FileHash <zip> -Algorithm SHA256` 与 `RELEASE_SHA256.txt` 对比。
> 注意：`DELIVERY.md` 本身打包在 zip 内，因此本文件不内嵌 zip 自身哈希（否则会循环变化），哈希统一记录在随包的 `RELEASE_SHA256.txt`。

### 运行时安装包内容（zip 根目录，28 个文件）
```
package.json  cordis.patch.yml  icon.png  README.md  CHANGELOG.md
lib/index.js（Host 319KB）  lib/client.js（Client 295KB）
locale/zh.json  locale/en.json
docs/（README、安装、配置、故障排查、Phase1–5 设计/测试报告、环境审计及 audit/ 分册）
```

### 源码包内容
```
src/（TypeScript 全量：shared / storage / host / client）
tests/（unit 216 项 + integration 真实历史交叉核对）
scripts/（build.mjs、build-tests.mjs、install-sandbox.ps1）
docs/、locale/、lib/、package.json、package-lock.json、tsconfig.json、cordis.patch.yml、icon.png
README.md、CHANGELOG.md、.gitignore
```

## 2. 构建与测试

```powershell
cd E:\ZHIRAI Harness\dsh-token-manager
npm install
npm run build          # Host + Client，node --check 通过
npm test               # 216/216 通过
npm run test:integration   # 真实历史会话交叉核对：0 失败
npx tsc --noEmit       # 0 错误
```

| 项 | 结果 |
|---|---|
| 单元测试 | **216/216** |
| 真实历史交叉核对 | 49 会话回放，官方投影逐字段一致（滞后快照单独标记） |
| TypeScript | 全项目 0 错误 |
| 运行时依赖 | **0**（仅 node 内置模块） |
| 构建时间 | < 1s（esbuild） |

## 3. 真实验收矩阵

| 环境 | 用途 | 结果 |
|---|---|---|
| `tm-sandbox`（base+web-app+插件） | Phase 1–4 真实模型调用、压缩/恢复、任务/项目、缓存与上下文页面 | ✅ |
| `tm-mnemon`（+ dsh-mnemon 0.5.36） | mnemon 注入下的压缩/恢复、记忆哈希不变、统计一致、会话恢复、卸载/重装 | ✅ |
| `tm-release`（从发布 zip 安装） | 发布包可安装、Host/Client 产物可用、真实调用被采集（1 次/14,325 tokens） | ✅ |
| 生产 `desktop` profile | **未修改**（安装待用户授权） | — |

UI 验收：1600 / 897 / 390 三档截图共 29 张，位于 `dsh-token-manager\.verify\real-user\`。

## 4. 安装与使用

- 安装/升级/卸载：见 `docs/INSTALL.md`
- 配置项与默认值：见 `docs/CONFIG.md`
- 故障排查：见 `docs/TROUBLESHOOTING.md`
- 版本记录：见 `CHANGELOG.md`

**生产环境安装步骤（需用户明确授权后执行）：**
1. 解压运行时包到任意目录（如 `C:\tools\dsh-token-manager`）；
2. Harness 设置 → 插件 → 从本地目录安装该目录（或让 Agent 用 `plugin_manager install_bundle`，target 为该目录绝对路径）；
3. 重启 Harness；
4. 按 `docs/INSTALL.md` §8 的清单验收。

## 5. 安全与隐私

- 全部数据本地保存于 `%DSH_HOME%\dsh-token-manager\`（SQLite + blobs），无外部网络请求。
- 不记录 API Key / 密码 / 凭据；发现项文本截断并脱敏。
- HTTP API 每个请求经 `connection.requestRejection` 围栏（未通过 → 403）；`token_manager_read` 校验会话归属；路径读取限制在会话工作目录内。
- 不修改 Harness 核心、不修改 dsh-mnemon、不更换模型、不降低推理等级。

## 6. 已知限制（交付时）

1. 上下文分析只支持 live 会话；历史会话仅参与统计与导入。
2. 项目摘要的数据库结构/关键接口/用户限制需人工填写（本地无法可靠推断）。
3. 观察模式仍保存 blob（受 512MB/30 天限制，可手动清空）。
4. mnemon 的 `mnemon_*` 工具结果按红线不参与压缩。
5. 任务分类为启发式，可人工覆盖；合并会重写历史 `usage_records.task_id` 归因（`merged_into` 保留可追溯）。
6. 390 宽顶部标签可横向滚动（一屏约 5 个）。
7. 未获得生产 profile 安装授权，因此生产环境“安装/卸载/会话恢复”以隔离 profile 实测为准。

## 7. 建议的后续（v1.1+）

- A/B 对照实验（PRD 12.4）以量化压缩/去重的真实节省；
- 上下文改写的 apply 通道（需先有 A/B 证据 + 默认关闭）；
- 任务类型分类结合项目历史进行校准；
- 多项目视图与预算提醒（PRD 第十三部分）。
