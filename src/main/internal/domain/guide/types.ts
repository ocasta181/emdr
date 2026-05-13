export type GuideViewRequest = {
  activeSessionId?: string;
};

export type GuideMessageRequest = {
  activeSessionId?: string;
  message: string;
};

export type GuideSessionFlowState =
  | "idle"
  | "target_selection"
  | "preparation"
  | "stimulation"
  | "interjection"
  | "closure"
  | "review"
  | "post_session";

export type GuideSessionFlowAction =
  | "create_target_draft"
  | "update_assessment"
  | "continue_stimulation"
  | "request_grounding"
  | "begin_closure"
  | "request_review"
  | "log_stimulation_set"
  | "close_session";

export type GuideAdvanceSessionFlowAction = Extract<
  GuideSessionFlowAction,
  "continue_stimulation" | "request_grounding" | "begin_closure" | "request_review"
>;

export type GuideAssessmentPatch = {
  image?: string;
  negativeCognition?: string;
  positiveCognition?: string;
  believability?: number;
  emotions?: string;
  disturbance?: number;
  bodyLocation?: string;
};

export type GuideAssessment = {
  image?: string;
  negativeCognition: string;
  positiveCognition: string;
  believability?: number;
  emotions?: string;
  disturbance?: number;
  bodyLocation?: string;
};

export type GuideActionProposal =
  | {
      type: "create_target_draft";
      workflowState: GuideSessionFlowState;
      description: string;
      negativeCognition?: string;
      positiveCognition?: string;
    }
  | {
      type: "update_assessment";
      sessionId: string;
      workflowState: GuideSessionFlowState;
      assessment: GuideAssessmentPatch;
    }
  | {
      type: "advance_session_flow";
      sessionId: string;
      workflowState: GuideSessionFlowState;
      action: GuideAdvanceSessionFlowAction;
    }
  | {
      type: "log_stimulation_set";
      sessionId: string;
      workflowState: GuideSessionFlowState;
      cycleCount: number;
      observation: string;
      disturbance?: number;
    }
  | {
      type: "end_session";
      sessionId: string;
      workflowState: GuideSessionFlowState;
      finalDisturbance?: number;
      notes?: string;
    };

export type GuideSessionWorkflowSnapshot = {
  state: GuideSessionFlowState;
  activeSessionId?: string;
};

export type GuideActionResult =
  | {
      accepted: true;
      workflow: GuideSessionWorkflowSnapshot;
      result: unknown;
    }
  | {
      accepted: false;
      workflow: GuideSessionWorkflowSnapshot;
      reason: string;
    };

export type GuideAgentResponse = {
  messages: string[];
  proposals: GuideActionProposal[];
};

export type GuideAgentContext = {
  message: string;
  view: GuideView;
  workflow: GuideSessionWorkflowSnapshot;
};

export type GuideAgentPort = {
  respond(context: GuideAgentContext): Promise<GuideAgentResponse>;
};

export type GuideViewMode = "idle" | "session";

export type GuidePanelAction = {
  type: "open_targets";
  label: string;
};

export type GuideSessionView = {
  sessionId: string;
  targetId: string;
  targetDescription: string;
  workflowState: GuideSessionFlowState;
  stimulationSetCount: number;
};

export type GuideView = {
  mode: GuideViewMode;
  targetCount: number;
  messages: string[];
  primaryAction?: GuidePanelAction;
  activeSession?: GuideSessionView;
};

export type GuideTargetSummary = {
  id: string;
  description: string;
};

export type GuideSessionSummary = {
  id: string;
  targetId: string;
  endedAt?: string;
  assessment: GuideAssessment;
  stimulationSets: unknown[];
};

export type GuideTargetReader = {
  listCurrentTargets(): GuideTargetSummary[];
  listAllTargets(): GuideTargetSummary[];
};

export type GuideTargetMutator = {
  addTarget(draft: { description: string; negativeCognition: string; positiveCognition: string }): unknown;
};

export type GuideSessionReader = {
  listSessions(): GuideSessionSummary[];
};

export type GuideSessionMutator = {
  updateAssessment(sessionId: string, assessment: GuideAssessment): unknown;
  advanceSessionFlow(action: GuideAdvanceSessionFlowAction, sessionId?: string): GuideSessionWorkflowSnapshot;
  endSession(sessionId: string, patch?: { finalDisturbance?: number; notes?: string }): unknown;
};

export type GuideSessionFlowValidator = {
  canApplySessionFlowAction(state: GuideSessionFlowState, action: GuideSessionFlowAction): boolean;
  currentSessionWorkflow(): GuideSessionWorkflowSnapshot;
};

export type GuideStimulationSetWriter = {
  logStimulationSet(draft: {
    sessionId: string;
    cycleCount: number;
    observation: string;
    disturbance?: number;
  }): unknown;
};

export type GuideIpcService = {
  getView(request: GuideViewRequest): GuideView | Promise<GuideView>;
  respondToMessage(request: GuideMessageRequest): GuideAgentResponse | Promise<GuideAgentResponse>;
  applyAction(proposal: GuideActionProposal): GuideActionResult | Promise<GuideActionResult>;
};
