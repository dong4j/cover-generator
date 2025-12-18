"use strict";

// coverGenerator/shapeEngine.js
// Small, reusable SVG shape primitives.
// Keep this file dependency-free (except typography helpers) so templates can reuse it.

const { escapeXml } = require("./typographyEngine");

function renderAvatar({ avatarUrl, avatarEmoji, size, bgColor, textColor, clipId }) {
  const radius = size / 2;
  const background = bgColor || "rgba(255,255,255,0.14)";
  const foreground = textColor || "#ffffff";

  // Emoji has higher priority than avatarUrl to avoid remote fetch reliance when both are present.
  if (avatarEmoji) {
    return `<g>
      <circle cx="${radius}" cy="${radius}" r="${radius}" fill="${background}"/>
      <text x="${radius}" y="${radius}" text-anchor="middle" dominant-baseline="central" font-size="${size *
      0.55}" font-family="Inter, 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif">${escapeXml(
      avatarEmoji
    )}</text>
    </g>`;
  }

  if (avatarUrl) {
    // Note: the server does not fetch avatarUrl; it is embedded as an <image href="...">.
    return `<clipPath id="${clipId}"><circle cx="${radius}" cy="${radius}" r="${radius}"/></clipPath>
  <image href="${escapeXml(
      avatarUrl
    )}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>
  <circle cx="${radius}" cy="${radius}" r="${radius}" fill="none" stroke="${foreground}" stroke-width="6"/>`;
  }

  return `<circle cx="${radius}" cy="${radius}" r="${radius}" fill="${background}"/>`;
}

module.exports = {
  renderAvatar
};
