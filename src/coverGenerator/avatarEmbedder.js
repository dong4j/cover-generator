"use strict";

const dns = require("node:dns/promises");
const net = require("node:net");
const { createRng, normalizeSeed } = require("./utils");

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
const PNG_RENDERABLE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif"
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
const FALLBACK_AVATAR_EMOJIS = ["😎", "🚀", "✨", "🔥", "🧠", "🎯", "🌟", "💡", "🧩", "😄"];

const avatarDataCache = new Map();
const hostSafetyCache = new Map();
const inFlightFetches = new Map();

function normalizeTargetFormat(deps = {}) {
  return deps.targetFormat === "png" ? "png" : "svg";
}

function buildAvatarCacheKey(avatarUrl, deps = {}) {
  return `${normalizeTargetFormat(deps)}::${String(avatarUrl)}`;
}

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

function parseResponseContentType(response) {
  return String(response.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

function inferMimeFromSearch(search) {
  const lowerSearch = String(search || "").toLowerCase();
  if (!lowerSearch) return "";
  if (/(?:^|[?&\/,=])format(?:=|\/|,)?png(?:[&/]|$)/.test(lowerSearch)) return "image/png";
  if (/(?:^|[?&\/,=])format(?:=|\/|,)?jpe?g(?:[&/]|$)/.test(lowerSearch)) return "image/jpeg";
  if (/(?:^|[?&\/,=])format(?:=|\/|,)?webp(?:[&/]|$)/.test(lowerSearch)) return "image/webp";
  if (/(?:^|[?&\/,=])format(?:=|\/|,)?gif(?:[&/]|$)/.test(lowerSearch)) return "image/gif";
  if (/(?:^|[?&\/,=])format(?:=|\/|,)?avif(?:[&/]|$)/.test(lowerSearch)) return "image/avif";
  if (/(?:^|[?&\/,=])format(?:=|\/|,)?bmp(?:[&/]|$)/.test(lowerSearch)) return "image/bmp";
  return "";
}

function detectMimeFromBuffer(buffer) {
  if (!buffer || buffer.length < 12) return "";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer.length >= 6 &&
    Buffer.from(buffer.slice(0, 6)).toString("ascii").startsWith("GIF8")
  ) {
    return "image/gif";
  }
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return "image/bmp";
  if (
    buffer.length >= 12 &&
    Buffer.from(buffer.slice(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(buffer.slice(8, 12)).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  if (
    buffer.length >= 12 &&
    Buffer.from(buffer.slice(4, 8)).toString("ascii") === "ftyp" &&
    ["avif", "avis"].includes(Buffer.from(buffer.slice(8, 12)).toString("ascii"))
  ) {
    return "image/avif";
  }
  return "";
}

function resolveAvatarMime(response, urlObject, bodyBuffer) {
  const fromBytes = detectMimeFromBuffer(bodyBuffer);
  if (ALLOWED_MIME_TYPES.has(fromBytes)) return fromBytes;

  const contentType = parseResponseContentType(response);
  if (ALLOWED_MIME_TYPES.has(contentType)) return contentType;

  const inferredFromQuery = inferMimeFromSearch(urlObject.search);
  if (ALLOWED_MIME_TYPES.has(inferredFromQuery)) return inferredFromQuery;

  const inferredFromPath = inferMimeFromPathname(urlObject.pathname);
  if (ALLOWED_MIME_TYPES.has(inferredFromPath)) return inferredFromPath;
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

function buildAvatarCandidates(avatarUrl, deps = {}) {
  const origin = String(avatarUrl);
  const alternatives = [];
  try {
    const urlObject = new URL(origin);
    const lowerPath = urlObject.pathname.toLowerCase();

    if (lowerPath.endsWith(".webp")) {
      const pngPathUrl = new URL(urlObject.href);
      pngPathUrl.pathname = pngPathUrl.pathname.replace(/\.webp$/i, ".png");
      alternatives.push(pngPathUrl.href);
    }

    const imageMogrUrl = `${urlObject.href}${urlObject.search ? "&" : "?"}imageMogr2/format/png`;
    alternatives.push(imageMogrUrl);

    const ossUrl = new URL(urlObject.href);
    ossUrl.searchParams.set("x-oss-process", "image/format,png");
    alternatives.push(ossUrl.href);
  } catch {
    return [origin];
  }

  const preferredFirst = normalizeTargetFormat(deps) === "png";
  const ordered = preferredFirst ? [...alternatives, origin] : [origin, ...alternatives];
  return [...new Set(ordered)];
}

async function fetchAvatarAsDataUri(avatarUrl, deps = {}) {
  if (DISABLE_AVATAR_EMBED) return "";
  if (!avatarUrl || String(avatarUrl).startsWith("data:")) return "";

  const cacheKey = buildAvatarCacheKey(avatarUrl, deps);
  const cached = getCacheEntry(avatarDataCache, cacheKey);
  if (cached) return cached;
  if (inFlightFetches.has(cacheKey)) return inFlightFetches.get(cacheKey);

  const task = (async () => {
    const candidates = buildAvatarCandidates(avatarUrl, deps);
    const fetchImpl = deps.fetchImpl || fetch;
    const preferRaster = normalizeTargetFormat(deps) === "png";

    for (const candidateUrl of candidates) {
      let urlObject;
      try {
        urlObject = new URL(String(candidateUrl));
      } catch {
        continue;
      }

      if (!["https:", "http:"].includes(urlObject.protocol)) continue;
      if (urlObject.username || urlObject.password) continue;
      if (!(await isPublicHostname(urlObject.hostname, deps))) continue;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AVATAR_FETCH_TIMEOUT_MS);
      try {
        const response = await fetchImpl(urlObject.href, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: {
            accept: preferRaster ? "image/png,image/jpeg,image/gif,*/*;q=0.1" : "image/*"
          }
        });
        if (!response || !response.ok) continue;

        const data = await readResponseBodyLimited(response, AVATAR_FETCH_MAX_BYTES, controller);
        if (!data.length) continue;

        const mime = resolveAvatarMime(response, urlObject, data);
        if (!mime) continue;
        if (preferRaster && !PNG_RENDERABLE_MIME_TYPES.has(mime)) continue;

        const dataUri = `data:${mime};base64,${data.toString("base64")}`;
        setCacheEntry(
          avatarDataCache,
          cacheKey,
          dataUri,
          AVATAR_CACHE_TTL_MS,
          AVATAR_CACHE_MAX_ENTRIES
        );
        return dataUri;
      } catch {
        // Ignore and try next candidate.
      } finally {
        clearTimeout(timer);
      }
    }

    return "";
  })();

  inFlightFetches.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inFlightFetches.delete(cacheKey);
  }
}

async function inlineAvatarInOptions(options, deps = {}) {
  if (!options || !options.avatarUrl || options.avatarEmoji) return options;
  if (String(options.avatarUrl).startsWith("data:")) return options;
  const embedded = await fetchAvatarAsDataUri(options.avatarUrl, deps);
  if (!embedded) {
    const fallbackEmoji = pickFallbackAvatarEmoji(options, deps);
    return { ...options, avatarUrl: "", avatarEmoji: fallbackEmoji };
  }
  return { ...options, avatarUrl: embedded };
}

function pickFallbackAvatarEmoji(options, deps = {}) {
  const customList = Array.isArray(deps.fallbackAvatarEmojis) ? deps.fallbackAvatarEmojis : null;
  const candidates = customList && customList.length ? customList : FALLBACK_AVATAR_EMOJIS;
  const fallbackKey = `${options.title || ""}-${options.author || ""}-${options.avatarUrl || ""}`;
  const seed = normalizeSeed(options.seed, fallbackKey);
  const rng = createRng(seed);
  const index = Math.floor(rng() * candidates.length);
  return String(candidates[index] || "😄").slice(0, 6);
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
