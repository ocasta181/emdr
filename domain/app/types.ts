import type { SessionAggregate } from "../../src/main/internal/domain/session/types.js";
import type { Settings } from "../setting/types.js";
import type { Target } from "../../src/main/internal/domain/target/entity.js";

export type Database = {
  targets: Target[];
  sessions: SessionAggregate[];
  settings: Settings;
};
