"use strict";

const { generateCoverSvgAsync, generateRandomCoverSvgAsync } = require("./coverGenerator");
const { createServer } = require("./createServer");

const PORT = Number(process.env.PORT) || 4321;
const server = createServer({
  generateCoverSvg: generateCoverSvgAsync,
  generateRandomCoverSvg: generateRandomCoverSvgAsync
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Cover generation server listening on http://localhost:${PORT}`);
});
