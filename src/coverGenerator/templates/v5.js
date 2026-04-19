"use strict";

// coverGenerator/templates/v5.js
// Template v5 implementation: warm gradient + fine grid + centered title + single icon.

const { renderAvatar } = require("../shapeEngine");
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

const WARM_COLORS = [
  "#f97316",
  "#fb7185",
  "#f472b6",
  "#f43f5e",
  "#f59e0b",
  "#f97316",
  "#fb923c",
  "#ec4899"
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

function wrapLinesV5(text, maxWidth, fontSize) {
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

function buildMicroGridOverlay(idBase) {
  const patternId = `${idBase}-micro-grid`;
  const stroke = "rgba(124,45,18,0.18)";
  return {
    defs: `<pattern id="${patternId}" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
      <path d="M 22 0 L 0 0 0 22" fill="none" stroke="${stroke}" stroke-width="1"/>
    </pattern>`,
    layer: `<rect width="100%" height="100%" fill="url(#${patternId})" opacity="0.35"/>`
  };
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

  if (options.avatarUrl) {
    const clipId = `${idBase}-icon`;
    return `<g transform="translate(${x}, ${y})">
      ${renderAvatar({
        avatarUrl: options.avatarUrl,
        avatarEmoji: "",
        size,
        bgColor: "#ffffff",
        textColor: "#b45309",
        clipId
      })}
    </g>`;
  }

  if (options.avatarEmoji) {
    const fontSize = Math.round(size * 0.58);
    return `<g>
      <circle cx="${centerX}" cy="${centerY}" r="${Math.round(size / 2)}" fill="#ffffff"/>
      <text x="${centerX}" y="${centerY}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_STACK}" font-size="${fontSize}" fill="#b45309">${escapeXml(
      options.avatarEmoji
    )}</text>
    </g>`;
  }

  const initial = getInitial(options.title);
  const fontSize = Math.round(size * 0.54);
  return `<g>
    <circle cx="${centerX}" cy="${centerY}" r="${Math.round(size / 2)}" fill="#ffffff"/>
    <text x="${centerX}" y="${centerY}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_STACK}" font-size="${fontSize}" font-weight="700" fill="#b45309">${escapeXml(
    initial
  )}</text>
  </g>`;
}

function renderTemplateV5(options) {
  const seed = normalizeSeed(options.seed, `${options.title}-${options.author}-${options.template}`);
  const rng = createRng(seed);
  const idBase = `cover-v5-${seed.toString(16)}`;

  const scale = Math.min(options.width / 1600, options.height / 900);

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

  const overlay =
    options.texture && String(options.texture).trim()
      ? buildTextureOverlay(options, idBase)
      : buildMicroGridOverlay(idBase);

  const centerX = Math.round(options.width / 2);
  const badgeFontSize = Math.round(56 * scale);
  const badgePaddingX = Math.round(30 * scale);
  const badgePaddingY = Math.round(10 * scale);
  const badgeHeight = Math.round(badgeFontSize + badgePaddingY * 2);
  const badgeText = options.author || "Anonymous";
  const badgeWidth = Math.min(
    Math.round(options.width * 0.62),
    Math.round(badgeText.length * badgeFontSize * 0.6 + badgePaddingX * 2)
  );
  const badgeX = Math.round(centerX - badgeWidth / 2);
  const badgeRadius = Math.round(badgeHeight / 2);

  const titleMaxWidth = Math.round(options.width * 0.74);

  const iconSize = resolveScaledAvatarSize(options, scale, 0.5, 96, 168);
  const groupGap = Math.round(40 * scale);

  const subtitleFontSize = Math.round(36 * scale);
  const subtitleLineHeight = Math.round(48 * scale);
  const subtitleMinFontSize = Math.round(24 * scale);
  const subtitleGap = options.subtitle ? Math.round(20 * scale) : 0;

  const subtitleLayout = options.subtitle
    ? wrapAndFitText({
        text: options.subtitle,
        maxWidth: Math.round(options.width * 0.68),
        maxHeight: Math.round(120 * scale),
        fontSize: subtitleFontSize,
        lineHeight: subtitleLineHeight,
        minFontSize: subtitleMinFontSize,
        wrap: wrapLinesV5
      })
    : null;

  const subtitleHeight = subtitleLayout ? subtitleLayout.lines.length * subtitleLayout.lineHeight : 0;
  const availableTitleBlockHeight =
    options.height - badgeHeight - iconSize - groupGap * 2;
  const maxTitleHeight = Math.max(
    1,
    availableTitleBlockHeight - (subtitleLayout ? subtitleHeight + subtitleGap : 0)
  );

  const titleFontSize = Math.round(92 * scale);
  const titleLineHeight = Math.round(112 * scale);
  const titleMinFontSize = Math.round(60 * scale);

  const fittedTitle = wrapAndFitText({
    text: options.title,
    maxWidth: titleMaxWidth,
    maxHeight: maxTitleHeight,
    fontSize: titleFontSize,
    lineHeight: titleLineHeight,
    minFontSize: titleMinFontSize,
    wrap: wrapLinesV5
  });

  const titleBlockHeight =
    fittedTitle.lines.length * fittedTitle.lineHeight +
    (subtitleLayout ? subtitleGap + subtitleHeight : 0);
  const groupHeight = badgeHeight + groupGap + titleBlockHeight + groupGap + iconSize;
  const groupTop = Math.round((options.height - groupHeight) / 2);
  const badgeY = groupTop;
  const titleTop = badgeY + badgeHeight + groupGap;
  const iconCenterY = Math.round(titleTop + titleBlockHeight + groupGap + iconSize / 2);

  const titleSvg = `<text x="${centerX}" y="${titleTop}" fill="#7c2d12" font-family="${FONT_STACK}" font-size="${fittedTitle.fontSize}" font-weight="800" letter-spacing="-0.6" text-anchor="middle" dominant-baseline="hanging">
    ${fittedTitle.lines
      .map((line, index) => {
        const dy = index === 0 ? 0 : fittedTitle.lineHeight;
        return `<tspan x="${centerX}" dy="${dy}">${escapeXml(line)}</tspan>`;
      })
      .join("")}
  </text>`;

  let cursorY = titleTop + fittedTitle.lines.length * fittedTitle.lineHeight;
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

  const iconSvg = renderIcon({
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
  <g>
    <rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}" rx="${badgeRadius}" ry="${badgeRadius}" fill="none" stroke="#b45309" stroke-width="2"/>
    <text x="${centerX}" y="${Math.round(badgeY + badgeHeight / 2)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_STACK}" font-size="${badgeFontSize}" font-weight="700" fill="#7c2d12">${escapeXml(
    badgeText
  )}</text>
  </g>
  ${titleSvg}
  ${subtitleSvg}
  ${iconSvg}
</svg>`;
}

module.exports = {
  renderTemplateV5
};
