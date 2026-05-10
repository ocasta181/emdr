import type { SqliteDatabase } from "../../infrastructure/sqlite/database.js";
import { stringValue } from "../../infrastructure/sqlite/database.js";
import { createRepository } from "../../infrastructure/sqlite/repository.js";
import type { Setting } from "./entity.js";

const columns = ["key", "value_json"];

export function ensureSettingTable(db: SqliteDatabase) {
  db.run(`
    CREATE TABLE IF NOT EXISTS setting (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );
  `);
}

export function readSetting<T>(db: SqliteDatabase, key: string) {
  const setting = settingRepository(db).find(key);
  return setting ? (JSON.parse(setting.valueJson) as T) : undefined;
}

export function replaceSetting(db: SqliteDatabase, key: string, value: unknown) {
  settingRepository(db).insert({ key, valueJson: JSON.stringify(value) });
}

export function deleteSettings(db: SqliteDatabase) {
  settingRepository(db).deleteAll();
}

function settingRepository(db: SqliteDatabase) {
  return createRepository<Setting>(db, {
    tableName: "setting",
    primaryKey: "key",
    columns,
    toRow: (setting) => ({
      key: setting.key,
      value_json: setting.valueJson
    }),
    fromRow: (row) => ({
      key: stringValue(row.key),
      valueJson: stringValue(row.value_json)
    })
  });
}
