import type { SQLBaseRepository } from "../../core/internal/repository/base.js";
import { nowIso } from "../../utils.js";
import type { Target } from "../target/entity.js";
import type { Session } from "./entity.js";
import { createSessionForTarget, createSessionFromAggregate } from "./factory.js";
import { sessionStateGraph } from "./flow.js";
import type { SessionFlowAction, SessionFlowState, SessionStateNode } from "./types.js";

export function startSession(repo: SQLBaseRepository<Session>, target: Target): Session {
  const aggregate = createSessionForTarget(target);
  const session = createSessionFromAggregate(aggregate);
  repo.insert(session);
  return session;
}

export function endSession(repo: SQLBaseRepository<Session>, sessionId: string): Session {
  const session = repo.find(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  repo.update(sessionId, { endedAt: nowIso() } as Partial<Session>);
  return { ...session, endedAt: nowIso() };
}

const sessionStateNodeByState = new Map(sessionStateGraph.map((node) => [node.state, node]));

function sessionStateNode(state: SessionFlowState): SessionStateNode {
  const node = sessionStateNodeByState.get(state);
  if (!node) {
    throw new Error(`Unknown session flow state: ${state}`);
  }
  return node;
}

export function availableSessionFlowActions(state: SessionFlowState): SessionFlowAction[] {
  return sessionStateNode(state).edges.map((edge) => edge.action);
}

export function nextSessionFlowState(state: SessionFlowState, action: SessionFlowAction): SessionFlowState {
  const edge = sessionStateNode(state).edges.find((item) => item.action === action);
  if (!edge) {
    throw new Error(`Action ${action} is not allowed from ${state}.`);
  }
  return edge.to;
}

export function canApplySessionFlowAction(state: SessionFlowState, action: SessionFlowAction): boolean {
  return availableSessionFlowActions(state).includes(action);
}
