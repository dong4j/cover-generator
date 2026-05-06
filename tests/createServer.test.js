"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const { createServer, assertRandomizeRequiresVersion } = require("../src/createServer");

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, res => {
        const chunks = [];
        res.on("data", c => chunks.push(c));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body: Buffer.concat(chunks).toString("utf8")
          });
        });
      })
      .on("error", reject);
  });
}

test("assertRandomizeRequiresVersion allows versioned paths", () => {
  assertRandomizeRequiresVersion("/cover/png/v1", { randomize: "1" }, {});
  assertRandomizeRequiresVersion("/cover/svg/v2", {}, { randomize: true });
});

test("assertRandomizeRequiresVersion rejects unversioned cover paths", () => {
  assert.throws(
    () => assertRandomizeRequiresVersion("/cover/png", { title: "x", randomize: "1" }, {}),
    /randomize requires an explicit template version/
  );
});

test("assertRandomizeRequiresVersion ignores random endpoint", () => {
  assertRandomizeRequiresVersion("/cover/random/png", { randomize: "1" }, {});
});

test("HTTP: randomize without path version returns 400", async () => {
  const server = createServer({
    generateCoverSvg: async () => "<?xml version=\"1.0\"?><svg xmlns=\"http://www.w3.org/2000/svg\"/>",
    generateRandomCoverSvg: async () => "<?xml version=\"1.0\"?><svg xmlns=\"http://www.w3.org/2000/svg\"/>",
    generateCoverPng: async () => Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    generateRandomCoverPng: async () => Buffer.from([0x89, 0x50, 0x4e, 0x47])
  });
  await new Promise(resolve => server.listen(0, resolve));
  const { port } = server.address();
  try {
    const res = await httpGet(`http://127.0.0.1:${port}/cover/png?title=a&randomize=1`);
    assert.equal(res.statusCode, 400);
    assert.match(res.body, /randomize requires an explicit template version/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
