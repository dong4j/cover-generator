# Repository Guidelines

## 项目结构与模块
- `src/server.js`：服务启动入口（监听端口、日志）。
- `src/createServer.js`：HTTP Server 工厂（路由、GET/POST 解析、错误处理、体积限制），用于测试与复用。
- `src/coverGenerator/index.js`：输入归一化与 `seed` 处理，把 query/body 转为渲染 `options`。
- `src/coverGenerator/exporter.js`：模板注册与调度（根据 `options.template` 选择渲染函数并返回 SVG）。
- `src/coverGenerator/templates/v1.js`：模板 `v1` 的具体实现（输出 SVG 字符串）。
- `src/coverGenerator/shapeEngine.js`：可复用 SVG 组件（例如头像）。
- `src/coverGenerator/typographyEngine.js`：文本工具（XML 转义、基础换行）。
- `src/coverGenerator/utils.js`：seed/PRNG 等通用工具（可复现随机）。
- `README.md`：对外 API、参数说明与使用示例（第一人称技术视角）。
- `docs/TECHNICAL_ANALYSIS.md`：架构/技术细节分析与版本演进建议。
- `tests/`：`node:test` 单元测试（不依赖网络/不监听端口）。
- `package.json`：项目元数据与脚本（`dev/check/test`）。

## 开发、构建与运行
- 需要 Node.js >= 18。
- `npm install`：安装依赖（仅使用 Node.js 核心模块，无额外依赖）。
- `npm start`：启动本地服务（默认端口 3000）。
- `npm run dev`：开发模式（`node --watch` 自动重启）。
- `npm run check`：语法检查（轻量替代 lint）。
- `npm test`：运行 `node:test`。

## 编码风格与命名
- 语言：JavaScript（Node.js，无框架）。
- 风格：保持简洁函数化，小心共享状态；对外 API 参数先标准化再传入模板；模板实现尽量纯函数（输入 `options`，输出 string）。
- 命名：使用小写+驼峰（e.g. `renderTemplateV1`、`normalizeSeed`）；常量全大写下划线。
- 字符集：默认 ASCII，除内容字符串外避免非 ASCII。
- 字体回退与 emoji：已内置常见 emoji 字体栈，修改时保持回退顺序。
- 注释：关键边界/算法需要注释解释“为什么”（例如：seed 规则、换行/缩放策略、参数兼容策略）；避免无意义逐行注释。

## 测试与验证
- 提交前至少运行 `npm run check` 与 `npm test`。
- 测试优先写在 `tests/*.test.js`（使用 `node:test`）；避免监听端口（部分沙盒环境禁止 `listen()`）。
- 保持同一 `seed + template + 输入` 下输出可复现；修改随机逻辑务必用固定 seed 验证。

## 提交与 PR
- Commit 消息：倾向简洁祈使句（如 `add seedable template v1`）。若使用类型前缀，可参考 `feat:`/`fix:`。
- PR 要求：说明变更意图、示例请求/响应、影响的模板版本；界面/渲染变更可附示例 SVG。
- 避免引入破坏性默认变更；默认输出样式发生明显变化时，请新增模板版本（如 `v2`）并保留旧版。

## 安全与配置提示
- HTTP 服务仅处理 JSON/查询参数，限制体积 512KB；新增处理逻辑时保持输入校验与上限控制。
- 远程头像/资源由客户端渲染加载，不做代理；如新增下载/缓存逻辑需考虑超时与域名白名单/SSRF 风险。
- 种子与模板决定输出，可用于缓存键；SVG 内部 `id`/`defs` 命名要避免冲突（使用 seed 派生前缀）。

## 如何新增后续版本（v2 / v3）
建议按“模板文件独立 + exporter 注册 + 路由放开 + 文档/测试同步”的流程做：

1) 新增模板实现文件
- 新建 `src/coverGenerator/templates/v2.js`，导出 `renderTemplateV2(options)`。
- 模板函数保持纯：输入 `options`，输出完整 SVG 字符串。
- `idBase`/`defs` 命名使用 `cover-v2-${seedHex}` 之类的前缀，避免与 v1 冲突。

2) 注册模板
- 在 `src/coverGenerator/exporter.js` 引入并注册：`templates.v2 = renderTemplateV2`。

3) 放开路由版本白名单
- 在 `src/createServer.js` 的 `matchCoverTemplatePath()` 里将正则从只允许 `v1` 扩展为允许 `v2`（以及未来 `v3`）。

4) 放开输入层 template（如需要）
- 当前 `src/coverGenerator/index.js` 强制 `options.template = "v1"`。
- 如果要对外开放 `v2`，需要改成：允许 `templateFromPath` 或请求参数 `template` 选择 v2，并校验在 allowlist 内。

5) 文档与测试同步
- 更新 `README.md`：新增 `/cover/svg/v2`、参数差异说明与示例。
- 更新 `docs/TECHNICAL_ANALYSIS.md`：补充 v2 的设计动机与兼容策略。
- 增加/更新 `tests/*.test.js`：至少覆盖“可复现 + 关键参数生效 + 版本隔离”。

6) 版本策略（何时升版本 vs 加参数）
- 同一视觉体系内的可选项：优先加参数（不改变默认辨识度）。
- 布局/默认视觉/排版策略发生明显变化：升版本（v2/v3），保持 v1 行为不变。
