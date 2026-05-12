import type { ApiRegistry } from "../../../api/types.js";
import {
  optionalNumberInRange,
  optionalString,
  recordFrom,
  requiredString,
  requiredStringEnum
} from "../../lib/ipc/payload.js";
import type {
  Assessment,
  SessionEndRequest,
  SessionFlowAction,
  SessionFlowState,
  SessionFlowTransitionRequest,
  SessionIpcService
} from "./types.js";

const sessionFlowStates = [
  "idle",
  "target_selection",
  "preparation",
  "stimulation",
  "interjection",
  "closure",
  "review",
  "post_session"
] as const satisfies readonly SessionFlowState[];

const sessionFlowActions = [
  "start_session",
  "select_target",
  "create_target_draft",
  "update_assessment",
  "approve_assessment",
  "start_stimulation",
  "pause_stimulation",
  "log_stimulation_set",
  "continue_stimulation",
  "request_grounding",
  "begin_closure",
  "request_review",
  "close_session",
  "return_to_idle"
] as const satisfies readonly SessionFlowAction[];

const disturbanceRange = { min: 0, max: 10 };

export function registerSessionIpc(registry: ApiRegistry, service: SessionIpcService) {
  registry.handle("session:list", async () => service.listSessions());
  registry.handle("session:start", async (payload) => service.startSession(targetIdFrom(payload)));
  registry.handle("session:update-assessment", async (payload) =>
    service.updateAssessment(...assessmentUpdateArgsFrom(payload))
  );
  registry.handle("session:transition-flow", async (payload) => {
    const request = flowTransitionFrom(payload);
    return { state: await service.nextSessionFlowState(request.state, request.action) };
  });
  registry.handle("session:end", async (payload) => service.endSession(endSessionRequestFrom(payload)));
}

function targetIdFrom(payload: unknown) {
  if (typeof payload === "string") return payload;
  return requiredString(recordFrom(payload), "targetId");
}

function assessmentUpdateArgsFrom(payload: unknown): [string, Assessment] {
  const value = recordFrom(payload);
  return [requiredString(value, "sessionId"), assessmentFrom(value.assessment)];
}

function assessmentFrom(payload: unknown): Assessment {
  const value = recordFrom(payload, "assessment");
  return {
    image: optionalString(value, "image"),
    negativeCognition: requiredString(value, "negativeCognition"),
    positiveCognition: requiredString(value, "positiveCognition"),
    believability: optionalNumberInRange(value, "believability", { min: 1, max: 7 }),
    emotions: optionalString(value, "emotions"),
    disturbance: optionalNumberInRange(value, "disturbance", disturbanceRange),
    bodyLocation: optionalString(value, "bodyLocation")
  };
}

function flowTransitionFrom(payload: unknown): SessionFlowTransitionRequest {
  const value = recordFrom(payload);
  return {
    state: requiredStringEnum(value, "state", sessionFlowStates, "a session flow state"),
    action: requiredStringEnum(value, "action", sessionFlowActions, "a session flow action")
  };
}

function endSessionRequestFrom(payload: unknown): SessionEndRequest {
  if (typeof payload === "string") {
    return { sessionId: payload };
  }
  const value = recordFrom(payload);
  return {
    sessionId: requiredString(value, "sessionId"),
    finalDisturbance: optionalNumberInRange(value, "finalDisturbance", disturbanceRange),
    notes: optionalString(value, "notes")
  };
}
