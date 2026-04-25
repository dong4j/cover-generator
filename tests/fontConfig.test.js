"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { FONT_STACK } = require("../src/coverGenerator/fontConfig");

test("FONT_STACK prefers macOS and keeps Windows/Linux CJK fallbacks", () => {
  assert.match(FONT_STACK, /^'PingFang SC'/);
  assert.match(FONT_STACK, /'SF Pro Display'/);
  assert.match(FONT_STACK, /'Microsoft YaHei UI'/);
  assert.match(FONT_STACK, /'Noto Sans CJK SC'/);
  assert.match(FONT_STACK, /'Source Han Sans SC'/);
  assert.match(FONT_STACK, /'Segoe UI Emoji'/);
});
