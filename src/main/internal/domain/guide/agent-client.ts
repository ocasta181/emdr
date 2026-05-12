import { randomUUID } from "node:crypto";
import type { AgentSidecar } from "../../lib/agent/index.js";
import type {
  GuideActionProposal,
  GuideAgentContext,
  GuideAgentPort,
  GuideAgentResponse,
  GuideSessionFlowState
} from "./types.js";

const guideSessionFlowStates = new Set<GuideSessionFlowState>([
  "idle",
  "target_selection",
  "preparation",
  "stimulation",
  "interjection",
  "closure",
  "review",
  "post_session"
]);

export class GuideAgentSidecarClient implements GuideAgentPort {
  constructor(private readonly sidecar: AgentSidecar) {}

  async respond(context: GuideAgentContext): Promise<GuideAgentResponse> {
    await this.sidecar.start();
    const response = await this.sidecar.request({
      id: randomUUID(),
      type: "guide:message",
      payload: context
    });

    if (!response.ok) {
      throw new Error(response.error);
    }

    return guideAgentResponseFrom(response.payload);
  }
}

function guideAgentResponseFrom(payload: unknown): GuideAgentResponse {
  const value = recordFrom(payload, "agent response");
  const messages = arrayFrom(value.messages, "messages").map((message) => stringFrom(message, "message"));
  const proposals = arrayFrom(value.proposals ?? [], "proposals").map(guideActionProposalFrom);
  return { messages, proposals };
}

function guideActionProposalFrom(payload: unknown): GuideActionProposal {
  const value = recordFrom(payload, "proposal");
  const type = stringFrom(value.type, "proposal.type");
  const sessionId = stringFrom(value.sessionId, "proposal.sessionId");
  const workflowState = workflowStateFrom(value.workflowState);

  if (type === "log_stimulation_set") {
    return {
      type,
      sessionId,
      workflowState,
      cycleCount: numberFrom(value.cycleCount, "proposal.cycleCount"),
      observation: stringFrom(value.observation, "proposal.observation"),
      disturbance: optionalNumberFrom(value.disturbance, "proposal.disturbance")
    };
  }

  if (type === "end_session") {
    return {
      type,
      sessionId,
      workflowState,
      finalDisturbance: optionalNumberFrom(value.finalDisturbance, "proposal.finalDisturbance"),
      notes: optionalStringFrom(value.notes, "proposal.notes")
    };
  }

  throw new Error(`Unknown guide action proposal type: ${type}.`);
}

function recordFrom(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an object.`);
  }
  return value as Record<string, unknown>;
}

function arrayFrom(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an array.`);
  }
  return value;
}

function stringFrom(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`Expected ${label} to be a string.`);
  }
  return value;
}

function optionalStringFrom(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  return stringFrom(value, label);
}

function numberFrom(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected ${label} to be a finite number.`);
  }
  return value;
}

function optionalNumberFrom(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  return numberFrom(value, label);
}

function workflowStateFrom(value: unknown): GuideSessionFlowState {
  const state = stringFrom(value, "proposal.workflowState");
  if (!guideSessionFlowStates.has(state as GuideSessionFlowState)) {
    throw new Error(`Unknown guide workflow state: ${state}.`);
  }
  return state as GuideSessionFlowState;
}
