# Cover Generation Server

用这个项目来生成博客封面图（SVG/PNG）。它是一个极简的 Node.js HTTP 服务：你通过 GET query 或 POST JSON 传入标题、作者、头像等字段，服务端返回一张可直接保存/嵌入的图片。

[示例](https://blog.dong4j.site/)

![Cursor 2026-04-20 01.07.39](https://cdn.dong4j.site/source/image/Cursor%202026-04-20%2001.07.39.webp)

核心目标：
- 可复现：同样的 `seed + 输入参数` 必定生成一致的封面（方便缓存与构建流程）。
- 版本化：对外以模板版本（`v1`）作为稳定契约；未来大改动会用新版本号承接。
- 低依赖：主要逻辑基于 Node.js 核心模块，PNG 渲染使用 `@resvg/resvg-js`。

## 快速开始

需要 Node.js >= 18。

```bash
npm install
npm start
# http://localhost:4321
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
- `GET /cover/png`：生成 PNG 封面（默认模板 `v1`）
- `GET /cover/random`：随机封面（除作者外随机，支持 `template` 指定模板版本）
- `GET /cover/random/png`：随机 PNG 封面
- `GET /cover/svg/v1`：显式指定模板 `v1`
- `GET /cover/png/v1`：显式指定模板 `v1` 的 PNG 输出
- `GET /cover/svg/v2`：显式指定模板 `v2`（左侧大头像 + 右侧卡片文案）
- `GET /cover/svg/v3`：显式指定模板 `v3`（纯背景大标题风格）
- `GET /cover/svg/v4`：显式指定模板 `v4`（电路板纹理 + 居中图标标题）
- `GET /cover/svg/v5`：显式指定模板 `v5`（暖色渐变网格 + 居中标题与单图标）
- `GET /cover/svg/v6`：显式指定模板 `v6`（极简浅色背景 + 居中图标标题）
- `GET /cover/svg/v7`：显式指定模板 `v7`（粉色渐变 + 左图标右文案）
- `POST /cover...`：同字段，JSON body（`/cover/svg...` 返回 SVG，`/cover/png...` 返回 PNG）

返回类型：`image/svg+xml` 或 `image/png`。

## 参数说明（v1）

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `title` | string | `Untitled Blog Post` | 标题，建议必填；服务端会裁剪长度并动态换行/缩放避免溢出。 |
| `subtitle` | string | empty | 副标题/摘要，可选。 |
| `author` | string | `Anonymous` | 作者占位符，可传任意字符串（如 `@dong4j`）。 |
| `seed` | number/string | hash(title+author+template) | 控制可复现随机；同 seed+输入 输出一致（`randomize=1` 时会被忽略）。 |
| `randomize` | bool-like | `false` | 传 `1/true/on/yes` 可开启“同参数每次不同”；会为当前请求生成临时 seed。 |
| `width` | number | 1200 | 300–4000。 |
| `height` | number | 630 | 300–4000。 |
| `background` | string | `auto` | `auto` \| `solid` \| `gradient`。`auto` 会在暖色系纯色/渐变中随机选择。 |
| `texture` | string | empty | 背景纹理叠加：empty \| `grid` \| `graph` \| `dots` \| `circuit`；不传则不叠加。 |
| `color` | string | warm auto | 背景主色；传了则固定背景为纯色（不走渐变随机）。 |
| `accent` | string | light auto | 卡片底色；不传则随机浅色。 |
| `avatarEmoji` | string | empty | 单个 emoji；优先于 `avatarUrl`。 |
| `avatarUrl` | string | empty | 头像 URL；服务端会尝试下载并内嵌到 SVG（失败时回退为外链引用）。 |

随机模式建议：
- 保留 `title/author/avatarUrl/randomize=1`
- 若希望颜色/背景/纹理都随机：不要传 `seed/color/accent/texture`，并让 `background` 留空或传 `auto`

## 随机封面（/cover/random）

- 作者固定使用配置默认值（见 `src/config.js`）。
- 必须提供 `title`，否则返回 400。
- `template` 可选：指定模板版本；不传则随机选择。
- `avatarUrl` 不接受外部输入；仅在内置头像列表中随机。

## v2 说明

`v2` 的输入字段与 `v1` 基本一致（仍然支持 `title/subtitle/author/seed/width/height/background/color/accent/avatarEmoji/avatarUrl`），但布局不同：
- 左侧：大头像（emoji/头像/占位符）
- 右侧：白色（或浅色）卡片，内含标题/副标题/作者

## v3 说明

`v3` 的输入字段与 `v1/v2` 一致，布局为：
- 纯色/渐变背景（颜色逻辑同 v1/v2：不传 `color` 时默认随机暖色渐变，可用 `background=solid|gradient|auto` 控制）
- 左上角头像（emoji/头像/占位符）
- 大标题（白字、左对齐，自动换行/缩放）
- 左下角作者

## v4 说明

`v4` 的输入字段与 `v1/v2/v3` 一致，布局为：
- 冷色系纯色/渐变背景（支持 `background=solid|gradient|auto`，不传 `color` 时默认冷色渐变）
- 电路板纹理叠加（默认 `circuit`，可用 `texture` 覆盖）
- 居中图标（优先头像/emoji；否则使用原子图形占位）
- 居中标题/副标题（自动换行/缩放）
- 居中作者

## v5 说明

`v5` 的输入字段与 `v1/v2/v3/v4` 一致，布局为：
- 暖色系纯色/渐变背景（支持 `background=solid|gradient|auto`，不传 `color` 时默认暖色渐变）
- 细网格纹理（默认内置；若传 `texture` 则使用对应纹理）
- 顶部胶囊标签（显示 `author`）
- 居中标题/副标题（自动换行/缩放）
- 单个居中图标（优先头像/emoji；否则使用标题首字符占位）

## v6 说明

`v6` 的输入字段与 `v1/v2/v3/v4/v5` 一致，布局为：
- 浅色渐变/纯色背景（默认渐变，可用 `background=solid`）
- 居中图标（优先头像/emoji；否则使用内置占位图形）
- 居中标题/副标题与作者
- 支持 `texture` 叠加（grid/graph/dots/circuit）

## v7 说明

`v7` 的输入字段与 `v1/v2/v3/v4/v5/v6` 一致，布局为：
- 粉色系渐变/纯色背景（默认渐变，可用 `background=solid`）
- 左侧图标（优先头像/emoji；否则使用内置占位图形）
- 右侧标题/副标题（左对齐）
- 支持 `texture` 叠加（grid/graph/dots/circuit）

## 示例

```bash
# 默认（v1）
curl "http://localhost:4321/cover?title=Hello%20World&author=%40dong4j&avatarEmoji=%F0%9F%91%8B" > cover.svg
curl "http://localhost:4321/cover/png?title=Hello%20World&author=%40dong4j&avatarEmoji=%F0%9F%91%8B" > cover.png
curl -X POST "http://localhost:4321/cover" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Hello World",
    "author": "@dong4j",
    "avatarEmoji": "👋"
  }' > cover.svg

# 固定 seed，便于缓存
curl "http://localhost:4321/cover/svg/v1?title=Hello&author=A&seed=2025" > cover.svg
curl -X POST "http://localhost:4321/cover/svg/v1" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Hello",
    "author": "A",
    "seed": 2025
  }' > cover.svg

# 强制渐变背景（暖色系随机渐变）
curl "http://localhost:4321/cover/svg/v1?title=Gradient&author=A&background=gradient" > cover.svg
curl -X POST "http://localhost:4321/cover/svg/v1" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Gradient",
    "author": "A",
    "background": "gradient"
  }' > cover.svg

# 固定背景色/卡片色
curl "http://localhost:4321/cover/svg/v1?title=Fixed%20Color&author=A&color=%23f97316&accent=%23fff7ed" > cover.svg
curl -X POST "http://localhost:4321/cover/svg/v1" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fixed Color",
    "author": "A",
    "color": "#f97316",
    "accent": "#fff7ed"
  }' > cover.svg

# POST JSON（同 GET 字段）
curl -X POST "http://localhost:4321/cover/svg/v1" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "架构设计：如何在 IntelliAI Engine 中优雅集成非标准协议的 AI 服务",
    "subtitle": "一些实现细节与踩坑记录",
    "author": "@dong4j",
    "seed": 2025,
    "background": "auto",
    "avatarEmoji": "👋"
  }' > cover.svg

# v2（左头像 + 右卡片）
curl "http://localhost:4321/cover/svg/v2?title=Hello&author=@dong4j&avatarEmoji=%F0%9F%91%8B&seed=12" > cover.svg
curl -X POST "http://localhost:4321/cover/svg/v2" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Hello",
    "author": "@dong4j",
    "avatarEmoji": "👋",
    "seed": 12
  }' > cover.svg

# v3（纯背景大标题）
curl "http://localhost:4321/cover/svg/v3?title=%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1%EF%BC%9A%E5%A6%82%E4%BD%95%E5%9C%A8%20IntelliAI%20Engine%20%E4%B8%AD%E4%BC%98%E9%9B%85%E9%9B%86%E6%88%90%E9%9D%9E%E6%A0%87%E5%87%86%E5%8D%8F%E8%AE%AE%E7%9A%84%20AI%20%E6%9C%8D%E5%8A%A1&author=%40dong4j&avatarEmoji=%F0%9F%91%8B&seed=2025&texture=dots" > cover.svg
curl -X POST "http://localhost:4321/cover/svg/v3" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "架构设计：如何在 IntelliAI Engine 中优雅集成非标准协议的 AI 服务",
    "author": "@dong4j",
    "avatarEmoji": "👋",
    "seed": 2025,
    "texture": "dots"
  }' > cover.svg

# texture=grid（细网格叠加）
curl "http://localhost:4321/cover/svg/v3?title=Grid%20Overlay&author=%40dong4j&seed=101&texture=grid" > cover.svg
curl -X POST "http://localhost:4321/cover/svg/v3" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Grid Overlay",
    "author": "@dong4j",
    "seed": 101,
    "texture": "grid"
  }' > cover.svg

# texture=graph（主/次网格叠加）
curl "http://localhost:4321/cover/svg/v3?title=Graph%20Overlay&author=%40dong4j&seed=102&texture=graph" > cover.svg
curl -X POST "http://localhost:4321/cover/svg/v3" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Graph Overlay",
    "author": "@dong4j",
    "seed": 102,
    "texture": "graph"
  }' > cover.svg

# texture=dots（点阵叠加）
curl "http://localhost:4321/cover/svg/v3?title=Dots%20Overlay&author=%40dong4j&seed=103&texture=dots" > cover.svg
curl -X POST "http://localhost:4321/cover/svg/v3" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Dots Overlay",
    "author": "@dong4j",
    "seed": 103,
    "texture": "dots"
  }' > cover.svg

# v4（电路板纹理 + 居中布局）
curl "http://localhost:4321/cover/svg/v4?title=React&subtitle=The%20library%20for%20web%20and%20native%20user%20interfaces&author=%40dong4j&seed=2026&texture=circuit&avatarUrl=https://cdn.dong4j.site/source/image/avatar.webp" > cover.svg
curl -X POST "http://localhost:4321/cover/svg/v4" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "React",
    "subtitle": "The library for web and native user interfaces",
    "author": "@dong4j",
    "seed": 2026,
    "texture": "circuit",
    "avatarUrl": "https://cdn.dong4j.site/source/image/avatar.webp"
  }' > cover.svg

# v5（暖色网格 + 居中标题与单图标）
curl "http://localhost:4321/cover/svg/v5?title=Launch%20a%20directory%20with%20Next.js%20and%20Sanity&author=%40dong4j&avatarEmoji=%F0%9F%94%A5&seed=2028" > cover.svg
curl -X POST "http://localhost:4321/cover/svg/v5" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Launch a directory with Next.js and Sanity",
    "author": "@dong4j",
    "seed": 2027,
    "avatarEmoji": "🔥"
  }' > cover.svg

# v6（浅色极简 + 居中图标）
curl "http://localhost:4321/cover/svg/v6?title=IndieHub&subtitle=The%20best%20directory%20for%20indie%20makers&author=%40dong4j&seed=2029&avatarEmoji=%F0%9F%9A%80&background=gradient&texture=circuit" > cover.svg
curl -X POST "http://localhost:4321/cover/svg/v6" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "IndieHub",
    "subtitle": "The best directory for indie makers",
    "author": "@dong4j",
    "seed": 2029,
    "avatarEmoji": "🚀",
    "background": "gradient",
    "texture": "circuit"
  }' > cover.svg

# v7（粉色渐变 + 左图标右文案）
curl "http://localhost:4321/cover/svg/v7?title=IndieHub&subtitle=The%20best%20directory%20for%20indie%20makers&author=%40dong4j&seed=2029&avatarEmoji=%F0%9F%9A%80&texture=dots" > cover.svg
curl -X POST "http://localhost:4321/cover/svg/v7" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "IndieHub",
    "subtitle": "The best directory for indie makers",
    "author": "@dong4j",
    "seed": 2030,
    "avatarEmoji": "🚀",
    "texture": "dots"
  }' > cover.svg

# /cover/random（随机封面）
curl "http://localhost:4321/cover/random?title=IndieHub&template=v7" > cover.svg
curl -X POST "http://localhost:4321/cover/random" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "IndieHub",
    "template": "v6"
  }' > cover.svg
```

## 项目结构（如何理解它）

- `src/server.js`：HTTP 层（路由、解析 GET/POST、体积限制、返回 SVG）。
- `src/coverGenerator/index.js`：参数归一化与 seed 处理，把“外部输入”转换为“渲染用 options”。
- `src/coverGenerator/exporter.js`：模板注册与调度（当前支持 `v1`、`v2`、`v3`、`v4`、`v5`、`v6`、`v7`）。
- `src/coverGenerator/templates/v1.js`：`v1` 模板实现，把 options 渲染成 SVG 字符串。
- `src/coverGenerator/templates/v2.js`：`v2` 模板实现（左侧大头像 + 右侧卡片）。
- `src/coverGenerator/templates/v3.js`：`v3` 模板实现（纯背景大标题）。
- `src/coverGenerator/templates/v4.js`：`v4` 模板实现（电路纹理 + 居中布局）。
- `src/coverGenerator/templates/v5.js`：`v5` 模板实现（暖色网格 + 单图标布局）。
- `src/coverGenerator/templates/v6.js`：`v6` 模板实现（浅色极简 + 居中布局）。
- `src/coverGenerator/templates/v7.js`：`v7` 模板实现（粉色渐变 + 左图标右文案）。
- `src/config.js`：随机封面默认作者/头像配置。
- `src/coverGenerator/shapeEngine.js`：小型 SVG 组件（例如头像渲染）。
- `src/coverGenerator/typographyEngine.js`：文本工具（XML 转义、基础换行）。
- `src/coverGenerator/utils.js`：seed/随机数等通用工具（可复现的 PRNG）。

## 模板版本与扩展策略（v1 / 未来 v2 v3 v4 v5 v6 v7）

把版本号当成“对外稳定契约”：
- `v1`：当前这套最满意的卡片风格（暖色背景 + 浅色卡片 + 标题自适应 + 左下角头像 + 右下角作者）。
- 未来的 `v2`/`v3`/`v4`/`v5`/`v6`/`v7`：当需要“明显不同的版式/视觉体系”且不希望影响历史封面时，再新增版本号。

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
