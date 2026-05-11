import type { Database } from "../app/types.js";
import { sessionFlowDefinitions } from "./flow.js";
import type { SessionAggregate, SessionFlowAction, SessionFlowState, SessionFlowStateDetails } from "./types.js";
import type { Target } from "../target/entity.js";
import { createSessionForTarget } from "./factory.js";
import { reviseTarget } from "../target/service.js";
import { replaceById, nowIso } from "../../utils.js";

export const sessionFlowStateDetails = [
  {
    state: "idle",
    label: "Idle",
    description: "No active session is running."
  },
  {
    state: "target_selection",
    label: "Target Selection",
    description: "Choose an existing target or create a draft target for review."
  },
  {
    state: "preparation",
    label: "Preparation",
    description: "Capture and review the session assessment before stimulation."
  },
  {
    state: "stimulation",
    label: "Stimulation",
    description: "Run visual bilateral stimulation and log set observations."
  },
  {
    state: "interjection",
    label: "Pause",
    description: "Pause, ground, continue stimulation, or begin closure."
  },
  {
    state: "closure",
    label: "Closure",
    description: "Capture final disturbance and session notes."
  },
  {
    state: "review",
    label: "Review",
    description: "Review the structured session summary before saving the end state."
  },
  {
    state: "post_session",
    label: "Post-session",
    description: "The session has ended and the app can return to idle."
  }
] satisfies SessionFlowStateDetails[];

export const sessionFlowStateLabels = Object.fromEntries(
  sessionFlowStateDetails.map((definition) => [definition.state, definition.label])
) as Record<SessionFlowState, string>;

const sessionFlowDefinitionByState = new Map(sessionFlowDefinitions.map((definition) => [definition.state, definition]));
const sessionFlowDetailsByState = new Map(sessionFlowStateDetails.map((definition) => [definition.state, definition]));

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
