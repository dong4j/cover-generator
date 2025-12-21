"use strict";

// coverGenerator/templates/v2.js
// Template v2 implementation: left avatar + right card (layout inspired by v2.png).

const { renderAvatar } = require("../shapeEngine");
const { escapeXml, wrapLines } = require("../typographyEngine");
const { buildTextureOverlay } = require("../overlayEngine");
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

const LIGHT_CARD_COLORS = [
  "#ffffff",
  "#fffbeb",
  "#fff7ed",
  "#fef2f2",
  "#fdf2f8",
  "#f5f3ff",
  "#f0fdf4",
  "#ecfeff"
];

function clampInt(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

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

function wrapLinesV2(text, maxWidth, fontSize) {
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

function renderCard({ x, y, width, height, radius, shadowFilterId, borderColor, fill }) {
  return `<g>
    <g filter="url(#${shadowFilterId})">
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="${fill}"/>
    </g>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="none" stroke="${borderColor}" stroke-width="2"/>
  </g>`;
}

function renderLeftAvatar({ options, x, y, size, idBase, index }) {
  const r = size / 2;
  const cx = Math.round(x + r);
  const cy = Math.round(y + r);

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
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="rgba(124,45,18,0.14)" stroke-width="2"/>
      <circle cx="${cx}" cy="${headCy}" r="${headR}" fill="rgba(124,45,18,0.18)"/>
      <path d="M ${leftX} ${shoulderY} C ${c1x} ${cY} ${c2x} ${cY} ${rightX} ${shoulderY}" fill="none" stroke="rgba(124,45,18,0.18)" stroke-width="${strokeWidth}" stroke-linecap="round"/>
    </g>`;
  }

  if (options.avatarEmoji) {
    const emojiFontSize = Math.round(size * 0.46);
    return `<g>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="rgba(124,45,18,0.14)" stroke-width="2"/>
      <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_STACK}" font-size="${emojiFontSize}">${escapeXml(
      options.avatarEmoji
    )}</text>
    </g>`;
  }

  if (!options.avatarUrl) return "";

  const clipId = `${idBase}-avatarClip-${index}`;
  return `<g transform="translate(${x}, ${y})">
    ${renderAvatar({
      avatarUrl: options.avatarUrl,
      avatarEmoji: options.avatarEmoji,
      size,
      bgColor: "#ffffff",
      textColor: "#b45309",
      clipId
    })}
  </g>`;
}

function renderTemplateV2(options) {
  const seed = normalizeSeed(options.seed, `${options.title}-${options.author}-${options.template}`);
  const rng = createRng(seed);
  const idBase = `cover-v2-${seed.toString(16)}`;

  const scale = Math.min(options.width / 1600, options.height / 900);
  const borderColor = "rgba(124,45,18,0.12)";
  const textColor = "#7c2d12";
  const mutedColor = "#b45309";

  // Color logic aligned with v1:
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
  const cardFill = options.accent || randomChoice(LIGHT_CARD_COLORS, rng);
  const overlay = buildTextureOverlay(options, idBase);

  const outerPadding = Math.round(70 * scale);
  const cardW = Math.round(options.width * 0.64);
  const cardH = Math.round(options.height * 0.82);
  const cardX = options.width - outerPadding - cardW;
  const cardY = Math.round((options.height - cardH) / 2);
  const cardRadius = Math.round(44 * scale);
  const cardPadding = Math.round(96 * scale);

  const leftAreaW = Math.max(outerPadding, cardX - outerPadding);
  const avatarSize = clampInt(
    // Slightly smaller than the initial v2 to avoid an oversized left avatar circle.
    Math.round(Math.min(leftAreaW * 0.62, options.height * 0.42)),
    Math.round(170 * scale),
    Math.round(340 * scale)
  );
  const avatarX = Math.round(outerPadding + (leftAreaW - avatarSize) / 2);
  const avatarY = Math.round((options.height - avatarSize) / 2);

  const shadowFilterId = `${idBase}-cardShadow`;
  const defsBase = `<filter id="${shadowFilterId}" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="${Math.round(18 * scale)}" stdDeviation="${Math.round(
    18 * scale
  )}" flood-color="#b45309" flood-opacity="0.18"/>
  </filter>`;
  const defs =
    resolvedMode === "gradient"
      ? `${defsBase}
  <linearGradient id="${bgGradientId}" gradientTransform="rotate(${bgAngle})">
    <stop offset="0%" stop-color="${bgA}"/>
    <stop offset="100%" stop-color="${bgB}"/>
  </linearGradient>`
      : defsBase;

  const titleFontSize = Math.round(96 * scale);
  const lineHeight = Math.round(110 * scale);
  const subtitleFontSize = Math.round(44 * scale);
  const authorFontSize = Math.round(56 * scale);

  const availableTextWidth = cardW - cardPadding * 2;
  const subtitleGap = options.subtitle ? Math.round(26 * scale) : 0;
  const footerGap = Math.round(70 * scale);
  const footerHeight = authorFontSize + footerGap;
  const maxTitleHeight =
    cardH -
    cardPadding * 2 -
    footerHeight -
    (options.subtitle ? subtitleFontSize + subtitleGap : 0);

  const fittedTitle = wrapAndFitText({
    text: options.title,
    maxWidth: availableTextWidth,
    maxHeight: Math.max(1, maxTitleHeight),
    fontSize: titleFontSize,
    lineHeight,
    minFontSize: Math.round(64 * scale),
    wrap: wrapLinesV2
  });

  const titleLines = fittedTitle.lines;
  const titleBlockHeight =
    titleLines.length * fittedTitle.lineHeight +
    (options.subtitle ? subtitleFontSize + subtitleGap : 0);
  const titleY =
    cardY +
    cardPadding +
    Math.max(0, Math.round((cardH - cardPadding * 2 - footerHeight - titleBlockHeight) / 2));

  const cardSvg = renderCard({
    x: cardX,
    y: cardY,
    width: cardW,
    height: cardH,
    radius: cardRadius,
    shadowFilterId,
    borderColor,
    fill: cardFill
  });

  const avatarSvg = renderLeftAvatar({
    options,
    x: avatarX,
    y: avatarY,
    size: avatarSize,
    idBase,
    index: 1
  });

  const titleSvg = `<text x="${cardX + cardPadding}" y="${titleY}" fill="${textColor}" font-family="${FONT_STACK}" font-size="${fittedTitle.fontSize}" font-weight="800" letter-spacing="-1.4" dominant-baseline="hanging">
    ${titleLines
      .map((line, index) => {
        const dy = index === 0 ? 0 : fittedTitle.lineHeight;
        return `<tspan x="${cardX + cardPadding}" dy="${dy}">${escapeXml(line)}</tspan>`;
      })
      .join("")}
  </text>`;

  const subtitleSvg = options.subtitle
    ? `<text x="${cardX + cardPadding}" y="${
        titleY + titleLines.length * fittedTitle.lineHeight + subtitleGap
      }" fill="${mutedColor}" font-family="${FONT_STACK}" font-size="${subtitleFontSize}" font-weight="600" dominant-baseline="hanging">${escapeXml(
        options.subtitle
      )}</text>`
    : "";

  const authorSvg = `<text x="${cardX + cardPadding}" y="${
    cardY + cardH - cardPadding
  }" fill="${textColor}" font-family="${FONT_STACK}" font-size="${authorFontSize}" font-weight="800" dominant-baseline="alphabetic">${escapeXml(
    options.author
  )}</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${options.width}" height="${options.height}" viewBox="0 0 ${options.width} ${options.height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Blog cover for ${escapeXml(
    options.title
  )}">
  <defs>
    ${defs}
    ${overlay.defs}
  </defs>
  <rect width="100%" height="100%" fill="${backgroundFill}"/>
  ${overlay.layer}
  ${avatarSvg}
  ${cardSvg}
  ${titleSvg}
  ${subtitleSvg}
  ${authorSvg}
</svg>`;
}

module.exports = {
  renderTemplateV2
};
