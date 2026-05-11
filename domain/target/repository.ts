import type { SqliteDatabase } from "../../core/internal/sqlite/connection.js";
import { SQLBaseRepository } from "../../core/internal/repository/base.js";
import type { Target } from "./entity.js";

export const newTargetRepository = (db: SqliteDatabase) =>
  new SQLBaseRepository<Target>(db, "target", { orderBy: "created_at ASC" });
