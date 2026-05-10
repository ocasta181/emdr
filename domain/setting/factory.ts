import type { Settings } from "./types.js";

export function createDefaultSettings(): Settings {
  return {
    bilateralStimulation: {
      speed: 1,
      dotSize: "medium",
      dotColor: "green"
    }
  };
}
