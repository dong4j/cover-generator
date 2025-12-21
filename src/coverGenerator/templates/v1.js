"use strict";

// coverGenerator/templates/v1.js
// Template v1 implementation: warm background + light card + footer avatar + author label.

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

function wrapLinesV1(text, maxWidth, fontSize) {
  // This wrapper is tuned for titles that mix CJK + Latin.
  // It tokenizes ASCII word-like chunks while allowing per-character wrapping for CJK.
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
  // Fit text into a fixed rectangle by reducing font-size (and re-wrapping) if needed.
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

function renderFooterAvatar({
  options,
  x,
  baselineY,
  size,
  idBase,
  index,
  textColor,
  alignTextFontSize
}) {
  // We do not have real font metrics on the server. To make the avatar/placeholder
  // look visually aligned with the author text, we estimate the text visual center
  // from its baseline and font-size.
  const estimatedTextCenterY =
    baselineY - Math.round((Number.isFinite(alignTextFontSize) ? alignTextFontSize : size) * 0.35);
  const centerY = estimatedTextCenterY;
  const r = size / 2;
  const y = Math.round(centerY - r);
  const cx = Math.round(x + r);
  const cy = Math.round(centerY);
  const bgFill = "#ffffff";
  const stroke = "rgba(124,45,18,0.18)";

  if (!options.avatarUrl && !options.avatarEmoji) {
    return `<g>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${bgFill}" stroke="${stroke}" stroke-width="2"/>
      <circle cx="${cx}" cy="${Math.round(cy - r * 0.12)}" r="${Math.round(r * 0.22)}" fill="rgba(124,45,18,0.28)"/>
      <path d="M ${Math.round(cx - r * 0.46)} ${Math.round(cy + r * 0.38)} C ${Math.round(
      cx - r * 0.16
    )} ${Math.round(cy + r * 0.12)} ${Math.round(cx + r * 0.16)} ${Math.round(
      cy + r * 0.12
    )} ${Math.round(cx + r * 0.46)} ${Math.round(cy + r * 0.38)}" fill="none" stroke="rgba(124,45,18,0.28)" stroke-width="${Math.max(
      2,
      Math.round(size * 0.06)
    )}" stroke-linecap="round"/>
    </g>`;
  }

  if (options.avatarEmoji) {
    const fontSize = Math.round(size * 0.62);
    return `<g>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${bgFill}" stroke="${stroke}" stroke-width="2"/>
      <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_STACK}" font-size="${fontSize}">${escapeXml(
      options.avatarEmoji
    )}</text>
    </g>`;
  }

  if (!options.avatarUrl) return "";

  const clipId = `${idBase}-footerAvatarClip-${index}`;
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${bgFill}" stroke="${stroke}" stroke-width="2"/>
    <g transform="translate(${x}, ${y})">
      ${renderAvatar({
        avatarUrl: options.avatarUrl,
        avatarEmoji: options.avatarEmoji,
        size,
        bgColor: bgFill,
        textColor,
        clipId
      })}
    </g>
  </g>`;
}

function normalizeV1BackgroundMode(options) {
  // v1 intentionally supports only solid/gradient/auto (no patterns).
  const mode = String(options.background || "auto").toLowerCase();
  if (mode === "solid" || mode === "gradient" || mode === "auto") return mode;
  return "auto";
}

function renderTemplateV1(options) {
  const seed = normalizeSeed(options.seed, `${options.title}-${options.author}-${options.template}`);
  const rng = createRng(seed);
  const idBase = `cover-v1-${seed.toString(16)}`;

  const scale = Math.min(options.width / 1600, options.height / 900);
  const textColor = "#7c2d12";
  const mutedColor = "#b45309";
  const borderColor = "rgba(124,45,18,0.12)";

  const shadowFilterId = `${idBase}-cardShadow`;
  const bgGradientId = `${idBase}-bgGradient`;
  const defsBase = `<filter id="${shadowFilterId}" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="${Math.round(18 * scale)}" stdDeviation="${Math.round(
    18 * scale
  )}" flood-color="#b45309" flood-opacity="0.18"/>
  </filter>`;

  const bgMode = normalizeV1BackgroundMode(options);
  // Align with v2/v3: when no `color` is provided, default to deterministic warm gradient
  // unless explicitly forced to solid.
  const resolvedMode =
    options.color || bgMode === "solid" ? "solid" : bgMode === "gradient" ? "gradient" : "gradient";

  const bgSolid = options.color || randomChoice(WARM_COLORS, rng);
  const bgA = randomChoice(WARM_COLORS, rng);
  const bgB = randomChoice(WARM_COLORS, rng);
  const bgAngle = Math.round(rng() * 360);

  const defs =
    resolvedMode === "gradient"
      ? `${defsBase}
  <linearGradient id="${bgGradientId}" gradientTransform="rotate(${bgAngle})">
    <stop offset="0%" stop-color="${bgA}"/>
    <stop offset="100%" stop-color="${bgB}"/>
  </linearGradient>`
      : defsBase;

  const backgroundFill = resolvedMode === "gradient" ? `url(#${bgGradientId})` : bgSolid;
  const cardFill = options.accent || randomChoice(LIGHT_CARD_COLORS, rng);
  const overlay = buildTextureOverlay(options, idBase);

  const cardW = Math.round(options.width * 0.84);
  const cardH = Math.round(options.height * 0.7);
  const cardX = Math.round((options.width - cardW) / 2);
  const cardY = Math.round((options.height - cardH) / 2);
  const cardRadius = Math.round(46 * scale);
  const cardPadding = Math.round(110 * scale);

  const fontBump = Math.round(2 * scale);
  const titleFontSize = Math.round(98 * scale) + fontBump;
  const lineHeight = Math.round(116 * scale);
  const subtitleFontSize = Math.round(44 * scale) + fontBump;
  const authorFontSize = Math.round(52 * scale) + fontBump;
  const avatarSize = Math.round(92 * scale);

  const availableTextWidth = cardW - cardPadding * 2;
  const subtitleGap = options.subtitle ? Math.round(26 * scale) : 0;

  const footerHeight = Math.round(
    Math.max(170 * scale, authorFontSize + avatarSize + Math.round(28 * scale))
  );
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
    minFontSize: Math.round(66 * scale),
    wrap: wrapLinesV1
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

  const titleSvg = `<text x="${Math.round(cardX + cardW / 2)}" y="${titleY}" fill="${textColor}" font-family="${FONT_STACK}" font-size="${fittedTitle.fontSize}" font-weight="800" letter-spacing="-1.6" dominant-baseline="hanging" text-anchor="middle">
    ${titleLines
      .map((line, index) => {
        const dy = index === 0 ? 0 : fittedTitle.lineHeight;
        return `<tspan x="${Math.round(cardX + cardW / 2)}" dy="${dy}">${escapeXml(
          line
        )}</tspan>`;
      })
      .join("")}
  </text>`;

  const subtitleSvg = options.subtitle
    ? `<text x="${Math.round(cardX + cardW / 2)}" y="${
        titleY + titleLines.length * fittedTitle.lineHeight + subtitleGap
      }" fill="${mutedColor}" font-family="${FONT_STACK}" font-size="${subtitleFontSize}" font-weight="600" dominant-baseline="hanging" text-anchor="middle">${escapeXml(
        options.subtitle
      )}</text>`
    : "";

  const footerBaselineY = cardY + cardH - cardPadding + Math.round(10 * scale);
  const avatarX = cardX + cardPadding;
  const avatarSvg = renderFooterAvatar({
    options,
    x: avatarX,
    baselineY: footerBaselineY,
    size: avatarSize,
    idBase,
    index: 1,
    textColor,
    alignTextFontSize: authorFontSize
  });

  const authorSvg = `<text x="${cardX + cardW - cardPadding}" y="${footerBaselineY}" fill="${textColor}" font-family="${FONT_STACK}" font-size="${authorFontSize}" font-weight="800" text-anchor="end" dominant-baseline="alphabetic">${escapeXml(
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
  ${cardSvg}
  ${titleSvg}
  ${subtitleSvg}
  ${avatarSvg}
  ${authorSvg}
</svg>`;
}

module.exports = {
  renderTemplateV1
};
