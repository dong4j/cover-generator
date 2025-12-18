"use strict";

// coverGenerator/index.js
// - Normalizes request inputs (query/body) into safe, bounded options
// - Derives a deterministic seed
// - Delegates SVG rendering to exporter.js (template implementation)

const { generateSVG } = require("./exporter");
const { clamp, normalizeSeed } = require("./utils");

const defaultOptions = {
  title: "Untitled Blog Post",
  subtitle: "",
  author: "Anonymous",
  template: "v1",
  seed: undefined,
  width: 1600,
  height: 900,
  background: "auto", // auto | solid | gradient
  color: undefined,
  accent: undefined,
  avatarUrl: "",
  avatarEmoji: ""
};

function parseOptions(query, body) {
  const options = { ...defaultOptions };
  const payload = { ...query, ...(body || {}) };

  // Hard limits keep SVG size and layout stable.
  if (payload.title) options.title = String(payload.title).slice(0, 140);
  if (payload.subtitle) options.subtitle = String(payload.subtitle).slice(0, 200);
  if (payload.author) options.author = String(payload.author).slice(0, 80);
  if (payload.template) options.template = String(payload.template).toLowerCase();
  if (payload.avatarUrl) options.avatarUrl = String(payload.avatarUrl);
  if (payload.avatarEmoji) options.avatarEmoji = String(payload.avatarEmoji).slice(0, 6);
  if (payload.color) options.color = String(payload.color);
  if (payload.accent) options.accent = String(payload.accent);
  if (payload.background) options.background = String(payload.background);
  if (payload.seed !== undefined) options.seed = payload.seed;

  const width = parseInt(payload.width, 10);
  const height = parseInt(payload.height, 10);
  if (!Number.isNaN(width)) options.width = clamp(width, 300, 4000);
  if (!Number.isNaN(height)) options.height = clamp(height, 300, 4000);

  return options;
}

function buildCoverOptions(query, body, templateFromPath) {
  const options = parseOptions(query, body);
  if (templateFromPath) options.template = templateFromPath;

  const allowedTemplates = new Set(["v1", "v2"]);
  if (!allowedTemplates.has(options.template)) options.template = "v1";

  options.seed = normalizeSeed(
    options.seed,
    `${options.title}-${options.author}-${options.template}`
  );
  return options;
}

function generateCoverSvg(query, body, templateFromPath) {
  const options = buildCoverOptions(query, body, templateFromPath);
  return generateSVG(options);
}

module.exports = {
  buildCoverOptions,
  defaultOptions,
  generateCoverSvg,
  parseOptions
};
