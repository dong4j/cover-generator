"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { buildRandomCoverOptions, generateCoverSvg } = require("../src/coverGenerator");
const { DEFAULT_AUTHOR, DEFAULT_AVATAR_URLS } = require("../src/config");

test("generateCoverSvg returns svg", () => {
  const svg = generateCoverSvg(
    { title: "Hello", author: "A", seed: "1" },
    {},
    "v1"
  );
  assert.match(svg, /^<\?xml\b/);
  assert.match(svg, /<svg\b/);
});

test("same seed produces deterministic output", () => {
  const a = generateCoverSvg(
    { title: "Deterministic", author: "A", seed: 2025, background: "auto" },
    {},
    "v1"
  );
  const b = generateCoverSvg(
    { title: "Deterministic", author: "A", seed: 2025, background: "auto" },
    {},
    "v1"
  );
  assert.equal(a, b);
});

test("avatarEmoji has priority over avatarUrl", () => {
  const svg = generateCoverSvg(
    {
      title: "Avatar",
      author: "A",
      seed: 2,
      avatarEmoji: "👋",
      avatarUrl: "https://example.com/a.png"
    },
    {},
    "v1"
  );
  assert.match(svg, /👋/);
  assert.doesNotMatch(svg, /<image\b/i);
});

test("accent controls card fill", () => {
  const svg = generateCoverSvg(
    { title: "Accent", author: "A", seed: 3, accent: "#fff7ed" },
    {},
    "v1"
  );
  assert.match(svg, /fill="#fff7ed"/i);
});

test("background=pattern falls back to auto", () => {
  const svg = generateCoverSvg(
    { title: "Bg", author: "A", seed: 4, background: "pattern" },
    {},
    "v1"
  );
  assert.match(svg, /^<\?xml\b/);
});

test("v2 template returns svg", () => {
  const svg = generateCoverSvg(
    { title: "Split", author: "A", seed: 10, color: "#0a8f2a" },
    {},
    "v2"
  );
  assert.match(svg, /^<\?xml\b/);
  assert.match(svg, /cover-v2-/);
});

test("v2 same seed produces deterministic output", () => {
  const a = generateCoverSvg(
    { title: "Split Deterministic", author: "A", seed: 11, background: "auto" },
    {},
    "v2"
  );
  const b = generateCoverSvg(
    { title: "Split Deterministic", author: "A", seed: 11, background: "auto" },
    {},
    "v2"
  );
  assert.equal(a, b);
});

test("v2 without color uses gradient background", () => {
  const svg = generateCoverSvg(
    { title: "Gradient Bg", author: "A", seed: 12 },
    {},
    "v2"
  );
  assert.match(svg, /<linearGradient\b/);
  assert.match(svg, /fill="url\(#cover-v2-[0-9a-f]+-bgGradient\)"/i);
});

test("v3 template returns svg", () => {
  const svg = generateCoverSvg(
    { title: "Big Title", author: "A", seed: 20 },
    {},
    "v3"
  );
  assert.match(svg, /^<\?xml\b/);
  assert.match(svg, /cover-v3-/);
});

test("v3 without color uses gradient background", () => {
  const svg = generateCoverSvg(
    { title: "V3 Gradient", author: "A", seed: 21 },
    {},
    "v3"
  );
  assert.match(svg, /<linearGradient\b/);
  assert.match(svg, /fill="url\(#cover-v3-[0-9a-f]+-bgGradient\)"/i);
});

test("v4 template returns svg", () => {
  const svg = generateCoverSvg(
    { title: "Circuit", author: "A", seed: 40 },
    {},
    "v4"
  );
  assert.match(svg, /^<\?xml\b/);
  assert.match(svg, /cover-v4-/);
});

test("v4 without color uses gradient background", () => {
  const svg = generateCoverSvg(
    { title: "V4 Gradient", author: "A", seed: 41 },
    {},
    "v4"
  );
  assert.match(svg, /<linearGradient\b/);
  assert.match(svg, /fill="url\(#cover-v4-[0-9a-f]+-bgGradient\)"/i);
});

test("v5 template returns svg", () => {
  const svg = generateCoverSvg(
    { title: "Warm Grid", author: "A", seed: 50 },
    {},
    "v5"
  );
  assert.match(svg, /^<\?xml\b/);
  assert.match(svg, /cover-v5-/);
});

test("v5 without color uses gradient background", () => {
  const svg = generateCoverSvg(
    { title: "V5 Gradient", author: "A", seed: 51 },
    {},
    "v5"
  );
  assert.match(svg, /<linearGradient\b/);
  assert.match(svg, /fill="url\(#cover-v5-[0-9a-f]+-bgGradient\)"/i);
});

test("v6 template returns svg", () => {
  const svg = generateCoverSvg(
    { title: "Clean", author: "A", seed: 60 },
    {},
    "v6"
  );
  assert.match(svg, /^<\?xml\b/);
  assert.match(svg, /cover-v6-/);
});

test("v6 supports gradient background", () => {
  const svg = generateCoverSvg(
    { title: "V6 Gradient", author: "A", seed: 61, background: "gradient" },
    {},
    "v6"
  );
  assert.match(svg, /<linearGradient\b/);
  assert.match(svg, /fill="url\(#cover-v6-[0-9a-f]+-bgGradient\)"/i);
});

test("v6 supports texture overlays", () => {
  const svg = generateCoverSvg(
    { title: "V6 Texture", author: "A", seed: 62, texture: "dots" },
    {},
    "v6"
  );
  assert.match(svg, /-texture-dots/);
});

test("v7 template returns svg", () => {
  const svg = generateCoverSvg(
    { title: "Pastel", author: "A", seed: 70 },
    {},
    "v7"
  );
  assert.match(svg, /^<\?xml\b/);
  assert.match(svg, /cover-v7-/);
});

test("v7 supports gradient background", () => {
  const svg = generateCoverSvg(
    { title: "V7 Gradient", author: "A", seed: 71, background: "gradient" },
    {},
    "v7"
  );
  assert.match(svg, /<linearGradient\b/);
  assert.match(svg, /fill="url\(#cover-v7-[0-9a-f]+-bgGradient\)"/i);
});

test("v7 supports texture overlays", () => {
  const svg = generateCoverSvg(
    { title: "V7 Texture", author: "A", seed: 72, texture: "grid" },
    {},
    "v7"
  );
  assert.match(svg, /-texture-grid/);
});

test("random cover uses fixed author and allowed assets", () => {
  const options = buildRandomCoverOptions(
    { seed: 123, template: "v6", title: "Random Title" },
    {}
  );
  assert.equal(options.author, DEFAULT_AUTHOR);
  assert.equal(options.template, "v6");
  if (options.avatarUrl) {
    assert.ok(DEFAULT_AVATAR_URLS.includes(options.avatarUrl));
    assert.equal(options.avatarEmoji, "");
  }
});

test("texture overlay is optional and selectable", () => {
  const svgNone = generateCoverSvg(
    { title: "Texture", author: "A", seed: 30 },
    {},
    "v1"
  );
  assert.doesNotMatch(svgNone, /-texture-(grid|graph|dots)/);

  const svgGrid = generateCoverSvg(
    { title: "Texture", author: "A", seed: 30, texture: "grid" },
    {},
    "v1"
  );
  assert.match(svgGrid, /-texture-grid/);
  assert.match(svgGrid, /fill="url\(#cover-v1-[0-9a-f]+-texture-grid\)"/i);

  const svgDots = generateCoverSvg(
    { title: "Texture", author: "A", seed: 30, texture: "dots" },
    {},
    "v1"
  );
  assert.match(svgDots, /-texture-dots/);

  const svgGraph = generateCoverSvg(
    { title: "Texture", author: "A", seed: 30, texture: "graph" },
    {},
    "v1"
  );
  assert.match(svgGraph, /-texture-graph/);

  const svgCircuit = generateCoverSvg(
    { title: "Texture", author: "A", seed: 30, texture: "circuit" },
    {},
    "v1"
  );
  assert.match(svgCircuit, /-texture-circuit/);
});
