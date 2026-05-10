import type { Database } from "../app/types.js";
import type {
  AgentToolName,
  SessionAggregate,
  SessionFlowAction,
  SessionFlowState,
  SessionFlowStateDefinition
} from "./types.js";
import type { Target } from "../target/entity.js";
import { createSessionForTarget } from "./factory.js";
import { reviseTarget } from "../target/service.js";
import { replaceById, nowIso } from "../../utils.js";

export const sessionFlowStateLabels: Record<SessionFlowState, string> = {
  idle: "Idle",
  target_selection: "Target Selection",
  preparation: "Preparation",
  stimulation: "Stimulation",
  interjection: "Pause",
  closure: "Closure",
  review: "Review",
  post_session: "Post-session"
};

export const sessionDecisionTree: SessionFlowStateDefinition[] = [
  {
    state: "idle",
    label: sessionFlowStateLabels.idle,
    description: "No active session is running.",
    transitions: [
      { action: "start_session", nextState: "target_selection" },
      { action: "select_target", nextState: "preparation" }
    ],
    allowedAgentTools: ["create_target_draft", "select_target", "request_user_review"]
  },
  {
    state: "target_selection",
    label: sessionFlowStateLabels.target_selection,
    description: "Choose an existing target or create a draft target for review.",
    transitions: [
      { action: "select_target", nextState: "preparation" },
      { action: "create_target_draft", nextState: "target_selection" },
      { action: "return_to_idle", nextState: "idle" }
    ],
    allowedAgentTools: ["create_target_draft", "select_target", "request_user_review"]
  },
  {
    state: "preparation",
    label: sessionFlowStateLabels.preparation,
    description: "Capture and review the session assessment before stimulation.",
    transitions: [
      { action: "update_assessment", nextState: "preparation" },
      { action: "approve_assessment", nextState: "stimulation" },
      { action: "request_grounding", nextState: "interjection" },
      { action: "begin_closure", nextState: "closure" }
    ],
    allowedAgentTools: ["update_session_assessment", "request_user_review", "show_grounding_prompt"]
  },
  {
    state: "stimulation",
    label: sessionFlowStateLabels.stimulation,
    description: "Run visual bilateral stimulation and log set observations.",
    transitions: [
      { action: "start_stimulation", nextState: "stimulation" },
      { action: "log_stimulation_set", nextState: "stimulation" },
      { action: "pause_stimulation", nextState: "interjection" },
      { action: "request_grounding", nextState: "interjection" },
      { action: "begin_closure", nextState: "closure" }
    ],
    allowedAgentTools: ["pause_stimulation", "log_stimulation_set", "show_grounding_prompt"]
  },
  {
    state: "interjection",
    label: sessionFlowStateLabels.interjection,
    description: "Pause, ground, continue stimulation, or begin closure.",
    transitions: [
      { action: "continue_stimulation", nextState: "stimulation" },
      { action: "request_grounding", nextState: "interjection" },
      { action: "begin_closure", nextState: "closure" }
    ],
    allowedAgentTools: ["show_grounding_prompt", "pause_stimulation", "close_session"]
  },
  {
    state: "closure",
    label: sessionFlowStateLabels.closure,
    description: "Capture final disturbance and session notes.",
    transitions: [
      { action: "review_session", nextState: "review" },
      { action: "continue_stimulation", nextState: "stimulation" },
      { action: "request_grounding", nextState: "interjection" }
    ],
    allowedAgentTools: ["close_session", "request_user_review", "show_grounding_prompt"]
  },
  {
    state: "review",
    label: sessionFlowStateLabels.review,
    description: "Review the structured session summary before saving the end state.",
    transitions: [
      { action: "complete_session", nextState: "post_session" },
      { action: "begin_closure", nextState: "closure" }
    ],
    allowedAgentTools: ["request_user_review"]
  },
  {
    state: "post_session",
    label: sessionFlowStateLabels.post_session,
    description: "The session has ended and the app can return to idle.",
    transitions: [
      { action: "return_to_idle", nextState: "idle" },
      { action: "start_session", nextState: "target_selection" }
    ],
    allowedAgentTools: ["request_user_review"]
  }
];

const sessionDecisionTreeByState = new Map(sessionDecisionTree.map((definition) => [definition.state, definition]));

export function startSessionForTarget(database: Database, target: Target) {
  const session = createSessionForTarget(target);

  return {
    database: saveSessionDraft(database, session),
    session
  };
}

export function saveSessionDraft(database: Database, session: SessionAggregate): Database {
  return {
    ...database,
    sessions: replaceById(database.sessions, session)
  };
}

export function endSession(database: Database, session: SessionAggregate): Database {
  const ended = {
    ...session,
    endedAt: nowIso()
  };
  const target = database.targets.find((item) => item.id === ended.targetId);
  let nextDatabase = saveSessionDraft(database, ended);

  if (target && typeof ended.finalDisturbance === "number") {
    nextDatabase = reviseTarget(nextDatabase, target, { currentDisturbance: ended.finalDisturbance });
  }

  return nextDatabase;
}

export function getSessionFlowStateDefinition(state: SessionFlowState): SessionFlowStateDefinition {
  const definition = sessionDecisionTreeByState.get(state);
  if (!definition) {
    throw new Error(`Unknown session flow state: ${state}`);
  }
  return definition;
}

export function allowedSessionFlowActions(state: SessionFlowState): SessionFlowAction[] {
  return getSessionFlowStateDefinition(state).transitions.map((transition) => transition.action);
}

export function allowedAgentTools(state: SessionFlowState): AgentToolName[] {
  return getSessionFlowStateDefinition(state).allowedAgentTools;
}

export function nextSessionFlowState(state: SessionFlowState, action: SessionFlowAction): SessionFlowState {
  const transition = getSessionFlowStateDefinition(state).transitions.find((item) => item.action === action);

  if (!transition) {
    throw new Error(`Action ${action} is not allowed from ${state}.`);
  }

  return transition.nextState;
}

export function canApplySessionFlowAction(state: SessionFlowState, action: SessionFlowAction): boolean {
  return allowedSessionFlowActions(state).includes(action);
}
