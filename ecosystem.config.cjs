"use strict";

const path = require("node:path");

const root = __dirname;

module.exports = {
  apps: [
    {
      name: "cover-generator",
      namespace: "blog",
      version: "0.1.0",
      cwd: root,
      script: path.join(root, "src/server.js"),
      interpreter: "node",
      watch: false,
      ignore_watch: ["node_modules", "logs", "samples", "tests", "docs"],
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      min_uptime: "3s",
      env: {
        NODE_ENV: "production",
        PORT: 4321
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: path.join(root, "logs/pm2-error.log"),
      out_file: path.join(root, "logs/pm2-out.log"),
      merge_logs: true
    }
  ]
};
