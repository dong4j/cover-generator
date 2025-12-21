"use strict";

// coverGenerator/templates/v4.js
// Template v4 implementation: circuit board background + centered emblem + title/subtitle.

const { renderAvatar } = require("../shapeEngine");
const { escapeXml, wrapLines } = require("../typographyEngine");
const { buildTextureOverlay } = require("../overlayEngine");
const { createRng, normalizeSeed, randomChoice } = require("../utils");

const FONT_STACK =
  "Inter, 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

const COOL_COLORS = ["#0f2747", "#153a63", "#1b4473", "#1f5a8a", "#214f79", "#1b3b5c"];

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

function wrapLinesV4(text, maxWidth, fontSize) {
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

function renderCenterMark({ options, centerX, centerY, size, idBase }) {
  if (options.avatarUrl || options.avatarEmoji) {
    const clipId = `${idBase}-center-avatar`;
    const x = Math.round(centerX - size / 2);
    const y = Math.round(centerY - size / 2);
    return `<g transform="translate(${x}, ${y})">
      ${renderAvatar({
        avatarUrl: options.avatarUrl,
        avatarEmoji: options.avatarEmoji,
        size,
        bgColor: "rgba(255,255,255,0.12)",
        textColor: "#0b1f33",
        clipId
      })}
    </g>`;
  }

  const stroke = "#7dd3fc";
  const strokeWidth = Math.max(4, Math.round(size * 0.06));
  const rx = Math.round(size * 0.46);
  const ry = Math.round(size * 0.20);
  const dotR = Math.max(6, Math.round(size * 0.08));
  return `<g>
    <g fill="none" stroke="${stroke}" stroke-width="${strokeWidth}">
      <ellipse cx="${centerX}" cy="${centerY}" rx="${rx}" ry="${ry}"/>
      <ellipse cx="${centerX}" cy="${centerY}" rx="${rx}" ry="${ry}" transform="rotate(60 ${centerX} ${centerY})"/>
      <ellipse cx="${centerX}" cy="${centerY}" rx="${rx}" ry="${ry}" transform="rotate(-60 ${centerX} ${centerY})"/>
    </g>
    <circle cx="${centerX}" cy="${centerY}" r="${dotR}" fill="${stroke}"/>
  </g>`;
}

function renderTemplateV4(options) {
  const seed = normalizeSeed(options.seed, `${options.title}-${options.author}-${options.template}`);
  const rng = createRng(seed);
  const idBase = `cover-v4-${seed.toString(16)}`;

  const scale = Math.min(options.width / 1600, options.height / 900);

  const bgMode = normalizeBackgroundMode(options);
  const resolvedMode =
    options.color || bgMode === "solid" ? "solid" : bgMode === "gradient" ? "gradient" : "gradient";

  const bgSolid = options.color || randomChoice(COOL_COLORS, rng);
  const bgA = randomChoice(COOL_COLORS, rng);
  const bgB = randomChoice(COOL_COLORS, rng);
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

  const overlay = buildTextureOverlay(
    { ...options, texture: options.texture || "circuit" },
    idBase
  );

  const centerX = Math.round(options.width / 2);
  const topPadding = Math.round(110 * scale);
  const iconSize = Math.round(200 * scale);
  const iconGap = Math.round(36 * scale);
  const iconCenterY = Math.round(topPadding + iconSize / 2);
  const titleAreaTop = Math.round(topPadding + iconSize + iconGap);

  const titleMaxWidth = Math.round(options.width * 0.72);
  const subtitleMaxWidth = Math.round(options.width * 0.68);

  const titleFontSize = Math.round(92 * scale);
  const titleLineHeight = Math.round(112 * scale);
  const titleMinFontSize = Math.round(64 * scale);

  const subtitleFontSize = Math.round(36 * scale);
  const subtitleLineHeight = Math.round(48 * scale);
  const subtitleMinFontSize = Math.round(24 * scale);
  const subtitleGap = options.subtitle ? Math.round(24 * scale) : 0;

  const authorFontSize = Math.round(30 * scale);
  const authorLineHeight = Math.round(36 * scale);
  const authorGap = Math.round(26 * scale);
  const bottomPadding = Math.round(80 * scale);

  const subtitleLayout = options.subtitle
    ? wrapAndFitText({
        text: options.subtitle,
        maxWidth: subtitleMaxWidth,
        maxHeight: Math.round(120 * scale),
        fontSize: subtitleFontSize,
        lineHeight: subtitleLineHeight,
        minFontSize: subtitleMinFontSize,
        wrap: wrapLinesV4
      })
    : null;

  const subtitleHeight = subtitleLayout ? subtitleLayout.lines.length * subtitleLayout.lineHeight : 0;
  const availableHeight = options.height - bottomPadding - titleAreaTop;
  const reservedForSubtitle = subtitleLayout ? subtitleHeight + subtitleGap : 0;
  const reservedForAuthor = options.author ? authorLineHeight + authorGap : 0;
  const maxTitleHeight = Math.max(1, availableHeight - reservedForSubtitle - reservedForAuthor);

  const fittedTitle = wrapAndFitText({
    text: options.title,
    maxWidth: titleMaxWidth,
    maxHeight: maxTitleHeight,
    fontSize: titleFontSize,
    lineHeight: titleLineHeight,
    minFontSize: titleMinFontSize,
    wrap: wrapLinesV4
  });

  const titleLines = fittedTitle.lines;
  const titleSvg = `<text x="${centerX}" y="${titleAreaTop}" fill="#ffffff" font-family="${FONT_STACK}" font-size="${fittedTitle.fontSize}" font-weight="800" letter-spacing="-1" text-anchor="middle" dominant-baseline="hanging">
    ${titleLines
      .map((line, index) => {
        const dy = index === 0 ? 0 : fittedTitle.lineHeight;
        return `<tspan x="${centerX}" dy="${dy}">${escapeXml(line)}</tspan>`;
      })
      .join("")}
  </text>`;

  let cursorY = titleAreaTop + titleLines.length * fittedTitle.lineHeight;
  const subtitleSvg = subtitleLayout
    ? (() => {
        cursorY += subtitleGap;
        const subtitleText = `<text x="${centerX}" y="${cursorY}" fill="rgba(255,255,255,0.74)" font-family="${FONT_STACK}" font-size="${subtitleLayout.fontSize}" font-weight="600" text-anchor="middle" dominant-baseline="hanging">
          ${subtitleLayout.lines
            .map((line, index) => {
              const dy = index === 0 ? 0 : subtitleLayout.lineHeight;
              return `<tspan x="${centerX}" dy="${dy}">${escapeXml(line)}</tspan>`;
            })
            .join("")}
        </text>`;
        cursorY += subtitleLayout.lines.length * subtitleLayout.lineHeight;
        return subtitleText;
      })()
    : "";

  let authorSvg = "";
  if (options.author) {
    cursorY += authorGap;
    authorSvg = `<text x="${centerX}" y="${cursorY}" fill="rgba(255,255,255,0.70)" font-family="${FONT_STACK}" font-size="${authorFontSize}" font-weight="600" text-anchor="middle" dominant-baseline="hanging">${escapeXml(
      options.author
    )}</text>`;
  }

  const markSvg = renderCenterMark({
    options,
    centerX,
    centerY: iconCenterY,
    size: iconSize,
    idBase
  });

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
  ${markSvg}
  ${titleSvg}
  ${subtitleSvg}
  ${authorSvg}
</svg>`;
}

module.exports = {
  renderTemplateV4
};
