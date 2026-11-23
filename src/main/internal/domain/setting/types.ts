export type BilateralStimulationSettings = {
  speed: number;
  dotSize: "small" | "medium" | "large";
  dotColor: "green" | "blue" | "white" | "orange";
  path: "horizontal" | "arc" | "pendulum";
  /** Cycles per set before it ends on its own; 0 means the set runs until paused. */
  setLength: number;
  /** Alternating left/right tones that follow the dot. */
  audio: "off" | "tones";
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
