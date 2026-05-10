import type { ActivityEvent } from "../activity/entity";
import type { Session } from "../session/types";
import type { Settings } from "../settings/types";
import type { Target } from "../target/entity";

export type Database = {
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  targets: Target[];
  sessions: Session[];
  activityEvents: ActivityEvent[];
  settings: Settings;
};
