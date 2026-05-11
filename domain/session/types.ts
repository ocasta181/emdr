import type { StimulationSet } from "../stimulation-set/entity.js";
import type { Session } from "./entity.js";

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
  | "review_session"
  | "complete_session"
  | "return_to_idle";

export type AgentToolName =
  | "create_target_draft"
  | "select_target"
  | "update_session_assessment"
  | "start_stimulation"
  | "pause_stimulation"
  | "log_stimulation_set"
  | "close_session"
  | "show_grounding_prompt"
  | "request_user_review";

export type SessionFlowTransition = {
  action: SessionFlowAction;
  nextState: SessionFlowState;
};

export type SessionFlowDefinition = {
  state: SessionFlowState;
  transitions: SessionFlowTransition[];
};

export type SessionFlowStateDetails = {
  state: SessionFlowState;
  label: string;
  description: string;
  allowedAgentTools: AgentToolName[];
};
