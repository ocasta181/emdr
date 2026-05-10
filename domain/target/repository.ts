import type { SqliteDatabase } from "../../infrastructure/sqlite/connection.js";
import { SQLBaseRepository } from "../../infrastructure/sqlite/repository.js";
import type { Target } from "./entity.js";

export const newTargetRepository = (db: SqliteDatabase) =>
  new SQLBaseRepository<Target>(db, "target", { orderBy: "created_at ASC" });
