"use strict";

// coverGenerator/templates/v6.js
// Template v6 implementation: clean light background + centered icon + title/subtitle/author.

const { escapeXml, wrapLines } = require("../typographyEngine");
const { buildTextureOverlay } = require("../overlayEngine");
const {
  createRng,
  normalizeSeed,
  randomChoice,
  resolveScaledAvatarSize
} = require("../utils");

const FONT_STACK =
  "Inter, 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

const LIGHT_COLORS = [
  "#fff7ed",
  "#ffedd5",
  "#fef3c7",
  "#fde68a",
  "#fee2e2",
  "#fce7f3",
  "#fae8ff",
  "#fef9c3"
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

function wrapLinesV6(text, maxWidth, fontSize) {
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

function getInitial(text) {
  const trimmed = String(text || "").trim();
  const match = trimmed.match(/[A-Za-z0-9]/);
  if (match) return match[0].toUpperCase();
  if (trimmed) return trimmed.slice(0, 1);
  return "A";
}

function renderIcon({ options, centerX, centerY, size, idBase }) {
  const x = Math.round(centerX - size / 2);
  const y = Math.round(centerY - size / 2);
  const clipId = `${idBase}-icon-clip`;
  const bg = "#ffffff";
  const r = Math.round(size / 2);

  if (options.avatarUrl) {
    return `<g>
      <clipPath id="${clipId}">
        <circle cx="${centerX}" cy="${centerY}" r="${r}"/>
      </clipPath>
      <circle cx="${centerX}" cy="${centerY}" r="${r}" fill="${bg}"/>
      <image href="${escapeXml(
      options.avatarUrl
    )}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>
    </g>`;
  }

  if (options.avatarEmoji) {
    const fontSize = Math.round(size * 0.58);
    return `<g>
      <circle cx="${centerX}" cy="${centerY}" r="${r}" fill="${bg}"/>
      <text x="${centerX}" y="${centerY}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_STACK}" font-size="${fontSize}" fill="#b45309">${escapeXml(
      options.avatarEmoji
    )}</text>
    </g>`;
  }

  const initial = getInitial(options.title);
  const fontSize = Math.round(size * 0.54);
  const dot = Math.round(size * 0.12);
  const dotOffset = Math.round(size * 0.26);
  const triangle = Math.round(size * 0.22);
  return `<g>
    <circle cx="${centerX}" cy="${centerY}" r="${r}" fill="${bg}"/>
    <circle cx="${centerX - dotOffset}" cy="${centerY - dotOffset}" r="${dot}" fill="rgba(180,83,9,0.25)"/>
    <circle cx="${centerX + dotOffset}" cy="${centerY + dotOffset}" r="${dot}" fill="rgba(180,83,9,0.25)"/>
    <path d="M ${centerX - triangle} ${centerY - triangle} L ${centerX + triangle} ${centerY} L ${centerX - triangle} ${centerY + triangle} Z" fill="rgba(180,83,9,0.72)"/>
    <text x="${centerX}" y="${centerY + Math.round(size * 0.38)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_STACK}" font-size="${fontSize * 0.46}" fill="rgba(180,83,9,0.85)">${escapeXml(
    initial
  )}</text>
  </g>`;
}

function renderTemplateV6(options) {
  const seed = normalizeSeed(options.seed, `${options.title}-${options.author}-${options.template}`);
  const rng = createRng(seed);
  const idBase = `cover-v6-${seed.toString(16)}`;

  const scale = Math.min(options.width / 1600, options.height / 900);
  const bgMode = normalizeBackgroundMode(options);
  const resolvedMode =
    options.color || bgMode === "solid" ? "solid" : bgMode === "gradient" ? "gradient" : "gradient";

  const bgSolid = options.color || randomChoice(LIGHT_COLORS, rng);
  const bgA = randomChoice(LIGHT_COLORS, rng);
  const bgB = randomChoice(LIGHT_COLORS, rng);
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
  const overlay = buildTextureOverlay(options, idBase);

  const centerX = Math.round(options.width / 2);
  const iconSize = resolveScaledAvatarSize(options, scale, 0.48, 92, 160);
  const gap = Math.round(26 * scale);

  const titleFontSize = Math.round(88 * scale);
  const titleLineHeight = Math.round(104 * scale);
  const titleMinFontSize = Math.round(56 * scale);
  const titleMaxWidth = Math.round(options.width * 0.68);

  const subtitleFontSize = Math.round(34 * scale);
  const subtitleLineHeight = Math.round(48 * scale);
  const subtitleMinFontSize = Math.round(24 * scale);
  const subtitleMaxWidth = Math.round(options.width * 0.62);
  const subtitleGap = options.subtitle ? gap : 0;

  const authorFontSize = Math.round(26 * scale);
  const authorLineHeight = Math.round(32 * scale);
  const authorGap = options.author ? gap : 0;

  const subtitleLayout = options.subtitle
    ? wrapAndFitText({
        text: options.subtitle,
        maxWidth: subtitleMaxWidth,
        maxHeight: Math.round(140 * scale),
        fontSize: subtitleFontSize,
        lineHeight: subtitleLineHeight,
        minFontSize: subtitleMinFontSize,
        wrap: wrapLinesV6
      })
    : null;

  const subtitleHeight = subtitleLayout ? subtitleLayout.lines.length * subtitleLayout.lineHeight : 0;
  const authorHeight = options.author ? authorLineHeight : 0;
  const availableTitleHeight =
    options.height -
    iconSize -
    gap * 2 -
    subtitleHeight -
    subtitleGap -
    authorHeight -
    authorGap;

  const fittedTitle = wrapAndFitText({
    text: options.title,
    maxWidth: titleMaxWidth,
    maxHeight: Math.max(1, availableTitleHeight),
    fontSize: titleFontSize,
    lineHeight: titleLineHeight,
    minFontSize: titleMinFontSize,
    wrap: wrapLinesV6
  });

  const titleHeight = fittedTitle.lines.length * fittedTitle.lineHeight;
  const groupHeight =
    iconSize +
    gap +
    titleHeight +
    (subtitleLayout ? subtitleGap + subtitleHeight : 0) +
    (options.author ? authorGap + authorHeight : 0);
  const groupTop = Math.round((options.height - groupHeight) / 2);

  const iconCenterY = Math.round(groupTop + iconSize / 2);
  const titleTop = Math.round(groupTop + iconSize + gap);

  const iconSvg = renderIcon({
    options,
    centerX,
    centerY: iconCenterY,
    size: iconSize,
    idBase
  });

  const titleSvg = `<text x="${centerX}" y="${titleTop}" fill="#7c2d12" font-family="${FONT_STACK}" font-size="${fittedTitle.fontSize}" font-weight="800" letter-spacing="-0.6" text-anchor="middle" dominant-baseline="hanging">
    ${fittedTitle.lines
      .map((line, index) => {
        const dy = index === 0 ? 0 : fittedTitle.lineHeight;
        return `<tspan x="${centerX}" dy="${dy}">${escapeXml(line)}</tspan>`;
      })
      .join("")}
  </text>`;

  let cursorY = titleTop + titleHeight;
  const subtitleSvg = subtitleLayout
    ? (() => {
        cursorY += subtitleGap;
        const subtitleText = `<text x="${centerX}" y="${cursorY}" fill="rgba(124,45,18,0.72)" font-family="${FONT_STACK}" font-size="${subtitleLayout.fontSize}" font-weight="600" text-anchor="middle" dominant-baseline="hanging">
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
    authorSvg = `<text x="${centerX}" y="${cursorY}" fill="rgba(124,45,18,0.56)" font-family="${FONT_STACK}" font-size="${authorFontSize}" font-weight="600" text-anchor="middle" dominant-baseline="hanging">${escapeXml(
      options.author
    )}</text>`;
  }

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
  ${iconSvg}
  ${titleSvg}
  ${subtitleSvg}
  ${authorSvg}
</svg>`;
}

module.exports = {
  renderTemplateV6
};
