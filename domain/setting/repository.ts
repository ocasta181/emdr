import type { SqliteDatabase } from "../../src/main/internal/lib/store/sqlite/connection.js";
import { SQLBaseRepository } from "../../src/main/internal/lib/store/repository/base.js";
import type { Setting } from "./entity.js";

export const newSettingRepository = (db: SqliteDatabase) =>
  new SQLBaseRepository<Setting>(db, "setting", { primaryKey: "key" });
