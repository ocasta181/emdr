import type { SqliteDatabase } from "../../infrastructure/sqlite/connection.js";
import { SQLBaseRepository } from "../../infrastructure/sqlite/repository.js";
import type { Session } from "./entity.js";

export const newSessionRepository = (db: SqliteDatabase) =>
  new SQLBaseRepository<Session>(db, "session", { orderBy: "started_at ASC" });
