import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

const DEFAULT_SERVER_PORT = 3000;
const DEFAULT_WEB_PORT = 3001;
const LOCALHOST = "localhost";
const WEB_HOST = "127.0.0.1";

function parsePort(value, fallback) {
  const port = Number.parseInt(value ?? "", 10);
  return Number.isInteger(port) && port > 0 ? port : fallback;
}

function checkPort(port) {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();

    tester.once("error", (error) => {
      if (error.code === "EADDRINUSE" || error.code === "EACCES") {
        resolve(false);
        return;
      }

      reject(error);
    });

    tester.once("listening", () => {
      tester.close(() => {
        resolve(true);
      });
    });

    tester.listen(port, WEB_HOST);
  });
}

async function findAvailablePort(preferredPort, reservedPorts = new Set()) {
  let port = preferredPort;

  while (reservedPorts.has(port) || !(await checkPort(port))) {
    port += 1;
  }

  return port;
}

function spawnProcess(args, env) {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  return spawn(command, args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });
}

const preferredServerPort = parsePort(process.env.PORT, DEFAULT_SERVER_PORT);
const preferredWebPort = parsePort(process.env.WEB_PORT, DEFAULT_WEB_PORT);

const serverPort = await findAvailablePort(preferredServerPort);
const webPort = await findAvailablePort(preferredWebPort, new Set([serverPort]));

const serverUrl = `http://${LOCALHOST}:${serverPort}`;
const webUrl = `http://${LOCALHOST}:${webPort}`;

if (serverPort !== preferredServerPort) {
  console.log(
    `[dev] Port ${preferredServerPort} is in use for the server. Switched to ${serverPort}.`,
  );
}

if (webPort !== preferredWebPort) {
  console.log(`[dev] Port ${preferredWebPort} is in use for the web app. Switched to ${webPort}.`);
}

console.log(`[dev] Server -> ${serverUrl}`);
console.log(`[dev] Web    -> ${webUrl}`);

const sharedEnv = {
  ...process.env,
};

const serverProcess = spawnProcess(["--filter", "server", "dev"], {
  ...sharedEnv,
  PORT: String(serverPort),
  BETTER_AUTH_URL: serverUrl,
  CORS_ORIGIN: webUrl,
});

const webProcess = spawnProcess(["--filter", "web", "start", "--", "--host", WEB_HOST, "--port", String(webPort)], {
  ...sharedEnv,
  VITE_SERVER_URL: serverUrl,
});

const children = [serverProcess, webProcess];
let isShuttingDown = false;

function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (!isShuttingDown) {
      shutdown("SIGTERM");
    }

    if (signal) {
      process.exitCode = 1;
      return;
    }

    if (typeof code === "number" && code !== 0) {
      process.exitCode = code;
    }
  });
}
