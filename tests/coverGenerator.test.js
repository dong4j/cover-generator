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

