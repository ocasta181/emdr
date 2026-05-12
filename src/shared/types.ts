export type TargetStatus = "active" | "completed" | "deferred";

export type Target = {
  id: string;
  parentId?: string;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
  description: string;
  negativeCognition: string;
  positiveCognition: string;
  clusterTag?: string;
  initialDisturbance?: number;
  currentDisturbance?: number;
  status: TargetStatus;
  notes?: string;
};

export type TargetDraft = Pick<Target, "description" | "negativeCognition" | "positiveCognition"> &
  Partial<Pick<Target, "clusterTag" | "initialDisturbance" | "currentDisturbance" | "status" | "notes">>;

export type Assessment = {
  image?: string;
  negativeCognition: string;
  positiveCognition: string;
  believability?: number;
  emotions?: string;
  disturbance?: number;
  bodyLocation?: string;
};

export type Session = {
  id: string;
  targetId: string;
  startedAt: string;
  endedAt?: string;
  assessmentImage?: string;
  assessmentNegativeCognition: string;
  assessmentPositiveCognition: string;
  assessmentBelievability?: number;
  assessmentEmotions?: string;
  assessmentDisturbance?: number;
  assessmentBodyLocation?: string;
  finalDisturbance?: number;
  notes?: string;
};

export type StimulationSet = {
  id: string;
  sessionId: string;
  setNumber: number;
  createdAt: string;
  cycleCount: number;
  observation: string;
  disturbance?: number;
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

export type SessionWorkflowSnapshot = {
  state: SessionFlowState;
  activeSessionId?: string;
};

export type BilateralStimulationSettings = {
  speed: number;
  dotSize: "small" | "medium" | "large";
  dotColor: "green" | "blue" | "white" | "orange";
};

export type Settings = {
  bilateralStimulation: BilateralStimulationSettings;
};

export type StimulationSetDraft = {
  sessionId: string;
  cycleCount: number;
  observation: string;
  disturbance?: number;
};

export type SessionEndPatch = {
  sessionId: string;
  finalDisturbance?: number;
  notes?: string;
};

export type GuideActionProposal =
  | {
      type: "log_stimulation_set";
      sessionId: string;
      workflowState: SessionFlowState;
      cycleCount: number;
      observation: string;
      disturbance?: number;
    }
  | {
      type: "end_session";
      sessionId: string;
      workflowState: SessionFlowState;
      finalDisturbance?: number;
      notes?: string;
    };

export type GuideActionResult =
  | {
      accepted: true;
      workflow: SessionWorkflowSnapshot;
      result: unknown;
    }
  | {
      accepted: false;
      workflow: SessionWorkflowSnapshot;
      reason: string;
    };

export type GuidePanelAction = {
  type: "open_targets";
  label: string;
};

export type GuideSessionView = {
  sessionId: string;
  targetId: string;
  targetDescription: string;
  workflowState: SessionFlowState;
  stimulationSetCount: number;
};

export type GuideView = {
  mode: "idle" | "session";
  targetCount: number;
  messages: string[];
  primaryAction?: GuidePanelAction;
  activeSession?: GuideSessionView;
};
