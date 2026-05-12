import type { SQLBaseRepository } from "../../lib/store/repository/base.js";
import { nowIso } from "../../../../../utils.js";
import type { Target } from "../target/entity.js";
import type { Session } from "./entity.js";
import { createSessionAggregate, createSessionForTarget, createSessionFromAggregate } from "./factory.js";
import { sessionStateGraph } from "./flow.js";
import type {
  Assessment,
  SessionAggregate,
  SessionEndPatch,
  SessionFlowAction,
  SessionFlowState,
  SessionStateNode,
  SessionStimulationSetReader
} from "./types.js";

const sessionStateNodeByState = new Map(sessionStateGraph.map((node) => [node.state, node]));

function sessionStateNode(state: SessionFlowState): SessionStateNode {
  const node = sessionStateNodeByState.get(state);
  if (!node) {
    throw new Error(`Unknown session flow state: ${state}`);
  }
  return node;
}

export function nextSessionFlowState(state: SessionFlowState, action: SessionFlowAction): SessionFlowState {
  const edge = sessionStateNode(state).edges.find((item) => item.action === action);
  if (!edge) {
    throw new Error(`Action ${action} is not allowed from ${state}.`);
  }
  return edge.to;
}

export class SessionService {
  constructor(
    private readonly repo: SQLBaseRepository<Session>,
    private readonly stimulationSets?: SessionStimulationSetReader
  ) {}

  requireSession(sessionId: string): Session {
    const session = this.repo.find(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  startSession(target: Target): SessionAggregate {
    const aggregate = createSessionForTarget(target);
    this.repo.insert(createSessionFromAggregate(aggregate));
    return aggregate;
  }

  listSessions(): SessionAggregate[] {
    return this.repo.all().map((session) => this.toAggregate(session));
  }

  updateAssessment(sessionId: string, assessment: Assessment): SessionAggregate {
    const session = this.requireSession(sessionId);
    const patch = {
      assessmentImage: assessment.image,
      assessmentNegativeCognition: assessment.negativeCognition,
      assessmentPositiveCognition: assessment.positiveCognition,
      assessmentBelievability: assessment.believability,
      assessmentEmotions: assessment.emotions,
      assessmentDisturbance: assessment.disturbance,
      assessmentBodyLocation: assessment.bodyLocation
    } satisfies Partial<Session>;
    this.repo.update(sessionId, patch);
    return this.toAggregate({ ...session, ...patch });
  }

  endSession(sessionId: string, patch: SessionEndPatch = {}): SessionAggregate {
    const session = this.requireSession(sessionId);
    const endedSession = {
      ...session,
      endedAt: nowIso(),
      finalDisturbance: patch.finalDisturbance ?? session.finalDisturbance,
      notes: patch.notes ?? session.notes
    };
    this.repo.update(sessionId, {
      endedAt: endedSession.endedAt,
      finalDisturbance: endedSession.finalDisturbance,
      notes: endedSession.notes
    } as Partial<Session>);
    return this.toAggregate(endedSession);
  }

  availableSessionFlowActions(state: SessionFlowState): SessionFlowAction[] {
    return sessionStateNode(state).edges.map((edge) => edge.action);
  }

  nextSessionFlowState(state: SessionFlowState, action: SessionFlowAction): SessionFlowState {
    return nextSessionFlowState(state, action);
  }

  canApplySessionFlowAction(state: SessionFlowState, action: SessionFlowAction): boolean {
    return this.availableSessionFlowActions(state).includes(action);
  }

  private toAggregate(session: Session): SessionAggregate {
    return createSessionAggregate(session, this.stimulationSets?.listBySession(session.id) ?? []);
  }
}
