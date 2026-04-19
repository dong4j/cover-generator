"use strict";

// coverGenerator/index.js
// - Normalizes request inputs (query/body) into safe, bounded options
// - Derives a deterministic seed
// - Delegates SVG rendering to exporter.js (template implementation)

const { generateSVG } = require("./exporter");
const { inlineAvatarInOptions } = require("./avatarEmbedder");
const { renderSvgToPng } = require("./pngRenderer");
const { DEFAULT_AUTHOR, DEFAULT_AVATAR_URLS } = require("../config");
const { clamp, createRng, normalizeSeed, randomChoice } = require("./utils");

const defaultOptions = {
  title: "Untitled Blog Post",
  subtitle: "",
  author: "Anonymous",
  template: "v1",
  seed: undefined,
  width: 1200,
  height: 630,
  background: "auto", // auto | solid | gradient
  texture: "", // empty | grid | graph | dots | circuit
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
  if (payload.texture) options.texture = String(payload.texture);
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

  const allowedTemplates = new Set(["v1", "v2", "v3", "v4", "v5", "v6", "v7"]);
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

async function generateCoverSvgAsync(query, body, templateFromPath, deps = {}) {
  const options = buildCoverOptions(query, body, templateFromPath);
  const resolvedOptions = await inlineAvatarInOptions(options, { ...deps, targetFormat: "svg" });
  return generateSVG(resolvedOptions);
}

async function generateCoverPngAsync(query, body, templateFromPath, deps = {}) {
  const options = buildCoverOptions(query, body, templateFromPath);
  const resolvedOptions = await inlineAvatarInOptions(options, { ...deps, targetFormat: "png" });
  const svg = generateSVG(resolvedOptions);
  return renderSvgToPng(svg, resolvedOptions, deps);
}

function buildRandomCoverOptions(query, body) {
  const payload = { ...query, ...(body || {}) };
  if (!payload.title) {
    throw new Error("title is required");
  }
  const width = parseInt(payload.width, 10);
  const height = parseInt(payload.height, 10);

  const options = { ...defaultOptions };
  if (!Number.isNaN(width)) options.width = clamp(width, 300, 4000);
  if (!Number.isNaN(height)) options.height = clamp(height, 300, 4000);

  const seedInput = payload.seed !== undefined ? payload.seed : `${Date.now()}-${Math.random()}`;
  options.seed = normalizeSeed(seedInput, `random-${Date.now()}`);
  const rng = createRng(options.seed);

  const templates = ["v1", "v2", "v3", "v4", "v5", "v6", "v7"];
  const templateParam = payload.template ? String(payload.template).toLowerCase() : "";
  options.template = templates.includes(templateParam)
    ? templateParam
    : randomChoice(templates, rng);

  options.author = DEFAULT_AUTHOR;

  const subtitles = [
    "The best directory for indie makers",
    "A practical guide to shipping better software",
    "Patterns for scalable product teams",
    "Stories, lessons, and experiments",
    "From idea to execution",
    "Crafting delightful developer tools"
  ];
  const emojis = ["🚀", "✨", "🔥", "🧠", "⚡", "🎯", "🧩", "💡"];
  const textures = ["", "grid", "graph", "dots", "circuit"];
  const backgrounds = ["auto", "gradient", "solid"];
  const colors = ["#111827", "#0f172a", "#1f2937", "#334155", "#0f766e", "#be123c"];
  const accents = ["#fff7ed", "#fef2f2", "#fdf2f8", "#f5f3ff", "#f0fdf4", "#ecfeff"];

  options.title = String(payload.title).slice(0, 140);
  options.subtitle = rng() < 0.7 ? randomChoice(subtitles, rng) : "";
  options.background = randomChoice(backgrounds, rng);
  options.texture = randomChoice(textures, rng);

  if (rng() < 0.25) options.color = randomChoice(colors, rng);
  if (rng() < 0.25) options.accent = randomChoice(accents, rng);

  if (rng() < 0.5) {
    options.avatarEmoji = randomChoice(emojis, rng);
    options.avatarUrl = "";
  } else {
    options.avatarUrl = randomChoice(DEFAULT_AVATAR_URLS, rng);
    options.avatarEmoji = "";
  }

  return options;
}

function generateRandomCoverSvg(query, body) {
  const options = buildRandomCoverOptions(query, body);
  return generateSVG(options);
}

async function generateRandomCoverSvgAsync(query, body, deps = {}) {
  const options = buildRandomCoverOptions(query, body);
  const resolvedOptions = await inlineAvatarInOptions(options, { ...deps, targetFormat: "svg" });
  return generateSVG(resolvedOptions);
}

async function generateRandomCoverPngAsync(query, body, deps = {}) {
  const options = buildRandomCoverOptions(query, body);
  const resolvedOptions = await inlineAvatarInOptions(options, { ...deps, targetFormat: "png" });
  const svg = generateSVG(resolvedOptions);
  return renderSvgToPng(svg, resolvedOptions, deps);
}

module.exports = {
  buildCoverOptions,
  buildRandomCoverOptions,
  defaultOptions,
  generateCoverPngAsync,
  generateCoverSvg,
  generateCoverSvgAsync,
  generateRandomCoverPngAsync,
  generateRandomCoverSvg,
  generateRandomCoverSvgAsync,
  parseOptions
};
