import type { SqliteDatabase } from "../../infrastructure/sqlite/database.js";
import { SQLBaseRepository } from "../../infrastructure/sqlite/repository.js";
import type { StimulationSet } from "./entity.js";

export const newStimulationSetRepository = (db: SqliteDatabase) =>
  new SQLBaseRepository<StimulationSet>(db, "stimulation_set", { orderBy: "session_id ASC, set_number ASC" });
