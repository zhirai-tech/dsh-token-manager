# 源码与测试不随插件包发布（Sources are not published）

本目录是插件的 TypeScript 源码（Host 半 + Client 半）。发行版（GitHub 仓库 / 插件市场）只包含
编译后的 `lib/`、语言包、文档与市场元数据，不包含源码。

- 构建：`node scripts/build.mjs`（Host → `lib/index.js`，Client → `lib/client.js`）
- 测试：`node scripts/build-tests.mjs && node --test "tests/unit/*.test.mjs"`
