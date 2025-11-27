// start-nextjs.js
const { spawn } = require("child_process");
const path = require("path");

const argPort = parseInt(process.argv[2], 10);
const port = Number.isFinite(argPort)
  ? argPort
  : process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : 3000;

const nextStart = spawn("npx", ["next", "start", "-p", port, "-H", "0.0.0.0"], {
  stdio: "inherit",
  shell: true,
  cwd: path.resolve(__dirname)
});

nextStart.on("close", (code) => {
  console.log(`Next.js process exited with code ${code}`);
});

nextStart.on("error", (err) => {
  console.error("❌ Failed to start Next.js:", err);
});