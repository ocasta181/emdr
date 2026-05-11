import type { SqlValue } from "sql.js";

export type SqliteRow = Record<string, SqlValue>;

export type SQLBaseRepositoryOptions = {
  primaryKey?: string;
  orderBy?: string;
};

export type ListOptions = {
  limit?: number;
  offset?: number;
};
