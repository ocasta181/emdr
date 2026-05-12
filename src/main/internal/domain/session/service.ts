import type { SQLBaseRepository } from "../../lib/store/repository/base.js";
import { nowIso } from "../../../../../utils.js";
import type { Target } from "../target/entity.js";
import type { Session } from "./entity.js";
import { createSessionForTarget, createSessionFromAggregate } from "./factory.js";
import { sessionStateGraph } from "./flow.js";
import type { SessionAggregate, SessionFlowAction, SessionFlowState, SessionStateNode } from "./types.js";

const sessionStateNodeByState = new Map(sessionStateGraph.map((node) => [node.state, node]));

function sessionStateNode(state: SessionFlowState): SessionStateNode {
  const node = sessionStateNodeByState.get(state);
  if (!node) {
    throw new Error(`Unknown session flow state: ${state}`);
  }
  return node;
}

export class SessionService {
  constructor(private readonly repo: SQLBaseRepository<Session>) {}

  startSession(target: Target): SessionAggregate {
    const aggregate = createSessionForTarget(target);
    this.repo.insert(createSessionFromAggregate(aggregate));
    return aggregate;
  }

  endSession(sessionId: string): Session {
    const session = this.repo.find(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const endedAt = nowIso();
    this.repo.update(sessionId, { endedAt } as Partial<Session>);
    return { ...session, endedAt };
  }

  availableSessionFlowActions(state: SessionFlowState): SessionFlowAction[] {
    return sessionStateNode(state).edges.map((edge) => edge.action);
  }

  nextSessionFlowState(state: SessionFlowState, action: SessionFlowAction): SessionFlowState {
    const edge = sessionStateNode(state).edges.find((item) => item.action === action);
    if (!edge) {
      throw new Error(`Action ${action} is not allowed from ${state}.`);
    }
    return edge.to;
  }

  canApplySessionFlowAction(state: SessionFlowState, action: SessionFlowAction): boolean {
    return this.availableSessionFlowActions(state).includes(action);
  }
}
