"use strict";

// coverGenerator/exporter.js
// Template registry + dispatcher.
// Each version lives in its own file under coverGenerator/templates/.

const { renderTemplateV1 } = require("./templates/v1");
const { renderTemplateV2 } = require("./templates/v2");
const { renderTemplateV3 } = require("./templates/v3");
const { renderTemplateV4 } = require("./templates/v4");
const { renderTemplateV5 } = require("./templates/v5");
const { renderTemplateV6 } = require("./templates/v6");
const { renderTemplateV7 } = require("./templates/v7");

const templates = {
  v1: renderTemplateV1,
  v2: renderTemplateV2,
  v3: renderTemplateV3,
  v4: renderTemplateV4,
  v5: renderTemplateV5,
  v6: renderTemplateV6,
  v7: renderTemplateV7
};

const TYPOGRAPHY_STYLE_BLOCK = `<style id="cover-typography-style"><![CDATA[
text {
  font-kerning: none;
  font-variant-ligatures: none;
  text-rendering: geometricPrecision;
}
]]></style>`;

function injectTypographyStyle(svg) {
  const str = String(svg || "");
  if (!str.includes("<svg")) return str;
  if (str.includes('id="cover-typography-style"')) return str;
  if (str.includes("<defs>")) {
    return str.replace("<defs>", `<defs>\n    ${TYPOGRAPHY_STYLE_BLOCK}`);
  }
  const svgTagEnd = str.indexOf(">");
  if (svgTagEnd === -1) return str;
  return `${str.slice(0, svgTagEnd + 1)}
  <defs>${TYPOGRAPHY_STYLE_BLOCK}</defs>${str.slice(svgTagEnd + 1)}`;
}

function generateSVG(options) {
  const template = templates[options.template] || templates.v1;
  const svg = template(options);
  return injectTypographyStyle(svg);
}

module.exports = {
  generateSVG,
  injectTypographyStyle,
  templates
};
