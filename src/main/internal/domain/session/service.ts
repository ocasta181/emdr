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
  SessionStimulationSetReader,
  SessionWorkflowSnapshot
} from "./types.js";

const sessionStateNodeByState = new Map(sessionStateGraph.map((node) => [node.state, node]));
const transitionOnlyActions = new Set<SessionFlowAction>([
  "start_session",
  "approve_assessment",
  "start_stimulation",
  "pause_stimulation",
  "continue_stimulation",
  "request_grounding",
  "begin_closure",
  "request_review",
  "return_to_idle"
]);

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

function snapshot(state: SessionFlowState, activeSessionId?: string): SessionWorkflowSnapshot {
  return activeSessionId ? { state, activeSessionId } : { state };
}

export class SessionWorkflowMachine {
  private currentSnapshot: SessionWorkflowSnapshot = { state: "idle" };

  currentSessionWorkflow(): SessionWorkflowSnapshot {
    return { ...this.currentSnapshot };
  }

  reset() {
    this.currentSnapshot = { state: "idle" };
    return this.currentSessionWorkflow();
  }

  recoverActiveSession(sessionId: string, state: "preparation" | "interjection"): SessionWorkflowSnapshot {
    this.currentSnapshot = snapshot(state, sessionId);
    return this.currentSessionWorkflow();
  }

  requireCanStartSession() {
    if (!["idle", "target_selection", "post_session"].includes(this.currentSnapshot.state)) {
      throw new Error(`Cannot start a session from ${this.currentSnapshot.state}.`);
    }
  }

  startSession(sessionId: string): SessionWorkflowSnapshot {
    this.requireCanStartSession();

    if (this.currentSnapshot.state === "post_session") {
      this.apply("start_session");
    }

    if (this.currentSnapshot.state !== "idle" && this.currentSnapshot.state !== "target_selection") {
      throw new Error(`Cannot select a target from ${this.currentSnapshot.state}.`);
    }

    const nextState = nextSessionFlowState(this.currentSnapshot.state, "select_target");
    this.currentSnapshot = snapshot(nextState, sessionId);
    return this.currentSessionWorkflow();
  }

  advanceSessionFlow(action: SessionFlowAction, sessionId?: string): SessionWorkflowSnapshot {
    if (!transitionOnlyActions.has(action)) {
      throw new Error(`Action ${action} must be applied by its domain command.`);
    }

    if (action === "start_session") {
      return this.apply(action);
    }

    if (!sessionId && action === "return_to_idle" && this.currentSnapshot.state === "target_selection") {
      return this.apply(action);
    }

    if (!sessionId) {
      throw new Error(`Action ${action} requires an active session.`);
    }

    return this.applyActiveSessionAction(sessionId, action);
  }

  requireActiveSessionAction(sessionId: string, action: SessionFlowAction): SessionWorkflowSnapshot {
    const current = this.currentSessionWorkflow();

    if (current.activeSessionId !== sessionId) {
      throw new Error(`Session ${sessionId} is not the active workflow session.`);
    }

    if (!this.canApplySessionFlowAction(current.state, action)) {
      throw new Error(`Action ${action} is not allowed from ${current.state}.`);
    }

    return current;
  }

  applyActiveSessionAction(sessionId: string, action: SessionFlowAction): SessionWorkflowSnapshot {
    const current = this.requireActiveSessionAction(sessionId, action);
    return this.apply(action, current.activeSessionId);
  }

  availableSessionFlowActions(state: SessionFlowState): SessionFlowAction[] {
    return sessionStateNode(state).edges.map((edge) => edge.action);
  }

  canApplySessionFlowAction(state: SessionFlowState, action: SessionFlowAction): boolean {
    return this.availableSessionFlowActions(state).includes(action);
  }

  nextSessionFlowState(state: SessionFlowState, action: SessionFlowAction): SessionFlowState {
    return nextSessionFlowState(state, action);
  }

  private apply(action: SessionFlowAction, activeSessionId = this.currentSnapshot.activeSessionId) {
    const nextState = nextSessionFlowState(this.currentSnapshot.state, action);
    this.currentSnapshot = snapshot(
      nextState,
      nextState === "idle" || nextState === "target_selection" ? undefined : activeSessionId
    );
    return this.currentSessionWorkflow();
  }
}

export class SessionService {
  constructor(
    private readonly repo: SQLBaseRepository<Session>,
    private readonly workflow: SessionWorkflowMachine,
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
    this.workflow.requireCanStartSession();
    const aggregate = createSessionForTarget(target);
    this.repo.insert(createSessionFromAggregate(aggregate));
    this.workflow.startSession(aggregate.id);
    return aggregate;
  }

  listSessions(): SessionAggregate[] {
    return this.repo.all().map((session) => this.toAggregate(session));
  }

  recoverSessionWorkflowFromDurableState(): SessionWorkflowSnapshot {
    const unfinishedSessions = this.listSessions()
      .filter((session) => !session.endedAt)
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt));

    const activeSession = unfinishedSessions[0];
    if (!activeSession) return this.workflow.reset();

    return this.workflow.recoverActiveSession(
      activeSession.id,
      activeSession.stimulationSets.length > 0 ? "interjection" : "preparation"
    );
  }

  updateAssessment(sessionId: string, assessment: Assessment): SessionAggregate {
    const session = this.requireSession(sessionId);
    this.workflow.requireActiveSessionAction(sessionId, "update_assessment");
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
    this.workflow.applyActiveSessionAction(sessionId, "update_assessment");
    return this.toAggregate({ ...session, ...patch });
  }

  endSession(sessionId: string, patch: SessionEndPatch = {}): SessionAggregate {
    const session = this.requireSession(sessionId);
    this.workflow.requireActiveSessionAction(sessionId, "close_session");
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
    this.workflow.applyActiveSessionAction(sessionId, "close_session");
    return this.toAggregate(endedSession);
  }

  availableSessionFlowActions(state: SessionFlowState): SessionFlowAction[] {
    return this.workflow.availableSessionFlowActions(state);
  }

  nextSessionFlowState(state: SessionFlowState, action: SessionFlowAction): SessionFlowState {
    return this.workflow.nextSessionFlowState(state, action);
  }

  canApplySessionFlowAction(state: SessionFlowState, action: SessionFlowAction): boolean {
    return this.workflow.canApplySessionFlowAction(state, action);
  }

  currentSessionWorkflow(): SessionWorkflowSnapshot {
    return this.workflow.currentSessionWorkflow();
  }

  advanceSessionFlow(action: SessionFlowAction, sessionId?: string): SessionWorkflowSnapshot {
    return this.workflow.advanceSessionFlow(action, sessionId);
  }

  private toAggregate(session: Session): SessionAggregate {
    return createSessionAggregate(session, this.stimulationSets?.listBySession(session.id) ?? []);
  }
}
