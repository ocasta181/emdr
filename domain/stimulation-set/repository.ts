import type { SqliteDatabase } from "../../infrastructure/sqlite/database.js";
import { SQLBaseRepository } from "../../infrastructure/sqlite/repository.js";
import type { StimulationSet } from "./entity.js";

export function newStimulationSetRepository(db: SqliteDatabase) {
  return new SQLBaseRepository<StimulationSet>(db, "stimulation_set", { orderBy: "session_id ASC, set_number ASC" });
}
