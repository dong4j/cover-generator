"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_CACHE_DIR = path.join(process.cwd(), "cache", "png");
/** Bump when cache key material changes (invalidates old title-only keys). */
const PNG_CACHE_VERSION = "v4";
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

function normalizeCacheTitle(title) {
  return String(title || "Untitled Blog Post").trim() || "Untitled Blog Post";
}

function normalizeCacheAuthor(author) {
  return String(author || "").trim() || "Anonymous";
}

/**
 * @param {{ mode: "cover"|"random", template?: string, title: string, author: string }} descriptor
 */
function buildPngCacheKey(descriptor) {
  const mode = descriptor && descriptor.mode === "random" ? "random" : "cover";
  const title = normalizeCacheTitle(descriptor.title);
  const author = normalizeCacheAuthor(descriptor.author);
  let material;
  let prefixSlug;
  if (mode === "random") {
    material = `random|${title}|${author}`;
    prefixSlug = slugifyTitle(`rnd-${title}-${author}`);
  } else {
    const template = String(descriptor.template || "v1").toLowerCase();
    material = `${template}|${title}|${author}`;
    prefixSlug = slugifyTitle(`${template}-${title}-${author}`);
  }
  const hash = crypto.createHash("sha256").update(material, "utf8").digest("hex").slice(0, 16);
  const safePrefix = (prefixSlug || "cover").slice(0, 80);
  return `${safePrefix}-${PNG_CACHE_VERSION}-${hash}.png`;
}

/**
 * @param {{ mode: "cover"|"random", template?: string, title: string, author: string }} descriptor
 */
function buildPngCachePath(descriptor, deps = {}) {
  return path.join(resolvePngCacheDir(deps), buildPngCacheKey(descriptor));
}

async function readCachedPng(descriptor, deps = {}) {
  if (deps.disablePngCache) return null;
  try {
    return await fs.readFile(buildPngCachePath(descriptor, deps));
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    throw err;
  }
}

async function writeCachedPng(descriptor, pngBuffer, deps = {}) {
  if (deps.disablePngCache) return pngBuffer;
  const cacheDir = resolvePngCacheDir(deps);
  const cachePath = buildPngCachePath(descriptor, deps);
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(cachePath, pngBuffer);
  return pngBuffer;
}

/**
 * @param {{ mode: "cover"|"random", template?: string, title: string, author: string }} descriptor
 */
async function getOrCreateCachedPng(descriptor, createPng, deps = {}) {
  const cached = await readCachedPng(descriptor, deps);
  if (cached) return cached;
  if (deps.disablePngCache) return createPng();

  const cachePath = buildPngCachePath(descriptor, deps);
  if (inFlightWrites.has(cachePath)) return inFlightWrites.get(cachePath);

  const task = (async () => {
    const cachedAfterWait = await readCachedPng(descriptor, deps);
    if (cachedAfterWait) return cachedAfterWait;
    const png = await createPng();
    return writeCachedPng(descriptor, png, deps);
  })();

  inFlightWrites.set(cachePath, task);
  try {
    return await task;
  } finally {
    inFlightWrites.delete(cachePath);
  }
}

module.exports = {
  PNG_CACHE_VERSION,
  buildPngCacheKey,
  buildPngCachePath,
  getOrCreateCachedPng,
  readCachedPng,
  resolvePngCacheDir,
  writeCachedPng
};
