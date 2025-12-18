"use strict";

// coverGenerator/exporter.js
// Template registry + dispatcher.
// Each version lives in its own file under coverGenerator/templates/.

const { renderTemplateV1 } = require("./templates/v1");
const { renderTemplateV2 } = require("./templates/v2");

const templates = {
  v1: renderTemplateV1,
  v2: renderTemplateV2
};

function generateSVG(options) {
  const template = templates[options.template] || templates.v1;
  return template(options);
}

module.exports = {
  generateSVG,
  templates
};
