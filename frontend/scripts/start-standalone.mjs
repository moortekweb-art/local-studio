import { cpSync, existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const standaloneRoot = resolve(projectRoot, ".next", "standalone");
const nestedRoot = resolve(standaloneRoot, "frontend");
const serverRoot = existsSync(nestedRoot) ? nestedRoot : standaloneRoot;
const rawPort = process.env.PORT || "4783";
const port = Number(rawPort);
const shutdownGraceMs = 5_000;
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("PORT must be an integer from 1024 through 65535");
}
const runtimeUrl = (
  process.env.LOCAL_STUDIO_AGENT_RUNTIME_URL || "http://127.0.0.1:8081"
).replace(/\/+$/, "");

function copyDirectory(from, to) {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

async function runtimeHealthy() {
  try {
    const response = await fetch(`${runtimeUrl}/health`, { signal: AbortSignal.timeout(1_000) });
    if (!response.ok) return false;
    const payload = await response.json();
    return payload.service === "local-studio-agent-runtime";
  } catch {
    return false;
  }
}

async function waitForRuntime(child) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Agent runtime exited with code ${child.exitCode}`);
    if (await runtimeHealthy()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Timed out waiting for agent runtime: ${runtimeUrl}`);
}

async function startRuntime() {
  if (await runtimeHealthy()) return null;
  const url = new URL(runtimeUrl);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`Agent runtime is unavailable: ${runtimeUrl}`);
  }
  const entry = resolve(projectRoot, "..", "services", "agent-runtime", "dist", "standalone.mjs");
  if (!existsSync(entry)) throw new Error(`Missing agent runtime bundle: ${entry}`);
  const child = spawn(process.execPath, [entry], {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: url.port || "8081",
      LOCAL_STUDIO_FRONTEND_BASE: `http://127.0.0.1:${port}`,
    },
  });
  try {
    await waitForRuntime(child);
    return child;
  } catch (error) {
    if (child.exitCode === null) child.kill("SIGTERM");
    throw error;
  }
}

if (!existsSync(standaloneRoot)) {
  throw new Error('Missing ".next/standalone". Run "npm run build" first.');
}

copyDirectory(resolve(projectRoot, "public"), resolve(serverRoot, "public"));
copyDirectory(resolve(projectRoot, ".next", "static"), resolve(serverRoot, ".next", "static"));

const agentRuntime = await startRuntime();
const server = spawn(process.execPath, ["server.js"], {
  cwd: serverRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    HOSTNAME: process.env.HOSTNAME || "127.0.0.1",
    NEXT_MANUAL_SIG_HANDLE: "1",
    PORT: String(port),
    LOCAL_STUDIO_AGENT_CWD: process.env.LOCAL_STUDIO_AGENT_CWD || resolve(projectRoot, ".."),
    LOCAL_STUDIO_AGENT_RUNTIME_URL: runtimeUrl,
  },
});
console.log(`Local Studio: http://127.0.0.1:${port}`);

function signalChild(child, signal) {
  if (child && child.exitCode === null && child.signalCode === null) child.kill(signal);
}

let runtimeExitCode = 0;
let serverExited = false;
let runtimeExited = agentRuntime === null;
let shuttingDown = false;
let shutdownTimer;

function finishShutdown() {
  if (!shuttingDown || !serverExited || !runtimeExited) return;
  clearTimeout(shutdownTimer);
  process.exit(0);
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  signalChild(agentRuntime, signal);
  signalChild(server, signal);
  shutdownTimer = setTimeout(() => {
    signalChild(agentRuntime, "SIGKILL");
    signalChild(server, "SIGKILL");
    process.exit(0);
  }, shutdownGraceMs);
}

server.on("exit", (code) => {
  serverExited = true;
  if (shuttingDown) {
    finishShutdown();
    return;
  }
  signalChild(agentRuntime, "SIGTERM");
  process.exit(runtimeExitCode || code || 0);
});
agentRuntime?.on("exit", (code) => {
  runtimeExited = true;
  if (shuttingDown) {
    finishShutdown();
    return;
  }
  runtimeExitCode = code || 1;
  signalChild(server, "SIGTERM");
});
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
