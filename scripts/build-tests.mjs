// Bundle every host-side TypeScript module for Node's test runner.
// The generated entry re-exports storage/host/shared modules so a new module is
// immediately importable as `../.build/harness.mjs` without editing a manual list.
import { build } from 'esbuild'
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const modules = []
for (const dir of ['src/storage', 'src/host', 'src/shared']) {
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.ts') || file.endsWith('.d.ts')) continue
    modules.push(`export * from '../${dir}/${file.replace(/\.ts$/, '.js')}'`)
  }
}
mkdirSync('tests/.build', { recursive: true })
writeFileSync('tests/.build-entry.ts', modules.join('\n') + '\n')
await build({
  entryPoints: { harness: 'tests/.build-entry.ts' },
  outdir: 'tests/.build',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  packages: 'external',
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
})
console.log('[build-tests] tests/.build/harness.mjs ready (' + modules.length + ' modules)')
