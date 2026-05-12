import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import type { Interface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { AgentHealth, AgentRequest, AgentResponse, AgentTransport } from "./types.js";

export class JsonLineAgentTransport implements AgentTransport {
  private readonly lines: Interface;
  private readonly pending = new Map<
    string,
    {
      resolve(response: AgentResponse): void;
      reject(error: Error): void;
    }
  >();

  constructor(
    input: Readable,
    private readonly output: Writable
  ) {
    this.lines = createInterface({ input });
    this.lines.on("line", (line) => this.handleLine(line));
    this.lines.on("close", () => this.rejectPending(new Error("Agent transport closed.")));
  }

  request(request: AgentRequest): Promise<AgentResponse> {
    return new Promise((resolve, reject) => {
      this.pending.set(request.id, { resolve, reject });
      this.output.write(`${JSON.stringify(request)}\n`, (error) => {
        if (!error) return;

        this.pending.delete(request.id);
        reject(error);
      });
    });
  }

  requestPayload(type: string, payload?: unknown): Promise<AgentResponse> {
    return this.request({ id: randomUUID(), type, payload });
  }

  health(): AgentHealth {
    return { status: "ready" };
  }

  close() {
    this.lines.close();
    this.rejectPending(new Error("Agent transport closed."));
  }

  private handleLine(line: string) {
    let response: AgentResponse;
    try {
      response = JSON.parse(line) as AgentResponse;
    } catch {
      this.rejectPending(new Error("Agent returned invalid JSON."));
      return;
    }

    const pending = this.pending.get(response.id);
    if (!pending) return;

    this.pending.delete(response.id);
    pending.resolve(response);
  }

  private rejectPending(error: Error) {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}
