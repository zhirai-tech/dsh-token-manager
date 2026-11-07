window.__ModuleLoader__.load({
  id: "dsh-token-manager",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  DashboardPage: () => DashboardPage,
  PANEL_ID: () => PANEL_ID,
  PanelIcon: () => PanelIcon,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react15 = require("react");

// src/shared/constants.ts
var NS = "tokenManager";
var API_PREFIX = "/token-manager/api";
var TASK_TYPES = [
  "simple-edit",
  "normal-dev",
  "complex-dev",
  "troubleshoot",
  "project-analysis"
];
var TASK_STATUSES = ["pending", "running", "completed", "paused", "failed"];
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
var CACHE_MODES = ["off", "observe", "on"];
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
var CONTEXT_MODES = ["off", "dry-run"];
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
var LIVE_POLL_MS = 5e3;
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

// src/client/api-client.ts
var ApiError = class extends Error {
  code;
  status;
  constructor(code, message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
};
function asEnvelope(value, status) {
  if (typeof value !== "object" || value === null) {
    if (status >= 200 && status < 300) throw new ApiError("bad_response", "invalid response body", status);
    throw new ApiError("http_" + String(status), "HTTP " + String(status), status);
  }
  const envelope = value;
  if (envelope.ok === true) return envelope.data;
  if (envelope.ok === false) {
    const error = envelope.error;
    throw new ApiError(error?.code ?? "error", error?.message ?? "request failed", status);
  }
  const loose = value;
  if (status >= 200 && status < 300) return loose.data ?? value;
  throw new ApiError("http_" + String(status), "HTTP " + String(status), status);
}
async function post(path, body, signal) {
  let response;
  try {
    response = await fetch(API_PREFIX + "/" + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
      credentials: "same-origin",
      cache: "no-store",
      signal
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError("network", "network error");
  }
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return asEnvelope(payload, response.status);
}
async function get(path, signal) {
  let response;
  try {
    response = await fetch(API_PREFIX + "/" + path, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError("network", "network error");
  }
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return asEnvelope(payload, response.status);
}
function pickNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0;
}
function exportFileName(now = /* @__PURE__ */ new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return "token-calls-" + String(now.getFullYear()) + pad(now.getMonth() + 1) + pad(now.getDate()) + "-" + pad(now.getHours()) + pad(now.getMinutes()) + ".csv";
}
function createBaseApi() {
  return {
    overview: (body, signal) => post("overview", body, signal),
    calls: (body, signal) => post("calls", body, signal),
    tasks: (body, signal) => post("tasks", body, signal),
    taskReport: (taskId, signal) => post("task-report", { taskId }, signal),
    findings: (body, signal) => post("findings", body, signal),
    baselines: (body, signal) => post("baselines", body, signal),
    prices: (signal) => post("prices", {}, signal),
    savePrice: async (price, signal) => post("prices/update", price, signal),
    deletePrice: async (id, signal) => {
      const result = await post("prices/delete", { id }, signal);
      if (typeof result === "number") return result;
      return pickNumber(result?.deleted ?? 0);
    },
    settings: (signal) => post("settings", {}, signal),
    updateSettings: (patch, signal) => post("settings/update", patch, signal),
    resetSettings: (signal) => post("settings/update", { reset: true }, signal),
    sessions: async (limit, signal) => {
      const rows = await post("sessions", { limit: limit ?? 50 }, signal);
      return Array.isArray(rows) ? rows : [];
    },
    live: (signal) => post("live", {}, signal),
    referencePrices: (signal) => post("prices/reference", {}, signal),
    applyReferencePrices: (signal) => post("prices/apply-reference", {}, signal),
    runImport: (body, signal) => post("import", body, signal),
    health: (signal) => post("health", {}, signal),
    exportCallsUrl: (query) => {
      const params = new URLSearchParams();
      const source = query ?? {};
      if (typeof source.from === "number") params.set("from", String(source.from));
      if (typeof source.to === "number") params.set("to", String(source.to));
      if (source.model) params.set("model", source.model);
      if (source.taskId) params.set("taskId", source.taskId);
      if (source.sessionId) params.set("sessionId", source.sessionId);
      if (source.onlyFlagged) params.set("onlyFlagged", "1");
      const suffix = params.toString();
      return API_PREFIX + "/export/calls.csv" + (suffix ? "?" + suffix : "");
    }
  };
}
function looseRecord(value) {
  return typeof value === "object" && value !== null ? value : {};
}
function looseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}
function looseString(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function looseBoolean(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}
function normalizeCacheEntry(value) {
  const row = looseRecord(value);
  const compressed = row.compressedSize;
  return {
    id: typeof row.id === "number" ? row.id : String(row.id ?? ""),
    toolName: looseString(row.toolName) ?? looseString(row.tool) ?? "unknown",
    originalSize: looseNumber(row.originalSize),
    compressedSize: compressed === null || compressed === void 0 ? null : looseNumber(compressed),
    compressionType: looseString(row.compressionType),
    mode: looseString(row.mode) ?? "observe",
    sessionId: looseString(row.sessionId),
    createdAt: looseNumber(row.createdAt),
    recoverable: looseBoolean(row.recoverable),
    blobId: looseString(row.blobId),
    contentType: looseString(row.contentType),
    hash: looseString(row.hash),
    summary: looseString(row.summary)
  };
}
var cacheMethods = {
  cacheList: async (body, signal) => {
    const raw = await post("cache/list", body, signal);
    const record = looseRecord(raw);
    const rowsRaw = Array.isArray(record.rows) ? record.rows : Array.isArray(raw) ? raw : [];
    const rows = rowsRaw.map(normalizeCacheEntry);
    const total = looseNumber(record.total);
    return { total: total > 0 ? total : rows.length, rows };
  },
  cacheStats: async (signal) => {
    const record = looseRecord(await post("cache/stats", {}, signal));
    return {
      blobs: looseNumber(record.blobs),
      totalOriginalBytes: looseNumber(record.totalOriginalBytes),
      totalCompressedBytes: looseNumber(record.totalCompressedBytes),
      savedBytes: looseNumber(record.savedBytes),
      dedupeCount: looseNumber(record.dedupeCount),
      missingBlobs: looseNumber(record.missingBlobs),
      usageBytes: looseNumber(record.usageBytes)
    };
  },
  cacheRead: async (body, signal) => {
    const record = looseRecord(await post("cache/read", body, signal));
    const next = record.nextOffset;
    return {
      blobId: looseString(record.blobId) ?? body.blobId,
      content: typeof record.content === "string" ? record.content : "",
      offset: looseNumber(record.offset),
      totalBytes: looseNumber(record.totalBytes),
      nextOffset: typeof next === "number" && Number.isFinite(next) ? next : null
    };
  },
  cacheVerify: async (signal) => {
    const record = looseRecord(await post("cache/verify", {}, signal));
    return {
      missingFiles: looseNumber(record.missingFiles),
      orphanFiles: looseNumber(record.orphanFiles),
      hashMismatch: looseNumber(record.hashMismatch),
      repaired: looseNumber(record.repaired)
    };
  },
  cacheClear: async (signal) => {
    const record = looseRecord(await post("cache/clear", {}, signal));
    return { removed: looseNumber(record.removed), freedBytes: looseNumber(record.freedBytes) };
  }
};
function createApi() {
  return Object.assign(createBaseApi(), cacheMethods, contextMethods, phase4Methods, autoMethods);
}
function normalizeMetricList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      const row = looseRecord(item);
      return { key: looseString(row.key) ?? looseString(row.name) ?? "unknown", value: looseNumber(row.value) };
    }).filter((item) => item.value > 0).sort((left, right) => right.value - left.value);
  }
  const record = looseRecord(value);
  return Object.keys(record).map((key) => ({ key, value: looseNumber(record[key]) })).filter((item) => item.value > 0).sort((left, right) => right.value - left.value);
}
function normalizeOccurrence(value) {
  const row = looseRecord(value);
  const turn = row.turn;
  const step = row.step;
  return {
    seq: looseNumber(row.seq),
    turn: typeof turn === "number" ? turn : null,
    step: typeof step === "number" ? step : null,
    role: looseString(row.role) ?? "unknown",
    source: looseString(row.source) ?? "unknown",
    tokens: looseNumber(row.tokens),
    bytes: looseNumber(row.bytes)
  };
}
function normalizeCacheRisk(value) {
  const row = looseRecord(value);
  const changePoint = row.changePointSeq;
  const extra = row.extraCost;
  const saving = row.savingCost;
  const verdict = looseString(row.verdict) ?? (looseBoolean(row.risky) ? "risky" : "unknown");
  return {
    changePointSeq: typeof changePoint === "number" ? changePoint : null,
    invalidatedTokens: looseNumber(row.invalidatedTokens),
    extraCost: typeof extra === "number" ? extra : null,
    savingCost: typeof saving === "number" ? saving : null,
    risky: looseBoolean(row.risky) || verdict === "risky",
    verdict,
    reason: looseString(row.reason) ?? ""
  };
}
function normalizeCandidate(value) {
  const row = looseRecord(value);
  const occurrencesRaw = Array.isArray(row.occurrences) ? row.occurrences : [];
  return {
    kind: looseString(row.kind) ?? "unknown",
    contentHash: looseString(row.contentHash),
    subject: looseString(row.subject) ?? looseString(row.toolName) ?? "\u2014",
    occurrences: occurrencesRaw.map(normalizeOccurrence),
    removableTokens: looseNumber(row.removableTokens),
    cacheRisk: normalizeCacheRisk(row.cacheRisk),
    recommend: looseBoolean(row.recommend),
    note: looseString(row.note)
  };
}
function normalizeAnalysis(value) {
  const row = looseRecord(value);
  const surface = looseRecord(row.surface);
  const totals = looseRecord(row.totals);
  const candidatesRaw = Array.isArray(row.candidates) ? row.candidates : [];
  return {
    found: looseBoolean(row.found),
    sessionId: looseString(row.sessionId),
    surface: {
      nodes: looseNumber(surface.nodes),
      tokens: looseNumber(surface.tokens),
      byRole: normalizeMetricList(surface.byRole),
      bySource: normalizeMetricList(surface.bySource)
    },
    candidates: candidatesRaw.map(normalizeCandidate),
    totals: {
      candidateCount: looseNumber(totals.candidateCount),
      potentialSavingsTokens: looseNumber(totals.potentialSavingsTokens),
      riskyCount: looseNumber(totals.riskyCount)
    },
    mode: looseString(row.mode) ?? "dry-run",
    readOnly: row.readOnly === void 0 ? true : looseBoolean(row.readOnly)
  };
}
var contextMethods = {
  contextAnalyze: async (body, signal) => {
    return normalizeAnalysis(await post("context/analyze", body, signal));
  },
  contextOptimize: async (body, signal) => {
    const record = looseRecord(await post("context/optimize", body, signal));
    return {
      recorded: looseNumber(record.recorded),
      analysis: record.analysis === void 0 || record.analysis === null ? null : normalizeAnalysis(record.analysis)
    };
  },
  optimizationsList: async (body, signal) => {
    const raw = await post("optimizations/list", body, signal);
    const record = looseRecord(raw);
    const rowsRaw = Array.isArray(record.rows) ? record.rows : Array.isArray(raw) ? raw : [];
    const rows = rowsRaw.map((item) => {
      const row = looseRecord(item);
      return {
        id: typeof row.id === "number" ? row.id : String(row.id ?? ""),
        createdAt: looseNumber(row.createdAt),
        optimizationType: looseString(row.optimizationType) ?? "unknown",
        originalTokensEstimated: looseNumber(row.originalTokensEstimated),
        optimizedTokensEstimated: looseNumber(row.optimizedTokensEstimated),
        estimatedSavings: looseNumber(row.estimatedSavings),
        verified: looseBoolean(row.verified),
        status: looseString(row.status) ?? "dry-run",
        cacheImpact: looseString(row.cacheImpact)
      };
    });
    const total = looseNumber(record.total);
    return { total: total > 0 ? total : rows.length, rows };
  },
  contextStats: async (signal) => {
    return looseRecord(await post("context/stats", {}, signal));
  }
};
function normalizeSummary(value) {
  const record = looseRecord(value);
  const out = {};
  for (const [key, item] of Object.entries(record)) {
    if (typeof item === "string") out[key] = item;
    else if (item === null || item === void 0) out[key] = "";
    else out[key] = String(item);
  }
  return out;
}
function normalizeTaskRow(value) {
  const row = looseRecord(value);
  return {
    id: looseString(row.id) ?? "",
    sessionId: looseString(row.sessionId) ?? "",
    projectId: looseString(row.projectId) ?? "",
    taskName: looseString(row.taskName) ?? "",
    taskType: looseString(row.taskType) ?? "normal-dev",
    taskTypeSource: looseString(row.taskTypeSource) ?? "heuristic",
    status: looseString(row.status) ?? "pending",
    origin: looseString(row.origin) ?? "auto",
    turn: typeof row.turn === "number" ? row.turn : null,
    startedAt: looseNumber(row.startedAt),
    endedAt: typeof row.endedAt === "number" ? row.endedAt : null,
    startSnapshot: looseString(row.startSnapshot),
    endSnapshot: looseString(row.endSnapshot),
    summary: looseString(row.summary),
    interference: looseNumber(row.interference),
    firstPrompt: looseString(row.firstPrompt)
  };
}
function normalizeTaskDetail(value) {
  const row = looseRecord(value);
  if (Object.keys(row).length === 0) return null;
  const metrics = looseRecord(row.metrics);
  const callsRaw = Array.isArray(row.calls) ? row.calls : [];
  const writesRaw = Array.isArray(row.writes) ? row.writes : [];
  const findingsRaw = Array.isArray(row.findings) ? row.findings : [];
  return {
    task: normalizeTaskRow(row.task),
    metrics: {
      calls: looseNumber(metrics.calls),
      inputTokens: looseNumber(metrics.inputTokens),
      cacheReadTokens: looseNumber(metrics.cacheReadTokens),
      cacheWriteTokens: looseNumber(metrics.cacheWriteTokens),
      outputTokens: looseNumber(metrics.outputTokens),
      totalTokens: looseNumber(metrics.totalTokens),
      cost: typeof metrics.cost === "number" ? metrics.cost : null,
      durationMs: typeof metrics.durationMs === "number" ? metrics.durationMs : null,
      toolCalls: looseNumber(metrics.toolCalls)
    },
    calls: callsRaw.map((item) => {
      const call = looseRecord(item);
      return {
        id: typeof call.id === "number" ? call.id : String(call.id ?? ""),
        ts: looseNumber(call.ts),
        turn: looseNumber(call.turn),
        step: looseNumber(call.step),
        provider: looseString(call.provider),
        model: looseString(call.model),
        inputTokens: looseNumber(call.inputTokens),
        cacheReadTokens: looseNumber(call.cacheReadTokens),
        cacheWriteTokens: looseNumber(call.cacheWriteTokens),
        outputTokens: looseNumber(call.outputTokens),
        totalTokens: looseNumber(call.totalTokens),
        durationMs: typeof call.durationMs === "number" ? call.durationMs : null,
        cost: typeof call.cost === "number" ? call.cost : null
      };
    }),
    writes: writesRaw.map((item) => {
      const write = looseRecord(item);
      return {
        toolName: looseString(write.toolName) ?? "unknown",
        targetPath: looseString(write.targetPath),
        command: looseString(write.command),
        count: looseNumber(write.count)
      };
    }),
    findings: findingsRaw.map((item) => {
      const finding = looseRecord(item);
      return {
        id: typeof finding.id === "number" ? finding.id : void 0,
        sessionId: looseString(finding.sessionId) ?? "",
        taskId: looseString(finding.taskId),
        kind: looseString(finding.kind) ?? "step_inflation",
        severity: looseString(finding.severity) ?? "info",
        subject: looseString(finding.subject) ?? "",
        detail: looseString(finding.detail) ?? "",
        evidence: looseString(finding.evidence) ?? "",
        createdAt: looseNumber(finding.createdAt)
      };
    }),
    summary: normalizeSummary(row.summary),
    summaryEdited: looseBoolean(row.summaryEdited)
  };
}
function normalizeProjectItem(value) {
  const row = looseRecord(value);
  return {
    projectId: looseString(row.projectId) ?? "",
    sessions: looseNumber(row.sessions),
    tasks: looseNumber(row.tasks),
    calls: looseNumber(row.calls),
    totalTokens: looseNumber(row.totalTokens),
    cost: typeof row.cost === "number" ? row.cost : null,
    lastActivity: typeof row.lastActivity === "number" ? row.lastActivity : null,
    hasSummary: looseBoolean(row.hasSummary),
    summaryUpdatedAt: typeof row.summaryUpdatedAt === "number" ? row.summaryUpdatedAt : null
  };
}
function normalizeProjectRecord(value) {
  const row = looseRecord(value);
  if (Object.keys(row).length === 0) return null;
  return {
    projectId: looseString(row.projectId) ?? "",
    version: looseNumber(row.version),
    summary: normalizeSummary(row.summary),
    createdAt: looseNumber(row.createdAt),
    updatedAt: looseNumber(row.updatedAt)
  };
}
function normalizeExport(value, fallbackName, fallbackType) {
  const row = looseRecord(value);
  const content = typeof row.content === "string" ? row.content : JSON.stringify(value ?? {}, null, 2);
  return {
    filename: looseString(row.filename) ?? fallbackName,
    contentType: looseString(row.contentType) ?? fallbackType,
    content
  };
}
function exportFallbacks(format) {
  if (format === "json") return { name: "export.json", type: "application/json;charset=utf-8" };
  if (format === "markdown") return { name: "export.md", type: "text/markdown;charset=utf-8" };
  return { name: "export.csv", type: "text/csv;charset=utf-8" };
}
var phase4Methods = {
  createTask: async (body, signal) => {
    return normalizeTaskRow(await post("tasks/create", body, signal));
  },
  updateTask: async (id, patch, signal) => {
    return normalizeTaskRow(await post("tasks/update", { id, ...patch }, signal));
  },
  mergeTasks: async (body, signal) => {
    const raw = await post("tasks/merge", body, signal);
    const record = looseRecord(raw);
    const task = record.task ?? raw;
    const normalized = normalizeTaskRow(task);
    return normalized.id ? normalized : null;
  },
  taskDetail: async (id, signal) => {
    return normalizeTaskDetail(await post("tasks/detail", { id }, signal));
  },
  updateTaskSummary: async (id, summary, signal) => {
    return normalizeTaskDetail(await post("tasks/summary/update", { id, summary }, signal));
  },
  exportTask: async (id, format, signal) => {
    const fallback = exportFallbacks(format);
    return normalizeExport(
      await post("tasks/export", { id, format }, signal),
      "task-" + id + "." + (format === "markdown" ? "md" : format),
      fallback.type
    );
  },
  projectsList: async (signal) => {
    const raw = await post("projects/list", {}, signal);
    const record = looseRecord(raw);
    const rows = Array.isArray(raw) ? raw : Array.isArray(record.rows) ? record.rows : Array.isArray(record.projects) ? record.projects : [];
    return rows.map(normalizeProjectItem);
  },
  projectSummary: async (projectId, signal) => {
    const raw = await post("projects/summary", { projectId }, signal);
    const record = looseRecord(raw);
    return {
      record: normalizeProjectRecord(record.record),
      draft: normalizeSummary(record.draft),
      stats: record.stats === void 0 || record.stats === null ? null : normalizeProjectItem(record.stats)
    };
  },
  updateProjectSummary: async (projectId, summary, signal) => {
    const raw = await post("projects/summary/update", { projectId, summary }, signal);
    return normalizeProjectRecord(looseRecord(raw).record ?? raw) ?? {
      projectId,
      version: 0,
      summary,
      createdAt: 0,
      updatedAt: 0
    };
  },
  exportProject: async (projectId, format, signal) => {
    const fallback = exportFallbacks(format);
    return normalizeExport(
      await post("projects/export", { projectId, format }, signal),
      "project." + (format === "markdown" ? "md" : "json"),
      fallback.type
    );
  }
};
function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function normalizeAutoEffort(value) {
  const effort = looseString(value);
  return effort === "off" || effort === "low" || effort === "high" || effort === "max" ? effort : "off";
}
var AUTO_ACTIONS = ["classify", "escalate", "hold", "reset", "manual-exit", "skip"];
function normalizeAutoDecision(value) {
  const record = looseRecord(value);
  const actionRaw = looseString(record.action);
  const action = AUTO_ACTIONS.includes(actionRaw ?? "") ? actionRaw : "skip";
  const evidenceRaw = looseRecord(record.evidence);
  const evidence = typeof record.evidence === "object" && record.evidence !== null ? {
    files: stringArray(evidenceRaw.files),
    tools: stringArray(evidenceRaw.tools),
    failures: looseNumber(evidenceRaw.failures),
    environmentFailures: looseNumber(evidenceRaw.environmentFailures),
    reasoningFailures: looseNumber(evidenceRaw.reasoningFailures),
    failureKinds: stringArray(evidenceRaw.failureKinds),
    steps: looseNumber(evidenceRaw.steps),
    signals: stringArray(evidenceRaw.signals)
  } : null;
  return {
    id: looseNumber(record.id),
    ts: looseNumber(record.ts),
    sessionId: looseString(record.sessionId) ?? "",
    turn: typeof record.turn === "number" ? record.turn : null,
    step: typeof record.step === "number" ? record.step : null,
    taskType: looseString(record.taskType),
    fromEffort: looseString(record.fromEffort),
    toEffort: normalizeAutoEffort(record.toEffort),
    stage: looseNumber(record.stage),
    action,
    reasons: stringArray(record.reasons),
    evidence,
    applied: looseBoolean(record.applied)
  };
}
function normalizeAutoStatus(value) {
  const record = looseRecord(value);
  const modeRaw = looseString(record.mode);
  const mode = modeRaw === "auto" || modeRaw === "manual" || modeRaw === "off" ? modeRaw : "off";
  const currentRaw = looseRecord(record.current);
  const currentProvider = looseString(currentRaw.provider);
  const currentModel = looseString(currentRaw.model);
  const current = currentProvider && currentModel ? { provider: currentProvider, model: currentModel, effort: looseString(currentRaw.effort) } : null;
  const taskRaw = looseRecord(record.task);
  const task = typeof record.task === "object" && record.task !== null ? {
    type: looseString(taskRaw.type) ?? "normal-dev",
    stage: looseNumber(taskRaw.stage),
    effort: looseString(taskRaw.effort) ?? "off",
    confidence: looseNumber(taskRaw.confidence),
    reasons: stringArray(taskRaw.reasons)
  } : null;
  return {
    enabled: looseBoolean(record.enabled),
    sessionId: looseString(record.sessionId),
    mode,
    current,
    supportedEfforts: stringArray(record.supportedEfforts),
    task,
    lastDecision: record.lastDecision === void 0 || record.lastDecision === null ? null : normalizeAutoDecision(record.lastDecision),
    estimates: looseBoolean(record.estimates)
  };
}
function normalizeAutoClassification(value) {
  const record = looseRecord(value);
  const signals = looseRecord(record.signals);
  return {
    taskType: looseString(record.taskType) ?? "normal-dev",
    effort: normalizeAutoEffort(record.effort) === "high" || normalizeAutoEffort(record.effort) === "max" ? "low" : normalizeAutoEffort(record.effort),
    confidence: looseNumber(record.confidence),
    reasons: stringArray(record.reasons),
    signals: {
      length: looseNumber(signals.length),
      files: looseNumber(signals.files),
      modules: looseNumber(signals.modules),
      keywords: stringArray(signals.keywords),
      intent: looseString(signals.intent) ?? "",
      isSubagent: looseBoolean(signals.isSubagent)
    }
  };
}
function copyOptionalFields(target, source, keys) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" || typeof value === "string") target[key] = value;
  }
}
var AUTO_BUCKET_OPTIONAL_FIELDS = ["cacheReadTokens", "reasoningEstimatedTokens", "reasoningSource", "reasoningReported"];
function normalizeAutoModeBucket(value, mode) {
  const record = looseRecord(value);
  const bucket = {
    mode,
    calls: looseNumber(record.calls),
    tasks: looseNumber(record.tasks),
    inputTokens: looseNumber(record.inputTokens),
    outputTokens: looseNumber(record.outputTokens),
    reasoningTokens: typeof record.reasoningTokens === "number" ? record.reasoningTokens : null,
    totalTokens: looseNumber(record.totalTokens),
    cost: typeof record.cost === "number" ? record.cost : null,
    successRate: typeof record.successRate === "number" ? record.successRate : null,
    avgTokensPerTask: typeof record.avgTokensPerTask === "number" ? record.avgTokensPerTask : null
  };
  copyOptionalFields(bucket, record, AUTO_BUCKET_OPTIONAL_FIELDS);
  return bucket;
}
function normalizeAutoEffortBucket(value) {
  const record = looseRecord(value);
  const bucket = {
    effort: looseString(record.effort) ?? "off",
    calls: looseNumber(record.calls),
    inputTokens: looseNumber(record.inputTokens),
    outputTokens: looseNumber(record.outputTokens),
    reasoningTokens: typeof record.reasoningTokens === "number" ? record.reasoningTokens : null,
    cacheReadTokens: looseNumber(record.cacheReadTokens),
    totalTokens: looseNumber(record.totalTokens),
    cost: typeof record.cost === "number" ? record.cost : null,
    tasks: looseNumber(record.tasks)
  };
  copyOptionalFields(bucket, record, AUTO_BUCKET_OPTIONAL_FIELDS);
  return bucket;
}
function normalizeAutoSummary(value) {
  const outer = looseRecord(value);
  const record = looseRecord(outer.summary ?? outer);
  const estimatesRaw = record.estimates;
  return {
    generatedAt: looseNumber(record.generatedAt) || Date.now(),
    auto: normalizeAutoModeBucket(record.auto, "auto"),
    manual: normalizeAutoModeBucket(record.manual, "manual"),
    byEffort: Array.isArray(record.byEffort) ? record.byEffort.map(normalizeAutoEffortBucket) : [],
    decisions: looseNumber(record.decisions),
    escalations: looseNumber(record.escalations),
    applied: looseNumber(record.applied),
    monitorOnly: looseNumber(record.monitorOnly),
    // 契约目前是 boolean；若后续扩展为 { reasoningEstimatedTokens, ... } 对象也视为含估算值。
    estimates: looseBoolean(estimatesRaw) || typeof estimatesRaw === "object" && estimatesRaw !== null,
    notes: stringArray(record.notes)
  };
}
var autoMethods = {
  autoStatus: async (sessionId, signal) => {
    const query = sessionId ? "?sessionId=" + encodeURIComponent(sessionId) : "";
    const raw = await get("auto/status" + query, signal);
    const record = looseRecord(raw);
    return normalizeAutoStatus(record.status !== void 0 && record.status !== null ? record.status : raw);
  },
  autoEnable: async (enabled, signal) => {
    const raw = await post("auto/enable", { enabled }, signal);
    const record = looseRecord(raw);
    const statusRaw = record.status !== void 0 && record.status !== null ? record.status : record.mode !== void 0 ? raw : null;
    return {
      enabled: typeof record.enabled === "boolean" ? record.enabled : enabled,
      status: statusRaw === null ? null : normalizeAutoStatus(statusRaw)
    };
  },
  autoManual: async (sessionId, signal) => {
    const record = looseRecord(await post("auto/manual", { sessionId }, signal));
    return { manual: record.manual === void 0 ? true : looseBoolean(record.manual) };
  },
  autoClassify: async (text, signal) => {
    return normalizeAutoClassification(await post("auto/classify", { text }, signal));
  },
  autoDecisions: async (query, signal) => {
    const params = new URLSearchParams();
    if (query?.sessionId) params.set("sessionId", query.sessionId);
    if (typeof query?.limit === "number") params.set("limit", String(query.limit));
    const suffix = params.toString();
    const raw = await get("auto/decisions" + (suffix ? "?" + suffix : ""), signal);
    const record = looseRecord(raw);
    const rows = Array.isArray(raw) ? raw : Array.isArray(record.rows) ? record.rows : Array.isArray(record.decisions) ? record.decisions : [];
    return rows.map(normalizeAutoDecision);
  },
  autoSummary: async (signal) => {
    return normalizeAutoSummary(await get("auto/summary", signal));
  }
};

// src/client/components.tsx
var import_react = require("react");

// locale/zh.json
var zh_default = {
  panel: {
    label: "\u667A\u63A7\u5F15\u64CE ControlX",
    title: "\u667A\u63A7\u5F15\u64CE ControlX \xB7 AI \u8D44\u6E90\u4F18\u5316\u5F15\u64CE",
    help: "\u667A\u63A7\u5F15\u64CE ControlX \u76D1\u63A7 Token \u7528\u91CF\u3001\u81EA\u52A8\u9009\u62E9\u63A8\u7406\u6863\u4F4D\uFF08AUTO\uFF09\u3001\u538B\u7F29\u4E0E\u590D\u7528\u5DE5\u5177\u8F93\u51FA\u3001\u5206\u6790\u6210\u672C\u4E0E\u6D6A\u8D39\uFF1B\u6570\u636E\u5168\u90E8\u4FDD\u5B58\u5728\u672C\u5730\u3002"
  },
  tabs: {
    label: "\u6807\u7B7E",
    overview: "\u603B\u89C8",
    calls: "\u8C03\u7528\u660E\u7EC6",
    tasks: "\u4EFB\u52A1",
    report: "\u6210\u672C\u5206\u6790",
    settings: "\u8BBE\u7F6E",
    cache: "\u5DE5\u5177\u7F13\u5B58",
    context: "\u4E0A\u4E0B\u6587\u5206\u6790"
  },
  common: {
    all: "\u5168\u90E8",
    allTasks: "\u5168\u90E8\u4EFB\u52A1",
    analysisOnly: "\u53EA\u8BFB\u76D1\u63A7",
    callsShort: "\u6B21\u8C03\u7528",
    cancel: "\u53D6\u6D88",
    delete: "\u5220\u9664",
    edit: "\u7F16\u8F91",
    exportCsv: "\u5BFC\u51FA CSV",
    help: "\u8BF4\u660E",
    loading: "\u52A0\u8F7D\u4E2D\u2026",
    next: "\u4E0B\u4E00\u9875",
    noPrice: "\u4EF7\u683C\u672A\u914D\u7F6E",
    prev: "\u4E0A\u4E00\u9875",
    refresh: "\u5237\u65B0",
    retry: "\u91CD\u8BD5",
    rows: "\u884C",
    save: "\u4FDD\u5B58",
    saved: "\u5DF2\u4FDD\u5B58",
    saving: "\u4FDD\u5B58\u4E2D\u2026",
    sessions: "\u4F1A\u8BDD",
    unknown: "\u672A\u77E5",
    untitled: "\u672A\u547D\u540D\u4EFB\u52A1"
  },
  error: {
    generic: "\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5",
    network: "\u7F51\u7EDC\u4E0D\u53EF\u7528\uFF0C\u8BF7\u68C0\u67E5\u672C\u5730\u670D\u52A1\u662F\u5426\u5728\u8FD0\u884C"
  },
  footer: {
    poweredBy: "Powered by \u667A\u777F",
    copyright: "\xA9 2026 \u667A\u777F\u79D1\u6280"
  },
  chart: {
    empty: "\u6682\u65E0\u6570\u636E",
    trend: "Token \u8D8B\u52BF\u56FE",
    calls: "\u6BCF\u65E5\u8C03\u7528\u6B21\u6570\u56FE",
    share: "\u5360\u6BD4\u5206\u5E03\u56FE"
  },
  overview: {
    rangeLabel: "\u7EDF\u8BA1\u8303\u56F4",
    range: {
      today: "\u4ECA\u65E5",
      session: "\u672C\u4F1A\u8BDD",
      task: "\u672C\u4EFB\u52A1",
      all: "\u5168\u90E8"
    },
    cards: {
      todayTokens: "\u4ECA\u65E5 Token",
      sessionTokens: "\u672C\u4F1A\u8BDD Token",
      taskTokens: "\u672C\u4EFB\u52A1 Token",
      cacheHitRate: "\u7F13\u5B58\u547D\u4E2D\u7387",
      missInput: "\u672A\u547D\u4E2D\u8F93\u5165",
      output: "\u8F93\u51FA Token",
      calls: "\u8C03\u7528\u6B21\u6570",
      cost: "\u4F30\u7B97\u8D39\u7528",
      findings: "\u5F02\u5E38\u6570\u91CF",
      allTime: "\u5386\u53F2\u7D2F\u8BA1 Token"
    },
    help: {
      todayTokens: "\u4ECA\u65E5 0 \u70B9\u8D77\u7684 Token \u5408\u8BA1\uFF08\u56DB\u6876\u4E4B\u548C\uFF09\u3002",
      sessionTokens: "\u5F53\u524D\u6D3B\u8DC3\u4F1A\u8BDD\u7684 Token \u5408\u8BA1\uFF1B\u5BBF\u4E3B\u672A\u63D0\u4F9B\u4F1A\u8BDD ID \u65F6\u53D6\u6700\u8FD1\u6D3B\u8DC3\u4F1A\u8BDD\u3002",
      taskTokens: "\u6700\u8FD1\u4E00\u4E2A turn\uFF08\u81EA\u52A8\u4EFB\u52A1\uFF09\u7684 Token \u5408\u8BA1\u3002",
      cacheHitRate: "\u7F13\u5B58\u547D\u4E2D\u7387 = \u7F13\u5B58\u547D\u4E2D Token \xF7\uFF08\u7F13\u5B58\u547D\u4E2D + \u672A\u547D\u4E2D\u8F93\u5165\uFF09\u3002",
      missInput: "\u672A\u547D\u4E2D\u8F93\u5165\u7684 Token\uFF1A\u672C\u6B21\u8BF7\u6C42\u5B9E\u9645\u65B0\u589E\u53D1\u9001\u3001\u6CA1\u6709\u547D\u4E2D\u7F13\u5B58\u7684\u90E8\u5206\u3002",
      output: "\u6A21\u578B\u8F93\u51FA Token \u5408\u8BA1\uFF08\u63A8\u7406 Token \u5355\u72EC\u7EDF\u8BA1\uFF0C\u4E0D\u5E76\u5165\u6B64\u5904\uFF09\u3002",
      calls: "\u8BE5\u8303\u56F4\u5185\u7684\u6A21\u578B\u8C03\u7528\u6B21\u6570\uFF08\u6309 turn/step \u53BB\u91CD\u540E\u7684\u6700\u7EC8\u8BB0\u5F55\uFF09\u3002",
      cost: "\u6309\u300C\u8BBE\u7F6E \u2192 \u4EF7\u683C\u8868\u300D\u7684\u5355\u4EF7\u672C\u5730\u4F30\u7B97\uFF0C\u4E0D\u662F\u771F\u5B9E\u8D26\u5355\uFF1B\u672A\u914D\u7F6E\u4EF7\u683C\u65F6\u663E\u793A\u300C\u4EF7\u683C\u672A\u914D\u7F6E\u300D\uFF0C\u4E0D\u4F1A\u7528 0 \u4EE3\u66FF\u3002",
      findings: "\u8BE5\u8303\u56F4\u5185\u4EFB\u52A1\u4EA7\u751F\u7684\u5F02\u5E38/\u53D1\u73B0\u6570\u91CF\uFF08\u91CD\u590D\u8BFB\u53D6\u3001\u91CD\u590D\u6784\u5EFA\u3001\u6B65\u9AA4\u81A8\u80C0\u3001\u6210\u672C\u5F02\u5E38\u7B49\uFF09\u3002",
      trend: "\u6309\u5929\u6C47\u603B\uFF1B\u6298\u7EBF\u4E3A Token \u5408\u8BA1\uFF0C\u67F1\u72B6\u4E3A\u8C03\u7528\u6B21\u6570\uFF0C\u53EF\u5207\u6362 7 \u5929 / 30 \u5929\u3002",
      rankModels: "\u6309\u6A21\u578B\u6C47\u603B Token \u7684\u5360\u6BD4\uFF08Top 5\uFF09\u3002",
      rankProjects: "\u6309\u9879\u76EE\u6C47\u603B Token \u6392\u884C\u3002",
      rankTasks: "\u6309\u4EFB\u52A1\u6C47\u603B Token \u6392\u884C\uFF1B\u70B9\u51FB\u4EFB\u52A1\u53EF\u8DF3\u5230\u6210\u672C\u5206\u6790\u3002",
      allTime: "\u5168\u90E8\u5386\u53F2\u7684 Token \u5408\u8BA1\uFF0C\u542B\u4ECE\u6295\u5F71\u7F13\u5B58\u5BFC\u5165\u7684\u5386\u53F2\u4F1A\u8BDD\u3002"
    },
    trend: {
      title: "\u8D8B\u52BF",
      tokens: "Token \u8D8B\u52BF",
      calls: "\u6BCF\u65E5\u8C03\u7528"
    },
    rank: {
      models: "\u6A21\u578B\u5360\u6BD4",
      projects: "\u9879\u76EE\u6392\u884C",
      tasks: "\u4EFB\u52A1\u6392\u884C"
    },
    days: {
      "7": "7 \u5929",
      "30": "30 \u5929"
    },
    empty: "\u8FD8\u6CA1\u6709\u8C03\u7528\u8BB0\u5F55\uFF0C\u4EA7\u751F\u4E00\u6B21\u6A21\u578B\u8C03\u7528\u540E\u8FD9\u91CC\u81EA\u52A8\u51FA\u73B0\u6570\u636E",
    emptyRank: "\u6682\u65E0\u6392\u884C\u6570\u636E",
    importedSessions: "\u5DF2\u5BFC\u5165 {n} \u4E2A\u5386\u53F2\u4F1A\u8BDD",
    auto: {
      title: "AUTO \u81EA\u52A8\u63A8\u7406",
      help: "AUTO \u4E0E\u624B\u52A8\u6A21\u5F0F\u7684 Token / \u8D39\u7528 / \u6210\u529F\u7387\u5BF9\u6BD4\uFF0C\u4EE5\u53CA AUTO \u51B3\u7B56\u7684\u6863\u4F4D\u5206\u5E03\uFF1Bhost \u63A5\u53E3\u672A\u5C31\u7EEA\u65F6\u663E\u793A\u7A7A\u6001\u3002"
    }
  },
  calls: {
    filter: {
      range: "\u65F6\u95F4\u8303\u56F4",
      model: "\u6A21\u578B",
      task: "\u4EFB\u52A1",
      flaggedOnly: "\u53EA\u770B\u5F02\u5E38"
    },
    range: {
      "7": "\u8FD1 7 \u5929",
      "30": "\u8FD1 30 \u5929",
      all: "\u5168\u90E8",
      today: "\u4ECA\u65E5"
    },
    table: {
      time: "\u65F6\u95F4",
      model: "\u6A21\u578B",
      task: "\u4EFB\u52A1",
      missInput: "\u672A\u547D\u4E2D\u8F93\u5165",
      cacheRead: "\u7F13\u5B58\u547D\u4E2D",
      cacheWrite: "\u7F13\u5B58\u5199\u5165",
      output: "\u8F93\u51FA",
      total: "\u5408\u8BA1",
      cost: "\u8D39\u7528",
      duration: "\u8017\u65F6",
      flag: "\u6807\u8BB0"
    },
    flagged: "\u5F02\u5E38",
    normal: "\u6B63\u5E38",
    empty: "\u8FD8\u6CA1\u6709\u8C03\u7528\u8BB0\u5F55\uFF0C\u4EA7\u751F\u4E00\u6B21\u6A21\u578B\u8C03\u7528\u540E\u81EA\u52A8\u8BB0\u5F55"
  },
  tasks: {
    filter: {
      type: "\u4EFB\u52A1\u7C7B\u578B",
      status: "\u72B6\u6001"
    },
    table: {
      name: "\u4EFB\u52A1",
      project: "\u9879\u76EE",
      type: "\u7C7B\u578B",
      status: "\u72B6\u6001",
      calls: "\u8C03\u7528",
      missInput: "\u672A\u547D\u4E2D\u8F93\u5165",
      cacheRead: "\u7F13\u5B58\u547D\u4E2D",
      cacheWrite: "\u7F13\u5B58\u5199\u5165",
      output: "\u8F93\u51FA",
      total: "\u5408\u8BA1",
      cost: "\u8D39\u7528",
      findings: "\u5F02\u5E38",
      started: "\u5F00\u59CB\u65F6\u95F4",
      select: "\u9009\u62E9"
    },
    empty: "\u8FD8\u6CA1\u6709\u4EFB\u52A1\u8BB0\u5F55\uFF0C\u53D1\u8D77\u4E00\u6B21\u5BF9\u8BDD\u540E\u81EA\u52A8\u521B\u5EFA\u4EFB\u52A1",
    help: {
      subview: "\u4EFB\u52A1\u4E0E\u9879\u76EE\u662F\u540C\u4E00\u9875\u5185\u7684\u4E24\u4E2A\u5B50\u89C6\u56FE\uFF1A\u4EFB\u52A1\u6309 turn \u81EA\u52A8\u521B\u5EFA\uFF0C\u9879\u76EE\u6309\u5DE5\u4F5C\u76EE\u5F55\u805A\u5408\uFF1B\u5207\u6362\u5B50\u89C6\u56FE\u4E0D\u4F1A\u6539\u53D8\u9876\u90E8\u7684 7 \u4E2A\u6807\u7B7E\u3002",
      create: "\u624B\u52A8\u521B\u5EFA\u4EFB\u52A1\uFF1A\u540D\u79F0\u5FC5\u586B\uFF1B\u7C7B\u578B\u51B3\u5B9A\u57FA\u7EBF\u5BF9\u6BD4\u53E3\u5F84\uFF1B\u6240\u5C5E\u4F1A\u8BDD\u9ED8\u8BA4\u6700\u8FD1\u6D3B\u8DC3\u4F1A\u8BDD\u3002",
      merge: "\u5408\u5E76\u4F1A\u628A\u9009\u4E2D\u7684\u591A\u4E2A\u4EFB\u52A1\u5F52\u5E76\u4E3A\u4E00\u4E2A\uFF0C\u8C03\u7528\u4E0E\u8D39\u7528\u7EDF\u8BA1\u968F\u4E4B\u5408\u5E76\uFF1B\u53EA\u6709\u5728\u540C\u4E00\u4F1A\u8BDD\u4E2D\u7684\u4EFB\u52A1\u624D\u5141\u8BB8\u5408\u5E76\u3002"
    },
    subview: {
      tasks: "\u4EFB\u52A1",
      projects: "\u9879\u76EE"
    },
    newTask: "\u65B0\u5EFA\u4EFB\u52A1",
    newTaskTitle: "\u65B0\u5EFA\u4EFB\u52A1",
    newTaskName: "\u4EFB\u52A1\u540D\u79F0",
    newTaskType: "\u4EFB\u52A1\u7C7B\u578B",
    newTaskSession: "\u6240\u5C5E\u4F1A\u8BDD",
    newTaskCreate: "\u521B\u5EFA",
    created: "\u4EFB\u52A1\u5DF2\u521B\u5EFA",
    merge: "\u5408\u5E76",
    mergeTitle: "\u5408\u5E76\u4EFB\u52A1",
    mergeName: "\u5408\u5E76\u540E\u540D\u79F0",
    mergeConfirm: "\u786E\u8BA4\u5408\u5E76",
    mergeSelected: "\u5DF2\u9009\u4EFB\u52A1",
    mergeHint: "\u52FE\u9009\u540C\u4E00\u4F1A\u8BDD\u7684 2 \u4E2A\u53CA\u4EE5\u4E0A\u4EFB\u52A1\u624D\u80FD\u5408\u5E76",
    merged: "\u5DF2\u5408\u5E76",
    exportReport: "\u5BFC\u51FA\u62A5\u544A",
    selectOneForExport: "\u8BF7\u5148\u52FE\u9009\u4E00\u4E2A\u4EFB\u52A1\u518D\u5BFC\u51FA",
    nameEmpty: "\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A",
    openDetail: "\u67E5\u770B\u4EFB\u52A1\u8BE6\u60C5",
    subviewLabel: "\u5B50\u89C6\u56FE",
    helpList: "\u4EFB\u52A1\u6309 turn \u81EA\u52A8\u521B\u5EFA\uFF1B\u7C7B\u578B\u4E0E\u72B6\u6001\u53EF\u76F4\u63A5\u5728\u8868\u683C\u91CC\u4FEE\u6539\uFF0C\u70B9\u51FB\u4EFB\u610F\u884C\u6253\u5F00\u8BE6\u60C5\u62BD\u5C49\uFF0C\u52FE\u9009\u4EFB\u52A1\u540E\u53EF\u5408\u5E76\u6216\u5BFC\u51FA\u62A5\u544A\u3002"
  },
  status: {
    pending: "\u5F85\u5F00\u59CB",
    running: "\u8FDB\u884C\u4E2D",
    completed: "\u5DF2\u5B8C\u6210",
    paused: "\u5DF2\u6682\u505C",
    failed: "\u5931\u8D25"
  },
  type: {
    "simple-edit": "\u7B80\u5355\u4FEE\u6539",
    "normal-dev": "\u666E\u901A\u5F00\u53D1",
    "complex-dev": "\u590D\u6742\u5F00\u53D1",
    troubleshoot: "\u6545\u969C\u6392\u67E5",
    "project-analysis": "\u9879\u76EE\u5206\u6790"
  },
  finding: {
    repeated_read: "\u91CD\u590D\u8BFB\u53D6\u540C\u4E00\u6587\u4EF6",
    repeated_tool: "\u91CD\u590D\u6267\u884C\u76F8\u540C\u5DE5\u5177",
    repeated_build: "\u91CD\u590D\u6267\u884C\u6784\u5EFA",
    repeated_test: "\u91CD\u590D\u6267\u884C\u6D4B\u8BD5",
    repeated_deploy: "\u91CD\u590D\u6267\u884C\u90E8\u7F72",
    confirmation_rounds: "\u7591\u4F3C\u591A\u8F6E\u786E\u8BA4",
    repeated_plan: "\u7591\u4F3C\u91CD\u590D\u8BA1\u5212",
    repeated_summary: "\u7591\u4F3C\u91CD\u590D\u603B\u7ED3",
    step_inflation: "\u6A21\u578B\u6B65\u9AA4\u504F\u591A",
    cache_hit_drop: "\u7F13\u5B58\u547D\u4E2D\u7387\u4E0B\u964D",
    task_cost_anomaly: "\u4EFB\u52A1\u6210\u672C\u5F02\u5E38"
  },
  severity: {
    info: "\u63D0\u793A",
    warn: "\u8B66\u544A",
    high: "\u4E25\u91CD"
  },
  report: {
    taskLabel: "\u4EFB\u52A1",
    pickTask: "\u9009\u62E9\u4EFB\u52A1",
    empty: "\u5728\u4E0A\u65B9\u9009\u62E9\u4E00\u4E2A\u4EFB\u52A1\uFF0C\u67E5\u770B\u6210\u672C\u62A5\u544A",
    notFound: "\u8BE5\u4EFB\u52A1\u6CA1\u6709\u6210\u672C\u6570\u636E",
    metrics: {
      calls: "\u8C03\u7528\u6B21\u6570",
      tokens: "Token \u5408\u8BA1",
      cost: "\u4F30\u7B97\u8D39\u7528",
      duration: "\u8017\u65F6",
      steps: "\u6A21\u578B\u6B65\u9AA4",
      toolCalls: "\u5DE5\u5177\u8C03\u7528"
    },
    percentile: {
      calls: "\u8C03\u7528\u5206\u4F4D",
      tokens: "Token \u5206\u4F4D"
    },
    help: {
      percentile: "\u4E0E\u540C\u7C7B\u578B\u4EFB\u52A1\u57FA\u7EBF\u76F8\u6BD4\u7684\u5206\u4F4D\uFF080\u2013100\uFF0C\u8D8A\u9AD8\u8D8A\u63A5\u8FD1\u6700\u8D35\u7684\u4E00\u6863\uFF09\uFF1B\u6837\u672C\u4E0D\u8DB3\u65F6\u7559\u7A7A\u3002",
      baseline: "\u540C\u9879\u76EE + \u540C\u4EFB\u52A1\u7C7B\u578B\u7684\u5DF2\u5B8C\u6210\u4EFB\u52A1\u7684\u4E2D\u4F4D\u6570\u4E0E p80\uFF1B\u6837\u672C\u5C11\u4E8E 5 \u4E2A\u65F6\u4E0D\u7ED9\u7ED3\u8BBA\u3002",
      findings: "\u53EA\u8BFB\u5206\u6790\u7ED3\u679C\uFF1A\u91CD\u590D\u8BFB\u53D6\u3001\u91CD\u590D\u6784\u5EFA/\u6D4B\u8BD5\u3001\u6B65\u9AA4\u81A8\u80C0\u3001\u7F13\u5B58\u547D\u4E2D\u4E0B\u964D\u3001\u6210\u672C\u5F02\u5E38\u7B49\uFF1B\u6BCF\u4E00\u9879\u90FD\u53EF\u5728\u8BBE\u7F6E\u91CC\u5355\u72EC\u5173\u95ED\u3002",
      topCalls: "\u8BE5\u4EFB\u52A1\u4E2D\u6210\u672C\u6700\u9AD8\u7684\u6A21\u578B\u8C03\u7528\u4EE5\u53CA\u9AD8\u6210\u672C\u539F\u56E0\uFF08\u5927\u8F93\u5165 / \u4F4E\u7F13\u5B58\u547D\u4E2D / \u9AD8\u8F93\u51FA / \u91CD\u8BD5\uFF09\u3002",
      suggestions: "\u4EC5\u5EFA\u8BAE\uFF0C\u4E0D\u4F1A\u81EA\u52A8\u6267\u884C\uFF1BPhase 1 \u4E0D\u505A\u4EFB\u4F55\u5E72\u9884\u3002"
    },
    baseline: {
      metric: "\u6307\u6807",
      median: "\u4E2D\u4F4D\u6570",
      p80: "p80",
      samples: "\u6837\u672C\u6570"
    },
    baselineInsufficient: "\u6837\u672C\u4E0D\u8DB3\uFF0C\u6682\u4E0D\u7ED9\u51FA\u57FA\u7EBF\u7ED3\u8BBA",
    baselineInsufficientShort: "\u6837\u672C\u4E0D\u8DB3",
    interference: "\u5E76\u53D1\u5E72\u6270",
    findings: "\u5F02\u5E38\u53D1\u73B0",
    noFindings: "\u6682\u65E0\u5F02\u5E38",
    topCalls: {
      turn: "\u8F6E/\u6B65",
      reason: "\u539F\u56E0"
    },
    noCalls: "\u6682\u65E0\u8C03\u7528",
    suggestions: "\u5EFA\u8BAE",
    noSuggestions: "\u6682\u65E0\u5EFA\u8BAE",
    baselineTitle: "\u57FA\u7EBF\u5BF9\u6BD4",
    topCallsTitle: "Top \u6210\u672C\u8C03\u7528",
    auto: {
      title: "AUTO vs \u624B\u52A8\u5BF9\u6BD4",
      help: "\u6309\u8C03\u7528\u8BB0\u5F55\u5F52\u5C5E\u7EDF\u8BA1 AUTO \u4E0E\u624B\u52A8\u6A21\u5F0F\u7684\u8F93\u5165 / \u8F93\u51FA / \u63A8\u7406 / \u7F13\u5B58\u547D\u4E2D Token\u3001\u8D39\u7528\u3001\u4EFB\u52A1\u6210\u529F\u7387\u4E0E\u5E73\u5747\u6BCF\u4EFB\u52A1\u6D88\u8017\uFF1B\u8D39\u7528\u4F9D\u8D56\u8BBE\u7F6E\u9875\u4EF7\u683C\u8868\uFF0C\u672A\u914D\u7F6E\u4EF7\u683C\u65F6\u663E\u793A\u300C\u4EF7\u683C\u672A\u914D\u7F6E\u300D\u3002",
      historyTitle: "\u6700\u8FD1 AUTO \u51B3\u7B56",
      historyHelp: "\u6700\u8FD1 20 \u6761 AUTO \u51B3\u7B56\uFF1A\u4F1A\u8BDD\u3001\u8F6E/\u6B65\u3001\u52A8\u4F5C\u3001\u6863\u4F4D\u53D8\u5316\u3001\u9636\u6BB5\u3001\u539F\u56E0\u4E0E\u662F\u5426\u771F\u6B63\u751F\u6548\uFF1B\u89C2\u5BDF\u6A21\u5F0F\u4E0B applied \u663E\u793A\u300C\u4EC5\u8BB0\u5F55\u300D\u3002",
      globalHint: "\u672A\u9009\u62E9\u4EFB\u52A1\uFF1A\u4EE5\u4E0B\u4E3A AUTO \u5168\u5C40\u5BF9\u6BD4"
    }
  },
  settings: {
    savedState: "\u4FDD\u5B58\u72B6\u6001",
    notChanged: "\u672A\u4FEE\u6539",
    export: "\u5BFC\u51FA CSV",
    reset: "\u6062\u590D\u9ED8\u8BA4",
    resetConfirm: "\u786E\u8BA4\u628A\u5168\u90E8\u8BBE\u7F6E\u6062\u590D\u4E3A\u9ED8\u8BA4\u503C\uFF1F",
    section: {
      capture: "\u91C7\u96C6",
      analytics: "\u5206\u6790\u9879",
      thresholds: "\u9608\u503C",
      prices: "\u4EF7\u683C\u8868",
      data: "\u6570\u636E",
      compression: "\u5DE5\u5177\u8F93\u51FA\u7F13\u5B58",
      context: "\u4E0A\u4E0B\u6587\u5206\u6790",
      auto: "AUTO \u81EA\u52A8\u63A8\u7406"
    },
    help: {
      capture: "\u91C7\u96C6\u5F00\u5173\u51B3\u5B9A\u662F\u5426\u8BB0\u5F55\u7528\u91CF\uFF1B\u89C2\u5BDF\u6A21\u5F0F\u786E\u4FDD\u53EA\u5206\u6790\u3001\u4E0D\u5E72\u9884\u8C03\u7528\uFF1B\u8BC1\u636E\u6587\u672C\u4E0A\u9650\u9650\u5236 findings \u4E2D\u4FDD\u5B58\u7684\u6587\u672C\u957F\u5EA6\u3002",
      analytics: "\u5404\u5206\u6790\u9879\u53EF\u5355\u72EC\u5173\u95ED\uFF1B\u5173\u95ED\u540E\u4E0D\u518D\u4EA7\u751F\u5BF9\u5E94\u7C7B\u578B\u7684 findings\u3002",
      thresholds: "\u89E6\u53D1\u5224\u5B9A\u4F7F\u7528\u7684\u6570\u91CF/\u500D\u6570\u9608\u503C\uFF1B\u4FEE\u6539\u540E\u7ACB\u5373\u751F\u6548\u3002",
      prices: "\u6309 provider + \u6A21\u578B\u914D\u7F6E\u56DB\u6876\u5355\u4EF7\uFF1B\u5355\u4F4D tokens \u662F\u8BA1\u4EF7\u5355\u4F4D\uFF08\u9ED8\u8BA4 1,000,000\uFF09\u3002\u53EA\u505A\u672C\u5730\u4F30\u7B97\u8D39\u7528\uFF0C\u4E0D\u4EA7\u751F\u771F\u5B9E\u8D26\u5355\u3002",
      data: "\u5386\u53F2\u6295\u5F71\u7F13\u5B58\u5BFC\u5165\u53EA\u8BFB\uFF0C\u4E0D\u4F1A\u4FEE\u6539\u4EFB\u4F55\u4F1A\u8BDD\uFF1B\u5BFC\u51FA CSV \u542B UTF-8 BOM \u4E0E\u516C\u5F0F\u6CE8\u5165\u8F6C\u4E49\u3002",
      compression: "\u628A\u8D85\u957F\u5DE5\u5177\u7ED3\u679C\u538B\u7F29\u5E76\u66FF\u6362\u4E3A\u6458\u8981\uFF0C\u8282\u7701\u4E0A\u4E0B\u6587 Token\uFF1A\u66FF\u6362\u4F1A\u5199\u5165\u4F1A\u8BDD\u65E5\u5FD7\uFF08\u4F1A\u8BDD\u5386\u53F2\u91CC\u80FD\u770B\u5230\uFF09\uFF0C\u539F\u6587\u5B8C\u6574\u4FDD\u5B58\u5728\u672C\u5730 blob\uFF0C\u53EF\u968F\u65F6\u6062\u590D\u67E5\u770B\uFF1B\u89C2\u5BDF\u6A21\u5F0F\u53EA\u8BB0\u5F55\u4E0E\u5B58\u50A8\u3001\u4E0D\u66FF\u6362\u6A21\u578B\u53EF\u89C1\u5185\u5BB9\u3002Phase 2 \u9ED8\u8BA4\u89C2\u5BDF\u6A21\u5F0F\u3002",
      context: "\u53EA\u68C0\u6D4B\u3001\u4E0D\u6539\u5199\uFF1A\u5206\u6790\u5F53\u524D\u4E0A\u4E0B\u6587\u7684\u91CD\u590D\u5185\u5BB9\uFF0C\u4F30\u7B97\u79FB\u9664\u540E\u7684\u8282\u7701\u4E0E KV Cache \u98CE\u9669\uFF0C\u9ED8\u8BA4 dry-run\u3002\u9608\u503C\u4E0E\u98CE\u9669\u500D\u6570\u51B3\u5B9A\u5019\u9009\u4E0E\u98CE\u9669\u5224\u5B9A\uFF1B\u672A\u914D\u7F6E\u4EF7\u683C\u65F6\u7528\u300C\u7F13\u5B58\u8BFB\u53D6\u4EF7\u683C\u6BD4\u4F8B\u300D\u4F30\u7B97\u98CE\u9669\u6210\u672C\u3002",
      auto: "AUTO \u53EA\u4F9D\u636E\u672C\u5730\u4E8B\u4EF6\u5224\u65AD\u4EFB\u52A1\u96BE\u5EA6\uFF0C\u4E0D\u989D\u5916\u8C03\u7528\u6A21\u578B\uFF1B\u624B\u52A8\u9009\u62E9\u6863\u4F4D\u540E\u4F1A\u9000\u51FA AUTO\u3002\u521D\u59CB\u6863\u4F4D\u53EA\u80FD\u662F OFF/LOW\uFF0C\u5347\u7EA7\u4E00\u6B21\u4E00\u6863\uFF1B\u73AF\u5883\u7C7B\u5931\u8D25\uFF08\u8DEF\u5F84\u3001\u6743\u9650\u3001\u4F9D\u8D56\u3001\u7F51\u7EDC\uFF09\u4E0D\u4F1A\u5347\u7EA7\u3002\u89C2\u5BDF\u6A21\u5F0F\u53EA\u8BB0\u5F55\u51B3\u7B56\uFF0C\u4E0D\u771F\u6B63\u5207\u6362\u6863\u4F4D\u3002"
    },
    enabled: "\u91C7\u96C6\u5F00\u5173",
    observeOnly: "\u89C2\u5BDF\u6A21\u5F0F",
    alertOnly: "\u4EC5\u63D0\u793A\u4E0D\u5E72\u9884",
    evidenceTextLimit: "\u8BC1\u636E\u6587\u672C\u4E0A\u9650",
    analytics: {
      repeatedRead: "\u91CD\u590D\u8BFB\u53D6\u540C\u4E00\u6587\u4EF6",
      repeatedTool: "\u91CD\u590D\u6267\u884C\u76F8\u540C\u5DE5\u5177",
      repeatedBuild: "\u91CD\u590D\u6267\u884C\u6784\u5EFA",
      repeatedTest: "\u91CD\u590D\u6267\u884C\u6D4B\u8BD5",
      repeatedDeploy: "\u91CD\u590D\u6267\u884C\u90E8\u7F72",
      confirmationRounds: "\u591A\u8F6E\u786E\u8BA4\u68C0\u6D4B",
      repeatedPlan: "\u91CD\u590D\u8BA1\u5212\u68C0\u6D4B",
      repeatedSummary: "\u91CD\u590D\u603B\u7ED3\u68C0\u6D4B",
      stepInflation: "\u6B65\u9AA4\u81A8\u80C0\u68C0\u6D4B",
      cacheHitDrop: "\u7F13\u5B58\u547D\u4E2D\u4E0B\u964D\u68C0\u6D4B",
      taskCostAnomaly: "\u4EFB\u52A1\u6210\u672C\u5F02\u5E38\u68C0\u6D4B"
    },
    thresholds: {
      repeatedReadCount: "\u91CD\u590D\u8BFB\u53D6\u6B21\u6570",
      repeatedToolCount: "\u91CD\u590D\u5DE5\u5177\u6B21\u6570",
      repeatedCommandCount: "\u91CD\u590D\u547D\u4EE4\u6B21\u6570",
      confirmationMaxChars: "\u786E\u8BA4\u6D88\u606F\u5B57\u6570\u4E0A\u9650",
      confirmationRounds: "\u786E\u8BA4\u8F6E\u6570",
      repeatedTextCount: "\u91CD\u590D\u6587\u672C\u6B21\u6570",
      inflationFactor: "\u6B65\u9AA4\u81A8\u80C0\u500D\u6570",
      simpleEditCallCap: "\u7B80\u5355\u4FEE\u6539\u8C03\u7528\u4E0A\u9650",
      normalDevCallCap: "\u666E\u901A\u5F00\u53D1\u8C03\u7528\u4E0A\u9650",
      cacheDropFactor: "\u7F13\u5B58\u547D\u4E2D\u4E0B\u964D\u500D\u6570",
      costAnomalyFactor: "\u6210\u672C\u5F02\u5E38\u500D\u6570",
      minBaselineSamples: "\u57FA\u7EBF\u6700\u5C11\u6837\u672C"
    },
    auto: {
      on: "\u5DF2\u542F\u7528",
      off: "\u672A\u542F\u7528",
      monitorBadge: "\u4EC5\u89C2\u5BDF",
      enabled: "\u542F\u7528 AUTO \u81EA\u52A8\u63A8\u7406",
      includeSubagents: "\u5B50 Agent \u4E5F\u7EB3\u5165 AUTO",
      monitorOnly: "\u89C2\u5BDF\u6A21\u5F0F\uFF08\u53EA\u8BB0\u5F55\u4E0D\u751F\u6548\uFF09",
      resetOnNewTurn: "\u65B0\u4EFB\u52A1\u91CD\u65B0\u5224\u65AD",
      initial: "\u521D\u59CB\u6863\u4F4D",
      initialHelp: "\u6309\u4EFB\u52A1\u7C7B\u578B\u8BBE\u5B9A AUTO \u7684\u8D77\u59CB\u6863\u4F4D\uFF1A\u53EA\u5141\u8BB8 OFF/LOW\uFF0C\u4EFB\u52A1\u5F00\u59CB\u4E0D\u5F97\u76F4\u63A5 HIGH/MAX\uFF1B\u521D\u59CB\u4E0A\u9650\u5BF9\u6240\u6709\u7C7B\u578B\u751F\u6548\u3002",
      maxInitial: "\u521D\u59CB\u6863\u4F4D\u4E0A\u9650",
      reasoningFailuresToEscalate: "\u63A8\u7406\u5931\u8D25\u5347\u7EA7\u6B21\u6570",
      filesForComplex: "\u590D\u6742\u4EFB\u52A1\u6587\u4EF6\u6570",
      maxStepsWithoutProgress: "\u6700\u5927\u65E0\u8FDB\u5C55\u6B65\u6570",
      maxEscalationsPerTask: "\u5355\u4EFB\u52A1\u6700\u5927\u5347\u7EA7"
    },
    price: {
      provider: "Provider",
      model: "\u6A21\u578B",
      input: "\u672A\u547D\u4E2D\u8F93\u5165\u4EF7",
      cacheRead: "\u7F13\u5B58\u547D\u4E2D\u4EF7",
      cacheWrite: "\u7F13\u5B58\u5199\u5165\u4EF7",
      output: "\u8F93\u51FA\u4EF7",
      currency: "\u5E01\u79CD",
      unitTokens: "\u5355\u4F4D tokens",
      effectiveAt: "\u751F\u6548\u65F6\u95F4",
      actions: "\u64CD\u4F5C",
      add: "\u65B0\u589E\u4EF7\u683C",
      invalid: "\u8BF7\u81F3\u5C11\u586B\u5199 Provider \u4E0E\u6A21\u578B"
    },
    pricesEmpty: "\u4EF7\u683C\u8868\u4E3A\u7A7A\uFF0C\u6DFB\u52A0\u540E\u8D39\u7528\u624D\u80FD\u4F30\u7B97",
    import: {
      button: "\u5BFC\u5165\u5386\u53F2\u6295\u5F71\u7F13\u5B58",
      idle: "\u672A\u5BFC\u5165",
      result: "\u5BFC\u5165\u5B8C\u6210"
    },
    compression: {
      mode: "\u6A21\u5F0F",
      blobs: "Blob \u6570",
      usage: "\u5360\u7528",
      missing: "\u7F3A\u5931",
      statsIdle: "\u5B58\u50A8\u72B6\u6001\u52A0\u8F7D\u4E2D\u2026",
      minBytes: "\u6700\u5C0F\u5904\u7406\u5B57\u8282",
      selectiveBytes: "\u9009\u62E9\u6027\u6458\u8981\u4E0B\u9650",
      smartBytes: "\u667A\u80FD\u538B\u7F29\u4E0B\u9650",
      maxCacheMB: "\u7F13\u5B58\u4E0A\u9650 (MB)",
      ttlDays: "\u4FDD\u7559\u5929\u6570",
      type: {
        text: "\u7EAF\u6587\u672C",
        "build-log": "\u6784\u5EFA\u65E5\u5FD7",
        "test-output": "\u6D4B\u8BD5\u8F93\u51FA",
        json: "JSON",
        xml: "XML",
        "file-list": "\u6587\u4EF6\u5217\u8868",
        "zip-list": "ZIP \u5176\u4ED6\u6587\u672C"
      },
      verify: "\u4E00\u81F4\u6027\u68C0\u67E5",
      clear: "\u6E05\u7A7A\u7F13\u5B58",
      verifyMissing: "\u7F3A\u6587\u4EF6",
      verifyOrphan: "\u5B64\u513F\u6587\u4EF6",
      verifyMismatch: "\u54C8\u5E0C\u4E0D\u7B26",
      clearConfirm: "\u786E\u8BA4\u6E05\u7A7A\u5168\u90E8\u5DE5\u5177\u8F93\u51FA\u7F13\u5B58\uFF1F\u4E0D\u53EF\u64A4\u9500\u3002",
      cleared: "\u5DF2\u6E05\u7A7A",
      storageIdle: "\u672A\u68C0\u67E5"
    },
    context: {
      mode: "\u6A21\u5F0F",
      modeNote: "\u4EC5\u68C0\u6D4B\uFF0C\u4E0D\u505A\u4EFB\u4F55\u6539\u5199",
      minOccurrences: "\u6700\u5C11\u51FA\u73B0\u6B21\u6570",
      minSurfaceNodes: "\u6700\u5C11\u8282\u70B9\u6570",
      maxCandidates: "\u6700\u5927\u5019\u9009\u6570",
      riskFactor: "\u98CE\u9669\u500D\u6570",
      assumedCacheReadRatio: "\u7F13\u5B58\u8BFB\u53D6\u4EF7\u683C\u6BD4\u4F8B"
    }
  },
  cache: {
    cards: {
      entries: "\u7F13\u5B58\u6761\u76EE",
      original: "\u539F\u59CB\u603B\u5927\u5C0F",
      compressed: "\u538B\u7F29\u540E\u603B\u5927\u5C0F",
      saved: "\u4F30\u7B97\u8282\u7701"
    },
    help: {
      entries: "\u7F13\u5B58\u6761\u76EE\u6570 = \u5DF2\u8BB0\u5F55\u7684\u539F\u59CB\u5DE5\u5177\u8F93\u51FA\u6761\u6570\uFF08\u91CD\u590D\u8C03\u7528\u7B97\u591A\u6761\uFF0C\u53BB\u91CD\u547D\u4E2D\u5355\u72EC\u7EDF\u8BA1\uFF09\u3002",
      original: "\u539F\u59CB\u603B\u5927\u5C0F = \u6240\u6709\u7F13\u5B58\u6761\u76EE\u7684\u539F\u59CB\u5B57\u8282\u5408\u8BA1\u3002",
      compressed: "\u538B\u7F29\u540E\u603B\u5927\u5C0F = \u5B9E\u9645\u5199\u5165\u78C1\u76D8\u7684\u538B\u7F29\u540E\u5B57\u8282\u5408\u8BA1\u3002",
      saved: "\u4F30\u7B97\u8282\u7701 = \u539F\u59CB\u603B\u5927\u5C0F \u2212 \u538B\u7F29\u540E\u603B\u5927\u5C0F\uFF08\u5B57\u8282\u6570\u4E0E\u767E\u5206\u6BD4\uFF09\uFF1B\u8FD9\u662F\u76D8\u4E0A\u5360\u7528\u91CF\u7684\u4F30\u7B97\uFF0C\u4E0D\u7B49\u4E8E\u8D26\u5355\u8282\u7701\u3002",
      table: "\u8868\u683C\u6309\u65F6\u95F4\u5012\u5E8F\u5217\u51FA\u7F13\u5B58\u6761\u76EE\uFF0C\u70B9\u51FB\u4EFB\u610F\u884C\u67E5\u770B\u539F\u6587\u3002\u4E0D\u53EF\u6062\u590D\u8868\u793A\u539F\u6587\u6587\u4EF6\u5DF2\u88AB\u6E05\u7406\u6216\u7F3A\u5931\u3002",
      viewer: "\u62BD\u5C49\u6309 8 KB \u5206\u6BB5\u8BFB\u53D6\u672C\u5730\u539F\u6587 blob\uFF0C\u53EF\u4E0A\u4E00\u6BB5/\u4E0B\u4E00\u6BB5\u7FFB\u9875\uFF1B\u53EA\u8BFB\uFF0C\u4E0D\u4F1A\u4FEE\u6539\u4F1A\u8BDD\u6216\u7F13\u5B58\u5185\u5BB9\u3002"
    },
    dedupe: "\u53BB\u91CD\u547D\u4E2D",
    missingWarn: "\u539F\u6587\u7F3A\u5931",
    filter: {
      tool: "\u5DE5\u5177\u540D",
      toolPlaceholder: "\u8F93\u5165\u5DE5\u5177\u540D\u7B5B\u9009",
      recoverable: "\u53EF\u6062\u590D",
      all: "\u5168\u90E8",
      recoverableOnly: "\u53EF\u6062\u590D",
      notRecoverable: "\u4E0D\u53EF\u6062\u590D"
    },
    table: {
      tool: "\u5DE5\u5177\u540D",
      original: "\u539F\u59CB\u5927\u5C0F",
      compressed: "\u538B\u7F29\u540E\u5927\u5C0F",
      compression: "\u538B\u7F29\u7C7B\u578B",
      mode: "\u6A21\u5F0F",
      session: "\u4F1A\u8BDD",
      time: "\u65F6\u95F4",
      recoverable: "\u53EF\u6062\u590D"
    },
    mode: {
      off: "\u5173\u95ED",
      observe: "\u89C2\u5BDF\u6A21\u5F0F",
      on: "\u542F\u7528\u81EA\u52A8\u538B\u7F29"
    },
    recoverable: {
      yes: "\u53EF\u6062\u590D",
      no: "\u4E0D\u53EF\u6062\u590D"
    },
    empty: "\u8FD8\u6CA1\u6709\u5DE5\u5177\u8F93\u51FA\u7F13\u5B58\u8BB0\u5F55\uFF0C\u51FA\u73B0\u4E00\u6B21\u5927\u5DE5\u5177\u8F93\u51FA\u540E\u81EA\u52A8\u8BB0\u5F55",
    openViewer: "\u67E5\u770B\u539F\u6587",
    viewer: {
      title: "\u5DE5\u5177\u8F93\u51FA\u539F\u6587",
      blobId: "Blob ID",
      hash: "\u54C8\u5E0C",
      size: "\u5927\u5C0F",
      type: "\u7C7B\u578B",
      tool: "\u5DE5\u5177\u540D",
      session: "\u4F1A\u8BDD",
      time: "\u65F6\u95F4",
      summary: "\u6458\u8981",
      summaryEmpty: "\uFF08\u5185\u5BB9\u52A0\u8F7D\u540E\u663E\u793A\u6458\u8981\uFF09",
      notRecoverable: "\u539F\u6587\u6587\u4EF6\u7F3A\u5931\u6216\u5DF2\u6E05\u7406\uFF0C\u65E0\u6CD5\u67E5\u770B\u3002",
      emptyContent: "\u8FD9\u4E00\u6BB5\u6CA1\u6709\u53EF\u663E\u793A\u7684\u5185\u5BB9\u3002",
      range: "\u5F53\u524D\u8303\u56F4",
      total: "\u603B\u5B57\u8282",
      prev: "\u4E0A\u4E00\u6BB5",
      next: "\u4E0B\u4E00\u6BB5",
      close: "\u5173\u95ED"
    }
  },
  context: {
    sessionLabel: "\u4F1A\u8BDD",
    sessionDefault: "\u6700\u8FD1\u6D3B\u8DC3\u4F1A\u8BDD",
    refreshAnalysis: "\u5237\u65B0\u5206\u6790",
    mode: {
      off: "\u5173\u95ED",
      "dry-run": "\u4EC5\u68C0\u6D4B\uFF08dry-run\uFF09"
    },
    readOnly: "\u53EA\u8BFB",
    protected: "\u53D7\u4FDD\u62A4",
    cards: {
      nodes: "\u8868\u9762\u8282\u70B9",
      tokens: "\u4F30\u7B97 tokens",
      candidates: "\u91CD\u590D\u5019\u9009",
      savings: "\u53EF\u8282\u7701 tokens",
      riskyHint: "\u5176\u4E2D\u98CE\u9669\u5019\u9009"
    },
    help: {
      page: "\u53EA\u68C0\u6D4B\u3001\u4E0D\u6539\u5199\uFF1A\u672C\u9875\u5206\u6790\u5F53\u524D\u4E0A\u4E0B\u6587\u7684\u91CD\u590D\u5185\u5BB9\u4E0E KV Cache \u98CE\u9669\uFF0C\u9ED8\u8BA4 dry-run\u3002\u6539\u5199\u4E0A\u4E0B\u6587\u4F1A\u6253\u65AD\u524D\u7F00\u7F13\u5B58\uFF08\u7F13\u5B58\u547D\u4E2D\u6BB5\u5931\u6548\uFF09\uFF0C\u5F80\u5F80\u6BD4\u7701\u4E0B\u7684 tokens \u66F4\u8D35\uFF0C\u6240\u4EE5 Phase 3 \u4E0D\u63D0\u4F9B\u81EA\u52A8\u6539\u5199\uFF1B\u300C\u8BB0\u5F55\u672C\u6B21 dry-run \u5EFA\u8BAE\u300D\u53EA\u628A\u5019\u9009\u5199\u5165\u672C\u5730\u8BB0\u5F55\uFF0C\u7EDD\u4E0D\u4FEE\u6539\u4F1A\u8BDD\u3002",
      nodes: "surface \u8282\u70B9\u6570 = \u672C\u6B21\u8BF7\u6C42\u4E0A\u4E0B\u6587\u91CC\u7684\u6D88\u606F/\u7247\u6BB5\u6570\u91CF\uFF08\u542B system / developer / user / assistant / tool\uFF09\u3002",
      tokens: "\u6309\u5B57\u7B26\u6570\u4F30\u7B97\u7684 context tokens\uFF0C\u4E0D\u662F\u5B98\u65B9\u8BA1\u8D39\u53E3\u5F84\u3002",
      candidates: "\u91CD\u590D\u51FA\u73B0\u7684\u53EF\u79FB\u9664\u5185\u5BB9\u6761\u6570\uFF1B\u540C\u4E00 contentHash \u8FBE\u5230\u300C\u6700\u5C11\u51FA\u73B0\u6B21\u6570\u300D\u9608\u503C\u624D\u8BA1\u5165\u3002",
      savings: "\u5019\u9009\u5168\u90E8\u79FB\u9664\u53EF\u8282\u7701\u7684 tokens \u4F30\u7B97\uFF0C\u672A\u6263\u9664 KV Cache \u5931\u6548\u5E26\u6765\u7684\u989D\u5916\u6210\u672C\u3002",
      composition: "\u6309 role \u4E0E source \u7EDF\u8BA1\u4E0A\u4E0B\u6587\u5360\u6BD4\uFF1B\u53D7\u4FDD\u62A4 source\uFF08system / user / dsh-mnemon \u7B49\uFF09\u6C38\u8FDC\u4E0D\u4F1A\u6210\u4E3A\u79FB\u9664\u5019\u9009\u3002",
      candidateTable: "\u70B9\u51FB\u4EFB\u610F\u5019\u9009\u884C\u5C55\u5F00\u6BCF\u6B21\u51FA\u73B0\u7684\u4F4D\u7F6E\uFF08turn / step / seq / tokens\uFF09\uFF1B\u7F13\u5B58\u98CE\u9669\u5FBD\u6807\u7ED9\u51FA safe / risky / unknown \u4E0E\u539F\u56E0\u3002",
      history: "dry-run \u8BB0\u5F55\u4E0B\u6765\u7684\u4F18\u5316\u5EFA\u8BAE\u5386\u53F2\uFF0C\u4EC5\u672C\u5730\u8BB0\u5F55\uFF0C\u4E0D\u6267\u884C\u4EFB\u4F55\u6539\u5199\u3002"
    },
    section: {
      composition: "\u4E0A\u4E0B\u6587\u7EC4\u6210",
      candidates: "\u91CD\u590D\u5019\u9009",
      history: "\u4F18\u5316\u5EFA\u8BAE\u5386\u53F2"
    },
    roleBar: "\u6309 role \u5360\u6BD4",
    sources: "\u6309 source \u660E\u7EC6",
    role: {
      system: "\u7CFB\u7EDF",
      developer: "\u5F00\u53D1\u8005",
      user: "\u7528\u6237",
      assistant: "\u52A9\u624B",
      tool: "\u5DE5\u5177"
    },
    kind: {
      "tool-result": "\u5DE5\u5177\u8F93\u51FA",
      "file-content": "\u6587\u4EF6\u5185\u5BB9"
    },
    table: {
      kind: "\u7C7B\u578B",
      subject: "\u5BF9\u8C61",
      occurrences: "\u51FA\u73B0\u6B21\u6570",
      removable: "\u53EF\u79FB\u9664 tokens",
      risk: "\u7F13\u5B58\u98CE\u9669",
      advice: "\u5EFA\u8BAE"
    },
    risk: {
      safe: "\u5B89\u5168",
      risky: "\u6709\u98CE\u9669",
      unknown: "\u672A\u77E5"
    },
    advice: {
      recommend: "\u63A8\u8350",
      avoid: "\u4E0D\u5EFA\u8BAE"
    },
    occ: {
      title: "\u51FA\u73B0\u4F4D\u7F6E",
      riskLine: "\u98CE\u9669\u539F\u56E0",
      seq: "seq",
      turn: "\u8F6E",
      step: "\u6B65",
      role: "\u89D2\u8272",
      source: "\u6765\u6E90",
      tokens: "tokens",
      bytes: "\u5B57\u8282",
      costLine: "\u8282\u7701 / \u989D\u5916\u8D39\u7528"
    },
    totalRows: "\u5171",
    recordDryRun: "\u8BB0\u5F55\u672C\u6B21 dry-run \u5EFA\u8BAE",
    recordedNote: "\u5DF2\u8BB0\u5F55 {n} \u6761\u5EFA\u8BAE",
    emptySession: "\u5F53\u524D\u4F1A\u8BDD\u8FD8\u6CA1\u6709\u53EF\u5206\u6790\u7684\u4E0A\u4E0B\u6587\uFF0C\u4EA7\u751F\u4E00\u6B21\u5BF9\u8BDD\u540E\u518D\u5237\u65B0",
    emptyCandidates: "\u6CA1\u6709\u53D1\u73B0\u53EF\u79FB\u9664\u7684\u91CD\u590D\u5185\u5BB9",
    emptyHistory: "\u8FD8\u6CA1\u6709 dry-run \u8BB0\u5F55\uFF0C\u70B9\u4E0A\u65B9\u6309\u94AE\u8BB0\u5F55\u4E00\u6B21",
    emptyComposition: "\u6682\u65E0\u7EC4\u6210\u6570\u636E",
    verified: "\u5DF2\u9A8C\u8BC1",
    history: {
      time: "\u65F6\u95F4",
      type: "\u7C7B\u578B",
      original: "\u539F tokens",
      optimized: "\u4F18\u5316\u540E",
      savings: "\u9884\u8BA1\u8282\u7701",
      cacheImpact: "\u7F13\u5B58\u5F71\u54CD",
      status: "\u72B6\u6001"
    }
  },
  taskdetail: {
    title: "\u4EFB\u52A1\u8BE6\u60C5",
    help: "\u4EFB\u52A1\u8BE6\u60C5\u6C47\u603B\u8BE5\u4EFB\u52A1\u7684\u6307\u6807\u30019 \u6BB5\u6458\u8981\u3001\u6587\u4EF6/\u547D\u4EE4\u805A\u5408\u3001\u5F02\u5E38\u4E0E\u8C03\u7528\u660E\u7EC6\uFF1B\u6458\u8981\u4E2D\u7684\u300C\u81EA\u52A8\u751F\u6210\uFF08\u672C\u5730\uFF09\u300D\u8868\u793A\u5185\u5BB9\u6765\u81EA\u672C\u5730\u81EA\u52A8\u8349\u7A3F\uFF0C\u7F16\u8F91\u5E76\u4FDD\u5B58\u540E\u53D8\u4E3A\u624B\u52A8\u7248\u672C\u3002\u5BFC\u51FA\u53EA\u8BFB\u53D6\u672C\u5730\u6570\u636E\u3002",
    openReport: "\u6210\u672C\u5206\u6790",
    close: "\u5173\u95ED",
    notFound: "\u4EFB\u52A1\u4E0D\u5B58\u5728\u6216\u6CA1\u6709\u8BE6\u60C5\u6570\u636E",
    name: "\u4EFB\u52A1\u540D\u79F0",
    metrics: {
      calls: "\u8C03\u7528\u6B21\u6570",
      total: "Token \u5408\u8BA1",
      cost: "\u4F30\u7B97\u8D39\u7528",
      duration: "\u8017\u65F6"
    },
    buckets: {
      missInput: "\u672A\u547D\u4E2D\u8F93\u5165",
      cacheRead: "\u7F13\u5B58\u547D\u4E2D",
      cacheWrite: "\u7F13\u5B58\u5199\u5165",
      output: "\u8F93\u51FA"
    },
    summary: "\u4EFB\u52A1\u6458\u8981",
    summaryHelp: "9 \u4E2A\u6458\u8981\u5B57\u6BB5\u7528\u4E8E\u8BB0\u5F55\u4EFB\u52A1\u7684\u76EE\u6807\u3001\u4EA7\u51FA\u4E0E\u4E0B\u4E00\u6B65\uFF0C\u4FDD\u5B58\u5728\u672C\u5730\u6570\u636E\u5E93\uFF0C\u53EF\u5BFC\u51FA JSON/Markdown/CSV\uFF1B\u4E0D\u4F1A\u5199\u5165\u4F1A\u8BDD\u65E5\u5FD7\u6216 mnemon\u3002",
    autoDraft: "\u81EA\u52A8\u751F\u6210\uFF08\u672C\u5730\uFF09",
    edited: "\u624B\u52A8\u7F16\u8F91",
    unsaved: "\u672A\u4FDD\u5B58",
    savedState: "\u5DF2\u4FDD\u5B58",
    saved: "\u6458\u8981\u5DF2\u4FDD\u5B58",
    saveSummary: "\u4FDD\u5B58\u6458\u8981",
    writes: {
      tool: "\u5DE5\u5177",
      target: "\u76EE\u6807",
      command: "\u547D\u4EE4",
      count: "\u6B21\u6570"
    },
    helpWrites: "\u6309\u5DE5\u5177\u4E0E\u76EE\u6807\u805A\u5408\u8BE5\u4EFB\u52A1\u5199\u5165\u8FC7\u7684\u6587\u4EF6\u4E0E\u6267\u884C\u8FC7\u7684\u547D\u4EE4\uFF0C\u7528\u4E8E\u590D\u6838\u5B9E\u9645\u6539\u52A8\u8303\u56F4\u3002",
    toolCalls: "\u5DE5\u5177\u8C03\u7528",
    emptyWrites: "\u6682\u65E0\u6587\u4EF6\u6216\u547D\u4EE4\u4FEE\u6539",
    findings: "\u5F02\u5E38\u53D1\u73B0",
    helpFindings: "\u8BE5\u4EFB\u52A1\u7684\u53EA\u8BFB\u5206\u6790\u7ED3\u679C\uFF08\u91CD\u590D\u8BFB\u53D6\u3001\u91CD\u590D\u6784\u5EFA\u3001\u6B65\u9AA4\u81A8\u80C0\u3001\u6210\u672C\u5F02\u5E38\u7B49\uFF09\u3002",
    emptyFindings: "\u6682\u65E0\u5F02\u5E38",
    calls: "\u8C03\u7528\u660E\u7EC6\uFF08\u524D 50\uFF09",
    helpCalls: "\u6309\u65F6\u95F4\u5217\u51FA\u8BE5\u4EFB\u52A1\u7684\u6A21\u578B\u8C03\u7528\uFF0C\u6700\u591A\u663E\u793A 50 \u6761\uFF1B\u5B8C\u6574\u6570\u636E\u53EF\u5728\u300C\u8C03\u7528\u660E\u7EC6\u300D\u6807\u7B7E\u7B5B\u9009\u4EFB\u52A1\u67E5\u770B\u3002",
    emptyCalls: "\u6682\u65E0\u8C03\u7528",
    export: "\u5BFC\u51FA",
    writesTitle: "\u4FEE\u6539\u6587\u4EF6 / \u547D\u4EE4\u805A\u5408"
  },
  summary: {
    task: {
      objective: "\u672C\u6B21\u76EE\u6807",
      completed: "\u5B9E\u9645\u5B8C\u6210\u5185\u5BB9",
      decisions: "\u5173\u952E\u6280\u672F\u51B3\u7B56",
      files: "\u4FEE\u6539\u6587\u4EF6",
      apiChanges: "\u63A5\u53E3\u53D8\u5316",
      tests: "\u6D4B\u8BD5\u7ED3\u679C",
      pending: "\u672A\u5B8C\u6210\u4E8B\u9879",
      nextSteps: "\u4E0B\u4E00\u6B65\u8BA1\u5212",
      tokenStats: "Token \u4F7F\u7528\u7EDF\u8BA1"
    }
  },
  projects: {
    title: "\u9879\u76EE",
    help: {
      list: "\u9879\u76EE\u6309\u5DE5\u4F5C\u76EE\u5F55\u805A\u5408\u4F1A\u8BDD\u4E0E\u4EFB\u52A1\uFF1B\u6458\u8981\u72B6\u6001\u8868\u793A\u662F\u5426\u4FDD\u5B58\u8FC7\u9879\u76EE\u6458\u8981\u7248\u672C\uFF0C\u8349\u7A3F\u5EFA\u8BAE\u6765\u81EA\u672C\u5730\u81EA\u52A8\u751F\u6210\u3002"
    },
    empty: "\u8FD8\u6CA1\u6709\u9879\u76EE\u8BB0\u5F55\uFF0C\u4EA7\u751F\u4E00\u6B21\u5BF9\u8BDD\u540E\u81EA\u52A8\u51FA\u73B0",
    open: "\u6253\u5F00\u9879\u76EE\u6458\u8981",
    table: {
      project: "\u9879\u76EE\u8DEF\u5F84",
      sessions: "\u4F1A\u8BDD\u6570",
      tasks: "\u4EFB\u52A1\u6570",
      calls: "\u8C03\u7528\u6570",
      tokens: "tokens",
      cost: "\u8D39\u7528",
      lastActivity: "\u6700\u8FD1\u6D3B\u52A8",
      summary: "\u6458\u8981\u72B6\u6001"
    },
    summary: {
      saved: "\u5DF2\u4FDD\u5B58",
      draft: "\u8349\u7A3F",
      none: "\u65E0\u6458\u8981"
    },
    editor: {
      title: "\u9879\u76EE\u6458\u8981",
      help: "8 \u6BB5\u9879\u76EE\u6458\u8981\u4FDD\u5B58\u5728\u672C\u5730\u6570\u636E\u5E93\uFF0C\u7528\u4E8E\u8BB0\u5F55\u9879\u76EE\u73B0\u72B6\u4E0E\u7EA6\u675F\uFF1B\u8349\u7A3F\u6765\u81EA\u672C\u5730\u81EA\u52A8\u751F\u6210\uFF0C\u624B\u52A8\u7F16\u8F91\u5E76\u4FDD\u5B58\u540E\u751F\u6210\u65B0\u7248\u672C\uFF08\u7248\u672C\u53F7\u81EA\u589E\uFF0C\u5386\u53F2\u8349\u7A3F\u4F1A\u88AB\u66FF\u6362\uFF09\u3002\u5185\u5BB9\u4E0D\u4F1A\u5199\u5165 mnemon \u6216\u4F1A\u8BDD\u65E5\u5FD7\u3002",
      close: "\u5173\u95ED",
      save: "\u4FDD\u5B58\u6458\u8981",
      savedNote: "\u5DF2\u4FDD\u5B58",
      draftHint: "\u5F53\u524D\u663E\u793A\u7684\u662F\u672C\u5730\u81EA\u52A8\u8349\u7A3F\u5EFA\u8BAE\uFF0C\u7F16\u8F91\u540E\u4FDD\u5B58\u624D\u4F1A\u751F\u6210\u7248\u672C",
      draftSuggestions: "\u8349\u7A3F\u5EFA\u8BAE",
      applyDraft: "\u91C7\u7528\u5168\u90E8\u8349\u7A3F",
      helpDraft: "\u8349\u7A3F\u5EFA\u8BAE\u662F\u672C\u5730\u81EA\u52A8\u751F\u6210\u7684\u53C2\u8003\u5185\u5BB9\uFF0C\u91C7\u7528\u540E\u4F1A\u586B\u5165\u5BF9\u5E94\u6BB5\u843D\uFF1B\u4ECD\u9700\u4FDD\u5B58\u624D\u4F1A\u751F\u6548\u3002"
    },
    section: {
      overview: "\u9879\u76EE\u57FA\u672C\u60C5\u51B5",
      architecture: "\u6280\u672F\u67B6\u6784",
      database: "\u6570\u636E\u5E93\u7ED3\u6784",
      apis: "\u5173\u952E\u63A5\u53E3",
      completed: "\u5DF2\u5B8C\u6210\u6A21\u5757",
      status: "\u5F53\u524D\u5F00\u53D1\u72B6\u6001",
      pending: "\u672A\u5B8C\u6210\u4E8B\u9879",
      constraints: "\u7528\u6237\u660E\u786E\u9650\u5236"
    }
  },
  auto: {
    help: "AUTO \u81EA\u52A8\u63A8\u7406\uFF1A\u6309\u6BCF\u4E2A\u4EFB\u52A1\u7684\u5B9E\u9645\u4FE1\u53F7\u5224\u65AD\u96BE\u5EA6\uFF0C\u4ECE OFF/LOW \u8D77\u6B65\uFF1B\u53EA\u6709\u63A8\u7406\u6027\u5931\u8D25\u624D\u4F1A\u9010\u7EA7\u5347\u7EA7\uFF08OFF \u2192 LOW \u2192 HIGH \u2192 MAX\uFF09\uFF0C\u73AF\u5883\u7C7B\u5931\u8D25\uFF08\u8DEF\u5F84\u3001\u6743\u9650\u3001\u4F9D\u8D56\u3001\u7F51\u7EDC\u7B49\uFF09\u4E0D\u5347\u7EA7\u3002\u5168\u7A0B\u53EA\u7528\u672C\u5730\u89C4\u5219\uFF0C\u4E0D\u989D\u5916\u8C03\u7528\u6A21\u578B\uFF1B\u624B\u52A8\u9009\u62E9\u6863\u4F4D\u540E\u4F1A\u9000\u51FA AUTO\u3002",
    chipTitle: "AUTO \u72B6\u6001\uFF1A\u6309\u4EFB\u52A1\u96BE\u5EA6\u81EA\u52A8\u9009\u62E9\u63A8\u7406\u6863\u4F4D\uFF1B\u624B\u52A8\u9009\u62E9\u6863\u4F4D\u540E\u9000\u51FA AUTO",
    mode: {
      auto: "AUTO",
      manual: "\u624B\u52A8",
      off: "\u5173\u95ED",
      unknown: "\u672A\u77E5"
    },
    effort: {
      off: "\u5173\u95ED\u63A8\u7406",
      low: "\u4F4E\u63A8\u7406",
      high: "\u9AD8\u63A8\u7406",
      max: "\u6700\u9AD8\u63A8\u7406"
    },
    effortShort: {
      off: "\u5173",
      low: "\u4F4E",
      high: "\u9AD8",
      max: "\u6700\u9AD8"
    },
    menu: {
      aria: "\u6253\u5F00 AUTO \u81EA\u52A8\u63A8\u7406\u83DC\u5355",
      title: "AUTO \u81EA\u52A8\u63A8\u7406",
      groupAuto: "\u81EA\u52A8",
      auto: "AUTO",
      autoHint: "\u6309\u4EFB\u52A1\u96BE\u5EA6\u81EA\u52A8\u9009\u62E9\u6863\u4F4D\uFF0C\u4EC5\u63A8\u7406\u6027\u5931\u8D25\u5347\u7EA7",
      manual: "\u624B\u52A8\u6863\u4F4D",
      decision: "\u6700\u8FD1\u51B3\u7B56",
      stage: "\u9636\u6BB5",
      noDecision: "\u6682\u65E0\u51B3\u7B56\u8BB0\u5F55",
      unavailable: "AUTO \u670D\u52A1\u672A\u5C31\u7EEA\uFF08host \u63A5\u53E3\u5C1A\u672A\u542F\u7528\uFF09",
      working: "\u5904\u7406\u4E2D\u2026"
    },
    manualFallback: "\u5DF2\u9000\u51FA AUTO\uFF0C\u4F46\u5B98\u65B9\u6863\u4F4D\u5165\u53E3\u6682\u4E0D\u53EF\u7528\uFF1B\u8BF7\u7528\u6A21\u578B\u9009\u62E9\u5668\u786E\u8BA4\u6863\u4F4D\u3002",
    manualFailed: "\u9000\u51FA AUTO \u5931\u8D25\uFF0C\u4E14\u5B98\u65B9\u6863\u4F4D\u5165\u53E3\u4E0D\u53EF\u7528\uFF1B\u8BF7\u68C0\u67E5\u670D\u52A1\u72B6\u6001\u3002",
    estimated: "\u4F30\u7B97",
    kpi: {
      saved: "\u8282\u7701",
      extra: "\u591A\u8017",
      savedVsManual: "\u8F83\u624B\u52A8\u8282\u7701",
      extraVsManual: "\u8F83\u624B\u52A8\u591A\u8017",
      autoManual: "AUTO / \u624B\u52A8",
      savedHint: "\u624B\u52A8 \u2212 AUTO\uFF1B\u6B63\u6570\u8868\u793A AUTO \u66F4\u7701",
      savedHelp: "\u624B\u52A8\u4E0E AUTO \u5E73\u5747\u6BCF\u4EFB\u52A1 Token \u4E4B\u5DEE\uFF1B\u6B63\u6570\u8868\u793A AUTO \u66F4\u7701\u3002",
      noBaseline: "\u6682\u65E0\u57FA\u51C6"
    },
    unavailable: "AUTO \u6570\u636E\u672A\u5C31\u7EEA\uFF1Ahost \u7684 /auto/* \u63A5\u53E3\u5C1A\u672A\u542F\u7528\u3002",
    action: {
      classify: "\u521D\u59CB\u5224\u5B9A",
      escalate: "\u5347\u7EA7",
      hold: "\u4FDD\u6301",
      reset: "\u590D\u4F4D",
      "manual-exit": "\u624B\u52A8\u9000\u51FA",
      skip: "\u8DF3\u8FC7"
    },
    compare: {
      title: "AUTO vs \u624B\u52A8",
      metric: "\u6307\u6807",
      tasks: "\u4EFB\u52A1\u6570",
      calls: "\u8C03\u7528\u6570",
      inputTokens: "\u672A\u547D\u4E2D\u8F93\u5165",
      cacheReadTokens: "\u7F13\u5B58\u547D\u4E2D",
      outputTokens: "\u8F93\u51FA",
      reasoningTokens: "\u63A8\u7406 Token",
      reasoningNote: "\u63A8\u7406 Token\uFF1A\u4F18\u5148\u4F7F\u7528 API \u8FD4\u56DE\u503C\uFF1BAPI \u672A\u8FD4\u56DE\u65F6\u6309 reasoning \u5185\u5BB9\u5757\u4F30\u7B97\u5E76\u6807\u6CE8\u300C\u4F30\u7B97\u300D\u3002",
      estimatedSuffix: "\uFF08\u4F30\u7B97\uFF09",
      estimatedTitle: "\u4F30\u7B97\u503C\uFF1AAPI \u672A\u8FD4\u56DE\u63A8\u7406 token\uFF0C\u6309 reasoning \u5185\u5BB9\u5757\u4F30\u7B97\uFF08\u975E API \u503C\uFF09",
      groupUsage: "\u7528\u91CF",
      groupEfficiency: "\u6548\u7387",
      totalHelp: "AUTO \u4E0E\u624B\u52A8\u6A21\u5F0F\u7684 Token \u5408\u8BA1\u5BF9\u6BD4\uFF1BAUTO \u5217\u542B\u4F30\u7B97\u63A8\u7406 token \u65F6\u5E26\u300C\u4F30\u7B97\u300D\u5FBD\u6807\u3002",
      callsHelp: "\u8C03\u7528\u6B21\u6570\uFF1BAUTO \u4E00\u4E2A\u4EFB\u52A1\u53EF\u80FD\u5305\u542B\u591A\u6B65\u8C03\u7528\uFF0C\u56E0\u6B64\u4E0E\u4EFB\u52A1\u6570\u4E0D\u540C\u3002",
      successHint: "\u5DF2\u5B8C\u6210 \xF7 \u603B\u8F6E\u6B21",
      tableTitle: "\u6307\u6807\u5BF9\u6BD4",
      totalTokens: "Token \u5408\u8BA1",
      cost: "\u4F30\u7B97\u8D39\u7528",
      successRate: "\u4EFB\u52A1\u6210\u529F\u7387",
      avgTokensPerTask: "\u5E73\u5747\u6BCF\u4EFB\u52A1",
      effortDistribution: "\u6863\u4F4D\u5206\u5E03",
      noEffort: "\u6682\u65E0\u6863\u4F4D\u6570\u636E",
      estimates: "\u542B\u4F30\u7B97\u503C",
      decisionsUnit: "\u6761\u51B3\u7B56",
      escalationsUnit: "\u6B21\u5347\u7EA7"
    },
    history: {
      empty: "\u6682\u65E0 AUTO \u51B3\u7B56\u8BB0\u5F55",
      time: "\u65F6\u95F4",
      session: "\u4F1A\u8BDD",
      task: "\u4EFB\u52A1",
      action: "\u52A8\u4F5C",
      effort: "\u6863\u4F4D",
      stage: "\u9636\u6BB5",
      reason: "\u539F\u56E0",
      applied: "\u751F\u6548",
      appliedYes: "\u5DF2\u751F\u6548",
      appliedNo: "\u4EC5\u8BB0\u5F55"
    }
  },
  "live.today": "\u4ECA\u65E5",
  "live.session": "\u672C\u4F1A\u8BDD",
  "live.saved": "\u5DF2\u7701\uFF08\u4F30\u7B97\uFF09",
  "live.savedCost": "\u8282\u7701\u8D39\u7528",
  "live.priceUnset": "\u4EF7\u683C\u672A\u914D\u7F6E",
  "live.loadReference": "\u8F7D\u5165\u53C2\u8003\u4EF7",
  "live.referenceNone": "\u65E0\u5339\u914D\u53C2\u8003\u4EF7\uFF0C\u8BF7\u5230\u8BBE\u7F6E\u624B\u52A8\u586B\u5199",
  "live.hide": "\u9690\u85CF\u5B9E\u65F6\u6761",
  "live.hint": "\u5B9E\u65F6\u7EDF\u8BA1\uFF1A\u4ECA\u65E5 / \u672C\u4F1A\u8BDD Token\u3001\u538B\u7F29\u8282\u7701\uFF08\u4F30\u7B97\uFF09\u4E0E\u8D39\u7528\uFF1B\u6570\u636E\u672C\u5730\u91C7\u96C6\uFF0C\u6BCF 5 \u79D2\u5237\u65B0",
  "live.loading": "\u52A0\u8F7D\u4E2D",
  "live.calls": "\u8C03\u7528",
  "live.sessionTokens": "\u672C\u4F1A\u8BDD\u7D2F\u8BA1",
  "live.context": "\u4E0A\u4E0B\u6587",
  "live.ofWindow": "\u5360\u7A97\u53E3",
  "live.compressMarker": "\u538B\u7F29\u89E6\u53D1\u7EBF\uFF08\u4EC5\u63D0\u793A\uFF09\uFF1A\u672C\u63D2\u4EF6\u4E0D\u81EA\u52A8\u538B\u7F29\u4F1A\u8BDD\u5386\u53F2",
  "live.show": "\u663E\u793A\u7528\u91CF\u6761",
  "auto.labelTagTitle": "AUTO \u81EA\u52A8\u63A8\u7406\u6B63\u5728\u63A5\u7BA1\u63A8\u7406\u6863\u4F4D",
  brand: {
    zhName: "\u667A\u63A7\u5F15\u64CE",
    enName: "ControlX",
    tagline: "AI Resource Optimization Engine",
    slogan: "\u8BA9 AI \u66F4\u806A\u660E\u5730\u4F7F\u7528\u8D44\u6E90\u3002"
  }
};

// locale/en.json
var en_default = {
  panel: {
    label: "ControlX",
    title: "ControlX \xB7 AI Resource Optimization Engine",
    help: "ControlX monitors token usage, chooses the reasoning effort automatically (AUTO), compresses and reuses tool output, and analyses cost and waste. All data stays local."
  },
  tabs: {
    label: "Tabs",
    overview: "Overview",
    calls: "Calls",
    tasks: "Tasks",
    report: "Cost analysis",
    settings: "Settings",
    cache: "Tool cache",
    context: "Context analysis"
  },
  common: {
    all: "All",
    allTasks: "All tasks",
    analysisOnly: "Read-only",
    callsShort: "calls",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    exportCsv: "Export CSV",
    help: "Help",
    loading: "Loading\u2026",
    next: "Next",
    noPrice: "Price not configured",
    prev: "Prev",
    refresh: "Refresh",
    retry: "Retry",
    rows: "rows",
    save: "Save",
    saved: "Saved",
    saving: "Saving\u2026",
    sessions: "sessions",
    unknown: "Unknown",
    untitled: "Untitled task"
  },
  error: {
    generic: "Request failed, please retry",
    network: "Network unavailable; check that the local service is running"
  },
  footer: {
    poweredBy: "Powered by ZHIRAI",
    copyright: "\xA9 2026 ZHIRAI Technology"
  },
  chart: {
    empty: "No data yet",
    trend: "Token trend chart",
    calls: "Daily calls chart",
    share: "Share chart"
  },
  overview: {
    rangeLabel: "Range",
    range: {
      today: "Today",
      session: "Session",
      task: "Task",
      all: "All"
    },
    cards: {
      todayTokens: "Tokens today",
      sessionTokens: "Session tokens",
      taskTokens: "Task tokens",
      cacheHitRate: "Cache hit rate",
      missInput: "Cache-miss input",
      output: "Output tokens",
      calls: "Calls",
      cost: "Estimated cost",
      findings: "Findings",
      allTime: "All-time tokens"
    },
    help: {
      todayTokens: "Total tokens since local midnight (sum of the four buckets).",
      sessionTokens: "Total tokens of the active session; falls back to the most recent session when no session id is supplied.",
      taskTokens: "Total tokens of the latest turn (auto task).",
      cacheHitRate: "Cache hit rate = cache-read tokens \xF7 (cache-read + cache-miss input).",
      missInput: "Cache-miss input tokens: the newly sent part that did not hit the prompt cache.",
      output: "Total model output tokens; reasoning tokens are tracked separately.",
      calls: "Number of model calls in the range (deduplicated final records per turn/step).",
      cost: "Locally estimated from the price table, not a real bill. When no price is configured this shows \u201CPrice not configured\u201D instead of 0.",
      findings: "Findings produced by tasks in the range (repeated read, repeated build, step inflation, cost anomaly, \u2026).",
      trend: "Daily aggregates: line = total tokens, bars = calls. Switch between 7 and 30 days.",
      rankModels: "Token share by model (top 5).",
      rankProjects: "Token ranking by project.",
      rankTasks: "Token ranking by task; click a task to open its cost report.",
      allTime: "Total tokens across all history, including sessions imported from the projection cache."
    },
    trend: {
      title: "Trend",
      tokens: "Token trend",
      calls: "Daily calls"
    },
    rank: {
      models: "Model share",
      projects: "Project ranking",
      tasks: "Task ranking"
    },
    days: {
      "7": "7 days",
      "30": "30 days"
    },
    empty: "No calls yet \u2014 run one model call and data appears here",
    emptyRank: "No ranking data yet",
    importedSessions: "Imported {n} historical sessions",
    auto: {
      title: "AUTO reasoning",
      help: "AUTO versus manual token / cost / success-rate comparison, plus the effort distribution of AUTO decisions. Shows an empty state until the host endpoints are ready."
    }
  },
  calls: {
    filter: {
      range: "Time range",
      model: "Model",
      task: "Task",
      flaggedOnly: "Flagged only"
    },
    range: {
      "7": "Last 7 days",
      "30": "Last 30 days",
      all: "All",
      today: "Today"
    },
    table: {
      time: "Time",
      model: "Model",
      task: "Task",
      missInput: "Cache-miss",
      cacheRead: "Cache read",
      cacheWrite: "Cache write",
      output: "Output",
      total: "Total",
      cost: "Cost",
      duration: "Duration",
      flag: "Flag"
    },
    flagged: "Flagged",
    normal: "OK",
    empty: "No calls recorded yet \u2014 they appear after the next model call"
  },
  tasks: {
    filter: {
      type: "Task type",
      status: "Status"
    },
    table: {
      name: "Task",
      project: "Project",
      type: "Type",
      status: "Status",
      calls: "Calls",
      missInput: "Cache-miss",
      cacheRead: "Cache read",
      cacheWrite: "Cache write",
      output: "Output",
      total: "Total",
      cost: "Cost",
      findings: "Findings",
      started: "Started",
      select: "Select"
    },
    empty: "No tasks yet \u2014 a conversation turn creates one automatically",
    help: {
      subview: "Tasks and Projects are two sub-views inside the same tab: tasks are created per turn, projects aggregate by working directory. Switching sub-views never changes the seven top-level tabs.",
      create: "Create a task manually: the name is required, the type decides the baseline it compares against, and the session defaults to the latest active one.",
      merge: "Merging folds the selected tasks into one; calls and cost statistics merge too. Only tasks from the same session can be merged."
    },
    subview: {
      tasks: "Tasks",
      projects: "Projects"
    },
    newTask: "New task",
    newTaskTitle: "New task",
    newTaskName: "Task name",
    newTaskType: "Task type",
    newTaskSession: "Session",
    newTaskCreate: "Create",
    created: "Task created",
    merge: "Merge",
    mergeTitle: "Merge tasks",
    mergeName: "Merged name",
    mergeConfirm: "Merge",
    mergeSelected: "Selected tasks",
    mergeHint: "Select two or more tasks from the same session to merge",
    merged: "Merged",
    exportReport: "Export report",
    selectOneForExport: "Select exactly one task before exporting",
    nameEmpty: "Name is required",
    openDetail: "Open task detail",
    subviewLabel: "Sub-view",
    helpList: "Tasks are created per turn. Type and status can be edited directly in the table; click any row to open the detail drawer, and select tasks to merge or export a report."
  },
  status: {
    pending: "Pending",
    running: "Running",
    completed: "Completed",
    paused: "Paused",
    failed: "Failed"
  },
  type: {
    "simple-edit": "Simple edit",
    "normal-dev": "Normal development",
    "complex-dev": "Complex development",
    troubleshoot: "Troubleshooting",
    "project-analysis": "Project analysis"
  },
  finding: {
    repeated_read: "Repeated file read",
    repeated_tool: "Repeated tool call",
    repeated_build: "Repeated build",
    repeated_test: "Repeated test run",
    repeated_deploy: "Repeated deploy",
    confirmation_rounds: "Possible extra confirmation rounds",
    repeated_plan: "Possible repeated planning",
    repeated_summary: "Possible repeated summary",
    step_inflation: "Step count above baseline",
    cache_hit_drop: "Cache hit rate dropped",
    task_cost_anomaly: "Task cost anomaly"
  },
  severity: {
    info: "Info",
    warn: "Warn",
    high: "High"
  },
  report: {
    taskLabel: "Task",
    pickTask: "Select a task",
    empty: "Select a task above to see its cost report",
    notFound: "This task has no cost data",
    metrics: {
      calls: "Calls",
      tokens: "Total tokens",
      cost: "Estimated cost",
      duration: "Duration",
      steps: "Model steps",
      toolCalls: "Tool calls"
    },
    percentile: {
      calls: "Call percentile",
      tokens: "Token percentile"
    },
    help: {
      percentile: "Percentile against the same task-type baseline (0\u2013100, higher means costlier). Empty when there are too few samples.",
      baseline: "Median and p80 of completed tasks with the same project and task type. No conclusion below 5 samples.",
      findings: "Read-only analysis results: repeated reads, repeated build/test, step inflation, cache drop, cost anomaly, etc. Each check can be disabled in Settings.",
      topCalls: "The costliest model calls of this task with the reason (large input / low cache hit / large output / retry).",
      suggestions: "Suggestions only, never executed automatically. Phase 1 performs no intervention."
    },
    baseline: {
      metric: "Metric",
      median: "Median",
      p80: "p80",
      samples: "Samples"
    },
    baselineInsufficient: "Not enough samples for a baseline conclusion",
    baselineInsufficientShort: "Too few samples",
    interference: "Concurrent interference",
    findings: "Findings",
    noFindings: "No findings",
    topCalls: {
      turn: "Turn/Step",
      reason: "Reason"
    },
    noCalls: "No calls",
    suggestions: "Suggestions",
    noSuggestions: "No suggestions",
    baselineTitle: "Baseline",
    topCallsTitle: "Top cost calls",
    auto: {
      title: "AUTO vs manual",
      help: "Input / output / reasoning / cache-read tokens, cost, task success rate and average tokens per task, split by whether a call ran under AUTO or manual mode. Cost needs the price table on the Settings page; without a price it shows 'Price not configured'.",
      historyTitle: "Recent AUTO decisions",
      historyHelp: "The latest 20 AUTO decisions: session, turn/step, action, effort change, stage, reasons and whether it was applied. In monitor-only mode applied reads 'Recorded only'.",
      globalHint: "No task selected: below is the global AUTO comparison"
    }
  },
  settings: {
    savedState: "Save state",
    notChanged: "Unchanged",
    export: "Export CSV",
    reset: "Reset defaults",
    resetConfirm: "Reset all settings to their defaults?",
    section: {
      capture: "Capture",
      analytics: "Analyses",
      thresholds: "Thresholds",
      prices: "Prices",
      data: "Data",
      compression: "Tool output cache",
      context: "Context analysis",
      auto: "AUTO reasoning"
    },
    help: {
      capture: "The capture switch controls whether usage is recorded. Observe-only keeps analysis non-intervening. The evidence limit caps how much text findings may keep.",
      analytics: "Each analysis can be disabled individually; disabling it stops that finding type from being produced.",
      thresholds: "Numeric thresholds used by the checks; changes take effect immediately.",
      prices: "Configure the four bucket prices per provider + model. The unit is the billing unit (default 1,000,000 tokens). Costs are local estimates, not real bills.",
      data: "The projection-cache import is read-only and never modifies sessions. CSV export includes a UTF-8 BOM and formula-injection escaping.",
      compression: "Compresses long tool results and replaces them with a summary to save context tokens. Replacements are written to the session log (visible in history), while the full original stays in a local blob and can be restored any time. Observe mode records and stores without replacing what the model sees. Phase 2 defaults to observe mode.",
      context: "Detect only, never rewrite. Analyses duplicate content in the current context and estimates savings versus KV-cache risk; dry-run by default. Thresholds and the risk factor drive candidate and risk decisions; when no price is configured the cache-read ratio estimates risk cost.",
      auto: "AUTO classifies task difficulty from local events only and never calls a model for this. Picking a tier manually exits AUTO. Initial effort may only be OFF/LOW and escalation is one level at a time; environment failures (path, permission, dependency, network) never escalate. Monitor-only records decisions without switching the tier."
    },
    enabled: "Capture usage",
    observeOnly: "Observe only",
    alertOnly: "Alert only",
    evidenceTextLimit: "Evidence text limit",
    analytics: {
      repeatedRead: "Repeated file read",
      repeatedTool: "Repeated tool call",
      repeatedBuild: "Repeated build",
      repeatedTest: "Repeated test run",
      repeatedDeploy: "Repeated deploy",
      confirmationRounds: "Confirmation rounds",
      repeatedPlan: "Repeated planning",
      repeatedSummary: "Repeated summary",
      stepInflation: "Step inflation",
      cacheHitDrop: "Cache hit drop",
      taskCostAnomaly: "Task cost anomaly"
    },
    thresholds: {
      repeatedReadCount: "Repeated read count",
      repeatedToolCount: "Repeated tool count",
      repeatedCommandCount: "Repeated command count",
      confirmationMaxChars: "Confirmation max chars",
      confirmationRounds: "Confirmation rounds",
      repeatedTextCount: "Repeated text count",
      inflationFactor: "Inflation factor",
      simpleEditCallCap: "Simple-edit call cap",
      normalDevCallCap: "Normal-dev call cap",
      cacheDropFactor: "Cache drop factor",
      costAnomalyFactor: "Cost anomaly factor",
      minBaselineSamples: "Min baseline samples"
    },
    auto: {
      on: "Enabled",
      off: "Disabled",
      monitorBadge: "Monitor only",
      enabled: "Enable AUTO reasoning",
      includeSubagents: "Include subagent sessions",
      monitorOnly: "Monitor only (record, do not apply)",
      resetOnNewTurn: "Re-classify on each new task",
      initial: "Initial effort",
      initialHelp: "Per task type, set AUTO's starting effort. Only OFF/LOW are allowed: a task never starts at HIGH/MAX. The initial cap applies to every type.",
      maxInitial: "Initial effort cap",
      reasoningFailuresToEscalate: "Reasoning failures to escalate",
      filesForComplex: "Files for a complex task",
      maxStepsWithoutProgress: "Max steps without progress",
      maxEscalationsPerTask: "Max escalations per task"
    },
    price: {
      provider: "Provider",
      model: "Model",
      input: "Cache-miss price",
      cacheRead: "Cache-read price",
      cacheWrite: "Cache-write price",
      output: "Output price",
      currency: "Currency",
      unitTokens: "Unit tokens",
      effectiveAt: "Effective at",
      actions: "Actions",
      add: "Add price",
      invalid: "Provider and model are required"
    },
    pricesEmpty: "No prices yet \u2014 add one to estimate costs",
    import: {
      button: "Import projection cache",
      idle: "Not imported",
      result: "Import finished"
    },
    compression: {
      mode: "Mode",
      blobs: "Blobs",
      usage: "Usage",
      missing: "Missing",
      statsIdle: "Loading storage state\u2026",
      minBytes: "Min bytes",
      selectiveBytes: "Selective summary threshold",
      smartBytes: "Smart compression threshold",
      maxCacheMB: "Cache limit (MB)",
      ttlDays: "Retention days",
      type: {
        text: "Plain text",
        "build-log": "Build log",
        "test-output": "Test output",
        json: "JSON",
        xml: "XML",
        "file-list": "File list",
        "zip-list": "ZIP & other text"
      },
      verify: "Verify",
      clear: "Clear cache",
      verifyMissing: "missing",
      verifyOrphan: "orphan",
      verifyMismatch: "hash mismatch",
      clearConfirm: "Clear the entire tool output cache? This cannot be undone.",
      cleared: "Cleared",
      storageIdle: "Not checked"
    },
    context: {
      mode: "Mode",
      modeNote: "Detect only, never rewrites",
      minOccurrences: "Min occurrences",
      minSurfaceNodes: "Min surface nodes",
      maxCandidates: "Max candidates",
      riskFactor: "Risk factor",
      assumedCacheReadRatio: "Assumed cache-read ratio"
    }
  },
  cache: {
    cards: {
      entries: "Cached results",
      original: "Original size",
      compressed: "Compressed size",
      saved: "Estimated saved"
    },
    help: {
      entries: "Number of raw tool outputs recorded (repeated calls count separately; dedupe hits are counted on their own).",
      original: "Sum of the original bytes of every cached tool output.",
      compressed: "Sum of the compressed bytes actually written to disk.",
      saved: "Estimated saving = original size \u2212 compressed size (bytes and percentage). This estimates disk usage, not billing savings.",
      table: "Cached tool outputs newest first. Click any row to read the original text. \u201CNot recoverable\u201D means the blob file was pruned or is missing.",
      viewer: "The drawer reads the local original blob 8 KB at a time with previous/next paging. It is read-only and never modifies sessions or cache content."
    },
    dedupe: "Dedupe hits",
    missingWarn: "Missing blobs",
    filter: {
      tool: "Tool",
      toolPlaceholder: "Filter by tool name",
      recoverable: "Recoverable",
      all: "All",
      recoverableOnly: "Recoverable",
      notRecoverable: "Not recoverable"
    },
    table: {
      tool: "Tool",
      original: "Original",
      compressed: "Compressed",
      compression: "Compression",
      mode: "Mode",
      session: "Session",
      time: "Time",
      recoverable: "Recoverable"
    },
    mode: {
      off: "Off",
      observe: "Observe",
      on: "Auto-compress"
    },
    recoverable: {
      yes: "Recoverable",
      no: "Not recoverable"
    },
    empty: "No cached tool outputs yet \u2014 one large tool output records automatically",
    openViewer: "Open original",
    viewer: {
      title: "Tool output source",
      blobId: "Blob ID",
      hash: "Hash",
      size: "Size",
      type: "Type",
      tool: "Tool",
      session: "Session",
      time: "Time",
      summary: "Summary",
      summaryEmpty: "(Summary appears once content loads)",
      notRecoverable: "The original blob is missing or was pruned, so it cannot be shown.",
      emptyContent: "This segment has no content to show.",
      range: "Range",
      total: "Total",
      prev: "Previous",
      next: "Next",
      close: "Close"
    }
  },
  context: {
    sessionLabel: "Session",
    sessionDefault: "Latest active session",
    refreshAnalysis: "Refresh analysis",
    mode: {
      off: "Off",
      "dry-run": "Detect only (dry-run)"
    },
    readOnly: "Read-only",
    protected: "Protected",
    cards: {
      nodes: "Surface nodes",
      tokens: "Estimated tokens",
      candidates: "Candidates",
      savings: "Potential savings",
      riskyHint: "risky"
    },
    help: {
      page: "Detect only, never rewrite. This page analyses duplicate content and KV-cache risk in the current context and defaults to dry-run. Rewriting context breaks the cached prefix, which usually costs more than the tokens saved, so Phase 3 ships no automatic rewriting. \u201CRecord dry-run suggestions\u201D only writes candidates to local records and never touches the session.",
      nodes: "Surface nodes = number of messages or segments in this request context (system / developer / user / assistant / tool).",
      tokens: "Context tokens estimated from character counts, not an official billing figure.",
      candidates: "Removable duplicated content items; a contentHash must reach the minimum occurrence threshold to be counted.",
      savings: "Estimated tokens saved if every candidate were removed; the extra cost of an invalidated KV cache is not deducted.",
      composition: "Context share by role and by source. Protected sources (system / user / dsh-mnemon \u2026) can never become removal candidates.",
      candidateTable: "Click a candidate row to expand where it appears (turn / step / seq / tokens). The risk badge shows safe / risky / unknown plus the reason.",
      history: "History of recorded dry-run suggestions. Local records only; nothing is ever rewritten."
    },
    section: {
      composition: "Context composition",
      candidates: "Duplicate candidates",
      history: "Optimization history"
    },
    roleBar: "By role",
    sources: "By source",
    role: {
      system: "System",
      developer: "Developer",
      user: "User",
      assistant: "Assistant",
      tool: "Tool"
    },
    kind: {
      "tool-result": "Tool result",
      "file-content": "File content"
    },
    table: {
      kind: "Kind",
      subject: "Subject",
      occurrences: "Occurrences",
      removable: "Removable",
      risk: "Cache risk",
      advice: "Advice"
    },
    risk: {
      safe: "Safe",
      risky: "Risky",
      unknown: "Unknown"
    },
    advice: {
      recommend: "Recommended",
      avoid: "Not advised"
    },
    occ: {
      title: "Occurrences",
      riskLine: "Risk reason",
      seq: "seq",
      turn: "Turn",
      step: "Step",
      role: "Role",
      source: "Source",
      tokens: "tokens",
      bytes: "Bytes",
      costLine: "Saving / extra cost"
    },
    totalRows: "Total",
    recordDryRun: "Record dry-run suggestions",
    recordedNote: "Recorded {n} suggestions",
    emptySession: "This session has no analysable context yet \u2014 send a turn, then refresh",
    emptyCandidates: "No removable duplicates found",
    emptyHistory: "No dry-run records yet \u2014 use the button above to record one",
    emptyComposition: "No composition data yet",
    verified: "verified",
    history: {
      time: "Time",
      type: "Type",
      original: "Original",
      optimized: "Optimized",
      savings: "Estimated savings",
      cacheImpact: "Cache impact",
      status: "Status"
    }
  },
  taskdetail: {
    title: "Task detail",
    help: "This drawer summarises the task metrics, the nine summary fields, write/command aggregation, findings and call details. \u201CAuto-generated (local)\u201D means the text came from a local draft; saving turns it into an edited version. Exports read local data only.",
    openReport: "Cost analysis",
    close: "Close",
    notFound: "Task not found or has no detail data",
    name: "Task name",
    metrics: {
      calls: "Calls",
      total: "Total tokens",
      cost: "Estimated cost",
      duration: "Duration"
    },
    buckets: {
      missInput: "Cache-miss input",
      cacheRead: "Cache read",
      cacheWrite: "Cache write",
      output: "Output"
    },
    summary: "Task summary",
    summaryHelp: "The nine summary fields record the objective, output and next steps of the task. They stay in the local database and can be exported as JSON/Markdown/CSV; nothing is written to the session log or mnemon.",
    autoDraft: "Auto-generated (local)",
    edited: "Edited",
    unsaved: "Unsaved",
    savedState: "Saved",
    saved: "Summary saved",
    saveSummary: "Save summary",
    writes: {
      tool: "Tool",
      target: "Target",
      command: "Command",
      count: "Count"
    },
    helpWrites: "Aggregates files written and commands executed by this task, grouped by tool and target, for reviewing the actual change scope.",
    toolCalls: "tool calls",
    emptyWrites: "No file or command changes yet",
    findings: "Findings",
    helpFindings: "Read-only analysis results for this task (repeated reads, repeated builds, step inflation, cost anomalies \u2026).",
    emptyFindings: "No findings",
    calls: "Calls (first 50)",
    helpCalls: "Lists the model calls of this task by time, up to 50 rows. Use the Calls tab filtered by task for the full list.",
    emptyCalls: "No calls",
    export: "Export",
    writesTitle: "Writes / commands"
  },
  summary: {
    task: {
      objective: "Objective",
      completed: "Completed work",
      decisions: "Key decisions",
      files: "Changed files",
      apiChanges: "API changes",
      tests: "Test results",
      pending: "Open items",
      nextSteps: "Next steps",
      tokenStats: "Token usage"
    }
  },
  projects: {
    title: "Projects",
    help: {
      list: "Projects aggregate sessions and tasks by working directory. The summary status shows whether a saved summary version exists; draft suggestions are generated locally."
    },
    empty: "No projects yet \u2014 they appear after the first conversation",
    open: "Open project summary",
    table: {
      project: "Project path",
      sessions: "Sessions",
      tasks: "Tasks",
      calls: "Calls",
      tokens: "Tokens",
      cost: "Cost",
      lastActivity: "Last activity",
      summary: "Summary"
    },
    summary: {
      saved: "Saved",
      draft: "Draft",
      none: "No summary"
    },
    editor: {
      title: "Project summary",
      help: "The eight project summary sections are stored locally to record the project state and constraints. Drafts are generated locally; saving an edited version creates a new version with an incremented number and replaces the previous draft. Nothing is written to mnemon or the session log.",
      close: "Close",
      save: "Save summary",
      savedNote: "Saved",
      draftHint: "These are locally generated draft suggestions; save to create a version",
      draftSuggestions: "Draft suggestions",
      applyDraft: "Apply all drafts",
      helpDraft: "Draft suggestions are local reference text; applying fills the sections, and saving is still required."
    },
    section: {
      overview: "Overview",
      architecture: "Architecture",
      database: "Database",
      apis: "Key APIs",
      completed: "Completed modules",
      status: "Current status",
      pending: "Open items",
      constraints: "User constraints"
    }
  },
  auto: {
    help: "AUTO reasoning: classifies each task from local signals and starts at OFF/LOW; only reasoning failures escalate one level (OFF \u2192 LOW \u2192 HIGH \u2192 MAX), while environment failures (path, permission, dependency, network) never escalate. Local rules only, no extra model calls; picking a tier manually exits AUTO.",
    chipTitle: "AUTO status: the reasoning tier follows task difficulty; choosing a tier manually exits AUTO",
    mode: {
      auto: "AUTO",
      manual: "Manual",
      off: "Off",
      unknown: "Unknown"
    },
    effort: {
      off: "Off",
      low: "Low",
      high: "High",
      max: "Max"
    },
    effortShort: {
      off: "Off",
      low: "Low",
      high: "High",
      max: "Max"
    },
    menu: {
      aria: "Open the AUTO reasoning menu",
      title: "AUTO reasoning",
      groupAuto: "Automatic",
      auto: "AUTO",
      autoHint: "Pick a tier per task; escalate only on reasoning failures",
      manual: "Manual tier",
      decision: "Latest decision",
      stage: "stage",
      noDecision: "No decisions yet",
      unavailable: "AUTO service is not ready (host endpoints disabled)",
      working: "Working\u2026"
    },
    manualFallback: "AUTO exited, but the official tier entry is unavailable; confirm the tier in the model selector.",
    manualFailed: "Exiting AUTO failed and the official tier entry is unavailable; check the service state.",
    estimated: "Est.",
    kpi: {
      saved: "Saved",
      extra: "Extra",
      savedVsManual: "Saved vs manual",
      extraVsManual: "Extra vs manual",
      autoManual: "AUTO / manual",
      savedHint: "Manual \u2212 AUTO; positive means AUTO saves",
      savedHelp: "Difference in average tokens per task (manual \u2212 AUTO); positive means AUTO saves.",
      noBaseline: "No baseline"
    },
    unavailable: "AUTO data is not ready: the host /auto/* endpoints are not enabled yet.",
    action: {
      classify: "Classify",
      escalate: "Escalate",
      hold: "Hold",
      reset: "Reset",
      "manual-exit": "Manual exit",
      skip: "Skip"
    },
    compare: {
      title: "AUTO vs manual",
      metric: "Metric",
      tasks: "Tasks",
      calls: "Calls",
      inputTokens: "Cache-miss input",
      cacheReadTokens: "Cache read",
      outputTokens: "Output",
      reasoningTokens: "Reasoning tokens",
      reasoningNote: "Reasoning tokens: use the API value when available; otherwise estimate them from reasoning content blocks and mark them as estimated.",
      estimatedSuffix: "(est.)",
      estimatedTitle: "Estimated value: the API did not return reasoning tokens, so this is estimated from reasoning content blocks (not an API value).",
      groupUsage: "Usage",
      groupEfficiency: "Efficiency",
      totalHelp: "Total-token comparison between AUTO and manual. The AUTO column carries an 'Est.' badge when it includes estimated reasoning tokens.",
      callsHelp: "Number of calls. One AUTO task may span several calls, so this differs from the task count.",
      successHint: "Completed \xF7 total turns",
      tableTitle: "Metrics",
      totalTokens: "Total tokens",
      cost: "Estimated cost",
      successRate: "Task success rate",
      avgTokensPerTask: "Avg tokens / task",
      effortDistribution: "Effort distribution",
      noEffort: "No effort data yet",
      estimates: "Includes estimates",
      decisionsUnit: "decisions",
      escalationsUnit: "escalations"
    },
    history: {
      empty: "No AUTO decisions yet",
      time: "Time",
      session: "Session",
      task: "Task",
      action: "Action",
      effort: "Effort",
      stage: "Stage",
      reason: "Reason",
      applied: "Applied",
      appliedYes: "Applied",
      appliedNo: "Recorded only"
    }
  },
  "live.today": "Today",
  "live.session": "Session",
  "live.saved": "Saved (est.)",
  "live.savedCost": "Saved cost",
  "live.priceUnset": "Price not set",
  "live.loadReference": "Load reference prices",
  "live.referenceNone": "No matching reference price \u2014 set it manually in Settings",
  "live.hide": "Hide live strip",
  "live.hint": "Live counters: today / session tokens, estimated tokens saved by compression, and cost. Local data, refreshed every 5s.",
  "live.loading": "Loading",
  "live.calls": "Calls",
  "live.sessionTokens": "Session tokens",
  "live.context": "Context",
  "live.ofWindow": "of window",
  "live.compressMarker": "Compression line (hint only): this plugin never compacts history",
  "live.show": "Show usage strip",
  "auto.labelTagTitle": "AUTO is choosing the reasoning effort",
  brand: {
    zhName: "\u667A\u63A7\u5F15\u64CE",
    enName: "ControlX",
    tagline: "AI Resource Optimization Engine",
    slogan: "Make AI Work Smarter, Not Harder."
  }
};

// src/client/i18n.ts
var DICTIONARIES = {
  zh: zh_default,
  en: en_default
};
function lookup(dict, key) {
  let current = dict;
  for (const part of key.split(".")) {
    if (typeof current !== "object" || current === null) return void 0;
    current = current[part];
  }
  return current;
}
function createTranslate(bound, fallback = DICTIONARIES.zh) {
  return (key) => {
    if (bound) {
      try {
        const value = bound(key);
        if (typeof value === "string" && value.length > 0 && value !== key) return value;
      } catch {
      }
    }
    const local = lookup(fallback, key);
    return typeof local === "string" ? local : key;
  };
}

// src/client/components.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var TranslateContext = (0, import_react.createContext)(createTranslate(void 0));
function useT() {
  return (0, import_react.useContext)(TranslateContext);
}
var openHelpCloser = null;
function Help({ text, label }) {
  const [open, setOpen] = (0, import_react.useState)(false);
  const rootRef = (0, import_react.useRef)(null);
  const closeRef = (0, import_react.useRef)(() => void 0);
  closeRef.current = () => {
    setOpen(false);
    if (openHelpCloser === closeRef.current) openHelpCloser = null;
  };
  (0, import_react.useEffect)(() => {
    return () => {
      if (openHelpCloser === closeRef.current) openHelpCloser = null;
    };
  }, []);
  (0, import_react.useEffect)(() => {
    if (!open) return void 0;
    const onDocumentPointer = (event) => {
      const root = rootRef.current;
      if (root && event.target instanceof Node && root.contains(event.target)) return;
      closeRef.current();
    };
    document.addEventListener("click", onDocumentPointer);
    return () => document.removeEventListener("click", onDocumentPointer);
  }, [open]);
  const toggle = () => {
    if (open) {
      closeRef.current();
      return;
    }
    if (openHelpCloser) openHelpCloser();
    openHelpCloser = closeRef.current;
    setOpen(true);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "tm-help" + (open ? " is-open" : ""), ref: rootRef, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        type: "button",
        className: "tm-help-btn",
        "aria-label": label,
        "aria-expanded": open,
        onClick: (event) => {
          event.preventDefault();
          event.stopPropagation();
          toggle();
        },
        onKeyDown: (event) => {
          if (event.key === "Escape") closeRef.current();
        },
        children: "?"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "tm-help-tip", role: "tooltip", children: text })
  ] });
}
function HelpLabel({ text, children }) {
  const t = useT();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "tm-card-label", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Help, { text, label: t("common.help") })
  ] });
}
function Card({
  label,
  value,
  hint,
  help,
  tone
}) {
  const valueClass = "tm-card-value" + (tone && tone !== "default" ? " tm-" + tone : "");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "tm-card", children: [
    help ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HelpLabel, { text: help, children: label }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "tm-card-label", children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: valueClass, children: value }),
    hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "tm-card-hint", children: hint }) : null
  ] });
}
function Section({
  title,
  help,
  actions,
  sub,
  children
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "tm-section", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "tm-section-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "tm-section-title", children: help ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HelpLabel, { text: help, children: title }) : title }),
      sub ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "tm-section-sub", children: sub }) : null,
      actions ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "tm-row-end", children: actions }) : null
    ] }),
    children
  ] });
}
function Button({
  children,
  onClick,
  variant,
  size,
  disabled,
  title,
  type
}) {
  const classes = ["tm-btn"];
  if (variant === "primary") classes.push("tm-btn-primary");
  if (variant === "danger") classes.push("tm-btn-danger");
  if (size === "sm") classes.push("tm-btn-sm");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: type ?? "button",
      className: classes.join(" "),
      onClick,
      disabled,
      title,
      children
    }
  );
}
function Chips({
  value,
  options,
  onChange,
  ariaLabel
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "tm-chips", role: "group", "aria-label": ariaLabel, children: options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: "button",
      className: "tm-chip",
      "aria-pressed": option.value === value,
      onClick: () => onChange(option.value),
      children: option.label
    },
    option.value
  )) });
}
function Select({
  value,
  options,
  onChange,
  ariaLabel,
  className
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "select",
    {
      className: "tm-select" + (className ? " " + className : ""),
      "aria-label": ariaLabel,
      value,
      onChange: (event) => onChange(event.target.value),
      children: options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: option.value, children: option.label }, option.value))
    }
  );
}
function Input({
  value,
  onChange,
  ariaLabel,
  type,
  className,
  placeholder,
  min,
  step,
  disabled
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "input",
    {
      className: "tm-input" + (className ? " " + className : ""),
      "aria-label": ariaLabel,
      type: type ?? "text",
      value,
      placeholder,
      min,
      step,
      disabled,
      onChange: (event) => onChange(event.target.value)
    }
  );
}
function Switch({
  checked,
  onChange,
  label,
  disabled
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "tm-switch", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "input",
      {
        type: "checkbox",
        checked,
        disabled,
        "aria-label": label,
        onChange: (event) => onChange(event.target.checked)
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "tm-switch-track", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "tm-switch-thumb" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label })
  ] });
}
function Pill({
  children,
  tone
}) {
  const classes = ["tm-pill"];
  if (tone && tone !== "default") classes.push("tm-pill-" + tone);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: classes.join(" "), children });
}
function Loading() {
  const t = useT();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "tm-loading", role: "status", children: t("common.loading") });
}
function ErrorBox({
  message,
  onRetry
}) {
  const t = useT();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "tm-error", role: "alert", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: message }),
    onRetry ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "tm-row-end", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { size: "sm", onClick: onRetry, children: t("common.retry") }) }) : null
  ] });
}
function Empty({ text, action }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "tm-empty", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: text }),
    action
  ] });
}
function Pager({
  page,
  pageCount,
  total,
  onPage
}) {
  const t = useT();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "tm-pager", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { size: "sm", onClick: () => onPage(page - 1), disabled: page <= 1, children: t("common.prev") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
      page,
      "/",
      pageCount,
      " \xB7 ",
      total,
      " ",
      t("common.rows")
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { size: "sm", onClick: () => onPage(page + 1), disabled: page >= pageCount, children: t("common.next") })
  ] });
}
function Footer() {
  const t = useT();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", { className: "tm-footer", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "tm-footer-brand", children: t("footer.poweredBy") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "tm-footer-brand", children: t("footer.copyright") })
  ] });
}
var CHART_W = 640;
function niceMax(max) {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const normalized = max / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}
function LineChart({
  points,
  height = 150,
  format
}) {
  const t = useT();
  if (points.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "tm-chart-empty", children: t("chart.empty") });
  const padding = { top: 10, right: 8, bottom: 20, left: 46 };
  const innerW = CHART_W - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const max = niceMax(Math.max(...points.map((point) => point.value), 1));
  if (points.length === 1) {
    const only = points[0];
    const cx = padding.left + innerW / 2;
    const cy = padding.top + innerH / 2;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { className: "tm-chart", viewBox: "0 0 " + CHART_W + " " + height, role: "img", "aria-label": t("chart.trend"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { className: "tm-grid", x1: padding.left, y1: padding.top + innerH, x2: padding.left + innerW, y2: padding.top + innerH }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { className: "tm-dot", cx, cy, r: 3.5, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("title", { children: only.tip ?? only.label + ": " + format(only.value) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", { className: "tm-axis-label", x: cx, y: cy - 9, textAnchor: "middle", children: format(only.value) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", { className: "tm-axis", x: cx, y: height - 6, textAnchor: "middle", children: only.label })
    ] });
  }
  const stepX = innerW / (points.length - 1);
  const xOf = (index) => padding.left + index * stepX;
  const yOf = (value) => padding.top + innerH - value / max * innerH;
  const line = points.map((point, index) => (index === 0 ? "M" : "L") + xOf(index).toFixed(1) + " " + yOf(point.value).toFixed(1)).join(" ");
  const area = line + " L" + (padding.left + innerW).toFixed(1) + " " + (padding.top + innerH).toFixed(1) + " L" + padding.left.toFixed(1) + " " + (padding.top + innerH).toFixed(1) + " Z";
  const gridValues = [0, 0.5, 1];
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { className: "tm-chart", viewBox: "0 0 " + CHART_W + " " + height, role: "img", "aria-label": t("chart.trend"), children: [
    gridValues.map((ratio) => {
      const y = padding.top + innerH * (1 - ratio);
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { className: "tm-grid", x1: padding.left, y1: y, x2: padding.left + innerW, y2: y }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", { className: "tm-axis", x: padding.left - 5, y: y + 3, textAnchor: "end", children: format(max * ratio) })
      ] }, ratio);
    }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { className: "tm-area", d: area }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { className: "tm-line", d: line }),
    points.map((point, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { className: "tm-dot", cx: xOf(index), cy: yOf(point.value), r: 2.2, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("title", { children: point.tip ?? point.label + ": " + format(point.value) }) }),
      index % labelEvery === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", { className: "tm-axis", x: xOf(index), y: height - 6, textAnchor: "middle", children: point.label }) : null
    ] }, point.label + String(index)))
  ] });
}
function BarChart({
  points,
  height = 130,
  format
}) {
  const t = useT();
  if (points.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "tm-chart-empty", children: t("chart.empty") });
  const padding = { top: 10, right: 8, bottom: 20, left: 40 };
  const innerW = CHART_W - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const max = niceMax(Math.max(...points.map((point) => point.value), 1));
  const slot = innerW / points.length;
  const barW = Math.max(2, Math.min(26, slot * 0.55));
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { className: "tm-chart", viewBox: "0 0 " + CHART_W + " " + height, role: "img", "aria-label": t("chart.calls"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { className: "tm-grid", x1: padding.left, y1: padding.top + innerH, x2: padding.left + innerW, y2: padding.top + innerH }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", { className: "tm-axis", x: padding.left - 5, y: padding.top + 4, textAnchor: "end", children: format(max) }),
    points.map((point, index) => {
      const barH = max > 0 ? point.value / max * innerH : 0;
      const x = padding.left + slot * index + (slot - barW) / 2;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "rect",
          {
            className: "tm-bar",
            x,
            y: padding.top + innerH - barH,
            width: barW,
            height: Math.max(barH, 0.6),
            rx: 2,
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("title", { children: point.tip ?? point.label + ": " + format(point.value) })
          }
        ),
        index % labelEvery === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", { className: "tm-axis", x: x + barW / 2, y: height - 6, textAnchor: "middle", children: point.label }) : null
      ] }, point.label + String(index));
    })
  ] });
}
var DONUT_RADIUS = 42;
var DONUT_STROKE = 13;
var DONUT_CIRC = 2 * Math.PI * DONUT_RADIUS;
function Donut({
  items,
  size = 132,
  format
}) {
  const t = useT();
  const total = items.reduce((sum, item) => sum + (Number.isFinite(item.value) ? item.value : 0), 0);
  if (items.length === 0 || total <= 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "tm-chart-empty", children: t("chart.empty") });
  let offset = 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "tm-donut", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "tm-donut-chart", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { className: "tm-chart", viewBox: "0 0 110 110", width: size, height: size, role: "img", "aria-label": t("chart.share"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { className: "tm-donut-track", cx: "55", cy: "55", r: DONUT_RADIUS, fill: "none", strokeWidth: DONUT_STROKE }),
      items.map((item, index) => {
        const ratio = item.value / total;
        const length = Math.max(0, ratio * DONUT_CIRC - 1.5);
        const dash = length.toFixed(2) + " " + (DONUT_CIRC - length).toFixed(2);
        const rotation = offset / total * 360 - 90;
        offset += item.value;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "circle",
          {
            className: "tm-donut-seg tm-fill-" + String(index % 5 + 1),
            cx: "55",
            cy: "55",
            r: DONUT_RADIUS,
            fill: "none",
            strokeWidth: DONUT_STROKE,
            strokeDasharray: dash,
            transform: "rotate(" + rotation.toFixed(2) + " 55 55)",
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("title", { children: item.label + ": " + format(item.value) + " (" + (ratio * 100).toFixed(1) + "%)" })
          },
          item.label + String(index)
        );
      })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "tm-legend", children: items.map((item, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { className: "tm-legend-item", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "tm-legend-dot tm-dot-" + String(index % 5 + 1), "aria-hidden": "true" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "tm-legend-name", title: item.label, children: item.label }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "tm-legend-value", children: format(item.value) })
    ] }, item.label + String(index))) })
  ] });
}
function Modal({
  title,
  help,
  onClose,
  children,
  footer
}) {
  const t = useT();
  (0, import_react.useEffect)(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "tm-modal-backdrop", role: "presentation", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      className: "tm-modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": title,
      onClick: (event) => event.stopPropagation(),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "tm-modal-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "tm-section-title", children: [
            title,
            help ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Help, { text: help, label: t("common.help") }) : null
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "tm-row-end", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { size: "sm", onClick: onClose, children: t("common.cancel") }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "tm-modal-body", children }),
        footer ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", { className: "tm-modal-foot", children: footer }) : null
      ]
    }
  ) });
}
function Textarea({
  value,
  onChange,
  ariaLabel,
  rows,
  placeholder,
  className
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "textarea",
    {
      className: "tm-textarea" + (className ? " " + className : ""),
      "aria-label": ariaLabel,
      rows: rows ?? 3,
      value,
      placeholder,
      onChange: (event) => onChange(event.target.value)
    }
  );
}

// src/client/cache.tsx
var import_react4 = require("react");

// src/client/format.ts
var DASH = "\u2014";
function formatTokens(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DASH;
  if (value < 1e3) return String(Math.round(value));
  if (value < 1e6) return (value / 1e3).toFixed(value < 1e4 ? 2 : 1) + "K";
  return (value / 1e6).toFixed(2) + "M";
}
function formatExact(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DASH;
  return String(Math.round(value));
}
function formatCost(value, noPriceText) {
  if (typeof value !== "number" || !Number.isFinite(value)) return noPriceText;
  if (value === 0) return "0";
  if (Math.abs(value) < 1e-4) return value.toFixed(6);
  if (Math.abs(value) < 1) return value.toFixed(4);
  return value.toFixed(2);
}
function formatRate(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DASH;
  const percent = value <= 1 ? value * 100 : value;
  return percent.toFixed(1) + "%";
}
function formatPercentile(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DASH;
  return value.toFixed(0);
}
function formatDuration(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return DASH;
  if (ms < 1e3) return Math.round(ms) + "ms";
  if (ms < 6e4) return (ms / 1e3).toFixed(1) + "s";
  const minutes = Math.floor(ms / 6e4);
  const seconds = Math.round(ms % 6e4 / 1e3);
  return String(minutes) + "m" + String(seconds).padStart(2, "0") + "s";
}
function pad2(value) {
  return String(value).padStart(2, "0");
}
function formatDateTime(ts) {
  if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0) return DASH;
  const date = new Date(ts);
  return String(date.getFullYear()) + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate()) + " " + pad2(date.getHours()) + ":" + pad2(date.getMinutes()) + ":" + pad2(date.getSeconds());
}
function startOfToday(now = Date.now()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
function daysAgo(days, now = Date.now()) {
  return now - days * 24 * 60 * 60 * 1e3;
}
function truncate(text, limit) {
  if (!text) return "";
  const value = text.replace(/\s+/g, " ").trim();
  return value.length <= limit ? value : value.slice(0, Math.max(0, limit - 1)) + "\u2026";
}
function modelLabel(provider, model, unknownLabel) {
  if (model && provider) return provider + " / " + model;
  return model ?? provider ?? unknownLabel;
}
function taskLabel(taskName, taskId, untitledLabel) {
  if (taskName && taskName.trim().length > 0) return taskName;
  if (taskId) return "#" + taskId;
  return untitledLabel;
}
function taskTypeLabel(taskType, t) {
  if (!taskType) return t("common.unknown");
  return t("type." + taskType);
}
function withCount(t, key, count) {
  return t(key).split("{n}").join(String(count));
}
function formatBytes(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return DASH;
  if (value < 1024) return String(Math.round(value)) + " B";
  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return size.toFixed(size >= 100 ? 0 : 1) + " " + units[index];
}
function formatRatio(ratio) {
  if (typeof ratio !== "number" || !Number.isFinite(ratio)) return DASH;
  return (ratio * 100).toFixed(1) + "%";
}
function downloadText(filename, contentType, content) {
  const blob = new Blob([content], { type: contentType || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2e3);
}
function formatShortDateTime(ts) {
  if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0) return DASH;
  const date = new Date(ts);
  return pad2(date.getMonth() + 1) + "-" + pad2(date.getDate()) + " " + pad2(date.getHours()) + ":" + pad2(date.getMinutes());
}

// src/client/use-api.ts
var import_react2 = require("react");
function errorText(error, t) {
  if (error instanceof ApiError) {
    if (error.code === "network") return t("error.network");
    return error.message || t("error.generic");
  }
  if (error instanceof Error && error.message) return error.message;
  return t("error.generic");
}
function useResource(load, deps, t) {
  const [status, setStatus] = (0, import_react2.useState)("loading");
  const [data, setData] = (0, import_react2.useState)(null);
  const [error, setError] = (0, import_react2.useState)(null);
  const [nonce, setNonce] = (0, import_react2.useState)(0);
  const loadRef = (0, import_react2.useRef)(load);
  loadRef.current = load;
  const tRef = (0, import_react2.useRef)(t);
  tRef.current = t;
  const key = deps.map((dep) => dep === null || dep === void 0 ? "" : String(dep)).join("|");
  (0, import_react2.useEffect)(() => {
    const controller = new AbortController();
    let alive = true;
    setStatus("loading");
    setError(null);
    loadRef.current(controller.signal).then(
      (value) => {
        if (!alive) return;
        setData(value);
        setStatus("ready");
      },
      (reason) => {
        if (!alive) return;
        if (reason?.name === "AbortError") return;
        setError(errorText(reason, tRef.current));
        setStatus("error");
      }
    );
    return () => {
      alive = false;
      controller.abort();
    };
  }, [key, nonce]);
  const reload = (0, import_react2.useCallback)(() => setNonce((value) => value + 1), []);
  return { status, data, error, reload };
}
function useMutation(t) {
  const [pending, setPending] = (0, import_react2.useState)(false);
  const [error, setError] = (0, import_react2.useState)(null);
  const tRef = (0, import_react2.useRef)(t);
  tRef.current = t;
  const run = (0, import_react2.useCallback)(async (task) => {
    setPending(true);
    setError(null);
    try {
      await task();
      return true;
    } catch (reason) {
      setError(errorText(reason, tRef.current));
      return false;
    } finally {
      setPending(false);
    }
  }, []);
  const reset = (0, import_react2.useCallback)(() => setError(null), []);
  return { pending, error, reset, run };
}

// src/client/viewer.tsx
var import_react3 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var PAGE_BYTES = 8192;
function BlobViewer({
  api,
  entry,
  onClose
}) {
  const t = useT();
  const [offset, setOffset] = (0, import_react3.useState)(0);
  const readable = entry.recoverable && entry.blobId !== null;
  const resource = useResource(
    (signal) => readable && entry.blobId ? api.cacheRead(
      { blobId: entry.blobId, sessionId: entry.sessionId, offset, limit: PAGE_BYTES },
      signal
    ) : Promise.resolve(null),
    [entry.blobId, entry.sessionId, offset, readable],
    t
  );
  (0, import_react3.useEffect)(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  const data = resource.data;
  const content = data?.content ?? "";
  const startByte = data?.offset ?? offset;
  const byteLength = content.length > 0 ? new TextEncoder().encode(content).length : 0;
  const endByte = startByte + byteLength;
  const totalBytes = data?.totalBytes ?? entry.originalSize;
  const nextOffset = data?.nextOffset ?? null;
  const summary = entry.summary ?? (content ? truncate(content, 180) : t("cache.viewer.summaryEmpty"));
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "tm-drawer-backdrop", role: "presentation", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "aside",
    {
      className: "tm-drawer",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": t("cache.viewer.title"),
      onClick: (event) => event.stopPropagation(),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("header", { className: "tm-drawer-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "tm-section-title", children: [
            t("cache.viewer.title"),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Help, { text: t("cache.help.viewer"), label: t("common.help") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "tm-row-end", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { size: "sm", onClick: onClose, children: t("cache.viewer.close") }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "tm-drawer-body", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("dl", { className: "tm-kv", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t("cache.viewer.blobId") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { className: "tm-mono", children: entry.blobId ?? "\u2014" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t("cache.viewer.hash") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { className: "tm-mono", children: entry.hash ?? "\u2014" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t("cache.viewer.size") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("dd", { children: [
              formatBytes(entry.originalSize),
              entry.compressedSize !== null ? " \u2192 " + formatBytes(entry.compressedSize) : ""
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t("cache.viewer.type") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("dd", { children: [
              entry.compressionType ?? "\u2014",
              entry.contentType ? " \xB7 " + entry.contentType : ""
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t("cache.viewer.tool") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { children: entry.toolName }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t("cache.viewer.session") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { className: "tm-mono", children: entry.sessionId ?? "\u2014" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t("cache.viewer.time") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { children: formatDateTime(entry.createdAt) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: t("cache.viewer.summary") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { children: summary })
          ] }),
          !readable ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Empty, { text: t("cache.viewer.notRecoverable") }) : null,
          readable && resource.status === "loading" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Loading, {}) : null,
          readable && resource.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ErrorBox, { message: resource.error ?? t("error.generic"), onRetry: resource.reload }) : null,
          readable && resource.status === "ready" ? content.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("pre", { className: "tm-viewer-pre", children: content }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Empty, { text: t("cache.viewer.emptyContent") }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("footer", { className: "tm-drawer-foot", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
            t("cache.viewer.range"),
            " ",
            String(startByte),
            " \u2013 ",
            String(endByte)
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
            t("cache.viewer.total"),
            " ",
            formatBytes(totalBytes)
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "tm-row-end", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              Button,
              {
                size: "sm",
                onClick: () => setOffset(Math.max(0, startByte - PAGE_BYTES)),
                disabled: !readable || startByte <= 0,
                children: t("cache.viewer.prev")
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              Button,
              {
                size: "sm",
                onClick: () => {
                  if (nextOffset !== null) setOffset(nextOffset);
                },
                disabled: !readable || nextOffset === null,
                children: t("cache.viewer.next")
              }
            )
          ] })
        ] })
      ]
    }
  ) });
}

// src/client/cache.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var PAGE_SIZE = 50;
var MODES = ["off", "observe", "on"];
function modeLabel(mode, t) {
  return MODES.indexOf(mode) >= 0 ? t("cache.mode." + mode) : mode;
}
function CachePage({ api, refreshTick }) {
  const t = useT();
  const [tool, setTool] = (0, import_react4.useState)("");
  const [recoverable, setRecoverable] = (0, import_react4.useState)("");
  const [page, setPage] = (0, import_react4.useState)(1);
  const [selected, setSelected] = (0, import_react4.useState)(null);
  const statsResource = useResource((signal) => api.cacheStats(signal), [refreshTick], t);
  const listResource = useResource(
    (signal) => api.cacheList(
      {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        tool: tool.trim() || void 0,
        recoverable: recoverable === "" ? void 0 : recoverable === "true"
      },
      signal
    ),
    [tool, recoverable, page, refreshTick],
    t
  );
  const stats = statsResource.data;
  const rows = listResource.data?.rows ?? [];
  const total = listResource.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const ratio = stats && stats.totalOriginalBytes > 0 ? stats.savedBytes / stats.totalOriginalBytes : null;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "tm-stack", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "tm-cards tm-cards-4", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Card, { label: t("cache.cards.entries"), value: String(stats?.blobs ?? 0), help: t("cache.help.entries") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        Card,
        {
          label: t("cache.cards.original"),
          value: formatBytes(stats?.totalOriginalBytes ?? 0),
          help: t("cache.help.original")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        Card,
        {
          label: t("cache.cards.compressed"),
          value: formatBytes(stats?.totalCompressedBytes ?? 0),
          help: t("cache.help.compressed")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        Card,
        {
          label: t("cache.cards.saved"),
          value: formatBytes(stats?.savedBytes ?? 0),
          hint: formatRatio(ratio),
          tone: ratio !== null && ratio > 0 ? "ok" : "default",
          help: t("cache.help.saved")
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "tm-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "tm-label", children: t("cache.filter.tool") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        Input,
        {
          ariaLabel: t("cache.filter.tool"),
          className: "tm-input-mid",
          placeholder: t("cache.filter.toolPlaceholder"),
          value: tool,
          onChange: (value) => {
            setTool(value);
            setPage(1);
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "tm-label", children: t("cache.filter.recoverable") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        Chips,
        {
          value: recoverable,
          ariaLabel: t("cache.filter.recoverable"),
          options: [
            { value: "", label: t("cache.filter.all") },
            { value: "true", label: t("cache.filter.recoverableOnly") },
            { value: "false", label: t("cache.filter.notRecoverable") }
          ],
          onChange: (value) => {
            setRecoverable(value);
            setPage(1);
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "tm-label", children: [
        t("cache.dedupe"),
        " ",
        String(stats?.dedupeCount ?? 0)
      ] }),
      stats && stats.missingBlobs > 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Pill, { tone: "warn", children: [
        t("cache.missingWarn"),
        " ",
        String(stats.missingBlobs)
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "tm-row-end", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Help, { text: t("cache.help.table"), label: t("common.help") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Pager, { page, pageCount, total, onPage: setPage })
      ] })
    ] }),
    statsResource.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ErrorBox, { message: statsResource.error ?? t("error.generic"), onRetry: statsResource.reload }) : null,
    listResource.status === "loading" && listResource.data === null ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Loading, {}) : null,
    listResource.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ErrorBox, { message: listResource.error ?? t("error.generic"), onRetry: listResource.reload }) : null,
    listResource.status === "ready" && total === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Empty, { text: t("cache.empty") }) : null,
    total > 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "tm-tablewrap", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("table", { className: "tm-table", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("th", { children: t("cache.table.tool") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("th", { className: "tm-num", children: t("cache.table.original") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("th", { className: "tm-num", children: t("cache.table.compressed") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("th", { children: t("cache.table.compression") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("th", { children: t("cache.table.mode") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("th", { children: t("cache.table.session") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("th", { children: t("cache.table.time") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("th", { children: t("cache.table.recoverable") })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("tbody", { children: rows.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "tr",
        {
          className: "tm-clickable",
          title: t("cache.openViewer"),
          onClick: () => setSelected(row),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("td", { children: row.toolName }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("td", { className: "tm-num", children: formatBytes(row.originalSize) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("td", { className: "tm-num", children: row.compressedSize === null ? "\u2014" : formatBytes(row.compressedSize) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("td", { children: row.compressionType ?? "\u2014" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("td", { children: modeLabel(row.mode, t) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("td", { className: "tm-mono", title: row.sessionId ?? "", children: row.sessionId ?? "\u2014" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("td", { children: formatDateTime(row.createdAt) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("td", { children: row.recoverable ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Pill, { tone: "ok", children: t("cache.recoverable.yes") }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Pill, { children: t("cache.recoverable.no") }) })
          ]
        },
        String(row.id) + ":" + String(index)
      )) })
    ] }) }) : null,
    selected ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(BlobViewer, { api, entry: selected, onClose: () => setSelected(null) }) : null
  ] });
}

// src/client/context.tsx
var import_react5 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
var ROLE_ORDER = ["system", "developer", "user", "assistant", "tool"];
var KIND_ORDER = ["tool-result", "file-content"];
var MAX_CANDIDATES = 20;
function roleLabel(role, t) {
  return ROLE_ORDER.indexOf(role) >= 0 ? t("context.role." + role) : truncate(role, 24);
}
function kindLabel(kind, t) {
  return KIND_ORDER.indexOf(kind) >= 0 ? t("context.kind." + kind) : truncate(kind, 24);
}
function riskLabel(verdict, t) {
  if (!verdict) return t("context.risk.unknown");
  return verdict === "safe" || verdict === "risky" || verdict === "unknown" ? t("context.risk." + verdict) : truncate(verdict, 16);
}
function modeLabel2(mode, t) {
  return mode === "off" || mode === "dry-run" ? t("context.mode." + mode) : truncate(mode, 16);
}
function riskTone(verdict) {
  if (verdict === "safe") return "ok";
  if (verdict === "risky") return "high";
  return "default";
}
function isProtectedSource(source) {
  if (CONTEXT_PROTECTED_SOURCES.indexOf(source) >= 0) return true;
  return source.toLowerCase().indexOf("mnemon") >= 0;
}
function ContextPage({ api, refreshTick }) {
  const t = useT();
  const [sessionId, setSessionId] = (0, import_react5.useState)("");
  const [tick, setTick] = (0, import_react5.useState)(0);
  const [historyVersion, setHistoryVersion] = (0, import_react5.useState)(0);
  const [expanded, setExpanded] = (0, import_react5.useState)([]);
  const [recordNote, setRecordNote] = (0, import_react5.useState)(null);
  const mutation = useMutation(t);
  const sessionsResource = useResource((signal) => api.sessions(50, signal), [refreshTick], t);
  const analysisResource = useResource(
    (signal) => api.contextAnalyze({ sessionId: sessionId || void 0 }, signal),
    [sessionId, refreshTick, tick],
    t
  );
  const historyResource = useResource(
    (signal) => api.optimizationsList({ sessionId: sessionId || void 0, limit: 20 }, signal),
    [sessionId, refreshTick, historyVersion],
    t
  );
  const analysis = analysisResource.data;
  const history = historyResource.data;
  const sessionOptions = [
    { value: "", label: t("context.sessionDefault") }
  ].concat(
    (sessionsResource.data ?? []).filter((row) => !row.isSubagent).slice().sort((left, right) => right.lastSeenAt - left.lastSeenAt).map((row) => ({
      value: row.sessionId,
      label: truncate(row.sessionId, 18) + " \xB7 " + formatDateTime(row.lastSeenAt)
    }))
  );
  const toggleCandidate = (key) => {
    setExpanded(
      (current) => current.indexOf(key) >= 0 ? current.filter((item) => item !== key) : current.concat([key])
    );
  };
  const recordDryRun = () => {
    setRecordNote(null);
    void mutation.run(async () => {
      const result = await api.contextOptimize({ sessionId: sessionId || void 0 });
      setRecordNote(withCount(t, "context.recordedNote", result.recorded));
      setHistoryVersion((value) => value + 1);
      setTick((value) => value + 1);
    });
  };
  const candidates = analysis ? analysis.candidates.slice(0, MAX_CANDIDATES) : [];
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "tm-stack", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "tm-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "tm-label", children: t("context.sessionLabel") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        Select,
        {
          value: sessionId,
          ariaLabel: t("context.sessionLabel"),
          className: "tm-select-fix",
          options: sessionOptions,
          onChange: (value) => setSessionId(value)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { onClick: () => setTick((value) => value + 1), children: t("context.refreshAnalysis") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Help, { text: t("context.help.page"), label: t("common.help") }),
      analysis ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Pill, { tone: analysis.mode === "off" ? "default" : "info", children: modeLabel2(analysis.mode, t) }),
        analysis.readOnly ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Pill, { tone: "ok", children: t("context.readOnly") }) : null
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "tm-row-end tm-note", children: mutation.error ?? recordNote ?? "" })
    ] }),
    analysisResource.status === "loading" && analysis === null ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Loading, {}) : null,
    analysisResource.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ErrorBox, { message: analysisResource.error ?? t("error.generic"), onRetry: analysisResource.reload }) : null,
    analysis && !analysis.found ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Empty, { text: t("context.emptySession") }) : null,
    analysis && analysis.found ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "tm-cards tm-cards-4", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Card, { label: t("context.cards.nodes"), value: formatExact(analysis.surface.nodes), help: t("context.help.nodes") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          Card,
          {
            label: t("context.cards.tokens"),
            value: formatTokens(analysis.surface.tokens),
            hint: formatExact(analysis.surface.tokens),
            help: t("context.help.tokens")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          Card,
          {
            label: t("context.cards.candidates"),
            value: formatExact(analysis.totals.candidateCount),
            hint: analysis.totals.riskyCount > 0 ? t("context.cards.riskyHint") + " " + String(analysis.totals.riskyCount) : void 0,
            tone: analysis.totals.riskyCount > 0 ? "warn" : "default",
            help: t("context.help.candidates")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          Card,
          {
            label: t("context.cards.savings"),
            value: formatTokens(analysis.totals.potentialSavingsTokens),
            hint: formatExact(analysis.totals.potentialSavingsTokens),
            help: t("context.help.savings")
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "tm-cols", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Section, { title: t("context.section.composition"), help: t("context.help.composition"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "tm-label", children: t("context.roleBar") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(RoleBar, { metrics: analysis.surface.byRole }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "tm-label", children: t("context.sources") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SourceList, { metrics: analysis.surface.bySource })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          Section,
          {
            title: t("context.section.candidates"),
            help: t("context.help.candidateTable"),
            actions: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "tm-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "tm-note", children: [
                t("context.totalRows"),
                " ",
                formatExact(analysis.totals.candidateCount)
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                Button,
                {
                  variant: "primary",
                  size: "sm",
                  onClick: recordDryRun,
                  disabled: mutation.pending || analysis.candidates.length === 0,
                  children: t("context.recordDryRun")
                }
              )
            ] }),
            children: candidates.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Empty, { text: t("context.emptyCandidates") }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "tm-tablewrap", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("table", { className: "tm-table", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("tr", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: t("context.table.kind") }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: t("context.table.subject") }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { className: "tm-num", children: t("context.table.occurrences") }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { className: "tm-num", children: t("context.table.removable") }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: t("context.table.risk") }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: t("context.table.advice") })
              ] }) }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("tbody", { children: candidates.map((candidate, index) => {
                const key = candidate.contentHash ?? String(index);
                const open = expanded.indexOf(key) >= 0;
                return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                  CandidateRow,
                  {
                    candidate,
                    open,
                    onToggle: () => toggleCandidate(key),
                    t
                  },
                  key
                );
              }) })
            ] }) })
          }
        )
      ] })
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Section, { title: t("context.section.history"), help: t("context.help.history"), children: [
      historyResource.status === "loading" && history === null ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Loading, {}) : null,
      historyResource.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ErrorBox, { message: historyResource.error ?? t("error.generic"), onRetry: historyResource.reload }) : null,
      history && history.rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Empty, { text: t("context.emptyHistory") }) : null,
      history && history.rows.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "tm-tablewrap", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("table", { className: "tm-table", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: t("context.history.time") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: t("context.history.type") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { className: "tm-num", children: t("context.history.original") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { className: "tm-num", children: t("context.history.optimized") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { className: "tm-num", children: t("context.history.savings") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: t("context.history.cacheImpact") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: t("context.history.status") })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("tbody", { children: history.rows.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: formatDateTime(row.createdAt) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: row.optimizationType }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { className: "tm-num", children: formatTokens(row.originalTokensEstimated) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { className: "tm-num", children: formatTokens(row.optimizedTokensEstimated) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { className: "tm-num", children: formatTokens(row.estimatedSavings) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: row.cacheImpact ?? "\u2014" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("td", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Pill, { children: row.status }),
            row.verified ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "tm-dim", children: [
              " \xB7 ",
              t("context.verified")
            ] }) : null
          ] })
        ] }, String(row.id) + ":" + String(index))) })
      ] }) }) : null
    ] })
  ] });
}
function CandidateRow({
  candidate,
  open,
  onToggle,
  t
}) {
  const risk = candidate.cacheRisk;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("tr", { className: "tm-clickable", onClick: onToggle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: kindLabel(candidate.kind, t) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { title: candidate.subject, children: truncate(candidate.subject, 48) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { className: "tm-num", children: formatExact(candidate.occurrences.length) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { className: "tm-num", children: formatTokens(candidate.removableTokens) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("td", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { title: risk.reason, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Pill, { tone: riskTone(risk.verdict), children: riskLabel(risk.verdict, t) }) }),
        risk.reason ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "tm-dim", title: risk.reason, children: [
          " \xB7 ",
          truncate(risk.reason, 22)
        ] }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: candidate.recommend ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Pill, { tone: "ok", children: t("context.advice.recommend") }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "tm-dim", children: t("context.advice.avoid") }) })
    ] }),
    open ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { colSpan: 6, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "tm-occ", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "tm-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "tm-label", children: t("context.occ.title") }),
        risk.verdict ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "tm-note", children: [
          t("context.occ.riskLine"),
          " ",
          risk.reason || "\u2014"
        ] }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("table", { className: "tm-table tm-table-plain", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { className: "tm-num", children: t("context.occ.seq") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { className: "tm-num", children: t("context.occ.turn") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { className: "tm-num", children: t("context.occ.step") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: t("context.occ.role") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: t("context.occ.source") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { className: "tm-num", children: t("context.occ.tokens") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { className: "tm-num", children: t("context.occ.bytes") })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("tbody", { children: candidate.occurrences.map((occ, index) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { className: "tm-num", children: formatExact(occ.seq) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { className: "tm-num", children: occ.turn === null ? "\u2014" : formatExact(occ.turn) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { className: "tm-num", children: occ.step === null ? "\u2014" : formatExact(occ.step) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: roleLabel(occ.role, t) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: occ.source }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { className: "tm-num", children: formatTokens(occ.tokens) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { className: "tm-num", children: formatExact(occ.bytes) })
        ] }, String(occ.seq) + ":" + String(index))) })
      ] }),
      candidate.note ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "tm-note", children: candidate.note }) : null,
      risk.extraCost !== null || risk.savingCost !== null ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "tm-note", children: [
        t("context.occ.costLine"),
        " ",
        formatCost(risk.savingCost, t("common.noPrice")),
        " /",
        " ",
        formatCost(risk.extraCost, t("common.noPrice"))
      ] }) : null
    ] }) }) }) : null
  ] });
}
function RoleBar({ metrics }) {
  const t = useT();
  const total = metrics.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Empty, { text: t("context.emptyComposition") });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "tm-stack", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "tm-stackbar", children: metrics.map((item, index) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "span",
      {
        className: "tm-stackbar-seg tm-dot-" + String(index % 5 + 1),
        style: { width: item.value / total * 100 + "%" },
        title: roleLabel(item.key, t) + ": " + formatExact(item.value)
      },
      item.key
    )) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("ul", { className: "tm-legend", children: metrics.map((item, index) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("li", { className: "tm-legend-item", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "tm-legend-dot tm-dot-" + String(index % 5 + 1), "aria-hidden": "true" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "tm-legend-name", children: roleLabel(item.key, t) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "tm-legend-value", children: [
        formatTokens(item.value),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "tm-dim", children: [
          " \xB7 ",
          (item.value / total * 100).toFixed(1),
          "%"
        ] })
      ] })
    ] }, item.key)) })
  ] });
}
function SourceList({ metrics }) {
  const t = useT();
  if (metrics.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Empty, { text: t("context.emptyComposition") });
  const total = metrics.reduce((sum, item) => sum + item.value, 0);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("ul", { className: "tm-source-list", children: metrics.map((item) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("li", { className: "tm-source-item", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "tm-source-name", title: item.key, children: truncate(item.key, 28) }),
    isProtectedSource(item.key) ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Pill, { tone: "ok", children: t("context.protected") }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "tm-source-value", children: [
      formatTokens(item.value),
      total > 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "tm-dim", children: [
        " \xB7 ",
        (item.value / total * 100).toFixed(1),
        "%"
      ] }) : null
    ] })
  ] }, item.key)) });
}

// src/client/calls.tsx
var import_react6 = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
var PAGE_SIZE2 = 50;
var RANGE_VALUES = ["all", "today", "7", "30"];
function CallsPage({ api, refreshTick }) {
  const t = useT();
  const [range, setRange] = (0, import_react6.useState)("all");
  const [model, setModel] = (0, import_react6.useState)("");
  const [taskId, setTaskId] = (0, import_react6.useState)("");
  const [onlyFlagged, setOnlyFlagged] = (0, import_react6.useState)(false);
  const [sort, setSort] = (0, import_react6.useState)("ts");
  const [order, setOrder] = (0, import_react6.useState)("desc");
  const [page, setPage] = (0, import_react6.useState)(1);
  const filterResource = useResource(
    async (signal) => {
      const [tasks, overview] = await Promise.all([
        api.tasks({ limit: 100 }, signal),
        api.overview({ range: "all", days: 30 }, signal)
      ]);
      const models = [];
      for (const row of overview.models) {
        const label = modelLabel(row.provider, row.model, "");
        if (label && models.indexOf(label) < 0) models.push(label);
      }
      return {
        tasks: tasks.rows.map((row) => ({ id: row.id, taskName: row.taskName })),
        models
      };
    },
    [refreshTick],
    t
  );
  const query = {
    limit: PAGE_SIZE2,
    offset: (page - 1) * PAGE_SIZE2,
    sort,
    order
  };
  if (range === "today") query.from = startOfToday();
  else if (range === "7") query.from = daysAgo(7);
  else if (range === "30") query.from = daysAgo(30);
  if (model) query.model = model;
  if (taskId) query.taskId = taskId;
  if (onlyFlagged) query.onlyFlagged = true;
  const resource = useResource(
    (signal) => api.calls(query, signal),
    [range, model, taskId, onlyFlagged, sort, order, page, refreshTick],
    t
  );
  const filters = filterResource.data;
  const rows = resource.data?.rows ?? [];
  const total = resource.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE2));
  const onSort = (key) => {
    if (sort === key) {
      setOrder(order === "desc" ? "asc" : "desc");
      return;
    }
    setSort(key);
    setOrder("desc");
    setPage(1);
  };
  const sortButton = (key, label) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { type: "button", className: "tm-sort", onClick: () => onSort(key), children: [
    label,
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "tm-sort-arrow", children: sort === key ? order === "desc" ? "\u25BC" : "\u25B2" : "\u2195" })
  ] });
  const exportQuery = { ...query };
  delete exportQuery.limit;
  delete exportQuery.offset;
  delete exportQuery.sort;
  delete exportQuery.order;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "tm-stack", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "tm-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "tm-label", children: t("calls.filter.range") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        Chips,
        {
          value: range,
          ariaLabel: t("calls.filter.range"),
          options: RANGE_VALUES.map((value) => ({ value, label: t("calls.range." + value) })),
          onChange: (value) => {
            setRange(value);
            setPage(1);
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        Select,
        {
          value: model,
          className: "tm-select-fix",
          ariaLabel: t("calls.filter.model"),
          options: [{ value: "", label: t("common.all") }].concat((filters?.models ?? []).map((value) => ({ value, label: value }))),
          onChange: (value) => {
            setModel(value);
            setPage(1);
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        Select,
        {
          value: taskId,
          className: "tm-select-fix",
          ariaLabel: t("calls.filter.task"),
          options: [{ value: "", label: t("common.allTasks") }].concat(
            (filters?.tasks ?? []).map((row) => ({ value: row.id, label: taskLabel(row.taskName, row.id, t("common.untitled")) }))
          ),
          onChange: (value) => {
            setTaskId(value);
            setPage(1);
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Switch, { checked: onlyFlagged, label: t("calls.filter.flaggedOnly"), onChange: (value) => {
        setOnlyFlagged(value);
        setPage(1);
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "tm-row-end", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Pager, { page, pageCount, total, onPage: setPage }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("a", { className: "tm-btn", href: api.exportCallsUrl(exportQuery), download: exportFileName(), children: t("common.exportCsv") })
      ] })
    ] }),
    resource.status === "loading" && resource.data === null ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Loading, {}) : null,
    resource.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ErrorBox, { message: resource.error ?? t("error.generic"), onRetry: resource.reload }) : null,
    resource.status === "ready" && total === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Empty, { text: t("calls.empty") }) : null,
    total > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "tm-tablewrap", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("table", { className: "tm-table", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { children: sortButton("ts", t("calls.table.time")) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { children: t("calls.table.model") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { children: t("calls.table.task") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { className: "tm-num", children: sortButton("inputTokens", t("calls.table.missInput")) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { className: "tm-num", children: t("calls.table.cacheRead") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { className: "tm-num", children: t("calls.table.cacheWrite") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { className: "tm-num", children: sortButton("outputTokens", t("calls.table.output")) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { className: "tm-num", children: sortButton("totalTokens", t("calls.table.total")) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { className: "tm-num", children: sortButton("cost", t("calls.table.cost")) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { className: "tm-num", children: t("calls.table.duration") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { children: t("calls.table.flag") })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("tbody", { children: rows.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { title: String(row.ts), children: formatDateTime(row.ts) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { title: modelLabel(row.provider, row.model, t("common.unknown")), children: modelLabel(row.provider, row.model, t("common.unknown")) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { title: taskLabel(row.taskName, row.taskId, t("common.untitled")), children: taskLabel(row.taskName, row.taskId, t("common.untitled")) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { className: "tm-num", title: formatExact(row.inputTokens), children: formatTokens(row.inputTokens) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { className: "tm-num", title: formatExact(row.cacheReadTokens), children: formatTokens(row.cacheReadTokens) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { className: "tm-num", title: formatExact(row.cacheWriteTokens), children: formatTokens(row.cacheWriteTokens) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { className: "tm-num", title: formatExact(row.outputTokens), children: formatTokens(row.outputTokens) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { className: "tm-num", title: formatExact(row.totalTokens), children: formatTokens(row.totalTokens) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { className: "tm-num", children: formatCost(row.cost, t("common.noPrice")) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { className: "tm-num", children: formatDuration(row.durationMs) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { children: row.flagged ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Pill, { tone: "warn", children: t("calls.flagged") }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "tm-dim", children: t("calls.normal") }) })
      ] }, row.id !== void 0 ? String(row.id) : row.sessionId + ":" + String(row.turn) + ":" + String(row.step) + ":" + String(index))) })
    ] }) }) : null
  ] });
}

// src/client/auto.tsx
var import_react_dom = require("react-dom");
var import_react7 = require("react");
var import_jsx_runtime6 = require("react/jsx-runtime");
var AUTO_POLL_MS = 5e3;
function readSelectionValue(value) {
  if (typeof value !== "object" || value === null) return null;
  const record = value;
  const provider = typeof record.provider === "string" ? record.provider : null;
  const model = typeof record.model === "string" ? record.model : null;
  if (!provider || !model) return null;
  const effort = typeof record.reasoningEffort === "string" ? record.reasoningEffort : null;
  return { provider, model, effort };
}
function readModelSelection(value) {
  if (typeof value !== "object" || value === null) return null;
  const record = value;
  return readSelectionValue(record.next) ?? readSelectionValue(record.lastUsed);
}
function effortLabel(t, effort) {
  if (!effort) return "";
  const key = "auto.effort." + effort;
  const value = t(key);
  return value === key ? effort.toUpperCase() : value;
}
function effortShort(t, effort) {
  if (!effort) return "";
  const key = "auto.effortShort." + effort;
  const value = t(key);
  return value === key ? effort.toUpperCase() : value;
}
function taskTypeLabel2(t, taskType) {
  if (!taskType) return t("common.unknown");
  const key = "type." + taskType;
  const value = t(key);
  return value === key ? taskType : value;
}
function modeLabel3(t, mode) {
  if (mode === "auto") return t("auto.mode.auto");
  if (mode === "manual") return t("auto.mode.manual");
  if (mode === "off") return t("auto.mode.off");
  return t("auto.mode.unknown");
}
function useAutoStatus(api, sessionId) {
  const [status, setStatus] = (0, import_react7.useState)(null);
  const [error, setError] = (0, import_react7.useState)(null);
  const [nonce, setNonce] = (0, import_react7.useState)(0);
  const t = useT();
  (0, import_react7.useEffect)(() => {
    if (!sessionId) {
      setStatus(null);
      return void 0;
    }
    let alive = true;
    const tick = async () => {
      try {
        const next = await api.autoStatus(sessionId);
        if (!alive) return;
        setStatus(next);
        setError(null);
      } catch (reason) {
        if (!alive) return;
        if (reason instanceof ApiError && (reason.status === 404 || reason.status === 503 || reason.code === "AUTO_UNAVAILABLE")) {
          setError(null);
        } else {
          setError(errorText(reason, t));
        }
      }
    };
    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, AUTO_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [api, sessionId, nonce, t]);
  const reload = (0, import_react7.useCallback)(() => setNonce((value) => value + 1), []);
  return { status, error, reload };
}
function useNoProjection(_key) {
  return void 0;
}
function AutoControl(props) {
  const fallbackT = useT();
  const t = props.translate ?? fallbackT;
  const api = props.api;
  const sessionId = props.sessionId;
  const useProjection = props.useProjection ?? useNoProjection;
  const projection = useProjection("modelSelection");
  const { status, error: statusError, reload: reloadStatus } = useAutoStatus(api, sessionId);
  const [pendingMode, setPendingMode] = (0, import_react7.useState)(null);
  const [menuOpen, setMenuOpen] = (0, import_react7.useState)(false);
  const [position, setPosition] = (0, import_react7.useState)(null);
  const [busy, setBusy] = (0, import_react7.useState)(false);
  const [note, setNote] = (0, import_react7.useState)(null);
  const keyboardOpenRef = (0, import_react7.useRef)(false);
  const buttonRef = (0, import_react7.useRef)(null);
  const menuRef = (0, import_react7.useRef)(null);
  const projected = readModelSelection(projection);
  const statusCurrent = status?.current ?? null;
  const provider = projected?.provider ?? statusCurrent?.provider ?? null;
  const model = projected?.model ?? statusCurrent?.model ?? null;
  const currentEffort = projected?.effort ?? statusCurrent?.effort ?? status?.task?.effort ?? null;
  const mode = pendingMode ?? status?.mode ?? null;
  const reasons = (0, import_react7.useMemo)(() => {
    const taskReasons = status?.task?.reasons ?? [];
    if (taskReasons.length > 0) return taskReasons;
    return status?.lastDecision?.reasons ?? [];
  }, [status]);
  const chipLabel = (0, import_react7.useMemo)(() => {
    const tier = effortShort(t, currentEffort);
    if (mode === "auto") return tier ? t("auto.mode.auto") + " \xB7 " + tier : t("auto.mode.auto");
    if (mode === "manual" || mode === "off") {
      return tier ? t("auto.mode.manual") + " \xB7 " + tier : t("auto.mode.manual");
    }
    return t("auto.mode.auto");
  }, [mode, currentEffort, t]);
  const chipTitle = reasons.length > 0 ? reasons.join("\uFF1B") : t("auto.chipTitle");
  (0, import_react7.useEffect)(() => {
    if (pendingMode === null || status === null) return;
    setPendingMode(null);
  }, [pendingMode, status]);
  const openMenu = () => {
    const element = buttonRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const width = 304;
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const below = window.innerHeight - rect.bottom - 12;
    if (below >= 320 || rect.top < 340) setPosition({ left, top: rect.bottom + 8 });
    else setPosition({ left, bottom: window.innerHeight - rect.top + 8 });
    setNote(null);
    setMenuOpen(true);
  };
  const toggleMenu = () => {
    if (menuOpen) setMenuOpen(false);
    else openMenu();
  };
  (0, import_react7.useEffect)(() => {
    if (!menuOpen) return void 0;
    const onPointer = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const onReflow = () => setMenuOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [menuOpen]);
  const chooseAuto = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      await api.autoEnable(true);
      setPendingMode("auto");
      reloadStatus();
      setMenuOpen(false);
    } catch (reason) {
      setNote(errorText(reason, t));
    } finally {
      setBusy(false);
    }
  };
  const chooseEffort = async (effort) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    let manualExited = false;
    let applied = false;
    try {
      if (sessionId) {
        try {
          await api.autoManual(sessionId);
          manualExited = true;
        } catch {
          manualExited = false;
        }
      }
      if (provider && model && props.selectEffort) {
        try {
          applied = await props.selectEffort({ provider, model, reasoningEffort: effort });
        } catch {
          applied = false;
        }
      }
      setPendingMode("manual");
      reloadStatus();
      if (applied) {
        setNote(null);
        setMenuOpen(false);
      } else if (manualExited) {
        setNote(t("auto.manualFallback"));
      } else {
        setNote(t("auto.manualFailed"));
      }
    } catch (reason) {
      setNote(errorText(reason, t));
    } finally {
      setBusy(false);
    }
  };
  const onMenuKeyDown = (event) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const items = Array.from(menuRef.current?.querySelectorAll("button:not(:disabled)") ?? []);
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement);
    let next = current;
    if (event.key === "ArrowDown") next = current < 0 ? 0 : (current + 1) % items.length;
    else if (event.key === "ArrowUp") next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else next = items.length - 1;
    event.preventDefault();
    items[next]?.focus();
  };
  (0, import_react7.useEffect)(() => {
    if (!menuOpen) return void 0;
    if (!keyboardOpenRef.current) return void 0;
    const timer = window.setTimeout(() => {
      menuRef.current?.querySelector(".tm-auto-option, .tm-auto-effort-option")?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [menuOpen]);
  const menu = menuOpen && position ? (0, import_react_dom.createPortal)(
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "div",
      {
        className: "tm-auto-menu",
        role: "menu",
        "aria-label": t("auto.menu.title"),
        ref: menuRef,
        style: position,
        onKeyDown: onMenuKeyDown,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-auto-menu-head", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-menu-title", children: t("auto.menu.title") }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Help, { text: t("auto.help"), label: t("common.help") }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "tm-auto-mode-pill", "data-mode": mode ?? "unknown", children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-dot", "aria-hidden": "true" }),
              modeLabel3(t, mode)
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-auto-group", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "tm-auto-group-title", children: t("auto.menu.groupAuto") }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
              "button",
              {
                type: "button",
                role: "menuitemradio",
                "aria-checked": mode === "auto",
                className: "tm-auto-option" + (mode === "auto" ? " is-active" : ""),
                disabled: busy,
                onClick: () => void chooseAuto(),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-option-icon", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(AutoGlyph, {}) }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "tm-auto-option-text", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-option-title", children: t("auto.menu.auto") }),
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-option-sub", children: t("auto.menu.autoHint") })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-option-check", "aria-hidden": "true", children: mode === "auto" ? "\u2713" : "" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-auto-group", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "tm-auto-group-title", children: t("auto.menu.manual") }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "tm-auto-effort-grid", children: EFFORT_LEVELS.map((effort) => {
              const checked = mode !== "auto" && currentEffort === effort;
              return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
                "button",
                {
                  type: "button",
                  role: "menuitemradio",
                  "aria-checked": checked,
                  className: "tm-auto-effort-option" + (checked ? " is-active" : ""),
                  disabled: busy,
                  title: effortLabel(t, effort),
                  onClick: () => void chooseEffort(effort),
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-effort-code", children: effort.toUpperCase() }),
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-effort-name", children: effortLabel(t, effort) })
                  ]
                },
                effort
              );
            }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-auto-group tm-auto-group-decision", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-auto-group-head", children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-group-title", children: t("auto.menu.decision") }),
              status?.task ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "tm-auto-decision-meta", children: [
                taskTypeLabel2(t, status.task.type),
                " \xB7 ",
                t("auto.menu.stage"),
                " ",
                String(status.task.stage)
              ] }) : null
            ] }),
            reasons.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("ul", { className: "tm-auto-reasons", children: reasons.slice(0, 3).map((reason, index) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("li", { children: reason }, reason + ":" + String(index))) }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-dim tm-auto-hint", children: status ? t("auto.menu.noDecision") : statusError ?? t("auto.menu.unavailable") }),
            busy ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-dim tm-auto-hint", children: t("auto.menu.working") }) : null,
            note ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-err tm-auto-hint", children: note }) : null
          ] })
        ]
      }
    ),
    document.body
  ) : null;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "tm-auto-control", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "button",
      {
        type: "button",
        className: "tm-auto-chip" + (mode === "auto" ? " is-auto" : ""),
        ref: buttonRef,
        "aria-haspopup": "menu",
        "aria-expanded": menuOpen,
        "aria-label": t("auto.menu.aria"),
        title: chipTitle,
        "data-mode": mode ?? "unknown",
        onClick: (event) => {
          keyboardOpenRef.current = event.detail === 0;
          toggleMenu();
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-chip-icon", "aria-hidden": "true", children: mode === "auto" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(AutoGlyph, {}) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ManualGlyph, {}) }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "tm-auto-chip-main", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-chip-mode", children: mode === "auto" ? t("auto.mode.auto") : mode === "manual" || mode === "off" ? t("auto.mode.manual") : t("auto.mode.auto") }),
            effortShort(t, currentEffort) ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "tm-auto-chip-tier", children: [
              "\xB7 ",
              effortShort(t, currentEffort)
            ] }) : null
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "svg",
            {
              className: "tm-auto-chip-caret",
              width: "9",
              height: "9",
              viewBox: "0 0 10 10",
              "aria-hidden": "true",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "1.4",
              strokeLinecap: "round",
              strokeLinejoin: "round",
              children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M2.5 4L5 6.5L7.5 4" })
            }
          )
        ]
      }
    ),
    menu
  ] });
}
function AutoGlyph() {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.15", strokeLinecap: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M6 1.6v1.7M6 8.7v1.7M1.6 6h1.7M8.7 6h1.7" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M2.9 2.9l1.2 1.2M7.9 7.9l1.2 1.2M9.1 2.9L7.9 4.1M4.1 7.9l-1.2 1.2" })
  ] });
}
function ManualGlyph() {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.15", strokeLinecap: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M2 4h8M2 8h8" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("circle", { cx: "4.4", cy: "4", r: "1.2", fill: "currentColor", stroke: "none" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("circle", { cx: "7.6", cy: "8", r: "1.2", fill: "currentColor", stroke: "none" })
  ] });
}
function readAutoSettings(settings) {
  const raw = settings && typeof settings.auto === "object" && settings.auto !== null ? settings.auto : {};
  const bool = (key, fallback) => typeof raw[key] === "boolean" ? raw[key] : fallback;
  const num = (key, fallback) => {
    const value = raw[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };
  const initialRaw = typeof raw.initial === "object" && raw.initial !== null ? raw.initial : {};
  const initial = {};
  for (const type of AUTO_TASK_TYPES) {
    const value = initialRaw[type];
    initial[type] = value === "off" || value === "low" ? value : AUTO_DEFAULTS.initial[type];
  }
  const maxInitialRaw = raw.maxInitial;
  const maxInitial = maxInitialRaw === "off" || maxInitialRaw === "low" ? maxInitialRaw : AUTO_DEFAULTS.maxInitial;
  return {
    enabled: bool("enabled", AUTO_DEFAULTS.enabled),
    includeSubagents: bool("includeSubagents", AUTO_DEFAULTS.includeSubagents),
    initial,
    maxInitial,
    reasoningFailuresToEscalate: Math.max(1, Math.round(num("reasoningFailuresToEscalate", AUTO_DEFAULTS.reasoningFailuresToEscalate))),
    filesForComplex: Math.max(1, Math.round(num("filesForComplex", AUTO_DEFAULTS.filesForComplex))),
    maxStepsWithoutProgress: Math.max(1, Math.round(num("maxStepsWithoutProgress", AUTO_DEFAULTS.maxStepsWithoutProgress))),
    maxEscalationsPerTask: Math.max(0, Math.round(num("maxEscalationsPerTask", AUTO_DEFAULTS.maxEscalationsPerTask))),
    resetOnNewTurn: bool("resetOnNewTurn", AUTO_DEFAULTS.resetOnNewTurn),
    monitorOnly: bool("monitorOnly", AUTO_DEFAULTS.monitorOnly)
  };
}
function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function AutoSettingsSection({
  settings,
  save
}) {
  const t = useT();
  const auto = readAutoSettings(settings);
  const patch = (delta) => save({ auto: delta });
  const initialOptions = [
    { value: "off", label: t("auto.effort.off") },
    { value: "low", label: t("auto.effort.low") }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    Section,
    {
      title: t("settings.section.auto"),
      help: t("settings.help.auto"),
      actions: auto.monitorOnly ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Pill, { tone: "warn", children: t("settings.auto.monitorBadge") }) : auto.enabled ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Pill, { tone: "ok", children: t("settings.auto.on") }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Pill, { children: t("settings.auto.off") }),
      children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-auto-settings", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-auto-settings-switches", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            Switch,
            {
              checked: auto.enabled,
              label: t("settings.auto.enabled"),
              onChange: (value) => patch({ enabled: value })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            Switch,
            {
              checked: auto.includeSubagents,
              label: t("settings.auto.includeSubagents"),
              onChange: (value) => patch({ includeSubagents: value })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            Switch,
            {
              checked: auto.monitorOnly,
              label: t("settings.auto.monitorOnly"),
              onChange: (value) => patch({ monitorOnly: value })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            Switch,
            {
              checked: auto.resetOnNewTurn,
              label: t("settings.auto.resetOnNewTurn"),
              onChange: (value) => patch({ resetOnNewTurn: value })
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-auto-settings-thresholds", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-field-label", children: t("settings.auto.reasoningFailuresToEscalate") }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              Input,
              {
                type: "number",
                step: 1,
                ariaLabel: t("settings.auto.reasoningFailuresToEscalate"),
                value: String(auto.reasoningFailuresToEscalate),
                onChange: (value) => patch({ reasoningFailuresToEscalate: Math.max(1, Math.round(toNumber(value))) })
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-field-label", children: t("settings.auto.filesForComplex") }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              Input,
              {
                type: "number",
                step: 1,
                ariaLabel: t("settings.auto.filesForComplex"),
                value: String(auto.filesForComplex),
                onChange: (value) => patch({ filesForComplex: Math.max(1, Math.round(toNumber(value))) })
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-field-label", children: t("settings.auto.maxStepsWithoutProgress") }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              Input,
              {
                type: "number",
                step: 1,
                ariaLabel: t("settings.auto.maxStepsWithoutProgress"),
                value: String(auto.maxStepsWithoutProgress),
                onChange: (value) => patch({ maxStepsWithoutProgress: Math.max(1, Math.round(toNumber(value))) })
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-field-label", children: t("settings.auto.maxEscalationsPerTask") }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              Input,
              {
                type: "number",
                step: 1,
                ariaLabel: t("settings.auto.maxEscalationsPerTask"),
                value: String(auto.maxEscalationsPerTask),
                onChange: (value) => patch({ maxEscalationsPerTask: Math.max(0, Math.round(toNumber(value))) })
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-auto-settings-initial", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(HelpLabel, { text: t("settings.auto.initialHelp"), children: t("settings.auto.initial") }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-auto-initial-grid", children: [
            AUTO_TASK_TYPES.map((type) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-field", children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-field-label", children: t("type." + type) }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                Select,
                {
                  value: auto.initial[type],
                  ariaLabel: t("type." + type),
                  options: initialOptions,
                  onChange: (value) => patch({ initial: { [type]: value } })
                }
              )
            ] }, type)),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-field", children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-field-label", children: t("settings.auto.maxInitial") }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                Select,
                {
                  value: auto.maxInitial,
                  ariaLabel: t("settings.auto.maxInitial"),
                  options: initialOptions,
                  onChange: (value) => patch({ maxInitial: value })
                }
              )
            ] })
          ] })
        ] })
      ] })
    }
  );
}
function optionalBucketNumber(bucket, key) {
  const value = bucket[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function optionalBucketString(bucket, key) {
  const value = bucket[key];
  return typeof value === "string" ? value : null;
}
function tokensOrDash(value) {
  return value === null ? "\u2014" : formatTokens(value);
}
function reasoningCell(t, bucket) {
  const source = optionalBucketString(bucket, "reasoningSource");
  const estimated = optionalBucketNumber(bucket, "reasoningEstimatedTokens");
  if (typeof bucket.reasoningTokens === "number" && Number.isFinite(bucket.reasoningTokens)) {
    return {
      text: formatTokens(bucket.reasoningTokens),
      estimated: source === "estimated",
      title: source === "estimated" ? t("auto.compare.estimatedTitle") : void 0
    };
  }
  if (estimated !== null && estimated > 0) {
    return { text: formatTokens(estimated), estimated: true, title: t("auto.compare.estimatedTitle") };
  }
  return { text: "\u2014" };
}
function compareRows(t, summary) {
  const noPrice = t("common.noPrice");
  const plain = (text) => ({ text });
  const costText = (value) => value === null ? { text: noPrice } : { text: formatCost(value, noPrice) };
  const usage = [
    { label: t("auto.compare.inputTokens"), auto: plain(formatTokens(summary.auto.inputTokens)), manual: plain(formatTokens(summary.manual.inputTokens)) },
    {
      label: t("auto.compare.cacheReadTokens"),
      auto: plain(tokensOrDash(optionalBucketNumber(summary.auto, "cacheReadTokens"))),
      manual: plain(tokensOrDash(optionalBucketNumber(summary.manual, "cacheReadTokens")))
    },
    { label: t("auto.compare.outputTokens"), auto: plain(formatTokens(summary.auto.outputTokens)), manual: plain(formatTokens(summary.manual.outputTokens)) },
    {
      label: t("auto.compare.reasoningTokens"),
      auto: reasoningCell(t, summary.auto),
      manual: reasoningCell(t, summary.manual)
    },
    { label: t("auto.compare.totalTokens"), auto: plain(formatTokens(summary.auto.totalTokens)), manual: plain(formatTokens(summary.manual.totalTokens)) }
  ];
  const efficiency = [
    { label: t("auto.compare.calls"), auto: plain(formatExact(summary.auto.calls)), manual: plain(formatExact(summary.manual.calls)) },
    { label: t("auto.compare.tasks"), auto: plain(formatExact(summary.auto.tasks)), manual: plain(formatExact(summary.manual.tasks)) },
    { label: t("auto.compare.cost"), auto: costText(summary.auto.cost), manual: costText(summary.manual.cost) },
    {
      label: t("auto.compare.successRate"),
      auto: plain(summary.auto.successRate === null ? "\u2014" : formatRatio(summary.auto.successRate)),
      manual: plain(summary.manual.successRate === null ? "\u2014" : formatRatio(summary.manual.successRate))
    },
    {
      label: t("auto.compare.avgTokensPerTask"),
      auto: plain(summary.auto.avgTokensPerTask === null ? "\u2014" : formatTokens(summary.auto.avgTokensPerTask)),
      manual: plain(summary.manual.avgTokensPerTask === null ? "\u2014" : formatTokens(summary.manual.avgTokensPerTask))
    }
  ];
  return { usage, efficiency };
}
function EstimateBadge() {
  const t = useT();
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-est", title: t("auto.compare.estimatedTitle"), children: t("auto.estimated") });
}
function AutoCompareTable({ summary }) {
  const t = useT();
  const { usage, efficiency } = compareRows(t, summary);
  const renderRow = (row) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("tr", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("td", { className: "tm-auto-cmp-label", children: row.label }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("td", { className: "tm-num tm-auto-cmp-auto", title: row.auto.title, children: [
      row.auto.text,
      row.auto.estimated ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(EstimateBadge, {}) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("td", { className: "tm-num", title: row.manual.title, children: [
      row.manual.text,
      row.manual.estimated ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(EstimateBadge, {}) : null
    ] })
  ] }, row.label);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "tm-tablewrap tm-auto-cmp-wrap", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("table", { className: "tm-table tm-auto-cmp", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("tr", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("th", { children: t("auto.compare.metric") }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("th", { className: "tm-num tm-auto-cmp-auto", children: t("auto.mode.auto") }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("th", { className: "tm-num", children: t("auto.mode.manual") })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("tbody", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("tr", { className: "tm-auto-cmp-group", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("td", { colSpan: 3, children: t("auto.compare.groupUsage") }) }),
      usage.map(renderRow),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("tr", { className: "tm-auto-cmp-group", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("td", { colSpan: 3, children: t("auto.compare.groupEfficiency") }) }),
      efficiency.map(renderRow)
    ] })
  ] }) });
}
function EffortDistribution({ byEffort }) {
  const t = useT();
  const rows = byEffort.filter((row) => row.calls > 0 || row.totalTokens > 0);
  if (rows.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Empty, { text: t("auto.compare.noEffort") });
  const totalCalls = rows.reduce((sum, row) => sum + row.calls, 0);
  const denom = totalCalls > 0 ? totalCalls : rows.reduce((sum, row) => sum + row.totalTokens, 0);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-auto-effort", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "tm-auto-segbar", role: "img", "aria-label": t("auto.compare.effortDistribution"), children: rows.map((row) => {
      const share = denom > 0 ? (totalCalls > 0 ? row.calls : row.totalTokens) / denom * 100 : 0;
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "span",
        {
          className: "tm-auto-seg tm-auto-seg-" + row.effort,
          style: { width: Math.max(share, 2) + "%" },
          title: effortLabel(t, row.effort) + " \xB7 " + formatExact(row.calls) + " " + t("common.callsShort") + " \xB7 " + formatTokens(row.totalTokens)
        },
        row.effort
      );
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "tm-auto-legend", children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "tm-auto-legend-item", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("i", { className: "tm-auto-swatch tm-auto-seg-" + row.effort, "aria-hidden": "true" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-legend-name", children: effortLabel(t, row.effort) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("b", { children: formatExact(row.calls) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("em", { children: formatTokens(row.totalTokens) })
    ] }, row.effort)) })
  ] });
}
function savedPerTask(summary) {
  const auto = summary.auto.avgTokensPerTask;
  const manual = summary.manual.avgTokensPerTask;
  if (auto === null || manual === null || manual <= 0) return null;
  return manual - auto;
}
function AutoSummaryBody({ summary, variant }) {
  const t = useT();
  const hostNotes = summary.notes.filter(
    (note) => !/reasoning[_\s-]?(?:tokens?|estimated|source)|推理\s*token/i.test(note)
  );
  const saved = savedPerTask(summary);
  const manualAvg = summary.manual.avgTokensPerTask;
  const savedPercent = saved !== null && manualAvg !== null && manualAvg > 0 ? Math.round(Math.abs(saved) / manualAvg * 100) : null;
  const savedLabel = saved !== null && saved < 0 ? t("auto.kpi.extraVsManual") : t("auto.kpi.savedVsManual");
  const savedHint = saved === null ? t("auto.kpi.noBaseline") : savedLabel + " " + formatTokens(Math.abs(saved)) + (savedPercent === null ? "" : " \xB7 " + String(savedPercent) + "%");
  const tokenHint = formatTokens(summary.auto.totalTokens) + " / " + formatTokens(summary.manual.totalTokens);
  const cards = variant === "overview" ? [
    {
      label: t("auto.compare.totalTokens"),
      value: formatTokens(summary.auto.totalTokens),
      hint: tokenHint + " \xB7 " + t("auto.kpi.autoManual"),
      help: t("overview.auto.help")
    },
    {
      label: t("auto.compare.calls"),
      value: formatExact(summary.auto.calls),
      hint: formatExact(summary.manual.calls) + " " + t("auto.mode.manual"),
      help: t("auto.compare.callsHelp")
    },
    {
      label: t("auto.compare.successRate"),
      value: summary.auto.successRate === null ? "\u2014" : formatRatio(summary.auto.successRate),
      hint: t("auto.compare.successHint"),
      help: t("auto.compare.successHint")
    },
    {
      label: t("auto.compare.avgTokensPerTask"),
      value: summary.auto.avgTokensPerTask === null ? "\u2014" : formatTokens(summary.auto.avgTokensPerTask),
      hint: savedHint,
      help: t("auto.kpi.savedHelp"),
      tone: saved !== null && saved < 0 ? "warn" : "default"
    }
  ] : [
    {
      label: t("auto.compare.totalTokens"),
      value: formatTokens(summary.auto.totalTokens),
      hint: tokenHint + " \xB7 " + t("auto.kpi.autoManual"),
      help: t("auto.compare.totalHelp")
    },
    {
      label: savedLabel,
      value: saved === null ? "\u2014" : formatTokens(Math.abs(saved)),
      hint: saved === null ? t("auto.kpi.noBaseline") : t("auto.compare.avgTokensPerTask") + " " + formatTokens(summary.auto.avgTokensPerTask) + " / " + formatTokens(summary.manual.avgTokensPerTask),
      tone: saved === null ? "default" : saved >= 0 ? "ok" : "warn",
      help: t("auto.kpi.savedHelp")
    },
    {
      label: t("auto.compare.calls"),
      value: formatExact(summary.auto.calls),
      hint: formatExact(summary.manual.calls) + " " + t("auto.mode.manual"),
      help: t("auto.compare.callsHelp")
    },
    {
      label: t("auto.compare.successRate"),
      value: summary.auto.successRate === null ? "\u2014" : formatRatio(summary.auto.successRate),
      hint: t("auto.compare.successHint"),
      help: t("auto.compare.successHint")
    }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-auto-panel", "data-variant": variant, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "tm-cards tm-cards-4 tm-auto-kpis", children: cards.map((card) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      Card,
      {
        label: card.label,
        value: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-kpi-value", children: card.value }),
        hint: card.hint,
        help: card.help,
        tone: card.tone === "ok" ? "ok" : card.tone === "warn" ? "warn" : "default"
      },
      card.label
    )) }),
    variant === "report" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-auto-compare-block", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-auto-block-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-block-title", children: t("auto.compare.tableTitle") }),
        summary.estimates ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-block-actions", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Pill, { tone: "warn", children: t("auto.compare.estimates") }) }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(AutoCompareTable, { summary })
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-auto-effort-block", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "tm-auto-block-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-block-title", children: t("auto.compare.effortDistribution") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "tm-auto-block-actions tm-note", children: [
          formatExact(summary.auto.calls + summary.manual.calls),
          " ",
          t("common.callsShort")
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(EffortDistribution, { byEffort: summary.byEffort })
    ] }),
    variant === "report" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "tm-auto-footnote", children: [
      t("auto.compare.reasoningNote"),
      hostNotes.length > 0 ? " \xB7 " + hostNotes.join(" \xB7 ") : ""
    ] }) : null
  ] });
}
function AutoSummarySection({
  api,
  refreshTick,
  title,
  help,
  variant
}) {
  const t = useT();
  const resource = useResource((signal) => api.autoSummary(signal), [refreshTick], t);
  const summary = resource.data;
  const sub = summary ? formatExact(summary.decisions) + " " + t("auto.compare.decisionsUnit") + " \xB7 " + formatExact(summary.escalations) + " " + t("auto.compare.escalationsUnit") : void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(Section, { title, help, sub, children: [
    resource.status === "loading" && summary === null ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Loading, {}) : null,
    resource.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      Empty,
      {
        text: resource.error ?? t("auto.unavailable"),
        action: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { size: "sm", onClick: resource.reload, children: t("common.retry") })
      }
    ) : null,
    summary ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(AutoSummaryBody, { summary, variant }) : null
  ] });
}
function shortSessionSuffix(sessionId) {
  return sessionId.length <= 6 ? sessionId : "\u2026" + sessionId.slice(-6);
}
function AutoDecisionHistory({ api, refreshTick }) {
  const t = useT();
  const resource = useResource(
    (signal) => api.autoDecisions({ limit: 20 }, signal),
    [refreshTick],
    t
  );
  const rows = resource.data ?? [];
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    Section,
    {
      title: t("report.auto.historyTitle"),
      help: t("report.auto.historyHelp"),
      actions: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-block-actions tm-note", children: formatExact(rows.length) }),
      children: [
        resource.status === "loading" && resource.data === null ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Loading, {}) : null,
        resource.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          Empty,
          {
            text: resource.error ?? t("auto.unavailable"),
            action: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { size: "sm", onClick: resource.reload, children: t("common.retry") })
          }
        ) : null,
        resource.status === "ready" && rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Empty, { text: t("auto.history.empty") }) : null,
        rows.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("ol", { className: "tm-auto-timeline", children: rows.map((row) => {
          const actionKey = "auto.action." + row.action;
          const actionText = t(actionKey);
          const fromCode = (row.fromEffort ?? "\u2014").toUpperCase();
          const toCode = row.toEffort.toUpperCase();
          return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("li", { className: "tm-auto-timeline-item", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("time", { className: "tm-auto-timeline-time", title: formatDateTime(row.ts), children: formatShortDateTime(row.ts) }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-action tm-auto-action-" + row.action, children: actionText === actionKey ? row.action : actionText }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "tm-auto-effort-chip", title: formatExact(row.stage) + " \xB7 " + t("auto.history.stage"), children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: fromCode }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("i", { "aria-hidden": "true", children: "\u2192" }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("b", { children: toCode })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-timeline-session", title: row.sessionId, children: shortSessionSuffix(row.sessionId) }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "tm-auto-timeline-reason", title: row.reasons.join("\uFF1B"), children: row.reasons[0] ?? "\u2014" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "span",
              {
                className: "tm-auto-applied" + (row.applied ? " is-on" : ""),
                title: row.applied ? t("auto.history.appliedYes") : t("auto.history.appliedNo"),
                "aria-label": row.applied ? t("auto.history.appliedYes") : t("auto.history.appliedNo"),
                children: row.applied ? "\u2713" : "\xB7"
              }
            )
          ] }, String(row.id));
        }) }) : null
      ]
    }
  );
}
function AutoOverviewSection({ api, refreshTick }) {
  const t = useT();
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    AutoSummarySection,
    {
      api,
      refreshTick,
      title: t("overview.auto.title"),
      help: t("overview.auto.help"),
      variant: "overview"
    }
  );
}
function AutoReportSections({ api, refreshTick }) {
  const t = useT();
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      AutoSummarySection,
      {
        api,
        refreshTick,
        title: t("report.auto.title"),
        help: t("report.auto.help"),
        variant: "report"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(AutoDecisionHistory, { api, refreshTick })
  ] });
}

// src/client/auto-label.tsx
var import_react8 = require("react");
var import_jsx_runtime7 = require("react/jsx-runtime");
function ModelLabelAuto(props) {
  const { status } = useAutoStatus(props.api, props.sessionId);
  const name = props.model?.name ?? "";
  const placement = props.placement ?? "option";
  const inMenu = placement !== "trigger";
  const autoSlot = status?.enabled === true && status.mode === "auto";
  const isCurrent = autoSlot && props.selected === true && statusCurrentMatches(status?.current ?? null, props.provider?.id ?? null, props.model?.id ?? null);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
    inMenu ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "tm-model-label-name", children: name }) : null,
    isCurrent ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "tm-model-label-auto", title: props.translate ? props.translate("auto.labelTagTitle") : void 0, children: "AUTO" }) : null
  ] });
}
function statusCurrentMatches(current, providerId, modelId) {
  if (!current || !providerId || !modelId) return true;
  const providerOk = !current.provider || current.provider === providerId;
  const modelOk = !current.model || current.model === modelId;
  return providerOk && modelOk;
}

// src/client/overview.tsx
var import_react9 = require("react");
var import_jsx_runtime8 = require("react/jsx-runtime");
var RANGES = ["today", "session", "task", "all"];
function readImportedSessions(result) {
  const value = result.importedSessions;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function dailyTotal(point) {
  return point.inputTokens + point.cacheReadTokens + point.outputTokens;
}
function OverviewPage({
  api,
  refreshTick,
  onOpenReport
}) {
  const t = useT();
  const [days, setDays] = (0, import_react9.useState)("7");
  const [metricRange, setMetricRange] = (0, import_react9.useState)("today");
  const resource = useResource(
    async (signal) => Promise.all([
      api.overview({ range: "today" }, signal),
      api.overview({ range: "session" }, signal),
      api.overview({ range: "task" }, signal),
      api.overview({ range: "all", days: Number(days) }, signal)
    ]).then(([today, session, task, all]) => ({ today, session, task, all })),
    [days, refreshTick],
    t
  );
  if (resource.status === "loading" && resource.data === null) return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Loading, {});
  if (resource.status === "error") return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ErrorBox, { message: resource.error ?? t("error.generic"), onRetry: resource.reload });
  if (resource.data === null) return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Empty, { text: t("overview.empty") });
  const data = resource.data;
  const metric = data[metricRange];
  const daily = data.all.daily;
  const trendPoints = daily.map((point) => ({
    label: point.date.length >= 10 ? point.date.slice(5) : point.date,
    value: dailyTotal(point),
    tip: point.date + ": " + formatExact(dailyTotal(point))
  }));
  const callPoints = daily.map((point) => ({
    label: point.date.length >= 10 ? point.date.slice(5) : point.date,
    value: point.calls,
    tip: point.date + ": " + formatExact(point.calls)
  }));
  const modelItems = data.all.models.slice(0, 5).filter((row) => row.totalTokens > 0).map((row) => ({ label: modelLabel(row.provider, row.model, t("common.unknown")), value: row.totalTokens }));
  const importedSessions = readImportedSessions(data.all);
  const noPrice = t("common.noPrice");
  const unknown = t("common.unknown");
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "tm-stack", children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "tm-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "tm-label", children: t("overview.rangeLabel") }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        Chips,
        {
          value: metricRange,
          ariaLabel: t("overview.rangeLabel"),
          options: RANGES.map((range) => ({ value: range, label: t("overview.range." + range) })),
          onChange: (value) => setMetricRange(value)
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "tm-cards tm-cards-4", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        Card,
        {
          label: t("overview.cards.todayTokens"),
          value: formatTokens(data.today.totals.totalTokens),
          hint: formatExact(data.today.totals.totalTokens),
          help: t("overview.help.todayTokens")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        Card,
        {
          label: t("overview.cards.sessionTokens"),
          value: formatTokens(data.session.totals.totalTokens),
          hint: formatExact(data.session.totals.totalTokens),
          help: t("overview.help.sessionTokens")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        Card,
        {
          label: t("overview.cards.taskTokens"),
          value: formatTokens(data.task.totals.totalTokens),
          hint: formatExact(data.task.totals.totalTokens),
          help: t("overview.help.taskTokens")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        Card,
        {
          label: t("overview.cards.allTime"),
          value: formatTokens(data.all.totals.totalTokens),
          hint: importedSessions !== null && importedSessions > 0 ? withCount(t, "overview.importedSessions", importedSessions) : formatExact(data.all.totals.totalTokens),
          help: t("overview.help.allTime")
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "tm-cards tm-cards-6", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Card, { label: t("overview.cards.cacheHitRate"), value: formatRate(metric.cacheHitRate), help: t("overview.help.cacheHitRate") }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Card, { label: t("overview.cards.missInput"), value: formatTokens(metric.totals.inputTokens), help: t("overview.help.missInput") }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Card, { label: t("overview.cards.output"), value: formatTokens(metric.totals.outputTokens), help: t("overview.help.output") }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Card, { label: t("overview.cards.calls"), value: formatExact(metric.calls), help: t("overview.help.calls") }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        Card,
        {
          label: t("overview.cards.cost"),
          value: metric.priceConfigured ? formatCost(metric.cost, noPrice) : noPrice,
          tone: metric.priceConfigured ? "default" : "warn",
          help: t("overview.help.cost")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        Card,
        {
          label: t("overview.cards.findings"),
          value: formatExact(metric.findingCount),
          tone: metric.findingCount > 0 ? "warn" : "default",
          help: t("overview.help.findings")
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(AutoOverviewSection, { api, refreshTick }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      Section,
      {
        title: t("overview.trend.title"),
        help: t("overview.help.trend"),
        actions: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Chips, { value: days, ariaLabel: t("overview.days.7"), options: [{ value: "7", label: t("overview.days.7") }, { value: "30", label: t("overview.days.30") }], onChange: setDays }),
        children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "tm-cols", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "tm-stack", children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "tm-label", children: t("overview.trend.tokens") }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(LineChart, { points: trendPoints, format: formatTokens })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "tm-stack", children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "tm-label", children: t("overview.trend.calls") }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(BarChart, { points: callPoints, format: formatExact })
          ] })
        ] })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "tm-cols-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Section, { title: t("overview.rank.models"), help: t("overview.help.rankModels"), children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Donut, { items: modelItems, format: formatTokens }) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Section, { title: t("overview.rank.projects"), help: t("overview.help.rankProjects"), children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        RankList,
        {
          rows: data.all.projects.slice(0, 6).map((row) => ({ label: row.projectId, value: row.totalTokens, cost: row.cost, calls: row.calls })),
          emptyText: t("overview.emptyRank")
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Section, { title: t("overview.rank.tasks"), help: t("overview.help.rankTasks"), children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        RankList,
        {
          rows: data.all.topTasks.slice(0, 6).map((row) => ({ label: taskLabel(row.taskName, row.taskId, unknown), value: row.totalTokens, cost: row.cost, calls: row.calls, taskId: row.taskId })),
          emptyText: t("overview.emptyRank"),
          onOpen: onOpenReport
        }
      ) })
    ] })
  ] });
}
function RankList({ rows, emptyText, onOpen }) {
  const t = useT();
  if (rows.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Empty, { text: emptyText });
  const max = Math.max(...rows.map((row) => row.value), 1);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "tm-rank", children: rows.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      className: "tm-rank-row" + (onOpen && row.taskId ? " tm-clickable" : ""),
      onClick: onOpen && row.taskId ? () => onOpen(row.taskId) : void 0,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "tm-rank-name", title: row.label, children: row.label }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "tm-rank-bar", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "tm-rank-fill", "aria-hidden": "true", style: { width: Math.round(row.value / max * 100) + "%" } }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "tm-rank-value", title: formatExact(row.value) + " \xB7 " + row.calls + " " + t("common.callsShort") + " \xB7 " + formatCost(row.cost, t("common.noPrice")), children: formatTokens(row.value) })
      ]
    },
    row.taskId ?? row.label + String(index)
  )) });
}

// src/client/report.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
function severityTone(severity) {
  if (severity === "high") return "high";
  if (severity === "warn") return "warn";
  return "info";
}
function ReportPage({
  api,
  refreshTick,
  taskId,
  onSelectTask
}) {
  const t = useT();
  const tasksResource = useResource(
    (signal) => api.tasks({ limit: 50 }, signal),
    [refreshTick],
    t
  );
  const reportResource = useResource(
    (signal) => taskId ? api.taskReport(taskId, signal) : Promise.resolve(null),
    [taskId, refreshTick],
    t
  );
  const taskOptions = [{ value: "", label: t("report.pickTask") }].concat(
    (tasksResource.data?.rows ?? []).map((row) => ({
      value: row.id,
      label: taskLabel(row.taskName, row.id, t("common.untitled"))
    }))
  );
  const report = reportResource.data;
  const unknown = t("common.unknown");
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "tm-stack", children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "tm-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "tm-label", children: t("report.taskLabel") }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
        Select,
        {
          value: taskId ?? "",
          ariaLabel: t("report.taskLabel"),
          options: taskOptions,
          onChange: (value) => onSelectTask(value)
        }
      ),
      report ? /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "tm-row-end tm-note", children: [
        report.task.projectId,
        " \xB7 ",
        formatDateTime(report.task.startedAt)
      ] }) : null
    ] }),
    reportResource.status === "loading" ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Loading, {}) : null,
    reportResource.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ErrorBox, { message: reportResource.error ?? t("error.generic"), onRetry: reportResource.reload }) : null,
    !taskId ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "tm-report-scope-hint", children: t("report.auto.globalHint") }) : null,
    taskId && reportResource.status === "ready" && report === null ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Empty, { text: t("report.notFound") }) : null,
    report ? /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_jsx_runtime9.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "tm-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "tm-section-title", children: taskLabel(report.task.taskName, report.task.id, t("common.untitled")) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Pill, { tone: "info", children: taskTypeLabel(report.task.taskType, t) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Pill, { children: t("status." + report.task.status) }),
        report.task.interference > 0 ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Pill, { tone: "warn", children: t("report.interference") }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "tm-cards tm-cards-4", children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Card, { label: t("report.metrics.calls"), value: formatExact(report.metrics.calls) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Card, { label: t("report.metrics.tokens"), value: formatTokens(report.metrics.buckets.totalTokens), hint: formatExact(report.metrics.buckets.totalTokens) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Card, { label: t("report.metrics.cost"), value: formatCost(report.metrics.cost, t("common.noPrice")), tone: report.metrics.cost === null ? "warn" : "default" }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Card, { label: t("report.metrics.duration"), value: formatDuration(report.metrics.durationMs) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Card, { label: t("report.metrics.steps"), value: formatExact(report.metrics.steps) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Card, { label: t("report.metrics.toolCalls"), value: formatExact(report.metrics.toolCalls) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Card, { label: t("report.percentile.calls"), value: formatPercentile(report.comparison.callsPercentile), help: t("report.help.percentile") }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Card, { label: t("report.percentile.tokens"), value: formatPercentile(report.comparison.tokensPercentile), help: t("report.help.percentile") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "tm-cols", children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Section, { title: t("report.baselineTitle"), help: t("report.help.baseline"), children: report.baseline ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(BaselineTable, { baseline: report.baseline }) : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Empty, { text: t("report.baselineInsufficient") }) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Section, { title: t("report.findings"), help: t("report.help.findings"), children: report.findings.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Empty, { text: t("report.noFindings") }) : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("ul", { className: "tm-findings", children: report.findings.map((finding, index) => /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("li", { className: "tm-finding", children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "tm-finding-head", children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Pill, { tone: severityTone(finding.severity), children: t("severity." + finding.severity) }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "tm-finding-kind", children: t("finding." + finding.kind) }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "tm-dim", children: formatDateTime(finding.createdAt) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "tm-finding-subject", children: finding.subject }),
          finding.detail ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "tm-finding-detail", children: finding.detail }) : null,
          finding.evidence ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "tm-finding-evidence tm-mono", children: finding.evidence }) : null
        ] }, finding.id !== void 0 ? String(finding.id) : finding.kind + ":" + String(index))) }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Section, { title: t("report.topCallsTitle"), help: t("report.help.topCalls"), children: report.topCalls.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Empty, { text: t("report.noCalls") }) : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "tm-tablewrap", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("table", { className: "tm-table", children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("th", { children: t("calls.table.time") }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("th", { children: t("report.topCalls.turn") }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("th", { children: t("calls.table.model") }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("th", { className: "tm-num", children: t("calls.table.missInput") }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("th", { className: "tm-num", children: t("calls.table.cacheRead") }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("th", { className: "tm-num", children: t("calls.table.cacheWrite") }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("th", { className: "tm-num", children: t("calls.table.output") }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("th", { className: "tm-num", children: t("calls.table.total") }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("th", { className: "tm-num", children: t("calls.table.cost") }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("th", { children: t("report.topCalls.reason") })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("tbody", { children: report.topCalls.map((call) => /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { children: formatDateTime(call.ts) }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("td", { children: [
            String(call.turn),
            " / ",
            String(call.step)
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { children: modelLabel(null, call.model, unknown) }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { className: "tm-num", title: formatExact(call.buckets.inputTokens), children: formatTokens(call.buckets.inputTokens) }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { className: "tm-num", title: formatExact(call.buckets.cacheReadTokens), children: formatTokens(call.buckets.cacheReadTokens) }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { className: "tm-num", title: formatExact(call.buckets.cacheWriteTokens), children: formatTokens(call.buckets.cacheWriteTokens) }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { className: "tm-num", title: formatExact(call.buckets.outputTokens), children: formatTokens(call.buckets.outputTokens) }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { className: "tm-num", title: formatExact(call.buckets.totalTokens), children: formatTokens(call.buckets.totalTokens) }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { className: "tm-num", children: formatCost(call.cost, t("common.noPrice")) }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { title: call.reason, children: call.reason })
        ] }, String(call.id))) })
      ] }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Section, { title: t("report.suggestions"), help: t("report.help.suggestions"), children: report.suggestions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Empty, { text: t("report.noSuggestions") }) : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("ul", { className: "tm-suggestions", children: report.suggestions.map((suggestion, index) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("li", { children: suggestion }, String(index))) }) })
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(AutoReportSections, { api, refreshTick })
  ] });
}
function BaselineTable({ baseline }) {
  const t = useT();
  const noPrice = t("common.noPrice");
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("table", { className: "tm-table tm-table-plain", children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("tr", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("th", { children: t("report.baseline.metric") }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("th", { className: "tm-num", children: t("report.baseline.median") }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("th", { className: "tm-num", children: t("report.baseline.p80") })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("tbody", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { children: t("report.metrics.calls") }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { className: "tm-num", children: baseline.medianCalls === null ? t("report.baselineInsufficientShort") : formatExact(baseline.medianCalls) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { className: "tm-num", children: baseline.p80Calls === null ? t("report.baselineInsufficientShort") : formatExact(baseline.p80Calls) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { children: t("report.metrics.tokens") }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { className: "tm-num", children: baseline.medianTokens === null ? t("report.baselineInsufficientShort") : formatTokens(baseline.medianTokens) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { className: "tm-num", children: baseline.p80Tokens === null ? t("report.baselineInsufficientShort") : formatTokens(baseline.p80Tokens) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { children: t("report.metrics.cost") }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { className: "tm-num", children: baseline.medianCost === null ? t("report.baselineInsufficientShort") : formatCost(baseline.medianCost, noPrice) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { className: "tm-num", children: baseline.p80Cost === null ? t("report.baselineInsufficientShort") : formatCost(baseline.p80Cost, noPrice) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { children: t("report.baseline.samples") }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { className: "tm-num", colSpan: 2, children: formatExact(baseline.sampleCount) })
      ] })
    ] })
  ] });
}

// src/client/settings.tsx
var import_react10 = require("react");
var import_jsx_runtime10 = require("react/jsx-runtime");
var ANALYTICS_KEYS = Object.keys(DEFAULTS.analytics);
var THRESHOLD_KEYS = Object.keys(DEFAULTS.thresholds);
var EMPTY_PRICE_FORM = {
  provider: "",
  modelName: "",
  inputPrice: "",
  cacheReadPrice: "",
  cacheWritePrice: "",
  outputPrice: "",
  currency: "CNY",
  unitTokens: "1000000"
};
function readCompression(settings) {
  const raw = settings && typeof settings.compression === "object" && settings.compression !== null ? settings.compression : {};
  const defaults = CACHE_DEFAULTS;
  const pickNumber2 = (key, fallback) => {
    const value = raw[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };
  const typesRaw = typeof raw.types === "object" && raw.types !== null ? raw.types : {};
  const types = {};
  for (const key of Object.keys(defaults.types)) {
    const value = typesRaw[key];
    types[key] = typeof value === "boolean" ? value : defaults.types[key] !== false;
  }
  return {
    mode: typeof raw.mode === "string" ? raw.mode : defaults.mode,
    minBytes: pickNumber2("minBytes", defaults.minBytes),
    selectiveBytes: pickNumber2("selectiveBytes", defaults.selectiveBytes),
    smartBytes: pickNumber2("smartBytes", defaults.smartBytes),
    maxBlobBytes: pickNumber2("maxBlobBytes", defaults.maxBlobBytes),
    maxCacheMB: pickNumber2("maxCacheMB", defaults.maxCacheMB),
    ttlDays: pickNumber2("ttlDays", defaults.ttlDays),
    headLines: pickNumber2("headLines", defaults.headLines),
    tailLines: pickNumber2("tailLines", defaults.tailLines),
    types
  };
}
function readContext(settings) {
  const raw = settings && typeof settings.context === "object" && settings.context !== null ? settings.context : {};
  const pick = (key, fallback) => {
    const value = raw[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };
  const defaults = CONTEXT_DEFAULTS;
  return {
    mode: typeof raw.mode === "string" ? raw.mode : defaults.mode,
    minOccurrences: pick("minOccurrences", defaults.minOccurrences),
    minSurfaceNodes: pick("minSurfaceNodes", defaults.minSurfaceNodes),
    maxCandidates: pick("maxCandidates", defaults.maxCandidates),
    riskFactor: pick("riskFactor", defaults.riskFactor),
    assumedCacheReadRatio: pick("assumedCacheReadRatio", defaults.assumedCacheReadRatio)
  };
}
function toNumber2(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function SettingsPage({ api, refreshTick }) {
  const t = useT();
  const [settings, setSettings] = (0, import_react10.useState)(null);
  const [note, setNote] = (0, import_react10.useState)(null);
  const [priceVersion, setPriceVersion] = (0, import_react10.useState)(0);
  const [form, setForm] = (0, import_react10.useState)(EMPTY_PRICE_FORM);
  const [importNote, setImportNote] = (0, import_react10.useState)(null);
  const [cacheVersion, setCacheVersion] = (0, import_react10.useState)(0);
  const [verifyNote, setVerifyNote] = (0, import_react10.useState)(null);
  const [clearNote, setClearNote] = (0, import_react10.useState)(null);
  const mutation = useMutation(t);
  const settingsResource = useResource((signal) => api.settings(signal), [refreshTick], t);
  const pricesResource = useResource((signal) => api.prices(signal), [refreshTick, priceVersion], t);
  const cacheStatsResource = useResource((signal) => api.cacheStats(signal), [refreshTick, cacheVersion], t);
  (0, import_react10.useEffect)(() => {
    if (settingsResource.data) setSettings(settingsResource.data);
  }, [settingsResource.data]);
  (0, import_react10.useEffect)(() => {
    if (settingsResource.status === "error") setSettings(null);
  }, [settingsResource.status]);
  const save = (delta) => {
    void mutation.run(async () => {
      const next = await api.updateSettings(delta);
      setSettings(next);
      setNote(t("common.saved"));
    });
  };
  const analytics = settings?.analytics ?? DEFAULTS.analytics;
  const thresholds = settings?.thresholds ?? DEFAULTS.thresholds;
  const prices = pricesResource.data ?? [];
  const submitPrice = () => {
    if (!form.provider.trim() || !form.modelName.trim()) {
      setNote(t("settings.price.invalid"));
      return;
    }
    const payload = {
      provider: form.provider.trim(),
      modelName: form.modelName.trim(),
      inputPrice: toNumber2(form.inputPrice),
      cacheReadPrice: toNumber2(form.cacheReadPrice),
      cacheWritePrice: toNumber2(form.cacheWritePrice),
      outputPrice: toNumber2(form.outputPrice),
      currency: form.currency.trim() || "CNY",
      unitTokens: toNumber2(form.unitTokens) || 1e6
    };
    if (form.id !== void 0) payload.id = form.id;
    void mutation.run(async () => {
      await api.savePrice(payload);
      setPriceVersion((value) => value + 1);
      setForm(EMPTY_PRICE_FORM);
      setNote(t("common.saved"));
    });
  };
  const removePrice = (row) => {
    if (row.id === void 0) return;
    void mutation.run(async () => {
      await api.deletePrice(row.id);
      setPriceVersion((value) => value + 1);
      setNote(t("common.saved"));
    });
  };
  const runImport = () => {
    setImportNote(null);
    void mutation.run(async () => {
      const result = await api.runImport({ mode: "projcache", limit: 500 });
      const sessions = typeof result.sessions === "number" ? result.sessions : 0;
      const calls = typeof result.calls === "number" ? result.calls : 0;
      setImportNote(t("settings.import.result") + " \xB7 " + String(sessions) + " " + t("common.sessions") + " / " + String(calls) + " " + t("common.callsShort"));
      setPriceVersion((value) => value + 1);
    });
  };
  const resetSettings = () => {
    const confirmed = typeof window !== "undefined" && typeof window.confirm === "function" ? window.confirm(t("settings.resetConfirm")) : true;
    if (!confirmed) return;
    void mutation.run(async () => {
      const next = await api.resetSettings();
      setSettings(next);
      setNote(t("common.saved"));
    });
  };
  const compression = readCompression(settings);
  const context = readContext(settings);
  const cacheStats = cacheStatsResource.data;
  const saveCompression = (patch) => save({ compression: patch });
  const saveContext = (patch) => save({ context: patch });
  const runVerify = () => {
    setVerifyNote(null);
    void mutation.run(async () => {
      const result = await api.cacheVerify();
      setVerifyNote(
        t("settings.compression.verifyMissing") + " " + String(result.missingFiles) + " \xB7 " + t("settings.compression.verifyOrphan") + " " + String(result.orphanFiles) + " \xB7 " + t("settings.compression.verifyMismatch") + " " + String(result.hashMismatch)
      );
      setCacheVersion((value) => value + 1);
    });
  };
  const runClear = () => {
    const confirmed = typeof window !== "undefined" && typeof window.confirm === "function" ? window.confirm(t("settings.compression.clearConfirm")) : true;
    if (!confirmed) return;
    setClearNote(null);
    void mutation.run(async () => {
      const result = await api.cacheClear();
      setClearNote(
        t("settings.compression.cleared") + " \xB7 " + String(result.removed) + " \xB7 " + formatBytes(result.freedBytes)
      );
      setCacheVersion((value) => value + 1);
    });
  };
  const saveStatus = mutation.pending ? t("common.saving") : note;
  if (settingsResource.status === "loading" && settings === null) return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Loading, {});
  if (settingsResource.status === "error") {
    return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(ErrorBox, { message: settingsResource.error ?? t("error.generic"), onRetry: settingsResource.reload });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-stack", children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-label", children: t("settings.savedState") }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: mutation.error ? "tm-err" : "tm-dim", children: mutation.error ?? saveStatus ?? t("settings.notChanged") }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "tm-row-end", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("a", { className: "tm-btn", href: api.exportCallsUrl({}), download: exportFileName(), children: t("settings.export") }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Button, { variant: "danger", onClick: resetSettings, disabled: mutation.pending, children: t("settings.reset") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-cols", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Section, { title: t("settings.section.capture"), help: t("settings.help.capture"), children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-stack", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          Switch,
          {
            checked: Boolean(settings?.enabled ?? DEFAULTS.enabled),
            label: t("settings.enabled"),
            onChange: (value) => save({ enabled: value })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          Switch,
          {
            checked: Boolean(settings?.observeOnly ?? DEFAULTS.observeOnly),
            label: t("settings.observeOnly"),
            onChange: (value) => save({ observeOnly: value })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          Switch,
          {
            checked: Boolean(settings?.alertOnly ?? DEFAULTS.alertOnly),
            label: t("settings.alertOnly"),
            onChange: (value) => save({ alertOnly: value })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.evidenceTextLimit") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            Input,
            {
              type: "number",
              ariaLabel: t("settings.evidenceTextLimit"),
              className: "tm-input-mid",
              value: String(settings?.evidenceTextLimit ?? DEFAULTS.evidenceTextLimit),
              onChange: (value) => save({ evidenceTextLimit: Math.max(0, Math.round(toNumber2(value))) })
            }
          )
        ] })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Section, { title: t("settings.section.analytics"), help: t("settings.help.analytics"), children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "tm-toggles", children: ANALYTICS_KEYS.map((key) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
        Switch,
        {
          checked: analytics[key] !== false,
          label: t("settings.analytics." + key),
          onChange: (value) => save({ analytics: { [key]: value } })
        },
        key
      )) }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Section, { title: t("settings.section.thresholds"), help: t("settings.help.thresholds"), children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "tm-form-grid-6", children: THRESHOLD_KEYS.map((key) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.thresholds." + key) }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
        Input,
        {
          type: "number",
          step: 0.1,
          ariaLabel: t("settings.thresholds." + key),
          value: String(thresholds[key] ?? ""),
          onChange: (value) => save({ thresholds: { [key]: toNumber2(value) } })
        }
      )
    ] }, key)) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(AutoSettingsSection, { settings, save }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
      Section,
      {
        title: t("settings.section.prices"),
        help: t("settings.help.prices"),
        actions: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-note", children: prices.length + " " + t("common.rows") }),
        children: [
          pricesResource.status === "loading" && pricesResource.data === null ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Loading, {}) : null,
          pricesResource.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(ErrorBox, { message: pricesResource.error ?? t("error.generic"), onRetry: pricesResource.reload }) : null,
          pricesResource.status === "ready" && prices.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Empty, { text: t("settings.pricesEmpty") }) : null,
          prices.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "tm-tablewrap", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("table", { className: "tm-table", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("tr", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("settings.price.provider") }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("settings.price.model") }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { className: "tm-num", children: t("settings.price.input") }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { className: "tm-num", children: t("settings.price.cacheRead") }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { className: "tm-num", children: t("settings.price.cacheWrite") }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { className: "tm-num", children: t("settings.price.output") }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("settings.price.currency") }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { className: "tm-num", children: t("settings.price.unitTokens") }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("settings.price.effectiveAt") }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("settings.price.actions") })
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("tbody", { children: prices.map((row) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("tr", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { children: row.provider }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { children: row.modelName }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { className: "tm-num", children: String(row.inputPrice) }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { className: "tm-num", children: String(row.cacheReadPrice) }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { className: "tm-num", children: String(row.cacheWritePrice) }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { className: "tm-num", children: String(row.outputPrice) }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { children: row.currency }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { className: "tm-num", children: String(row.unitTokens) }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { children: formatDateTime(row.effectiveAt) }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "tm-row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                  Button,
                  {
                    size: "sm",
                    onClick: () => setForm({
                      id: row.id,
                      provider: row.provider,
                      modelName: row.modelName,
                      inputPrice: String(row.inputPrice),
                      cacheReadPrice: String(row.cacheReadPrice),
                      cacheWritePrice: String(row.cacheWritePrice),
                      outputPrice: String(row.outputPrice),
                      currency: row.currency,
                      unitTokens: String(row.unitTokens)
                    }),
                    children: t("common.edit")
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Button, { size: "sm", variant: "danger", onClick: () => removePrice(row), children: t("common.delete") })
              ] }) })
            ] }, row.id !== void 0 ? String(row.id) : row.provider + "/" + row.modelName)) })
          ] }) }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-price-form", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.price.provider") }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Input, { ariaLabel: t("settings.price.provider"), value: form.provider, onChange: (value) => setForm({ ...form, provider: value }), placeholder: "deepseek" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.price.model") }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Input, { ariaLabel: t("settings.price.model"), value: form.modelName, onChange: (value) => setForm({ ...form, modelName: value }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.price.input") }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Input, { type: "number", step: 1e-4, ariaLabel: t("settings.price.input"), value: form.inputPrice, onChange: (value) => setForm({ ...form, inputPrice: value }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.price.cacheRead") }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Input, { type: "number", step: 1e-4, ariaLabel: t("settings.price.cacheRead"), value: form.cacheReadPrice, onChange: (value) => setForm({ ...form, cacheReadPrice: value }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.price.cacheWrite") }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Input, { type: "number", step: 1e-4, ariaLabel: t("settings.price.cacheWrite"), value: form.cacheWritePrice, onChange: (value) => setForm({ ...form, cacheWritePrice: value }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.price.output") }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Input, { type: "number", step: 1e-4, ariaLabel: t("settings.price.output"), value: form.outputPrice, onChange: (value) => setForm({ ...form, outputPrice: value }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.price.currency") }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                Select,
                {
                  value: form.currency,
                  ariaLabel: t("settings.price.currency"),
                  options: [{ value: "CNY", label: "CNY" }, { value: "USD", label: "USD" }],
                  onChange: (value) => setForm({ ...form, currency: value })
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.price.unitTokens") }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Input, { type: "number", step: 1e3, ariaLabel: t("settings.price.unitTokens"), value: form.unitTokens, onChange: (value) => setForm({ ...form, unitTokens: value }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Button, { variant: "primary", onClick: submitPrice, disabled: mutation.pending, children: form.id !== void 0 ? t("common.save") : t("settings.price.add") }),
              form.id !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Button, { onClick: () => setForm(EMPTY_PRICE_FORM), children: t("common.cancel") }) : null
            ] })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Section, { title: t("settings.section.compression"), help: t("settings.help.compression"), children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-stack", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-label", children: t("settings.compression.mode") }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          Chips,
          {
            value: compression.mode,
            ariaLabel: t("settings.compression.mode"),
            options: CACHE_MODES.map((mode) => ({ value: mode, label: t("cache.mode." + mode) })),
            onChange: (value) => saveCompression({ mode: value })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-row-end " + (cacheStatsResource.status === "error" ? "tm-err" : "tm-note"), children: cacheStatsResource.status === "error" ? cacheStatsResource.error ?? t("error.generic") : cacheStats ? t("settings.compression.blobs") + " " + String(cacheStats.blobs) + " \xB7 " + t("settings.compression.usage") + " " + formatBytes(cacheStats.usageBytes) + " \xB7 " + t("settings.compression.missing") + " " + String(cacheStats.missingBlobs) : t("settings.compression.statsIdle") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-form-grid-6", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.compression.minBytes") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            Input,
            {
              type: "number",
              step: 256,
              ariaLabel: t("settings.compression.minBytes"),
              value: String(compression.minBytes),
              onChange: (value) => saveCompression({ minBytes: Math.max(0, Math.round(toNumber2(value))) })
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.compression.selectiveBytes") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            Input,
            {
              type: "number",
              step: 1024,
              ariaLabel: t("settings.compression.selectiveBytes"),
              value: String(compression.selectiveBytes),
              onChange: (value) => saveCompression({ selectiveBytes: Math.max(0, Math.round(toNumber2(value))) })
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.compression.smartBytes") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            Input,
            {
              type: "number",
              step: 1024,
              ariaLabel: t("settings.compression.smartBytes"),
              value: String(compression.smartBytes),
              onChange: (value) => saveCompression({ smartBytes: Math.max(0, Math.round(toNumber2(value))) })
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.compression.maxCacheMB") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            Input,
            {
              type: "number",
              step: 16,
              ariaLabel: t("settings.compression.maxCacheMB"),
              value: String(compression.maxCacheMB),
              onChange: (value) => saveCompression({ maxCacheMB: Math.max(0, Math.round(toNumber2(value))) })
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.compression.ttlDays") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            Input,
            {
              type: "number",
              step: 1,
              ariaLabel: t("settings.compression.ttlDays"),
              value: String(compression.ttlDays),
              onChange: (value) => saveCompression({ ttlDays: Math.max(0, Math.round(toNumber2(value))) })
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "tm-toggles", children: Object.keys(CACHE_DEFAULTS.types).map((contentType) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
        Switch,
        {
          checked: compression.types[contentType] !== false,
          label: t("settings.compression.type." + contentType),
          onChange: (value) => saveCompression({ types: { [contentType]: value } })
        },
        contentType
      )) }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Button, { onClick: runVerify, disabled: mutation.pending, children: t("settings.compression.verify") }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Button, { variant: "danger", onClick: runClear, disabled: mutation.pending, children: t("settings.compression.clear") }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-row-end " + (cacheStatsResource.status === "error" ? "tm-err" : "tm-note"), children: clearNote ?? verifyNote ?? t("settings.compression.storageIdle") })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Section, { title: t("settings.section.context"), help: t("settings.help.context"), children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-stack", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-label", children: t("settings.context.mode") }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          Chips,
          {
            value: context.mode,
            ariaLabel: t("settings.context.mode"),
            options: CONTEXT_MODES.map((mode) => ({ value: mode, label: t("context.mode." + mode) })),
            onChange: (value) => saveContext({ mode: value })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-row-end tm-note", children: t("settings.context.modeNote") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-form-grid-6", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.context.minOccurrences") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            Input,
            {
              type: "number",
              step: 1,
              ariaLabel: t("settings.context.minOccurrences"),
              value: String(context.minOccurrences),
              onChange: (value) => saveContext({ minOccurrences: Math.max(1, Math.round(toNumber2(value))) })
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.context.minSurfaceNodes") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            Input,
            {
              type: "number",
              step: 1,
              ariaLabel: t("settings.context.minSurfaceNodes"),
              value: String(context.minSurfaceNodes),
              onChange: (value) => saveContext({ minSurfaceNodes: Math.max(0, Math.round(toNumber2(value))) })
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.context.maxCandidates") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            Input,
            {
              type: "number",
              step: 5,
              ariaLabel: t("settings.context.maxCandidates"),
              value: String(context.maxCandidates),
              onChange: (value) => saveContext({ maxCandidates: Math.max(1, Math.round(toNumber2(value))) })
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.context.riskFactor") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            Input,
            {
              type: "number",
              step: 0.1,
              ariaLabel: t("settings.context.riskFactor"),
              value: String(context.riskFactor),
              onChange: (value) => saveContext({ riskFactor: toNumber2(value) })
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-field-label", children: t("settings.context.assumedCacheReadRatio") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            Input,
            {
              type: "number",
              step: 0.01,
              ariaLabel: t("settings.context.assumedCacheReadRatio"),
              value: String(context.assumedCacheReadRatio),
              onChange: (value) => saveContext({ assumedCacheReadRatio: toNumber2(value) })
            }
          )
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Section, { title: t("settings.section.data"), help: t("settings.help.data"), children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "tm-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Button, { onClick: runImport, disabled: mutation.pending, children: t("settings.import.button") }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("a", { className: "tm-btn", href: api.exportCallsUrl({}), download: exportFileName(), children: t("settings.export") }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "tm-row-end tm-note", children: importNote ?? t("settings.import.idle") })
    ] }) })
  ] });
}

// src/client/tasks.tsx
var import_react13 = require("react");

// src/client/projects.tsx
var import_react11 = require("react");
var import_jsx_runtime11 = require("react/jsx-runtime");
function emptySections() {
  const out = {};
  for (const section of PROJECT_SUMMARY_SECTIONS) out[section] = "";
  return out;
}
function summaryHasContent(values) {
  return PROJECT_SUMMARY_SECTIONS.some((section) => (values[section] ?? "").trim().length > 0);
}
function ProjectsView({ api, refreshTick }) {
  const t = useT();
  const [selected, setSelected] = (0, import_react11.useState)(null);
  const [version, setVersion] = (0, import_react11.useState)(0);
  const listResource = useResource(
    (signal) => api.projectsList(signal),
    [refreshTick, version],
    t
  );
  const projects = listResource.data ?? [];
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "tm-stack", children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "tm-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "tm-label", children: t("projects.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Help, { text: t("projects.help.list"), label: t("common.help") }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "tm-row-end tm-pager", children: [
        projects.length,
        " ",
        t("common.rows"),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Button, { size: "sm", onClick: listResource.reload, children: t("common.refresh") })
      ] })
    ] }),
    listResource.status === "loading" && listResource.data === null ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Loading, {}) : null,
    listResource.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(ErrorBox, { message: listResource.error ?? t("error.generic"), onRetry: listResource.reload }) : null,
    listResource.status === "ready" && projects.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Empty, { text: t("projects.empty") }) : null,
    projects.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "tm-tablewrap", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("table", { className: "tm-table", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("th", { children: t("projects.table.project") }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("th", { className: "tm-num", children: t("projects.table.sessions") }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("th", { className: "tm-num", children: t("projects.table.tasks") }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("th", { className: "tm-num", children: t("projects.table.calls") }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("th", { className: "tm-num", children: t("projects.table.tokens") }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("th", { className: "tm-num", children: t("projects.table.cost") }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("th", { children: t("projects.table.lastActivity") }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("th", { children: t("projects.table.summary") })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("tbody", { children: projects.map((project) => /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
        "tr",
        {
          className: "tm-clickable" + (project.projectId === selected ? " tm-selected" : ""),
          title: t("projects.open"),
          onClick: () => setSelected(project.projectId),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("td", { title: project.projectId, children: project.projectId }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("td", { className: "tm-num", children: formatExact(project.sessions) }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("td", { className: "tm-num", children: formatExact(project.tasks) }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("td", { className: "tm-num", children: formatExact(project.calls) }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("td", { className: "tm-num", children: formatTokens(project.totalTokens) }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("td", { className: "tm-num", children: formatCost(project.cost, t("common.noPrice")) }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("td", { children: project.lastActivity === null ? "\u2014" : formatDateTime(project.lastActivity) }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("td", { children: project.hasSummary ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Pill, { tone: "ok", children: t("projects.summary.saved") }) : /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Pill, { children: t("projects.summary.none") }) })
          ]
        },
        project.projectId
      )) })
    ] }) }) : null,
    selected ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      ProjectSummaryDrawer,
      {
        api,
        projectId: selected,
        onClose: () => setSelected(null),
        onSaved: () => setVersion((value) => value + 1)
      }
    ) : null
  ] });
}
function ProjectSummaryDrawer({
  api,
  projectId,
  onClose,
  onSaved
}) {
  const t = useT();
  const mutation = useMutation(t);
  const [version, setVersion] = (0, import_react11.useState)(0);
  const [draft, setDraft] = (0, import_react11.useState)(emptySections);
  const [baseline, setBaseline] = (0, import_react11.useState)(emptySections);
  const [note, setNote] = (0, import_react11.useState)(null);
  const [showSuggestions, setShowSuggestions] = (0, import_react11.useState)(false);
  const resource = useResource(
    (signal) => api.projectSummary(projectId, signal),
    [projectId, version],
    t
  );
  const bundle = resource.data;
  const record = bundle?.record ?? null;
  (0, import_react11.useEffect)(() => {
    if (!bundle) return;
    const saved = emptySections();
    if (bundle.record) {
      for (const section of PROJECT_SUMMARY_SECTIONS) {
        const value = bundle.record.summary[section];
        saved[section] = typeof value === "string" ? value : "";
      }
    } else {
      for (const section of PROJECT_SUMMARY_SECTIONS) {
        const value = bundle.draft[section];
        saved[section] = typeof value === "string" ? value : "";
      }
    }
    setDraft(saved);
    setBaseline(saved);
  }, [bundle]);
  (0, import_react11.useEffect)(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  const dirty = PROJECT_SUMMARY_SECTIONS.some((section) => (draft[section] ?? "") !== (baseline[section] ?? ""));
  const draftSuggestions = bundle ? PROJECT_SUMMARY_SECTIONS.filter((section) => {
    const suggestion = bundle.draft[section];
    if (typeof suggestion !== "string" || suggestion.trim().length === 0) return false;
    return suggestion !== (baseline[section] ?? "");
  }) : [];
  const save = () => {
    void mutation.run(async () => {
      const saved = await api.updateProjectSummary(projectId, draft);
      setNote(t("projects.editor.savedNote") + " v" + String(saved.version));
      setVersion((value) => value + 1);
      onSaved();
    });
  };
  const applySuggestions = () => {
    if (!bundle) return;
    const next = { ...draft };
    for (const section of PROJECT_SUMMARY_SECTIONS) {
      const suggestion = bundle.draft[section];
      if (typeof suggestion === "string" && suggestion.length > 0 && suggestion !== (baseline[section] ?? "")) {
        next[section] = suggestion;
      }
    }
    setDraft(next);
  };
  const runExport = (format) => {
    void mutation.run(async () => {
      const payload = await api.exportProject(projectId, format);
      downloadText(payload.filename, payload.contentType, payload.content);
      setNote(payload.filename);
    });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "tm-drawer-backdrop", role: "presentation", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
    "aside",
    {
      className: "tm-drawer tm-drawer-wide",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": t("projects.editor.title"),
      onClick: (event) => event.stopPropagation(),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("header", { className: "tm-drawer-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "tm-section-title", children: [
            t("projects.editor.title"),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Help, { text: t("projects.editor.help"), label: t("common.help") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "tm-row-end", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Button, { size: "sm", onClick: () => runExport("json"), disabled: mutation.pending, children: "JSON" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Button, { size: "sm", onClick: () => runExport("markdown"), disabled: mutation.pending, children: "Markdown" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Button, { size: "sm", onClick: onClose, children: t("projects.editor.close") })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "tm-drawer-body", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "tm-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "tm-mono", title: projectId, children: truncate(projectId, 60) }),
            record ? /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(Pill, { tone: "ok", children: [
              t("projects.summary.saved"),
              " v",
              String(record.version)
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Pill, { children: t("projects.summary.draft") }),
            record ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "tm-note", children: formatDateTime(record.updatedAt) }) : null,
            draftSuggestions.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Button, { size: "sm", onClick: () => setShowSuggestions((value) => !value), children: t("projects.editor.draftSuggestions") + " " + String(draftSuggestions.length) }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "tm-row-end tm-note", children: mutation.error ?? note ?? (dirty ? t("taskdetail.unsaved") : "") })
          ] }),
          resource.status === "loading" && bundle === null ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Loading, {}) : null,
          resource.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(ErrorBox, { message: resource.error ?? t("error.generic"), onRetry: resource.reload }) : null,
          bundle ? /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_jsx_runtime11.Fragment, { children: [
            !record && summaryHasContent(bundle.draft) ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "tm-note", children: t("projects.editor.draftHint") }) : null,
            showSuggestions && draftSuggestions.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              Section,
              {
                title: t("projects.editor.draftSuggestions"),
                help: t("projects.editor.helpDraft"),
                actions: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Button, { size: "sm", onClick: applySuggestions, children: t("projects.editor.applyDraft") }),
                children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("ul", { className: "tm-suggestions", children: draftSuggestions.map((section) => /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("li", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "tm-finding-kind", children: t("projects.section." + section) }),
                  ":",
                  " ",
                  truncate(bundle.draft[section] ?? "", 220)
                ] }, section)) })
              }
            ) : null,
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "tm-summary-grid", children: PROJECT_SUMMARY_SECTIONS.map((section) => /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("label", { className: "tm-field tm-summary-field", children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "tm-field-label", children: [
                t("projects.section." + section),
                !record && (draft[section] ?? "").trim().length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "tm-dim", children: [
                  " \xB7 ",
                  t("projects.summary.draft")
                ] }) : null
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
                Textarea,
                {
                  ariaLabel: t("projects.section." + section),
                  rows: 4,
                  value: draft[section] ?? "",
                  onChange: (value) => setDraft({ ...draft, [section]: value })
                }
              )
            ] }, section)) })
          ] }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("footer", { className: "tm-drawer-foot", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "tm-row-end", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Button, { size: "sm", variant: "primary", onClick: save, disabled: mutation.pending || !dirty, children: t("projects.editor.save") }) }) })
      ]
    }
  ) });
}

// src/client/task-detail.tsx
var import_react12 = require("react");
var import_jsx_runtime12 = require("react/jsx-runtime");
function severityTone2(severity) {
  if (severity === "high") return "high";
  if (severity === "warn") return "warn";
  return "info";
}
function emptySummary() {
  const out = {};
  for (const field of TASK_SUMMARY_FIELDS) out[field] = "";
  return out;
}
function TaskDetailDrawer({
  api,
  taskId,
  onClose,
  onChanged,
  onOpenReport
}) {
  const t = useT();
  const mutation = useMutation(t);
  const [version, setVersion] = (0, import_react12.useState)(0);
  const [name, setName] = (0, import_react12.useState)("");
  const [summary, setSummary] = (0, import_react12.useState)(emptySummary);
  const [note, setNote] = (0, import_react12.useState)(null);
  const resource = useResource(
    (signal) => api.taskDetail(taskId, signal),
    [taskId, version],
    t
  );
  const detail = resource.data;
  const noPrice = t("common.noPrice");
  (0, import_react12.useEffect)(() => {
    if (!detail) return;
    setName(detail.task.taskName);
    const next = emptySummary();
    for (const field of TASK_SUMMARY_FIELDS) {
      const value = detail.summary[field];
      next[field] = typeof value === "string" ? value : value === void 0 || value === null ? "" : String(value);
    }
    setSummary(next);
  }, [detail]);
  (0, import_react12.useEffect)(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  const refreshAll = () => {
    setVersion((value) => value + 1);
    onChanged();
  };
  const saveName = () => {
    const value = name.trim();
    if (!value) {
      setNote(t("tasks.nameEmpty"));
      return;
    }
    void mutation.run(async () => {
      await api.updateTask(taskId, { taskName: value });
      setNote(t("common.saved"));
      refreshAll();
    });
  };
  const patchTask = (patch) => {
    void mutation.run(async () => {
      await api.updateTask(taskId, patch);
      refreshAll();
    });
  };
  const saveSummary = () => {
    void mutation.run(async () => {
      await api.updateTaskSummary(taskId, summary);
      setNote(t("taskdetail.saved"));
      refreshAll();
    });
  };
  const runExport = (format) => {
    void mutation.run(async () => {
      const payload = await api.exportTask(taskId, format);
      downloadText(payload.filename, payload.contentType, payload.content);
      setNote(payload.filename);
    });
  };
  const dirty = detail !== null && TASK_SUMMARY_FIELDS.some((field) => {
    const saved = detail.summary[field];
    const savedText = typeof saved === "string" ? saved : saved === void 0 || saved === null ? "" : String(saved);
    return (summary[field] ?? "") !== savedText;
  });
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "tm-drawer-backdrop", role: "presentation", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
    "aside",
    {
      className: "tm-drawer tm-drawer-wide",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": t("taskdetail.title"),
      onClick: (event) => event.stopPropagation(),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("header", { className: "tm-drawer-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "tm-section-title", children: [
            t("taskdetail.title"),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Help, { text: t("taskdetail.help"), label: t("common.help") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "tm-row-end", children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Button, { size: "sm", onClick: () => onOpenReport(taskId), children: t("taskdetail.openReport") }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Button, { size: "sm", onClick: onClose, children: t("taskdetail.close") })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "tm-drawer-body", children: [
          resource.status === "loading" && detail === null ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Loading, {}) : null,
          resource.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(ErrorBox, { message: resource.error ?? t("error.generic"), onRetry: resource.reload }) : null,
          resource.status === "ready" && detail === null ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Empty, { text: t("taskdetail.notFound") }) : null,
          detail ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "tm-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                Input,
                {
                  ariaLabel: t("taskdetail.name"),
                  className: "tm-input-mid",
                  value: name,
                  onChange: setName
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Button, { size: "sm", onClick: saveName, disabled: mutation.pending, children: t("common.save") }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                Select,
                {
                  value: detail.task.taskType,
                  ariaLabel: t("tasks.table.type"),
                  options: TASK_TYPES.map((value) => ({ value, label: taskTypeLabel(value, t) })),
                  onChange: (value) => patchTask({ taskType: value, taskTypeSource: "manual" })
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                Select,
                {
                  value: detail.task.status,
                  ariaLabel: t("tasks.table.status"),
                  options: TASK_STATUSES.map((value) => ({ value, label: t("status." + value) })),
                  onChange: (value) => patchTask({ status: value })
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "tm-row-end tm-note", children: mutation.error ?? note ?? "" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "tm-cards tm-cards-4", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Card, { label: t("taskdetail.metrics.calls"), value: formatExact(detail.metrics.calls) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Card, { label: t("taskdetail.metrics.total"), value: formatTokens(detail.metrics.totalTokens), hint: formatExact(detail.metrics.totalTokens) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                Card,
                {
                  label: t("taskdetail.metrics.cost"),
                  value: formatCost(detail.metrics.cost, noPrice),
                  tone: detail.metrics.cost === null ? "warn" : "default"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Card, { label: t("taskdetail.metrics.duration"), value: formatDuration(detail.metrics.durationMs) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "tm-cards tm-cards-4", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Card, { label: t("taskdetail.buckets.missInput"), value: formatTokens(detail.metrics.inputTokens) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Card, { label: t("taskdetail.buckets.cacheRead"), value: formatTokens(detail.metrics.cacheReadTokens) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Card, { label: t("taskdetail.buckets.cacheWrite"), value: formatTokens(detail.metrics.cacheWriteTokens) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Card, { label: t("taskdetail.buckets.output"), value: formatTokens(detail.metrics.outputTokens) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
              Section,
              {
                title: t("taskdetail.summary"),
                help: t("taskdetail.summaryHelp"),
                actions: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "tm-row", children: [
                  detail.summaryEdited ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Pill, { tone: "info", children: t("taskdetail.edited") }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Pill, { children: t("taskdetail.autoDraft") }),
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "tm-note", children: dirty ? t("taskdetail.unsaved") : t("taskdetail.savedState") }),
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Button, { size: "sm", variant: "primary", onClick: saveSummary, disabled: mutation.pending || !dirty, children: t("taskdetail.saveSummary") })
                ] }),
                children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "tm-summary-grid", children: TASK_SUMMARY_FIELDS.map((field) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("label", { className: "tm-field tm-summary-field", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "tm-field-label", children: t("summary.task." + field) }),
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                    Textarea,
                    {
                      ariaLabel: t("summary.task." + field),
                      rows: field === "tokenStats" || field === "nextSteps" ? 2 : 3,
                      value: summary[field] ?? "",
                      onChange: (value) => setSummary({ ...summary, [field]: value })
                    }
                  )
                ] }, field)) })
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Section, { title: t("taskdetail.writesTitle"), help: t("taskdetail.helpWrites"), sub: detail.metrics.toolCalls + " " + t("taskdetail.toolCalls"), children: detail.writes.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Empty, { text: t("taskdetail.emptyWrites") }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "tm-tablewrap", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("table", { className: "tm-table", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("tr", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { children: t("taskdetail.writes.tool") }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { children: t("taskdetail.writes.target") }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { children: t("taskdetail.writes.command") }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { className: "tm-num", children: t("taskdetail.writes.count") })
              ] }) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("tbody", { children: detail.writes.map((write, index) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("tr", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { children: write.toolName }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { className: "tm-mono", title: write.targetPath ?? "", children: write.targetPath ?? "\u2014" }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { className: "tm-mono", title: write.command ?? "", children: write.command ?? "\u2014" }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { className: "tm-num", children: formatExact(write.count) })
              ] }, write.toolName + ":" + String(index))) })
            ] }) }) }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Section, { title: t("taskdetail.findings"), help: t("taskdetail.helpFindings"), children: detail.findings.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Empty, { text: t("taskdetail.emptyFindings") }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("ul", { className: "tm-findings", children: detail.findings.map((finding, index) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("li", { className: "tm-finding", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "tm-finding-head", children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Pill, { tone: severityTone2(finding.severity), children: t("severity." + finding.severity) }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "tm-finding-kind", children: t("finding." + finding.kind) }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "tm-dim", children: formatDateTime(finding.createdAt) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "tm-finding-subject", children: finding.subject }),
              finding.detail ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "tm-finding-detail", children: finding.detail }) : null
            ] }, finding.kind + ":" + String(index))) }) }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Section, { title: t("taskdetail.calls"), help: t("taskdetail.helpCalls"), children: detail.calls.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Empty, { text: t("taskdetail.emptyCalls") }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "tm-tablewrap", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("table", { className: "tm-table", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("tr", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { children: t("calls.table.time") }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { children: t("calls.table.model") }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { className: "tm-num", children: t("calls.table.missInput") }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { className: "tm-num", children: t("calls.table.cacheRead") }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { className: "tm-num", children: t("calls.table.cacheWrite") }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { className: "tm-num", children: t("calls.table.output") }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { className: "tm-num", children: t("calls.table.total") }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { className: "tm-num", children: t("calls.table.cost") }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { className: "tm-num", children: t("calls.table.duration") })
              ] }) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("tbody", { children: detail.calls.slice(0, 50).map((call, index) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("tr", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { children: formatDateTime(call.ts) }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { children: modelLabel(call.provider, call.model, t("common.unknown")) }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { className: "tm-num", children: formatTokens(call.inputTokens) }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { className: "tm-num", children: formatTokens(call.cacheReadTokens) }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { className: "tm-num", children: formatTokens(call.cacheWriteTokens) }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { className: "tm-num", children: formatTokens(call.outputTokens) }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { className: "tm-num", children: formatTokens(call.totalTokens) }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { className: "tm-num", children: formatCost(call.cost, noPrice) }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { className: "tm-num", children: formatDuration(call.durationMs) })
              ] }, String(call.id) + ":" + String(index))) })
            ] }) }) })
          ] }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("footer", { className: "tm-drawer-foot", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: t("taskdetail.export") }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "tm-row-end", children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Button, { size: "sm", onClick: () => runExport("json"), disabled: mutation.pending, children: "JSON" }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Button, { size: "sm", onClick: () => runExport("markdown"), disabled: mutation.pending, children: "Markdown" }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Button, { size: "sm", onClick: () => runExport("csv"), disabled: mutation.pending, children: "CSV" })
          ] })
        ] })
      ]
    }
  ) });
}

// src/client/tasks.tsx
var import_jsx_runtime13 = require("react/jsx-runtime");
var PAGE_SIZE3 = 50;
function TasksPage({
  api,
  refreshTick,
  onOpenReport,
  selectedTaskId
}) {
  const t = useT();
  const [view, setView] = (0, import_react13.useState)("tasks");
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "tm-stack", children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "tm-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
        Chips,
        {
          value: view,
          ariaLabel: t("tasks.subviewLabel"),
          options: [
            { value: "tasks", label: t("tasks.subview.tasks") },
            { value: "projects", label: t("tasks.subview.projects") }
          ],
          onChange: (value) => setView(value === "projects" ? "projects" : "tasks")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Help, { text: t("tasks.help.subview"), label: t("common.help") })
    ] }),
    view === "projects" ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(ProjectsView, { api, refreshTick }) : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(TasksView, { api, refreshTick, onOpenReport, selectedTaskId })
  ] });
}
function TasksView({
  api,
  refreshTick,
  onOpenReport,
  selectedTaskId
}) {
  const t = useT();
  const mutation = useMutation(t);
  const [taskType, setTaskType] = (0, import_react13.useState)("");
  const [status, setStatus] = (0, import_react13.useState)("");
  const [page, setPage] = (0, import_react13.useState)(1);
  const [refresh, setRefresh] = (0, import_react13.useState)(0);
  const [selectedIds, setSelectedIds] = (0, import_react13.useState)([]);
  const [detailId, setDetailId] = (0, import_react13.useState)(selectedTaskId);
  const [createOpen, setCreateOpen] = (0, import_react13.useState)(false);
  const [mergeOpen, setMergeOpen] = (0, import_react13.useState)(false);
  const [createName, setCreateName] = (0, import_react13.useState)("");
  const [createType, setCreateType] = (0, import_react13.useState)("normal-dev");
  const [createSession, setCreateSession] = (0, import_react13.useState)("");
  const [mergeName, setMergeName] = (0, import_react13.useState)("");
  const [note, setNote] = (0, import_react13.useState)(null);
  const resource = useResource(
    (signal) => api.tasks(
      {
        taskType: taskType || void 0,
        status: status || void 0,
        limit: PAGE_SIZE3,
        offset: (page - 1) * PAGE_SIZE3
      },
      signal
    ),
    [taskType, status, page, refreshTick, refresh],
    t
  );
  const sessionsResource = useResource((signal) => api.sessions(50, signal), [refreshTick], t);
  const rows = resource.data?.rows ?? [];
  const total = resource.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE3));
  const unknown = t("common.unknown");
  const untitled = t("common.untitled");
  const selectedRows = rows.filter((row) => selectedIds.indexOf(row.id) >= 0);
  const selectedSessions = selectedRows.map((row) => row.sessionId).filter((value, index, all) => all.indexOf(value) === index);
  const canMerge = selectedRows.length >= 2 && selectedSessions.length === 1;
  const toggleSelect = (id) => {
    setSelectedIds((current) => current.indexOf(id) >= 0 ? current.filter((item) => item !== id) : current.concat([id]));
  };
  const patchTask = (id, patch) => {
    void mutation.run(async () => {
      await api.updateTask(id, patch);
      setRefresh((value) => value + 1);
    });
  };
  const openCreate = () => {
    setCreateName("");
    setCreateType("normal-dev");
    const live = (sessionsResource.data ?? []).filter((row) => !row.isSubagent);
    setCreateSession(live.length > 0 ? live[0].sessionId : "");
    setNote(null);
    setCreateOpen(true);
  };
  const submitCreate = () => {
    const name = createName.trim();
    if (!name) {
      setNote(t("tasks.nameEmpty"));
      return;
    }
    void mutation.run(async () => {
      await api.createTask({
        name,
        taskType: createType,
        sessionId: createSession || void 0
      });
      setCreateOpen(false);
      setNote(t("tasks.created"));
      setRefresh((value) => value + 1);
    });
  };
  const submitMerge = () => {
    const name = mergeName.trim();
    void mutation.run(async () => {
      await api.mergeTasks({ ids: selectedIds, name: name || void 0 });
      setMergeOpen(false);
      setSelectedIds([]);
      setNote(t("tasks.merged"));
      setRefresh((value) => value + 1);
    });
  };
  const exportSelected = () => {
    if (selectedIds.length !== 1) {
      setNote(t("tasks.selectOneForExport"));
      return;
    }
    void mutation.run(async () => {
      const payload = await api.exportTask(selectedIds[0], "markdown");
      downloadText(payload.filename, payload.contentType, payload.content);
      setNote(payload.filename);
    });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "tm-stack", children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "tm-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "tm-label", children: t("tasks.filter.type") }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
        Select,
        {
          value: taskType,
          className: "tm-select-fix",
          ariaLabel: t("tasks.filter.type"),
          options: [{ value: "", label: t("common.all") }].concat(TASK_TYPES.map((value) => ({ value, label: taskTypeLabel(value, t) }))),
          onChange: (value) => {
            setTaskType(value);
            setPage(1);
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
        Select,
        {
          value: status,
          className: "tm-select-fix",
          ariaLabel: t("tasks.filter.status"),
          options: [{ value: "", label: t("common.all") }].concat(TASK_STATUSES.map((value) => ({ value, label: t("status." + value) }))),
          onChange: (value) => {
            setStatus(value);
            setPage(1);
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Help, { text: t("tasks.helpList"), label: t("common.help") }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Button, { size: "sm", variant: "primary", onClick: openCreate, children: t("tasks.newTask") }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
        Button,
        {
          size: "sm",
          onClick: () => {
            setMergeName("");
            setMergeOpen(true);
          },
          disabled: !canMerge,
          title: t("tasks.mergeHint"),
          children: t("tasks.merge")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Button, { size: "sm", onClick: exportSelected, disabled: mutation.pending, children: t("tasks.exportReport") }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("span", { className: "tm-row-end", children: [
        mutation.error ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "tm-err", children: mutation.error }) : null,
        note ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "tm-note", children: note }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Pager, { page, pageCount, total, onPage: setPage })
      ] })
    ] }),
    resource.status === "loading" && resource.data === null ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Loading, {}) : null,
    resource.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(ErrorBox, { message: resource.error ?? t("error.generic"), onRetry: resource.reload }) : null,
    resource.status === "ready" && total === 0 ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Empty, { text: t("tasks.empty") }) : null,
    total > 0 ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "tm-tablewrap", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("table", { className: "tm-table", children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("tasks.table.select") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("tasks.table.name") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("tasks.table.project") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("tasks.table.type") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("tasks.table.status") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { className: "tm-num", children: t("tasks.table.calls") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { className: "tm-num", children: t("tasks.table.missInput") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { className: "tm-num", children: t("tasks.table.cacheRead") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { className: "tm-num", children: t("tasks.table.cacheWrite") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { className: "tm-num", children: t("tasks.table.output") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { className: "tm-num", children: t("tasks.table.total") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { className: "tm-num", children: t("tasks.table.cost") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { className: "tm-num", children: t("tasks.table.findings") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("tasks.table.started") })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("tbody", { children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(
        "tr",
        {
          className: "tm-clickable" + (row.id === selectedTaskId || row.id === detailId ? " tm-selected" : ""),
          onClick: () => setDetailId(row.id),
          title: t("tasks.openDetail"),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { onClick: (event) => event.stopPropagation(), children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
              "input",
              {
                type: "checkbox",
                className: "tm-check",
                "aria-label": t("tasks.table.select"),
                checked: selectedIds.indexOf(row.id) >= 0,
                onChange: () => toggleSelect(row.id)
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { className: "tm-cell-name", title: taskLabel(row.taskName, row.id, untitled), children: taskLabel(row.taskName, row.id, untitled) }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { className: "tm-cell-project", title: row.projectId, children: row.projectId }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { onClick: (event) => event.stopPropagation(), children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
              Select,
              {
                value: row.taskType,
                ariaLabel: t("tasks.table.type"),
                options: TASK_TYPES.map((value) => ({ value, label: taskTypeLabel(value, t) })),
                onChange: (value) => patchTask(row.id, { taskType: value, taskTypeSource: "manual" })
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { onClick: (event) => event.stopPropagation(), children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
              Select,
              {
                value: row.status,
                ariaLabel: t("tasks.table.status"),
                options: TASK_STATUSES.map((value) => ({ value, label: t("status." + value) })),
                onChange: (value) => patchTask(row.id, { status: value })
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { className: "tm-num", children: formatExact(row.calls) }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { className: "tm-num", title: formatExact(row.inputTokens), children: formatTokens(row.inputTokens) }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { className: "tm-num", title: formatExact(row.cacheReadTokens), children: formatTokens(row.cacheReadTokens) }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { className: "tm-num", title: formatExact(row.cacheWriteTokens), children: formatTokens(row.cacheWriteTokens) }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { className: "tm-num", title: formatExact(row.outputTokens), children: formatTokens(row.outputTokens) }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { className: "tm-num", title: formatExact(row.totalTokens), children: formatTokens(row.totalTokens) }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { className: "tm-num", children: formatCost(row.cost, t("common.noPrice")) }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { className: "tm-num", children: row.findingCount > 0 ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Pill, { tone: "warn", children: formatExact(row.findingCount) }) : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "tm-dim", children: "0" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { className: "tm-cell-time", title: String(row.startedAt), children: formatShortDateTime(row.startedAt) })
          ]
        },
        row.id
      )) })
    ] }) }) : null,
    createOpen ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
      Modal,
      {
        title: t("tasks.newTaskTitle"),
        help: t("tasks.help.create"),
        onClose: () => setCreateOpen(false),
        footer: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("span", { className: "tm-row-end", children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Button, { size: "sm", onClick: () => setCreateOpen(false), children: t("common.cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Button, { size: "sm", variant: "primary", onClick: submitCreate, disabled: mutation.pending, children: t("tasks.newTaskCreate") })
        ] }),
        children: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "tm-form-grid", children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "tm-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "tm-field-label", children: t("tasks.newTaskName") }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Input, { ariaLabel: t("tasks.newTaskName"), value: createName, onChange: setCreateName })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "tm-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "tm-field-label", children: t("tasks.newTaskType") }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
              Select,
              {
                value: createType,
                ariaLabel: t("tasks.newTaskType"),
                options: TASK_TYPES.map((value) => ({ value, label: taskTypeLabel(value, t) })),
                onChange: setCreateType
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "tm-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "tm-field-label", children: t("tasks.newTaskSession") }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
              Select,
              {
                value: createSession,
                ariaLabel: t("tasks.newTaskSession"),
                options: [{ value: "", label: t("context.sessionDefault") }].concat(
                  (sessionsResource.data ?? []).filter((row) => !row.isSubagent).map((row) => ({ value: row.sessionId, label: row.sessionId }))
                ),
                onChange: setCreateSession
              }
            )
          ] })
        ] })
      }
    ) : null,
    mergeOpen ? /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(
      Modal,
      {
        title: t("tasks.mergeTitle"),
        help: t("tasks.help.merge"),
        onClose: () => setMergeOpen(false),
        footer: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("span", { className: "tm-row-end", children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Button, { size: "sm", onClick: () => setMergeOpen(false), children: t("common.cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Button, { size: "sm", variant: "primary", onClick: submitMerge, disabled: mutation.pending || !canMerge, children: t("tasks.mergeConfirm") })
        ] }),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "tm-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("span", { className: "tm-field-label", children: [
              t("tasks.mergeSelected"),
              " ",
              selectedRows.length
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Input, { ariaLabel: t("tasks.mergeName"), value: mergeName, onChange: setMergeName, placeholder: t("tasks.mergeName") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "tm-note", children: t("tasks.mergeHint") })
        ]
      }
    ) : null,
    detailId ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
      TaskDetailDrawer,
      {
        api,
        taskId: detailId,
        onClose: () => setDetailId(null),
        onChanged: () => setRefresh((value) => value + 1),
        onOpenReport: (taskId) => {
          setDetailId(null);
          onOpenReport(taskId);
        }
      }
    ) : null
  ] });
}

// src/client/overlay.tsx
var import_react14 = require("react");
var import_jsx_runtime14 = require("react/jsx-runtime");
var HIDDEN_KEY = "dsh-token-manager.liveStrip.hidden.v2";
function readHidden() {
  try {
    return window.localStorage.getItem(HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}
function writeHidden(hidden) {
  try {
    window.localStorage.setItem(HIDDEN_KEY, hidden ? "1" : "0");
  } catch {
  }
}
function LiveBar({ api, t, open }) {
  const [data, setData] = (0, import_react14.useState)(null);
  const [hidden, setHidden] = (0, import_react14.useState)(() => readHidden());
  const [note, setNote] = (0, import_react14.useState)(null);
  const autoTried = (0, import_react14.useRef)(false);
  (0, import_react14.useEffect)(() => {
    if (hidden) return void 0;
    let alive = true;
    const tick = async () => {
      try {
        const next = await api.live();
        if (alive) setData(next);
        if (alive && next && !next.pricing.configured && !autoTried.current) {
          autoTried.current = true;
          try {
            const applied = await api.applyReferencePrices();
            if (alive && applied.applied > 0) setData(await api.live());
          } catch {
          }
        }
      } catch {
      }
    };
    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, LIVE_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [api, hidden]);
  const priceLabel = (0, import_react14.useMemo)(() => {
    if (!data) return "\u2014";
    if (!data.pricing.configured || data.pricing.savedCost === null) return t("live.priceUnset");
    const amount = data.pricing.savedCost;
    const digits = amount >= 1 ? 2 : 4;
    return `${data.pricing.currency ?? ""} ${amount.toFixed(digits)}`;
  }, [data, t]);
  const risk = data?.risk ?? null;
  const ratioLabel = (0, import_react14.useMemo)(() => {
    if (!risk || risk.ratio === null) return null;
    return `${(risk.ratio * 100).toFixed(risk.ratio < 0.1 ? 1 : 0)}%`;
  }, [risk]);
  if (hidden) {
    return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      "button",
      {
        type: "button",
        className: "tm-livebar-collapsed",
        title: t("live.show"),
        "aria-label": t("live.show"),
        onClick: () => {
          writeHidden(false);
          setHidden(false);
        },
        children: t("live.show")
      }
    );
  }
  if (data && !data.ui.overlay) return null;
  const loadReference = async () => {
    try {
      const result = await api.applyReferencePrices();
      if (result.applied > 0) {
        setNote(null);
        const next = await api.live();
        setData(next);
      } else {
        setNote(t("live.referenceNone"));
      }
    } catch {
      setNote(t("live.referenceNone"));
    }
  };
  const barWidth = risk && risk.ratio !== null ? Math.max(1.5, Math.min(100, risk.ratio * 100)) : 0;
  const markerLeft = risk && risk.ratio !== null ? Math.max(1, Math.min(99, risk.ratio * 100)) : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "tm-livebar", role: "status", title: t("live.hint"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "tm-livebar-row", children: [
      ratioLabel ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "tm-livebar-context", title: risk?.contextWindow ? `${formatTokens(risk.surfaceTokens ?? 0)} / ${formatTokens(risk.contextWindow)}` : void 0, children: ratioLabel }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("button", { type: "button", className: "tm-livebar-main", onClick: open, children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: "tm-livebar-item", children: [
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("b", { children: data?.session ? formatTokens(data.session.calls) : "\u2014" }),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("em", { children: t("live.calls") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: "tm-livebar-item tm-livebar-strong", children: [
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("b", { children: data?.session ? formatTokens(data.session.total) : "\u2014" }),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("em", { children: t("live.sessionTokens") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: "tm-livebar-item", children: [
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("b", { children: risk && risk.surfaceTokens !== null ? formatTokens(risk.surfaceTokens) : "\u2014" }),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("em", { children: t("live.context") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: "tm-livebar-item", children: [
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("b", { children: data ? formatTokens(data.saved.tokens) : "\u2014" }),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("em", { children: t("live.saved") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: "tm-livebar-item tm-livebar-price", children: [
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("b", { children: priceLabel }),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("em", { children: t("live.savedCost") })
        ] })
      ] }),
      data && !data.pricing.configured ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
        "button",
        {
          type: "button",
          className: "tm-livebar-action",
          onClick: (event) => {
            event.stopPropagation();
            void loadReference();
          },
          children: t("live.loadReference")
        }
      ) : null,
      note ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "tm-livebar-note", children: note }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
        "button",
        {
          type: "button",
          className: "tm-livebar-hide",
          "aria-label": t("live.hide"),
          title: t("live.hide"),
          onClick: (event) => {
            event.stopPropagation();
            writeHidden(true);
            setHidden(true);
          },
          children: "\xD7"
        }
      )
    ] }),
    risk && ratioLabel ? /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "tm-livebar-track", "aria-hidden": "true", children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "tm-livebar-bar", style: { width: `${barWidth}%` } }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "tm-livebar-marker", style: { left: `${markerLeft}%` }, title: t("live.compressMarker") })
    ] }) : null
  ] });
}

// src/client/styles.css
var styles_default = '/* DSH Token Manager \u2014 \u6DF1\u8272\u4F18\u5148\u7684\u7D27\u51D1\u4EEA\u8868\u76D8\u6837\u5F0F\u3002\u53EA\u7528 var(--dsw-*) \u4E3B\u9898 token\u3002 */\r\n.tm-page {\r\n  display: flex;\r\n  flex-direction: column;\r\n  height: 100%;\r\n  min-height: 0;\r\n  box-sizing: border-box;\r\n  padding-top: var(--dsh-frame-top-clearance, 48px);\r\n  background: var(--dsw-alias-bg-base);\r\n  color: var(--dsw-alias-label-primary);\r\n  font-family: var(--dsh-font-family-text), system-ui, -apple-system, "Segoe UI", sans-serif;\r\n  font-size: 13px;\r\n  line-height: 1.45;\r\n}\r\n\r\n/* ---------- \u9876\u90E8\uFF1A\u6807\u9898 / \u64CD\u4F5C ---------- */\r\n.tm-head { display: flex; align-items: center; gap: 8px; padding: 10px 16px 0; flex: none; }\r\n.tm-title { margin: 0; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 6px; }\r\n.tm-head-spacer { flex: 1 1 auto; }\r\n.tm-head-status { font-size: 11px; color: var(--dsw-alias-label-tertiary); }\r\n\r\n/* ---------- \u6807\u7B7E\u680F ---------- */\r\n.tm-tabs {\r\n  display: flex; align-items: flex-end; gap: 2px; padding: 8px 16px 0; flex: none;\r\n  border-bottom: 1px solid var(--dsw-alias-border-l1);\r\n  /* \u7A84\u5C4F\u5355\u884C\u6A2A\u5411\u6EDA\u52A8\uFF0C\u9690\u85CF\u6EDA\u52A8\u6761\uFF1B1600/897 \u5185\u5BB9\u4E0D\u8D85\u5BBD\u65F6\u4E0D\u4F1A\u51FA\u73B0\u6EDA\u52A8\u6761 */\r\n  flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden;\r\n  scrollbar-width: none; -ms-overflow-style: none; scroll-behavior: smooth;\r\n}\r\n.tm-tabs::-webkit-scrollbar { width: 0; height: 0; display: none; }\r\n.tm-tab {\r\n  height: 29px; padding: 0 12px; border: 1px solid transparent; border-bottom: none;\r\n  border-radius: var(--dsw-radius-md) var(--dsw-radius-md) 0 0;\r\n  background: transparent; color: var(--dsw-alias-label-secondary);\r\n  font: inherit; font-size: 13px; cursor: pointer;\r\n  flex: 0 0 auto; white-space: nowrap;\r\n  display: inline-flex; align-items: center;\r\n}\r\n.tm-tab:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }\r\n.tm-tab[aria-selected="true"] {\r\n  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);\r\n  border-color: var(--dsw-alias-border-l1);\r\n}\r\n.tm-tab:focus-visible { outline: none; box-shadow: 0 0 0 var(--dsw-focus-ring-width, 2px) var(--dsw-focus-ring-color); }\r\n\r\n/* ---------- \u5185\u5BB9\u533A ---------- */\r\n.tm-body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 12px 16px 10px; display: flex; flex-direction: column; gap: 10px; }\r\n.tm-stack { display: flex; flex-direction: column; gap: 10px; }\r\n.tm-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }\r\n.tm-row-end { margin-left: auto; display: flex; align-items: center; gap: 8px; }\r\n.tm-label { font-size: 12px; color: var(--dsw-alias-label-secondary); }\r\n.tm-dim { color: var(--dsw-alias-label-tertiary); }\r\n.tm-mono { font-family: var(--dsh-font-family-code), ui-monospace, monospace; font-size: 12px; }\r\n\r\n/* ---------- \u5361\u7247 ---------- */\r\n.tm-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(148px, 1fr)); gap: 8px; }\r\n.tm-card {\r\n  display: flex; flex-direction: column; gap: 2px; min-width: 0;\r\n  padding: 9px 11px; border: 1px solid var(--dsw-alias-border-l1);\r\n  border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1);\r\n}\r\n.tm-card-label { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }\r\n.tm-card-value { font-size: 19px; font-weight: 600; line-height: 1.25; font-variant-numeric: tabular-nums; }\r\n.tm-card-value-sm { font-size: 15px; }\r\n.tm-card-hint { font-size: 11px; color: var(--dsw-alias-label-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\r\n\r\n/* ---------- \u5206\u533A ---------- */\r\n.tm-section { border: 1px solid var(--dsw-alias-border-l1); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }\r\n.tm-section-head { display: flex; align-items: center; gap: 6px; }\r\n.tm-section-title { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 4px; }\r\n.tm-section-sub { font-size: 11px; color: var(--dsw-alias-label-tertiary); }\r\n.tm-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 10px; align-items: start; }\r\n.tm-cols-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; align-items: start; }\r\n\r\n/* ---------- \u8868\u683C ---------- */\r\n.tm-tablewrap { border: 1px solid var(--dsw-alias-border-l1); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); overflow: auto; max-width: 100%; }\r\n.tm-table { border-collapse: collapse; width: 100%; font-size: 12px; }\r\n.tm-table th, .tm-table td { padding: 5px 8px; text-align: left; border-bottom: 1px solid var(--dsw-alias-border-l1); white-space: nowrap; }\r\n.tm-table thead th { position: sticky; top: 0; z-index: 2; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-weight: 500; }\r\n.tm-table tbody tr:last-child td { border-bottom: none; }\r\n.tm-table tbody tr:hover { background: var(--dsw-alias-interactive-bg-hover); }\r\n.tm-table tr.tm-clickable { cursor: pointer; }\r\n.tm-table tr.tm-selected { background: var(--dsw-alias-interactive-bg-active); }\r\n.tm-num { text-align: right; font-variant-numeric: tabular-nums; }\r\n.tm-sort { border: none; background: transparent; color: inherit; font: inherit; font-size: 12px; cursor: pointer; padding: 0; display: inline-flex; align-items: center; gap: 3px; }\r\n.tm-sort:hover { color: var(--dsw-alias-label-primary); }\r\n.tm-sort-arrow { color: var(--dsw-alias-label-tertiary); font-size: 10px; }\r\n\r\n/* ---------- \u6309\u94AE / \u8F93\u5165 ---------- */\r\n.tm-btn {\r\n  height: 26px; padding: 0 10px; box-sizing: border-box;\r\n  border-radius: var(--dsw-radius-xs); border: 1px solid var(--dsw-alias-border-l2);\r\n  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);\r\n  font: inherit; font-size: 12px; cursor: pointer;\r\n  display: inline-flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap;\r\n  text-decoration: none;\r\n}\r\n.tm-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }\r\n.tm-btn:active { background: var(--dsw-alias-interactive-bg-active); }\r\n.tm-btn:disabled { opacity: 0.5; cursor: default; }\r\n.tm-btn:focus-visible { outline: none; box-shadow: 0 0 0 var(--dsw-focus-ring-width, 2px) var(--dsw-focus-ring-color); }\r\n.tm-btn-primary { background: var(--dsw-alias-brand-primary); border-color: transparent; color: var(--dsw-alias-bg-base); font-weight: 500; }\r\n.tm-btn-primary:hover { background: var(--dsw-alias-brand-primary); filter: brightness(1.1); }\r\n.tm-btn-danger { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); background: transparent; }\r\n.tm-btn-danger:hover { background: var(--dsw-alias-interactive-bg-hover); }\r\n.tm-btn-sm { height: 22px; padding: 0 7px; font-size: 11px; }\r\n\r\n.tm-input, .tm-select {\r\n  height: 26px; box-sizing: border-box; padding: 0 7px;\r\n  border-radius: var(--dsw-radius-xs); border: 1px solid var(--dsw-alias-border-l2);\r\n  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);\r\n  font: inherit; font-size: 12px;\r\n}\r\n.tm-input:focus, .tm-select:focus { outline: none; border-color: var(--dsw-focus-ring-color); }\r\n.tm-input-sm { width: 92px; }\r\n.tm-input-mid { width: 140px; }\r\n.tm-select { min-width: 108px; }\r\n\r\n/* \u5206\u6BB5\u9009\u62E9 chips */\r\n.tm-chips { display: inline-flex; align-items: center; gap: 2px; padding: 2px; border: 1px solid var(--dsw-alias-border-l1); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); }\r\n.tm-chip { height: 22px; padding: 0 8px; border-radius: var(--dsw-radius-xs); border: 1px solid transparent; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; }\r\n.tm-chip:hover { color: var(--dsw-alias-label-primary); }\r\n.tm-chip[aria-pressed="true"] { background: var(--dsw-alias-bg-layer-3); border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }\r\n.tm-chip:focus-visible { outline: none; box-shadow: 0 0 0 var(--dsw-focus-ring-width, 2px) var(--dsw-focus-ring-color); }\r\n\r\n/* \u5F00\u5173 */\r\n.tm-switch { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; font-size: 12px; }\r\n.tm-switch input { position: absolute; opacity: 0; width: 0; height: 0; }\r\n.tm-switch-track { width: 30px; height: 17px; border-radius: 9px; background: var(--dsw-alias-bg-layer-3); border: 1px solid var(--dsw-alias-border-l2); position: relative; flex: none; transition: background 120ms ease; }\r\n.tm-switch-thumb { position: absolute; top: 1px; left: 1px; width: 13px; height: 13px; border-radius: 50%; background: var(--dsw-alias-label-tertiary); transition: left 120ms ease, background 120ms ease; }\r\n.tm-switch input:checked + .tm-switch-track { background: var(--dsw-alias-state-business-primary); border-color: transparent; }\r\n.tm-switch input:checked + .tm-switch-track .tm-switch-thumb { left: 14px; background: var(--dsw-alias-bg-base); }\r\n.tm-switch input:focus-visible + .tm-switch-track { box-shadow: 0 0 0 var(--dsw-focus-ring-width, 2px) var(--dsw-focus-ring-color); }\r\n.tm-switch input:disabled + .tm-switch-track { opacity: 0.5; }\r\n\r\n/* ---------- \u5E2E\u52A9\u56FE\u6807\uFF08\u8BF4\u660E\u7C7B\u6587\u6848\u552F\u4E00\u51FA\u53E3\uFF09 ---------- */\r\n.tm-help { position: relative; display: inline-flex; vertical-align: middle; }\r\n.tm-help-btn {\r\n  width: 15px; height: 15px; padding: 0; flex: none;\r\n  border-radius: 50%; border: 1px solid var(--dsw-alias-border-l3);\r\n  background: transparent; color: var(--dsw-alias-label-tertiary);\r\n  font-size: 10px; line-height: 1; cursor: pointer;\r\n  display: inline-flex; align-items: center; justify-content: center;\r\n}\r\n.tm-help-btn:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l4); }\r\n.tm-help.is-open .tm-help-btn { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l4); }\r\n.tm-help-tip {\r\n  display: none; position: absolute; z-index: 60; top: calc(100% + 6px); left: 0;\r\n  width: max-content; max-width: min(280px, 70vw);\r\n  padding: 7px 9px; border-radius: var(--dsw-radius-md);\r\n  background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary);\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  font-size: 11px; font-weight: 400; line-height: 1.55; text-align: left; white-space: normal;\r\n}\r\n.tm-help:hover .tm-help-tip, .tm-help:focus-within .tm-help-tip, .tm-help.is-open .tm-help-tip { display: block; }\r\n\r\n/* ---------- \u72B6\u6001 ---------- */\r\n.tm-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 22px 12px; color: var(--dsw-alias-label-tertiary); font-size: 12px; text-align: center; }\r\n.tm-error { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--dsw-radius-md); border: 1px solid var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); font-size: 12px; }\r\n.tm-loading { display: flex; align-items: center; justify-content: center; padding: 22px 12px; color: var(--dsw-alias-label-tertiary); font-size: 12px; }\r\n.tm-note { font-size: 11px; color: var(--dsw-alias-label-tertiary); }\r\n.tm-ok { color: var(--dsw-alias-state-success-primary); }\r\n.tm-warn { color: var(--dsw-alias-state-warn-primary); }\r\n.tm-err { color: var(--dsw-alias-state-error-primary); }\r\n.tm-pill { display: inline-flex; align-items: center; height: 18px; padding: 0 6px; border-radius: var(--dsw-radius-xs); font-size: 11px; border: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); }\r\n.tm-pill-info { color: var(--dsw-alias-state-business-primary); border-color: var(--dsw-alias-state-business-primary); }\r\n.tm-pill-warn { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); }\r\n.tm-pill-high { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }\r\n.tm-pill-ok { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }\r\n\r\n/* ---------- \u5206\u9875 ---------- */\r\n.tm-pager { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--dsw-alias-label-tertiary); }\r\n\r\n/* ---------- \u56FE\u8868 ---------- */\r\n.tm-chart { width: 100%; display: block; overflow: visible; }\r\n.tm-chart-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11px; color: var(--dsw-alias-label-secondary); }\r\n.tm-legend-item { display: inline-flex; align-items: center; gap: 4px; }\r\n.tm-legend-dot { width: 8px; height: 8px; border-radius: 2px; flex: none; }\r\n.tm-chart-empty { padding: 18px 0; text-align: center; color: var(--dsw-alias-label-tertiary); font-size: 12px; }\r\n.tm-rank { display: flex; flex-direction: column; gap: 5px; }\r\n.tm-rank-row { display: flex; align-items: center; gap: 6px; font-size: 12px; }\r\n.tm-rank-name { flex: none; width: 96px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-secondary); }\r\n.tm-rank-bar { flex: 1 1 auto; height: 7px; border-radius: 4px; background: var(--dsw-alias-bg-mask-2); overflow: hidden; min-width: 40px; }\r\n.tm-rank-fill { height: 100%; border-radius: 4px; background: var(--dsw-alias-state-business-primary); }\r\n.tm-rank-value { flex: none; width: 68px; text-align: right; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary); }\r\n\r\n/* ---------- \u8BBE\u7F6E ---------- */\r\n.tm-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }\r\n.tm-field { display: flex; flex-direction: column; gap: 3px; min-width: 0; }\r\n.tm-field-label { font-size: 11px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }\r\n.tm-toggles { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 6px 14px; }\r\n.tm-price-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(112px, 1fr)); gap: 6px; align-items: end; }\r\n\r\n/* ---------- \u9875\u811A ---------- */\r\n.tm-footer { flex: none; display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 6px 16px 8px; font-size: 11px; color: var(--dsw-alias-label-tertiary); }\r\n.tm-footer-brand { color: var(--dsw-alias-label-tertiary); }\r\n\r\n/* ---------- \u54CD\u5E94\u5F0F\uFF1A1600 / 897 / 390 ---------- */\r\n@media (max-width: 1100px) {\r\n  .tm-page { font-size: 12.5px; }\r\n  .tm-body { padding: 10px 12px 8px; }\r\n  .tm-head, .tm-tabs, .tm-footer { padding-left: 12px; padding-right: 12px; }\r\n  .tm-cols { grid-template-columns: 1fr; }\r\n  .tm-rank-name { width: 84px; }\r\n}\r\n@media (max-width: 640px) {\r\n  .tm-cards { grid-template-columns: 1fr 1fr; }\r\n  .tm-cols, .tm-cols-3, .tm-toggles, .tm-form-grid, .tm-price-form { grid-template-columns: 1fr; }\r\n  .tm-head { flex-wrap: wrap; }\r\n  .tm-tabs { overflow-x: auto; }\r\n  .tm-tab { padding: 0 9px; font-size: 12px; }\r\n  .tm-card-value { font-size: 17px; }\r\n  .tm-rank-name { width: 72px; }\r\n  .tm-input-sm, .tm-input-mid, .tm-select { width: 100%; }\r\n}\r\n/* ---------- SVG \u56FE\u8868\u7EC6\u8282 ---------- */\r\n.tm-line { fill: none; stroke: var(--dsw-alias-state-business-primary); stroke-width: 1.6; stroke-linejoin: round; stroke-linecap: round; }\r\n.tm-area { fill: var(--dsw-alias-state-business-primary); opacity: 0.13; stroke: none; }\r\n.tm-grid { stroke: var(--dsw-alias-border-l1); stroke-width: 1; }\r\n.tm-axis { fill: var(--dsw-alias-label-tertiary); font-size: 9px; }\r\n.tm-dot { fill: var(--dsw-alias-state-business-primary); stroke: var(--dsw-alias-bg-layer-1); stroke-width: 1; }\r\n.tm-bar { fill: var(--dsw-alias-state-business-primary); opacity: 0.85; }\r\n.tm-bar:hover { opacity: 1; }\r\n.tm-donut { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }\r\n.tm-donut-chart { flex: none; }\r\n.tm-donut-track { stroke: var(--dsw-alias-bg-mask-2); }\r\n.tm-donut-seg { transition: opacity 120ms ease; }\r\n.tm-donut-seg:hover { opacity: 0.82; }\r\n.tm-legend { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1 1 140px; }\r\n.tm-legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--dsw-alias-label-secondary); min-width: 0; }\r\n.tm-legend-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\r\n.tm-legend-value { flex: none; color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; }\r\n.tm-legend-dot { width: 8px; height: 8px; border-radius: 2px; flex: none; }\r\n.tm-fill-1 { stroke: var(--dsw-alias-state-business-primary); }\r\n.tm-fill-2 { stroke: var(--dsw-alias-state-success-primary); }\r\n.tm-fill-3 { stroke: var(--dsw-alias-state-warn-primary); }\r\n.tm-fill-4 { stroke: var(--dsw-alias-brand-primary); }\r\n.tm-fill-5 { stroke: var(--dsw-alias-label-tertiary); }\r\n.tm-dot-1 { background: var(--dsw-alias-state-business-primary); }\r\n.tm-dot-2 { background: var(--dsw-alias-state-success-primary); }\r\n.tm-dot-3 { background: var(--dsw-alias-state-warn-primary); }\r\n.tm-dot-4 { background: var(--dsw-alias-brand-primary); }\r\n.tm-dot-5 { background: var(--dsw-alias-label-tertiary); }\r\n/* ---------- \u7EC4\u4EF6\u8865\u5145 ---------- */\r\n.tm-clickable { cursor: pointer; }\r\n.tm-rank-row.tm-clickable:hover { color: var(--dsw-alias-label-primary); }\r\n.tm-rank-fill { display: block; }\r\n.tm-rank-bar { display: block; }\r\n.tm-panel-icon { display: inline-flex; align-items: center; justify-content: center; width: 100%; height: 100%; cursor: pointer; color: inherit; }\r\n.tm-findings { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; max-height: 320px; overflow: auto; }\r\n.tm-finding { display: flex; flex-direction: column; gap: 2px; padding-bottom: 6px; border-bottom: 1px solid var(--dsw-alias-border-l1); font-size: 12px; min-width: 0; }\r\n.tm-finding:last-child { border-bottom: none; padding-bottom: 0; }\r\n.tm-finding-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }\r\n.tm-finding-kind { font-weight: 500; color: var(--dsw-alias-label-primary); }\r\n.tm-finding-subject { color: var(--dsw-alias-label-primary); word-break: break-word; }\r\n.tm-finding-detail { color: var(--dsw-alias-label-secondary); font-size: 11px; word-break: break-word; }\r\n.tm-finding-evidence { color: var(--dsw-alias-label-tertiary); font-size: 11px; white-space: pre-wrap; word-break: break-word; }\r\n.tm-suggestions { margin: 0; padding-left: 18px; font-size: 12px; color: var(--dsw-alias-label-secondary); display: flex; flex-direction: column; gap: 3px; }\r\n.tm-suggestions li { word-break: break-word; }\r\n.tm-table-plain { background: transparent; }\r\n.tm-table-plain thead th { position: static; background: transparent; }\r\n.tm-donut { align-items: center; }\r\n/* ---------- \u684C\u9762\u7AEF\u5BF9\u9F50\u8865\u5145\uFF1A\u7B5B\u9009\u4E0B\u62C9\u56FA\u5B9A\u5BBD\u5EA6 / \u9608\u503C 6 \u5217 ---------- */\r\n.tm-select-fix { width: 180px; }\r\n.tm-form-grid-6 { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }\r\n@media (max-width: 1100px) {\r\n  .tm-form-grid-6 { grid-template-columns: repeat(4, minmax(0, 1fr)); }\r\n  .tm-select-fix { width: 150px; }\r\n}\r\n@media (max-width: 640px) {\r\n  .tm-form-grid-6 { grid-template-columns: 1fr; }\r\n  .tm-select-fix { width: 100%; }\r\n}\r\n/* ---------- \u5361\u7247\u6805\u683C\uFF1A\u684C\u9762\u56FA\u5B9A\u5217\u6570\uFF0C\u907F\u514D 897 \u51FA\u73B0\u5B64\u884C ---------- */\r\n.tm-cards-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }\r\n.tm-cards-6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }\r\n@media (max-width: 1100px) {\r\n  .tm-cards-6 { grid-template-columns: repeat(3, minmax(0, 1fr)); }\r\n}\r\n@media (max-width: 640px) {\r\n  .tm-cards-4, .tm-cards-6 { grid-template-columns: repeat(2, minmax(0, 1fr)); }\r\n}\r\n/* \u6298\u7EBF\u56FE\u5355\u70B9\u6807\u6CE8\uFF081 \u4E2A\u6570\u636E\u70B9\u65F6\u4E0D\u753B\u659C\u7EBF\u4E09\u89D2\u5F62\uFF09 */\r\n.tm-axis-label { fill: var(--dsw-alias-label-secondary); font-size: 11px; }\r\n/* ---------- Phase 2\uFF1A\u539F\u6587\u67E5\u770B\u62BD\u5C49 ---------- */\r\n.tm-drawer-backdrop {\r\n  position: fixed;\r\n  inset: 0;\r\n  z-index: 90;\r\n  background: var(--dsw-alias-bg-mask-1);\r\n  display: flex;\r\n  justify-content: flex-end;\r\n}\r\n.tm-drawer {\r\n  width: min(720px, 94vw);\r\n  height: 100%;\r\n  display: flex;\r\n  flex-direction: column;\r\n  background: var(--dsw-alias-bg-layer-1);\r\n  border-left: 1px solid var(--dsw-alias-border-l2);\r\n}\r\n.tm-drawer-head {\r\n  flex: none;\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 8px;\r\n  padding: 9px 14px;\r\n  border-bottom: 1px solid var(--dsw-alias-border-l1);\r\n}\r\n.tm-drawer-body {\r\n  flex: 1 1 auto;\r\n  min-height: 0;\r\n  overflow: auto;\r\n  padding: 10px 14px;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 8px;\r\n}\r\n.tm-drawer-foot {\r\n  flex: none;\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 10px;\r\n  padding: 8px 14px;\r\n  border-top: 1px solid var(--dsw-alias-border-l1);\r\n  font-size: 11px;\r\n  color: var(--dsw-alias-label-tertiary);\r\n}\r\n.tm-kv {\r\n  display: grid;\r\n  grid-template-columns: max-content minmax(0, 1fr);\r\n  gap: 3px 10px;\r\n  margin: 0;\r\n  font-size: 12px;\r\n}\r\n.tm-kv dt { color: var(--dsw-alias-label-tertiary); }\r\n.tm-kv dd { margin: 0; color: var(--dsw-alias-label-primary); word-break: break-all; }\r\n.tm-viewer-pre {\r\n  margin: 0;\r\n  padding: 8px 10px;\r\n  border-radius: var(--dsw-radius-md);\r\n  background: var(--dsw-alias-markdown-code-block);\r\n  color: var(--dsw-alias-label-secondary);\r\n  font-family: var(--dsh-font-family-code), ui-monospace, monospace;\r\n  font-size: 11px;\r\n  line-height: 1.5;\r\n  white-space: pre-wrap;\r\n  word-break: break-word;\r\n}\r\n@media (max-width: 640px) {\r\n  .tm-drawer { width: 100%; }\r\n}\r\n/* ---------- Phase 3\uFF1A\u4E0A\u4E0B\u6587\u5206\u6790 ---------- */\r\n.tm-stackbar {\r\n  display: flex;\r\n  height: 10px;\r\n  border-radius: 5px;\r\n  overflow: hidden;\r\n  background: var(--dsw-alias-bg-mask-2);\r\n}\r\n.tm-stackbar-seg { display: block; height: 100%; }\r\n.tm-source-list {\r\n  list-style: none;\r\n  margin: 0;\r\n  padding: 0;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 4px;\r\n  max-height: 240px;\r\n  overflow: auto;\r\n}\r\n.tm-source-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--dsw-alias-label-secondary); }\r\n.tm-source-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\r\n.tm-source-value { flex: none; color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; }\r\n.tm-occ { display: flex; flex-direction: column; gap: 6px; padding: 6px 0 8px; }\r\n.tm-occ .tm-table { font-size: 11px; }\r\n@media (max-width: 640px) {\r\n  .tm-source-name { max-width: 42vw; }\r\n}\r\n/* ---------- Phase 4\uFF1A\u6A21\u6001\u6846 / \u591A\u884C\u6587\u672C / \u6458\u8981\u7F51\u683C ---------- */\r\n.tm-modal-backdrop {\r\n  position: fixed;\r\n  inset: 0;\r\n  z-index: 95;\r\n  background: var(--dsw-alias-bg-mask-1);\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  padding: 16px;\r\n}\r\n.tm-modal {\r\n  width: min(560px, 94vw);\r\n  max-height: 86vh;\r\n  display: flex;\r\n  flex-direction: column;\r\n  background: var(--dsw-alias-bg-layer-1);\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: var(--dsw-radius-md);\r\n}\r\n.tm-modal-head {\r\n  flex: none;\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 8px;\r\n  padding: 10px 14px;\r\n  border-bottom: 1px solid var(--dsw-alias-border-l1);\r\n}\r\n.tm-modal-body {\r\n  flex: 1 1 auto;\r\n  min-height: 0;\r\n  overflow: auto;\r\n  padding: 12px 14px;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 10px;\r\n}\r\n.tm-modal-foot {\r\n  flex: none;\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: flex-end;\r\n  gap: 8px;\r\n  padding: 8px 14px;\r\n  border-top: 1px solid var(--dsw-alias-border-l1);\r\n}\r\n.tm-textarea {\r\n  width: 100%;\r\n  box-sizing: border-box;\r\n  min-height: 46px;\r\n  padding: 6px 8px;\r\n  border-radius: var(--dsw-radius-xs);\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  background: var(--dsw-alias-bg-base);\r\n  color: var(--dsw-alias-label-primary);\r\n  font: inherit;\r\n  font-size: 12px;\r\n  line-height: 1.5;\r\n  resize: vertical;\r\n}\r\n.tm-textarea:focus { outline: none; border-color: var(--dsw-focus-ring-color); }\r\n.tm-summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px; }\r\n.tm-summary-field { min-width: 0; }\r\n.tm-drawer-wide { width: min(960px, 96vw); }\r\n.tm-check {\r\n  width: 13px;\r\n  height: 13px;\r\n  margin: 0;\r\n  cursor: pointer;\r\n  accent-color: var(--dsw-alias-state-business-primary);\r\n}\r\n@media (max-width: 640px) {\r\n  .tm-summary-grid { grid-template-columns: 1fr; }\r\n  .tm-drawer-wide { width: 100%; }\r\n}\r\n/* ---------- Phase 4 \u4FEE\u6B63\uFF1A\u4EFB\u52A1\u8868\u5217\u5BBD\u6536\u655B\uFF0C1600 \u4E0B\u4E0D\u518D\u6A2A\u5411\u88C1\u5207 ---------- */\r\n.tm-page { overflow: hidden; }\r\n.tm-cell-name { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\r\n.tm-cell-project { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\r\n.tm-cell-time { white-space: nowrap; }\r\n.tm-table .tm-select { min-width: 0; width: 104px; padding: 0 4px; }\r\n.tm-table td.tm-num, .tm-table th.tm-num { padding-left: 6px; padding-right: 6px; }\r\n@media (max-width: 1100px) {\r\n  .tm-cell-name { max-width: 150px; }\r\n  .tm-cell-project { max-width: 110px; }\r\n}\r\n@media (max-width: 640px) {\r\n  .tm-cell-name { max-width: 120px; }\r\n  .tm-cell-project { max-width: 90px; }\r\n}\r\n/* ============================ Phase 5\uFF1A\u7A84\u5C4F\u6807\u7B7E\u680F\u6A2A\u5411\u6EDA\u52A8 + \u6EA2\u51FA\u81EA\u67E5\u4FEE\u6B63 ============================ */\r\n\r\n/* \u6807\u7B7E\u680F\uFF1A\u5355\u884C\u6A2A\u5411\u6EDA\u52A8\uFF0C\u9690\u85CF\u6EDA\u52A8\u6761\uFF081600/897 \u4E0D\u51FA\u73B0\u6EDA\u52A8\u6761\uFF0C390 \u53EF\u6ED1\u52A8\uFF09 */\r\n\r\n/* \u9875\u9762\u4E3B\u4F53\u53EA\u7EB5\u5411\u6EDA\u52A8\uFF1A\u6A2A\u5411\u6EA2\u51FA\u4EA4\u7ED9\u5404\u8868\u683C\u5BB9\u5668\u81EA\u5DF1\u5904\u7406 */\r\n.tm-body { overflow-x: hidden; }\r\n.tm-tablewrap { min-width: 0; }\r\n\r\n/* \u5206\u533A\u6807\u9898/\u5DE5\u5177\u884C\u53EF\u6362\u884C\uFF0C\u907F\u514D 390 \u4E0B\u6EA2\u51FA */\r\n.tm-section-head { flex-wrap: wrap; row-gap: 4px; }\r\n.tm-row-end { flex-wrap: wrap; }\r\n.tm-pager { flex-wrap: wrap; row-gap: 4px; }\r\n\r\n/* \u62BD\u5C49/\u5F39\u7A97\u5E95\u90E8\u6309\u94AE\u884C\u53EF\u6362\u884C */\r\n.tm-drawer-foot, .tm-modal-foot { flex-wrap: wrap; row-gap: 6px; }\r\n\r\n/* \u7A84\u5C4F\uFF1A\u5E2E\u52A9\u6C14\u6CE1\u6539\u4E3A\u5E95\u90E8\u6D6E\u5C42\uFF0C\u5F7B\u5E95\u907F\u514D\u6C14\u6CE1\u6A2A\u5411\u6EA2\u51FA/\u88AB\u88C1\u5207 */\r\n@media (max-width: 640px) {\r\n  .tm-help-tip {\r\n    position: fixed;\r\n    left: 12px;\r\n    right: 12px;\r\n    bottom: 16px;\r\n    top: auto;\r\n    width: auto;\r\n    max-width: none;\r\n    transform: none;\r\n    z-index: 70;\r\n  }\r\n  .tm-head { row-gap: 4px; }\r\n  .tm-drawer-head { flex-wrap: wrap; row-gap: 4px; }\r\n}\r\n/* \u53F3\u5BF9\u9F50\u5DE5\u5177\u884C\u91CC\u7684\u5E2E\u52A9\u6C14\u6CE1\u6539\u4E3A\u53F3\u951A\u5B9A\uFF0C\u907F\u514D\u8D34\u53F3\u8FB9\u7F18\u65F6\u88AB\u88C1\u5207 */\r\n.tm-row-end .tm-help-tip { left: auto; right: 0; }\r\n/* ---- live usage strip\uFF08\u4F1A\u8BDD\u8F68\u8FF9\u4E0B\u65B9\uFF0C\u975E\u60AC\u6D6E\u7A97\uFF09---- */\r\n/* \u5BBF\u4E3B\u628A\u5B83\u6E32\u67D3\u5728 composer \u5361\u7247\u7684 dock \u5BB9\u5668\u91CC\uFF1B\u5361\u7247\u5185\u7684\u5BB9\u5668\u53EF\u80FD\u4E0D\u53C2\u4E0E flex/block \u5E03\u5C40\uFF0C\r\n   `position: relative !important` \u8BA9\u5B83\u56DE\u5230\u5361\u7247\u81EA\u8EAB\u76D2\u5B50\u5185\uFF08\u4E0D\u518D\u6D6E\u5230\u5C4F\u5E55\u9876\u90E8\uFF09\uFF0C\r\n   \u518D\u7528 margin \u5C45\u4E2D\uFF0C\u4EA7\u751F\u300C\u8F68\u8FF9\u4E0B\u9762\u4E00\u884C\u300D\u7684\u89C6\u89C9\u4F4D\u7F6E\u3002 */\r\n.tm-livebar {\r\n  /* Theme-adaptive: uses DSH light/dark alias tokens so the strip follows the app theme. */\r\n  position: relative !important;\r\n  inset: auto !important;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 4px;\r\n  margin: 0 auto 6px;\r\n  padding: 6px 8px 6px 10px;\r\n  width: fit-content;\r\n  max-width: min(760px, calc(100% - 24px));\r\n  border-radius: 10px;\r\n  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));\r\n  background: var(--dsw-alias-bg-layer-1, #16181d);\r\n  color: var(--dsw-alias-label-primary, #f2f5fa);\r\n  font-size: 12px;\r\n  line-height: 1.2;\r\n}\r\n.tm-livebar-row { display: flex; align-items: center; gap: 6px; min-width: 0; }\r\n.tm-livebar-main {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 14px;\r\n  border: 0;\r\n  background: transparent;\r\n  color: inherit;\r\n  font: inherit;\r\n  cursor: pointer;\r\n  padding: 2px 6px;\r\n  border-radius: 8px;\r\n  min-width: 0;\r\n  overflow-x: auto;\r\n  scrollbar-width: none;\r\n}\r\n.tm-livebar-main::-webkit-scrollbar { display: none; }\r\n.tm-livebar-main:hover { background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12)); }\r\n.tm-livebar-item { display: inline-flex; align-items: baseline; gap: 4px; white-space: nowrap; color: inherit; }\r\n.tm-livebar-item b { font-weight: 600; font-variant-numeric: tabular-nums; color: inherit; }\r\n.tm-livebar-item em { font-style: normal; font-size: 11px; color: var(--dsw-alias-label-secondary, rgba(127, 127, 127, 0.9)); }\r\n.tm-livebar-strong b { color: var(--dsw-alias-brand-primary, #4c8dff); }\r\n.tm-livebar-price b { color: var(--dsw-alias-state-success-primary, #3fae76); }\r\n/* \u4E0A\u4E0B\u6587\u5360\u7A97\u53E3\u6BD4\u4F8B\uFF1A\u7EC6\u8FDB\u5EA6\u6761 + \u7528\u6237\u8BBE\u5B9A\u7684\u538B\u7F29\u89E6\u53D1\u7EBF\uFF08\u4EC5\u63D0\u793A\uFF0C\u4E0D\u89E6\u53D1\u538B\u7F29\uFF09 */\r\n.tm-livebar-track {\r\n  position: relative;\r\n  height: 3px;\r\n  margin: 0 6px 1px;\r\n  border-radius: 999px;\r\n  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.16));\r\n  overflow: visible;\r\n}\r\n.tm-livebar-bar {\r\n  height: 100%;\r\n  border-radius: 999px;\r\n  background: var(--dsw-alias-brand-primary, #4c8dff);\r\n  transition: width 300ms ease;\r\n}\r\n.tm-livebar-marker {\r\n  position: absolute;\r\n  top: -2px;\r\n  width: 2px;\r\n  height: 7px;\r\n  border-radius: 1px;\r\n  background: var(--dsw-alias-state-warning-primary, #d9a441);\r\n}\r\n.tm-livebar-action {\r\n  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));\r\n  background: transparent;\r\n  color: inherit;\r\n  font: inherit;\r\n  font-size: 11px;\r\n  padding: 2px 8px;\r\n  border-radius: 999px;\r\n  cursor: pointer;\r\n  white-space: nowrap;\r\n}\r\n.tm-livebar-action:hover { background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12)); }\r\n.tm-livebar-note { font-size: 11px; color: var(--dsw-alias-label-secondary, rgba(127, 127, 127, 0.9)); white-space: nowrap; }\r\n.tm-livebar-hide {\r\n  border: 0;\r\n  background: transparent;\r\n  color: var(--dsw-alias-label-secondary, rgba(127, 127, 127, 0.9));\r\n  opacity: 0.9;\r\n  font-size: 14px;\r\n  line-height: 1;\r\n  cursor: pointer;\r\n  padding: 2px 4px;\r\n  border-radius: 50%;\r\n}\r\n.tm-livebar-hide:hover { opacity: 1; background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12)); }\r\n.tm-livebar-context {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  height: 18px;\r\n  padding: 0 6px;\r\n  border-radius: 999px;\r\n  font-size: 11px;\r\n  font-variant-numeric: tabular-nums;\r\n  color: var(--dsw-alias-brand-primary, #4c8dff);\r\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4c8dff) 10%, transparent);\r\n  white-space: nowrap;\r\n}.tm-livebar-collapsed {\r\n  display: block;\r\n  margin: 0 auto 4px;\r\n  border: 1px dashed var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));\r\n  background: transparent;\r\n  color: var(--dsw-alias-label-secondary, rgba(127, 127, 127, 0.9));\r\n  font-size: 11px;\r\n  padding: 1px 8px;\r\n  border-radius: 999px;\r\n  cursor: pointer;\r\n}\r\n@media (max-width: 640px) {\r\n  .tm-livebar { font-size: 11px; max-width: calc(100% - 12px); padding: 5px 6px 5px 8px; }\r\n  .tm-livebar-main { gap: 8px; }\r\n  .tm-livebar-note { display: none; }\r\n}/* ============================ Phase 5\uFF1A\u7A84\u5C4F\u6807\u7B7E\u680F\u6A2A\u5411\u6EDA\u52A8 + \u6EA2\u51FA\u81EA\u67E5\u4FEE\u6B63 ============================ */\r\n\r\n/* \u6807\u7B7E\u680F\uFF1A\u5355\u884C\u6A2A\u5411\u6EDA\u52A8\uFF0C\u9690\u85CF\u6EDA\u52A8\u6761\uFF081600/897 \u4E0D\u51FA\u73B0\u6EDA\u52A8\u6761\uFF0C390 \u53EF\u6ED1\u52A8\uFF09 */\r\n\r\n/* \u9875\u9762\u4E3B\u4F53\u53EA\u7EB5\u5411\u6EDA\u52A8\uFF1A\u6A2A\u5411\u6EA2\u51FA\u4EA4\u7ED9\u5404\u8868\u683C\u5BB9\u5668\u81EA\u5DF1\u5904\u7406 */\r\n.tm-body { overflow-x: hidden; }\r\n.tm-tablewrap { min-width: 0; }\r\n\r\n/* \u5206\u533A\u6807\u9898/\u5DE5\u5177\u884C\u53EF\u6362\u884C\uFF0C\u907F\u514D 390 \u4E0B\u6EA2\u51FA */\r\n.tm-section-head { flex-wrap: wrap; row-gap: 4px; }\r\n.tm-row-end { flex-wrap: wrap; }\r\n.tm-pager { flex-wrap: wrap; row-gap: 4px; }\r\n\r\n/* \u62BD\u5C49/\u5F39\u7A97\u5E95\u90E8\u6309\u94AE\u884C\u53EF\u6362\u884C */\r\n.tm-drawer-foot, .tm-modal-foot { flex-wrap: wrap; row-gap: 6px; }\r\n\r\n/* \u7A84\u5C4F\uFF1A\u5E2E\u52A9\u6C14\u6CE1\u6539\u4E3A\u5E95\u90E8\u6D6E\u5C42\uFF0C\u5F7B\u5E95\u907F\u514D\u6C14\u6CE1\u6A2A\u5411\u6EA2\u51FA/\u88AB\u88C1\u5207 */\r\n@media (max-width: 640px) {\r\n  .tm-help-tip {\r\n    position: fixed;\r\n    left: 12px;\r\n    right: 12px;\r\n    bottom: 16px;\r\n    top: auto;\r\n    width: auto;\r\n    max-width: none;\r\n    transform: none;\r\n    z-index: 70;\r\n  }\r\n  .tm-head { row-gap: 4px; }\r\n  .tm-drawer-head { flex-wrap: wrap; row-gap: 4px; }\r\n}\r\n/* \u53F3\u5BF9\u9F50\u5DE5\u5177\u884C\u91CC\u7684\u5E2E\u52A9\u6C14\u6CE1\u6539\u4E3A\u53F3\u951A\u5B9A\uFF0C\u907F\u514D\u8D34\u53F3\u8FB9\u7F18\u65F6\u88AB\u88C1\u5207 */\r\n.tm-row-end .tm-help-tip { left: auto; right: 0; }\r\n/* ---- live top overlay ---- */\r\n.tm-livebar {\r\n  /* Theme-adaptive: uses DSH light/dark alias tokens so the strip follows the app theme. */\r\n  position: fixed;\r\n  top: 10px;\r\n  left: 50%;\r\n  transform: translateX(-50%);\r\n  z-index: 1200;\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 6px;\r\n  padding: 4px 6px 4px 10px;\r\n  border-radius: 999px;\r\n  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));\r\n  background: var(--dsw-alias-bg-layer-1, #16181d);\r\n  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);\r\n  backdrop-filter: blur(10px);\r\n  color: var(--dsw-alias-label-primary, #f2f5fa);\r\n  font-size: 12px;\r\n  line-height: 1.2;\r\n  max-width: calc(100vw - 32px);\r\n}\r\n.tm-livebar-main {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 14px;\r\n  border: 0;\r\n  background: transparent;\r\n  color: inherit;\r\n  font: inherit;\r\n  cursor: pointer;\r\n  padding: 2px 4px;\r\n  border-radius: 999px;\r\n}\r\n.tm-livebar-main:hover { background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12)); }\r\n.tm-livebar-item { display: inline-flex; align-items: baseline; gap: 4px; white-space: nowrap; color: inherit; }\r\n.tm-livebar-item b { font-weight: 600; font-variant-numeric: tabular-nums; color: inherit; }\r\n.tm-livebar-item em { font-style: normal; font-size: 11px; color: var(--dsw-alias-label-secondary, rgba(127, 127, 127, 0.9)); }\r\n.tm-livebar-price b { color: var(--dsw-alias-state-success-primary, #3fae76); }\r\n.tm-livebar-action {\r\n  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));\r\n  background: transparent;\r\n  color: inherit;\r\n  font: inherit;\r\n  font-size: 11px;\r\n  padding: 2px 8px;\r\n  border-radius: 999px;\r\n  cursor: pointer;\r\n}\r\n.tm-livebar-action:hover { background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12)); }\r\n.tm-livebar-note { font-size: 11px; color: var(--dsw-alias-label-secondary, rgba(127, 127, 127, 0.9)); white-space: nowrap; }\r\n.tm-livebar-hide {\r\n  border: 0;\r\n  background: transparent;\r\n  color: var(--dsw-alias-label-secondary, rgba(127, 127, 127, 0.9));\r\n  opacity: 0.9;\r\n  font-size: 14px;\r\n  line-height: 1;\r\n  cursor: pointer;\r\n  padding: 2px 4px;\r\n  border-radius: 50%;\r\n}\r\n.tm-livebar-hide:hover { opacity: 1; background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12)); }\r\n@media (max-width: 640px) {\r\n  .tm-livebar { top: 6px; gap: 2px; padding: 3px 4px 3px 8px; font-size: 11px; }\r\n  .tm-livebar-main { gap: 8px; }\r\n  .tm-livebar-extra { display: none; }\r\n  .tm-livebar-note { display: none; }\r\n}\r\n/* \u5B98\u65B9\u6A21\u578B\u9009\u62E9\u5668\u7684\u540D\u5B57\u6807\u7B7E\uFF08\u6211\u4EEC\u7684\u63D2\u69FD\u5360\u7528\u8005\u5FC5\u987B\u5B8C\u6574\u6E32\u67D3\u540D\u5B57\uFF09 */\r\n.tm-model-label-name { display: inline; }\r\n.tm-model-label-auto {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  margin-left: 6px;\r\n  padding: 0 4px;\r\n  height: 14px;\r\n  border-radius: 4px;\r\n  font-size: 9px;\r\n  line-height: 14px;\r\n  letter-spacing: 0.04em;\r\n  font-weight: 600;\r\n  color: var(--dsw-alias-brand-primary, #4c8dff);\r\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4c8dff) 12%, transparent);\r\n  vertical-align: middle;\r\n}\r\n/* ============================ Phase 5\uFF1AAUTO \u81EA\u52A8\u63A8\u7406 ============================ */\r\n\r\n/* composer \u5DE5\u5177\u884C\u63A7\u4EF6\uFF1A\u4E0E\u5B98\u65B9\u6A21\u578B/\u63A8\u7406\u6863\u4F4D\u9009\u62E9\u5668\u540C\u6392\uFF0C\u4E3B\u9898\u81EA\u9002\u5E94\u3001\u7D27\u51D1 */\r\n.tm-auto-control { display: inline-flex; align-items: center; min-width: 0; }\r\n.tm-auto-chip {\r\n  display: inline-flex; align-items: center; gap: 5px;\r\n  height: 26px; padding: 0 8px; box-sizing: border-box; max-width: 136px;\r\n  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.32));\r\n  border-radius: var(--dsw-radius-xs, 6px);\r\n  background: transparent; color: var(--dsw-alias-label-secondary, rgba(127, 127, 127, 0.95));\r\n  font: inherit; font-size: 12px; line-height: 1; white-space: nowrap; cursor: pointer;\r\n}\r\n.tm-auto-chip:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12)); color: var(--dsw-alias-label-primary, #f2f5fa); }\r\n.tm-auto-chip:focus-visible { outline: none; box-shadow: 0 0 0 var(--dsw-focus-ring-width, 2px) var(--dsw-focus-ring-color, #4c8dff); }\r\n.tm-auto-chip.is-auto {\r\n  color: var(--dsw-alias-state-business-primary, #4c8dff);\r\n  border-color: var(--dsw-alias-state-business-primary, #4c8dff);\r\n  background: var(--dsw-alias-state-business-tertiary, rgba(76, 141, 255, 0.12));\r\n}\r\n.tm-auto-chip-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: 0.5; flex: none; }\r\n.tm-auto-chip.is-auto .tm-auto-chip-dot { opacity: 1; }\r\n.tm-auto-chip-label { overflow: hidden; text-overflow: ellipsis; }\r\n.tm-auto-chip-caret { flex: none; opacity: 0.7; }\r\n\r\n/* \u83DC\u5355 portal \u5230 document.body\uFF08composer \u533A\u57DF\u7EA6\u675F\uFF09 */\r\n.tm-auto-menu {\r\n  position: fixed; z-index: 1400; width: 304px; max-width: calc(100vw - 16px);\r\n  max-height: min(70vh, 460px); overflow: auto; box-sizing: border-box; padding: 6px;\r\n  border-radius: var(--dsw-radius-md, 10px);\r\n  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.32));\r\n  background: var(--dsw-alias-bg-layer-2, #1c1f26);\r\n  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);\r\n  color: var(--dsw-alias-label-primary, #f2f5fa);\r\n  font: inherit; font-size: 12px; line-height: 1.45;\r\n}\r\n.tm-auto-menu-head { display: flex; align-items: center; gap: 6px; padding: 4px 6px 6px; }\r\n.tm-auto-menu-title { font-weight: 600; font-size: 12px; }\r\n.tm-auto-menu-sub { padding: 2px 6px; font-size: 11px; color: var(--dsw-alias-label-tertiary, rgba(127, 127, 127, 0.9)); }\r\n.tm-auto-menu-divider { height: 1px; margin: 5px 4px; background: var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.18)); }\r\n.tm-auto-option {\r\n  display: flex; align-items: flex-start; gap: 7px; width: 100%; box-sizing: border-box;\r\n  padding: 6px 8px; border: none; border-radius: var(--dsw-radius-sm, 6px);\r\n  background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer;\r\n}\r\n.tm-auto-option:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12)); }\r\n.tm-auto-option:disabled { opacity: 0.55; cursor: default; }\r\n.tm-auto-option:focus-visible { outline: none; box-shadow: 0 0 0 var(--dsw-focus-ring-width, 2px) var(--dsw-focus-ring-color, #4c8dff); }\r\n.tm-auto-check { width: 12px; flex: none; line-height: 17px; font-size: 11px; color: var(--dsw-alias-state-business-primary, #4c8dff); }\r\n.tm-auto-option-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }\r\n.tm-auto-option-title { display: flex; align-items: center; gap: 4px; font-size: 12px; }\r\n.tm-auto-option-code {\r\n  font-family: var(--dsh-font-family-code, ui-monospace, monospace); font-size: 10px;\r\n  padding: 0 3px; border-radius: 3px;\r\n  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));\r\n  color: var(--dsw-alias-label-tertiary, rgba(127, 127, 127, 0.9));\r\n}\r\n.tm-auto-option-sub { font-size: 11px; color: var(--dsw-alias-label-tertiary, rgba(127, 127, 127, 0.9)); }\r\n.tm-auto-decision { display: flex; flex-direction: column; gap: 4px; padding: 2px 6px 4px; }\r\n.tm-auto-decision-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }\r\n.tm-auto-reasons { margin: 0; padding-left: 16px; display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: var(--dsw-alias-label-secondary, rgba(127, 127, 127, 0.95)); }\r\n.tm-auto-reasons li { word-break: break-word; }\r\n.tm-auto-hint { font-size: 11px; }\r\n\r\n/* \u8BBE\u7F6E / \u603B\u89C8 / \u62A5\u544A */\r\n.tm-auto-compare { font-size: 12px; }\r\n.tm-auto-effort { display: flex; flex-direction: column; gap: 6px; }\r\n.tm-auto-effort-row { display: flex; align-items: center; gap: 6px; font-size: 12px; }\r\n.tm-auto-effort-name { flex: none; width: 58px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-secondary); }\r\n.tm-auto-effort-bar { flex: 1 1 auto; height: 7px; border-radius: 4px; background: var(--dsw-alias-bg-mask-2); overflow: hidden; min-width: 40px; }\r\n.tm-auto-effort-fill { display: block; height: 100%; border-radius: 4px; background: var(--dsw-alias-state-business-primary); }\r\n.tm-auto-effort-value { flex: none; width: 100px; text-align: right; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary); }\r\n.tm-cell-reason { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\r\n\r\n@media (max-width: 640px) {\r\n  .tm-auto-chip { max-width: 104px; padding: 0 6px; }\r\n  .tm-auto-chip-label { max-width: 64px; }\r\n  .tm-auto-menu { width: calc(100vw - 16px); max-height: 60vh; }\r\n  .tm-cell-reason { max-width: 120px; }\r\n}\r\n\r\n/* ========================================================================== */\r\n/* Visual refinement v2\uFF1A\u7EDF\u4E00\u95F4\u8DDD\u523B\u5EA6 / \u5B57\u53F7\u5C42\u7EA7 / AUTO \u9762\u677F\u4E0E composer \u63A7\u4EF6    */\r\n/* ========================================================================== */\r\n:where(.tm-page, .tm-auto-control, .tm-auto-menu) {\r\n  --tm-s1: 4px;\r\n  --tm-s2: 8px;\r\n  --tm-s3: 12px;\r\n  --tm-s4: 16px;\r\n  --tm-r-sm: 6px;\r\n  --tm-r-md: 8px;\r\n  --tm-r-lg: 12px;\r\n  --tm-line: var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.22));\r\n  --tm-line-strong: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.34));\r\n  --tm-surface: var(--dsw-alias-bg-layer-1, #16181d);\r\n  --tm-surface-2: var(--dsw-alias-bg-layer-2, #1c1f26);\r\n  --tm-text: var(--dsw-alias-label-primary, #f2f5fa);\r\n  --tm-text-2: var(--dsw-alias-label-secondary, rgba(242, 245, 250, 0.72));\r\n  --tm-text-3: var(--dsw-alias-label-tertiary, rgba(242, 245, 250, 0.5));\r\n  --tm-accent: var(--dsw-alias-brand-primary, #4c8dff);\r\n  --tm-accent-soft: var(--dsw-alias-state-business-tertiary, rgba(76, 141, 255, 0.14));\r\n  --tm-ok: var(--dsw-alias-state-success-primary, #3fae76);\r\n  --tm-warn: var(--dsw-alias-state-warn-primary, #d9a34a);\r\n  --tm-shadow-card: 0 1px 2px rgba(15, 23, 42, 0.05), 0 1px 1px rgba(15, 23, 42, 0.03);\r\n  --tm-shadow-pop: 0 14px 38px rgba(15, 23, 42, 0.22), 0 2px 8px rgba(15, 23, 42, 0.12);\r\n}\r\n\r\n/* ---- \u5916\u58F3\uFF1A\u9875\u5934 / \u6807\u7B7E / \u5185\u5BB9\u533A / \u5361\u7247 / \u8868\u683C / \u7A7A\u6001 ---- */\r\n.tm-page { font-size: 13px; }\r\n.tm-head { padding: 12px var(--tm-s4) 0; gap: var(--tm-s2); }\r\n.tm-title { font-size: 15px; font-weight: 600; letter-spacing: 0.1px; }\r\n.tm-tabs { padding: var(--tm-s2) var(--tm-s4) 0; gap: 4px; }\r\n.tm-tab { height: 30px; padding: 0 var(--tm-s3); font-size: 12.5px; }\r\n.tm-body { padding: 14px var(--tm-s4) var(--tm-s3); gap: var(--tm-s3); }\r\n.tm-stack { gap: var(--tm-s3); }\r\n.tm-row { gap: var(--tm-s2); }\r\n.tm-card {\r\n  padding: 10px var(--tm-s3);\r\n  border-radius: var(--tm-r-md);\r\n  box-shadow: var(--tm-shadow-card);\r\n}\r\n.tm-card-label { font-size: 12px; }\r\n.tm-card-value { font-size: 21px; line-height: 1.2; letter-spacing: -0.2px; }\r\n.tm-card-hint { font-size: 11px; }\r\n.tm-section {\r\n  padding: var(--tm-s3) 14px;\r\n  gap: 10px;\r\n  border-radius: var(--tm-r-md);\r\n  box-shadow: var(--tm-shadow-card);\r\n}\r\n.tm-section-head { gap: var(--tm-s2); }\r\n.tm-section-title { font-size: 14px; font-weight: 600; letter-spacing: 0.1px; }\r\n.tm-table th, .tm-table td { padding: 6px 8px; }\r\n.tm-table thead th {\r\n  font-size: 11px;\r\n  font-weight: 500;\r\n  color: var(--tm-text-3);\r\n  background: var(--dsw-alias-bg-layer-1);\r\n  border-bottom: 1px solid var(--tm-line);\r\n}\r\n.tm-table tbody tr { height: 34px; }\r\n.tm-empty { padding: 20px var(--tm-s3); }\r\n.tm-pill { height: 18px; font-size: 10.5px; border-radius: 5px; }\r\n\r\n/* ---- composer AUTO \u80F6\u56CA\uFF1A\u4E0E\u5B98\u65B9\u9009\u62E9\u5668\u540C\u9AD8\uFF0828px\uFF09\u3001\u6B21\u7EA7\u8272\u3001\u72B6\u6001\u70B9 ---- */\r\n.tm-auto-control { min-width: 0; }\r\n.tm-auto-chip {\r\n  display: inline-flex; align-items: center; gap: 5px;\r\n  height: 28px; padding: 0 var(--tm-s2) 0 7px; max-width: 158px;\r\n  border: 1px solid var(--tm-line-strong);\r\n  border-radius: var(--tm-r-sm);\r\n  background: transparent;\r\n  color: var(--tm-text-2);\r\n  font: inherit; font-size: 12px; line-height: 1;\r\n  white-space: nowrap; cursor: pointer;\r\n  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;\r\n}\r\n.tm-auto-chip:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--tm-text); }\r\n.tm-auto-chip:active { transform: translateY(0.5px); }\r\n.tm-auto-chip[aria-expanded="true"] { background: var(--dsw-alias-interactive-bg-hover); color: var(--tm-text); }\r\n.tm-auto-chip.is-auto {\r\n  color: var(--tm-accent);\r\n  border-color: var(--tm-accent);\r\n  border-color: color-mix(in srgb, var(--tm-accent) 40%, transparent);\r\n  background: var(--tm-accent-soft);\r\n}\r\n.tm-auto-chip-icon { display: inline-flex; align-items: center; opacity: 0.72; flex: none; }\r\n.tm-auto-chip.is-auto .tm-auto-chip-icon { opacity: 1; }\r\n.tm-auto-chip-main { display: inline-flex; align-items: baseline; gap: 4px; min-width: 0; }\r\n.tm-auto-chip-mode { font-size: 11.5px; font-weight: 600; letter-spacing: 0.2px; }\r\n.tm-auto-chip-tier { font-size: 11.5px; color: var(--tm-text-3); overflow: hidden; text-overflow: ellipsis; }\r\n.tm-auto-chip.is-auto .tm-auto-chip-tier { color: inherit; opacity: 0.82; }\r\n.tm-auto-chip-caret { flex: none; opacity: 0.55; margin-left: 1px; }\r\n\r\n/* ---- AUTO \u83DC\u5355\uFF1A\u5361\u7247\u5206\u7EC4 + \u5206\u7EC4\u6807\u9898 + \u5F53\u524D\u9879\u9AD8\u4EAE ---- */\r\n.tm-auto-menu {\r\n  width: 316px;\r\n  padding: var(--tm-s2);\r\n  border-radius: var(--tm-r-lg);\r\n  border: 1px solid var(--tm-line-strong);\r\n  background: var(--tm-surface-2);\r\n  color: var(--tm-text);\r\n  box-shadow: var(--tm-shadow-pop);\r\n  font-size: 12px;\r\n}\r\n.tm-auto-menu-head { display: flex; align-items: center; gap: 6px; padding: 6px var(--tm-s2) var(--tm-s2); }\r\n.tm-auto-menu-title { font-size: 12px; font-weight: 600; }\r\n.tm-auto-mode-pill {\r\n  margin-left: auto; display: inline-flex; align-items: center; gap: 5px;\r\n  height: 20px; padding: 0 var(--tm-s2); border-radius: 999px;\r\n  border: 1px solid var(--tm-line-strong); color: var(--tm-text-2); font-size: 10.5px;\r\n}\r\n.tm-auto-mode-pill[data-mode="auto"] {\r\n  color: var(--tm-accent);\r\n  border-color: var(--tm-accent);\r\n  border-color: color-mix(in srgb, var(--tm-accent) 40%, transparent);\r\n  background: var(--tm-accent-soft);\r\n}\r\n.tm-auto-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }\r\n.tm-auto-group { display: flex; flex-direction: column; gap: 2px; padding: 2px 0; }\r\n.tm-auto-group + .tm-auto-group { border-top: 1px solid var(--tm-line); margin-top: var(--tm-s1); padding-top: 6px; }\r\n.tm-auto-group-title { padding: var(--tm-s1) var(--tm-s2) 2px; font-size: 10.5px; font-weight: 500; color: var(--tm-text-3); }\r\n.tm-auto-group-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--tm-s2); padding-right: var(--tm-s2); }\r\n.tm-auto-decision-meta { font-size: 10.5px; color: var(--tm-text-3); }\r\n.tm-auto-option { padding: 7px var(--tm-s2); border-radius: var(--tm-r-sm); gap: var(--tm-s2); align-items: center; }\r\n.tm-auto-option:hover { background: var(--dsw-alias-interactive-bg-hover); }\r\n.tm-auto-option.is-active { background: var(--tm-accent-soft); }\r\n.tm-auto-option:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, #4c8dff); }\r\n.tm-auto-option-icon {\r\n  width: 20px; height: 20px; border-radius: var(--tm-r-sm); flex: none;\r\n  display: inline-flex; align-items: center; justify-content: center;\r\n  color: var(--tm-text-2); background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--tm-line);\r\n}\r\n.tm-auto-option.is-active .tm-auto-option-icon { color: var(--tm-accent); border-color: transparent; }\r\n.tm-auto-option-text { flex: 1 1 auto; }\r\n.tm-auto-option-title { font-size: 12px; font-weight: 500; }\r\n.tm-auto-option-sub { font-size: 11px; color: var(--tm-text-3); }\r\n.tm-auto-option-check { margin-left: auto; width: 16px; text-align: center; color: var(--tm-accent); font-size: 12px; flex: none; }\r\n.tm-auto-effort-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 0 4px; }\r\n.tm-auto-effort-option {\r\n  display: flex; align-items: center; gap: 7px; min-height: 30px;\r\n  padding: 0 8px; border: 1px solid transparent; border-radius: var(--tm-r-sm);\r\n  background: transparent; color: var(--tm-text-2); font: inherit; font-size: 11.5px; cursor: pointer; text-align: left;\r\n}\r\n.tm-auto-effort-option:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--tm-text); }\r\n.tm-auto-effort-option.is-active { border-color: color-mix(in srgb, var(--tm-accent) 40%, transparent); background: var(--tm-accent-soft); color: var(--tm-accent); }\r\n.tm-auto-effort-option:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, #4c8dff); }\r\n.tm-auto-effort-code { font-family: var(--dsh-font-family-code, ui-monospace); font-size: 10px; letter-spacing: 0.3px; opacity: 0.7; min-width: 28px; }\r\n.tm-auto-effort-name { font-size: 11.5px; }\r\n.tm-auto-group-decision .tm-auto-reasons { list-style: none; margin: 0; padding: 0 8px; display: flex; flex-direction: column; gap: 2px; }\r\n.tm-auto-group-decision .tm-auto-reasons li { position: relative; padding-left: 10px; font-size: 11.5px; line-height: 1.45; color: var(--tm-text-2); }\r\n.tm-auto-group-decision .tm-auto-reasons li::before {\r\n  content: \'\'; position: absolute; left: 0; top: 0.55em; width: 3px; height: 3px; border-radius: 50%; background: var(--tm-text-3);\r\n}\r\n.tm-auto-hint { padding: 0 8px 2px; font-size: 11px; }\r\n\r\n/* ---- \u8BBE\u7F6E\u9875 AUTO\uFF1A\u4E24\u5217\u7D27\u51D1\u7F51\u683C ---- */\r\n.tm-auto-settings { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.25fr); gap: var(--tm-s3) 20px; align-items: start; }\r\n.tm-auto-settings-switches { display: grid; grid-template-columns: 1fr 1fr; gap: var(--tm-s2) 14px; }\r\n.tm-auto-settings-switches .tm-switch { min-height: 28px; }\r\n.tm-auto-settings-thresholds { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--tm-s2); }\r\n.tm-auto-settings-thresholds .tm-input { height: 28px; }\r\n.tm-auto-settings-initial { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 6px; }\r\n.tm-auto-settings-initial .tm-select { height: 28px; }\r\n.tm-auto-initial-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: var(--tm-s2); }\r\n\r\n/* ---- \u603B\u89C8 / \u62A5\u544A AUTO \u9762\u677F ---- */\r\n.tm-auto-panel { display: flex; flex-direction: column; gap: var(--tm-s3); }\r\n.tm-auto-kpis { gap: var(--tm-s2); }\r\n.tm-auto-kpi-value { display: inline-flex; align-items: baseline; gap: 6px; font-variant-numeric: tabular-nums; }\r\n.tm-auto-est {\r\n  display: inline-flex; align-items: center; height: 15px; padding: 0 5px;\r\n  border-radius: 999px; border: 1px solid var(--tm-line-strong);\r\n  color: var(--tm-text-3); background: var(--tm-surface-2);\r\n  font-size: 9.5px; font-weight: 500; letter-spacing: 0.2px; flex: none;\r\n}\r\n.tm-auto-block-head { display: flex; align-items: center; justify-content: space-between; gap: var(--tm-s2); }\r\n.tm-auto-block-title { font-size: 12px; font-weight: 600; color: var(--tm-text-2); }\r\n.tm-auto-block-actions { display: inline-flex; align-items: center; gap: 6px; }\r\n.tm-auto-compare-block, .tm-auto-effort-block { display: flex; flex-direction: column; gap: 6px; }\r\n.tm-auto-cmp-wrap { border-radius: var(--tm-r-md); border: 1px solid var(--tm-line); background: var(--tm-surface); }\r\n.tm-auto-cmp { table-layout: fixed; }\r\n.tm-auto-cmp th, .tm-auto-cmp td { padding: 6px 10px; }\r\n.tm-auto-cmp th:first-child, .tm-auto-cmp td:first-child { width: 40%; }\r\n.tm-auto-cmp tbody tr { height: 34px; }\r\n.tm-auto-cmp tbody tr:hover { background: transparent; }\r\n.tm-auto-cmp .tm-auto-cmp-label { color: var(--tm-text-2); }\r\n.tm-auto-cmp .tm-auto-cmp-auto { color: var(--tm-text); font-weight: 600; font-variant-numeric: tabular-nums; }\r\n.tm-auto-cmp tbody .tm-auto-cmp-auto { background: color-mix(in srgb, var(--tm-accent) 6%, transparent); }\r\n.tm-auto-cmp thead th.tm-auto-cmp-auto { color: var(--tm-accent); }\r\n.tm-auto-cmp .tm-auto-cmp-group td {\r\n  padding: 10px 10px 4px; height: 26px;\r\n  font-size: 10.5px; font-weight: 500; color: var(--tm-text-3);\r\n  background: transparent; border-bottom: 1px solid var(--tm-line);\r\n}\r\n.tm-auto-cmp .tm-auto-cmp-group:hover { background: transparent; }\r\n.tm-auto-est + .tm-auto-est { margin-left: 4px; }\r\n.tm-auto-cmp .tm-auto-est { margin-left: 5px; vertical-align: 1px; }\r\n\r\n/* \u6863\u4F4D\u5206\u5E03\uFF1A\u5206\u6BB5\u6761 + \u56FE\u4F8B */\r\n.tm-auto-effort { display: flex; flex-direction: column; gap: var(--tm-s2); }\r\n.tm-auto-segbar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: var(--dsw-alias-bg-mask-2); gap: 1px; }\r\n.tm-auto-seg { display: block; height: 100%; min-width: 3px; }\r\n.tm-auto-seg-off { background: var(--tm-text-3); }\r\n.tm-auto-seg-low { background: var(--tm-accent); background: color-mix(in srgb, var(--tm-accent) 45%, var(--tm-text-3)); }\r\n.tm-auto-seg-high { background: var(--tm-accent); background: color-mix(in srgb, var(--tm-accent) 72%, var(--tm-text-3)); }\r\n.tm-auto-seg-max { background: var(--tm-accent); }\r\n.tm-auto-seg-unknown { background: var(--tm-line-strong); }\r\n.tm-auto-legend { display: flex; flex-wrap: wrap; gap: 6px var(--tm-s4); }\r\n.tm-auto-legend-item { display: inline-flex; align-items: baseline; gap: 5px; font-size: 11px; color: var(--tm-text-3); }\r\n.tm-auto-swatch { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }\r\n.tm-auto-legend-name { color: var(--tm-text-2); }\r\n.tm-auto-legend-item b { font-size: 12px; font-weight: 600; color: var(--tm-text); font-variant-numeric: tabular-nums; }\r\n.tm-auto-legend-item em { font-style: normal; color: var(--tm-text-3); font-variant-numeric: tabular-nums; }\r\n.tm-auto-footnote { font-size: 11px; line-height: 1.55; color: var(--tm-text-3); }\r\n\r\n/* \u6700\u8FD1\u51B3\u7B56\uFF1A\u7D27\u51D1\u65F6\u95F4\u7EBF */\r\n.tm-auto-timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }\r\n.tm-auto-timeline-item {\r\n  display: grid; grid-template-columns: 64px 74px 96px 54px minmax(0, 1fr) 20px;\r\n  gap: var(--tm-s2); align-items: center; height: 36px;\r\n  border-bottom: 1px solid var(--tm-line); font-size: 11.5px; color: var(--tm-text-2);\r\n}\r\n.tm-auto-timeline-item:last-child { border-bottom: none; }\r\n.tm-auto-timeline-time { font-variant-numeric: tabular-nums; color: var(--tm-text-3); white-space: nowrap; }\r\n.tm-auto-action {\r\n  display: inline-flex; align-items: center; justify-content: center;\r\n  height: 20px; padding: 0 6px; border-radius: 5px; border: 1px solid transparent;\r\n  background: var(--tm-surface-2); color: var(--tm-text-2);\r\n  font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\r\n}\r\n.tm-auto-action-classify { color: var(--tm-accent); background: var(--tm-accent-soft); }\r\n.tm-auto-action-escalate { color: var(--tm-warn); background: var(--tm-surface-2); }\r\n.tm-auto-action-manual-exit { color: var(--tm-text-2); }\r\n.tm-auto-action-hold, .tm-auto-action-reset, .tm-auto-action-skip { color: var(--tm-text-3); }\r\n.tm-auto-effort-chip { display: inline-flex; align-items: center; gap: 4px; font-family: var(--dsh-font-family-code, ui-monospace); font-size: 10px; white-space: nowrap; }\r\n.tm-auto-effort-chip i { font-style: normal; color: var(--tm-text-3); }\r\n.tm-auto-effort-chip b { font-weight: 600; color: var(--tm-text); }\r\n.tm-auto-timeline-session { font-family: var(--dsh-font-family-code, ui-monospace); font-size: 10px; color: var(--tm-text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\r\n.tm-auto-timeline-reason { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\r\n.tm-auto-applied { text-align: center; color: var(--tm-text-3); }\r\n.tm-auto-applied.is-on { color: var(--tm-ok); font-weight: 600; }\r\n\r\n/* ---- \u54CD\u5E94\u5F0F ---- */\r\n@media (max-width: 1100px) {\r\n  .tm-auto-settings { grid-template-columns: 1fr; }\r\n  .tm-auto-settings-thresholds { grid-template-columns: repeat(2, minmax(0, 1fr)); }\r\n  .tm-auto-initial-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }\r\n  .tm-auto-menu { width: 300px; }\r\n}\r\n@media (max-width: 640px) {\r\n  .tm-head { padding: 10px var(--tm-s3) 0; }\r\n  .tm-tabs, .tm-body { padding-left: var(--tm-s3); padding-right: var(--tm-s3); }\r\n  .tm-body { padding-top: var(--tm-s3); }\r\n  .tm-cards, .tm-cards-4, .tm-cards-6 { grid-template-columns: 1fr 1fr; }\r\n  .tm-auto-settings-thresholds { grid-template-columns: 1fr 1fr; }\r\n  .tm-auto-initial-grid { grid-template-columns: 1fr 1fr; }\r\n  .tm-auto-chip { max-width: 120px; padding: 0 6px 0 6px; }\r\n  .tm-auto-chip-tier { display: none; }\r\n  .tm-auto-menu { width: calc(100vw - 16px); }\r\n  .tm-auto-timeline-item {\r\n    grid-template-columns: 54px 64px minmax(0, 1fr) 18px;\r\n    height: auto; padding: 7px 0; row-gap: 2px;\r\n  }\r\n  .tm-auto-timeline-time { grid-column: 1; }\r\n  .tm-auto-action { grid-column: 2; }\r\n  .tm-auto-effort-chip { grid-column: 3; }\r\n  .tm-auto-applied { grid-column: 4; }\r\n  .tm-auto-timeline-reason { grid-column: 1 / -1; grid-row: 2; color: var(--tm-text-3); }\r\n  .tm-auto-timeline-session { display: none; }\r\n}/* focus ring\uFF1A\u83DC\u5355\u9879\u4F7F\u7528\u5185\u63CF\u8FB9\uFF0C\u907F\u514D\u4E0E\u9009\u4E2D\u6001\u62A2\u89C6\u89C9 */\r\n.tm-auto-option:focus-visible,\r\n.tm-auto-effort-option:focus-visible {\r\n  box-shadow: inset 0 0 0 1px var(--tm-accent);\r\n}\r\n/* 390\uFF1A\u5F00\u5173\u7EB5\u5411\u5806\u53E0\uFF0C\u907F\u514D\u6807\u7B7E\u6362\u884C */\r\n@media (max-width: 640px) {\r\n  .tm-auto-settings-switches { grid-template-columns: 1fr; }\r\n}\r\n/* ---------- \u7B2C\u4E8C\u8F6E\u5FAE\u8C03 ---------- */\r\n/* \u83DC\u5355\uFF1A\u5206\u7EC4\u6807\u9898\u7EDF\u4E00 11px \u6B21\u7EA7\u8272\uFF1B\u5F53\u524D\u9879\u5E95\u8272\u7EA6 13% \u54C1\u724C\u8272 */\r\n.tm-auto-group-title { font-size: 11px; }\r\n.tm-auto-option.is-active { background: var(--tm-accent-soft); background: color-mix(in srgb, var(--tm-accent) 13%, transparent); }\r\n.tm-auto-effort-option.is-active { background: var(--tm-accent-soft); background: color-mix(in srgb, var(--tm-accent) 11%, transparent); }\r\n.tm-auto-menu { top: auto; }\r\n\r\n/* \u65F6\u95F4\u7EBF\uFF1A\u6570\u5B57\u7B49\u5BBD\u5BF9\u9F50 */\r\n.tm-auto-timeline-item { font-variant-numeric: tabular-nums; }\r\n.tm-auto-timeline-time, .tm-auto-effort-chip { font-variant-numeric: tabular-nums; }\r\n\r\n/* \u8BBE\u7F6E\uFF1A\u4E24\u5217\u9876\u90E8\u5BF9\u9F50 */\r\n.tm-auto-settings { align-items: start; }\r\n.tm-auto-settings-switches { padding-top: 2px; }\r\n.tm-auto-settings-switches .tm-switch { min-height: 28px; align-items: center; }\r\n\r\n/* \u62A5\u544A\u9875\uFF1A\u5168\u5C40\u5BF9\u6BD4\u7684\u8303\u56F4\u63D0\u793A\uFF08\u4E0D\u663E\u793A\u77DB\u76FE\u7A7A\u6001\uFF09 */\r\n.tm-report-scope-hint { font-size: 12px; color: var(--tm-text-3); padding: 2px 0 0; }\r\n\r\n/* \u6D45\u8272\u4E3B\u9898\uFF1A\u63D0\u5347\u5361\u7247/\u8868\u5934\u5BF9\u6BD4\u5EA6\uFF0C\u4F30\u7B97 pill \u4E0E AUTO \u5217 tint \u4E0D\u53D1\u7070 */\r\n@media (prefers-color-scheme: light) {\r\n  .tm-card, .tm-section, .tm-auto-cmp-wrap { border-color: rgba(15, 23, 42, 0.14); }\r\n  .tm-table thead th { color: rgba(15, 23, 42, 0.58); }\r\n  .tm-auto-cmp thead th.tm-auto-cmp-auto { color: var(--tm-accent); }\r\n  .tm-auto-est {\r\n    background: color-mix(in srgb, var(--tm-accent) 9%, transparent);\r\n    border-color: color-mix(in srgb, var(--tm-accent) 24%, transparent);\r\n    color: color-mix(in srgb, var(--tm-accent) 70%, #1f2937);\r\n  }\r\n  .tm-auto-cmp tbody .tm-auto-cmp-auto { background: color-mix(in srgb, var(--tm-accent) 8%, transparent); }\r\n  .tm-auto-option.is-active { background: color-mix(in srgb, var(--tm-accent) 11%, transparent); }\r\n  .tm-auto-mode-pill { border-color: rgba(15, 23, 42, 0.22); }\r\n}\r\n';

// src/client/index.tsx
var import_jsx_runtime15 = require("react/jsx-runtime");
var PANEL_ID = "token-manager";
var inject = ["slots", "locale", "layout"];
var TABS = [
  { id: "overview", key: "tabs.overview" },
  { id: "calls", key: "tabs.calls" },
  { id: "tasks", key: "tabs.tasks" },
  { id: "cache", key: "tabs.cache" },
  { id: "context", key: "tabs.context" },
  { id: "report", key: "tabs.report" },
  { id: "settings", key: "tabs.settings" }
];
var API = createApi();
function DashboardPage(props) {
  const fallbackT = (0, import_react15.useMemo)(() => createTranslate(void 0), []);
  const t = props.t ?? fallbackT;
  const api = props.api ?? API;
  const [tab, setTab] = (0, import_react15.useState)("overview");
  const [refreshTick, setRefreshTick] = (0, import_react15.useState)(0);
  const [selectedTaskId, setSelectedTaskId] = (0, import_react15.useState)(null);
  const tabsRef = (0, import_react15.useRef)(null);
  const activeTabRef = (0, import_react15.useRef)(null);
  (0, import_react15.useEffect)(() => {
    const nav = tabsRef.current;
    const active = activeTabRef.current;
    if (!nav || !active) return;
    const navRect = nav.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const centered = nav.scrollLeft + (activeRect.left - navRect.left) - (nav.clientWidth - active.clientWidth) / 2;
    const target = Math.max(0, centered);
    if (typeof nav.scrollTo === "function") nav.scrollTo({ left: target, behavior: "smooth" });
    else nav.scrollLeft = target;
  }, [tab]);
  const openReport = (taskId) => {
    setSelectedTaskId(taskId);
    setTab("report");
  };
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(TranslateContext.Provider, { value: t, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "tm-page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("header", { className: "tm-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("h1", { className: "tm-title", children: [
        t("panel.title"),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Help, { text: t("panel.help"), label: t("common.help") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "tm-head-status", children: t("common.analysisOnly") }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "tm-head-spacer" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("button", { type: "button", className: "tm-btn tm-btn-sm", onClick: () => setRefreshTick((value) => value + 1), children: t("common.refresh") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("nav", { className: "tm-tabs", role: "tablist", "aria-label": t("tabs.label"), ref: tabsRef, children: TABS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      "button",
      {
        type: "button",
        role: "tab",
        className: "tm-tab",
        "aria-selected": tab === item.id,
        ref: (node) => {
          if (tab === item.id) activeTabRef.current = node;
        },
        onClick: () => setTab(item.id),
        children: t(item.key)
      },
      item.id
    )) }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "tm-body", children: [
      tab === "overview" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(OverviewPage, { api, refreshTick, onOpenReport: openReport }) : null,
      tab === "calls" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CallsPage, { api, refreshTick }) : null,
      tab === "tasks" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(TasksPage, { api, refreshTick, onOpenReport: openReport, selectedTaskId }) : null,
      tab === "cache" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CachePage, { api, refreshTick }) : null,
      tab === "context" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ContextPage, { api, refreshTick }) : null,
      tab === "report" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        ReportPage,
        {
          api,
          refreshTick,
          taskId: selectedTaskId,
          onSelectTask: (taskId) => setSelectedTaskId(taskId || null)
        }
      ) : null,
      tab === "settings" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(SettingsPage, { api, refreshTick }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Footer, {})
  ] }) });
}
function PanelIcon({ size = 18, open }) {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "tm-panel-icon", onClick: open, role: "presentation", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 20 20",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.5",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("path", { d: "M3 16.5V9.5" }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("path", { d: "M8 16.5V4" }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("path", { d: "M13 16.5v-5.5" }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("path", { d: "M17 16.5V7" }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("path", { d: "M2 16.5h16" })
      ]
    }
  ) });
}
function injectStyles() {
  const style = document.createElement("style");
  style.setAttribute("data-dsh-owner", "dsh-token-manager");
  style.textContent = styles_default;
  document.head.append(style);
  return () => style.remove();
}
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh: DICTIONARIES.zh, en: DICTIONARIES.en }), "token-manager: dictionaries");
  let bound;
  try {
    bound = ctx.locale.bind(NS);
  } catch {
    bound = void 0;
  }
  const t = createTranslate(bound);
  ctx.effect(() => injectStyles(), "token-manager: styles");
  const navigation = {
    open: () => ctx.layout.selectPanel(PANEL_ID),
    close: () => ctx.layout.selectPanel(null)
  };
  const selectEffort = (sessionId, selection) => {
    const lookup2 = ctx.get;
    if (typeof lookup2 !== "function") return Promise.resolve(false);
    const attempt = async () => {
      try {
        const remote = lookup2("remote");
        const selectModel = remote?.session?.selectModel;
        if (typeof selectModel === "function") {
          const result = await selectModel.call(remote?.session, { sessionId, ...selection });
          if (result === void 0 || result.ok !== false) return true;
        }
      } catch {
      }
      try {
        const directories = lookup2("modelDirectories");
        const directory = directories?.directoryFor?.(sessionId);
        if (directory && typeof directory.select === "function") {
          const result = await directory.select(selection);
          return result === void 0 || result.ok !== false;
        }
      } catch {
      }
      return false;
    };
    return attempt();
  };
  ctx.effect(() => {
    try {
      return ctx.slots.inject(
        "conversation.composer.dock",
        () => ctx.slots.register(
          {
            name: "conversation.composer.dock",
            id: "token-manager-live",
            order: 40,
            locale: NS,
            inject: () => ({ api: API, t, open: navigation.open })
          },
          LiveBar
        )
      );
    } catch {
      return () => {
      };
    }
  }, "token-manager: live strip (conversation dock)");
  ctx.effect(() => {
    try {
      return ctx.slots.inject(
        "conversation.input.right",
        () => ctx.slots.register(
          {
            name: "conversation.input.right",
            id: "token-manager-auto",
            order: 40,
            locale: NS,
            inject: (sessionId) => ({
              api: API,
              translate: t,
              selectEffort: (selection) => sessionId ? selectEffort(sessionId, selection) : Promise.resolve(false)
            })
          },
          AutoControl
        )
      );
    } catch {
      return () => {
      };
    }
  }, "token-manager: auto composer control");
  ctx.effect(() => {
    try {
      return ctx.slots.inject(
        "conversation.input.model.label",
        () => ctx.slots.register(
          {
            name: "conversation.input.model.label",
            id: "token-manager-auto-label",
            locale: NS,
            inject: (sessionId) => ({
              api: API,
              translate: t,
              selectEffort: (selection) => sessionId ? selectEffort(sessionId, selection) : Promise.resolve(false)
            })
          },
          ModelLabelAuto
        )
      );
    } catch {
      return () => {
      };
    }
  }, "token-manager: model label (names + AUTO tag)");
  ctx.slots.inject(
    "main",
    () => ctx.slots.inject("sidebar.panellist", () => {
      const stopMain = ctx.slots.register(
        {
          name: "main",
          key: PANEL_ID,
          locale: NS,
          inject: () => ({ api: API, t, navigation })
        },
        DashboardPage
      );
      let stopIcon;
      try {
        stopIcon = ctx.slots.register(
          {
            name: "sidebar.panellist",
            id: PANEL_ID,
            order: 32,
            label: () => t("panel.label"),
            locale: NS,
            inject: () => ({ open: navigation.open })
          },
          PanelIcon
        );
      } catch (error) {
        stopIcon?.();
        stopMain();
        throw error;
      }
      return () => {
        stopIcon?.();
        stopMain();
      };
    })
  );
}

    return module.exports;
  }
});

