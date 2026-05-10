import type { Database } from "./types.js";
import { nowIso } from "../../utils.js";
import { createDefaultSettings } from "../setting/factory.js";

export function createEmptyDatabase(): Database {
  const now = nowIso();
  return {
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    targets: [],
    sessions: [],
    settings: createDefaultSettings()
  };
}
