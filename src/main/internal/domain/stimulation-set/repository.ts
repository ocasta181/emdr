import type { SqliteDatabase } from "../../lib/store/sqlite/connection.js";
import { SQLBaseRepository } from "../../lib/store/repository/base.js";
import type { StimulationSet } from "./entity.js";

export const newStimulationSetRepository = (db: SqliteDatabase) =>
  new SQLBaseRepository<StimulationSet>(db, "stimulation_set", { orderBy: "session_id ASC, set_number ASC" });
