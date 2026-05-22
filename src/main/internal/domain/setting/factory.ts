import type { Settings } from "./types.js";

export function createDefaultSettings(): Settings {
  return {
    bilateralStimulation: {
      speed: 1.2,
      dotSize: "medium",
      dotColor: "green",
      fieldMode: "light"
    }
  };
}
