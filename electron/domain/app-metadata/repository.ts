import type { SqliteDatabase } from "../../infrastructure/sqlite/database.js";
import { stringValue } from "../../infrastructure/sqlite/database.js";
import { createRepository } from "../../infrastructure/sqlite/repository.js";
import type { AppMetadata } from "./entity.js";

const columns = ["key", "value"];

export function ensureAppMetadataTable(db: SqliteDatabase) {
  db.run(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export function readAppMetadata(db: SqliteDatabase, key: string) {
  return appMetadataRepository(db).find(key)?.value;
}

export function replaceAppMetadata(db: SqliteDatabase, metadata: Record<string, string>) {
  appMetadataRepository(db).replaceAll(Object.entries(metadata).map(([key, value]) => ({ key, value })));
}

function appMetadataRepository(db: SqliteDatabase) {
  return createRepository<AppMetadata>(db, {
    tableName: "app_metadata",
    primaryKey: "key",
    columns,
    toRow: (metadata) => ({
      key: metadata.key,
      value: metadata.value
    }),
    fromRow: (row) => ({
      key: stringValue(row.key),
      value: stringValue(row.value)
    })
  });
}
