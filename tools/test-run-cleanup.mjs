import { execFile } from "node:child_process";
import { readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { normalizeRunId, repoRoot, resolveRunPaths } from "./qa-run-context.mjs";

const execFileAsync = promisify(execFile);
const command = process.argv[2];
const cliEnv = parseAssignments(process.argv.slice(3));
const force = readBoolean("FORCE");
const dryRun = readBoolean("DRY_RUN");

if (command === "cleanup-run") {
  const testRunId = normalizeRunId(cliEnv.TEST_RUN_ID ?? process.env.TEST_RUN_ID);
  if (!testRunId) {
    throw new Error("TEST_RUN_ID is required. Example: just cleanup-run TEST_RUN_ID=emdr-123");
  }
  await cleanupRun(testRunId);
} else if (command === "cleanup-stale-runs") {
  await cleanupStaleRuns();
} else {
  console.error("Usage: node tools/test-run-cleanup.mjs <cleanup-run|cleanup-stale-runs>");
  process.exit(1);
}

async function cleanupRun(testRunId) {
  const paths = resolveRunPaths(testRunId, repoRoot);
  console.log(`Cleanup candidate run: ${testRunId}`);

  const records = await readPidRecords(paths);
  for (const record of records) {
    await cleanupPid(record, paths);
  }

  const pathCandidates = [paths.electronUserDataPath, paths.runDir];
  console.log("Cleanup candidate paths:");
  for (const candidate of pathCandidates) {
    console.log(`  ${candidate}`);
  }

  if (dryRun) return;

  for (const candidate of pathCandidates) {
    assertScopedTmpPath(candidate, paths);
    await rm(candidate, { recursive: true, force: true });
  }
}

async function cleanupStaleRuns() {
  const maxAgeHours = Number(cliEnv.STALE_RUN_AGE_HOURS ?? process.env.STALE_RUN_AGE_HOURS ?? 24);
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) {
    throw new Error("STALE_RUN_AGE_HOURS must be a positive number.");
  }

  const runsRoot = path.join(repoRoot, ".tmp", "runs");
  const entries = await readdir(runsRoot, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const cutoffMs = Date.now() - maxAgeHours * 60 * 60 * 1000;
  console.log(`Stale run threshold: ${maxAgeHours} hours`);

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const testRunId = safeRunDirName(entry.name);
    if (!testRunId) continue;

    const runDir = path.join(runsRoot, testRunId);
    const info = await stat(runDir);
    if (info.mtimeMs > cutoffMs) continue;

    await cleanupRun(testRunId);
  }
}

async function cleanupPid(record, paths) {
  if (record.testRunId !== paths.testRunId) {
    console.log(`Skipping PID ${record.pid}: pid file is tagged for ${record.testRunId}.`);
    return;
  }

  const live = await readLiveProcess(record.pid);
  console.log("Cleanup candidate PID:");
  console.log(`  pid: ${record.pid}`);
  console.log(`  role: ${record.role}`);
  console.log(`  recorded command: ${record.command}`);
  console.log(`  live command: ${live?.command ?? "<not running>"}`);
  console.log(`  live cwd: ${live?.cwd ?? "<unknown>"}`);

  if (!live) return;

  if (!matchesRunOrRepo(live, paths)) {
    console.log(`Skipping PID ${record.pid}: live command/env/cwd does not match this repo or run id.`);
    return;
  }

  if (dryRun) return;

  console.log(`Killing PID ${record.pid} with SIGTERM.`);
  if (!sendSignal(record.pid, "SIGTERM")) return;
  const exited = await waitForExit(record.pid, 3000);
  if (exited) return;

  if (force) {
    console.log(`Killing PID ${record.pid} with SIGKILL because FORCE=1.`);
    sendSignal(record.pid, "SIGKILL");
    await waitForExit(record.pid, 1000);
    return;
  }

  console.log(`PID ${record.pid} is still running. Re-run with FORCE=1 to send SIGKILL.`);
}

async function readPidRecords(paths) {
  const entries = await readdir(paths.pidsDir, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });

  const records = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const filePath = path.join(paths.pidsDir, entry.name);
    records.push(JSON.parse(await readFile(filePath, "utf8")));
  }
  return records;
}

async function readLiveProcess(pid) {
  if (!pid || !(await isAlive(pid))) return undefined;

  const command = await runText("ps", ["-p", String(pid), "-o", "command="]).catch(() => "");
  if (!command.trim()) return undefined;

  const env = await runText("ps", ["eww", "-p", String(pid), "-o", "command="]).catch(() => "");
  const cwd = await readProcessCwd(pid);
  return { command: command.trim(), env: env.trim(), cwd };
}

async function readProcessCwd(pid) {
  const output = await runText("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"]).catch(() => "");
  const line = output
    .split("\n")
    .find((item) => item.startsWith("n"));
  return line ? line.slice(1) : undefined;
}

async function runText(file, args) {
  const { stdout } = await execFileAsync(file, args, { maxBuffer: 1024 * 1024 });
  return stdout;
}

function matchesRunOrRepo(live, paths) {
  const haystack = [live.command, live.env, live.cwd].filter(Boolean).join("\n");
  return (
    haystack.includes(paths.testRunId) ||
    haystack.includes(paths.runDir) ||
    haystack.includes(paths.electronUserDataPath) ||
    haystack.includes(paths.repoRoot) ||
    isInside(live.cwd, paths.repoRoot)
  );
}

function assertScopedTmpPath(candidate, paths) {
  const relative = path.relative(paths.tmpRoot, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to delete path outside .tmp: ${candidate}`);
  }
}

function isInside(candidate, parent) {
  if (!candidate) return false;
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sendSignal(pid, signal) {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

async function waitForExit(pid, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!(await isAlive(pid))) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

function parseAssignments(args) {
  return Object.fromEntries(
    args
      .map((arg) => arg.split("="))
      .filter(([name, value]) => name && value !== undefined)
      .map(([name, ...value]) => [name, value.join("=")])
  );
}

function readBoolean(name) {
  const value = cliEnv[name] ?? process.env[name];
  return value === "1" || value === "true";
}

function safeRunDirName(name) {
  try {
    return normalizeRunId(name);
  } catch {
    console.log(`Skipping invalid run directory name: ${name}`);
    return undefined;
  }
}
