import type { Database } from "../app/types.js";
import { sessionFlowDefinitions } from "./flow.js";
import type { SessionAggregate, SessionFlowAction, SessionFlowState } from "./types.js";
import type { Target } from "../target/entity.js";
import { createSessionForTarget } from "./factory.js";
import { reviseTarget } from "../target/service.js";
import { replaceById, nowIso } from "../../utils.js";

const sessionFlowDefinitionByState = new Map(sessionFlowDefinitions.map((definition) => [definition.state, definition]));

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
