import type { StimulationSetRouteService } from "../internal/domain/stimulation-set/ipc.types.js";
import { mutateAppDatabase, readFromAppDatabase } from "../internal/lib/store/sqlite/app-store.js";
import type { CreateDomainServices } from "./domain-services.types.js";

export function createStimulationSetRouteService(options: {
  getUserDataPath: () => string;
  createServices: CreateDomainServices;
}): StimulationSetRouteService {
  const userDataPath = options.getUserDataPath;

  return {
    async listBySession(payload) {
      const sessionId = sessionIdFrom(payload);
      return readFromAppDatabase(userDataPath(), (db) =>
        options.createServices(db).stimulationSets.listBySession(sessionId)
      );
    },

    async log(payload) {
      const draft = stimulationSetDraftFrom(payload);
      return mutateAppDatabase(userDataPath(), (db) =>
        options.createServices(db).stimulationSets.logStimulationSet(draft)
      );
    }
  };
}

function sessionIdFrom(payload: unknown) {
  if (typeof payload === "string") return payload;
  return requiredString(recordFrom(payload), "sessionId");
}

function stimulationSetDraftFrom(payload: unknown) {
  const value = recordFrom(payload);
  return {
    sessionId: requiredString(value, "sessionId"),
    cycleCount: requiredNumber(value, "cycleCount"),
    observation: requiredString(value, "observation"),
    disturbance: optionalNumber(value, "disturbance")
  };
}

function recordFrom(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an object payload.");
  }
  return value as Record<string, unknown>;
}

function requiredString(value: Record<string, unknown>, key: string) {
  const field = value[key];
  if (typeof field !== "string") {
    throw new Error(`Expected ${key} to be a string.`);
  }
  return field;
}

function requiredNumber(value: Record<string, unknown>, key: string) {
  const field = value[key];
  if (typeof field !== "number") {
    throw new Error(`Expected ${key} to be a number.`);
  }
  return field;
}

function optionalNumber(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return typeof field === "number" ? field : undefined;
}
