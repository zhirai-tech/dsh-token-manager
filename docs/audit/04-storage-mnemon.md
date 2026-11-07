# 04 · 存储规范与 dsh-mnemon 兼容性审计

- **审计对象**：DSH Token Manager 插件（尚未实现的插件项目）
- **审计类型**：只读源码审计 + 本机实测（未安装插件、未修改 profile、未修改 `dsh-mnemon` 源码）
- **审计时间**：2026-11-01
- **环境**：DSH `0.2.1-rc.5`；Electron `44.7.0`（内置 Node `24.21.0`）；CLI/工具链 Node `v24.14.0`；profile=`desktop`；`DSH_HOME=C:\Users\Administrator\.dsh`；`DSH_PROFILE_DIR=C:\Users\Administrator\.dsh\profiles\desktop`；工作区 `E:\ZHIRAI Harness`（exFAT）

## 0. 读法与取证约定

| 证据类型 | 取法 | 可信度 |
| --- | --- | --- |
| Cordis / DSH 官方包源码 | 官方包封在 `app.asar` 内，shell 不能 `ls`/`rg`；用 `read` 工具读**已知绝对路径**，用 `cordis_inspect_query(host, Config, listConfigs, {entry})` 拿 `packageDir` | 原文 |
| 第三方/自研插件源码 | 真实目录，可直接 `read`/`grep` | 原文 |
| 运行期契约 | `cordis_inspect_query(host, Event/Service/Config …)` 返回的实时事件、服务、配置契约 | 原文（运行时投影） |
| 落盘事实 | `pwsh` 列目录、解压真实 session 日志 | 实测 |
| SQLite 能力 | `pwsh` + `node -e` / `ELECTRON_RUN_AS_NODE=1` 探测 | 实测 |

文中 `dsh-mnemon/lib/index.js:NNNN` 均指 `C:\Users\Administrator\.dsh\profiles\desktop\node_modules\dsh-mnemon\lib\index.js`；`dsh-base patch` 指 `C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-base\cordis.patch.yml`。

已通过 `cordis_inspect_query(host, Config, listConfigs, {name:"dsh-mnemon"})` 取得 `packageDir = C:\Users\Administrator\.dsh\profiles\desktop\node_modules\dsh-mnemon`；同法可证 `dsh-storage-json`、`dsh-session-query-sqlite` 的 `packageDir` 都在 `app.asar\dsh\node_modules\@deepseek-ai\...` 下。**这就是"官方包在 asar、第三方在 profile"的分界线。**

---

## 1. 插件数据目录规范

### 1.1 DSH_HOME 实际布局（实测）

```
PS> Get-ChildItem -Force C:\Users\Administrator\.dsh
attachments/  cache/  dsh-pet/  dsh-runtimes/  electron/  im/  integrations/
llm-deepseek/  profiles/  sessions/  skills/  speech-to-text/  storages/
.anonymous-user-id  .credentials.yaml  AGENTS.md  github-token.txt  settings.yaml.imported
```

关键结论：**`DSH_HOME` 下没有 `var/`，也没有 `plugins/`**（两条路径实测均 `MISSING`）。`var/` 只出现在 profile 目录里（`…\profiles\desktop\var\`，里面只有一个历史残留文件 `ui-1-login.png`，没有任何代码或文档说明它的归属）。

`storages/` 是 DSH 自己的结构化落盘根，实测内容：

```
storages\schedule.json          (single 布局)
storages\workspace.json         (single 布局)
storages\session_projcache\sessions\<sessionId>.json   (per-record 布局)
```

### 1.2 `dshHomePath()` 是什么，插件能不能用

`dshHomePath` 不是全局魔法函数，而是官方包 `@deepseek-ai/dsh-home-paths` 的普通导出：

```js
// app.asar\dsh\node_modules\@deepseek-ai\dsh-home-paths\lib\index.js:98-134
function resolveDshHome(configured, env = process.env) {
	return resolveRoot(configured, env, DSH_HOME_ENV, defaultDshHome);
}
...
function dshHomePath(...segments) {
	return join(resolveDshHome(), ...segments);
}
```

优先级（同文件 99-111 行注释与实现）：**显式配置 > `$DSH_HOME` > `~/.dsh`**；`$DSH_HOME` 为空串或纯空白时按"未设置"处理（不会退化成 cwd）。另有 `dshCachePath(...)` = `DSH_HOME/cache/...`（141-144 行）。

它被官方 bundle 直接用在 patch 的 `!!js` 表达式里：

```yaml
# dsh-base patch:138-141
- id: session-persistence-jsonl
  config:
    root: !!js dshHomePath('sessions')
# dsh-base patch:182-185
- id: storage-json
  config:
    root: !!js dshHomePath('storages')
```

**但插件运行时代码不能默认 import 它**：desktop profile 的 `node_modules` 里 `@deepseek-ai/` 下只有 `cosmokit`、`schemastery` 两个 peer 包（实测），第三方插件从 profile 解析不到 `@deepseek-ai/dsh-home-paths`。因此插件应自己按同一语义解析（与 `dsh-mnemon` 的实现完全一致）：

```js
// dsh-mnemon/lib/index.js:1520
this.dshHome = dependencies.dshHome ?? (process.env.DSH_HOME?.trim() || join(homedir(), ".dsh"));
```

### 1.3 其他插件的实际落盘位置（先例）

| 插件 | 落盘位置（实测/源码） | 证据 |
| --- | --- | --- |
| `dsh-mnemon` 0.5.36 | 默认 `~/.mnemon/{runtime,documents,skills,state}`，`MNEMON_DATA_DIR` 可覆盖；`storageScope` 支持 global/custom/workspace/workspaces | `dsh-mnemon/lib/index.js:953-966`；实测 `C:\Users\Administrator\.mnemon\runtime\{memories.json,MEMORY.md,USER.md}`（`USER.md` 为 0 字节空投影） |
| `dsh-pet` 0.3.x | `C:\Users\Administrator\.dsh\dsh-pet\{main-config.jsonc,memory.json}` | 实测目录 |
| `@deepseek-ai/dsh-llm-deepseek-api-key` | `C:\Users\Administrator\.dsh\llm-deepseek\files-v3.json` | 实测 |
| `dsh-better-sidebar` 0.28.0 | 全局文档默认 `~/.dsh/docs` | 客户端文案 `dsh-better-sidebar/client-editor.js:21527`（仅文案级证据） |
| `dsh-im` 集成 | `C:\Users\Administrator\.dsh\integrations\dsh-im\group-history.sqlite` | 实测：**已有插件用 SQLite 的先例** |

即存在两种被接受模式：**(a) `DSH_HOME/<plugin-id>/`**（pet、llm-deepseek、better-sidebar）与 **(b) 宿主目录外的独立数据根 + env 覆盖**（mnemon 的 `~/.mnemon`）。两种都带"可配置 + 环境变量覆盖"。

`profiles/desktop/` 里放的是**组合与依赖**（`package.json`、`cordis.yml`、`cordis.patch.yml`、`node_modules/`），不是插件数据目录。

### 1.4 结论与推荐

**推荐默认数据根：`C:\Users\Administrator\.dsh\dsh-token-manager\`**（等价 `dshHomePath('dsh-token-manager')`），并在 Config 中暴露 `dataDir` 覆盖，环境变量 `DSH_TOKEN_MANAGER_DATA_DIR` 作为兜底覆盖。

依据：
1. 与 `dshHomePath` 的语义一致（`$DSH_HOME` 优先、默认 `~/.dsh`），与 mnemon 自己算 `dshHome` 的写法一致（index.js:1520）。
2. 与 `dsh-pet`、`llm-deepseek`、`dsh-better-sidebar` 的既有实践一致（`DSH_HOME/<plugin-id>/`）。
3. 与 DSH 域数据（`sessions/`、`storages/`、`cache/`、`attachments/`）边界清晰，不会与官方写者竞争。
4. 备份/迁移只需拷一个目录，且不落在 exFAT 工作区的路径长度风险里。

目录骨架建议：

```
C:\Users\Administrator\.dsh\dsh-token-manager\
  manifest.json          # schemaVersion / pluginVersion / createdAt
  token-manager.db       # SQLite（WAL）
  token-manager.db-wal
  token-manager.db-shm
  backups\tm-2026-11-01T08-30-00Z.db
  logs\                  # 可选，滚动日志
```

**禁止写入**：
- `…\profiles\desktop\`（组合与依赖由 plugin manager 重写；`dsh plugin add/remove`、`pnpm install` 会重写 `package.json`/`node_modules`；数据放这里会被"重装即清空"——推断，未实测）
- `DSH_HOME\storages\`、`sessions\`、`cache\`、`attachments\`：这些是官方域目录。`storage-json` 明确假设"一个进程一个写者、整文件原子替换"（`dsh-storage-json/lib/index.js:6-17`），外部直接写会与该域的内存状态/原子写协议冲突。
- `app.asar` 内任何路径（只读，且随升级被替换）。

---

## 2. SQLite 可用性实测

### 2.1 CLI Node 实测（`node:sqlite` 内置，无需 native 依赖）

命令（临时目录，测完保留，见 2.9 清理声明）：

```powershell
node probe.mjs (Join-Path $env:TEMP 'tm.db')
# probe.mjs 关键内容：
#   import { DatabaseSync } from "node:sqlite";
#   db.exec("CREATE TABLE token_usage(...)"); db.exec("CREATE INDEX ...");
#   ins.run(...) ×3; SELECT session, SUM(tokens) ... GROUP BY; PRAGMA journal_mode;
#   db.close(); 重新 open 再 COUNT(*)
```

输出：

```
node v24.14.0
sqlite_version 3.51.2
journal_mode delete
rows [{"session":"sess-A","total":1290},{"session":"sess-B","total":789}]
reopen_count 3
file_bytes 12288
=== exit: 0 ===
(node:38060) ExperimentalWarning: SQLite is an experimental feature and might change at any time
```

要点：`DatabaseSync` 直接可用（Node 24 无需 `--experimental-sqlite`）；默认 `journal_mode=delete`；有 stderr 实验性警告。

### 2.2 Electron 宿主运行时实测（最关键）

插件代码跑在 Electron 主进程的 Node 里，所以必须验证**宿主**而不是只看 CLI：

```powershell
$env:ELECTRON_RUN_AS_NODE='1'
& 'C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe' -e "console.log('node', process.versions.node); console.log('electron', process.versions.electron); try { const m = require('node:sqlite'); console.log('node:sqlite OK, keys=', Object.keys(m).join(',')); } catch (e) { console.log('node:sqlite FAIL', e.code, e.message); }"
```

输出：

```
node 24.21.0
electron 44.7.0
node:sqlite OK, keys= DatabaseSync,StatementSync,Session,constants,backup
=== exit: ===
```

再在同一运行时做真实写读：

```
read [{"k":"a","v":7}]
sqlite 3.53.4
```

**结论：宿主 Electron 44.7.0 / Node 24.21.0 完整支持 `node:sqlite`（SQLite 3.53.4），并提供 `backup` 导出（可直接做在线备份）。**无需 `better-sqlite3`、无需编译、无 ABI 风险。

### 2.3 exFAT（E:）实测：WAL 可用

```powershell
node exfat-sqlite-probe.mjs 'E:\...\.tmp-...\tm.db' 'E:\...\.tmp-...'
```

输出：

```
journal_mode before: delete
set WAL ok
journal_mode after: wal
rows: 200 max id: 200
reopen count: 200 mode: wal
bytes: 8192
files: tm.db
=== exit: 0 ===
```

探测目录已删除（`cleanup done, exists: False`）。结论：exFAT 本地盘上 `PRAGMA journal_mode=WAL` 生效、写入/重开/checkpoint 正常，checkpoint 后 WAL 侧车文件被清掉。**但仍建议数据落在 C: 的 `DSH_HOME` 下**（E: 是工作区，exFAT 无日志语义、易被清理工具/版本控制扫到）。

### 2.4 profile 里有没有现成 sqlite 包

实测（`C:\Users\Administrator\.dsh\profiles\desktop\node_modules`）：

```
better-sqlite3 -> False
node-sqlite3-wasm -> False
sqlite3 -> False
node:sqlite -> False（不是包）
libsql -> False
@libsql/client -> False
@journeyapps/sqlcipher -> False
含 "sql" 字样的目录：@codemirror/lang-sql（前端高亮，无关）
@deepseek-ai/ 下只有 cosmokit、schemastery
```

即：**profile 里没有任何 SQLite 依赖可复用**；要么用内置 `node:sqlite`，要么零依赖方案（见 2.7）。

### 2.5 DSH 自己怎么用 SQLite（官方先例）

`@deepseek-ai/dsh-session-query-sqlite`（会话全文检索）就是纯内置方案：

```js
// packageDir: app.asar\dsh\node_modules\@deepseek-ai\dsh-session-query-sqlite
// lib/index.js:41-70  openSearchDatabase()
const { DatabaseSync } = await import("node:sqlite");
const db = new DatabaseSync(actual);
...
// lib/index.js:106-116  建 FTS5 虚表 persisted_docs
```

而它的 `package.json` 的 `dependencies` 只有 `@deepseek-ai/schemastery`（42-44 行）——**没有任何 sqlite 依赖**，靠的就是 Node 内置。默认配置是 `path: ':memory:'` + `openAt: never`（dsh-base patch:157-161），即默认不开盘、只在显式启用全文检索时才落盘。

### 2.6 `storageDomain` / `spillStore` 适合结构化索引吗？

**`storageDomain` = KV 文档域，不是关系库，也不是查询引擎。**

```ts
// cordis_inspect_query(host, Service, storageDomain) 返回的契约（原文）
open<S extends DomainSpec>(spec: S): Promise<Domain<S>>;
interface Domain<S> { table<N>(name: N): KvTable<...>; /* ... */ }
interface KvTable<K extends string, V> {
  get(key: K): V | undefined;
  entries(): IterableIterator<[K, V]>;
  keys(): IterableIterator<K>;
  readonly size: number;
  put(key: K, value: V): Promise<void>;
  delete(key: K): Promise<boolean>;
  update(key: K, fn: (current: V) => V): Promise<V>;
}
```

后端由 `storage-domain` 的 `backend: json` 指定（dsh-base patch:187-190），`storage-json` 的语义是**整文件原子替换的漂亮 JSON**：

```
// dsh-storage-json/lib/index.js:6-17（模块注释）
Publish protocol: write a same-directory temp file, fsync it, then rename() over the target.
// :55-84（format）single 布局 = 一个文档；per-record 布局 = <table>/<key>.json + global.json
```

实测落盘形态印证：`DSH_HOME\storages\workspace.json`、`schedule.json`（single）、`storages\session_projcache\sessions\<id>.json`（per-record）。

→ **适用**：按 session / 按工作区一记录的统计快照、设置、增量缓存（一次 `put`/`update`，DSH 帮你做原子写 + 版本校验 + schema 校验）。
→ **不适用**：跨 session 聚合、Top-N、时间窗口、任意 WHERE 查询。KV 只能 `entries()` 全量扫（O(n) 且把 JSON 全读进内存）。

**`spillStore` 只做文本，且是进程私有临时目录。**

```
// cordis_inspect_query(host, Service, spillStore)（原文）
saveText(input: SaveTextSpill): Promise<SpillRef>;   ← 唯一方法
"Storage is scoped by the request's SaveTextSpill.owner session; the backend chooses a private (not world-readable) location"
```

`dsh-spill-local` 把它落到 `os.tmpdir()/dsh-spill-<随机>`（`lib/index.js:16-37`），按 session 哈希分子目录、文件名 0600（:69-79）。→ **临时挽留大文本 artifacts，不是索引，重启/清理即失效**。

### 2.7 推荐方案（给 Token Manager）

1. **主方案：`node:sqlite`（`DatabaseSync`）+ WAL + 单文件**
   - 目录：`<dataDir>\token-manager.db`；`PRAGMA journal_mode=WAL`；`PRAGMA user_version` 表示 schema 版本（与 DSH 自己的做法一致，见 `dsh-session-query-sqlite/lib/index.js:11-13,58-64`）。
   - 包一层"轻量 DAL"，所有 SQL 只在一处；宿主里是同步 API，务必：单条 upsert 小记录、查询带 `LIMIT`、避免全表扫、绝不在 pre-step 热路径做重查询（同步调用会阻塞事件循环）。
   - 实验性警告只在 stderr，不影响功能；不要为了消警告去改 `process.removeAllListeners('warning')`（会吞掉别人的警告）。
2. **零依赖备选：`storageDomain` KV**（`slot per session` 一条记录）。代价是完全没有查询能力；若要做"会话费用排行"，得自己遍历 + 排序。
3. **不要**把 `spillStore` 当数据库；**不要**引 `better-sqlite3`（native、需按 Electron ABI 重编，profile 里也没有）。

### 2.8 复现清单

- 2.1 脚本：`os.tmpdir()\tm-sqlite-probe-<rand>\probe.mjs`（`import { DatabaseSync } from "node:sqlite"`）
- 2.2 一条命令即可：`$env:ELECTRON_RUN_AS_NODE='1'; & '…\DeepSeek Harness.exe' -e "require('node:sqlite')"`
- 2.3 脚本：临时目录 + `PRAGMA journal_mode=WAL` + 200 行 + `wal_checkpoint(TRUNCATE)` + 重开

### 2.9 写入声明

本次审计**只在临时目录**（`%TEMP%` 与 `E:\ZHIRAI Harness\.tmp-audit-sqlite-probe-9f3a`）创建过 SQLite 文件，E: 上的探测目录**已删除**；项目内唯一写入是本文件。未安装插件、未改 profile、未改 `dsh-mnemon`。`ELECTRON_RUN_AS_NODE` 只在该条 pwsh 进程内设置并在命令末尾删除。

---

## 3. dsh-mnemon 注入链路与可识别标记

被审版本：`dsh-mnemon@0.5.36`；生效配置见 `C:\Users\Administrator\.dsh\profiles\desktop\cordis.patch.yml:89-123`（`recallMode: guided`、`writebackMode: guided`、`lifecycleEnabled: true`、`routingGuidance: true`，并显式打开 `mnemon-strategy-light-context`）。

### 3.1 它注册了哪些扩展点

| 扩展点 | 用途 | 证据（`dsh-mnemon/lib/index.js`） |
| --- | --- | --- |
| `ctx.inject(["systemPrompt"])` + `systemPrompt.section({name:"mnemon:routing", order:150})` | 固定路由指导段落 | 7943-7944, 7975-7984 |
| `system-prompt/assemble`（waterfall 监听） | 每轮把动态段落 `mnemon:strategy` 插进 assembly，并**剔除**旧段落/旧上下文 `mnemon:runtime-memory` | 7947-7974（`applyMemoryViewGuidance`）、11899、12020-12028 |
| `agent/pre-step`（waterfall，**`{prepend:true}`**） | 在 step 1 追加 Mnemon 自己的 user 消息（记忆快照 + 引导提醒） | 11900、11983-12018 |
| `session/event`（emit） | 跟踪 `turn/end` 释放 View | 11898、12035-12041 |
| `agent/turn-stopping`（serial） | 计划 idle review | 11901、12032-12034 |
| `agent/request-error`（waterfall，`prepend:true`） | 特定 chat template 拒绝时的续写（Ollama 等） | 8660-8677 |
| `agent/created`（serial） | 为每个 agent 安装生命周期（pre-step 等监听就是在此时挂到 **agent 级 ctx**） | 12274-12278；子 agent 组合用 `{prepend:true}`（8829-8839） |
| `tools.register` × 16 | `mnemon_view_route`、`mnemon_view_action`、`mnemon_memory_bodies`、`mnemon_recall`、`mnemon_related`、`mnemon_status`、`mnemon_document_search`、`mnemon_document_create`、`mnemon_document_manage`、`mnemon_runtime_memory`、`mnemon_remember`、`mnemon_link`、`mnemon_forget`、`mnemon_memory_body_create`、`mnemon_memory_body_update`、`mnemon_memory_body_merge` | 15362-16103（逐个 `name:`） |
| `sessionProjections.register` | 唯一 key **`mnemonSubagentTokenUsage`**（host-only，无 wire） | 16162-16270，尤其 16237-16238、16265-16269 |
| `ctx.tools.restrict()` | 只用于它自己起的子 agent（人格 + 工具白名单） | 8812-8817 |
| client 半部 | `package.json` 的 `dsh.client.inject`（118-130），客户端用 `slots.inject/register` | `dsh-mnemon-source-skills/lib/client.js:5615` 等 |

**没有**发现：改写 `tools/post-execute`、注入 `developer` 角色消息、改写 `agent/request` 的调用配置、注册 `sessionProjections` 之外的投影键、把记忆塞进新的 `systemPrompt.context()`。

### 3.2 消息的可识别标记（契约级，唯一可靠判据）

```js
// dsh-mnemon/lib/index.js:8614-8631
const MNEMON_PLUGIN_SOURCE = "dsh-mnemon";
/** A user-role message this plugin adds to a step, marked with its own source. */
function createPluginMessage(text, form) {
	return structuredClone({
		id: randomUUID(),
		role: "user",
		content: [{ type: "text", text }],
		source: { kind: MNEMON_PLUGIN_SOURCE, form }
	});
}

// dsh-mnemon/lib/index.js:11781-11785
function isMnemonMessageSource(source) {
	if (typeof source !== "object" || source === null) return false;
	const { kind, plugin } = source;
	return kind === "dsh-mnemon" || kind === `plugin:dsh-mnemon` || kind === "plugin" && plugin === "dsh-mnemon";
}
```

即 Mnemon 注入消息的**完整形态**：

- `role: "user"`（不是 `developer`、不是 `system`）
- `source.kind: "dsh-mnemon"`（历史/兼容形态：`"plugin:dsh-mnemon"` 或 `{kind:"plugin", plugin:"dsh-mnemon"}`）
- `source.form: "recall" | "instructions"`
- `content[0].type === "text"`，整块文本

它自己判断"这条消息是不是我注入的"就用这个函数（11993 行 `decision.messages.some(m => isMnemonMessageSource(m.source))`；11789-11792 行用于 durable log）。**Token Manager 必须使用同一判据，不能靠文本。**

### 3.3 注入时机（`preStep` 的确切行为）

```js
// dsh-mnemon/lib/index.js:11983-12018（节选）
async preStep(payload, next) {
	if (payload.step === 1) this.cancelIdleReview(true);
	const decision = await next();                       // ← 先取内层（含核心 loop）的决定
	if (decision.kind === "reject" || payload.signal.aborted) { ... return decision; }
	if (!this.config.lifecycleEnabled) return decision;
	if (this.config.writeEnabled && this.config.writebackMode === "guided") this.recordTurnMessages(payload.turn, decision.messages);
	if (payload.step !== 1) return decision;
	if (decision.messages.some((message) => isMnemonMessageSource(message.source))) return decision;  // ← 幂等
	if (decision.messages.length === 0) return decision;
	const snapshot = this.memorySnapshotMessage();       // source.kind="dsh-mnemon", form="recall"
	...
	if (this.cueAlreadyVisible()) return { kind: "enter", messages: withSnapshot(decision.messages) };
	const reminder = guidedReminder(...);                // source.kind="dsh-mnemon", form="instructions"
	...
	return { kind: "enter", messages: withSnapshot([...decision.messages,
		createPluginMessage(reminder, "instructions")]) };
}
```

两个要点：
1. 它是**先 `await next()` 再追加**——所以它越靠链外层，追加得越晚。
2. 只在 `payload.step === 1` 注入，且已有 Mnemon 消息时跳过（幂等保护）。

### 3.4 真实会话日志实测（durable log 里的实际样子）

会话日志在 `DSH_HOME\sessions\<编码后的 cwd>\<sessionId>\session.v4.jsonl.zstd`，是**逐帧 zstd 拼接**（首帧是 header，之后每帧一段 JSONL）。用 Node 24 的 `zlib.zstdDecompressSync` 按 `28 B5 2F FD` 魔数切帧后解码：

```powershell
node zstd-scan.mjs 'C:\Users\Administrator\.dsh\sessions\--E-ZHIRAI~0020Harness--\session-b7153413-…\session.v4.jsonl.zstd'
```

输出（真实数据摘要）：

```
magic offsets found: 222
lines: 400 bytes: 1232547
source.kind histogram:
  [["system-prompt",1],["user",1],["agent-instructions",1],["runtime-context",1],
   ["skill-catalog",1],["time-context",1],["dsh-mnemon",2],["model",49],["tool",78]]
samples:
 { type:"user/message", seq:14, role:"user",
   source:{ kind:"dsh-mnemon", form:"instructions" },
   head:"[MNEMON] Search Documents for substantial project records, and use mnemon_runtim" }
 { type:"user/message", seq:15, role:"user",
   source:{ kind:"dsh-mnemon", form:"recall" },
   head:"MNEMON RUNTIME MEMORY SNAPSHOT\nEntry annotations default to importance=normal an" }
```

另一份会话（子代理）日志里还有 `agent-message`（`form:"relay"`、`senderSessionId`，即 Teammate 消息）——同样 `role:"user"`、同样只有 `source` 能区分。

**同一日志暴露出的完整 `source.kind` 分类法（实测）**：

| kind | 事件类型 | 谁注入 |
| --- | --- | --- |
| `system-prompt` | `system/message` | DSH 系统提示 |
| `user` | `user/message` | 真实用户（带 `rpcId`、`clientTimeZone`） |
| `agent-instructions` | `user/message` | AGENTS.md 等指令（带 `baseline`、`changes[]`） |
| `runtime-context` | `user/message` | 宿主运行时快照（`form:"snapshot"`, `sections[]`） |
| `skill-catalog` | `user/message` | 技能目录（`form:"catalog"`, `entries[]`） |
| `time-context` | `user/message` | 时间快照（`form:"snapshot"`, `sections[]`） |
| `agent-message` | `user/message` | Teammate/子代理转述（`form:"relay"`） |
| `dsh-mnemon` | `user/message` | **Mnemon 记忆**（`form:"recall"｜"instructions"`） |
| `model` | `assistant/message` | 模型 |
| `tool` | `tool/result` | 工具结果（带 `callId`） |

**推论（写进实现）：只有 `source.kind === "user"` 是真实用户输入；其余全是"注入上下文"。** 这条比任何文本前缀都稳。

### 3.5 文本前缀只能当辅助信号

- `"[MNEMON] "` 前缀在 `guidedReminder`（11846-11853）里拼接；
- `"MNEMON RUNTIME MEMORY SNAPSHOT"` 在 `dsh-mnemon-source-runtime/lib/index.js:441-452` 里拼接；
- 但 `guidedReminder` 会优先采用当前 Strategy 提供的 `guidance.reminders.*`（11849-11850），**前缀可被策略覆盖**。所以文本匹配只能用于 debug 日志，禁止作为跳过/裁剪逻辑的判据。

### 3.6 Token Manager 如何"绝不误伤"

判据（实现建议，伪代码）：

```ts
const MNEMON_KINDS = new Set(["dsh-mnemon", "plugin:dsh-mnemon"]);
function isMnemonSource(src: any): boolean {
  if (!src || typeof src !== "object") return false;
  if (MNEMON_KINDS.has(src.kind)) return true;
  return src.kind === "plugin" && src.plugin === "dsh-mnemon";
}
const isRealUserMessage = (m: any) => m?.source?.kind === "user";
```

规则：
1. `isMnemonSource(m.source)` 的消息 → **保留、原序、原文**；可以计入 token 统计，但绝不删除/改写/合并/重排。
2. 需要"裁剪上下文"时，只把 `isRealUserMessage` 的消息当作候选，且优先裁 `tool` 角色的历史结果（`source.kind === "tool"`），而不是 Mnemon 记忆。
3. 不去猜 `content[0].text` 里的 `[MNEMON]` / `MNEMON RUNTIME MEMORY SNAPSHOT`。

---

## 4. 顺序与兼容红线

### 4.1 层叠顺序：patch 顺序是确定的，**加载/激活顺序不是**

```yaml
# C:\Users\Administrator\.dsh\profiles\desktop\cordis.yml:1-3
# dsh profile root — an empty entry list. The tree is composed as patches:
# each bundle in package.json's dsh.profile.bundles, then cordis.patch.yml, then any
# --patch overlays. Edit cordis.patch.yml, not this file.
```

本机 bundle 顺序（`profiles\desktop\package.json:4-18`）：

```
@deepseek-ai/dsh-base → @deepseek-ai/dsh-web-app → …voice-input… → …auto-review…
→ …agent-team-profile… → …plugin-market… → dsh-pet → dsh-better-sidebar → dsh-mnemon
```

（`dsh-mnemon` 在最后；`dsh plugin add` 会把包名追加到该数组末尾——Lead 实测。）

但**行序/层序不等于加载顺序**，官方 patch 自己写明了：

```yaml
# dsh-base patch:11-13
# Row order carries no load semantics (activation is service-availability
# driven); the grouping is for readers.
```

同文件 1-3 行还说明层叠语义："later bundle patches and the user's profile `cordis.patch.yml` address these rows by id, with **the last write winning per row**"。→ **bundle 顺序只决定"同 id 配置谁覆盖谁"，不决定谁先 `ctx.on`。**

### 4.2 waterfall 监听器顺序语义（Cordis 源码原文）

```ts
// app.asar\...\@deepseek-ai\cordis\src\events.ts:111-117
export interface EventOptions {
  /** Add the listener before existing listeners for the same event. */
  prepend?: boolean
  /** Receive the event regardless of context filter checks. */
  global?: boolean
}

// events.ts:254-260  —— 真正决定位置的地方
register(label, hooks, callback, options): () => void {
  const method = options.prepend ? 'unshift' : 'push'
  return this.ctx.fiber.effect(() => {
    hooks[method]({ ctx: this.ctx, callback, ...options })
    return () => this.unregister(hooks, callback)
  }, label)
}

// events.ts:234-243  —— 最前面的监听器最外层
waterfall(...args) {
  const cbs = this.dispatch('waterfall', args)
  const inner = args.pop()
  const next = () => { const cb = cbs.shift() ?? inner; return cb(...args) }
  args.push(next)
  return next()
}
```

结论：
- 监听器位置 = **注册顺序 × `prepend`**：后注册普通监听器在末尾（最内层）；**`prepend:true` 后注册者在最前（最外层）**。
- `agent/pre-step` 与 `system-prompt/assemble` 都是 **waterfall**（`cordis_inspect_query(host, Event, listEvents,{event})` 原文：`mode: "waterfall"`）；`agent/created` 是 **serial**（按注册顺序执行，遇 bail 停）。
- `systemPrompt.section()` 的 `order` 数字只影响**系统提示段落排序**（mnemon 用 `order:150`），**不是事件监听器排序**。

### 4.3 想"在 Mnemon 注入之后运行"的可行手段

先看清事实：mnemon 的 `preStep` 是"先 `await next()` 再追加"，所以

```
外层(先) … → 内层(后) … → 核心 loop 返回 D0
← 内层返回 D1 ← … ← mnemon 收到 D1 后追加 → 返回 D1+mnemon
```

- **比 mnemon 更靠外的监听器能看到它追加的消息**；比它更靠内的看不到。
- `prepend:true` 越晚注册越靠外，`push`（默认）越早注册越靠外。

可行手段：

| 手段 | 做法 | 评价 |
| --- | --- | --- |
| A. 观察最终消息 | `agent.ctx.on("agent/pre-step", h, { prepend: true })`，在 `h` 里 `const d = await next()` 后再读 `d.messages` | 能看到 mnemon 追加的消息；**必须原样保留 `isMnemonSource` 的消息**，否则就是误伤 |
| B. 不依赖顺序（推荐） | ① 用 `session/event`（post-commit，`mode:"emit"`）看实际写入日志的 `user/message`（含 mnemon 的 `source.kind`）；② 用 `system-prompt/assemble` 取最终 prompt 做统计/加自己的段落 | 谁先谁后都正确；这是唯一"结构性正确"的写法 |
| C. 靠 patch/bundle 顺序 | — | **不可行**：bundle 顺序只决定配置覆盖（4.1）；`agent/pre-step` 是 agent 级 ctx 上的监听，注册发生在各自 `agent/created` 处理里（mnemon：12274-12278） |
| D. 用 `order` 数字 | — | **不可行**：`order` 属于 `systemPrompt.section/context`，与监听器无关 |

另外：**如果要统计"最终送给模型的 token"**，优先用官方 `ctx.tokenMeter`（`cordis_inspect_query(host, Service, tokenMeter)`：`measure(session, requestHeader?)`、`estimateMessage(message)`），不要自研估算器与官方口径打架（本任务范围外，仅提示）。

### 4.4 验证方法（隔离环境，不动 desktop profile）

Lead 已备好隔离 profile（`C:\Users\Administrator\.dsh\profiles\tm-sandbox`，bundles 只有 base + web-app + 探测 bundle；`dsh tm-sandbox --port 62300 --no-open` 启动；`dsh plugin --profile tm-sandbox add file:<path>` 安装）。验证监听器顺序的最小探测：

1. 探测插件在 `agent/created` 里挂 `agent/pre-step`（`{prepend:true}` 与默认各一次，用两个不同 id 的监听），在 step 1 打印：
   - `payload.messages.map(m => [m.id, m.source?.kind])`
   - `(await next()).messages.map(...)`（外层才能看到 mnemon 的追加）
   - `assembly.sections.map(s => s.name)`（在 `system-prompt/assemble` 里）
2. 分别把 `dsh-mnemon` 放在 bundles 末尾 / 前面，各跑一次，观察打印顺序是否变化 → 用于证伪"bundle 顺序决定监听器顺序"。
3. **开发循环注意**：`dsh plugin add file:<path>` 走 pnpm `file:` 会**硬链接复制**内容，源码改动不生效；可在 profile 的 `node_modules\<pkg>` 用 `cmd /c mklink /J` 建 junction 指向工作区（Lead 已验证 junction 下 HMR/重载拿得到新代码）。junction 状态下**不要**再 `dsh plugin add`，否则 junction 会被替换成硬链接副本。

### 4.5 兼容红线（硬性，按严重度排序）

1. **绝不删除/改写/重排 `source.kind === "dsh-mnemon"` 的消息**。mnemon 用 `cueAlreadyVisible()`（11962-11965）扫 surface 判断提醒是否还在，用它自己的消息做 View/Wake 生命周期；删掉会破坏它的幂等与引导逻辑。
2. **只把 `source.kind === "user"` 当真实用户轮次**；其余 kind（`agent-instructions`/`runtime-context`/`skill-catalog`/`time-context`/`agent-message`/`dsh-mnemon`）都是注入上下文，不能计成"用户消息"或按用户消息裁剪。
3. **不要按文本前缀判断 Mnemon**（`[MNEMON] `、`MNEMON RUNTIME MEMORY SNAPSHOT` 均可被 Strategy 覆盖，见 3.5）。
4. **不要 prune / block `mnemon_*` 工具调用与结果**：mnemon 的 `reviewCheckpoint` 从 durable log 读 `tool/result` 文本（8583-8611，尤其 8596-8605），`memoryToolCalls` 按 `name.startsWith("mnemon_")` 计数（11796-11798）；裁掉它的召回/记忆工具结果会让它的记忆维护看到残缺证据。
5. **不要移除或改名系统提示段落** `mnemon:routing`、`mnemon:strategy`；不要复用 `mnemon:` 前缀命名自己的段落/context（它按名字过滤旧段落：7957-7961）。
6. **不要复用 projection key** `mnemonSubagentTokenUsage`（16237-16238）；自己的投影用独立 key。
7. **不要 `ctx.tools.restrict()` 把 `mnemon_*` 排除**（它只对自己的子 agent 用 restrict，8817）。
8. **自己注入的消息必须带独立 `source.kind`**（例 `dsh-token-manager`）。mnemon 只判断"是不是自己的"，不会误吞别人；但其他工具/UI 也需要能区分你注入的上下文。反过来，你也**不要**伪造 `dsh-mnemon` 的 kind。
9. 若 TM 自己也挂 `agent/pre-step`：必须保持 `kind:"enter"` + `messages` 语义与顺序、`startsRequestSeries` 不被误改；**不要 `reject`**（会直接掐掉整步）。
10. 不要修改 `dsh-mnemon` 源码或它的 `~/.mnemon` 数据；需要联动就通过公开扩展点（`session/event`、`agent/pre-step`、`systemPrompt.section`、`sessionProjections`）。

---

## 5. 卸载与数据保留

### 5.1 卸载时自动清理什么（Cordis fiber 语义）

```ts
// cordis/src/fiber.ts:68-75（Disposable 文档）
// "Disposers run in reverse registration order when the owning fiber unloads;
//  they may be async, in which case unloading awaits them."
// cordis/src/fiber.ts:402-442（effect 实现）
// "the disposers it produces are collected and run (in reverse order) either when
//  the returned disposer is called or when the fiber unloads, whichever comes first.
//  Calling the disposer twice is a no-op."
```

```ts
// cordis/src/events.ts:245-260 / 288-302
// ctx.on(...) 把监听器注册为 fiber.effect → fiber 卸载时自动移除（无需手工反注册）
```

逐项结论：

| 资源 | 卸载行为 | 证据 |
| --- | --- | --- |
| `ctx.on(...)` 事件监听 | 自动移除（fiber effect） | events.ts:254-260、288-302 |
| `ctx.tools.register(...)` | 返回 disposer，随 fiber 卸载移除 | `cordis_inspect_query(host, Service, tools)`：`register(definition): () => void` |
| `systemPrompt.section/context/tools/variable` | 均返回 `() => void`，随 fiber 卸载移除 | `cordis_inspect_query(host, Service, systemPrompt)` 契约 |
| `sessionProjections.register(...)` | **明确写着**注册是 effect："disposing the fiber (or calling the returned disposer) removes the key — and the unit's cached cells — from subsequent drives and snapshots"；"an unloaded domain plugin's key disappears from snapshots and clients read it as capability absence" | `cordis_inspect_query(host, Service, sessionProjections)` |
| `ctx.storageDomain.open(spec)` | **不随消费者 fiber 自动关**："the CALLER owns the returned handle and closes it via `Domain.close()` (typically as its own `ctx.effect` disposer) — the facility does not tie the domain to any consumer fiber"；facility 卸载时兜底 `closeAll()` | 同上 storageDomain 契约 |
| 客户端 UI（slot 注册） | 按插件契约随 client fiber 卸载移除；**本次未实测** | 见 §6 |

**实践要求**：所有 `ctx.on/register/section/...` 的返回值要么忽略（靠 fiber），要么用 `ctx.effect(() => dispose)` 包一层；**禁止**把监听器塞进模块级数组/单例而不清理，也不要用裸 `setInterval`（用 `ctx.setInterval`/`timer` 服务，`cordis_inspect_query(host, Service, timer)`）。

### 5.2 数据目录不会被自动清理

卸载（从 bundles 移除 / 禁用）只拆 fiber，**没有任何组件"拥有"`.dsh\dsh-token-manager` 这个目录**，所以它原样留下。这是刻意的（升级/重装不丢数据），但也意味着"卸载 = 清数据"不成立。

建议：
- `manifest.json` 写 `{ schemaVersion, pluginVersion, createdAt, lastOpenedAt }`，启动时校验；版本不兼容走迁移或"备份并跳过"（DSH 自己的 `storageDomain` 就支持 `invalidRecords: 'backup-and-skip'`，见其 DomainSpec 契约）。
- 文档里给用户三步卸载说明：① 从 bundles/设置里禁用或移除 → ② 重启宿主 → ③ 需要时手动删 `<dataDir>`（先备份）。
- 若数据目录建在 profile 内（**不推荐**），`dsh plugin add` 重装会把它连同 `node_modules` 一起清掉——这是"必须放 DSH_HOME"的另一个理由。

### 5.3 备份与恢复

备份（SQLite 单文件，两种都可行）：
```js
// A. 在线备份（Electron 的 node:sqlite 有 backup 导出，见 2.2）
const { DatabaseSync, backup } = require('node:sqlite');
// backup(source, destinationPath) —— 具体签名以运行期为准（导出存在，本次未写调用样例）
// B. 冷备：先 checkpoint 再整目录复制
db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
db.close();
// 复制 <dataDir> 整个目录（含 manifest.json、backups/）
```

- 轮转：`<dataDir>\backups\tm-<ISO8601>.db`，保留 N 份（默认 7），失败不阻塞主流程。
- 恢复：停宿主 → 覆盖 `<dataDir>\token-manager.db`（**同时删除残留 `-wal`/`-shm`**，否则可能复活旧页）→ 启动校验 `PRAGMA user_version` 与 `manifest.schemaVersion`。
- 迁移：`PRAGMA user_version` 单调递增 + 顺序迁移函数；不匹配时"备份现库 → 新建空库"，绝不原地赌博。

---

## 6. 未确认项

1. `…\profiles\desktop\var\` 的归属：只有一个残留 `ui-1-login.png`，无代码/文档证据表明它是官方 scratch 区。**不要**把它当插件数据区。
2. 在真实宿主里，`node:sqlite` 的 `ExperimentalWarning` 是否出现在 DSH 日志、是否会被视为噪声——未观察宿主 stderr。
3. `DatabaseSync`（同步 API）在宿主主线程上的阻塞成本未做基准；结论"要小批量、带 LIMIT"来自 API 性质推断，不是实测数字。
4. 两个插件在 **agent 级 ctx** 上 `ctx.on` 的先后是否稳定：取决于各自 `agent/created` 处理的注册序（服务激活驱动），**未实测**。这正是推荐"手段 B（不依赖顺序）"的原因。
5. 客户端 UI（slot）在插件卸载后是否 100% 清理：只看到契约与 mnemon 的 `slots.inject/register` 用法，未实测卸载。
6. `mnemon` README 中关于 `~/.mnemon` 与备份的说明未逐条核对（本审计以源码 + 落盘事实为准）。
7. `dsh-better-sidebar` 的 `~/.dsh/docs` 只来自 UI 文案（`client-editor.js:21527`），未读其配置解析代码确认默认值。
8. `tm-sandbox` 隔离 profile 与 junction 开发循环来自 Lead 实测，我未复测（按要求未触碰任何 profile）。
9. `sessionProjections` 是否有除 `mnemonSubagentTokenUsage` 之外的 Mnemon 键：已用 grep 全量扫 `dsh-mnemon*` 的 `lib/*.js`，只有 `dsh-mnemon/lib/index.js:16267-16268` 一处 `sessionProjections` 引用 → 结论"仅一个键"证据充分。
10. DSH 官方 `agent/pre-step` 的 `payload.messages` 与 `decision.messages` 在写入 durable log 时是否逐条保留 `source`：本次用真实日志反证了**保留**（`dsh-mnemon` 消息带 `form` 完整出现在 `user/message` 事件里），但没有读 `dsh-agent-loop` 源码逐行确认。

---

## 附录 A：本次实测命令与关键输出索引

| 目的 | 命令/文件 | 关键输出 |
| --- | --- | --- |
| DSH_HOME 布局 | `Get-ChildItem -Force C:\Users\Administrator\.dsh` | 无 `var/`、无 `plugins/`；有 `storages/`、`sessions/`、`dsh-pet/`、`llm-deepseek/` 等 |
| profile 布局 | `Get-ChildItem -Force …\profiles\desktop` | `package.json`、`cordis.yml`、`cordis.patch.yml`、`node_modules/`、`var/`（残留 png） |
| mnemon 数据根 | 读 `dsh-mnemon/lib/index.js:953-966` + 列 `C:\Users\Administrator\.mnemon` | `runtime/{memories.json,MEMORY.md,USER.md}`、`documents/`、`skills/` |
| mnemon packageDir | `cordis_inspect_query(host, Config, listConfigs, {name:"dsh-mnemon"})` | `C:\Users\Administrator\.dsh\profiles\desktop\node_modules\dsh-mnemon` |
| 官方包 packageDir | 同上，`{entry:"include:storage-json"}` | `…\app.asar\dsh\node_modules\@deepseek-ai\dsh-storage-json` |
| SQLite CLI | `node probe.mjs`（见 2.1） | node 24.14.0 / sqlite 3.51.2 / 读写回环 OK / journal=delete |
| SQLite 宿主 | `ELECTRON_RUN_AS_NODE=1 & "DeepSeek Harness.exe" -e …` | node 24.21.0 / electron 44.7.0 / `node:sqlite OK`（DatabaseSync, StatementSync, Session, constants, backup） |
| SQLite exFAT | WAL 探测（2.3） | `journal_mode after: wal`、200 行、重开 200、单文件 8192B（目录已删） |
| 真实会话 kind 直方图 | 逐帧 zstd 解码 session 日志（3.4） | 222 帧 / 400 事件 / 10 种 `source.kind` / 2 条 `dsh-mnemon` |

## 附录 B：给实现的速查

```ts
// 1) 数据根（不依赖官方包；与 dshHomePath/mnemon 同语义）
const home = process.env.DSH_HOME?.trim() || join(homedir(), ".dsh");
const dataDir = config.dataDir ?? process.env.DSH_TOKEN_MANAGER_DATA_DIR ?? join(home, "dsh-token-manager");

// 2) SQLite（宿主已内置，见 §2.2）
const { DatabaseSync } = await import("node:sqlite");
const db = new DatabaseSync(join(dataDir, "token-manager.db"));
db.exec("PRAGMA journal_mode = WAL");

// 3) Mnemon 保护墙（唯一判据：source，而不是文本）
const isMnemonSource = (s: any) =>
  s?.kind === "dsh-mnemon" || s?.kind === "plugin:dsh-mnemon" || (s?.kind === "plugin" && s?.plugin === "dsh-mnemon");
const isRealUser = (m: any) => m?.source?.kind === "user";

// 4) 统计口径优先用官方 tokenMeter，而不是自研估算
ctx.inject(["tokenMeter"], (c) => { /* c.tokenMeter.measure(session) */ });
```
