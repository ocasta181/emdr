export type AgentHealthStatus = "stopped" | "starting" | "ready" | "unhealthy";

export type AgentHealth = {
  status: AgentHealthStatus;
  detail?: string;
};

export type AgentRuntimeConfig = {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  model?: string;
  startupTimeoutMs?: number;
  shutdownTimeoutMs?: number;
};

export type AgentRequest = {
  id: string;
  type: string;
  payload?: unknown;
};

export type AgentResponse =
  | {
      id: string;
      ok: true;
      payload?: unknown;
    }
  | {
      id: string;
      ok: false;
      error: string;
    };

export type AgentHealthCheck = () => AgentHealth | Promise<AgentHealth>;

export type AgentTransport = {
  request(request: AgentRequest): Promise<AgentResponse>;
  health?(): AgentHealth | Promise<AgentHealth>;
  close(): void | Promise<void>;
};
