#!/usr/bin/env node
// Read DSH session logs and print per-call token usage with timestamps.
// Usage:
//   node scripts/token-report.mjs            # newest 3 sessions
//   node scripts/token-report.mjs 5          # newest 5 sessions
//   node scripts/token-report.mjs latest     # newest session only
// Works without the Token Manager plugin: it reads DSH's own durable session logs.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'
import { join } from 'node:path'
import { homedir } from 'node:os'

const HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const SESSIONS = join(HOME, 'sessions')
const PROJ = join(HOME, 'storages', 'session_projcache', 'sessions')
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

function splitFrames(buf) {
  const offsets = []
  for (let i = 0; i + 3 < buf.length; i++) {
    if (buf[i] === 0x28 && buf[i + 1] === 0xb5 && buf[i + 2] === 0x2f && buf[i + 3] === 0xfd) offsets.push(i)
  }
  return offsets.map((s, k) => buf.subarray(s, k + 1 < offsets.length ? offsets[k + 1] : buf.length))
}

function readSession(dir) {
  const events = []
  try {
    for (const frame of splitFrames(readFileSync(join(dir, 'session.v4.jsonl.zstd')))) {
      let text
      try { text = zstdDecompressSync(frame).toString('utf8') } catch { continue }
      for (const line of text.split('\n')) {
        if (!line.trim()) continue
        try { const e = JSON.parse(line); if (typeof e.seq === 'number') events.push(e) } catch {}
      }
    }
  } catch { return null }
  return events
}

function officialTotals(id) {
  try {
    const doc = JSON.parse(readFileSync(join(PROJ, `${id}.json`), 'utf8'))
    return doc?.record?.rows?.tokenUsage?.val?.totals ?? null
  } catch { return null }
}

const arg = process.argv[2] || '3'
const limit = arg === 'latest' ? 1 : Number(arg) || 3
const dirs = []
for (const project of readdirSync(SESSIONS)) {
  const p = join(SESSIONS, project)
  if (!statSync(p).isDirectory()) continue
  for (const id of readdirSync(p)) {
    const q = join(p, id)
    if (statSync(q).isDirectory()) dirs.push({ id, dir: q, mtime: statSync(q).mtimeMs, project })
  }
}
dirs.sort((a, b) => b.mtime - a.mtime)

for (const entry of dirs.slice(0, limit)) {
  const events = readSession(entry.dir)
  if (!events) continue
  const calls = events.filter((e) => e.type === 'assistant/message' && e.data?.usage)
  if (calls.length === 0) continue
  const fmt = (ms) => new Date(ms).toLocaleString('zh-CN', { hour12: false })
  console.log(`\n会话 ${entry.id}`)
  console.log(`  项目: ${entry.project}   最后活动: ${fmt(entry.mtime)}   调用次数: ${calls.length}`)
  console.log('  序号  时间                 未命中输入   缓存命中    缓存写入    输出      合计')
  let sum = { inp: 0, cr: 0, cw: 0, out: 0, tot: 0 }
  calls.forEach((e, i) => {
    const u = e.data.usage
    const row = { inp: u.inputTokens || 0, cr: u.cacheReadTokens || 0, cw: u.cacheWriteTokens || 0, out: u.outputTokens || 0, tot: u.totalTokens || 0 }
    sum = { inp: sum.inp + row.inp, cr: sum.cr + row.cr, cw: sum.cw + row.cw, out: sum.out + row.out, tot: sum.tot + row.tot }
    console.log(`  ${String(i + 1).padStart(3)}   ${fmt(e.time)}   ${String(row.inp).padStart(10)}  ${String(row.cr).padStart(10)}  ${String(row.cw).padStart(10)}  ${String(row.out).padStart(8)}  ${String(row.tot).padStart(10)}`)
  })
  console.log(`  合计                     ${String(sum.inp).padStart(10)}  ${String(sum.cr).padStart(10)}  ${String(sum.cw).padStart(10)}  ${String(sum.out).padStart(8)}  ${String(sum.tot).padStart(10)}`)
  const off = officialTotals(entry.id)
  if (off) console.log(`  官方 tokenUsage: 未命中 ${off.uncachedInputTokens} / 缓存读取 ${off.cacheReadTokens} / 缓存写入 ${off.cacheWriteTokens} / 输出 ${off.outputTokens}`)
}