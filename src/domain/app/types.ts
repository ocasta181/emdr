import type { SessionAggregate } from "../session/types";
import type { Settings } from "../settings/types";
import type { Target } from "../target/entity";

export type Database = {
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  targets: Target[];
  sessions: SessionAggregate[];
  settings: Settings;
};
