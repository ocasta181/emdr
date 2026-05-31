import type { ApiRegistry } from "../../../api/types.js";
import { recordFrom, requiredString } from "../../lib/ipc/payload.js";
import type { SpeechIpcService, SpeechSynthesisRequest } from "./types.js";

export function registerSpeechIpc(registry: ApiRegistry, service: SpeechIpcService) {
  registry.handle("speech:voices", async () => service.listVoices());
  registry.handle("speech:synthesize", async (payload) => service.synthesize(speechSynthesisRequestFrom(payload)));
}

function speechSynthesisRequestFrom(payload: unknown): SpeechSynthesisRequest {
  const value = recordFrom(payload);
  return {
    text: requiredString(value, "text"),
    voiceId: requiredString(value, "voiceId")
  };
}
