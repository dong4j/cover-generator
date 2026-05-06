#!/usr/bin/env node
"use strict";

/**
 * 仅根据「已发布」目录下文章的 cover URL（api.dong4j.site/cover/png/vN?...）
 * 计算合法的 PNG 缓存文件名（当前 pngCache v4 规则），删除缓存目录里不在该集合中的 *.png。
 *
 * 用法：
 *   node scripts/prune-png-cache-by-publish.js \
 *     --publish-root /path/to/hexo/source/_posts/publish \
 *     --cache-dir /path/to/cache/png
 *
 *   # 远程（通过 ssh，一次性 rm）
 *   node scripts/prune-png-cache-by-publish.js \
 *     --publish-root .../publish \
 *     --ssh-host m2 \
 *     --remote-cache-dir /Users/.../cover-generator/cache/png \
 *     [--apply]
 *
 * 默认 dry-run：stderr 打印统计；stdout 打印将删除的文件名（每行一个）。加 --apply 才删除。
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const { buildPngCacheKey } = require("../src/coverGenerator/pngCache");

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

/** @returns {Set<string>} basenames like xxx-v4-abcdef.png */
function collectAllowedBasenames(publishRoot) {
  const allowed = new Set();
  for (const mdPath of walkMdFiles(publishRoot)) {
    const raw = fs.readFileSync(mdPath, "utf8");
    const fm = readFrontMatterBlock(raw);
    if (!fm) continue;
    const coverUrl = extractCoverUrl(fm);
    if (!coverUrl) continue;
    const parsed = parseCoverPngApi(coverUrl);
    if (!parsed) continue;
    allowed.add(
      buildPngCacheKey({
        mode: "cover",
        template: parsed.template,
        title: parsed.title,
        author: parsed.author
      })
    );
  }
  return allowed;
}

function listLocalPngBasenames(cacheDir) {
  return fs
    .readdirSync(cacheDir, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith(".png"))
    .map(e => e.name);
}

function listRemotePngBasenames(sshHost, remoteCacheDir) {
  const dir = remoteCacheDir.replace(/\/$/, "");
  const dirQ = shellQuoteSingle(dir);
  const script = `find ${dirQ} -maxdepth 1 -name '*.png' -type f 2>/dev/null | while IFS= read -r f; do basename "$f"; done`;
  const out = execFileSync("ssh", [sshHost, script], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024
  });
  return out
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = {
    apply: false,
    publishRoot: null,
    cacheDir: null,
    sshHost: null,
    remoteCacheDir: null
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--apply") args.apply = true;
    else if (a === "--publish-root") args.publishRoot = argv[++i];
    else if (a === "--cache-dir") args.cacheDir = argv[++i];
    else if (a === "--ssh-host") args.sshHost = argv[++i];
    else if (a === "--remote-cache-dir") args.remoteCacheDir = argv[++i];
    else if (a === "-h" || a === "--help") args.help = true;
  }
  return args;
}

function shellQuoteSingle(s) {
  return `'${String(s).replace(/'/g, `'\"'\"'`)}'`;
}

function remoteRm(sshHost, remoteCacheDir, basenames) {
  if (basenames.length === 0) return;
  const dir = remoteCacheDir.replace(/\/$/, "");
  const files = basenames.map(b => shellQuoteSingle(b)).join(" ");
  const script = `cd ${shellQuoteSingle(dir)} && rm -f ${files}`;
  execFileSync("ssh", [sshHost, script], { stdio: "inherit" });
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.publishRoot) {
    console.error(
      `Usage: node ${path.basename(__filename)} --publish-root <hexo/source/_posts/publish> \\\n` +
        `  (--cache-dir <local/cache/png> | --ssh-host <host> --remote-cache-dir <remote/cache/png>) \\\n` +
        `  [--apply]`
    );
    process.exit(args.help ? 0 : 1);
  }

  const publishRoot = path.resolve(args.publishRoot);
  if (!fs.statSync(publishRoot).isDirectory()) {
    console.error("publish root is not a directory:", publishRoot);
    process.exit(1);
  }

  const useSsh = Boolean(args.sshHost && args.remoteCacheDir);
  const useLocal = Boolean(args.cacheDir);

  if (useSsh === useLocal) {
    console.error("Specify exactly one of: --cache-dir (local) OR (--ssh-host + --remote-cache-dir)");
    process.exit(1);
  }

  const allowed = collectAllowedBasenames(publishRoot);
  console.error(`[prune] publish scan: ${publishRoot}`);
  console.error(`[prune] allowed PNG keys (from cover/png URLs): ${allowed.size}`);

  const existing = useSsh
    ? listRemotePngBasenames(args.sshHost, args.remoteCacheDir)
    : listLocalPngBasenames(path.resolve(args.cacheDir));

  console.error(`[prune] png files on target: ${existing.length}`);

  const obsolete = existing.filter(name => !allowed.has(name));
  console.error(`[prune] to delete (not in publish-derived allowlist): ${obsolete.length}`);

  for (const name of obsolete) {
    console.log(name);
  }

  if (!args.apply) {
    console.error("\n[prune] dry-run only. Re-run with --apply to delete listed files.");
    return;
  }

  if (obsolete.length === 0) {
    console.error("[prune] nothing to delete.");
    return;
  }

  if (useSsh) {
    remoteRm(args.sshHost, args.remoteCacheDir, obsolete);
    console.error(`[prune] deleted ${obsolete.length} file(s) on ${args.sshHost}`);
  } else {
    const dir = path.resolve(args.cacheDir);
    let n = 0;
    for (const name of obsolete) {
      const p = path.join(dir, name);
      fs.unlinkSync(p);
      n += 1;
    }
    console.error(`[prune] deleted ${n} file(s) under ${dir}`);
  }
}

main();
