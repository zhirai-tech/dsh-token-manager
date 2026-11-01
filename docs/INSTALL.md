# DSH Token Manager · 安装指南

> 适用版本：DSH Token Manager 1.0.0（DeepSeek Harness 0.2.x）
> 本插件为本地 Cordis 插件：不修改 Harness 核心、不修改 dsh-mnemon、不更换模型、不降低推理等级。

## 1. 前置条件

| 项 | 要求 |
|---|---|
| DeepSeek Harness | 0.2.x（本机验证 0.2.1-rc.5） |
| 运行环境 | DSH 桌面版或 `dsh` CLI（Node ≥ 22，宿主内置 24.x 即可） |
| 磁盘 | 数据目录初始 < 10MB；工具缓存默认上限 512MB |
| 网络 | **不需要**；插件不发起任何外部网络请求 |

## 2. 安装前检查

```powershell
dsh --version                       # 应输出 0.2.x
echo $env:DSH_PROFILE               # 当前 profile，例如 desktop
echo $env:DSH_HOME                  # 默认 C:\Users\<用户>\.dsh
```

## 3. 方式一：生产 profile 安装（需要用户授权）

> 本插件的安装会写入当前 profile 的 `package.json`、`node_modules` 与 bundle 列表，因此**必须先获得用户明确授权**。

1. 构建（或使用已构建的发布包）：

```powershell
cd "<插件目录>"
npm install
npm run build
```

2. 用插件管理器安装（二选一）：
   - Harness 界面：设置 → 插件 → 从本地目录安装，选择插件目录；
   - 或让 Agent 调用 `plugin_manager` 的 `install_bundle`，`target` 指向插件目录绝对路径。

3. **重启 Harness**（客户端 bundle 在启动时装配）。

4. 验证：
   - 左栏出现「Token 监控」；
   - 打开后能看到「总览 / 调用明细 / 任务 / 工具缓存 / 上下文分析 / 成本分析 / 设置」；
   - `GET http://<gui>/token-manager/api/health` 返回 `ok:true`（浏览器同源访问）。

## 4. 方式二：隔离 profile 安装（推荐先验证）

不触碰生产 profile：

```powershell
# 1) 从官方 web 模板创建隔离 profile
dsh tm-sandbox --from-default-profile web --dump-config

# 2) 安装本地插件（自动加入 bundles）
dsh plugin --profile tm-sandbox add "file:<插件目录绝对路径，斜杠用 />"

# 3) 启动独立 GUI（URL 带一次性 token）
dsh tm-sandbox --port 62300 --no-open
```

开发调试可把 `profiles/tm-sandbox/node_modules/dsh-token-manager` 换成指向源码目录的 junction（`cmd /c mklink /J`），修改源码后重启即可生效；注意 junction 状态下不要再执行 `dsh plugin add`。

## 5. 方式三：从发布 zip 安装

```powershell
Expand-Archive dsh-token-manager-1.0.0.zip -DestinationPath C:\tools\dsh-token-manager
# 之后按“方式一/方式二”把 C:\tools\dsh-token-manager 作为插件目录安装
```
zip 根目录即插件包（`package.json`、`lib/`、`cordis.patch.yml`、`locale/`、`icon.png`、`docs/`）。

## 6. 升级

1. 备份数据目录 `%DSH_HOME%\dsh-token-manager\`（可选）；
2. 替换插件目录内容 / 重新安装新版本；
3. 重启 Harness。数据库 schema 会自动逐级迁移（当前为 v4），旧数据保留；
4. 若从旧版本升级，建议打开「设置」确认一次配置项（新版本可能新增默认项）。

## 7. 卸载

1. 设置 → 插件 → 禁用或移除 `dsh-token-manager`；
2. 重启 Harness（监听器、HTTP 路由、客户端 UI、`token_manager_read` 工具会随插件 fiber 自动清理）；
3. 数据默认保留在 `%DSH_HOME%\dsh-token-manager\`；确认不需要后可手动删除。

已实测：卸载后左栏入口消失、`/token-manager/api/health` 返回 404、会话工具清单不再包含 `token_manager_read`、dsh-mnemon 继续正常工作。

## 8. 安装验收清单

- [ ] 左栏出现「Token 监控」
- [ ] 总览页显示今日/本会话/本任务/历史累计 Token
- [ ] 「调用明细」能看到至少一次真实模型调用（发一条消息后刷新）
- [ ] 「工具缓存」页可打开（空态正常）
- [ ] 「上下文分析」能对当前会话出结果（只检测，不改写）
- [ ] 设置页可保存（改一项再刷新仍保留）
- [ ] 卸载后无残留入口与接口

## 9. 隐私说明

- 全部数据保存在本机 `%DSH_HOME%\dsh-token-manager\`；
- 不记录 API Key、密码、授权凭据；
- 工具缓存原文仅本地保存，`token_manager_read` 读取时会校验会话归属；
- 插件不向任何外部服务器上传数据。
