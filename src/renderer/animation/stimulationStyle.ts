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

export type StimulationPath = BilateralStimulationSettings["path"];

export const stimulationPaths: Array<{ value: StimulationPath; label: string }> = [
  { value: "horizontal", label: "Horizontal" },
  { value: "arc", label: "Arc" },
  { value: "pendulum", label: "Pendulum" }
];

/**
 * Vertical offset as a fraction of the path height for a horizontal offset `dx` in [-1, 1].
 * Arc rises toward the middle; pendulum dips toward the middle like a swinging weight.
 */
export function pathLift(path: StimulationPath, dx: number) {
  const curve = 1 - dx * dx;
  if (path === "arc") return -curve;
  if (path === "pendulum") return curve;
  return 0;
}

export function stimulationColorHex(color: BilateralStimulationSettings["dotColor"]) {
  return stimulationColors.find((entry) => entry.value === color)?.hex ?? stimulationColors[0].hex;
}
