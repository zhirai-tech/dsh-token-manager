# DSH Token Manager · 故障排查

> 先看健康检查：浏览器打开 `http://<当前 GUI 地址>/token-manager/api/health`（同源），应返回 `ok:true` 与数据库/会话/缓存统计。
> 数据目录：`%DSH_HOME%\dsh-token-manager\`；日志：Harness 进程 stderr 中以 `[token-manager]` 开头的行。

## 1. 快速诊断

| 检查 | 命令 / 位置 |
|---|---|
| 插件是否加载 | 左栏是否有「Token 监控」；Harness 启动日志是否有 `entry did not activate` |
| 数据库是否可写 | `/token-manager/api/health` 的 `dbWritable` |
| schema 版本 | health 的 `schemaVersion`（当前应为 4） |
| 最近错误 | health 的 `lastError`（含 `where` 与 `message`） |
| 客户端产物 | 插件目录 `lib/client.js` 是否存在、是否最新构建 |

## 2. 常见问题

| 现象 | 可能原因 | 处理 |
|---|---|---|
| 左栏没有「Token 监控」 | 插件未启用 / client 产物缺失 / 未重启 | 设置 → 插件确认启用；`npm run build`；重启 Harness |
| 页面打开后报「接口返回错误」 | Host 半未加载 / 端口不一致 / 路由被卸载 | 看 health；确认插件已激活；重启 |
| 数字全是 0 | 选错统计范围；还没有真实调用；采集开关关闭 | 切到「今日/全部」；发一条消息后刷新；检查采集开关 |
| 费用显示「价格未配置」 | 未配置对应 provider/model 价格 | 设置 → 价格表新增四桶单价 |
| 模型占比/项目排行不含历史 | 历史导入是会话级汇总，只进入「全部」Token/项目排行 | 设计如此；逐调用统计只含 live |
| 任务类型识别不准 | 启发式分类 | 在任务详情里手动改类型 |
| 合并后任务用量没变 | 旧版本问题（已修复） | 升级到 1.0.0 |
| 工具没有压缩 | 观察模式 / 小于阈值 / 错误结果 / 黑名单工具 / 类型开关关闭 | 设置里改「启用自动压缩」；查看工具缓存页的模式列 |
| `token_manager_read` 找不到 blob | blob 已清理/损坏；跨会话读取；blobId 抄错 | 检查缓存页「可恢复」；一致性检查；依赖摘要里的 Blob ID |
| 上下文分析显示「当前会话还没有可分析的上下文」 | 会话不是 live 或没有 surface | 先打开该会话再刷新分析 |
| 缓存原文缺失 | 目录被清理 / 磁盘满 | 工具缓存 → 一致性检查；清理后不可恢复（原文已删） |
| 与 mnemon 同时启用异常 | 配置冲突（少见） | 分别禁用验证；本插件不修改 mnemon，也不读其存储 |
| 卸载后仍有入口 | 未重启 / 多 profile | 重启 Harness；确认操作的是当前 profile |

## 3. 数据修复

1. **一致性检查**：工具缓存页 → 一致性检查（返回缺文件/孤儿文件/哈希不符计数）。
2. **清空缓存**：工具缓存页 → 清空缓存（二次确认）；不可恢复，但统计与任务数据不受影响。
3. **数据库损坏**：关闭 Harness → 备份 `%DSH_HOME%\dsh-token-manager\` → 删除 `token-manager.db*` → 重启（自动重建空库，历史会话仍可从 projcache 重新导入）。
4. **迁移失败**：日志中 `[token-manager] ... failed`；备份后重建库。插件自身异常不会阻断 Harness 任务。

## 4. 与 dsh-mnemon 共存排查

- 本插件只读取会话事件与自身数据库，不写 mnemon 存储，不注册与其冲突的 projection key。
- mnemon 注入消息以 `message.source.kind = 'dsh-mnemon'` 识别，属于受保护内容，不参与压缩/去重候选。
- 若怀疑冲突：分别禁用其中一个复现；本插件卸载后 mnemon 应继续正常工作（已实测）。

## 5. 性能与磁盘

- SQLite 为同步 API，查询均带 `LIMIT`；大量历史数据导入为一次性操作（219 会话约 0.1 秒）。
- blob 目录默认上限 512MB、保留 30 天；可在设置中调整或手动清空。
- 如果 Harness 启动变慢，可先检查 `%DSH_HOME%\dsh-token-manager\blobs` 大小。

## 6. 反馈信息收集

出问题时请提供：
1. DSH 版本（`dsh --version`）与 profile 名；
2. `/token-manager/api/health` 返回内容；
3. Harness 日志中 `[token-manager]` 相关行；
4. 复现步骤（哪个页面、哪个操作、预期与实际）。
