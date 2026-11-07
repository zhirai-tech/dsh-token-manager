// src/storage/db.ts
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// src/shared/constants.ts
var PLUGIN_NAME = "dsh-token-manager";
var PLUGIN_VERSION = "1.4.0";
var API_PREFIX = "/token-manager/api";
var SCHEMA_VERSION = 1;
var TASK_TYPES = [
  "simple-edit",
  "normal-dev",
  "complex-dev",
  "troubleshoot",
  "project-analysis"
];
var TASK_STATUSES = ["pending", "running", "completed", "paused", "failed"];
var READ_TOOLS = ["read", "read_file", "read_image", "view_file", "cat"];
var WRITE_TOOLS = ["write", "edit", "multi_edit", "apply_patch", "notebook_edit", "str_replace_editor"];
var COMMAND_TOOLS = ["pwsh", "bash", "shell", "run_command", "terminal"];
var BUILD_PATTERNS = [
  "(?:npm|pnpm|yarn|bun)\\s+(?:run\\s+)?(?:build|compile|bundle)",
  "\\btsc\\b",
  "\\bvite\\s+build\\b",
  "\\bwebpack\\b",
  "\\besbuild\\b",
  "\\bnext\\s+build\\b",
  "\\bcmake\\b",
  "\\bmsbuild\\b",
  "\\bdotnet\\s+build\\b",
  "\\bgo\\s+build\\b",
  "\\bcargo\\s+(?:build|check)\\b",
  "\\bmvn\\s+(?:package|install|compile)\\b",
  "\\bgradle\\w*\\s+build\\b"
];
var TEST_PATTERNS = [
  "(?:npm|pnpm|yarn|bun)\\s+(?:run\\s+)?test",
  "\\bvitest\\b",
  "\\bjest\\b",
  "\\bmocha\\b",
  "\\bplaywright\\s+test\\b",
  "\\bcypress\\s+(?:run|open)\\b",
  "\\bnode\\s+--test\\b",
  "\\bpytest\\b",
  "\\bgo\\s+test\\b",
  "\\bcargo\\s+test\\b",
  "\\bphpunit\\b"
];
var DEPLOY_PATTERNS = [
  "\\bdeploy\\b",
  "\\bpm2\\b",
  "\\bdocker\\s+(?:push|compose\\s+up)",
  "\\bkubectl\\s+apply\\b",
  "\\bssh\\b.*\\b(?:deploy|restart|systemctl)\\b",
  "\\brsync\\b",
  "\\bgit\\s+push\\b"
];
var DEFAULTS = {
  /** Master switch: capture usage records. */
  enabled: true,
  /** Analyze-only mode: never modify model context or limit calls (Phase 1). */
  observeOnly: true,
  /** Live top overlay (client half). */
  ui: { overlay: true },
  /** Per-analysis switches. */
  analytics: {
    repeatedRead: true,
    repeatedTool: true,
    repeatedBuild: true,
    repeatedTest: true,
    repeatedDeploy: true,
    confirmationRounds: true,
    repeatedPlan: true,
    repeatedSummary: true,
    stepInflation: true,
    cacheHitDrop: true,
    taskCostAnomaly: true
  },
  thresholds: {
    /** Same file read N times in one task with identical content is flagged. */
    repeatedReadCount: 2,
    /** Same tool + args + result N times. */
    repeatedToolCount: 2,
    /** Same command (normalized) N times. */
    repeatedCommandCount: 2,
    /** Assistant text length below this counts as a "short confirmation". */
    confirmationMaxChars: 240,
    confirmationRounds: 2,
    repeatedTextCount: 3,
    /** Step count above baseline p80 * factor triggers step_inflation. */
    inflationFactor: 1.5,
    /** Absolute caps for tiny tasks. */
    simpleEditCallCap: 6,
    normalDevCallCap: 15,
    /** Cache hit ratio below project median * factor triggers cache_hit_drop. */
    cacheDropFactor: 0.5,
    /** Cost anomaly factor over baseline p80. */
    costAnomalyFactor: 1.5,
    /** Minimum samples before a baseline is considered usable. */
    minBaselineSamples: 5
  },
  /** Keep raw prompt/tool text out of findings; truncate to this many chars. */
  evidenceTextLimit: 200,
  /** Notify (UI only) when a task exceeds its baseline; never blocks. */
  alertOnly: true
};
var SENSITIVE_KEY_REGEX = /(api[_-]?key|secret|password|passwd|token|authorization|bearer|credential)/i;
var CACHE_MODES = ["off", "observe", "on"];
var CONTENT_TYPES = [
  "text",
  "build-log",
  "test-output",
  "json",
  "xml",
  "file-list",
  "zip-list",
  "unknown"
];
var CACHE_SKIP_TOOLS = [
  "token_manager_read",
  "ask_user_question",
  "present",
  "session_event_read",
  "session_event_search",
  "session_event_trace",
  "session_search",
  "session_trace",
  "mnemon_view_route",
  "mnemon_view_action",
  "mnemon_recall",
  "mnemon_related",
  "mnemon_status",
  "mnemon_document_search",
  "mnemon_document_create",
  "mnemon_document_manage",
  "mnemon_runtime_memory",
  "mnemon_remember",
  "mnemon_link",
  "mnemon_forget",
  "mnemon_memory_bodies",
  "mnemon_memory_body_create",
  "mnemon_memory_body_update",
  "mnemon_memory_body_merge",
  "create_goal",
  "update_goal",
  "get_goal",
  "send_message",
  "spawn_teammate",
  "team_task_create",
  "team_task_update",
  "team_task_get",
  "team_task_list"
];
var CACHE_DEFAULTS = {
  /** off = 不处理；observe = 记录与存储但不替换模型可见内容；on = 替换为摘要。 */
  mode: "observe",
  /** 小于该字节数完全不处理。 */
  minBytes: 2048,
  /** 达到该字节数才允许“选择性摘要”。 */
  selectiveBytes: 10240,
  /** 达到该字节数才允许“智能压缩”。 */
  smartBytes: 51200,
  /** 单个 blob 上限，超过则放弃缓存并保留原文。 */
  maxBlobBytes: 64 * 1024 * 1024,
  /** 缓存目录总容量上限（MB）。 */
  maxCacheMB: 512,
  /** 缓存保留天数。 */
  ttlDays: 30,
  /** 摘要中保留的首尾行数。 */
  headLines: 40,
  tailLines: 20,
  /** 每类内容的开关。 */
  types: {
    text: true,
    "build-log": true,
    "test-output": true,
    json: true,
    xml: true,
    "file-list": true,
    "zip-list": true
  }
};
var CONTEXT_PROTECTED_SOURCES = [
  "user",
  "system-prompt",
  "agent-instructions",
  "runtime-context",
  "skill-catalog",
  "time-context",
  "dsh-mnemon",
  "plugin:dsh-mnemon"
];
var CONTEXT_PROTECTED_ROLES = ["system", "developer", "user"];
var CONTEXT_DEFAULTS = {
  mode: "dry-run",
  /** Only flag a duplicate when the same content appears at least this many times. */
  minOccurrences: 2,
  /** Do not analyze sessions with fewer surface nodes than this. */
  minSurfaceNodes: 4,
  /** Upper bound of candidates returned by one analysis. */
  maxCandidates: 50,
  /** Treat an optimization as risky when the invalidated suffix is larger than savings * factor. */
  riskFactor: 1.5,
  /** Cache-read price ratio used when a provider has no explicit price configured. */
  assumedCacheReadRatio: 0.1
};
var TASK_SUMMARY_FIELDS = [
  "objective",
  "completed",
  "decisions",
  "files",
  "apiChanges",
  "tests",
  "pending",
  "nextSteps",
  "tokenStats"
];
var TASK_SUMMARY_LABELS = {
  objective: { zh: "\u672C\u6B21\u76EE\u6807", en: "Objective" },
  completed: { zh: "\u5B9E\u9645\u5B8C\u6210\u5185\u5BB9", en: "Completed work" },
  decisions: { zh: "\u5173\u952E\u6280\u672F\u51B3\u7B56", en: "Key decisions" },
  files: { zh: "\u4FEE\u6539\u6587\u4EF6", en: "Changed files" },
  apiChanges: { zh: "\u63A5\u53E3\u53D8\u5316", en: "API changes" },
  tests: { zh: "\u6D4B\u8BD5\u7ED3\u679C", en: "Test results" },
  pending: { zh: "\u672A\u5B8C\u6210\u4E8B\u9879", en: "Open items" },
  nextSteps: { zh: "\u4E0B\u4E00\u6B65\u8BA1\u5212", en: "Next steps" },
  tokenStats: { zh: "Token \u4F7F\u7528\u7EDF\u8BA1", en: "Token usage" }
};
var PROJECT_SUMMARY_SECTIONS = [
  "overview",
  "architecture",
  "database",
  "apis",
  "completed",
  "status",
  "pending",
  "constraints"
];
var PROJECT_SUMMARY_LABELS = {
  overview: { zh: "\u9879\u76EE\u57FA\u672C\u60C5\u51B5", en: "Overview" },
  architecture: { zh: "\u6280\u672F\u67B6\u6784", en: "Architecture" },
  database: { zh: "\u6570\u636E\u5E93\u7ED3\u6784", en: "Database" },
  apis: { zh: "\u5173\u952E\u63A5\u53E3", en: "Key APIs" },
  completed: { zh: "\u5DF2\u5B8C\u6210\u6A21\u5757", en: "Completed modules" },
  status: { zh: "\u5F53\u524D\u5F00\u53D1\u72B6\u6001", en: "Current status" },
  pending: { zh: "\u672A\u5B8C\u6210\u4E8B\u9879", en: "Open items" },
  constraints: { zh: "\u7528\u6237\u660E\u786E\u9650\u5236", en: "User constraints" }
};
var PROJECT_DEFAULTS = {
  /** Auto-draft facts are suggestions; the user edits them and saves a version. */
  autoDraft: true,
  maxProjects: 200
};
var REFERENCE_PRICES = [
  { match: "deepseek-reasoner", provider: "deepseek-account", cacheRead: 1, input: 4, cacheWrite: 0, output: 16 },
  { match: "deepseek-chat", provider: "deepseek-account", cacheRead: 0.5, input: 2, cacheWrite: 0, output: 8 },
  { match: "flash", provider: "deepseek-account", cacheRead: 0.5, input: 2, cacheWrite: 0, output: 8 }
];
var LIVE_REFERENCE_NOTE = "\u53C2\u8003\u4EF7\uFF1ADeepSeek \u516C\u5F00\u4EF7\uFF08\u4EBA\u6C11\u5E01 / \u767E\u4E07 tokens\uFF09\uFF0C\u975E\u5B9E\u65F6\u8D26\u5355\uFF0C\u53EF\u624B\u52A8\u4FEE\u6539";
var SAVED_TOKEN_BYTES = 4;
var LIVE_COMPRESS_THRESHOLD_DEFAULT = 0.25;
var LIVE_SAVED_NOTE = "\u8282\u7701 Token \u4E3A\u4F30\u7B97\uFF1A\u88AB\u538B\u7F29/\u590D\u7528\u7684\u5DE5\u5177\u8F93\u51FA\u5B57\u8282 \xF7 4\uFF0C\u975E API \u8FD4\u56DE\u503C\uFF1B\u8D39\u7528\u6309\u4EF7\u683C\u8868\u6298\u7B97\uFF0C\u4EC5\u4F9B\u53C2\u8003\u3002";
var EFFORT_LEVELS = ["off", "low", "high", "max"];
var AUTO_TASK_TYPES = ["simple-edit", "normal-dev", "complex-dev", "troubleshoot", "project-analysis"];
var AUTO_DEFAULTS = {
  /** AUTO master switch. When false the scheduler never calls model.select(). */
  enabled: false,
  /** Include child (subagent) sessions in AUTO scheduling. */
  includeSubagents: true,
  /** Initial effort per task type. Never above `maxInitial`. */
  initial: {
    "simple-edit": "off",
    "normal-dev": "low",
    "complex-dev": "low",
    troubleshoot: "low",
    "project-analysis": "low"
  },
  /** Hard cap for a task's first request: AUTO never starts at HIGH/MAX. */
  maxInitial: "low",
  /** Ladder used for step-by-step escalation (one level per decision). */
  ladder: [...EFFORT_LEVELS],
  /** Reasoning-failure count within one task that triggers one escalation step. */
  reasoningFailuresToEscalate: 2,
  /** A task touching at least this many files is complex enough to escalate on evidence. */
  filesForComplex: 3,
  /** Escalate when a still-running task reaches this many steps without progress. */
  maxStepsWithoutProgress: 40,
  /** Maximum escalation steps per task. */
  maxEscalationsPerTask: 3,
  /** Re-classify the task on every new user turn instead of reusing the previous effort. */
  resetOnNewTurn: true,
  /** Record decisions without calling model.select(). */
  monitorOnly: false,
  /** Session/event evidence is capped to keep memory bounded. */
  maxTrackedSessions: 64,
  maxEvidenceEvents: 200
};
var AUTO_TEXT_LIMIT = 2e3;

// src/storage/schema.ts
var SCHEMA_VERSION_V4 = 4;
var SCHEMA_V1_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  cwd TEXT,
  parent_session_id TEXT,
  origin TEXT,
  agent_preset TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  is_subagent INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  task_name TEXT NOT NULL,
  task_type TEXT NOT NULL,
  task_type_source TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL,
  origin TEXT NOT NULL,
  turn INTEGER,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  start_snapshot TEXT,
  end_snapshot TEXT,
  summary TEXT,
  interference INTEGER NOT NULL DEFAULT 0,
  first_prompt TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id, turn);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(task_type, status);

CREATE TABLE IF NOT EXISTS usage_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  task_id TEXT,
  turn INTEGER NOT NULL,
  step INTEGER NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  is_final INTEGER NOT NULL DEFAULT 1,
  provider TEXT,
  model TEXT,
  reasoning_effort TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  ts INTEGER NOT NULL,
  message_id TEXT,
  source TEXT NOT NULL DEFAULT 'live',
  UNIQUE(session_id, turn, step, attempt)
);
CREATE INDEX IF NOT EXISTS idx_usage_ts ON usage_records(ts);
CREATE INDEX IF NOT EXISTS idx_usage_task ON usage_records(task_id);
CREATE INDEX IF NOT EXISTS idx_usage_session ON usage_records(session_id, turn, step);

CREATE TABLE IF NOT EXISTS tool_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  task_id TEXT,
  turn INTEGER,
  step INTEGER,
  call_id TEXT,
  tool_name TEXT NOT NULL,
  args_hash TEXT,
  args_summary TEXT,
  target_path TEXT,
  command TEXT,
  result_hash TEXT,
  result_bytes INTEGER,
  is_error INTEGER,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tool_task ON tool_calls(task_id, tool_name, args_hash);
CREATE INDEX IF NOT EXISTS idx_tool_session ON tool_calls(session_id, turn, step);
CREATE INDEX IF NOT EXISTS idx_tool_callid ON tool_calls(session_id, call_id);

CREATE TABLE IF NOT EXISTS findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  task_id TEXT,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL,
  subject TEXT NOT NULL,
  detail TEXT,
  evidence TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(session_id, task_id, kind, subject)
);
CREATE INDEX IF NOT EXISTS idx_findings_task ON findings(task_id, kind);

CREATE TABLE IF NOT EXISTS task_baselines (
  task_type TEXT NOT NULL,
  project_id TEXT NOT NULL DEFAULT '*',
  sample_count INTEGER NOT NULL,
  median_calls REAL,
  p80_calls REAL,
  median_tokens REAL,
  p80_tokens REAL,
  median_cost REAL,
  p80_cost REAL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(task_type, project_id)
);

CREATE TABLE IF NOT EXISTS price_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  input_price REAL NOT NULL DEFAULT 0,
  cache_read_price REAL NOT NULL DEFAULT 0,
  cache_write_price REAL NOT NULL DEFAULT 0,
  output_price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CNY',
  unit_tokens INTEGER NOT NULL DEFAULT 1000000,
  effective_at INTEGER NOT NULL,
  UNIQUE(provider, model_name, effective_at)
);

CREATE TABLE IF NOT EXISTS kv (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
`;
var MIGRATION_V2_SQL = `
CREATE TABLE IF NOT EXISTS blobs (
  id TEXT PRIMARY KEY,
  hash TEXT UNIQUE NOT NULL,
  content_type TEXT,
  byte_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_accessed_at INTEGER,
  expires_at INTEGER,
  ref_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_blobs_hash ON blobs(hash);
CREATE INDEX IF NOT EXISTS idx_blobs_accessed ON blobs(last_accessed_at);

CREATE TABLE IF NOT EXISTS tool_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  task_id TEXT,
  turn INTEGER,
  step INTEGER,
  tool_name TEXT NOT NULL,
  arguments_hash TEXT,
  result_hash TEXT,
  blob_id TEXT,
  original_size INTEGER NOT NULL DEFAULT 0,
  compressed_size INTEGER,
  compression_type TEXT,
  mode TEXT,
  created_at INTEGER NOT NULL,
  dedupe_of INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tool_results_session ON tool_results(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tool_results_reuse ON tool_results(tool_name, arguments_hash, result_hash);
CREATE INDEX IF NOT EXISTS idx_tool_results_blob ON tool_results(blob_id);
CREATE INDEX IF NOT EXISTS idx_tool_results_reuse_session ON tool_results(session_id, tool_name, arguments_hash, result_hash);
`;
var MIGRATION_V3_SQL = `
CREATE TABLE IF NOT EXISTS optimization_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT,
  session_id TEXT NOT NULL,
  optimization_type TEXT NOT NULL,
  original_tokens_estimated INTEGER NOT NULL,
  optimized_tokens_estimated INTEGER NOT NULL,
  actual_input_delta INTEGER,
  cache_delta INTEGER,
  estimated_savings INTEGER NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'proposed',
  detail TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_optimization_session ON optimization_records(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_optimization_task ON optimization_records(task_id);
`;
var MIGRATION_V4_SQL = `
CREATE TABLE IF NOT EXISTS project_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  summary TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;
var SCHEMA_SQL = `${SCHEMA_V1_SQL}
${MIGRATION_V2_SQL}
${MIGRATION_V3_SQL}
${MIGRATION_V4_SQL}`;

// src/storage/db.ts
var TARGET_SCHEMA_VERSION = Math.max(SCHEMA_VERSION, SCHEMA_VERSION_V4);
function resolveDataDir(configDataDir) {
  const explicit = configDataDir?.trim();
  if (explicit) return explicit;
  const envDir = process.env.DSH_TOKEN_MANAGER_DATA_DIR?.trim();
  if (envDir) return envDir;
  const home = process.env.DSH_HOME?.trim() || join(homedir(), ".dsh");
  return join(home, "dsh-token-manager");
}
function openStore(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const path = join(dataDir, "token-manager.db");
  const raw = new DatabaseSync(path);
  try {
    raw.exec("PRAGMA journal_mode = WAL");
    raw.exec("PRAGMA synchronous = NORMAL");
    raw.exec("PRAGMA foreign_keys = ON");
  } catch {
  }
  const statements = /* @__PURE__ */ new Map();
  const prepare = (sql) => {
    let stmt = statements.get(sql);
    if (!stmt) {
      stmt = raw.prepare(sql);
      statements.set(sql, stmt);
    }
    return stmt;
  };
  const store = {
    path,
    run(sql, ...params) {
      const info = prepare(sql).run(...params);
      return {
        changes: Number(info.changes ?? 0),
        lastInsertRowid: Number(info.lastInsertRowid ?? 0)
      };
    },
    get(sql, ...params) {
      const row = prepare(sql).get(...params);
      return row;
    },
    all(sql, ...params) {
      return prepare(sql).all(...params);
    },
    exec(sql) {
      raw.exec(sql);
    },
    tx(fn) {
      raw.exec("BEGIN");
      try {
        const result = fn();
        raw.exec("COMMIT");
        return result;
      } catch (error) {
        try {
          raw.exec("ROLLBACK");
        } catch {
        }
        throw error;
      }
    },
    metaGet(key) {
      const row = store.get("SELECT value FROM meta WHERE key = ?", key);
      return row?.value;
    },
    metaSet(key, value) {
      store.run("INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
    },
    close() {
      statements.clear();
      try {
        raw.close();
      } catch {
      }
    }
  };
  migrate(store);
  store.metaSet("plugin_version", PLUGIN_VERSION);
  return store;
}
function readSchemaVersion(store) {
  try {
    const row = store.get("PRAGMA user_version");
    const value = Number(row?.user_version ?? 0);
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
  } catch {
    return 0;
  }
}
function migrate(store) {
  const version = readSchemaVersion(store);
  const target = TARGET_SCHEMA_VERSION;
  if (version >= target) return;
  try {
    if (version === 0) {
      store.exec(SCHEMA_SQL);
    } else {
      if (version < 2) store.exec(MIGRATION_V2_SQL);
      if (version < 3) store.exec(MIGRATION_V3_SQL);
      if (version < 4) store.exec(MIGRATION_V4_SQL);
    }
    if (version < 4) ensureTaskColumns(store);
    store.exec(`PRAGMA user_version = ${target}`);
  } catch (error) {
    try {
      store.metaSet(
        "last_error",
        JSON.stringify({
          ts: Date.now(),
          where: "storage.migrate",
          message: String(error?.message ?? error),
          fromVersion: version,
          targetVersion: target
        })
      );
    } catch {
    }
    throw error;
  }
}
function storeWritable(store) {
  try {
    store.run("INSERT INTO kv(k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", "__health__", String(Date.now()));
    return true;
  } catch {
    return false;
  }
}
function tableColumns(store, table) {
  const names = /* @__PURE__ */ new Set();
  try {
    const rows = store.all(`PRAGMA table_info(${table})`);
    for (const row of rows) {
      if (row && typeof row.name === "string") names.add(row.name);
    }
  } catch {
  }
  return names;
}
function addColumnIfMissing(store, table, column, ddlType) {
  if (tableColumns(store, table).has(column)) return;
  store.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddlType}`);
}
function ensureTaskColumns(store) {
  const columns = tableColumns(store, "tasks");
  if (columns.size === 0) return;
  if (!columns.has("merged_into")) addColumnIfMissing(store, "tasks", "merged_into", "TEXT");
  if (!columns.has("updated_at")) addColumnIfMissing(store, "tasks", "updated_at", "INTEGER");
  try {
    store.exec("CREATE INDEX IF NOT EXISTS idx_tasks_merged ON tasks(merged_into)");
  } catch {
  }
}

// src/storage/blob-store.ts
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync as mkdirSync2, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join as join2 } from "node:path";
var BLOB_COLUMNS = "id, hash, content_type, byte_size, storage_path, created_at, last_accessed_at, expires_at, ref_count";
var MAX_DETAILS = 500;
function mapBlobRow(row) {
  return {
    id: String(row.id),
    hash: String(row.hash),
    contentType: row.content_type === null || row.content_type === void 0 ? "" : String(row.content_type),
    byteSize: Number(row.byte_size) || 0,
    storagePath: String(row.storage_path ?? ""),
    createdAt: Number(row.created_at) || 0,
    lastAccessedAt: row.last_accessed_at === null || row.last_accessed_at === void 0 ? null : Number(row.last_accessed_at),
    expiresAt: row.expires_at === null || row.expires_at === void 0 ? null : Number(row.expires_at),
    refCount: Number(row.ref_count) || 0
  };
}
function toBuffer(input) {
  if (typeof input === "string") return Buffer.from(input, "utf8");
  if (input instanceof Buffer) return input;
  return Buffer.from(input);
}
function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function createBlobStore(options) {
  const dataDir = String(options?.dataDir ?? "").trim();
  if (!dataDir) throw new Error("createBlobStore requires dataDir");
  let ownsStore = false;
  let store;
  if (options.store) {
    store = options.store;
  } else {
    store = openStore(dataDir);
    ownsStore = true;
  }
  const maxBlobBytes = toNumber(options.maxBlobBytes, 0) > 0 ? Math.trunc(toNumber(options.maxBlobBytes, 0)) : CACHE_DEFAULTS.maxBlobBytes;
  const blobsDir = join2(dataDir, "blobs");
  try {
    mkdirSync2(blobsDir, { recursive: true });
  } catch {
  }
  const recordError = (where, error) => {
    try {
      store.metaSet(
        "last_error",
        JSON.stringify({ ts: Date.now(), where, message: String(error?.message ?? error) })
      );
    } catch {
    }
  };
  const canonicalRel = (hash) => `blobs/${hash.slice(0, 2)}/${hash}`;
  const canonicalPath = (hash) => join2(blobsDir, hash.slice(0, 2), hash);
  const resolveRowPath = (row) => {
    const storagePath = typeof row.storage_path === "string" ? row.storage_path : "";
    if (!storagePath) return canonicalPath(String(row.hash));
    return isAbsolute(storagePath) ? storagePath : join2(dataDir, storagePath);
  };
  const findRow = (idOrHash) => {
    const text = String(idOrHash ?? "").trim();
    if (!text) return void 0;
    const lower = text.toLowerCase();
    return store.get(
      `SELECT ${BLOB_COLUMNS} FROM blobs WHERE id = ? OR hash = ? OR hash = ? LIMIT 1`,
      text,
      text,
      lower
    );
  };
  const markCorrupt = (row, kind, detail) => {
    try {
      store.metaSet(
        "last_error",
        JSON.stringify({ ts: Date.now(), where: "blobStore", kind, hash: String(row.hash), detail: detail ?? "" })
      );
      store.metaSet(`blob_corrupt:${String(row.hash)}`, String(Date.now()));
    } catch {
    }
  };
  const touch = (row, now) => {
    try {
      store.run("UPDATE blobs SET last_accessed_at = ? WHERE id = ?", now, String(row.id));
    } catch {
    }
  };
  const readVerified = (row) => {
    const path = resolveRowPath(row);
    let bytes;
    try {
      bytes = readFileSync(path);
    } catch (error) {
      markCorrupt(row, "missing_file", String(error?.message ?? error));
      throw new Error(`blob file missing: ${String(row.hash)}`);
    }
    const actual = sha256Hex(bytes);
    if (actual !== String(row.hash)) {
      markCorrupt(row, "hash_mismatch", `expected ${String(row.hash)} actual ${actual}`);
      throw new Error(`blob corrupted (hash mismatch): ${String(row.hash)}`);
    }
    return bytes;
  };
  const writeAtomic = (target, bytes, hash) => {
    mkdirSync2(dirname(target), { recursive: true });
    const tmpPath = `${target}.${randomUUID()}.tmp`;
    writeFileSync(tmpPath, bytes);
    try {
      const back = readFileSync(tmpPath);
      if (sha256Hex(back) !== hash) throw new Error("blob write verification failed (hash mismatch)");
      if (existsSync(target)) {
        rmSync(tmpPath, { force: true });
      } else {
        try {
          renameSync(tmpPath, target);
        } catch (error) {
          if (existsSync(target)) rmSync(tmpPath, { force: true });
          else throw error;
        }
      }
      const finalBytes = readFileSync(target);
      if (sha256Hex(finalBytes) !== hash) throw new Error("blob readback verification failed (hash mismatch)");
    } catch (error) {
      try {
        rmSync(tmpPath, { force: true });
      } catch {
      }
      throw error;
    }
  };
  const stat = (idOrHash) => {
    try {
      const row = findRow(idOrHash);
      return row ? mapBlobRow(row) : null;
    } catch (error) {
      recordError("blobStore.stat", error);
      return null;
    }
  };
  const put = (input, contentType) => {
    try {
      const bytes = toBuffer(input);
      if (bytes.length > maxBlobBytes) {
        throw new Error(`blob too large: ${bytes.length} > ${maxBlobBytes}`);
      }
      const hash = sha256Hex(bytes);
      const now = Date.now();
      const existing = store.get(`SELECT ${BLOB_COLUMNS} FROM blobs WHERE hash = ? LIMIT 1`, hash);
      if (existing) {
        const target = canonicalPath(hash);
        let needsWrite = true;
        try {
          needsWrite = sha256Hex(readFileSync(target)) !== hash;
        } catch {
          needsWrite = true;
        }
        if (needsWrite) writeAtomic(target, bytes, hash);
        store.run(
          "UPDATE blobs SET ref_count = ref_count + 1, last_accessed_at = ?, byte_size = ?, storage_path = ? WHERE id = ?",
          now,
          bytes.length,
          canonicalRel(hash),
          String(existing.id)
        );
        return { record: mapBlobRow({ ...existing, byte_size: bytes.length, storage_path: canonicalRel(hash), last_accessed_at: now, ref_count: Number(existing.ref_count) + 1 }), created: false };
      }
      writeAtomic(canonicalPath(hash), bytes, hash);
      const id = randomUUID();
      store.run(
        `INSERT INTO blobs(id, hash, content_type, byte_size, storage_path, created_at, last_accessed_at, expires_at, ref_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(hash) DO UPDATE SET ref_count = blobs.ref_count + 1, last_accessed_at = excluded.last_accessed_at`,
        id,
        hash,
        contentType === null || contentType === void 0 ? "" : String(contentType),
        bytes.length,
        canonicalRel(hash),
        now,
        now,
        null
      );
      const row = store.get(`SELECT ${BLOB_COLUMNS} FROM blobs WHERE hash = ? LIMIT 1`, hash);
      if (!row) throw new Error("blob row missing after insert");
      return { record: mapBlobRow(row), created: String(row.id) === id };
    } catch (error) {
      recordError("blobStore.put", error);
      throw error;
    }
  };
  const requireRow = (idOrHash) => {
    const row = findRow(idOrHash);
    if (!row) throw new Error(`blob not found: ${String(idOrHash)}`);
    return row;
  };
  const getBytes = (idOrHash) => {
    try {
      const row = requireRow(idOrHash);
      const bytes = readVerified(row);
      touch(row, Date.now());
      return bytes;
    } catch (error) {
      if (!error?.message?.startsWith("blob ")) recordError("blobStore.getBytes", error);
      throw error;
    }
  };
  const getText = (idOrHash) => Buffer.from(getBytes(idOrHash)).toString("utf8");
  const exists = (hash) => {
    try {
      const row = findRow(String(hash));
      if (!row) return false;
      return existsSync(resolveRowPath(row));
    } catch {
      return false;
    }
  };
  const remove = (idOrHash) => {
    try {
      const row = findRow(idOrHash);
      if (!row) return false;
      try {
        rmSync(resolveRowPath(row), { force: true });
      } catch {
      }
      store.run("DELETE FROM blobs WHERE id = ?", String(row.id));
      return true;
    } catch (error) {
      recordError("blobStore.remove", error);
      return false;
    }
  };
  const walkFiles = (dir, out) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join2(dir, String(entry.name));
      if (entry.isDirectory()) walkFiles(full, out);
      else out.push(full);
    }
  };
  const usageBytes = () => {
    const files = [];
    walkFiles(blobsDir, files);
    let total = 0;
    for (const file of files) {
      try {
        total += readFileSync(file).length;
      } catch {
      }
    }
    return total;
  };
  const prune = (pruneOptions = {}) => {
    let removed = 0;
    let freedBytes = 0;
    try {
      const now = toNumber(pruneOptions.now, Date.now());
      const maxBytes = toNumber(pruneOptions.maxBytes, 0);
      const ttlDays = toNumber(pruneOptions.ttlDays, 0);
      const rows = store.all(`SELECT ${BLOB_COLUMNS} FROM blobs ORDER BY COALESCE(last_accessed_at, created_at) ASC`);
      const remaining = new Map(rows.map((row) => [String(row.id), row]));
      const referenced = /* @__PURE__ */ new Set();
      let referencesKnown = true;
      try {
        const refs = store.all("SELECT DISTINCT blob_id FROM tool_results WHERE blob_id IS NOT NULL");
        for (const ref of refs) referenced.add(String(ref.blob_id));
      } catch {
        referencesKnown = false;
      }
      const removeRow = (row) => {
        if (!remaining.has(String(row.id))) return;
        remaining.delete(String(row.id));
        try {
          rmSync(resolveRowPath(row), { force: true });
        } catch {
        }
        try {
          store.run("DELETE FROM blobs WHERE id = ?", String(row.id));
          removed += 1;
          freedBytes += Number(row.byte_size) || 0;
        } catch (error) {
          recordError("blobStore.prune.delete", error);
        }
      };
      for (const row of rows) {
        if (row.expires_at !== null && Number(row.expires_at) <= now) removeRow(row);
      }
      if (ttlDays > 0 && referencesKnown) {
        const cutoff = now - ttlDays * 864e5;
        for (const row of rows) {
          if (!remaining.has(String(row.id)) || referenced.has(String(row.id))) continue;
          const lastUsed = Number(row.last_accessed_at ?? row.created_at) || 0;
          if (lastUsed < cutoff) removeRow(row);
        }
      }
      if (maxBytes > 0 && referencesKnown) {
        let total = 0;
        for (const row of remaining.values()) total += Number(row.byte_size) || 0;
        const ordered = [...remaining.values()].filter((row) => !referenced.has(String(row.id))).sort((a, b) => Number(a.last_accessed_at ?? a.created_at) - Number(b.last_accessed_at ?? b.created_at));
        for (const row of ordered) {
          if (total <= maxBytes) break;
          total -= Number(row.byte_size) || 0;
          removeRow(row);
        }
      }
      return { removed, freedBytes };
    } catch (error) {
      recordError("blobStore.prune", error);
      return { removed, freedBytes };
    }
  };
  const verify = (verifyOptions = {}) => {
    const result = { missingFiles: 0, orphanFiles: 0, hashMismatch: 0, repaired: 0, details: [] };
    const repair = verifyOptions?.repair === true;
    const pushDetail = (detail) => {
      if (result.details.length < MAX_DETAILS) result.details.push(detail);
    };
    try {
      const rows = store.all(`SELECT ${BLOB_COLUMNS} FROM blobs`);
      const knownHashes = /* @__PURE__ */ new Set();
      for (const row of rows) {
        const hash = String(row.hash);
        knownHashes.add(hash);
        const path = resolveRowPath(row);
        let bytes = null;
        try {
          bytes = readFileSync(path);
        } catch {
          bytes = null;
        }
        if (bytes === null) {
          result.missingFiles += 1;
          pushDetail(`missing:${hash}`);
          if (repair) {
            try {
              store.run("DELETE FROM blobs WHERE id = ?", String(row.id));
              result.repaired += 1;
            } catch (error) {
              recordError("blobStore.verify.repair", error);
            }
          }
          continue;
        }
        const actual = sha256Hex(bytes);
        if (actual !== hash) {
          result.hashMismatch += 1;
          pushDetail(`mismatch:${hash}`);
          if (repair) {
            try {
              rmSync(path, { force: true });
              store.run("DELETE FROM blobs WHERE id = ?", String(row.id));
              result.repaired += 1;
            } catch (error) {
              recordError("blobStore.verify.repair", error);
            }
          }
        }
      }
      const files = [];
      walkFiles(blobsDir, files);
      for (const file of files) {
        const name2 = file.split(/[\\/]/).pop() ?? "";
        const isTemp = name2.endsWith(".tmp");
        if (!isTemp && knownHashes.has(name2)) continue;
        result.orphanFiles += 1;
        pushDetail(`orphan:${name2}`);
        if (repair) {
          try {
            rmSync(file, { force: true });
            result.repaired += 1;
          } catch (error) {
            recordError("blobStore.verify.repair", error);
          }
        }
      }
      return result;
    } catch (error) {
      recordError("blobStore.verify", error);
      return result;
    }
  };
  const close = () => {
    if (!ownsStore) return;
    ownsStore = false;
    try {
      store.close();
    } catch {
    }
  };
  return { put, getText, getBytes, stat, exists, remove, usageBytes, prune, verify, close };
}

// src/storage/blob-repository.ts
var TR_COLUMNS = "id, session_id, task_id, turn, step, tool_name, arguments_hash, result_hash, blob_id, original_size, compressed_size, compression_type, mode, created_at, dedupe_of";
function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function nullableNum(value) {
  if (value === null || value === void 0) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function nullableStr(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function mapRecord(row) {
  return {
    id: safeNum(row.id),
    sessionId: String(row.session_id ?? ""),
    taskId: nullableStr(row.task_id),
    turn: nullableNum(row.turn),
    step: nullableNum(row.step),
    toolName: String(row.tool_name ?? ""),
    argumentsHash: nullableStr(row.arguments_hash),
    resultHash: nullableStr(row.result_hash),
    blobId: nullableStr(row.blob_id),
    originalSize: safeNum(row.original_size),
    compressedSize: nullableNum(row.compressed_size),
    compressionType: nullableStr(row.compression_type),
    mode: String(row.mode ?? ""),
    createdAt: safeNum(row.created_at),
    dedupeOf: nullableNum(row.dedupe_of)
  };
}
function createBlobRepository(store, blobStore) {
  const recordError = (where, error) => {
    try {
      store.metaSet(
        "last_error",
        JSON.stringify({ ts: Date.now(), where, message: String(error?.message ?? error) })
      );
    } catch {
    }
  };
  const recordToolResult = (row) => {
    try {
      const sessionId = String(row?.sessionId ?? "").trim();
      const toolName = String(row?.toolName ?? "").trim();
      if (!sessionId || !toolName) {
        recordError("blobRepository.recordToolResult", new Error("sessionId and toolName are required"));
        return 0;
      }
      const createdAt = Number.isFinite(Number(row.createdAt)) ? Number(row.createdAt) : Date.now();
      const info = store.run(
        `INSERT INTO tool_results(session_id, task_id, turn, step, tool_name, arguments_hash, result_hash, blob_id,
           original_size, compressed_size, compression_type, mode, created_at, dedupe_of)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        sessionId,
        row.taskId ?? null,
        row.turn ?? null,
        row.step ?? null,
        toolName,
        row.argumentsHash ?? null,
        row.resultHash ?? null,
        row.blobId ?? null,
        safeNum(row.originalSize),
        row.compressedSize ?? null,
        row.compressionType ?? null,
        String(row.mode ?? ""),
        createdAt,
        row.dedupeOf ?? null
      );
      return info.lastInsertRowid;
    } catch (error) {
      recordError("blobRepository.recordToolResult", error);
      return 0;
    }
  };
  const blobRecoverable = (blobId) => {
    try {
      const record = blobStore.stat(blobId);
      if (!record) return false;
      if (!blobStore.exists(record.hash)) return false;
      blobStore.getBytes(record.id);
      return true;
    } catch {
      return false;
    }
  };
  const findReusable = (query) => {
    try {
      const sessionId = String(query?.sessionId ?? "").trim();
      const toolName = String(query?.toolName ?? "").trim();
      const argumentsHash = query?.argumentsHash ?? null;
      const resultHash = query?.resultHash ?? null;
      if (!sessionId || !toolName) return null;
      if (argumentsHash === null && resultHash === null) return null;
      const row = store.get(
        `SELECT ${TR_COLUMNS} FROM tool_results
         WHERE session_id = ? AND tool_name = ? AND arguments_hash IS ? AND result_hash IS ? AND blob_id IS NOT NULL
         ORDER BY id DESC LIMIT 1`,
        sessionId,
        toolName,
        argumentsHash,
        resultHash
      );
      if (!row) return null;
      const record = mapRecord(row);
      if (!record.blobId || !blobRecoverable(record.blobId)) return null;
      return record;
    } catch (error) {
      recordError("blobRepository.findReusable", error);
      return null;
    }
  };
  const markAccessed = (blobId) => {
    try {
      const target = String(blobId ?? "").trim();
      if (!target) return;
      store.run("UPDATE blobs SET last_accessed_at = ? WHERE id = ? OR hash = ?", Date.now(), target, target.toLowerCase());
    } catch (error) {
      recordError("blobRepository.markAccessed", error);
    }
  };
  const listToolResults = (query) => {
    try {
      const where = [];
      const params = [];
      if (query?.sessionId) {
        where.push("tr.session_id = ?");
        params.push(String(query.sessionId));
      }
      if (query?.toolName) {
        where.push("tr.tool_name = ?");
        params.push(String(query.toolName));
      }
      const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
      const totalRow = store.get(`SELECT COUNT(*) AS n FROM tool_results tr ${clause}`, ...params);
      const total = safeNum(totalRow?.n);
      const limit = Math.min(500, Math.max(1, safeNum(query?.limit, 50)));
      const offset = Math.max(0, safeNum(query?.offset, 0));
      const rows = store.all(
        `SELECT tr.id, tr.session_id, tr.task_id, tr.turn, tr.step, tr.tool_name, tr.arguments_hash, tr.result_hash,
                tr.blob_id, tr.original_size, tr.compressed_size, tr.compression_type, tr.mode, tr.created_at, tr.dedupe_of,
                b.content_type AS blob_content_type, b.hash AS blob_hash
         FROM tool_results tr LEFT JOIN blobs b ON b.id = tr.blob_id
         ${clause}
         ORDER BY tr.id DESC LIMIT ? OFFSET ?`,
        ...params,
        limit,
        offset
      );
      return {
        total,
        rows: rows.map((row) => {
          const record = mapRecord(row);
          const hash = nullableStr(row.blob_hash);
          return {
            ...record,
            recoverable: hash !== null && blobStore.exists(hash),
            contentType: nullableStr(row.blob_content_type),
            hash
          };
        })
      };
    } catch (error) {
      recordError("blobRepository.listToolResults", error);
      return { total: 0, rows: [] };
    }
  };
  const stats = () => {
    try {
      const blobs = safeNum(store.get("SELECT COUNT(*) AS n FROM blobs")?.n);
      const totals = store.get(
        `SELECT COALESCE(SUM(original_size), 0) AS orig,
                COALESCE(SUM(COALESCE(compressed_size, original_size)), 0) AS comp
         FROM tool_results`
      );
      const totalOriginalBytes = safeNum(totals?.orig);
      const totalCompressedBytes = safeNum(totals?.comp);
      const dedupeCount = safeNum(
        store.get("SELECT COUNT(*) AS n FROM tool_results WHERE dedupe_of IS NOT NULL")?.n
      );
      let missingBlobs = 0;
      try {
        const refs = store.all(
          "SELECT DISTINCT blob_id FROM tool_results WHERE blob_id IS NOT NULL"
        );
        for (const ref of refs) {
          if (!blobRecoverable(String(ref.blob_id))) missingBlobs += 1;
        }
      } catch {
      }
      return {
        blobs,
        totalOriginalBytes,
        totalCompressedBytes,
        savedBytes: totalOriginalBytes - totalCompressedBytes,
        dedupeCount,
        missingBlobs
      };
    } catch (error) {
      recordError("blobRepository.stats", error);
      return {
        blobs: 0,
        totalOriginalBytes: 0,
        totalCompressedBytes: 0,
        savedBytes: 0,
        dedupeCount: 0,
        missingBlobs: 0
      };
    }
  };
  const blobForSession = (blobId, sessionId) => {
    try {
      const target = String(blobId ?? "").trim();
      if (!target) return null;
      const blob = blobStore.stat(target);
      if (!blob) return null;
      if (!blobRecoverable(blob.id)) return null;
      const row = sessionId === null ? store.get(
        `SELECT ${TR_COLUMNS} FROM tool_results WHERE blob_id = ? ORDER BY id DESC LIMIT 1`,
        blob.id
      ) : store.get(
        `SELECT ${TR_COLUMNS} FROM tool_results WHERE blob_id = ? AND session_id = ? ORDER BY id DESC LIMIT 1`,
        blob.id,
        String(sessionId)
      );
      return row ? mapRecord(row) : null;
    } catch (error) {
      recordError("blobRepository.blobForSession", error);
      return null;
    }
  };
  const clear = () => {
    let removed = 0;
    let freedBytes = 0;
    try {
      const countRow = store.get("SELECT COUNT(*) AS n FROM tool_results");
      removed = safeNum(countRow?.n);
      const bytesRow = store.get("SELECT COALESCE(SUM(byte_size), 0) AS n FROM blobs");
      freedBytes = safeNum(bytesRow?.n);
      const blobs = store.all("SELECT id FROM blobs");
      for (const blob of blobs) {
        try {
          blobStore.remove(String(blob.id));
        } catch (error) {
          recordError("blobRepository.clear.remove", error);
        }
      }
      store.run("DELETE FROM blobs");
      store.run("DELETE FROM tool_results");
      return { removed, freedBytes };
    } catch (error) {
      recordError("blobRepository.clear", error);
      return { removed, freedBytes };
    }
  };
  return { recordToolResult, findReusable, markAccessed, listToolResults, stats, blobForSession, clear };
}

// src/storage/optimization-repository.ts
var RECORD_COLUMNS = "id, task_id, session_id, optimization_type, original_tokens_estimated, optimized_tokens_estimated, actual_input_delta, cache_delta, estimated_savings, verified, status, detail, created_at";
function safeNum2(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function nullableNum2(value) {
  if (value === null || value === void 0) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function nullableStr2(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function mapRecord2(row) {
  return {
    id: safeNum2(row.id),
    taskId: nullableStr2(row.task_id),
    sessionId: String(row.session_id ?? ""),
    optimizationType: String(row.optimization_type ?? ""),
    originalTokensEstimated: safeNum2(row.original_tokens_estimated),
    optimizedTokensEstimated: safeNum2(row.optimized_tokens_estimated),
    actualInputDelta: nullableNum2(row.actual_input_delta),
    cacheDelta: nullableNum2(row.cache_delta),
    estimatedSavings: safeNum2(row.estimated_savings),
    verified: safeNum2(row.verified),
    status: String(row.status ?? "proposed"),
    detail: nullableStr2(row.detail),
    createdAt: safeNum2(row.created_at)
  };
}
function createOptimizationRepository(store) {
  const recordError = (where, error) => {
    try {
      store.metaSet(
        "last_error",
        JSON.stringify({ ts: Date.now(), where, message: String(error?.message ?? error) })
      );
    } catch {
    }
  };
  const record = (row) => {
    try {
      const sessionId = String(row?.sessionId ?? "").trim();
      const optimizationType = String(row?.optimizationType ?? "").trim();
      if (!sessionId || !optimizationType) {
        recordError("optimizationRepository.record", new Error("sessionId and optimizationType are required"));
        return 0;
      }
      const info = store.run(
        `INSERT INTO optimization_records(task_id, session_id, optimization_type, original_tokens_estimated,
           optimized_tokens_estimated, actual_input_delta, cache_delta, estimated_savings, verified, status, detail, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.taskId ?? null,
        sessionId,
        optimizationType,
        safeNum2(row.originalTokensEstimated),
        safeNum2(row.optimizedTokensEstimated),
        row.actualInputDelta ?? null,
        row.cacheDelta ?? null,
        safeNum2(row.estimatedSavings),
        row.verified ? 1 : 0,
        String(row.status || "proposed"),
        row.detail ?? null,
        Number.isFinite(Number(row.createdAt)) ? Number(row.createdAt) : Date.now()
      );
      return info.lastInsertRowid;
    } catch (error) {
      recordError("optimizationRepository.record", error);
      return 0;
    }
  };
  const list = (query) => {
    try {
      const where = [];
      const params = [];
      if (query?.sessionId) {
        where.push("session_id = ?");
        params.push(String(query.sessionId));
      }
      const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
      const total = safeNum2(store.get(`SELECT COUNT(*) AS n FROM optimization_records ${clause}`, ...params)?.n);
      const limit = Math.min(500, Math.max(1, safeNum2(query?.limit, 50)));
      const offset = Math.max(0, safeNum2(query?.offset, 0));
      const rows = store.all(
        `SELECT ${RECORD_COLUMNS} FROM optimization_records ${clause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
        ...params,
        limit,
        offset
      );
      return { total, rows: rows.map(mapRecord2) };
    } catch (error) {
      recordError("optimizationRepository.list", error);
      return { total: 0, rows: [] };
    }
  };
  const stats = () => {
    try {
      const row = store.get(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(estimated_savings), 0) AS estimated,
                COALESCE(SUM(CASE WHEN verified = 1 THEN estimated_savings ELSE 0 END), 0) AS verified
         FROM optimization_records`
      );
      return {
        total: safeNum2(row?.total),
        estimatedSavings: safeNum2(row?.estimated),
        verifiedSavings: safeNum2(row?.verified)
      };
    } catch (error) {
      recordError("optimizationRepository.stats", error);
      return { total: 0, estimatedSavings: 0, verifiedSavings: 0 };
    }
  };
  return { record, list, stats };
}

// src/storage/project-repository.ts
var PROJECT_COLUMNS = "id, project_id, version, summary, created_at, updated_at";
function safeNum3(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function parseSummary(raw) {
  if (typeof raw !== "string" || raw.length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}
function mapRecord3(row) {
  return {
    id: safeNum3(row.id),
    projectId: String(row.project_id ?? ""),
    version: safeNum3(row.version, 1),
    summary: parseSummary(row.summary),
    createdAt: safeNum3(row.created_at),
    updatedAt: safeNum3(row.updated_at)
  };
}
function createProjectRepository(store) {
  const recordError = (where, error) => {
    try {
      store.metaSet(
        "last_error",
        JSON.stringify({ ts: Date.now(), where, message: String(error?.message ?? error) })
      );
    } catch {
    }
  };
  const get = (projectId) => {
    try {
      const key = String(projectId ?? "").trim();
      if (!key) return null;
      const row = store.get(`SELECT ${PROJECT_COLUMNS} FROM project_summaries WHERE project_id = ?`, key);
      return row ? mapRecord3(row) : null;
    } catch (error) {
      recordError("projectRepository.get", error);
      return null;
    }
  };
  const upsert = (record) => {
    const projectId = String(record?.projectId ?? "").trim();
    if (!projectId) {
      recordError("projectRepository.upsert", new Error("projectId is required"));
      throw new Error("projectRepository.upsert requires projectId");
    }
    try {
      const existing = get(projectId);
      const now = Date.now();
      const version = existing ? existing.version + 1 : Math.max(1, safeNum3(record.version, 1));
      const createdAt = existing ? existing.createdAt : Number.isFinite(Number(record.createdAt)) && Number(record.createdAt) > 0 ? Number(record.createdAt) : now;
      const updatedAt = Number.isFinite(Number(record.updatedAt)) && Number(record.updatedAt) > 0 ? Number(record.updatedAt) : now;
      const summaryJson = JSON.stringify(record.summary && typeof record.summary === "object" ? record.summary : {});
      store.run(
        `INSERT INTO project_summaries(project_id, version, summary, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET
           version = excluded.version,
           summary = excluded.summary,
           updated_at = excluded.updated_at`,
        projectId,
        version,
        summaryJson,
        createdAt,
        updatedAt
      );
      const saved = get(projectId);
      if (saved) return saved;
      return { projectId, version, summary: parseSummary(summaryJson), createdAt, updatedAt };
    } catch (error) {
      recordError("projectRepository.upsert", error);
      throw error;
    }
  };
  const list = () => {
    try {
      return store.all(`SELECT ${PROJECT_COLUMNS} FROM project_summaries ORDER BY updated_at DESC, id DESC`).map(mapRecord3);
    } catch (error) {
      recordError("projectRepository.list", error);
      return [];
    }
  };
  return { get, upsert, list };
}

// src/host/settings-store.ts
var SETTINGS_KEY = "settings";
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function deepMerge(base, patch) {
  if (patch === void 0) return base;
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === void 0) continue;
    out[key] = isPlainObject(value) && isPlainObject(out[key]) ? deepMerge(out[key], value) : value;
  }
  return out;
}
function defaultSettings() {
  return JSON.parse(
    JSON.stringify({
      ...DEFAULTS,
      compression: CACHE_DEFAULTS,
      context: CONTEXT_DEFAULTS,
      auto: AUTO_DEFAULTS
    })
  );
}
function defaultsClone() {
  return defaultSettings();
}
function createSettingsStore(store) {
  let cache = null;
  const read = () => {
    if (cache) return cache;
    let parsed;
    try {
      const row = store.get("SELECT v FROM kv WHERE k = ?", SETTINGS_KEY);
      if (row && typeof row.v === "string" && row.v.length > 0) parsed = JSON.parse(row.v);
    } catch (error) {
      parsed = void 0;
      try {
        store.metaSet(
          "last_error",
          JSON.stringify({ ts: Date.now(), where: "settings.get", message: String(error?.message ?? error) })
        );
      } catch {
      }
    }
    cache = deepMerge(defaultsClone(), parsed);
    return cache;
  };
  const write = (value) => {
    store.run(
      "INSERT INTO kv(k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v",
      SETTINGS_KEY,
      JSON.stringify(value)
    );
  };
  return {
    get() {
      return read();
    },
    update(patch) {
      try {
        const merged = deepMerge(read(), patch ?? {});
        write(merged);
        cache = merged;
        return merged;
      } catch (error) {
        try {
          store.metaSet(
            "last_error",
            JSON.stringify({ ts: Date.now(), where: "settings.update", message: String(error?.message ?? error) })
          );
        } catch {
        }
        return read();
      }
    },
    reset() {
      try {
        store.run("DELETE FROM kv WHERE k = ?", SETTINGS_KEY);
      } catch {
      }
      cache = defaultsClone();
      return cache;
    }
  };
}

// src/host/cost-calculator.ts
var PRICE_COLUMNS = "id, provider, model_name, input_price, cache_read_price, cache_write_price, output_price, currency, unit_tokens, effective_at";
function mapPrice(row) {
  return {
    id: Number(row.id),
    provider: String(row.provider),
    modelName: String(row.model_name),
    inputPrice: Number(row.input_price ?? 0),
    cacheReadPrice: Number(row.cache_read_price ?? 0),
    cacheWritePrice: Number(row.cache_write_price ?? 0),
    outputPrice: Number(row.output_price ?? 0),
    currency: String(row.currency ?? "CNY"),
    unitTokens: Number(row.unit_tokens ?? 1e6),
    effectiveAt: Number(row.effective_at ?? 0)
  };
}
function safeNum4(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function round6(value) {
  return Math.round(value * 1e6) / 1e6;
}
function createCostCalculator(store, _settings) {
  const readPricingOptions = () => {
    let pricing = {};
    try {
      const raw = _settings?.get?.();
      pricing = raw && typeof raw.pricing === "object" && raw.pricing !== null ? raw.pricing : {};
    } catch {
      pricing = {};
    }
    const separate = pricing.reasoningBilledSeparately === true;
    const price = Number(pricing.reasoningPrice);
    return {
      reasoningBilledSeparately: separate,
      reasoningPrice: separate && Number.isFinite(price) && price >= 0 ? price : null
    };
  };
  const listPrices = () => {
    try {
      return store.all(`SELECT ${PRICE_COLUMNS} FROM price_configs ORDER BY effective_at DESC, id DESC`).map(mapPrice);
    } catch {
      return [];
    }
  };
  const priceFor = (provider, model) => {
    const p = typeof provider === "string" ? provider.trim() : "";
    const m = typeof model === "string" ? model.trim() : "";
    if (!p || !m) return null;
    try {
      const now = Date.now();
      const effective = store.get(
        `SELECT ${PRICE_COLUMNS} FROM price_configs WHERE provider = ? AND model_name = ? AND effective_at <= ? ORDER BY effective_at DESC, id DESC LIMIT 1`,
        p,
        m,
        now
      );
      if (effective) return mapPrice(effective);
      const latest = store.get(
        `SELECT ${PRICE_COLUMNS} FROM price_configs WHERE provider = ? AND model_name = ? ORDER BY effective_at DESC, id DESC LIMIT 1`,
        p,
        m
      );
      return latest ? mapPrice(latest) : null;
    } catch {
      return null;
    }
  };
  const costOf = (buckets, provider, model) => {
    const price = priceFor(provider, model);
    if (!price) return null;
    const unit = price.unitTokens > 0 ? price.unitTokens : 1e6;
    const sum = safeNum4(buckets?.inputTokens) * price.inputPrice + safeNum4(buckets?.cacheReadTokens) * price.cacheReadPrice + safeNum4(buckets?.cacheWriteTokens) * price.cacheWritePrice + safeNum4(buckets?.outputTokens) * price.outputPrice;
    if (!Number.isFinite(sum)) return null;
    return round6(sum / unit);
  };
  const reasoningPricing = () => {
    const options = readPricingOptions();
    return { billedSeparately: options.reasoningBilledSeparately, price: options.reasoningPrice };
  };
  const costOfDetailed = (buckets, provider, model, options = {}) => {
    const price = priceFor(provider, model);
    const unit = price && price.unitTokens > 0 ? price.unitTokens : 1e6;
    const options2 = readPricingOptions();
    const basis = options.usageBasis ?? null;
    const reasoningTokens = buckets?.reasoningTokens === void 0 || buckets?.reasoningTokens === null ? null : safeNum4(buckets.reasoningTokens);
    const reasoningEstimatedTokens = buckets?.reasoningEstimatedTokens === void 0 || buckets?.reasoningEstimatedTokens === null ? null : safeNum4(buckets.reasoningEstimatedTokens);
    const reasoningSource = reasoningTokens !== null ? "api" : reasoningEstimatedTokens !== null ? "estimated" : "missing";
    const notes = [];
    const line = (tokens, unitPrice) => ({
      tokens,
      price: price ? unitPrice : null,
      cost: price ? round6(tokens * unitPrice / unit) : null
    });
    const input = line(safeNum4(buckets?.inputTokens), price?.inputPrice ?? 0);
    const cacheRead = line(safeNum4(buckets?.cacheReadTokens), price?.cacheReadPrice ?? 0);
    const cacheWrite = line(safeNum4(buckets?.cacheWriteTokens), price?.cacheWritePrice ?? 0);
    const output = line(safeNum4(buckets?.outputTokens), price?.outputPrice ?? 0);
    let reasoning;
    if (!price) {
      reasoning = {
        tokens: reasoningTokens,
        price: null,
        cost: null,
        source: reasoningSource,
        estimatedTokens: reasoningEstimatedTokens,
        billed: reasoningSource === "missing" ? "unknown" : "included-in-output",
        note: "\u672A\u914D\u7F6E\u4EF7\u683C\uFF0C\u65E0\u6CD5\u4F30\u7B97\u8D39\u7528"
      };
      notes.push("\u4EF7\u683C\u8868\u7F3A\u5C11\u8BE5 provider/model\uFF1A\u8D39\u7528\u4E3A null\uFF08\u4E0D\u662F 0\uFF09");
    } else if (reasoningSource === "missing") {
      reasoning = {
        tokens: null,
        price: null,
        cost: null,
        source: "missing",
        estimatedTokens: null,
        billed: "unknown",
        note: "API \u672A\u8FD4\u56DE reasoningTokens\uFF0C\u6309\u672A\u77E5\u5904\u7406\uFF08NULL\uFF0C\u4E0D\u5199 0\uFF09"
      };
      notes.push("\u63A8\u7406 token \u672A\u7531 API \u8FD4\u56DE\uFF1A\u5B57\u6BB5\u4E3A NULL");
    } else if (reasoningSource === "estimated") {
      reasoning = {
        tokens: null,
        price: null,
        cost: null,
        source: "estimated",
        estimatedTokens: reasoningEstimatedTokens,
        billed: "unknown",
        note: "\u63A8\u7406 token \u4E3A\u4F30\u7B97\u503C\uFF08reasoning \u5185\u5BB9\u5757 bytes/4\uFF09\uFF0C\u4E0D\u7528\u4E8E\u8BA1\u8D39"
      };
      notes.push(`\u63A8\u7406 token \u4E3A\u4F30\u7B97\u503C ${reasoningEstimatedTokens} tokens\uFF08estimated\uFF0C\u975E API \u503C\uFF09`);
    } else if (options2.reasoningBilledSeparately && options2.reasoningPrice !== null) {
      const cost = round6(safeNum4(reasoningTokens) * options2.reasoningPrice / unit);
      reasoning = {
        tokens: reasoningTokens,
        price: options2.reasoningPrice,
        cost,
        source: "api",
        estimatedTokens: null,
        billed: "separate",
        note: "\u6309\u8BBE\u7F6E\u4E2D\u7684\u72EC\u7ACB\u63A8\u7406\u5355\u4EF7\u8BA1\u8D39\uFF08\u4E0D\u4E0E\u8F93\u51FA\u91CD\u590D\u8BA1\u8D39\uFF09"
      };
      notes.push("\u63A8\u7406 token \u6309\u72EC\u7ACB\u5355\u4EF7\u8BA1\u8D39");
    } else {
      reasoning = {
        tokens: reasoningTokens,
        price: null,
        cost: null,
        source: "api",
        estimatedTokens: null,
        billed: "included-in-output",
        note: "\u63A8\u7406 token \u5DF2\u5305\u542B\u5728 output \u4E2D\uFF0C\u4E0D\u91CD\u590D\u8BA1\u8D39"
      };
    }
    const parts = [input.cost, cacheRead.cost, cacheWrite.cost, output.cost];
    const priced = price !== null;
    const bucketTotal = priced ? parts.reduce((acc, value) => acc + (value ?? 0), 0) : null;
    const total = bucketTotal === null ? null : round6(bucketTotal + (reasoning.billed === "separate" ? reasoning.cost ?? 0 : 0));
    if (basis === "missing") {
      notes.push("\u672C\u6B21\u8BF7\u6C42 API \u672A\u8FD4\u56DE usage\uFF1Atoken \u4E0E\u8D39\u7528\u5747\u4E0D\u53EF\u7528\uFF08basis=missing\uFF09");
    } else if (basis === "estimated") {
      notes.push("\u672C\u6B21\u8BF7\u6C42\u7684 usage \u6B8B\u7F3A\uFF0C\u884C\u5185\u6570\u5B57\u4E3A\u4F30\u7B97/\u5360\u4F4D\uFF08basis=estimated\uFF09");
    }
    return {
      provider: provider ?? null,
      model: model ?? null,
      currency: price?.currency ?? null,
      unitTokens: unit,
      priceConfigured: priced,
      usageBasis: basis,
      input,
      cacheRead,
      cacheWrite,
      output,
      reasoning,
      total: basis === "missing" ? null : total,
      notes
    };
  };
  const upsertPrice = (price) => {
    const provider = String(price?.provider ?? "").trim();
    const modelName = String(price?.modelName ?? "").trim();
    if (!provider || !modelName) return;
    const effectiveAt = Number.isFinite(Number(price.effectiveAt)) ? Number(price.effectiveAt) : Date.now();
    store.run(
      `INSERT INTO price_configs(provider, model_name, input_price, cache_read_price, cache_write_price, output_price, currency, unit_tokens, effective_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, model_name, effective_at) DO UPDATE SET
         input_price = excluded.input_price,
         cache_read_price = excluded.cache_read_price,
         cache_write_price = excluded.cache_write_price,
         output_price = excluded.output_price,
         currency = excluded.currency,
         unit_tokens = excluded.unit_tokens`,
      provider,
      modelName,
      safeNum4(price.inputPrice),
      safeNum4(price.cacheReadPrice),
      safeNum4(price.cacheWritePrice),
      safeNum4(price.outputPrice),
      String(price.currency ?? "CNY"),
      Number(price.unitTokens) > 0 ? Number(price.unitTokens) : 1e6,
      effectiveAt
    );
  };
  const deletePrice = (id) => {
    const target = Number(id);
    if (!Number.isFinite(target)) return;
    store.run("DELETE FROM price_configs WHERE id = ?", target);
  };
  const importPrices = (prices) => {
    let count = 0;
    try {
      store.tx(() => {
        for (const price of prices ?? []) {
          const provider = String(price?.provider ?? "").trim();
          const modelName = String(price?.modelName ?? "").trim();
          if (!provider || !modelName) continue;
          try {
            upsertPrice(price);
            count += 1;
          } catch {
          }
        }
      });
    } catch {
    }
    return count;
  };
  const decorate = (rows) => {
    return (rows ?? []).map((row) => {
      const anyRow = row;
      const basis = typeof anyRow.usageBasis === "string" ? anyRow.usageBasis : null;
      if (basis === "missing") return { ...row, cost: null };
      const cost = costOf(
        {
          inputTokens: safeNum4(anyRow.inputTokens),
          cacheReadTokens: safeNum4(anyRow.cacheReadTokens),
          cacheWriteTokens: safeNum4(anyRow.cacheWriteTokens),
          outputTokens: safeNum4(anyRow.outputTokens)
        },
        row.provider ?? null,
        row.model ?? null
      );
      return { ...row, cost };
    });
  };
  return {
    listPrices,
    priceFor,
    upsertPrice,
    deletePrice,
    importPrices,
    costOf,
    decorate,
    costOfDetailed,
    reasoningPricing
  };
}

// src/host/task-manager.ts
import { randomUUID as randomUUID2 } from "node:crypto";
var TASK_COLUMNS = "id, session_id, project_id, task_name, task_type, task_type_source, status, origin, turn, started_at, ended_at, start_snapshot, end_snapshot, summary, interference, first_prompt, merged_into, updated_at";
function mapTask(row) {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    projectId: String(row.project_id ?? "unknown"),
    taskName: String(row.task_name ?? ""),
    taskType: row.task_type,
    taskTypeSource: row.task_type_source,
    status: row.status,
    origin: row.origin,
    turn: row.turn === null ? null : Number(row.turn),
    startedAt: Number(row.started_at ?? 0),
    endedAt: row.ended_at === null ? null : Number(row.ended_at),
    startSnapshot: row.start_snapshot ?? null,
    endSnapshot: row.end_snapshot ?? null,
    summary: row.summary ?? null,
    interference: Number(row.interference ?? 0),
    firstPrompt: row.first_prompt ?? null,
    mergedInto: row.merged_into === null || row.merged_into === void 0 ? null : String(row.merged_into),
    updatedAt: row.updated_at === null || row.updated_at === void 0 ? null : Number(row.updated_at)
  };
}
function safeInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function normalizeTaskType(value) {
  const text = typeof value === "string" ? value : "";
  return TASK_TYPES.includes(text) ? text : "normal-dev";
}
function projectIdOf(session) {
  const header = session?.header ?? {};
  const cwd = typeof header.cwd === "string" ? header.cwd.trim() : "";
  return cwd || "unknown";
}
function sessionTotals(store, sessionId) {
  const empty = {
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    reasoningTokens: null
  };
  try {
    const row = store.get(
      `SELECT COALESCE(SUM(input_tokens), 0) AS i, COALESCE(SUM(cache_read_tokens), 0) AS cr,
              COALESCE(SUM(cache_write_tokens), 0) AS cw, COALESCE(SUM(output_tokens), 0) AS o,
              COALESCE(SUM(total_tokens), 0) AS tot
       FROM usage_records WHERE session_id = ? AND is_final = 1`,
      sessionId
    );
    if (!row) return empty;
    return {
      inputTokens: safeInt(row.i),
      cacheReadTokens: safeInt(row.cr),
      cacheWriteTokens: safeInt(row.cw),
      outputTokens: safeInt(row.o),
      totalTokens: safeInt(row.tot),
      reasoningTokens: null
    };
  } catch {
    return empty;
  }
}
var SENSITIVE_PAIR = /([A-Za-z0-9_.-]*(?:api[_-]?key|secret|password|passwd|token|authorization|bearer|credential)[A-Za-z0-9_.-]*)(\s*[:=]\s*)([^\s,;"'`]{4,})/gi;
var SECRET_TOKEN = /\b(sk-[A-Za-z0-9_-]{8,}|github_pat_[A-Za-z0-9_]{8,}|ghp_[A-Za-z0-9]{8,}|Bearer\s+[A-Za-z0-9._-]{8,})/g;
function sanitizeText(input, limit) {
  const raw = typeof input === "string" ? input : input === null || input === void 0 ? "" : String(input);
  if (!raw) return "";
  let text = raw.replace(SENSITIVE_PAIR, (_match, key, sep2) => `${key}${sep2}***`);
  text = text.replace(SECRET_TOKEN, "[redacted]");
  text = text.replace(/\s+/g, " ").trim();
  return limit > 0 ? text.slice(0, limit) : text;
}
function classify(input) {
  const toolNames = Array.isArray(input?.toolNames) ? input.toolNames : [];
  const writeCount = safeInt(input?.writeCount);
  const readCount = safeInt(input?.readCount);
  const commandCount = safeInt(input?.commandCount);
  const errorCount = safeInt(input?.errorCount);
  const callCount = safeInt(input?.callCount);
  if (writeCount === 0 && readCount >= 5 && callCount > 6) {
    return { taskType: "project-analysis", confidence: 0.75, reason: `\u53EA\u8BFB\u5206\u6790\uFF1A\u5199 0 \u6B21\u3001\u8BFB\u53D6 ${readCount} \u6B21\u3001\u6A21\u578B\u8C03\u7528 ${callCount} \u6B21` };
  }
  if (errorCount > 0 && writeCount <= 1 && readCount + commandCount >= 2) {
    return {
      taskType: "troubleshoot",
      confidence: 0.7,
      reason: `\u6392\u969C\u7279\u5F81\uFF1A\u9519\u8BEF\u8F93\u51FA ${errorCount} \u6B21\u3001\u8BFB/\u547D\u4EE4 ${readCount + commandCount} \u6B21\u3001\u5199 ${writeCount} \u6B21`
    };
  }
  if (writeCount <= 2 && callCount <= 6) {
    const confidence = writeCount <= 1 && callCount <= 3 ? 0.9 : 0.8;
    return { taskType: "simple-edit", confidence, reason: `\u5C0F\u6539\u52A8\uFF1A\u5199 ${writeCount} \u6B21\u3001\u6A21\u578B\u8C03\u7528 ${callCount} \u6B21` };
  }
  if (writeCount >= 5 || writeCount >= 3 && callCount >= 12) {
    return { taskType: "complex-dev", confidence: 0.75, reason: `\u590D\u6742\u5F00\u53D1\uFF1A\u5199 ${writeCount} \u6B21\u3001\u6A21\u578B\u8C03\u7528 ${callCount} \u6B21` };
  }
  return {
    taskType: "normal-dev",
    confidence: 0.5,
    reason: `\u5E38\u89C4\u5F00\u53D1\uFF1A\u5199 ${writeCount} \u6B21\u3001\u8BFB ${readCount} \u6B21\u3001\u8C03\u7528 ${callCount} \u6B21\u3001\u5DE5\u5177 ${toolNames.length} \u7C7B`
  };
}
function toolProfile(store, taskId) {
  const names = /* @__PURE__ */ new Set();
  let writeCount = 0;
  let readCount = 0;
  let commandCount = 0;
  let errorCount = 0;
  let toolCalls = 0;
  try {
    const rows = store.all(
      `SELECT tool_name, COUNT(*) AS n, SUM(CASE WHEN is_error = 1 THEN 1 ELSE 0 END) AS errors
       FROM tool_calls WHERE task_id = ? GROUP BY tool_name`,
      taskId
    );
    for (const row of rows) {
      const name2 = String(row.tool_name ?? "");
      const n = safeInt(row.n);
      names.add(name2);
      toolCalls += n;
      if (WRITE_TOOLS.includes(name2)) writeCount += n;
      else if (READ_TOOLS.includes(name2)) readCount += n;
      else if (COMMAND_TOOLS.includes(name2)) commandCount += n;
      errorCount += safeInt(row.errors);
    }
  } catch {
  }
  let callCount = 0;
  try {
    const row = store.get("SELECT COUNT(*) AS n FROM usage_records WHERE task_id = ? AND is_final = 1", taskId);
    callCount = safeInt(row?.n);
  } catch {
  }
  return { toolNames: [...names], writeCount, readCount, commandCount, errorCount, toolCalls, callCount };
}
function concurrentActivity(store, sessionId, from, to) {
  try {
    const row = store.get(
      "SELECT 1 AS x FROM usage_records WHERE session_id <> ? AND is_final = 1 AND ts >= ? AND ts <= ? LIMIT 1",
      sessionId,
      from,
      to
    );
    return row !== void 0;
  } catch {
    return false;
  }
}
function mapTurnStatus(value) {
  const status = typeof value === "string" ? value : "completed";
  if (status === "failed") return "failed";
  if (status === "completed") return "completed";
  return "paused";
}
function createTaskManager(store, settings, deps = {}) {
  const recordError = (where, error) => {
    try {
      store.metaSet(
        "last_error",
        JSON.stringify({ ts: Date.now(), where, message: String(error?.message ?? error) })
      );
    } catch {
    }
  };
  const textLimit = () => {
    try {
      const value = Number(settings.get()?.evidenceTextLimit);
      return Number.isFinite(value) && value > 0 ? value : DEFAULTS.evidenceTextLimit;
    } catch {
      return DEFAULTS.evidenceTextLimit;
    }
  };
  const getTask = (id) => {
    try {
      const row = store.get(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`, String(id));
      return row ? mapTask(row) : null;
    } catch (error) {
      recordError("tasks.getTask", error);
      return null;
    }
  };
  const taskIdFor = (sessionId, turn) => {
    try {
      const row = store.get(
        "SELECT id FROM tasks WHERE session_id = ? AND turn = ? ORDER BY started_at DESC LIMIT 1",
        String(sessionId),
        safeInt(turn)
      );
      return row?.id ?? null;
    } catch (error) {
      recordError("tasks.taskIdFor", error);
      return null;
    }
  };
  const onUserTurnStart = (input) => {
    const sessionId = String(input?.sessionId ?? "");
    const turn = safeInt(input?.turn);
    const id = `auto:${sessionId}:${turn}`;
    try {
      if (!sessionId) return id;
      const existing = store.get("SELECT id, status FROM tasks WHERE id = ?", id);
      if (existing) {
        if (existing.status === "pending") store.run("UPDATE tasks SET status = 'running' WHERE id = ?", id);
        return existing.id;
      }
      const prompt = typeof input?.prompt === "string" ? input.prompt : "";
      const taskName = sanitizeText(prompt, 40) || `\u7B2C ${turn} \u8F6E`;
      const firstPrompt = sanitizeText(prompt, textLimit()) || null;
      const ts = Number.isFinite(Number(input?.ts)) ? Number(input.ts) : Date.now();
      const projectId = String(input?.projectId ?? "").trim() || "unknown";
      const snapshot = typeof input?.snapshot === "string" && input.snapshot.length > 0 ? input.snapshot : null;
      store.run(
        `INSERT INTO tasks(id, session_id, project_id, task_name, task_type, task_type_source, status, origin, turn, started_at, ended_at, start_snapshot, end_snapshot, summary, interference, first_prompt, merged_into, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
        id,
        sessionId,
        projectId,
        taskName,
        "normal-dev",
        "default",
        "running",
        "auto",
        turn,
        ts,
        null,
        snapshot,
        null,
        null,
        0,
        firstPrompt,
        null,
        ts
      );
      return id;
    } catch (error) {
      recordError("tasks.onUserTurnStart", error);
      return id;
    }
  };
  const onTurnEnd = (input) => {
    try {
      const sessionId = String(input?.sessionId ?? "");
      const turn = safeInt(input?.turn);
      const taskId = taskIdFor(sessionId, turn);
      if (!taskId) return;
      const task = getTask(taskId);
      if (!task) return;
      const ts = Number.isFinite(Number(input?.ts)) ? Number(input.ts) : Date.now();
      const profile = toolProfile(store, taskId);
      const result = classify({
        toolNames: profile.toolNames,
        writeCount: profile.writeCount,
        readCount: profile.readCount,
        commandCount: profile.commandCount,
        errorCount: profile.errorCount,
        callCount: profile.callCount
      });
      const status = mapTurnStatus(input?.status);
      const startedAt = Number(task.startedAt) > 0 ? Number(task.startedAt) : ts;
      const interference = task.interference || concurrentActivity(store, sessionId, startedAt, ts) ? 1 : 0;
      const endSnapshot = JSON.stringify(sessionTotals(store, sessionId));
      const summary = JSON.stringify({
        confidence: result.confidence,
        reason: result.reason,
        calls: profile.callCount,
        toolCalls: profile.toolCalls,
        toolNames: profile.toolNames.slice(0, 20),
        turnStatus: typeof input?.status === "string" ? input.status : "completed"
      });
      store.run(
        `UPDATE tasks SET
           ended_at = COALESCE(ended_at, ?),
           status = ?,
           end_snapshot = COALESCE(end_snapshot, ?),
           interference = ?,
           summary = COALESCE(summary, ?),
           updated_at = ?,
           task_type = CASE WHEN task_type_source = 'manual' THEN task_type ELSE ? END,
           task_type_source = CASE WHEN task_type_source = 'manual' THEN 'manual' ELSE 'heuristic' END
         WHERE id = ?`,
        ts,
        status,
        endSnapshot,
        interference,
        summary,
        ts,
        result.taskType,
        taskId
      );
    } catch (error) {
      recordError("tasks.onTurnEnd", error);
    }
  };
  const enrich = (rows) => {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const placeholders = ids.map(() => "?").join(",");
    const usage = /* @__PURE__ */ new Map();
    try {
      const groups = store.all(
        `SELECT task_id, provider, model, COUNT(*) AS calls,
                COALESCE(SUM(input_tokens), 0) AS i, COALESCE(SUM(cache_read_tokens), 0) AS cr,
                COALESCE(SUM(cache_write_tokens), 0) AS cw, COALESCE(SUM(output_tokens), 0) AS o,
                COALESCE(SUM(total_tokens), 0) AS tot
         FROM usage_records WHERE is_final = 1 AND task_id IN (${placeholders})
         GROUP BY task_id, provider, model`,
        ...ids
      );
      for (const group of groups) {
        const key = String(group.task_id);
        const entry = usage.get(key) ?? { calls: 0, i: 0, cr: 0, cw: 0, o: 0, tot: 0, cost: 0 };
        entry.calls += safeInt(group.calls);
        entry.i += safeInt(group.i);
        entry.cr += safeInt(group.cr);
        entry.cw += safeInt(group.cw);
        entry.o += safeInt(group.o);
        entry.tot += safeInt(group.tot);
        if (entry.cost !== null) {
          const cost = deps.costOf ? deps.costOf(
            {
              inputTokens: safeInt(group.i),
              cacheReadTokens: safeInt(group.cr),
              cacheWriteTokens: safeInt(group.cw),
              outputTokens: safeInt(group.o)
            },
            group.provider ?? null,
            group.model ?? null
          ) : null;
          entry.cost = cost === null ? null : entry.cost + cost;
        }
        usage.set(key, entry);
      }
    } catch (error) {
      recordError("tasks.enrich.usage", error);
    }
    const findingCounts = /* @__PURE__ */ new Map();
    try {
      const findingRows = store.all(
        `SELECT task_id, COUNT(*) AS n FROM findings WHERE task_id IN (${placeholders}) GROUP BY task_id`,
        ...ids
      );
      for (const row of findingRows) findingCounts.set(String(row.task_id), safeInt(row.n));
    } catch (error) {
      recordError("tasks.enrich.findings", error);
    }
    return rows.map((row) => {
      const u = usage.get(row.id);
      return {
        ...row,
        calls: u?.calls ?? 0,
        inputTokens: u?.i ?? 0,
        cacheReadTokens: u?.cr ?? 0,
        cacheWriteTokens: u?.cw ?? 0,
        outputTokens: u?.o ?? 0,
        totalTokens: u?.tot ?? 0,
        cost: u ? u.cost : 0,
        findingCount: findingCounts.get(row.id) ?? 0
      };
    });
  };
  const listTasks = (query) => {
    try {
      const where = [];
      const params = [];
      if (query?.includeMerged !== true) where.push("merged_into IS NULL");
      if (query?.sessionId) {
        where.push("session_id = ?");
        params.push(String(query.sessionId));
      }
      if (query?.projectId) {
        where.push("project_id = ?");
        params.push(String(query.projectId));
      }
      if (query?.taskType) {
        where.push("task_type = ?");
        params.push(String(query.taskType));
      }
      if (query?.status) {
        where.push("status = ?");
        params.push(String(query.status));
      }
      const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
      const totalRow = store.get(`SELECT COUNT(*) AS n FROM tasks ${clause}`, ...params);
      const total = safeInt(totalRow?.n);
      const limit = Math.min(500, Math.max(1, safeInt(query?.limit ?? 50, 50)));
      const offset = Math.max(0, safeInt(query?.offset ?? 0));
      const rows = store.all(`SELECT ${TASK_COLUMNS} FROM tasks ${clause} ORDER BY started_at DESC LIMIT ? OFFSET ?`, ...params, limit, offset).map(mapTask);
      return { total, rows: enrich(rows) };
    } catch (error) {
      recordError("tasks.listTasks", error);
      return { total: 0, rows: [] };
    }
  };
  const createManual = (input) => {
    const id = `manual:${randomUUID2()}`;
    const now = Date.now();
    const sessionId = String(input?.sessionId ?? "");
    const projectId = String(input?.projectId ?? "").trim() || "unknown";
    const taskName = sanitizeText(input?.name, 40) || "\u624B\u52A8\u4EFB\u52A1";
    const taskType = normalizeTaskType(input?.taskType);
    const turn = Number.isFinite(Number(input?.turn)) ? safeInt(input?.turn) : null;
    const fallback = {
      id,
      sessionId,
      projectId,
      taskName,
      taskType,
      taskTypeSource: "manual",
      status: "running",
      origin: "manual",
      turn,
      startedAt: now,
      endedAt: null,
      startSnapshot: null,
      endSnapshot: null,
      summary: null,
      interference: 0,
      firstPrompt: null,
      mergedInto: null,
      updatedAt: now
    };
    try {
      store.run(
        `INSERT INTO tasks(id, session_id, project_id, task_name, task_type, task_type_source, status, origin, turn, started_at, ended_at, start_snapshot, end_snapshot, summary, interference, first_prompt, merged_into, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        sessionId,
        projectId,
        taskName,
        taskType,
        "manual",
        "running",
        "manual",
        turn,
        now,
        null,
        null,
        null,
        null,
        0,
        null,
        null,
        now
      );
      return getTask(id) ?? fallback;
    } catch (error) {
      recordError("tasks.createManual", error);
      return fallback;
    }
  };
  const updateTask = (id, patch) => {
    try {
      const sets = [];
      const params = [];
      const push = (sql, value) => {
        sets.push(sql);
        params.push(value);
      };
      if (patch?.taskName !== void 0) push("task_name = ?", sanitizeText(patch.taskName, 40));
      if (patch?.taskType !== void 0) push("task_type = ?", normalizeTaskType(patch.taskType));
      if (patch?.status !== void 0 && TASK_STATUSES.includes(String(patch.status))) {
        push("status = ?", String(patch.status));
      }
      if (patch?.summary !== void 0) push("summary = ?", patch.summary === null || patch.summary === void 0 ? null : String(patch.summary));
      const source = patch?.taskTypeSource === void 0 ? null : String(patch.taskTypeSource);
      if (source === "heuristic" || source === "manual" || source === "default") push("task_type_source = ?", source);
      if (sets.length > 0) {
        push("updated_at = ?", Date.now());
        store.run(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`, ...params, String(id));
      }
      return getTask(id);
    } catch (error) {
      recordError("tasks.updateTask", error);
      return getTask(id);
    }
  };
  const mergeTasks = (input) => {
    try {
      const ids = [...new Set((Array.isArray(input?.ids) ? input.ids : []).map((id) => String(id ?? "").trim()).filter(Boolean))];
      if (ids.length < 2) return null;
      const rows = [];
      for (const id of ids) {
        const task = getTask(id);
        if (!task) return null;
        rows.push(task);
      }
      const sessionId = rows[0].sessionId;
      if (rows.some((task) => task.sessionId !== sessionId)) return null;
      if (rows.some((task) => task.mergedInto !== null)) return null;
      const target = rows.reduce(
        (best, task) => task.startedAt < best.startedAt || task.startedAt === best.startedAt && task.id < best.id ? task : best
      );
      const now = Date.now();
      const others = rows.filter((task) => task.id !== target.id);
      store.tx(() => {
        for (const task of others) {
          store.run("UPDATE tasks SET merged_into = ?, updated_at = ? WHERE id = ?", target.id, now, task.id);
        }
        const sets = ["updated_at = ?"];
        const params = [now];
        if (input?.name !== void 0 && input.name !== null) {
          sets.push("task_name = ?");
          params.push(sanitizeText(input.name, 40));
        }
        if (input?.taskType !== void 0 && input.taskType !== null) {
          sets.push("task_type = ?");
          params.push(normalizeTaskType(input.taskType));
          sets.push("task_type_source = 'manual'");
        }
        store.run(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`, ...params, target.id);
      });
      return getTask(target.id);
    } catch (error) {
      recordError("tasks.mergeTasks", error);
      return null;
    }
  };
  const setInterference = (id, value) => {
    try {
      store.run("UPDATE tasks SET interference = ? WHERE id = ?", value ? 1 : 0, String(id));
    } catch (error) {
      recordError("tasks.setInterference", error);
    }
  };
  return {
    onUserTurnStart,
    onTurnEnd,
    taskIdFor,
    getTask,
    listTasks,
    createManual,
    updateTask,
    setInterference,
    mergeTasks,
    classify
  };
}

// src/host/analytics.ts
var ASK_TOOL_RE = /ask[_-]?user/i;
var PLAN_TEXT_RE = /(?:计划|方案|步骤)|\bplan\b/i;
var SUMMARY_TEXT_RE = /(?:已完成|完成情况|总结)|\bsummary\b|\bcompleted\b/i;
function compileAll(patterns) {
  const out = [];
  for (const source of patterns) {
    try {
      out.push(new RegExp(source, "i"));
    } catch {
    }
  }
  return out;
}
var BUILD_RE = compileAll(BUILD_PATTERNS);
var TEST_RE = compileAll(TEST_PATTERNS);
var DEPLOY_RE = compileAll(DEPLOY_PATTERNS);
var COMMAND_TOOL_SET = new Set(COMMAND_TOOLS);
var READ_TOOL_SET = new Set(READ_TOOLS);
function asRecord(value) {
  return value && typeof value === "object" ? value : {};
}
function num(value, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function numOrNull(value) {
  if (value === null || value === void 0) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function redactSensitive(text) {
  let out = text.replace(/(\bBearer\s+)[A-Za-z0-9._~+/=-]{6,}/gi, "$1***");
  out = out.replace(
    /([A-Za-z0-9_.$-]+\s*[:=]\s*)(["']?)([^\s"',;}\]]+)/g,
    (match, prefix, quote) => {
      const key = prefix.replace(/[\s:=]+$/g, "");
      return SENSITIVE_KEY_REGEX.test(key) ? `${prefix}${quote}***` : match;
    }
  );
  return out.replace(/\b(?:(?:sk|ghp|github_pat|xox[baprs])[-_])[A-Za-z0-9_-]{8,}/g, "***");
}
function snippet(text, limit) {
  const clean = redactSensitive(String(text ?? "").replace(/\s+/g, " ").trim());
  if (!clean) return "";
  return clean.length <= limit ? clean : `${clean.slice(0, Math.max(1, limit - 1))}\u2026`;
}
function medianOf(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function cacheRateOf(usage) {
  let cacheRead = 0;
  let input = 0;
  for (const row of usage) {
    cacheRead += row.cacheReadTokens;
    input += row.inputTokens;
  }
  const denom = cacheRead + input;
  return denom > 0 ? cacheRead / denom : null;
}
function toToolCall(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    taskId: row.task_id,
    turn: row.turn,
    step: row.step,
    callId: row.call_id,
    toolName: row.tool_name,
    argsHash: row.args_hash,
    argsSummary: row.args_summary,
    targetPath: row.target_path,
    command: row.command,
    resultHash: row.result_hash,
    resultBytes: row.result_bytes,
    isError: row.is_error,
    ts: row.ts
  };
}
function toUsage(row) {
  return {
    sessionId: "",
    taskId: null,
    turn: num(row.turn),
    step: num(row.step),
    attempt: num(row.attempt, 1),
    isFinal: 1,
    provider: row.provider,
    model: row.model,
    reasoningEffort: null,
    inputTokens: num(row.input_tokens),
    cacheReadTokens: num(row.cache_read_tokens),
    cacheWriteTokens: num(row.cache_write_tokens),
    outputTokens: num(row.output_tokens),
    totalTokens: num(row.total_tokens),
    reasoningTokens: null,
    durationMs: numOrNull(row.duration_ms),
    ts: num(row.ts),
    messageId: null,
    source: "live"
  };
}
function toFinding(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    taskId: row.task_id,
    kind: row.kind,
    severity: row.severity,
    subject: row.subject,
    detail: row.detail ?? "{}",
    evidence: row.evidence ?? "{}",
    createdAt: row.created_at
  };
}
function createAnalytics(store, settings, costs) {
  const textBuffer = /* @__PURE__ */ new Map();
  const MAX_TEXTS_PER_TASK = 400;
  const MAX_BUFFERED_TASKS = 300;
  const readConfig = () => {
    let raw;
    try {
      raw = settings.get();
    } catch {
      raw = { enabled: true, observeOnly: true, analytics: {}, thresholds: {}, evidenceTextLimit: DEFAULTS.evidenceTextLimit, alertOnly: true };
    }
    return {
      enabled: raw.enabled !== false,
      analytics: { ...DEFAULTS.analytics, ...asRecord(raw.analytics) },
      thresholds: { ...DEFAULTS.thresholds, ...asRecord(raw.thresholds) },
      evidenceTextLimit: typeof raw.evidenceTextLimit === "number" && raw.evidenceTextLimit > 0 ? Math.min(raw.evidenceTextLimit, 2e3) : DEFAULTS.evidenceTextLimit
    };
  };
  const thresholdOf = (cfg, key) => {
    const value = cfg.thresholds[key];
    return typeof value === "number" && Number.isFinite(value) ? value : DEFAULTS.thresholds[key];
  };
  const addFinding = (input) => {
    try {
      store.run(
        `INSERT OR IGNORE INTO findings(session_id, task_id, kind, severity, subject, detail, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        input.sessionId,
        input.taskId,
        input.kind,
        input.severity,
        input.subject,
        JSON.stringify(input.detail),
        JSON.stringify(input.evidence),
        Date.now()
      );
    } catch {
    }
  };
  const loadUsage = (taskId) => {
    const rows = store.all(
      `SELECT turn, step, attempt, provider, model, input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, total_tokens, duration_ms, ts FROM usage_records WHERE task_id = ? AND turn >= 0 AND is_final = 1 AND source = 'live' ORDER BY turn, step, attempt`,
      taskId
    );
    return rows.map(toUsage);
  };
  const runTokenSourceReview = (ctx) => {
    let missing = 0;
    let estimated = 0;
    let partial = 0;
    let reasoningReported = 0;
    let reasoningEstimated = 0;
    let reasoningMissing = 0;
    const effortSources = { auto: 0, explicit: 0, "adapter-default": 0, unknown: 0 };
    try {
      const rows = store.all(
        `SELECT turn, step, attempt, provider, model, input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, total_tokens, duration_ms, ts, usage_basis, reasoning_source, effort_source, usage_partial
           FROM usage_records WHERE task_id = ? AND turn >= 0 AND is_final = 1 AND source = 'live'`,
        ctx.task.id
      );
      for (const row of rows) {
        if (row.usage_basis === "missing") missing += 1;
        else if (row.usage_basis === "estimated") estimated += 1;
        if (num(row.usage_partial) === 1) partial += 1;
        if (row.reasoning_source === "api") reasoningReported += 1;
        else if (row.reasoning_source === "estimated") reasoningEstimated += 1;
        else reasoningMissing += 1;
        const source = row.effort_source === "auto" || row.effort_source === "explicit" || row.effort_source === "adapter-default" ? row.effort_source : "unknown";
        effortSources[source] = (effortSources[source] ?? 0) + 1;
      }
    } catch {
      return;
    }
    if (missing > 0) {
      addFinding({
        sessionId: ctx.task.session_id,
        taskId: ctx.task.id,
        kind: "usage_missing",
        severity: "warn",
        subject: "usage-missing",
        detail: {
          missing,
          note: "\u90E8\u5206\u6A21\u578B\u8BF7\u6C42\u672A\u8FD4\u56DE usage\uFF1A\u8FD9\u4E9B\u884C token \u4E3A 0 \u5360\u4F4D\u3001\u8D39\u7528\u4E3A null\uFF0C\u4E0D\u4EE3\u8868\u771F\u5B9E 0 \u6D88\u8017"
        },
        evidence: { missing, estimated, partial, reasoningReported, reasoningEstimated, reasoningMissing, effortSources }
      });
    }
    if (estimated > 0) {
      addFinding({
        sessionId: ctx.task.session_id,
        taskId: ctx.task.id,
        kind: "usage_estimated",
        severity: "info",
        subject: "usage-estimated",
        detail: {
          estimated,
          partial,
          note: "\u90E8\u5206\u8BF7\u6C42 usage \u6B8B\u7F3A\uFF0C\u6570\u5B57\u4EC5\u4F5C\u4F30\u7B97\u53C2\u8003\uFF0C\u62A5\u544A\u9700\u6807\u6CE8\u300C\u4F30\u7B97\u300D"
        },
        evidence: { estimated, partial, reasoningReported, reasoningEstimated, reasoningMissing, effortSources }
      });
    }
  };
  const loadTools = (taskId) => {
    const rows = store.all(
      `SELECT id, session_id, task_id, turn, step, call_id, tool_name, args_hash, args_summary, target_path, command, result_hash, result_bytes, is_error, ts FROM tool_calls WHERE task_id = ? ORDER BY ts, id`,
      taskId
    );
    return rows.map(toToolCall);
  };
  const loadBaseline = (taskType, projectId) => store.get(
    `SELECT task_type, project_id, sample_count, p80_calls, p80_tokens, p80_cost FROM task_baselines WHERE task_type = ? AND project_id IN (?, '*') ORDER BY CASE WHEN project_id = ? THEN 0 ELSE 1 END LIMIT 1`,
    taskType,
    projectId,
    projectId
  ) ?? null;
  const taskCost = (usage) => {
    if (usage.length === 0) return null;
    const groups = /* @__PURE__ */ new Map();
    for (const row of usage) {
      const key = `${row.provider ?? ""}\0${row.model ?? ""}`;
      const bucket = groups.get(key);
      if (bucket) bucket.push(row);
      else groups.set(key, [row]);
    }
    let total = 0;
    for (const rows of groups.values()) {
      const sums = {
        inputTokens: rows.reduce((acc, r) => acc + r.inputTokens, 0),
        cacheReadTokens: rows.reduce((acc, r) => acc + r.cacheReadTokens, 0),
        cacheWriteTokens: rows.reduce((acc, r) => acc + r.cacheWriteTokens, 0),
        outputTokens: rows.reduce((acc, r) => acc + r.outputTokens, 0)
      };
      const cost = costs.costOf(sums, rows[0].provider, rows[0].model);
      if (cost === null) return null;
      total += cost;
    }
    return total;
  };
  const runRepeatedRead = (ctx) => {
    if (!ctx.cfg.analytics.repeatedRead) return;
    const threshold = thresholdOf(ctx.cfg, "repeatedReadCount");
    if (threshold < 2) return;
    const groups = /* @__PURE__ */ new Map();
    for (const call of ctx.tools) {
      if (!call.targetPath || !READ_TOOL_SET.has(call.toolName)) continue;
      const bucket = groups.get(call.targetPath);
      if (bucket) bucket.push(call);
      else groups.set(call.targetPath, [call]);
    }
    for (const [targetPath, calls] of groups) {
      if (calls.length < threshold) continue;
      const hashes = /* @__PURE__ */ new Set();
      for (const call of calls) if (call.resultHash) hashes.add(call.resultHash);
      const sameContent = hashes.size === 1 && calls.every((call) => call.resultHash !== null);
      const bytes = calls.reduce((acc, call) => acc + num(call.resultBytes), 0);
      const limit = ctx.cfg.evidenceTextLimit;
      addFinding({
        sessionId: ctx.task.session_id,
        taskId: ctx.task.id,
        kind: "repeated_read",
        severity: sameContent ? "warn" : "info",
        subject: `read:${targetPath.slice(0, 300)}`,
        detail: {
          targetPath,
          count: calls.length,
          sameContent,
          distinctHashes: hashes.size,
          totalBytes: bytes,
          firstTs: calls[0].ts,
          lastTs: calls[calls.length - 1].ts,
          note: sameContent ? "\u76F8\u540C\u5185\u5BB9\u88AB\u91CD\u590D\u8BFB\u53D6" : "\u6587\u4EF6\u5185\u5BB9\u5DF2\u53D8\u5316\uFF08\u4EC5 info\uFF09"
        },
        evidence: {
          targetPath: snippet(targetPath, limit),
          turns: [...new Set(calls.map((call) => call.turn))].slice(0, 20),
          steps: [...new Set(calls.map((call) => call.step))].slice(0, 20),
          hashPrefixes: [...hashes].slice(0, 5).map((hash) => hash.slice(0, 12))
        }
      });
    }
  };
  const runRepeatedTool = (ctx) => {
    if (!ctx.cfg.analytics.repeatedTool) return;
    const threshold = thresholdOf(ctx.cfg, "repeatedToolCount");
    if (threshold < 2) return;
    const groups = /* @__PURE__ */ new Map();
    for (const call of ctx.tools) {
      if (!call.argsHash || !call.resultHash) continue;
      const key = `${call.toolName}\0${call.argsHash}\0${call.resultHash}`;
      const bucket = groups.get(key);
      if (bucket) bucket.push(call);
      else groups.set(key, [call]);
    }
    for (const calls of groups.values()) {
      if (calls.length < threshold) continue;
      const first = calls[0];
      const limit = ctx.cfg.evidenceTextLimit;
      addFinding({
        sessionId: ctx.task.session_id,
        taskId: ctx.task.id,
        kind: "repeated_tool",
        severity: "warn",
        subject: `tool:${first.toolName}:${(first.argsHash ?? "").slice(0, 12)}:${(first.resultHash ?? "").slice(0, 12)}`,
        detail: {
          toolName: first.toolName,
          argsHash: first.argsHash,
          resultHash: first.resultHash,
          count: calls.length,
          firstTs: first.ts,
          lastTs: calls[calls.length - 1].ts,
          isError: calls.every((call) => call.isError === 1)
        },
        evidence: {
          argsSummary: snippet(first.argsSummary ?? "", limit),
          targetPath: snippet(first.targetPath ?? "", limit),
          turns: [...new Set(calls.map((call) => call.turn))].slice(0, 20)
        }
      });
    }
  };
  const classifyCommand = (command) => {
    if (BUILD_RE.some((re) => re.test(command))) return "build";
    if (TEST_RE.some((re) => re.test(command))) return "test";
    if (DEPLOY_RE.some((re) => re.test(command))) return "deploy";
    return null;
  };
  const normalizeCommand2 = (command) => command.replace(/\s+/g, " ").trim().slice(0, 200);
  const runRepeatedCommands = (ctx) => {
    const threshold = thresholdOf(ctx.cfg, "repeatedCommandCount");
    if (threshold < 2) return;
    const switchOf = { build: "repeatedBuild", test: "repeatedTest", deploy: "repeatedDeploy" };
    const kindOf = { build: "repeated_build", test: "repeated_test", deploy: "repeated_deploy" };
    const byKind = /* @__PURE__ */ new Map();
    for (const call of ctx.tools) {
      if (!call.command) continue;
      if (call.toolName && !COMMAND_TOOL_SET.has(call.toolName) && !/pwsh|bash|shell|command/i.test(call.toolName)) continue;
      const kind = classifyCommand(call.command);
      if (!kind) continue;
      let group = byKind.get(kind);
      if (!group) {
        group = /* @__PURE__ */ new Map();
        byKind.set(kind, group);
      }
      const normalized = normalizeCommand2(call.command);
      const bucket = group.get(normalized);
      if (bucket) bucket.push(call);
      else group.set(normalized, [call]);
    }
    for (const [kind, commands] of byKind) {
      if (!ctx.cfg.analytics[switchOf[kind]]) continue;
      const total = [...commands.values()].reduce((acc, list) => acc + list.length, 0);
      if (total < threshold) continue;
      const limit = ctx.cfg.evidenceTextLimit;
      const commandSummaries = [...commands.entries()].map(([command, calls]) => ({
        command,
        count: calls.length,
        firstTs: calls[0].ts,
        lastTs: calls[calls.length - 1].ts
      })).sort((a, b) => b.count - a.count);
      const firstTs = Math.min(...commandSummaries.map((entry) => entry.firstTs));
      const lastTs = Math.max(...commandSummaries.map((entry) => entry.lastTs));
      addFinding({
        sessionId: ctx.task.session_id,
        taskId: ctx.task.id,
        kind: kindOf[kind],
        severity: "warn",
        subject: kind,
        detail: {
          kind,
          count: total,
          distinctCommands: commandSummaries.length,
          spanMs: Math.max(0, lastTs - firstTs),
          commands: commandSummaries.slice(0, 10)
        },
        evidence: {
          commands: commandSummaries.slice(0, 10).map((entry) => snippet(entry.command, limit)),
          note: `${kind} \u7C7B\u547D\u4EE4\u5728\u4EFB\u52A1\u5185\u91CD\u590D\u6267\u884C ${total} \u6B21`
        }
      });
    }
  };
  const runConfirmationRounds = (ctx) => {
    if (!ctx.cfg.analytics.confirmationRounds) return;
    const rounds = thresholdOf(ctx.cfg, "confirmationRounds");
    const maxChars = thresholdOf(ctx.cfg, "confirmationMaxChars");
    if (rounds < 2 || ctx.texts.length === 0) return;
    const stepWithTool = /* @__PURE__ */ new Set();
    const turnsWithAsk = /* @__PURE__ */ new Set();
    for (const call of ctx.tools) {
      if (call.turn !== null && call.step !== null) stepWithTool.add(`${call.turn}:${call.step}`);
      if (call.turn !== null && ASK_TOOL_RE.test(call.toolName)) turnsWithAsk.add(call.turn);
    }
    const byTurn = /* @__PURE__ */ new Map();
    for (const entry of ctx.texts) {
      const bucket = byTurn.get(entry.turn);
      if (bucket) bucket.push(entry);
      else byTurn.set(entry.turn, [entry]);
    }
    for (const [turn, entries] of byTurn) {
      if (turnsWithAsk.has(turn)) continue;
      const short = entries.filter((entry) => {
        if (stepWithTool.has(`${turn}:${entry.step}`)) return false;
        const length = entry.text.replace(/\s+/g, " ").trim().length;
        return length > 0 && length <= maxChars;
      });
      if (short.length < rounds) continue;
      const limit = ctx.cfg.evidenceTextLimit;
      addFinding({
        sessionId: ctx.task.session_id,
        taskId: ctx.task.id,
        kind: "confirmation_rounds",
        severity: "info",
        subject: `turn:${turn}`,
        detail: {
          turn,
          count: short.length,
          maxChars,
          note: "\u540C\u4E00 turn \u5185\u591A\u6761\u65E0\u5DE5\u5177\u8C03\u7528\u7684\u77ED\u6587\u672C\uFF0C\u7591\u4F3C\u989D\u5916\u786E\u8BA4\u8F6E\u6B21"
        },
        evidence: {
          messages: short.slice(0, 6).map((entry) => ({ turn, step: entry.step, preview: snippet(entry.text, limit) }))
        }
      });
    }
  };
  const runRepeatedText = (ctx, kind, re, switchKey, label) => {
    if (!ctx.cfg.analytics[switchKey]) return;
    const threshold = thresholdOf(ctx.cfg, "repeatedTextCount");
    if (threshold < 2 || ctx.texts.length === 0) return;
    const hits = ctx.texts.filter((entry) => re.test(entry.text));
    if (hits.length < threshold) return;
    const limit = ctx.cfg.evidenceTextLimit;
    addFinding({
      sessionId: ctx.task.session_id,
      taskId: ctx.task.id,
      kind,
      severity: "info",
      subject: label,
      detail: { count: hits.length, threshold, note: `\u4EFB\u52A1\u5185 ${label} \u7C7B\u63AA\u8F9E\u51FA\u73B0 ${hits.length} \u6B21` },
      evidence: { messages: hits.slice(0, 6).map((entry) => ({ turn: entry.turn, step: entry.step, preview: snippet(entry.text, limit) })) }
    });
  };
  const historicalCacheRates = (projectId, taskId) => {
    const rows = store.all(
      `SELECT u.task_id AS task_id, SUM(u.cache_read_tokens) AS cr, SUM(u.input_tokens) AS inp, COUNT(*) AS calls FROM usage_records u JOIN tasks t ON t.id = u.task_id WHERE t.project_id = ? AND u.task_id IS NOT NULL AND u.task_id <> ? AND u.turn >= 0 AND u.is_final = 1 AND u.source = 'live' GROUP BY u.task_id HAVING COUNT(*) >= 3`,
      projectId,
      taskId
    );
    const rates = [];
    for (const row of rows) {
      const denom = num(row.cr) + num(row.inp);
      if (denom > 0) rates.push(num(row.cr) / denom);
    }
    return rates;
  };
  const runStepInflation = (ctx) => {
    if (!ctx.cfg.analytics.stepInflation) return;
    const calls = ctx.usage.length;
    if (calls === 0) return;
    const factor = thresholdOf(ctx.cfg, "inflationFactor");
    const minSamples = thresholdOf(ctx.cfg, "minBaselineSamples");
    let cap = null;
    if (ctx.task.task_type === "simple-edit") cap = thresholdOf(ctx.cfg, "simpleEditCallCap");
    else if (ctx.task.task_type === "normal-dev") cap = thresholdOf(ctx.cfg, "normalDevCallCap");
    const baseline = loadBaseline(ctx.task.task_type, ctx.task.project_id);
    const usable = baseline !== null && num(baseline.sample_count) >= minSamples;
    const p80Calls = usable ? numOrNull(baseline.p80_calls) : null;
    const baselineHit = p80Calls !== null && calls > p80Calls * factor;
    const capHit = cap !== null && calls >= cap;
    if (!baselineHit && !capHit) return;
    addFinding({
      sessionId: ctx.task.session_id,
      taskId: ctx.task.id,
      kind: "step_inflation",
      severity: "warn",
      subject: "step-inflation",
      detail: {
        calls,
        taskType: ctx.task.task_type,
        taskTypeSource: ctx.task.task_type_source,
        cap,
        capHit,
        baselineP80Calls: p80Calls,
        inflationFactor: factor,
        baselineSampleCount: usable ? num(baseline.sample_count) : 0,
        baselineProject: usable ? baseline.project_id : null,
        note: baselineHit ? "\u8C03\u7528\u6570\u8D85\u8FC7\u540C\u7C7B\u57FA\u7EBF p80\xD7\u56E0\u5B50" : "\u8C03\u7528\u6570\u8D85\u8FC7\u4EFB\u52A1\u7C7B\u578B\u56FA\u5B9A\u4E0A\u9650"
      },
      evidence: { taskType: ctx.task.task_type, calls, cap, p80Calls, factor }
    });
  };
  const runCacheHitDrop = (ctx) => {
    if (!ctx.cfg.analytics.cacheHitDrop) return;
    if (ctx.usage.length < 3) return;
    const rate = cacheRateOf(ctx.usage);
    if (rate === null) return;
    const history = historicalCacheRates(ctx.task.project_id, ctx.task.id);
    if (history.length < 3) return;
    const median = medianOf(history);
    if (median === null) return;
    const factor = thresholdOf(ctx.cfg, "cacheDropFactor");
    if (!(rate < median * factor)) return;
    addFinding({
      sessionId: ctx.task.session_id,
      taskId: ctx.task.id,
      kind: "cache_hit_drop",
      severity: "info",
      subject: "cache-hit",
      detail: {
        cacheHitRate: Number(rate.toFixed(4)),
        projectMedian: Number(median.toFixed(4)),
        dropFactor: factor,
        calls: ctx.usage.length,
        historyTasks: history.length,
        projectId: ctx.task.project_id,
        note: "\u7F13\u5B58\u547D\u4E2D\u7387\u4F4E\u4E8E\u540C\u9879\u76EE\u5386\u53F2\u4E2D\u4F4D\u6570\xD7\u56E0\u5B50"
      },
      evidence: { cacheHitRate: rate, projectMedian: median, historyTasks: history.length }
    });
  };
  const runTaskCostAnomaly = (ctx) => {
    if (!ctx.cfg.analytics.taskCostAnomaly) return;
    if (ctx.usage.length === 0) return;
    const minSamples = thresholdOf(ctx.cfg, "minBaselineSamples");
    const baseline = loadBaseline(ctx.task.task_type, ctx.task.project_id);
    if (!baseline || num(baseline.sample_count) < minSamples) return;
    const factor = thresholdOf(ctx.cfg, "costAnomalyFactor");
    const totalTokens = ctx.usage.reduce((acc, row) => acc + row.totalTokens, 0);
    const cost = taskCost(ctx.usage);
    const p80Tokens = numOrNull(baseline.p80_tokens);
    const p80Cost = numOrNull(baseline.p80_cost);
    const tokensHit = p80Tokens !== null && totalTokens > p80Tokens * factor;
    const costHit = cost !== null && p80Cost !== null && cost > p80Cost * factor;
    if (!tokensHit && !costHit) return;
    addFinding({
      sessionId: ctx.task.session_id,
      taskId: ctx.task.id,
      kind: "task_cost_anomaly",
      severity: "warn",
      subject: "cost-anomaly",
      detail: {
        totalTokens,
        cost,
        p80Tokens,
        p80Cost,
        factor,
        baselineSampleCount: num(baseline.sample_count),
        exceeded: [...tokensHit ? ["tokens"] : [], ...costHit ? ["cost"] : []],
        note: "\u4EFB\u52A1 Token \u6216\u4F30\u7B97\u8D39\u7528\u8D85\u8FC7\u540C\u7C7B\u57FA\u7EBF p80\xD7\u56E0\u5B50"
      },
      evidence: { totalTokens, cost, p80Tokens, p80Cost, factor }
    });
  };
  const analyzeTask = (taskId) => {
    try {
      const task = store.get(
        `SELECT id, session_id, project_id, task_type, task_type_source, status, origin, turn, started_at, ended_at, interference FROM tasks WHERE id = ?`,
        taskId
      );
      if (!task) return [];
      const cfg = readConfig();
      if (cfg.enabled) {
        const ctx = {
          cfg,
          task,
          usage: loadUsage(taskId),
          tools: loadTools(taskId),
          texts: textBuffer.get(taskId) ?? []
        };
        runRepeatedRead(ctx);
        runRepeatedTool(ctx);
        runRepeatedCommands(ctx);
        runConfirmationRounds(ctx);
        runRepeatedText(ctx, "repeated_plan", PLAN_TEXT_RE, "repeatedPlan", "plan");
        runRepeatedText(ctx, "repeated_summary", SUMMARY_TEXT_RE, "repeatedSummary", "summary");
        runStepInflation(ctx);
        runCacheHitDrop(ctx);
        runTaskCostAnomaly(ctx);
        runTokenSourceReview(ctx);
      }
      return findings({ taskId, limit: 500 });
    } catch {
      return [];
    }
  };
  const findings = (query) => {
    try {
      const where = [];
      const params = [];
      if (query.taskId) {
        where.push("task_id = ?");
        params.push(query.taskId);
      }
      if (query.sessionId) {
        where.push("session_id = ?");
        params.push(query.sessionId);
      }
      if (query.kind) {
        where.push("kind = ?");
        params.push(query.kind);
      }
      const limit = clamp(Math.trunc(Number(query.limit ?? 200)) || 200, 1, 500);
      const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
      return store.all(
        `SELECT id, session_id, task_id, kind, severity, subject, detail, evidence, created_at FROM findings ${clause} ORDER BY created_at DESC, id DESC LIMIT ?`,
        ...params,
        limit
      ).map(toFinding);
    } catch {
      return [];
    }
  };
  const onUsage = (record, ctx) => {
    try {
      const taskId = ctx?.taskId ?? record?.taskId ?? null;
      if (!taskId) return;
      const text = typeof ctx?.text === "string" ? ctx.text : "";
      if (!text.trim()) return;
      const entries = textBuffer.get(taskId) ?? [];
      entries.push({
        turn: num(record?.turn, -1),
        step: num(record?.step, -1),
        text: text.slice(0, 4e3)
      });
      if (entries.length > MAX_TEXTS_PER_TASK) entries.splice(0, entries.length - MAX_TEXTS_PER_TASK);
      textBuffer.set(taskId, entries);
      while (textBuffer.size > MAX_BUFFERED_TASKS) {
        const oldest = textBuffer.keys().next();
        if (oldest.done) break;
        textBuffer.delete(oldest.value);
      }
    } catch {
    }
  };
  const onToolCall = (_record) => {
  };
  const onToolResult = (_input) => {
  };
  return { onUsage, onToolCall, onToolResult, analyzeTask, findings };
}

// src/host/baseline.ts
var THROTTLE_MS = 6e4;
var CACHE_MS = 3e4;
function safeNum5(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function round62(value) {
  return Math.round(value * 1e6) / 1e6;
}
function mapBaselineRow(row) {
  const nullable = (v) => v === null || v === void 0 ? null : Number(v);
  return {
    taskType: row.task_type,
    projectId: String(row.project_id ?? "*"),
    sampleCount: safeNum5(row.sample_count),
    medianCalls: nullable(row.median_calls),
    p80Calls: nullable(row.p80_calls),
    medianTokens: nullable(row.median_tokens),
    p80Tokens: nullable(row.p80_tokens),
    medianCost: nullable(row.median_cost),
    p80Cost: nullable(row.p80_cost),
    updatedAt: safeNum5(row.updated_at)
  };
}
function medianOf2(sorted) {
  const n = sorted.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : round62((sorted[mid - 1] + sorted[mid]) / 2);
}
function p80Of(sorted) {
  const n = sorted.length;
  if (n === 0) return null;
  const rank = Math.max(1, Math.ceil(0.8 * n));
  return sorted[Math.min(n - 1, rank - 1)];
}
function createBaseline(store, settings) {
  let cache = null;
  const recordError = (where, error) => {
    try {
      store.metaSet(
        "last_error",
        JSON.stringify({ ts: Date.now(), where, message: String(error?.message ?? error) })
      );
    } catch {
    }
  };
  const minSamplesSetting = () => {
    try {
      const value = Number(settings.get()?.thresholds?.minBaselineSamples);
      return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 5;
    } catch {
      return 5;
    }
  };
  const loadPriceLookup = () => {
    const effective = /* @__PURE__ */ new Map();
    const any = /* @__PURE__ */ new Map();
    try {
      const rows = store.all(
        `SELECT provider, model_name, input_price, cache_read_price, cache_write_price, output_price, unit_tokens, effective_at
         FROM price_configs ORDER BY effective_at ASC, id ASC`
      );
      const now = Date.now();
      for (const row of rows) {
        const key = `${String(row.provider ?? "").trim()}\0${String(row.model_name ?? "").trim()}`;
        any.set(key, row);
        if (safeNum5(row.effective_at) <= now) effective.set(key, row);
      }
    } catch {
    }
    return (provider, model) => {
      const p = typeof provider === "string" ? provider.trim() : "";
      const m = typeof model === "string" ? model.trim() : "";
      if (!p || !m) return null;
      const key = `${p}\0${m}`;
      return effective.get(key) ?? any.get(key) ?? null;
    };
  };
  const querySamples = () => {
    const samples = /* @__PURE__ */ new Map();
    try {
      const tasks = store.all(
        `SELECT id, task_type, project_id FROM tasks
         WHERE status = 'completed' AND interference = 0 AND origin = 'auto'`
      );
      for (const task of tasks) {
        if (!TASK_TYPES.includes(task.task_type)) continue;
        samples.set(String(task.id), {
          taskType: task.task_type,
          projectId: String(task.project_id ?? "unknown"),
          calls: 0,
          tokens: 0,
          cost: 0
        });
      }
      if (samples.size === 0) return [];
      const priceFor = loadPriceLookup();
      const groups = store.all(
        `SELECT u.task_id, u.provider, u.model, COUNT(*) AS calls,
                COALESCE(SUM(u.input_tokens), 0) AS i, COALESCE(SUM(u.cache_read_tokens), 0) AS cr,
                COALESCE(SUM(u.cache_write_tokens), 0) AS cw, COALESCE(SUM(u.output_tokens), 0) AS o,
                COALESCE(SUM(u.total_tokens), 0) AS tot
         FROM usage_records u JOIN tasks t ON t.id = u.task_id
         WHERE u.is_final = 1 AND t.status = 'completed' AND t.interference = 0 AND t.origin = 'auto'
         GROUP BY u.task_id, u.provider, u.model`
      );
      for (const group of groups) {
        const sample = samples.get(String(group.task_id));
        if (!sample) continue;
        sample.calls += safeNum5(group.calls);
        sample.tokens += safeNum5(group.tot);
        if (sample.cost !== null) {
          const price = priceFor(group.provider ?? null, group.model ?? null);
          if (!price) {
            sample.cost = null;
          } else {
            const unit = safeNum5(price.unit_tokens) > 0 ? safeNum5(price.unit_tokens) : 1e6;
            const sum = safeNum5(group.i) * safeNum5(price.input_price) + safeNum5(group.cr) * safeNum5(price.cache_read_price) + safeNum5(group.cw) * safeNum5(price.cache_write_price) + safeNum5(group.o) * safeNum5(price.output_price);
            sample.cost += sum / unit;
          }
        }
      }
    } catch (error) {
      recordError("baseline.querySamples", error);
    }
    return [...samples.values()];
  };
  const collectSamples = (force) => {
    const now = Date.now();
    if (!force && cache && now - cache.at < CACHE_MS) return cache.samples;
    const samples = querySamples();
    cache = { at: now, samples };
    return samples;
  };
  const buildRow = (taskType, projectId, samples, minSamples, now) => {
    const sortedCalls = samples.map((s) => s.calls).sort((a, b) => a - b);
    const sortedTokens = samples.map((s) => s.tokens).sort((a, b) => a - b);
    const costs = samples.map((s) => s.cost).filter((v) => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
    const enough = samples.length >= minSamples;
    const enoughCost = costs.length >= minSamples;
    return {
      taskType,
      projectId,
      sampleCount: samples.length,
      medianCalls: enough ? medianOf2(sortedCalls) : null,
      p80Calls: enough ? p80Of(sortedCalls) : null,
      medianTokens: enough ? medianOf2(sortedTokens) : null,
      p80Tokens: enough ? p80Of(sortedTokens) : null,
      medianCost: enoughCost ? medianOf2(costs) : null,
      p80Cost: enoughCost ? p80Of(costs) : null,
      updatedAt: now
    };
  };
  const recompute = (projectId) => {
    try {
      const now = Date.now();
      const all = collectSamples(true);
      const target = typeof projectId === "string" ? projectId.trim() : "";
      const scopes = /* @__PURE__ */ new Set(["*"]);
      if (target) {
        scopes.add(target);
      } else {
        for (const sample of all) scopes.add(sample.projectId);
      }
      const minSamples = minSamplesSetting();
      const rows = [];
      for (const scope of scopes) {
        const scoped = scope === "*" ? all : all.filter((sample) => sample.projectId === scope);
        for (const taskType of TASK_TYPES) {
          rows.push(
            buildRow(
              taskType,
              scope,
              scoped.filter((sample) => sample.taskType === taskType),
              minSamples,
              now
            )
          );
        }
      }
      store.tx(() => {
        if (target) {
          store.run("DELETE FROM task_baselines WHERE project_id = ? OR project_id = ?", "*", target);
        } else {
          store.run("DELETE FROM task_baselines");
        }
        for (const row of rows) {
          store.run(
            `INSERT INTO task_baselines(task_type, project_id, sample_count, median_calls, p80_calls, median_tokens, p80_tokens, median_cost, p80_cost, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(task_type, project_id) DO UPDATE SET
               sample_count = excluded.sample_count,
               median_calls = excluded.median_calls,
               p80_calls = excluded.p80_calls,
               median_tokens = excluded.median_tokens,
               p80_tokens = excluded.p80_tokens,
               median_cost = excluded.median_cost,
               p80_cost = excluded.p80_cost,
               updated_at = excluded.updated_at`,
            row.taskType,
            row.projectId,
            row.sampleCount,
            row.medianCalls,
            row.p80Calls,
            row.medianTokens,
            row.p80Tokens,
            row.medianCost,
            row.p80Cost,
            row.updatedAt
          );
        }
      });
      cache = { at: now, samples: all };
    } catch (error) {
      recordError("baseline.recompute", error);
    }
  };
  const recomputeThrottled = (projectId) => {
    try {
      const last = safeNum5(store.metaGet("baseline_last_recompute"));
      const now = Date.now();
      if (last > 0 && now - last < THROTTLE_MS) return;
      recompute(projectId);
      store.metaSet("baseline_last_recompute", String(now));
    } catch (error) {
      recordError("baseline.recomputeThrottled", error);
    }
  };
  const list = (projectId) => {
    try {
      const selector = "task_type, project_id, sample_count, median_calls, p80_calls, median_tokens, p80_tokens, median_cost, p80_cost, updated_at";
      const rows = projectId ? store.all(
        `SELECT ${selector} FROM task_baselines WHERE project_id = ? OR project_id = '*' ORDER BY task_type, project_id`,
        String(projectId)
      ) : store.all(`SELECT ${selector} FROM task_baselines ORDER BY task_type, project_id`);
      return rows.map(mapBaselineRow);
    } catch (error) {
      recordError("baseline.list", error);
      return [];
    }
  };
  const get = (taskType, projectId = "*") => {
    try {
      const row = store.get(
        `SELECT task_type, project_id, sample_count, median_calls, p80_calls, median_tokens, p80_tokens, median_cost, p80_cost, updated_at
         FROM task_baselines WHERE task_type = ? AND project_id = ?`,
        String(taskType),
        String(projectId || "*")
      );
      return row ? mapBaselineRow(row) : null;
    } catch (error) {
      recordError("baseline.get", error);
      return null;
    }
  };
  const percentile = (taskType, metric, value, projectId) => {
    try {
      const minSamples = minSamplesSetting();
      const samples = collectSamples(false).filter(
        (sample) => sample.taskType === taskType && (!projectId || sample.projectId === projectId)
      );
      if (samples.length < minSamples) return null;
      const values = [];
      for (const sample of samples) {
        if (metric === "calls") values.push(sample.calls);
        else if (metric === "tokens") values.push(sample.tokens);
        else if (sample.cost !== null && Number.isFinite(sample.cost)) values.push(sample.cost);
      }
      if (values.length < minSamples) return null;
      const target = Number(value);
      if (!Number.isFinite(target)) return null;
      const belowOrEqual = values.filter((item) => item <= target).length;
      return Math.max(0, Math.min(100, Math.round(belowOrEqual / values.length * 100)));
    } catch (error) {
      recordError("baseline.percentile", error);
      return null;
    }
  };
  return { recompute, recomputeThrottled, list, get, percentile };
}

// src/host/usage-ledger.ts
import { createHash as createHash2 } from "node:crypto";
var MAX_SESSIONS = 512;
var PATH_KEYS = ["path", "file_path", "filePath", "target_path", "targetPath", "file", "target", "notebook_path", "directory", "dir"];
var COMMAND_KEYS = ["command", "cmd", "script", "shell"];
function canonicalize(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === "object") {
    const source = value;
    const out = {};
    for (const key of Object.keys(source).sort()) out[key] = canonicalize(source[key]);
    return out;
  }
  return value;
}
function sha256(text) {
  return createHash2("sha256").update(text, "utf8").digest("hex");
}
function hashJson(value) {
  try {
    const text = JSON.stringify(canonicalize(value) ?? null);
    return typeof text === "string" ? sha256(text) : null;
  } catch {
    return null;
  }
}
function asNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function asIntOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function asStr(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
var USAGE_V2_COLUMNS = [
  { name: "usage_basis", ddl: "TEXT" },
  { name: "effort_source", ddl: "TEXT" },
  { name: "reasoning_source", ddl: "TEXT" },
  { name: "reasoning_estimated", ddl: "INTEGER" },
  { name: "usage_partial", ddl: "INTEGER NOT NULL DEFAULT 0" }
];
function ensureUsageColumns(store) {
  try {
    const columns = new Set(
      store.all("PRAGMA table_info(usage_records)").map((row) => String(row?.name ?? ""))
    );
    if (columns.size === 0) return;
    for (const column of USAGE_V2_COLUMNS) {
      if (columns.has(column.name)) continue;
      try {
        store.exec(`ALTER TABLE usage_records ADD COLUMN ${column.name} ${column.ddl}`);
      } catch {
      }
    }
  } catch {
  }
}
function reasoningTextBytes(content, extra) {
  let bytes = 0;
  if (typeof extra === "string" && extra.length > 0) bytes += Buffer.byteLength(extra, "utf8");
  if (!Array.isArray(content)) return bytes;
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const item = block;
    const type = typeof item.type === "string" ? item.type : "";
    if ((type === "reasoning" || type === "thinking") && typeof item.text === "string") {
      bytes += Buffer.byteLength(item.text, "utf8");
    }
  }
  return bytes;
}
function reasoningStreamBytes(stream) {
  if (!Array.isArray(stream)) return 0;
  let fromRecords = 0;
  let fromChunks = 0;
  for (const record of stream) {
    if (!record || typeof record !== "object") continue;
    const item = record;
    if (item.type === "reasoning-chunks" && Array.isArray(item.texts)) {
      for (const text of item.texts) {
        if (typeof text === "string") fromRecords += Buffer.byteLength(text, "utf8");
      }
      continue;
    }
    if (item.type === "chunk" && item.chunk && typeof item.chunk === "object") {
      const chunk = item.chunk;
      if (chunk.type === "reasoning-delta" && typeof chunk.text === "string") {
        fromChunks += Buffer.byteLength(chunk.text, "utf8");
      }
    }
  }
  return fromRecords > 0 ? fromRecords : fromChunks;
}
function classifyUsage(usage, reasoningBytes = 0) {
  const buckets = toBuckets(usage ?? null);
  if (!usage) {
    const estimated2 = reasoningBytes > 0 ? Math.ceil(reasoningBytes / 4) : null;
    return {
      basis: "missing",
      buckets: toBuckets(null),
      partial: 0,
      reasoningSource: estimated2 === null ? null : "estimated",
      reasoningEstimated: estimated2
    };
  }
  const hasInput = usage.inputTokens !== void 0 && usage.inputTokens !== null;
  const hasOutput = usage.outputTokens !== void 0 && usage.outputTokens !== null;
  const partial = usage.cacheReadTokens === void 0 || usage.cacheWriteTokens === void 0 ? 1 : 0;
  const reasoning = asIntOrNull(usage.reasoningTokens);
  const estimated = reasoning === null && reasoningBytes > 0 ? Math.ceil(reasoningBytes / 4) : null;
  const reasoningSource = reasoning !== null ? "api" : estimated === null ? null : "estimated";
  if (!hasInput || !hasOutput) {
    return {
      // 残缺 usage：input/output 显式记为 0，basis=estimated 让报表不与真实用量混算。
      basis: "estimated",
      buckets: { ...buckets, inputTokens: hasInput ? buckets.inputTokens : 0, outputTokens: hasOutput ? buckets.outputTokens : 0 },
      partial,
      reasoningSource,
      reasoningEstimated: estimated
    };
  }
  return { basis: "api", buckets, partial, reasoningSource, reasoningEstimated: estimated };
}
function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const item = block;
    if (item.type === "text" && typeof item.text === "string") parts.push(item.text);
    else if (item.type === "image") parts.push("[image]");
    else if (item.type === "file") parts.push("[file]");
  }
  return parts.join("\n");
}
function lastUsageChunk(stream) {
  if (!Array.isArray(stream)) return null;
  for (let i = stream.length - 1; i >= 0; i -= 1) {
    const record = stream[i];
    if (!record || typeof record !== "object") continue;
    if (record.type === "chunk" && record.chunk && typeof record.chunk === "object") {
      const chunk = record.chunk;
      if (chunk.type === "usage" && chunk.usage && typeof chunk.usage === "object") return chunk.usage;
    }
  }
  return null;
}
function toBuckets(usage) {
  const inputTokens = asNum(usage?.inputTokens);
  const outputTokens = asNum(usage?.outputTokens);
  const cacheReadTokens = asNum(usage?.cacheReadTokens);
  const cacheWriteTokens = asNum(usage?.cacheWriteTokens);
  const sum = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
  const provided = asIntOrNull(usage?.totalTokens);
  const reasoning = asIntOrNull(usage?.reasoningTokens);
  return {
    inputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    outputTokens,
    // totalTokens 优先；缺失时按四桶之和（DeepSeek 路线两者相等）
    totalTokens: provided !== null ? provided : sum,
    // 本构建不产生 reasoningTokens；接口未提供时写 NULL，不猜 0
    reasoningTokens: reasoning
  };
}
function extractPath(args) {
  if (!args || typeof args !== "object") return null;
  const record = args;
  for (const key of PATH_KEYS) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  return null;
}
function extractCommand(args) {
  if (!args || typeof args !== "object") return null;
  const record = args;
  for (const key of COMMAND_KEYS) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  return null;
}
function compactArgs(args, raw) {
  if (typeof raw === "string") return raw;
  try {
    const text = JSON.stringify(canonicalize(args));
    return typeof text === "string" ? text : "";
  } catch {
    return "";
  }
}
function stateFor(states, sessionId) {
  const existing = states.get(sessionId);
  if (existing) return existing;
  const state = {
    turn: null,
    step: null,
    provider: null,
    model: null,
    reasoningEffort: null,
    stepStartedAt: null,
    projectId: "unknown",
    effortSource: null,
    attemptSeq: /* @__PURE__ */ new Map(),
    finalAttempt: /* @__PURE__ */ new Map(),
    pending: null
  };
  states.set(sessionId, state);
  while (states.size > MAX_SESSIONS) {
    const oldest = states.keys().next().value;
    if (oldest === void 0) break;
    states.delete(oldest);
  }
  return state;
}
function createUsageLedger(deps) {
  const { store, settings, tasks, analytics } = deps;
  const states = /* @__PURE__ */ new Map();
  ensureUsageColumns(store);
  const recordError = (where, error) => {
    try {
      store.metaSet("last_error", JSON.stringify({ ts: Date.now(), where, message: String(error?.message ?? error) }));
    } catch {
    }
  };
  const textLimit = () => {
    try {
      const value = Number(settings.get()?.evidenceTextLimit);
      return Number.isFinite(value) && value > 0 ? value : DEFAULTS.evidenceTextLimit;
    } catch {
      return DEFAULTS.evidenceTextLimit;
    }
  };
  const summaryOf = (text) => sanitizeText(text, textLimit());
  const writeUsage = (row) => {
    store.run(
      `INSERT OR REPLACE INTO usage_records(
         session_id, task_id, turn, step, attempt, is_final, provider, model, reasoning_effort,
         input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, reasoning_tokens,
         total_tokens, duration_ms, ts, message_id, source,
         usage_basis, effort_source, reasoning_source, reasoning_estimated, usage_partial
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.sessionId,
      row.taskId,
      row.turn,
      row.step,
      row.attempt,
      row.isFinal,
      row.provider,
      row.model,
      row.reasoningEffort,
      row.inputTokens,
      row.cacheReadTokens,
      row.cacheWriteTokens,
      row.outputTokens,
      row.reasoningTokens,
      row.totalTokens,
      row.durationMs,
      row.ts,
      row.messageId,
      row.source,
      row.usageBasis,
      row.effortSource,
      row.reasoningSource,
      row.reasoningEstimated,
      row.usagePartial
    );
  };
  const effortSourceOf = (sessionId, state, effort, adapterDefault) => {
    if (!effort) return null;
    if (adapterDefault) return "adapter-default";
    try {
      const auto = deps.autoEffort?.(sessionId, state.turn, state.step) ?? null;
      if (auto && auto.applied && auto.effort === effort) return "auto";
    } catch {
    }
    return "explicit";
  };
  const durationOf = (state, ts) => {
    if (state.stepStartedAt === null) return null;
    const delta = ts - state.stepStartedAt;
    return delta >= 0 && delta < 36e5 ? delta : null;
  };
  const createTaskFor = (sessionId, state, prompt, ts) => {
    if (state.turn === null) {
      state.pending = { text: prompt, ts };
      return;
    }
    try {
      const snapshot = JSON.stringify(sessionTotals(store, sessionId));
      tasks.onUserTurnStart({
        sessionId,
        projectId: state.projectId,
        turn: state.turn,
        prompt,
        snapshot,
        ts
      });
      state.pending = null;
    } catch (error) {
      recordError("ledger.onUserTurnStart", error);
    }
  };
  const flushPending = (sessionId, state, ts) => {
    if (!state.pending || state.turn === null) return;
    const pending = state.pending;
    state.pending = null;
    createTaskFor(sessionId, state, pending.text, pending.ts || ts);
  };
  const handleUserMessage = (sessionId, state, data, ts) => {
    const source = data.source;
    if (!source || source.kind !== "user") return;
    const prompt = contentText(data.content);
    createTaskFor(sessionId, state, prompt || "\uFF08\u7A7A\u6D88\u606F\uFF09", ts);
  };
  const handleRequestHeader = (sessionId, state, data) => {
    const header = data.header ?? data;
    const config = header?.config ?? data.config;
    if (!config) return;
    state.provider = asStr(config.provider) ?? state.provider;
    state.model = asStr(config.model) ?? state.model;
    const effort = asStr(config.reasoningEffort);
    if (effort) state.reasoningEffort = effort;
    const adapterDefaultsValue = header?.adapterDefaults ?? data.adapterDefaults;
    const adapterDefaults = adapterDefaultsValue && typeof adapterDefaultsValue === "object" ? adapterDefaultsValue : void 0;
    const isAdapterDefault = adapterDefaults?.reasoningEffort === true || adapterDefaultsValue === true;
    if (effort || isAdapterDefault) {
      state.effortSource = effortSourceOf(sessionId, state, effort ?? state.reasoningEffort, isAdapterDefault);
    }
  };
  const handleAttempt = (sessionId, state, data, ts) => {
    const turn = asIntOrNull(data.turn) ?? state.turn;
    const step = asIntOrNull(data.step) ?? state.step;
    if (turn === null || step === null) return;
    const usage = lastUsageChunk(data.stream);
    if (!usage) return;
    const key = `${turn}#${step}`;
    const seq = (state.attemptSeq.get(key) ?? 0) + 1;
    state.attemptSeq.set(key, seq);
    state.finalAttempt.delete(key);
    const classified = classifyUsage(usage);
    writeUsage({
      sessionId,
      taskId: tasks.taskIdFor(sessionId, turn),
      turn,
      step,
      attempt: seq,
      isFinal: 0,
      provider: state.provider,
      model: state.model,
      reasoningEffort: state.reasoningEffort,
      ...classified.buckets,
      durationMs: durationOf(state, ts),
      ts,
      messageId: asStr(data.message?.id),
      source: "live",
      usageBasis: classified.basis,
      effortSource: state.effortSource,
      reasoningSource: classified.reasoningSource,
      reasoningEstimated: classified.reasoningEstimated,
      usagePartial: classified.partial
    });
  };
  const handleFinalMessage = (sessionId, state, data, ts) => {
    const turn = asIntOrNull(data.turn) ?? state.turn;
    const step = asIntOrNull(data.step) ?? state.step;
    if (turn === null || step === null) return;
    if (state.turn === null) state.turn = turn;
    const message = data.message ?? {};
    const source = message.source ?? {};
    const provider = asStr(source.provider) ?? state.provider;
    const model = asStr(source.model) ?? state.model;
    const usage = data.usage ?? lastUsageChunk(data.stream);
    const contentReasoningBytes = reasoningTextBytes(message.content, data.reasoning ?? message.reasoning);
    const reasoningBytes = contentReasoningBytes > 0 ? contentReasoningBytes : reasoningStreamBytes(data.stream);
    const key = `${turn}#${step}`;
    const previousFinal = state.finalAttempt.get(key);
    const attempt = previousFinal ?? (state.attemptSeq.get(key) ?? 0) + 1;
    state.finalAttempt.set(key, attempt);
    const classified = classifyUsage(usage, reasoningBytes);
    if (!usage) {
      try {
        store.metaSet(
          "last_warning",
          JSON.stringify({ ts, where: "ledger.assistant/message", message: "usage missing", sessionId, turn, step })
        );
      } catch {
      }
    }
    const row = {
      sessionId,
      taskId: tasks.taskIdFor(sessionId, turn),
      turn,
      step,
      attempt,
      isFinal: 1,
      provider,
      model,
      reasoningEffort: state.reasoningEffort,
      ...classified.buckets,
      durationMs: durationOf(state, ts),
      ts,
      messageId: asStr(message.id),
      source: "live",
      usageBasis: classified.basis,
      effortSource: state.effortSource,
      reasoningSource: classified.reasoningSource,
      reasoningEstimated: classified.reasoningEstimated,
      usagePartial: classified.partial
    };
    writeUsage(row);
    if (state.provider === null && provider) state.provider = provider;
    if (state.model === null && model) state.model = model;
    if (classified.basis !== "api") return;
    try {
      analytics.onUsage(row, { taskId: row.taskId, text: summaryOf(contentText(message.content)) });
    } catch (error) {
      recordError("ledger.analytics.onUsage", error);
    }
  };
  const handleToolCall = (sessionId, state, data, ts) => {
    const turn = asIntOrNull(data.turn) ?? state.turn;
    const step = asIntOrNull(data.step) ?? state.step;
    const name2 = asStr(data.name) ?? "unknown";
    const rawArgs = data.arguments;
    let parsed = rawArgs;
    let argsHash = null;
    if (typeof rawArgs === "string") {
      try {
        parsed = JSON.parse(rawArgs);
      } catch {
        parsed = rawArgs;
      }
    }
    argsHash = hashJson(parsed) ?? (typeof rawArgs === "string" ? sha256(rawArgs) : null);
    const argsSummary = summaryOf(compactArgs(parsed, rawArgs));
    const targetPath = extractPath(parsed);
    const command = extractCommand(parsed);
    const callId = asStr(data.callId);
    const taskId = tasks.taskIdFor(sessionId, turn ?? 0);
    try {
      if (callId) {
        const duplicated = store.get(
          "SELECT id FROM tool_calls WHERE session_id = ? AND call_id = ? LIMIT 1",
          sessionId,
          callId
        );
        if (duplicated) return;
      }
      const info = store.run(
        `INSERT INTO tool_calls(session_id, task_id, turn, step, call_id, tool_name, args_hash, args_summary, target_path, command, result_hash, result_bytes, is_error, ts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        sessionId,
        taskId,
        turn,
        step,
        callId,
        name2,
        argsHash,
        argsSummary,
        targetPath,
        command,
        null,
        null,
        null,
        ts
      );
      const record = {
        id: info.lastInsertRowid,
        sessionId,
        taskId,
        turn,
        step,
        callId,
        toolName: name2,
        argsHash,
        argsSummary,
        targetPath,
        command,
        resultHash: null,
        resultBytes: null,
        isError: null,
        ts
      };
      try {
        analytics.onToolCall(record);
      } catch (error) {
        recordError("ledger.analytics.onToolCall", error);
      }
    } catch (error) {
      recordError("ledger.toolCall", error);
    }
  };
  const handleToolResult = (sessionId, state, data, ts) => {
    const message = data.message ?? {};
    const source = message.source ?? {};
    const callId = asStr(message.toolCallId) ?? asStr(source.callId) ?? asStr(data.callId);
    if (!callId) return;
    const content = message.content;
    const resultHash = hashJson(content);
    let resultBytes = null;
    try {
      resultBytes = Buffer.byteLength(JSON.stringify(content ?? null), "utf8");
    } catch {
      resultBytes = null;
    }
    const isError = message.isError === true || data.error !== void 0 && data.error !== null ? 1 : 0;
    try {
      const call = store.get(
        "SELECT id, task_id, tool_name, args_hash, turn, step FROM tool_calls WHERE session_id = ? AND call_id = ? ORDER BY id DESC LIMIT 1",
        sessionId,
        callId
      );
      if (!call) return;
      store.run(
        "UPDATE tool_calls SET result_hash = ?, result_bytes = ?, is_error = ? WHERE id = ?",
        resultHash,
        resultBytes,
        isError,
        call.id
      );
      try {
        analytics.onToolResult({
          sessionId,
          turn: asIntOrNull(data.turn) ?? call.turn,
          step: asIntOrNull(data.step) ?? call.step,
          callId,
          toolName: String(call.tool_name),
          argsHash: call.args_hash,
          resultHash,
          resultBytes,
          isError: isError === 1,
          taskId: call.task_id
        });
      } catch (error) {
        recordError("ledger.analytics.onToolResult", error);
      }
    } catch (error) {
      recordError("ledger.toolResult", error);
    }
  };
  const finishTurn = (sessionId, turn) => {
    try {
      const safeTurn = asIntOrNull(turn);
      if (safeTurn === null) return;
      const taskId = tasks.taskIdFor(sessionId, safeTurn);
      if (!taskId) return;
      const task = tasks.getTask(taskId);
      if (task && task.status === "running") {
        try {
          tasks.onTurnEnd({ sessionId, turn: safeTurn, ts: Date.now(), status: "completed" });
        } catch (error) {
          recordError("ledger.tasks.onTurnEnd", error);
        }
      }
      try {
        analytics.analyzeTask(taskId);
      } catch (error) {
        recordError("ledger.analytics.analyzeTask", error);
      }
      try {
        deps.onTaskEnded?.(taskId);
      } catch (error) {
        recordError("ledger.onTaskEnded", error);
      }
    } catch (error) {
      recordError("ledger.finishTurn", error);
    }
  };
  const handleTurnEnd = (sessionId, state, data, ts) => {
    const turn = asIntOrNull(data.turn) ?? state.turn;
    flushPending(sessionId, state, ts);
    if (turn !== null) {
      const reason = data.reason ?? {};
      const reasonKind = typeof reason.kind === "string" ? reason.kind : "completed";
      const status = reasonKind === "completed" || reasonKind === "max-tokens" ? "completed" : reasonKind === "error" ? "failed" : "aborted";
      try {
        tasks.onTurnEnd({ sessionId, turn, ts, status });
      } catch (error) {
        recordError("ledger.tasks.onTurnEnd", error);
      }
      finishTurn(sessionId, turn);
      for (const key of [...state.attemptSeq.keys()]) {
        if (key.startsWith(`${turn}#`)) state.attemptSeq.delete(key);
      }
      for (const key of [...state.finalAttempt.keys()]) {
        if (key.startsWith(`${turn}#`)) state.finalAttempt.delete(key);
      }
    }
    state.pending = null;
    if (state.turn === turn) state.turn = turn;
  };
  const handle = (session, event) => {
    try {
      if (!settings.get()?.enabled) return;
      const sessionId = asStr(session?.id) ?? asStr(session?.header?.id);
      if (!sessionId) return;
      const type = typeof event?.type === "string" ? event.type : "";
      if (!type) return;
      const data = event?.data ?? {};
      const ts = asIntOrNull(event.time) ?? Date.now();
      const state = stateFor(states, sessionId);
      state.projectId = projectIdOf(session);
      if (data.turn !== void 0) {
        const turn = asIntOrNull(data.turn);
        if (turn !== null && state.turn === null) state.turn = turn;
      }
      switch (type) {
        case "turn/start": {
          const turn = asIntOrNull(data.turn);
          if (turn !== null) state.turn = turn;
          flushPending(sessionId, state, ts);
          return;
        }
        case "user/message":
          handleUserMessage(sessionId, state, data, ts);
          return;
        case "request/header":
          handleRequestHeader(sessionId, state, data);
          return;
        case "request/context": {
          state.provider = asStr(data.provider) ?? state.provider;
          state.model = asStr(data.model) ?? state.model;
          return;
        }
        case "step/start": {
          const step = asIntOrNull(data.step);
          if (step !== null) state.step = step;
          state.stepStartedAt = ts;
          return;
        }
        case "assistant/attempt": {
          flushPending(sessionId, state, ts);
          handleAttempt(sessionId, state, data, ts);
          return;
        }
        case "assistant/message": {
          flushPending(sessionId, state, ts);
          handleFinalMessage(sessionId, state, data, ts);
          return;
        }
        case "tool/call": {
          flushPending(sessionId, state, ts);
          handleToolCall(sessionId, state, data, ts);
          return;
        }
        case "tool/result":
          handleToolResult(sessionId, state, data, ts);
          return;
        case "turn/end":
          handleTurnEnd(sessionId, state, data, ts);
          return;
        default:
          return;
      }
    } catch (error) {
      recordError("ledger.handle", error);
    }
  };
  return { handle, finishTurn };
}

// src/host/report.ts
import { statSync } from "node:fs";
var DAY_MS = 864e5;
var MAX_PAGE = 500;
var OVERVIEW_RANGES = /* @__PURE__ */ new Set(["today", "session", "task", "project", "all"]);
var SORT_COLUMNS = {
  ts: "u.ts",
  totalTokens: "u.total_tokens",
  inputTokens: "u.input_tokens",
  outputTokens: "u.output_tokens"
};
function zeroBuckets() {
  return { inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0, totalTokens: 0, reasoningTokens: null };
}
function num2(value, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function clamp2(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function startOfToday(now = Date.now()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
function toUsageRow(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    taskId: row.task_id,
    turn: num2(row.turn),
    step: num2(row.step),
    attempt: num2(row.attempt, 1),
    isFinal: num2(row.is_final, 1),
    provider: row.provider,
    model: row.model,
    reasoningEffort: row.reasoning_effort,
    inputTokens: num2(row.input_tokens),
    cacheReadTokens: num2(row.cache_read_tokens),
    cacheWriteTokens: num2(row.cache_write_tokens),
    outputTokens: num2(row.output_tokens),
    reasoningTokens: row.reasoning_tokens === null ? null : num2(row.reasoning_tokens),
    totalTokens: num2(row.total_tokens),
    durationMs: row.duration_ms === null ? null : num2(row.duration_ms),
    ts: num2(row.ts),
    messageId: row.message_id,
    source: row.source === "import" ? "import" : "live"
  };
}
function toTaskRow(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    projectId: row.project_id,
    taskName: row.task_name,
    taskType: row.task_type,
    taskTypeSource: row.task_type_source,
    status: row.status,
    origin: row.origin,
    turn: row.turn,
    startedAt: num2(row.started_at),
    endedAt: row.ended_at === null ? null : num2(row.ended_at),
    startSnapshot: row.start_snapshot,
    endSnapshot: row.end_snapshot,
    summary: row.summary,
    interference: num2(row.interference),
    firstPrompt: row.first_prompt
  };
}
function toSessionRow(row) {
  return {
    sessionId: row.session_id,
    projectId: row.project_id,
    cwd: row.cwd,
    parentSessionId: row.parent_session_id,
    origin: row.origin,
    agentPreset: row.agent_preset,
    createdAt: num2(row.created_at),
    lastSeenAt: num2(row.last_seen_at),
    isSubagent: num2(row.is_subagent)
  };
}
function createReportService(deps) {
  const { store, settings, costs, baseline, analytics, tasks } = deps;
  ensureUsageColumns(store);
  const threshold = (key) => {
    try {
      const value = settings.get().thresholds?.[key];
      return typeof value === "number" && Number.isFinite(value) ? value : DEFAULTS.thresholds[key];
    } catch {
      return DEFAULTS.thresholds[key];
    }
  };
  const scopeWhere = (input, alias = "u", includeImport = false) => {
    const parts = [
      includeImport ? `((${alias}.turn >= 0 AND ${alias}.source = 'live') OR (${alias}.turn = -1 AND ${alias}.source = 'import'))` : `(${alias}.turn >= 0 AND ${alias}.source = 'live')`
    ];
    const params = [];
    switch (input.range) {
      case "today": {
        parts.push(`${alias}.ts >= ?`);
        params.push(startOfToday());
        break;
      }
      case "session": {
        if (!input.sessionId) return { clause: "1 = 0", params: [] };
        parts.push(`${alias}.session_id = ?`);
        params.push(input.sessionId);
        break;
      }
      case "task": {
        if (!input.taskId) return { clause: "1 = 0", params: [] };
        parts.push(`${alias}.task_id = ?`);
        params.push(input.taskId);
        break;
      }
      case "project": {
        if (!input.projectId) return { clause: "1 = 0", params: [] };
        parts.push(`(${alias}.task_id IN (SELECT id FROM tasks WHERE project_id = ?) OR ${alias}.session_id IN (SELECT session_id FROM sessions WHERE project_id = ?))`);
        params.push(input.projectId, input.projectId);
        break;
      }
      default:
        break;
    }
    if (typeof input.from === "number" && Number.isFinite(input.from)) {
      parts.push(`${alias}.ts >= ?`);
      params.push(input.from);
    }
    if (typeof input.to === "number" && Number.isFinite(input.to)) {
      parts.push(`${alias}.ts <= ?`);
      params.push(input.to);
    }
    return { clause: parts.join(" AND "), params };
  };
  const findingsWhere = (input) => {
    const parts = [];
    const params = [];
    switch (input.range) {
      case "today":
        parts.push("created_at >= ?");
        params.push(startOfToday());
        break;
      case "session":
        if (!input.sessionId) return { clause: "1 = 0", params: [] };
        parts.push("session_id = ?");
        params.push(input.sessionId);
        break;
      case "task":
        if (!input.taskId) return { clause: "1 = 0", params: [] };
        parts.push("task_id = ?");
        params.push(input.taskId);
        break;
      case "project":
        if (!input.projectId) return { clause: "1 = 0", params: [] };
        parts.push("task_id IN (SELECT id FROM tasks WHERE project_id = ?)");
        params.push(input.projectId);
        break;
      default:
        break;
    }
    if (typeof input.from === "number" && Number.isFinite(input.from)) {
      parts.push("created_at >= ?");
      params.push(input.from);
    }
    if (typeof input.to === "number" && Number.isFinite(input.to)) {
      parts.push("created_at <= ?");
      params.push(input.to);
    }
    return { clause: parts.length > 0 ? parts.join(" AND ") : "1 = 1", params };
  };
  const pricedCost = (groups) => {
    if (groups.length === 0) return { cost: null, complete: false };
    let total = 0;
    let complete = true;
    let priced = 0;
    for (const group of groups) {
      const record = group;
      const value = costs.costOf(
        {
          inputTokens: num2(group.input_tokens),
          cacheReadTokens: num2(group.cache_read_tokens),
          cacheWriteTokens: num2(group.cache_write_tokens),
          outputTokens: num2(group.output_tokens)
        },
        record.provider ?? null,
        record.model ?? null
      );
      if (value === null) complete = false;
      else {
        total += value;
        priced += 1;
      }
    }
    return { cost: priced > 0 ? total : null, complete };
  };
  const taskCost = (usage) => {
    const groups = /* @__PURE__ */ new Map();
    for (const row of usage) {
      const key = `${row.provider ?? ""}\0${row.model ?? ""}`;
      const group = groups.get(key) ?? { provider: row.provider, model: row.model, input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
      group.input += row.inputTokens;
      group.cacheRead += row.cacheReadTokens;
      group.cacheWrite += row.cacheWriteTokens;
      group.output += row.outputTokens;
      groups.set(key, group);
    }
    let total = 0;
    for (const group of groups.values()) {
      const value = costs.costOf(
        { inputTokens: group.input, cacheReadTokens: group.cacheRead, cacheWriteTokens: group.cacheWrite, outputTokens: group.output },
        group.provider,
        group.model
      );
      if (value === null) return null;
      total += value;
    }
    return groups.size > 0 ? total : null;
  };
  const priceConfigured = (complete = true) => {
    let hasPrice = false;
    try {
      hasPrice = costs.listPrices().length > 0;
    } catch {
      hasPrice = false;
    }
    return hasPrice && complete;
  };
  const overview = (input) => {
    const range = OVERVIEW_RANGES.has(input.range) ? input.range : "all";
    const scopeInput = { ...input, range };
    const includeImport = range === "all";
    const where = scopeWhere(scopeInput, "u", includeImport);
    const liveWhere = scopeWhere(scopeInput);
    const totalsRow = store.get(
      `SELECT SUM(CASE WHEN u.turn >= 0 AND u.source = 'live' THEN 1 ELSE 0 END) AS calls, SUM(u.input_tokens) AS input, SUM(u.cache_read_tokens) AS cache_read, SUM(u.cache_write_tokens) AS cache_write, SUM(u.output_tokens) AS output, SUM(u.total_tokens) AS total, SUM(u.reasoning_tokens) AS reasoning FROM usage_records u WHERE ${where.clause}`,
      ...where.params
    );
    const totals = {
      inputTokens: num2(totalsRow?.input),
      cacheReadTokens: num2(totalsRow?.cache_read),
      cacheWriteTokens: num2(totalsRow?.cache_write),
      outputTokens: num2(totalsRow?.output),
      totalTokens: num2(totalsRow?.total),
      reasoningTokens: totalsRow?.reasoning === null || totalsRow?.reasoning === void 0 ? null : num2(totalsRow.reasoning)
    };
    const calls2 = num2(totalsRow?.calls);
    const cacheDenom = totals.cacheReadTokens + totals.inputTokens;
    const cacheHitRate = cacheDenom > 0 ? totals.cacheReadTokens / cacheDenom : null;
    const taskCountRow = store.get(
      `SELECT COUNT(DISTINCT u.task_id) AS tasks FROM usage_records u WHERE ${liveWhere.clause} AND u.task_id IS NOT NULL`,
      ...liveWhere.params
    );
    const taskCount = num2(taskCountRow?.tasks);
    const fWhere = findingsWhere(scopeInput);
    const findingCount = num2(
      store.get(`SELECT COUNT(*) AS c FROM findings WHERE ${fWhere.clause}`, ...fWhere.params)?.c
    );
    const overallGroups = store.all(
      `SELECT u.provider AS provider, u.model AS model, COALESCE(SUM(u.input_tokens),0) AS input_tokens, COALESCE(SUM(u.cache_read_tokens),0) AS cache_read_tokens, COALESCE(SUM(u.cache_write_tokens),0) AS cache_write_tokens, COALESCE(SUM(u.output_tokens),0) AS output_tokens, COALESCE(SUM(u.total_tokens),0) AS total_tokens FROM usage_records u WHERE ${where.clause} GROUP BY u.provider, u.model`,
      ...where.params
    );
    const overallCost = pricedCost(overallGroups);
    const hasAnyData = calls2 > 0 || overallGroups.length > 0;
    const days = clamp2(Math.trunc(Number(input.days ?? (range === "today" ? 1 : 30))) || 30, 1, 90);
    const since = startOfToday() - (days - 1) * DAY_MS;
    const dailyGroups = store.all(
      `SELECT strftime('%Y-%m-%d', u.ts / 1000, 'unixepoch', 'localtime') AS date, u.provider AS provider, u.model AS model, SUM(CASE WHEN u.turn >= 0 AND u.source = 'live' THEN 1 ELSE 0 END) AS calls, COALESCE(SUM(u.input_tokens),0) AS input_tokens, COALESCE(SUM(u.cache_read_tokens),0) AS cache_read_tokens, COALESCE(SUM(u.cache_write_tokens),0) AS cache_write_tokens, COALESCE(SUM(u.output_tokens),0) AS output_tokens, COALESCE(SUM(u.total_tokens),0) AS total_tokens FROM usage_records u WHERE ${where.clause} AND u.ts >= ? GROUP BY date, u.provider, u.model ORDER BY date ASC`,
      ...where.params,
      since
    );
    const dailyMap = /* @__PURE__ */ new Map();
    for (const row of dailyGroups) {
      const bucket = dailyMap.get(row.date) ?? { date: row.date, inputTokens: 0, cacheReadTokens: 0, outputTokens: 0, calls: 0, groups: [] };
      bucket.inputTokens += num2(row.input_tokens);
      bucket.cacheReadTokens += num2(row.cache_read_tokens);
      bucket.outputTokens += num2(row.output_tokens);
      bucket.calls += num2(row.calls);
      bucket.groups.push(row);
      dailyMap.set(row.date, bucket);
    }
    const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)).map((bucket) => {
      const priced = pricedCost(bucket.groups);
      return {
        date: bucket.date,
        inputTokens: bucket.inputTokens,
        cacheReadTokens: bucket.cacheReadTokens,
        outputTokens: bucket.outputTokens,
        calls: bucket.calls,
        cost: priced.cost
      };
    });
    const modelGroups = store.all(
      `SELECT u.provider AS provider, u.model AS model, SUM(CASE WHEN u.turn >= 0 AND u.source = 'live' THEN 1 ELSE 0 END) AS calls, COALESCE(SUM(u.input_tokens),0) AS input_tokens, COALESCE(SUM(u.cache_read_tokens),0) AS cache_read_tokens, COALESCE(SUM(u.cache_write_tokens),0) AS cache_write_tokens, COALESCE(SUM(u.output_tokens),0) AS output_tokens, COALESCE(SUM(u.total_tokens),0) AS total_tokens FROM usage_records u WHERE ${liveWhere.clause} GROUP BY u.provider, u.model ORDER BY total_tokens DESC LIMIT 10`,
      ...where.params
    );
    const models = modelGroups.map((group) => {
      const priced = pricedCost([group]);
      return { provider: group.provider, model: group.model, calls: num2(group.calls), totalTokens: num2(group.total_tokens), cost: priced.cost };
    });
    const projectGroups = store.all(
      `SELECT COALESCE(t.project_id, s.project_id, 'unknown') AS project_id, u.provider AS provider, u.model AS model, SUM(CASE WHEN u.turn >= 0 AND u.source = 'live' THEN 1 ELSE 0 END) AS calls, COALESCE(SUM(u.input_tokens),0) AS input_tokens, COALESCE(SUM(u.cache_read_tokens),0) AS cache_read_tokens, COALESCE(SUM(u.cache_write_tokens),0) AS cache_write_tokens, COALESCE(SUM(u.output_tokens),0) AS output_tokens, COALESCE(SUM(u.total_tokens),0) AS total_tokens FROM usage_records u LEFT JOIN tasks t ON t.id = u.task_id LEFT JOIN sessions s ON s.session_id = u.session_id WHERE ${where.clause} GROUP BY COALESCE(t.project_id, s.project_id, 'unknown'), u.provider, u.model`,
      ...where.params
    );
    const projectMap = /* @__PURE__ */ new Map();
    for (const row of projectGroups) {
      const bucket = projectMap.get(row.project_id) ?? { projectId: row.project_id, totalTokens: 0, calls: 0, groups: [] };
      bucket.totalTokens += num2(row.total_tokens);
      bucket.calls += num2(row.calls);
      bucket.groups.push(row);
      projectMap.set(row.project_id, bucket);
    }
    const projects = [...projectMap.values()].sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 10).map((bucket) => {
      const priced = pricedCost(bucket.groups);
      return { projectId: bucket.projectId, totalTokens: bucket.totalTokens, cost: priced.cost, calls: bucket.calls };
    });
    const taskRows = store.all(
      `SELECT u.task_id AS task_id, SUM(CASE WHEN u.turn >= 0 AND u.source = 'live' THEN 1 ELSE 0 END) AS calls, COALESCE(SUM(u.input_tokens),0) AS input_tokens, COALESCE(SUM(u.cache_read_tokens),0) AS cache_read_tokens, COALESCE(SUM(u.cache_write_tokens),0) AS cache_write_tokens, COALESCE(SUM(u.output_tokens),0) AS output_tokens, COALESCE(SUM(u.total_tokens),0) AS total_tokens FROM usage_records u WHERE ${liveWhere.clause} AND u.task_id IS NOT NULL GROUP BY u.task_id ORDER BY total_tokens DESC LIMIT 10`,
      ...where.params
    );
    const taskIds = taskRows.map((row) => row.task_id);
    const taskMeta = /* @__PURE__ */ new Map();
    if (taskIds.length > 0 && taskIds.length <= MAX_PAGE) {
      const placeholders = taskIds.map(() => "?").join(", ");
      const rows = store.all(
        `SELECT id, task_name, task_type FROM tasks WHERE id IN (${placeholders})`,
        ...taskIds
      );
      for (const row of rows) taskMeta.set(row.id, { taskName: row.task_name, taskType: row.task_type });
    }
    const taskGroups = /* @__PURE__ */ new Map();
    if (taskIds.length > 0) {
      const placeholders = taskIds.map(() => "?").join(", ");
      const rows = store.all(
        `SELECT u.task_id AS task_id, u.provider AS provider, u.model AS model, SUM(CASE WHEN u.turn >= 0 AND u.source = 'live' THEN 1 ELSE 0 END) AS calls, COALESCE(SUM(u.input_tokens),0) AS input_tokens, COALESCE(SUM(u.cache_read_tokens),0) AS cache_read_tokens, COALESCE(SUM(u.cache_write_tokens),0) AS cache_write_tokens, COALESCE(SUM(u.output_tokens),0) AS output_tokens, COALESCE(SUM(u.total_tokens),0) AS total_tokens FROM usage_records u WHERE ${liveWhere.clause} AND u.task_id IN (${placeholders}) GROUP BY u.task_id, u.provider, u.model`,
        ...where.params,
        ...taskIds
      );
      for (const row of rows) {
        const bucket = taskGroups.get(row.task_id) ?? [];
        bucket.push(row);
        taskGroups.set(row.task_id, bucket);
      }
    }
    const topTasks = taskRows.map((row) => {
      const priced = pricedCost(taskGroups.get(row.task_id) ?? []);
      const meta = taskMeta.get(row.task_id);
      return {
        taskId: row.task_id,
        taskName: meta?.taskName ?? row.task_id,
        taskType: meta?.taskType ?? "unknown",
        totalTokens: num2(row.total_tokens),
        calls: num2(row.calls),
        cost: priced.cost
      };
    });
    const configured = priceConfigured(hasAnyData ? overallCost.complete : true);
    let importedSessions = 0;
    let importedTokens = 0;
    if (includeImport) {
      const importedRow = store.get("SELECT COUNT(*) AS sessions, COALESCE(SUM(total_tokens),0) AS tokens FROM usage_records WHERE source = 'import' AND turn = -1");
      importedSessions = num2(importedRow?.sessions);
      importedTokens = num2(importedRow?.tokens);
    }
    const result = {
      range,
      totals,
      calls: calls2,
      tasks: taskCount,
      cacheHitRate,
      cost: overallCost.cost,
      priceConfigured: configured,
      findingCount,
      daily,
      models,
      projects,
      topTasks
    };
    return Object.assign(result, { importedSessions, importedTokens, imported: { sessions: importedSessions, tokens: importedTokens } });
  };
  const callsWhere = (query) => {
    const parts = ["u.turn >= 0", "u.source = 'live'"];
    const params = [];
    if (typeof query.from === "number" && Number.isFinite(query.from)) {
      parts.push("u.ts >= ?");
      params.push(query.from);
    }
    if (typeof query.to === "number" && Number.isFinite(query.to)) {
      parts.push("u.ts <= ?");
      params.push(query.to);
    }
    if (query.sessionId) {
      parts.push("u.session_id = ?");
      params.push(query.sessionId);
    }
    if (query.taskId) {
      parts.push("u.task_id = ?");
      params.push(query.taskId);
    }
    if (query.model) {
      parts.push("u.model = ?");
      params.push(query.model);
    }
    if (query.onlyFlagged) {
      parts.push("EXISTS (SELECT 1 FROM findings f WHERE f.task_id = u.task_id)");
    }
    return { clause: parts.join(" AND "), params };
  };
  const CALL_SELECT = `SELECT u.id AS id, u.session_id AS session_id, u.task_id AS task_id,
              u.turn AS turn, u.step AS step, u.attempt AS attempt, u.is_final AS is_final,
              u.provider AS provider, u.model AS model, u.reasoning_effort AS reasoning_effort,
              u.input_tokens AS input_tokens, u.cache_read_tokens AS cache_read_tokens,
              u.cache_write_tokens AS cache_write_tokens, u.output_tokens AS output_tokens,
              u.reasoning_tokens AS reasoning_tokens, u.reasoning_estimated AS reasoning_estimated, u.total_tokens AS total_tokens,
              u.duration_ms AS duration_ms, u.ts AS ts, u.message_id AS message_id, u.source AS source,
              u.usage_basis AS usage_basis, u.effort_source AS effort_source,
              u.reasoning_source AS reasoning_source, u.usage_partial AS usage_partial,
              t.task_name AS task_name, t.task_type AS task_type,
              EXISTS (SELECT 1 FROM findings f WHERE f.task_id = u.task_id) AS flagged
         FROM usage_records u
         LEFT JOIN tasks t ON t.id = u.task_id`;
  const toCallRow = (row) => {
    const usage = toUsageRow(row);
    const basis = row.usage_basis === "api" || row.usage_basis === "estimated" || row.usage_basis === "missing" ? row.usage_basis : "unknown";
    const cost = basis === "missing" ? null : costs.costOf(
      {
        inputTokens: usage.inputTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        outputTokens: usage.outputTokens
      },
      usage.provider,
      usage.model
    );
    const reasoningEstimatedTokens = row.reasoning_estimated === null || row.reasoning_estimated === void 0 ? null : num2(row.reasoning_estimated);
    const reasoningSource = usage.reasoningTokens !== null ? "api" : reasoningEstimatedTokens !== null ? "estimated" : "missing";
    const label = basis === "missing" ? "usage \u7F3A\u5931\uFF08API \u672A\u8FD4\u56DE\uFF0C\u8D39\u7528 null\uFF09" : basis === "estimated" ? "\u4F30\u7B97\uFF08API usage \u6B8B\u7F3A\uFF09" : basis === "api" ? "API \u771F\u5B9E\u503C" : "\u6765\u6E90\u672A\u6807\u8BB0\uFF08\u5386\u53F2\u884C\uFF09";
    const reasoningLabel = reasoningSource === "api" ? "" : reasoningSource === "estimated" ? `\uFF1B\u63A8\u7406 token \u4E3A\u4F30\u7B97 ${reasoningEstimatedTokens}\uFF08reasoning \u5757 bytes/4\uFF0C\u975E API \u503C\uFF09` : "\uFF1B\u63A8\u7406 token API \u672A\u8FD4\u56DE\uFF08NULL\uFF09";
    return {
      ...usage,
      taskName: row.task_name ?? null,
      taskType: row.task_type ?? null,
      cost,
      flagged: num2(row.flagged) === 1,
      usageBasis: basis,
      effortSource: row.effort_source === "auto" || row.effort_source === "explicit" || row.effort_source === "adapter-default" ? row.effort_source : "unknown",
      reasoningSource,
      reasoningEstimatedTokens,
      usagePartial: num2(row.usage_partial) === 1,
      sourceLabel: `${label}${reasoningLabel}`
    };
  };
  const calls = (query) => {
    const where = callsWhere(query ?? {});
    const total = num2(store.get(`SELECT COUNT(*) AS c FROM usage_records u WHERE ${where.clause}`, ...where.params)?.c);
    const limit = clamp2(Math.trunc(Number(query?.limit ?? 50)) || 50, 1, MAX_PAGE);
    const offset = Math.max(0, Math.trunc(Number(query?.offset ?? 0)) || 0);
    const desc = query?.order !== "asc";
    const direction = desc ? "DESC" : "ASC";
    if (query?.sort === "cost") {
      const rows2 = store.all(
        `${CALL_SELECT} WHERE ${where.clause} ORDER BY u.ts DESC LIMIT 50000`,
        ...where.params
      );
      const decorated = rows2.map(toCallRow);
      decorated.sort((a, b) => {
        const left = a.cost === null ? -Infinity : a.cost;
        const right = b.cost === null ? -Infinity : b.cost;
        if (left === right) return desc ? b.ts - a.ts : a.ts - b.ts;
        return desc ? right - left : left - right;
      });
      return { total, rows: decorated.slice(offset, offset + limit) };
    }
    const column = SORT_COLUMNS[query?.sort ?? "ts"] ?? "u.ts";
    const rows = store.all(
      `${CALL_SELECT} WHERE ${where.clause} ORDER BY ${column} ${direction}, u.id ${direction} LIMIT ? OFFSET ?`,
      ...where.params,
      limit,
      offset
    );
    return { total, rows: rows.map(toCallRow) };
  };
  const taskFromDb = (taskId) => {
    const row = store.get("SELECT * FROM tasks WHERE id = ?", taskId);
    return row ? toTaskRow(row) : null;
  };
  const safeGetTask = (taskId) => {
    try {
      const task = tasks.getTask(taskId);
      if (task) return task;
    } catch {
    }
    try {
      return taskFromDb(taskId);
    } catch {
      return null;
    }
  };
  const taskReport = (taskId) => {
    try {
      const task = safeGetTask(taskId);
      if (!task) return null;
      const rows = store.all(
        `SELECT * FROM usage_records WHERE task_id = ? AND turn >= 0 AND is_final = 1 AND source = 'live' ORDER BY ts ASC`,
        taskId
      );
      const usage = rows.map(toUsageRow);
      const basisOf = (row) => row.usage_basis === "api" || row.usage_basis === "estimated" || row.usage_basis === "missing" ? row.usage_basis : "unknown";
      const sources = { api: 0, estimated: 0, missing: 0, unknown: 0, reasoningReported: 0, reasoningEstimated: 0, reasoningMissing: 0, reasoningEstimatedTokens: 0, partial: 0, effortSources: { auto: 0, explicit: 0, "adapter-default": 0, unknown: 0 } };
      for (const row of rows) {
        sources[basisOf(row)] += 1;
        if (row.reasoning_tokens !== null && row.reasoning_tokens !== void 0) {
          sources.reasoningReported += 1;
        } else if (row.reasoning_estimated !== null && row.reasoning_estimated !== void 0) {
          sources.reasoningEstimated += 1;
          sources.reasoningEstimatedTokens += num2(row.reasoning_estimated);
        } else {
          sources.reasoningMissing += 1;
        }
        if (num2(row.usage_partial) === 1) sources.partial += 1;
        const effortSource = row.effort_source === "auto" || row.effort_source === "explicit" || row.effort_source === "adapter-default" ? row.effort_source : "unknown";
        sources.effortSources[effortSource] = (sources.effortSources[effortSource] ?? 0) + 1;
      }
      const billableUsage = usage.filter((_row, index) => basisOf(rows[index]) !== "missing");
      const buckets = zeroBuckets();
      let durationMs = 0;
      let hasDuration = false;
      for (const row of usage) {
        buckets.inputTokens += row.inputTokens;
        buckets.cacheReadTokens += row.cacheReadTokens;
        buckets.cacheWriteTokens += row.cacheWriteTokens;
        buckets.outputTokens += row.outputTokens;
        buckets.totalTokens += row.totalTokens;
        if (row.durationMs !== null) {
          durationMs += row.durationMs;
          hasDuration = true;
        }
      }
      const toolCalls = num2(store.get("SELECT COUNT(*) AS c FROM tool_calls WHERE task_id = ?", taskId)?.c);
      const cost = billableUsage.length > 0 ? taskCost(billableUsage) : null;
      const metrics = {
        calls: usage.length,
        buckets,
        cost,
        durationMs: task.endedAt !== null ? Math.max(0, task.endedAt - task.startedAt) : hasDuration ? durationMs : null,
        steps: new Set(usage.map((row) => `${row.turn}:${row.step}`)).size,
        toolCalls
      };
      const estimateNotes = [];
      if (sources.missing > 0) estimateNotes.push(`${sources.missing} \u6B21\u8BF7\u6C42 API \u672A\u8FD4\u56DE usage\uFF08basis=missing\uFF0C\u8D39\u7528 null\uFF0Ctoken \u4E0D\u8BA1\u5165\u771F\u5B9E\u7528\u91CF\uFF09`);
      if (sources.estimated > 0) estimateNotes.push(`${sources.estimated} \u6B21\u8BF7\u6C42 usage \u6B8B\u7F3A\uFF08basis=estimated\uFF0C\u4EC5\u4F30\u7B97\u53C2\u8003\uFF09`);
      if (sources.partial > 0) estimateNotes.push(`${sources.partial} \u6B21\u8BF7\u6C42 API \u672A\u63D0\u4F9B\u90E8\u5206\u7F13\u5B58\u6876\uFF08usage_partial=1\uFF09`);
      if (sources.reasoningEstimated > 0) estimateNotes.push(`${sources.reasoningEstimated} \u6B21\u8BF7\u6C42\u63A8\u7406 token \u4E3A\u4F30\u7B97\u503C\uFF08reasoning \u5185\u5BB9\u5757 bytes/4\uFF0C\u5408\u8BA1 ${sources.reasoningEstimatedTokens} tokens\uFF0C\u975E API \u503C\uFF09`);
      if (sources.reasoningMissing > 0) estimateNotes.push(`${sources.reasoningMissing}/${usage.length} \u6B21\u8BF7\u6C42\u63A8\u7406 token \u65E2\u65E0 API \u503C\u4E5F\u65E0 reasoning \u5757\uFF08NULL\uFF0C\u4E0D\u5199 0\uFF09`);
      if (estimateNotes.length === 0) estimateNotes.push("\u672C\u4EFB\u52A1\u5168\u90E8\u7EDF\u8BA1\u5B57\u6BB5\u6765\u81EA\u6A21\u578B API \u771F\u5B9E\u8FD4\u56DE");
      estimateNotes.push("\u8F93\u51FA token \u4E3A API \u8FD4\u56DE\u503C\uFF08\u662F\u5426\u542B\u63A8\u7406\u7531\u4E0A\u6E38\u9002\u914D\u5668\u51B3\u5B9A\uFF0C\u672C\u63D2\u4EF6\u4E0D\u63A8\u65AD\uFF09");
      const estimates = {
        anyEstimated: sources.estimated > 0 || sources.missing > 0 || sources.partial > 0 || sources.reasoningEstimated > 0,
        cost: cost !== null,
        reasoningTokens: sources.reasoningReported === 0,
        reasoningEstimatedTokens: sources.reasoningEstimatedTokens,
        notes: estimateNotes
      };
      let baselineRow = null;
      try {
        baselineRow = baseline.get(task.taskType, task.projectId);
      } catch {
        baselineRow = null;
      }
      let callsPercentile = null;
      let tokensPercentile = null;
      try {
        callsPercentile = baseline.percentile(task.taskType, "calls", metrics.calls, task.projectId);
      } catch {
        callsPercentile = null;
      }
      try {
        tokensPercentile = baseline.percentile(task.taskType, "tokens", buckets.totalTokens, task.projectId);
      } catch {
        tokensPercentile = null;
      }
      const usableBaseline = baselineRow !== null && num2(baselineRow.sampleCount) >= threshold("minBaselineSamples");
      let verdict = "\u6837\u672C\u4E0D\u8DB3\uFF0C\u6682\u65E0\u540C\u7C7B\u57FA\u7EBF\u5BF9\u6BD4";
      if (usableBaseline) {
        if (callsPercentile === null) verdict = "\u4E0E\u540C\u7C7B\u57FA\u7EBF\u76F8\u5F53";
        else if (callsPercentile >= 80) verdict = `\u8C03\u7528\u6B21\u6570\u9AD8\u4E8E ${callsPercentile}% \u7684\u540C\u7C7B\u4EFB\u52A1`;
        else if (callsPercentile >= 50) verdict = `\u8C03\u7528\u6B21\u6570\u7565\u9AD8\u4E8E\u4E2D\u4F4D\uFF08P${callsPercentile}\uFF09`;
        else verdict = `\u8C03\u7528\u6B21\u6570\u4F4E\u4E8E\u4E2D\u4F4D\uFF08P${callsPercentile}\uFF09`;
      }
      const avgInput = usage.length > 0 ? buckets.inputTokens / usage.length : 0;
      const avgOutput = usage.length > 0 ? buckets.outputTokens / usage.length : 0;
      const taskCacheDenom = buckets.cacheReadTokens + buckets.inputTokens;
      const avgCacheRate = taskCacheDenom > 0 ? buckets.cacheReadTokens / taskCacheDenom : 0;
      const maxInput = usage.reduce((acc, row) => Math.max(acc, row.inputTokens), 0);
      const maxCacheRead = usage.reduce((acc, row) => Math.max(acc, row.cacheReadTokens), 0);
      const maxOutput = usage.reduce((acc, row) => Math.max(acc, row.outputTokens), 0);
      const maxTotal = usage.reduce((acc, row) => Math.max(acc, row.totalTokens), 0);
      const maxCost = usage.reduce((acc, row) => {
        const value = costs.costOf({ inputTokens: row.inputTokens, cacheReadTokens: row.cacheReadTokens, cacheWriteTokens: row.cacheWriteTokens, outputTokens: row.outputTokens }, row.provider, row.model);
        if (value === null) return acc;
        return acc === null || value > acc ? value : acc;
      }, null);
      const multi = usage.length > 1;
      const ranked = [...usage].map((row, index) => {
        const basis = basisOf(rows[index]);
        const rowCost = basis === "missing" ? null : costs.costOf(
          {
            inputTokens: row.inputTokens,
            cacheReadTokens: row.cacheReadTokens,
            cacheWriteTokens: row.cacheWriteTokens,
            outputTokens: row.outputTokens
          },
          row.provider,
          row.model
        );
        return { row, cost: rowCost };
      }).sort((a, b) => {
        const left = a.cost === null ? -1 : a.cost;
        const right = b.cost === null ? -1 : b.cost;
        if (left === right) return b.row.totalTokens - a.row.totalTokens;
        return right - left;
      }).slice(0, 5);
      const topCalls = ranked.map(({ row, cost: rowCost }) => {
        const reasons = [];
        const inputTotal = row.inputTokens + row.cacheReadTokens;
        if (rowCost !== null && maxCost !== null && rowCost === maxCost) reasons.push("\u4F30\u7B97\u8D39\u7528\u6700\u9AD8");
        if (multi) {
          if (maxCacheRead > 0 && row.cacheReadTokens === maxCacheRead) reasons.push("\u7F13\u5B58\u8BFB\u53D6\u6700\u591A");
          if (maxInput > 0 && row.inputTokens === maxInput) reasons.push("\u672A\u547D\u4E2D\u8F93\u5165\u6700\u591A");
          if (maxOutput > 0 && row.outputTokens === maxOutput) reasons.push("\u8F93\u51FA\u6700\u591A");
          if (maxTotal > 0 && row.totalTokens === maxTotal) reasons.push("\u5408\u8BA1\u6700\u5927");
        }
        if (row.inputTokens >= Math.max(2e3, avgInput * 1.5)) reasons.push("\u5927\u8F93\u5165");
        if (inputTotal >= 2e3 && avgCacheRate > 0 && row.cacheReadTokens / inputTotal < avgCacheRate * 0.5) reasons.push("\u4F4E\u7F13\u5B58\u547D\u4E2D");
        if (row.outputTokens >= Math.max(1e3, avgOutput * 1.5)) reasons.push("\u9AD8\u8F93\u51FA");
        if (row.attempt > 1) reasons.push("\u91CD\u8BD5");
        if (reasons.length === 0) reasons.push(rowCost !== null ? "\u4F30\u7B97\u8D39\u7528\u6700\u9AD8" : "\u5408\u8BA1\u6700\u5927");
        return {
          id: num2(row.id),
          ts: row.ts,
          turn: row.turn,
          step: row.step,
          model: row.model,
          buckets: {
            inputTokens: row.inputTokens,
            cacheReadTokens: row.cacheReadTokens,
            cacheWriteTokens: row.cacheWriteTokens,
            outputTokens: row.outputTokens,
            totalTokens: row.totalTokens,
            reasoningTokens: row.reasoningTokens
          },
          cost: rowCost,
          reason: [...new Set(reasons)].join("\u3001")
        };
      });
      let findings = [];
      try {
        findings = analytics.findings({ taskId, limit: 500 });
      } catch {
        findings = [];
      }
      const suggestions = [];
      const addSuggestion = (text) => {
        const value = `${text}\uFF08\u4EC5\u5EFA\u8BAE\uFF0C\u4E0D\u4F1A\u81EA\u52A8\u6267\u884C\uFF09`;
        if (!suggestions.includes(value)) suggestions.push(value);
      };
      const kinds = new Set(findings.map((finding) => finding.kind));
      if (kinds.has("step_inflation")) addSuggestion("\u6A21\u578B\u8C03\u7528\u6B21\u6570\u504F\u591A\uFF1A\u53EF\u5408\u5E76\u76F8\u90BB\u6B65\u9AA4\uFF0C\u51CF\u5C11\u4E0D\u5FC5\u8981\u7684\u91CD\u590D\u8BFB\u53D6\u4E0E\u786E\u8BA4");
      if (kinds.has("repeated_read")) addSuggestion("\u540C\u4E00\u6587\u4EF6\u88AB\u91CD\u590D\u8BFB\u53D6\uFF1A\u53EF\u5148\u4E00\u6B21\u6027\u8BFB\u53D6\u5E76\u590D\u7528\u5185\u5BB9\uFF0C\u6216\u51CF\u5C11\u91CD\u590D\u67E5\u770B");
      if (kinds.has("repeated_tool")) addSuggestion("\u76F8\u540C\u5DE5\u5177\u4E0E\u53C2\u6570\u91CD\u590D\u6267\u884C\uFF1A\u53EF\u590D\u7528\u4E0A\u6B21\u7ED3\u679C\uFF0C\u907F\u514D\u91CD\u590D\u8C03\u7528");
      if (kinds.has("repeated_build") || kinds.has("repeated_test") || kinds.has("repeated_deploy")) {
        addSuggestion("\u6784\u5EFA/\u6D4B\u8BD5/\u90E8\u7F72\u547D\u4EE4\u91CD\u590D\u6267\u884C\uFF1A\u53EF\u5728\u4FEE\u6539\u5B8C\u6210\u540E\u5408\u5E76\u4E3A\u4E00\u6B21\u6267\u884C");
      }
      if (kinds.has("cache_hit_drop")) addSuggestion("\u7F13\u5B58\u547D\u4E2D\u7387\u504F\u4F4E\uFF1A\u4FDD\u6301\u7A33\u5B9A\u524D\u7F00\u4E0E\u4E0A\u4E0B\u6587\uFF0C\u51CF\u5C11\u9891\u7E41\u53D8\u52A8");
      if (kinds.has("task_cost_anomaly")) addSuggestion("\u4EFB\u52A1\u6210\u672C\u9AD8\u4E8E\u540C\u7C7B\u57FA\u7EBF\uFF1A\u68C0\u67E5\u662F\u5426\u5B58\u5728\u5197\u4F59\u6B65\u9AA4\u3001\u5927\u8F93\u5165\u6216\u9AD8\u8F93\u51FA\u8C03\u7528");
      if (kinds.has("confirmation_rounds")) addSuggestion("\u7591\u4F3C\u591A\u8F6E\u786E\u8BA4\uFF1A\u53EF\u5728\u4E00\u6761\u6D88\u606F\u4E2D\u7ED9\u51FA\u5B8C\u6574\u786E\u8BA4\uFF0C\u51CF\u5C11\u5F80\u8FD4");
      if (kinds.has("repeated_plan")) addSuggestion("\u7591\u4F3C\u91CD\u590D\u8BA1\u5212\uFF1A\u53EF\u5408\u5E76\u8BA1\u5212\u8F93\u51FA\uFF0C\u907F\u514D\u591A\u6B21\u91CD\u590D\u89C4\u5212");
      if (kinds.has("repeated_summary")) addSuggestion("\u7591\u4F3C\u91CD\u590D\u603B\u7ED3\uFF1A\u53EF\u5408\u5E76\u603B\u7ED3\u8F93\u51FA\uFF0C\u907F\u514D\u91CD\u590D\u6C47\u62A5");
      if (usableBaseline && callsPercentile !== null && callsPercentile >= 80) {
        addSuggestion("\u8C03\u7528\u6B21\u6570\u9AD8\u4E8E\u540C\u7C7B\u57FA\u7EBF p80\uFF1A\u5EFA\u8BAE\u68C0\u67E5\u6B65\u9AA4\u662F\u5426\u53EF\u5408\u5E76");
      }
      if (suggestions.length === 0) {
        suggestions.push("\u672A\u53D1\u73B0\u660E\u663E\u4F4E\u6548\u6A21\u5F0F\uFF08Phase 1 \u4EC5\u76D1\u63A7\u5206\u6790\uFF0C\u4E0D\u4F1A\u5E72\u9884\u8C03\u7528\uFF09");
      }
      const result = { task, metrics, baseline: baselineRow, comparison: { callsPercentile, tokensPercentile, verdict }, topCalls, findings, suggestions };
      return Object.assign(result, {
        sources,
        estimates,
        reasoning: {
          reported: sources.reasoningReported,
          estimated: sources.reasoningEstimated,
          estimatedTokens: sources.reasoningEstimatedTokens,
          missing: sources.reasoningMissing,
          note: sources.reasoningReported > 0 ? `${sources.reasoningReported} \u6B21\u8BF7\u6C42\u7531 API \u8FD4\u56DE reasoningTokens\uFF08\u771F\u5B9E\u503C\uFF09` : sources.reasoningEstimated > 0 ? `API \u672A\u8FD4\u56DE reasoningTokens\uFF1A\u63A8\u7406 token \u4E3A\u4F30\u7B97\u503C\uFF08reasoning \u5185\u5BB9\u5757 bytes/4\uFF0C\u5408\u8BA1 ${sources.reasoningEstimatedTokens}\uFF0Cestimated\uFF09` : "API \u672A\u8FD4\u56DE reasoningTokens\uFF0C\u4E14\u6D88\u606F\u65E0 reasoning \u5185\u5BB9\u5757\uFF1A\u63A8\u7406 token \u5168\u90E8\u4E3A NULL\uFF08\u4E0D\u662F 0\uFF09"
        }
      });
    } catch {
      return null;
    }
  };
  const sessions = (limit = 100) => {
    try {
      const size = clamp2(Math.trunc(Number(limit)) || 100, 1, MAX_PAGE);
      return store.all(
        `SELECT session_id, project_id, cwd, parent_session_id, origin, agent_preset, created_at, last_seen_at, is_subagent FROM sessions ORDER BY last_seen_at DESC, session_id LIMIT ?`,
        size
      ).map(toSessionRow);
    } catch {
      return [];
    }
  };
  const csvCell = (value) => {
    let text = value === null || value === void 0 ? "" : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const csvCalls = (query) => {
    const result = calls({ ...query ?? {}, limit: Math.min(clamp2(Math.trunc(Number(query?.limit ?? MAX_PAGE)) || MAX_PAGE, 1, MAX_PAGE), MAX_PAGE) });
    const header = [
      "ts",
      "time",
      "session_id",
      "task_id",
      "task_name",
      "provider",
      "model",
      "input_tokens",
      "cache_read_tokens",
      "cache_write_tokens",
      "output_tokens",
      "total_tokens",
      "cost",
      "duration_ms",
      "flagged"
    ];
    const lines = [header.map(csvCell).join(",")];
    for (const row of result.rows) {
      let time = "";
      try {
        time = new Date(row.ts).toISOString();
      } catch {
        time = String(row.ts);
      }
      lines.push(
        [
          row.ts,
          time,
          row.sessionId,
          row.taskId ?? "",
          row.taskName ?? "",
          row.provider ?? "",
          row.model ?? "",
          row.inputTokens,
          row.cacheReadTokens,
          row.cacheWriteTokens,
          row.outputTokens,
          row.totalTokens,
          row.cost === null ? "" : row.cost,
          row.durationMs ?? "",
          row.flagged ? 1 : 0
        ].map(csvCell).join(",")
      );
    }
    return `\uFEFF${lines.join("\r\n")}\r
`;
  };
  const readKv = (key) => {
    try {
      return store.get("SELECT v FROM kv WHERE k = ?", key)?.v;
    } catch {
      return void 0;
    }
  };
  const parseJson = (text) => {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  };
  const crossCheck = () => {
    const ledger = store.all(
      `SELECT session_id, COALESCE(SUM(input_tokens),0) AS input_tokens, COALESCE(SUM(cache_read_tokens),0) AS cache_read_tokens, COALESCE(SUM(cache_write_tokens),0) AS cache_write_tokens, COALESCE(SUM(output_tokens),0) AS output_tokens, COALESCE(SUM(total_tokens),0) AS total_tokens FROM usage_records WHERE turn >= 0 AND is_final = 1 GROUP BY session_id`
    );
    const official = store.all(
      `SELECT session_id, COALESCE(SUM(input_tokens),0) AS input_tokens, COALESCE(SUM(cache_read_tokens),0) AS cache_read_tokens, COALESCE(SUM(cache_write_tokens),0) AS cache_write_tokens, COALESCE(SUM(output_tokens),0) AS output_tokens, COALESCE(SUM(total_tokens),0) AS total_tokens FROM usage_records WHERE source = 'import' AND turn = -1 GROUP BY session_id`
    );
    const ledgerMap = new Map(ledger.map((row) => [row.session_id, row]));
    let checked = 0;
    let equal = 0;
    const mismatched = [];
    for (const row of official) {
      const mine = ledgerMap.get(row.session_id);
      if (!mine) continue;
      checked += 1;
      const same = num2(mine.input_tokens) === num2(row.input_tokens) && num2(mine.cache_read_tokens) === num2(row.cache_read_tokens) && num2(mine.cache_write_tokens) === num2(row.cache_write_tokens) && num2(mine.output_tokens) === num2(row.output_tokens) && num2(mine.total_tokens) === num2(row.total_tokens);
      if (same) equal += 1;
      else if (mismatched.length < 20) mismatched.push(row.session_id);
    }
    return { checked, equal, mismatched, at: Date.now() };
  };
  const dimRows = (sql, params) => {
    try {
      return store.all(sql, ...params);
    } catch {
      return [];
    }
  };
  const accumulate = (rows, keyOf) => {
    const map = /* @__PURE__ */ new Map();
    for (const row of rows) {
      const key = keyOf(row);
      let acc = map.get(key);
      if (!acc) {
        acc = {
          calls: 0,
          input: 0,
          cacheRead: 0,
          cacheWrite: 0,
          output: 0,
          total: 0,
          reasoning: null,
          reasoningRows: 0,
          reasoningEstimated: null,
          missingCalls: 0,
          partialCalls: 0,
          extras: /* @__PURE__ */ new Set(),
          groups: []
        };
        map.set(key, acc);
      }
      acc.calls += num2(row.calls);
      acc.input += num2(row.input_tokens);
      acc.cacheRead += num2(row.cache_read_tokens);
      acc.cacheWrite += num2(row.cache_write_tokens);
      acc.output += num2(row.output_tokens);
      acc.total += num2(row.total_tokens);
      if (row.reasoning_tokens !== null && row.reasoning_tokens !== void 0) {
        acc.reasoning = num2(acc.reasoning) + num2(row.reasoning_tokens);
        acc.reasoningRows += num2(row.reasoning_rows);
      }
      if (row.reasoning_estimated !== null && row.reasoning_estimated !== void 0) {
        acc.reasoningEstimated = num2(acc.reasoningEstimated) + num2(row.reasoning_estimated);
      }
      acc.missingCalls += num2(row.missing_calls);
      acc.partialCalls += num2(row.partial_calls);
      if (typeof row.extra === "string" && row.extra.length > 0) acc.extras.add(row.extra);
      acc.groups.push({
        provider: row.provider,
        model: row.model,
        input: num2(row.input_tokens),
        cacheRead: num2(row.cache_read_tokens),
        cacheWrite: num2(row.cache_write_tokens),
        output: num2(row.output_tokens)
      });
    }
    return map;
  };
  const costOfAccumulator = (acc) => {
    if (!acc || acc.groups.length === 0) return null;
    if (acc.missingCalls >= acc.calls && acc.calls > 0) return null;
    let total = 0;
    for (const group of acc.groups) {
      const value = costs.costOf(
        { inputTokens: group.input, cacheReadTokens: group.cacheRead, cacheWriteTokens: group.cacheWrite, outputTokens: group.output },
        group.provider,
        group.model
      );
      if (value === null) return null;
      total += value;
    }
    return total;
  };
  const cacheRate = (cacheRead, input) => {
    const denom = cacheRead + input;
    return denom > 0 ? cacheRead / denom : null;
  };
  const DIM_SELECT = `COALESCE(SUM(CASE WHEN u.turn >= 0 AND u.source = 'live' THEN 1 ELSE 0 END), 0) AS calls,
    COALESCE(SUM(u.input_tokens), 0) AS input_tokens,
    COALESCE(SUM(u.cache_read_tokens), 0) AS cache_read_tokens,
    COALESCE(SUM(u.cache_write_tokens), 0) AS cache_write_tokens,
    COALESCE(SUM(u.output_tokens), 0) AS output_tokens,
    COALESCE(SUM(u.total_tokens), 0) AS total_tokens,
    SUM(u.reasoning_tokens) AS reasoning_tokens,
    SUM(u.reasoning_estimated) AS reasoning_estimated,
    SUM(CASE WHEN u.reasoning_tokens IS NOT NULL THEN 1 ELSE 0 END) AS reasoning_rows,
    SUM(CASE WHEN u.usage_basis = 'missing' THEN 1 ELSE 0 END) AS missing_calls,
    SUM(CASE WHEN u.usage_partial = 1 THEN 1 ELSE 0 END) AS partial_calls`;
  const distinctTaskCounts = (expr, from, whereClause, params) => {
    try {
      const rows = store.all(
        `SELECT ${expr} AS k, COUNT(DISTINCT u.task_id) AS n FROM ${from} WHERE ${whereClause} AND u.task_id IS NOT NULL GROUP BY k`,
        ...params
      );
      return new Map(rows.map((row) => [String(row.k ?? "unknown"), num2(row.n)]));
    } catch {
      return /* @__PURE__ */ new Map();
    }
  };
  const dimensions = (input) => {
    const range = OVERVIEW_RANGES.has(input?.range ?? "") ? String(input.range) : "all";
    const scopeInput = { ...input ?? {}, range };
    const where = scopeWhere(scopeInput, "u", false);
    ensureUsageColumns(store);
    const agentSelect = `CASE WHEN COALESCE(s.is_subagent, 0) = 1 THEN 'subagent' ELSE 'main' END`;
    const agentRows = dimRows(
      `SELECT ${agentSelect} AS key, NULL AS extra, u.provider AS provider, u.model AS model, ${DIM_SELECT}
         FROM usage_records u LEFT JOIN sessions s ON s.session_id = u.session_id
        WHERE ${where.clause} GROUP BY key, u.provider, u.model`,
      where.params
    );
    const agentMap = accumulate(agentRows, (row) => row.key);
    const agentTaskCounts = distinctTaskCounts(agentSelect, "usage_records u LEFT JOIN sessions s ON s.session_id = u.session_id", where.clause, where.params);
    const agentSessionCounts = (() => {
      try {
        const rows = store.all(
          `SELECT ${agentSelect} AS k, COUNT(DISTINCT u.session_id) AS n
             FROM usage_records u LEFT JOIN sessions s ON s.session_id = u.session_id
            WHERE ${where.clause} GROUP BY k`,
          ...where.params
        );
        return new Map(rows.map((row) => [String(row.k), num2(row.n)]));
      } catch {
        return /* @__PURE__ */ new Map();
      }
    })();
    const byAgent = ["main", "subagent"].map((agent) => {
      const acc = agentMap.get(agent);
      return {
        agent,
        sessions: agentSessionCounts.get(agent) ?? 0,
        tasks: agentTaskCounts.get(agent) ?? 0,
        calls: acc?.calls ?? 0,
        inputTokens: acc?.input ?? 0,
        cacheReadTokens: acc?.cacheRead ?? 0,
        cacheWriteTokens: acc?.cacheWrite ?? 0,
        outputTokens: acc?.output ?? 0,
        totalTokens: acc?.total ?? 0,
        reasoningTokens: acc?.reasoning ?? null,
        reasoningEstimatedTokens: acc?.reasoningEstimated ?? null,
        cost: costOfAccumulator(acc),
        cacheHitRate: acc ? cacheRate(acc.cacheRead, acc.input) : null
      };
    });
    const effortRows = dimRows(
      `SELECT COALESCE(u.reasoning_effort, 'unknown') AS key, COALESCE(u.effort_source, 'unknown') AS extra,
              u.provider AS provider, u.model AS model, ${DIM_SELECT}
         FROM usage_records u WHERE ${where.clause} GROUP BY key, extra, u.provider, u.model`,
      where.params
    );
    const effortMap = accumulate(effortRows, (row) => `${row.key}::${row.extra ?? "unknown"}`);
    const effortTaskCounts = distinctTaskCounts(
      // 注意：SQL 里不要用 char(0) 作分隔符 —— node:sqlite 会把 TEXT 截断到 NUL。
      `COALESCE(u.reasoning_effort, 'unknown') || '::' || COALESCE(u.effort_source, 'unknown')`,
      "usage_records u",
      where.clause,
      where.params
    );
    const byEffort = [...effortMap.entries()].map(([composite, acc]) => {
      const [effort, source] = composite.split("::");
      return {
        effort: effort || "unknown",
        source: source === "auto" || source === "explicit" || source === "adapter-default" ? source : "unknown",
        calls: acc.calls,
        tasks: effortTaskCounts.get(composite) ?? 0,
        inputTokens: acc.input,
        cacheReadTokens: acc.cacheRead,
        cacheWriteTokens: acc.cacheWrite,
        outputTokens: acc.output,
        totalTokens: acc.total,
        reasoningTokens: acc.reasoning,
        reasoningEstimatedTokens: acc.reasoningEstimated ?? null,
        cost: costOfAccumulator(acc),
        cacheHitRate: cacheRate(acc.cacheRead, acc.input)
      };
    }).sort((a, b) => b.totalTokens - a.totalTokens);
    const attributionSelect = `CASE WHEN u.effort_source = 'auto' THEN 'auto'
                    WHEN u.effort_source IN ('explicit', 'adapter-default') THEN 'manual'
                    ELSE 'unknown' END`;
    const attributionRows = dimRows(
      `SELECT ${attributionSelect} AS key, NULL AS extra, u.provider AS provider, u.model AS model, ${DIM_SELECT}
         FROM usage_records u WHERE ${where.clause} GROUP BY key, u.provider, u.model`,
      where.params
    );
    const attributionMap = accumulate(attributionRows, (row) => row.key);
    const attributionTaskCounts = distinctTaskCounts(attributionSelect, "usage_records u", where.clause, where.params);
    const byAttribution = ["auto", "manual", "unknown"].map((attribution) => {
      const acc = attributionMap.get(attribution);
      const tasks2 = attributionTaskCounts.get(attribution) ?? 0;
      return {
        attribution,
        calls: acc?.calls ?? 0,
        tasks: tasks2,
        totalTokens: acc?.total ?? 0,
        outputTokens: acc?.output ?? 0,
        reasoningTokens: acc?.reasoning ?? null,
        reasoningEstimatedTokens: acc?.reasoningEstimated ?? null,
        cost: costOfAccumulator(acc),
        avgTokensPerTask: acc && tasks2 > 0 ? Math.round(acc.total / tasks2) : null
      };
    });
    const basisRows = dimRows(
      `SELECT COALESCE(u.usage_basis, 'unknown') AS key, NULL AS extra,
              u.provider AS provider, u.model AS model, ${DIM_SELECT}
         FROM usage_records u WHERE ${where.clause} GROUP BY key, u.provider, u.model`,
      where.params
    );
    const basisMap = accumulate(basisRows, (row) => row.key);
    const basisTaskCounts = distinctTaskCounts(`COALESCE(u.usage_basis, 'unknown')`, "usage_records u", where.clause, where.params);
    const basisNotes = {
      api: "API \u8FD4\u56DE\u7684\u771F\u5B9E usage\uFF1Ainput/output/cache \u5747\u4E3A\u6A21\u578B API \u6570\u503C",
      estimated: "API \u8FD4\u56DE\u7684 usage \u6B8B\u7F3A\uFF0C\u884C\u5185\u6570\u5B57\u4E0D\u53EF\u4FE1\uFF0C\u4EC5\u4F5C\u4F30\u7B97\u53C2\u8003",
      missing: "API \u672A\u8FD4\u56DE usage\uFF1A\u672C\u6B21\u8BF7\u6C42\u6CA1\u6709\u53EF\u8BA1\u8D39\u6570\u5B57\uFF0C\u8D39\u7528\u8BB0\u4E3A null\uFF08\u4E0D\u662F 0\uFF09",
      unknown: "\u5386\u53F2/\u5BFC\u5165\u884C\u6216\u65E7\u7248\u672C\u8BB0\u5F55\uFF0C\u6765\u6E90\u672A\u6807\u8BB0"
    };
    const byUsageBasis = ["api", "estimated", "missing", "unknown"].map((basis) => {
      const acc = basisMap.get(basis);
      return {
        basis,
        calls: acc?.calls ?? 0,
        tasks: basisTaskCounts.get(basis) ?? 0,
        inputTokens: acc?.input ?? 0,
        cacheReadTokens: acc?.cacheRead ?? 0,
        cacheWriteTokens: acc?.cacheWrite ?? 0,
        outputTokens: acc?.output ?? 0,
        totalTokens: acc?.total ?? 0,
        reasoningTokens: acc?.reasoning ?? null,
        reasoningEstimatedTokens: acc?.reasoningEstimated ?? null,
        cost: basis === "missing" ? null : costOfAccumulator(acc),
        note: basisNotes[basis] ?? ""
      };
    });
    const taskRows = dimRows(
      `SELECT u.task_id AS key, u.reasoning_effort AS extra, u.provider AS provider, u.model AS model, ${DIM_SELECT}
         FROM usage_records u WHERE ${where.clause} AND u.task_id IS NOT NULL
        GROUP BY u.task_id, u.reasoning_effort, u.provider, u.model`,
      where.params
    );
    const taskMap = accumulate(taskRows, (row) => row.key);
    const taskBasisRows = dimRows(
      `SELECT u.task_id AS key, u.usage_basis AS extra, u.provider AS provider, u.model AS model, ${DIM_SELECT}
         FROM usage_records u WHERE ${where.clause} AND u.task_id IS NOT NULL
        GROUP BY u.task_id, u.usage_basis, u.provider, u.model`,
      where.params
    );
    const taskBases = /* @__PURE__ */ new Map();
    for (const row of taskBasisRows) {
      const set = taskBases.get(row.key) ?? /* @__PURE__ */ new Set();
      if (typeof row.extra === "string" && row.extra.length > 0) set.add(row.extra);
      taskBases.set(row.key, set);
    }
    const taskMeta = /* @__PURE__ */ new Map();
    const taskIds = [...taskMap.keys()].slice(0, MAX_PAGE);
    if (taskIds.length > 0) {
      try {
        const placeholders = taskIds.map(() => "?").join(", ");
        const metas = store.all(
          `SELECT t.id AS id, t.task_name AS task_name, t.task_type AS task_type, s.is_subagent AS is_subagent
             FROM tasks t LEFT JOIN sessions s ON s.session_id = t.session_id WHERE t.id IN (${placeholders})`,
          ...taskIds
        );
        for (const meta of metas) {
          taskMeta.set(meta.id, {
            name: meta.task_name,
            type: meta.task_type,
            agent: num2(meta.is_subagent) === 1 ? "subagent" : "main"
          });
        }
      } catch {
      }
    }
    const byTask = [...taskMap.entries()].map(([taskId, acc]) => {
      const meta = taskMeta.get(taskId);
      const bases = [...taskBases.get(taskId) ?? /* @__PURE__ */ new Set()].filter((value) => value === "api" || value === "estimated" || value === "missing");
      if (bases.length === 0) bases.push("unknown");
      return {
        taskId,
        taskName: meta?.name ?? taskId,
        taskType: meta?.type ?? "unknown",
        agent: meta?.agent ?? "main",
        calls: acc.calls,
        inputTokens: acc.input,
        cacheReadTokens: acc.cacheRead,
        cacheWriteTokens: acc.cacheWrite,
        outputTokens: acc.output,
        totalTokens: acc.total,
        reasoningTokens: acc.reasoning,
        reasoningEstimatedTokens: acc.reasoningEstimated ?? null,
        cost: costOfAccumulator(acc),
        efforts: [...acc.extras].filter((value) => value !== "unknown").sort(),
        bases
      };
    }).sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 20);
    const totalAcc = accumulate(agentRows, () => "total").get("total");
    const totalTasks = (() => {
      try {
        return num2(store.get(
          `SELECT COUNT(DISTINCT u.task_id) AS n FROM usage_records u WHERE ${where.clause} AND u.task_id IS NOT NULL`,
          ...where.params
        )?.n);
      } catch {
        return 0;
      }
    })();
    const missingUsageCalls = byUsageBasis.find((bucket) => bucket.basis === "missing")?.calls ?? 0;
    const estimatedCalls = byUsageBasis.find((bucket) => bucket.basis === "estimated")?.calls ?? 0;
    const partialUsageCalls = totalAcc?.partialCalls ?? 0;
    const anyReasoning = [...byAgent, ...byEffort].some((row) => row.reasoningTokens !== null);
    const reasoningEstimatedTokens = totalAcc?.reasoningEstimated ?? 0;
    const costValue = costOfAccumulator(totalAcc);
    const notes = [];
    if (missingUsageCalls > 0) notes.push(`${missingUsageCalls} \u6B21\u8BF7\u6C42\u672A\u8FD4\u56DE usage\uFF08usage_basis=missing\uFF0C\u8D39\u7528\u8BB0\u4E3A null\uFF0C\u4E0D\u662F 0\uFF09`);
    if (estimatedCalls > 0) notes.push(`${estimatedCalls} \u6B21\u8BF7\u6C42 usage \u6B8B\u7F3A\uFF08usage_basis=estimated\uFF0C\u4EC5\u4F30\u7B97\u53C2\u8003\uFF09`);
    if (partialUsageCalls > 0) notes.push(`${partialUsageCalls} \u6B21\u8BF7\u6C42 API \u672A\u63D0\u4F9B\u90E8\u5206\u7F13\u5B58\u6876\uFF08usage_partial=1\uFF0C\u6309 0 \u8BB0\u5F55\u5E76\u6807\u6CE8\uFF09`);
    if (!anyReasoning) notes.push("API \u672A\u8FD4\u56DE reasoningTokens\uFF1A\u63A8\u7406 token \u5B57\u6BB5\u4E3A NULL\uFF08\u4E0D\u5199 0\uFF09");
    if (reasoningEstimatedTokens > 0) {
      notes.push(`\u63A8\u7406 token \u4F30\u7B97\uFF1A${reasoningEstimatedTokens} tokens\uFF08reasoning \u5185\u5BB9\u5757\u5B57\u8282/4\uFF0Cestimated\uFF0C\u975E API \u503C\uFF09`);
    }
    notes.push("\u8F93\u51FA token \u4E3A API \u8FD4\u56DE\u503C\uFF08\u662F\u5426\u542B\u63A8\u7406\u7531\u4E0A\u6E38\u9002\u914D\u5668\u51B3\u5B9A\uFF0C\u672C\u63D2\u4EF6\u4E0D\u63A8\u65AD\uFF09");
    if (notes.length === 0) notes.push("\u5168\u90E8\u7EDF\u8BA1\u5B57\u6BB5\u6765\u81EA\u6A21\u578B API \u7684\u771F\u5B9E\u8FD4\u56DE");
    return {
      range,
      generatedAt: Date.now(),
      totals: { calls: totalAcc?.calls ?? 0, tasks: totalTasks, totalTokens: totalAcc?.total ?? 0, cost: costValue },
      byAgent,
      byEffort,
      byAttribution,
      byUsageBasis,
      byTask,
      estimates: {
        cost: costValue !== null,
        reasoningTokens: !anyReasoning,
        anyEstimated: estimatedCalls > 0 || missingUsageCalls > 0 || partialUsageCalls > 0 || reasoningEstimatedTokens > 0,
        missingUsageCalls,
        partialUsageCalls,
        reasoningEstimatedTokens,
        notes
      }
    };
  };
  const health = () => {
    const output = {};
    try {
      output.dbPath = store.path;
      output.dbBytes = statSync(store.path).size;
    } catch {
      output.dbPath = store.path;
      output.dbBytes = null;
    }
    try {
      output.dbWritable = storeWritable(store);
    } catch {
      output.dbWritable = false;
    }
    try {
      output.schemaVersion = num2(store.get("PRAGMA user_version")?.user_version);
    } catch {
      output.schemaVersion = 0;
    }
    const countOf = (sql, ...params) => {
      try {
        return num2(store.get(sql, ...params)?.c);
      } catch {
        return 0;
      }
    };
    output.sessions = countOf("SELECT COUNT(*) AS c FROM sessions");
    output.tasks = countOf("SELECT COUNT(*) AS c FROM tasks");
    output.calls = countOf("SELECT COUNT(*) AS c FROM usage_records WHERE turn >= 0 AND source = 'live'");
    output.findings = countOf("SELECT COUNT(*) AS c FROM findings");
    output.baselines = countOf("SELECT COUNT(*) AS c FROM task_baselines");
    output.importSessions = countOf("SELECT COUNT(DISTINCT session_id) AS c FROM usage_records WHERE source = 'import'");
    output.importRows = countOf("SELECT COUNT(*) AS c FROM usage_records WHERE source = 'import'");
    try {
      output.prices = costs.listPrices().length;
    } catch {
      output.prices = 0;
    }
    let lastError = null;
    try {
      lastError = parseJson(store.metaGet("last_error"));
    } catch {
      lastError = null;
    }
    output.lastError = lastError ?? parseJson(readKv("last_error"));
    output.lastImport = parseJson(readKv("last_import"));
    output.lastCrossCheck = parseJson(readKv("crosscheck:last"));
    output.startInfo = parseJson(readKv("last_start"));
    try {
      output.crosscheck = crossCheck();
    } catch {
      output.crosscheck = { checked: 0, equal: 0, mismatched: [], at: Date.now() };
    }
    output.taskTypes = TASK_TYPES;
    output.now = Date.now();
    return output;
  };
  return { overview, calls, taskReport, sessions, csvCalls, health, dimensions };
}

// src/host/tool-cache.ts
import { createHash as createHash3 } from "node:crypto";

// src/host/summarizer.ts
var CONTENT_TYPE_LABELS = {
  text: "\u901A\u7528\u6587\u672C",
  "build-log": "\u6784\u5EFA\u65E5\u5FD7",
  "test-output": "\u6D4B\u8BD5\u8F93\u51FA",
  json: "JSON",
  xml: "XML",
  "file-list": "\u6587\u4EF6\u5217\u8868",
  "zip-list": "\u538B\u7F29\u5305\u5217\u8868",
  unknown: "\u672A\u77E5/\u4E8C\u8FDB\u5236"
};
var KEY_JSON_FIELDS = ["id", "name", "status", "code", "error", "errors", "message", "data", "items", "total", "count", "success", "ok", "result"];
var KEY_FILES = ["package.json", "tsconfig.json", "readme.md", "index.ts", "index.tsx", "index.js", "cargo.toml", "go.mod", "pom.xml", "build.gradle", ".gitignore", "requirements.txt", "dockerfile"];
var BUILD_TOOL_HINT = /build|compile|tsc|webpack|vite|esbuild|next|cmake|msbuild|gradle|maven|bundle/i;
var LIST_TOOL_HINT = /^(?:ls|dir|list|glob|find|tree|list_files|list_dir|search_files|fd)$/i;
var ZIP_TOOL_HINT = /zip|unzip|7z|tar|rar/i;
function splitLines(text) {
  return text.replace(/\r\n?/g, "\n").split("\n");
}
function truncate(text, limit) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(1, limit - 1))}\u2026`;
}
function uniqueStrings(values) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}
function collect(text, pattern, group, limit) {
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  const values = [];
  let match;
  while ((match = re.exec(text)) !== null && values.length < limit) {
    const value = match[group];
    if (value) values.push(value);
    if (match.index === re.lastIndex) re.lastIndex += 1;
  }
  return uniqueStrings(values);
}
function firstNumber(text, pattern) {
  const re = new RegExp(pattern.source, pattern.flags.replace("g", ""));
  const match = re.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}
function headTail(text, headLines, tailLines) {
  const lines = splitLines(text);
  const head = Math.max(1, Math.trunc(headLines));
  const tail = Math.max(0, Math.trunc(tailLines));
  if (lines.length <= head + tail + 1) {
    return lines.map((line, index) => `${String(index + 1).padStart(4, " ")} | ${line}`).join("\n");
  }
  const omitted = lines.length - head - tail;
  const out = lines.slice(0, head).map((line, index) => `${String(index + 1).padStart(4, " ")} | ${line}`);
  out.push(`     \u2026\uFF08\u7701\u7565 ${omitted} \u884C\uFF09\u2026`);
  const start = lines.length - tail;
  for (let index = start; index < lines.length; index += 1) {
    out.push(`${String(index + 1).padStart(4, " ")} | ${lines[index]}`);
  }
  return out.join("\n");
}
function extensionStats(lines) {
  const counts = /* @__PURE__ */ new Map();
  for (const line of lines) {
    const match = /\.([A-Za-z0-9]{1,8})\s*$/.exec(line.trim());
    if (!match) continue;
    const ext = `.${match[1].toLowerCase()}`;
    counts.set(ext, (counts.get(ext) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([ext, count]) => ({ ext, count }));
}
function jsonTypeOf(value) {
  if (Array.isArray(value)) return `array[${value.length}]`;
  if (value === null) return "null";
  return typeof value;
}
function summarizeJson(text, options) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return `JSON \u89E3\u6790\u5931\u8D25\uFF0C\u6309\u901A\u7528\u6587\u672C\u5904\u7406:
${headTail(text, options.headLines, options.tailLines)}`;
  }
  const lines = [];
  lines.push(`\u7ED3\u6784: ${jsonTypeOf(parsed)}`);
  let sample = parsed;
  if (Array.isArray(parsed)) {
    lines.push(`\u6570\u7EC4\u957F\u5EA6: ${parsed.length}`);
    const first = parsed[0];
    if (first !== void 0) lines.push(`\u5143\u7D20\u7ED3\u6784: ${jsonTypeOf(first)}${first && typeof first === "object" && !Array.isArray(first) ? `\uFF08\u952E: ${Object.keys(first).slice(0, 10).join("\u3001")}\uFF09` : ""}`);
    sample = first;
  } else if (parsed && typeof parsed === "object") {
    const record = parsed;
    const keys = Object.keys(record);
    lines.push(`\u952E(${keys.length}): ${keys.slice(0, 12).map((key) => `${key} (${jsonTypeOf(record[key])})`).join("\u3001")}`);
    const arrays = keys.filter((key) => Array.isArray(record[key])).map((key) => `${key}=${record[key].length}`);
    if (arrays.length > 0) lines.push(`\u6570\u7EC4\u957F\u5EA6: ${arrays.slice(0, 8).join("\u3001")}`);
    const keyFields = [];
    for (const key of KEY_JSON_FIELDS) {
      if (!(key in record)) continue;
      keyFields.push(`${key}=${truncate(JSON.stringify(record[key]), 80)}`);
      if (keyFields.length >= 6) break;
    }
    if (keyFields.length > 0) lines.push(`\u5173\u952E\u5B57\u6BB5: ${keyFields.join("\u3001")}`);
    const anomalies = [];
    for (const key of keys) {
      const value = record[key];
      if (/(?:^|_)(?:error|err|fail|exception|invalid)/i.test(key) && value !== null && value !== void 0 && value !== "" && value !== false) {
        anomalies.push(`${key}=${truncate(JSON.stringify(value), 60)}`);
      }
      if (anomalies.length >= 4) break;
    }
    const nullKeys = keys.filter((key) => record[key] === null);
    if (nullKeys.length > 0) anomalies.push(`null \u5B57\u6BB5: ${nullKeys.slice(0, 8).join("\u3001")}`);
    if (anomalies.length > 0) lines.push(`\u5F02\u5E38\u5B57\u6BB5: ${anomalies.join("\uFF1B")}`);
  }
  if (sample !== void 0) lines.push(`\u6837\u4F8B: ${truncate(JSON.stringify(sample), 240)}`);
  return lines.join("\n");
}
function summarizeXml(text, options) {
  const root = /<([A-Za-z_][\w:.-]*)[\s>]/.exec(text)?.[1] ?? "\u672A\u77E5";
  const counts = /* @__PURE__ */ new Map();
  const tagRe = /<([A-Za-z_][\w:.-]*)[\s/>]/g;
  let tagMatch;
  while ((tagMatch = tagRe.exec(text)) !== null) {
    const tag = tagMatch[1];
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const topTags = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
  const lines = [`\u6839\u8282\u70B9: <${root}>`, `\u8282\u70B9\u7EDF\u8BA1: ${topTags.map(([tag, count]) => `<${tag}>\xD7${count}`).join("\u3001")}`];
  const attrMatch = /<([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"]*")+)\s*\/?>/.exec(text);
  if (attrMatch) {
    const attrs = collect(attrMatch[2], /([\w:.-]+)="([^"]*)"/g, 0, 6);
    if (attrs.length > 0) lines.push(`\u5173\u952E\u5C5E\u6027: <${attrMatch[1]}> ${attrs.join(" ")}`);
  }
  const errors = [];
  const errorRe = /<(error|errors|fault|exception|message)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let errorMatch;
  while ((errorMatch = errorRe.exec(text)) !== null && errors.length < 4) {
    const value = truncate(errorMatch[2].replace(/<[^>]+>/g, " "), 120);
    if (value) errors.push(`<${errorMatch[1]}> ${value}`);
  }
  if (errors.length > 0) lines.push(`\u9519\u8BEF\u4FE1\u606F:
- ${errors.join("\n- ")}`);
  if (lines.length <= 2) lines.push(headTail(text, options.headLines, options.tailLines));
  return lines.join("\n");
}
function summarizeBuildLog(text, options) {
  const lines = splitLines(text);
  const errorLines = lines.filter((line) => /\b(?:error|ERROR|failed|FAIL)\b/.test(line) && !/\b0\s+errors?\b/i.test(line));
  const success = errorLines.length === 0 && /(?:BUILD SUCCESSFUL|build succeeded|compiled successfully|webpack compiled|✓ built in|Done in \d|build completed|0 errors)/i.test(text);
  const codes = collect(text, /\b(?:TS\d{3,5}|E\d{3,5}|C\d{4}|ERR_[A-Z_]+|[A-Z]+_ERROR)\b/g, 0, 6);
  const fileRefs = collect(text, /((?:[A-Za-z0-9_.@/\\-]+)\.(?:ts|tsx|js|jsx|json|css|scss|md|py|go|rs|java|c|cc|cpp|h|hpp))[:(](\d+)/g, 0, 5);
  const out = [`\u6784\u5EFA\u7ED3\u679C: ${success ? "\u6210\u529F" : "\u5931\u8D25"}`, `\u9519\u8BEF\u6761\u6570: ${errorLines.length}`];
  if (codes.length > 0) out.push(`\u9519\u8BEF\u7801: ${codes.join("\u3001")}`);
  if (fileRefs.length > 0) out.push(`\u6587\u4EF6:\u884C\u53F7: ${fileRefs.slice(0, 5).join("\u3001")}`);
  const keyErrors = errorLines.slice(0, options.level === "smart" ? 6 : 3).map((line) => `- ${truncate(line, 160)}`);
  if (keyErrors.length > 0) out.push(`\u5173\u952E\u9519\u8BEF:
${keyErrors.join("\n")}`);
  out.push(`\u539F\u6587\u9996\u5C3E:
${headTail(text, Math.min(options.headLines, 20), Math.min(options.tailLines, 10))}`);
  return out.join("\n");
}
function summarizeTestOutput(text, options) {
  const passed = firstNumber(text, /(\d+)\s+passed\b/i) ?? firstNumber(text, /(\d+)\s+passing\b/i) ?? firstNumber(text, /#\s*pass\s+(\d+)/i);
  const failed = firstNumber(text, /(\d+)\s+failed\b/i) ?? firstNumber(text, /(\d+)\s+failing\b/i) ?? firstNumber(text, /#\s*fail\s+(\d+)/i);
  const skipped = firstNumber(text, /(\d+)\s+(?:skipped|pending|todo)\b/i);
  const total = firstNumber(text, /#\s*tests\s+(\d+)/i) ?? firstNumber(text, /(\d+)\s+tests?\b/i);
  const lines = splitLines(text);
  const failing = lines.filter((line) => /^\s*(?:FAIL|✗|×|✖|not ok|●)\b/.test(line.trim())).map((line) => `- ${truncate(line, 140)}`);
  const details = lines.filter((line) => /(?:AssertionError|Error:|Expected|Received|TimeoutError|at\s+\S+:\d+:\d+)/.test(line)).slice(0, options.level === "smart" ? 6 : 3).map((line) => `- ${truncate(line, 160)}`);
  const out = [];
  const counts = [`\u901A\u8FC7 ${passed ?? "?"}`, `\u5931\u8D25 ${failed ?? "?"}`];
  if (skipped !== null) counts.push(`\u8DF3\u8FC7 ${skipped}`);
  if (total !== null) counts.push(`\u603B\u8BA1 ${total}`);
  out.push(`\u6D4B\u8BD5\u7ED3\u679C: ${(failed ?? 0) > 0 ? "\u5931\u8D25" : (passed ?? 0) > 0 ? "\u901A\u8FC7" : "\u672A\u8BC6\u522B"}`);
  out.push(`\u7EDF\u8BA1: ${counts.join(" / ")}`);
  if (failing.length > 0) out.push(`\u5931\u8D25\u7528\u4F8B(${failing.length}):
${failing.slice(0, options.level === "smart" ? 6 : 3).join("\n")}`);
  if (details.length > 0) out.push(`\u9519\u8BEF\u8BE6\u60C5:
${details.join("\n")}`);
  if (out.length === 2) out.push(`\u539F\u6587\u9996\u5C3E:
${headTail(text, Math.min(options.headLines, 20), Math.min(options.tailLines, 10))}`);
  return out.join("\n");
}
function summarizeFileList(text, options) {
  const lines = splitLines(text).filter((line) => line.trim().length > 0);
  const files = lines.filter((line) => /(?:^|[\\/\s])(?:[\w.@-]+\.[A-Za-z0-9]{1,8})\s*$/.test(line.trim()));
  const dirs = lines.filter((line) => /[\\/]\s*$/.test(line.trim()) || /^[├└│┌┐┘─]/.test(line.trim()));
  const exts = extensionStats(files);
  const keyFiles = files.map((line) => line.trim()).filter((line) => KEY_FILES.includes(line.split(/[\\/]/).pop().toLowerCase())).slice(0, 8);
  const out = [`\u6761\u76EE\u7EDF\u8BA1: \u6587\u4EF6 ${files.length} / \u76EE\u5F55/\u8282\u70B9 ${dirs.length} / \u603B\u884C ${lines.length}`];
  if (exts.length > 0) out.push(`\u6269\u5C55\u540D: ${exts.slice(0, 6).map((item) => `${item.ext}=${item.count}`).join("\u3001")}`);
  if (keyFiles.length > 0) out.push(`\u5173\u952E\u6587\u4EF6: ${keyFiles.join("\u3001")}`);
  const examples = lines.slice(0, options.level === "smart" ? 12 : 8).map((line) => truncate(line, 120));
  out.push(`\u76EE\u5F55\u7ED3\u6784/\u793A\u4F8B:
${examples.join("\n")}`);
  return out.join("\n");
}
function summarizeZipList(text, options) {
  const lines = splitLines(text).filter((line) => line.trim().length > 0);
  const entries = lines.filter((line) => /^\s*\d+\s+\d{4}-\d{2}-\d{2}/.test(line) || /^\s*[\d.]+\s+\S+\s+\S+\s+\S+\s+\S+/.test(line) || /\.(?:zip|tar|gz|7z|rar|jar|whl)$/i.test(line.trim()));
  const exts = extensionStats(entries.length > 0 ? entries : lines);
  const out = [`\u6761\u76EE\u6570: ${entries.length > 0 ? entries.length : lines.length}`];
  if (exts.length > 0) out.push(`\u6269\u5C55\u540D: ${exts.slice(0, 6).map((item) => `${item.ext}=${item.count}`).join("\u3001")}`);
  const examples = (entries.length > 0 ? entries : lines).slice(0, options.level === "smart" ? 10 : 6).map((line) => truncate(line, 120));
  out.push(`\u793A\u4F8B\u6761\u76EE:
${examples.join("\n")}`);
  return out.join("\n");
}
function isTestOutput(text) {
  return /(?:^|\n)\s*(?:Tests?|Test Suites?)\s*:/i.test(text) || /(?:^|\n)\s*(?:PASS|FAIL)\s+\S/.test(text) || /(?:^|\n)#\s*(?:tests|pass|fail)\s+\d+/i.test(text) || /(\d+)\s+passing\b/i.test(text) || /(\d+)\s+passed[,\s]+.*(\d+)\s+failed/i.test(text) || /(?:^|\n)\s*(?:ok|not ok)\s+\d+\s+-/i.test(text) || /(?:^|\n)\s*(?:✓|✗|×|✖)\s/.test(text);
}
function isBuildLog(text, toolName) {
  if (/(?:^|\n)\s*error\s+(?:TS\d{3,5}|E\d+|C\d{4})/i.test(text)) return true;
  if (/(?:BUILD SUCCESSFUL|BUILD FAILED|build succeeded|build failed|compiled successfully|webpack compiled|✓ built in|npm ERR!)/i.test(text)) return true;
  if (/(?:^|\n)\s*at\s+\S+:\d+:\d+/.test(text)) return true;
  const hint = BUILD_TOOL_HINT.test(toolName ?? "");
  return hint && /(?:^|\n)\s*(?:error|warning)\b/i.test(text);
}
function isFileList(text, toolName) {
  const lines = splitLines(text).filter((line) => line.trim().length > 0);
  if (lines.length < 3) return false;
  if (/[├└│]──/.test(text)) return true;
  const pathish = lines.filter((line) => /^[\w.@/\\-]+(?:[\\/][\w.@ /-]+)*$/.test(line.trim())).length;
  const withExt = lines.filter((line) => /\.[A-Za-z0-9]{1,8}$/.test(line.trim())).length;
  if (LIST_TOOL_HINT.test((toolName ?? "").trim()) && pathish >= lines.length * 0.5) return true;
  return withExt >= 5 && pathish >= lines.length * 0.5;
}
function isZipList(text, toolName) {
  if (/^Archive:\s|\bunzip\b|^\s*Length\s+Date\s+Time\s+Name/im.test(text)) return true;
  if (ZIP_TOOL_HINT.test(toolName ?? "") && /\b(?:file|entries|deflated|stored)\b/i.test(text)) return true;
  return /^\s*\d+\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/m.test(text);
}
function looksLikeXml(text) {
  if (!/^<[A-Za-z_!?]/.test(text.trim())) return false;
  const tags = text.match(/<\/?[A-Za-z_][\w:.-]*[\s/>]/g);
  if (!tags || tags.length < 2) return false;
  if (/^<!doctype\s+html/i.test(text.trim())) return false;
  return true;
}
function createSummarizer() {
  const detectContentType = (text, toolName) => {
    if (!text || text.includes("\0")) return "unknown";
    const trimmed = text.trim();
    if (!trimmed) return "unknown";
    if (/^[[{]/.test(trimmed)) {
      try {
        JSON.parse(trimmed);
        return "json";
      } catch {
      }
    }
    if (looksLikeXml(trimmed)) return "xml";
    if (isZipList(text, toolName)) return "zip-list";
    if (isTestOutput(text)) return "test-output";
    if (isBuildLog(text, toolName)) return "build-log";
    if (isFileList(text, toolName)) return "file-list";
    if (!CONTENT_TYPES.includes("text")) return "text";
    return "text";
  };
  const summarize = (text, contentType, options) => {
    const safeOptions = {
      headLines: Math.max(1, Math.trunc(Number(options?.headLines) || 40)),
      tailLines: Math.max(0, Math.trunc(Number(options?.tailLines) || 20)),
      level: options?.level === "smart" ? "smart" : "selective"
    };
    switch (contentType) {
      case "json":
        return summarizeJson(text, safeOptions);
      case "xml":
        return summarizeXml(text, safeOptions);
      case "build-log":
        return summarizeBuildLog(text, safeOptions);
      case "test-output":
        return summarizeTestOutput(text, safeOptions);
      case "file-list":
        return summarizeFileList(text, safeOptions);
      case "zip-list":
        return summarizeZipList(text, safeOptions);
      default:
        return headTail(text, safeOptions.headLines, safeOptions.tailLines);
    }
  };
  const compose = (input) => {
    const label = CONTENT_TYPE_LABELS[input.contentType] ?? CONTENT_TYPE_LABELS.text;
    const lines = [];
    if (input.kind === "dedupe") {
      lines.push(`[Token Manager] \u91CD\u590D\u5DE5\u5177\u8F93\u51FA\u5DF2\u590D\u7528\u7F13\u5B58\uFF08${label}\uFF09`);
    } else {
      lines.push(`[Token Manager] \u5DE5\u5177\u8F93\u51FA\u5DF2\u538B\u7F29\uFF08${label}\uFF09`);
    }
    lines.push(`Blob ID: ${input.blobId}`);
    lines.push(`\u539F\u59CB\u5927\u5C0F: ${Math.max(0, Math.trunc(input.originalBytes))} \u5B57\u8282 / ${Math.max(0, Math.trunc(input.originalLines))} \u884C`);
    if (input.note) lines.push(`\u8BF4\u660E: ${input.note}`);
    if (input.body && input.body.trim()) {
      lines.push("\u6458\u8981:");
      lines.push(input.body.trimEnd());
    }
    lines.push("");
    lines.push("\u9700\u8981\u5B8C\u6574\u5185\u5BB9\u65F6\u8C03\u7528 token_manager_read\uFF08\u652F\u6301 blobId/offset/lines\uFF09");
    return lines.join("\n");
  };
  return { detectContentType, summarize, compose };
}

// src/host/shell-summarizer.ts
var SHELL_TOOL_NAMES = /^(?:pwsh|powershell|bash|sh|zsh|shell|cmd|terminal|exec|run_command|process_start)$/i;
function isShellTool(toolName) {
  return SHELL_TOOL_NAMES.test(toolName);
}
var ERROR_LINE = /(\berror\b|\berrors\b|\bfail(?:ed|ure)?\b|\bfatal\b|\bexception\b|traceback|stack trace|\bdenied\b|\bcannot\b|can't\b|not found|no such file|\btimeout\b|\btimed out\b|\binvalid\b|\brefused\b|\bunresolved\b|\bundefined\b|\bpanic\b|\bwarning\b|\bwarn\b|✗|×)/i;
var SUMMARY_LINE = /(\bpassed\b|\bfailed\b|\bskipped\b|\berror(?:s)?\b|\bwarning(?:s)?\b|\btotal\b|\bsummary\b|\bBUILD (?:SUCCESS|FAILED)\b|\bfound \d+|\d+ (?:files?|tests?|errors?|warnings?|issues?|problems?)\b)/i;
function splitLines2(text) {
  return text.replace(/\r\n?/g, "\n").split("\n");
}
function truncate2(value, limit) {
  const clean = String(value ?? "").replace(/\s+$/, "");
  return clean.length <= limit ? clean : `${clean.slice(0, Math.max(1, limit - 1))}\u2026`;
}
function jsonPreview(text, limitChars) {
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 0).slice(0, limitChars);
  } catch {
    return null;
  }
}
function keysOf(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return Object.keys(value);
  return [];
}
function summarizeJson2(text, level) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const out = [];
  if (Array.isArray(parsed)) {
    out.push(`JSON \u6570\u7EC4\uFF1A\u5171 ${parsed.length} \u9879`);
    const sample = parsed.slice(0, level === "smart" ? 2 : 1);
    for (const item of sample) {
      const serialized = JSON.stringify(item);
      out.push(`- \u6837\u4F8B\uFF1A${truncate2(serialized, 400)}`);
      const keys = keysOf(item);
      if (keys.length > 0) out.push(`  \u5B57\u6BB5\uFF1A${keys.slice(0, 30).join(", ")}`);
    }
    if (parsed.length > sample.length) out.push(`\u2026 \u7701\u7565\u5176\u4F59 ${parsed.length - sample.length} \u9879`);
  } else if (parsed && typeof parsed === "object") {
    const record = parsed;
    const keys = Object.keys(record);
    out.push(`JSON \u5BF9\u8C61\uFF1A${keys.length} \u4E2A\u9876\u5C42\u952E`);
    out.push(`\u9876\u5C42\u952E\uFF1A${keys.slice(0, 40).join(", ")}${keys.length > 40 ? ` \u2026(+${keys.length - 40})` : ""}`);
    for (const key of keys.slice(0, level === "smart" ? 8 : 5)) {
      const value = record[key];
      if (Array.isArray(value)) {
        out.push(`- ${key}: \u6570\u7EC4\uFF0C\u5171 ${value.length} \u9879${value.length > 0 ? `\uFF1B\u6837\u4F8B ${truncate2(JSON.stringify(value[0]), 240)}` : ""}`);
      } else if (value && typeof value === "object") {
        out.push(`- ${key}: \u5BF9\u8C61\uFF0C\u952E ${Object.keys(value).slice(0, 10).join(", ")}`);
      } else {
        out.push(`- ${key}: ${truncate2(String(value), 160)}`);
      }
    }
  } else {
    out.push(`JSON \u6807\u91CF\uFF1A${truncate2(String(parsed), 200)}`);
  }
  return out.join("\n");
}
function summarizeFileList2(lines, level) {
  const entries = lines.filter((line) => line.trim() !== "" && !/^(Mode|Directory|Path|LastWriteTime|Total|----)/i.test(line.trim()));
  if (entries.length < 5) return null;
  const cap = level === "smart" ? 40 : 24;
  const head = entries.slice(0, cap);
  const tail = entries.length > cap ? entries.slice(-8) : [];
  const out = [`\u6587\u4EF6\u5217\u8868\uFF1A\u7EA6 ${entries.length} \u9879`];
  out.push(...head.map((line) => `  ${truncate2(line, 200)}`));
  if (tail.length > 0) out.push(`  \u2026 \u7701\u7565 ${entries.length - cap - tail.length} \u9879 \u2026`, ...tail.map((line) => `  ${truncate2(line, 200)}`));
  return out.join("\n");
}
function summarizeMarkdown(lines, level) {
  const headings = lines.filter((line) => /^#{1,6}\s+\S/.test(line.trim()));
  if (headings.length < 2) return null;
  const cap = level === "smart" ? 60 : 30;
  const firstPara = lines.find((line) => line.trim() !== "" && !line.trim().startsWith("#") && !line.trim().startsWith("-") && !line.trim().startsWith("|"));
  const out = [`Markdown \u6587\u6863\uFF1A${lines.length} \u884C\uFF0C${headings.length} \u4E2A\u6807\u9898`];
  if (firstPara) out.push(`\u9996\u6BB5\uFF1A${truncate2(firstPara.trim(), 240)}`);
  out.push("\u6807\u9898\u7ED3\u6784\uFF1A", ...headings.slice(0, cap).map((line) => `  ${truncate2(line.trim(), 180)}`));
  if (headings.length > cap) out.push(`  \u2026 \u7701\u7565\u5176\u4F59 ${headings.length - cap} \u4E2A\u6807\u9898`);
  return out.join("\n");
}
function summarizeDiff(lines, level) {
  const files = [];
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      const match = line.match(/b\/(.+)$/);
      if (match) files.push(match[1]);
    } else if (line.startsWith("+") && !line.startsWith("+++")) added += 1;
    else if (line.startsWith("-") && !line.startsWith("---")) removed += 1;
  }
  if (files.length === 0) return null;
  const cap = level === "smart" ? 40 : 20;
  return [
    `Diff\uFF1A${files.length} \u4E2A\u6587\u4EF6\uFF0C+${added} / -${removed} \u884C`,
    "\u53D8\u66F4\u6587\u4EF6\uFF1A",
    ...files.slice(0, cap).map((file) => `  ${truncate2(file, 200)}`),
    files.length > cap ? `  \u2026 \u7701\u7565\u5176\u4F59 ${files.length - cap} \u4E2A\u6587\u4EF6` : ""
  ].filter(Boolean).join("\n");
}
function summarizeLog(lines, level) {
  const cap = level === "smart" ? 80 : 40;
  const headCount = level === "smart" ? 20 : 14;
  const tailCount = level === "smart" ? 20 : 14;
  const numbered = lines.map((line, index) => ({ line, number: index + 1 }));
  const critical = numbered.filter((item) => ERROR_LINE.test(item.line));
  const summary = numbered.filter((item) => SUMMARY_LINE.test(item.line) && !ERROR_LINE.test(item.line));
  const out = [];
  if (critical.length > 0) {
    out.push(`\u9519\u8BEF/\u8B66\u544A\u884C\uFF08\u5171 ${critical.length} \u6761\uFF0C\u4FDD\u7559 ${Math.min(critical.length, cap)} \u6761\uFF09\uFF1A`);
    for (const item of critical.slice(0, cap)) out.push(`  L${item.number}: ${truncate2(item.line, 220)}`);
    if (critical.length > cap) out.push(`  \u2026 \u5176\u4F59 ${critical.length - cap} \u6761\u9519\u8BEF/\u8B66\u544A\u89C1\u539F\u6587 \u2026`);
  } else {
    out.push("\u672A\u5339\u914D\u5230 error/warning \u884C\u3002");
  }
  if (summary.length > 0) {
    out.push(`\u6C47\u603B/\u7ED3\u679C\u884C\uFF08${summary.length} \u6761\uFF0C\u4FDD\u7559 ${Math.min(summary.length, 20)} \u6761\uFF09\uFF1A`);
    for (const item of summary.slice(0, 20)) out.push(`  L${item.number}: ${truncate2(item.line, 200)}`);
  }
  out.push(`\u5F00\u5934 ${headCount} \u884C\uFF1A`);
  for (const item of numbered.slice(0, headCount)) out.push(`  L${item.number}: ${truncate2(item.line, 200)}`);
  if (numbered.length > headCount + tailCount) {
    out.push(`\u2026 \u4E2D\u95F4\u7701\u7565 ${numbered.length - headCount - tailCount} \u884C \u2026`);
    out.push(`\u7ED3\u5C3E ${tailCount} \u884C\uFF1A`);
    for (const item of numbered.slice(-tailCount)) out.push(`  L${item.number}: ${truncate2(item.line, 200)}`);
  }
  return out.join("\n");
}
function detectShellKind(text, command) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    if (jsonPreview(trimmed, 1) !== null) return "json";
    const lines2 = splitLines2(trimmed).slice(0, 20).filter((line) => line.trim().startsWith("{"));
    if (lines2.length >= 5) return "jsonl";
  }
  if (/^diff --git /m.test(text)) return "git-diff";
  if (/^commit [0-9a-f]{7,40}$/m.test(text) && /^Author:/m.test(text)) return "git-log";
  if (/(^|\n)(\s*)(BUILD SUCCESS|BUILD FAILED|FAILURE:|SUCCESS:|Tests?:|Test Suites?:|Ran \d+ tests?)/i.test(text)) {
    return /test|spec|vitest|jest|pytest|mocha|playwright/i.test(text) ? "test-output" : "build-log";
  }
  if (/(\bPASSED\b|\bFAILED\b|\d+ passing\b|\d+ failing\b|✓ |✗ |× )/.test(text)) return "test-output";
  if (/(^|\n)\s*#{1,6}\s+\S/m.test(text) && /(^|\n)\s*#{1,6}\s+\S/g.test(text)) {
    const headings = text.match(/^#{1,6}\s+\S/gm);
    if ((headings?.length ?? 0) >= 2) return "markdown";
  }
  const lines = splitLines2(text).filter((line) => line.trim() !== "");
  const windowsListing = lines.filter((line) => /^\s*(?:-{2,}|d|-a-|drwx|[\d,]+\s+\S+\s+\S+\s+\S+\s+\S+\s+)/.test(line)).length;
  const dirListing = lines.filter((line) => /(?:^|\s)(?:<DIR>|\d{4}\/\d{2}\/\d{2}|\d{2}\/\d{2}\/\d{4})\s/i.test(line)).length;
  if (lines.length >= 8 && (windowsListing + dirListing) / lines.length > 0.5) return "file-list";
  if (command && /(?:^|\s)(?:Get-ChildItem|\bls\b|\bdir\b|\btree\b|\bfind\b)/i.test(command) && lines.length >= 8) return "file-list";
  if (/^[+-]{3} /m.test(text) && /^@@ /m.test(text)) return "diff";
  return "text";
}
function summarizeShellOutput(text, options = {}) {
  const level = options.level ?? "smart";
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes < 1024) return null;
  const kind = detectShellKind(text, options.command);
  const lines = splitLines2(text);
  let rendered = summarizeByKind(kind, text, lines, level);
  if (rendered === null) return null;
  if (kind !== "log" && kind !== "build-log" && kind !== "test-output" && kind !== "text") {
    const criticalLines = lines.map((line, index) => ({ line, number: index + 1 })).filter((item) => ERROR_LINE.test(item.line));
    if (criticalLines.length > 0) {
      const cap = level === "smart" ? 80 : 40;
      const section = [
        `\u9519\u8BEF/\u8B66\u544A\u884C\uFF08\u5171 ${criticalLines.length} \u6761\uFF0C\u4FDD\u7559 ${Math.min(criticalLines.length, cap)} \u6761\uFF09\uFF1A`,
        ...criticalLines.slice(0, cap).map((item) => `  L${item.number}: ${truncate2(item.line, 260)}`),
        criticalLines.length > cap ? `  \u2026 \u5176\u4F59 ${criticalLines.length - cap} \u6761\u89C1\u539F\u6587 \u2026` : ""
      ].filter(Boolean);
      rendered = section.join("\n") + "\n" + rendered;
    }
  }
  const summaryBytes = Buffer.byteLength(rendered, "utf8");
  if (summaryBytes >= Math.max(512, Math.floor(bytes * 0.7))) return null;
  const header = [
    `[shell output \xB7 ${kind}]`,
    options.command ? `\u547D\u4EE4\uFF1A${truncate2(options.command, 200)}` : null,
    `\u539F\u59CB\uFF1A${lines.length} \u884C / ${bytes} \u5B57\u8282\uFF1B\u5B8C\u6574\u539F\u6587\u53EF\u7528 token_manager_read \u6062\u590D\uFF08\u89C1\u4E0B\u65B9 Blob ID\uFF09`,
    "\u672C\u6458\u8981\u4FDD\u7559\uFF1A\u9519\u8BEF/\u8B66\u544A\u884C\u3001\u6587\u4EF6\u8DEF\u5F84\u3001\u6807\u9898\u3001JSON \u952E\u3001\u53D8\u66F4\u6587\u4EF6\u4E0E\u6C47\u603B\u884C\uFF1B\u6B63\u6587\u6309\u533A\u6BB5\u7701\u7565\u3002"
  ].filter((line) => line !== null).join("\n");
  return `${header}
${rendered}`;
}
function summarizeByKind(kind, text, lines, level) {
  switch (kind) {
    case "json":
      return summarizeJson2(text, level);
    case "jsonl": {
      const records = lines.filter((line) => line.trim().startsWith("{"));
      const out = [`JSONL\uFF1A${records.length} \u6761\u8BB0\u5F55`];
      out.push(...records.slice(0, level === "smart" ? 5 : 3).map((line) => `  ${truncate2(line, 300)}`));
      if (records.length > 5) out.push(`  \u2026 \u7701\u7565\u5176\u4F59 ${records.length - 5} \u6761 \u2026`);
      const errors = records.filter((line) => ERROR_LINE.test(line));
      if (errors.length > 0) {
        out.push(`\u542B\u9519\u8BEF\u5B57\u6BB5\u7684\u8BB0\u5F55\uFF08${errors.length} \u6761\uFF0C\u4FDD\u7559\u524D 5 \u6761\uFF09\uFF1A`);
        out.push(...errors.slice(0, 5).map((line) => `  ${truncate2(line, 300)}`));
      }
      return out.join("\n");
    }
    case "markdown":
      return summarizeMarkdown(lines, level);
    case "git-diff":
      return summarizeDiff(lines, level);
    case "git-log": {
      const commits = lines.filter((line) => /^commit [0-9a-f]{7,40}$/.test(line));
      const subjects = lines.filter((line) => /^ {4}\S/.test(line));
      const out = [`git log\uFF1A${commits.length} \u4E2A\u63D0\u4EA4`];
      for (let i = 0; i < Math.min(commits.length, level === "smart" ? 20 : 10); i += 1) {
        out.push(`  ${commits[i]}${subjects[i] ? ` ${truncate2(subjects[i].trim(), 160)}` : ""}`);
      }
      if (commits.length > 20) out.push(`  \u2026 \u7701\u7565\u5176\u4F59 ${commits.length - 20} \u4E2A\u63D0\u4EA4 \u2026`);
      return out.join("\n");
    }
    case "build-log":
    case "test-output":
    case "diff":
    case "log":
    case "file-list":
      if (kind === "file-list") return summarizeFileList2(lines, level);
      return summarizeLog(lines, level);
    case "text":
    default:
      return summarizeLog(lines, level);
  }
}

// src/host/tool-cache.ts
function asRecord2(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function num3(value, fallback) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function positiveInt(value, fallback, min = 0) {
  const parsed = Math.trunc(num3(value, fallback));
  return parsed >= min ? parsed : min;
}
function isTextBlock(block) {
  const record = block;
  return Boolean(record) && record.type === "text" && typeof record.text === "string";
}
function canonicalJson(value) {
  if (value === void 0) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  const record = value;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}
function sha256Hex2(text) {
  return createHash3("sha256").update(text, "utf8").digest("hex");
}
function resolveCompressionSettings(settings) {
  let raw = {};
  try {
    raw = asRecord2(asRecord2(settings.get()).compression);
  } catch {
    raw = {};
  }
  const mode = CACHE_MODES.includes(String(raw.mode)) ? raw.mode : CACHE_DEFAULTS.mode;
  const types = { ...CACHE_DEFAULTS.types, ...asRecord2(raw.types) };
  return {
    mode,
    minBytes: positiveInt(raw.minBytes, CACHE_DEFAULTS.minBytes, 64),
    selectiveBytes: positiveInt(raw.selectiveBytes, CACHE_DEFAULTS.selectiveBytes, 64),
    smartBytes: positiveInt(raw.smartBytes, CACHE_DEFAULTS.smartBytes, 64),
    maxBlobBytes: positiveInt(raw.maxBlobBytes, CACHE_DEFAULTS.maxBlobBytes, 1024),
    maxCacheMB: positiveInt(raw.maxCacheMB, CACHE_DEFAULTS.maxCacheMB, 1),
    ttlDays: positiveInt(raw.ttlDays, CACHE_DEFAULTS.ttlDays, 0),
    headLines: positiveInt(raw.headLines, CACHE_DEFAULTS.headLines, 1),
    tailLines: positiveInt(raw.tailLines, CACHE_DEFAULTS.tailLines, 0),
    types
  };
}
function sessionIdOf(exec) {
  const candidates = [exec?.agent?.session?.id, exec?.agent?.sessionId, exec?.session?.id, exec?.agent?.id];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }
  return "unknown";
}
function skipReason(exec, result) {
  if (exec?.parent !== void 0 && exec?.parent !== null) return "parent";
  if (result?.isError === true) return "error";
  const name2 = typeof exec?.name === "string" ? exec.name : "";
  if (!name2) return "no-name";
  if (CACHE_SKIP_TOOLS.includes(name2) || /^mnemon_/i.test(name2)) return "skip-tool";
  if (name2 === "read" || name2 === "read_multiple_files" || name2 === "read_file") return "read-accuracy";
  const content = result?.content;
  if (!Array.isArray(content) || content.length === 0) return "no-content";
  for (const block of content) {
    if (!isTextBlock(block)) return `non-text:${String(block?.type ?? "unknown")}`;
  }
  return null;
}
function joinText(blocks) {
  if (!Array.isArray(blocks)) return "";
  const parts = [];
  for (const block of blocks) if (isTextBlock(block)) parts.push(block.text);
  return parts.join("\n");
}
function countLines(text) {
  return text.length === 0 ? 0 : text.replace(/\r\n?/g, "\n").split("\n").length;
}
function buildReplacement(decision, text) {
  if (!decision || typeof decision !== "object") return null;
  if (decision.kind !== "accept") return null;
  if (Object.prototype.hasOwnProperty.call(decision, "value")) return null;
  const additionalContexts = Array.isArray(decision.additionalContexts) && decision.additionalContexts.length > 0 ? { additionalContexts: decision.additionalContexts } : {};
  return { kind: "accept", content: [{ type: "text", text }], ...additionalContexts };
}
function createToolCache(deps) {
  const summarizer = createSummarizer();
  let lastMode = CACHE_DEFAULTS.mode;
  const recordError = (where, error) => {
    try {
      const message = String(error?.message ?? error).slice(0, 500);
      deps.store.metaSet("cache_last_error", JSON.stringify({ ts: Date.now(), where, message }));
    } catch {
    }
  };
  const readCompression = () => {
    const config = resolveCompressionSettings(deps.settings);
    lastMode = config.mode;
    return config;
  };
  const persist = (row) => {
    try {
      if (typeof deps.record === "function") deps.record(row);
      else deps.repo.recordToolResult(row);
    } catch (error) {
      recordError("record", error);
    }
  };
  const processResult = (exec, result, decision) => {
    const config = readCompression();
    if (config.mode === "off") return null;
    if (decision && decision.kind === "block") return null;
    if (skipReason(exec, result) !== null) return null;
    const content = decision?.content !== void 0 ? decision.content : result?.content;
    const text = joinText(content);
    const bytes = Buffer.byteLength(text, "utf8");
    if (bytes < config.minBytes || bytes > config.maxBlobBytes) return null;
    const toolName = String(exec.name);
    const contentType = summarizer.detectContentType(text, toolName);
    if (contentType === "unknown") return null;
    if (config.types[contentType] === false) return null;
    const mode = config.mode;
    const sessionId = sessionIdOf(exec);
    const argsHash = sha256Hex2(canonicalJson(exec?.arguments ?? null));
    const resultHash = sha256Hex2(text);
    const lines = countLines(text);
    let reusable = null;
    try {
      reusable = deps.repo.findReusable({ sessionId, toolName, argumentsHash: argsHash, resultHash });
    } catch (error) {
      recordError("findReusable", error);
      reusable = null;
    }
    if (reusable && reusable.blobId) {
      let stat = null;
      try {
        stat = deps.blobStore.stat(reusable.blobId);
      } catch (error) {
        recordError("stat", error);
        stat = null;
      }
      if (stat) {
        const reference = summarizer.compose({
          blobId: reusable.blobId,
          contentType: typeof stat.contentType === "string" ? stat.contentType : contentType,
          originalBytes: bytes,
          originalLines: lines,
          kind: "dedupe",
          note: "\u8BE5\u5DE5\u5177\u7ED3\u679C\u4E0E\u4E4B\u524D\u4E00\u6B21\u8C03\u7528\u5B8C\u5168\u76F8\u540C\uFF0C\u5DF2\u590D\u7528\u7F13\u5B58\u539F\u6587\uFF0C\u672A\u91CD\u590D\u5B58\u50A8\u3002"
        });
        const compressedSize2 = Buffer.byteLength(reference, "utf8");
        try {
          deps.repo.markAccessed(reusable.blobId);
        } catch (error) {
          recordError("markAccessed", error);
        }
        persist({
          sessionId,
          taskId: null,
          turn: null,
          step: null,
          toolName,
          argumentsHash: argsHash,
          resultHash,
          blobId: reusable.blobId,
          originalSize: bytes,
          compressedSize: compressedSize2,
          compressionType: mode === "on" ? "dedupe" : "would-dedupe",
          mode,
          createdAt: Date.now(),
          dedupeOf: reusable.id ?? null
        });
        if (mode !== "on") return null;
        return buildReplacement(decision, reference);
      }
    }
    let blobId = null;
    try {
      const put = deps.blobStore.put(text, contentType);
      blobId = put?.record?.id ?? null;
    } catch (error) {
      recordError("blob.put", error);
      blobId = null;
    }
    if (!blobId) return null;
    const level = bytes >= config.smartBytes ? "smart" : bytes >= config.selectiveBytes ? "selective" : "none";
    if (level === "none") {
      persist({
        sessionId,
        taskId: null,
        turn: null,
        step: null,
        toolName,
        argumentsHash: argsHash,
        resultHash,
        blobId,
        originalSize: bytes,
        compressedSize: null,
        compressionType: mode === "on" ? "stored" : "would-store",
        mode,
        createdAt: Date.now(),
        dedupeOf: null
      });
      return null;
    }
    let summary = "";
    try {
      const command = typeof exec?.arguments?.command === "string" ? exec.arguments.command : void 0;
      let body = null;
      if (isShellTool(toolName)) {
        body = summarizeShellOutput(text, { command, level });
      }
      if (!body) body = summarizer.summarize(text, contentType, { headLines: config.headLines, tailLines: config.tailLines, level });
      summary = summarizer.compose({ blobId, contentType, originalBytes: bytes, originalLines: lines, kind: "summary", body });
    } catch (error) {
      recordError("summarize", error);
      return null;
    }
    const compressedSize = Buffer.byteLength(summary, "utf8");
    persist({
      sessionId,
      taskId: null,
      turn: null,
      step: null,
      toolName,
      argumentsHash: argsHash,
      resultHash,
      blobId,
      originalSize: bytes,
      compressedSize,
      compressionType: mode === "on" ? level : `would-${level}`,
      mode,
      createdAt: Date.now(),
      dedupeOf: null
    });
    if (mode !== "on") return null;
    return buildReplacement(decision, summary);
  };
  const handlePostExecute = async (exec, result, next) => {
    let decision;
    try {
      decision = await next();
    } catch (error) {
      recordError("post-execute.next", error);
      throw error;
    }
    let chosen = decision;
    try {
      chosen = processResult(exec, result, decision) ?? decision;
    } catch (error) {
      recordError("post-execute", error);
      chosen = decision;
    }
    if (deps.contextReuse) {
      try {
        const reuse = deps.contextReuse.apply(exec, result, chosen);
        if (reuse !== null && reuse !== void 0) return reuse;
      } catch (error) {
        recordError("post-execute.contextReuse", error);
      }
    }
    return chosen;
  };
  const shouldHandle = (exec, result) => {
    try {
      const config = readCompression();
      if (config.mode === "off") return false;
      if (skipReason(exec, result) !== null) return false;
      const text = joinText(result?.content);
      const bytes = Buffer.byteLength(text, "utf8");
      return bytes >= config.minBytes && bytes <= config.maxBlobBytes;
    } catch {
      return false;
    }
  };
  const stats = () => {
    const output = { mode: lastMode };
    try {
      Object.assign(output, deps.repo.stats());
    } catch (error) {
      recordError("repo.stats", error);
    }
    try {
      output.usageBytes = deps.blobStore.usageBytes();
    } catch (error) {
      recordError("blob.usageBytes", error);
      output.usageBytes = 0;
    }
    try {
      output.compression = readCompression();
    } catch {
    }
    return output;
  };
  return { handlePostExecute, shouldHandle, stats, readCompression };
}

// src/host/cache-api.ts
var DEFAULT_READ_LIMIT = 32 * 1024;
var MAX_READ_LIMIT = 256 * 1024;
function asRecord3(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function num4(value, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function clamp3(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function optionalString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : void 0;
}
function optionalBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return void 0;
}
function mapRow(row) {
  const compressed = typeof row.compressedSize === "number" ? row.compressedSize : null;
  const original = num4(row.originalSize);
  return {
    id: row.id ?? null,
    sessionId: row.sessionId,
    taskId: row.taskId ?? null,
    turn: row.turn ?? null,
    step: row.step ?? null,
    toolName: row.toolName,
    argumentsHash: row.argumentsHash ?? null,
    resultHash: row.resultHash ?? null,
    blobId: row.blobId ?? null,
    originalSize: original,
    compressedSize: compressed,
    compressionType: row.compressionType ?? null,
    mode: row.mode,
    createdAt: row.createdAt,
    dedupeOf: row.dedupeOf ?? null,
    recoverable: row.recoverable === true,
    contentType: row.contentType ?? null,
    hash: row.hash ?? null,
    savedBytes: compressed === null ? null : Math.max(0, original - compressed)
  };
}
function sliceUtf8(buffer, offset, limit) {
  const total = buffer.length;
  let start = clamp3(Math.trunc(offset), 0, total);
  while (start < total && (buffer[start] & 192) === 128) start += 1;
  let end = clamp3(start + Math.max(1, Math.trunc(limit)), start, total);
  while (end > start && end < total && (buffer[end] & 192) === 128) end -= 1;
  return { content: buffer.subarray(start, end).toString("utf8"), start, end };
}
function createCacheApi(deps) {
  const list = (query) => {
    const q = asRecord3(query);
    const limit = clamp3(Math.trunc(num4(q.limit, 50)) || 50, 1, 200);
    const offset = Math.max(0, Math.trunc(num4(q.offset, 0)) || 0);
    const sessionId = optionalString(q.sessionId);
    const toolName = optionalString(q.tool) ?? optionalString(q.toolName);
    const recoverable = optionalBoolean(q.recoverable);
    if (recoverable !== void 0) {
      const page2 = deps.repo.listToolResults({ sessionId, toolName, limit: 500, offset: 0 });
      const filtered = page2.rows.filter((row) => row.recoverable === true === recoverable);
      return {
        total: filtered.length,
        rows: filtered.slice(offset, offset + limit).map((row) => mapRow(row)),
        limit,
        offset,
        filter: { recoverable }
      };
    }
    const page = deps.repo.listToolResults({ sessionId, toolName, limit, offset });
    return { total: page.total, rows: page.rows.map((row) => mapRow(row)), limit, offset };
  };
  const stats = () => {
    let base = { blobs: 0, totalOriginalBytes: 0, totalCompressedBytes: 0, savedBytes: 0, dedupeCount: 0, missingBlobs: 0 };
    try {
      base = { ...deps.repo.stats() };
    } catch (error) {
      base.error = String(error?.message ?? error);
    }
    let usageBytes = 0;
    try {
      usageBytes = deps.blobStore.usageBytes();
    } catch {
      usageBytes = 0;
    }
    let compression = null;
    try {
      compression = resolveCompressionSettings(deps.settings);
    } catch {
      compression = null;
    }
    const totalOriginalBytes = num4(base.totalOriginalBytes);
    const savedBytes = num4(base.savedBytes);
    return {
      ...base,
      usageBytes,
      savedPct: totalOriginalBytes > 0 ? savedBytes / totalOriginalBytes : 0,
      mode: compression?.mode ?? "observe",
      compression
    };
  };
  const readPreview = (blobId, sessionId, options) => {
    const id = optionalString(blobId);
    if (!id) return { blobId: "", recoverable: false, reason: "missing_blob_id", content: "", offset: 0, totalBytes: 0, nextOffset: null };
    let record = null;
    try {
      record = deps.repo.blobForSession(id, sessionId ?? null);
    } catch {
      record = null;
    }
    if (!record) {
      return { blobId: id, sessionId: sessionId ?? null, recoverable: false, reason: "not_found", content: "", offset: 0, totalBytes: 0, nextOffset: null };
    }
    const realBlobId = record.blobId ?? id;
    let stat = null;
    try {
      stat = deps.blobStore.stat(realBlobId);
    } catch {
      stat = null;
    }
    if (!stat) {
      return {
        blobId: realBlobId,
        sessionId: record.sessionId,
        recoverable: false,
        reason: "missing_file",
        contentType: null,
        hash: null,
        originalSize: num4(record.originalSize),
        content: "",
        offset: 0,
        totalBytes: 0,
        nextOffset: null
      };
    }
    let text;
    try {
      text = deps.blobStore.getText(realBlobId);
    } catch {
      return {
        blobId: realBlobId,
        sessionId: record.sessionId,
        recoverable: false,
        reason: "hash_mismatch",
        contentType: stat.contentType ?? null,
        hash: stat.hash ?? null,
        originalSize: num4(record.originalSize),
        content: "",
        offset: 0,
        totalBytes: 0,
        nextOffset: null
      };
    }
    const buffer = Buffer.from(text, "utf8");
    const totalBytes = buffer.length;
    const offset = clamp3(Math.trunc(num4(options?.offset, 0)) || 0, 0, totalBytes);
    const limit = clamp3(Math.trunc(num4(options?.limit, DEFAULT_READ_LIMIT)) || DEFAULT_READ_LIMIT, 1, MAX_READ_LIMIT);
    const slice = sliceUtf8(buffer, offset, limit);
    return {
      blobId: realBlobId,
      sessionId: record.sessionId,
      recoverable: true,
      contentType: stat.contentType ?? null,
      hash: stat.hash ?? null,
      compressionType: record.compressionType ?? null,
      mode: record.mode,
      originalSize: num4(record.originalSize),
      content: slice.content,
      offset: slice.start,
      limit: slice.end - slice.start,
      totalBytes,
      totalLines: text.length === 0 ? 0 : text.replace(/\r\n?/g, "\n").split("\n").length,
      nextOffset: slice.end < totalBytes ? slice.end : null
    };
  };
  const verify = () => {
    try {
      const result = deps.blobStore.verify({ repair: false });
      return {
        missingFiles: num4(result?.missingFiles),
        orphanFiles: num4(result?.orphanFiles),
        hashMismatch: num4(result?.hashMismatch),
        repaired: num4(result?.repaired),
        details: Array.isArray(result?.details) ? result.details.slice(0, 50) : []
      };
    } catch (error) {
      return { missingFiles: 0, orphanFiles: 0, hashMismatch: 0, repaired: 0, details: [], error: String(error?.message ?? error) };
    }
  };
  const clear = () => {
    try {
      const result = deps.repo.clear();
      return { removed: num4(result?.removed), freedBytes: num4(result?.freedBytes) };
    } catch (error) {
      return { removed: 0, freedBytes: 0, error: String(error?.message ?? error) };
    }
  };
  const settingsPatch = () => {
    try {
      return { compression: resolveCompressionSettings(deps.settings) };
    } catch {
      return { compression: resolveCompressionSettings({ get: () => ({}) }) };
    }
  };
  return { list, stats, readPreview, verify, clear, settingsPatch };
}

// src/host/kv-risk.ts
var KNOWN_MODES = /* @__PURE__ */ new Set(["off", "dry-run"]);
function asRecord4(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function num5(value, fallback) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function safeInt2(value, fallback, min = 0) {
  const parsed = Math.trunc(num5(value, fallback));
  return parsed >= min ? parsed : min;
}
function round63(value) {
  return Math.round(value * 1e6) / 1e6;
}
function resolveContextSettings(settings) {
  let raw = {};
  try {
    raw = asRecord4(asRecord4(settings.get()).context);
  } catch {
    raw = {};
  }
  const mode = typeof raw.mode === "string" && KNOWN_MODES.has(raw.mode) ? raw.mode : CONTEXT_DEFAULTS.mode;
  const riskFactor = num5(raw.riskFactor, CONTEXT_DEFAULTS.riskFactor);
  return {
    mode,
    minOccurrences: safeInt2(raw.minOccurrences, CONTEXT_DEFAULTS.minOccurrences, 2),
    minSurfaceNodes: safeInt2(raw.minSurfaceNodes, CONTEXT_DEFAULTS.minSurfaceNodes, 0),
    maxCandidates: safeInt2(raw.maxCandidates, CONTEXT_DEFAULTS.maxCandidates, 1),
    riskFactor: riskFactor > 0 ? riskFactor : CONTEXT_DEFAULTS.riskFactor,
    assumedCacheReadRatio: num5(raw.assumedCacheReadRatio, CONTEXT_DEFAULTS.assumedCacheReadRatio) >= 0 ? num5(raw.assumedCacheReadRatio, CONTEXT_DEFAULTS.assumedCacheReadRatio) : CONTEXT_DEFAULTS.assumedCacheReadRatio
  };
}
function formatCost(value) {
  return value === null ? "\u672A\u914D\u7F6E" : String(round63(value));
}
function createKvRiskEstimator(deps) {
  const estimate = (input) => {
    const invalidatedTokens = safeInt2(input?.invalidatedTokens, 0, 0);
    const removableTokens = safeInt2(input?.removableTokens, 0, 0);
    const changePointSeq = typeof input?.changePointSeq === "number" && Number.isFinite(input.changePointSeq) ? Math.trunc(input.changePointSeq) : null;
    const settings = resolveContextSettings(deps.settings);
    const factor = settings.riskFactor;
    if (invalidatedTokens === 0 && removableTokens === 0) {
      return {
        changePointSeq,
        invalidatedTokens,
        extraCost: null,
        savingCost: null,
        risky: false,
        verdict: "unknown",
        reason: "\u6CA1\u6709\u53EF\u79FB\u9664\u7684\u91CD\u590D\u5185\u5BB9\uFF0C\u65E0\u9700\u91CD\u7B97\u7F13\u5B58"
      };
    }
    let price = null;
    try {
      price = deps.costs.priceFor(input?.provider ?? null, input?.model ?? null);
    } catch {
      price = null;
    }
    if (price) {
      const unit = price.unitTokens > 0 ? price.unitTokens : 1e6;
      if (price.inputPrice <= 0 && price.cacheReadPrice <= 0) {
        return {
          changePointSeq,
          invalidatedTokens,
          extraCost: null,
          savingCost: null,
          risky: false,
          verdict: "unknown",
          reason: "\u4EF7\u683C\u5DF2\u914D\u7F6E\u4E3A 0\uFF0C\u65E0\u6CD5\u4F30\u7B97\u7F13\u5B58\u98CE\u9669"
        };
      }
      const extraCost = round63(invalidatedTokens * (price.inputPrice - price.cacheReadPrice) / unit);
      const savingCost = round63(removableTokens * price.inputPrice / unit);
      const risky2 = extraCost > savingCost * factor;
      return {
        changePointSeq,
        invalidatedTokens,
        extraCost,
        savingCost,
        risky: risky2,
        verdict: risky2 ? "risky" : "safe",
        reason: `\u6709\u4EF7\u683C\uFF1A\u6539\u5199\u5728 seq ${changePointSeq ?? "?"} \u5904\u91CD\u7B97\u7F13\u5B58\u7EA6 ${formatCost(extraCost)}\uFF0C\u79FB\u9664\u91CD\u590D\u5185\u5BB9\u7EA6\u8282\u7701 ${formatCost(savingCost)}\uFF0C\u9608\u503C ${factor}\xD7\uFF08${risky2 ? "\u98CE\u9669\u8F83\u9AD8\uFF0C\u4E0D\u5EFA\u8BAE" : "\u98CE\u9669\u53EF\u63A5\u53D7"}\uFF09`
      };
    }
    const risky = invalidatedTokens > removableTokens * factor;
    return {
      changePointSeq,
      invalidatedTokens,
      extraCost: null,
      savingCost: null,
      risky,
      verdict: risky ? "risky" : "safe",
      reason: `\u4EF7\u683C\u672A\u914D\u7F6E\uFF0C\u4F7F\u7528 Token \u4EE3\u7406\uFF1A\u5931\u6548 ${invalidatedTokens} tokens vs \u53EF\u79FB\u9664 ${removableTokens}\xD7${factor}\uFF08${risky ? "\u4E0D\u5EFA\u8BAE" : "\u5EFA\u8BAE"}\uFF09`
    };
  };
  return { estimate };
}

// src/host/context-api.ts
var MAX_PAGE2 = 200;
function emptyAnalysis(sessionId, mode) {
  return {
    sessionId,
    found: false,
    surface: { nodes: 0, tokens: 0, byRole: {}, bySource: {} },
    candidates: [],
    totals: { candidateCount: 0, potentialSavingsTokens: 0, riskyCount: 0 },
    mode,
    analyzedAt: Date.now(),
    readOnly: true
  };
}
function clamp4(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function createContextApi(deps) {
  const contextSettings = () => {
    try {
      return resolveContextSettings(deps.settings);
    } catch {
      return resolveContextSettings({ get: () => ({}) });
    }
  };
  const recentLiveSessionIds = (limit = 10) => {
    const ids = [];
    try {
      const rows = deps.store.all(
        `SELECT s.session_id AS session_id
           FROM sessions s
          WHERE EXISTS (SELECT 1 FROM usage_records u WHERE u.session_id = s.session_id AND u.turn >= 0 AND u.source = 'live')
          ORDER BY s.last_seen_at DESC, s.created_at DESC
          LIMIT ?`,
        limit
      );
      for (const row of rows) if (row?.session_id) ids.push(String(row.session_id));
    } catch {
    }
    if (ids.length === 0) {
      try {
        const rows = deps.store.all(
          "SELECT session_id FROM usage_records WHERE turn >= 0 AND source = 'live' GROUP BY session_id ORDER BY MAX(ts) DESC LIMIT ?",
          limit
        );
        for (const row of rows) if (row?.session_id && !ids.includes(String(row.session_id))) ids.push(String(row.session_id));
      } catch {
      }
    }
    return ids;
  };
  const resolveTarget = (requested, mode) => {
    const value = typeof requested === "string" ? requested.trim() : "";
    if (value) {
      try {
        return { sessionId: value, analysis: deps.analyzer.analyze(value), explicit: true };
      } catch {
        return { sessionId: value, analysis: emptyAnalysis(value, mode), explicit: true };
      }
    }
    let last = { sessionId: "", analysis: emptyAnalysis("", mode), explicit: false };
    for (const candidate of recentLiveSessionIds(10)) {
      let analysis;
      try {
        analysis = deps.analyzer.analyze(candidate);
      } catch {
        analysis = emptyAnalysis(candidate, mode);
      }
      last = { sessionId: candidate, analysis, explicit: false };
      if (analysis.found) return last;
    }
    return last;
  };
  const analyze = (input) => {
    const mode = contextSettings().mode;
    if (!deps.analyzer) return emptyAnalysis(typeof input?.sessionId === "string" ? input.sessionId.trim() : "", mode);
    return resolveTarget(input?.sessionId, mode).analysis;
  };
  const optimize = (input) => {
    const mode = contextSettings().mode;
    const requested = typeof input?.sessionId === "string" ? input.sessionId.trim() : "";
    if (!deps.analyzer) return { recorded: 0, analysis: emptyAnalysis(requested, mode) };
    if (requested) {
      try {
        const result = deps.analyzer.optimize(requested);
        return { recorded: Number(result?.recorded) || 0, analysis: result?.analysis ?? emptyAnalysis(requested, mode) };
      } catch {
        return { recorded: 0, analysis: emptyAnalysis(requested, mode) };
      }
    }
    const target = resolveTarget(void 0, mode);
    if (!target.sessionId || !target.analysis.found) return { recorded: 0, analysis: target.analysis };
    try {
      const result = deps.analyzer.optimize(target.sessionId);
      return { recorded: Number(result?.recorded) || 0, analysis: result?.analysis ?? target.analysis };
    } catch {
      return { recorded: 0, analysis: target.analysis };
    }
  };
  const listOptimizations = (query) => {
    const limit = clamp4(Math.trunc(Number(query?.limit ?? 50)) || 50, 1, MAX_PAGE2);
    const offset = Math.max(0, Math.trunc(Number(query?.offset ?? 0)) || 0);
    const sessionId = typeof query?.sessionId === "string" && query.sessionId.trim() ? query.sessionId.trim() : void 0;
    if (!deps.optimizations) return { total: 0, rows: [], limit, offset };
    try {
      const page = deps.optimizations.list({ sessionId, limit, offset });
      return { total: Number(page?.total) || 0, rows: Array.isArray(page?.rows) ? page.rows : [], limit, offset };
    } catch {
      return { total: 0, rows: [], limit, offset };
    }
  };
  const stats = () => {
    let optimizationStats = { total: 0, estimatedSavings: 0, verifiedSavings: 0 };
    if (deps.optimizations) {
      try {
        const value = deps.optimizations.stats();
        optimizationStats = {
          total: Number(value?.total) || 0,
          estimatedSavings: Number(value?.estimatedSavings) || 0,
          verifiedSavings: Number(value?.verifiedSavings) || 0
        };
      } catch {
      }
    }
    let sessionsWithUsage = 0;
    try {
      sessionsWithUsage = Number(
        deps.store.get(
          "SELECT COUNT(DISTINCT session_id) AS c FROM usage_records WHERE turn >= 0 AND source = 'live'"
        )?.c ?? 0
      );
    } catch {
      sessionsWithUsage = 0;
    }
    const settings = contextSettings();
    return {
      ...optimizationStats,
      optimizations: optimizationStats,
      mode: settings.mode,
      readOnly: true,
      context: settings,
      sessionsWithUsage
    };
  };
  return { analyze, optimize, listOptimizations, stats };
}

// src/host/live-api.ts
var EMPTY_TODAY = { calls: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, total: 0 };
function startOfToday2(now) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
function num6(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
function referencePriceRows(provider, model) {
  const lower = model.toLowerCase();
  const rows = [];
  for (const entry of REFERENCE_PRICES) {
    if (entry.provider !== provider || !lower.includes(entry.match)) continue;
    rows.push({
      provider,
      modelName: model,
      inputPrice: entry.input,
      cacheReadPrice: entry.cacheRead,
      cacheWritePrice: entry.cacheWrite,
      outputPrice: entry.output,
      currency: "CNY",
      unitTokens: 1e6,
      effectiveAt: Date.now()
    });
  }
  return rows;
}
function createLiveApi(deps) {
  const todayTotals = (now) => {
    try {
      return deps.store.get(
        `SELECT COUNT(1) calls, COALESCE(SUM(input_tokens),0) input, COALESCE(SUM(cache_read_tokens),0) cacheRead,
                  COALESCE(SUM(cache_write_tokens),0) cacheWrite, COALESCE(SUM(output_tokens),0) output,
                  COALESCE(SUM(total_tokens),0) total
             FROM usage_records WHERE turn >= 0 AND source = 'live' AND ts >= ?`,
        startOfToday2(now)
      ) ?? { ...EMPTY_TODAY };
    } catch {
      return { ...EMPTY_TODAY };
    }
  };
  const latestSession = () => {
    try {
      const row = deps.store.get(
        "SELECT session_id FROM usage_records WHERE turn >= 0 AND source = 'live' ORDER BY ts DESC LIMIT 1"
      );
      if (!row?.session_id) return null;
      const totals = deps.store.get(
        `SELECT COUNT(1) calls, COALESCE(SUM(total_tokens),0) total
           FROM usage_records WHERE turn >= 0 AND source = 'live' AND session_id = ?`,
        row.session_id
      );
      return { id: row.session_id, calls: num6(totals?.calls), total: num6(totals?.total) };
    } catch {
      return null;
    }
  };
  const sessionTurns = (sessionId) => {
    if (!sessionId) return [];
    try {
      const rows = deps.store.all(
        `SELECT turn, COALESCE(SUM(total_tokens),0) total, COUNT(1) calls
           FROM usage_records
          WHERE turn >= 0 AND source = 'live' AND session_id = ?
          GROUP BY turn ORDER BY turn ASC`,
        sessionId
      );
      let cumulative = 0;
      const out = [];
      for (const row of rows) {
        cumulative += num6(row.total);
        out.push({ turn: num6(row.turn), total: num6(row.total), cumulative, calls: num6(row.calls) });
      }
      return out.length > 12 ? out.slice(out.length - 12) : out;
    } catch {
      return [];
    }
  };
  const contextRisk = (sessionId, threshold) => {
    const base = {
      surfaceTokens: null,
      contextWindow: null,
      ratio: null,
      compressionThreshold: threshold,
      thresholdReached: false,
      readOnly: true,
      note: "\u672C\u63D2\u4EF6\u4E0D\u4F1A\u538B\u7F29\u6216\u6539\u5199 Harness \u4F1A\u8BDD\u5386\u53F2\uFF1B\u8FD9\u91CC\u53EA\u663E\u793A\u5F53\u524D\u4E0A\u4E0B\u6587\u5360\u7A97\u53E3\u7684\u6BD4\u4F8B\uFF0C\u4F9B\u4F60\u5224\u65AD\u4F55\u65F6\u624B\u52A8\u538B\u7F29\u3002"
    };
    if (!sessionId) return base;
    let surface = null;
    let window = null;
    try {
      const pressure = deps.readContextPressure?.(sessionId);
      if (pressure) {
        const used = num6(pressure.projectedTokens) || num6(pressure.pressureTokens) || num6(pressure.surfaceTokens);
        if (used > 0) surface = used;
        if (num6(pressure.contextWindow) > 0) window = num6(pressure.contextWindow);
      }
    } catch {
    }
    try {
      const measure = deps.measureSession?.(sessionId);
      if (measure) {
        const measuredSurface = num6(measure.surfaceTokens) || num6(measure.totalTokens);
        if (surface === null && measuredSurface > 0) surface = measuredSurface;
        const measuredWindow = num6(measure.contextWindow);
        if (window === null && measuredWindow > 0) window = measuredWindow;
      }
    } catch {
    }
    const ratio = surface !== null && window !== null && window > 0 ? surface / window : null;
    return {
      ...base,
      surfaceTokens: surface,
      contextWindow: window,
      ratio,
      thresholdReached: ratio !== null && ratio >= threshold
    };
  };
  const savedBytes = () => {
    try {
      const raw = deps.cacheStats?.() ?? {};
      const bytes = num6(raw.savedBytes);
      return { bytes: bytes > 0 ? bytes : 0, dedupeCount: num6(raw.dedupeCount) };
    } catch {
      return { bytes: 0, dedupeCount: 0 };
    }
  };
  const dominantModel = (now) => {
    try {
      const row = deps.store.get(
        `SELECT provider, model FROM usage_records
          WHERE turn >= 0 AND source = 'live' AND ts >= ? AND model IS NOT NULL
          GROUP BY provider, model ORDER BY SUM(total_tokens) DESC LIMIT 1`,
        startOfToday2(now)
      );
      return row?.model ? { provider: row.provider ?? "", model: row.model } : null;
    } catch {
      return null;
    }
  };
  const priceFor = (provider, model) => {
    try {
      return deps.costs.priceFor(provider, model);
    } catch {
      return null;
    }
  };
  const summary = () => {
    const now = Date.now();
    const today = todayTotals(now);
    const session = latestSession();
    const saved = savedBytes();
    const tokens = Math.round(saved.bytes / SAVED_TOKEN_BYTES);
    const dominant = dominantModel(now);
    const price = dominant ? priceFor(dominant.provider, dominant.model) : null;
    const settings = deps.settings.get();
    const compressionRaw = settings.compression;
    const uiRaw = settings.ui;
    const liveRaw = settings.live;
    const thresholdRaw = Number(liveRaw?.compressThreshold);
    const threshold = Number.isFinite(thresholdRaw) && thresholdRaw > 0 && thresholdRaw <= 1 ? thresholdRaw : LIVE_COMPRESS_THRESHOLD_DEFAULT;
    let savedCost = null;
    if (price && tokens > 0) {
      const unit = price.unitTokens > 0 ? price.unitTokens : 1e6;
      savedCost = round(tokens * price.inputPrice / unit);
    }
    return {
      generatedAt: now,
      today,
      session,
      turns: sessionTurns(session?.id ?? null),
      saved: { bytes: saved.bytes, tokens, dedupeCount: saved.dedupeCount, source: "estimate", note: LIVE_SAVED_NOTE },
      risk: contextRisk(session?.id ?? null, threshold),
      pricing: {
        configured: price !== null,
        currency: price?.currency ?? null,
        savedCost,
        source: price ? referencePriceRows(price.provider, price.modelName).length > 0 ? "reference" : "manual" : null,
        note: LIVE_REFERENCE_NOTE
      },
      compression: typeof compressionRaw?.mode === "string" ? compressionRaw.mode : "observe",
      ui: { overlay: uiRaw?.overlay !== false }
    };
  };
  const reference = () => {
    const now = Date.now();
    let models = [];
    try {
      models = deps.store.all(
        `SELECT DISTINCT provider, model FROM usage_records
          WHERE turn >= 0 AND source = 'live' AND ts >= ? AND model IS NOT NULL`,
        startOfToday2(now)
      );
    } catch {
      models = [];
    }
    const rows = [];
    const seen = /* @__PURE__ */ new Set();
    for (const entry of models) {
      for (const row of referencePriceRows(entry.provider ?? "", entry.model ?? "")) {
        const key = `${row.provider}/${row.modelName}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(row);
      }
    }
    return { rows, applied: 0, note: LIVE_REFERENCE_NOTE };
  };
  const applyReference = () => {
    const found = reference();
    let applied = 0;
    for (const row of found.rows) {
      const existing = priceFor(row.provider, row.modelName);
      if (existing) continue;
      deps.costs.upsertPrice(row);
      applied += 1;
    }
    return { rows: found.rows, applied, note: found.note };
  };
  return { summary, reference, applyReference };
}

// src/host/project-service.ts
var ProjectServiceError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};
function asRecord5(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function num7(value, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function isoTime(ts) {
  if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0) return "";
  try {
    return new Date(ts).toISOString();
  } catch {
    return "";
  }
}
function safeFilePart(value) {
  return String(value ?? "").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 60) || "project";
}
function textOf(value) {
  if (value === null || value === void 0) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((entry) => textOf(entry)).filter(Boolean).join("\n");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}
function extensionOf(targetPath) {
  const match = /\.([A-Za-z0-9]{1,8})\s*$/.exec(String(targetPath ?? "").trim());
  return match ? `.${match[1].toLowerCase()}` : "";
}
function createProjectService(deps) {
  const { store, costs, projects } = deps;
  const recordError = (where, error) => {
    try {
      store.metaSet("project_service_last_error", JSON.stringify({ ts: Date.now(), where, message: String(error?.message ?? error) }));
    } catch {
    }
  };
  const collect2 = () => {
    const byProject = /* @__PURE__ */ new Map();
    const ensure = (projectId) => {
      const id = projectId || "unknown";
      let entry = byProject.get(id);
      if (!entry) {
        entry = { projectId: id, cwd: null, sessions: 0, tasks: 0, calls: 0, totalTokens: 0, cost: null, lastActivity: null, hasSummary: false, summaryUpdatedAt: null };
        byProject.set(id, entry);
      }
      return entry;
    };
    try {
      const sessionRows = store.all(
        "SELECT project_id, COUNT(*) AS sessions, MAX(last_seen_at) AS last_activity, MAX(cwd) AS cwd FROM sessions GROUP BY project_id"
      );
      for (const row of sessionRows) {
        const entry = ensure(String(row.project_id ?? ""));
        entry.sessions = num7(row.sessions);
        entry.cwd = row.cwd ?? entry.cwd;
        if (row.last_activity !== null && row.last_activity !== void 0) entry.lastActivity = Math.max(entry.lastActivity ?? 0, num7(row.last_activity));
      }
    } catch (error) {
      recordError("sessions", error);
    }
    try {
      const taskRows = store.all("SELECT project_id, COUNT(*) AS tasks FROM tasks WHERE merged_into IS NULL GROUP BY project_id");
      for (const row of taskRows) ensure(String(row.project_id ?? "")).tasks = num7(row.tasks);
    } catch (error) {
      recordError("tasks", error);
    }
    try {
      const groups = store.all(
        `SELECT COALESCE(t.project_id, s.project_id, 'unknown') AS project_id,
                u.provider AS provider, u.model AS model, COUNT(*) AS calls,
                COALESCE(SUM(u.input_tokens),0) AS i, COALESCE(SUM(u.cache_read_tokens),0) AS cr,
                COALESCE(SUM(u.cache_write_tokens),0) AS cw, COALESCE(SUM(u.output_tokens),0) AS o,
                COALESCE(SUM(u.total_tokens),0) AS tot, MAX(u.ts) AS last_ts
           FROM usage_records u
           LEFT JOIN tasks t ON t.id = u.task_id
           LEFT JOIN sessions s ON s.session_id = u.session_id
          WHERE u.turn >= 0 AND u.source = 'live'
          GROUP BY COALESCE(t.project_id, s.project_id, 'unknown'), u.provider, u.model`
      );
      const costTotals = /* @__PURE__ */ new Map();
      for (const group of groups) {
        const entry = ensure(String(group.project_id ?? ""));
        entry.calls += num7(group.calls);
        entry.totalTokens += num7(group.tot);
        if (group.last_ts !== null && group.last_ts !== void 0) entry.lastActivity = Math.max(entry.lastActivity ?? 0, num7(group.last_ts));
        const value = costs.costOf(
          { inputTokens: num7(group.i), cacheReadTokens: num7(group.cr), cacheWriteTokens: num7(group.cw), outputTokens: num7(group.o) },
          group.provider ?? null,
          group.model ?? null
        );
        const bucket = costTotals.get(entry.projectId) ?? { total: 0, priced: 0, complete: true };
        if (value === null) bucket.complete = false;
        else {
          bucket.total += value;
          bucket.priced += 1;
        }
        costTotals.set(entry.projectId, bucket);
      }
      for (const [projectId, bucket] of costTotals) {
        const entry = byProject.get(projectId);
        if (entry) entry.cost = bucket.priced > 0 && bucket.complete ? bucket.total : null;
      }
    } catch (error) {
      recordError("usage", error);
    }
    try {
      for (const record of projects.list()) {
        const entry = ensure(String(record.projectId ?? ""));
        entry.hasSummary = true;
        entry.summaryUpdatedAt = num7(record.updatedAt);
      }
    } catch (error) {
      recordError("projects.list", error);
    }
    return [...byProject.values()].sort((a, b) => (b.lastActivity ?? -1) - (a.lastActivity ?? -1) || a.projectId.localeCompare(b.projectId));
  };
  const toItem = (agg) => ({
    projectId: agg.projectId,
    sessions: agg.sessions,
    tasks: agg.tasks,
    calls: agg.calls,
    totalTokens: agg.totalTokens,
    cost: agg.cost,
    lastActivity: agg.lastActivity,
    hasSummary: agg.hasSummary,
    summaryUpdatedAt: agg.summaryUpdatedAt
  });
  const list = () => collect2().slice(0, PROJECT_DEFAULTS.maxProjects).map(toItem);
  const architectureDraft = (projectId) => {
    if (WRITE_TOOLS.length === 0) return "";
    try {
      const placeholders = WRITE_TOOLS.map(() => "?").join(", ");
      const rows = store.all(
        `SELECT tc.target_path AS target_path
           FROM tool_calls tc
           JOIN tasks t ON t.id = tc.task_id
          WHERE t.project_id = ? AND tc.target_path IS NOT NULL AND tc.tool_name IN (${placeholders})
          LIMIT 2000`,
        projectId,
        ...WRITE_TOOLS
      );
      const counts = /* @__PURE__ */ new Map();
      for (const row of rows) {
        const ext = extensionOf(String(row.target_path ?? ""));
        if (!ext) continue;
        counts.set(ext, (counts.get(ext) ?? 0) + 1);
      }
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
      if (top.length === 0) return "";
      return `\u4FEE\u6539\u6587\u4EF6\u6269\u5C55\u540D\uFF08Top ${top.length}\uFF09\uFF1A${top.map(([ext, count]) => `${ext}=${count}`).join("\u3001")}`;
    } catch (error) {
      recordError("architectureDraft", error);
      return "";
    }
  };
  const generateDraft = (projectId, stats, cwd) => {
    const draft = {};
    const sessions = stats?.sessions ?? 0;
    const tasks = stats?.tasks ?? 0;
    const totalTokens = stats?.totalTokens ?? 0;
    draft.overview = [
      `\u9879\u76EE\u8DEF\u5F84\uFF1A${cwd ?? projectId}`,
      `\u4F1A\u8BDD\u6570\uFF1A${sessions}`,
      `\u4EFB\u52A1\u6570\uFF1A${tasks}`,
      `\u7D2F\u8BA1 tokens\uFF1A${totalTokens}`
    ].join("\n");
    draft.architecture = architectureDraft(projectId);
    draft.database = "";
    draft.apis = "";
    try {
      const completed = store.all(
        "SELECT task_name FROM tasks WHERE project_id = ? AND status = 'completed' AND merged_into IS NULL ORDER BY COALESCE(ended_at, started_at) DESC LIMIT 10",
        projectId
      );
      draft.completed = completed.map((row) => `- ${String(row.task_name ?? "")}`).join("\n");
    } catch (error) {
      recordError("draft.completed", error);
      draft.completed = "";
    }
    try {
      const recent = store.all(
        "SELECT task_name, status FROM tasks WHERE project_id = ? AND merged_into IS NULL ORDER BY COALESCE(ended_at, started_at) DESC LIMIT 3",
        projectId
      );
      const lines = [];
      if (stats?.lastActivity) lines.push(`\u6700\u8FD1\u6D3B\u52A8\uFF1A${isoTime(stats.lastActivity)}`);
      for (const row of recent) lines.push(`- ${String(row.task_name ?? "")}\uFF08${String(row.status ?? "")}\uFF09`);
      draft.status = lines.join("\n");
    } catch (error) {
      recordError("draft.status", error);
      draft.status = "";
    }
    try {
      const unfinished = num7(store.get("SELECT COUNT(*) AS c FROM tasks WHERE project_id = ? AND status IN ('pending','running','paused') AND merged_into IS NULL", projectId)?.c);
      const findings = num7(
        store.get("SELECT COUNT(*) AS c FROM findings f JOIN tasks t ON t.id = f.task_id WHERE t.project_id = ? AND t.merged_into IS NULL", projectId)?.c
      );
      const pendingTasks = store.all(
        "SELECT task_name FROM tasks WHERE project_id = ? AND status IN ('pending','running','paused') AND merged_into IS NULL ORDER BY COALESCE(ended_at, started_at) DESC LIMIT 10",
        projectId
      );
      const lines = [`\u672A\u5B8C\u6210\u4EFB\u52A1\uFF1A${unfinished}`, `\u672A\u5904\u7406\u5F02\u5E38\u53D1\u73B0\uFF1A${findings}`];
      for (const row of pendingTasks) lines.push(`- ${String(row.task_name ?? "")}`);
      draft.pending = lines.join("\n");
    } catch (error) {
      recordError("draft.pending", error);
      draft.pending = "";
    }
    draft.constraints = "";
    return draft;
  };
  const summary = (projectId) => {
    const id = String(projectId ?? "").trim();
    if (!id) throw new ProjectServiceError("INVALID_PROJECT", "projectId \u5FC5\u586B");
    const full = collect2();
    const agg = full.find((entry) => entry.projectId === id) ?? null;
    const stats = agg ? toItem(agg) : null;
    let record = null;
    try {
      record = projects.get(id);
    } catch (error) {
      recordError("projects.get", error);
      record = null;
    }
    const draft = record ? { ...record.summary } : generateDraft(id, stats, agg?.cwd ?? null);
    return { record, draft, stats };
  };
  const update = (projectId, patch) => {
    const id = String(projectId ?? "").trim();
    if (!id) throw new ProjectServiceError("INVALID_PROJECT", "projectId \u5FC5\u586B");
    const input = asRecord5(patch);
    const filtered = {};
    for (const section of PROJECT_SUMMARY_SECTIONS) {
      if (input[section] === void 0) continue;
      filtered[section] = textOf(input[section]);
    }
    let existing = null;
    try {
      existing = projects.get(id);
    } catch (error) {
      recordError("projects.get", error);
    }
    const now = Date.now();
    const version = (existing?.version ?? 0) + 1;
    try {
      return projects.upsert({
        projectId: id,
        version,
        summary: { ...existing?.summary ?? {}, ...filtered },
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      });
    } catch (error) {
      recordError("projects.upsert", error);
      throw new ProjectServiceError("STORE_ERROR", `\u9879\u76EE\u6458\u8981\u4FDD\u5B58\u5931\u8D25: ${String(error?.message ?? error)}`);
    }
  };
  const exportSummary = (projectId, format) => {
    const id = String(projectId ?? "").trim();
    if (!id) throw new ProjectServiceError("INVALID_PROJECT", "projectId \u5FC5\u586B");
    let record = null;
    try {
      record = projects.get(id);
    } catch (error) {
      recordError("projects.get", error);
      record = null;
    }
    if (!record) throw new ProjectServiceError("NOT_FOUND", "\u8BE5\u9879\u76EE\u8FD8\u6CA1\u6709\u5DF2\u4FDD\u5B58\u7684\u6458\u8981");
    const base = `project-${safeFilePart(id)}`;
    if (format === "json") {
      return {
        filename: `${base}.json`,
        contentType: "application/json; charset=utf-8",
        content: JSON.stringify(
          { projectId: record.projectId, version: record.version, createdAt: record.createdAt, updatedAt: record.updatedAt, summary: record.summary },
          null,
          2
        )
      };
    }
    if (format === "markdown") {
      const lines = [`# \u9879\u76EE\u6458\u8981\uFF1A${record.projectId}`, "", `- \u7248\u672C\uFF1Av${record.version}`, `- \u66F4\u65B0\u65F6\u95F4\uFF1A${isoTime(record.updatedAt)}`, ""];
      for (const section of PROJECT_SUMMARY_SECTIONS) {
        lines.push(`## ${PROJECT_SUMMARY_LABELS[section].zh}`);
        lines.push("");
        lines.push((record.summary[section] ?? "").trim() || "\uFF08\u7A7A\uFF09");
        lines.push("");
      }
      return { filename: `${base}.md`, contentType: "text/markdown; charset=utf-8", content: lines.join("\n") };
    }
    throw new ProjectServiceError("INVALID_FORMAT", `\u4E0D\u652F\u6301\u7684\u5BFC\u51FA\u683C\u5F0F: ${String(format)}`);
  };
  return { list, summary, update, exportSummary };
}

// src/host/task-service.ts
var TaskServiceError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};
var WRITE_SET = new Set(WRITE_TOOLS);
var COMMAND_SET = new Set(COMMAND_TOOLS);
var TEST_RES = TEST_PATTERNS.map((source) => {
  try {
    return new RegExp(source, "i");
  } catch {
    return null;
  }
}).filter((value) => value !== null);
function asRecord6(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function num8(value, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function sanitizeName(input, limit = 80) {
  let text = String(input ?? "").replace(
    /([A-Za-z0-9_.$-]+\s*[:=]\s*)(["']?)([^\s"',;}\]]+)/g,
    (match, prefix, quote) => {
      const key = prefix.replace(/[\s:=]+$/g, "");
      return SENSITIVE_KEY_REGEX.test(key) ? `${prefix}${quote}***` : match;
    }
  );
  text = text.replace(/\b(?:(?:sk|ghp|github_pat|xox[baprs])[-_])[A-Za-z0-9_-]{8,}/g, "***");
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length <= limit ? text : `${text.slice(0, Math.max(1, limit - 1))}\u2026`;
}
function fieldValue(value) {
  if (value === null || value === void 0) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((entry) => fieldValue(entry)).filter(Boolean).join("\n");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}
function parseSummaryText(raw) {
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return { completed: raw };
  }
}
function emptyBuckets() {
  return { inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0, totalTokens: 0, reasoningTokens: null };
}
function escapeCell(value) {
  let text = value === null || value === void 0 ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}
function escapeMarkdown(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " / ");
}
function safeFilePart2(value) {
  return String(value ?? "").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 60) || "task";
}
function isoTime2(ts) {
  if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0) return "";
  try {
    return new Date(ts).toISOString();
  } catch {
    return "";
  }
}
function createTaskService(deps) {
  const { store, costs, tasks } = deps;
  const recordError = (where, error) => {
    try {
      store.metaSet("task_service_last_error", JSON.stringify({ ts: Date.now(), where, message: String(error?.message ?? error) }));
    } catch {
    }
  };
  const recentLiveSessionId = () => {
    try {
      const row = store.get(
        `SELECT s.session_id AS session_id FROM sessions s
          WHERE EXISTS (SELECT 1 FROM usage_records u WHERE u.session_id = s.session_id AND u.turn >= 0 AND u.source = 'live')
          ORDER BY s.last_seen_at DESC, s.created_at DESC LIMIT 1`
      );
      if (row?.session_id) return String(row.session_id);
    } catch {
    }
    try {
      return store.get("SELECT session_id FROM usage_records WHERE turn >= 0 AND source = 'live' ORDER BY ts DESC LIMIT 1")?.session_id ?? null;
    } catch {
      return null;
    }
  };
  const projectIdForSession = (sessionId) => {
    try {
      const row = store.get("SELECT project_id, cwd FROM sessions WHERE session_id = ?", sessionId);
      if (row) {
        const projectId = typeof row.project_id === "string" ? row.project_id.trim() : "";
        if (projectId && projectId !== "unknown") return projectId;
        const cwd = typeof row.cwd === "string" ? row.cwd.trim() : "";
        if (cwd) return cwd;
      }
    } catch (error) {
      recordError("projectIdForSession", error);
    }
    return "unknown";
  };
  const loadToolRows = (taskId) => {
    try {
      return store.all(
        "SELECT tool_name, target_path, command FROM tool_calls WHERE task_id = ? ORDER BY ts, id",
        taskId
      ).map((row) => ({ toolName: String(row.tool_name ?? ""), targetPath: row.target_path ?? null, command: row.command ?? null }));
    } catch (error) {
      recordError("loadToolRows", error);
      return [];
    }
  };
  const loadFindings = (taskId) => {
    try {
      return store.all("SELECT id, session_id, task_id, kind, severity, subject, detail, evidence, created_at FROM findings WHERE task_id = ? ORDER BY created_at DESC, id DESC LIMIT 500", taskId).map((row) => ({
        id: num8(row.id),
        sessionId: String(row.session_id ?? ""),
        taskId: row.task_id ?? null,
        kind: row.kind,
        severity: String(row.severity ?? "info"),
        subject: String(row.subject ?? ""),
        detail: row.detail ?? "{}",
        evidence: row.evidence ?? "{}",
        createdAt: num8(row.created_at)
      }));
    } catch (error) {
      recordError("loadFindings", error);
      return [];
    }
  };
  const loadCalls = (taskId) => {
    try {
      const rows = store.all(
        `SELECT id, session_id, task_id, turn, step, attempt, is_final, provider, model, reasoning_effort,
                input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, reasoning_tokens,
                total_tokens, duration_ms, ts, message_id, source
           FROM usage_records
          WHERE task_id = ? AND turn >= 0 AND is_final = 1 AND source = 'live'
          ORDER BY ts DESC, id DESC
          LIMIT 200`,
        taskId
      );
      return rows.map((row) => {
        const usage = {
          id: num8(row.id),
          sessionId: String(row.session_id ?? ""),
          taskId: row.task_id === null || row.task_id === void 0 ? null : String(row.task_id),
          turn: num8(row.turn),
          step: num8(row.step),
          attempt: num8(row.attempt, 1),
          isFinal: num8(row.is_final, 1),
          provider: row.provider === null || row.provider === void 0 ? null : String(row.provider),
          model: row.model === null || row.model === void 0 ? null : String(row.model),
          reasoningEffort: row.reasoning_effort === null || row.reasoning_effort === void 0 ? null : String(row.reasoning_effort),
          inputTokens: num8(row.input_tokens),
          cacheReadTokens: num8(row.cache_read_tokens),
          cacheWriteTokens: num8(row.cache_write_tokens),
          outputTokens: num8(row.output_tokens),
          reasoningTokens: row.reasoning_tokens === null || row.reasoning_tokens === void 0 ? null : num8(row.reasoning_tokens),
          totalTokens: num8(row.total_tokens),
          durationMs: row.duration_ms === null || row.duration_ms === void 0 ? null : num8(row.duration_ms),
          ts: num8(row.ts),
          messageId: row.message_id === null || row.message_id === void 0 ? null : String(row.message_id),
          source: row.source === "import" ? "import" : "live"
        };
        const cost = costs.costOf(
          { inputTokens: usage.inputTokens, cacheReadTokens: usage.cacheReadTokens, cacheWriteTokens: usage.cacheWriteTokens, outputTokens: usage.outputTokens },
          usage.provider,
          usage.model
        );
        return { ...usage, cost };
      });
    } catch (error) {
      recordError("loadCalls", error);
      return [];
    }
  };
  const aggregate = (task, toolRows, calls) => {
    const buckets = emptyBuckets();
    let durationSum = 0;
    let hasDuration = false;
    for (const call of calls) {
      buckets.inputTokens += call.inputTokens;
      buckets.cacheReadTokens += call.cacheReadTokens;
      buckets.cacheWriteTokens += call.cacheWriteTokens;
      buckets.outputTokens += call.outputTokens;
      buckets.totalTokens += call.totalTokens;
      if (call.durationMs !== null) {
        durationSum += call.durationMs;
        hasDuration = true;
      }
    }
    let cost = null;
    try {
      const groups = store.all(
        `SELECT provider, model,
                COALESCE(SUM(input_tokens),0) AS i, COALESCE(SUM(cache_read_tokens),0) AS cr,
                COALESCE(SUM(cache_write_tokens),0) AS cw, COALESCE(SUM(output_tokens),0) AS o
           FROM usage_records WHERE task_id = ? AND turn >= 0 AND is_final = 1 AND source = 'live'
          GROUP BY provider, model`,
        task.id
      );
      let total = 0;
      let priced = 0;
      let complete = true;
      for (const group of groups) {
        const value = costs.costOf({ inputTokens: num8(group.i), cacheReadTokens: num8(group.cr), cacheWriteTokens: num8(group.cw), outputTokens: num8(group.o) }, group.provider ?? null, group.model ?? null);
        if (value === null) complete = false;
        else {
          total += value;
          priced += 1;
        }
      }
      cost = priced > 0 ? total : null;
      if (!complete) cost = null;
    } catch (error) {
      recordError("aggregate.cost", error);
      cost = null;
    }
    let toolCalls = 0;
    try {
      toolCalls = num8(store.get("SELECT COUNT(*) AS c FROM tool_calls WHERE task_id = ?", task.id)?.c);
    } catch {
      toolCalls = toolRows.length;
    }
    const writes = aggregateWrites(toolRows);
    return {
      metrics: {
        calls: calls.length,
        inputTokens: buckets.inputTokens,
        cacheReadTokens: buckets.cacheReadTokens,
        cacheWriteTokens: buckets.cacheWriteTokens,
        outputTokens: buckets.outputTokens,
        totalTokens: buckets.totalTokens,
        cost,
        durationMs: task.endedAt !== null ? Math.max(0, task.endedAt - task.startedAt) : hasDuration ? durationSum : null,
        toolCalls
      },
      calls,
      writes,
      toolRows
    };
  };
  const firstWord = (command) => {
    const clean = String(command ?? "").trim();
    if (!clean) return "";
    const word = clean.split(/\s+/)[0] ?? "";
    return word.replace(/^["']|["']$/g, "").toLowerCase().slice(0, 40);
  };
  const aggregateWrites = (toolRows) => {
    const counts = /* @__PURE__ */ new Map();
    for (const row of toolRows) {
      if (WRITE_SET.has(row.toolName) && row.targetPath) {
        const key = `write|${row.toolName}|${row.targetPath}`;
        const entry = counts.get(key) ?? { toolName: row.toolName, targetPath: row.targetPath, command: null, count: 0 };
        entry.count += 1;
        counts.set(key, entry);
        continue;
      }
      if (COMMAND_SET.has(row.toolName) && row.command) {
        const word = firstWord(row.command);
        if (!word) continue;
        const key = `command|${row.toolName}|${word}`;
        const entry = counts.get(key) ?? { toolName: row.toolName, targetPath: null, command: word, count: 0 };
        entry.count += 1;
        counts.set(key, entry);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])).slice(0, 100).map(([, entry]) => entry);
  };
  const testCommandLines = (toolRows) => {
    const seen = /* @__PURE__ */ new Set();
    const lines = [];
    for (const row of toolRows) {
      if (!row.command) continue;
      if (!TEST_RES.some((re) => re.test(row.command))) continue;
      const command = row.command.replace(/\s+/g, " ").trim().slice(0, 120);
      if (seen.has(command)) continue;
      seen.add(command);
      lines.push(`\u547D\u4EE4: ${command}`);
      if (lines.length >= 10) break;
    }
    return lines;
  };
  const buildAutoDraft = (task, core, findings) => {
    const fileTargets = [];
    const seenFiles = /* @__PURE__ */ new Set();
    for (const row of core.toolRows) {
      if (!WRITE_SET.has(row.toolName) || !row.targetPath) continue;
      if (seenFiles.has(row.targetPath)) continue;
      seenFiles.add(row.targetPath);
      fileTargets.push(row.targetPath);
      if (fileTargets.length >= 30) break;
    }
    const testLines = testCommandLines(core.toolRows);
    const repeatedTest = findings.filter((finding) => /test/i.test(finding.kind));
    if (repeatedTest.length > 0) testLines.push(`\u672C\u5730\u68C0\u6D4B\u5230 ${repeatedTest.length} \u6761\u4E0E\u6D4B\u8BD5\u76F8\u5173\u7684\u5F02\u5E38\u53D1\u73B0`);
    const money = core.metrics.cost === null ? "\u4EF7\u683C\u672A\u914D\u7F6E" : `\u4F30\u7B97\u8D39\u7528 ${core.metrics.cost}`;
    const tokenStats = `\u8F93\u5165 ${core.metrics.inputTokens} / \u7F13\u5B58\u8BFB\u53D6 ${core.metrics.cacheReadTokens} / \u7F13\u5B58\u5199\u5165 ${core.metrics.cacheWriteTokens} / \u8F93\u51FA ${core.metrics.outputTokens} / \u5408\u8BA1 ${core.metrics.totalTokens}\uFF1B${money}`;
    return {
      objective: String(task.firstPrompt ?? "").trim(),
      completed: "",
      decisions: "",
      files: fileTargets.join("\n"),
      apiChanges: "",
      tests: testLines.join("\n"),
      pending: "",
      nextSteps: "",
      tokenStats
    };
  };
  const mergeSummary = (task, core, findings) => {
    const storedFull = parseSummaryText(task.summary);
    const storedFields = {};
    for (const field of TASK_SUMMARY_FIELDS) {
      const value = fieldValue(storedFull[field]);
      if (value.trim()) storedFields[field] = value;
    }
    const auto = buildAutoDraft(task, core, findings);
    const merged = { ...storedFull };
    for (const field of TASK_SUMMARY_FIELDS) merged[field] = storedFields[field] ?? auto[field] ?? "";
    return { summary: merged, summaryEdited: Object.keys(storedFields).length > 0 };
  };
  const getDetail = (id) => {
    const task = tasks.getTask(String(id));
    if (!task) return null;
    const toolRows = loadToolRows(task.id);
    const calls = loadCalls(task.id);
    const core = aggregate(task, toolRows, calls);
    const findings = loadFindings(task.id);
    const mergedSummary = mergeSummary(task, core, findings);
    return {
      task,
      metrics: core.metrics,
      calls: core.calls,
      writes: core.writes,
      findings,
      summary: mergedSummary.summary,
      summaryEdited: mergedSummary.summaryEdited
    };
  };
  const create = (input) => {
    const name2 = sanitizeName(input?.name, 80);
    if (!name2) throw new TaskServiceError("INVALID_NAME", "\u4EFB\u52A1\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
    const taskType = typeof input?.taskType === "string" && input.taskType.trim() ? input.taskType.trim() : "normal-dev";
    if (!TASK_TYPES.includes(taskType)) throw new TaskServiceError("INVALID_TASK_TYPE", `\u672A\u77E5\u4EFB\u52A1\u7C7B\u578B: ${taskType}`);
    const sessionId = typeof input?.sessionId === "string" && input.sessionId.trim() ? input.sessionId.trim() : recentLiveSessionId();
    if (!sessionId) throw new TaskServiceError("NO_SESSION", "\u6CA1\u6709\u53EF\u7528\u4E8E\u624B\u52A8\u4EFB\u52A1\u7684 live \u4F1A\u8BDD");
    const projectId = typeof input?.projectId === "string" && input.projectId.trim() ? input.projectId.trim() : projectIdForSession(sessionId);
    return tasks.createManual({ sessionId, projectId, name: name2, taskType });
  };
  const update = (id, patch) => {
    const taskId = String(id ?? "").trim();
    if (!taskId) throw new TaskServiceError("INVALID_ID", "id \u5FC5\u586B");
    const existing = tasks.getTask(taskId);
    if (!existing) return null;
    const next = {};
    if (patch?.name !== void 0) {
      const name2 = sanitizeName(patch.name, 80);
      if (!name2) throw new TaskServiceError("INVALID_NAME", "\u4EFB\u52A1\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
      next.taskName = name2;
      next.taskTypeSource = "manual";
    }
    if (patch?.taskType !== void 0) {
      const taskType = String(patch.taskType);
      if (!TASK_TYPES.includes(taskType)) throw new TaskServiceError("INVALID_TASK_TYPE", `\u672A\u77E5\u4EFB\u52A1\u7C7B\u578B: ${taskType}`);
      next.taskType = taskType;
      next.taskTypeSource = "manual";
    }
    if (patch?.status !== void 0) {
      const status = String(patch.status);
      if (!TASK_STATUSES.includes(status)) throw new TaskServiceError("INVALID_STATUS", `\u672A\u77E5\u4EFB\u52A1\u72B6\u6001: ${status}`);
      next.status = status;
    }
    if (patch?.summary !== void 0) {
      const storedFull = parseSummaryText(existing.summary);
      const provided = typeof patch.summary === "string" ? parseSummaryText(patch.summary) : asRecord6(patch.summary);
      const merged = { ...storedFull };
      for (const field of TASK_SUMMARY_FIELDS) {
        if (provided[field] === void 0) continue;
        const value = fieldValue(provided[field]);
        if (value.trim()) merged[field] = value;
      }
      next.summary = JSON.stringify(merged);
    }
    return tasks.updateTask(taskId, next);
  };
  const reassignMergedData = (targetId, otherIds) => {
    for (const otherId of otherIds) {
      if (!otherId || otherId === targetId) continue;
      try {
        store.run("UPDATE usage_records SET task_id = ? WHERE task_id = ?", targetId, otherId);
      } catch (error) {
        recordError("merge.usage", error);
      }
      try {
        store.run("UPDATE tool_calls SET task_id = ? WHERE task_id = ?", targetId, otherId);
      } catch (error) {
        recordError("merge.toolCalls", error);
      }
      try {
        store.run("UPDATE OR IGNORE findings SET task_id = ? WHERE task_id = ?", targetId, otherId);
      } catch (error) {
        recordError("merge.findings", error);
      }
    }
    try {
      const targetTask = tasks.getTask(targetId);
      const detail = getDetail(targetId);
      if (targetTask && detail) {
        const storedFull = parseSummaryText(targetTask.summary);
        storedFull.tokenStats = fieldValue(detail.summary.tokenStats);
        tasks.updateTask(targetId, { summary: JSON.stringify(storedFull) });
      }
    } catch (error) {
      recordError("merge.summary", error);
    }
    try {
      deps.analytics?.analyzeTask?.(targetId);
    } catch (error) {
      recordError("merge.analyzeTask", error);
    }
  };
  const merge = (input) => {
    const ids = [...new Set((Array.isArray(input?.ids) ? input.ids : []).filter((value) => typeof value === "string" && value.trim().length > 0).map((value) => value.trim()))];
    if (ids.length < 2) return null;
    const taskType = input?.taskType === void 0 ? void 0 : String(input.taskType);
    if (taskType !== void 0 && !TASK_TYPES.includes(taskType)) throw new TaskServiceError("INVALID_TASK_TYPE", `\u672A\u77E5\u4EFB\u52A1\u7C7B\u578B: ${taskType}`);
    const fn = tasks.mergeTasks;
    if (typeof fn !== "function") return null;
    try {
      const name2 = input?.name === void 0 ? void 0 : sanitizeName(input.name, 80) || void 0;
      const target = fn.call(tasks, { ids, name: name2, taskType }) ?? null;
      if (!target) return null;
      reassignMergedData(target.id, ids);
      return tasks.getTask(target.id) ?? target;
    } catch (error) {
      recordError("mergeTasks", error);
      return null;
    }
  };
  const updateSummary = (id, summary) => {
    const taskId = String(id ?? "").trim();
    if (!taskId) throw new TaskServiceError("INVALID_ID", "id \u5FC5\u586B");
    const existing = tasks.getTask(taskId);
    if (!existing) return null;
    const storedFull = parseSummaryText(existing.summary);
    const merged = { ...storedFull };
    for (const field of TASK_SUMMARY_FIELDS) {
      const value = asRecord6(summary)[field];
      if (value === void 0) continue;
      merged[field] = fieldValue(value);
    }
    const updated = tasks.updateTask(taskId, { summary: JSON.stringify(merged) });
    if (!updated) return null;
    return getDetail(taskId);
  };
  const markdownReport = (detail) => {
    const lines = [];
    lines.push(`# \u4EFB\u52A1\u62A5\u544A\uFF1A${detail.task.taskName}`);
    lines.push("");
    lines.push(`- \u4EFB\u52A1 ID\uFF1A${detail.task.id}`);
    lines.push(`- \u7C7B\u578B\uFF1A${detail.task.taskType}\uFF08${detail.task.taskTypeSource}\uFF09`);
    lines.push(`- \u72B6\u6001\uFF1A${detail.task.status}`);
    lines.push(`- \u9879\u76EE\uFF1A${detail.task.projectId}`);
    lines.push(`- \u4F1A\u8BDD\uFF1A${detail.task.sessionId}`);
    lines.push(`- \u5F00\u59CB\u65F6\u95F4\uFF1A${isoTime2(detail.task.startedAt)}`);
    lines.push(`- \u7ED3\u675F\u65F6\u95F4\uFF1A${isoTime2(detail.task.endedAt)}`);
    lines.push("");
    lines.push("## \u6307\u6807");
    lines.push("");
    lines.push("| \u6307\u6807 | \u503C |");
    lines.push("| --- | --- |");
    lines.push(`| \u8C03\u7528\u6B21\u6570 | ${detail.metrics.calls} |`);
    lines.push(`| \u8F93\u5165 tokens | ${detail.metrics.inputTokens} |`);
    lines.push(`| \u7F13\u5B58\u8BFB\u53D6 tokens | ${detail.metrics.cacheReadTokens} |`);
    lines.push(`| \u7F13\u5B58\u5199\u5165 tokens | ${detail.metrics.cacheWriteTokens} |`);
    lines.push(`| \u8F93\u51FA tokens | ${detail.metrics.outputTokens} |`);
    lines.push(`| \u5408\u8BA1 tokens | ${detail.metrics.totalTokens} |`);
    lines.push(`| \u4F30\u7B97\u8D39\u7528 | ${detail.metrics.cost === null ? "\u4EF7\u683C\u672A\u914D\u7F6E" : detail.metrics.cost} |`);
    lines.push(`| \u8017\u65F6(ms) | ${detail.metrics.durationMs ?? ""} |`);
    lines.push(`| \u5DE5\u5177\u8C03\u7528 | ${detail.metrics.toolCalls} |`);
    lines.push("");
    lines.push(`## \u4EFB\u52A1\u6458\u8981${detail.summaryEdited ? "\uFF08\u542B\u7528\u6237\u7F16\u8F91\uFF09" : "\uFF08\u81EA\u52A8\u8349\u7A3F\uFF0C\u672C\u5730\u751F\u6210\uFF09"}`);
    lines.push("");
    for (const field of TASK_SUMMARY_FIELDS) {
      lines.push(`### ${TASK_SUMMARY_LABELS[field].zh}`);
      lines.push("");
      const value = fieldValue(detail.summary[field]);
      lines.push(value || "\uFF08\u7A7A\uFF09");
      lines.push("");
    }
    lines.push("## \u4FEE\u6539\u6587\u4EF6 / \u547D\u4EE4\u805A\u5408");
    lines.push("");
    if (detail.writes.length === 0) lines.push("\uFF08\u65E0\uFF09");
    else {
      lines.push("| \u5DE5\u5177 | \u76EE\u6807/\u547D\u4EE4 | \u6B21\u6570 |");
      lines.push("| --- | --- | --- |");
      for (const write of detail.writes.slice(0, 50)) {
        lines.push(`| ${escapeMarkdown(write.toolName)} | ${escapeMarkdown(write.targetPath ?? write.command ?? "")} | ${write.count} |`);
      }
    }
    lines.push("");
    lines.push(`## \u5F02\u5E38\u53D1\u73B0\uFF08${detail.findings.length}\uFF09`);
    lines.push("");
    if (detail.findings.length === 0) lines.push("\uFF08\u65E0\uFF09");
    else for (const finding of detail.findings.slice(0, 20)) lines.push(`- [${finding.severity}] ${finding.kind}\uFF1A${escapeMarkdown(finding.subject)}`);
    lines.push("");
    lines.push("## \u8C03\u7528\u660E\u7EC6\uFF08\u524D 50\uFF09");
    lines.push("");
    lines.push("| \u65F6\u95F4 | \u6A21\u578B | \u8F93\u5165 | \u7F13\u5B58\u8BFB\u53D6 | \u7F13\u5B58\u5199\u5165 | \u8F93\u51FA | \u5408\u8BA1 | \u8D39\u7528 |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const call of detail.calls.slice(0, 50)) {
      lines.push(`| ${escapeMarkdown(isoTime2(call.ts))} | ${escapeMarkdown(call.model ?? "")} | ${call.inputTokens} | ${call.cacheReadTokens} | ${call.cacheWriteTokens} | ${call.outputTokens} | ${call.totalTokens} | ${call.cost === null ? "" : call.cost} |`);
    }
    lines.push("");
    return lines.join("\n");
  };
  const csvReport = (detail) => {
    const header = ["ts", "time", "session_id", "provider", "model", "input_tokens", "cache_read_tokens", "cache_write_tokens", "output_tokens", "total_tokens", "cost", "duration_ms"];
    const lines = [header.map(escapeCell).join(",")];
    for (const call of detail.calls) {
      lines.push(
        [call.ts, isoTime2(call.ts), call.sessionId, call.provider ?? "", call.model ?? "", call.inputTokens, call.cacheReadTokens, call.cacheWriteTokens, call.outputTokens, call.totalTokens, call.cost === null ? "" : call.cost, call.durationMs ?? ""].map(escapeCell).join(",")
      );
    }
    return `\uFEFF${lines.join("\r\n")}\r
`;
  };
  const exportTask = (id, format) => {
    const detail = getDetail(id);
    if (!detail) throw new TaskServiceError("NOT_FOUND", "\u4EFB\u52A1\u4E0D\u5B58\u5728");
    const base = `task-${safeFilePart2(detail.task.id)}`;
    switch (format) {
      case "json":
        return { filename: `${base}.json`, contentType: "application/json; charset=utf-8", content: JSON.stringify(detail, null, 2) };
      case "markdown":
        return { filename: `${base}.md`, contentType: "text/markdown; charset=utf-8", content: markdownReport(detail) };
      case "csv":
        return { filename: `${base}.csv`, contentType: "text/csv; charset=utf-8", content: csvReport(detail) };
      default:
        throw new TaskServiceError("INVALID_FORMAT", `\u4E0D\u652F\u6301\u7684\u5BFC\u51FA\u683C\u5F0F: ${String(format)}`);
    }
  };
  return {
    create,
    update,
    merge,
    detail: (id) => getDetail(id),
    updateSummary,
    exportTask
  };
}

// src/host/http-api.ts
var MAX_BODY_BYTES = 64 * 1024;
var MAX_PAGE3 = 500;
var OVERVIEW_RANGES2 = /* @__PURE__ */ new Set(["today", "session", "task", "project", "all"]);
var CALL_SORTS = /* @__PURE__ */ new Set(["ts", "totalTokens", "inputTokens", "outputTokens", "cost"]);
var HttpError = class extends Error {
  status;
  code;
  allow;
  constructor(status, code, message, allow) {
    super(message);
    this.status = status;
    this.code = code;
    this.allow = allow;
  }
};
function asRecord7(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function sendJson(res, status, payload, extraHeaders = {}) {
  if (res.writableEnded) return;
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders
  });
  res.end(body);
}
function sendOk(res, data) {
  sendJson(res, 200, { ok: true, data: data === void 0 ? null : data });
}
function sendError(res, status, code, message, allow) {
  const headers = {};
  if (allow && allow.length > 0) headers.Allow = allow.join(", ");
  sendJson(res, status, { ok: false, error: { code, message } }, headers);
}
function readNumber(value, name2) {
  if (value === void 0 || value === null || value === "") return void 0;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new HttpError(400, "INVALID_PARAM", `${name2} \u5FC5\u987B\u662F\u6570\u5B57`);
  return parsed;
}
function readString(value, name2) {
  if (value === void 0 || value === null || value === "") return void 0;
  if (typeof value !== "string") throw new HttpError(400, "INVALID_PARAM", `${name2} \u5FC5\u987B\u662F\u5B57\u7B26\u4E32`);
  return value;
}
function readBoolean(value, name2) {
  if (value === void 0 || value === null || value === "") return void 0;
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  throw new HttpError(400, "INVALID_PARAM", `${name2} \u5FC5\u987B\u662F\u5E03\u5C14\u503C`);
}
function clamp5(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function normalizePath(pathname) {
  let path = pathname || "/";
  if (path === API_PREFIX) return "/";
  if (path.startsWith(`${API_PREFIX}/`)) path = path.slice(API_PREFIX.length);
  path = path.replace(/\/+$/, "");
  return path || "/";
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const cleanup = () => {
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
      req.removeListener("error", onError);
    };
    const onData = (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        settled = true;
        cleanup();
        resolve({ ok: false });
        req.resume();
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ ok: true, text: Buffer.concat(chunks).toString("utf8") });
    };
    const onError = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
  });
}
async function readJsonBody(req) {
  const result = await readBody(req);
  if (!result.ok) throw new HttpError(413, "PAYLOAD_TOO_LARGE", "\u8BF7\u6C42\u4F53\u8D85\u8FC7 64KB \u4E0A\u9650");
  const text = result.text.trim();
  if (!text) return {};
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(400, "INVALID_JSON", "\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HttpError(400, "INVALID_BODY", "\u8BF7\u6C42\u4F53\u5FC5\u987B\u662F JSON \u5BF9\u8C61");
  }
  return parsed;
}
function normalizePrice(input) {
  const provider = readString(input.provider, "provider");
  const modelName = readString(input.modelName, "modelName");
  if (!provider) throw new HttpError(400, "MISSING_PARAM", "provider \u5FC5\u586B");
  if (!modelName) throw new HttpError(400, "MISSING_PARAM", "modelName \u5FC5\u586B");
  const numeric = (value, name2, fallback = 0) => {
    const parsed = readNumber(value, name2);
    if (parsed === void 0) return fallback;
    if (parsed < 0) throw new HttpError(400, "INVALID_PARAM", `${name2} \u4E0D\u80FD\u4E3A\u8D1F\u6570`);
    return parsed;
  };
  const unitTokens = readNumber(input.unitTokens, "unitTokens");
  if (unitTokens !== void 0 && unitTokens <= 0) throw new HttpError(400, "INVALID_PARAM", "unitTokens \u5FC5\u987B\u5927\u4E8E 0");
  const price = {
    provider,
    modelName,
    inputPrice: numeric(input.inputPrice, "inputPrice"),
    cacheReadPrice: numeric(input.cacheReadPrice, "cacheReadPrice"),
    cacheWritePrice: numeric(input.cacheWritePrice, "cacheWritePrice"),
    outputPrice: numeric(input.outputPrice, "outputPrice"),
    currency: readString(input.currency, "currency") ?? "CNY",
    unitTokens: unitTokens ?? 1e6,
    effectiveAt: readNumber(input.effectiveAt, "effectiveAt") ?? Date.now()
  };
  const id = readNumber(input.id, "id");
  if (id !== void 0) price.id = id;
  return price;
}
function parseCallQuery(body) {
  const query = {};
  const from = readNumber(body.from, "from");
  if (from !== void 0) query.from = from;
  const to = readNumber(body.to, "to");
  if (to !== void 0) query.to = to;
  const sessionId = readString(body.sessionId, "sessionId");
  if (sessionId !== void 0) query.sessionId = sessionId;
  const taskId = readString(body.taskId, "taskId");
  if (taskId !== void 0) query.taskId = taskId;
  const model = readString(body.model, "model");
  if (model !== void 0) query.model = model;
  const onlyFlagged = readBoolean(body.onlyFlagged, "onlyFlagged");
  if (onlyFlagged !== void 0) query.onlyFlagged = onlyFlagged;
  const limit = readNumber(body.limit, "limit");
  if (limit !== void 0) query.limit = clamp5(Math.trunc(limit), 1, MAX_PAGE3);
  const offset = readNumber(body.offset, "offset");
  if (offset !== void 0) query.offset = Math.max(0, Math.trunc(offset));
  const sort = readString(body.sort, "sort");
  if (sort !== void 0) {
    if (!CALL_SORTS.has(sort)) throw new HttpError(400, "INVALID_PARAM", `sort \u5FC5\u987B\u662F ${[...CALL_SORTS].join("/")}`);
    query.sort = sort;
  }
  const order = readString(body.order, "order");
  if (order !== void 0) {
    if (order !== "asc" && order !== "desc") throw new HttpError(400, "INVALID_PARAM", "order \u5FC5\u987B\u662F asc/desc");
    query.order = order;
  }
  return query;
}
function parseCsvQuery(params) {
  const query = {};
  const from = Number(params.get("from"));
  if (Number.isFinite(from) && params.get("from")) query.from = from;
  const to = Number(params.get("to"));
  if (Number.isFinite(to) && params.get("to")) query.to = to;
  const sessionId = params.get("sessionId");
  if (sessionId) query.sessionId = sessionId;
  const taskId = params.get("taskId");
  if (taskId) query.taskId = taskId;
  const model = params.get("model");
  if (model) query.model = model;
  const flagged = params.get("onlyFlagged");
  if (flagged === "1" || flagged === "true") query.onlyFlagged = true;
  const limit = Number(params.get("limit"));
  if (Number.isFinite(limit) && limit > 0) query.limit = clamp5(Math.trunc(limit), 1, MAX_PAGE3);
  const sort = params.get("sort");
  if (sort && CALL_SORTS.has(sort)) query.sort = sort;
  const order = params.get("order");
  if (order === "asc" || order === "desc") query.order = order;
  return query;
}
function normalizeCompressionPatch(value) {
  const input = asRecord7(value);
  const out = {};
  if (input.mode !== void 0) {
    if (!CACHE_MODES.includes(String(input.mode))) throw new HttpError(400, "INVALID_PARAM", `compression.mode \u5FC5\u987B\u662F ${CACHE_MODES.join("/")}`);
    out.mode = String(input.mode);
  }
  for (const key of ["minBytes", "selectiveBytes", "smartBytes", "maxBlobBytes", "maxCacheMB", "ttlDays", "headLines", "tailLines"]) {
    if (input[key] === void 0) continue;
    const parsed = readNumber(input[key], `compression.${key}`);
    if (parsed === void 0) continue;
    if (parsed < 0) throw new HttpError(400, "INVALID_PARAM", `compression.${key} \u4E0D\u80FD\u4E3A\u8D1F\u6570`);
    out[key] = Math.trunc(parsed);
  }
  if (input.types !== void 0) {
    const types = asRecord7(input.types);
    const normalized = {};
    for (const [key, flag] of Object.entries(types)) {
      const bool = readBoolean(flag, `compression.types.${key}`);
      if (bool !== void 0) normalized[key] = bool;
    }
    out.types = normalized;
  }
  return out;
}
function createHttpApi(deps) {
  let lazyCache = deps.cache ?? null;
  const cacheService = () => {
    if (lazyCache) return lazyCache;
    if (deps.repo && deps.blobStore) {
      lazyCache = createCacheApi({ store: deps.store, settings: deps.settings, repo: deps.repo, blobStore: deps.blobStore });
      return lazyCache;
    }
    throw new HttpError(503, "CACHE_UNAVAILABLE", "\u5DE5\u5177\u7F13\u5B58\u670D\u52A1\u4E0D\u53EF\u7528");
  };
  let lazyLive = null;
  const liveService = () => {
    if (lazyLive) return lazyLive;
    lazyLive = createLiveApi({
      store: deps.store,
      settings: deps.settings,
      costs: deps.costs,
      measureSession: deps.measureSession,
      readContextPressure: deps.readContextPressure,
      cacheStats: () => {
        try {
          return cacheService().stats();
        } catch {
          return {};
        }
      }
    });
    return lazyLive;
  };
  let lazyContext = deps.context ?? null;
  const contextService = () => {
    if (lazyContext) return lazyContext;
    if (deps.analyzer) {
      lazyContext = createContextApi({ store: deps.store, settings: deps.settings, costs: deps.costs, analyzer: deps.analyzer, optimizations: deps.optimizations });
      return lazyContext;
    }
    throw new HttpError(503, "CONTEXT_UNAVAILABLE", "\u4E0A\u4E0B\u6587\u5206\u6790\u670D\u52A1\u4E0D\u53EF\u7528");
  };
  const taskService = () => {
    if (!deps.taskService) throw new HttpError(503, "TASK_SERVICE_UNAVAILABLE", "\u4EFB\u52A1\u670D\u52A1\u4E0D\u53EF\u7528");
    return deps.taskService;
  };
  const projectService = () => {
    if (!deps.projectService) throw new HttpError(503, "PROJECT_SERVICE_UNAVAILABLE", "\u9879\u76EE\u670D\u52A1\u4E0D\u53EF\u7528");
    return deps.projectService;
  };
  const mapServiceError = (error) => {
    if (error instanceof TaskServiceError || error instanceof ProjectServiceError) {
      throw new HttpError(error.code === "NOT_FOUND" ? 404 : 400, error.code, error.message);
    }
    throw error;
  };
  const withTaskService = (fn) => {
    try {
      return fn();
    } catch (error) {
      return mapServiceError(error);
    }
  };
  const recordError = (where, error) => {
    try {
      const message = String(error?.message ?? error).slice(0, 500);
      deps.store.run(
        `INSERT INTO kv(k, v) VALUES ('last_error', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`,
        JSON.stringify({ ts: Date.now(), where, message })
      );
    } catch {
    }
  };
  const latestSessionId = () => {
    try {
      return deps.store.get("SELECT session_id FROM usage_records WHERE turn >= 0 AND source = 'live' ORDER BY ts DESC LIMIT 1")?.session_id ?? null;
    } catch {
      return null;
    }
  };
  const latestTaskId = () => {
    try {
      const byUsage = deps.store.get("SELECT task_id FROM usage_records WHERE task_id IS NOT NULL AND turn >= 0 AND source = 'live' ORDER BY ts DESC LIMIT 1")?.task_id;
      if (byUsage) return byUsage;
      return deps.store.get("SELECT id FROM tasks ORDER BY COALESCE(ended_at, started_at) DESC, started_at DESC LIMIT 1")?.id ?? null;
    } catch {
      return null;
    }
  };
  const latestProjectId = () => {
    try {
      const byUsage = deps.store.get("SELECT t.project_id AS project_id FROM usage_records u JOIN tasks t ON t.id = u.task_id WHERE u.turn >= 0 AND u.source = 'live' AND t.project_id <> '' ORDER BY u.ts DESC LIMIT 1")?.project_id;
      if (byUsage) return byUsage;
      return deps.store.get("SELECT project_id FROM sessions WHERE project_id <> '' ORDER BY last_seen_at DESC LIMIT 1")?.project_id ?? null;
    } catch {
      return null;
    }
  };
  const handle = async (req, res) => {
    const request = req;
    const response = res;
    try {
      let allowed = false;
      try {
        allowed = deps.fence(req) === true;
      } catch {
        allowed = false;
      }
      if (!allowed) {
        sendError(response, 403, "FORBIDDEN", "forbidden");
        return;
      }
      const method = String(request.method ?? "GET").toUpperCase();
      let url;
      try {
        url = new URL(String(request.url ?? "/"), "http://localhost");
      } catch {
        throw new HttpError(400, "INVALID_URL", "\u65E0\u6CD5\u89E3\u6790\u8BF7\u6C42 URL");
      }
      const path = normalizePath(url.pathname);
      await dispatch(method, path, url, request, response);
    } catch (error) {
      recordError("http-api", error);
      if (response.writableEnded) return;
      if (error instanceof HttpError) {
        sendError(response, error.status, error.code, error.message, error.allow);
      } else {
        sendError(response, 500, "INTERNAL", "internal error");
      }
    }
  };
  const dispatch = async (method, path, url, req, res) => {
    if (path.startsWith("/auto/")) {
      if (!deps.autoApi) throw new HttpError(503, "AUTO_UNAVAILABLE", "AUTO \u670D\u52A1\u672A\u5C31\u7EEA");
      const handled = await deps.autoApi.handle(req, res, url);
      if (res.writableEnded) return;
      if (handled) return;
      throw new HttpError(404, "NOT_FOUND", "\u672A\u77E5 AUTO \u8DEF\u7531");
    }
    if (path === "/health") {
      if (method !== "GET" && method !== "POST") throw new HttpError(405, "METHOD_NOT_ALLOWED", "\u4EC5\u652F\u6301 GET/POST", ["GET", "POST"]);
      if (method === "POST") await readJsonBody(req);
      sendOk(res, deps.reports.health());
      return;
    }
    if (path === "/export/calls.csv") {
      if (method !== "GET") throw new HttpError(405, "METHOD_NOT_ALLOWED", "\u4EC5\u652F\u6301 GET", ["GET"]);
      const csv = deps.reports.csvCalls(parseCsvQuery(url.searchParams));
      if (res.writableEnded) return;
      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="token-manager-calls.csv"',
        "Cache-Control": "no-store",
        "Content-Length": Buffer.byteLength(csv)
      });
      res.end(csv);
      return;
    }
    const postRoutes = {
      "/live": () => liveService().summary(),
      "/prices/reference": () => liveService().reference(),
      "/prices/apply-reference": () => liveService().applyReference(),
      "/overview": (body2) => {
        const range = readString(body2.range, "range") ?? "today";
        if (!OVERVIEW_RANGES2.has(range)) throw new HttpError(400, "INVALID_RANGE", `range \u5FC5\u987B\u662F ${[...OVERVIEW_RANGES2].join("/")}`);
        let sessionId = readString(body2.sessionId, "sessionId");
        let taskId = readString(body2.taskId, "taskId");
        let projectId = readString(body2.projectId, "projectId");
        let fallback = false;
        if (range === "session" && !sessionId) {
          sessionId = latestSessionId() ?? void 0;
          fallback = true;
        }
        if (range === "task" && !taskId) {
          taskId = latestTaskId() ?? void 0;
          fallback = true;
        }
        if (range === "project" && !projectId) {
          projectId = latestProjectId() ?? void 0;
          fallback = true;
        }
        const days = readNumber(body2.days, "days");
        const data = deps.reports.overview({ range, sessionId, taskId, projectId, days: days === void 0 ? void 0 : clamp5(Math.trunc(days), 1, 90) });
        return fallback ? { ...data, fallback: true } : data;
      },
      "/calls": (body2) => deps.reports.calls(parseCallQuery(body2)),
      "/tasks": (body2) => {
        const query = {};
        const sessionId = readString(body2.sessionId, "sessionId");
        if (sessionId) query.sessionId = sessionId;
        const projectId = readString(body2.projectId, "projectId");
        if (projectId) query.projectId = projectId;
        const taskType = readString(body2.taskType, "taskType");
        if (taskType) query.taskType = taskType;
        const status = readString(body2.status, "status");
        if (status) query.status = status;
        const limit = readNumber(body2.limit, "limit");
        if (limit !== void 0) query.limit = clamp5(Math.trunc(limit), 1, MAX_PAGE3);
        const offset = readNumber(body2.offset, "offset");
        if (offset !== void 0) query.offset = Math.max(0, Math.trunc(offset));
        return deps.tasks.listTasks(query);
      },
      "/task-report": (body2) => {
        const taskId = readString(body2.taskId, "taskId");
        if (!taskId) throw new HttpError(400, "MISSING_PARAM", "taskId \u5FC5\u586B");
        return deps.reports.taskReport(taskId);
      },
      "/findings": (body2) => {
        const query = {};
        const taskId = readString(body2.taskId, "taskId");
        if (taskId) query.taskId = taskId;
        const sessionId = readString(body2.sessionId, "sessionId");
        if (sessionId) query.sessionId = sessionId;
        const kind = readString(body2.kind, "kind");
        if (kind) query.kind = kind;
        const limit = readNumber(body2.limit, "limit");
        if (limit !== void 0) query.limit = clamp5(Math.trunc(limit), 1, MAX_PAGE3);
        return deps.analytics.findings(query);
      },
      "/baselines": (body2) => {
        const projectId = readString(body2.projectId, "projectId");
        if (readBoolean(body2.recompute, "recompute") === true) deps.baseline.recompute(projectId);
        return deps.baseline.list(projectId);
      },
      "/prices": () => deps.costs.listPrices(),
      "/prices/update": (body2) => {
        const price = normalizePrice(asRecord7(body2.price ?? body2));
        deps.costs.upsertPrice(price);
        return deps.costs.listPrices();
      },
      "/prices/delete": (body2) => {
        const id = readNumber(body2.id, "id");
        if (id === void 0) throw new HttpError(400, "MISSING_PARAM", "id \u5FC5\u586B");
        const before = deps.costs.listPrices().length;
        deps.costs.deletePrice(id);
        const after = deps.costs.listPrices().length;
        return { deleted: Math.max(0, before - after) };
      },
      "/prices/import": (body2) => {
        const prices = Array.isArray(body2.prices) ? body2.prices : [];
        if (prices.length === 0) throw new HttpError(400, "INVALID_PARAM", "prices \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4");
        if (prices.length > MAX_PAGE3) throw new HttpError(400, "INVALID_PARAM", `prices \u6700\u591A ${MAX_PAGE3} \u6761`);
        const normalized = prices.map((entry) => normalizePrice(asRecord7(entry)));
        const imported = deps.costs.importPrices(normalized);
        return { imported };
      },
      "/settings": () => deps.settings.get(),
      "/settings/update": (body2) => {
        if (readBoolean(body2.reset, "reset") === true) return deps.settings.reset();
        const patch = { ...asRecord7(body2.patch ?? body2) };
        if (patch.compression !== void 0) {
          if (!patch.compression || typeof patch.compression !== "object" || Array.isArray(patch.compression)) throw new HttpError(400, "INVALID_PARAM", "compression \u5FC5\u987B\u662F\u5BF9\u8C61");
          patch.compression = normalizeCompressionPatch(patch.compression);
        }
        return deps.settings.update(patch);
      },
      "/cache/list": (body2) => {
        const query = {};
        const limit = readNumber(body2.limit, "limit");
        if (limit !== void 0) query.limit = clamp5(Math.trunc(limit), 1, 200);
        const offset = readNumber(body2.offset, "offset");
        if (offset !== void 0) query.offset = Math.max(0, Math.trunc(offset));
        const sessionId = readString(body2.sessionId, "sessionId");
        if (sessionId) query.sessionId = sessionId;
        const tool = readString(body2.tool ?? body2.toolName, "tool");
        if (tool) query.tool = tool;
        const recoverable = readBoolean(body2.recoverable, "recoverable");
        if (recoverable !== void 0) query.recoverable = recoverable;
        return cacheService().list(query);
      },
      "/cache/stats": () => cacheService().stats(),
      "/cache/read": (body2) => {
        const blobId = readString(body2.blobId, "blobId");
        if (!blobId) throw new HttpError(400, "MISSING_PARAM", "blobId \u5FC5\u586B");
        const sessionId = readString(body2.sessionId, "sessionId");
        const offset = readNumber(body2.offset, "offset");
        const limit = readNumber(body2.limit, "limit");
        return cacheService().readPreview(blobId, sessionId ?? null, {
          offset: offset === void 0 ? void 0 : Math.max(0, Math.trunc(offset)),
          limit: limit === void 0 ? void 0 : clamp5(Math.trunc(limit), 1, 256 * 1024)
        });
      },
      "/cache/verify": () => cacheService().verify(),
      "/cache/clear": () => cacheService().clear(),
      "/context/analyze": (body2) => {
        const sessionId = readString(body2.sessionId, "sessionId");
        return contextService().analyze({ sessionId });
      },
      "/context/optimize": (body2) => {
        const sessionId = readString(body2.sessionId, "sessionId");
        return contextService().optimize({ sessionId });
      },
      "/optimizations/list": (body2) => {
        const query = {};
        const sessionId = readString(body2.sessionId, "sessionId");
        if (sessionId) query.sessionId = sessionId;
        const limit = readNumber(body2.limit, "limit");
        if (limit !== void 0) query.limit = clamp5(Math.trunc(limit), 1, MAX_PAGE3);
        const offset = readNumber(body2.offset, "offset");
        if (offset !== void 0) query.offset = Math.max(0, Math.trunc(offset));
        return contextService().listOptimizations(query);
      },
      "/context/stats": () => contextService().stats(),
      "/sessions": (body2) => {
        const limit = readNumber(body2.limit, "limit");
        return deps.reports.sessions(limit === void 0 ? 100 : clamp5(Math.trunc(limit), 1, MAX_PAGE3));
      },
      "/tasks/create": (body2) => withTaskService(() => {
        const name2 = readString(body2.name, "name");
        if (!name2) throw new HttpError(400, "MISSING_PARAM", "name \u5FC5\u586B");
        return taskService().create({ name: name2, taskType: readString(body2.taskType, "taskType"), sessionId: readString(body2.sessionId, "sessionId"), projectId: readString(body2.projectId, "projectId") });
      }),
      "/tasks/update": (body2) => withTaskService(() => {
        const id = readString(body2.id, "id");
        if (!id) throw new HttpError(400, "MISSING_PARAM", "id \u5FC5\u586B");
        const patch = {};
        const name2 = readString(body2.name, "name");
        if (name2 !== void 0) patch.name = name2;
        const taskType = readString(body2.taskType, "taskType");
        if (taskType !== void 0) patch.taskType = taskType;
        const status = readString(body2.status, "status");
        if (status !== void 0) patch.status = status;
        if (body2.summary !== void 0) patch.summary = body2.summary;
        return taskService().update(id, patch);
      }),
      "/tasks/merge": (body2) => withTaskService(() => {
        const ids = Array.isArray(body2.ids) ? body2.ids.filter((value) => typeof value === "string" && value.trim().length > 0).map((value) => value.trim()) : [];
        if (ids.length < 2) throw new HttpError(400, "INVALID_PARAM", "ids \u81F3\u5C11\u5305\u542B 2 \u4E2A\u4EFB\u52A1");
        return taskService().merge({ ids, name: readString(body2.name, "name"), taskType: readString(body2.taskType, "taskType") });
      }),
      "/tasks/detail": (body2) => withTaskService(() => {
        const id = readString(body2.id, "id");
        if (!id) throw new HttpError(400, "MISSING_PARAM", "id \u5FC5\u586B");
        return taskService().detail(id);
      }),
      "/tasks/summary/update": (body2) => withTaskService(() => {
        const id = readString(body2.id, "id");
        if (!id) throw new HttpError(400, "MISSING_PARAM", "id \u5FC5\u586B");
        if (!body2.summary || typeof body2.summary !== "object" || Array.isArray(body2.summary)) throw new HttpError(400, "INVALID_PARAM", "summary \u5FC5\u987B\u662F\u5BF9\u8C61");
        return taskService().updateSummary(id, body2.summary);
      }),
      "/tasks/export": (body2) => withTaskService(() => {
        const id = readString(body2.id, "id");
        if (!id) throw new HttpError(400, "MISSING_PARAM", "id \u5FC5\u586B");
        const format = readString(body2.format, "format") ?? "json";
        if (format !== "json" && format !== "markdown" && format !== "csv") throw new HttpError(400, "INVALID_PARAM", "format \u5FC5\u987B\u662F json/markdown/csv");
        return taskService().exportTask(id, format);
      }),
      "/projects/list": () => withTaskService(() => projectService().list()),
      "/projects/summary": (body2) => withTaskService(() => {
        const projectId = readString(body2.projectId, "projectId");
        if (!projectId) throw new HttpError(400, "MISSING_PARAM", "projectId \u5FC5\u586B");
        return projectService().summary(projectId);
      }),
      "/projects/summary/update": (body2) => withTaskService(() => {
        const projectId = readString(body2.projectId, "projectId");
        if (!projectId) throw new HttpError(400, "MISSING_PARAM", "projectId \u5FC5\u586B");
        if (!body2.summary || typeof body2.summary !== "object" || Array.isArray(body2.summary)) throw new HttpError(400, "INVALID_PARAM", "summary \u5FC5\u987B\u662F\u5BF9\u8C61");
        return projectService().update(projectId, body2.summary);
      }),
      "/projects/export": (body2) => withTaskService(() => {
        const projectId = readString(body2.projectId, "projectId");
        if (!projectId) throw new HttpError(400, "MISSING_PARAM", "projectId \u5FC5\u586B");
        const format = readString(body2.format, "format") ?? "json";
        if (format !== "json" && format !== "markdown") throw new HttpError(400, "INVALID_PARAM", "format \u5FC5\u987B\u662F json/markdown");
        return projectService().exportSummary(projectId, format);
      }),
      "/import": (body2) => {
        const mode = readString(body2.mode, "mode") ?? "projcache";
        if (mode === "inspect") return deps.importer.inspect();
        if (mode === "crosscheck") {
          const sessionId = readString(body2.sessionId, "sessionId");
          if (!sessionId) throw new HttpError(400, "MISSING_PARAM", "crosscheck \u9700\u8981 sessionId");
          return deps.importer.crossCheckSession(sessionId);
        }
        const limit = readNumber(body2.limit, "limit");
        return deps.importer.importFromProjectionCache(limit === void 0 ? 200 : clamp5(Math.trunc(limit), 1, 1e3));
      }
    };
    const handler = postRoutes[path];
    if (!handler) throw new HttpError(404, "NOT_FOUND", "\u672A\u77E5\u8DEF\u7531");
    if (method !== "POST") throw new HttpError(405, "METHOD_NOT_ALLOWED", "\u4EC5\u652F\u6301 POST", ["POST"]);
    const body = await readJsonBody(req);
    sendOk(res, handler(body));
  };
  return { handle };
}

// src/host/importer.ts
import { existsSync as existsSync2, readdirSync as readdirSync2, readFileSync as readFileSync2, statSync as statSync2 } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { join as join3 } from "node:path";
var DEFAULT_LIMIT = 200;
var MAX_LIMIT = 2e3;
function asRecord8(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function num9(value, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function clamp6(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function resolveSessionsDir(dataRoot) {
  const candidates = [];
  if (dataRoot && dataRoot.trim()) {
    const root = dataRoot.trim();
    candidates.push(root, join3(root, "sessions"), join3(root, "session_projcache", "sessions"), join3(root, "storages", "session_projcache", "sessions"));
  }
  const home = process.env.DSH_HOME?.trim() || join3(homedir2(), ".dsh");
  candidates.push(join3(home, "storages", "session_projcache", "sessions"));
  for (const candidate of candidates) {
    try {
      if (!statSync2(candidate).isDirectory()) continue;
      const hasJson = readdirSync2(candidate, { withFileTypes: true }).some((entry) => entry.isFile() && entry.name.endsWith(".json"));
      if (hasJson) return candidate;
    } catch {
    }
  }
  return candidates[candidates.length - 1];
}
function listProjectionFiles(dir) {
  try {
    const files = [];
    for (const entry of readdirSync2(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) continue;
      const path = join3(dir, entry.name);
      let mtimeMs = 0;
      try {
        mtimeMs = statSync2(path).mtimeMs;
      } catch {
        mtimeMs = 0;
      }
      files.push({ name: entry.name, path, mtimeMs });
    }
    files.sort((a, b) => b.mtimeMs - a.mtimeMs || a.name.localeCompare(b.name));
    return files;
  } catch {
    return [];
  }
}
function readProjection(path) {
  try {
    const parsed = asRecord8(JSON.parse(readFileSync2(path, "utf8")));
    const record = asRecord8(parsed.record);
    return { identity: asRecord8(record.identity), rows: asRecord8(record.rows) };
  } catch {
    return null;
  }
}
function sessionIdOf2(fileName) {
  return fileName.replace(/\.json$/i, "");
}
function totalsOf(rows) {
  const tokenUsage = asRecord8(rows.tokenUsage);
  const totals = asRecord8(asRecord8(tokenUsage.val).totals);
  if (Object.keys(totals).length === 0) return null;
  const input = num9(totals.uncachedInputTokens);
  const cacheRead = num9(totals.cacheReadTokens);
  const cacheWrite = num9(totals.cacheWriteTokens);
  const output = num9(totals.outputTokens);
  return { input, cacheRead, cacheWrite, output, total: input + cacheRead + cacheWrite + output };
}
function modelOf(rows) {
  const lastUsed = asRecord8(asRecord8(asRecord8(rows.modelSelection).val).lastUsed);
  return {
    provider: typeof lastUsed.provider === "string" ? lastUsed.provider : null,
    model: typeof lastUsed.model === "string" ? lastUsed.model : null
  };
}
function projectIdOf2(cwd) {
  return cwd && cwd.trim() ? cwd.trim() : "unknown";
}
function createImporter(deps) {
  const { store } = deps;
  let resolvedDir = null;
  const sessionsDir = () => {
    if (resolvedDir === null) resolvedDir = resolveSessionsDir(deps.dataRoot);
    return resolvedDir;
  };
  const writeKv = (key, value) => {
    try {
      store.run(`INSERT INTO kv(k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`, key, value);
    } catch {
    }
  };
  const upsertSession = (input) => {
    store.run(
      `INSERT INTO sessions(session_id, project_id, cwd, parent_session_id, origin, agent_preset, created_at, last_seen_at, is_subagent)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         last_seen_at = MAX(sessions.last_seen_at, excluded.last_seen_at),
         cwd = COALESCE(sessions.cwd, excluded.cwd),
         project_id = CASE WHEN sessions.project_id IN ('', 'unknown') THEN excluded.project_id ELSE sessions.project_id END,
         origin = COALESCE(sessions.origin, excluded.origin),
         agent_preset = COALESCE(sessions.agent_preset, excluded.agent_preset),
         is_subagent = CASE WHEN excluded.is_subagent = 1 THEN 1 ELSE sessions.is_subagent END`,
      input.sessionId,
      projectIdOf2(input.cwd),
      input.cwd,
      input.origin,
      input.agentPreset,
      Math.trunc(input.createdAt),
      Math.trunc(input.lastSeenAt),
      input.isSubagent
    );
  };
  const upsertImportedUsage = (input) => {
    store.run(
      `INSERT INTO usage_records(session_id, task_id, turn, step, attempt, is_final, provider, model, reasoning_effort,
                                 input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, reasoning_tokens,
                                 total_tokens, duration_ms, ts, message_id, source)
       VALUES (?, NULL, -1, -1, 1, 1, ?, ?, NULL, ?, ?, ?, ?, NULL, ?, NULL, ?, NULL, 'import')
       ON CONFLICT(session_id, turn, step, attempt) DO UPDATE SET
         provider = excluded.provider,
         model = excluded.model,
         input_tokens = excluded.input_tokens,
         cache_read_tokens = excluded.cache_read_tokens,
         cache_write_tokens = excluded.cache_write_tokens,
         output_tokens = excluded.output_tokens,
         total_tokens = excluded.total_tokens,
         ts = excluded.ts,
         is_final = 1,
         source = 'import'`,
      input.sessionId,
      input.provider,
      input.model,
      input.totals.input,
      input.totals.cacheRead,
      input.totals.cacheWrite,
      input.totals.output,
      input.totals.total,
      Math.trunc(input.ts)
    );
  };
  const inspect = () => {
    const dir = sessionsDir();
    const files = listProjectionFiles(dir);
    const projections = /* @__PURE__ */ new Set();
    for (const file of files.slice(0, 30)) {
      const projection = readProjection(file.path);
      if (!projection) continue;
      for (const key of Object.keys(projection.rows)) projections.add(key);
    }
    return { sessions: files.length, projections: [...projections].sort() };
  };
  const importFromProjectionCache = (limit) => {
    const dir = sessionsDir();
    const take = clamp6(Math.trunc(num9(limit, DEFAULT_LIMIT)) || DEFAULT_LIMIT, 1, MAX_LIMIT);
    const files = listProjectionFiles(dir).slice(0, take);
    let sessions = 0;
    let usageRows = 0;
    let skippedSeeded = 0;
    let skippedInvalid = 0;
    const runImport = () => {
      for (const file of files) {
        const projection = readProjection(file.path);
        if (!projection) {
          skippedInvalid += 1;
          continue;
        }
        const identity = projection.identity;
        const rows = projection.rows;
        const cwd = typeof identity.cwd === "string" ? identity.cwd : null;
        const createdAt = num9(identity.createdAt, file.mtimeMs || Date.now());
        const sessionListMetadata = asRecord8(asRecord8(rows.sessionListMetadata).val);
        const lastPromptAt = num9(sessionListMetadata.lastPromptAt, 0);
        const lastSeenAt = Math.max(createdAt, lastPromptAt, file.mtimeMs || 0, createdAt);
        const agentPreset = typeof asRecord8(rows.agentPreset).val === "string" ? asRecord8(rows.agentPreset).val : null;
        const hasSubagentRow = Object.keys(asRecord8(rows.subagent)).length > 0;
        upsertSession({
          sessionId: sessionIdOf2(file.name),
          cwd,
          createdAt,
          lastSeenAt,
          agentPreset,
          origin: hasSubagentRow ? "subagent" : null,
          isSubagent: hasSubagentRow ? 1 : 0
        });
        sessions += 1;
        if (identity.isSeeded === true) {
          skippedSeeded += 1;
          continue;
        }
        const totals = totalsOf(rows);
        if (!totals) continue;
        const model = modelOf(rows);
        upsertImportedUsage({
          sessionId: sessionIdOf2(file.name),
          provider: model.provider,
          model: model.model,
          totals,
          // 导入汇总行的 ts 用会话创建时间 identity.createdAt：供「全部」趋势按会话创建日期分组，
          // 若写导入时间，219 条历史会全部堆在导入当天。
          ts: createdAt
        });
        usageRows += 1;
      }
    };
    try {
      store.tx(runImport);
    } catch {
      sessions = 0;
      usageRows = 0;
      skippedSeeded = 0;
      skippedInvalid = 0;
      runImport();
    }
    writeKv(
      "last_import",
      JSON.stringify({
        at: Date.now(),
        root: dir,
        files: files.length,
        sessions,
        usageRows,
        skippedSeeded,
        skippedInvalid
      })
    );
    return { sessions, calls: usageRows };
  };
  const ledgerTotals = (sessionId) => {
    const row = store.get(
      `SELECT SUM(input_tokens) AS input_tokens,
              SUM(cache_read_tokens) AS cache_read_tokens,
              SUM(cache_write_tokens) AS cache_write_tokens,
              SUM(output_tokens) AS output_tokens,
              SUM(total_tokens) AS total_tokens
         FROM usage_records
        WHERE session_id = ? AND is_final = 1 AND turn >= 0`,
      sessionId
    );
    return {
      inputTokens: num9(row?.input_tokens),
      cacheReadTokens: num9(row?.cache_read_tokens),
      cacheWriteTokens: num9(row?.cache_write_tokens),
      outputTokens: num9(row?.output_tokens),
      totalTokens: num9(row?.total_tokens),
      reasoningTokens: null
    };
  };
  const findProjectionFile = (dir, sessionId) => {
    for (const file of listProjectionFiles(dir)) {
      if (sessionIdOf2(file.name) === sessionId) return file;
    }
    const candidates = [`${sessionId}.json`, `session-${sessionId}.json`];
    for (const candidate of candidates) {
      const path = join3(dir, candidate);
      if (existsSync2(path)) return { name: candidate, path, mtimeMs: 0 };
    }
    return null;
  };
  const crossCheckSession = (sessionId) => {
    const ledgerTokens = ledgerTotals(sessionId);
    let officialTotals = null;
    let seeded = false;
    try {
      const file = findProjectionFile(sessionsDir(), sessionId);
      if (file) {
        const projection = readProjection(file.path);
        if (projection) {
          seeded = projection.identity.isSeeded === true;
          if (!seeded) officialTotals = totalsOf(projection.rows);
        }
      }
    } catch {
      officialTotals = null;
    }
    const officialTokens = officialTotals ? officialTotals.total : null;
    const equal = officialTotals !== null && ledgerTokens.inputTokens === officialTotals.input && ledgerTokens.cacheReadTokens === officialTotals.cacheRead && ledgerTokens.cacheWriteTokens === officialTotals.cacheWrite && ledgerTokens.outputTokens === officialTotals.output && ledgerTokens.totalTokens === officialTotals.total;
    writeKv(
      "crosscheck:last",
      JSON.stringify({
        at: Date.now(),
        sessionId,
        ledger: ledgerTokens,
        official: officialTotals,
        seeded,
        equal
      })
    );
    return { ledgerTokens, officialTokens, equal };
  };
  return { inspect, importFromProjectionCache, crossCheckSession };
}

// src/host/read-tool.ts
import { readFileSync as readFileSync3 } from "node:fs";
import { isAbsolute as isAbsolute2, normalize, sep } from "node:path";
var DEFAULT_MAX_CHARS = 8e3;
var HARD_MAX_CHARS = 32e3;
var DEFAULT_LINES = 200;
var HARD_MAX_LINES = 2e3;
var MAX_PATH_BYTES = 1024 * 1024;
function clampInt(value, fallback, min, max) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
function emptyResult(message, offset = 0) {
  return {
    found: false,
    blobId: null,
    hash: null,
    contentType: null,
    byteSize: null,
    offset,
    endOffset: offset,
    totalBytes: null,
    nextOffset: null,
    text: "",
    message
  };
}
function sliceLines(text, fromLine, lines, maxChars) {
  const all = text.split("\n");
  const totalLines = all.length;
  const start = Math.min(Math.max(0, fromLine - 1), Math.max(0, totalLines - 1));
  const end = Math.min(totalLines, start + lines);
  let chunk = all.slice(start, end).join("\n");
  let truncated = false;
  if (chunk.length > maxChars) {
    chunk = chunk.slice(0, maxChars);
    truncated = true;
  }
  return { text: chunk, endLine: end, totalLines, truncated };
}
function createReadService(deps) {
  const { blobStore, repo } = deps;
  return {
    async read(request) {
      const maxChars = clampInt(request.maxChars, DEFAULT_MAX_CHARS, 200, HARD_MAX_CHARS);
      if (!request.blobId && request.path) {
        const cwd = typeof request.cwd === "string" && request.cwd.trim() ? request.cwd.trim() : null;
        if (!cwd) return emptyResult("\u672A\u63D0\u4F9B\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\uFF0C\u65E0\u6CD5\u6309\u8DEF\u5F84\u8BFB\u53D6\uFF08\u8BF7\u6539\u7528 blobId\uFF09");
        const path = isAbsolute2(request.path) ? normalize(request.path) : normalize(`${cwd}${sep}${request.path}`);
        const root = normalize(cwd);
        if (!(path === root || path.startsWith(root.endsWith(sep) ? root : root + sep))) {
          return emptyResult("\u8DEF\u5F84\u4E0D\u5728\u5F53\u524D\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u5185\uFF0C\u62D2\u7EDD\u8BFB\u53D6");
        }
        try {
          const buf = readFileSync3(path);
          if (buf.byteLength > MAX_PATH_BYTES) {
            return emptyResult(`\u6587\u4EF6\u8FC7\u5927\uFF08${buf.byteLength} \u5B57\u8282\uFF09\uFF0C\u8BF7\u4F7F\u7528 blobId \u5206\u7247\u8BFB\u53D6`);
          }
          const text2 = buf.subarray(0, maxChars).toString("utf8");
          return {
            found: true,
            blobId: null,
            hash: null,
            contentType: "file",
            byteSize: buf.byteLength,
            offset: 0,
            endOffset: Buffer.byteLength(text2, "utf8"),
            totalBytes: buf.byteLength,
            nextOffset: buf.byteLength > maxChars ? Buffer.byteLength(text2, "utf8") : null,
            text: text2,
            message: `\u5DF2\u8BFB\u53D6\u6587\u4EF6 ${path}`
          };
        } catch (error) {
          return emptyResult(`\u6309\u8DEF\u5F84\u8BFB\u53D6\u5931\u8D25\uFF1A${String(error?.message ?? error)}`);
        }
      }
      const blobId = typeof request.blobId === "string" ? request.blobId.trim() : "";
      if (!blobId) return emptyResult("\u9700\u8981\u63D0\u4F9B blobId\uFF08\u6216 path\uFF09");
      const owned = repo.blobForSession(blobId, request.sessionId ?? null);
      if (!owned) return emptyResult(`\u672A\u627E\u5230\u53EF\u6062\u590D\u5185\u5BB9\uFF1A${blobId}\uFF08\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u4F1A\u8BDD\uFF09`);
      let meta = null;
      try {
        meta = blobStore.stat(blobId);
      } catch {
        meta = null;
      }
      if (!meta) return emptyResult(`\u7F13\u5B58\u6587\u4EF6\u7F3A\u5931\uFF1A${blobId}`);
      try {
        repo.markAccessed(blobId);
      } catch {
      }
      const full = blobStore.getText(blobId);
      const totalBytes = Buffer.byteLength(full, "utf8");
      if (typeof request.lines === "number" && request.lines > 0) {
        const fromLine = clampInt(request.offset ?? 1, 1, 1, Number.MAX_SAFE_INTEGER);
        const lines = clampInt(request.lines, DEFAULT_LINES, 1, HARD_MAX_LINES);
        const slice = sliceLines(full, fromLine, lines, maxChars);
        const nextLine = slice.endLine < slice.totalLines ? slice.endLine + 1 : null;
        return {
          found: true,
          blobId,
          hash: meta.hash,
          contentType: meta.contentType,
          byteSize: meta.byteSize,
          offset: fromLine,
          endOffset: slice.endLine,
          totalBytes,
          nextOffset: nextLine,
          text: slice.text,
          message: `\u7B2C ${fromLine}-${slice.endLine} \u884C / \u5171 ${slice.totalLines} \u884C${slice.truncated ? "\uFF08\u5DF2\u6309 maxChars \u622A\u65AD\uFF09" : ""}`
        };
      }
      const offset = clampInt(request.offset, 0, 0, Math.max(0, totalBytes));
      const start = Math.max(0, Math.min(offset, totalBytes));
      const tail = Buffer.from(full, "utf8").subarray(start).toString("utf8");
      const text = tail.slice(0, maxChars);
      const endOffset = start + Buffer.byteLength(text, "utf8");
      return {
        found: true,
        blobId,
        hash: meta.hash,
        contentType: meta.contentType,
        byteSize: meta.byteSize,
        offset: start,
        endOffset,
        totalBytes,
        nextOffset: endOffset < totalBytes ? endOffset : null,
        text,
        message: `\u5B57\u8282 ${start}-${endOffset} / \u5171 ${totalBytes} \u5B57\u8282`
      };
    }
  };
}
function createReadToolDefinition(deps) {
  const { service } = deps;
  return {
    name: "token_manager_read",
    description: "Read the original content behind a [Token Manager] summary. Use blobId from the summary; omit lines for a byte-range read (offset is a byte offset), or pass lines/offset to read by line range (offset is the 1-based first line). Returns at most maxChars characters and a nextOffset for continuing. Use it whenever the summary is not enough to finish the task.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        blobId: {
          type: "string",
          description: 'Blob ID printed in the [Token Manager] summary, e.g. "abc123...".'
        },
        path: {
          type: "string",
          description: "Optional file path (relative to the session working directory) to read instead of a blob."
        },
        offset: {
          type: "number",
          description: "Byte offset (default) or 1-based line number when lines is set."
        },
        lines: {
          type: "number",
          description: "Read this many lines starting at offset (line mode)."
        },
        maxChars: {
          type: "number",
          description: "Maximum characters to return (default 8000, max 32000)."
        }
      },
      required: []
    },
    output: {
      // Canonical value uses only concrete JSON types: `ctx.tools.register` validates this
      // schema strictly and does not accept ValueSchemaSpec property-level `required`.
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          found: { type: "boolean" },
          blobId: { type: "string" },
          hash: { type: "string" },
          contentType: { type: "string" },
          byteSize: { type: "integer" },
          offset: { type: "integer" },
          endOffset: { type: "integer" },
          totalBytes: { type: "integer" },
          nextOffset: { type: "integer" },
          text: { type: "string" },
          message: { type: "string" }
        },
        required: [
          "found",
          "blobId",
          "hash",
          "contentType",
          "byteSize",
          "offset",
          "endOffset",
          "totalBytes",
          "nextOffset",
          "text",
          "message"
        ]
      },
      render(_args, value) {
        const blocks = [];
        blocks.push({ type: "text", text: `[token_manager_read] ${String(value.message ?? "")}` });
        if (value.found !== true) return blocks;
        if (typeof value.text === "string" && value.text.length > 0) blocks.push({ type: "text", text: value.text });
        const next = typeof value.nextOffset === "number" ? value.nextOffset : -1;
        if (next >= 0) {
          blocks.push({
            type: "text",
            text: `[token_manager_read] \u8FD8\u6709\u66F4\u591A\u5185\u5BB9\uFF0Coffset=${next}\uFF1B\u518D\u6B21\u8C03\u7528\u5E76\u4F20\u5165 offset=${next} \u7EE7\u7EED\u8BFB\u53D6\u3002`
          });
        }
        return blocks;
      }
    },
    async execute(args, exec) {
      const session = exec?.agent?.session;
      const sessionId = session?.id ? String(session.id) : null;
      const cwd = session?.header?.cwd && typeof session.header.cwd === "string" ? session.header.cwd : null;
      const result = await service.read({
        blobId: typeof args.blobId === "string" ? args.blobId : void 0,
        path: typeof args.path === "string" ? args.path : void 0,
        offset: typeof args.offset === "number" ? args.offset : void 0,
        lines: typeof args.lines === "number" ? args.lines : void 0,
        maxChars: typeof args.maxChars === "number" ? args.maxChars : void 0,
        sessionId,
        cwd
      });
      return {
        found: result.found === true,
        blobId: result.blobId ?? "",
        hash: result.hash ?? "",
        contentType: result.contentType ?? "",
        byteSize: typeof result.byteSize === "number" ? result.byteSize : -1,
        offset: Math.trunc(result.offset),
        endOffset: Math.trunc(result.endOffset),
        totalBytes: typeof result.totalBytes === "number" ? result.totalBytes : -1,
        nextOffset: typeof result.nextOffset === "number" ? Math.trunc(result.nextOffset) : -1,
        text: String(result.text ?? ""),
        message: String(result.message ?? "")
      };
    }
  };
}

// src/host/context-analyzer.ts
import { createHash as createHash4 } from "node:crypto";
var RECOMMEND_MIN_TOKENS = 512;
function asRecord9(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function num10(value, fallback) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function numOrNull2(value) {
  if (value === null || value === void 0) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}
function textOf2(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const parts = [];
    for (const block of value) {
      if (typeof block === "string") {
        parts.push(block);
        continue;
      }
      const record2 = asRecord9(block);
      if (typeof record2.text === "string") parts.push(record2.text);
      else if (typeof record2.content === "string") parts.push(record2.content);
    }
    return parts.join("\n");
  }
  const record = asRecord9(value);
  if (typeof record.text === "string") return record.text;
  if (typeof record.content === "string") return record.content;
  if (Array.isArray(record.content)) return textOf2(record.content);
  return "";
}
function roleFromType(type) {
  if (type.startsWith("user/")) return "user";
  if (type.startsWith("assistant/")) return "assistant";
  if (type.startsWith("tool/")) return "tool";
  if (type.startsWith("system/")) return "system";
  return "unknown";
}
function shorten(text, limit = 48) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const base = clean.split(/[\\/]/).pop() ?? clean;
  return base.length <= limit ? base : `${base.slice(0, limit - 1)}\u2026`;
}
function argumentFeature(args) {
  const record = asRecord9(args);
  for (const key of ["path", "file_path", "filePath", "targetPath", "target_path", "command", "cmd", "pattern", "url", "query", "name"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return shorten(value);
  }
  for (const value of Object.values(record)) {
    if (typeof value === "string" && value.trim()) return shorten(value);
  }
  return "";
}
function isProtectedRole(role) {
  return CONTEXT_PROTECTED_ROLES.includes(String(role).toLowerCase());
}
function isProtectedSource(source) {
  const value = String(source ?? "");
  return CONTEXT_PROTECTED_SOURCES.includes(value) || /^plugin:dsh-mnemon$/i.test(value);
}
function emptyBreakdown() {
  return { nodes: 0, tokens: 0, byRole: {}, bySource: {} };
}
function createContextAnalyzer(deps) {
  const estimator = createKvRiskEstimator({ settings: deps.settings, costs: deps.costs });
  const optimizations = deps.optimizations ?? deps.repository ?? null;
  const recordError = (where, error) => {
    try {
      const message = String(error?.message ?? error).slice(0, 500);
      deps.store.metaSet("context_last_error", JSON.stringify({ ts: Date.now(), where, message }));
    } catch {
    }
  };
  const contextSettings = () => {
    try {
      return resolveContextSettings(deps.settings);
    } catch {
      return resolveContextSettings({ get: () => ({}) });
    }
  };
  const emptyAnalysis2 = (sessionId, mode) => ({
    sessionId,
    found: false,
    surface: emptyBreakdown(),
    candidates: [],
    totals: { candidateCount: 0, potentialSavingsTokens: 0, riskyCount: 0 },
    mode,
    analyzedAt: Date.now(),
    readOnly: true
  });
  const nodesOf = (session) => {
    const surface = asRecord9(asRecord9(session).surface);
    return Array.isArray(surface.nodes) ? surface.nodes : [];
  };
  const seqOfNode = (node, index) => {
    if (typeof node === "number" && Number.isFinite(node)) return Math.trunc(node);
    const record = asRecord9(node);
    for (const key of ["seq", "eventSeq", "id", "key"]) {
      const value = numOrNull2(record[key]);
      if (value !== null) return value;
    }
    return index + 1;
  };
  const eventOf = (session, seq, node) => {
    const sessionRecord = asRecord9(session);
    for (const method of ["eventAt", "event", "getEvent", "readEvent"]) {
      const fn = sessionRecord[method];
      if (typeof fn !== "function") continue;
      try {
        const event = fn.call(session, seq);
        if (event && typeof event === "object") return asRecord9(event);
      } catch (error) {
        recordError(`eventAt:${seq}`, error);
      }
    }
    const nodeRecord = asRecord9(node);
    if (typeof nodeRecord.type === "string") return nodeRecord;
    if (nodeRecord.event && typeof nodeRecord.event === "object") return asRecord9(nodeRecord.event);
    return {};
  };
  const readMeasurement = (session) => {
    const tokensBySeq = /* @__PURE__ */ new Map();
    const measure = deps.measureSession;
    if (typeof measure !== "function") return { tokensBySeq, totalTokens: null };
    try {
      const result = asRecord9(measure(session));
      const nodes = Array.isArray(result.nodes) ? result.nodes : [];
      for (const node of nodes) {
        const record = asRecord9(node);
        const seq = numOrNull2(record.seq);
        const tokens = num10(record.tokens, NaN);
        if (seq !== null && Number.isFinite(tokens) && tokens > 0) tokensBySeq.set(seq, Math.max(1, Math.trunc(tokens)));
      }
      const total = num10(result.totalTokens, NaN);
      return { tokensBySeq, totalTokens: Number.isFinite(total) && total > 0 ? Math.trunc(total) : null };
    } catch (error) {
      recordError("measureSession", error);
      return { tokensBySeq, totalTokens: null };
    }
  };
  const classifyNode = (session, node, index, tokensBySeq) => {
    const seq = seqOfNode(node, index) ?? index + 1;
    const event = eventOf(session, seq, node);
    const data = asRecord9(event.data);
    const message = asRecord9(data.message);
    const sourceRecord = asRecord9(message.source);
    const dataSource = asRecord9(data.source);
    const type = typeof event.type === "string" ? event.type : typeof asRecord9(node).type === "string" ? String(asRecord9(node).type) : "unknown";
    const roleValue = typeof message.role === "string" ? message.role : typeof data.role === "string" ? data.role : roleFromType(type);
    const role = String(roleValue).toLowerCase();
    let source = typeof sourceRecord.kind === "string" ? sourceRecord.kind : typeof dataSource.kind === "string" ? dataSource.kind : "";
    if (!source) source = role === "tool" ? "tool" : role === "user" ? "user" : role === "assistant" ? "model" : "unknown";
    const text = textOf2(message.content) || textOf2(data.content) || (typeof data.text === "string" ? data.text : "") || "";
    const callId = typeof sourceRecord.callId === "string" ? sourceRecord.callId : typeof data.callId === "string" ? data.callId : null;
    const toolName = typeof data.name === "string" ? data.name : typeof data.toolName === "string" ? data.toolName : typeof message.name === "string" ? message.name : null;
    const argsFeature = toolName ? argumentFeature(data.arguments ?? data.args ?? message.arguments) : null;
    const measured = tokensBySeq.get(seq);
    const tokens = measured !== void 0 ? measured : text.length > 0 ? Math.max(1, Math.ceil(text.length / 4)) : 0;
    const provider = typeof sourceRecord.provider === "string" ? sourceRecord.provider : typeof data.provider === "string" ? data.provider : null;
    const model = typeof sourceRecord.model === "string" ? sourceRecord.model : typeof data.model === "string" ? data.model : null;
    return {
      seq,
      index,
      eventType: type,
      role,
      source,
      turn: numOrNull2(data.turn) ?? numOrNull2(message.turn),
      step: numOrNull2(data.step) ?? numOrNull2(message.step),
      text,
      bytes: Buffer.byteLength(text, "utf8"),
      tokens,
      callId,
      toolName,
      argsFeature,
      provider,
      model,
      providerModelSeen: Boolean(provider || model)
    };
  };
  const collectProviderModel = (session, nodes) => {
    let provider = null;
    let model = null;
    for (const node of nodes) {
      if (!node.providerModelSeen) continue;
      if (node.provider) provider = node.provider;
      if (node.model) model = node.model;
    }
    if (!provider && !model) {
      const header = asRecord9(asRecord9(session).header);
      if (typeof header.provider === "string") provider = header.provider;
      if (typeof header.model === "string") model = header.model;
    }
    return { provider, model };
  };
  const analyzeWithSession = (sessionId, session) => {
    const settings = contextSettings();
    const mode = settings.mode;
    if (mode === "off") return emptyAnalysis2(sessionId, mode);
    const rawNodes = nodesOf(session);
    const measurement = readMeasurement(session);
    const nodes = [];
    for (let index = 0; index < rawNodes.length; index += 1) {
      try {
        nodes.push(classifyNode(session, rawNodes[index], index, measurement.tokensBySeq));
      } catch (error) {
        recordError("classify", error);
      }
    }
    nodes.sort((a, b) => a.seq === b.seq ? a.index - b.index : a.seq - b.seq);
    const surface = { nodes: nodes.length, tokens: 0, byRole: {}, bySource: {} };
    for (const node of nodes) {
      surface.tokens += node.tokens;
      surface.byRole[node.role] = (surface.byRole[node.role] ?? 0) + node.tokens;
      surface.bySource[node.source] = (surface.bySource[node.source] ?? 0) + node.tokens;
    }
    if (surface.tokens === 0 && measurement.totalTokens !== null) surface.tokens = measurement.totalTokens;
    const found = nodes.length >= settings.minSurfaceNodes;
    if (!found) {
      return { ...emptyAnalysis2(sessionId, mode), found: false, surface, candidates: [], analyzedAt: Date.now() };
    }
    const callInfo = /* @__PURE__ */ new Map();
    for (const node of nodes) {
      if (!/tool\/call/i.test(node.eventType) || !node.callId) continue;
      callInfo.set(node.callId, { toolName: node.toolName, feature: node.argsFeature });
    }
    const { provider, model } = collectProviderModel(session, nodes);
    const groups = /* @__PURE__ */ new Map();
    for (const node of nodes) {
      if (node.role !== "tool" || node.source !== "tool") continue;
      if (!/tool\/result/i.test(node.eventType)) continue;
      if (isProtectedRole(node.role) || isProtectedSource(node.source)) continue;
      if (!node.text.trim()) continue;
      const hash = createHash4("sha256").update(node.text, "utf8").digest("hex");
      const bucket = groups.get(hash);
      if (bucket) bucket.push(node);
      else groups.set(hash, [node]);
    }
    const candidates = [];
    for (const [contentHash, group] of groups) {
      if (group.length < settings.minOccurrences) continue;
      const occurrences = group.map((node) => ({
        seq: node.seq,
        turn: node.turn,
        step: node.step,
        role: node.role,
        source: node.source,
        tokens: node.tokens,
        bytes: node.bytes
      }));
      const removableTokens = group.slice(0, -1).reduce((sum, node) => sum + node.tokens, 0);
      const changePointSeq = occurrences.length >= 2 ? occurrences[1].seq : null;
      const invalidatedTokens = changePointSeq === null ? 0 : nodes.filter((node) => node.seq >= changePointSeq).reduce((sum, node) => sum + node.tokens, 0);
      const risk = estimator.estimate({
        invalidatedTokens,
        removableTokens,
        provider,
        model,
        changePointSeq
      });
      const firstCall = group.map((node) => node.callId ? callInfo.get(node.callId) : void 0).find(Boolean);
      const toolName = firstCall?.toolName ?? group.find((node) => node.toolName)?.toolName ?? null;
      const feature = firstCall?.feature ?? group.find((node) => node.argsFeature)?.argsFeature ?? null;
      const subject = toolName ? feature ? `${toolName} \xB7 ${feature}` : toolName : "tool";
      const recommend = !risk.risky && removableTokens >= RECOMMEND_MIN_TOKENS;
      candidates.push({
        kind: "tool-result",
        contentHash,
        subject,
        occurrences,
        removableTokens,
        cacheRisk: risk,
        recommend,
        note: `\u76F8\u540C\u5DE5\u5177\u7ED3\u679C\u51FA\u73B0 ${group.length} \u6B21\uFF1B\u4FDD\u7559\u6700\u540E 1 \u6B21\uFF0C\u53EF\u79FB\u9664 ${group.length - 1} \u6B21\uFF08\u7EA6 ${removableTokens} tokens\uFF09\u3002\u6539\u5199\u4F1A\u4ECE seq ${changePointSeq ?? "?"} \u8D77\u91CD\u7B97\u524D\u7F00\u7F13\u5B58\u3002`
      });
    }
    candidates.sort((a, b) => b.removableTokens - a.removableTokens || a.contentHash.localeCompare(b.contentHash));
    const limited = candidates.slice(0, settings.maxCandidates);
    const riskyCount = limited.filter((candidate) => candidate.cacheRisk.risky).length;
    const potentialSavingsTokens = limited.reduce((sum, candidate) => sum + candidate.removableTokens, 0);
    return {
      sessionId,
      found: true,
      surface,
      candidates: limited,
      totals: { candidateCount: limited.length, potentialSavingsTokens, riskyCount },
      mode,
      analyzedAt: Date.now(),
      readOnly: true
    };
  };
  const analyze = (sessionId) => {
    const id = typeof sessionId === "string" ? sessionId : String(sessionId ?? "");
    try {
      const resolve = deps.resolveSession;
      const session = typeof resolve === "function" ? resolve(id) : null;
      if (!session) return emptyAnalysis2(id, contextSettings().mode);
      return analyzeWithSession(id, session);
    } catch (error) {
      recordError("analyze", error);
      return emptyAnalysis2(id, "dry-run");
    }
  };
  const optimize = (sessionId) => {
    const analysis = analyze(sessionId);
    const recommended = analysis.candidates.filter((candidate) => candidate.recommend);
    if (recommended.length === 0 || !optimizations) return { recorded: 0, analysis };
    const savings = recommended.reduce((sum, candidate) => sum + candidate.removableTokens, 0);
    const firstChangePoint = recommended.find((candidate) => candidate.cacheRisk.changePointSeq !== null)?.cacheRisk.changePointSeq ?? null;
    const row = {
      taskId: null,
      sessionId: analysis.sessionId,
      optimizationType: "context-dedup",
      originalTokensEstimated: analysis.surface.tokens,
      optimizedTokensEstimated: Math.max(0, analysis.surface.tokens - savings),
      actualInputDelta: null,
      cacheDelta: firstChangePoint === null ? null : -recommended[0].cacheRisk.invalidatedTokens,
      estimatedSavings: savings,
      verified: 0,
      status: "proposed",
      detail: JSON.stringify({
        dryRun: true,
        readOnly: true,
        candidateCount: recommended.length,
        kinds: [...new Set(recommended.map((candidate) => candidate.kind))],
        candidates: recommended.slice(0, 20).map((candidate) => ({
          kind: candidate.kind,
          subject: candidate.subject,
          contentHash: candidate.contentHash.slice(0, 16),
          occurrences: candidate.occurrences.length,
          removableTokens: candidate.removableTokens,
          diffSeqs: candidate.occurrences.map((occurrence) => occurrence.seq),
          changePointSeq: candidate.cacheRisk.changePointSeq,
          invalidatedTokens: candidate.cacheRisk.invalidatedTokens,
          verdict: candidate.cacheRisk.verdict
        })),
        note: "Phase 3 dry-run: proposals only, the session was not modified."
      }),
      createdAt: Date.now()
    };
    try {
      optimizations.record(row);
      return { recorded: 1, analysis };
    } catch (error) {
      recordError("optimization.record", error);
      return { recorded: 0, analysis };
    }
  };
  return { analyze, optimize };
}

// src/host/auto-rules.ts
var AUTO_EFFORTS = EFFORT_LEVELS;
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readBool(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}
function readInt(value, fallback, min, max) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}
function readEffort(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return AUTO_EFFORTS.includes(normalized) ? normalized : null;
}
function readLadder(value) {
  if (!Array.isArray(value)) return [...AUTO_EFFORTS];
  const out = [];
  for (const item of value) {
    const effort = readEffort(item);
    if (effort && !out.includes(effort)) out.push(effort);
  }
  return out.length >= 2 ? out : [...AUTO_EFFORTS];
}
function resolveAutoConfig(raw) {
  const input = isRecord(raw) ? raw : {};
  const ladder = readLadder(input.ladder);
  const maxInitial = readEffort(input.maxInitial) ?? AUTO_DEFAULTS.maxInitial;
  const initialInput = isRecord(input.initial) ? input.initial : {};
  const initial = {};
  for (const taskType of AUTO_TASK_TYPES) {
    const desired = readEffort(initialInput[taskType]) ?? readEffort(AUTO_DEFAULTS.initial[taskType]) ?? (taskType === "simple-edit" ? "off" : "low");
    initial[taskType] = capEffort(desired, maxInitial, ladder);
  }
  return {
    enabled: readBool(input.enabled, AUTO_DEFAULTS.enabled),
    includeSubagents: readBool(input.includeSubagents, AUTO_DEFAULTS.includeSubagents),
    initial,
    maxInitial,
    ladder,
    escalateOnReasoningFailure: readBool(input.escalateOnReasoningFailure, true),
    reasoningFailuresToEscalate: readInt(input.reasoningFailuresToEscalate, AUTO_DEFAULTS.reasoningFailuresToEscalate, 1, 50),
    filesForComplex: readInt(input.filesForComplex, AUTO_DEFAULTS.filesForComplex, 2, 100),
    maxStepsWithoutProgress: readInt(input.maxStepsWithoutProgress, AUTO_DEFAULTS.maxStepsWithoutProgress, 2, 500),
    maxEscalationsPerTask: readInt(input.maxEscalationsPerTask, AUTO_DEFAULTS.maxEscalationsPerTask, 0, 10),
    resetOnNewTurn: readBool(input.resetOnNewTurn, AUTO_DEFAULTS.resetOnNewTurn),
    monitorOnly: readBool(input.monitorOnly, AUTO_DEFAULTS.monitorOnly),
    maxTrackedSessions: readInt(input.maxTrackedSessions, AUTO_DEFAULTS.maxTrackedSessions, 1, 2048),
    maxEvidenceEvents: readInt(input.maxEvidenceEvents, AUTO_DEFAULTS.maxEvidenceEvents, 8, 5e3)
  };
}
function effortRank(effort, ladder = AUTO_EFFORTS) {
  if (!effort) return -1;
  const normalized = String(effort).trim().toLowerCase();
  return ladder.indexOf(normalized);
}
function oneStepUp(effort, ladder = AUTO_EFFORTS) {
  const rank = effortRank(effort, ladder);
  if (rank < 0) return null;
  const next = ladder[rank + 1];
  return next ?? null;
}
function capEffort(effort, cap, ladder = AUTO_EFFORTS) {
  const rank = effortRank(effort, ladder);
  const capRank = effortRank(cap, ladder);
  if (rank < 0) return effort;
  if (capRank < 0) return effort;
  return rank > capRank ? ladder[capRank] ?? effort : effort;
}
function initialEffortFor(taskType, config) {
  const typed = AUTO_TASK_TYPES.includes(String(taskType)) ? taskType : "normal-dev";
  const desired = config.initial[typed] ?? "low";
  const capped = capEffort(desired, config.maxInitial, config.ladder);
  return capEffort(capped, "low", config.ladder);
}
var ENVIRONMENT_RULES = [
  {
    kind: "command-not-found",
    environment: true,
    reason: "\u547D\u4EE4\u4E0D\u5B58\u5728/\u4E0D\u53EF\u6267\u884C",
    pattern: /command not found|not recognized as an internal or external command|不是内部或外部命令|无法将.*识别为|is not recognized as the name of a cmdlet|no such command|command not recognized/i
  },
  {
    kind: "missing-module",
    environment: true,
    reason: "\u4F9D\u8D56/\u6A21\u5757\u7F3A\u5931",
    pattern: /cannot find module|module_not_found|modulenotfounderror|could not resolve|is not installed|missing dependenc|依赖(?:缺失|未安装)|未安装的依赖|no matching version found|no module named/i
  },
  {
    kind: "fs-not-found",
    environment: true,
    reason: "\u6587\u4EF6/\u76EE\u5F55\u4E0D\u5B58\u5728",
    pattern: /\benoent\b|\benotdir\b|\beisdir\b|no such file or directory|no such file|file not found|\b(?:file|path|directory|folder|module|command|executable|script)\b[^\n]{0,160}\bnot found\b|(?:[A-Za-z]:[\\/]|\.{0,2}[\\/])[^\n]{0,200}\bnot found\b|\b[\w-]+\.[A-Za-z0-9]{1,6}\s+not found\b|cannot read [^\n]{0,200}not found|\bcan't find\b|\bcannot find\b(?! module)|\bError:\s*[^\n]{0,200}:\s*not found|系统找不到指定的(?:文件|路径)|文件不存在|目录不存在|路径不存在|(?:^|\n)\s*(?:bash|sh|zsh|fish|pwsh|powershell|cmd|node|npx|pnpm|npm|yarn)\b[^\n]{0,160}:\s*not found|(?:^|\n)\s*[^\s:\n]{1,160}:\s*not found/
  },
  {
    kind: "invalid-path",
    environment: true,
    reason: "\u8DEF\u5F84\u65E0\u6548",
    pattern: /invalid path|无效路径|路径格式|illegal path|path is invalid/i
  },
  {
    kind: "permission",
    environment: true,
    reason: "\u6743\u9650/\u6C99\u7BB1\u62D2\u7EDD",
    pattern: /\beacces\b|\beperm\b|permission denied|access is denied|拒绝访问|权限不足|没有权限|沙箱.*(?:拒绝|阻止)|blocked by sandbox|sandbox: file access denied|operation not permitted/i
  },
  {
    kind: "network",
    environment: true,
    reason: "\u7F51\u7EDC\u4E0D\u53EF\u7528/\u8D85\u65F6",
    pattern: /\beconnrefused\b|\betimedout\b|\benotfound\b|\beai_again\b|\beconnreset\b|socket hang up|network error|网络(?:错误|不可达|超时|异常)|请求超时|connection refused|getaddrinfo|dns lookup|fetch failed/i
  },
  {
    kind: "port-in-use",
    environment: true,
    reason: "\u7AEF\u53E3\u5360\u7528",
    pattern: /\beaddrinuse\b|port .{0,20}(?:already )?in use|端口.{0,10}(?:被)?占用/i
  },
  {
    kind: "external-api",
    environment: true,
    reason: "\u5916\u90E8 API 4xx/5xx/\u9650\u6D41",
    pattern: /(?:\b(?:4\d\d|5\d\d)\b.{0,30}(?:api|response|status|error))|http\s+(?:4\d\d|5\d\d)\b|api .{0,20}(?:unavailable|error)|服务不可用|服务端错误|service unavailable|internal server error|bad gateway|gateway timeout|\bhttp 429\b|rate limit|too many requests/i
  },
  {
    kind: "test-env",
    environment: true,
    reason: "\u6D4B\u8BD5\u73AF\u5883\u7F3A\u5931/\u672A\u5C31\u7EEA",
    pattern: /测试环境.{0,12}(?:缺失|未就绪|不可用)|test environment.{0,20}(?:missing|not ready|unavailable)/i
  }
];
var REASONING_RULES = [
  {
    kind: "assertion",
    environment: false,
    reason: "\u65AD\u8A00\u5931\u8D25",
    pattern: /assertionerror|断言(?:失败|错误)|expected .{0,60}(?:to be|but)|assertion failed|\bnot ok\b|✗/i
  },
  {
    kind: "test-failure",
    environment: false,
    reason: "\u6D4B\u8BD5\u5931\u8D25",
    pattern: /tests? failed|测试失败|\d+ failing|\d+ failed\b|fail(?:ed)? \d+|jest|vitest|mocha|pytest|phpunit/i
  },
  {
    kind: "build-failure",
    environment: false,
    reason: "\u6784\u5EFA\u5931\u8D25",
    pattern: /build failed|构建失败|编译失败|compilation failed|esbuild.{0,20}error|webpack.{0,20}error|vite.{0,20}error/i
  },
  {
    kind: "syntax-error",
    environment: false,
    reason: "\u8BED\u6CD5\u9519\u8BEF",
    pattern: /syntaxerror|语法错误|unexpected token|unexpected end of|parse error/i
  },
  {
    kind: "type-error",
    environment: false,
    reason: "\u7C7B\u578B\u9519\u8BEF",
    pattern: /error ts\d+|ts\d{3,}|类型错误|type error|类型.{0,6}不(?:匹配|兼容)/i
  },
  {
    kind: "runtime-error",
    environment: false,
    reason: "\u8FD0\u884C\u65F6\u9519\u8BEF\uFF08\u6A21\u578B\u6539\u52A8\u5F15\u5165\uFF09",
    pattern: /typeerror|referenceerror|rangeerror|is not a function|cannot read propert|undefined is not|index out of range/i
  },
  {
    kind: "lint-error",
    environment: false,
    reason: "Lint \u5931\u8D25",
    pattern: /eslint|lint error|stylelint|prettier.{0,20}(?:error|fail)/i
  },
  {
    kind: "tool-usage",
    environment: false,
    reason: "\u5DE5\u5177\u53C2\u6570/\u5B9A\u4F4D\u5931\u8D25\uFF08\u6A21\u578B\u4FA7\uFF09",
    pattern: /old_string.{0,30}(?:not found|no match)|未找到匹配|no changes|edit failed|multi_edit failed|invalid argument|参数错误|missing required (?:argument|parameter)/i
  },
  {
    kind: "model-output",
    environment: false,
    reason: "\u9A8C\u8BC1\u540E\u4ECD\u4E0D\u901A\u8FC7",
    pattern: /仍然(?:失败|不对|不正确|报错)|还是(?:不对|失败|不行|报错)|still (?:failing|broken|wrong|fails)/i
  },
  {
    kind: "command-failure",
    environment: false,
    reason: "\u547D\u4EE4/\u9A8C\u8BC1\u5931\u8D25",
    pattern: /npm err!|command failed with exit code|exit code [1-9]|exited with (?:code )?[1-9]|process exited with/i
  }
];
function firstMatch(rules, text) {
  for (const rule of rules) {
    const matched = rule.pattern.exec(text);
    if (matched) {
      return {
        kind: rule.kind,
        environment: rule.environment,
        reason: rule.reason,
        matched: String(matched[0]).slice(0, 80)
      };
    }
  }
  return null;
}
function classifyFailure(text) {
  const raw = typeof text === "string" ? text : text === void 0 || text === null ? "" : safeStringify(text);
  if (!raw.trim()) return { kind: "unknown", environment: false, reason: "\u65E0\u6CD5\u8BC6\u522B\u7684\u5931\u8D25", matched: null };
  const environment = firstMatch(ENVIRONMENT_RULES, raw);
  if (environment) return environment;
  const reasoning = firstMatch(REASONING_RULES, raw);
  if (reasoning) return reasoning;
  return { kind: "unknown", environment: false, reason: "\u975E\u73AF\u5883\u7C7B\u5931\u8D25", matched: null };
}
function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
function evaluateEscalation(input) {
  const { config, evidence } = input;
  const used = new Set(input.usedRules ?? []);
  const ladder = config.ladder;
  const next = oneStepUp(input.effort, ladder);
  const complexish = input.taskType === "complex-dev" || input.taskType === "troubleshoot";
  const environmentBlocked = evidence.environmentFailures > 0;
  const reasons = [];
  const reasoningThreshold = Math.max(1, config.reasoningFailuresToEscalate) * ((input.reasoningEscalations ?? 0) + 1);
  const canReasoning = config.escalateOnReasoningFailure && evidence.reasoningFailures >= reasoningThreshold;
  const writtenFiles = Math.max(0, Math.trunc(Number(evidence.files) || 0));
  const readFiles = Math.max(0, Math.trunc(Number(evidence.readFiles ?? 0) || 0));
  const canFiles = complexish && !used.has("files") && writtenFiles >= Math.max(2, config.filesForComplex);
  const readThreshold = Math.max(4, config.filesForComplex + 2);
  const canReadAnalysis = !used.has("read-analysis") && !environmentBlocked && (input.taskType === "complex-dev" || input.taskType === "project-analysis") && readFiles >= readThreshold;
  const canApproaches = complexish && !used.has("approaches") && evidence.failedCommands >= 2 && evidence.verificationFailures >= 2;
  const canSteps = !used.has("steps") && evidence.steps >= config.maxStepsWithoutProgress;
  let rule = null;
  if (canReasoning) {
    rule = "reasoning";
    reasons.push(`\u63A8\u7406\u6027\u5931\u8D25 ${evidence.reasoningFailures} \u6B21 \u2265 \u9608\u503C ${reasoningThreshold}`);
  } else if (canFiles && !environmentBlocked) {
    rule = "files";
    reasons.push(`\u5DF2\u4FEE\u6539\u6587\u4EF6 ${writtenFiles} \u4E2A \u2265 ${Math.max(2, config.filesForComplex)}\uFF08${input.taskType}\uFF09`);
  } else if (canReadAnalysis) {
    rule = "read-analysis";
    reasons.push(`\u53EA\u8BFB\u5206\u6790 ${readFiles} \u4E2A\u6587\u4EF6 \u2265 ${readThreshold}\uFF08${input.taskType}\uFF0C\u65E0\u73AF\u5883\u5931\u8D25\uFF09`);
  } else if (canApproaches && !environmentBlocked) {
    rule = "approaches";
    reasons.push(`\u5DF2\u5C1D\u8BD5 ${evidence.failedCommands} \u79CD\u9A8C\u8BC1\u547D\u4EE4\u4ECD\u5931\u8D25\uFF08${evidence.verificationFailures} \u6B21\u9A8C\u8BC1\u5931\u8D25\uFF09`);
  } else if (canSteps && !environmentBlocked) {
    rule = "steps";
    reasons.push(`\u5DF2\u6267\u884C ${evidence.steps} \u6B65\u4ECD\u65E0\u8FDB\u5C55\uFF08\u65E0\u73AF\u5883\u7C7B\u5931\u8D25\uFF09`);
  }
  if (rule !== null) {
    if (input.stage >= config.maxEscalationsPerTask) {
      return { action: "hold", toEffort: input.effort, rule: null, reasons: [`\u5DF2\u8FBE\u5355\u4EFB\u52A1\u5347\u7EA7\u4E0A\u9650 ${config.maxEscalationsPerTask}`] };
    }
    if (next === null) {
      return { action: "hold", toEffort: input.effort, rule: null, reasons: ["\u5DF2\u662F\u6700\u9AD8\u6863\u4F4D"] };
    }
    if (evidence.environmentFailures > 0) {
      reasons.push(`\u6CE8\u610F\uFF1A\u53E6\u6709 ${evidence.environmentFailures} \u6B21\u73AF\u5883\u7C7B\u5931\u8D25\uFF08\u4E0D\u4F5C\u4E3A\u5347\u7EA7\u4F9D\u636E\uFF09`);
    }
    return { action: "escalate", toEffort: next, rule, reasons };
  }
  if (input.stage >= config.maxEscalationsPerTask) {
    reasons.push(`\u5DF2\u8FBE\u5355\u4EFB\u52A1\u5347\u7EA7\u4E0A\u9650 ${config.maxEscalationsPerTask}`);
  } else if (next === null) {
    reasons.push("\u5DF2\u662F\u6700\u9AD8\u6863\u4F4D");
  } else if (environmentBlocked) {
    const kinds = (evidence.failureKinds ?? []).slice(0, 4).join(", ");
    reasons.push(`\u73AF\u5883\u7C7B\u5931\u8D25\u7981\u6B62\u5347\u7EA7${kinds ? `\uFF1A${kinds}` : ""}`);
  }
  return { action: "hold", toEffort: input.effort, rule: null, reasons };
}

// src/host/auto-classifier.ts
var SIMPLE_KEYWORDS = [
  "\u989C\u8272",
  "\u8272\u503C",
  "\u914D\u8272",
  "\u8272\u8C03",
  "\u80CC\u666F\u8272",
  "\u6587\u672C\u8272",
  "\u8FB9\u6846\u8272",
  "\u4E3B\u9898\u8272",
  "\u6587\u6848",
  "\u6587\u5B57",
  "\u6807\u9898",
  "\u6309\u94AE",
  "\u6837\u5F0F",
  "\u5B57\u4F53",
  "\u56FE\u6807",
  "\u95F4\u8DDD",
  "\u8FB9\u8DDD",
  "\u5BF9\u9F50",
  "\u5C45\u4E2D",
  "\u52A0\u7C97",
  "\u5B57\u53F7",
  "\u6539\u540D",
  "\u540D\u79F0",
  "\u67E5\u8BE2",
  "\u67E5\u770B",
  "\u5217\u51FA",
  "\u663E\u793A",
  "\u7FFB\u8BD1",
  "\u603B\u7ED3",
  "\u6DA6\u8272",
  "\u6539\u5199",
  "\u89E3\u91CA",
  "\u56DE\u7B54",
  "\u6539\u4E00\u4E0B",
  "\u6539\u4E2A",
  "\u6539\u56DE",
  "\u5FAE\u8C03",
  "\u5C0F\u6539",
  "\u6574\u7406\u4E00\u4E0B",
  "\u53EA\u6539",
  "color",
  "colour",
  "style",
  "label",
  "button",
  "title",
  "font",
  "icon",
  "spacing",
  "align",
  "rename",
  "query",
  "list ",
  "show ",
  "translate",
  "summarize",
  "typo",
  "css"
];
var DEV_KEYWORDS = [
  "\u65B0\u589E",
  "\u6DFB\u52A0",
  "\u5B9E\u73B0",
  "\u5F00\u53D1",
  "\u521B\u5EFA",
  "\u7F16\u5199",
  "\u5199\u4E00\u4E2A",
  "\u5199\u4E2A",
  "\u529F\u80FD",
  "\u51FD\u6570",
  "\u63A5\u53E3",
  "\u7EC4\u4EF6",
  "\u65B9\u6CD5",
  "\u5BFC\u51FA",
  "\u63A5\u5165",
  "\u652F\u6301",
  "\u6269\u5C55",
  "\u903B\u8F91",
  "\u5B57\u6BB5",
  "\u8DEF\u7531",
  "\u9875\u9762",
  "implement",
  "feature",
  "function",
  "component",
  "endpoint",
  "export",
  "extend",
  "support",
  "handler"
];
var TROUBLE_KEYWORDS = [
  "bug",
  "\u62A5\u9519",
  "\u9519\u8BEF",
  "\u4FEE\u590D",
  "\u6392\u67E5",
  "\u5B9A\u4F4D",
  "\u4E3A\u4EC0\u4E48",
  "\u5931\u8D25",
  "\u5D29\u6E83",
  "\u5F02\u5E38",
  "\u4E0D\u5DE5\u4F5C",
  "\u4E0D\u751F\u6548",
  "\u6CA1\u53CD\u5E94",
  "\u56DE\u5F52",
  "\u590D\u73B0",
  "\u65E0\u6CD5",
  "\u51FA\u9519",
  "\u9519\u8BEF\u7801",
  "\u4E0D\u901A\u8FC7",
  "fix",
  "debug",
  "error",
  "troubleshoot",
  "issue",
  "regression",
  "broken",
  "crash",
  "why"
];
var STRONG_COMPLEX_KEYWORDS = [
  "\u67B6\u6784",
  "\u8BBE\u8BA1",
  "\u91CD\u6784",
  "\u591A\u6A21\u5757",
  "\u8DE8\u6A21\u5757",
  "\u65B9\u6848",
  "\u8FC1\u79FB",
  "\u6027\u80FD",
  "\u96C6\u6210",
  "\u591A\u4E2A\u6587\u4EF6",
  "\u8054\u52A8",
  "architecture",
  "refactor",
  "design",
  "migrate",
  "migration",
  "multi-module",
  "cross-module",
  "performance",
  "integration"
];
var WEAK_COMPLEX_KEYWORDS = [
  "\u7CFB\u7EDF",
  "\u6D41\u7A0B",
  "\u6A21\u5757",
  "\u4F9D\u8D56",
  "\u6570\u636E\u5E93",
  "schema",
  "\u63A5\u53E3\u5C42",
  "\u94FE\u8DEF",
  "\u5E76\u53D1",
  "\u7F13\u5B58",
  "pipeline",
  "system",
  "module",
  "database",
  "concurrency",
  "workflow"
];
var ANALYSIS_KEYWORDS = [
  "\u5206\u6790",
  "\u68B3\u7406",
  "\u5BA1\u8BA1",
  "\u8BC4\u4F30",
  "\u76D8\u70B9",
  "\u73B0\u72B6",
  "\u62A5\u544A",
  "\u7EDF\u8BA1",
  "\u5BF9\u6BD4",
  "\u8C03\u7814",
  "\u5BA1\u67E5",
  "analyze",
  "analysis",
  "audit",
  "review",
  "report",
  "assess",
  "investigate",
  "survey"
];
var MULTIPLE_CAUSE_PATTERNS = [
  /多个(?:可能)?原因/,
  /几种可能/,
  /可能(?:的)?原因/,
  /多个可能/,
  /逐个排查/,
  /multiple (?:possible )?causes?/i,
  /several possible/i
];
var FILE_PATH_REGEX = /(?:[A-Za-z]:[\\/]|\.{0,2}[\\/])?[\w@.\-/\\]+\.(?:tsx?|jsx?|mjs|cjs|py|go|rs|java|kt|cs|cpp|cc|c|h|hpp|json|ya?ml|toml|md|css|scss|less|html|sql|sh|ps1|vue|svelte)(?![\w])/gi;
var CN_DIGITS = {
  \u4E00: 1,
  \u4E24: 2,
  \u4E8C: 2,
  \u4E09: 3,
  \u56DB: 4,
  \u4E94: 5,
  \u516D: 6,
  \u4E03: 7,
  \u516B: 8,
  \u4E5D: 9,
  \u5341: 10
};
function lowerText(text) {
  return text.toLowerCase();
}
function hitKeywords(haystack, keywords, category) {
  const hits = [];
  for (const keyword of keywords) {
    if (haystack.includes(lowerText(keyword))) hits.push({ keyword: keyword.trim(), category });
  }
  return hits;
}
function countUnit(text, unit) {
  let best = 0;
  const digitPattern = new RegExp(`(\\d+)\\s*\\+?\\s*(?:\u4E2A|\u591A\u4E2A)?\\s*${unit}`, "g");
  for (const match of text.matchAll(digitPattern)) {
    const value = Number(match[1]);
    if (Number.isFinite(value)) best = Math.max(best, Math.trunc(value));
  }
  const cnPattern = new RegExp(`([\u4E00\u4E24\u4E8C\u4E09\u56DB\u4E94\u516D\u4E03\u516B\u4E5D\u5341])\\s*(?:\u4E2A)?\\s*${unit}`, "g");
  for (const match of text.matchAll(cnPattern)) {
    const value = CN_DIGITS[match[1] ?? ""];
    if (value) best = Math.max(best, value);
  }
  return best;
}
function extractFilePaths(text) {
  const seen = /* @__PURE__ */ new Set();
  for (const match of text.matchAll(FILE_PATH_REGEX)) {
    const value = String(match[0]).replace(/^[\\/]+/, "");
    if (!value) continue;
    if (/^\d+\.\d+/.test(value)) continue;
    seen.add(value);
    if (seen.size >= 50) break;
  }
  return [...seen];
}
function analyzeText(text, options = {}) {
  const raw = typeof text === "string" ? text : "";
  const clipped = raw.slice(0, AUTO_TEXT_LIMIT);
  const haystack = lowerText(clipped);
  const hits = [
    ...hitKeywords(haystack, SIMPLE_KEYWORDS, "simple"),
    ...hitKeywords(haystack, DEV_KEYWORDS, "dev"),
    ...hitKeywords(haystack, TROUBLE_KEYWORDS, "trouble"),
    ...hitKeywords(haystack, STRONG_COMPLEX_KEYWORDS, "complex"),
    ...hitKeywords(haystack, WEAK_COMPLEX_KEYWORDS, "complex-weak"),
    ...hitKeywords(haystack, ANALYSIS_KEYWORDS, "analysis")
  ];
  const pathFiles = extractFilePaths(clipped).length;
  const explicitFiles = countUnit(clipped, "\u6587\u4EF6");
  const files = Math.max(pathFiles, explicitFiles);
  const explicitModules = countUnit(clipped, "(?:\u6A21\u5757|\u670D\u52A1|\u5B50\u7CFB\u7EDF)");
  const moduleMentions = (haystack.match(/模块|module/g) ?? []).length;
  const modules = Math.max(explicitModules, Math.min(moduleMentions, 8));
  const multipleCauses = MULTIPLE_CAUSE_PATTERNS.some((pattern) => pattern.test(clipped));
  const sentences = Math.max(1, (clipped.match(/[。！？!?\n]+/g) ?? []).length);
  const intent = inferIntent(hits, files, multipleCauses);
  return {
    signals: {
      length: Array.from(raw).length,
      files,
      modules,
      keywords: uniqueKeywords(hits).slice(0, 8),
      intent,
      isSubagent: options.isSubagent === true
    },
    hits,
    multipleCauses,
    sentences
  };
}
function uniqueKeywords(hits) {
  const out = [];
  for (const hit of hits) {
    if (!out.includes(hit.keyword)) out.push(hit.keyword);
    if (out.length >= 12) break;
  }
  return out;
}
function inferIntent(hits, files, multipleCauses) {
  if (multipleCauses) return "multi-cause";
  const has = (category) => hits.filter((hit) => hit.category === category).length;
  if (has("complex") >= 1 || has("complex-weak") >= 2 || files >= 3) return "multi-module";
  if (has("trouble") >= 1) return "fix";
  if (has("analysis") >= 1) return "analyze";
  if (has("dev") >= 1) return "build";
  if (has("simple") >= 1) return "modify";
  return "unknown";
}
function score(hits, category) {
  return hits.filter((hit) => hit.category === category).length;
}
function decideTaskType(input) {
  const simple = score(input.hits, "simple");
  const dev = score(input.hits, "dev");
  const trouble = score(input.hits, "trouble");
  const strongComplex = score(input.hits, "complex");
  const weakComplex = score(input.hits, "complex-weak");
  const complex = strongComplex + weakComplex;
  const analysis = score(input.hits, "analysis");
  const rationale = [];
  if (input.multipleCauses) {
    rationale.push("\u547D\u4E2D\u300C\u591A\u4E2A\u53EF\u80FD\u539F\u56E0\u300D\u6A21\u5F0F");
    return { taskType: "complex-dev", rationale };
  }
  if (strongComplex >= 1) {
    rationale.push("\u547D\u4E2D\u67B6\u6784/\u91CD\u6784/\u591A\u6A21\u5757\u5173\u952E\u8BCD");
    return { taskType: "complex-dev", rationale };
  }
  if (weakComplex >= 2 || weakComplex >= 1 && (input.files >= 2 || input.modules >= 2)) {
    rationale.push("\u547D\u4E2D\u6210\u7EC4\u7684\u7CFB\u7EDF/\u6A21\u5757/\u6570\u636E\u5E93\u7C7B\u5173\u952E\u8BCD");
    return { taskType: "complex-dev", rationale };
  }
  if (input.files >= 3 || input.modules >= 3) {
    rationale.push(`\u63D0\u53CA ${Math.max(input.files, input.modules)} \u4E2A\u6587\u4EF6/\u6A21\u5757`);
    return { taskType: "complex-dev", rationale };
  }
  if (analysis >= 1 && trouble === 0 && simple === 0 && input.files <= 1) {
    rationale.push("\u7EAF\u5206\u6790/\u68B3\u7406\u610F\u56FE");
    return { taskType: "project-analysis", rationale };
  }
  if (trouble >= 1) {
    rationale.push("\u547D\u4E2D\u6392\u67E5/bug/\u62A5\u9519\u5173\u952E\u8BCD");
    return { taskType: "troubleshoot", rationale };
  }
  if (simple >= 1 && dev === 0 && strongComplex === 0 && input.files <= 2 && input.length <= 160 && input.sentences <= 1) {
    rationale.push("\u7B80\u5355 UI/\u6587\u5B57/\u67E5\u8BE2\u610F\u56FE");
    return { taskType: "simple-edit", rationale };
  }
  if (input.files >= 1) {
    rationale.push(`\u63D0\u53CA ${input.files} \u4E2A\u6587\u4EF6`);
    return { taskType: "normal-dev", rationale };
  }
  if (dev >= 1) {
    rationale.push("\u547D\u4E2D\u65B0\u589E/\u5B9E\u73B0\u7B49\u529F\u80FD\u5173\u952E\u8BCD");
    return { taskType: "normal-dev", rationale };
  }
  if (simple >= 1 && input.length <= 160 && input.sentences <= 1) {
    rationale.push("\u7B80\u5355 UI/\u6587\u5B57/\u67E5\u8BE2\u610F\u56FE");
    return { taskType: "simple-edit", rationale };
  }
  if (input.length >= 120) {
    rationale.push("\u957F\u6587\u672C\u4E14\u65E0\u7B80\u5355\u610F\u56FE");
    return { taskType: "normal-dev", rationale };
  }
  if (input.isSubagent) {
    rationale.push("\u5B50 Agent \u6D3E\u6D3B\u4EFB\u52A1");
    return { taskType: "normal-dev", rationale };
  }
  rationale.push("\u65E0\u663E\u5F0F\u4FE1\u53F7\uFF0C\u6309\u7B80\u5355\u4EFB\u52A1\u5904\u7406");
  return { taskType: "simple-edit", rationale };
}
function computeConfidence(input) {
  let confidence = 0.45;
  if (input.hits.length >= 2) confidence += 0.2;
  if (input.files >= 1) confidence += 0.1;
  if (input.multipleCauses) confidence += 0.15;
  if (input.length <= 40 && input.sentences <= 1) confidence += 0.05;
  if (input.isSubagent) confidence += 0.05;
  const categories = new Set(input.hits.map((hit) => hit.category));
  if (categories.has("simple") && (categories.has("trouble") || categories.has("complex") || categories.has("complex-weak"))) {
    confidence -= 0.2;
  }
  return Math.round(Math.min(0.95, Math.max(0.3, confidence)) * 100) / 100;
}
function classifyTask(text, options = {}) {
  const config = options.config ?? resolveAutoConfig();
  const { signals, hits, multipleCauses, sentences } = analyzeText(text, { isSubagent: options.isSubagent });
  const { taskType, rationale } = decideTaskType({
    hits,
    files: signals.files,
    modules: signals.modules,
    multipleCauses,
    length: signals.length,
    sentences,
    isSubagent: signals.isSubagent
  });
  const effort = initialEffortFor(taskType, config);
  const confidence = computeConfidence({
    hits,
    files: signals.files,
    length: signals.length,
    sentences,
    multipleCauses,
    isSubagent: signals.isSubagent
  });
  const reasons = [];
  if (signals.keywords.length > 0) reasons.push(`\u5173\u952E\u8BCD\uFF1A${signals.keywords.slice(0, 4).join("\u3001")}`);
  if (signals.files > 0) reasons.push(`\u63D0\u53CA ${signals.files} \u4E2A\u6587\u4EF6`);
  if (signals.modules > 1) reasons.push(`\u63D0\u53CA ${signals.modules} \u4E2A\u6A21\u5757`);
  if (signalSentence(sentences, signals.length)) reasons.push("\u77ED\u6587\u672C\u5355\u53E5");
  if (signals.isSubagent) reasons.push("\u5B50 Agent \u4EFB\u52A1");
  for (const line of rationale) if (!reasons.includes(line)) reasons.push(line);
  if (reasons.length === 0) reasons.push(`\u9ED8\u8BA4\u5F52\u7C7B\uFF1A${taskType}`);
  return {
    taskType,
    effort,
    confidence,
    reasons: reasons.slice(0, 5),
    signals: {
      length: signals.length,
      files: signals.files,
      modules: signals.modules,
      keywords: signals.keywords,
      intent: signals.intent,
      isSubagent: signals.isSubagent
    }
  };
}
function signalSentence(sentences, length) {
  return length > 0 && length < 80 && sentences <= 1;
}

// src/host/auto-store.ts
var AUTO_DECISIONS_DDL = `
CREATE TABLE IF NOT EXISTS auto_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  turn INTEGER,
  step INTEGER,
  task_type TEXT,
  from_effort TEXT,
  to_effort TEXT NOT NULL,
  stage INTEGER NOT NULL,
  action TEXT NOT NULL,
  reasons TEXT NOT NULL,
  evidence TEXT,
  applied INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auto_decisions_session ON auto_decisions(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_auto_decisions_action ON auto_decisions(action, ts);
CREATE TABLE IF NOT EXISTS auto_sessions (
  session_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  started_at INTEGER,
  last_task_type TEXT,
  last_effort TEXT,
  updated_at INTEGER
);
`;
function parseJsonArray(text) {
  if (typeof text !== "string" || !text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}
function parseEvidence(text) {
  if (typeof text !== "string" || !text) return null;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const input = parsed;
    const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
    const strings = (value) => Array.isArray(value) ? value.map((item) => String(item)).slice(0, 200) : [];
    return {
      files: strings(input.files),
      tools: strings(input.tools),
      failures: number(input.failures),
      environmentFailures: number(input.environmentFailures),
      reasoningFailures: number(input.reasoningFailures),
      failureKinds: strings(input.failureKinds),
      steps: number(input.steps),
      signals: strings(input.signals)
    };
  } catch {
    return null;
  }
}
function toDecision(row) {
  return {
    id: Number(row.id),
    ts: Number(row.ts),
    sessionId: String(row.session_id),
    turn: row.turn === null || row.turn === void 0 ? null : Number(row.turn),
    step: row.step === null || row.step === void 0 ? null : Number(row.step),
    taskType: row.task_type ?? null,
    fromEffort: row.from_effort ?? null,
    toEffort: String(row.to_effort),
    stage: Number(row.stage ?? 0),
    action: String(row.action),
    reasons: parseJsonArray(row.reasons),
    evidence: parseEvidence(row.evidence),
    applied: Number(row.applied) === 1
  };
}
function emptyBucket(mode) {
  return {
    mode,
    calls: 0,
    tasks: 0,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: null,
    reasoningEstimatedTokens: null,
    reasoningSource: null,
    cacheReadTokens: 0,
    totalTokens: 0,
    cost: null,
    successRate: null,
    avgTokensPerTask: null
  };
}
var LIMIT_DEFAULT = 100;
var LIMIT_MAX = 500;
function createAutoStore(store, options = {}) {
  const now = options.now ?? (() => Date.now());
  const costs = options.costs;
  const report = (where, error) => {
    try {
      options.onError?.(where, error);
    } catch {
    }
  };
  let ready = false;
  try {
    store.exec(AUTO_DECISIONS_DDL);
    ready = true;
  } catch (error) {
    report("auto-store.init", error);
  }
  const orNull = (value) => value === void 0 || value === null || !Number.isFinite(Number(value)) ? null : Math.trunc(Number(value));
  const asText = (value) => typeof value === "string" && value.length > 0 ? value : value === null || value === void 0 ? null : String(value);
  const recordDecision = (input) => {
    const ts = Number.isFinite(Number(input.ts)) ? Number(input.ts) : now();
    const reasons = JSON.stringify(Array.isArray(input.reasons) ? input.reasons.slice(0, 20) : []);
    const evidence = input.evidence ? JSON.stringify(input.evidence) : null;
    const row = {
      id: 0,
      ts,
      session_id: String(input.sessionId),
      turn: input.turn === void 0 || input.turn === null ? null : Math.trunc(Number(input.turn)),
      step: input.step === void 0 || input.step === null ? null : Math.trunc(Number(input.step)),
      task_type: asText(input.taskType),
      from_effort: asText(input.fromEffort),
      to_effort: String(input.toEffort),
      stage: Math.max(0, Math.trunc(Number(input.stage) || 0)),
      action: String(input.action),
      reasons,
      evidence,
      applied: input.applied ? 1 : 0
    };
    try {
      const info = store.run(
        `INSERT INTO auto_decisions(ts, session_id, turn, step, task_type, from_effort, to_effort, stage, action, reasons, evidence, applied)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.ts,
        row.session_id,
        row.turn,
        row.step,
        row.task_type,
        row.from_effort,
        row.to_effort,
        row.stage,
        row.action,
        row.reasons,
        row.evidence,
        row.applied
      );
      row.id = Number(info.lastInsertRowid);
    } catch (error) {
      report("auto-store.recordDecision", error);
    }
    return toDecision(row);
  };
  const updateDecisionTurn = (id, turn) => {
    try {
      store.run("UPDATE auto_decisions SET turn = ? WHERE id = ?", orNull(turn), Math.trunc(id));
    } catch (error) {
      report("auto-store.updateDecisionTurn", error);
    }
  };
  const listDecisions = (query = {}) => {
    const limit = Math.max(1, Math.min(LIMIT_MAX, Math.trunc(Number(query.limit ?? LIMIT_DEFAULT) || LIMIT_DEFAULT)));
    try {
      const rows = query.sessionId ? store.all(
        "SELECT * FROM auto_decisions WHERE session_id = ? ORDER BY id DESC LIMIT ?",
        String(query.sessionId),
        limit
      ) : store.all("SELECT * FROM auto_decisions ORDER BY id DESC LIMIT ?", limit);
      return rows.map(toDecision);
    } catch (error) {
      report("auto-store.listDecisions", error);
      return [];
    }
  };
  const lastDecision = (sessionId) => {
    try {
      const row = sessionId ? store.get(
        "SELECT * FROM auto_decisions WHERE session_id = ? ORDER BY id DESC LIMIT 1",
        String(sessionId)
      ) : store.get("SELECT * FROM auto_decisions ORDER BY id DESC LIMIT 1");
      return row ? toDecision(row) : null;
    } catch (error) {
      report("auto-store.lastDecision", error);
      return null;
    }
  };
  const scalar = (sql, ...params) => {
    try {
      const row = store.get(sql, ...params);
      const value = Number(row?.value ?? 0);
      return Number.isFinite(value) ? value : 0;
    } catch (error) {
      report("auto-store.scalar", error);
      return 0;
    }
  };
  const counts = () => ({
    decisions: scalar("SELECT COUNT(*) AS value FROM auto_decisions"),
    escalations: scalar("SELECT COUNT(*) AS value FROM auto_decisions WHERE action = 'escalate'"),
    applied: scalar("SELECT COUNT(*) AS value FROM auto_decisions WHERE applied = 1"),
    classify: scalar("SELECT COUNT(*) AS value FROM auto_decisions WHERE action = 'classify'"),
    holds: scalar("SELECT COUNT(*) AS value FROM auto_decisions WHERE action = 'hold'"),
    manualExits: scalar("SELECT COUNT(*) AS value FROM auto_decisions WHERE action = 'manual-exit'")
  });
  const ensureSession = (sessionId) => {
    try {
      store.run(
        "INSERT OR IGNORE INTO auto_sessions(session_id, enabled, started_at, updated_at) VALUES (?, 1, ?, ?)",
        String(sessionId),
        now(),
        now()
      );
    } catch (error) {
      report("auto-store.ensureSession", error);
    }
  };
  const setSession = (sessionId, patch) => {
    ensureSession(sessionId);
    const assignments = [];
    const params = [];
    if (patch.enabled !== void 0) {
      assignments.push("enabled = ?");
      params.push(patch.enabled ? 1 : 0);
    }
    if (patch.startedAt !== void 0) {
      assignments.push("started_at = ?");
      params.push(orNull(patch.startedAt));
    }
    if (patch.lastTaskType !== void 0) {
      assignments.push("last_task_type = ?");
      params.push(asText(patch.lastTaskType));
    }
    if (patch.lastEffort !== void 0) {
      assignments.push("last_effort = ?");
      params.push(asText(patch.lastEffort));
    }
    assignments.push("updated_at = ?");
    params.push(now());
    params.push(String(sessionId));
    try {
      store.run(`UPDATE auto_sessions SET ${assignments.join(", ")} WHERE session_id = ?`, ...params);
    } catch (error) {
      report("auto-store.setSession", error);
    }
  };
  const getSession = (sessionId) => {
    try {
      const row = store.get("SELECT * FROM auto_sessions WHERE session_id = ?", String(sessionId));
      if (!row) return null;
      return {
        sessionId: String(row.session_id),
        enabled: Number(row.enabled ?? 1),
        startedAt: row.started_at === null ? null : Number(row.started_at),
        lastTaskType: row.last_task_type ?? null,
        lastEffort: row.last_effort ?? null,
        updatedAt: row.updated_at === null ? null : Number(row.updated_at)
      };
    } catch (error) {
      report("auto-store.getSession", error);
      return null;
    }
  };
  const usageColumns = () => {
    try {
      return new Set(store.all("PRAGMA table_info(usage_records)").map((row) => row.name));
    } catch {
      return /* @__PURE__ */ new Set();
    }
  };
  const modeExpression = (alias, effortSource) => {
    const decisionBefore = `EXISTS (
      SELECT 1 FROM auto_decisions d
      WHERE d.session_id = ${alias}.session_id
        AND d.applied = 1
        AND d.action IN ('classify', 'escalate')
        AND (
          d.turn IS NULL OR ${alias}.turn IS NULL OR d.turn < ${alias}.turn
          OR (d.turn = ${alias}.turn AND (d.step IS NULL OR ${alias}.step IS NULL OR d.step < ${alias}.step))
        )
    )`;
    const manualCutoff = `EXISTS (
      SELECT 1 FROM auto_decisions m
      WHERE m.session_id = ${alias}.session_id
        AND m.action = 'manual-exit'
        AND m.ts <= ${alias}.ts
        AND (
          m.turn IS NULL OR ${alias}.turn IS NULL OR m.turn < ${alias}.turn
          OR (m.turn = ${alias}.turn AND (m.step IS NULL OR ${alias}.step IS NULL OR m.step < ${alias}.step))
        )
    )`;
    const decisionBased = `(CASE WHEN ${decisionBefore} AND NOT ${manualCutoff} THEN 'auto' ELSE 'manual' END)`;
    if (!effortSource) return decisionBased;
    return `(CASE
      WHEN ${alias}.effort_source = 'auto' THEN 'auto'
      WHEN ${alias}.effort_source IS NOT NULL AND ${alias}.effort_source <> '' THEN 'manual'
      ELSE ${decisionBased}
    END)`;
  };
  const usageGroups = () => {
    const columns = usageColumns();
    const modeExpr = modeExpression("u", columns.has("effort_source"));
    const hasEstimated = columns.has("reasoning_estimated") && columns.has("reasoning_source");
    const extraColumns = hasEstimated ? `,
                SUM(CASE WHEN u.reasoning_estimated IS NULL THEN 0 ELSE u.reasoning_estimated END) AS reasoning_estimated,
                SUM(CASE WHEN u.reasoning_source = 'api' THEN 1 ELSE 0 END) AS reasoning_api_rows,
                SUM(CASE WHEN u.reasoning_source = 'estimated' THEN 1 ELSE 0 END) AS reasoning_estimated_rows` : `,
                0 AS reasoning_estimated,
                0 AS reasoning_api_rows,
                0 AS reasoning_estimated_rows`;
    try {
      return store.all(
        `SELECT ${modeExpr} AS mode,
                COALESCE(u.reasoning_effort, 'unknown') AS effort,
                u.provider AS provider,
                u.model AS model,
                COUNT(*) AS calls,
                SUM(u.input_tokens) AS input_tokens,
                SUM(u.cache_read_tokens) AS cache_read_tokens,
                SUM(u.cache_write_tokens) AS cache_write_tokens,
                SUM(u.output_tokens) AS output_tokens,
                SUM(u.total_tokens) AS total_tokens,
                SUM(CASE WHEN u.reasoning_tokens IS NULL THEN 0 ELSE 1 END) AS reasoning_rows,
                SUM(CASE WHEN u.reasoning_tokens IS NULL THEN 0 ELSE u.reasoning_tokens END) AS reasoning_tokens
                ${extraColumns}
         FROM usage_records u
         WHERE u.source = 'live'
         GROUP BY mode, effort, u.provider, u.model`
      );
    } catch (error) {
      report("auto-store.usageGroups", error);
      return [];
    }
  };
  const modeTaskRows = () => {
    const modeExpr = modeExpression("u", usageColumns().has("effort_source"));
    try {
      return store.all(
        `SELECT CASE WHEN EXISTS (
                  SELECT 1 FROM usage_records u
                  WHERE u.task_id = t.id
                    AND u.source = 'live'
                    AND ${modeExpr} = 'auto'
                ) THEN 'auto' ELSE 'manual' END AS mode,
                COUNT(*) AS tasks,
                SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) AS failed,
                SUM(CASE WHEN t.status = 'aborted' THEN 1 ELSE 0 END) AS aborted
         FROM tasks t
         WHERE EXISTS (SELECT 1 FROM usage_records u2 WHERE u2.task_id = t.id AND u2.source = 'live')
         GROUP BY mode`
      );
    } catch (error) {
      report("auto-store.modeTaskRows", error);
      return [];
    }
  };
  const effortTasks = () => {
    try {
      return store.all(
        `SELECT COALESCE(reasoning_effort, 'unknown') AS effort, COUNT(DISTINCT task_id) AS tasks
         FROM usage_records
         WHERE source = 'live'
         GROUP BY effort`
      );
    } catch (error) {
      report("auto-store.effortTasks", error);
      return [];
    }
  };
  const summary = () => {
    const buckets = {
      auto: emptyBucket("auto"),
      manual: emptyBucket("manual")
    };
    const effortMap = /* @__PURE__ */ new Map();
    const provenance = {
      auto: { api: 0, estimated: 0, estimatedTokens: 0 },
      manual: { api: 0, estimated: 0, estimatedTokens: 0 }
    };
    const effortProvenance = /* @__PURE__ */ new Map();
    let costUnavailable = false;
    let estimateObserved = false;
    for (const row of usageGroups()) {
      const mode = row.mode === "auto" ? "auto" : "manual";
      const bucket = buckets[mode];
      const calls = Number(row.calls ?? 0);
      const inputTokens = Number(row.input_tokens ?? 0);
      const cacheReadTokens = Number(row.cache_read_tokens ?? 0);
      const cacheWriteTokens = Number(row.cache_write_tokens ?? 0);
      const outputTokens = Number(row.output_tokens ?? 0);
      const totalTokens = Number(row.total_tokens ?? 0);
      const reasoningRows = Number(row.reasoning_rows ?? 0);
      const reasoningTokens = Number(row.reasoning_tokens ?? 0);
      const estimatedTokens = Number(row.reasoning_estimated ?? 0);
      const apiReasoningRows = Number(row.reasoning_api_rows ?? 0);
      const estimatedReasoningRows = Number(row.reasoning_estimated_rows ?? 0);
      let cost = null;
      if (costs) {
        try {
          cost = costs.costOf(
            { inputTokens, cacheReadTokens, cacheWriteTokens, outputTokens },
            row.provider ?? null,
            row.model ?? null
          );
        } catch (error) {
          report("auto-store.costOf", error);
          cost = null;
        }
      }
      if (calls > 0 && cost === null) costUnavailable = true;
      bucket.calls += calls;
      bucket.inputTokens += inputTokens;
      bucket.outputTokens += outputTokens;
      bucket.cacheReadTokens = (bucket.cacheReadTokens ?? 0) + cacheReadTokens;
      bucket.totalTokens += totalTokens;
      if (cost !== null) bucket.cost = (bucket.cost ?? 0) + cost;
      if (reasoningRows > 0) bucket.reasoningTokens = (bucket.reasoningTokens ?? 0) + reasoningTokens;
      const modeProvenance = provenance[mode];
      modeProvenance.api += apiReasoningRows;
      modeProvenance.estimated += estimatedReasoningRows;
      modeProvenance.estimatedTokens += estimatedTokens;
      if (estimatedReasoningRows > 0) estimateObserved = true;
      const effortKey = String(row.effort ?? "unknown");
      let effortBucket = effortMap.get(effortKey);
      if (!effortBucket) {
        effortBucket = {
          effort: effortKey,
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          reasoningTokens: null,
          reasoningEstimatedTokens: null,
          reasoningSource: null,
          cacheReadTokens: 0,
          totalTokens: 0,
          cost: null,
          tasks: 0
        };
        effortMap.set(effortKey, effortBucket);
      }
      effortBucket.calls += calls;
      effortBucket.inputTokens += inputTokens;
      effortBucket.outputTokens += outputTokens;
      effortBucket.cacheReadTokens = (effortBucket.cacheReadTokens ?? 0) + cacheReadTokens;
      effortBucket.totalTokens += totalTokens;
      if (cost !== null) effortBucket.cost = (effortBucket.cost ?? 0) + cost;
      if (reasoningRows > 0) effortBucket.reasoningTokens = (effortBucket.reasoningTokens ?? 0) + reasoningTokens;
      let effortEntry = effortProvenance.get(effortKey);
      if (!effortEntry) {
        effortEntry = { api: 0, estimated: 0, estimatedTokens: 0 };
        effortProvenance.set(effortKey, effortEntry);
      }
      effortEntry.api += apiReasoningRows;
      effortEntry.estimated += estimatedReasoningRows;
      effortEntry.estimatedTokens += estimatedTokens;
    }
    for (const key of ["auto", "manual"]) {
      const prov = provenance[key];
      const bucket = buckets[key];
      bucket.reasoningSource = prov.estimated > 0 ? "estimated" : prov.api > 0 ? "api" : null;
      bucket.reasoningEstimatedTokens = prov.estimated > 0 ? prov.estimatedTokens : null;
    }
    for (const [effortKey, effortBucket] of effortMap) {
      const prov = effortProvenance.get(effortKey);
      effortBucket.reasoningSource = prov && prov.estimated > 0 ? "estimated" : prov && prov.api > 0 ? "api" : null;
      effortBucket.reasoningEstimatedTokens = prov && prov.estimated > 0 ? prov.estimatedTokens : null;
    }
    for (const row of effortTasks()) {
      const bucket = effortMap.get(String(row.effort));
      if (bucket) bucket.tasks = Number(row.tasks ?? 0);
    }
    for (const row of modeTaskRows()) {
      const mode = row.mode === "auto" ? "auto" : "manual";
      const bucket = buckets[mode];
      const tasks = Number(row.tasks ?? 0);
      const completed = Number(row.completed ?? 0);
      const finished = completed + Number(row.failed ?? 0) + Number(row.aborted ?? 0);
      bucket.tasks = tasks;
      bucket.successRate = finished > 0 ? Math.round(completed / finished * 1e3) / 1e3 : null;
      bucket.avgTokensPerTask = tasks > 0 ? Math.round(bucket.totalTokens / tasks) : null;
    }
    const order = [...EFFORT_LEVELS, "unknown"];
    const byEffort = [...effortMap.values()].sort((left, right) => {
      const leftIndex = order.indexOf(left.effort);
      const rightIndex = order.indexOf(right.effort);
      return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
    });
    const stats = counts();
    const notes = [
      "Token \u6570\u5B57\u6765\u81EA API usage\uFF1Breasoning_tokens \u4EC5\u5728 API \u8FD4\u56DE\u65F6\u8BB0\u5F55\uFF0C\u7F3A\u5931\u4E3A NULL\uFF08\u4E0D\u4F30\u7B97\uFF09\u3002",
      "reasoning_estimated \u662F\u63A8\u7406\u6587\u672C\u7684\u754C\u9762\u4F30\u7B97\u503C\uFF08\u975E API \u5B57\u6BB5\uFF09\uFF0C\u4EE5 reasoningSource \u6807\u6CE8\u6765\u6E90\u3002",
      "\u8D39\u7528\u6309\u8BBE\u7F6E\u4E2D\u7684\u4EF7\u683C\u914D\u7F6E\u8BA1\u7B97\uFF08\u53C2\u8003\u4EF7\uFF0C\u975E\u5B9E\u65F6\u8D26\u5355\uFF09\uFF1B\u672A\u914D\u7F6E\u4EF7\u683C\u65F6 cost \u4E3A null\u3002"
    ];
    return {
      generatedAt: now(),
      auto: buckets.auto,
      manual: buckets.manual,
      byEffort,
      decisions: stats.decisions,
      escalations: stats.escalations,
      applied: stats.applied,
      monitorOnly: scalar(
        "SELECT COUNT(*) AS value FROM auto_decisions WHERE applied = 0 AND action IN ('classify', 'escalate')"
      ),
      estimates: costUnavailable || estimateObserved,
      notes
    };
  };
  return {
    ddl: AUTO_DECISIONS_DDL,
    recordDecision,
    updateDecisionTurn,
    listDecisions,
    lastDecision,
    counts,
    ensureSession,
    setSession,
    getSession,
    summary
  };
}

// src/host/auto-scheduler.ts
var PATH_KEYS2 = ["path", "file_path", "filePath", "target_path", "targetPath", "file", "target", "notebook_path", "directory"];
var COMMAND_KEYS2 = ["command", "cmd", "script", "shell", "commandLine", "command_line"];
var BUILD_REGEXES = BUILD_PATTERNS.map((pattern) => new RegExp(pattern, "i"));
var TEST_REGEXES = TEST_PATTERNS.map((pattern) => new RegExp(pattern, "i"));
var COMMAND_EXIT_REGEX = /\[exit code:\s*[1-9]\d*\]|\bexit code\s*[:=]?\s*[1-9]\d*\b|command failed with exit code|process exited with (?:code\s*)?[1-9]\d*/i;
var COMMAND_FAILURE_HINT_REGEX = /error|failed|失败|错误|异常|exception|assert|not found|不存在|不是内部|无法|cannot|denied|拒绝/i;
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}
function contentText2(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const item = block;
    if (item.type === "text" && typeof item.text === "string") parts.push(item.text);
    else if (item.type === "image") parts.push("[image]");
    else if (item.type === "file") parts.push("[file]");
  }
  return parts.join("\n");
}
function safeStringify2(value) {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
}
function extractPath2(args) {
  if (!args || typeof args !== "object") return null;
  const record = args;
  for (const key of PATH_KEYS2) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  return null;
}
function extractCommand2(args) {
  if (!args || typeof args !== "object") return null;
  const record = args;
  for (const key of COMMAND_KEYS2) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  return null;
}
function parseArguments(raw) {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}
function includesTool(list, name2) {
  return list.includes(name2);
}
function matchesAny(patterns, text) {
  return patterns.some((pattern) => pattern.test(text));
}
function emptyEvidence() {
  return {
    files: /* @__PURE__ */ new Set(),
    readFiles: /* @__PURE__ */ new Set(),
    tools: /* @__PURE__ */ new Set(),
    failures: 0,
    environmentFailures: 0,
    reasoningFailures: 0,
    failureKinds: /* @__PURE__ */ new Set(),
    steps: 0,
    signals: /* @__PURE__ */ new Set(),
    verificationFailures: 0,
    failedCommands: /* @__PURE__ */ new Set(),
    seenFailureCalls: /* @__PURE__ */ new Set(),
    failureVersion: 0,
    version: 0
  };
}
function boundedAdd(set, value, max = 200) {
  if (set.size >= max && !set.has(value)) return;
  set.add(value);
}
function createAutoScheduler(deps) {
  const { store, settings } = deps;
  const now = deps.now ?? (() => Date.now());
  const reportError = (where, error) => {
    try {
      deps.recordError(where, error);
    } catch {
    }
  };
  const autoStore = createAutoStore(store, {
    costs: deps.costs,
    now,
    onError: (where, error) => {
      try {
        deps.logger?.warn?.(`[token-manager] ${where} failed:`, String(error?.message ?? error));
      } catch {
      }
    }
  });
  const states = /* @__PURE__ */ new Map();
  const expectations = /* @__PURE__ */ new Map();
  const currentConfig = () => {
    try {
      const raw = settings.get()?.auto;
      return resolveAutoConfig(raw);
    } catch (error) {
      reportError("auto.config", error);
      return resolveAutoConfig(void 0);
    }
  };
  const persistEnabled = (enabled) => {
    try {
      settings.update({ auto: { enabled } });
      return currentConfig().enabled;
    } catch (error) {
      reportError("auto.persistEnabled", error);
      return currentConfig().enabled;
    }
  };
  const pruneStates = (max) => {
    while (states.size > max) {
      let oldestId = null;
      let oldestAt = Number.POSITIVE_INFINITY;
      for (const [id, state] of states) {
        if (state.lastSeenAt < oldestAt) {
          oldestAt = state.lastSeenAt;
          oldestId = id;
        }
      }
      if (!oldestId) break;
      states.delete(oldestId);
    }
  };
  const createState = (sessionId, session, isSubagent) => {
    const state = {
      sessionId,
      session,
      taskType: "normal-dev",
      confidence: 0,
      reasons: [],
      effort: "low",
      provider: null,
      model: null,
      observedEffort: null,
      stage: 0,
      turn: null,
      step: 0,
      isSubagent,
      active: false,
      manual: false,
      startedAt: now(),
      lastSeenAt: now(),
      evidence: emptyEvidence(),
      usedRules: /* @__PURE__ */ new Set(),
      reasoningEscalations: 0,
      classifyDecisionId: null,
      classifyLinked: false,
      lastDecision: null,
      lastHoldVersion: -1,
      lastHoldFailureVersion: -1,
      lastHoldKey: null,
      pendingTexts: [],
      calls: /* @__PURE__ */ new Map()
    };
    states.set(sessionId, state);
    return state;
  };
  const resetForNewTask = (state, isSubagent) => {
    state.evidence = emptyEvidence();
    state.stage = 0;
    state.turn = null;
    state.step = 0;
    state.isSubagent = isSubagent;
    state.active = true;
    state.manual = false;
    state.startedAt = now();
    state.usedRules = /* @__PURE__ */ new Set();
    state.reasoningEscalations = 0;
    state.classifyDecisionId = null;
    state.classifyLinked = false;
    state.lastHoldVersion = -1;
    state.lastHoldFailureVersion = -1;
    state.lastHoldKey = null;
    state.observedEffort = null;
    state.calls = /* @__PURE__ */ new Map();
    state.lastDecision = null;
  };
  const getAgent = (sessionId) => {
    try {
      const agents = deps.ctx?.get?.("agents");
      if (!agents || typeof agents.get !== "function") return null;
      const agent = agents.get(sessionId);
      return agent && typeof agent === "object" ? agent : null;
    } catch {
      return null;
    }
  };
  const sessionIdOf4 = (agent) => {
    try {
      const id = agent?.session?.id ?? agent?.session?.header?.id ?? agent?.id;
      return typeof id === "string" && id.length > 0 ? id : null;
    } catch {
      return null;
    }
  };
  const isSubagentAgent = (agent) => {
    try {
      const header = isRecord2(agent?.session?.header) ? agent.session.header : {};
      if (header.origin === "subagent") return true;
      if (typeof header.parentSession === "string" && header.parentSession.length > 0) return true;
      if (typeof header.parentSessionId === "string" && header.parentSessionId.length > 0) return true;
      return false;
    } catch {
      return false;
    }
  };
  const currentSelection = (agent) => {
    try {
      const model = agent?.model;
      if (!model || typeof model.current !== "function") return null;
      const current = model.current();
      if (!current || typeof current.provider !== "string" || typeof current.model !== "string") return null;
      return {
        provider: current.provider,
        model: current.model,
        effort: typeof current.reasoningEffort === "string" ? current.reasoningEffort : null
      };
    } catch (error) {
      reportError("auto.model.current", error);
      return null;
    }
  };
  const pushExpectation = (sessionId, selection) => {
    const list = expectations.get(sessionId) ?? [];
    list.push(selection);
    while (list.length > 8) list.shift();
    expectations.set(sessionId, list);
  };
  const consumeExpectation = (sessionId, selection) => {
    const list = expectations.get(sessionId);
    if (!list || list.length === 0) return false;
    const index = list.findIndex(
      (item) => item.provider === selection.provider && item.model === selection.model && (item.effort ?? null) === (selection.effort ?? null)
    );
    if (index < 0) return false;
    list.splice(index, 1);
    if (list.length === 0) expectations.delete(sessionId);
    return true;
  };
  const selectEffort = (agent, sessionId, effort, config) => {
    const selection = currentSelection(agent);
    if (!agent) return { applied: false, fromEffort: null, reason: "no-agent" };
    if (!selection) return { applied: false, fromEffort: null, reason: "no-selection" };
    if (config.monitorOnly) return { applied: false, fromEffort: selection.effort, reason: "monitor" };
    if (selection.effort === effort) return { applied: true, fromEffort: selection.effort, reason: "already" };
    try {
      pushExpectation(sessionId, { provider: selection.provider, model: selection.model, effort });
      const model = agent.model;
      model.select({ provider: selection.provider, model: selection.model, reasoningEffort: effort });
      return { applied: true, fromEffort: selection.effort, reason: "ok" };
    } catch (error) {
      reportError("auto.model.select", error);
      return { applied: false, fromEffort: selection.effort, reason: "error" };
    }
  };
  const evidenceOf = (state) => ({
    files: [...state.evidence.files].slice(0, 50),
    tools: [...state.evidence.tools].slice(0, 50),
    failures: state.evidence.failures,
    environmentFailures: state.evidence.environmentFailures,
    reasoningFailures: state.evidence.reasoningFailures,
    failureKinds: [...state.evidence.failureKinds].slice(0, 20),
    steps: state.evidence.steps,
    signals: [...state.evidence.signals].slice(0, 30)
  });
  const record = (state, input) => {
    const decision = autoStore.recordDecision({
      sessionId: state.sessionId,
      turn: input.turn === void 0 ? state.turn : input.turn,
      step: input.step === void 0 ? state.step : input.step,
      taskType: state.taskType,
      fromEffort: input.fromEffort ?? state.observedEffort ?? state.effort,
      toEffort: input.toEffort ?? state.effort,
      stage: input.stage === void 0 ? state.stage : input.stage,
      action: input.action,
      reasons: input.reasons ?? state.reasons,
      evidence: evidenceOf(state),
      applied: input.applied === true
    });
    state.lastDecision = decision;
    return decision;
  };
  const markInboxTarget = (agent, message) => {
    try {
      const inbox = agent?.inbox;
      const id = message?.id;
      if (!inbox || typeof id !== "string") return null;
      const nextStep = inbox.nextStep;
      if (Array.isArray(nextStep) && nextStep.some((item) => item?.id === id)) return "next-step";
      const nextTurn = inbox.nextTurn;
      if (Array.isArray(nextTurn) && nextTurn.some((item) => item?.id === id)) return "next-turn";
      return null;
    } catch {
      return null;
    }
  };
  const applyNewTask = (state, agent, text, isSubagent, turn) => {
    const config = currentConfig();
    const classification = classifyTask(text, { isSubagent, config });
    resetForNewTask(state, isSubagent);
    state.taskType = classification.taskType;
    state.confidence = classification.confidence;
    state.reasons = classification.reasons;
    state.turn = turn;
    state.effort = classification.effort;
    state.active = true;
    const selection = currentSelection(agent);
    const fromEffort = selection?.effort ?? null;
    if (selection) {
      state.provider = selection.provider;
      state.model = selection.model;
    }
    const result = selectEffort(agent, state.sessionId, classification.effort, config);
    let decision = record(state, {
      action: "classify",
      turn,
      step: 0,
      fromEffort,
      toEffort: classification.effort,
      stage: 0,
      reasons: classification.reasons,
      applied: result.applied
    });
    if (turn !== null) {
      state.classifyLinked = true;
    } else {
      state.classifyDecisionId = decision.id;
    }
    try {
      autoStore.setSession(state.sessionId, {
        enabled: true,
        startedAt: now(),
        lastTaskType: classification.taskType,
        lastEffort: classification.effort
      });
    } catch (error) {
      reportError("auto.setSession", error);
    }
  };
  const handleInboxInserted = (payload) => {
    try {
      const config = currentConfig();
      if (!config.enabled) return;
      const agent = payload?.agent;
      const message = payload?.message;
      if (!agent || !message) return;
      const source = isRecord2(message.source) ? message.source : {};
      if (source.kind !== "user") return;
      const sessionId = sessionIdOf4(agent);
      if (!sessionId) return;
      const isSubagent = isSubagentAgent(agent);
      if (isSubagent && !config.includeSubagents) return;
      const text = contentText2(message.content).slice(0, AUTO_TEXT_LIMIT);
      const existing = states.get(sessionId);
      if (existing?.manual) return;
      const target = markInboxTarget(agent, message);
      const running = agent?.status === "running";
      pruneStates(config.maxTrackedSessions);
      if (existing && existing.active && (target === "next-step" || target === null && running)) {
        handleSteer(existing, agent, text, isSubagent, config);
        return;
      }
      if (target === "next-turn" && running) {
        const state2 = existing ?? createState(sessionId, agent.session ?? null, isSubagent);
        state2.lastSeenAt = now();
        state2.pendingTexts.push(text);
        while (state2.pendingTexts.length > 8) state2.pendingTexts.shift();
        return;
      }
      const state = existing ?? createState(sessionId, agent.session ?? null, isSubagent);
      state.lastSeenAt = now();
      state.session = agent.session ?? state.session;
      applyNewTask(state, agent, text, isSubagent, null);
    } catch (error) {
      reportError("auto.inbox/inserted", error);
    }
  };
  const handleSteer = (state, agent, text, isSubagent, config) => {
    try {
      const classification = classifyTask(text, { isSubagent, config });
      const currentRank = effortRank(state.effort, config.ladder);
      const targetRank = effortRank(classification.effort, config.ladder);
      state.lastSeenAt = now();
      if (targetRank <= currentRank) return;
      if (state.stage >= config.maxEscalationsPerTask) return;
      const up = oneStepUp(state.effort, config.ladder);
      if (!up) return;
      const selection = currentSelection(agent);
      const fromEffort = selection?.effort ?? state.effort;
      if (selection) {
        state.provider = selection.provider;
        state.model = selection.model;
      }
      const result = selectEffort(agent, state.sessionId, up, config);
      state.effort = up;
      state.stage += 1;
      record(state, {
        action: "escalate",
        fromEffort,
        toEffort: up,
        stage: state.stage,
        reasons: [`\u4EFB\u52A1\u4E2D\u6536\u5230\u66F4\u590D\u6742\u6307\u4EE4\uFF08${classification.taskType}\uFF09\uFF0C\u5347\u4E00\u6863`, ...classification.reasons.slice(0, 2)],
        applied: result.applied
      });
    } catch (error) {
      reportError("auto.steer", error);
    }
  };
  const handlePreStep = async (payload, next) => {
    let decision;
    try {
      decision = await next();
    } catch (error) {
      throw error;
    }
    try {
      const config = currentConfig();
      if (!config.enabled) return decision;
      const agent = payload?.agent;
      const sessionId = sessionIdOf4(agent);
      if (!sessionId) return decision;
      const state = states.get(sessionId);
      if (!state || state.manual) return decision;
      const turn = asNumber(payload?.turn);
      const step = asNumber(payload?.step);
      if (turn !== null) state.turn = turn;
      if (step !== null) state.step = step;
      const modelSelection = isRecord2(payload?.modelSelection) ? payload.modelSelection : null;
      if (modelSelection && typeof modelSelection.reasoningEffort === "string") {
        state.observedEffort = modelSelection.reasoningEffort;
      }
      if (step !== null) state.evidence.steps = Math.max(state.evidence.steps, step);
      state.lastSeenAt = now();
      if (decision?.kind === "reject" || payload?.signal?.aborted === true) return decision;
      const evaluation = evaluateEscalation({
        taskType: state.taskType,
        effort: state.effort,
        stage: state.stage,
        evidence: {
          // files 规则只统计写入的文件；只读文件走更严格的 read-analysis 规则。
          files: state.evidence.files.size,
          readFiles: state.evidence.readFiles.size,
          reasoningFailures: state.evidence.reasoningFailures,
          environmentFailures: state.evidence.environmentFailures,
          steps: Math.max(state.evidence.steps, state.step),
          verificationFailures: state.evidence.verificationFailures,
          failedCommands: state.evidence.failedCommands.size,
          failureKinds: [...state.evidence.failureKinds]
        },
        usedRules: state.usedRules,
        reasoningEscalations: state.reasoningEscalations,
        config
      });
      if (evaluation.action === "escalate") {
        const selection = currentSelection(agent);
        if (selection) {
          state.provider = selection.provider;
          state.model = selection.model;
        }
        const fromEffort = state.observedEffort ?? selection?.effort ?? state.effort;
        const result = selectEffort(agent, sessionId, evaluation.toEffort, config);
        state.effort = evaluation.toEffort;
        state.stage += 1;
        if (evaluation.rule) state.usedRules.add(evaluation.rule);
        if (evaluation.rule === "reasoning") state.reasoningEscalations += 1;
        record(state, {
          action: "escalate",
          turn,
          step,
          fromEffort,
          toEffort: evaluation.toEffort,
          stage: state.stage,
          reasons: evaluation.reasons,
          applied: result.applied
        });
        return decision;
      }
      if (evaluation.reasons.length > 0 && state.evidence.failureVersion > state.lastHoldFailureVersion) {
        const key = `${state.turn ?? "?"}#${state.step}`;
        record(state, {
          action: "hold",
          turn,
          step,
          fromEffort: state.observedEffort ?? state.effort,
          toEffort: state.effort,
          reasons: evaluation.reasons,
          applied: false
        });
        state.lastHoldFailureVersion = state.evidence.failureVersion;
        state.lastHoldVersion = state.evidence.version;
        state.lastHoldKey = key;
      }
      return decision;
    } catch (error) {
      reportError("auto.pre-step", error);
      return decision;
    }
  };
  const handleExternalSelection = (sessionId, event, config) => {
    const data = isRecord2(event?.data) ? event.data : {};
    const selection = {
      provider: typeof data.provider === "string" ? data.provider : "",
      model: typeof data.model === "string" ? data.model : "",
      effort: typeof data.reasoningEffort === "string" ? data.reasoningEffort : null
    };
    if (consumeExpectation(sessionId, selection)) return;
    const state = states.get(sessionId);
    if (!state || state.manual) return;
    if (selection.effort !== null && selection.effort === state.effort) return;
    state.manual = true;
    state.active = false;
    state.pendingTexts = [];
    state.lastSeenAt = now();
    try {
      autoStore.setSession(sessionId, { enabled: false, lastTaskType: state.taskType, lastEffort: selection.effort ?? state.effort });
    } catch (error) {
      reportError("auto.manual.setSession", error);
    }
    record(state, {
      action: "manual-exit",
      fromEffort: state.effort,
      toEffort: selection.effort ?? state.effort,
      stage: state.stage,
      reasons: ["\u68C0\u6D4B\u5230\u7528\u6237\u5728\u6A21\u578B\u9009\u62E9\u5668\u4E2D\u624B\u52A8\u9009\u62E9\u6863\u4F4D\uFF0CAUTO \u9000\u51FA"],
      applied: false
    });
    persistEnabled(false);
    void config;
  };
  const handleTurnStart = (sessionId, event) => {
    const state = states.get(sessionId);
    if (!state) return;
    const data = isRecord2(event?.data) ? event.data : {};
    const turn = asNumber(data.turn);
    if (turn === null) return;
    state.turn = turn;
    if (state.classifyDecisionId !== null && !state.classifyLinked) {
      try {
        autoStore.updateDecisionTurn(state.classifyDecisionId, turn);
      } catch (error) {
        reportError("auto.turnStart.linkDecision", error);
      }
      state.classifyLinked = true;
    }
    if (state.pendingTexts.length === 0) {
      state.lastSeenAt = now();
      return;
    }
    const text = state.pendingTexts.shift() ?? "";
    const agent = getAgent(sessionId);
    applyNewTask(state, agent, text, state.isSubagent, turn);
  };
  const handleToolCall = (state, event) => {
    const data = isRecord2(event?.data) ? event.data : {};
    const name2 = typeof data.name === "string" && data.name ? data.name : "unknown";
    const args = parseArguments(data.arguments);
    const callId = typeof data.callId === "string" ? data.callId : null;
    boundedAdd(state.evidence.tools, name2, 50);
    const target = extractPath2(args);
    if (target) {
      if (includesTool(WRITE_TOOLS, name2)) boundedAdd(state.evidence.files, target);
      else if (includesTool(READ_TOOLS, name2)) boundedAdd(state.evidence.readFiles, target);
    }
    const command = includesTool(COMMAND_TOOLS, name2) ? extractCommand2(args) : null;
    if (callId) {
      state.calls.set(callId, { tool: name2, command, target, ts: now() });
      while (state.calls.size > 200) {
        const oldest = state.calls.keys().next().value;
        if (oldest === void 0) break;
        state.calls.delete(oldest);
      }
    }
    state.evidence.version += 1;
  };
  const handleToolResult = (state, event) => {
    const data = isRecord2(event?.data) ? event.data : {};
    const message = isRecord2(data.message) ? data.message : {};
    const callId = (typeof message.toolCallId === "string" ? message.toolCallId : null) ?? (typeof data.callId === "string" ? data.callId : null);
    const call = callId ? state.calls.get(callId) ?? null : null;
    const toolName = call?.tool ?? (typeof data.name === "string" ? data.name : null);
    const isError = message.isError === true || data.error !== void 0 && data.error !== null;
    const parts = [];
    const content = message.content;
    if (typeof content === "string") parts.push(content);
    if (Array.isArray(content)) {
      for (const block of content) {
        if (!block || typeof block !== "object") continue;
        const item = block;
        if (typeof item.text === "string") parts.push(item.text);
        else if (item.type === "image") parts.push("[image]");
      }
    }
    if (data.error !== void 0 && data.error !== null) parts.push(safeStringify2(data.error));
    if (parts.length === 0) parts.push(safeStringify2(content ?? data));
    const text = parts.join("\n").slice(0, 8e3);
    let commandFailure = false;
    if (!isError && toolName !== null && includesTool(COMMAND_TOOLS, toolName)) {
      if (COMMAND_EXIT_REGEX.test(text)) {
        commandFailure = COMMAND_FAILURE_HINT_REGEX.test(text);
      } else {
        commandFailure = classifyFailure(text).environment;
      }
    }
    if (!isError && !commandFailure) return;
    if (callId) {
      if (state.evidence.seenFailureCalls.has(callId)) return;
      boundedAdd(state.evidence.seenFailureCalls, callId, 200);
    }
    const failure = classifyFailure(text);
    state.evidence.failures += 1;
    state.evidence.version += 1;
    state.evidence.failureVersion += 1;
    boundedAdd(state.evidence.failureKinds, failure.kind, 20);
    if (failure.environment) {
      state.evidence.environmentFailures += 1;
      boundedAdd(state.evidence.signals, `env:${failure.kind}`, 30);
    } else {
      state.evidence.reasoningFailures += 1;
      boundedAdd(state.evidence.signals, `reason:${failure.kind}`, 30);
      const commandText = call?.command ?? "";
      if (commandText && (matchesAny(BUILD_REGEXES, commandText) || matchesAny(TEST_REGEXES, commandText))) {
        state.evidence.verificationFailures += 1;
        boundedAdd(state.evidence.failedCommands, normalizeCommand(commandText), 20);
        boundedAdd(state.evidence.signals, `failed-command:${normalizeCommand(commandText)}`, 30);
      }
    }
  };
  const handleSessionEvent = (session, event) => {
    try {
      const config = currentConfig();
      if (!config.enabled) return;
      const sessionId = typeof session?.id === "string" ? session.id : null;
      const type = typeof event?.type === "string" ? event.type : "";
      if (!sessionId || !type) return;
      if (type === "model/selection") {
        handleExternalSelection(sessionId, event, config);
        return;
      }
      const state = states.get(sessionId);
      if (!state || state.manual) return;
      state.lastSeenAt = now();
      const data = isRecord2(event?.data) ? event.data : {};
      switch (type) {
        case "turn/start":
          handleTurnStart(sessionId, event);
          return;
        case "step/start": {
          const turn = asNumber(data.turn);
          const step = asNumber(data.step);
          if (turn !== null) state.turn = turn;
          if (step !== null) {
            state.step = step;
            state.evidence.steps = Math.max(state.evidence.steps, step);
          }
          state.evidence.version += 1;
          return;
        }
        case "request/header": {
          const header = isRecord2(data.header) ? data.header : null;
          const headerConfig = isRecord2(header?.config) ? header.config : isRecord2(data.config) ? data.config : null;
          if (headerConfig) {
            if (typeof headerConfig.reasoningEffort === "string") state.observedEffort = headerConfig.reasoningEffort;
            if (typeof headerConfig.provider === "string") state.session = state.session ?? session;
          }
          return;
        }
        case "tool/call":
          handleToolCall(state, event);
          return;
        case "tool/result":
          handleToolResult(state, event);
          return;
        case "turn/end": {
          const turn = asNumber(data.turn);
          if (turn !== null) state.turn = turn;
          state.active = false;
          state.pendingTexts = [];
          return;
        }
        default:
          return;
      }
    } catch (error) {
      reportError("auto.session/event", error);
    }
  };
  const status = (sessionId) => {
    const config = currentConfig();
    let resolvedId = typeof sessionId === "string" && sessionId ? sessionId : null;
    if (!resolvedId) {
      let newest = -1;
      for (const [id, state2] of states) {
        if (state2.lastSeenAt > newest) {
          newest = state2.lastSeenAt;
          resolvedId = id;
        }
      }
    }
    const state = resolvedId ? states.get(resolvedId) ?? null : null;
    const agent = resolvedId ? getAgent(resolvedId) : null;
    const live = currentSelection(agent);
    let current = null;
    if (live) current = { provider: live.provider, model: live.model, effort: live.effort };
    else if (state?.provider && state.model) {
      current = { provider: state.provider, model: state.model, effort: state.effort };
    }
    const mode = state?.manual ? "manual" : !config.enabled ? "off" : "auto";
    return {
      enabled: config.enabled,
      sessionId: resolvedId,
      mode,
      current,
      supportedEfforts: [...config.ladder],
      task: state ? {
        type: state.taskType,
        stage: state.stage,
        effort: state.effort,
        confidence: state.confidence,
        reasons: state.reasons
      } : null,
      lastDecision: resolvedId ? autoStore.lastDecision(resolvedId) : autoStore.lastDecision(null),
      estimates: false
    };
  };
  const summary = () => autoStore.summary();
  const classify2 = (text, options) => classifyTask(typeof text === "string" ? text : "", {
    isSubagent: options?.isSubagent === true,
    config: currentConfig()
  });
  const setEnabled = (enabled) => {
    try {
      const next = persistEnabled(enabled === true);
      if (!next) {
        for (const state of states.values()) {
          state.active = false;
          state.pendingTexts = [];
        }
      } else {
        for (const state of states.values()) {
          state.manual = false;
          state.active = false;
        }
      }
      return next;
    } catch (error) {
      reportError("auto.setEnabled", error);
      return false;
    }
  };
  const markManual = (sessionId) => {
    try {
      if (typeof sessionId !== "string" || !sessionId) return false;
      let state = states.get(sessionId);
      if (!state) {
        state = createState(sessionId, null, false);
      }
      state.manual = true;
      state.active = false;
      state.pendingTexts = [];
      state.lastSeenAt = now();
      autoStore.setSession(sessionId, { enabled: false, lastTaskType: state.taskType, lastEffort: state.effort });
      record(state, {
        action: "manual-exit",
        fromEffort: state.effort,
        toEffort: state.effort,
        stage: state.stage,
        reasons: ["\u7528\u6237\u624B\u52A8\u9000\u51FA AUTO\uFF08\u8BE5\u4F1A\u8BDD\u6062\u590D\u624B\u52A8\u9009\u62E9\uFF09"],
        applied: false
      });
      persistEnabled(false);
      return true;
    } catch (error) {
      reportError("auto.markManual", error);
      return false;
    }
  };
  const effortFor = (sessionId, turn, step) => {
    try {
      if (typeof sessionId !== "string" || !sessionId) return null;
      const decisions2 = autoStore.listDecisions({ sessionId, limit: 200 });
      const reqTurn = asNumber(turn);
      const reqStep = asNumber(step);
      for (const decision of decisions2) {
        if (!isDecisionAtOrBefore(decision, reqTurn, reqStep)) continue;
        if (decision.action === "manual-exit") return null;
        if (!decision.applied) continue;
        if (decision.action !== "classify" && decision.action !== "escalate") continue;
        return { effort: decision.toEffort, applied: true };
      }
      return null;
    } catch (error) {
      reportError("auto.effortFor", error);
      return null;
    }
  };
  const decisions = (query = {}) => autoStore.listDecisions(query);
  const scheduler = {
    handleInboxInserted,
    handlePreStep,
    handleSessionEvent,
    setEnabled,
    markManual,
    status,
    summary,
    classify: classify2,
    effortFor,
    decisions
  };
  return scheduler;
}
function isDecisionAtOrBefore(decision, turn, step) {
  if (turn === null || decision.turn === null) return true;
  if (decision.turn < turn) return true;
  if (decision.turn > turn) return false;
  if (step === null || decision.step === null) return true;
  return decision.step < step;
}
function normalizeCommand(command) {
  return command.trim().replace(/\s+/g, " ").slice(0, 120);
}

// src/host/auto-api.ts
var MAX_BODY_BYTES2 = 64 * 1024;
var MAX_DECISIONS = 500;
var DEFAULT_DECISIONS = 100;
var AutoHttpError = class extends Error {
  status;
  code;
  allow;
  constructor(status, code, message, allow) {
    super(message);
    this.status = status;
    this.code = code;
    this.allow = allow;
  }
};
function sendJson2(res, status, payload, extraHeaders = {}) {
  if (res.writableEnded) return;
  const body = JSON.stringify(payload);
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders
  };
  res.writeHead?.(status, headers);
  res.end?.(body);
}
function sendOk2(res, data) {
  sendJson2(res, 200, { ok: true, data: data === void 0 ? null : data });
}
function sendError2(res, status, code, message, allow) {
  const headers = {};
  if (allow && allow.length > 0) headers.Allow = allow.join(", ");
  sendJson2(res, status, { ok: false, error: { code, message } }, headers);
}
function readBody2(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const cleanup = () => {
      req.removeListener?.("data", onData);
      req.removeListener?.("end", onEnd);
      req.removeListener?.("error", onError);
    };
    const onData = (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES2) {
        settled = true;
        cleanup();
        resolve({ ok: false });
        req.resume?.();
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ ok: true, text: Buffer.concat(chunks).toString("utf8") });
    };
    const onError = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    req.on?.("data", onData);
    req.on?.("end", onEnd);
    req.on?.("error", onError);
  });
}
async function readJsonBody2(req) {
  const result = await readBody2(req);
  if (!result.ok) throw new AutoHttpError(413, "PAYLOAD_TOO_LARGE", "\u8BF7\u6C42\u4F53\u8D85\u8FC7 64KB \u4E0A\u9650");
  const text = result.text.trim();
  if (!text) return {};
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AutoHttpError(400, "INVALID_JSON", "\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AutoHttpError(400, "INVALID_BODY", "\u8BF7\u6C42\u4F53\u5FC5\u987B\u662F JSON \u5BF9\u8C61");
  }
  return parsed;
}
function normalizeAutoPath(pathname) {
  let path = typeof pathname === "string" && pathname ? pathname : "/";
  const marker = "/auto/";
  const index = path.indexOf(marker);
  if (index >= 0) {
    path = path.slice(index + marker.length - 1);
  } else if (path.endsWith("/auto")) {
    path = "/";
  }
  path = path.replace(/\/+$/, "");
  return path || "/";
}
function readSessionId(params) {
  const value = params.get("sessionId");
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function readLimit(params) {
  const raw = params.get("limit");
  if (raw === null || raw === "") return DEFAULT_DECISIONS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new AutoHttpError(400, "INVALID_PARAM", "limit \u5FC5\u987B\u662F\u6570\u5B57");
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_DECISIONS);
}
function readBooleanField(body, name2) {
  const value = body[name2];
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  throw new AutoHttpError(400, "INVALID_PARAM", `${name2} \u5FC5\u987B\u662F\u5E03\u5C14\u503C`);
}
function readStringField(body, name2, required) {
  const value = body[name2];
  if (value === void 0 || value === null || value === "") {
    if (required) throw new AutoHttpError(400, "MISSING_PARAM", `${name2} \u5FC5\u586B`);
    return null;
  }
  if (typeof value !== "string") throw new AutoHttpError(400, "INVALID_PARAM", `${name2} \u5FC5\u987B\u662F\u5B57\u7B26\u4E32`);
  return value;
}
function requireMethod(method, expected, allow) {
  if (method !== expected) throw new AutoHttpError(405, "METHOD_NOT_ALLOWED", `\u4EC5\u652F\u6301 ${expected}`, allow);
}
function parseUrl(req, url) {
  if (url instanceof URL) return url;
  try {
    return new URL(String(req.url ?? "/"), "http://localhost");
  } catch {
    throw new AutoHttpError(400, "INVALID_URL", "\u65E0\u6CD5\u89E3\u6790\u8BF7\u6C42 URL");
  }
}
function createAutoApi(deps) {
  const { scheduler } = deps;
  const queries = scheduler;
  let fallbackStore = null;
  const decisionsOf = (sessionId, limit) => {
    if (typeof queries.decisions === "function") {
      try {
        return queries.decisions({ sessionId, limit });
      } catch {
        return [];
      }
    }
    if (!deps.store) return [];
    try {
      fallbackStore ??= createAutoStore(deps.store);
      return fallbackStore.listDecisions({ sessionId, limit });
    } catch {
      return [];
    }
  };
  const route = async (req, res, url) => {
    const method = String(req.method ?? "GET").toUpperCase();
    const path = normalizeAutoPath(url.pathname);
    switch (path) {
      case "/status": {
        requireMethod(method, "GET", ["GET"]);
        const sessionId = readSessionId(url.searchParams);
        const status = scheduler.status(sessionId);
        sendOk2(res, status);
        return true;
      }
      case "/decisions": {
        requireMethod(method, "GET", ["GET"]);
        const sessionId = readSessionId(url.searchParams);
        const limit = readLimit(url.searchParams);
        sendOk2(res, decisionsOf(sessionId, limit));
        return true;
      }
      case "/summary": {
        requireMethod(method, "GET", ["GET"]);
        sendOk2(res, scheduler.summary());
        return true;
      }
      case "/enable": {
        requireMethod(method, "POST", ["POST"]);
        const body = await readJsonBody2(req);
        const enabled = readBooleanField(body, "enabled");
        const applied = scheduler.setEnabled(enabled);
        sendOk2(res, { enabled: applied, status: scheduler.status(null) });
        return true;
      }
      case "/manual": {
        requireMethod(method, "POST", ["POST"]);
        const body = await readJsonBody2(req);
        const sessionId = readStringField(body, "sessionId", true);
        if (!sessionId) throw new AutoHttpError(400, "MISSING_PARAM", "sessionId \u5FC5\u586B");
        const manual = scheduler.markManual(sessionId);
        sendOk2(res, { manual });
        return true;
      }
      case "/classify": {
        requireMethod(method, "POST", ["POST"]);
        const body = await readJsonBody2(req);
        const text = readStringField(body, "text", true);
        const isSubagent = typeof body.isSubagent === "boolean" ? body.isSubagent : void 0;
        const clipped = (text ?? "").slice(0, AUTO_TEXT_LIMIT);
        sendOk2(res, scheduler.classify(clipped, isSubagent === void 0 ? void 0 : { isSubagent }));
        return true;
      }
      default:
        return false;
    }
  };
  const handle = async (req, res, url) => {
    const request = req;
    const response = res;
    try {
      return await route(request, response, parseUrl(request, url));
    } catch (error) {
      if (response.writableEnded) return true;
      if (error instanceof AutoHttpError) {
        sendError2(response, error.status, error.code, error.message, error.allow);
      } else {
        sendError2(response, 500, "INTERNAL", "internal error");
      }
      return true;
    }
  };
  return { handle };
}

// src/host/context-reuse.ts
import { createHash as createHash5 } from "node:crypto";
var CONTEXT_REUSE_DEFAULTS = {
  mode: "observe",
  minBytes: 512,
  maxBytes: 8 * 1024 * 1024,
  maxEntriesPerSession: 512,
  maxSessions: 256,
  maxReferenceChars: 600
};
var CREATE_SEEN_SQL = `
CREATE TABLE IF NOT EXISTS context_reuse_seen (
  session_id TEXT NOT NULL,
  key TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  blob_id TEXT,
  hits INTEGER NOT NULL DEFAULT 0,
  first_ts INTEGER NOT NULL,
  last_ts INTEGER NOT NULL,
  PRIMARY KEY(session_id, key)
)`;
var CREATE_EVENTS_SQL = `
CREATE TABLE IF NOT EXISTS context_reuse_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  key TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  saved_bytes_estimated INTEGER NOT NULL,
  mode TEXT NOT NULL,
  action TEXT NOT NULL,
  blob_id TEXT,
  ts INTEGER NOT NULL
)`;
function asRecord10(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function isTextBlock2(block) {
  const record = block;
  return Boolean(record) && record.type === "text" && typeof record.text === "string";
}
function canonicalJson2(value) {
  if (value === void 0) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson2(item)).join(",")}]`;
  const record = value;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson2(record[key])}`).join(",")}}`;
}
function sha2562(text) {
  return createHash5("sha256").update(text, "utf8").digest("hex");
}
function sessionIdOf3(exec) {
  const record = asRecord10(exec);
  const candidates = [
    record.agent?.session?.id,
    record.agent?.sessionId,
    record.session?.id,
    record.agent?.id,
    record.sessionId
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }
  return "unknown";
}
function textOf3(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;
  const parts = [];
  for (const block of blocks) {
    if (!isTextBlock2(block)) return null;
    parts.push(block.text);
  }
  const text = parts.join("\n");
  return text.length > 0 ? text : null;
}
function skipReason2(exec, result) {
  const record = asRecord10(exec);
  if (record.parent !== void 0 && record.parent !== null) return "parent";
  if (asRecord10(result).isError === true) return "error";
  const name2 = typeof record.name === "string" ? record.name : "";
  if (!name2) return "no-name";
  if (CACHE_SKIP_TOOLS.includes(name2)) return "skip-tool";
  return null;
}
function resolveConfig(settings) {
  let raw = {};
  try {
    raw = asRecord10(asRecord10(settings.get()).contextReuse);
  } catch {
    raw = {};
  }
  const mode = raw.mode === "on" || raw.mode === "off" ? raw.mode : CONTEXT_REUSE_DEFAULTS.mode;
  const positive = (value, fallback, min) => {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
  };
  return {
    mode: raw.mode === "on" || raw.mode === "off" || raw.mode === "observe" ? raw.mode : mode,
    minBytes: positive(raw.minBytes, CONTEXT_REUSE_DEFAULTS.minBytes, 1),
    maxBytes: positive(raw.maxBytes, CONTEXT_REUSE_DEFAULTS.maxBytes, 1),
    maxEntriesPerSession: positive(raw.maxEntriesPerSession, CONTEXT_REUSE_DEFAULTS.maxEntriesPerSession, 1),
    maxSessions: positive(raw.maxSessions, CONTEXT_REUSE_DEFAULTS.maxSessions, 1),
    maxReferenceChars: positive(raw.maxReferenceChars, CONTEXT_REUSE_DEFAULTS.maxReferenceChars, 120)
  };
}
function buildReplacement2(decision, text) {
  const record = asRecord10(decision);
  if (!record || record.kind !== "accept") return null;
  if (Object.prototype.hasOwnProperty.call(record, "value")) return null;
  const additionalContexts = Array.isArray(record.additionalContexts) && record.additionalContexts.length > 0 ? { additionalContexts: record.additionalContexts } : {};
  return { kind: "accept", content: [{ type: "text", text }], ...additionalContexts };
}
function referenceText(input) {
  const text = `[Token Manager \xB7 \u76F8\u540C\u5185\u5BB9\u5DF2\u5728\u4E0A\u6587\u8FD4\u56DE]
\u672C\u6B21 ${input.toolName} \u7684\u7ED3\u679C\u4E0E\u4E4B\u524D\u7B2C ${input.hits} \u6B21\u8C03\u7528\u5B8C\u5168\u76F8\u540C\uFF08${input.bytes} \u5B57\u8282\uFF0C\u5185\u5BB9\u54C8\u5E0C ${input.key.slice(0, 12)}\u2026\uFF09\u3002\u4E3A\u4E86\u8282\u7701\u4E0A\u4E0B\u6587\uFF0C\u8FD9\u91CC\u4E0D\u518D\u91CD\u590D\u8F93\u51FA\u3002
\u6062\u590D\u5B8C\u6574\u539F\u6587\uFF1A\u8C03\u7528 token_manager_read\uFF0C\u53C2\u6570 blobId="${input.blobId}"\uFF08\u53EF\u7528 offset/lines \u5206\u6BB5\uFF09\u3002
\u5982\u679C\u4E0D\u518D\u9700\u8981\u8BE5\u5185\u5BB9\uFF0C\u5FFD\u7565\u672C\u6761\u5373\u53EF\u3002`;
  return text.length <= input.maxChars ? text : `${text.slice(0, Math.max(1, input.maxChars - 1))}\u2026`;
}
function createContextReuse(deps) {
  const { store, settings } = deps;
  const seen = /* @__PURE__ */ new Map();
  let errors = 0;
  let replacedCount = 0;
  let candidateCount = 0;
  let savedBytesEstimated = 0;
  let tablesReady = false;
  const recordError = (where, error) => {
    errors += 1;
    try {
      store.metaSet(
        "context_reuse_last_error",
        JSON.stringify({ ts: Date.now(), where, message: String(error?.message ?? error).slice(0, 500) })
      );
    } catch {
    }
  };
  const ensureTables = () => {
    if (tablesReady) return;
    try {
      store.exec(CREATE_SEEN_SQL);
      store.exec(CREATE_EVENTS_SQL);
      tablesReady = true;
    } catch (error) {
      recordError("ensureTables", error);
    }
  };
  const config = () => {
    try {
      return resolveConfig(settings);
    } catch (error) {
      recordError("config", error);
      return { ...CONTEXT_REUSE_DEFAULTS };
    }
  };
  const remember = (sessionId, key, value) => {
    let entries = seen.get(sessionId);
    if (!entries) {
      entries = /* @__PURE__ */ new Map();
      seen.set(sessionId, entries);
      while (seen.size > config().maxSessions) {
        const oldest = seen.keys().next().value;
        if (oldest === void 0) break;
        seen.delete(oldest);
      }
    }
    entries.set(key, value);
    const limit = config().maxEntriesPerSession;
    const sessionEntries = seen.get(sessionId);
    while (sessionEntries && sessionEntries.size > limit) {
      const first = sessionEntries.keys().next().value;
      if (first === void 0) break;
      sessionEntries.delete(first);
    }
  };
  const lookupBlobId = (sessionId, toolName, argsHash, resultHash, text) => {
    try {
      const reusable = deps.repo?.findReusable({ sessionId, toolName, argumentsHash: argsHash, resultHash });
      if (reusable?.blobId) return reusable.blobId;
    } catch (error) {
      recordError("findReusable", error);
    }
    try {
      const put = deps.blobStore?.put(text, "text");
      const blobId = put?.record?.id;
      if (typeof blobId === "string" && blobId.length > 0) return blobId;
    } catch (error) {
      recordError("blob.put", error);
    }
    return null;
  };
  const recordEvent = (event) => {
    ensureTables();
    try {
      store.run(
        `INSERT INTO context_reuse_events(session_id, key, tool_name, bytes, saved_bytes_estimated, mode, action, blob_id, ts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        event.sessionId,
        event.key,
        event.toolName,
        event.bytes,
        event.savedBytesEstimated,
        event.mode,
        event.action,
        event.blobId,
        event.ts
      );
    } catch (error) {
      recordError("recordEvent", error);
    }
  };
  const apply2 = (exec, result, decision) => {
    try {
      const cfg = config();
      if (cfg.mode === "off") return null;
      if (skipReason2(exec, result) !== null) return null;
      const record = asRecord10(decision);
      if (record.kind !== void 0 && record.kind !== "accept") return null;
      const content = record.content !== void 0 ? record.content : asRecord10(result).content;
      const text = textOf3(content);
      if (text === null) return null;
      const bytes = Buffer.byteLength(text, "utf8");
      if (bytes < cfg.minBytes || bytes > cfg.maxBytes) return null;
      const sessionId = sessionIdOf3(exec);
      if (!sessionId || sessionId === "unknown") return null;
      const toolName = String(asRecord10(exec).name ?? "unknown");
      const argsHash = sha2562(canonicalJson2(asRecord10(exec).arguments ?? null));
      const resultHash = sha2562(text);
      const key = sha2562(`${toolName}\0${argsHash}\0${resultHash}`);
      ensureTables();
      const memoryEntry = seen.get(sessionId)?.get(key);
      let hits = memoryEntry?.hits ?? 0;
      let blobId = memoryEntry?.blobId ?? null;
      let known = memoryEntry !== void 0;
      if (!known) {
        try {
          const row = store.get(
            "SELECT hits, blob_id FROM context_reuse_seen WHERE session_id = ? AND key = ? LIMIT 1",
            sessionId,
            key
          );
          if (row) {
            known = true;
            hits = Number(row.hits ?? 0);
            blobId = row.blob_id ?? null;
          }
        } catch (error) {
          recordError("seen.lookup", error);
        }
      }
      if (!known) {
        blobId = blobId ?? lookupBlobId(sessionId, toolName, argsHash, resultHash, text);
        try {
          store.run(
            `INSERT INTO context_reuse_seen(session_id, key, tool_name, bytes, blob_id, hits, first_ts, last_ts)
             VALUES (?, ?, ?, ?, ?, 0, ?, ?)
             ON CONFLICT(session_id, key) DO UPDATE SET last_ts = excluded.last_ts, blob_id = COALESCE(context_reuse_seen.blob_id, excluded.blob_id)`,
            sessionId,
            key,
            toolName,
            bytes,
            blobId,
            Date.now(),
            Date.now()
          );
        } catch (error) {
          recordError("seen.insert", error);
        }
        remember(sessionId, key, { bytes, blobId, hits: 0 });
        return null;
      }
      const nextHits = hits + 1;
      try {
        store.run(
          "UPDATE context_reuse_seen SET hits = ?, last_ts = ? WHERE session_id = ? AND key = ?",
          nextHits,
          Date.now(),
          sessionId,
          key
        );
      } catch (error) {
        recordError("seen.update", error);
      }
      blobId = blobId ?? lookupBlobId(sessionId, toolName, argsHash, resultHash, text);
      remember(sessionId, key, { bytes, blobId, hits: nextHits });
      const reference = blobId ? referenceText({ toolName, bytes, blobId, hits: nextHits, key, maxChars: cfg.maxReferenceChars }) : "";
      const saved = reference ? Math.max(0, bytes - Buffer.byteLength(reference, "utf8")) : 0;
      if (cfg.mode === "observe" || !reference) {
        candidateCount += 1;
        savedBytesEstimated += saved;
        recordEvent({
          sessionId,
          key,
          toolName,
          bytes,
          savedBytesEstimated: saved,
          mode: cfg.mode,
          action: "observe-would-replace",
          blobId,
          ts: Date.now()
        });
        return null;
      }
      const replacement = buildReplacement2(decision, reference);
      if (!replacement) return null;
      replacedCount += 1;
      savedBytesEstimated += saved;
      recordEvent({
        sessionId,
        key,
        toolName,
        bytes,
        savedBytesEstimated: saved,
        mode: cfg.mode,
        action: "replaced",
        blobId,
        ts: Date.now()
      });
      return replacement;
    } catch (error) {
      recordError("apply", error);
      return null;
    }
  };
  const stats = () => {
    let trackedEntries = 0;
    for (const entries of seen.values()) trackedEntries += entries.size;
    return {
      mode: config().mode,
      trackedSessions: seen.size,
      trackedEntries,
      candidates: candidateCount,
      replaced: replacedCount,
      savedBytesEstimated,
      errors
    };
  };
  const reset = () => {
    seen.clear();
    candidateCount = 0;
    replacedCount = 0;
    savedBytesEstimated = 0;
    errors = 0;
  };
  ensureTables();
  return { config, apply: apply2, stats, reset };
}

// src/host/subagent-audit.ts
var SUBAGENT_AUDIT_DEFAULTS = {
  enabled: true,
  promptBytesMax: 8e3,
  maxFindingsPerRun: 4
};
var CREATE_SUBAGENT_RUNS_SQL = `
CREATE TABLE IF NOT EXISTS subagent_runs (
  run_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  inherits_context INTEGER NOT NULL DEFAULT 0,
  child_session_id TEXT NOT NULL,
  parent_session_id TEXT,
  local INTEGER NOT NULL DEFAULT 0,
  seeded INTEGER NOT NULL DEFAULT 0,
  delegation_depth INTEGER,
  start_ts INTEGER NOT NULL,
  end_ts INTEGER,
  stop_reason TEXT,
  prompt_bytes INTEGER,
  prompt_tokens_estimated INTEGER,
  seed_tokens_estimated INTEGER,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER,
  calls INTEGER NOT NULL DEFAULT 0,
  finding_kinds TEXT,
  updated_at INTEGER NOT NULL
)`;
function num11(value, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function numOrNull3(value) {
  if (value === null || value === void 0) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function str(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function toRow(row) {
  let findingKinds = [];
  try {
    const parsed = row.finding_kinds ? JSON.parse(row.finding_kinds) : [];
    if (Array.isArray(parsed)) findingKinds = parsed.filter((item) => typeof item === "string");
  } catch {
    findingKinds = [];
  }
  return {
    runId: String(row.run_id),
    provider: String(row.provider ?? "unknown"),
    inheritsContext: num11(row.inherits_context),
    childSessionId: String(row.child_session_id),
    parentSessionId: row.parent_session_id,
    local: num11(row.local),
    seeded: num11(row.seeded),
    delegationDepth: numOrNull3(row.delegation_depth),
    startTs: num11(row.start_ts),
    endTs: row.end_ts === null ? null : num11(row.end_ts),
    stopReason: row.stop_reason,
    promptBytes: numOrNull3(row.prompt_bytes),
    promptTokensEstimated: numOrNull3(row.prompt_tokens_estimated),
    seedTokensEstimated: numOrNull3(row.seed_tokens_estimated),
    inputTokens: num11(row.input_tokens),
    outputTokens: num11(row.output_tokens),
    cacheReadTokens: num11(row.cache_read_tokens),
    cacheWriteTokens: num11(row.cache_write_tokens),
    reasoningTokens: row.reasoning_tokens === null ? null : num11(row.reasoning_tokens),
    calls: num11(row.calls),
    findingKinds,
    updatedAt: num11(row.updated_at)
  };
}
function contentText3(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const item = block;
    if (item.type === "text" && typeof item.text === "string") parts.push(item.text);
    else if (item.type === "image") parts.push("[image]");
    else if (item.type === "file") parts.push("[file]");
  }
  return parts.join("\n");
}
function resolveConfig2(settings) {
  let raw = {};
  try {
    const value = settings.get();
    raw = value?.contextAudit && typeof value.contextAudit === "object" ? value.contextAudit : {};
  } catch {
    raw = {};
  }
  const maxBytes = Math.trunc(Number(raw.promptBytesMax));
  const maxFindings = Math.trunc(Number(raw.maxFindingsPerRun));
  return {
    enabled: raw.enabled !== false,
    promptBytesMax: Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : SUBAGENT_AUDIT_DEFAULTS.promptBytesMax,
    maxFindingsPerRun: Number.isFinite(maxFindings) && maxFindings > 0 ? maxFindings : SUBAGENT_AUDIT_DEFAULTS.maxFindingsPerRun
  };
}
function createSubagentAudit(deps) {
  const { store, settings } = deps;
  const active = /* @__PURE__ */ new Map();
  let tablesReady = false;
  const recordError = (where, error) => {
    try {
      deps.recordError?.(where, error);
    } catch {
    }
    try {
      store.metaSet(
        "subagent_audit_last_error",
        JSON.stringify({ ts: Date.now(), where, message: String(error?.message ?? error).slice(0, 500) })
      );
    } catch {
    }
  };
  const ensureTable = () => {
    if (tablesReady) return;
    try {
      store.exec(CREATE_SUBAGENT_RUNS_SQL);
      try {
        const columns = new Set(store.all("PRAGMA table_info(subagent_runs)").map((row) => String(row?.name ?? "")));
        if (columns.size > 0 && !columns.has("seeded")) {
          store.exec("ALTER TABLE subagent_runs ADD COLUMN seeded INTEGER NOT NULL DEFAULT 0");
        }
      } catch {
      }
      tablesReady = true;
    } catch (error) {
      recordError("ensureTable", error);
    }
  };
  const headerOf = (sessionId, session) => {
    if (session?.header && typeof session.header === "object") return session.header;
    try {
      const resolved = deps.resolveSession?.(sessionId);
      return resolved?.header && typeof resolved.header === "object" ? resolved.header : {};
    } catch {
      return {};
    }
  };
  const upsertStart = (input) => {
    ensureTable();
    try {
      store.run(
        `INSERT INTO subagent_runs(run_id, provider, inherits_context, child_session_id, parent_session_id, local,
           seeded, delegation_depth, start_ts, end_ts, stop_reason, prompt_bytes, prompt_tokens_estimated, seed_tokens_estimated,
           input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, calls, finding_kinds, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, 0, 0, 0, 0, NULL, 0, '[]', ?)
         ON CONFLICT(run_id) DO UPDATE SET
           provider = excluded.provider,
           inherits_context = excluded.inherits_context,
           child_session_id = excluded.child_session_id,
           parent_session_id = COALESCE(subagent_runs.parent_session_id, excluded.parent_session_id),
           local = excluded.local,
           seeded = excluded.seeded,
           delegation_depth = COALESCE(subagent_runs.delegation_depth, excluded.delegation_depth),
           seed_tokens_estimated = COALESCE(subagent_runs.seed_tokens_estimated, excluded.seed_tokens_estimated),
           updated_at = excluded.updated_at`,
        input.runId,
        input.provider,
        input.inherits,
        input.childSessionId,
        input.parentSessionId,
        input.local,
        input.seeded,
        input.delegationDepth,
        input.ts,
        input.seedTokensEstimated,
        input.ts
      );
    } catch (error) {
      recordError("upsertStart", error);
    }
  };
  const addFinding = (input) => {
    const sessionId = input.parentSessionId ?? input.childSessionId;
    try {
      const info = store.run(
        `INSERT OR IGNORE INTO findings(session_id, task_id, kind, severity, subject, detail, evidence, created_at)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
        sessionId,
        input.kind,
        input.severity,
        input.childSessionId,
        JSON.stringify(input.detail),
        JSON.stringify(input.evidence),
        Date.now()
      );
      return info.changes > 0;
    } catch (error) {
      recordError("addFinding", error);
      return false;
    }
  };
  const usageTotals = (childSessionId) => {
    try {
      const row = store.get(
        `SELECT COUNT(*) AS calls, COALESCE(SUM(input_tokens),0) AS input, COALESCE(SUM(output_tokens),0) AS output,
                COALESCE(SUM(cache_read_tokens),0) AS cache_read, COALESCE(SUM(cache_write_tokens),0) AS cache_write,
                SUM(reasoning_tokens) AS reasoning
           FROM usage_records WHERE session_id = ? AND turn >= 0 AND is_final = 1 AND source = 'live'`,
        childSessionId
      );
      return {
        calls: num11(row?.calls),
        input: num11(row?.input),
        output: num11(row?.output),
        cacheRead: num11(row?.cache_read),
        cacheWrite: num11(row?.cache_write),
        reasoning: row?.reasoning === null || row?.reasoning === void 0 ? null : num11(row.reasoning)
      };
    } catch (error) {
      recordError("usageTotals", error);
      return { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: null };
    }
  };
  const recordPrompt = (childSessionId, data, runId) => {
    try {
      const text = contentText3(data.content);
      if (!text) return;
      const bytes = Buffer.byteLength(text, "utf8");
      const tokensEstimated = Math.ceil(bytes / 4);
      ensureTable();
      if (runId) {
        store.run(
          `UPDATE subagent_runs SET prompt_bytes = ?, prompt_tokens_estimated = ?, updated_at = ?
             WHERE run_id = ? AND (prompt_bytes IS NULL OR prompt_bytes < ?)`,
          bytes,
          tokensEstimated,
          Date.now(),
          runId,
          bytes
        );
      } else {
        store.run(
          `UPDATE subagent_runs SET prompt_bytes = ?, prompt_tokens_estimated = ?, updated_at = ?
             WHERE child_session_id = ? AND (prompt_bytes IS NULL OR prompt_bytes < ?)`,
          bytes,
          tokensEstimated,
          Date.now(),
          childSessionId,
          bytes
        );
      }
    } catch (error) {
      recordError("recordPrompt", error);
    }
  };
  const findingKindsOf = (runId) => {
    try {
      const row = store.get("SELECT finding_kinds FROM subagent_runs WHERE run_id = ?", runId);
      const parsed = row?.finding_kinds ? JSON.parse(row.finding_kinds) : [];
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    } catch {
      return [];
    }
  };
  const setFindingKinds = (runId, kinds) => {
    try {
      store.run("UPDATE subagent_runs SET finding_kinds = ?, updated_at = ? WHERE run_id = ?", JSON.stringify([...new Set(kinds)]), Date.now(), runId);
    } catch (error) {
      recordError("setFindingKinds", error);
    }
  };
  const onStart = (info) => {
    try {
      const cfg = resolveConfig2(settings);
      if (!cfg.enabled) return;
      const runId = str(info?.runId);
      const childSessionId = str(info?.id);
      if (!runId || !childSessionId) return;
      const provider = str(info?.provider) ?? "unknown";
      const header = headerOf(childSessionId, null);
      const parentSessionId = str(header.parentSession) ?? str(header.parentSessionId);
      const seeded = header.isSeeded === true || header.seeded === true;
      const inherits = seeded || provider === "fork" ? 1 : 0;
      const delegationDepth = numOrNull3(header.delegationDepth);
      let seedTokensEstimated = null;
      if (inherits === 1) {
        try {
          const measured = deps.measureSession?.(childSessionId) ?? null;
          if (measured && Number.isFinite(Number(measured.totalTokens))) {
            seedTokensEstimated = Math.trunc(Number(measured.totalTokens));
          }
        } catch (error) {
          recordError("measureSession", error);
        }
      }
      const ts = Date.now();
      upsertStart({
        runId,
        provider,
        childSessionId,
        local: info?.local === false ? 0 : 1,
        parentSessionId,
        inherits,
        seeded: seeded ? 1 : 0,
        delegationDepth,
        seedTokensEstimated,
        ts
      });
      active.set(runId, { runId, provider, childSessionId, parentSessionId, startTs: ts });
    } catch (error) {
      recordError("onStart", error);
    }
  };
  const onSessionEvent = (session, event) => {
    try {
      const cfg = resolveConfig2(settings);
      if (!cfg.enabled) return;
      const sessionId = str(session?.id) ?? str(session?.header?.id);
      if (!sessionId) return;
      const type = str(event?.type) ?? "";
      if (type !== "user/message") return;
      const header = headerOf(sessionId, session);
      const parentSessionId = str(header.parentSession) ?? str(header.parentSessionId);
      const isChild = Boolean(parentSessionId) || header.origin === "subagent";
      if (!isChild) return;
      const data = event?.data ?? {};
      const source = data.source;
      if (!source || source.kind !== "user") return;
      const existing = (() => {
        try {
          return store.get(
            "SELECT run_id, prompt_bytes FROM subagent_runs WHERE child_session_id = ? ORDER BY start_ts DESC LIMIT 1",
            sessionId
          );
        } catch {
          return void 0;
        }
      })();
      if (!existing) {
        ensureTable();
        upsertStart({
          runId: `lazy-${sessionId}`,
          provider: "unknown",
          childSessionId: sessionId,
          local: 1,
          parentSessionId,
          inherits: header.isSeeded === true ? 1 : 0,
          seeded: header.isSeeded === true ? 1 : 0,
          delegationDepth: numOrNull3(header.delegationDepth),
          seedTokensEstimated: null,
          ts: Date.now()
        });
        recordPrompt(sessionId, data, null);
        return;
      }
      if (existing.prompt_bytes === null) recordPrompt(sessionId, data, existing.run_id);
    } catch (error) {
      recordError("onSessionEvent", error);
    }
  };
  const onEnd = (info) => {
    try {
      const cfg = resolveConfig2(settings);
      if (!cfg.enabled) return;
      const runId = str(info?.runId);
      const childSessionId = str(info?.id) ?? "";
      const runtime = runId ? active.get(runId) : void 0;
      const effectiveRunId = runId ?? runtime?.runId ?? (childSessionId ? `lazy-${childSessionId}` : "");
      if (!effectiveRunId) return;
      ensureTable();
      const row = (() => {
        try {
          return store.get("SELECT * FROM subagent_runs WHERE run_id = ?", effectiveRunId);
        } catch {
          return void 0;
        }
      })();
      const resolvedChild = childSessionId || row?.child_session_id || "";
      if (!resolvedChild) return;
      const totals = usageTotals(resolvedChild);
      const stopReason = str(info?.stopReason) ?? null;
      try {
        store.run(
          `UPDATE subagent_runs SET end_ts = ?, stop_reason = ?, input_tokens = ?, output_tokens = ?,
             cache_read_tokens = ?, cache_write_tokens = ?, reasoning_tokens = ?, calls = ?, updated_at = ?
           WHERE run_id = ?`,
          Date.now(),
          stopReason,
          totals.input,
          totals.output,
          totals.cacheRead,
          totals.cacheWrite,
          totals.reasoning,
          totals.calls,
          Date.now(),
          effectiveRunId
        );
      } catch (error) {
        recordError("onEnd.update", error);
      }
      if (runtime) active.delete(runtime.runId);
      if (!row) return;
      const parentSessionId = row.parent_session_id ?? runtime?.parentSessionId ?? null;
      const findings2 = findingKindsOf(effectiveRunId);
      const maxFindings = cfg.maxFindingsPerRun;
      if (num11(row.inherits_context) === 1 && findings2.length < maxFindings) {
        const created = addFinding({
          parentSessionId,
          childSessionId: resolvedChild,
          kind: "subagent_fork_history",
          severity: "warn",
          detail: {
            provider: row.provider,
            seeded: num11(row.seeded) === 1,
            seedTokensEstimated: row.seed_tokens_estimated,
            childInputTokens: totals.input,
            calls: totals.calls,
            note: num11(row.seeded) === 1 ? "fork/seeded \u5B50 Agent \u7EE7\u627F\u7236\u4F1A\u8BDD\u5B8C\u6574\u5386\u53F2\uFF1A\u5B50\u4F1A\u8BDD\u9996\u6B21\u8BF7\u6C42\u7684\u8F93\u5165\u5305\u542B\u6574\u6BB5\u7236\u5386\u53F2\uFF0C\u6210\u672C\u9AD8\u4E8E spawn\u3002\u72EC\u7ACB\u5B50\u4EFB\u52A1\u5EFA\u8BAE\u7528 spawn + token_manager_context \u4EFB\u52A1\u5305\u3002" : "\u59D4\u6258\u4F7F\u7528 fork provider\uFF08\u6309\u8BBE\u8BA1\u4F1A\u6CE8\u5165\u7236\u5386\u53F2\u5FEB\u7167\uFF09\uFF1B\u672C\u6B21 seed \u4E3A\u7A7A\uFF0C\u4F46 fork \u8BED\u4E49\u4E0B\u5B50\u4F1A\u8BDD\u4ECD\u53EF\u80FD\u643A\u5E26\u7236\u4E0A\u4E0B\u6587\u3002\u72EC\u7ACB\u5B50\u4EFB\u52A1\u5EFA\u8BAE\u7528 spawn + token_manager_context \u4EFB\u52A1\u5305\u3002"
          },
          evidence: {
            provider: row.provider,
            seedTokensEstimated: row.seed_tokens_estimated,
            childInputTokens: totals.input,
            promptBytes: row.prompt_bytes
          }
        });
        if (created) findings2.push("subagent_fork_history");
      }
      if (row.prompt_bytes !== null && row.prompt_bytes > cfg.promptBytesMax && findings2.length < maxFindings) {
        const created = addFinding({
          parentSessionId,
          childSessionId: resolvedChild,
          kind: "subagent_prompt_oversize",
          severity: "warn",
          detail: {
            promptBytes: row.prompt_bytes,
            promptTokensEstimated: row.prompt_tokens_estimated,
            threshold: cfg.promptBytesMax,
            note: "\u59D4\u6D3E prompt \u8D85\u8FC7\u9608\u503C\uFF1A\u5EFA\u8BAE\u53EA\u7ED9\u76EE\u6807/\u7EA6\u675F/\u9A8C\u6536\u6807\u51C6\uFF0C\u9700\u8981\u9879\u76EE\u80CC\u666F\u65F6\u7528 token_manager_context \u53D6\u5206\u5C42\u6458\u8981\u3002"
          },
          evidence: {
            provider: row.provider,
            promptBytes: row.prompt_bytes,
            promptTokensEstimated: row.prompt_tokens_estimated,
            threshold: cfg.promptBytesMax
          }
        });
        if (created) findings2.push("subagent_prompt_oversize");
      }
      setFindingKinds(effectiveRunId, findings2);
    } catch (error) {
      recordError("onEnd", error);
    }
  };
  const evidence = (limit = 50) => {
    ensureTable();
    const size = Math.min(500, Math.max(1, Math.trunc(Number(limit)) || 50));
    let rows = [];
    try {
      rows = store.all("SELECT * FROM subagent_runs ORDER BY start_ts DESC, run_id DESC LIMIT ?", size).map(toRow);
    } catch (error) {
      recordError("evidence", error);
      rows = [];
    }
    const totals = {
      runs: rows.length,
      forkRuns: rows.filter((row) => row.inheritsContext === 1).length,
      promptBytes: rows.reduce((acc, row) => acc + num11(row.promptBytes), 0),
      promptTokensEstimated: rows.reduce((acc, row) => acc + num11(row.promptTokensEstimated), 0),
      childInputTokens: rows.reduce((acc, row) => acc + row.inputTokens, 0),
      childOutputTokens: rows.reduce((acc, row) => acc + row.outputTokens, 0),
      childTotalTokens: rows.reduce((acc, row) => acc + row.inputTokens + row.outputTokens + row.cacheReadTokens + row.cacheWriteTokens, 0),
      calls: rows.reduce((acc, row) => acc + row.calls, 0)
    };
    const notes = [
      "promptTokensEstimated / seedTokensEstimated \u4E3A bytes/4 \u6216 tokenMeter \u4F30\u7B97\u503C\uFF08estimated\uFF09\uFF0C\u4E0D\u662F API \u503C",
      "childInputTokens \u7B49\u6765\u81EA\u5B50\u4F1A\u8BDD usage_records \u7684 API \u771F\u5B9E\u503C\uFF1BreasoningTokens \u4E3A NULL \u8868\u793A API \u672A\u8FD4\u56DE"
    ];
    if (totals.forkRuns > 0) notes.push(`${totals.forkRuns} \u6B21\u59D4\u6D3E\u4F7F\u7528 fork/seeded\uFF1A\u5B50\u4F1A\u8BDD\u8F93\u5165\u5305\u542B\u7236\u5386\u53F2`);
    const anyReasoningMissing = rows.some((row) => row.reasoningTokens === null && row.calls > 0);
    if (anyReasoningMissing) notes.push("\u5B58\u5728\u5B50\u4F1A\u8BDD\u672A\u8FD4\u56DE reasoningTokens \u7684\u8FD0\u884C\uFF1A\u5BF9\u5E94\u5B57\u6BB5\u4E3A NULL\uFF08\u4E0D\u662F 0\uFF09");
    return { rows, totals, notes };
  };
  const findings = (query = {}) => {
    try {
      const where = ["(kind = ? OR kind = ?)"];
      const params = ["subagent_fork_history", "subagent_prompt_oversize"];
      if (query.sessionId) {
        where.push("session_id = ?");
        params.push(query.sessionId);
      }
      if (query.kind) {
        where.push("kind = ?");
        params.push(query.kind);
      }
      const limit = Math.min(500, Math.max(1, Math.trunc(Number(query.limit ?? 100)) || 100));
      return store.all(
        `SELECT id, session_id, task_id, kind, severity, subject, detail, evidence, created_at FROM findings WHERE ${where.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT ?`,
        ...params,
        limit
      ).map((row) => ({
        id: num11(row.id),
        sessionId: String(row.session_id),
        taskId: row.task_id,
        kind: row.kind,
        severity: row.severity === "high" || row.severity === "warn" ? row.severity : "info",
        subject: String(row.subject),
        detail: row.detail ?? "{}",
        evidence: row.evidence ?? "{}",
        createdAt: num11(row.created_at)
      }));
    } catch (error) {
      recordError("findings", error);
      return [];
    }
  };
  const stats = () => {
    const snapshot = evidence(500);
    return {
      runs: snapshot.totals.runs,
      forkRuns: snapshot.totals.forkRuns,
      promptBytes: snapshot.totals.promptBytes,
      findings: snapshot.rows.reduce((acc, row) => acc + row.findingKinds.length, 0)
    };
  };
  const config = () => resolveConfig2(settings);
  ensureTable();
  return { onStart, onEnd, onSessionEvent, evidence, findings, stats, config };
}

// src/host/context-pack.ts
var CONTEXT_PACK_DEFAULTS = {
  maxChars: 6e3,
  allocations: {
    task: { global: 0.25, task: 0.65, execution: 0.1 },
    project: { global: 0.95, task: 0, execution: 0 },
    all: { global: 0.45, task: 0.4, execution: 0.15 }
  },
  recentDecisions: 8,
  recentFiles: 20,
  sectionMaxChars: 1600
};
function asRecord11(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function num12(value, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function parseJsonObject(raw) {
  if (typeof raw !== "string" || raw.length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function truncate3(text, limit) {
  if (limit <= 0) return { text: "", truncated: text.length > 0 };
  if (text.length <= limit) return { text, truncated: false };
  return { text: `${text.slice(0, Math.max(1, limit - 1))}\u2026`, truncated: true };
}
function sectionLines(source, keys, labels, maxChars) {
  const lines = [];
  const sections = [];
  const omitted = [];
  for (const key of keys) {
    const value = source[key];
    if (value === void 0 || value === null) continue;
    const text = typeof value === "string" ? value.trim() : JSON.stringify(value);
    if (!text) continue;
    const clipped = truncate3(text, maxChars);
    lines.push(`- ${labels[key]?.zh ?? key}\uFF1A${clipped.text}`);
    sections.push(key);
    if (clipped.truncated) omitted.push(`${labels[key]?.zh ?? key} \u8D85\u957F\u5DF2\u622A\u65AD`);
  }
  return { lines, sections, omitted };
}
function resolveConfig3(settings) {
  let raw = {};
  try {
    const value = settings.get();
    raw = value?.contextPack && typeof value.contextPack === "object" ? value.contextPack : {};
  } catch {
    raw = {};
  }
  const clampInt2 = (value, fallback, min, max) => {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  };
  const alloc = asRecord11(raw.allocations);
  const allocationOf = (scope) => {
    const value = asRecord11(alloc[scope]);
    const fallback = CONTEXT_PACK_DEFAULTS.allocations[scope];
    const normalize2 = (key) => {
      const candidate = Number(value[key]);
      return Number.isFinite(candidate) && candidate >= 0 && candidate <= 1 ? candidate : fallback[key];
    };
    return { global: normalize2("global"), task: normalize2("task"), execution: normalize2("execution") };
  };
  return {
    maxChars: clampInt2(raw.maxChars, CONTEXT_PACK_DEFAULTS.maxChars, 1e3, 2e4),
    allocations: {
      task: allocationOf("task"),
      project: allocationOf("project"),
      all: allocationOf("all")
    },
    recentDecisions: clampInt2(raw.recentDecisions, CONTEXT_PACK_DEFAULTS.recentDecisions, 0, 30),
    recentFiles: clampInt2(raw.recentFiles, CONTEXT_PACK_DEFAULTS.recentFiles, 0, 100),
    sectionMaxChars: clampInt2(raw.sectionMaxChars, CONTEXT_PACK_DEFAULTS.sectionMaxChars, 120, 4e3)
  };
}
var DEFAULT_PROJECT_ID = "unknown";
function createContextPack(deps) {
  const { store, settings } = deps;
  const recordError = (where, error) => {
    try {
      deps.recordError?.(where, error);
    } catch {
    }
    try {
      store.metaSet(
        "context_pack_last_error",
        JSON.stringify({ ts: Date.now(), where, message: String(error?.message ?? error).slice(0, 500) })
      );
    } catch {
    }
  };
  const config = () => {
    try {
      return resolveConfig3(settings);
    } catch (error) {
      recordError("config", error);
      return { ...CONTEXT_PACK_DEFAULTS };
    }
  };
  const projectIdOfSession = (sessionId) => {
    try {
      const session = deps.resolveSession?.(sessionId) ?? null;
      const header = asRecord11(session?.header);
      const cwd = typeof header.cwd === "string" ? header.cwd.trim() : "";
      if (cwd) return cwd;
    } catch {
    }
    try {
      const row = store.get(
        "SELECT project_id, cwd FROM sessions WHERE session_id = ?",
        sessionId
      );
      return row?.project_id || row?.cwd || DEFAULT_PROJECT_ID;
    } catch {
      return DEFAULT_PROJECT_ID;
    }
  };
  const projectLayer = (projectId, budget, cfg) => {
    const layer = { included: false, chars: 0, sections: [], omitted: [] };
    if (budget <= 0 || projectId === DEFAULT_PROJECT_ID) {
      if (projectId === DEFAULT_PROJECT_ID) layer.omitted.push("\u65E0\u6CD5\u786E\u5B9A\u9879\u76EE id\uFF08\u4F1A\u8BDD\u7F3A\u5C11 cwd/project\uFF09");
      return { text: "", layer };
    }
    let summary = {};
    let version = null;
    let updatedAt = null;
    try {
      const row = store.get(
        "SELECT summary, version, updated_at FROM project_summaries WHERE project_id = ?",
        projectId
      );
      if (row) {
        summary = parseJsonObject(row.summary);
        version = num12(row.version);
        updatedAt = num12(row.updated_at);
      }
    } catch (error) {
      recordError("projectLayer", error);
    }
    const rendered = sectionLines(summary, PROJECT_SUMMARY_SECTIONS, PROJECT_SUMMARY_LABELS, cfg.sectionMaxChars);
    layer.sections = rendered.sections;
    layer.omitted.push(...rendered.omitted);
    if (rendered.lines.length === 0) {
      layer.omitted.push("\u9879\u76EE\u6458\u8981\u5C1A\u672A\u586B\u5199\uFF08\u53EF\u5728\u4EEA\u8868\u76D8\u300C\u9879\u76EE\u300D\u9875\u7EF4\u62A4 8 \u6BB5\u6458\u8981\uFF09");
      return { text: "", layer };
    }
    let body = rendered.lines.join("\n");
    const clipped = truncate3(body, Math.max(0, budget - 120));
    body = clipped.text;
    if (clipped.truncated) layer.omitted.push("\u9879\u76EE\u5C42\u8D85\u51FA\u9884\u7B97\u5DF2\u622A\u65AD");
    const header = `\u9879\u76EE\uFF1A${projectId}${version !== null ? `\uFF08\u6458\u8981 v${version}\uFF09` : ""}${updatedAt ? `\uFF0C\u66F4\u65B0\u4E8E ${new Date(updatedAt).toISOString()}` : ""}`;
    const text = `${header}
${body}`;
    layer.included = true;
    layer.chars = text.length;
    return { text, layer };
  };
  const findTask = (sessionId, taskId) => {
    try {
      if (taskId) {
        const row = store.get("SELECT * FROM tasks WHERE id = ?", taskId);
        if (row) return row;
      }
      if (sessionId) {
        const row = store.get(
          "SELECT * FROM tasks WHERE session_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1",
          sessionId
        );
        if (row) return row;
      }
      const session = deps.resolveSession?.(sessionId) ?? null;
      const parent = asRecord11(asRecord11(session).header).parentSession;
      if (typeof parent === "string" && parent.length > 0) {
        return store.get("SELECT * FROM tasks WHERE session_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1", parent) ?? null;
      }
      return null;
    } catch (error) {
      recordError("findTask", error);
      return null;
    }
  };
  const recentDecisionsOf = (sessionId, limit) => {
    if (limit <= 0) return [];
    try {
      const rows = store.all(
        `SELECT ts, task_type, from_effort, to_effort, action, reasons, applied
           FROM auto_decisions WHERE session_id = ? ORDER BY ts DESC LIMIT ?`,
        sessionId,
        limit
      );
      return rows.slice().reverse().map((row) => {
        let reasons = [];
        try {
          const parsed = row.reasons ? JSON.parse(row.reasons) : [];
          if (Array.isArray(parsed)) reasons = parsed.filter((item) => typeof item === "string");
        } catch {
          reasons = [];
        }
        const applied = row.applied === 1 ? "\u5DF2\u751F\u6548" : "\u4EC5\u8BB0\u5F55";
        return `- ${new Date(row.ts).toISOString()} ${row.task_type ?? "\u4EFB\u52A1"}\uFF1A${row.from_effort ?? "\u672A\u77E5"} \u2192 ${row.to_effort}\uFF08${row.action}\uFF0C${applied}\uFF09${reasons.length > 0 ? `\uFF1A${reasons.slice(0, 2).join("\uFF1B")}` : ""}`;
      });
    } catch {
      return [];
    }
  };
  const taskTokenStats = (taskId) => {
    try {
      const row = store.get(
        `SELECT COUNT(*) AS calls, COALESCE(SUM(input_tokens),0) AS input_tokens,
                COALESCE(SUM(cache_read_tokens),0) AS cache_read_tokens, COALESCE(SUM(output_tokens),0) AS output_tokens,
                SUM(CASE WHEN reasoning_tokens IS NOT NULL THEN 1 ELSE 0 END) AS reasoning_rows
           FROM usage_records WHERE task_id = ? AND turn >= 0 AND is_final = 1 AND source = 'live'`,
        taskId
      );
      if (!row || num12(row.calls) === 0) return [];
      const reasoning = num12(row.reasoning_rows) === 0 ? "\u63A8\u7406 token\uFF1AAPI \u672A\u8FD4\u56DE\uFF08NULL\uFF09" : `\u63A8\u7406 token\uFF1A${num12(row.reasoning_rows)} \u6B21\u8BF7\u6C42\u6709 API \u503C`;
      return [
        `- Token \u7EDF\u8BA1\uFF08API \u771F\u5B9E\u503C\uFF09\uFF1A${num12(row.calls)} \u6B21\u8C03\u7528\uFF0C\u672A\u547D\u4E2D\u8F93\u5165 ${num12(row.input_tokens)}\uFF0C\u7F13\u5B58\u547D\u4E2D ${num12(row.cache_read_tokens)}\uFF0C\u8F93\u51FA ${num12(row.output_tokens)}`,
        `- ${reasoning}`
      ];
    } catch {
      return [];
    }
  };
  const taskLayer = (sessionId, taskId, budget, cfg) => {
    const layer = { included: false, chars: 0, sections: [], omitted: [] };
    if (budget <= 0) return { text: "", layer, task: null };
    const task = findTask(sessionId, taskId);
    if (!task) {
      layer.omitted.push("\u672A\u627E\u5230\u4EFB\u52A1\u8BB0\u5F55\uFF08\u8BE5\u4F1A\u8BDD\u8FD8\u6CA1\u6709\u6CE8\u518C\u4EFB\u52A1\uFF09");
      return { text: "", layer, task: null };
    }
    const summary = parseJsonObject(task.summary);
    const rendered = sectionLines(summary, TASK_SUMMARY_FIELDS, TASK_SUMMARY_LABELS, cfg.sectionMaxChars);
    const decisions = recentDecisionsOf(sessionId, cfg.recentDecisions);
    const tokenLines = taskTokenStats(task.id);
    const head = `\u4EFB\u52A1\uFF1A${task.task_name}\uFF08${task.task_type} / ${task.status}${task.turn !== null ? ` / turn ${task.turn}` : ""}\uFF09`;
    const parts = [head];
    if (rendered.lines.length > 0) parts.push(...rendered.lines);
    if (decisions.length > 0) {
      parts.push("\u6700\u8FD1 AUTO \u51B3\u7B56\uFF1A");
      parts.push(...decisions);
      layer.sections.push("recentDecisions");
    } else {
      layer.omitted.push("\u65E0 AUTO \u51B3\u7B56\u8BB0\u5F55\uFF08AUTO \u672A\u542F\u7528\u6216\u672A\u88C5\u914D\uFF09");
    }
    if (tokenLines.length > 0) parts.push(...tokenLines);
    layer.sections = [...rendered.sections, ...layer.sections];
    layer.omitted.push(...rendered.omitted);
    if (rendered.lines.length === 0 && tokenLines.length === 0 && decisions.length === 0) {
      layer.omitted.push("\u4EFB\u52A1\u6458\u8981\u5C1A\u672A\u586B\u5199\uFF08\u53EF\u5728\u4EFB\u52A1\u8BE6\u60C5\u9875\u7EF4\u62A4 9 \u6BB5\u6458\u8981\uFF09");
      return { text: "", layer, task };
    }
    let body = parts.join("\n");
    const clipped = truncate3(body, Math.max(0, budget - 40));
    body = clipped.text;
    if (clipped.truncated) layer.omitted.push("\u4EFB\u52A1\u5C42\u8D85\u51FA\u9884\u7B97\u5DF2\u622A\u65AD");
    layer.included = true;
    layer.chars = body.length;
    return { text: body, layer, task };
  };
  const executionLayer = (sessionId, budget, cfg) => {
    const layer = { included: false, chars: 0, sections: [], omitted: [] };
    if (budget <= 0 || cfg.recentFiles <= 0) return { text: "", layer };
    let rows = [];
    try {
      const placeholders = WRITE_TOOLS.map(() => "?").join(", ");
      rows = store.all(
        `SELECT target_path, tool_name, MAX(ts) AS ts FROM tool_calls
          WHERE session_id = ? AND target_path IS NOT NULL AND tool_name IN (${placeholders})
          GROUP BY target_path ORDER BY ts DESC LIMIT ?`,
        sessionId,
        ...WRITE_TOOLS,
        cfg.recentFiles
      );
    } catch (error) {
      recordError("executionLayer", error);
    }
    if (rows.length === 0) {
      layer.omitted.push("\u672C\u4F1A\u8BDD\u5C1A\u65E0\u6587\u4EF6\u53D8\u66F4\u8BB0\u5F55");
      return { text: "", layer };
    }
    const lines = rows.map((row) => `- ${new Date(num12(row.ts)).toISOString()} ${row.tool_name}\uFF1A${row.target_path}`);
    let body = `\u6700\u8FD1\u53D8\u66F4\u6587\u4EF6\uFF08\u5171 ${rows.length} \u4E2A\uFF09\uFF1A
${lines.join("\n")}`;
    const clipped = truncate3(body, budget);
    body = clipped.text;
    if (clipped.truncated) layer.omitted.push("\u6267\u884C\u5C42\u8D85\u51FA\u9884\u7B97\u5DF2\u622A\u65AD");
    layer.included = true;
    layer.chars = body.length;
    layer.sections = ["changedFiles"];
    return { text: body, layer };
  };
  const build = (request = {}) => {
    const cfg = config();
    const scope = request.scope === "project" || request.scope === "all" ? request.scope : "task";
    const maxChars = Math.min(2e4, Math.max(1e3, Math.trunc(Number(request.maxChars ?? cfg.maxChars)) || cfg.maxChars));
    const sessionId = typeof request.sessionId === "string" && request.sessionId.length > 0 ? request.sessionId : "";
    const projectId = typeof request.projectId === "string" && request.projectId.length > 0 ? request.projectId : projectIdOfSession(sessionId);
    const alloc = cfg.allocations[scope];
    const layerBudgets = {
      global: Math.floor(maxChars * alloc.global),
      task: Math.floor(maxChars * alloc.task),
      execution: Math.floor(maxChars * alloc.execution)
    };
    const notes = [];
    const global = projectLayer(projectId, layerBudgets.global, cfg);
    const taskResult = taskLayer(sessionId, request.taskId ?? null, layerBudgets.task, cfg);
    const execution = executionLayer(sessionId, layerBudgets.execution, cfg);
    const layers = { global: global.layer, task: taskResult.layer, execution: execution.layer };
    const blocks = [];
    if (global.text) blocks.push(`## \u9879\u76EE\u5C42\uFF08\u5168\u5C40\uFF09
${global.text}`);
    if (taskResult.text) blocks.push(`## \u4EFB\u52A1\u5C42\uFF08\u5F53\u524D\u4EFB\u52A1\u6458\u8981 + \u6700\u8FD1\u51B3\u7B56\uFF09
${taskResult.text}`);
    if (execution.text) blocks.push(`## \u6267\u884C\u5C42\uFF08\u6700\u8FD1\u53D8\u66F4\u6587\u4EF6\uFF09
${execution.text}`);
    if (blocks.length === 0) {
      notes.push("\u6CA1\u6709\u53EF\u7528\u7684\u9879\u76EE/\u4EFB\u52A1\u6458\u8981\uFF1A\u8BF7\u5148\u5728\u4EEA\u8868\u76D8\u586B\u5199\u9879\u76EE\u6458\u8981\u6216\u4EFB\u52A1\u6458\u8981\uFF0C\u6216\u76F4\u63A5\u7528 spawn \u5B50 Agent \u4F20\u4EFB\u52A1\u8981\u70B9");
    }
    const heading = request.isSubagent ? "# \u4E0A\u4E0B\u6587\u5305\uFF08Token Manager \xB7 \u4F9B\u5B50 Agent \u7EED\u63A5\u4EFB\u52A1\uFF09\n\u4EE5\u4E0B\u5206\u5C42\u6458\u8981\u66FF\u4EE3\u7C98\u8D34\u5B8C\u6574\u4F1A\u8BDD\u5386\u53F2\uFF1B\u5982\u9700\u539F\u6587\u8BF7\u7528\u5BF9\u5E94\u5DE5\u5177\u6309\u9700\u8BFB\u53D6\u3002" : "# \u4E0A\u4E0B\u6587\u5305\uFF08Token Manager\uFF09\n\u5206\u5C42\u6700\u5C0F\u4E0A\u4E0B\u6587\uFF1A\u9879\u76EE\u6458\u8981 + \u4EFB\u52A1\u6458\u8981/\u51B3\u7B56 + \u6700\u8FD1\u53D8\u66F4\u6587\u4EF6\uFF1B\u5982\u9700\u539F\u6587\u8BF7\u6309\u9700\u8BFB\u53D6\u3002";
    const footerParts = [];
    for (const layerName of ["global", "task", "execution"]) {
      const layer = layers[layerName];
      if (layer.omitted.length > 0) footerParts.push(`${layerName}: ${layer.omitted.join("\uFF1B")}`);
    }
    const footer = footerParts.length > 0 ? `

> \u7701\u7565/\u7F3A\u5931\u8BF4\u660E\uFF1A${footerParts.join(" | ")}` : "";
    const layerTruncated = ["global", "task", "execution"].some(
      (layerName) => layers[layerName].omitted.some((note) => /截断/.test(note))
    );
    let text = blocks.length > 0 ? `${heading}

${blocks.join("\n\n")}${footer}` : `${heading}

\uFF08\u6682\u65E0\u53EF\u7528\u4E0A\u4E0B\u6587\uFF09`;
    const clipped = truncate3(text, maxChars);
    text = clipped.text;
    if (clipped.truncated) notes.push("\u6574\u4F53\u8D85\u51FA maxChars \u5DF2\u622A\u65AD\uFF08\u53EF\u8C03\u5927 maxChars \u6216\u7F29\u5C0F scope\uFF09");
    notes.push("estimatedTokens = usedChars / 4\uFF0C\u662F\u4F30\u7B97\u503C\uFF08\u975E API \u503C\uFF09");
    notes.push("\u6240\u6709 token \u6570\u5B57\u6765\u81EA\u672C\u5730 usage_records\uFF1Areasoning \u7F3A\u5931\u65F6\u4E3A NULL\uFF0C\u4E0D\u5199 0");
    const usedChars = text.length;
    const taskRow = taskResult.task;
    return {
      found: blocks.length > 0,
      scope,
      projectId,
      sessionId,
      taskId: taskRow?.id ?? "",
      layers,
      budget: {
        maxChars,
        usedChars,
        estimatedTokens: Math.ceil(usedChars / 4),
        truncated: clipped.truncated || layerTruncated
      },
      text,
      notes
    };
  };
  return { config, build };
}
function createContextPackToolDefinition(deps) {
  const { service } = deps;
  return {
    name: "token_manager_context",
    description: 'Get a bounded, layered context pack for this session: project summary (8 sections), current task summary with recent decisions, and recently changed files. Use it when delegating work to a subagent or continuing a long/compacted session, so you can pass a small pack instead of pasting full history. Use scope="project" for background only, "task" for the current task, "all" for both plus changed files. It returns summaries, not raw file contents: read files directly when exact content is required. Output is trimmed to maxChars with explicit omission notes and an estimated token count.',
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        scope: {
          type: "string",
          enum: ["task", "project", "all"],
          description: 'Which layers to include. Default "task": project background + current task summary/decisions. "project": background only. "all": also recent changed files.'
        },
        taskId: {
          type: "string",
          description: "Task id to summarize. Defaults to the current session's most recent task."
        },
        maxChars: {
          type: "number",
          description: "Hard character budget for the returned pack (1000-20000, default from settings ~6000)."
        }
      },
      required: []
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          found: { type: "boolean" },
          scope: { type: "string" },
          projectId: { type: "string" },
          sessionId: { type: "string" },
          taskId: { type: "string" },
          text: { type: "string" },
          layers: {
            type: "object",
            additionalProperties: false,
            properties: {
              global: { type: "object", additionalProperties: false, properties: { included: { type: "boolean" }, chars: { type: "integer" }, sections: { type: "array", items: { type: "string" } }, omitted: { type: "array", items: { type: "string" } } }, required: ["included", "chars", "sections", "omitted"] },
              task: { type: "object", additionalProperties: false, properties: { included: { type: "boolean" }, chars: { type: "integer" }, sections: { type: "array", items: { type: "string" } }, omitted: { type: "array", items: { type: "string" } } }, required: ["included", "chars", "sections", "omitted"] },
              execution: { type: "object", additionalProperties: false, properties: { included: { type: "boolean" }, chars: { type: "integer" }, sections: { type: "array", items: { type: "string" } }, omitted: { type: "array", items: { type: "string" } } }, required: ["included", "chars", "sections", "omitted"] }
            },
            required: ["global", "task", "execution"]
          },
          budget: {
            type: "object",
            additionalProperties: false,
            properties: {
              maxChars: { type: "integer" },
              usedChars: { type: "integer" },
              estimatedTokens: { type: "integer" },
              truncated: { type: "boolean" }
            },
            required: ["maxChars", "usedChars", "estimatedTokens", "truncated"]
          },
          notes: { type: "array", items: { type: "string" } }
        },
        required: ["found", "scope", "projectId", "sessionId", "taskId", "text", "layers", "budget", "notes"]
      },
      render(_args, value) {
        const blocks = [];
        const text = typeof value.text === "string" ? value.text : "";
        blocks.push({ type: "text", text });
        const budget = asRecord11(value.budget);
        blocks.push({
          type: "text",
          text: `[token_manager_context] scope=${String(value.scope ?? "")} \xB7 \u5DF2\u7528 ${num12(budget.usedChars)}/${num12(budget.maxChars)} \u5B57\u7B26 \xB7 \u4F30\u7B97 ~${num12(budget.estimatedTokens)} tokens\uFF08\u4F30\u7B97\u503C\uFF0C\u975E API\uFF09${budget.truncated === true ? " \xB7 \u5DF2\u622A\u65AD" : ""}`
        });
        const notes = Array.isArray(value.notes) ? value.notes.filter((item) => typeof item === "string") : [];
        if (notes.length > 0) blocks.push({ type: "text", text: `[token_manager_context] ${notes.join("\uFF1B")}` });
        return blocks;
      }
    },
    async execute(args, exec) {
      const session = exec?.agent?.session;
      const sessionId = session?.id ? String(session.id) : null;
      const header = asRecord11(session?.header);
      const isSubagent = header.origin === "subagent" || Boolean(header.parentSession);
      const pack = service.build({
        sessionId,
        projectId: typeof header.cwd === "string" ? header.cwd : null,
        taskId: typeof args.taskId === "string" && args.taskId.length > 0 ? args.taskId : null,
        scope: args.scope === "project" || args.scope === "all" ? args.scope : "task",
        maxChars: typeof args.maxChars === "number" ? args.maxChars : void 0,
        isSubagent
      });
      const layerOf = (layer) => ({
        included: layer.included === true,
        chars: Math.trunc(layer.chars),
        sections: layer.sections.map((item) => String(item)),
        omitted: layer.omitted.map((item) => String(item))
      });
      return {
        found: pack.found === true,
        scope: pack.scope,
        projectId: String(pack.projectId ?? ""),
        sessionId: String(pack.sessionId ?? ""),
        taskId: String(pack.taskId ?? ""),
        text: String(pack.text ?? ""),
        layers: { global: layerOf(pack.layers.global), task: layerOf(pack.layers.task), execution: layerOf(pack.layers.execution) },
        budget: {
          maxChars: Math.trunc(pack.budget.maxChars),
          usedChars: Math.trunc(pack.budget.usedChars),
          estimatedTokens: Math.trunc(pack.budget.estimatedTokens),
          truncated: pack.budget.truncated === true
        },
        notes: pack.notes.map((item) => String(item))
      };
    }
  };
}

// src/index.ts
var name = PLUGIN_NAME;
var inject = ["tools"];
function projectIdOf3(cwd) {
  return cwd && cwd.trim() ? cwd.trim() : "unknown";
}
function apply(ctx, config = {}) {
  const dataDir = resolveDataDir(config.dataDir);
  let store;
  try {
    store = openStore(dataDir);
  } catch (error) {
    ctx.logger?.warn?.("[token-manager] storage unavailable, plugin idle:", String(error));
    return;
  }
  const recordError = (where, error) => {
    try {
      store.metaSet(
        "last_error",
        JSON.stringify({ ts: Date.now(), where, message: String(error?.message ?? error) })
      );
    } catch {
    }
    ctx.logger?.warn?.(`[token-manager] ${where} failed:`, String(error?.message ?? error));
  };
  const settings = createSettingsStore(store);
  const costs = createCostCalculator(store, settings);
  let autoScheduler = null;
  let autoApi = null;
  try {
    autoScheduler = createAutoScheduler({
      ctx,
      store,
      settings,
      logger: ctx.logger,
      recordError,
      costs
    });
    autoApi = createAutoApi({ scheduler: autoScheduler, settings, store });
  } catch (error) {
    recordError("auto.init", error);
  }
  const tasks = createTaskManager(store, settings, {
    costOf: (buckets, provider, model) => costs.costOf(buckets, provider, model)
  });
  const analytics = createAnalytics(store, settings, costs);
  const baseline = createBaseline(store, settings);
  let reports = null;
  let importer = null;
  const ledger = createUsageLedger({
    store,
    settings,
    costs,
    tasks,
    analytics,
    autoEffort: (sessionId, turn, step) => {
      try {
        return autoScheduler?.effortFor?.(sessionId, turn, step) ?? null;
      } catch {
        return null;
      }
    },
    onTaskEnded: () => {
      try {
        baseline.recomputeThrottled();
      } catch (error) {
        recordError("baseline.recompute", error);
      }
    }
  });
  reports = createReportService({ store, settings, costs, baseline, analytics, tasks });
  importer = createImporter({ store, costs, dataRoot: dataDir });
  let blobStore = null;
  let repo = null;
  let toolCache = null;
  let cacheApi = null;
  let cacheReady = false;
  let contextReuseRef = null;
  try {
    const compression = settings.get().compression ?? CACHE_DEFAULTS;
    blobStore = createBlobStore({
      dataDir,
      maxBlobBytes: Number(compression.maxBlobBytes ?? CACHE_DEFAULTS.maxBlobBytes),
      store
    });
    repo = createBlobRepository(store, blobStore);
    cacheApi = createCacheApi({ store, settings, repo, blobStore });
    toolCache = createToolCache({
      store,
      settings,
      blobStore,
      repo,
      contextReuse: {
        apply: (exec, result, decision) => contextReuseRef?.apply(exec, result, decision) ?? null
      }
    });
    try {
      blobStore.prune({
        maxBytes: Number(compression.maxCacheMB ?? CACHE_DEFAULTS.maxCacheMB) * 1024 * 1024,
        ttlDays: Number(compression.ttlDays ?? CACHE_DEFAULTS.ttlDays)
      });
    } catch (error) {
      recordError("cache.prune", error);
    }
    cacheReady = true;
  } catch (error) {
    recordError("cache.init", error);
  }
  let optimizations = null;
  let contextAnalyzer = null;
  let contextApi = null;
  try {
    optimizations = createOptimizationRepository(store);
    const measureSession = (session) => {
      const tokenMeter = ctx.get("tokenMeter");
      if (!tokenMeter || typeof tokenMeter.measure !== "function") return null;
      try {
        const measured = tokenMeter.measure(session);
        const nodes = Array.isArray(measured?.nodes) ? measured.nodes : [];
        return {
          totalTokens: Number(measured?.totalTokens ?? 0),
          nodes: nodes.map((node) => ({ seq: Number(node?.seq ?? 0), tokens: Number(node?.tokens ?? 0) }))
        };
      } catch {
        return null;
      }
    };
    const resolveSession = (sessionId) => {
      const sessions = ctx.get("sessions");
      if (!sessions || typeof sessions.get !== "function") return null;
      try {
        return sessions.get(sessionId) ?? null;
      } catch {
        return null;
      }
    };
    contextAnalyzer = createContextAnalyzer({ store, settings, costs, optimizations, resolveSession, measureSession });
    contextApi = createContextApi({ store, settings, costs, analyzer: contextAnalyzer, optimizations, tasks });
  } catch (error) {
    recordError("context.init", error);
  }
  let taskService = null;
  let projectService = null;
  try {
    const projectRepo = createProjectRepository(store);
    taskService = createTaskService({ store, settings, costs, tasks });
    projectService = createProjectService({ store, settings, costs, projects: projectRepo, tasks });
  } catch (error) {
    recordError("projects.init", error);
  }
  const resolveRuntimeSession = (sessionId) => {
    const sessions = ctx.get("sessions");
    if (!sessions || typeof sessions.get !== "function") return null;
    try {
      const session = sessions.get(sessionId);
      return session && typeof session === "object" ? session : null;
    } catch {
      return null;
    }
  };
  const measureRuntimeSession = (sessionId) => {
    const tokenMeter = ctx.get("tokenMeter");
    const sessions = ctx.get("sessions");
    if (!tokenMeter || typeof tokenMeter.measure !== "function" || !sessions || typeof sessions.get !== "function") return null;
    try {
      const session = sessions.get(sessionId);
      if (!session) return null;
      const measured = tokenMeter.measure(session);
      const total = Number(measured?.totalTokens);
      if (!Number.isFinite(total)) return null;
      const out = { totalTokens: total };
      const surface = Number(measured?.surfaceTokens);
      if (Number.isFinite(surface) && surface > 0) out.surfaceTokens = surface;
      const window = Number(measured?.contextWindow);
      if (Number.isFinite(window) && window > 0) out.contextWindow = window;
      return out;
    } catch {
      return null;
    }
  };
  try {
    contextReuseRef = createContextReuse({ store, settings, blobStore: blobStore ?? void 0, repo: repo ?? void 0 });
  } catch (error) {
    contextReuseRef = null;
    recordError("context-reuse.init", error);
  }
  let subagentAudit = null;
  try {
    subagentAudit = createSubagentAudit({
      store,
      settings,
      resolveSession: resolveRuntimeSession,
      measureSession: measureRuntimeSession,
      recordError
    });
    const audit = subagentAudit;
    ctx.on("subagent/start", (info) => {
      try {
        if (!settings.get().enabled) return;
        audit.onStart(info);
      } catch (error) {
        recordError("subagent-audit.start", error);
      }
    });
    ctx.on("subagent/end", (info) => {
      try {
        if (!settings.get().enabled) return;
        audit.onEnd(info);
      } catch (error) {
        recordError("subagent-audit.end", error);
      }
    });
  } catch (error) {
    recordError("subagent-audit.init", error);
  }
  let contextPack = null;
  try {
    contextPack = createContextPack({ store, settings, resolveSession: resolveRuntimeSession, recordError });
    const pack = contextPack;
    const definition = createContextPackToolDefinition({ service: pack });
    ctx.effect(() => ctx.tools.register(definition), "token-manager: token_manager_context");
  } catch (error) {
    recordError("context-pack.init", error);
  }
  const readContextPressure = (sessionId) => {
    const projections = ctx.get("sessionProjections");
    const sessions = ctx.get("sessions");
    if (!projections || typeof projections.snapshot !== "function" || !sessions || typeof sessions.get !== "function") return null;
    try {
      const session = sessions.get(sessionId);
      if (!session) return null;
      let snapshot = null;
      try {
        const handle = projections.stateOf?.(session, "contextPressure") ?? projections.get?.("contextPressure")?.stateOf?.(session);
        if (handle && typeof handle === "object") snapshot = { contextPressure: handle };
      } catch {
        snapshot = null;
      }
      if (snapshot === null) snapshot = projections.snapshot(session, ["contextPressure"]);
      const candidates = [
        snapshot?.contextPressure,
        snapshot?.rows?.contextPressure?.val,
        snapshot?.contextPressure?.val,
        snapshot?.rows?.contextPressure,
        snapshot
      ];
      for (const candidate of candidates) {
        if (!candidate || typeof candidate !== "object") continue;
        const record = candidate;
        const window = Number(record.contextWindow);
        const used = Number(record.projectedTokens ?? record.pressureTokens ?? record.surfaceTokens);
        if (Number.isFinite(window) && window > 0 && Number.isFinite(used) && used >= 0) return record;
      }
      return null;
    } catch {
      return null;
    }
  };
  const upsertSession = (session) => {
    const header = session?.header ?? {};
    const id = String(session?.id ?? header.id ?? "");
    if (!id) return;
    const now = Date.now();
    const cwd = typeof header.cwd === "string" ? header.cwd : null;
    const origin = typeof header.origin === "string" ? header.origin : null;
    const parent = typeof header.parentSession === "string" ? header.parentSession : null;
    const preset = typeof header.agentPreset === "string" ? header.agentPreset : null;
    const createdAt = Number(header.createdAt ?? now);
    const isSubagent = origin === "subagent" || parent ? 1 : 0;
    store.run(
      `INSERT INTO sessions(session_id, project_id, cwd, parent_session_id, origin, agent_preset, created_at, last_seen_at, is_subagent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         last_seen_at = excluded.last_seen_at,
         cwd = COALESCE(sessions.cwd, excluded.cwd),
         project_id = CASE WHEN sessions.project_id = 'unknown' THEN excluded.project_id ELSE sessions.project_id END,
         parent_session_id = COALESCE(sessions.parent_session_id, excluded.parent_session_id),
         origin = COALESCE(sessions.origin, excluded.origin),
         agent_preset = COALESCE(sessions.agent_preset, excluded.agent_preset),
         is_subagent = CASE WHEN excluded.is_subagent = 1 THEN 1 ELSE sessions.is_subagent END`,
      id,
      projectIdOf3(cwd),
      cwd,
      parent,
      origin,
      preset,
      createdAt,
      now,
      isSubagent
    );
  };
  ctx.on("session/event", (session, event) => {
    try {
      if (!settings.get().enabled) return;
      upsertSession(session);
      ledger.handle(session, event);
      subagentAudit?.onSessionEvent(session, event);
    } catch (error) {
      recordError("session/event", error);
    }
  });
  if (autoScheduler) {
    const scheduler = autoScheduler;
    ctx.on("agent/inbox/inserted", (payload) => {
      try {
        if (!settings.get().enabled) return;
        scheduler.handleInboxInserted(payload);
      } catch (error) {
        recordError("auto.inbox", error);
      }
    });
    ctx.on("agent/pre-step", (payload, next) => {
      try {
        if (!settings.get().enabled) return next();
        return scheduler.handlePreStep(payload, next);
      } catch (error) {
        recordError("auto.pre-step", error);
        return next();
      }
    });
    ctx.on("session/event", (session, event) => {
      try {
        if (!settings.get().enabled) return;
        scheduler.handleSessionEvent(session, event);
      } catch (error) {
        recordError("auto.session/event", error);
      }
    });
  }
  if (toolCache) {
    const cache = toolCache;
    ctx.on("tools/post-execute", (exec, result, next) => {
      try {
        return cache.handlePostExecute(exec, result, next).catch((error) => {
          recordError("tools/post-execute", error);
          return next();
        });
      } catch (error) {
        recordError("tools/post-execute.sync", error);
        return next();
      }
    });
  }
  if (blobStore && repo) {
    try {
      const readService = createReadService({ blobStore, repo });
      const definition = createReadToolDefinition({ service: readService });
      ctx.effect(() => ctx.tools.register(definition), "token-manager: token_manager_read");
    } catch (error) {
      recordError("read-tool.register", error);
    }
  }
  let apiReady = false;
  ctx.inject(["webServer", "connection"], (inner) => {
    const webServer = inner.webServer;
    const connection = inner.connection;
    if (!webServer || !connection) return;
    try {
      const api = createHttpApi({
        store,
        settings,
        costs,
        baseline,
        analytics,
        tasks,
        reports,
        importer,
        fence: (req) => connection.requestRejection(req) === void 0,
        cache: cacheApi ?? void 0,
        context: contextApi ?? void 0,
        taskService: taskService ?? void 0,
        projectService: projectService ?? void 0,
        blobStore: blobStore ?? void 0,
        repo: repo ?? void 0,
        autoApi: autoApi ?? void 0,
        measureSession: measureRuntimeSession,
        readContextPressure
      });
      inner.effect(
        () => webServer.register({
          kind: "prefix",
          path: API_PREFIX,
          handler: (req, res) => {
            void api.handle(req, res);
          }
        }),
        "token-manager: http-api"
      );
      apiReady = true;
      try {
        store.metaSet(
          "last_start",
          JSON.stringify({
            ts: Date.now(),
            dataDir,
            dbPath: store.path,
            writable: true,
            apiReady: true,
            cacheReady,
            version: PLUGIN_VERSION
          })
        );
      } catch {
      }
    } catch (error) {
      recordError("http-api.register", error);
    }
  });
  try {
    store.metaSet(
      "last_start",
      JSON.stringify({
        ts: Date.now(),
        dataDir,
        dbPath: store.path,
        writable: storeWritable(store),
        apiReady,
        cacheReady,
        version: PLUGIN_VERSION
      })
    );
  } catch {
  }
  ctx.effect(
    () => () => {
      try {
        blobStore?.close?.();
      } catch {
      }
      try {
        store.close();
      } catch {
      }
    },
    "token-manager: store"
  );
  ctx.logger?.info?.(
    `[token-manager] ready (observe-only monitoring${cacheReady ? ", tool cache available" : ""}) at ${dataDir}`
  );
}
export {
  apply,
  inject,
  name
};
