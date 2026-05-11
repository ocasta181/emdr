export type AnimatedRoomState =
  | "guide"
  | "idle"
  | "targets_reading"
  | "targets_browsing"
  | "targets_writing"
  | "history"
  | "stimulation"
  | "stimulation_settings";

export type AnimatedPanel = "chat" | "targets" | "history" | "settings" | null;

export type AnimatedRoomEvent =
  | { type: "select_guide" }
  | { type: "select_targets" }
  | { type: "select_history" }
  | { type: "select_settings" }
  | { type: "close_panel" }
  | { type: "start_stimulation" }
  | { type: "pause_stimulation" }
  | { type: "browse_targets" }
  | { type: "write_target" }
  | { type: "finish_target_action" };

export const initialAnimatedRoomState: AnimatedRoomState = "guide";

export function transitionAnimatedRoomState(
  state: AnimatedRoomState,
  event: AnimatedRoomEvent
): AnimatedRoomState {
  switch (event.type) {
    case "select_guide":
      return "guide";
    case "select_targets":
      return state === "stimulation" || state === "stimulation_settings" ? state : "targets_reading";
    case "select_history":
      return state === "stimulation" || state === "stimulation_settings" ? state : "history";
    case "select_settings":
      return state === "stimulation" || state === "stimulation_settings" ? "stimulation_settings" : state;
    case "close_panel":
      return state === "stimulation_settings" ? "stimulation" : "idle";
    case "start_stimulation":
      return "stimulation";
    case "pause_stimulation":
      return "guide";
    case "browse_targets":
      return state === "targets_reading" || state === "targets_writing" ? "targets_browsing" : state;
    case "write_target":
      return state === "targets_reading" || state === "targets_browsing" ? "targets_writing" : state;
    case "finish_target_action":
      return state === "targets_browsing" || state === "targets_writing" ? "targets_reading" : state;
  }
}

export function animatedPanelForState(state: AnimatedRoomState): AnimatedPanel {
  switch (state) {
    case "guide":
      return "chat";
    case "targets_reading":
    case "targets_browsing":
    case "targets_writing":
      return "targets";
    case "history":
      return "history";
    case "stimulation_settings":
      return "settings";
    case "idle":
    case "stimulation":
      return null;
  }
}

export function animatedRoomStimulationRunning(state: AnimatedRoomState) {
  return state === "stimulation" || state === "stimulation_settings";
}
