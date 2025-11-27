const path = require("path");

module.exports = {
  apps: [
    {
      name: "RYD-GUI",

      cwd: path.resolve("C:/Users/Administrator/Desktop/JS App/RYD-Gui/RYD-Gui"),

      script: "node",
      args: "start-nextjs.js 3002",

      env: {
        NODE_ENV: "production"
      },

      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      error_file: "logs/err.log",
      out_file: "logs/out.log",
      log_file: "logs/combined.log",
      time: true
    }
  ]
};