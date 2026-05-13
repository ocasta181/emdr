import type { ApiRegistry } from "../../../api/types.js";
import {
  optionalNumberInRange,
  optionalString,
  recordFrom,
  requiredNumberInRange,
  requiredRecord,
  requiredString,
  requiredStringEnum
} from "../../lib/ipc/payload.js";
import type {
  GuideActionProposal,
  GuideAdvanceSessionFlowAction,
  GuideIpcService,
  GuideSessionFlowState,
  GuideViewRequest
} from "./types.js";

const guideActionTypes = [
  "create_target_draft",
  "update_assessment",
  "advance_session_flow",
  "log_stimulation_set",
  "end_session"
] as const;
const guideSessionFlowStates = [
  "idle",
  "target_selection",
  "preparation",
  "stimulation",
  "interjection",
  "closure",
  "review",
  "post_session"
] as const satisfies readonly GuideSessionFlowState[];
const guideAdvanceSessionFlowActions = [
  "continue_stimulation",
  "request_grounding",
  "begin_closure",
  "request_review"
] as const satisfies readonly GuideAdvanceSessionFlowAction[];

const disturbanceRange = { min: 0, max: 10 };
const believabilityRange = { min: 1, max: 7 };

export function registerGuideIpc(registry: ApiRegistry, service: GuideIpcService) {
  registry.handle("guide:view", async (payload) => service.getView(guideViewRequestFrom(payload)));
  registry.handle("guide:message", async (payload) => service.respondToMessage(guideMessageRequestFrom(payload)));
  registry.handle("guide:apply-action", async (payload) => service.applyAction(guideActionProposalFrom(payload)));
}

function guideViewRequestFrom(payload: unknown): GuideViewRequest {
  if (payload === undefined || payload === null) return {};

  const value = recordFrom(payload);
  return {
    activeSessionId: optionalString(value, "activeSessionId")
  };
}

function guideMessageRequestFrom(payload: unknown) {
  const value = recordFrom(payload);
  return {
    activeSessionId: optionalString(value, "activeSessionId"),
    message: requiredString(value, "message")
  };
}

function guideActionProposalFrom(payload: unknown): GuideActionProposal {
  const value = recordFrom(payload);
  const type = requiredStringEnum(value, "type", guideActionTypes, "a guide action type");

  if (type === "create_target_draft") {
    return {
      type,
      workflowState: requiredStringEnum(value, "workflowState", guideSessionFlowStates, "a session flow state"),
      description: requiredString(value, "description"),
      negativeCognition: optionalString(value, "negativeCognition"),
      positiveCognition: optionalString(value, "positiveCognition")
    };
  }

  if (type === "update_assessment") {
    return {
      type,
      sessionId: requiredString(value, "sessionId"),
      workflowState: requiredStringEnum(value, "workflowState", guideSessionFlowStates, "a session flow state"),
      assessment: assessmentPatchFrom(requiredRecord(value, "assessment"))
    };
  }

  if (type === "advance_session_flow") {
    return {
      type,
      sessionId: requiredString(value, "sessionId"),
      workflowState: requiredStringEnum(value, "workflowState", guideSessionFlowStates, "a session flow state"),
      action: requiredStringEnum(
        value,
        "action",
        guideAdvanceSessionFlowActions,
        "an allowed guide session flow action"
      )
    };
  }

  if (type === "log_stimulation_set") {
    return {
      type,
      sessionId: requiredString(value, "sessionId"),
      workflowState: requiredStringEnum(value, "workflowState", guideSessionFlowStates, "a session flow state"),
      cycleCount: requiredNumberInRange(value, "cycleCount", { min: 1, max: 10000 }),
      observation: requiredString(value, "observation"),
      disturbance: optionalNumberInRange(value, "disturbance", disturbanceRange)
    };
  }

  return {
    type,
    sessionId: requiredString(value, "sessionId"),
    workflowState: requiredStringEnum(value, "workflowState", guideSessionFlowStates, "a session flow state"),
    finalDisturbance: optionalNumberInRange(value, "finalDisturbance", disturbanceRange),
    notes: optionalString(value, "notes")
  };
}

function assessmentPatchFrom(value: Record<string, unknown>) {
  return {
    image: optionalString(value, "image"),
    negativeCognition: optionalString(value, "negativeCognition"),
    positiveCognition: optionalString(value, "positiveCognition"),
    believability: optionalNumberInRange(value, "believability", believabilityRange),
    emotions: optionalString(value, "emotions"),
    disturbance: optionalNumberInRange(value, "disturbance", disturbanceRange),
    bodyLocation: optionalString(value, "bodyLocation")
  };
}
