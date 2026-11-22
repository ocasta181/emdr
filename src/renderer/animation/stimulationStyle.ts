import type { BilateralStimulationSettings } from "../../shared/types";

/** Radians per second at 1x speed; one full left-right-left cycle takes 2π / this. */
export const orbAngularSpeed = 1.55;

export const orbDiameter = { small: 44, medium: 64, large: 88 } as const;

export const stimulationColors: Array<{ value: BilateralStimulationSettings["dotColor"]; label: string; hex: string }> = [
  { value: "green", label: "Green", hex: "#6dd07a" },
  { value: "blue", label: "Blue", hex: "#6ec1e4" },
  { value: "white", label: "White", hex: "#f3f3f3" },
  { value: "orange", label: "Orange", hex: "#ff9b50" }
];

export function stimulationColorHex(color: BilateralStimulationSettings["dotColor"]) {
  return stimulationColors.find((entry) => entry.value === color)?.hex ?? stimulationColors[0].hex;
}
