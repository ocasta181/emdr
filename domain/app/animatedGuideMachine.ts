export type AnimatedGuideState =
  | "speaking"
  | "idle"
  | "targets_reading"
  | "targets_browsing"
  | "targets_writing"
  | "thinking";

export type AnimatedGuideEvent =
  | { type: "speak" }
  | { type: "idle" }
  | { type: "read_targets" }
  | { type: "browse_targets" }
  | { type: "write_target" }
  | { type: "think" }
  | { type: "finish_target_action" };

export const initialAnimatedGuideState: AnimatedGuideState = "speaking";

export function transitionAnimatedGuideState(
  state: AnimatedGuideState,
  event: AnimatedGuideEvent
): AnimatedGuideState {
  switch (event.type) {
    case "speak":
      return "speaking";
    case "idle":
      return "idle";
    case "read_targets":
      return "targets_reading";
    case "browse_targets":
      return state === "targets_reading" || state === "targets_writing" ? "targets_browsing" : state;
    case "write_target":
      return state === "targets_reading" || state === "targets_browsing" ? "targets_writing" : state;
    case "think":
      return "thinking";
    case "finish_target_action":
      return state === "targets_browsing" || state === "targets_writing" ? "targets_reading" : state;
  }
}
