import initSqlJs from "sql.js";
import type { BindParams, Database as SqlDatabase, SqlJsStatic } from "sql.js";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

let sqlPromise: Promise<SqlJsStatic> | undefined;

export type SqliteDatabase = SqlDatabase;

export function sqliteDatabasePath(userDataPath: string) {
  return path.join(userDataPath, "emdr-local.sqlite");
}

export function legacyJsonDatabasePath(userDataPath: string) {
  return path.join(userDataPath, "emdr-local.db.json");
}

export async function openSqliteDatabase(sqlitePath: string) {
  const SQL = await loadSql();
  await mkdir(path.dirname(sqlitePath), { recursive: true });

  if (await fileHasData(sqlitePath)) {
    return new SQL.Database(await readFile(sqlitePath));
  }

  return new SQL.Database();
}

export async function persistSqliteDatabase(db: SqlDatabase, sqlitePath: string) {
  const temporaryPath = `${sqlitePath}.tmp`;
  await writeFile(temporaryPath, Buffer.from(db.export()));
  await rename(temporaryPath, sqlitePath);
}

export function selectOne(db: SqlDatabase, sql: string, params: BindParams = []) {
  const rows = selectAll(db, sql, params);
  return rows[0];
}

export function selectAll(db: SqlDatabase, sql: string, params: BindParams = []) {
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

async function fileHasData(filePath: string) {
  return existsSync(filePath) && (await stat(filePath)).size > 0;
}
