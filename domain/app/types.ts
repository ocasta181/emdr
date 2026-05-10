import type { SessionAggregate } from "../session/types.js";
import type { Settings } from "../setting/types.js";
import type { Target } from "../target/entity.js";

export type Database = {
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  targets: Target[];
  sessions: SessionAggregate[];
  settings: Settings;
};
