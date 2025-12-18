"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { generateCoverSvg } = require("../src/coverGenerator");

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
});
