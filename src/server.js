"use strict";

const {
  generateCoverPngAsync,
  generateCoverSvgAsync,
  generateRandomCoverPngAsync,
  generateRandomCoverSvgAsync
} = require("./coverGenerator");
const { createServer } = require("./createServer");

const PORT = Number(process.env.PORT) || 4321;
const server = createServer({
  generateCoverPng: generateCoverPngAsync,
  generateCoverSvg: generateCoverSvgAsync,
  generateRandomCoverPng: generateRandomCoverPngAsync,
  generateRandomCoverSvg: generateRandomCoverSvgAsync
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Cover generation server listening on http://localhost:${PORT}`);
});
