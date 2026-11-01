# Tests

The private test suite for DSH Token Manager contains **231 unit tests** plus a real-history cross-check integration test.

Areas covered:

- storage migrations (schema v0 → v4), blob store, repositories
- usage ledger and the four-bucket token accounting
- analytics (11 finding types), baselines, cost calculator
- tool-output cache: skip rules, thresholds, dedupe, failure fallback, recovery
- compression 2.0: shell-output classifiers, accuracy guards (errors/read never compressed), determinism
- context analysis (dry-run), KV-cache risk, task/project services, HTTP API, exports
- live summary (top strip) and reference pricing

The test sources are not part of this distribution repository. The release build is verified against this suite before every release.

## Reporting a bug

Please open an issue with: DSH version, plugin version, steps to reproduce, expected vs actual, and the output of `/token-manager/api/health`. Do not include secrets or full session logs.
