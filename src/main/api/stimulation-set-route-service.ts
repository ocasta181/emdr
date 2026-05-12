import { newSessionRepository } from "../internal/domain/session/repository.js";
import { SessionService } from "../internal/domain/session/service.js";
import type { StimulationSetRouteService } from "../internal/domain/stimulation-set/ipc.types.js";
import { newStimulationSetRepository } from "../internal/domain/stimulation-set/repository.js";
import { StimulationSetService } from "../internal/domain/stimulation-set/service.js";
import { mutateAppDatabase, readFromAppDatabase } from "../internal/lib/store/sqlite/app-store.js";
import type { SqliteDatabase } from "../internal/lib/store/sqlite/connection.js";

export function createStimulationSetRouteService(options: {
  getUserDataPath: () => string;
}): StimulationSetRouteService {
  const userDataPath = options.getUserDataPath;

  return {
    async listBySession(payload) {
      const sessionId = sessionIdFrom(payload);
      return readFromAppDatabase(userDataPath(), (db) => createStimulationSetService(db).listBySession(sessionId));
    },

    async log(payload) {
      const draft = stimulationSetDraftFrom(payload);
      return mutateAppDatabase(userDataPath(), (db) => createStimulationSetService(db).logStimulationSet(draft));
    }
  };
}

function createStimulationSetService(db: SqliteDatabase) {
  return new StimulationSetService(
    newStimulationSetRepository(db),
    new SessionService(newSessionRepository(db))
  );
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
