"use strict";

const dns = require("node:dns/promises");
const net = require("node:net");

const AVATAR_FETCH_TIMEOUT_MS = parsePositiveInt(process.env.AVATAR_FETCH_TIMEOUT_MS, 2500);
const AVATAR_FETCH_MAX_BYTES = parsePositiveInt(process.env.AVATAR_FETCH_MAX_BYTES, 1024 * 1024);
const AVATAR_CACHE_TTL_MS = parsePositiveInt(process.env.AVATAR_CACHE_TTL_MS, 10 * 60 * 1000);
const AVATAR_CACHE_MAX_ENTRIES = parsePositiveInt(process.env.AVATAR_CACHE_MAX_ENTRIES, 256);
const DNS_LOOKUP_TIMEOUT_MS = parsePositiveInt(process.env.DNS_LOOKUP_TIMEOUT_MS, 1200);
const DISABLE_AVATAR_EMBED = process.env.DISABLE_AVATAR_EMBED === "1";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp"
]);

const EXTENSION_TO_MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".bmp": "image/bmp"
};

const avatarDataCache = new Map();
const hostSafetyCache = new Map();
const inFlightFetches = new Map();

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function setCacheEntry(cache, key, value, ttlMs, maxEntries) {
  cache.delete(key);
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

function getCacheEntry(cache, key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Operation timed out")), timeoutMs);
    promise
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function inferMimeFromPathname(pathname) {
  const lowerPath = String(pathname || "").toLowerCase();
  for (const [extension, mime] of Object.entries(EXTENSION_TO_MIME)) {
    if (lowerPath.endsWith(extension)) return mime;
  }
  return "";
}

function pickAvatarMime(response, urlObject) {
  const contentType = String(response.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (ALLOWED_MIME_TYPES.has(contentType)) return contentType;

  const inferred = inferMimeFromPathname(urlObject.pathname);
  if (ALLOWED_MIME_TYPES.has(inferred)) return inferred;
  return "";
}

function isPrivateIPv4(address) {
  const parts = address.split(".").map(part => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIPv6(address) {
  const normalized = String(address || "").toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    if (net.isIP(mapped) === 4) return isPrivateIPv4(mapped);
  }
  return false;
}

function isPublicIpAddress(address) {
  const ipVersion = net.isIP(address);
  if (!ipVersion) return false;
  if (ipVersion === 4) return !isPrivateIPv4(address);
  return !isPrivateIPv6(address);
}

async function isPublicHostname(hostname, deps) {
  const cached = getCacheEntry(hostSafetyCache, hostname);
  if (cached !== null) return cached;

  const ipVersion = net.isIP(hostname);
  if (ipVersion) {
    const allowedIp = isPublicIpAddress(hostname);
    setCacheEntry(hostSafetyCache, hostname, allowedIp, AVATAR_CACHE_TTL_MS, AVATAR_CACHE_MAX_ENTRIES);
    return allowedIp;
  }

  if (hostname === "localhost" || hostname.endsWith(".local")) {
    setCacheEntry(hostSafetyCache, hostname, false, AVATAR_CACHE_TTL_MS, AVATAR_CACHE_MAX_ENTRIES);
    return false;
  }

  const dnsLookup = deps.dnsLookup || dns.lookup;
  try {
    const records = await withTimeout(
      dnsLookup(hostname, { all: true, verbatim: true }),
      DNS_LOOKUP_TIMEOUT_MS
    );
    const list = Array.isArray(records) ? records : [records];
    const allowed = list.length > 0 && list.every(record => isPublicIpAddress(record.address));
    setCacheEntry(hostSafetyCache, hostname, allowed, AVATAR_CACHE_TTL_MS, AVATAR_CACHE_MAX_ENTRIES);
    return allowed;
  } catch {
    setCacheEntry(hostSafetyCache, hostname, false, AVATAR_CACHE_TTL_MS, AVATAR_CACHE_MAX_ENTRIES);
    return false;
  }
}

async function readResponseBodyLimited(response, maxBytes, controller) {
  const lengthHeader = Number.parseInt(String(response.headers.get("content-length") || ""), 10);
  if (Number.isFinite(lengthHeader) && lengthHeader > maxBytes) {
    throw new Error("Avatar exceeds max size");
  }

  if (!response.body || typeof response.body.getReader !== "function") {
    const arr = await response.arrayBuffer();
    const buffer = Buffer.from(arr);
    if (buffer.length > maxBytes) throw new Error("Avatar exceeds max size");
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    total += chunk.length;
    if (total > maxBytes) {
      controller.abort();
      throw new Error("Avatar exceeds max size");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

async function fetchAvatarAsDataUri(avatarUrl, deps = {}) {
  if (DISABLE_AVATAR_EMBED) return "";
  if (!avatarUrl || String(avatarUrl).startsWith("data:")) return "";

  let urlObject;
  try {
    urlObject = new URL(String(avatarUrl));
  } catch {
    return "";
  }

  if (!["https:", "http:"].includes(urlObject.protocol)) return "";
  if (urlObject.username || urlObject.password) return "";
  if (!(await isPublicHostname(urlObject.hostname, deps))) return "";

  const cached = getCacheEntry(avatarDataCache, avatarUrl);
  if (cached) return cached;
  if (inFlightFetches.has(avatarUrl)) return inFlightFetches.get(avatarUrl);

  const task = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AVATAR_FETCH_TIMEOUT_MS);
    try {
      const fetchImpl = deps.fetchImpl || fetch;
      const response = await fetchImpl(avatarUrl, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { accept: "image/*" }
      });
      if (!response || !response.ok) return "";

      const mime = pickAvatarMime(response, urlObject);
      if (!mime) return "";

      const data = await readResponseBodyLimited(response, AVATAR_FETCH_MAX_BYTES, controller);
      if (!data.length) return "";

      const dataUri = `data:${mime};base64,${data.toString("base64")}`;
      setCacheEntry(
        avatarDataCache,
        avatarUrl,
        dataUri,
        AVATAR_CACHE_TTL_MS,
        AVATAR_CACHE_MAX_ENTRIES
      );
      return dataUri;
    } catch {
      return "";
    } finally {
      clearTimeout(timer);
    }
  })();

  inFlightFetches.set(avatarUrl, task);
  try {
    return await task;
  } finally {
    inFlightFetches.delete(avatarUrl);
  }
}

async function inlineAvatarInOptions(options, deps = {}) {
  if (!options || !options.avatarUrl || options.avatarEmoji) return options;
  const embedded = await fetchAvatarAsDataUri(options.avatarUrl, deps);
  if (!embedded) return options;
  return { ...options, avatarUrl: embedded };
}

function clearAvatarEmbedCaches() {
  avatarDataCache.clear();
  hostSafetyCache.clear();
  inFlightFetches.clear();
}

module.exports = {
  clearAvatarEmbedCaches,
  fetchAvatarAsDataUri,
  inlineAvatarInOptions
};
