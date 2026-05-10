import type { ActivityEvent } from "../activity/types";
import type { Session } from "../session/types";
import type { Settings } from "../settings/types";
import type { Target } from "../target/types";

export type Database = {
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  targets: Target[];
  sessions: Session[];
  activityEvents: ActivityEvent[];
  settings: Settings;
};
