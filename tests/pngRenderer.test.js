"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { emboldenSvgTextForPng, renderSvgToPng } = require("../src/coverGenerator/pngRenderer");

test("emboldenSvgTextForPng bumps numeric font weights", () => {
  const svg = '<text font-weight="600">A</text><text font-weight="800">B</text>';
  assert.equal(
    emboldenSvgTextForPng(svg),
    '<text font-weight="700">A</text><text font-weight="900">B</text>'
  );
  assert.equal(emboldenSvgTextForPng(svg, { pngFontWeightBump: 0 }), svg);
});

test("renderSvgToPng supports custom renderer injection", async () => {
  const output = await renderSvgToPng(
    "<svg width='10' height='10'></svg>",
    { width: 10, height: 10 },
    {
      renderPng: async () => Uint8Array.from([0x89, 0x50, 0x4e, 0x47])
    }
  );
  assert.ok(Buffer.isBuffer(output));
  assert.equal(output.toString("hex"), "89504e47");
});

test("renderSvgToPng supports Resvg constructor injection", async () => {
  class FakeResvg {
    constructor(svg, options) {
      this.svg = svg;
      this.options = options;
    }

    render() {
      return {
        asPng() {
          return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x00]);
        }
      };
    }
  }

  const output = await renderSvgToPng("<svg width='10' height='10'></svg>", { width: 10 }, {
    Resvg: FakeResvg
  });
  assert.equal(output.toString("hex"), "89504e4700");
});
