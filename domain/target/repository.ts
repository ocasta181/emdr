import type { SqliteDatabase } from "../../src/main/internal/lib/store/sqlite/connection.js";
import { SQLBaseRepository } from "../../src/main/internal/lib/store/repository/base.js";
import type { Target } from "./entity.js";

export const newTargetRepository = (db: SqliteDatabase) =>
  new SQLBaseRepository<Target>(db, "target", { orderBy: "created_at ASC" });
