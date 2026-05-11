import type { SqliteDatabase } from "../../core/internal/sqlite/connection.js";
import { SQLBaseRepository } from "../../core/internal/repository/base.js";
import type { StimulationSet } from "./entity.js";

export const newStimulationSetRepository = (db: SqliteDatabase) =>
  new SQLBaseRepository<StimulationSet>(db, "stimulation_set", { orderBy: "session_id ASC, set_number ASC" });
