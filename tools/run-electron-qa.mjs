import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import path from "node:path";
import electronPath from "electron";
import { createRunContext, createRunEnv, recordCurrentProcess, recordProcess, repoRoot } from "./qa-run-context.mjs";

const mode = process.argv[2];
const animated = process.argv.includes("--animated");
const headless = process.argv.includes("--headless") || process.env.EMDR_QA_HEADLESS === "1";
const children = new Set();

if (!["app", "dev", "smoke"].includes(mode)) {
  console.error("Usage: node tools/run-electron-qa.mjs <app|dev|smoke> [--animated] [--headless]");
  process.exit(1);
}

const context = await createRunContext({ root: repoRoot });
await recordCurrentProcess(context, "helper");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void terminateAll().finally(() => process.exit(signal === "SIGINT" ? 130 : 143));
  });
}

console.log(`TEST_RUN_ID=${context.testRunId}`);
console.log(`Run metadata: ${context.runDir}`);
console.log(`Electron user data: ${context.electronUserDataPath}`);
if (headless) console.log("Electron window mode: headless");

const exitCode =
  mode === "dev"
    ? await runDev()
    : mode === "smoke"
      ? await runElectron(["tools/smoke-electron-workflow.mjs"])
      : await runElectron([".", ...(animated ? ["--animated-ui"] : [])]);

process.exit(exitCode);

async function runDev() {
  const devServerUrl = "http://127.0.0.1:5173";
  const env = qaEnv();
  const vite = spawn(localBin("vite"), ["--host", "127.0.0.1"], {
    cwd: repoRoot,
    env,
    stdio: "inherit"
  });
  if (!vite.pid) throw new Error("Failed to start Vite dev server.");
  track(vite);
  await recordProcess(context, "dev-server", vite.pid, {
    command: `${localBin("vite")} --host 127.0.0.1`,
    argv: [localBin("vite"), "--host", "127.0.0.1"],
    cwd: repoRoot,
    env
  });

  try {
    await waitForUrl(devServerUrl, 30000);
    return await runElectron([".", ...(animated ? ["--animated-ui"] : [])], { VITE_DEV_SERVER_URL: devServerUrl });
  } finally {
    await terminate(vite);
  }
}

async function runElectron(args, extraEnv = {}) {
  const env = qaEnv(extraEnv);
  const child = spawn(electronPath, args, {
    cwd: repoRoot,
    env,
    stdio: "inherit"
  });
  if (!child.pid) throw new Error("Failed to start Electron.");
  track(child);
  await recordProcess(context, "app", child.pid, {
    command: `${electronPath} ${args.join(" ")}`,
    argv: [electronPath, ...args],
    cwd: repoRoot,
    env
  });

  const [code, signal] = await once(child, "exit");
  if (signal) {
    console.error(`Electron exited from signal ${signal}.`);
    return 1;
  }
  return code ?? 0;
}

function qaEnv(extraEnv = {}) {
  return createRunEnv(context, {
    ...(headless ? { EMDR_QA_HEADLESS: "1" } : {}),
    ...extraEnv
  });
}

function track(child) {
  children.add(child);
  child.once("exit", () => children.delete(child));
}

async function terminateAll() {
  await Promise.all([...children].map((child) => terminate(child)));
}

async function waitForUrl(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await canConnect(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}.`);
}

function canConnect(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode && response.statusCode < 500);
    });
    request.on("error", () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function terminate(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  child.kill("SIGTERM");
  const exited = await Promise.race([once(child, "exit").then(() => true), delay(3000).then(() => false)]);
  if (!exited) {
    child.kill("SIGKILL");
    await once(child, "exit");
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function localBin(name) {
  const extension = process.platform === "win32" ? ".cmd" : "";
  return path.join(repoRoot, "node_modules", ".bin", `${name}${extension}`);
}
