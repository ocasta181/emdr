export type GuideViewRequest = {
  activeSessionId?: string;
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

export type GuideSessionFlowAction = "log_stimulation_set" | "close_session";

export type GuideActionProposal =
  | {
      type: "log_stimulation_set";
      sessionId: string;
      flowState: GuideSessionFlowState;
      cycleCount: number;
      observation: string;
      disturbance?: number;
    }
  | {
      type: "end_session";
      sessionId: string;
      flowState: GuideSessionFlowState;
      finalDisturbance?: number;
      notes?: string;
    };

export type GuideActionResult =
  | {
      accepted: true;
      flowState: GuideSessionFlowState;
      result: unknown;
    }
  | {
      accepted: false;
      flowState: GuideSessionFlowState;
      reason: string;
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
  stimulationSets: unknown[];
};

export type GuideTargetReader = {
  listCurrentTargets(): GuideTargetSummary[];
  listAllTargets(): GuideTargetSummary[];
};

export type GuideSessionReader = {
  listSessions(): GuideSessionSummary[];
};

export type GuideSessionMutator = {
  endSession(sessionId: string, patch?: { finalDisturbance?: number; notes?: string }): unknown;
};

export type GuideSessionFlowValidator = {
  canApplySessionFlowAction(state: GuideSessionFlowState, action: GuideSessionFlowAction): boolean;
  nextSessionFlowState(state: GuideSessionFlowState, action: GuideSessionFlowAction): GuideSessionFlowState;
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
  applyAction(proposal: GuideActionProposal): GuideActionResult | Promise<GuideActionResult>;
};
