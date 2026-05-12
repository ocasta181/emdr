import type { SqliteDatabase } from "../../src/main/internal/lib/store/sqlite/connection.js";
import { SQLBaseRepository } from "../../src/main/internal/lib/store/repository/base.js";
import type { Session } from "./entity.js";

export const newSessionRepository = (db: SqliteDatabase) =>
  new SQLBaseRepository<Session>(db, "session", { orderBy: "started_at ASC" });
