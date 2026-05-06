#!/usr/bin/env node
"use strict";

/**
 * 将旧版 PNG 缓存文件名（仅按 title 的 *-v3-*.png）迁移为新版
 * （template + title + author 的 *-v4-*.png）。
 *
 * 旧名规则与历史 pngCache 一致：sha256 只对 normalize 后的 title 取前 16 hex。
 * 新名规则：require 当前 src/coverGenerator/pngCache.js 的 buildPngCacheKey。
 *
 * title / author / template 以各篇文章 front matter 里 cover URL 的查询参数与路径为准
 *（与当时请求 API 一致），不是 front matter 的 title 字段。
 *
 * 用法：
 *   node scripts/migrate-png-cache-v3-to-v4.js --posts /path/to/hexo/source/_posts [--apply] [--cache-dir /path/to/cache/png]
 *
 * 默认 dry-run：只打印统计与 mv 预览；加 --apply 且提供 --cache-dir 才执行 mv（不删除文件）。
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { buildPngCacheKey } = require("../src/coverGenerator/pngCache");

function slugifyTitle(title) {
  const slug = String(title || "untitled")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || "cover";
}

function normalizeTitleForOldCache(title) {
  return String(title || "Untitled Blog Post").trim() || "Untitled Blog Post";
}

function legacyV3FileName(apiTitle) {
  const normalized = normalizeTitleForOldCache(apiTitle);
  const hash = crypto.createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 16);
  return `${slugifyTitle(normalized)}-v3-${hash}.png`;
}

function readFrontMatterBlock(fileContent) {
  if (!fileContent.startsWith("---")) return null;
  const end = fileContent.indexOf("\n---", 3);
  if (end === -1) return null;
  return fileContent.slice(3, end).trim();
}

function extractCoverUrl(frontMatter) {
  const lines = frontMatter.split("\n");
  for (const line of lines) {
    if (!/^\s*cover:\s*/.test(line)) continue;
    let v = line.replace(/^\s*cover:\s*/, "").trim();
    if (
      (v.startsWith("'") && v.endsWith("'")) ||
      (v.startsWith('"') && v.endsWith('"'))
    ) {
      v = v.slice(1, -1);
    }
    return v.trim();
  }
  return null;
}

function parseCoverPngApi(coverUrl) {
  let u;
  try {
    u = new URL(coverUrl);
  } catch {
    return null;
  }
  if (!u.hostname.includes("api.dong4j.site")) return null;
  const m = u.pathname.match(/\/cover\/png\/(v[1-7])(?:\/)?$/i);
  if (!m) return null;
  const template = m[1].toLowerCase();
  const apiTitle = u.searchParams.get("title");
  if (!apiTitle || !String(apiTitle).trim()) return null;
  const author = u.searchParams.get("author") || "Anonymous";
  return { template, title: apiTitle, author };
}

function walkMdFiles(root) {
  const out = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && ent.name.endsWith(".md")) out.push(p);
    }
  }
  walk(root);
  return out;
}

function parseArgs(argv) {
  const args = { apply: false, postsRoot: null, cacheDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--apply") args.apply = true;
    else if (a === "--posts") args.postsRoot = argv[++i];
    else if (a === "--cache-dir") args.cacheDir = argv[++i];
    else if (a === "-h" || a === "--help") args.help = true;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.postsRoot) {
    console.error(`Usage: node ${path.basename(__filename)} --posts <hexo_source/_posts> [--cache-dir <png_cache_dir>] [--apply]`);
    process.exit(args.help ? 0 : 1);
  }

  const postsRoot = path.resolve(args.postsRoot);
  if (!fs.statSync(postsRoot).isDirectory()) {
    console.error("posts root is not a directory:", postsRoot);
    process.exit(1);
  }

  /** @type {Map<string, { template: string, title: string, author: string, source: string }[]>} */
  const byOldName = new Map();

  for (const mdPath of walkMdFiles(postsRoot)) {
    const raw = fs.readFileSync(mdPath, "utf8");
    const fm = readFrontMatterBlock(raw);
    if (!fm) continue;
    const coverUrl = extractCoverUrl(fm);
    if (!coverUrl) continue;
    const parsed = parseCoverPngApi(coverUrl);
    if (!parsed) continue;

    const oldName = legacyV3FileName(parsed.title);
    const newName = buildPngCacheKey({
      mode: "cover",
      template: parsed.template,
      title: parsed.title,
      author: parsed.author
    });

    const list = byOldName.get(oldName) || [];
    list.push({
      template: parsed.template,
      title: parsed.title,
      author: parsed.author,
      newName,
      source: path.relative(postsRoot, mdPath)
    });
    byOldName.set(oldName, list);
  }

  /** @type {{ oldName: string, newName: string, source: string }[]} */
  const plan = [];
  const conflicts = [];

  for (const [oldName, entries] of byOldName) {
    const newNames = [...new Set(entries.map(e => e.newName))];
    if (newNames.length > 1) {
      conflicts.push({ oldName, entries, newNames });
      continue;
    }
    plan.push({
      oldName,
      newName: newNames[0],
      source: entries.map(e => e.source).join(", ")
    });
  }

  console.error(`[plan] posts scanned under: ${postsRoot}`);
  console.error(`[plan] cover/png/v1-v7 mappings: ${plan.length}`);
  console.error(`[plan] conflicts (same old v3 key, different v4 targets): ${conflicts.length}`);

  if (conflicts.length) {
    console.error("\n--- conflicts (skipped; fix cover URLs or merge manually) ---");
    for (const c of conflicts.slice(0, 20)) {
      console.error(c.oldName, "->", c.newNames.join(" | "));
      for (const e of c.entries) {
        console.error(`  ${e.source}: ${e.template} ${e.title.slice(0, 48)}...`);
      }
    }
    if (conflicts.length > 20) console.error(`  ... and ${conflicts.length - 20} more`);
  }

  if (!args.apply) {
    console.error(`\n[dry-run] mv commands (${plan.length} total, stdout):`);
    for (const row of plan) {
      console.log(`mv -n ${JSON.stringify(row.oldName)} ${JSON.stringify(row.newName)}`);
    }
    console.error("\nRe-run with --apply --cache-dir <dir> to execute on a machine that has the cache directory.");
    return;
  }

  if (!args.cacheDir) {
    console.error("--apply requires --cache-dir");
    process.exit(1);
  }

  const cacheDir = path.resolve(args.cacheDir);
  let ok = 0;
  let missing = 0;
  let skippedNewExists = 0;

  for (const row of plan) {
    const from = path.join(cacheDir, row.oldName);
    const to = path.join(cacheDir, row.newName);
    if (!fs.existsSync(from)) {
      missing += 1;
      continue;
    }
    if (fs.existsSync(to)) {
      skippedNewExists += 1;
      continue;
    }
    fs.renameSync(from, to);
    ok += 1;
  }

  console.error(`[apply] renamed: ${ok}, old missing: ${missing}, target already exists skipped: ${skippedNewExists}`);
}

main();
