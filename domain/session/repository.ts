import type { SqliteDatabase } from "../../infrastructure/sqlite/database.js";
import { SQLBaseRepository } from "../../infrastructure/sqlite/repository.js";
import type { Session } from "./entity.js";

export function newSessionRepository(db: SqliteDatabase) {
  return new SQLBaseRepository<Session>(db, "session", { orderBy: "started_at ASC" });
}
