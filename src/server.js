"use strict";

const { generateCoverSvg, generateRandomCoverSvg } = require("./coverGenerator");
const { createServer } = require("./createServer");

const PORT = Number(process.env.PORT) || 3000;
const server = createServer({ generateCoverSvg, generateRandomCoverSvg });

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Cover generation server listening on http://localhost:${PORT}`);
});
