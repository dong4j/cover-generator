# Cover Generation Server

用这个项目来生成博客封面图（SVG）。它是一个极简的 Node.js HTTP 服务：你通过 GET query 或 POST JSON 传入标题、作者、头像等字段，服务端返回一张可直接保存/嵌入的 `image/svg+xml`。

核心目标：
- 可复现：同样的 `seed + 输入参数` 必定生成一致的封面（方便缓存与构建流程）。
- 版本化：对外以模板版本（`v1`）作为稳定契约；未来大改动会用新版本号承接。
- 无依赖：纯 Node.js 核心模块，不引入第三方包。

## 快速开始

需要 Node.js >= 18。

```bash
npm install
npm start
# http://localhost:3000
```

## 开发与校验

```bash
# 开发（自动重启）
npm run dev

# 语法检查（轻量替代 lint）
npm run check

# 测试（node:test）
npm test
```

## API

- `GET /health`：健康检查
- `GET /cover` 或 `GET /cover/svg`：生成封面（默认模板 `v1`）
- `GET /cover/svg/v1`：显式指定模板 `v1`
- `POST /cover...`：同字段，JSON body

返回类型：`image/svg+xml`。

## 参数说明（v1）

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `title` | string | `Untitled Blog Post` | 标题，建议必填；服务端会裁剪长度并动态换行/缩放避免溢出。 |
| `subtitle` | string | empty | 副标题/摘要，可选。 |
| `author` | string | `Anonymous` | 作者占位符，可传任意字符串（如 `@dong4j`）。 |
| `seed` | number/string | hash(title+author+template) | 控制可复现随机；同 seed+输入 输出一致。 |
| `width` | number | 1600 | 300–4000。 |
| `height` | number | 900 | 300–4000。 |
| `background` | string | `auto` | `auto` \| `solid` \| `gradient`。`auto` 会在暖色系纯色/渐变中随机选择。 |
| `color` | string | warm auto | 背景主色；传了则固定背景为纯色（不走渐变随机）。 |
| `accent` | string | light auto | 卡片底色；不传则随机浅色。 |
| `avatarEmoji` | string | empty | 单个 emoji；优先于 `avatarUrl`。 |
| `avatarUrl` | string | empty | 头像 URL；服务端不下载，只在 SVG 里引用 `<image href="...">`。 |

## 示例

```bash
# 默认（v1）
curl "http://localhost:3000/cover?title=Hello%20World&author=%40dong4j&avatarEmoji=%F0%9F%91%8B" > cover.svg

# 固定 seed，便于缓存
curl "http://localhost:3000/cover/svg/v1?title=Hello&author=A&seed=2025" > cover.svg

# 强制渐变背景（暖色系随机渐变）
curl "http://localhost:3000/cover/svg/v1?title=Gradient&author=A&background=gradient" > cover.svg

# 固定背景色/卡片色
curl "http://localhost:3000/cover/svg/v1?title=Fixed%20Color&author=A&color=%23f97316&accent=%23fff7ed" > cover.svg

# POST JSON（同 GET 字段）
curl -X POST "http://localhost:3000/cover/svg/v1" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "架构设计：如何在 IntelliAI Engine 中优雅集成非标准协议的 AI 服务",
    "subtitle": "一些实现细节与踩坑记录",
    "author": "@dong4j",
    "seed": 2025,
    "background": "auto",
    "avatarEmoji": "👋"
  }' > cover.svg
```

## 项目结构（如何理解它）

- `src/server.js`：HTTP 层（路由、解析 GET/POST、体积限制、返回 SVG）。
- `src/coverGenerator/index.js`：参数归一化与 seed 处理，把“外部输入”转换为“渲染用 options”。
- `src/coverGenerator/exporter.js`：模板注册与调度（当前只保留 `v1`）。
- `src/coverGenerator/templates/v1.js`：`v1` 模板实现，把 options 渲染成 SVG 字符串。
- `src/coverGenerator/shapeEngine.js`：小型 SVG 组件（例如头像渲染）。
- `src/coverGenerator/typographyEngine.js`：文本工具（XML 转义、基础换行）。
- `src/coverGenerator/utils.js`：seed/随机数等通用工具（可复现的 PRNG）。

## 模板版本与扩展策略（v1 / 未来 v2 v3）

把版本号当成“对外稳定契约”：
- `v1`：当前这套最满意的卡片风格（暖色背景 + 浅色卡片 + 标题自适应 + 左下角头像 + 右下角作者）。
- 未来的 `v2`/`v3`：当需要“明显不同的版式/视觉体系”且不希望影响历史封面时，再新增版本号。

`v1` 不只是“一个布局”，它包含：
- 布局（标题区域/footer/头像位置）
- 字体与排版策略（字号、行距、动态换行/缩放）
- 配色策略（暖色背景、随机渐变、浅色卡片）
- 可复现策略（seed 如何参与随机）

如何决定“加参数”还是“升版本”：
- 适合加参数：同一视觉体系内的微调（例如 `background` 的选择、卡片圆角强度、阴影强度、对齐方式）。
- 适合升版本：布局大改、默认风格明显改变、文字策略大改、配色体系大改，或担心影响历史封面一致性。

## 进一步阅读

- 技术分析与架构设计：`docs/TECHNICAL_ANALYSIS.md`
