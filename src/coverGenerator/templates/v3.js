"use strict";

// coverGenerator/templates/v3.js
// Template v3 implementation: solid/gradient background + top-left avatar + big title + bottom-left author.

const { renderAvatar } = require("../shapeEngine");
const { escapeXml, wrapLines } = require("../typographyEngine");
const { createRng, normalizeSeed, randomChoice } = require("../utils");

const FONT_STACK =
  "Inter, 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

const WARM_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#ec4899",
  "#f43f5e",
  "#fb7185",
  "#fda4af"
];

function normalizeBackgroundMode(options) {
  const mode = String(options.background || "auto").toLowerCase();
  if (mode === "solid" || mode === "gradient" || mode === "auto") return mode;
  return "auto";
}

function isWideChar(char) {
  const code = char.codePointAt(0) || 0;
  if (code >= 0x1100 && code <= 0x11ff) return true; // Hangul Jamo
  if (code >= 0x2e80 && code <= 0xa4cf) return true; // CJK, Yi, radicals
  if (code >= 0xac00 && code <= 0xd7af) return true; // Hangul syllables
  if (code >= 0xf900 && code <= 0xfaff) return true; // CJK compatibility ideographs
  if (code >= 0x20000 && code <= 0x3ffff) return true; // CJK extensions
  if (code >= 0x1f300 && code <= 0x1fbff) return true; // emoji & pictographs
  return false;
}

function tokenizeForWrap(text) {
  const str = String(text);
  const tokens = [];
  let buffer = "";

  function flush() {
    if (!buffer) return;
    tokens.push(buffer);
    buffer = "";
  }

  for (const char of str) {
    if (/\s/.test(char)) {
      flush();
      tokens.push(" ");
      continue;
    }

    if (/[\u0000-\u007f]/.test(char) && /[A-Za-z0-9_./@#:+-]/.test(char)) {
      buffer += char;
      continue;
    }

    flush();
    tokens.push(char);
  }
  flush();
  return tokens;
}

function estimateTokenUnits(token) {
  if (token === " ") return 0.35;
  if (/^[\u0000-\u007f]+$/.test(token)) return token.length * 0.58;
  let units = 0;
  for (const char of token) units += isWideChar(char) ? 1.05 : 0.65;
  return units;
}

function wrapLinesV3(text, maxWidth, fontSize) {
  const maxUnits = (maxWidth / Math.max(1, fontSize)) * 0.92;
  const tokens = tokenizeForWrap(text);
  const lines = [];
  let current = "";
  let currentUnits = 0;

  function pushLine() {
    const line = current.trim();
    if (line) lines.push(line);
    current = "";
    currentUnits = 0;
  }

  for (const token of tokens) {
    if (token === " " && !current) continue;
    const tokenUnits = estimateTokenUnits(token);

    if (currentUnits + tokenUnits <= maxUnits) {
      current += token;
      currentUnits += tokenUnits;
      continue;
    }

    if (!current) {
      let chunk = "";
      let chunkUnits = 0;
      for (const char of token) {
        const charUnits = estimateTokenUnits(char);
        if (chunk && chunkUnits + charUnits > maxUnits) {
          lines.push(chunk);
          chunk = "";
          chunkUnits = 0;
        }
        chunk += char;
        chunkUnits += charUnits;
      }
      if (chunk) lines.push(chunk);
      current = "";
      currentUnits = 0;
      continue;
    }

    pushLine();
    if (token !== " ") {
      current = token;
      currentUnits = tokenUnits;
    }
  }

  pushLine();
  return lines.length ? lines : [String(text)];
}

function wrapAndFitText({ text, maxWidth, maxHeight, fontSize, lineHeight, minFontSize, wrap }) {
  let currentFontSize = fontSize;
  let currentLineHeight = lineHeight;
  const wrapFn = wrap || wrapLines;
  let lines = wrapFn(text, maxWidth, currentFontSize);

  while (currentFontSize > minFontSize) {
    const blockHeight = lines.length * currentLineHeight;
    if (blockHeight <= maxHeight) break;
    currentFontSize = Math.max(minFontSize, Math.round(currentFontSize * 0.92));
    currentLineHeight = Math.max(
      Math.round(minFontSize * 1.05),
      Math.round(currentLineHeight * 0.92)
    );
    lines = wrapFn(text, maxWidth, currentFontSize);
  }

  return { fontSize: currentFontSize, lineHeight: currentLineHeight, lines };
}

function renderTopAvatar({ options, x, y, size, idBase }) {
  const r = size / 2;
  const cx = Math.round(x + r);
  const cy = Math.round(y + r);
  const stroke = "rgba(255,255,255,0.22)";

  if (!options.avatarUrl && !options.avatarEmoji) {
    const headR = Math.round(r * 0.18);
    const headCy = Math.round(cy - r * 0.14);
    const shoulderY = Math.round(cy + r * 0.34);
    const leftX = Math.round(cx - r * 0.40);
    const rightX = Math.round(cx + r * 0.40);
    const c1x = Math.round(cx - r * 0.14);
    const c2x = Math.round(cx + r * 0.14);
    const cY = Math.round(cy + r * 0.10);
    const strokeWidth = Math.max(2, Math.round(size * 0.05));
    return `<g>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="${stroke}" stroke-width="2"/>
      <circle cx="${cx}" cy="${headCy}" r="${headR}" fill="rgba(0,0,0,0.14)"/>
      <path d="M ${leftX} ${shoulderY} C ${c1x} ${cY} ${c2x} ${cY} ${rightX} ${shoulderY}" fill="none" stroke="rgba(0,0,0,0.14)" stroke-width="${strokeWidth}" stroke-linecap="round"/>
    </g>`;
  }

  if (options.avatarEmoji) {
    const emojiFontSize = Math.round(size * 0.46);
    return `<g>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="${stroke}" stroke-width="2"/>
      <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_STACK}" font-size="${emojiFontSize}">${escapeXml(
      options.avatarEmoji
    )}</text>
    </g>`;
  }

  const clipId = `${idBase}-avatarClip`;
  return `<g transform="translate(${x}, ${y})">
    ${renderAvatar({
      avatarUrl: options.avatarUrl,
      avatarEmoji: options.avatarEmoji,
      size,
      bgColor: "#ffffff",
      textColor: "#111827",
      clipId
    })}
  </g>`;
}

function renderTemplateV3(options) {
  const seed = normalizeSeed(options.seed, `${options.title}-${options.author}-${options.template}`);
  const rng = createRng(seed);
  const idBase = `cover-v3-${seed.toString(16)}`;

  const scale = Math.min(options.width / 1600, options.height / 900);

  // Color logic aligned with v2:
  // - If `color` is provided: lock to solid background.
  // - If no `color`: default to a deterministic warm gradient (unless background=solid).
  const bgMode = normalizeBackgroundMode(options);
  const resolvedMode =
    options.color || bgMode === "solid" ? "solid" : bgMode === "gradient" ? "gradient" : "gradient";

  const bgSolid = options.color || randomChoice(WARM_COLORS, rng);
  const bgA = randomChoice(WARM_COLORS, rng);
  const bgB = randomChoice(WARM_COLORS, rng);
  const bgAngle = Math.round(rng() * 360);
  const bgGradientId = `${idBase}-bgGradient`;
  const backgroundFill = resolvedMode === "gradient" ? `url(#${bgGradientId})` : bgSolid;
  const defs =
    resolvedMode === "gradient"
      ? `<linearGradient id="${bgGradientId}" gradientTransform="rotate(${bgAngle})">
    <stop offset="0%" stop-color="${bgA}"/>
    <stop offset="100%" stop-color="${bgB}"/>
  </linearGradient>`
      : "";

  const outerPadding = Math.round(96 * scale);
  const avatarSize = Math.round(168 * scale);
  const avatarX = outerPadding;
  const avatarY = outerPadding;

  const titleX = outerPadding;
  const titleMaxWidth = options.width - outerPadding * 2;

  const authorFontSize = Math.round(56 * scale);
  const authorY = options.height - outerPadding;

  const titleFontSize = Math.round(120 * scale);
  const lineHeight = Math.round(136 * scale);
  const subtitleFontSize = Math.round(52 * scale);
  const subtitleGap = options.subtitle ? Math.round(28 * scale) : 0;

  const titleAreaTop = avatarY + avatarSize + Math.round(96 * scale);
  const titleAreaBottom = authorY - authorFontSize - Math.round(60 * scale);
  const maxTitleHeight = Math.max(1, titleAreaBottom - titleAreaTop - (options.subtitle ? subtitleFontSize + subtitleGap : 0));

  const fittedTitle = wrapAndFitText({
    text: options.title,
    maxWidth: titleMaxWidth,
    maxHeight: maxTitleHeight,
    fontSize: titleFontSize,
    lineHeight,
    minFontSize: Math.round(72 * scale),
    wrap: wrapLinesV3
  });

  const titleLines = fittedTitle.lines;
  const titleSvg = `<text x="${titleX}" y="${titleAreaTop}" fill="#ffffff" font-family="${FONT_STACK}" font-size="${fittedTitle.fontSize}" font-weight="900" letter-spacing="-1.2" dominant-baseline="hanging">
    ${titleLines
      .map((line, index) => {
        const dy = index === 0 ? 0 : fittedTitle.lineHeight;
        return `<tspan x="${titleX}" dy="${dy}">${escapeXml(line)}</tspan>`;
      })
      .join("")}
  </text>`;

  const subtitleSvg = options.subtitle
    ? `<text x="${titleX}" y="${
        titleAreaTop + titleLines.length * fittedTitle.lineHeight + subtitleGap
      }" fill="rgba(255,255,255,0.86)" font-family="${FONT_STACK}" font-size="${subtitleFontSize}" font-weight="700" dominant-baseline="hanging">${escapeXml(
        options.subtitle
      )}</text>`
    : "";

  const authorSvg = `<text x="${outerPadding}" y="${authorY}" fill="rgba(255,255,255,0.92)" font-family="${FONT_STACK}" font-size="${authorFontSize}" font-weight="800" dominant-baseline="alphabetic">${escapeXml(
    options.author
  )}</text>`;

  const avatarSvg = renderTopAvatar({
    options,
    x: avatarX,
    y: avatarY,
    size: avatarSize,
    idBase
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${options.width}" height="${options.height}" viewBox="0 0 ${options.width} ${options.height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Blog cover for ${escapeXml(
    options.title
  )}">
  <defs>
    ${defs}
  </defs>
  <rect width="100%" height="100%" fill="${backgroundFill}"/>
  ${avatarSvg}
  ${titleSvg}
  ${subtitleSvg}
  ${authorSvg}
</svg>`;
}

module.exports = {
  renderTemplateV3
};

