import { randomUUID } from "node:crypto";
import type { AgentSidecar } from "../../lib/agent/index.js";
import type { SpeechSynthesisRequest, SpeechSynthesisResponse, SpeechSynthesizer } from "./types.js";

export class QwenTtsSidecarClient implements SpeechSynthesizer {
  constructor(private readonly sidecar: AgentSidecar) {}

  async synthesize(request: SpeechSynthesisRequest): Promise<SpeechSynthesisResponse> {
    await this.sidecar.start();
    const response = await this.sidecar.request({
      id: randomUUID(),
      type: "speech:synthesize",
      payload: request
    });

    if (!response.ok) {
      throw new Error(response.error);
    }

    return speechSynthesisResponseFrom(response.payload);
  }
}

function speechSynthesisResponseFrom(payload: unknown): SpeechSynthesisResponse {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Expected speech synthesis response to be an object.");
  }

  const value = payload as Record<string, unknown>;
  if (value.mimeType !== "audio/wav") {
    throw new Error("Expected speech synthesis response MIME type to be audio/wav.");
  }

  if (typeof value.audioBase64 !== "string") {
    throw new Error("Expected speech synthesis response audioBase64 to be a string.");
  }

  return {
    mimeType: value.mimeType,
    audioBase64: value.audioBase64
  };
}
