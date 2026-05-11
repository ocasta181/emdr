import type { SqliteDatabase } from "../../core/internal/sqlite/connection.js";
import { SQLBaseRepository } from "../../core/internal/repository/base.js";
import type { Setting } from "./entity.js";

export const newSettingRepository = (db: SqliteDatabase) =>
  new SQLBaseRepository<Setting>(db, "setting", { primaryKey: "key" });
