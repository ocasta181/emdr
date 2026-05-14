import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function defaultTestRunId(cwd = process.cwd(), pid = process.pid, now = new Date()) {
  return sanitizeRunId(`${path.basename(cwd)}-${Math.floor(now.getTime() / 1000)}-${pid}`);
}

export function normalizeRunId(raw, name = "TEST_RUN_ID") {
  const value = stripAssignment(raw, name)?.trim();
  if (!value) return undefined;

  const sanitized = sanitizeRunId(value);
  if (sanitized !== value) {
    throw new Error(`${name} may only contain letters, numbers, dot, underscore, and dash: ${value}`);
  }

  return value;
}

export function resolveRunPaths(testRunId, root = repoRoot) {
  return {
    testRunId,
    repoRoot: root,
    tmpRoot: path.join(root, ".tmp"),
    runDir: path.join(root, ".tmp", "runs", testRunId),
    pidsDir: path.join(root, ".tmp", "runs", testRunId, "pids"),
    electronUserDataPath: path.join(root, ".tmp", "electron", testRunId)
  };
}

export async function createRunContext({ root = repoRoot } = {}) {
  const testRunId = normalizeRunId(process.env.TEST_RUN_ID) ?? defaultTestRunId(root);
  const paths = resolveRunPaths(testRunId, root);

  await mkdir(paths.pidsDir, { recursive: true });
  await mkdir(paths.electronUserDataPath, { recursive: true });

  process.env.TEST_RUN_ID = testRunId;
  process.env.EMDR_LOCAL_USER_DATA_PATH = paths.electronUserDataPath;

  const context = {
    ...paths,
    createdAt: new Date().toISOString()
  };

  await writeFile(
    path.join(paths.runDir, "run.json"),
    JSON.stringify(
      {
        testRunId,
        repoRoot: root,
        cwd: process.cwd(),
        electronUserDataPath: paths.electronUserDataPath,
        createdAt: context.createdAt
      },
      null,
      2
    )
  );

  return context;
}

export function createRunEnv(context, extra = {}) {
  return {
    ...process.env,
    TEST_RUN_ID: context.testRunId,
    EMDR_LOCAL_USER_DATA_PATH: context.electronUserDataPath,
    ...extra
  };
}

export async function recordCurrentProcess(context, role) {
  await recordProcess(context, role, process.pid, {
    command: process.argv.join(" "),
    cwd: process.cwd(),
    env: process.env
  });
}

export async function recordProcess(context, role, pid, details = {}) {
  const fileName = `${role}-${pid}.json`;
  await mkdir(context.pidsDir, { recursive: true });
  await writeFile(
    path.join(context.pidsDir, fileName),
    JSON.stringify(
      {
        testRunId: context.testRunId,
        role,
        pid,
        cwd: details.cwd ?? process.cwd(),
        command: details.command ?? "",
        argv: details.argv ?? [],
        env: selectedEnv(details.env ?? process.env),
        recordedAt: new Date().toISOString()
      },
      null,
      2
    )
  );
}

function selectedEnv(env) {
  return {
    TEST_RUN_ID: env.TEST_RUN_ID,
    EMDR_LOCAL_USER_DATA_PATH: env.EMDR_LOCAL_USER_DATA_PATH,
    VITE_DEV_SERVER_URL: env.VITE_DEV_SERVER_URL
  };
}

function sanitizeRunId(value) {
  return value.replace(/[^A-Za-z0-9_.-]/g, "-").replace(/-+/g, "-").slice(0, 120);
}

function stripAssignment(value, name) {
  if (!value) return undefined;
  return value.startsWith(`${name}=`) ? value.slice(name.length + 1) : value;
}
