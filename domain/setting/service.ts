import type { Database } from "../app/types.js";
import type { BilateralStimulationSettings } from "./types.js";

export function updateBilateralStimulationSettings(
  database: Database,
  patch: Partial<BilateralStimulationSettings>
): Database {
  return {
    ...database,
    settings: {
      ...database.settings,
      bilateralStimulation: {
        ...database.settings.bilateralStimulation,
        ...patch
      }
    }
  };
}
