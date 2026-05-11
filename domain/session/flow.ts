import type { SessionStateNode } from "./types.js";

export const sessionStateGraph = [
  {
    state: "idle",
    actions: [
      { action: "start_session", to: "target_selection" },
      { action: "select_target", to: "preparation" }
    ]
  },
  {
    state: "target_selection",
    actions: [
      { action: "select_target", to: "preparation" },
      { action: "create_target_draft", to: "target_selection" },
      { action: "return_to_idle", to: "idle" }
    ]
  },
  {
    state: "preparation",
    actions: [
      { action: "update_assessment", to: "preparation" },
      { action: "approve_assessment", to: "stimulation" },
      { action: "request_grounding", to: "interjection" },
      { action: "begin_closure", to: "closure" }
    ]
  },
  {
    state: "stimulation",
    actions: [
      { action: "start_stimulation", to: "stimulation" },
      { action: "log_stimulation_set", to: "stimulation" },
      { action: "pause_stimulation", to: "interjection" },
      { action: "request_grounding", to: "interjection" },
      { action: "begin_closure", to: "closure" }
    ]
  },
  {
    state: "interjection",
    actions: [
      { action: "continue_stimulation", to: "stimulation" },
      { action: "request_grounding", to: "interjection" },
      { action: "begin_closure", to: "closure" }
    ]
  },
  {
    state: "closure",
    actions: [
      { action: "request_review", to: "review" },
      { action: "continue_stimulation", to: "stimulation" },
      { action: "request_grounding", to: "interjection" }
    ]
  },
  {
    state: "review",
    actions: [
      { action: "close_session", to: "post_session" },
      { action: "begin_closure", to: "closure" }
    ]
  },
  {
    state: "post_session",
    actions: [
      { action: "return_to_idle", to: "idle" },
      { action: "start_session", to: "target_selection" }
    ]
  }
] satisfies SessionStateNode[];
