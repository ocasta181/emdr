import type { Database } from "../app/types.js";
import { sessionFlowDefinitions } from "./flow.js";
import type {
  AgentToolName,
  SessionAggregate,
  SessionFlowAction,
  SessionFlowActionAnimationMap,
  SessionFlowAnimation,
  SessionFlowState,
  SessionFlowStateDetails
} from "./types.js";
import type { Target } from "../target/entity.js";
import { createSessionForTarget } from "./factory.js";
import { reviseTarget } from "../target/service.js";
import { replaceById, nowIso } from "../../utils.js";

export const sessionFlowStateDetails = [
  {
    state: "idle",
    label: "Idle",
    description: "No active session is running.",
    allowedAgentTools: ["create_target_draft", "select_target", "request_user_review"]
  },
  {
    state: "target_selection",
    label: "Target Selection",
    description: "Choose an existing target or create a draft target for review.",
    allowedAgentTools: ["create_target_draft", "select_target", "request_user_review"]
  },
  {
    state: "preparation",
    label: "Preparation",
    description: "Capture and review the session assessment before stimulation.",
    allowedAgentTools: ["update_session_assessment", "request_user_review", "show_grounding_prompt"]
  },
  {
    state: "stimulation",
    label: "Stimulation",
    description: "Run visual bilateral stimulation and log set observations.",
    allowedAgentTools: ["pause_stimulation", "log_stimulation_set", "show_grounding_prompt"]
  },
  {
    state: "interjection",
    label: "Pause",
    description: "Pause, ground, continue stimulation, or begin closure.",
    allowedAgentTools: ["show_grounding_prompt", "pause_stimulation", "close_session"]
  },
  {
    state: "closure",
    label: "Closure",
    description: "Capture final disturbance and session notes.",
    allowedAgentTools: ["close_session", "request_user_review", "show_grounding_prompt"]
  },
  {
    state: "review",
    label: "Review",
    description: "Review the structured session summary before saving the end state.",
    allowedAgentTools: ["request_user_review"]
  },
  {
    state: "post_session",
    label: "Post-session",
    description: "The session has ended and the app can return to idle.",
    allowedAgentTools: ["request_user_review"]
  }
] satisfies SessionFlowStateDetails[];

export const sessionFlowStateLabels = Object.fromEntries(
  sessionFlowStateDetails.map((definition) => [definition.state, definition.label])
) as Record<SessionFlowState, string>;

const sessionFlowDefinitionByState = new Map(sessionFlowDefinitions.map((definition) => [definition.state, definition]));
const sessionFlowDetailsByState = new Map(sessionFlowStateDetails.map((definition) => [definition.state, definition]));

export const sessionFlowStateAnimations = {
  idle: "idle",
  target_selection: "targets_reading",
  preparation: "guide",
  stimulation: "stimulation",
  interjection: "guide",
  closure: "guide",
  review: "history",
  post_session: "idle"
} satisfies Record<SessionFlowState, SessionFlowAnimation>;

export const sessionFlowActionAnimations: SessionFlowActionAnimationMap = {
  idle: {
    start_session: "targets_reading",
    select_target: "guide"
  },
  target_selection: {
    select_target: "guide",
    create_target_draft: "targets_writing",
    return_to_idle: "idle"
  },
  preparation: {
    update_assessment: "guide",
    approve_assessment: "stimulation",
    request_grounding: "guide",
    begin_closure: "guide"
  },
  stimulation: {
    start_stimulation: "stimulation",
    log_stimulation_set: "guide",
    pause_stimulation: "guide",
    request_grounding: "guide",
    begin_closure: "guide"
  },
  interjection: {
    continue_stimulation: "stimulation",
    request_grounding: "guide",
    begin_closure: "guide"
  },
  closure: {
    review_session: "history",
    continue_stimulation: "stimulation",
    request_grounding: "guide"
  },
  review: {
    complete_session: "idle",
    begin_closure: "guide"
  },
  post_session: {
    return_to_idle: "idle",
    start_session: "targets_reading"
  }
};

validateSessionFlowActionAnimations();

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

export function getSessionFlowStateDetails(state: SessionFlowState): SessionFlowStateDetails {
  const details = sessionFlowDetailsByState.get(state);
  if (!details) {
    throw new Error(`Unknown session flow state: ${state}`);
  }
  return details;
}

export function allowedSessionFlowActions(state: SessionFlowState): SessionFlowAction[] {
  const definition = sessionFlowDefinitionByState.get(state);
  if (!definition) {
    throw new Error(`Unknown session flow state: ${state}`);
  }
  return definition.transitions.map((transition) => transition.action);
}

export function allowedAgentTools(state: SessionFlowState): AgentToolName[] {
  return getSessionFlowStateDetails(state).allowedAgentTools;
}

export function nextSessionFlowState(state: SessionFlowState, action: SessionFlowAction): SessionFlowState {
  const definition = sessionFlowDefinitionByState.get(state);
  if (!definition) {
    throw new Error(`Unknown session flow state: ${state}`);
  }

  const transition = definition.transitions.find((item) => item.action === action);
  if (!transition) {
    throw new Error(`Action ${action} is not allowed from ${state}.`);
  }

  return transition.nextState;
}

export function canApplySessionFlowAction(state: SessionFlowState, action: SessionFlowAction): boolean {
  return allowedSessionFlowActions(state).includes(action);
}

export function animationForSessionFlowState(state: SessionFlowState): SessionFlowAnimation {
  return sessionFlowStateAnimations[state];
}

export function animationForSessionFlowAction(
  state: SessionFlowState,
  action: SessionFlowAction
): SessionFlowAnimation {
  const animation = sessionFlowActionAnimations[state][action];
  if (!animation) {
    throw new Error(`No animation is mapped for action ${action} from ${state}.`);
  }
  return animation;
}

function validateSessionFlowActionAnimations() {
  for (const definition of sessionFlowDefinitions) {
    for (const transition of definition.transitions) {
      if (!sessionFlowActionAnimations[definition.state][transition.action]) {
        throw new Error(`No animation is mapped for action ${transition.action} from ${definition.state}.`);
      }
    }
  }
}
