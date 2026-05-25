import { spawn } from "node:child_process";

const apiPort = process.env.LAB_API_PORT || "4000";
const vitePort = process.env.VITE_PORT || "5175";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [];

function start(name, command, args, env = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });

  children.push(child);

  child.on("exit", (code, signal) => {
    if (signal) {
      return;
    }
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      shutdown(code);
    }
  });
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(`Lab UI:  http://localhost:${vitePort}/command-tests`);
console.log(`Lab API: http://127.0.0.1:${apiPort}/api/lab/health`);
console.log("Docker targets still need: docker compose up --build");

start("lab-api", process.execPath, ["lab-api/server.js"], { LAB_API_PORT: apiPort });
start("vite", npmCommand, ["run", "dev", "--", "--host", "localhost", "--port", vitePort], {
  LAB_API_PORT: apiPort,
});
