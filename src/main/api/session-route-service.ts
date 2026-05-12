import { loadAppDatabase, saveAppDatabase } from "../internal/lib/store/sqlite/app-store.js";
import { createSessionForTarget } from "../internal/domain/session/factory.js";
import { sessionStateGraph } from "../internal/domain/session/flow.js";
import type { Assessment, SessionFlowAction, SessionFlowState } from "../internal/domain/session/types.js";
import { nowIso } from "../../../utils.js";
import type { SessionRouteService } from "../internal/domain/session/ipc.types.js";

export function createSessionRouteService(options: { getUserDataPath: () => string }): SessionRouteService {
  const userDataPath = options.getUserDataPath;

  return {
    async start(payload) {
      const targetId = targetIdFrom(payload);
      const database = await loadAppDatabase(userDataPath());
      const target = database.targets.find((item) => item.id === targetId);
      if (!target) {
        throw new Error(`Target not found: ${targetId}`);
      }

      const session = createSessionForTarget(target);
      await saveAppDatabase(userDataPath(), {
        ...database,
        sessions: database.sessions.concat(session)
      });
      return session;
    },

    async updateAssessment(payload) {
      const request = assessmentUpdateFrom(payload);
      const database = await loadAppDatabase(userDataPath());
      const session = database.sessions.find((item) => item.id === request.sessionId);
      if (!session) {
        throw new Error(`Session not found: ${request.sessionId}`);
      }

      const nextSession = { ...session, assessment: request.assessment };
      await saveAppDatabase(userDataPath(), {
        ...database,
        sessions: database.sessions.map((item) => (item.id === nextSession.id ? nextSession : item))
      });
      return nextSession;
    },

    transitionFlow(payload) {
      const request = flowTransitionFrom(payload);
      const node = sessionStateGraph.find((item) => item.state === request.state);
      const edge = node?.edges.find((item) => item.action === request.action);
      if (!edge) {
        throw new Error(`Action ${request.action} is not allowed from ${request.state}.`);
      }
      return { state: edge.to };
    },

    async end(payload) {
      const request = endSessionRequestFrom(payload);
      const database = await loadAppDatabase(userDataPath());
      const session = database.sessions.find((item) => item.id === request.sessionId);
      if (!session) {
        throw new Error(`Session not found: ${request.sessionId}`);
      }

      const endedSession = {
        ...session,
        endedAt: nowIso(),
        finalDisturbance: request.finalDisturbance ?? session.finalDisturbance,
        notes: request.notes ?? session.notes
      };
      await saveAppDatabase(userDataPath(), {
        ...database,
        sessions: database.sessions.map((item) => (item.id === endedSession.id ? endedSession : item))
      });
      return endedSession;
    }
  };
}

function targetIdFrom(payload: unknown) {
  if (typeof payload === "string") return payload;
  return requiredString(recordFrom(payload), "targetId");
}

function assessmentUpdateFrom(payload: unknown) {
  const value = recordFrom(payload);
  return {
    sessionId: requiredString(value, "sessionId"),
    assessment: assessmentFrom(value.assessment)
  };
}

function assessmentFrom(payload: unknown): Assessment {
  const value = recordFrom(payload);
  return {
    image: optionalString(value, "image"),
    negativeCognition: requiredString(value, "negativeCognition"),
    positiveCognition: requiredString(value, "positiveCognition"),
    believability: optionalNumber(value, "believability"),
    emotions: optionalString(value, "emotions"),
    disturbance: optionalNumber(value, "disturbance"),
    bodyLocation: optionalString(value, "bodyLocation")
  };
}

function flowTransitionFrom(payload: unknown) {
  const value = recordFrom(payload);
  return {
    state: sessionFlowStateFrom(requiredString(value, "state")),
    action: sessionFlowActionFrom(requiredString(value, "action"))
  };
}

function endSessionRequestFrom(payload: unknown) {
  if (typeof payload === "string") {
    return { sessionId: payload };
  }
  const value = recordFrom(payload);
  return {
    sessionId: requiredString(value, "sessionId"),
    finalDisturbance: optionalNumber(value, "finalDisturbance"),
    notes: optionalString(value, "notes")
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

function optionalString(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return typeof field === "string" ? field : undefined;
}

function optionalNumber(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return typeof field === "number" ? field : undefined;
}

function sessionFlowStateFrom(value: string): SessionFlowState {
  if (
    value === "idle" ||
    value === "target_selection" ||
    value === "preparation" ||
    value === "stimulation" ||
    value === "interjection" ||
    value === "closure" ||
    value === "review" ||
    value === "post_session"
  ) {
    return value;
  }
  throw new Error(`Unknown session flow state: ${value}`);
}

function sessionFlowActionFrom(value: string): SessionFlowAction {
  if (
    value === "start_session" ||
    value === "select_target" ||
    value === "create_target_draft" ||
    value === "update_assessment" ||
    value === "approve_assessment" ||
    value === "start_stimulation" ||
    value === "pause_stimulation" ||
    value === "log_stimulation_set" ||
    value === "continue_stimulation" ||
    value === "request_grounding" ||
    value === "begin_closure" ||
    value === "request_review" ||
    value === "close_session" ||
    value === "return_to_idle"
  ) {
    return value;
  }
  throw new Error(`Unknown session flow action: ${value}`);
}
