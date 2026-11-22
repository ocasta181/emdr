export type BilateralStimulationSettings = {
  speed: number;
  dotSize: "small" | "medium" | "large";
  dotColor: "green" | "blue" | "white" | "orange";
  path: "horizontal" | "arc" | "pendulum";
};

export type Settings = {
  bilateralStimulation: BilateralStimulationSettings;
};

export type SettingIpcService = {
  getSettings(): Settings | Promise<Settings>;
  updateBilateralStimulationSettings(
    patch: Partial<BilateralStimulationSettings>
  ): BilateralStimulationSettings | Promise<BilateralStimulationSettings>;
};
