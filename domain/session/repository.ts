import type { SqliteDatabase } from "../../core/internal/sqlite/connection.js";
import { SQLBaseRepository } from "../../core/internal/repository/base.js";
import type { Session } from "./entity.js";

export const newSessionRepository = (db: SqliteDatabase) =>
  new SQLBaseRepository<Session>(db, "session", { orderBy: "started_at ASC" });
