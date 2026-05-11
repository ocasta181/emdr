import type { SessionFlowDefinition } from "./types.js";

export const sessionFlowDefinitions = [
  {
    state: "idle",
    transitions: [
      { action: "start_session", nextState: "target_selection" },
      { action: "select_target", nextState: "preparation" }
    ]
  },
  {
    state: "target_selection",
    transitions: [
      { action: "select_target", nextState: "preparation" },
      { action: "create_target_draft", nextState: "target_selection" },
      { action: "return_to_idle", nextState: "idle" }
    ]
  },
  {
    state: "preparation",
    transitions: [
      { action: "update_assessment", nextState: "preparation" },
      { action: "approve_assessment", nextState: "stimulation" },
      { action: "request_grounding", nextState: "interjection" },
      { action: "begin_closure", nextState: "closure" }
    ]
  },
  {
    state: "stimulation",
    transitions: [
      { action: "start_stimulation", nextState: "stimulation" },
      { action: "log_stimulation_set", nextState: "stimulation" },
      { action: "pause_stimulation", nextState: "interjection" },
      { action: "request_grounding", nextState: "interjection" },
      { action: "begin_closure", nextState: "closure" }
    ]
  },
  {
    state: "interjection",
    transitions: [
      { action: "continue_stimulation", nextState: "stimulation" },
      { action: "request_grounding", nextState: "interjection" },
      { action: "begin_closure", nextState: "closure" }
    ]
  },
  {
    state: "closure",
    transitions: [
      { action: "request_review", nextState: "review" },
      { action: "continue_stimulation", nextState: "stimulation" },
      { action: "request_grounding", nextState: "interjection" }
    ]
  },
  {
    state: "review",
    transitions: [
      { action: "close_session", nextState: "post_session" },
      { action: "begin_closure", nextState: "closure" }
    ]
  },
  {
    state: "post_session",
    transitions: [
      { action: "return_to_idle", nextState: "idle" },
      { action: "start_session", nextState: "target_selection" }
    ]
  }
] satisfies SessionFlowDefinition[];
