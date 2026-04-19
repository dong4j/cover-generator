"use strict";

let cachedResvgCtor = null;

function normalizePngOutput(output) {
  if (!output) throw new Error("PNG renderer returned empty result");
  if (Buffer.isBuffer(output)) return output;
  if (output instanceof Uint8Array) return Buffer.from(output);
  throw new Error("PNG renderer returned unsupported result type");
}

function loadResvgCtor(deps = {}) {
  if (typeof deps.Resvg === "function") return deps.Resvg;
  if (cachedResvgCtor) return cachedResvgCtor;
  try {
    // Lazy load to keep startup lightweight and avoid hard crash when dependency is missing.
    // eslint-disable-next-line global-require
    const { Resvg } = require("@resvg/resvg-js");
    cachedResvgCtor = Resvg;
    return cachedResvgCtor;
  } catch {
    throw new Error("PNG renderer is unavailable. Please install @resvg/resvg-js.");
  }
}

async function renderSvgToPng(svg, options, deps = {}) {
  if (typeof deps.renderPng === "function") {
    const custom = await deps.renderPng(svg, options);
    return normalizePngOutput(custom);
  }

  const Resvg = loadResvgCtor(deps);
  const resvg = new Resvg(String(svg), {
    fitTo: { mode: "width", value: Math.max(1, Number(options.width) || 1200) }
  });
  const rendered = resvg.render();
  return normalizePngOutput(rendered.asPng());
}

module.exports = {
  renderSvgToPng
};
