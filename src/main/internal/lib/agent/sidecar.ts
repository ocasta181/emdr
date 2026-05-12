import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import process from "node:process";
import type { AgentHealth, AgentHealthCheck, AgentRequest, AgentResponse, AgentRuntimeConfig, AgentTransport } from "./types.js";

export class AgentSidecar {
  private child: ChildProcessWithoutNullStreams | undefined;
  private transport: AgentTransport | undefined;

  constructor(
    private readonly config: AgentRuntimeConfig,
    private readonly healthCheck?: AgentHealthCheck,
    private readonly createTransport?: (child: ChildProcessWithoutNullStreams) => AgentTransport
  ) {}

  async start() {
    if (this.child) return;

    const child = spawn(this.config.command, this.config.args ?? [], {
      cwd: this.config.cwd,
      env: { ...process.env, ...this.config.env },
      stdio: "pipe"
    });
    this.child = child;
    this.transport = this.createTransport?.(child);
    child.once("exit", () => {
      this.transport = undefined;
      this.child = undefined;
    });

    await waitForStartup(() => this.health(), this.config.startupTimeoutMs ?? 1000);
  }

  async request(request: AgentRequest): Promise<AgentResponse> {
    if (!this.transport) {
      throw new Error("Agent transport is unavailable.");
    }

    const health = await this.health();
    if (health.status !== "ready") {
      throw new Error(`Agent is not ready: ${health.detail ?? health.status}.`);
    }

    return this.transport.request(request);
  }

  async health(): Promise<AgentHealth> {
    if (!this.child) return { status: "stopped" };
    if (this.child.exitCode !== null || this.child.signalCode !== null) return { status: "stopped" };
    if (this.healthCheck) return this.healthCheck();
    if (this.transport?.health) return this.transport.health();
    return { status: "ready" };
  }

  async stop() {
    const child = this.child;
    if (!child) return;

    await this.transport?.close();
    child.kill("SIGTERM");

    try {
      await waitForExit(child, this.config.shutdownTimeoutMs ?? 1000);
    } catch {
      child.kill("SIGKILL");
      await waitForExit(child, this.config.shutdownTimeoutMs ?? 1000);
    } finally {
      this.transport = undefined;
      this.child = undefined;
    }
  }
}

async function waitForStartup(health: () => Promise<AgentHealth>, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const current = await health();
    if (current.status === "ready") return;
    if (current.status === "unhealthy") {
      throw new Error(`Agent failed health check: ${current.detail ?? "unhealthy"}.`);
    }
    await delay(25);
  }

  throw new Error("Agent startup timed out.");
}

function waitForExit(child: ChildProcessWithoutNullStreams, timeoutMs: number) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.off("exit", handleExit);
      reject(new Error("Agent shutdown timed out."));
    }, timeoutMs);

    function handleExit() {
      clearTimeout(timeout);
      resolve();
    }

    child.once("exit", handleExit);
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
