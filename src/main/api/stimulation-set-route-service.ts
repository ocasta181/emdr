import { loadAppDatabase, saveAppDatabase } from "../internal/lib/store/sqlite/app-store.js";
import { createStimulationSet } from "../../../domain/stimulation-set/factory.js";
import type { StimulationSetRouteService } from "../internal/domain/stimulation-set/ipc.types.js";

export function createStimulationSetRouteService(options: {
  getUserDataPath: () => string;
}): StimulationSetRouteService {
  const userDataPath = options.getUserDataPath;

  return {
    async listBySession(payload) {
      const sessionId = sessionIdFrom(payload);
      const database = await loadAppDatabase(userDataPath());
      const session = database.sessions.find((item) => item.id === sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      return session.stimulationSets;
    },

    async log(payload) {
      const draft = stimulationSetDraftFrom(payload);
      const database = await loadAppDatabase(userDataPath());
      const session = database.sessions.find((item) => item.id === draft.sessionId);
      if (!session) {
        throw new Error(`Session not found: ${draft.sessionId}`);
      }

      const set = createStimulationSet({
        ...draft,
        setNumber: session.stimulationSets.length + 1
      });
      const nextSession = {
        ...session,
        stimulationSets: session.stimulationSets.concat(set)
      };

      await saveAppDatabase(userDataPath(), {
        ...database,
        sessions: database.sessions.map((item) => (item.id === nextSession.id ? nextSession : item))
      });
      return set;
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
