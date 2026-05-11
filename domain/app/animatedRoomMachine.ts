export type AnimatedRoomState =
  | "guide"
  | "idle"
  | "targets"
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
  | { type: "pause_stimulation" };

export const initialAnimatedRoomState: AnimatedRoomState = "guide";

export function transitionAnimatedRoomState(
  state: AnimatedRoomState,
  event: AnimatedRoomEvent
): AnimatedRoomState {
  switch (event.type) {
    case "select_guide":
      return "guide";
    case "select_targets":
      return state === "stimulation" || state === "stimulation_settings" ? state : "targets";
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
  }
}

export function animatedPanelForState(state: AnimatedRoomState): AnimatedPanel {
  switch (state) {
    case "guide":
      return "chat";
    case "targets":
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
