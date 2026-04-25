"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_CACHE_DIR = path.join(process.cwd(), "cache", "png");
const PNG_CACHE_VERSION = "v3";
const inFlightWrites = new Map();

function resolvePngCacheDir(deps = {}) {
  return deps.pngCacheDir || process.env.COVER_PNG_CACHE_DIR || DEFAULT_CACHE_DIR;
}

function slugifyTitle(title) {
  const slug = String(title || "untitled")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || "cover";
}

function buildPngCacheKey(title) {
  // The title is the logical cache key, but the hash keeps filenames safe and stable
  // for CJK titles, punctuation, and very long input.
  const normalizedTitle = String(title || "Untitled Blog Post").trim() || "Untitled Blog Post";
  const hash = crypto.createHash("sha256").update(normalizedTitle).digest("hex").slice(0, 16);
  return `${slugifyTitle(normalizedTitle)}-${PNG_CACHE_VERSION}-${hash}.png`;
}

function buildPngCachePath(title, deps = {}) {
  return path.join(resolvePngCacheDir(deps), buildPngCacheKey(title));
}

async function readCachedPng(title, deps = {}) {
  if (deps.disablePngCache) return null;
  try {
    return await fs.readFile(buildPngCachePath(title, deps));
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    throw err;
  }
}

async function writeCachedPng(title, pngBuffer, deps = {}) {
  if (deps.disablePngCache) return pngBuffer;
  const cacheDir = resolvePngCacheDir(deps);
  const cachePath = buildPngCachePath(title, deps);
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(cachePath, pngBuffer);
  return pngBuffer;
}

async function getOrCreateCachedPng(title, createPng, deps = {}) {
  const cached = await readCachedPng(title, deps);
  if (cached) return cached;
  if (deps.disablePngCache) return createPng();

  const cachePath = buildPngCachePath(title, deps);
  if (inFlightWrites.has(cachePath)) return inFlightWrites.get(cachePath);

  const task = (async () => {
    const cachedAfterWait = await readCachedPng(title, deps);
    if (cachedAfterWait) return cachedAfterWait;
    const png = await createPng();
    return writeCachedPng(title, png, deps);
  })();

  inFlightWrites.set(cachePath, task);
  try {
    return await task;
  } finally {
    inFlightWrites.delete(cachePath);
  }
}

module.exports = {
  buildPngCacheKey,
  buildPngCachePath,
  getOrCreateCachedPng,
  readCachedPng,
  resolvePngCacheDir,
  writeCachedPng
};
