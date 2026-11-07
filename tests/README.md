# 测试套件说明（Test suite：不公开源码）Tests are not published

发行版不包含测试源码。本项目的单元测试在发布前运行：`node --test "tests/unit/*.test.mjs"`，
真实运行验收记录见 `docs/AUTO-TEST-REPORT.md` 与 `.verify/auto/`（后者不进版本库）。
