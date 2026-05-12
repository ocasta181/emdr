import initSqlJs from "sql.js";
import type { BindParams, SqlJsStatic } from "sql.js";
import { createRequire } from "node:module";
import type { SqliteDatabase } from "./types.js";
export type { SqliteDatabase } from "./types.js";

const require = createRequire(import.meta.url);

let sqlPromise: Promise<SqlJsStatic> | undefined;

export async function createSqliteDatabase(bytes?: Uint8Array) {
  const SQL = await loadSql();
  return bytes ? new SQL.Database(bytes) : new SQL.Database();
}

export function exportSqliteDatabase(db: SqliteDatabase) {
  return Buffer.from(db.export());
}

export function selectOne(db: SqliteDatabase, sql: string, params: BindParams = []) {
  const rows = selectAll(db, sql, params);
  return rows[0];
}

export function selectAll(db: SqliteDatabase, sql: string, params: BindParams = []) {
  const statement = db.prepare(sql, params);
  const rows: Record<string, unknown>[] = [];

  try {
    while (statement.step()) {
      rows.push(statement.getAsObject() as Record<string, unknown>);
    }
  } finally {
    statement.free();
  }

  return rows;
}

export function stringValue(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Expected SQLite text value.");
  }
  return value;
}

export function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export function numberValue(value: unknown) {
  if (typeof value !== "number") {
    throw new Error("Expected SQLite numeric value.");
  }
  return value;
}

export function optionalNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

async function loadSql() {
  sqlPromise ??= initSqlJs({
    locateFile: () => require.resolve("sql.js/dist/sql-wasm.wasm")
  });
  return sqlPromise;
}
