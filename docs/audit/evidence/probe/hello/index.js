import { appendFileSync } from 'node:fs'

const LOG = 'E:\\ZHIRAI Harness\\dsh-token-manager\\probe\\loaded.log'
function write(v) {
  try { appendFileSync(LOG, (typeof v === 'string' ? v : JSON.stringify(v)) + '\n') } catch {}
}

export const inject = ['tools', 'tokenMeter']

export function apply(ctx, config) {
  const names = ['tools', 'tokenMeter', 'sessionProjections', 'agentLoop', 'sessions', 'llm', 'settings', 'storageDomain', 'spillStore', 'systemPrompt', 'compaction', 'toolResultPruner', 'subagents', 'toolsResultPruner']
  const present = names.filter((k) => !!ctx.get(k))
  let prunerConfig = null
  try { prunerConfig = ctx.get('toolResultPruner')?.config ?? null } catch (e) { prunerConfig = { error: String(e) } }
  write({ time: Date.now(), step: 'apply', present, prunerConfig })

  ctx.on('session/event', (session, event) => {
    if (event.type === 'assistant/message') {
      write({ time: Date.now(), type: 'assistant/message', turn: event.data.turn, step: event.data.step, usage: event.data.usage ?? null })
    } else if (event.type === 'tool/result') {
      const content = event.data.message?.content ?? []
      write({ time: Date.now(), type: 'tool/result', turn: event.data.turn, step: event.data.step, callId: String(event.data.message?.source?.callId ?? ''), isError: event.data.message?.isError ?? false, contentTypes: content.map((c) => c.type), textLen: content.filter((c) => c.type === 'text').reduce((n, c) => n + (c.text?.length ?? 0), 0) })
    }
  })

  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    write({ time: Date.now(), type: 'pre-step-outer', turn: payload.turn, step: payload.step, inMsgs: (payload.messages ?? []).length, outKind: decision?.kind, outMsgs: (decision?.messages ?? []).length, outSources: (decision?.messages ?? []).map((m) => m?.source?.kind) })
    return decision
  })
}