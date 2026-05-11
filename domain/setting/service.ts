import type { SQLBaseRepository } from "../../core/internal/repository/base.js";
import { createDefaultSettings } from "./factory.js";
import type { Setting } from "./entity.js";
import type { BilateralStimulationSettings, Settings } from "./types.js";

export function getSettings(repo: SQLBaseRepository<Setting>): Settings {
  const row = repo.find("bilateralStimulation");
  return {
    ...createDefaultSettings(),
    ...(row ? { bilateralStimulation: JSON.parse(row.valueJson) } : {})
  };
}

export function updateBilateralStimulationSettings(
  repo: SQLBaseRepository<Setting>,
  patch: Partial<BilateralStimulationSettings>
): BilateralStimulationSettings {
  const current = getSettings(repo).bilateralStimulation;
  const updated = { ...current, ...patch };
  const row = repo.find("bilateralStimulation");
  if (row) {
    repo.update("bilateralStimulation", { valueJson: JSON.stringify(updated) } as Partial<Setting>);
  } else {
    repo.insert({ key: "bilateralStimulation", valueJson: JSON.stringify(updated) } as Setting);
  }
  return updated;
}
