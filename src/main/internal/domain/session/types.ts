import type { StimulationSet } from "../stimulation-set/entity.js";
import type { Session } from "./entity.js";
import type { StateGraphEdge, StateGraphNode } from "../../../../../stateGraph.js";

export type Assessment = {
  image?: string;
  negativeCognition: string;
  positiveCognition: string;
  believability?: number;
  emotions?: string;
  disturbance?: number;
  bodyLocation?: string;
};

export type SessionAggregate = Omit<
  Session,
  | "assessmentImage"
  | "assessmentNegativeCognition"
  | "assessmentPositiveCognition"
  | "assessmentBelievability"
  | "assessmentEmotions"
  | "assessmentDisturbance"
  | "assessmentBodyLocation"
> & {
  assessment: Assessment;
  stimulationSets: StimulationSet[];
};

export type SessionEndPatch = {
  finalDisturbance?: number;
  notes?: string;
};

export type SessionEndRequest = SessionEndPatch & {
  sessionId: string;
};

export type SessionAssessmentUpdateRequest = {
  sessionId: string;
  assessment: Assessment;
};

export type SessionFlowTransitionRequest = {
  state: SessionFlowState;
  action: SessionFlowAction;
};

export type SessionFlowAdvanceRequest = {
  sessionId?: string;
  action: SessionFlowAction;
};

export type SessionWorkflowSnapshot = {
  state: SessionFlowState;
  activeSessionId?: string;
};

export type SessionIpcService = {
  listSessions(): SessionAggregate[] | Promise<SessionAggregate[]>;
  startSession(targetId: string): SessionAggregate | Promise<SessionAggregate>;
  updateAssessment(sessionId: string, assessment: Assessment): SessionAggregate | Promise<SessionAggregate>;
  nextSessionFlowState(state: SessionFlowState, action: SessionFlowAction): SessionFlowState | Promise<SessionFlowState>;
  currentSessionWorkflow(): SessionWorkflowSnapshot | Promise<SessionWorkflowSnapshot>;
  advanceSessionFlow(action: SessionFlowAction, sessionId?: string): SessionWorkflowSnapshot | Promise<SessionWorkflowSnapshot>;
  endSession(request: SessionEndRequest): SessionAggregate | Promise<SessionAggregate>;
};

export type SessionStimulationSetReader = {
  listBySession(sessionId: string): StimulationSet[];
};

export type SessionFlowState =
  | "idle"
  | "target_selection"
  | "preparation"
  | "stimulation"
  | "interjection"
  | "closure"
  | "review"
  | "post_session";

export type SessionFlowAction =
  | "start_session"
  | "select_target"
  | "create_target_draft"
  | "update_assessment"
  | "approve_assessment"
  | "start_stimulation"
  | "pause_stimulation"
  | "log_stimulation_set"
  | "continue_stimulation"
  | "request_grounding"
  | "begin_closure"
  | "request_review"
  | "close_session"
  | "return_to_idle";

export type SessionStateAction = StateGraphEdge<SessionFlowState, SessionFlowAction>;

export type SessionStateNode = StateGraphNode<SessionFlowState, SessionFlowAction, SessionStateAction>;
