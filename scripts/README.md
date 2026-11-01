# Scripts

This distribution repository ships only user-facing helper scripts:

- `token-report.mjs` — prints per-call token usage (four buckets) with timestamps for recent sessions. Reads DSH's own session logs, works with or without the plugin.
- `install-sandbox.ps1` — creates an isolated DSH profile and installs the plugin there for testing.

Build scripts and code-generation tooling are part of the private source tree and are not published.

## Usage

```bash
node scripts/token-report.mjs 3       # last 3 sessions
node scripts/token-report.mjs latest  # newest session
```
