import type { BindParams, Database as SqlDatabase, Statement } from "sql.js";

export type SqliteDatabase = Pick<SqlDatabase, "export"> & {
  prepare(sql: string, params?: BindParams): Statement;
  run(sql: string, params?: BindParams): SqliteDatabase;
};
