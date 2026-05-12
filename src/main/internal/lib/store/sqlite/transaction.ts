import type { SqliteDatabase } from "./connection.js";

export function runSqliteTransaction<T>(db: SqliteDatabase, work: () => T): T {
  db.run("BEGIN TRANSACTION");

  try {
    const result = work();
    db.run("COMMIT");
    return result;
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}
