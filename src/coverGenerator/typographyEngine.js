"use strict";

// coverGenerator/typographyEngine.js
// Typography utilities:
// - escapeXml: safe text embedding into SVG/XML
// - wrapLines: simple width estimation for wrapping

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapLines(text, maxWidth, fontSize) {
  // Very lightweight approximation: treat average char width as a fraction of fontSize.
  // Templates can provide their own wrapper if they need better CJK handling.
  const averageCharWidth = fontSize * 0.55;
  const maxChars = Math.max(8, Math.floor(maxWidth / averageCharWidth));
  const words = String(text).split(/(\s+)/).filter(Boolean);
  const lines = [];

  let current = "";
  for (const word of words) {
    const tentative = current ? `${current}${word}` : word;
    if (tentative.length <= maxChars) {
      current = tentative;
      continue;
    }

    if (!current) {
      const chunks = word.match(new RegExp(`.{1,${maxChars}}`, "g")) || [word];
      lines.push(...chunks.slice(0, -1));
      current = chunks.at(-1) || "";
    } else {
      lines.push(current);
      current = word.trim();
    }
  }

  if (current) lines.push(current);
  return lines;
}

module.exports = {
  escapeXml,
  wrapLines
};
