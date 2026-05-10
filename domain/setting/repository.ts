import type { SqliteDatabase } from "../../infrastructure/sqlite/database.js";
import { SQLBaseRepository } from "../../infrastructure/sqlite/repository.js";
import type { Setting } from "./entity.js";

export function newSettingRepository(db: SqliteDatabase) {
  return new SQLBaseRepository<Setting>(db, "setting", { primaryKey: "key" });
}
