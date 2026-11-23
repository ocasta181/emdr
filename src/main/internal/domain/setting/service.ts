import type { SQLBaseRepository } from "../../lib/store/repository/base.js";
import { createDefaultSettings } from "./factory.js";
import type { Setting } from "./entity.js";
import type { BilateralStimulationSettings, Settings } from "./types.js";

export class SettingService {
  constructor(private readonly repo: SQLBaseRepository<Setting>) {}

  getSettings(): Settings {
    const defaults = createDefaultSettings();
    const row = this.repo.find("bilateralStimulation");
    // Merge over defaults so settings saved before a field existed still get its default.
    return {
      ...defaults,
      bilateralStimulation: { ...defaults.bilateralStimulation, ...(row ? JSON.parse(row.valueJson) : {}) }
    };
  }

  updateBilateralStimulationSettings(patch: Partial<BilateralStimulationSettings>): BilateralStimulationSettings {
    const current = this.getSettings().bilateralStimulation;
    const updated = { ...current, ...patch };
    const row = this.repo.find("bilateralStimulation");
    if (row) {
      this.repo.update("bilateralStimulation", { valueJson: JSON.stringify(updated) } as Partial<Setting>);
    } else {
      this.repo.insert({ key: "bilateralStimulation", valueJson: JSON.stringify(updated) } as Setting);
    }
    return updated;
  }
}
