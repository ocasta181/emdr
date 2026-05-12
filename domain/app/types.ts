import type { SessionAggregate } from "../../src/main/internal/domain/session/types.js";
import type { Settings } from "../../src/main/internal/domain/setting/types.js";
import type { Target } from "../../src/main/internal/domain/target/entity.js";

export type Database = {
  targets: Target[];
  sessions: SessionAggregate[];
  settings: Settings;
};
