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

function generateSVG(options) {
  const template = templates[options.template] || templates.v1;
  return template(options);
}

module.exports = {
  generateSVG,
  templates
};
