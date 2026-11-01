# Publishing DSH Token Manager to a plugin market

DSH's plugin market is **not a central store** — it is a **JSON index file** (`format: 1`) served from any static host. Users add index URLs under **Plugins → Discover → Add index source** (requires the experimental *Custom plugin market* bundle), then browse and install entries.

Official reference: <https://deepseek-harness.github.io/deepseek-harness/guide/plugin-market.html>

This repository provides a ready index so the plugin can be installed from a market without an npm account.

---

## 1. Self-hosted index (recommended, no approval needed)

`docs/market/index.json` lists this plugin with a **Git source** pinned to a commit. The icon lives in `docs/market/icons/icon.png` and is referenced relatively, so the index works on any host.

The index is served directly from the repository over `raw.githubusercontent.com` (no Pages required):

```
https://raw.githubusercontent.com/zhirai-tech/dsh-token-manager/main/docs/market/index.json
```

Users then:

1. Enable the custom-market bundle (Plugins → Experimental plugins → *Custom plugin market*);
2. Plugins → Discover → Add index source → paste the URL;
3. Find **DSH Token Manager** and install the listed version.

The `versions[].source` may be either:

```json
{ "type": "git",  "url": "https://github.com/zhirai-tech/dsh-token-manager", "commit": "<40-char SHA>" }
```

or, after npm publishing:

```json
{ "type": "npm", "registry": "https://registry.npmjs.org" }
```

For Git entries DSH installs `git+<url>.git#<commit>`, and adds `&path:/<subdir>` for a monorepo package. For npm entries it installs `name@version`. `engines.dsh` is checked again during installation.

> **Note:** the repository keeps `"private": true` and an `UNLICENSED` license. Git-source market entries work with that; publishing to npm would require `"private": false` plus an npm token (`npm login` / `npm publish --access public`).

---

## 2. Community catalogs

DSH ships no built-in index. Two community indexes are commonly configured (both observed in this environment):

| Index URL | What it is | How to get listed |
|---|---|---|
| `https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json` | npm package `dsh-plugin-catalog`, generated from the [awesome-dsh-plugin](https://github.com/billLiao/awesome-dsh-plugin) list | 1) Add the GitHub topic **`dsh-plugin`** to the repository; 2) ensure `package.json` declares `dsh.bundle` + `dsh.client`; 3) open a PR adding one line to the right `categories/*.md`, format: `- [owner/repo](url) — Description` |
| `https://api.dshfind.com/market/dsh-index.json` | dshfind.com market index | Submit through the [dsh-plugin.org submission page](https://dsh-plugin.org/zh/submit) (or the dshfind site forms); it indexes DSH plugins and links back to the repository |

Both catalogs are run by third parties. Being listed depends on their review; this repository keeps the metadata they expect (`dsh.bundle`, `dsh.client`, author, homepage, repository, icon) so submission is copy-paste.

### Suggested awesome-dsh-plugin entry

Category: **Tools & Capabilities** (`categories/tools-capabilities.md`) — or *Workflow & Automation* when focusing on task automation.

```markdown
- [zhirai-tech/dsh-token-manager](https://github.com/zhirai-tech/dsh-token-manager) — Token cost monitoring, call-efficiency analysis, reversible tool-output caching, task/project reports for DeepSeek Harness.
```

---

## 3. Index format cheat sheet

Minimal valid index for this plugin:

```json
{
  "format": 1,
  "title": { "en": "ZHIRAI plugins", "zh": "智睿插件" },
  "plugins": [
    {
      "name": "dsh-token-manager",
      "title": { "en": "DSH Token Manager", "zh": "DSH Token 管理器" },
      "description": {
        "en": "Token cost monitoring, model-call efficiency analysis and reversible tool-output caching for DeepSeek Harness.",
        "zh": "DeepSeek Harness 的 Token 成本监控、模型调用效率分析与可逆工具输出缓存。"
      },
      "icon": "icons/icon.png",
      "author": "ZHIRAI",
      "homepage": "https://github.com/zhirai-tech/dsh-token-manager#readme",
      "repository": { "url": "https://github.com/zhirai-tech/dsh-token-manager" },
      "versions": [
        {
          "version": "1.0.0",
          "publishTimestamp": 1793600000,
          "source": {
            "type": "git",
            "url": "https://github.com/zhirai-tech/dsh-token-manager",
            "commit": "<40-char commit SHA>"
          },
          "engines": { "dsh": ">=0.2.0-rc.5" }
        }
      ]
    }
  ]
}
```

Field rules (abridged): `title` must include `en`; `icon` is an inline `data:` URL (≤32 KiB) or a URL/relative path; `publishTimestamp` is Unix seconds; every version needs `version` (exact SemVer), `publishTimestamp`, `source`; `metadata.category/labels/sortKeys` may only reference declared ids.

The DSH repository also ships a generator (`apps/plugin-market-generator`) that can build an index from a plain list of npm names / Git URLs.

---

## 4. Release checklist used for v1.0.0

- [x] `npm run build` (host + client bundles in `lib/`)
- [x] `npm test` → 216/216
- [x] `dsh.bundle` + `dsh.client` declared in `package.json`
- [x] repository topic `dsh-plugin` added on GitHub
- [x] Runtime + source zips attached to the GitHub Release, SHA-256 published
- [x] `docs/market/index.json` + icon committed
- [ ] npm publish (optional, requires npm account)
- [ ] awesome-dsh-plugin PR (optional, community listing)
- [ ] dshfind / dsh-plugin.org submission (optional, community listing)
