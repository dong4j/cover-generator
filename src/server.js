"use strict";

const { generateCoverSvg } = require("./coverGenerator");
const { createServer } = require("./createServer");

const PORT = Number(process.env.PORT) || 3000;
const server = createServer({ generateCoverSvg });

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Cover generation server listening on http://localhost:${PORT}`);
});
