import type { SqliteDatabase } from "../connection.js";
import { up as initialSchema } from "./0001_initial_schema.js";
import { up as targetParentLinks } from "./0002_target_parent_links.js";

const migrations = [
  { version: 1, up: initialSchema },
  { version: 2, up: targetParentLinks }
];

export function runMigrations(db: SqliteDatabase) {
  db.run(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS schema_migration (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.exec("SELECT version FROM schema_migration")[0]?.values.map(([version]) => Number(version)) ?? []
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    migration.up(db);
    db.run("INSERT INTO schema_migration (version, applied_at) VALUES (?, ?)", [
      migration.version,
      new Date().toISOString()
    ]);
  }
}
