// Build Host half (ESM, Node) and Client half (browser module wrapped in window.__ModuleLoader__.load).
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const id = pkg.name
const minify = process.env.TM_MINIFY === '1'

async function buildHost() {
  await build({
    entryPoints: ['src/index.ts'],
    outfile: 'lib/index.js',
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    sourcemap: false,
    minify,
    legalComments: 'none',
    packages: 'external',
    logLevel: 'info',
  })
}

async function buildClient() {
  await build({
    entryPoints: ['src/client/index.tsx'],
    outfile: 'lib/client.js',
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    jsxImportSource: 'react',
    minify,
    legalComments: 'none',
    loader: { '.css': 'text' },
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    banner: {
      js:
        'window.__ModuleLoader__.load({\n' +
        '  id: ' + JSON.stringify(id) + ',\n' +
        '  factory: (require) => {\n' +
        '    var module = { exports: {} };\n' +
        '    var exports = module.exports;\n' +
        '    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
    },
    footer: {
      js: '\n    return module.exports;\n  }\n});\n',
    },
    logLevel: 'info',
  })
}

const built = []
const failed = []
try {
  await buildHost()
  built.push('lib/index.js')
} catch (error) {
  failed.push('host')
  console.error('[build] host half FAILED:', error?.message ?? error)
}
try {
  await buildClient()
  built.push('lib/client.js')
} catch (error) {
  failed.push('client')
  console.error('[build] client half FAILED:', error?.message ?? error)
}

for (const file of built) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' })
  console.log('[build] syntax ok:', file)
}
if (failed.length) {
  console.error('[build] failed halves:', failed.join(', '))
  process.exitCode = 1
} else {
  console.log('[build] all halves built')
}