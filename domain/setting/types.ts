export type BilateralStimulationSettings = {
  speed: number;
  dotSize: "small" | "medium" | "large";
  dotColor: "green" | "blue" | "white" | "orange";
};

export type Settings = {
  bilateralStimulation: BilateralStimulationSettings;
};
