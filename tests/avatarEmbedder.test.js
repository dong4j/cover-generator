"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  clearAvatarEmbedCaches,
  inlineAvatarInOptions
} = require("../src/coverGenerator/avatarEmbedder");

test("inlineAvatarInOptions embeds remote avatar as data URI", async () => {
  clearAvatarEmbedCaches();
  const options = {
    title: "T",
    author: "A",
    avatarUrl: "https://cdn.example.com/avatar.webp",
    avatarEmoji: ""
  };

  const result = await inlineAvatarInOptions(options, {
    dnsLookup: async () => [{ address: "93.184.216.34" }],
    fetchImpl: async () => ({
      ok: true,
      headers: {
        get(name) {
          if (String(name).toLowerCase() === "content-type") return "image/webp";
          return "";
        }
      },
      arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer
    })
  });

  assert.match(result.avatarUrl, /^data:image\/webp;base64,/);
});

test("inlineAvatarInOptions blocks private target addresses", async () => {
  clearAvatarEmbedCaches();
  let fetchCalls = 0;
  const options = {
    title: "T",
    author: "A",
    avatarUrl: "http://127.0.0.1/avatar.png",
    avatarEmoji: ""
  };

  const result = await inlineAvatarInOptions(options, {
    fallbackAvatarEmojis: ["🧪"],
    fetchImpl: async () => {
      fetchCalls += 1;
      return null;
    }
  });

  assert.equal(result.avatarUrl, "");
  assert.equal(result.avatarEmoji, "🧪");
  assert.equal(fetchCalls, 0);
});

test("inlineAvatarInOptions reuses cached avatar data", async () => {
  clearAvatarEmbedCaches();
  let fetchCalls = 0;
  const options = {
    title: "T",
    author: "A",
    avatarUrl: "https://cdn.example.com/avatar.png",
    avatarEmoji: ""
  };
  const deps = {
    dnsLookup: async () => [{ address: "93.184.216.34" }],
    fetchImpl: async () => {
      fetchCalls += 1;
      return {
        ok: true,
        headers: {
          get(name) {
            if (String(name).toLowerCase() === "content-type") return "image/png";
            return "";
          }
        },
        arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer
      };
    }
  };

  const first = await inlineAvatarInOptions(options, deps);
  const second = await inlineAvatarInOptions(options, deps);

  assert.equal(fetchCalls, 1);
  assert.equal(first.avatarUrl, second.avatarUrl);
  assert.match(first.avatarUrl, /^data:image\/png;base64,/);
});

test("inlineAvatarInOptions prefers non-webp for png target", async () => {
  clearAvatarEmbedCaches();
  const options = {
    title: "T",
    author: "A",
    avatarUrl: "https://cdn.example.com/avatar.webp",
    avatarEmoji: ""
  };

  const requests = [];
  const result = await inlineAvatarInOptions(options, {
    targetFormat: "png",
    dnsLookup: async () => [{ address: "93.184.216.34" }],
    fetchImpl: async (url) => {
      requests.push(String(url));
      if (String(url).includes("imageMogr2/format/png")) {
        return {
          ok: true,
          headers: {
            get(name) {
              if (String(name).toLowerCase() === "content-type") return "image/png";
              return "";
            }
          },
          arrayBuffer: async () => Uint8Array.from([4, 5, 6]).buffer
        };
      }
      return {
        ok: true,
        headers: {
          get(name) {
            if (String(name).toLowerCase() === "content-type") return "image/webp";
            return "";
          }
        },
        arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer
      };
    }
  });

  assert.ok(requests.length >= 2);
  assert.match(result.avatarUrl, /^data:image\/png;base64,/);
});

test("avatar cache key is isolated by target format", async () => {
  clearAvatarEmbedCaches();
  let calls = 0;
  const options = {
    title: "T",
    author: "A",
    avatarUrl: "https://cdn.example.com/avatar.webp",
    avatarEmoji: ""
  };
  const fetchImpl = async (url) => {
    calls += 1;
    if (String(url).includes("imageMogr2/format/png")) {
      return {
        ok: true,
        headers: { get: () => "image/png" },
        arrayBuffer: async () => Uint8Array.from([9, 9, 9]).buffer
      };
    }
    return {
      ok: true,
      headers: { get: () => "image/webp" },
      arrayBuffer: async () => Uint8Array.from([8, 8, 8]).buffer
    };
  };

  const svgOut = await inlineAvatarInOptions(options, {
    targetFormat: "svg",
    dnsLookup: async () => [{ address: "93.184.216.34" }],
    fetchImpl
  });
  const pngOut = await inlineAvatarInOptions(options, {
    targetFormat: "png",
    dnsLookup: async () => [{ address: "93.184.216.34" }],
    fetchImpl
  });

  assert.match(svgOut.avatarUrl, /^data:image\/webp;base64,/);
  assert.match(pngOut.avatarUrl, /^data:image\/png;base64,/);
  assert.ok(calls >= 2);
});

test("inlineAvatarInOptions infers png mime from bytes for png target", async () => {
  clearAvatarEmbedCaches();
  const options = {
    title: "T",
    author: "A",
    avatarUrl: "https://cdn.example.com/avatar.webp",
    avatarEmoji: ""
  };

  const result = await inlineAvatarInOptions(options, {
    targetFormat: "png",
    dnsLookup: async () => [{ address: "93.184.216.34" }],
    fetchImpl: async () => ({
      ok: true,
      headers: { get: () => "application/octet-stream" },
      arrayBuffer: async () => Uint8Array.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4
      ]).buffer
    })
  });

  assert.match(result.avatarUrl, /^data:image\/png;base64,/);
});

test("inlineAvatarInOptions falls back to emoji when png target only gets unsupported mime", async () => {
  clearAvatarEmbedCaches();
  const options = {
    title: "T",
    author: "A",
    avatarUrl: "https://cdn.example.com/avatar.webp",
    avatarEmoji: ""
  };

  const result = await inlineAvatarInOptions(options, {
    targetFormat: "png",
    fallbackAvatarEmojis: ["🧯"],
    dnsLookup: async () => [{ address: "93.184.216.34" }],
    fetchImpl: async () => ({
      ok: true,
      headers: { get: () => "image/webp" },
      arrayBuffer: async () => Uint8Array.from([
        0x52, 0x49, 0x46, 0x46, 0x2a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50
      ]).buffer
    })
  });

  assert.equal(result.avatarUrl, "");
  assert.equal(result.avatarEmoji, "🧯");
});

test("inlineAvatarInOptions fallback emoji is deterministic for same seed", async () => {
  clearAvatarEmbedCaches();
  const options = {
    title: "T",
    author: "A",
    seed: 2026,
    avatarUrl: "https://cdn.example.com/avatar.webp",
    avatarEmoji: ""
  };

  const deps = {
    fallbackAvatarEmojis: ["😀", "😎", "🚀"],
    dnsLookup: async () => [{ address: "93.184.216.34" }],
    fetchImpl: async () => ({
      ok: false,
      headers: { get: () => "" },
      arrayBuffer: async () => new Uint8Array().buffer
    })
  };

  const first = await inlineAvatarInOptions(options, deps);
  const second = await inlineAvatarInOptions(options, deps);
  assert.equal(first.avatarUrl, "");
  assert.equal(second.avatarUrl, "");
  assert.equal(first.avatarEmoji, second.avatarEmoji);
});

test("inlineAvatarInOptions keeps existing data-uri avatar", async () => {
  clearAvatarEmbedCaches();
  const options = {
    title: "T",
    author: "A",
    avatarUrl: "data:image/png;base64,AAEC",
    avatarEmoji: ""
  };

  const result = await inlineAvatarInOptions(options, {
    fallbackAvatarEmojis: ["🧪"]
  });

  assert.equal(result.avatarUrl, options.avatarUrl);
  assert.equal(result.avatarEmoji, "");
});
