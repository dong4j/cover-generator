"use strict";

// coverGenerator/overlayEngine.js
// Optional background overlays (grid/graph/dots). Disabled by default.

function normalizeTexture(value) {
  const v = String(value || "").toLowerCase().trim();
  if (v === "grid" || v === "graph" || v === "dots" || v === "circuit") return v;
  return "";
}

function buildTextureOverlay(options, idBase) {
  const texture = normalizeTexture(options.texture);
  if (!texture) return { defs: "", layer: "" };

  const patternId = `${idBase}-texture-${texture}`;
  // Slightly darker than before so it's visible on both light/dark backgrounds.
  const stroke = "rgba(17,24,39,0.20)";
  const strokeLight = "rgba(17,24,39,0.10)";
  const dotFill = "rgba(17,24,39,0.24)";

  // Center-focused clarity: sharp in the middle, softer towards edges.
  // We approximate "blur on edges" by combining:
  // - A crisp overlay masked to center
  // - A slightly blurred overlay masked to edges
  const centerGradId = `${patternId}-g-center`;
  const edgeGradId = `${patternId}-g-edge`;
  const centerMaskId = `${patternId}-mask-center`;
  const edgeMaskId = `${patternId}-mask-edge`;
  const blurId = `${patternId}-blur`;

  const commonDefs = `<radialGradient id="${centerGradId}" cx="50%" cy="50%" r="72%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="48%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="76%" stop-color="#ffffff" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.06"/>
    </radialGradient>
    <radialGradient id="${edgeGradId}" cx="50%" cy="50%" r="72%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="58%" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="1"/>
    </radialGradient>
    <mask id="${centerMaskId}"><rect width="100%" height="100%" fill="url(#${centerGradId})"/></mask>
    <mask id="${edgeMaskId}"><rect width="100%" height="100%" fill="url(#${edgeGradId})"/></mask>
    <filter id="${blurId}" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="2.4"/>
    </filter>`;

  if (texture === "dots") {
    return {
      defs: `<pattern id="${patternId}" x="0" y="0" width="26" height="26" patternUnits="userSpaceOnUse">
        <circle cx="2.8" cy="2.8" r="1.6" fill="${dotFill}"/>
        <circle cx="15.8" cy="15.8" r="1.6" fill="${dotFill}" opacity="0.75"/>
      </pattern>
      ${commonDefs}`,
      layer: `<g opacity="1">
        <rect width="100%" height="100%" fill="url(#${patternId})" mask="url(#${centerMaskId})"/>
        <rect width="100%" height="100%" fill="url(#${patternId})" mask="url(#${edgeMaskId})" filter="url(#${blurId})" opacity="0.95"/>
      </g>`
    };
  }

  if (texture === "circuit") {
    const circuitStroke = "rgba(255,255,255,0.18)";
    const circuitStrokeLight = "rgba(255,255,255,0.10)";
    const circuitNode = "rgba(255,255,255,0.22)";
    return {
      defs: `<pattern id="${patternId}" x="0" y="0" width="160" height="160" patternUnits="userSpaceOnUse">
        <path d="M 16 24 H 72 V 56 H 144" fill="none" stroke="${circuitStroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 16 96 H 56 V 80 H 104 V 120 H 144" fill="none" stroke="${circuitStroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 40 8 V 40 H 96 V 16 H 144" fill="none" stroke="${circuitStrokeLight}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 24 144 V 120 H 64 V 144" fill="none" stroke="${circuitStrokeLight}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 112 144 V 104 H 88 V 72 H 120 V 40 H 144" fill="none" stroke="${circuitStrokeLight}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="16" cy="24" r="3" fill="${circuitNode}"/>
        <circle cx="72" cy="56" r="3" fill="${circuitNode}"/>
        <circle cx="144" cy="56" r="3" fill="${circuitNode}"/>
        <circle cx="16" cy="96" r="3" fill="${circuitNode}"/>
        <circle cx="104" cy="120" r="3" fill="${circuitNode}"/>
        <circle cx="144" cy="120" r="3" fill="${circuitNode}"/>
        <circle cx="40" cy="8" r="2.6" fill="${circuitNode}" opacity="0.8"/>
        <circle cx="144" cy="16" r="2.6" fill="${circuitNode}" opacity="0.8"/>
        <circle cx="24" cy="144" r="2.6" fill="${circuitNode}" opacity="0.8"/>
        <circle cx="112" cy="144" r="2.6" fill="${circuitNode}" opacity="0.8"/>
      </pattern>
      ${commonDefs}`,
      layer: `<g opacity="1">
        <rect width="100%" height="100%" fill="url(#${patternId})" mask="url(#${centerMaskId})"/>
        <rect width="100%" height="100%" fill="url(#${patternId})" mask="url(#${edgeMaskId})" filter="url(#${blurId})" opacity="0.9"/>
      </g>`
    };
  }

  if (texture === "grid") {
    return {
      defs: `<pattern id="${patternId}" x="0" y="0" width="64" height="64" patternUnits="userSpaceOnUse">
        <path d="M 64 0 L 0 0 0 64" fill="none" stroke="${stroke}" stroke-width="1.6"/>
      </pattern>
      ${commonDefs}`,
      layer: `<g opacity="1">
        <rect width="100%" height="100%" fill="url(#${patternId})" mask="url(#${centerMaskId})"/>
        <rect width="100%" height="100%" fill="url(#${patternId})" mask="url(#${edgeMaskId})" filter="url(#${blurId})" opacity="0.92"/>
      </g>`
    };
  }

  // graph: minor + major grid lines (graph paper)
  return {
    defs: `<pattern id="${patternId}" x="0" y="0" width="160" height="160" patternUnits="userSpaceOnUse">
      <path d="M 160 0 L 0 0 0 160" fill="none" stroke="${stroke}" stroke-width="2"/>
      <path d="M 32 0 V 160 M 64 0 V 160 M 96 0 V 160 M 128 0 V 160 M 0 32 H 160 M 0 64 H 160 M 0 96 H 160 M 0 128 H 160" fill="none" stroke="${strokeLight}" stroke-width="1"/>
    </pattern>
    ${commonDefs}`,
    layer: `<g opacity="1">
      <rect width="100%" height="100%" fill="url(#${patternId})" mask="url(#${centerMaskId})"/>
      <rect width="100%" height="100%" fill="url(#${patternId})" mask="url(#${edgeMaskId})" filter="url(#${blurId})" opacity="0.92"/>
    </g>`
  };
}

module.exports = {
  buildTextureOverlay,
  normalizeTexture
};
