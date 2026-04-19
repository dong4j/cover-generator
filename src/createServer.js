"use strict";

// createServer.js
// HTTP server factory. Exported for tests and for the CLI entrypoint (src/server.js).

const http = require("node:http");
const { URL } = require("node:url");

const DEFAULT_MAX_BODY_BYTES = 512 * 1024;

function parseJSONBody(req, maxBodyBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let received = 0;

    req.on("data", chunk => {
      received += chunk.length;
      if (received > maxBodyBytes) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        const json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        resolve(json);
      } catch {
        reject(new Error("Invalid JSON payload"));
      }
    });

    req.on("error", err => reject(err));
  });
}

function sendJson(res, status, data) {
  const payload = Buffer.from(JSON.stringify(data));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": payload.length
  });
  res.end(payload);
}

function sendSvg(res, svg) {
  const payload = Buffer.from(svg, "utf8");
  res.writeHead(200, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "no-store",
    "Content-Length": payload.length
  });
  res.end(payload);
}

function sendPng(res, pngBuffer) {
  const payload = Buffer.isBuffer(pngBuffer) ? pngBuffer : Buffer.from(pngBuffer);
  res.writeHead(200, {
    "Content-Type": "image/png",
    "Cache-Control": "no-store",
    "Content-Length": payload.length
  });
  res.end(payload);
}

function matchCoverTemplatePath(pathname, format) {
  // Keep a strict allowlist to avoid accidental exposure of removed versions.
  const safeFormat = format === "png" ? "png" : "svg";
  const match = pathname.match(new RegExp(`^/cover/${safeFormat}/(v1|v2|v3|v4|v5|v6|v7)$`));
  return match ? match[1] : null;
}

function matchRandomCoverPath(pathname) {
  if (pathname === "/cover/random") return "svg";
  if (pathname === "/cover/random/png") return "png";
  return null;
}

async function handleCoverRequest(req, res, url, templateFromPath, format, deps) {
  try {
    const body =
      req.method === "POST"
        ? await parseJSONBody(req, deps.maxBodyBytes)
        : Object.create(null);
    if (format === "png") {
      if (
        typeof deps.generateCoverPng !== "function" ||
        typeof deps.generateRandomCoverPng !== "function"
      ) {
        throw new Error("PNG endpoint is unavailable");
      }
      const png = templateFromPath === "random"
        ? await deps.generateRandomCoverPng(Object.fromEntries(url.searchParams), body)
        : await deps.generateCoverPng(
            Object.fromEntries(url.searchParams),
            body,
            templateFromPath || undefined
          );
      sendPng(res, png);
      return;
    }

    const svg = templateFromPath === "random"
      ? await deps.generateRandomCoverSvg(Object.fromEntries(url.searchParams), body)
      : await deps.generateCoverSvg(
          Object.fromEntries(url.searchParams),
          body,
          templateFromPath || undefined
        );
    sendSvg(res, svg);
  } catch (err) {
    const status =
      err && err.message === "Payload too large"
        ? 413
        : err && err.message === "PNG endpoint is unavailable"
          ? 501
          : 400;
    sendJson(res, status, { error: err && err.message ? err.message : "Bad request" });
  }
}

function createServer({
  generateCoverSvg,
  generateRandomCoverSvg,
  generateCoverPng,
  generateRandomCoverPng,
  maxBodyBytes
} = {}) {
  if (typeof generateCoverSvg !== "function" || typeof generateRandomCoverSvg !== "function") {
    throw new TypeError("createServer requires generateCoverSvg and generateRandomCoverSvg");
  }

  const deps = {
    generateCoverPng,
    generateCoverSvg,
    generateRandomCoverPng,
    generateRandomCoverSvg,
    maxBodyBytes: Number.isFinite(maxBodyBytes) ? maxBodyBytes : DEFAULT_MAX_BODY_BYTES
  };

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    const templatePath = matchCoverTemplatePath(url.pathname, "svg");
    const pngTemplatePath = matchCoverTemplatePath(url.pathname, "png");
    const randomPathFormat = matchRandomCoverPath(url.pathname);
    const isCoverRoute =
      url.pathname === "/cover" ||
      url.pathname === "/cover/svg" ||
      url.pathname === "/cover/png" ||
      templatePath !== null ||
      pngTemplatePath !== null ||
      randomPathFormat !== null;

    if (isCoverRoute && (req.method === "GET" || req.method === "POST")) {
      const format = randomPathFormat || (pngTemplatePath !== null || url.pathname === "/cover/png" ? "png" : "svg");
      const handlerTemplate =
        randomPathFormat !== null ? "random" : format === "png" ? pngTemplatePath || undefined : templatePath || undefined;
      await handleCoverRequest(req, res, url, handlerTemplate, format, deps);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  });
}

module.exports = {
  DEFAULT_MAX_BODY_BYTES,
  createServer
};
