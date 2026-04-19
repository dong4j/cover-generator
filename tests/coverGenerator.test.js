"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildRandomCoverOptions,
  generateCoverPngAsync,
  generateCoverSvg,
  generateCoverSvgAsync
} = require("../src/coverGenerator");
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

test("generateCoverSvgAsync supports avatar embedding pipeline", async () => {
  const svg = await generateCoverSvgAsync(
    {
      title: "Async Avatar",
      author: "A",
      seed: "2",
      avatarUrl: "https://cdn.example.com/avatar.webp"
    },
    {},
    "v2",
    {
      dnsLookup: async () => [{ address: "93.184.216.34" }],
      fetchImpl: async () => ({
        ok: true,
        headers: {
          get(name) {
            if (String(name).toLowerCase() === "content-type") return "image/webp";
            return "";
          }
        },
        arrayBuffer: async () => Uint8Array.from([7, 8, 9]).buffer
      })
    }
  );
  assert.match(svg, /data:image\/webp;base64,/);
});

test("generateCoverPngAsync returns PNG bytes with custom renderer", async () => {
  const png = await generateCoverPngAsync(
    {
      title: "PNG Cover",
      author: "A",
      seed: "3",
      avatarUrl: "https://cdn.example.com/avatar.webp",
      width: 800
    },
    {},
    "v2",
    {
      dnsLookup: async () => [{ address: "93.184.216.34" }],
      fetchImpl: async () => ({
        ok: true,
        headers: { get: () => "image/webp" },
        arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer
      }),
      renderPng: async (svg, options) => {
        assert.match(svg, /<svg\b/);
        assert.equal(options.width, 800);
        return Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      }
    }
  );

  assert.ok(Buffer.isBuffer(png));
  assert.equal(png.toString("hex"), "89504e47");
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

test("avatar image has no border stroke", () => {
  const svg = generateCoverSvg(
    {
      title: "Avatar No Border",
      author: "A",
      seed: 200,
      avatarUrl: "https://example.com/a.png"
    },
    {},
    "v2"
  );
  assert.match(svg, /<image\b/i);
  assert.doesNotMatch(svg, /fill="none"\s+stroke="[^"]+"\s+stroke-width="6"/i);
});

test("v1 avatar keeps compact footer size", () => {
  const svg = generateCoverSvg(
    {
      title: "V1 Avatar Size",
      author: "A",
      seed: 201,
      avatarUrl: "https://example.com/a.png",
      width: 1200,
      height: 630
    },
    {},
    "v1"
  );
  const match = svg.match(/<image[^>]*href="https:\/\/example\.com\/a\.png"[^>]*width="(\d+)"/i);
  assert.ok(match, "v1 should render avatar image");
  const avatarSize = Number(match[1]);
  assert.ok(Number.isFinite(avatarSize));
  assert.ok(avatarSize <= 104, `expected compact v1 avatar, got ${avatarSize}`);
});

test("non-v2 templates keep avatar smaller than v2", () => {
  const basePayload = {
    title: "Avatar Scale",
    subtitle: "subtitle",
    author: "A",
    seed: 202,
    avatarUrl: "https://example.com/a.png",
    width: 1200,
    height: 630
  };
  const sizeOf = (template) => {
    const svg = generateCoverSvg(basePayload, {}, template);
    const match = svg.match(/<image[^>]*href="https:\/\/example\.com\/a\.png"[^>]*width="(\d+)"/i);
    assert.ok(match, `${template} should render avatar image`);
    return Number(match[1]);
  };

  const v2Size = sizeOf("v2");
  for (const template of ["v1", "v3", "v4", "v5", "v6", "v7"]) {
    const size = sizeOf(template);
    assert.ok(size < v2Size, `${template} avatar should be smaller than v2 (${size} !< ${v2Size})`);
  }
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

test("v2 renders author below avatar area", () => {
  const svg = generateCoverSvg(
    { title: "V2 Author", author: "@left-author", seed: 13 },
    {},
    "v2"
  );
  assert.match(svg, /text-anchor="middle"\s+dominant-baseline="hanging">/);
  assert.match(svg, /@left-author/);
  assert.doesNotMatch(svg, /dominant-baseline="alphabetic">[^<]*@left-author/);
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

test("v7 renders author near avatar", () => {
  const svg = generateCoverSvg(
    { title: "V7 Author", author: "@dong4j", seed: 73 },
    {},
    "v7"
  );
  assert.match(svg, /@dong4j/);
  assert.match(svg, /text-anchor="middle"/);
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
