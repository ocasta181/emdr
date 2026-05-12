import type { Database } from "./types.js";
import { createDefaultSettings } from "../setting/factory.js";

export function createEmptyDatabase(): Database {
  return {
    targets: [],
    sessions: [],
    settings: createDefaultSettings()
  };
}
