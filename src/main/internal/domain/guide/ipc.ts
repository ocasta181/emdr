import type { ApiRegistry } from "../../../api/types.js";
import {
  optionalNumberInRange,
  optionalString,
  recordFrom,
  requiredNumberInRange,
  requiredString,
  requiredStringEnum
} from "../../lib/ipc/payload.js";
import type { GuideActionProposal, GuideIpcService, GuideSessionFlowState, GuideViewRequest } from "./types.js";

const guideActionTypes = ["log_stimulation_set", "end_session"] as const;
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

const disturbanceRange = { min: 0, max: 10 };

export function registerGuideIpc(registry: ApiRegistry, service: GuideIpcService) {
  registry.handle("guide:view", async (payload) => service.getView(guideViewRequestFrom(payload)));
  registry.handle("guide:apply-action", async (payload) => service.applyAction(guideActionProposalFrom(payload)));
}

function guideViewRequestFrom(payload: unknown): GuideViewRequest {
  if (payload === undefined || payload === null) return {};

  const value = recordFrom(payload);
  return {
    activeSessionId: optionalString(value, "activeSessionId")
  };
}

function guideActionProposalFrom(payload: unknown): GuideActionProposal {
  const value = recordFrom(payload);
  const type = requiredStringEnum(value, "type", guideActionTypes, "a guide action type");

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
