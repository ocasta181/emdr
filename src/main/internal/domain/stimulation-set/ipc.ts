import type { ApiRegistry } from "../../../api/types.js";
import {
  optionalNumberInRange,
  recordFrom,
  requiredNumberInRange,
  requiredString
} from "../../lib/ipc/payload.js";
import type { StimulationSetDraft, StimulationSetIpcService } from "./types.js";

const disturbanceRange = { min: 0, max: 10 };

export function registerStimulationSetIpc(registry: ApiRegistry, service: StimulationSetIpcService) {
  registry.handle("stimulation-set:list-by-session", async (payload) =>
    service.listBySession(sessionIdFrom(payload))
  );
  registry.handle("stimulation-set:log", async (payload) => service.logStimulationSet(stimulationSetDraftFrom(payload)));
}

function sessionIdFrom(payload: unknown) {
  if (typeof payload === "string") return payload;
  return requiredString(recordFrom(payload), "sessionId");
}

function stimulationSetDraftFrom(payload: unknown): StimulationSetDraft {
  const value = recordFrom(payload);
  return {
    sessionId: requiredString(value, "sessionId"),
    cycleCount: requiredNumberInRange(value, "cycleCount", { min: 1, max: 10000 }),
    observation: requiredString(value, "observation"),
    disturbance: optionalNumberInRange(value, "disturbance", disturbanceRange)
  };
}
