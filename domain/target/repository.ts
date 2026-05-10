import type { SqliteDatabase } from "../../infrastructure/sqlite/database.js";
import { SQLBaseRepository } from "../../infrastructure/sqlite/repository.js";
import type { Target } from "./entity.js";

export function newTargetRepository(db: SqliteDatabase) {
  return new SQLBaseRepository<Target>(db, "target", { orderBy: "created_at ASC" });
}
