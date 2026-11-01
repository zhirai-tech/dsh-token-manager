# DSH Token Manager

[![DSH](https://img.shields.io/badge/DeepSeek%20Harness-0.2.x-4c6ef5)](https://github.com/deepseek-ai/deepseek-harness)
[![Tests](https://img.shields.io/badge/tests-231%20passing-2f9e44)](#development)
[![Dependencies](https://img.shields.io/badge/runtime%20dependencies-0-2f9e44)](#development)
[![License](https://img.shields.io/badge/license-proprietary%20(UNLICENSED)-868e96)](#license)

**Token cost monitoring, call-efficiency analysis and reversible tool-output caching for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).**

ZHIRAI · 智睿科技 · independent developer

**English** | [中文说明](README.zh-CN.md)

---

![Plugin disabled vs enabled](docs/screenshots/annotated-07-compare.png)

| Dashboard | Live top strip | Compression records |
|---|---|---|
| ![Dashboard](docs/screenshots/annotated-02-after.png) | ![Live strip](docs/screenshots/annotated-03-overlay.png) | ![Cache](docs/screenshots/annotated-04-cache.png) |

![A/B measurement](docs/screenshots/annotated-05-ab.png)

> Real screenshots from a running DSH desktop app: **left = plugin disabled**, **right = plugin enabled** (same machine, only the plugin toggled). The A/B chart comes from a real model call comparison: **44,067 → 30,068 tokens (−31.8%) with identical answers**.

---

。