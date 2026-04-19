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
    fetchImpl: async () => {
      fetchCalls += 1;
      return null;
    }
  });

  assert.equal(result.avatarUrl, options.avatarUrl);
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
