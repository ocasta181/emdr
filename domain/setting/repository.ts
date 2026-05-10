import type { SqliteDatabase } from "../../infrastructure/sqlite/connection.js";
import { SQLBaseRepository } from "../../infrastructure/sqlite/repository.js";
import type { Setting } from "./entity.js";

export const newSettingRepository = (db: SqliteDatabase) =>
  new SQLBaseRepository<Setting>(db, "setting", { primaryKey: "key" });
