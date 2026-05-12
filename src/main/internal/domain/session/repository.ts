import type { SqliteDatabase } from "../../lib/store/sqlite/connection.js";
import { SQLBaseRepository } from "../../lib/store/repository/base.js";
import type { Session } from "./entity.js";

export const newSessionRepository = (db: SqliteDatabase) =>
  new SQLBaseRepository<Session>(db, "session", { orderBy: "started_at ASC" });
