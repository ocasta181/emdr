import type { SqliteDatabase } from "../../lib/store/sqlite/connection.js";
import { SQLBaseRepository } from "../../lib/store/repository/base.js";
import type { Setting } from "./entity.js";

export const newSettingRepository = (db: SqliteDatabase) =>
  new SQLBaseRepository<Setting>(db, "setting", { primaryKey: "key" });
